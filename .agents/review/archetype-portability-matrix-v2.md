# Cross-genre character portability plan — v2

**Status**: DRAFT v2 for owner review. D3's architecture is not owner-approved; character-creation
composition, ability packaging/costs, and non-ability portability remain unresolved. This document
authorizes no product-code change.

**Date**: 2026-07-27

**Supersedes as the active working draft**:
`.agents/review/archetype-portability-matrix.md`. The v1 draft and
`.agents/review/archetype-portability-matrix-review.md` remain evidence.

**Review basis**: The independent review accepted functional-kernel plus genre-expression as the
right mental model and identified four implementation gaps:

1. the 22 families must be internal design vocabulary, not an open player-facing multiclass menu;
2. family distinctions need explicit decision loops;
3. translated abilities need a machine-checkable binding to the D2 effect catalog; and
4. complete character portability cannot be claimed until D13/D16 settle inventory, history,
   relationships, injuries, wealth, and provenance.

This v2 incorporates those corrections. It deliberately does **not** infer owner approval of the
reviewer's package-defined character-creation recommendation.

## 1. Goal and product promise

A saved character can enter a campaign in another genre as a **genre-translated incarnation**
without losing what the character feels like to play.

Examples:

- a western gunslinger becomes a fantasy archer;
- a fantasy wizard becomes a cyberpunk netrunner;
- a rogue remains an infiltration specialist while tools and occupation change;
- a paladin may become an oath-bound space guardian without becoming loyal to an institution the
  player never chose.

The product promise is:

> Preserve the character's functional kernel—role, signature affordances, action shape,
> cost/tempo, relative competence, progression weight, dependencies, weaknesses, and
> player-marked anchors—while translating genre expression. Show every translation to the player
> and require approval before play.

### 1.1 Non-goals

- A class-name dictionary that assumes every noun has a safe counterpart.
- A visible menu of 22 families or unrestricted primary-plus-two-secondary multiclass selection.
- Model-generated numbers, operations, costs, or mechanical permissions.
- Silent conversion of magic, faith, companions, identity, allegiance, body, or signature items.
- Mutating the source character in place.
- Claiming complete portability before D13/D16 settle non-ability state.
- Changing the settled D0 rulebook per campaign.
- Implementing any part of this plan before its owner gates and a concrete code phase are approved.

## 2. Durable constraints and current evidence

### 2.1 Settled constraints

- **D0**: one bespoke, versioned rulebook; campaigns change flavor, not mechanics.
- **D2**: abilities select operations from the owner-signed effect catalog; they never invent
  mechanics inline.
- **Chapter 2 §5**: ability templates may use role placeholders, but packaging, targeting,
  cooldowns, archetype assignment, authorizers, and ability-specific opposition affirmation remain
  D3/D5 work.
- Engine owns all numbers, state transitions, validation, and canonical records. Models emit
  bounded identifiers/enums and player-facing expression.

### 2.2 Shipped behavior

- Campaign creation collects genre and character concept on one screen
  (`public/index.html:279-306`).
- Reusable profiles persist archetype, attributes, inventory, abilities, progression, checkout
  state, and lineage (`db.js:241-263`).
- `existing` reuses an available profile; `copy` creates an independent branch
  (`rpg-engine.js:1095-1159`).
- Reuse/copy currently carries the profile verbatim. A western firearm, fantasy spell, or
  setting-specific ability is not translated for the destination genre.
- Current `validateRulesetData` accepts free-text ability name/cost/effect/limits
  (`rpg-state.js:745-771`); it cannot prove D2 membership or portability invariants.

### 2.3 Dependency boundary

The translation architecture can be approved before the following decisions, but code cannot be
cold-implemented until they land:

| Dependency | Why it blocks |
|---|---|
| D3-A: portability architecture | Defines kernel/expression, modes, anchors, and approval semantics |
| D3-B: new-character composition | Decides how a newly created source character acquires a kernel; Translate itself does not expose the family taxonomy |
| D5: ability packaging/costs | Defines costs, cooldowns, authorizers, and resource cadence that translations must preserve |
| D6 where relevant | Defines final spatial/range vocabulary; v2 uses abstract action-shape bands until then |
| D13/D16 minimum state policy | Defines whether and how inventory, injuries, wealth, history, relationships, significant items, and provenance translate |
| Concrete phase approval | Selects implementation slices and files; no code is authorized by this draft |

## 3. Product modes

The three operations remain distinct in storage, UI, and API behavior:

| Mode | Player meaning | Source mutation | Destination result |
|---|---|---:|---|
| **Continue** | Use the same person and same sheet in a compatible campaign | Checkout/status only | Exact existing profile |
| **Branch** | Make an exact parallel copy | None | Verbatim copied profile with lineage |
| **Translate** | Make a destination-genre incarnation of the same functional character | None | New profile branch with preserved kernel and approved genre expression |

V2 proposes **Translate as a new explicit mode**. It does not change the meaning of shipped
`existing` or `copy`, and it never translates merely because a profile looks genre-incompatible.

Translate creates a new profile lineage record. The source remains readable and unchanged even when
active elsewhere. Whether translated variants share a higher-level identity record is D13 scope.

## 4. Ownership model

| Owner | Owns |
|---|---|
| **Source profile** | Approved functional kernel, progression weight, source abilities, source expression, player anchors |
| **Destination campaign draft** | Genre family/modifiers, pinned chassis/catalog versions, setting vocabulary, capability assumptions |
| **Engine** | Kernel validation, D2 membership, normalized fingerprints, equivalence checks, hashes, versioning, persistence, approval freshness |
| **Expression model** | Candidate destination names, descriptions, tools, occupations, and source metaphors selected only from engine-supplied legal shapes |
| **Player** | Anchor designation, ambiguous adaptations, alternatives, final translation approval |

