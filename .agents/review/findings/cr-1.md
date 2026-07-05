# cr-1: Released browser can silently reclaim the remaining player's character

**Severity**: HIGH — a browser can end up submitting turns as another player's character with no explicit claim.
**Status**: Verified
**Branch**: `fix/cr-1-claim-tombstone`
**Commit**: `1748304`

## Evidence
`public/app.js:982-999`. Condition: this browser's stored character id is no
longer in `gameState.party` (their character was released) and one member
remains. First resolve removes the stale key (`localStorage.removeItem`,
app.js:995); the next render/poll sees `storedRaw` empty, so the
`!storedRaw && party.length === 1` auto-claim fires and persists the OTHER
player's character id. Submits then send that `characterId`.

## Predicted observable failure
In a two-character campaign, release character A; A's browser drops identity
for one render, then on the next poll silently becomes character B — able to
act and consume B's turns.

## What
The same-model review fix for identity theft (48886b6-era `resolveMyCharacter`
guard) is incomplete: clearing the stale claim recreates the "never claimed"
state the guard keys on. The tombstone lives exactly one render.

## Approach
Replace key removal with a durable tombstone: when a stored claim no longer
resolves, write the sentinel value `departed` instead of removing the key.
`Number('departed')` matches no character, and `storedRaw` stays truthy, so
the auto-claim guard holds permanently. An explicit claim (party-strip click)
or a join overwrites the tombstone with a real id.

## Files changed
- `public/app.js` — `resolveMyCharacter` stale-claim branch

## Guard proof
`public/app.js` is a browser script outside the node suite (no exports, DOM +
localStorage dependencies), so this is covered by a manual check, not a unit
test: `.agents/review/checks/cr-1-guard.mjs` — DOM-free simulation of the resolve sequence (stale claim →
resolve → resolve again) executed via node with localStorage/document stubs,
confirming no auto-claim occurs after the tombstone. Reverting the fix makes
the second resolve claim the remaining member; with the fix it stays null.

## Coder dispute (if any)
None — the finding is correct; it is a hole in my own earlier fix.

## Known gaps
The tombstone is per-campaign localStorage; clearing browser storage clears it
(acceptable: that genuinely is a fresh browser).

## Reviewer comments
- Reviewer: codex (codex-cli 0.142.5, model gpt-5.5) — 2026-07-05T11:40Z
- Reviewed SHA `1748304961dd42c7cf76a07b961c499ae0aa016a`, base `39637074e46816cf7f80627e1051b0dbd10756cc`
- guard_confirmed: true — reviewer independently ran the check in its own /tmp worktree: head PASS/exit 0, base FAIL/exit 1, worktree removed
- Verdict: **accepted** (awaiting owner-gated merge)
- Comments: fix closes the root failure (tombstone instead of removal keeps the auto-claim path blocked until explicit claim/join); runtime change limited to public/app.js plus the declared guard check.
