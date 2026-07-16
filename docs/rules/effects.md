# Aetheria House Ruleset — Chapter 2: Effects

**Status**: DRAFT r1 — under independent review (dual codex + grok, per the owner-approved loop
2026-07-16: reviewed "like the dice spec"; trail: `.agents/review/effect-catalog-review.md`).
Not yet owner-signed; implementation of Chapter 1's edge bands remains gated on this chapter's
acceptance (`docs/rules/resolution.md` §1.5).
**Provenance**: D2 decision 2026-07-16 (`.agents/decisions.md`: complications are free text over
an engine verb set; trust is tuned by the ledgered stakes license, never by unledgered effects);
Chapter 1's executable contract (§1.5); the recorded D16 requirements (loot, wealth, movement) in
`.agents/review/rules-system-plan-intake.md`.

## 0. Design principles

- **E1 — Verbs, not content.** This catalog is the API to engine state: a vocabulary of state
  *operations*, never a table of pre-written complications. Narrative variety lives in free text
  (annotation text, ability flavor); the catalog only makes its mechanical footprint executable
  and auditable.
- **E2 — Say yes.** The vocabulary is deliberately wide enough that almost anything a human GM
  would rule maps to it. When a ruling genuinely cannot map (§6), the fallback is
  reword-or-flavor — never silent state drift, never an unledgered consequence.
- **E3 — Tokens in, numbers out.** Models emit operation tokens, enumerated parameters, and
  recorded target identifiers. The engine maps every token to numbers via code-owned config (§7).
  Models never emit quantities, weights, costs, or valences.
- **E4 — Every consequence has a home.** Chapter 1 owns the bidirectional text–effect coherence
  rule; this catalog exists so that rule always has a verb to point at. A mechanical consequence
  with no catalog home must not be narrated as fact.
- **E5 — Weight is computed, never chosen.** Each operation's weight class, point cost, and
  valence derive from the operation and its target (§3). The model's only choice is *which*
  operations to propose, within the stakes license Chapter 1 computes.

## 1. Operation grammar

An `effects` entry (Chapter 1 §1.5 annotation) or an ability effect (§5) has the shape:

```
{ "op": "<operation token>", "target": <recorded identifier>, ...enumerated params }
```

