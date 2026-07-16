# Dice bake-off — evidence memo (feeds owner decision D1)

- **Status:** evaluation complete; D1 re-presented to owner with this evidence. No engine code touched.
- **Provenance:** Task #5, owner-approved design. Exact probability math (analytic enumeration, no simulation). Reproducible from the appendix script.
- **Related:** F7 (prove the curve before wiring), F9/D7 (async, no reactions), F6 (learnability), D8 (opposition derivability), D14 (WWN/CWN CC0 reuse), D11 (offer/deadline/default).

## Question

Which resolution spine best fits this engine: async, sequential multiplayer, one roll per turn,
no reactions, AI GM that narrates from engine-computed outcome bands (miss / mixed / clean)?

## Candidates and models

| Spine | Resolution | Bands | Crit / fumble | Level 1→10 advancement | Tier model |
|---|---|---|---|---|---|
| A. d20 margin-band | d20 + mod vs DC | clean = beat DC by 5+; mixed = 0..4; miss = below | nat 20 / nat 1 | mod +2 → +11 (+1/level) | DC 10/14/18/22 |
| B. 2d6 PbtA-band | 2d6 + mod | 10+ clean / 7–9 mixed / 6- miss (thresholds shift per tier) | nat 12 / nat 2 | mod +0 → +4 (every 2nd level) | shift -2/0/+2/+4 |
| C. d6 pool (Blades) | roll N d6, read highest | 6 clean / 4–5 mixed / 1–3 miss | 2+ sixes / none native | 1d → 6d (every 2nd level) | +1d/0/-1d/-2d |

## Results

### A. Standard tier — outcome bands by level (miss / mixed / clean)

| L | d20 mod | d20 bands | 2d6 mod | 2d6 bands | pool | pool bands |
|---|---|---|---|---|---|---|
| 1 | +2 | 55.0% / 25.0% / 20.0% | +0 | 41.7% / 41.7% / 16.7% | 1d | 50.0% / 33.3% / 16.7% |
| 2 | +3 | 50.0% / 25.0% / 25.0% | +0 | 41.7% / 41.7% / 16.7% | 2d | 25.0% / 44.4% / 30.6% |
| 3 | +4 | 45.0% / 25.0% / 30.0% | +1 | 27.8% / 44.4% / 27.8% | 2d | 25.0% / 44.4% / 30.6% |
| 4 | +5 | 40.0% / 25.0% / 35.0% | +1 | 27.8% / 44.4% / 27.8% | 3d | 12.5% / 45.4% / 42.1% |
| 5 | +6 | 35.0% / 25.0% / 40.0% | +2 | 16.7% / 41.7% / 41.7% | 3d | 12.5% / 45.4% / 42.1% |
| 6 | +7 | 30.0% / 25.0% / 45.0% | +2 | 16.7% / 41.7% / 41.7% | 4d | 6.3% / 42.0% / 51.8% |
| 7 | +8 | 25.0% / 25.0% / 50.0% | +3 | 8.3% / 33.3% / 58.3% | 4d | 6.3% / 42.0% / 51.8% |
| 8 | +9 | 20.0% / 25.0% / 55.0% | +3 | 8.3% / 33.3% / 58.3% | 5d | 3.1% / 37.1% / 59.8% |
| 9 | +10 | 15.0% / 25.0% / 60.0% | +4 | 2.8% / 25.0% / 72.2% | 5d | 3.1% / 37.1% / 59.8% |
| 10 | +11 | 10.0% / 25.0% / 65.0% | +4 | 2.8% / 25.0% / 72.2% | 6d | 1.6% / 31.9% / 66.5% |

### B. Tier spread — success rate (mixed + clean)

| Spine | Level | Easy | Standard | Hard | Extreme |
|---|---|---|---|---|---|
| d20 (DC 10/14/18/22) | 1 | 65.0% | 45.0% | 25.0% | 5.0% |
| d20 (DC 10/14/18/22) | 5 | 85.0% | 65.0% | 45.0% | 25.0% |
| d20 (DC 10/14/18/22) | 10 | 95.0% | 90.0% | 70.0% | 50.0% |
| 2d6 (shift -2/0/+2/+4) | 1 | 83.3% | 58.3% | 27.8% | 8.3% |
| 2d6 (shift -2/0/+2/+4) | 5 | 97.2% | 83.3% | 58.3% | 27.8% |
| 2d6 (shift -2/0/+2/+4) | 10 | 97.2% | 97.2% | 83.3% | 58.3% |
| pool (+1d/0/-1d/-2d) | 1 | 75.0% | 50.0% | 25.0% | 25.0% |
| pool (+1d/0/-1d/-2d) | 5 | 93.8% | 87.5% | 75.0% | 50.0% |
| pool (+1d/0/-1d/-2d) | 10 | 99.2% | 98.4% | 96.9% | 93.8% |

