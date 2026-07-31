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
- **D3 HAS A REVIEWED V3.1 PLAN, NOT AN OWNER DECISION.**
  `.agents/review/archetype-portability-matrix-v3.1.md` is the active working draft; v1, v2, v3,
  and `.agents/review/archetype-portability-matrix-review.md` are retained evidence. V3 replaced
  v2's mechanical-equivalence fingerprint with an immutable-mechanics thesis — Translate copies the
  mechanical record verbatim and rebinds only expression — and v3.1 fixed nine review findings
  against it (per-character bindings, a formal requirement predicate grammar, corrected pin
  coverage, the literal-pin/leak-test contradiction, new-character onboarding, ability-id scope,
  declaration lifecycle, and a narrowed round-trip claim). It also withdraws v3's claim that
  expression-only translation is mechanically risk-free: the ruleset sheet is the adjudicating
  model's canon rulebook (`rpg-prompts.js:101-109`), so canon-prose rewrites ship last and gated.
- **THE V3.1 CORE IS READY FOR AN OWNER RULING; STAGE 1 IS NOT YET COLD-IMPLEMENTABLE.**
  The latest read recommends adopting gate 1's immutable-mechanics plus per-campaign-bindings
  architecture. Before gate 2, revise three remaining seams: S1.8 cannot derive ruleset
  `cost`/`effect`/`limits` from profile abilities safely before D5 defines their canonical link;
  new-character onboarding needs a persisted approval draft rather than the synchronous `new`
  route; and tightening campaign capabilities must require each affected player's approval, not
  host-only resolution. Also define a legal expression candidate as a known semantic key whose
  engine-owned predicate passes, with its term remaining player-approved.
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

**FIRST OWNER ACTION:** Review `.agents/review/archetype-portability-matrix-v3.1.md`. First rule
only on the core architecture: mechanics copied verbatim plus per-campaign expression bindings,
distinct Continue/Branch/Translate modes, translated branch creation, and mandatory player
approval. Recommendation: adopt gate 1. No D3 decision is recorded until the owner rules; Stage 1
remains blocked on the three seams recorded above and no slice is proposed as standalone.

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
- After a fresh `npm install`, npm's install-scripts gate (npm bundled with Node 26) blocks
  sqlite3's native build and the suite fails to load the binding. One-off unblock:
  `npm config set allow-scripts=sqlite3 --location=user`, `npm rebuild sqlite3`, then delete the
  config key. The durable fix — an `allowScripts` entry in `package.json` — is a tracked change
  awaiting an owner go.
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
