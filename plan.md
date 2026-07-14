# Aetheria DM Improvement Plan

**Goal**: Perfect the single-player experience while laying solid architectural foundations for future multiplayer (tabletop-style: multiple characters in one campaign, sequential turns via initiative or round-robin, shared scenes, natural table-talk).

**Core Principle**: Every change must improve *fun* and *feel* like a real GM. Avoid feature creep. Prioritize quality of interaction over new mechanics.

## Phase 0: Clarification & Table-Talk (Highest Priority - Fix the core complaint)

**Problem**: The DM is too "video-gamey". It rushes to resolve actions and struggles with pure questions like "Which goblin is closer? Can I throw my dagger at it?" The `input_kind: "clarification"` path exists in code but is not reliable in practice.

**Concrete Changes**:
- Strengthen the Interaction Agent prompt to be much more conservative about classifying input as `committed_action`.
- Improve the Referee and Final Narration prompts with better few-shot examples of good clarification responses (scene grounding, partial information, "you don't know yet" answers, encouraging more questions).
- Add explicit "scene grounding" output field so the DM is forced to describe the current tactical situation clearly before any resolution.
- Update `validateTurnData` and frontend to handle richer clarification responses.
- Add a "pure question" detection heuristic in `rpg-engine.js` before the full Council pipeline.

**Success metric**: Player can have 3-4 back-and-forth clarification exchanges without the world state advancing or the DM forcing an action.

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
distinct and consistent across turns; narrator remains the player's chosen
voice; graceful fallback when the model omits the script.

- Expand current TTS (OpenAI) to support multiple character voices per turn.
- Give the DM a consistent persona/voice style that persists across a campaign.
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

**Multiplayer end state vision**: Multiple players can join the same campaign (via shared URL + access token). The DM maintains one shared scene description. Players take turns in declared order. Clarification/table-talk works for everyone. Character progression is persistent across campaigns.

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
  token, voice preference (toggle/voice/style), diagnostics.
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
  mechanism; (2) finding `dt-3` (landed die color override); (3) finding
  `css-1` — `rgba(var(--theme-*), α)` with HSL-triple variables is invalid
  CSS, so the header/glass/panel fills and several glows compute
  UNPAINTED today (public/styles.css:99-100,126,174,202,262,307 among
  others); every such use migrates to `hsla(var(--theme-*), α)`, verified
  by computed-style checks under a non-default palette. Without css-1 the
  scene palette would recolor text and borders but not the dominant panel
  surfaces, silently gutting this phase's visible effect.
- Anchor: the scene theme is LOCATION state, not a per-turn mood signal.
  `locations` gains `theme_json` (db.js ALTER TABLE migration, existing
  pattern; NULL for all pre-existing rows). Rationale: the theme changes
  exactly when the fiction moves somewhere else — predictable and
  thrash-free by construction, no additional AI calls beyond the existing
  per-location generation, and a revisited place looks the same (the layout
  consistency rule applied to atmosphere).
- Theme shape: `{primary, secondary, bg, text, text_dim}` — five HSL slots.
  `bg` is included deliberately (t2-5): panel/border/glow derive from
  bg+primary in `applyCampaignTheme` (public/app.js:1423-1450), so without a
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
  - The no-DOM scanner survives as a cheap drift guard inside `node
    test.js`: it walks public/styles.css, public/index.html,
    public/app.js, and map-render.js for `--theme-` usages and fails on
    any site outside the enumerated flat-pair list — a future fancy
    effect must consciously extend the list (and its checks) to ship.
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
  override the campaign baseline before the CSS variables are set
  (public/app.js:940, 1414-1456); derived vars (panel/border/glow) recompute
  from the merged palette exactly as today, so every themed surface follows
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
agent-decided, plans approved via codex review loop, nothing gated on the
owner until the multiplayer playtest. Priority order: Phase 3 (above) →
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

- **Scene-dynamic theming — DRAFT PLAN WRITTEN 2026-07-11** (owner direction
  2026-07-11; the plan is Phase T2 in the Visual Phases above, awaiting owner
  approval). Original direction: the color scheme follows the *game* as it
  moves — night-club neon, forest earth tones — extending, not replacing,
  the T1 setup theme.

- **Owner/player settings split & simple auth.** AI provider config is server-owned (see decision 2026-06-11 in `.agents/decisions.md`); the open question is the mechanism. Leading idea: a separate `/admin` URL — not linked from the game UI — gated by a master password distinct from any per-player credentials, where the owner manages provider/model/keys (and model-name entry UX, e.g. presets/datalist, lives there too). Implies an eventually-real, if simple, auth system: players will need credentials to protect/reclaim their persistent characters once the game is hosted publicly, so per-player auth and owner auth should be designed together rather than bolted on twice. Current single-key UI is acceptable while operator and player are the same person.

