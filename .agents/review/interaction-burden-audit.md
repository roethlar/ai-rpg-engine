# Text-entry interaction-burden audit

**Status:** owner-requested design audit; recommendations only; no roster, rules package, or
implementation is approved by this document

**Date:** 2026-08-02

**Scope:** evaluate every candidate mechanic in the current archetype atlas, the protected-system
procedure, the three frozen ability-economy variants, and their creation/progression surfaces
against the actual browser text-entry game rather than against abstract mechanical distinctness

## Bottom line

The current admission test overvalues a private repeated loop. A mechanic can be formally unique
and still be a poor text-game mechanic when the player must service a meter, stance, setup token,
cue, or ordered sequence every turn. If the UI exposes the legal steps, play becomes button
rotation; if the engine chooses the steps, the mechanic becomes ignorable automation.

For this game, a class still needs distinctive authored permissions and effects, but it does not
need its own minigame or tracker. The useful interaction shapes are an immediate named ability, an
always-on passive, one infrequently changed mode or binding, or a small between-scene loadout. The
player should normally make at most one mechanical selection for the action they already intend,
then receive the resolution. Text may describe the action, but it never invents or selects the
mechanical payload.

Applied to the twelve candidates currently carried by the atlas:

- **Keep the basic interaction shape, with guardrails:** Arcanist, Channeler, Oathbound, Shifter.
- **Keep the character concept but simplify or replace the current loop:** Armsmaster, Berserker,
  Opportunist, Maker, Bonded.
- **Fold/remove the current class mechanic:** Adept and Catalyst.
- **Keep only as a campaign-level opt-in module:** Rider.

This is not a roster ruling. It invalidates the atlas's ten-universal-candidate working baseline as
the next design input: five of those ten mechanics need redesign and Adept should not proceed merely
because its sequence state passed a formal collapse test. Catalyst's Cue loop fails the same
interaction test before a Leadership comparison is useful.

Of the three frozen economies, only Commitment is a plausible starting shape, and it is still too
busy as written. Slots and rests multiplies counters and recovery negotiations; Cadence explicitly
turns abilities into an availability-icon and cooldown interface. None is ready for approval.

## 1. Interaction-fit contract

### 1.1 Normal player exchange

The target exchange is:

1. The player states an intent in text.
2. If using a special mechanic, the player explicitly selects one known ability and any required
   target. The ability ID owns the rule; prose only describes it.
3. The engine validates and resolves the action, then shows the result and any state that actually
   changed.

A normal action should not open a required follow-up chooser for stance, spend amount, reaction,
next link, trigger, or recovery. A player may open the ability catalog when they want it; the game
should not turn each text entry into a mandatory tour of the catalog.

### 1.2 Burden dimensions

| Dimension | Low burden | High burden / failure signal |
|---|---|---|
| Selection frequency | explicit choice when invoking a special ability | mandatory choice or confirmation every turn |
| State | one visible mode, target, or small resource changed deliberately | several counters, links, targets, or bodies that need maintenance |
| Sequence | action resolves now | action exists mainly to unlock a later action |
| Interruption | engine applies already-declared reactions | mid-resolution prompts or ally-trigger confirmations |
| Automation | engine handles arithmetic and cleanup | engine must choose the player's best legal tactic |
| Ignorability | class remains legible while unused, and choosing it matters | ignoring the tracker erases the class; automating it erases agency |
| UI footprint | state appears contextually or on request | hotbar, cooldown wall, combo track, or persistent maintenance panel |

Burden is justified only when it creates a decision the player can understand and might reasonably
answer differently. Spell choice, transformation, and a sworn target can pass despite having rules.
“Advance to the only sensible next step” cannot.

### 1.3 Admission gate for a text-entry class

A candidate mechanic should not advance unless all of these are true:

1. Its ordinary use takes at most one explicit mechanical selection plus a target.
2. It has no mandatory ordered rotation or setup action whose main purpose is unlocking the payoff.
3. It needs no mid-turn or other-player interrupt prompt.
4. Any persistent class state is singular, clearly visible, and changes infrequently or by a
   deliberate player action.
