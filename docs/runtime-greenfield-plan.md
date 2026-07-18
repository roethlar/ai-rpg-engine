# Runtime Greenfield Plan — cost-first engine architecture

**Mandate** (owner, 2026-07-18): greenfield-plan a better, cheaper engine for the models to use.
Prior decisions and rules are **not binding** on this plan. The hard constraint is economic: a
campaign must not cost $50 — that money buys a AAA title delivering 50–100 hours. Facts the model
needs must be immediately available without being a carried token burden.

**Planning numbers.** A campaign is 50–100 hours of play. Observed solo pacing is 2–3 minutes per
committed turn, so the planning envelope is **2,000 turns per campaign** (upper band; a 1,200-turn
campaign scales linearly). Budget bar: **≤ $15 expected, $25 hard ceiling** per 2,000-turn
campaign — i.e. ≤ ~$0.0075 expected per turn, all model calls included.

---

## 1. Baseline: why the current engine is expensive

The shipped runtime (`rpg-engine.js`, `runMultiAgentTurn`) is a **Council**: up to six sequential
model calls per committed turn — interaction proposal, grounding verifier, continuity review,
referee, continuity final, final narration. Each call re-carries a per-turn rebuilt system
instruction (`getGMSystemInstruction(outline, character, npcs, act, ruleset, location, party,
tableStyle)`) plus a history block of importance-ranked memory summaries and recent turns
(truncated at 500 chars each). Costs compound four ways:

1. **Call multiplication** — six calls each re-pay the full context.
2. **Cache hostility** — the system instruction is rebuilt with volatile state interleaved, so
   provider prompt caching rarely applies past turn one.
3. **Carried transcript** — history rides in every call and grows with session length.
4. **Sequential latency** — six round-trips per turn is also the "video-gamey sluggishness" the
   improvement plan complains about; cost and feel degrade together.

Estimated baseline: 6 calls × ~4–6k input / 0.3–1k output per turn ≈ 25–40k in, 2–4k out.
At mixed mid/frontier pricing that is **$0.08–0.20 per turn → $160–400 per 2,000-turn campaign**;
even forced all-small it is ~$40–60. The architecture, not the model choice, is the cost problem.

## 2. Design principles

- **P1 — One model call on the hot path.** A committed turn costs one structured call in the
  common case. Everything deterministic (dice arithmetic, legality, state math, memory selection)
  happens engine-side at zero token cost.
- **P2 — Push facts, never carry transcripts.** The engine assembles what the model needs to know
  *this turn* from a database; prose history is not the memory medium.
- **P3 — Every static byte is cacheable.** Prompts are layered stable→volatile so provider prompt
  caching covers ≥ 80% of input tokens.
- **P4 — Spend where the drama is.** Model tier is routed per turn by engine-known signals;
  routine beats run cheap, set pieces run frontier.
- **P5 — Budgets are enforced, not hoped for.** Hard per-turn token caps, per-campaign dollar
  meter, and a degradation ladder instead of overruns.
- **P6 — Trust the engine, audit the model.** The model narrates and proposes; the engine
  validates, applies, and records. Quality control is asynchronous sampling, not per-turn
  supervisor calls.

## 3. Architecture

### 3.1 Single-call turn loop

One structured-output call per committed turn. Input: cached static prefix + projected scene
context + the player input. Output envelope:

```
{ intent:        "action" | "clarification" | "table_talk",
  checks:        [ { what, ability, dc_class, die_index } ],   // declared, not resolved
  narration:     "...",
  ops:           [ ... ],            // closed-vocabulary state deltas
  npc_updates:   [ ... ],            // dispositions, knowledge marks
  scene_summary: "≤40 tokens" }      // rolling summary contribution
```

