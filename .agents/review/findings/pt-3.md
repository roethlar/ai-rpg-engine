# pt-3: Canonical ability writes can exceed the S1.3 reader contract

**Severity**: LOW — unusually long but contract-valid ability text can make a later portability wording batch fail before the GM is called.
**Status**: Admitted; repair not authorized
**Branch**: none
**Commit**: none — repair not started

## Evidence

- `rpg-state.js:586-621` trims ability names and descriptions from live turn output but imposes no field-length limit.
- `rpg-engine.js:166-178` likewise normalizes abilities without bounding either field.
- `rpg-engine.js:1001-1014,1019-1039` serializes those values directly into both campaign and persistent-profile `abilities_json`.
- `db.js:195-213,297-317` stores both JSON documents in unconstrained `TEXT` columns.
- `rpg-engine.js:420-459` rejects any requested ability whose name exceeds 200 characters or whose description exceeds 2,000; one oversized member rejects the entire requested batch.
- `rpg-engine.js:474-477` performs that preflight before canon retrieval or model dispatch.
- `test.js:4651-4671` covers other preflight failures but not an engine-accepted oversized ability mixed with valid abilities.

## Predicted observable failure

A committed turn creates an ability with a 201-character name or 2,001-character description, and the engine persists it to the canonical profile. When portability later requests wording for that ability alongside valid missing abilities, S1.3 throws `STAGE_ONE_PROPOSAL_INPUT_INVALID` before calling the GM. No proposal is produced for any ability in the batch, so the later movement flow cannot advance through wording review.

## What

The canonical ability writer accepts a broader value domain than the S1.3 reader. State authored through the engine can therefore be unreadable by the next Phase PT seam.

## Approach

Define one canonical ability text contract and apply it at every creation/update/import boundary. Preserve a deliberate legacy strategy for already-oversized rows, and add a mixed-batch regression that proves engine-written abilities remain consumable by S1.3.

## Files changed

None yet; this record only corrects review state.

## Guard proof

No repair exists yet. Intake directly reproduced the mismatch on `f75bcc1`: `validateTurnData` accepted 201/2,001-character fields, `applyAbilityUpdates` produced persistable state, and `proposeStageOneAbilityWording` rejected a mixed request with `STAGE_ONE_PROPOSAL_INPUT_INVALID` before any model call.

## Reviewer comments

- Reviewer: claude / claude-fable-5 / max / frontier (competitive; owner-selected)
- Openreview range: `263f3be67a0f9d7d87b3ae212faf86f39c69a397..f75bcc16c5614cad1d9ccb7ba18362019910db2a`
- Valid dispatch envelope UUID: `2ac741a2-4378-4e07-a565-c84fad72e7a3`; exact SHAs matched and `capability_ok` was true.
- Verdict: candidate admitted at intake.
