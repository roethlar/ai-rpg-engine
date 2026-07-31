# Machine-Specific State

Tracked facts that are useful only on one development machine. Re-verify them during `catchup` and
delete entries as soon as they stop being true. Portable project state belongs in `.agents/state.md`.

## nagatha — verified 2026-07-30 at `8320db7`

- harness-cli: codex.exe (recorded 2026-07-26, refresh offer)

## netwatch-01 — verified 2026-07-26 at `e1f8e7c`

- Playwright's Chromium executable is not installed, so `npm run test:browser` cannot run on this
  machine. Run the documented one-time setup, `npx playwright install chromium`, then delete this
  entry after the browser suite succeeds.
