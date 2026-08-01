# Fable Gate 5 roster and genre-mapping candidate

**Status**: REVIEWER CANDIDATE — not owner-approved. Gate 5 remains open.

**Date**: 2026-08-01

The corrected-scope openreview returned findings but no roster. The owner-directed fallback
`codereview` asked `claude-fable-5` for a concrete mapping at `high` effort. Fable returned
`reopened`: the existing 22-family candidate should not be accepted as-is because it uses
renumberable ordinals, defines families by shared tactical results rather than required mechanical
chassis, and still calls Generalist provisional. It recommends retaining the 22 names and count
while replacing their IDs and definitions as follows.

## Proposed stable roster

| Stable ID | Player-facing name | Mechanical identity |
|---|---|---|
| `arch.defender` | Defender | Interposition chassis: trades its own position, exposure, or guard to absorb or redirect harm aimed at a protected ally, object, or space. |
| `arch.bruiser` | Bruiser | Uncosted sustained close-combat chassis: direct melee force plus damage-soak staying power, requiring no effect-invocation resource. |
| `arch.duelist` | Duelist | Counter-timing chassis: mobility, precision windows, and riposte mechanics against one priority opponent. |
| `arch.marksman` | Marksman | Ranged-precision chassis: single-target output governed by target selection, range bands, firing windows, and ammunition pressure. |
| `arch.artillery` | Artillery | Costed-invocation force chassis: spends a scarce power or ordnance reserve on decisive destructive effects, usually area-focused, at any delivery range. |
| `arch.controller` | Controller | Costed-invocation manipulation chassis: spends prepared or channeled resources to alter choices, terrain, access, status, or an underlying system rather than deal direct force. |
| `arch.infiltrator` | Infiltrator | Stealth-and-access chassis: avoids detection, crosses guarded boundaries, exploits access, and escapes. |
| `arch.saboteur` | Saboteur | Delayed-disruption chassis: prepares devices, charges, or conditions that trigger later against a system or place. |
| `arch.scout` | Scout | Advance-information chassis: movement, perception, and tracking mechanics reveal routes, threats, and positions before commitment. |
| `arch.investigator` | Investigator | Evidence chassis: gathers and connects clues to mechanically establish a hidden fact, cause, or actor. |
| `arch.face` | Face | Social-leverage chassis: negotiation, deception, and concession mechanics against a person or small group. |
| `arch.commander` | Commander | Ally-coordination chassis: allocates present allies' actions, positioning, formation, and team tempo. |
| `arch.healer` | Healer | Recovery chassis: triage, prevention, stabilization, and restoration constrained by scarce care resources. |
| `arch.inspirer` | Inspirer | Morale chassis: shifts group emotion, attention, resolve, and public feeling as buffs or debuffs. |
| `arch.maker` | Maker | Fabrication chassis: spends preparation time and materials to build, repair, or modify concrete tools and capabilities. |
| `arch.scholar` | Scholar | Expertise chassis: applies established knowledge to interpret, predict, or confer informed advantage. |
| `arch.handler` | Handler | Delegation chassis: directs a mechanically distinct companion or agent that shares the player's action economy and risk. |
| `arch.transformer` | Transformer | Mode-switch chassis: mutually exclusive body, stance, identity, or loadout modes have mechanically distinct profiles. |
| `arch.pilot` | Pilot | Platform chassis: controls a mount, vehicle, or rig whose position, speed, and integrity carry the character's risk and output. |
| `arch.survivor` | Survivor | Attrition chassis: allocates supplies and adapts under scarcity, hazards, and isolation. |
| `arch.patron` | Patron | Obligation chassis: converts wealth, status, institutions, or networks into effects while accruing debts and favors. |
| `arch.generalist` | Generalist | Breadth chassis: lower-ceiling access to several ordinary competences, used only when no specialist chassis carries the concept and never as open pick-anything permission. |

The slug IDs are intended to be engine-known and never renumbered. Display names and prose may
later change without changing identity.

## Canonical non-conflation example

- Barbarian → `arch.bruiser`: uncosted sustained melee force and staying power. Rage is an
  expression of that chassis, not an invocation resource.
- Battle Mage → `arch.artillery`: the concept cannot be played honestly without spending a scarce
  spell reserve to invoke decisive effects. Sword-channeling or close-range delivery is expression,
  not a reason to map it to Bruiser.
- A manipulation-focused Battle Mage may instead map to `arch.controller`; one defined by switching
  between mechanically distinct martial and casting modes may map to `arch.transformer`.

The shared tactical result “close-range force” is not the mapping key. Required mechanics are.

## Cross-genre mapping matrix

Archetypes are the Y axis; genres are the X axis. Each cell is one genre-native expression of the
row's mechanical chassis, not an automatic class assignment or an additional stored ID.

