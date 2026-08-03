# qr-1: A quiet turn silently resets the campaign's quest to a placeholder

**Severity**: HIGH — durable, self-reinforcing state corruption from a routine model omission. The
wrong quest is persisted, displayed, AND replayed into the next turn's prompt as truth, so the
campaign's real objective disappears and the GM is then told the placeholder is the quest.
**Status**: Verified — accepted by review, merged to master
**Branch**: `qr-1-quest-fallback`
**Commit**: `b04da44`

## Evidence
Found by a read-only bug hunt over the shipped runtime, 2026-08-03. At `ae2f2d9`:
- `rpg-state.js:509-521` — the validator's fallback was a hardcoded placeholder, with a telling
  asymmetry **on the same object**: `current_act` fell back to the real `currentAct`, while
  `active_quest` fell back to the literal `'Explore the world'` and `quest_description` to `''`.
- The cause: `validateTurnData(raw, currentAct = 1, tableStyle = null)` (`rpg-state.js:437`) was
  never given the current quest.
- The correct behaviour existed elsewhere but was unreachable here: `rpg-state.js:693-696`
  (`forceNoOpTurnState`) and `rpg-engine.js:2583-2584` (the table-talk backstop) both restore the
  quest, but only fire when `noStateChange` is true or the turn is clarification/dialogue — not on
  an approved `committed_action`.
- Downstream: `rpg-engine.js:2893-2896` promotes it into `currentQuest`; `rpg-engine.js:2484-2497`
  has the next turn's prompt scan the last six turns and take the first `active_quest` it finds.
- The final narration JSON is model-authored and only partially engine-stamped
  (`rpg-engine.js:1908-1921` stamps dice, location, focal subject, encounter, `action_resolved` —
  never quest).

## Predicted observable failure
The narration model returns a valid turn object without `quest_update` on a referee-approved
committed action. The Active Quest header flips to "Explore the world" with an empty description
and stays there; the GM is subsequently told that is the active quest.

## Approach
Give `validateTurnData` the quest and fall back to it, exactly as `current_act` already does.
A new fourth parameter `currentQuest = null` of shape `{ title, description }` — the repo's
prevailing quest shape, used by both `outline.starting_quest` and `turnContext.active_quest`.

Both call sites now pass it: `takeTurn` passes `{ title: activeQuestName, description:
activeQuestDesc }`, the locals already resolved from database truth immediately above; and
`createCampaign` passes `outline.starting_quest`.

**The opening scene was broken too, and arguably worse.** Turn 1's `state_changes_json` is
`JSON.stringify(turnData)`, and both `getCampaignState` and the next turn's prompt scan read it
back as truth — so an opening turn omitting `quest_update` corrupted the campaign from its very
first turn. `validateOutline` guarantees `starting_quest` is well-formed
(`{ title: non-empty string, description: string }`), so that site is safe to trust.

**Description follows the name, deliberately.** If a turn names a quest, that quest owns its
description (blank when none is supplied, as before). If a turn names none, both name and
description are preserved. Restoring the old description unconditionally would graft the previous
quest's text onto a newly renamed quest — a different corruption, not a fix.

## Backward compatibility
The new parameter defaults to `null`, which reproduces the previous behaviour exactly
(`'Explore the world'` / `''`). No existing caller or test was changed; the ~20 existing
`validateTurnData` call sites in `test.js` pass 2-3 positional arguments and are untouched. No
test asserted the placeholder literal. The literal survives only for callers with no quest yet,
which is the one case where it is correct.

## Files changed
- `rpg-state.js` — `currentQuest` parameter and the quest fallback.
- `rpg-engine.js` — both call sites pass the quest.
- `test.js` — `testQuestFallback`, registered in `runAll`.

## Guard proof
`test.js::testQuestFallback`. Coverage: omitted `quest_update`; three blank variants (`{}`, empty
strings, whitespace-only); a legitimate quest change still lands, name and description, with
trimming; a renamed quest does **not** inherit the old description; callers with no quest keep the
old default; a source-slice pin on the `takeTurn` call site (matching the repo's existing pattern);
and a full end-to-end `createCampaign` run against a stubbed `fetch` whose opening payload
deliberately omits `quest_update`, asserting the **persisted** turn-1 quest.

**Three independent revert directions, each failing on its own:**

| Reverted | Observed failure |
|---|---|
| both files | `A committed action that omits quest_update must preserve the current quest, not reset it to a placeholder` — actual `'Explore the world'`, expected `'Recover the Sunken Crown'` |
| `rpg-engine.js` only (validator fixed) | `takeTurn must pass the resolved active quest into validateTurnData` |
| the `createCampaign` call site only | `An opening turn without quest_update must persist the outline starting quest, not a placeholder` — actual `'Explore the world'`, expected `'Silence the Bell'` |

The orchestrator independently re-ran the first direction and observed the same assertion, then
restored and returned the suite to green.

`node test.js`, `npm run test:browser` (10 guard lines on this branch, which predates jd-1's
eleventh), `node --check` on all three files, and `git diff --check` are clean.

## Known gaps
- `rpg-state.js:651` in the clarification net reads the already-validated value, so its `||`
  branch on the placeholder is now unreachable. Left alone to keep the diff tight; recorded here
  rather than silently tidied.

## Process note
An earlier verification run on this branch was disturbed by the orchestrator checking out another
branch **in the same working directory** while this work was uncommitted. Both this agent and the
orchestrator detected it independently. No work was lost — the patch was verified byte-identical
afterwards — but the final verification above was re-run on a confirmed-clean tree, and the
practice that caused it (running a coding agent in the shared working directory while performing
branch operations) has stopped.

## Reviewer comments

`Reviewer: kimi / kimi-code/k3 / max / frontier` — owner-named model and effort. Harness: kimi
0.31.1, tools restricted by agent-file, working root a disposable worktree. Reviewed head
`d9bf9c3`, base `ae2f2d9`. Verdict **accepted**, `guard_confirmed: true`, `capability_ok: true`,
zero comments.

**Executed, not supplied.** Confirmed from the reviewer's own transcript: unit suite green at
head, `rpg-state.js` reverted to the base SHA with the guard retained, suite re-run and failed at
the quest-fallback assertion, fix restored, suite green, and the browser suite run clean at the
end.
