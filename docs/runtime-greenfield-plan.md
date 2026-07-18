# Runtime Greenfield Plan — cost-first engine architecture

**Mandate** (owner, 2026-07-18): greenfield-plan a better, cheaper engine for the models to use.
Prior decisions and rules are **not binding** on this plan. The hard constraint is economic: a
campaign must not cost $50 — that money buys a AAA title delivering 50–100 hours. Facts the model
needs must be immediately available without being a carried token burden.

**Planning numbers.** A campaign is 50–100 hours of play. Observed solo pacing is 2–3 minutes per
committed turn, so the committed-turn envelope is **1,200–3,000 turns**; the **upper planning
case is 3,000 committed turns** (100 h at 2 min). Billing is metered per **interaction attempt**
— any model-visible request (action, clarification, table talk, validation retry, continuation,
recall follow-up) — not per committed turn; the attempt budget is 1.2× committed → **3,600
attempts upper**. Budget bars: **owner mandate: under $50, hard**; engine ceiling **$45**
(reservation-enforced, §3.7); **~$22 expected** at the median campaign shape (§4).

---

## 1. Baseline: why the current engine is expensive

The shipped runtime (`rpg-engine.js`, `runMultiAgentTurn`) is a **Council** of sequential model
calls per committed turn. Branch-specific call counts (from code, to be confirmed by traces —
§6.8): a normal committed action makes **5 calls** (interaction proposal, grounding verifier,
continuity review, referee, final narration); **first entry to an unknown location adds a 6th**
(layout); **table talk makes 2**. Each call re-carries a per-turn rebuilt system instruction
(`getGMSystemInstruction(...)`) plus a history block of importance-ranked memory summaries
(count-bounded at eight, but NPC notes grow) and recent turns (six, truncated at 500 chars).
Costs compound four ways:

1. **Call multiplication** — five-plus calls each re-pay the full context.
2. **Cache hostility** — the system instruction is rebuilt with volatile state interleaved, so
   provider prompt caching rarely applies past turn one.
3. **Carried transcript** — history rides in every call.
4. **Sequential latency** — five-plus round-trips per turn is also the "video-gamey
   sluggishness" the improvement plan complains about; cost and feel degrade together.

Estimated baseline (hypothetical token arithmetic, priced at snapshot v1, §4): ~25–40k in,
2–4k out per committed turn. At mixed mid/frontier pricing that is **$0.08–0.20 per turn →
$160–400 per 2,000-turn campaign**; even forced all-small it is **$70–120 per 2,000 turns**
(25–40k × $1/M + 2–4k × $5/M, ×2,000). These are estimates, not measurements; §6.8 requires
captured traces before the comparison is cited as measured. The architecture, not the model
choice, is the cost problem.

## 2. Design principles

- **P1 — One model call on the hot path.** A committed turn costs one structured call in the
  common case. Everything deterministic (dice arithmetic, legality, state math, memory selection)
  happens engine-side at zero token cost.
- **P2 — Push facts, never carry transcripts.** The engine assembles what the model needs *this
  turn* from a database; prose history is not the memory medium.
- **P3 — Every static byte is cacheable.** Prompts are layered stable→volatile; cache behavior
  is modeled per tier, including writes and cold starts (§3.4, §4).
- **P4 — Spend where the drama is.** Model tier is routed per turn by strictly pre-call
  engine-known signals (§3.5).
- **P5 — Budgets are enforced, not hoped for.** Every billable request passes a reservation
  gate; spend cannot exceed the ceiling by construction (§3.7).
- **P6 — Trust the engine, audit the model.** The model narrates and proposes; the engine
  validates, applies, and records. Quality control is asynchronous sampling.

## 3. Architecture

### 3.1 Single-call turn loop

One structured-output call per committed turn. Input: cached static prefix + projected scene
context + the player input. Output envelope:

```
{ intent:        "action" | "clarification" | "table_talk",
  checks:        [ { what, ability, dc_class } ],   // declared, not resolved; binding §3.2
  narration:     [ { text, refs: [check_id|result_id|fact_id] } ],  // segmented, referenced
  ops:           [ ... ],            // closed-vocabulary state deltas (contract below)
  fact_ops:      [ ... ],            // explicit ledger writes, committed with the turn (§3.3)
  npc_updates:   [ ... ],            // dispositions, knowledge marks (visibility rules §3.3)
  scene_summary: "≤40 tokens" }
```

