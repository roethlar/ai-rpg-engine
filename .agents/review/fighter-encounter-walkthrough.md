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

**Authorized follow-up, completed:** the owner subsequently authorized the effort-and-payoff
assessment below, including a lower-effort comparison for one exchange. This remains a paper
assessment without owner participation, not a fun test, class rewrite, or runtime change.

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
measurement of the existing UI. Bookkeeping consists of HP, selected Form, Counter/trigger/expiry,
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

## Effort-and-payoff assessment: exchange 3

### Controlled comparison

Retain the same scene, opponent response, earlier two exchanges, and taped outcomes. Rowan starts
this exchange at 15 HP. Compare the existing Guarding Form with the existing ordinary Standard
attack; do not invent a new ability, give the ordinary attack Deflect, change enemy behavior, or
change the selected rolls to make either route look better.

| | Guarding Form | Ordinary attack |
|---|---|---|
| Illustrative input | "Guarding Form against my sparring partner." | "I thrust at my sparring partner." |
| Player's intended tradeoff | Less offense for protection against the reply | Normal offense without that protection |
| Damage dealt | 4 | 5 |
| Damage taken | 4 | 5 |
| HP after the exchange | 11 | 10 |
| Other immediate consequences | Deflect consumes the Reaction | No Counter is armed |

These sentences illustrate intended inputs, not tested production triggers: the fixture is not
installed in a real character catalog. Extra cinematic description is optional on either route;
the earlier transcript's longer sentences are not a minimum typing requirement.

`fixtures.js` already lists the ordinary attack as legal in every stable-duel beat. It costs the
same Main and uses no class mechanic. A prior active Form label is preserved by an ordinary Main,
but that label alone does not arm Deflect or grant its protection. Saying "I attack" must not be
silently upgraded to Guarding; that would change the rules rather than reduce input effort.

### Work asked of the player

1. Establish the fictional intent and target; both routes need this.
2. For deliberate class use, weigh the available special effects against the ordinary action.
   This fixture offers three Forms plus the ordinary attack. That is the available set, NOT an
   observation that every player rereads all four each turn. A habitual choice can reduce search.
3. If selecting Guarding, include its recognized term or insert it through the ability control.
   The landed composer infrastructure already supports named insertion, exact-term highlighting,
   and explicit typo correction (`ability-keyword-production-plan.md`, AKP-3). It does not require
   memorizing a command syntax or typing the name perfectly without assistance. It also does not
   eliminate finding and choosing the desired option. No second action chooser is assumed here.
4. Submit once and wait for the result. Both routes have one submission; neither requires an
   interrupt answer for the Counter. No latency, search time, correction rate, or enjoyment was
   measured. Engine arithmetic and trigger cleanup are not counted as manual player work.

Taking the ordinary route can omit special selection and insertion if the player chooses to act
without consulting the class options. It does not necessarily remove the perceived need to compare
them: a player may still check whether skipping an ability wastes an advantage. Thus this is a
lower-overhead available route, not proof that a default attack solves decision overload.

### Payoff and judgment

Guarding provides a real, immediate one-for-one damage tradeoff in this successful exchange. The
decision is not mechanically empty, and a single HP can matter near a survival or defeat threshold.
But no such threshold is established here: Rowan survives either route, the opponent has no defeat
HP, and neither route changes position, objectives, information, or the opponent's behavior.
The fixed duel does not demonstrate a compelling reason to reconsider the choice every exchange.

Pressing would produce the same immediate damage numbers as the ordinary attack in this stationary
beat because Pursue has no trigger. That is not universal dominance: pursuit or movement could
matter in another scene. This assessment supplies no verdict on those other situations.

**Design judgment:** the example gives weak support for the recurring option-comparison effort
it invites. The class offers an understandable tactical adjustment, but this scene shows little
payoff beyond that adjustment. More explanation or easier name entry would not improve those
stakes. This is a reason to reconsider the frequency and consequence of the choice, not a claim
that players disliked it or a decision to remove the class.

**Recommendation:** in a subsequent paper comparison, replace this repeated small adjustment with
a less frequent, more consequential player choice while retaining ordinary attacks and explicit
player control. Its trigger, cost, consequence, and tradeoff would need to be shown before any
adoption. This recommendation is not a new mechanic, a fixed ability count, a mandate to automate
tactics, or authorization to build a replacement class. Starting-set decisions remain paused.

### Verification and limits

An inline Node check loaded only the committed fixture, confirmed ordinary-attack legality for
`stable.3`, and asserted the comparison above: player 74 against 30; opponent 60 against 25;
Guarding 4 dealt / 4 taken / 11 HP, ordinary attack 5 / 5 / 10. Both outcomes are clean successes.
This verifies source-backed arithmetic, not the live resolver, composer, or human experience.
The rejected runner was untouched. No browser, runtime suite, provider session, or human playtest
was run; none is represented as passing. Docs are checked with `git diff --check`.

