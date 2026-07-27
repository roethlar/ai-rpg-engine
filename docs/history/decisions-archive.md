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
