# Authored Development Class Catalog

Authority: the owner-delegated implementation plan in
`class-experience-implementation-plan.md`, committed `e31530e`. This record owns the initial
catalog design choices; `class-catalog.js` owns their executable data. This is a development
catalog, not a released game or a player-validated balance result.

## Scope And Evidence

All ten universal families, conditional Catalyst, and the Rider campaign module are retained.
Each has two exact branches, for 24 authored packages and 168 definitions. Intrusion remains
shared training and scenario infrastructure, never a thirteenth family. Nothing is placed in
Base or Advanced: the initial manifest is `expert-development-1`, Expert only, evidence unverified.
Its pins include rules `house-d100-1`, resolution `aetheria-d100-1`, and effects
`effects-class-runtime-1`. Definition version is 1; instance IDs are fresh opaque IDs.

| Family | Branches | Initial Distinction |
|---|---|---|
| Armsmaster | Discipline / Pursuit | Immediate weapon maneuvers / explicit quarry and movement |
| Berserker | Fury / Endurance | Exposure risk / recorded harm and Reprisal |
| Adept | Flow / Stillness | Optional movement chains / optional control transitions |
| Opportunist | Opening / Mastery | Target-bound combat payoff / recorded leverage and mastered obstacles |
| Arcanist | Formula / Ritual | Prepared direct spells / immediate spells plus exceptional workings |
| Channeler | Restoration / Manifestation | Known restoration / known force and phenomena; optional Strain |
| Oathbound | Aegis / Judgment | One bound ward / one named foe |
| Shifter | Predator / Adaptive | Combat profiles / broader movement and senses |
| Maker | Kit / Forge | Portable devices / bounded installations without autonomous turns |
| Bonded | Partner / Caller | One growing companion / one active profile from a bounded roster |
| Catalyst | Tactics / Resonance | Position cues / morale and recovery cues |
| Rider | Ace / Cavalier | Vehicle pursuit / close approach and active passenger extraction |

The genre matrix supplies authored creation labels for the same mechanical definitions. Labels
are selected once at creation and do not license later reinterpretation of grants. Original
archetype, chosen branch/class identity and canonical definitions persist across campaigns;
campaign-local ability wording remains a separate binding contract. These initial genre labels
share mechanics explicitly; they do not claim the old atlas proved mechanically identical genre
packages. Player-owned title, background, training and standing remain independent.

## Starter And Progression Policy

Selecting a branch grants its authored ready-to-play package. Level one has two usable active
abilities and one trait, not an additional mandatory ability-build screen. New exact abilities
arrive at levels 3, 5, 7 and 10. Every level from 1 through 10 has explicit health and skill
progression; levels without a new ability are not empty placeholders. The initial cap is 10.
There is one class track; no second budget is granted for Rider or for a background.

Level uses 100 XP per step. Base health is authored per branch (24-36), increasing by four per
level; traits explicitly add health where printed. Primary skill starts at 10 and gains three
per level, secondary starts at five and gains two. Traits add their printed bonuses; all skill
bonuses are capped at the signed 75. Other skills begin at zero. These are direct engine values,
not d20 attribute modifiers. Legacy four-attribute fields are compatibility data only.

New level grants preserve every existing ability instance ID and live state; they are not a
reason to rebuild a character with fresh IDs, restore health, reset uses, or erase companion
conditions. `buildClassLoadout` creates new sheets and emits the complete target entitlement for
integration to compare; it is not itself a live-character progression mutator.

## Action And Recovery Policy

Ordinary intents remain available without a named ability. A Main is shared with any controlled
companion or vehicle, never doubled. A direct ability requires only its printed target and
optional choices; class state does not silently infer an undeclared special action.

Cadence is per authored definition: unlimited, per scene, per safe recovery, or a bounded
commitment. It is not a universal renamed mana pool, nor a wholesale selection of one of the
three frozen economy proposals. Exposure and Strain are explicit class-specific risk state.
The existing `mana` fields are zero for these packages. Recovery requires no active encounter,
no immediate threat, and a recorded safe recovery; it cannot be asserted by free prose alone.
Recovery resets uses and Strain, restores living character/companion health, but does not repair
vehicle hull or clear persistent conditions. Scene end clears scene uses and short-lived class
state, not recovery uses, health or Strain. Exact lifecycle data is `CLASS_RECOVERY_RULES`.

