# fk-1: Fork adoption never checks the epoch it bumps — a fork resolving after the user left still seizes the table

**Severity**: MEDIUM — narrow reachability (the loading overlay blocks pointers but not keyboard: Tab+Enter to Campaigns during a slow fork), but the outcome is the app silently re-entering the fork underneath the menu, polling a table the user believes they left.
**Status**: Open (admitted 2026-07-11 from the skeptic-panel round; fix awaits an owner go)
**Branch**: (cut on fix start: `fix/fk-1-fork-epoch`)
**Commit**:

## Evidence
`forkCampaignTimeline` (public/app.js ~2190-2225 at `06d331d`): no epoch captured at dispatch; on response it unconditionally bumps, adopts `currentCampaignId`, and renders. The loading overlay (z-index 500) is not a focus trap, so keyboard navigation can run `loadCampaignsMenu` mid-fork. No guard exercises fork adoption or the seat-token re-route.

## Predicted observable failure
Keyboard user backs out to the menu during fork reconstruction; seconds later the fork's theme flips through the translucent menu and the poll resumes against the fork behind it.

## Approach
(proposed) Capture the epoch before the fork fetch; on resolve, adopt only if unchanged — otherwise toast "fork created" and leave it in the campaign list.

## Reviewer comments
(none yet)
