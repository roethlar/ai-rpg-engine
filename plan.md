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

- Make narration richer, more atmospheric, and less mechanical.
- Improve scene visualization (replace weak SVG with better procedural generation or hybrid image approach — defer decision until after Phase 0).
- Better handling of NPC voices and relationships in narration.

## Phase 2: Voice of the Council

- Expand current TTS (OpenAI) to support multiple character voices per turn.
- Give the DM a consistent persona/voice style that persists across a campaign.
- Allow emotional tone directives from the Council pipeline to influence TTS parameters.

## Phase 3: Character & Campaign Foundations for Multiplayer

- Improve the `player_characters` / `characters` relationship so a character can be "active" in only one campaign at a time but easily ported.
- Add optional `initiative` stat to characters.
- Add campaign-level `turn_order` array or simple round tracking.
- UI improvements for selecting/switching active character and viewing multiple character sheets.

**Multiplayer end state vision**: Multiple players can join the same campaign (via shared URL + access token). The DM maintains one shared scene description. Players take turns in declared order. Clarification/table-talk works for everyone. Character progression is persistent across campaigns.

## Non-Goals (for now)
- Real-time simultaneous multiplayer
- Full combat grid / tactical combat system
- New AI image generation (unless it emerges naturally from improving visuals in Phase 1)

## Future Topics for Discussion (not yet scheduled)

Raised during planning but deliberately deferred. **Per project rule, nothing here may be implemented until it is promoted into a concrete phase with planned entries.**

- **Owner/player settings split & simple auth.** AI provider config is server-owned (see decision 2026-06-11 in `.agents/decisions.md`); the open question is the mechanism. Leading idea: a separate `/admin` URL — not linked from the game UI — gated by a master password distinct from any per-player credentials, where the owner manages provider/model/keys (and model-name entry UX, e.g. presets/datalist, lives there too). Implies an eventually-real, if simple, auth system: players will need credentials to protect/reclaim their persistent characters once the game is hosted publicly, so per-player auth and owner auth should be designed together rather than bolted on twice. Current single-key UI is acceptable while operator and player are the same person.

- **Model fallback tiering on transient provider errors.** Provider overload (e.g. Gemini 503) must never surface as a raw error in the DM's voice, and the DM cannot "take a break" — that kills the session. Direction: retry once, and/or fail over to a configured backup model per request. Open questions: how backup tiers are configured (depends on the owner-settings design above), and how failover interacts with Council role separation — a mid-chain model swap must not muddy the separation of duties or change adjudication behavior within a single turn. Frontend should restore the player's input and present transient failures as retriable, outside the DM's voice.

- **Maps & Character Miniatures.** Can the DM Council generate an encounter map and keep it coherent across revisits, so returning to an area isn't foreign? Key requirement identified during discussion: coherence demands *persistent, structured location state* — promote locations to first-class entities with a stored layout (areas, exits, fixed features) plus a mutable occupancy layer; generate once on first entry, load on revisit, and mutate only through the referee/continuity gate (never on clarification turns). A regenerated image cannot do this (image-gen won't reproduce a layout), so it implies structured data + a deterministic render; top-down maps suit SVG, which may keep SVG for maps even after scene illustration moves to image-gen. A map is essentially the persistent, structured evolution of `scene_grounding`. Open fork — how tactical: (a) structured/theater-of-mind zone positions only, (b) visual top-down map + tokens with purely narrative resolution, (c) full tactical grid / VTT with coordinates, movement, line-of-sight. **Tension:** (c) collides with the "Full combat grid / tactical combat system" non-goal above and with the Phase 0 anti-"video-gamey" principle; (b) is the likely sweet spot if pursued.

**Review Process**: After completing each phase, we will test a full play session together, gather feedback, and only then move to the next phase. No code will be merged until it demonstrably improves the playing experience.

**Current Priority**: Begin with **Phase 0 (Clarification/Table-Talk)** as it is the foundation everything else rests on.

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

**Phase 0 — Council Efficiency Refactor (approved 2026-06-05, not yet implemented)**

Recorded here first, so the code is plan-backed before it is written:
- **Branch the Council on `input_kind` after the Interaction Agent.** `clarification` and `dialogue` take a **2-call path**: (1) the Interaction Agent answers the question and classifies it, (2) a single grounding/continuity verifier independently checks that answer against game state (anti-hallucination / anti-drift) and emits the final player-facing JSON with all state forced to no-op. `committed_action` keeps the **full chain** (Interaction → Continuity → Referee → Continuity-Final → Narration), because only it mutates state. Rationale: a question should not cost 5 LLM calls — today the Referee and Continuity-Final are forced no-ops on clarification turns, pure overhead. The independent verifier preserves the anti-hallucination guarantee while halving the call count for table-talk.
- **Delete the dead single-model path.** `isMultiAgentModeEnabled()` hardcodes `true`, so the single-model branch in `takeTurn`, its unused client, and the toggle are unreachable. Remove them; the Council becomes the only path. Fold the one correct behavior currently living in that block (resetting `quest_update` to the *real* active quest on clarification) into the verifier so it isn't lost.
- **Success check:** clarification still produces zero state mutations and a useful `scene_grounding`; committed actions still adjudicate normally; all existing tests pass.
