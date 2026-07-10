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

### Round 1 — codex (codex-cli 0.144.0), 2026-07-09 UTC
- **reviewed_sha**: `ef94856` · **base_sha**: `a6b283c` · **guard_confirmed**: `true` · **verdict**: `reopened`

1. `rpg-state.js:824` — `scopeQuestForSeat` whitelists property *names* but forwards non-string values unchanged. `validateCampaignBundle` preserves adversarial `quest_update` shapes, and `getCampaignState` promotes them into `currentQuest`, so an accepted import containing `active_quest: { current_act: 3, outline: "PRIVATE" }` still leaks nested private data to seats. Enforce scalar strings here and/or sanitize `quest_update` at the import boundary, then add an import-path nested-value guard.

**Coder response: accepted, confirmed by execution.** The comment names a real conceptual error in my round-1 fix. I wrote a whitelist of property *names* and treated it as a whitelist of *data*. A permitted name can hold an arbitrary value; verified that `scopeStateForSeat` forwarded `active_quest: {current_act: 3, outline: "PRIVATE_TWIST…"}` verbatim to a seat. Confirmed too that `validateCampaignBundle` sanitizes `suggested_choices` and `dice_rolls` but leaves `quest_update` untouched, so a hostile bundle is the delivery vehicle.

### Round 2 — fix-up applied on the same branch

- `rpg-state.js` — `seatScalarString` coerces the two player-facing quest fields to scalars; objects, arrays, and functions (the only shapes that can nest private data) are dropped. A name plus a type is a whitelist; a name alone is a wish.
- `rpg-state.js` (`validateCampaignBundle`) — `quest_update` is sanitized at the **import boundary** as well: non-string `active_quest`/`quest_description` are stripped, and a non-object `quest_update` is dropped wholesale. Defense at both ends, because bundles are untrusted data and the seat scope should not be the only thing between a hostile import and a player.

**Guard proof (round 2)** — two independent sabotages against production code:
- seat scope → forward values unchanged ⇒ FAIL `A nested object under a permitted quest field must not reach a seat`
- import guard removed ⇒ FAIL `A non-string active_quest is stripped at the import boundary`

The bundle test also pins that legitimate string quests survive import untouched, so the sanitizer cannot be "fixed" by dropping the field entirely.
