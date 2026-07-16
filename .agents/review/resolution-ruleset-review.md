# Resolution ruleset review (docs/rules/resolution.md)

**Status**: r7 — grok ACCEPTED; codex REOPENED (2 findings: band-valence coherence, weight aggregation). r8 closes both — round 8 dispatched.
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


### Round 2 — pinned `56df9d383d807586669b99cfdf3f09302ad5f45c` (base `e1dd409`)

#### grok 0.2.101 / grok-4.5 (high reasoning, isolated worktree, schema-enforced)

2026-07-16T06:30:57Z. Structured verdict valid and SHA-matched. `evidence_checked: true`;
`cold_implementer_executable: true`; verdict: **ACCEPTED** — zero findings. All six grok r1
findings verified closed.

#### codex-cli 0.144.4 (read-only sandbox, schema-enforced output)

2026-07-16T06:30:57Z. Structured verdict valid and SHA-matched. `evidence_checked: true`;
`cold_implementer_executable: false`; verdict: **reopened** (3 HIGH / 4 MEDIUM / 1 LOW).

1. HIGH — delta-reason truth checked only post-roll by Continuity, when the record is immutable;
   no recovery path (invented circumstance can alter T on a canonical roll).
2. HIGH — annotation finalization undefined on Continuity rejection; no atomic/idempotent
   append-and-apply transaction; effect execution absent from the fixed handoff.
3. MEDIUM — fresh-UUID checkId gives no caller idempotency key; "retry of the same call" not
   executable (commit-before-response retry could double-roll).
4. HIGH — model-emitted actor id never bound to the turn's authorized acting character before
   SkillBonus lookup (wrong-competence resolution possible).
5. MEDIUM — supersession list omits the expansion of model authority from tier-only to
   tier + delta identifiers.
6. MEDIUM — no tier/delta anti-double-counting baseline rule (rain can count twice).
7. MEDIUM — calibration note uses +60 as top-end while the declared domain tops at 75
   (understates top-end odds: +75 → legendary T = 23 → 78%).
8. LOW — five-face symmetry claim unqualified at the clamps (T=2 has zero marginal-failure faces;
   T=99 one marginal-success face).

#### Coder triage → r3

