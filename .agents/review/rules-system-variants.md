# Three closed rules-system variants

**Status:** frozen design evidence; none is approved or implemented. The 2026-08-02 intrusion
decision removes Intruder as an archetype, so the Intruder rows below are superseded and no package
can be adopted as written. They are retained to show the compared packages. The later text-entry
interaction audit also rejects Slots and rests and Cadence as next candidates, permits only a
simplified Commitment shape to continue, and recommends no regeneration from this frozen roster.

**Date:** 2026-08-02

**Scope:** exactly three complete rules packages built around the signed Aetheria d100 resolution and effect-operation contracts. A package is selected as a whole. The document is not a menu for combining one package's recovery, another package's class resources, and a third package's advancement.

> **Later interaction finding:** `.agents/review/interaction-burden-audit.md` adds the player-facing
> burden criterion this comparison lacked. Its recommendations are not an owner rules ruling, but
> they supersede this document's pre-review ranking as the next-work direction.

The purpose of this comparison is to replace the Gate 5 prototype's unexplained pool, rest, spell-rank, progression, class, and opposition placeholders with operational rules derived from established open systems. It does not authorize product code.

## 1. Shared foundation

Everything in this section is part of all three variants. A variant changes the class-ability economy, recovery cadence, and advancement expression described in its own section; it does not replace this foundation.

### 1.1 Signed rules that do not reopen

- `docs/rules/resolution.md` remains the canonical check contract: roll high on d100; raw 100 always succeeds; raw 1 always fails; the middle is binary; edge bands may carry only validated catalog effects; the engine owns rolls, targets, arithmetic, state changes, and the complete public ledger.
- The Referee selects only engine-known difficulty and situational-delta identifiers and supplies reasons grounded in canon. Models never emit a target number, modifier, roll, damage number, resource quantity, or invented operation.
- `docs/rules/effects.md` remains the canonical effect-operation vocabulary. Class abilities are versioned packages of known operations, not prose which the model interprets as mechanics.
- One acting entity makes a check. There are no opposed-roll exchanges and no reaction roll which waits for another player.
- A campaign pins one chassis ID, chassis version, effect-catalog version, class-catalog version, and genre-catalog ID. It never silently adopts later balance changes.

### 1.2 Attributes, skills, and the d100 bonus

The four attributes are **Might, Agility, Intellect, and Will**, rated 0–3. At creation the player assigns the array `3, 2, 1, 0`; no point-buy arithmetic is required. At levels 4, 7, and 10, one attribute below 3 increases by one.

Skills are rated 0–4. Rank 0 is untrained, rank 1 trained, rank 2 professional, rank 3 master, and rank 4 legendary. Every skill has one fixed linked attribute:

| Attribute | Skills |
|---|---|
| Might | Athletics, Endure, Melee |
| Agility | Acrobatics, Finesse, Pilot, Ranged, Stealth |
| Intellect | Craft, Investigate, Lore, Medicine, Systems |
| Will | Focus, Influence, Insight, Leadership, Survival |

For every check, the engine derives:

```text
SkillBonus = 5 × linked attribute + 15 × skill rank
```

The result is 0–75, exactly the range assumed by the signed resolution chapter. Context never changes the linked attribute. If a task genuinely uses a different learned capability, it uses a different skill. Character competence therefore cannot be improvised from prose.

Rank caps track the opposition curve: rank 1 at levels 1–2, rank 2 at levels 3–4, rank 3 at levels 5–7, and rank 4 at levels 8–10. A character gains two skill points at each new level. Buying rank 1, 2, 3, or 4 costs that many points; saved points are allowed.

Class entitlement and skill competence are separate. Buying Lore does not grant spells, buying Leadership does not grant followers, and buying Melee does not grant martial-weapon proficiency or Armsmaster techniques.

### 1.3 Character creation: seven short, deterministic choices

Expected first-character time is **7–10 minutes** after the campaign exists. Returning players using a saved build need only confirm the destination genre-class package and equipment.

1. **Choose one mechanical archetype** from the nine in §2.1. The UI shows its repeated play loop, strengths, weakness, health band, and exclusive permissions.
2. **Choose one genre class** from that archetype's cell in the campaign's selected genre column (§2.2). The two names in a cell are real fixed packages: the left and right branch shown in §2.1, with their own starting feature, proficiency list, and authored ability list. They are not AI-written aliases.
3. **Choose training.** Assign `3, 2, 1, 0` to the four attributes and select one card: Martial (Athletics plus Melee or Ranged), Covert (Stealth plus Finesse), Technical (Systems plus Craft), Learned (Lore plus Investigate), Social (Influence plus Insight), or Field (Survival plus Medicine). The archetype also grants its signature skill at rank 1. A duplicate is replaced by another skill printed on the same class card; it never over-ranks the level cap.
4. **Choose a background.** Academic, Criminal, Frontier, Military, Mystic, Professional, Technical, and Wanderer are fixed packages. Each grants one printed rank-1 skill, one contact type, and one kit. Background is prior life, not a class and not a permission to bypass class restrictions.
5. **Choose standing and means.** Pick a wealth tier and an institutional relationship from §3.7. Rank, office, command, fame, and ownership live here or in referenced assets, never in the class field.
6. **Choose identity.** Name, pronouns, appearance, and player-owned title are free text with no mechanical authority.
7. **Confirm the legal build.** The engine displays exact IDs, proficiencies, resources, recovery rules, starting abilities, HP, defenses, gear, contacts, obligations, and assets. The player confirms that record. Descriptive prose is written around the confirmed mechanics afterward.

The Creator may recommend authored IDs, but the engine calculates and validates the build. It may not infer a class, skill, feature, proficiency, status, or asset from the player's prose, and retrying a model is never a repair mechanism.

### 1.4 Background packages

| Background | Mechanical grant | Contact | Starting kit |
|---|---|---|---|
| Academic | Lore or Investigate 1 | scholar, archivist, or researcher | reference set |
| Criminal | Stealth or Influence 1 | fence, smuggler, or crew member | intrusion tools |
| Frontier | Survival or Ranged 1 | guide, trader, or homesteader | travel kit |
| Military | Athletics or Leadership 1 | veteran, quartermaster, or unit member | field kit |
| Mystic | Focus or Insight 1 | mentor, congregation, or occult circle | ritual focus |
| Professional | Craft or Influence 1 | guild, client, or colleague | trade tools |
| Technical | Systems or Pilot 1 | engineer, operator, or supplier | technical tools |
| Wanderer | Pilot or Survival 1 | caravan, ship, or route contact | portable camp |

If the granted skill is already rank 1, the player takes the other printed skill. If both are already rank 1, the background grants any one rank-1 skill; no creation choice can create rank 2.

## 2. Classes

### 2.1 Nine mechanical archetypes, eighteen meaningful branches

These are the only class-level mechanical chassis. Roles such as defender, commander, scout, investigator, healer, face, pilot, and patron are build descriptions derived from class features, skills, equipment, standing, and assets. They grant nothing by themselves.

