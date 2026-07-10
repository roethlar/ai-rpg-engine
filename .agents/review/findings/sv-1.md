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
(pending)
