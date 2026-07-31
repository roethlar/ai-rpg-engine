# Cross-genre character portability — v3.1

**Status**: ACTIVE working draft. **Gate 1 (§16) adopted by the owner 2026-07-31** — recorded in
`.agents/decisions.md`. Gates 2-7 remain unruled. Authorizes no product-code change.

**Date**: 2026-07-27

**Supersedes as the active working draft**: `.agents/review/archetype-portability-matrix-v3.md`.
The v1 draft, the independent v1 review, v2, and v3 remain evidence.

**Basis**: v3's immutable-mechanics thesis survived independent review. Six structural findings and
three smaller corrections did not. All nine are fixed here; §1 maps each fix so the delta can be
checked without re-reading the whole document.

---

## 1. What v3.1 corrects

| # | v3 defect | Fix | §|
|---|---|---|---|
| 1 | One shared campaign lexicon with generic keys (`role`, `identity:name`) cannot hold two characters — the second overwrites the first | Split into **campaign-scope vocabulary** (`role:marksman`, `implement:sidearm` — semantic key, shared) and **character-scope bindings** (identity, pins, ability expression, which vocabulary entries this character uses) | §5 |
| 2 | "Stage 1 is mechanically risk-free — nothing mechanical can break" | **Withdrawn.** The ruleset sheet is injected as `CAMPAIGN RULES (CANON — these must never drift)` and the model adjudicates from it (`rpg-prompts.js:101-109`); profile ability prose is also in context (`rpg-prompts.js:156`). No *engine-executed* mechanics exist yet, but the prose **is** the operative rulebook. S1.6 moves last, behind ids, bindings, validation, and player approval, and is confined to campaign-creation time | §2, §11 |
| 3 | The §6.2 filter supported only conjunctions of `>=` thresholds, while the seed tables used `or`, `=`, and prose inheritance | Small formal predicate grammar: `all`, `any`, `gte`, `eq`, `not`. Inheritance is expanded literally in the data; no prose references survive | §6.2 |
| 4 | §7 claimed every v2 anchor kind "already exists" in the slot taxonomy — relationship, weakness, oath, and allegiance did not | Four slot families added explicitly (`identity:oath`, `identity:allegiance`, `relationship:<key>`, `weakness:<key>`). The overclaim is deleted and replaced by a coverage table | §5.2, §7 |
| 5 | Literal pins permit source terms in play, but the leak test rejected *every* source term — the two contradicted | An approved literal pin **is** a destination binding (provenance `player-pin`). The test asserts no *unapproved* source vocabulary, computed as source terms minus the approved binding set | §9 |
| 6 | New-character initialization missing; only legacy profiles and Translate had an onboarding path | One onboarding mechanism, three entry points: new character, legacy profile, Translate. Concept → proposed families and slots → plain-language capability summary → player approval. Never a class menu | §8.1 |
| 7 | Ability-ID scope and assignment undefined | Globally unique, engine-issued, minted once, carried unchanged through branches and translations, remapped on import | §4.4 |
| 8 | Capability declaration editable at any time, silently invalidating existing bindings | Free until the first binding commits; thereafter loosening applies immediately, tightening requires a revalidation pass that names every affected binding | §6.4 |
| 9 | Round-trip claim ("W→F→W restores the original bindings exactly") was false for a *new* origin-genre campaign | Narrowed: mechanics are identical at every hop unconditionally; binding restoration is claimed only when translating back into the **original campaign** | §12 |

Unchanged from v3: the immutable-mechanics thesis (§3), the three modes, capability-filtered
permission as the sole definition of "no honest equivalent", pins, the card, the narration binding,
and the staged delivery shape.

---

## 2. Grounding: what actually ships today

Verified against working-tree head.

- **Genre is free text**, not a picklist (`public/index.html:279-282`). The ten genre classes in
  §5.5 are a classifier target, never a menu.
- **Two unrelated ability surfaces, both in the adjudicating model's context:**

  | Surface | Shape | Where written | Where read |
  |---|---|---|---|
  | Campaign ruleset abilities | `{name, cost, effect, limits}`, free text | Generated once per campaign by Setup (`rpg-engine.js:1124-1151`), validated as free text (`rpg-state.js:745-773`) | `rpg-prompts.js:101-109` |
  | Profile abilities | `{name, description, tier, source}`, free text | Grown in play by `ability_updates` (`rpg-engine.js:110-148`) | `rpg-prompts.js:156` |

- **The ruleset sheet is canon and explicitly anti-drift**: `=== CAMPAIGN RULES (CANON — these must
  never drift) ===` … `Apply these rules identically every turn. When the player asks what they can
  do, answer from this sheet.` (`rpg-prompts.js:102-108`).
- **Ability identity is the lowercased display name** (`rpg-engine.js:127`).
- **Reuse and copy carry the character verbatim** (`rpg-engine.js:1153-1159`,
  `rpg-engine.js:2086-2099`) into a campaign whose ruleset was regenerated **for the new genre from
  the archetype string alone** (`rpg-engine.js:1143`).
- Profiles persist archetype, attributes, inventory, abilities, progression, checkout, lineage
  (`db.js:240-265`); campaigns persist genre and `ruleset_json` (`db.js:92-95`, `db.js:121`).

### 2.1 The shipped defect, and the correct risk statement

**Defect**: the engine already re-expresses the rules for each genre; it does not know it is
re-expressing *the same character*. A western gunslinger entering a fantasy campaign gets a fantasy
rule sheet describing abilities that are not hers, alongside her own untranslated revolver
abilities.

**Risk, stated correctly** (v3 got this wrong): today's abilities have no *engine-executed*
mechanics — nothing in `rpg-state.js` or the catalog runs them. But the **model** is the adjudicator
and both ability surfaces are its rulebook. Re-expressing that prose therefore *can* change how the
game adjudicates, even though no engine number moves. Two consequences:

1. Re-expression is **only** legal at campaign creation, before any turn resolves. The canon sheet
   says "never drift"; a mid-campaign rewrite is exactly drift.
