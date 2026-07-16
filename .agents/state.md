# Agent State

This file is the first place future agents should read for current repo state. Keep it
short and update it when important repo facts change. Landed/superseded entries rotate
to `docs/history/state-archive.md`.

## Now

- **ALL CODE GOES THROUGH THE REVIEWLOOP**, and planning completes before coding starts
  (owner decisions 2026-07-12 and 2026-07-14, `.agents/decisions.md`). This is
  unconditional; docs-only changes are outside the rule. The current default division of labour is
  Codex implementation with independent Claude planning and adversarial verification, dispatched
  with the exact `--model claude-fable-5` argument; Grok is not used by default. Exception on
  explicit owner wording (2026-07-16, "run it by codex and grok reviewloops"): the resolution-
  ruleset document loop ran dual codex+grok, recorded in
  `.agents/review/resolution-ruleset-review.md`. The roles may swap for the
  nature of a slice, but an author never reviews their own code.
- **PHASE V CODE IS COMPLETE; THE OWNER PLAYTEST IS PENDING.** All four implementation slices are
  merged and accepted; `.agents/review/index.md` owns their status and verdict trail. The live
  contract is one campaign-canonical narrator, server-resolved NPC voices, and shared host/seat
  synthesis. The phase remains open until the owner confirms that the voice experience is better in
  a real session. A follow-up save-once slice (the `voiceAlwaysGenerate` admin flag,
  `audio-store.js` persistence, and on-demand `GET /api/campaigns/:id/audio/:turnNumber` replay)
  was workflow-reviewed to APPROVED in-session, unit-green, and smoke-verified end-to-end
  2026-07-15 — including flag persistence through the v2 settings save seam. It shares the
  owner-playtest gate.
- **css-2 is abandoned and replaced by Phase CT.** Its project branch was deleted and, as
  reverified 2026-07-15, is absent from the canonical remotes; it must never be merged or revived.
  `.agents/machines.md` owns the machine-local cleanup blocker. The durable post-mortem is
  `docs/history/css-2-abandoned-scanner.md`.
- **map-1 is CLOSED — landed on `master`** via merge `dd59c27` (2026-07-15) on the owner's
  explicit go, after a codex r2 APPROVED verdict (3/3 defects fixed, guards confirmed, no new
  findings). Content verified on master (both fixed lines present, no `hsl(var(`, suite green:
  pass 1 / fail 0) and `fix/map-label-overflow` deleted after verification.
  `.agents/review/findings/map-1.md` owns the defect enumeration and both verdicts. No review
  finding has an open branch.
- **The rules system is the next big feature.** D0 and D1 are decided (fixed house chassis;
  d20 meet-or-beat — with d20-specific clauses pending supersession by the reviewed chapter below).
  **Chapter 1 (Resolution) is drafted at `docs/rules/resolution.md` and REVIEW-CONVERGED at
  `8f7862d`** — codex and grok both accepted with zero findings after 9 rounds, including two
  post-r5 owner amendments: complications are mechanical via the D2 effect catalog (now a hard
  prerequisite for implementing the edge bands), and discretion is licensed + ledgered (tunable
  stakes license; bidirectional text–effect coherence kills ghost consequences)
  (`.agents/review/resolution-ruleset-review.md`). **SIGNED OFF by the owner 2026-07-16** — the
  superseding decision is recorded in `.agents/decisions.md`; the chapter is the active resolution
  spec. Next queue decision: **D2 (effect catalog)**, whose deliverables row gates edge-band
  implementation. The canonical queue remains
  `.agents/review/rules-system-plan-intake.md` (next decisions: D2, D4, D6, D11, D12, D14 — one at
  a time). No rules code before a concrete phase and an accepted plan review.
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
- **`am-cc` is accepted and merged into `master` at `1a62848`.** Implementation commit `abbf956`
  adds the isolated, subscription-authenticated Claude Code adapter and routes it through the
  existing AIClient/Council pipeline. Claude Fable independently confirmed the red/green guard
  proof. `.agents/review/findings/am-cc.md` owns the verdict trail.
