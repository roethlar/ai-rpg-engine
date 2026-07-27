# Runtime Greenfield Plan — ABANDONED

**Status** (owner, 2026-07-26): abandoned. Historical design evidence only; do not implement.
The shipped Council runtime remains canonical, and product work continues incrementally through
rules, UI, mapping, and related improvements.

**Historical mandate** (owner, 2026-07-18): greenfield-plan a better, cheaper engine for the models to use.
Prior decisions and rules are **not binding** on this plan. The hard constraint is economic: a
campaign must not cost $50 — that money buys a AAA title delivering 50–100 hours. Facts the model
needs must be immediately available without being a carried token burden.

**Planning numbers.** A campaign is 50–100 hours of play. Observed solo pacing is 2–3 minutes per
committed turn, so the committed-turn envelope is **1,200–3,000 turns**; the **upper planning
case is 3,000 committed turns** (100 h at 2 min). Budget bars: **owner mandate: under $50,
hard**; engine ceiling **$45** (reservation-enforced, §3.7); **~$23 expected** at the median
campaign shape (§4).

**Accounting units** (three levels, each with its own ID, cap, and denominator):

- **Exchange** — one player-visible request/response cycle (action, clarification, table talk).
  Upper envelope **3,600 per campaign** (1.2× committed turns). Public turn numbering derives
  **only** from exchanges, so async work and retries never create visible gaps. An exchange
  record is **persisted before any generation dispatches**, unique over (campaign,
  **principal**, client-supplied `request_id`) where principal = (`principal_kind`,
  `principal_id`) — `seat` for seat members, `host` for the host's stable account id — so
  host requests use the same non-null idempotency key as seats (no NULL-distinct rows),
  with a canonical request hash. The exchange **lifecycle** is a persisted state machine
  `accepted → generating → committing → settled(status §6.5)` with a **fenced lease**
  (owner process, expiry, and a monotonically increasing **lease epoch**; acquisition and
  renewal are single compare-and-swap transactions that increment the epoch). Every
  generation dispatch and every settlement transaction records its acquiring epoch and
  **aborts if the exchange's current epoch differs** — the check runs inside the single
  settlement transaction, so a stale owner returning from a slow provider call can neither
  dispatch nor settle over its successor. A duplicate `POST /turn` with the same key
  returns the stored settled result, or 202-with-state for
  `accepted`/`generating`/`committing`, **to that principal only** (replay is
  audience-scoped); the same key with a different request hash rejects; never a second
  billing or a second commit. Settlement is a single SQLite transaction joining canonical
  state commit, public sequence allocation, terminal status, and result reference; startup
  recovery scans non-terminal exchanges with expired leases: one with **no dispatch in
  flight** (no `dispatched` ledger row, §3.7) is re-acquired (epoch bump) and resumed or
  settled `failed_closed` (§6.5's terminal fallback status) with **no state commit** (§7);
  one with a recorded in-flight dispatch is reconciled through §3.7's `ambiguous` path —
  never blindly resumed. Fixture suite includes concurrent host-duplicate and
  seat-duplicate requests plus a stale-owner (expired-lease) settlement attempt.
- **Generation** — one logical model task, recorded with its exchange id and a **stage** enum.
  The synchronous **base chain** is `initial → ≤1 validation re-prompt → ≤1 escalated retry`
  (§3.1 state machine). Synchronous **continuations** are separate stages, each with its own
  cap: strict-mode roll continuation (≤1 per checked exchange) and recall continuation (≤1).
  Absolute synchronous maximum per exchange: **3** (normal), **4** (strict), **5** (strict +
  recall); the base-chain retries never multiply continuations. Async kinds (extractor, audit,
  image, tts, setup) are generations with their own per-kind envelopes (§4 path matrix).
- **Dispatch** — one physical provider request. One generation issues one dispatch (SDK
  auto-retries disabled, §3.7); every dispatch is individually reserved before it leaves the
  engine and settled after (§3.7).

---

## 1. Baseline: why the current engine is expensive

The shipped runtime (`rpg-engine.js`, `runMultiAgentTurn`) is a **Council** of sequential model
calls per committed turn. Branch map from the live call sites: a normal committed action makes
**5 calls** — interaction proposal, continuity review, referee, final continuity, narration —
plus a **conditional 6th** (`generateLocationLayout` on first entry to an unresolved
location), and **table talk makes 2** (interaction proposal, then the grounding/table-talk
verifier — which itself carries `getGMSystemInstruction(...)`, so the GM system prompt has
**two consumers**, narration and the verifier). The narration call carries
`getGMSystemInstruction(...)` plus the turn-prompt history block; the other calls carry
bespoke system prompts plus a compacted `contextJson` — constant within the turn — with the
accumulating proposal/review/referee JSON chain **appended after it** per call, so context
re-payment grows through the turn even where the system prompts differ (chain growth, not
`contextJson` mutation). Costs compound four ways:

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
  ops:           [ ... ] }      // the ONLY mutation channel; creation ops declare n1..nN