## Written alternative: one protective commitment

**WITHDRAWN, 2026-09-07:** the owner authorized dropping Bodyguard after challenging its automatic
redirection and simultaneous-attack premise. `ordinary-combat-baseline.md` owns the subsequent
inventory. The text below is retained as rejected design evidence, not a live proposal, pending
comparison, or ordinary-combat rule. `../decisions.md` owns the withdrawal direction.

**Authorization and status:** the owner authorized one concrete replacement exchange in chat:
what the player types, what happens, and which rule changes, without owner participation. This
section records that example. Its mechanics and outcomes are proposed/scripted, not implemented,
approved class rules, or evidence of enjoyment. It is not another test program or a class roster.

### Proposed rule change

For this example, replace the turn-by-turn Form/Counter choices with ordinary weapon attacks and
one sustained ability, **Bodyguard**. Do not add Bodyguard to the existing Form menu. This is an
isolated comparison, not a decision that a whole starting character has only one ability.

- Spend the normal Main action and explicitly invoke Bodyguard for one ally within arm's reach.
  There is no attack included in that activation action.
- While the commitment lasts, melee attacks aimed at that ally target the Fighter instead and
  resolve normally against the Fighter. There is no free attack, damage reduction, or immunity.
- Ordinary attacks on later turns do not cancel the commitment and need no repeated ability term,
  stance selection, or reaction confirmation. This automatic maintenance follows the player's
  explicit commitment; the model does not infer or select another ability from ordinary prose.
- The commitment ends when either character moves out of arm's reach, the Fighter becomes unable
  to act, or the encounter ends. Leaving deliberately ends it too; pursuing a different enemy does
  not carry protection along for an ally left behind. It does not automatically reactivate on return.
- Only one ally can be covered. Changing the ally requires another explicit activation/Main.
  Ranged attacks and environmental hazards are unaffected.

This is a candidate targeted-attack redirection rule with maintained, actor-relative conditions.
It is NOT an already-supported generic effect operation, an ordinary obstruction reinterpreted as
movement prohibition, or an entitlement granted by free prose. Implementation would require a
separately approved exact catalog/rules extension and real invocation binding. The example neither
reserves ordinary helping/blocking for Fighters nor decides which classes could learn this ability.

### Player and game exchange

**Situation:** Mira is beside the Fighter, working a gate winch. A raider closes on her while the
raiders' captain heads for the stairs. Mira needs to keep working for the escape route to open.

**Player types:** "Bodyguard Mira."

**Proposed resolution:** this spends the Fighter's action on covering Mira, not attacking. The
raider's melee attack aimed at Mira is redirected to the Fighter and is scripted to hit. Mira
continues working. The captain continues toward the stairs; the ability does not restrain them.

**Game replies:** "You step between Mira and the raider. His blade catches your arm, but she keeps
turning the winch. The captain reaches the stairs."

**Next ordinary input:** "I stab the raider."

That later attack resolves normally while Bodyguard remains active if its conditions still hold.
This line illustrates persistence, not a second simulated combat result. The Fighter could instead
leave to chase the captain, but doing so ends Mira's protection; no follow-up choice is demanded
unless the submitted action is genuinely ambiguous.

### What is gained and lost

The proposed payoff is continuity of the ally's task at the Fighter's personal risk. The choice is
whom to cover and whether to stay, not which small attack adjustment to invoke for the next swing.
Activation has an immediate effect on the approaching attack rather than merely unlocking a later
move. Later attacks need ordinary intent only, with no renewed class declaration while covering.

The cost is real: the activation gives up an attack, the Fighter becomes the target of melee
attacks aimed at the ally, and leaving forfeits the benefit. The example gives up the original
per-exchange offense/defense adjustment and pursuit Counter; it does not keep their benefits hidden
behind a shorter input. One commitment/ally is still state the player must consider when moving.

This illustrates a different decision frequency and consequence. It does not establish lower
measured effort or greater enjoyment. The scene has also changed from a stationary duel to an
ally objective, so its added stakes cannot be credited solely to the mechanic. Target redirection
could be too strong or uninteresting in practice, and changing allies frequently could reintroduce
selection burden. No balance result, role/class restriction, or evidence-tier verdict follows.

**Former comparison recommendation withdrawn:** do not resume a Forms-versus-Bodyguard comparison.
The owner redirected work to the ordinary-combat baseline; see `ordinary-combat-baseline.md` for
the completed inventory. The subsequent ability-benefit decision in `../decisions.md` requires
only a local ordinary-action comparison, not completing the baseline before discussing abilities.
No replacement ability is approved.

## Pursue: added benefit versus ordinary following

**Status:** completed owner-authorized assessment, 2026-09-07. This applies the agreed local
ability-benefit criterion, not a new prerequisite to finish combat. It neither adopts nor removes
Pursue, assigns an evidence tier, or establishes enjoyment. There is no current-system game
playtest behind this assessment.

