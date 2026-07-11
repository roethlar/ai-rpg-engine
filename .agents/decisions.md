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

### 2026-07-03 - Owner settings live at /admin gated by ADMIN_SECRET; player panel keeps only player-appropriate settings

Status: Active

Decision:
The mechanism for the server-owned AI configuration decision (2026-06-11) is a
separate `/admin` page, not linked from the game UI, gated by a master password
(`ADMIN_SECRET` env var) distinct from the player `ACCESS_SECRET`. All AI
configuration — provider, model, API keys, custom endpoints, voice API key/model,
and fallback tier — is managed there and persisted server-side. The player-facing
settings panel keeps only player-appropriate settings: server access token, voice
narration preference (on/off, voice choice, style instructions), and diagnostics.
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

### 2026-07-03 - Rulesets are selectable at campaign start; a lightweight house system is the default

Status: Active

Decision:
Campaigns choose a ruleset at creation. The default is a lightweight house
system generated for the campaign (built on the engine's existing d20 +
attribute-modifier vs DC resolution), documenting the campaign's abilities/
spells with costs and limits. Open-source systems (d20/SRD-style, licenses
verified before adoption) join as additional options later. Whatever is
chosen, the ruleset is persistent campaign state — Council-consultable and
player-viewable — and canon for the campaign's lifetime (consistency
requirement from the 2026-06-13 topic). Owner judges the house-default
implementation before the option list grows.

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

### 2026-07-11 - Rules system REOPENED: games need a working, user-predictable system; freeform is not viable for multiplayer

Status: Active

Decision:
The rules-system question is reopened. Owner requirement: the engine must
provide a working rules system that is *predictable to the user* — players
can learn the rules and rely on them being applied the same way every time.
The no-rules path (`rules_mode` off / ruleset "none") is judged "just AI-led
storytime" and not useful for a multiplayer game. What ships — the generated
house sheet hardened into something reliable, an adopted external system
(back on the table), or another design — and what happens to the freeform
option are OPEN design questions. Per the phased-development contract,
nothing is implemented until a concrete plan/phase is approved.

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

### 2026-07-04 - External rulesets dropped; the generated house system is the system

Status: Superseded (rules system reopened 2026-07-11 — see the decision above)

Decision:
No third-party/SRD rulesets will be adopted. The campaign-generated house
ruleset (decision 2026-07-03) is the engine's rules system, full stop.
docs/ruleset-licensing.md stays as evidence if this is ever revisited.

Reason:
Owner 2026-07-04 ("forget the system") after rejecting whole-work
attribution framing (Fate, ORC); the house system already covers the need.

Supersedes:
The "open-source systems join as additional options later" half of the
2026-07-03 ruleset decision, and the SRD-options item in the build queue.
The house-default and canon-state halves of that decision stand unchanged.

### 2026-07-04 - Owner delegation: open calls decided by the agent, plans approved by external review loop

Status: Active

Decision:
For the 2026-07-04 work queue (multiplayer foundations, visual gap closers,
table-style dials, holodeck entry state, campaign portability): undecided
design questions are decided by the agent and recorded here; plans are
written into plan.md and approved through an external-reviewer loop (codex
CLI review, iterate until findings are resolved) instead of owner sign-off.
Nothing is gated on the owner until the multiplayer playtest, which is the
next point where feel gates close.

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

### 2026-07-05 - Multiplayer is an OPEN question; all multiplayer work parked

Status: Superseded (multiplayer reopened 2026-07-09 — see the decision above)

Decision:
Multiplayer — its meaning, scope, and whether/when to build it — flips back
to an open, undecided question. The multiplayer playtest is parked. No
further multiplayer work (no S2 visibility scoping, no S3 UI rewire, no
Phase 3 extensions) until the owner reopens the topic. Code already landed
(multi-character schema, turn order, seats/S1) stays in the tree: it was
built to leave solo play unchanged and verified so; reverting is available
on the owner's word but was not requested.

Reason:
Owner 2026-07-05: "this is not what I want. multiplayer flips back to open
decision, testing is parked. I cannot work on this now."

Supersedes:
The 2026-07-05 multi-user decision below and the 2026-07-04 multiplayer-v1
decision as ACTIVE direction — both become recorded design history, not
mandates. The next-playtest-closes-all-gates framing is void; no playtest
is pending.

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

### 2026-07-04 - Multiplayer v1 shape: shared token, round-robin turns, in-app-later chat

Status: Superseded (in part — see 2026-07-05 multi-user decision above)

Decision:
The first multiplayer cut (Phase 3) is deliberately minimal: players share
the existing ACCESS_SECRET token (per-player auth stays future); a campaign
holds multiple characters, each browser selects which character it plays;
turn order is round-robin over active characters (initiative is stored on
characters for future use but does not order v1); the server enforces
whose turn it is. The player-communication fork is decided in favor of an
in-app, fully-loggable player-only text channel — but it is a later slice,
not v1; the never-routed-to-GM boundary recorded 2026-06-13 applies when it
lands. Single-player campaigns must behave exactly as today (an order of
one).

Reason:
Owner wants the next playtest to be multiplayer ("so I can get other
opinions", 2026-07-04) and previously wanted early two-browser solo
testing; the smallest honest version of that is shared-token + turn
enforcement. In-app chat wins the fork because external tools cannot honor
the log-everything requirement (recorded 2026-06-13 tension).

Supersedes:
Nothing; concretizes the Phase 3 skeleton and the player-channel fork
direction. The multiplayer end-state vision in plan.md is unchanged.

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

### 2026-06-05 - Council DM pipeline is canonical; clarification turns must not advance state (from plan.md + code)

Status: Active

Decision:
Player turns use the ordered Council pipeline (Interaction → Continuity → Referee → Continuity archive/final → Narration) and present as a single DM voice. On clarification or dialogue turns (input_kind), state changes (character, quest, NPC, memory, dice, abilities) must be forced to no-op. Scene grounding is required on clarification turns. The old single-model path is deprecated and slated for removal.

Reason:
Supports richer back-and-forth without world mutation on questions; anti-hallucination via multiple agents; matches the implemented behavior in rpg-engine.js, rpg-state.js (validateTurnData clarification safety net), and test.js assertions. Earned from Phase 0 work to fix "too video-gamey" complaints.

Supersedes:
Any prior single-model toggle or default path assumptions (now unreachable per plan).