The expression model may explain a legal mechanical shape. It may not determine the shape.

## 5. Functional-kernel contract

### 5.1 Proposed stored shape

Field names are plan-level and may change during an approved implementation phase. Their ownership
and validation semantics are normative for this draft.

```json
{
  "schemaVersion": 1,
  "sourceChassisVersion": "origin profile's engine-owned version",
  "sourceCatalogVersion": "origin profile's pinned catalog version",
  "primaryFamily": "marksman",
  "secondaryFamilies": ["duelist"],
  "affordances": [
    {
      "key": "precision-shot",
      "sourceAbilityKey": "source-profile ability id",
      "effectTemplateRefs": ["engine-owned template id"],
      "actionShape": {
        "reach": "projected",
        "targetShape": "single",
        "delivery": "direct",
        "tempo": "repeatable",
        "setup": "none"
      },
      "costShapeRef": "engine-owned cost-shape id",
      "reliabilityBand": "signature",
      "dependencyRefs": ["signature-ranged-implement"]
    }
  ],
  "sourcePatterns": ["training", "precision-projectile"],
  "anchors": [
    {
      "key": "inherited-sidearm",
      "kind": "signature-item",
      "policy": "ask-before-source-change",
      "playerText": "Inherited from the character's father"
    }
  ],
  "weaknessRefs": ["vulnerable-when-engaged-close"],
  "progressionRef": {
    "rulesVersion": "engine-owned version",
    "tier": "engine-owned tier token",
    "budgetRef": "engine-owned earned-budget record"
  }
}
```

### 5.2 Engine-owned enums

The final enum lists belong to the approved D3/D5/D6 plan. V2 requires at least:

- `primaryFamily` and `secondaryFamilies`: the internal family ids in §7;
- `reach`: `self`, `close`, `projected`, `remote_or_system`;
- `targetShape`: `self`, `single`, `multi`, `area`, `environment`;
- `delivery`: `direct`, `indirect`, `persistent`, `delegated`;
- `tempo`: `repeatable`, `limited`, `prepared`, `reaction`, `extended`;
- `setup`: `none`, `position`, `mark`, `access`, `ritual`, `loadout`;
- `reliabilityBand`: code-owned comparative band, never a model-authored number;
- anchor `kind`: `power-source`, `signature-item`, `companion`, `identity`, `body`, `faith`,
  `oath`, `allegiance`, `relationship`, `weakness`, or later owner-approved value;
- anchor `policy`: at minimum `literal`, `ask-before-source-change`, or `translatable`.

These are portability comparison fields, not a replacement for final tactical/range rules.

### 5.3 Kernel invariants

Translate preserves:

1. primary and secondary functional families;
2. every signature affordance or an explicitly player-approved replacement;
3. reach, target shape, delivery, tempo, and setup;
4. comparative reliability;
5. cost and recovery cadence;
6. dependency structure;
7. agency structure, including companion or mode choices;
8. weaknesses, taboos, oaths, and risks;
9. earned progression weight; and
10. every player-marked anchor.

Changing one of these is a rebuild, not an automatic translation.

## 6. D2 effect binding and equivalence proof

### 6.1 Ability templates

Every portable affordance references engine-owned ability templates. A template:

- is pinned to a catalog version;
- selects only D2 operation tokens that exist in that version;
- uses D2 role placeholders (`self`, `ally`, `foe`, `area`, `held-item`) rather than concrete ids;
- carries engine-owned packaging fields settled under D3/D5;
- declares action shape and cost-shape refs;
- declares the ability authorizer and its own opposition-affirmation carrier;
- contains no model-chosen number; and
- passes Chapter 2 §1/§1.1 validation when bound and executed.

The destination expression normally reuses the same template refs when the destination campaign
pins a compatible catalog version. “Fireball” and a legal cyberpunk expression are mechanically
the same only when they really share template semantics and environmental permissions. A
cross-version mapping requires an engine-owned, reviewed catalog migration/equivalence rule;
the model never declares two versions equivalent.

### 6.2 Mechanical fingerprint

The engine derives a normalized fingerprint from:

```text
source/destination chassis version
+ source/destination catalog version
+ sorted normalized effect-template refs
+ action shape
+ cost/recovery shape
+ reliability band
+ dependency and agency structure
+ authorizer class
+ scale
```

Display name, prose, visuals, occupation, implement noun, and source metaphor do not enter the
fingerprint.

An automatic same-version candidate must preserve the fingerprint exactly. A candidate crossing
chassis/catalog versions must pass an approved, versioned equivalence rule before the ordinary
comparison. It may differ only in fields that rule explicitly maps. All other differences become
player-visible rebuild choices.

### 6.3 No dishonest environmental equivalence

Identical effect refs are insufficient when destination access changes:

- a netrunner program that requires a network does not equal a spell usable in an empty field;
- a pilot without a meaningful platform does not retain the Pilot loop;
- a Patron without institutions or callable resources does not retain Patron access;
- a Handler whose sentient companion became disposable hardware does not retain agency or
  relationship semantics.

The compatibility evaluator records required environmental permissions for each affordance. A
missing permission returns `needs_choice` or `incompatible`, never a narrower silent ability.

## 7. Internal functional-family vocabulary

The 22 families are **engine/reviewer vocabulary only**. Translate derives them from the source
profile's already-approved kernel. It never asks the player to pick one family plus two secondaries.
How new characters acquire a kernel is a separate owner decision (§10).

