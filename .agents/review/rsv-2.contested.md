# rsv-2: Declined openreview-effort conflict

**Candidate title:** Queued openreview tier contradicts the durable playbook and the owner request has no recorded provenance

**Reviewer severity:** MEDIUM

**Intake verdict:** DECLINED

The generic toolkit playbook says openreview uses the configured frontier pair at `max`, but the owner explicitly corrected this invocation to `claude-fable-5` at `high` and explicitly prohibited `max`. Human request outranks the generic playbook, and `.agents/state.md:9,116` scopes the override to this one review rather than turning a limited correction into a universal rule. The completed review record now supplies literal model, effort, range, CLI version, UUID, and session provenance. The candidate therefore predicts no product or design failure and would incorrectly erase the owner's higher-authority instruction.

The harness compressed the candidate's long evidence, failure, and approach strings into `<<ccr:...>>` references in the final envelope. The preserved title plus repository evidence were sufficient to resolve the authority question.