**The attempt ledger.** Every model-visible request — committed or not — appends a row to a
per-campaign `attempt` ledger *before dispatch*: attempt id, turn id (nullable for
non-committing exchanges), kind (action / clarification / table_talk / validation_retry /
strict_continuation / recall_continuation / extractor / audit / image / setup), tier, reserved
cost, actual usage, cache stats. Clarifications commit no state but **are billed, capped, and
soaked like everything else** (§4, §6.5). Client-visible turn numbering derives from the
attempt ledger so non-committing exchanges still get durable IDs (§7).

**Ops contract.** The envelope's `ops` use a closed vocabulary specified normatively in an
appendix the engine and validators share (`docs/rules/` chapters remain the semantic source for
what ops *mean*). For each op the spec fixes: fields and types; **ID provenance** (all entity
IDs are engine-issued; models may only reference existing IDs or request creation via a
dedicated op that returns an engine-issued ID); allowed source states (preconditions);
consequence caps by stakes class; conflict resolution (ops within an envelope apply in order,
first conflict rejects the envelope); and transaction semantics (all ops + fact_ops + dice
consumption commit atomically with the turn or not at all). State the engine can derive
(totals, positions, clocks) is derived, never model-asserted. An op granting an item,
completing a quest, or moving location must cite the enabling check result or standing
entitlement; validators reject uncited grants ("unearned change" test, §6.4).

**Check/outcome binding.** The engine — not the model — produces the canonical
`roll_result { check_id, die, modifier, dc, outcome }` records. Narration is **segmented**, and
any segment asserting an outcome must reference the `result_id` it narrates; validators reject
envelopes whose referenced outcome class (success/failure/partial) contradicts the engine's
computed result. Unreferenced outcome-bearing prose fails validation (one re-prompt, then the
fallback path). Contradiction cases are a fixture suite (§6.4).

**Failure state machine.** Explicit, per attempt:
`dispatch → validate → [reject: one re-prompt, same tier] → validate → [reject: one escalated
retry, +1 tier] → validate → [reject: terminal fallback]`. Maximum three model calls per
attempt, all metered. Terminal fallback is **deterministic engine prose** (template: action
acknowledged, no state change, dice **not consumed**, no ops applied); the attempt is recorded
`failed_closed`, the player's action is restorable verbatim, the client receives a structured
error, and telemetry increments a fail-closed counter (§6.1 counts every one of these calls).

### 3.2 Dice: pre-rolled, committed, implicitly bound

Each turn's context includes a **dice column** — pre-rolled d20s (and system dice) from a seeded
RNG. **Commitment/reveal**: the seed is
`HMAC(campaign_secret, campaign_id || turn_id || canonical_player_input || rng_algo_version)`;
the hash of (seed, algorithm id, column) is written to the turn record *before* dispatch, and
the seed is revealed in the turn record after commit, so any client can re-derive the column
and audit neutrality post hoc. Binding is **implicit and validator-enforced**: check #N binds to
die #N in declaration order — the schema exposes no index field, so the model cannot select
dice. Declaring more checks than the column holds fails validation (column length is the
engine-set maximum, default 4); unconsumed dice are discarded with the turn, never carried.
The engine recomputes every outcome (die + modifier vs DC) deterministically; §3.1's binding
rules reject narration that disagrees.

Residual risk: the model sees dice values while controlling check *existence* — it could omit a
check a bad die would fail, or frame a favorable one. Bounded by: consequence caps (no
uncited-check high-impact ops, §3.1), stakes limits per single check, and the audit sampler
flagging check-avoidance patterns. That residue is equivalent to a human GM fudging behind the
screen. Tables wanting provable neutrality use **strict mode** (per-campaign config): the call
pauses at check declaration, the engine rolls, the model continues on the cached prefix — one
extra continuation per checked turn, metered as its own attempt kind and priced in §4's
adverse scenario. Where neutrality is *required* (owner-flagged competitive tables), strict
mode is forced by config, not left to the model.

### 3.3 Memory: fact store + deterministic projection

Replaces the carried transcript and importance-ranked summaries.

- **Write path.** Explicit `fact_ops` ride the turn envelope and **commit atomically with the
  turn** (schema-validated like all ops):
  `fact { subjects: [ids], text ≤25 tokens, kind: promise|revelation|relationship|world|event,
  provenance: turn id + narration segment ref, visibility: ACL (below), lifecycle: {salience,
  pinned?, supersedes?} }`. The **async extractor** is a safety net, not the primary path: a
  durable idempotent queue (per committed turn: enqueue at commit, small-model sweep ~500 in /
  60 out, dedupe by content hash against ledgered facts, evidence span required, retry ×3 then
  dead-letter with telemetry alarm). **Freshness rule**: a turn may not leave the 2-turn
  transcript window until its extraction job is complete or dead-lettered; the window extends
  (bounded +2) rather than dropping unswept narration.
