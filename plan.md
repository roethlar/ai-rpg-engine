# Aetheria GM Improvement Plan

**Goal**: Perfect solo and shared-table play while preserving a coherent GM, persistent campaigns,
and natural table talk.

**Core Principle**: Every change must improve *fun* and *feel* like a real GM. Avoid feature creep. Prioritize quality of interaction over new mechanics.

## Phase 0: Clarification & Table-Talk (Highest Priority - Fix the core complaint)

**Problem**: The GM is too "video-gamey". It rushes to resolve actions and struggles with pure questions like "Which goblin is closer? Can I throw my dagger at it?" The `input_kind: "clarification"` path exists in code but is not reliable in practice.

**Concrete Changes**:
- Strengthen the Interaction Agent prompt to be much more conservative about classifying input as `committed_action`.
- Improve the Referee and Final Narration prompts with better few-shot examples of good clarification responses (scene grounding, partial information, "you don't know yet" answers, encouraging more questions).
- Add explicit "scene grounding" output field so the GM is forced to describe the current tactical situation clearly before any resolution.
- Update `validateTurnData` and frontend to handle richer clarification responses.
- Add a "pure question" detection heuristic in `rpg-engine.js` before the full Council pipeline.

**Success metric**: Player can have 3-4 back-and-forth clarification exchanges without the world state advancing or the GM forcing an action.

**Files to change**: `rpg-prompts.js`, `rpg-engine.js`, `rpg-state.js`, `public/app.js` (minor).

## Phase 1: Narration & Scene Quality

**Promoted slice — Dynamic spotlight layout (approved 2026-07-03, owner picked
Layout D from `docs/mockups/heroic-layouts.html`):** one info rail (quest +
character), narrative log + visualizer sharing the main field; every major
surface (visualizer, log, character rail, right tabs panel) gets a spotlight
control that promotes it to the main stage and demotes the rest to a compact
rail; Esc restores. Pure frontend (CSS grid-area swaps + small JS) — no engine
or prompt changes, so its gate is functional: owner opens the app and clicks
through, no play session required. The current SVG visualizer occupies the
heroic slot; the future heroic render and conditional map drop into slots this
layout already provides. Files: public/index.html, public/styles.css,
public/app.js.

**Promoted slice — Dice roll theater (owner request 2026-07-11):** when a
fresh turn arrives carrying engine-rolled check results, the frontend plays a
short, skippable dice animation — a d20 tumbles and lands on the recorded
roll, then shows the math (roll + modifier vs DC) and the outcome. Pure
presentation: the die always lands on the engine's recorded roll
(`turn.rollResults`); no engine, prompt, or state changes; the existing log
roll card remains the durable record. Plays on the actor's own submit and on
the poll path (the rest of the table sees the same roll land); never on
campaign load, join, or journal backfill; respects prefers-reduced-motion;
click skips. Gate is functional: owner one-look.
Files: public/index.html, public/styles.css, public/app.js.
Riders (owner 2026-07-11): the die body/glow follows `--theme-primary` so it
inherits campaign — and later scene-dynamic — theming automatically; verdict
green/red stay semantic. Die-type generalization (d4–d12, d100, …) rides the
reopened rules-system design: which dice exist is a property of the chosen
system; when it lands, the roll record gains a `sides` field and the theater
picks the matching die face. d20-only until then — the engine only rolls d20.

- Make narration richer, more atmospheric, and less mechanical.
- Improve scene visualization (owner direction recorded under "Maps & Character Miniatures" in Future Topics: overhead map + tokens replaces the per-turn scene SVG; image-gen hero renders for notable encounters come in a later phase — concrete scoping deferred until after Phase 0).
- Better handling of NPC voices and relationships in narration.

## Phase 2: Voice of the Council

**Implementation green-lit 2026-07-03 (owner: "I need to test multiple voices" —
sequencing override ahead of the Phase 0 feel verdict, same pattern as the
Council-refactor green-light). Scope of first cut:** engine assigns each NPC a
sticky voice profile at creation (deterministic pool pick + instructions derived
from personality/quirks, stored in npcs.voice_json); the narrator emits a
speaker+tone-tagged voice script (narration_lines) alongside the narrative;
the engine resolves speakers to stored profiles and returns turn.voiceLines;
the frontend plays segments sequentially (skip stops the queue), falling back
to single-voice narration when no script is present. Playtest gate: NPC voices
distinct and consistent across turns, with graceful fallback when the model omits the script. The
player-chosen narrator clause was superseded by Phase V's campaign-canonical GM decision.

- Expand current TTS (OpenAI) to support multiple character voices per turn.
- Give the GM a consistent persona/voice style that persists across a campaign.
- Allow emotional tone directives from the Council pipeline to influence TTS parameters.
- **Mechanism note (owner design direction, 2026-06-13 — not yet promoted to scheduled work):** voice identity should be *recorded state*, not transient prompt wording — each NPC and a global GM-narrator voice get a stable voice identifier stored in character/campaign state, so a character sounds the same across turns and ideally across campaigns (the audio analog of canon commitment). Pair with structured narration output carrying per-line **speaker + emotional-tone** fields that drive TTS voice selection and parameters — which is what the three bullets above already call for. The hard requirement is voice-identity-as-state and within-campaign consistency; the TTS *provider* (and whether voice cloning is needed) is a separate, later call kept swappable like the rest of AI config (existing OpenAI TTS stays as the baseline/fallback). See the provider-strategy topic in Future Topics.

## Phase 3: Character & Campaign Foundations for Multiplayer

**Promoted to concrete slices 2026-07-04** (decision "Multiplayer v1 shape" in
`.agents/decisions.md`; plan approved via the delegated codex review loop).
V1 is deliberately minimal: shared ACCESS_SECRET token, multiple characters
per campaign, each browser plays one character, server-enforced round-robin
turns. Per-player auth, initiative-based ordering, and the in-app player
chat channel are recorded as later slices. Single-player campaigns must
behave exactly as today (an order of one). Feel gate: the owner's next
playtest is this phase, with other people.

**M1 — Schema: many characters per campaign.** `characters` today has
`campaign_id` as its PRIMARY KEY — structurally one character per campaign.
Rebuild as `id INTEGER PRIMARY KEY AUTOINCREMENT` + non-unique
`campaign_id` index (SQLite table-rebuild migration copying existing rows);
add `initiative INTEGER` (stored for future ordering, unused in v1); add
`turns.character_id` (nullable; legacy turns have none). Every
one-character assumption (`WHERE campaign_id = ?` single-row loads in
rpg-engine.js, server.js, MCP tools) becomes party-aware, with "the acting
character" threaded where a single character is meant.
Success: suite green; existing campaigns load and play with their one
character; fork/release/checkout still correct.
Files: db.js, rpg-engine.js, server.js, test.js.

**M2 — Turn order + acting character.** `campaigns.turn_state_json`
{order: [character_id…], current_index, round}; joining appends; a new
per-character release route (POST `/api/campaigns/:id/characters/:cid/release`)
removes ONE character from the order and frees its profile — the existing
campaign-scoped release (which frees the whole party) remains for ending a
campaign. Turn gating happens AFTER classification, because only the
Interaction agent knows what the input is: off-turn submissions run the
normal pipeline, table talk (stateless per decision 2026-06-05) is answered
for anyone, and an off-turn input classified committed_action is rejected
at that point with a clear retriable error that restores the typed input
(same surface as the fallback-tier failure UX). Single-character campaigns
auto-pass all gating. Every turn request carries the SUBMITTING
character id (which character this browser plays — required once a campaign
has more than one character); the Council context distinguishes the acting
character (whose turn it is) from the speaking character (who typed), so
off-turn table talk is answered from the asker's own sheet and perspective,
never the acting character's. Round-robin advances on committed actions
only.
Success: unit tests for the order state machine (join/leave/advance/skip);
out-of-turn committed actions rejected, off-turn table talk answered;
single-player unchanged.
Files: db.js, rpg-state.js (pure order helpers), rpg-engine.js, server.js,
test.js.

**M3 — Join & party UI.** Join flow on an existing campaign: create a new
character (name + concept) or check out an available profile via
POST `/api/campaigns/:id/join`; the browser remembers which character it
plays (localStorage); party panel lists all characters (acting character
highlighted, others read-only); off-turn the input stays ENABLED but is
labeled "table talk — waiting for X" (off-turn committed actions come back
rejected with the input restored); turn/round indicator.
Success: two browser windows, two characters, alternating committed
actions, both seeing one shared narrative; reload-safe.
Files: server.js, rpg-engine.js, public/index.html, public/app.js,
public/styles.css.

**M4 — README for hosting a table.** Hosting instructions (ACCESS_SECRET,
share URL + token, join flow) plus documentation of the landed Visual
Phases features (theming, locations/map, heroics, Situation panel) so
playtesters have accurate setup docs.
Files: README.md.

**Multiplayer end state vision**: Multiple players can join the same campaign (via shared URL + access token). The GM maintains one shared scene description. Players take turns in declared order. Clarification/table-talk works for everyone. Character progression is persistent across campaigns.

## Infrastructure Phases (promoted 2026-07-03 — functional gates, not feel gates)

These serve security and reliability rather than GM feel, so their review gate is
functional: unit tests + smoke verification, plus owner confirmation on next play.

**Phase I1: Server-owned AI config & /admin panel** (decisions 2026-06-11 + 2026-07-03
in `.agents/decisions.md`)
- `server_settings` table; admin-set AI config (provider/model/keys/endpoints, voice
  key/model, fallback tier) persisted server-side; resolution order admin DB > env.
- `/admin` page (not linked from game UI) gated by `ADMIN_SECRET` (unset = open for
  single-operator localhost dev, warned at startup; production fails closed).
- Server ignores client-supplied AI config; player settings panel reduced to access
  token, voice narration on/off, and diagnostics. Phase V later removed player narrator identity
  and style controls in favor of campaign-canonical voices.
- Success: server env/admin config authoritative; a client sending forged apiConfig
  cannot change provider/model/key; owner can configure keys via /admin and play.
- Files: db.js, server-config.js (new), server.js, admin/ (new), public/index.html,
  public/app.js, test.js.

**Phase I2: Model fallback tiering** (decision 2026-07-03 in `.agents/decisions.md`)
- Transient AI errors (network/timeout/408/429/5xx): retry once, then per-call
  failover to a configured backup tier (admin panel or `FALLBACK_*` env). Role
  separation preserved (per-call swap only). Non-transient errors fail fast.
- Frontend: failures surviving retry+fallback surface as a retriable error outside
  the GM voice, with the player's typed input restored.
- Success: mocked-provider tests prove retry/fallback/fail-fast classification; a
  mid-session 503 no longer reaches the narrative log as GM dialogue.
- Files: api-client.js, server-config.js, public/app.js, test.js.

**Phase I3: Five first-class AI roles, fully /admin-configurable** (decision
2026-07-03 in `.agents/decisions.md`)
- Split narration out of the interaction client and setup (outline + opening
  scene) out of the primary config; add `NARRATION_*` / `SETUP_*` env prefixes.
- Per-role provider/model/key grid in /admin, persisted in server_settings;
  precedence admin role > role env > primary (same-provider inheritance only).
- Success: each of the five roles can run a distinct provider/model configured
  purely through /admin; unconfigured roles behave exactly as before; key-safety
  tests still pass.
- Files: api-client.js, server-config.js, rpg-engine.js, admin/, test.js.

## Visual Phases (promoted 2026-07-04 — from the maps/heroic and genre-atmosphere topics)

Promoted on the owner's standing go ("do as much as you can" on the buildable
queue recorded in `.agents/state.md` 2026-07-03) against the recorded designs:
owner directions 2026-06-11/2026-06-13 in the "Maps & Character Miniatures"
topic below, plus decisions 2026-07-03 (image seam, genre theming) in
`.agents/decisions.md`. Functional gates (unit tests + smoke) close per slice;
the *feel* gate — heroics look right in play, map communicates, theming lands —
remains an owner playtest verdict on the whole phase.

**Phase V1: Image provider seam** (decision 2026-07-03)
- `image-providers.js` registry mirroring `tts-providers.js`: `generateImage()`
  behind a provider registry, no hard-coded vendor. The interface carries an
  **identity-anchor parameter from day one** (stable subject descriptor + seed +
  optional reference image) even where a provider ignores it.
- Providers: `openai` (hosted Images API) and `sdwebui` (any local
  Stable-Diffusion-WebUI-compatible `/sdapi/v1/txt2img` endpoint — the owner's
  RTX 5090 dev path; supports seed conditioning for identity).
- /admin gains an Images section (provider, model, API key, local endpoint URL),
  persisted in `server_settings` with the same secret-masking flow as voice.
  Unconfigured = feature inert; the engine renders no images and the SVG
  visualizer path is untouched.
- Success: unit tests prove registry dispatch, unknown-provider rejection,
  identity-anchor pass-through, config resolution/masking; suite green.
- Files: image-providers.js (new), server-config.js, admin/, db.js (none —
  server_settings exists), test.js.

**Phase V2: Structured location state** (owner direction 2026-06-11/13)
- Locations become first-class entities: `locations` table per campaign with a
  stored layout (areas with coarse coordinates, exits, fixed features), a
  mutable occupancy layer, and an identity descriptor for future renders.
