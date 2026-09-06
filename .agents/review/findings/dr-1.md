# dr-1: Campaign delete/release settle callbacks wipe state and theme over whichever table the user has since entered

**Severity**: MEDIUM — a slow DELETE settling after the user loads campaign Y snaps Y's theme to holodeck idle, nulls the campaign (Send silently no-ops, poll stops), and toasts "Campaign deleted." over the broken table.
**Status**: Verified — accepted by review, merged to master (admitted 2026-07-11 from
the skeptic-panel round; authorized by the Phase T2 approval and implementation order in
`plan.md`).
The worst sub-case — the blank screen when the settle races an in-flight load — was a poll-1
regression and is already fixed on that branch (`1409b58`); this finding covers the remaining
wrong-table wipe.
**Branch**: `fix/dr-1-settle-epoch`
**Commit**: `92c19eb`

## Evidence
`window.deleteCampaign` (public/app.js:951-964) and `window.releaseCampaignCharacter` (966-980): no epoch captured; on success both unconditionally call `loadCampaignsMenu()`, which bumps the epoch, nulls per-campaign state, and strips the theme — regardless of what the user is doing by then. Cards stay clickable while the request is in flight.

Re-verified live at `95b759a` before the fix. The two functions had moved to
`public/app.js:1516-1530` and `:1532-1549`; the defect was unchanged, with the unconditional
`loadCampaignsMenu()` calls at `:1525` and `:1544`. `loadCampaignsMenu` (`:1392-1490`) bumps the
epoch at `:1398`, nulls `currentCampaignId` / `lastGameState` / `lastRenderedTurnNumber` /
`myCharacterId` / `pendingGaps` at `:1399-1403`, strips the theme via `enterHolodeckIdle()` at
`:1404` (`:1329-1338`), and forces `campaignMenuScreen.style.display = 'flex'` at `:1409`.

## Predicted observable failure
Delete X on the menu, click Y immediately: when the DELETE settles after Y renders, Y's table visibly breaks (idle theme, dead Send, stopped poll) until the user re-navigates.

## Approach
Capture `sessionEpoch` at **function entry** — before `uiConfirm`, not merely before the fetch —
and gate only the success-path `loadCampaignsMenu()` behind `epoch === sessionEpoch`. Entry
capture is deliberate: the confirm dialog (`uiDialogShell`, `public/app.js:1000-1081`) blocks
pointers with a full-screen overlay but is **not** a focus trap, so a keyboard-driven table
transition taken while the dialog is up is the same defect, and entry capture closes it for free.

