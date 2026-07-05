# cr-4: Imported turn records can carry field shapes that crash the UI

**Severity**: MEDIUM — a hostile-but-authenticated bundle renders the imported campaign unopenable.
**Status**: In progress
**Branch**: `fix/cr-4-record-field-shapes`
**Commit**: (pending)

## Evidence
`rpg-state.js` bundle validation stores turn `state_changes_json` verbatim
once it parses to a plain object — field shapes inside are unchecked.
`rpg-engine.js:1936` (getCampaignState) trusts
`lastTurnData.suggested_choices || []`; `public/app.js` `renderChoices` calls
`choices.forEach`. Trigger: a bundle whose latest turn record contains
`{"suggested_choices": {"bad": "shape"}}`.

## Predicted observable failure
Opening the imported campaign throws `TypeError: choices.forEach is not a
function` in the browser; the campaign view stops rendering.

## What
The import trust boundary admits object-typed records with hostile interior
shapes that presentation-path consumers assume are arrays.

## Approach
Two layers, smallest coherent: (1) at the trust boundary, the bundle
validator re-shapes the known presentation fields inside each record —
`suggested_choices` must be an array of strings (else dropped) — leaving all
other fields (incl. legacy `roll_result`) untouched; (2) the consumer
(`getCampaignState`) guards with `Array.isArray`, which also protects
pre-existing local records. Both are needed: the validator hardens the
boundary, the consumer guard covers non-import records.

## Files changed
- `rpg-state.js` — record field shaping in `validateCampaignBundle`
- `rpg-engine.js` — `Array.isArray` guard in getCampaignState
- `test.js` — guard test in `testCampaignBundle`

## Guard proof
`test.js::testCampaignBundle` addition: a bundle turn carrying
`suggested_choices: {"bad":"shape"}` must come out with the key removed.
Reverting the validator change makes it FAIL (object survives).

## Coder dispute (if any)
None — my earlier plain-object fix stopped one class short.

## Known gaps
Other interior fields (narrative etc.) are consumed through escapers/
sanitizers already; suggested_choices was the crash-capable one codex
demonstrated. If the reviewer sees another crash-capable field, reopen.

## Reviewer comments
### Round 1 — 2026-07-05T11:59Z
- Reviewer: codex (codex-cli 0.142.5, gpt-5.5)
- Reviewed SHA `4cd869b2153a5ef1e35fc517b2b09f1daebd2ef6`, base `d1cc409ebcfe08c83be60211df8eafd8f09b915d`
- guard_confirmed: true (both directions observed in a disposable /tmp clone)
- Verdict: **reopened** — the suggested_choices fix is confirmed closed at both layers, but the same render path crashes on other imported interior shapes: dice_rolls entries pass the consumer's Array.isArray as [null] (app.js roll bubble dereferences roll.success) and a non-string attribute crashes the bubble formatting; legacy roll_result is equally unshaped.
- Fix-up: extract live play's dice-record coercion into sanitizeDiceRollRecords, apply it to imported dice_rolls (and roll_result) at the trust boundary, and element-filter the getCampaignState consumers.
