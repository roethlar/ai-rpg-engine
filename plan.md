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
- Full combat grid / tactical combat system
- ~~New AI image generation~~ — superseded 2026-07-03 by the image-seam decision
  (`.agents/decisions.md`) and promoted into the Visual Phases above; the
  original caution survives as scope discipline: images are set pieces behind a
  provider seam, not per-turn dependencies, and the game stays fully playable
  with no image provider configured

## Future Topics for Discussion (not yet scheduled)

Raised during planning but deliberately deferred. **Per project rule, nothing here may be implemented until it is promoted into a concrete phase with planned entries.**

- **Owner/player settings split & simple auth.** AI provider config is server-owned (see decision 2026-06-11 in `.agents/decisions.md`); the open question is the mechanism. Leading idea: a separate `/admin` URL — not linked from the game UI — gated by a master password distinct from any per-player credentials, where the owner manages provider/model/keys (and model-name entry UX, e.g. presets/datalist, lives there too). Implies an eventually-real, if simple, auth system: players will need credentials to protect/reclaim their persistent characters once the game is hosted publicly, so per-player auth and owner auth should be designed together rather than bolted on twice. Current single-key UI is acceptable while operator and player are the same person.

- **Model fallback tiering on transient provider errors.** Provider overload (e.g. Gemini 503) must never surface as a raw error in the DM's voice, and the DM cannot "take a break" — that kills the session. Direction: retry once, and/or fail over to a configured backup model per request. Open questions: how backup tiers are configured (depends on the owner-settings design above), and how failover interacts with Council role separation — a mid-chain model swap must not muddy the separation of duties or change adjudication behavior within a single turn. Frontend should restore the player's input and present transient failures as retriable, outside the DM's voice.

- **Spells, abilities & ruleset consistency — PROMOTED 2026-07-03** (decision in
  `.agents/decisions.md`: selectable at campaign start, lightweight house system
  as default, open-source systems as later options). First-cut implementation:
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

**Review Process**: After completing each phase, we will test a full play session together, gather feedback, and only then move to the next phase. No code will be merged until it demonstrably improves the playing experience.

**Current Priority** (2026-07-09): the remote two-human multiplayer playtest itself. App-side readiness (S2 seat-scoped visibility, S3 seat bootstrap/mint flow, README) landed 2026-07-09 — suite green (25 groups, leak guards proven), API-level live smoke clean; the two-browser end-to-end is exactly what the playtest exercises. Remaining before play: owner sets ACCESS_SECRET + ADMIN_SECRET, exposes the server (owner-handled), mints seats. The playtest is the pending close point for the open feel gates.

This plan will be updated as we learn from implementation and playtesting.

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
