# Council Latency And Rejection Profile

Status: profiling complete, 2026-09-08. The owner's "go" authorized the proposed
bounded latency/rejected-request profile, not a production optimization or a
change to the chosen Council/rules contract. No production code, configured
database, provider settings or running preview was changed.

## Current-Build Measurement

Production revision: `73a0fb8`. Diagnostic: `council-latency-probe.mjs` in this
directory. Five independent campaigns use the same retained authored gatehouse
setup through real creation and scene validation: level-one Mira/Wizard and an
opposing sword-equipped Raider in Gate, with adjacent Yard. IDs differ between
campaigns; each action starts with fresh abilities, health, history and scene
state. Four setup responses are fixtures; every Council response is from the
original `deepseek-v4-flash:cloud` provider through local Ollama. RNG, validation,
NPC actions and SQLite commits are real. This is not live campaign creation.

| Action | End-To-End Seconds | Model-Wrapper Seconds | Other Milliseconds | Calls |
| --- | ---: | ---: | ---: | ---: |
| Ask where the Raider is and what he is doing | 4.752 | 4.747 | 4.7 | 2 |
| Move into Yard | 22.910 | 22.885 | 25.6 | 5 |
| Magic Missile at the attacking Raider, first sample | 18.055 | 18.041 | 14.0 | 5 |
| Magic Missile at the attacking Raider, second sample | 16.055 | 16.038 | 16.9 | 5 |
| Fireball into Gate, explicitly accepting own exposure | 33.610 | 33.592 | 17.9 | 5 |

All five completed on their first submission. There were 22 observed fetch
invocations, all HTTP 200, matching 22 logical model calls: no JSON repair,
Referee regeneration, annotation calls or transport retry was observed. The
question was table talk; all other actions committed an operation and actual
check. Both missile rolls were clean successes; Fireball was a clean failure.
Completion establishes an accepted path, not independent semantic correctness
of every unselected outcome branch, balance or player enjoyment.

Total measured action time: 95.382 seconds. Model-call wrappers account for
95.303 seconds (99.917%); the remainder totals 79 milliseconds. Optimizing
local database/action processing cannot materially remove this observed wait.

| Stage | Calls | Summed Seconds |
| --- | ---: | ---: |
| Interaction | 5 | 9.782 |
| Grounding | 4 | 15.677 |
| Referee | 4 | 40.175 |
| Pre-roll review | 4 | 18.147 |
| Narration | 4 | 9.907 |
| Table-talk response | 1 | 1.615 |

Referee plus pre-roll review account for 61.2% of model-wrapper time. Fireball's
single Referee call took 21.319 seconds, compared with 5.504-7.195 seconds for
the other three action rulings. It returned 786 bytes of final JSON content;
the provider also returned substantially more non-visible generated content.
This identifies where the wait occurred, not why: provider queueing, cloud
load and generation policy were not experimentally separated. Similar prompt
sizes alone do not explain that outlier or prove prompt shortening will fix it.

## Measurement Boundaries

The runner sets a newly allocated system-temporary `RPG_DB_PATH` before any
application import. It never loads or copies the configured database. Its
fixture is read-only JSON from the earlier disposable spell probe; no prior
campaign DB is opened. The initial diagnostic stopped before live calls when
exact historical prompt equality detected the corrected Magic Missile wording.
The retained scene responses did not change. The final diagnostic checks setup
stage/order and lets current production scene validation check their content.

The provider wrapper measures all of `sendPrompt`, including endpoint checks,
transport/body parsing and any client retry/backoff. It is not pure inference
time. Fetch instrumentation observes the consumer's body read without awaiting
a cloned response or writing the report inside the timed action. `headersMs`
and `bodyCompleteMs` are both cumulative from fetch start; their difference is
header-to-body-read time. Neither is first-token latency. No streaming is used.
Header-to-body-read differences were at most 1.405 ms. Summed provider-reported
`total_duration` was 93.767 seconds, but that field does not isolate cloud
queueing, prompt processing and generation for this transport.

The diagnostic caps wrapped fetch invocations at 30, allows only the selected
local Ollama endpoint, rejects role/model/fallback drift, and applies a
600-second network-start/in-flight budget with a 120-second per-fetch bound.
This is not a whole-process watchdog: setup, local work, backoff and report
writes can add time. Redirect hops internal to fetch are not separately counted.
The completed run used 22 wrapped fetches. The timed interval ends at `takeTurn`
return/error; result queries and artifact writes occur afterward.
The seven-call allowance before starting another case cannot guarantee completion
through every retry/annotation branch; any budget-interrupted result is an
incomplete sample, not a model rejection. Neither repeated missile changed the
implementation, so their timing difference is run-to-run variation, not an A/B result.

