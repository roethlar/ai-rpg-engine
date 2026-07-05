# cr-2: Profile release is undone by startup backfill

**Severity**: MEDIUM — a user-visible release silently reverts on restart and mints duplicate checked-out profiles.
**Status**: Verified
**Branch**: `fix/cr-2-backfill-once`
**Commit**: `05c4d67`

## Evidence
Campaign-card release (`server.js` release-character route →
`releaseCampaignCharacters(..., {detachCampaign: true})`,
rpg-engine.js) frees the profile and NULLs `characters.player_character_id`
while the row stays `active` (deliberate: the campaign snapshot remains
playable). On next startup the orphan backfill (db.js:258+) selects every
active row with a NULL profile link and mints a fresh `checked_out` profile,
re-locking what the user just released. The prior fix (status filter) only
covers per-character release, not campaign-card detach.

## Predicted observable failure
Release a character profile from a campaign card, restart the server, open
the character list: a duplicate profile exists, checked out to the campaign
that was just released.

## What
The backfill is a one-time migration for pre-profile-era rows, but it runs on
every startup and cannot distinguish a legacy orphan from a deliberate
detach.

## Approach
Make the migration one-shot: guard it with a `server_settings` flag
(`character_profile_backfill_done`), set after the first successful run.
Legacy databases still get backfilled on their first post-upgrade boot;
deliberate NULL links stay NULL forever after.

## Files changed
- `db.js` — backfill wrapped in a settings-flag guard

## Guard proof
Live DB check (suite has no DB harness — documented manual check): on a
scratch copy of the dev DB, detach a character's profile link, run initDb
twice; with the fix the profile count is stable, with the guard removed a
duplicate appears on the second run.

## Coder dispute (if any)
None. Note: the backfill/detach interaction predates this batch, but the
batch's status-column fix changed the semantics around it and left this path
open — in scope.

## Known gaps
If a legacy DB is restored from backup AFTER the flag is set in a different
data dir, the flag travels with the DB (it is in server_settings), so this
stays correct.

## Reviewer comments
- Reviewer: codex (codex-cli 0.142.5, gpt-5.5) — 2026-07-05T11:47Z
- Reviewed SHA `05c4d67598a6672e9ea111a9ee26d9636cb95628`, base `e061199f2dfe414d4a12ee42a28e982790dcfeea`
- guard_confirmed: true — reviewer ran both proof directions itself (fix PASS 0->0; base FAIL 1->2). Main .git/worktrees was read-only under its sandbox, so it used a disposable bare clone under /tmp for its two worktrees, then removed everything.
- Verdict: **accepted** (awaiting owner-gated merge)
- Comments: root cause closed (flag read precedes backfill; legacy first-boot path preserved; flag set after the single run).
