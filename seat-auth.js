/**
 * Seat credentials (Phase S1, decision 2026-07-05): a seat is the smallest
 * thing that makes two players DISTINCT USERS — one revocable token bound
 * server-side to one character. Tokens are shown once at mint time and only
 * their SHA-256 hash is stored; the speaking character derives from the
 * credential, so there is no client-supplied identity left to spoof.
 */
import crypto from 'crypto';

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
