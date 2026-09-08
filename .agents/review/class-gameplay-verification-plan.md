# Class Gameplay Verification Plan

## Authority And Status

2026-09-08: the owner authorized preparing a bounded gameplay-verification plan,
not executing it. The owner clarified that no intended Council configuration
exists. Do not wait for or invent a supposedly existing configuration. The
candidate lineup below is an explicit proposal requiring approval together with
the test scope and spending cap. The earlier latency test and its optimization
recommendation remain withdrawn; `council-latency-profile.md` is incident history,
not a baseline for this work.

Planning is complete. No live model requests, tests, production changes or
configuration writes were made in preparing this plan. Read-only inspection of
configuration and provider model metadata did not generate model responses.

## Question And Evidence

Determine whether the implemented class experience preserves meaningful player
choices and gives abilities a distinctive payoff without unnecessary selection,
typing or repeated submissions. Complexity may differ between classes. Routine
spells must not require a preparation/combo sequence; exceptional workings may
require meaningful preparation. Timing is contextual evidence, not the objective
or a surrogate fun score.

Separate three conclusions:

1. Mechanical/UI contracts work: verifiable from code, stored results and browser
   actions, including failures and retries.
2. The proposed Council produces coherent, playable episodes: assessed against
   visible choices and outcomes, with reasons and counterexamples.
3. Players enjoy the game: remains unverified without willing-player evidence.
   Agent judgment cannot promote a class to Base/Advanced or prove enjoyment.

Do not require the owner to play or judge individual abilities. Deliver one
consolidated assessment. Passing this pilot means only its stated criteria were
met, not that all 24 packages or the entire game are 100% player-validated.

## Proposed Council

All text calls use the existing Ollama provider through its approved local
endpoint. Exact proposed model identifiers:

| Role | Proposed Model |
| --- | --- |
| Setup | `kimi-k3:cloud` |
| Interaction | `deepseek-v4-flash:cloud` |
| Continuity, including grounding, table talk and independent reviews | `glm-5.3:cloud` |
| Referee, including its applicable annotation stages | `deepseek-v4-pro:0813-cloud` |
| Narration | `kimi-k3:cloud` |

This is a candidate starting configuration, not a demonstrated best assignment.
It keeps classification on Flash and proposes separate models for adjudication,
consistency and prose; that role-fit judgment is a testable hypothesis, not a
vendor benchmark result or an owner-selected production setting. Naming different
models by itself does not make the test valid: the approved questions, scenarios,
oracles and evidence limits below do that.

