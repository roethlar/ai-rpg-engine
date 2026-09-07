# Destination-Bound Class Arrival Baselines

Status: implemented; focused producer regression and removal proof pass (2026-09-07). Root owns final combined verification and commit. Authority: [class experience implementation plan](class-experience-implementation-plan.md). This is persistence correctness evidence, not a human playtest or fun verdict.

## Defect

The actual progressed Rider copy lifecycle exposed an identity mismatch. `addClassActor` correctly creates destination-world item identities when carrying a saved profile into a new campaign or joining another campaign. The current world and current character inventory used those identities, but `characters.baseline_json` had already captured the source profile's inventory IDs. A later v4 import could not map those old IDs into the destination world and rejected with `Missing items identity mapping`.

This was an arrival producer defect, not permission to loosen archive validation or reinterpret historical provenance as current ownership. Owned ability identities intentionally remain stable when copying a profile; destination item and controlled vehicle identities do not.

## Implementation

`rpg-engine.js` now inserts a target Aetheria character row with a NULL baseline, installs its class actor, then captures `characterBaselineJson(projectClassCharacter(character, world))` within the same existing transaction. Creation captures the bound arrival before initial scene additions; joining captures immediately after actor installation. The update addresses exactly the newly allocated character ID and campaign ID and requires `baseline_json IS NULL`; anything other than one changed row aborts activation.

Existing rows are never rewritten. The legacy pre-turn-update baseline path is unchanged. Subsequent gameplay still updates current world/profile state without rebasing the arrival history. No item-name guessing, broad baseline migration, archive remapper change, or source profile mutation is involved.

## Evidence

- `node test-class-arrival-baselines.mjs` passes with only the AI provider prompt boundary stubbed. The runner guards an explicit system-temporary `RPG_DB_PATH` before dynamic application imports and creates/removes its own disposable database when run directly.
- Actual campaign creation and two Council milestone turns earn level 3. Actual create-copy and join-copy retain earned grants and owned ability IDs, allocate independent profiles, and capture exact destination item and vehicle identities.
- Three actual SQLite export/import roundtrips pass: newly created copy, joined copy in a separate campaign, and created copy after a real ordinary item-drop turn. The existing founder baseline and the copied character's original arrival baseline remain unchanged.
- The source campaign row, character row, reusable profile row, and turn history remain exactly equal to their pre-copy snapshots, preserving ownership and history.
- An exported artifact deliberately carrying an old source item ID in its baseline is rejected with the exact missing-identity error. Campaign, character, and profile row counts are unchanged; the source and existing copy remain unchanged. This exercises import rollback without modifying an existing development campaign.
- Removal proof: temporarily replaced the helper's `projectClassCharacter(character, world)` input with the unbound `character`. The focused test failed at `Arrival captures destination-bound item IDs, not the source profile inventory`, showing old source UUIDs versus newly bound destination UUIDs. The one-line mutation was restored in `finally`; the complete focused runner then passed again. No mutation remains.
- The independent `test-class-rider-turns.mjs` runner also passed with the correction, including progressed copy, vehicle loss/replacement roundtrip, and copy-after-replacement roundtrip. Its broader Rider evidence is recorded separately.

The runner exports `runClassArrivalBaselineTests`; root wired it into `test.js` after class creation tests. Final combined unit/browser results belong to the implementation tracker, not this focused result.

## Existing Development Copies

This change does not silently repair copies created with an incompatible baseline. Their imports continue to fail explicitly when a baseline identity has no exact destination mapping. Do not overwrite their baseline from current state or guess by item name/equipment category. For disposable development data, recreate the copy from the intact source using the corrected producer. Any later repair of retained data requires a separately authorized, exact and unambiguous recorded-identity mapping; no such migration is implemented here.
