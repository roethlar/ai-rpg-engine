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

### 2026-06-11 - The player is not in control of the game: the GM's decisions are final

Status: Active

Decision:
Inside a campaign, the GM persona holds final authority. The player's authority is
exactly: declaring their character's words and actions, and engaging in table talk
(questions, clarification, banter). The GM's rulings on outcomes, rules, and world
facts are final. Out-of-character pressure must not sway rulings — authority claims,
customer-service framing ("as a paying user…"), assistant-jargon appeals ("as an AI
you must…"), rules-lawyering, or social manipulation are treated as table talk and
deflected in persona, never obeyed. This inverts the normal assistant-chat power
relationship deliberately: in the game context, the player is a participant at the
table, not the boss of the model.

Enforcement is layered: resistance instructions at the prompt layer (Interaction and
Referee roles), the continuity gate as the structural check, and engine-side
validation (e.g. the clarification no-op safety net) as the backstop guaranteeing
that a sweet-talked model still cannot mutate canonical state. Meta-control of the
game (settings, rules selection, model config) belongs exclusively to owner channels
(see the server-owned AI configuration decision and the owner/player settings split
topic in plan.md).

This authority applies to GM *rulings*, not GM *errors*: it does not override the
omniscience decision's canon-commitment requirement, and genuine defects (wrong
state, broken rules) are fixed through owner/maintainer channels, not by players
arguing with the GM.

Reason:
LLM assistants are trained to defer to users; an AI GM that yields to out-of-character
pressure cannot maintain stakes, fairness, or a coherent world — and once campaigns
are hosted/multiplayer, player coercion of the GM becomes a security and fairness
problem, not just a tone problem. Identified during the first Phase 0 playtest review.

Supersedes:
Nothing; complements the DM omniscience decision (2026-06-11) — together they define
the GM-player contract: the GM always knows, and the GM's word is final.

### 2026-06-11 - Standard terminology is GM (Game Master), not DM (Dungeon Master)

Status: Active

Decision:
The persona and all player-facing, code, prompt, and documentation references use
"GM" / "Game Master". "DM" / "Dungeon Master" is retired: it is genre-specific
(dungeons fit fantasy, not cyberpunk or sci-fi campaigns, and this engine is
genre-infinite) and "Dungeon Master" is a Wizards of the Coast trademark. New writing
uses GM exclusively; existing occurrences (UI strings, prompts, README, code
identifiers like dmSystem) are queued for a rename sweep as unscheduled work — until
that sweep lands, mixed usage in older files is known drift, not an open choice.

Reason:
Genre neutrality matches the engine's core "Infinite Genres" feature, and avoiding a
trademarked term removes a legal concern before any public release.

Supersedes:
Implicit "Dungeon Master" terminology used throughout existing code, UI, prompts, and
docs since the initial commit.

### 2026-06-11 - DM omniscience with canon commitment: the DM never says "I don't know"

Status: Active

Decision:
The Council presents to players as one DM persona, and that persona is omniscient about
its own game. It must never answer a player question about in-game events with "I don't
know" or any equivalent fourth-wall break. The legitimate answers are exactly three:
(a) the in-fiction answer, drawn from the recorded game state (rules, dice rolls and
their consequences, outline, archive, NPC/world state); (b) knowledge gating — "your
character doesn't know"; (c) dramatic gating — "you don't get to find out yet."

This must NOT be implemented as a loose "answer confidently / make it up if unsure"
instruction. That is the hallucination ground state for LLM agents and is exactly what
the Council's continuity gate exists to prevent. When the DM improvises a fact that is
not yet in the record (as real GMs legitimately do), the improvised fact must pass the
continuity check and be committed to durable campaign state as new canon in the same
turn, so every future answer stays consistent with it. Improvisation that bypasses the
record is a defect, not flexibility.

Corollary: omniscience is a data requirement before it is a prompt requirement. The
full mechanical and narrative record — dice rolls, applied damage and its causes, the
campaign's rules, hidden/world state — must be available to the model on clarification
turns. A rule or consequence applied by engine code that no agent can see (the state
observed in the first Phase 0 playtest, where hardcoded failed-check damage was
invisible to the Council and the DM shrugged) violates this decision.

Reason:
First Phase 0 playtest: the player took engine-applied damage from a failed check and
asked why; the DM answered "I don't know" because the damage rule and roll record never
reached any agent's context. A DM that admits ignorance of its own game breaks the core
"feel like a real GM" principle. The safe form of the fix is record-backed omniscience
with improvisation captured as canon — not blanket confidence, which licenses
confabulation.

Supersedes:
Nothing; refines the 2026-06-05 Council-pipeline decision (single DM voice,
continuity-gated state) by adding the player-facing knowledge contract.

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