- **Model fallback tiering on transient provider errors.** Provider overload (e.g. Gemini 503) must never surface as a raw error in the DM's voice, and the DM cannot "take a break" — that kills the session. Direction: retry once, and/or fail over to a configured backup model per request. Open questions: how backup tiers are configured (depends on the owner-settings design above), and how failover interacts with Council role separation — a mid-chain model swap must not muddy the separation of duties or change adjudication behavior within a single turn. Frontend should restore the player's input and present transient failures as retriable, outside the DM's voice.

- **Spells, abilities & ruleset consistency — REOPENED 2026-07-11** (decision in
  `.agents/decisions.md`): the engine needs a working, *user-predictable* rules
  system; the freeform/no-rules path is not viable for multiplayer, and external
  systems are back on the table. The 2026-07-03 first cut described below is
  landed code but no longer the settled end state — a new design must be planned
  and promoted before implementation. Original promotion (2026-07-03: selectable
  at campaign start, lightweight house system as default). First-cut implementation:
  campaign creation gains a ruleset selection; the Setup role generates the
  house ruleset for the campaign (resolution = the engine's existing d20 +
  attribute mod vs DC; campaign-specific starting abilities/spells with costs
  and limits) stored as `campaigns.ruleset_json`; the ruleset is injected into
  the GM system instruction and Council context as canon; players view it in
  the game UI. Consistency is the hard gate: rules must not drift between
  turns. Owner judges this implementation before SRD options are added
  (license check recorded as prerequisite for those).

- **Genre atmosphere & the "empty holodeck" entry state — theming half PROMOTED 2026-07-04** (decision 2026-07-03 in `.agents/decisions.md`: agent-generated at campaign setup, owned by the Setup step; implementation is Phase T1 in the Visual Phases above; accent graphics deferred). The "empty holodeck" entry state below remains unscheduled. Entering the server before any campaign is chosen should feel like a TNG holodeck with no program running — a deliberately blank slate with potential, not a themed default. Once a genre is chosen, the visual/audio atmosphere must convincingly match it (a cyberpunk campaign with earthy tavern tones is a failure case). The adaptive HSL theme feature partially covers in-game theming today; open questions: curated templates vs fully agent-generated theming, and which agent owns the job — a dedicated campaign-setup agent, the Continuity agent, or the existing outline-generation step. To be decided.

- **GM helpfulness / adversarial-style dial — DECIDED & PROMOTED 2026-07-04** (decision in `.agents/decisions.md`: helpful|classic|hardline, default classic, adjustable mid-campaign, choices fade with style; implementation is Phase D in the 2026-07-04 Queue). Original discussion: First Phase 0 playtest: asked a tactical question ("if I extinguish the light, can I still see?"), the DM volunteered a thorough answer with implicit odds and an unprompted middle-option tactic. Not wrong — but it's a notably *helpful* table style (a typical LLM trait); many human GMs would answer "You think so." and let the player own the risk. Direction: a campaign-start setting ("GM helpfulness" / table difficulty) selecting how much the DM volunteers — odds, tactical options, hints — implemented as narrator/interaction prompt variants. Default and option set to be decided.

- **Encounter pacing dial — DECIDED & PROMOTED 2026-07-04** (decision in `.agents/decisions.md`: slow_burn|standard|action_heavy|player_driven, default standard, enforced as recorded cadence state; implementation is Phase D in the 2026-07-04 Queue). Original discussion: Nothing in the current prompts governs encounter frequency, and three things bias toward action every turn: the Challenge rule frames committed actions in danger/damage terms, XP rewards quest advancement per turn, and scene_grounding requests "immediate threats" in every scene. LLMs already trend toward eventfulness; good tables often run ~5 world-interaction turns per 1 combat/encounter. Direction: a campaign-start pacing target (encounter density) stored as campaign state, plus a recorded recent-cadence fact (e.g. turn-type history / turns since last GM-initiated encounter) that the Continuity agent — already nominally the pacing guardian — checks as a rule rather than a mood ("encounter 2 turns ago; do not introduce a new threat unless the player seeks one"). The dial governs what the GM initiates, never what the player may do. Groups with the GM helpfulness dial as campaign-start "table style" settings (likely one config object + one settings UI when promoted). Prompt-adjective-only implementations are expected to drift and should be treated as insufficient.

- **Player authority boundary — settled.** Promoted to a durable decision (2026-06-11, `.agents/decisions.md`): the player is not in control of the game, the GM's decisions are final, out-of-character pressure is deflected in persona, with continuity gate + engine validation as backstop. Remaining open here: how the resistance prompts interact with the GM helpfulness dial above (both shape the GM-player relationship), and prompt implementation when promoted into a phase.

