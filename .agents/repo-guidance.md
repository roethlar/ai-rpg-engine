# Repo-Specific Guidance
<!-- Extends AGENTS.md; never overrides it. Rules and pointers only — state
     lives in .agents/state.md. -->

## Mission Detail

- This repo is an AI RPG engine: an AI game master ("GM") running campaigns
  through a multi-agent Council pipeline, played in a browser UI served by a
  local Node server.
- Core principle (evidence: plan.md): every change must improve *fun* and
  *feel* like a real GM. Avoid feature creep. Prioritize quality of
  interaction over new mechanics.
- The Council DM pipeline is the supported path for player turns
  (Interaction, Continuity, Referee, Continuity final check, Narration).
  Single-model paths are deprecated (decision 2026-06-05 in
  `.agents/decisions.md`).

## Development Process

- Work is organized into explicit phases (plan.md). Items in "Future Topics"
  (plan.md) are for discussion only: nothing may be implemented until it is
  promoted into a concrete phase with planned entries, success metrics, and
  files to change.
- Phase review gate (plan.md): after completing a phase's implementation
  work, run a full play session (ideally Council DM + strong or local model),
  gather feedback, and confirm the changes demonstrably improve the playing
  experience before treating the phase as complete or advancing. No code is
  merged/landed until it passes this gate.
- Durable decisions behind these rules are recorded in `.agents/decisions.md`
  (phased development with promotion gates, 2026-06-05; Council pipeline
  canonical, 2026-06-05; and later game-contract decisions).

## Reading Order

1. `.agents/state.md` — current state entry point (active work, blockers,
   next action).
2. `.agents/decisions.md` — durable decisions and supersessions.
3. `plan.md` — the living roadmap: phase details, review process, Future
   Topics backlog.
4. `README.md` — features, install, providers, Council pipeline description.

## Verification

- Automated: `node test.js` (or `npm run test`) — the repo's unit test suite
  (evidence: package.json `scripts.test`; suite covered in test.js). It must
  pass before claiming completion of any code change.
- Verification is local-only: the repo has no CI workflows (evidence:
  discovery scan found no provider-executable CI paths; see
  `.agents/repo-map.json` notes).
- Manual/playtest: for Phase work and user-visible GM behavior changes, run
  full play sessions and confirm improvement per the review gate above, or
  state clearly that a playtest was not run.

## Remotes & Sync

- Two remotes: `origin` = `http://q.internal:3000/michael/ai-rpg-engine` (LAN
  gitea) and `github` = `https://github.com/roethlar/ai-rpg-engine.git`
  (public — added by the owner 2026-07-03; the owner also pushes it
  directly). The repo being public means tracked files must never contain
  secrets (tracked files verified clean 2026-07-03; .env and data/ are
  gitignored).
- Push policy lives in `.agents/push-policy.md` and applies to both remotes:
  a push go means pushing master to both unless the owner says otherwise.
