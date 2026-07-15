# am-3: compact admin model registry UI and v2 cutover

**Severity**: HIGH — the legacy form repeats provider/model/key tuples, cannot safely express shared
credentials with per-model overrides, and cannot assign reusable primary/fallback models per Council
role.
**Status**: Merged (`e75c89f`)
**Branch**: `feat/am-3-admin-model-registry-ui`
**Implementation commit**: `93a91e8c1d2e8e957b6dbf9391490c416338957b`
**Fix-up commit**: `6e05325` (legacy-safe all-key clear)

## Evidence

- `plan.md:1486-1511` requires the v2 GET/POST contract and canonical rewrite to activate atomically
  with the new module UI.
- `plan.md:1847-1852` assigns am-3 the compact provider/model/assignment interface, browser-safe
  state helper, browser guard, README flow, and observable failure.
- At base `414ccb75ea37173b79c228b16792d35ca1d44361`, `/admin` still renders seven large repeated
  provider/model/key forms and the settings route remains on the v1 wire.

## Predicted observable failure

An operator cannot configure several models that share one provider credential, give one model a
custom credential, reuse either model across Council roles, or select a separate stored fallback.
Catalog failure also leaves the operator guessing model ids, while a partial v2 cutover could expose
or erase stored credentials.

## What

Replace the repeated admin forms with compact provider connections, reusable configured-model rows,
and exactly five primary/fallback Council assignment rows. Activate the masked v2 settings GET and
validated atomic v2 POST in the same slice, while retaining editable manual model ids and the
existing voice/image settings.

## Approach

`admin/model-registry.js` owns browser-safe immutable state transitions, page-local catalogs,
assignment usage, row-level validation, and v2 payload construction. `admin/admin.js` renders the
provider/model/role tables with DOM APIs, refreshes provider catalogs through the authenticated
route, preserves fetched suggestions across a normal save, and never rehydrates secrets into the
DOM. `server.js` explicitly serves the module and atomically switches settings GET/POST to the v2
projection/save seams already introduced by am-1.

The browser harness uses a throwaway server and intercepted catalog responses to configure two
shared-key OpenAI models, one custom-key override, and one no-key Claude Code model; assign them
across roles; save/reload; and inspect requests, responses, DOM, failure recovery, and responsive
layout without contacting a real provider.

## Files changed

- `admin/admin.html` — compact 1080px table layout, responsive one-column layout, and module entry.
- `admin/admin.js` — provider/model/assignment rendering, catalog refresh, validation, and atomic save.
- `admin/model-registry.js` — pure state, validation, usage, catalog, and v2 payload helpers.
- `server.js`, `server-config.js` — explicit module route and atomic v2 settings HTTP cutover.
- `test.js` — pure UI-state and v2 HTTP persistence/secret-preservation guards.
- `test-browser.mjs` — throwaway rendered workflow with stub catalogs and secret leak checks.
- `README.md` — current provider, model, assignment, and Claude Code operator workflow.

## Guard proof

- **RED — v2 browser wire:** temporarily changed `buildRegistryPayload` to emit `configVersion: 1`
  without changing the test. `node test.js` failed at `test.js:1195` with `1 !== 2` and the message
  “The browser payload uses the v2 settings wire.”
- **RED — module delivery/render path:** temporarily moved the explicit
  `/admin/model-registry.js` route without changing the browser test. `npm run test:browser` kept the
  established theme oracle green, then failed waiting for `body.show-panel` because the module
  import could not load.
- **GREEN restored:** restored both production mechanisms and reran `node test.js` and
  `npm run test:browser`; both completed successfully, including the new admin registry guard. The
  working tree returned clean at the implementation commit.
- **RED — reopened legacy clear:** after the fix-up commit, temporarily removed only the server
  save seam's `legacySecretClearIds.add(id)` authorization. `node test.js` failed in
  `testAdminModelRegistryV2` with `modelEntries[3] requires provider and model`, reproducing the
  reviewer's partial-tuple failure. The test was unchanged.
