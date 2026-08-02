# rsv-1: Legacy runtime is not oriented beside the three proposals

**Severity**: MEDIUM — an owner can mistake a proposed package for shipped behavior or miss the migration distance.

**Status**: Open

**Branch**: none

**Commit**: none

## Evidence

- `54bf01b:.agents/review/rules-system-variants.md:17-24` starts with the signed target contracts, while the only legacy statement is the migration sentence at line 505.
- `54bf01b:.agents/state.md:31-35` is the only compact description of the shipped optional-d20, generated-rules, HP/mana, and XP runtime.
- `54bf01b:.agents/state.md:120-121` nevertheless says the earlier reconciliation request is satisfied by the variants document.

## Predicted observable failure

The owner or a future implementer reads the self-contained comparison as the system which currently runs, plans from the wrong baseline, or cannot tell which parts are signed, proposed, and shipped. This repeats the exact orientation failure the comparison was meant to end.

## What

The three proposals are detailed, but the comparison does not put the live legacy runtime, signed-but-unimplemented target, and proposed complete package beside one another. The current-state entry point contains the missing facts, so a repair should point to that canonical record rather than create an independently maintained second runtime specification.

## Approach

If the owner authorizes a repair, add a short, explicitly non-normative orientation table near the document opening: shipped legacy runtime → signed target → three proposed completions. Link the current-state entry and code evidence for details, and state that none of the variants is live.

## Files changed

None; this pass records review output only.

## Guard proof

No repair is authorized. A future docs guard can assert that the orientation section contains all three layer labels and links the canonical current-state record.

## Coder dispute (if any)

None. The one-canonical-location rule affects the repair shape, not the finding's user-facing orientation failure.

## Known gaps

The review harness compressed the original evidence, failure, and approach strings into `<<ccr:...>>` references in its final envelope. Intake re-established the evidence against the pinned reviewed SHA; the original title and severity were preserved.

## Reviewer comments

Reviewer: claude / claude-fable-5 / high / frontier — owner-specified effort override, inline and session-only.

Claude Code 2.1.220; base `dadc64a4f65a74f4a906260f092415cafd3f214c`; head `54bf01ba68a28824d09024a9dc84cc67d4c4c579`; verdict `findings`; `capability_ok: true`; CLI result UUID `b77edcf8-a790-4343-ac1f-67c9512eb8e6`; session `4a7ab2bb-27fd-456e-b64f-9308b466373d`; 2026-08-02.

Intake verdict: **ADMITTED**. The evidence is concrete, the orientation failure is observable, and MEDIUM is justified by planning or approving against the wrong runtime baseline.