| Id | Family | Defining player decision loop | Must not collapse into |
|---:|---|---|---|
| 1 | Defender | Choose whom or what to protect; trade position/exposure to intercept or deny danger | Bruiser's personal force/durability |
| 2 | Bruiser | Commit at close range; trade safety or finesse for force and staying power | Defender's ally protection |
| 3 | Duelist | Manage movement, timing, counters, and one priority opponent | Marksman's ranged target control |
| 4 | Marksman | Select priority targets and firing windows while managing range and ammunition/access | Generic damage dealer |
| 5 | Artillery | Spend scarce setup or resources for area pressure, destruction, or suppression | Controller's option/field manipulation without destructive payoff |
| 6 | Controller | Alter available choices, terrain, access, status, or an underlying system through setup | Artillery's area damage |
| 7 | Infiltrator | Cross a guarded boundary, remain undetected, exploit access, and escape | Scout's advance information or Saboteur's delayed infrastructure change |
| 8 | Saboteur | Prepare, conceal, and trigger delayed disruption against a system or place | Infiltrator's immediate access |
| 9 | Scout | Learn routes, threats, positions, and opportunities before commitment | Investigator's reconstruction of hidden current/past truth |
| 10 | Investigator | Gather and connect evidence to reveal a hidden fact, cause, or actor | Scholar's application of established domain knowledge |
| 11 | Face | Choose a targeted social approach, leverage, and concession with a person or small group | Inspirer's group morale/attention |
| 12 | Commander | Allocate present allies, timing, formation, and immediate team tempo | Patron's off-scene resources/status |
| 13 | Healer | Triage prevention, stabilization, recovery, and scarce care | Generic buff/support |
| 14 | Inspirer | Shape group morale, attention, emotion, or public feeling through expression | Face's targeted negotiation |
| 15 | Maker | Prepare, build, repair, or modify concrete capabilities and tools | Scholar's advice without creation |
| 16 | Scholar | Apply established expertise to interpret, predict, or advise within a domain | Investigator's evidence-driven revelation |
| 17 | Handler | Direct a distinct companion/agent and share action economy, risk, and positioning | A cosmetic pet or disposable tool |
| 18 | Transformer | Choose between mechanically distinct body, identity, stance, or loadout modes | A single passive bonus |
| 19 | Pilot | Control a meaningful mount/vehicle/platform whose position and risk drive decisions | Ordinary travel proficiency |
| 20 | Survivor | Allocate supplies, adapt to hazards, and continue under scarcity or isolation | Scout's information role |
| 21 | Patron | Call on wealth, status, institutions, or networks while incurring access limits or obligations | Commander's present-team control |
| 22 | Generalist | Cover an unfilled ordinary need at a lower ceiling than a specialist | A best-of-everything build |

`Generalist` is a **package-only/provisional family** in v2. It may not be used to justify an open
pick-anything build. Pilot, Patron, and Handler carry explicit environment-compatibility
requirements.

## 8. Destination genre families

| Code | Genre family | Default expression assumptions |
|---|---|---|
| F | High fantasy / mythic | Open supernatural power, preindustrial tools, monsters, heroic professions |
| H | Grounded historical / low fantasy | Human-scale expertise, period tools, supernatural power absent or rare |
| G | Gothic / occult horror | Forbidden/costly supernatural power, secrecy, investigation, vulnerability |
| W | Western / frontier | Firearms, travel, law/outlaw status, sparse institutions, survival |
| M | Contemporary / crime / espionage | Modern tools, institutions, firearms, surveillance, covert access |
| P | Pulp / superhero / weird science | Exceptional individuals, gadgets or powers, heightened action |
| C | Cyberpunk / tech-noir | Networks, cyberware, corporations, surveillance, high technology/low trust |
| S | Space opera / science fiction | Space travel, energy weapons, alien science, campaign-permitted psionics |
| A | Post-apocalypse / survival | Scarcity, salvage, mutation/relic technology, unstable communities |
| X | Surreal / cosmic / dreamlike | Symbolic causality, impossible spaces, reality alteration, unstable identity |

Genre families generate candidate expression. They never override a kernel, and they are not a
closed list of campaigns. Hybrid campaigns choose one primary family for capability assumptions and
apply modifiers for vocabulary/tone.

## 9. Candidate expression matrix

Cells are display/expression candidates. The family id and mechanical fingerprint remain the
portable parts.

### 9.1 Fantasy through contemporary

