# Aetheria House Ruleset — Chapter 2: Effects

**Status**: DRAFT r15 — rounds r1–r8 were reopened by both independent reviewers; at r9 one
reviewer **accepted** (zero findings, cold-implementer-executable) and one reopened; r10–r12
were reopened by both; r13–r14 were codex-only conservative passes (owner-directed) reopening
with 1 HIGH / 2 MEDIUM, then 1 MEDIUM — zero CRITICAL/HIGH at r14 — all admitted and fixed; every
admitted finding is addressed in place (trail and the recorded disputes:
`.agents/review/effect-catalog-review.md`). Not yet owner-signed. Implementation of Chapter 1's
edge bands is gated on **this chapter's acceptance** — and, per campaign, on a pinned
`catalog_version` (campaigns without one are pre-catalog legacy and fail closed pending D13,
§1.1): pre-D7, license pricing follows §3's
conservative rule (the encounter-active input is constantly false), and each gated operation
activates with its own dependency — there is no separate D7 shipping gate.
**Declared Chapter 1 refinements (enacted at this chapter's sign-off, mirroring Chapter 1's own
supersession pattern)**:
1. The §5 ledger `annotation` shape extends from `{text, effects}` to `{text, effects,
   affirmedOpposed}` — the Continuity-emitted set of NPC refs affirmed as presently opposed
   (§1/§3); the field is Continuity's alone (a proposal carrying it rejects). Additionally, each
   *executed* effect is persisted with **engine-stamped resolved metadata** — catalog version,
   weight class, point cost, effective valence, resolved target ids, and the pricing-relevant
   prestate (a cleared record's duration, an item's class) — so every stakes ruling stays
   auditable after the state it priced has changed. Model-emitted versions of these fields
   reject; the *proposal* shape models emit is unchanged.
2. Chapter 1's "models emit exactly two numeric protocol identifiers" enumeration is refined to
   cover annotation effects: the typed references this chapter defines (`character:<id>`,
   `npc:<id>`, `item:<record id>`, feature ids) are **engine-issued reference tokens** — they
   name recorded entities, never enter game arithmetic, and are validated by resolution, exactly
   like the actor-id cross-check Chapter 1 already carves out.
3. Chapter 1's engine-checkable valence domain refines from {beneficial, adverse} to
   {beneficial, adverse, **neutral**}: neutral remains illegal in edge-band authorization (the
   band checks are unchanged) and exists for other consumers' authorizers (§3).
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
  **mechanically inert**: text that asserts no change to possession, position, availability,
  or the body of established fact. Never silent state drift, never an unledgered consequence.
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
- **Item key**: the name key of an entry in the named holder's recorded inventory (name-keyed
  today; §2.3 defines the versioned transition to record ids at D16). Resolution is always
  against the holder the schema names for that op, on the tentative state (§1.1), and requires
  **exactly one** match — zero or multiple matching entries reject with a stated reason (current
  state does not enforce name uniqueness; implementations must reject, never guess).
- **Comparison key (normative, one rule everywhere)**: name matching — `item_gain` collision,
  item-key resolution, conflict keys, **and actor-name occupancy binding (§2.5, encounter
  participants)** — uses trimmed, whitespace-collapsed, NFC-normalized, Unicode case-folded
  comparison ("Lockpicks" and "lockpicks " are one key; occupancy "mira" binds `npc` Mira); the
  original string is preserved separately as the display form.
- **Item-record ref** (D16): `"item:<record id>"` — a registry item record. Resolution: the
  record must exist and its current holder must satisfy the schema's stated constraint (e.g.
  scene-held in the current location, on the tentative state), with the exactly-one rule trivial
  by id.
- **Area id**: an area id from the current location's stored layout, resolved with the same
  **exactly-one** rule (duplicate ids in a stored layout reject rather than guess).
- **Feature ref**: `"feature:<record id>"` — a typed token naming an **active** scene-feature
  record in the current location (§2.7). Cleared records do not resolve (§2.7); the token is
  persisted state and remaps on export/import like every other typed token (§1.1).
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

**Ref disclosure (normative)**: refs are engine-issued ids, so any seat that may emit or affirm
an effect ref receives an engine-stamped **ref directory** in its context — party character
ids, recorded NPCs at the current location (id + name), the current layout's area ids, and —
once their stores exist — active feature records and referenceable item records. "At the
current location" is itself defined here, because no NPC location field exists: an NPC is
directory-present iff its record joins the current occupancy under §1's comparison key (§2.5 owns the binding rule)
(normalized name × kind); a join that matches two records is ambiguous and stamps neither
(the engine flags the collision for repair rather than guessing). A model is
never required to invent or recall an id the engine did not surface that turn; a ref naming an
id outside the stamped directory rejects as unresolvable, and a bare name is never accepted in
a ref field (§1's comparison key serves occupancy *binding*, §2.5 — never as a ref fallback).
Without this stamp the id spaces below §1.1's persistence contract would be unwritable in
practice; with it, "unresolvable reference" is always a model error, never a context accident.

**Validation pipeline** — factored into a consumer-independent core plus per-consumer
authorization. For edge-band annotations this instantiates Chapter 1 §5's fixed handoff
(Continuity before engine; rejections from either share the single-revision allowance):

1. **Continuity (semantic core)**: bidirectional text–effect coherence; consistency with
   established fiction; the licensed-string gates above; the declared-judgment affirmations
   (`quality`, `works_against`, `outcome`, target opposition per §3); `fact` singularity and
   novelty (§2.8). On pass, Continuity emits an engine-readable **`affirmedOpposed` set** — the
   NPC refs it affirmed as presently opposed — persisted as the annotation's third field (the
   declared Chapter 1 refinement in the Status block; empty set allowed; model-emitted rejects);
   the engine composes frame valence *only* from that set (§3) and never re-derives fiction.
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
   Additionally, a **non-empty** array whose final tentative state equals its starting state
   (mutually cancelling entries) is rejected wholesale — the empty array is *not* caught here:
   `effects: []` is the flavor-only annotation and is always legal (§8 example 1,
   resolution §1.5). **Condition preconditions bind here**: an entry
   whose target has an active `pinned` record on the tentative state rejects for `reposition`
   and `scene_exit` — unless an earlier entry cleared it (clear-then-move is the legal ordering).