| Archetype | Exclusive repeated loop | Left branch | Right branch | Health / signature skill |
|---|---|---|---|---|
| **Armsmaster** | Select a weapon form each turn and trade attack, control, movement, or a prepared counter. Only this class advances martial forms. | **Discipline:** stronger forms, guard, and counters. | **Pursuit:** quarry, mobility, and ranged or skirmish forms. | Hardy / Melee or Ranged |
| **Berserker** | Enter danger deliberately, becoming more dangerous as exposure or injury rises. Its strongest output carries a real defensive or positional cost. | **Fury:** higher burst and self-exposure. | **Endurance:** converts endured harm into staying power and retaliation. | Hardy / Endure |
| **Opportunist** | Create a rules-defined opening, exploit it once, then create the next one; outside conflict, turn narrow expertise into reliable stunts. | **Opening:** precision, misdirection, and momentum in conflict. | **Mastery:** broader expertise, preparation, and noncombat reliability. | Standard / Finesse or Insight |
| **Intruder** | Enter a protected physical, social, occult, or technical system; build Access while Alert rises; spend Access on exact permissions before the system locks down. | **Ghost:** entry, concealment, and extraction. | **Breaker:** control of locks, wards, devices, and networks. | Standard / Stealth or Systems |
| **Arcanist** | Prepare a limited loadout from a broad learned catalog, then decide which exact ranked effect is worth consuming. Preparation is the class's advantage and constraint. | **Formula:** more prepared combat and utility effects. | **Ritual:** fewer immediate effects but larger authored rituals with time and component requirements. | Fragile / Lore |
| **Channeler** | Use a narrow known repertoire without preparation and choose when to overextend body, faith, emotion, or conduit. Its flexibility is paid in recovery pressure, not a renamed spellbook. | **Restoration:** prevention, cleansing, and healing. | **Manifestation:** force, influence, summons, or phenomena. | Fragile / Focus |
| **Oathbound** | Declare one ward, charge, or prohibition and gain effects only while acting consistently with that declaration. Breaking it ends the effect; changing it requires a Main action. | **Aegis:** protects a named ally or place and punishes intrusion. | **Judgment:** marks a named foe or wrong and escalates pressure on it. | Hardy / Focus or Leadership |
| **Shifter** | Switch between authored profiles which replace, rather than stack, movement, defenses, senses, and available powers. | **Predator:** fewer combat-specialized forms. | **Adaptive:** more utility forms and faster switching. | Standard / Endure or Focus |
| **Maker** | Prepare a small inventory of devices or a bounded construct, deploy it, then repair or reconfigure it under explicit time and material rules. | **Device:** more independent consumable or persistent tools. | **Companion:** one class-owned construct sharing the character's action budget. | Standard / Craft |

The branches are mechanically stable across genre catalogs. A genre class adds a fixed equipment/proficiency package and a curated ability list for its world. A class entry therefore has a stable engine identity such as `class.intruder.breaker.cyberpunk.netbreaker`; the model does not mint it.

### 2.2 Genre-class mapping: archetypes on Y, genres on X

The campaign creator explicitly selects one primary genre catalog; no model classifies free text. Blended settings still choose one mechanical catalog and can use separate campaign vocabulary for presentation. In every cell, the **left name implements the left branch** from §2.1 and the **right name implements the right branch**. Thus the choice after archetype is meaningful and deterministic.

| Archetype ↓ / Genre → | High fantasy | Historical / grounded | Gothic / occult | Western / frontier | Contemporary / crime | Pulp / superhero | Cyberpunk / tech-noir | Space opera / science fiction | Post-apocalypse / survival | Surreal / cosmic |
|---|---|---|---|---|---|---|---|---|---|---|
| **Armsmaster** | Fighter / Ranger | Weapon Master / Outrider | Slayer / Hunter | Gunslinger / Trailblade | Combat Specialist / Field Operative | Martial Hero / Vigilante | Chrome Blade / Solo | War Adept / Blaster Ace | Road Warrior / Raider | Pattern Blade / Horizon Hunter |
| **Berserker** | Barbarian / Stoneblood | Berserker / Ironbound | Cursed Brute / Revenant | Rager / Diehard | Breacher / Juggernaut | Powerhouse / Invulnerable | Chrome Rager / Heavy | Warform / Heavyworlder | Mutant Ravager / Wasteland Juggernaut | Nightmare / Unbroken |
| **Opportunist** | Rogue / Bard | Scoundrel / Savant | Grave Rogue / Occult Sleuth | Cardsharp / Maverick | Grifter / Specialist | Trickster / Pulp Ace | Edge Runner / Operator | Scoundrel / Polymath | Scavenger / Fixer | Fate Thief / Mnemonist |
| **Intruder** | Shadow / Runebreaker | Catspaw / Sapper | Veilwalker / Wardbreaker | Ghost / Safecracker | Infiltrator / Hacker | Phantom / Codebreaker | Ghost / Netbreaker | Infiltrator / Slicer | Stalker / Relic Breaker | Dreamwalker / Sealbreaker |
| **Arcanist** | Wizard / Magus | Natural Philosopher / Ritualist | Occultist / Necromancer | Hexslinger / Relic Scholar | Thaumaturge / Parapsychologist | Mystic / Super-Scientist | Protocol Mage / Simulationist | Technomancer / Noetic Adept | Relic Adept / Ash Scholar | Reality Scribe / Dream Architect |
| **Channeler** | Cleric / Sorcerer | Saint / Oracle | Exorcist / Medium | Faith Healer / Stormcaller | Empath / Psychic | Radiant / Elemental | Biochanneler / Resonant | Xenomedic / Psion | Mender / Mutant | Soulkeeper / Star Vessel |
| **Oathbound** | Paladin / Avenger | Sworn Guardian / Zealot | Monster Warden / Witch Hunter | Lawbringer / Vindicator | Sentinel / Vigilant | Guardian / Avenger | Aegis / Renegade | Order Knight / Void Templar | Settlement Warden / Vindicator | Reality Anchor / Doom Judge |
| **Shifter** | Druid / Skinchanger | Stance Master / Mask Adept | Werebeast / Doppelganger | Skinwalker / Stance Gunner | Mimic / Adaptive | Shapeshifter / Battlesuit | Bodymodder / Chassis Dancer | Morph / Battleshell | Mutant / Relic Shell | Dreamshaper / Manyself |
| **Maker** | Artificer / Golemwright | Engineer / Mechanist | Relic Smith / Homunculist | Tinkerer / Automatonist | Inventor / Roboticist | Gadgeteer / Construct Hero | Techsmith / Dronewright | Engineer / Synthwright | Scrapwright / Botkeeper | Impossibility Smith / Echo Builder |

The matrix is a product catalog, not permission for an AI to improvise setting equivalents. A grounded campaign may omit supernatural catalog rows only through an authored campaign template chosen before character creation; it cannot selectively invalidate an existing character after play begins.

## 3. Shared encounter, advancement, and world rules

### 3.1 Levels, bands, and ability ranks

Characters have ten levels in four bands:

