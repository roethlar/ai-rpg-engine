# Runtime greenfield plan review (docs/runtime-greenfield-plan.md)

**Status**: OPEN — r1 REOPENED (21 findings, all repaired); round r2 dispatching against draft r2 `b2d1d25f0a8637deaa1213317bccb735f73235b7`.
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
