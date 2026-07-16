# Effect catalog review (docs/rules/effects.md)

**Status**: OPEN — round 1 dispatched.
**Artifact**: `docs/rules/effects.md` (Chapter 2: Effects — the D2 effect verb catalog).
**Owner direction**: 2026-07-16 — owner approved drafting with independent review "like the dice
spec" (the resolution chapter), which ran dual codex + grok. Claude authored this draft and
therefore cannot review it (authors never review their own work).

## Convergence contract

Both reviewers must **accept the same pinned commit SHA** of `docs/rules/effects.md` with no
material comments. Structured fail-closed verdict envelope (schema-enforced: verdict,
reviewed_sha, evidence_checked, cold_implementer_executable, findings[]): missing, invalid,
off-schema, or SHA-mismatched output is NOT acceptance (re-prompt once, then contested). Review
lenses: internal coherence (tables, weights, valences, config, worked examples consistent with the
chapter's own rules and Chapter 1's §1.5 contract); fidelity to recorded owner decisions (the D2
decision, D0/intake enums-only invariant, Chapter 1 §1.5, recorded D16 requirements);
cold-implementer executability; drift risks (number smuggling, self-chosen weight/valence, state
minting, license/valence bypass, unledgered canon); and coverage (attack the say-yes claim: find
GM-natural rulings that neither map nor belong on the §6 exceptions list). Any reopen is recorded
here before the draft changes; a revised draft gets a new pinned round. After convergence the
chapter goes to the owner for sign-off; acceptance ungates Chapter 1 edge-band implementation
planning (no rules code before a concrete phase and an accepted plan review).

## Review rounds

### Round 1 — pinned `4738e31a3e30a3de370f2ad3fba64006f8f80f58` (draft r1)

Dispatched to codex (read-only sandbox, schema-enforced output) and grok (isolated worktree at the
pinned SHA, high reasoning, schema-enforced). Verdicts recorded below on return.
