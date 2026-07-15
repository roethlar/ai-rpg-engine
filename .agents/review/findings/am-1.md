# am-1: Canonical model registry and Council runtime resolution

**Severity**: HIGH — the current repeated tuple shape cannot share provider credentials explicitly,
cannot select a distinct fallback per Council role, and cannot migrate to the new registry without
risking stored secrets or cross-provider inheritance.
**Status**: Verified (awaiting owner-gated merge)
**Branch**: `feat/am-1-config-runtime`
**Implementation commit**: `718de4aec14f89a65778de2ba315c335c84cf20d`

## Evidence

- `server-config.js` at base `cd00785` stores one primary, one global fallback, and five repeated
  provider/model/key tuples; it has no versioned registry, deterministic projection, or per-role
  fallback references.
- `api-client.js` at the same base copies only provider/model/key into the backup client, dropping
  custom/Ollama endpoints, and its fallback normalizer can reapply `FALLBACK_*` after role resolution.
- `/api/admin/settings` must remain on the v1 DTO until `am-3`, so storage/runtime groundwork cannot
  be coupled to the browser cutover.

## Predicted observable failure

A first canonical save can erase masked legacy secrets; a role-provider switch can inherit the wrong
provider's model/key/endpoint; complete-looking legacy tuples with blank keys can lose `ROLE_API_KEY`
or `FALLBACK_API_KEY`; and custom/Ollama backups can fail over to the wrong endpoint or no endpoint.

## What

Add canonical v2 projection, validation, masking, secret merge, and direct-save seams while retaining
the active v1 HTTP DTO/save. Resolve v1 or v2 storage through one internal Council descriptor with
provider-scoped primary/fallback selection and endpoint forwarding.

## Approach

`server-config.js` now projects v1 rows deterministically into provider connections, reusable model
entries, a migration default, and complete role assignments without reading environment secrets.
The first v2 save merges masked secrets against that projection before validation. Server-authorized
legacy markers preserve field-specific v1 precedence until a runtime field is deliberately edited.

`mergeAiConfig` retains all top-level v1 and voice/image siblings and adds a collision-free internal
`council` descriptor. `resolveAgentConfig` uses raw descriptor provenance to separate normal,
legacy, and empty assignments, gates every inherited field by effective provider, and marks resolved
fallbacks so `AIClient` cannot inject `FALLBACK_*` twice. Backup clients now receive custom/Ollama
endpoints.

## Files changed

- `server-config.js` — v2 registry/projection/validation/masking/save helpers and Council descriptor.
- `api-client.js` — Council role resolution, resolved-fallback marker, endpoint-preserving failover.
- `server.js` — typed admin validation status boundary.
- `test.js` — migration, secret, validation, isolation, endpoint, and failover guards.
- `.agents/review/findings/am-1.md`, `.agents/review/index.md`, `.agents/state.md` — durable status.

## Guard proof

- **RED (focused production mutation):** removed `merged.council = buildCouncilRuntime(adminConfig)`
  from `mergeAiConfig`, then ran `AI_RETRY_BACKOFF_MS=10 node test.js`. The suite failed in
  `testAdminModelRegistryV2` at “setup effective config survives first canonical rewrite”: the v1
  result retained the legacy fallback while the rewritten v2 result lost it.
- **GREEN restored:** restored the Council handoff and reran `AI_RETRY_BACKOFF_MS=10 node test.js`;
  every unit-test group completed successfully.

Committed guards also cover deterministic ids, exact masked secret absence, first-save projected
secret retention, independent keep/replace/clear, legacy-marker authorization/clearing, bounds and
dangling references, role/default/fallback precedence, provider isolation, shared and custom keys,
custom/Ollama primary and fallback endpoints, endpoint env precedence, typed 400/500 mapping,
wrong-key double-injection, null revival, and actual backup Authorization/endpoint forwarding.

## Coder dispute (if any)

None.

## Known gaps

- `am-2` owns live provider catalogs and is not included.
- `am-3` owns the compact module UI and v2 HTTP activation. The existing `/admin` page deliberately
  continues to receive and save the v1 DTO on this branch.

## Reviewer comments

### Verdict — Claude (Claude Code 2.1.210 / claude-opus-4-8), 2026-07-15 UTC

- **reviewed_sha**: `80c21434b80178520d3a176ff560716789895f4c` · **base_sha**:
  `cd00785fc214025db634f5118d9e17667a39dffe` · **guard_confirmed**: `true`
- **verdict**: `accepted`

The reviewer inspected the complete pinned diff and the accepted `am-*` contract, then used a
disposable detached worktree for an independent proof. The reviewed head passed the full suite; the
focused removal of the Council handoff failed in the registry/migration guard; restoration returned
the full suite to green. It reported no material correctness, security, compatibility, test-quality,
or scope issue and removed its worktree before returning.

**Status → Verified.** The branch is ready for the owner-gated merge. Acceptance does not authorize
merge, push, or history rewrite.