| Character levels | Band | Maximum skill rank | Equal-level opposition tier | Maximum ability rank |
|---|---|---:|---|---:|
| 1–2 | Initiate | 1 | `standard` | 1 |
| 3–4 | Proven | 2 | `hard` | 2 |
| 5–7 | Heroic | 3 | `extreme` | 3 at 5, 4 at 7 |
| 8–10 | Legendary | 4 | `legendary` | 4 at 8, 5 at 9 |

An **ability rank** is a content gate, not a number of points a player can pour into an effect. Every ability record contains one exact rank, action type, target rule, range, operation list, fixed cost/cadence, and level-band scaling table. A rank-1 effect never becomes rank 5 because the player spent five units on it, and a rank-5 effect can never be activated with a rank-1 permission.

### 3.2 Actions, initiative, reactions, and zones

On a turn a character receives one **Main**, one **Move**, and one **Quick** action. A Main may be downgraded to a Move or Quick; a Move may be downgraded to a Quick. Free speech and trivial handling are allowed only when they do not execute an effect operation.

At encounter start the engine rolls `d100 + 5 × Agility` once for every participant. Highest acts first; ties go to higher Agility, then players, then stable entity ID. That cyclic order remains fixed. Delay moves the participant immediately after a named participant for the rest of the encounter. There is no held action which interrupts another player's turn.

A character can arm one authored **Reaction** on their own turn. It names an exact trigger and effect. The engine automatically fires it on the first legal trigger before the character's next turn, or it expires. Reactions never ask a player a mid-turn question and never roll an opposed check. A shield's `Block`, an Armsmaster counter, and an Oathbound interdiction use this rule.

Tactical position has three encounter ranges:

- **Engaged:** in direct melee with one or more named participants.
- **Near:** in the same encounter area and reachable with one Move.
- **Far:** in the encounter but requiring two Moves from Near; ordinary melee cannot target it.

Outside the encounter is not a fourth combat zone. One Move changes Engaged ↔ Near or Near ↔ Far. Leaving Engaged requires a Disengage Move or triggers an already-armed legal reaction. Cover, hazards, passages, and obstructions remain engine-owned scene features from the effect catalog. Exact map coordinates are presentation only.

### 3.3 Defenses, HP, harm, and equipment

Every participant has Guard, Reflex, and Resolve defense tiers. An ability declares which defense it tests. A participant's equal-level baseline is the tier in §3.1; passive class, role, equipment, and condition effects may shift a named defense at most one rung easier or harder. Multiple passive shifts in one direction do not stack. A one-use armed Reaction may shift its triggering check one additional rung. The acting character still rolls the signed d100 check against that final engine-derived tier.

Maximum player HP is deterministic:

```text
Fragile  = 10 + 4 × level + 2 × Might
Standard = 14 + 5 × level + 2 × Might
Hardy    = 18 + 6 × level + 2 × Might
```

Weapon and ordinary attack harm is fixed by level band; the engine applies it only after a successful check:

| Level band | Light | Standard | Heavy |
|---|---:|---:|---:|
| 1–2 | 4 | 5 | 7 |
| 3–4 | 6 | 8 | 10 |
| 5–7 | 9 | 12 | 15 |
| 8–10 | 13 | 17 | 21 |

Light weapons are concealable or usable without full leverage. Standard weapons are one-handed martial or ordinary two-handed ranged weapons. Heavy weapons require two hands, setup, ammunition, or another printed constraint. Area effects deal Light harm unless their ability record explicitly pays a higher rank/cadence for more. There is no damage roll and no model-authored harm.

Unarmored gear leaves all defenses unchanged. Light armor shifts Guard one rung harder only against physical attacks. Heavy armor shifts Guard one rung harder and Reflex one rung easier. A shield supplies the pre-armable `Block` reaction, shifting one triggering physical attack one rung harder; it does not add another permanent shift.

Each class grants exact weapon and armor groups. A non-proficient weapon can be used only as a Light improvised attack with no class form, spell delivery, or heavy property. `Weapon Training` is a general talent granting one weapon group. An Arcanist can therefore buy battle-axe proficiency without receiving Armsmaster forms; receiving those forms requires multiclassing.

### 3.4 Downed, stabilization, and permanent outcomes

At 0 HP a character becomes **Downed**, cannot act, and receives a three-box defeat track. At the start of each of that character's turns the engine marks one box; further harm marks one additional box. At three boxes the character is **Defeated** and removed from the scene.

An adjacent character can take a Main action and make a Medicine check against the downed character's band baseline. Success stabilizes them: no more boxes are marked, but they remain Downed until healed above 0. Outside an encounter, the engine opens a three-round rescue sequence, with one round per minute, so the same rule has an explicit clock.

Defeat never lets the AI kill or mechanically alter a player character permanently. After the scene, before that character is next selected for play, the player chooses one recorded outcome: retire/death, or survive, return at 1 HP, and record one presentation-only scar. A scar grants no modifier, condition, permission, or penalty. This deferred choice never blocks another participant's active turn. PvP harm and coercive effects are illegal without prior recorded consent.

### 3.5 Opposition and encounter balance

The model may choose an authored level, role, and presentation. The engine derives every number.

For any attack, start with the target's level-band tier from §3.1. Level difference is already represented by the attacker's rank/attribute bonus and the target's band; it is not counted again as a situational shift. Apply only the bounded defense shifts in §3.3. Standard NPC signature SkillBonus is 25 at levels 1–2, 40 at 3–4, 55 at 5–7, and 70 at 8–10. A printed secondary competence is 15 lower; an untrained action is 0. Ordinary foes use:

```text
Standard foe HP = 6 + 4 × level
Standard foe harm = the Standard column in §3.3
```

Authored roles make bounded changes:

| Role | Derived change | Encounter cost |
|---|---|---:|
| Minion | One successful damaging hit defeats it; Light harm | 0.25 |
| Skirmisher | Reflex one rung harder, Guard one rung easier | 1 |
| Guardian | Guard one rung harder, Reflex one rung easier | 1 |
| Controller | Resolve one rung harder, Guard one rung easier | 1 |
| Brute | HP × 1.5, Heavy harm, Reflex one rung easier | 1.5 |
| Elite | HP × 2, one additional authored reaction | 2 |
| Boss | HP × 4, two turns at fixed initiative positions, condition resistance | 4 |

Round fractions up. A standard encounter budget equals the number of player characters; hard is 1.5 times that budget and extreme is twice it. A four-character standard encounter is therefore four standard foes, two elites, one boss, or a budget-equivalent mixture. The target is three to five rounds, with a standard foe falling to roughly two or three successful standard attacks. The engine rejects a roster above the selected budget unless the campaign explicitly labels the encounter at the higher band before initiative.

### 3.6 Talents, multiclassing, and derived roles

Every character gains a general or class talent at levels 1, 3, 6, and 9. Talents grant discrete authored permissions such as a weapon group, armor group, ritual practice, asset specialty, stronger recovery, or a class-feature upgrade. A talent cannot grant an entire class loop.

