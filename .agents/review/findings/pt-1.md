# pt-1: Live GM contract cannot preserve ability identity across a rename

**Severity**: MEDIUM — a contract-valid ability improvement can durably fork one ability into two canonical records, corrupting progression and later portability identity.
**Status**: Admitted; repair not authorized
**Branch**: none
**Commit**: none — repair not started

**Current planning:** `../campaign-character-version-plan.md` section 7 reconciles this repair
with physical character-version ownership. The finding remains open; no repair is authorized.

## Evidence

- `rpg-prompts.js:220-221` exposes known abilities to the live GM as name, tier, and description, without their engine-issued IDs.
- `rpg-prompts.js:239,277-287` permits ability improvements, but the required `ability_updates` shape likewise has no ID field.
- `rpg-state.js:610-615` carries an ID only when the model happens to emit one.
- `rpg-engine.js:154-164,181-205` falls back to display-name matching when no ID arrives; a renamed ability misses that lookup and is appended under a freshly minted ID.
- `.agents/review/archetype-portability-matrix-v3.1.md:226-238` makes the stable ID, not the display name, the ability identity.
- `test.js:3378-3383,3411-3422` proves rename safety only with a synthetic update that already contains the correct ID; it does not exercise the live GM prompt contract.

## Predicted observable failure

A character has `{id: X, name: "Quick Draw"}`. The GM returns a contract-valid `improve` update named `Fast Nock` without an ID. Validation accepts it, name fallback cannot find `Quick Draw`, and the engine inserts `{id: Y, name: "Fast Nock"}`. The character permanently carries two abilities instead of one renamed/improved ability.

## What

S1.1 added stable IDs and ID-first matching internally, but the production model contract supplies neither the known IDs nor an output field for echoing them. The mechanism that closes the rename fork is therefore dormant on the live turn path.

## Approach

Expose opaque existing ability IDs in the GM-private character sheet and `ability_updates` contract. Require an existing exact ID for improve/remove, allow no ID for add, retain name matching only for genuine legacy rows, and guard the real prompt-to-validation-to-apply path.

## Files changed

None yet; this record only corrects review state.

## Guard proof

No repair exists yet. Intake directly reproduced the failure on `f75bcc1`: the live prompt omitted the ID, validation preserved that omission, and applying the renamed improvement left two records with different IDs.

## Reviewer comments

- Reviewer: claude / claude-fable-5 / max / frontier (competitive; owner-selected)
- Openreview range: `263f3be67a0f9d7d87b3ae212faf86f39c69a397..f75bcc16c5614cad1d9ccb7ba18362019910db2a`
- Valid dispatch envelope UUID: `2ac741a2-4378-4e07-a565-c84fad72e7a3`; exact SHAs matched and `capability_ok` was true.
- Verdict: candidate admitted at intake.