5. Engine automation handles legality, arithmetic, triggers, and cleanup, but never chooses the
   player's tactic.
6. The mechanic remains mechanically exact without asking a model to infer an ability from prose.
7. The extra interaction earns a materially different decision, not merely a different animation,
   noun, or delayed permission.

## 2. Candidate-by-candidate audit

| Candidate | What the current card makes the player do | Interaction failure if ignored or automated | Burden verdict | Recommended disposition |
|---|---|---|---|---|
| **Armsmaster** | Choose or keep a Form every turn, execute its rider, and arm its Counter. | Defaulting to one Form makes the class repetitive; automatically selecting the best Form removes the class's decision. | High-frequency choice with extra state. | **Simplify.** Keep authored martial maneuvers, but have a chosen maneuver resolve its rider and any prepared reaction in the same exchange. Do not require a separate active-Form choice every turn. |
| **Berserker** | Raise and monitor an ordered Exposure track to unlock stronger techniques while defenses or harm consequences worsen. | Ignoring Exposure leaves a generic tough attacker; automatic escalation makes a risk decision on the player's behalf. | Meter maintenance; meaningful risk buried under repeated tracking. | **Simplify.** Preserve the deliberate power-for-danger choice as one explicit, persistent commitment such as entering or ending a dangerous state; remove the multi-step meter unless play proves every step changes a real decision. |
| **Adept** | Follow opening → flow → finisher, inspect the legal techniques at the current stage, and restart after interruption. | The UI produces “next, next, next, finish”; automation reduces the class to an invisible rotation. | Fails: high recurring burden for low agency. | **Remove/fold.** Map monk, martial artist, disciplined hunter, and similar concepts to the simplified Armsmaster or another ability package. Do not keep a class-wide combo track. |
| **Opportunist** | Create one Opening on a target, consume it for a payoff, then repeat the setup/payoff cycle. | If Openings are inferred from prose, mechanics become model-selected; if the UI directs setup then exploit, it becomes a two-button combo. | Fails unchanged; salvageable without the personal two-step loop. | **Simplify.** Use immediate authored exploits with exact visible prerequisites. A setup action must deliver its own useful result, and an exploit may use an engine-known scene condition; no action should exist only to mint the next-action token. |
| **Arcanist** | Choose a small prepared loadout outside danger, then explicitly select a ranked spell or ritual when wanted. | A very large catalog or frequent re-preparation becomes administration, but automation is not needed during ordinary turns. | Moderate, mostly between scenes; burden buys real breadth decisions. | **Keep with guardrails.** Supply a small default loadout, make preparation optional to revisit, and require only spell plus target at use time. Exact casting economy remains open. |
| **Channeler** | Select one effect from a narrow known repertoire and sometimes choose its printed overreach consequence. | Asking “overreach?” after every cast adds a prompt; choosing it automatically steals a meaningful risk choice. | Moderate and potentially justified. | **Keep with guardrails.** Present base and overreached uses as explicit alternatives selected up front, never as a post-action prompt. Keep the repertoire small and the consequence exact. |
| **Oathbound** | Bind one authored declaration to an ally, place, objective, or foe; use only the effects legal through that binding; optionally rebind with an action. | Frequent target changes or reaction questions create maintenance; automatic rebinding changes the character's sworn intent. | Low-to-moderate if the binding persists; high if managed every turn. | **Keep with guardrails.** Make the declaration an infrequent explicit choice, keep one visible binding, and pre-arm or automatically resolve already-selected reactions without interrupts. |
| **Shifter** | Explicitly switch one complete profile, then use the actions and permissions of that profile until switching again. | Automatic “best form” selection removes identity; too many profiles create a second character sheet. | Moderate; one persistent state with a clear fictional meaning. | **Keep with guardrails.** Use a small number of whole profiles, make switches deliberate and infrequent, and let the engine replace all fields atomically. No per-action stance optimization. |
| **Maker** | Prepare device cards, deploy or trigger them, track active installations, retire one at the cap, and reconfigure later. | Ignoring the loadout leaves ordinary Craft; automatic replacement chooses inventory strategy for the player. | High between-scene load plus occasional cap prompts. | **Simplify.** Keep a small fixed/default kit and explicit device actions. Limit persistent installations sharply and ask about replacement only when the player deliberately deploys beyond the cap. Avoid consumable piles and routine reconfiguration. |
| **Bonded** | Control two bodies with separate positions and conditions, choose which takes the shared Main, and satisfy coordinated-position requirements. | Ignoring one body turns the companion into flavor; automation takes control of a player-owned character. | Very high current-state footprint, though the fantasy is not replaceable by a job or skill. | **Redesign before admission.** Default the companion to following the character and acting only through the player's chosen companion or coordinated ability. Track separate position only after the player deliberately splits them. Re-test whether the simplified result still earns a class seat. |
| **Catalyst** | Spend an action establishing a Cue, wait for another actor to meet its trigger, then consume or expire it. | It needs cross-actor tracking and trigger handling; automation makes it a passive buff, while explicit handling becomes setup → trigger button play. | Fails: high coordination burden and dependence for a delayed rider. | **Remove/fold.** Put Leadership in skills and express exceptional support as immediate authored abilities that resolve on selection. Bard, warlord, performer, and commander remain valid genre classes or builds without a Cue chassis. |
| **Rider** | Manage rider/vehicle shared actions, hull, occupants, vehicle-scale position, maneuvers, and damage control. | Hiding the layer makes Pilot plus asset sufficient; exposing it adds a second tactical rules surface. | High but honest only when the campaign is about that surface. | **Module only.** Offer it when campaign creation explicitly opts into recurring vehicle play. It is not a universal archetype and must not burden ordinary personal-scale campaigns. |