The identifiers were checked against available model metadata. Official model
pages: [Flash](https://ollama.com/library/deepseek-v4-flash),
[Pro](https://ollama.com/library/deepseek-v4-pro),
[Kimi](https://ollama.com/library/kimi-k3),
[GLM](https://ollama.com/library/glm-5.3). Availability is not evidence of game
quality. Recheck exact identities before execution without generating text. If
an approved identity is unavailable, stop; do not substitute another model.

No fallback model is proposed. Preserve existing production JSON mode and
provider-default generation/reasoning settings; do not silently introduce a
thinking/temperature/token-limit ablation. Pin effective role configurations in
the run manifest and abort on drift. Configuration belongs only to the disposable
run; do not save this proposal into the operator's admin settings.

## No-Provider Coverage

Before live execution, verify the existing all-branch catalog/action/progression,
Council, portability and browser checks in their disposable stores. These calls
must be provider-stubbed or network-denied. A fixture model name is not sufficient
to prevent an accidental real request. A failure stops live execution; do not
weaken a guard to proceed.

Build one coverage matrix for all 24 packages using these encounter clusters.
Both branches of each family must be named in the matrix; do not equate the
three live representatives below with complete roster playtesting.

| Cluster | Families | Required Comparison And Checks | Existing Evidence/Fixtures |
| --- | --- | --- | --- |
| Direct spell under pressure | Arcanist, Channeler | Ordinary attack versus distinctive spell permissions; precision versus area collateral; optional Strain, not mandatory setup | `test-class-turns.mjs`, `test-class-actions.mjs` |
| Hold position or pursue | Armsmaster, Berserker | Attack/reposition versus disarm, Brace or Reprisal; benefit and Main cost; no automatic protection from merely attacking a threat | `test-class-turns.mjs`, `class-catalog.js` |
| Setup meets a changed situation | Adept, Opportunist, Shifter | Immediate action versus optional sequence, target-bound Opening or profile change; legal useful action after changing targets; no dictated rotation | `test-class-actions.mjs`, `class-progression.js` |
| Ally or objective | Oathbound, Bonded, Catalyst | Ordinary aid/attack versus ward, scouting or cue; actual ally agency, target binding, consent and one shared companion Main | `test-class-catalyst-turns.mjs`, `test-class-scout-turns.mjs` |
| Move the assets | Maker, Rider | Act now versus deploy, relocate, repair or withdraw; actual installation/craft identity, passengers, hazards, loss and recovery | `test-class-maker-turns.mjs`, `test-class-rider-turns.mjs` |
| Exceptional working | Arcanist and applicable exceptional grants | Immediate action/travel versus revival/teleport; distinct prerequisites, meaningful interruption, plain continuation and one final charge | `test-class-exceptional-turns.mjs`, `test-class-journey.mjs` |

Reuse real creation, earned progression and profile-copy APIs for scenario setup.
The component action fixture injects prerequisites deliberately; it must not be
presented as a playable setup or evidence of live reachability. Label authored
scenes and provider-stubbed advancement explicitly. Do not directly patch class
state, inventory, NPC deaths or resource counters to force a favorable result.

## Live Pilot

Maximum three episodes and eight planned player submissions. Each episode has
a real campaign, single composer and actual Council/engine/store path. Use the
browser for input and visible state; do not replace its declarations with a
handmade ability-ID request. Record desktop/mobile visibility using the same
stored transcript; do not buy duplicate turns just for another viewport.

### 1. Direct Magic In An Actual Created Campaign

Create one level-one Formula Arcanist through supported production creation,
using the Setup model above. Request a fantasy combat/rescue situation through
supported genre/concept fields. All creation responses are live, not fixtures.
If creation does not produce a recorded legal encounter for the intended probes,
report that limitation and stop this episode; do not silently rewrite the scene
or keep regenerating until a preferred setup appears.

Three submissions: a scene question, direct Magic Missile at an actual opposing
target, then direct Fireball into a legal area if the evolved situation permits.
Choose the area from visible scene information and explicitly address any allied
collateral; no invented consent. Record the ordinary attack alternative without
buying another turn solely for a favorable damage comparison.

Pass conditions: the question changes no mechanical state; both spells are
usable without a prerequisite keyword/combo chain; targeting and consequences
match their distinct permissions; no omitted collateral; a miss remains a valid
outcome and is narrated consistently; the next decision remains legible. Do not
count a lack of legal follow-up targets as a successful Fireball test.

### 2. Support Without Losing Agency

Use a fresh level-one Tactics Catalyst, an allied NPC with a genuine independent
kit and two competing enemy/objective priorities. Setup is authored via the real
creation/scene-validation path, disclosed as such; turn responses are live.

Two submissions: Advance Cue with a clearly chosen willing ally and destination,
then an ordinary attack or aid selected from the changed visible situation.
Do not script an NPC action through the player request or force a cue trigger.
If the NPC waits or acts differently, evaluate that actual branch and disclose
that successful cue activation was not observed live.

Pass conditions: the cue offers its actual additional movement opportunity,
not another attack or automatic control of the ally; matching real NPC action
triggers it correctly; a wait does not; the player retains the ordinary action
alternative without compulsory extra setup or re-entering unchanged details.
Both planned submissions must either resolve or expose a clearly recorded defect;
do not substitute repeated retries to make the episode appear smooth.

### 3. Resurrection Earns Its Preparation

Use a level-ten Ritual Arcanist produced through existing fixture-driven real
progression/profile-copy APIs. Author a willing, recently fallen ally with an
intact body and an owned revival catalyst through validated setup, following
`test-class-exceptional-turns.mjs`. This is a focused high-level fixture, not a
claim that a natural campaign reached level ten. No live calls are spent leveling.

Three submissions: start Recall the Departed, then two plain continuations.
Provide actual names and visible information, never hidden engine references.
Use a scene where the recorded prerequisites and current situation permit the
working, but retain any real interruption the Council validly establishes.

Pass conditions: the player can make the initial commitment from visible
information; continuation does not require repeating target/material syntax;
progress and interruptions are visible; no premature revival; the final result,
cost and living/dead state agree. If interrupted, record the interruption and
remaining commitment rather than restarting the ritual outside the approved
eight-submission scope. The contrast with direct spells must remain explicit.

## Evaluation

For each submitted action, retain player-visible state/input/output and separate
mechanical receipts. Record the legal ordinary alternative, special capability,
decision made, change in the situation, and the next available meaningful choice.
Record card/help openings, edits, repeated information, clarification submissions,
rejections and waits. Do not infer human cognitive load from an automated agent's
click count or label elapsed seconds as a fun score.

Use the following failure criteria, not a fabricated aggregate score:

- Routine spells require undeclared preparation, an unnecessary combo or repeated
  syntax work before the intended direct cast can occur.
- A promised capability produces only an ordinary result without its documented
  added permission/effect, or its prerequisites cannot arise in actual play.
- Correctness relies on hidden facts supplied by the test driver rather than
  information available to the acting player and Council in their proper roles.
- The engine or narration erases a player/ally choice, invents consent, selects
  a best tactic, loses established state, or contradicts the recorded outcome.
- A valid submission is rejected because of a malformed Council response. Keep
  the incident and retry burden; do not fix prompts during the measured run.
- Required branch tests fail, or a retry rerolls, double-charges or changes the
  accepted input. Budget exhaustion is incomplete evidence, not a gameplay failure.

Agents may provide a reasoned assessment of whether preparation has an apparent
payoff and whether choices differ. That is an explicit design judgment, not a
human enjoyment verdict. No additional paid model judge or external reviewer is
part of this plan. Do not compare unlike random outcomes as ability strength.

## Spending And Stop Conditions

Proposed hard cap: **60 total text-provider dispatch attempts for the entire
pilot**, including live Setup, formatting repairs, semantic revisions, annotations,
transport retries and any interrupted request. No fallback, model comparison,
additional player agent API, image generation, TTS or external review calls.
Normal paths are approximately 41 calls: four live setup calls, one two-call
question and seven five-call committed actions. This is a planning allowance,
not a guarantee; actual branching can consume the remaining 19 calls.

Enforce the cap at provider dispatch and count before sending, across all roles
and scenarios. Persist the cumulative count outside the timed provider request.
A resume keeps the original count; it is not a new allowance. Disable redirects
outside approved endpoints and refuse unlisted providers/models. Fail closed if
the instrumentation cannot account for a supported dispatch path.

Sixty calls is an invocation spending limit, **not a guaranteed token or dollar
ceiling**: prompt/history/reasoning length and account billing vary. State this
distinction in the approval request. Log provider-reported input/output usage
without inventing missing values or treating subscription usage as free. No
monetary estimate or claimed token cap is approved by this draft.

Stop on a call-cap boundary, unavailable approved model, instrumentation failure,
configured-store exposure, privacy/state-integrity failure, or after two rejected
valid submissions in the same episode. Stop the whole run after 20 minutes,
using a process-level deadline with safe artifact finalization. Do not continue
automatically, add scenarios or change models/prompts to rescue the result.

## Isolation And Implementation Boundary

If execution is approved, prepare a dedicated runner and fixtures under
`.agents/review/class-gameplay-verification/`, with a denied-by-default network
boundary and explicit approved manifest. Do not repurpose the rejected latency
runner or remove its incident record. No production edits are proposed.

Use only builtin static imports until a fresh system-temporary database path is
assigned. Import application modules afterward. No copying, initializing or
migrating the configured operator database. Keep auth/provider secrets out of
tracked artifacts. A disposable local server must expose only the test store.
Prove the no-approval, wrong-path, wrong-model and exhausted-budget refusals
before any real provider dispatch. Verify that a fixture escaping its stubbed
boundary cannot make a paid request. Reuse applicable exact retry, seat isolation
and browser checks without authorizing new live scenarios.

## Deliverable And Next Gate

Planning deliverable: this plan and a current-state pointer, checked and committed.
Execution deliverable, only after approval: one consolidated report of observed
choices/payoffs, unnecessary player effort, mechanical/narrative discrepancies,
coverage gaps and exact model usage. Label each episode passed, failed or
incomplete; preserve adverse results. Do not call the entire game done.

The next owner decision is one bounded package: approve or revise the proposed
role lineup, these three episodes/eight submissions and the 60-dispatch limit.
No tests or live provider calls may start until that explicit approval. If the
owner approves, prepare the guarded runner, complete no-provider verification,
execute only this pilot and report; any production fix or larger playtest needs
its own scoped plan and approval.
