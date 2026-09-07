# Ordinary combat baseline inventory

**Date:** 2026-09-07

**Status:** completed owner-authorized inventory after withdrawing the Bodyguard proposal. This
records existing code and design evidence, not a new combat specification or implementation plan.
There is no shipped game; `../decisions.md` owns the owner's development-state clarification.
The early game playtests predate the current classes and system and validate neither.

## Bottom line

Ordinary attacks and helping attempts do not need to be invented as new class abilities. Existing
Council code accepts action prose without a special-ability declaration, and retained fixtures
already distinguish ordinary attacks from ordinary rescue actions. But the repository does not yet
define a complete ordinary-combat contract for positioning, blocking, interception, target changes,
and simultaneous threats. Accepted resolution and effect chapters are not that complete contract.

Do not fill these gaps with an automatic protection ability and then require the player to select
it. This inventory establishes what the evidence supports; it does not settle the missing rules.

## What the existing code establishes

- `rpg-engine.js`, `buildTurnContext` and Council Interaction instructions: exact player prose and
  scene/party/NPC context enter the Council. An ordinary attack is explicitly a committed action;
  it does not require a class term. Questions and dialogue are classified separately.
- `ability-trigger-state.js`, `buildAbilityDeclarations`, and `rpg-engine.js`, `takeTurn`: ability
  declarations can be empty while the action proceeds. The declaration instructions prohibit
  inferring an undeclared special ability from similar prose. Ordinary intent and special power
  activation are not interchangeable.
- Council Referee instructions allow ordinary action adjudication and resulting location occupancy
  updates. Position can therefore be represented as scene state, but an occupancy entry is not an
  engine guarantee of interception, blocked passage, or redirected damage.
- Existing rules-mode code uses optional d20/attribute checks and model-mediated scene consequences.
  It is not the signed d100 target system. Attacking-character updates, NPC notes/status and location
  records do not constitute a complete structured opponent-injury or ally-protection resolver.
- A bounded read of these paths found no dedicated persistent guard target, automatic interception,
  or Bodyguard mechanic. Generic notes/history can influence later model narration; that is not
  a precise maintained protection contract.

These are source observations, not executed behavior or player-validated combat. Anchor locations:
`rpg-engine.js:1086`, `:1366`, `:1535`, `:1692`, `:1700`, `:2416`, `:2697`, `:2738`;
`ability-trigger-state.js:196`; `rpg-state.js:2073`.

## Concrete ordinary intentions

| Player intent | Evidence supporting an ordinary attempt | What is NOT established or guaranteed |
|---|---|---|
| "I attack the raider attacking Mira." | Council accepts ordinary attacks; the fixture's Standard attack deals its printed harm on a successful check without a Form. | Hitting the raider does not itself guarantee Mira's safety, cancel another attack, or force a target change. Those consequences need justification and rules. |
| "I move between Mira and the raider." | Council can record ordinary positioning; the signed effects specification includes repositioning. | Position alone supplies no complete body-blocking/interception resolver or automatic redirection. |
| "I attack the other raider." | It enters the same ordinary-action path; a new special ability is not inherently required just because a different foe is named. | Reach, switching cost, exposure, and whether that action leaves a route to Mira are not fully specified. The code does not guarantee that the player can safely do both. |
| "I pull Mira clear of the hazard." | The provisional rescue fixture already has ordinary Protect the ally and Extract the ally actions. | These are scenario-authored effects on success, not damage plus universal protection bundled into one action. |
| "I block the doorway." | Blocking/slowing passage is shared scene vocabulary; it is not inherently a Fighter-exclusive concept. | An obstruction is not a general prohibition on all repositioning, immunity to displacement, or a guarantee against every approach. |

The first three inputs can be submitted without inventing Bodyguard. That fact does not certify
their legality in every position or promise their tactical results. In particular, attacking a foe
not currently threatening Mira is neither automatically compatible with protecting her nor forbidden
merely because of the selected target. The actual competing positions and actions need adjudication.

## Approved specification versus provisional fixture

`docs/rules/resolution.md` section 1 specifies checks for uncertain consequential intent, no check
where none is warranted, and binding success/failure. It does not supply every ordinary action's
permissions, timing, cost, or payload. A successful attack is not a license to narrate unrelated
protection or control as a bonus.

`docs/rules/effects.md` sections 2.5-2.7 supply position, condition, and feature vocabulary.
`reposition` moves a recorded occupant; active `pinned` constrains leaving an area. `obstruction`
and `cover` have fictional meaning but are not automatic interception or immunity. The chapter's
ordinary-action-path discussion explicitly says the vocabulary is not yet sufficient for ordinary
play and leaves the ordinary authorizer/commit path and further operations to later work. Relevant
anchors: `effects.md:477`, `:535`, `:801`, `:976`, `:1096`.

The committed `interaction-burden-playtest-harness/fixtures.js:150` ordinary Standard attack costs
one Main and deals Standard harm on success; no reposition, Counter, condition, or rescue effect is
included. Protect the ally and Extract the ally (`:166`) instead spend a Main/check on that scene's
threat-clearing or rescue outcome, with no attack damage. These demonstrate an ordinary-action
distinction without class activation. Their action economy, harm numbers, and authored situations
remain provisional and must not be generalized into approved combat rules.

## Design consequence and next work

Bodyguard's universal melee redirection was the only guaranteed difference added over ordinary
protective intent. It neither respected multiple approaches nor explained why attacking elsewhere
could retain complete coverage. Once that guarantee was withdrawn, no worthwhile distinct class
benefit had been established. The owner authorized dropping it; the old example is retained as
withdrawn evidence in `fighter-encounter-walkthrough.md`, not a candidate awaiting comparison.

**Later owner clarification:** the 2026-09-07 ability-benefit decision in `../decisions.md` displaces
the earlier baseline-first recommendation. Compare each ability's worthwhile benefit with the
ordinary action relevant to it; define only the missing detail needed for that comparison. Do not
require completing ordinary combat, the three Mira interactions, or the entire game before class
discussion. This inventory records real gaps but creates no new prerequisite queue. Existing
resolution/effect authority and explicit special-ability invocation decisions remain intact.

## Verification

Read-only source inventory; no game session, runtime suite, browser test, or human playtest was run.
The rejected interaction runner and all runtime code were untouched. Docs-only verification is
`git diff --check`. No evidence about current-system enjoyment, balance, or reliable tactical
adjudication is claimed.