- **Maps & Character Miniatures — PROMOTED 2026-07-04** into the Visual Phases above (V1 image seam, V2 structured locations, V3 current_heroic, V4 layout wiring), built on the owner directions recorded below and the 2026-07-03 image-seam decision. The discussion below is retained as the design record. Can the DM Council generate an encounter map and keep it coherent across revisits, so returning to an area isn't foreign? Key requirement identified during discussion: coherence demands *persistent, structured location state* — promote locations to first-class entities with a stored layout (areas, exits, fixed features) plus a mutable occupancy layer; generate once on first entry, load on revisit, and mutate only through the referee/continuity gate (never on clarification turns). A regenerated image cannot do this (image-gen won't reproduce a layout), so it implies structured data + a deterministic render; top-down maps suit SVG, which may keep SVG for maps even after scene illustration moves to image-gen. A map is essentially the persistent, structured evolution of `scene_grounding`. Open fork — how tactical: (a) structured/theater-of-mind zone positions only, (b) visual top-down map + tokens with purely narrative resolution, (c) full tactical grid / VTT with coordinates, movement, line-of-sight. **Tension:** (c) collides with the "Full combat grid / tactical combat system" non-goal above and with the Phase 0 anti-"video-gamey" principle; (b) is the likely sweet spot if pursued.

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

- **Data store & cross-campaign persistence (SQLite → Postgres).** Open question raised 2026-06-13; working direction is Postgres (not yet decided). Two drivers force a single shared relational store: (1) **cross-campaign characters + user ownership** — characters are owned by users and reusable across campaigns, with a check-in/out invariant: a character can be active in only one campaign at a time, is locked while checked out, and on campaign end its updated stats are written back and it is released. That "one active campaign per character" rule is a global uniqueness/lock that a single relational DB enforces with a constraint + transaction, but that is painful to enforce across separate per-campaign SQLite files (which is why the one-DB-file-per-campaign idea was set aside). (2) **Concurrent-campaign write throughput** — SQLite's single-writer lock serializes unrelated campaigns; this only bites if the engine is hosted as a multi-tenant service. Postgres is preferred over both the multi-SQLite-shard hybrid and SQL Server: native concurrency, good JSON support for the engine's JSON-heavy state, pgvector for semantic memory search, and a light native footprint. **Run native, not in Docker** — owner does not use Docker; the existing `Dockerfile` / `docker-compose.yml` were added by a prior model and are an optional path, not the owner's deployment story. Sequencing (kept non-premature): stay on SQLite now (correct for single-operator dev/MVP); introduce Postgres when real user accounts / ownership / multiplayer land; until then keep all DB access centralized in `db.js` and avoid SQLite-only SQL so the swap stays mechanical. Open: final DB choice and migration trigger.

- **Player-only communication channel (multiplayer) — fork DECIDED 2026-07-04** (in-app loggable channel wins over external-tool integration; a post-v1 Phase 3 slice, not in the first multiplayer cut — see the Multiplayer-v1 decision). Original discussion: Open question raised 2026-06-13; relevant only with multiple players. Owner wants to playtest multiplayer early, even solo with two browser windows, which pulls the user-ownership + character-checkout + turn-order foundations somewhat earlier than the far-future end state. Fork: (a) **integrate with external tools** (Zoom / Teams / Google Chat) for player chat/video, vs (b) **build an in-app player-only text channel.** Tension with the "log everything" requirement: external tools can't be fully logged (video especially) — integration would log only a reference, while an in-app channel can be logged end-to-end. Firm boundary the owner set: **player-only chat is never routed to the GM Council as an actionable turn** — it is table talk among players, never an input to adjudication (clean boundary, and a security property, consistent with the player-authority decision). If players want the GM, a player must explicitly address the GM, which promotes that one message into a real turn; the GM receives only that message, not player-chat history. Logging is for the durable record / operator, not for model consumption (logged-for-humans ≠ fed-to-the-GM), so the log requirement and the never-to-GM rule do not conflict — but a consent/disclosure notice is needed (precedent: the voice-narration disclosure). Open: which mechanism; logging + consent design.

