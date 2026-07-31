# Cross-genre character portability — v3.1

**Status**: ACTIVE working draft. **Gates 1-2 (§16) adopted/approved by the owner 2026-07-31** —
recorded in `.agents/decisions.md`. Gates 3-7 remain unruled. Phase PT is approved in `plan.md`;
remaining gates govern their affected slices. Gate 1's one-persistent-character amendment controls
any older wording below.

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
| 1 | One shared campaign lexicon with generic keys (`role`, `identity:name`) cannot hold two characters — the second overwrites the first | Split into **campaign-scope vocabulary** (`role:marksman`, `implement:sidearm` — semantic key, shared) and **character-scope bindings** (eligible name wording, pins, and ability expression that references shared vocabulary without a separate `uses` row) | §5 |
| 2 | "Stage 1 is mechanically risk-free — nothing mechanical can break" | **Withdrawn.** The ruleset sheet is injected as `CAMPAIGN RULES (CANON — these must never drift)` and the model adjudicates from it (`rpg-prompts.js:101-109`); character ability prose is also in context (`rpg-prompts.js:156`). No *engine-executed* ability mechanics exist yet, but prose **is** the operative rulebook. S1.8 ships last, behind ids, bindings, validation, and player approval, and runs only during the campaign-entry handoff before activation — never as a rewrite of approved wording during play | §2, §11 |
| 3 | The §6.2 filter supported only conjunctions of `>=` thresholds, while the seed tables used `or`, `=`, and prose inheritance | Small formal predicate grammar: `all`, `any`, `gte`, `eq`, `not`. Inheritance is expanded literally in the data; no prose references survive | §6.2 |
| 4 | §7 claimed every v2 anchor kind "already exists" in the slot taxonomy — relationship, weakness, oath, and allegiance did not | Four slot families added explicitly (`identity:oath`, `identity:allegiance`, `relationship:<key>`, `weakness:<key>`). The overclaim is deleted and replaced by a coverage table | §5.2, §7 |
| 5 | Literal pins permit wording also used in another campaign, but the leak test rejected *every* such term — the two contradicted | An approved literal pin **is** a destination binding (provenance `player-pin`). The test asserts no *unapproved* cross-campaign wording, computed as other-campaign terms minus the approved binding set | §9 |
| 6 | New-character initialization was missing; only legacy profiles had a translation-time onboarding path | One identity onboarding serves new and legacy characters: concept → proposed families and slots → plain-language summary → player approval. Later campaign moves read that same identity record. Never a class menu | §8.1 |
| 7 | Ability-ID scope assignment undefined | Globally unique, engine-issued, minted once, retained on the same persistent character across campaign moves, and remapped only by bundle import | §4.4 |
| 8 | Capability declaration editable at any time, silently invalidating existing bindings | Superseded by the 2026-07-31 authority ruling: ordinary play has no host/player declaration editor; GM worldbuilding moves forward in fiction, never by retroactive settings rewrite | §6.4 |
| 9 | Round-trip claim ("W→F→W restores original bindings exactly") was scoped to an "original" profile rather than the persistent character | Corrected: returning to any previously visited campaign reuses that character's saved bindings exactly; only abilities gained since the prior visit need new bindings | §8, §12 |

Unchanged from v3: the immutable-mechanics thesis (§3), capability-filtered
permission as the sole definition of "no honest equivalent", pins, the card, the narration binding,
and the staged delivery shape.

### 1.1 Amendments after gate 1 (2026-07-31)

Gate 1 was adopted by the owner 2026-07-31 (`.agents/decisions.md`). Before gate 2, the read that
recommended adoption named three seams plus one missing definition; all four are folded into the
body below and mapped here so the delta is checkable:

| # | Seam | Fix | § |
|---|---|---|---|
| A | S1.8 derived ruleset `cost`/`effect`/`limits` from character prose, but the two shipped ability surfaces had no canonical link before D5 | S1.8 establishes a stable mechanic reference for any linked ability and projects that one canonical record into GM context with the destination display binding. It persists no destination mechanics copy. An ability with no canonical mechanic entry remains underived and is disclosed on the card; fuller packaging waits for Stage 2 / D5 | §11 |
| B | New-character onboarding rode the synchronous `new` route, so its capability-summary approval could not survive reload | Every flow containing a player-approval step persists a draft: onboarding and any campaign move needing new bindings. `existing` and explicit manual `copy` (no approval step) stay synchronous; manual copy is not portability | §8.1, §13 |
| C | Tightening a campaign declaration was host-resolved, letting a host rewrite other players' characters | **Superseded by the 2026-07-31 authority ruling:** no ordinary host/player declaration edit surface; the creator chooses at creation and later GM worldbuilding evolves only through play | §6.4 |
| D | "Candidate" was used without a closed definition | A **legal expression candidate** is a known semantic key (campaign vocabulary or seed taxonomy — never model-minted) whose engine-owned predicate passes against the current declaration, with its bound term still player-approved | §6.3 |
| E | Gate 1 still described Continue/Branch/Translate as three result profiles | One persistent character record moves between campaigns. The same id, mechanics, and progression travel; only per-campaign expression bindings differ. Saved bindings are reused exactly, and portability creates no branch, alternate version, or merge | §3, §4, §8, §10-§14 |

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
- **Shipped storage still reflects the old model**: profiles persist archetype, attributes,
  inventory, abilities, progression, checkout, and explicit manual-copy lineage
  (`db.js:240-265`); campaigns persist genre and `ruleset_json`
  (`db.js:92-95`, `db.js:121`). That is implementation evidence, not the approved portability
  result. Phase PT must keep portability on one canonical character record and leave manual copy
  separate.

