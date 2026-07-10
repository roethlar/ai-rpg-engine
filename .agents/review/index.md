# Review status

Workflow: see `.agents/playbooks/reviewloop.md`.
Per-finding detail: see `.agents/review/findings/<id>.md`.

## Active loop (started 2026-07-09, reviewer: codex)

Cross-model review of the landed S2/S3 seat-visibility work, pinned range
`9effed2..0a8d712` (S2 server scoping 5595071, S2/S3 frontend a7d0f73,
README 2c3e131, plus decision/state docs). Intake dispatched to codex
(codex-cli 0.144.0, read-only sandbox, structured-output schema); findings
triaged below when it returns. Finding ids: `sv-*` (seat visibility).

### Findings (sv-*)

| ID | Severity | Impact (one line) | Status | Branch |
|----|----------|-------------------|--------|--------|
| sv-1 | HIGH | Released/stale seat context acts as the sole remaining player's character | `[~]` | `fix/sv-1-revoke-seat-on-release` |
| sv-2 | HIGH | Malformed model output reaches a seat verbatim in a 500 body, carrying private context | `[~]` | `fix/sv-2-seat-error-sanitization` |
| sv-3 | LOW | A `seat_`-prefixed host secret locks the host out of the browser UI | `[~]` | `fix/sv-3-seat-token-shape` |
| sv-4 | LOW | Seat payload leaks the act index nested inside `currentQuest` | `[~]` | `fix/sv-4-scope-current-quest` |
| sv-5 | LOW | An 81–120-char tone 400s and kills the rest of a seat's turn narration | `[~]` | `fix/sv-5-tone-bound` |
| sv-6 | LOW | `state.md` asserts both "S2 landed" and "S2 never landed" | `[~]` | `fix/sv-6-state-contradictions` |

Reopen rounds: **sv-1 round 1 → `reopened`** at `dd0d895` (codex, guard_confirmed). The
reviewer found a TOCTOU race the coder missed: `authenticate` captures the seat's
character id, then the request awaits the config lookup and campaign queue, so a
release landing in that window leaves an already-authorized context whose character
is gone — and `takeTurn`'s `party.length === 1` fast path re-bound it to the sole
survivor. Revoking a credential cannot close that; only refusing to re-bind can.
Accepted in full, reproduced by execution, fixed at the root (`selectSpeakingCharacter`)
at `b5d3a81`. Round 2 verdicts pending for all six.

Intake result: codex (codex-cli 0.144.0, read-only sandbox, structured
output) returned 6 candidates against `9effed2..0a8d712`; **6 admitted, 0
declined** — every candidate carried file:line evidence and a predicted
observable failure, each re-verified against code at HEAD before admission.
sv-1 was additionally reproduced by execution in an isolated copy of the
repo. sv-3 downgraded MEDIUM → LOW (reason in its finding doc); all other
severities accepted as reported. Four of the six are defects in the S2/S3
work this same session produced, including sv-6, which is drift the coder
introduced and the reviewer caught.

---

## Closed loop (2026-07-05, reviewer: codex)

Cross-model review of the
2026-07-04 queue implementation batch, pinned range `f9ecbd8..6c372c0`
(multiplayer M1–M4, V5 gap closers, Phase D dials, Phase H holodeck, Phase P
portability, plus the 21 same-model review fixes). Intake pass dispatched to
codex; findings triaged below.

## Legend
- `[ ]` Admitted, open (passed intake triage; not yet started)
- `[~]` In progress / pending review
- `[x]` Verified (awaiting owner-gated merge)
- `[!]` Contested — declined, disputed, or ruled invalid; awaiting owner adjudication
- `[-]` Declined at intake (kept for the record; no work)

## Findings

| ID | Severity | Impact (one line) | Status | Branch |
|----|----------|-------------------|--------|--------|
| cr-1 | HIGH | Released browser silently becomes another player's character on the next poll | `[x]` | `fix/cr-1-claim-tombstone` |
| cr-2 | MEDIUM | Campaign-card profile release reverts on restart, minting duplicate checked-out profiles | `[x]` | `fix/cr-2-backfill-once` |
| cr-3 | MEDIUM | Denied actions inflate pacing cadence, licensing GM encounters early | `[x]` | `fix/cr-3-cadence-resolved` |
| cr-4 | MEDIUM | Hostile bundle field shapes crash the imported campaign's UI | `[x]` | `fix/cr-4-record-field-shapes` |

Intake pass result: codex (gpt-5.5, xhigh) returned 4 candidates against
`f9ecbd8..6c372c0`; all 4 admitted (evidence verified against code at HEAD),
0 declined. Three are gaps in the prior same-model review's own fixes.

Loop worked to completion 2026-07-05: 4/4 verified (cr-4 via one reopen
round — the reviewer found a sibling crash path, fixed and re-accepted).
CLOSED: all four branches merged to master on the owner's explicit go
(merge commits eb5bec3/57c2451/d8fbab0/6123dff), content-verified on master,
branches deleted after verification. Verdict trail lives in each finding doc.