- **GREEN fix-up restored:** restored that production line and reran `node test.js` plus
  `npm run test:browser`; both completed successfully and the working tree was clean at `6e05325`.
  The guard covers the browser payload through `prepareAdminAiConfigV2Save`, runtime role-key
  precedence for partial and complete legacy tuples, and persisted `saveAdminAiConfigV2` →
  `loadAdminAiConfig` state.

## Coder dispute (if any)

None.

## Known gaps

- Catalog transports are covered with intercepted/injected responses. No real provider catalog,
  billable generation, or Claude Code campaign request was made.
- The in-app browser skill could not attach because this session had no browser instance. The
  headless Playwright workflow rendered and exercised desktop/mobile behavior, but no separate
  human-visible screenshot inspection was completed.

## Reviewer comments

### Attempt 1 — reopened on legacy clear semantics (Claude Code 2.1.210 / Claude Fable 5)

- **Timestamp**: 2026-07-15T21:21:47Z
- **reviewed_sha**: `1363fb1eb564aef44c4d38d4f8485f3f9b6e7097` · **base_sha**:
  `414ccb75ea37173b79c228b16792d35ca1d44361` · **guard_confirmed**: `true`
- **verdict**: `reopened`

Fable reproduced one MEDIUM compatibility failure with a related LOW semantic regression. For a
migrated legacy entry that has a stored custom key but a blank provider or model,
`buildRegistryPayload({ clearKeys: true })` changes `keySource` to `provider`.
`prepareAdminAiConfigV2Save` then strips `legacyDefault` because a runtime field changed and rejects
the now-incomplete normal entry, so the atomic clear returns HTTP 400 and clears no provider,
override, voice, or image key. Sending a null custom key instead also fails validation, leaving no
valid client payload for this supported legacy shape.

For complete legacy tuples, the same key-source change silently strips `legacyDefault`, so a clear
can remove the contracted role/fallback environment-key precedence even though the operator changed
credentials only. The reviewer requires a production-side clear representation that removes stored
keys while preserving legacy tuple identity and precedence, plus a server round-trip guard rather
than the existing client-payload-only assertion.

The independent guard proof removed the assigned-usage protection in `removeModelEntry` without
editing tests. `node test.js` failed at `test.js:1174` with “Assigned entries are not removed”; Fable
restored byte-identical production code, reran green, and proved the worktree clean. The pristine
unit and browser suites were green, no live provider path was called, and the reviewer found no
other material issue in the pinned diff.

### Attempt 2 — accepted after legacy-clear fix-up (Claude Code 2.1.210 / Claude Fable 5)

- **Timestamp**: 2026-07-15T21:41:54Z
- **reviewed_sha**: `5c2aeb58af94ae05cdadc1c624130041778592de` · **base_sha**:
  `414ccb75ea37173b79c228b16792d35ca1d44361` · **guard_confirmed**: `true`
- **verdict**: `accepted`

Fable confirmed both reopen comments are closed. Partial and complete migrated custom-key rows now
send an explicit null while retaining custom provenance; the server authorizes only that
secret-to-empty delta against a matching stored legacy marker and unchanged key source. Empty custom
secrets remain invalid for normal entries, forged markers remain rejected, and any provider, model,
or key-source edit still declassifies the row. Normal custom-entry clear behavior remains the
provider-mode transition.

The reviewer verified that cleared partial rows continue through role model/key environment
precedence, complete rows continue through `ROLE_API_KEY`, all provider/entry/voice/image secrets
persist empty, and the save/load round-trip retains assignments and markers. It reran the pristine
unit and browser suites green and reassessed the whole v2 cutover/UI diff without finding another
material issue.

For independent guard proof, Fable changed only the production `preserveLegacyCustom` decision to
false. The committed regression test failed with the original
`modelEntries[3] requires provider and model` error; it restored byte-identical code, reran both
suites green, and proved the detached worktree clean. No live or billable provider path was called.

**Status → Verified.** The branch is ready for the owner-gated merge. Acceptance does not authorize
merge, push, or history rewrite.

Owner go merged the accepted branch into `master` at `e75c89f`. Content arrival was verified with
an empty branch-to-master diff; `node test.js` and `npm run test:browser` both passed on the merge
result.
