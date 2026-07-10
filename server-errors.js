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
 * Builds the JSON error body for a request, scoped to the caller's trust.
 *
 * Seats receive:
 *   - coded errors verbatim (OUT_OF_TURN, CHARACTER_REQUIRED, …). These are
 *     authored game rulings written for players, and the frontend switches
 *     on `code` to restore the typed input rather than showing a failure.
 *   - everything else as `genericMessage`, with the detail left in the log.
 *
 * Hosts receive the full diagnostic message, as before.
 */
export function errorPayloadFor(req, error, genericMessage) {
  if (req?.auth?.kind === 'seat') {
    return error?.code
      ? { error: error.message, code: error.code }
      : { error: genericMessage };
  }
  return { error: error?.message, code: error?.code };
}