- **Portable characters & campaigns — format DECIDED, PROMOTED 2026-07-04** (versioned single-file JSON bundle, export first, forward importability required; implementation is Phase P in the 2026-07-04 Queue; ownership/auth interactions stay future). Original discussion: Open question raised 2026-06-15. Goal: a character and/or a full campaign should be exportable as a self-contained, restorable artifact that can move between deployments — backup, host migration, handing a save to another player/operator, resuming elsewhere — with continuity intact. **Distinct from the cross-campaign persistence topic above:** that one is about reusing a character across campaigns *within a single deployment* (the check-in/out lock); this one is about crossing the deployment boundary. For continuity to survive a move, the artifact must carry the *structured* state the Council consults, not transient prompt text — campaign outline, turn/state history, memories, NPCs (relationship + accumulated notes), character sheets, ruleset/known-abilities facts, and (once they exist) location state and voice/visual identity anchors. A portable artifact is therefore a versioned serialization of that structured state. Open questions: artifact format (single-file bundle vs. DB dump) and how it tracks the SQLite→Postgres direction; **schema versioning / migration** so an export from an older engine still imports (this is the load-bearing hard part, and it couples to every state-shape change made by other topics); scope (character-only vs. whole-campaign export); interaction with user ownership/auth and the one-active-campaign-per-character lock (who may import, and how to avoid duplicate "live" copies of the same character); and **trust posture for imported artifacts** — externally supplied campaign/character data is untrusted input and must be treated as data, never as instructions to the Council or engine (same boundary as the bootstrap-packet rule in AGENTS.md and the player-chat-never-to-GM rule above). Provenance: surfaced while scouting an external agent-identity project (`ethagent`, an Ethereum/ERC-8004 system for owning AI agents as wallet-held tokens with encrypted IPFS-backed memory). Nothing from it was adopted — its on-chain ownership / encryption / IPFS / ENS stack is irrelevant to narrative coherence, and the engine's structured DB state already does the memory job far better — but it prompted the portability idea, which would be built natively against the engine's own state store, not borrowed.

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
      never arithmetic. It is the Referee becoming mostly code, and it cannot be specified
      until the effect catalog exists (intake F2, HIGH).
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

- **Model catalog in /admin (planned 2026-07-12, owner request; STATUS: APPROVED + QUEUED
  by the owner 2026-07-12 — combo-box shape approved; not yet started, no branch cut).**
  Problem: every model field in `/admin` is free text (`admin.html`: primary `#model`,
  `#fb-model`, and five `#role-<key>-model`), so the operator must already know each
  provider's model strings. Compounding it, the per-provider default models hardcoded in
  `api-client.js` (`grok-3` at :283, `claude-3-5-sonnet-20241022` at :280) are stale —
  the Anthropic one is retired — so a provider selected with the model left blank can
  resolve to a dead string and fail at call time.

  Design (combo-box shape, owner-approved 2026-07-12: fetched names are *suggestions*
  over a text input, never a strict select — a failed fetch must degrade to exactly
  today's behavior):

  1. New `model-catalog.js` exporting `listModels(provider, {apiKey, ollamaUrl, baseUrl})`
     → `string[]`. Per-provider pinned endpoints and response shapes:
     - `gemini`: `GET generativelanguage.googleapis.com/v1beta/models?key=` — keep entries
       whose `supportedGenerationMethods` includes `generateContent`; strip the `models/`
       prefix.
     - `openai`: `GET api.openai.com/v1/models`, Bearer → `data[].id`.
     - `claude`: `GET api.anthropic.com/v1/models`, `x-api-key` + `anthropic-version:
       2023-06-01` → `data[].id`.
     - `grok`: `GET api.x.ai/v1/models`, Bearer → `data[].id`.
     - `ollama`: `GET {ollamaUrl or http://localhost:11434}/api/tags` → `models[].name`.
     - `custom`: OpenAI-shaped `GET {baseUrl}/models`, only when `baseUrl` passes the
       existing SSRF validator.
     Host policy: reuse `validateUrlForSsrfAsync` and the `trustedHosts` allowlist that
     already live in `api-client.js` (api-client.js:82-90, 112-120). Do NOT introduce a
     second allowlist — one canonical location for that rule.
  2. New route `POST /api/admin/ai/models`, under the existing admin gate (`server.js:284`
     mounts `authenticateAdmin` + `rateLimit(20, 60000)` on all of `/api/admin`). Body:
     `{provider, apiKey?, ollamaUrl?, baseUrl?}`. Key precedence: request-supplied key when
     non-empty (so a key can be tested before it is saved), else the stored admin key, else
     the provider's env key. Errors return through `server-errors.js`; the route is
     host-only and must never reach a seat.
  3. `admin.html` / `admin.js`: each model input keeps `type="text"` and gains a `list=`
     pointing at a `<datalist>`, plus a "Refresh models" control per provider-scoped group
     (primary, fallback, each role). Results cached per provider in page memory for the
     session.

  Non-goals (v1): the voice/TTS and image model fields (separate seams — `tts-providers.js`,
  `image-providers.js`); server-side or persisted catalog caching; capability metadata beyond
  the model id.

  Security note (load-bearing): the Gemini key travels in the query string, so a provider
  error body or URL must never be logged or echoed to the client — sanitize before it
  leaves `listModels`. The `ollama` and `custom` paths are the only ones touching
  loopback/operator-supplied hosts and must route through the existing SSRF validator.

  Verification: `node test.js` green. New unit tests cover the pure per-provider response
  parsers (captured payload → expected id list) — that is the guardable surface; the network
  call itself is not unit-tested. Guard proof per AGENTS.md: revert a parser, confirm the
  test goes red. Live: `/admin` → select provider → Refresh → list populates → pick a model
  → Save → play a turn. No playtest gate (dev tooling, not a game phase).

**Review Process**: After completing each phase, we will test a full play session together, gather feedback, and only then move to the next phase. No code will be merged until it demonstrably improves the playing experience.

**Current Priority** (2026-07-09): the remote two-human multiplayer playtest itself. App-side readiness (S2 seat-scoped visibility, S3 seat bootstrap/mint flow, README) landed 2026-07-09; a cross-model review then found and closed six defects in it (`.agents/review/index.md`). Suite green with leak guards proven, API-level live smoke clean; the two-browser end-to-end is exactly what the playtest exercises. Remaining before play: owner sets ACCESS_SECRET + ADMIN_SECRET, ensures an AI provider is configured on the hosting machine (provider config is machine-local), exposes the server (owner-handled), mints seats. The playtest is the pending close point for the open feel gates.

This plan will be updated as we learn from implementation and playtesting.

---

## Phase V: Grok TTS — 26 voices, delivery tags, provider-aware voice profiles (promoted 2026-07-14, owner go)

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

### Problem

The voice layer is **structurally OpenAI-coupled**, so registering a Grok provider alone would
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
   - **Legacy rows (no `voiceSeed`)**: derive the seed from the NPC's **creation order** (its stable
     row id / ordinal within the campaign), **never** from the name.
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

   - **`mood` is an ENUM, not free text.** Define a small, finite, server-owned vocabulary of
     delivery descriptors (e.g. `warm`, `gruff`, `hushed`, `cold`, `manic`, `weary`, `bright`,
     `menacing`, …). The model **selects** one at NPC creation (`rpg-prompts.js` already asks for
     `personality`/`quirks`; add `voice_mood` **constrained to the enum**); `rpg-state.js` validates
     membership and **drops anything off-list** — it never passes an unrecognized value through.
   - **`tone` maps onto the same finite vocabulary** at synthesis. An unmapped tone contributes no
     tag rather than being interpolated verbatim.
   - **Neutralize bracket syntax in the spoken text.** Strip/escape `[`…`]` from `line.text` before
     it is sent to Grok, so narration the model wrote cannot smuggle its own controls
     (`server.js:124-132`). The ONLY tag Grok ever receives is the one the server composed from the
     enum.
   - Rendered form: `[<mood>, <tone>] <text>` — either part optional, no tag when both are absent.
   - **OpenAI's path is unchanged**: the same two enum values fold into its `instructions` string.
     Both providers consume the same inputs; only the rendering differs.

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
   to the host:
   - The client sends `{ text, speaker, tone }` for **both** modes. It stops composing
     `instructions` and stops choosing NPC voices.
   - The server resolves `speaker` → the campaign's NPC profile → `voiceSeed` → the active provider's
     voice + enum mood. Host requests must therefore carry **campaign identity** (available from the
     authenticated session; the seat path already has `req.auth.campaignId`).
   - The player's own narrator preference (voice + direction) still applies to **narrator** lines —
     that stays a player setting, as today.
   - Net effect: one resolution path, one place where provider-awareness lives, and the host stops
     being second-class. It also *deletes* client-side logic rather than adding any.