- Generated once on first entry (one gated generation call), loaded on revisit,
  injected into Council context (omniscience: the record answers "what's
  around?"), mutated only through the referee/continuity gate — never on
  table-talk turns (existing no-op net extended to location fields).
- Deterministic SVG map render from layout + occupancy (no AI in the render
  path), suitable for the conditional map surface.
- Success: unit tests prove validation, no-op protection on table talk,
  create-once/load-on-revisit, deterministic render; suite green.
- Files: db.js, rpg-state.js, rpg-engine.js, map-render.js (new), test.js.

**Phase V3: Engine-owned current_heroic** (owner direction 2026-06-13)
- `campaigns.current_heroic_json`: the engine holds the pointer to the current
  focal visual; the model never "remembers" what is displayed.
- Focal-subject signal (`focal_subject`: location | npc | none) emitted by the
  Referee and confirmed by the final continuity check — full-chain turns only;
  the table-talk path never changes the heroic.
- Engine-side stickiness: a new heroic only on entering a new location or an
  NPC taking prominence, with a threshold against thrash; generation is
  synchronous in the turn (whole round ready before send) when an image
  provider is configured, and a generation failure keeps the previous heroic —
  it never kills the turn.
- Identity persistence: per-entity identity descriptor + seed anchor recorded at
  first render (NPC and location), reused for every later render of the same
  subject.
- Success: unit tests prove signal validation, stickiness/threshold rules,
  no-op on table talk, anchor reuse; suite green; smoke with provider stub.
- Files: db.js, rpg-state.js, rpg-engine.js, server.js, test.js.

**Phase V4: Heroic + conditional map in the Layout D shell**
- The heroic render takes the visualizer slot Layout D already provides (SVG
  fallback stays for campaigns/turns without one); the map surface shows
  scene-grounding text by default and the deterministic map when the turn is
  positional. Map and grounding text always coexist (owner Layout D pick).
- Success: functional gate — owner opens the app and clicks through; no play
  session required for the layout itself (same gate as the spotlight slice).
- Files: public/index.html, public/app.js, public/styles.css, server.js.

**Phase T1: Agent-generated genre theming at setup** (decision 2026-07-03)
- Extend the Setup role's outline generation (`theme_colors`) to a fuller
  theme: text/surface accent colors and a font pairing chosen from the app's
  bundled-safe font set, all validated server-side like theme colors today.
  Custom accent graphics stay deferred; the "empty holodeck" pre-campaign state
  stays unscheduled.
- Success: unit tests prove validation/fallbacks (bad fonts/colors rejected to
  defaults); existing campaigns unaffected; suite green.
- Files: rpg-engine.js, rpg-state.js, public/app.js, public/styles.css, test.js.

**Phase T2: Scene-dynamic theming (r7 — APPROVED by the owner 2026-07-11
("1. yes" to "approve the theming plan? scene palettes per location + the
flatten-styling step first — approving the plan green-lights
implementation"). Implementation order: the six open review findings
(css-1 is a hard prerequisite) → T2-s → T2. Review trail: r1–r6 in
`.agents/review/index.md`; the r4–r6 validation-machinery escalation was
resolved by the owner's flat-design decision — T2-s flattens the UI first,
so validation shrinks to enumerated flat-pair checks.)**

**T2-s — Styling normalization (prerequisite slice, replaces the r6
validation rig):**
- Remove the gradient fills (owner 2026-07-11): `.btn-primary`
  (public/styles.css:199-201, + its hover brightness filter), the level
  badge (public/styles.css:595-613, incl. its 0.8-alpha label), and the
  gradient text (public/styles.css:155-157) become flat accent surfaces.
- Unify dimming: one documented demotion opacity shared by the spotlight
  demotion (public/styles.css:1330-1345), completed outline cards
  (public/app.js:1516-1522), and text_dim consumers (0.7–0.85 spread) —
  pick the value during implementation; record it as a named CSS variable.
- One derived `--theme-on-accent` foreground (black or white per palette)
  consumed by every accent-backed control: Send button, level badge, and
  map-render.js labels (currently fixed dark hsl(220,25%,10%) — the r6
  infeasibility conflict dissolves when all three consume the same derived
  color).
- Gate: functional (owner one-look — this visibly restyles buttons/badges
  toward the flat, restrained look), plus the css-1 computed-style checks.
- Files: public/styles.css, public/app.js, map-render.js, test.js.
- Owner direction (2026-07-11): the color scheme follows the game as it moves —
  a night-club scene goes neon, a forest goes spring/earth tones. The campaign
  setup theme (T1) remains the baseline; scenes modulate the colors. Fonts
  never change per scene (readability and layout stability).
- PREREQUISITES: (1) finding `poll-1` (stale responses repaint an older
  campaign/scene) — T2's frontend work builds on its session-epoch
  mechanism; (2) finding `dt-3` (landed die color override); (3) Phase CT's
  complete-colour contract — `--theme-*` properties hold complete opaque
  `hsl(...)` colours, opaque consumers use `var(--theme-*)`, and translucent
  consumers use `color-mix(in srgb, var(--theme-*) N%, transparent)`. T2 must
  preserve that contract when it adds scene palettes; wrapping a theme variable
  in another colour function is invalid.
- Anchor: the scene theme is LOCATION state, not a per-turn mood signal.
  `locations` gains `theme_json` (db.js ALTER TABLE migration, existing
  pattern; NULL for all pre-existing rows). Rationale: the theme changes
  exactly when the fiction moves somewhere else — predictable and
  thrash-free by construction, no additional AI calls beyond the existing
  per-location generation, and a revisited place looks the same (the layout
  consistency rule applied to atmosphere).
- Theme shape: `{primary, secondary, bg, text, text_dim}` — five HSL slots.
  `bg` is included deliberately (t2-5): panel/border derive from bg in the
  pure theme-variable helpers consumed by `applyCampaignTheme`, so without a
  scene bg the dominant surfaces would keep the campaign baseline and a
  forest→nightclub move would only recolor accents. `bg` is dark-clamped on
  validation so text stays readable on every derived surface.
- Generation and the persistence carrier (t2-1, t2-6; carrier corrected in
  r3 after the r2 re-review caught the double-validation drop): the
  once-per-location continuity-role call `generateLocationLayout`
  (rpg-engine.js:490) gains a `theme` object in its response schema and
  returns `{layout, theme}`; the opening-location call (rpg-engine.js:1243)
  likewise. The carrier mirrors `generated_layout` EXACTLY, because the turn
  pipeline validates twice: (1) raw model output passes
  `validateLocationUpdate` (rpg-state.js:505-511), which strips any
  model-supplied theme field — per-turn output can never inject one; (2) the
  engine then stamps `generated_theme` (already `validateSceneTheme`-clean)
  beside `generated_layout` (rpg-engine.js:1037-1043 region); (3)
  `validateTurnData`'s re-validation projection (rpg-state.js:544-553) must
  PRESERVE `generated_theme` exactly as it preserves `generated_layout` —
  omitting it there silently drops every first-entry theme before the INSERT
  (the r2 defect). Both location INSERTs (rpg-engine.js:1367 opening,
  rpg-engine.js:1821 first entry) write `theme_json`; hydration
  (rpg-engine.js:304-313) parses and re-validates onto `location.theme`.
  Theme is write-once at row creation, read-only thereafter. A required
  end-to-end test drives a stubbed normal first-entry turn and asserts the
  new row's `theme_json` is populated (not just the opening location's).
  Timing precision: generation happens once per SUCCESSFULLY COMMITTED first
  entry — a first-entry turn that final continuity rejects discards the
  candidate (rpg-engine.js:1052-1063) and a retried entry regenerates; only
  the committed result persists. That retry cost is accepted and documented.
- Validation: `validateSceneTheme` in rpg-state.js reusing the T1 primitives
  (`normalizeHslColor`, `clampHslLightness`; text ≥60 lightness, text_dim
  40–80 as at rpg-state.js:1449-1463; bg clamped dark). Lightness clamps
  alone do NOT guarantee readability (r2: ≈1.2:1 possible), so after T2-s
  has flattened the UI, validation checks the ENUMERATED flat pairs — the
  whole point of the flat-design decision is that this small list is
  genuinely sufficient:
  - text ≥4.5:1 and text_dim ≥3:1 against bg AND the derived panel, with
    text_dim checked at the single documented demotion opacity T2-s
    establishes (composited; no other opacity states exist after T2-s);
  - primary/secondary as foregrounds ≥3:1 against bg and panel;
  - the derived `--theme-on-accent` ≥4.5:1 against primary AND secondary
    (flat fills after T2-s — no gradients, no hover filters, no label
    alpha);
  - repair by lightness stepping; reject to null on non-convergence; a
    FEASIBILITY fixture proves at least two adverse non-null themes
    validate end-to-end (guards against an unsatisfiable contract).
  - Phase CT deliberately retired the broad no-DOM consumer scanner. T2 must
    guard the enumerated flat pairs through its validation fixtures rather than
    restoring a source parser; CT's narrow complete-colour grammar, ordered
    translucency table, and direct consumer-typo lint remain the format guards.
  Adverse fixtures: accent headings, Send button, level badge, map labels
  and features, completed-card text, near-white/near-black accents.
  Invalid or missing → null → baseline applies. Table talk cannot mutate
  location state (existing no-op net), so the theme cannot drift on
  questions.
- Payload: state payloads gain `sceneTheme` (validated current-location
  theme or null) everywhere `themeColors` is emitted
  (rpg-engine.js:1416/1896/1983). Seats receive it via an explicit
  seat-view whitelist addition next to `themeColors` (rpg-state.js:933) —
  scene colors are table-public. Seat-boundary rule applies (see success
  criteria).
- Portability and forks (t2-3, t2-4 — the r1 "rows travel wholesale" claim
  was FALSE; export/import/fork all project explicit fields): add
  `theme_json` to the export projection (rpg-engine.js:2265-2274), to the
  untrusted-bundle location validation (rpg-state.js:1129-1149), to the
  import INSERT (rpg-engine.js:2372-2380), and to the fork location copy
  (rpg-engine.js:2650-2663). The pinned v1 fixture stays byte-identical —
  it now doubles as proof that themeless bundles import with null themes.
  Fork pointer: fork replay only observes `turnData.location_update`
  (rpg-engine.js:2497-2517), so a turn-1 fork must seed
  `current_location_id` from the source campaign's opening location or the
  fork stays on baseline even with theme_json copied — seed it during fork
  creation.
- Frontend: `applyCampaignTheme` gains a `sceneTheme` parameter — its slots
  override the campaign baseline before the pure theme-variable map is applied;
  derived vars (panel/border) recompute from the merged palette exactly as today,
  so every themed surface follows
  with no per-surface work — for the dice theater this holds only once
  finding dt-3 lands (its landed state currently overrides the die color
  with fixed green/red), so dt-3 is a T2 prerequisite alongside poll-1. A
  short CSS color transition gives a soft crossfade on scene change
  (disabled under prefers-reduced-motion). Stale-response safety comes from
  the poll-1 epoch (prerequisite above).
- Success criteria: unit tests — clamp/reject in validateSceneTheme (incl.
  dark-clamped bg, and contrast repair/reject proven against adverse-hue
  fixtures); merge precedence (scene over baseline; null → baseline);
  revisit reuses the stored theme without regenerating; a table-talk turn
  leaves the theme unchanged; a rejected first-entry turn persists nothing;
  a DB-backed export→import round trip carries a real theme AND the pinned
  v1 fixture still imports (null themes); fork tests at turn 1 and later
  both preserve the active scene theme. Seat-boundary regression (t2-7,
  required by the standing rule in `.agents/state.md`): extend
  `testSeatVisibility` (test.js:1818-1881) with a `sceneTheme` fixture,
  assert exact propagation to the seat view and run the existing leak scan
  over it. Suite green. Functional smoke: two locations with distinct
  palettes visibly swap the UI theme on movement, including background and
  panels, not just accents — asserted via COMPUTED styles on the header,
  glass panels, and narrative panel under a non-default palette (guards
  css-1 staying fixed). Feel gate: owner playtest verdict.
- Non-goals (v1): per-turn mood shifts inside one location (e.g. combat
  tint); per-scene fonts; coupling to heroic/image generation; retro-theming
  locations generated before this phase (their `theme_json` stays null →
  baseline; they re-theme only if regenerated).
- Files: db.js, rpg-engine.js, rpg-state.js, public/app.js,
  public/styles.css, map-render.js, test.js (plus T2-s's files above; the
  r6 browser harness and manifest module are out of scope per the
  flat-design decision).

## 2026-07-04 Queue (promoted under the delegated review loop)

Owner delegation recorded in `.agents/decisions.md` (2026-07-04): open calls
agent-decided, plans independently reviewed, nothing gated on the owner until the multiplayer
playtest. Codex was the assigned reviewer then; the 2026-07-14 division-of-labour decision controls
current assignments. Priority order: Phase 3 (above) →
V5 → D → H → P.

**Phase V5: Visual gap closers** (extends the shipped V1–V4 designs)
- V5a — Opening turn creates the starting location and heroic: campaign
  creation generates the starting location's layout from the opening scene
  (same one-time generation call, setup-time), sets the engine pointer, and
  renders the opening heroic when an image provider is configured. Campaign
  start stops being the one turn with no structured record.
- V5b — Generated NPC appearance descriptors: at an NPC's first render, one
  continuity-role call produces a stable visual appearance description
  (committed to npcs.anchor_json as canon — improvise-then-record, per the
  omniscience decision); the mechanical personality/quirks composition
  becomes the fallback when the call fails.
- V5c — Positional persistence for table talk: the engine records the last
  committed turn's positional flag as campaign state; table-talk turns
  during a fight keep auto-showing the map instead of dropping to
  text-only (display path only — no state mutation on table talk).
- Success: unit tests for validation/pure parts PLUS stubbed-provider
  tests (fetch stub, as in the V1 seam tests) proving the opening heroic
  and the appearance-descriptor call fire and commit their anchors — the
  live smoke with no provider configured only proves the inert path; suite
  green. Feel verdict rides the multiplayer playtest.
- Files: rpg-engine.js, rpg-state.js, db.js, public/app.js, test.js.

**Phase D: Table-style dials** (decision 2026-07-04 fixes option sets,
defaults classic + standard, mid-campaign adjustability, choice fading)
- D1 — State + UI: `campaigns.table_style_json` {helpfulness, pacing};
  wizard selection at creation; campaign settings edit (effect next turn).
- D2 — Helpfulness enforcement, structural not adjectival: style-keyed
  prompt variants for the interaction/verifier/referee/narration calls;
  suggested_choices capped by style in validateTurnData — which gains a
  tableStyle parameter alongside currentAct — with the existing empty-list
  backfill made style-aware (helpful 3-4 with backfill as today, classic
  2-3 no invented backfill, hardline always 0), so the cap holds even
  against a chatty model.
- D3 — Pacing as recorded state: the Referee reports
  `encounter: none|player_sought|gm_initiated` per committed turn
  (validated, engine-stamped like dice); the engine computes "turns since
  last GM-initiated encounter" from the turn record; Referee and Continuity
  prompts receive the cadence fact + target as a checkable rule
  ("last GM-initiated encounter 2 turns ago; target ~1 per 5; do not
  introduce a new threat unless the player seeks one"). The dial governs
  what the GM initiates, never what the player may do.
- Success: unit tests for choice caps per style, cadence computation, and
  prompt injection presence/absence; suite green. Whether classic actually
  *feels* like a real table closes at playtest.
- Files: db.js, rpg-state.js, rpg-prompts.js, rpg-engine.js, server.js,
  public/index.html, public/app.js, test.js.

**Phase H: Holodeck entry state** (owner intent recorded 2026-06-13)
- The pre-campaign screen becomes a deliberately blank slate — "a holodeck
  with no program running": engine-neutral dark stage, faint grid, campaign
  cards framed as stored programs, no genre theming applied until a
  campaign loads (root theme vars explicitly reset on the entry screen).
- Success: functional render check in browser + shell; owner one-look
  verdict later. Files: public/index.html, public/styles.css, public/app.js.

**Phase P: Campaign portability** (decision 2026-07-04: versioned JSON
bundle, export first, forward importability is the hard requirement)
- P1 — Export: authenticated GET `/api/campaigns/:id/export` returns one
  self-contained bundle: format_version 1 + campaign, outline, ruleset,
  characters + released profile snapshots, NPCs (voice + visual anchors),
  locations, memories, turns, engine-owned pointers. Image binaries are
  NOT embedded in v1: identity anchors (the visual canon) travel in the
  bundle, but render artifacts stay behind — so on import the
  current_heroic pointer is cleared (it references a campaign_images row
  that does not travel) and the heroic regenerates from the imported
  anchors on the next qualifying action. Every id-bearing pointer in the
  bundle is remapped to the fresh ids on import — turns.character_id,
  turn_state_json.order, current_location_id — and the pinned fixture
  asserts each remap, so no imported pointer can dangle (same defect class
  as the heroic pointer, closed for all of them).
- P2 — Import: POST `/api/campaigns/import`. The global
  `express.json({limit:'64kb'})` would reject bundle-sized bodies before any
  route parser ran, so the global parser is mounted to skip this one path
  and the import route carries its own `express.json` with a 20mb cap.
  Import validates format_version, replays every piece
  through the existing validators (bundles are untrusted data, never
  instructions), allocates fresh ids, and creates the campaign released
  from any profile locks. A v1 export must import into every later engine
  version — format_version migrations live at this boundary.
- Success: export→import round trip on a real campaign yields a playable
  equivalent; unit tests for bundle validation and version gating; and a
  PINNED v1 bundle fixture committed to the repo that the import test must
  accept forever — the forward-importability guarantee as a permanent
  regression guard, not a one-time claim.
- Files: server.js, rpg-engine.js (bundle build/restore), rpg-state.js,
  test.js.

## Phase S: Seats — S1–S3 LANDED (S2/S3 built 2026-07-09; target: remote two-human playtest, connectivity owner-handled)

Multiplayer means multi-USER (decision 2026-07-05, reactivated 2026-07-09):
two distinct users, each able to act only as, and see only, their own
character. Design surfaced to the owner in chat and not objected to.
Supersedes the shared-token identity model everywhere a seat exists;
solo/dev campaigns (no seats) are unchanged. Network exposure (transport,
TLS, tunnel/port-forward) is owner-handled infrastructure, out of repo
scope (decision 2026-07-09) — app-side readiness is S2 + S3 plus the
existing secrets warnings/production fail-closed startup behavior.

**S1 — Seats + server-side binding (the security floor)**
- `seats` table: campaign_id, character_id (unique), token_hash, label,
  created/revoked timestamps. Host mints a seat token per character (route +
  UI on the party strip / campaign card); token shown once; revocable.
- Request authentication: seat token accepted via the same Authorization
  header; resolves to (campaign, character). ACCESS_SECRET remains the host
  credential (full authority). Widening `authenticate` alone is NOT enough
  (codex finding 1): explicit per-route guards (`requireHost`,
  `requireSeatCampaign`) apply after :id parsing on EVERY mounted surface —
  campaign list, character library, journal, images, audio — so a seat can
  reach only its own campaign's play routes.
- `characterId` handling, reconciled with the 2026-07-05 decision (codex
  finding 6): the parameter is removed FOR SEATS (their character derives
  from the credential; nothing to spoof). The HOST retains explicit
  characterId — the host is the table operator and, in solo/hosted play, the
  only way to say who acts. Decision entry amended to this precise wording.
- Meta-actions host-only: create/delete/fork/export/import campaigns,
  release others' characters, table-style changes, seat mint/revoke.
- Success: with two seats, seat A physically cannot act as B (no parameter
  exists), cannot call meta routes (403), and a revoked seat is dead; solo
  campaigns and every existing test behave unchanged; suite + live smoke.

**S2 — Seat-scoped visibility**
- Per-viewer state payloads: seats get their own character in full;
  partymates as silhouette (name, class, level, HP); shared surfaces
  (narrative, scene grounding, map, heroic, suggested choices) unchanged;
  NO outline acts, NO NPC personalities/relationship notes/Codex, NO
  memories. Ruleset is player-viewable canon (2026-07-03 decision): seats
  keep the Rules sheet, lose the dials (host-only).
- Voice-line leak (codex finding 3): TTS instructions embed NPC
  personality/quirks. Seat payloads carry voiceLines with speaker/tone/text
  only; the narrate route, for seats, accepts the speaker name and resolves
  the stored voice profile server-side — NPC voices still sound right, the
  personality text never leaves the server.
- Campaign summary leak (codex finding 5): campaigns.summary embeds
  memory_summary text every 5 turns; seat state and any list payloads omit
  it (genre only).
- Journal for seats (codex finding 4): a sanitized shape — turn_number,
  player_action, narrative only (no state_changes_json, no memories); the
  poll gap-backfill and the timeline consume that same shape for seats
  (roll badges degrade gracefully).
- MCP endpoint stays host-credential-only.
- Frontend: seat sessions hide host-only UI (dials, fork buttons, codex/
  outline panels) and render silhouettes.
- Success: a seat's raw API responses contain no outline/NPC-notes/memory
  strings (asserted by test where pure, by live smoke otherwise); host view
  unchanged; suite green.

**S3 — Join & invite flow rewire**
- Host flow: "mint seat" per character; POST /join stays HOST-only (it
  creates characters). Seats get a dedicated bootstrap (codex finding 2):
  GET /api/seat/session resolves a seat token straight to its campaign
  state — the app never fetches the campaign list on a seat session, so the
  list route stays host-only. Player UI: paste seat token → the bound
  character loads via the session endpoint (no claim/click flow; the cr-1
  claim/tombstone machinery applies to host mode only).
- README hosting section updated to the seat flow.
- Success: two browsers with two seat tokens each control exactly their own
  character end-to-end; the party-strip claim UI is gone for seat sessions.

## Non-Goals (for now)
- Real-time simultaneous multiplayer
- ~~Full combat grid / tactical combat system~~ — struck 2026-07-11: this was
  agent-drafted day-one scoping that hardened without owner approval; the
  owner decided tactical combat is IN SCOPE (decision 2026-07-11 in
  `.agents/decisions.md`); depth and mechanics ride the rules-system synthesis
- ~~New AI image generation~~ — superseded 2026-07-03 by the image-seam decision
  (`.agents/decisions.md`) and promoted into the Visual Phases above; the
  original caution survives as scope discipline: images are set pieces behind a
  provider seam, not per-turn dependencies, and the game stays fully playable
  with no image provider configured

## Future Topics for Discussion (not yet scheduled)

Raised during planning but deliberately deferred. **Per project rule, nothing here may be implemented until it is promoted into a concrete phase with planned entries.**

- **Scene-dynamic theming — PROMOTED AND APPROVED 2026-07-11** (owner direction
  2026-07-11; the plan is Phase T2 in the Visual Phases above). Original direction:
  the color scheme follows the *game* as it
  moves — night-club neon, forest earth tones — extending, not replacing,
  the T1 setup theme.

- **Owner/player settings split & simple auth — LANDED.** Phase I1 moved provider/model/key
  configuration to `/admin` behind `ADMIN_SECRET`; Phase S added per-seat credentials. Full user
  accounts and long-term character ownership remain future topics. README owns the current flow.

- **Host-only campaign editor — DEFERRED 2026-07-31.** A possible administrative tool for directly
  inspecting or editing a campaign is separate from ordinary GM/player interaction and from Phase
  PT. It needs its own future phase, authority boundaries, and canon-preservation design before any
  implementation; nothing here authorizes it.

- **Model fallback tiering — LANDED.** Phase I2 retries transient failures once, then uses the
  configured backup tier per call while preserving Council-role boundaries. Surviving failures
  surface outside the GM voice and restore the player's input.

- **Spells, abilities & ruleset consistency — D0 DECIDED; D1 NEXT.** The engine needs a working,
  user-predictable system. D0 chooses one bespoke, versioned chassis with generated campaign flavor;
  it rejects both generated-per-campaign mechanics and wholesale adoption of an external system.
  The remaining queue is `.agents/review/rules-system-plan-intake.md`; no implementation before it
  produces a concrete reviewed phase. Historical first-cut implementation:
  campaign creation gains a ruleset selection; the Setup role generates the
  house ruleset for the campaign (resolution = the engine's existing d20 +
  attribute mod vs DC; campaign-specific starting abilities/spells with costs
  and limits) stored as `campaigns.ruleset_json`; the ruleset is injected into
  the GM system instruction and Council context as canon; players view it in
  the game UI. Consistency is the hard gate: rules must not drift between
  turns. `docs/ruleset-licensing.md` remains research evidence only; D14 may decide whether CC0
  material informs balance data.

- **Genre atmosphere & the "empty holodeck" entry state — theming half PROMOTED 2026-07-04** (decision 2026-07-03 in `.agents/decisions.md`: agent-generated at campaign setup, owned by the Setup step; implementation is Phase T1 in the Visual Phases above; accent graphics deferred). The "empty holodeck" entry state below remains unscheduled. Entering the server before any campaign is chosen should feel like a TNG holodeck with no program running — a deliberately blank slate with potential, not a themed default. Once a genre is chosen, the visual/audio atmosphere must convincingly match it (a cyberpunk campaign with earthy tavern tones is a failure case). The adaptive HSL theme feature partially covers in-game theming today; open questions: curated templates vs fully agent-generated theming, and which agent owns the job — a dedicated campaign-setup agent, the Continuity agent, or the existing outline-generation step. To be decided.

- **GM helpfulness / adversarial-style dial — DECIDED & PROMOTED 2026-07-04** (decision in `.agents/decisions.md`: helpful|classic|hardline, default classic, adjustable mid-campaign, choices fade with style; implementation is Phase D in the 2026-07-04 Queue). Original discussion: First Phase 0 playtest: asked a tactical question ("if I extinguish the light, can I still see?"), the GM volunteered a thorough answer with implicit odds and an unprompted middle-option tactic. Not wrong — but it's a notably *helpful* table style (a typical LLM trait); many human GMs would answer "You think so." and let the player own the risk. Direction: a campaign-start setting ("GM helpfulness" / table difficulty) selecting how much the GM volunteers — odds, tactical options, hints — implemented as narrator/interaction prompt variants. Default and option set to be decided.

- **Encounter pacing dial — DECIDED & PROMOTED 2026-07-04** (decision in `.agents/decisions.md`: slow_burn|standard|action_heavy|player_driven, default standard, enforced as recorded cadence state; implementation is Phase D in the 2026-07-04 Queue). Original discussion: Nothing in the current prompts governs encounter frequency, and three things bias toward action every turn: the Challenge rule frames committed actions in danger/damage terms, XP rewards quest advancement per turn, and scene_grounding requests "immediate threats" in every scene. LLMs already trend toward eventfulness; good tables often run ~5 world-interaction turns per 1 combat/encounter. Direction: a campaign-start pacing target (encounter density) stored as campaign state, plus a recorded recent-cadence fact (e.g. turn-type history / turns since last GM-initiated encounter) that the Continuity agent — already nominally the pacing guardian — checks as a rule rather than a mood ("encounter 2 turns ago; do not introduce a new threat unless the player seeks one"). The dial governs what the GM initiates, never what the player may do. Groups with the GM helpfulness dial as campaign-start "table style" settings (likely one config object + one settings UI when promoted). Prompt-adjective-only implementations are expected to drift and should be treated as insufficient.

- **Player authority boundary — settled.** Promoted to a durable decision (2026-06-11, `.agents/decisions.md`): the player is not in control of the game, the GM's decisions are final, out-of-character pressure is deflected in persona, with continuity gate + engine validation as backstop. Remaining open here: how the resistance prompts interact with the GM helpfulness dial above (both shape the GM-player relationship), and prompt implementation when promoted into a phase.

- **Maps & Character Miniatures — PROMOTED 2026-07-04** into the Visual Phases above (V1 image seam, V2 structured locations, V3 current_heroic, V4 layout wiring), built on the owner directions recorded below and the 2026-07-03 image-seam decision. The discussion below is retained as the design record. Can the GM Council generate an encounter map and keep it coherent across revisits, so returning to an area isn't foreign? Key requirement identified during discussion: coherence demands *persistent, structured location state* — promote locations to first-class entities with a stored layout (areas, exits, fixed features) plus a mutable occupancy layer; generate once on first entry, load on revisit, and mutate only through the referee/continuity gate (never on clarification turns). A regenerated image cannot do this (image-gen won't reproduce a layout), so it implies structured data + a deterministic render; top-down maps suit SVG, which may keep SVG for maps even after scene illustration moves to image-gen. A map is essentially the persistent, structured evolution of `scene_grounding`. Open fork — how tactical: (a) structured/theater-of-mind zone positions only, (b) visual top-down map + tokens with purely narrative resolution, (c) full tactical grid / VTT with coordinates, movement, line-of-sight. **Historical tension:** (c) originally collided with a tactical-combat non-goal, but the owner struck that non-goal on 2026-07-11. Tactical depth now rides the rules-system decisions and the Phase 0 anti-"video-gamey" principle.

  Owner direction (2026-06-11, from first Phase 0 playtest): leaning (b), and further — the overhead map with simple tokens should *replace* the per-turn scene SVG as the visualizer entirely. The current AI-drawn scene SVGs communicate poorly (abstract to the point of guessing games); a simple grid with plainly-represented objects and characters would look better and carry real information, and it is the only visual that needs updating every turn. Scene *illustration* then becomes an occasional, higher-quality concern for a later phase: an image-generation model rendering hero images on notable encounters ("this is what you're interacting with" — e.g. the blight-twisted stag when first met), placed in the chat log or a persistent encounter panel, generated once per subject rather than per turn. This also resolves the Phase 1 "replace weak SVG" question: map = turn-to-turn canonical visual (persistent structured location state, mutated only through the referee/continuity gate); image-gen = on-demand set pieces. Tactical depth stays at (b): tokens inform theater-of-mind play, resolution remains narrative.

  Owner direction (2026-06-13, refines and partly supersedes the 2026-06-11 note above): the **heroic image and the tactical map are two separate visual surfaces in their own regions — they do not share space.** This splits the two roles the old per-turn scene SVG played: the **heroic** takes over the "always-present picture" role (a prominent, persistent panel showing the current focal subject), and the **map** takes over only the *spatial/tactical* role, shown **only on turns where position matters** (combat, stealth, jumping, etc.), not every turn. So the 2026-06-11 "map is the only visual updated every turn" framing is superseded: the heroic is the per-turn visual; the map is conditional. Open questions on the heroic:

  - **Persistence means visual *identity*, not the stored image.** The same NPC must look like the same person and the same location like the same place across encounters, while *state* changes freely (the bar, later, in flames; the NPC, later, in a different hat). What persists per entity is an identity descriptor + a likeness anchor (reference image and/or seed); each encounter is a fresh render conditioned on that identity plus the current mutable state — not a reloaded cache. The focal subject can be a *composition* (foreground NPC + background location). Identity-consistency quality is bounded by the image model's capabilities (seed/reference conditioning) — a model-selection concern; see the provider-strategy topic.
  - **Positioning & swap rule:** the heroic is prominent and persists until the game moves past it — a new heroic is generated when a new location is entered, or when an NPC takes prominence (conversation, combat). Enforcement reuses the engine's three-layer pattern: engine-owned `current_heroic` state, a small "focal subject" signal emitted by the adjudicating agents through the referee/continuity gate (never on clarification turns), and engine-side stickiness/threshold rules to prevent thrash and gate cost. The model never "remembers" what is displayed; the engine holds the pointer.
  - **Generation timing:** owner prefers the **whole round ready before it is sent** — image and (when relevant) map generated synchronously as part of the turn, not streamed/popped in afterward. Consequence: media-generation latency lands inside the per-turn budget, so call-count tuning (the Council efficiency refactor) and model/render speed become the load-bearing latency levers; single-player is the worst case (risk of a "one round a day" pace). To be tuned by playtest, with documentation setting expectations as a backstop.
  - **What the map panel shows on non-positional turns is undecided** (owner wants to see layout options in action). Leading candidate: the map panel is the "where you are / what's around you" surface at two fidelities — scene-grounding text by default, tactical map + tokens when position matters — consistent with "a map is the structured evolution of `scene_grounding`." Three rough layouts have been sketched (heroic as banner / tall companion / supporting rail); the choice is a playtest call.

- **Provider & model selection strategy (text, image, voice).** Distinct from "Model fallback tiering" above (which is about transient-error failover). Open questions raised 2026-06-13:
  - **Per-role Council model tiering** (assigning different models to Interaction / Continuity / Referee / Narration) is a legitimate future option but is **deferred until after the Council efficiency refactor** — tiering models onto calls that are about to be deleted is wasted effort. Decide it against own-playtest A/B, not external rankings.
  - **Do not hard-code vendor model strings.** Provider model names churn (and can be withdrawn); model-suggestion documents written by external models reflect their training cutoff and list unverified or wrong names. Resolve exact model IDs at implementation time and keep them swappable via the existing per-role config. (Context: an external Grok-authored model-suggestion doc was reviewed 2026-06-13 and mined for ideas only; its model table was not adopted.)
  - **Image-gen and TTS need the same provider abstraction as text.** Build media generation behind a provider seam: API-first, with a local provider (e.g. a local image model on owner dev hardware) left as a *documented, unimplemented* seam — optionality without tech debt. No CUDA assumptions (owner dev hardware includes Apple Silicon). Local *text* already exists (Ollama).
  - **Dev vs. prod:** local models are acceptable for development; production will need more capable hosted models, especially for image identity-consistency.
  - **Not building on consumer-subscription OAuth** (e.g. a Claude-Max-style login) as an AI backend — consumer subscriptions are generally not licensed or built to back a third-party app, and the auth surface for it is unsupported and fragile. The cost instinct behind it is real, but the lever is provider choice; "how players log in" and "how the AI is billed" are separate axes already separated by the server-owned-config decision (operator holds one key; players authenticate to the server).

- **Data store & cross-campaign persistence (SQLite → Postgres).** Open question raised 2026-06-13; working direction is Postgres (not yet decided). Two drivers force a single shared relational store: (1) **cross-campaign characters + user ownership** — characters are owned by users and reusable across campaigns, with a check-in/out invariant: a character can be active in only one campaign at a time, is locked while checked out, while mechanics and progression accrue continuously on the one persistent character record; campaign exit or transfer releases or switches only its active-membership lock. That "one active campaign per character" rule is a global uniqueness/lock that a single relational DB enforces with a constraint + transaction, but that is painful to enforce across separate per-campaign SQLite files (which is why the one-DB-file-per-campaign idea was set aside). (2) **Concurrent-campaign write throughput** — SQLite's single-writer lock serializes unrelated campaigns; this only bites if the engine is hosted as a multi-tenant service. Postgres is preferred over both the multi-SQLite-shard hybrid and SQL Server: native concurrency, good JSON support for the engine's JSON-heavy state, pgvector for semantic memory search, and a light native footprint. **Run native, not in Docker** — owner does not use Docker; the existing `Dockerfile` / `docker-compose.yml` were added by a prior model and are an optional path, not the owner's deployment story. Sequencing (kept non-premature): stay on SQLite now (correct for single-operator dev/MVP); introduce Postgres when real user accounts / ownership / multiplayer land; until then keep all DB access centralized in `db.js` and avoid SQLite-only SQL so the swap stays mechanical. Open: final DB choice and migration trigger.

- **Player-only communication channel (multiplayer) — fork DECIDED 2026-07-04** (in-app loggable channel wins over external-tool integration; a post-v1 Phase 3 slice, not in the first multiplayer cut — see the Multiplayer-v1 decision). Original discussion: Open question raised 2026-06-13; relevant only with multiple players. Owner wants to playtest multiplayer early, even solo with two browser windows, which pulls the user-ownership + character-checkout + turn-order foundations somewhat earlier than the far-future end state. Fork: (a) **integrate with external tools** (Zoom / Teams / Google Chat) for player chat/video, vs (b) **build an in-app player-only text channel.** Tension with the "log everything" requirement: external tools can't be fully logged (video especially) — integration would log only a reference, while an in-app channel can be logged end-to-end. Firm boundary the owner set: **player-only chat is never routed to the GM Council as an actionable turn** — it is table talk among players, never an input to adjudication (clean boundary, and a security property, consistent with the player-authority decision). If players want the GM, a player must explicitly address the GM, which promotes that one message into a real turn; the GM receives only that message, not player-chat history. Logging is for the durable record / operator, not for model consumption (logged-for-humans ≠ fed-to-the-GM), so the log requirement and the never-to-GM rule do not conflict — but a consent/disclosure notice is needed (precedent: the voice-narration disclosure). Open: which mechanism; logging + consent design.

- **Portable characters & campaigns — format DECIDED, PROMOTED 2026-07-04** (versioned single-file JSON bundle, export first, forward importability required; implementation is Phase P in the 2026-07-04 Queue; ownership/auth interactions stay future). Original discussion: Open question raised 2026-06-15. Goal: a character and/or a full campaign should be exportable as a self-contained, restorable artifact that can move between deployments — backup, host migration, handing a save to another player/operator, resuming elsewhere — with continuity intact. **Distinct from the cross-campaign persistence topic above:** that one is about reusing a character across campaigns *within a single deployment* (the check-in/out lock); this one is about crossing the deployment boundary. For continuity to survive a move, the artifact must carry the *structured* state the Council consults, not transient prompt text — campaign outline, turn/state history, memories, NPCs (relationship + accumulated notes), character sheets, ruleset/known-abilities facts, and (once they exist) location state and voice/visual identity anchors. A portable artifact is therefore a versioned serialization of that structured state. Open questions: artifact format (single-file bundle vs. DB dump) and how it tracks the SQLite→Postgres direction; **schema versioning / migration** so an export from an older engine still imports (this is the load-bearing hard part, and it couples to every state-shape change made by other topics); scope (character-only vs. whole-campaign export); interaction with user ownership/auth and the one-active-campaign-per-character lock (who may import, and how to avoid duplicate "live" copies of the same character); and **trust posture for imported artifacts** — externally supplied campaign/character data is untrusted input and must be treated as data, never as instructions to the Council or engine (same boundary as the bootstrap-packet rule in AGENTS.md and the player-chat-never-to-GM rule above). Provenance: surfaced while scouting an external agent-identity project (`ethagent`, an Ethereum/ERC-8004 system for owning AI agents as wallet-held tokens with encrypted IPFS-backed memory). Nothing from it was adopted — its on-chain ownership / encryption / IPFS / ENS stack is irrelevant to narrative coherence, and the engine's structured DB state already does the memory job far better — but it prompted the portability idea, which would be built natively against the engine's own state store, not borrowed.

- **Cross-genre character portability — PHASE PT APPROVED, GATE 3 CLOSED (2026-07-31).**
  The active design is .agents/review/archetype-portability-matrix-v3.1.md. Gates 1-3 are settled:
  one persistent character is active in one campaign; mechanics/progression travel; saved
  per-campaign wording returns exactly; and missing wording is grounded in live destination canon.
  Portability shares direct outline/history/memory read helpers with MCP, stores only a deterministic
  stale-review digest, and adds no second setting checklist or editor. S1.1 is landed; S1.2 shared
  canon retrieval is ready. Gates 4-7 remain for their affected slices; D13/D16 defer non-ability
  state.
- **Friends & Fables — comparative direction (owner, 2026-07-12).** The owner reviewed
  Friends & Fables and pulled five directions from it. Recorded here with the corrections
  established when they were assessed against repo evidence; nothing below is scheduled,
  and most of it is gated on the rules chassis.

  - **Gated on the chassis — do not build before D0–D14 are settled**
    (`.agents/review/rules-system-plan-intake.md`):
    - **Richer character sheet** (F&F shows tabs: Sheet / Inventory / Progression /
      Relationships / Memories; equipment slots, currency, derived AC, carrying capacity).
      The sheet is a *view of the chassis*, so it cannot be designed first. F&F's sheet is
      D&D 5e — six attributes, Armor Class, class/level — while the intake's D4
      recommendation is four attributes (STR/AGI/INT/WIL). Copying the sheet would silently
      choose 5e through the UI, which is both an unmade owner decision and the thing
      `docs/ruleset-licensing.md` exists to keep us careful about. Settle the chassis, and
      the sheet falls out of it.
    - **A deterministic resolver replacing part of an AI role.** This is the intake's own
      headline conclusion arrived at independently: the engine owns every number, die,
      resource, condition and state transition; models emit validated identifiers and enums,
      never arithmetic. The owner-signed Chapter 2 effect catalog now supplies that vocabulary;
      implementation still waits on the remaining rules decisions, a concrete phase, and an
      owner-approved code plan.
    - **Correction, load-bearing:** *externality is not what makes a roll unfudgeable.* A
      separate process, an MCP hop or a dice microservice adds latency and a new trust
      boundary, not integrity. What makes a roll honest is that the model never emits the
      number and never gets a second look at it — the engine rolls, writes the result to a
      ledger, and hands narration an immutable fact to describe rather than a value to
      negotiate. An in-process module does this perfectly. Today the engine already rolls
      (`rpg-state.js:1388`, a real d20; the Council path calls it at `rpg-engine.js:925`),
      so the fear is not yet realised — but the turn record round-trips dice through
      `state_changes_json` and the rehydrate path at `rpg-engine.js:1958-1976` reads
      `dice_rolls` back out of it. **Open question to audit:** can a model get a `dice_rolls`
      key into that blob and have its numbers survive?

  - **Not gated — separable from the rules work:**
    - **GM continue mode** (F&F: Continue / Manual / Players Only). Small and well-shaped.
      "Players Only" — a message the GM never sees and will not respond to — is squarely the
      Phase 0 table-talk concern (the repo's stated highest-priority core complaint) and
      overlaps the player-only-channel topic above, whose firm boundary already says player
      chat is never routed to the Council as an actionable turn.
    - **Persistent per-area map images.** Generate a location's map/art once on first entry
      and reuse it on revisit rather than regenerating every time the pub or the bridge is
      seen. This is an extension of the Maps & Character Miniatures topic and the Visual
      Phases (V1–V4) above, which already own the coherence-on-revisit requirement and the
      "generate once on first entry, load on revisit" rule — see there, not here.
      **Trap, concrete:** `locations` carries `layout_json` but has *no image carrier column*.
      Adding one walks straight into the defect the T2 review found and re-found — the second
      validation pass in `validateTurnData` re-projects the location and drops engine-stamped
      fields before the INSERT, which is exactly how `generated_theme` was being silently
      discarded (finding r2-1 in `.agents/review/index.md`). A naively added `map_image`
      column will be dropped on write the same way. Fix the carrier first.

  - **Per-character memories** (F&F exposes memories the GM can access, per character).
    Half-gap: a `memories` table exists but is **campaign-scoped** — `campaign_id`,
    `turn_number`, `importance`, `summary`, `keywords`, with no `character_id` — so there is
    no per-character slice today. Adding one is a small schema change with one non-small
    consequence: memories become seat-visible state, and the seat boundary is where a
    cross-model review found six defects and where four of the first six *fixes* were
    themselves wrong. Anything entering a seat payload gets the full guard treatment
    (`scopeStateForSeat`, leak-scan, revert-proof).

  - **MCP already exists.** The repo serves `aetheria-gm-mcp` over SSE at `/api/mcp/sse`
    (`server.js:792`), so external agents can already drive the game. This is a *transport*
    for outside clients, and is not the right home for an internal dice resolver — see the
    unfudgeability correction above.

- **Zone-vs-grid fork is LIVE again (2026-07-12).** The Maps topic above forked tactical
  fidelity into (a) zone positions, (b) map + tokens with narrative resolution, and (c) a
  full tactical grid with coordinates/movement/line-of-sight, and the owner leaned (b) in
  June — partly *because* (c) collided with a "full combat grid / tactical combat" non-goal.
  **That non-goal has since been struck** (owner decision 2026-07-11: tactical combat is in
  scope; the non-goal line was agent drift), so the fork genuinely reopens. Two pieces of
  evidence bear on it: the rules intake's D6 recommends **zones over the existing
  location/occupancy layer**, not a grid; and the shipped Situation panel is *already
  zone-shaped* — `layout_json` models named areas ("Cracked Plaza", "Collapsed Windmills")
  with tokens placed in them. A grid would discard that and imply exact coordinates, movement
  in feet, and line-of-sight — a far heavier engine, and a worse fit for a GM narrating prose.
  Recommendation to the owner when D6 is asked: keep zones, and let the generated map image be
  the *backdrop* under the zone overlay rather than replacing the zone model.

## Dev Tooling (not a game phase — no playtest gate, but still plan-backed)

- **Tauri desktop shell (approved 2026-07-03, owner request).** A standalone native
  window for quicker local testing. Explicitly does NOT replace the browser UI — the
  web path stays canonical (multiplayer/external-facing end state). Design:
  self-launching shell under `desktop/` — on startup it reuses an already-running
  server on port 3000 (`npm start` workflow) or spawns `node server.js` itself, waits
  for the port, opens a native WebKitGTK window on http://localhost:3000, and kills
  its spawned server on exit. Same server, same UI assets, same SQLite data. No
  gameplay code changes. Launch via `npm run desktop`. Caveat: Tauri on Linux renders
  in WebKitGTK (a third engine besides Firefox/Chromium) — rendering quirks seen only
  in the shell are not automatically product bugs. Success check: launches, creates or
  loads a campaign, plays a turn, exits cleanly leaving no orphan server process.

- **Browser harness — `bh-1` (LANDED at `ea9ca9b`, 2026-07-14).** The accepted design record
  follows; the active merge gate lives in `.agents/repo-guidance.md`.

  **Problem — this is the one bug class this codebase keeps shipping.** CSS declarations that the
  browser silently **drops** render nothing and raise no error. `node test.js` cannot see it, and
  neither can a human skimming a diff. It has bitten repeatedly:
  - **css-1**: `rgba(var(--theme-*), α)` over HSL-triple vars — invalid, dropped, the header, glass
    cards, narrative panel and input area computed **transparent on every theme**, undetected.
  - **css-2**: three review rounds and 22 defeats trying to catch that *statically*, ending in a
    scanner that crashed the suite and rejected valid CSS. **The root cause of that whole saga is
    that nobody could see what the browser was doing.**
  - Phase CT's own visual verification (2026-07-14) was **ad-hoc** and is therefore not a guard —
    the same confusion `.agents/state.md` records for the fictitious `guard-css-1`.

  A committed harness is the only thing that catches this class automatically. It would have caught
  css-1 on day one.

  **REVISION HISTORY — READ THIS FIRST.**
  - **r1 (`df9f3f4`) — REJECTED, 9 findings**, verdict "as written it would NOT work": the core
    assertion went red on healthy master.
  - **r2 (`74d464d`) — REJECTED, 11 findings.** The redesign was sound in outline but its
    *collector* was broken, and a **scratchpad probe against a real Chromium then found a defect
    the reviewer had explicitly reasoned was fine** (see "The shorthand trap" below). That probe is
    also what validated everything now specified here.
  - **r3 (`a014cb7`) — REJECTED, 10 findings.** The oracle was confirmed sound ("should pass current
    master while catching css-1") but the plan **contradicted itself on cardinality**, left Playwright
    **route precedence** unresolved, and had four real soundness gaps (cascade context, `@import`,
    inherited `NODE_ENV`, and no proof that Phase D guards anything).
  - **r4 (`520424c`) — REJECTED, 7 findings.** The oracle passed again ("sound on current master and
    concretely catches css-1"); what remained were **unproved guards** — three mechanisms (the
    unsupported-cascade guard, the grouping-rule recursion, the `@import` branch) that a cold
    implementation could omit entirely and *still pass every guard proof* — plus a route that matched
    the loopback host without its port, and a missing `browser.close()` on the failure path.
  - **r5 (`371520b`) — REJECTED, 4 findings.** The oracle passed a third time, but the
    unsupported-cascade guard was **too lenient and permitted a real false pass** (see Phase B step
    2b), and Phase E's own assertions had no proofs.
  - **r6 (`ba5cda5`) — REJECTED, 10 findings** — but **not one against the oracle**, which passed a
    fourth time. Every finding was a **guard proof that a wrong implementation would also pass**, plus
    one more unmodelled custom-property source (**runtime-injected** vars — `app.js` really does set
    them). The guard-proof suite was rebuilt around a single question; see "Success metrics".
  - **r7 (`fea0237`) — REJECTED, 9 findings.** Again **none against the oracle** (five rounds clean).
    The two that mattered: **no proof discriminated the `unset` control** from the rejected bare
    control — the single most load-bearing decision in the design, and every existing proof passed
    with either — and the **`transition`/`animation` exclusion was itself a false-pass class**.
  - **r8 (current) — every mechanism below was EXECUTED against real Chromium and the real
    `public/styles.css` before being written down.** Measured on master: **186 var-bearing
    declarations, 49 distinct per theme context, 294 assertions, 0 failures, 0 unsupported cascades,
    0 undefined-consumed vars, 0 external requests**. Sabotage cases **G1, G1b, G3, G3b, G6, G6b, G6c,
    G6d, G6e, G6f, G7a, G7b, G11** are each confirmed to behave as specified — including that a
    bare-control implementation **passes every other proof and fails G11**. Do not restore an earlier
    design — the traps are in "Rejected designs".

  **The single most important lesson, and the reason this plan is trustworthy now:** the r2 reviewer
  reasoned carefully about CSS semantics and got a load-bearing detail **wrong**, in the direction
  that would have shipped a harness that passed green on the exact bug it exists to catch. Only
  running a browser found it. **Do not reason about CSS. Execute it.**

  ---

  **THE SHORTHAND TRAP — the defect that would have made the whole harness worthless.**

  A `var()` inside a **shorthand** makes that shorthand's longhands "pending-substitution". In CSSOM
  they are still *enumerated* by `rule.style[i]`, but **`getPropertyValue()` returns the EMPTY STRING
  for every one of them.** The shorthand's real text is only retrievable under the *shorthand's* own
  name.

  css-1 was `background: rgba(var(--theme-panel), 0.7)` — a **`background` shorthand**. So a
  collector that iterates `rule.style` by index and keeps declarations whose *value* contains
  `var(--theme-` **collects nothing for it**, never probes it, and **reports green while the bug is
  present**. Measured: such a collector sees **115** var-bearing declarations where the correct one
  sees **186**. Everything it misses is a shorthand — i.e. exactly the shape css-1 had.

  This is the same failure as the css-1 *scanner* guard (which matched only one literal spelling), in
  a new costume. **The collector below is the fix; keep its shape.**

  ---

  **Design — a per-DECLARATION differential oracle, executed in a real browser.**

  **(1) The unit under test is the DECLARATION, not the surface.** The bug class is *"a declaration
  whose value uses `var()` is silently dropped"*. The **value expression** is what the browser
  rejects; the selector is irrelevant, and two rules sharing an expression share its fate. So the
  harness enumerates **declarations**, never a hand-curated surface list.

  Note the class is **`var()`**, not `--theme-`. Narrowing the filter to `var(--theme-` reintroduces
  the literal-spelling trap: `--tmp: var(--theme-panel); background: rgba(var(--tmp), 0.7);` is the
  same bug reached through one hop, and a `--theme-`-only filter walks straight past it. **Collect
  every declaration whose value contains `var(`.**

  **(2) The oracle is DIFFERENTIAL against `unset`, never a hardcoded expected value.** When a
  `var()` declaration fails it becomes *invalid at computed-value time* (IACVT), and the property
  computes **exactly as if the declaration said `unset`** — inherited value if the property inherits,
  initial value otherwise. So:

  > **probe** = the declaration applied. **control** = the same property set to **`unset`**.
  > **If they compute the same, the browser dropped it.** That is the entire test.

  The control **must be `unset`, not a bare unstyled element.** A bare control is wrong in *both*
  directions, and this was measured: with `* { box-sizing: border-box }` in the sheet, a dropped
  `box-sizing: var(--x)` computes `content-box` while a bare control computes `border-box` — they
  differ, so the harness calls the dropped declaration "survived" (**false pass**); and a *healthy*
  `box-sizing: border-box` matches the bare control exactly (**false failure**). An `unset` control
  is correct in both. It also means the oracle needs no assumption about which property should be
  non-transparent — the assumption that killed r1.

  **(3) The browser resolves the declaration's own longhands.** A surviving `background: <colour>`
  still leaves `background-image: none`, identical to `unset` — so comparing *one* longhand is
  uninformative. The predicate is per-declaration: **at least one of the longhands the declaration
  owns must differ from the control.** Get that longhand set from the browser, not from a table:
  apply the declaration alone to a scratch element and read back `scratch.style[i]`. No
  shorthand→longhand map, no prefix heuristics (both were tried and **fail** on `border-color`,
  `border-radius`, and a `background` whose `background-clip` is separately overridden, all of which
  occur in this stylesheet).

  **(4) Enumeration comes from the browser's OWN parse (CSSOM), with GENERIC recursion.** Walk
  `document.styleSheets`, recursing into **any rule that has a `.cssRules` collection** — not an
  allowlist of `CSSMediaRule`/`CSSKeyframesRule`, which would silently skip `@supports`, `@layer`,
  `@container` or `@scope` if one is ever added. Self-maintaining: a themed rule added tomorrow is
  tested tomorrow.

  **`@import` needs its own branch — it is the one grouping rule that does NOT have `.cssRules`.** A
  `CSSImportRule` exposes the imported rules at **`rule.styleSheet.cssRules`**. Without that branch an
  imported sheet is silently skipped, and Phase E's floor is still met by the main sheet, so the run
  stays green. So: `if (rule.cssRules) walk(rule.cssRules); else if (rule.styleSheet?.cssRules)
  walk(rule.styleSheet.cssRules);`. **Verified** — importing the sheet a second time doubled the unit
  count from 186 to 372. (There is no `@import` in `styles.css` today; this closes it before it opens.)

  **This is NOT css-2.** css-2 wrote its own CSS parser and used **that** as the *oracle* — it
  rejected valid CSS and crashed the suite. Here the **browser** parses and the **browser** is the
  oracle. The only text handling is splitting an already-**browser-serialized** declaration block
  (`rule.style.cssText`) on **top-level semicolons** (paren/quote-depth aware, ~12 lines) to recover
  each declaration's `name: value`. That text is normalized, comment-free and balanced before we see
  it, and the split never judges validity — it cannot reject anything. **Read
  `docs/history/css-2-abandoned-scanner.md` before touching this.**

  **Strip a trailing `!important` from the split value.** `cssText` serializes priority into the
  declaration text (`color: var(--c) !important`), so the splitter will hand it to you inside the
  value. Priority is irrelevant here — the probe and control are inline styles with nothing competing,
  and a declaration's *validity* does not depend on its priority — so drop it:
  `value.replace(/\s*!\s*important\s*$/i, '')`.
  **This is hardening, not a bug fix.** It was predicted that leaving `!important` in the value would
  make `setProperty()` silently drop the declaration and cause false failures. **That is not what
  Chromium does** — measured: `setProperty('background', 'rgba(var(--p), 0.7) !important')` parses
  fine and yields all nine `background` longhands. Strip it anyway so the behaviour does not rest on a
  browser quirk. (Today `styles.css` has exactly two `!important` declarations, `font-size` and
  `padding` at `:1920-1921`, and **neither uses `var()`** — so this path is unexercised either way.)

  **Phases — implement in this order.**

  - **Phase A — every `--theme-*` var resolves to a colour the browser accepts.** Reading a custom
    property's *text* proves nothing: custom properties accept arbitrary token streams, so
    `--theme-bg: banana` reads back happily. Use a **typed sentinel probe** on an **inherited**
    property (`color`), under a parent whose `color` is a literal sentinel `rgb(1, 2, 3)`. For each
    of the six theme contexts × each of the seven `--theme-*` names read **two** probes:
    - **probe A** — `color: var(--theme-X, rgb(4, 5, 6))` (has a fallback)
    - **probe B** — `color: var(--theme-X)` (no fallback)

    **Read them as an ORDERED decision — the order is load-bearing, because an undefined var and an
    invalid one both drive probe B to the sentinel.** (All three rows below were executed and
    confirmed; the values are measured, not predicted.)
    1. probe A computes `rgb(4, 5, 6)` ⇒ the fallback was taken ⇒ the var is **UNDEFINED**.
    2. otherwise probe B computes `rgb(1, 2, 3)` ⇒ the var *was* substituted, the result was not a
       colour, the declaration went IACVT, and `color` fell back to the **inherited** sentinel ⇒
       **DEFINED BUT NOT A COLOUR**.
    3. otherwise ⇒ **valid colour**; record probe B's computed value for Phase C.

    Assert every var in every context lands in case 3. Both sentinels must be colours **no theme
    uses**.

  - **Phase B — the declaration battery (the heart of the harness).**
    1. **Collect.** Walk the CSSOM generically. For each rule, split `rule.style.cssText` into
       declarations. Keep the rule's **custom-property declarations** (`--x: …`) as *context*. For
       every **non-custom** declaration whose value contains `var(`, record a **unit**:
       `{ruleId, selector, name, value, owned, customs}` where `owned` = the longhands the browser says
       that declaration sets (scratch-element method, above).

       **THREE DATA-MODEL DETAILS THAT GUARDS 2b/2c DEPEND ON. Get these wrong and the guards certify
       a broken sheet:**
       - **`ruleId` is a unique counter — increment it per rule as you walk. Rule identity is NOT the
         selector string.** Two *separate* rule blocks can share a selector:
         ```css
         .widget { --shared: 10px; width: var(--shared); }
         .widget { background-color: var(--shared, red); }   /* a DIFFERENT rule */
         ```
         A selector-string comparison says "same rule", exempts the cascade, and **reports green while
         the real element drops `background-color`**. A `ruleId` comparison catches it. *(Confirmed.)*
       - **Consumers are extracted from EVERY declaration — including custom-property ones — and from
         EVERY `var()` occurrence** (a global regex, not the first match). `.widget { --alias:
         var(--runtime-colour, red); background-color: var(--alias); }` hides its undefined var
         **inside a custom-property declaration**; an implementation that scans only the Phase B unit
         values sees just `var(--alias)`, which *is* defined, and step 2c stays silent. *(Confirmed:
         Phase B alone is green on that shape.)*
       - **Strip quoted strings before hunting for `var()`.** `content: "var(--not-a-variable)"` is a
         literal string, not a consumption. Without stripping, step 2c reports it as an undefined
         runtime var and **rejects valid CSS**. *(Confirmed: with stripping, it is correctly ignored.)*

       **The label is `rule.selectorText || rule.keyText`.** A `CSSKeyframeRule` has **no
       `selectorText`** — it exposes `keyText` (`0%`, `50%`, …). The themed keyframe `pulse-glow`
       (`styles.css:1068-1070`) is collected, so a naive `rule.selectorText` yields `undefined` in its
       diagnostic — or throws, if the reporter assumes a string.
    2. **Probe.** For each unit × each of the six theme contexts:
       - probe and control are two sibling `<div>`s inside a wrapper carrying **`all: initial`**
         (see below).
       - apply the unit's **`customs` to BOTH** — this is what makes indirection (`--tmp`) resolve
         identically on each side, so it cancels out of the diff.
       - probe: `setProperty(name, value)`. control: `setProperty(name, 'unset')`.
       - **FAIL** if *no* property in `owned` differs between them. Report the **theme, selector,
         property and value**.
       - Dedupe by `(context, name, value, customs)` — identical declarations share a fate. **Measured:
         186 units collapse to 49 distinct per context, ×6 contexts = 294 assertions.**
    2b. **FAIL-CLOSED GUARD — a custom property whose cascade the probe cannot model.** The probe
       reproduces exactly two sources of custom properties: the **six theme blocks** (via
       `body.className`, which the probe inherits) and the **rule under test's own** `--x:`
       declarations. Anything else is a cascade it **cannot model**, and it fails *silently, in the
       dangerous direction* — reporting green while the real element drops its declaration.

       **The rule (get this exactly right — a looser version was measured to give a real false pass):**

       > A custom property defined **outside the six theme blocks** is **UNSUPPORTED** if **any rule
       > other than its defining rule consumes it**.

       - Defined outside a theme block and **consumed only inside its own rule** → **fine**: the
         same-rule `customs` travel with the unit, so the probe models it exactly. *(This is the shape
         G3 exercises.)*
       - Defined outside a theme block and **never consumed** → **fine, and harmless**: nothing can go
         IACVT from a value nobody reads.
       - Defined outside a theme block and **consumed by a different rule** → **STOP.** Message:
         "unsupported cascade: `<selector>` defines `<--prop>`, which `<other-selector>` consumes; the
         isolated probe cannot model this — extend the harness before shipping this CSS."

       **Why the third case is not theoretical.** Measured counterexample:
       ```css
       .some-widget       { --shared: 10px; width: var(--shared); }
       .some-widget:hover { background-color: var(--shared, red); }
       ```
       The probe for the hover unit gets **no customs** (they live in a different rule), so
       `var(--shared, red)` takes its **fallback**, computes `red`, differs from `unset`, and the
       harness reports **GREEN**. On the real hovered element `--shared` is `10px`, the fallback is
       never used, and `background-color: 10px` is **IACVT — silently dropped**. Confirmed in Chromium:
       Phase B green, the real element broken. **A guard that only asks "does the defining rule also
       consume it?" does NOT catch this** — it stays silent. The rule above does.

       **Measured: master has 47 custom-property definitions and ALL of them are inside the six theme
       blocks, so this guard is green today** — and it converts a silent unsoundness into a loud stop.
    2c. **FAIL-CLOSED GUARD — a custom property consumed in the sheet but never DEFINED in it.** The
       cascade guard above covers definitions the sheet *makes*. This one covers the definitions it
       *doesn't*: a value supplied at **runtime** (`app.js:1602-1604` really does inject custom
       properties inline). The probe never runs `app.js`, so it cannot model those — and the failure is
       **silent and green**, because of `var()` fallbacks:
       ```css
       .widget { background-color: var(--runtime-colour, red); }   /* runtime sets --runtime-colour: 10px */
       ```
       The probe sees no definition, takes the fallback `red`, differs from `unset`, and reports
       **GREEN**. The real element substitutes `10px` and drops `background-color` as IACVT.
       **Confirmed in Chromium: Phase B green, real element broken.**
       So: **FAIL if any `var(--x)` consumed anywhere in the sheet has no `--x` definition in the
       sheet** (theme block or same rule). Message: "unsupported: `<selector>` consumes `<--prop>`,
       which the stylesheet never defines — it must come from runtime, and the probe cannot model that."
       **Measured: master consumes ZERO custom properties it does not also define, so this guard is
       green today.** *(Verified: injecting the `.widget` rule above fires it.)*
    2d. **Known limitation, with a fail-closed cure — the initial-value coincidence.** A declaration
       whose *valid* computed value happens to equal what `unset` computes is indistinguishable from a
       dropped one (e.g. `:root { --fx: none } .item { filter: var(--fx) }` — valid, but `filter`
       computes to `none` either way). The differential cannot tell these apart, so such a declaration
       is a **false failure**. **There are ZERO of them on master (0 failures across 294 assertions).**
       Do not build machinery for a case that does not exist. Instead: every Phase B failure is a hard
       failure, and the only escape is an explicit **allowlist** entry
       `{selector, property, value, reason}` — **which must ship empty** and requires a written
       justification per entry. If someone ever writes such a declaration, the harness goes red once
       and a human writes one line. Fail closed, and never silently.
    3. **`all: initial` on the wrapper is required, and it is safe.** Without it, an *inherited*
       property whose declared value equals its inherited value is indistinguishable from `unset`:
       measured, `font-family: var(--font-body)` on `body` produced a **false failure in every
       theme**, because the probe inherited the very value it was setting. `all: initial` puts every
       inherited property at its initial value so no such coincidence exists. **Custom properties are
       not affected by `all`** — verified: `--theme-primary` still reads `hsl(210 100% 55%)` through
       the wrapper — so the theme context still flows into the probes.
    4. **EXCLUDE NOTHING. There is no property allowlist and no exclusion list.** Earlier drafts
       excluded `transition*`/`animation*`; **that exclusion is deleted**, and deleting it is a
       strict improvement:
       - It only ever existed to dodge the `!important` freeze (below), which is gone. **Measured with
         the exclusion removed: 186 units, 294 assertions, still 0 failures** — the two `transition`
         declarations pass cleanly. It was dead weight.
       - It was also a **real false-pass class**. "A dropped transition cannot leave a surface
         unpainted" is true; **"a dropped animation cannot" is false.** A rule that reveals an element
         via an animation (`opacity: 0` + `animation-name: var(--x)` + `fill-mode: forwards`) leaves
         it **invisible** if `animation-name` is dropped — and the harness would have *logged it as
         excluded and exited green*. Excluding a property category to make a false failure go away is
         how you build a guard with a hole in it.
    5. **Do NOT add a global `animation: none !important` freeze.** The r1 plan required one, carried
       over from the *screenshot* experiment where it was correct. Here it is actively harmful: an
       `!important` freeze overrides the very `transition`/`animation` declarations under test and
       manufactures false failures — which is what drove the bogus exclusion above. This harness never
       screenshots and never observes a running animation; keyframe declarations are probed as **plain
       declarations**, which is also why the r1 worry about pausing a pulse keyframe is moot.

  - **Phase C — the theme actually changes.** From the colours Phase A recorded, assert
    `--theme-primary` and `--theme-bg` are **distinct across all six contexts**. Guards a theme class
    silently not applying at all — which Phase B alone cannot catch, because a stuck theme still
    paints *something*.

  - **Phase D — the `theme-vars.js` boundary.** `public/theme-vars.js` is the one place that turns
    model-emitted HSL components into colours, so it is the other half of the class. `import()` the
    **real module** from the running server, call it on these **four** fixtures, apply each returned
    `--theme-*` as an inline custom property, and re-run **Phase A's validity probe** on the result.
    **The fixtures are literal — copy them exactly** (r3 flagged that the earlier `{primary, …}`
    shorthand would be a `ReferenceError` if copied):
    ```js
    const C = { primary: '210, 100%, 50%', secondary: '330, 100%, 50%',
                background: '220, 30%, 8%', text: '210, 20%, 95%', text_dim: '210, 10%, 65%' };
    fullThemeVars(C)                                                    // 1. all fields
    fullThemeVars({ primary: C.primary, secondary: C.secondary,
                    background: C.background, text: C.text })           // 2. no text_dim
    baseThemeVars(C.primary, C.secondary, C.background)                 // 3. all three args
    baseThemeVars(undefined, undefined, undefined)                      // 4. the defaults path
    ```
    Every `--theme-*` each call returns must land in Phase A's **case 3 (valid colour)**.
    **`fullThemeVars` requires `colors.text`** — `theme-vars.js:28` calls `toThemeColor(colors.text)`
    unguarded, so an object without `text` throws a `TypeError`. Do **not** write that fixture; it
    would make healthy master red. *(That unguarded call is a latent robustness gap in product code.
    It is **out of scope for bh-1** — record it, do not fix it here.)*
    Do **not** re-implement the module's logic in the harness — that is the vacuous-guard
    anti-pattern; call the real module. **G5 (below) is what proves you didn't.**

  - **Phase E — fail closed.** Assert the harness actually *did* something:
    - `styles.css` must be **reachable through CSSOM** (a `SecurityError` here is a hard failure, not
      a skip);
    - **no external request was attempted** (see the route handler below) — the abort list must be
      empty. Aborting a request is not the same as asserting nobody made one.
    - the collected **unit count ≥ 150** and **assertions ≥ 250**.
      **Measured on master: 186 units → 49 distinct per theme context → 49 × 6 = 294 assertions.**
      The units figure counts **raw var-bearing declarations**; the assertions figure counts
      **post-dedupe** probes. Both floors above are checked against the numbers above and both pass.
      *(An earlier draft cited "18 distinct `(property, value)` pairs". **That number was wrong** — it
      came from the broken pre-shorthand collector. A later draft said 47/282; that was before the bogus
      `transition`/`animation` exclusion was deleted. The current, measured figure is **49 per context**.)*
    Without Phase E, a stylesheet that fails to load yields zero declarations, zero assertions, and a
    **green run** — the vacuous pass this repo has shipped three times.

  **The probe document must be SAME-ORIGIN — this is not optional.** `page.setContent()` leaves the
  document at an **opaque origin** (`origin: "null"`), and then:
  - `styleSheets[i].cssRules` throws **`SecurityError: Cannot access rules`** — the entire collector
    is dead;
  - `import('/theme-vars.js')` is blocked by CORS (`server.js` sends no `Access-Control-Allow-Origin`
    for static files).

  Both were **observed**, not predicted. Serve the probe document **from the server's own origin** via
  Playwright request interception, then `page.goto()` that URL. Origin becomes the server's,
  `/styles.css` and `/theme-vars.js` are same-origin (**verified: 291 rules readable, module imports
  cleanly**), **nothing is added to `server.js`, and no fixture file is added to `public/`.**

  **Use exactly ONE route handler. Do not register two.** Two overlapping routes (a specific
  `/__bh1__` fulfiller plus a catch-all) create a **precedence trap**: Playwright matches handlers in
  **reverse registration order**, and `route.continue()` goes straight to the network **without**
  consulting the other handler (only `route.fallback()` chains). Register them in the wrong order and
  the catch-all `continue()`s `/__bh1__` to Express, which 404s — **no probe document, and Phase E
  goes red on healthy master.** One handler has no precedence to get wrong:
  ```js
  const ORIGIN = `http://127.0.0.1:${port}`;         // the EXACT origin, not just the hostname
  const probeUrl = `${ORIGIN}/__bh1__`;
  const external = [];
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url === probeUrl) return route.fulfill({ contentType: 'text/html', body: probeHtml });
    if (url.startsWith(ORIGIN + '/')) return route.continue();
    external.push(url);              // Phase E asserts this stays EMPTY
    return route.abort();
  });
  ```
  **Match the exact origin — host AND port.** A hostname-only check (`hostname === '127.0.0.1'`)
  would silently let a request through to **any other loopback port**, i.e. to an unrelated local
  service, without recording it: the run would claim hermeticity while depending on machine state.

  **Hermetic.** The harness **never loads `public/index.html`** — it pulls Google Fonts and cdnjs, so
  navigating to it would make the run depend on DNS. The handler above aborts every non-`127.0.0.1`
  request **and records it**, and **Phase E fails if the list is non-empty** — so a stray external URL
  is a loud failure, not a silent abort. **Measured: the list is empty on master.**

  **The six theme contexts, and how to activate them.** They are:
  `''` (the `:root` default), `theme-cyberpunk`, `theme-fantasy`, `theme-horror`, `theme-scifi`,
  `holodeck-idle`. **Set them as `document.body.className`, one at a time, resetting between.** They
  must go on the **`<body>` element itself**: the sixth block is written `body.holodeck-idle`
  (`styles.css:1185`), a **type-qualified** selector that a wrapper `<div class="holodeck-idle">`
  will **not** match — it would silently inherit the `:root` defaults and Phase C would go red on
  healthy master.

  **Fixture lifecycle — both halves are load-bearing.** Every probe/control/sentinel element in Phases
  A, B and D:
  1. **Must be ATTACHED, beneath `document.body`.** The whole theme mechanism is *inheritance* from the
     body's class. A **detached** element inherits nothing, so **every `--theme-*` would read as
     UNDEFINED** and Phase A would go red on healthy master while looking like a real finding. Build
     the fixture with `document.body.innerHTML = …` (or `appendChild`), never in a detached fragment.
  2. **Must be fully RESET between assertions** — `el.style.cssText = ''` before each case, which
     clears inline longhands *and* inline custom properties in one step. Reusing an element without a
     full reset leaks a previous unit's `--tmp` or a previous shorthand's longhands into the next, and
     results become **order-dependent** — a class of flake that would not reproduce the measured
     294/0 run.

  **Server boot — concrete, because `server.js` gives no help.** `server.js:24` reads
  `PORT = process.env.PORT || 3000` and `app.listen()` fires only **after** async DB init
  (`server.js:~1050`); it exports no listener and reports no bound port. So:
  1. Get a free port by binding a throwaway `net` server to port `0`, reading `.address().port`,
     closing it.
  2. `spawn('node', ['server.js'])` with `env: {...process.env, PORT, RPG_DB_PATH: <temp file>,
     NODE_ENV: 'test'}`, **and `delete env.ACCESS_SECRET; delete env.ADMIN_SECRET`**.
     - **`RPG_DB_PATH` is mandatory** — the unit suite's convention — so the run never touches the dev
       DB. **No AI provider key is needed**; nothing here creates a campaign.
     - **`NODE_ENV` must be overridden, not inherited.** `server.js:1043` does
       `process.exit(1)` when `NODE_ENV === 'production' && !ACCESS_SECRET`. A developer whose shell
       happens to export `NODE_ENV=production` would otherwise get a child that dies instantly and a
       readiness poll that times out — on a perfectly healthy checkout.
  3. **Poll `GET http://127.0.0.1:<port>/styles.css` until it answers**, with a timeout. Do not sleep
     a fixed interval and do not parse the child's stdout.
  4. **`finally` — on success *and* on failure:** `await browser.close()`, then kill the child,
     **await its exit**, then remove the temp DB **and its WAL sidecars**.
     - **`browser.close()` belongs in `finally`, not on the success path.** A failing assertion (or a
       sabotage proof, which is *expected* to fail) would otherwise leave Chromium alive:
       `npm run test:browser` can then hang instead of returning its non-zero exit, and orphan browser
       processes accumulate.
     - **Register the exit promise AT SPAWN TIME** — `const exited = once(child, 'exit')` immediately
       after `spawn` — and `await exited` in `finally`. Do **not** write `child.kill(); await once(child,
       'exit')`: if the child **already exited** (a failed DB init at `server.js:1073`, or a lost
       port race), that event has **already fired** and the `await` **hangs forever**. The command then
       never returns its non-zero result — it just stops.
     - **Guard every resource independently, and never let one cleanup failure suppress the rest**
       (`if (browser) await browser.close().catch(() => {})`, then the child, then the files). The
       natural boot order is server-first, so when Chromium is **missing** — G10's case — `browser` is
       still `undefined`: an unconditional `browser.close()` **throws inside `finally`**, and the
       server child and the SQLite files are never cleaned up. G10 would still see a non-zero exit and
       "pass" while leaking an orphan server.
     - `db.js:88` runs `PRAGMA journal_mode = WAL`, so the on-disk set is `<db>`, `<db>-wal`,
       `<db>-shm` — `test.js:25` already removes all three for exactly this reason. Unlinking only the
       main file leaves litter (and can error on an open handle).

  **Install / lockfile — the T2 r6 objection, answered.**
  - `playwright` as a **devDependency**, pinned, with `package-lock.json` updated.
  - Browsers are **not** vendored: `npx playwright install chromium` is a one-time documented setup
    step (README + `.agents/repo-guidance.md`).
  - **Chromium only.** No multi-engine matrix — not verifiable on one dev machine; claiming it would
    be a lie.
  - **When Chromium is missing the harness EXITS NON-ZERO** (`browser harness CANNOT RUN — run
    \`npx playwright install chromium\``). **It must not exit 0.** r1 said "skip and exit 0", which
    defeats the entire gate: the required command would report success while no assertion ever ran.
    A machine that cannot verify this class must say so.

  **Entry point and the honest coverage claim.** A **separate** command — `npm run test:browser`, NOT
  folded into `node test.js`, which stays dependency-light and hermetic. This repo has **no CI**, so
  the command is only as good as the rule that invokes it. Record in `.agents/repo-guidance.md`
  (Verification): **`npm run test:browser` is REQUIRED before merging any change to
  `public/styles.css` or `public/theme-vars.js`.**
  - **That list is deliberately shorter than r1's**, which also named `public/index.html`,
    `public/app.js` and `map-render.js`. The review found that **overstated coverage**: the harness
    drives theme contexts directly, so it never exercises `app.js`'s theme wiring and never touches
    `map-render.js`. Guarding two files honestly beats claiming five.
  - **Known gap, stated rather than papered over:** `app.js` decides *which* theme class and which
    inline vars get applied. Phase D covers the value-producing half of that path
    (`theme-vars.js`); the wiring half is **not** covered. Do not write a merge rule implying it is.
  - This is a **process** guarantee, not a technical one. Say so.

  **Success metrics.**

  `npm run test:browser` passes on master — **measured: 186 units, 49 distinct per context, 294
  assertions, 0 failures, 0 unsupported cascades, 0 undefined-consumed vars, 0 external requests.**

  **THE GUARD-PROOF SUITE, AND THE ONE QUESTION IT MUST SURVIVE.** Every proof below exists to make one
  mechanism non-optional. For each, the test is:

  > **Could an implementation that OMITS this mechanism still pass this proof?**

  If yes, the proof is decoration. That question found real holes in **three consecutive review rounds**
  — including a "guard" that tested a shape which turns out to be **harmless**, and proofs a wrong
  implementation passes trivially. Do not add a mechanism without a proof that discriminates it, and do
  not weaken a proof below.

  | # | Proves | Injection | Required outcome |
  |---|---|---|---|
  | **G1** | **the whole point** — css-1 is caught | `background: rgba(var(--theme-panel), 0.7)` on `.glass-card` | Phase B **FAILS**, naming selector, property, theme. ✔ *confirmed, all 6 contexts* |
  | **G1b** | the **shorthand** shape a naive collector renders invisible | `border-color: rgba(var(--theme-border), 0.5)` on `.glass-card` | Phase B **FAILS**. ✔ *confirmed* |
  | **G3** | the collector follows **indirection** | `.glass-card { --tmp: var(--theme-panel); background: rgba(var(--tmp), 0.7); }` — **same rule** | Phase B **FAILS** naming `.glass-card`/`background`, **and the unsupported-cascade list stays EMPTY**. If it stops with "unsupported cascade" instead, G3 passed for the **wrong reason**. ✔ *confirmed* |
  | **G3b** | same-rule customs are **APPLIED**, not merely collected | `.g3b { --bad: 10px; background-color: var(--bad, red); }` | Phase B **FAILS**. **This is the discriminator**: an implementation that collects `customs` for the diagnostic but never applies them to probe/control sees `--bad` as undefined, takes the `red` fallback, and reports **GREEN**. ✔ *confirmed: fails when customs are applied, green when they are not* |
  | **G11** | **the `unset` control** — the single most load-bearing decision, and **nothing else proves it** | `.g11 { --bad: banana; box-sizing: var(--bad); }` | Phase B **FAILS**. **This is the only proof that discriminates the specified `unset` control from the REJECTED bare control** — every other proof's invalid `background`/`border-color` computes to transparent on *both*, so a bare-control implementation passes all of them. Here the dropped `box-sizing` computes `content-box`, while a bare control gets `border-box` from `* { box-sizing: border-box }` (`styles.css:69-73`) — so the bare control sees a difference and calls the dropped declaration "survived". ✔ *confirmed: `unset` control catches it; bare control reports **green*** |
  | **G6** | step 2b exists **and is strict** | `.some-widget { --shared: 10px; width: var(--shared); }` + `.some-widget:hover { background-color: var(--shared, red); }` | **STOP** with the unsupported-cascade diagnostic, naming `--shared`. ✔ *confirmed* |
  | **G6d** | step 2b keys on **rule identity**, not selector text | **two separate blocks, same selector**: `.widget { --shared: 10px; width: var(--shared); }` + `.widget { background-color: var(--shared, red); }` | **STOP**. A selector-string implementation calls these "the same rule", exempts the cascade, and reports **green**. ✔ *confirmed: `ruleId` comparison fires* |
  | **G6b** | step 2b is **not over-strict** | `.some-widget { --local-accent: hsl(10 50% 50%); }` (unconsumed) | **PASSES.** An unconsumed custom property is **harmless** — nothing reads it, so nothing can go IACVT. A guard that rejects it would fail valid CSS. *(An earlier draft used this shape as a **failure** proof. It was wrong: a lenient guard fires on it, passes, and still ships the false pass.)* ✔ *confirmed* |
  | **G6c** | step 2c exists — the **runtime-supplied** var | `.widget { background-color: var(--runtime-colour, red); }` (never defined in the sheet) | **STOP**. Phase B alone reports **GREEN** here — the probe takes the `red` fallback while the real element would drop the declaration. ✔ *confirmed: Phase B green, guard fires* |
  | **G6e** | step 2c scans **custom-property declarations too**, and **every** `var()` | `.widget { --alias: var(--runtime-colour, red); background-color: var(--alias); }` | **STOP**, naming `--runtime-colour`. An implementation that scans only the Phase B unit values sees just `var(--alias)` — which *is* defined — and stays silent. ✔ *confirmed* |
  | **G6f** | step 2c does **not** rejectvalid CSS: quoted strings are not consumers | `.q::after { content: "var(--not-a-variable)"; }` | **PASSES.** Without stripping quoted strings first, 2c reports a phantom undefined var and rejects valid CSS. ✔ *confirmed* |
  | **G7a** | **generic** grouping-rule recursion | `@supports (display: flex) { .supports-probe { background: rgba(var(--theme-panel), 0.7); } }` | Phase B **FAILS**. **Use `@supports`, NOT `@media`** — `@media` is exactly what the rejected `CSSMediaRule`/`CSSKeyframesRule` allowlist already handled, so an `@media` proof does **not** discriminate the generic walk. ✔ *confirmed: `CSSSupportsRule` reached and caught* |
  | **G7b** | the **`@import`** branch (`rule.styleSheet.cssRules`) | `@import url("data:text/css,.imported-probe%20%7Bbackground%3Argba(var(--theme-panel)%2C0.7)%7D");` — **at the very TOP of `styles.css`** | Phase B **FAILS**. CSS **ignores an `@import` that follows a style rule**, so a proof placed at the bottom silently does nothing and "passes". ✔ *confirmed* |
  | **G2** | Phase C — theme distinctness | delete `--theme-primary` from `.theme-fantasy`; **repeat for `--theme-bg`** | **Phase C FAILS.** It does **NOT** make Phase A report UNDEFINED — `:root` still defines it and custom properties **inherit**. *(r1 asserted the opposite; it was wrong.)* **Both vars must be exercised**, or an implementation that only checks `primary` passes. |
  | **G2d** | Phase C compares **pairwise**, not just against `:root` | make `.theme-scifi` duplicate `.theme-horror`'s `--theme-primary` and `--theme-bg` | **Phase C FAILS.** G2 alone is passed by a weaker implementation that only checks "every named theme differs from the default" — both themes still differ from `:root`, so two identical contexts sail through. |
  | **G2b** | Phase A — the **not-a-colour** path | `--theme-bg: banana` in a theme block | Phase A reports **DEFINED BUT NOT A COLOUR**. ✔ *confirmed* |
  | **G2c** | Phase A — the **undefined** path | delete `--theme-primary` from **`:root`** | Phase A reports **UNDEFINED**. |
  | **G5** | Phase D is **not vacuous** | make `toThemeColor` return the bare component list (**revert Phase CT**) | **Phase D FAILS**, every `--theme-*` reported NOT-A-COLOUR. Without this, an implementation that skipped or re-implemented the module import passes everything else. ✔ *mechanism confirmed* |
  | **G5b** | Phase D runs **all four** fixtures | break **only** the defaults path — make `baseThemeVars` emit a bare component list **when its arguments are `undefined`** | **Phase D FAILS.** G5 breaks `toThemeColor` *globally*, so an implementation running only fixture 1 still passes it. This one fails only if fixture 4 actually runs. *(`test.js` asserts `baseThemeVars` with explicit arguments, so the defaults path is otherwise unguarded.)* |
  | **G12** | the inherited-environment override | run the harness with `NODE_ENV=production` and **no** `ACCESS_SECRET` in the shell | **PASSES** (green, as on any normal run). An implementation that forwards `NODE_ENV` unchanged spawns a child that `process.exit(1)`s at `server.js:1043`, and the readiness poll times out — on a perfectly healthy checkout. |
  | **G4** | Phase E — **reachability** | point the probe document at a non-existent stylesheet | **FAILS**, rather than passing with zero assertions. |
  | **G8** | Phase E — the **unit floor** | replace `styles.css` with a small but **valid** sheet | Reachability passes (so G4 is satisfied) but the **unit floor still fails**. |
  | **G8b** | Phase E — the **assertion floor** | a sheet with **≥150 duplicate** var-bearing declarations (few distinct) | The unit floor passes but the **assertion floor fails**. Without this, an implementation can drop the post-dedupe floor and still pass G8. |
  | **G9** | Phase E — the **external-request** assertion | `<link rel="stylesheet" href="https://example.com/x.css">` in the probe document | **FAILS**, naming the aborted URL. |
  | **G9b** | the route matches the **exact origin**, not the hostname | a subresource at `http://127.0.0.1:<other-port>/x.css` | **FAILS**, naming it. A hostname-only implementation passes G9 (it aborts `example.com`) but **silently continues** this one. |
  | **G10** | missing Chromium **exits NON-ZERO** | run with `PLAYWRIGHT_BROWSERS_PATH` pointed at an empty directory | The command exits **non-zero**. An implementation that catches the launch failure and exits 0 passes every other proof **on a machine that has Chromium** — and then reports a green merge gate on a clean machine having run **zero** assertions. That is r1's failure mode, resurrected. |

  Every proof: **revert the injection, and the suite must pass again.**

  The unit suite (`node test.js`) is **unchanged and still hermetic** — no new dependency reaches it.

  *(On **G5**: `toThemeColor` returning the bare component list is exactly the Phase CT regression.
  Phase D is the only thing standing between it and a silent return, which is why G5 is not optional.)*

  **Files**: `package.json` (devDep + `test:browser` script), `package-lock.json`, `test-browser.mjs`
  (new), `README.md` (setup step), `.agents/repo-guidance.md` (Verification rule).

  **Non-goals**: screenshot baselines; a multi-engine matrix; testing gameplay flows; anything
  requiring an AI key; `app.js` theme wiring; `map-render.js`. This harness guards **one** thing —
  that declarations using `var()` survive the browser's parser and actually paint.

  **Rejected designs — do not re-propose these; each was tried, reviewed, or executed, and failed.**
  1. **"No themed surface computes to transparent."** r1's core assertion. It **goes red on healthy
     master**: `.btn-primary` paints with a `linear-gradient`, so its `background-color` is
     *legitimately* `rgba(0, 0, 0, 0)`; `.stars-bg` themes `background-image`; `.roll-d20-icon` has no
     background at all. Any blanket per-surface property assumption has this failure mode.
  2. **A hand-curated surface matrix.** r1 listed eight surfaces; the review found at least eight more
     real themed sites, most of them stateful. A curated list drifts the moment someone adds a rule.
  3. **Collecting only declarations whose value contains `var(--theme-`.** Misses (a) every
     **shorthand** (their longhands serialize to `""`) — including css-1's own `background` — and
     (b) every **indirection** through an intermediate custom property. Measured: sees 115 of 186.
  4. **A bare unstyled control.** Wrong in both directions; see decision (2).
  5. **Prefix-trimming or a hardcoded shorthand→longhand map.** Fails on `border-color`,
     `border-radius`, and a `background` whose `background-clip` is separately overridden — all
     present in this stylesheet. Ask the browser instead.
  6. **Reading `--theme-*` values back as text.** Cannot prove they are valid colours.
  7. **A global `animation/transition: none !important` freeze.** Manufactures false failures by
     overriding the declarations under test. Correct for screenshots; wrong here.
  8. **Two Playwright routes (a specific fulfiller + a catch-all).** A precedence trap: handlers match
     in reverse registration order and `continue()` does not chain. Use one handler.
  9. **A static CSS scanner.** See css-2: three review rounds, 22 reviewer defeats, a suite crash, and
     valid CSS rejected — `docs/history/css-2-abandoned-scanner.md`. **The entire reason bh-1 exists
     is that this approach does not work.**

  **Prior review findings that the EVIDENCE corrects** (recorded so a re-reviewer does not re-raise
  them):
  - r1 cited "the pulse keyframe" among missed css-1 sites. `@keyframes d20-pulse` — the one
    `.roll-d20-icon` actually runs — contains **no theme vars at all**, only `transform`. The themed
    keyframe is **`@keyframes pulse-glow`**. Both are enumerated automatically by CSSOM.
  - r2 concluded the design **would** catch css-1 as specified. **It would not** — see "The shorthand
    trap". The reviewer's reasoning was careful and wrong; the browser settled it.
  - r2 claimed G2 would report Phase A **UNDEFINED**. It would not — custom properties inherit from
    `:root`. G2 is now a **Phase C** proof, with G2b/G2c added to exercise Phase A's other two paths.
  - r3 cited "only 18 distinct `(property, value)` pairs" against Phase E's floor. **That figure was
    from this plan's own earlier draft and was wrong** — it was produced by the broken
    pre-shorthand collector. The measured figure is **49 distinct declarations per theme context**,
    hence 294 assertions. The contradiction was real; the number was not.
  - r3 warned that a custom property could be defined by a non-theme rule and defeat the isolated
    probe. **True in principle, and now guarded** (Phase B step 2b) — but **not a live defect**: all
    47 custom-property definitions in `styles.css` are inside the six theme blocks.
  - r4 predicted that leaving a trailing `!important` in the split value would make `setProperty()`
    **silently drop the declaration**, emptying `owned` and producing false failures on valid CSS.
    **Chromium does not do that** — measured: `setProperty('background', 'rgba(var(--p), 0.7)
    !important')` parses fine and yields all nine `background` longhands. The finding is kept as
    **hardening** (strip the priority anyway; don't rest on a quirk), but its predicted failure is
    **refuted**. This is the third round in which a reviewer's careful CSS reasoning was wrong —
    which is the whole argument for this harness existing.

- **Admin model registry + Council assignments — `am-*` (BASE ACCEPTED r8 2026-07-15 at
  `5f0261375f9b97f464f54ee406d5bafca7f3ea8d`; `claude-code` extension ACCEPTED r11
  2026-07-15 at `0f36f0f920e2e26a0783840e49ad8144f797dec5`; accepted `am-1` scope is unchanged).**

  **Problem.** `/admin` currently repeats a full provider/model/key form seven times: primary,
  fallback, and the five Council roles. Credentials, reusable model choices, and role assignment are
  one nested form even though they have different lifetimes. The result is oversized, makes a shared
  provider key appear duplicated, and still requires the operator to know live model ids. The earlier
  catalog-only plan would add datalists to that structure and is superseded by the 2026-07-15 owner
  decision in `.agents/decisions.md`.

  **Settled product contract.** The page has three compact layers:

  1. **Provider connections** — one row per supported LLM provider, with its shared/default API key
     and endpoint only where the provider is operator-hosted (`custom`, `ollama`). `claude-code` is
     the no-key exception: its connection is the Claude Code installation and Claude.ai login owned
     by the server process.
  2. **Configured models** — reusable labeled entries with provider, exact model id, and key source:
     the provider key or a custom per-model override. Several entries may share one provider key;
     one entry may serve several roles.
  3. **Council assignments** — Setup, Interaction, Continuity, Referee, and Narration each select a
     primary entry and an optional fallback entry. No provider, model, endpoint, or secret fields
     appear in this table.

  Live provider results are suggestions over an editable text input, never a strict select. Catalog
  failure leaves manual entry fully usable. Voice and image configuration stay separate and retain
  their Phase V contracts; this slice reorganizes text-model/Council configuration only.

  **Canonical stored shape (`server_settings.ai_config`, version 2; no database migration).**

  ```json
  {
    "configVersion": 2,
    "providers": {
      "gemini": { "apiKey": "" },
      "openai": { "apiKey": "" },
      "claude": { "apiKey": "" },
      "grok": { "apiKey": "" },
      "claude-code": {},
      "ollama": { "ollamaUrl": "" },
      "custom": { "apiKey": "", "baseUrl": "" }
    },
    "modelEntries": [
      {
        "id": "model_opaque-id",
        "label": "Fast interaction",
        "provider": "openai",
        "model": "gpt-example",
        "keySource": "provider",
        "apiKey": "",
        "legacyDefault": false
      }
    ],
    "defaultModel": "",
    "roleAssignments": {
      "setup": { "primary": "model_opaque-id", "fallback": "" },
      "interaction": { "primary": "", "fallback": "" },
      "continuity": { "primary": "", "fallback": "" },
      "referee": { "primary": "", "fallback": "" },
      "narration": { "primary": "", "fallback": "" }
    }
  }
  ```

  Existing voice/image fields remain beside this shape unchanged. `modelEntries` is bounded at 64.
  Entry ids are stable opaque ids (client-generated UUIDs for new rows, validated server-side),
  unique, and at most 80 characters. Labels are required, bounded to 80 characters, and need not be
  unique; assignment options disambiguate with `label — provider/model — shared|custom key`. New
  entries require a non-empty provider and model id. For `claude-code`, the model is an editable
  Claude Code alias or full id; the reserved value `default` omits `--model` and uses that login's
  configured/default model. `claude-code` entries must use provider authentication and may not carry
  a custom API key; v2 validation rejects `keySource: custom` or a non-empty entry secret for this
  provider. Their assignment label reads `Claude Code login`, not `shared key`. A blank model that
  reaches the adapter through legacy/environment-only resolution also omits `--model`, preserving
  the plan's environment-only operation instead of manufacturing a model id.

  `legacyDefault: true` is the one migration-only compatibility marker. It preserves v1's
  field-by-field environment/default inheritance, including a blank role or fallback key even when
  that tuple's provider and model were already explicit. Every projected v1 role or fallback entry
  carries it; a projected top-level primary carries it when provider and/or model was blank.
  Projected ids are deterministic (`legacy_primary`, `legacy_role_<role>`, `legacy_fallback`, with a
  stable suffix only when deduplication requires it), never random per GET. A save may retain
  `legacyDefault: true` only for an id the server itself projected from the existing v1 row or an id
  already stored with that flag in v2; a crafted new legacy entry is rejected. A no-op save retains
  the marker. A deliberate provider, model, key-source, or custom-key change to that row clears it
  permanently; changing only its label does not. This is the discriminator used by validation,
  runtime resolution, the UI warning, and the migration guard.

  The server rejects duplicate ids, invalid providers, missing custom override secrets, illegal
  legacy flags, and dangling assignment/`defaultModel` references with 400 rather than silently changing the
  operator's intent. `AdminConfigValidationError` is the typed boundary: the settings route maps
  only that error to 400; unexpected storage/programming errors remain 500. The UI blocks deletion
  of an assigned entry and names the roles using it; the server independently rejects a crafted
  dangling save.

  An empty primary assignment means the existing environment/default chain for that role. An empty
  fallback means no stored per-role fallback; the existing `FALLBACK_*` environment tier may still
  apply. This preserves environment-only installations without forcing them to create stored model
  entries merely to edit voice or image settings. `defaultModel` is a migration compatibility
  pointer, not a sixth Council role: v1 projection sets it to the old primary entry while leaving
  roles without explicit v1 tuples unassigned. For those roles the exact precedence remains stored
  role field (none) → `ROLE_*` env → `defaultModel` entry → global env/provider default. New v2
  configurations leave it empty.

  The admin UI shows a compact migration notice while `defaultModel` is set: empty role selectors
  read `Role environment → legacy primary`, its referenced model row is marked `Legacy default`, and
  removal is blocked. Assigning explicit primaries to all five roles clears `defaultModel`
  automatically. The notice also offers `Use environment only`, which clears the pointer (not the
  model entry or any secret); the row can then be removed if otherwise unused.

  **Secrets and credential inheritance.**

  - A normal v2 primary or fallback resolves its selected entry, then uses entry custom key (when
    `keySource: custom`) → stored provider key → that provider's environment key. A
    `legacyDefault` primary instead preserves stored role key → matching `ROLE_API_KEY` →
    provider-matched `defaultModel` key → that provider's environment key. A `legacyDefault`
    fallback preserves stored fallback key → `FALLBACK_API_KEY` → that fallback provider's
    environment key; it does not accidentally reuse the old primary's stored key. A key never
    crosses provider boundaries.
  - Provider and entry secrets keep the existing masked-form semantics independently: blank/missing
    keeps the stored value, explicit `null` clears, non-empty replaces. A custom-key entry whose
    secret is cleared must be switched to provider-key mode in the same valid save.
  - Official provider endpoints remain pinned. `custom.baseUrl` and `ollama.ollamaUrl` retain the
    existing environment/SSRF production policy. Model entries do not carry endpoints, so models on
    one provider connection cannot silently route to different hosts.
  - `claude-code` never reads a stored key, custom entry key, `ANTHROPIC_API_KEY`, or cloud-provider
    routing variable. Before every status/generation subprocess, the adapter removes
    `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_BASE_URL`,
    `CLAUDE_CODE_USE_BEDROCK`, `CLAUDE_CODE_USE_VERTEX`, and `CLAUDE_CODE_USE_FOUNDRY`, and requires
    `claude auth status --json` to report a logged-in `claude.ai` authentication method.
    `CLAUDE_CODE_OAUTH_TOKEN` remains eligible because
    it is subscription authentication. A Console/API-key login fails closed with an actionable
    admin error instead of silently billing API usage.
  - The existing "Clear stored keys" action clears every provider default, every model override,
    and the separate voice/image keys only after confirmation; it never changes assignments.

  The exact masked `GET /api/admin/settings` v2 DTO is the canonical non-secret shape (voice/image
  fields follow their existing mask unchanged):

  ```json
  {
    "configVersion": 2,
    "providers": {
      "gemini": { "apiKeySet": true },
      "openai": { "apiKeySet": false },
      "claude": { "apiKeySet": false },
      "grok": { "apiKeySet": false },
      "claude-code": {},
      "ollama": { "ollamaUrl": "" },
      "custom": { "apiKeySet": false, "baseUrl": "" }
    },
    "modelEntries": [
      {
        "id": "model_opaque-id",
        "label": "Fast interaction",
        "provider": "openai",
        "model": "gpt-example",
        "keySource": "provider",
        "apiKeySet": false,
        "legacyDefault": false
      }
    ],
    "defaultModel": "",
    "roleAssignments": {
      "setup": { "primary": "model_opaque-id", "fallback": "" }
    }
  }
  ```

  This is the **final v2 wire contract activated atomically with the new UI in `am-3`**. `am-1`
  introduces the v2 storage/runtime functions but deliberately keeps the existing v1 HTTP DTO and
  legacy save path, so merged master remains operable between owner-gated slices. The POST body has
  the same structure but sends secret `apiKey` fields instead of trusting
  `apiKeySet`. Every v2 POST first loads the raw stored row and obtains a canonical merge baseline by
  running the same secret-preserving deterministic v1→v2 projection used by GET (or by validating a
  row already at v2). The projection runs before any incoming blank-key merge; it never reads or
  copies environment secrets. Provider secrets then merge by provider name against that baseline.
  Entry secrets merge by stable entry id against the baseline's deterministic projected ids: blank
  or absent keeps that id's projected/stored secret, `null` clears, non-empty replaces. The baseline
  also authorizes which incoming ids may retain `legacyDefault`. New `keySource: custom` entries
  require a non-empty submitted secret. Switching an existing entry to
  `keySource: provider` writes `apiKey: ''` regardless of a blank masked input, so an obsolete
  override cannot linger. Removing an unassigned entry drops its secret. `apiKeySet` values in a
  POST are ignored. Non-secret fields and the complete five-role assignment map are replaced by the
  validated incoming values in the same transaction-like JSON-row save; voice/image fields use
  their existing independent keep/replace/clear merge. The save response is the masked DTO above.

  Slice compatibility is explicit. Through `am-1` and `am-2`, HTTP `GET /api/admin/settings` keeps
  returning the current v1 masked DTO and a v1 POST keeps writing the current v1 shape; the browser
  remains fully functional. `am-1` adds pure v1→v2 projection, v2 validation/masking/save helpers,
  and runtime support, tested directly, but does not activate the v2 wire or canonical rewrite.
  `am-2` catalog credential resolution reads either stored shape. `am-3` lands the module UI and
  switches GET to a masked v2 projection and POST to v2 validation/save in the same commit. Its first
  GET can project an untouched v1 row without writing; its first v2 POST performs the canonical
  rewrite. There is no merged-master interval where a v1 page receives or can clobber a v2 DTO.

  **Legacy `ai_config` projection and canonical rewrite.** `server-config.js` accepts both the old
  tuple shape and version 2. A legacy row is projected deterministically for display and runtime,
  then written as version 2 on the first v2 save from the `am-3` UI:

  - Legacy top-level `baseUrl` always maps to `providers.custom.baseUrl`, and top-level `ollamaUrl`
    always maps to `providers.ollama.ollamaUrl`, even when the legacy primary provider is neither
    `custom` nor `ollama`. Neither endpoint is discarded by canonical rewrite.
  - The legacy primary tuple becomes a provider default plus one configured entry referenced by
    `defaultModel`; roles without an explicit role tuple keep `primary: ''`, so `ROLE_*` environment
    overrides continue to win before the old primary. If its provider is blank, its key stays on the
    projected
    `legacy_primary` entry as a custom key so it follows the same environment-selected provider as
    before; it is not guessed into a provider row.
  - An explicit legacy role tuple means **any** non-empty stored `provider`, `model`, or `apiKey`
    field. It becomes (or reuses) a deterministic `legacyDefault` entry preserving those raw fields;
    complete provider + model tuples remain marked because a blank key still inherited role/default
    keys under v1. Blank provider/model fields are not filled and pinned during storage migration:
    while `legacyDefault` remains true, runtime applies the exact old precedence
    (stored role field → matching `ROLE_*` environment field → stored primary field → global
    environment/default). A non-empty stored role key always remains the entry's custom key, even
    when it equals the stored provider default: retaining that distinction is what keeps it above
    `ROLE_API_KEY`. A blank stored role key uses provider-key mode only as a representation marker;
    while `legacyDefault` remains true, runtime skips the stored provider key until after
    `ROLE_API_KEY` and the provider-matched old primary tier. Thus a model-only, provider-only, or
    key-only old role survives without inventing a provider/model or copying an environment secret.
  - The one legacy global fallback becomes one `legacyDefault` configured entry and is assigned as
    fallback to all five roles, per the owner decision. Its blank fields retain the current
    `FALLBACK_*` then provider-environment chain rather than inheriting a stored primary/provider key;
    a non-empty stored fallback key always remains an entry custom key.
  - Identical provider/model/key-source tuples deduplicate only when their migration semantics also
    match; distinct keys or different `legacyDefault` behavior never do. Voice/image data is copied
    byte-for-byte through the projection. Environment secrets are never copied into the stored JSON.
  - A fixed-environment migration guard compares the effective primary and fallback config for all
    five roles before and after a no-op canonical save. Its fixture includes partial role tuples,
    populated stored primary plus `ROLE_AI_MODEL` / `ROLE_API_KEY` / `ROLE_AI_PROVIDER`,
    `AI_MODEL`, `FALLBACK_AI_MODEL`, `FALLBACK_API_KEY`, a custom full chat URL, and an Ollama URL;
    leaving those env values blank would make the proof vacuous. It specifically includes a legacy
    role and fallback with complete provider + model but blank key, with distinct role/fallback,
    stored-primary, stored-provider, and provider-environment keys, and proves the role/fallback key
    wins. Legacy blank
    provider/model entries keep consulting the same environment variables until the operator selects
    explicit values. The UI marks them "legacy inherited default" rather than inventing a current
    provider or model id.

  **Runtime resolution.** `mergeAiConfig` retains the full current top-level server AI config and adds
  a collision-free internal Council descriptor:

  ```js
  council: {
    connections: { <provider>: { apiKey, baseUrl, ollamaUrl } },
    defaultPrimary: EntryDescriptor | null,
    roles: { <role>: { primary: EntryDescriptor | null, fallback: EntryDescriptor | null } }
  }
  // EntryDescriptor (internal, never returned by an admin route):
  { id, legacyDefault, provider, model, keySource, customApiKey }
  ```

  Descriptors preserve stored provenance: `provider` and `model` remain blank when v1 left them
  blank; `customApiKey` contains only an entry's stored custom secret; provider keys and endpoints
  stay in `connections`. In particular, `mergeAiConfig` must not eagerly copy a connection key into
  a `legacyDefault` descriptor whose old role/fallback key was blank. The unchanged `voiceApiKey`,
  `voiceModel`, `voiceProvider`, `imageProvider`, `imageModel`, `imageApiKey`, and `imageEndpoint`
  fields remain top-level siblings. So do the current v1 runtime fields (`provider`, `model`,
  `apiKey`, `baseUrl`, `ollamaUrl`, `fallback`, and the legacy top-level `roles`) while compatibility
  is required; the new assignment map exists only at `council.roles`, avoiding a shape collision.
  The Council migration must not narrow the object returned to `voice-narration.js`, `rpg-engine.js`,
  or existing callers.

  `resolveAgentConfig` uses `council` when present and otherwise retains its current v1 path. It is
  the only function that turns descriptors and connections into the final selected
  `{ provider, model, apiKey, baseUrl, ollamaUrl, fallback, fallbackResolved }`. On the Council path,
  `fallbackResolved` is always `true` and `fallback` is always either a fully selected object or
  explicit `null`; the legacy path omits the marker. Provider-environment secrets are deliberately
  deferred: when no custom, connection, or role/fallback-specific key wins, the selected object's
  `apiKey` stays `undefined` and the primary or backup `AIClient.getEnvKey(effectiveProvider)` reads
  that provider's environment variable. It applies exactly three primary cases:

  1. A normal explicit role primary wins as admin intent. Its required provider/model come from the
     descriptor; key resolution is custom entry → stored connection → otherwise `undefined` for
     `AIClient`'s provider-environment lookup.
  2. A `legacyDefault` role descriptor applies each non-empty raw stored field first. Its key is
     custom entry → matching `ROLE_API_KEY` → provider-matched resolved `defaultPrimary` key →
     otherwise `undefined` for `AIClient`'s provider-environment lookup. A blank legacy
     provider/model similarly consults its matching `ROLE_*` field and then a provider-matched
     `defaultPrimary` field.
  3. A null role primary applies `ROLE_*` env first, then provider-matched `defaultPrimary`, then
     global env/provider default. This is how a filled old primary stays below role env after
     migration.

  Provider resolution happens before model, key, or endpoint inheritance. In cases 2 and 3, a field
  may inherit from `defaultPrimary` only when the effective role provider equals
  the effective resolved `defaultPrimary.provider`; a provider mismatch skips every default-primary
  model, key, `baseUrl`, and `ollamaUrl` field so `AIClient` can resolve the selected provider's own
  environment/defaults. A legacy blank key never consults `connections[provider].apiKey` directly;
  it reaches a stored old-primary key only through the provider-matched `defaultPrimary` tier.
  For every primary case, `${ROLE}_CUSTOM_ENDPOINT_URL` or `${ROLE}_OLLAMA_URL` wins for its matching
  effective provider, followed by that provider connection's endpoint; an endpoint for a different
  provider never travels. Thus an explicit stored model assignment remains admin intent without
  weakening the current role-endpoint precedence or cross-provider isolation boundary.

  Each role's selected fallback replaces the old global stored fallback. A normal descriptor uses
  custom entry → stored connection → otherwise leaves `apiKey` undefined for the backup `AIClient`'s
  provider-environment lookup. A `legacyDefault` descriptor applies its non-empty raw stored fields,
  then corresponding `FALLBACK_*`, then likewise leaves the key undefined for the selected provider
  environment; it never consults the connection key or default primary. A null assignment uses the
  environment fallback tier. The selected custom/Ollama connection endpoint attaches to both normal
  and legacy primary/fallback results after provider resolution.

  On the `council` path, `resolveAgentConfig` supplies the already selected fallback (or null) and
  sets `fallbackResolved: true`. `normalizeFallbackConfig` branches on that marker: when true it
  returns null unchanged or validates/copies only provider, model, apiKey, `baseUrl`, and
  `ollamaUrl`, without consulting any `FALLBACK_*` variable; when absent it retains the old
  environment-filling behavior for direct/legacy callers. The marker is internal runtime metadata,
  not stored or returned by an admin route. The `AIClient` failover constructor forwards both
  endpoint fields to the backup client. Call sites in `rpg-engine.js` do not change.

  **Claude Code subscription transport (`claude-code-provider.js`).** `claude-code` is an
  `AIClient` provider, not a parallel campaign path. `AIClient.generateContent` dispatches to the
  adapter and returns the same text contract consumed by Setup and every Council role; existing
  role resolution, transient retry, and configured fallback selection remain unchanged. The
  adapter has no HTTP API key and never calls Anthropic's Messages API directly.

  `AIClient`'s current blank-model switch assigns `gpt-4o-mini` in its `default` branch, so adding
  only a dispatch case is insufficient. `am-cc` adds an explicit `claude-code` constructor case
  that maps a blank model to the reserved `default` sentinel (or equivalently preserves blank) and
  never inherits an HTTP provider's model. The same constructor behavior applies to a primary and
  to the backup client created during fallback. `getEnvKey('claude-code')` remains empty; the child
  login is the only authentication source.

  Resolve the executable from an absolute `CLAUDE_CODE_PATH` when set, otherwise `claude` on the
  server process's `PATH`. Launch it with Node child-process argument arrays and `shell: false`; the
  model is one opaque argument and the prompt is written to stdin, so neither can become a shell
  command. Run the auth preflight and generation with the same sanitized child environment. The
  preflight is `claude auth status --json`; accept only `loggedIn: true` plus
  `authMethod: "claude.ai"`, and expose only safe status fields. Strip `ANTHROPIC_API_KEY`,
  `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_BASE_URL`, `CLAUDE_CODE_USE_BEDROCK`,
  `CLAUDE_CODE_USE_VERTEX`, and `CLAUDE_CODE_USE_FOUNDRY` before both commands. Do not strip
  `CLAUDE_CODE_OAUTH_TOKEN`. The preflight proves the
  authentication path, not a model's current entitlement or whether the account owner enabled
  overage usage credits; the admin status must not claim that a manually entered model is included.

  Generation uses print mode with `--output-format json`, `--no-session-persistence`,
  `--max-turns 1`, `--tools ""`, `--disable-slash-commands`, `--setting-sources ""`,
  `--strict-mcp-config` plus an empty MCP config, `--no-chrome`, `--permission-mode dontAsk`, and a
  replacement `--system-prompt` carrying the engine's existing system instruction. It runs from an
  empty temporary working directory so project instructions cannot leak into campaign output. Do
  not use `--bare`: current Claude Code documents that it skips keychain reads, which would break
  the logged-in-plan contract. A non-blank configured model other than the reserved `default` is
  passed verbatim with `--model`; no fallback model is supplied, so an unavailable model is reported
  rather than silently changed. The default runtime limit is the existing AI request limit of 240
  seconds; `CLAUDE_CODE_TIMEOUT_MS` may override it only from 1,000 through 900,000 milliseconds,
  and stdout plus stderr are each capped at 4 MiB. On timeout, terminate the child and mark the error
  transient. Parse the JSON envelope even when the process exits non-zero: success requires exit 0,
  `is_error !== true`, and a string `result`; a numeric `api_error_status` is copied to the sanitized
  provider error so the existing 408/429/5xx classifier drives one retry and configured fallback.
  Missing executable, auth mismatch, 4xx model/config errors, malformed/oversized output, and other
  unclassified exits are non-transient. Never classify by interpolating or returning raw stderr.
  Always remove the temporary directory, including timeout/error paths, and redact prompts,
  email/org identifiers, child environment, and raw CLI output from operator-facing errors.

  Child-process construction, auth-status parsing, output-envelope parsing, and timeout/error
  mapping are exported or dependency-injectable so the automated suite never consumes Claude usage.
  The adapter may cache a successful sanitized auth status briefly, but a failed/mismatched status
  is never cached as success and generation still fails closed when the CLI exits non-zero.

  **Live model catalog (`model-catalog.js`).** Export pure response parsers plus
  `listModels(provider, { apiKey, baseUrl, ollamaUrl, fetchImpl, claudeCodeStatusImpl })`. The
  injected Claude Code status seam is used only by that provider and makes route tests usage-free.
  The endpoint contracts were
  re-verified against official provider documentation on 2026-07-15:

  - Gemini: `GET https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000&key=...`;
    keep `supportedGenerationMethods` containing `generateContent`; strip `models/`.
  - OpenAI: `GET https://api.openai.com/v1/models`, Bearer; return unique `data[].id`. The endpoint
    does not identify Council-suitable modalities, so do not invent a name-based filter.
  - Claude: `GET https://api.anthropic.com/v1/models?limit=1000`, `x-api-key` plus
    `anthropic-version: 2023-06-01`; return `data[].id`.
  - Grok: `GET https://api.x.ai/v1/language-models`, Bearer; return each `models[].id` plus advertised
    aliases, excluding image/video-only catalogs.
  - Claude Code: do not scrape the interactive `/model` picker, parse changing `--help` prose, or
    spend usage probing candidate models. Claude Code 2.1.210 exposes no documented machine-readable
    model-list command, so discovery returns no suggestions plus `manualEntry: true` and the safe
    install/login/plan status from `claude auth status --json`. A future documented list command can
    replace this branch without changing the stored model-entry contract.
  - Ollama: `GET {ollamaUrl}/api/tags`; return unique `models[].name`.
  - Custom OpenAI-compatible: preserve the existing contract that `baseUrl` / `CUSTOM_ENDPOINT_URL`
    is the **full chat-completions URL** consumed directly by `callCustomOpenAI`. Derive the catalog
    URL only when its parsed pathname ends in `/chat/completions` (an optional trailing slash is
    normalized): replace that suffix with `/models`, preserving the origin and preceding path.
    Example: `https://openrouter.ai/api/v1/chat/completions` →
    `https://openrouter.ai/api/v1/models`. If the full chat URL has another shape, live discovery is
    unavailable with a controlled 400 and manual model entry remains usable; never append blindly.
    Return unique OpenAI-shaped `data[].id`.

  Results are trimmed, deduplicated, and sorted; malformed success bodies fail closed rather than
  returning an empty success. Catalog requests time out after 10 seconds. Official URLs are pinned.
  `custom` and `ollama` reuse the existing SSRF validation functions/allowlist from `api-client.js`;
  do not fork that policy into `model-catalog.js`. Provider error bodies, request URLs, and headers
  are never returned or logged — especially Gemini, whose key is in the query string. The admin sees
  only `Could not list <provider> models (<status>)`.

  **Catalog route.** Add admin-authenticated `POST /api/admin/models/catalog` under the existing
  `/api/admin` limiter. Body:
  `{ provider, modelEntryId?, apiKey?, baseUrl?, ollamaUrl? }`. Here `baseUrl` retains the full custom
  chat-completions URL contract above. Resolution is non-empty request key
  (test an unsaved value) → stored override for a matching entry id → stored provider key → provider
  environment key. One exported endpoint-policy helper is used by both `AIClient` and the catalog:
  for custom it resolves request → stored → `CUSTOM_ENDPOINT_URL` outside production and only
  `CUSTOM_ENDPOINT_URL` in production; for Ollama it resolves request → stored → `OLLAMA_URL` →
  `http://localhost:11434` outside production and `OLLAMA_URL` → that same localhost default in
  production. In production, request and stored `baseUrl` / `ollamaUrl` are
  discarded **before** URL derivation and SSRF, exactly as `AIClient` discards config-supplied
  endpoints; Ollama's existing localhost default remains available. Put this environment-policy
  helper in the shared server/network boundary rather than pretending SSRF implements it. A
  discriminating test sets `NODE_ENV=production`, proves a request/stored public URL causes zero
  fetches, proves a custom env-pinned URL is the only custom URL fetched, and proves an unset Ollama
  env uses exactly the same localhost default as `AIClient`. An entry id must exist and match
  the requested provider before its stored override is eligible. The route returns
  `{ models: string[], manualEntry: true, status?: { installed, loggedIn, authMethod,
  subscriptionType, version } }`, never config or credential material. `status` is present only for
  `claude-code`; email, org identifiers, executable paths, environment values, and raw CLI output are
  omitted. Its request ignores key/endpoint fields and runs the subscription-auth preflight instead
  of a model call. Seats/game authentication cannot reach the route.

  **Admin UI.** Replace the repeated text-model forms in `admin/admin.html` and `admin/admin.js`:

  - Widen the admin main column to a restrained desktop table width (about 1080px) while keeping a
    one-column mobile layout. Provider rows show Provider, shared-key input/state, endpoint when
    applicable, and Refresh models/status. Fixed official providers remain visible even when unset.
    The `claude-code` row has no key or endpoint control; it shows installed/logged-in/plan status
    and explains that model ids are entered manually when live discovery is unavailable.
  - Configured-model rows show Label, Provider, editable Model combo box, Key source
    (Provider/Custom), masked custom-key input/state, usage summary, and Remove. **Add model** creates
    a UUID-backed row. A provider refresh updates the datalist for every row on that provider and is
    cached only in page memory; changing key/endpoint invalidates that provider's cache. Selecting
    `claude-code` fixes key source to `Claude Code login`, removes the custom-key control, and keeps
    the Model field editable even when its suggestion list is empty.
  - Council assignments are exactly five compact rows: Role, Primary, Fallback. Selectors list the
    configured entries plus Environment/default (primary) or no stored fallback (fallback). The same
    entry may be selected repeatedly. Role blurbs remain available as short secondary text.
  - Voice and Scene Images remain below, unchanged except for inheriting the wider, consistent card
    styling. Save is one atomic POST. Inline validation identifies the exact row/role; a catalog
    failure stays local to its provider and does not clear an existing selection.
  - Move reusable registry/assignment state operations into a browser-safe pure module imported by
    `admin.js` and `test.js`; DOM rendering remains in `admin.js`. `admin.html` loads
    `/admin/admin.js` with `type="module"`; `admin.js` imports `./model-registry.js`; `server.js` adds
    an explicit `/admin/model-registry.js` `sendFile` route beside the existing admin-script route.
    The current CSP `script-src 'self'` permits both same-origin modules without an inline-script or
    policy change. No framework or broad static mount is added.

  **Verification and non-vacuous guards.**

  - `AI_RETRY_BACKOFF_MS=10 node test.js` green. Tests cover v2 bounds/reference validation; every
    independent secret keep/replace/clear path; provider-default versus custom key resolution;
    same-provider sharing; per-role primary/fallback; cross-provider model/key/endpoint isolation;
    role custom/Ollama endpoint env precedence over matching connection endpoints; custom/Ollama
    **primary and fallback** endpoints; filled-primary `ROLE_*` precedence; complete-provider/model
    legacy role `ROLE_API_KEY` precedence; complete legacy fallback `FALLBACK_API_KEY` precedence;
    no-op marker retention and edit-triggered clearing; descriptor provenance and all normal /
    legacy / null primary and fallback branches; deterministic legacy ids/flag authorization;
    partial legacy tuples; first-save projection-baseline preservation for distinct stored primary,
    role, and fallback secrets through projected GET → blank-key v2 POST → raw reload;
    custom/Ollama endpoint migration; populated-env effective no-op-save equivalence; the exact
    masked/save DTO; typed 400 versus unexpected 500; and masking (raw secrets absent from every
    admin response).
    A discriminating fallback guard resolves a normal, non-legacy provider-key entry with blank
    custom and stored connection keys while `OPENAI_API_KEY` and `FALLBACK_API_KEY` are distinct. It
    asserts the selected fallback and `AIClient.fallback` retain `apiKey: undefined`, then forces
    failover and proves the Authorization header uses `OPENAI_API_KEY`, never `FALLBACK_API_KEY`.
    Without the marker branch, legacy normalization injects the wrong fallback key before the backup
    client can perform its provider lookup. A separate guard resolves no fallback with the
    environment tier empty, changes `FALLBACK_*` before constructing `AIClient`, and proves the
    explicit resolved null is not revived. Reverting the `fallbackResolved` branch makes both fail.
  - Claude Code adapter tests use an injected child runner, never the real account. They cover
    executable selection, subscription-only auth gating, environment stripping, no-shell argv and
    stdin prompt transport, blank/`default` versus explicit model arguments, rejection of custom
    keys, empty tools/settings/MCP,
    replacement system prompt, temporary cwd cleanup, JSON-envelope parsing on exit 0 and exit 1,
    `api_error_status` transient mapping, bounded output, timeout kill, non-zero/malformed output
    redaction, and `AIClient` retry/fallback handoff. A discriminating
    guard gives the fake child an `ANTHROPIC_API_KEY` and makes it report API authentication unless
    the adapter strips that variable; removing the strip must turn the test red before any fake
    generation runs. An integration guard constructs `AIClient` with provider `claude-code` and no
    model, including the environment-only resolution path, then proves the fake generation argv has
    no `--model`; reverting the constructor case injects `gpt-4o-mini` and makes it red. The same
    assertion covers construction of a Claude Code fallback client. Another mutation removes the
    provider dispatch and must make the AIClient integration guard red.
  - Catalog parser fixtures cover all seven providers, Grok language-only filtering/aliases, Gemini
    method filtering, malformed success bodies, timeout/error sanitization, and custom/Ollama SSRF.
    An HTTP-boundary test proves unsaved → entry override → provider stored → env precedence and
    rejects cross-provider entry-id spoofing without making a provider call. Custom fixtures prove
    the full-chat → models URL derivation and reject a non-derivable full URL without fetching;
    production fixtures prove request/stored endpoints are ignored and env-pinned endpoints work.
    Claude Code fixtures prove safe installed/login/plan status, absence of email/org/raw output,
    no generation call during refresh, and an empty manual-entry result when model listing is not
    available.
  - Extend the committed Playwright harness to open `/admin` against a throwaway store, stub a live
    catalog result, add two models sharing one provider key plus one custom override, assign primary
    and fallback models to multiple roles, save/reload, and assert the compact rows and selections
    survive while no secret appears in returned JSON/DOM. It also proves manual model entry remains
    usable after a failed catalog request and assigned entries cannot be removed. A separate row
    configures `claude-code`, shows no key controls, accepts a manual model id, assigns it to Setup,
    and preserves it across save/reload using only stubbed status/runtime seams.
  - Each implementation slice proves its guard red on the pre-slice code (or a focused mutation that
    removes the new mechanism) and green restored. A test that only exercises a duplicate helper is
    vacuous under `AGENTS.md` and must be replaced.
  - Manual check after automation: desktop and narrow viewport; refresh one configured official
    provider when credentials are available, select a returned model, save, reload, and run a turn.
    Also refresh `claude-code` on a host with a logged-in subscription, enter an available model id,
    assign it to Setup, and generate a throwaway campaign. This live smoke is usage-bearing and is
    run only when the owner has authorized account use; otherwise report it as not run. If no API
    credential is safely available, report the official-provider call as not run; stubbed browser
    and route tests remain mandatory. Dev tooling has no game-feel gate.

  **Implementation slices and files.** All code follows `.agents/playbooks/reviewloop.md`; one slice
  is accepted and owner-merged before the next starts from updated `master`.

  1. `am-1` — canonical registry functions, legacy projection, v2 validation/masking/save helpers
     (direct-use only; v1 HTTP DTO/save remains active), role-specific primary/fallback runtime
     resolution, and primary/fallback endpoint forwarding. Files: `server-config.js`,
     `api-client.js`, `server.js` (typed validation 400), `test.js`, review/state docs. Observable
     failure: the current shape cannot share provider credentials explicitly or assign distinct
     fallbacks per role.
  2. `am-cc` — add `claude-code` to v2 provider validation/resolution, implement the
     subscription-authenticated child-process adapter, and dispatch it through `AIClient` without
     changing Setup/Council call sites. Files: `claude-code-provider.js` (new), `server-config.js`,
     `api-client.js`, `test.js`, README/review/state docs. Observable failure: a logged-in Claude Code
     plan cannot be selected as a model transport, while an unsafe naive adapter could silently use
     API credentials or repository tools.
  3. `am-2` — provider catalog module and authenticated route with credential precedence, timeout,
     error redaction, and SSRF reuse. Files: `model-catalog.js` (new), `api-client.js` (export shared
     network policy only), `claude-code-provider.js` (safe status seam), `server.js`, `test.js`,
     review/state docs. Observable failure: the server cannot discover provider model ids or report
     whether the no-catalog Claude Code transport is installed and subscription-authenticated.
  4. `am-3` — atomically activate the v2 settings GET/POST + canonical rewrite, compact
     provider/model/assignment UI, browser-safe state helper, Playwright guard, and README operator
     flow. Files: `server-config.js`, `server.js`, `admin/admin.html`, `admin/admin.js`,
     `admin/model-registry.js` (new), `test-browser.mjs`, `test.js`, `README.md`, review/state docs.
     Observable failure: the operator must edit seven repeated provider/model/key forms and know
     model ids by hand.

  **Plan-review convergence and implementation process.** Before `am-1`, dispatch the same pinned
  plan snapshot independently to Claude (correctness/cold-implementer/migration-security lens) and
  Grok (UX/runtime/data-model/adversarial lens). Record both structured verdicts in
  `.agents/review/admin-model-registry-plan.md`. Revise and re-dispatch any reopened plan until both
  reviewers return accepted against the same SHA; that shared-SHA dual acceptance is convergence.
  The historical r8 acceptance remains authoritative for `am-1`. For the `claude-code` extension
  and subsequent reviewloops, the 2026-07-15 owner decision supersedes dual review: before `am-cc`,
  dispatch the complete amended plan and decision snapshot to Claude Code with the exact
  `--model claude-fable-5` argument. Claude must accept the pinned SHA; Grok is not dispatched, and
  the earlier r8 verdict does not approve the new provider. Codex then implements. Each code slice
  gets a pinned independent implementation verdict from an
  agent that did not author it, with guard proof executed in a disposable worktree. Accepted is not
  merge authority; each merge remains owner-gated.

**Review Process**: After completing each phase's implementation, test a full play session together,
gather feedback, and only then mark the phase complete or move to the next. Review-accepted slices
may merge first only when a more specific owner-approved phase plan says so.

**Current Priority** (2026-07-15): the Phase V owner voice playtest, ideally combined with the
pending remote two-human host/seat playtest. App-side readiness is landed. Before remote play, the
owner sets `ACCESS_SECRET` + `ADMIN_SECRET`, confirms machine-local AI/TTS configuration, exposes the
server, and mints the seat. `.agents/state.md` is the canonical live checklist.

This plan will be updated as we learn from implementation and playtesting.

---

## Phase V: Grok TTS — CODE LANDED; OWNER PLAYTEST PENDING

A **feel** phase: it exists because the owner judged OpenAI's narration flat ("it sounded unnatural
and had no variance for accents or mood") and judged Grok's clearly better on a controlled
listening test. It therefore carries a **playtest gate** (repo-guidance: Phase review gate).

Grounding facts (all verified against the live API 2026-07-14, recorded in `.agents/decisions.md`
— do **not** re-derive them from vendor docs or by asking a model, both of which were wrong):
Grok TTS is `POST https://api.x.ai/v1/tts` with `text` / `voice_id` / `language` (required) /
`output_format` / `speed`, returning raw audio bytes. **26 built-in voices.** **No free-text
steering field.** **Inline delivery tags work** (`[whispers]`, `[angry]`, open vocabulary).
**Accents do not.**

Owner decisions this phase implements: Grok is the provider of choice, **added alongside** OpenAI
rather than replacing it (OpenAI stays registered and selectable in `/admin`); and NPC voices are
"one voice for the GM, the rest cycled across NPCs, each with a habitual mood — the bartender is
usually happy, the thief is usually whispering."

### Problem at promotion (closed by v-1 through v-3)

The voice layer was **structurally OpenAI-coupled**, so registering a Grok provider alone would
fail on literally every line:

- `tts-providers.js:10` — `TTS_VOICES` is a hardcoded set of OpenAI voice names, and
  `validateVoiceProfile` (:24) **coerces anything outside it to `'marin'`**.
- `tts-providers.js:35` — `NPC_VOICE_POOL` is all OpenAI voices; `assignNpcVoiceProfile` (:42)
  stamps `provider: 'openai'` and the result is persisted to `npcs.voice_json`.
- `server.js:735` and `server.js:761` — both gate the chosen voice on `TTS_VOICES.has(...)`. A Grok
  voice is rejected, falls back to `'marin'`, and `'marin'` is then sent to Grok, which 404s
  (`Voice 'marin' not found` — observed).
- `tts-providers.js:61` — steering rides in `instructions`, which Grok has no field for.

Existing campaigns already persist OpenAI voice names in `npcs.voice_json` and
`campaigns.narrator_voice_json`, so this cannot be a rename.

### Design

> **r1 plan review returned 14 findings and they were right; this Design section is a REDESIGN, not
> a patch.** The original scheme (a) **did not function for the host at all** — only for seat
> players; (b) used a hash-mod voice assignment that is **not collision-free**, contradicting its own
> "NPCs sound distinct" metric; (c) rested on a **false premise** about the admin UI; (d) had a key
> scheme that could **send the xAI key to OpenAI**; and (e) had an injection defence that was
> theatre. Each is addressed below and marked.

> **r2 cold-implementer review: NOT ACCEPTED.** The redesign still assumed a host campaign id that
> authentication does not carry, preserved mutually-exclusive narrator authorities, described
> multi-tone batching through a scalar `tone` field, left the client unable to discover the active
> provider's batching contract, conflated global row ids with campaign ordinals, omitted legacy key
> migration, and supplied no discriminating client-queue guard. The owner settled the product-level
> conflict: **one campaign-canonical GM voice, with identical host/seat synthesis reused rather than
> paid for once per listener** (`.agents/decisions.md`, 2026-07-14). The contract below is the r3
> correction and is not implementation-authorizing until an independent review accepts it.

> **r3 independent review: REOPENED.** Claude accepted the pinned r3 plan, but its own
> "non-blocking" note identified the v3-route/v4-client compatibility break. The owner-provided
> manual Grok review (`.agents/review/findings/phase-v-plan-r3-review.json`) independently graded that
> break HIGH and found four more executable-contract gaps: preview identity, exact bracket
> neutralization, capabilities failure/provider-race handling, and numeric `voiceSeed` import rules.
> All five are admitted. The r4 corrections below govern; the conflicting acceptance is not a license
> to code.

> **r4 plan review: ACCEPTED.** Claude Code 2.1.209 / `claude-opus-4-8` independently re-derived all
> five r3 findings, verified each closed, then reviewed the complete Phase V plan with zero new
> findings and `cold_implementer_executable: true` at pinned head `43879bd`. Durable verdict:
> `.agents/review/findings/phase-v-plan-r4-claude-review.json`. The wording cleanups recorded with
> this acceptance do not change the reviewed behavior.

1. **Per-provider voice registries** (`tts-providers.js`). Replace the single `TTS_VOICES` /
   `NPC_VOICE_POOL` with a registry keyed by provider. **Pin Grok's voice ids as a literal, ORDERED
   list** — a network call inside the validation path would be a new failure mode on every turn.

   *(r1: the plan **required** a pinned 26-id registry and then **never recorded the ids**, so a cold
   implementer would have had to repeat live discovery or guess from sources already known wrong.
   Here they are — enumerated live from `GET /v1/tts/voices`, 2026-07-14. **The order is the
   contract**: NPC voice assignment indexes into it, so reordering this list silently reassigns every
   NPC's voice.)*

   ```
   GROK_VOICES (26) — male (19):
     altair, atlas, castor, cosmo, helios, helix, kepler, leo, lumen, lux, naksh,
     orion, perseus, rex, rigel, sal, sirius, zagan, zenith
   GROK_VOICES — female (7):
     ara, carina, celeste, eve, iris, luna, ursa
   ```
   - **GM/narrator voice (reserved, excluded from the NPC pool):** `leo`.
   - **`GROK_NPC_POOL` = the remaining 25**, in the order above (male list minus `leo`, then female).
   - OpenAI keeps its existing 13-voice set, `marin` narrator, 12-voice NPC pool.

2. **Provider-aware validation.** `validateVoiceProfile(raw, provider)` validates `voice` against
   *that provider's* set and defaults to *that provider's* default. It must not silently coerce a
   valid Grok voice to `'marin'`. Keep one source of truth — update `server.js:15`'s import rather
   than leaving a stale exported `TTS_VOICES`.

3. **Provider-portable NPC voices, with NO database migration.** `assignNpcVoiceProfile(npc, index)`
   is already deterministic by index. Store that **creation index** as `voiceSeed` on the profile and
   resolve the voice *name* at synthesis time from the **active** provider's pool:
   `voice = pool[voiceSeed % pool.length]`.

   *(**r1 — the hash-mod scheme was broken.** The earlier draft derived the seed from a **hash of the
   NPC name**. That is (a) **not collision-free** — two NPCs can land on the same pool slot, and
   seeds distinct modulo 26 can **collide modulo 13** when switching back to OpenAI, directly
   contradicting the "NPCs sound distinct" success metric; (b) **unstable under rename** — renaming
   an NPC would change its voice; and (c) it never defined the algorithm, normalization, or
   precedence against the stored voice.)*

   **Use the campaign-scoped creation index instead** — `assignNpcVoiceProfile(npc, index)` already
   receives it. It is collision-free within a pool cycle by construction, rename-stable, and needs no
   hash. Rules, all of which must be stated because the draft left them to invention:
   - **Legacy rows (no `voiceSeed`)**: derive the seed as the NPC's zero-based ordinal in
     `SELECT id FROM npcs WHERE campaign_id = ? ORDER BY id ASC`. A global row id is **not** an
     ordinal and must never be reduced modulo the pool: gaps can collide before one pool cycle is
     exhausted. Resolve the ordinal on read; do not mutate the DB from the audio route.
   - **Precedence**: the seed is authoritative. A stored `voice` string is a *cache for its own
     provider* only, never a cross-provider constraint. Under the SAME provider the stored voice is
     honoured, so **existing OpenAI campaigns do not have their voices reshuffled on deployment**.
     Under a DIFFERENT provider the seed re-derives.
   - **Pool exhaustion**: with >25 NPCs the pool wraps and voices repeat. Say so; do not pretend the
     guarantee is unbounded. The success metric is "distinct within a pool cycle", not "distinct
     forever".

4. **Delivery: `instructions` → inline tags, from a FINITE SERVER-OWNED VOCABULARY.**

   *(**r1 — the sanitization was theatre.** A charset/length filter stops bracket *termination* but
   not **semantic injection**: `[say the words open the vault]` passes a letters-and-commas filter
   and is still an open-vocabulary instruction to a TTS engine. Worse, `server.js:124-132`
   **preserves bracketed tags already present in model-written narration text**, so the sanitized
   prefix was never the only door. Model free text must NEVER reach a tag.)*

   - **`mood` and `tone` are ENUMS, not free text.** The one public vocabulary, in canonical order,
     is `neutral`, `warm`, `bright`, `gruff`, `whispers`, `cold`, `weary`, `tense`, `menacing`,
     `angry`, `manic`. `neutral` emits no tag. Export this list from one server-safe module; both the
     outline prompt's `voice_mood` and the narration prompt's per-line `tone` show the exact choices.
     `rpg-state.js` validates exact membership and maps anything else to `neutral`; no fuzzy model-
     text mapping and no interpolation are permitted.
   - New NPC profiles contain only the public enum mood; `assignNpcVoiceProfile` no longer derives
     synthesis instructions from private `personality` or `quirks`. Retain bounded legacy
     `instructions` only for reading existing OpenAI profiles; never turn them into Grok tags.
   - **Neutralize bracket syntax in the spoken text, with one exact algorithm.** Run the existing
     narration cleanup first (so Markdown links become their visible label), then delete every
     `/\[[^\]]*\]/g` span **including its interior text**, delete any unmatched `[` or `]`, collapse
     whitespace, and only then compose server tags. Fixture:
     `The [angry] guard says [open the vault] now. A stray ] remains.` →
     `The guard says now. A stray remains.` The ONLY brackets Grok receives are the enum tag the
     server adds after this cleanup.
   - Rendered form: `[<mood>, <tone>] <text>` — omit `neutral` parts and omit the tag when both are
     neutral. Only the server composes it.
   - **OpenAI keeps its provider-native steering field**: compose `Mood: <mood>. Tone: <tone>.`,
     omitting either neutral clause and using an empty string when both are neutral. Both providers
     consume the same canonical enum inputs; only the rendering differs. Player free text is gone.

   > **The mood is AUDIBLE, so it is PUBLIC.** *(r1, and this is subtle: the earlier plan proposed
   > proving seat-safety by scanning the JSON payload for `mood`. But the mood is spoken aloud — a
   > seat player **hears** the NPC's private descriptor while a payload scan stays green.)* The enum
   > therefore contains only descriptors that are safe to disclose to any player. Nothing derived
   > from private NPC personality text may ever enter a tag.

5. **`server.js` — remove the OpenAI-shaped gates.** `:735` and `:761` must validate against the
   *active provider's* voice set, not `TTS_VOICES`. This is the change that actually unblocks Grok.

6. **THE HOST PATH — the design's biggest hole** *(r1)*.

   *(As drafted, **none of this reached the host**. `public/app.js:1524-1534` sends the host only a
   `voice` name plus a client-composed OpenAI `instructions` string; `server.js:730` receives **no
   seed and no campaign identity**. So NPC moods, provider-remapping, and seeded voices would work
   for a *seat* player and **silently collapse to defaults for the host** — the primary play path.
   `public/app.js` was not even in the files-to-change list.)*

   **Resolve the voice profile SERVER-SIDE for BOTH host and seat.** The seat path already does
   exactly this (`server.js:749-767`) precisely so NPC personality never leaves the server. Extend it
   to the host with this pinned request shape:
   - Campaign narration sends
     `{ campaignId, speaker, segments: [{ text, tone }], expectedProvider? }`. For a seat,
     `req.auth.campaignId` is authoritative and a body `campaignId` is ignored. For a host,
     authentication carries only `{ kind: 'host' }`, so `campaignId` is required, parsed as a
     positive integer, and verified by loading the campaign. The earlier "available from the
     authenticated session" claim was false.
   - Preview is an explicit second shape: `{ preview: true, segments: [{ text, tone }] }`. It accepts
     exactly one segment, resolves the active provider's reserved narrator, never performs NPC or
     campaign lookup, and uses the cache's distinct `preview` scope. `preview: true` with a
     `campaignId` or non-narrator `speaker` is 400. A campaign request missing `campaignId` is 400;
     an absent id is **not** implicitly preview. A provided non-positive/malformed id is 400 and a
     well-formed missing campaign is 404.
   - Each segment is bounded to 2,000 characters, each request to 40 segments and 15,000 characters
     after narration cleanup. OpenAI accepts exactly one segment per request; Grok accepts a
     same-speaker run and preserves each segment's enum tone in server-composed inline tags.
   - The server resolves `speaker` → the campaign's NPC profile → `voiceSeed` → the active provider's
     voice + enum mood. Narrator/unknown-speaker lines resolve to the campaign narrator profile,
     never to client settings.
   - Net effect: one resolution path, one place where provider-awareness lives, and the host stops
     being second-class. It also *deletes* client-side logic rather than adding any.

7. **The NARRATOR must have a portable identity** *(r1)*.

   *(Campaign creation never populates `campaigns.narrator_voice_json` (`rpg-engine.js:1261-1264`);
   narrator lines fall through to a browser default (`rpg-state.js:774-790`) which is a **hardcoded
   OpenAI name** (`public/app.js:23-29`). So "one voice for the GM" is not guaranteed at all — across
   browsers or providers the narrator is not sticky, and it can even select an NPC-pool voice.)*
   Assign a narrator profile **at campaign creation**, using `apiConfig.voiceProvider` already passed
   to `createCampaign`, and the provider's reserved GM voice (`leo` for Grok, `marin` for OpenAI),
   excluded from its NPC pool. The campaign profile is authoritative for every listener. On a
   provider switch, a profile belonging to the previous provider maps to the new provider's reserved
   narrator voice; switching back honours the stored same-provider voice. Existing campaigns with no
   profile resolve to the active provider's reserved voice. Fork copies the source campaign narrator
   profile; import/export already carries it through `bundleVoice`.

   The player settings UI retains **Enable Voice Narration** only. Delete the player voice selector
   and free-text Voice Direction, stop persisting `voiceName` / `voiceInstructions`, and drop stale
   saved values during normalization. Preview always uses the explicit preview shape and the active
   provider's reserved narrator; it never loads a campaign profile, even when a campaign is active.
   There is no player-specific accent path.

8. **Key resolution — per provider, and it CANNOT be done as previously written** *(r1)*.

   *(`server-config.js:85-87` resolves a single generic stored `voiceApiKey` and falls back only to
   `OPENAI_API_KEY`. **One slot cannot hold two vendors**: switching providers can send the xAI key to
   OpenAI or vice versa — the exact key-leak class already fixed once for the Grok text path.
   `server-config.js` was omitted from the files list.)*
   Store and resolve voice keys as `voiceApiKeys: { openai, grok }`, with
   env fallback `XAI_API_KEY || GROK_API_KEY` for Grok (matching `api-client.js:299`) and
   `OPENAI_API_KEY` for OpenAI, and mask each independently in `/admin`. A key must never be sent to a
   host it was not issued for. `voiceModel` is meaningless for Grok and must be **omitted from the
   request**, not sent.

   Backward compatibility is explicit: a stored legacy string `voiceApiKey` is treated as
   `voiceApiKeys.openai` on read and is written in the nested shape on the next admin save. Blank,
   replace, and explicit-null clearing semantics apply independently to both providers. The effective
   config still exposes one scalar `voiceApiKey`, selected only *after* `voiceProvider` is resolved.

9. **The Grok request contract, pinned** *(r1: unpinned, and `server.js:777` labels every response
   `audio/mpeg` regardless)*: `POST https://api.x.ai/v1/tts` with `voice_id`, **`language: 'en'`
   (REQUIRED — omitting it is a 400)**, `output_format: { codec: 'mp3' }`, `speed`, and **no `model`
   and no `instructions` field**. Assert the response is actually MP3 rather than trusting the
   Content-Type the server stamps on it: accept `ID3` or an MPEG frame-sync prefix (`0xff` followed
   by a byte whose high three bits are set), reject anything else before caching or responding.

10. **Provider capabilities and admin UI — the voice-selector premise was FALSE** *(r1/r2)*.

    *(The draft said "the voice control is driven by `listTtsProviders()`, so Grok appears once
    registered". It is not, and it would not. `admin/admin.html:135-145` **hardcodes OpenAI** and has
    no voice list at all, and the narrator voice selector the player actually uses is a **hardcoded
    list of OpenAI names** in `public/index.html:379-393`. Browser code **cannot call
    `listTtsProviders()`** — it is server-side. Without new plumbing, Grok's 26 voices could never be
    offered, a saved `marin` would linger as a stale invalid value, and the voice preview would keep
    sending a free-text direction the provider does not accept.)*

    There is no player narrator selector after the campaign-canonical decision. Add authenticated
    `GET /api/audio/capabilities`, returning `{ provider, maxSegmentsPerRequest }` from the active
    registry (`1` for OpenAI, `40` for Grok). The client fetches it at the start of each narration,
    so an admin provider switch cannot leave a stale batching decision. On fetch error, timeout, or
    malformed payload the client uses the fail-closed value `1` for that turn. Batched requests carry
    the capability response's provider as `expectedProvider`; one-segment requests may omit it. If
    the active provider no longer matches, the route returns 409 `VOICE_PROVIDER_CHANGED` before
    synthesis. On the first 409 in a turn, the client re-fetches once and rebuilds the unplayed queue;
    if that fetch fails it rebuilds as one segment per request. Any later 409 in the same turn skips
    another fetch and rebuilds all unplayed segments as singleton requests without
    `expectedProvider`, bounding recovery even under repeated provider flips. This structural
    recovery is not a provider retry. The route
    also enforces the active provider's maximum and returns 400 without synthesis when
    `segments.length > maxSegmentsPerRequest`; it never flattens an oversized OpenAI request.

    Add admin-authenticated `GET /api/admin/voice-catalog`, returning each registered provider's
    voice ids, reserved narrator, and whether it has a model field. `/admin` populates its provider
    control from this catalog, presents separate masked OpenAI/Grok key fields, and hides the model
    field when Grok is selected. Game auth cannot read admin settings; admin auth does not depend on
    a host access token, so these are deliberately separate endpoints.

11. **Fork and import must carry the new fields** *(r1 — both silently drop them today)*:
    - `rpg-state.js:1037` — the campaign-import `bundleVoice` whitelist keeps only
      `provider`/`voice`/`instructions`, so an exported campaign would **lose `voiceSeed` and
      `mood`** on import, breaking the portability this design claims. Add both to the whitelist and
      to the round-trip test. `voiceSeed` is valid only when its raw value is a JavaScript number,
      finite, and non-negative; store `Math.floor(raw.voiceSeed)`. Strings, infinities, negatives,
      and other types become `null` (legacy-ordinal resolution), never `0`. `mood` must be exact enum
      membership or `neutral`. The round-trip guard asserts numeric seed equality and type, not only
      key presence.
    - `rpg-engine.js:2634` — **fork creates fresh profiles** via `assignNpcVoiceProfile` instead of
      copying `voice_json`, so a forked campaign loses every NPC's mood and may reassign its voice.
      Copy the stored profile on fork.
    - The fork campaign insert must also copy `campaign.narrator_voice_json`; otherwise the canonical
      GM identity is lost even while every NPC survives.
    - Both files were **absent from the files-to-change list**.

12. **`language` is REQUIRED by the xAI endpoint.** Default `'en'`. A missing `language` is a 400.

### Accents (explicitly scoped OUT of the provider work)

Grok has no accent control. OpenAI's free-text instructions can request an accent, but the owner
found that delivery flat and it did not meet the feel bar.

### Batch consecutive same-speaker lines into ONE request (owner, 2026-07-14)

**Why this is here.** The plan review found that `/api/audio/narrate` allows 20 requests/minute
(`server.js:728`) while a turn can carry up to 40 voice lines (`rpg-state.js:292` caps at 40), and
that the first failure aborts every remaining line (`public/app.js:1541-1548` throws out of the
loop). The first draft's answer was a failure policy — a band-aid. The owner asked the better
question: **"why does 40 lines need to be 40 requests?"** It does not.

Today `public/app.js:1519-1548` is a serial loop issuing **one POST per line**. Two reasons, only
one of which still holds:
1. **Each line may use a different voice** (narrator vs a given NPC). Real, and it survives.
2. **Audio begins after the first line** instead of waiting for the whole turn to synthesize. A
   genuine latency win; keep it.

Neither forces one request *per line*. **Coalesce consecutive lines that share a speaker into a
single request when `/api/audio/capabilities` reports `maxSegmentsPerRequest > 1`.** A turn is a
handful of speaker *runs*, not 40 alternations. `public/voice-narration.js` owns this pure grouping
and queue policy so Node tests can execute the exact code the browser uses.

**Grok's inline tags are what make this possible, and OpenAI's design is what prevented it.**
OpenAI steers via the `instructions` **request field**, so merging four lines flattens them to one
delivery and loses per-line tone. Grok steers **inside the text**, so a merged run keeps per-line
delivery:

```
[tense] The door gives way. [whispers] Something far below stops moving to listen.
```

The client sends that run as `segments`, **not** as pre-tagged text and not as one scalar tone. The
server validates every enum tone, neutralizes bracket syntax in every text segment, composes each
tag, and only then concatenates the upstream Grok input. One request, one voice, per-line delivery
preserved. Grok's text limit is 15,000 characters, which is also the route's aggregate request cap.

**Consequences, including the one that cuts against it:**
- A 40-line Grok turn becomes roughly 5–8 requests. OpenAI remains at up to 40 requests because it
  cannot preserve per-line instructions inside one call. Replace the 20/minute route cap with a
  240/minute HTTP abuse cap; cached hits count against that cap, but not against provider calls.
- **Failure granularity becomes COARSER**: a failed request now loses a whole *run*, not one line.
  The owner's failure policy (below) therefore applies per **run**. State this plainly; do not sell
  the batching as free.
- **Batching applies to the Grok path only.** OpenAI keeps one request per line, because its
  per-request `instructions` cannot carry per-line tone. Do not "unify" the two paths by degrading
  OpenAI's steering.
- Time-to-first-audio is bounded by the first *run* rather than the first *line*. Runs are short at
  the start of a scene; accept it, and measure it in the playtest rather than assuming.

**Failure policy (owner, 2026-07-14): skip and keep going.** A failed run is dropped and narration
continues with the next one — "a GM who stumbles on a word keeps talking." This replaces the current
behaviour, where the first failure throws out of the loop and **silently kills every remaining
line**. Do not retry into a rate limit. Surface a single non-blocking notice, not one per failure
(`voiceErrorShown` at `app.js:1549-1555` already debounces this).

### Synthesize once, serve every player (owner, 2026-07-14)

The narrator is campaign-canonical. That identity rule is incomplete if every browser independently
pays the provider to synthesize identical bytes. `/api/audio/narrate` therefore deduplicates both
concurrent and recently completed canonical requests:

- Resolve and sanitize the request first. Hash a canonical object containing campaign id, active
  provider, effective model (OpenAI only), resolved voice, and the final server-composed upstream
  instructions/text. Never include or store an API key in the cache key.
- One in-flight Promise per key collapses simultaneous host/seat requests to one provider call.
  Successful MP3 buffers enter a 10-minute, access-ordered cache capped at 64 entries **and** 64 MiB;
  evict oldest entries until both bounds hold. Failures are never cached, and the in-flight entry is
  removed in `finally` so a failed synthesis can be attempted later.
- Campaign id is part of the key even when text matches, preventing cross-campaign reuse. Every
  explicit preview request uses a distinct `preview` scope.
- The 60/minute synthesis-miss limiter is applied **after** cache lookup; cached host/seat playback
  does not consume it. The separate 240/minute route cap still bounds abusive cache hits.

This is an in-memory cost/coordination cache, not durable game state. Restarting the server clears it.

### Success metrics

- `AI_RETRY_BACKOFF_MS=10 node test.js` green, including a **provider endpoint pin** for
  `api.x.ai/v1/tts` (the suite already pins provider endpoints — `test.js:814` pins OpenAI's) and an
  assertion that **the xAI key is never sent to `api.openai.com` and vice versa** (the key-leak
  class already fixed once for the Grok text path).
- **NON-VACUOUS ROUTE TESTS** *(r1: the proposed endpoint/key tests would not have guarded the actual
  blocker — a unit-correct `synthesizeGrok` can happily coexist with a route at `server.js:735/761`
  that still substitutes `'marin'`, and every unit test would pass while every line 404s)*. Test the
  **route**, for **host and seat**: a Grok narrator voice survives; a seeded NPC resolves to its Grok
  pool voice; a legacy OpenAI-profile NPC switched to Grok and **back** keeps a stable voice; an
  invalid voice is rejected/defaulted rather than forwarded.
- **Campaign identity contract:** a campaign request from a host without `campaignId` is 400; a valid
  host campaign resolves its NPC; a seat body that spoofs another `campaignId` is ignored and still
  resolves only `req.auth.campaignId`. Explicit `preview: true` with no id uses the reserved narrator;
  preview plus id/speaker is 400; malformed id is 400; well-formed unknown campaign is 404.
- **Batching and failure guards execute the browser's production helper:** Grok groups only adjacent
  same-speaker lines and preserves each segment's tone; OpenAI emits one request per line; removing
  grouping makes the Grok guard fail. A first-run fetch failure still attempts and plays the second
  run and reports one debounced error; restoring throw-on-first-failure makes the guard fail.
- **Capabilities fail closed:** error, timeout, and malformed response reduce the client to one
  segment per request. In a Grok→OpenAI race, a batched request carrying stale `expectedProvider`
  receives 409 with zero provider calls; the client re-fetches/rebuilds once, and a failed re-fetch
  rebuilds the remaining queue as singletons. A second provider mismatch in the same turn also
  rebuilds as singletons without another fetch, so repeated flips cannot loop. The server separately
  returns 400 with zero provider calls when the request exceeds the matching provider's maximum.
- **Bracket oracle:** the pinned hostile fixture becomes exactly
  `The guard says now. A stray remains.` before server enum tags are added; asserting only "no
  brackets" is insufficient because an implementation that speaks the hostile interior would pass.
- **Shared-cost guard:** simultaneous host + seat requests for the same canonical narration cause
  exactly one mocked provider call; a later request hits completed cache; different campaign,
  provider, voice, tone, or text misses; failures do not poison the cache. Removing either in-flight
  or completed deduplication makes its corresponding assertion fail.
- **Legacy/config guards:** a flat stored `voiceApiKey` is usable only as OpenAI, survives a no-op
  admin save into `voiceApiKeys.openai`, and is never selected for Grok. Legacy NPC seeds are the
  zero-based campaign ordinal even when global ids contain gaps. Import/export preserves a numeric
  `voiceSeed`; strings/negative/non-finite values become `null`, and invalid mood becomes `neutral`.
- **Seat boundary re-tested — AND THE AUDIO BOUNDARY, NOT JUST THE PAYLOAD** *(r1, and this is the
  subtle one)*. `.agents/state.md` requires a seat re-test whenever a field enters a seat payload.
  But scanning the JSON for `mood` proves only that it was not *serialized* — **the mood is spoken
  aloud**, so an unconstrained descriptor reaches the seat player's ears while the payload scan stays
  green. Two requirements: (a) `mood` comes only from the **public server-owned enum**, never from
  private NPC personality text; (b) the seat test exercises the **`/api/audio/narrate` boundary**,
  asserting the text sent upstream carries no private NPC direction — not merely that
  `scopeVoiceLinesForSeat` omitted a field.
- **Playtest gate (feel).** A real session with voice on. The GM sounds distinct from the NPCs; NPCs
  sound distinct from each other and are *sticky* across turns; a character's habitual mood is
  audible; per-line tone visibly varies delivery (the whisper/tense/joy distinction the owner
  confirmed by ear). The phase is not complete until the owner confirms it is better in play, not
  merely different.
- Switching provider back to OpenAI in `/admin` still works, and existing campaigns' NPCs keep
  working voices under both providers (this is what step 3 buys).

### Files to change

*(r1: the original list omitted `public/app.js`, `server-config.js`, `rpg-engine.js`, and
`public/index.html` — four files without which the design does not function at all.)*

- `tts-providers.js` — per-provider registries (incl. the pinned ordered Grok 26); `voiceSeed`;
  `validateVoiceProfile(raw, provider)`; the mood **enum**; `synthesizeGrok`; tag rendering; register
  `grok`
- `server.js` — the `:735`/`:761` provider-aware voice gates; **server-side profile resolution for
  the HOST** as well as the seat; bracket-neutralisation of spoken text (`:124-132`); the raised
  rate limits; canonical request/cache integration; `GET /api/audio/capabilities` and
  `GET /api/admin/voice-catalog`
- `tts-cache.js` — bounded in-flight + completed synthesis deduplication, isolated for mutation tests
- `server-config.js` — **per-provider** voice key storage/resolution/masking (`:85-87` today resolves
  one generic key and falls back to `OPENAI_API_KEY`)
- `public/app.js` — send campaign + speaker + structured segments for both modes; stop composing
  `instructions`; fetch capabilities per narration; use the shared queue helper; remove player voice
  and direction settings
- `public/voice-narration.js` — browser-safe pure grouping and dependency-injected skip-and-continue
  queue policy, imported by both `app.js` and `test.js`
- `public/index.html` — remove the narrator voice selector and free-text Voice Direction; keep the
  enable toggle and canonical preview
- `rpg-engine.js` — assign a **narrator profile at campaign creation**; **copy `voice_json` on fork**
  (`:2634`)
- `rpg-prompts.js` — NPC `voice_mood` and per-line `tone`, both constrained to the exact enum
- `rpg-state.js` — validate both enum fields; add `voiceSeed` + `mood` to the import whitelist
  (`:1037`)
- `admin/` — voice provider selection, per-provider key fields, provider-aware voice list
- `test.js` — provider registries, endpoint pin, key isolation, **non-vacuous host+seat route tests**,
  the audio-boundary seat guard, fork/import round-trip, legacy ordinal/key migration, production
  browser-helper queue guards, and both cache discriminators
- `.agents/decisions.md`, `plan.md` — already recorded

### Process

Code, so it goes through `.agents/playbooks/reviewloop.md`, and **this plan is independently
review-accepted before implementation begins**. The active role decision is codex implements and an
independent Claude or Grok harness adversarially reviews; codex cannot review its own code.

The phase lands as four owner-gated reviewloop slices. Do not stack the next slice on an unmerged
branch: each branch starts from updated `master`, carries one observable failure claim, proves its
guard red→green, receives a pinned external verdict, then stops for the owner's merge go.

Until v-3 lands, v-1 and v-2 must keep the existing `/api/audio/narrate` request/response contract
and the current OpenAI route operational. Provider-aware route replacement and the minimum client
cutover happen together in v-3; neither earlier slice may strand master between contracts.

1. `v-1` — provider registry, Grok request contract, per-provider key/config compatibility and admin
   storage. Observable failure: Grok cannot synthesize and a flat key can cross providers today.
2. `v-2` — finite delivery schema plus portable NPC/narrator profiles across create, legacy read,
   fork, export, and import. Observable failure: current profiles are OpenAI-only and narrator state
   is absent/lost.
3. `v-3` — canonical host/seat audio route, capabilities/admin catalog, key isolation, bracket
   neutralization, MP3 validation, shared synthesis cache, **and the minimum client cutover**:
   `public/app.js` sends `campaignId` plus a one-element `segments` array for every campaign line and
   uses explicit `preview: true` for preview. It may leave the old controls visible/inert until v-4,
   but merged master must narrate correctly through the new-only route. Observable failure: host
   resolution collapses, Grok voices 404, and identical listeners currently multiply upstream calls.
4. `v-4` — player-control removal, provider-aware Grok batching, OpenAI single-line path,
   skip-and-continue queue, preview, README. Observable failure: the current browser aborts after one
   error, cannot express multi-tone runs, and lets each player override the GM identity.

After all four merges, run the complete suite and the owner playtest gate. Do not mark Phase V
complete merely because the code and reviewloop are green.

---

## Phase CT: Theme colour format — LANDED at `77cba10`

Not a feel phase: the change is **intended to be visually invisible**. It is a correctness phase that
removes a defect *class*, and it deletes ~400 lines of test code rather than adding any. No playtest
gate.

> **"Pixel-identical" is an INTENT, not a gate** *(cold review: the word implied a rigour the repo's
> checks could not deliver at planning time — there was no browser harness, no baseline screenshots,
> and no pass/fail criterion, so a cold agent could not establish pixel identity and would either
> fake the claim or stall)*. The **actual gate** is: (a) the pinned 25-entry alpha table asserted in `node test.js`;
> (b) the definition/writer grammar asserted in `node test.js`; (c) zero surviving
> `hsl(var(--theme-`/`hsla(var(--theme-` in runtime sources; and (d) a **human sanity pass** —
> every surface still paints, across the five themes and the holodeck idle. (d) is a smoke check, not
> a proof, and is described as such. (a)–(c) are the proof, and they need no browser.

### Problem

The `--theme-*` custom properties store **bare HSL component lists** (`--theme-panel: 220, 25%,
12%;`). A component list is only meaningful inside `hsl()`/`hsla()`. Substituted anywhere else —
notably `rgb()`/`rgba()` — the declaration is invalid, the browser **drops it at parse time**, and
the surface renders unpainted with no error. That shipped as finding **css-1** (fixed and merged
at `41e1938`).

Finding **css-2** then tried to prevent recurrence with a static scanner in `test.js` that reads
the source files and fails the suite on any `rgb()`/`rgba()` consuming a theme var. It does not
work and cannot be made to work cheaply: across three review rounds the reviewer defeated it 1,
then 5, then **16** times (`.agents/review/findings/css-2.md`). By r3 the scanner was wrong in
both directions — it **crashed the suite** on an out-of-range character reference, and it
**rejected valid CSS**. Reviewer and coder independently concluded the approach is **not
converging**: it had become a partial re-implementation of an HTML parser, a CSS tokenizer, the
cascade, and a JS-output interpreter. Owner ruling 2026-07-14: go to the root fix.

**Remove the cause instead of instrumenting it** — the same principle already applied at T2 r6→r7.

### What the migration actually buys (r1 correction — the earlier claim was FALSE)

The first draft of this plan claimed a complete-colour format makes consumer mistakes
**impossible**. **That is wrong, and the plan review was right to reject it.** `rgba(var(--theme-panel), .7)`
is *still* invalid once the variable expands to `hsl(…)` — `rgba()` takes numbers, not a colour —
so the declaration is still dropped and the surface still renders unpainted. A definition-site
guard cannot prevent someone typing that.

State the benefit correctly, because it is still large and it is the whole justification:

- **Today the format sets a trap.** `hsla(var(--theme-panel), 0.7)` is **valid** and
  `rgba(var(--theme-panel), 0.7)` is **invalid**, and the two are visually near-identical. The
  correct form is indistinguishable at a glance from the broken one, and the broken one is a
  *natural* thing to reach for. That is why css-1 shipped, and why the aliasing/encoding arms race
  in css-2 seemed worth fighting — the mistake was easy to make by accident.
- **After the migration there is no trap and no near-identical valid twin.** The only correct
  usages are `var(--theme-panel)` and `color-mix(…)`. `hsla(var(--theme-panel), .7)` **also stops
  working**, so there is no longer a valid sibling to confuse with the broken one. Nobody reaches
  for `rgba()` around a value that is already a colour.

So the migration converts a *trap* into an ordinary *typo*. The residual risk is a plain typo, and
a plain typo is caught by a plain regex — see the guard in **step 9**. **The guard is a typo lint, not
a proof, and it must never again be escalated into a parser.** css-2 established, over three
rounds and 16 defeats, that a text scanner cannot police encoded CSS. It does not need to: an
encoded offender is not an accident, and the threat model here is a developer slip, not a
committer hiding CSS from the linter.

### What does NOT change: the internal component format

The component-list format is load-bearing and stays exactly as it is:

- `rpg-state.js:1449-1457` **clamps components** (`normalizeHslColor`, `clampHslLightness` — the
  background is forced dark, text forced readable) so a generated theme cannot come back
  unreadable. Clamping needs components.
- `rpg-prompts.js:19-24` asks the model for components. Models produce this reliably.
- Components are persisted **inside `campaign_outlines.outline_json`** (revalidated at
  `rpg-engine.js:1933-1935`, emitted at :1983). *(r1 correction: the earlier draft named a
  `campaigns.theme_colors` column. **No such column exists.**)*
- **There is NO database migration, NO prompt change, and NO validator change.** The plan review
  independently verified this conclusion against the code.

*(r1 correction: the earlier draft called components "upstream-only". They are not.
`rpg-state.js:79-101` `createFallbackSvg` is a legitimate **downstream** consumer — it interpolates
a triple into `hsl(${…})` in a generated SVG string. That path consumes the **internal triple**, not
the CSS custom property, so it keeps working untouched. Preserve it.)*

**Only the value written into the CSS custom property changes.** That is what keeps the phase small.

### Known limit of the invariant (r1, stated rather than papered over)

The invariant is "**app-owned CSS** never puts a bare component list into a CSS context." It does
**not** extend to model-authored or imported content: the engine asks the model for an
`svg_illustration` (`rpg-prompts.js:221`), accepts it (`rpg-state.js:253-255`), accepts imported SVG
(`rpg-state.js:1229-1230`), and injects it (`public/app.js:1037-1039`). Arbitrary SVG could contain
`hsl(var(--theme-primary))`, which after this migration becomes `hsl(hsl(…))` and is dropped.
Model SVG uses literal colours in practice, so this is a latent, not live, defect — but the plan
claims no invariant over it, and does not pretend to. If it ever matters it is a separate finding,
not silent scope creep.

### Design

**Do not drive any step from a COUNT.** Enumerate the sites and transform each one. The r1 review
found the counts themselves were wrong (below); a count-driven sweep leaves survivors.

> **STEP ORDER MATTERS — DELETE THE OLD SCANNER FIRST.** *(Cold review, ordering hazard.)* Steps 1–3
> invalidate the existing css-1/css-2 scanner's production anchors (`test.js:1567-1580`), so if you
> migrate the CSS **before** removing the scanner, **the suite goes red for entirely expected reasons**
> and a cold implementer will reasonably think they have broken something and start "fixing" it.
> Do step 9's deletion **first** in the working tree. The whole phase still lands as ONE commit.

1. **`public/styles.css` — definitions: 48 total, of which 6 are `--theme-glow` (deleted in step 4),
   leaving 42 to convert.** *(r1 correction: the earlier draft said "48 become complete colours".)*
   Blocks: `:root` (:6), `.theme-cyberpunk` (:29), `.theme-fantasy` (:40), `.theme-horror` (:51),
   `.theme-scifi` (:62), `body.holodeck-idle` (:1190). Each becomes a complete colour in ONE
   canonical form, because the guard in step 8 validates that exact grammar:
   `--theme-panel: 220, 25%, 12%;` → `--theme-panel: hsl(220 25% 12%);`

2. **`public/styles.css` — opaque consumers (132).** `hsl(var(--theme-x))` → `var(--theme-x)`.
   *(Cold review asks for a checklist here. It is not needed, and this is the reason: unlike the
   alpha rewrite — where a wrong percentage is silently valid — the opaque rewrite is **exhaustively
   self-verifying**. The end-state assertion is "**zero** `hsl(var(--theme-` remain in the file", so
   a missed site cannot hide. Sweep them, then assert zero. That IS the enumeration.)*

3. **`public/styles.css` — translucent consumers: THE EXACT 25-ENTRY TABLE.** *(r2: the previous
   draft only promised this table and gave a compressed line list, so a wrong rewrite could be
   checked against itself. Here it is, extracted from the file — this IS the checklist, and it is
   pinned as test data in step 9.)*

   `hsla(var(--X), α)` → `color-mix(in srgb, var(--X) <α×100>%, transparent)`

   | line | variable | α | → |
   |------|----------|------|-----|
   | 99   | `--theme-primary`   | 0.05 | 5%  |
   | 100  | `--theme-secondary` | 0.03 | 3%  |
   | 126  | `--theme-panel`     | 0.7  | 70% |
   | 174  | `--theme-panel`     | 0.45 | 45% |
   | 202  | `--theme-primary`   | 0.3  | 30% |
   | 206  | `--theme-primary`   | 0.5  | 50% |
   | 262  | `--theme-panel`     | 0.35 | 35% |
   | 307  | `--theme-primary`   | 0.15 | 15% |
   | 308  | `--theme-primary`   | 0.3  | 30% |
   | 359  | `--theme-panel`     | 0.2  | 20% |
   | 381  | `--theme-primary`   | 0.1  | 10% |
   | 382  | `--theme-primary`   | 0.25 | 25% |
   | 385  | `--theme-primary`   | 0.05 | 5%  |
   | 468  | `--theme-secondary` | 0.08 | 8%  |
   | 469  | `--theme-secondary` | 0.3  | 30% |
   | 496  | `--theme-panel`     | 0.8  | 80% |
   | 528  | `--theme-primary`   | 0.08 | 8%  |
   | 552  | `--theme-primary`   | 0.2  | 20% |
   | 732  | `--theme-primary`   | 0.25 | 25% |
   | 876  | `--theme-primary`   | 0.1  | 10% |
   | 1075 | `--theme-primary`   | 0.6  | 60% |
   | 1389 | `--theme-primary`   | 0.15 | 15% |
   | 1389 | `--theme-secondary` | 0.15 | 15% |
   | 1391 | `--theme-primary`   | 0.3  | 30% |
   | 1617 | `--theme-primary`   | 0.6  | 60% |

   (Line 1389 carries **two** — do not drive this from a line count either.)

   The r1 review independently verified all 25 compute identical sRGB channels and alpha under
   `color-mix`, **with no semantic exception** for gradients, `backdrop-filter` surfaces, borders, or
   box/text/drop shadows. That holds only while the source colour is **opaque** — which step 9's
   grammar enforces (an alpha-bearing source silently halves: a 50%-alpha colour mixed at 45%
   renders at 22.5%).

4. **`--theme-glow` is DELETED here** (6 definitions + the writer at `public/app.js:1610` + its
   `THEME_VAR_NAMES` entry at :1579). It is dead — defined and written, read nowhere (finding
   **css-3**). *(r1 correction: the earlier draft justified this by claiming a quadruple "has no
   complete-colour form". **False** — `hsl(H S L / A)` is exactly that. **Deadness alone** justifies
   the deletion. The correction matters because that same alpha syntax is what a pre-baked fallback
   would need.)* Supersedes the standalone css-3 branch plan.

5. **`public/app.js` — the theme WRITER. Extract a PURE, TESTABLE seam first.**

   *(Cold-implementer review named this the single most risk-reducing addition, and it closes three
   findings at once: the writer is otherwise untestable — `public/app.js` is a browser module with
   top-level DOM/window dependencies and `package.json` has no DOM test library, so "unit-test the
   writer's output" was unimplementable as written; and enumerating the properties in one place is
   what stops the `text`/`text_dim` omission below.)*

   **New module `public/theme-vars.js`** — pure functions, no DOM, importable by both `public/app.js`
   and `test.js`:

   ```js
   export function toThemeColor(components)   // '220, 25%, 12%' -> 'hsl(220, 25%, 12%)'
   export function derivePanelBorder(background)  // -> { '--theme-panel': …, '--theme-border': … }
   export function fullThemeVars(colors)      // the body-level map (generated themes)
   export function baseThemeVars(primary, secondary, background)  // the root-level map (legacy)
   ```

   `applyCampaignTheme` then just *applies* the returned map. `test.js` imports the same functions
   and asserts their **actual output strings** against the grammar in step 9 — no DOM, no mock, no
   AI credentials.

   **⚠ `--theme-text` and `--theme-text-dim` MUST be converted** (`app.js:1608-1609`). *(This is the
   cold review's "most likely way a diligent implementer still ships a broken surface". The earlier
   draft's examples covered `primary` and the derived `panel`/`border` and silently omitted these
   two. Convert the consumers to `var(--theme-text*)` while leaving the writer emitting bare
   components, and every generated-theme text declaration becomes invalid — **blanking most of the
   readable UI**.)*

   The two paths, in full:
   - **Full generated theme** (`:1603-1618`, body level, taken when `colors.text` is a string):
     `--theme-primary`, `--theme-secondary`, `--theme-bg`, **`--theme-text`**, **`--theme-text-dim`**,
     and the derived `--theme-panel` / `--theme-border` from `bgParts`. (`--theme-glow` is deleted.)
   - **Legacy** (`:1621-1631`, `documentElement` level, taken when `colors.text` is absent):
     `--theme-primary`, `--theme-secondary`, `--theme-bg`, and derived `--theme-panel` /
     `--theme-border`. It does **not** set text vars at all — those come from the preset class or
     `:root`. Do not "helpfully" add them; that would change behaviour.

6. **`public/app.js` — the three LIVE CONSUMERS the first draft MISSED** *(r1; this was the plan's
   worst omission — it scoped app.js as "just the writer")*. These build inline styles and would
   become invalid `hsl(hsl(…))`:
   - `:1688` — `actCard.style.borderLeft = '2px solid hsl(var(--theme-primary))'` → active-act
     border disappears.
   - `:1713` — empty-Inventory placeholder, `color: hsl(var(--theme-text-dim))`.
   - `:1780` — empty-Codex placeholder, same.
   Each becomes `var(--theme-x)`.

7. **`public/index.html` — inline styles (:215, :409, :416)** *(r1; the first draft scoped this file
   out entirely)*. `hsl(var(--theme-border))` → `var(--theme-border)`: Journal search-bar border,
   the access-token divider, and the Settings divider.

8. **`map-render.js` — TEN substitutions, not nine** *(r1 correction: `:67` carries **both** a panel
   `fill` **and** a border `stroke`)*. Sites: `:30, :31, :46, :63, :67 (×2), :68, :81, :94, :99`.
   `hsl(var(--theme-primary, 210, 100%, 55%))` → `var(--theme-primary, hsl(210 100% 55%))` — the
   fallback must itself become a complete colour. (The SVG is injected via `innerHTML`, so it
   inherits the document's custom properties.)

9. **`test.js` — DELETE the scanner.**

   > **⚠ The deletion list below is for the CSS-1 SCANNER, which is what exists on the base.**
   > *(Cold review r2: the previous list named `blankHtmlComments`, `mapOutsideRawText`,
   > `decodeHtmlEntities`, `prepareHtml`, `HTML_NAMED_ENTITIES`, `mergeAliasMaps` and
   > `themeConsumerTargets` — **none of which exist on the base**. They were added on
   > `fix/css-2-scanner-scope`, which is **abandoned and must never be checked out**. A cold
   > implementer would have gone hunting for them and could have wandered onto the forbidden branch
   > to find them. If a symbol below is missing, you are on the wrong base — STOP, do not go looking
   > for it on another branch.)*

   Remove `testThemeVarConsumers` (`test.js:1423`) and the six helpers it owns — `blankCssComments`,
   `extractCssVarNames`, `findMatchingParen`, `collectVarAliases`, `resolvesToThemeTriple`,
   `findInvalidThemeRgbConsumers` — plus its `runAll` registration and the now-unused `fs`/`path`/
   `fileURLToPath` imports if nothing else needs them.

   Replace it with **two small checks**. Neither is a parser, and neither may ever grow into one.

   **(a) Opaque-colour grammar — ONE grammar, applied to BOTH the stylesheet and the writer.**
   *(r1: a "starts with `hsl(`/`rgb(`/`#`/`color(`" test is worthless — `hsl(220 25%)`, `#12` and
   `color(nonsense)` all pass, and so does an **alpha-bearing** colour, which silently halves every
   `color-mix` consumer.)*
   *(**r2 — a real bug in the previous draft.** It specified a space-separated grammar,
   `/^hsl\(\d{1,3} \d{1,3}% \d{1,3}%\)$/`. But `normalizeHslColor` (`rpg-state.js:109-118`) returns
   **comma-separated** components — `"210, 100%, 50%"` — so the runtime writer emits
   `hsl(210, 100%, 50%)`, which is **perfectly valid CSS that my own grammar would have REJECTED**.
   The guard would have failed against the app's own generated themes.)*

   The grammar therefore accepts **either whole form**, and **no alpha**. *(r3: the previous
   revision chose each separator **independently**, so it accepted the **mixed** form
   `hsl(210, 100% 50%)` — which is **invalid CSS**. It would have passed the guard and broken every
   consuming declaration. `\s` also admits whitespace CSS does not.)* Alternate the two **whole**
   forms, and match ASCII space explicitly:

   ```
   /^hsl\((?:\d{1,3}, ?\d{1,3}%, ?\d{1,3}%|\d{1,3} \d{1,3}% \d{1,3}%)\)$/
   ```
   — comma-separated (what the runtime writer emits, via `normalizeHslColor`) **or**
   space-separated (what the stylesheet uses). Never a mixture, never an alpha component.
   - Applied to all **42** `--theme-*` definitions in `public/styles.css` (which use the canonical
     space form).
   - Applied to the **writer's output**: unit-test `applyCampaignTheme`'s produced value strings —
     **both** paths (`app.js:1603-1618` and the legacy root writer `:1621-1631`) — against the same
     grammar. Do not merely assert the code is `hsl(...)`-wrapped; assert the **string it actually
     produces** matches. That is what would have caught this.

   **(b) Consumer typo lint — deliberately dumb, explicitly not a proof.**
   A **case-insensitive** regex *(r2: CSS function names are case-insensitive; `RGBA(` is legal and
   a lowercase-only lint misses it)* over the four app-owned runtime files (`public/styles.css`,
   `public/index.html`, `public/app.js`, `map-render.js`) asserting that no
   `rgb(`/`rgba(`/`hsl(`/`hsla(` **immediately wraps** `var(--theme-…)`. After the migration every
   such form is invalid, so this is a clean signal with no false positives.

   > **SCOPE OF THIS LINT, STATED HONESTLY** *(r2)*. It catches the **direct spelling** and nothing
   > more. It does **not** catch ordinary indirection — an intermediate custom property, or a style
   > string composed in JavaScript — and it does not catch encoded CSS. **That residual risk is
   > ACCEPTED, deliberately**, and it is small precisely because the migration removed the trap: with
   > whole colours there is no reason to wrap a theme variable in a colour function at all, so the
   > direct spelling is the only slip anyone plausibly makes.
   >
   > **Do not "harden" this into a parser.** css-2 spent three review rounds and 16 defeats proving a
   > text scanner cannot police CSS, and this entire phase exists because that was the wrong fight.
   > If a future round demonstrates a way past this regex, the correct response is to **shrug** — an
   > encoded or aliased offender is not an accident. Anyone tempted otherwise: read
   > `.agents/review/findings/css-2.md` before touching this.

### Success metrics

- `AI_RETRY_BACKOFF_MS=10 node test.js` green.
- **Scoped** grep — `hsla?\(\s*var\(\s*--theme-` and `rgba?\(\s*var\(\s*--theme-` return zero over
  **runtime sources only** (`public/styles.css`, `public/index.html`, `public/app.js`,
  `map-render.js`). *(r1: a repo-wide grep can never reach zero — tracked docs quote these forms as
  examples, e.g. this very plan and `.agents/review/findings/css-1.md:29`.)*
- The scanner and its helpers are gone from `test.js` (net line count **down**).
- **The 25-entry table above is PINNED AS TEST DATA and asserted in `node test.js`** — this is the
  primary defence against a mis-mapped alpha, and it needs **no browser**.
  *(r2 fixes two errors here. First, the previous draft called for a `getComputedStyle` diff — but
  **at Phase CT review time this repo had no browser harness** (T2 r6→r7 explicitly declined to
  build one; bh-1 landed later), so that gate was then unimplementable, exactly the trap T2's r5-3
  finding named. Second,
  even with a browser it would not work: correct `color-mix(in srgb, …)` results **serialize
  differently** from legacy `hsla` inside gradients even when the resolved RGBA is identical, so
  every correct rewrite would "differ" and the resulting blanket waivers would hide the one real
  mis-map.)*
  The check that actually catches the risk is a pure text assertion, in Node, with no rendering
  involved: parse `public/styles.css`, extract every `color-mix(in srgb, var(--theme-*) N%,
  transparent)`, and assert the result equals the pinned table exactly
  — same 25 entries, same variables, same percentages, no more and no fewer. A transposed or dropped
  alpha fails loudly.

  > **DO NOT KEY THE ASSERTIONS BY LINE NUMBER.** *(r3 — keyed by line, this test would have failed
  > a **CORRECT** migration.)* The table's line numbers are **pre-migration**. Deleting the six
  > `--theme-glow` definitions (`:18, :37, :48, :59, :70, :1198`) **shifts every entry below them** —
  > the first 21 by five lines, the last four by six. A correct rewrite would go red unless someone
  > left blank lines behind to preserve numbering, which is absurd. The line numbers in the table are
  > a **human navigation aid only — never the assertion key.**
  >
  > **THE IDENTITY SCHEME IS MANDATORY AND SINGULAR: ORDERED OCCURRENCE.** *(Cold review r2: offering
  > "tuple **or** ordered occurrence" was an invitation to invent. Worse, the tuple reading is
  > **unimplementable from this plan** — the table carries no selectors or properties, so a tuple
  > implementation would have to re-derive its "independent" expectation **from the stylesheet it is
  > checking**, which is precisely the self-check the plan forbids.)*
  >
  > Scan `public/styles.css` **top to bottom**, collect every
  > `color-mix(in srgb, var(--theme-X) N%, transparent)` **in source order**, and assert the resulting
  > list of `(variable, percentage)` pairs **equals the 25-row table above, in that exact order**.
  > Order is stable under the glow deletion (deleting definitions does not reorder consumers), it
  > needs no selector data, and a transposition, omission, or duplication all fail. Note row 22/23
  > (both at old line 1389) — two entries, adjacent, in that order.

  **A rewrite cannot be checked against itself, because the table is the
  independently-extracted expectation and it is written down above.**
- Beyond that, the visual pass below is a *sanity* check, not the proof. Stateful surfaces
  (hover/focus, animation, tabs, scene cards, the die glow at `styles.css:1075`) are covered by the
  table, since a `color-mix` percentage is correct or it is not regardless of when it renders.
- **Visual check across all five themes** (`.theme-cyberpunk`, `.theme-fantasy`, `.theme-horror`,
  `.theme-scifi`, `:root`) plus `body.holodeck-idle`, covering the surfaces css-1 broke **and** the
  six newly-scoped consumers (`app.js:1688/1713/1780`, `index.html:215/409/416`).
- **BOTH writer paths exercised**, not just one *(r1)*: a generated (AI) full-theme campaign
  (the body-level writer, `app.js:1603-1618`) **and** a legacy component-only campaign (the root
  writer, `:1621-1631`).
- **The map is tested with the variables ABSENT**, not merely observed looking themed *(r1: an
  injected map always inherits `:root`, so a broken fallback is invisible in normal rendering)* —
  assert the emitted SVG source directly, or render it with the custom properties unset.

### Risks

- **`color-mix()` support is a COMPATIBILITY DECISION, not a local spike** *(r1: a single Tauri
  check on one machine proves nothing about the canonical browser path, and
  `desktop/src-tauri/src/main.rs:59-61` shows WebKitGTK is Linux-specific — the macOS shell is
  WKWebView. An unsupported engine discards **all 25** declarations, including the entire midpoint
  filter at `styles.css:1075`.)*
  Therefore: **declare supported engine minimums, grounded in authoritative compatibility data, and
  be honest that local runs are smoke tests rather than a matrix.** *(r2: "test that matrix" was a
  bluff — running a current Chromium, a current Firefox and whichever Tauri port happens to be on
  the implementing machine exercises **none** of the declared floors, and exercises only one of
  WKWebView / WebKitGTK. Do not claim coverage that is not being produced.)*
  `color-mix()` baseline support: **Chrome/Edge 111** (Mar 2023), **Firefox 113** (May 2023),
  **Safari/WebKit 16.2** (Dec **2022**). *(r2 correction: the earlier draft said "all 2023" — false
  for the WebKit floor.)* Cite **MDN's `color-mix()` browser-compatibility table** in `README.md` for
  those three.

  > **DO NOT cite MDN for a WebKitGTK version floor** *(cold review r2: MDN publishes no WebKitGTK
  > row, so the previously-required citation was impossible to satisfy)*. State the Tauri/Linux
  > position honestly instead: the shell renders in WebKitGTK, `color-mix` shipped in WebKit well
  > before the versions any current WebKitGTK ships, and **the shell is verified by running it**, not
  > by citation. If it renders correctly in the shell on the implementing machine, record that as the
  > observation it is.

  > **THE BROWSER MATRIX IS NOT A GATE — IT IS A SMOKE CHECK, AND IT MAY BE REPORTED UNRUN.**
  > *(Cold review r2: `package.json` has no browser dependency or smoke script, and the implementing
  > machine may have no Chromium or Firefox at all. Installing browsers is an unexplained external
  > mutation, and demanding it as a gate leaves a cold agent stuck or lying.)* Run whichever engines
  > are actually present and **explicitly record which engines were NOT exercised**. Per AGENTS.md,
  > "state clearly that it was
  > not run" is an acceptable outcome; a fabricated matrix is not.
- **If a target engine fails, the pre-baked fallback is a SEPARATE, SEPARATELY-REVIEWED SLICE — not
  a sentence in this plan** *(r1)*. It is not "more variables": it is **18 distinct
  primary/secondary/panel alpha levels × 6 theme blocks ≈ 108 definitions**, plus writes on **both**
  `app.js` writer paths (:1603-1618 and :1621-1631) and `THEME_VAR_NAMES` upkeep — and if any of
  that is missed, generated themes silently inherit stale or default translucent colours. Do not
  attempt it as an afterthought inside this phase.
- Mis-mapping a single alpha (`0.45` → `45%`) silently changes one surface's translucency. **The
  pinned 25-entry table, asserted in `node test.js`, is what catches it** — not eyeballing.
  *(r3: this line previously also demanded "the computed-style diff", which the Success metrics
  section correctly **withdrew** as unimplementable at CT review time, when no browser harness
  existed, leaving a cold implementer with two contradictory gates. There is exactly ONE gate for
  this risk: the table.)*

### Documentation that teaches the SUPERSEDED contract (must be fixed, r1)

Leaving these in place instructs a future cold agent to restore the abandoned behaviour:

- `rpg-state.js:1443-1445` — the comment claims triples exist "so the CSS `hsl(var())`/`rgba(var())`
  composition never breaks." That is **false for `rgba` today** (it *is* the css-1 bug, written down
  as a guarantee) and wholly obsolete after this phase. Rewrite it to state the real reason
  components are kept: **clamping**.
- **plan.md Phase T2 — FOUR clauses.** *(r2 found the dangerous one; r3 found a fourth that my
  "exhaustive" sweep had missed. Take the hint: grep T2 for `hsla`, `rgba`, `scanner`, and `glow`
  rather than trusting this list to be complete.)*
  1. **`:296-300` — the dangerous one.** T2's approved text instructs that "every such use
     **migrates to `hsla(var(--theme-*), α)`**". After CT that form is **invalid**
     (`hsla(hsl(…), α)`) and drops the very panel surfaces T2 depends on. A cold T2 implementer
     following the approved plan would reintroduce css-1 wholesale.
  2. **`:310-312` — the one r3 caught.** "panel/border/**glow** derive from bg+primary in
     `applyCampaignTheme`" — this still tells a future implementer that `--theme-glow` exists and
     must be recomputed. CT deletes it. (The cited line range `public/app.js:1423-1450` is also
     already stale.)
  3. `~:357` — still requires the no-DOM consumer scanner to survive. CT deletes it.
  4. `~:385-389` — still describes derived `--theme-glow` recomputation.

  All four must be struck or annotated as superseded **in the same slice**, not "later".

### Execution contract (cold-implementer review — these were all unstated)

- **Finding id / branch / base — WITH AN ANCESTRY PRECHECK.** This phase lands as finding **`ct-1`**
  on branch **`fix/ct-1-theme-colour-format`**, cut from **`master`**.

  > **⚠ BEFORE BRANCHING, VERIFY THE PLAN YOU ARE READING IS ON YOUR BASE.**
  > *(Cold review r2 caught this happening for the second time: plan revisions were committed to a
  > working branch and NOT to `master`, so "cut from master" would have handed the implementer a
  > **stale plan** — without the `theme-vars.js` seam and without the `text`/`text_dim` warning —
  > and the likeliest shipped failure would have been blank generated-theme text.)*
  >
  > Run this and require it to pass:
  > ```
  > git merge-base --is-ancestor <this-plan-commit> master   # must exit 0
  > ```
  > If it does not, the plan on `master` is **older than the one you are reading**. STOP. The plan
  > must be merged to `master` first. Never implement from a plan that is not on your base.
  *(The cold review flagged that the plan's own pinned SHAs sat on `fix/css-2-scanner-scope` — the
  branch this plan forbids merging. That is now resolved: all plan/decision/state commits were
  rescued onto `master` (merge `88e6324`), and the poisoned branch keeps only its three code
  commits. **Never base implementation on `fix/css-2-scanner-scope`.**)*
- **One finding ↔ one branch ↔ one verdict** still holds, even though CT *closed* css-2 and css-3.
  Those were closed as **records**, not as code branches: css-2 was abandoned and never merged;
  css-3 was superseded and never branched. Their project branch refs were deleted after CT landed.
- **Close-out ordering** *(cold review: the previous text was circular — it asked for reviewer
  verdicts and commit SHAs inside the same pre-review commit that produces them)*. Sequence:
  (1) the atomic code commit on `fix/ct-1-theme-colour-format`; (2) reviewloop dispatch and verdict;
  (3) a **separate** docs commit recording the verdict and closing out css-2/css-3/index. Do not
  attempt to write a verdict you do not yet have.
- **Prerequisites a cold agent will not otherwise know**: run the unit suite with
  `AI_RETRY_BACKOFF_MS=10 node test.js` and the browser suite with `npm run test:browser`; run the app
  with `node server.js` (port 3000); the desktop shell is `npm run desktop` after `cargo build` in
  `desktop/src-tauri`.
- **Theme fixtures WITHOUT AI credentials, WITH EXACT EXPECTED MAPS** *(cold review: campaign creation
  calls the Setup AI, so a cold agent with no key cannot exercise the writer at all)*. Both writer
  paths are reachable purely through `public/theme-vars.js` (step 5) — that is the point of extracting
  it.

  > **The fixtures must pin the EXACT expected map, not just "matches the grammar."**
  > *(Cold review r2: "each emitted string matches the HSL grammar" lets a **wrong but valid** mapping
  > pass — e.g. deriving border lightness from `background + 8` instead of the current `panel + 8`
  > (= `background + 12`), or **swapping `text` and `text_dim`**. Every one of those emits a
  > grammatical `hsl(...)` and would sail through.)*
  >
  > Pin, for each fixture, the exact **input `colors` object** and the exact **output map** — full key
  > set and every value — transcribed from the CURRENT behaviour at `public/app.js:1603-1618` and
  > `:1621-1631`:
  > - derived panel lightness = `min(95, bgL + 4)`; derived border lightness = **`panelL + 8`**
  >   (i.e. `bgL + 12`), hue/sat inherited from the background;
  > - the full-theme map includes `--theme-text` and `--theme-text-dim`; the legacy map contains
  >   **neither**.
  >
  > - **full generated theme** — `colors` **with** a `text` slot → the body-level map.
  > - **legacy** — `colors` **without** `text` → the root-level map.
  >
  > Neither needs a browser, a server, or a provider key.

- **The pure functions do NOT prove the WIRING** *(cold review r2, and this is an honest limit —
  state it rather than paper over it)*. `applyCampaignTheme` cannot be imported in Node
  (`public/app.js:54` has top-level DOM access; `package.json` has no DOM library), so no Node test
  can prove the browser writer *calls* the right helper, or that it applies the full-theme map to
  `document.body` and the legacy map to `documentElement`. That wiring can be broken while every Node
  gate stays green. Mitigate by keeping `applyCampaignTheme` a **thin applicator** — it computes
  nothing; it takes the map from `theme-vars.js` and sets it — so the only untested surface is a
  loop over `Object.entries(map)`. **The human smoke pass is what covers it**, and it is the *only*
  thing that covers it. Say so.
- **README compatibility source.** Cite MDN's `color-mix()` browser-compatibility table as the
  authority for the declared floors; do not assert floors from memory.

### Files to change

- `public/theme-vars.js` — **NEW**: the pure, DOM-free theme-value seam (step 5)
- `public/styles.css` — 42 definitions converted (+6 glow removed), 132 opaque consumers, 25
  translucent consumers
- `public/app.js` — `applyCampaignTheme` writer (**both** paths); the **three inline-style
  consumers** at :1688/:1713/:1780; `THEME_VAR_NAMES` loses `--theme-glow`
- `public/index.html` — 3 inline-style consumers (:215, :409, :416)
- `map-render.js` — **10** SVG substitutions (`:67` has two)
- `test.js` — scanner deleted; canonical-grammar definition guard + consumer typo lint added
- `rpg-state.js` — the superseded comment at :1443-1445
- `plan.md` — supersede the T2 clauses that require the scanner and the glow var
- `README.md` — the declared browser minimums
- `.agents/decisions.md` — the format decision and the css-2 abandonment
- `.agents/review/findings/css-2.md`, `css-3.md`, `.agents/review/index.md` — close out

### Process

Per the 2026-07-12 decision this code went through `.agents/playbooks/reviewloop.md` with an
independent reviewer. **The plan itself was reviewed and accepted before implementation began.**

**Ship as ONE atomic slice** *(r1 endorsed)*: splitting definitions from consumers creates a broken
intermediate state, and no smaller format change removes loose components while keeping runtime
translucency. The single exception is the `color-mix` fallback above, which becomes its own slice
*if* it is ever needed.

The abandoned `fix/css-2-scanner-scope` work was never merged (it crashed the suite and rejected
valid CSS). Its project branch refs were deleted after CT landed; the postmortem owns the record.

---

## Phase PT: Cross-genre portability, Stage 1 — PLAN APPROVED (owner "yes", 2026-07-31); S1.1 LANDED; S1.2 READY

**Design authority**: .agents/review/archetype-portability-matrix-v3.1.md, as amended by
the 2026-07-31 one-persistent-character and live-canon Gate-3 rulings. This section supplies
implementation coordinates; the design record owns mechanics, schemas, flow, and verification.

**Identity contract:** one persistent character ID is active in exactly one campaign. Mechanics and
progression remain on that record. Per-campaign wording is retained and reused exactly on return;
only missing first-entry bindings or newly gained abilities need wording. Approval atomically moves
the same character. No branch, alternate version, merge, or campaign recreation occurs. Manual
copy and bundle import/export remain separate features.

**Gate status:** Gates 1-3 are settled. Gate 3 rejects a second setting checklist: portability reads
the destination outline/setting, bounded played history, and relevant memories through direct
shared helpers. Gates 4-7 still govern their affected later slices. D13/D16 still defer non-ability
state.

**Slice order is load-bearing (owner Gate 2): S1.1 → S1.8.** One slice per commit series.

- **S1.1 Ability IDs — LANDED at 9343e79.** Engine-issued globally unique IDs, legacy backfill,
  ID-first ability_updates matching, and manual-copy/bundle regression coverage.
- **S1.2 Shared canon retrieval and freshness — READY (§6).** Extract the existing MCP and Council
  reads into a transport-neutral `campaign-context.js` module, then have both current consumers call
  those direct helpers. The portability pack contains validated outline/setting, latest
  six turns returned chronological, and top eight relevant memories ordered by importance then
  recency with deterministic ties. player_action remains an action/claim; GM narration, memories,
  and outline/setting ground canon. Compute a deterministic digest of the exact normalized pack for
  stale-draft detection. Raw canon and retrieval anchors remain GM-private. MCP adapters may pass
  their own bounded limits/search inputs; portability pins the Stage 1 defaults. Internal code must
  not call MCP/SSE/HTTP, and this slice adds no DB setting schema, endpoint, UI, or editor.
  Files: rpg-engine.js (shared structured helpers/canon pack/digest), server.js (MCP adapters over
  helpers), test.js (outline validation, ordering/bounds, parity, privacy, digest, no-loopback
  guards); db.js only if an existing read must be centralized, with no migration.
  Exit: helper/MCP parity, deterministic bounds and digest, live reads reflect later GM canon, and
  no player/seat response contains raw canon or anchors.
- **S1.3 GM wording proposal plus structural validation (§6.2-6.3).** Given only requested missing
  slots, canonical character abilities, and the GM-private canon pack, the GM proposes wording and
  a player-safe fit explanation. The engine validates known character/ability IDs, exact bounded
  shape, requested existing slots only, and no numbers/mechanics/new slots. Player approves exact
  wording. No classifier, predicate evaluator, or seed permission table.
  Files: rpg-engine.js, rpg-prompts.js, test.js.
  Exit: GM owns fictional fit; adversarial structural violations fail closed; player-safe output
  leaks no raw canon.
- **S1.4 Lazy vocabulary and per-campaign bindings (§5).** Establish only vocabulary needed by a
  missing binding, from the same live canon review. Store campaign-shared terms and character-local
  name/ability wording separately. Existing approved rows are immutable and reused exactly.
  Files: db.js, rpg-engine.js, rpg-state.js, test.js.
  Exit: two characters coexist, late joiners do not rename shared terms, and no binding stores
  mechanics or a copy of campaign canon. Re-run seat leak/route guards.
- **S1.5 Onboarding (§8.1).** Restart-safe plain-language character-summary approval for new and
  legacy characters; internal families/slots remain invisible and await Gates 4-6.
- **S1.6 Campaign move (§8.2-8.5).** Persisted movement draft, hash-bound approval, exact canon-basis
  freshness check, one-active-membership transaction, no existing-campaign recreation, and every
  non-approved path leaves current membership unchanged.
- **S1.7 Narration binding (§9).** Active bindings become Council naming authority; no unapproved
  cross-campaign term or GM-private canon material reaches Council/seat context.
- **S1.8 Canonical mechanic projection — LAST (§11).** Project one canonical mechanic record through
  active destination wording at campaign-entry handoff; never persist destination mechanics.

**Verification:** node test.js, with AGENTS.md anti-vacuity proof for every new behavior test.
Success requires the full v3.1 §12 matrix, exact-return playtest, live-canon update without old
binding rewrite, GM explanation of a surprising but canon-supported term, and ten turns without
vocabulary reversion.

**Non-goals:** capability_json, setting axes, predicate grammar, genre classifier, seed permission
tables, settings/admin UI, sync workflow, self-MCP/network calls, raw-canon disclosure, branches,
mechanics translation, and all Stage 2-4 work.

---

## Historical Progress Log (not current state)

This section preserves implementation history. `.agents/state.md` is the canonical current-state
entry point.

**Phase 0 — Initial Prompt & Data Changes (completed first pass)**
- Strengthened "Interactivity" rule in `rpg-prompts.js` with explicit table-conversation priority, strict classification guidance, and mandatory scene_grounding behavior on clarification turns.
- Added `scene_grounding` field to the expected JSON schema in the main GM prompt.
- Rewrote the Interaction Agent prompt in `rpg-engine.js` to be extremely conservative (default to clarification on any ambiguity, with many concrete examples).
- Strengthened Referee prompt and final narration instructions (both single-model and Council paths) to protect clarification turns.
- Added `scene_grounding` support to `validateTurnData` (`rpg-state.js`).
- Wired `sceneGrounding` through all response paths (initial campaign, takeTurn, getCampaignState) and fork (via state_changes_json).
- Updated frontend (`public/app.js` + `styles.css`):
  - `renderTurnState` now calls `appendSceneGrounding` when present.
  - Added `appendSceneGrounding` helper that renders a distinct "Current Situation" block (italic, secondary color).
  - Added supporting CSS for `.log-scene`.
- Updated opening turn prompt to request good `scene_grounding` on campaign start.
- All existing tests continue to pass.
- Committed the plan + initial changes earlier; these Phase 0 edits are ready for playtesting.

**Next step**: Playtest a short campaign (ideally with Council mode + local or strong model) and observe whether clarification questions now receive proper, non-advancing answers + useful scene grounding. Then iterate on the prompts based on real output.

**Historical 2026-06-05 interactive snapshot:** clarification instrumentation, no-state-change guards,
and their unit coverage were developed here. Machine-local server, credential, and campaign-session
details were removed during the 2026-07-15 drift pass.

**Visual Phases V1–V4 + T1 — first implementation pass (2026-07-04, owner playtest pending)**

All five slices landed with guard-proven unit tests (suite green throughout);
functional gates closed where an agent can close them, feel gates open:

- **V1 image seam**: registry (openai hosted / sdwebui local), identity-anchor
  param end to end, /admin "Scene Images" section, key-safety proven by test
  (a sabotaged key-leak fails the suite). No consumer runs unless a provider
  is configured.
- **T1 theming**: outline carries text/text_dim color slots (clamped readable/
  dark) + a font pairing from the bundled pool; full generated themes apply at
  body level and beat the curated presets; pre-theming campaigns verified to
  keep their exact legacy shape (live reload of campaign 3).
- **V2 structured locations**: live-smoked end to end on campaign 3 with the
  configured Ollama model — one committed action produced the referee location
  signal, a generated 4-area layout ("Ancient Ruins Chamber"), positional
  flag, occupancy including the player, and the deterministic map SVG; all
  persisted and correct on reload. Both no-op layers guard-proven.
- **V3 current_heroic**: pointer + stickiness rules (thrash guard
  guard-proven), synchronous render through the seam, identity anchors
  committed at first render, authenticated path-confined image route.
  **Not yet exercised with a real image provider** — needs /admin config
  (sdwebui on the dev GPU, or an OpenAI key).
- **V4 frontend**: heroic takes the visualizer slot via authenticated
  blob-URL fetch (SVG fallback intact); new Situation panel (grounding text
  always, map coexisting on positional turns or when spotlighted) joins the
  spotlight cycle in both layouts.

Known first-cut gaps (deliberate): the opening turn creates no location or
heroic (the first committed action does); forks copy location rows wholesale
rather than replaying to the fork point, and do not carry heroics; NPC
identity descriptors are mechanical compositions of stored personality/quirks
(a generated appearance descriptor is a possible later refinement); the map
auto-reveals only from committed-action positional signals — table-talk turns
still display it via the Situation spotlight.

**2026-07-04/05 Queue — implemented (owner playtest pending)**

The full delegated queue landed same-session under the recorded process
(agent-decided calls, codex-reviewed plans, adversarial implementation
review): Phase 3 M1–M4 (multi-character schema with atomic migration and
arrival baselines, round-robin turn order with gate-after-classification —
denials never consume a turn — join/release/party UI with per-browser
identity and a gap-backfilling poll, README for hosting); V5 (opening
location + heroic at creation, generated NPC appearance descriptors,
sticky positional display); Phase D (helpfulness/pacing dials, classic +
standard defaults, choice caps guard-proven, pacing enforced as recorded
world-turn cadence); Phase H (holodeck idle entry state); Phase P
(export/import with pinned v1 fixture as the forward-importability guard).
A 26-agent adversarial review confirmed 21 unique defects — all fixed, one
commit each (turn-consumption on denial, ghost profiles, duplicate campaign
cards, bundle hardening, poll races, identity-claim theft among them).
Suite: 23 test groups green; multiplayer live-smoked via API (join,
CHARACTER_REQUIRED, OUT_OF_TURN after one call, single-member release);
campaign 1 left as a ready two-character table. The owner's multiplayer
playtest is the gate that closes all open feel verdicts.

**Phase 0 — Council Efficiency Refactor (approved 2026-06-05, implemented 2026-07-03 — pending playtest)**

Implemented 2026-07-03 in three commits (owner green-lit ahead of the Phase 0
over-conservatism probe): dead single-model path deleted; 2-call table-talk path
(interaction + grounding verifier) for clarification/dialogue with state forced to
no-op per decision 2026-06-05 (`forceNoOpTurnState`, DB-truth quest reset folded in);
dice-before-narration (Referee decides whether/which checks with failure consequences,
engine rolls between Referee and Continuity-Final, narrator writes from resolved
results, engine applies adjudicated consequences — keyword matching and the hardcoded
5-10 HP penalty deleted, denied actions can no longer take roll damage, roll records
now visible to later turns per the omniscience decision). Unit suite green with new
guard-proven tests; success check below still requires a rules_mode playtest before
this counts as done.

Original design (recorded here first, so the code is plan-backed before it was written):
- **Branch the Council on `input_kind` after the Interaction Agent.** `clarification` and `dialogue` take a **2-call path**: (1) the Interaction Agent answers the question and classifies it, (2) a single grounding/continuity verifier independently checks that answer against game state (anti-hallucination / anti-drift) and emits the final player-facing JSON with all state forced to no-op. `committed_action` keeps the **full chain** (Interaction → Continuity → Referee → Continuity-Final → Narration), because only it mutates state. Rationale: a question should not cost 5 LLM calls — today the Referee and Continuity-Final are forced no-ops on clarification turns, pure overhead. The independent verifier preserves the anti-hallucination guarantee while halving the call count for table-talk.
- **Delete the dead single-model path.** `isMultiAgentModeEnabled()` hardcodes `true`, so the single-model branch in `takeTurn`, its unused client, and the toggle are unreachable. Remove them; the Council becomes the only path. Fold the one correct behavior currently living in that block (resetting `quest_update` to the *real* active quest on clarification) into the verifier so it isn't lost.
- **Success check:** clarification still produces zero state mutations and a useful `scene_grounding`; committed actions still adjudicate normally; all existing tests pass.
- **Dice before narration (committed-action branch design, added 2026-06-11 from playtest evidence).** Dice rolls are a service the GM consumes, not a post-processing step. Flow: the adjudicating side of the Council (Referee, informed by Continuity's story/world knowledge — the agent that "knows what's around the next twelve corners") decides which checks the action requires (attribute, DC, stakes, failure consequences) under the campaign's rules; the engine rolls deterministically in code; the results are written into the turn record; only then does the narrator receive the resolved facts and write prose that reflects the actual outcome. This replaces today's inverted flow where `performDiceCheck` keyword-matches the player's text, rolls *after* the narrative is generated, and hardcodes a 5-10 HP penalty appended post-hoc — which produces narrative dissonance, applies damage even to referee-denied actions, and leaves the GM unable to explain its own mechanics (see decision 2026-06-11 "GM omniscience"). Failure consequences become adjudicator decisions under campaign rules, not engine constants. Roll records must be visible to later clarification turns. Playtest evidence (2026-06-11, campaign 1): keyword matching produced intellect checks for "head down the lower path" and "proceed cautiously toward the rustling sound," every committed action triggered a roll regardless of triviality, and all five failed (DCs 10-18), costing 33 HP for actions as mundane as walking — the adjudicator's first decision must be *whether* a check is warranted, under a recorded ruleset the model can apply without drifting (see the ruleset consistency topic).
