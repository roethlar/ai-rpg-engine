# Local Gameplay Pilot

Authority, scope, role assignments and stopping rules belong to
`../class-gameplay-verification-plan.md`. This is a diagnostic runner, not a new
game path or an automatic benchmark queue. No production code is changed.

**The authorized pilot has stopped.** [Results](results.md) preserve its failure.
The [correction plan](../class-gameplay-correction-plan.md) owns the now-completed
offline fixes and regression evidence. The owner has now authorized exactly one
corrected live rerun under that plan's explicit limits, not repeated executions.
Pass native commands directly through PTK; it already
handles RTK routing/compression, so do not nest an `rtk` invocation.

`node .agents/review/class-gameplay-verification/run.mjs --prepare` creates and
checks the authored fixtures in a new system-temporary SQLite store while all
fetch is denied. It generates no model responses. Application imports occur
only after the temporary database path is selected.

`node .agents/review/class-gameplay-verification/run.mjs --run` executes the
owner-selected local pilot. It is not authorized for repeated independent runs:
the plan's one whole-run allowance is 60 generation dispatches, eight player
submissions and 20 minutes. No automatic resume or extra allowance is provided.
Do not preload `offline-preload.mjs` for this live command; that separate guard
intentionally denies Ollama.

The live guard pins both local model digests, refuses cloud aliases, changed
identities, wrong roles, other endpoints, downloads and redirects, and counts
before every dispatch. Role calls are serial and may not have a fallback.
Chromium requests are restricted to the ephemeral test application's origin.
These are diagnostic fetch/provider boundaries, not OS-level process isolation.

Reports retain prompts, exact local responses, usage when reported, mechanical
snapshots, browser text, desktop/mobile screenshots and campaign exports in the
reported temporary artifact directory. The owner database and admin settings
are never used. The runner closes its server/browser/database, leaving its own
artifacts available for inspection. `pilot_observed` means execution ended; it
is not an automatic gameplay pass or evidence of human enjoyment.

Browser request failures are recorded, abort the pending local transport and
prohibit additional inference. Final snapshots wait for application handlers to
settle, including after a disconnected socket; unsettled state is labeled rather
than guessed. Narrative comparison uses the same sanitized Markdown rendering as
the application. `test-runner-support.mjs` exercises these paths with only local
HTTP/browser fixtures; `test-local-guard.mjs` uses fake generation counters.

## Preparation Verification (2026-09-08)

- Local guard fake transport test passed: disabled execution, wrong endpoint,
  path, model and role, missing/remote model, changed digest, deadline and cap.
  Removing the enablement assertion made the test fail with a missing expected
  rejection; restoring it passed. No real network was involved in that proof.
- `run.mjs --prepare` passed: Catalyst had four authored setup responses;
  Ritual had 53 authored responses, nine actual earned advancements and an
  actual profile copy. Zero provider calls or dispatches escaped those fixtures.
- `node test.js` and `npm run test:browser` passed under inherited offline fetch
  protection. Browser checks reported 366 theme assertions and zero failures;
  creator/transport/experience checks passed at desktop/mobile sizes. The
  preload's port-guard mutation failed as expected and was restored green.
- `node --check` and `git diff --check` passed for diagnostic preparation.

`coverage.md` owns the all-package mechanical coverage inventory. The eventual
pilot report must distinguish observed gameplay failures from scenario/budget
limits and from this provider-stubbed evidence.
