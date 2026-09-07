# Class Runtime Effects Version 1

**Authority:** the owner-delegated implementation in
`.agents/review/class-experience-implementation-plan.md` (2026-09-07).
**Catalog identity:** `effects-class-runtime-1`, exported as `EFFECT_CATALOG_VERSION`
by `rules-effects.js`. This is a development calibration, not demonstrated balance or fun.
The pure evaluator is implemented separately from the database adapter and Council integration;
passing its tests alone does not establish a playable campaign.

This version incorporates the signed Chapter 2 schemas and adds the specific runtime capabilities
below. It does not claim that the signed `effects-1` vocabulary already licensed NPC vitals,
teleportation, revival, objects, vehicles, or recorded NPC allegiance. Missing and unknown version
pins fail explicitly. No legacy campaign is converted by importing or calling this module.

## API And Authority

`evaluateEffects({state, effects, consumer, actor, turn, transactionId, band, stakesLicense,
affirmedOpposed, harmFloors})` returns `{state, effects, events, cost}` or throws `RULES_EFFECT_*`.
`actor` is the positive integer acting character ID; `turn` is the originating ledger turn;
`transactionId` is the engine's stable transaction identity, not a new fake check ID.

- `consumer` is `ordinary`, `ability`, or `annotation`, selected by the engine, never a model.
- `effects` contains exact operation schemas with concrete refs. Invocation placeholders, template
  `optional` flags, model quantities and engine-resolved metadata are not legal proposals.
- The caller must finish Continuity's semantic gates and the appropriate ordinary/ability
  entitlement checks before execution. The evaluator does not parse item descriptions, fictional
  quality, protected-system access, fact singularity, or prose into permissions.
- Annotation execution additionally requires the committed edge band, license and
  Continuity-emitted `affirmedOpposed`. Critical success permits only beneficial entries;
  all other edge bands permit only adverse entries. Each entry prices independently, with budgets
  zero/one/two. Neutral effects are ordinary-only. Empty arrays remain legal flavor-only results.
- Every consumer shares exact schemas, reference binding, ordered tentative state, per-entry
  no-op rejection and conflict keys. Failed arrays never mutate caller state. Repeated logical
  transactions are the durable store's responsibility, not an in-memory evaluator cache.
- The adapter commits the returned state and records atomically under the originating transaction.
  Resolved effects carry `catalogVersion`, `weightClass`, `pointCost`, `effectiveValence`,
  `resolvedTargets`, and `pricingPrestate`. These metadata fields cannot be proposed by models.
  Check identity, target, raw roll, band and the other signed outcome fields never change here.

The optional internal-only `harmFloors` array carries
`{effectIndex,who,minimum:1,sourceAbilityId}` (zero-based effect ordinal). It is produced only by
the class lifecycle handler after validating an armed Endure/Refuse Defeat commitment; model
plans, HTTP bodies and effect schemas cannot carry it. The evaluator independently verifies a
matching target and harm entry, the target's owned ability ID/definition/version, the catalog's
actual `exposure/last_stand` mechanic and unused one-per-recovery cadence. Unknown/forged sources,
other floors and nonlethal inputs reject. It records the recovery use in the same tentative
`classState.recoveryUses[definition.id]` that applies the one-health floor. The class handler must
merge, not overwrite or charge, that consumed use. Absent winded is applied for the scene;
existing winded remains unchanged. At health one, prevented harm can apply zero damage because
the genuine prevention consumes its authored recovery use, not because generic no-ops are legal.
Resolved `pricingPrestate.floor` and `appliedAmount` preserve provenance and actual health loss.
A later invalid effect rolls back health, winded and consumed cadence together.

## Authoritative State

The target-world adapter owns one JSON snapshot, not independently writable projections:

```js
{
  effectCatalogVersion: 'effects-class-runtime-1',
  currentLocationId: 1,
  actors: {
    'character:1': {
      name: 'Hero', health: 20, maxHealth: 30, party: true, present: true,
      locationId: 1, area: 'court', status: 'active',
      inventory: [], resources: { mana: { current: 4, max: 6 } },
      conditions: {}, classState: {}, abilities: []
    }
  },
  areas: {
    'area:1:court': {
      id: 'court', locationId: 1, adjacent: ['gate'], exits: ['area:2:dock'],
      visible: true, safeToOccupy: true, visited: true, focus: false,
      teleportWard: false, anchor: false
    }
  },
  items: {}, features: {}, objects: {}, vehicles: {}, facts: [],
  encounter: { active: false, participants: [] }
}
```

