# Agent State

This file is the first place future agents should read for current repo state. Keep it
short and update it when important repo facts change.

## Now

- 2026-07-04: the Visual Phases landed on the owner's "do as much as you can without
  my feels" go — plan.md promoted V1–V4 + T1 to concrete phases, then all five shipped
  with guard-proven tests (suite green, 19 test groups): V1 image provider seam
  (openai/sdwebui registry, identity anchors, /admin "Scene Images", key-safety
  proven); T1 agent-generated theming (text/text_dim slots + font pool; generated
  themes beat curated presets; legacy campaigns render unchanged); V2 structured
  locations (locations table, referee-gated signal, one-time layout generation,
  deterministic map SVG, both no-op layers extended); V3 engine-owned current_heroic
  (focal signal, stickiness with thrash guard, synchronous renders behind the seam,
  campaign_images + authenticated image route); V4 frontend (heroic in the visualizer
  slot via authed blob fetch, Situation panel with coexisting map+grounding, spotlight
  integration). Details: plan.md Visual Phases + Progress Log; ~20 commits today.
- V2 was live-smoked end to end on campaign 3 with the configured Ollama model
  (qwen3.6:27b): committed action → referee location signal → generated 4-area layout
  "Ancient Ruins Chamber" → positional flag, player occupancy, map SVG — persisted and
  correct on reload. That smoke turn appended turn 3 to campaign 3.
- A 16-agent adversarial review of the session diff confirmed 12 findings (11 unique);
  all fixed, one commit each: table-talk backstop now clears focal_subject; heroic
  location subjects render from their own record; forks replay location state to the
  fork point; case-insensitive stickiness; non-object model JSON coerced before no-op
  forcing (quest-hijack path closed); image route never echoes fs paths; admin
  SD-WebUI endpoints loopback-only (SSRF); heroic/situation surfaces reset on campaign
  switch; heroic fetch race token; narrow-viewport spotlight grid reset.
- SRD licensing verified (docs/ruleset-licensing.md, adversarially checked): CC0 Sine
  Nomine SRDs safest; D&D 5.1/5.2.1 + Fate (CC-BY-3.0!) attribution-only; YZE excludes
  video games; Knave 2e / Mongoose Traveller closed. No SRD text adopted.
- Image generation is configured OFF (no provider set): heroics are inert and the SVG
  visualizer path is unchanged — exactly the designed default. Ollama remains the
  primary text provider; WebKitGTK dmabuf caveat unchanged.

## Next

- Owner feel-verdicts (the only gates an agent cannot close): Phase 0 real-GM feel;
  spotlight/Situation/heroic layout one-look (V4 click-through); multi-voice quality;
  ruleset consistency; NEW — locations/map in play (campaign 3 turn 3 is the live
  demo), and heroic renders once an image provider is configured.
- To exercise V3 for real: set an image provider in /admin — sdwebui pointed at a
  local SD-WebUI (loopback URLs only in the panel; other hosts via IMAGE_ENDPOINT_URL
  env) or OpenAI Images with a key. Then play a committed action that enters a new
  location or confronts an NPC.
- Buildable next on recorded decisions: SRD ruleset options (licensing evidence is in
  docs/ruleset-licensing.md; still gated on the owner judging the house default);
  known V-phase first-cut gaps listed in plan.md Progress Log (opening-turn
  location/heroic, generated NPC appearance descriptors, forked heroics).
- Housekeeping candidate: desktop shell still has no automated test coverage.

## Blockers

- None hard. Everything pending is either an owner verdict or a next build.

## Verification

- Automated: `node test.js` (set AI_RETRY_BACKOFF_MS=10 to skip retry-test sleeps).
  Must pass before claiming completion of any code change. Desktop shell (Rust) is
  outside it: `cargo build` in `desktop/src-tauri`.
- Live: real turns are free via the configured Ollama provider — start `node
  server.js`, curl the API (campaign 3 turn 3, 2026-07-04, demonstrates the V2
  pattern). GM-feel gates need owner play sessions per the Development Process rules.

## Active Sources

- `AGENTS.md`, `.agents/repo-guidance.md`, `.agents/decisions.md`, `.agents/repo-map.json`
- `plan.md` (roadmap: phases incl. Visual Phases, Future Topics, progress log)
- `README.md` (features, install, /admin config story, roles, desktop shell)
- `docs/ruleset-licensing.md` (verified license evidence for future SRD options)

## Unrecorded Repo Memory

- Engine data model detail lives in db.js/rpg-state.js/rpg-engine.js; admin panel in
  admin/; provider seams in api-client.js (text), tts-providers.js (speech),
  image-providers.js (images); deterministic map render in map-render.js.
- The dev DB (data/, gitignored) holds campaigns 1-3; campaign 3 now also carries the
  2026-07-04 V2 live-smoke evidence (turn 3 + "Ancient Ruins Chamber" location row).
  Generated renders will live under data/images/ indexed by campaign_images.
- Layout mocks artifact URL (claude.ai) is session-published; the canonical copy is
  `docs/mockups/heroic-layouts.html`.
- README does not yet describe the Visual Phases features (heroic/map/theming) — it
  documents through the 2026-07-03 state; update once the owner's feel gate passes.
