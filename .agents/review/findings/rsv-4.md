# rsv-4: Ember Lance rank-5 targeting is ambiguous

**Severity**: LOW — one worked example contradicts the document's exact-targeting promise and can seed an invalid catalog record.

**Status**: Open

**Branch**: none

**Commit**: none

## Evidence

`54bf01b:.agents/review/rules-system-variants.md:487` defines Ember Lance as Far range and one target. Line 491 says the rank-5 slot “replaces it with Standard harm to two Near targets,” without saying whether Near replaces Far range or describes the two targets' distance from each other.

## Predicted observable failure

A catalog author follows the worked example and produces a target record with two incompatible interpretations; the engine cannot determine legal targets from the authored fields without prose inference.

## What

The example which is supposed to prove exact spell-rank and upcasting semantics uses an undefined spatial phrase at its highest-slot row.

## Approach

If the owner authorizes a repair, express it in the existing range vocabulary: “two targets within Far that are Near each other,” or retain one Far target and change only harm. The authored target record must contain the same exact relation.

## Files changed

None; this pass records review output only.

## Guard proof

No repair is authorized. A future docs guard can parse every worked ability row and require its range/target terms to be members of the shared zone vocabulary.

## Coder dispute (if any)

None.

## Known gaps

The review harness compressed the original evidence string into a `<<ccr:...>>` reference in its final envelope. The predicted failure and better approach remained readable, and intake confirmed the cited contradiction at the pinned SHA.

## Reviewer comments

Reviewer: claude / claude-fable-5 / high / frontier — owner-specified effort override, inline and session-only.

Claude Code 2.1.220; base `dadc64a4f65a74f4a906260f092415cafd3f214c`; head `54bf01ba68a28824d09024a9dc84cc67d4c4c579`; verdict `findings`; `capability_ok: true`; CLI result UUID `b77edcf8-a790-4343-ac1f-67c9512eb8e6`; session `4a7ab2bb-27fd-456e-b64f-9308b466373d`; 2026-08-02.

Intake verdict: **ADMITTED**. Evidence, deterministic failure, and LOW severity all hold.
