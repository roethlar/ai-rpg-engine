# Aetheria House Ruleset — Chapter 2: Effects

**Status**: DRAFT r3 — r1 and r2 were each reopened by both independent reviewers; every finding
was admitted (trail: `.agents/review/effect-catalog-review.md`). Not yet owner-signed;
implementation of Chapter 1's edge bands remains gated on this chapter's acceptance
(`docs/rules/resolution.md` §1.5).
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
  scene-local** consequence a human GM would rule maps to it. World-scale persistent state and
  actors without records — clocks, faction standing, off-screen NPC movement, reinforcements,
  opposition vitals — are deliberately *not yet* expressible; §6 names every such exception and
  its future home. When a ruling cannot map, the fallback is reword-or-flavor — never silent
  state drift, never an unledgered consequence.
- **E3 — Tokens in, numbers out; strings are subordinate to tokens.** Models emit operation
  tokens, enumerated parameters, typed recorded references, and — only where a §2 schema
  explicitly licenses one — a bounded string. The engine maps every token to numbers via
  code-owned config (§7); models never emit quantities. A licensed string is **color for its
  token, never a semantic channel**: §1 defines the per-string contract and its enforcement.
- **E4 — Every consequence has a home.** Chapter 1 owns the bidirectional text–effect coherence
  rule; this catalog exists so that rule always has a verb to point at.
- **E5 — Weight and valence are computed, never chosen.** Each entry's weight class, point cost,
  and *effective valence* derive from the operation, its parameters, and the acting character's
  frame (§3). The model's only choice is *which* operations to propose, within the stakes license.

## 1. Operation grammar and validation

An effect entry is an object whose fields are fixed per operation by the §2 schemas:

```
{ "op": "<operation token>", ...operation-specific fields }
```

**Field types** (the only kinds a schema may use):

- **Typed actor ref**: `"character:<id>"` or `"npc:<id>"` — the type prefix is mandatory because
  character and NPC integer ids occupy separate namespaces. The ref must resolve to a recorded
  actor in this campaign. Creature occupants have **no stable reference today** and are therefore
  not addressable by actor-targeted operations (§6; D8 owns opposition records).
- **Item key**: the exact name key of an entry in the named holder's recorded inventory
  (inventory is name-keyed with numeric quantities today; the D16 registry upgrades this to a
  record id). Resolution is always against the *holder named in the entry*.
- **Area id**: an area id from the current location's stored layout.
- **Feature ref**: the id of a recorded scene-feature record in the current location (§2.7).
- **Condition / pool / kind / side tokens and all other enums**: exactly the values a schema
  lists.
- **Licensed string** (`name`, `detail`): allowed only where a schema names one. Bounded (§7
  caps), engine-normalized (trimmed, whitespace-collapsed), and **subordinate to its token**:
  - an item `name` must denote a genre-plausible, unremarkable object — a string asserting
    rarity, power, uniqueness, or plot weight ("master key to the vault", "the lost crown") is
    rejected;
  - a condition `detail` states cause and color only — it may never assert mechanics beyond the
    token's engine semantics ("twisted ankle on the scree" for `hindered` passes; "paralyzed
    from the waist down" does not — that is a different, absent token);
  - a feature `name` is color for its `kind`; intensity lives in kind + duration, never in the
    words ("breach klaxon" passes; "citywide lockdown alert" over-asserts).
  Enforcement is Continuity's semantic gate — the same trust class as Chapter 1 delta reasons —
  applied at annotation validation; downstream council prompts must treat string content beyond
  the token as color, never as mechanics. The engine never parses a licensed string for
  quantities, classes, or properties. "A crate of 100 grenades" as a `name` yields exactly one
  mundane item whose name is a string; the 100 is decoration, not state.

**Validation order** (all before any commit; a failure rejects the entry into Chapter 1's
revision flow): catalog membership at the campaign's pinned catalog version → schema shape
(unknown op, missing/extra fields, out-of-enum values) → reference resolution (unresolvable
actor, item, area, feature, or condition) → availability → licensed-string semantic gate
(Continuity) → the array evaluator (§1.1) → Chapter 1's license budget and band-valence checks
(consuming §3's effective valence).

### 1.1 The effects-array evaluator (normative)

An annotation's `effects` array is validated and priced as one ordered pass:

1. Take an isolated **tentative state** snapshot of everything the array may touch. Reference
   resolution for each entry runs against the tentative state at that entry's position (an item
   lost by an earlier entry no longer resolves for a later one).