Raw requests, responses, timings, worlds and check records are in the disposable
`aetheria-council-profile-9Mc3dw/profile.json` artifact under the system temp
directory. Durable results are the tables and boundaries here; the temporary
artifact is not required to interpret them. The runner can be invoked with:

```sh
node .agents/review/council-latency-probe.mjs --live --fixture <temporary-spell-session>/session.json
```

Syntax checking and explicit rejection of missing live opt-in/non-probe fixture
paths passed before application imports. The live runner completed all five
cases and checked unchanged state for uncommitted inputs. `git diff --check`
passed. The full unit/browser suites were not rerun: this slice changes only a
diagnostic and records, not production behavior. Their previous class-completion
results remain in `class-experience-implementation-plan.md`.

## Earlier Rejections

`class-runtime-experience-evidence.md` owns the earlier live spell failures and
their repairs. Read-only analysis of its retained `aetheria-class-live-spells-EL5flg`
report found the same request attempted across three different development
code/prompt revisions: 50.3 seconds rejected, 35.7 seconds rejected, then 23.3
seconds completed. The two rejected attempts consumed 86.0 seconds and ten
requests. Six rejected Referee responses took 65.8 seconds; four additional
correction calls alone took 43.0 seconds. Causes included name-based automatic-hit
assumptions, missing/wrongly typed fields and misplaced check provenance.

Those are historical rework costs, not a current-build rejection rate. The old
fetch shim awaited a cloned body and report write before returning the response,
and timings were rounded to tenths of a second. The new sample must not be used
as a before/after speedup claim against that different code/instrumentation.
Five accepted current actions also do not establish a production success rate
or latency percentile. No current-session annotation, journey, longer history,
large party or high-level-class tail latency was measured.

## Source Explanation

`class-council.js` serially performs interaction, grounding, Referee, pre-roll
review and narration for an ordinary committed action. A question uses interaction
then table talk. Critical/marginal outcomes add annotation and annotation review,
including flavor-only annotations: seven baseline calls, or nine when a reviewed
annotation is rejected once. Structural Referee rejection adds one generation;
pre-roll rejection adds both a new Referee proposal and another review. Three
invalid structural proposals reject after five calls; three rejected pre-roll
reviews reject after eight. JSON-format and transport retries are separate layers.

Each ritual working has that same five-call baseline, with extra annotation work
where applicable. New external journeys add layout, arrival narrative and scene
authoring; revisits avoid those three calls. These counts describe source paths,
not measured timings for those cases. Checkpoints are load-bearing: accepted
checks survive narration failure, and exact completed retries make no model call.

The first four action stages receive repeated world, outline, recent history,
declarations, options and journey context. The current Referee instruction alone
is 6,449 UTF-8 bytes and explains unrelated action families and utilities even
when the input is one routine spell. In this sample, Referee data adds roughly
5.6-6.7 KB per call. `class-council-options.js` already restricts active ability
options to declarations; it must not be described as sending all 144 powers.

`api-client.js` clears its ordinary fetch timeout when headers arrive, before
the later body read. This is a source-inspected stalled-body risk, not an observed
cause of the measured delays; the diagnostic's additional signal remains active.
Do not count repairing that boundary as a demonstrated normal-turn speedup.

## Recommended Next Step

Run a bounded controlled Referee-contract benchmark before changing production.
Compare the existing request with an action-specific contract that preserves
the exact allowed action selectors, check/provenance fields, NPC branches,
consent, independent pre-roll review and all engine validators. Remove unrelated
instruction material and clarify the required response shape; do not infer
undeclared spells, bypass a role or let the model resolve its own rolls.

Use matched frozen scene/input cases, alternate baseline/candidate order, measure
first-attempt acceptance and complete-turn time, and include deliberately invalid
target/consent and annotation/retry cases. A smaller prompt alone is not success;
reject a candidate that gains speed by accepting an illegal action or changing
the chosen rules. Report observed differences without claiming p95 or general
reliability from a small sample. This benchmark is proposed, not yet run or
approved as a production change. Keep the response-body timeout repair a separate
finding. No owner ability-by-ability review or playtest participation is required.