- **Read path (hot, default).** Context assembly is a **join, not a search**: the engine knows
  scene composition and projects each entity's facts into the turn context, ~300–800 tokens.
  Projection is **class-aware**, not purely top-K: `pinned` facts (invariants, open obligations,
  safety-critical, current-state) **always project** regardless of budget pressure; only the
  unpinned remainder competes on recency+salience for the top-K slots. Supersession: a fact op
  can supersede a prior fact (tombstone; superseded facts never project). Retrieval keys on
  scene join **and on the player input** (cheap lexical match against fact subjects/text), so
  input-relevant off-scene facts still surface. §6.4 tests *automatic use* (model behavior),
  not mere retrievability.
- **Read path (cold, rare).** One bounded `recall(query) → ≤200 tokens` tool, embedding-backed,
  metered as `recall_continuation`. Planning rate 3% of committed turns (§4).
- **Transcript window**: last 1–2 turns verbatim + rolling ~100-token engine-composed scene
  summary. Nothing else is carried.
- **Visibility.** Every fact carries an engine-derived **witness ACL** (who was present /
  was told / could infer — engine-computed from scene records at write time; model-authored
  visibility claims are validated against it and clamped, never widened). Projections are
  **audience-specific**: the narration call receives the player-audience projection plus only
  the *behavioral surface* of NPC secrets (disposition, goals-as-pressure) — not raw secret
  text — unless the secret's ACL includes the player. Leak testing includes **paraphrase
  probes**, not just exact-marker matches (§6.4).

Consequence: fresh input per turn is flat for the life of the campaign, and campaign memory is
permanent and queryable across sessions.

### 3.4 Prompt layering and cache discipline

Prompt order per call: **[static campaign prefix — byte-identical all campaign]** → **[slow
block]** (act state, standing threads; changes at act boundaries; cache-buster edits append
here, never mutate the prefix) → **[turn block]** (scene projection, dice column, last turns,
player input).

Cache economics are **modeled per tier, including writes and cold starts** (§4): caches are
provider- and model-scoped, so each tier warms independently; a session restart or provider
cache expiry makes the next call on that tier a **cold call billed at cache-write rates**
(snapshot v1 prices writes at 1.25× input). Routine-tier calls are dense (cache stays warm);
mid and frontier calls are sparse and are *planned* at materially lower warm rates rather than
assumed hot. Measured targets are **per tier** (§6.3), not one aggregate: routine ≥ 90%, mid ≥
60%, frontier ≥ 40% of prefix tokens billed at cached rates, with the cost model's adverse
scenario surviving all-cold mid/frontier (§4).

### 3.5 Tier routing

Engine-side router — zero model cost — using **strictly pre-call features**, each with a
declared provenance: stakes class of the *previous* committed state (engine record), thread
criticality flags (engine records), novelty = presence of entities with no prior scene join
(engine record), owner set-piece flags (config), act position (engine record), and a cheap
lexical hazard screen over the raw player input (pattern classes: violence-against-named-NPC,
irreversible-destruction, faction-scale action). **The current input's semantic stakes are
unknowable pre-call**, so routing is conservative: hazard-screen hits, novel-entity scenes, and
ambiguous inputs route **up**, never down. The routine tier additionally has a **consequence
cap**: envelopes proposing ops above its stakes class (regardless of routing) trigger one
escalated re-dispatch at the higher tier (metered, §3.1 state machine) — a misroute costs one
extra call, it cannot commit oversized effects from a small model. Router quality is validated
against a labeled corpus with a confusion matrix and quality-differential samples (§6.7).

| Tier | Share (planning) | Class | Warm/cold per-call (snapshot v1, §4) |
|---|---|---|---|
| routine | ~80% | small (Haiku-class, or local/open-weights) | $0.0041 / $0.0110 (→ ~$0 local) |
| contested | ~18% | mid (Sonnet-class) | $0.0123 / $0.0330 |
| set piece | ~2% | frontier (Opus-class) | $0.0615 / $0.1650 |

The adapter layer is provider-agnostic (per-tier model + key config), so the routine tier can
later point at a local model for near-zero marginal cost.

### 3.6 Off-path work is async, batched, and individually priced

Every charged path has its **own planning frequency, token budget, retry cap, and price line**
in §4 — there is no aggregate "misc percent". Fact extraction (per committed turn, §3.3 queue),
sampled audit (5% of committed turns, small rubric check), recall continuations (3%), validation
retries (2% expected / 5% adverse), strict-mode continuations (0% default; adverse scenario
prices 40% of turns checked), images (portraits + establishing shots: counted per campaign,
priced per image, **model fees in the campaign total**, not amortized away), one-time setup
calls. Batch pricing (~50%) applies only where the provider offers it; the adverse scenario
prices extraction **unbatched**.