- Actor keys are `character:<positive-id>` or `npc:<positive-id>`. Both have actual vitals.
  All PCs have `party:true`. NPC `party:true` is an explicit recorded ally/companion extension;
  non-party NPC direction still requires `affirmedOpposed`, for every consumer. The evaluator
  never infers allegiance from names, descriptions, relationship scores or who was attacked.
- Actor `area` is a bare area ID and `locationId` binds it. Areas are keyed by qualified refs.
  Signed core `area` inputs remain bare IDs at the current location; resolved records qualify
  them. Duplicate area IDs within a location fail rather than guess. Present actor refs cannot
  address off-screen actors. The adapter must supply the turn's actual referenceable context.
- Actor conditions are a token-keyed object containing the exact signed records:
  `{actor,condition,class,detail,source,duration,appliedTurn}`. The five hindrance and three boon
  tokens retain Chapter 2's semantics: no automatic arithmetic or novel incapacities.
- Durable items are keyed by `item:<id>` and carry matching `id`, `name`, `type`, `description`,
  `holder` (actor or qualified area ref), `condition`, `class`, boolean `lost`, and `provenance`.
  They never have `quantity`. Custody changes preserve identity; loss marks out of play, never
  deletes the record or licenses destruction. Runtime readiness fields are `weapon`, `wielded`,
  `natural`, and `fixed`; transfer/drop/pickup clear recorded wielded state.
- Features use the signed record with matching typed `id`, numeric `location`, qualified `area`,
  `kind`, `name`, `duration`, `works_against`, `status`, `source`, and `appliedTurn`. Engine-issued
  feature refs are deterministic from transaction ID and effect ordinal. Clearing retains a
  tombstone with `clearedBy`/`clearedTurn`; imports must preserve/remap tombstones too.
- Objects use `object:<id>` keys and `{kind:'lock'|'mechanism',locationId,area,security,
  opposed,locked,disabled,protectedSystem?}`. `security` is `ordinary` or `protected`.
  `disabled` is null or `{duration,source,appliedTurn}`. These are real object records, not prose
  interpretations of layout names.
- Vehicles use `vehicle:<id>` keys and `{locationId,area,hull,maxHull,operator,status}`;
  `operator` is the controlling actor ref and `status:'active'` is required for repair.
  A vehicle's own conditions use `{vehicle,condition,class,detail,source,duration,appliedTurn}`
  records, not actor conditions with a disguised vehicle ID.
- Actor, object and area `knowledge` arrays contain `{id,scope,fact,discovered}`. IDs are stable
  within the subject; scope is closed and fact is already recorded. Reveal never generates a
  fact. Party facts store `{fact,turn,importance:3,keywords:[]}` and full-history textual
  duplicate checks run against the entire supplied fact store, not a retrieval window.
- Scene conditions expire and scene features become tombstones when the current-location pointer
  changes. Persistent records remain. Temporary object disablement ends on this same boundary.
  Encounter completion alone does not silently redefine the signed scene-duration boundary.

## Numeric Calibration

Signed grade tokens now have engine-owned maps:

| Operation | Tokens And Values |
|---|---|
| Harm | `graze:2`, `wound:5`, `grievous:9` |
| Heal | `patch:3`, `mend:6`, `restore:10` |
| Pool drain/restore | `shallow:2`, `deep:4` |
| Disposition | `slight:10`, `marked:25`, sign by operation, clamp -100 through 100 |

Health clamps to zero/max; resource values clamp to zero/max. Class costs, Exposure, Strain-risk
semantics, preparations and limited uses belong to the class handler. Signed pool operations do
not interpret those economies from their labels. Harm at zero and healing at maximum reject.
Harm emits `health_zero` when relevant but does not kill, remove, surrender or displace anyone.
Death and revival use separate recorded transitions. Grade maps and extension schemas are pinned
configuration; changing them requires a new catalog version, not a silent engine rebalance.

## Runtime Extensions

The full authored catalog's required effect operations are checked against
`SUPPORTED_EFFECT_OPERATIONS`. Numbers below are exact authored literals passed by the class
handler after definition/ownership checks, never numeric fields accepted from model plans.

