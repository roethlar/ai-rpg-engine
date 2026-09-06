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

### 2026-07-27 - Rules Chapter 2 effect catalog is signed off

Status: Active

Decision:
Chapter 2 r24 (`docs/rules/effects.md`) is the owner-signed canonical D2 effect vocabulary,
substantively pinned at `6772d33ca2026bf14c26bf518a280b54e88e9061`. Sign-off accepts §3's
conservative pre-D7 encounter input, §4's minimal/optional contextual-suggestion interpretation,
and the three declared Chapter 1 refinements: Continuity-owned `affirmedOpposed` plus
engine-stamped resolved metadata, typed engine-issued entity references as identifiers rather than
arithmetic, and `neutral` valence outside edge-band authorization. This closes the D2 design gate;
rules code still requires a concrete phase and owner-approved plan.

Reason:
The owner approved the complete sign-off surface on 2026-07-27 after the r28 repair-delta review
closed with zero findings and judged the chapter cold-implementer-executable.

Supersedes:
Chapter 2's draft/awaiting-owner-sign-off status, the unresolved §4 assembler flag, and records
that still describe an accepted effect catalog as an unmet D2 prerequisite.

### 2026-07-26 - Abandon the greenfield runtime rewrite; improve the shipped engine incrementally

Status: Active

Decision:
The cost-first greenfield runtime rewrite is abandoned and must not be implemented. The shipped
Council pipeline remains the canonical player-turn architecture. Product development continues
incrementally on that architecture, with rules, UI, mapping, and related improvements proceeding
through the repository's normal plan and verification gates.

The discarded proposal is retained only as historical design evidence at
`docs/history/runtime-greenfield-plan-abandoned.md`; its reviewed gates, open questions, migration
posture, and claims of authority over prior rules or runtime decisions create no current
obligations.

Reason:
Owner direction 2026-07-26: **"scrap the greenfield plan. we're sticking with what we have. what I
want to do is continue rules and UI updates, mapping, etv."**

Supersedes:
The 2026-07-18 greenfield mandate, the runtime greenfield plan, and any current-state wording that
treated that proposal as the next implementation track. Its review trail remains historical
evidence only.

### 2026-07-26 - Cross-harness review is opt-in

Status: Active

Decision:
Independent planning and review dispatches are disabled by default. An agent must not invoke
Claude, Grok, Codex, or another external reviewer for a plan or code change unless the owner
explicitly requests `codereview`, `review`, `openreview`, or otherwise explicitly names the
reviewer for that work.

Code changes still require an owner-approved plan and the repository's normal verification under
`AGENTS.md`, but they do not require an independent review verdict before implementation, commit,
or landing. The installed review playbooks remain available as opt-in workflows. Historical plan
language and review records remain evidence of the workflows that produced them; they do not
authorize a new external reviewer dispatch.

Reason:
After an automatic Claude planning dispatch was attempted solely because of the standing
reviewloop rule, the owner directed on 2026-07-26: **"flip that rule to off."**

Supersedes:
The 2026-07-12 unconditional reviewloop requirement, the 2026-07-14 default division of review
labour, and the 2026-07-15 Claude Fable reviewer default. Historical verdicts remain valid, and a
future explicit owner request may opt a specific task into a review playbook.

### 2026-07-15 - Admin AI configuration is a provider/model registry with per-role primary and fallback assignments

Status: Active

Decision:
The `/admin` AI configuration surface is rebuilt around three separate concerns:

1. A compact provider-connections table owns each provider's shared/default API key and its
   operator-supplied endpoint where applicable.
2. A reusable configured-model registry owns a label, provider, exact model id, and either the
   provider's shared key or a model-specific key override. Multiple models from one provider may
   share its key; the same configured model may serve multiple Council roles.
3. A Council assignment table gives each of Setup, Interaction, Continuity, Referee, and Narration
   one primary configured model and one optional fallback configured model. Secrets and provider
   fields do not repeat in the role table.

Model selectors are populated live from the selected provider where its API supports discovery, but
remain editable combo boxes so a failed catalog request or an unlisted/custom model never blocks
configuration. Existing environment-only operation remains supported.

`claude-code` is also a supported text provider. It authenticates only through the Claude Code
login available to the server process; it has no provider API-key field and no per-model custom-key
override. Its model field accepts any alias or full model id available to that logged-in plan. When
Claude Code does not expose a documented machine-readable model catalog, the field remains plain
editable text and the provider row reports install/login/plan status instead of pretending that a
hard-coded list is live. Selecting this provider changes only the transport used by `AIClient`; the
Setup and Council pipelines, role assignments, retry, and fallback behavior remain unchanged.

Owner wording (2026-07-15): **"there should be a table of providers w/ API key and model selector
(populated live from the provider where possible). multiple models from single providers CAN share an
API key, or they can take custom keys. Then, each configured model entry is assigned to a council role
via a clean interface."** Follow-up decision: each role selects both a primary and an optional
fallback; the old single global fallback is migrated across all five roles. Claude Code extension
wording (2026-07-15): **"what I want is a claude-code provider as an option. model selection is
whatever's available to the logged-in plan or plain text entry if that's not possible. don't
restrict it to fable."**

Reason:
The existing page repeats a full provider/model/key form for the primary tier, every Council role,
and the global fallback. It conflates credentials, reusable model choices, and runtime assignment,
making the page oversized and making shared credentials look like duplicated configuration. The
registry makes those relationships explicit and keeps credential inheritance server-owned.

Supersedes:
The catalog-only `/admin` plan in `plan.md` (2026-07-12), which added datalists to the repeated forms
without changing their structure, and the UI/storage shape of one global fallback tier. The runtime
guarantees behind fallback-on-transient-error, provider-scoped key isolation, environment fallback,
and server-owned configuration remain active.

### 2026-07-14 - The GM narrator is campaign-canonical; synthesis is shared across players

Status: Active

Decision:
Each campaign has one server-resolved GM narrator identity. Host and seat clients may enable or
disable narration locally, but they do not choose a different narrator voice, accent, or free-text
direction. `campaigns.narrator_voice_json` is authoritative; the active TTS provider maps that
logical narrator to its reserved voice (`leo` for Grok, `marin` for OpenAI).

Identical canonical narration requested by multiple players is synthesized once upstream and reused
from a bounded server-side in-flight/completed cache. Multiplayer may deliver the same audio bytes to
several clients, but it must not multiply provider calls for the same campaign narration.

Reason:
Owner wording (2026-07-14): **"one GM voice. no compounded API costs because one player likes an
Australian accent."** A per-browser narrator preference makes the GM's identity vary by listener and
forces distinct paid synthesis. Voice identity is campaign state, not a player presentation choice.

Supersedes:
The current player-side voice-name and free-text Voice Direction controls, and Phase V draft wording
that preserved those preferences for narrator lines.

### 2026-07-14 - bh-1 browser harness: plan ACCEPTED after seven review rounds; codex implements

Status: Active

Decision:
The bh-1 browser-harness plan (plan.md → Dev Tooling) is APPROVED for implementation. Owner
2026-07-14, asked whether to keep hardening the plan or let codex implement it: **"Let codex
implement."** codex implements from the plan; Claude adversarially verifies (the standing workflow —
codex cannot review what codex wrote).

The plan survived seven adversarial review rounds (r1–r7: 9, 11, 10, 7, 4, 10, 9 findings; all
closed). The design has passed five consecutive rounds — since r4 not one finding has been against
the oracle; all have been about whether the *guard proofs* discriminate a wrong implementation. That
loop is real but extensible without bound, and the owner priced it: implement now, and let the
implementation review — which has actual code to run the proofs against — catch the rest.

