# dt-1: Stale roll theater after campaign or session changes

**Severity**: MEDIUM — wrong-context overlay intercepts pointer input over the menu/another campaign (self-clears ≤3.2s/roll, click-dismissable), and misattributes a roll to the wrong table.
**Status**: Open
**Branch**: (cut on fix start: `fix/dt-1-theater-epoch`)
**Commit**:

## Evidence
`public/app.js:1223-1232` — the poll awaits fetch with the then-current campaign id and never re-checks it after the await; `public/app.js:783-793` (menu return) clears the campaign meanwhile; `public/app.js:1251` then renders the stale response with `rollTheater: true`. The submit path renders unconditionally (`public/app.js:451-475`). The theater queue (`public/app.js:1827-1836`) carries no campaign/session identity and no cancellation hook.

## Predicted observable failure
Campaign A's poll or turn resolves after the user opens the menu or loads campaign B: A's die + check reason animate over the new screen and block clicks until skipped/timed out; queued multiples prolong it.

## What
The theater has no notion of "still the same table": nothing invalidates queued/active overlay work on campaign load, menu return, or seat-session change.

## Approach
(proposed) Session epoch counter: bump on campaign load/menu/session transitions; each queued roll captures the epoch at enqueue and is dropped at play time on mismatch; an active overlay is dismissed synchronously on transition. This is the theater-scoped half of the mechanism `poll-1` needs — implement against the same epoch.

## Files changed
- (pending)

## Guard proof
Frontend path not covered by `node test.js`; guard = scripted headless-browser check (queue a roll, switch campaign, assert overlay hidden and queue drained) — same harness as the landing smoke. State this in the verdict record.

## Coder dispute (if any)
None — confirmed against code.

## Known gaps
Overlaps poll-1 (root: unguarded post-await renders). dt-1 scopes the theater surface only; poll-1 owns the full stale-render fix.

## Reviewer comments
(intake verdict only; fix not yet dispatched)
