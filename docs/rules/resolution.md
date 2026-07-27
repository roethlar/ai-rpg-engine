# Aetheria House Ruleset — Chapter 1: Resolution

**Status**: ACTIVE — signed off by the owner 2026-07-16 at review-converged pin `8f7862d` (nine
rounds, codex + grok dual acceptance; trail: `.agents/review/resolution-ruleset-review.md`);
amended 2026-07-27 by the owner-signed Chapter 2 r24's three declared refinements. The
Supersession declaration below is enacted and recorded in `.agents/decisions.md`. This chapter is
the canonical check-resolution specification. The D2 effect-catalog design gate was satisfied by
the owner-signed Chapter 2 r24 on 2026-07-27; rules code still requires a concrete owner-approved
phase plan.
**Provenance**: D0 (2026-07-12, fixed house chassis + flavor skins); D1 (2026-07-16, as amended);
owner brainstorm adopted for drafting 2026-07-16 (`.agents/review/dice-bakeoff.md`, addenda 3–4).

## Supersession declaration (explicit — owner sign-off of this chapter enacts it)

On owner acceptance, this chapter supersedes the following clauses of the 2026-07-16 D1 entry in
`.agents/decisions.md`, and a decision entry will record exactly this list:

1. **Die**: d20 → d100.
2. **Absolutes**: nat 20 / nat 1 → raw 100 / raw 1.
3. **Strict binary everywhere → binary mid-range with GM-decided edge texture.** The marginal and
   critical bands (§1.4) attach GM-chosen complications/extras to some outcomes. This goes beyond a
   die swap and is adopted on the owner's own post-rejection direction (2026-07-16: "2-n% can be
   the margin you were arguing for earlier… 99, probably also a hit, but X happens"). What carries
   forward unchanged from the rider-(b) rejection: the GM **never offers the player a choice of
   outcomes** — the council decides reality, and a resolved band is binding.
4. **Coded no-roll gate → council judgment** (P1). There is no mechanical gate; the council simply
   does not call for dice when nothing is uncertain or at stake.
5. **Model authority expands, disclosed.** D1 allowed models to select a difficulty tier by name
   and nothing else numeric-adjacent. This chapter additionally grants: situational-delta
   identifiers (direction + magnitude + reason, §3), the `tierBasis` statement, the `callSeq`
   protocol ordinal, and edge-band annotation proposals (§1.5). Every **game-mechanical number**
   remains engine-owned: models never emit, see pre-commit, or alter any value that enters game
   arithmetic. The only standalone numeric protocol identifiers are the acting-character id (a
   cross-check the engine independently binds and verifies, §1.2) and the `callSeq` idempotency
   ordinal. Chapter 2 additionally permits typed, engine-issued entity reference tokens inside
   effect selections; they name recorded entities, are validated on resolution, and never enter
   game arithmetic.

Carried forward unchanged from D1: difficulty lives only in the target (no graded difficulty
mechanics in the mid-range); the ladder is code-owned; models never invent numbers; GM latitude on
clean successes and clean failures is descriptive only.

## 0. Design principles

- **P1 — Rules recede.** No check is rolled when the outcome is certain or nothing is at stake.
  This is GM-council judgment, not a coded gate. "The rules should get out of the way when they're
  not needed and be there when they are" (owner, 2026-07-16).
- **P2 — Code owns anchors; AI owns context.** The engine owns every die roll, ladder number,
  arithmetic step, and state transition. The council selects difficulty *tiers* by name and rules
  *situational deltas* as enumerated identifiers with stated reasons. Models never emit free
  numbers, never perform arithmetic, never roll.
- **P3 — Binary middle.** In the mid-range of the die, a check either succeeds or fails — the
  council decides reality and never offers the player an alternate one. Narrative latitude on clean
  bands is descriptive only.
- **P4 — Drama at the edges, and only at the edges.** Raw 100 always succeeds; raw 1 always fails;
  rolls landing within the margin band around the target carry outcome texture. Deliberately, this
  is rare: near a mid-range target, texture bands cover ~5% of rolls on each side (~12% of all
  rolls including the floors). The mid-range — the vast majority of play — stays pure binary. The
  band width `N` is the single tuning knob if playtests want more or less edge drama.
