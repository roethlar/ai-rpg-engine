# Cross-genre character portability — v3

**Status**: SUPERSEDED by `.agents/review/archetype-portability-matrix-v3.1.md`; retained as
evidence. Independent review accepted the immutable-mechanics thesis and admitted nine findings
against this draft — most importantly that a single shared lexicon cannot represent two characters
(§5), that its requirement filter could not encode its own seed tables (§6.2), and that its
"Stage 1 is mechanically risk-free" claim is false because the ruleset sheet is the adjudicating
model's canon rulebook (`rpg-prompts.js:101-109`). Do not implement from this file.

**Original status**: DRAFT v3 for owner review. Authorizes no product-code change. D3 remains
unruled; this document proposes a different architecture from v2 and asks for a ruling on the
difference.

**Date**: 2026-07-27

**Supersedes as the active working draft**: `.agents/review/archetype-portability-matrix-v2.md`.
The v1 draft, the independent review, and v2 remain evidence.

**Relationship to v2**: v3 keeps v2's product promise, its three reuse modes, its player-approval
discipline, its anchors-must-be-explicit rule, and its guard cases. It replaces v2's central
mechanism — a per-candidate mechanical-equivalence proof over a derived fingerprint — with an
identity-preserving design in which the mechanical record does not change at all. The rest of the
plan simplifies as a consequence.

---

## 1. Bottom line: what v3 changes and why

Six changes. Each is a correction to something v2 got wrong or left unbuilt, not a restyling.

| # | v2 | v3 | Why |
|---|---|---|---|
| 1 | Translation generates a destination candidate, then proves it mechanically equivalent to the source via a normalized fingerprint | Translation copies the mechanical record **verbatim** and rebinds only a display layer | v2's fingerprint is either trivially preserved (the candidate reused the same template refs, so the proof machinery proved a rename) or impossible to preserve (the candidate used different ops, so every interesting case returns `incompatible`). D0 already guarantees one chassis across campaigns, so there is nothing to prove: mechanics that never change are equivalent by construction (§3) |
| 2 | Kernel defines its own `reach` / `targetShape` / `delivery` / `tempo` / `setup` enums and a `costShapeRef` | Kernel stores **no** mechanical vocabulary of its own; it references the ability record's existing D5 packaging by id | v2 admits these are placeholders until D6 settles spatial vocabulary, then makes them normative fingerprint inputs — guaranteeing a second range vocabulary that will conflict with D6 and violating one-canonical-location (§4.3) |
| 3 | Three separate matrices (families × genres, power sources × genres, tools × genres) as reference prose | One **campaign-owned Genre Lexicon**: stable slot keys → destination nouns, with the three matrices as seed rows for one mechanism | Makes the matrix an artifact the engine holds rather than a document humans consult, and structurally solves late-joiner consistency that v2 handles with a rule (§5) |
| 4 | "No honest equivalent" is a prose judgment about environmental permissions | A **capability declaration** on the destination campaign plus requirement tags on lexicon candidates; no-honest-equivalent is exactly *the filtered candidate set for a slot is empty* | Decidable by the engine with no model judgment, and it explains every one of v2's hard cases with one rule (§6) |
| 5 | Plan ends at commit; nothing about how the GM speaks | A **narration binding**: the lexicon is the campaign's naming authority in council context, source vocabulary is excluded, and leakage is testable | This is an LLM-led RPG. If the narrator reverts to source-genre nouns on turn 12, the translation failed regardless of what the database holds. v2 has no contract here at all (§9) |
| 6 | Blocked behind D3-A, D3-B, D3-C, D5, and D13/D16 | **Stage 1 ships against today's free-text abilities with no rules-queue dependency**; the strict machinery arrives with D5 | Today's abilities carry no engine-executed mechanics, so today is the *safest* moment to translate expression — nothing mechanical can break. v2 defers the cheap, safe 80% behind five rulings it does not need (§11) |

Two things v3 also settles that v2 explicitly deferred: character **name and origin history** (§10),
and the fact that today's ability identity is the display name itself, which translation would
silently break (§4.4).

---

## 2. Grounding: what actually ships today

Verified at working-tree head, this session.

- **Genre is free text**, not a picklist: one input box, "Describe any setting you want"
  (`public/index.html:279-282`). The ten genre families in §5.3 are therefore a **classifier
  target**, never a menu. v2's column headers silently assume a closed set the product does not
  have.
- **There are two unrelated ability surfaces**, and neither v1 nor v2 notices:
  - *campaign ruleset abilities* — `{name, cost, effect, limits}`, all free text, generated once
    per campaign by the Setup role and stored as canon (`rpg-state.js:745-773`,
    `rpg-engine.js:1124-1151`);
  - *character profile abilities* — `{name, description, tier, source}`, also free text, grown
    during play by `ability_updates` (`rpg-engine.js:110-115`, `rpg-engine.js:118-148`).
- **Ability identity is the lowercased display name** (`rpg-engine.js:127`). Rename an ability and
  the engine treats it as a different ability.
- **Reuse and copy carry the character verbatim** — attributes, inventory, abilities, progression
  (`rpg-engine.js:1153-1159`, `rpg-engine.js:2086-2099`) — into a campaign whose ruleset was
  regenerated **for the new genre from the archetype string alone** (`rpg-engine.js:1143`). The
  destination rule sheet never sees the incoming character's actual abilities.
- Profiles persist archetype, attributes, inventory, abilities, progression, checkout state, and
  lineage (`db.js:240-265`); campaigns persist genre and a generated `ruleset_json`
  (`db.js:92-95`, `db.js:121`).

**The shipped defect, stated precisely**: the engine *already* re-expresses the rules for each new
genre. It simply does not know it is re-expressing *the same character*. A western gunslinger
entering a fantasy campaign gets a fantasy rule sheet describing abilities that are not hers,
alongside her own untranslated revolver abilities. That is a smaller and more tractable gap than
"no translation exists," and it is the gap Stage 1 closes.