### 2.1 Resulting count

| Disposition | Count | Candidates |
|---|---:|---|
| Basic interaction shape survives | 4 | Arcanist, Channeler, Oathbound, Shifter |
| Concept survives; mechanic needs simplification/redesign | 5 | Armsmaster, Berserker, Opportunist, Maker, Bonded |
| Current class mechanic should be removed/folded | 2 | Adept, Catalyst |
| Campaign module only | 1 | Rider |

These counts describe audit recommendations, not an approved nine-class roster. A redesign can still
fail, merge with another package, or expose a missing concept. Likewise, “keep” approves only the
interaction shape, not the ability catalog, numerical balance, resource economy, or genre mappings.

## 3. Shared and scenario mechanics

### 3.1 Protected-system intrusion

The owner decision already removes Intruder as a class, but the current shared prototype still
requires Probe → Breach → accumulate Access → Operate across several nodes while Alert rises. Its
cyberpunk example takes eight Main actions on a clean route. That is a high-burden subsystem and a
likely solo minigame even though it no longer consumes a class seat.

Keep the settled boundary—intrusion is skills/training over authored security—but do not treat the
current node procedure as approved. A replacement should present only a few consequential route,
risk, or permission choices to the whole party. Access or Alert may remain if each state changes an
actual decision; an eight-step ideal route and a terminal-style node UI fail this audit.

### 3.2 Actions and reactions

The shared Main/Move/Quick budget can remain engine accounting rather than three mandatory UI
choosers. A text action may consume several known action components when its selected ability says
so. The existing no-interrupt reaction rule is compatible with text play only when the player arms
the reaction as part of an intended ability or persistent policy. A separate “which reaction?” step
every turn would recreate the same burden as Forms.

### 3.3 NPCs

The settled compact-card NPC boundary reduces GM burden and is compatible with this audit. The GM
or model should receive only currently legal encounter actions; bespoke boss mechanics can be more
complex internally without requiring the human GM to operate a player-class sheet. Player-facing
tells and counterplay still matter, but NPC-exclusive state is not a reason to add player prompts.

## 4. Ability-economy variants