Arcanist preparation changes outside an active encounter, with three initial slots and capacity
growing to seven. Both starting spells are prepared automatically. Known Channeler spells have
no preparation list. Adept openers and ordinary actions work from Ready: transitions add optional
value and never gate routine spellcasting. Maker has a usable reusable tool after devices are
spent. All companion changes preserve health fraction and conditions, avoiding free healing.

Catalyst requires a campaign guarantee of an allied actor in ordinary play. Rider requires both
an enabled `rider` module and a campaign guarantee of vehicle-capable scenes and replacement after
loss. Enabling the module does not grant Rider powers to a different class or a free second class.

## Execution Contract

Definitions are immutable, with complete activation, targeting, cadence, cost, contextual check,
requirements, success/failure templates and closed mechanic data. A default tier is guidance for
contextual uncertainty, not a forced check when the action has no uncertainty or consequences.
The engine, not a model, owns quantities, use counters, entitlements and all state transitions.

`getAbilityDefinition(id, version)` supplies authoritative mechanics. Owned ability records hold
opaque instance identity and canonical source metadata; mutable copies never become executable
definitions. Canonical names/descriptions currently fit the existing 80/500 limits; there are no
invented aliases. `buildClassLoadout` returns complete canonical bindings for every active grant.
Passives are not invocable words and their exact numeric modifiers are applied to the new sheet.

Templates use `$self`, `$target`, `$area`, `$ally`, `$ward`, `$companion`, `$travelers`, `$vehicle`,
`$passengers`, `$item`, `$catalyst`, `$condition`, `$object` and `$feature`. The authorizer must bind
them to recorded typed identities before calling the effects evaluator. Fixed optional condition
clears carry template-only `optional:true`: omit them when absent, then strip that key before the
signed evaluator. A selected `$condition` remains strict. No unresolved placeholder is legal in a
committed effect or history record.

All-area spells include allies. Their maximum of six is an authorizer size bound: an overfull
area must be rejected, never silently reduced to six convenient targets. Unwilling player targets
retain the consent boundary. One consequential area intent may use one check; no extra player
reaction roll or blocking prompt is introduced. Magic Missile explicitly needs no weapon or
ammunition; its seeking policy ignores authored mundane aiming/cover sources, not magical wards.
This policy requires typed source validation and is not permission to classify arbitrary prose.

Profiles, companions and vehicles have exported complete registries. Their names are not enough
to execute them. Profile drawbacks are explicit slight hindrance sources, not negative skill
bonuses that disappear at the signed zero floor. They share the signed delta cap and must not
be counted twice as a model-supplied situation. `REQUIRED_EFFECT_OPERATIONS`, `REQUIRED_MECHANIC_HANDLERS` and
`assertCatalogExecutorSupport` let integration reject an incomplete executor. Handler registration
is only a dependency gate: focused runtime tests must additionally demonstrate each mode, state
transition, cap, expiry and replay path before claiming the corresponding ability works.

## Required Extensions

Signed operations retain `harm` grades graze/wound/grievous and `heal` grades patch/mend/restore,
plus condition, reposition and scene-feature schemas. The delegated initial numeric calibration
is harm 2/5/9, heal 3/6/10, pool shallow/deep 2/4; it is not balance evidence. NPC/companion/vehicle
vitals and conditions must be concrete typed actor records before applying those operations.

The effects runtime manifest must additionally implement these explicit operations:

| Operation | Exact Additional Contract |
|---|---|
| `disarm` | Recorded held item, actor ownership, natural/fixed weapon rejection |
| `item_consume` | Exact held item ref and positive authored quantity; revival catalyst resolved before execution |
| `object_unlock` | Recorded ordinary unopposed lock only; no protected-system bypass |
| `object_disable` | Recorded ordinary mechanism, scene duration; no new object or unauthorized access |
| `reveal` | Bounded existing fact category on a recorded subject; no invented hidden facts |
| `teleport` | `blink` visible near destination vs `circle` visited destination and willing travelers; ward/safety checks |
| `traverse` | Authored flight or grapple route, real destination, one-area bound and anchor/surface requirements |
| `revive` | Recorded death turn, intact body, willing return, elapsed-turn limit, exact restored health and condition |
| `vehicle_repair` | Existing active vehicle ref, authored amount eight, capped at hull maximum |
| `vehicle_condition_apply` | Explicit vehicle-targeted steadied record; does not widen the signed actor-ref grammar |

