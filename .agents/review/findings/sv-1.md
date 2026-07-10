# sv-1: Released character's seat token takes over the sole remaining character

**Severity**: HIGH — a stale seat credential crosses the per-user authorization boundary S2 exists to enforce, and mutates another player's canonical character state.
**Status**: Open
**Branch**: `fix/sv-1-revoke-seat-on-release`
**Commit**: (filled in after commit)

## Evidence
- `server.js:192-206` — `authenticate` resolves any seat whose `revoked_at IS NULL`; it never checks that the bound character is still an active party member.
- `rpg-engine.js:2116-2132` — `releaseCharacter` sets `characters.status = 'released'` and drops the character from the turn order, but never touches the `seats` table (`grep seats rpg-engine.js` → no matches).
- `rpg-engine.js:181-188` — `loadParty` excludes released rows.
- `rpg-engine.js:1440-1441` — when `party.length === 1`, `takeTurn` binds the turn to `party[0]`, **ignoring** the submitting/seat character id entirely.
- `rpg-engine.js:1641-1649`, `1824-1828` — the turn then mutates and records that character.

Trigger: a two-character campaign; the host mints a seat for A, then releases A via `POST /api/campaigns/:id/characters/:cid/release`. B is now the sole active member.

## Predicted observable failure
A's old seat token still authenticates and can `POST /api/campaigns/:id/turn` with a committed action that changes **B's** HP, inventory, abilities, and campaign progress, recorded as B.

Reproduced by execution against an isolated copy of the codebase (scratchpad `sv1-repro.mjs`, HEAD 0a8d712):

```
A seat still valid after release: true -> bound characterId: 1 (A = 1)
active party after release: 2:BobChar
seat A submits a committed turn -> engine binds it to: 2:BobChar
EXPLOIT CONFIRMED: true
```

## What
A seat credential is bound to one character, but the character's *table membership* can end without the credential ending. The engine's single-character fast path then re-binds the orphaned credential to whoever is left, so a departed player can act as a remaining one.

## Approach
Root cause: the credential outlives the character's active membership. `releaseCharacter` revokes the character's seat in the same write transaction as the release, so a released character has no live credential. Defense in depth: seat liveness (not-revoked **and** character still active) is now defined **once**, as `findLiveSeat` in `seat-auth.js`, and `authenticate` calls it — closing any other path that might deactivate a character without going through `releaseCharacter` (a direct status change, an import, a future route), and preventing the two definitions from drifting apart.

Enabling change: `db.js` honors `RPG_DB_PATH`, so the suite can exercise DB-level invariants against a throwaway file. This also fixes a latent test hazard — `test.js` already pulled in `rpg-engine.js` → `db.js`, so the suite was opening the operator's real campaign database. It is now hermetic (verified: the dev DB is byte-identical before and after a run).

## Files changed
- `rpg-engine.js:2123-2140` — `releaseCharacter` revokes the released character's seat inside the existing write transaction.
- `seat-auth.js:20-45` — new `findLiveSeat`: the single definition of a live seat, joining `characters` on active status.
- `server.js:192-206` — `authenticate` delegates to `findLiveSeat`.
- `db.js:6-16` — `RPG_DB_PATH` override.
- `test.js` — `testSeatLifecycle` + hermetic-store setup.

## Guard proof
`test.js::testSeatLifecycle`, two independent assertions, each proven against **production** code (not a duplicated copy of the query):
- Removing the revoke statement from `releaseCharacter` → FAIL: `Releasing a character revokes its seat`.
- Removing the active-character join from `findLiveSeat` (restoring the pre-fix query) → FAIL: `An un-revoked seat on a released character still must not authenticate`.

Restoring each makes the suite PASS. The original `sv1-repro.mjs` exploit script, re-run against the fixed tree, now reports `A seat still valid after release: false` / `EXPLOIT CONFIRMED: false`.

Process note: the first attempt at this guard proof duplicated the SQL inside the test, which would have been vacuous — reverting `server.js` could not have failed it. Extracting `findLiveSeat` gave the predicate one home and made the guard real.