Both toasts stay unconditional. That is the recorded approach ("otherwise just refresh nothing
and toast"): the user asked for the delete or release, it succeeded, and telling them so is
correct wherever they now are. The error-path toasts are likewise untouched.

## Files changed
- `public/app.js:1516-1533` — `window.deleteCampaign`: epoch captured at entry; menu reload gated.
- `public/app.js:1538-1553` — `window.releaseCampaignCharacter`: same.
- `test-browser.mjs` — new `runMenuSettleGuard(browser, origin)`; invoked from `main()`.

## Guard proof
`test-browser.mjs::runMenuSettleGuard` — campaign 7 "Departed Hold" (the one deleted/released)
and campaign 8, whose fixture state carries real `themeColors` so that entering it genuinely
clears `holodeck-idle` from `document.body`. Without that the theme assertion would pass in both
directions; the fixture was built specifically so it does not.

Scenario A holds the `DELETE /api/campaigns/7` response open, enters campaign 8, releases, and
asserts: `#campaign-menu-screen` computed `display` is `none`; the campaign-list GET counter is
unchanged; `document.body.className` still lacks `holodeck-idle`. Scenario B repeats the whole
shape against `POST /api/campaigns/7/release-character`.

Every assertion is an instantaneous read — computed style, a JS counter, a class string — so no
Playwright pointer auto-wait can carry either direction to a pass. The settle signal is the
toast, which fires in **both** directions and is therefore never itself an assertion.

**Two-direction proof.** The implementing agent proved all six assertion/direction combinations
by reverting the two call sites separately and temporarily reordering assertions so each could
fire first (scenario A otherwise aborts the run before B executes):

| Reverted | Assertion order | Observed failure |
|---|---|---|
| both | as shipped | `a settled delete does not resurrect the menu over an entered table` |
| release only | as shipped | `a settled release does not resurrect the menu over an entered table` |
| both | counter first | `a stale delete settle does not re-fetch the campaign list` |
| release only | counter first | `a stale release settle does not re-fetch the campaign list` |
| both | theme first | `a stale delete settle does not strip the entered table theme` |
| release only | theme first | `a stale release settle does not strip the entered table theme` |

The orchestrator independently re-ran the primary direction: rewriting both
`if (epoch === sessionEpoch) loadCampaignsMenu();` back to bare `loadCampaignsMenu();` failed the
suite with

```
Browser guard failed: a settled delete does not resurrect the menu over an entered table
```

and restoring returned it to green with `Menu settle browser guard passed.`

`node test.js`, `node --check public/app.js`, `node --check test-browser.mjs` and
`git diff --check` are all clean.

## Known gaps
- **Accepted behaviour change:** if the user deletes X and then enters Y, the campaign list they
  later reopen still shows X's card until the next `loadCampaignsMenu()`. Clicking it 404s with a
  load-error toast. The recorded approach chose this over auto-refreshing a menu the user is not
  looking at.
- Campaign cards remain clickable while a delete is in flight. Disabling them is UI hardening the
  recorded approach did not order — out of scope.
- **Same class, out of scope:** the campaign-create failure path calls `loadCampaignsMenu()`
  unconditionally from its catch (`public/app.js:743`). It is mostly shielded by the wizard and
  loading overlay, but it is the same settle-callback pattern. Recorded here for a future
  finding; deliberately not folded in.

## Reviewer comments

`Reviewer: codex / gpt-5.6-sol / xhigh / frontier` — owner-named model and effort at dispatch
(`inline, session-only`; MEDIUM severity fires no mechanical escalation trigger, so the tier is
the owner's word, not a routing outcome). Harness: codex-cli 0.146.0. Reviewed SHA
`a606b72bbd3a4c7059395849e5dfe36c8e75b052`, base SHA `95b759a`. Verdict **accepted**,
`guard_confirmed: true`, `capability_ok: true`, zero comments. 2026-08-03T07:21:53Z.

Same recorded weakening as jt-1, and for the same reason: codex's macOS sandbox cannot launch
Chromium, so the reviewer audited the guard's source adversarially and judged the supplied
two-direction transcript against it, rather than re-executing the revert/restore cycle. It was
asked specifically to audit the theme assertion, which is the one most easily made vacuous here.
It ran `node test.js` itself. The executed proof rests on the implementing agent's six
assertion/direction combinations plus the orchestrator's independent re-run of the primary
direction. See `jt-1.md` for the full transport account and the open owner question.

### Second review — the codex weakening is RESOLVED (2026-08-03)

The owner named **kimi k3** as the reviewer and pinned effort **max**. Unlike codex,
`kimi-code/k3` can launch Chromium, so this finding was re-reviewed on the **full mandate**, with
the reviewer executing the guard proof itself.

`Reviewer: kimi / kimi-code/k3 / max / frontier` — owner-named model and effort. Harness: kimi
0.31.1, tools restricted by agent-file (Read/Grep/Glob/Bash/TodoList; Write, Edit, Agent and web
disallowed), working root a disposable worktree with `node_modules` linked. Reviewed SHA
`a606b72bbd3a4c7059395849e5dfe36c8e75b052`, base SHA `95b759acee9aa3e31b3107e0ddf9459236c928ad`.
Verdict **accepted**, `guard_confirmed: true`, `capability_ok: true`, zero comments. 2026-08-03T17:30:52Z.

**Executed, not supplied.** Verified from the reviewer's own transcript rather than from its
claim: it ran `node test.js`, ran the browser suite at head, reverted `public/app.js` to the base SHA (keeping the guard), re-ran and observed `Browser guard failed: a settled delete does not resurrect the menu over an entered table`, then restored the fix and re-ran green.

The orchestrator, not the reviewer, computed acceptance: schema match, both SHA pins exact,
`guard_confirmed` and `capability_ok` literally true. The earlier codex verdict is retained
above as history; both reviews reached the same verdict, and this is the one with executed
evidence behind it. See `jt-1.md` for the full transport account and for the shell-exit-code
caveat that applies when reading these transcripts.
