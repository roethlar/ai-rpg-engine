# sv-3: Client and server disagree on what "looks like a seat token"

**Severity**: LOW — a host secret beginning with `seat_` locks the host out of the browser UI. Downgraded from the reviewer's MEDIUM: the trigger is an operator-chosen secret that collides with the reserved prefix, not a reachable state in normal configuration.
**Status**: Open
**Branch**: `fix/sv-3-seat-token-shape`
**Commit**: (filled in after commit)

## Evidence
- `public/app.js:27-29` — `isSeatToken` classifies **any** `seat_` prefix as a seat.
- `seat-auth.js:16-18` — the server's `looksLikeSeatToken` additionally requires `length > prefix + 16`.
- `public/app.js` `bootstrapSession` — a client-classified seat boots via `/api/seat/session`.
- `server.js:569-571` — that route rejects a host credential with 403 "Seat tokens only".

Trigger: `ACCESS_SECRET=seat_1234567890abcdef` (short). Server: host. Client: seat.

## Predicted observable failure
The valid host pastes their secret, the browser bootstraps as a seat, `/api/seat/session` returns 403, and the host never reaches the campaign menu until the secret is changed.

## What
The reserved-prefix test is duplicated in two places with two different definitions. Any divergence between them puts the client and server into different modes for the same credential.

## Approach
Give the client the same shape test the server uses (prefix **and** minimum length). Real minted tokens (`seat_` + 48 hex chars) satisfy both, so behavior for genuine seats is unchanged; a short `seat_`-prefixed host secret now classifies as a host on both sides, which is what the server already believes.

## Files changed
- `public/app.js` — `isSeatToken` gains the length requirement, mirroring `seat-auth.js`.

## Guard proof
Frontend-only, and `public/app.js` is not under the unit suite. Manual check: with `ACCESS_SECRET=seat_1234567890abcdef` the host reaches the campaign menu (before the fix: seat-load error). Stated rather than automated — the repo has no browser-test harness.

## Coder dispute (if any)
Severity downgraded MEDIUM → LOW, reason recorded above. The defect is real; its reachability requires a pathological operator secret.

## Known gaps
The duplication itself remains (browser code cannot import the server module without a bundler). The two definitions are now identical and cross-referenced by comment.

## Reviewer comments
(pending)