### 2.1 The shipped defect, and the correct risk statement

**Defect**: the engine already re-expresses the rules for each genre; it does not know it is
re-expressing *the same character*. A western gunslinger entering a fantasy campaign gets a fantasy
rule sheet describing abilities that are not hers, alongside her own untranslated revolver
abilities.

**Risk, stated correctly** (v3 got this wrong): today's abilities have no *engine-executed*
mechanics — nothing in `rpg-state.js` or the catalog runs them. But the **model** is the adjudicator
and both ability surfaces are its rulebook. Re-expressing that prose therefore *can* change how the
game adjudicates, even though no engine number moves. Two consequences:

1. Re-expression is legal only during the destination campaign-entry handoff, before the
   character becomes active there. A return may add a missing binding for an ability gained
   elsewhere, but it never rewrites an already approved destination binding during play.
2. Re-expression must be constrained and player-approved, never a free model pass. S1.8 ships last,
   behind the card (§11).


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

D0 says one rulebook applies across campaigns. Chapter 2 says abilities are selections from a
versioned catalog. A cross-genre move therefore cannot change mechanics: the same catalog is in
force on both sides.

v2 tried to generate a destination ability and prove it equivalent to the source. That has no stable
operating point: a generated candidate either copies the source mechanics, making the proof
ceremonial, or changes them, making the proof false.

**Portability never copies the mechanical record.** The same persistent character record, with the
same id, abilities, packaging, attributes, and progression, moves from one active campaign to
another. Only expression bindings are stored per campaign. Equivalence is not inferred or proved;
there is no second mechanical record to compare.

Two real problems remain:

1. **Naming** — each campaign needs its own words, used consistently whenever the system speaks to
   the player → §5.
2. **Permission** — the destination fiction may not honestly host a particular expression → §6.

Everything v2 called "no honest equivalent" belongs to problem 2.

### 3.1 When mechanics genuinely must change

| Case | Disposition |
|---|---|
| Destination pins a different `catalog_version` | The move cannot commit. Chapter 2 §1.1 makes a version change an owner-approved migration; the character may move only after the campaigns share the migrated version, or the player cancels |
| A slot has no legal candidate and the player will not pin it | **Rebuild** — separate, future, player-driven respec of the same character. A move never silently narrows the character |
| The player wants different mechanics | Rebuild. That is a character-change feature, not translation |

---

## 4. The artifacts

### 4.1 Campaign capability declaration

Proposed ordered facts describing what the destination fiction can host. The Setup GM derives them
from the creator's setting choice at campaign creation. They support portability internally; they
are not an ordinary host/player setting surface. Gate 3 owns the remaining shape. See §6.

### 4.2 Campaign vocabulary (campaign scope)

Semantic key → destination term, with requirement predicates and provenance. Shared by every
character in the campaign. See §5.2.

### 4.3 Persistent character and campaign bindings

```text
mechanics — ability records, packaging, progression, and attributes.
            Owned by the engine. One canonical record travels with the character.
            Portability never copies, re-derives, or lets a model touch it.
            D5 later defines the fuller ability package.

identity  — families and functional slots classify what the character's abilities need to
            express. They are not campaign bindings and do not assert equipment, history,
            relationships, or other D13/D16 state.

bindings  — expression only, stored per (character, campaign):
            Stage 1 contains ability display names, ability prose, and pins
            limited to Stage-1-eligible ability expression. It contains name wording only if
            Gate 7 admits it. A return reuses saved bindings exactly. A move proposes only
            destination bindings that are missing.

pins      — the player's non-negotiable name or ability wording. Owned by the player. §7.
```

Persistent identity taxonomy, not a campaign-local binding:

```json
{
  "schemaVersion": 1,
  "characterId": "pc_7f2",
  "abilityIds": ["a41", "a42"],
  "families": { "primary": "marksman", "secondary": ["duelist"] },
  "expressionSlots": [
    "role:marksman",
    "source:precision-projectile",
    "implement:sidearm",
    "implement:long-range",
    "resource:ammunition",
    "ability:a41",
    "ability:a42"
  ]
}
```

Stage 1 campaign binding:

```json
{
  "schemaVersion": 1,
  "characterId": "pc_7f2",
  "campaignId": 41,
  "vocabularyVersion": 1,
  "abilities": [
    { "abilityId": "a41", "term": "Quick Draw", "prose": "She acts before her foe can react." }
  ],
  "literalPins": [
    { "slot": "ability:a41", "term": "Quick Draw", "reason": "Player keeps this ability wording" }
  ]
}
```