Multiclass details differ by variant, but all obey three invariants:

1. Total character level remains ten; a second class consumes advancement that would have advanced the first.
2. Entry proficiency never grants the second class's complete signature loop. The variant's stated initiation cost or delayed feature prevents a one-level dip from buying a full chassis.
3. Resource pools, prepared lists, cadence tags, and class-level scaling remain separately calculated. They are never merged into a larger generic pool.

`Defender`, `artillery`, `controller`, `commander`, `scout`, `investigator`, `healer`, `face`, and similar terms are UI summaries. The engine derives them from current features, skills, equipment, and assets. They are not stored class IDs and do not grant progression.

### 3.7 Wealth, standing, leadership, and assets

Wealth is a coarse player-character field: **strained, comfortable, affluent, or opulent**. It answers whether an ordinary purchase is consequential; it never adds to an attack, check, HP, or class-resource budget. Comfortable is the default. Affluent begins with one Duty; opulent begins with two Duties. A Duty is a four-box campaign clock tied to the source of privilege; the engine advances it when that privilege is materially used, and a full clock creates an authored obligation scene before it clears.

Standing is one of **independent, affiliated, officer, or outsider** in one authored institution. Affiliated grants access to ordinary members and facilities plus one Duty. Officer additionally permits command of a separately recorded follower asset when the campaign grants one, and begins with two Duties. Outsider grants a specific underworld or marginal contact and a specific barrier. None changes class.

Major property, corporations, garrisons, vehicles, laboratories, and companion groups are referenced **assets**. Every asset has an owner, scope, three Availability boxes, obligations, current location, and explicit actions. Using an available asset marks one Availability box; at three it cannot be used again until its authored recovery condition occurs. Remote use requires an established communication and delivery path. A sealed dungeon therefore blocks an off-site corporation even when its owner is opulent.

Leadership coordinates allies already present: on a successful Leadership Main action, one named ally receives one authored boon or may take one immediate Move. It never summons followers, creates authority, or grants another Main action. A garrison exists only as an asset and obeys encounter budget and availability.

### 3.8 Persistent rules help

Character creation and play keep a persistent rules-help panel beside the active choice or ability. Selecting or focusing an item replaces the panel's complete content, not only its nouns. For a resource or cadence it always shows: current and maximum state, what changes it, exact return condition, what does not return it, and one worked use. For a spell it separately shows character level, ability rank, slot or casting requirement, base effect, any printed higher-slot row, and recovery. For standing or an asset it shows Availability, Duty, location/access requirements, and the actions it actually authorizes. The panel never describes a class counter as a themed form of a hidden universal stat.

### 3.9 Class balance target

Every class has an always-available Main action worth one Standard attack against one target or a printed non-damage equivalent. For authoring balance, preventing one Standard hit, restoring one Recovery Value, moving a target one zone plus Light harm, or applying one one-round defense shift are each one standard action-equivalent. Affecting two targets, dealing Heavy harm, denying a Main action, or producing a scene-persistent feature requires the variant's limited resource/cadence and an ability rank which explicitly prices it. No ability record may exchange an arbitrary quantity of resource for additional equivalents.

The intended contribution profile is asymmetric but never blank:

| Archetype | Combat | Exploration / problem solving | Social / world | Always-available floor when signature setup is absent |
|---|---|---|---|---|
| Armsmaster | High | Medium | Low | Standard weapon form and physical skill |
| Berserker | High | Medium | Low | Standard attack and Endure-based hazard action |
| Opportunist | Medium | High | High | Opening attack or one mastered-skill stunt |
| Intruder | Medium | High | Medium | Ghost movement or local Probe; protected systems add depth, not permission to participate |
| Arcanist | Medium burst | High | Medium | Rank-0 effect, Lore, and ritual preparation |
| Channeler | Medium support | Medium | High | Rank-0 manifestation or restorative support action |
| Oathbound | High defense/pressure | Medium | High | Basic declaration and its reaction |
| Shifter | Medium-high | High | Medium | One base form is always available |
| Maker | Medium | High | Medium | One prepared device remains usable; repair and Craft never require a workshop asset |

Balance simulation uses four equal-level characters against the standard budget in §3.5 and measures successful action-equivalents over four rounds, after one, three, and six encounters without top-up. Each archetype must remain within 20% of the party median over the full sequence and contribute at least one legal standard equivalent in each of three authored tests: open combat, an exploration obstacle, and a negotiation/world obstacle. Asset calls are scored separately and never repair a weak class chassis. These are catalog acceptance tests; the owner-facing feel gate still requires real play.

## 4. Variant A — Commitment

**Closed package ID:** `aetheria.commitment.v1`

**Open-system lineage:** the CC0 *Worlds Without Number* / *Cities Without Number* commitment, partial-class, prepared-casting, System Strain, and Access/Alert structures. The signed d100 check, shared classes, fixed harm, zones, and engine authority replace the donors' dice and combat math.

**Creation time:** 7–9 minutes. After the shared seven choices, select two starting class abilities from a class card containing at most four.

### 4.1 Effort is a commitment state, not mana

Every character has one resource named **Effort**. It is not renamed per class. Capacity is 2 at levels 1–2, 3 at 3–5, 4 at 6–8, and 5 at 9–10.

An ability commits exactly one Effort or none; a player never chooses an amount. A committed point is unavailable until the timing printed on that ability returns it:

| Timing | Exact return point |
|---|---|
| `duration` | The player ends the maintained effect as a Quick action, or the effect's stated end condition occurs. |
| `turn` | End of the acting character's current turn. |
| `scene` | The engine closes the active encounter, chase, infiltration node, negotiation, or other objective scene and ten uninterrupted minutes pass without a new hostile action. |
| `day` | Completion of Safe Recovery: eight uninterrupted hours with food, shelter, and no encounter, no more than once per 24 hours. |

There is no “breather” keyword. Scene closure restores scene-committed Effort; ten minutes alone does not restore day-committed Effort, spells, HP, or Strain.

### 4.2 Class loops under Commitment

