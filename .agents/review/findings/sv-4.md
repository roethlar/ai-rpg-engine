# sv-4: Seat payload leaks the act index nested inside `currentQuest`

**Severity**: LOW — a direct but narrow leak: the numeric current act, not act objectives or twists.
**Status**: Open
**Branch**: `fix/sv-4-scope-current-quest`
**Commit**: (filled in after commit)

## Evidence
- `rpg-state.js:200-210` — every validated `quest_update` carries `current_act`; `rpg-state.js:332-337` force-stamps it from campaign truth.
- `rpg-engine.js:1865` — the turn response assigns that whole object to `currentQuest`.
- `rpg-state.js` `scopeStateForSeat` — forwards `currentQuest` wholesale.
- `public/app.js` — the seat UI hides the act badge, and the top-level whitelist deliberately omits `currentAct` (asserted in `test.js`: `scoped.currentAct === undefined`).

Trigger: submit any seat turn (or `GET /api/seat/session`) and read the raw JSON.

## Predicted observable failure
The response contains `currentQuest.current_act`, revealing outline progression that the same whitelist drops at the top level. The scoping is internally inconsistent: it withholds a fact through one field and discloses it through another.

## What
`scopeStateForSeat` whitelists top-level keys but forwards a nested object by reference, so a private field rides along inside a public one. The whitelist discipline has to apply at every level it forwards, not only the first.

## Approach
Scope `currentQuest` down to the two player-facing fields (`active_quest`, `quest_description`), the same way `voiceLines` is scoped element-wise. This is the general lesson of the finding, not a spot patch: nested objects crossing the seat boundary get their own whitelist.

## Files changed
- `rpg-state.js` — `scopeStateForSeat` builds `currentQuest` field-by-field.
- `test.js` — guard assertion.

## Guard proof
`test.js` seat-visibility group: a seat's serialized payload must not contain `current_act`, using a distinctive act marker. Reverting the fix makes the assertion FAIL.

## Coder dispute (if any)
None.

## Known gaps
None. `turnOrder`, `ruleset`, `location`, and `heroic` were audited for the same nested-leak class while fixing this: they carry no GM-private fields (`turnOrder` = ids + names, already visible in the party strip).

## Reviewer comments
(pending)
