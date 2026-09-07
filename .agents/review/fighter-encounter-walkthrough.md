# Fighter encounter: self-contained worked illustration

**Date:** 2026-09-07

**Status:** completed scripted illustration, not an owner playtest, runtime test, class approval,
balance verdict, or replacement design. The owner authorized one short Fighter encounter provided
they did not have to participate. The assistant writes both player and GM; no owner response,
survey, or turn is required. The starting-set proposal remains paused.

**Later clarification:** the owner interrupted before this transcript was delivered and clarified
that the concern is sorting too many options and correctly entering an action, not rules knowledge
or recall. The 2026-09-07 fun-per-player-action decision in `../decisions.md` governs the assessment.
Retain this illustration as limited evidence, not the proposed answer to that concern.

## Basis and limits

Use the retained Armsmaster free-Forms candidate, explicitly expressed as Fighter in
`archetype-collapse-prototypes.md` section 6.7. The exact data comes from
`interaction-burden-playtest-harness/fixtures.js`, `shared` and `variants` (free Forms), with Counter
semantics in `interaction-burden-playtest-plan.md` sections 5.1-5.5. This is NOT the earlier
creator mockup's six-Tempo pool. This fixture has no spend resource.

Only the committed fixture data was loaded. The owner-rejected interactive runner was not run,
edited, or resumed. No model provider, browser, live campaign, or saved character was used.

The stable-duel fixture fixes both combatants at engaged range for four exchanges, without terrain
changes or opponent defeat HP. Its objective is pressure while limiting incoming harm. Rowan is
the fixture's unarmored, shieldless spear fighter, starting at 24 HP. There is no victory or kill
to infer at the end. Descriptions below add mechanically inert color only.

Known options, restated only to make this illustration self-contained:

- **Pressing Form:** Standard harm; arm Pursue, which follows an engaged target that leaves by one
  bounded move using the normal Reaction. Following does not itself prevent escape.
- **Driving Form:** Light harm and a one-step reposition on success; no Counter.
- **Guarding Form:** Light harm; arm Deflect, which uses the normal Reaction to reduce the next
  incoming physical hit by one category. It does not make that attack less likely to hit.
- **Ordinary attack:** Standard harm without a Form or Counter.

Each action costs the normal Main. The selected Form's Counter arms even on a miss, expires at the
next turn's start, and needs no interrupt question. The fixture prices Light at 4 and Standard at 5.
No new ability, number, starting entitlement, reaction policy, or recovery rule is proposed here.

## Encounter

**GM:** Rowan faces a sparring partner, both within spear reach. The partner holds their ground.
There is no ally to rescue or passage to secure: land blows while limiting the ones you take.

### Exchange 1: pressure

**Scripted player:** "Pressing Form against my sparring partner. I thrust at their center."

**GM:** Your spear connects. Their return strike connects too; neither fighter gives ground.

**Ledger:** 5 damage dealt, 5 taken; Rowan 24 -> 19 HP. Pursue is armed but does not trigger because
the partner does not leave. It expires before the next action.

**Choice:** favor the stronger attack. There is no immediate use for movement or pursuit here.

### Exchange 2: protection, including when the attack misses

**Scripted player:** "Guarding Form against my sparring partner. I attack with my spear kept ready
to deflect their reply."

**GM:** They turn your thrust aside. You catch part of the return blow on the spear shaft, but it
still lands.

**Ledger:** the attack fails and deals nothing. Deflect still arms and automatically reduces the
incoming hit from 5 to 4, consuming the Reaction. Rowan 19 -> 15 HP.

**Choice:** accept a weaker successful attack in return for protection. The miss is the existing
result tape, not something chosen by the player or softened into a partial success.

### Exchange 3: keep the same approach

**Scripted player:** "Guarding Form against my sparring partner again. I make a short thrust and
keep the shaft between us."

**GM:** This thrust lands. Your ready defense takes part of the force from their reply.

**Ledger:** 4 damage dealt, 4 taken after Deflect; Rowan 15 -> 11 HP. The Reaction is consumed.

**Choice:** the previous approach remains available. No sequence advances or unlocks a stronger move.

### Exchange 4: choose pressure again

**Scripted player:** "Pressing Form against my sparring partner. I commit to another direct thrust."

**GM:** Your thrust lands, and their reply catches you without the earlier deflection. The four
scheduled exchanges end with both still standing in place.

**Ledger:** 5 damage dealt, 5 taken; Rowan 11 -> 6 HP. Pursue has no trigger in this exchange;
it expires at the next turn boundary, not because narration announces the illustration's end.

**Choice:** restore the stronger attack and give up Deflect. This is not a finishing move or a claim
that the opponent has been defeated.

## Accounting

The fixture's existing player rolls are 62, 18, 74, 81 against target 30; the opponent rolls are
60, 40, 60, 40 against target 25. All are clean outcomes. Guarding does not alter that opponent
target. The choices and results are scripted and visible to the author, not a blind or RNG run.

| Same fixed opponent and roll tape | Harm dealt | Harm taken | Rowan HP remaining |
|---|---:|---:|---:|
| Illustrated: Press, Guard, Guard, Press | 14 | 18 | 6 |
| Counterfactual: Press all four times | 15 | 20 | 4 |
| Counterfactual: Guard all four times | 12 | 16 | 8 |

An inline Node calculation loaded the committed fixture and checked these hit, harm, and HP sums.
It was an arithmetic check only, not execution of the game resolver or the rejected runner. The
counterfactuals change only the selected Forms, keeping this fixture's responses and tape fixed;
they are not claims about enemies reacting to tactics in a campaign.

The written exchange needs four player submissions, each explicitly naming a Form and target, and
zero follow-up or reaction answers. The rules specify automatic Counter handling; this is not a
measurement of the shipped UI. Bookkeeping consists of HP, selected Form, Counter/trigger/expiry,
and the shared Main/Reaction budget. No resource spending, recovery, combo stage, or Move choice
occurs. Absence here does not establish absence in other class designs or encounters.

## Assessment

- There is a real immediate offense/defense choice. Deflect remains useful when the attack misses;
  repeating a Form is legal. Arithmetic and trigger cleanup do not require another player decision.
- This particular fixture reduces that choice mostly to one point more inflicted versus one point
  less suffered per applicable exchange. It supplies no changing threat, objective, or opponent
  intent to make changing tactics more compelling. That is a limitation of the scene as well as
  a narrow view of the class; it is not proof that every Fighter encounter is this repetitive.
- Driving's movement and Pursue's trigger get no useful demonstration. No conclusion about their
  value, arbitrary-action alternatives, or the full class can be drawn from this stable duel.
- The scripted player arrives with a selected Form and finished sentence. That hides the effort of
  comparing options and composing the correct invocation, which is the owner's actual concern.
  Four submissions and zero follow-up questions do not establish four worthwhile interactions.
- The fluent narration is not evidence of human enjoyment, voluntary use, option-sorting or input
  effort, multiplayer latency, or acceptable UI. It establishes neither acceptance nor rejection of
  the class candidate. Treating this objection as a recall problem would misstate the feedback.

**Conclusion:** this illustrates accounting but does not establish enough worthwhile play for the
player effort demanded. It cannot justify resuming starting-package choices. Do not convert it into
a new approval gate, evidence-tier promotion, or roster ruling.

**Next recommendation, not yet authorized:** revise one exchange to expose option-sorting and input
effort alongside its payoff, then propose a lower-effort alternative. The earlier recommendation
to add a movement/rescue scene is displaced by the owner's clarification. Do not require the owner
to participate, substitute more explanations, or expand this into a class rewrite or playtest program.
