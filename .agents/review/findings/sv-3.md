# sv-3: Client and server disagree on what "looks like a seat token"

**Severity**: LOW — a host secret beginning with `seat_` locks the host out of the browser UI. Downgraded from the reviewer's MEDIUM: the trigger is an operator-chosen secret that collides with the reserved prefix, not a reachable state in normal configuration.
**Status**: Verified
**Branch**: `fix/sv-3-seat-token-shape`
**Commit**: `cf45fbc`

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
- `test.js` — cross-boundary consistency guard.

## Guard proof
The finding doc first assumed this was untestable (no browser harness). It is not: the *invariant* is that the two predicates agree, and that is testable without a browser. `test.js::testSeatAuth` now extracts `isSeatToken` from `public/app.js` source, evaluates it, and asserts it classifies a corpus of credentials **identically** to the server's `looksLikeSeatToken` — real minted tokens, a short `seat_`-prefixed host secret, boundary lengths, junk, and empty.

Reverting `public/app.js` to the prefix-only test → FAIL: `Client and server must classify "seat_1234567890abcdef…" identically`. Restoring makes it PASS. Any future divergence in either definition now fails the suite, which is a stronger guarantee than the fix itself.

## Coder dispute (if any)
Severity downgraded MEDIUM → LOW, reason recorded above. The defect is real; its reachability requires a pathological operator secret.

## Known gaps
The duplication itself remains (browser code cannot import the server module without a bundler). The two definitions are now identical and cross-referenced by comment.

## Reviewer comments

### Verdict — codex (codex-cli 0.144.0), 2026-07-09 UTC
- **reviewed_sha**: `cf45fbc` · **base_sha**: `a6b283c` · **guard_confirmed**: `true`
- **verdict**: `accepted` — the reviewer independently performed the guard proof in its own worktree (revert → FAIL, restore → PASS) and reported no comments.

**Status → Verified.** The branch is ready for an OWNER-GATED merge. Per the playbook, "accepted" records that the branch passed review; it does not authorize a merge, push, or history rewrite.
