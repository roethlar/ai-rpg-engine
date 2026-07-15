# sv-2: Raw internal error text reaches seats, and can carry GM-private data

**Severity**: HIGH — a malformed model response bypasses S2's whitelist and can disclose memories, NPC notes, or echoed private context to an untrusted seat.
**Status**: MERGED and verified after three rounds; merge `9c8d5a8` on master.
**Branch**: deleted (was `fix/sv-2-seat-error-sanitization`)
**Commit**: `79c484a` (accepted branch tip; merge `9c8d5a8`)

## Evidence
- `server.js:436-437` — only the **successful** turn response is passed through `scopeStateForSeat`.
- `server.js:438-444` — the `catch` returns `error.message` verbatim to the client, seat or host.
- `rpg-state.js:23-35` — `parseJsonSafe` embeds the **entire** malformed response in its exception: `` `JSON parsing failed: ${error.message}. Raw text was: ${text}` ``.
- `rpg-engine.js:1588-1597` — `takeTurn` reparses the final narration output through that path.
- `rpg-engine.js:1452-1513` — the narration model receives outline, NPC, and memory context.
- `rpg-prompts.js:174-232` — its required schema contains private `memory_summary` and `npc_updates.note_update` fields.

Trigger: the final narration model emits JSON that fails to parse (a routine, if intermittent, LLM failure) while containing the private fields its own schema demands.

## Predicted observable failure
The seat receives an HTTP 500 body whose `error` string contains the raw model output — including `memory_summary` / NPC note text that `scopeStateForSeat` is specifically written to withhold. Codex reproduced the exception-embedding at HEAD with `{"memory_summary":"PRIVATE_MARKER",}` → exception text containing `PRIVATE_MARKER`.

## What
Error responses are an unscoped side channel around the S2 whitelist. Every other seat surface is whitelist-built; the error path returns whatever internal exception text exists, and one of the engine's own exceptions is built by concatenating raw model output.

## Approach
Two layers. (1) The turn route (and every seat-reachable route) must not hand a seat raw internal error text: seats receive a generic message plus the machine-readable `code` the frontend already switches on (`OUT_OF_TURN`, `CHARACTER_REQUIRED`), while the host keeps full diagnostics and the server keeps logging the detail. (2) `parseJsonSafe` stops embedding the full raw text in the thrown message — it is a debugging aid that belongs in the server log, not in an exception that can cross a trust boundary. Layer (1) is the boundary fix; layer (2) removes the payload class at the source.

## Files changed
- `rpg-state.js:8-45` — `parseJsonSafe` throws a message without the raw output; the text moves to `error.rawText` for server-side logging. No caller depended on it being in the message (verified by grep).
- `server-errors.js` (new) — `errorPayloadFor`, the trust-boundary serializer. Its own module because importing `server.js` starts a listener, which would make the guard untestable.
- `server.js` — every **seat-reachable** route (turn, campaign state, journal, seat session, narrate) serializes errors through it, and the turn handler logs `error.rawText` for the operator. Admin and `requireHost` routes are unreachable by seats and keep full diagnostics unchanged.
- `test.js` — guard tests.

## Guard proof
Both layers, proven against production code:
- Restoring `Raw text was: ${text}` in `parseJsonSafe` → FAIL: `Raw model output must not appear in the error message`.
- Removing the seat branch from `errorPayloadFor` → FAIL: `Seat gets the generic message`.

Restoring each makes the suite PASS. The tests also pin the two properties the fix must not break: hosts keep the full diagnostic message, and coded rulings (`OUT_OF_TURN`) still reach seats with their `code`, which the frontend needs to restore the typed input.

## Coder dispute (if any)
None on the exposure. Severity note: the trigger is model misbehavior, not attacker-controlled input, so exploitation is probabilistic rather than on-demand. The leak is real and the fix is cheap; HIGH retained because the consequence is private-data disclosure across a user boundary.

## Known gaps
Other seat-reachable routes (`journal`, `images`, `seat/session`) return `error.message` too. Their current throw sites are not known to embed model output, but they are the same class; the fix applies the seat-safe serializer to the seat-reachable surfaces rather than the turn route alone.

## Reviewer comments

### Round 1 — codex (codex-cli 0.144.0), 2026-07-09 UTC
- **reviewed_sha**: `ea54824` · **base_sha**: `a6b283c` · **guard_confirmed**: `true` · **verdict**: `reopened`

1. `server-errors.js:28` — Every truthy `error.code` is treated as a seat-safe ruling. An actual `SQLITE_ERROR` serialized its full internal message to a seat. Allowlist only `OUT_OF_TURN`/`CHARACTER_REQUIRED`; unknown codes and unauthenticated callers must fail closed.
2. `rpg-state.js:39` — Native `JSON.parse` messages can echo model text; the no-brace path rethrows without `rawText`. Use a fixed content-free message for every parse failure and attach the original only as `rawText`.
3. `server.js:60` — `express.json` runs before authentication and there is no terminal API error middleware, so malformed/oversized JSON reaches Express's development default handler and exposes parser stack/internal paths. Add a fail-closed 400/413 handler.
4. `rpg-engine.js:322` (also 472, 1101) — these swallowed parse failures log only `error.message`, discarding the new `rawText` and regressing operator diagnostics.
5. `server-errors.js:32` — Host turn responses omit `rawText` that was previously present in the diagnostic message. Preserve full diagnostics for explicitly authenticated hosts.

