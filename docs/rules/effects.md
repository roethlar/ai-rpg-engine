# Aetheria House Ruleset — Chapter 2: Effects

**Status**: DRAFT r5 — rounds r1–r4 were each reopened by both independent reviewers; every
admitted finding is addressed in place (trail and the two recorded disputes:
`.agents/review/effect-catalog-review.md`). Not yet owner-signed; implementation of Chapter 1's
edge bands is gated on this chapter's acceptance **and on a real active-encounter lifecycle for
license pricing (see §3 — pre-D7 the encounter input is conservatively false)**.
**Provenance**: D2 decision 2026-07-16 (`.agents/decisions.md`: complications are free text over
an engine verb set; trust is tuned by the ledgered stakes license, never by unledgered effects);
Chapter 1's executable contract (§1.5); the recorded D16 requirements (loot, wealth, movement) in
`.agents/review/rules-system-plan-intake.md`.

## 0. Design principles

- **E1 — Verbs, not content.** This catalog is a vocabulary of state *operations* with one shared
  validation core and per-consumer authorization (§1) — never a table of pre-written
  complications. Narrative variety lives in free text; the catalog makes its mechanical footprint
  executable and auditable. The catalog has three consumers: **edge-band annotations** (Chapter 1
  §1.5 — authorized here), **generated abilities** (§5 — authorization is D3/D5 scope), and the
  **ordinary-action commit path** (a declared future chapter, §9). End state, per the D2
  decision's "any mechanical consequence must map to an engine verb": once a campaign is
  rules-governed, *no free-form state-change seam survives*; today's free-form turn seams are
  migration targets, not permanent bypasses.
- **E2 — Say yes, within the scene.** The vocabulary is wide enough that almost any consequence a
  human GM would rule over **recorded actors and their held items** — plus, once their stores
  ship, conditions and temporary scene features — maps to it. Everything else that a GM might
  naturally rule (recorded scene objects, unrecorded actors, world-scale state, intelligence
  state) is deliberately *not yet* expressible; §6 names every such exception and its future
  home. When a ruling cannot map, the fallback is reword-or-flavor — where flavor means
  **mechanically inert**: text that asserts no change to possession, position, or availability.
  Never silent state drift, never an unledgered consequence.
- **E3 — Tokens in, numbers out; strings are subordinate to tokens.** Models emit operation
  tokens, enumerated parameters, typed recorded references, and — only where a §2 schema
  explicitly licenses one — a bounded string. The engine maps every token to numbers via
  code-owned config (§7); models never emit quantities. A licensed string is **color or a
  gate-checked payload for its token, never a covert semantic channel**: §1 defines each
  string's contract and its enforcement.
- **E4 — Every consequence has a home.** Chapter 1 owns the bidirectional text–effect coherence
  rule; this catalog exists so that rule always has a verb to point at.
- **E5 — Weight and valence are computed, never chosen.** Each entry's weight class, point cost,
  and *effective valence* derive from the operation, its parameters, and the acting character's
  frame (§3). The model's only choice is *which* operations to propose, within its consumer's
  authorization.

## 1. Operation grammar and validation

An effect entry is an object whose fields are fixed per operation by the §2 schemas:

```
{ "op": "<operation token>", ...operation-specific fields }
```

**Field types** (the closed set a schema may use):

- **Typed actor ref**: `"character:<id>"` or `"npc:<id>"` — the type prefix is mandatory because
  character and NPC integer ids occupy separate namespaces. The ref must resolve to a recorded
  actor in this campaign. Creature occupants have **no stable reference today** and are therefore
  not addressable (§6; D8 owns opposition records).
- **Item key**: the exact name key of an entry in the named holder's recorded inventory
  (name-keyed today; the D16 registry upgrades this to a record id). Resolution is always against
  the holder the schema names for that op, on the tentative state (§1.1), and requires **exactly
  one** match — zero or multiple same-named entries reject with a stated reason (current state
  does not enforce name uniqueness; implementations must reject, never guess).
- **Item-record ref** (D16): `"item:<record id>"` — a registry item record. Resolution: the
  record must exist and its current holder must satisfy the schema's stated constraint (e.g.
  scene-held in the current location, on the tentative state), with the exactly-one rule trivial
  by id.
- **Area id**: an area id from the current location's stored layout, resolved with the same
  **exactly-one** rule (duplicate ids in a stored layout reject rather than guess).
- **Feature ref**: the id of a recorded scene-feature record in the current location (§2.7).
- **Condition / pool / kind / side / outcome tokens and all other enums**: exactly the values a
  schema lists. Every condition and feature token carries **canonical semantics and an overclaim
  boundary** (§7) — the gate below enforces those boundaries.
