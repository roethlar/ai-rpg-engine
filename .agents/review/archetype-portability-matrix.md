# Cross-genre archetype portability matrix

**Status**: SUPERSEDED AS THE ACTIVE WORKING DRAFT by
`.agents/review/archetype-portability-matrix-v2.md`; retained as v1 review evidence. No D3
decision or implementation authorization was created by either draft.

**Date**: 2026-07-27

**Scope**: Translate a saved character into a destination campaign's genre while preserving the
character's functional fantasy. This is the requested model in which a western gunslinger may
become a fantasy archer, a fantasy wizard may become a cyberpunk netrunner, and a rogue remains an
infiltration specialist whose tools change.

**Related durable contracts**:

- D0 keeps one versioned mechanical rulebook across campaigns; genre changes expression, not the
  underlying rules (`.agents/decisions.md`).
- D2 supplies the canonical engine-effect vocabulary (`docs/rules/effects.md`).
- D3 must settle the archetype boundary and the translation contract.
- D13 must later settle profile versions, legacy characters, campaign import, and branch semantics.
- The shipped product already stores reusable profiles and offers `existing` and `copy` campaign
  modes, but those modes currently carry archetype, attributes, inventory, abilities, and
  progression into the destination campaign verbatim. No genre translation exists yet
  (`public/index.html:285-306`, `rpg-engine.js:1095-1159`, `db.js:241-263`, `README.md:16`).

## 1. Working model

A portable character is not a fixed genre noun. It is a **functional kernel** plus a
**genre expression**.

The functional kernel says what playing the character feels like:

- primary and secondary party roles;
- signature actions and decisions;
- preferred range, tempo, and target pattern;
- relative competence and reliability;
- resource and risk cadence;
- dependencies such as gear, preparation, a companion, status, or an institution;
- characteristic weakness or tradeoff;
- advancement weight already earned; and
- any identity anchors the player marks as non-translatable.

The genre expression says how the destination world explains those functions:

- occupation or class name;
- weapon, implement, vehicle, or companion form;
- magic, training, technology, faith, mutation, wealth, or social authority as the power source;
- damage and condition language;
- organizations, credentials, and social position; and
- visual and narrative presentation.

The matrix is therefore not a lookup from one class name to one other class name. Each character is
one primary functional family plus zero to two secondary families, a source profile, and explicit
identity anchors. Genre translation maps that complete kernel.

## 2. Three distinct reuse modes

The product should not overload one operation with three incompatible meanings:

| Mode | Meaning | Mechanical treatment |
|---|---|---|
| **Continue** | The same person continues into a compatible campaign. | Keep sheet, abilities, equipment, injuries, and history literally unchanged. |
| **Branch** | Make an exact parallel copy of the current character. | Copy the current profile literally; subsequent progression diverges. This is closest to shipped `copy` behavior. |
| **Translate** | Create a destination-genre incarnation of the same player concept. | Preserve the functional kernel and progression weight; translate genre expression using this matrix; require player review before play. |

This artifact specifies **Translate** only. It does not decide whether shipped `existing` and `copy`
retain their current names or whether a new mode is added.

## 3. Translation invariants

### 3.1 Must survive unchanged

1. **Primary contribution**: damage, defense, control, investigation, access, influence, recovery,
   mobility, creation, or leadership does not silently change.
2. **Signature affordances**: if the player repeatedly solves problems at range, through stealth,
   by commanding allies, by transforming, or by manipulating a system, the destination version
   still offers those decisions.
3. **Range and target shape**: close versus ranged, single-target versus area, ally versus enemy,
   self versus environment, and direct versus indirect action remain stable.
4. **Tempo**: quick/repeatable, prepared, charged, reaction-based, once-per-scene, and
   long-ritual abilities retain their cadence.
5. **Cost and risk shape**: ammunition, mana, heat, strain, favor, exposure, cooldown, sacrifice,
   or companion risk may be renamed, but scarcity and decision pressure remain equivalent.
6. **Relative competence**: a defining mastery does not become ordinary familiarity, and a
   weakness does not become a strength.
7. **Agency structure**: a player-controlled companion, transformation, stance, prepared loadout,
   or choice menu cannot become passive flavor.
8. **Progression weight**: earned tier, purchased capability breadth, and specialization depth are
   preserved even when their names change.
9. **Player-marked anchors**: anything the player identifies as essential—actual magic, a beloved
   sentient companion, pacifism, a disability, an oath, a signature firearm—cannot be translated
   without an explicit choice.

