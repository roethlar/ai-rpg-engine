# Runtime Greenfield Plan — cost-first engine architecture

**Mandate** (owner, 2026-07-18): greenfield-plan a better, cheaper engine for the models to use.
Prior decisions and rules are **not binding** on this plan. The hard constraint is economic: a
campaign must not cost $50 — that money buys a AAA title delivering 50–100 hours. Facts the model
needs must be immediately available without being a carried token burden.

**Planning numbers.** A campaign is 50–100 hours of play. Observed solo pacing is 2–3 minutes per
committed turn, so the committed-turn envelope is **1,200–3,000 turns**; the **upper planning
case is 3,000 committed turns** (100 h at 2 min). Budget bars: **owner mandate: under $50,
hard**; engine ceiling **$45** (reservation-enforced, §3.7); **~$22 expected** at the median
campaign shape (§4).

**Accounting units** (three levels, each with its own ID, cap, and denominator):

- **Exchange** — one player-visible request/response cycle (action, clarification, table talk).
  Upper envelope **3,600 per campaign** (1.2× committed turns). Public turn numbering derives
  **only** from exchanges, so async work and retries never create visible gaps.
- **Generation** — one logical model task. A synchronous exchange contains 1–3 generations
  (initial + ≤1 re-prompt + ≤1 escalated retry, §3.1 state machine); async kinds (extractor,
  audit, recall, strict continuation, image, tts, setup) are generations with their own
  per-kind envelopes (§4 path matrix).
- **Dispatch** — one physical provider request. One generation issues one dispatch (SDK
  auto-retries disabled, §3.7); every dispatch is individually reserved before it leaves the
  engine and settled after (§3.7).

---

## 1. Baseline: why the current engine is expensive

The shipped runtime (`rpg-engine.js`, `runMultiAgentTurn`) is a **Council** of sequential model
calls per committed turn. Branch map from the live call sites: a normal committed action makes
**5 calls** — interaction proposal, continuity review, referee, final continuity, narration —
and **table talk makes 2** (interaction proposal, then the grounding/table-talk verifier).
Only the narration call carries `getGMSystemInstruction(...)` plus the turn-prompt history
block; the other calls carry bespoke system prompts plus a compacted `contextJson` **that
embeds the accumulating proposal/review/referee JSON chain**, so context re-payment grows
through the turn even where the system prompts differ. Costs compound four ways:

1. **Call multiplication** — five calls, each re-paying scene context and the growing
   intra-turn JSON chain.
2. **Cache hostility** — prompts interleave volatile state, so provider caching rarely applies
   past turn one.
3. **Carried transcript** — memory summaries and recent-turn history ride in every turn.
4. **Sequential latency** — five round-trips per turn is the "video-gamey sluggishness" the
   improvement plan complains about; cost and feel degrade together.

