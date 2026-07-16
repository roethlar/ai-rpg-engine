# Aetheria House Ruleset — Chapter 2: Effects

**Status**: DRAFT r2 — r1 was reopened by both independent reviewers (codex: 3 CRITICAL / 5 HIGH /
1 MEDIUM; grok: 4 HIGH / 3 MEDIUM; all findings admitted, trail:
`.agents/review/effect-catalog-review.md`). Not yet owner-signed; implementation of Chapter 1's
edge bands remains gated on this chapter's acceptance (`docs/rules/resolution.md` §1.5).
**Provenance**: D2 decision 2026-07-16 (`.agents/decisions.md`: complications are free text over
an engine verb set; trust is tuned by the ledgered stakes license, never by unledgered effects);
Chapter 1's executable contract (§1.5); the recorded D16 requirements (loot, wealth, movement) in
`.agents/review/rules-system-plan-intake.md`.

## 0. Design principles

- **E1 — Verbs, not content.** This catalog is a vocabulary of state *operations* with one shared
  validation contract — never a table of pre-written complications. Narrative variety lives in
  free text; the catalog makes its mechanical footprint executable and auditable. The catalog has
  three consumers: **edge-band annotations** (Chapter 1 §1.5 — specified here), **generated
  abilities** (§5 — packaging is D3/D5 scope), and the **ordinary-action commit path** (the
  transaction that writes clean-band and no-check state changes — a declared future chapter, §9).
  End state, per the D2 decision's "any mechanical consequence must map to an engine verb": once a
  campaign is rules-governed, *no free-form state-change seam survives*; today's free-form turn
  seams are migration targets, not permanent bypasses.
- **E2 — Say yes, within the scene.** The vocabulary is wide enough that almost any **actor- or
  scene-local** consequence a human GM would rule maps to it. World-scale persistent state —
  clocks, faction standing, off-screen NPC movement — is deliberately *not yet* expressible; §6
  names every such exception and its future home. When a ruling cannot map, the fallback is
  reword-or-flavor — never silent state drift, never an unledgered consequence.
- **E3 — Tokens in, numbers out.** Models emit operation tokens, enumerated parameters, typed
  recorded references, and — only where a §2 schema explicitly licenses one — a bounded,
  engine-normalized name string. The engine maps every token to numbers via code-owned config
  (§7). Models never emit quantities; no numeric or mechanical property is ever derived from a
  licensed string (§1).
- **E4 — Every consequence has a home.** Chapter 1 owns the bidirectional text–effect coherence
  rule; this catalog exists so that rule always has a verb to point at.
- **E5 — Weight and valence are computed, never chosen.** Each entry's weight class, point cost,
  and *effective valence* derive from the operation, its target, and the acting character's frame
  (§3). The model's only choice is *which* operations to propose, within the stakes license.

## 1. Operation grammar and validation

An effect entry is an object whose fields are fixed per operation by the §2 schemas:

```
{ "op": "<operation token>", ...operation-specific fields }
```

**Field types** (the only kinds a schema may use):

- **Typed actor ref**: `"character:<id>"` or `"npc:<id>"` — the type prefix is mandatory because
  character and NPC integer ids occupy separate namespaces. The ref must resolve to a recorded
  actor in this campaign.
- **Item key**: today, the exact name key of an entry in the owner's recorded inventory
  (inventory is name-keyed with numeric quantities); under the D16 registry, the item's record
  id. Must resolve in the named owner's inventory.
- **Area id**: an area id from the current location's stored layout.
- **Condition / pool / kind tokens and all other enums**: exactly the values a schema lists.
- **Licensed string**: allowed only where a schema names one (`name`, `detail`). Bounded (§7
  caps), engine-normalized (trimmed, whitespace-collapsed), and semantically inert: the engine
  never parses a licensed string for quantities, classes, or mechanical properties — those come
  only from engine config and recorded state. "A crate of 100 grenades" as a `name` yields
  exactly one mundane item whose name is a string; the 100 is decoration, not state.