- **Licensed string** (`name`, `detail`, `fact`): allowed only where a schema names one. Bounded
  (§7 caps), engine-normalized (trimmed, whitespace-collapsed), and **subordinate to its token**:
  - an item `name` must denote a genre-plausible, unremarkable object — a string asserting
    rarity, power, uniqueness, plot weight, **counts, contents, or mechanical properties** is
    **rejected** ("master key to the vault", "the lost crown", "a crate of 100 grenades", "vial
    of instant-death poison" all reject; "bent copper key", "coil of rope" pass);
  - a condition `detail` states cause and color only — it may never assert mechanics beyond the
    token's §7 semantics ("twisted ankle on the scree" for `hindered` passes; "paralyzed from
    the waist down" does not — that is a different, absent token);
  - a feature `name` is color for its `kind`; intensity lives in kind + duration, never in the
    words ("breach klaxon" passes; "citywide lockdown alert" over-asserts);
  - a `fact` payload obeys §2.8's single-fact contract.
  Enforcement is Continuity's semantic gate — the same trust class as Chapter 1 delta reasons;
  downstream council prompts must treat string content beyond the token as color, never as
  mechanics. The engine never parses a licensed string for quantities, classes, or properties.

**Validation pipeline** — factored into a consumer-independent core plus per-consumer
authorization. For edge-band annotations this instantiates Chapter 1 §5's fixed handoff
(Continuity before engine; rejections from either share the single-revision allowance):

1. **Continuity (semantic core)**: bidirectional text–effect coherence; consistency with
   established fiction; the licensed-string gates above; the declared-judgment affirmations
   (`quality`, `works_against`, `outcome`, target opposition per §3); `fact` singularity and
   novelty (§2.8). On pass, Continuity emits an engine-readable **`affirmedOpposed` set** — the
   NPC refs it affirmed as presently opposed — recorded with the annotation; the engine composes
   frame valence *only* from that set (§3) and never re-derives fiction.
2. **Engine (mechanical core)**: catalog membership at the campaign's pinned catalog version →
   **availability** (a gated op rejects here, with its gate named, *before* any
   dependency-owned lookup — a `GATED:D16` op must never surface as "unresolvable reference") →
   schema shape (unknown op, missing/extra fields, out-of-enum values) → reference resolution
   (per the field-type rules, against the tentative state) → the array evaluator (§1.1). The
   core's outputs are each entry's computed weight, point cost, and effective valence.
3. **Authorization (per consumer)**: edge-band annotations check the summed cost against the
   stakes-license budget and every effective valence against the band (Chapter 1 §1.5), with
   **neutral valence always illegal**. Ability authorization is D3/D5 scope; ordinary-action
   authorization is its own chapter (§9) and is the only consumer that may admit neutral
   effects. A consumer never re-runs or skips core steps.

### 1.1 The effects-array evaluator (normative)

An annotation's `effects` array is validated and priced as one ordered pass:

1. Take an isolated **tentative state** snapshot of everything the array may touch. Reference
   resolution for each entry runs against the tentative state at that entry's position (an item
   lost by an earlier entry no longer resolves for a later one).
2. Evaluate entries **left to right**. Each entry must **change the tentative state**: an entry
   that cannot (heal at max, degrade past `broken`, wealth past a ladder end, disposition already
   at a clamp, re-applying an active condition, clearing an absent one, repositioning to the
   current area) is a **no-op and is rejected** — narrated change must be real change.
   Additionally, an array whose final tentative state equals its starting state (mutually
   cancelling entries) is rejected wholesale.
3. **Conflict keys**: at most one entry per conflict key per array. The key, per operation
   (computed after reference resolution):

   | Operation | Conflict key |
   |---|---|
   | `harm` / `heal` | (who, "health") |
   | `pool_drain` / `pool_restore` | (who, pool) |
   | `item_lose` / `item_transfer` / `item_drop` / `item_pickup` / `item_condition_shift` | (the holder-resolved item entry or record id); two *different* items never conflict |
   | `item_gain` | (owner, normalized `name`) — the minted entry's synthetic identity; it also collides with any other item op resolving to that same (owner, name) entry |
   | `wealth_shift` | (who, "wealth") |
   | `disposition_improve` / `disposition_worsen` | (npc, "disposition") |
   | `reposition` / `scene_exit` | (who, "presence") |
   | `hindrance_apply` / `boon_apply` / `condition_clear` | (who, condition token) |
   | `scene_feature_place` | (area, kind) |
   | `scene_feature_clear` | (feature ref) |
   | `value_reduce` / `value_enhance` | shared: (current check, "derived-value") |
   | `encounter_start` / `encounter_end` | shared: (current encounter state) |
   | `fact_learn` | singleton per array |

4. Each entry's weight class and point cost are computed against the tentative state *at its
   position* (this makes state-dependent weights well-defined), and its effective valence per
   §3. These are the core's outputs; §1's authorization step consumes them.
5. If every entry passes core validation and the consumer's authorization, the tentative state
   commits **atomically** with the annotation, under Chapter 1's one-transaction-per-`checkId`
   idempotency. Any failure rejects the whole array; nothing partial ever executes.

