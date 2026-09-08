# Corrected Local Gameplay Pilot Results

## Verdict

The one authorized corrected run on 2026-09-08 stopped during live campaign
creation. **Zero gameplay inputs and zero completed gameplay exchanges.**
Direct magic is incomplete; Catalyst and Recall were never attempted live.
This is failed setup evidence, not a class-value, model-comparison or fun verdict.
The previous [failed pilot](results.md) remains separate adverse evidence.

The corrected runner captured the browser abort, cancelled its pending provider
transport, prohibited follow-up inference, waited for application settlement and
exited. The corrected Council response and ritual contracts were not exercised:
no Qwen call was reached. Passing offline tests does not change that limitation.

## Execution And Usage

Authority: [correction plan](../class-gameplay-correction-plan.md), Approved
Corrected Run. Executed revision: `5b294f3`. The run was not restarted and no
production code, prompt or generation setting changed during measurement.

- Start: 2026-09-08 19:40:28.419 UTC.
- Finalized: 2026-09-08 19:45:29.129 UTC, about 5 minutes after startup.
- Two of 60 allowed local generation dispatches; zero of eight allowed gameplay
  submissions. One browser creation submission is separate from gameplay inputs.
- Both dispatches used `muse-glimmer:30b-mlx` for Setup. Qwen received zero calls.
- `qwen3.8:27b-mlx` remained assigned to Interaction/Continuity/Referee; Muse to
  Setup/Narration. Both pinned local identities matched the original pilot
  manifest. No cloud, fallback, download, image, speech or reviewer call.
- Existing local `/api/chat`, non-streaming JSON mode and provider-default
  generation settings were unchanged.

| Request | Outcome | Observed duration | Reported prompt / generated tokens |
| --- | --- | --- | --- |
| Muse campaign outline | HTTP 200; parseable outline accepted with fallback title | 114.18 seconds | 778 / 2,855 |
| Muse opening scene | Pending transport cancelled after browser abort; no response captured | 185.83 seconds before cancellation | Unknown / unknown |

The first request's generated count includes reasoning as reported by the local
endpoint. **778 prompt and 2,855 generated tokens are only the known usage, not
the whole-run total.** The cancelled non-streaming request returned no usage
counters. Its elapsed duration is not a measurement of how long a complete
opening would take. Transport cancellation does not independently prove when
the model server stopped generation internally.

## What Happened

The bounded creator draft passed validation. Muse's outline contained three
acts, four locations, four NPCs and a rescue objective. It was valid JSON, but
put its title under the unexpected key `to=user<|message|>{` instead of `title`.
`validateOutlineData` used its existing `Aetheria Campaign` fallback, visible in
the next request. Do not label this a JSON parse failure or claim that title
fallback caused the subsequent timeout. The proposed rescue/codex choices are
unplayed outline content, not observed player choices or payoffs.

The second request attempted the opening scene. Before it returned, Chromium
reported the creation POST failed with `net::ERR_ABORTED`. The application has
an explicit `CAMPAIGN_CREATE_TIMEOUT_MS = 300000` in `public/app.js`; creation
passes that limit to `fetchWithTimeout`, which aborts while awaiting response
headers. The server waits for the complete sequential creation workflow before
sending its response. Layout and scene authoring had not yet been reached.
Source and the approximately 300-second request failure support the application
timeout explanation; no independent Muse failure response was received.

The runner marked `transport_stopped`, cancelled the pending local request and
recorded `serverSettled: true`. It exited with code 1. The PTK command-output
connection separately timed out at 300 seconds; the command was not rerun.
Its immutable original output was recovered after the worker became idle.
Do not attribute the browser abort to PTK or claim a precise ordering between
those independently coincident timeouts.

No scene question, Magic Missile, Fireball, Advance Cue, ordinary attack or
Recall input was submitted. The whole-run transport stop prevented the later
episodes. This diagnostic design coupled every class test to successful live
creation and therefore produced no live class coverage from this allowance.

## Stored And Visual Evidence

Artifacts: system-temporary directory `aetheria-gameplay-pilot-NPO8Uw`, containing
the final `report.json` and closed `pilot.db`. Exact prompts, the returned outline,
dispatch metadata, usage and transport failure are in the report.

There are **no screenshots**, campaign exports or live final-state snapshots:
creation never returned a campaign ID. No timeout message was visually verified.
`serverSettled` means handlers finished, including error handling, not success.

After process exit, the installed SQLite dependency was opened with explicit
`OPEN_READONLY` against this exact temporary database, without importing any
application module. It contained only the three offline-preparation campaigns:

| Campaign | Stored turns | Operations | Checks | Evidence type |
| --- | --- | --- | --- | --- |
| Catalyst scene | 1 | 0 | 0 | Unplayed fixture |
| Ritual advancement source | 10 | 9 | 0 | Offline earned progression |
| Copied Recall scene | 1 | 0 | 0 | Unplayed fixture |

There was no newly persisted live campaign. Catalyst had empty scene/recovery
use counters; Recall had no active ritual, empty use counters and Tarin still at
zero health. These confirm absence of a live result, not successful class play.
The configured operator store was not used. The diagnostic Node/browser/server
closed and the PTK worker became idle; the user's Ollama service was left alone.

## Next Scope

The immediate class-evaluation problem is that campaign generation can prevent
every gameplay observation. Recommend a gameplay-only pilot with disclosed,
validated authored starting scenes for all three episodes, and independent
bounded episode failure handling. Preserve this live-creation failure as a
separate unresolved player-experience issue rather than relabeling fixture
creation as live success. Retain real Council/engine/browser turns and actual RNG.

Before new inference, specify and prove offline how cancellation settles one
episode, captures its browser/final-state evidence and prevents stale work from
spilling into another. Any new per-episode dispatch policy must retain one
whole-run cap; never reset an exhausted or stopped guard as an implicit fresh
allowance. That change needs its own approved diagnostic plan and bounded live
authorization. No such change or additional live call was made in this run.

Do not simply increase the production creation timeout: this sample establishes
that creation exceeded its current budget, not when it would finish, whether it
would succeed, or whether that wait would be acceptable. The production
creation deadline/cancellation experience remains unresolved separately.

Human enjoyment, playable local Council exchanges, spell/cue/ritual payoff and
all-package live coverage remain unverified. The completed corrective offline
suite evidence belongs to the correction plan. This closeout changes records
only and requires `git diff --check`, not another model run or a new gameplay
success claim.
