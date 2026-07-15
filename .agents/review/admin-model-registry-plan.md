# Admin model registry plan review

**Status**: Round 7 finding incorporated; revised plan awaiting dual round 8; no implementation
authorized.
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

### Round 1 response — revision committed after verdict record

All findings are admitted and addressed in the r2 draft:

- The custom endpoint remains a full chat-completions URL; catalog derivation replaces the exact
  `/chat/completions` suffix with `/models` or reports discovery unavailable.
- `legacyDefault` plus deterministic projected ids is the only blank provider/model exception;
  authorization is tied to the server's existing projection/stored id, and runtime keeps the old
  populated environment precedence.
- Top-level legacy custom/Ollama endpoints map unconditionally into provider connections; partial
  role tuples preserve raw partial fields and the no-op guard now exercises all of them.
- The masked GET and secret-preserving POST schemas, entry-id merge rules, shared-mode secret clear,
  and typed validation 400 boundary are explicit.
- Catalog endpoints are request/stored/env only in non-production and env-only in production, with a
  discriminating zero-fetch proof.
- The UI uses same-origin ES modules, an explicit route for the helper, and the existing CSP.

Round 2 must review the new shared SHA from scratch; neither r1 verdict carries forward.

### Round 2 — pinned `24577fbc87d5db16f78c6f44037f8e0f671c99c6`

Base: `0dc4ca6fd451126bfaffff4a6c51f5e3914f63e4`.

#### Claude Code 2.1.210 / Claude Opus 4.8 (high effort)

Timestamp: 2026-07-15T16:00:48Z. Structured verdict valid and SHA-matched.
`evidence_checked: true`; `cold_implementer_executable: true`; verdict: **accepted**.

Claude verified every r1 correction and found no HIGH/MEDIUM plan defect. It recorded two explicit
non-blocking notes:

1. `am-1` would change the settings GET/POST to v2 while the v1 browser remains until `am-3`, leaving
   `/admin` blank/clobber-prone between owner-gated merges; implement promptly or add compatibility.
2. The intermediate `mergeAiConfig` → `resolveAgentConfig` per-role fallback shape is implied rather
   than stated, though tests pin the intended result.

#### Grok 0.2.101 / Grok 4.5 (high reasoning, corrected dispatch)

Timestamp: 2026-07-15T16:00:48Z. The first response was rejected fail-closed because it returned a
placeholder comment after no repository inspection. The one allowed corrected re-prompt produced a
valid, SHA-matched structured verdict. `evidence_checked: true`;
`cold_implementer_executable: false`; verdict: **reopened**.

1. **HIGH — inherited primary loses role env precedence.** Assigning the projected v1 primary
   directly to roles that had no explicit tuple turns inheritance into an explicit assignment, so
   `ROLE_AI_PROVIDER` / `ROLE_AI_MODEL` / `ROLE_API_KEY` stop beating the old primary. Leave such
   roles unassigned and retain an inherited default entry/path, or explicitly preserve the chain.
2. **HIGH — owner-gated slice breaks `/admin`.** Claude's non-blocking note is material under the
   plan's own merge sequencing: after `am-1`, the old JS consumes v1 while the route returns v2.
   Keep a v1 compatibility DTO/POST until `am-3`, or move wire activation into `am-3`.
3. **MEDIUM — primary endpoint omission.** The plan forwards custom/Ollama endpoints on fallback but
   does not explicitly attach the provider connection to an assigned primary. Require and guard both.
4. **MEDIUM — Ollama production default mismatch.** `AIClient` uses
   `OLLAMA_URL || http://localhost:11434` after dropping config endpoints in production; catalog
   wording allowed only the env field, making refresh fail where runtime succeeds. One shared endpoint
   resolver must include the same Ollama default and be parity-tested.

Convergence is not reached: both verdicts are valid, but the shared-SHA contract requires both to
accept. The Grok findings are admitted; Claude's first note is resolved as the same root issue as
Grok finding 2 rather than left as accepted risk.

### Round 2 response — revision committed after verdict record

All four Grok findings and both Claude notes are addressed in the r3 draft:

- Canonical v2 gains `defaultModel`. V1 roles without explicit tuples remain unassigned and resolve
  `ROLE_*` before the old primary; the migration proof now pairs a filled stored primary with filled
  role provider/model/key variables.
- `am-1`/`am-2` keep the v1 HTTP DTO/save active. `am-3` switches the new UI, v2 wire, and first
  canonical rewrite atomically, eliminating an incoherent merged-master interval.
