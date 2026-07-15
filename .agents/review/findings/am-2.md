# am-2: live provider model catalogs

**Severity**: HIGH — without bounded, authenticated discovery the admin must guess model ids, while
an unsafe implementation could leak credentials or let stored/request endpoints bypass production
network policy.
**Status**: Merged (`5103f46`)
**Branch**: `feat/am-2-provider-catalogs`
**Implementation commits**: `619b83821cc93f5f812b548cd1ebc65c9eaf39d0`,
`05781156a5fed97f3f406d0e81204254a905d52d`

## Evidence

- `plan.md:1678-1738` requires live catalogs for six network providers, safe Claude Code status,
  bounded/redacted errors, shared SSRF policy, and exact credential/endpoint precedence.
- At base `1a62848805ee56941365f73ecc55ee8fb0750361`, the server has no
  `POST /api/admin/models/catalog` route or provider response parsers.
- At that base, `AIClient` owns production endpoint provenance internally, so a separate catalog
  implementation could drift and accept request/stored custom or Ollama endpoints in production.

## Predicted observable failure

The admin cannot discover current provider model ids or safely report whether Claude Code is
installed and subscription-authenticated. A naive route could expose keys through URLs/errors,
accept a custom-key override from a different provider entry, fetch attacker-selected endpoints, or
silently treat malformed upstream data as a valid empty catalog.

## What

Add a provider catalog module and an admin-authenticated catalog route. Resolve unsaved, per-model,
stored-provider, and environment credentials in order; share runtime endpoint provenance and SSRF
validation; and expose only sanitized Claude Code install/login/plan status without probing models or
consuming generation usage.

## Approach

`model-catalog.js` pins official endpoints, parses and normalizes each provider response, derives a
custom `/models` URL only from the full `/chat/completions` contract, applies a ten-second bound, and
returns redacted controlled failures. Custom and Ollama URLs reuse exported SSRF checks from
`api-client.js`.

`resolveAiEndpointPolicy` gives `AIClient` and the catalog one production provenance rule.
`resolveModelCatalogRequest` validates provider/entry ownership before fetch and implements the
credential/endpoint precedence. `getClaudeCodeStatus` runs only version and auth-status commands in
an isolated temporary directory and whitelists the five response fields again at the catalog
boundary.

## Files changed

- `model-catalog.js` — provider parsers, pinned requests, URL derivation, timeout, and redaction.
- `api-client.js` — exported SSRF seams and shared endpoint-provenance helper used by `AIClient`.
- `claude-code-provider.js` — usage-free, sanitized installed/login/subscription status.
- `server.js` — request resolution and admin-authenticated catalog route.
- `test.js` — hermetic parser, transport, auth, precedence, SSRF, redaction, and status coverage.
- `.agents/review/findings/am-2.md`, `.agents/review/index.md`, `.agents/state.md` — durable status.

## Guard proof

- **RED — production endpoint provenance:** temporarily made only catalog request resolution pass a
  non-production environment into `resolveAiEndpointPolicy`, then ran `node test.js`. The production
  request/stored custom-endpoint guard failed at `test.js:1782` with HTTP 200 instead of the required
  zero-fetch HTTP 400.
- **RED — cross-provider entry ownership:** temporarily removed the provider-match predicate from
  `resolveModelCatalogRequest`, then ran `node test.js`. The spoof guard failed at `test.js:1750`
  with HTTP 200 instead of the required zero-fetch HTTP 400.
- **RED — response-body timeout:** after the direct review identified the headers/body gap,
  temporarily restored the old early `clearTimeout(timeout)` immediately after fetch resolution
  without changing the new test. `node test.js` failed at `test.js:1530` with “Missing expected
  rejection” because a body resolving after the deadline succeeded instead of returning 504.
- **GREEN restored:** restored all three production mechanisms and reran `node test.js`; every
  unit-test group completed successfully. `git diff --check` and syntax checks also passed, and the
  branch was clean at `0578115`.

The committed suite additionally covers all provider fixture shapes; Gemini generation-method
filtering; xAI ids, aliases, and text modality; trimming/deduplication/sorting; malformed success
bodies; pinned URLs and auth headers; timeout and error redaction; invalid custom URL and SSRF
zero-fetch behavior; request → matching entry → stored provider → environment credential precedence;
production request/stored endpoint discard; shared Ollama localhost default; admin-only access; and
safe Claude Code status with no model fetch or generation. No real provider or Claude account is
called.

## Coder dispute (if any)

None.

## Known gaps