| Family | F — High fantasy | H — Historical / grounded | G — Gothic / occult | W — Western / frontier | M — Contemporary / crime |
|---|---|---|---|---|---|
| Defender | Knight / guardian | Shield-bearer / man-at-arms | Monster warden | Lawkeeper / bodyguard | Bodyguard / tactical shield |
| Bruiser | Barbarian / brawler | Berserker / pit fighter | Cursed brute | Saloon bruiser / enforcer | Enforcer / breacher |
| Duelist | Swashbuckler / blade dancer | Fencer / weapon master | Vampire hunter | Quick-draw duelist / knife fighter | Close-quarters specialist |
| Marksman | Archer / ranger | Archer / musketeer | Monster hunter | Gunslinger / sharpshooter | Sniper / tactical marksman |
| Artillery | Battlemage / alchemist | Siege engineer | Ritual demolisher / ward-breaker | Dynamiter / heavy gunner | Heavy-weapons / demolition specialist |
| Controller | Wizard / sorcerer | Strategist / alchemist | Occultist / ritualist | Mesmerist / gadgeteer | Hacker / operations controller |
| Infiltrator | Thief / shadow | Spy / cutpurse | Occult burglar / grave robber | Outlaw / cat burglar | Covert operative / burglar |
| Saboteur | Trapper / alchemical saboteur | Sapper | Curse layer / relic saboteur | Rail dynamiter / trapper | Bomb technician / infrastructure saboteur |
| Scout | Ranger / pathfinder | Outrider / explorer | Monster tracker | Trail scout / bounty tracker | Recon / surveillance operative |
| Investigator | Inquisitive / sage | Magistrate / examiner | Occult detective | Marshal / bounty investigator | Detective / intelligence analyst |
| Face | Bard / courtier | Envoy / merchant | Medium / society charmer | Cardsharp / preacher | Negotiator / fixer |
| Commander | Warlord / captain | Officer / standard bearer | Secret-order leader | Posse leader | Handler / team lead |
| Healer | Cleric / herbalist | Physician / surgeon | Occult surgeon / exorcist-healer | Frontier doctor | Medic / therapist |
| Inspirer | Bard / skald | Orator / chronicler | Spiritualist / storyteller | Saloon performer / preacher | Journalist / performer / celebrity |
| Maker | Artificer / smith | Artisan / engineer | Relic maker / alchemist | Gunsmith / mechanic | Engineer / forensic technician |
| Scholar | Sage / oracle | Scholar / natural philosopher | Archivist / seer | Naturalist / chronicler | Researcher / profiler |
| Handler | Summoner / beastmaster | Houndmaster / falconer | Spirit medium | Rancher / animal handler | K9, informant, or drone handler |
| Transformer | Druid / shapeshifter | Disguise master / adaptive fighter | Werebeast / body occultist | Disguise artist / skinwalker | Undercover mimic / experimental subject |
| Pilot | Cavalier / ship captain | Rider / navigator | Occult conveyance master | Rider / stagecoach ace | Driver / aviator |
| Survivor | Adventurer / wilderness guide | Mercenary / guide | Grave survivor | Homesteader / prospector | Survivalist / first responder |
| Patron | Noble / guildmaster | Aristocrat / merchant prince | Cabal patron | Rancher / rail baron | Executive / crime boss |
| Generalist | Adventurer | Mercenary / traveler | Monster hunter | Drifter | Field agent |

### 9.2 Pulp through surreal

| Family | P — Pulp / superhero | C — Cyberpunk | S — Space opera / SF | A — Post-apocalypse | X — Surreal / cosmic |
|---|---|---|---|---|---|
| Defender | Armored hero / protector | Street samurai / corporate tank | Space marine / guardian | Wasteland enforcer | Reality anchor |
| Bruiser | Powerhouse | Chrome rager / gang heavy | Heavyworld brawler | Mutant berserker | Nightmare brute |
| Duelist | Masked swashbuckler | Monoblade runner | Energy-blade ace | Arena raider | Fate duelist |
| Marksman | Trick-shot hero | Smartgun ace | Blaster sharpshooter | Wasteland hunter | Impossible-angle shooter |
| Artillery | Energy projector / demolitions hero | Heavy-weapons cyborg | Weapons specialist / ship gunner | Scrap-cannon expert | Storm caller |
| Controller | Psychic / super-scientist | Netrunner | Psion / systems adept | Shaman / relic hacker | Dreamwalker |
| Infiltrator | Masked thief / spy | Ghost / intrusion specialist | Smuggler / infiltration operative | Scavenger / raider scout | Identity thief |
| Saboteur | Gadget saboteur | Intrusion / demolition specialist | Slicer / systems engineer | Trapmaker | Causality breaker |
| Scout | Aerial scout / explorer | Drone recon / urban tracker | Pathfinder / sensor specialist | Wasteland scout | Liminal guide |
| Investigator | Masked detective | Data investigator | Science officer / xeno-investigator | Relic seeker | Truth diver |
| Face | Celebrity / envoy | Fixer | Diplomat / first-contact envoy | Trader / settlement envoy | Herald |
| Commander | Team captain | Tactical coordinator | Squadron commander | Settlement chief | Chorus conductor |
| Healer | Regenerative hero / field doctor | Ripperdoc / medtech | Xenomedic | Field medic | Soul mender |
| Inspirer | Icon / broadcaster | Media influencer | Holo-star / cultural envoy | Tribe storyteller | Muse |
| Maker | Gadgeteer | Cybertech | Ship engineer | Scrap mechanic | Worldsmith |
| Scholar | Super-scientist | Data savant | Xenoarchaeologist | Lorekeeper | Oracle |
| Handler | Sidekick / beast commander | Drone-swarm operator | Droid / xenobeast handler | Mutant-beast tamer | Echo caller |
| Transformer | Shapeshifter | Body-mod specialist | Alien morph | Mutant | Dreamshaper |
| Pilot | Ace pilot | Rig jockey | Star pilot | Road warrior | Realm navigator |
| Survivor | Pulp explorer | Street survivor | Colonist | Scavenger | Castaway |
| Patron | Billionaire / sponsor | Corporate executive | Admiral / syndicate patron | Warlord | Fate broker |
| Generalist | Pulp adventurer | Operator | Spacer | Wanderer | Dimensional traveler |

## 10. Composition boundary

### 10.1 Translate does not expose family selection

Translate reads the source profile's approved kernel. It does not ask the player to select a new
primary or secondaries. If a candidate changes the family composition, it is a rebuild and requires
an explicit future rebuild flow outside Translate.

This removes the reviewer's “22-pick multiclass soup” risk from the translation path.

### 10.2 New-character creation remains open

The matrix does not settle how a new character first acquires a kernel. Two viable product shapes
remain:

| Shape | Player experience | Strength | Risk |
|---|---|---|---|
| **Concept packages** | Choose a familiar, genre-appropriate concept, then customize bounded options | Predictable balance and clear capabilities | Can recreate the pre-canned-list mismatch or exclude the player's vision |
| **Capability composition** | Explicitly author/select desired affordances within an engine-owned budget | Higher fidelity to a specific vision | More UI, balance, and comprehension burden |

Neither shape exposes the raw 22-family taxonomy. Families are derived engine metadata used for
validation and translation.

