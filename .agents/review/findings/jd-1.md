# jd-1: Clicking Join duplicates the current GM beat in the transcript

**Severity**: MEDIUM — a deliberate one-click action corrupts the shared transcript with a
repeated beat; only a full campaign reload clears it.
**Status**: Verified — accepted by review, merged to master
**Branch**: `jd-1-join-duplicate`
**Commit**: `182526b`

## Evidence
Found by a read-only bug hunt over the shipped runtime, 2026-08-03. At `ae2f2d9`:
- `public/app.js:1909` — `joinTableFlow` renders the join response with `renderGame(state, false)`.
- `renderGame` appended unconditionally, with no check that the turn was already logged:
  roll cards (`:1654`), GM dialogue (`:1658`), scene grounding (`:1665`). The log is cleared only
  under `if (resetNarrative)` at `:1648`.
- The join response is the **current head state, not a new turn**: `rpg-engine.js:3075-3077` —
  `getCampaignState(campaignId)` with `joinedCharacterId` attached.
- `appendedTurnNumbers`, the membership dedupe from the poll-1 work, was consulted only by
  `appendJournalTurns` (`public/app.js:1766`) and never by `renderGame`.

## Predicted observable failure
Press Join in the party strip (present in every non-seat session, including solo), enter a name,
confirm: the last GM narrative block appears twice in a row, with its d20 roll card(s) and
"Current Situation" block duplicated alongside, followed by the "X joins the table" notice.

## Approach
Fixed at the **render path**, not the call site — the deeper of the two candidates, chosen
deliberately:

1. The repo already treats append-once as an invariant. `appendJournalTurns` dedupes by membership
   at append time, with a recorded reason (gap recovery legitimately appends *below* a watermark).
   Gating `renderGame` on the same set applies the identical rule rather than adding a second,
   differently-shaped one.
2. The trap was already written twice. Both existing `resetNarrative = false` callers — submit and
   poll — hand-roll a `turn.number <= lastRenderedTurnNumber` check *before* calling. Join was the
   third author and simply omitted it. A call-site fix would have made three correct call sites and
   left the fourth author to remember.
3. A call-site fix would also have been functionally weaker: `renderPartyState` covers only
   identity surfaces, whereas a join must also refresh the situation panel, codex, rules and turn
   banner, and update `lastGameState` — all of which `renderGame` already does.

`alreadyInLog` is computed **before** the existing `appendedTurnNumbers.add(...)` that records the
turn as present. Panels stay outside the gate: they replace rather than append.

Safety on a hot, heavily-guarded path: `alreadyInLog` can only be true when that exact turn number
is already in the set. Submit and poll both return early when `turn.number <= lastRenderedTurnNumber`,
and every backfill range is exclusive of the head, so neither can reach `renderGame` with an
already-logged turn. All ten pre-existing browser guards pass unchanged, which is the evidence for
that claim rather than the argument alone.

## Files changed
- `public/app.js` — `alreadyInLog` in `renderGame`; the four append surfaces gated; a comment at
  the `joinTableFlow` call site recording that the join response is head state.
- `test-browser.mjs` — new `runJoinDuplicateGuard`, invoked from `main()`.

## Guard proof
`test-browser.mjs::runJoinDuplicateGuard` loads a solo campaign at head turn 3 carrying all three
appendable surfaces with unique needles (`HEAD-NARRATIVE`, `HEAD-ROLL`, `HEAD-GROUNDING`), asserts
each appears exactly once at load, then drives the **real** Join UI through both `uiPrompt`
dialogs and waits on the `.log-system` notice — which `joinTableFlow` appends immediately after
`renderGame` returns, making it a sound ordering barrier.

It asserts **both** directions, so it cannot be satisfied by simply breaking Join: the join
worked (the POST body carries the typed name and concept, the notice names the character, the
party strip gained them and kept the existing member) **and** the log did not grow (each needle
still at 1, total `.log-gm` === 1). Routes are pinned to campaign id 9, so a stray
`/api/campaigns/null/...` request would fail the guard rather than slip past — the vacuity mode
that nearly shipped in the tts-1 guard.

**Two-direction proof, run twice independently.** With `public/app.js` reverted to `ae2f2d9` and
the guard retained:

```
Browser guard failed: joining does not duplicate head GM narrative (found 2 copies)
```

**Anti-vacuity check.** Because `browserAssert` throws on the first failure, that message alone
proves only the narrative count moved. The implementing agent did one extra reverted run with a
temporary combined-count assertion, confirming all three surfaces move 1 → 2 in the broken
direction (`{"gm":2,"roll":2,"scene":2}`), then removed it; no temporary code remains. The
orchestrator independently re-ran the revert and observed the same failure, then restored and
returned the suite to green with eleven guard lines.

`node test.js`, `npm run test:browser` (11 guard lines, 0 failures), `node --check` on both files,
and `git diff --check` are clean.

## Known gaps
- `alreadyInLog` is false when `turn.number` is not numeric. The server always sends a number
  (`rpg-engine.js:2936`) and seat sessions have no Join button, so nothing reaches that branch
  today; recorded rather than defended against speculatively.

## Process note
A scratchpad filename collision during implementation caused a backup copy to silently not happen
(`cp` is aliased to `cp -i` on this machine), and the subsequent revert wiped the fix from the
working tree. The agent recognised this, used the state as its reverted direction, and re-applied
the fix by hand. Because that means the shipped code was hand-reconstructed rather than the
originally-tested bytes, the orchestrator re-verified it independently from scratch: full diff
review, both suites green, and its own revert/restore cycle. The stale scratchpad copies that
caused the collision were deleted.

## Reviewer comments

`Reviewer: kimi / kimi-code/k3 / max / frontier` — owner-named model and effort. Harness: kimi
0.31.1, tools restricted by agent-file, working root a disposable worktree. Reviewed head
`de2d17f`, base `ae2f2d9`. Verdict **accepted**, `guard_confirmed: true`, `capability_ok: true`,
zero comments.

**Executed, not supplied.** Confirmed from the reviewer's own transcript: both suites green at
head, `public/app.js` reverted to the base SHA with the guard retained, browser suite re-run and
failed, fix restored, suite green again.
