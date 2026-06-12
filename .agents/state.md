# Agent State

This file is the first place future agents should read for current repo state. Keep it
short and update it when important repo facts change.

## Now

- Phase 0 (Clarification & Table-Talk, highest priority per plan.md) initial implementation complete. Interactive verification in progress: awaiting play session with ambiguous inputs ("Which goblin is closer? Can I throw my dagger at it?") plus follow-ups to validate non-advancing clarification turns, useful scene_grounding blocks, and zero unintended state mutations.
- Council DM pipeline is the active/only path; single-model branches are dead code (plan notes pending refactor).
- No open campaigns or persistent data issues noted in current evidence.

## Next

- Complete Phase 0: user performs targeted playtest in UI (with AI provider configured, preferably Council + strong model like grok or gemini), observe outputs for clarification behavior + scene grounding, refine prompts in rpg-prompts.js / rpg-engine.js / rpg-state.js if needed, then mark Phase 0 complete per review gate (full session test + demonstrated improvement) before commit.
- After Phase 0 lands: evaluate and potentially implement the Council efficiency refactor noted in plan.md (branch on input_kind post-Interaction to halve calls on clarification/dialogue turns; delete dead single-model path).
- Unscheduled: GM/DM rename sweep per the 2026-06-11 terminology decision (UI strings, prompts, README, identifiers like dmSystem) — mixed usage until then is known drift.
- Unscheduled (needs phase promotion): enforce server-owned AI config per the 2026-06-11 decision in `.agents/decisions.md` — client `apiConfig` currently overrides server env keys/provider/model. Also unscheduled: remaining 2026-06-11 code-review findings (denied-action dice damage in rules_mode, Grok key routing via CUSTOM_ENDPOINT_URL and per-role fallback, turn-1 clarification wipe, removed SVG quote-escape prompt rule, SVG omitted from turn prompt output list, triplicated clarification zeroing).

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