**Availability**: `LIVE` operations execute against state and resolution rules that exist today;
`GATED:<dep>` operations are part of the accepted vocabulary but may not be proposed, suggested,
or executed until their gating feature ships — validation rejects them at the availability step
with the gate named. Edge-band implementation may ship with the LIVE subset (subject to §3's
pre-D7 license rule); each gated verb activates with its feature. An operation whose *numeric
map* or *record shape* is gated is gated end-to-end: there is no "live seam" without a legal
write.

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
| `item_lose` | `{op, owner: actor ref, item: item key}` | one unit leaves play from `owner`'s inventory | by item class (§3) | hurts `owner` | LIVE for character owners **with the mundane check below**; NPC owners GATED:D16 |
| `item_gain` | `{op, owner: actor ref, name: licensed string}` — **mundane form only**; pre-D16, rejects if the normalized `name` matches **any** existing entry in `owner`'s inventory (no stacking onto — or shadowing of — existing, possibly special, items) | one new mundane item enters `owner`'s inventory; the engine constructs the stored record as `{name: <normalized>, type: "general", description: "No description.", quantity: 1}` and ignores every other property — the model supplies the name and nothing else. Post-D16: a fresh engine-minted record id, classified mundane, provenance stamped | minor (mundane by construction) | helps `owner` | LIVE for character owners; NPC owners GATED:D16 |
| `item_transfer` | `{op, item: item key, from: actor ref, to: actor ref}` — `item` resolves **against `from`** on the tentative state; `from ≠ to` required | the same item record changes holders — identity, condition, and provenance preserved | by item class (§3), **charged once** | net party effect (§3; same-frame nets defined there) | GATED:D16 (needs item records with holders) |
| `item_drop` | `{op, owner: actor ref, item: item key, area: area id}` | the record's holder becomes the scene (that area); identity/condition/provenance preserved | by item class (§3) | hurts `owner` | GATED:D16 (records with location holders) |
| `item_pickup` | `{op, owner: actor ref, item: item-record ref}` — the record's current holder must be the current location (scene-held), on the tentative state | the record's holder becomes `owner` | by item class (§3) | helps `owner` | GATED:D16 |
| `item_condition_shift` | `{op, owner: actor ref, item: item key, direction: degrade\|improve}` | one step on `pristine`→`worn`→`damaged`→`broken` | step to `broken`: significant; else minor (priced on tentative state, §1.1) | degrade: hurts `owner`; improve: helps `owner` | GATED:D16 (condition lives on the item record) |
| `wealth_shift` | `{op, who: **npc ref**, direction: up\|down}` | one step on the §7 wealth ladder | minor | up: helps `who`; down: hurts `who` | GATED:D16 (the per-NPC wealth field; player-character wealth has **no approved home** — §6) |

**Stack rule**: every item entry moves **exactly one unit** — quantity is never a model input and
never prose-derived. **Custody, stated precisely**: `item_lose` means the unit is *gone from
play* (swallowed by the chasm, burned up) — pre-D16 that deletes the inventory entry/unit;
post-D16, durable records persist with holder `lost` and full provenance (destruction of a
durable record is a future op, not this one). A recoverable parting is `item_drop` (custody moves
to the scene) and recovery is `item_pickup`; between actors it is `item_transfer`, atomic and
priced once. **The pre-D16 mundane check**: because no class field exists yet, `item_lose` on a
LIVE inventory entry additionally passes Continuity's mundane gate (the same §1 standard as
`item_gain` names) — an entry whose name/description reads as unique, powerful, or plot-weighted
rejects pending D16 classification; a legacy artifact cannot be destroyed for one point as
"mundane". **No minting significance**: `item_gain` constructs mundane items only; every recorded
item moves through transfer/drop/pickup, which preserve the record — the laser rifle you loot is
the recorded rifle its owner carried, in whatever condition the fight left it (the D16 loot
requirement).

### 2.4 Disposition — LIVE

| Operation | Schema | State written | Weight | Effective valence (fixed — see below) |
|---|---|---|---|---|
| `disposition_improve` | `{op, npc: npc ref, step: slight\|marked}` | that NPC's `relationship_value` (engine-mapped ±, clamped −100…+100) | slight: minor; marked: significant | beneficial |
| `disposition_worsen` | same | same | same | adverse |

**Party-frame exception (deliberate)**: disposition valence is fixed, not frame-composed — these
ops need no opposition affirmation and may target any recorded NPC. The relationship value
measures the party's standing with that NPC — an asset of the party — so improving it is
beneficial and worsening it adverse no matter whose action moved it. Consequence, acknowledged:
"the enemy now fears you" is not expressible as a beneficial disposition write; the single
like/dislike axis has no fear/respect channel (a future catalog version may add one). Use
`fact_learn`, a boon, or flavor.