The character record stores **no second mechanical vocabulary** — no `reach`, `targetShape`,
`delivery`, `tempo`, `setup`, `costShapeRef`, `reliabilityBand`, or fingerprint. Where present, those
live on the canonical mechanic record/reference; D5 later owns fuller ability packaging and D6 owns
spatial vocabulary. Duplicating them into campaign bindings would create a drifting mechanical copy.

### 4.4 Ability identity

Today an ability is matched by lowercased display name (`rpg-engine.js:127`). If a campaign calls
"Quick Draw" "Fast Nock", the next level-up can mistakenly create a second ability. Stable ids are
therefore a hard precondition, not a nicety.

| Property | Rule |
|---|---|
| Scope | **Globally unique when minted**, engine-issued, and not campaign-scoped. The one persistent character keeps the same ids everywhere |
| Minting | Once, on first existence — Setup generation, an `ability_updates` insert, or one-shot legacy backfill keyed by the current name within the profile |
| Stability | The ids remain on the same ability records while the character moves; expression bindings never replace them |
| Matching | `applyAbilityUpdates` matches on id; name matching survives only as a fallback for legacy rows without an id |
| Display | Never identity. Display names live in bindings keyed by `ability:<id>` |
| Import/manual copy | Bundles remap ids under the existing entity mapping. Explicit manual character copy retains its shipped behavior but is not a portability path |

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

**Character scope — bindings**, per (character, campaign). Ability rows may draw wording from shared
campaign vocabulary through the persistent identity taxonomy; Stage 1 stores no separate `uses` or
specialization row. The `identity` member shown below exists only if Gate 7 admits campaign-specific
name wording:

```json
{
  "characterId": 88, "campaignId": 41, "vocabularyVersion": 1,
  "identity": { "name": "Cassidy of Blackwater" },
  "abilities": [
    { "abilityId": "a41", "term": "Fast Nock",
      "prose": "She has an arrow away before the string stops humming." }
  ],
  "literalPins": [
    { "slot": "ability:a41", "term": "Fast Nock",
      "approvedAt": "…", "exception": true }
  ]
}
```

Stage 1 has no separate role-title specialization. Ability-specific term and prose stay on that
ability's binding, and the shared campaign entry is never rewritten. Any later role-title
specialization requires its own approved scope.

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
| Identity | `identity:name`, `identity:appearance`, `identity:origin` | character | persistent character | Only `identity:name` is eligible for Gate 7 / Stage 1; appearance and origin are reserved for D13/D16 |
| Oath | `identity:oath` | character | reserved | Taxonomy placeholder only; no Stage 1 persistence, pin, or transport before D13/D16 |
| Allegiance | `identity:allegiance` | character | reserved | Taxonomy placeholder only; no Stage 1 persistence, pin, or transport before D13/D16 |
| Relationship | `relationship:<key>` | character | reserved | Taxonomy placeholder only; no Stage 1 persistence, pin, or transport before D13/D16 |
| Weakness | `weakness:<key>` | character | reserved | Taxonomy placeholder only; no Stage 1 persistence, pin, or transport before D13/D16 |

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
   `vocabularyVersion` and whatever capability snapshot/revision contract Gate 3 adopts.

### 5.5 Genre classes

Free-text genre is classified into one primary class plus free tone modifiers, purely to select seed
rows and proposed default axes; it never touches mechanics. Gate 3 must settle any creation-time
confirmation and visibility. There is no after-creation player/host correction control.

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

Proposed as fixed, small, and ordered. The Setup GM derives them from the creator's setting choice at
campaign creation and the engine types them. Gate 3 must settle the exact axes, creation-time
confirmation, visibility, and whether the stored declaration is a snapshot or follows forward-only
GM worldbuilding. It is never an ordinary host/player settings control (§6.4).

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

**Definition (amendment D).** A **legal expression candidate** for a slot is a semantic key that
is (a) **known** — present in the campaign vocabulary or in the seed taxonomy for the campaign's
genre class; models select among known keys and never mint one — and (b) **permitted** — its
engine-owned `requires` predicate evaluates true against the current capability declaration,
fail-closed per §6.2. Legality is computed by the engine alone; the *term* bound to a legal
candidate remains player-approved on the card. Everything below quantifies over legal candidates.

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
- **Sentient-companion-themed ability in a drone world** — `implement:companion-sentient` needs
  `companions ≥ sentient`; declaration says `mundane`; empty; player chooses. This filters ability
  wording only; no companion entity or relationship moves in Stage 1.
- **Scale mismatch** — a fleet admiral's `scale: interstellar` against `scale: local` is the same
  empty-set case on the `scale` axis.
- **Patron without institutions** — `status-authority` needs `institutions ≥ local`; same rule.

The check never judges fiction. It evaluates a closed predicate over ordered enums. Every judgment
is either seed data reviewed once by the owner, or a player choice on the card.

### 6.4 Authority and lifecycle

The creator chooses the campaign's initial setting at creation, before any other player joins. The
Setup GM derives the declaration from that request. The declaration supports the portability engine;
it is not a setting screen.

