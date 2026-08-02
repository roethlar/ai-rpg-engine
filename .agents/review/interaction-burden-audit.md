# Text-entry interaction-burden audit

**Status:** owner-requested risk inventory and playtest hypotheses; no paper admission gate,
roster, tier membership, rules package, or implementation is approved by this document

**Date:** 2026-08-02

**Scope:** evaluate every candidate mechanic in the current archetype atlas, the protected-system
procedure, the three frozen ability-economy variants, and their creation/progression surfaces
against the actual browser text-entry game rather than against abstract mechanical distinctness

## Bottom line

The prior admission test overvalued a private repeated loop. A mechanic can be formally unique and
still risk becoming poor text-game play when the player must service a meter, stance, setup token,
cue, or ordered sequence every turn. If the UI exposes only the legal next step, play may become
button rotation; if the engine chooses the step, the mechanic may become ignorable automation.
Those are important risks, not results that paper analysis can establish.

The lower-risk starting shapes are an immediate named ability, an always-on passive, one
infrequently changed mode or binding, or a small between-scene loadout. More involved mechanics may
still earn their burden if players understand them, invoke them voluntarily, and make meaningfully
different choices. Text may describe the action, but it never invents or selects the mechanical
payload; that separate authority boundary remains settled.

Applied to the twelve candidates currently carried by the atlas:

- **Lower paper-risk starting hypotheses:** Arcanist, Channeler, Oathbound, Shifter.
- **Focused unchanged-versus-simplified comparisons:** Armsmaster, Berserker, Opportunist, Maker,
  Bonded.
- **Highest-risk full-mechanic-versus-folded comparisons:** Adept and Catalyst.
- **Scenario-dependent module comparison:** Rider.

This is not a roster ruling and does not remove any candidate. It supplies hypotheses for comparing
the atlas mechanics in actual text play. Adept does not pass merely because its sequence state is
formally distinct, but neither Adept nor Catalyst fails merely because the audit predicts rotation
or Cue-tracking burden.

Of the three frozen economies, the audit predicts that Commitment has the lowest interaction burden,
Slots and rests multiplies counters and recovery negotiations, and Cadence risks an
availability-icon and cooldown interface. These are comparative playtest risks. None is approved,
and none is rejected by this document.

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

The audit's hypothesis is that burden earns its place when it creates a decision the player
understands and might reasonably answer differently. Spell choice, transformation, and a sworn
target appear likelier to do that than “advance to the only sensible next step”; paired playtests
must establish whether that prediction is true.

### 1.3 Playtest hypotheses, not an admission gate

The following describe the lower-burden outcome to look for. A paper violation triggers a focused
comparison; it does not reject a candidate or decide its tier:

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

