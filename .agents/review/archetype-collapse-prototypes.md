# Archetype collapse prototypes

**Status:** prototypes 1 and 2 complete; owner removed Intruder after prototype 1; prototype 2
established formal Armsmaster/Adept separation, but the later text-entry interaction audit recommends
removing/folding Adept because its sequence is too burdensome; no roster, rules package, or
implementation is approved

**Date:** 2026-08-02

**Scope:** test whether candidate archetypes still create different repeated decisions after jobs,
roles, status, skills, and genre flavor are stripped away

> **Later interaction finding:** formal non-collapse is not sufficient for this product.
> `.agents/review/interaction-burden-audit.md` finds that the Adept sequence becomes a prompted
> rotation in text play and that Catalyst Cues have the same structural problem. It recommends not
> running prototype 3 unless the owner rejects that finding. This note does not rewrite the matched
> cards or record an owner roster ruling.

## Bottom line

Two matched-card results now exist:

- **Intrusion:** owner-ruled. Keep the protected-system mechanic as shared scenario rules and
  training; remove Intruder as an archetype.
- **Armsmaster versus Adept:** prototype recommendation, not yet owner-ruled. Keep both candidates.
  Armsmaster makes an unconstrained current-turn Form choice; Adept advances a character-owned
  opening/flow/finisher sequence whose order changes later legal techniques.

**Owner ruling: protected-system intrusion survives as a mechanic, but Intruder does not survive as
an archetype.** The prototype established that linked nodes, system-scoped Access, exact
permissions, and Alert can create meaningful repeated decisions. It did not establish that those
scenario mechanics require a separate class. Treating the distinct subsystem as proof of a
distinct archetype was the category error this prototype exposed.

The protected-system map, Access, and Alert belong to the authored scenario. Any character with the
appropriate ordinary skills can participate in Probe and Breach actions. Intrusion training may
grant efficiencies or advanced authored operations; it belongs naturally in an
Opportunist/Rogue-style build and remains available to other classes through ordinary
cross-training costs. The exact training package remains future rules work.

The inverse boundary matters just as much: a single terminal, lock, ward, sentry, trap, clue, or
social checkpoint is **not** a protected system. It is resolved by a common skill, equipment, or an
Opportunist Opening. A campaign without recurring multi-node systems simply has little use for
intrusion training; it does not need a conditional class offering. A hacker, spy, infiltrator, or
taboo-path expert is an Opportunist, Maker, or another class with the relevant skills and training.

This owner ruling removes only Intruder from contention. It does not approve the remaining roster,
settle the training's progression or balance, or unfreeze any rules package.

## 1. Test and controls

### 1.1 Prototype question and owner ruling

The prototype first asked whether a proposed Intruder card created legal, repeated choices that
were lost when replaced by Opportunist plus the same skills. It showed that the full protected
system cannot be reduced to one Opening without losing decisions.

The owner then applied the more important classification question to this case: who owns that
state? Because the map, Access, and Alert are authored by the scenario and ordinary skills already
cover participation, the additional depth is intrusion training over shared scene rules, not a
class chassis. “Mechanically distinct” and “class-level” are separate findings.

The test deliberately asks a narrower question than “can both characters finish the scene?” Both
must be able to contribute, and required evidence or progress must have physical, social, covert,
or destructive alternatives. A class can have a distinct loop without owning the only solution.

### 1.2 Matched prototype characters

| Control | Opportunist | Intrusion specialist |
|---|---|---|
| Prototype tier | Same notional first-tier character | Same notional first-tier character |
| Relevant SkillBonus | `20` in each fixture | `20` in each fixture |
| Check rule | Signed d100 meet-or-beat rule | Signed d100 meet-or-beat rule |
| Fixture difficulty | `standard`, no situational delta: target `30` | `standard`, no situational delta: target `30` |
| Turn budget | One Main and one Move in normal scene initiative | One Main and one Move in normal scene initiative |
| Extra action economy | None | None; system actions spend the same Main used for physical action |
| Required equipment | Equal ordinary genre-appropriate tools | Equal ordinary genre-appropriate tools |
| Ordinary skills | Can attempt every local Systems, Stealth, Survival, Investigate, or social task | Can attempt the same local tasks at the same bonus |

