# Admin model registry plan review

**Status**: Round 1 reopened by both reviewers; revision required; no implementation authorized.
**Plan location**: `plan.md` → Dev Tooling → `am-*`
**Owner direction**: `.agents/decisions.md` (2026-07-15 admin AI configuration decision)

## Convergence contract

Claude reviews correctness, migration/key isolation, security, guardability, and cold-implementer
completeness. Grok independently reviews the runtime/data model, operator UX, live-catalog boundary,
and migration/compatibility risks. Both receive the same pinned repository SHA and return the
reviewloop structured verdict envelope. The plan converges only when both return `accepted` with no
material comments against the same SHA.

Any reopen is recorded below before the plan changes. The revised plan is committed and both
reviewers are dispatched again against the new shared SHA; an earlier acceptance does not carry
forward to a changed snapshot.

## Review rounds

### Round 1 — pinned `91f3ca59953c4f90b6af96151b198a5f65ae10af`

Base: `0dc4ca6fd451126bfaffff4a6c51f5e3914f63e4`.

#### Claude Code 2.1.210 / Claude Opus 4.8 (high effort)

Timestamp: 2026-07-15T15:50:38Z. Structured verdict valid and SHA-matched.
`evidence_checked: true`; `cold_implementer_executable: false`; verdict: **reopened**.

1. **MEDIUM — custom catalog URL contract.** `CUSTOM_ENDPOINT_URL` / stored `baseUrl` is the full
   chat-completions URL consumed directly by `callCustomOpenAI`, so appending `/models` misroutes.
   Define an exact API-root derivation or a separate catalog/root field.
2. **MEDIUM — legacy endpoints.** The projection does not explicitly move legacy top-level
   `baseUrl` / `ollamaUrl` into the new provider connections. Require the mapping and exercise both
   paths in the no-op-save guard.
3. **MEDIUM — blank legacy models and environment precedence.** Projected blank-model entries must
   continue consulting role/global model environment variables. The migration proof must populate
   `AI_MODEL` and `FALLBACK_AI_MODEL` so losing that behavior makes it fail.
4. **MEDIUM — production endpoint policy.** The catalog request→stored→env wording conflicts with
   `AIClient`'s production env-only endpoint rule. State and test the production drop explicitly;
   SSRF validation alone does not implement it.
5. **LOW — partial legacy roles.** A stored role can contain only provider, model, or key. Define
   inheritance/projection for every partial shape instead of assuming complete tuples.

#### Grok 0.2.101 / Grok 4.5 (high reasoning)

Timestamp: 2026-07-15T15:50:38Z. Structured verdict valid and SHA-matched.
`evidence_checked: true`; `cold_implementer_executable: false`; verdict: **reopened**.

1. **HIGH — custom endpoint mismatch.** Same root finding as Claude: catalog cannot append `/models`
   to the full chat-completions URL. Set one durable contract, align chat/catalog behavior, and test
   legacy env/admin values.
2. **HIGH — legacy blank-model validation.** New entries require model ids while projected legacy
   defaults may be blank. Name the stored discriminator that permits only projected legacy blanks,
   preserves provider defaults, and is covered by migration guards.
3. **HIGH — admin module delivery.** `admin.js` is currently classic and the server exposes only its
   explicit route. Specify `type="module"`, serve `model-registry.js`, and account for CSP.
4. **HIGH — production endpoint escape.** Request/stored catalog endpoints must be dropped in
   production exactly like `AIClient`; add a discriminating production test.
5. **MEDIUM — settings validation status.** Registry validation promises HTTP 400, but the current
   route maps every thrown error to 500 and `am-1` omits `server.js`. Add the route/error change to
   the slice.
6. **MEDIUM — legacy endpoint fields.** Same root finding as Claude; map both top-level endpoint
   fields even when the current primary provider is another provider.
7. **MEDIUM — masked/save DTO.** Specify the exact v2 masked response and secret-preserving POST
   merge keyed by entry id, including the rule that provider-key mode stores no entry override.
8. **MEDIUM — partial legacy roles.** Define an explicit role tuple as any non-empty role field and
   state provider/model/key inheritance for every partial case.

Procedural note: the first Grok launch rejected the incompatible `--check --no-subagents` flag
combination before model execution. It produced no verdict and was re-run read-only with the same
pinned SHA and schema; only the valid second result above is a review outcome.