- **P5 — Everything is logged.** Every check writes one complete, immutable, table-public ledger
  record before narration sees it. Narration describes recorded fact; it never negotiates one.

## 1. The check

A **check** resolves one uncertain, consequential action by the current turn's acting character.

1. **Call (Referee seat).** The Referee decides a check is warranted (P1) and emits, as structured
   identifiers: the acting character id (cross-check only — see step 2), the intent (one line of
   text), the **difficulty tier** (enum, §2), a **tierBasis** (≤120 chars: the ordinary-conditions
   basis for that tier choice, §3), zero to three **situational deltas** (enum + reason, §3), and a
   **callSeq** — a protocol ordinal (1, 2, 3, …) unique within this turn's adjudication, used only
   for idempotency and never in game arithmetic.
2. **Validation (engine + Continuity, all before any roll).**
   - The engine **binds the actor**: the check resolves for the engine-known acting character of
     the current turn; a call whose actor field names anyone else is rejected. Models cannot select
     whose competence applies.
   - The engine validates structure: unknown tier, malformed delta, duplicate delta reasons, more
     than three deltas, or missing tierBasis/callSeq → the call is rejected back to the Referee.
   - **Idempotency**: the logical key `(turn, actor, callSeq)` maps to at most one check, forever.
     If the key already has a committed record, the engine returns that record — a retried or
     replayed call can never produce a second roll.
   - **Continuity pre-roll check (every call)**: Continuity validates the `tierBasis` on every
     call — a basis that bakes in a transient circumstance is rejected (those belong in deltas).
     When deltas are present it additionally verifies each delta's reason against the established
     record, enforces the one-fact-one-home rule (§3), and rejects **semantic** duplicates: two
     deltas citing the same underlying fact under different wordings count as one fact. Any
     rejection bounces the whole call back to the Referee — nothing has been rolled or committed,
     so revision is clean.
3. **Assembly and roll (engine, atomic).** The engine computes the target:

   `netDelta = clamp(Σ delta values, −20, +20)`
   `T = clamp(TierTarget − SkillBonus + netDelta, 2, 99)`

   with `TierTarget` from the code-owned ladder (§2) and `SkillBonus` an integer 0–75 from the
   bound actor's sheet (derivation is D4 scope; the [0, 75] bound is this chapter's contract). All
   arithmetic is integer; nothing rounds. The engine then rolls one d100 (uniform integer 1–100,
   engine RNG) and commits the core ledger record (§5) in the same atomic step, keyed by a fresh
   `checkId` (UUID) registered to the logical key. Models never roll and never see the number
   before it is committed.
4. **Outcome bands (engine-computed, binding on narration).** With `N = 5` (code-owned tuning
   constant), evaluated **in this order** — the ordered evaluator is normative:

   | Order | Condition | Band token | Meaning |
   |---|---|---|---|
   | 1 | raw = 100 | `crit_success` | The intent succeeds cleanly. The GM may add the best plausible boon within the stakes license (§1.5); flavor-only is always legal. |
   | 2 | raw = 1 | `crit_failure` | The intent fails. The GM may attach a complication within the stakes license (§1.5); flavor-only is always legal. |
   | 3 | raw ≥ T and raw − T ≤ N−1 | `marginal_success` | The intent **succeeds**. The GM may attach a complication X within the stakes license (§1.5); X may cost, expose, or entangle, and must never negate the success. |
   | 4 | raw ≥ T | `clean_success` | The intent succeeds; narrate to fit. |
   | 5 | T − raw ≤ N | `marginal_failure` | The intent **fails** — a near-miss. The GM may attach a complication within the stakes license (§1.5); no partial achievement of the goal. |
   | 6 | otherwise | `clean_failure` | The intent fails; narrate to fit. |

   In the mid-range this yields five faces of texture on each side of T: `marginal_success` on
   [T, T+4], `marginal_failure` on [T−5, T−1] — symmetric by face count, stated plainly because an
   inclusive ±N on both sides would not be. **At the clamps the critical rules consume marginal
   faces and the symmetry deliberately breaks**: at T = 2, rule 2 takes raw 1, leaving zero
   marginal-failure faces; at T = 99, rule 1 takes raw 100, leaving one marginal-success face.
   Probability tests must follow the ordered evaluator, not the mid-range shape.