The SkillBonus is a fixture control, not a proposed level-one value; D4 progression remains open.
No random sample is used to infer class identity. Each walkthrough inspects the legal choices after
clean successes and after one failed risky action. Because the check inputs are matched, different
state comes from the candidate mechanics and authored scenario rather than favorable competence or
rolls.

### 1.3 Open-system lineage and deliberate changes

The starting precedent is the CC0/public-domain *Cities Without Number* SRD already cited by the
three frozen packages. This prototype borrows its structural ideas: linked nodes, virtual and
physical actions sharing one action budget, Access paying for exact program effects, and failed
security actions pushing the network toward an alert.

This is not a claim that the prototype copies the donor procedure exactly. CWN gives a hacker a
refreshable personal Access pool and uses accumulated failures and defender actions to alert a
network. The audit's house prototype instead makes Access state of one protected system, earns it
by breaching that system's nodes, and gives the system an explicit three-step Alert/lockdown card.
Those changes are shown rather than hidden because they are the exact distinction being tested.
The source reference remains <https://cwn.quadrifons.com/hacking/>; no donor text is copied here.

## 2. Equal-level mechanic cards

### 2.1 Opportunist prototype card

**Tracked state:** at most one Opening, attached to one visible target or obstacle. Creating a new
Opening replaces the old one. It cannot be banked, transferred to another target, or used as a
generic bonus.

**Set Up — Main:** use a visible authored setup such as concealment, leverage, distraction,
evidence, a feint, or a mastered method. When the outcome is uncertain and consequential, make the
ordinary relevant check. On success, put the Opening on that one target or obstacle.

**Exploit — Main:** consume the Opening for one printed local payoff on its target: enter, extract,
disable, redirect, disclose, move, disarm, or deal precision harm. The payoff cannot change another
target, survive for later spending, or repeat until the character creates another Opening.

**Mastery floor:** the card also carries narrow authored investigation and social applications so
the character remains broadly useful outside a protected system. They can reveal clues and create
approaches through ordinary checks, but cannot turn a clue into an unprinted permission. The final
rules package must define the exact reliability cadence; it is deliberately not used to bias this
prototype.

**Progression direction:** more valid setups, payoff choices, and mastered applications. It must
not gain a multi-node map, transferable openings, or system-wide permissions through progression;
those would cross the collision boundary.

### 2.2 Intrusion-specialist prototype card

This is the candidate card the prototype tested. Under the owner ruling, its shared operations
belong to the scenario and its advanced permissions become training benefits rather than class
features.

**Tracked state belongs to the protected system, not the character:** revealed and breached nodes;
Access `0–3`; and Alert `0–3`. Each node can grant its first-breach Access only once. Access clears
when the character leaves the system, the objective scene closes, or the system executes a reset.
It cannot pay for attacks, ordinary skill checks, or any ability outside that system.

**Probe — Main:** name one reachable hidden node or connection and make the relevant ordinary
check. On success, reveal its node card: links, defense, first-breach award, exact permissions, and
Alert interaction. On failure, reveal nothing and advance Alert by one.

**Breach — Main:** target one revealed node linked to the current breached path and make the same
ordinary check. On success, mark that node breached and gain its one-time Access, up to the cap. On
failure, do not breach it and advance Alert by one.

**Operate — Main:** while the breached path reaches a node, spend the Access printed beside one of
that node's permissions and apply that exact result. No prose inference and no generic effect menu
is legal. Access is the prior successful intrusion paying for a permission, so the prototype does
not add another check after payment. A permission marked noisy advances Alert after resolving.

**Alert:** every protected system prints exact consequences at Alert 1, 2, and 3. Full Alert changes
or closes routes, adds active opposition, or executes another authored lockdown response; it never
means only “take damage.” Alert is shared scene state, so another character's noisy local action can
advance it too. Only a printed permission can suppress it.

**Training direction:** a larger authored tool/program loadout, access to more exact permission
types, deeper simultaneous control, and bounded Alert suppression. Final costs, capacity, and
cadence are rules questions. Training cannot turn Access into character Power or let the player
invent a permission in prose.

### 2.3 What qualifies as a protected system

For this prototype, the engine may instantiate `ProtectedSystem` only when all of these are true:

1. it has at least three linked nodes rather than one obstacle split into fake steps;
2. node order or route choice changes which later operations are legal;
3. at least two useful permissions compete for the available Access or time;
4. Alert has an exact response that changes the map, permissions, or opposition;
5. ordinary local tasks remain available through common skills; and
6. required progress has at least one route that does not require intrusion training.