2. Evaluate entries **left to right**. Each entry must **change the tentative state**: an entry
   that cannot (heal at max, degrade past `broken`, wealth past a ladder end, disposition already
   at a clamp, re-applying an active condition, clearing an absent one, repositioning to the
   current area) is a **no-op and is rejected** — narrated change must be real change.
3. **Conflict keys**: at most one entry per conflict key per array. The key, per operation
   (computed after reference resolution):

   | Operation | Conflict key |
   |---|---|
   | `harm` / `heal` | (who, "health") |
   | `pool_drain` / `pool_restore` | (who, pool) |
   | `item_lose` / `item_gain` / `item_condition_shift` / `item_transfer` | (holder-resolved item — the specific inventory entry or record id); two *different* items never conflict |
   | `wealth_shift` | (who, "wealth") |
   | `disposition_improve` / `disposition_worsen` | (npc, "disposition") |
   | `reposition` | (who, "position") |
   | `hindrance_apply` / `boon_apply` / `condition_clear` | (who, condition token) |
   | `scene_feature_place` | (area, kind) |
   | `scene_feature_clear` | (feature ref) |
   | `encounter_start`, `fact_learn`, `value_reduce`, `value_enhance` | singleton — at most one entry with that op token per array |

4. Each entry's weight class and point cost are computed against the tentative state *at its
   position* (this makes state-dependent weights well-defined), its effective valence per §3;
   the summed cost must fit the license budget and every valence must fit the band.
5. If every entry passes, the tentative state commits **atomically** with the annotation, under
   Chapter 1's one-transaction-per-`checkId` idempotency. Any failure rejects the whole array;
   nothing partial ever executes.

**Availability**: `LIVE` operations execute against state and resolution rules that exist today;
`GATED:<dep>` operations are part of the accepted vocabulary but may not be proposed, suggested,
or executed until their gating feature ships — validation rejects them with the gate named,
exactly like an unknown op but distinguishably. Edge-band implementation may ship with the LIVE
subset; each gated verb activates with its feature. An operation whose *numeric map* or *record
shape* is gated is gated end-to-end: there is no "live seam" without a legal write.

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
`who` is restricted to characters because **NPCs and creatures carry no vitals today**; opposition
injury is D8/D16 scope and is listed in §6 until then. Death, dying, and 0-HP meaning are D9
scope: `harm` writes a number, never removes an actor.

### 2.2 Pools — GATED:D1b (strain additionally GATED:D5)

| Operation | Schema | State written | Weight | Direction |
|---|---|---|---|---|
| `pool_drain` | `{op, who: character ref, pool: mana\|strain, depth: shallow\|deep}` | `who`'s pool | shallow: minor; deep: significant | hurts `who` |
| `pool_restore` | same | same (≤ max) | same | helps `who` |

### 2.3 Items and wealth

| Operation | Schema | State written | Weight | Direction | Availability |
|---|---|---|---|---|---|
| `item_lose` | `{op, owner: actor ref, item: item key}` | one unit leaves `owner`'s inventory | by item class (§3) | hurts `owner` | LIVE for character owners; NPC owners GATED:D16 |
| `item_gain` | `{op, owner: actor ref, name: licensed string}` — **mundane form only** | one new mundane item (one unit) enters `owner`'s inventory | minor (mundane by construction) | helps `owner` | LIVE for character owners; NPC owners GATED:D16 |
| `item_transfer` | `{op, item: item key, from: actor ref, to: actor ref}` | the same item record moves holders — identity, condition, and provenance preserved | by item class (§3), **charged once** | hurts `from`, helps `to` — direction is the *net party effect* (§3) | GATED:D16 (needs item records with holders) |
| `item_condition_shift` | `{op, owner: actor ref, item: item key, direction: degrade\|improve}` | one step on `pristine`→`worn`→`damaged`→`broken` | step to `broken`: significant; else minor (priced on tentative state, §1.1) | degrade: hurts `owner`; improve: helps `owner` | GATED:D16 (condition lives on the item record) |
| `wealth_shift` | `{op, who: **npc ref**, direction: up\|down}` | one step on the §7 wealth ladder | minor | up: helps `who`; down: hurts `who` | GATED:D16 (the per-NPC wealth field; player-character wealth has **no approved home** — §6) |

