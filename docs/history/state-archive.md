# State Archive

Landed or superseded entries rotated verbatim out of `.agents/state.md` so its
`## Now` holds only live items. Newest first. This file is history, not current
state — never read it to answer "what is true now".

---

## Rotated 2026-07-09 (handoff)

### S2 + S3 built, reviewed, and merged (2026-07-09)

- **MULTIPLAYER REOPENED (owner, 2026-07-09) — S2 + S3 BUILT same day.**
  Target: a playtest with a second human on their own machine outside the
  owner's network; connectivity (transport/TLS/tunneling) is owner-handled,
  out of repo scope. Landed 2026-07-09: S2 seat-scoped visibility
  (whitelist-built seat payloads — own sheet full, silhouettes, shared
  surfaces; no outline/NPC notes/memories/summary/dials; sanitized journal;
  voiceLines stripped to speaker/tone/text with the narrate route resolving
  stored voice profiles server-side) and S3 seat sessions (seat token in the
  token field boots via /api/seat/session; host-only chrome hidden; host
  mint-seat key button on party chips; README rewritten to the seat flow).
  Decision entry 2026-07-09 in `.agents/decisions.md`.

- The 2026-07-09 cross-model review (codex) then found six defects in that
  work; all six were fixed and merged the same day. Detail and verdict trail:
  `.agents/review/index.md` and `.agents/review/findings/sv-*.md`. The durable
  lesson survives in `.agents/state.md`, not here.

### Earlier phase work (2026-07-04/05)

- Landed, all playable solo: Visual Phases V1–V4 + T1 (image seam, structured
  locations + deterministic map, engine-owned current_heroic, agent-generated
  theming), V5 gap closers, Phase D table-style dials (classic/standard
  defaults), Phase H holodeck idle, Phase P campaign export/import.
- Phase 3 M1–M3 (multi-character schema, round-robin turn order) and Phase S1
  (per-seat tokens, server-side character binding, host/seat route guards).
- The 2026-07-05 codex review loop: closed, 4/4 verified and merged. A codex
  plan pass shaped Phase S before it was parked (park later reversed by the
  2026-07-09 reopen decision).
