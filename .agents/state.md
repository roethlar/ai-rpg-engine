# Agent State

This file is the first place future agents should read for current repo state. Keep it
short and update it when important repo facts change.

## Now

- **MULTIPLAYER IS PARKED (owner, 2026-07-05).** It flipped back to an open,
  undecided question; testing is parked; no priority is set anywhere. Do not
  resume any multiplayer work (no S2/S3, no Phase 3 extensions) unless the
  owner explicitly reopens it. Decision entry: "Multiplayer is an OPEN
  question" in `.agents/decisions.md`.
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
- Push state: both remotes (gitea origin + github) hold master through
  commit 852bf14. Everything after — Phase S plan + S1 code, the park
  decision, this handoff — is LOCAL ONLY. Pushing needs an explicit owner go
  (`.agents/push-policy.md`).
- Image generation remains unconfigured (no provider in /admin): heroics
  inert by design. Feel gates (Phase 0, layouts, voices, rulesets, dials,
  locations/map) are open with NO scheduled close.

## Next

- Await the owner. They said they cannot work on this now; when they point
  at something, that is the priority. Do not manufacture work.
- If multiplayer reopens: the parked design history is intact (multi-user
  decision + Phase S plan with codex findings applied in plan.md); S1 code
  is live; S2 (seat-scoped visibility incl. the voiceLines personality leak)
  and S3 (seat UI/bootstrap) were never built.
- If asked to revert multiplayer code instead: nothing prepared; scope fresh
  with the owner.

## Blockers

- Owner bandwidth only. Nothing technical is blocked.

## Verification

- Automated: `AI_RETRY_BACKOFF_MS=10 node test.js` — 24 groups, green at
  HEAD. Desktop shell (Rust) outside it: `cargo build` in desktop/src-tauri.
- Live: `node server.js` (Ollama qwen3.6:27b configured, free). Seat flows
  smoke-verified with ACCESS_SECRET set; without it, solo dev is unchanged.

## Active Sources

- `AGENTS.md`, `.agents/repo-guidance.md`, `.agents/decisions.md`,
  `.agents/playbooks/reviewloop.md`
- `plan.md` (all phases; Phase S marked PARKED; no current priority)
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
