# Agent State

This file is the first place future agents should read for current repo state. Keep it
short and update it when important repo facts change. Landed/superseded entries rotate
to `docs/history/state-archive.md`.

## Now

- **CROSS-HARNESS REVIEW IS OFF BY DEFAULT** (owner decision 2026-07-26,
  `.agents/decisions.md`). Do not invoke an external reviewer unless the owner explicitly requests
  `codereview`, `review`, `openreview`, or names one for the work. Code still requires an
  owner-approved plan and normal repository verification.
- **THE GREENFIELD RUNTIME REWRITE IS ABANDONED** (owner decision 2026-07-26). The shipped Council
  pipeline remains canonical. Product work continues incrementally through rules, UI, mapping, and
  related improvements. The discarded proposal survives only as historical evidence at
  `docs/history/runtime-greenfield-plan-abandoned.md`; none of its gates or open questions apply.
- **RULES CHAPTERS 1 AND 2 ARE OWNER-SIGNED; THE DECISION QUEUE CONTINUES.** Chapter 1
  (`docs/rules/resolution.md`) and Chapter 2 (`docs/rules/effects.md`, r24 substantive pin
  `6772d33`) are canonical. Chapter 2 closed r28 with zero findings and was signed off
  2026-07-27, enacting its three declared Chapter 1 refinements and closing the D2 catalog-design
  gate. `.agents/review/rules-system-plan-intake.md` owns the remaining decision queue; no rules
  code before a concrete phase and an owner-approved plan.
- **D3 GATE 1 IS OWNER-ADOPTED (2026-07-31; recorded in `.agents/decisions.md`).** Immutable
  mechanics plus per-campaign expression bindings, three modes (Continue/Branch/Translate),
  mandatory player approval. `.agents/review/archetype-portability-matrix-v3.1.md` is the active
  working draft; v1, v2, v3, and the review file are retained evidence. Gates 2-7 remain unruled;
  no product code is authorized.
- **PHASE PT IS APPROVED AND RUNNING; S1.1 IS LANDED AT `9343e79`** (gate 1 adopted, gate 2 +
  plan approved, all 2026-07-31; decisions recorded). S1.1: engine-issued ability ids, id-first
  matching with legacy name fallback and heal-on-touch; guard proof executed both legs. Coding
  is dispatched to Opus/Sonnet subagents (owner instruction, recorded in the Phase PT status
  line). Gates 4-5 ride S1.3, 6-7 ride S1.5. D5 is not a Stage 1 dependency.
- **GATE 3 (CAPABILITY AXES) IS ON HOLD BEHIND AN OPEN DESIGN CONVERSATION — NOT A DECISION.**
  The owner is talking out the host-authority model and explicitly said "I did not make a rule.
  I'm talking this out." Position in progress: "the GM is the one who controls the ruleset…
  the host controls the environment, not the game." Open threads from the discussion:
  corrections-as-appeal-to-the-GM instead of settings levers; the host already picks the GM's
  brain (model/provider config) so host trust is load-bearing regardless; whether a "table /
  session zero" consent organ is needed for world-level premise or the campaign creator just is
  session zero. A premature decision record + §6.1 draft edit were made and fully reverted —
  decisions.md and the v3.1 draft carry NOTHING from this conversation. S1.2 must not start
  until gate 3 rules AND this settles (it shapes S1.2's declaration edit surfaces).
- **PHASE V CODE IS COMPLETE; THE OWNER VOICE PLAYTEST IS PENDING.** The live contract is one
  campaign-canonical narrator, server-resolved NPC voices, shared host/seat synthesis, and
  save-once replay. `.agents/review/index.md` owns the accepted implementation trail. The phase
  remains open until a real session confirms the voice experience is better.
- **THE OWNER-APPROVED UI BACKLOG REMAINS UNSTARTED AS OF `8320db7`.**
  `.agents/review/index.md` owns the exact findings and order; resume at `jt-1`.
- **THE REMOTE TWO-HUMAN MULTIPLAYER PLAYTEST REMAINS PENDING.** App-side seat work is landed;
  connectivity is owner-handled and out of repo scope. Seat isolation must be re-tested whenever a
  field crosses a seat payload, audio, or error boundary.
- **KNOWN PARKED DEFECT, REVERIFIED AT `8320db7`:** `map-render.js:142` draws the location title
  as an unclipped SVG `<text>`. A long location name can overrun the canvas; the landed `map-1`
  fix deliberately covered area labels only.

## Next

**NEXT:** Resume the host-authority talk-out with the owner (see `## Now`) — words only, no
records until the owner rules. When it settles: fold the outcome into the v3.1 draft's
§6.1/§6.4 and Phase PT S1.2, then re-pose gate 3 (the nine capability axes). S1.2 starts only
after both.

- Continue the rules intake queue one owner decision at a time; D5 and D13 are also ready now
  that D2 is signed off.
- The first approved UI backlog slice is `jt-1` (prevent stale cross-campaign Journal responses);
  select it when UI implementation should resume.
- The concrete mapping candidate is the parked location-title overflow defect; draft and approve
  its fix plan before changing code.
- Phase V's pending feel gate is a real voice session with narrator plus multiple NPC lines,
  checking sticky identities, moods/tones, Skip, and shared host/seat delivery.
- For the combined host/seat playtest, configure `ACCESS_SECRET` and `ADMIN_SECRET`, expose the
  server, add the second character, mint its seat, and send that seat token to the other player.

## Blockers

- No product-code defect blocks development.
- Rules implementation remains blocked on a concrete phase and owner-approved code plan; the
  catalog-design gate itself is closed.
- Phase V closure requires the owner's real-session voice verdict.
- Multiplayer network exposure is owner-handled infrastructure.

## Verification

- Automated: `npm test` — green against code head `8320db7` on 2026-07-30 (no code changes since
  `e1f8e7c`; docs-only commits between).
- npm 12+ (bundled with Node 26) blocks dependency install scripts by default; `package.json`
  carries `allowScripts` entries for sqlite3 and fsevents so a fresh `npm install` builds the
  sqlite3 native binding (owner-approved 2026-07-30).
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
- `docs/rules/effects.md`, `.agents/review/effect-catalog-review.md`, and
  `.agents/review/rules-system-plan-intake.md`
- `.agents/review/archetype-portability-matrix-v3.1.md` — active D3 plan;
  `.agents/review/archetype-portability-matrix.md`,
  `.agents/review/archetype-portability-matrix-review.md`,
  `.agents/review/archetype-portability-matrix-v2.md`, and
  `.agents/review/archetype-portability-matrix-v3.md` — retained evidence.
- `plan.md` — the broader phased roadmap.
- `.agents/review/index.md` — implementation findings, order, and verdicts.
- `README.md` — current setup, hosting, seat, and voice flow.
- `.agents/machines.md` — machine-local facts and cleanup blockers.
- `docs/history/state-archive.md` — rotated history; not current state.