Reason:
The design is validated by EXECUTION, not argument. Every mechanism was run against a real Chromium
and the real stylesheet before being written down: on master it measures 186 var-bearing
declarations, 294 assertions, 0 failures, and each sabotage case is confirmed caught in all six
theme contexts. That is stronger evidence than any further round of review reasoning could produce —
and the remaining open questions ("could an implementation that omits this mechanism still pass this
proof?") are answerable for real once code exists, rather than hypothetically.

### 2026-07-14 - Do not reason about CSS in this repo. Execute it.

Status: Active

Decision:
Any claim about CSS or CSSOM behaviour in this repo must be settled by running a browser, not by
reasoning — including claims made by a code reviewer, and including claims that appear obviously
correct. Where a plan or review asserts browser behaviour that has not been executed, it must say so
explicitly and be treated as unverified.

Reason:
THREE separate bh-1 review rounds produced a careful, confident CSS claim that a real browser then
refuted. The worst nearly shipped a harness that would have reported green on the exact bug it
exists to catch:

  A `var()` inside a SHORTHAND makes that shorthand's longhands "pending-substitution" — CSSOM still
  enumerates them, but `getPropertyValue()` returns the EMPTY STRING for every one. css-1 was
  `background: rgba(var(--theme-panel), 0.7)` — a `background` shorthand — so a collector that reads
  declaration values by index sees NOTHING for it. Measured: such a collector finds 115 var-bearing
  declarations where the correct one finds 186.

The r2 reviewer reasoned explicitly that the design WOULD catch css-1. It would not have. A
scratchpad browser probe found it in minutes. Two further rounds repeated the pattern (an
`!important` prediction that Chromium refutes; a cascade-guard exemption that a browser showed to be
a real false pass).

This is the same root cause as the css-2 saga (`docs/history/css-2-abandoned-scanner.md`): nobody
could see what the browser was doing. It is why bh-1 exists.

### 2026-07-14 - A guard proof must fail if its mechanism is removed

Status: Active

Decision:
Every guard proof must be checked against one question: **could an implementation that OMITS the
mechanism this proof exists to protect still pass it?** If yes, the proof is decoration and must be
replaced. This applies to the guard proofs themselves, not only to the code they guard.

Reason:
Applying this question to the bh-1 plan found real holes in FOUR consecutive review rounds:
- Three load-bearing mechanisms (the cascade guard, generic rule recursion, the `@import` branch)
  could be omitted entirely while every guard proof still passed.
- The `unset` control — the single most load-bearing decision in the design — was proved by NOTHING:
  all 19 proofs passed with the rejected bare control too.
- One "guard" tested a shape that turned out to be HARMLESS, so a lenient implementation passed it
  and still shipped a false pass.

This generalizes the vacuous-guard anti-pattern already recorded in `.agents/playbooks/codereview.md`
(a test that re-implements the logic it checks) to a second form: a test that passes against the
wrong implementation. Both are guards that cannot fail.

### 2026-07-14 - Grok Imagine is out for NPC and location imagery; TTS is the provider priority

Status: Active

Decision:
Grok Imagine will **not** be used for NPC or location images. It exposes no seed, and the
image seam has carried an *identity anchor* since day one (owner direction, `image-providers.js:9-13`):
callers record the returned seed and replay it so a given NPC or place stays visually
consistent across renders. A provider that cannot hold that anchor cannot serve those
subjects. Owner wording (2026-07-14): "if we can't keep the same image base for NPCs &
locations then grok imagine is out for that."

Maps were raised as a possible exception, on the reasoning that a map does not change once
drawn. This is NOT decided and is not a licence to implement: maps today are **deliberately
AI-free** — `map-render.js:3` renders a top-down SVG with "no AI in the render path", and the
SVG inherits the campaign's CSS theme variables. Putting Grok Imagine behind maps would *add*
AI to a path intentionally kept free of it, and would forfeit theme inheritance. Treat it as
an open Future Topic requiring its own promotion, not as an approved slice.

Instead, **TTS is the priority**: the owner found the OpenAI implementation unimpressive —
"it sounded unnatural and had no variance for accents or mood" (2026-07-14).

Reason:
Visual identity persistence is a *feel* property, and feel is this repo's stated bar
(`.agents/repo-guidance.md`: every change must improve fun and feel like a real GM). An
image provider that silently re-rolls an NPC's face each turn degrades exactly that, however
good each individual frame looks. Grok Imagine's reference-image (image-to-image) support was
considered as a substitute anchor mechanism and left unexplored rather than adopted, because
it is a design change to the seam, not a drop-in provider.

**Provider choice, settled by listening test (owner, 2026-07-14): GROK TTS WINS.** Owner wording:
"grok tts wins. it's just that much better. when openai releases a 5o model I will revisit, but for
now it's grok." Decided by ear on a controlled A/B — the same lines, the same GM instruction the
engine actually sends (`server.js:742`), OpenAI's real configured path (`marin` /
`gpt-4o-mini-tts`) against Grok — not from documentation or vendor claims.