**Stack rule**: every item entry moves **exactly one unit** — quantity is never a model input and
never prose-derived. **Acquisition has exactly two shapes**: `item_gain` mints a *mundane* item
(its `name` passes §1's semantic gate; the engine assigns class `mundane` and, once D16 ships,
condition `pristine`); every *recorded* item changes hands only via `item_transfer`, which is
atomic, priced once, and preserves the record — the laser rifle you loot is the recorded rifle
its owner carried, in whatever condition the fight left it (the D16 loot requirement). There is
no operation that mints significance (§6).

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

**Binding rule (occupancy rows carry no ids today)**: `who` resolves to the occupancy row whose
`name` exactly equals the recorded actor's name and whose `kind` matches the ref type
(`character:` → `player`, `npc:` → `npc`). The actor must already be a current occupant —
`reposition` moves people *within* the scene, never into it (arrivals are §6). Zero matches (the
actor is not in the scene) or multiple matches (duplicate names) → **reject**, stated reason; no
silent creation. Stable occupancy identifiers are a noted D16-adjacent improvement, not assumed.
`quality` is a declared judgment the engine cannot compute from geometry; Continuity validates it
against the annotation text ("shoved into the open courtyard" cannot be `favorable`) — the same
semantic gate as delta reasons, and it is an identifier, never a number. Moving `who` to their
current area is a no-op (§1.1).

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
`detail` is cause/color under §1's semantic gate, and doubles as the citable fictional fact a
Chapter 1 situational delta may reference — one-fact-one-home applies unchanged. **Scene boundary
(v1 proxy, stated)**: a `scene`-duration condition clears when the campaign's current-location
pointer changes — the one observable boundary today; D7's encounter machine may refine it.
`persistent` lasts until explicitly cleared. **v1 semantics are deliberately thin**: a condition
is a ledgered, duration-bounded established fact; it carries no arithmetic of its own.

### 2.7 Scene features — GATED:scene-state

| Operation | Schema | State written | Weight | Valence |
|---|---|---|---|---|
| `scene_feature_place` | `{op, area: area id, kind: obstruction\|hazard\|smoke\|darkness\|alarm\|cover, name: licensed string, duration: scene\|persistent, works_against: party\|opposition}` | a scene-feature record | scene: minor; persistent: significant | composed from `works_against` (§3): against party → adverse; against opposition → beneficial |
| `scene_feature_clear` | `{op, feature: feature ref}` | removes that record | minor | computed from the stored `works_against`: clearing an against-party feature → beneficial; an against-opposition feature → adverse |

**Required state addition (declared, not yet built) — the scene-feature record**:
`{ id, location, area, kind, name, duration, works_against, source: checkId, appliedTurn }`. The
r2 idea of riding the existing occupancy layer is withdrawn: occupancy rows
(`{name, kind, area, note}`) cannot hold kind, duration, or side without parsing strings for
mechanics, which §1 forbids. Features are temporary scene state — rubble across a door, smoke in
the hall, a klaxon blaring — and **never edit the stored layout** (§6). Scene-duration features
clear on the same location-pointer boundary as conditions. `works_against` is a declared judgment
validated by Continuity against the text (smoke covering *your* escape works against the
opposition; rubble blocking *your* retreat works against the party); `scene_feature_clear`'s
valence is engine-computed from the stored field — no declaration to trust.

### 2.8 Scene and canon

| Operation | Schema | State written | Weight | Effective valence (fixed) | Availability |
|---|---|---|---|---|---|
| `encounter_start` | `{op, posture: hostile\|social_standoff, participants: [npc refs present in the current location]}` | the encounter state machine | significant | adverse | GATED:D7 (today only a per-turn pacing enum exists) |
| `fact_learn` | `{op}` — targetless | one party-scope memory row: summary = the annotation text, importance = engine config default (§7), keywords engine-derived | minor | beneficial | LIVE (campaign memories) |