### 3.2 May change automatically when the invariants hold

- class, occupation, and ability names;
- mundane tool or weapon form;
- visual effects and damage description;
- setting-specific credentials and organizations;
- resource names;
- currency and ordinary supply units; and
- background details that exist only to explain a translated capability and do not overwrite a
  player-marked identity anchor.

### 3.3 Never change silently

- primary or secondary functional family;
- attack range, area, scale, or action economy;
- reliable capability into situational permission;
- supernatural versus mundane source when the source is an identity anchor;
- a person or sentient companion into disposable equipment;
- bodily form, autonomy, morality, faith, or allegiance;
- a weakness, cost, taboo, oath, or dependency;
- signature-item provenance the player marked as important; or
- campaign history and relationships. A translated incarnation needs an explicit rule for whether
  those are adapted, archived as origin history, or omitted from destination canon.

## 4. Destination genre families

The columns below are genre families, not a closed campaign list. A campaign may combine a primary
family with modifiers such as comedic, romantic, military, horror, noir, cozy, epic, or
low-powered.

| Code | Genre family | Default capability assumptions |
|---|---|---|
| F | High fantasy / mythic | Open supernatural power, preindustrial tools, monsters, heroic professions |
| H | Grounded historical / low fantasy | Human-scale expertise, period tools, supernatural power absent or rare |
| G | Gothic / occult horror | Forbidden or costly supernatural power, investigation, vulnerability, secrecy |
| W | Western / frontier | Firearms, travel, law and outlaw status, sparse institutions, survival |
| M | Contemporary / crime / espionage | Modern tools, institutions, firearms, surveillance, covert access |
| P | Pulp / superhero / weird science | Exceptional individuals, gadgets or powers, heightened action |
| C | Cyberpunk / tech-noir | Networks, cyberware, corporations, surveillance, high technology and low trust |
| S | Space opera / science fiction | Space travel, energy weapons, alien science, psionics if campaign permits |
| A | Post-apocalypse / survival | Scarcity, salvage, mutation or relic technology, unstable communities |
| X | Surreal / cosmic / dreamlike | Symbolic causality, impossible spaces, reality alteration, unstable identity |

Strictly grounded campaigns use the H column's mundane expression. If a functional kernel has no
mundane equivalent without losing its signature affordances, translation stops for a player choice
instead of pretending an equivalence exists.

## 5. Functional archetype matrix

Each cell is a **candidate expression**, not an automatic class assignment. Names are deliberately
generic. The mechanical family named in the first column is the portable part.

### 5.1 Fantasy through contemporary

