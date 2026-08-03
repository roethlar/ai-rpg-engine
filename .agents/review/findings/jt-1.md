# jt-1: Journal timeline renders stale cross-campaign responses; Fork buttons then fork the wrong campaign

**Severity**: HIGH — campaign B's Journal tab shows campaign A's turns/memories; a Fork click on a stale card POSTs `/api/campaigns/B/fork` with A's turn number.
**Status**: In progress — fix landed, pending reviewer verdict (admitted 2026-07-11 from the
skeptic-panel round; authorized by the Phase T2 approval and implementation order in `plan.md`)
**Branch**: `fix/jt-1-journal-epoch`
**Commit**: `09768e1`

## Evidence
`loadJournalTimeline` (public/app.js, ~2044-2084 at `06d331d`): only a pre-await `if (!currentCampaignId) return;`; no epoch capture/check after the await; unconditionally overwrites `journalTimelineContainer` and `activeTimelineData`. Dispatched from `setActiveTab('journal')` and from `renderGame` whenever the Journal tab is active; the active tab survives table transitions (only fork resets it). **Empirically confirmed** by the panel's rig (`rig-journal-stale.mjs`): hold Alpha's journal fetch, switch to Beta, release → `{staleAlphaShown:true, betaStillShown:false}`.

Re-verified live at `ab5fde5` before the fix: the same function had moved to
`public/app.js:2899-2939` and still carried only the pre-await guard at `:2900`, with
unconditional writes at `:2932`, `:2934` and — a path the original record did not name —
`:2937`, where the `catch` block paints an error card over whatever table is current.

## Predicted observable failure
Journal tab open on A (slow query), switch to B: B's Journal tab fills with A's history; search filters A's cached data; "Fork Timeline" on a stale card forks B at a turn number taken from A.

## What
Pre-existing; same class as poll-1 on a surface the poll-1 fix never touched.

## Approach
The session epoch (`public/app.js:16-27`) is the repo's established mechanism for exactly this:
capture at dispatch, compare after every await, discard on mismatch. `loadJournalTimeline` now
does that rather than introducing a parallel token. Three checks were added — after the fetch
await, after the json await, and in the `catch` before the error write — because each is a
separate place a departed table's response can reach the DOM.

`activeTimelineData` is additionally cleared at dispatch. The DOM is already blanked
synchronously by the spinner write, but the cache is not, and `filterJournalTimeline`
(`public/app.js:3020-3041`) reads that cache synchronously on every keystroke. Without the
reset, a search performed between the new table's dispatch and its data landing would
resurrect the departed table's cards from memory even though nothing stale was on screen.

Discarding the stale render is also what closes the fork half: each timeline card binds
`forkCampaignTimeline(turn.turn_number)` in a click closure at render time
(`public/app.js:2993-2998`), and `forkCampaignTimeline` POSTs to
`/api/campaigns/${currentCampaignId}/fork`. No stale card rendered means no closure carrying a
foreign turn number.

## Files changed
- `public/app.js:2899-2947` — `loadJournalTimeline`: epoch capture and `activeTimelineData`
  reset at dispatch; epoch checks after the fetch await, after the json await, and in the
  `catch` before the error `innerHTML` write.
- `test-browser.mjs:1360-1547` — new `runJournalStaleGuard(browser, origin)`; invoked from
  `main()` at `:1656`.

## Guard proof
`test-browser.mjs::runJournalStaleGuard` — campaigns 21 "Alpha Hold" (turn 99, journal marked
`ALPHA-STALE`) and 22 "Beta Live" (turn 2, journal marked `BETA-LIVE`). The fixture holds
campaign 21's `/journal` response open, the guard returns to the menu and enters campaign 22,
waits until `BETA-LIVE` has painted, then releases the held response and settles 150 ms.
Assertions:

1. the container shows `BETA-LIVE` and not `ALPHA-STALE`;
2. no rendered timeline badge carries `Turn 99`;
3. filling the journal search with `ALPHA-STALE` matches zero `.timeline-node`, and clearing it
   restores `BETA-LIVE`;
4. clicking the first fork button and confirming the prompt POSTs `campaignId 22` with
   `turnNumber 2` — never the departed table's 99;
5. no page errors and no unexpected API requests.

Every assertion reads DOM text content or a recorded request, so no Playwright pointer
auto-wait can carry either direction to a pass — the vacuity mode recorded against dt-1's
first guard.

**Two-direction proof, run twice independently** (by the implementing agent and again by the
orchestrator). With the guard retained and only the `public/app.js` insertions reverted to
`HEAD`, `npm run test:browser` exits non-zero at the first assertion:

```
Browser guard failed: a departed campaign journal response cannot paint over the live table
```

Restoring the fix returns the suite to green with all five guard lines, including
`Journal stale-response browser guard passed.`

`node test.js`, `node --check public/app.js`, `node --check test-browser.mjs` and
`git diff --check` are all clean.

## Known gaps
- **Same-campaign out-of-order journal loads are not covered and are out of scope for this
  finding.** Two `loadJournalTimeline` dispatches for the *same* campaign share an epoch, so an
  older response can still win a same-table race (reachable via the turn-render dispatch at
  `public/app.js:1645` after a fast follow-up turn). Closing it needs a monotonic per-request
  token rather than the table epoch. Same bug class, different trigger; recorded here rather
  than folded in.
- The rig `rig-journal-stale.mjs` named in the original evidence does not exist anywhere in the
  repo — it was session scratch, never committed, as were `guard-dt1.mjs` and `guard-poll-1*.mjs`.
  The guard above was written fresh as a durable member of `test-browser.mjs`.

## Reviewer comments
(pending)