### C. Derived metrics (Standard tier)

- **d20 margin-band** — success L1→L10: 45.0% → 90.0%; per-level step min/max: 5.0% / 5.0%; band collapse (miss<5% or mixed<15%): none through L10; extreme rate (crit+fumble) L1/L10: 10.0% / 10.0%
- **2d6 PbtA-band** — success L1→L10: 58.3% → 97.2%; per-level step min/max: 0.0% / 13.9%; band collapse: L9; extreme rate L1/L10: 5.6% / 5.6%
- **d6 pool (Blades)** — success L1→L10: 50.0% → 98.4%; per-level step min/max: 0.0% / 25.0%; band collapse: L8; extreme rate L1/L10: 0.0% / 26.3%

## Reading the data

**d20 margin-band.** The margin construction turns d20's weakness into the surprise of the bake-off:
because the clean/mixed boundary moves with the modifier, the mixed band is a *constant 25% at every
level* — the AI GM gets a stable three-band narration texture for an entire 10-level campaign. Failure
never disappears (nat-1 floor + one miss step = 10% at L10), extremes hold constant at 10%, and
advancement is 20 smooth 5% increments — the best progression headroom of the three. Tier spread stays
meaningful at L10 (Extreme tasks: 50%). Opposition math is a linear DC ladder (D8: trivial). WWN/CWN
CC0 attack math is d20-native (D14: direct reuse). Roll-record `sides` contract unchanged (F7).
Cost: it is still a flat curve — per-roll swing is the price of the headroom.