- The `mergeAiConfig` intermediate role contract and all three primary/fallback resolution cases are
  explicit. Provider connection endpoints attach to primary and fallback entries and are guarded in
  both positions.
- One endpoint-policy helper gives runtime and catalog identical production behavior, including
  Ollama's `http://localhost:11434` default when `OLLAMA_URL` is absent.

Round 3 must review the complete new shared SHA; prior results do not carry forward.

### Round 3 — pinned `826b733bf61d5c0acb1f8df3624eedd1bef50c79`

Base: `0dc4ca6fd451126bfaffff4a6c51f5e3914f63e4`.

#### Claude Code 2.1.210 / Claude Opus 4.8 (high effort)

Timestamp: 2026-07-15T16:11:07Z. Structured verdict valid and SHA-matched.
`evidence_checked: true`; `cold_implementer_executable: true`; verdict: **accepted**, zero comments.

#### Grok 0.2.101 / Grok 4.5 (high reasoning)

Timestamp: 2026-07-15T16:11:07Z. Structured verdict valid and SHA-matched.
`evidence_checked: true`; `cold_implementer_executable: false`; verdict: **reopened**.

1. **HIGH — incomplete runtime return contract.** Describing the intermediate as only
   `{ defaultPrimary, roles }` could make a cold implementation drop the unchanged top-level
   voice/image configuration consumed by `voice-narration.js` and `rpg-engine.js`. State that all
   non-Council fields remain top-level siblings.
2. **HIGH — provider-match inheritance gate omitted.** Cases 2/3 could choose a role provider such as
   Grok and then inherit another provider's default model/key/endpoint. Preserve the current
   provider-equality gate for every inherited model/key/endpoint, and retain role-specific endpoint
   env precedence.

Convergence is not reached. Both Grok findings are admitted; they close an executable ambiguity and
the existing cross-provider credential-leak class respectively.

#### Response to Round 3

Both findings are incorporated in the r4 draft:

- The documented Council-text intermediate is explicitly a subshape of the full server AI config.
  Every current voice/image sibling and the temporary v1 compatibility fields remain in the return
  object and existing consumers must not receive a narrowed config.
- Provider resolution now precedes inheritance. Every model, key, and endpoint inherited from the
  default primary requires provider equality; role endpoint environment variables retain precedence
  over matching provider-connection endpoints. The guard matrix adds both the cross-provider and
  role-endpoint cases.

Round 4 must review the complete new shared SHA; prior results do not carry forward.

### Round 4 — pinned `d7d9db209978c47c032064ec7fd549b2c9f0a427`

Base: `0dc4ca6fd451126bfaffff4a6c51f5e3914f63e4`.

#### Claude Code 2.1.210 / Claude Opus 4.8 (high effort)

Timestamp: 2026-07-15T16:19:57Z. Structured verdict valid and SHA-matched.
`evidence_checked: true`; `cold_implementer_executable: true`; verdict: **accepted**, zero comments.

#### Grok 0.2.101 / Grok 4.5 (high reasoning)

Timestamp: 2026-07-15T16:19:57Z. The CLI's free-text envelope was noisy, but its schema-enforced
`structuredOutput` was valid and SHA-matched. `evidence_checked: true`;
`cold_implementer_executable: false`; verdict: **reopened**.

1. **HIGH — complete-looking migrated entries lose role/fallback key precedence.** A legacy role
   tuple with explicit provider + model but blank key does not qualify for `legacyDefault`, so the
   normal-entry chain would skip `ROLE_API_KEY` and same-provider default-primary key inheritance.
   The current resolver gives both precedence over the provider environment. A legacy fallback with
   provider + model but blank key likewise currently consults `FALLBACK_API_KEY`. Require a
   migration-only key-inheritance marker or equivalent field-specific compatibility path, and guard
   populated fixtures for both primary and fallback.

Convergence is not reached. The Grok finding is admitted: the plan preserves partial tuples but does
not yet preserve key-only inheritance for v1 tuples whose provider and model were already complete.

#### Response to Round 4

The finding is incorporated in the r5 draft:

- `legacyDefault` now marks every projected v1 role and fallback entry, not only entries with a
  blank provider or model. This retains field-specific key inheritance even for complete-looking
  legacy tuples; a no-op save keeps the server-authorized marker and a deliberate runtime-field edit
  clears it.