7. **The NARRATOR must have a portable identity** *(r1)*.

   *(Campaign creation never populates `campaigns.narrator_voice_json` (`rpg-engine.js:1261-1264`);
   narrator lines fall through to a browser default (`rpg-state.js:774-790`) which is a **hardcoded
   OpenAI name** (`public/app.js:23-29`). So "one voice for the GM" is not guaranteed at all — across
   browsers or providers the narrator is not sticky, and it can even select an NPC-pool voice.)*
   Assign a narrator profile **at campaign creation**, provider-aware, using the **reserved** GM voice
   (`leo` for Grok, `marin` for OpenAI) which is **excluded from the NPC pool**. Existing campaigns
   with no narrator profile resolve to the reserved voice for the active provider.

8. **Key resolution — per provider, and it CANNOT be done as previously written** *(r1)*.

   *(`server-config.js:85-87` resolves a single generic stored `voiceApiKey` and falls back only to
   `OPENAI_API_KEY`. **One slot cannot hold two vendors**: switching providers can send the xAI key to
   OpenAI or vice versa — the exact key-leak class already fixed once for the Grok text path.
   `server-config.js` was omitted from the files list.)*
   Store and resolve the voice key **per provider** (`voiceApiKey.openai`, `voiceApiKey.grok`), with
   env fallback `XAI_API_KEY || GROK_API_KEY` for Grok (matching `api-client.js:299`) and
   `OPENAI_API_KEY` for OpenAI, and mask each independently in `/admin`. A key must never be sent to a
   host it was not issued for. `voiceModel` is meaningless for Grok and must be **omitted from the
   request**, not sent.

