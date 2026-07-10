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
- Landed and inert-for-solo in the tree: multi-character schema + round-robin
  turn order (Phase 3 M1–M3), seats S1 (per-seat tokens, server-side
  character binding, host/seat route guards — live-smoke verified). Dormant
  caveat, on record: S2 never landed, so a seat token — if ever minted — can
  act only as its own character but can still READ full campaign state
  (outline, NPC notes, memories) from the API.
- Also landed 2026-07-04/05, all playable solo: Visual Phases V1–V4 + T1
  (image seam, structured locations + deterministic map, engine-owned
  current_heroic, agent-generated theming), V5 gap closers, Phase D
  table-style dials (classic/standard defaults), Phase H holodeck idle,
  Phase P campaign export/import (test-fixtures/campaign-bundle-v1.json is
  the pinned forward-importability guard — never regenerate it; migrations
  go in validateCampaignBundle).
- Reviews: 21 same-model findings fixed (2026-07-04); cross-model reviewloop
  (playbook, reviewer codex) closed 2026-07-05, 4/4 verified and merged;
  a codex plan pass shaped Phase S before it was parked. Codex incantation
  cache: `.agents/review/harnesses.local.json` (gitignored; codex exec needs
  `< /dev/null` on stdin and generous timeouts).
- Push state: both remotes (gitea origin + github) hold master at 9effed2
  (verified via ls-remote 2026-07-09); everything after — the 2026-07-09
  drift fix, reopen decision, and S2/S3 work — is LOCAL ONLY pending an
  owner go (`.agents/push-policy.md`).
- Image generation remains unconfigured (no provider in /admin): heroics
  inert by design. Feel gates (Phase 0, layouts, voices, rulesets, dials,
  locations/map) are open with NO scheduled close.

## Next

- The remote two-human playtest, which closes the open feel gates
  (2026-07-04 delegation framing restored by the reopen decision).
  Before play, the owner: sets ACCESS_SECRET + ADMIN_SECRET, exposes the
  server (owner-handled), creates the second character (+ Join), mints its
  seat (key button on the party chip), sends the token to the other player.
- Push: local is 7 commits ahead of both remotes (at 9effed2, as of this
  handoff) — drift fix, reopen decision, S2/S3, docs. Needs an owner go
  (`.agents/push-policy.md`).

## Blockers

- Nothing technical is blocked. Network exposure for the remote playtest is
  owner-handled infrastructure (their word, 2026-07-09), not a repo task.

## Verification

- Automated: `AI_RETRY_BACKOFF_MS=10 node test.js` — 25 groups (seat
  visibility scoping joined 2026-07-09), green at 2c3e131. Desktop shell
  (Rust) outside it: `cargo build` in desktop/src-tauri.
- Live: `node server.js` (Ollama qwen3.6:27b configured, free). Seat flows
  smoke-verified with ACCESS_SECRET set; without it, solo dev is unchanged.

## Active Sources

- `AGENTS.md`, `.agents/repo-guidance.md`, `.agents/decisions.md`,
  `.agents/playbooks/reviewloop.md`
- `plan.md` (all phases; Phase S REOPENED 2026-07-09; current priority =
  remote playtest readiness, S2 → S3)
- `README.md` — note: its multiplayer/hosting section still describes the
  parked shared-token flow (stale relative to the park; harmless solo;
  revisit only if the topic reopens)
- `docs/ruleset-licensing.md` (evidence for the dropped-rulesets decision)

## Unrecorded Repo Memory

- Engine: db.js / rpg-state.js / rpg-engine.js; prompts rpg-prompts.js;
  seams api-client.js (text), tts-providers.js (speech), image-providers.js
  (images); map-render.js; seat-auth.js; admin/ panel; .agents/review/
  (closed loop records + guard-check scripts).
- Dev DB (gitignored): campaigns 1 "Velvet Protocol" (two characters, Joe +
  Mira; Mira's smoke seat revoked), 2 "The Drowning Crown", 3 "Shadows of
  the Sunken Sands", 4 "Steel Echoes". Pre-M1 backup:
  data/rpg_engine.pre-m1-backup.db.
- The party-strip "+ Join" UI and README hosting section reflect the parked
  shared-token multiplayer; harmless solo.
