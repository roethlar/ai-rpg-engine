# sv-5: Valid long tone values abort a seat's entire voice narration

**Severity**: LOW — deterministically breaks optional narration, but only for 81–120-character model-generated tone directions.
**Status**: MERGED and verified; merge `52efb5e` on master.
**Branch**: deleted (was `fix/sv-5-tone-bound`)
**Commit**: `09cd769` (accepted branch tip; merge `52efb5e`)

## Evidence
- `rpg-state.js:261` — `validateTurnData` accepts `tone` up to **120** characters.
- `rpg-state.js` `scopeStateForSeat` → `scopeVoiceLinesForSeat` preserves that tone verbatim.
- `public/app.js` `narrateGmResponse` — a seat client sends `tone` back to the narrate route.
- `server.js:741` — that route validates it with `MAX_CHARACTER_FIELD_LENGTH` = **80** (`server.js:88`).
- `public/app.js` — a non-`ok` narrate response `throw`s, and the throw exits the whole `for` loop over queued lines.

Trigger: any turn whose narrator emits a tone direction of 81–120 characters, played by a seat.

## Predicted observable failure
HTTP 400 `tone must be 80 characters or fewer`; the current audio queue stops and **every remaining spoken line of the turn is skipped**. Host narration is unaffected (the host client never sends `tone`).

## What
The S2 seat voice path introduced a second validation of a field that already had a canonical bound, and chose a stricter, unrelated constant. The narrate route is downstream of `validateTurnData`, so it must accept everything that validator produces.

## Approach
Two corrections rather than one. First, the caps get a single home: `MAX_SPEAKER_LENGTH` / `MAX_TONE_LENGTH` are exported from `rpg-state.js` and used by `validateTurnData` itself, so no downstream site can drift stricter than what the validator emits. Second — and more important — the narrate route now **truncates** instead of rejecting. These values originate in our own scoped payload, a tone carries no security weight, and a 400 exits the client's narration loop, so rejection costs the player the rest of the turn's audio to protect nothing. A truncated speaker simply misses the exact-match NPC lookup and degrades to the narrator voice. This removes the failure mode rather than moving its threshold, and still bounds a hostile client's 9 KB tone.

## Files changed
- `rpg-state.js` — exported `MAX_SPEAKER_LENGTH` / `MAX_TONE_LENGTH` (now used by `validateTurnData`) and new `boundVoiceDirective`, the single home for this bounding.
- `server.js` — the narrate route calls `boundVoiceDirective` instead of `optionalBoundedString(..., MAX_CHARACTER_FIELD_LENGTH)`.
- `test.js` — guard assertions.

## Guard proof
Proven against `boundVoiceDirective`, the function `server.js` actually calls (an earlier draft re-implemented the bound inside the test, which would have been vacuous — reverting `server.js` could not have failed it):
- Narrowing the tone cap to the speaker cap → FAIL: `The narrate route passes through the longest tone validateTurnData emits`.

The test round-trips the widest value `validateTurnData` can emit into `boundVoiceDirective` and asserts it survives byte-for-byte, so the two bounds are pinned in relation to each other rather than to a magic number. It also pins the new behavior: a 9 KB hostile value truncates rather than throwing.

## Coder dispute (if any)
None.

## Known gaps
`speaker` is bounded at 80 in the same block. NPC names are bounded elsewhere at 80, so that pairing is consistent; left unchanged.

## Reviewer comments

### Verdict — codex (codex-cli 0.144.0), 2026-07-09 UTC
- **reviewed_sha**: `cb44e36` · **base_sha**: `a6b283c` · **guard_confirmed**: `true`
- **verdict**: `accepted` — the reviewer independently performed the guard proof in its own worktree (revert → FAIL, restore → PASS) and reported no comments.

**Status → Verified.** The branch is ready for an OWNER-GATED merge. Per the playbook, "accepted" records that the branch passed review; it does not authorize a merge, push, or history rewrite.
