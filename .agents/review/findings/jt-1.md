# jt-1: Journal timeline renders stale cross-campaign responses; Fork buttons then fork the wrong campaign

**Severity**: HIGH — campaign B's Journal tab shows campaign A's turns/memories; a Fork click on a stale card POSTs `/api/campaigns/B/fork` with A's turn number.
**Status**: Open (admitted 2026-07-11 from the skeptic-panel round; fix awaits an owner go)
**Branch**: (cut on fix start: `fix/jt-1-journal-epoch`)
**Commit**:

## Evidence
`loadJournalTimeline` (public/app.js, ~2044-2084 at `06d331d`): only a pre-await `if (!currentCampaignId) return;`; no epoch capture/check after the await; unconditionally overwrites `journalTimelineContainer` and `activeTimelineData`. Dispatched from `setActiveTab('journal')` and from `renderGame` whenever the Journal tab is active; the active tab survives table transitions (only fork resets it). **Empirically confirmed** by the panel's rig (`rig-journal-stale.mjs`): hold Alpha's journal fetch, switch to Beta, release → `{staleAlphaShown:true, betaStillShown:false}`.

## Predicted observable failure
Journal tab open on A (slow query), switch to B: B's Journal tab fills with A's history; search filters A's cached data; "Fork Timeline" on a stale card forks B at a turn number taken from A.

## What
Pre-existing; same class as poll-1 on a surface the poll-1 fix never touched.

## Approach
(proposed) Same epoch pattern: capture at dispatch, discard after the await; rig already exists as the guard skeleton.

## Reviewer comments
(none yet)
