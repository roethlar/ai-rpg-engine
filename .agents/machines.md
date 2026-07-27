# Machine-Specific State

Tracked facts that are useful only on one development machine. Re-verify them during `catchup` and
delete entries as soon as they stop being true. Portable project state belongs in `.agents/state.md`.

## nagatha — verified 2026-07-15 at `ca55b55`

- Three registered detached worktrees still pin the abandoned css-2 commits:
  - `/private/tmp/css2-alias-probes-89215` → `0229679`
    - Dirty: modified `public/styles.css`; untracked `node_modules/`.
  - `/private/tmp/css2-r3-html-09398f79dea64f91b88bdf94032252c9` → `0229679`
    - Dirty: modified `public/index.html`; untracked `node_modules/`.
  - `/private/var/folders/lx/d63h0hdj7xj24tqp2gsplcrr0000gn/T/css2-alias-aa257d1f58a242e28cbf8230df4289af`
    → `b8d1b49`
    - Dirty: modified `public/index.html` and `public/styles.css`; untracked `node_modules/`.
- Re-verify registration/reachability with `git worktree list --porcelain` and
  `git rev-list --all`, and re-check each worktree with `git status --short`. Removing a registered
  worktree would discard or require preserving its local probe changes, so cleanup is destructive
  and requires an explicit owner go. After cleanup, delete this entry; do not refresh it as
  permanent history.
- harness-cli: codex.exe (recorded 2026-07-26, refresh offer)

## netwatch-01 — verified 2026-07-26 at `e1f8e7c`

- Playwright's Chromium executable is not installed, so `npm run test:browser` cannot run on this
  machine. Run the documented one-time setup, `npx playwright install chromium`, then delete this
  entry after the browser suite succeeds.
