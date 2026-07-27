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

### 2026-07-15 - Claude Code Fable 5 is the reviewloop reviewer

Status: Superseded as an automatic default by the 2026-07-26 opt-in decision

Decision:
Independent reviewloop dispatches for Codex-authored plans and code use Claude Code with the exact
`--model claude-fable-5` argument. Grok is not dispatched. Review remains fail-closed: a missing,
invalid, mismatched-SHA, or incomplete Claude envelope is not acceptance, and the implementation
author still cannot review their own work.

Reason:
Owner wording (2026-07-15): **"skip grok going forward and stick with claude --model
claude-fable-5 for reviewloops"**. One consistently specified independent reviewer is the desired
review process; repeated Grok envelope failures were not useful review signal.

Supersedes:
The Claude + Grok dual-acceptance requirement for new admin model-registry plan rounds and any
repo-state wording that names Grok as a required reviewer. Historical dual-review verdicts remain
valid evidence for the SHAs they accepted.

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

### 2026-07-14 - Division of labour: codex IMPLEMENTS, Claude PLANS and ADVERSARIALLY VERIFIES

Status: Superseded as the default workflow by the 2026-07-26 opt-in decision

Decision:
The reviewloop's roles are **reassigned, not abandoned**. For work that is well-specified by an
accepted plan, **codex writes the implementation** and **Claude reviews it adversarially**. Claude's
job moves upstream: interrogate handed-over material, establish facts by experiment, write the plan,
and attack the result. The loop's independence is preserved by *swapping* the roles, never by
dropping the second pair of eyes. Owner wording (2026-07-14): "codex implement and judge the
outcome… continue with this revised workflow."

Superseded: the 2026-07-12 decision's assumption that Claude codes and codex reviews. The rest of
that decision — **all code goes through the loop, unconditionally; planning completes before coding**
— is UNCHANGED and still binding.

Reason — decided by a controlled experiment, not by preference:
Both agents implemented the SAME accepted plan (Phase CT), independently and blind. The results were
compared on evidence (`.agents/review/findings/ct-1.md`):

- **Correctness: a tie.** Both were behaviourally identical to each other AND to an oracle
  transcribed from the original writer, across four cases including edge conditions. Both survived a
  9-defect mutation battery, including two mutations that emit perfectly valid CSS.
- **Completeness: codex won.** It updated `README.md` (Claude forgot), asserted the emitted SVG
  source (Claude skipped it), and rewrote the dangerous superseded plan clause rather than merely
  annotating it. It followed the plan more literally and did not get bored and skip a step.
- **Speed: codex won decisively** — ~4.5 minutes against a much longer Claude session.
- **Reliability: codex won.** Claude's own mutation script silently corrupted its working tree (a
  `git checkout` that rejects the whole command when one path is untracked), and Claude came within
  one verification step of committing four injected defects.

Where Claude demonstrably added value on the same day, and where it should therefore be pointed:
refusing a handed-over plan document that was largely fabricated; establishing an API's real
behaviour **by experiment** when both the vendor docs and the model's own self-description were
wrong; finding that a "just register a provider" task was blocked by a structurally coupled voice
layer; and being wrong about the css-2 scanner in a way the loop caught. That is planning,
verification and judgement — not typing.

Consequences:
- A plan must be good enough for a **cold** agent to execute. Plan reviews now include a
  cold-implementer lens ("could a context-free agent execute this and get it right?") alongside the
  correctness lens. That lens found what four correctness rounds missed — twice — including that the
  plan's own commits were stranded on a branch the plan forbids merging.
- codex cannot review what codex wrote. When codex implements, **Claude is the reviewer**, and the
  review must be adversarial and executed (mutation testing, oracles), not read-and-approve.
- Design-heavy or trust-boundary work (e.g. Phase V, which touches the seat/auth boundary) may still
  warrant Claude implementing, with codex reviewing. Choose by the nature of the work, not by habit.

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

### 2026-07-12 - All code goes through the reviewloop playbook; plan first, then code

Status: Superseded by the 2026-07-26 opt-in review decision

Decision:
Every code change goes through `.agents/playbooks/codereview.md` with an independent
reviewer. This is unconditional and there is no per-change exemption: size, urgency,
obviousness, an owner go on the change itself, and a passing test suite are all
irrelevant to whether the loop is required. An owner approval to *make* a change is
not an approval to merge it unreviewed. Docs-only changes are outside this rule.

The original assignment (Claude codes, Codex reviews) was superseded by the 2026-07-14
division-of-labour decision. The default is now Codex implementation with Claude planning and
adversarial verification; roles may swap, but authors never review their own code.

Sequencing: planning completes before coding starts. Work is planned — and, where the
playbook calls for it, the plan itself is review-accepted — before implementation
begins. "Get everything planned, then coding can start" (owner, 2026-07-12).

Consequence for work already on disk: any code branch built without going through the
loop is unreviewed and must not be merged until it has. As of this decision that names
`fix/map-label-overflow` @ `b178222` (the Situation-panel label fix — owner-approved to
build, built, suite green with a proven revert-guard, but never review-dispatched).
It stays parked and enters the loop when coding starts.

Reason:
The loop has repeatedly earned its keep on this repo, and the failures it catches are
exactly the ones a passing suite does not: on the 2026-07-09 seat-visibility round, four
of six findings were reopened by the reviewer and every reopen named a real defect —
including two that were caught only because the *fixes themselves* were re-reviewed. Two
guards were caught being vacuous in the same period. A change that looks obviously
correct to its author is precisely the change that gets merged without a second pair of
eyes, so exempting "small" or "obvious" changes would exempt the highest-risk ones.
Planning first exists so the loop reviews a plan against intent rather than reverse-
engineering intent from a diff.

Supersedes:
Nothing. Tightens the standing development contract (2026-06-05, above) — that decision
gates *phases* on a playtest; this one gates *every code change* on the review loop and
puts planning ahead of implementation.

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
valence tags. Next deliverable: the catalog document, drafted and run through the reviewloop like
the resolution chapter. The accepted catalog document still gates edge-band implementation; no
rules code before a concrete phase and an owner-approved plan. The D2 decision unblocks the D3,
D5, and D13 queue discussions.

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