### Exact candidate, not a new rule

The retained Pressing Form makes an ordinary-strength attack against its selected engaged target,
then arms Pursue even if the attack misses. If that target leaves engagement before the next turn,
Pursue follows it one bounded move using the normal Reaction. The Counter expires at the next
turn's start. A bounded move is one step on the fixture's Engaged/Near/Far range line, not a
teleport or arbitrary change of location. There is at most one armed Counter and one Reaction.

Pursue adds movement only. It grants no extra attack, harm, pin, capture, prevented escape, or ally
protection. Its arming is coupled to Pressing Form, not a separately selectable ability in this
fixture. The relationship between its Reaction movement and the ordinary Move allowance is not
explicit enough to claim free extra distance or a saved Move. Main and Move are already separate
fixture allowances, so following must not be described as automatically saving a later attack.

Sources: `archetype-collapse-prototypes.md` sections 6.3-6.4;
`interaction-burden-playtest-plan.md` sections 5.1-5.2 and 5.6;
`interaction-burden-playtest-harness/fixtures.js`, `form.pressing` and `rescue.3`.

### One retreat, two ordinary-action assumptions

The comparison concerns a foe who withdraws one short step after the Fighter's attack and before
the Fighter's next turn. Hold that departure and the attack result fixed; do not invent a capture,
new attack, or protected objective to make the reaction look valuable.

| Ordinary following rule, expressly unsettled | What Pursue would add |
|---|---|
| Ordinary intent can already maintain contact through this retreat in the same exchange. | No distinct following benefit has been shown. An additional class invocation may duplicate the ordinary intent. |
| Ordinary movement must wait until the Fighter's next turn. | Pursue can change position earlier, during this particular foe's departure, in exchange for the Reaction. That may matter before intervening actions, but the candidate does not guarantee that it will. |

The only demonstrated candidate for added capability is therefore timing, not permission to chase
someone at all. Do not choose a restrictive ordinary-following rule merely to manufacture a use
for Pursue. If someone can retreat farther than its one bounded move, the card does not promise
that the Fighter catches up. Neither assumption is adopted by this assessment.

The retained rescue fixture follows a fleeing blocker by one step, while Hinder/reposition can
defeat its authored escape attempt. Those are different effects. The fixture has no standalone
ordinary Move action (`interaction-burden-playtest-plan.md` section 6.2), so its class comparison
cannot establish superiority over ordinary following. This is a limit of using that fixture for
this question, not a finding that its original Armsmaster/Adept comparison was dishonest or broken.

### Effort, commitment, and limits

Choosing Pressing entails choosing the attack's follow-if-the-target-leaves commitment in advance.
The written Counter is then applied without another prompt; that is execution of the player's
selected rule, not inherently a model choosing the tactic. But the choice recurs whenever another
Pressing attack is used to arm a fresh Counter, and considering whether following is desirable is
part of its cost. If the target stands still, the Counter adds nothing in that exchange.

The ordinary intent "I attack him and stay on him if he backs away" is already intelligible prose.
Its exact timing is unresolved, but it must not be treated as a special-ability declaration or
rejected solely because it lacks the class term. The existing composer can insert a real owned
ability's term; that addresses entry assistance, not the value of making this commitment.

Automatic pursuit could move the Fighter away from an ally or into a newly dangerous position.
The card does not specify a decline option, hazardous/blocked route handling, forced movement,
longer departures, or loss of movement capability. Its single-opponent fixture also does not
demonstrate general target binding across several enemies. These are limits on what can be
promised, not permission to invent safe routing, a different target, immunity, or a model-selected
best response. Adding a confirmation at every departure would add interaction cost and is not
proposed here.

### Judgment and next item

Pursue has a plausible situational timing benefit, but this evidence does not establish enough
benefit over ordinary following to justify presenting it as a routine Fighter choice. It is not
the same defect as Bodyguard's universal redirection; neither its value nor its failure should be
asserted universally. The unresolved local comparison is ordinary following's timing, with Move
accounting also needed before claiming extra movement efficiency. No whole-combat gate follows.

**Recommendation:** do not present the current Pursue card as an established answer to the owner's
effort/payoff concern. Keep its status provisional, without adopting a new movement restriction to
justify it. The former next-ability checkpoint is superseded by the owner-directed process reset:
`gate-5-class-model-plan.md` section 7.1 owns one agent-led encounter-level design batch. These
individual findings are internal evidence, not a sequence of owner usefulness judgments. No roster
ruling or replacement design is implied.

**Verification:** source inspection only. No rejected runner, live resolver, provider session,
browser test, runtime suite, or human playtest was run. No timing or enjoyment measurements were
made. The illustration is conditional reasoning, not an executed scenario. Docs-only checks are
`git diff --check`.