Once play begins, the GM's worldbuilding and rulings stand. A player may ask why something is true;
the GM may explain it, affirm it, or evolve the world forward through later play. Established fiction
is never retroactively replaced. Players either accept the GM's worldbuilding or start a new
campaign. No ordinary player or host action edits the declaration.

Gate 3 must settle whether the stored declaration is a creation-time snapshot or internal state that
can follow forward-only GM worldbuilding, and what revision or freshness field that behavior needs.
A host-only administrative campaign editor is a separate Future Topic, not part of Stage 1.

---

## 7. Pins

In Stage 1, an anchor is a pinned name or ability-expression slot.

```json
{ "slot": "ability:a41", "policy": "literal", "reason": "Player keeps the ability name 'Quick Draw'" }
```

| Policy | Meaning |
|---|---|
| `literal` | This binding does not change. The destination hosts the chosen term as an exception, recorded as an approved destination binding (§9) |
| `ask` | Never auto-bound. Always surfaced as an explicit choice |
| *(unpinned)* | Freely bindable from the filtered candidate set, shown on the card |

`identity:name` defaults to `ask` if Gate 7 admits campaign-specific name wording. Other identity and non-ability slots have no Stage 1 pin policy.

**Coverage** — v3 claimed every v2 anchor kind "already exists" in the taxonomy. Four did not. The
corrected mapping:

| v2 anchor kind | v3.1 slot | Status |
|---|---|---|
| power-source | `source:<pattern>` | Stage 1 ability-expression taxonomy only; does not establish oath or history |
| signature-item | `implement:<function>` | May describe an ability's delivery; durable item identity and inventory are reserved for D13/D16 |
| companion | `implement:companion` / `implement:companion-sentient` | May classify an ability; companion entity and relationship state are reserved for D13/D16 |
| identity | `identity:name`, `identity:appearance` | `identity:name` is Gate-7-eligible; appearance is reserved for D13/D16 |
| body | `identity:appearance` + `source:body-alteration` | Ability source may be classified; appearance and body state are reserved for D13/D16 |
| faith | `source:faith-oath` | Ability source may be classified; belief, oath, and history are reserved for D13/D16 |
| oath | `identity:oath` | **reserved** — taxonomy only; D13/D16 owns persistence and transport |
| allegiance | `identity:allegiance` | **reserved** — taxonomy only; D13/D16 owns persistence and transport |
| relationship | `relationship:<key>` | **reserved** — taxonomy only; D13/D16 owns persistence and transport |
| weakness | `weakness:<key>` | **reserved** — taxonomy only; D13/D16 owns persistence and transport |

The oath, allegiance, relationship, weakness, appearance, origin, durable-item, and companion-state
meanings are taxonomy placeholders for later gates. Functional source or implement keys in Stage 1
classify ability expression only; they do not establish or transport those facts. Stage 1 does not
pin, persist, translate, or transport deferred state unless the relevant D13/D16 decision explicitly
brings it into scope.

---

## 8. Character initialization and campaign movement

### 8.1 One identity-onboarding mechanism

v3 gave legacy profiles a slot-onboarding path at translation time but did not say how a new
character acquires families and slots. One mechanism serves both cases:

```text
free-text concept (or a legacy archetype + ability list)
 -> model proposes: primary family, ≤2 secondaries, occupied slots,
    candidate pins for Stage-1-eligible name or ability-expression slots only
  -> engine validates structure only: known families, known slots, no numbers, no mechanics
  -> player reviews a PLAIN-LANGUAGE CAPABILITY SUMMARY:
       "You solve problems at range by picking your moment."
       "You depend on a weapon you must reload."
       "You are vulnerable once someone closes the distance."
     — never a family list, class menu, or 22 internal ids
  -> player approves or corrects it
  -> engine stores it on the one persistent character record
```

| Entry point | When | Notes |
|---|---|---|
| **New character** | Campaign creation, after the concept box (`public/index.html:305-307`) | The concept box stays. The summary is the first moment the player confirms who this person is mechanically |
| **Legacy character** | First campaign move when the character has no identity record | Proposes from the stored archetype string and ability list. Nothing inferred becomes canonical without approval |
| **Later campaign move** | Every later move | Reads the existing identity record; never re-derives families or asks the player to pick one |

The 22 families remain invisible at every entry point. If a proposed expression would change family
composition, that is rebuild, not portability.

**Persistence (amendment B).** Any propose → summarize → approve sequence is a persisted draft, not
a live request: proposed families, slots, Stage-1-eligible name or ability-expression pins, the
plain-language summary, and approval
state survive reload, and approval is bound to the exact content the player saw. Explicit manual
`copy` remains the current synchronous feature because it has no approval step; it is not a
portability path.

### 8.2 One character move, with or without new wording

Portability has one result: the same character becomes active in the destination campaign. The
destination may be an existing campaign or a new campaign still being drafted.

| Path | When | Result |
|---|---|---|
| **First entry** | The character has no saved bindings for this destination | Fill the name/ability expression bindings Gate 7 admits to Stage 1, then move the same character |
| **Return with no new abilities** | Every current ability already has an approved destination binding | Reuse all saved destination wording exactly and move the same character |
| **Return with new abilities** | The character gained abilities since the prior visit | Reuse all saved wording exactly; propose and approve only the missing destination bindings for those abilities; then move the same character |