| Operation | Exact Added Schema And Consequence |
|---|---|
| `disarm` | `{op,who,item}`; target's wielded, removable recorded weapon drops into its current area. Natural/fixed weapons reject. No new item is minted. |
| `item_consume` | `{op,owner,item,quantity:1}`; the acting character's held `kind:'revival-catalyst'` record becomes lost. The accompanying revival is independently ledgered; the item is not a prose effect parser. |
| `item_ready` | Ordinary-only `{op,owner,item}`; the acting PC readies one held, usable, movable weapon for which its pinned class grants training. Requires explicit compatible `weaponKind`, `weaponCategory`, `wielded:false`, and boolean `equipped`; sets wielded/equipped true. Unknown or contradictory authored equipment, another owner, broken/natural/fixed weapons and already-readied weapons reject. It grants no attack, damage or pickup. |
| `object_unlock` | `{op,object,maximumSecurity:'ordinary'}`; sets a recorded ordinary lock to unlocked. Authored checkless use requires `opposed:false`; ordinary skill entitlement belongs to the ordinary authorizer. |
| `object_disable` | `{op,object,maximumSecurity:'ordinary',duration:'scene'}`; disables an ordinary recorded lock/mechanism until scene change. Protected systems remain a distinct access subsystem. |
| `reveal` | `{op,subject,scope,maximum:1|2}`; actor/object/area subject reveals at most that many undiscovered stored facts in stable record order, marks them discovered and appends exact party facts. No matched records means a rejection, never success-by-prose. |
| `revive` | `{op,who,health:1,maximumElapsedTurns:2|10,condition:'winded',duration:'scene'|'persistent'}`; requires a party member at zero with `status:'dead'`, recorded `deathTurn`, `intactBody:true`, `willingReturn:true`, and the authored time window. Restores active status/one health and applies the authored winded condition only if absent, preserving an existing record; it does not waive ritual/catalyst prerequisites. |
| `teleport` | `{op,who,area,maximumAreas:1,mode:'blink'|'circle'}`. Blink moves one explicit actor to a visible adjacent safe area without traversing terrain. Circle accepts one to three unique explicit travelers including its caster, a recorded caster focus and previously visited destination. Other travelers must be willing and nearby. Wards block departure/arrival; pinned blocks movement. Only circle accepts a remote qualified area ref. |
| `traverse` | `{op,who,area,mode:'flight'|'grapple',maximumDistance:1}`; one explicit actor crosses to a visible adjacent safe area. Grapple requires a recorded reachable anchor; flight respects a recorded flight block. Neither invents a destination or enables indefinite flight. |
| `vehicle_repair` | `{op,who,amount:8}`; repairs the acting character's active recorded vehicle by eight hull, clamped to its maximum. Zero/destroyed hull is not revived. |
| `vehicle_harm` | `{op,who,grade:'graze'|'wound'|'grievous'}`; explicitly targets vehicle hull using the same 2/5/9 map. Ordinary and authored ability consumers only. The authored Rider loss rule marks zero hull `lost`, empties occupancy, clears its vehicle-tied obstruction, and records the exact occupants in the event. Actor health, status and position remain unchanged: this is unusable craft and disembarkation, not destruction, death, collision damage or forced displacement. The wreck remains in its recorded location. |
| `vehicle_condition_apply` | `{op,who,condition:'steadied',duration:'scene',detail}`; applies the Rider's authored vehicle boon with a vehicle-typed record. It is scene-duration fictional footing, not numeric armor or immunity. Generic actor-condition operations continue rejecting vehicle refs. |
| `location_transition` | Ordinary-only `{op,location,area}`; a recorded exit reaches a different location's safe area, moving the currently present party after the active encounter ends and honoring pinned. Updates the current pointer and runs scene expiry. |
| `actor_status` | Ordinary engine-only `{op,who,status:'active'|'downed'|'dead'}`. Active -> downed requires zero health; downed -> dead requires zero and records `deathTurn`; downed -> active requires positive health. These are explicit authorizations, not automatic extra consequences of `harm`. |

All class extensions are excluded from annotations. Object unlock/disable and vehicle harm can also serve ordinary
actions under their authorizer; bypassing a mundane check is an authored ability advantage, not
a ban on ordinary lockpicking. Other added class operations require `consumer:'ability'`.
Core NPC vitals and recorded party-allied NPC framing are available to every consumer under their
normal authorization.

