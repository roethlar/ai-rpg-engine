# Archetype collapse prototypes

**Status:** prototype 1 of 3 complete; evidence for an owner roster ruling, not an approved roster,
rules package, or implementation  
**Date:** 2026-08-02  
**Scope:** test whether candidate archetypes still create different repeated decisions after jobs,
roles, status, skills, and genre flavor are stripped away

## Bottom line

**Intruder survives the collapse test against Opportunist, but only as a conditional class.** The
distinction is not that an Intruder is better at hacking, sneaking, traps, or investigation. Those
remain common skills. The distinction is a persistent, engine-authored protected system: linked
nodes, system-scoped Access that can be banked and spent on exact permissions, and Alert that
changes later routes before lockdown.

Both the cyberpunk data vault and the Neanderthal protected route produce the same extra decisions:
which node to expose first, whether to spend Access on immediate safety or preserve it for the
objective, whether to repair a rising Alert or accept a later response, and which permissions are
still reachable after that choice. A single target-bound Opening cannot reproduce those decisions.
Giving Opportunist multiple transferable Openings, a linked map, and system-wide Alert operations
would merely rebuild Intruder inside Opportunist.

The inverse boundary matters just as much: a single terminal, lock, ward, sentry, trap, clue, or
social checkpoint is **not** a protected system. It is resolved by a common skill, equipment, or an
Opportunist Opening. A campaign that cannot promise recurring multi-node systems must not offer
Intruder. In that campaign, a hacker, spy, infiltrator, or taboo-path expert is an Opportunist,
Maker, or another class with the relevant skills.

This is a mechanical-identity verdict only. It does not show that Intruder is numerically balanced,
approve its final progression, settle the universal roster, or unfreeze any rules package.

## 1. Test and controls

### 1.1 Collapse rule

Intruder survives only if matched characters encounter legal, repeated choices that are lost when
its card is replaced by Opportunist plus the same skills. It collapses if Probe, Breach, Access,
and Alert can all be restated as one local setup/payoff without removing a choice or permission.

The test deliberately asks a narrower question than “can both characters finish the scene?” Both
must be able to contribute, and required evidence or progress must have physical, social, covert,
or destructive alternatives. A class can have a distinct loop without owning the only solution.

### 1.2 Matched prototype characters

| Control | Opportunist | Intruder |
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
state comes from the class cards rather than favorable competence or rolls.

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

### 2.2 Intruder prototype card

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

**Progression direction:** a larger authored tool/program loadout, access to more exact permission
types, deeper simultaneous control, and bounded Alert suppression. Final capacity and cadence are
package questions. Progression cannot turn Access into class Power or let the player invent a
permission in prose.

### 2.3 What qualifies as a protected system

For this prototype, the engine may instantiate `ProtectedSystem` only when all of these are true:

1. it has at least three linked nodes rather than one obstacle split into fake steps;
2. node order or route choice changes which later operations are legal;
3. at least two useful permissions compete for the available Access or time;
4. Alert has an exact response that changes the map, permissions, or opposition;
5. ordinary local tasks remain available through common skills; and
6. required progress has at least one non-Intruder route.

If any of the first four conditions is missing, use one ordinary check or one Opportunist Opening.
The GM cannot label every creature, locked door, or difficult conversation a “system” merely to
create work for the class.

## 3. Fixture A — cyberpunk data vault

### 3.1 Situation and authored system

The party needs an authenticated murder file from a corporate evidence vault and then needs to
leave. Physical entry, an employee's credentials, coercion, cutting power, and breaking the vault
remain possible. Intruder offers a remote-control route; it does not own the evidence.

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

### 3.2 Intruder decision trace

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
The team crosses safely, but the Intruder reaches the vault with less banked Access and has spent
two additional Mains. Safety now competes with evidence, exit, and time instead of being a free
bonus attached to a high skill.

If the first vault Breach fails, Alert becomes `1` while the gateway's Access remains banked. The
player now has a real recovery choice:

- retry the vault immediately, preserving enough Access to extract on the next success but leaving
  a trace; or
- spend the banked Access and a Main on Mask trace, then breach an additional node before enough
  Access exists to extract the file.

The choice changes later legal actions even though both branches use the same skill bonus. At Alert
`2`, the watchdog also acts between the Intruder's ordinary turns; there is no separate solo hacking
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
decision, but there is no persistent class-state allocation across the route.

To reproduce the Intruder trace, Opportunist would need permission to hold several Openings, carry
them between targets, expose linked hidden nodes, buy node-specific operations, and suppress a
shared lockdown. That is not “Opportunist plus Systems”; it is the protected-system subsystem under
different names.

## 4. Fixture B — Neanderthal cave murder

### 4.1 Honest genre expression

The murderer's clan protects a taboo route with soot and ochre marks, deadfall conventions, watcher
signals, and resealable clay around a bone cache. None of it is electronic or magical. It is still
a linked human security procedure: disturbing one sign warns later guardians, knowledge at one
point enables choices at another, and the clan has a defined lockdown response.

The genre class is provisionally a **Hidden-Way Keeper**. Its UI can use setting-native words while
retaining the exact mechanic IDs:

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

### 4.3 Intruder decision trace

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
the remaining route changes?” Both are coherent playstyles; only the second needs the conditional
class subsystem.

## 5. Collapse verdict

| Question | Result |
|---|---|
| Can a common skill resolve a local terminal, lock, trap, mark, sentry, or ward? | **Yes.** No class permission is required. |
| Can one Opportunist Opening reproduce one local Intruder permission? | **Yes.** For a one-node obstacle, Intruder collapses and the subsystem must not appear. |
| Can one target-bound Opening reproduce banked Access across linked nodes? | **No.** It loses allocation, route, and later-permission choices. |
| Can ordinary failure consequences reproduce Alert? | **Not by themselves.** Alert persists across nodes and changes later legal routes; it must be authored system state. |
| Does the distinction survive outside cyberpunk? | **Yes.** The cave route preserves the exact loop without technological or magical reskinning. |
| Is the class universally portable? | **No.** The authoring substrate belongs to the campaign, not the character. |
| Is numerical balance demonstrated? | **No.** Equal controls isolate identity, not output or progression balance. |

**Recommendation:** retain Intruder as a conditional candidate. Offer it only when campaign creation
records an engine-known guarantee of recurring qualifying protected systems and the content pipeline
can enforce that guarantee. Otherwise omit the archetype and build the concept through Opportunist,
Maker, another class, and common skills. If the product rejects conditional classes as a creation
concept, fold Intruder for availability reasons—not because its mechanic is indistinguishable.

Before any roster approval, a package-specific balance pass still has to price the extra information,
remote reach, exact permissions, and Alert suppression against Opportunist's broader investigation,
social utility, and self-created floor. It must also prove that authored protected systems appear at
the promised cadence without monopolizing evidence or forcing the rest of the party to watch a solo
minigame.

## 6. Remaining collapse prototypes

This result does not answer the other two collisions from the option atlas:

1. Armsmaster versus Adept: free Form choice against ordered opener/flow/finisher chains.
2. Ordinary Leadership versus Catalyst: a learned capability against persistent ally-trigger Cues.

The three frozen rules packages remain unchanged until both tests also have concrete cards and
scenario results and the owner rules on the resulting roster.