| Candidate | What the current card makes the player do | Interaction failure if ignored or automated | Paper risk hypothesis | Focused playtest comparison |
|---|---|---|---|---|
| **Armsmaster** | Choose or keep a Form every turn, execute its rider, and arm its Counter. | Defaulting to one Form makes the class repetitive; automatically selecting the best Form removes the class's decision. | High-frequency choice with extra state. | Compare full Forms with immediate authored maneuvers that resolve their rider and prepared reaction in one exchange. |
| **Berserker** | Raise and monitor an ordered Exposure track to unlock stronger techniques while defenses or harm consequences worsen. | Ignoring Exposure leaves a generic tough attacker; automatic escalation makes a risk decision on the player's behalf. | Meter maintenance; meaningful risk may be buried under repeated tracking. | Compare ordered Exposure with one explicit persistent power-for-danger commitment. |
| **Adept** | Follow opening → flow → finisher, inspect the legal techniques at the current stage, and restart after interruption. | The UI may produce “next, next, next, finish”; automation may reduce the class to an invisible rotation. | Highest predicted recurring burden and agency risk. | Compare the full sequence with an immediate-ability or simplified Armsmaster expression of the same character. Do not fold it on paper. |
| **Opportunist** | Create one Opening on a target, consume it for a payoff, then repeat the setup/payoff cycle. | If Openings are inferred from prose, mechanics become model-selected; if the UI directs setup then exploit, it may become a two-button combo. | High unchanged; a simpler version may retain the concept. | Compare personal two-step Openings with immediate authored exploits using exact visible scene prerequisites; every setup action must also matter now. |
| **Arcanist** | Choose a small prepared loadout outside danger, then explicitly select a ranked spell or ritual when wanted. | A very large catalog or frequent re-preparation becomes administration, but automation is not needed during ordinary turns. | Moderate, mostly between scenes; burden may buy real breadth decisions. | Test a small default loadout with optional re-preparation against a fixed immediate spell list. Exact casting economy remains open. |
| **Channeler** | Select one effect from a narrow known repertoire and sometimes choose its printed overreach consequence. | Asking “overreach?” after every cast adds a prompt; choosing it automatically steals a meaningful risk choice. | Moderate and potentially justified. | Compare explicit base/overreached choices selected up front with a base-only version; never add a post-action prompt. |
| **Oathbound** | Bind one authored declaration to an ally, place, objective, or foe; use only the effects legal through that binding; optionally rebind with an action. | Frequent target changes or reaction questions create maintenance; automatic rebinding changes the character's sworn intent. | Low-to-moderate if the binding persists; high if managed every turn. | Test one visible infrequently changed binding with already-declared reactions against immediate unbound abilities. |
| **Shifter** | Explicitly switch one complete profile, then use the actions and permissions of that profile until switching again. | Automatic “best form” selection removes identity; too many profiles create a second character sheet. | Moderate; one persistent state with a clear fictional meaning. | Compare a few whole, infrequently switched profiles with immediate transformation abilities; never auto-select the best form. |
| **Maker** | Prepare device cards, deploy or trigger them, track active installations, retire one at the cap, and reconfigure later. | Ignoring the loadout leaves ordinary Craft; automatic replacement chooses inventory strategy for the player. | High between-scene load plus occasional cap prompts. | Compare configurable loadouts and installations with a small fixed/default kit; ask about replacement only after deliberate over-cap deployment. |
| **Bonded** | Control two bodies with separate positions and conditions, choose which takes the shared Main, and satisfy coordinated-position requirements. | Ignoring one body turns the companion into flavor; automation takes control of a player-owned character. | Very high current-state footprint, though the fantasy is not replaceable by a job or skill. | Compare full separate-body control with a following companion that acts through selected companion abilities and separates only on deliberate command. |
| **Catalyst** | Spend an action establishing a Cue, wait for another actor to meet its trigger, then consume or expire it. | It needs cross-actor tracking and trigger handling; automation may make it a passive buff, while explicit handling may become setup → trigger button play. | Highest predicted coordination, delay, and dependency burden. | Compare the full Cue chassis with immediate support abilities and a Leadership-trained build of the same character. Do not fold it on paper. |
| **Rider** | Manage rider/vehicle shared actions, hull, occupants, vehicle-scale position, maneuvers, and damage control. | Hiding the layer makes Pilot plus asset sufficient; exposing it adds a second tactical rules surface. | High and strongly scenario-dependent. | Compare the full layer with Pilot plus asset in a recurring vehicle scenario; separately test that campaign configuration does not burden personal-scale campaigns. |

### 2.1 Resulting count

| Paper-risk group | Count | Candidates |
|---|---:|---|
| Lower-risk starting hypothesis | 4 | Arcanist, Channeler, Oathbound, Shifter |
| Focused unchanged-versus-simplified comparison | 5 | Armsmaster, Berserker, Opportunist, Maker, Bonded |
| Highest-risk full-versus-folded comparison | 2 | Adept, Catalyst |
| Scenario-dependent module comparison | 1 | Rider |

These counts organize tests; they neither approve a roster nor remove a candidate. A full mechanic
may prove worthwhile, a simplified comparison may lose the class's identity, or both may expose a
missing design. The ability catalog, numerical balance, resource economy, and genre mappings also
remain unapproved.

## 3. Shared and scenario mechanics

### 3.1 Protected-system intrusion

The owner decision already removes Intruder as a class, but the current shared prototype still
requires Probe → Breach → accumulate Access → Operate across several nodes while Alert rises. Its
cyberpunk example takes eight Main actions on a clean route. That is a high-burden subsystem and a
likely solo minigame even though it no longer consumes a class seat.