| Portable functional family | F — High fantasy | H — Historical / grounded | G — Gothic / occult | W — Western / frontier | M — Contemporary / crime |
|---|---|---|---|---|---|
| **1. Defender** — intercepts danger, protects others, holds space | Knight / guardian | Shield-bearer / man-at-arms | Monster warden | Lawkeeper / bodyguard | Bodyguard / tactical shield |
| **2. Bruiser** — absorbs punishment and applies force at close range | Barbarian / brawler | Berserker / pit fighter | Cursed brute | Saloon bruiser / enforcer | Enforcer / breacher |
| **3. Duelist** — mobile, precise close combat and counters | Swashbuckler / blade dancer | Fencer / weapon master | Vampire hunter | Quick-draw duelist / knife fighter | Close-quarters specialist |
| **4. Marksman** — precision ranged pressure and target selection | Archer / ranger | Archer / musketeer | Monster hunter | Gunslinger / sharpshooter | Sniper / tactical marksman |
| **5. Artillery** — costly area pressure, destruction, suppression | Battlemage / alchemist | Siege engineer | Relic hunter / exorcist arsenal | Dynamiter / heavy gunner | Heavy-weapons or demolition specialist |
| **6. Controller** — changes the field or manipulates an underlying system | Wizard / sorcerer | Strategist / alchemist | Occultist / ritualist | Mesmerist / gadgeteer | Hacker / operations controller |
| **7. Infiltrator** — stealth, access, theft, escape | Thief / shadow | Spy / cutpurse | Occult burglar / grave robber | Outlaw / cat burglar | Covert operative / burglar |
| **8. Saboteur** — traps, delayed effects, disabling infrastructure | Trapper / alchemical saboteur | Sapper | Hex-breaker / curse layer | Rail dynamiter / trapper | Bomb technician / infrastructure saboteur |
| **9. Scout** — reconnaissance, tracking, navigation, first contact | Ranger / pathfinder | Outrider / explorer | Monster tracker | Trail scout / bounty tracker | Recon or surveillance operative |
| **10. Investigator** — discovers hidden truth and reconstructs events | Inquisitive / sage | Magistrate / examiner | Occult detective | Marshal / bounty investigator | Detective / intelligence analyst |
| **11. Face** — negotiation, deception, access through people | Bard / courtier | Envoy / merchant | Medium / society charmer | Cardsharp / preacher | Negotiator / fixer |
| **12. Commander** — coordinates allies and controls team tempo | Warlord / captain | Officer / standard bearer | Secret-order leader | Posse leader | Handler / team lead |
| **13. Healer** — restores function, prevents loss, manages recovery | Cleric / herbalist | Physician / surgeon | Occult surgeon / exorcist-healer | Frontier doctor | Medic / therapist |
| **14. Inspirer** — changes morale, attention, or public feeling | Bard / skald | Orator / chronicler | Spiritualist / storyteller | Saloon performer / preacher | Journalist / performer / celebrity |
| **15. Maker** — builds, modifies, repairs, and prepares tools | Artificer / smith | Artisan / engineer | Relic maker / alchemist | Gunsmith / mechanic | Engineer / forensic technician |
| **16. Scholar** — deep knowledge, prediction, interpretation | Sage / oracle | Scholar / natural philosopher | Archivist / seer | Naturalist / chronicler | Researcher / profiler |
| **17. Handler** — gains capability through companions or delegated agents | Summoner / beastmaster | Houndmaster / falconer | Spirit medium | Rancher / animal handler | K9, informant, or drone handler |
| **18. Transformer** — changes body, mode, identity, or loadout | Druid / shapeshifter | Disguise master / adaptive fighter | Werebeast / body occultist | Disguise artist / skinwalker | Undercover mimic / experimental subject |
| **19. Pilot** — mastery of a mount, vehicle, or movement platform | Cavalier / ship captain | Rider / navigator | Occult conveyance master | Rider / stagecoach ace | Driver / aviator |
| **20. Survivor** — endures scarcity, hazards, and isolation | Adventurer / wilderness guide | Mercenary / guide | Grave survivor | Homesteader / prospector | Survivalist / first responder |
| **21. Patron** — converts status, wealth, or networks into action | Noble / guildmaster | Aristocrat / merchant prince | Cabal patron | Rancher / rail baron | Executive / crime boss |
| **22. Generalist** — adapts across several ordinary domains without a dominant specialty | Adventurer | Mercenary / traveler | Monster hunter | Drifter | Field agent |

### 5.2 Pulp through surreal

| Portable functional family | P — Pulp / superhero | C — Cyberpunk | S — Space opera / SF | A — Post-apocalypse | X — Surreal / cosmic |
|---|---|---|---|---|---|
| **1. Defender** | Armored hero / protector | Street samurai / corporate tank | Space marine / guardian | Wasteland enforcer | Reality anchor |
| **2. Bruiser** | Powerhouse | Chrome rager / gang heavy | Heavyworld brawler | Mutant berserker | Nightmare brute |
| **3. Duelist** | Masked swashbuckler | Monoblade runner | Energy-blade ace | Arena raider | Fate duelist |
| **4. Marksman** | Trick-shot hero | Smartgun ace | Blaster sharpshooter | Wasteland hunter | Impossible-angle shooter |
| **5. Artillery** | Energy projector / demolitions hero | Heavy-weapons cyborg | Weapons specialist / ship gunner | Scrap-cannon expert | Storm caller |
| **6. Controller** | Psychic / super-scientist | Netrunner | Psion / systems adept | Shaman / relic hacker | Dreamwalker |
| **7. Infiltrator** | Masked thief / spy | Ghost / intrusion specialist | Smuggler / infiltration operative | Scavenger / raider scout | Identity thief |
| **8. Saboteur** | Gadget saboteur | Intrusion and demolition specialist | Slicer / systems engineer | Trapmaker | Causality breaker |
| **9. Scout** | Aerial scout / explorer | Drone recon / urban tracker | Pathfinder / sensor specialist | Wasteland scout | Liminal guide |
| **10. Investigator** | Masked detective | Data investigator | Science officer / xeno-investigator | Relic seeker | Truth diver |
| **11. Face** | Celebrity / envoy | Fixer | Diplomat / first-contact envoy | Trader / settlement envoy | Herald |
| **12. Commander** | Team captain | Tactical coordinator | Squadron commander | Settlement chief | Chorus conductor |
| **13. Healer** | Regenerative hero / field doctor | Ripperdoc / medtech | Xenomedic | Field medic | Soul mender |
| **14. Inspirer** | Icon / broadcaster | Media influencer | Holo-star / cultural envoy | Tribe storyteller | Muse |
| **15. Maker** | Gadgeteer | Cybertech | Ship engineer | Scrap mechanic | Worldsmith |
| **16. Scholar** | Super-scientist | Data savant | Xenoarchaeologist | Lorekeeper | Oracle |
| **17. Handler** | Sidekick or beast commander | Drone-swarm operator | Droid or xenobeast handler | Mutant-beast tamer | Echo caller |
| **18. Transformer** | Shapeshifter | Body-mod specialist | Alien morph | Mutant | Dreamshaper |
| **19. Pilot** | Ace pilot | Rig jockey | Star pilot | Road warrior | Realm navigator |
| **20. Survivor** | Pulp explorer | Street survivor | Colonist | Scavenger | Castaway |
| **21. Patron** | Billionaire / sponsor | Corporate executive | Admiral / syndicate patron | Warlord | Fate broker |
| **22. Generalist** | Pulp adventurer | Operator | Spacer | Wanderer | Dimensional traveler |