| Frozen variant | Player-visible maintenance | Interaction result | Recommendation |
|---|---|---|---|
| **Commitment** | Effort capacity plus turn/duration/scene/day return timings; maintained effects; Strain; separate Arcanist castings. | Lowest of the three, but four return timings and the additional caster/healing tracks exceed the simplicity suggested by “one resource.” | **Only plausible starting shape, not adoptable unchanged.** Preserve honest shared terminology and exact one-point commitments, then reduce return categories and secondary counters before testing. |
| **Slots and rests** | Ranked slots, prepared/known lists, class-specific use counters, Recoveries, Short Rests, Long Rests, and party recovery negotiation. | Familiar to some tabletop players but objectively the largest routine bookkeeping surface, especially for casters. | **Do not advance as the default text-game package.** Familiarity does not compensate for the interaction load. |
| **Cadence** | At-will/once-battle/recharge/heal-up availability, random recharge checks, Recoveries, Rally, Escalation thresholds, and Full Heal-up progress/loss. | Produces exactly the cooldown icons, legal-option filtering, and combat rhythm the owner identified as drifting toward a conventional tactical video game. | **Do not advance for this interaction model.** Its burden is structural, not a missing help-panel explanation. |

The audit does not select or invent a replacement economy. It narrows further work: any revised
package must show its complete player-visible counters and recovery prompts, not merely explain its
mathematical balance.

## 5. Creation and progression burden

The frozen packages advertise seven short creation choices, but the actual surface contains more:
four attribute placements, a training card, background, wealth, institutional relationship,
identity fields, starting abilities, and—depending on package and class—a prepared or known spell
list. Cadence starts with six ability choices. “Seven steps” therefore understates the number of
decisions and the amount of rules the player must inspect.

The settled hierarchy remains archetype → genre class → training/background/standing/assets/
identity. To keep it usable, authored genre classes should provide a complete recommended build at
each later step, and accepting that recommendation should require no nested optimization. Manual
customization can remain available. The persistent help panel should explain the focused choice,
not display the entire final rules sheet while the player is still choosing.

Progression has the same constraint. Skill-point arithmetic, attribute schedules, talents, class
features, catalog upgrades, resource-capacity changes, and multiclass rules should not all demand a
choice at one level. A future package must show the exact number of owner-facing decisions at each
advancement event and offer complete authored options; derived values and legality remain automatic.

This audit does not set a new creation-time target or approve a progression schedule. Both need a
real UI walkthrough after the roster and economy are simplified.

## 6. Consequences for the current work queue

1. Do not use the atlas's ten-universal-candidate list as the baseline for regenerating the three
   frozen packages.
2. Do not run the planned Leadership-versus-Catalyst Cue prototype unless the owner rejects this
   audit's interaction finding; Cue sequencing already fails before balance against Leadership is
   relevant.
3. Seek an owner ruling on the interaction-fit contract and the Adept/Catalyst disposition before
   redesigning the five burdened concepts.
4. After those rulings, prototype ordinary text exchanges—not abstract cards—for each surviving
   redesign. Each prototype must show player input, optional explicit ability selection, engine
   state before/after, UI prompts, and the result when the special mechanic is not invoked.
5. Only then construct a smaller roster candidate and an ability economy that meet the same burden
   limit, then propose exact Base/Advanced/Expert membership under the later owner decision. The
   frozen packages remain evidence and licensing research, not templates to patch row by row.

## 7. Owner-settled phased availability after this audit

The 2026-08-02 campaign-version decision in `.agents/decisions.md` settles how eventual roster
options are exposed without pretending this audit has already approved them:

- campaign creation selects cumulative **Base (recommended)**, **Advanced**, or **Expert (full)**
  class availability from the sets allowed by administration;
- tiers represent breadth and interaction burden, not power or level gates;
- every option present in a set is available from level 1;
- campaigns pin set/catalog versions, and neutral configured absence replaces model-shaming
  exclusions;
- when administration permits upgrades, a host may safely version the campaign and apply authored
  class balance migrations without restarting;
- the upgrade saves player-owned pre-upgrade character versions for compatible older campaigns,
  with independent progression and no merging.

The exact tier membership remains blocked on the roster and economy work above. This section is a
pointer to the settled release/version policy, not an authorization to assign current candidates to
tiers or implement upgrade storage.