D3-B must choose the creation contract separately. Silence does not select packages merely because
the independent reviewer recommended them.

### 10.3 Composition storage rule

V2 permits one primary and up to two secondary family tags **in storage** because this describes
hybrid characters such as:

| Familiar concept | Primary | Typical secondary/source |
|---|---|---|
| Gunslinger | Marksman | Duelist |
| Rogue | Infiltrator | Duelist, Face, Investigator, or Saboteur |
| Wizard | Controller | Scholar or Artillery; prepared-system source |
| Paladin | Defender | Commander or Healer; oath source |
| Ranger | Marksman | Scout, Survivor, or Handler |
| Bard | Face | Inspirer, Scholar, or Controller |
| Druid | Controller | Transformer, Scout, or Handler; nature source |
| Netrunner | Controller | Infiltrator or Scholar |
| Summoner | Handler | Controller |
| Engineer | Maker | Scholar or Saboteur |

The count is descriptive metadata, not permission to receive three full-strength class budgets.
Final budget semantics remain D5.

## 11. Power-source and implement translation

A family says what decisions the character contributes. Source and implement say why and how the
fiction permits them.

### 11.1 Power-source matrix

| Source pattern | Fantasy / occult | Grounded / frontier | Contemporary | Cyberpunk / space | Post-apocalyptic / surreal |
|---|---|---|---|---|---|
| Training/technique | Order, school, weapon discipline | Trade, military, apprenticeship | Professional training | Sim, doctrine, specialist training | Hard-won practice / remembered form |
| Precision projectile | Bow, crossbow, wand | Bow, musket, revolver, rifle | Firearm / launcher | Smartgun, rail weapon, blaster | Scrap weapon, bio-projectile, impossible ray |
| Prepared-system manipulation | Spellbook, runes, ritual formulae | Strategy, alchemy, engineering tables | Software, plans, operational access | Cyberdeck, expert system, psionic discipline | Relic interface, rite, dream grammar |
| Faith/oath/devotion | Divine covenant, sacred order | Vow, community office, moral authority | Chaplaincy, cause, institution | AI covenant, ideology, interstellar order | Cult, ancestral duty, cosmic compact |
| Psychic/exceptional perception | Divination, second sight | Intuition, observation, mesmerism | Profiling, surveillance expertise | Neural sense, psionics, sensor fusion | Mutation, visions, reality sensitivity |
| Nature/ecology | Druidic bond, spirits, beasts | Fieldcraft, herbalism, husbandry | Ecology, wilderness training | Biohacking, xenobiology, habitat systems | Mutation ecology, wasteland lore |
| Craft/technology | Smithing, artificing, alchemy | Engineering, gunsmithing, mechanics | Electronics, medicine, fabrication | Cybertech, robotics, ship systems | Salvage craft, relic repair, world-shaping |
| Body alteration | Shapeshifting, blessing, curse | Disguise, conditioning, adaptive equipment | Experimental treatment | Cyberware, geneware, alien biology | Mutation, possession, dream-form |
| Status/authority | Crown, guild, temple, lineage | Rank, land, trade house | Office, wealth, law, organization | Corporation, syndicate, fleet, network | Settlement control, cult, fate claim |
| Companion/delegated agent | Familiar, summon, beast | Retainer, hound, mount | Informant, K9, team asset, drone | Drone, droid, AI, xenobeast | Mutant beast, spirit, echo |
| Luck/fate/preparation | Blessing, prophecy, charm | Reputation, foresight, contingency | Planning, contacts, trained reflex | Predictive model, probability hack, precognition | Mutation luck, omen, causality bend |
| Performance/attention | Song, tale, glamour | Oratory, reputation, spectacle | Media, celebrity, persuasion | Influence feed, memetic craft, holo-performance | Tribal story, psychic resonance, living symbol |

### 11.2 Tool-equivalence matrix

Tool translation preserves permission, dependency, scarcity, and action shape—not the noun or resale
value.

| Function | Fantasy | Historical / frontier | Contemporary | Cyberpunk / space | Post-apocalyptic / surreal |
|---|---|---|---|---|---|
| Concealable ranged sidearm | Hand crossbow, wand, throwing knives | Pistol, compact bow | Handgun | Smart pistol, holdout blaster | Scrap pistol, thorn caster |
| Long-range precision weapon | Longbow, spell focus | Rifle, musket, longbow | Precision rifle | Rail rifle, beam rifle | Salvage rifle, bone bow |
| Fast close weapon | Short blade, staff | Saber, knife, club | Knife, baton | Monoblade, shock baton | Machete, living blade |
| Heavy area implement | Alchemical charges, siege focus | Dynamite, cannon | Explosives, heavy launcher | Plasma projector, missile system | Scrap cannon, unstable relic |
| Protection | Mail, plate, ward | Armor, reinforced coat | Ballistic protection | Smart armor, exosuit, shield field | Patchwork armor, mutation shell |
| Access/bypass kit | Thieves' tools, runekey | Picks, forged papers | Credentials, intrusion tools | Cyberdeck, security spike | Salvaged bypass kit, symbolic key |
| Prepared-system focus | Grimoire, runes, components | Formula book, maps, instruments | Laptop, case files, plans | Cyberdeck, neural archive, expert system | Relic codex, memory shrine |
| Healing supply | Herbs, potion, holy kit | Doctor's bag, tonic | Trauma kit, medicine | Medkit, nanites, autodoc | Salvaged medicine, symbiote |
| Companion | Familiar, beast, retainer | Hound, horse, hireling | Informant, K9, drone | AI, droid, drone, xenobeast | Mutant beast, spirit, echo |
| Personal transport | Mount, wagon, enchanted conveyance | Horse, coach, boat | Car, motorcycle, aircraft | Rig, grav-bike, shuttle, starship | Scrap vehicle, giant beast, portal |
| Communication | Messenger, sending token | Courier, signal lamp, telegraph | Phone, radio | Encrypted mesh, comm implant | Shortwave, psychic link |
| Surveillance | Familiar, scrying, scout | Spyglass, lookout, informant | Cameras, wiretap, drone | Sensor web, intrusion daemon | Scout beast, omen, relic sensor |
| Social leverage | Title, guild seal, favor | Rank, land, reputation | Office, money, credentials | Corporate access, reputation score | Settlement debt, cult standing |
| Restraint/control | Net, binding rune | Lasso, manacles | Restraints, chemical agent | Shock web, control program | Snare, mutation, dream binding |