9. **The Grok request contract, pinned** *(r1: unpinned, and `server.js:777` labels every response
   `audio/mpeg` regardless)*: `POST https://api.x.ai/v1/tts` with `voice_id`, **`language: 'en'`
   (REQUIRED — omitting it is a 400)**, `output_format: { codec: 'mp3' }`, `speed`, and **no `model`
   and no `instructions` field**. Assert the response is actually MP3 rather than trusting the
   Content-Type the server stamps on it.

10. **The voice-selector UI — the plan's premise was FALSE** *(r1)*.

    *(The draft said "the voice control is driven by `listTtsProviders()`, so Grok appears once
    registered". It is not, and it would not. `admin/admin.html:135-145` **hardcodes OpenAI** and has
    no voice list at all, and the narrator voice selector the player actually uses is a **hardcoded
    list of OpenAI names** in `public/index.html:379-393`. Browser code **cannot call
    `listTtsProviders()`** — it is server-side. Without new plumbing, Grok's 26 voices could never be
    offered, a saved `marin` would linger as a stale invalid value, and the voice preview would keep
    sending a free-text direction the provider does not accept.)*

    Add a small **catalog endpoint** — `GET /api/voices` returning the **active provider's** voice
    ids (and the reserved narrator voice) from the server-side registry. Populate the narrator
    selector in `public/index.html` / `public/app.js` from it instead of the hardcoded list. On a
    provider switch, a stored voice that is not in the new provider's set falls back to the reserved
    narrator voice rather than being sent and 404ing. Mirror the same list in `/admin`, and hide the
    model field for Grok (it has none).

11. **Fork and import must carry the new fields** *(r1 — both silently drop them today)*:
    - `rpg-state.js:1037` — the campaign-import `bundleVoice` whitelist keeps only
      `provider`/`voice`/`instructions`, so an exported campaign would **lose `voiceSeed` and
      `mood`** on import, breaking the portability this design claims. Add both to the whitelist and
      to the round-trip test.
    - `rpg-engine.js:2634` — **fork creates fresh profiles** via `assignNpcVoiceProfile` instead of
      copying `voice_json`, so a forked campaign loses every NPC's mood and may reassign its voice.
      Copy the stored profile on fork.
    - Both files were **absent from the files-to-change list**.

8. **`language` is REQUIRED by the xAI endpoint.** Default `'en'`. A missing `language` is a 400.

### Accents (explicitly scoped OUT of the provider work)

Grok cannot do accents, and no provider switch will give them. The only lever is **dialect spelling
in the narration text itself** ("Ye'll not be findin' the old road tonight"), which is a
`rpg-prompts.js` concern, costs nothing, and works on *any* TTS provider including the current one.
Recorded here so it is not lost; it is a **separate, optional slice**, not part of this phase.

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
single request.** A turn is a handful of speaker *runs*, not 40 alternations.

**Grok's inline tags are what make this possible, and OpenAI's design is what prevented it.**
OpenAI steers via the `instructions` **request field**, so merging four lines flattens them to one
delivery and loses per-line tone. Grok steers **inside the text**, so a merged run keeps per-line
delivery:

```
[tense] The door gives way. [pause] [whispers] Something far below stops moving to listen.
```

One request, one voice, per-line delivery preserved. This is the capability verified on 2026-07-14
paying for itself. Grok's text limit is 15,000 characters — far beyond any turn.

**Consequences, including the one that cuts against it:**
- A 40-line turn becomes roughly 5–8 requests, so the rate limit stops being a live hazard. Raise
  the cap anyway to match a real turn — it was plainly never sized against one — but the batching,
  not the cap, is the fix.
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
  rate limit; `GET /api/voices`
- `server-config.js` — **per-provider** voice key storage/resolution/masking (`:85-87` today resolves
  one generic key and falls back to `OPENAI_API_KEY`)
- `public/app.js` — send `{speaker, tone}` for the host too; stop composing NPC `instructions`
  client-side; **batch consecutive same-speaker lines**; skip-and-continue on failure; populate the
  voice selector from `/api/voices`
- `public/index.html` — the narrator voice selector (`:379-393`) is a hardcoded OpenAI list
- `rpg-engine.js` — assign a **narrator profile at campaign creation**; **copy `voice_json` on fork**
  (`:2634`)
- `rpg-prompts.js` — NPC `voice_mood`, constrained to the enum
- `rpg-state.js` — validate `voice_mood` against the enum (drop off-list values); add `voiceSeed` +
  `mood` to the import whitelist (`:1037`)
- `admin/` — voice provider selection, per-provider key fields, provider-aware voice list
- `test.js` — provider registries, endpoint pin, key isolation, **non-vacuous host+seat route tests**,
  the audio-boundary seat guard, fork/import round-trip
- `.agents/decisions.md`, `plan.md` — already recorded

### Process

