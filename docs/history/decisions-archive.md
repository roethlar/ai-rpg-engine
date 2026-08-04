# Agent Decisions — Archive


### 2026-07-04 - External rulesets dropped; the generated house system is the system

Status: Superseded (reopened 2026-07-11; D0 settled the replacement frame 2026-07-12)

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

> Archived 2026-07-26 (refresh auto-archive): the entry carried a closed status; the lifecycle rule moves closed entries here verbatim.

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

> Archived 2026-07-26 (refresh auto-archive): the entry carried a closed status; the lifecycle rule moves closed entries here verbatim.

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

> Archived 2026-07-26 (refresh auto-archive): the entry carried a closed status; the lifecycle rule moves closed entries here verbatim.


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

> Archived 2026-08-04 (refresh auto-archive): the entry carried a closed status; the lifecycle rule moves closed entries here verbatim.

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

> Archived 2026-08-04 (refresh auto-archive): the entry carried a closed status; the lifecycle rule moves closed entries here verbatim.

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

> Archived 2026-08-04 (refresh auto-archive): the entry carried a closed status; the lifecycle rule moves closed entries here verbatim.