All 8 admitted. r3 changes: Continuity moves to a PRE-ROLL validation step for delta-bearing calls
(reject → bounce to Referee, nothing committed) (#1); annotation finalization protocol — one
revision, then null-annotation commit with logged `annotationRejected`, and annotation append +
effect execution as one atomic idempotent transaction inside the fixed handoff (#2); logical
idempotency key `(turn, actor, callSeq)` mapping to one checkId forever (#3); `actor` is
engine-bound to the current turn's acting character, call field is cross-check only (#4);
supersession item 5 disclosing the model-authority expansion (#5); `tierBasis` field + one-fact-
one-home rule enforced by the pre-roll check (#6); calibration note recomputed at the true +75
top (#7); symmetry claim qualified as mid-range shape with the ordered evaluator normative (#8).
Grok re-reviews r3 as well — acceptance does not carry forward across a text change.


### Round 3 — pinned `79efb9f54a73c24f7e5d10e9d2e0eadf7730e96d` (base `56df9d3`)

#### grok 0.2.101 / grok-4.5 (high reasoning, isolated worktree, schema-enforced)

2026-07-16T06:45:18Z. Structured verdict valid and SHA-matched. `evidence_checked: true`;
`cold_implementer_executable: true`; verdict: **ACCEPTED** — zero findings (second consecutive
grok acceptance; re-reviewed because acceptance does not carry across a text change).

#### codex-cli 0.144.4 (read-only sandbox, schema-enforced output)

2026-07-16T06:45:18Z. Structured verdict valid and SHA-matched. `evidence_checked: true`;
`cold_implementer_executable: false`; verdict: **reopened** (2 HIGH / 2 MEDIUM).

1. HIGH — Continuity pre-roll check runs only on delta-bearing calls, yet it is the sole component
   that rejects a transient-circumstance tierBasis; a no-delta `hard`+rain-basis call commits a
   rain-inflated target unreviewed.
2. HIGH — `annotation.effects[]` has no type/domain; the delegated state-change surface accepts
   concrete numeric mutations, so no enum-only compliant execution path exists before D2.
3. MEDIUM — duplicate-delta protection is lexical (reason strings); semantic duplicates ("driving
   rain" / "heavy rainfall") can stack one fact twice.
4. MEDIUM — supersession item 5 / §6 say models never emit ANY number, but callSeq is a required
   model-emitted integer (schema implementers must violate the stated boundary or reject calls).

#### Coder triage → r4

All 4 admitted. r4 changes: Continuity pre-roll check runs on EVERY call, validating tierBasis
always and deltas when present (#1); `effects` is REQUIRED-EMPTY in v1 — annotations are binding
narrative canon with no mechanical mutation until the D2 catalog defines the only legal non-empty
vocabulary (#2); one-fact-one-home made explicitly semantic, Continuity rejects same-fact
rewordings among deltas (#3); the numeric boundary reworded to game-mechanical numbers, with
callSeq carved out as the sole protocol ordinal, excluded from all game arithmetic (#4).


### Round 4 — pinned `3820e5a03faf46d6de4c75ead141b73f6f1bdb97` (base `79efb9f`)

#### grok 0.2.101 / grok-4.5 — 2026-07-16T06:58:46Z. Valid, SHA-matched; `evidence_checked: true`;
`cold_implementer_executable: true`; verdict: **ACCEPTED** — zero findings (third consecutive).

#### codex-cli 0.144.4 — 2026-07-16T06:58:46Z. Valid, SHA-matched; `evidence_checked: true`;
`cold_implementer_executable: false`; verdict: **reopened** (1 MEDIUM):

1. MEDIUM — numeric carve-out inconsistent: §1.1 requires the Referee to emit the integer actor id
   and §5 types `actor` as integer, so `callSeq` is not the "sole" model-emitted numeric token; a
   literal item-5 validator rejects valid calls.

#### Coder triage → r5

Admitted. r5 change (surgical): supersession item 5 and §6 reworded — models emit exactly TWO
numeric protocol identifiers, the actor-id cross-check (engine-bound and verified independently)
and the callSeq idempotency ordinal; neither enters game arithmetic. No other text changes.


### Round 5 — pinned `f14593c79c7a1c608fda4546581bf09a2704849e` (base `3820e5a`)

#### codex-cli 0.144.4 — 2026-07-16T07:10:07Z. Valid, SHA-matched; `evidence_checked: true`;
`cold_implementer_executable: true`; verdict: **ACCEPTED** — zero findings.

#### grok 0.2.101 / grok-4.5 — 2026-07-16T07:10:07Z. Valid, SHA-matched; `evidence_checked: true`;
`cold_implementer_executable: true`; verdict: **ACCEPTED** — zero findings (fourth consecutive).

**CONVERGENCE REACHED**: both reviewers accepted the same pinned SHA with no material comments,
satisfying the contract. Finding trajectory: r1 13 (7 codex + 6 grok) → r2 8 → r3 4 → r4 1 → r5 0.
Owner sign-off remains the final gate; it enacts the chapter's supersession declaration and the two
explicitly flagged trades (enumerated delta magnitudes replacing free "+3%" integers; annotation
`effects` required-empty until D2).


### Owner-directed amendments after r5 convergence (2026-07-16) → round 6

The owner ruled post-convergence: (1) **complication effects are mechanical, not narrative-only**
("A snapped pick reduces the player's pick count by 1. A spilled drink angers a patron and starts
an encounter. A glancing blow does less damage.") — the r3-era effects-empty stopgap is deleted;
effects execute exclusively through the D2 catalog, which becomes a hard prerequisite for
implementing the edge bands, with its required scope recorded on the D2 queue row. (2) After the
GM-discretion discussion (predictable-vs-contextual, the hard decision point), the owner approved
**licensed discretion** ("Sure, let's try it."): bands license rather than require complications;
an engine-computed stakes license (encounter state + tier + band) caps effect weight; license
width is playtest-tunable config in both directions; every edge ruling is ledgered with its
license (`stakesLicense`) so model discretion is auditable in real play. Per the convergence
contract, these amendments invalidate the r5 acceptance; round 6 dispatched to both reviewers.

Also queued from the same discussion: D15 (outline divergence & re-planning) added to the intake
queue — campaign-structure scope, not this chapter.

### Round 6 — pinned `55838527dcc19ec1f1471f4ba8d6985b01eafb1c` (base `f14593c`, the two owner amendments)

#### grok 0.2.101 / grok-4.5 (read-only allowlist — the classifier rejected --always-approve on
native Bash; blanket auto-approval replaced by explicit read-only tool allows) — 2026-07-16T13:04:18Z.
Valid, SHA-matched; `evidence_checked: true`; `cold_implementer_executable: false`;
verdict: **reopened** (1 HIGH):
1. HIGH — licensed discretion half-applied to the band table: marginal_success says "may", but
   crit_failure still mandates a complication and crit_success mandates an extra, contradicting
   §1.5's "a band never mandates".

#### codex-cli 0.144.4 — 2026-07-16T13:04:18Z. Valid, SHA-matched; `evidence_checked: true`;
`cold_implementer_executable: false`; verdict: **reopened** (3 HIGH / 1 MEDIUM):
1. HIGH — same band-table inconsistency as grok, plus missing license semantics on crit_success
   and marginal_failure (which edge bands accept effects is ambiguous).
2. HIGH — the twice-rejected fallback kept the r5 "complication coloring is descriptive only"
   remnant, contradicting mechanical-only complications (narration could canonize an unledgered
   snapped pick).
3. HIGH — no engine-owned validation of effects (catalog membership, quantity legality, weight vs
   stakesLicense) before append/execution; no recovery path for overweight selections.
4. MEDIUM — license contract not executable: no token domain, context mapping, config shape, or
   shipped default; D2 row lacked the license artifacts.

#### Coder triage → r7

All admitted (grok 1 ≡ codex 1). r7 changes: all four edge-band meanings license uniformly —
"may attach within the stakes license; flavor-only always legal" (incl. marginal_failure);
double-rejection fallback now forbids narrating ANY complication (unledgered complications do not
exist); new engine effects-validation step (catalog membership, quantities, weight ≤ license)
sharing the single-revision allowance, in the fixed handoff before append/execution; executable
license contract — ordered enum flavor_only < minor < significant, shipped default mapping
(encounter state sets base, critical band +1 step, extreme/legendary tier +1 step, capped),
weight classes and per-op weights recorded as D2 deliverables on the queue row.

### Round 7 — pinned `ca958a443e42f2d150af83505d648be630e7fdd9` (base `5583852`)

#### grok 0.2.101 / grok-4.5 (read-only allowlist) — 2026-07-16T13:12:51Z. Valid, SHA-matched;
`evidence_checked: true`; `cold_implementer_executable: true`; verdict: **ACCEPTED** — zero
findings (all five round-6 closures verified).

#### codex-cli 0.144.4 — 2026-07-16T13:12:51Z. Valid, SHA-matched; `evidence_checked: true`;
`cold_implementer_executable: false`; verdict: **reopened** (1 HIGH / 1 MEDIUM):
1. HIGH — no validator ties effects to the annotation text and resolved band's valence: a
   catalog-valid adverse effect (inventory loss) could ride a `crit_success` without negating the
   intent — a "boon-only" crit that destroys gear.
2. MEDIUM — weight aggregation over the `effects` array undefined against an ordered license
   token (two minors under a minor license? arbitrarily many?).

#### Coder triage → r8

Both admitted. r8 changes: (1) split coherence between the two validators deterministically —
every D2 catalog operation gains an engine-checkable **valence tag** (`beneficial`/`adverse`, a D2
deliverable); engine validation enforces band valence (`crit_success` beneficial-only, the other
edge bands adverse-only) while Continuity enforces **text–effect coherence** (an effect the
annotation text does not describe is rejected); (2) aggregation defined by engine-owned points —
minor = 1, significant = 2, license budgets flavor_only/minor/significant = 0/1/2, summed cost ≤
budget (one minor under minor; one significant or two minors under significant). D2 queue row
updated with valence tags and point costs as deliverables.