If any of the first four conditions is missing, use one ordinary check or one Opportunist Opening.
The GM cannot label every creature, locked door, or difficult conversation a “system” merely to
create specialist work.

## 3. Fixture A — cyberpunk data vault

### 3.1 Situation and authored system

The party needs an authenticated murder file from a corporate evidence vault and then needs to
leave. Physical entry, an employee's credentials, coercion, cutting power, and breaking the vault
remain possible. Intrusion training improves the remote-control route; it does not own the evidence.

| Node | Links after revelation | First breach | Exact permissions |
|---|---|---:|---|
| Public edge terminal | Security gateway | starting position | none; anyone can inspect or damage it locally |
| Security gateway | Camera grid, evidence vault | `+1 Access` | **Mask trace (`1`)**: reduce Alert by one, once per system |
| Camera grid | Gateway, exit control | `+1 Access` | **Loop feed (`1`)**: one named party route is not reported by cameras for this scene |
| Evidence vault | Gateway, exit control | `+1 Access` | **Extract file (`2`)**: copy the authenticated murder record; **scrub copy log (`1`)**: remove the system's record of that copy |
| Exit control | Camera grid, evidence vault | `+1 Access` | **Unlatch exit (`1`)**: open the service exit without a local credential |

The Alert card is visible when the gateway is revealed:

| Alert | Exact response |
|---:|---|
| `1` | The intrusion source is logged and will be actionable after the scene unless Mask trace resolves. |
| `2` | A watchdog joins normal initiative and may oppose later Probe or Breach actions. |
| `3` | The gateway-to-vault link closes, the service exit relocks, and physical security enters the scene. Already extracted evidence remains valid; physical and social routes remain. |

### 3.2 Intrusion-specialist decision trace

An all-success objective-first route takes eight Mains:

1. Probe gateway.
2. Breach gateway: Access `1`.
3. Probe evidence vault.
4. Breach evidence vault: Access `2`.
5. Extract file: spend `2`, Access `0`.
6. Probe exit control.
7. Breach exit control: Access `1`.
8. Unlatch exit: spend `1`, Access `0`.

That route gets the evidence and silent exit quickly, but leaves the camera feed and copy log intact.
A cover-first route breaches the camera grid and spends one Access on Loop feed before the vault.
The team crosses safely, but the specialist reaches the vault with less banked Access and has spent
two additional Mains. Safety now competes with evidence, exit, and time instead of being a free
bonus attached to a high skill.

If the first vault Breach fails, Alert becomes `1` while the gateway's Access remains banked. The
player now has a real recovery choice:

- retry the vault immediately, preserving enough Access to extract on the next success but leaving
  a trace; or
- spend the banked Access and a Main on Mask trace, then breach an additional node before enough
  Access exists to extract the file.

The choice changes later legal actions even though both branches use the same skill bonus. At Alert
`2`, the watchdog also acts between the specialist's ordinary turns; there is no separate solo hacking
minigame or second initiative.

### 3.3 Matched Opportunist trace

The Opportunist can travel with the party and solve every local obstacle at the same bonus:

- match a maintenance schedule to a borrowed badge, create an Opening on the gateway, and consume
  it to enter;
- identify a camera sweep gap, create an Opening on that grid, and consume it to cross or loop one
  local feed;
- find a record-indexing flaw, create an Opening on the vault, and consume it to extract the file;
  and
- expose a damaged latch, create an Opening on the exit, and consume it to leave.

This is useful and can complete the mission. It is also the same local setup/payoff repeated four
times. The Opportunist cannot save the gateway Opening for the vault, divide it between camera and
file permissions, or spend it to change the system's Alert. Route order remains an ordinary party
decision, but there is no persistent Opening allocation across the route.

To reproduce the specialist trace using Openings alone, Opportunist would need permission to hold several Openings, carry
them between targets, expose linked hidden nodes, buy node-specific operations, and suppress a
shared lockdown. That proves the shared protected-system subsystem is real. It does not require
making the subsystem itself an archetype.

## 4. Fixture B — Neanderthal cave murder

### 4.1 Honest genre expression

The murderer's clan protects a taboo route with soot and ochre marks, deadfall conventions, watcher
signals, and resealable clay around a bone cache. None of it is electronic or magical. It is still
a linked human security procedure: disturbing one sign warns later guardians, knowledge at one
point enables choices at another, and the clan has a defined lockdown response.

