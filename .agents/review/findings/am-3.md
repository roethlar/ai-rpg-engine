# am-3: compact admin model registry UI and v2 cutover

**Severity**: HIGH — the legacy form repeats provider/model/key tuples, cannot safely express shared
credentials with per-model overrides, and cannot assign reusable primary/fallback models per Council
role.
**Status**: In progress (pending independent review)
**Branch**: `feat/am-3-admin-model-registry-ui`
**Implementation commit**: `93a91e8c1d2e8e957b6dbf9391490c416338957b`

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

## Coder dispute (if any)

None.

## Known gaps

- Catalog transports are covered with intercepted/injected responses. No real provider catalog,
  billable generation, or Claude Code campaign request was made.
- The in-app browser skill could not attach because this session had no browser instance. The
  headless Playwright workflow rendered and exercised desktop/mobile behavior, but no separate
  human-visible screenshot inspection was completed.

## Reviewer comments

Pending exact `--model claude-fable-5` independent review.
