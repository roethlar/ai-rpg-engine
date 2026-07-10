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
| sv-1 | HIGH | Released/stale seat context acts as the sole remaining player's character | `[x]` merged | `fix/sv-1-revoke-seat-on-release` |
| sv-2 | HIGH | Internal error text (incl. raw model output) reaches a seat through error bodies | `[~]` | `fix/sv-2-seat-error-sanitization` |
| sv-3 | LOW | A `seat_`-prefixed host secret locks the host out of the browser UI | `[x]` merged | `fix/sv-3-seat-token-shape` |
| sv-4 | LOW | Seat payload leaks the act index — and any nested value — inside `currentQuest` | `[x]` merged | `fix/sv-4-scope-current-quest` |
| sv-5 | LOW | An 81–120-char tone 400s and kills the rest of a seat's turn narration | `[x]` merged | `fix/sv-5-tone-bound` |
| sv-6 | LOW | `state.md` asserts both "S2 landed" and "S2 never landed" | `[x]` merged | `fix/sv-6-state-contradictions` |

Merge state (2026-07-09): five of six merged to master on the owner's explicit
go ("is the merged code something we were going to want to merge anyway? if so,
keep it"). sv-2 is HELD until its round-2 verdict returns — it is a HIGH
finding still under re-review. Master live-smoked after the merges: no leak
markers in a seat payload, and a released character's seat token returns 401.

**Reopen rounds — the loop earning its keep.** Four of six findings were
reopened by the reviewer, and every reopen named a real defect the coder missed:

- **sv-1** (`dd0d895` → reopened → accepted at `b5d3a81`): a TOCTOU race.
  `authenticate` captures the seat's character id, then the request awaits the
  config lookup and campaign queue. A release landing in that window leaves an
  *already-authorized* context whose character is gone, and `takeTurn`'s
  `party.length === 1` fast path re-bound it to the sole survivor. Revoking a
  credential cannot close that — only refusing to re-bind can. Reproduced by
  execution; fixed at the root (`selectSpeakingCharacter`).
- **sv-2** (`ea54824` → reopened, 5 comments; fix-up at `81755b0`): the
  "allowlist" was a truthiness check on `error.code`, and `sqlite3` sets `code` —
  a seat received `SQLITE_ERROR: no such column: …`. Testing `kind === 'seat'`
  also meant an *absent* auth object fell through to the host branch: fail-open
  exactly where the credential is unknown. Native `JSON.parse` messages quote
  their input, so the no-brace path leaked model text verbatim. And
  `express.json` throws before authentication with no terminal handler.
- **sv-4** (`ef94856` → reopened; fix-up at `9fb7ed6`): whitelisting property
  *names* is not whitelisting. A permitted name holds an arbitrary value, and
  `validateCampaignBundle` preserved adversarial `quest_update` shapes that
  `getCampaignState` promotes into `currentQuest`. Fixed at both ends.
- **sv-6** (`5cb0cc9` → reopened; fix-up at `731d3c5`): the fix for documentation
  drift *contained* documentation drift — it asserted the hermetic-suite property
  from a sibling branch (`fix/sv-1-*`, not an ancestor) as though it held there.

Two guards were caught being **vacuous** during the work (tests that duplicated
the logic instead of calling it, so reverting the fix could not fail them) and
were rewritten against the production functions (`findLiveSeat`,
`boundVoiceDirective`). Enabling change from sv-1: `RPG_DB_PATH` makes the suite
hermetic — it had been opening the operator's real campaign database.

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