3. **Conflict keys**: at most one entry per conflict key per array. The key, per operation
   (computed after reference resolution):

   | Operation | Conflict key |
   |---|---|
   | `harm` / `heal` | (who, "health") |
   | `pool_drain` / `pool_restore` | (who, pool) |
   | `item_lose` / `item_transfer` / `item_drop` / `item_pickup` | (the holder-resolved item entry or record id, "possession"); two *different* items never conflict |
   | `item_condition_shift` | (the holder-resolved item entry or record id, "condition") — condition and possession are independent axes, so a compound ruling ("the blade chips *and* falls from your hand") ledgers as `[item_condition_shift(degrade), item_drop]` without collision, each axis at most once per item per array |
   | `item_gain` | (owner, normalized `name`, "possession") — the minted entry's synthetic identity; it also collides with any other possession-axis item op resolving to that same (owner, name) entry |
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
   §3. These are the core's outputs; §1's authorization step consumes them, and on commit they
   are persisted per effect as engine-stamped resolved metadata (Status refinement 1) — the
   audit trail survives the state it priced.
5. If every entry passes core validation and the consumer's authorization, the tentative state
   commits **atomically** with the annotation, under Chapter 1's one-transaction-per-`checkId`
   idempotency. Any failure rejects the whole array; nothing partial ever executes.

**Availability attaches to each documented schema form and enumerated parameter predicate, not
to the bare op token.** `LIVE` forms execute against state and resolution rules that exist
today; `GATED:<dep>` forms are part of the accepted vocabulary but may not be proposed,
suggested, or executed until their gating feature ships — validation rejects them at the
availability step with the *governing* gate named. One op may carry several forms with distinct
gates: `item_lose`'s legacy name-key form is LIVE while its record-ref form is GATED:D16;
`pool_drain{pool:"mana"}` is GATED:D1b while `pool_drain{pool:"strain"}` rejects `GATED:D5` even
after D1b lifts. Edge-band implementation may ship with the LIVE subset (subject to §3's pre-D7
license rule); each gated form activates with its feature. A form whose *numeric map* or *record
shape* is gated is gated end-to-end: there is no "live seam" without a legal write.