- **Targets are recorded identifiers**: a character id, an NPC id, an item reference from the
  target's recorded inventory (the D16 item registry once it exists), an area id from the current
  location's stored layout, a pool token, or a condition token. A target the engine cannot resolve
  in the current records rejects the entry (Chapter 1's revision flow governs what happens next).
- **Parameters are enums** defined per operation below. Unknown token, missing parameter, or a
  parameter outside its enum → rejection.
- **Availability**: `LIVE` operations write state that exists today; `GATED:<dep>` operations are
  part of the accepted vocabulary but may not be proposed, suggested, or executed until their
  gating feature ships. Validation rejects a gated operation exactly like an unknown one, with the
  gate named in the rejection reason. Implementation of Chapter 1's edge bands may ship with the
  LIVE subset; each gated verb activates with its feature.
- **Versioning**: the catalog is versioned chassis config. Adding, removing, or re-weighting
  operations is a chassis version change pinned per campaign (intake D12/D13 scope); models never
  see two catalogs at once and never propose operations outside the campaign's pinned version.

## 2. The operations

Weight classes and valence tags are consumed by Chapter 1's stakes-license and band-valence
checks; point costs per class are Chapter 1's contract (`minor` = 1, `significant` = 2). "Weight:
by item class" is the engine-computed rule in §3.

### 2.1 Vitals

| Operation | Parameters | State written | Weight | Valence | Availability |
|---|---|---|---|---|---|
| `harm` | `grade`: `graze` \| `wound` \| `grievous` | target's `health` | graze: minor; wound/grievous: significant | adverse | LIVE seam (health exists); the grade→value map is **GATED:D1b** |
| `heal` | `grade`: `patch` \| `mend` \| `restore` | target's `health` (≤ max) | patch: minor; mend/restore: significant | beneficial | GATED:D1b (same map) |

Death, dying, and 0-HP behavior are D9 scope: `harm` can never, by itself, remove an actor from
play — it writes a number; what the number means at 0 is another chapter's rule.

### 2.2 Pools

| Operation | Parameters | State written | Weight | Valence | Availability |
|---|---|---|---|---|---|
| `pool_drain` | `pool`: `mana` \| `strain`; `depth`: `shallow` \| `deep` | target's pool value | shallow: minor; deep: significant | adverse | `mana`: LIVE (map GATED:D1b); `strain`: GATED:D5 |
| `pool_restore` | same | same (≤ max) | same | beneficial | same |

### 2.3 Items and wealth

| Operation | Parameters | State written | Weight | Valence | Availability |
|---|---|---|---|---|---|
| `item_lose` | — | item leaves the owner's recorded inventory | by item class (§3) | adverse | LIVE (player `inventory_json`); NPC-held items and item classes GATED:D16 |
| `item_gain` | — | item enters the owner's recorded inventory | by item class (§3) | beneficial | LIVE for scene-established mundane items; recorded/significant items GATED:D16 |
| `item_condition_shift` | `direction`: `degrade` \| `improve` (one step) | item condition on the ladder `pristine` → `worn` → `damaged` → `broken` | degrade to `broken`: significant; any other step: minor | degrade: adverse; improve: beneficial | GATED:D16 (condition lives on the item record) |
| `wealth_shift` | `direction`: `up` \| `down` (one step) | target's coarse wealth category (§7 ladder) | minor | up: beneficial; down: adverse | GATED:D16 (the wealth field) |

`item_gain` cannot mint significance: a significant-class item may be gained only if it already
exists in the world record (an NPC's recorded equipment, a placed item — D16 registry). Mundane
gains ("a coil of rope from the wreckage") only require the annotation text to establish the
in-scene source. This is what makes loot real: the laser rifle you take is the recorded rifle its
owner carried, in whatever condition the fight left it (D16's loot requirement).

### 2.4 Disposition

| Operation | Parameters | State written | Weight | Valence | Availability |
|---|---|---|---|---|---|
| `disposition_improve` | `step`: `slight` \| `marked` | NPC `relationship_value` (engine-mapped, clamped −100…+100) | slight: minor; marked: significant | beneficial | LIVE |
| `disposition_worsen` | same | same | same | adverse | LIVE |

**Migration note (honest):** today's turn contract lets the model emit a free integer
`relationship_change` (−50…+50) and Referee-adjudicated damage numbers — both predate this
chapter and violate the tokens-in/numbers-out invariant. Under rules-governed campaigns those
seams migrate to these operations; freeform/legacy behavior is D13 scope, not silently changed.

### 2.5 Position

| Operation | Parameters | State written | Weight | Valence | Availability |
|---|---|---|---|---|---|
| `reposition_favorable` | `area`: area id in the current location | target's occupancy entry | minor | beneficial | LIVE (occupancy layer); refined by D6 zones |
| `reposition_unfavorable` | same | same | minor | adverse | LIVE; refined by D6 |

### 2.6 Conditions

| Operation | Parameters | State written | Weight | Valence | Availability |
|---|---|---|---|---|---|
| `hindrance_apply` | `condition`: §7 hindrance set; `duration`: `scene` \| `persistent` | conditions store | scene: minor; persistent: significant | adverse | GATED:conditions-store |
| `boon_apply` | `condition`: §7 boon set; same durations | same | same | beneficial | GATED:conditions-store |
| `condition_clear` | `condition` currently on the target | same | minor | beneficial | GATED:conditions-store |

**Required state addition (declared, not yet built):** a per-actor conditions store — the one new
engine structure this chapter requires. **v1 semantics are deliberately thin**: a condition is a
ledgered, duration-bounded established fact about an actor. It carries no arithmetic of its own;
it is exactly the kind of fact a Chapter 1 situational delta may cite ("hindered — twisted
ankle" → `{hinders, slight, …}`), and Continuity's one-fact-one-home rule applies unchanged. Any
richer mechanics (automatic deltas, action restrictions) are later scope.

### 2.7 Scene and canon

| Operation | Parameters | State written | Weight | Valence | Availability |
|---|---|---|---|---|---|
| `encounter_start` | `posture`: `hostile` \| `social_standoff` | the encounter state machine | significant | adverse | GATED:D7 (today only a per-turn pacing enum exists — no persistent encounter entity) |
| `fact_learn` | — | a ledgered world-fact/memory entry whose content is the annotation text | minor | beneficial | LIVE (campaign memories) |

`fact_learn` is the canon-commitment verb: "you notice the vault hinge is mounted backwards"
becomes a recorded fact later checks and narration must honor — information gains get state
weight instead of evaporating.

### 2.8 Check-value modulation

| Operation | Parameters | State written | Weight | Valence | Availability |
|---|---|---|---|---|---|
| `value_reduce` | — | the derived values of the *checked action itself* (e.g. a marginal hit's damage) | minor | adverse | GATED:D1b |
| `value_enhance` | — | same | minor | beneficial | GATED:D1b |

These modulate value **derivation** only ("a glancing blow"). Chapter 1's outcome fields
(`T`, `raw`, `band`, …) are immutable; no operation in this catalog can touch them.

## 3. Weight, cost, and valence — the license interface

- Point costs per weight class, license budgets, and aggregation live in Chapter 1 §1.5 (its
  executable contract). This chapter owns only the **per-operation assignments** in the §2 tables.
- **By item class**: `item_lose`/`item_gain` weight is `minor` for mundane-class items and
  `significant` for significant-class items. Item classes are D16 registry data; until D16 ships,
  every item is mundane-class (and significant-item operations are unreachable — consistent with
  their gates).
- The model never emits a weight, cost, or valence. Validation recomputes all three from the
  operation and target; a mismatch is impossible by construction because they are never part of
  the model's payload.

## 4. Contextual suggestions (advisory, engine-assembled)

When Chapter 1 licenses an edge-band annotation, the engine MAY hand the Referee a short list of
pre-validated candidate effects assembled **deterministically from live state**: the actor's
recorded inventory (item ops), present NPCs and their dispositions (disposition ops), the current
location's areas (reposition), active pools, and standing conditions. Rules:

- Every suggestion is pre-checked against the current license budget and band valence — the list
  never contains an illegal option.
- Suggestions are **advisory only**: the Referee may take one, combine within budget, or ignore
  the list and write its own (validated identically). An empty list never blocks the annotation;
  flavor-only always remains legal.
- Assembly is engine code, not a model call; the list is capped (§7) and its contents are not
  ledgered unless chosen.

This is the owner's "contextual table": suggestion content varies with the scene because it *is*
the scene, while the free-text complication stays the model's to write.

## 5. Abilities consume the same vocabulary

Generated abilities are flavor text plus effect selections from this catalog — the D0/intake
invariant (models select legal effects, never invent mechanics) made concrete. Packaging —
ability costs, targeting, cooldowns, archetype assignment — is D3/D5 scope. Two rules bind now:

1. No ability may carry an operation this catalog lacks. A gap discovered during ability design
   comes back as a catalog version proposal (§1 versioning), never an inline invention.
2. Ability effects pass the same §3 validation (targets, enums, engine-owned quantities); only
   the stakes license is edge-band-specific.

## 6. Deliberately inexpressible (reword or flavor)

No operation exists for — and no annotation or ability may assert as mechanical fact:

- killing or removing an actor outright (`harm` writes numbers; death is D9's rule);
- attribute, skill, XP, level, or advancement changes (D4/D5);
- act or plot-outline transitions (the outline system, D15);
- editing a location's layout or the world map (layout is generated once and mutated only through
  its own gate);
- minting significant items from nothing (§2.3);
- seat, permission, fork, or timeline operations (multiplayer/infra, not fiction);
- a check's outcome fields (Chapter 1).

The fallback is Chapter 1's rule: reword the text to fit the expressible footprint, or let it be
flavor — mechanically inert color is always legal.

## 7. Config block (engine-owned, provisional)

All token→number maps live here in one place; every value is provisional pending playtest, and
recalibration is config, not redesign.

| Config | Provisional value |
|---|---|
| Disposition steps | `slight` = ±10, `marked` = ±25 (sign by direction; clamp −100…+100) |
| Item condition ladder | `pristine` → `worn` → `damaged` → `broken` (one step per shift) |
| Wealth ladder (tokens here; the field is D16's) | `destitute` \| `struggling` \| `comfortable` \| `wealthy` \| `opulent` |
| Hindrance starter set | `hindered`, `exposed`, `dazed`, `pinned`, `winded` |
| Boon starter set | `steadied`, `inspired`, `concealed` |
| Condition durations | `scene` (clears when the scene changes), `persistent` (until cleared) |
| Suggestion list cap | 4 |
| `harm`/`heal` grades, pool depths | tokens fixed here; numeric maps are **D1b** |

## 8. Genre-spread proof (worked, license arithmetic shown)

License recap from Chapter 1 (pointer, not restatement): base `flavor_only` out of encounter /
`minor` in one; +1 step for a critical band; +1 for `extreme`/`legendary` tier; cap
`significant`. Budgets: 0 / 1 / 2 points.

1. **Fantasy, rooftop lockwork** (Chapter 1's own example): `marginal_success`, `standard` tier,
   no encounter → license `flavor_only`, budget 0. "The picks slip once, loudly" — no effects,
   legal. "The pick snaps" would need `item_lose` (1 pt) and is **over budget**: reword or let it
   ride. The same slip during a fight (license `minor`) legally carries `item_lose` — one pick,
   gone, ledgered.
2. **Fantasy, melee crit in combat**: `crit_failure` in an active encounter → `minor` + 1 =
   `significant`, budget 2. "Your axe bites the doorframe and the edge folds" →
   `item_condition_shift(axe, degrade)` (minor, 1 pt) + `reposition_unfavorable` (minor, 1 pt):
   2/2, valid, both adverse.
3. **Cyberpunk, netrun** `marginal_failure` during an intrusion (encounter active → `minor`,
   budget 1): "the ICE tags your handle on the way out" → `hindrance_apply(exposed, scene)`
   (minor, 1 pt). The persistent version (significant, 2 pts) is over budget at `minor` — the
   text must scale to the license, exactly the discretion the ledger audits.
4. **Social, imperial court** `marginal_failure`, `extreme` tier, no encounter → `flavor_only` +
   1 = `minor`, budget 1: "the Chancellor's smile thins" → `disposition_worsen(chancellor,
   slight)` (1 pt). `marked` (significant) is out of reach — a single faux pas cannot nuke the
   relationship.
5. **Ranged sci-fi firefight** `marginal_success` (encounter → `minor`): "the rifle's coil
   overheats" → `item_condition_shift(rifle, degrade)` (1 pt) — and when its owner falls, that
   `worn` rifle is what you loot (§2.3, D16).
6. **Crit success, legendary leap** (`crit_success`, `legendary` → `flavor_only` + 1 + 1 =
   `significant`, budget 2, beneficial only): "from the mast top you spot the reef gap the
   blockade captains missed" → `fact_learn` (1 pt) + `boon_apply(inspired, scene)` (1 pt).
7. **The reword case**: "the ceiling collapses, sealing the east wing" — a layout edit, no verb
   (§6). Reword ("dust and rubble choke the corridor — passable, barely") or ledger real effects
   (`reposition_unfavorable`, `hindrance_apply(winded, scene)`). The wing stays open because
   nothing recorded closes it.

Coverage judgment (the E2 test): across fantasy, cyberpunk, social, and ranged play, the
GM-natural rulings map; what doesn't map is §6's list, which is deliberate. Reviewers should
attack exactly this claim.

## 9. Non-scope (tracked elsewhere)

Value derivation and all numeric maps for vitals/pools (**D1b**); the strain pool (**D5**); zones
(**D6**); the encounter state machine and initiative (**D7**); dying and death (**D9**);
recovery (**D10**); the item/NPC registries, item classes, wealth field, and NPC movement
plausibility (**D16**); freeform/legacy campaigns (**D13**); ability packaging (**D3/D5**);
faction-level (non-NPC) disposition — an acknowledged gap, raised for a future catalog version.