- **`am-2` is accepted and merged into `master` at `5103f46`.** Implementation commits `619b838`
  and `0578115` add live provider model catalogs, safe Claude Code account status, shared production
  endpoint provenance, a bounded response-body timeout, and the admin-authenticated catalog route.
  Fable independently confirmed the red/green timeout guard and found no remaining material issue.
  `.agents/review/findings/am-2.md` owns the verdict trail.
- **`am-3` is accepted and merged into `master` at `e75c89f`.** Commit `93a91e8`
  atomically activates the v2 admin settings wire and replaces repeated forms with compact provider
  connections, reusable configured models, and five primary/fallback Council assignments. Fable's
  first review found that clearing stored keys can reject or declassify migrated legacy entries;
  fix-up `6e05325` preserves the marker and environment precedence while clearing the secret, with
  server persistence and mutation proof. Fable accepted review head `5c2aeb5` after independently
  reproducing the old failure and rerunning both suites green. `.agents/review/findings/am-3.md`
  owns the full trail.
- **The remote two-human multiplayer playtest remains pending.** App-side seat work is landed;
  connectivity is owner-handled and out of repo scope. The playtest is the scheduled close for open
  multiplayer feel gates. Seat isolation must be re-tested whenever a field crosses a seat payload,
  audio, or error boundary; `.agents/repo-guidance.md` owns that rule.
- **Two UI slices landed 2026-07-15 on owner request** (workflow-reviewed in-session): `8ade369`
  replaced native confirm()/prompt() with in-app promise-based modals (Tauri/WKWebView no-ops broke
  campaign delete and every input dialog in the desktop shell); `b984eb9` added save-once narration
  audio (see the Phase V bullet). Both verified headless; suite green.
- **Outline-leak report investigated 2026-07-15, no code defect found**: the owner-reported
  "players can see the campaign outline" did not reproduce — every seat-reachable payload routes
  through the `scopeStateForSeat`/`scopeJournalForSeat` allowlists, which never carry the outline,
  and `testSeatVisibility` guards it with leak markers. Most likely cause: an unset `ACCESS_SECRET`
  makes every tokenless request a HOST (full payload) — dev-mode by design. Open hardening
  candidates (unscheduled, would need the loop): fail closed when binding non-loopback without
  `ACCESS_SECRET`; scope the host-only `/fork` response; per-campaign ownership check on the MCP
  `get_campaign_outline` tool.
- Solo play with no seats minted behaves exactly as before, as it always has.
- Known and unfixed as of `ca55b55`: `map-render.js:99`
  draws the location title as an unclipped SVG `<text>`, the same defect class the
  parked `fix/map-label-overflow` fixes for area labels. A long location name will
  overrun the canvas. Deliberately left out of that branch's scope.

## Next

**THE RESOLUTION CHAPTER IS SIGNED OFF (2026-07-16).** The immediate product gate remains Phase V's
owner voice playtest; the rules track's next owner decision is D2 (effect catalog), which also
gates edge-band implementation. The admin model-registry track is complete.

- Phase V's owner playtest remains the pending feel gate after this explicitly selected repo work.
  Configure either OpenAI or Grok voice in `/admin`, enable Voice Narration, and play a real scene
  with narrator plus multiple NPC lines. Confirm distinct/sticky identities, audible moods and
  per-line tones, Skip, and shared host/seat delivery.
- `map-1` is landed and closed (merge `dd59c27`); the rules track's next owner move is D2 (effect
  catalog), presented one item at a time from the intake queue.
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
- `map-1` is closed; no review-finding branches remain open.
- A machine-local css-2 cleanup is blocked on explicit destructive go; see `.agents/machines.md`.

## Verification

- Automated: `node test.js` — green on merged `master` at `e75c89f` on 2026-07-15; independently
  green at accepted am-3 review head `5c2aeb5`.
- Browser: `npm run test:browser` — green on merged `master` at `e75c89f` on 2026-07-15.
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

