# cr-3: Pacing cadence counts unresolved committed actions as world turns

**Severity**: MEDIUM — the pacing dial loosens after denials; the GM is told it has room to initiate earlier than configured.
**Status**: In progress
**Branch**: `fix/cr-3-cadence-resolved`
**Commit**: (pending)

## Evidence
rpg-engine.js cadence history (takeTurn) filters records on
`entry.kind === 'committed_action'` only, while turn-order advancement
(rpg-engine.js:1829) requires `action_resolved` — the definition of a world
turn this batch itself established. Denied/needs-clarification attempts keep
`input_kind: 'committed_action'` with `action_resolved: false`
(rpg-state.js) and so inflate `turns_since_gm_encounter`.

## Predicted observable failure
After a GM-initiated encounter followed by denied attempts, the Referee
prompt reports more world turns since the encounter than actually resolved,
crossing the pacing target early and licensing a new GM-initiated threat.

## What
Two definitions of "world turn" diverged: advancement uses resolved actions,
cadence uses any committed-labeled record.

## Approach
Extract the history-building into a pure exported helper
(`buildEncounterHistory` in rpg-state.js) that keeps only committed records
whose `action_resolved !== false` (records predating the flag count as
resolved, preserving legacy behavior), and use it in takeTurn. Pure so the
suite can guard it.

## Files changed
- `rpg-state.js` — new pure `buildEncounterHistory`
- `rpg-engine.js` — takeTurn uses it
- `test.js` — guard test

## Guard proof
`test.js::testTableStyle` addition: a history containing a gm_initiated
encounter followed by two unresolved committed records and one resolved one
must yield cadence 1, not 3. Reverting the filter makes it FAIL (returns 3).

## Coder dispute (if any)
None — direct inconsistency with my own action_resolved fix.

## Known gaps
Pre-Phase-D records have no encounter field at all and already read as
'none'; unchanged.

## Reviewer comments
(pending)
