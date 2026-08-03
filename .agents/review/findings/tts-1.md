# tts-1: Voice narration queue survives table transitions — the old table's GM keeps talking over the menu and the next campaign

**Severity**: MEDIUM — audible wrong-table bleed; on the menu the skip pill is buried under the full-screen overlay (z-index 6 vs 100), so it cannot even be dismissed.
**Status**: In progress — fix landed, pending reviewer verdict (admitted 2026-07-11 from the
skeptic-panel round; authorized by the Phase T2 approval and implementation order in `plan.md`)
**Branch**: `fix/tts-1-stop-on-transition`
**Commit**: `5713d37`

## Evidence
`narrateGmResponse` (public/app.js ~1436-1499 at `06d331d`): the queue token is invalidated only by `stopNarration`, called solely from the skip button and from a NEW `narrateGmResponse`. No transition path (menu return, campaign load, fork adoption, seat re-route) stops it; segment fetches run on 90s timeouts and each blob plays to completion.

Re-verified live at `a87a750`. `narrationQueueToken` is at `public/app.js:2046` and
`stopNarration()` at `:2049`; its only callers were the skip button (`:629`),
`playSavedTurnAudio` entry, `toggleTurnAudioPlayback`, and `narrateGmResponse`'s own fallback.
`bumpSessionEpoch` (`:21-30`) dismissed the dice theater and reset the composer but never touched
narration. The skip pill's burial was confirmed too: `.narration-skip` is `z-index: 6` inside the
game area (`public/styles.css:1404-1408`) beneath the full-screen `.screen-overlay` menu at
`z-index: 100` (`:1039-1052`).

## Predicted observable failure
Multi-segment narration in A, return to menu or load B: A's GM voice keeps narrating over the wrong screen with no reachable skip until B's next narrated turn.

## Approach
Call `stopNarration()` from `bumpSessionEpoch()`, alongside the `dismissRollTheater()` call it
already makes for dt-1 — the bump is already this codebase's aggregation point for "things the
departed table owns that must stop". `stopNarration()` also hides the skip pill (`:2060`), so the
buried-pill half of the finding closes without any CSS change, keeping the slice clear of the
repo's mandatory theme-harness gate.

**A second edit proved necessary.** `narrateGmResponse` prefers the saved-audio path; if that
attempt fails with a non-404 *after* a transition has already run `stopNarration()`, the
live-synthesis fallback mints a **fresh** token and begins narrating the departed table's lines
over the new screen. The bump hook alone cannot close this, because the fallback runs later and
re-arms the very token the transition cleared. So `narrateGmResponse` now captures the epoch and
returns before the fallback when the table has moved on.

What `stopNarration()` does and does not cancel, verified rather than assumed:
- currently playing blob — **yes** (pauses `currentNarrationAudio`, invokes `currentNarrationFinish`);
- queued segments and blobs — **yes** (the saved-audio loop re-checks the token before every
  segment fetch and every play; `runVoiceNarration` in `public/voice-narration.js:117-161` checks
  `isCancelled()` at `:133` and `:137`);
- in-flight HTTP requests — **no**. `fetchWithTimeout` carries only its own timeout
  `AbortController`, so a manifest, segment, or synthesis fetch already in flight runs to
  completion and its result is then discarded by the token checks above. Nothing audible leaks;
  the cost is wasted network. Wiring an external abort is deliberately out of scope.

## Files changed
- `public/app.js:21-30` — `bumpSessionEpoch` calls `stopNarration()`.
- `public/app.js:2222-2242` — `narrateGmResponse` captures the epoch and returns before the
  live-synthesis fallback if the table changed.
- `test-browser.mjs` — new `runNarrationTransitionGuard(browser, origin)`; invoked from `main()`.

## Guard proof
`test-browser.mjs::runNarrationTransitionGuard`, two scenarios, one per edit.

Scenario A holds the saved-audio manifest response open, returns to the menu, then asserts
immediately that the skip pill's computed `display` is `none`, releases the manifest with a 200,
waits a fixed 250 ms and asserts no segment was ever fetched. Scenario B re-enters, submits
again, returns to the menu, releases that manifest with a **500**, and asserts no live-synthesis
POST and no capabilities probe occurred and the pill stayed hidden.

Every assertion is an instantaneous read — computed style or a JS request counter — so no
Playwright pointer auto-wait can carry either direction to a pass. No audio ever plays in the
passing direction, so headless autoplay policy cannot mask the result either.

**A genuine vacuity was found and fixed during implementation, and is worth recording.** The
first draft of the fixture pinned the audio routes to `/api/campaigns/7/audio/...`. Under the
mutation, the leaked queue actually requests `/api/campaigns/null/audio/...` — the transition
nulls `currentCampaignId` while the orphaned queue keeps running — so the leaked request missed
the route, the counter stayed at 0, and that assertion would have **passed in the broken
direction**. It surfaced only because the neighbouring `unknownApiRequests` assertion caught the
stray call. Both audio routes now match any campaign segment, which is also the more faithful
fixture. This is the same class of mistake as dt-1's original vacuous guard.

**Two-direction proof, each edit separately** (scenario A aborts the run before B executes, so
edit 2 was reverted with edit 1 kept):

| Mutation | Observed failure |
|---|---|
| delete `stopNarration();` from `bumpSessionEpoch` | `a table transition silences the departed GM and retires its skip pill` |
| delete `if (epoch !== sessionEpoch) return;` from `narrateGmResponse` | `a failed saved-narration attempt does not fall back to live synthesis for a table the user left` |
| mutation 1, with step 4's pill assert neutralized | `no segment of a departed table narration is fetched after the transition` |

The third row establishes that scenario A's two assertions are each independently load-bearing.
The orchestrator independently re-ran mutation 1 and observed the same first failure, then
restored and returned the suite to green with `Narration transition browser guard passed.`

`node test.js`, `node --check public/app.js`, `node --check test-browser.mjs` and
`git diff --check` are clean.

## Known gaps
- In-flight audio requests are abandoned, not aborted; a synthesis already dispatched may
  complete server-side and fill `voiceSynthesisCache` unused. Harmless, out of scope.
- `stopNarration()` now also fires on `loadCampaign` entry, so re-entering the same campaign
  would stop a replay started from the menu. Not reachable today — per-message playback exists
  only inside a table — but recorded.
- A stale voice *error* toast from `toggleTurnAudioPlayback`'s catch can still surface over a new
  table. User-initiated path, minor, out of scope.

## Reviewer comments
(pending)