## 6. Familiar classes as compositions

This table demonstrates why the functional families are not a new visible class list. Familiar
classes are compositions, and the destination genre can name the composition differently.

| Familiar concept | Primary family | Common secondary family or source |
|---|---|---|
| Alchemist | Maker | Artillery, Healer, or Controller |
| Assassin | Infiltrator | Duelist, Marksman, or Saboteur |
| Barbarian | Bruiser | Survivor or Transformer |
| Bard | Face | Inspirer, Scholar, or Controller |
| Beastmaster | Handler | Scout or Survivor |
| Bounty hunter | Scout or Investigator | Marksman or Face |
| Cleric | Healer | Commander or Scholar; faith/oath source |
| Druid | Controller | Transformer, Scout, or Handler; nature source |
| Fighter | Defender, Duelist, or Marksman | Commander or Generalist |
| Monk | Duelist | Controller or Defender; discipline source |
| Paladin | Defender | Commander or Healer; oath source |
| Ranger | Marksman | Scout, Survivor, or Handler |
| Rogue | Infiltrator | Duelist, Face, Investigator, or Saboteur |
| Sorcerer | Controller or Artillery | Transformer; innate-power source |
| Wizard | Controller | Scholar or Artillery; prepared-system source |
| Warlock | Controller | Patron or Handler; bargain/dependency source |
| Artificer | Maker | Controller or Artillery |
| Gunslinger | Marksman | Duelist |
| Detective | Investigator | Face or Infiltrator |
| Medic | Healer | Scholar or Survivor |
| Engineer | Maker | Scholar or Saboteur |
| Merchant | Patron | Face or Generalist |
| Necromancer | Handler | Controller or Scholar; death/ancestor source |
| Netrunner | Controller | Infiltrator or Scholar |
| Pilot | Pilot | Scout or Duelist |
| Priest | Face or Healer | Commander or Scholar; faith/institution source |
| Psion | Controller | Investigator or Artillery; psychic source |
| Spy | Infiltrator | Face or Investigator |
| Summoner | Handler | Controller |
| Shapeshifter | Transformer | Scout, Infiltrator, or Bruiser |
| Warlord | Commander | Defender or Patron |
| Witch | Controller | Scholar or Handler; occult/nature source |

Examples:

- A **western gunslinger** (`Marksman + Duelist`) becomes a fantasy archer, cyberpunk smartgun ace,
  or space-opera blaster sharpshooter. Precision, range, quick target switching, ammunition
  pressure, and the decisive-draw tempo survive.
- A **fantasy wizard** (`Controller + Scholar`, prepared-system source) becomes an occult ritualist,
  modern operations hacker, cyberpunk netrunner, space-opera systems adept, or surreal dreamwalker.
  Breadth, preparation, system access, control, and resource pressure survive.
- A **rogue** remains primarily an Infiltrator. Lockpicks may become forged credentials, burglary
  tools, a cyberdeck, security spikes, or scavenged bypass gear; stealth, access, opportunism, and
  escape remain.

## 7. Power-source translation matrix