5. **Annotation (edge bands only; validated, atomic, one-shot).** For `crit_success`,
   `crit_failure`, `marginal_success`, and `marginal_failure`, the Referee proposes the
   extra/complication as a structured **annotation**: `{ text, effects }`. Continuity validates it
   and alone supplies `affirmedOpposed`, the typed NPC refs it affirms as presently opposed; a
   Referee proposal carrying that field rejects. Validation covers established fiction, the
   non-negation rule (an annotation on a success cannot remove,
   undo, or conditionalize the succeeded intent; on a failure it cannot grant the goal), and
   **text–effect coherence, in both directions**: every `effects` entry must be the mechanical
   expression of the annotation's `text`, and every mechanical consequence the text asserts — a
   resource lost, harm taken, an NPC's disposition changed, an encounter begun, anything with
   state weight — must have its matching `effects` entry. An effect the text does not describe is
   rejected; so is text that narrates an unledgered mechanical event. Flavor-only annotations
   remain legal precisely because flavor means mechanically inert color ("the picks slip once,
   loudly" passes; "the pick snaps and is lost" requires the inventory effect or must be
   reworded); under a `flavor_only` license the text may assert no mechanical consequence at all.
   - **On rejection**: the Referee may revise **once**. If the revision is also rejected, the
     engine commits `annotation: null` with the rejection reason in `annotationRejected`, and
     narration proceeds on the bare band — the band's mechanical meaning stands, and **no
     complication may be narrated at all**: a complication that is not ledgered does not exist,
     and narration must never canonize a snapped pick whose mechanical effect never happened. An
     edge-band check therefore never stalls and never reaches narration in an undefined state.
   - **Engine validation of effects (after Continuity, before any commit or execution)**: the
     engine validates every `effects` entry — D2 catalog membership; quantity legality per the
     catalog's fixed/tiered definitions; **band-valence legality** (every catalog operation
     carries an engine-checkable valence tag, `beneficial`, `adverse`, or `neutral`; `neutral` is
     illegal for edge-band authorization, `crit_success` admits only `beneficial` effects, and the
     other three edge bands admit only `adverse` effects);
     and the **summed effect-point cost within the license budget** (see the executable contract
     below). An annotation failing engine validation counts against the same single-revision
     allowance as a Continuity rejection; two failures of any mix commit the null annotation.
     Nothing executes before validation passes.
   - **Atomicity and idempotency**: the annotation append is **one transaction**, committed at
     most once per `checkId`; a retry returns the committed result.
   - **Complication effects are mechanical — executed exclusively through the D2 effect catalog.**
     Complications carry real state consequences by design (owner ruling, 2026-07-16): a snapped
     pick reduces the pick count by one; a spilled drink angers the patron and can start an
     encounter; a glancing blow deals reduced damage. What models supply remains identifiers only:
     each `effects` entry is a D2 catalog selection — an operation token whose quantities are fixed
     or tiered and engine-owned — never a model-chosen number. The owner-signed Chapter 2 catalog is
     the canonical vocabulary: no implementation may ship annotations whose complications lack
     their mechanical weight, and none may execute effects outside the catalog. Effects may never
     modify a check's outcome fields. The annotation text is additionally binding narrative canon
     for narration and every later continuity check.
   - **Discretion is licensed, never required, and always ledgered (playtest-tunable).** A band
     *licenses* a complication; it never mandates one — flavor-only is always a legal ruling, the
     way a human GM lets a near-miss ride when the moment is light. How hard a complication may
     bite is capped by an engine-computed **stakes license** derived from engine-known context
     (active-encounter state, the check's tier, and whether the band is critical or marginal),
     which maps to a maximum effect weight from the D2 catalog (the weight classes are D2 scope).
     The Referee chooses *within* the license and may always choose less; it can never reach above
     it. The license width — from flavor-only to fully open — is **code-owned config, explicitly
     playtest-tunable in both directions**; the shipped default is a playtest question, not a
     design commitment. Every edge-band ruling is ledgered together with the license it was made
     under (`stakesLicense`, §5), so the model's discretion is auditable after real play: widen it
     if it rules like a GM, tighten it if it rules like a slot machine — by config, not redesign.
     **Executable contract**: license tokens are the ordered enum `flavor_only` < `minor` <
     `significant` (names provisional; `flavor_only` permits no effects). Shipped default mapping,
     code-owned config: the base license is `flavor_only` when no encounter is active and `minor`
     during an active encounter; a critical band raises it one step; tier `extreme` or `legendary`
     raises it one step; capped at `significant`. Aggregation over the `effects` array is by
     engine-owned points: a `minor`-class effect costs 1 and a `significant`-class effect costs 2;
     the license grants a budget (`flavor_only` = 0, `minor` = 1, `significant` = 2) and the summed
     cost must not exceed it — a `minor` license admits exactly one minor effect; a `significant`
     license admits one significant or two minors. The owner-signed Chapter 2 catalog defines
     which operations are `minor` versus `significant`, their per-operation point costs, and each
     operation's valence tag; validation reads them from the campaign's pinned catalog version.
   The check's outcome fields (`T`, `raw`, `band`, and everything in §5 except the one-time
   annotation transaction) are immutable from the moment of commit.
