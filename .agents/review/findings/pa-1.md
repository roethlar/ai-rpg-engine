# pa-1: Every partymate's action is labelled "You" in the shared transcript

**Severity**: HIGH — in the flagship multiplayer mode the primary surface shows wrong data on
*every* remote turn: the log claims the reader typed actions another player typed.
**Status**: In progress — fix landed, pending reviewer verdict
**Branch**: `pa-1-author-attribution`
**Commit**: `b651289`

## Evidence
Found by a read-only bug hunt over the shipped runtime, 2026-08-03. At `a5c15d2`:
- `public/app.js:2667` — `appendPlayerAction` hardcoded the speaker:
  `speaker.innerHTML = '<i class="fa-solid fa-user"></i> You';`
- `public/app.js:2008` — the poll fed other players' text straight into it:
  `if (state.turn?.playerAction) appendPlayerAction(state.turn.playerAction, state.turn.number);`
- `public/app.js:1767` — the gap backfill did the same from journal rows.
- The payload carried no author to use: `rpg-engine.js:2840-2857` (turn view has `playerAction`,
  no acting character) and `server.js:821` (journal SELECT omitted it). `turns.character_id`
  exists in the schema (`db.js:487`) and is written on every turn — it was simply never sent.

## Predicted observable failure
Any campaign with 2+ active characters. Player B commits a turn; Player A's browser picks it up on
the 12s poll or through a gap backfill and renders "**You**: I kick down the door" for an action
Player A never typed. Over a session the whole shared transcript misattributes authorship, and the
Journal tab shows the same actions with no author at all.

## Approach
Carry the existing `turns.character_id` end to end rather than inventing a parallel author field.
Added to all three turn-view builders (`createCampaign` → `null`, `takeTurn` → `character.id`,
`getCampaignState` → `lastTurn.character_id ?? null`) and to the journal SELECT. The client
resolves the id against the party it already holds, via a session-scoped `characterNamesById` map
and a single `turnAuthorLabel()` helper used by the poll, the gap backfill, and the Journal tab.

**Not `turnOrder.actingCharacterId`.** By the time a turn view is built the round-robin has
already advanced to the *next* player (`rpg-engine.js:2779-2782`), so that field names the wrong
character. The unit guard pins exactly this trap by arranging for the acting character to differ
from the author of the last turn.

**The id travels, not the name.** A seat gains no new information: character ids already reach it
through `party[].id`, its own `seatCharacterId`, and `turnOrder`. A seat can only resolve an id to
a name for characters its own party strip already shows, so a character who has left the table
renders as `Another player` — the phrasing `updateTurnBanner` already uses — rather than leaking
a departed member's name backwards.

Identity uses the existing `myCharacterId` resolution (seat credential, stored claim, or
sole-member auto-claim); no second notion of "who am I" was introduced.

## Files changed
- `rpg-engine.js` — `characterId` on the three turn views.
- `server.js` — journal SELECT includes `character_id`.
- `rpg-state.js` — `seatIntegerOrNull` coercion; `scopeStateForSeat` emits `turn.characterId`,
  `scopeJournalForSeat` emits `character_id`.
- `public/app.js` — `turnAuthorLabel()`, `characterNamesById`, `appendPlayerAction` takes the
  author; poll, gap backfill and Journal all pass it.
- `test-browser.mjs`, `test.js` — guards.

## Guard proof
The bug spans a client renderer and two server payloads, so a browser guard alone would have been
vacuous on the server half — the Playwright fixture hand-builds the JSON and would have proved
nothing about what the server actually sends. Both kinds were written.

`test-browser.mjs::runAuthorAttributionGuard` drives a real two-player table through both arrival
paths in both directions: own backfilled turn → `You`; partymate backfilled → `Beta Scout`;
null-author row → `You`; own submit → `You`; partymate via the live poll → `Beta Scout`; a sweep
asserting no `PARTYMATE` action is ever labelled `You`; plus the three Journal-tab labels.

`test.js::testTurnAuthorAttribution` runs against a real database and a real HTTP listener, and
deliberately sets the round-robin so the acting character is Alice while the last turn was Bob's.
It checks the journal route as both host and seat.

**Three separate reverts, three distinct failures, each restored to green:**

| Reverted | Observed failure |
|---|---|
| `speaker.innerHTML` back to the hardcoded `You` | `Browser guard failed: a backfilled partymate action is attributed to the partymate, not to this browser` |
| `getCampaignState`'s `characterId` | `AssertionError: The poll payload carries the character who ACTED, not the one whose turn it now is` (actual `undefined`, expected `900000007`) |
| the journal `SELECT` | `AssertionError: The host journal carries each turn author, including the null one` — every `character_id` came back `undefined` |

The orchestrator independently re-ran the second of these and observed the same assertion, then
restored and returned the suite to green.

`node test.js`, `npm run test:browser` (10 guard lines, 0 failures), `node --check` on all six
changed files, and `git diff --check` are clean.

## Seat isolation
This adds a field to a seat-reachable payload, which `.agents/repo-guidance.md` makes a hard
re-test boundary. The existing set was run — `testSeatAuth`, `testSeatLifecycle`,
`testSeatErrorPayloads`, `testSeatVisibility` (the marker-based leak scan), and the browser
`runSeatAbilityComposerGuard` — all pass. The boundary was also **extended**, not merely re-run:
- `characterId` joins `testSeatVisibility`'s `poisonedFields` sweep, so a nested object smuggled
  under it cannot reach a seat (the sv-4 round-3 class check).
- A non-integer sweep (`'2'`, `2.5`, `true`, `[2]`, `{id:2}`) asserts each coerces to `null`.
- The seat journal row's exact-shape `deepStrictEqual` was updated and a key-set assertion added,
  proving the shape gained the author **and nothing else**.
- The HTTP-level seat check uses a real seat token against a throwaway DB and re-asserts that
  `state_changes_json` is still absent and `memories` still empty.

## Known gaps
- `takeTurn`'s returned `characterId` is not directly exercised: the submit response renders its
  author through the optimistic bubble, so no current client path reads it. It was kept for shape
  consistency across the three builders — a future reader finding two of three carrying the author
  is how this bug returns. Testing it would mean mocking the whole Council pipeline for a field
  nothing reads today.
- Per the repo's review gate, this is user-visible GM behaviour and a real 2+ character play
  session should confirm the transcript reads right in practice. Not run — owner playtest.

## Reviewer comments
(pending)