A role says **what** the character contributes. A source says **why the fiction permits it**. Source
translation is safe only when it preserves the role invariants and the source is not a
player-marked identity anchor.

| Portable source pattern | Fantasy / occult expression | Grounded / frontier expression | Contemporary expression | Cyberpunk / space expression | Post-apocalyptic / surreal expression |
|---|---|---|---|---|---|
| **Training and technique** | Order, school, weapon discipline | Trade, military, apprenticeship | Professional training | Sim, doctrine, specialist training | Hard-won practice / remembered form |
| **Precision projectile** | Bow, crossbow, thrown weapon, wand | Bow, musket, revolver, rifle | Firearm or launcher | Smartgun, rail weapon, blaster | Scrap weapon, bio-projectile, impossible ray |
| **Prepared system manipulation** | Spellbook, runes, ritual formulae | Strategy, alchemy, engineering tables | Software, plans, operational access | Cyberdeck, expert system, psionic discipline | Relic interface, shamanic rite, dream grammar |
| **Faith, oath, or devotion** | Divine covenant, sacred order | Vow, community office, moral authority | Chaplaincy, cause, institution | AI covenant, ideology, interstellar order | Cult, ancestral duty, cosmic compact |
| **Psychic or exceptional perception** | Divination, second sight | Intuition, observation, mesmerism | Profiling, surveillance expertise | Neural sense, psionics, sensor fusion | Mutation, visions, reality sensitivity |
| **Nature and ecology** | Druidic bond, spirits, beasts | Fieldcraft, herbalism, husbandry | Ecology, wilderness training | Biohacking, xenobiology, habitat systems | Mutation ecology, wasteland lore |
| **Craft and technology** | Smithing, artificing, alchemy | Engineering, gunsmithing, mechanics | Electronics, medicine, fabrication | Cybertech, robotics, ship systems | Salvage craft, relic repair, world-shaping |
| **Body alteration** | Shapeshifting, blessing, curse | Disguise, conditioning, adaptive equipment | Experimental treatment | Cyberware, geneware, alien biology | Mutation, possession, dream-form |
| **Status and authority** | Crown, guild, temple, lineage | Rank, land, trade house | Office, wealth, law, organization | Corporation, syndicate, fleet, network | Settlement control, cult, fate claim |
| **Companion or delegated agent** | Familiar, summon, beast | Retainer, hound, mount | Informant, K9, team asset, drone | Drone, droid, AI, xenobeast | Mutant beast, spirit, echo |
| **Luck, fate, or preparation** | Blessing, prophecy, charm | Reputation, foresight, contingency | Planning, contacts, trained reflex | Predictive model, probability hack, precognition | Mutation luck, omen, causality bend |
| **Performance and attention** | Song, tale, glamour | Oratory, reputation, spectacle | Media, celebrity, persuasion | Influence feed, memetic craft, holo-performance | Tribal story, psychic resonance, living symbol |

### Source-anchor rule

The player must be able to mark the source itself as essential:

- “I care that she is a **real witch**, not merely that she controls encounters.”
- “The revolver inherited from her father is the character, not interchangeable ranged damage.”
- “This companion is a person with history, not a drone-shaped action token.”

When marked, translation offers:

1. a destination-compatible expression that retains the source literally;
2. a functional adaptation that changes the source; and
3. cancel translation or choose a different destination campaign.

The system never chooses among those on the player's behalf.

## 8. Tool and equipment equivalence matrix

Tool translation preserves the permission and dependency, not the noun or resale value.