### 3.7 Budget governor and telemetry

- **Versioned pricing.** A `pricing` table (provider, model, in/out/cache-read/cache-write rates,
  effective date, snapshot id) is the sole authority; every cost figure cites a snapshot id.
  Custom providers without declared prices cannot be admitted to paid tiers.
- **Reserve → admit → debit.** Before *every* billable call (sync or async) the governor
  reserves that call's **worst case** (max input at cold rates + output cap) against the
  remaining ceiling. Insufficient headroom → the call is **not dispatched**; the engine degrades
  in order: routing mix down → projection tightening (smaller K; pinned classes still project) →
  shorter output targets → **routine tier to local model if configured** → deterministic
  no-model fallback (engine prose, no state commit; same terminal path as §3.1). After the
  response, actual usage (provider-reported, including cache hit fields) is debited atomically
  and the reservation released. Spend > ceiling is unreachable by construction because nothing
  dispatches without a covering reservation.
- Per-call caps: fresh input ≤ ~1.5k tokens hot path; output ≤ 600 hard.
- Telemetry: per-attempt tokens in/out/cached, tier, price, snapshot id, in the campaign DB;
  owner-visible cost-to-date in the UI.

## 4. Cost model

**Pricing snapshot v1** (2026-07, per Mtok; the single source for every figure in this
document): small $1 in / $5 out / $0.10 cache-read / $1.25 cache-write; mid $3 / $15 / $0.30 /
$3.75; frontier $15 / $75 / $1.50 / $18.75. Call shape: cacheable prefix+slow block ~6,000
tokens; fresh ~1,500; output ~400 typical (600 cap).

Per-call: warm = cache-read 6k + fresh + out; cold = cache-write 6k + fresh + out.

| Tier | Warm | Cold | Warm @600 out |
|---|---|---|---|
| small | $0.0041 | $0.0110 | $0.0051 |
| mid | $0.0123 | $0.0330 | $0.0153 |
| frontier | $0.0615 | $0.1650 | $0.0765 |

**Scenario E — expected (median campaign).** 1,800 committed turns (75 h @ 2.5 min), +20%
non-committing attempts (360, small tier); mix 80/18/2; warm rates 90/75/70 (set pieces cluster
into consecutive-turn scenes, so frontier re-warms); validation retries 2%; extraction batched;
32 images @ $0.04.

| Line | Calls × avg | Total |
|---|---|---|
| small hot (0.9 warm) | 1,800 × $0.00479 | $8.62 |
| mid hot (0.75 warm) | 324 × $0.01748 | $5.66 |
| frontier hot (0.7 warm) | 36 × $0.09255 | $3.33 |
| validation retries | 43 × ~$0.033 | $1.42 |
| extractor (batched) | 1,800 × $0.0004 | $0.72 |
| audit 5% | 90 × $0.004 | $0.36 |
| recall 3% | 54 × $0.005 | $0.27 |
| images | 32 × $0.04 | $1.28 |
| setup | — | $0.50 |
| **Total** | | **≈ $22.2** |

**Scenario A — adverse (unmanaged, shown to size the governor).** 3,000 committed, 3,600
attempts; mix 75/22/3; warm 75/50/30; retries 5%; extraction unbatched; strict mode on, 40% of
turns checked; 40 images: small $16.60 + mid $14.95 + frontier $12.06 + retries $5.94 +
extractor $2.40 + audit $0.60 + recall $0.75 + strict $2.40 + images $1.60 + setup $0.50 ≈
**$57.8 — over the owner bar**. This is the point: pacing, cache luck, and optional modes can
push an unmanaged campaign past $50, so the governor is **load-bearing**. Governed, the same
campaign hits the **$45 ceiling and degrades** (mix down, projection tightening, strict-mode
suspension with owner notice) instead of overrunning.

**Scenario W — worst case.** Reservation-based admission (§3.7) makes total spend ≤ $45 a
construction property, not a forecast: the ledger + reservation gate is itself under test
(§6.5), including forced cold caches, forced retries, and a 3,000-turn soak.

Versus the baseline Council at $160–400 per 2,000 turns: scenario E (~$22 for a *longer*
campaign) is roughly a **10–25× reduction** (and ~3–5× versus an all-small Council at $70–120).
Single-digit dollars is achievable with a local routine tier, not the default claim. Latency
drops from five-plus sequential round-trips to one call — the cost fix and the "feels like a
real GM, not a loading bar" fix are the same fix.