Ordinary `wield {item}` consumes one Main and emits exactly `item_ready`. Pickup remains a
separate custody action and leaves the weapon unwielded; attacking with it requires a later
ready action. The scene descriptor pins weapon training through optional `weaponCategory`:
`melee_weapon` permits `simple`, `martial`, or `heavy`, defaulting to `simple`; `ranged_weapon`
permits and defaults to `ranged`. Nonweapons use null. These defaults belong to scene schema 1,
not display-name inference, and never change the fixed ordinary wound harm grade.

Reveal scope tokens are `quarry_route`, `combat_trait`, `defense_trait`, `leverage`, `motive`,
`route`, `area_features`, `profile_senses`, and `companion_scout`. Remote reveal is limited to
`area_features` on a visited recorded area. It cannot invent a map, enemy or trait.

Circle moves only the selected traveler refs. It never transports unselected PCs or companions.
Other travelers require exact current-action `consentingActors` supplied by the authorizer;
neither party membership nor a persistent `willingTravel` flag grants that permission. Consent
is validated without writing a lasting flag to the actor. Ritual continuity compares its actual
structured bindings, preserving array order but ignoring JSON object-key serialization order.
The single-scene runtime must reject a remote party split before charging costs until it supports
scene-local turns. That integration guard is not permission for the evaluator to expand a party.

## Remaining Boundaries

Scene schema 1 can introduce a present living independent NPC with optional
`injury:'graze'|'wound'|'grievous'`. The engine subtracts the corresponding existing 2/5/9
harm grade from its authored kit health, making an actual wound available to healing.
It is not a model-chosen HP value or recurring effect. Injury cannot accompany `fallen`,
apply to an absent NPC, alter a player/controlled companion, or reapply to an initialized
NPC. The scene, authoring and actual HTTP creation tests cover those boundaries and real
healing; removing injury materialization failed the expected-health assertion before restoration.

Scene schema 1 can introduce an independent NPC with optional
`fallen:{age:'recent'|'unknown',body:'intact'|'unknown'|'destroyed',returnChoice:'willing'|'unwilling'|'unknown'}`.
All three fields are required. The materializer owns zero health and dead status; only `recent`
stamps `deathTurn` from the engine's scene turn. Unknown age has no numerical death turn, so a
revival time window cannot be assumed. Explicit intact body and willing NPC return set the
corresponding permission flags; unknown values omit those permissions, and negative choices
remain false. Party allegiance never grants willingness.

This is initial NPC scene authoring, not a new PC dying or consent rule. PCs and controlled
companions cannot receive the descriptor. A previously initialized NPC cannot receive it again:
subsequent location frames require the same pinned NPC kit and retain health, maximum health,
death status/turn, body and willingness. Re-entering a scene cannot refresh a revival window or
reset an unwilling choice. Fallen NPCs cannot be listed as active encounter opposition. The
ordinary live-PC death/return lifecycle remains separate integration work.

`test-class-scenario.mjs` covers the strict descriptor, absence of inferred consent, recent-age
window, and preservation/rejection behavior on subsequent location frames.
`test-class-revival.mjs` creates campaigns through `createCampaign` with only the provider
boundary stubbed, verifies the persisted opening snapshot, then uses real pure progression and
action handlers for both Recall the Departed and Breath of Return. It does not claim live
turn-by-turn leveling or PC death/return coverage. The unknown-age test was verified to fail
when the recent-only timestamp guard was temporarily removed, then passed after restoration.

Ritual preparation preflights its authored `revive` effect through the same pure evaluator on
every working, discarding that preview. Unknown, future, invalid or expired recorded death ages
therefore fail before a new working, cadence use or catalyst consumption. No separate model
arithmetic or guessed age is introduced. The final effect still validates the current window.
Class vehicle projections synchronize occupants from the authoritative vehicle record after
incoming effects and action patches; Passenger Rescue passengers consequently remain aboard
for a subsequent Mounted Charge. Focused `test-class-actions.mjs` regressions cover both paths:
each failed when its corresponding fix was temporarily removed and passed after restoration.
The focused action suite, creation/revival suite, and full `node test.js` entry passed with both
fixes restored; `git diff --check` was clean.

- `value_reduce` and `value_enhance` explicitly fail `GATED:derived-value-channel`. A derived
  checked-action value channel is not implemented, and no current catalog ability requires it.