| Function | Fantasy | Historical / frontier | Contemporary | Cyberpunk / space | Post-apocalyptic / surreal |
|---|---|---|---|---|---|
| Concealable ranged sidearm | Hand crossbow, wand, throwing knives | Pistol, compact bow | Handgun | Smart pistol, holdout blaster | Scrap pistol, thorn caster |
| Long-range precision weapon | Longbow, spell focus | Rifle, musket, longbow | Precision rifle | Rail rifle, beam rifle | Salvage rifle, bone bow |
| Fast close weapon | Short blade, staff | Saber, knife, club | Knife, baton | Monoblade, shock baton | Machete, living blade |
| Heavy area weapon | Alchemical charges, siege spell | Dynamite, cannon | Explosives, heavy launcher | Plasma projector, missile system | Scrap cannon, unstable relic |
| Protection | Mail, plate, ward | Armor, reinforced coat | Ballistic protection | Smart armor, exosuit, shield field | Patchwork armor, mutation shell |
| Access/bypass kit | Thieves' tools, runekey | Picks, forged papers | Picks, credentials, intrusion tools | Cyberdeck, security spike | Salvaged bypass kit, symbolic key |
| Prepared-system focus | Grimoire, runes, components | Formula book, maps, instruments | Laptop, case files, plans | Cyberdeck, neural archive, expert system | Relic codex, memory shrine |
| Knowledge repository | Library, scrolls | Journal, atlas, field notes | Databases, files | Mesh archive, ship library | Oral archive, recovered data, visions |
| Healing supply | Herbs, potion, holy kit | Doctor's bag, tonic | Trauma kit, medicine | Medkit, nanites, autodoc access | Salvaged medicine, symbiote |
| Companion | Familiar, beast, retainer | Hound, horse, hireling | Informant, K9, drone | AI, droid, drone, xenobeast | Mutant beast, spirit, echo |
| Personal transport | Mount, wagon, enchanted conveyance | Horse, coach, boat | Car, motorcycle, aircraft | Rig, grav-bike, shuttle, starship | Scrap vehicle, giant beast, portal |
| Communication | Messenger, sending token | Courier, signal lamp, telegraph | Phone, radio | Encrypted mesh, comm implant | Shortwave, psychic link |
| Surveillance | Familiar, scrying, scout | Spyglass, lookout, informant | Cameras, wiretap, drone | Sensor web, intrusion daemon | Scout beast, omen, relic sensor |
| Social leverage | Title, guild seal, favor | Rank, land, reputation | Office, money, credentials | Corporate access, reputation score | Settlement debt, cult standing |
| Restraint/control tool | Net, binding rune | Lasso, manacles | Restraints, chemical agent | Shock web, control program | Snare, mutation, dream binding |

Signature items are translated only after the player sees the exact old-to-new mapping. Ordinary
consumables can translate by function and scarcity band. Item provenance and end-of-fight condition
remain D13/D16 questions; this matrix does not silently erase them.

## 9. Resource and cost equivalence

Resource names may change; their gameplay pressure may not.

| Portable cost shape | Possible genre expressions | Required invariant |
|---|---|---|
| Depleting personal pool | Mana, focus, stamina, bandwidth, charge | Same relative uses before recovery |
| Ammunition / consumable | Arrows, bullets, components, charges, doses | Same scarcity and reload/resupply pressure |
| Heat / exposure | Suspicion, trace, corruption, instability, notoriety | Same escalation and consequence cadence |
| Preparation slots | Prepared spells, planned tricks, loaded programs, equipped modules | Same number and timing of loadout choices |
| Cooldown | Recharge, recovery, reboot, ritual reset | Same action/scene/world-time delay |
| Once per scene / session | Heroic effort, ace maneuver, emergency protocol | Same refresh boundary |
| Favor / debt | Divine favor, contacts, corporate credit, faction obligation | Same external dependency and repayment pressure |
| Health or bodily cost | Blood magic, overexertion, neural burn, mutation strain | Same severity and recovery burden |
| Companion risk | Familiar harm, retainer exposure, drone damage | Same action-economy benefit and meaningful risk |
| Environmental dependency | Moonlight, workshop, network access, zero gravity | Same frequency and predictability of availability |

A translation that turns a scarce signature move into an at-will action, or an at-will competence
into a rare consumable, fails even when the prose sounds appropriate.

## 10. Automatic, ask, and reject matrix

| Proposed change | Automatic candidate? | Player confirmation required? | May never be silent |
|---|---:|---:|---:|
| Rename class or occupation | Yes | At final translation review | — |
| Replace an ordinary tool with a genre-equivalent tool | Yes | At final translation review | — |
| Change visual or damage description with identical mechanical tags | Yes | At final translation review | — |
| Rename a resource while preserving cadence | Yes | At final translation review | — |
| Change power source not marked as an anchor | Candidate only | Yes | — |
| Change power source marked as an anchor | No | Explicit alternative selection | Yes |
| Change primary or secondary functional family | No | Explicit rebuild decision | Yes |
| Change close/ranged, single/area, ally/enemy, or direct/indirect profile | No | Explicit rebuild decision | Yes |
| Change cost, reliability, refresh, or action economy | No | Explicit rebuild decision | Yes |
| Change companion sentience or relationship | No | Explicit alternative selection | Yes |
| Change body, identity, faith, oath, morality, or allegiance | No | Explicit alternative selection | Yes |
| Translate world-specific biography or relationships | No | Explicit canon choice | Yes |
| Preserve earned progression weight under new names | Yes | Show before approval | — |
| Add a capability solely because the destination genre commonly has it | No | Explicit purchase/rebuild | Yes |
| Remove a capability because the destination genre lacks an obvious noun | No | Offer exception, adaptation, or cancel | Yes |