`fact_learn` is the canon-commitment verb: "you notice the vault hinge is mounted backwards"
becomes a recorded fact later checks and narration must honor. **Idempotency and linkage,
stated precisely**: the memory row is written inside the annotation's atomic transaction, which
commits at most once per `checkId` — so duplicates cannot occur and the roll ledger (which
already stores the annotation text and its effects) remains the authoritative check-to-fact
linkage; the memory row is a retrieval copy, mapped losslessly onto today's memory schema with no
new column. The op has no model-emitted importance — that number is engine config. It is
beneficial-only (the party learning something is the benefit); adverse discoveries ("the alarm is
raised") are expressed by the verb that changes the state, never by a "bad fact".

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
2. The **frame**: the acting character and all player characters are *party*; every NPC is
   *non-party* (v1 coarseness, stated: allied NPCs count as non-party until a
   recorded-allegiance home exists — D8/D16; creatures have no refs at all, §1).
3. Compose: **helps party → beneficial; hurts party → adverse; hurts non-party → beneficial;
   helps non-party → adverse.** A crit-success shove that sends a foe stumbling is beneficial; a
   marginal failure may not "complicate" the scene by disadvantaging the enemy — that inversion
   is exactly what this rule exists to reject. `item_transfer` composes on its *net* party
   effect: a transfer into a party member's hands is beneficial, out of them adverse,
   NPC-to-NPC by whichever side the party sits on per the same rule.
4. Side-composed ops: scene features use `works_against` through the same frame (§2.7).
5. Fixed-valence ops (disposition, `fact_learn`, `encounter_start`, value modulation) skip
   composition; each states its rationale in §2.

**Weight**: per the §2 tables. *By item class*: `minor` for mundane-class, `significant` for
significant-class items; classes are D16 registry data — until D16 ships, every item is
mundane-class (and every operation needing the record is gated anyway). State-dependent weights
(degrade-to-broken) are priced on the tentative state (§1.1). **Costs and budgets**: Chapter 1
§1.5 owns them (`minor` = 1, `significant` = 2; budgets 0/1/2). The model never emits a weight,
cost, or valence; validation recomputes all three, so a mismatch is impossible by construction.

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
- **injuring opposition at all** — NPCs and creatures carry no vitals (**D8/D16**);
- **introducing actors into the scene** — reinforcements, summons, arrivals: no ref exists for
  an unrecorded actor, `reposition` only moves current occupants, and `encounter_start` only
  names those present (**D7/D8/D16**);
- **addressing creatures** — creature occupants have no stable reference (**D8**);
- attribute, skill, XP, level, or advancement changes (**D4/D5**);
- act or plot-outline transitions (the outline system, **D15**);
- **permanent layout or map edits** — scene features (§2.7) are temporary records, never layout;
- minting significant items from nothing (§2.3; registry is **D16**);
- **player-character wealth** — D16 records a coarse wealth category *for NPCs*; a PC-wealth
  subsystem would need its own owner decision;
- **time pressure, countdowns, and clocks** — no world/scene clock exists; future home: the
  encounter machine and recovery/world-clock work (**D7/D10**);
- **faction or organization standing** — only per-NPC disposition exists; a faction axis is a
  future catalog version;
- **off-screen NPC movement or presence in another location** — the plausibility-bounded
  movement seam is **D16**;
- seat, permission, fork, or timeline operations (multiplayer/infra, not fiction);
- a check's outcome fields (Chapter 1).

The coverage claim (E2) is scoped accordingly: actor- and scene-local consequences over
*recorded* entities map; this list is what deliberately does not, yet. The fallback is Chapter
1's rule: reword to the expressible footprint, or let it be flavor — mechanically inert color is
always legal.

## 7. Config block (engine-owned, provisional)

All token→number maps and bounds live here; every value is provisional pending playtest, and
recalibration is config, not redesign.

| Config | Provisional value |
|---|---|
| Disposition steps | `slight` = ±10, `marked` = ±25 (sign by op; clamp −100…+100) |
| Item condition ladder | `pristine` → `worn` → `damaged` → `broken` (one step per shift) |
| Wealth ladder (tokens here; the per-NPC field is D16's) | `destitute` \| `struggling` \| `comfortable` \| `wealthy` \| `opulent` |
| Hindrance starter set | `hindered`, `exposed`, `dazed`, `pinned`, `winded` |
| Boon starter set | `steadied`, `inspired`, `concealed` |
| Durations | `scene` (clears when the campaign's current-location pointer changes — v1 proxy, D7 may refine), `persistent` (until cleared) |
| Scene-feature kinds | `obstruction`, `hazard`, `smoke`, `darkness`, `alarm`, `cover` |
| Feature sides | `works_against` ∈ `party` \| `opposition` |
| Licensed string caps | `name` ≤ 48 chars, `detail` ≤ 80 chars; trimmed, whitespace-collapsed; subordinate to their token (§1); never parsed for mechanics |
| `fact_learn` importance | engine default 3 (never model-emitted) |
| Stack rule | every item entry moves exactly 1 unit |
| Suggestion list cap | 4 |
| `harm`/`heal` grades, pool depths | tokens fixed here; numeric maps are **D1b** |

## 8. Worked examples (executable acceptance cases)

License recap from Chapter 1 (pointer, not restatement): base `flavor_only` out of encounter /
`minor` in one; +1 step for a critical band; +1 for `extreme`/`legendary` tier; cap
`significant`. Budgets: 0 / 1 / 2 points. Every effect below is shown as its full payload; per
Chapter 1, every effect must be expressed in the annotation text and vice versa. Cases 1–6 use
LIVE operations only; case 7 specifies gate behavior; case 8 specifies evaluator rejections.

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
   both adverse (hurt a party member), both stated in the text; the actor is a current occupant,
   so the binding rule resolves. Valid.
3. **Cyberpunk break-in, marginal failure** (encounter active → `minor`, budget 1). The intent
   **fails** — no partial achievement: "the payload dies in the buffer, and on the way out the
   grid warden's suspicion hardens into certainty." Effects:
   `[{op:"disposition_worsen", npc:"npc:44", step:"slight"}]` — 1/1, adverse (fixed). Valid. The
   klaxon variant (`scene_feature_place`) is currently rejected with `GATED:scene-state`.
4. **Imperial court, marginal failure** (`extreme` tier, no encounter → `flavor_only`+1 =
   `minor`, budget 1). Text: "the Chancellor's smile thins." Effects:
   `[{op:"disposition_worsen", npc:"npc:31", step:"slight"}]` — 1/1, adverse (fixed). `marked`
   (significant, 2 pts) is out of reach: one faux pas cannot nuke the relationship.
5. **Firefight, marginal success** (encounter → `minor`, budget 1). Text: "the burst connects —
   and the rifle's last power cell runs dry." Effects:
   `[{op:"item_lose", owner:"character:7", item:"power cell"}]` — 1/1, adverse. Valid; the
   emptied rifle its owner later drops is `item_transfer`'s story once D16 ships.
6. **Crit success against a foe — the valence proof** (`crit_success` in a duel, `legendary`
   tier → `flavor_only`+1+1 = `significant`, budget 2; beneficial only). Text: "your riposte
   drives her back onto the listing gangplank, and you see it now — her guard drops low when she
   lunges." Effects: `[{op:"reposition", who:"npc:12", area:"gangplank",
   quality:"unfavorable"}, {op:"fact_learn"}]` — reposition hurts a non-party occupant →
   **beneficial** (composition, §3); `fact_learn` beneficial; 1 + 1 = 2/2; `npc:12` is a current
   occupant with a unique name. Valid.
7. **Gate behavior**: `{op:"item_transfer", item:"curved saber", from:"npc:12",
   to:"character:7"}` (the disarm-and-claim ruling) → rejected `GATED:D16`, gate named, single
   revision allowed per Chapter 1; the Referee rewords ("the saber skitters away across the
   deck" — flavor) or spends the license elsewhere. Same shape for `hindrance_apply`
   (`GATED:conditions-store`) and `harm` (`GATED:D1b`).
8. **Evaluator rejections** (§1.1): two `item_condition_shift(degrade)` entries on the same
   sword → conflict key collision; `heal` on a full-health ally → no-op; `reposition` to the
   actor's current area → no-op; `reposition` of an NPC not in the current occupancy → binding
   failure; `{op:"item_gain", owner:"character:7", name:"master key to the vault"}` → licensed-
   string semantic rejection (§1). Each rejection re-enters Chapter 1's single-revision flow.

Coverage judgment (the E2 test, scoped by §6): across fantasy, cyberpunk, social, and ranged
play, actor- and scene-local rulings over recorded entities map; §6 is the deliberate remainder.
Reviewers should attack exactly this claim.

## 9. Non-scope (tracked elsewhere)

Value derivation and all numeric maps for vitals/pools/value-modulation (**D1b**); the strain
pool (**D5**); zones (**D6**); the encounter machine and initiative (**D7**); dying/death
(**D9**); recovery and world-clock (**D10**); the item/NPC registries, item classes, per-NPC
wealth, NPC vitals, and movement plausibility (**D16**); freeform/legacy campaigns (**D13**);
ability packaging (**D3/D5**); faction standing, clocks, actor arrival, creature references, and
player-character wealth (§6 — future catalog versions or their named decisions); the
**conditions store** and **scene-feature record** (declared required state additions, §2.6/§2.7);
and the **ordinary-action commit path** — the ledgered transaction through which clean-band and
no-check state changes flow once rules-governed campaigns exist. That chapter reuses this
catalog's vocabulary, §1 validation, and §1.1 evaluator wholesale; only its authorization trigger
(resolved intent instead of an edge-band license) is new design.