**Migration note (honest)**: today's turn contract lets the model emit a free integer
`relationship_change` (−50…+50), Referee-adjudicated damage numbers, and free-form occupancy
rewrites — all predate this chapter and violate tokens-in/numbers-out. Under rules-governed
campaigns those seams migrate to catalog operations; freeform/legacy behavior is D13 scope, not
silently changed.

### 2.5 Position and presence — LIVE (refined by D6 zones)

| Operation | Schema | State written | Weight | Direction |
|---|---|---|---|---|
| `reposition` | `{op, who: actor ref, area: area id, quality: favorable\|unfavorable\|neutral}` | `who`'s occupancy entry moves to `area` | minor | `quality` declares it: favorable helps `who`, unfavorable hurts `who`; `neutral` is legal only under ordinary authorization (§1, §3) |
| `scene_exit` | `{op, who: **npc ref**, quality: favorable\|unfavorable\|neutral}` | `who`'s occupancy entry is removed — they leave the scene (flee, slip away, get hurled out) | minor | as above, declared for the exiter |

**Binding rule (occupancy rows carry no ids today)**: `who` resolves to the occupancy row whose
`name` exactly equals the recorded actor's name and whose `kind` matches the ref type
(`character:` → `player`, `npc:` → `npc`). The actor must already be a current occupant — these
ops move or remove people *within* the scene, never into it (arrivals are §6). Zero matches or
multiple matches → **reject**, stated reason; no silent creation. Stable occupancy identifiers
are a noted D16-adjacent improvement, not assumed. `quality` is a declared judgment the engine
cannot compute; Continuity validates it against the annotation text ("shoved into the open
courtyard" cannot be `favorable`) — the same semantic gate as delta reasons, and it is an
identifier, never a number. Moving `who` to their current area is a no-op (§1.1). `scene_exit`
is NPC-only: a *party member* forced out of the location is a campaign-location transition, not a
scene edit (§6). Where the exiter went is deliberately unrecorded until D16's movement seam —
what is ledgered is that they are no longer present.

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
is a ledgered, duration-bounded established fact whose meaning and overclaim boundary are fixed
in §7; it carries no arithmetic of its own.

### 2.7 Scene features — GATED:scene-state

| Operation | Schema | State written | Weight | Valence |
|---|---|---|---|---|
| `scene_feature_place` | `{op, area: area id, kind: obstruction\|hazard\|smoke\|darkness\|alarm\|cover, name: licensed string, duration: scene\|persistent, works_against: party\|opposition\|both}` | a scene-feature record | scene: minor; persistent: significant | composed from `works_against` (§3): `party` → adverse; `opposition` → beneficial; `both` → **adverse by rule** (a mutual hazard always costs the party; it can never be a pure boon) |
| `scene_feature_clear` | `{op, feature: feature ref}` | removes that record | minor | computed from the stored `works_against`: clearing `party`-hindering → beneficial; `opposition`-hindering → adverse; `both` → beneficial |

**Required state addition (declared, not yet built) — the scene-feature record**:
`{ id, location, area, kind, name, duration, works_against, source: checkId, appliedTurn }`.
Occupancy rows (`{name, kind, area, note}`) cannot hold kind, duration, or side without parsing
strings for mechanics, which §1 forbids — hence the record. Features are temporary scene state —
rubble across a door, smoke in the hall, a klaxon blaring — and **never edit the stored layout**
(§6); nor do they touch *recorded* scene objects, which have no vocabulary yet (§6).
Scene-duration features clear on the same location-pointer boundary as conditions.
`works_against` is a declared judgment validated by Continuity against the text;
`scene_feature_clear`'s valence is engine-computed from the stored field — no declaration to
trust.

### 2.8 Scene and canon

| Operation | Schema | State written | Weight | Valence | Availability |
|---|---|---|---|---|---|
| `encounter_start` | `{op, posture: hostile\|social_standoff, outcome: party_favored\|party_costing, participants: [1..cap unique npc refs, each bound to a current occupant via §2.5's binding rule]}` | the encounter state machine | significant | composed from `outcome` (Continuity-validated against the text): `party_favored` — the party forced the fight it wanted → beneficial; `party_costing` — trouble found the party → adverse | GATED:D7 (today only a per-turn pacing enum exists) |
| `encounter_end` | `{op, outcome: party_favored\|party_costing}` | the encounter state machine — the active encounter concludes | minor | composed from `outcome`: rout/de-escalation in the party's favor → beneficial; surrender, capture, forced truce against the party → adverse | GATED:D7 |
| `fact_learn` | `{op, fact: licensed string}` | one party-scope memory row: summary = the `fact` string, importance = engine config default (§7), keywords engine-default empty | minor | beneficial (fixed) | LIVE (campaign memories) |

Encounter lifecycle cost is **fixed regardless of participant count** — legality, not cost,
bounds the list (unique, 1..cap per §7, every ref bound to a present occupant). `outcome` is the
same declared-judgment class as `quality`: Continuity rejects a declaration the text contradicts,
and the engine composes valence only from the validated token.

`fact_learn` is the canon-commitment verb — and its payload is deliberately narrow: `fact` states
**exactly one** verifiable fictional fact, expressed in the annotation text, asserting no
quantities and no mechanics beyond established scene truths ("the vault hinge is mounted
backwards" passes; "the vault holds 10,000 crowns and its guardian is vulnerable to fire" is two
facts, one of them a mechanics claim — rejected). Continuity checks singularity, novelty (a fact
already established is a no-op → rejected), and text expression. **Idempotency and linkage**: the
memory row is written inside the annotation's atomic transaction (at most once per `checkId`);
the roll ledger remains the authoritative check-to-fact linkage; the memory row is a retrieval
copy on today's schema, no new column. **Retrieval honesty**: current council context includes a
bounded window of high-importance/recent memories, so an old fact can fall out of the prompt;
the fact's binding force lives in the ledger and Continuity's checks, and a stronger retrieval
contract is named future work (§9). The op is beneficial-only (the party learning something is
the benefit); adverse discoveries are expressed by the verb that changes the state, never by a
"bad fact" — and *NPC/world* intelligence state (a blown cover, a burned password) has no verb
yet at all (§6).

### 2.9 Check-value modulation — GATED:D1b

| Operation | Schema | State written | Weight | Effective valence (fixed) |
|---|---|---|---|---|
| `value_reduce` | `{op}` — targetless, bound to the current `checkId` | the derived values of the checked action itself (channel enum is D1b scope) | minor | adverse |
| `value_enhance` | same | same | minor | beneficial |

Both share one conflict key (§1.1), so an array can never contain the cancelling pair. These
modulate value **derivation** only ("a glancing blow"). Chapter 1's outcome fields (`T`, `raw`,
`band`, …) are immutable; no operation in this catalog can touch them.