- Summon/companion creation, complete profiles, class states, progression, Main ownership,
  ritual preparation, recovery and reaction commitments are class-handler operations. They are
  not represented by a feature with an invented actor description.
- General object destruction/transformation, arbitrary NPC allegiance changes, intelligence
  networks, permanent layout edits, PC wealth and arbitrary item-use recipes remain absent. An
  unknown operation fails, and narration cannot substitute for these missing state operations.
- The core does not implement semantic Continuity checks or prove that an effect is entailed by
  an ability the actor owns. Those are mandatory preconditions of the caller, not a fallback to
  generative permissions. Persistence/bundle remapping must cover actors, areas, items, features,
  objects, vehicles and all embedded refs before a target campaign can promise portability.

## Rider Runtime Completion

The initial class-runtime release explicitly defines craft loss, rather than retaining the
earlier development behavior in which zero hull left the craft active. This is a versioned
class extension, not a claim about the signed actor-health rules. `vehicle_harm` uses the
existing grade map and a single NPC kit Main; there are still no NPC checks or separate mount
turns. The `mounted` NPC kit is one independent vehicle-scale unit with fixed health, skills,
close actor attack and close hull attack options. Fiction must establish that scale; the model
cannot assign numeric power. Player target effects still use actor refs, while the kit's
`vehicle_attack` deliberately targets an opposing present occupied `vehicle:` ref.

Zero hull makes the craft `lost` and unusable. Its exact occupants disembark without any actor
health, status, condition or position change, and its own Hold the Approach obstruction ends.
The wreck remains recorded. A later invalid effect rolls the entire tentative loss back.
Field Damage Control repairs damaged active hull by its printed eight, not a lost craft.
An explicit `replace_vehicle` utility spends one Main outside an encounter at recorded safe
recovery. It requires the actor's genuinely lost, empty assigned craft, creates a new identity
at the actor's location with the same profile and level-derived maximum, and preserves the
wreck and reciprocal replacement links. Those links belong to that campaign world, not a
reusable character-sheet assignment. Copying a character does not acquire foreign wreck refs.
Rider-enabled initial scene authoring must establish connected, unblocked safe recovery access;
a current empty wreck never prevents walking along an otherwise legal recorded journey and
is never moved with the walkers.

`VEHICLE_MOVEMENT_RULES.version = 'vehicle-movement-1'` is an initial delegated calibration,
not playtested balance. Vehicle movement requires its present operator, actual occupants and
a connected unblocked route. Pinned operators/passengers must be freed, including Passenger
Rescue's printed clear-before-boarding. Party-affecting recorded obstructions block the route.
Impossible Approach can bypass exactly one such obstruction only when the player explicitly
selects its existing feature ref; it neither clears that feature nor permits a solid barrier.
A vehicle Main whose route enters one or more recorded party-affecting hazard areas takes
one wound (five hull) for that movement, even when bypassing an obstruction. This bounded
movement consequence does not invent additional passenger damage. Targeted Run checks actual
vehicle scale; Driving Impact also requires its printed movable vehicle-scale target.
Evasive Course's actual vehicle `steadied` record can ground one slight favorable Pilot delta
with exact `{kind:'vehicle_condition',ref:<vehicle ref>,token:'steadied'}` provenance. The shared
check-context builder requires the acting Rider's own active, occupied, present craft and its
canonical vehicle condition. Other skills, craft, tokens and stale/remote/unoccupied assignments
do not supply this candidate. Council still judges relevance; it creates neither an NPC roll
nor automatic armor. The accepted check and its situational delta persist in the usual d100
ledger, independently of later narration.

## Comparison Dependency

Mundane inventory names and fact comparison use trim, whitespace collapse, NFC and full default
Unicode case folding. `unicode-case-folding` is pinned exactly to `1.1.1` with lockfile integrity;
it has no runtime dependencies or install scripts. Its [primary repository](https://github.com/avivkeller/unicode-case-folding)
and [generator](https://github.com/avivkeller/unicode-case-folding/blob/main/src/build.js) show the
official Unicode Common/Full mappings rather than lowercase approximation; its
[license](https://github.com/avivkeller/unicode-case-folding/blob/main/LICENSE) is MIT.
The committed tests cover sharp-S expansion, Greek final sigma, dotless-i distinction and NFC.
Updating comparison data is a deliberate compatibility change, not an incidental formatter task.
