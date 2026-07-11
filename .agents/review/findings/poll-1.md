# poll-1: Stale poll responses render an older campaign/scene over the current one

**Severity**: HIGH — a whole stale campaign state (narrative, theme, party, dice) can replace the currently loaded one; user actions then target a different campaign than the one displayed.
**Status**: Open
**Branch**: (cut on fix start: `fix/poll-1-response-epoch`)
**Commit**:

## Evidence
`public/app.js:1223-1259` — overlapping polls are possible; no campaign/epoch captured before the awaits; the guard is `state.turn?.number !== lastRenderedTurnNumber` which accepts *older* turn numbers too; no ownership re-check after await. Transitions that invalidate in-flight work: menu return `public/app.js:783-793`, campaign load `public/app.js:876-887`, fork switch `public/app.js:2116-2120`. `renderGame` applies the payload's theme unconditionally (`public/app.js:939-942`).

## Predicted observable failure
A poll for campaign A dispatched just before switching resolves after campaign B (or the holodeck menu) is on screen: A's narrative/theme/party render over B; with T2, the scene theme visibly reverts to the previous location's palette. Both codex passes (dice review and T2 plan review, 2026-07-11) independently derived this defect.

## What
Pre-existing (predates the dice slice): the shared-table poll loop trusts any response that arrives, with no notion of "is this still the session/campaign/turn I asked about."

## Approach
(proposed) A monotonically increasing session epoch bumped on campaign load / menu / seat-session / fork transitions; every async render path captures the epoch at dispatch and discards on mismatch after each await; reject non-monotonic turn snapshots; serialize the poll (skip if one is in flight). dt-1's theater invalidation hangs off the same epoch.

## Files changed
- (pending)

## Guard proof
Headless-browser check: stub a delayed poll response for campaign A, switch to B before it resolves, assert B's title/theme/log remain. Frontend not suite-covered; state in verdict record.

## Coder dispute (if any)
None — confirmed against code.

## Known gaps
Recorded as prerequisite for Phase T2 (finding t2-2). Fix ordering: poll-1 first or together with dt-1.

## Reviewer comments
(intake verdict only; fix not yet dispatched)
