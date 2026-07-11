# Review status

Workflow: see `.agents/playbooks/reviewloop.md`.
Per-finding detail: see `.agents/review/findings/<id>.md`.

## Active loop (started 2026-07-11, reviewer: codex)

Owner-ordered retroactive review of the dice roll theater (code + its plan
slice, pinned range `fea8fb5..53dd6f3`) and plan review of the Phase T2
scene-dynamic theming DRAFT (working tree at `53dd6f3`). Reviewer:
codex-cli 0.144.1, read-only sandbox, structured-output schema. Context: the
dice slice was implemented without owner plan approval (process defect,
acknowledged); this review is part of its retroactive gate. Code fixes await
an owner go; merges stay owner-gated.

### Code findings (dt-* dice theater, poll-* pre-existing)

| ID | Severity | Impact (one line) | Status | Branch |
|----|----------|-------------------|--------|--------|
| dt-1 | MEDIUM | Stale roll theater renders over the menu/another campaign after a switch, intercepting input until skip/timeout | `[ ]` | |
| dt-2 | LOW | Clicking to skip turn A's dice also silently suppresses an already-queued turn B's theater | `[ ]` | |
| dt-3 | LOW | Landed die goes generic green/red, contradicting the recorded theme-follow rider (plan/code conflict) | `[ ]` | |
| poll-1 | HIGH | Pre-existing: a stale poll response renders campaign A's full state (theme incl.) over campaign B or the menu — no epoch/ownership check after await | `[ ]` | |

Intake: codex returned 3 candidates on the dice range; all 3 admitted, 0
declined. poll-1 admitted from the T2 pass's evidence (public/app.js:1223-1259,
783-793) — both passes independently hit the same root cause; it predates the
dice slice. dt-1's clean fix shares poll-1's epoch mechanism.

### Plan findings (t2-*, against the Phase T2 draft in plan.md)

| ID | Severity | Impact (one line) | Status |
|----|----------|-------------------|--------|
| t2-1 | HIGH | Draft named no persistence carrier — validators would silently discard the generated theme (NULL rows, never regenerated) | `[~]` revised |
| t2-2 | HIGH | Stale-response repaint (= poll-1) breaks scene theming; draft ignored it | `[~]` prerequisite recorded |
| t2-3 | HIGH | Draft's "export carries location rows wholesale" claim is FALSE — export/import project explicit fields; theme_json would be silently dropped | `[~]` revised |
| t2-4 | MEDIUM | Forks omit theme_json; a turn-1 fork cannot reconstruct the opening-location pointer | `[~]` revised |
| t2-5 | MEDIUM | Palette slots (primary/secondary/text/text_dim) cannot move bg/panel/border — nightclub keeps the forest background | `[~]` revised |
| t2-6 | LOW | "Once per location, first entry only" is false when final continuity rejects the entry turn | `[~]` reworded |
| t2-7 | LOW | Success criteria omitted the mandatory seat-boundary regression (sceneTheme enters the seat payload) | `[~]` revised |

Intake: codex returned 7 candidates on the T2 draft; all 7 admitted (each
verified against cited code), 0 declined. All are plan-text defects fixed by
revising the draft; `[~]` until the codex re-review of the revision accepts.

---

## Closed loop (2026-07-09, reviewer: codex)

Cross-model review of the landed S2/S3 seat-visibility work, pinned range
`9effed2..0a8d712` (S2 server scoping 5595071, S2/S3 frontend a7d0f73,
README 2c3e131, plus decision/state docs). Intake dispatched to codex
(codex-cli 0.144.0, read-only sandbox, structured-output schema); findings
triaged below when it returns. Finding ids: `sv-*` (seat visibility).

### Findings (sv-*)

| ID | Severity | Impact (one line) | Status | Branch |
|----|----------|-------------------|--------|--------|
| sv-1 | HIGH | Released/stale seat context acts as the sole remaining player's character | `[x]` merged | `fix/sv-1-revoke-seat-on-release` |
| sv-2 | HIGH | Internal error text (incl. raw model output) reaches a seat through error bodies | `[x]` merged | `fix/sv-2-seat-error-sanitization` |
| sv-3 | LOW | A `seat_`-prefixed host secret locks the host out of the browser UI | `[x]` merged | `fix/sv-3-seat-token-shape` |
| sv-4 | LOW | Seat payload leaks the act index — and any nested value — inside `currentQuest` | `[x]` merged | `fix/sv-4-scope-current-quest` |
| sv-5 | LOW | An 81–120-char tone 400s and kills the rest of a seat's turn narration | `[x]` merged | `fix/sv-5-tone-bound` |
| sv-6 | LOW | `state.md` asserts both "S2 landed" and "S2 never landed" | `[x]` merged | `fix/sv-6-state-contradictions` |

Merge state (2026-07-09): **all six merged to master** on the owner's explicit
go. Master live-smoked after the merges: no leak markers in a seat payload; a
failed turn returns a generic message (no internals); a malformed body returns
400 with no stack trace; a released character's seat token returns 401.

Rounds needed: sv-1 took 2, sv-2 took 3, sv-4 took 3, sv-6 took 2; sv-3 and
sv-5 were accepted first pass. Every reopen named a real defect. Two of the
reopens (sv-2 r2, sv-4 r2) were caught only because the fixes were themselves
re-reviewed — and two more (sv-2 r3, sv-4 r3) only because those were.

**Reopen rounds — the loop earning its keep.** Four of six findings were
reopened by the reviewer, and every reopen named a real defect the coder missed:

- **sv-1** (`dd0d895` → reopened → accepted at `b5d3a81`): a TOCTOU race.
  `authenticate` captures the seat's character id, then the request awaits the
  config lookup and campaign queue. A release landing in that window leaves an
  *already-authorized* context whose character is gone, and `takeTurn`'s
  `party.length === 1` fast path re-bound it to the sole survivor. Revoking a
  credential cannot close that — only refusing to re-bind can. Reproduced by
  execution; fixed at the root (`selectSpeakingCharacter`).
- **sv-2** (reopened twice, 8 comments total): the "allowlist" was a truthiness
  check on `error.code`, and `sqlite3` sets `code` — a seat received
  `SQLITE_ERROR: no such column: …`. Testing `kind === 'seat'` meant an *absent*
  auth object fell through to the host branch: fail-open exactly where the
  credential is unknown. Native `JSON.parse` messages quote their input.
  `express.json` throws before authentication with no terminal handler. Then, on
  re-review: **a code is a tag, not provenance** — an internal error that merely
  *carries* or *inherits* a seat-safe code still disclosed its message, and an
  inherited `auth.kind` unlocked `rawText`. Disclosure is now opt-in: the
  boundary reveals only an own `publicMessage` the engine deliberately set.
- **sv-4** (reopened twice): first, whitelisting property *names* is not
  whitelisting — a permitted name holds an arbitrary value. Fixed `currentQuest`;
  the reviewer then found the *same defect in four more fields* (`inputKind`,
  `sceneGrounding`, `suggestedChoices`, `rollResults`), i.e. the first fix
  patched the instance, not the class. Every seat-facing field now declares a
  type, and the guard sweeps all of them.
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
