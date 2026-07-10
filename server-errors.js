/**
 * Trust-boundary error serialization (sv-2).
 *
 * Seats are untrusted remote players. Internal error text must not reach
 * them: engine exceptions can embed raw model output, and the Council roles
 * that produce it are fed the GM's private record (outline, NPC notes,
 * memories) while their schemas require private fields (memory_summary,
 * npc_updates.note_update). An unsanitized error body is therefore an
 * unscoped side channel straight around `scopeStateForSeat`.
 *
 * Lives in its own module so the boundary can be unit-tested — importing
 * server.js would start a listener.
 */

/**
 * Error codes whose MESSAGES are authored for players and safe to disclose.
 * This is an ALLOWLIST, not a truthiness check (sv-2 round 2): `error.code`
 * is also set by libraries — sqlite3 raises `SQLITE_ERROR`, Node raises
 * `ENOENT`/`ECONNREFUSED` — and those messages carry schema, filesystem, and
 * connection internals. Anything not named here is an internal error.
 *
 * `CHARACTER_NOT_AT_TABLE` is listed for when sv-1 lands: it tells a player
 * their character left the table, which is their own situation, not a secret.
 */
const SEAT_SAFE_CODES = new Set([
  'OUT_OF_TURN',
  'CHARACTER_REQUIRED',
  'CHARACTER_NOT_AT_TABLE'
]);

/** Own-property test: an inherited tag is not provenance (sv-2 round 2). */
function ownString(obj, key) {
  return obj && Object.prototype.hasOwnProperty.call(obj, key) && typeof obj[key] === 'string'
    ? obj[key]
    : undefined;
}

/**
 * Builds the JSON error body for a request, scoped to the caller's trust.
 *
 * FAIL CLOSED: only an explicitly authenticated HOST receives diagnostics.
 * A seat, an unauthenticated caller, or a request whose auth never resolved
 * (`req.auth` absent — a throw before the auth middleware ran) all get the
 * generic message. Guessing "probably host" on an absent credential is the
 * failure mode this function exists to prevent.
 *
 * Seats additionally receive the machine-readable `code` for allowlisted
 * game rulings, because the frontend switches on it to restore the typed
 * input rather than showing a failure.
 */
export function errorPayloadFor(req, error, genericMessage) {
  // Own-property check: an inherited `kind` on a prototype is not a
  // server-established credential (sv-2 round 2, comment 1).
  const isHost = ownString(req?.auth, 'kind') === 'host';
  if (isHost) {
    // Hosts keep full diagnostics, including the raw model output that
    // parseJsonSafe carries out-of-band (restores pre-sv-2 parity).
    const payload = { error: error?.message, code: error?.code };
    if (error?.rawText) payload.rawText = error.rawText;
    return payload;
  }

  // sv-2 round 2, comment 1: a CODE IS NOT PROVENANCE. Disclosing
  // `error.message` because a string tag looks familiar means any internal
  // error that happens to carry — or inherit — that tag exposes its message.
  // Instead the engine must OPT IN per error by setting `publicMessage`, an
  // own property it authored for players. Everything else is internal.
  const code = ownString(error, 'code');
  const publicMessage = ownString(error, 'publicMessage');
  if (code && SEAT_SAFE_CODES.has(code) && publicMessage) {
    return { error: publicMessage, code };
  }
  return { error: genericMessage };
}

/**
 * Terminal Express error handler (sv-2 round 2). Body-parser errors are
 * thrown BEFORE authentication runs, and with no terminal handler Express's
 * default one replies with a stack trace outside production — leaking
 * internal paths to anyone, seat or stranger. Fail closed here instead.
 *
 * Must be registered with `app.use(...)` AFTER every route.
 */
export function apiErrorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  console.error('Unhandled API error:', err);

  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body is too large.' });
  }
  if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({ error: 'Request body is not valid JSON.' });
  }
  // Anything else is an internal error: never echo it, whoever is asking.
  return res.status(500).json({ error: 'Internal server error.' });
}