Ordinary opposition may use the companion runtime extension `vehicle_harm` with the same authored
harm grades. Vehicle damage and conditions are not silently written through actor-only operations.
`CLASS_EQUIPMENT` supplies exact equipment IDs, weapon kinds, weapon categories, armor and tool
tags. Weapon permissions remain separate from display names and from inert compatibility attributes.

Class handlers own maneuver/brace, quarry, Exposure/Reprisal, optional sequence, Opening,
preparation, channeling, declaration, complete profile replacement, devices, companions, cues,
vehicles, rituals and passive capabilities. Device deployments have no independent Main;
Relay Emplacement is one owned ability with an explicit deploy-or-fire choice, not an unowned
granted command. Limited Aegis protection reduces one incoming harm to one actual bound ward
within range and expiry; it is not the withdrawn universal Bodyguard redirection proposal.

Ritual progress belongs to a particular ability, actor, target, destination and travelers. Harm,
forced displacement or scene change cancels it. Final costs/effects commit once on completion;
starting or continuing a ritual cannot charge its recovery use repeatedly. A missing catalyst or
invalid target fails before commit, never after partially reviving a character.

## Verification

`test-class-catalog.mjs` exports `runClassCatalogTests()` and runs standalone. It covers all 24
branches at all ten levels, real recognition/declaration projection for every owned active grant,
identity, mutation isolation, canonical limits, starter/progression completeness, preparation,
family state, modules, tiers, versions and executor dependency rejection. This is component
evidence only. Actual operation execution, integrated creation and play, persistence, retry and
human enjoyment remain distinct evidence obligations in the implementation plan.

Initial component result, 2026-09-07: standalone suite passed for 24 branches, 168 definitions,
240 level snapshots and 936 actual declaration projections. Tier-guard bite proof: temporarily
disabled Expert-only build rejection, observed the expected failing assertion (Base did not throw),
restored the guard, and reran successfully. This proves that gate test detects its removed guard;
it is not proof of complete runtime or safe version migration.

The subsequent `class-actions.js` and `class-progression.js` component suite executes all 144
active definitions, all 56 active handler modes, and 216 live level transitions across every
branch. Fixtures now use actual `createClassSheet`, `createRulesWorld` and `addClassActor`, with
explicit recorded scenario facts added for each ability, rather than fabricated class records.
Additional cases cover exact ownership/version/cadence rejection, late-effect rollback, area-spell
friendly fire and overfull-area rejection, direct spells without equipment, optional overreach,
ritual interruption, companion/vehicle identity preservation and class-vs-class brace, ward and
last-stand damage receipts. These are deterministic component results, not human playtest evidence.
Cadence-guard bite proof: disabling the exhausted-use rejection made the expected `/no uses/`
assertion fail; the guard was restored and both focused suites passed again. `git diff --check`
also passed. Full-suite and actual turn-orchestration evidence remain root-owned.

`prepareClassAction` returns a frozen canonical plan without mutation; `finalizeClassAction`
revalidates it and applies typed effects plus incoming class protection before class patches.
`prepareClassEvent`/`finalizeClassEvent` handle explicit Main, movement, cue, harm and scene events;
`finalizeIncomingClassEffects` owns the class-adjusted incoming batch. No model supplies damage
amounts or class-state patches. Refuse Defeat arms an Endure commitment without spending its
recovery use; the effect evaluator spends that use only when its one-health floor actually saves
the owner and records winded. Existing winded does not invalidate that rescue.

Advancement accepts engine award IDs and the fixed encounter/objective/milestone awards of
25/50/100 XP, preserving prior IDs and missing health rather than restoring everyone to full.
Dead or zero-health actors remain at zero. New canonical bindings are returned for atomic
persistence with grants. Recovery and preparation require their explicit timing/safety checks;
scene transfer uses `clearClassSceneState`, which clears transient target references without
consulting missing old-world actors and without resetting persistent recovery uses, health,
Strain, preparation, grants or companion identity. Persistent condition actor refs must be
rebound by the arrival adapter; self-contained Shifter profiles persist until deliberately changed.

Runtime orchestration still must call these hooks for the actual turn path, derive targets and
choices from deliberate player input, own safe-recovery facts, and bind valid scenario entities.
An exported function or registered handler alone is not proof that the application calls it.
