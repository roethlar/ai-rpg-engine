# dr-1: Campaign delete/release settle callbacks wipe state and theme over whichever table the user has since entered

**Severity**: MEDIUM — a slow DELETE settling after the user loads campaign Y snaps Y's theme to holodeck idle, nulls the campaign (Send silently no-ops, poll stops), and toasts "Campaign deleted." over the broken table.
**Status**: Open (admitted 2026-07-11 from the skeptic-panel round; fix awaits an owner go). The worst sub-case — the blank screen when the settle races an in-flight load — was a poll-1 regression and is already fixed on that branch (`1409b58`); this finding covers the remaining wrong-table wipe.
**Branch**: (cut on fix start: `fix/dr-1-settle-epoch`)
**Commit**:

## Evidence
`window.deleteCampaign` (public/app.js:951-964) and `window.releaseCampaignCharacter` (966-980): no epoch captured; on success both unconditionally call `loadCampaignsMenu()`, which bumps the epoch, nulls per-campaign state, and strips the theme — regardless of what the user is doing by then. Cards stay clickable while the request is in flight.

## Predicted observable failure
Delete X on the menu, click Y immediately: when the DELETE settles after Y renders, Y's table visibly breaks (idle theme, dead Send, stopped poll) until the user re-navigates.

## Approach
(proposed) Capture the epoch before the fetch; on settle, run `loadCampaignsMenu()` only if the epoch is unchanged (user still on the menu); otherwise just refresh nothing and toast.

## Reviewer comments
(none yet)
