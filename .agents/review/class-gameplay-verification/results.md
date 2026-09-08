# Local Gameplay Pilot Results

## Verdict

The 2026-09-08 pilot did not complete a gameplay exchange. It is failed/incomplete
evidence, not a fun verdict or all-class playtest. It exposed local response
format failures, a contradictory ritual-resolution contract and diagnostic
runner defects. Neither submitted action changed the world or spent resources.

The owner-selected configuration was used without cloud fallback, downloads or
production changes. Eight generation requests reached `qwen3.8:27b-mlx`.
`muse-glimmer:30b-mlx` was configured and locally verified but received **zero**
requests: the setup input failed validation and neither turn reached narration.
Do not describe this as a completed two-model comparison or Muse evaluation.

Authority and limits: [pilot plan](../class-gameplay-verification-plan.md).
Offline evidence: [all-24-package matrix](coverage.md). Those passing fixture
checks are separate from this unsuccessful live experience.

## Execution And Usage

- Executed runner revision: `d119cdb`; `cb885ea` added only coverage/state records
  during execution. No model prompts or production code changed during the run.
- Artifact directory: system temporary directory
  `aetheria-gameplay-pilot-6rMxOt`, containing `report.json`, the closed `pilot.db`,
  Catalyst export, and desktop/mobile Catalyst and Ritual-opening screenshots.
- Start: 2026-09-08 18:13:25.419 UTC. Finalization: 18:27:48.659 UTC.
- Two of eight permitted player submissions; eight of 60 permitted generation
  dispatches; no extra player retries, scenarios or restarted allowance.
- All eight dispatches returned HTTP 200 from local `/api/chat`; transport
  success did not imply usable Council output. Production `format: "json"`,
  non-streaming mode and provider-default generation settings were preserved.
- Local reported usage: 21,823 prompt tokens and 9,822 generated tokens. The
  latter includes model reasoning as reported by the endpoint, not just visible
  game prose. These are usage counters, not dollars or a fun score.
- Qwen artifact digest:
  `5642e97495e1a088883805981563dcdc4a040c2f53388b7a41d1f24d3622cf7e`.
  Muse artifact digest:
  `015fa21845bead56096c2f8773aff7a2047063507fe82897e662ad544c5b2fa6`.
  Both had local safetensors metadata, positive weight sizes and no remote model
  declaration; identity was checked before each generation dispatch.

The command-output connection timed out after 300 seconds even though the PTK
worker continued. The command was not rerun. Its original immutable output was
recovered after finalization. The disposable Chromium was explicitly closed
after all eight model calls had finished, releasing a stuck runner response
wait. Its Node/browser processes exited and the PTK worker became idle. The
user's model server, other processes and configured database were not changed.

## Episodes

### Direct Magic: Incomplete, Runner Error

The diagnostic concept string was 81 characters; the production creation route
allows 80. The browser accepted the draft, but submission returned HTTP 400:
`characterConcept must be 80 characters or fewer.` No campaign, Setup call,
scene question, Magic Missile or Fireball resulted. No regeneration was bought.

This is not evidence that either spell is unusable. The runner should have
validated its input before spending the live-run window. Separately, the actual
concept input has no matching `maxlength`; the run observed server rejection,
not an explanatory local input constraint.

### Catalyst: Failed Before Payoff

Submitted once: `I give Nessa Advance Cue toward the Courtyard.`

The visible scene offered the nearby Raider versus the Courtyard sentry/dispatch
objective. Nessa was a genuine independent allied NPC, with an established
willing destination. An ordinary weapon attack on the nearby threat remained
the alternative; the special choice would grant the authored movement
opportunity after Nessa's qualifying action, not dictate another attack.

The composer recognized Advance Cue. Both Qwen responses understood a committed
ability use, but their returned content began with `inputKind{` and `input{`
instead of a JSON object. The ordinary format-repair attempt did not fix this.
After 40.05 seconds, the host UI showed `The interaction response was not JSON.`
and retained the original prose for retry. The episode stopped without buying
another input attempt or an ordinary-action follow-up.

Exact before/after world snapshots matched. There were zero operations, zero
checks and only the opening transcript turn. Thus no cue or NPC trigger occurred;
ally agency and the cue's actual payoff were not observed live. The evidence is
waiting and retry burden imposed on valid player prose, not an ability-strength
or cue-value comparison.

