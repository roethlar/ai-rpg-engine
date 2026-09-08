# Dispatch Persistence Race

The offline gameplay-isolation correction found an existing diagnostic race:
`local-guard.mjs` checked cancellation and time, then awaited report persistence,
then invoked transport without rechecking. A deadline or stop during that await
could reach transport with a newly clamped one-millisecond timeout.

The guard now rechecks enabled state, permanent cancellation and the original
deadline immediately before transport. It preserves the reserved ledger entry;
stopping never refunds a request or creates a fresh allowance.

`test-local-guard.mjs` pauses persistence and then expires the deadline, aborts,
does both, or disables inference. Every case refuses and records the refusal,
with one reserved entry and zero generation transports. Removing only the final
recheck failed the expected rejection; restoration and the focused suite passed.
The test uses a fake transport and makes no network or model request.

Final `node test.js`, `npm run test:browser` and all six gameplay diagnostic suites
also passed under inherited offline fetch protection on 2026-09-08. This is a
diagnostic safety correction, not a production gameplay or local-model result.