Neither path creates a profile, branch, incarnation, lineage record, or merge. The character remains
active in the current campaign until the destination move commits. Returning to an existing campaign
never recreates that campaign, its rules, history, or opening scene.

### 8.3 Flow

```text
persistent character, active in one campaign
  -> choose destination:
       existing campaign -> load its stored facts, vocabulary, bindings, and current scene
       new campaign      -> persist a creation/move draft; generate and validate all campaign
                            material before any membership switch
  -> verify the same catalog version; otherwise cancel or await an owner-approved migration (§3.1)
  -> load saved (character, destination campaign) expression bindings
  -> determine missing bindings:
       first entry -> only the name/ability expression slots Gate 7 admits to Stage 1
       return      -> only abilities gained since the prior visit with no destination binding
  -> if missing is empty: present move confirmation using saved wording exactly
  -> otherwise:
       engine applies the §6.3 filter only to missing bindings
       model proposes terms and prose only for non-empty, unpinned missing bindings
       engine validates: legal candidate names; no numbers; no new slots or ability ids;
                         pins untouched; shared vocabulary not rewritten
       invalid -> one bounded retry, then honest failure
       empty candidate set -> card in `needs_choice`
       otherwise -> card in `ready`
  -> player approves the exact card hash
  -> engine rechecks the same character id and mechanics/progression revision,
     destination vocabulary version, Gate-3 capability revision/hash, and card hash
  -> prepare and validate everything needed after commit:
       existing campaign -> current-scene/join presentation only; no opening-scene regeneration
       new campaign      -> complete opening-scene and campaign material
  -> one transaction:
       create new campaign material only when destination is new
       persist newly approved destination bindings
       deactivate current campaign membership
       activate destination membership for the same character id
       mark the draft committed
  -> existing destination loads its current scene; new destination returns its opening scene
```

Cancel, stale review, invalid output, exhausted retry, or any preparation/transaction failure leaves
the character and current campaign membership unchanged.

### 8.4 Outcomes

| Status | Meaning | Allowed next |
|---|---|---|
| `ready` | Every required first-entry binding, or every newly gained ability on return, has a saved or proposed destination binding; the mechanical record is unchanged | Approve, pin a missing ability expression, or cancel |
| `needs_choice` | At least one required name/ability expression has an empty candidate set | Pin, accept a disclosed adaptation, rebuild, or cancel |
| `invalid` | Model output is off-contract | Internal bounded retry; never playable |
| `stale` | Character mechanics/progression, destination vocabulary/declaration, or the card changed | Recompute and review |
| `committed` | Any new campaign material, new bindings, and the same character's active-campaign switch persisted exactly once | Load the destination campaign without recreating existing campaign state |
| `cancelled` | The player cancelled before commit | Remain in the current campaign |

The only true incompatibility is a catalog-version mismatch (§3.1), caught before a card is built.

### 8.5 Translation card

Plain language, with only real changes shown:

1. **You still** — recognition line from the family's decision loop (§5.6).
2. **Already established here** — saved destination wording that will be reused exactly.
3. **These need a name here** — on first entry, only the name/ability expressions Gate 7 admits;
   on return, only abilities gained since the prior visit with no destination binding.
4. **These pins remain literal** — approved name or ability-expression exceptions the destination
   will host as unusual.
5. **These need your decision** — every empty candidate set, naming the fact that emptied it.
6. **Your costs and limits are unchanged** — a stated fact, structurally true.
7. **Your progression travels with you** — the same level, XP, and tiers remain on the character.

Actions: **Approve this move**, **Pin a missing ability expression**, **Choose an offered
alternative**, or **Cancel**. Approval carries the card hash and an idempotency key.

---


## 9. Narration binding

A translation correct in the database and wrong in the narrator's mouth has failed. This is an
LLM-led RPG; the words are the product.

1. The character's bindings plus the campaign's shared vocabulary are injected into council context
   as the **naming authority**.
2. **Unapproved wording from other campaigns is excluded.** It remains only in those campaigns'
   saved bindings and is not part of the active turn context.
3. **An approved literal pin is a destination binding**, provenance `player-pin`. The ability name
   "Quick Draw" is *in* the destination binding set, so it is legal in narration and in the leak
   test — v3's contradiction (finding 5) was that it rejected any wording also used in another
   campaign while §6.3 permitted literal pins.
4. `ability_updates` write stable ability ids and the current campaign's display names. A new
   ability minted in play creates a new `ability:<id>` binding in this campaign only.
5. Renaming an already-bound entry mid-campaign is rejected (§5.4), which is also what
   `rpg-prompts.js:102`'s "must never drift" requires.

**The leak check, stated precisely:**

```
leaked = terms(otherCampaignBindings) − terms(activeCampaignBindings ∪ approvedLiteralPins)
assert: no member of `leaked` appears in the assembled council context
```

A cheap string assertion over a fixture, and the single highest-value test in the plan, because it
is the one the player experiences.