Signature-item provenance is never reduced to a tool function without player approval. D13/D16 own
the final rule for translating item condition, wealth, provenance, and campaign history.

## 12. Resource and risk equivalence

| Cost shape | Candidate expressions | Invariant |
|---|---|---|
| Depleting personal pool | Mana, focus, stamina, bandwidth, charge | Same relative uses before recovery |
| Ammunition/consumable | Arrows, bullets, components, charges, doses | Same scarcity and reload/resupply pressure |
| Heat/exposure | Suspicion, trace, corruption, instability, notoriety | Same escalation and consequence cadence |
| Preparation slots | Prepared spells, planned tricks, loaded programs, modules | Same number/timing of loadout choices |
| Cooldown | Recharge, recovery, reboot, ritual reset | Same action/scene/world-time delay |
| Once per scene/session | Heroic effort, ace maneuver, emergency protocol | Same refresh boundary |
| Favor/debt | Divine favor, contacts, corporate credit, faction obligation | Same external dependency and repayment pressure |
| Health/body cost | Blood magic, overexertion, neural burn, mutation strain | Same severity and recovery burden |
| Companion risk | Familiar harm, retainer exposure, drone damage | Same benefit, action economy, and meaningful risk |
| Environment dependency | Moonlight, workshop, network, zero gravity | Same frequency and predictability of availability |

Renaming a resource is expression. Changing how often the character can use the ability is a
mechanical rebuild.

## 13. Translation-state machine

```text
source profile
  -> approved kernel present?
       no  -> kernel-onboarding proposal -> player review -> approved kernel
       yes -> continue
  -> destination campaign draft establishes genre vocabulary + pinned versions
  -> engine freezes source/kernel hashes
  -> expression model proposes names/tools/source mappings inside legal shapes
  -> engine validates fingerprints + environmental permissions
       invalid       -> reject candidate and regenerate within one bounded retry
       needs_choice  -> translation card with explicit alternatives
       incompatible  -> exception / rebuild / cancel
       ready         -> translation card
  -> player approves exact candidate hash
  -> engine rechecks source/draft/hash freshness
  -> atomic translated-profile + campaign-member commit
  -> opening scene generation
```

### 13.1 Candidate outcomes

| Status | Meaning | Allowed next action |
|---|---|---|
| `ready` | All fingerprints and permissions preserved; only expression changed | Approve, revise an anchor, or cancel |
| `needs_choice` | One or more source/identity/environment mappings are ambiguous | Choose an offered legal alternative or cancel |
| `incompatible` | No candidate preserves the kernel under current destination assumptions | Allow a setting exception, enter an explicit rebuild flow, or cancel |
| `invalid` | Candidate violates schema, D2 membership, budget, or invariants | Internal bounded retry; never show as playable |
| `stale` | Source profile, destination draft, or candidate hash changed | Recompute and review again |
| `committed` | Approved candidate was persisted exactly once | Load campaign |

### 13.2 No-honest-equivalent rule

The only player-facing paths are:

1. **Setting exception**: retain the anchored source literally.
2. **Functional adaptation**: use a disclosed alternative that preserves the fingerprint or an
   explicit approved equivalence.
3. **Rebuild**: enter a separate, future player-controlled mechanical rebuild.
4. **Cancel**: keep the source unchanged and do not create the destination incarnation.

The engine never selects one by silence or starts play with a narrowed ability.

## 14. Translation-card contract

The player sees:

```json
{
  "status": "ready | needs_choice | incompatible",
  "sourceProfileId": "engine id",
  "sourceKernelHash": "engine hash",
  "destinationDraftId": "engine id",
  "candidateHash": "engine hash",
  "rolesPreserved": ["plain-language role statements"],
  "affordancesPreserved": ["plain-language can-do statements"],
  "mappings": [
    {
      "source": "Quick Draw with inherited revolver",
      "destination": "Fast Nock with recurved bow",
      "mechanics": "unchanged",
      "anchorImpact": "signature item requires choice"
    }
  ],
  "costsAndLimits": ["plain-language unchanged cadence"],
  "choices": ["engine-keyed alternatives"],
  "blockedReasons": []
}
```

The browser renders engine data; it does not infer or hide mappings. Available actions are
**Approve exact candidate**, **Choose an offered alternative**, **Revise an anchor**, or **Cancel**.
Every approval includes the candidate hash and an idempotency key.

## 15. Persistence and API plan

Names are proposed implementation targets. An approved phase may rename them while preserving the
contract.

### 15.1 Profile fields

Add nullable, validated fields to `player_characters`:

- `kernel_version`;
- `kernel_json`;
- `translated_from_character_id` (lineage; source never mutated);
- `translation_json` (approved source/destination mappings, hashes, versions, and anchor choices).

Keep `copied_from_character_id` for exact Branch lineage. Do not overload it with Translate.

Campaign-local `characters` rows snapshot the approved translated profile exactly as existing
campaign members do today.

### 15.2 Restart-safe campaign-creation drafts

Translate needs the destination setting vocabulary before final character expression, but play
must not begin before player approval. Introduce a persistent `campaign_creation_drafts` record:

