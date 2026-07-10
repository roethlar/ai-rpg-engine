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
Root cause: the credential outlives the character's active membership. `releaseCharacter` revokes the character's seat in the same write transaction as the release, so a released character has no live credential. Defense in depth: `authenticate` rejects a seat whose bound character is no longer active, closing any other path that might release a character without going through `releaseCharacter` (e.g. a direct status change, an import, a future route).

## Files changed
- `rpg-engine.js` — `releaseCharacter` revokes seats for the released character inside the existing transaction.
- `server.js` — `authenticate` requires the seat's character to still be active.
- `test.js` — guard test.

## Guard proof
`test.js` seat-visibility group: a released character's seat must not authenticate, and the seat→character binding must not fall through to another character. Reverting either fix makes the assertion FAIL; restoring makes it PASS.

## Coder dispute (if any)
None. Confirmed by execution.

## Known gaps
The campaign-scoped `releaseCampaignCharacters` (whole-party release / campaign end) is a different path; seats are cascade-deleted with the campaign row, and a released *party* leaves no remaining character to impersonate. Covered by the `authenticate` guard regardless.

## Reviewer comments
(pending)
