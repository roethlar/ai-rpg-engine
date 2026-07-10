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

### Round 1 — codex (codex-cli 0.144.0), 2026-07-09 UTC
- **reviewed_sha**: `5cb0cc9` · **base_sha**: `a6b283c` · **guard_confirmed**: `false` (docs-only; correctly reported as such, and the suite passed at the reviewed head) · **verdict**: `reopened`

1. `.agents/state.md:72` — the new hermetic-suite claim is false at this SHA: `test.js` never sets `RPG_DB_PATH` and `db.js` still opens `data/rpg_engine.db`. The redirect exists only on non-ancestor `sv-1` commits.
2. `.agents/state.md:45` — "NO scheduled close" contradicts lines 50–51 and `.agents/decisions.md`, which designate the remote playtest as the pending feel-gate close point.
3. `.agents/state.md:11` — S2 closes the successful full-state read, but the categorical language overstates this head: active `sv-2` still exposes private model text through seat error bodies, and `sv-4` exposes `current_act`.
4. `.agents/state.md:94` — the gitignored dev-DB enumeration ("two characters", campaigns 1–4) is a rot-prone machine-local count.
5. Docs-only: no automated red/green guard exists, so `guard_confirmed` is false.
6. Cleanup: a prunable `sv-6-review` worktree entry remained.

**Coder response: all accepted.** Comment 1 is the sharpest and is precisely the failure this finding exists to fix, committed *inside the fix for it*: I documented a fact that is true on a **sibling branch** (`fix/sv-1-*`, not an ancestor) as though it were true here. Verified: `grep RPG_DB_PATH` returns nothing on this branch, and `git merge-base --is-ancestor` confirms sv-1 is not in its history. Comment 3 is the same class — I wrote a categorical closure claim while two leaks I had *myself just found* were still unmerged.

### Round 2 — fix-up applied on the same branch

- Comment 1 — the hermetic claim now carries an explicit `CAVEAT as of 2c3e131` stating the suite **does** open the dev DB at this head, and that the redirect lands only when `fix/sv-1-*` does.
- Comment 2 — the feel gates now name the remote playtest as their scheduled close, matching `## Next` and the 2026-07-09 decision.
- Comment 3 — the S2 claim is scoped to the successful-response path, and names sv-2/sv-4 as unmerged residual leaks.
- Comment 4 — the dev-DB enumeration is replaced by a machine-local pointer ("ask sqlite rather than trusting a list here").
- Comment 6 — `git worktree prune` run.
- Additionally, on the same principle: the "21 findings / 4-of-4 verified" review counts were copies of an enumeration `.agents/review/index.md` owns. Replaced with a pointer, per the one-canonical-location invariant.

**Guard proof:** docs-only, so none is possible (`guard_confirmed=false`, as the reviewer correctly reported). Every corrected claim was instead re-derived from evidence at fix time: `grep RPG_DB_PATH`, `git merge-base --is-ancestor`, `git ls-remote`, a README scan for stale shared-token phrasing (0 hits, 4 seat-token mentions), fixture existence, and a self-contradiction sweep that now returns nothing.
