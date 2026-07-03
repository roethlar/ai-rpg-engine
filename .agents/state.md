# Agent State

This file is the first place future agents should read for current repo state. Keep it
short and update it when important repo facts change.

## Now

- Phase 0 first playtest session completed 2026-06-11 (campaign 1, Gemini, rules_mode on). Results: clarification metric PASSED mechanically — DB audit of turns table shows zero state mutation on both clarification turns (6, 9), Council no-op forcing fired correctly; qualitative clarification behavior strong (layered conditional answers, character-knowledge gating, scene grounding rendered styled). Rules_mode dice layer produced bad play (checks rolled for trivial actions via keyword matching, 5 failed checks → 33 HP loss; GM could not explain damage) — recorded as design evidence on the Council refactor entry in plan.md, not a Phase 0 fault.
- Owner plan review landed 2026-07-03: plan.md confirmed as-is. Owner green-lit the Council efficiency refactor (plan.md progress-log entry) to start now, ahead of the remaining Phase 0 over-conservatism probe (owner not playtesting today; probe still owed before Phase 0 is marked complete).
- Council efficiency refactor IMPLEMENTED 2026-07-03 (three commits: dead single-model path deleted; 2-call table-talk path with grounding verifier + `forceNoOpTurnState` in rpg-state.js; dice-before-narration with referee-adjudicated checks/consequences, engine rolls, roll records in turn state and turn context). Unit suite green; smoke-boot + legacy-campaign state load verified. NOT yet playtested — pending a rules_mode play session before the refactor counts as done per plan.md success check.
- Dialogue turns now force no-op state per decision 2026-06-05 (previously only clarification did). The validateTurnData net stays clarification-only on purpose: the opening turn is pinned to 'dialogue' so starting state survives; engine paths own dialogue no-op.
- Pre-playtest code review fixed 3 findings (act-pin in clarification safety net, non-vacuous dice test, .log-scene hsla CSS) + a Firefox-only suggested-choice page-reload bug (requestSubmit). Seven review findings remain queued below.
- Four durable decisions recorded 2026-06-11 in `.agents/decisions.md`: server-owned AI config, GM omniscience with canon commitment, GM authority final (player not in control), GM-not-DM terminology.
- Council pipeline is the active/only path; single-model branches are dead code (plan notes pending refactor).
- Local server not running (shut down at end of 2026-06-11 session; start with `npm start`, port 3000, no .env — provider/key entered in UI by owner).
- Tauri desktop shell added 2026-07-03 (plan.md Dev Tooling): `npm run desktop` after one-time `npm install --prefix desktop`. Spawn/reuse/kill-on-exit paths verified; owner still owes the plan's success check (window-close playthrough). Browser UI remains canonical.

## Next

- Next playtest covers two gates at once: the remaining Phase 0 over-conservatism check (confirm an unambiguous committed action still resolves crisply without clarification hedging) AND the Council refactor success check (clarification still zero-mutation with good scene_grounding on the 2-call path; committed actions adjudicate normally; rules_mode dice now sensible — few checks, explainable damage). Then owner judgment on real-GM feel → mark Phase 0 complete.
- DONE 2026-07-03: GM/DM rename sweep landed per the 2026-06-11 terminology decision (identifiers, prompts, UI, README, MCP server name `aetheria-gm-mcp`, docker-compose names). Historical records in plan.md/.agents/ intentionally keep old DM wording. External MCP client configs and docker containers referencing the old names need updating.
- All queued 2026-06-11 code-review findings are now CLOSED (2026-07-03): callClaude endpoint pinned (key-leak fix, tested); denied-action dice damage (denied actions no longer roll); triplicated clarification zeroing (consolidated into `forceNoOpTurnState`; takeTurn backstop + validateTurnData net remain as deliberate defense-in-depth); SVG quote-escape prompt rule restored; svg_illustration added to the per-turn output list. Also 2026-07-03: plan_v2.md merged into plan.md and deleted; leftover `.bootstrap-tmp/` removed by owner.
- DONE 2026-07-03 (Infrastructure Phases, functional gates passed — unit + smoke): Phase I1 server-owned AI config SHIPPED — `/admin` panel (ADMIN_SECRET-gated; open when unset in dev, fail-closed in production), `server_settings` table, resolution admin DB > env, client apiConfig ignored by all game routes, player panel reduced to access token/voice prefs/diagnostics. Phase I2 fallback tiering SHIPPED — transient errors retry once then fail over per-call to a backup tier (/admin or FALLBACK_* env); turn failures surface as an out-of-voice System notice with input restored. Decisions recorded 2026-07-03 in `.agents/decisions.md`.
- ⚠️ WORKFLOW CHANGE FOR OWNER: the game UI no longer accepts API keys. Before next play, open http://localhost:3000/admin once and enter provider + key (or set .env). Keys previously saved in browser localStorage are no longer sent and get purged on next settings save.
- Heroic/map layout mocks (banner / tall companion / supporting rail, with exploration↔combat toggle) committed at `docs/mockups/heroic-layouts.html` — open locally or via the published artifact; owner's layout pick unblocks promoting the maps/heroic topic.

- Design-questions backlog recorded 2026-06-13 in `plan.md` "Future Topics" (and a Phase 2 note): heroic/tactical-visual split + persistence-as-visual-identity; data store SQLite→Postgres driven by cross-campaign character ownership + check-in/out; player-only comms channel (never routed to the GM); provider/model-selection strategy (no hard-coded vendor model names; media-gen behind a provider seam); persistent NPC/GM voices. Owner explicitly not ready to decide any of these — pending discussion, nothing promoted to a phase. Also recorded: deployment is native (owner does not use Docker; the repo's Docker files were a prior-model addition).

## Blockers

- None recorded. (Depends on human starting a test campaign in the running server UI at http://localhost:3000 or 3001 and submitting the exact clarification test inputs.)

## Verification

- Automated: `node test.js` (or `npm run test`). Must pass before any code change completion. See `.agents/repo-map.json` and `test.js` for covered behaviors (JSON handling, clamping, Phase 0 clarification safety net, dice, concurrency).
- Manual: Full play session + feedback for Phase work and user-visible DM behavior (per Development Process rules in AGENTS.md). State clearly if a playtest was not run for a change.

## Active Sources

- `AGENTS.md`
- `.agents/repo-map.json`
- `.agents/decisions.md`
- `plan.md` (current improvement roadmap with Phase 0 status and review rules)
- `README.md` (features, install, MCP, providers, Council pipeline description)

## Unrecorded Repo Memory

- Detailed supported AI providers, Docker setup, voice narration, and MCP tool list live in README.md (current as of last read).
- Data model and SQLite/MCP details in db.js, server.js, rpg-state.js (not re-read in full for this bootstrap).
- .env.example and docker-compose.yml define production config surface (ACCESS_SECRET required for secure deploys).
