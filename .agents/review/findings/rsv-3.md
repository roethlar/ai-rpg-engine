# rsv-3: State NEXT step is self-referential after the design commit

**Severity**: LOW — a future agent can repeat a completed commit step or review an unpinned range.

**Status**: Addressed by mandatory review-state synchronization; not externally re-reviewed

**Branch**: `master`

**Commit**: review-record closeout commit

## Evidence

`54bf01b:.agents/state.md:116` begins NEXT with “Commit the three closed rules-system variants,” even though that sentence is already part of the design commit itself, and says only “pinned design range” rather than the actual `dadc64a..54bf01b` range.

## Predicted observable failure

A future agent reading `.agents/state.md` repeats or is confused by an already-completed action and has to reconstruct the intended review range.

## What

The state snapshot was written for the moment before the design commit but committed as the post-commit current-state record.

## Approach

The required review closeout updates NEXT to the post-review owner ruling and records the exact reviewed range. This is state hygiene, not a design repair, and receives no second Fable call.

## Files changed

- `.agents/state.md` — post-review state and next action.

## Guard proof

Manual: the new NEXT begins with the owner comparison/ruling and the review provenance pins `dadc64a..54bf01b`.

## Coder dispute (if any)

None.

## Known gaps

No external re-review is authorized; status states that limitation directly.

## Reviewer comments

Reviewer: claude / claude-fable-5 / high / frontier — owner-specified effort override, inline and session-only.

Claude Code 2.1.220; base `dadc64a4f65a74f4a906260f092415cafd3f214c`; head `54bf01ba68a28824d09024a9dc84cc67d4c4c579`; verdict `findings`; `capability_ok: true`; CLI result UUID `b77edcf8-a790-4343-ac1f-67c9512eb8e6`; session `4a7ab2bb-27fd-456e-b64f-9308b466373d`; 2026-08-02.

Intake verdict: **ADMITTED**. The stale instruction is present at the reviewed SHA and the future-agent confusion is directly observable.
