# Aetheria House Ruleset — Chapter 1: Resolution

**Status**: DRAFT r1 — pending codex + grok review loops (owner directive 2026-07-16), then owner
sign-off. On acceptance, a decision entry supersedes the die-specific clauses of the 2026-07-16 D1
entry (`.agents/decisions.md`); D1's die-agnostic core (binary outcomes in the mid-range, DC-only
difficulty, code-owned ladder, descriptive-only GM latitude) carries forward unchanged.
**Provenance**: D0 (2026-07-12, fixed house chassis + flavor skins); D1 (2026-07-16, as amended);
owner brainstorm adopted for drafting 2026-07-16 (`.agents/review/dice-bakeoff.md`, addenda 3–4).
**Review trail**: `.agents/review/resolution-ruleset-review.md`.

## 0. Design principles

- **P1 — Rules recede.** No check is rolled when the outcome is certain or nothing is at stake.
  This is GM-council judgment, not a coded gate: the council simply does not call for dice when
  rules are not needed. "The rules should get out of the way when they're not needed and be there
  when they are" (owner, 2026-07-16).
- **P2 — Code owns anchors; AI owns context.** The engine owns every die roll, ladder number,
  arithmetic step, and state transition. The GM council selects difficulty *tiers* by name and
  rules *situational deltas* with stated reasons. Models never invent base numbers, never perform
  arithmetic, never roll.
- **P3 — Binary middle.** In the mid-range of the die, a check either succeeds or fails — the GM
  council decides reality and never offers the player an alternate one. Narrative latitude is
  descriptive only.
- **P4 — Drama at the edges.** Raw 100 always succeeds; raw 1 always fails; rolls that land within
  the margin band around the target carry outcome texture. Extremes are where "but X happens" lives.
- **P5 — Everything is logged.** Every check writes a complete, table-public ledger record. The
  narration describes an immutable recorded fact; it never negotiates one.

## 1. The check

A **check** resolves one uncertain, consequential action by one acting character.

1. **Call.** The GM council (Referee seat) decides a check is warranted (P1) and names:
   the acting character, the intent (one line), the **difficulty tier** (by name, from §2),
   and any **situational deltas** (from §3).
2. **Assembly (engine).** The engine computes the **target number T**:

   `T = TierTarget − SkillBonus + Σ(situational deltas)`, clamped to **[2, 99]**.

   - `TierTarget` comes from the code-owned ladder (§2).
   - `SkillBonus` is the acting character's relevant competence in percentage points (§6 pointer —
     its derivation is D4/advancement scope, not this chapter's).
   - Deltas are signed integers; positive = harder (raises T), negative = easier.
   - The clamp is structural: T ≤ 99 means a raw 99–100 can always succeed; T ≥ 2 means a raw 1
     always fails and a raw 2 can always succeed when competence towers over the task.
3. **Roll (engine).** The engine rolls one d100 (uniform integer 1–100, engine RNG). Models never
   roll and never see the number before it is committed to the ledger.
4. **Outcome (engine-computed band, binding on narration):**

   | Condition | Band | Meaning |
   |---|---|---|
   | raw = 100 | **Critical success** | The intent succeeds cleanly, plus the best plausible extra the fiction supports. |
   | raw = 1 | **Critical failure** | The intent fails, plus a GM-chosen complication. |
   | raw ≥ T and raw − T ≤ N | **Marginal success** | The intent *succeeds* — and a GM-chosen complication X also happens. X may cost, expose, or entangle; it must never negate the success. |
   | raw ≥ T otherwise | **Clean success** | The intent succeeds; narrate to fit. |
   | raw < T and T − raw ≤ N | **Marginal failure** | The intent *fails*; the GM narrates a near-miss. No partial achievement of the goal. |
   | raw < T otherwise | **Clean failure** | The intent fails; narrate to fit. |

   **N = 5** (provisional tuning constant, code-owned). Critical bands take precedence over
   marginal bands; the marginal-success test uses the clamped T.
5. **Narrate.** Narration receives the band and the ledger record and describes it. The band is
   binding: prose may color an outcome, never convert it (P3, P5).

**Fork resolution (recorded):** the margin band is measured **from the modified target**, not from
raw die values. Rationale: the owner's rain example — a +3 delta can slide a raw 99 between bands —
requires modifiers to interact with texture, which raw-value tails cannot do. The rejected
alternative (fixed crit ranges à la GURPS 3–4/17–18) is noted for the record.

