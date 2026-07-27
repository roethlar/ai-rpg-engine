# Runtime greenfield plan review (abandoned)

**Status**: ABANDONED by owner 2026-07-26. The r5 review closed with zero findings, but the
artifact must not be implemented.
**Artifact**: `docs/history/runtime-greenfield-plan-abandoned.md` (historical design evidence).
**Owner supersession**: 2026-07-26 — keep the shipped Council runtime and continue incremental
rules, UI, mapping, and related improvements.
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

### Round r4 — REOPENED (2026-07-18)

- Harness: codex MCP `gpt-5.6-sol` xhigh, read-only; same thread `019f7565-0f17-71d3-a520-bef2564caf0d` (repair-delta continuation; transport-abort re-dispatch honored the same pin).
- Reviewed SHA: `4d9d12e6792f084100d421fb0a8e4302a89d0557` (draft r4) — matched pin. Envelope valid; all 11 r3 repairs verified.
- Verdict: **reopened**, 17 findings — 7 HIGH (rg-r4-1 reservation uses estimated prefix, not a tokenized bound; rg-r4-2 duplicate replay undefined for in-progress exchanges; rg-r4-3 host requests escape the idempotency key (NULL seat); rg-r4-4 raw player input visibility unspecified (audience separation covers facts only); rg-r4-5 strict-mode phase schemas/commit timing unspecified; rg-r4-6 version fence ships in the same migration it must predate; rg-r4-7 validation-retry "cold mid as bound" ignores tier-correlated concentration), 9 MEDIUM (rg-r4-8 continuation retry caps vs matrix; rg-r4-9 frontier escalation undefined; rg-r4-10 forced synchronous extraction breaks per-exchange maxima; rg-r4-11 batch discount unpriced in snapshot; rg-r4-12 baseline branch map omissions; rg-r4-13 fork/import exchange semantics; rg-r4-14 G5 manifest lacks minimum stress envelope; rg-r4-15 audit sampler unmeasured/consequence-free; rg-r4-16 Council retirement gated on §6.7 alone), 1 LOW (rg-r4-17 rounding/TTS figure drift).
- Disposition: **all 17 accepted** → draft r5. Headline repairs: reservation = pre-dispatch tokenization of the fully serialized request with the destination tokenizer (no estimated component; per-tier serialized-input ceiling as build constant); exchange lifecycle `accepted→generating→committing→settled` + lease + startup recovery, 202-with-state replay, single-transaction settlement; principal = (`principal_kind`, `principal_id`) covering host; explicit input-visibility contract (table-public composer, seat-scoped `private_note` channel, raw-input echo fixtures); strict-mode normative declaration/continuation envelopes with cached-prefix boundary, atomic commit timing, retry-cap-0 deterministic mechanical resolution (no model ops); bridge-release fencing with `campaign_v2` DB-level block and backup-restore below bridge; tier-conditional retry model (val E 1.5/4/8% A 4/8/15%, esc E 0.3/1/2.5% A 1.2/4/8% of committed, frontier→frontier) with Σ tier×destination-cold lines — E $22.94, A ≈ $68.1; continuation retry cap 0 (occ ≤ 1) in matrix; pre-admission extraction recovery; batch lane priced in snapshot; §1 branch map corrected (conditional 6th call, two GM-prompt consumers, appended chain); fork/import inert exchange provenance; G5 minimum stress envelope + pin-time feasibility; audit-sampler numeric gate (≥90% detection, ≤5% FP, blocks release, deterministic consequence); Council retirement requires all §6 + G1–G5 + owner decisions; rounding convention + TTS ~$21.

#### Round r5 — APPROVED (2026-07-18) — Harness: codex MCP `gpt-5.6-sol` xhigh, read-only; thread `019f7565-0f17-71d3-a520-bef2564caf0d`

- Reviewed SHA: `a6e41099087348ba15042101f7668126475389ec` — repair-delta on the scenario-table retry-count convention. Reviewer verdict `approved`, evidence_checked: true, arithmetic_rechecked: true, cold_implementer_executable: true. Independently reproduced: E val $1.19988, A val $5.2239, E esc $0.82566, A esc $6.435; totals $23.49124 → $23.49 and $67.36425 → ≈ $67.4.
- Repairs confirmed (rg-r5-3): §4 scenario tables now use one convention — committed mix + non-committing-all-small tier exchange counts (E 1,800/324/36; A 2,850/660/90); retry lines Σ(tier count × conditional rate × destination cold) match the path matrix in both scenarios; E extractor at unbatched list ($1.44); E total $23.49; A total ≈ $67.4 (still over the owner bar — governor remains load-bearing).
- One LOW finding rg-r5-10 (normalization rounding): $23.49124 / 1,800 = $0.0130507 → $0.0131/turn, not $0.0130. Fixed in-place; ≈ 6–15× comparison unchanged. Post-fix SHA: `03ec483f46e0e476ce261a2854294c2f75f643e1`.
- Historical loop result: CLOSED with zero open findings. The owner later abandoned the artifact;
  there is no sign-off or implementation step.