**Validation order** (all before any commit; a failure rejects the entry into Chapter 1's
revision flow): catalog membership at the campaign's pinned catalog version → schema shape
(unknown op, missing/extra fields, out-of-enum values) → reference resolution (unresolvable actor,
item, area, or condition) → availability (§ below) → the array evaluator (§1.1) → Chapter 1's
license budget and band-valence checks (consuming §3's effective valence).

### 1.1 The effects-array evaluator (normative)

An annotation's `effects` array is validated and priced as one ordered pass:

1. Take an isolated **tentative state** snapshot of everything the array may touch.
2. Evaluate entries **left to right**. Each entry must **change the tentative state**: an entry
   that cannot (heal at max, degrade past `broken`, wealth past a ladder end, disposition already
   at a clamp, re-applying an active condition, clearing an absent one, repositioning to the
   current area) is a **no-op and is rejected** — narrated change must be real change.
3. At most **one entry per (target, property) pair** per array — no stacking two degrades or two
   disposition steps on the same target in one annotation.
4. Each entry's weight class and point cost are computed against the tentative state *at its
   position* (this is what makes state-dependent weights well-defined), its effective valence per
   §3; the summed cost must fit the license budget and every valence must fit the band.
5. If every entry passes, the tentative state commits **atomically** with the annotation, under
   Chapter 1's one-transaction-per-`checkId` idempotency. Any failure rejects the whole array;
   nothing partial ever executes.

**Availability**: `LIVE` operations write state that exists today; `GATED:<dep>` operations are
part of the accepted vocabulary but may not be proposed, suggested, or executed until their
gating feature ships — validation rejects them with the gate named, exactly like an unknown op
but distinguishably. Edge-band implementation may ship with the LIVE subset; each gated verb
activates with its feature. An operation whose *numeric map* is gated is gated end-to-end: there
is no "live seam" without a legal number to write.

**Versioning**: the catalog is versioned chassis config, pinned per campaign (D12/D13 scope).
Adding, removing, or re-weighting operations is a version change; models never see two catalogs
at once.

## 2. The operations

Each operation lists its full schema. "Direction" is the op's declared effect on its target
(helps/hurts); §3 turns direction into the *effective valence* Chapter 1 consumes. Point costs
per weight class are Chapter 1's contract (`minor` = 1, `significant` = 2).

### 2.1 Vitals — GATED:D1b end-to-end

| Operation | Schema | State written | Weight | Direction |
|---|---|---|---|---|
| `harm` | `{op, who: character ref, grade: graze\|wound\|grievous}` | `who`'s health | graze: minor; wound/grievous: significant | hurts `who` |
| `heal` | `{op, who: character ref, grade: patch\|mend\|restore}` | `who`'s health (≤ max) | patch: minor; mend/restore: significant | helps `who` |

Both are **GATED:D1b** (the grade→value maps do not exist; a gated map gates the op — §1.1).
`who` is restricted to characters because **NPCs carry no vitals today**; extending vitals to
opposition is D8/D16 scope. Death, dying, and 0-HP meaning are D9 scope: `harm` writes a number,
never removes an actor.

### 2.2 Pools — GATED:D1b (strain additionally GATED:D5)

| Operation | Schema | State written | Weight | Direction |
|---|---|---|---|---|
| `pool_drain` | `{op, who: character ref, pool: mana\|strain, depth: shallow\|deep}` | `who`'s pool | shallow: minor; deep: significant | hurts `who` |
| `pool_restore` | same | same (≤ max) | same | helps `who` |

### 2.3 Items and wealth

| Operation | Schema | State written | Weight | Direction | Availability |
|---|---|---|---|---|---|
| `item_lose` | `{op, owner: actor ref, item: item key}` | one unit leaves `owner`'s inventory | by item class (§3) | hurts `owner` | LIVE for character owners; NPC owners GATED:D16 |
| `item_gain` | `{op, owner: actor ref, item: item key}` — recorded item; or mundane form `{op, owner, name: licensed string}` | one unit enters `owner`'s inventory | by item class (§3) | helps `owner` | mundane form LIVE for character owners; recorded/significant items and NPC owners GATED:D16 |
| `item_condition_shift` | `{op, owner: actor ref, item: item key, direction: degrade\|improve}` | one step on `pristine`→`worn`→`damaged`→`broken` | step to `broken`: significant; else minor (priced on tentative state, §1.1) | degrade: hurts `owner`; improve: helps `owner` | GATED:D16 (condition lives on the item record) |
| `wealth_shift` | `{op, who: actor ref, direction: up\|down}` | one step on the §7 wealth ladder | minor | up: helps `who`; down: hurts `who` | GATED:D16 (the wealth field) |

**Stack rule**: every item entry moves **exactly one unit** — quantity is never a model input and
never prose-derived. **Mundane gains**: the engine assigns class `mundane` and (once D16 ships)
condition `pristine`; the `name` string carries zero mechanics (§1). **No minting significance**:
a significant-class item may be gained only if it already exists in the world record (an NPC's
recorded equipment, a placed item — D16). That is what makes loot real: the laser rifle you take
is the recorded rifle its owner carried, in whatever condition the fight left it.

### 2.4 Disposition — LIVE

| Operation | Schema | State written | Weight | Effective valence (fixed — see below) |
|---|---|---|---|---|
| `disposition_improve` | `{op, npc: npc ref, step: slight\|marked}` | that NPC's `relationship_value` (engine-mapped ±, clamped −100…+100) | slight: minor; marked: significant | beneficial |
| `disposition_worsen` | same | same | same | adverse |

**Party-frame exception (deliberate)**: disposition valence is fixed, not frame-composed. The
relationship value measures the party's standing with that NPC — an asset of the party — so
improving it is beneficial and worsening it adverse no matter whose action moved it. Consequence,
acknowledged: "the enemy now fears you" is not expressible as a beneficial disposition write; the
single like/dislike axis has no fear/respect channel (a future catalog version may add one). Use
`fact_learn`, a boon, or flavor.

**Migration note (honest)**: today's turn contract lets the model emit a free integer
`relationship_change` (−50…+50) and Referee-adjudicated damage numbers — both predate this
chapter and violate tokens-in/numbers-out. Under rules-governed campaigns those seams migrate to
catalog operations; freeform/legacy behavior is D13 scope, not silently changed.

### 2.5 Position — LIVE (refined by D6 zones)

| Operation | Schema | State written | Weight | Direction |
|---|---|---|---|---|
| `reposition` | `{op, who: actor ref, area: area id, quality: favorable\|unfavorable}` | `who`'s occupancy entry in the current location | minor | `quality` declares it: favorable helps `who`, unfavorable hurts `who` |

`quality` is a declared judgment the engine cannot compute from geometry; it is validated by
Continuity against the annotation text and fiction ("shoved into the open courtyard" cannot be
`favorable`) — the same semantic-gate trust class as Chapter 1 delta reasons, and it is an
identifier, never a number. Moving `who` to their current area is a no-op (§1.1).

### 2.6 Conditions — GATED:conditions-store

| Operation | Schema | State written | Weight | Direction |
|---|---|---|---|---|
| `hindrance_apply` | `{op, who: actor ref, condition: §7 hindrance token, duration: scene\|persistent, detail: licensed string}` | conditions store | scene: minor; persistent: significant | hurts `who` |
| `boon_apply` | `{op, who: actor ref, condition: §7 boon token, duration, detail}` | same | same | helps `who` |
| `condition_clear` | `{op, who: actor ref, condition: token active on who}` | same | minor | clears a hindrance: helps `who`; clears a boon: hurts `who` |

**Required state addition (declared, not yet built) — the condition record**:
`{ actor: typed ref, condition: token, class: boon|hindrance (from the token's §7 set), detail,
source: checkId (or other originating transaction id), duration, appliedTurn }`. **Uniqueness**:
at most one active instance per (actor, condition token); re-application is a no-op (§1.1).
`detail` is the citable fictional reason — exactly the kind of established fact a Chapter 1
situational delta may reference, with one-fact-one-home applying unchanged. **Scene boundary (v1
proxy, stated)**: a `scene`-duration condition clears when the campaign's current-location
pointer changes — the one observable boundary today; D7's encounter machine may refine it.
`persistent` lasts until explicitly cleared. **v1 semantics are deliberately thin**: a condition
is a ledgered, duration-bounded established fact; it carries no arithmetic of its own.

### 2.7 Scene features — LIVE (temporary object occupancy, never layout)

| Operation | Schema | State written | Weight | Effective valence (fixed) |
|---|---|---|---|---|
| `scene_feature_place` | `{op, area: area id, kind: obstruction\|hazard\|smoke\|darkness\|alarm\|cover, name: licensed string, duration: scene\|persistent}` | an object entry in the location's occupancy layer | scene: minor; persistent: significant | adverse |
| `scene_feature_clear` | `{op, feature: name of a recorded object occupant in this location}` | removes that entry | minor | beneficial |

Features are **temporary scene state** riding the existing object-occupancy layer — rubble
across a door, smoke in the hall, a klaxon blaring. They never edit the stored layout (§6).
Scene-duration features clear on the same location-pointer boundary as conditions. Placement is
fixed-adverse (complication semantics); a beneficial scene shift for the party routes through
`boon_apply` (e.g. `concealed`) or `reposition`.

### 2.8 Scene and canon

| Operation | Schema | State written | Weight | Effective valence (fixed) | Availability |
|---|---|---|---|---|---|
| `encounter_start` | `{op, posture: hostile\|social_standoff, participants: [npc refs present in the current location]}` | the encounter state machine | significant | adverse | GATED:D7 (today only a per-turn pacing enum exists) |
| `fact_learn` | `{op}` — targetless | a ledgered party-scope world-fact/memory entry; its content **is** the annotation text, keyed by `checkId` | minor | beneficial | LIVE (campaign memories) |

`fact_learn` is the canon-commitment verb: "you notice the vault hinge is mounted backwards"
becomes a recorded fact later checks and narration must honor. It is beneficial-only (the party
learning something is the benefit); adverse discoveries ("the alarm is raised") are expressed by
the verb that changes the state (`scene_feature_place(alarm)`, `disposition_worsen`, …), never by
a "bad fact".

### 2.9 Check-value modulation — GATED:D1b

| Operation | Schema | State written | Weight | Effective valence (fixed) |
|---|---|---|---|---|
| `value_reduce` | `{op}` — targetless, bound to the current `checkId` | the derived values of the checked action itself (channel enum is D1b scope) | minor | adverse |
| `value_enhance` | same | same | minor | beneficial |

These modulate value **derivation** only ("a glancing blow"). Chapter 1's outcome fields (`T`,
`raw`, `band`, …) are immutable; no operation in this catalog can touch them.

