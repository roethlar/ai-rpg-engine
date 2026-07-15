# tts-1: Voice narration queue survives table transitions — the old table's GM keeps talking over the menu and the next campaign

**Severity**: MEDIUM — audible wrong-table bleed; on the menu the skip pill is buried under the full-screen overlay (z-index 6 vs 100), so it cannot even be dismissed.
**Status**: Open; owner-approved, not started (admitted 2026-07-11 from the skeptic-panel round;
authorized by the Phase T2 approval and implementation order in `plan.md`)
**Branch**: (cut on fix start: `fix/tts-1-stop-on-transition`)
**Commit**:

## Evidence
`narrateGmResponse` (public/app.js ~1436-1499 at `06d331d`): the queue token is invalidated only by `stopNarration`, called solely from the skip button and from a NEW `narrateGmResponse`. No transition path (menu return, campaign load, fork adoption, seat re-route) stops it; segment fetches run on 90s timeouts and each blob plays to completion.

## Predicted observable failure
Multi-segment narration in A, return to menu or load B: A's GM voice keeps narrating over the wrong screen with no reachable skip until B's next narrated turn.

## Approach
(proposed) Call `stopNarration()` from `bumpSessionEpoch()` (same pattern as dt-1's theater dismissal).

## Reviewer comments
(none yet)