6. **Narrate.** Narration receives the completed record and describes it. The band is binding:
   prose may color an outcome, never convert it (P3, P5).

**Fork resolution (recorded):** the margin band is measured **from the modified target**, not from
raw die values. Rationale: the owner's rain example — a delta can slide a roll between bands —
requires modifiers to interact with texture, which fixed raw-value crit ranges (GURPS 3–4 / 17–18
style) cannot do. The rejected alternative is noted for the record.

## 2. The difficulty ladder (code-owned)

The council chooses a tier **by name**; the engine supplies the number. Models never emit numeric
targets.

| Tier token | TierTarget | Intended use |
|---|---|---|
| `trivial` | 10 | Rarely rolled at all (P1) — called only when a complication would still matter. |
| `easy` | 25 | Low intrinsic complexity. |
| `standard` | 50 | The default contested-world action. |
| `hard` | 75 | Skilled opposition or real intrinsic complexity. |
| `extreme` | 90 | Feats at the edge of mortal competence. |
| `legendary` | 98 | The stuff of campaign legend. |

**Calibration note (honest, unresolved by design).** These values and their uneven gaps
(15/25/25/15/8) are **provisional config**, to be recalibrated jointly with the D4 SkillBonus
progression under D8 (opposition curve). Two consequences the numbers already imply at the declared
SkillBonus top of **75**, acknowledged rather than hidden: (a) top-end competence collapses every
tier through `hard` to the T = 2 clamp (75 − 75 = 0 → 2) — largely intended, since P1 says most
such checks should not be called at all; (b) at the top of the range even `legendary` sits at
T = 98 − 75 = 23, a **78%** success rate (and `extreme` at T = 15, 86%). Whether (b) is desirable
is a D8 tuning decision; the tier *grammar* in this chapter does not depend on the final values.

## 3. Situational deltas (GM-ruled identifiers, engine-owned numbers)

Contextual judgment is why the GM is an AI at all (owner, 2026-07-16) — but per the D0/intake
invariant, models emit **validated identifiers, never game-mechanical numbers**. Both hold:

- A delta is `{ direction, magnitude, reason }`: `direction` ∈ {`favors`, `hinders`};
  `magnitude` ∈ {`slight`, `moderate`, `major`}; `reason` is a string (≤120 chars) naming an
  established fictional fact ("driving rain", "target distracted").
- The **engine** maps magnitudes to numbers — `slight` = 3, `moderate` = 7, `major` = 12
  (code-owned config) — signs them by direction, sums, and clamps the net to ±20 (§1.3).