Code, so it goes through `.agents/playbooks/reviewloop.md` with codex (decision 2026-07-12), and
**this plan is review-accepted before implementation begins**. Sequencing against Phase CT: the two
are independent (CSS vs voice) and touch disjoint files; take them one at a time to keep the loop's
one-finding-one-branch discipline, owner to set the order.

---

## Phase CT: Theme colour format — store colours, not loose components (promoted 2026-07-14, owner go)

Not a feel phase: the change is **intended to be visually invisible**. It is a correctness phase that
removes a defect *class*, and it deletes ~400 lines of test code rather than adding any. No playtest
gate.

> **"Pixel-identical" is an INTENT, not a gate** *(cold review: the word implied a rigour nothing in
> this repo can deliver — there is no browser harness, no baseline screenshots, and no pass/fail
> criterion, so a cold agent cannot establish pixel identity and would either fake the claim or
> stall)*. The **actual gate** is: (a) the pinned 25-entry alpha table asserted in `node test.js`;
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

9. **`test.js` — DELETE the scanner.** Remove `testThemeVarConsumers` and every helper it owns
   (`blankCssComments`, `blankHtmlComments`, `mapOutsideRawText`, `decodeHtmlEntities`,
   `prepareHtml`, `HTML_NAMED_ENTITIES`, `extractCssVarNames`, `findMatchingParen`,
   `collectVarAliases`, `mergeAliasMaps`, `resolvesToThemeTriple`, `findInvalidThemeRgbConsumers`,
   `themeConsumerTargets`) plus its `runAll` registration.

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
  **this repo has NO browser harness** (`.agents/state.md`, and T2 r6→r7 explicitly declined to
  build one), so that gate was unimplementable, exactly the trap T2's r5-3 finding named. Second,
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
  > left blank lines behind to preserve numbering, which is absurd. **Key by stable identity
  > instead**: the `(selector, property, variable, percentage)` tuple, or ordered occurrence. The
  > line numbers in the table are a **human navigation aid only — never the assertion key.**

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
  **Safari/WebKit 16.2** (Dec **2022**), **WebKitGTK 2.38** (Sep **2022**). *(r2 correction: the
  previous draft said "all 2023" — false for the two WebKit floors.)* Cite the compatibility source
  in `README.md` rather than implying the floors were tested here.
  The web path is canonical (plan.md Dev Tooling), so the minimum is a **product statement**: record
  it in `README.md`. Then run smoke checks — and label them as such — on a current Chromium, a
  current Firefox, and the Tauri shell of the implementing machine.
- **If a target engine fails, the pre-baked fallback is a SEPARATE, SEPARATELY-REVIEWED SLICE — not
  a sentence in this plan** *(r1)*. It is not "more variables": it is **18 distinct
  primary/secondary/panel alpha levels × 6 theme blocks ≈ 108 definitions**, plus writes on **both**
  `app.js` writer paths (:1603-1618 and :1621-1631) and `THEME_VAR_NAMES` upkeep — and if any of
  that is missed, generated themes silently inherit stale or default translucent colours. Do not
  attempt it as an afterthought inside this phase.
- Mis-mapping a single alpha (`0.45` → `45%`) silently changes one surface's translucency. **The
  pinned 25-entry table, asserted in `node test.js`, is what catches it** — not eyeballing.
  *(r3: this line previously also demanded "the computed-style diff", which the Success metrics
  section correctly **withdraws** as unimplementable — no browser harness — leaving a cold
  implementer with two contradictory gates. There is exactly ONE gate for this risk: the table.)*

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

- **Finding id / branch / base.** This phase lands as finding **`ct-1`** on branch
  **`fix/ct-1-theme-colour-format`**, cut from **`master`**. Base = `master` at the time of cutting.
  *(The cold review flagged that the plan's own pinned SHAs sat on `fix/css-2-scanner-scope` — the
  branch this plan forbids merging. That is now resolved: all plan/decision/state commits were
  rescued onto `master` (merge `88e6324`), and the poisoned branch keeps only its three code
  commits. **Never base implementation on `fix/css-2-scanner-scope`.**)*
- **One finding ↔ one branch ↔ one verdict** still holds, even though CT *closes* css-2 and css-3.
  Those are closed as **records**, not as code branches: css-2 is abandoned (branch never merged,
  deleted after CT lands) and css-3 is superseded (never branched). `ct-1` is the only branch.
- **Close-out ordering** *(cold review: the previous text was circular — it asked for reviewer
  verdicts and commit SHAs inside the same pre-review commit that produces them)*. Sequence:
  (1) the atomic code commit on `fix/ct-1-theme-colour-format`; (2) reviewloop dispatch and verdict;
  (3) a **separate** docs commit recording the verdict and closing out css-2/css-3/index. Do not
  attempt to write a verdict you do not yet have.