## 3. Weight, cost, and effective valence — the license interface

**Effective valence** (what the §1 authorization step consumes) is computed, never emitted.
Valence classes are `beneficial`, `adverse`, and `neutral` — **neutral is illegal in edge-band
annotations** (Chapter 1 admits only band-matching valences) and exists so the ordinary-action
consumer (§9) can authorize genuinely neutral changes (a no-check walk across the room, setting
a pack down) without false labeling; the full audit of directional ops for ordinary use belongs
to that chapter.

1. Ops with a **Direction** column declare whether they help or hurt their target actor
   (`quality`-style enums may also declare `neutral`).
2. The **frame**: the acting character and all player characters are *party*. NPCs have no
   recorded allegiance today, so frame composition against an NPC is legal **only for targets in
   the annotation's Continuity-emitted `affirmedOpposed` set** (§1) — the engine never
   re-derives fiction; a frame-composed NPC target absent from the set rejects with reason
   `allegiance-unknown`. Helping an *allied* NPC as an edge-band boon is consequently
   inexpressible until a recorded-allegiance home exists (§6, D8/D16). Creatures have no refs at
   all (§1). Fixed-valence ops (disposition, `fact_learn`) ignore the set.
3. Compose: **helps party → beneficial; hurts party → adverse; hurts affirmed-opposed non-party →
   beneficial; helps affirmed-opposed non-party → adverse.** A crit-success shove that sends a
   foe stumbling is beneficial; a marginal failure may not "complicate" the scene by
   disadvantaging the enemy — that inversion is exactly what this rule exists to reject.
4. **Same-frame nets** (`item_transfer`): party→opposed-NPC is adverse; opposed-NPC→party is
   beneficial. **PC→PC is neutral** — custody never leaves the party — hence illegal on edge
   bands and legal only under ordinary authorization. **NPC→NPC rejects** pending recorded
   allegiance.
5. Side-composed ops: scene features use `works_against`, encounter lifecycle uses `outcome`,
   each through the same frame (§2.7, §2.8).
6. Fixed-valence ops (disposition, `fact_learn`, value modulation) skip composition; each states
   its rationale in §2.

**The encounter-active license input, pre-D7 (conservative by rule)**: Chapter 1's stakes-license
map takes "is an encounter active" as an input, but no persistent encounter lifecycle exists
today — the per-turn pacing enum records initiation cadence, not activity, and **must not be used
as a proxy**. Until D7 ships a deterministic lifecycle, the encounter-active input is
**constantly false**: licenses are never wider than the fiction warrants, only narrower (base
`flavor_only`; critical bands and extreme/legendary tiers still raise it to `minor`).
**Owner-visible consequence, flagged**: until encounters exist, mechanical complications are rare
and small — mid-fight texture arrives with D7. This is a shipping-order fact, not a design
change.

**Weight**: per the §2 tables. *By item class*: `minor` for mundane-class, `significant` for
significant-class items; classes are D16 registry data — until D16 ships, every LIVE item op
passes the Continuity mundane gate instead (§2.3), and every operation needing the record is
gated anyway. State-dependent weights (degrade-to-broken) are priced on the tentative state
(§1.1). **Costs and budgets**: Chapter 1 §1.5 owns them (`minor` = 1, `significant` = 2; budgets
0/1/2). The model never emits a weight, cost, or valence; validation recomputes all three, so a
mismatch is impossible by construction.