- Hard limits, engine-enforced: at most **3** deltas per check; duplicate or empty reasons
  rejected; a rejected delta rejects the whole call back to the Referee (no silent dropping).
- **One fact, one home (anti-double-counting, semantic).** The tier prices the task's *intrinsic*
  difficulty under the ordinary conditions stated in `tierBasis`; every departure from those
  conditions enters the check **only** as a delta. One underlying fact may be counted once,
  anywhere: Continuity's pre-roll check (§1.2) rejects a delta whose fact is already part of the
  stated tierBasis, rejects a tierBasis that bakes in a transient circumstance, and rejects a
  second delta that cites the same underlying fact under different wording ("driving rain" /
  "heavy rainfall" are one fact). The rule is semantic, not string-matching.
- All delta and tierBasis validation happens **before the roll** (§1.2), on every call; no
  invented or double-counted circumstance can reach a committed record.
- Deltas are GM rulings, not negotiations (2026-06-11 GM-authority decision). Character competence
  (SkillBonus) is sheet state applied by the engine — never expressed as a delta.

**Flag for owner sign-off:** your brainstorm example was a free "+3%". This chapter deliberately
trades free integers for the three named magnitudes to preserve the intake's enums-only invariant —
the GM still rules "the rain hinders you slightly"; the engine owns that "slightly" means 3. Veto
this trade and the invariant needs an explicit superseding decision.

## 4. Contested actions

One check, one roller: the acting character rolls against a target that already folds in the
opposition (tier chosen against the opposing character's or creature's authored difficulty — the D8
curve, pending). No opposed-roll exchanges and no reaction rolls in v1: no resolution step ever
blocks on a second player's response. Player-versus-player actions additionally require the consent
machinery tracked as intake F3/D11 scope — out of scope for this chapter.

## 5. The roll ledger (engine-owned, table-public, immutable)

Every check appends exactly one record; field types are the contract:

| Field | Type / domain |
|---|---|
| `checkId` | UUID v4, engine-generated, registered to the logical key below |
| `turn` | integer — the committed turn number the check belongs to |
| `actor` | integer — character id, engine-bound to the turn's acting character (§1.2) |
| `callSeq` | integer ≥ 1 — Referee-emitted protocol ordinal; `(turn, actor, callSeq)` is the idempotency key; never used in game arithmetic |
| `intent` | string ≤200 |
| `tier` | tier token (§2 enum) |
| `tierBasis` | string ≤120 — ordinary-conditions basis for the tier choice (§3) |
| `tierTarget` | integer (from config at roll time) |
| `skillBonus` | integer 0–75 |
| `deltas` | array (≤3) of `{direction, magnitude, value, reason}` — `value` is the engine-stamped signed integer |
| `netDelta` | integer, −20…+20 |
| `T` | integer 2–99 |
| `raw` | integer 1–100 |
| `sides` | literal `100` (roll-record contract, intake F7) |
| `band` | band token (§1.4 enum) |
| `annotation` | `{text: string ≤300, effects: [...], affirmedOpposed: [typed NPC refs...]}` or `null` — the Referee proposes only `{text, effects}`; Continuity alone emits `affirmedOpposed`; every effect is a Chapter 2 catalog selection, with engine-stamped resolved metadata and no model-chosen quantities (§1.5); one atomic transaction, edge bands only |
| `annotationRejected` | string ≤200 or `null` — set when both annotation proposals failed validation (§1.5) |
| `stakesLicense` | license token, engine-computed from encounter state + tier + band (§1.5) — recorded on edge-band checks, `null` otherwise |
| `timestamp` | ISO-8601 UTC, engine clock, stamped at commit |

Commit of everything except the annotation transaction is atomic with the roll (§1.3). Players see
the honest arithmetic ("rolled 82, needed 65"). Narration consumes the record; nothing downstream
may rewrite it. **Handoff order, fixed**: Referee call → engine structural validation + actor
binding + idempotency check → Continuity pre-roll validation (every call) → engine assemble + roll
+ atomic commit → (edge bands) Referee annotation proposal → Continuity annotation validation (one
revision allowed across both validators) → engine effects validation (catalog membership,
quantities, band valence, point cost ≤ license budget) → engine atomic annotation append +
catalog-effect execution (or null-annotation commit with `annotationRejected`) → Narration.

