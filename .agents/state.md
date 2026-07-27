# Agent State

This file is the first place future agents should read for current repo state. Keep it
short and update it when important repo facts change. Landed/superseded entries rotate
to `docs/history/state-archive.md`.

## Now

- **CROSS-HARNESS REVIEW IS OFF BY DEFAULT** (owner decision 2026-07-26,
  `.agents/decisions.md`). Do not invoke an external reviewer unless the owner explicitly requests
  `codereview`, `review`, `openreview`, or names one for the work. Code still requires an
  owner-approved plan and normal repository verification.
- **THE COST-FIRST GREENFIELD RUNTIME PLAN IS REVIEW-CLOSED, NOT IMPLEMENTATION-APPROVED.**
  `docs/runtime-greenfield-plan.md` is at post-r5 blob
  `03ec483f46e0e476ce261a2854294c2f75f643e1`; the independent r5 verdict was APPROVED with zero
  open findings. The owner mandate makes this plan authoritative over earlier runtime/rules choices
  where they conflict, but §8 still owns the unresolved owner decisions and the plan still needs
  owner sign-off. The shipped Council remains canonical until the plan's gates and cutover criteria
  pass; no greenfield runtime code is authorized yet.
- **THE RULES TRACK HAS ONE SIGN-OFF GATE AND A SEPARATE DECISION QUEUE.** Chapter 1
  (`docs/rules/resolution.md`) is owner-signed and D2 is decided. Chapter 2
  (`docs/rules/effects.md`, DRAFT r24 at commit `6772d33`) is review-converged after r28 with zero
  findings and awaits owner sign-off. `.agents/review/rules-system-plan-intake.md` owns the remaining
  decision queue; no rules code before a concrete phase and an owner-approved plan.
- **PHASE V CODE IS COMPLETE; THE OWNER VOICE PLAYTEST IS PENDING.** The live contract is one
  campaign-canonical narrator, server-resolved NPC voices, shared host/seat synthesis, and
  save-once replay. `.agents/review/index.md` owns the accepted implementation trail. The phase
  remains open until a real session confirms the voice experience is better.
- **THE OWNER-APPROVED UI BACKLOG REMAINS UNSTARTED AS OF `e1f8e7c`.**
  `.agents/review/index.md` owns the exact findings and order; resume at `jt-1`.
- **THE REMOTE TWO-HUMAN MULTIPLAYER PLAYTEST REMAINS PENDING.** App-side seat work is landed;
  connectivity is owner-handled and out of repo scope. Seat isolation must be re-tested whenever a
  field crosses a seat payload, audio, or error boundary.
- **KNOWN PARKED DEFECT, REVERIFIED AT `e1f8e7c`:** `map-render.js:142` draws the location title
  as an unclipped SVG `<text>`. A long location name can overrun the canvas; the landed `map-1`
  fix deliberately covered area labels only.

## Next

**FIRST OWNER ACTION:** settle §8 question 1 in `docs/runtime-greenfield-plan.md`: use the cheaper
dice-column mode as the campaign default, with strict provably-neutral rolls opt-in, or make strict
mode the default. Recommendation: dice-column default, because it matches the cost-first mandate
while retaining strict mode for tables that value proof over the extra call cost. The remaining §8
questions and final plan sign-off stay blocked until the owner responds.

- After §8 is settled and the plan is owner-approved, promote the greenfield work into a concrete,
  phased implementation plan; gates G1–G5 precede the implementation points named in the plan.
- Separately, request owner sign-off on the review-converged effect catalog before any edge-band
  implementation planning.
- Phase V's pending feel gate is a real voice session with narrator plus multiple NPC lines,
  checking sticky identities, moods/tones, Skip, and shared host/seat delivery.
- For the combined host/seat playtest, configure `ACCESS_SECRET` and `ADMIN_SECRET`, expose the
  server, add the second character, mint its seat, and send that seat token to the other player.

## Blockers

- No product-code defect blocks development.
- Greenfield implementation is blocked on the §8 owner decisions, owner sign-off, and a concrete
  approved implementation phase.
- Rules edge-band planning is blocked on owner sign-off of `docs/rules/effects.md`.
- Phase V closure requires the owner's real-session voice verdict.
- Multiplayer network exposure is owner-handled infrastructure.
- Machine-local css-2 cleanup on `nagatha` requires explicit destructive go; see
  `.agents/machines.md`.

## Verification

- Automated: `npm test` — green against code head `e1f8e7c` on 2026-07-26.
- Browser: `npm run test:browser` remains required before merging changes to
  `public/styles.css` or `public/theme-vars.js`; it does not cover `app.js` theme wiring or
  `map-render.js`. No fresh browser verdict was established during this catchup.
- Guard-proof requirements and anti-vacuity practice live in `AGENTS.md` and
  `.agents/decisions.md`; the codereview playbook applies only when explicitly invoked.
- Live seat verification uses a throwaway store: mint seat → `/api/seat/session` → leak-scan the
  payload. Release/revoke are destructive.
- Desktop shell verification is `cargo build` in `desktop/src-tauri`.

## Active Sources

- `AGENTS.md`, `.agents/repo-guidance.md`, `.agents/decisions.md`
- `docs/runtime-greenfield-plan.md` and `.agents/review/runtime-greenfield-plan.md`
- `docs/rules/effects.md`, `.agents/review/effect-catalog-review.md`, and
  `.agents/review/rules-system-plan-intake.md`
- `plan.md` — the broader phased roadmap.
- `.agents/review/index.md` — implementation findings, order, and verdicts.
- `README.md` — current setup, hosting, seat, and voice flow.
- `.agents/machines.md` — machine-local facts and cleanup blockers.
- `docs/history/state-archive.md` — rotated history; not current state.
