# ds-1: Suggested-choice buttons allow overlapping submits, corrupting turnSubmitInFlight and duplicating renders

**Severity**: MEDIUM — a second submit dispatched mid-flight re-enables the controls when the FIRST settles (UI lies while the Council still resolves turn two); a poll landing in the window renders the second turn, then the submit renders it again — action, narrative, and dice duplicated in the log.
**Status**: Verified — accepted by review, awaiting owner-gated merge (admitted 2026-07-11 from
the skeptic-panel round; authorized by the Phase T2 approval and implementation order in
`plan.md`)
**Branch**: `fix/ds-1-submit-reentrancy`
**Commit**: `2f893e1`

## Evidence
Submit handler (public/app.js ~447-457 at `06d331d`) has no `turnSubmitInFlight` guard; `renderChoices` (~1784-1800) leaves choice buttons clickable during a submit and calls `actionForm.requestSubmit()`; `setActionInputState(false)` disables only the input and Send. The boolean flag is cleared by the first settle's `finally` while the second request is still in flight, reopening every poll gate that relies on it. The submit's own render also lacks the poll's monotonicity guard.

## Re-verification at `6d80490` — three quarters of this finding was already closed, unguarded

This finding was recorded against `06d331d`. `public/app.js` was substantially reworked
afterwards, and commit `f042082` ("Integrate ability keyword composer") closed most of it
**incidentally, as a side effect of unrelated work, with no test**:

| Recorded claim | State at `6d80490` | Verdict |
|---|---|---|
| submit handler has no `turnSubmitInFlight` guard | `:755` — `if (composerIsComposing \|\| turnSubmitInFlight) return;`, with the flag set at `:772` and every line between them synchronous, so the window is genuinely closed | closed |
| `renderChoices` leaves choice buttons clickable | `:2625` — `btn.disabled = composerLocked;`, so a button rendered mid-submit is born disabled | closed |
| `setActionInputState(false)` disables only input and Send | `:2638-2646` — also disables `abilityCorrection`, every `charAbilities` button, and every `suggestedChoicesContainer` button | closed |
| flag cleared by the first settle while a second request is in flight | structurally unreachable once the first row holds: no second request can start | closed |
| **submit's own render lacks the poll's monotonicity guard** | **still true** | **open — this is the code change** |

That an owner-approved HIGH-traffic guard landed as an unannounced side effect, with no test, is
itself the risk this slice addresses: the guard below pins **all** of it, so a regression of the
incidental fix cannot silently reopen the finding.

## Predicted observable failure
Click a choice button while the Send spinner is up: doubled transcript entries and replayed narration/dice when the poll interleaves; a third action becomes submittable mid-turn.

## Approach
Give the submit render the poll's monotonicity rule. The poll returns when
`state.turn.number < lastRenderedTurnNumber` and again post-backfill when `<=`; the submit path
had neither, and `renderGame` appends GM dialogue unconditionally while queueing dice theater and
narration.

The action itself was accepted by the server, so on the duplicate path the composer still clears
and the optimistic bubble still settles through `settleOptimisticPlayerAction`, which removes the
optimistic node when another `.log-player[data-turn]` already carries that turn number. Only the
render is skipped.

Placement before the gap backfill is safe, verified against real code: `renderGame` sets
`lastRenderedTurnNumber` and `highestAppendedTurn` together and `appendJournalTurns` only raises
`highestAppendedTurn`, so `baseline >= lastRenderedTurnNumber` always holds; with
`number <= lastRenderedTurnNumber` the backfill's `number > baseline + 1` is unreachable.

Safety of the `<=` rule, verified server-side: `rpg-engine.js` numbers every committed turn as
last committed + 1, inserts unconditionally for all input kinds including table talk, and aborts
the transaction on a duplicate number. A legitimately new GM answer can never arrive at or below
the rendered head.

## Honest scoping — read before judging this slice's value
With the re-entrancy guard in place, **no currently known UI flow produces a stale submit
response**: polls are fully suppressed during a submit (`:1945`, `:1953`, `:1967`, `:1990`) and
table transitions are caught by the composer scope check. The `<=` rule is the second belt the
finding ordered. Its value is (a) preventing a regression of the incidental first half from
duplicating transcripts, and (b) covering a server or proxy replay. It is deliberately not sold
as closing a live reproducible defect.

## Files changed
- `public/app.js:819-832` — monotonicity guard in the submit handler's OK path.
- `test-browser.mjs` — new `runSubmitRaceGuard(browser, origin)`; invoked from `main()`.

## Guard proof
`test-browser.mjs::runSubmitRaceGuard`, single-character table, two fixture markers on the turn
POST: `HOLD` gates the response in flight (state advances only on release, so numbering follows
release order however many requests are outstanding) and `REPLAY` answers with a clone of the
current state — same turn number, same narrative — modelling a server or proxy replay.

Scenario A pins the incidentally-landed half: it holds one submit in flight and fires a
**programmatic** `document.getElementById('action-form').requestSubmit()`, then asserts no second
POST reached the server and exactly one player bubble carries the action. The programmatic vector
is deliberate — a pointer click on a disabled button is precisely the actionability auto-wait
vacuity this repo was bitten by in dt-1's first guard.

Scenario B proves the new code: it submits a `REPLAY` action and asserts exactly one GM log entry
exists for the rendered head, the composer cleared, and no player bubble carries the replayed
text.

**Two-direction proof, each half separately:**

| Mutation | Observed failure |
|---|---|
| weaken `:755` to `if (composerIsComposing) return;` (the incidental half) | `a submit dispatched while one is in flight never reaches the server` |
| delete the new `<=` block | `an OK submit response at or below the rendered head renders nothing` |

Mutation A was confirmed to move the POST count, not merely to fail: the disabled textarea is
barred from constraint validation, so `required` does not block the programmatic submit and the
request genuinely reaches the fixture. Mutation B moves the GM-entry count for the head from 1 to
2. The orchestrator independently re-ran mutation B by excising the block between its comment
markers and observed the same failure, then restored and returned the suite to green with
`Submit race browser guard passed.`

`node test.js`, `node --check public/app.js`, `node --check test-browser.mjs` and
`git diff --check` are clean.

## Known gaps
- The poll's same-turn branch adopts `lastGameState` without a monotonicity check on older
  equal-number snapshots. Benign today (it performs no render); recorded, not folded in.
- `appendGMDialogue` does not consult `appendedTurnNumbers`, which is the underlying duplication
  enabler. Unifying every render-path append through the dedupe set is a larger refactor this
  finding does not order.

## Reviewer comments

`Reviewer: codex / gpt-5.6-sol / xhigh / frontier` — owner-named model and effort at dispatch
(`inline, session-only`). Harness: codex-cli 0.146.0. Reviewed SHA
`bf501eff35962a0f25eff5f5f625fbff0d5543b2`, base SHA `6d80490`. Verdict **accepted**,
`guard_confirmed: true`, `capability_ok: true`, zero comments. 2026-08-03T08:05:05Z.

The reviewer was explicitly invited to return `invalid` — i.e. to rule that this finding should
have been closed as already-fixed rather than receiving a change — and was asked to judge whether
the scoping section above oversells or undersells the slice. It was also asked to confirm the
backfill-unreachability argument, the server-side numbering argument behind the `<=` rule, and
that Scenario A genuinely exercises code this slice did not write. It accepted with no comments.

Same recorded weakening as jt-1: codex's macOS sandbox cannot launch Chromium, so the guard was
source-audited against the supplied transcript rather than reviewer-executed; the reviewer ran
`node test.js` itself. See `jt-1.md` for the full transport account and the open owner question.