- The primary compatibility chain explicitly preserves `ROLE_API_KEY` then a provider-matched old
  primary key. The fallback compatibility chain preserves `FALLBACK_API_KEY` then its provider
  environment and does not reuse the old primary's stored key.
- The migration guard adds complete provider/model, blank-key role and fallback fixtures with
  distinct competing secrets, so the precedence proof cannot pass accidentally.

Round 5 must review the complete new shared SHA; prior results do not carry forward.

### Round 5 — pinned `d57150c943cda8556889cb65e41120a81bbe7245`

Base: `0dc4ca6fd451126bfaffff4a6c51f5e3914f63e4`.

#### Claude Code 2.1.210 / Claude Opus 4.8 (high effort)

Timestamp: 2026-07-15T16:29:38Z. Structured verdict valid and SHA-matched.
`evidence_checked: true`; `cold_implementer_executable: true`; verdict: **accepted**, zero comments.

#### Grok 0.2.101 / Grok 4.5 (high reasoning)

Timestamp: 2026-07-15T16:29:38Z. The CLI's free-text envelope was again noisy, but its
schema-enforced `structuredOutput` was valid and SHA-matched. `evidence_checked: true`;
`cold_implementer_executable: false`; verdict: **reopened**.

1. **HIGH — runtime intermediate drops the migration discriminator and key provenance.** The plan
   requires normal, `legacyDefault`, and empty resolution branches but documents expanded entries as
   only provider/model/key/endpoints. Eager provider-key expansion recreates the round-four bug;
   leaving a blank without the marker makes normal and migrated entries indistinguishable. Require
   explicit descriptors carrying the marker and unresolved key source through `mergeAiConfig`, and
   make `normalizeFallbackConfig` branch-aware rather than unconditionally injecting `FALLBACK_*`.
2. **HIGH — first canonical save has no projected secret-merge baseline.** Through `am-2`, the stored
   row is v1 and has no provider map or entry ids. If the first v2 POST merges blank masked secrets by
   provider name/id directly against that raw row, every projected provider/entry looks new and its
   stored secret can be lost. Require POST to project the loaded row first, merge against that
   deterministic v2 baseline, and guard distinct primary/role/fallback secrets through projection,
   blank-key save, and reload.

Convergence is not reached. Both findings are admitted; they identify missing executable state, not
new product behavior.

#### Response to Round 5

Both findings are incorporated in the r6 draft:

- `mergeAiConfig` now carries a named internal `council` descriptor with provider connections and
  raw entry descriptors. Each descriptor retains `legacyDefault`, `keySource`, and only its stored
  custom key; provider keys are not eagerly expanded. `resolveAgentConfig` owns the three exclusive
  branches, and `normalizeFallbackConfig` does not re-inject environment values on the Council path.
- The first v2 POST must project the loaded v1 row into the same deterministic, secret-preserving v2
  baseline used by GET before applying blank/missing/replace/clear semantics. The guard follows
  distinct stored primary, role, and fallback secrets through projected GET, blank-key POST, and raw
  reload.
- The new descriptor is nested at `council`, so it cannot collide with the temporary legacy
  top-level `roles` object; voice/image and every old runtime sibling remain intact.

Round 6 must review the complete new shared SHA; prior results do not carry forward.

### Round 6 — pinned `87d4be3b069f1f7c12dfcb9173bb69e761db5896`

Base: `0dc4ca6fd451126bfaffff4a6c51f5e3914f63e4`.

#### Claude Code 2.1.210 / Claude Opus 4.8 (high effort)

Timestamp: 2026-07-15T16:37:35Z. Structured verdict valid and SHA-matched.
`evidence_checked: true`; `cold_implementer_executable: true`; verdict: **accepted**, zero comments.

#### Grok 0.2.101 / Grok 4.5 (high reasoning)

Timestamp: 2026-07-15T16:37:35Z. The CLI's free-text envelope was noisy, but its schema-enforced
`structuredOutput` was valid and SHA-matched. `evidence_checked: true`;
`cold_implementer_executable: false`; verdict: **reopened**.

1. **HIGH — the Council→AIClient fallback handoff has no resolved-state signal.** The Council-aware
   resolver returns a flat config without `council`, while `normalizeFallbackConfig` runs later in
   `AIClient`. It therefore cannot distinguish an already resolved normal/null Council fallback from
   legacy input and can reapply `FALLBACK_*`, selecting the wrong backup key or reviving a null tier.
