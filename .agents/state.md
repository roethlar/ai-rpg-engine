# Agent State

This file is the first place future agents should read for current repo state. Keep it
short and update it when important repo facts change. Landed/superseded entries rotate
to `docs/history/state-archive.md`.

## Now

- **The rules system is the next big feature** (owner, 2026-07-12: "it's the next
  big feature, and a lot rides on it"). The survey material HAS arrived and
  Claude's pinned read-only intake is done: it returned `ready_for_owner_decisions`
  with fourteen admitted plan findings and a D0–D14 owner decision queue. See
  `.agents/review/rules-system-plan-intake.md`. D0 (overall frame) is the next
  ask. No rules code before the decisions, a concrete phase, and an accepted
  plan review. The intake landed here on 2026-07-12 by cherry-pick from the
  `plan/rules-system` branch (docs-only; that branch is now redundant).
- Active review loop (2026-07-11): see `.agents/review/index.md`. Owner
  quadruple-go (2026-07-11): (1) T2+T2-s theming plan APPROVED; (2) merge
  the four accepted fixes (poll-1, dt-1..3, stack order); (3) fix the six
  open findings (css-1, jt-1, dr-1, tts-1, ds-1, fk-1) through the loop;
  (4) push once merged. Items 1, 2 and 4 are DONE; css-1's fix is committed on
  `fix/css-1-hsla-theme-vars` @ `32af1ba` with its verdict dispatched but never
  returned — re-dispatch it. Remaining queue: css-1 verdict, then jt-1 (HIGH),
  dr-1, tts-1, ds-1, fk-1, then T2-s, then T2.
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
- Push state (verified 2026-07-12 at local master `d4d8d18`): both remotes
  (gitea `origin` + `github`) hold master in sync with local. Re-derive with
  `git ls-remote <remote> HEAD` rather than trusting this line; push policy is
  `.agents/push-policy.md`.

## Next

- Continue the rules-system plan loop — this is the next big feature. Present the
  decision queue in `.agents/review/rules-system-plan-intake.md` to the owner one
  item at a time, starting with D0; record approved wording durably. Then write
  the concrete phase and iterate pinned reviews to acceptance before any
  implementation. The synthesis must settle the die (the dice theater generalizes
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
- Both post-review housekeeping items are CLOSED (owner 2026-07-11, recorded
  in `.agents/decisions.md`): the six `fix/sv-*` branches are deleted
  (re-verified fully in master first), and the three accidental merge commits
  stay — history rewrite declined; do not re-propose it.

## Blockers

- Nothing technical. Network exposure for the playtest is owner-handled
  infrastructure (owner, 2026-07-09), not a repo task.

## Verification

- Automated: `AI_RETRY_BACKOFF_MS=10 node test.js` — green at `cae74df`. Run it
  rather than trusting a group count written here. The suite is hermetic:
  `RPG_DB_PATH` redirects it to a temp DB, closed and removed on exit (before
  2026-07-09 it opened the operator's real dev database).
- When a change ships with a test, prove the test guards it (AGENTS.md), and
  beware the vacuous guard — a test that re-implements the logic it checks
  cannot fail when the fix is reverted. This bit twice on 2026-07-09; the
  anti-pattern and its cure are recorded in `.agents/playbooks/reviewloop.md`.
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