The intrusion-training presentation is provisionally **Hidden-Way Keeper**; the character retains
their actual genre class. Its UI can use setting-native words while retaining the exact mechanic
IDs:

| Core mechanic | Cave-era wording |
|---|---|
| Probe | Read signs |
| Breach | Answer signs |
| Access | Path Knowledge |
| Alert | Suspicion |
| Operate | Use the hidden way |

This is not a flavored name for generic Power. Path Knowledge exists only on this one protected
route, is earned from its nodes, buys only its printed route permissions, and disappears when the
route scene ends.

### 4.2 Authored protected route

The party needs a worked bone splinter carrying blood and binding resin from the sealed cache. They
can also smash the seal, climb from another chamber, confront the watcher, trigger and survive the
deadfall, or persuade a clan member to admit them. Those routes carry different fictional and
mechanical consequences but keep the clue available.

| Node | Links after revelation | First answer | Exact permissions |
|---|---|---:|---|
| Soot-marked fork | Deadfall passage, watcher ledge | `+1 Path Knowledge` | **Restore marks (`1`)**: reduce Suspicion by one, once per route |
| Deadfall passage | Fork, bone cache | `+1 Path Knowledge` | **Guide the group (`1`)**: the whole party crosses while the deadfall remains armed |
| Watcher ledge | Fork, bone cache, smoke fissure | `+1 Path Knowledge` | **Send all-clear (`1`)**: the watcher does not challenge the party this scene |
| Sealed bone cache | Deadfall, watcher ledge | `+1 Path Knowledge` | **Open and reseal (`2`)**: take the murder evidence while leaving the clay seal apparently intact |
| Smoke fissure | Watcher ledge | `+1 Path Knowledge` | **Leave no ash trail (`1`)**: passage through the fissure leaves no route evidence |

Suspicion is the same Alert state machine in genre language:

| Suspicion | Exact response |
|---:|---|
| `1` | Disturbed marks will identify this route after the scene unless Restore marks resolves. |
| `2` | The watcher enters normal initiative and begins checking the marked route. |
| `3` | The clan blocks the marked passage and actively guards the cache. The party must use the physical, social, or destructive alternatives. |

### 4.3 Intrusion-specialist decision trace

The Hidden-Way Keeper can read and answer the fork, then choose the deadfall or watcher route. The
deadfall route earns enough Path Knowledge to preserve the cache seal only if the character banks
some of it. Spending one to guide the whole group through safely delays the cache operation or
requires answering another node. The watcher route creates the same choice between Send all-clear
now and keeping enough knowledge to Open and reseal later.

After a failed Answer signs action at the cache, the player can spend one banked Path Knowledge to
Restore marks and remove the first Suspicion, or preserve two for the evidence and accept that the
clan will later know the protected route was used. At Suspicion `2`, a living watcher begins acting
between the character's turns. These are the same bank/spend/order/Alert decisions as the data vault,
expressed without pretending a soot mark is a computer terminal.

### 4.4 Matched Opportunist trace

The Opportunist remains fully valid in the same story. They can find a loose deadfall counterweight,
distract or deceive the watcher, spot a weak clay seam, and exploit each local Opening once. Their
Mastery applications also make them the broader clue-reader or negotiator outside the route.

Again, finishing the scene is not the distinction. The Opportunist repeatedly asks “how do I create
one chance against this obstacle?” The Hidden-Way Keeper asks “which part of this linked protection
do I understand, where do I spend that understanding, and how much suspicion can we accept before
the remaining route changes?” Both are coherent playstyles; only the second engages deeply with the
shared protected-system rules and specialist training.

## 5. Collapse verdict

| Question | Result |
|---|---|
| Can a common skill resolve a local terminal, lock, trap, mark, sentry, or ward? | **Yes.** No class permission is required. |
| Can one Opportunist Opening reproduce one local intrusion operation? | **Yes.** For a one-node obstacle, use the Opening or an ordinary skill; the subsystem must not appear. |
| Can one target-bound Opening reproduce banked Access across linked nodes? | **No.** It loses allocation, route, and later-permission choices. |
| Can ordinary failure consequences reproduce Alert? | **Not by themselves.** Alert persists across nodes and changes later legal routes; it must be authored system state. |
| Does the distinction survive outside cyberpunk? | **Yes.** The cave route preserves the exact loop without technological or magical reskinning. |
| Does the subsystem justify a separate class? | **No.** Its authoring substrate and state belong to the scenario; specialization belongs in training or a broader build. |
| Is numerical balance demonstrated? | **No.** Equal controls isolate identity, not output or progression balance. |

