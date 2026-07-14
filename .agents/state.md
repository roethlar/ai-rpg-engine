# Agent State

This file is the first place future agents should read for current repo state. Keep it
short and update it when important repo facts change. Landed/superseded entries rotate
to `docs/history/state-archive.md`.

## Now

- **ALL CODE GOES THROUGH THE REVIEWLOOP** with codex as reviewer, and planning
  completes before coding starts (owner decision 2026-07-12, `.agents/decisions.md`).
  Unconditional — no exemption for small, obvious, urgent, or owner-approved
  changes, and a green suite is not a substitute. Docs-only changes are out of
  scope.
- **IN FLIGHT:** css-1 is **ACCEPTED** at r5 awaiting owner-gated merge; map-1 is
  still **REOPENED**. Full detail: `.agents/review/index.md` +
  `findings/{css-1,map-1}.md`.
  - `fix/css-1-hsla-theme-vars` @ `09bb433` — **ACCEPTED at r5** (codex,
    guard_confirmed true). Production fix graded correct at r1; guard rewritten
    through r5 (aliases, nested var() fallbacks, delimiter-based names, production
    anchors, fixture probes). Awaiting **owner-gated merge**. Trail:
    `.agents/review/findings/css-1.md`.
  - `fix/map-label-overflow` @ `b178222` — three real defects. (1) **The reported
    bug is only half fixed**: `validateLocationLayout` clamps `x` and `w`
    independently, so `{x:92, w:20}` is valid and the label still runs off the
    100-wide canvas — the right-edge clipping the owner screenshotted is untouched;
    the branch only closed area-to-area collision. (2) Truncation splits UTF-16
    surrogate pairs (an emoji name becomes a lone high surrogate). (3) clipPath ids
    collide: the validated-distinct ids `east wing` and `east-wing` both slugify to
    the same fragment id, so one area's label resolves against the wrong clip and
    vanishes. Reviewer graded the guard itself REAL and the deliberately-scoped-out
    sibling defect (below) as acceptable.
- **Reviewer dispatches fail closed.** css-1 r2 was content-filtered with no schema
  envelope (residual still extracted by execution); earlier dispatches also died on
  capacity / no-return. Re-dispatch; never treat a missing envelope as an accept.
- **Recorded process defect, corrected 2026-07-13:** `.agents/review/index.md`
  asserted from 2026-07-11 that a `guard-css-1` existed and proved the surfaces
  transparent-on-master / painted-at-the-fix. **No such committed guard ever
  existed** — it was an ad-hoc browser check, and the repo has **no browser
  harness** (no Playwright in `package.json` or `node_modules`). The reviewer was
  explicit that the new static scanner does not retroactively substantiate that
  browser claim. Treat every "guard-*" named in older index prose as unverified
  until a committed artifact is found.
