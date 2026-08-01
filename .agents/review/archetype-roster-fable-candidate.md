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

## Cross-genre examples

Parenthesized entries are expression-level secondaries, not additional stored IDs.

### Fantasy

- Barbarian → `arch.bruiser` (`arch.survivor`)
- Battle Mage → `arch.artillery`
- Wizard → `arch.controller` (`arch.scholar`)
- Knight or Paladin → `arch.defender` (`arch.commander`)
- Thief → `arch.infiltrator`
- Cleric → `arch.healer` (`arch.face`)
- Ranger → `arch.marksman` (`arch.scout`)
- Beastmaster → `arch.handler`
- Artificer → `arch.maker` (`arch.controller`)
- Druid → `arch.controller` or `arch.transformer`, depending on whether nature manipulation or
  mechanically distinct wild-shape modes are required

### Historical or swashbuckling

- Musketeer → `arch.marksman`
- Swashbuckling fencer → `arch.duelist` (`arch.face`)
- Ship captain → `arch.commander` (`arch.pilot`)
- Sapper or siege engineer → `arch.saboteur` (`arch.artillery`)
- Court spy → `arch.infiltrator` (`arch.face`)
- Ship surgeon → `arch.healer`
- Merchant prince → `arch.patron`

### Gothic horror

- Vampire hunter → `arch.duelist` (`arch.investigator`)
- Occult detective → `arch.investigator` (`arch.scholar`)
- Exorcist or ritualist → `arch.controller`
- Spirit medium → `arch.handler` (`arch.face`)
- Cursed brute → `arch.bruiser`
- Grave robber → `arch.infiltrator`
- Werebeast → `arch.transformer`
- Relic maker → `arch.maker`

### Western

- Gunslinger → `arch.marksman` (`arch.duelist` for draw tempo)
- Saloon enforcer → `arch.bruiser`
- Dynamiter → `arch.artillery`
- Frontier doctor → `arch.healer`
- Cardsharp preacher → `arch.face` (`arch.inspirer`)
- Bounty tracker → `arch.scout` (`arch.investigator`)
- Stagecoach ace → `arch.pilot`
- Rail baron → `arch.patron`
- Homesteader → `arch.survivor`
- Drifter with no specialist mechanics → `arch.generalist`

### Modern or cyberpunk

- Netrunner → `arch.controller` (`arch.infiltrator`)
- Street-samurai bodyguard → `arch.defender` (`arch.duelist`)
- Chrome rager → `arch.bruiser`; cyberware is source expression over an uncosted melee chassis
- Overclock cyborg whose implants fire as costed invocations → `arch.artillery`
- Ripperdoc → `arch.healer`
- Fixer → `arch.face` (`arch.patron`)
- Drone-swarm operator → `arch.handler`
- Rig jockey → `arch.pilot`
- Profiler → `arch.investigator` (`arch.scholar`)
- Media influencer → `arch.inspirer`

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
