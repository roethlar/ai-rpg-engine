# Aetheria House Ruleset — Chapter 1: Resolution

**Status**: DRAFT r2 — r1 was REOPENED by both reviewers (codex 7 findings, grok 6; trail:
`.agents/review/resolution-ruleset-review.md`); this revision addresses all of them. Pending codex +
grok re-review, then owner sign-off.
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

A **check** resolves one uncertain, consequential action by one acting character.

1. **Call (Referee seat).** The Referee decides a check is warranted (P1) and emits, as structured
   identifiers: the acting character id, the intent (one line of text), the **difficulty tier**
   (enum, §2), and zero to three **situational deltas** (enum + reason, §3). The engine assigns a
   fresh `checkId` (UUID).
2. **Assembly (engine).** The engine validates the call (unknown tier, malformed delta, duplicate
   delta reasons, or more than three deltas → the call is rejected back to the Referee) and
   computes the **target number T**:

   `netDelta = clamp(Σ delta values, −20, +20)`
   `T = clamp(TierTarget − SkillBonus + netDelta, 2, 99)`

   - `TierTarget`: code-owned ladder value (§2).
   - `SkillBonus`: integer 0–75 from the acting character's sheet (its derivation is D4 scope; the
     [0, 75] bound is this chapter's contract). All arithmetic is integer; nothing rounds.
   - The clamp is structural: T ≤ 99 keeps raw 99–100 always sufficient; T ≥ 2 keeps raw 1 the
     only guaranteed failure when competence towers over the task.
3. **Roll (engine, atomic, idempotent).** The engine rolls one d100 (uniform integer 1–100, engine
   RNG) and commits the core ledger record (§5) in the same atomic step. Exactly one roll may ever
   exist per `checkId`: a retry of the same call returns the already-committed record; nothing can
   request a second roll for a resolved check. Models never roll and never see the number before it
   is committed.
4. **Outcome bands (engine-computed, binding on narration).** With `N = 5` (code-owned tuning
   constant), evaluated in this order:

   | Order | Condition | Band token | Meaning |
   |---|---|---|---|
   | 1 | raw = 100 | `crit_success` | The intent succeeds cleanly, plus the best plausible extra the fiction supports. |
   | 2 | raw = 1 | `crit_failure` | The intent fails, plus a GM-chosen complication. |
   | 3 | raw ≥ T and raw − T ≤ N−1 | `marginal_success` | The intent **succeeds** — and a GM-chosen complication X also happens. X may cost, expose, or entangle; it must never negate the success. |
   | 4 | raw ≥ T | `clean_success` | The intent succeeds; narrate to fit. |
   | 5 | T − raw ≤ N | `marginal_failure` | The intent **fails**; the GM narrates a near-miss. No partial achievement of the goal. |
   | 6 | otherwise | `clean_failure` | The intent fails; narrate to fit. |

   The bands are symmetric by face count: `marginal_success` covers the five faces [T, T+4] (minus
   any claimed by rule 1) and `marginal_failure` the five faces [T−5, T−1] (minus any claimed by
   rule 2). Stated plainly because an inclusive ±N on both sides would be asymmetric (N+1 vs N
   faces) — it is not.
5. **Annotation (edge bands only; validated, one-shot).** For `crit_success`, `crit_failure`,
   `marginal_success`, and `marginal_failure`, the Referee proposes the extra/complication as a
   structured **annotation**: `{ text, effects[] }`. Continuity validates it against established
   fiction and the non-negation rule (an annotation on a success cannot remove, undo, or
   conditionalize the succeeded intent; on a failure it cannot grant the goal). The engine appends
   the validated annotation to the record **once**, before narration. Annotation `effects` are
   executed only through the engine's existing validated state-change operations (until the D2
   effect catalog lands, that existing validation surface is the entire legal effect vocabulary).
   The check's outcome fields (`T`, `raw`, `band`, and everything in §5 except the one-time
   `annotation` append) are immutable from the moment of commit.
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
| `easy` | 25 | Favorable conditions, low complexity. |
| `standard` | 50 | The default contested-world action. |
| `hard` | 75 | Skilled opposition, poor conditions, real complexity. |
| `extreme` | 90 | Feats at the edge of mortal competence. |
| `legendary` | 98 | The stuff of campaign legend. |

**Calibration note (honest, unresolved by design).** These values and their uneven gaps
(15/25/25/15/8) are **provisional config**, to be recalibrated jointly with the D4 SkillBonus
progression under D8 (opposition curve). Two consequences the numbers already imply, acknowledged
rather than hidden: (a) high competence collapses low tiers into the T=2 clamp — a +60 character
auto-dominates `trivial` through `standard` — which is intended (P1: such checks mostly should not
be called at all); (b) at the top of the SkillBonus range, `legendary` checks succeed more often
than the name suggests (+60 → T = 38 → 62%). Whether (b) is desirable is a D8 tuning decision;
the tier *grammar* in this chapter does not depend on the final values.

## 3. Situational deltas (GM-ruled identifiers, engine-owned numbers)

