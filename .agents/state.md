# Agent State

This file is the first place future agents should read for current repo state. Keep it
short and update it when important repo facts change.

## Now

- 2026-07-03 was a large landing day (~42 commits). Shipped, all unit-tested and mostly
  live-smoked: Council efficiency refactor (2-call table-talk path, dice-before-narration
  with referee-adjudicated consequences, dialogue no-op per decision 2026-06-05); GM/DM
  rename sweep; all queued 2026-06-11 review findings closed; server-owned AI config with
  `/admin` panel (Phases I1–I3: ADMIN_SECRET gate, five per-role model slots incl. new
  setup/narration roles, fallback tiering, voice provider seam); Tauri desktop shell
  (`npm run desktop`; Server menu → Open Admin Panel); dynamic spotlight layout in the
  game UI; multi-voice narration with sticky per-NPC voice profiles (no player echo);
  campaign rulesets (generated house system as canon state, Rules tab, wizard select);
  heroic/map layout mocks (owner picked Layout D; map + grounding text always coexist).
  Details: `.agents/decisions.md` (nine decisions dated 2026-07-03), plan.md phase
  entries, commit messages.
- Mechanical gates verified via live Ollama runs (qwen3.6:27b; campaigns 2 "The Drowning
  Crown" and 3 "Shadows of the Sunken Sands" kept in the dev DB as evidence, both
  playable): admin-configured provider drives real turns; clarification turns are
  zero-mutation and ~1 min; referee orders warranted checks with narrative-matching
  consequences; the GM explains its own rolls (omniscience) and answers "what spells do
  I have?" from the canon rule sheet; NPC dialogue lines resolve to sticky stored voices.
- Ollama (qwen3.6:27b) is the configured primary provider in /admin — play is free;
  swap any role's model in /admin. Voice narration confirmed working by owner (OpenAI).
- Remotes: origin (LAN gitea) + public github (owner-added 2026-07-03; see
  `.agents/repo-guidance.md`). Tracked files verified secret-free.
- WebKitGTK caveat is live: the desktop shell runs with dmabuf disabled (NVIDIA
  workaround), which kills backdrop-filter and can stall CSS animations. Three UI bugs
  already fixed under it (light selects, transparent modals, invisible-text risk).
  Cross-check rendering oddities in Firefox before treating them as product bugs.

## Next

- Owner feel-verdicts — the only gates an agent cannot close: Phase 0 real-GM feel;
  spotlight layout one-look; multi-voice quality (echo rule untested in play); ruleset
  consistency across sessions (campaign 3 is the demo). Each verdict closes its phase.
- Buildable now on recorded decisions, no further owner input needed:
  1. Heroic/map phase (biggest): Layout D shipped as the shell; needs image provider
     seam (registry like TTS, /admin-configurable, identity-anchor param in the
     interface from day one, local 5090 provider for dev), engine-owned current_heroic,
     structured location state. Design fully recorded in plan.md maps topic.
  2. Agent-generated genre theming at campaign setup (decision recorded; extends the
     existing theme_colors generation; accent graphics deferred).
  3. SRD-based ruleset options (owner judges the house default first; verify licenses
     before adopting any SRD text).
- Housekeeping candidates: Progress Log entries in plan.md for the I-phases are thin
  (state.md + commits carry the detail); desktop shell has no automated test coverage.

## Blockers

- None hard. Everything pending is either an owner verdict or a next build.

## Verification

- Automated: `node test.js` (set AI_RETRY_BACKOFF_MS=10 to skip retry-test sleeps).
  Must pass before claiming completion of any code change. Desktop shell (Rust) is
  outside it: `cargo build` in `desktop/src-tauri`.
- Live: real turns are free via the configured Ollama provider — start `node server.js`,
  curl the API (2026-07-03 sessions demonstrate the pattern). GM-feel gates need owner
  play sessions per the Development Process rules.

## Active Sources

- `AGENTS.md`, `.agents/repo-guidance.md`, `.agents/decisions.md`, `.agents/repo-map.json`
- `plan.md` (roadmap: phases, Infrastructure Phases, Future Topics, progress log)
- `README.md` (features, install, /admin config story, roles, desktop shell)

## Unrecorded Repo Memory

- Engine data model detail lives in db.js/rpg-state.js/rpg-engine.js; admin panel in
  admin/; provider seams in api-client.js (text) and tts-providers.js (speech).
- The dev DB (data/, gitignored) holds campaigns 1-3 including the two live-test
  campaigns; deleting them loses the 2026-07-03 verification evidence but nothing else.
- Layout mocks artifact URL (claude.ai) is session-published; the canonical copy is
  `docs/mockups/heroic-layouts.html`.