“Automatic candidate” means the engine may propose it. **No translated profile becomes playable
until the player approves the complete translation card.**

## 11. Worked transformations

### 11.1 Western gunslinger → high-fantasy archer

Portable kernel:

- `Marksman + Duelist`;
- precise ranged attacks, quick target changes, threatening initiative;
- ammunition pressure;
- vulnerable when pinned in close quarters; and
- signature inherited sidearm if the player marks it as an anchor.

Candidate translation:

| Origin | Destination |
|---|---|
| Gunslinger | Archer / bow duelist |
| Revolver | Recurve bow or repeating hand crossbow |
| Quick draw | Fast nock |
| Fan the hammer | Rapid volley |
| Called shot | Called shot |
| Bullets / reload | Arrows / readying |

If “actual firearm” is an anchor, the player may instead keep a rare firearm as a setting exception.

### 11.2 High-fantasy wizard → cyberpunk netrunner

Portable kernel:

- `Controller + Scholar`;
- broad prepared options;
- manipulates an underlying system rather than trading direct weapon attacks;
- high leverage with setup, access, and limited bandwidth;
- vulnerable when surprised or cut off from the required interface.

Candidate translation:

| Origin | Destination |
|---|---|
| Wizard | Netrunner |
| Spellbook | Cyberdeck and code library |
| Prepared spells | Loaded programs |
| Mana | Bandwidth / neural strain |
| Counterspell | Interrupt / counter-intrusion |
| Divination | Surveillance exploit / data query |
| Binding or terrain spell | Access control / environment override |

An unrestricted fireball has no honest netrunner equivalent in an unnetworked empty field. The
translation must either provide a separate physical-output tool, narrow it to connected
infrastructure, retain literal magic as a setting exception, or ask the player to replace it.

### 11.3 Rogue → cyberpunk infiltrator

Portable kernel:

- `Infiltrator` plus the character's chosen secondary family;
- stealth, access, opportunism, escape, and precision;
- gear-dependent bypass with strong mundane flexibility.

Candidate translation:

| Origin | Destination |
|---|---|
| Rogue / thief | Ghost / intrusion specialist |
| Lockpicks | Security kit and cyberdeck |
| Disguise kit | Identity forge |
| Daggers | Concealed monoblade or pistol |
| Thieves' contacts | Fixer and street network |
| Trap sense | Sensor and countermeasure awareness |

This is a low-risk translation because role, approach, and common tools already have close
equivalents.

### 11.4 Paladin → space-opera guardian

`Defender + Commander/Healer`; plate becomes powered armor, mount becomes shuttle or combat bike,
lay-on-hands becomes medtech or retained divine power, aura becomes command presence, and oath
remains an oath. Turning the oath into loyalty to a corporation or government is never automatic.

### 11.5 Druid → post-apocalyptic bio-shaper

`Controller + Transformer/Scout`; nature rites become ecological knowledge or mutation control,
wild shape becomes adaptive mutation, herbal recovery becomes field biochemistry, and an animal
companion becomes a wasteland beast. If sacred nature or literal spirits are anchors, those remain
literal or require a player choice.

### 11.6 Bard → contemporary media operator

`Face + Inspirer`; performance remains performance, inspiration becomes morale/public attention,
charm becomes persuasion or reputation access, and lore becomes research and cultural fluency.
Mind control cannot be silently reduced to ordinary persuasion.

### 11.7 Netrunner → high-fantasy rune mage

`Controller + Infiltrator/Scholar`; cyberdeck becomes grimoire or rune kit, programs become prepared
runes, network access becomes ley-line/ward access, trace becomes magical attention, and intrusion
becomes ward-breaking. Capabilities that depended on ubiquitous connectivity need an explicit
destination access rule.

### 11.8 Star pilot → grounded noir

`Pilot + Scout/Duelist` has no honest translation if piloting a large vehicle is the signature loop
and the destination campaign offers no meaningful vehicles. Candidate adaptations include getaway
driver, aviator, boat captain, or surveillance operator. If none preserves the play loop,
translation stops rather than collapsing the character into a generic detective.

