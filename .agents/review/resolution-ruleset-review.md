# Resolution ruleset review (docs/rules/resolution.md)

**Status**: r1 REOPENED by both reviewers (codex 7 findings, grok 6); r2 revision in progress.
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

### Round 1 — pinned `e1dd409eb8d3752922d1df259c204523a1c59603` (base `fd5f99d`)

#### codex-cli 0.144.4 (read-only sandbox, schema-enforced output)

2026-07-16T06:09:35Z. Structured verdict valid and SHA-matched. `evidence_checked: true`;
`cold_implementer_executable: false`; verdict: **reopened** (3 HIGH / 3 MEDIUM / 1 LOW).

1. HIGH — marginal-success complications contradict active D1/rider-(b) rejection; GM-decided does
   not cure; supersession declared too narrowly.
2. HIGH — GM-emitted free integer deltas break the D0/intake "identifiers and enums, never
   arithmetic" invariant; ±15 unenforced; no count/stacking rule.
3. HIGH — critical extras / complications have no owner or commit path; ledger has no field for
   them; narration could introduce unvalidated state-changing canon after the "immutable" record.
4. MEDIUM — executable data contract incomplete (actor/turn ids, SkillBonus domain, tier/band
   serialization, ledger types, timestamp, `sides:100` missing from the literal record, council
   handoff unstated).
5. MEDIUM — "may not re-roll" is prose-only: no check id, uniqueness, idempotent retry, or atomic
   roll+commit rule.
6. MEDIUM — ladder uncalibrated vs SkillBonus: +60 collapses Trivial/Easy/Standard to T=2; tier
   gaps uneven (15/25/25/15/8); Legendary may become routine unacknowledged.
7. LOW — §8 climber example misclassifies boundary cases under the inclusive raw−T≤5 rule.

#### grok 0.2.101 / grok-4.5 (high reasoning, isolated worktree at pinned SHA, schema-enforced)

2026-07-16T06:09:35Z. Structured verdict valid and SHA-matched. `evidence_checked: true`;
`cold_implementer_executable: false`; verdict: **reopened** (3 HIGH / 3 MEDIUM).

1. HIGH — §8 climber example band-edge arithmetic wrong (raw 2–7 vs stated 2–6 under raw−T≤5).
2. HIGH — supersession understated: edge-texture bands + judgment-based no-roll are more than a
   d20→d100 swap; sign-off could ship a grammar the owner thinks was die-only.
3. HIGH — free signed-integer deltas vs the enums-only invariant; guideline unenforced; stacking
   can drive T to the rails.
4. MEDIUM — band asymmetry: marginal success spans N+1 faces, marginal failure N; prose implies
   symmetry.
5. MEDIUM — texture-rate honesty: N=5 gives ~11–12% texture near mid-T, far below the superseded
   d20 memo's ~25% mixed band; prose silent.
6. MEDIUM — implementability gaps (ledger/band tokens, SkillBonus domain, delta bounds, which
   council seat rules deltas, complication non-negation enforcement).

#### Coder triage → r2

All findings ADMITTED except a recorded partial dispute on codex #1: the edge-texture bands are the
owner's own direction, given AFTER the rider-(b) rejection (2026-07-16: "2-n% can be the margin you
were arguing for earlier… 99, probably also a hit, but X happens"), and the rejection's operative
content was GM-OFFERED player choice, which the draft still forbids. The legitimate half — the
supersession declaration was too narrow — is fixed in r2 (§Status enumerates every superseded D1
clause); the authority question routes to the owner at sign-off, which is already the acceptance
gate. r2 changes: symmetric N-face bands + corrected examples (grok 1/4, codex 7); explicit
supersession enumeration (grok 2, codex 1); deltas become enumerated magnitudes with count/net caps
— models emit identifiers/enums only (grok 3, codex 2); post-roll annotation protocol with
validation path and immutable outcome fields (codex 3); full data contract + council handoff +
`sides:100` in the record (codex 4, grok 6); checkId idempotency + atomic roll-commit (codex 5);
texture-rate and ladder-calibration honesty notes (grok 5, codex 6).