```

**Envelope-local handles (causality).** Checks are implicitly handled `c1..cN` in declaration
order; creation ops declare `local_id` (`n1..nN`) which later ops in the same envelope
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
fixture set whose sensitivity is numerically gated (§6.4). This is an honest limitation, not a validator claim.

**The attempt ledger.** Every generation appends a ledger row *before dispatch*: generation id,
exchange id (nullable for async kinds), kind (action / clarification / table_talk /
validation_retry / escalated_retry / strict_continuation / recall_continuation / extractor /
audit / image / tts / setup), tier, reserved cost, actual usage, cache stats, dispatch state
(§3.7). Clarifications commit no state but are billed, capped, and soaked like everything else.

**Ops contract.** `ops` is the **single canonical mutation channel**: every state, fact,
disposition, and knowledge mutation is an op in this one array — there is no side channel, so
preconditions, consequence caps, and conflict keys apply uniformly and cross-channel bypass
is structurally impossible. Normative core (v0): op kinds are
`create_entity, move, transfer_item, apply_condition, clear_condition, adjust_clock,
complete_objective, record_fact, reveal_fact, npc_disposition, spawn_thread, close_thread` —
each with fixed
fields, **engine-issued ID provenance** (models reference existing IDs or `local_id` handles
only), preconditions (allowed source states), a consequence class checked against the turn's
stakes cap, a conflict key (two ops with the same key in one envelope reject; keys are defined
over the target entity/attribute so any two ops touching the same slot collide regardless of
kind), deterministic in-order application, and a rejection code. Ops granting items, completing objectives, or
moving location must cite an enabling `roll_result` or standing entitlement; uncited grants
reject ("unearned change", §6.4). State the engine can derive is derived, never
model-asserted. **Gate G1**: the full op contract (`docs/rules/op-contract.md`, versioned:
exact schemas, precondition table, stakes-cap matrix, conflict keys, error taxonomy, executable
valid/invalid fixtures) must be pinned and its fixtures passing **before any runtime code
merges**; this plan's v0 list is the scope contract for that artifact.

**Failure state machine** (per exchange):
`dispatch → validate → [reject: one re-prompt, same tier] → validate → [reject: one escalated
retry, +1 tier] → validate → [reject: terminal fallback]`. Escalation **from frontier** is
defined: no higher tier exists, so the escalated slot runs as a fresh **cold dispatch at the
same frontier tier** (new generation, new reservation — never an unpriced provider); §4
prices frontier→frontier accordingly. The **base chain** is capped at
three generations; the **whole exchange** at the absolute maxima in Accounting units (3
normal / 4 strict / 5 strict + recall), all metered. Continuations have retry cap 0: a strict
continuation that fails validation falls back to **deterministic mechanical resolution** (the
engine states the outcome of the already-committed dice; no prose retry); a failed recall
continuation is dropped and the exchange proceeds without recall (best-effort). Terminal fallback is deterministic engine prose (action
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
revealed after commit. **What is verifiable, and when (precise)**: (a) *live, per turn* — the
revealed (seed, column) re-derives the committed hash, proving the column was fixed **before
the model call**: the model provably could not pick its dice. This is the neutrality property
that matters against the model. (b) *At root reveal only* — that each turn's seed was honestly
HMAC-derived from the committed root (i.e. the trusted engine code, not a cherry-picking
server, chose the seeds). A hash commitment cannot authenticate HMAC outputs without the key,
so (b) is verified when the root is revealed: at campaign end, or on owner-triggered rotation
(reveal old root, commit fresh root, verify history to that point). The plan claims (a)
during play and (b) post hoc — nothing stronger. Secret lifecycle: stored server-side only;
**fork/import derives a fresh root** (copied commitments become verifiable when the *source*
campaign reveals its root; future rolls are never predictable from an export); compromise =
rotate (which reveals and re-commits). Cross-language test vectors ship with gate G1's
fixture suite.

Binding is implicit and validator-enforced: check #N binds to die #N; the schema exposes no
index field. Declaring more checks than the column holds (engine max 4) fails validation;
unconsumed dice are discarded with the turn. The engine recomputes every outcome; §3.1 rejects
contradicting claims.

Residual risk (check *existence* shading) is bounded by consequence caps, stakes limits, and
audit sampling — equivalent to a human GM fudging behind the screen. **Strict mode**
(per-campaign config) splits the turn into two phases with **normative schemas** (both ship
in gate G1). *Declaration envelope*: `intent` + `checks[]` + optional non-mechanical `color`
segments only — no `outcome` segments, no `ops`, no reference to any unrolled result; the
validator rejects violations deterministically under §3.1's error taxonomy. Nothing commits
at declaration: the engine persists the envelope, rolls from the committed column, appends
the `roll_result` records, and the model resumes on the **cached-prefix boundary** — [static
prefix] + [slow block] + [turn block incl. the declaration envelope] + engine-appended rolls,
nothing re-serialized — billed as `strict_continuation` (cache-read + ~200 fresh, §4).
*Continuation envelope*: `outcome` segments (each citing a rolled check) + `narration` +
`ops`; it may not add, remove, or alter `checks` (deterministic reject). **Atomic commit
timing**: the exchange commits once, when the continuation validates — dice consumption,
ops, facts, and journal rows land together or not at all. Continuation validation failure is
deterministic (retry cap 0, §3.1): the engine commits the rolled checks with engine-rendered
outcome banners and **no model ops** — mechanical resolution under the same single atomic
commit. Config guarantees are classified: owner-forced
strict mode is **invariant** — the governor may never suspend it (it degrades elsewhere or
fails closed); player-opt-in strict mode is negotiable (suspends with notice under budget
pressure).

### 3.3 Memory: fact store + deterministic projection

- **Write path.** Explicit fact-writing ops (`record_fact`, `reveal_fact` — ops like any
  other, §3.1's single channel) commit atomically with the turn:
  `fact { subjects: [ids], text ≤25 tokens, kind: promise|revelation|relationship|world|event,
  provenance: turn id + segment ref, visibility: ACL, lifecycle: {salience, class, supersedes?} }`.
  The async extractor is a safety net: durable idempotent queue (enqueue at commit; small-model
  sweep ~500 in / 60 out; dedupe by content hash; evidence span required; retry ×3 then
  dead-letter + telemetry alarm). **Freshness rule with explicit backpressure**: a turn may not
  leave the 2-turn transcript window until its extraction settles; the window extends at most
  +2 turns. Beyond that bound (extractor outage, reservation denial): the engine runs
  **pre-admission recovery** — before any further committed action is admitted, the backlog
  is flushed through the normal async extractor lane (priority claims, individually reserved
  and metered as `extractor`); the exchange itself never carries a synchronous extractor
  dispatch, so the per-exchange absolute maxima and the ≤ 1.2 mean (§6.1) are untouched. If
  recovery reservations are denied, the engine stops accepting committed actions
  (clarifications still work) rather than silently dropping memory — surfaced to the player
  as a budget/connectivity notice.
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
- **Transcript window**: last 1–2 turns + rolling ~100-token engine-composed scene summary
  (composed deterministically from committed ops and shared-projection narration — the model
  does not author it; a model-written summary would be a second, unvalidated mutation
  channel).
- **Visibility.** Facts carry engine-derived **witness ACLs** (present / told / could-infer,
  computed from scene records at write time; model-authored visibility claims are clamped to
  the engine's ACL, never widened). Projections are audience-specific, and **audience
  separation is structural, not semantic**: the hot call's prompt is built from the
  **table-intersection projection only** — the model never sees requester-private facts, so
  shared narration cannot leak them *by construction*; paraphrase fixtures (§6.4) are
  regression checks, not the boundary. Facts outside the intersection may drive NPC behavior
  only via behavioral surface (disposition, pressure) computed engine-side. **Requester-
  private content** (what *your* character alone learned) travels on a separate channel: v0
  delivers it as **deterministic engine rendering** of the ACL'd fact records (templated, no
  model call, no new cost line), served only to eligible seats; a separately priced private
  generation whose context is the requester's own ACL is a v1+ option (§8). The journal
  stores segments with **engine-derived audience provenance** (the envelope has no audience
  field — the model cannot author one) and serves them seat-scoped on poll/backfill; audio is
  synthesized from the shared representation only; error payloads carry no fact text. Seat
  scoping already exists in `server.js` (`scopeStateForSeat`, `scopeJournalForSeat`) and
  carries over. Leak testing includes **cross-seat paraphrase fixtures** and
  **private-answer fixtures** (private info must reach its eligible seat — starving is a
  failure too) (§6.4).
- **Input visibility (explicit).** Raw player input is **table-public by declared contract**:
  the composer is labeled visible-to-the-table, the transcript window carries it verbatim,
  and narration may echo it — v0 never promises input privacy, so a secret typed into the
  public composer is a UX-level disclosure, not an engine leak. Private material travels the
  **private channel**: a `private_note` intent stored seat-scoped (it never enters the shared
  transcript window, projections, extraction, or any other seat's prompt) and acknowledged by
  deterministic engine template — no model call, no new cost line; model-mediated private
  *actions* are the same priced v1+ option as private generation (§8). **Raw-input echo
  fixtures** (§6.4): one seat's private-channel text appearing in shared narration, another
  seat's prompt, or an error payload is a release-blocking leak; public-input echo is
  by-contract and excluded from leak counts.

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
escalation-worthy inputs**, and a consequence-weighted false-negative ceiling (≤ 1 weighted
miss per 1,000 escalation-worthy inputs, weights = stakes class). **Gate G4**: the exact
router spec (`docs/runtime-router.md`: normalization, tokenizer, lexicon contents,
imperative-clause rule, thresholds, tier transitions, corpus fixtures, the numeric ceiling)
is pinned before router implementation — feature *names* in this plan are scope, not spec.

| Tier | Share (planning) | Class | Warm/cold per-call (snapshot v1) |
|---|---|---|---|
| routine | ~80% | small (Haiku-class or local) | $0.0041 / $0.0110 (→ ~$0 local) |
| contested | ~18% | mid (Sonnet-class) | $0.0123 / $0.0330 |
| set piece | ~2% | frontier (Opus-class) | $0.0615 / $0.1650 |

### 3.6 Off-path work is async, batched, and individually priced

Every charged path appears in §4's **path matrix** with its own frequency, unit caps, retry
cap, batch eligibility, snapshot rate, and reservation basis. **Voice (TTS) is a charged
path**: the live product synthesizes narration audio per turn, so the greenfield contract
prices it. Default scenarios are **voice-off**; cloud TTS at snapshot rates adds ~$21 expected
(1.4M chars × $15/M = $21.00) — nearly the whole ceiling — so voice defaults to local/system TTS or
requires explicit owner acceptance (§8 Q4). When enabled, TTS is reserved and metered per
dispatch like every other kind, with save-once replay (synthesize once per turn, serve from
storage).

### 3.7 Budget governor and telemetry

- **Versioned pricing.** `pricing` table (provider, model, in/out/cache-read/cache-write,
  media rates, effective date, snapshot id) is the sole authority; every figure cites a
  snapshot. Custom providers without declared prices cannot join paid tiers.
- **Reserve → dispatch → settle, durably.** Per **dispatch** state machine, persisted:
  `reserved → dispatched → settled | ambiguous`. Reservation = **tokenize the fully
  serialized request with the destination model's pinned tokenizer version before
  dispatch** (tokenizer versions live in the config snapshot, §7), classify every token by
  **provider billing class at the declared §3.4 cache boundary**, then reserve
  (cacheable-prefix tokens × cache-write rate — the per-token cold worst case for those
  tokens; a cache-read settlement only refunds) + (non-prefix tokens × input rate) +
  (output-token cap × output rate) + (media unit cap × media rate) — no estimated
  component (the ~6k cacheable prefix is a forecast figure only, §4; the reservation uses
  the actual tokenized segments). TTS reserves from the **exact pre-dispatch character
  count** of the committed narration text under §3.6's hard character cap.
  Settlement can never exceed reservation: every billing class is reserved at its
  per-token worst case, output is hard-capped, media is unit-capped. The prompt assembler
  enforces a per-tier serialized-input token ceiling (a build constant; §4 states it:
  **8,192 tokens**);
  exceeding the ceiling is a structural build failure surfaced pre-dispatch, never silent
  truncation. (Reference shape — 6k prefix at cache-write + 1.5k fresh at input +
  600-token output cap — ≈ **$0.012 small / $0.036 mid / $0.180 frontier** at snapshot v1,
  computed with exactly this billing classification; illustrative, not the reservation
  rule.)
  Campaign-mix averages are **forecast** figures (§4) and are never used as reservations —
  every physical dispatch is covered by its own pre-tokenized worst-case reservation,
  which is what makes the $45 ceiling a construction property. Dispatch uses provider idempotency keys where
  supported; SDK auto-retries are disabled (a retry is a new reserved dispatch). Client-side
  duplicates are absorbed one level up: the exchange record's unique `request_id` (Accounting
  units) means a resubmitted `POST /turn` finds the existing exchange and replays its stored
  state — no second generation, no second reservation. Timeout or
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
**Batch lane** (async kinds whose settlement deadline exceeds the lane's SLA — audit and
offline-pause backlog flush only; **in-play extraction is excluded** because §3.3's four-turn
freshness bound is far shorter than the SLA): small at **50% of list** in/out, settled at
batch completion (≤ 24 h SLA; cache rates do not apply in batch). Batch terms — rates,
per-kind eligibility, SLA, timeout disposition — are **versioned fields of the pricing
snapshot** (§3.7), never hard-coded lane constants. Timeout disposition: the timed-out
original settles terminally under its own reservation **first**, then the recovery dispatch
is a fresh list-rate synchronous reservation — never two live claims for the same work.
Derived: extractor (500 in / 60 out) = $0.0004 batched / $0.0008 unbatched at list;
**scenarios price all in-play extraction at list** (the batch discount is never claimed in E
or A); audit is priced at list even when batched (discount not claimed — conservative
padding).
Call shape: cacheable prefix ~6,000 tokens; fresh ~1,500; output ~400 typical (600 cap).
Continuations: cache-read 6k + ~200 fresh + 400 out. **Serialized-input ceiling** (build
constant, all tiers): **8,192 tokens**; §3.7's reservation classifies every token from the
pinned per-model tokenizer (cacheable-prefix segments → cache-write rate, non-prefix →
input rate), so the ceiling numerically bounds any single hot-call reservation at
≤ $0.0133 / $0.0398 / $0.1986 small/mid/frontier (all-cache-write cold at ceiling plus the
600-token output cap).

| Per-call | small | mid | frontier |
|---|---|---|---|
| warm | $0.0041 | $0.0123 | $0.0615 |
| cold | $0.0110 | $0.0330 | $0.1650 |
| continuation (warm) | $0.0028 | $0.0084 | $0.0420 |

**Path matrix** (planning frequencies; E = expected, A = adverse; reservation basis in
parentheses):

Rates count **exchanges entering that stage** (each stage = one extra dispatch).
**Escalated retries occur only on committed-action exchanges** (clarification and table-talk
lanes fail soft at small tier and never escalate), so their counts derive from committed
turns. **Retry entry is conditional on tier** — retries correlate with hard content, which
concentrates at the higher tiers — so no unconditional mix average is used as a bound
anywhere. Conditional rates (share of that tier's exchanges): validation retry E 1.5 / 4 / 8%
and A 4 / 8 / 15% (small/mid/frontier), priced same-tier cold; escalated retry E 0.3 / 1 /
2.5% and A 1.2 / 4 / 8% of that tier's committed turns, priced destination-tier cold with
**frontier→frontier** defined as a fresh same-tier cold dispatch (§3.1). Retry lines below
are Σ(tier count × conditional rate × destination cold) — computed, unpadded; the adverse
case stresses concentration by construction (A frontier validation 15%). **Retry cap**
counts post-dispatch validation re-prompts; continuations carry retry cap 0 with
stage-occurrence cap ≤ 1 (§3.1), so the absolute maxima (3 / 4 / 5) bind through the base
chain alone. Line bases are **forecast** figures; reservations always use the per-dispatch
destination-tier caps (§3.7), never these averages. Where a line basis exceeds its computed
snapshot cost, the padding is deliberate contingency, labeled with its multiplier.

| Kind | Model | Freq E / A | Unit caps | Retry cap | Batch | Line basis (computed → padded) |
|---|---|---|---|---|---|---|
| hot call | tier-routed | 1/exchange | 1.5k fresh / 600 out | state machine | no | per-call table above, unpadded |
| validation retry | same tier, cold | tier-cond. E 1.5/4/8% / A 4/8/15% | as hot | 1 | no | Σ tier × same-tier cold: E $1.20 / A $5.22, unpadded |
| escalated retry | +1 tier; frontier→frontier, cold | tier-cond. of committed: E 0.3/1/2.5% / A 1.2/4/8% | as hot | 1 | no | Σ tier × destination cold: E $0.83 / A $6.44, unpadded |
| strict continuation | turn tier | 0% / 40% of committed | 200 fresh / 400 out | 0 (occ ≤ 1) | no | tier-weighted $0.0052, unpadded |
| recall | small + embed | 3% / 5% of committed | 200-token result | 0 (occ ≤ 1) | no | $0.0030 computed (cont $0.0028 + embed) → $0.005 (×1.7) |
| extractor | small | 1/committed | 500 in / 60 out | 3 → dead-letter | in-play no; offline pauses only (§3.3) | $0.0008 list in both scenarios (batch $0.0004 never claimed in-play), unpadded |
| audit | small | 5% of committed | 1k in / 200 out | 1 | yes | $0.002 computed → $0.004 (×2, retry allowance) |
| image | image model | 32 / 40 per campaign | 1 image | 1 | n/a | $0.04/image, snapshot rate |
| tts | local default | 0 (cloud = §8 Q4) | 1 turn's narration | 1 | n/a | $15/M chars if cloud |
| setup | mid | ~6 calls once | 2k in / 1k out | 1 | no | $0.126 computed (6 × cold mid 2k/1k) → $0.50 (×4, image-prompt retries + provider variance) |

**Rounding convention.** Expected counts stay fractional (never integer-rounded); each line
is the unrounded product displayed to the cent; scenario totals sum unrounded lines and
round once — display rounding never compounds.

**Scenario E — expected.** 1,800 committed (75 h @ 2.5 min) + 360 non-committing = 2,160
exchanges; mix 80/18/2; warm 90/75/70 (set pieces cluster, frontier re-warms); voice off.
The mix routes committed turns; all 360 non-committing exchanges run small (§3.5 fail-soft
lanes), so **tier exchange counts are small 1,800 / mid 324 / frontier 36** — retry lines
use these tier counts (the same counts as the hot rows), never the headline mix.

| Line | Calls × avg | Total |
|---|---|---|
| small hot (0.90 warm) | 1,800 × $0.00479 | $8.62 |
| mid hot (0.75 warm) | 324 × $0.01748 | $5.66 |
| frontier hot (0.70 warm) | 36 × $0.09255 | $3.33 |
| validation retries (tier-cond. 1.5/4/8%) | 27 / 12.96 / 2.88 × tier cold | $1.20 |
| escalated retries (tier-cond. 0.3/1/2.5% of committed) | 4.32 / 3.24 / 0.9 × dest cold | $0.83 |
| extractor (list, in-play lane) | 1,800 × $0.0008 | $1.44 |
| audit (5%) | 90 × $0.004 | $0.36 |
| recall (3%) | 54 × $0.005 | $0.27 |
| images | 32 × $0.04 | $1.28 |
| setup | — | $0.50 |
| **Total** | | **$23.49** |

**Scenario A — adverse (unmanaged, sizes the governor).** 3,000 committed + 600 = 3,600
exchanges; mix 75/22/3; warm 75/50/30; tier-conditional retries per the matrix (blended
≈ 5.0% validation / ≈ 2.0% escalation — deliberately past §6.1's governed thresholds: this
is the unmanaged case the governor must contain); strict on 40% of committed; recall 5%;
extraction unbatched; 40 images. Tier exchange counts: small 2,850 / mid 660 / frontier 90
(600 non-committing all small); retry lines use these counts.

| Line | Calls × avg | Total |
|---|---|---|
| small hot (0.75 warm) | 2,850 × $0.005825 | $16.60 |
| mid hot (0.50 warm) | 660 × $0.02265 | $14.95 |
| frontier hot (0.30 warm) | 90 × $0.13395 | $12.06 |
| validation retries (tier-cond. 4/8/15%) | 114 / 52.8 / 13.5 × tier cold | $5.22 |
| escalated retries (tier-cond. 1.2/4/8%) | 27 / 26.4 / 7.2 × dest cold | $6.44 |
| strict continuations (75/22/3-weighted $0.005208) | 1,200 × $0.005208 | $6.25 |
| recall (5%) | 150 × $0.005 | $0.75 |
| extractor (unbatched) | 3,000 × $0.0008 | $2.40 |
| audit (5%) | 150 × $0.004 | $0.60 |
| images | 40 × $0.04 | $1.60 |
| setup | — | $0.50 |
| **Total** | | **≈ $67.4 — over the owner bar** |

That is the point: pacing, cache luck, and optional modes can push an unmanaged campaign well
past $50, so the governor is **load-bearing**. Governed, the same campaign hits the **$45
ceiling and degrades** (mix down, projection tightening, negotiable-mode suspension) — and the
governed soak must still meet §6.5's minimum-progress thresholds, so refusal alone cannot
pass.

**Scenario W — worst case.** Reservation-based admission (§3.7) makes spend ≤ $45 a
construction property; §6.5 tests the construction (cold caches, forced retries, ambiguous
dispatches, 3,000 turns).

**Versus baseline**, normalized per committed turn (both at snapshot v1): E is
$23.49 / 1,800 = **$0.0131/turn** vs the Council's estimated $0.08–0.20 → **≈ 6–15×
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
   closed (0 leaks tolerated) and the **private-answer fixtures** deliver requester-private
   content to eligible seats (starving fails too); unearned-change and narration/result
   contradiction fixtures
   reject 100%; same-envelope local-handle fixtures (G1) pass; the prose-evasion fixture
   **oracle is published and versioned** with the corpus, and the 5% audit sampler is gated
   numerically against it — detection ≥ 90% on oracle fixtures, false positives ≤ 5% on
   clean fixtures, below-bound performance **blocks release**, and a flagged exchange has a
   deterministic consequence (narration replaced by the engine-rendered structural outcome
   pending review; telemetry incident); sustained extractor-outage test exercises §3.3 backpressure to
   the stop-accepting-actions state.
5. **Budget**: the 3,000-turn adversarial soak runs a **pinned, seeded workload manifest**
   (gate G5: exchange mix, failure-injection kinds with exact rates and RNG seeds, ordering)
   so the test is reproducible, and never exceeds $45. G5 pins a **minimum stress envelope**
   (floors, not just seeds): validation rejects ≥ 3% of exchanges with ≥ ⅓ at mid+ tiers,
   escalations ≥ 1% of committed, ambiguous-settlement episodes ≥ 0.5% of dispatches, ≥ 3
   crash-recovery kill points (between reserve, dispatch, settle), ≥ 2 full cache-flush cold
   starts, and ≥ 1 sustained extractor outage reaching dead-letter; a manifest under any
   floor cannot pass the gate. Feasibility is proved at pin time: the manifest must be
   satisfiable under the $45 ceiling together with this item's minimum-progress thresholds,
   or it is rejected as infeasible. Every player request records an
   **exchange status**: `committed | clarified | table_talk_ok | governor_denied |
   failed_closed` — the denominator is all of them, so refusals cannot hide. Thresholds:
   attempted actions committed ≥ 95%, clarifications answered ≥ 99%, governor denials ≤ 2%,
   terminal fallbacks ≤ 0.5%. Per-generation telemetry reconciles with provider-reported
   usage within 5% (and invoices where available); ambiguous dispatches charge full
   reservation until reconciled.
6. **Fairness**: root-secret commitment precedes first turn; per-turn hashes recorded
   pre-dispatch; reveals re-derive identically (cross-language vectors); recomputation rejects
   drift; strict mode passes with engine-held rolls; fork derives a fresh root.
7. **Feel regression gate**: pre-registered, paired, blinded **non-inferiority** playtest.
   Test: one-sided paired non-inferiority per dimension (continuity, agency, tone, pacing;
   7-point scale) — pass iff the one-sided 95% CI lower bound of the mean paired difference
   (greenfield − Council) exceeds **−0.75**. Sample size derived, not asserted: assumed SD of
   paired differences 1.25 (documented conservative assumption pending a pilot), α = 0.05,
   power 0.8 → n ≈ 18 pairs; inflated ~40% for variance misspecification and missing ratings
   → **≥ 25 paired scenario ratings** per dimension (randomized order, tier labels hidden,
   single-rater repeated-measures acknowledged). If observed SD > 1.25, n is recomputed and
   collection extends before judging; incomplete pairs are dropped with the n floor
   maintained. Rerun triggers (full re-collection): any change to models, routing mix or
   thresholds, prompt layers, projection logic, validators, or cache layout.
8. **Baseline honesty**: Council per-branch call counts and per-call token/usage traces
   captured from live code before §1's comparison is cited outside this document.
9. **Gates**: **G1** op contract (`docs/rules/op-contract.md`: schemas, preconditions,
   stakes-cap matrix, conflict keys, error taxonomy, executable fixtures incl. local-handle
   and dice test vectors) pinned before runtime code merges. **G2** turn-API contract
   (`docs/runtime-turn-api.md`: golden host+seat fixtures captured from the live endpoints
   below) pinned before adapter work. **G3** migration matrix (`docs/runtime-migration.md`:
   per-table/per-field DDL, ordered upgrade/rollback, fork/export/import algorithms) pinned
   **before any migration code is written** (not merely before cutover); cutover additionally
   requires its fixture migrations passing. **G4** router spec (`docs/runtime-router.md`,
   §3.5) pinned before router implementation. **G5** soak workload manifest (seeded, §6.5)
   pinned before the budget soak is cited.

## 7. Migration posture

Greenfield module beside the existing runtime (`runtime/`; Council untouched).

**Turn API surface (observed v0; G2 freezes it with golden fixtures).** From `server.js`:
`POST /api/campaigns/:id/turn` (rate-limited, seat-aware) returns the **full campaign state,
seat-scoped via `scopeStateForSeat`** — party & turn order, character/NPC/quest/rules state,
sceneGrounding, choices, art/voice references, numbered turns; `GET /api/campaigns/:id/journal`
returns seat-sanitized `{turns, memories}` (no `state_changes_json` for seats) and is the
poll/backfill channel that makes clarifications visible to other seats;
`GET .../audio/:turnNumber` (manifest) and `.../audio/:turnNumber/segments/:segmentId` serve
per-turn TTS with save-once semantics. The greenfield turn request adds a **client-supplied
`request_id`** (unique over (campaign, principal, `request_id`), principal = (`principal_kind`,
`principal_id`) covering both seats and the host, with a canonical request hash,
§2; the server persists the exchange record under that key before any generation, replays
the stored result to the requesting seat on resubmission, and rejects a reused key whose
request hash differs — lost HTTP responses can no longer double-bill or double-commit). The adapter maps every envelope field or deterministic
derivative onto that surface; non-committing exchanges get **durable exchange IDs** so seat
visibility and numbering are preserved (no duplicate numbering, no invisible exchanges);
ACL rules (§3.3, dual-projection) apply to state, journal, poll, audio, and error payloads
alike. G2's fixture
suite (golden host and guest-seat responses, ordering, idempotency, error codes) gates
adapter work.

**Schema & migration (v0 semantic decisions; G3 provides the per-field matrix).** Additive
tables: `fact`, `exchange` (unique key (campaign, principal_kind, principal_id, request_id),
all columns non-null; canonical request hash; lifecycle state
`accepted|generating|committing|settled` + lease columns (owner, expiry); terminal status
enum §6.5; public sequence; canonical result reference — its golden replay fixtures
gate G2), `attempt_ledger` (generations + dispatch states), `pricing`, `dice_commitment`,
`async_jobs` (+ dead-letter), per-campaign `runtime` discriminator + **config snapshot** (tier
models, strict-mode class incl. invariant/negotiable, budget policy, rng_algo_version,
pricing snapshot id). Legacy rows default `runtime='council'`. **Fork/export/import**: copy
facts with ID remapping (subjects/ACLs/supersession links remapped together), attempt
parentage preserved, telemetry copied read-only; open async jobs are **not copied executable —
re-enqueued as fresh claims with new idempotency keys** (no double execution); reservations
are never copied (recomputed); the `exchange` table is copied as **inert provenance** —
rows re-keyed to the new campaign with fresh exchange ids (originals kept in
`source_exchange_id`), canonical result references remapped with the facts, copied rows
marked `imported` and never replayable (`request_id` uniqueness is per-campaign and the
import writes no live idempotency keys, so resubmitting an old `request_id` in the new
campaign opens a fresh exchange, never a cross-campaign replay), public sequence numbering
continuing from the copied history — G3's fixture migrations include
exchange/result/public-sequence remapping cases; dice root secret: fresh root derived on
fork/import, old
commitments verifiable per §3.2's reveal rules. **Rollback and version fencing**: additive
DDL alone does not make downgrade safe — an older binary would run a greenfield campaign
through the Council path, ignoring facts, reservations, and dice semantics. Therefore each greenfield campaign records a `min_runtime_version`, and fencing is
**release-staged**: a **bridge release** carrying the generic fence (refuse any campaign
whose `min_runtime_version` exceeds the binary, with an explanatory error) is fully deployed
**before any greenfield migration ships**. Rollback is supported **only to the bridge
release or later**. Pre-bridge binaries contain no fence code and cannot refuse, so
downgrade past the bridge is declared unsupported **and** blocked at the database level:
greenfield campaigns live in a separate `campaign_v2` table that pre-bridge binaries never
query — an old binary cannot open (and therefore cannot corrupt or misroute) a greenfield
campaign; it simply does not list it. Recovery on an older-than-bridge binary is **restore
the pre-migration backup taken at upgrade time**, never opening the upgraded database.
Greenfield activation is **one-way per campaign**; rollback is backup restoration, not
downgrade. G3 (gated before any migration code, §6.9) specifies ordered
upgrade scripts and fixture migrations from representative existing databases. Cutover is
per-campaign opt-in: new campaigns first; the Council retires only when **every §6
criterion passes, gates G1–G5 exist with their fixtures passing (including G3's fixture
migrations on representative databases), and the owner has decided §8's open questions** —
§6.7 is one necessary gate among these, never the sole trigger.

## 8. Open questions for the owner

1. Dice default: dice column (cheapest, GM-fudge-equivalent trust) vs strict mode (provably
   neutral, priced in §4 adverse) as the campaign default?
2. Is a local/open-weights routine tier acceptable for table feel, or cloud-small only?
3. Latency vs polish: should set-piece turns be allowed a second call (pre-planning beat) at
   ~2× that tier's cost for ~2% of turns?
4. Voice: local/system TTS default (free, lower quality), or cloud TTS accepted as a priced
   add-on (~$21 expected at snapshot v1 — consumes most remaining ceiling headroom)?
