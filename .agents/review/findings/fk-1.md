# fk-1: Fork adoption never checks the epoch it bumps — a fork resolving after the user left still seizes the table

**Severity**: MEDIUM — narrow reachability (the loading overlay blocks pointers but not keyboard: Tab+Enter to Campaigns during a slow fork), but the outcome is the app silently re-entering the fork underneath the menu, polling a table the user believes they left.
**Status**: In progress — fix landed, pending reviewer verdict (admitted 2026-07-11 from the
skeptic-panel round; authorized by the Phase T2 approval and implementation order in `plan.md`)
**Branch**: `fix/fk-1-fork-epoch`
**Commit**: `60df275`

## Evidence
`forkCampaignTimeline` (public/app.js ~2190-2225 at `06d331d`): no epoch captured at dispatch; on response it unconditionally bumps, adopts `currentCampaignId`, and renders. The loading overlay (z-index 500) is not a focus trap, so keyboard navigation can run `loadCampaignsMenu` mid-fork. No guard exercises fork adoption or the seat-token re-route.

Re-verified live at `fa2e63e`. `window.forkCampaignTimeline` had moved to `public/app.js:3071`
and still captured no epoch: it holds a `forkInFlight` re-entrancy latch only, and on a 200 runs
`bumpSessionEpoch(); currentCampaignId = newCampaignState.campaignId; renderGame(newCampaignState,
true); setActiveTab('inventory');` unconditionally. `.loading-overlay` is `z-index: 500`
(`public/styles.css:1260-1268`) and is not a focus trap.

## Predicted observable failure
Keyboard user backs out to the menu during fork reconstruction; seconds later the fork's theme flips through the translucent menu and the poll resumes against the fork behind it.

## Approach
Capture `sessionEpoch` at **function entry** — after the `forkInFlight` latch and before the
`uiPrompt` — and on resolve adopt only if it is unchanged. Entry capture rather than pre-fetch
capture is deliberate and covers a window the recorded approach did not name: the name prompt has
**no overlay at all**, so a transition taken while the player is typing a fork title is the same
defect as one taken during the fetch.

On a mismatch, toast that the fork was created and where to find it, then return without
adopting. The existing `finally` already clears `forkInFlight` and calls `hideLoadingOverlay()`,
so the early return cleans up correctly; the guard asserts the overlay really is hidden. The
catch-path error toast is untouched.

## Files changed
- `public/app.js:3071-3110` — `window.forkCampaignTimeline`: epoch captured at entry; adoption
  gated on the epoch, with an informational toast on the stale path.
- `test-browser.mjs` — new `runForkEpochGuard(browser, origin)`; invoked from `main()`.

## Guard proof
`test-browser.mjs::runForkEpochGuard` — starts a fork on campaign 7 by calling the
window-exposed `forkCampaignTimeline` directly (no journal UI needed), accepts the prompt's
default title, and holds the `POST /api/campaigns/7/fork` response open. It then leaves for the
menu **through** the loading overlay with a JS click — which has no Playwright actionability
auto-wait, and models exactly the keyboard reachability the finding describes — releases the
fork response, waits a fixed 300 ms, and asserts:

1. `#narrative-container` does not contain the fork's `FORKED-NARRATIVE` sentinel;
2. no toast says `Successfully branched`;
3. some toast says `find it in your campaign list`;
4. `#loading-overlay` computed display is `none`;
5. no page errors and no unexpected API requests.

Assertions 1-3 are the load-bearing ones. The fixed 300 ms settle is deliberate: the toast text
differs between the two directions, so waiting on a toast would either hang or auto-satisfy in
the reverted direction.

**Honest scoping of the weaker assertions.** `#campaign-menu-screen` staying `flex` is a
regression check, **not** a discriminating one — `renderGame` sets `#main-game-screen` to `grid`
but never hides the menu overlay, so that read holds in both directions. It is retained as a
regression tripwire and is documented here so no future reader mistakes it for proof.

The fixture serves state for **both** campaign 7 and the fork's campaign 9, because in the
reverted direction the poll re-targets the adopted fork; an unrouted 404 there would have
polluted the unknown-request assertion and masked the real signal.

**Two-direction proof, run twice.** The implementing agent deleted the epoch-mismatch block and
observed the suite fail, then confirmed the restored file was byte-identical to the pre-mutation
copy. The orchestrator independently removed the same block programmatically and observed:

```
Browser guard failed: a fork resolving after the user left does not render the fork
```

with all five pre-existing guard lines still printing before it, so only the new guard moved.
Restoring returned the suite to green with `Fork epoch browser guard passed.`

`node test.js`, `node --check public/app.js`, `node --check test-browser.mjs` and
`git diff --check` are clean.

## Known gaps
- The campaign list the user is looking at will not contain the new fork until the menu reloads,
  since it was fetched while the fork was still uncommitted. The toast wording covers this;
  auto-refreshing the menu is scope growth the recorded approach declined.
- **Pre-existing, unchanged, out of scope:** navigating away *during the name prompt* nulls
  `currentCampaignId`, so confirming afterwards dispatches `POST /api/campaigns/null/fork` and
  fails with an error toast. No seizure occurs (adoption only happens on a 200), so this is a
  cosmetic wart rather than the finding's defect.
- The loading overlay is still not a focus trap, for this flow or any other long-running one
  (campaign create included). The epoch idiom, not focus-trapping, is this repo's chosen defence;
  a global focus trap would be a separate UI finding.
- The seat-token re-route path named in the original evidence still has no guard exercising it.

## Reviewer comments
(pending)