### 2.1 Durable constraints

- **D0**: one bespoke versioned rulebook; campaigns change flavor, not mechanics.
- **D2** (catalog signed 2026-07-27): abilities select operations from the Chapter 2 catalog and
  never invent mechanics inline (`docs/rules/effects.md` §5).
- Chapter 2 §5 leaves ability **packaging** — costs, targeting, cooldowns, archetype assignment,
  the ability authorizer, and the `foe`-binding opposition-affirmation carrier — to D3/D5.
- Engine owns numbers, state transitions, validation, and canonical records. Models emit bounded
  identifiers, enums, and player-facing expression.

---

## 3. Thesis: mechanics do not translate, because they do not change

D0 says one rulebook across all campaigns. Chapter 2 says abilities are selections from a
versioned catalog. Put those together and a cross-genre move **cannot** change mechanics: the same
catalog is in force on both sides.

v2 nonetheless built an apparatus to generate a destination candidate and then prove it equivalent
to the source. That apparatus has no stable operating point:

- If the destination candidate reuses the source's effect templates — which it must, when both
  campaigns pin the same catalog version — then the fingerprint is preserved trivially and the
  proof proved a rename.
- If the destination candidate selects different operations, the fingerprint cannot match, and
  §6.2's rule sends it to `incompatible`. Every genuinely interesting translation lands here.

So v2's machinery is elaborate in the cases where it is unnecessary and refuses the cases where it
would matter.

**v3's rule**: Translate copies the character's mechanical record byte-for-byte and produces a
separate, per-campaign **expression binding**. Equivalence is not proven; it is structural. The
translation card shows the player what changed, and what changed is only ever nouns and prose.

Two problems remain, and they are the real ones:

1. **Naming** — the destination world needs its own words for this character's role, power source,
   implements, resources, and abilities, used consistently by every system that speaks to the
   player. → the **Genre Lexicon** (§5).
2. **Permission** — the destination fiction may not host the shape at all: no networks for a
   netrunner, no vehicles for a pilot, no sentient companions for a handler. → the **capability
   declaration** (§6).

Everything v2 called "no honest equivalent" is problem 2. Nothing about it is a mechanical
equivalence question.

### 3.1 When mechanics genuinely must change

Three cases, all explicitly outside Translate:

| Case | Disposition |
|---|---|
| Destination campaign pins a different `catalog_version` | Not translatable. Chapter 2 §1.1 makes version change an owner-approved migration; two catalogs are never live at once. Offer Branch-into-a-same-version campaign, or cancel |
| A slot has no legal candidate under the destination's capability declaration and the player will not pin it | **Rebuild** — a separate, future, player-driven respec flow. Translate never silently narrows |
| The player wants different mechanics | Rebuild. This is a feature request, not a translation |

Naming these as rebuild is not a limitation v3 introduces. It is D0, restated honestly.

---

## 4. The three artifacts

### 4.1 Campaign capability declaration (per campaign, engine-typed)

A small fixed set of axes describing what the destination fiction can host. Proposed by the model
at campaign creation from the free-text genre string, typed and stored by the engine, shown to the
player, editable by the host. See §6.

### 4.2 Campaign genre lexicon (per campaign, engine-owned)

A map from **stable slot keys** to destination nouns and prose, plus each entry's requirement tags
and provenance. Generated once per campaign; every character in that campaign binds to it. See §5.

### 4.3 Character identity record (per profile)

Three layers, with strict ownership:

```
mechanics    — the ability records, packaging, progression, attributes.
               Owned by the engine and the D5 contract.
               COPIED VERBATIM BY TRANSLATE. Never re-derived, never re-validated
               against a "candidate", never model-touched.

expression   — per-campaign binding: slotKey -> lexicon entry, for every slot this
               character occupies. Owned by the destination campaign's lexicon.
               THE ONLY THING TRANSLATE PRODUCES.

pins         — the player's non-negotiables, expressed as pinned slots.
               Owned by the player. See §7.
```

The kernel — v2's central data structure — shrinks to this, and stores **no mechanical vocabulary
of its own**:

```json
{
  "schemaVersion": 1,
  "abilityIds": ["engine-issued stable ids; mechanics live on the ability records"],
  "families": { "primary": "marksman", "secondary": ["duelist"] },
  "slots": ["role", "source:precision-projectile", "implement:sidearm",
            "implement:long-range", "resource:ammunition", "identity:name",
            "identity:origin", "ability:a41", "ability:a42"],
  "pins": [
    { "slot": "implement:sidearm", "reason": "Inherited from her father",
      "policy": "literal" }
  ],
  "provenance": { "originCampaignId": 12, "originGenre": "Weird West frontier" }
}
```