Columns: **F** High fantasy; **H** Historical / grounded; **G** Gothic / occult; **W** Western /
frontier; **M** Contemporary / crime; **P** Pulp / superhero; **C** Cyberpunk; **S** Space opera /
science fiction; **A** Post-apocalypse; **X** Surreal / cosmic.

| Archetype (Y) | F | H | G | W | M | P | C | S | A | X |
|---|---|---|---|---|---|---|---|---|---|---|
| `arch.defender` — Defender | Shield-oath knight or paladin guardian | Man-at-arms shield-bearer | Threshold-holding monster warden | Lawkeeper bodyguard | Close-protection bodyguard | Armored protector hero | Bodyguard street samurai / corporate tank | Space-marine shieldwall guardian | Convoy-guarding wasteland enforcer | Reality anchor who absorbs impossibilities |
| `arch.bruiser` — Bruiser | Barbarian | Berserker pit fighter | Cursed brute | Saloon enforcer | Mob enforcer / breacher | Powerhouse strongman | Chrome rager (cyberware as uncosted melee expression) | Heavyworld brawler | Mutant berserker | Nightmare brute |
| `arch.duelist` — Duelist | Blade-dancer swashbuckler | Fencing master | Stake-and-sabre vampire duelist | Quick-draw knife-and-pistol duelist | Close-quarters counter-fighter | Masked swashbuckler | Monoblade runner | Energy-blade ace | Arena raider | Fate duelist |
| `arch.marksman` — Marksman | Ranger archer | Musketeer sharpshooter | Silver-bullet monster hunter | Gunslinger sharpshooter | Tactical sniper | Trick-shot hero | Smartgun ace | Blaster sharpshooter | Scavenged-rifle wasteland hunter | Impossible-angle shooter |
| `arch.artillery` — Artillery | Battle Mage (costed spell-reserve invoker) | Siege engineer with cannon and powder | Ward-breaking ritual demolisher | Dynamiter | Demolitions specialist | Energy-projector hero | Overclock cyborg whose implants fire as costed ordnance | Ship gunner / plasma-weapons specialist | Scrap-cannon expert | Storm caller |
| `arch.controller` — Controller | Wizard | Strategist-alchemist | Occult ritualist | Snake-oil mesmerist | Systems hacker / operations controller | Telekinetic psychic | Netrunner | Psion systems adept | Relic-hacking shaman | Dreamwalker |
| `arch.infiltrator` — Infiltrator | Thief | Court spy / cutpurse | Grave-robbing occult burglar | Cat-burglar outlaw | Covert-entry operative | Masked cat thief | Ghost intrusion specialist | Smuggler infiltration operative | Vault-cracking scavenger | Identity thief |
| `arch.saboteur` — Saboteur | Alchemical trap-layer | Sapper | Curse layer / relic saboteur | Rail dynamiter with timed charges | Bomb technician / infrastructure saboteur | Gadget saboteur | Logic-bomb demolition specialist | Charge-planting systems slicer | Trapmaker | Causality breaker |
| `arch.scout` — Scout | Pathfinder | Outrider | Monster tracker | Trail scout / bounty tracker | Surveillance recon operative | Aerial scout | Urban recon tracker | Sensor-specialist pathfinder | Wasteland scout | Liminal guide |
| `arch.investigator` — Investigator | Royal inquisitive | Magistrate examiner | Occult detective | Bounty-investigating marshal | Homicide detective | Masked detective | Data investigator | Xeno-investigating science officer | Relic seeker reconstructing the fall | Truth diver |
| `arch.face` — Face | Silver-tongued courtier | Merchant envoy negotiator | Society charmer | Cardsharp con artist | Fixer-negotiator | Celebrity envoy | Fixer | First-contact diplomat | Settlement trader-envoy | Herald |
| `arch.commander` — Commander | Warlord banner-captain | Line officer / standard bearer | Secret-order leader | Posse leader | Tactical team lead | Team captain | Tactical coordinator | Squadron commander | Raid-band chief directing present fighters | Chorus conductor |
| `arch.healer` — Healer | Cleric herbalist | Ship surgeon | Exorcist-healer / occult surgeon | Frontier doctor | Trauma paramedic | Field-doctor hero | Ripperdoc | Xenomedic | Scavenged-supplies field medic | Soul mender |
| `arch.inspirer` — Inspirer | Skald | Orator chronicler | Spiritualist storyteller | Saloon performer | Charismatic journalist-performer | Broadcasting icon | Media influencer | Holo-star cultural envoy | Tribe storyteller | Muse |
| `arch.maker` — Maker | Artificer smith | Artisan engineer | Relic maker | Gunsmith | Workshop fabrication engineer | Gadgeteer | Cybertech | Ship engineer | Scrap mechanic | Worldsmith |
| `arch.scholar` — Scholar | Loremaster sage | Natural philosopher | Forbidden-texts archivist | Frontier naturalist chronicler | Criminal profiler | Super-scientist savant | Data savant | Xenoarchaeologist | Lorekeeper | Oracle |
| `arch.handler` — Handler | Beastmaster summoner | Falconer houndmaster | Spirit medium | Trail houndmaster | K9 or drone handler | Beast-commanding sidekick hero | Drone-swarm operator | Droid or xenobeast handler | Mutant-beast tamer | Echo caller |
| `arch.transformer` — Transformer | Wild-shape druid | Master of disguise / adaptive fighter | Werebeast | Skinwalker | Undercover mimic | Shapeshifter | Mode-switching body-mod specialist | Alien morph | Adaptive mutant | Dreamshaper |
| `arch.pilot` — Pilot | Dragonrider cavalier | Cavalry rider / ship helmsman | Black-coach conveyance master | Stagecoach ace | Getaway driver | Ace pilot | Rig jockey | Star pilot | Road warrior | Realm navigator |
| `arch.survivor` — Survivor | Wilderness guide | Hard-country expedition guide | Sole survivor of the haunting | Homesteader prospector | Survivalist first responder | Pulp jungle explorer | Street survivor | Frontier colonist | Scavenger | Castaway between realities |
| `arch.patron` — Patron | Guildmaster noble | Merchant prince | Cabal patron | Rail baron | Crime boss executive | Billionaire sponsor | Corporate executive | Syndicate-fleet admiral patron | Resource warlord commanding off-scene tribute | Fate broker |
| `arch.generalist` — Generalist | Adventurer | Mercenary traveler | Manor jack-of-all-trades | Drifter | Field agent | Pulp adventurer | Operator | Spacer | Wanderer | Dimensional traveler |

