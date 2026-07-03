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

- MECHANICAL GATES VERIFIED 2026-07-03 via live Ollama run (qwen3.6:27b, campaign 2 "The Drowning Crown", rules_mode on — kept in the dev DB as evidence and playable): admin-configured provider drives real turns; 2-call table-talk path classifies correctly with zero state mutation, act pin, grounding, ~55s vs minutes; committed action resolved crisply without hedging (partial over-conservatism evidence); referee ordered a warranted agility check with reasoning, the failed roll produced an adjudicated purely-narrative consequence (stealth compromised, 0 HP — the June anti-pattern is gone), narrative matched the result, roll record persisted; on a follow-up clarification the GM explained the failed check from the record (omniscience decision verified). DB audit of turns 1-4 clean.
- REMAINING for Phase 0 close: owner judgment on real-GM feel from an actual play session (the only unverifiable-by-agent gate). Ollama (qwen3.6:27b) is configured as the primary provider in /admin — playing is free; swap providers in /admin anytime.
- DONE 2026-07-03: GM/DM rename sweep landed per the 2026-06-11 terminology decision (identifiers, prompts, UI, README, MCP server name `aetheria-gm-mcp`, docker-compose names). Historical records in plan.md/.agents/ intentionally keep old DM wording. External MCP client configs and docker containers referencing the old names need updating.
- All queued 2026-06-11 code-review findings are now CLOSED (2026-07-03): callClaude endpoint pinned (key-leak fix, tested); denied-action dice damage (denied actions no longer roll); triplicated clarification zeroing (consolidated into `forceNoOpTurnState`; takeTurn backstop + validateTurnData net remain as deliberate defense-in-depth); SVG quote-escape prompt rule restored; svg_illustration added to the per-turn output list. Also 2026-07-03: plan_v2.md merged into plan.md and deleted; leftover `.bootstrap-tmp/` removed by owner.
- DONE 2026-07-03 (Infrastructure Phases, functional gates passed — unit + smoke): Phase I1 server-owned AI config SHIPPED — `/admin` panel (ADMIN_SECRET-gated; open when unset in dev, fail-closed in production), `server_settings` table, resolution admin DB > env, client apiConfig ignored by all game routes, player panel reduced to access token/voice prefs/diagnostics. Phase I2 fallback tiering SHIPPED — transient errors retry once then fail over per-call to a backup tier (/admin or FALLBACK_* env); turn failures surface as an out-of-voice System notice with input restored. Decisions recorded 2026-07-03 in `.agents/decisions.md`.
- ⚠️ WORKFLOW CHANGE FOR OWNER: the game UI no longer accepts API keys. Before next play, open http://localhost:3000/admin once and enter provider + key (or set .env). Keys previously saved in browser localStorage are no longer sent and get purged on next settings save.
- DONE 2026-07-03 evening: Phase I3 SHIPPED — five first-class AI roles (setup, interaction, continuity, referee, narration; narration split from interaction, setup from primary), all configurable per-role in /admin with precedence admin > role env (SETUP_*/NARRATION_* added) > primary, same-provider-only inheritance (tested + smoke-verified). Owner is /admin-first by explicit preference ("abhor env vars"). Env note: NARRATION_* now governs the final voice; INTERACTION_* no longer implicitly narrates.
- Heroic/map layout mocks at `docs/mockups/heroic-layouts.html` (also published as artifact). Owner verdicts 2026-07-03: static three — B best, A wastes a rail, C too squeezed; Layout D (dynamic spotlight: one info rail, click-to-focus any surface) judged GOOD, with one refinement applied: map and grounding text always coexist on positional turns (complements, never either/or — map on top, text as caption). Direction settled on D; promoting the maps/heroic phase still needs heroic identity anchors, image-gen provider seam, and structured location state scoped into a phase entry.
- DONE 2026-07-03 late: (1) Dynamic spotlight SHIPPED in the real UI (Phase 1 slice, plan.md): four spotlight buttons (visualizer/character/tabs/story), grid swaps, Esc restores, works in immersive + diagnostics layouts — owner one-look gate still owed (open the app, click through). (2) Shared applyCharacterUpdate/applyDiceConsequences extracted to rpg-state.js (was triplicated), unit-tested; repo-map.json refreshed. (3) TTS provider seam (tts-providers.js, voiceProvider in /admin) + voice-identity columns (campaigns.narrator_voice_json, npcs.voice_json) and validateVoiceProfile — plumbing only; per-line speaker/tone narration schema deliberately deferred behind the playtest gate.

- Design-questions backlog recorded 2026-06-13 in `plan.md` "Future Topics" (and a Phase 2 note): heroic/tactical-visual split + persistence-as-visual-identity; data store SQLite→Postgres driven by cross-campaign character ownership + check-in/out; player-only comms channel (never routed to the GM); provider/model-selection strategy (no hard-coded vendor model names; media-gen behind a provider seam); persistent NPC/GM voices. Owner explicitly not ready to decide any of these — pending discussion, nothing promoted to a phase. Also recorded: deployment is native (owner does not use Docker; the repo's Docker files were a prior-model addition).

- MULTI-VOICE SHIPPED 2026-07-03 (Phase 2 first cut, owner green-lit ahead of Phase 0 verdict): sticky NPC voice profiles (npcs.voice_json, assigned at creation + backfilled for existing campaigns), narrator emits speaker/tone-tagged narration_lines, engine resolves to turn.voiceLines, frontend plays sequentially with skip. Live-smoked on campaign 2 (Vera line → her cedar voice). Owner's playtest gate: voices distinct + consistent, narrator stays player-chosen, graceful fallback. Known refinement candidate: the player's own quoted words currently voice as narrator lines.
- Remotes: owner added public github remote 2026-07-03 (pushes it himself); origin (gitea) accumulating unpushed commits pending owner go.

- DECISIONS 2026-07-03 (recorded in `.agents/decisions.md`): no player-voice echo (prompt rule shipped); rulesets selectable at campaign start with generated house default (SHIPPED first cut — campaign 3 demo: themed 5-ability sheet, "what spells do I have?" answered from canon; owner judges before SRD options); genre theming agent-generated at campaign setup (accent graphics deferred — NOT yet implemented beyond existing theme_colors); image-gen provider-configurable behind a seam with identity-anchor param, local-on-5090 for dev (NOT yet implemented — unblocks heroic/map phase build).
- Owner-testable now: multi-voice narration (campaigns 1-3, voices backfilled), ruleset tab + canon answers (campaign 3 "Shadows of the Sunken Sands"), spotlight UI, skip button, voice preview.

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
