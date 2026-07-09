# Agent State

This file is the first place future agents should read for current repo state. Keep it
short and update it when important repo facts change.

## Now

- **MULTIPLAYER REOPENED (owner, 2026-07-09).** Target: a playtest with a
  second human on their own machine outside the owner's network. The
  2026-07-05 multi-user decision (per-seat credentials, scoped visibility)
  is active again; Phase S is unparked. Connectivity (transport/TLS/
  tunneling) is owner-handled, out of repo scope. Repo scope: S2
  (seat-scoped visibility — closes the dormant read-everything caveat and
  the voiceLines personality leak), then S3 (seat bootstrap/join UI +
  README seat-flow rewrite). Decision entry 2026-07-09 in
  `.agents/decisions.md`.
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
- Push state: both remotes (gitea origin + github) hold master at 9effed2,
  identical to local HEAD (verified via ls-remote, 2026-07-09). The Phase S
  work, the park decision, and the 2026-07-05 handoff are all pushed — the
  owner pushed after that handoff recorded them as local-only. Future pushes
  still need an explicit owner go (`.agents/push-policy.md`).
- Image generation remains unconfigured (no provider in /admin): heroics
  inert by design. Feel gates (Phase 0, layouts, voices, rulesets, dials,
  locations/map) are open with NO scheduled close.

## Next

- Build S2 (seat-scoped visibility) per the codex-approved Phase S plan in
  plan.md — mechanism-independent, no owner input needed.
- Then S3 (seat bootstrap/join flow + README hosting rewrite to the seat
  flow — clears the recorded README staleness).
- The remote two-human playtest is the pending close point for the open
  feel gates (2026-07-04 delegation framing restored by the reopen
  decision).

## Blockers

- Nothing technical is blocked. Network exposure for the remote playtest is
  owner-handled infrastructure (their word, 2026-07-09), not a repo task.

## Verification

- Automated: `AI_RETRY_BACKOFF_MS=10 node test.js` — 24 groups, green at
  9effed2 (re-verified 2026-07-09). Desktop shell (Rust) outside it:
  `cargo build` in desktop/src-tauri.
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
