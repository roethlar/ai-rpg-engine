# Gameplay Pilot Corrections

## Authority And Scope

2026-09-08: after the failed pilot report, the agent proposed one focused correction
covering ritual instructions, malformed-response handling and runner defects,
verified offline before another live run. The owner directed continued work:
"so the work isn't done, and you are idle". Proceed with that corrective scope;
this does not restart the stopped model allowance or authorize new live calls.

The [pilot results](class-gameplay-verification/results.md) remain adverse evidence.
Do not overwrite them, claim Muse was evaluated, or promote mechanical tests into
player enjoyment. No model/provider settings, production database, paid calls,
downloads, external review, unrelated classes or new game rules are in scope.

## Implementation

1. Ritual context: `class-council-options.js`, its focused tests and exceptional
   integrated tests. Derive qualitative preliminary/completing resolution from
   the exact owned active ritual using the same condition as the action handler.
   Include it on both declared ritual abilities and plain continuation utilities.
   Preliminary workings remain deterministic; contextual final checks, consent,
   material/cadence charging and interruption remain unchanged. Never borrow
   another ritual's progress or expose new hidden numeric mechanics.
2. Response contract: state the existing no-check explanation bound in
   `class-council.js` and identify that field in rejection feedback. Keep its
   existing limit and checks. Add offline provider-boundary regression coverage
   for the captured overlong response and its legal correction.
3. Response envelopes: inspect the existing structured parsers and captured
   malformed replies. Prefer existing parsing conventions, but recover only an
   unambiguous complete JSON object without inventing values or silently choosing
   between competing objects. Keep downstream exact schema, permissions, consent,
   semantic review and no-op checks. Ambiguous/truncated/semantically invalid
   replies still fail or use the existing bounded repair path. No new dependency
   or network diagnosis is needed. Add captured-response and adversarial tests.
4. Diagnostic runner: validate the creator draft before enabling inference; use
   a supported concept length. Observe both HTTP responses and browser request
   failures. On failure stop further generation, preserve error/browser evidence,
   wait for already-started server work to settle within the original deadline,
   and capture final mechanical state before orderly shutdown. Compare rendered
   narration with the app's sanitized Markdown, not literal source text. Fix timeout and
   budget bookkeeping without silently extending limits or buying retries.

## Verification And Landing

Use the offline preload/provider stubs throughout. Select disposable database
paths before application imports. Run focused tests and prove each new regression
assertion fails with its corresponding fix removed, then restore the fix. The
runner timeout test uses a disposable HTTP/browser fixture, not a model request.
Finish with `node test.js`, `npm run test:browser`, diagnostic tests and
`git diff --check`; report checks actually run. Commit each finding separately
with its evidence and update `.agents/state.md` as it lands. No push or rewrite.

Success means the identified faults are corrected and offline regressions pass,
not that live gameplay or human fun is verified. Report concrete results to the
owner in chat. The next live gate must name the same exact local model roles,
scenario/submission scope and request/time cap; do not infer a fresh allowance
from unused requests in the stopped run.

## Status

- Ritual context: implemented and verified. Focused options cover 24 branches /
  144 active definitions; the exceptional engine/store fixture now covers ten
  workings and an actual uncertain final check with either signed outcome.
  Preliminary and completing option contracts match real action plans, including
  undeclared plain continuation. Restoring definition-only resolution failed the
  new no-check assertion; restored fix and both focused suites passed.
- `node test.js` and `npm run test:browser` passed under the offline preload after
  the ritual and response-bound changes. The browser baseline had 366 assertions,
  zero failures and zero external requests attempted; class creator, transport
  and desktop/mobile experience checks passed. No model responses were generated.
- Response bound: implemented and verified without changing its 500-character
  limit. The Referee sees the limit and a rejection identifies `noCheckReason`.
  The exact captured 547-character explanation now exercises a field-specific
  repair followed by independent pre-roll review, with no check or early revival.
  Removing either the prompt bound or field label failed the focused assertions;
  both fixes were restored green. Full offline unit/browser results above apply.
- Response envelopes: integrated in the existing Council repair loop. The two
  exact captured Interaction labels and complete JSON fences recover without
  invented content; damaged object fragments, multiple objects and unrecognized
  prose still reject. Pure coverage includes 69 rejection cases. Integrated tests
  prove one recovered Interaction call still goes through Grounding, Referee and
  pre-roll review; unexpected semantic fields still fail exact schemas. Existing
  retry bounds remain: two format attempts, within three Referee semantic attempts.
  Removing label recovery, its stage restriction or the integrated parser caused
  the respective regression assertion to fail; all were restored green.
- Full `node test.js`, `npm run test:browser` and diagnostic support/guard tests
  passed again under the offline preload after envelope integration. Same browser
  baseline and real creator/transport/experience scope as above. No live calls.
- Runner corrections: implemented and verified. The bounded creator draft is
  checked before model metadata or application imports. Request failure/page close
  ends the browser wait, cancels pending text transport and forbids follow-up
  inference. The diagnostic server tracker waits for handler completion rather
  than mistaking socket close for completion; final stored snapshots/exports are
  captured only after settlement. Stopped guards cannot enable a fresh allowance.
- The offline Chromium/HTTP diagnostic verifies HTTP success and rejection,
  actual request abort, still-running handler detection, later settlement, no
  duplicate submission, observer cleanup, page close and the original deadline.
  It also verifies sanitized Markdown equality without treating formatting as a
  narrative mismatch. Draft-bound, request-failure, cancellation-signal and raw-
  Markdown mutations each failed their regression assertions; all were restored.
  `run.mjs --prepare`, guard/support tests, syntax checks and `git diff --check`
  passed. No model call was made for any correction or regression proof.

## Approved Corrected Run

The four corrective items are complete **offline**, not proven with live models.
After the final corrective summary, the owner explicitly answered "go" to one
additional run with the selected local models and existing roles, three episodes,
at most eight inputs, 60 requests and 20 minutes, without cloud fallback.
That one corrected run is authorized on 2026-09-08; it is not an ongoing allowance.

Approved scope: the same three episodes/eight submissions in the original pilot
plan, in a fresh disposable store. `muse-glimmer:30b-mlx` handles Setup/Narration;
`qwen3.8:27b-mlx` handles Interaction/Continuity/Referee. At most 60 local generation
dispatches including repairs, and 20 minutes total live work; no cloud, fallback,
downloads, tuning, extra scenarios or automatic continuation. Recheck local
identities before generation, retain every adverse result and report actual
requests, completed actions, choices and consequences directly in chat.

Execute once and record its own results. The previous eight calls and failed
episodes remain their own immutable evidence; this new authorization does not
reclassify the stopped run or create permission for further automatic reruns.

That single corrected run has now stopped during creation. Its separate
[results](class-gameplay-verification/rerun-results.md) own the evidence:
two Muse setup dispatches, zero gameplay inputs and no Qwen calls. The browser
creation request aborted at its 300-second timeout; the corrected runner
cancelled pending transport, recorded application settlement and exited. No
live campaign was persisted. The Council/ritual corrections remain offline
verified, not live exercised. This allowance is consumed, and no further run or
diagnostic change is authorized. The result recommends separating gameplay
episodes from live creation before a newly approved bounded pilot.