## 5. What is deliberately dropped, and what carries over

**Dropped** (not binding per owner directive, and each violates a principle): the sequential
Council (P1); per-turn rebuilt system instructions (P3); carried prose history and
importance-scored memory summaries injected every turn (P2); per-turn supervisor oversight (P6).

**Carried over on merit**: the closed op vocabulary with engine-issued typed IDs; engine-side
arithmetic; durable item/NPC records; stakes-style caps on single-turn consequence. Where
Chapter 1/2 text conflicts with this plan, this plan wins for the greenfield runtime; the
chapters remain the mechanics reference for what ops *mean*.

## 6. Acceptance criteria (measurable, engine-enforced)

1. **Call accounting**: every synchronous provider request is counted. Reported separately:
   initial-envelope success rate (target ≥ 90%), validation-retry rate (≤ 5%), escalated-retry
   rate (≤ 2%), strict-continuation rate (config-dependent), recall rate (≤ 5%), terminal
   fail-closed rate (≤ 0.5%), and **total model calls per player interaction** (target mean ≤
   1.2 excluding strict mode; every threshold independent, no exclusions from the count).
2. **Flat context**: a 220-turn scripted soak; mean, p95, and max fresh-input tokens over turns
   190–210 within 10% / 15% / 25% of turns 10–30 respectively, including an adversarial
   high-entity scene block.
3. **Cache discipline**: per-tier measured hit rates (routine ≥ 90%, mid ≥ 60%, frontier ≥ 40%)
   from provider-reported usage fields, after turn 3 of a session, including a session-restart
   case.
4. **Memory & integrity suite**: facts written at turn N are correctly scoped and **actually
   used** (model-behavior probes, not just retrieval) at turn N+500; NPC-secret leakage fails
   closed under paraphrase probes; the unearned-change suite (ops without enabling results) and
   the narration/result contradiction suite reject 100% of fixtures.
5. **Budget**: the 3,000-turn adversarial soak (cold-cache injections, forced retries, strict
   mode on, output-cap pressure) never exceeds the $45 ceiling; reservation denials degrade per
   §3.7; per-attempt telemetry reconciles against provider-reported usage (and invoices where
   available) within 5%.
6. **Fairness**: commitment hash recorded pre-call for every dice column; post-commit reveal
   re-derives identically; engine recomputation rejects arithmetic drift; strict mode passes
   the same suite with engine-held rolls.
7. **Feel regression gate**: **blinded** owner playtest — ≥ 30 routine-tier and ≥ 10
   contested/set-piece turns rated against a fixed rubric (continuity, agency, tone, pacing)
   without tier labels, pass = no dimension worse than the Council reference sample at p <
   pre-registered threshold. **Any change to models or routing mix reruns §6.1–6.7.**
8. **Baseline honesty**: Council per-branch call counts and token/usage traces captured from
   the live code before the comparison in §1 is cited outside this document.

## 7. Migration posture

Greenfield module beside the existing runtime (`runtime/` new code; Council untouched).

**Turn API contract (full).** The current response is not just (narrative, rollResults,
journal): `public/app.js` consumes campaign state (party & turn order, character/NPC/quest/rules
state, sceneGrounding, choices, SVG/heroic/location art, voice lines, numbered turns), and
clarifications are today persisted and shared to other seats via journal/poll backfill. The
adapter therefore: documents the complete request/response/persistence/seat-scoping/polling/
audio/error contract as a fixture suite *before* cutover; maps every envelope field or
deterministic derivative onto it; and assigns **durable attempt-ledger IDs** to non-committing
exchanges so multiplayer clarification visibility and turn numbering are preserved (no
duplicate numbering, no invisible exchanges).

**Schema & migration matrix** (all additive): fact/attempt/telemetry/pricing tables; a
per-campaign `runtime` discriminator + **config snapshot** (tier models, strict-mode choice,
budget policy, rng_algo_version); dice commitment records; durable async job tables (extractor
queue, dead-letter). Legacy rows default to `runtime='council'`; fork/export/import copy the
config snapshot, commitment records, and open job state; seat-scoping rules are part of the
adapter fixture suite. Cutover is per-campaign opt-in: new campaigns first; the Council remains
until the §6.7 gate passes, then is retired.

## 8. Open questions for the owner

1. Dice default: dice column (cheapest, GM-fudge-equivalent trust) vs strict mode (provably
   neutral, costlier — priced in §4 adverse) as the campaign default?
2. Is a local/open-weights routine tier acceptable for table feel, or cloud-small only?
3. Latency vs polish: should set-piece turns be allowed a second call (pre-planning beat) at
   ~2× that tier's cost for ~2% of turns?