## 12. Edge cases

### 12.1 No honest equivalent

Offer exactly three paths:

1. **Setting exception** — retain the source literally and let the character be unusual.
2. **Functional adaptation** — preserve the kernel through a different source, with the precise
   losses and gains shown.
3. **Cancel or rebuild** — do not force the character into the destination.

### 12.2 Hybrid genres

Translate against the primary genre family, then apply secondary-genre vocabulary. Mechanical
invariants are checked after composition. “Cyberpunk western” may use the cyberpunk tool column and
western occupations; it does not average or randomly choose between them.

### 12.3 Composite characters

Translate primary and secondary families separately, then validate the combined action economy,
resource budget, and identity anchors. A `Marksman + Controller` must not emerge as two unrelated
full-strength classes or lose one half because a single familiar label was selected.

### 12.4 Scale mismatch

A starship commander, kaiju handler, realm-shaping mage, or billionaire patron operates at a scale
that a street-level destination may not support. Scale is an invariant. The player must choose a
smaller-scope incarnation, a campaign exception, or no translation.

### 12.5 Companion translation

Preserve whether the companion is sentient, independent, vulnerable, replaceable, and
player-controlled. Familiar → drone is not safe when the familiar is a person; horse → motorcycle
is not safe when the bond itself is a signature relationship.

### 12.6 Institution and morality

Translate functional access, not allegiance. Paladin → corporate security officer, cleric →
political operative, or noble → crime boss may violate the character's ethics even when the
mechanical access pattern fits.

### 12.7 Inventory and history

Ordinary gear may translate by function. Signature items, injuries, wealth, NPC relationships,
location history, and provenance require D13/D16 policy. Until that policy exists, the matrix must
not claim that a complete character has translated merely because abilities did.

### 12.8 Late joiners

A late joiner translates against the campaign's already-pinned genre expression. The operation may
not regenerate or alter the campaign's established vocabulary for existing characters.

## 13. Player-visible translation card

The matrix prevents hidden guessing only if the player sees the result before play. A translation
card should state, in plain language:

1. **Your role remains**: primary and secondary functional families.
2. **You can still**: the three to six signature affordances preserved.
3. **These changed expression**: every class, ability, tool, source, and resource old → new.
4. **These did not translate cleanly**: losses, narrowed permissions, or environmental
   dependencies—never buried.
5. **These are identity-anchor choices**: alternatives requiring the player's ruling.
6. **Your costs and limits remain**: cadence, scarcity, weakness, and recovery.
7. **Your progression carries as**: tier and capability weight.

Available outcomes are **Approve**, **Choose an offered alternative**, **Revise an anchor**, or
**Cancel**. There is no “accept silently and discover the mismatch during play” path.

## 14. Acceptance examples for an eventual design

This is evidence for later planning, not an approved test suite.

1. Gunslinger → fantasy preserves ranged precision, quick-draw tempo, ammunition pressure, and
   close-range weakness as an archer.
2. Wizard → cyberpunk preserves prepared breadth, control, access dependence, and resource pressure
   as a netrunner, while flagging unnetworked physical effects.
3. Rogue → every genre remains an Infiltrator unless the player explicitly rebuilds.
4. Healer → every genre retains recovery/prevention rather than becoming generic support.
5. Summoner → handler preserves companion action economy and relationship semantics.
6. Pilot → a destination without meaningful vehicles stops for a choice.
7. A source marked “literal magic” never becomes technology without explicit selection.
8. Translation never increases uses, scale, target count, or reliability merely because the new
   genre expression suggests it.
9. Two characters with the same functional kernel may receive different expression because their
   identity anchors differ.
10. A late joiner's translation never changes the campaign's established genre vocabulary.

## 15. Owner review focus

The matrix is ready to review on these axes:

- Are the 22 functional families complete enough, or are any distinct play fantasies collapsed?
- Do the ten genre families cover the engine's intended range without pretending to enumerate
  every setting?
- Is `primary + up to two secondary families` the right composition boundary?
- Should power source be freely translatable by default, or always require approval?
- Does portability mean a new **Translate** branch, or should current `existing` reuse translate?
- Which non-ability state—inventory, injuries, wealth, relationships, history—belongs to the
  portable kernel?

No answer is inferred from silence. Owner rulings should be taken one at a time and recorded in
`.agents/decisions.md` before this becomes canonical rules guidance.
