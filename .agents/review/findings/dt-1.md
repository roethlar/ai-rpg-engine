# dt-1: Stale roll theater after campaign or session changes

**Severity**: MEDIUM — wrong-context overlay intercepts pointer input over the menu/another campaign (self-clears ≤3.2s/roll, click-dismissable), and misattributes a roll to the wrong table.
**Status**: In progress (fix committed, reviewer verdict pending)
**Branch**: `fix/dt-1-theater-epoch` (stacked on `fix/poll-1-response-epoch`)
**Commit**: `497ffc5` (base `6188461`)

## Evidence
`public/app.js:1223-1232` — the poll awaits fetch with the then-current campaign id and never re-checks it after the await; `public/app.js:783-793` (menu return) clears the campaign meanwhile; `public/app.js:1251` then renders the stale response with `rollTheater: true`. The submit path renders unconditionally (`public/app.js:451-475`). The theater queue (`public/app.js:1827-1836`) carries no campaign/session identity and no cancellation hook.

## Predicted observable failure
Campaign A's poll or turn resolves after the user opens the menu or loads campaign B: A's die + check reason animate over the new screen and block clicks until skipped/timed out; queued multiples prolong it.

## What
The theater has no notion of "still the same table": nothing invalidates queued/active overlay work on campaign load, menu return, or seat-session change.

## Approach
`bumpSessionEpoch` (poll-1's mechanism) now also calls `dismissRollTheater()`, which fires the active roll's finish handle synchronously; each queued roll captures `sessionEpoch` at enqueue and is dropped at play time on mismatch. Post-poll-1 the surviving real-world paths are non-pointer transitions (fork completion, token re-route) firing while the overlay is up — the overlay itself blocks pointer navigation.

## Files changed
- `public/app.js` — dismiss hook in bumpSessionEpoch; `activeTheaterFinish` handle; epoch captured per enqueue (22 insertions, 3 deletions)

## Guard proof
`guard-dt1.mjs` (session scratchpad, headless browser): queue two rolls, fire a table transition mid-tumble, assert the overlay vanishes and the queued roll never surfaces.
- **First guard version was VACUOUS and was caught by its own revert-proof passing**: a playwright pointer click on the menu button auto-waited for the overlay to clear, so both fixed and unfixed code passed. Corrected to fire the transition programmatically (modeling fork/token-re-route transitions).
- Corrected guard: fix present (`497ffc5`) → `{"pass":true}`; fix reverted (`6188461` tree) → `{"pass":false,"hiddenAfterTransition":false,"stillHidden":false}`.
- Suite green at the stack head (`e96a873`).

## Coder dispute (if any)
None — confirmed against code.

## Known gaps
Overlaps poll-1 (root: unguarded post-await renders). dt-1 scopes the theater surface only; poll-1 owns the full stale-render fix.

## Reviewer comments
(intake verdict only; fix not yet dispatched)