**Shape: Grok is ADDED ALONGSIDE OpenAI, not swapped in destructively** (owner, 2026-07-14). Grok
becomes the provider of choice; OpenAI stays registered and selectable in `/admin`. The TTS seam
was built for exactly this (`tts-providers.js:5`: "new providers … register here … and become
selectable in /admin"). Reasons this is not a straight replacement: the owner intends to revisit
if OpenAI ships a stronger model; OpenAI exposes free-text steering that can request an accent,
although the owner found its delivery flat and did not accept it as an effective accent feature; and
a provider that disappoints in a real session must be revertible without a code change.

**Grok TTS capabilities — VERIFIED BY EXPERIMENT against the live API, 2026-07-14.** Recorded
because a handed-over plan document (`~/Dev/grok_api_updates.md`) got most of this wrong, and
because Grok *itself*, asked about its own API, also got it wrong. Neither is evidence. The API is.

- **Endpoint** `POST https://api.x.ai/v1/tts`. Body: `text`, `voice_id`, `language` (required),
  `output_format`, `speed`. Returns raw audio bytes. There is **no free-text steering field** —
  no equivalent of OpenAI's `instructions`.
- **26 built-in voices** (19 male, 7 female, multilingual), listable at `GET /v1/tts/voices`.
  NOT the "21 flagship voices" the handed-over doc claimed, and not the five the published docs
  page lists. `orion` is real. This is more than double the 12-voice OpenAI NPC pool in use today.
- **Voice cloning** exists (`POST /v1/custom-voices`, cap **30**). Ruled impractical by the owner:
  it needs a reference recording per character.
- **Inline delivery tags WORK** (`[whispers]`, `[laughs]`, `[angry]`, `[tense]`, …). Proven two
  ways: the tag words do not appear in a Whisper transcript of the output (so they are not read
  aloud), and `[laughs] You actually did it!` transcribes as "Haha, you actually did it!" — the
  model produced an actual laugh. The vocabulary is open-ended: `[angry]` works and is not a
  documented example. Owner confirmed by ear: tense and whisper are clearly distinct from joy.
- **Grok accents DO NOT work.** There is no accent parameter, and an `[accent]` tag does not
  meaningfully change the voice (owner, by ear, 2026-07-14, on an A/B of the same line and voice).

Net: Grok trades OpenAI's free-text steering (which can request accents, but did not meet the
owner's feel bar) for 26 timbres plus working delivery tags. The owner's design — one voice for
the GM, the rest cycled across NPCs with a habitual mood per character — is viable on Grok, and
maps onto per-NPC voice-directive and per-line tone fields the engine already computes.

Historical pre-Phase-V blocker, closed by v-1 through v-3: the voice layer was structurally
OpenAI-coupled. `tts-providers.js:10` pinned `TTS_VOICES` to OpenAI voice names and
`validateVoiceProfile` coerced anything outside that set to `'marin'`; `NPC_VOICE_POOL` (:35)
was all OpenAI voices and `assignNpcVoiceProfile` stamped `provider: 'openai'` and persisted the
voice into `npcs.voice_json`. A naive Grok registration would therefore have received an OpenAI
voice id and failed. Phase V replaced those contracts with provider registries, portable seeds,
legacy compatibility, and server-side provider-aware resolution. The seam had anticipated this
(`tts-providers.js:5`: "new providers (e.g. voice-cloning services for unique NPC voices)
register here"), but the old voice *pool* had not.

### 2026-07-12 - Rules D0: a fixed house chassis, with generated per-campaign flavor skins

Status: Active

Decision:
The game runs on ONE bespoke rulebook, designed once and versioned. It does not change
per campaign. Each campaign generates only a *flavor skin* over it: the same underlying
move is called a hex in one world, a hack in another, and "fan the hammer" in a third,
but the mechanics beneath are identical every time. Owner wording (2026-07-12):
"one rulebook, many coats of paint — same rules every campaign; the engine can enforce
it; we must design and balance it."

This is D0 in `.agents/review/rules-system-plan-intake.md` and it unblocks D1, D2, D4,
D6, D11, D12 and D14. Two frames were considered and rejected: adopting a published CC0
system wholesale (inherits someone else's complexity, assumptions and feel), and the
status quo of generating a ruleset per campaign (rules drift between turns, players
cannot predict them, and it does not survive multiplayer — this is the failure the rules
question was reopened to escape).

Accepted cost, recorded so it is not relitigated: we own the game design and the balance
work. That is the price of a system players can learn and the engine can enforce.

Reason:
A rules system is only useful if it is predictable to a player and enforceable by code.
Generated-per-campaign rules are neither. A fixed chassis makes the engine the authority
on every number and transition, which is what lets models emit validated identifiers and
enums instead of arithmetic — the load-bearing conclusion of the rules intake.

Supersedes:
The 2026-07-03 first-cut "lightweight house system generated by the Setup role per
campaign" (landed code, described in plan.md). The generated-ruleset half of that is now
dead: setup generates flavor, never mechanics.

### 2026-06-05 - Phased development with promotion gates and playtest review (from plan.md)

Status: Active

Decision:
Improvement work is structured as explicit Phases with success metrics, concrete file changes, and a review gate. Items under "Future Topics" or similar discussion lists in plan.md are not implementation targets. Nothing may be implemented until promoted into a scheduled Phase. After a phase's code changes land, a full play session must be run (with feedback), and the change must demonstrably improve fun / "feel like a real GM" before the phase is considered complete or before advancing to the next.

Clarification from the later, more specific Phase V contract: review-accepted implementation slices
may merge before the feel verdict when an owner-approved phase plan explicitly orders that sequence.
The playtest gate blocks phase completion and advancement; it is not an unconditional ban on landing
every reviewed slice.

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
Nothing; complements the GM omniscience decision (2026-06-11) — together they define
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

### 2026-06-11 - GM omniscience with canon commitment: the GM never says "I don't know"

Status: Active

Decision:
The Council presents to players as one GM persona, and that persona is omniscient about
its own game. It must never answer a player question about in-game events with "I don't
know" or any equivalent fourth-wall break. The legitimate answers are exactly three:
(a) the in-fiction answer, drawn from the recorded game state (rules, dice rolls and
their consequences, outline, archive, NPC/world state); (b) knowledge gating — "your
character doesn't know"; (c) dramatic gating — "you don't get to find out yet."

This must NOT be implemented as a loose "answer confidently / make it up if unsure"
instruction. That is the hallucination ground state for LLM agents and is exactly what
the Council's continuity gate exists to prevent. When the GM improvises a fact that is
not yet in the record (as real GMs legitimately do), the improvised fact must pass the
continuity check and be committed to durable campaign state as new canon in the same
turn, so every future answer stays consistent with it. Improvisation that bypasses the
record is a defect, not flexibility.

Corollary: omniscience is a data requirement before it is a prompt requirement. The
full mechanical and narrative record — dice rolls, applied damage and its causes, the
campaign's rules, hidden/world state — must be available to the model on clarification
turns. A rule or consequence applied by engine code that no agent can see (the state
observed in the first Phase 0 playtest, where hardcoded failed-check damage was
invisible to the Council and the GM shrugged) violates this decision.

Reason:
First Phase 0 playtest: the player took engine-applied damage from a failed check and
asked why; the GM answered "I don't know" because the damage rule and roll record never
reached any agent's context. A GM that admits ignorance of its own game breaks the core
"feel like a real GM" principle. The safe form of the fix is record-backed omniscience
with improvisation captured as canon — not blanket confidence, which licenses
confabulation.

Supersedes:
Nothing; refines the 2026-06-05 Council-pipeline decision (single GM voice,
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
narration on/off preference, or gate AI config behind an operator-only mechanism) must be promoted into
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

### 2026-07-03 - Owner settings live at /admin gated by ADMIN_SECRET; player panel keeps only player-appropriate settings

Status: Active

Decision:
The mechanism for the server-owned AI configuration decision (2026-06-11) is a
separate `/admin` page, not linked from the game UI, gated by a master password
(`ADMIN_SECRET` env var) distinct from the player `ACCESS_SECRET`. All AI
configuration — provider, model, API keys, custom endpoints, voice API key/model,
and fallback tier — is managed there and persisted server-side. The player-facing
settings panel keeps only player-appropriate settings: server access token, voice
narration on/off, and diagnostics. Narrator identity and delivery are campaign-canonical under the
later 2026-07-14 decision; player voice choice and style instructions are superseded.
Client-supplied AI config (`apiConfig` provider/model/key/endpoint fields) is no
longer honored by the server. Following the `ACCESS_SECRET` precedent, an unset
`ADMIN_SECRET` leaves /admin accessible (single-operator localhost dev); production
deployments must set it, and the server warns at startup when it is unset.

Reason:
Implements the enforcement half of the 2026-06-11 server-owned AI config decision
with the "leading idea" mechanism recorded in plan.md's owner/player settings-split
topic, chosen by the owner 2026-07-03. Keys billed to the operator must not be
player-suppliable or player-overridable once the game is hosted.

Supersedes:
The transitional state recorded in the 2026-06-11 decision (client apiConfig
override honored as legacy drift). The full per-player auth system remains a
future topic; ADMIN_SECRET is deliberately independent of it.

### 2026-07-03 - Model fallback tiering: retry once, then backup tier; failures surface outside the GM voice

Status: Active

Decision:
Transient provider errors (network failure, HTTP 408/429/5xx) on any AI call are
retried once against the same configuration after a short backoff. If the retry
also fails transiently and a backup tier is configured (admin panel or
`FALLBACK_AI_PROVIDER` / `FALLBACK_AI_MODEL` / `FALLBACK_API_KEY` env), the single
failing call is re-issued against the backup tier with the same role prompt —
per-call failover, so Council role separation is preserved (a mid-chain swap never
changes which role adjudicates, only which model backs that one call).
Non-transient errors (400/401/403, malformed request) are not retried. Failures
that survive retry+fallback surface to the player as a retriable UI state outside
the GM's voice, with the typed input restored — never as in-fiction GM dialogue
and never killing the session.

Reason:
First playtest pain recorded in plan.md: provider overload (Gemini 503) must not
surface as a raw error in the GM's voice, and the GM cannot "take a break."
Promoted to implementation by the owner 2026-07-03.

Supersedes:
Nothing; implements the "Model fallback tiering" future topic in plan.md.

### 2026-07-03 - Five first-class AI roles, all configurable in /admin; env vars are secondary

Status: Active

Decision:
The engine has five first-class AI roles: setup (campaign outline + opening
scene), interaction (input classification/proposal), continuity (grounding
checks + table-talk verifier), referee (adjudication + dice), and narration
(the final player-facing voice). Narration is separated from interaction and
setup from the primary config so each can run a different model. Every role's
provider/model/key is configurable in /admin (persisted in server_settings)
with precedence: admin role config > role env vars (SETUP_*/NARRATION_* join
the existing INTERACTION_*/CONTINUITY_*/REFEREE_*) > primary config (fields
inherit only same-provider, preserving the cross-provider key-safety rule).
The owner manages configuration through /admin as the primary interface; env
vars remain supported but are not the expected workflow. Per-role custom
endpoints (baseUrl/ollamaUrl) stay env-only for now. Which concrete models to
assign is a playtest A/B call, never hard-coded (2026-06-13 provider-strategy
rule).

Reason:
Owner direction 2026-07-03: "admin needs to have all the options; I abhor
messing with env vars," plus the intent to run a strong model for campaign
creation and a strong prose model for narration while keeping per-turn
classification/verification cheap. The Council efficiency refactor (landed
2026-07-03) was the recorded prerequisite for per-role tiering.

Supersedes:
Narration implicitly sharing the interaction role's model, and setup
implicitly sharing the primary config; env-only per-role routing.

### 2026-07-03 - Rulesets are campaign canon (selection/generated-mechanics details superseded)

Status: Partially superseded by the 2026-07-11 reopen and 2026-07-12 D0 decision

Decision:
The surviving contract is that rules are persistent campaign state — Council-consultable,
player-viewable, and canon for the campaign's lifetime. The original selectable option list and
generated-per-campaign mechanics are superseded: D0 chooses one versioned bespoke chassis with only
campaign flavor generated. D14 may still consider CC0 material as balance reference data, not as a
wholesale selectable external ruleset.

Reason:
Owner decision 2026-07-03 resolving the invent-vs-adopt fork recorded in
plan.md ("Spells, abilities & ruleset consistency"): both, selectable, house
default first.

Supersedes:
The open fork in the plan.md future topic.

### 2026-07-03 - Genre theming is agent-generated at campaign setup; custom accent graphics deferred

Status: Active

Decision:
Visual/audio atmosphere for a campaign is generated by the Setup step at
campaign creation (the agent that already produces theme_colors), not from
curated templates. Custom accent graphics (bespoke ornaments/iconography per
genre) are explicitly deferred as a nice-to-have. The pre-campaign "empty
holodeck" entry state remains a separate, still-unscheduled visual task.

Reason:
Owner decision 2026-07-03 resolving both open questions in the plan.md
"Genre atmosphere" topic: agent-generated over curated, owned by campaign
setup.

Supersedes:
The open forks in the plan.md future topic.

### 2026-07-03 - Image generation is provider-configurable behind a seam; local models acceptable for dev

Status: Active

Decision:
Heroic/scene image generation follows the TTS pattern: a provider registry
seam, configurable in /admin, no hard-coded vendor. For development, local
generation on owner hardware (RTX 5090) is acceptable; production expects a
hosted frontier model. The one real plumbing constraint carried from the
maps/heroic design: identity consistency (same NPC looks the same across
renders) depends on provider capabilities (reference-image/seed
conditioning), so the seam's interface must carry an identity-anchor
parameter from day one even if a given provider ignores it.

Reason:
Owner decision 2026-07-03: frontier image models are interchangeable for
this use; configurability is the requirement, identity anchoring is the only
plumbing that must be designed in rather than bolted on.

Supersedes:
Nothing; concretizes the provider-strategy topic for images.

### 2026-07-11 - Rules requirement reopened; D0 later settled the overall frame

Status: Active requirement; the open frame was settled by D0 on 2026-07-12

Decision:
The rules-system question was reopened. Owner requirement: the engine must
provide a working rules system that is *predictable to the user* — players
can learn the rules and rely on them being applied the same way every time.
The no-rules path (`rules_mode` off / ruleset "none") is judged "just AI-led
storytime" and not useful for a multiplayer game. D0 later settled what ships: one bespoke,
versioned house chassis with generated campaign flavor. The remaining queue, including the legacy
freeform disposition, is still open. Per the phased-development contract, nothing is implemented
until those decisions produce a concrete reviewed phase.

Reason:
Owner 2026-07-11, on being shown the current shape (fixed d20 engine, an
AI-generated house sheet as soft canon, dice optional per campaign):
"undecide that. that is not my intention. we need to create a working,
predictable to the user system for these games. no rules mode is just AI led
storytime, and not useful for a multiplayer game."

Supersedes:
The 2026-07-04 "External rulesets dropped" decision below (status updated).
The 2026-07-03 selectable-ruleset decision's specifics (house default,
option list) are subject to the reopened design; its canon-state half — the
ruleset is persistent, Council-consultable, player-viewable campaign state —
stands unchallenged.

### 2026-07-04 - Owner delegation: open calls decided by the agent, plans approved by external review loop

Status: Active delegation; the Codex reviewer assignment was superseded 2026-07-14

Decision:
For the 2026-07-04 work queue (multiplayer foundations, visual gap closers,
table-style dials, holodeck entry state, campaign portability): undecided
design questions are decided by the agent and recorded here; plans are
written into plan.md and approved through an external-reviewer loop (Codex CLI
review, iterating until findings are resolved) instead of owner sign-off.
Nothing is gated on the owner until the multiplayer playtest, which is the
next point where feel gates close.

The later division-of-labour decision controls current assignments: the reviewer remains
independent, but is not unconditionally Codex.

Reason:
Owner 2026-07-04: "everything that we've decided that isn't planned gets
planned next with a codex reviewloop. nothing gated on me. anything not
decided gets decided next turn. then it gets planned. I want you to have
enough to do that you don't need to wait for me to test it for days."

Supersedes:
Owner-approval gating for these specific plans only. The phased-development
review gate (playtest before a phase is *complete*) still stands — it is
deferred to the multiplayer playtest, not removed.

### 2026-07-04 - Table-style dials: option sets, defaults, and reach (agent-decided under delegation)

Status: Active

Decision:
Two campaign table-style dials, stored as campaign state and enforced
structurally (never as prompt adjectives alone):
- GM helpfulness: helpful | classic | hardline. Default: classic — answers
  what is asked, honestly, volunteering no odds, hints, or tactics ("You
  think so."); helpful preserves today's volunteering behavior; hardline
  gives bare in-fiction answers only.
- Encounter pacing: slow_burn (~1 GM-initiated encounter per 8+ world
  turns) | standard (~1 per 5) | action_heavy (~1 per 3) | player_driven
  (GM does not initiate). Default: standard. Enforced as recorded cadence
  state: the referee reports encounter initiation on each committed turn,
  the engine records it, and Continuity receives "last GM-initiated
  encounter: N turns ago vs target" as a checkable rule. Player-sought
  danger is never blocked by the dial.
- Both dials are adjustable mid-campaign (campaign settings; effect next
  turn) — chosen for the owner's iterate-and-test workflow.
- Suggested choices fade with style: helpful 3-4 as today; classic 2-3
  neutral, obvious options; hardline none.

Reason:
Owner delegated the specifics 2026-07-04; defaults follow the recorded
Phase 0 complaint (unprompted odds/tactics is "a notably helpful table
style" — a typical LLM trait, not a real-GM one) and plan.md's ~5:1
good-table baseline.

Supersedes:
The open "default and option set to be decided" questions in the plan.md
GM-helpfulness and encounter-pacing topics.

### 2026-07-04 - Campaign portability: versioned single-file JSON bundle, export first

Status: Active

Decision:
Campaigns export as one self-contained versioned JSON bundle (format_version
+ the structured state the Council consults: campaign, outline, ruleset,
characters/profiles, NPCs incl. voice/anchor identities, locations,
memories, turns, engine-owned pointers). Hard requirement: forward
importability — any released export must import into later engine versions
(import validates format_version and migrates). Export ships before import.
Imported bundles are untrusted data, never instructions (existing trust
posture). Generated image binaries are referenced, not embedded, in v1.

Reason:
Owner 2026-07-04: "xml, json, whatever. as long as it's importable later."
JSON matches the engine's JSON-heavy state and diffability.

Supersedes:
The open artifact-format question in the plan.md portability topic; other
open questions there (ownership locks, cross-instance auth) remain future.

### 2026-07-09 - Multiplayer reopened: target is a remote two-human playtest; connectivity is owner-handled

Status: Active

Decision:
Multiplayer returns to active direction. The goal is a playtest with a second
human on their own machine outside the owner's network. The 2026-07-05
multi-user decision (per-seat credentials, server-side character binding,
seat-scoped visibility) is reactivated as the governing design; Phase S is
unparked: S2 (seat-scoped visibility) and S3 (seat join/invite flow) are to
be built per the approved plan. Network exposure — transport, TLS,
tunneling or port-forwarding — is explicitly the owner's responsibility and
out of repo scope; the app-side requirements stand (seat auth landed in S1,
seat-scoped visibility in S2, secrets set when hosting — existing startup
warnings and production fail-closed behavior). The remote playtest resumes
its role as the pending close point for the open feel gates (the 2026-07-04
delegation framing, voided by the park, is restored).

Reason:
Owner 2026-07-09: "multiplayer should be opened. I need to test with another
human at another machine outside my network, so we need to be ready to
support that." On the connection mechanism: "don't worry about how it'll
connect. I can handle that."

Supersedes:
The 2026-07-05 park decision below ("Multiplayer is an OPEN question") —
multiplayer work resumes. Reactivates the 2026-07-05 multi-user decision
(status updated in place).

### 2026-07-05 - Multiplayer means multi-USER: per-seat credentials, server-side character binding, scoped visibility

Status: Active (reactivated 2026-07-09 by the reopen decision above; was parked 2026-07-05 – 2026-07-09)

Decision:
"Multiplayer" requires distinct users, each able to act only as — and see
only — their own character. Mechanism (owner requirement 2026-07-05, design
surfaced and approved in chat): (1) per-seat invite tokens minted by the
host, stored hashed, revocable — the smallest credential that makes users
distinct; accounts/passwords remain future. (2) The characterId request
parameter is removed FOR SEATS — the server derives the speaking character
from the seat credential; the HOST credential retains explicit characterId
selection (the host is the table operator and needs it for solo/hosted
play). Precision amended 2026-07-05 during plan review (codex finding).
ACCESS_SECRET becomes the HOST credential with full view and authority. (3) Seat-scoped payloads: own sheet full; partymates as
name/class/level/HP silhouette; no outline, no NPC personalities/notes, no
memories — the shared narrative/scene/map/heroic remain table-public.
(4) Meta-actions (delete, fork, export/import, releasing others, table-style
dials) are host-only, enforcing the 2026-06-11 owner-channels decision.
(5) Campaigns with no seats minted behave exactly as before (solo/dev).

Reason:
Owner 2026-07-05: the shared-token v1 "isn't multi-player, it's
multi-character... we need two distinct users, each with access only to
their character, able to respond only for their character." Per-user access
control is intrinsic to the word multiplayer, not an optional later layer.

Supersedes:
The "shared ACCESS_SECRET, per-player auth stays future" half of the
2026-07-04 multiplayer-v1 decision below. Its turn-order, round-robin, and
in-app-chat-later parts stand.

### 2026-07-04 - Ruleset licensing constraint: no whole-work attribution framing

Status: Active

Decision:
Open rulesets may be adopted only under licenses whose obligations stay
scoped to the ruleset content itself. Any license requiring the product to be
characterized as "based on" the licensed system — Fate's specified CC-BY-3.0
attribution block, ORC's Article III attribution-notice pattern — is
unacceptable: Aetheria is a complete engine and a ruleset option is a minor
addition to it, so whole-work framing misrepresents the product. Clearly
compliant: CC0 (no attribution at all — Worlds/Cities Without Number SRDs).
Factual, containment-scoped mandated statements (the D&D SRD's "This work
includes material taken from…" line, placeable on a ruleset credits surface)
are not auto-excluded but need explicit owner sign-off per option at adoption
time. ShareAlike options were already an owner-decision item and remain so.

Reason:
Owner direction 2026-07-04 after reviewing docs/ruleset-licensing.md: the
required "based on Fate Core System" statement is "massively overstated …
not that one. nothing like that. this is a minor addition to a complete
project."

Supersedes:
The candidate ranking in docs/ruleset-licensing.md as first written (Fate
listed as the top genre-neutral option; Fate and ORC now excluded). The
underlying license *facts* in that doc remain valid evidence.

### 2026-07-11 - Flat, restrained UI styling: gradients removed; styling normalization precedes scene theming

Status: Active

Decision:
The UI moves to a flat, restrained design system: the gradient fills (Send
button, level badge, gradient text) are removed — owner: "gradients are
dated and ugly anyway" — transparency levels are unified to a small
documented set, and one derived on-accent text color serves every
accent-backed control (buttons, badges, map labels in map-render.js).
This styling-normalization pass is the prerequisite for Phase T2
scene-dynamic theming and RESOLVES its validation-scope question (six codex
review rounds proved generated palettes cannot be cheaply validated against
gradients, stacked opacities, and hover states): with flat surfaces, simple
enumerated contrast checks genuinely suffice, and the heavy validation rig
(browser harness, gradient-interior math, manifest bijection) is dropped
from scope. Model: Friends & Fables' polish comes from exactly this
restraint — one disciplined dark system, no per-surface effects.

Reason:
Owner 2026-07-11, after seeing the codex r6 rejection routed as a scoping
choice and a Friends & Fables screenshot comparison.

Supersedes:
The r6-draft T2 validation machinery (consumer-envelope manifest with
browser harness) as planned scope; the plan simplifies to flat-pair checks.

### 2026-07-11 - Tactical combat is IN SCOPE; the day-one "non-goal" line was never an owner decision

Status: Active

Decision:
Tactical combat depth is a goal. The rules-system synthesis (2026-07-11
reopen decision) and the maps/token work design toward it: the synthesized
system must support tactical combat (initiative, positioning, action
economy at whatever depth the synthesis lands on), and the structured
location/map layer (Phase V2's deterministic render, occupancy, areas) is
its groundwork. How deep — zones vs grid, movement rules, line of sight —
is settled inside the rules-synthesis design, not here. The anti-"video-
gamey" principle still governs *feel* (no forced action, table talk stays
free), but it was about rushed resolution, never about combat depth.

Provenance correction: "Full combat grid / tactical combat system" sat in
plan.md's Non-Goals from the first agent-drafted plan commit (c2daa30,
2026-06-05) and hardened through citation without ever being an owner
decision. The owner's 2026-06-11 lean toward map+tokens with narrative
resolution was a maps-design choice, not a combat-scope prohibition.

Reason:
Owner 2026-07-11, on having the provenance traced: "In scope — we want
tactical combat." Chosen over reclassifying it as an open question.

Supersedes:
The "Full combat grid / tactical combat system" Non-Goals line in plan.md
(removed); the "tactical depth stays at (b) … resolution remains narrative"
framing in the maps topic, which becomes a starting point the rules
synthesis may deepen, not a ceiling.

### 2026-07-11 - Housekeeping: fix/sv-* branches deleted; the three accidental merge commits stay

Status: Active

Decision:
The six `fix/sv-*` branches (sv-1 through sv-6, the 2026-07-09 seat-review
fixes) were deleted after re-verifying each was fully contained in master
(`git rev-list --count master..<branch>` = 0 for all six; no copies existed
on either remote). The three merge commits created by an agent shell accident
on 2026-07-09 (`0eccda6`, `aeb93d5`, `7b2bc64`) remain in master permanently:
the owner declined a history rewrite. Do not re-propose removing them — they
are harmless, content-superseded by correct forward-merges, and master is
public on GitHub, so removal would mean force-pushing published history.

Reason:
Owner 2026-07-11: branch deletion approved, history rewrite declined. Closes
the two housekeeping items queued in `.agents/state.md` after the seat-review
work landed.

Supersedes:
The two open "decide" items in `.agents/state.md` ## Next (branch fate;
history tidy).

### 2026-06-05 - Council GM pipeline is canonical; clarification turns must not advance state (from plan.md + code)

Status: Active

Decision:
Player turns use the ordered Council pipeline (Interaction → Continuity → Referee → Continuity archive/final → Narration) and present as a single GM voice. On clarification or dialogue turns (input_kind), state changes (character, quest, NPC, memory, dice, abilities) must be forced to no-op. Scene grounding is required on clarification turns. The old single-model path is deprecated and slated for removal.

Reason:
Supports richer back-and-forth without world mutation on questions; anti-hallucination via multiple agents; matches the implemented behavior in rpg-engine.js, rpg-state.js (validateTurnData clarification safety net), and test.js assertions. Earned from Phase 0 work to fix "too video-gamey" complaints.

Supersedes:
Any prior single-model toggle or default path assumptions (now unreachable per plan).

### 2026-07-16 - Rules D1: checks resolve on d20, meet-or-beat vs DC (rules track, owner decision)

Status: Active core (die-agnostic clauses); die-specific clauses superseded same day by the signed-off resolution chapter (see the sign-off entry in this file)

Decision:
The house rules system resolves checks as d20 + modifier vs DC; meeting or beating the DC succeeds. Difficulty has exactly one knob: the DC. Failure chances for stronger characters are created by raising the DC, never by graded-margin mechanics — the margin-band grammar recommended by the dice bake-off (clean/mixed/miss graded by beat-margin) is REJECTED as the universal check grammar. The DC ladder must be code-owned: the engine derives the numeric DC from an authored difficulty tier; the model may select a tier but never invents a number. Value derivation (damage and other non-check quantities) is deliberately NOT decided here — reserved as decision D1b. Nat 20 is always a success and nat 1 is always a failure, on any d20 check (owner, 2026-07-16). To preserve the standing requirement that trivial tasks are near-impossible to fail for competent characters, the engine applies the standard D&D no-roll gate: when success is certain for the acting character (per the code-owned tier ladder), no roll is called and nat 1 cannot fire — dice only hit the table when the outcome is uncertain. Rider (b) "success at a cost" is REJECTED: check outcomes are strictly binary. The GM never offers the player an alternate reality — the GM council decides the reality of the game. If the DC is met it is a success; if it is not, it is a failure. The GM's liberty is descriptive only: narrate the success or the failure to fit the situation. If binary outcomes prove too vague for the model to narrate well, that is a prompting/spec gap to address (GM narration instructions), never a mechanics change. D1 is fully closed; only D1b (value derivation) remains open. Unblocks D8 (opposition stats derived from an authored curve) and tier/DC-ladder design.

Reason:
Owner 2026-07-16: "D20 is fine. I don't actually care about the die. but the margin band idea I do not like... if the GM wants failure to be a real possibility for a higher level character, then the GM needs to raise the difficulty class. I'm just describing how D&D does it. that's natural to everyone." Evidence: `.agents/review/dice-bakeoff.md` — 2d6 and d6-pool spines eliminated on pacing-independent math (failure-band collapse at L9/L8, lumpy progression, opposition/CC0 costs); d20 retained on evidence, satisfying intake finding F7 (die not kept by inertia). Rider (a) closed by owner same day: "20 is always a success in DnD, and 1 is always a failure. any check on a D20." The no-roll gate is the agent-derived reconciliation with the owner's trivial-task requirement and is standard 5e practice (roll only when the outcome is uncertain); flagged for owner veto. Rider (b) rejected by owner 2026-07-16: "the GM doesn't offer the player a different reality. the GM council decides the reality of the game. if a DC is met, it's a success. if a DC is not, it's a failure. the GM has the liberty to describe the success and failure to fit the situation."

Supersedes:
The dice bake-off memo's margin-band recommendation (memo Addendum 2 records the rejection); the rules intake D1 row status (was: Pending — next owner decision).

### 2026-07-16 - Rules resolution chapter signed off: d100 with licensed edge texture (supersedes D1's die clauses)

Status: Active

Decision:
The owner signed off `docs/rules/resolution.md` (Chapter 1: Resolution) at review-converged pin
`8f7862d8f6577c3859778bb8b6cc3b639576bdf9`, after nine review rounds with dual codex + grok
acceptance (trail: `.agents/review/resolution-ruleset-review.md`; trajectory 13→8→4→1→0, owner
amendments, then 5→2→1→0). Per the chapter's supersession declaration, the following clauses of
the earlier 2026-07-16 "Rules D1" entry are superseded:

1. Die: d20 → d100.
2. Absolutes: nat 20 / nat 1 → raw 100 / raw 1.
3. Strict binary everywhere → binary mid-range with GM-decided edge texture: the marginal and
   critical bands LICENSE — never require — GM-chosen complications/extras; the GM never offers
   the player a choice of outcomes.
4. Coded no-roll gate → council judgment (P1: rules recede).
5. Model authority expands, disclosed: tier tokens, tierBasis, enumerated situational deltas
   (direction/magnitude/reason), the callSeq protocol ordinal, and edge-band annotation proposals.
   Every game-mechanical number remains engine-owned; the only model-emitted numeric tokens are
   the actor-id cross-check and callSeq, neither entering game arithmetic.

Sign-off also accepts the flagged trade: situational deltas are enumerated magnitudes
(slight/moderate/major = 3/7/12, engine-owned config), not free integers — preserving the intake's
models-emit-identifiers-only invariant.

The chapter is the canonical check-resolution specification: d100 meet-or-beat vs engine-computed
T (clamped [2,99]); ordered outcome bands with five-face margins (N=5); an engine-computed,
playtest-tunable stakes license over edge-band discretion; mechanical complications executed only
through the D2 effect catalog with bidirectional text-effect coherence, valence tags, and
point-budget aggregation; an immutable, table-public roll ledger; idempotent atomic rolls. The D2
effect catalog is a hard prerequisite for implementing the edge bands; its deliverables
(complication-effect classes, weight classes, per-operation point costs, valence tags) are
recorded on the D2 queue row in `.agents/review/rules-system-plan-intake.md`.

Reason:
Owner 2026-07-16: "signed off", closing the loop the owner ordered ("turn this into a coherent
ruleset then run it by codex and grok reviewloops" — which reinstated the dual codex+grok contract
for this artifact). Design lineage: the dice bake-off evidence memo and owner brainstorm
(`.agents/review/dice-bakeoff.md`, addenda 3-4), the owner's mechanical-complications ruling, and
the licensed-discretion resolution of the GM-discretion question ("Sure, let's try it.").

Supersedes:
The die-specific clauses (list above) of the 2026-07-16 "Rules D1" entry. D1's die-agnostic core
stands unchanged: difficulty lives only in the target; the ladder is code-owned; models never
invent numbers; GM latitude on clean bands is descriptive only.

### 2026-07-16 - Rules D2: complications are free text over an engine verb set; trust is tuned by the license, never by unledgered effects

Status: Active

Decision:
Complications are never a fixed table of pre-written outcomes. They stay free text the model
writes fresh each time, optionally supported by **contextual suggestions** — engine/council-
generated, scene-derived complication candidates grounded in live state (carried items, present
NPCs, active deltas) offered to the Referee, which remains free to write something else within the
stakes license. Suggestions are advisory; they never become a menu constraint on the text.

Any **mechanical** consequence a complication asserts must map to an engine verb — a state
operation from the D2 catalog — with the verb set deliberately kept **wide enough to say yes to
almost anything a GM would rule**. The D2 artifact is therefore an effect **verb** catalog (a
state-operation vocabulary, the API to engine state), not complication content; narrative variety
lives in the free text, not in the vocabulary.

Model trust is tuned by widening or narrowing the ledgered stakes license (code-owned config,
resolution chapter §1.5), **never by permitting unledgered effects**. The bidirectional
text–effect coherence rule stands: narrated mechanics require ledgered effects. The trust
experiment the owner wants — see the model fail in order to iterate — reads the ledger after real
play; failure stays observable without unfalsifiable state drift.

The previously recorded D2 scope deliverables stand unchanged: complication-effect classes
(resource/inventory loss, NPC disposition shifts, encounter initiation, outcome-value modulation
with D1b), effect weight classes (minor/significant), per-operation point costs, and per-operation
valence tags. The owner-signed Chapter 2 r24 satisfied the catalog-document gate on 2026-07-27;
no rules code may begin before a concrete phase and an owner-approved plan. The D2 decision now
unblocks the D3, D5, and D13 queue discussions.

Reason:
Owner 2026-07-16, rejecting the fixed-catalog-as-complication-table framing: "complication tables
are too limiting. complication SUGGESTIONS, maybe. but we need to put a stake in the ground on
model trust. we can't engineer a better model in this repo, so if it's going to fail, we need to
see it fail to iterate. a static table will ultimately make encounters feel repetitive. unless the
table is contextual." The owner then accepted this sharpened wording verbatim ("agreed"):
"Complications stay free text with contextual suggestions, never a fixed table — but any
mechanical consequence must map to an engine verb, with the verb set deliberately kept wide enough
to say yes to almost anything a GM would rule. Trust is tuned by widening the license, not by
unledgered effects."

Supersedes:
The intake D2 row's reviewer-recommendation reading of "fixed effect catalog" as fixed complication
content. It refines — does not supersede — resolution chapter §1.5: catalog membership, valence,
and point-budget validation stand, with the catalog understood as a wide state-verb vocabulary.
The genre-spread coverage proof carries forward as a drafting-stage obligation on the verb set
(reviewer recommendation; not separately owner-ruled).

### 2026-07-31 - Rules D3 gate 1: cross-genre portability core — immutable mechanics, per-campaign expression bindings (owner decision)

**Status: superseded in part later the same day.** The one-persistent-character amendment below and
the amended v3.1 draft control every conflict; this entry is retained as decision history.

When a character moves between campaigns, the mechanical record — ability records and their
packaging, costs, limits, attributes, progression (level, XP, tiers) — is **copied verbatim**:
never re-derived, never model-touched. Only expression rebinds, and it rebinds **per campaign**:
a campaign-scope shared vocabulary (semantic key → destination term) plus character-scope bindings
(identity, ability display names and prose, specializations, pins). Movement is always one of
three modes — Continue (same profile into a compatible campaign), Branch (exact copy with
lineage), Translate (cross-genre incarnation, created as a new branch) — and no mode mutates the
source character. Translation requires **mandatory player approval** of the exact card before
play begins.

This adopts gate 1 of the active working draft
(`.agents/review/archetype-portability-matrix-v3.1.md` §16) and settles the foundation only.
Gates 2-7 — Stage 1 as a phase, capability axes, slot taxonomy, family set, onboarding shape,
and campaign-specific name expression — remain unruled. History remains deferred to D13/D16.
No product code is authorized by this decision.

Reason:
Owner 2026-07-31: "adopt", after in-chat examination of the design (sorcerer/wizard separation via
per-character cost shapes, class decomposition into family + source + mechanics, creation flow,
progression carry-over). Recommendation basis: the smallest design testable by structural
identity (`assert.deepStrictEqual(translated.mechanics, source.mechanics)`), and the shape D0's
one-rulebook rule already implies.

Supersedes:
v2's candidate-generation-plus-equivalence-proof apparatus
(`.agents/review/archetype-portability-matrix-v2.md`, retained as evidence). The v3.1 draft's
remaining owner gates are unaffected.

### 2026-07-31 - Rules D3 gate 2: Stage 1 approved as a phase, S1.1 → S1.8 order (owner decision)

**Status: Refined later the same day.** The stable-archetype decision below narrows Stage 1 to
ability-presentation portability and removes name/title translation from its slices. The fixed
S1.1 → S1.8 order remains active.

Stage 1 of the cross-genre portability plan — expression translation over today's free-text
profiles — is approved as a phase, in the fixed slice order S1.1 → S1.8
(`.agents/review/archetype-portability-matrix-v3.1.md` §11, as amended §1.1). The order is
load-bearing: identity, binding, validation, and approval machinery land before anything touches
canon prose, and S1.8 ships last. Its then-current byte-identical-carry framing is superseded by the
one-record projection amendment below. No slice is standalone.

The gate authorizes drafting the concrete phase plan (files to change, success metrics,
verification) for its own separate approval; no code is authorized until that plan is approved.
Remaining v3.1 §16 gates (3: campaign canon basis, subsequently settled below without axes;
4: slot taxonomy, 5: families, 6: onboarding shape, 7: campaign-specific name expression;
history remains deferred to D13/D16) ride the slices
they govern and come to chat one at a time
before the affected slice lands.

Reason:
Owner 2026-07-31: "go", on the recommendation to approve gate 2 immediately after the gate-1
adoption and the post-gate-1 seam amendments closed Stage 1's cold-implementability gaps
(openreviewed same day: kimi k3 max over `8320db7..770b3e5`, one LOW records finding, fixed
as rq-1).

### 2026-07-31 - Campaign setting authority: creator chooses at creation; GM worldbuilding stands (owner decision)

The campaign creator chooses the initial setting when creating the campaign; other players have not
joined yet and do not approve it. Once play begins, the GM's worldbuilding and rulings stand. A
player may ask why something is true; the GM may explain it, affirm it, or recalibrate organically
through later play, but established fiction is never retroactively replaced. Players either accept
the GM's worldbuilding or start a new campaign.

Ordinary play has no host or player setting-correction control. A host-only administrative campaign
editor is a separate, deferred product question and is not authorized by this decision.

Reason:
Owner 2026-07-31: "creator chooses" because other players have not joined when the campaign is
created; if questioned, the GM's justified ruling settles the matter. Any GM recalibration must
happen organically in the game rather than by declaring prior fiction false. Players who reject the
worldbuilding can start a new campaign. A host-only admin editor may be considered in a later stage.

Refines:
The 2026-06-11 player-authority decision remains active: players may question the GM, but the GM's
word on world facts is final. This ruling narrows "owner settings" for Phase PT: campaign
worldbuilding is not an ordinary settings surface. It supersedes v3.1 amendment C's host-edit and
affected-player revalidation workflow. The later Gate 3 entry below settles portability's canon
basis without a second setting record.

### 2026-07-31 - Rules D3 gate 1 amendment: one persistent character, one active campaign (owner decision)

**Status: Superseded in part on 2026-08-02.** The stable-archetype decision below still narrows
campaign-specific expression to ability presentation, but the later campaign-version decision
replaces this entry's one-record/no-alternate-version rule with one character lineage containing
independently playable rules-version snapshots. The per-version active-campaign lock,
campaign-specific wording, and player-approval boundaries remain.

A portable character is exactly **one persistent character record**, active in exactly one campaign
at a time. Moving that character never creates a branch, copy, alternate incarnation, or later
merge. The same character id, mechanics, abilities, attributes, level, XP, tiers, and subsequent
progression travel with the character.

Campaign-specific ability expression remains stored per `(character, campaign)`. On first entry,
every missing Stage 1 ability-presentation binding needs wording and player approval. On return, previously
approved bindings are reused exactly; only abilities gained since the character last left that
campaign and therefore lacking a destination binding need new wording and approval. Entering an
existing campaign never recreates its rules, history, current scene, or opening scene; campaign
material is created only when the destination campaign itself is new. A draft, cancellation, stale
result, or failed translation leaves
the character active in the current campaign unchanged; approval atomically stores the new bindings
and switches that same character's active campaign.

This amends D3 gate 1 without reopening its retained foundations: mechanics never translate or fork,
expression alone is campaign-specific, and player approval is mandatory before translated wording
enters play. It specifically supersedes the earlier gate-1 wording that described three portability
result modes, copied mechanics into a new profile, Branch lineage, a translated branch, or a source
character left behind. Existing explicit manual character-copy behavior is a separate shipped
feature, not a portability mode or an alternate state of the moving character. Inventory,
relationships, history, and other non-ability state remain deferred to D13/D16 rather than inferred
here.

The same-record rule also supersedes gate 2's "byte-identical carry" wording for campaign rule
sheets: GM context must project mechanics from the character's one canonical mechanic record and
overlay campaign wording. It must not persist a destination mechanics copy. This keeps Stage 1's
mechanics invariant while fuller ability packaging remains D5.

Reason:
Owner 2026-07-31 rejected branched instances: "one character, only active in one campaign at a time,
carries the experience with it. no alternate versions." This also resolves the round trip: returning
to a prior campaign cannot produce a different incarnation because the same character returns and
its saved campaign expression is reused; only newly gained abilities without destination wording
require translation.

### 2026-07-31 - Rules D3 gate 3: portability reads live campaign canon; no second setting model (owner decision)

Portability decides how a character is described in a destination campaign from that campaign's
existing canon: its outline and setting, a bounded slice of played history, and relevant durable
memories. It does **not** create or maintain `capability_json`, magic/firearms/technology axes,
predicate grammar, a genre classifier, seeded permission tables, or any other checklist that could
disagree with the campaign itself.

The engine and MCP tools must share direct internal read helpers. Internal portability code never
calls the server's own MCP SSE or HTTP endpoint. The Stage 1 portability canon pack uses the
Council-aligned defaults: the latest six turns returned in chronological order and the top eight
relevant memories ordered by importance then recency, alongside the canonical outline/setting.
The helpers may accept explicit bounds or search inputs so MCP tools can retain their public
behavior without duplicating the reads.

The GM judges whether proposed wording honestly fits that canon. The engine validates only the
bounded contract: known character and ability IDs, expected shape, no mechanics, and no new
expression slots. The player approves the wording before the move commits. `player_action` is an
action or claim, not canon by itself; GM narration, committed memories, and the campaign
outline/setting ground the review. Raw canon excerpts and retrieval anchors remain GM-private; the
player sees the proposed wording and the GM's player-safe explanation, not the hidden canon pack.

Reads are live, so later GM worldbuilding is naturally present the next time wording is proposed.
There is no settings editor, synchronization workflow, or retroactive correction path in this
stage. A persisted movement draft may store a deterministic digest of the exact canon basis solely
to detect stale review before approval. The digest is not campaign canon and never invalidates
already approved per-campaign ability wording, which is reused exactly when the same character returns.

This closes Gate 3 and makes S1.2 ready under the approved Phase PT order. S1.2 supplies shared
canonical-context retrieval and deterministic freshness; S1.3 supplies canon-grounded ability
wording plus structural validation; S1.4 establishes ability vocabulary lazily from the same
canon when a missing ability binding first requires it. The later decision below closes Gate 4,
closes Gate 6, leaves only Gate 5's exact roster open for S1.5, and closes Stage 1 Gate 7
with no automatic name/title translation.

Reason:
Owner 2026-07-31 rejected a second structured setting checklist: the campaign data the MCP already
exposes is the authority, the GM settles fictional fit from that worldbuilding, and live reads avoid
an editor or synchronization problem.

### 2026-07-31 - Rules D3 gates 4, 6, and Stage 1 Gate 7; gate 5 boundary: player-facing archetypes, player-owned titles, ability-only portability (owner decision)

**Status: Active.** A character has a stable, player-facing mechanical archetype such as
`Controller`. Character creation presents that archetype by its archetype name; the Creator
(the character-creation model) maps
the player's free-text concept to a known archetype ID, writes a campaign-tailored description,
and asks the player to confirm it. The description may mention public profession names already
grounded in that campaign (for example, “netrunner” or “systems adept”), but those are examples of
the world's vocabulary, not automatic replacements for the character's identity.

The player's own title remains separate and travels unchanged with the one persistent character.
A wizard remains a wizard in a science-fiction campaign unless the player chooses another title.
Campaign-local titles are GM-owned worldbuilding that characters may learn organically in play;
adopting one is the player's choice. How a player-chosen title change is stored or edited remains
future; portability never initiates it. Stage 1 portability may adapt only ability presentation — an
ability's display name and explanatory prose — never the character's archetype, class label,
role/profession title, or self-title. This closes Gate 4 for Stage 1 and closes Gate 6's Creator
mapping shape. Gate 5 remains open only for the exact archetype roster and definitions: neither
the draft's current 22 entries nor their count is approved by this decision. This also closes the
Stage 1 part of Gate 7: portability creates no character-name or title binding. Proper-name/alias
policy and any player-driven title-edit workflow remain future and do not gate Stage 1.

Reason:
Owner 2026-07-31 rejected automatic class/title translation: “Elminster is a Wizard even when
he's hacking a mainframe.” The owner then chose stable archetype presentation at character
creation, with campaign-tailored descriptions produced by the Creator mapping.

Supersedes:
v3.1's “internal-only” archetype-family taxonomy, “player never sees the family menu” requirement,
and any Stage 1 campaign-local `role:<family>`, class-name, role/profession-title, or self-title
translation. Proper-name/alias policy and player-driven title-edit workflow remain outside this ruling.
It narrows Stage 1 proposal and validation to requested known ability IDs and ability-presentation
fields; exact archetype enumeration gates onboarding, not S1.3.

### 2026-07-31 - Portability wording is non-authoritative; canonical mechanics govern every consequence (owner decision)

**Status: Active.**

Stage 1 ability wording may describe appearance, sensation, or fictional expression, but it is
presentation only. It is never parsed or applied as a mechanic. Any actual number or stat change,
damage, resource spend, XP award, cost, limit, or other mechanical consequence must be validated
by the GM Council against the character's canonical mechanics through the normal adjudication
path. Portability wording cannot hand-wave, replace, or create that authority.

The S1.3 engine boundary strictly validates identity, shape, bounds, status variants, and extra
fields, and rejects high-confidence numeric/stat/rule claims before player review. It does not
pretend a finite natural-language lint can classify every semantic paraphrase. Flavor such as
feeling tipsy or tired remains valid when it asserts no mechanical consequence; canonical state
remains unchanged unless the Council separately validates and applies one.

Reason:
Owner clarification 2026-07-31: “the underlying mechanics cannot be hand-waved. the GM, or one
of the council, needs to validate mechanics every time any number or stat changes, damage is done,
exp is awarded, etc. flavor is fine ... but you lose 2 hp HAS to be backed mechanically.”

### 2026-08-02 - Campaign class-catalog generation presumes inclusion; exclusion discloses failed fit (owner decision)

**Status: Superseded in part later on 2026-08-02.** The later campaign-class-set decision replaces
the presumption and “failed imagination” language with neutral, configured availability. The
requirements that a presentation preserve exact mechanics and that the model cannot mint mechanics
remain active.

When generating a campaign's class catalog from the approved mechanical archetypes, the generating
model begins with a presumption that each archetype has an honest setting-native expression. It must
preserve the archetype's exact repeated loop, permissions, operations, and costs while searching
beyond the archetype's familiar technology, profession, magic, or aesthetic.

Exclusion is legal only when every plausible expression would cause at least one of these failures:

1. contradicting established campaign canon or the campaign's deliberately restrictive premise;
2. removing or falsifying the archetype's defining repeated mechanic; or
3. requiring new or changed mechanics to make the expression work.

An exclusion records the specific conflict and is explicitly an admission that catalog generation
failed to imagine an honest fit. It is not routine pruning and cannot be hidden behind a dishonest
reskin. Campaigns may still omit an archetype after that failed-fit result; a coverage matrix is not
a mandatory menu for every individual campaign.

This presumption applies only to admitted mechanical archetypes. Tactical roles, ordinary skills,
jobs, ranks, wealth, status, and assets do not need a class mapping: a cave murder mystery need not
invent an Artillery class. The generating model proposes presentation against engine-known mechanic
IDs; it cannot mint mechanics, infer permissions from prose, or make its own output authoritative.

Reason:
The owner tested the boundary with a Neanderthal-era cave murder mystery, where “the artillery guy”
has no mandatory class seat; a ranged hunter may emerge from an Armsmaster build, but the tactical
role may simply be absent. The owner then clarified the catalog-generator posture: “an exclusion is
an admission of a failure of imagination,” and settled that note as a decision on 2026-08-02.

Refines:
The 2026-07-31 Gate 5 boundary still leaves the exact roster open and keeps archetypes
player-facing. This decision governs how a campaign-specific class catalog attempts to express that
future approved roster. It does not reopen ability-only portability, authorize automatic class or
title translation, or require mechanics-changing compatibility with every campaign.

### 2026-08-02 - Intrusion is training over a shared protected-system subsystem, not an archetype (owner decision)

**Status: Active.**

Intruder is removed from the candidate archetype roster. A coherent protected-system procedure may
still use linked nodes, system-scoped Access, exact permissions, and Alert/lockdown, but that state
belongs to the authored scenario rather than to an Intruder class.

Any character with the appropriate ordinary skill can attempt local intrusion, participate in
Probe or Breach actions, and use baseline printed permissions. Intrusion training or specialization
may grant efficiencies and advanced authored operations; it is most naturally part of an
Opportunist/Rogue-style build, but another class may acquire it through the system's normal feat,
talent, or multiclass cost. The exact
training package and progression remain roster/rules work. Neither training nor a high skill may
monopolize required evidence or progress.

Reason:
The matched cyberpunk and Neanderthal prototype established that Access/Alert can create meaningful
multi-node decisions, but the owner identified the category error in the initial conclusion:
distinct scenario mechanics do not by themselves justify a distinct class. Intrusion is a
specialized method applied to world-authored security, analogous to a broader rogue's learned
skillset, and its useful state disappears when the scenario supplies no protected system.

Supersedes:
The conditional Intruder candidate in
`.agents/review/archetype-concept-coverage-audit.md`, the prototype's initial recommendation to
retain Intruder conditionally, and every Intruder row in the frozen three-package comparison as a
candidate for adoption. The package document remains historical design evidence and is not
regenerated by this decision. The 2026-08-02 catalog-inclusion decision still applies to admitted
archetypes; because Intruder is not one, a campaign catalog has no Intruder row to express or
exclude.

### 2026-08-02 - NPCs use compact encounter kits with encouraged bespoke abilities (owner decision)

**Status: Active.**

NPCs use the same core resolution language, effects, harm, conditions, positioning, and encounter-
difficulty accounting as player characters, but they do not require full player class sheets,
progression, multiclassing, recovery rules, or player-accessible ability catalogs. Their mechanics
are authored as compact encounter kits appropriate to their function in the current scene.

NPC-only abilities are encouraged when they strengthen the character's or encounter's identity.
They do not need to map to a class, talent, feat, or other option a player could acquire. The more
important the encounter, the more its kit may depart from player-facing options: a final boss may
have substantial exclusive actions, reactions, phase changes, or environmental effects rather than
merely echoing one player class mechanic.

Exclusive mechanics must be priced into the encounter's intended difficulty and action economy.
Dangerous abilities need intelligible tells and meaningful counterplay; bespoke does not mean an
unannounced arbitrary outcome or permission to negate player choices without accounting. The exact
NPC card schema, numerical prices, and boss construction procedure remain open rules work.

Reason:
The owner rejected player-option symmetry as the NPC design target. NPC-exclusive mechanics are a
flavor and encounter-design advantage when balanced for the intended difficulty, and a final-boss
encounter should be allowed significant abilities unavailable to players. The useful boundary is
shared mechanical language and balance accounting with deliberately asymmetric sheet complexity
and access to abilities.

Refines:
The open archetype roster and campaign class catalogs govern player-character construction, not the
limits of NPC encounter design. This decision rejects any requirement that an important rival can
only reproduce a player class loop; it does not approve a rules variant, roster, NPC budget, or
runtime implementation.

### 2026-08-02 - Campaign class sets, safe campaign upgrades, and player-owned character versions (owner decision)

**Status: Active.**

#### Campaign class availability

Campaign creation offers three cumulative class-availability sets:

1. **Base (recommended):** the smallest, lowest-interaction-burden, best-tested released set.
2. **Advanced:** Base plus additional or more demanding released options.
3. **Expert (full):** every class option in the selected catalog version.

The server administrator chooses which sets are allowable for new campaigns. The campaign creator
selects one of those allowed sets; if only one is allowed, there is no redundant choice. Every class
present in the selected set is available from character level 1. The sets express catalog breadth
and interaction complexity, never greater character power or a level prerequisite.

Each campaign pins its selected class set and catalog/rules version. Later changes to the admin's
allowed-set configuration affect new campaigns only. The campaign generator and character-creation
UI receive only the selected catalog. An option absent because of the selected set, release phase,
disabled module, or honest campaign incompatibility is neutrally unavailable; it is not presented
as the model's failure or an “admission of failed imagination.” A compatibility explanation may
name the factual reason but must not shame the model. Presentation still cannot falsify mechanics,
and the model still cannot mint class IDs, permissions, costs, or effects.

The exact classes in Base, Advanced, and Expert remain roster and playtest work. Catalog versions
may change membership as options are validated; an existing campaign changes only through the
explicit upgrade procedure below.

#### Safe campaign upgrade

Administration exposes a separate **Allow campaign upgrades** option. When enabled, a campaign host
may request an installed, administrator-allowed target set/catalog version. An upgrade never mutates
the active campaign in place and never runs during an unresolved turn or encounter.

The engine creates a candidate next version of the same logical campaign, applies only authored
deterministic migrations, validates the complete result, and activates it atomically. If any
campaign or character migration fails, nothing changes. The prior campaign version remains a
read-only recovery snapshot, not a concurrently playable campaign fork. Class-set movement is
monotonic toward a broader set; returning to older rules uses a compatible saved character version
rather than silently downgrading active mechanics.

Set widening and catalog-definition updates are distinct but use the same versioned upgrade
boundary. A catalog update applies its class balance changes to every affected character as part of
the upgrade: retained ability IDs adopt the target version's authored effects, costs, limits,
recovery, and other definitions, while resources and progression state follow explicit migration
rules. The engine shows the affected players the mechanical delta. If an ability is removed, split,
or otherwise has no single deterministic successor, the affected player chooses from authored legal
replacements before activation; a model never selects or invents the replacement.

#### Player-owned character versions

Before applying the class migration, the upgrade transaction saves the complete pre-upgrade,
version-sensitive state of every linked player character as a durable version owned by that player.
The migrated state becomes a new version in the same character lineage. The transaction creates all
campaign and character versions or creates none.

One character lineage may therefore contain multiple independently playable rules-version
snapshots. Each character version may be active in at most one campaign, and a campaign may accept
only a compatible set/catalog version. A player may use an older snapshot in an older compatible
campaign while retaining the newer version. Once used, versions progress independently; XP,
abilities, resources, inventory, and consequences never merge or synchronize automatically.

The player may delete a version only when it is not active or linked to a campaign, through an
explicit destructive confirmation. Deleting one version does not delete the lineage or its other
versions. An incompatible newer character version is never silently downgraded: the player uses an
existing compatible snapshot or the destination campaign upgrades when administration permits it.

Campaign-specific ability wording remains campaign-scoped and player-approved under the retained
portability decisions. Rules-version migration does not authorize automatic archetype, genre-class,
character-name, or player-owned-title translation. Version snapshots are an upgrade/compatibility
mechanism, not a revival of automatic genre-translation branches or a merge workflow.

Reason:
The owner chose phased playtesting and release exposure rather than presenting the full class matrix
to every campaign or locking whole classes behind character levels. Safe campaign versions let
ongoing playtests adopt balance fixes without starting over. Saving the old player-owned character
state preserves access to older campaigns and makes the operation recoverable while avoiding a
silent downgrade. The owner settled the resulting model as one character lineage with multiple
independently playable rules-version snapshots and no merging.

Supersedes and refines:

- Supersedes the 2026-07-31 one-persistent-record/no-alternate-version rule. The new invariant is
  one lineage, per-version campaign exclusivity, and independent progression with no merge.
- Supersedes the 2026-08-02 catalog-exclusion decision's presumption and “failure of imagination”
  characterization. Exact-mechanics honesty and engine-known identifiers remain.
- Refines campaign portability: a player selects a compatible character version; mechanics never
  translate or downgrade merely to enter a campaign.
- Does not approve tier membership, a final class roster, an ability economy, migration schemas,
  upgrade UI, or runtime implementation. The partially implemented Phase PT plan must be revised
  before further portability/class work relies on its former one-record invariant.

### 2026-08-02 - Interaction burden is established by staged playtesting, not a paper admission gate (owner decision)

**Status: Active.**

The text-entry interaction-burden audit is a risk inventory. Its predicted prompt, state,
sequence, interruption, automation, and UI costs identify what a playtest must challenge; they do
not automatically admit, remove, fold, or simplify a class mechanic. Formal mechanical
distinctness is not proof that a mechanic is enjoyable in this interface, but a paper burden
analysis is likewise not proof that players will find it unmanageable or ignorable. No automatic
interaction-admission gate is approved.

The cumulative campaign sets express increasing evidence and tolerance for interaction burden:

1. **Expert (full)** contains the full candidate catalog for that catalog version, including
   unproven or deliberately demanding mechanics.
2. **Advanced** contains mechanics that have survived focused testing but still impose noticeable
   interaction or state burden.
3. **Base (recommended)** contains mechanics demonstrated to be understandable and enjoyable
   without repeated prompting.

Tier placement is playtest evidence, not a power ranking or character-level gate. Promotion,
demotion, and balance revision occur in later catalog versions; existing campaigns adopt them only
through the settled safe-upgrade procedure.

Focused interaction testing uses short paired scenarios: the same character and encounter are
played with the candidate mechanic and with a simpler version, changing only the mechanic under
test. The comparison observes:

- whether the mechanic creates meaningfully different choices;
- whether the UI guides intent or dictates a rotation;
- whether state is remembered or repeatedly forgotten;
- whether players invoke the mechanic voluntarily;
- whether automation erases agency; and
- the added prompts and turn time.

Adept, Catalyst, Armsmaster Forms, Berserker Exposure, Opportunist Openings, separately controlled
companions, and configurable loadouts therefore remain playtest hypotheses. The audit's proposed
folds and simplifications are comparison variants, not approved removals or redesigns. The separate
settled rulings that Intrusion is training rather than a class and that NPC construction is
asymmetric remain unchanged.

Reason:
The audit exposed plausible text-interface failure modes, but the owner declined to decide those
mechanics from paper analysis: “we'll have to playtest it.” Staged sets and safe catalog upgrades
exist precisely so demanding candidates can be tested, learned from, and rebalanced without
pretending their usability is knowable in advance or forcing campaigns to restart.

Refines:
This decision supplies the evidence standard for the immediately preceding campaign-class-set
decision. It does not change cumulative set selection, level-1 availability, administrative
controls, campaign/catalog pinning, safe upgrades, or player-owned character versions.

### 2026-08-02 - Fiction-first ability-keyword composer prototype plan approved (owner decision)

**Status: Active for the prototype.** Production was separately approved by the 2026-08-03
production ability-keyword integration decision below; this entry records the earlier bounded grant.

The owner approved `.agents/review/ability-keyword-composer-plan.md` for its two non-shipping slices
only. AKC-1 builds and guard-proves the deterministic owned-ability trigger matcher. AKC-2 builds a
representative browser composer in which ordinary typed ability words highlight inline, clicking an
ability inserts its canonical word at the current caret, and fuzzy spelling recovery only offers a
correction and never silently activates an ability. The prototype preserves one plain-text player
submission and stops for owner evaluation.

This approval does not authorize product integration, a turn API or database change, model-selected
mechanics, class prerequisites or action-economy rules, private narration cues, a paired class-test
verdict, external review, push, or removal of the rejected uncommitted IBP-2 runner. A later
production plan must establish canonical versioned trigger metadata and server-side validation
before highlighted recognition can become authoritative mechanics activation.

Reason:
The owner selected the plain-word interaction after rejecting prose plus a second action-selection
workflow as unrepresentative and intolerably slow for text multiplayer, then approved the bounded
prototype plan after seeing its exact scope.

### 2026-08-02 - Ability-keyword production cutover needs no generated-card migration (owner decision)

**Status: Active clean-cut data boundary.** The 2026-08-03 production ability-keyword integration
decision below separately approved implementation; this entry records the earlier data ruling.

There are no real existing campaigns whose model-generated `ruleset.abilities` entries must be
preserved for the production ability-keyword cutover. Disposable local test campaigns may be wiped
deliberately if implementation later requires a clean database. The application must not build a
rules-card-to-character conversion, name-based identity fallback, or second invocation source.

New production campaigns must instead receive stable, character-owned abilities from the eventual
versioned class/catalog path. Only those owned abilities and their campaign presentation bindings
may become keyword triggers. The superseded generated rules-card path may be retired once that real
catalog-backed creation path is ready. Code must never delete campaign data or a database
automatically; any local wipe remains an explicit operator action against a resolved disposable
target.

This clean-cut ruling is narrower than future campaign/catalog upgrade policy. Once real campaigns
exist on versioned catalogs, their settled safe-upgrade and player-owned character-version rules
still apply. Existing generic bundle-format compatibility does not authorize synthesizing owned
abilities from old free-text rule cards.

Reason:
The earlier production question assumed legacy campaign data needed preserving. The owner corrected
that premise: current campaigns are test data, so a migration path would add complexity and retain a
superseded generated-mechanics design for no user benefit.

### 2026-08-03 - Production ability-keyword integration plan approved (owner decision)

**Status: Active; implementation authorized in ordered slices.**

The owner approved `.agents/review/ability-keyword-production-plan.md`. Implement AKP-1 through
AKP-4 in order, one verified commit per slice. AKP-1 through AKP-3 may establish inert generic
matcher, authoritative server declaration/persistence, and browser composer infrastructure without
shipping prototype ability content. AKP-4 remains gated until the real versioned class/catalog and
character-creation path supplies stable character-owned abilities, complete campaign bindings, and
the family registry. No provisional roster, generated-rules-card migration, automatic data wipe,
external review, or push is authorized by this approval.

Reason:
The accepted prototype established the interaction. The approved production plan preserves that
single prose entry while making authentication, ability identity, Council context, persistence,
seat isolation, and stale-state recovery deterministic behind it.

### 2026-09-05 - Campaign and character version replanning authorized

**Status: Active planning authorization only.**

The owner authorized revising the portability plan around version storage, atomic campaign
upgrades, compatibility, and staged class playtests, then presenting the first unresolved decision.
`.agents/review/campaign-character-version-plan.md` records the resulting draft and its open gates.

This grant approves drafting and maintaining the affected records. It does not approve the draft's
authentication model, class taxonomy, catalog membership, rules economy, schemas, phase reorder,
runtime implementation, external review, or data disposal. The active 2026-08-02 versioning and
interaction-evidence decisions remain unchanged; further owner decisions come one at a time.
