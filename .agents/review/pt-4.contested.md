pt-4 — DECLINED AS SUPERSEDED: On the reviewed historical design head
`810a008f2905bcaf8771d1fee3aef016d4bae6e1`, the Stage 1 proposal accepted only known
ability IDs and ability-presentation fields while the same design still required shared
campaign vocabulary to be created from that proposal. The reviewer correctly predicted that
S1.4 would otherwise have no bounded producer for those shared semantic keys.

That is not a current actionable defect. The landed S1.4 design explicitly resolves the seam:
S1.3 emits no engine-owned campaign semantic keys, runtime rejects non-empty shared batches
instead of inferring keys from prose, and versioned shared storage waits for a later
engine-owned producer (`.agents/review/archetype-portability-matrix-v3.1.md` §14,
`plan.md` Phase PT S1.4, `.agents/state.md`). The historical finding is retained as review
evidence but declined at current-head intake because its predicted implementation ambiguity has
already been removed.

Reviewer: claude / claude-fable-5 / max / frontier (competitive; owner-selected), corrected
design-only openreview range
`9e4916d49cb052381f322e07d8714fdd88949076..810a008f2905bcaf8771d1fee3aef016d4bae6e1`,
valid envelope `ef8f1e86-31b5-44e9-9688-a0c91fab827e`.