2. **HIGH — the guards do not discriminate double injection.** A migrated fallback already using
   `FALLBACK_API_KEY` remains unchanged if the helper applies the same variable twice. Add a normal
   v2 fallback with distinct provider/connection environment keys versus `FALLBACK_API_KEY`, assert
   the failover Authorization header, and prove a resolved null is not revived.

Convergence is not reached. Both comments are admitted as one contract defect plus its required
non-vacuous proof.

#### Response to Round 6

Both comments are incorporated in the r7 draft:

- Council-aware `resolveAgentConfig` always returns `fallbackResolved: true` plus either a fully
  resolved fallback object or explicit null. `normalizeFallbackConfig` uses that internal marker for
  copy-only/null-preserving behavior; callers without it retain the old environment merge.
- One guard uses distinct stored-connection, provider-environment, and `FALLBACK_API_KEY` values and
  checks the actual backup Authorization header. A second changes `FALLBACK_*` after resolving null
  and proves normalization cannot revive it. Reverting the marker branch makes both red.

Round 7 must review the complete new shared SHA; prior results do not carry forward.

### Round 7 — pinned `46c1913f33f835347b583213359e64ade16b7b0a`

Base: `0dc4ca6fd451126bfaffff4a6c51f5e3914f63e4`.

#### Claude Code 2.1.210 / Claude Opus 4.8 (high effort)

Timestamp: 2026-07-15T16:49:39Z. Structured verdict valid and SHA-matched.
`evidence_checked: true`; `cold_implementer_executable: false`; verdict: **reopened**.

#### Grok 0.2.101 / Grok 4.5 (high reasoning)

Timestamp: 2026-07-15T16:49:39Z. The CLI's free-text envelope was noisy, but its schema-enforced
`structuredOutput` was valid and SHA-matched. `evidence_checked: true`;
`cold_implementer_executable: false`; verdict: **reopened**.

Both reviewers independently reported the same material issue:

1. **HIGH — wrong-key marker guard is vacuous with a stored connection key.** A normal fallback's
   non-empty connection key is already copied into the resolved fallback object, so the old
   `apiKey || FALLBACK_API_KEY` expression still selects that connection key after the marker branch
   is removed. The Authorization assertion stays green, contradicting the promised guard proof.
   Use a provider-key entry with blank custom and connection keys, distinct provider-environment and
   `FALLBACK_API_KEY` secrets, and explicitly defer provider-environment resolution to the backup
   `AIClient`; then removing the marker injects the wrong fallback secret and turns the test red.

Convergence is not reached. The finding is admitted as a verification-contract defect; neither
reviewer identified a new product or runtime-design gap.

#### Response to Round 7

The shared finding is incorporated in the r8 draft:

- Provider-environment key resolution is explicitly deferred to the selected primary or backup
  `AIClient`; a Council-resolved object keeps `apiKey: undefined` when custom/connection/specific-env
  tiers are empty.
- The wrong-key guard now leaves both entry custom and stored connection keys blank, with distinct
  `OPENAI_API_KEY` and `FALLBACK_API_KEY`. The marker keeps the key undefined until backup-provider
  lookup selects OpenAI; removing it injects the fallback key and changes the Authorization header.
- The existing null-revival guard remains unchanged. Both guards now fail when the marker branch is
  removed, while ordinary stored-connection selection remains covered elsewhere.

Round 8 must review the complete new shared SHA; prior results do not carry forward.

### Round 8 — pinned `5f0261375f9b97f464f54ee406d5bafca7f3ea8d`

Base: `0dc4ca6fd451126bfaffff4a6c51f5e3914f63e4`.

#### Claude Code 2.1.210 / Claude Opus 4.8 (high effort)

Timestamp: 2026-07-15T16:56:05Z. Structured verdict valid and SHA-matched.
`evidence_checked: true`; `cold_implementer_executable: true`; verdict: **accepted**, zero comments.

#### Grok 0.2.101 / Grok 4.5 (high reasoning)

Timestamp: 2026-07-15T16:56:05Z. The CLI's free-text envelope was noisy, but its schema-enforced
`structuredOutput` was valid and SHA-matched. `evidence_checked: true`;
`cold_implementer_executable: true`; verdict: **accepted**, zero comments.

Convergence is reached: both independent reviewers accepted the same complete pinned r8 SHA with no
material comments. Earlier-round verdicts remain historical and do not carry forward.
