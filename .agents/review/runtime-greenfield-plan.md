# Runtime greenfield plan review (docs/runtime-greenfield-plan.md)

**Status**: OPEN — r3 REOPENED (11 findings, all repaired in draft r4); round r4 dispatching.
**Artifact**: `docs/runtime-greenfield-plan.md` (cost-first greenfield runtime architecture plan).
**Owner direction**: 2026-07-18 — owner ordered a greenfield plan for a better, cheaper engine;
prior decisions and rules explicitly **not binding**; hard bar: a campaign cannot cost $50.
Review harness: openreview with codex `gpt-5.6-sol` at **xhigh** effort (owner confirmed the
escalation tier verbally this turn: "openreview with gpt 5.6 sol on max"); codereview playbook
for modifications. Claude authored the draft and therefore cannot review it.

## Review contract

Reviewer must return the structured fail-closed verdict envelope (verdict, reviewed_sha,
evidence_checked, cold_implementer_executable, findings[] with severity CRITICAL|HIGH|MEDIUM|LOW,
section, quote, failure_scenario, suggested_fix). Missing, invalid, off-schema, or SHA-mismatched
output is NOT acceptance (re-prompt once, then contested). Review lenses: cost-model soundness
(price math, planning numbers, the $25 ceiling claim); architectural coherence (single-call loop,
dice column, fact-store memory, cache layering, tier routing); exploit and failure surfaces
(dice-column shading, validator gaps, memory visibility leaks, cache invalidation); baseline
fairness (is the Council cost characterization accurate to `rpg-engine.js`); migration realism;
and acceptance-criteria testability. Loop to CLOSED with zero findings, then owner sign-off.

## Review rounds

### Round r1 — REOPENED (2026-07-18)

- Harness: codex MCP `gpt-5.6-sol` xhigh, sandbox read-only; thread `019f754d-28e2-7ee2-9460-3de5e850935d`.
- Reviewed SHA: `7379b8e8c456859430834ee408ac83bd049990d9` (draft r1) — matched pin. Envelope valid; `evidence_checked: true`; `cold_implementer_executable: false`.
- Verdict: **reopened**, 21 findings — 16 HIGH (rg-r1-1..5, 8..16, 18, 20), 5 MEDIUM (rg-r1-6, 7, 17, 19, 21).
- Themes: cost model unsound (2,000-turn envelope vs 100 h pacing; uncached/unbilled paths; aggregate cache target; 20–40x ratio wrong — is 10–25x); ops vocabulary/check-binding/fallback unspecified; dice column exposes indices + unauditable commitment; fact write path not atomic; visibility leak surface; router lacks pre-call feature provenance; §6 criteria gameable (excluded calls, un-runnable soak range, projection-not-measurement, unblinded playtest); turn API contract understated; schema matrix missing.
- Disposition: **all 21 accepted** → repaired in draft r2. Headline changes: 3,000-committed-turn upper envelope + per-attempt billing ledger; pricing snapshot v1 with warm/cold per-call table; scenarios E ($22.2) / A (unmanaged $57.8 — governor is load-bearing) / W ($45 reservation ceiling); ops/check-binding/failure state machine contracts; implicit dice binding + HMAC commitment/reveal; atomic fact_ops + durable extraction queue; witness ACLs + paraphrase leak tests; conservative router with consequence caps; §6 rewritten (count-everything call accounting, 220-turn soak, per-tier cache targets, blinded playtest, baseline-honesty gate); §7 full API contract + migration matrix.

### Round r2 — REOPENED (2026-07-18)

