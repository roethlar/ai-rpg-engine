# Agent State

This file is the first place future agents should read for current repo state. Keep it
short and update it when important repo facts change.

## Now

- **MULTIPLAYER REOPENED (owner, 2026-07-09) — S2 + S3 BUILT same day.**
  Target: a playtest with a second human on their own machine outside the
  owner's network; connectivity (transport/TLS/tunneling) is owner-handled,
  out of repo scope. Landed 2026-07-09: S2 seat-scoped visibility
  (whitelist-built seat payloads — own sheet full, silhouettes, shared
  surfaces; no outline/NPC notes/memories/summary/dials; sanitized journal;
  voiceLines stripped to speaker/tone/text with the narrate route resolving
  stored voice profiles server-side — closes the S1 read-everything caveat
  and the personality leak) and S3 seat sessions (seat token in the token
  field boots via /api/seat/session; host-only chrome hidden; host mint-seat
  key button on party chips; README rewritten to the seat flow — staleness
  cleared). Leak guards proven by sabotage; API-level live smoke clean
  (leak scan, 403s on all meta routes + cross-campaign, revoked seat dies).
  The two-browser end-to-end is what the playtest itself exercises.
  Decision entry 2026-07-09 in `.agents/decisions.md`.
- Also in the tree, unchanged by S2/S3: multi-character schema + round-robin
  turn order (Phase 3 M1–M3), seats S1 (per-seat tokens, server-side
  character binding, host/seat route guards). S2 closes the S1-era "a seat
  can READ full campaign state" caveat. The 2026-07-09 cross-model review
  then found six more issues: five are merged (sv-1 stale-seat/TOCTOU
  takeover, sv-3, sv-4 nested quest values, sv-5, sv-6). **sv-2 is NOT yet
  on master** — a seat can still receive internal error text, including raw
  model output, through HTTP error bodies. Do not call seat isolation
  complete until `fix/sv-2-seat-error-sanitization` lands. Solo play with no
  seats minted behaves exactly as before, as it always has.
- Also landed 2026-07-04/05, all playable solo: Visual Phases V1–V4 + T1
  (image seam, structured locations + deterministic map, engine-owned
  current_heroic, agent-generated theming), V5 gap closers, Phase D
  table-style dials (classic/standard defaults), Phase H holodeck idle,
  Phase P campaign export/import (test-fixtures/campaign-bundle-v1.json is
  the pinned forward-importability guard — never regenerate it; migrations
  go in validateCampaignBundle).
- Reviews: `.agents/review/index.md` owns the finding tables, counts, and
  status of every loop (the 2026-07-05 loop, closed; the 2026-07-09 seat
  loop, active) — read it there, never a copy here. A codex plan pass also
  shaped Phase S before it was parked. Codex incantation cache:
  `.agents/review/harnesses.local.json` (gitignored; codex exec needs
  `< /dev/null` on stdin and generous timeouts).
- Push state: both remotes (gitea origin + github) hold master at 9effed2
  (verified via ls-remote 2026-07-09); everything after — the 2026-07-09
  drift fix, reopen decision, and S2/S3 work — is LOCAL ONLY pending an
  owner go (`.agents/push-policy.md`).
- Image generation remains unconfigured (no provider in /admin): heroics
  inert by design. Feel gates (Phase 0, layouts, voices, rulesets, dials,
  locations/map) remain open; their scheduled close is the remote two-human
  playtest (decision 2026-07-09), which is the `## Next` item below.

## Next

- The remote two-human playtest, which closes the open feel gates
  (2026-07-04 delegation framing restored by the reopen decision).
  Before play, the owner: sets ACCESS_SECRET + ADMIN_SECRET, exposes the
  server (owner-handled), creates the second character (+ Join), mints its
  seat (key button on the party chip), sends the token to the other player.
- Push needs an owner go (`.agents/push-policy.md`). Local is ahead of both
  remotes; ask git for the count rather than trusting a number written here:
  `git rev-list --count 9effed2..HEAD`.

- Active review loop (owner-invoked 2026-07-09): codex cross-model review
  of the landed S2/S3 range — see `.agents/review/index.md` for the finding
  table and status. That file owns the enumeration; do not copy it here.

## Blockers

- Nothing technical is blocked. Network exposure for the remote playtest is
  owner-handled infrastructure (their word, 2026-07-09), not a repo task.

## Verification

- Automated: `AI_RETRY_BACKOFF_MS=10 node test.js` — green on master; run it
  rather than trusting a group count written here. The suite is hermetic as
  of the sv-1 merge (`RPG_DB_PATH` redirects it to a temp DB, closed and
  removed on exit); before that it opened the operator's real dev database.
  Desktop shell (Rust) outside it: `cargo build` in desktop/src-tauri.
- Live: `node server.js` (Ollama qwen3.6:27b configured, free). Seat flows
  smoke-verified with ACCESS_SECRET set; without it, solo dev is unchanged.

## Active Sources

- `AGENTS.md`, `.agents/repo-guidance.md`, `.agents/decisions.md`,
  `.agents/playbooks/reviewloop.md`
- `plan.md` (all phases; Phase S S1–S3 landed 2026-07-09; current priority =
  the remote two-human playtest)
- `README.md` — hosting section rewritten to the seat flow (2026-07-09);
  no longer stale
- `docs/ruleset-licensing.md` (evidence for the dropped-rulesets decision)

## Unrecorded Repo Memory

- Engine: db.js / rpg-state.js / rpg-engine.js; prompts rpg-prompts.js;
  seams api-client.js (text), tts-providers.js (speech), image-providers.js
  (images); map-render.js; seat-auth.js; admin/ panel; .agents/review/
  (closed loop records + guard-check scripts).
- Dev DB (gitignored, machine-local — contents drift with every play
  session; ask sqlite rather than trusting a list here): `data/rpg_engine.db`
  holds the owner's dev campaigns, with a pre-M1 backup at
  `data/rpg_engine.pre-m1-backup.db`.
- The party-strip "+ Join" button is HOST-only (it creates characters); a
  host also mints each character's seat token from the key icon beside its
  chip. Seat sessions see neither control.