**Coder response: all five accepted, all five confirmed by execution.** Comments 1 and 2 are the serious ones and both are my own defects, not theoretical:
- I wrote `error.code ? passthrough : generic` and *called* it an allowlist. It is a truthiness check. `sqlite3` sets `code = 'SQLITE_ERROR'`; Node sets `ENOENT`. Verified: a seat received `SQLITE_ERROR: no such column: secret_vault_code`. Worse, `req.auth?.kind === 'seat'` meant an **absent** auth object fell through to the host branch — fail-open on exactly the path (a throw before auth middleware) where the credential is unknown.
- Native `JSON.parse` messages quote a snippet of their input. Verified: `Unexpected token 'P', "PRIVATE_PL"... is not valid JSON`. My round-1 fix only covered the braced path; the no-brace path rethrew the native error verbatim and carried no `rawText`.

### Round 2 — fix-up applied on the same branch

- `server-errors.js` — `SEAT_SAFE_CODES` is a real allowlist. `errorPayloadFor` fails closed: **only** `req.auth.kind === 'host'` unlocks diagnostics; seats, unknown kinds, absent auth, and an absent request object all get the generic message. Hosts regain `rawText` in the payload (comment 5).
- `server-errors.js` — new `apiErrorHandler`, registered after every route: 400 on `entity.parse.failed`, 413 on `entity.too.large`, and a content-free 500 otherwise. Closes the pre-authentication body-parser leak (comment 3).
- `rpg-state.js` — `jsonParseFailure()` gives **every** parse failure a fixed, content-free message with `rawText` attached out-of-band (comment 2).
- `rpg-engine.js:322/472/1101` — these catches now log `error.rawText` (comment 4).

**Guard proof (round 2)** — four independent sabotages, each against production code:
- allowlist → truthiness check ⇒ FAIL `An unknown error code must NOT make an internal message seat-safe`
- fail-closed → `kind !== 'seat'` ⇒ FAIL `A request with no resolved auth gets the generic message`
- no-brace path → native rethrow ⇒ FAIL `[no braces at all] error message must not quote model output`
- terminal handler → echo `err.message` ⇒ FAIL `Unknown errors never echo internals`

The parse test now sweeps every prefix of the private marker across four malformed shapes, so a partial quote (which is what the native parser emits) cannot slip through.

### Round 2 verdict — codex, 2026-07-09 UTC
- **reviewed_sha**: `81755b0` · **guard_confirmed**: `true` · **verdict**: `reopened` (3 comments)

1. `server-errors.js:45-56` — still trusts unproven string tags: an inherited or internal `code = 'OUT_OF_TURN'` exposes the internal message to a seat, while inherited `req.auth.kind = 'host'` unlocks `error` and `rawText`. Require own, server-established provenance or fixed public messages.
2. `rpg-state.js:24` — a response truncated to only an opening fence removes the sole line and dereferences `undefined.startsWith`, throwing a native `TypeError` without `rawText`.
3. `server.js:394` — host-only campaign creation still serializes only `error.message`, losing the model output that now rides on `rawText`.

**Coder response: all three accepted, all three reproduced.** Comment 1 names the conceptual error: **a code is a tag, not provenance.** I disclosed `error.message` because a string looked familiar — so any internal error carrying, or *inheriting*, that tag exposed its message. Verified all three probes: an internal SQLITE error tagged `OUT_OF_TURN` disclosed `secret_vault_code`; an inherited `code` did the same; an inherited `auth.kind = 'host'` unlocked both `error` and `rawText`.

### Round 3 — fix-up applied on the same branch

- **Disclosure is now opt-in.** `errorPayloadFor` reveals `error.publicMessage` — an **own** property the engine sets deliberately — never `error.message`. A seat-safe code alone discloses nothing. `rpg-engine.js` marks its two player-authored rulings with `publicMessage`.
- **Own-property checks** for `auth.kind` and `error.code`/`publicMessage`: an inherited tag is not a server-established credential.
- `parseJsonSafe` guards list emptiness, so a lone fence yields the fixed error shape with `rawText` rather than a native `TypeError`.
- The host campaign-creation route serializes through `errorPayloadFor` and logs `rawText`, restoring its pre-sv-2 diagnostics.

**Guard proof (round 3)** — three independent sabotages against production code:
- drop the `publicMessage` requirement => FAIL `A seat-safe code alone must not disclose an internal message`
- drop the own-property check on `auth.kind` => FAIL `An inherited auth.kind does not unlock diagnostics`
- drop the fence emptiness guard => FAIL `[lone fence] raw text preserved out-of-band`

Verified no regression: an `OUT_OF_TURN` ruling still reaches a seat with its `code` and player-facing text, which is what the frontend needs to restore the typed input.
