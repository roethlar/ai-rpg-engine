# Agent State

This file is the first place future agents should read for current repo state. Keep it
short and update it when important repo facts change. Landed/superseded entries rotate
to `docs/history/state-archive.md`.

## Now

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
- No AI provider is configured on this machine (`nagatha.local`): no `.env`,
  no `AI_PROVIDER` env, no persisted admin `ai_config` row — so `node
  server.js` resolves the built-in default, and `/admin` must be used before
  any live play. Image generation likewise unconfigured: heroics inert by
  design.
- Push state (as of `477bf3e`): both remotes (gitea `origin` + `github`) hold
  master at `9effed2`; everything since is LOCAL ONLY and needs an owner go
  (`.agents/push-policy.md`). Re-derive the gap with
  `git rev-list --count 9effed2..HEAD` rather than trusting a number here.

## Next

- Run the playtest. Owner steps before play: set `ACCESS_SECRET` +
  `ADMIN_SECRET`, configure an AI provider in `/admin`, expose the server,
  create the second character (party strip **+ Join**, host-only), mint its
  seat (key icon beside the chip), send that token to the other player.
- Decide the fate of six `fix/sv-*` branches, all fully merged to master and
  safe to delete once you are satisfied (`git branch -d`).
- Decide whether to tidy history: three merge commits on master
  (`0eccda6`, `aeb93d5`, `7b2bc64`) were created by an agent shell accident on
  2026-07-09, then superseded by correct forward-merges. Harmless and
  content-verified; removing them means a history rewrite, which needs an
  explicit owner go.

## Blockers

- Nothing technical. Network exposure for the playtest is owner-handled
  infrastructure (owner, 2026-07-09), not a repo task.

## Verification

- Automated: `AI_RETRY_BACKOFF_MS=10 node test.js` — green at `477bf3e`. Run it
  rather than trusting a group count written here. The suite is hermetic:
  `RPG_DB_PATH` redirects it to a temp DB, closed and removed on exit (before
  2026-07-09 it opened the operator's real dev database).
- Guard rule that keeps paying off: a test that duplicates the logic it guards
  is vacuous. Extract the predicate (`findLiveSeat`, `boundVoiceDirective`,
  `selectSpeakingCharacter`, `errorPayloadFor`) and test THAT, then prove it by
  reverting the production code and watching the suite go red.
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
- Machine-local (`nagatha.local`): the gitignored dev DB `data/rpg_engine.db`
  holds a couple of throwaway campaigns — the owner has no real ones
  ("I don't have any real campaigns. just tests.", 2026-07-09). Ask sqlite,
  never a list here. There is no pre-M1 backup file despite older notes.
- The party-strip **+ Join** button is HOST-only (it creates characters); the
  host mints each character's seat token from the key icon beside its chip.
  Seat sessions see neither control.
- Codex reviewer incantation cache: `.agents/review/harnesses.local.json`
  (gitignored, machine-local). `codex exec` needs `< /dev/null` on stdin and
  generous timeouts.