2. Re-expression must be **constrained and player-approved**, never a free model pass. S1.6 ships
   last, behind the card (§11).

### 2.2 Durable constraints

- **D0**: one bespoke versioned rulebook; campaigns change flavor, not mechanics.
- **D2** (catalog signed 2026-07-27): abilities select operations from the Chapter 2 catalog and
  never invent mechanics inline (`docs/rules/effects.md` §5).
- Chapter 2 §5 leaves ability packaging — costs, targeting, cooldowns, archetype assignment, the
  authorizer, the `foe`-binding affirmation carrier — to D3/D5.
- Engine owns numbers, state transitions, validation, canonical records. Models emit bounded
  identifiers, enums, and player-facing expression.

---

## 3. Thesis: mechanics do not translate, because they do not change

D0 says one rulebook across all campaigns. Chapter 2 says abilities are selections from a versioned
catalog. A cross-genre move therefore **cannot** change mechanics: the same catalog is in force on
both sides.

v2 built an apparatus to generate a destination candidate and prove it equivalent to the source.
That apparatus has no stable operating point: if the candidate reuses the source's templates the
fingerprint is preserved trivially and the proof proved a rename; if it selects different
operations the fingerprint cannot match and every interesting case returns `incompatible`.

**The rule**: Translate copies the mechanical record byte-for-byte and produces a separate,
per-campaign expression binding. Equivalence is not proven; it is structural.

Two problems remain, and they are the real ones:

1. **Naming** — the destination world needs its own words, used consistently by every system that
   speaks to the player → §5.
2. **Permission** — the destination fiction may not host the shape at all → §6.

Everything v2 called "no honest equivalent" is problem 2.

### 3.1 When mechanics genuinely must change

| Case | Disposition |
|---|---|
| Destination pins a different `catalog_version` | Not translatable. Chapter 2 §1.1 makes version change an owner-approved migration; two catalogs are never live at once. Offer Branch into a same-version campaign, or cancel |
| A slot has no legal candidate and the player will not pin it | **Rebuild** — a separate, future, player-driven respec. Translate never silently narrows |
| The player wants different mechanics | Rebuild. A feature request, not a translation |

---

## 4. The artifacts

### 4.1 Campaign capability declaration

Nine ordered axes describing what the destination fiction can host. Model-proposed from the genre
string at creation, engine-typed, player-visible, host-editable under §6.4. See §6.

### 4.2 Campaign vocabulary (campaign-scope)

Semantic key → destination term, with requirement predicates and provenance. Shared by every
character in the campaign. See §5.2.

### 4.3 Character identity record (profile-scope)

```
mechanics    — ability records, packaging, progression, attributes.
               Owned by the engine and the D5 contract.
               COPIED VERBATIM BY TRANSLATE. Never re-derived, never model-touched.

bindings     — per (character, campaign): which vocabulary entries this character uses,
               plus this character's own identity, ability expression, and specializations.
               THE ONLY THING TRANSLATE PRODUCES.

pins         — the player's non-negotiables, as pinned slots. Owned by the player. §7.
```

```json
{
  "schemaVersion": 1,
  "abilityIds": ["a41", "a42"],
  "families": { "primary": "marksman", "secondary": ["duelist"] },
  "slots": ["role:marksman", "source:precision-projectile", "implement:sidearm",
            "implement:long-range", "resource:ammunition",
            "identity:name", "identity:origin", "ability:a41", "ability:a42"],
  "pins": [
    { "slot": "implement:sidearm", "policy": "literal",
      "reason": "Inherited from her father" }
  ],
  "provenance": { "originCampaignId": 12, "originGenre": "Weird West frontier",
                  "originRole": "Gunslinger", "translatedAt": "2026-07-27" }
}
```