**Owner decision:** remove Intruder from the candidate roster. Keep qualifying protected systems as
shared scenario rules; keep intrusion as skills plus a specialization/training path, naturally
associated with an Opportunist/Rogue-style build but buyable by other classes at the normal
cross-training cost. The exact benefits and cost remain unsettled.

Before any rules approval, a balance pass still has to price specialist information, remote reach,
exact permissions, and Alert suppression against other training choices. It must also prove that
protected systems never monopolize evidence or force the rest of the party to watch a solo
minigame.

## 6. Prototype 2 — Armsmaster versus Adept

### 6.1 Result and collapse rule

**Prototype recommendation: Adept survives as a separate universal archetype candidate.** This is
not yet an owner roster ruling.

Armsmaster and Adept can use the same weapon, skill bonus, action budget, harm vocabulary, and
fictional profession. Their repeated decisions are still different:

- Armsmaster asks, “Which complete Form is best now?” It may choose any known Form every turn and
  immediately gets that Form's attack line and prepared Counter.
- Adept asks, “Which legal element advances the sequence I will want next?” It must use an opening,
  then a flow, then a finishing technique. Restarting or being interrupted forfeits the delayed
  permission.

Adept collapses if technique order can be shuffled without changing legal effects, or if one
opening/flow/finisher rotation dominates every ordinary fight. It survives only if current sequence
state repeatedly changes which techniques are legal and whether adapting now is worth delaying the
finisher.

### 6.2 Open-system precedent and house boundary

The established precedent is the official *13th Age Archmage Engine v4.0* class SRD:
<https://pelgranepress.com/2013/10/24/the-archmage-engine-13th-age-srd/>.
Its open monk structure teaches each form as an opening, flow, and finishing element; the first
attack is an opening, hit or miss advances the sequence, a turn without a form attack resets it,
and the character may choose the current-stage element from any learned form.

This prototype borrows that ordering question only. It does not copy donor attacks, damage, ki,
d20 math, or explanatory text. It uses the signed house d100 check, house harm/effect vocabulary,
and the audit's candidate branches. Any future adoption would still face the OGL/licensing gate
already recorded for Cadence. Studying the structure here does not adopt that license.

### 6.3 Matched controls

| Control | Armsmaster | Adept |
|---|---|---|
| Prototype tier | Same notional first-tier character | Same notional first-tier character |
| Relevant SkillBonus | 20 | 20 |
| Check | Signed d100 meet-or-beat, same target and deltas | Signed d100 meet-or-beat, same target and deltas |
| Durability | Same HP, defense, armor, and recovery | Same HP, defense, armor, and recovery |
| Equipment | Same genre-appropriate primary weapon and backup | Same genre-appropriate primary weapon and backup |
| Turn budget | One Main, one Move, at most one Reaction | One Main, one Move, at most one Reaction |
| Generic resource | None | None |
| Baseline | Every Form has a legal attack | An opening is legal from every sequence state |

The sample uses Light, Standard, and Heavy harm only as the already-defined comparison vocabulary.
It does not assign final numbers. A clean three-action Adept sequence must be priced to the same
total action/effect budget as three Armsmaster turns before either can pass balance testing.
Sequence state is not Power and the player never spends points to advance it.

### 6.4 Armsmaster prototype card

**Tracked state:** one active Form and at most one armed Counter. At the start of each turn, choose
or keep any known Form. Choosing a different Form replaces the prior Form and its Counter.

**Form action — Main:** make that Form's printed weapon action. At the end of the action, arm its
printed Counter if it has one. A Counter uses the character's normal Reaction and expires at the
start of the next turn.

| Known Form | Main action | Prepared Counter |
|---|---|---|
| **Pressing Form** | Deal Standard harm to the engaged target. | **Pursue:** if that target leaves the engagement, follow it one bounded move. |
| **Driving Form** | Deal Light harm and reposition self or target one bounded step on success. | none |
| **Guarding Form** | Deal Light harm. | **Deflect:** reduce the next incoming hit by one printed harm category. |