- `am-3` owns the compact provider/model/role UI, v2 settings HTTP cutover, and browser guard.
- Claude Code model ids remain manual because the installed CLI has no documented machine-readable
  catalog. This slice reports safe account status only.
- Live provider calls were not run; automated coverage uses injected hermetic transports and does
  not require credentials or consume provider usage.

## Reviewer comments

### Attempt 1 — invalid harness execution (Claude Code 2.1.210 / Claude Fable 5)

- **Timestamp**: 2026-07-15T19:54:52Z
- **reviewed_sha**: `2c72907d91204f4c9b0427330639989eaac0eb4e` · **base_sha**:
  `1a62848805ee56941365f73ecc55ee8fb0750361` · **guard_confirmed**: `false`
- **verdict**: `invalid`

The exact `--model claude-fable-5` dispatch used safe mode, a fresh disposable detached worktree,
test-execution permission, a 20-minute process bound, and a schema pinned to both SHAs. It produced
no output envelope before `timeout` exited 124. The disposable worktree remained clean and no
partial result was interpreted as a verdict.

Per the reviewloop's fail-closed contract, this is not acceptance. One fresh dispatch will restate
the schema against the same pinned base and a new review-record head.

### Attempt 2 — invalid proxy-routed retry (Claude Code 2.1.210 / Claude Fable 5)

- **Timestamp**: 2026-07-15T20:10:52Z
- **reviewed_sha**: `15bb377449654ce417411afae0d70339717ec35c` · **base_sha**:
  `1a62848805ee56941365f73ecc55ee8fb0750361` · **guard_confirmed**: `false`
- **verdict**: `invalid`

The schema-restated retry also produced no envelope while its disposable worktree remained clean.
The owner identified the request proxy as the cause, removed it from the loop, interrupted the stale
proxy-routed process, and explicitly authorized a fresh retry. This infrastructure-invalid attempt
is not a contested code verdict and cannot count as acceptance.

### Attempt 3 — accepted with one non-blocking gap (Claude Code 2.1.210 / Claude Fable 5)

- **Timestamp**: 2026-07-15T20:17:55Z
- **reviewed_sha**: `bcfe223667f2f103d45cf54ef3452843db966a9c` · **base_sha**:
  `1a62848805ee56941365f73ecc55ee8fb0750361` · **guard_confirmed**: `true`
- **verdict**: `accepted`

The direct-route exact `--model claude-fable-5` dispatch ran the pristine full suite green and
independently removed the cross-provider ownership predicate. The suite failed at `test.js:1750`
with HTTP 200 instead of 400; Fable restored the exact bytes, reran green, and proved the worktree
clean. It also forced non-production endpoint provenance in the shared helper and observed the
existing production `baseUrl` guard fail. No real provider or Claude account was called.

The reviewer confirmed the plan's pinned endpoints/headers, strict parsers, normalization,
redaction, custom URL derivation, SSRF reuse, credential precedence, production endpoint policy,
admin boundary, and five-field usage-free Claude Code status. It identified one concrete LOW gap:
`model-catalog.js:150` clears the timeout immediately after response headers, before awaiting
`response.json()`. An upstream that sends headers and stalls its body can therefore hang the admin
request beyond the promised ten-second bound. Fable classified this as non-blocking and accepted;
the coder accepts the finding and will close it within am-2 before requesting owner merge, then
re-review the changed head.

### Attempt 4 — timeout fix accepted (Claude Code 2.1.210 / Claude Fable 5)

- **Timestamp**: 2026-07-15T20:24:51Z
- **reviewed_sha**: `678db3173353e6d2f5685ed69326566a17b5f178` · **base_sha**:
  `1a62848805ee56941365f73ecc55ee8fb0750361` · **guard_confirmed**: `true`
- **verdict**: `accepted`

The exact direct-route `--model claude-fable-5` re-review confirmed that the timer now survives
through body parsing, the body promise races abort, the listener and timer are cleaned on every
exit, late settlement cannot become an unhandled rejection, and network/upstream/invalid-response
classification and redaction remain intact.

Fable ran the pristine full suite green, independently reintroduced the early timer clear without
changing tests, and observed the stalled-body guard fail at `test.js:1530` with “Missing expected
rejection.” It restored exact bytes, reran the full suite green, and proved the detached worktree
clean. The whole-head review found no new material issue and made no real provider or Claude account
call.

**Status → Verified.** The branch is ready for the owner-gated merge. Acceptance does not authorize
merge, push, or history rewrite.

Owner go merged the accepted branch into `master` at `5103f46`. Content arrival was verified with
an empty branch-to-master diff, and `node test.js` passed on the merge result.
