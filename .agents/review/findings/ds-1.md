# ds-1: Suggested-choice buttons allow overlapping submits, corrupting turnSubmitInFlight and duplicating renders

**Severity**: MEDIUM — a second submit dispatched mid-flight re-enables the controls when the FIRST settles (UI lies while the Council still resolves turn two); a poll landing in the window renders the second turn, then the submit renders it again — action, narrative, and dice duplicated in the log.
**Status**: Open (admitted 2026-07-11 from the skeptic-panel round; fix awaits an owner go)
**Branch**: (cut on fix start: `fix/ds-1-submit-reentrancy`)
**Commit**:

## Evidence
Submit handler (public/app.js ~447-457 at `06d331d`) has no `turnSubmitInFlight` guard; `renderChoices` (~1784-1800) leaves choice buttons clickable during a submit and calls `actionForm.requestSubmit()`; `setActionInputState(false)` disables only the input and Send. The boolean flag is cleared by the first settle's `finally` while the second request is still in flight, reopening every poll gate that relies on it. The submit's own render also lacks the poll's monotonicity guard.

## Predicted observable failure
Click a choice button while the Send spinner is up: doubled transcript entries and replayed narration/dice when the poll interleaves; a third action becomes submittable mid-turn.

## Approach
(proposed) Reentrancy guard in the submit handler (`if (turnSubmitInFlight) return;`), disable choice buttons with the rest of the controls, and give the submit render the same `<=` monotonicity guard the poll has.

## Reviewer comments
(none yet)
