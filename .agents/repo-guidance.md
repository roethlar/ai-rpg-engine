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
  discovery scan found no provider-executable CI paths, 2026-06-10; the
  `.agents/repo-map.json` that carried the notes was retired 2026-07-08 —
  this section is the canonical home).
- Manual/playtest: for Phase work and user-visible GM behavior changes, run
  full play sessions and confirm improvement per the review gate above, or
  state clearly that a playtest was not run.

## Scope Before Falsifying (learned 2026-07-09, twice)

Before recording a repo claim as false, establish that you checked it in the
scope where it was asserted. Absence in *your* scope is not falsity.

- **Machine scope.** The owner develops across several machines. Provider
  config (`.env`, `AI_PROVIDER`, admin `ai_config`), the gitignored dev DB and
  its backups, and `*.local.*` caches are all machine-local and legitimately
  differ per host. A note recorded elsewhere is not stale merely because the
  file is missing here. Prefer omitting per-host observations to recording
  them: a hostname in a tracked file rots on the next machine and invites the
  next agent to "correct" it. Record the *rule* (this config is machine-local;
  check it where you are), never the reading.
- **Branch scope.** A fact true on a sibling branch is not true on yours. Check
  `git merge-base --is-ancestor` before asserting that a landed change holds
  where you are writing.
- **Failure mode this prevents:** both variants occurred in one session — a
  test-suite property asserted from an unmerged branch as though it held on
  the current one, and two true machine-local notes deleted as "false" because
  a *different* machine lacked the files. Same error each time: a true
  statement, judged against the wrong scope.

Applies to `drift` and `handoff` especially, whose whole job is deciding which
recorded facts still hold.

## Remotes & Sync

- Two remotes: `origin` = `http://q.internal:3000/michael/ai-rpg-engine` (LAN
  gitea) and `github` = `https://github.com/roethlar/ai-rpg-engine.git`
  (public — added by the owner 2026-07-03; the owner also pushes it
  directly). The repo being public means tracked files must never contain
  secrets (tracked files verified clean 2026-07-03; .env and data/ are
  gitignored).
- Push policy lives in `.agents/push-policy.md` and applies to both remotes:
  a push go means pushing master to both unless the owner says otherwise.
