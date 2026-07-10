# sv-5: Valid long tone values abort a seat's entire voice narration

**Severity**: LOW — deterministically breaks optional narration, but only for 81–120-character model-generated tone directions.
**Status**: Open
**Branch**: `fix/sv-5-tone-bound`
**Commit**: (filled in after commit)

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
Bound `tone` at the narrate route with a constant tied to the producing validator (120), not the unrelated character-name bound. A tone is a delivery hint with no security weight; rejecting a valid one to protect nothing costs the player the rest of the turn's audio.

## Files changed
- `server.js` — `MAX_TONE_LENGTH` (120, matching `validateTurnData`) replaces `MAX_CHARACTER_FIELD_LENGTH` for `tone`.
- `test.js` — guard assertion on the bound relationship.

## Guard proof
`test.js`: a 120-character tone — the maximum `validateTurnData` emits — must survive the narrate route's bound. Asserted as `MAX_TONE_LENGTH >= the validator's cap` via a round-trip through `validateTurnData` + the exported bound. Reverting to 80 makes it FAIL.

## Coder dispute (if any)
None.

## Known gaps
`speaker` is bounded at 80 in the same block. NPC names are bounded elsewhere at 80, so that pairing is consistent; left unchanged.

## Reviewer comments
(pending)