### Recall: Failed Resolution; Browser Outcome Capture Incomplete

Submitted once: `I begin Recall the Departed for Tarin, using my Return catalyst.`

The authored high-level fixture used actual earned advancement and profile copy.
The visible scene established the intact recently fallen ally, his explicit wish
to return, an owned unused catalyst, a focus and no immediate threat. Ordinary
care could not perform this resurrection; that distinct permission remained
the intended payoff. The player did not omit a prerequisite or owe another
preliminary keyword/combo.

Interaction recognized the action; Continuity approved the actual prerequisites.
Four Referee responses then failed before independent pre-roll review:

1. The first proposed a check for the initial working. Council options advertised
   `contextual_check`, but the actual action requires preliminary workings to be
   deterministic. The engine correctly refused an invented check.
2. The next removed the check but returned non-JSON leading text.
3. Its format repair parsed, but the no-check explanation was 547 characters,
   exceeding the 500-character bound not stated in the Referee instruction.
4. After the generic bound rejection, the final response reintroduced the
   forbidden preliminary check. Server output records `CLASS_COUNCIL_REJECTED`.

These six ritual requests consumed about 457.3 seconds. The actual browser turn
timeout is 420 seconds (`public/app.js`, `TURN_TIMEOUT_MS`). The source-implied
explanation for the missing response is that the browser timed out before the
server finished. The diagnostic runner only watched for HTTP responses, not
request failure, and remained in that response wait after the server had rejected
the action. It did not capture a request-failure event to independently establish
the browser's abort time. The browser was closed to finalize the stuck wait; its resulting
closed-page error is a runner termination symptom, not the underlying rule error.
No post-timeout browser screenshot or HTTP response was captured. Do not claim
the exact timeout UI was visually verified in this pilot.

After process exit, a separate **read-only** SQLite connection to this pilot's
explicit temporary path verified the final stored state: identical to the
pre-submission world, zero operations/checks, opening turn only, no active
ritual, Tarin still dead at zero health. No catalyst/use was consumed. Neither
plain continuation was submitted. The two-workings/final-revival experience
remains untested with these models.

## Visual And Evidence Limits

Catalyst desktop/mobile screenshots were inspected. The input retained its
recognized ability and text; the desktop error was visible. At the mobile
viewport the earlier narrative occupied the scrollable log and the error was
below its visible portion. No captured horizontal overflow was reported.
These same-transcript viewport checks are not separate mobile play sessions.
Ritual has opening screenshots only; direct magic has no created-game view.

No action resolved, so there is no valid judgment of spell distinction, cue
activation, ritual pacing after progress, hit/miss narration or next-turn
decision quality. The mechanical guard behavior and concrete interface failures
are useful adverse evidence. Human enjoyment, balance, all-package gameplay and
Base/Advanced promotion remain unverified.

## Recommended Next Scope, Not Authorized Implementation

1. Make declared ritual and plain-continuation Council options phase-aware using
   the authoritative current ritual and the same completion condition as
   `class-actions.js`. Advertise `no_check` for preliminary workings and preserve
   the final contextual check. Keep the engine refusal and consent/cost guards.
2. State the existing 500-character no-check explanation limit in the Referee
   contract and make its rejection identify the offending field. Do not remove
   the bound or make final rituals automatically succeed.
3. Diagnose malformed local JSON envelopes using these captured responses and
   offline tests. Do not assume model weights versus the local transport caused
   the prefixes, silently change model settings, or weaken action validation.
4. Correct the diagnostic runner's creator input and preflight validation; capture
   browser request failures, stop further dispatch, retain a post-settlement
   snapshot, and finalize without waiting for a missing HTTP response. Prove the
   timeout path with a fake/browser fixture before another live request.

Regression tests should compare the first, intermediate and completing ritual
options against actual action plans, including plain continuation with no newly
declared ability. Add an integrated uncertain-final-check fixture, preserving
no-stakes omission where actually valid. Restore the definition-only options as
a mutation and require the new preliminary-working assertion to fail.

Present this as one scoped corrective proposal, not another owner ability-by-
ability review. No production fix, changed setting, extra live probe or rerun
has been started. Any new live run needs its own explicit bounded authorization;
the unused portion of this stopped allowance is not a fresh test budget.