## Mapping rules

1. **Chassis first.** Map the mechanics without which the concept cannot be played; never map by
   a shared tactical result or fictional trapping alone.
2. **One stored ID.** Creator proposes one primary chassis and the player confirms or corrects it;
   there are no dual-archetype characters in this proposal.
3. **Secondaries are expression.** Secondary flavor lives in the tailored description, ability
   selection, and per-campaign ability bindings, not a second ID.
4. **True hybrids require a player tie-break.** `arch.transformer` is reserved for concepts whose
   identity is mechanically distinct mode-switching, not a dumping ground for hybrids.
5. **Power source is not the key.** Spells, cyberware, faith, and training affect mapping only when
   their required mechanics imply a chassis such as costed invocation.
6. **Generalist is last.** Use it only when no specialist chassis covers the required mechanics.

## Settled-boundary check and open caveat

The proposal keeps one stable ID, leaves mechanics and progression untouched during movement,
keeps player title separate, requires Creator mapping plus player confirmation, and treats the
genre examples as design guidance rather than a runtime genre classifier or permission table.

It does **not** settle `pt-5`: the existing design calls `archetypeDescription`
campaign-tailored but freezes it across campaign moves without defining later surfaces. The owner
must rule that boundary separately before S1.5.

## Reviewer provenance

- Reviewer: claude / claude-fable-5 / high / standard (inline, session-only)
- Codereview range: `9e4916d49cb052381f322e07d8714fdd88949076..810a008f2905bcaf8771d1fee3aef016d4bae6e1`
- Verdict: `reopened`; `guard_confirmed: true`; `capability_ok: true`; both SHA pins matched
- Claude CLI 2.1.220 result UUID: `07fc3b8e-96af-4184-8a3c-0acb06461817`
- Session transcript: `3e3663b6-189d-42e3-b96a-84554c11476d`
- Manual design guard covered five genre bands, Barbarian/Battle Mage non-conflation, stable IDs,
  and settled Gate 3/4/6/7 constraints; reviewer also ran `node test.js` green in the disposable
  worktree.

Matrix completion pass:

- Reviewer: claude / claude-fable-5 / high / standard (inline, session-only)
- Candidate range: `9141b8fc61d4023cbefaa77db5e2b22b7e587961..15ea5ad04e89ea74e7665a11ac3ab3cb4c4cc6a6`
- Structured result: exactly 22 roster-ordered rows and 10 nonempty genre cells per row;
  `capability_ok: true`; both SHA pins matched
- Claude CLI 2.1.220 result UUID: `6b18e126-1f65-4ed6-b7d9-b4a120358127`
- Session transcript: `f99d5032-288e-4a48-b0a1-109dc8f28579`
- Reviewer read the candidate and all three historical portability matrices and ran the pinned
  range's `git diff --check` in a detached disposable worktree.
