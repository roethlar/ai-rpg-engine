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
   and capture final mechanical state before orderly shutdown. Fix timeout and
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
- Runner corrections are verified and being landed separately. No new live test
  is authorized or running.
