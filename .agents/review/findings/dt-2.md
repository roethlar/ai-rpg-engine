# dt-2: Click-to-skip suppresses a later turn's queued theater

**Severity**: LOW — a valid fresh turn's animation is silently skipped; the log card still records the roll, so information loss is cosmetic.
**Status**: Open
**Branch**: (cut on fix start: `fix/dt-2-skip-per-batch`)
**Commit**:

## Evidence
`public/app.js:1827-1836` — one global promise chain and one global `skipDiceTheater` flag govern all turns; the click handler (`public/app.js:1885-1886`) sets the global flag; `public/app.js:1841-1842` then drops every queued item regardless of which turn enqueued it.

## Predicted observable failure
Turn B's rolls are enqueued (resetting nothing mid-chain) while turn A still animates; the user clicks to skip A; B's theater — from a valid submit or multiplayer poll — never plays.

## What
Skip state is global when it should be scoped to one turn's batch.

## Approach
(proposed) Queue per-turn batches; the skip flag lives on the batch object. A click drains the active batch only; later batches keep independent state.

## Files changed
- (pending)

## Guard proof
Headless-browser check: enqueue batch A (2 rolls) then batch B, click during A's first roll, assert B still plays. Suite does not cover frontend; state this in the verdict record.

## Coder dispute (if any)
None — confirmed; window is narrow (needs B queued behind a still-playing A) which supports LOW, not a decline.

## Known gaps
None.

## Reviewer comments
(intake verdict only; fix not yet dispatched)