Seat isolation applies unchanged: a seat receives its own character's bindings and the shared
vocabulary, never another character's pins, binding provenance, or unchosen alternatives
(`.agents/repo-guidance.md`, Runtime Contracts).

---

## 10. Name and ability wording; all other character state deferred

Gate 7 owns the Stage 1 name policy. This section proposes only expression behavior; it does not
authorize history or other character-state transport.

| Item | Stage 1 boundary |
|---|---|
| Character name | If Gate 7 admits a campaign-specific name binding, the card may offer keep verbatim, accept proposed wording, or edit. A saved destination name is reused exactly on return |
| Ability display name and prose | Stored per `(character, campaign)` and keyed by stable ability id. Existing rows are reused exactly; on return, only newly gained abilities can require new rows |
| Appearance, origin, history, biographical provenance, oaths, allegiance, relationships, weaknesses, inventory nouns, and inventory mechanics | **Deferred wholesale to D13/D16.** Stage 1 does not translate, pin, transport, persist, inject, or promise bundle round-trip behavior for them |

The broader slot-taxonomy rows in §5/§7 are future vocabulary placeholders. Until their owner gates
close, Stage 1 implements only the name/ability expression slots Gate 7 explicitly approves.

---

## 11. Staged delivery

Each stage needs its own owner-approved phase plan; none is authorized merely by this document.

### Stage 1 — expression translation over today's free-text characters

No rules-queue dependency. Order matters: identity, bindings, validation, and approval machinery land
before anything rewrites canon prose.

| Slice | Work | Exit |
|---|---|---|
| S1.1 | Ability ids: mint, migrate legacy rows, match `ability_updates` on id with name fallback (§4.4) | Renaming no longer forks an ability; legacy rows still match |
| S1.2 | Campaign capability facts: derive from creator's setting choice, type, store, enforce the authority boundary (§6.1, §6.4) | Creation-time record round-trips; Gate-3 snapshot/evolution behavior holds; no ordinary host/player rewrite route |
| S1.3 | Predicate evaluator and genre seed tables (§6.2, §5.5-5.9) | Every seed row evaluates fail-closed; grammar guards pass |
| S1.4 | Campaign vocabulary plus per-(character, campaign) expression bindings (§5) | Two characters coexist; saved bindings are immutable and reusable; no mechanics/progression snapshot is stored per campaign |
| S1.5 | Identity onboarding, families, slots, pins, and restart-safe approval (§8.1) | New and legacy characters get one approved identity record without a class menu |
| S1.6 | Drafted move of the persistent character (§8.2-8.5) | Same character id before and after; exactly one active campaign; return reuses saved wording; only missing ability bindings are proposed; every non-approved outcome leaves current membership unchanged |
| S1.7 | Narration binding and leak check (§9) | No unapproved term reaches destination council context |
| S1.8 | Close the §2.1 defect without copying mechanics: after S1.1, link any matching ruleset ability to one canonical mechanic record/reference on the persistent character. At GM-context assembly, project that record's `cost`, `effect`, and `limits` and overlay only the active campaign's display binding. Persist no destination mechanical row. An ability with no canonical mechanic entry remains profile prose, disclosed on the card. Campaign-entry handoff only | GM context names the character's abilities in destination language while resolving mechanics from the same canonical record; the player saw every wording change |

S1.8 was once proposed as a standalone quick win. That was wrong: the ruleset sheet is the
adjudicating model's canon rulebook (`rpg-prompts.js:101-109`), so an unconstrained re-expression
pass changes how the game rules invisibly. It ships last and is card-gated. It runs only during the
campaign-entry handoff, including a return that needs wording for a newly gained ability; it never
rewrites approved rows while the character is active in that campaign.


### Stage 2 — catalog-bound abilities

Depends on D5. Mechanics become catalog-bound records on the same persistent character. A campaign
move still never copies or reconstructs them; the unchanged record makes the identity invariant
exact. Requirement predicates may move from vocabulary rows onto ability records where D5 gives
them a home. The vocabulary, card, and move flow do not change.

### Stage 3 — rebuild

Depends on D5 and on an owner decision that rebuild is wanted. It is a separate player-driven respec
of the same character, entered from a `needs_choice` card or ordinary character management. It is
not an automatic translation and never creates an alternate version.

### Stage 4 — non-ability state

Depends on D13/D16. Inventory, relationships, history, and other non-ability state are intentionally
not decided by the one-character ability-portability contract.

---

## 12. Verification

Entry point: `node test.js` (`npm test`). Every new behavior test takes the AGENTS.md guard proof:
revert the change, prove the test fails, restore it, prove the suite passes.

**The invariant replaces the prior two-record comparison entirely:**

```js
const idBefore = character.id;
const mechanicsBefore = structuredClone(character.mechanics);
await approveCampaignMove(character.id, destinationCampaignId);

assert.strictEqual(character.id, idBefore);
assert.deepStrictEqual(character.mechanics, mechanicsBefore);
assert.strictEqual(character.activeCampaignId, destinationCampaignId);
assert.strictEqual(activeMembershipCount(character.id), 1);
```