Keep the settled boundary—intrusion is skills/training over authored security—but do not treat the
current node procedure as approved. Compare it with a version that presents only a few consequential
route, risk, or permission choices to the whole party. Access or Alert may earn their state if each
changes an actual decision; the eight-step ideal route and terminal-style node UI are high-risk
playtest hypotheses rather than an automatic rejection.

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
| **Commitment** | Effort capacity plus turn/duration/scene/day return timings; maintained effects; Strain; separate Arcanist castings. | Lowest predicted burden of the three, but four return timings and the additional caster/healing tracks exceed the simplicity suggested by “one resource.” | First paired-test candidate: compare the frozen version with reduced return categories and secondary counters. |
| **Slots and rests** | Ranked slots, prepared/known lists, class-specific use counters, Recoveries, Short Rests, Long Rests, and party recovery negotiation. | Familiar to some tabletop players but predicts the largest routine bookkeeping surface, especially for casters. | High-risk comparison candidate, not paper-rejected; measure whether familiarity offsets prompts, forgotten state, and turn time. |
| **Cadence** | At-will/once-battle/recharge/heal-up availability, random recharge checks, Recoveries, Rally, Escalation thresholds, and Full Heal-up progress/loss. | Risks the cooldown icons, legal-option filtering, and combat rhythm the owner identified as drifting toward a conventional tactical video game. | High-risk comparison candidate, not paper-rejected; measure voluntary choice and whether UI guidance becomes rotation. |

The audit does not select, reject, or invent an economy. It identifies what a paired test must make
visible: every player-facing counter and recovery prompt, not merely the package's mathematical
balance.

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
real UI walkthrough as part of staged candidate testing; paper simplification is not a prerequisite
or a substitute for that evidence.

## 6. Consequences for the current work queue

1. Preserve the atlas candidates and frozen variants as hypotheses; do not regenerate the packages
   or infer a smaller roster from this paper audit.
2. On explicit authorization, draft a concrete short-scenario harness before changing a class or
   economy. Each comparison uses the same character and encounter with the candidate mechanic and
   a simpler version, changing only the mechanic under test.
3. Prototype ordinary text exchanges, not abstract cards. Show player input, optional explicit
   ability selection, engine state before/after, every UI prompt, the result when the special
   mechanic is not invoked, and elapsed turn time.
4. Observe whether choices differ meaningfully, UI guidance becomes a dictated rotation, state is
   remembered, the player invokes the mechanic voluntarily, and automation erases agency.
5. Use observed results to place or move mechanics among Expert, Advanced, and Base through catalog
   versions and safe campaign upgrades. No interaction gate, Adept/Catalyst disposition, tier
   membership, or replacement economy is approved on paper.

## 7. Owner-settled phased availability after this audit

The active 2026-08-02 decisions in `.agents/decisions.md` settle how candidates are exposed and how
playtest evidence changes their placement without pretending this audit has approved them:

- campaign creation selects cumulative **Base (recommended)**, **Advanced**, or **Expert (full)**
  class availability from the sets allowed by administration;
- **Expert** contains the full catalog, including unproven or deliberately demanding candidates;
- **Advanced** contains mechanics that survived focused testing but retain noticeable burden;
- **Base** contains mechanics demonstrated to be understandable and enjoyable without repeated
  prompting;
- tiers represent evidence, breadth, and interaction burden, not power or level gates;
- every option present in a set is available from level 1;
- campaigns pin set/catalog versions, and neutral configured absence replaces model-shaming
  exclusions;
- when administration permits upgrades, a host may safely version the campaign and apply authored
  class balance migrations without restarting;
- the upgrade saves player-owned pre-upgrade character versions for compatible older campaigns,
  with independent progression and no merging.

The exact tier membership awaits those paired playtests. Promotion, demotion, and balance changes
land in catalog versions and reach existing campaigns only through safe upgrades. This section is a
pointer to the settled release/version policy, not an authorization to assign candidates to tiers,
build the harness, or implement upgrade storage.