| Archetype | Core use of commitment | Branch distinction |
|---|---|---|
| Armsmaster | Commit for `turn` to arm an advanced form or counter; ordinary forms cost none. | Discipline gains stronger counters; Pursuit commits to a quarry for `duration` and gains movement/range forms. |
| Berserker | Commit for `scene` to enter frenzy. While frenzied, attacks rise one harm category and Guard is one rung easier. | Fury adds one burst attack but cannot Disengage that turn; Endurance instead gains temporary HP equal to level on the first hit each round. |
| Opportunist | Its Opening is a boolean, not Effort: it is present when the target is hindered, unaware, or was hit by an ally since its last turn, and is consumed to raise one hit to Heavy. Commit for `turn` to preserve or manufacture one opening. | Opening improves the combat exploitation; Mastery commits for `scene` to reroll one failed noncombat check in a mastered skill. |
| Intruder | Each protected system starts Access 0, Alert 0. A successful Probe Main action adds 1 Access (max 3); a failed intrusion action adds 1 Alert. Spend exact Access costs on authored system actions; at Alert 3 the system locks or deploys its authored response. | Ghost gets concealment/extraction actions; Breaker gets control/disable actions. Effort maintains stealth or tools but never substitutes for Access. |
| Arcanist | Effort fuels arts and maintained effects. Ranked spells use the separate prepared-casting rule below, so a spell is not an arbitrary Effort purchase. | Formula prepares more immediate spells; Ritual prepares fewer spells and can perform printed time-and-component rituals without consuming a casting. |
| Channeler | Commit for `duration`, `scene`, or `day` to invoke a known art. No preparation and no ranked spell slots. | Restoration can heal but each use adds Strain; Manifestation has more adverse/control operations and more `day` commitments. |
| Oathbound | Commit for `duration` to maintain exactly one declared ward or judgment. Changing its named subject ends it; recommitting is a Main action. | Aegis arms protection reactions around the ward; Judgment gains escalating effects when the marked foe violates the declaration. |
| Shifter | Commit for `duration` to assume one complete form profile; ending or changing it is a Quick action. Profiles replace and never stack. | Predator has two stronger combat forms; Adaptive has three broader forms and one free switch per scene. |
| Maker | Commit for `duration` while a deployed device or construct is active; commit for `day` to improvise a device not in the prepared loadout. | Device can maintain two simple devices with one commitment; Companion spends the character's Move or Main to command one bounded construct. |

### 4.3 Prepared spells and ability rank

Only Arcanists use prepared ranked spells in this package. Spell rank is 1–5 and unlocks at character levels 1, 3, 5, 7, and 9. A spell has one fixed rank and effect record. There is **no upcasting** and no Effort-to-rank conversion.

| Arcanist level | Maximum spell rank | Castings per Safe Recovery | Formula prepared / Ritual prepared |
|---:|---:|---:|---:|
| 1 | 1 | 1 | 3 / 2 |
| 2 | 1 | 1 | 4 / 3 |
| 3 | 2 | 2 | 5 / 3 |
| 4 | 2 | 2 | 6 / 4 |
| 5 | 3 | 3 | 7 / 4 |
| 6 | 3 | 3 | 8 / 5 |
| 7 | 4 | 4 | 9 / 5 |
| 8 | 4 | 4 | 10 / 6 |
| 9 | 5 | 5 | 11 / 6 |
| 10 | 5 | 6 | 12 / 7 |

Casting any prepared spell consumes one casting, regardless of rank. A rank-5 spell is constrained by knowing it, preparing it, reaching level 9, and the small shared casting count; a rank-1 spell remains its printed effect. The UI displays `spell rank`, `prepared`, and `castings remaining` as three separate facts.

### 4.4 Healing, Strain, and Safe Recovery

Maximum Strain is `6 + Might`. First Aid takes ten uninterrupted minutes, consumes one medical supply, restores `4 + level + 2 × Medicine rank` HP, and adds 1 Strain. A Channeler Restoration effect restores its printed amount and also adds 1 Strain. Healing which would exceed maximum Strain is illegal.

Safe Recovery is exactly the eight-hour condition in §4.1. It returns day-committed Effort and all Arcanist castings, clears 1 Strain, and restores HP equal to `level + Might`; it does not fully heal the party. A stabilized Downed character becomes conscious at 1 HP after ten safe minutes and gains 1 Strain. If that would exceed maximum Strain, the character remains stable and unconscious until Safe Recovery clears one Strain.

### 4.5 Advancement and multiclassing

At each level the character gains the shared skill points. Levels 2, 5, and 8 grant a new class ability; levels 3, 6, and 9 increase Effort and grant an ability upgrade; level 10 grants the branch capstone. Talents remain at levels 1, 3, 6, and 9.

At creation a player may take the **Dual Training** talent and combine two partial archetypes, following the donor's proven partial-class pattern. The character receives both branch entry features, but not either full-archetype level-1 capstone feature; HP uses the lower health band. The character still has one shared Effort capacity from §4.1, but no partial archetype may have more than `ceil(capacity ÷ 2)` Effort committed to its abilities at once. Later gains alternate between the two partial class tables. A later multiclass requires Dual Training and replaces the next class-feature gain with the secondary entry feature. This makes a Battle Mage playable at level 1 while paying a talent, health, commitment ceiling, and delayed-feature cost.

### 4.6 Strengths, costs, and likely failure mode

- **Strengths:** one honest visible resource; commitment creates choices without arithmetic; Safe Recovery and Strain preserve attrition; partial classes handle hybrid concepts cleanly; CC0 is the cleanest licensing path.
- **Costs:** players must understand four commitment return timings; long-adventure healing is intentionally limited; class balance depends on whether maintaining one strong effect is worth tying up a large fraction of Effort.
- **Likely failure mode:** if too many abilities use `scene`, Effort becomes a routine per-encounter charge system and commitment stops mattering. Catalog review must require meaningful `duration` and `day` commitments and preserve strong no-cost class loops.

## 5. Variant B — Slots and rests

**Closed package ID:** `aetheria.slots.v1`

**Open-system lineage:** the CC-BY-4.0 SRD 5.2.1 action, proficiency, spell-slot, recovery-die, short-rest, long-rest, and multiclass structures. The signed d100 check and ten-level house progression replace the donor's d20 and twenty-level math.

**Creation time:** 8–10 minutes. After the shared choices, select the class's two starting abilities and, for a caster, a short prepared or known list.

### 5.1 Operational rests

A **Short Rest** is one uninterrupted hour in which the character does not travel, fight, cast, intrude, craft, or perform strenuous activity. Conversation, eating, and medical treatment are allowed. It restores only resources explicitly marked `short rest` and permits spending Recoveries.

A **Long Rest** is eight hours in a defensible location, with at least six hours asleep and no more than two hours of watch or light activity. Any encounter or hour of strenuous activity restarts it. A character can benefit from one Long Rest per 24 hours. It restores all spell slots and long-rest class uses, restores HP to maximum, and returns half the character's spent Recoveries, rounded up.

Every character has Recoveries equal to level. Spending one during a Short Rest restores a fixed Recovery Value: `4 + level + Might` for Fragile, `6 + level + Might` for Standard, and `8 + level + Might` for Hardy. Recoveries are uses, not dice; the engine rolls nothing and restores that fixed value.

### 5.2 Ranked slots and upcasting

Arcanists and Channelers use the full-caster slot table; Oathbound uses the half-caster table. A slot has a rank, not a pool of points.

| Level | Full caster slots by rank 1/2/3/4/5 | Oathbound slots by rank 1/2/3 |
|---:|---|---|
| 1 | 2 / – / – / – / – | – / – / – |
| 2 | 3 / – / – / – / – | 2 / – / – |
| 3 | 4 / 2 / – / – / – | 3 / – / – |
| 4 | 4 / 3 / – / – / – | 3 / – / – |
| 5 | 4 / 3 / 2 / – / – | 4 / 2 / – |
| 6 | 4 / 3 / 3 / – / – | 4 / 2 / – |
| 7 | 4 / 3 / 3 / 1 / – | 4 / 3 / – |
| 8 | 4 / 3 / 3 / 2 / – | 4 / 3 / – |
| 9 | 4 / 3 / 3 / 3 / 1 | 4 / 3 / 2 |
| 10 | 4 / 3 / 3 / 3 / 2 | 4 / 3 / 2 |