The kernel stores **no mechanical vocabulary of its own** — no `reach`, `targetShape`, `delivery`,
`tempo`, `setup`, `costShapeRef`, `reliabilityBand`, or fingerprint. Those live on the ability
record (D5's packaging) or belong to D6's spatial vocabulary; v2 would have created a second,
drifting copy of both.

### 4.4 Ability identity

Today identity is the lowercased display name (`rpg-engine.js:127`). Renaming *is* the operation, so
a translated character forks her abilities on the next level-up: the destination's "Fast Nock" and
the profile's "Quick Draw" become two abilities. This is a hard precondition, not a nicety.

| Property | Rule |
|---|---|
| Scope | **Globally unique**, engine-issued. Not profile-scoped: a branch and its source legitimately share ids, which is what makes mechanics deep-equality meaningful and lineage traceable |
| Minting | Once, at first existence — Setup generation, an `ability_updates` insert, or the one-shot legacy backfill (keyed by current name within the profile) |
| Stability | Carried unchanged through Branch and Translate. A translated branch's ability records are the source's records, ids included |
| Matching | `applyAbilityUpdates` matches on id; name matching survives only as the legacy fallback for rows with no id |
| Display | Never the identity. Display names live in bindings, keyed `ability:<id>` |
| Portability | Bundles carry ability ids; import remaps them under the same entity mapping applied to the rows, and remaps every `ability:<id>` binding key with them — the same discipline Chapter 2 §1.1 requires of persisted tokens |

---

## 5. Vocabulary and bindings

### 5.1 Why v3's single lexicon failed

v3 declared one campaign lexicon "shared by every character" while keying entries generically:
`role`, `identity:name`, `identity:origin`. Two characters in one campaign cannot both own `role`,
and `identity:name` is per-person by definition. The second character silently overwrites the first.

The split below keeps the property that motivated the shared lexicon — one world, one set of words,
late joiners cannot shift established vocabulary — while giving each character their own identity
and expression.

### 5.2 Two scopes

**Campaign scope — shared vocabulary.** Key includes the semantic value, so entries never collide:

```json
{
  "campaignId": 41, "vocabularyVersion": 1, "genreClass": "F",
  "entries": [
    { "key": "role:marksman", "term": "Longbow ranger",
      "requires": {"all": []}, "provenance": "model" },
    { "key": "source:precision-projectile", "term": "Yew-bow discipline of the March",
      "requires": {"all": []}, "provenance": "model" },
    { "key": "implement:sidearm", "term": "Repeating hand crossbow",
      "requires": {"all": []}, "provenance": "seed" },
    { "key": "resource:ammunition", "term": "Arrows",
      "requires": {"all": []}, "provenance": "seed" }
  ]
}
```

**Character scope — bindings**, per (character, campaign):

```json
{
  "characterId": 88, "campaignId": 41, "vocabularyVersion": 1, "declarationVersion": 1,
  "uses": ["role:marksman", "source:precision-projectile",
           "implement:sidearm", "implement:long-range", "resource:ammunition"],
  "specializations": [
    { "key": "role:marksman", "term": "Ranger of the March Wardens",
      "reason": "second marksman at this table" }
  ],
  "identity": {
    "name": "Cassidy of Blackwater",
    "appearance": "…player-approved text…",
    "origin": "…player-approved sentence, or the explicit choice 'unstated'…"
  },
  "abilities": [
    { "abilityId": "a41", "term": "Fast Nock",
      "prose": "She has an arrow away before the string stops humming." }
  ],
  "literalPins": [
    { "slot": "implement:sidearm", "term": "her father's revolver",
      "approvedAt": "…", "exception": true }
  ]
}
```

**Specialization rule**: two characters of the same family share the campaign term by default —
that is the point of shared vocabulary. Either may specialize to an approved variant; the shared
entry is never rewritten by a specialization.

### 5.3 Slot taxonomy

| Slot family | Key form | Scope | Seeded from | Notes |
|---|---|---|---|---|
| Role name | `role:<family>` | campaign | §5.6 matrices | What this world calls this kind of person |
| Power source | `source:<pattern>` | campaign | §5.7 | Why the fiction permits the capabilities |
| Implement | `implement:<function>` | campaign | §5.8 | Nouns by function, never by resale value |
| Resource | `resource:<cost-shape>` | campaign | §5.9 | Renames only; cadence is mechanics and does not move |
| Institution | `institution:<key>` | campaign | genre defaults | Orders, guilds, corps, agencies, cabals |
| Damage language | `damage-language` | campaign | genre defaults | How harm reads in narration |
| Ability | `ability:<abilityId>` | character | model | Display name plus flavor prose for one ability record |
| Identity | `identity:name`, `identity:appearance`, `identity:origin` | character | source profile | Pinned `ask` by default (§10) |
| Oath | `identity:oath` | character | source profile | An ethical or sworn constraint, distinct from `source:faith-oath` (a power source) |
| Allegiance | `identity:allegiance` | character | source profile | Which side or body this person belongs to |
| Relationship | `relationship:<key>` | character | source profile | A named bond. Pinning prevents silent translation; **carrying relationships into destination canon remains D13/D16** |
| Weakness | `weakness:<key>` | character | source profile | A characteristic vulnerability, taboo, or tradeoff |

Twelve families. The last four exist because §7's coverage claim required them (finding 4); they are
expression and pin targets only, and none of them asserts mechanical state.

### 5.4 Vocabulary lifecycle

1. **Generated once** per campaign at creation, from the genre string plus classified seed rows. One
   model call, or folded into the existing outline call (`rpg-engine.js:1113`).
2. **Bound entries are immutable.** A later turn may not rename `implement:sidearm`. New keys may be
   added and bound then.
3. **Shared by every character.** A late joiner binds to the existing vocabulary and therefore
   cannot alter established terms — structural, not a rule.
4. **Versioned** with the campaign; exported and imported with it. Bindings record the
   `vocabularyVersion` and `declarationVersion` they were validated against.

### 5.5 Genre classes

Free-text genre is classified into one primary class plus free tone modifiers, purely to select seed
rows and default axes. Misclassification is recoverable: the result is player-visible and editable,
and it never touches mechanics.

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

Hybrids take one primary class for capability defaults and vocabulary modifiers from the others. A
"cyberpunk western" is C for capabilities with W vocabulary; it never averages the two.

### 5.6 Seed rows: `role:<family>`

The 22 families are **internal engine vocabulary**, never a player-facing pick list. They do exactly
two jobs: they key the `role:` seed rows, and they supply the card's recognition line from the
decision-loop column.

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

**F through M:**

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

**P through X:**

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
term; the player approves what lands.

### 5.7 Seed rows: `source:<pattern>`

A family says which decisions the character contributes. A source says why the fiction permits them.
`requires` is the §6.2 predicate the filter evaluates — stated formally, no prose.

| Source pattern | Fantasy / occult | Grounded / frontier | Contemporary | Cyberpunk / space | Post-apoc / surreal | `requires` |
|---|---|---|---|---|---|---|
| `training` | Order, school, weapon discipline | Trade, military, apprenticeship | Professional training | Sim, doctrine, specialist training | Hard-won practice | `{all:[]}` |
| `precision-projectile` | Bow, crossbow, wand | Bow, musket, revolver, rifle | Firearm / launcher | Smartgun, rail weapon, blaster | Scrap weapon, bio-projectile | `{all:[]}` |
| `prepared-system` | Spellbook, runes, ritual formulae | Strategy, alchemy, engineering tables | Software, plans, operational access | Cyberdeck, expert system, psionic discipline | Relic interface, rite, dream grammar | `{any:[{gte:["supernatural","rare"]},{gte:["networks","local"]}]}` |
| `faith-oath` | Divine covenant, sacred order | Vow, community office, moral authority | Chaplaincy, cause, institution | AI covenant, ideology, interstellar order | Cult, ancestral duty, cosmic compact | `{gte:["institutions","local"]}` |
| `psychic-perception` | Divination, second sight | Intuition, observation, mesmerism | Profiling, surveillance expertise | Neural sense, psionics, sensor fusion | Mutation, visions, reality sensitivity | `{any:[{gte:["supernatural","rare"]},{gte:["technology","modern"]}]}` |
| `nature-ecology` | Druidic bond, spirits, beasts | Fieldcraft, herbalism, husbandry | Ecology, wilderness training | Biohacking, xenobiology, habitat systems | Mutation ecology, wasteland lore | `{all:[]}` |
| `craft-technology` | Smithing, artificing, alchemy | Engineering, gunsmithing, mechanics | Electronics, medicine, fabrication | Cybertech, robotics, ship systems | Salvage craft, relic repair | `{all:[]}` |
| `body-alteration` | Shapeshifting, blessing, curse | Disguise, conditioning, adaptive equipment | Experimental treatment | Cyberware, geneware, alien biology | Mutation, possession, dream-form | `{any:[{gte:["identity","mutable"]},{gte:["supernatural","rare"]},{gte:["technology","advanced"]}]}` |
| `status-authority` | Crown, guild, temple, lineage | Rank, land, trade house | Office, wealth, law, organization | Corporation, syndicate, fleet | Settlement control, cult, fate claim | `{gte:["institutions","local"]}` |
| `companion-agent` | Familiar, summon, beast | Retainer, hound, mount | Informant, K9, drone | Drone, droid, AI, xenobeast | Mutant beast, spirit, echo | `{gte:["companions","mundane"]}` |
| `luck-fate` | Blessing, prophecy, charm | Reputation, foresight, contingency | Planning, contacts, trained reflex | Predictive model, probability hack | Mutation luck, omen, causality bend | `{all:[]}` |
| `performance` | Song, tale, glamour | Oratory, reputation, spectacle | Media, celebrity, persuasion | Influence feed, memetic craft | Tribal story, psychic resonance | `{all:[]}` |

### 5.8 Seed rows: `implement:<function>`

Tool translation preserves function, dependency, and scarcity — never the noun or resale value.

| Function key | Fantasy | Historical / frontier | Contemporary | Cyberpunk / space | Post-apoc / surreal | `requires` |
|---|---|---|---|---|---|---|
| `sidearm` | Hand crossbow, wand, throwing knives | Pistol, compact bow | Handgun | Smart pistol, holdout blaster | Scrap pistol, thorn caster | `{all:[]}` |
| `long-range` | Longbow, spell focus | Rifle, musket, longbow | Precision rifle | Rail rifle, beam rifle | Salvage rifle, bone bow | `{all:[]}` |
| `close-weapon` | Short blade, staff | Saber, knife, club | Knife, baton | Monoblade, shock baton | Machete, living blade | `{all:[]}` |
| `area-implement` | Alchemical charges, siege focus | Dynamite, cannon | Explosives, heavy launcher | Plasma projector, missile system | Scrap cannon, unstable relic | `{all:[]}` |
| `protection` | Mail, plate, ward | Armor, reinforced coat | Ballistic protection | Smart armor, exosuit, shield field | Patchwork armor, mutation shell | `{all:[]}` |
| `bypass-kit` | Thieves' tools, runekey | Picks, forged papers | Credentials, intrusion tools | Cyberdeck, security spike | Salvaged bypass kit, symbolic key | `{all:[]}` |
| `prepared-focus` | Grimoire, runes, components | Formula book, maps, instruments | Laptop, case files, plans | Cyberdeck, neural archive | Relic codex, memory shrine | `{any:[{gte:["supernatural","rare"]},{gte:["networks","local"]}]}` |
| `healing-supply` | Herbs, potion, holy kit | Doctor's bag, tonic | Trauma kit, medicine | Medkit, nanites, autodoc | Salvaged medicine, symbiote | `{all:[]}` |
| `companion` | Familiar, beast, retainer | Hound, horse, hireling | Informant, K9, drone | AI, droid, drone, xenobeast | Mutant beast, spirit, echo | `{gte:["companions","mundane"]}` |
| `companion-sentient` | Familiar with a mind of its own | Sworn retainer | Partner, informant with agency | AI, uplifted droid, xenobeast | Spirit, echo, mutant ally | `{gte:["companions","sentient"]}` |
| `transport` | Mount, wagon, enchanted conveyance | Horse, coach, boat | Car, motorcycle, aircraft | Rig, grav-bike, shuttle | Scrap vehicle, giant beast | `{gte:["vehicles","incidental"]}` |
| `platform` | Warhorse, war galley | Cavalry mount, ship | Pursuit vehicle, helicopter | Rig, fighter, starship | War rig, colossus | `{gte:["vehicles","central"]}` |
| `communication` | Messenger, sending token | Courier, signal lamp, telegraph | Phone, radio | Encrypted mesh, comm implant | Shortwave, psychic link | `{all:[]}` |
| `surveillance` | Familiar, scrying, scout | Spyglass, lookout, informant | Cameras, wiretap, drone | Sensor web, intrusion daemon | Scout beast, omen, relic sensor | `{all:[]}` |
| `social-leverage` | Title, guild seal, favor | Rank, land, reputation | Office, money, credentials | Corporate access, reputation score | Settlement debt, cult standing | `{gte:["institutions","local"]}` |
| `restraint` | Net, binding rune | Lasso, manacles | Restraints, chemical agent | Shock web, control program | Snare, mutation, dream binding | `{all:[]}` |

`transport` and `platform` are deliberately distinct: a Pilot needs a vehicle whose position and
risk drive decisions; ordinary travel needs only transport. `companion` and `companion-sentient` are
likewise split, so the sentience requirement is data rather than prose (v3 pointed at "§6.2" from
inside a table the filter could not read — finding 3).

### 5.9 Seed rows: `resource:<cost-shape>`

Renaming a resource is expression. Changing how often the character can act is mechanics, and
mechanics do not move.

| Cost shape | Candidate names | What the name must not imply |
|---|---|---|
| `pool` | Mana, focus, stamina, bandwidth, charge | A different number of uses before recovery |
| `ammunition` | Arrows, bullets, components, charges, doses | Different scarcity or resupply pressure |
| `heat` | Suspicion, trace, corruption, instability, notoriety | A different escalation cadence |
| `prep-slots` | Prepared spells, planned tricks, loaded programs, modules | A different number or timing of loadout choices |
| `cooldown` | Recharge, recovery, reboot, ritual reset | A different delay |
| `per-scene` | Heroic effort, ace maneuver, emergency protocol | A different refresh boundary |
| `favor-debt` | Divine favor, contacts, corporate credit, faction obligation | Different dependency or repayment pressure |
| `body-cost` | Blood magic, overexertion, neural burn, mutation strain | Different severity or recovery burden |
| `companion-risk` | Familiar harm, retainer exposure, drone damage | Different benefit or risk |
| `environment` | Moonlight, workshop, network, zero gravity | A different availability profile |

Under v2 these had to be checked. Here they hold by construction — the cost record is the source's.
The column documents what the *display name* must not imply, which matters precisely because the
model adjudicates from prose (§2.1).

---

## 6. Capability declaration and the permission check

### 6.1 Axes

Fixed, small, ordered. Model-proposed from the genre string at campaign creation; engine-typed;
host-visible and host-editable under §6.4.

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

### 6.2 Predicate grammar

v3's filter accepted only conjunctions of minimum thresholds while its own tables used `or`,
equality, and prose inheritance — the algorithm could not encode its own data. The grammar is now
explicit and closed:

```
predicate := {"all": [predicate, …]}     // every child holds; {"all": []} is always true
           | {"any": [predicate, …]}     // at least one child holds; {"any": []} is always false
           | {"not": predicate}
           | {"gte": [axis, value]}      // declaration[axis] >= value in the axis order
           | {"eq":  [axis, value]}      // declaration[axis] == value
```

Rules:

- Every axis is ordered, so the seed tables use only `all`, `any`, and `gte`. `eq` and `not` are in
  the grammar for future unordered axes and are unused today — an unused operator is cheaper than a
  table the algorithm cannot express.
- **Inheritance is expanded literally in the data.** `implement:prepared-focus` carries the
  `prepared-system` predicate as its own value; it does not reference it. No prose cross-reference
  is legal in a `requires` field.
- Unknown axis or value → **fail closed**, never "assume satisfiable".
- Predicate depth is capped (3) and evaluation is pure, total, and engine-side. Models never author
  a predicate; they select from candidates the engine already filtered.

### 6.3 The check

```
candidates(slot) = { row in seed(slot, genreClass) | evaluate(row.requires, declaration) }
```

| Result | Meaning | Next |
|---|---|---|
| ≥1 candidate | Ordinary translation | Bind the best candidate; show it on the card |
| 0 candidates, slot **pinned** | The player already said this does not translate | Setting exception: retain the source term literally, recorded as an approved destination binding (§9) |
| 0 candidates, slot **not pinned** | **No honest equivalent** | Player choice: pin as an exception, accept a disclosed adaptation, rebuild, or cancel |

Every hard case in v2 §18 falls out of this one rule:

- **Pilot into vehicle-poor noir** — `implement:platform` needs `vehicles ≥ central`; declaration
  says `incidental`; empty set; player chooses.
- **Fireball with no network** — the netrunner's `prepared-system` is satisfied via
  `networks ≥ local`, but the ability's `area-implement` in a `supernatural: absent` campaign binds
  a physical heavy weapon. The player sees exactly that swap and may pin literal magic instead.
- **Sentient familiar into a drone world** — `implement:companion-sentient` needs
  `companions ≥ sentient`; declaration says `mundane`; empty; player chooses.
- **Scale mismatch** — a fleet admiral's `scale: interstellar` against `scale: local` is the same
  empty-set case on the `scale` axis.
- **Patron without institutions** — `status-authority` needs `institutions ≥ local`; same rule.

The check never judges fiction. It evaluates a closed predicate over ordered enums. Every judgment
is either seed data reviewed once by the owner, or a player choice on the card.

### 6.4 Declaration lifecycle

A declaration edited after characters have bound can silently invalidate their bindings. Rule:

| Phase | Behavior |
|---|---|
| Before the first binding commits | Freely editable by the host |
| After the first binding commits, **loosening** (raising any axis) | Applies immediately. Strictly widens candidate sets; no existing binding can become illegal |
| After the first binding commits, **tightening** (lowering any axis) | Requires a revalidation pass that names every binding that would become illegal, per character. The host resolves each — pin as exception, rebind, or abandon the edit — before the edit commits. Never silent |

Every edit increments `declarationVersion`; every binding records the version it was validated
against, so staleness is detectable rather than inferred.

---

## 7. Pins

An anchor is a pinned slot.

```json
{ "slot": "implement:sidearm", "policy": "literal", "reason": "Inherited from her father" }
```

| Policy | Meaning |
|---|---|
| `literal` | This binding does not change. The destination hosts the source term as an exception, recorded as an approved destination binding (§9) |
| `ask` | Never auto-bound. Always surfaced as an explicit choice |
| *(unpinned)* | Freely bindable from the filtered candidate set, shown on the card |

`identity:*` slots default to `ask`.

**Coverage** — v3 claimed every v2 anchor kind "already exists" in the taxonomy. Four did not. The
corrected mapping:

| v2 anchor kind | v3.1 slot | Status |
|---|---|---|
| power-source | `source:<pattern>` | present in v3 |
| signature-item | `implement:<function>` | present in v3 |
| companion | `implement:companion` / `implement:companion-sentient` | present in v3; sentience split out (§5.8) |
| identity | `identity:name`, `identity:appearance` | present in v3 |
| body | `identity:appearance` + `source:body-alteration` | present in v3 |
| faith | `source:faith-oath` | present in v3 |
| oath | `identity:oath` | **added** — an ethical constraint is not a power source |
| allegiance | `identity:allegiance` | **added** |
| relationship | `relationship:<key>` | **added** — pin semantics only; destination canon remains D13/D16 |
| weakness | `weakness:<key>` | **added** |

---

## 8. Initialization and flow

### 8.1 One onboarding mechanism, three entry points

v3 gave legacy profiles a slot-onboarding path at Translate time and said nothing about how a *new*
character acquires families and slots — v2 at least flagged this as open (its D3-B). One mechanism
serves all three cases:

```
free-text concept (or existing archetype + ability list)
  -> model proposes: primary family, ≤2 secondaries, occupied slots, candidate pins
  -> engine validates structure only (known families, known slots, no numbers, no mechanics)
  -> player reviews a PLAIN-LANGUAGE CAPABILITY SUMMARY:
       "You solve problems at range and pick your moment."
       "You depend on a weapon you must reload."
       "You are vulnerable once someone closes the distance."
     — never a family list, never a class menu, never the 22 ids
  -> player approves or corrects
  -> stored as the character's identity record
```

| Entry point | When | Notes |
|---|---|---|
| **New character** | Campaign creation, after the concept box (`public/index.html:305-307`) | The concept box is unchanged. The summary is new, and it is the first moment the player confirms who this person is mechanically |
| **Legacy profile** | First Translate on a profile with no identity record | Proposes from the stored archetype string and ability list. Nothing inferred becomes canonical without approval |
| **Translate** | Every translation | Reads the existing identity record; never re-derives families and never asks the player to pick one |

The 22 families remain invisible at every entry point. If a candidate translation would change the
family composition, that is a rebuild, not a translation.

### 8.2 Three modes

| Mode | Player meaning | Source mutation | Result |
|---|---|---|---|
| **Continue** | Same person, same sheet, compatible campaign | Checkout only | Exact existing profile (today's `existing`) |
| **Branch** | Exact parallel copy | None | Verbatim copy with lineage (today's `copy`) |
| **Translate** | Destination-genre incarnation of the same character | None | New branch: mechanics verbatim, new bindings |

Translate never fires because a profile merely looks genre-incompatible.

### 8.3 Flow

```text
source profile (identity record present, or onboarding first — §8.1)
  -> destination campaign draft: genre string -> genre class
                                              -> capability declaration (player-visible)
                                              -> vocabulary (generated or existing)
  -> engine copies the mechanical record verbatim; hashes it
  -> engine enumerates the character's slots; applies the §6.3 filter
  -> model proposes bindings for non-empty, unpinned slots (terms and prose only)
  -> engine validates: every binding names a legal candidate; no numbers; no new slots;
     no ability id invented; pinned slots untouched; shared vocabulary not rewritten
       invalid       -> one bounded retry, then honest failure (never playable)
       empty slots   -> card in `needs_choice`
       otherwise     -> card in `ready`
  -> player approves the exact card hash
  -> engine rechecks freshness: source, vocabularyVersion, declarationVersion, card hash
  -> atomic commit: translated profile + bindings + campaign member
  -> opening scene generation, with bindings in council context (§9)
```

### 8.4 Outcomes

| Status | Meaning | Allowed next |
|---|---|---|
| `ready` | Every slot bound; mechanics identical | Approve, pin a slot, or cancel |
| `needs_choice` | ≥1 slot has an empty candidate set | Pin, accept a disclosed adaptation, rebuild, or cancel |
| `invalid` | Model output off-contract | Internal bounded retry; never shown as playable |
| `stale` | Source, vocabulary, declaration, or card hash changed | Recompute and review |
| `committed` | Persisted exactly once | Load campaign |

v2's `incompatible` is gone as a distinct outcome: the only true incompatibility is a
catalog-version mismatch (§3.1), caught before a card is built.

### 8.5 The translation card

Plain language, every change visible:

1. **You are still** — the recognition line, from the family's decision loop (§5.6).
2. **You can still** — preserved signature affordances.
3. **These changed name** — every old → new term, including implements and resources.
4. **These are your pins** — literal exceptions the destination will host as unusual.
5. **These need your decision** — every empty candidate set, naming the axis that emptied it.
6. **Your costs and limits are unchanged** — stated as fact, because they structurally are.
7. **Your progression carries as** — tier and weight, unchanged.

Actions: **Approve exact candidate**, **Pin a slot**, **Choose an offered alternative**, **Cancel**.
Approval carries the card hash and an idempotency key.

---

## 9. Narration binding

A translation correct in the database and wrong in the narrator's mouth has failed. This is an
LLM-led RPG; the words are the product.

1. The character's bindings plus the campaign's shared vocabulary are injected into council context
   as the **naming authority**.
2. **Unapproved source vocabulary is excluded.** Origin terms live in `provenance` (§10), which is
   not part of turn context.
3. **An approved literal pin is a destination binding**, provenance `player-pin`. Her father's
   revolver is *in* the destination binding set, so it is legal in narration and legal in the leak
   test — v3's contradiction (finding 5) was that it forbade every source term while §6.3 permitted
   literal pins.
4. `ability_updates` write to destination ability ids and destination display names. A new ability
   minted in play creates a new `ability:<id>` binding in this campaign only.
5. Renaming an already-bound entry mid-campaign is rejected (§5.4), which is also what
   `rpg-prompts.js:102`'s "must never drift" requires.

**The leak check, stated precisely:**

```
leaked = terms(sourceBindings) − terms(destinationBindings ∪ approvedLiteralPins)
assert: no member of `leaked` appears in the assembled council context
```

A cheap string assertion over a fixture, and the single highest-value test in the plan, because it
is the one the player experiences.

Seat isolation applies unchanged: a seat receives its own character's bindings and the shared
vocabulary, never another character's pins, provenance, or unchosen alternatives
(`.agents/repo-guidance.md`, Runtime Contracts).

---

## 10. Name, history, and provenance

This is profile **text**, not mechanical state, so no rules decision gates it.

| Item | Rule |
|---|---|
| Character name | `identity:name`, pinned `ask`. The card offers: keep verbatim; accept a proposed reframing; or edit freely. Silence keeps it |
| Appearance | `identity:appearance`, pinned `ask`. Genre-inappropriate specifics surface individually, never bulk-rewritten |
| Origin history | **Never rewritten.** Stored as `provenance`: origin campaign id, origin genre, origin role term, translation date. Out-of-world truth; not campaign canon; not in turn context |
| In-world origin framing | `identity:origin`, pinned `ask`. One or two player-approved sentences, or the explicit choice "unstated" |
| Oath, allegiance | `identity:oath`, `identity:allegiance`, pinned `ask`. An oath never becomes institutional loyalty automatically |
| Relationships | `relationship:<key>` exists so a bond can be **pinned** against silent translation. Carrying relationships into destination canon remains D13/D16 |
| Weaknesses | `weakness:<key>`, expression only. A weakness never becomes a strength, structurally, because mechanics do not move |
| Inventory nouns | Translatable today as `implement:*` bindings; today's items are free text `{name, type, description, quantity}` |
| Inventory **mechanics** — condition, provenance, wealth, registry records | D16. Not claimed |

Renaming inventory happens **at branch time into a fresh campaign**, so Chapter 2's name-key
resolution (`docs/rules/effects.md` §1, §2.3) never sees a rename inside a live campaign — an
additional reason Translate must branch rather than mutate.

---

## 11. Staged delivery

Each stage needs its own owner-approved phase and plan; none is authorized here.

### Stage 1 — expression translation over today's free-text profiles

No rules-queue dependency. **Order matters** and is now enforced by finding 2: the identity, binding,
validation, and approval machinery lands *before* anything rewrites canon prose.

| Slice | Work | Exit |
|---|---|---|
| S1.1 | Ability ids: mint, migrate legacy rows, match `ability_updates` on id with name fallback (§4.4) | Renaming no longer forks an ability; legacy rows still match |
| S1.2 | Capability declaration: derive, type, store, expose, lifecycle rules (§6.1, §6.4) | Declaration round-trips; tightening reports affected bindings; loosening is immediate |
| S1.3 | Predicate evaluator + seed tables (§6.2) | Pure, total, fail-closed; every seed row evaluates |
| S1.4 | Vocabulary and bindings: two scopes, immutability, specialization (§5) | Two characters coexist; a late joiner cannot alter established terms |
| S1.5 | Onboarding: concept → families/slots → capability summary → approval, all three entry points (§8.1) | A new character gets an identity record without seeing a class menu |
| S1.6 | Translate mode: verbatim copy, filter, card, hash-bound approval, cancel and resume (§8.3-8.5) | Play cannot begin before approval; source untouched |
| S1.7 | Narration binding and the leak check (§9) | No unapproved source term reaches destination council context |
| S1.8 | Close the §2.1 defect: destination ruleset generation receives the incoming character's abilities as **re-express, do not replace** — at campaign creation only, output diffed on the card, player-approved | A reused profile's rule sheet describes *her* abilities in destination language, and she saw every word change |

S1.8 was S1.6 in v3 and was proposed as a standalone quick win. That was wrong: the ruleset sheet is
the adjudicating model's canon rulebook (`rpg-prompts.js:101-109`), so an unconstrained
re-expression pass changes how the game rules, invisibly. It ships last, gated by the card, and
never after turn 1.

### Stage 2 — catalog-bound abilities

Depends on D5. Mechanics become catalog-bound records; the copy step becomes a literal record copy
and the byte-identity invariant (§12) becomes exact. Requirement predicates may move from vocabulary
rows onto ability records where D5 gives them a home. No change to vocabulary, card, or flow.

### Stage 3 — rebuild

Depends on D5 and an owner decision that rebuild is wanted. A separate player-driven respec, entered
from a `needs_choice` card or an ordinary character screen. Explicitly not translation.

### Stage 4 — non-ability state

Depends on D13/D16: inventory condition, provenance, wealth, item registry records, relationships in
destination canon. Until then, nothing claims a *complete* character has ported.

---

## 12. Verification

Entry point: `node test.js` (`npm test`). Every new behavior test takes the AGENTS.md guard proof —
revert the change, prove the test fails, restore, prove the suite passes.

**The invariant that replaces v2's fingerprint suite:**

```js
// Stage 1: display-bearing fields excluded; Stage 2: whole record.
assert.deepStrictEqual(translated.mechanics, source.mechanics);
```

| Area | Required coverage |
|---|---|
| Identity | Mechanics deep-equal across translation; source unmutated; lineage recorded |
| Round trip | **Mechanics identical at every hop, unconditionally.** Binding restoration claimed **only** when translating back into the *original* campaign — a fresh campaign of the origin genre legitimately generates different terms, and v3's unqualified W→F→W claim was false |
| Ability ids | Match on id after rename; legacy name-keyed rows still match; ids survive Branch, Translate, export, and import remapping |
| Predicates | `all`/`any`/`gte`/`eq`/`not`, empty `all` true, empty `any` false, depth cap, unknown axis or value fails closed; every seed row evaluates against every genre class |
| Filter | Non-empty binds; empty-and-pinned yields exception; empty-and-unpinned yields `needs_choice`; each §6.3 guard case as a fixture |
| Declaration lifecycle | Loosening applies immediately; tightening reports every affected binding and blocks until resolved; `declarationVersion` staleness detected |
| Two scopes | Two characters in one campaign each keep their own identity; shared terms shared; specialization does not rewrite the shared entry; late joiner cannot alter established terms |
| Model containment | Adversarial fixtures: invented ability ids, numbers in prose, new slots, edits to pinned slots, rewrites of shared vocabulary, bindings outside the candidate set — all rejected, bounded retry, honest non-playable failure |
| Narration | Leak check per §9's set difference, including a case where an approved literal pin **must** appear and must not be flagged |
| Card | Every changed term appears; no unchosen alternative hidden; approval hash-bound and idempotent |
| Draft flow | ready / needs_choice / stale / retry / cancel; restart-safe; play cannot precede approval |
| Compatibility | Legacy profiles: Continue and Branch unchanged; old bundles import; new bundles round-trip vocabulary, bindings, pins, provenance, ability ids; unknown schema fails closed |
| Seat isolation | Bindings, pins, provenance, alternatives do not cross seats; re-run leak and route guards per `.agents/repo-guidance.md` |

**Manual / playtest** (the phase review gate in `.agents/repo-guidance.md` applies):

1. Western gunslinger → high fantasy. 2. Fantasy wizard → cyberpunk, physical-output swap visible.
3. Rogue → three destinations. 4. Pilot → vehicle-poor destination produces a choice, not a silent
downgrade. 5. Sentient companion → technological destination requires a choice. 6. Cancel, reload,
resume, retry. 7. Translate from an active source leaves the source untouched. 8. Two translated
characters at one table keep distinct identities and shared world vocabulary. 9. A late joiner
translates without shifting established vocabulary. 10. **Ten turns of real play with no vocabulary
reversion**, including a literal-pinned item appearing naturally in narration.

Bar: before the first turn the player can state what the character can do, what changed, what it
costs, and what remains impossible — and after ten turns the narrator still speaks the destination's
language.

---

## 13. Persistence sketch

Names are proposals; an approved phase may rename while preserving the contract.

**Profile** (`player_characters`, nullable additions): `identity_json` (families, slots, pins,
provenance), `translated_from_character_id` — Translate lineage, kept distinct from
`copied_from_character_id`, which stays exact-Branch lineage.

**Campaign** (nullable additions): `capability_json`, `declaration_version`, `vocabulary_json`,
`vocabulary_version`.

**Bindings**: per (character, campaign). The campaign-local `characters` row snapshots the approved
bindings exactly as campaign members are snapshotted today.

**Draft**: Translate needs destination vocabulary before approval and must survive a reload, so it
needs a persisted `campaign_creation_drafts` record — id, status, genre and table settings, source
profile id and hashes, generated outline/ruleset/declaration/vocabulary, card and card hash, player
choices, timestamps, idempotency and commit result. `new`, `existing`, and `copy` keep their current
synchronous route; only Translate requires the draft flow.

**Endpoints**: `POST /api/campaign-drafts`, `GET /api/campaign-drafts/:id`,
`POST /api/campaign-drafts/:id/choices`, `POST /api/campaign-drafts/:id/approve` (card hash plus
idempotency key), `POST /api/campaign-drafts/:id/cancel`. All host-authorized.

**Commit ordering**: generate and validate outside the write transaction → persist draft and hashes
→ on approval re-read and reject stale or consumed state → generate remaining opening-scene material
against the approved card → one write transaction creating the translated profile, lineage,
campaign, outline, ruleset, vocabulary, bindings, party member, locations, NPCs, turn state, then
marking the draft committed → an identical retry returns the committed result.

---

## 14. Non-goals

- A class-name dictionary assuming every noun has a safe counterpart.
- A player-facing menu of 22 families, or open primary-plus-two-secondary multiclassing.
- Model-generated numbers, operations, costs, or mechanical permissions.
- Silent conversion of a pinned slot.
- Mutating the source character in place.
- Rewriting canon ruleset prose after play has begun.
- Claiming complete portability before D13/D16 settle non-ability state.
- Changing the settled D0 rulebook per campaign.
- Mechanical rebuild inside Translate.
- Implementing any part of this plan before a concrete phase and its owner gates are approved.

---

## 15. Honest risks against v3.1

1. **Two scopes cost more than one.** The split (finding 1) is correct but adds a join, a
   specialization path, and two version fields. A single-character table would have been simpler and
   wrong.
2. **Vocabulary generation costs a call.** Mitigation: fold into the existing outline call
   (`rpg-engine.js:1113`), or generate lazily on first Translate. Unmitigated it adds creation
   latency.
3. **Slot taxonomy grew 8 → 12** to fix the pin overclaim. Each addition is a schema change and seed
   rows per genre class. Needs a standing rule: new slots arrive by owner decision, not convenience.
4. **"Mechanics never change" will feel harsh.** A player whose signature move has no destination
   home is told to pin or rebuild. Honest, and D0 — but a worse *feeling* than a plausible silent
   substitution, which is exactly why v2 reached for one. The card's wording carries this weight and
   should be playtested as copy, not just as data.
5. **A wrong declaration mis-filters.** Mitigated by host visibility, editability, and empty sets
   naming the axis that emptied them — never eliminated.
6. **S1.8 still rewrites canon prose**, even gated. The diff card is the whole safety mechanism; if
   players click through it, drift ships anyway. Worth a dedicated playtest observation.
7. **The 22 families remain unvalidated by play.** Reviewed design vocabulary, not evidence. Only
   the §12 playtests can promote them.
8. **Genre classification of free text is fuzzy.** Mitigated by affecting only seed selection and
   default axes, both visible and editable, never mechanics.

---

## 16. Owner gates

Taken in chat one at a time and recorded durably. This plan infers none of them.

1. **The architecture** — mechanics copied verbatim plus per-campaign bindings, replacing v2's
   candidate-plus-equivalence-proof. Everything depends on this. *Recommendation: adopt.* It is
   smaller, decidable, testable by structural identity, and it is what D0 already implies.
2. **Stage 1 as a phase**, in the S1.1 → S1.8 order. The order is load-bearing, not stylistic.
3. **The capability axes** (§6.1) — nine ordered enums, or a different set.
4. **The slot taxonomy** (§5.3) — twelve families, and the rule for adding more.
5. **Families and their internal-only status** (§5.6) — approve, refine, or cut Generalist.
6. **Onboarding shape** (§8.1) — plain-language capability summary at character creation, answering
   v2's deferred D3-B without a class menu.
7. **Name and history policy** (§10) — settled here rather than deferred, because it is text.
8. **D5 ability packaging** — Stage 2 only.
9. **D13/D16 non-ability state** — Stage 4 only.

The first ruling is gate 1. Nothing below it is actionable. Unlike v3, **no slice is proposed as
standalone**: S1.8's quick-win framing was the defect finding 2 caught.