- **The rules system is the next big feature** (owner, 2026-07-12: "it's the next
  big feature, and a lot rides on it"), but it is NOT being designed yet — the
  owner is housekeeping first. **D0 is DECIDED** (2026-07-12, `.agents/decisions.md`):
  a fixed house chassis with generated per-campaign flavor skins. That unblocks
  D1, D2, D4, D6, D11, D12 and D14 in the decision queue —
  `.agents/review/rules-system-plan-intake.md`, which holds all fourteen admitted
  findings and the queue; D1 (the die) is the next ask when the owner is ready.
  Present decisions ONE AT A TIME (owner, 2026-07-12) and never bundle "should we?"
  with "now?" — those are separate questions. No rules code before the remaining
  decisions, a concrete phase, and an accepted plan review.
- Review loop backlog (from the 2026-07-11 owner quadruple-go; T2+T2-s plan
  APPROVED, four fixes merged, push done). Still owner-approved to fix through the
  loop, none started: **jt-1 (HIGH — Journal tab renders a stale campaign's history
  and Fork then forks the wrong campaign)**, dr-1, tts-1, ds-1, fk-1. Then T2-s,
  then T2 (css-1 is T2-s's prerequisite). Table: `.agents/review/index.md`.
- Queued, planned, owner-approved, not started: the `/admin` model catalog
  (plan.md → Dev Tooling). Fetches real model names from the selected provider so
  the operator need not know them; combo-box shape (suggestions over a text input,
  never a strict select). Motivated partly by stale hardcoded defaults in
  `api-client.js` — `grok-3` (:283) and `claude-3-5-sonnet-20241022` (:280, retired
  Oct 2025) — which a provider selected with a blank model still resolves to.
- **Priority: the remote two-human multiplayer playtest** (decision 2026-07-09).
  App-side readiness is DONE — Phase S seats S1–S3 are built, reviewed, and on
  master. Connectivity (transport/TLS/tunnel) is owner-handled and out of repo
  scope. This playtest is the scheduled close for every open feel gate.
- Seat isolation is a boundary to RE-TEST, not a finished category. A
  cross-model review on 2026-07-09 found six defects in the fresh S2/S3 work,
  and **four of the six first fixes were themselves wrong** — a TOCTOU race
  survived the obvious fix; a name-only whitelist let nested values through;
  an error `code` was trusted as provenance. All six are merged and verified
  live. Re-test the boundary whenever a field is added to a seat payload or an
  error path. Table and verdict trail: `.agents/review/index.md` (it owns that
  enumeration; do not copy it here).
- Solo play with no seats minted behaves exactly as before, as it always has.
- AI and image provider config is machine-local (`.env`, `AI_PROVIDER`, the
  admin `ai_config` row) and the owner develops across several machines, so
  it legitimately differs per host. Check it where you are — its absence here
  says nothing about anywhere else, and is not a fact worth recording. Where
  no image provider is configured, heroics are inert by design.
- Known, unfixed, recorded here so it is not rediscovered: `map-render.js:99`
  draws the location title as an unclipped SVG `<text>`, the same defect class the
  parked `fix/map-label-overflow` fixes for area labels. A long location name will
  overrun the canvas. Deliberately left out of that branch's scope.

## Next

- **css-1 is ACCEPTED** at `09bb433` — owner-gated merge when ready. **map-1** is still
  REOPENED; its fix-ups (grapheme-safe truncation, collision-free clip ids, clamp the
  box to the canvas) still need an explicit go (or park). Do not start map-1 without it.
- Continue the rules-system decision queue — the next big feature, but the owner sets
  the pace and was housekeeping when D0 landed. D0 is DECIDED; **D1 (the die) is the
  next ask**. Present the queue in
  `.agents/review/rules-system-plan-intake.md` ONE item at a time and wait; record
  approved wording durably as each lands. Then write the concrete phase and iterate
  pinned reviews to acceptance before any implementation. The synthesis must settle
  the die (the dice theater generalizes
  from d20-only via a `sides` field on the roll record — rider on the Phase 1
  slice in plan.md), the engine-owned ability/effect schema, multiplayer choice
  timing, legacy/versioning policy, and tactical combat (owner decision
  2026-07-11: in scope; the old non-goal line was agent drift, now struck).
  Downstream and BLOCKED on the chassis: the character sheet, the deterministic
  resolver that replaces part of the Referee role, and tactical positioning —
  see the Friends & Fables entries in plan.md Future Topics.
- Run the playtest. Owner steps before play, on the hosting machine: set
  `ACCESS_SECRET` + `ADMIN_SECRET`, confirm an AI provider is configured
  there, expose the server, create the second character (party strip
  **+ Join**, host-only), mint its seat (key icon beside the chip), send that
  token to the other player.
- Branch cleanup is DONE (owner 2026-07-12): the four merged fix branches and the
  redundant `plan/rules-system` are deleted, content-verified on master first, and a
  stale worktree registration (`/private/tmp/ai-rpg-rules-plan`, directory long gone)
  was pruned. Only the two live review branches remain. Also CLOSED earlier
  (2026-07-11): the six `fix/sv-*` branches are deleted, and the three accidental
  merge commits stay — history rewrite declined; do not re-propose it.

## Blockers

- Nothing technical. Network exposure for the playtest is owner-handled
  infrastructure (owner, 2026-07-09), not a repo task.
- Process, not technical: map-1 fix-ups still need an explicit go (or park). css-1 is
  accepted and only needs an owner merge go.

## Verification

- Automated: `AI_RETRY_BACKOFF_MS=10 node test.js` — green at `cae74df`. Run it
  rather than trusting a group count written here. The suite is hermetic:
  `RPG_DB_PATH` redirects it to a temp DB, closed and removed on exit (before
  2026-07-09 it opened the operator's real dev database).
- **There is NO browser harness.** No Playwright in `package.json` or `node_modules`.
  Any `guard-*` named in older `.agents/review/index.md` prose as a browser check was
  ad-hoc (run through a Playwright MCP plugin) and was never committed — do not assume
  a cited guard exists as an artifact until you find the file. A committed reviewer
  cannot reproduce an uncommitted guard, and the loop fails closed on that.
- When a change ships with a test, prove the test guards it (AGENTS.md), and
  beware the vacuous guard — a test that re-implements the logic it checks
  cannot fail when the fix is reverted. This bit twice on 2026-07-09; the
  anti-pattern and its cure are recorded in `.agents/playbooks/reviewloop.md`.
  **It bit a third time on 2026-07-13, in a new costume:** the css-1 scanner guard
  did not re-implement anything, but it matched only the *literal spelling* of the
  defect (`rgba(var(--theme-…))`), so custom-property indirection defeated it. A guard
  must cover the *class*, not the one spelling you thought of. The reviewer found this
  by writing a bypass and watching the suite pass — that is the standard to hold.
  The seat boundary's predicates are already extracted for exactly this
  reason: `findLiveSeat`, `boundVoiceDirective`, `selectSpeakingCharacter`,
  `errorPayloadFor`.
- Live: `node server.js`, then a seat smoke (mint seat → `/api/seat/session` →
  leak-scan the payload). Do it against a throwaway store —
  `RPG_DB_PATH=/tmp/x.db` — never the dev DB; release/revoke are destructive.
- Desktop shell (Rust), outside the suite: `cargo build` in `desktop/src-tauri`.

## Active Sources

- `AGENTS.md`, `.agents/repo-guidance.md`, `.agents/decisions.md`,
  `.agents/playbooks/reviewloop.md`
- `plan.md` — phases and the current priority.
- `.agents/review/index.md` — review loops, findings, verdicts.
- `README.md` — hosting/seat flow; accurate as of 2026-07-09.
- `docs/ruleset-licensing.md` (evidence for the dropped-rulesets decision)
- `docs/history/state-archive.md` — rotated history; not current state.

## Unrecorded Repo Memory

- Engine: `db.js` / `rpg-state.js` / `rpg-engine.js`; prompts `rpg-prompts.js`;
  seams `api-client.js` (text), `tts-providers.js` (speech),
  `image-providers.js` (images); `map-render.js`; `seat-auth.js`;
  `server-errors.js` (the seat/host error trust boundary); `admin/` panel.
- The dev DB (`data/rpg_engine.db`) is gitignored and machine-local; its
  contents and sibling files (backups) differ per machine. Ask sqlite on the
  machine you are on rather than trusting any list. The owner keeps no real
  campaigns on any machine — "I don't have any real campaigns. just tests."
  (2026-07-09) — so the DB is throwaway, but release/revoke are still
  destructive: smoke-test against `RPG_DB_PATH=/tmp/x.db`.
- The party-strip **+ Join** button is HOST-only (it creates characters); the
  host mints each character's seat token from the key icon beside its chip.
  Seat sessions see neither control.
- Codex reviewer incantation cache: `.agents/review/harnesses.local.json`
  (gitignored, machine-local). `codex exec` needs `< /dev/null` on stdin and
  generous timeouts.