To activate a rank-N spell, spend one slot of rank N or higher. The spell executes its printed base effect. A higher slot changes it only when the record has an explicit `higherSlot` row, applied once per slot rank above the spell. A rank-1 spell in a rank-5 slot therefore does exactly its base row plus four printed higher-slot steps; if the record has no such row, it gains nothing. A rank-5 spell cannot use a rank-1 slot. Character level, ability rank, and slot rank are separate UI fields.

Arcanists prepare `Intellect + Arcanist level` spells after a Long Rest from their learned catalog. Channelers know a fixed number from their class table—3 at level 1, plus one at levels 2, 4, 6, 8, and 10—and can cast any known spell with a legal slot. Oathbound prepares `1 + Will + half Oathbound level`, rounded down, from its smaller catalog.

### 5.3 Class loops under Slots and rests

| Archetype | Exact limited resource | Always-available loop |
|---|---|---|
| Armsmaster | Technique uses: 2 at levels 1–4, 3 at 5–8, 4 at 9–10; all return on Short Rest. One use upgrades a form or counter. | Select one basic form every turn. |
| Berserker | Frenzy uses: 2 at levels 1–3, 3 at 4–6, 4 at 7–9, 5 at 10; return on Long Rest. Each frenzy lasts the scene. | Reckless attack raises harm one category while making Guard one rung easier until next turn. |
| Opportunist | Opening has no charges and can be consumed once per turn. Mastery branch also has Expertise uses 2/3/4 by levels 1/5/9, returned on Short Rest, to reroll a mastered noncombat check. | Create and exploit rules-defined openings. |
| Intruder | Access and Alert remain system state, not rest resources. Override uses 2/3/4 by levels 1/5/9 return on Short Rest and permit one authored emergency intrusion action without Access, while adding 1 Alert. | Probe, gain Access, spend it, manage Alert. |
| Arcanist | Full-caster slots and prepared spells. | Rank-0 cantrips and rituals with printed time/components. |
| Channeler | Full-caster slots and known spells. Once per Long Rest at levels 1–5, twice at 6–10, Overchannel restores one spent slot of rank no higher than half maximum, rounded up, and deals Heavy harm which cannot be prevented. | Rank-0 manifestations and branch support action. |
| Oathbound | Half-caster slots; Mark uses 1 at levels 1–4, 2 at 5–8, 3 at 9–10, returned on Short Rest. | Maintain one basic oath target and its printed reaction. |
| Shifter | Shift uses 2 at levels 1–4, 3 at 5–8, 4 at 9–10; return on Short Rest. A form lasts until ended and does not consume further uses. | Unshifted class actions and one minor aspect. |
| Maker | Prepare 3 devices at level 1, 5 at 5, 7 at 9 after a Long Rest. Deploy uses 2/3/4 at levels 1/5/9 return on Short Rest. | Repair, recover an already-deployed device, or use mundane gear. |

The resource names above are not cosmetic aliases of one pool: they differ in trigger, capacity, return cadence, and what they constrain. The UI explains the class's actual loop and shows only counters that class owns; it never presents a universal Power stat with a class-themed label.

### 5.4 Advancement and multiclassing

Level 1 grants the branch entry and two abilities. Level 2 grants the first resource upgrade. Level 3 grants the first branch feature and a talent. Levels 4, 7, and 10 grant the shared attribute increases. Level 5 grants the archetype's veteran feature; level 9 grants its master feature; level 10 also grants the branch capstone. Each level grants the shared skill points, and levels without a named chassis feature grant an ability choice or upgrade.

To take a level in a second archetype, the character must have at least 2 in that archetype's primary attribute and spend the level. The first secondary level grants proficiencies and the branch's printed passive entry benefit, but not its signature resource, active declaration, or full loop; the second secondary level grants that loop at its level-1 capacity. Spell slots use the standard multiclass caster calculation: add full Arcanist and Channeler levels plus half Oathbound levels, rounded down, then read the full-caster slot row, while spells known/prepared remain class-specific. A weapon-proficiency talent remains the cheaper route for an Arcanist who wants only a battle axe.

### 5.5 Strengths, costs, and likely failure mode

- **Strengths:** familiar ranked-spell semantics; exact short and long rests; strong restrictions; extensive open reference data; every limited resource tells the player when it returns.
- **Costs:** most classes own at least one counter; Short Rest and Long Rest create party pacing negotiations; full casters require the largest creation and level-up catalogs; CC-BY attribution requires owner approval.
- **Likely failure mode:** the system accumulates one bespoke charge track per class and becomes the same bookkeeping problem as the rejected prototype, only better specified. If adopted, the UI must keep counters contextual and the class catalog must resist adding secondary pools.

## 6. Variant C — Cadence

**Closed package ID:** `aetheria.cadence.v1`

**Open-system lineage:** the 13th Age SRD's escalation, recovery, rally, recharge, per-battle/per-heal-up power cadence, abstract position, and incremental-advancement structures, paraphrased into the signed d100 engine. No trademarked setting content or class text is adopted.

**Creation time:** 8–10 minutes. After the shared choices, select two at-will abilities, two once-per-battle abilities, one recharge ability, and one per-heal-up ability from a class card containing no more than eight eligible records.

### 6.1 There is no class power pool

Every class ability is tagged with one cadence:

| Cadence | Exact availability |
|---|---|
| `at_will` | Once per turn unless the record says otherwise. |
| `once_battle` | Returns when the current encounter closes. |
| `recharge_26`, `recharge_51`, `recharge_76` | After a Quick Rest following a battle, the engine rolls d100 for each used power; it returns on raw 26+, 51+, or 76+ respectively. |
| `heal_up` | Returns only on a Full Heal-up. |

The recharge thresholds are exact d100 translations of 75%, 50%, and 25% return rates. A power's cadence is fixed; no player spends points to strengthen or refresh it.

### 6.2 Escalation is a real combat mechanic

Escalation starts at 0 in round 1, becomes 1 at the start of round 2, then rises by one each round to 6. Player characters add `5 × Escalation` to attack SkillBonus, still capped at 75. NPCs do not. If the party takes no hostile or objective-advancing action for a full round, Escalation does not rise; if combat ceases for a full round, it resets to 0.

Abilities can key off exact Escalation values. For example, an Armsmaster flexible form may arm only at Escalation 2+, and an Arcanist daily effect may gain its printed secondary operation at Escalation 4+. Escalation is therefore not a flavor label or spendable pool: it is shared encounter state which changes hit probability and unlocks authored effects as the fight develops.

### 6.3 Quick Rest, Recoveries, Rally, and Full Heal-up