- **Prerequisites a cold agent will not otherwise know**: run the suite with
  `AI_RETRY_BACKOFF_MS=10 node test.js`; run the app with `node server.js` (port 3000); the desktop
  shell is `npm run desktop` after `cargo build` in `desktop/src-tauri`. **There is no browser test
  harness** — do not plan any check that needs one.
- **Theme fixtures WITHOUT AI credentials** *(cold review: campaign creation calls the Setup AI, so a
  cold agent with no key cannot exercise the writer at all)*. Both writer paths are reachable purely
  through `public/theme-vars.js` (step 5) — that is the point of extracting it. Pin two fixtures in
  `test.js`:
  - **full generated theme** — `colors` **with** a `text` slot → exercises the body-level map,
    including `--theme-text` and `--theme-text-dim`;
  - **legacy** — `colors` **without** `text` → exercises the root-level map, which sets no text vars.
  Neither needs a browser, a server, or a provider key.
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

Per the 2026-07-12 decision this is code and goes through `.agents/playbooks/reviewloop.md` with
codex. **The plan itself is reviewed and accepted before implementation begins.**

**Ship as ONE atomic slice** *(r1 endorsed)*: splitting definitions from consumers creates a broken
intermediate state, and no smaller format change removes loose components while keeping runtime
translucency. The single exception is the `color-mix` fallback above, which becomes its own slice
*if* it is ever needed.

The abandoned `fix/css-2-scanner-scope` branch is NOT merged (it crashes the suite and rejects valid
CSS); it is retained only until this phase lands, then deleted.

---

## Progress Log

**Phase 0 — Initial Prompt & Data Changes (completed first pass)**
- Strengthened "Interactivity" rule in `rpg-prompts.js` with explicit table-conversation priority, strict classification guidance, and mandatory scene_grounding behavior on clarification turns.
- Added `scene_grounding` field to the expected JSON schema in the main DM prompt.
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

**Interactive verification in progress** (started 2026-06-05):
- (Side improvement during session) Added full first-class support for xAI Grok provider (`grok` / `XAI_API_KEY`). Since you already had an xAI key in the environment, you can now select "xAI Grok" in the in-app AI Settings (or set `AI_PROVIDER=grok`) and use it for the clarification playtest. Grok tends to be excellent at the strict "table talk vs committed action" distinctions we hardened in Phase 0. Server was restarted with the new code.
- Live server running on http://localhost:3001 with persistent log monitor active in this session.
- Added explicit `[CLARIFICATION]` console logs + extra defensive zeroing (dice_rolls) in both the single-model post-processing block and the Council `noStateChange` path in runMultiAgentTurn. These will be visible in real time in the agent monitor when the user submits questions.
- Added belt-and-suspenders safety net *inside* `validateTurnData` (rpg-state.js): when input_kind==='clarification', it forcibly zeros character/quest/ability/NPC/memory/dice changes regardless of what the raw model JSON contained. New unit test assertions cover scene_grounding preservation + the forced no-op.
- Awaiting user to open the UI, configure an AI provider + key in Settings, start a fantasy campaign with an ambiguous multi-creature scene, and submit the exact test inputs from the original complaint: "which goblin is closer?" and "can I throw my dagger at it?" (plus 1-2 follow-ups).
- Will capture outputs, check for `sceneGrounding` "Current Situation" block, direct non-advancing answers, zero state mutations on clarification turns, and correct `input_kind`.
- If good for several back-and-forths, mark Phase 0 complete + commit. If not, refine prompts + re-test immediately per the "review after each phase" rule.

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
- **Dice before narration (committed-action branch design, added 2026-06-11 from playtest evidence).** Dice rolls are a service the GM consumes, not a post-processing step. Flow: the adjudicating side of the Council (Referee, informed by Continuity's story/world knowledge — the agent that "knows what's around the next twelve corners") decides which checks the action requires (attribute, DC, stakes, failure consequences) under the campaign's rules; the engine rolls deterministically in code; the results are written into the turn record; only then does the narrator receive the resolved facts and write prose that reflects the actual outcome. This replaces today's inverted flow where `performDiceCheck` keyword-matches the player's text, rolls *after* the narrative is generated, and hardcodes a 5-10 HP penalty appended post-hoc — which produces narrative dissonance, applies damage even to referee-denied actions, and leaves the DM unable to explain its own mechanics (see decision 2026-06-11 "DM omniscience"). Failure consequences become adjudicator decisions under campaign rules, not engine constants. Roll records must be visible to later clarification turns. Playtest evidence (2026-06-11, campaign 1): keyword matching produced intellect checks for "head down the lower path" and "proceed cautiously toward the rustling sound," every committed action triggered a roll regardless of triviality, and all five failed (DCs 10-18), costing 33 HP for actions as mundane as walking — the adjudicator's first decision must be *whether* a check is warranted, under a recorded ruleset the model can apply without drifting (see the ruleset consistency topic).