The exact payloads are prototype fixtures, not adopted abilities. What matters is that all three are
complete current-turn choices. The Armsmaster can Drive on turn 1, Guard on turn 2, and Press on
turn 3 without earning or preserving a sequence.

**Progression direction:** more Forms, deeper branch-specific riders, and stronger or more
conditional Counters. It must not add opening/flow/finisher prerequisites; that would cross the
collision boundary.

### 6.5 Adept prototype card

**Tracked state:** opening, flow, or finishing. It begins at opening.

**Technique action — Main:** choose any known technique matching the current state and make its
printed attack. Hit or miss, move to the printed next state. After a finishing technique, return to
opening.

**Restart:** an opening is legal from any state. Using one voluntarily abandons the current flow or
finishing permission and starts a new sequence. Taking a Main that is not an Adept technique resets
the next technique to opening.

The prototype knows two forms and may mix their elements:

| Current state | Driving Path | Guarded Path | Next state |
|---|---|---|---|
| opening | **Closing Step:** deal Light harm and take one bounded step. | **Set the Root:** deal Light harm and gain the printed minor guard until next turn. | flow |
| flow | **Turning Drive:** deal Light harm and reposition the target on success. | **Catching Guard:** deal Light harm and arm Deflect under the normal Reaction cap. | finishing |
| finishing | **Break the Line:** deal Heavy harm and Hinder the target on success. | **Return the Force:** deal Heavy harm and reposition the target on success. | opening |

The player can use Closing Step, then Catching Guard, then Break the Line; the form names organize
the catalog but do not lock the character into one three-button script. What is locked is the
element order.

**Progression direction:** more current-stage choices, alternative links, and branch exceptions.
Flow may add movement and cross-links. Stillness may preserve or redirect the sequence through one
bounded disruption. Neither branch may make finishers freely selectable every turn.

### 6.6 Fixture A — stable four-round duel

The opponent remains engaged, has no special vulnerability, and changes no terrain. Both characters
receive the same attack-result tape. The fixture asks whether either loop degenerates when the world
does not create an obvious tactical prompt.

**Armsmaster:** Pressing Form is a legal choice every round. The player may repeat it for steady
output or choose Guarding because the incoming hit matters. There is no delayed permission.

**Adept:** the first three Mains must be opening → flow → finishing to reach a finisher. On the
fourth, the sequence returns to opening. At flow and finishing, the player still chooses between
the Driving and Guarded elements, but the broad stage order is fixed.

**Result:** order is mechanically real, because a random technique order cannot legally produce the
same finishers. The fixture also exposes the main design risk: if one element is best at every stage,
Adept becomes a rote rotation rather than a repeated decision. Before roster approval, the starting
card therefore needs at least two situationally competitive choices at flow and finishing, and
playtests must show that no single three-step line dominates ordinary fights.

### 6.7 Fixture B — moving rescue under disruption

The fight runs in normal initiative. A blocker holds a narrow route, an ally is pulled toward a
hazard on turn 2, the blocker attempts to flee on turn 3, and the character must spend one later
Main helping the ally instead of attacking.

| Turn and changed need | Armsmaster decision | Adept decision |
|---|---|---|
| 1 — cross the blocker | Choose Driving immediately for bounded reposition. | Choose either opening; both advance to flow. The choice shapes immediate guard or movement, not access to a finisher yet. |
| 2 — protect the endangered ally | Switch immediately to Guarding and arm Deflect. | At flow, choose Catching Guard and preserve finishing permission, or restart with Set the Root and delay the finisher. |
| 3 — stop the fleeing blocker | Switch immediately to Pressing and arm Pursue. | At finishing, use Break the Line for control, use Return the Force for position, or abandon the finisher for an opening if neither fits. |
| 4 — spend Main helping the ally | No Form action this turn; next turn any Form is still selectable. | The non-technique Main resets the sequence; next turn must be an opening unless a bounded Stillness feature says otherwise. |

Injecting the same miss on turn 2 does not erase the distinction. Armsmaster simply chooses any Form
on turn 3. Adept's missed flow still advances to finishing, following the established precedent, so
the miss costs its immediate effect without also deleting two turns of sequence work.

**Result:** the Adept repeatedly trades immediate adaptation against future legal permission.
Armsmaster adapts without that debt. Adding sequence prerequisites to Armsmaster would recreate the
Adept engine; removing them from Adept would reduce its techniques to Forms.

