# poll-1: Stale poll responses render an older campaign/scene over the current one

**Severity**: HIGH — a whole stale campaign state (narrative, theme, party, dice) can replace the currently loaded one; user actions then target a different campaign than the one displayed.
**Status**: In progress (REOPENED by reviewer; fix-up committed, r2 verdict pending)
**Branch**: `fix/poll-1-response-epoch`
**Commit**: `6188461` → fix-up `555335a` (base `1894461`)

## Evidence
`public/app.js:1223-1259` — overlapping polls are possible; no campaign/epoch captured before the awaits; the guard is `state.turn?.number !== lastRenderedTurnNumber` which accepts *older* turn numbers too; no ownership re-check after await. Transitions that invalidate in-flight work: menu return `public/app.js:783-793`, campaign load `public/app.js:876-887`, fork switch `public/app.js:2116-2120`. `renderGame` applies the payload's theme unconditionally (`public/app.js:939-942`).

## Predicted observable failure
A poll for campaign A dispatched just before switching resolves after campaign B (or the holodeck menu) is on screen: A's narrative/theme/party render over B; with T2, the scene theme visibly reverts to the previous location's palette. Both codex passes (dice review and T2 plan review, 2026-07-11) independently derived this defect.

## What
Pre-existing (predates the dice slice): the shared-table poll loop trusts any response that arrives, with no notion of "is this still the session/campaign/turn I asked about."

## Approach
`sessionEpoch` module counter + `bumpSessionEpoch()` (public/app.js:6-13), bumped at: menu return (`loadCampaignsMenu`), campaign load entry (`loadCampaign`), fork adoption (`forkCampaignTimeline`), and the seat-token session re-route. Consumers capture the epoch at dispatch and discard after every await on mismatch: the poll loop (also serialized via `pollInFlight`, with non-monotonic turn snapshots rejected), the turn submit path, and `loadCampaign` itself. dt-1's theater invalidation hangs off the same epoch.

## Files changed
- `public/app.js` — epoch declaration + 4 bump sites + 3 guarded consumers (46 insertions, 9 deletions)

## Guard proof
The unit suite does not load browser modules, so the guard is a scripted headless-browser proof: `guard-poll-1.mjs` (session scratchpad) fabricates two campaigns via route interception, holds campaign Alpha's in-flight poll response across a switch to Beta, then releases it as a NEWER Alpha turn.
- Fix reverted (master `public/app.js`): `{"pass":false,"staleVisible":true}` — Alpha's stale narrative rendered over Beta. FAIL confirmed.
- Fix present (`6188461`): `{"pass":true,"staleVisible":false,"betaIntact":true}` — response discarded. PASS confirmed.
- `AI_RETRY_BACKOFF_MS=10 node test.js` green at `6188461`.
Process note: the first revert-proof run was done against the uncommitted fix and destroyed it (`git checkout master -- <file>` with branch == base); the fix was reapplied identically and committed before re-proving. Lesson recorded: commit before revert-proofs.

## Coder dispute (if any)
None — confirmed against code.

## Known gaps
Recorded as prerequisite for Phase T2 (finding t2-2). Fix ordering: poll-1 first or together with dt-1.

## Reviewer comments
codex-cli 0.144.1 · reviewed `6188461` vs base `1894461` · 2026-07-11 (UTC) ·
verdict **REOPENED** (2 findings; the epoch mechanism, bump ordering, cleanup
blocks, and the guard's discriminating power were accepted):
1. HIGH — journal-backfill window: the monotonic check ran before the journal
   awaits; a same-campaign submit (no epoch bump) rendering turn N+1 lets the
   released poll roll the table back to turn N.
2. MEDIUM — stale submit failures: the non-OK and catch paths appended
   notices, restored the input, and could open Settings on the replacement
   table without an epoch check.

Fix-up `555335a`: post-backfill re-check of `turnSubmitInFlight` + turn
monotonicity immediately before render; error-path UI gated on the captured
epoch; `finally` unconditional. Guard `guard-poll-1b.mjs` (both scenarios):
FAIL at `6188461` (`rolledBack:true`, `noticeLeaked:true`,
`inputHijacked:true`), PASS at `555335a`; the original stale-switch scenario
still passes; suite green. r2 verdict pending.