A **Quick Rest** is ten uninterrupted minutes after an encounter. Characters may spend any number of Recoveries and the engine rolls recharge checks for used recharge powers. It does not restore once-per-battle powers until the encounter is closed, and it never restores per-heal-up powers by itself.

Every character begins a Full Heal-up with eight Recoveries. Spending one restores the same fixed Recovery Value used in Variant B. Once per battle, a character may **Rally** as a Main action to spend one Recovery. A later Rally in the same battle first requires a raw d100 roll of 51+; on failure the action is not spent and the character acts normally, but cannot try again that turn.

The engine counts meaningful encounters since the last Full Heal-up: minor encounters count 0.5, standard 1, hard 1.5, and extreme 2. At 4 points the party earns a **Full Heal-up** at the next ten-minute pause: HP returns to maximum, Recoveries return to eight, and every power returns. Sleeping does not itself cause a Full Heal-up. Before 4 points, the party can retreat to safety for one, but the engine first commits one legal authored campaign loss: lose the current objective, advance one named enemy plan, mark one Availability on every deployed party asset, or advance one party member's existing Duty. No model invents a loss or its mechanical weight.

### 6.4 Class loops under Cadence

| Archetype | Cadence-specific loop |
|---|---|
| Armsmaster | At-will flexible forms inspect the natural d100 result, range, and Escalation and automatically execute the highest-priority legal form selected in the player's loadout. Strong counters are once per battle; master forms recharge. No interrupt prompt occurs. |
| Berserker | Frenzy is once per battle. Fury gains its strongest attack at Escalation 3+; Endurance gains its recovery reaction after becoming staggered. A devastating frenzy is per heal-up or `recharge_76`. |
| Opportunist | Momentum is a boolean: gain it on a successful Opening attack, lose it when hit by an enemy, and require or spend it for printed at-will powers. Large exploits are once per battle. |
| Intruder | Access and Alert remain protected-system state. Probe/control actions are at will, emergency overrides are once per battle, and system-wide takeover is per heal-up or `recharge_76`. |
| Arcanist | The prepared loadout contains at-will cantrips, once-per-battle spells, recharge spells, and per-heal-up spells; there are no slots. Formula prepares one more battle spell; Ritual can convert a prepared per-heal-up spell into its printed noncombat ritual with time/components. |
| Channeler | `Gather` is a Main action which focuses the next manifestation; it is a boolean lost after use or interruption, not a pool. Restoration converts Recoveries; Manifestation uses Gather to improve a once-per-battle or recharge effect. |
| Oathbound | Declaring an oath target is once per battle. Its basic reaction is at will while the declaration holds; judgment or rescue effects are once per battle, with the largest miracle per heal-up. |
| Shifter | Switching form is a Quick action once per battle and otherwise a Move. Each form has its own at-will action and one once-per-battle form power; per-heal-up transformation effects are exceptional. |
| Maker | Deploy one prepared device once per battle; device attacks consume the Maker's action. Used prototypes carry recharge tags, while a major construct overdrive is per heal-up. |

### 6.5 Advancement and multiclassing

Cadence uses the same four level bands as §3.1. At levels 3, 5, 7, and 9 the character replaces one lower-rank power with a newly unlocked rank. At levels 2, 4, 6, 8, and 10 one existing power gains its printed tier upgrade. Talents and shared skill/attribute progression remain as stated in §3.

Each level is divided into five printed benefit packets: HP; skill points; one power choice or upgrade; the level's class feature; and the scheduled talent/attribute benefit (or a second printed power upgrade on a level with neither). After each completed session or mission chapter, the player takes one **incremental advance** packet from the next level. Each packet can be taken once; taking the fifth increments the character's displayed level. A packet never grants access above the destination level's rank cap. This gives visible growth without asking the player to rebuild the character at every session.

Multiclassing costs a talent and permanently replaces one at-will choice, one `once_battle` or recharge choice, and one per-heal-up choice with choices from the second archetype. The secondary choices are treated as one rank lower until character level 5; they use their own class branch and cannot trigger both classes' signature state from one action. This is the cadence package's fixed hybrid price and makes a Battle Mage possible from level 1 without adding a second resource pool.

### 6.6 Strengths, costs, and likely failure mode

- **Strengths:** no generic power pool; escalation materially changes battle rhythm; every ability advertises exact availability; Rally keeps a wounded character active; per-heal-up pacing cannot be erased by repeatedly sleeping.
- **Costs:** the player tracks Recoveries, used powers, recharge results, and shared Escalation; classes are intentionally asymmetric and demand more authored content; early Full Heal-up requires a campaign-loss subsystem.
- **Likely failure mode:** cadence tags become a wall of icons and the class catalog becomes expensive to balance. The OGL lineage also carries the highest legal and product-copying risk of the three.

## 7. Worked builds and adversarial cases

### 7.1 Paladin who commands a garrison

Build: **Oathbound → Paladin (Aegis)**, Leadership 2 when the level cap permits, officer standing, and a separately recorded garrison asset. The Paladin's oath and protection mechanics remain the class loop. Leadership coordinates present troops; the garrison's Availability and encounter cost govern deployment. The same Paladin can command no one when the garrison is absent, and a Wizard with the same Leadership and asset can command battle mages without becoming a different class.

### 7.2 Wizard with a battle axe and Battle Mage

An **Arcanist → Wizard** can take `Weapon Training: heavy blades/axes` as a talent. That grants proficient Heavy attacks but no Armsmaster form, counter, health band, or advancement. A true **Battle Mage** pays the chosen variant's multiclass cost for Arcanist + Armsmaster. A **Berserker → Barbarian** remains distinct: its repeated decision is exposure and frenzy, not spell preparation plus forms. None can be obtained because prose says “battle mage” or “barbarian.”

### 7.3 Billionaire netbreaker or sponsor

Build: **Intruder → Netbreaker (Breaker)**, Technical training, opulent wealth, affiliated or officer corporate standing, and a corporation asset. In protected systems the character probes, builds Access, spends it, and manages Alert. In the wider campaign they can call transport, intelligence, gear, or personnel through asset actions, marking Availability and Duty. In a sealed dungeon with no communication or delivery path the corporation is unavailable, but the character's class skills and intrusion loop still function on locks, wards, devices, or local systems.

“Billionaire sponsor” alone is not a class. Any archetype can be opulent and own a sponsor asset. Its playstyle is strategic between scenes—spend limited asset availability to change preparation and access—while immediate encounter play still comes from the actual class.

### 7.4 Royal Inquisitive in a dungeon crawl

“Royal Inquisitive” is title, occupation, and standing, so it does not determine a class. Two coherent builds demonstrate the boundary:

- **Opportunist → Occult Sleuth (Mastery)** + Investigate + officer standing is an evidence expert who finds contradictions, creates noncombat advantages, and exploits openings in fights.
- **Oathbound → Witch Hunter (Judgment)** + Investigate + officer standing is a sworn combatant who marks a threat and protects the expedition while remaining competent with evidence.

The first fills expert/scout/face roles; the second fills defender/striker roles. The job title cannot conceal that mechanical choice.