### 6.8 Fixture C — genre and weapon regression

The same mechanical fixture remains honest under three presentations:

| Mechanical home | High fantasy | Cyberpunk | Cave-era hunt |
|---|---|---|---|
| Armsmaster | **Fighter:** choose Pressing, Driving, or Guarding Form for this exchange. | **Street Samurai:** load the combat routine needed now. | **Spear Hunter:** choose press, drive, or guard according to the animal's current movement. |
| Adept | **Monk:** opening technique, then a chosen flow, then a legal finisher. | **Reflex Dancer:** entry routine, linked transition, finishing routine. | **Bear-Step Hunter:** close by taught footwork, turn the charge, then complete the spear sequence. |

The cave-era Adept is not using magic, modern coaching language, or an electronic combo meter. The
character has learned an exact physical sequence whose current step constrains the next one.

Weapon and profession do not select the archetype. An axe fighter whose player wants ordered chains
is an Adept; an unarmed brawler whose player wants a freely selected current-turn technique is an
Armsmaster. Buying Melee, a weapon proficiency, or “martial artist” background grants neither Forms
nor sequence permissions.

### 6.9 Attempted collapse

Translating every Adept element into an Armsmaster Form has only three possible outcomes:

1. Make every technique freely selectable. The finisher becomes available on turn 1, and the
   anticipation, restart, disruption, and legal-order decisions disappear.
2. Add prior-Form requirements to the techniques. Armsmaster now tracks opening/flow/finishing
   state and has recreated Adept.
3. Let the character choose between unrestricted Forms and the stronger sequence each turn. The
   merged class gains both adaptation and delayed payoff without paying either opportunity cost and
   strictly dominates the matched cards.

The distinction therefore cannot be collapsed while preserving both loops and the common action
budget.

### 6.10 Class-level verdict and remaining risks

| Question | Result |
|---|---|
| Does technique order change later legal actions? | **Yes.** Only the current stage's elements are legal, and interruption resets the permission. |
| Is the state character-owned? | **Yes.** The sequence travels with the character and begins with an always-legal opening. |
| Does the loop require a campaign-authored subsystem? | **No.** Any ordinary conflict supplies a target; no special scene object is required. |
| Can Melee, equipment, or profession reproduce it? | **No.** They grant competence or permission to use a weapon, not the sequence graph. |
| Does it survive genre changes? | **Yes.** The exact order works as monastic form, combat routine, or taught hunting footwork. |
| Is the loop automatically fun? | **No.** A dominant rotation would satisfy formal order while failing meaningful choice. |
| Is numerical balance demonstrated? | **No.** The clean-chain budget and disruption cost still require package-specific tuning and playtest. |

**Current consequence:** retain Adept as a separate coherent candidate for paired interaction
testing. Unlike intrusion, its defining state is on the character, its floor is always available,
and its progression can deepen the same repeated sequence decision in every campaign. That formal
result assigns neither a campaign tier nor an enjoyment verdict.

Calling both candidates “Warrior” in marketing would not collapse their mechanics. Under the
current character-creation contract, the archetype choice tells the player which repeated loop they
are buying; a single Warrior archetype whose genre class silently replaces free Forms with a
sequence would stop that choice from being predictive.

Paired-test controls and hypotheses:

1. the UI must always show current stage, next legal techniques, and what action would reset it;
2. the starting card must offer competitive choices at flow and finishing rather than one solved
   rotation;
3. a clean three-action chain must remain within the same total action/effect budget as three
   Armsmaster turns;
4. hit or miss advances the sequence so one failed check does not also erase setup;
5. non-technique actions reset it, with only bounded authored exceptions;
6. Forms and sequence riders cannot stack through cheap multiclassing; and
7. real play determines whether planning and adaptation are enjoyable rather than bookkeeping;
   the preceding paper checks do not decide that result.

## 7. Former next collapse prototype

One useful paired-test comparison remains: ordinary Leadership versus Catalyst, a learned
capability against persistent ally-trigger Cues.

The later interaction-burden audit predicts that Cue setup and cross-actor trigger maintenance may
become rotation or ignorable automation. The active owner decision makes that a playtest hypothesis,
not an approved Catalyst removal. Run the Leadership comparison only through a separately
authorized paired-scenario plan and harness. The three frozen rules packages remain unchanged and
may not be regenerated from this record.