## Coder dispute (if any)
None. Confirmed by execution.

## Known gaps
The campaign-scoped `releaseCampaignCharacters` (whole-party release / campaign end) is a different path; seats are cascade-deleted with the campaign row, and a released *party* leaves no remaining character to impersonate. Covered by the `authenticate` guard regardless.

## Reviewer comments

### Round 1 — codex (codex-cli 0.144.0), 2026-07-09 UTC
- **reviewed_sha**: `dd0d895` · **base_sha**: `a6b283c` · **guard_confirmed**: `true`
- **verdict**: `reopened`

1. `server.js:431` — Seat authorization occurs before an awaited config lookup and campaign queueing, so release at `server.js:593` can complete after authentication but before `takeTurn`. `rpg-engine.js:1440` then ignores the captured seat character ID for a one-member party and binds the request to the remaining character. An isolated probe captured Alice's live authorization, released her, then observed `takeTurn` bind her stale ID to Bob. Revalidate inside the campaign queue or reject any supplied character ID absent from the current active party.
2. `test.js:1434` — `testSeatLifecycle` non-vacuously guards both named changes, but never exercises `takeTurn` or the authenticated-before-release interleaving. Add a regression proving an in-flight stale seat context cannot act as the sole remaining character.
3. `test.js:14` — Cleanup unlinks the temporary SQLite files while `db.js:19` still holds the database open and suppresses unlink failures. On Windows this can leave the temp DB behind; close the database before unlinking and verify removal.

**Coder response (accepted, all three).** Comment 1 is correct and is the finding's true root cause: revoking on release closes the *persisted* orphan, but a request authenticated microseconds before the release still carries a live seat context, and `takeTurn`'s single-character fast path re-binds it. Both variants share one defect — the fast path discards a supplied character id. Fixing the selection logic closes the persisted path, the in-flight race, and any future path that deactivates a character, which the revoke alone could not. Reproduced the race with an isolated probe before fixing.

### Round 2 — fix-up applied on the same branch

**Approach (round 2).** The reviewer's comment 1 identified the true root cause, which round 1 treated as a symptom. `takeTurn`'s `party.length === 1` fast path *discarded a supplied character id*. Both variants of sv-1 flow from that one line:
- **persisted** — a released character's still-live token re-bound to the survivor (round 1 closed this by revoking on release);
- **in-flight (TOCTOU)** — `authenticate` captures the seat's `characterId`, then the request awaits `getServerAiConfig()` and `queueCampaignTask`. A release landing in that window leaves an *already-authorized* context whose character is gone. No amount of credential revocation closes this, because authentication has already happened. Only refusing to re-bind does.

Fix: `selectSpeakingCharacter` (exported from `rpg-engine.js`) makes a supplied character id authoritative — it must name a currently active party member, **regardless of party size**. Omitting the id remains legal only for the host's single-character solo play; seats always supply one (the server derives it from the credential), so a seat can never reach that path. A stale id now raises `CHARACTER_NOT_AT_TABLE` → HTTP 401 (the credential authenticated but its character left the table; dead, not malformed).

Also applied: comment 3 — `db.closeDb()` added, and `cleanupTestDb` now closes the connection before unlinking and **verifies** removal instead of swallowing errors (an open SQLite handle makes the unlink fail on Windows, silently leaving the temp store behind).

Reproduced the race before fixing (`sv1-race.mjs`): `RESULT: bound to -> 2:Bob` / `RACE EXPLOITABLE: true`. After: `RESULT: rejected -> CHARACTER_NOT_AT_TABLE` / `RACE EXPLOITABLE: false`.

**Guard proof (round 2)** — comment 2's requested regression, proven against the production function: restoring the `party.length === 1` fast path in `selectSpeakingCharacter` → FAIL: `A stale seat context must NOT be re-bound to the sole remaining character`. The test also pins the paths that must keep working: Bob may act as Bob, host solo play with no supplied id is unchanged, and a multi-character campaign still demands an explicit speaker.
