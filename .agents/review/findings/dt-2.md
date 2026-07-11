# dt-2: Click-to-skip suppresses a later turn's queued theater

**Severity**: LOW — a valid fresh turn's animation is silently skipped; the log card still records the roll, so information loss is cosmetic.
**Status**: In progress (fix committed, reviewer verdict pending)
**Branch**: `fix/dt-2-skip-per-batch` (stacked on `fix/dt-1-theater-epoch`)
**Commit**: `c04f0cd` (base `497ffc5`)

## Evidence
`public/app.js:1827-1836` — one global promise chain and one global `skipDiceTheater` flag govern all turns; the click handler (`public/app.js:1885-1886`) sets the global flag; `public/app.js:1841-1842` then drops every queued item regardless of which turn enqueued it.

## Predicted observable failure
Turn B's rolls are enqueued (resetting nothing mid-chain) while turn A still animates; the user clicks to skip A; B's theater — from a valid submit or multiplayer poll — never plays.

## What
Skip state is global when it should be scoped to one turn's batch.

## Approach
Each `queueRollTheater` call creates a batch object `{skipped, epoch}`; the overlay click sets `skipped` on the playing batch only. The global `skipDiceTheater` flag is removed; dt-1's epoch rides the same batch object.

## Files changed
- `public/app.js` — batch object replaces the global flag (9 insertions, 9 deletions)

## Guard proof
`guard-dt2.mjs` (session scratchpad, headless browser): enqueue batch A (2 rolls) then batch B, click during A's first roll, assert B's marked roll still surfaces.
- Fix present (`c04f0cd`): `{"pass":true,"bPlayed":true}`.
- Fix reverted (`497ffc5` tree): `{"pass":false,"bPlayed":false}` — B silently swallowed.
- Suite green at the stack head (`e96a873`).

## Coder dispute (if any)
None — confirmed; window is narrow (needs B queued behind a still-playing A) which supports LOW, not a decline.

## Known gaps
None.

## Reviewer comments
(intake verdict only; fix not yet dispatched)