Estimated baseline (hypothetical token arithmetic, priced at snapshot v1, §4; **unmeasured
until §6.8's traces exist**): ~25–40k in, 2–4k out per committed turn → **$0.08–0.20 per turn,
$160–400 per 2,000-turn campaign** at mixed mid/frontier pricing; forced all-small **$70–120
per 2,000 turns** (25–40k × $1/M + 2–4k × $5/M, ×2,000). The architecture, not the model
choice, is the cost problem.

## 2. Design principles

- **P1 — One model call on the hot path.** A committed turn costs one structured call in the
  common case; deterministic work (dice arithmetic, legality, state math, memory selection) is
  engine-side at zero token cost.
- **P2 — Push facts, never carry transcripts.**
- **P3 — Every static byte is cacheable**; cache behavior is modeled per tier including writes
  and cold starts (§3.4, §4).
- **P4 — Spend where the drama is** (strictly pre-call routing, §3.5).
- **P5 — Budgets are enforced, not hoped for** (per-dispatch reservation, §3.7).
- **P6 — Trust the engine, audit the model.**

## 3. Architecture

### 3.1 Single-call turn loop

One structured-output call per committed turn. Output envelope:

```
{ intent:        "action" | "clarification" | "table_talk",
  checks:        [ { what, ability, dc_class } ],      // local handles c1..cN by order
  narration:     [ { kind: "color"|"outcome"|"transition",
                     text,
                     outcome?: { check: "cN", claim: "success"|"failure"|"partial" },
                     refs: [local handle | fact id] } ],
  ops:           [ ... ],       // closed vocabulary; creation ops declare local_id n1..nN
  fact_ops:      [ ... ],       // ledger writes, committed atomically with the turn (§3.3)
  npc_updates:   [ ... ],
  scene_summary: "≤40 tokens" }
```

**Envelope-local handles (causality).** Checks are implicitly handled `c1..cN` in declaration
order; creation ops declare `local_id` (`n1..nN`) which later ops/fact_ops in the same envelope
may reference. The validator resolves every local reference — checks to engine-computed
`roll_result` records (engine-issued ids `r<turn>.<n>`), `local_id`s to freshly engine-issued
entity IDs — **before** atomic commit; any unresolvable or forward-inconsistent reference
rejects the envelope. Same-envelope reference fixtures are part of the op-contract test suite
(gate **G1** below).

**Structural outcome semantics.** Only `outcome` segments may assert mechanical results, and
each must carry a structured `{check, claim}`; the validator compares `claim` against the
engine-recomputed result and rejects contradictions deterministically — no prose
interpretation. The authoritative mechanical record shown to players (roll banner: die,
modifier, DC, outcome) is rendered by the engine from `roll_result` records, so ground truth
never depends on prose. Residual risk — a model smuggling outcome claims into `color` text — is
not deterministically detectable; it is bounded by the engine-rendered banners (players see the
real result regardless) and covered by the 5% audit sampler with a labeled prose-evasion
fixture set (§6.4). This is an honest limitation, not a validator claim.

**The attempt ledger.** Every generation appends a ledger row *before dispatch*: generation id,
exchange id (nullable for async kinds), kind (action / clarification / table_talk /
validation_retry / escalated_retry / strict_continuation / recall_continuation / extractor /
audit / image / tts / setup), tier, reserved cost, actual usage, cache stats, dispatch state
(§3.7). Clarifications commit no state but are billed, capped, and soaked like everything else.

**Ops contract.** `ops` use a closed vocabulary. Normative core (v0): op kinds are
`create_entity, move, transfer_item, apply_condition, clear_condition, adjust_clock,
complete_objective, reveal_fact, npc_disposition, spawn_thread, close_thread` — each with fixed
fields, **engine-issued ID provenance** (models reference existing IDs or `local_id` handles
only), preconditions (allowed source states), a consequence class checked against the turn's
stakes cap, a conflict key (two ops with the same key in one envelope reject), deterministic
in-order application, and a rejection code. Ops granting items, completing objectives, or
moving location must cite an enabling `roll_result` or standing entitlement; uncited grants
reject ("unearned change", §6.4). State the engine can derive is derived, never
model-asserted. **Gate G1**: the full op contract (`docs/rules/op-contract.md`, versioned:
exact schemas, precondition table, stakes-cap matrix, conflict keys, error taxonomy, executable
valid/invalid fixtures) must be pinned and its fixtures passing **before any runtime code
merges**; this plan's v0 list is the scope contract for that artifact.

**Failure state machine** (per exchange):
`dispatch → validate → [reject: one re-prompt, same tier] → validate → [reject: one escalated
retry, +1 tier] → validate → [reject: terminal fallback]`. Maximum three synchronous
generations per exchange, all metered. Terminal fallback is deterministic engine prose (action
acknowledged, no state change, dice not consumed, no ops); the exchange records
`failed_closed`, the player's input is restorable verbatim, the client receives a structured
error, telemetry increments (§6.1).

### 3.2 Dice: pre-rolled, committed, implicitly bound

Each turn's context includes a **dice column** of pre-rolled dice. **Commitment/reveal**,
fully specified: per-campaign root secret generated at campaign creation and **committed
(hash published in the campaign record) before the first turn**; per-turn seed =
`HMAC-SHA256(root_secret, "dice-v1" || LP(campaign_id) || LP(turn_id) ||
LP(canonical_player_input) || LP(rng_algo_version))` where `LP(x)` is UTF-8 with a 4-byte
length prefix (domain-separated, length-delimited — no concatenation ambiguity). The hash of
(seed, algorithm id, column) is written to the turn record before dispatch; the seed is
revealed after commit. Verification: revealed seeds validate against the pre-play root
commitment, so clients can re-derive columns without ever holding the root. Secret lifecycle:
stored server-side only; **fork/import derives a fresh root** (old commitments remain
read-only verifiable in the copied history; future rolls are not predictable from the
export); compromise = rotate root, re-commit, note in campaign log. Cross-language test
vectors ship with gate G1's fixture suite.

Binding is implicit and validator-enforced: check #N binds to die #N; the schema exposes no
index field. Declaring more checks than the column holds (engine max 4) fails validation;
unconsumed dice are discarded with the turn. The engine recomputes every outcome; §3.1 rejects
contradicting claims.

Residual risk (check *existence* shading) is bounded by consequence caps, stakes limits, and
audit sampling — equivalent to a human GM fudging behind the screen. **Strict mode**
(per-campaign config) pauses at check declaration, engine rolls, model continues on the cached
prefix (metered as `strict_continuation`). Config guarantees are classified: owner-forced
strict mode is **invariant** — the governor may never suspend it (it degrades elsewhere or
fails closed); player-opt-in strict mode is negotiable (suspends with notice under budget
pressure).

### 3.3 Memory: fact store + deterministic projection

- **Write path.** Explicit `fact_ops` commit atomically with the turn:
  `fact { subjects: [ids], text ≤25 tokens, kind: promise|revelation|relationship|world|event,
  provenance: turn id + segment ref, visibility: ACL, lifecycle: {salience, class, supersedes?} }`.
  The async extractor is a safety net: durable idempotent queue (enqueue at commit; small-model
  sweep ~500 in / 60 out; dedupe by content hash; evidence span required; retry ×3 then
  dead-letter + telemetry alarm). **Freshness rule with explicit backpressure**: a turn may not
  leave the 2-turn transcript window until its extraction settles; the window extends at most
  +2 turns. Beyond that bound (extractor outage, reservation denial): the next commit performs
  **forced synchronous extraction** (metered, reserved as part of that exchange); if that too
  is denied, the engine stops accepting committed actions (clarifications still work) rather
  than silently dropping memory — surfaced to the player as a budget/connectivity notice.
  Dead-letter = accepted fact loss, flagged in telemetry and prioritized for audit sampling.
  A sustained-outage test is part of §6.4.
- **Read path (hot).** Join, not search: the engine projects scene-joined entities' facts
  (~300–800 tokens). **Pin classes are engine-derived, never model-selected**: class follows
  from op kind (promise ops → `obligation`, state-changing ops → `current_state`, flagged
  invariants → `invariant`, safety list → `safety`). Each pinned class has **bounded
  cardinality with keyed slots** (e.g. one `current_state` slot per entity attribute; upsert
  is mandatory — a new fact in an occupied slot supersedes the old). Overflow: lowest-salience
  member is demoted to unpinned, never silently dropped. Unpinned facts compete on
  recency+salience for top-K. Supersession tombstones never project. Retrieval keys on scene
  join **and** player input (lexical match). Hard bound: projection never exceeds its token
  budget — the adversarial **pin-growth soak** (§6.4) proves flat context under a model that
  pins aggressively.
- **Read path (cold).** `recall(query) → ≤200 tokens`, embedding-backed, metered.
- **Transcript window**: last 1–2 turns + rolling ~100-token engine-composed scene summary.
- **Visibility.** Facts carry engine-derived **witness ACLs** (present / told / could-infer,
  computed from scene records at write time; model-authored visibility claims are clamped to
  the engine's ACL, never widened). Projections are audience-specific. **Output audience
  semantics** (multiplayer): shared narration is generated from the **intersection of all
  recipient seats' ACLs**; facts outside the intersection may drive NPC behavior only via
  behavioral surface (disposition, pressure), not restatement. The same ACL rule applies to
  journal rows, poll backfill, audio, and error payloads (seat scoping already exists in
  `server.js` — `scopeStateForSeat`, `scopeJournalForSeat` — and carries over). Leak testing
  includes **cross-seat paraphrase fixtures** (§6.4).

### 3.4 Prompt layering and cache discipline

Prompt order: **[static campaign prefix]** → **[slow block]** (act state; append-only
cache-buster edits) → **[turn block]**. Cache economics modeled per tier including writes and
cold starts (§4): caches are provider/model-scoped; session restart or expiry = cold call at
cache-write rates. Per-tier measured targets (§6.3): routine ≥ 90%, mid ≥ 60%, frontier ≥ 40%
of prefix tokens billed cached; the adverse scenario prices low warm rates rather than
assuming hot.

### 3.5 Tier routing

Engine-side router, **strictly pre-call features with declared provenance**: stakes class of
previous committed state (engine record); thread criticality flags (engine records); novelty =
entity with no prior scene join (engine record); owner set-piece flags (config); act position
(engine record); and a **deterministic hazard/ambiguity screen** over the raw input with
enumerated features and fixed thresholds — hazard lexicon classes
(violence-against-named-NPC, irreversible-destruction, faction-scale), reference to an entity
not in the current scene join, >1 imperative verb clause, input length > 60 tokens, or zero
lexical overlap between input and scene entities (out-of-context indicator). Any hit routes
**up**. The routine tier has a consequence cap: envelopes proposing ops above its stakes class
trigger one escalated re-dispatch (§3.1) — a misroute costs one extra call, never an oversized
commit from a small model. **Router validation** (§6.7): a labeled corpus (construction and
adjudication protocol documented with the corpus; two-rater labels, disagreements adjudicated
before freezing) with a published confusion matrix, minimum **recall ≥ 95% for
escalation-worthy inputs**, and a consequence-weighted false-negative ceiling.

| Tier | Share (planning) | Class | Warm/cold per-call (snapshot v1) |
|---|---|---|---|
| routine | ~80% | small (Haiku-class or local) | $0.0041 / $0.0110 (→ ~$0 local) |
| contested | ~18% | mid (Sonnet-class) | $0.0123 / $0.0330 |
| set piece | ~2% | frontier (Opus-class) | $0.0615 / $0.1650 |

### 3.6 Off-path work is async, batched, and individually priced

Every charged path appears in §4's **path matrix** with its own frequency, unit caps, retry
cap, batch eligibility, snapshot rate, and reservation basis. **Voice (TTS) is a charged
path**: the live product synthesizes narration audio per turn, so the greenfield contract
prices it. Default scenarios are **voice-off**; cloud TTS at snapshot rates adds ~$22 expected
(≈1.4M chars × $15/M) — nearly the whole ceiling — so voice defaults to local/system TTS or
requires explicit owner acceptance (§8 Q4). When enabled, TTS is reserved and metered per
dispatch like every other kind, with save-once replay (synthesize once per turn, serve from
storage).

### 3.7 Budget governor and telemetry

- **Versioned pricing.** `pricing` table (provider, model, in/out/cache-read/cache-write,
  media rates, effective date, snapshot id) is the sole authority; every figure cites a
  snapshot. Custom providers without declared prices cannot join paid tiers.
- **Reserve → dispatch → settle, durably.** Per **dispatch** state machine, persisted:
  `reserved → dispatched → settled | ambiguous`. Reservation = worst case (max input at cold
  rates + output cap, or media unit cap). Dispatch uses provider idempotency keys where
  supported; SDK auto-retries are disabled (a retry is a new reserved dispatch). Timeout or
  crash between dispatch and settle → `ambiguous`: the **full reservation is charged
  permanently** until invoice reconciliation proves otherwise; crash recovery scans
  `dispatched` rows at startup. Insufficient headroom → not dispatched; degradation order: mix
  down → projection tightening (pinned classes still project, §3.3) → shorter output → local
  routine tier if configured → deterministic no-model fallback. Invariant config (forced
  strict mode) is never suspended; the governor degrades elsewhere or fails closed (§3.2).
  Spend > ceiling is unreachable because nothing dispatches without a covering reservation and
  ambiguity resolves conservatively.
- Per-call caps: fresh input ≤ ~1.5k hot path; output ≤ 600 hard.
- Telemetry: per-generation tokens/cache/price/snapshot/dispatch-state; owner-visible
  cost-to-date.

## 4. Cost model

**Pricing snapshot v1** (2026-07, sole source): per Mtok — small $1 in / $5 out / $0.10
cache-read / $1.25 cache-write; mid $3 / $15 / $0.30 / $3.75; frontier $15 / $75 / $1.50 /
$18.75. Media: image generation $0.04/image; embeddings $0.02/M tokens; TTS $15/M characters.
Call shape: cacheable prefix ~6,000 tokens; fresh ~1,500; output ~400 typical (600 cap).
Continuations: cache-read 6k + ~200 fresh + 400 out.

| Per-call | small | mid | frontier |
|---|---|---|---|
| warm | $0.0041 | $0.0123 | $0.0615 |
| cold | $0.0110 | $0.0330 | $0.1650 |
| continuation (warm) | $0.0028 | $0.0084 | $0.0420 |

**Path matrix** (planning frequencies; E = expected, A = adverse; reservation basis in
parentheses):

| Kind | Model | Freq E / A | Unit caps | Retry cap | Batch | Line basis |
|---|---|---|---|---|---|---|
| hot call | tier-routed | 1/exchange | 1.5k fresh / 600 out (cold) | state machine | no | table below |
| validation+escalated retry | tier±1 | 2% / 5% of exchanges | as hot (cold) | ≤2 total | no | cold mid |
| strict continuation | turn tier | 0% / 40% of committed | 200 fresh / 400 out | 1 | no | tier-weighted |
| recall | small + embed | 3% / 5% of committed | 200-token result | 1 | no | $0.005 (cont + embed) |
| extractor | small | 1/committed | 500 in / 60 out | 3 → dead-letter | E yes / A no | $0.0004 / $0.0008 |
| audit | small | 5% of committed | 1k in / 200 out | 1 | yes | $0.004 |
| image | image model | 32 / 40 per campaign | 1 image | 1 | n/a | $0.04 |
| tts | local default | 0 (cloud = §8 Q4) | 1 turn's narration | 1 | n/a | $15/M chars if cloud |
| setup | mid | ~6 calls once | 2k in / 1k out | 1 | no | $0.50 total |

**Scenario E — expected.** 1,800 committed (75 h @ 2.5 min) + 360 non-committing = 2,160
exchanges; mix 80/18/2; warm 90/75/70 (set pieces cluster, frontier re-warms); voice off.

| Line | Calls × avg | Total |
|---|---|---|
| small hot (0.90 warm) | 1,800 × $0.00479 | $8.62 |
| mid hot (0.75 warm) | 324 × $0.01748 | $5.66 |
| frontier hot (0.70 warm) | 36 × $0.09255 | $3.33 |
| retries (2%, cold mid) | 43 × $0.0330 | $1.42 |
| extractor (batched) | 1,800 × $0.0004 | $0.72 |
| audit (5%) | 90 × $0.004 | $0.36 |
| recall (3%) | 54 × $0.005 | $0.27 |
| images | 32 × $0.04 | $1.28 |
| setup | — | $0.50 |
| **Total** | | **$22.16** |

**Scenario A — adverse (unmanaged, sizes the governor).** 3,000 committed + 600 = 3,600
exchanges; mix 75/22/3; warm 75/50/30; retries 5%; strict on 40% of committed; recall 5%;
extraction unbatched; 40 images.

| Line | Calls × avg | Total |
|---|---|---|
| small hot (0.75 warm) | 2,850 × $0.005825 | $16.60 |
| mid hot (0.50 warm) | 660 × $0.02265 | $14.95 |
| frontier hot (0.30 warm) | 90 × $0.13395 | $12.06 |
| retries (5%, cold mid) | 180 × $0.0330 | $5.94 |
| strict continuations (75/22/3-weighted $0.0052) | 1,200 × $0.0052 | $6.24 |
| recall (5%) | 150 × $0.005 | $0.75 |
| extractor (unbatched) | 3,000 × $0.0008 | $2.40 |
| audit (5%) | 150 × $0.004 | $0.60 |
| images | 40 × $0.04 | $1.60 |
| setup | — | $0.50 |
| **Total** | | **≈ $61.6 — over the owner bar** |

That is the point: pacing, cache luck, and optional modes can push an unmanaged campaign well
past $50, so the governor is **load-bearing**. Governed, the same campaign hits the **$45
ceiling and degrades** (mix down, projection tightening, negotiable-mode suspension) — and the
governed soak must still meet §6.5's minimum-progress thresholds, so refusal alone cannot
pass.

**Scenario W — worst case.** Reservation-based admission (§3.7) makes spend ≤ $45 a
construction property; §6.5 tests the construction (cold caches, forced retries, ambiguous
dispatches, 3,000 turns).

**Versus baseline**, normalized per committed turn (both at snapshot v1): E is
$22.16 / 1,800 = **$0.0123/turn** vs the Council's estimated $0.08–0.20 → **≈ 6.5–16×
cheaper** (vs all-small Council ≈ 3–5×). Single-digit-dollar campaigns require the local
routine tier, not the default claim. Latency drops from five sequential round-trips to one
call — the cost fix and the "feels like a real GM" fix are the same fix.

## 5. What is deliberately dropped, and what carries over

**Dropped** (per owner directive; each violates a principle): the sequential Council (P1);
per-turn rebuilt system instructions (P3); carried prose history and importance-scored
summaries (P2); per-turn supervisor oversight (P6).

**Carried over on merit**: closed op vocabulary with engine-issued IDs; engine-side
arithmetic; durable entity records; stakes caps; existing seat-scoping
(`scopeStateForSeat`/`scopeJournalForSeat`). Where Chapter 1/2 text conflicts, this plan wins
for the greenfield runtime; chapters remain the semantic reference for op meanings.

## 6. Acceptance criteria (measurable, engine-enforced)

1. **Call accounting**: every dispatch is counted and reported by kind (sync and async,
   including extractor/audit/image/tts/setup) with cost per kind. Interactive metrics:
   initial-envelope success ≥ 90%, validation-retry ≤ 5%, escalated-retry ≤ 2%, terminal
   fail-closed ≤ 0.5%, mean synchronous generations per exchange ≤ 1.2 (strict mode excluded
   from the mean but reported separately). No kind is excluded from the dispatch report.
2. **Flat context**: 220-turn scripted soak; mean/p95/max fresh-input tokens over turns
   190–210 within 10%/15%/25% of turns 10–30, including an adversarial high-entity block and
   the §6.4 pin-growth soak.
3. **Cache discipline**: per-tier measured hit rates (≥ 90/60/40) from provider-reported
   usage fields, including a session-restart case.
4. **Memory & integrity suite** (versioned corpora, fixed seeds, published oracle): facts at
   turn N **actually used** at N+500 (behavior probes; expected-observable-behavior oracle;
   ≥ 50 probes; pass ≥ 95%); cross-seat and single-seat **paraphrase leak fixtures** fail
   closed (0 leaks tolerated); unearned-change and narration/result contradiction fixtures
   reject 100%; same-envelope local-handle fixtures (G1) pass; prose-evasion fixture set
   measured via audit sampler; sustained extractor-outage test exercises §3.3 backpressure to
   the stop-accepting-actions state.
5. **Budget**: 3,000-turn adversarial soak (cold-cache injection, forced retries, forced
   ambiguous dispatches, strict mode on, output-cap pressure) never exceeds $45; **minimum
   progress under governance**: ≥ 95% of soak exchanges still commit or fail closed within
   thresholds (refusal-only passes are invalid); per-generation telemetry reconciles with
   provider-reported usage within 5% (and invoices where available); ambiguous dispatches
   charge full reservation until reconciled.
6. **Fairness**: root-secret commitment precedes first turn; per-turn hashes recorded
   pre-dispatch; reveals re-derive identically (cross-language vectors); recomputation rejects
   drift; strict mode passes with engine-held rolls; fork derives a fresh root.
7. **Feel regression gate**: pre-registered, paired, blinded **non-inferiority** playtest —
   per-dimension margin 0.75 on a 7-point scale (continuity, agency, tone, pacing), α = 0.05,
   power 0.8 → **≥ 25 paired scenario ratings** per dimension (Council reference vs
   greenfield, randomized order, tier labels hidden, single-rater repeated-measures design
   acknowledged in the analysis). Rerun triggers: any change to models, routing mix or
   thresholds, prompt layers, projection logic, validators, or cache layout.
8. **Baseline honesty**: Council per-branch call counts and per-call token/usage traces
   captured from live code before §1's comparison is cited outside this document.
9. **Gates**: **G1** op contract (`docs/rules/op-contract.md`: schemas, preconditions,
   stakes-cap matrix, conflict keys, error taxonomy, executable fixtures incl. local-handle
   and dice test vectors) pinned before runtime code merges. **G2** turn-API contract
   (`docs/runtime-turn-api.md`: golden host+seat fixtures captured from the live endpoints
   below) pinned before adapter work. **G3** migration matrix (`docs/runtime-migration.md`:
   per-table/per-field DDL, ordered upgrade/rollback, fork/export/import algorithms) pinned
   before cutover.

## 7. Migration posture

Greenfield module beside the existing runtime (`runtime/`; Council untouched).

**Turn API surface (observed v0; G2 freezes it with golden fixtures).** From `server.js`:
`POST /api/campaigns/:id/turn` (rate-limited, seat-aware) returns the **full campaign state,
seat-scoped via `scopeStateForSeat`** — party & turn order, character/NPC/quest/rules state,
sceneGrounding, choices, art/voice references, numbered turns; `GET /api/campaigns/:id/journal`
returns seat-sanitized `{turns, memories}` (no `state_changes_json` for seats) and is the
poll/backfill channel that makes clarifications visible to other seats;
`GET .../audio/:turnNumber` (manifest) and `.../audio/:turnNumber/segments/:segmentId` serve
per-turn TTS with save-once semantics. The adapter maps every envelope field or deterministic
derivative onto that surface; non-committing exchanges get **durable exchange IDs** so seat
visibility and numbering are preserved (no duplicate numbering, no invisible exchanges);
ACL rules (§3.3) apply to state, journal, poll, audio, and error payloads alike. G2's fixture
suite (golden host and guest-seat responses, ordering, idempotency, error codes) gates
adapter work.

**Schema & migration (v0 semantic decisions; G3 provides the per-field matrix).** Additive
tables: `fact`, `attempt_ledger` (generations + dispatch states), `pricing`, `dice_commitment`,
`async_jobs` (+ dead-letter), per-campaign `runtime` discriminator + **config snapshot** (tier
models, strict-mode class incl. invariant/negotiable, budget policy, rng_algo_version,
pricing snapshot id). Legacy rows default `runtime='council'`. **Fork/export/import**: copy
facts with ID remapping (subjects/ACLs/supersession links remapped together), attempt
parentage preserved, telemetry copied read-only; open async jobs are **not copied executable —
re-enqueued as fresh claims with new idempotency keys** (no double execution); reservations
are never copied (recomputed); dice root secret: fresh root derived on fork/import, old
commitments read-only verifiable (§3.2). Rollback: additive tables make downgrade = ignore;
G3 specifies ordered upgrade scripts and fixture migrations from representative existing
databases. Cutover is per-campaign opt-in: new campaigns first; Council retires after §6.7
passes.

## 8. Open questions for the owner

1. Dice default: dice column (cheapest, GM-fudge-equivalent trust) vs strict mode (provably
   neutral, priced in §4 adverse) as the campaign default?
2. Is a local/open-weights routine tier acceptable for table feel, or cloud-small only?
3. Latency vs polish: should set-piece turns be allowed a second call (pre-planning beat) at
   ~2× that tier's cost for ~2% of turns?
4. Voice: local/system TTS default (free, lower quality), or cloud TTS accepted as a priced
   add-on (~$22 expected at snapshot v1 — consumes most remaining ceiling headroom)?