- Harness: codex MCP `gpt-5.6-sol` xhigh, read-only; thread `019f7565-0f17-71d3-a520-bef2564caf0d`. First dispatch fail-closed on SHA pin drift (state-file commit advanced HEAD past the pinned b2d1d25); re-prompted once with corrected pin per contract.
- Reviewed SHA: `cd9804e90c61fd72b1707e824f369c0d185f6c24` (draft r2). Envelope valid.
- Verdict: **reopened**, 20 findings — 1 CRITICAL (rg-r2-1 result_id causality), 12 HIGH, 7 MEDIUM.
- Themes: same-envelope reference causality; prose outcome detection undecidable (claimed as validator, actually not); attempt-unit conflation (exchange/generation/dispatch); Scenario A arithmetic not derived from snapshot (strict/recall lines); 10–25x ratio still wrong (6.5–16x); TTS/audio uncharged while §7 preserves audio; path matrix missing budgets; governor ambiguity states (charge-then-timeout, crash, SDK retries); governor could suspend forced strict mode / refusal could pass soak; ops appendix nonexistent; baseline branch map wrong vs live code (grounding verifier is table-talk path; final continuity missed; only narration carries getGMSystemInstruction); HMAC unspecified (encoding/lifecycle/vectors); model-selected pinning unbounded; cross-seat narration paraphrase leaks; extractor backpressure unspecified; ambiguity feature undefined; playtest stats undefined; API contract deferred not stated; migration matrix prose-only; §6.1 exclusions.
- Disposition: **all 20 accepted** → draft r3. Headline: three-level accounting (exchange/generation/dispatch, public numbering from exchanges); envelope-local handles c1..cN/n1..nN with pre-commit resolution; structural outcome segments + engine-rendered roll banners (prose evasion honestly audit-only); Scenario A recomputed line-by-line (≈$61.6); per-turn-normalized 6.5–16x claim; TTS as charged path + owner Q4 (voice-off default); §4 path matrix; durable reserve→dispatch→settle with ambiguous-charge-full rule; invariant vs negotiable config classes + minimum-progress soak thresholds; op contract v0 inline + gate G1; baseline branch map corrected from live call sites; HMAC-SHA256 domain-separated length-prefixed spec + root commitment + fork re-key; engine-derived pin classes with keyed slots + pin-growth soak; ACL-intersection shared narration; extractor backpressure to stop-accepting-actions; enumerated hazard/ambiguity features + corpus protocol; pre-registered non-inferiority playtest (margin 0.75, ≥25 pairs); observed API surface v0 from server.js + gate G2; migration semantics v0 (job re-enqueue, fresh dice root on fork, ID remapping) + gate G3.
### Round r3 — REOPENED (2026-07-18)

- Harness: codex MCP `gpt-5.6-sol` xhigh, read-only; same thread `019f7565-0f17-71d3-a520-bef2564caf0d` (repair-delta continuation).
- Reviewed SHA: `0ac8abd5cf30d190e0ffecb2b62c2e3e586f3fb3` (draft r3) — matched pin. Envelope valid.
- Verdict: **reopened**, 11 findings — 5 HIGH (rg-r3-1 commitment cannot authenticate HMAC without key reveal; rg-r3-2 no client idempotency on POST /turn; rg-r3-3 three mutation channels bypass op caps; rg-r3-7 ACL-intersection starves requester-private info; rg-r3-10 additive DDL is not safe rollback), 6 MEDIUM (rg-r3-4 generation caps vs continuations; rg-r3-5 undocumented padding in path-matrix line bases; rg-r3-6 retry rates conflated; rg-r3-8 router feature names unpinned; rg-r3-9 playtest n not derivable; rg-r3-11 soak workload unpinned / refusals escape denominator).
- Disposition: **all 11 accepted** → draft r4. Headline: dice verification claims split precisely into live per-turn property (column fixed pre-model-call) vs at-root-reveal property (seeds honestly derived), root revealed at campaign end or rotation; client-supplied `request_id` with pre-generation exchange persistence and replay-on-duplicate; single canonical mutation channel (fact_ops/npc_updates arrays removed, `record_fact` added to op v0, slot-based conflict keys); stage-enum generation caps (3/4/5); path matrix computed→padded columns with labeled multipliers; validation vs escalated retry split with per-scenario lines (E $22.81, A ≈ $66.4); dual-projection output audience (requester-private segments + private-answer fixtures); gates G4 (router spec) and G5 (seeded soak manifest) added, G3 moved to before-any-migration-code; TOST-style non-inferiority spec with derived n (SD 1.25 → 18 → ≥25); min_runtime_version fence, one-way activation, backup-restore rollback; §6.5 exchange-status denominator with per-status thresholds.