Note what is *absent* versus v2: no `actionShape`, no `reach`/`targetShape`/`delivery`/`tempo`/
`setup` enums, no `costShapeRef`, no `reliabilityBand`, no `dependencyRefs`, no fingerprint. Those
either already exist on the ability record (D5's packaging) or belong to D6's spatial vocabulary.
v2 would have created a second, drifting copy of both. The kernel's job is to name **which slots
this character occupies** and **which the player has pinned** — nothing more.

### 4.4 Required precondition: ability identity must stop being the display name

Today `applyAbilityUpdates` matches abilities by `name.toLowerCase()` (`rpg-engine.js:127`). Under
any translation design, renaming *is* the operation, so name-keyed identity breaks the moment a
translated character levels up: the destination's "Fast Nock" and the profile's "Quick Draw" are
two abilities, and the character silently accumulates both.

v2 does not notice this. It is a hard precondition, not a nicety:

- profile abilities gain a stable engine-issued `id`;
- `applyAbilityUpdates` matches on `id`, falling back to name only for legacy rows with no id;
- display names move into the lexicon, keyed `ability:<id>`.

This lands in Stage 1 (§11) and is independently testable.

---

## 5. The genre lexicon

### 5.1 Slot model

A **slot** is a stable key naming something the destination world must have a word for. A
**binding** attaches a destination noun (plus optional prose) to that key.

```json
{
  "campaignId": 41,
  "lexiconVersion": 1,
  "genreClass": "F",
  "entries": [
    { "slot": "role", "value": "Longbow ranger",
      "requires": [], "provenance": "model", "pinned": false },
    { "slot": "source:precision-projectile", "value": "Yew-bow discipline of the March",
      "requires": [], "provenance": "model", "pinned": false },
    { "slot": "implement:sidearm", "value": "Repeating hand crossbow",
      "requires": [], "provenance": "model", "pinned": false },
    { "slot": "resource:ammunition", "value": "Arrows",
      "requires": [], "provenance": "seed", "pinned": false },
    { "slot": "ability:a41", "value": "Fast Nock",
      "prose": "She has an arrow away before the string stops humming.",
      "requires": [], "provenance": "model", "pinned": false }
  ]
}
```

### 5.2 Slot taxonomy

| Slot family | Key form | Seeded from | Notes |
|---|---|---|---|
| Role name | `role` | §5.4 family × genre matrix | What people in this world call this person |
| Power source | `source:<pattern>` | §5.5 source matrix | Why the fiction permits the character's capabilities |
| Implement | `implement:<function>` | §5.6 tool matrix | Nouns for tools, by function — never by resale value |
| Resource | `resource:<cost-shape>` | §5.7 cost matrix | Renames only; cadence is mechanics and does not move |
| Ability | `ability:<abilityId>` | model, per character | Display name plus flavor prose for one ability record |
| Institution | `institution` | genre family defaults | Orders, guilds, corps, agencies, cabals |
| Damage language | `damage-language` | genre family defaults | How harm reads in narration |
| Identity | `identity:name`, `identity:appearance`, `identity:origin` | source profile | **Pinned by default** (§10) |

One mechanism replaces v2's three parallel matrices. A slot key is stable across every campaign;
only its binding changes.

### 5.3 Genre classes

Free-text genre is classified into one primary class (plus free modifiers for tone) purely to
select seed rows and capability defaults. Misclassification is recoverable — the player sees and
can edit the resulting lexicon.

| Code | Genre class | Default expression assumptions |
|---|---|---|
| F | High fantasy / mythic | Open supernatural power, preindustrial tools, monsters, heroic professions |
| H | Grounded historical / low fantasy | Human-scale expertise, period tools, supernatural absent or rare |
| G | Gothic / occult horror | Forbidden and costly supernatural power, secrecy, investigation, vulnerability |
| W | Western / frontier | Firearms, travel, law and outlaw status, sparse institutions, survival |
| M | Contemporary / crime / espionage | Modern tools, institutions, firearms, surveillance, covert access |
| P | Pulp / superhero / weird science | Exceptional individuals, gadgets or powers, heightened action |
| C | Cyberpunk / tech-noir | Networks, cyberware, corporations, surveillance, high technology and low trust |
| S | Space opera / science fiction | Space travel, energy weapons, alien science, campaign-permitted psionics |
| A | Post-apocalypse / survival | Scarcity, salvage, mutation and relic technology, unstable communities |
| X | Surreal / cosmic / dreamlike | Symbolic causality, impossible spaces, reality alteration, unstable identity |

Hybrids pick one primary class for capability defaults and take vocabulary modifiers from the
others. A "cyberpunk western" is C for capabilities with W vocabulary; it never averages the two.

### 5.4 Seed rows: `role` slot, by functional family

The 22 families are **internal engine vocabulary**. They are never a player-facing pick list. They
do exactly two jobs: they are the lookup key for `role` seed rows, and they supply the card's
recognition line ("you are still the one who…", from the decision-loop column). Translate derives
them from the source profile and never asks the player to choose.

| Id | Family | Defining player decision loop | Must not collapse into |
|---:|---|---|---|
| 1 | Defender | Choose whom or what to protect; trade position and exposure to intercept or deny danger | Bruiser's personal force and durability |
| 2 | Bruiser | Commit at close range; trade safety or finesse for force and staying power | Defender's ally protection |
| 3 | Duelist | Manage movement, timing, counters, and one priority opponent | Marksman's ranged target control |
| 4 | Marksman | Select priority targets and firing windows while managing range and ammunition | Generic damage dealer |
| 5 | Artillery | Spend scarce setup or resources for area pressure, destruction, or suppression | Controller's field manipulation without destructive payoff |
| 6 | Controller | Alter available choices, terrain, access, status, or an underlying system through setup | Artillery's area damage |
| 7 | Infiltrator | Cross a guarded boundary, stay undetected, exploit access, escape | Scout's advance information; Saboteur's delayed change |
| 8 | Saboteur | Prepare, conceal, and trigger delayed disruption against a system or place | Infiltrator's immediate access |
| 9 | Scout | Learn routes, threats, positions, and opportunities before commitment | Investigator's reconstruction of hidden truth |
| 10 | Investigator | Gather and connect evidence to reveal a hidden fact, cause, or actor | Scholar's application of established knowledge |
| 11 | Face | Choose a targeted approach, leverage, and concession with a person or small group | Inspirer's group morale and attention |
| 12 | Commander | Allocate present allies, timing, formation, and immediate team tempo | Patron's off-scene resources and status |
| 13 | Healer | Triage prevention, stabilization, recovery, and scarce care | Generic buff and support |
| 14 | Inspirer | Shape group morale, attention, emotion, or public feeling through expression | Face's targeted negotiation |
| 15 | Maker | Prepare, build, repair, or modify concrete capabilities and tools | Scholar's advice without creation |
| 16 | Scholar | Apply established expertise to interpret, predict, or advise within a domain | Investigator's evidence-driven revelation |
| 17 | Handler | Direct a distinct companion or agent, sharing action economy, risk, and positioning | A cosmetic pet or disposable tool |
| 18 | Transformer | Choose between mechanically distinct body, identity, stance, or loadout modes | A single passive bonus |
| 19 | Pilot | Control a meaningful mount, vehicle, or platform whose position and risk drive decisions | Ordinary travel proficiency |
| 20 | Survivor | Allocate supplies, adapt to hazards, and continue under scarcity or isolation | Scout's information role |
| 21 | Patron | Call on wealth, status, institutions, or networks while incurring limits and obligations | Commander's present-team control |
| 22 | Generalist | Cover an unfilled ordinary need at a lower ceiling than a specialist | A best-of-everything build |

Generalist is package-only and provisional; it may never justify an open pick-anything build.

**`role` seed rows — F through M:**

| Family | F | H | G | W | M |
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

**`role` seed rows — P through X:**

| Family | P | C | S | A | X |
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

Seed rows are candidates, not assignments. The generator may propose a better campaign-specific
noun; the player approves what lands.

### 5.5 Seed rows: `source:<pattern>` slot

A family says which decisions the character contributes. A source says why the fiction permits
them. The `requires` column is what §6 filters on.

| Source pattern | Fantasy / occult | Grounded / frontier | Contemporary | Cyberpunk / space | Post-apoc / surreal | Requires |
|---|---|---|---|---|---|---|
| `training` | Order, school, weapon discipline | Trade, military, apprenticeship | Professional training | Sim, doctrine, specialist training | Hard-won practice | — |
| `precision-projectile` | Bow, crossbow, wand | Bow, musket, revolver, rifle | Firearm / launcher | Smartgun, rail weapon, blaster | Scrap weapon, bio-projectile | — |
| `prepared-system` | Spellbook, runes, ritual formulae | Strategy, alchemy, engineering tables | Software, plans, operational access | Cyberdeck, expert system, psionic discipline | Relic interface, rite, dream grammar | `supernatural ≥ rare` **or** `networks ≥ local` |
| `faith-oath` | Divine covenant, sacred order | Vow, community office, moral authority | Chaplaincy, cause, institution | AI covenant, ideology, interstellar order | Cult, ancestral duty, cosmic compact | `institutions ≥ local` |
| `psychic-perception` | Divination, second sight | Intuition, observation, mesmerism | Profiling, surveillance expertise | Neural sense, psionics, sensor fusion | Mutation, visions, reality sensitivity | `supernatural ≥ rare` **or** `technology ≥ modern` |
| `nature-ecology` | Druidic bond, spirits, beasts | Fieldcraft, herbalism, husbandry | Ecology, wilderness training | Biohacking, xenobiology, habitat systems | Mutation ecology, wasteland lore | — |
| `craft-technology` | Smithing, artificing, alchemy | Engineering, gunsmithing, mechanics | Electronics, medicine, fabrication | Cybertech, robotics, ship systems | Salvage craft, relic repair | — |
| `body-alteration` | Shapeshifting, blessing, curse | Disguise, conditioning, adaptive equipment | Experimental treatment | Cyberware, geneware, alien biology | Mutation, possession, dream-form | `identity ≥ mutable` **or** `supernatural ≥ rare` **or** `technology ≥ advanced` |
| `status-authority` | Crown, guild, temple, lineage | Rank, land, trade house | Office, wealth, law, organization | Corporation, syndicate, fleet | Settlement control, cult, fate claim | `institutions ≥ local` |
| `companion-agent` | Familiar, summon, beast | Retainer, hound, mount | Informant, K9, drone | Drone, droid, AI, xenobeast | Mutant beast, spirit, echo | see §6.2 for the sentience axis |
| `luck-fate` | Blessing, prophecy, charm | Reputation, foresight, contingency | Planning, contacts, trained reflex | Predictive model, probability hack | Mutation luck, omen, causality bend | — |
| `performance` | Song, tale, glamour | Oratory, reputation, spectacle | Media, celebrity, persuasion | Influence feed, memetic craft | Tribal story, psychic resonance | — |

### 5.6 Seed rows: `implement:<function>` slot

Tool translation preserves function, dependency, and scarcity — never the noun or resale value.

| Function key | Fantasy | Historical / frontier | Contemporary | Cyberpunk / space | Post-apoc / surreal | Requires |
|---|---|---|---|---|---|---|
| `sidearm` | Hand crossbow, wand, throwing knives | Pistol, compact bow | Handgun | Smart pistol, holdout blaster | Scrap pistol, thorn caster | — |
| `long-range` | Longbow, spell focus | Rifle, musket, longbow | Precision rifle | Rail rifle, beam rifle | Salvage rifle, bone bow | — |
| `close-weapon` | Short blade, staff | Saber, knife, club | Knife, baton | Monoblade, shock baton | Machete, living blade | — |
| `area-implement` | Alchemical charges, siege focus | Dynamite, cannon | Explosives, heavy launcher | Plasma projector, missile system | Scrap cannon, unstable relic | — |
| `protection` | Mail, plate, ward | Armor, reinforced coat | Ballistic protection | Smart armor, exosuit, shield field | Patchwork armor, mutation shell | — |
| `bypass-kit` | Thieves' tools, runekey | Picks, forged papers | Credentials, intrusion tools | Cyberdeck, security spike | Salvaged bypass kit, symbolic key | — |
| `prepared-focus` | Grimoire, runes, components | Formula book, maps, instruments | Laptop, case files, plans | Cyberdeck, neural archive | Relic codex, memory shrine | inherits `prepared-system` |
| `healing-supply` | Herbs, potion, holy kit | Doctor's bag, tonic | Trauma kit, medicine | Medkit, nanites, autodoc | Salvaged medicine, symbiote | — |
| `companion` | Familiar, beast, retainer | Hound, horse, hireling | Informant, K9, drone | AI, droid, drone, xenobeast | Mutant beast, spirit, echo | `companions` axis, §6.2 |
| `transport` | Mount, wagon, enchanted conveyance | Horse, coach, boat | Car, motorcycle, aircraft | Rig, grav-bike, shuttle, starship | Scrap vehicle, giant beast, portal | `vehicles ≥ incidental` |
| `platform` | Warhorse, war galley | Cavalry mount, ship | Pursuit vehicle, helicopter | Rig, fighter, starship | War rig, colossus | **`vehicles = central`** |
| `communication` | Messenger, sending token | Courier, signal lamp, telegraph | Phone, radio | Encrypted mesh, comm implant | Shortwave, psychic link | — |
| `surveillance` | Familiar, scrying, scout | Spyglass, lookout, informant | Cameras, wiretap, drone | Sensor web, intrusion daemon | Scout beast, omen, relic sensor | — |
| `social-leverage` | Title, guild seal, favor | Rank, land, reputation | Office, money, credentials | Corporate access, reputation score | Settlement debt, cult standing | `institutions ≥ local` |
| `restraint` | Net, binding rune | Lasso, manacles | Restraints, chemical agent | Shock web, control program | Snare, mutation, dream binding | — |

`transport` and `platform` are deliberately distinct. A Pilot needs `platform` — a vehicle whose
position and risk drive decisions. Ordinary travel needs only `transport`. v2 collapsed these and
then needed a prose rule to recover the distinction.

### 5.7 Seed rows: `resource:<cost-shape>` slot

Renaming a resource is expression. Changing how often the character can act is mechanics, and
mechanics do not move.

| Cost shape | Candidate names | Invariant (structural under v3 — the record is unchanged) |
|---|---|---|
| `pool` | Mana, focus, stamina, bandwidth, charge | Same uses before recovery |
| `ammunition` | Arrows, bullets, components, charges, doses | Same scarcity and resupply pressure |
| `heat` | Suspicion, trace, corruption, instability, notoriety | Same escalation cadence |
| `prep-slots` | Prepared spells, planned tricks, loaded programs, modules | Same number and timing of loadout choices |
| `cooldown` | Recharge, recovery, reboot, ritual reset | Same delay |
| `per-scene` | Heroic effort, ace maneuver, emergency protocol | Same refresh boundary |
| `favor-debt` | Divine favor, contacts, corporate credit, faction obligation | Same dependency and repayment pressure |
| `body-cost` | Blood magic, overexertion, neural burn, mutation strain | Same severity and recovery burden |
| `companion-risk` | Familiar harm, retainer exposure, drone damage | Same benefit and risk |
| `environment` | Moonlight, workshop, network, zero gravity | Same availability profile |

Under v2 these invariants had to be *checked*. Under v3 they hold by construction, because the
cost record is the source's. The column is retained as documentation of what the display name must
not imply.

### 5.8 Lexicon lifecycle

1. **Generated once** per campaign, at creation, from the genre string plus the classified seed
   rows. One model call, or folded into the existing outline call (`rpg-engine.js:1113`).
2. **Pinned and immutable** for slots already bound. A later turn may not rename "Fast Nock". New
   slots may be added (a new ability, a new implement) and bind then.
3. **Shared by every character** in the campaign. A late joiner binds to the existing lexicon and
   therefore cannot alter established vocabulary — v2 needed a rule for this; here it is
   structural.
4. **Versioned** with the campaign, exported and imported with it.

---

## 6. Capability declaration and the permission check

### 6.1 Axes

Fixed, small, ordered. Model-proposed from the genre string at campaign creation; engine-typed;
host-visible and host-editable.

| Axis | Ordered values |
|---|---|
| `supernatural` | `absent` < `hidden` < `rare` < `open` |
| `technology` | `preindustrial` < `industrial` < `modern` < `advanced` < `exotic` |
| `networks` | `absent` < `local` < `ubiquitous` |
| `vehicles` | `absent` < `incidental` < `central` |
| `firearms` | `absent` < `rare` < `common` |
| `institutions` | `absent` < `local` < `pervasive` |
| `scale` | `personal` < `local` < `regional` < `planetary` < `interstellar` |
| `identity` | `fixed` < `mutable` |
| `companions` | `none` < `mundane` < `sentient` |

### 6.2 The check

For each slot the character occupies, filter the lexicon's candidate rows by their `requires`
tags against the destination declaration.

```
candidates(slot) = { row in seed(slot, genreClass)
                     | for each (axis, min) in row.requires:
                         destination[axis] >= min }
```

| Result | Meaning | Next |
|---|---|---|
| ≥1 candidate | Ordinary translation | Bind the best candidate; show it on the card |
| 0 candidates, slot **pinned** | The player already said this does not translate | Setting exception: retain the source literally, flagged as unusual in this world |
| 0 candidates, slot **not pinned** | **No honest equivalent** | Player choice: pin it as an exception, accept a disclosed adaptation from a relaxed axis, rebuild, or cancel |

That is the entire rule. Every hard case in v2 §18 falls out of it:

- **Pilot into vehicle-poor noir** — `platform` requires `vehicles = central`; the declaration says
  `incidental`; candidate set empty; player chooses. v2 needed a prose rule.
- **Fireball with no network** — the netrunner's `prepared-system` source is satisfied by
  `networks ≥ local`, but the *ability's* `area-implement` slot in a `supernatural: absent`
  campaign resolves to a physical heavy weapon. The player sees exactly that swap on the card and
  may pin literal magic instead.
- **Sentient familiar into a drone world** — `companion` at `companions: mundane` cannot bind the
  sentient row; empty; player chooses.
- **Scale mismatch** — a fleet admiral's `scale: interstellar` against a `scale: local` campaign
  is the same empty-set case, on the `scale` axis.
- **Patron without institutions** — `status-authority` requires `institutions ≥ local`; same rule.

### 6.3 What the check deliberately does not do

It does not judge fiction. It compares ordered enums. Every judgment call is either seed data
reviewed once by the owner, or a player choice on the card. The model's only role is proposing the
initial declaration and the candidate nouns — both player-visible, both editable, neither able to
change a number or a mechanic.

---

## 7. Pins replace the anchor taxonomy

v2 defined ten anchor `kind`s and three anchor `policy` values. v3 needs neither: **an anchor is a
pinned slot**.

```json
{ "slot": "implement:sidearm", "policy": "literal",
  "reason": "Inherited from her father" }
```

| Policy | Meaning |
|---|---|
| `literal` | This binding does not change. The destination hosts it as an exception |
| `ask` | Never auto-bound. Always surfaced as an explicit choice |
| *(unpinned)* | Freely bindable from the filtered candidate set, shown on the card |

`identity:*` slots default to `ask`. Everything v2's ten kinds expressed — power source, signature
item, companion, identity, body, faith, oath, allegiance, relationship, weakness — is a slot that
already exists in the taxonomy, pinned. One mechanism, no enum to extend, and the player-facing
gesture is the same in every case: *pin this*.

---

## 8. Modes and flow

### 8.1 Three modes, unchanged from v2

| Mode | Player meaning | Source mutation | Result |
|---|---|---|---|
| **Continue** | Same person, same sheet, compatible campaign | Checkout only | Exact existing profile (today's `existing`) |
| **Branch** | Exact parallel copy | None | Verbatim copy with lineage (today's `copy`) |
| **Translate** | Destination-genre incarnation of the same character | None | New branch: mechanics verbatim, new expression binding |

Translate is a new explicit mode. It never fires because a profile merely looks genre-incompatible.

### 8.2 Flow

```text
source profile
  -> destination campaign draft: genre string -> genre class
                                              -> capability declaration (player-visible)
                                              -> lexicon (generated or existing)
  -> engine copies the mechanical record verbatim; hashes it
  -> engine enumerates the character's slots; applies §6.2 filter
  -> model proposes bindings for non-empty, unpinned slots (nouns and prose only)
  -> engine validates: every binding names a legal candidate; no numbers; no new slots;
     no ability id invented; pinned slots untouched
       invalid       -> one bounded retry, then honest failure (never playable)
       empty slots   -> translation card in `needs_choice`
       otherwise     -> translation card in `ready`
  -> player approves the exact card hash
  -> engine rechecks freshness of source, lexicon, and declaration
  -> atomic commit: translated profile + expression binding + campaign member
  -> opening scene generation, with the lexicon in council context (§9)
```

### 8.3 Outcomes

| Status | Meaning | Allowed next |
|---|---|---|
| `ready` | Every slot bound; mechanics identical | Approve, pin a slot, or cancel |
| `needs_choice` | ≥1 slot has an empty candidate set | Pin, accept a disclosed adaptation, rebuild, or cancel |
| `invalid` | Model output off-contract | Internal bounded retry; never shown as playable |
| `stale` | Source, lexicon, declaration, or card hash changed | Recompute and review |
| `committed` | Persisted exactly once | Load campaign |

v2's `incompatible` is gone as a distinct outcome: under v3 the only way to be truly incompatible
is a catalog-version mismatch (§3.1), which is caught before a card is ever built.

---

## 9. Narration binding — the part v2 has nothing to say about

A translation that is correct in the database and wrong in the narrator's mouth has failed. This is
an LLM-led RPG; the words are the product.

**Contract:**

1. The campaign's lexicon is injected into council context as the **naming authority**: for each
   slot the character occupies, the destination binding and nothing else.
2. **Source-genre vocabulary is excluded** from destination context. The translated profile's
   stored display strings are the destination bindings; origin nouns live only in the provenance
   record (§10), which is not part of turn context.
3. `ability_updates` in the destination campaign write to destination ability ids and destination
   display names. A new ability minted in play creates a new `ability:<id>` slot bound in this
   lexicon only.
4. Renaming an already-bound slot mid-campaign is rejected (§5.8).

**Testable consequence — the leak check**: assemble a turn's council context for a translated
character and assert that no source-lexicon term appears in it. This is a cheap string assertion
over a fixture, and it is the single highest-value test in the whole plan, because it is the one
the player actually experiences.

Seat isolation applies unchanged: a seat receives its own character's bindings and the campaign's
shared vocabulary, never another character's pins, provenance, or unchosen alternatives
(`.agents/repo-guidance.md`, Runtime Contracts).

---

## 10. Name, history, and provenance — the answer v2 deferred

v2 sends biography, relationships, and provenance to D13/D16 and therefore cannot say what happens
to "Cassidy Blackwater, Arizona Ranger" when she lands in high fantasy. That deferral is wrong for
one specific reason: this is profile **text**, not mechanical state, so no rules decision gates it.

| Item | Rule |
|---|---|
| Character name | Slot `identity:name`, pinned `ask` by default. The card offers: keep verbatim; accept a proposed reframing ("Cassidy of Blackwater"); or edit freely. Silence keeps it |
| Appearance | Slot `identity:appearance`, pinned `ask`. Genre-inappropriate specifics (a duster, a chrome jaw) surface as individual choices, never bulk-rewritten |
| Origin history | **Never rewritten.** Stored as `provenance` on the translated profile: origin campaign id, origin genre, origin role name, and the date of translation. This is out-of-world truth and is not campaign canon |
| In-world origin framing | Slot `identity:origin`, pinned `ask`. One or two player-approved sentences explaining this person's presence in the destination world, or the explicit choice "leave unstated" |
| Relationships and campaign history | Not carried into destination canon by Translate. They remain readable on the source profile. Whether a future feature imports them is D13/D16 |
| Inventory nouns | Translatable today as `implement:*` bindings, because today's items are free text `{name, type, description, quantity}` |
| Inventory **mechanics** — condition, provenance, wealth, registry records | D16. Not claimed |

Renaming inventory happens **at branch time into a fresh campaign**, so Chapter 2's name-key
resolution (`docs/rules/effects.md` §1, §2.3) never sees a rename inside a live campaign. This is
an additional, non-obvious reason Translate must create a branch rather than mutate in place.

---

## 11. Staged delivery

The stages are independent. Stage 1 depends on no rules-queue decision, because today's abilities
carry no engine-executed mechanics — which makes today the *safest* possible moment to translate
expression, not the least safe. Each stage still requires its own owner-approved phase and plan;
none is authorized here.

### Stage 1 — expression translation over today's free-text profiles

Depends on: nothing in the rules queue. Ships against the shipped engine.

| Slice | Work | Exit |
|---|---|---|
| S1.1 | Give profile abilities stable ids; match `ability_updates` on id with legacy name fallback (§4.4) | Renaming an ability no longer forks it; legacy rows still match |
| S1.2 | Capability declaration: derive from the genre string at campaign creation, type it, store it, expose it to the host | Declaration round-trips; a bad classification is host-editable |
| S1.3 | Lexicon: slot taxonomy, seed tables, generation, per-campaign storage, immutability of bound slots | Two characters in one campaign share vocabulary; a late joiner cannot alter it |
| S1.4 | Translate mode: verbatim copy plus binding, §6.2 filter, card, hash-bound approval, cancel and resume | Play cannot begin before approval; source profile is untouched |
| S1.5 | Narration binding and the leak check (§9) | No source-lexicon term reaches destination council context |
| S1.6 | Close the shipped defect (§2): feed the incoming character's abilities into destination ruleset generation as **re-express, do not replace** | A reused profile's rule sheet describes *her* abilities in destination language |

S1.6 is worth flagging separately: it is small, it is the cheapest user-visible improvement in this
entire document, and it is arguably worth doing on its own merits even if Translate never ships.

### Stage 2 — catalog-bound abilities

Depends on: D5 ability packaging.

- Mechanics become catalog-bound records. Translate's copy step becomes a literal record copy, and
  the byte-identity invariant (§12) becomes enforceable and exact.
- Requirement tags may be tightened from lexicon rows onto ability records where D5 gives them a
  home.
- No change to the lexicon, the card, or the flow.

### Stage 3 — rebuild

Depends on: D5, and an owner decision that rebuild is wanted.

- A separate player-driven respec, entered from a `needs_choice` card or from an ordinary character
  screen. Explicitly not translation.

### Stage 4 — non-ability state

Depends on: D13/D16. Inventory condition, provenance, wealth, item registry records,
relationships. Until then, no message anywhere claims that a *complete* character has ported.

---

## 12. Verification

Automated entry point: `node test.js` (`npm test`). Every new behavior test takes the AGENTS.md
guard proof — revert the change, prove the test fails, restore, prove the suite passes.

**The invariant that replaces v2's fingerprint suite**, and the reason v3 is cheaper to verify:

```js
// Stage 1: display-bearing fields excluded; Stage 2: whole record.
assert.deepStrictEqual(translated.mechanics, source.mechanics);
```

One assertion covers what v2 spread across normalized ordering, hash stability, exact preservation
of reach/target/delivery/tempo/cost/reliability/dependency/agency, and cross-version equivalence
rules. Structural identity is not merely easier to test than derived equivalence — it is the only
one of the two that can be tested exhaustively.

| Area | Required coverage |
|---|---|
| Identity | Mechanics deep-equal across translation; source profile unmutated; lineage recorded |
| Round trip | Translate W→F→W restores the original bindings exactly; mechanics identical at every hop |
| Ability ids | `ability_updates` match on id after rename; legacy name-keyed rows still match |
| Filter | Every §6.2 case: non-empty binds, empty-and-pinned yields exception, empty-and-unpinned yields `needs_choice`; each guard case in §6.2 as a fixture |
| Declaration | Ordered-enum comparison at every boundary value; unknown axis or value fails closed |
| Lexicon | Bound slots immutable; new slots bindable; late joiner cannot alter established vocabulary; two characters share vocabulary |
| Model containment | Adversarial fixtures: invented ability ids, numbers in prose, new slots, edits to pinned slots, bindings outside the candidate set — all rejected, bounded retry, honest non-playable failure |
| Narration | Leak check (§9); ability display names in context come from the lexicon |
| Card | Every changed noun appears; no unchosen alternative is hidden; approval is hash-bound and idempotent |
| Draft flow | ready / needs_choice / stale / retry / cancel; restart-safe; play cannot precede approval |
| Compatibility | Legacy profiles with no kernel: Continue and Branch unchanged; old bundles import; new bundles round-trip lexicon, bindings, pins, provenance; unknown schema fails closed |
| Seat isolation | Bindings, pins, provenance, and alternatives do not cross seats; re-run leak and route guards per `.agents/repo-guidance.md` |

**Manual / playtest** (the phase review gate in `.agents/repo-guidance.md` applies):

1. Western gunslinger → high fantasy; 2. fantasy wizard → cyberpunk, with the physical-output swap
visible on the card; 3. rogue → three destinations; 4. Pilot → vehicle-poor destination produces a
choice, not a silent downgrade; 5. sentient companion → technological destination requires a
choice; 6. cancel, reload, resume, retry; 7. Translate from an active source leaves the source
untouched; 8. host and seat views expose only appropriate state; 9. a late joiner translates
without shifting established vocabulary; **10. ten turns of real play in the destination campaign
with no vocabulary reversion** — the one check that tests what the player feels.

Bar for acceptance: before the first turn, the player can state what the character can do, what
changed, what it costs, and what remains impossible — and after ten turns, the narrator is still
speaking the destination's language.

---

## 13. Persistence sketch

Names are proposals; an approved phase may rename while preserving the contract.

**Profile** (`player_characters`, nullable additions): `identity_json` (families, slots, pins,
provenance), `translated_from_character_id` (Translate lineage — do **not** overload
`copied_from_character_id`, which stays exact-Branch lineage).

**Campaign** (nullable additions): `capability_json`, `lexicon_json`, `lexicon_version`.

**Binding**: the campaign-local `characters` row snapshots the approved bindings exactly as
campaign members are snapshotted today.

**Draft**: Translate needs destination vocabulary before final approval and must survive a reload,
so it needs a persisted `campaign_creation_drafts` record — id, status, genre and table settings,
source profile id and hashes, generated outline/ruleset/declaration/lexicon, card and card hash,
player choices, timestamps, idempotency and commit result. `new`, `existing`, and `copy` keep their
current synchronous route; only Translate requires the draft flow.

**Endpoints**: `POST /api/campaign-drafts`, `GET /api/campaign-drafts/:id`,
`POST /api/campaign-drafts/:id/choices`, `POST /api/campaign-drafts/:id/approve` (card hash plus
idempotency key), `POST /api/campaign-drafts/:id/cancel`. All host-authorized.

**Commit ordering**: generate and validate outside the write transaction → persist draft and hashes
→ on approval re-read and reject stale or consumed state → generate remaining opening-scene
material against the approved card → one write transaction creating the translated profile,
lineage, campaign, outline, ruleset, lexicon, party member, locations, NPCs, and turn state, then
marking the draft committed → an identical retry returns the committed result.

**Legacy profiles**: Continue and Branch work unchanged forever. Translate on a profile with no
identity record runs **slot onboarding** — the model proposes families, slots, and candidate pins
from the existing archetype string and ability list; the engine validates structure only; the
player approves or corrects before any destination binding; nothing inferred becomes canonical
without that approval. Onboarding and translation may share one guided screen but remain two
separately approved records.

---

## 14. Non-goals

- A class-name dictionary assuming every noun has a safe counterpart.
- A player-facing menu of 22 families, or open primary-plus-two-secondary multiclassing.
- Model-generated numbers, operations, costs, or mechanical permissions.
- Silent conversion of a pinned slot.
- Mutating the source character in place.
- Claiming complete portability before D13/D16 settle non-ability state.
- Changing the settled D0 rulebook per campaign.
- Mechanical rebuild inside Translate.
- Implementing any part of this plan before a concrete phase and its owner gates are approved.

---

## 15. Honest risks against v3 itself

Recorded so the owner rules on a real object, not a sales pitch.

1. **The lexicon costs a generation call.** Mitigation: fold it into the existing outline call
   (`rpg-engine.js:1113`), or generate lazily on the first Translate. Unmitigated, it adds latency
   to every campaign creation.
2. **Slot taxonomy can bloat.** Eight slot families today. Each addition is a schema change and a
   seed-table row per genre class. Needs a standing rule that new slots arrive by owner decision,
   not by convenience.
3. **"Mechanics never change" will feel harsh in some cases.** A player whose signature move has no
   home in the destination fiction is told to pin it or rebuild. That is honest and it is D0, but
   it is a worse *feeling* than a plausible-sounding silent substitution — which is exactly why v2
   reached for one. The card's wording carries this weight and should be playtested as copy, not
   just as data.
4. **A wrong capability declaration mis-filters silently.** A campaign classified `supernatural:
   absent` that the player thinks is `rare` will refuse bindings for no visible reason. Mitigation:
   the declaration is on the card and host-editable, and an empty candidate set names the axis that
   emptied it.
5. **The 22 families remain unvalidated by play.** They are a reviewed design vocabulary, not
   evidence. Only the §12 playtests can promote them.
6. **Genre classification of free text is fuzzy.** Mitigated by the classification affecting only
   seed-row selection and default axes, both visible and editable — never mechanics.
7. **v3 is a bigger departure than a v2 patch.** If the owner has already internalized v2's
   fingerprint model, this asks for a re-read. §1 exists to make that cost one table.

---

## 16. Owner gates

Taken in chat one at a time and recorded durably. This plan infers none of them.

1. **The v3 architecture itself** — mechanics copied verbatim plus a per-campaign expression
   binding, replacing v2's candidate-plus-equivalence-proof. Everything else depends on this
   ruling. *Recommendation: adopt.* It is smaller, decidable, testable by structural identity, and
   it is what D0 already implies.
2. **Stage 1 as a phase** — expression translation against today's free-text profiles, with no
   rules-queue dependency. *Recommendation: approve S1.6 first as a standalone improvement, then
   the rest as one phase.*
3. **The capability axes** (§6.1) — nine ordered enums, or a different set.
4. **The slot taxonomy** (§5.2) — eight families, and the rule for adding more.
5. **Families and their internal-only status** (§5.4) — approve, refine, or cut Generalist.
6. **Name and history policy** (§10) — v3 proposes settling this now rather than deferring to
   D13/D16, because it is text, not mechanical state.
7. **D5 ability packaging** — needed for Stage 2, not for Stage 1.
8. **D13/D16 non-ability state** — needed for Stage 4 only.

The first ruling is gate 1. Nothing below it is actionable until that lands — with the exception of
S1.6, which stands on its own and could be scoped independently if the architecture ruling takes
longer.
