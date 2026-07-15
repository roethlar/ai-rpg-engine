# Agent State

This file is the first place future agents should read for current repo state. Keep it
short and update it when important repo facts change. Landed/superseded entries rotate
to `docs/history/state-archive.md`.

## Now

- **ALL CODE GOES THROUGH THE REVIEWLOOP**, and planning completes before coding starts
  (owner decisions 2026-07-12 and 2026-07-14, `.agents/decisions.md`). This is
  unconditional; docs-only changes are outside the rule. The current default division of labour is
  Codex implementation with independent Claude planning and adversarial verification, dispatched
  with the exact `--model claude-fable-5` argument; Grok is not used. The roles may swap for the
  nature of a slice, but an author never reviews their own code.
- **PHASE V CODE IS COMPLETE; THE OWNER PLAYTEST IS PENDING.** All four implementation slices are
  merged and accepted; `.agents/review/index.md` owns their status and verdict trail. The live
  contract is one campaign-canonical narrator, server-resolved NPC voices, and shared host/seat
  synthesis. The phase remains open until the owner confirms that the voice experience is better in
  a real session.
- **css-2 is abandoned and replaced by Phase CT.** Its project branch was deleted and, as
  reverified 2026-07-15, is absent from the canonical remotes; it must never be merged or revived.
  `.agents/machines.md` owns the machine-local cleanup blocker. The durable post-mortem is
  `docs/history/css-2-abandoned-scanner.md`.
- **map-1 is REOPENED and PARKED** at `fix/map-label-overflow` / `b178222`; as of `ca55b55`, it is
  the only unmerged review finding with a branch. `.agents/review/findings/map-1.md` owns the defect
  enumeration and verdict. Fix-ups require an explicit go or park decision.
- **The rules system is the next big feature.** D0 is decided: one fixed house chassis with
  generated campaign flavor. D1 (the die) is the next owner decision. The canonical queue is
  `.agents/review/rules-system-plan-intake.md`; present it one item at a time. No rules code before
  the remaining decisions, a concrete phase, and an accepted plan review.
- The existing owner-approved reviewloop backlog remains unstarted as of `ca55b55`.
  `.agents/review/index.md` owns the exact findings and order; resume at `jt-1`, finish the remaining
  backlog, then enter the approved T2-s/T2 plan.
- **The old `/admin` catalog-only plan is superseded by the admin model registry redesign.** Owner
  direction 2026-07-15: compact provider connections with shared keys, reusable configured models
  with optional custom key overrides and live editable catalogs, then primary + fallback assignment
  per Council role. The `am-*` r8 plan in plan.md is accepted by Claude and Grok at
  `5f0261375f9b97f464f54ee406d5bafca7f3ea8d`. A first-class, no-key
  `claude-code` provider using the server process's logged-in plan is covered by the accepted r11
  extension at `0f36f0f920e2e26a0783840e49ad8144f797dec5`; model ids remain manually editable
  because the installed CLI has no documented machine-readable account catalog. Claude Fable 5
  accepted the pinned extension with evidence checked and no comments.
- **`am-1` is accepted at review head `80c2143` and merged into `master` under the owner's go.**
  It adds canonical v2 projection/validation/save seams and Council runtime resolution
  while leaving the v1 admin HTTP wire active. `.agents/review/findings/am-1.md` owns the scope,
  guard proof, and verdict.
- **The remote two-human multiplayer playtest remains pending.** App-side seat work is landed;
  connectivity is owner-handled and out of repo scope. The playtest is the scheduled close for open
  multiplayer feel gates. Seat isolation must be re-tested whenever a field crosses a seat payload,
  audio, or error boundary; `.agents/repo-guidance.md` owns that rule.
- Solo play with no seats minted behaves exactly as before, as it always has.
- Known and unfixed as of `ca55b55`: `map-render.js:99`
  draws the location title as an unclipped SVG `<text>`, the same defect class the
  parked `fix/map-label-overflow` fixes for area labels. A long location name will
  overrun the canvas. Deliberately left out of that branch's scope.

## Next

**THE IMMEDIATE NEXT ACTION: implement and review `am-cc` from updated `master`.** The remaining
ordered reviewloop slices are `am-cc`, `am-2`, and `am-3`, each accepted and owner-merged before the
next.

- Phase V's owner playtest remains the pending feel gate after this explicitly selected repo work.
  Configure either OpenAI or Grok voice in `/admin`, enable Voice Narration, and play a real scene
  with narrator plus multiple NPC lines. Confirm distinct/sticky identities, audible moods and
  per-line tones, Skip, and shared host/seat delivery.
- `map-1` still needs an explicit go; the rules track resumes with D1 when the owner is ready.
- For the combined host/seat playtest, set
  `ACCESS_SECRET` + `ADMIN_SECRET`, confirm an AI provider is configured
  there, expose the server, create the second character (party strip
  **+ Join**, host-only), mint its seat (key icon beside the chip), send that
  token to the other player.

## Blockers

- No product-code blocker. Network exposure for the playtest is owner-handled infrastructure, not
  a repo task.
- Phase V's code gates are closed; its feel verdict requires the owner's real-session voice
  playtest described under `## Next`.
- `map-1` fix-ups need an explicit go or park decision.
- A machine-local css-2 cleanup is blocked on explicit destructive go; see `.agents/machines.md`.

## Verification

- Automated: `AI_RETRY_BACKOFF_MS=10 node test.js` — green on code at `ca55b55`, re-run during the
  2026-07-15 drift pass.
- Browser: `npm run test:browser` — green on code at `ca55b55`, re-run during the same drift pass.
  **Required before
  merging any change to `public/styles.css` or `public/theme-vars.js`** (`.agents/repo-guidance.md`);
  it does **not** cover `app.js` theme wiring or `map-render.js`. One-time setup per machine:
  `npx playwright install chromium`.
- Guard-proof requirements and anti-vacuity practice live in `AGENTS.md`, `.agents/decisions.md`, and
  `.agents/playbooks/reviewloop.md`.
- Live: `node server.js`, then a seat smoke (mint seat → `/api/seat/session` →
  leak-scan the payload). Do it against a throwaway store —
  `RPG_DB_PATH=/tmp/x.db` — never the dev DB; release/revoke are destructive.
- Desktop shell (Rust), outside the suite: `cargo build` in `desktop/src-tauri`.

## Active Sources

- `AGENTS.md`, `.agents/repo-guidance.md`, `.agents/decisions.md`,
  `.agents/playbooks/reviewloop.md`
- `plan.md` — phases and the current priority.
- `.agents/review/index.md` — review loops, findings, verdicts.
- `README.md` — current setup, hosting, seat, and voice flow.
- `.agents/machines.md` — machine-local facts and cleanup blockers; never portable state.
- `docs/history/state-archive.md` — rotated history; not current state.
