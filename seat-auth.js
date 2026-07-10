/**
 * Seat credentials (Phase S1, decision 2026-07-05): a seat is the smallest
 * thing that makes two players DISTINCT USERS — one revocable token bound
 * server-side to one character. Tokens are shown once at mint time and only
 * their SHA-256 hash is stored; the speaking character derives from the
 * credential, so there is no client-supplied identity left to spoof.
 */
import crypto from 'crypto';
import * as db from './db.js';

const SEAT_TOKEN_PREFIX = 'seat_';

export function mintSeatToken() {
  return SEAT_TOKEN_PREFIX + crypto.randomBytes(24).toString('hex');
}

export function looksLikeSeatToken(token) {
  return typeof token === 'string' && token.startsWith(SEAT_TOKEN_PREFIX) && token.length > SEAT_TOKEN_PREFIX.length + 16;
}

export function hashSeatToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

/**
 * The single definition of a LIVE seat, used by request authentication.
 * A seat is live only while (1) its token is not revoked AND (2) the
 * character it binds to is still an active party member (sv-1). Releasing a
 * character revokes its seat, but the join is the backstop: an orphaned
 * credential must never survive, because takeTurn's single-character fast
 * path would re-bind it to whoever remains at the table — letting a departed
 * player act as another one. Returns the seat row, or undefined.
 */
export function findLiveSeat(tokenHash) {
  return db.get(
    `SELECT seats.* FROM seats
       JOIN characters ON characters.id = seats.character_id
      WHERE seats.token_hash = ?
        AND seats.revoked_at IS NULL
        AND COALESCE(characters.status, 'active') = 'active'`,
    [tokenHash]
  );
}