## 6. What models may and may not do

**May:** call for a check (P1 judgment); name a tier token with its tierBasis; rule deltas as
direction + magnitude + reason identifiers; emit the protocol identifiers (actor-id cross-check, callSeq ordinal); propose edge-band
annotations (text plus D2 catalog effect selections, within the stakes license — or nothing but
flavor); narrate the computed band; describe success and failure to fit the situation.
**May not:** roll dice; emit, invent, or alter any game-mechanical number (targets, bonuses, delta
values, results — the only standalone model-emitted numeric protocol identifiers are actor id and
callSeq; Chapter 2 typed entity reference tokens are identifiers, not arithmetic); apply arithmetic;
select whose competence a check uses (the engine binds the
actor); count one underlying fact in more than one place (tierBasis and deltas combined); request
a second roll for a resolved logical key; upgrade, downgrade, or conditionalize a band in prose;
attach effects outside the D2 catalog, beyond the stakes license, or with model-chosen
quantities; assert a mechanical consequence in annotation text or narration without its matching
ledgered effect; offer the player an alternate outcome for a resolved check.

## 7. Explicit non-scope (tracked elsewhere)

Value derivation for damage/effects (**D1b**); implementation of the owner-signed Chapter 2 effect
catalog (the design contract is settled; runtime work belongs in the eventual phase plan);
archetypes (**D3**); attributes and SkillBonus derivation
(**D4**); spend economy (**D5**); zones/tactical space (**D6**); initiative (**D7**); the
opposition curve and final ladder values (**D8**); dying/death (**D9**); recovery (**D10**);
mid-resolution choices (**D11**); the parked lantern-holder character's rules treatment (intake
addition, 2026-07-16).

## 8. Worked examples (verified against §1.4's ordered evaluator)

- **Master thief, mundane lock, no pressure.** No check (P1). Narrated success; no ledger entry.
- **Level-1 fighter swings at a dragon.** `legendary` (98), SkillBonus 5, no deltas → T = 93.
  Raw 100: `crit_success` — a clean, storied hit. Raw 96: `marginal_success` (96−93 = 3 ≤ 4) — the
  blade bites, but the tail sweep catches the shield arm. Raw 98: `clean_success` (98−93 = 5 — just
  past the margin). Raw 90: `marginal_failure` (93−90 = 3 ≤ 5) — sparks off a scale, the crowd
  gasps; still a miss. Raw 40: `clean_failure`.
- **The rain matters.** Rooftop lockwork: `standard` (50, tierBasis "ordinary interior lock, no
  time pressure"), SkillBonus 30 → T = 20 dry. Referee rules `{hinders, slight, "driving rain"}` →
  netDelta +3 → T = 23. Raw 25: `marginal_success` (25−23 = 2 ≤ 4) — it opens as the picks slip
  once, loudly. Dry, the same raw 25 is a `clean_success` (25−20 = 5). Raw 21: dry
  `marginal_success` (1 ≤ 4); in rain `marginal_failure` (23−21 = 2 ≤ 5). Texture follows the
  modified target. The rain may not also justify choosing `hard`, nor appear twice as "driving
  rain" and "heavy rainfall" — one fact, one home (§3).
- **Certain-but-consequential.** Master climber (SkillBonus 60) on an `easy` face (25): raw
  T = 25 − 60 = −35, clamps to 2. The council still called the check because a storm makes a
  stumble costly. Raw 1: `crit_failure` — the 1% catastrophe (at this clamp there are no
  marginal-failure faces; rule 2 consumed raw 1, exactly as §1.4 states). Raw 2–6:
  `marginal_success` (raw−2 ≤ 4). Raw 7–99: `clean_success`. Raw 100: `crit_success`. Failure is
  nearly impossible — exactly 1% — and the game still gets its drama at the edge.