The Council's interaction-classification, referee, and narration stages collapse into this one
call. The clarification path (the improvement plan's Phase 0 complaint) becomes *cheaper* than
actions: `intent: "clarification"` turns emit no checks and no ops, and the engine commits
nothing.

**Validators replace supervisor agents.** The engine rejects malformed envelopes, illegal ops,
arithmetic errors, and unknown references deterministically (fail-closed, one re-prompt with the
rejection reason, then a safe fallback narration). What the Council bought with four oversight
calls per turn, the greenfield engine buys with code.

### 3.2 Dice: pre-rolled, committed, positionally bound

The check loop ("model declares → engine rolls → model narrates outcome") is the classic reason
for a second call. Instead: each turn's context includes a **dice column** — a short list of
pre-rolled d20s (and system dice) generated from a seeded RNG whose seed-commitment hash is
recorded in the turn record before the call. The model consumes dice positionally: check #1 binds
to die #1, in declaration order. The engine recomputes every outcome (die + modifier vs DC)
deterministically and rejects envelopes whose cited arithmetic disagrees.

Residual risk: the model sees the dice before finalizing narration and could shade *which* action
it frames as a check. Bounded by positional binding, engine-recomputed outcomes, and stakes
limits on what any single check may do; the residue is equivalent to a human GM fudging behind
the screen. Tables that want provable neutrality get **strict mode**: the call pauses at the
check declaration, the engine rolls, and the model continues on the cached prefix (one extra
continuation at ~90% cache discount). Default: dice column; strict mode is per-campaign config.

### 3.3 Memory: fact store + deterministic projection

Replaces both the carried transcript and the importance-ranked memory summaries.

- **Write path.** Committing a turn writes typed **fact records** to the campaign SQLite store:
  `fact { subjects: [ids], text ≤25 tokens, kind: promise|revelation|relationship|world|event,
  provenance: turn id, visibility: [who knows] }`. Facts the model ledgered explicitly are free;
  an async small-model extractor pass (~500 in / 60 out) sweeps narration for unledgered facts.
- **Read path (hot, default).** Context assembly is a **join, not a search**: the engine knows
  the scene composition (location, present NPCs, items in play, active threads) and projects each
  entity's top-K facts (K small, recency+salience ranked) into the turn context, ~300–800 tokens
  total. Zero model involvement; the model cannot forget to look something up.
- **Read path (cold, rare).** One bounded `recall(query) → ≤200 tokens` tool for
  out-of-projection questions ("the innkeeper's daughter three towns back"), backed by the same
  store with an embedding column for the fuzzy path only. Expected on a few percent of turns.
- **Transcript window**: last 1–2 turns verbatim + a rolling ~100-token scene summary (the
  envelope's `scene_summary` contributions, engine-composed). Nothing else is carried.
- **Visibility scoping for free**: NPC fact sheets contain only what that NPC could know, so
  information hygiene is a projection property, not a prompt instruction.

Consequence: fresh input per turn is **flat for the life of the campaign**, and campaign memory
is permanent and queryable across sessions instead of decaying with the window.

### 3.4 Prompt layering and cache discipline

Prompt order per call: **[static campaign prefix — byte-identical all campaign]** (engine rules
digest, op vocabulary, style/table contract, campaign outline, cast identity anchors) →
**[slow-moving block]** (act state, standing quest threads; changes at act boundaries) →
**[turn block]** (scene projection, dice column, last turns, player input). Provider prompt
caching then covers the prefix and usually the slow block. Measured target: ≥ 80% of input
tokens billed at cached rates. Cache-buster edits (e.g. mid-campaign cast additions) append to
the slow block rather than mutating the prefix.

### 3.5 Tier routing

Engine-side router — zero model cost — picks the tier per turn from engine-known signals:
declared stakes level, thread criticality, novelty (new entities present), owner set-piece flags,
and act position.

| Tier | Share (planning) | Class | Per-turn cost (est.) |
|---|---|---|---|
| routine | ~80% | small (Haiku-class, or local/open-weights) | ~$0.004 (→ ~$0 local) |
| contested | ~18% | mid (Sonnet-class) | ~$0.012 |
| set piece | ~2% | frontier (Opus-class) | ~$0.06 |

Misroutes degrade gracefully: validators hold every tier to the same envelope contract, and a
routine-tier rejection retries one tier up. The adapter layer is provider-agnostic (per-tier
model + key config), so the routine tier can later point at a local model for near-zero marginal
cost without touching the engine.

### 3.6 Off-path work is async and batched

Fact extraction, memory compaction, NPC portrait/establishing-shot generation, and quality
audits never block a turn. Anything latency-insensitive uses provider batch pricing (~50%
discount). Quality control is a sampled async audit: ~5% of committed turns get a small-model
rubric check (continuity, tone, rule fidelity); regressions surface in telemetry instead of
being prevented by per-turn supervisor calls at 6× cost.

### 3.7 Budget governor and telemetry

- Per-call caps: fresh input ≤ ~1.5k tokens hot path; output ≤ ~600; projection auto-tightens
  (smaller K, terser fact rendering) rather than exceeding caps.
- Per-campaign dollar meter, recorded per turn in the campaign DB (tokens in/out/cached, tier,
  price) — the owner can see cost-to-date in the UI.
- Degradation ladder on budget pressure: shift routing mix down → tighten projection → shorten
  narration target. Overrun is impossible by construction, not by luck.

## 4. Cost model

Per-turn hot path (planning figures, current public per-Mtok prices; small $1/$5 cached-in
~$0.10, mid $3/$15/$0.30, frontier $15/$75/$1.50; ~6k cached + ~1.5k fresh in, ~400 out):

| Component | Cost/turn |
|---|---|
| Hot call, blended 80/18/2 routing | ~$0.0066 |
| Async extractor (batched, small) | ~$0.0007 |
| Recall tool + strict-mode continuations (~5% of turns) | ~$0.0004 |
| Sampled audit (5% × small) | ~$0.0003 |
| **Blended total** | **~$0.008** |

**2,000-turn campaign: ~$16 expected → within the $25 hard ceiling; ~$9–10 at the 1,200-turn
band; ~$3–5 with a local routine tier.** Versus the baseline Council at $160–400: a **20–40×
reduction**, and single-digit dollars for most campaigns. One-time campaign setup (outline,
portraits, theme) adds cents, dominated by image generation, and is amortized noise at campaign
scale. Latency drops from six sequential round-trips to one call — the cost fix and the
"feels like a real GM, not a loading bar" fix are the same fix.

## 5. What is deliberately dropped, and what carries over

**Dropped** (not binding per owner directive, and each violates a principle): the six-agent
Council (P1); per-turn rebuilt system instructions (P3); carried prose history and
importance-scored memory summaries injected every turn (P2); per-turn supervisor oversight (P6).

**Carried over on merit** (they serve the cost mandate, not because prior rules bind): the
closed op vocabulary with engine-issued typed IDs (makes validation deterministic and keeps the
envelope terse); engine-side arithmetic; durable item/NPC records (state off-context is state
that costs nothing); stakes-style caps on single-turn consequence (bounds both drama and the
dice-column exploit). Where Chapter 1/2 text conflicts with this plan, this plan wins for the
greenfield runtime; the chapters remain the mechanics reference for what ops *mean*.

## 6. Acceptance criteria (measurable, engine-enforced)

1. **Single-call hot path**: ≥ 90% of committed turns complete in exactly one model call
   (excluding strict-mode continuations and the ≤ 1 permitted validation re-prompt).
2. **Flat context**: mean fresh-input tokens per turn over turns 190–210 within 10% of turns
   10–30 in a 200-turn scripted soak.
3. **Cache discipline**: ≥ 80% of hot-path input tokens billed at cached rates after turn 3 of a
   session.
4. **Memory correctness**: a fact suite (promises, revelations, visibility-scoped secrets)
   written at turn N is retrievable and correctly scoped at turn N+500 with zero added carried
   tokens; NPC-secret leakage cases fail closed.
5. **Budget**: the 2,000-turn soak's metered projection ≤ $25 hard ceiling; telemetry visible
   per turn; degradation ladder demonstrably engages under a forced low budget.
6. **Fairness**: seed-commitment recorded pre-call for every dice column; engine recomputation
   rejects arithmetic drift; strict mode passes the same suite with engine-held rolls.
7. **Feel regression gate**: owner playtest — clarification exchanges advance no state, and
   routine-tier narration is acceptable at the table (the router mix is tunable if not).

## 7. Migration posture

Greenfield module beside the existing runtime (`runtime/` new code; Council untouched). Campaign
DB schema gains fact/telemetry tables (additive). Cutover is per-campaign opt-in: new campaigns
on the new runtime first; the Council remains until the owner playtest passes, then is retired.
No UI rewrite — the turn API contract (narrative, rollResults, journal) is preserved by an
adapter so `public/app.js` changes stay minimal.

## 8. Open questions for the owner

1. Dice default: dice column (cheapest, GM-fudge-equivalent trust) vs strict mode (provably
   neutral, slightly costlier) as the campaign default?
2. Is a local/open-weights routine tier acceptable for table feel, or cloud-small only?
3. Latency vs polish: should set-piece turns be allowed a second call (pre-planning beat) at
   ~2× that tier's cost for ~2% of turns?
