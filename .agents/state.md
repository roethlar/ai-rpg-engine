# Agent State

This file is the first place future agents should read for current repo state. Keep it
short and update it when important repo facts change.

## Now

- 2026-07-04/05: two large deliveries in one running session, all committed to master
  (working tree clean, NOT pushed — pushes need an explicit owner go).
  1. **Visual Phases V1–V4 + T1** (image seam, structured locations + map, engine-owned
     current_heroic, Layout D wiring, agent-generated theming) — see plan.md Visual
     Phases + Progress Log; 11 review findings fixed same-day.
  2. **The delegated 2026-07-04 queue** (owner: nothing gated on them until the
     multiplayer playtest; plans approved via codex CLI review loop — 7→2→0 findings):
     Phase 3 multiplayer v1 (M1 multi-character schema w/ atomic migration + arrival
     baselines; M2 round-robin with gate-after-classification, speaking-vs-acting
     characters, per-character release; M3 join flow + party UI + per-browser identity
     + gap-backfilling poll; M4 README), V5 gap closers (opening location/heroic,
     generated NPC appearance anchors, sticky positional), Phase D table-style dials
     (classic + standard defaults, structural enforcement, pacing as recorded
     world-turn cadence), Phase H holodeck idle, Phase P export/import (versioned
     bundle; test-fixtures/campaign-bundle-v1.json is the pinned forward-importability
     guard — never regenerate it, migrations go in validateCampaignBundle).
- A 26-agent adversarial review of the queue confirmed 21 unique defects; ALL fixed,
  one commit each (highlights: denials no longer consume the acting player's turn via
  the engine-stamped action_resolved flag; startup backfill no longer resurrects
  released characters as ghost profiles; campaign list aggregates the party; bundle
  hardening; poll race/backfill/identity-claim fixes). Suite: 23 groups green.
- Live smokes performed via API with the configured Ollama model: campaign 3 committed
  action (V2 pipeline), campaign 4 "Steel Echoes" created (V5a opening location,
  Orbitron/Special Elite theming), campaign 1 is now a ready TWO-CHARACTER test table
  (Joe + Mira; Testa released — release/ghost paths verified live), export→import
  round-trip verified then the artifact deleted.
- Decisions recorded 2026-07-04 (.agents/decisions.md): external rulesets DROPPED
  entirely ("forget the system" — house system is the system; docs/ruleset-licensing.md
  kept as evidence incl. the no-whole-work-attribution constraint); owner delegation
  (codex review loop instead of owner plan sign-off for this queue); dial option
  sets/defaults; portability format; multiplayer v1 shape.
- Image generation still configured OFF (no provider in /admin): heroics inert by
  design. dev DB backup from before the M1 migration: data/rpg_engine.pre-m1-backup.db.

## Next

- **The owner's multiplayer playtest is the single gate that closes everything**:
  Phase 0 feel, spotlight/Situation/heroic layouts, voices, rulesets, locations/map,
  dials (classic default!), and multiplayer itself. Two browsers on campaign 1 is the
  intended demo. No playtests before that per owner 2026-07-04.
- To see heroics: set an image provider in /admin → Scene Images (loopback SD-WebUI
  URL, or an OpenAI key; non-loopback endpoints must be pinned via IMAGE_ENDPOINT_URL).
- Post-playtest backlog (recorded, unscheduled): in-app player-only chat channel
  (fork decided in-app, never routed to the GM), per-player auth, initiative-based
  ordering, SSE/websocket replacing the 12s poll, appearance-descriptor for import
  bundles' baselines, desktop-shell test coverage.
- Owner may want a push (master → both remotes per .agents/push-policy.md) — needs
  their explicit go.

## Blockers

- None hard. Everything pending is the owner playtest or post-playtest backlog.

## Verification

- Automated: `node test.js` (AI_RETRY_BACKOFF_MS=10 to skip retry sleeps) — 23 groups,
  green at head. Desktop shell (Rust) outside it: `cargo build` in desktop/src-tauri.
- Live: `node server.js`, play via browser or curl; Ollama (qwen3.6:27b) is free.
  Multiplayer flows live-verified 2026-07-04/05 (join, out-of-turn 409, release).

## Active Sources

- `AGENTS.md`, `.agents/repo-guidance.md`, `.agents/decisions.md`, `.agents/repo-map.json`
- `plan.md` (phases incl. Visual Phases + 2026-07-04 Queue, Future Topics, progress log)
- `README.md` (features incl. shared tables, hosting instructions)
- `docs/ruleset-licensing.md` (evidence for the dropped-rulesets decision)

## Unrecorded Repo Memory

- Engine: db.js/rpg-state.js/rpg-engine.js; prompts in rpg-prompts.js; provider seams
  api-client.js (text), tts-providers.js (speech), image-providers.js (images);
  map-render.js (deterministic maps); admin/ panel; test-fixtures/ (pinned bundle).
- Dev DB (gitignored) campaigns: 1 "Velvet Protocol" (two-character multiplayer test
  table), 2 "The Drowning Crown", 3 "Shadows of the Sunken Sands" (ruleset + V2
  evidence), 4 "Steel Echoes" (V5a/T1 evidence). Profiles cleaned of test ghosts.
- The codex CLI (0.142.5) is installed and was used for the plan review loop.