- id and status;
- requested genre and table settings;
- source profile id and source/kernel hashes;
- generated outline, ruleset, visual style, and pinned versions;
- translation candidate/card and candidate hash;
- player choices;
- created/updated timestamps; and
- idempotency/commit result.

Normal `new`, `existing`, and `copy` creation may retain their current synchronous route until a
separate plan chooses to unify them. Only Translate requires the draft flow.

### 15.3 Proposed host endpoints

- `POST /api/campaign-drafts` — create/reuse an idempotent Translate draft.
- `GET /api/campaign-drafts/:id` — return current draft/card status.
- `POST /api/campaign-drafts/:id/choices` — apply only offered, engine-keyed choices and recompute.
- `POST /api/campaign-drafts/:id/approve` — candidate hash + idempotency key; revalidate and commit.
- `POST /api/campaign-drafts/:id/cancel` — cancel without changing source profile.

All remain host-authorized. A translated campaign can later mint ordinary character seats.

### 15.4 Commit ordering

1. Generate and validate outline/ruleset/expression outside a DB write transaction.
2. Persist the draft and hashes.
3. On approval, re-read draft and source; reject stale/consumed state.
4. Generate any remaining opening-scene material against the approved candidate.
5. In one write transaction:
   - create translated profile and lineage;
   - create campaign, outline, ruleset, party member, locations/NPCs/turn state;
   - mark draft committed with result ids.
6. Identical approval retry returns the committed result.

No source checkout or mutation occurs because Translate creates a new branch.

## 16. Legacy, bundle, and seat boundaries

### 16.1 Profiles without kernels

Existing profiles remain legal for Continue and Branch.

Translate on a profile with no approved kernel enters **kernel onboarding**:

1. model may propose family tags, affordances, source patterns, and candidate anchors from the
   existing archetype/abilities/inventory;
2. engine validates structure but cannot claim the proposal matches player intent;
3. player reviews and approves/corrects the kernel before destination translation;
4. approved kernel is versioned and stored; and
5. no automatic legacy inference becomes canonical.

Kernel onboarding and genre translation may appear in one guided UI, but they remain two separately
approved records.

### 16.2 Export/import

An approved D13 plan must decide the bundle version transition. Required behavior:

- old bundle fixtures with no kernel still import;
- new bundles preserve kernel, anchors, translation lineage, and approved mapping;
- unknown enum/schema versions fail closed or enter explicit migration;
- import never executes profile text as instructions;
- translated profile ids and lineage remap safely;
- source absence does not invalidate a self-contained translated profile; and
- Continue/Branch behavior remains backward compatible.

### 16.3 Seat isolation

Kernel and translation records may contain private character details. Seat-scoped state returns only
the seat character's player-visible kernel summary and approved expression, never another
character's anchors, draft alternatives, or internal validation fingerprints. Host views may show
the complete translation record.

## 17. Automatic, ask, reject rules

| Proposed change | Candidate generation | Player action | Engine result |
|---|---|---|---|
| Rename class/occupation/display ability | Allowed | Final card approval | Valid if fingerprint unchanged |
| Replace ordinary tool with equivalent dependency | Allowed | Final card approval | Valid if scarcity/action shape unchanged |
| Change visuals/damage description only | Allowed | Final card approval | Valid if D2 effects unchanged |
| Rename resource | Allowed | Final card approval | Valid if cost/recovery shape unchanged |
| Change unanchored power source | Allowed as alternative | Explicitly shown/approved | Valid only with environmental permission |
| Change anchored source/item/companion | No automatic choice | Choose exception/adaptation/cancel | `needs_choice` |
| Change family, reach, target shape, tempo, cost, reliability, agency, weakness, or scale | Not Translate | Enter rebuild or cancel | `incompatible` for Translate |
| Add genre-common capability | Forbidden | Separate purchase/rebuild | `invalid` |
| Remove capability lacking an easy genre noun | Forbidden | Exception/adaptation/rebuild/cancel | `needs_choice` or `incompatible` |
| Translate biography, allegiance, relationship, injury, or provenance | Deferred | D13/D16 ruling | Not claimed by v2 |

## 18. Worked guard cases

### 18.1 Gunslinger → fantasy archer

`Marksman + Duelist`; revolver → bow/hand crossbow, Quick Draw → Fast Nock, Fan the Hammer → Rapid
Volley, bullets/reload → arrows/readying. Precision, projected single-target shape, tempo,
ammunition pressure, and close-engagement weakness remain. An anchored inherited revolver forces a
choice between literal setting exception and disclosed adaptation.

### 18.2 Wizard → cyberpunk netrunner

`Controller + Scholar`; spellbook → cyberdeck/code library, prepared spells → loaded programs,
mana → bandwidth/neural strain, Counterspell → counter-intrusion, divination → surveillance/data
query. An unnetworked physical Fireball is not equivalent: provide a physical-output dependency,
narrow it with disclosure, keep literal magic, rebuild, or cancel.

### 18.3 Rogue → cyberpunk infiltrator

`Infiltrator` plus the source secondary; lockpicks → security kit/deck, disguise kit → identity
forge, thieves' contacts → fixer network. Stealth, guarded access, opportunism, escape, and
dependency structure remain.

### 18.4 Pilot → vehicle-poor noir

If the source loop depends on meaningful vehicle positioning and risk, “driver” as flavor is
insufficient. Offer a campaign-supported vehicle role, setting exception, rebuild, or cancel.

### 18.5 Handler with sentient familiar → drone setting

Replacing a person with equipment fails agency/relationship invariants. Offer literal companion,
a destination person/AI with player-approved continuity, rebuild, or cancel.

### 18.6 Commander versus Patron