## 3. Weight, cost, and effective valence — the license interface

**Effective valence** (what Chapter 1's band-valence check consumes) is computed, never emitted:

1. Ops with a **Direction** column declare whether they help or hurt their target actor.
2. The **frame**: the acting character and all player characters are *party*; every NPC and
   creature is *non-party* (v1 coarseness, stated: allied NPCs count as non-party until a
   recorded-allegiance home exists — D8/D16).
3. Compose: **helps party → beneficial; hurts party → adverse; hurts non-party → beneficial;
   helps non-party → adverse.** A crit-success disarm that hurts a foe is beneficial; a marginal
   failure may not "complicate" the scene by damaging the enemy — that inversion is exactly what
   this rule exists to reject.
4. Fixed-valence ops (disposition, scene features, `fact_learn`, `encounter_start`, value
   modulation) skip composition; each states its rationale in §2.

**Weight**: per the §2 tables. *By item class*: `minor` for mundane-class, `significant` for
significant-class items; classes are D16 registry data — until D16 ships, every item is
mundane-class. State-dependent weights (degrade-to-broken) are priced on the tentative state
(§1.1). **Costs and budgets**: Chapter 1 §1.5 owns them (`minor` = 1, `significant` = 2; budgets
0/1/2). The model never emits a weight, cost, or valence; validation recomputes all three, so a
mismatch is impossible by construction.

## 4. Contextual suggestions (advisory, engine-assembled)

When Chapter 1 licenses an edge-band annotation, the engine MAY hand the Referee a short list of
candidate effects assembled from live state (the actor's inventory, present NPCs and
dispositions, areas, active conditions and features). Contract — deliberately minimal:

- Every suggestion is pre-validated against the current license budget and band valence; the
  list never contains an illegal option, and its length is capped (§7).
- Suggestions are **advisory only**: the Referee may take one, combine within budget, or ignore
  the list and write its own (validated identically). An empty or absent list never blocks
  anything; flavor-only always remains legal. Contents are not ledgered unless chosen.
- Assembly is engine code, not a model call. **Selection is implementation-defined** — no
  determinism claim, no ranking contract — and the assembler is excluded from this chapter's
  cold-implementation acceptance: it is an optional quality-of-life layer over a complete system.

This is the owner's "contextual table": suggestion content varies with the scene because it *is*
the scene, while the free-text complication stays the model's to write.

## 5. Abilities consume the same vocabulary

Generated abilities are flavor text plus effect selections from this catalog — the D0/intake
invariant made concrete. Ability **templates** use role placeholders where §2 schemas take
concrete refs: `self`, `ally`, `foe`, `area`, `held-item`. Template legality (ops exist at the
campaign's catalog version, enums valid) is checkable at generation time; placeholders bind to
concrete recorded refs at execution time, where §1's full validation runs. Packaging — costs,
targeting rules, cooldowns, archetype assignment — is D3/D5 scope. Two rules bind now:

1. No ability may carry an operation this catalog lacks. A gap found during ability design comes
   back as a catalog version proposal (§1), never an inline invention.
2. Bound ability effects pass the same §1/§1.1 validation; only the stakes license is
   edge-band-specific.

## 6. Deliberately inexpressible (reword or flavor, with named future homes)

No operation exists for — and no annotation or ability may assert as mechanical fact:

- killing or removing an actor outright (`harm` writes numbers; death is **D9**);
- attribute, skill, XP, level, or advancement changes (**D4/D5**);
- act or plot-outline transitions (the outline system, **D15**);
- **permanent layout or map edits** — scene features (§2.7) are temporary occupancy objects; the
  stored layout mutates only through its own gate;
- minting significant items from nothing (§2.3; registry is **D16**);
- **time pressure, countdowns, and clocks** — no world/scene clock exists; future home: the
  encounter machine and recovery/world-clock work (**D7/D10**);
- **faction or organization standing** — only per-NPC disposition exists; a faction axis is a
  future catalog version;
- **off-screen NPC movement or presence in another location** — the plausibility-bounded
  movement seam is **D16**;
- seat, permission, fork, or timeline operations (multiplayer/infra, not fiction);
- a check's outcome fields (Chapter 1).

The coverage claim (E2) is scoped accordingly: actor- and scene-local consequences map; this
list is what deliberately does not, yet. The fallback is Chapter 1's rule: reword to the
expressible footprint, or let it be flavor — mechanically inert color is always legal.

## 7. Config block (engine-owned, provisional)

All token→number maps and bounds live here; every value is provisional pending playtest, and
recalibration is config, not redesign.

| Config | Provisional value |
|---|---|
| Disposition steps | `slight` = ±10, `marked` = ±25 (sign by op; clamp −100…+100) |
| Item condition ladder | `pristine` → `worn` → `damaged` → `broken` (one step per shift) |
| Wealth ladder (tokens here; the field is D16's) | `destitute` \| `struggling` \| `comfortable` \| `wealthy` \| `opulent` |
| Hindrance starter set | `hindered`, `exposed`, `dazed`, `pinned`, `winded` |
| Boon starter set | `steadied`, `inspired`, `concealed` |
| Durations | `scene` (clears when the campaign's current-location pointer changes — v1 proxy, D7 may refine), `persistent` (until cleared) |
| Scene-feature kinds | `obstruction`, `hazard`, `smoke`, `darkness`, `alarm`, `cover` |
| Licensed string caps | `name` ≤ 48 chars, `detail` ≤ 80 chars; trimmed, whitespace-collapsed; never parsed for mechanics |
| Stack rule | every item entry moves exactly 1 unit |
| Suggestion list cap | 4 |
| `harm`/`heal` grades, pool depths | tokens fixed here; numeric maps are **D1b** |

## 8. Worked examples (executable acceptance cases)

License recap from Chapter 1 (pointer, not restatement): base `flavor_only` out of encounter /
`minor` in one; +1 step for a critical band; +1 for `extreme`/`legendary` tier; cap
`significant`. Budgets: 0 / 1 / 2 points. Every effect below is shown as its full payload;
per Chapter 1, every effect must be expressed in the annotation text and vice versa.

1. **Flavor-only license** (Chapter 1's rooftop lockwork: `marginal_success`, `standard`, no
   encounter → `flavor_only`, budget 0). Text: "it opens — the picks slip once, loudly." Effects:
   `[]` — legal. "The pick snaps" would demand
   `{op:"item_lose", owner:"character:7", item:"lockpicks"}` (1 pt) and is **over budget**:
   reword or let it ride. The same snap during a fight (`minor`, budget 1) carries it legally.
2. **In-combat crit failure** (`crit_failure`, encounter active → `minor`+1 = `significant`,
   budget 2). Text: "the haft splits on the doorframe — the axe is done — and your follow-through
   carries you stumbling out into the open courtyard." Effects:
   `[{op:"item_lose", owner:"character:7", item:"hand axe"},
   {op:"reposition", who:"character:7", area:"courtyard", quality:"unfavorable"}]` — 1 + 1 = 2/2,
   both adverse (hurt a party member), both stated in the text. Valid.
3. **Cyberpunk break-in, marginal failure** (encounter active → `minor`, budget 1). Text: "the
   node yields, but the breach klaxon starts screaming." Effects:
   `[{op:"scene_feature_place", area:"server-floor", kind:"alarm", name:"breach klaxon",
   duration:"scene"}]` — 1/1, adverse. Valid. (The `hindrance_apply(exposed)` variant is
   currently rejected with `GATED:conditions-store` — the validator names the gate.)
4. **Imperial court, marginal failure** (`extreme` tier, no encounter → `flavor_only`+1 =
   `minor`, budget 1). Text: "the Chancellor's smile thins." Effects:
   `[{op:"disposition_worsen", npc:"npc:31", step:"slight"}]` — 1/1, adverse (fixed). `marked`
   (significant, 2 pts) is out of reach: one faux pas cannot nuke the relationship.
5. **Firefight, marginal success** (encounter → `minor`, budget 1). Text: "the burst connects —
   and the rifle's last power cell runs dry." Effects:
   `[{op:"item_lose", owner:"character:7", item:"power cell"}]` — 1/1, adverse. Valid; and the
   emptied rifle its owner drops later is D16's loot story.
6. **Crit success against a foe — the valence proof** (`crit_success` in a duel, `legendary`
   tier → `flavor_only`+1+1 = `significant`, budget 2; beneficial only). Text: "your riposte
   drives her back onto the listing gangplank, and you see it now — her guard drops low when she
   lunges." Effects: `[{op:"reposition", who:"npc:12", area:"gangplank",
   quality:"unfavorable"}, {op:"fact_learn"}]` — reposition hurts a non-party target →
   **beneficial** (composition rule §3), fact_learn beneficial; 1 + 1 = 2/2. Valid. The disarm
   variant (`item_lose` on `npc:12`) awaits D16's NPC inventories — the validator names the gate.
7. **Evaluator rejections** (§1.1): two `item_condition_shift(degrade)` entries on the same sword
   in one array → second entry violates one-write-per-(target,property); `heal` on a full-health
   ally → no-op, rejected; `reposition` to the actor's current area → no-op, rejected. Each
   rejection re-enters Chapter 1's single-revision flow.
8. **The reword case, updated**: "the ceiling collapses, sealing the east wing *permanently*" is
   a layout edit — inexpressible (§6). But "rubble chokes the east door" is now legal state:
   `[{op:"scene_feature_place", area:"east-door", kind:"obstruction", name:"rubble fall",
   duration:"persistent"}]` (significant, 2 pts — needs a `significant` license). Under a `minor`
   license, scale it down (`duration:"scene"`, 1 pt) or reword. The wing seals only if something
   recorded seals it.

Coverage judgment (the E2 test, scoped by §6): across fantasy, cyberpunk, social, and ranged
play, actor- and scene-local GM-natural rulings map; §6 is the deliberate remainder. Reviewers
should attack exactly this claim.

## 9. Non-scope (tracked elsewhere)

Value derivation and all numeric maps for vitals/pools/value-modulation (**D1b**); the strain
pool (**D5**); zones (**D6**); the encounter machine and initiative (**D7**); dying/death
(**D9**); recovery and world-clock (**D10**); the item/NPC registries, item classes, wealth
field, NPC vitals, and movement plausibility (**D16**); freeform/legacy campaigns (**D13**);
ability packaging (**D3/D5**); faction standing and clocks (§6 — future catalog versions); and
the **ordinary-action commit path** — the ledgered transaction through which clean-band and
no-check state changes flow once rules-governed campaigns exist. That chapter reuses this
catalog's vocabulary, §1 validation, and §1.1 evaluator wholesale; only its authorization trigger
(resolved intent instead of an edge-band license) is new design.