| Area | Required coverage |
|---|---|
| Identity | Same character id before and after every move; one canonical record and no duplicate or reconciliation state |
| Mechanics/progression | One canonical record remains unchanged by translation and carries all later level/XP/tier changes |
| Round trip | Returning to any previously visited campaign reuses its saved bindings exactly |
| New abilities | An ability gained after leaving a campaign keeps its id and mechanics; on return only its missing destination binding is proposed |
| Atomic move | Approval persists new bindings and switches active membership exactly once; cancel, stale review, invalid output, failed retry, and transaction failure leave the current campaign unchanged |
| Ability ids | Match on id after rename; legacy name-keyed rows still match; ids remain stable across campaign moves. Existing manual copy and bundle export/import retain separate regression coverage |
| Predicates | `all`/`any`/`gte`/`eq`/`not`; empty `all` true; empty `any` false; depth cap; unknown axis/value fail closed; every seed row evaluates against every genre class |
| Filter | Non-empty binds; empty-and-pinned yields an exception; empty-and-unpinned yields `needs_choice`; each §6.3 guard case has a fixture |
| Declaration authority | Creator chooses at creation; no absent-player approval; no ordinary host/player mutation path; established fiction is never retroactively replaced; any Gate-3 GM-evolution freshness contract is enforced |
| Two scopes | Two characters in one campaign keep separate identities; shared terms stay shared; ability-specific wording does not rewrite a shared entry; a late joiner cannot alter established terms |
| Model containment | Adversarial fixtures: numbers, mechanics, unknown semantic keys, new ids, and pin rewrites are rejected; bounded retry exhaustion cannot commit |
| Narration | The §9 set-difference leak test passes, including the approved-literal-pin case |
| Onboarding | New and legacy characters get the same structural validation and plain-language approval; no class/family menu leaks |
| Drafts | Onboarding and campaign-move drafts are restart-safe and hash-bound; nothing becomes canonical while open |
| S1.8 canonical projection | A linked ability keeps one stable mechanic reference; no destination row stores `cost`/`effect`/`limits`; assembled GM context projects those fields from the canonical record and overlays only destination wording. An ability without a canonical mechanic entry produces no derived mechanics and is disclosed on the card |
| Compatibility | Existing explicit manual copy is tested as a separate feature; old bundles import; new bundles round-trip the persistent character, active campaign, vocabulary, name/ability bindings, pins, ability ids, and canonical mechanic references; unknown schema fails closed. History, biographical provenance, relationships, and inventory transport remain outside this Stage 1 claim |
| Seat isolation | Name/ability bindings, pins, binding provenance, and alternatives do not cross seats; rerun the leak/route guards in `.agents/repo-guidance.md` |

**Manual / playtest** (the phase review gate in `.agents/repo-guidance.md` applies):

1. Western gunslinger → high fantasy.
2. Fantasy wizard → cyberpunk → the same fantasy campaign: exact fantasy wording returns; only a
   cyberpunk-earned ability needs a new fantasy expression.
3. Rogue → three destinations, always one character and one active campaign.
4. Pilot → vehicle-poor destination produces a choice, not a silent downgrade.
5. A sentient-companion-themed ability → technological destination requires an expression choice;
   no companion entity or relationship is transported.
6. Cancel, reload, resume, retry, and forced validation failure all leave the current campaign active.
7. Approval moves the same character and preserves mechanics, XP, and later progression.
8. Two moved characters at one table keep distinct identities and shared world vocabulary.
9. A late joiner moves in without shifting established vocabulary.
10. Ten turns of real play show no vocabulary reversion, including literal-pinned ability wording
    appearing naturally in narration.

Bar: before the character's first turn after entry or return, the player can state what the
character can do, what wording changed, what it costs, and what remains impossible. After ten
subsequent turns, the narrator still speaks the destination's language.

---

## 13. Persistence sketch

Names are proposals; an approved slice may rename them while preserving the contract.

**Character**: one canonical row containing the stable character id, `identity_json` limited in
Stage 1 to families plus Gate-7-approved name/ability-expression slots and pins limited to those
eligible slots, mechanics,
attributes, level/XP/tiers, a mechanics/progression revision, and the active campaign id.
Portability adds no duplicate or reconciliation record and no campaign-local mechanics/progression
copy. Existing explicit manual-copy metadata, if retained, remains separate and does not participate
in movement. History, biographical provenance, relationships, and inventory state are absent from
this Stage 1 persistence contract and remain D13/D16.

**Campaign**: `capability_json`, `capability_revision` only if Gate 3 requires forward GM
evolution, `vocabulary_json`, and `vocabulary_version`.

**Bindings**: campaign-local Stage 1 expression rows keyed by `(character_id, campaign_id)`:
semantic key, destination term/prose, requirement predicate reference, binding provenance
(`generated` | `player-pin` | `player-choice`), destination campaign vocabulary
version, and a binding-set revision. They contain no mechanics, progression, biography,
relationships, or inventory state. Approved rows are retained while inactive and reused exactly
when that character returns.

**Active membership**: a uniqueness constraint or equivalent transaction guard ensures one active
campaign membership per character. Historical bindings do not count as active membership.