## 4. Contextual suggestions (advisory, engine-assembled)

When Chapter 1 licenses an edge-band annotation, the engine MAY hand the Referee a short list of
candidate effects assembled from live state: the actor's inventory, present NPCs and their
dispositions, areas, active conditions and features, **and the check's ruled situational deltas**
(the D2 decision names them — driving rain suggests the slip, the fall, the soaked powder).
Contract — deliberately minimal:

- Every suggestion is pre-validated against the current license budget and band valence; the
  list never contains an illegal option, and its length is capped (§7).
- Suggestions are **advisory only**: the Referee may take one, combine within budget, or ignore
  the list and write its own (validated identically). An empty or absent list never blocks
  anything; flavor-only always remains legal. Contents are not ledgered unless chosen.
- Assembly is engine code, not a model call. **Selection is implementation-defined** — no
  determinism claim, no ranking contract — and the assembler is excluded from this chapter's
  cold-implementation acceptance: it is an optional quality-of-life layer over a complete system.

**Flag for owner sign-off (open by design, Chapter 1 §3 precedent)**: this advisory-MAY reading
follows the D2 decision's wording ("complication SUGGESTIONS, maybe"). If you want a
*guaranteed* substantive suggestion feature — one implementations must ship, with defined
behavior — say so at sign-off and this section gains a normative assembler contract; otherwise
the de-scope stands.

This is the owner's "contextual table": suggestion content varies with the scene because it *is*
the scene, while the free-text complication stays the model's to write.

## 5. Abilities consume the same vocabulary