**2d6 PbtA-band.** Best low-level shape (41.7 / 41.7 / 16.7 at L1 is the classic "mixed results drive
story" feel) and the gentlest extremes (5.6%). But the band collapses at L9 (+4): miss falls to 2.8%
and failure effectively exits play. Only five meaningful advancement steps exist (+0..+4), progression
is lumpy (0% or ~14% jumps), and by L10 Easy and Standard tiers are indistinguishable (both 97.2%).
Viable only with a hard cap near +3 — i.e. by abandoning most of a 10-level progression. CC0 d20
material needs conversion; two-die roll records and UI are a moderate cost.

**d6 pool.** Collapses earliest (L8) and hardest: at L10, Extreme-tier tasks succeed 93.8% — difficulty
stops mattering entirely. Early steps are violent (25% jump L1→L2), late steps saturate. "Crit" inflates
from 0% to 26.3%, so extraordinary outcomes become routine. No native fumble, variable-dice UI, worst
CC0 translation, and opposition/tier design has no clean analytic ladder. Eliminated.

## Scorecard

| Criterion | d20 margin-band | 2d6 PbtA-band | d6 pool |
|---|---|---|---|
| Outcome bands (AI GM narration) | **Strong** — constant 25% mixed, all levels | Strong early, collapses L9 | OK early, collapses L8 |
| Competence scaling (F6) | **Strong** — linear 5% steps ×20 | Weak — 5 lumpy steps | Weak — lumpy, saturates |
| Variance vs async pacing (F9) | OK — 10% extremes, mixed band absorbs near-misses | **Strong** — bell, 5.6% | Weak — crit inflation to 26% |
| Opposition derivability (D8) | **Strong** — linear DC ladder | OK — threshold-shift design needed | Weak |
| Roll-record / UI cost (F7) | **Strong** — unchanged | OK — two dice | Weak — variable pool |
| CC0 translation (D14) | **Strong** — d20-native | Weak/OK — conversion required | Weak |

## Recommendation

**Adopt Spine A: d20 with margin-based outcome bands** (clean = beat DC by 5+, mixed = make it by 0–4,
miss = below; nat 20/nat 1 as guaranteed ceiling/floor). This satisfies F7 in the intended sense — d20
is retained on evidence, not inertia — and the evaluation's real contribution is the *margin-band
structure*, which imports the PbtA/Blades property the async design needs (one self-contained roll per
beat, no opposed ping-pong) onto the spine with the best headroom, simplest opposition math, and free
CC0 compatibility.

**Runner-up:** 2d6 with a hard +3 cap, if the owner ever chooses low-level feel over 10-level
progression. **Revisit trigger:** if playtests show d20 swing reads as unfair in async play despite the
mixed band, re-run this memo's math with advantage/disadvantage-style mitigation before switching spines.

## Appendix — reproduction

Throwaway script (also at `/tmp/dice-bakeoff.mjs`, run with `node`): exact enumeration of all die
outcomes per spine per level; definitions exactly as in the Candidates table above. Level mappings:
d20 mod = level+1; 2d6 mod = floor((level-1)/2); pool N = 1+floor(level/2). Band-collapse threshold:
miss < 5% or mixed < 15% at Standard tier.

## Addendum — play-model correction (owner ruling, 2026-07-16)

The owner has **overruled the async-first assumption** this memo (and the rules intake) leaned on.
Ruled play model: **synchronous** — campaigns are played with every character's owner online at once.
Departing players park their character ("holding the lantern"), or hand it to a designated backup or
the GM. Encounters gate on a Ready/Not-Ready check-in from every owner; once underway, a player who
does not respond within N minutes is skipped or their character is played by GM/backup. This is the
owner's stated end-state vision.

Effects on this memo: the "variance vs async pacing" criterion was weighted assuming whiff-turns cost
hours; under sync play they cost seconds, so that weight collapses — which removes 2d6's strongest
column. All eliminating findings (band collapse at L9/L8, headroom, D8 derivability, D14 CC0 reuse,
F7 roll-record cost) are pacing-independent and unaffected. **Recommendation unchanged and
strengthened: d20 margin-band.** Opposed/reaction mechanics are no longer impossible, only a scope
choice (re-argue D7 on complexity, not feasibility). D11 is effectively shaped by the owner's ruling
(offer/deadline/default with minutes-scale deadlines). F11 round-counted timers are fair again (D9).
New intake item: rules treatment of the parked "lantern-holder" character (targetability, occupancy,
area effects).

## Addendum 2 — owner decision on D1 (2026-07-16)

Owner adopted **d20** and **rejected the margin-band universal grammar**: checks are meet-or-beat vs
DC, D&D-style; difficulty is expressed only through the DC ("if the GM wants failure to be a real
possibility for a higher level character, the GM raises the DC"). Rationale: complications keyed to
beat-margin can fire on tasks trivial for a master, and D&D familiarity outweighs banded-texture
benefits. The comparative findings stand (2d6/pool eliminations, F7 satisfied); only the banded-outcome
recommendation is superseded. Rider (b) is closed — REJECTED by owner: outcomes are strictly binary (DC met = success, DC missed = failure); the GM never offers the player an alternate reality, and narrative latitude is descriptive only. Any vagueness burden falls on prompting/spec, not mechanics. Rider (a) is closed: nat 20 always succeeds / nat 1 always fails on any d20 check, with an engine no-roll gate so trivial certain-success tasks never reach the dice. Value derivation remains D1b.
Recorded in `.agents/decisions.md` (2026-07-16 entry).



## Addendum 3 — open brainstorm: d100 percentile variant (2026-07-16, NO DECISION)

Owner floated d100 roll-over as an alternative spine: auto success/fail floors shrink 5% -> 1%,
modifiers/DCs gain 1-point (=1%) granularity, and bonuses read directly as percentages. Analytic
comparison (no sim needed — both dice are uniform): identical curve shape at 5x resolution, so all
bake-off eliminations of 2d6/pool transfer unchanged. D1's committed core (binary outcomes, DC-only
difficulty, code-owned ladder, descriptive-only GM latitude) is die-agnostic; only the literal "d20"
and "nat 20/1" clauses would need superseding. Open design levers identified in discussion:
(1) check-call discipline — when a check is rolled at all must be code/spec-owned in an agent-run
game (rolling is free, so unmanaged agents inflate roll count, dragging pacing and multiplying
floor events); (2) floor size is authored policy in a computed engine, not a die-face artifact
(nat-1/nat-20 conventions are physical-table artifacts); (3) presentation/flavor is the deciding
axis — the math is equivalent, d20 reads as D&D-level-land, percentile as skill-% land, and
whichever players see rendered in the UI is the real identity choice. The no-roll gate's only
engine-relevant function is as a floor patch; it dies if floors shrink or are accepted. No decision;
D1 stands until superseded.