**Drafts**:

- An existing-campaign move draft stores the persistent character id, current mechanics/progression
  revision, destination campaign id and revisions, only missing name/ability-expression bindings,
  the exact card/hash, player choices, timestamps, status, and an idempotent commit result. It stores
  no campaign outline, rules, history, or opening scene and never recreates the destination.
- A new-campaign creation draft stores the same movement fields plus the new campaign material.
  All required campaign material and its entry scene are generated and validated before the
  membership-switch transaction.
- New-character onboarding remains a persisted approval draft. Explicit manual `copy` remains
  separate and synchronous where it has no approval step.

**Endpoints** may retain the current `/api/campaign-drafts` namespace or gain a move-specific
namespace, but must expose create/read/choose/approve/cancel with the exact card hash and idempotency
key. All remain host-authorized under the current product boundary.

**Commit ordering**: generate and validate everything required after commit outside a write
transaction → persist draft revisions and hashes → on approval reread and reject stale/consumed
state → one write transaction conditionally creates new campaign material, stores any new
destination bindings, deactivates old membership, activates destination membership for the same
character id, and marks the draft committed → an identical retry returns the committed result.
Entering an existing campaign loads its current state; it never generates another opening scene.
Any preparation or transaction failure leaves old membership untouched.

---


## 14. Non-goals

- A class-name dictionary assuming every noun has a safe counterpart.
- A player-facing menu of 22 families, or open primary-plus-two-secondary multiclassing.
- Model-generated numbers, operations, costs, or mechanical permissions.
- Silent conversion of a pinned slot.
- Changing mechanics, progression, or canonical character identity as part of campaign movement.
- Rewriting canon ruleset prose after play has begun.
- Claiming complete portability before D13/D16 settle non-ability state.
- Changing the settled D0 rulebook per campaign.
- Mechanical rebuild inside a campaign move.
- Implementing any part of this plan before a concrete phase and its owner gates are approved.

---

## 15. Honest risks against v3.1

1. **Two binding scopes cost more than one.** The split (finding 1) is correct but adds a join and
   two version fields. One combined vocabulary/binding table would be
   simpler and wrong.
2. **Vocabulary generation costs a call.** Mitigation: fold it into the existing outline call
   (`rpg-engine.js:1113`) or generate lazily when a destination first needs bindings. Unmitigated,
   it adds move latency.
3. **The slot taxonomy grew from 8 to 12.** That fixes the pin-coverage overclaim, but each addition
   becomes a schema change plus seed rows per genre class. New slots must arrive by owner decision,
   not convenience.
4. **"Mechanics never change" can feel harsh.** A player whose signature move has no destination home
   must pin it or rebuild. That is honest under D0 but may feel worse than a plausible silent
   substitution; the card's wording needs playtest evidence, not just data validation.
5. **Wrong campaign facts mis-filter.** Gate 3 must settle creation-time visibility and how
   forward-only GM worldbuilding updates the internal record. Empty sets still identify the failed
   fact; there is deliberately no live settings override.
6. **S1.8 still changes words in GM context**, even though it projects one canonical mechanic
   record instead of copying it. The card is the safety mechanism; if players click through it,
   misleading expression can still ship. Observe this specifically in playtest.

7. **The 22 families remain unvalidated in play.** They are reviewed design vocabulary, not evidence.
   Only §12 playtests can promote them.
8. **Free-text genre classification is fuzzy.** It affects seed defaults, never mechanics. Gate 3
   must settle the creation-time confirmation path without turning it into an after-creation settings
   control.

---

## 16. Owner gates

Taken in chat one at a time and recorded durably. This plan infers none of them.

1. **The architecture** — one persistent character, active in exactly one campaign; the same
   mechanics and progression record travels; per-campaign expression bindings persist and are
   reused exactly; only missing destination bindings are translated. Portability creates no
   duplicate or reconciliation state. This supersedes every earlier multi-record design.
2. **The Stage 1 phase**, in S1.1 → S1.8 order. The order is load-bearing, not stylistic.
3. **The campaign facts used for translation** (§6.1, §6.4) — whether a small structured internal
   record exists; if so, its exact fields, creation-time visibility, and how it follows forward-only
   GM worldbuilding without becoming an ordinary host/player settings control.
4. **The slot taxonomy** (§5.3) — twelve families and the rule for adding more.
5. **The family set** — internal-only (§5.6), not a player-facing class system.
6. **The onboarding shape** (§8.1) — plain-language summary, never a family menu.
7. **Campaign-specific name expression** (§10) — whether Stage 1 permits it and how the card
   presents it. History, biographical provenance, relationships, inventory, and all other
   non-ability state remain deferred to D13/D16.

8. **D5 ability packaging** — Stage 2 only.
9. **D13/D16 non-ability state** — Stage 4 only.

Gates 1 and 2 are settled in `.agents/decisions.md`; Gate 1 includes the later
one-persistent-character amendment. Gate 3 is next. Remaining gates must be ruled before their
affected slices. Unlike v3, no slice is proposed standalone: S1.8's former quick-win framing was the
defect that finding 2 caught.
