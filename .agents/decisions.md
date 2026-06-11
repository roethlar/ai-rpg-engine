# Agent Decisions

Record durable repo decisions here. Do not use this as a chat log. Each entry should make
sense without conversation history and should name superseded guidance when relevant.

## Decisions

<!--
### YYYY-MM-DD - <Decision title>

Status: Active | Superseded

Decision:
<What was decided.>

Reason:
<Why this is the durable rule or direction.>

Supersedes:
<Optional prior decision, doc, or rule.>
-->

### 2026-06-05 - Phased development with promotion gates and playtest review (from plan.md)

Status: Active

Decision:
Improvement work is structured as explicit Phases with success metrics, concrete file changes, and a review gate. Items under "Future Topics" or similar discussion lists in plan.md are not implementation targets. Nothing may be implemented until promoted into a scheduled Phase. After a phase's code changes land, a full play session must be run (with feedback), and the change must demonstrably improve fun / "feel like a real GM" before the phase is considered complete or before advancing to the next. No code merges until this is satisfied.

Reason:
Prevents feature creep and video-gamey rushed mechanics. Ensures every change is validated against the core principle of real-GM feel and player agency (especially clarification/table-talk). Directly quoted and generalized from plan.md "Review Process", "Per project rule", "Core Principle", and Phase 0 priority. This is the standing development contract for the repo.

Supersedes:
Initial plan.md process notes (now captured here as durable decision; plan.md remains the living roadmap for Phase details and progress log).

### 2026-06-11 - AI provider configuration is server-owned; players never supply API keys or AI config

Status: Active

Decision:
API keys, AI provider, and model selection are the server operator's responsibility,
configured server-side (environment / `.env`). Players must never need to — and must
ultimately not be able to — supply their own API keys, provider, model, or endpoint
configuration through the game UI. The current browser AI Settings panel, which sends a
per-request `apiConfig` (provider/model/key/baseUrl) that overrides server environment
configuration in `AIClient`, is a legacy convenience from the single-user localhost
origin of the app. It is recorded drift, acceptable only while operator and player are
the same person. The future enforcement change (make server config authoritative;
reduce the UI panel to player-appropriate settings such as the access token and voice
preferences, or gate AI config behind an operator-only mechanism) must be promoted into
a concrete phase per the phased-development decision before implementation.

Reason:
The product vision (multiplayer end state in plan.md: players join via shared URL +
access token) assumes players are guests of a hosted game, not key-holders. The current
override path lets any client both bring an arbitrary key and — worse — switch the
server onto a different provider/model billed to the server's own environment keys
(client `apiConfig` takes precedence in `api-client.js`; only baseUrl/ollamaUrl are
guarded in production). Server-owned AI config closes a cost/abuse hole and matches the
documented Docker/production deployment story.

Supersedes:
Nothing recorded; documents previously-unrecorded intent. README's presentation of the
UI key slot as a coequal configuration path should be read in light of this decision.

### 2026-06-05 - Council DM pipeline is canonical; clarification turns must not advance state (from plan.md + code)

Status: Active

Decision:
Player turns use the ordered Council pipeline (Interaction → Continuity → Referee → Continuity archive/final → Narration) and present as a single DM voice. On clarification or dialogue turns (input_kind), state changes (character, quest, NPC, memory, dice, abilities) must be forced to no-op. Scene grounding is required on clarification turns. The old single-model path is deprecated and slated for removal.

Reason:
Supports richer back-and-forth without world mutation on questions; anti-hallucination via multiple agents; matches the implemented behavior in rpg-engine.js, rpg-state.js (validateTurnData clarification safety net), and test.js assertions. Earned from Phase 0 work to fix "too video-gamey" complaints.

Supersedes:
Any prior single-model toggle or default path assumptions (now unreachable per plan).