### 7.5 Classless leadership, wealth, and vehicles

- An Arcanist can buy Leadership and command a battle-mage unit asset.
- An Intruder can be a billionaire.
- An Armsmaster can own and pilot a starship with Pilot skill, but owning it does not grant a Pilot class.
- A Maker Companion branch can have a class-owned construct because that construct is the chassis's exclusive bounded loop; an ordinary drone or pet remains an asset using the owner's action and Availability rules.

### 7.6 One rank-1 spell in all three packages

`Ember Lance` is an authored rank-1 Arcanist ability: Main action, Far range, one target, Reflex check, Standard harm on success.

- **Commitment:** the Formula Arcanist prepares it and consumes one daily casting. It always deals the current level band's Standard harm. It cannot be upcast or strengthened with Effort.
- **Slots and rests:** it consumes a rank-1 or higher slot. Its printed `higherSlot` table says rank 1–2 deals Standard harm to one target; rank 3–4 replaces that with Heavy harm to one target; rank 5 replaces it with Standard harm to two Near targets. No other improvement is legal.
- **Cadence:** it is `once_battle`. It deals Standard harm, upgraded to Heavy by its printed clause when Escalation is 3 or higher. It consumes no points and returns when the encounter closes.

The persistent help panel shows the applicable one of these complete rules. It never merely changes the resource's display name.

## 8. Engine and AI contract

For all variants:

- Authored catalogs own class IDs, branch IDs, skills, talents, proficiencies, abilities, effects, targets, costs, cadence, recovery, opposition curves, equipment, statuses, obligations, and asset actions.
- The AI may select a known opponent level, role, intent, difficulty tier, situational-delta IDs, ability ID, and legal effect target. The engine independently validates every selection and computes the result.
- The AI may write names and descriptive prose only in fields explicitly marked presentation-only. That prose cannot grant or suppress mechanics.
- A custom campaign selects a primary genre catalog explicitly. The AI does not infer one from the setting paragraph and cannot invent a class because a concept lacks a catalog match.
- Every campaign and character records exact version pins. Old catalogs remain loadable. A migration is a separate owner-approved operation with preview, validation, and player confirmation.
- Existing freeform/legacy characters stay on `legacy-generated-v1`. They are never auto-classified from prose. Moving one into a selected chassis requires an explicit rebuild that preserves the original record and needs player confirmation.

## 9. Licensing and deviation ledger

| Variant | Borrowed structural mechanics | House deviations | Adoption consequence |
|---|---|---|---|
| Commitment | WWN/CWN commitment timings; partial-class hybrids; prepared spell/casting separation; System Strain; Access/Alert | d100 roll-high checks, one honestly named Effort pool, nine archetypes, fixed harm, zones, async reactions, house effects | WWN/CWN SRDs are CC0. Capture the waiver with adopted source snapshot; courtesy credit is optional. Cleanest path. |
| Slots and rests | SRD 5.2.1 ranked slots, explicit upcasting, short/long rests, recovery-die structure, proficiency, level multiclassing | ten levels, d100, fixed recovery values, nine archetypes, house opposition/effects | CC-BY-4.0 attribution is mandatory and requires the owner's explicit adoption sign-off under `docs/ruleset-licensing.md`. Do not use protected brands or excluded lore. |
| Cadence | Escalation, recoveries, Rally, recharge/once-battle/per-heal-up cadence, Full Heal-up pacing, abstract position, incremental advances | d100 translation, authored campaign-loss catalog, nine archetypes, fixed harm, async reactions, house effects | Pelgrane's licensing page states the 13th Age SRD is Open Content under OGL 1.0a. Adoption would require the full OGL, an Open Game Content/Product Identity declaration, house-vocabulary review, and legal review. Highest license overhead and trust risk. |

Mechanics were paraphrased and reconciled to the signed house contracts; no donor class, spell, monster, setting, or explanatory text is proposed for copying. Primary references used for the structural comparison:

- WWN SRD: <https://wwn.quadrifons.com/>
- CWN SRD: <https://cwn.quadrifons.com/>
- SRD 5.2.1: <https://www.dndbeyond.com/srd>
- Pelgrane Archmage Engine licensing overview: <https://pelgranepress.com/2014/02/19/13th-age-archmage-engine-licensing-overview/>
- 13th Age open rules lineage: escalation, quick rests, Full Heal-ups, Rally, and action cadence from the SRD Open Content identified by that licensing page

## 10. Closed-package comparison

| Question | Commitment | Slots and rests | Cadence |
|---|---|---|---|
| What limits class abilities? | 2–5 Effort committed for exact durations; Arcanist castings remain separate | Ranked spell slots plus genuinely class-specific use counters | Authored at-will, once-battle, recharge, and per-heal-up tags; no power pool |
| What is the unique system mechanic? | A point can be unavailable without being spent; duration/turn/scene/day commitment creates opportunity cost | Slot rank is permission and cost; higher-rank casting changes only printed higher-slot rows | Escalation changes PC accuracy and unlocks powers as combat develops |
| Recovery pressure | Safe Recovery restores little HP and only 1 Strain; strong attrition | Short/Long Rest cadence; Long Rest full-heals | Recoveries and encounter-earned Full Heal-up; sleep alone does nothing |
| Creation / level-up load | Lowest | Highest for casters | Medium; power cards but no slot preparation for most classes |
| Class asymmetry | Medium | Medium-high | Highest |
| Hybrid build | Partial classes | Level multiclassing with delayed loop | Talent plus power-choice replacement |
| Counter count | HP, Effort, Strain; class-specific Access or castings where real | HP, Recoveries, slots/uses; most classes own a counter | HP, Recoveries, used cadence icons; Escalation shared |
| License fit | CC0, clean | CC-BY, owner attribution gate | OGL, legal/product overhead |
| Main balance risk | Scene commitment degenerates into ordinary encounter charges | Counter and rest proliferation | Content burden and cadence-icon overload |

## 11. Pre-review recommendation

**Retained as a pre-interaction ranking, not a paper selection.** The later text-entry audit adds
risk hypotheses, and the active playtest decision requires observed comparison before interaction
burden can admit, reject, or tier a mechanic. The ranking below remains the conclusion reached from
completeness, mechanical coherence, and licensing before player-facing interaction load was tested.

**Commitment is the strongest starting point.** It has the cleanest license, the shortest creation path, the smallest common resource surface, a proven hybrid-class answer, and a resource mechanic that is genuinely more than a themed mana name: commitment withholds capacity for an exact duration instead of buying an arbitrary effect magnitude. Arcanist castings, Intruder Access/Alert, forms, openings, and assets remain separate only where their state machines actually differ.

Cadence is the stronger choice if playtests value highly asymmetric class feel and escalating set-piece battles enough to accept a larger content and licensing burden. Slots and rests is the most familiar but recreates the largest version of the bookkeeping and recovery-negotiation problem that exposed the prototype's weakness.

This ranking is a design conclusion to test, not approval. The requested independent openreview should judge the whole comparison from the repository and may overturn it with evidence.