Contextual judgment is why the GM is an AI at all (owner, 2026-07-16) — but per the D0/intake
invariant, models emit **validated identifiers, never numbers**. Both hold:

- A delta is `{ direction, magnitude, reason }`: `direction` ∈ {`favors`, `hinders`};
  `magnitude` ∈ {`slight`, `moderate`, `major`}; `reason` is a string (≤120 chars) naming an
  established fictional fact ("driving rain", "target distracted").
- The **engine** maps magnitudes to numbers — `slight` = 3, `moderate` = 7, `major` = 12
  (code-owned config) — signs them by direction, sums, and clamps the net to ±20 (§1.2).
- Hard limits, engine-enforced: at most **3** deltas per check; duplicate or empty reasons rejected;
  a rejected delta rejects the whole call back to the Referee (no silent dropping).
- Continuity's final check covers delta reasons: a reason that names a fact not in the record is a
  continuity failure, same as any other invented canon.
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
| `checkId` | UUID v4, engine-generated, unique per check |
| `turn` | integer — the committed turn number the check belongs to |
| `actor` | integer — character id |
| `intent` | string ≤200 |
| `tier` | tier token (§2 enum) |
| `tierTarget` | integer (from config at roll time) |
| `skillBonus` | integer 0–75 |
| `deltas` | array (≤3) of `{direction, magnitude, value, reason}` — `value` is the engine-stamped signed integer |
| `netDelta` | integer, −20…+20 |
| `T` | integer 2–99 |
| `raw` | integer 1–100 |
| `sides` | literal `100` (roll-record contract, intake F7) |
| `band` | band token (§1.4 enum) |
| `annotation` | `{text: string ≤300, effects: [...]}` or `null` — appended once per §1.5, edge bands only |
| `timestamp` | ISO-8601 UTC, engine clock, stamped at commit |

Commit of everything except `annotation` is atomic with the roll (§1.3). Players see the honest
arithmetic ("rolled 82, needed 65"). Narration consumes the record; nothing downstream may rewrite
it. Handoff order, fixed: Referee call → engine assemble+roll+commit → Referee annotation proposal
(edge bands) → Continuity validation → engine annotation append → Narration.

## 6. What models may and may not do

**May:** call for a check (P1 judgment); name a tier token; rule deltas as
direction+magnitude+reason identifiers; propose edge-band annotations; narrate the computed band;
describe success and failure to fit the situation.
**May not:** roll dice; emit, invent, or alter any number (targets, bonuses, delta values,
results); apply arithmetic; request a second roll for a resolved `checkId`; upgrade, downgrade, or
conditionalize a band in prose; attach state effects outside the validated annotation path; offer
the player an alternate outcome for a resolved check.

## 7. Explicit non-scope (tracked elsewhere)

Value derivation for damage/effects (**D1b**); the effect catalog (**D2**); archetypes (**D3**);
attributes and SkillBonus derivation (**D4**); spend economy (**D5**); zones/tactical space
(**D6**); initiative (**D7**); the opposition curve and final ladder values (**D8**); dying/death
(**D9**); recovery (**D10**); mid-resolution choices (**D11**); the parked lantern-holder
character's rules treatment (intake addition, 2026-07-16).

## 8. Worked examples (recomputed for the r2 band boundaries)

- **Master thief, mundane lock, no pressure.** No check (P1). Narrated success; no ledger entry.
- **Level-1 fighter swings at a dragon.** `legendary` (98), SkillBonus 5, no deltas → T = 93.
  Raw 100: `crit_success` — a clean, storied hit. Raw 96: `marginal_success` (96−93 = 3 ≤ 4) — the
  blade bites, but the tail sweep catches the shield arm. Raw 98: `clean_success` (98−93 = 5 — just
  past the margin). Raw 90: `marginal_failure` (93−90 = 3 ≤ 5) — sparks off a scale, the crowd
  gasps; still a miss. Raw 40: `clean_failure`.
- **The rain matters.** Rooftop lockwork: `standard` (50), SkillBonus 30 → T = 20 dry. Referee
  rules `{hinders, slight, "driving rain"}` → netDelta +3 → T = 23. Raw 25: `marginal_success`
  (25−23 = 2 ≤ 4) — it opens as the picks slip once, loudly. Dry, the same raw 25 is a
  `clean_success` (25−20 = 5). Raw 21: dry `marginal_success` (1 ≤ 4); in rain `marginal_failure`
  (23−21 = 2 ≤ 5). Texture follows the modified target, which is the point.
- **Certain-but-consequential.** Master climber (SkillBonus 60) on an `easy` face (25): raw
  T = 25 − 60 = −35, clamps to 2. The council still called the check because a storm makes a
  stumble costly. Raw 1: `crit_failure` — the 1% catastrophe. Raw 2–6: `marginal_success`
  (raw−2 ≤ 4). Raw 7–99: `clean_success`. Raw 100: `crit_success`. Failure is nearly impossible —
  exactly 1% — and the game still gets its drama at the edge.