Generated abilities are flavor text plus effect selections from this catalog — the D0/intake
invariant made concrete. Ability **templates** use role placeholders where §2 schemas take
concrete refs: `self`, `ally`, `foe`, `area`, `held-item`. Template legality (ops exist at the
campaign's catalog version, enums valid) is checkable at generation time; placeholders bind to
concrete recorded refs at execution time, where §1's full core validation runs — including the
§3 opposition rule for `foe` bindings. Packaging — costs, targeting rules, cooldowns, archetype
assignment, and the ability **authorizer** (§1) — is D3/D5 scope. Two rules bind now:

1. No ability may carry an operation this catalog lacks. A gap found during ability design comes
   back as a catalog version proposal (§1), never an inline invention.
2. Bound ability effects pass the same §1/§1.1 core validation; only authorization differs.

## 6. Deliberately inexpressible (reword or flavor, with named future homes)

No operation exists for — and no annotation or ability may assert as mechanical fact:

- killing or removing an actor outright (`harm` writes numbers; death is **D9**);
- **injuring opposition at all** — NPCs and creatures carry no vitals (**D8/D16**);
- **introducing actors into the scene** — reinforcements, summons, arrivals: no ref exists for
  an unrecorded actor, `reposition`/`scene_exit` only touch current occupants, and
  `encounter_start` only names those present (**D7/D8/D16**);
- **a party member leaving the scene involuntarily** — that is a campaign-location transition,
  not a scene edit (`scene_exit` is NPC-only; the location system and **D15/D16** own it);
- **helping an allied NPC as an edge-band boon** — no recorded allegiance exists to compose
  valence from (**D8/D16**; §3);
- **addressing creatures** — creature occupants have no stable reference (**D8**);
- **manipulating recorded scene objects and fixed layout features** — moving a recorded crate,
  throwing a recorded switch, opening a recorded hatch, disabling a generator: object occupants
  and layout features have no operation vocabulary (a future catalog version alongside the
  scene-state store; **D6/D16-adjacent**) — scene features (§2.7) *add* temporary state, they
  never touch what the layout or occupancy already records;
- **NPC/world intelligence state** — a blown cover, a burned password, a circulated description:
  no knowledge store exists beyond party memories (future catalog version; until then,
  reword-or-flavor — or the verb that changes real state, like `disposition_worsen`);
- **conditions outside the §7 token sets** — blindness, silence, poison, total restraint and
  kin are absent tokens: reword to the nearest token's §7 semantics or let it be flavor; new
  tokens arrive as catalog versions;
- attribute, skill, XP, level, or advancement changes (**D4/D5**);
- act or plot-outline transitions (the outline system, **D15**);
- **permanent layout or map edits** — scene features (§2.7) are temporary records, never layout;
- minting significant items from nothing, and destroying durable item records (§2.3; registry
  is **D16**);
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

The coverage claim (E2) is scoped accordingly: consequences over recorded actors and their held
items map today, conditions and temporary features map once their stores ship, and this list is
the deliberate remainder. The fallback is Chapter 1's rule: reword to the expressible footprint,
or let it be flavor — mechanically inert color that changes no possession, position, or
availability.

## 7. Config block (engine-owned, provisional)

All token→number maps, bounds, and token semantics live here; every value is provisional pending
playtest, and recalibration is config, not redesign.

| Config | Provisional value |
|---|---|
| Disposition steps | `slight` = ±10, `marked` = ±25 (sign by op; clamp −100…+100) |
| Item condition ladder | `pristine` → `worn` → `damaged` → `broken` (one step per shift) |
| Wealth ladder (tokens here; the per-NPC field is D16's) | `destitute` \| `struggling` \| `comfortable` \| `wealthy` \| `opulent` |
| **Hindrance token set** (normative membership) | `hindered`, `exposed`, `dazed`, `pinned`, `winded` |
| **Boon token set** (normative membership) | `steadied`, `inspired`, `concealed` |
| Scene-feature kinds (§2.7 only — never condition tokens) | `obstruction`, `hazard`, `smoke`, `darkness`, `alarm`, `cover` |
| Feature sides | `works_against` ∈ `party` \| `opposition` \| `both` |
| Encounter outcome tokens | `party_favored` \| `party_costing`; participants cap 6 |
| Durations | `scene` (clears when the campaign's current-location pointer changes — v1 proxy, D7 may refine), `persistent` (until cleared) |
| Licensed string caps | `name` ≤ 48, `detail` ≤ 80, `fact` ≤ 120 chars; trimmed, whitespace-collapsed; subordinate to their token (§1); never parsed for mechanics |
| `fact_learn` importance | engine default 3 (never model-emitted); keywords default empty (population is out of cold acceptance) |
| Stack rule | every item entry moves exactly 1 unit |
| Suggestion list cap | 4 |
| `harm`/`heal` grades, pool depths | tokens fixed here; numeric maps are **D1b** |

**Token semantics (canonical meaning → what its strings/text may NOT assert):**

| Token | Class | Means | Must not assert |
|---|---|---|---|
| `hindered` | hindrance | movement/action impaired; the actor still acts | incapacity, paralysis, unconsciousness |
| `exposed` | hindrance | easier to notice, target, or exploit | being restrained or disarmed |
| `dazed` | hindrance | perception/focus impaired | blindness, unconsciousness |
| `pinned` | hindrance | cannot leave their current area while active | harm, total immobility of limbs |
| `winded` | hindrance | fatigued; efforts cost more in fiction | injury, pool/vital changes |
| `steadied` | boon | braced, composed, footing secured | immunity or numeric bonuses |
| `inspired` | boon | morale surge | control over others, numeric bonuses |
| `concealed` | boon | hard to perceive where they are | invisibility as fact, being elsewhere |
| `obstruction` | feature kind | passage through/into the area is blocked or slowed | permanent sealing (layout, §6) |
| `hazard` | feature kind | entering/staying risks harm in fiction | automatic damage (vitals are gated) |
| `smoke` / `darkness` | feature kind | sight into/within the area is impaired | total sensory loss for actors |
| `alarm` | feature kind | attention has been drawn; the site is alerted | specific arrivals (§6) or clocks |
| `cover` | feature kind | positions in the area shield their occupants | immunity, invisibility |

## 8. Worked examples (executable acceptance cases)

License recap from Chapter 1 (pointer, not restatement): base `flavor_only` out of encounter /
`minor` in one; +1 step for a critical band; +1 for `extreme`/`legendary` tier; cap
`significant`. Budgets: 0 / 1 / 2 points. Pre-D7 the encounter-active input is false (§3); the
in-encounter cases below are therefore **post-D7 acceptance tests**, marked accordingly. Every
effect is shown as its full payload; per Chapter 1, every effect must be expressed in the
annotation text and vice versa.

1. **Flavor-only license** (Chapter 1's rooftop lockwork: `marginal_success`, `standard`, no
   encounter → `flavor_only`, budget 0). Text: "it opens — the picks slip once, loudly." Effects:
   `[]` — legal: the slip changes no possession, position, or availability. "The pick snaps"
   would demand `{op:"item_lose", owner:"character:7", item:"lockpicks"}` (1 pt) and is **over
   budget**: reword or let it ride.
2. **[post-D7] In-combat crit failure** (`crit_failure`, encounter active → `minor`+1 =
   `significant`, budget 2). Text: "the haft splits on the doorframe — the axe is done — and your
   follow-through carries you stumbling out into the open courtyard." Effects:
   `[{op:"item_lose", owner:"character:7", item:"hand axe"},
   {op:"reposition", who:"character:7", area:"courtyard", quality:"unfavorable"}]` — 1 + 1 = 2/2,
   both adverse (hurt a party member), both stated in the text; the hand axe passes the mundane
   gate; the actor is a current occupant, so binding resolves. Valid.
3. **Cyberpunk break-in, marginal failure** (no active encounter pre-D7 → `flavor_only`… on
   `extreme` tier → `minor`, budget 1). The intent **fails** — no partial achievement: "the
   payload dies in the buffer, and on the way out the grid warden's suspicion hardens into
   certainty." Effects: `[{op:"disposition_worsen", npc:"npc:44", step:"slight"}]` — 1/1, adverse
   (fixed valence, no opposition affirmation needed). Valid today, LIVE.
4. **Imperial court, marginal failure** (`extreme` tier, no encounter → `flavor_only`+1 =
   `minor`, budget 1). Text: "the Chancellor's smile thins." Effects:
   `[{op:"disposition_worsen", npc:"npc:31", step:"slight"}]` — 1/1, adverse (fixed). `marked`
   (significant, 2 pts) is out of reach: one faux pas cannot nuke the relationship.
5. **[post-D7] Firefight, marginal success** (encounter → `minor`, budget 1). Text: "the burst
   connects — and the rifle's last power cell runs dry." Effects:
   `[{op:"item_lose", owner:"character:7", item:"power cell"}]` — 1/1, adverse;
   consumable-mundane. Valid.
6. **[post-D7] Crit success against foes — the valence proof** (`crit_success` in a brawl →
   `minor`+1 = `significant`, budget 2; beneficial only). Text: "your feint sends the duelist
   staggering onto the listing gangplank, and the last brigand breaks and bolts for the
   treeline." Effects: `[{op:"reposition", who:"npc:12", area:"gangplank",
   quality:"unfavorable"}, {op:"scene_exit", who:"npc:9", quality:"unfavorable"}]` — both targets
   are in the annotation's `affirmedOpposed` set; both entries hurt opposed non-party actors →
   **beneficial** (§3); 1 + 1 = 2/2; both are current occupants with unique names. Valid.
7. **Current-version rejection cases (LIVE)**: `{op:"item_gain", owner:"character:7", name:"a
   crate of 100 grenades"}` → licensed-string rejection (count assertion); `{op:"item_gain",
   owner:"character:7", name:"lockpicks"}` when lockpicks already exist in that inventory →
   collision rejection (§2.3); two `disposition_worsen` entries on `npc:31` → conflict-key
   collision; `reposition` to the actor's current area → no-op; `{op:"reposition", who:"npc:63",
   quality:"unfavorable", …}` with `npc:63` not in `affirmedOpposed` → `allegiance-unknown`;
   `quality:"neutral"` in an edge-band annotation → neutral-illegal (§3). After a gate or gate-
   class rejection, legal flavor must be **possession-neutral**: "her knuckles whiten — the
   blade nearly leaves her hand" passes; "the saber skitters away across the deck" does **not**
   (it asserts an unledgered possession/position change and Continuity rejects the text).
8. **Gate behavior (current version)**: `{op:"item_transfer", item:"curved saber",
   from:"npc:12", to:"character:7"}` → rejected at availability, `GATED:D16`, gate named,
   *before* any reference lookup; likewise `hindrance_apply` → `GATED:conditions-store`, `harm`
   → `GATED:D1b`, `scene_feature_place` → `GATED:scene-state`, `encounter_end` → `GATED:D7`.
   **[post-dependency]** evaluator cases (run once their gates lift): two
   `item_condition_shift(degrade)` entries on the same sword → conflict-key collision; `heal` on
   a full-health ally → no-op; a `value_reduce` + `value_enhance` pair → shared conflict key.
   Each rejection re-enters Chapter 1's single-revision flow.

Coverage judgment (the E2 test, scoped by §6): across fantasy, cyberpunk, social, and ranged
play, rulings over recorded actors and held items map; §6 is the deliberate remainder. Reviewers
should attack exactly this claim.

## 9. Non-scope (tracked elsewhere)

Value derivation and all numeric maps for vitals/pools/value-modulation (**D1b**); the strain
pool (**D5**); zones (**D6**); the encounter machine, initiative, and the **active-encounter
license input** (**D7** — §3's pre-D7 rule stands until then); dying/death (**D9**); recovery
and world-clock (**D10**); the item/NPC registries, item classes, per-NPC wealth, NPC vitals,
allegiance records, and movement plausibility (**D16**); freeform/legacy campaigns (**D13**);
ability packaging and the ability authorizer (**D3/D5**); faction standing, clocks, actor
arrival, creature references, recorded-scene-object manipulation, NPC/world intelligence state,
absent condition tokens, durable-record destruction, and player-character wealth (§6 — future
catalog versions or their named decisions); the **conditions store** and **scene-feature
record** (declared required state additions, §2.6/§2.7); a **memory-retrieval contract** strong
enough that committed facts reliably reach later council context (§2.8 names today's bounded
window); and the **ordinary-action commit path** — the ledgered transaction through which
clean-band and no-check state changes flow once rules-governed campaigns exist. That chapter
reuses this catalog's vocabulary, §1 core validation, and §1.1 evaluator wholesale; it owns the
neutral-valence audit of every directional operation and its own authorizer (resolved intent
instead of an edge-band license).
