# sv-6: `.agents/state.md` carries contradictory pre-S2 facts

**Severity**: LOW — runtime unaffected, but the repo's mandated current-state entry point asserts mutually exclusive facts, which is exactly the failure `AGENTS.md` forbids.
**Status**: Open
**Branch**: `fix/sv-6-state-contradictions`
**Commit**: (filled in after commit)

## Evidence
At committed HEAD `0a8d712`:
- `.agents/state.md:8-20` says S2/S3 landed; `.agents/state.md:23-28` still says "S2 never landed, so a seat token … can still READ full campaign state (outline, NPC notes, memories) from the API."
- `.agents/state.md` "Active Sources" and "Unrecorded Repo Memory" say the README still describes the parked shared-token flow — contradicting `README.md:91-107`, rewritten to the seat flow in `2c3e131`.
- `.agents/state.md` says the local branch is **seven** commits ahead; `git rev-list --count 9effed2..0a8d712` returns **6**.

## Predicted observable failure
A fresh session following the file's own reading order concludes that S2 must still be implemented, that the README is stale, or that seven commits await push — producing a wrong status report or duplicated work. This is the precise harm the "one immediately discoverable current-state entry point" invariant exists to prevent.

## What
The S2/S3 landing updated the leading bullets of `## Now` but left the older bullets, the Active Sources note, and the Unrecorded Repo Memory note describing the pre-S2 world. A volatile count was also written from memory instead of from `git`.

## Approach
Reconcile the stale bullets against repo evidence, per the `handoff` operator's own rule that volatile facts carry `as of <commit>` and are re-verified or dropped. Replace the hardcoded commit count with a pointer to the command that answers it, so it cannot rot again — an enumeration another source owns is pointed at, never copied.

## Files changed
- `.agents/state.md` — stale S1-era caveat, README-staleness notes, and the commit count.

## Guard proof
Docs-only; the repo's verification rule exempts docs that do not affect setup, commands, or runtime behavior. The check is evidential rather than automated: each corrected claim is re-derived from repo evidence (`git rev-list`, `README.md`, the S2 code) at fix time and cited in the commit.

## Coder dispute (if any)
None. This is my own drift, introduced in `0a8d712`, and caught by the reviewer rather than by me — worth recording as such.

## Known gaps
None.

## Reviewer comments
(pending)