**Versioning (storage contract declared here; freeform/legacy disposition is D13's)**: the
catalog is versioned chassis config, pinned per campaign in `catalog_version` on the campaign
record. **New campaigns** are stamped `effects-1` at creation. **Campaigns without the field
are pre-catalog legacy**: absence *is* the sentinel (no null-vs-missing distinction), catalog
execution is disabled for them **fail-closed** pending D13's disposition, and creation,
import, export, and fork all carry the field — or its absence — verbatim (a fork of a legacy
bundle is still legacy; nothing auto-migrates). Versions change only by explicit
owner-approved migration (never silently reweighted by an engine upgrade); adding, removing,
or re-weighting operations is a version change; models never see two catalogs at once. Every
ledgered effect records the version it executed under (Status refinement 1).

**Pinning, gating, and enablement are three axes, not one (normative)**: (1) *vocabulary
pinning* — `catalog_version` fixes the documented op/form/schema/weight set **including**
every `GATED:<dep>` form and its named gate, so a gated form *activating* when its feature
ships is **not** a version change (the pinned vocabulary already declared both the form and
the gate; only the runtime capability test flips), while adding, removing, or re-weighting
forms **is** one; (2) *feature capability* — the per-form availability test above, evaluated
at validation time every turn; (3) *execution enablement* — whether edge-band execution runs
for a campaign at all: today's live flag is the campaign's `rules_mode` (campaigns are
creatable with it off), and an `effects-1` stamp on a `rules_mode`-off campaign is dormant
pinned vocabulary, **not** a promise that effects execute; enablement requires this chapter's
acceptance gate plus the campaign's rules mode, and a missing `catalog_version`
force-disables fail-closed (above) pending D13. Never infer enablement from pinning, nor a
version bump from a gate lift.

**Persistence and identity (binding on the implementation, not restated per-op)**: a
committed effect persists with exactly {op, resolved params as engine reference tokens,
catalog version, weight class, point cost, effective valence, pricing prestate};
`affirmedOpposed` persists on the annotation as an array of `npc:<id>` tokens. Every
persisted reference is an engine-issued typed token (Status refinement 2) naming a row in
*this* store — ids are store-local, so **export, import, and fork MUST remap every persisted
token under the same entity mapping the bundle applies to the rows themselves**, and an
import that cannot map a token fails whole (no dangling refs, no silent drops). The bundle's
entity maps must therefore cover **every id space a token can name** — characters, recorded
NPCs, and, as their stores ship, feature records (including cleared tombstones, §2.7), item
records, and area-bearing layouts — not characters alone. **Area identity (normative)**: the
model emits a bare area id from the stamped directory (§1), but the *persisted* token is
location-qualified — `area:<location-record-id>:<area-id>`, stamped by the engine at
resolution — because layout validation scopes area ids per location and bare ids collide
across locations (two `courtyard`s). The location component remaps like any record id; the
area component is layout-internal and travels verbatim; the scene-feature record's own
`location` field (§2.7) must equal its token's location component. Today's
import path copies turn state verbatim; that is legal only while no ledgered effects exist —
token remapping is part of the edge-band implementation gate.

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
| `item_lose` | **Two forms, one op.** Legacy mundane-stack form (LIVE): `{op, owner: character ref, item: item key}` — the resolved stack's quantity decrements by one, entry removed **only at zero**; mundane gates below apply. Durable-record form (GATED:D16): `{op, item: item-record ref}` — the record's holder must be an **actor** on the tentative state (scene-held records reject: no frame to compose valence from — destroying scene-held loot is §6), owner derived and validated from the record | one unit leaves play; durable records persist out of play with the `lost` flag set and full provenance (the looted saber falls into the chasm *from the looter's hands*) | by item class (§3) | hurts the holder | legacy form LIVE; record form GATED:D16 |
| `item_gain` | `{op, owner: **character ref** (an npc-typed owner rejects at schema shape), name: licensed string}` — **mundane mint/stack only**, matching totalized: **zero** comparison-key matches in `owner`'s inventory → mint; **exactly one** match that is **stack-eligible** (shape totalized in the prose below) → increment its quantity by one ("you scavenge another coil of rope"); one match that is not stack-eligible → **reject** (stacking would mint mechanics, or the shape is untrusted); **more than one** match → reject as ambiguous, before any mutation | mint: one new mundane item, stored as `{name: <display form>, type: "general", description: "No description.", quantity: 1}`, every other property ignored — the model supplies the name and nothing else. **In every catalog version this op writes the mundane stack list only** — durable registry records are minted exclusively by engine flows (loot placement, import, D16 migration), never by this op | minor (mundane by construction) | helps `owner` | LIVE — there is no NPC *mint* form in any version: recorded items reach NPCs via `item_transfer` or `item_pickup`, and an NPC producing a previously unrecorded object is §6-inexpressible |
| `item_transfer` | `{op, item: item-record ref, from: actor ref, to: actor ref}` — the record's holder must be `from` on the tentative state; `from ≠ to`; **each non-party endpoint must be in `affirmedOpposed`**, else `allegiance-unknown` (§3) | the same record changes holders — identity, condition, and provenance preserved | by item class (§3), **charged once** | net party effect (§3; nets are defined only over party/affirmed-opposed endpoints) | GATED:D16 |
| `item_drop` | `{op, item: item-record ref, area: area id}` — the record's holder must be an actor on the tentative state | the record's holder becomes the scene (that area); identity/condition/provenance preserved | by item class (§3) | hurts the former holder | GATED:D16 |
| `item_pickup` | `{op, owner: actor ref, item: item-record ref}` — the record's current holder must be the current location (scene-held), on the tentative state | the record's holder becomes `owner` | by item class (§3) | helps `owner` | GATED:D16 |
| `item_condition_shift` | `{op, item: item-record ref, direction: degrade\|improve}` — the record's holder must be an **actor** on the tentative state (scene-held and `lost` records reject: no frame to compose valence from) | one step on `pristine`→`worn`→`damaged`→`broken` | step to `broken`: significant; else minor (priced on tentative state, §1.1) | degrade: hurts the holder; improve: helps them (actor-frame rules, §3) | GATED:D16 |
| `wealth_shift` | `{op, who: **npc ref**, direction: up\|down}` | one step on the §7 wealth ladder | minor | up: helps `who`; down: hurts `who` | GATED:D16 (the per-NPC wealth field; player-character wealth has **no approved home** — §6) |

**Stack rule**: every item entry moves **exactly one unit** — quantity is never a model input and
never prose-derived. **Custody, stated precisely**: `item_lose` means the unit is *gone from
play* (swallowed by the chasm, burned up) — pre-D16 that deletes the inventory entry/unit;
post-D16, durable records persist with the `lost` flag set and full provenance — the holder
field retains its last value, but a `lost` record is out of play: never
directory-referenceable, and every record-form op above rejects it (destruction of a
durable record is a future op, not this one). A recoverable parting is `item_drop` (custody moves
to the scene) and recovery is `item_pickup`; between actors it is `item_transfer`, atomic and
priced once. **The pre-D16 mundane check**: because no class field exists yet, `item_lose` on a
LIVE inventory entry additionally passes Continuity's mundane gate over the entry's **stored**
name/type/description — the *significance* half of the §1 standard: an entry reading as unique,
powerful, or plot-weighted rejects pending D16 classification; a legacy artifact cannot be
destroyed for one point as "mundane". §1's mechanical-property rejection governs **model-emitted
`item_gain` names**; it is not re-applied to stored text here — otherwise every legacy
consumable whose stored description plainly states its effect ("Restores 20 Health Points.")
would reject, and the carve below would govern an empty set. Stored mechanics are policed by
the deterministic rules that follow, never by re-parsing strings. **The mundane gates are two,
both required (pre-D16)**: the Continuity *significance* gate on the stored
name/type/description, and a **deterministic engine rule** — an inventory entry carrying
`stats` is non-mundane *by construction* and rejects pending D16 classification.
**Stack eligibility (totalized over every legacy shape, fail-closed)**: the matched entry
stacks only if its keys are a subset of {`name`, `type`, `description`, `quantity`,
`equipped`} (so no `stats`/`effect` by construction and **any unknown key rejects** — an
unrecognized property may be latent mechanics), its `quantity` is either absent (read as 1
and normalized on write) or a positive safe integer (zero, negative, fractional, or
non-numeric rejects), and the Continuity mundane gate passes over the entry's **stored**
name, type, and description — not merely the proposed name (a stored description reading as
plot-weighted blocks stacking even under an innocuous name). Every other same-key shape
rejects the op before any mutation; there is no "add a second line" fallback, because a
same-name duplicate would make the stack unresolvable for `item_lose`'s unique-match rule.
**Registry records are quantity-one by construction (declared for D16)**: a durable record is
one discrete unit — record-ref ops move, degrade, or destroy **whole records**, and stacking,
splitting, and merging are mundane-list semantics that never enter the registry, so the
identity contract (§1.1) has no split/merge case to define and no record ever carries a
`quantity` field. **The
consumable carve (loss only, asymmetric by design)**: an entry carrying `effect` but no `stats`
MAY be `item_lose`'d as a minor loss — in the bare form the unit is wasted, gone from play, its
effect never fires ("the recovery patch tumbles into the canal") — but may NOT be stacked onto
by `item_gain`, because minting a unit whose use fires mechanics would be mechanical gain
outside D1b. **Loss-side totalization (fail-closed, the mirror of stack eligibility)**: the
matched entry's keys must be ⊆ {`name`, `type`, `description`, `quantity`, `equipped`} ∪
{`effect`} — `stats` is already non-mundane, and **any other unknown key rejects pending D16**
exactly as it blocks stacking: an unrecognized property may be latent mechanics, and erasing
it for one point would bypass D13 stakes weighting as surely as minting it would bypass D1b.
`quantity` must be absent (read as 1) or a positive safe integer, and the op removes exactly
one unit (decrement; delete at zero) — fractional, zero, negative, or non-numeric quantities
reject before any mutation. **Intentional beneficial use is NOT expressible on the current
surface — by valence arithmetic, not by omission**: the honest shape would be a composed pair
(the fired effect as its own first-class entry *plus* the `item_lose`), but the pair is
mixed-valence — the fired effect helps the party while the loss hurts it (§3, priced per entry,
no netting) — and Chapter 1's edge bands are single-valence (`crit_success` admits only
beneficial effects; the other three only adverse), so **no band can carry both entries**.
The pair shape that *is* edge-band-legal today is the all-adverse mishap ("the flashbang cooks
off in your pack": `harm` + `item_lose` on a failure band). Deliberately drinking the potion is
routine intentional action — the ordinary path's problem (§9/D15) or a D1b `item_use` (§6),
not an edge-band shape. **The composed-pair contract survives as the binding template for
whichever surface first carries it**: each entry validates, prices, and ledgers independently
at full freestanding cost, so nothing fires unrecorded and consumption is never cheaper than
the spontaneous effect (the same conservative stance as the pre-D7 license rule; item-sourced
discounted pricing is §6); the engine never parses legacy `effect` strings — it does not
verify the fired entry "matches" the item; the pair is licensed by Continuity like any
annotation, and conservative pricing makes a mismatch unprofitable rather than dangerous. The
Continuity name gate still applies to the carve (a "Phoenix Elixir" rejects regardless). The
legacy `equipped` field is declared **display-only, never mechanical state** (readiness is §6).
**No minting significance**:
`item_gain` constructs mundane items only; every recorded item moves through
transfer/drop/pickup, which preserve the record — the laser rifle you loot is the recorded rifle
its owner carried, in whatever condition the fight left it (the D16 loot requirement).
**The `item` field dispatches on grammar, never on guesswork (normative)**: a string matching
the typed-token grammar `item:<record id>` (§1) **is** the record-ref form — resolved as a
record ref or rejected, never reinterpreted as a name key — and any other string is the
legacy name key. The prefixes of §1's typed tokens (`item:`, `feature:`, `npc:`,
`character:`, `area:`) are **reserved**: `item_gain`'s licensed-string gate rejects a
proposed name matching any reserved-prefix grammar, and a *stored* legacy entry whose name
matches one is unresolvable by design — the op rejects and the engine flags the entry for
repair rather than guessing which form was meant. Hybrid payloads (a record ref alongside
name-key fields, or two `item` values) are schema-invalid. **The item-record interface
(required here, owned by D16)**: this catalog binds to a record exposing at least {stable
record id (remaps under §1.1); display name/type/description (comparison-keyed, §1); holder —
exactly one of an actor ref or a location-qualified area; condition; class (mundane vs
significant); `lost` flag; provenance}. D16 may extend the record, but no form above executes
until every listed field exists — "executable shape" documents the post-D16 call, it does not
assert the store exists. §1's "referenceable item records" is defined off this same
interface: a record is directory-referenceable iff `lost` is unset and its holder is a directory-present actor or
its area belongs to the current location's stored layout — the directory derives from
records, never records from the directory.
**Schema versioning (normative, one rule)**: every GATED:D16 operation above is documented in
its post-D16 **executable** shape — `item: item-record ref` with the holder validated from the
record. **No name-key form of `item_transfer`, `item_drop`, `item_pickup`, or
`item_condition_shift` is legal in any catalog version**; name keys exist only in the LIVE
`item_lose`/`item_gain` shapes, which persist unchanged as the legacy forms after D16 (the
D16 gate lift activates the already-pinned record-ref forms with **no** `catalog_version`
change — §1.1's three axes; the live shapes are never rewritten). **Ordinary-path
note**: the ordinary
authorizer (§9) may treat self-directed custody ops (setting your own pack down) as neutral —
that audit is §9's; edge-band semantics here are unchanged.

### 2.4 Disposition — LIVE

| Operation | Schema | State written | Weight | Effective valence (fixed — see below) |
|---|---|---|---|---|
| `disposition_improve` | `{op, npc: npc ref, step: slight\|marked}` | that NPC's `relationship_value` (engine-mapped ±, clamped −100…+100) | slight: minor; marked: significant | beneficial |
| `disposition_worsen` | same | same | same | adverse |

**Party-frame exception (deliberate)**: disposition valence is fixed, not frame-composed — these
ops need no opposition affirmation. **Targeting is directory-scoped**: the npc ref must resolve
inside the turn's stamped ref directory (§1) like every other actor ref — fixed valence relaxes
the *opposition* requirement, never the *resolution* rule. "Word of this reaches Lady Voss"
when Lady Voss is elsewhere is an off-screen disposition change — inexpressible today, listed
in §6 with the movement seam it rides on. The relationship value
measures the party's standing with that NPC — an asset of the party — so improving it is
beneficial and worsening it adverse no matter whose action moved it. Consequence, acknowledged:
"the enemy now fears you" is not expressible as a beneficial disposition write; the single
like/dislike axis has no fear/respect channel (a future catalog version may add one). The
expressible footprint: `fact_learn` commits it as a ledgered party fact (`crit_success` only,
§2.8), a boon expresses it once the conditions store ships — otherwise **reword, never
flavor**: an NPC's stance is a *novel* fact, exactly the class §2.8 forbids carrying as
unledgered flavor, and stance prose feeds later opposition affirmation (§3), so a
prose-committed attitude would be silent mechanical drift.

**Migration note (honest)**: today's turn contract lets the model emit a free integer
`relationship_change` (−50…+50), Referee-adjudicated damage numbers, free-form occupancy
rewrites, and the free-text `quest_update` (active quest, description, act) — all predate this
chapter and violate tokens-in/numbers-out. Under rules-governed campaigns those seams migrate to
catalog operations or their owning systems (quest/act state → the outline system, §6);
freeform/legacy behavior is D13 scope, not silently changed.

### 2.5 Position and presence — LIVE (refined by D6 zones)

| Operation | Schema | State written | Weight | Direction |
|---|---|---|---|---|
| `reposition` | `{op, who: actor ref, area: area id, quality: favorable\|unfavorable\|neutral}` | `who`'s occupancy entry moves to `area` | minor | `quality` declares it: favorable helps `who`, unfavorable hurts `who`; `neutral` is legal only under ordinary authorization (§1, §3) |
| `scene_exit` | `{op, who: **npc ref**, quality: favorable\|unfavorable\|neutral}` | `who`'s occupancy entry is removed — they leave the scene (flee, slip away, get hurled out) | minor | as above, declared for the exiter |

**Binding rule (occupancy rows carry no ids today)**: `who` resolves to the occupancy row whose
name matches the recorded actor's name under §1's **comparison key** (never raw string equality —
occupancy strings drift in case and spacing) and whose `kind` matches the ref type
(`character:` → `player`, `npc:` → `npc`). The actor must already be a current occupant — these
ops move or remove people *within* the scene, never into it (arrivals are §6). **Uniqueness is
required on both sides**: the (normalized name, kind) pair must identify exactly one recorded
actor in the campaign AND exactly one occupancy row — either ambiguity rejects (two recorded
NPCs sharing a name cannot be bound at all, so an absent twin can never alias a present one);
no silent creation. Stable occupancy identifiers
are a noted D16-adjacent improvement, not assumed. `quality` is a declared judgment the engine
cannot compute; Continuity validates it against the annotation text ("shoved into the open
courtyard" cannot be `favorable`) — the same semantic gate as delta reasons, and it is an
identifier, never a number. Moving `who` to their current area is a no-op (§1.1). `scene_exit`
is NPC-only: a *party member* forced out of the location is a campaign-location transition, not a
scene edit (§6). Where the exiter went is deliberately unrecorded until D16's movement seam —
what is ledgered is that they are no longer present. An active `pinned` on the target blocks both
ops until cleared (§1.1). **Post-D7 cross-store write, declared**: if the exiting NPC is on the
active encounter's roster, `scene_exit` atomically removes them from it (participants are a live
roster, §2.8); what an emptied opposing side does to the encounter lifecycle is D7's rule.

### 2.6 Conditions — GATED:conditions-store

| Operation | Schema | State written | Weight | Direction |
|---|---|---|---|---|
| `hindrance_apply` | `{op, who: actor ref, condition: §7 hindrance token, duration: scene\|persistent, detail: licensed string}` | conditions store | scene: minor; persistent: significant | hurts `who` |
| `boon_apply` | `{op, who: actor ref, condition: §7 boon token, duration, detail}` | same | same | helps `who` |
| `condition_clear` | `{op, who: actor ref, condition: token active on who}` | same | **from the stored record's duration** (scene: minor; persistent: significant) — undoing state costs what establishing it cost | clears a hindrance: helps `who`; clears a boon: hurts `who` |

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
| `scene_feature_place` | `{op, area: area id, kind: obstruction\|hazard\|smoke\|darkness\|alarm\|cover\|passage, name: licensed string, duration: scene\|persistent, works_against: party\|opposition\|both}` | a scene-feature record | scene: minor; persistent: significant | composed from `works_against` (§3): `party` → adverse; `opposition` → beneficial; `both` → **adverse by rule** (a mutual hazard always costs the party; it can never be a pure boon) |
| `scene_feature_clear` | `{op, feature: feature ref}` | marks the record `cleared` — **identity is append-only; no row is ever deleted** | **from the stored record's duration** (scene: minor; persistent: significant) | computed from the stored `works_against`: clearing `party`-hindering → beneficial; `opposition`-hindering → adverse; `both` → beneficial |

**Required state addition (declared, not yet built) — the scene-feature record**:
`{ id, location, area, kind, name, duration, works_against, status: active|cleared,
source: checkId, appliedTurn, clearedBy?: checkId, clearedTurn? }`.
Occupancy rows (`{name, kind, area, note}`) cannot hold kind, duration, or side without parsing
strings for mechanics, which §1 forbids — hence the record. Features are temporary scene state —
rubble across a door, smoke in the hall, a klaxon blaring — and **never edit the stored layout**
(§6); nor do they touch *recorded* scene objects, which have no vocabulary yet (§6).
**Lifecycle is a status flip, never a delete**: every ledgered `place` and `clear` effect
persists a `feature:<id>` token (§1.1), so the row those tokens name must outlive the feature —
deletion would leave the ledger unreplayable and make export/import fail whole on a dangling
ref. Gameplay resolution (§1's feature ref, `clear`'s own lookup, the D8 slice) binds
**active** records only; a `clear` naming a cleared record is an unresolvable reference (§1),
which doubles as the double-clear guard. Cleared rows are tombstones: exported with the
bundle, remapped like live rows, never resurrected. Scene-duration features flip to `cleared`
on the same location-pointer boundary as conditions — same mechanism, engine-driven, no
ledger entry. `works_against` is a declared judgment validated by Continuity against the
text; `scene_feature_clear`'s valence is engine-computed from the stored field — no
declaration to trust.

### 2.8 Scene and canon

| Operation | Schema | State written | Weight | Valence | Availability |
|---|---|---|---|---|---|
| `encounter_start` | `{op, posture: hostile\|social_standoff, outcome: party_favored\|party_costing, participants: [1..cap unique npc refs, each bound to a current occupant via §2.5's binding rule]}` | the encounter state machine | significant | composed from `outcome` (Continuity-validated against the text): `party_favored` — the party forced the fight it wanted → beneficial; `party_costing` — trouble found the party → adverse | GATED:D7 (today only a per-turn pacing enum exists) |
| `encounter_end` | `{op, outcome: party_favored\|party_costing}` | the encounter state machine — the active encounter concludes, **and nothing else**: its text may assert only the ceasing of hostilities plus consequences ledgered by accompanying entries. **Displacement wording rejects**: "you are driven from the field" asserts a position/location change no accompanying op can ledger for the party today (§6) | minor | composed from `outcome`: rout/de-escalation in the party's favor → beneficial; hostilities ending on unfavorable terms **with everyone still where they stand** (a forced truce on bad terms, the standoff hardens against you) → adverse | GATED:D7 |
| `fact_learn` | `{op, fact: licensed string}` | one party-scope memory row, fields pinned: campaign from the transaction, `turn_number` = the check's ledger turn, summary = the `fact` string, importance = engine config default (§7), keywords engine-default empty; checkId linkage stays ledger-only | minor | beneficial (fixed) | LIVE (campaign memories) |

Encounter lifecycle cost is **fixed regardless of participant count** — legality, not cost,
bounds the list (unique, 1..cap per §7, every ref bound to a present occupant). **Participants
are a live roster**, not a start snapshot: `scene_exit` removes an exiting NPC from it atomically
(§2.5); an emptied side's lifecycle consequence is D7's rule. `outcome` is the same
declared-judgment class as `quality`: Continuity rejects a declaration the text contradicts, and
the engine composes valence only from the validated token. **Capture, surrender, and binding the
party are not `encounter_end` semantics** — they assert restraint, custody, and position changes
no operation can ledger yet, and are §6-inexpressible until those homes exist.

**Affordability is deliberately tiered (priced consequence of Chapter 1, not an oversight)**:
`encounter_start` is significant-class (2 points), and the standard tier out of encounter caps
licenses at `minor`/1 even on critical bands — so at standard stakes a botched persuade
**cannot** turn the room hostile via annotation. That is the conservative pre-D7 stance on the
most identity-bending consequence an edge band can impose: the affordable expression is
`disposition_worsen` plus flavor, and the full escalation belongs to extreme/legendary tiers
(whose critical bands do reach significant/2), to in-encounter criticals post-D7, or to the
GM-authored turn flow, which needs no license at all. Reviewers flagging "you can never start
a fight from a failed check" should read this as the design: annotations may tilt a scene,
only play may detonate it at standard stakes.

`fact_learn` is the canon-commitment verb — and its payload is deliberately narrow: `fact` states
**exactly one** verifiable fictional fact, expressed in the annotation text, asserting no
quantities and no mechanics beyond established scene truths ("the vault hinge is mounted
backwards" passes; "the vault holds 10,000 crowns and its guardian is vulnerable to fire" is two
facts, one of them a mechanics claim — rejected). Continuity checks singularity, novelty (a fact
already established is a no-op → rejected), and text expression. **The novelty check queries
the store, not the window (normative)**: Continuity's duplicate test runs against the
campaign's *full* persisted memory rows plus the §2.8 establishment sources — never against
the bounded retrieval window — so a fact that has aged out of the prompt still trips
rejection. The test is textual-comparison best-effort; a paraphrase that slips past it
writes a *redundant retrieval copy* and nothing else — `fact_learn` writes no mechanical
state, the roll ledger stays authoritative, and the license point was spent knowingly — so
the failure mode is bounded at "duplicate row", never at "duplicate mechanics"; tightening
the comparison is part of §9's retrieval contract. **Idempotency and linkage**: the
memory row is written inside the annotation's atomic transaction (at most once per `checkId`);
the roll ledger remains the authoritative check-to-fact linkage; the memory row is a retrieval
copy on today's schema, no new column. **Retrieval honesty**: current council context includes a
bounded window of high-importance/recent memories, so an old fact can fall out of the prompt;
the fact's binding force lives in the ledger and Continuity's checks, and a stronger retrieval
contract is named future work (§9). The op is beneficial-only (the party learning something is
the benefit) — which means that **among edge bands it is legal only on `crit_success`**; a
*novel* discovery inside failure-band texture ("you still notice the hinge is backwards") must
be **reworded away, never downgraded to flavor**: annotation text is binding canon
(resolution §1.5), so a new fact carried as "flavor" with no memory row would be an unledgered
canon commitment — flavor may only restate already-established scene truths (E2's inert rule
covers the body of established fact; stated in §6). **"Already-established" is a store test,
not a vibe (normative)**: a truth is established iff it is derivable from state that already
binds — the ledger, campaign memory, the stored scene/location state, or earlier binding
annotation text of *this* session — and anything the model merely believes from prompt
context fails the test. When drafting texture the model asks one question: *would a fresh
council, given only the stores, already know this?* If yes it is restateable flavor; if no it
is a novel fact and must be ledgered by the owning verb or reworded away. *Routine* fact
commitment on clean bands belongs to the ordinary path (§9). Adverse discoveries are expressed by the verb that
changes the state, never by a "bad fact" — and *NPC/world* intelligence state (a blown cover, a
burned password) has no verb yet at all (§6).

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
consumer (§9) can authorize genuinely neutral changes — a no-check walk across the room is
`reposition` with `quality:"neutral"`, and §2.3 notes the ordinary authorizer may treat
self-directed custody ops the same way; the full audit of directional ops for ordinary use
belongs to that chapter.

1. Ops with a **Direction** column declare whether they help or hurt their target actor
   (`quality`-style enums may also declare `neutral`).
2. The **frame**: the acting character and all player characters are *party*. NPCs have no
   recorded allegiance today, so frame composition against an NPC is legal **only for targets in
   the annotation's Continuity-emitted `affirmedOpposed` set** (§1) — the engine never
   re-derives fiction; a frame-composed NPC target absent from the set rejects with reason
   `allegiance-unknown`. Consequently **every frame-composed effect on a non-opposed NPC — ally,
   neutral, or bystander, whether helping or hurting them** — is inexpressible until a
   recorded-allegiance home exists (§6, D8/D16): the bartender caught in the blast is
   reword-or-flavor, not a mis-affirmed "opponent". Creatures have no refs at all (§1).
   Fixed-valence ops (disposition, `fact_learn`) ignore the set.
3. Compose: **helps party → beneficial; hurts party → adverse; hurts affirmed-opposed non-party →
   beneficial; helps affirmed-opposed non-party → adverse.** A crit-success shove that sends a
   foe stumbling is beneficial; a marginal failure may not "complicate" the scene by
   disadvantaging the enemy — that inversion is exactly what this rule exists to reject.
4. **Same-frame nets** (`item_transfer`): the nets are defined **only over party and
   affirmed-opposed endpoints** — any non-party endpoint outside `affirmedOpposed` (the gift to
   the bartender, the theft from the bystander) rejects `allegiance-unknown` like every other
   frame-composed NPC effect. Within that domain: party→opposed-NPC is adverse;
   opposed-NPC→party is beneficial. **PC→PC is neutral** — custody never leaves the party —
   hence illegal on edge bands and legal only under ordinary authorization. **NPC→NPC rejects**
   pending recorded allegiance.
5. Side-composed ops: scene features use `works_against`, encounter lifecycle uses `outcome`,
   each through the same frame (§2.7, §2.8).
6. Fixed-valence ops (disposition, `fact_learn`, value modulation) skip composition; each states
   its rationale in §2.

**The encounter-active license input, pre-D7 (conservative by rule)**: Chapter 1's stakes-license
map takes "is an encounter active" as an input, but no persistent encounter lifecycle exists
today — the per-turn pacing enum records initiation cadence, not activity, and **must not be used
as a proxy**. Until D7 ships a deterministic lifecycle, the encounter-active input is
**constantly false**: licenses are never wider than the fiction warrants, only narrower (base
`flavor_only`; the Chapter 1 §1.5 ladder still stacks on top — +1 step for a critical band
**and** +1 for `extreme`/`legendary` tier, so either alone reaches `minor` and both together
reach `significant`/2, exactly as §2.8 and §8's recap state; encounter-false removes only the
in-encounter `minor` base, it does not cap the ladder).
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

**A substantive suggestion assembler is explicitly NOT a deliverable of this chapter.** The
normative contract is exactly two clauses, both executable:

1. Any suggestion shown to the Referee MUST be **mechanically eligible**: schema-valid,
   reference-resolved on current state, availability-passing, within the license budget, with a
   computable band-legal valence. (Text-dependent gates — coherence, licensed-string semantics,
   declared-judgment affirmations — cannot run before text exists; the full §1 core validates
   the annotation *after* the Referee adopts a suggestion and writes its text, and may still
   reject it then.) An illegal-by-mechanics option may never appear; the list length is capped
   (§7). **"Computable" is restrictive**: an op whose effective valence depends on inputs that
   do not yet exist — a declared judgment (`quality`, `works_against`, `outcome`) or an
   `affirmedOpposed` membership not already persisted from a prior turn — has no computable
   valence and is **not eligible**. **The suggestion-time opposed set is defined, not
   implementer-chosen**: the union of persisted `affirmedOpposed` arrays (§1.1) across
   annotations committed since the campaign's current-location pointer last changed — the same
   v1 scene proxy conditions and scene features already use (§2.7, §7; D7/D8 may refine),
   restricted to targets that still reference-resolve. Not all-history (stale enmity would
   outlive the fiction) and not latest-annotation-only (parallel foes would evict each other).
   **Per-target reconciliation trim (the projection can go stale *inside* a location)**: an
   NPC drops from the projection the moment a *later* committed annotation records
   reconciliation toward them — concretely, a `disposition_improve` targeting them, or
   (post-D7) an `encounter_end` whose recorded scope covers them — each a persisted row, so
   the trim is as decidable as the union itself; NPCs who fled fall out already via
   reference-resolution (`scene_exit` removes their occupancy row). Residual staleness a trim
   cannot see (a surrender that was never ledgered by any op) is bounded by construction:
   the projection gates *suggestions only* — a stale hostile suggestion still passes through
   full §1 validation and Referee choice before anything is ledgered, and the Referee holds
   the fiction.
   Concretely: fixed-valence ops, party-frame ops, and frame-composed NPC ops whose target is
   in that projection may appear; frame-composed ops against any other NPC may not — assemblers
   never guess opposition. **Both eligibility legs apply together, not alternately**: projection
   membership supplies only the *frame* input; a form that additionally carries a
   declared-judgment valence input (`reposition`/`scene_exit`'s `quality`,
   `scene_feature_place`'s `works_against`, `encounter_*`'s `outcome`) remains ineligible even
   against a projection member, because that judgment still does not exist at suggestion time
   (`scene_feature_clear` carries no judgment — its valence is engine-computed from the stored
   record, §2.7, so it is eligible whenever its `feature` ref resolves) — NPC-target
   candidates therefore come from the genuinely judgment-free frame-composed forms: the §2.6
   condition ops and `item_transfer` same-frame nets (§3). `disposition_*` needs no projection
   at all — it is fixed-valence (§3), eligible under the first category above — and `harm`
   never enters this set: it is character-only (§2.1). An implementation that does not compute the projection must treat
   the set as **empty** (its suggestions then cover fixed-valence and party-frame ops only),
   never fall back to a guess.
2. Absence conforms: no suggestions, an empty list, or no assembler at all are all valid
   implementations. Suggestions are advisory — the Referee may take, combine within budget, or
   ignore them; nothing is ledgered unless chosen; flavor-only always remains legal.

Everything else — which live-state sources to draw on (inventory, present NPCs, areas, active
conditions and features, the check's ruled deltas), how candidates are generated, filtered, or
ranked — is **non-normative guidance**, not contract, and no acceptance case may depend on it.

**Flag for owner sign-off (open by design, Chapter 1 §3 precedent)**: this minimal reading
follows the D2 decision's wording ("complication SUGGESTIONS, maybe"). If you want a
*guaranteed* substantive suggestion feature — one implementations must ship, with defined
behavior — say so at sign-off and a normative assembler contract gets designed and reviewed as
its own increment; otherwise the de-scope stands: this chapter's acceptance suite exercises
clauses 1–2 only, and no source selection, generation, or ranking behavior may be cited as
chapter-conformance evidence.

This is the owner's "contextual table": suggestion content varies with the scene because it *is*
the scene, while the free-text complication stays the model's to write.

## 5. Abilities consume the same vocabulary

Generated abilities are flavor text plus effect selections from this catalog — the D0/intake
invariant made concrete. Ability **templates** use role placeholders where §2 schemas take
concrete refs: `self`, `ally`, `foe`, `area`, `held-item`. Template legality (ops exist at the
campaign's catalog version, enums valid) is checkable at generation time; placeholders bind to
concrete recorded refs at execution time, where §1's full core validation runs. **The
opposition-affirmation requirement is consumer-independent**: every frame-composed NPC target
needs a Continuity-emitted affirmation whatever the consumer — the annotation's third field is
merely the *edge-band carrier*; the ability-execution pass must define its own carrier for
`foe` bindings (D3/D5 scope), and the engine never re-derives fiction for any consumer. Packaging — costs, targeting rules, cooldowns, archetype
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
- **party location transitions, voluntary or not** — ordinary travel ("you leave the tavern for
  the docks") and involuntary exit alike: `current_location_id` is real state that today mutates
  only through the free-form `location_update` seam; the location-transition verb belongs to the
  ordinary-action chapter and the location system (**D15/D16**), and `scene_exit` stays
  NPC-only;
- **any frame-composed effect on a non-opposed NPC** — allies, neutrals, bystanders, whether
  helped or hurt: no recorded allegiance exists to compose valence from, and mis-affirming a
  bystander as opposed is a Continuity violation, not a workaround (**D8/D16**; §3);
- **changing allegiance itself** — betrayal, defection, an ally turning: disposition can move
  (like/dislike), but which *side* an NPC is on has no recorded home — and a side-switch is
  **not** a prose-only matter: whose side an NPC is on feeds later opposition affirmation
  (§3), so asserting a defection in binding annotation text would be exactly the unledgered
  canon commitment §2.8 forbids. Until allegiance records exist (**D8/D16**) the change is
  **reworded away** (the §2.4 stance rule); the expressible footprint is `disposition_*` for
  the felt shift and, on `crit_success`, `fact_learn` for the party *discovering* an
  allegiance truth the fiction already established;
- **quest and objective state** — "the contract is fulfilled", "the hunt is now for X": the
  live `quest_update`/act seam is real campaign state with no catalog verb; it belongs to the
  outline system and the ordinary path (**D15**; §2.4 names it a migration target);
- **capturing, binding, or forcing the surrender of the party** — restraint tokens, custody
  state, and party position changes have no operations; `encounter_end(party_costing)` may end
  hostilities unfavorably but asserts nothing more (**D9/D11 + the restraint/custody homes**;
  §2.8);
- **item readiness and wielded state** — drawing, stowing, switching a wielded item: the legacy
  `equipped` inventory field is display-only and never mechanical state; wielded-state becomes
  D16 item-record data (its visibly-wielded loot requirement), and readiness operations are a
  future catalog version (**D16**);
- **party-fact commitment outside `crit_success`** — a *novel* discovery inside failure-band
  texture must be reworded away: there is **no flavor channel for new facts** (binding text
  with no memory row is an unledgered canon commitment, §2.8, E2); flavor may restate
  established truths only; routine fact commitment on clean bands is
  the ordinary path's (§2.8, §9);
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
- minting significant items from nothing, destroying durable item records (including
  scene-held ones — record-form `item_lose` requires an actor holder), and **any NPC producing
  a previously unrecorded object** (§2.3; registry is **D16**);
- **restraining or capturing an NPC** — "you bind the defeated thug", taking prisoners: no
  custody/restraint state exists on either side of the table (the party-capture entry above has
  the same missing homes — **D9/D11 + restraint/custody state**);
- **mechanical-consumable acquisition** — restocking effect-bearing items ("you scavenge
  another recovery patch"): gaining a unit whose use fires mechanics is mechanical gain outside
  D1b; the expressible footprint today is discrete inert units (**D1b/D16**);
- **item-sourced effect pricing** — a dedicated `item_use` op that consumes a unit and fires
  its recorded effect at item-sourced (potentially discounted) cost: future, **D1b/D16**. There
  is **no LIVE interim for intentional use**: §2.3's composed pair is mixed-valence, and
  Chapter 1's single-valence edge bands cannot carry it — deliberate use is inexpressible until
  D1b (reword to the ordinary path, §9/D15). The composed-pair shape survives today only in its
  all-adverse mishap form (§2.3), and it is the binding template for whichever surface first
  carries intentional use — each entry validating, pricing, and ledgering independently at
  full freestanding cost;
- **item resource state** — charges, ammunition, fuel, batteries on durable items: no
  per-item resource meters exist; the canonical current representation is discrete consumable
  units (a "power cell" as its own stack), and metered resources arrive with **D1b/D16**;
- **recoverable scene custody of stack-list units** — "you set the rope down; it's still on
  the floor": `item_drop`/`item_pickup` are record-ref forms, `GATED:D16`, and no name-key
  form is legal in any catalog version (§2.3), so a mundane stack unit has exactly two
  ledgerable states — held, or gone from play via `item_lose` at its priced cost; a
  recoverable parting is inexpressible today — reword to possession-neutral readiness texture
  (§8) or commit the loss; scene custody arrives with **D16** record identity;
- **multi-unit mundane gain or loss in one annotation** — "you recover three torches", "the
  fire ruins several rations": the stack rule moves exactly one unit per entry (§2.3),
  licensed names may not encode counts (§1), and same-(owner, name) item ops share one
  conflict key (§1.1), so an annotation ledgers at most one unit per item name; narrate the
  single unit actually moved, or spread acquisition across turns — one priced unit each;
  post-D16, plural movement of *recorded* items is multiple record-ref entries (distinct
  conflict keys, §1.1), while the stack-list forms stay one-unit-per-turn by design —
  quantity is never a model input (§2.3);
- **player-character wealth** — D16 records a coarse wealth category *for NPCs*; a PC-wealth
  subsystem would need its own owner decision;
- **time pressure, countdowns, and clocks** — no world/scene clock exists; future home: the
  encounter machine and recovery/world-clock work (**D7/D10**);
- **action economy and turn order** — "you lose your next action", "you act first", initiative
  swings: v1 has no turn machine and no action tokens, and the encounter machine and
  initiative are **D7** scope (§9). The expressible footprint is `hindrance_apply` with a
  condition token ("staggered", "off-balance") whose bite lands on *future checks* through
  §2.6's condition rules; an annotation may never assert a skipped, granted, or reordered
  turn as mechanical fact — that claim has no state home until D7;
- **faction or organization standing** — only per-NPC disposition exists; a faction axis is a
  future catalog version;
- **off-screen NPC movement or presence in another location** — the plausibility-bounded
  movement seam is **D16**;
- **off-screen disposition change** ("word of this reaches Lady Voss") — `disposition_*`
  targets resolve only inside the turn's ref directory (§2.4); reputation that travels rides
  the same **D16** seam, or reword to a present target / `fact_learn`;
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
| Scene-feature kinds (§2.7 only — never condition tokens) | `obstruction`, `hazard`, `smoke`, `darkness`, `alarm`, `cover`, `passage` |
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
| `passage` | feature kind | an improvised crossing or entry is established as scene fact (a force bridge, a pried-open way) — texture and situational-delta source like every feature: it creates no exit, edits no layout, and gates no `reposition` (§2.5 binds occupancy and conditions, never topology) | permanent layout change, new areas, destinations, or actual exit topology (§6) |

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
   (fixed valence, no opposition affirmation needed); `npc:44` resolves in the turn's stamped
   ref directory — the warden is watching this scene (§2.4's directory-scoped targeting; were
   they elsewhere, this is the off-screen case §6 lists). Valid today, LIVE.
4. **Imperial court, marginal failure** (`extreme` tier, no encounter → `flavor_only`+1 =
   `minor`, budget 1). Text: "the Chancellor's smile thins." Effects:
   `[{op:"disposition_worsen", npc:"npc:31", step:"slight"}]` — 1/1, adverse (fixed);
   `npc:31` is directory-present — the Chancellor is in the room (§2.4). `marked`
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
7. **Current-version LIVE cases**: `{op:"item_gain", owner:"character:7", name:"power cell"}`
   with one mundane "power cell" stack already held → the engine increments that stack by one
   ("you scavenge another"); the same op matching an entry carrying `stats` or `effect` →
   **rejection** (stacking would mint mechanics); matching *two* same-key legacy entries →
   ambiguous, rejected before any mutation; `{op:"item_lose", owner:"character:7",
   item:"recovery patch"}` where the entry carries `effect: heal_20` but no `stats` → **legal
   minor loss** under the consumable carve ("the patch tumbles into the canal — wasted"), the
   stack decrementing by one unit (§2.3); `{op:"item_gain", owner:"character:7", name:"a
   crate of 100 grenades"}` → licensed-string rejection (count assertion); two
   `disposition_worsen` entries on `npc:31` → conflict-key collision; `reposition` to the
   actor's current area → no-op; `{op:"reposition", who:"npc:63", area:"cellar",
   quality:"unfavorable"}` (destination valid and distinct from his current area — the shape
   passes, isolating the gate)
   with `npc:63` not in `affirmedOpposed` → `allegiance-unknown` (the bartender caught in the
   blast is reword-or-flavor, §6); `quality:"neutral"` in an edge-band annotation →
   neutral-illegal (§3). After a gate or gate-class rejection, legal flavor must be
   **possession-neutral**: "her knuckles whiten — the blade nearly leaves her hand" passes; "the
   saber skitters away across the deck" does **not** (it asserts an unledgered
   possession/position change and Continuity rejects the text).
8. **Gate behavior (current version)**: `{op:"item_transfer", item:"item:41",
   from:"npc:12", to:"character:7"}` → rejected at availability, `GATED:D16`, gate named,
   *before* any reference lookup; likewise `hindrance_apply` → `GATED:conditions-store`, `harm`
   → `GATED:D1b`, `scene_feature_place` → `GATED:scene-state`, `encounter_end` → `GATED:D7`;
   and per-form gating: post-D1b, `pool_drain{pool:"mana"}` is live while
   `pool_drain{pool:"strain"}` still rejects `GATED:D5` — the governing gate, not the op token,
   decides (§1.1).
   **[post-dependency]** evaluator cases (run once their gates lift): two
   `item_condition_shift(degrade)` entries on the same sword → conflict-key collision; `heal` on
   a full-health ally → no-op; a `value_reduce` + `value_enhance` pair → shared conflict key;
   `reposition` of a `pinned` actor → precondition rejection, while
   `[condition_clear(pinned), reposition]` in that order → valid (clear-then-move, §1.1);
   `condition_clear` of a *persistent* boon → priced significant from the stored record (§2.6),
   over a `minor` budget → rejected. Each rejection re-enters Chapter 1's single-revision flow.

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
absent condition tokens, durable-record destruction, item readiness/wielded state,
party capture/restraint, and player-character wealth (§6 — future
catalog versions or their named decisions); the **conditions store** and **scene-feature
record** (declared required state additions, §2.6/§2.7); a **memory-retrieval contract** strong
enough that committed facts reliably reach later council context (§2.8 names today's bounded
window); and the **ordinary-action commit path** — the ledgered transaction through which
clean-band and no-check state changes flow once rules-governed campaigns exist. That chapter
reuses this catalog's vocabulary, §1 core validation, and §1.1 evaluator — and **extends the
catalog through versioning with the ordinary-only verbs this chapter deliberately lacks**
(party location transitions foremost, §6); it owns the neutral-valence audit of every
directional operation and its own authorizer (resolved intent instead of an edge-band license).
"Reuse" means the core carries over unchanged, not that this vocabulary is already sufficient
for ordinary play.
