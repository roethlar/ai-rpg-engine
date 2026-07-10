# sv-2: Raw internal error text reaches seats, and can carry GM-private data

**Severity**: HIGH — a malformed model response bypasses S2's whitelist and can disclose memories, NPC notes, or echoed private context to an untrusted seat.
**Status**: Open
**Branch**: `fix/sv-2-seat-error-sanitization`
**Commit**: (filled in after commit)

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
(pending)
