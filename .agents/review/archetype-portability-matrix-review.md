# Review: cross-genre archetype portability matrix

**Status**: Review of draft only — not a settled D3 decision and not
implementation authorization.

**Date**: 2026-07-27

**Subject**: `.agents/review/archetype-portability-matrix.md`

**Related**: D0 (fixed house chassis + flavor skins), D2 (effect catalog signed
off), open D3 (archetype boundary / translation contract), deferred inventory
and history policy under D13/D16; intake finding F4 (unique genre nouns strand
portable characters).

## Bottom line

The model works. The matrix is a strong design draft for character portability,
not a finished D3 decision or an automatic lookup. It fits D0 (one rulebook,
many coats of paint), addresses the real portability failure mode (F4), and
correctly separates “same fantasy, new paint” from “same person, same sheet.”

What still needs owner ruling is boundary and product shape, not whether the
kernel idea is sound.

## What works

### 1. The core split is right

A character is a **functional kernel** plus a **genre expression**. That matches
the settled chassis rule: same mechanical contribution, different setting
language. Gunslinger → archer, wizard → netrunner, and rogue remaining an
infiltrator all follow from that without inventing a new ruleset per campaign.

### 2. Three reuse modes prevent product confusion

| Mode | Meaning | Today |
|---|---|---|
| Continue | Same person, same sheet | Closest to shipped `existing` |
| Branch | Exact parallel copy | Closest to shipped `copy` |
| Translate | New genre incarnation of the same fantasy | Does not exist yet |

That matches the shipped campaign wizard (`existing` / `copy` only). The draft
wisely specifies Translate without pretending those modes already mean
translation.

### 3. The invariants are the load-bearing part

What must survive — role, range/shape, tempo, cost pressure, relative
competence, agency, progression weight, player anchors — is better than a
class-name dictionary. The automatic / ask / reject table and the mandatory
translation card before play keep the engine from silently lying.

### 4. Anchors solve identity without freezing everything

Literal magic, a signature revolver, or a sentient companion as player-marked
non-auto-translate is the right product rule. When translation is hard, the
three paths (setting exception / functional adaptation / cancel) are correct
and honest.

### 5. Worked examples stress the hard cases

Fireball with no network, pilot with no vehicles, oath never becoming corporate
loyalty automatically — those prove the model knows where to stop. That is more
valuable than a complete pretty grid.

### 6. Scope discipline is good

The draft owns Translate only. Inventory, injuries, wealth, relationships, and
history stay with D13/D16. That avoids claiming a full character port when only
abilities changed.

## Where it is weak or incomplete

### 1. The 22 families are a design vocabulary, not a finished archetype list

They cover combat, social, exploration, support, and meta roles well. Overlaps
(Infiltrator/Saboteur/Scout, Face/Inspirer, Defender/Bruiser,
Controller/Artillery) are fine if families are internal tags and familiar
classes are compositions, as §6 already says.

Risk for D3: if players pick “primary + up to two secondaries” as a free menu,
the combinatorics explode and balance becomes multiclass soup. Safer product
shape:

- players pick a familiar concept or short package;
- the engine stores kernel tags under the hood;
- secondaries are limited or package-defined, not open multiclass.

### 2. Cells are candidate flavor, not mechanical equivalence

“Wizard → Netrunner” is a good story mapping. The real engine seam is:
destination abilities must still be instances of the same D2 effect verbs, with
the same cost/tempo/range shape. The matrix does not yet define that
machine-checkable mapping. As design intent it works; as an implementable
contract it still needs a kernel schema and effect-tag binding.

### 3. Full character portability still depends on D13/D16

Abilities-only translation is not a complete character. The draft admits this;
§5–9 must not be treated as a full portability product until inventory and
history policy are settled.

### 4. Some families are environment-contingent

Pilot, Patron (scale), Handler (companion semantics), and surreal (X)
expressions will hit “no honest equivalent” often. The edge-case rules handle
that; those families should not be treated as always portable.

### 5. Taxonomy nits (not blockers)

- **Generalist** can become a dump bucket — keep it rare or package-only.
- **Artillery** in gothic/occult (“relic hunter / exorcist arsenal”) is a stretch
  versus field control.
- **Scholar vs Investigator** and **Commander vs Patron** need crisp “decision
  loop” distinctions so they do not collapse in play.

None of these break the model.

## Verdict on the draft's owner-focus questions

| Question | Assessment |
|---|---|
| Functional kernel + genre expression as the portability model? | Yes — accept this. |
| 22 families complete enough? | Complete enough to plan from; refine overlaps later; do not ship as an open 22-pick multiclass menu. |
| 10 genre families? | Yes, as families plus modifiers, not a closed campaign list. |
| Primary + up to 2 secondaries? | Kernel storage: fine. Character-creation UX: prefer packages over free triple-pick. |
| Power source free by default vs always ask? | Default free only when not anchored; always show on the translation card. Anchored sources always require explicit choice (as written). |
| New Translate mode vs change `existing`? | Add Translate; keep Continue/Branch semantics distinct. Do not make `existing` silently translate. |
| What belongs in the portable kernel beyond abilities? | At minimum: families, signature affordances, source pattern, anchors, progression weight, cost shapes. Inventory/history/relationships need explicit D13/D16 rules before claiming full port. |

## Layered verdict

| Layer | Works? |
|---|---|
| Product mental model for cross-genre character reuse | Yes |
| D0-aligned answer (chassis vs flavor) | Yes |
| Guard against silent bad ports (invariants, anchors, card, stop-when-dishonest) | Yes |
| Automatic class-name lookup | No — and the draft correctly refuses to be that |
| Finished D3 decision / implementable schema | Not yet — still draft for owner ruling |

## Recommendation

Treat **kernel + expression + Translate mode + invariants + translation card**
as the right architecture.

Treat the tables as a working design reference, not canonical rules text, until
D3 (and the deferred inventory/history pieces) are recorded.

Suggested first owner go/no-go for the model itself:

> Portability = preserve a functional kernel (role, affordances, range/tempo/cost
> shape, progression weight, player anchors) and re-skin genre expression in the
> destination campaign, with mandatory player review before play. Continue /
> Branch / Translate stay separate modes.

After that, the next single decision should be whether secondaries are free
composition or package-defined — that shapes D3 and character creation more than
adding more matrix cells.

## Outcome of this review

No decision recorded. No product code changed. This file is evidence for the
owner's D3 review, not authorization to implement Translate.