## 2. The difficulty ladder (code-owned)

The council chooses a tier **by name**; the engine supplies the number. Models never emit numeric
targets. Values are **provisional** pending the D8 opposition-curve and D1b work; they are config,
not prose.

| Tier | TierTarget | Intended use |
|---|---|---|
| Trivial | 10 | Rarely rolled at all (P1) — called only when a complication would still matter. |
| Easy | 25 | Favorable conditions, low complexity. |
| Standard | 50 | The default contested-world action. |
| Hard | 75 | Skilled opposition, poor conditions, real complexity. |
| Extreme | 90 | Feats at the edge of mortal competence. |
| Legendary | 98 | The stuff of campaign legend; success is a story beat by itself. |

## 3. Situational deltas (GM-owned, engine-clamped)

Contextual judgment is why the GM is an AI at all (owner, 2026-07-16). The Referee seat may attach
deltas to any check:

- Each delta is a signed whole-number percentage with a **named justification tied to established
  fiction** ("raining: +3", "target distracted: −5"). Unjustified deltas are invalid; the engine
  rejects a delta without a reason string.
- Guideline magnitude ±1 to ±15 per cause; the engine enforces only the final clamp on T (§1.2).
- Deltas are GM rulings, not negotiations. Players may argue in fiction (table talk); the council
  rules; the GM's decision is final (2026-06-11 GM-authority decision).
- Character competence (SkillBonus) is sheet state applied by the engine — never expressed as a
  delta.

## 4. Contested actions

One check, one roller: the acting character rolls against a target that already folds in the
opposition (tier chosen against the opposing character's or creature's authored difficulty — the
D8 curve, pending). There are no opposed-roll exchanges and no reaction rolls in v1: no resolution
step ever blocks on a second player's response. Player-versus-player actions additionally require
the consent machinery tracked as intake F3/D11 scope — out of scope for this chapter.

## 5. The roll ledger (engine-owned, table-public)

Every check appends one immutable record:

`{ turn, actor, intent, tier, tierTarget, skillBonus, deltas: [{value, reason}], T, raw, band, timestamp }`

Players see the honest arithmetic ("rolled 82, needed 65"). The roll-record die size is `sides:
100` (intake F7 contract). Narration consumes the record; nothing downstream may rewrite it.

## 6. What models may and may not do

**May:** call for a check (P1 judgment); name a tier; rule justified deltas; narrate the computed
band; describe success and failure to fit the situation.
**May not:** roll dice; invent, alter, or emit numeric targets or results; apply arithmetic;
re-roll; upgrade or downgrade a band in prose; offer the player an alternate outcome for a
resolved check.

## 7. Explicit non-scope (tracked elsewhere)

Value derivation for damage/effects (**D1b**); the effect catalog (**D2**); archetypes (**D3**);
attributes and where SkillBonus comes from (**D4**); spend economy (**D5**); zones/tactical space
(**D6**); initiative (**D7**); the opposition curve that finalizes §2's numbers (**D8**);
dying/death (**D9**); recovery (**D10**); mid-resolution choices (**D11**); the parked
lantern-holder character's rules treatment (intake addition, 2026-07-16).

## 8. Worked examples

- **Master thief, mundane lock, no pressure.** No check (P1). Narrated success; no ledger entry.
- **Level-1 fighter swings at a dragon.** Tier Legendary (98), SkillBonus +5 → T = 93. Raw 100:
  critical success — a clean, storied hit. Raw 96: marginal success — the blade bites, but X
  happens (the dragon's tail sweep catches the shield arm). Raw 90: marginal failure — sparks off
  a scale, so close the crowd gasps; still a miss. Raw 40: clean failure.
- **The rain matters.** Rooftop lockwork: tier Standard (50), SkillBonus 30 → T = 20; Referee
  rules "driving rain: +3" → T = 23. Raw 25: marginal success (25 − 23 ≤ 5) — the lock opens as
  the picks slip once, loudly. Without the rain delta the same raw 25 would also have succeeded
  marginally (25 − 20 = 5); a raw 21 flips from marginal success (dry) to marginal failure (rain).
  Texture follows the modified target, which is the point.
- **Certain-but-consequential.** Master climber (+60) on an Easy face (25): T clamps to 2. The
  council still called the check because a storm makes a stumble costly: raw 1 is the only failure
  (critical), raw 2–6 succeed with texture, raw 7+ clean. Failure is nearly impossible — 1% — and
  the game still gets its drama at the edge.