A battlefield captain translates as Commander only when present allies and immediate tempo remain.
An executive who calls off-scene assets is Patron. Similar authority nouns do not make their
decision loops equivalent.

### 18.7 Scholar versus Investigator

A scholar applies established expertise; an investigator discovers hidden current/past truth by
assembling evidence. “Researcher” expression must preserve which loop the source character owns.

## 19. Implementation slices after approval

Each slice is one scoped commit with the repository's required verification. No slice begins before
its named dependencies and a concrete phase are owner-approved.

### T0 — Decision and rules closure

- Record D3-A architecture.
- Record D3-B new-character composition separately.
- Settle D5 packaging fields consumed by fingerprints.
- Settle minimum D13/D16 state boundary needed to avoid false “full portability.”
- Promote the approved contract into canonical rules guidance.

**Exit**: no unresolved field semantics required by T1.

### T1 — Pure kernel/equivalence contracts

- Add schemas/enums/validators and normalized hashing in `rpg-state.js` or a focused rules module.
- Add pure fixture tests for kernel validity, fingerprints, anchors, environment permissions, and
  candidate outcomes.
- No route, DB, prompt, or UI behavior.

**Exit**: pure tests prove invalid candidates fail and legal reskins preserve fingerprints.

### T2 — Persistence and bundle compatibility

- Add nullable profile kernel/translation fields and lineage in `db.js`.
- Extend export/import validators and the pinned legacy fixture.
- Keep old profiles and Continue/Branch behavior unchanged.
- Add seat-scoping tests for new fields.

**Exit**: new state round-trips; old bundles import; private fields do not cross seats.

### T3 — Restart-safe campaign drafts

- Add `campaign_creation_drafts`.
- Add host endpoints, status transitions, hashes, idempotency, stale detection, cancel, and atomic
  commit.
- Keep the existing creation route unchanged for non-Translate modes.

**Exit**: API tests cover ready/choice/incompatible/stale/retry/cancel and source immutability.

### T4 — Expression candidate generation

- Supply the model only validated kernel shapes, destination vocabulary, and legal candidate ids.
- Reject off-schema fields, invented effects, quantities, costs, and permissions.
- Bind destination display abilities to unchanged templates/fingerprints.
- Use a bounded retry; after failure return an honest non-playable status.

**Exit**: adversarial fixtures cannot create mechanics through prose.

### T5 — Player translation UI

- Add explicit Translate mode.
- Render preserved roles, every old→new mapping, costs/limits, anchor impacts, and blockers.
- Require hash-bound approval; no default selection on ambiguous choices.
- Preserve cancellation and retry across reload.

**Exit**: manual/browser flow cannot start play before exact candidate approval.

### T6 — Kernel onboarding for legacy profiles

- Propose, validate, and separately approve a kernel for profiles lacking one.
- Never persist model inference without player confirmation.
- Preserve Continue/Branch paths for users who do not translate.

**Exit**: a legacy profile can translate only after its source kernel is approved.

### T7 — Documentation and playtest

- Update README/user flow only after behavior ships.
- Run cross-genre translation playtests using the guard cases in §18.
- Record whether players recognize the result as the same functional character.
- Do not claim full portability while deferred state remains unsupported.

## 20. Verification plan

### 20.1 Automated

Run the repo entry point after every code slice:

```text
node test.js
```

Required new coverage:

- all kernel enum/cardinality/ownership validation;
- deterministic fingerprint ordering and hash stability;
- D2 template membership and no model-number fields;
- exact preservation of reach/target/delivery/tempo/cost/reliability/dependency/agency;
- anchor behavior and explicit alternatives;
- environment-contingent Pilot/Patron/Handler cases;
- Generalist restrictions;
- legacy missing-kernel behavior;
- Continue/Branch regressions;
- draft state transitions, idempotent approval, stale hashes, cancellation, and restart recovery;
- source profile immutability;
- bundle old/new round trips and id remapping;
- seat isolation;
- player card contains every mechanical/source/tool change; and
- campaign opening cannot precede approval.

Every new behavior test receives the AGENTS.md guard proof: temporarily revert the behavior, prove
the test fails, restore it, and prove the suite passes.

### 20.2 Manual

At minimum:

1. western gunslinger → high-fantasy archer;
2. high-fantasy wizard → cyberpunk netrunner with the Fireball incompatibility visible;
3. rogue → three destination genres;
4. Pilot → vehicle-poor destination produces a choice, not a generic fallback;
5. sentient companion → technological destination requires an anchor choice;
6. cancel/reload/resume/retry;
7. Translate from an active source branch leaves the source untouched;
8. host/seat views expose only appropriate translated state; and
9. one late joiner translates without changing established vocabulary for existing characters.

The owner playtest bar is recognition and predictability: before the first turn, the player can
state what the translated character can do, what changed, what it costs, and what remains
impossible.

## 21. Owner gates

These rulings are taken in chat one at a time and recorded durably. This plan infers none of them.

1. **D3-A — Core portability architecture**: functional kernel + destination expression;
   Continue/Branch/Translate distinct; Translate creates a branch; mandatory player approval.
2. **D3-B — New-character composition**: concept packages versus capability composition; raw
   family tags remain internal under either choice.
3. **D3-C — Family/kernel boundary**: approve/refine the 22 families, Generalist restriction, and
   one-primary/up-to-two-secondary storage limit.
4. **D5 — Ability packaging**: cost, cooldown, targeting, authorizer, and template fields required
   by the fingerprint.
5. **D13/D16 — Portable non-ability state**: inventory, signature items, condition, wealth,
   relationships, history, and provenance.
6. **Phase approval**: select implementation slices and risk/verification scope.

The first decision is D3-A. Everything after architecture remains blocked until that ruling lands.
