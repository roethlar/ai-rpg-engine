# am-cc: Claude Code subscription transport

**Severity**: HIGH — a naive Claude Code child process could consume API credentials, load repository
instructions or tools into campaign generation, or bypass the Council retry/fallback pipeline.
**Status**: Verified (awaiting owner-gated merge)
**Branch**: `feat/am-cc-claude-code-runtime`
**Implementation commit**: `abbf956a3bcc3fc299e0046e3464e75c48f28db2`

## Evidence

- `api-client.js` at base `a2ad7a7` has no `claude-code` dispatch and assigns the HTTP default
  `gpt-4o-mini` to unknown providers with a blank model.
- `server-config.js` at the same base does not recognize `claude-code`, represent its no-key
  connection, or prevent per-model custom keys.
- Running Claude Code from the repository with inherited Anthropic/cloud credentials, settings,
  tools, MCP servers, or browser access would violate the accepted subscription-only transport
  contract in `plan.md`.

## Predicted observable failure

A configured Claude Code model cannot generate Setup or Council output. An unsafe adapter could use
API billing instead of the logged-in subscription, read or mutate repository state during a model
call, leak prompts/CLI diagnostics into errors, inherit `gpt-4o-mini` for a blank model, or fail to
participate in the existing transient retry and configured fallback behavior.

## What

Add `claude-code` as a no-key canonical provider and implement an isolated child-process adapter
behind the existing `AIClient` text contract. Preserve all Setup/Council call sites, per-role model
resolution, one retry, and configured fallback selection.

## Approach

`claude-code-provider.js` resolves an optional absolute executable path, strips Anthropic API and
cloud-provider authentication, requires `claude auth status --json` to report a logged-in
`claude.ai` method, and runs print mode from an empty temporary directory. Generation uses stdin for
the prompt and a shell-free argv with tools, settings, MCP, browser, slash commands, and session
persistence disabled. Output, timeout, cleanup, parsing, and errors are bounded and sanitized.

`AIClient` supplies the reserved `default` model for blank Claude Code primary and backup clients,
dispatches the adapter, forwards its injected runner through failover, and maps numeric CLI status
through the existing retry classifier. Registry validation represents the provider as `{}`, forces
provider-login key source, and rejects stored/custom keys.

## Files changed

- `claude-code-provider.js` — isolated subscription-authenticated CLI transport and pure parsers.
- `api-client.js` — provider dispatch, blank/default model behavior, key isolation, retry/fallback wiring.
- `server-config.js` — canonical provider validation, masking, and Council resolution.
- `test.js` — hermetic child-runner, process-bound, registry, AIClient, retry, and fallback guards.
- `README.md` — environment configuration and security contract.
- `.agents/review/findings/am-cc.md`, `.agents/review/index.md`, `.agents/state.md` — durable status.

## Guard proof

- **RED — API-auth isolation:** temporarily removed `ANTHROPIC_API_KEY` from the stripped environment
  set and ran `node test.js`. The fake auth preflight detected API authentication, generation never
  began, and `testClaudeCodeProvider` failed with `SUBSCRIPTION_AUTH_REQUIRED`.
- **RED — blank-model constructor:** temporarily removed the `claude-code` default-model switch and
  ran `node test.js`. The AIClient integration assertion failed because the actual model became
  `gpt-4o-mini` instead of `default`.
- **RED — pipeline dispatch:** temporarily removed the `claude-code` branch from
  `AIClient.dispatchPrompt` and ran `node test.js`. The integration path failed with
  `Unsupported AI provider: claude-code`.
- **GREEN restored:** restored each production mechanism and reran `node test.js`; every unit-test
  group completed successfully.

The committed suite also proves absolute executable selection, case-insensitive credential
stripping with OAuth preservation, no-shell argv/stdin transport, exact isolation flags, explicit
versus blank/default model arguments, safe auth fields, API-auth rejection, timeout termination,
per-stream output bounds, temporary-directory cleanup, exit-0/exit-1 JSON parsing, 503/404
classification, error redaction, custom-key rejection, environment-only construction, stale-key
isolation, blank fallback model isolation, and both directions of retry/fallback handoff. No test
invokes the real Claude account.

## Coder dispute (if any)

None.

## Known gaps

- `am-2` owns the safe installed/login/plan status and live provider catalogs. Claude Code model
  listing remains manual because the CLI has no documented machine-readable account catalog.
- `am-3` owns the compact provider/model/role admin UI and v2 HTTP cutover. Until then, the provider
  is selected through environment configuration.
- The usage-bearing live campaign smoke was not run; it requires separate authorization to consume
  the logged-in account's allowance.

## Reviewer comments

### Attempt 1 — invalid harness execution (Claude Code 2.1.210 / Claude Fable 5)

- **Timestamp**: 2026-07-15T18:37:16Z
- **reviewed_sha**: `109988c039ed2850b415565a5e0bb364a8ceed9a` · **base_sha**:
  `a2ad7a7e33476be5c55a3028fcf9b9bd78bad8bd` · **guard_confirmed**: `false`
- **verdict**: `invalid`

The exact `--model claude-fable-5` dispatch produced a valid, SHA-matched envelope, but Claude
Code's `dontAsk` permission mode denied every attempted `node test.js`, npm test, and trivial Node
command. The reviewer therefore could not run the pristine suite or independently perform the
red/green mutation proof. It left its disposable worktree clean.

Its complete static diff review found no material code defect and explicitly classified its invalid
verdict as a harness-permission failure, not a scope disagreement or reopen. Per the fail-closed
contract, this is not acceptance. One corrected dispatch will use explicit test-execution permission
against the new pinned review-record head; no code changed after the static review.

### Attempt 2 — accepted (Claude Code 2.1.210 / Claude Fable 5)

- **Timestamp**: 2026-07-15T18:43:35Z
- **reviewed_sha**: `4e42aaf119adeced4728e28ae2a980d0e0f20f5a` · **base_sha**:
  `a2ad7a7e33476be5c55a3028fcf9b9bd78bad8bd` · **guard_confirmed**: `true`
- **verdict**: `accepted`

The corrected exact `--model claude-fable-5` dispatch used a fresh disposable worktree with test
execution enabled. The reviewer ran the pristine full suite green, independently removed the
`ANTHROPIC_API_KEY` strip and observed `SUBSCRIPTION_AUTH_REQUIRED` before generation, restored it,
then removed the Claude Code constructor default and observed actual `gpt-4o-mini` versus expected
`default`. It restored both production mutations without changing tests, reran the full suite green,
and verified a clean worktree.

The reviewer found no material correctness, security, compatibility, scope, or test-quality defect.
It confirmed subscription/API-key isolation across configuration and runtime tiers; shell-free,
stdin-only prompt transport and the complete isolation flag set; bounds, cleanup, and redaction;
blank/default plus explicit model behavior; numeric status retry classification; and both directions
of configured fallback. It noted only that a practically unreachable temporary-directory cleanup
failure would replace a successful result with a fail-closed cleanup error; no change was requested.

**Status → Verified.** The branch is ready for the owner-gated merge. Acceptance does not authorize
merge, push, or history rewrite.
