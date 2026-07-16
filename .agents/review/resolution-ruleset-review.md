# Resolution ruleset review (docs/rules/resolution.md)

**Status**: r1 dispatched — awaiting codex + grok verdicts.
**Artifact**: `docs/rules/resolution.md` (Chapter 1: Resolution — d100 tail-texture hybrid).
**Owner direction**: 2026-07-16 — "turn this into a coherent ruleset then run it by codex and grok
reviewloops." For THIS loop the owner's explicit wording reinstates the dual codex+grok contract,
superseding the 2026-07-15 Claude-only-reviewer default for this artifact. Claude authored the
draft and therefore cannot review it (authors never review their own work).

## Convergence contract

Both reviewers must **accept the same pinned commit SHA** of `docs/rules/resolution.md` with no
material comments. Structured fail-closed verdict envelope per `.agents/playbooks/reviewloop.md`:
missing/invalid/off-schema/SHA-mismatched output is NOT acceptance (re-prompt once, then contested).
Review lenses: internal coherence (bands, clamps, worked examples all consistent with the stated
rules); fidelity to recorded owner decisions (D0, D1-as-amended, GM-authority, rider rejections);
cold-implementer executability (could an engine coder implement §1–§5 without asking questions);
and drift risks (any seam where a model could smuggle numbers, re-roll, or negotiate outcomes).
Any reopen is recorded here before the draft changes; a revised draft gets a new pinned round.

## Review rounds

(recorded per round below)
