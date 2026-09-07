# Rider Reachability Completion

Status: implemented in the shared tree for integrated verification; no human enjoyment or
balance claim. Owner-authorized completion of required class mechanics, after the read-only
completion audit found component-only hull repair, absent vehicle-scale NPCs, and no replacement
after loss. Runtime semantics are canonical in `docs/rules/effects-runtime-v1.md`.

## Runtime Boundaries

- `class-scenario.js` has an authored `mounted` independent NPC kit, vehicle scale, ordinary
  actor attack and explicit hull attack. It has one Main, never a PC class or NPC roll.
- `class-ordinary.js` authorizes hull attacks against the actual opposing occupied current-scene
  craft, with the existing exact kit, range, visibility and round budget guards.
- `rules-effects.js` makes zero hull a preserved lost craft and disembarks without changing
  actor life or position. Loss and the craft's tied obstruction clear are tentative/atomic.
- `class-actions.js` enforces Targeted Run's scale, actual vehicle occupancy, bounded explicit
  obstruction bypass and fixed hazard harm. `class-progression.js` provides an explicit safe
  recovery replacement Main with a new identity and preserved original wreck links.
- `class-scene-author.js` requires Rider-enabled initial recovery support reachable through
  connected clear areas. `class-journey.js` leaves empty lost wrecks behind when the party walks.
  Council post-transition events use only a current-location subset of already accepted
  permission refs, preventing a defeated old-scene NPC from invalidating arrival.
- Reusable assignment state contains no foreign live wreck links. Original campaign snapshots
  retain the wreck and reciprocal replacement refs; full campaign import remaps both.

## Evidence

`node test-class-rider-turns.mjs` uses a system temporary database selected before every
application import. Its exported runner refuses a missing/non-temporary path. All narrative
responses are stubbed only at `AIClient.prototype.sendPrompt`; no direct world damage injection,
manual XP write, fake ability activation or hand-edited identity mappings are used.

The focused integrated run passed eight campaigns, fifteen actual advancement turns, fourteen
actual NPC hull attacks, a damaged active repair with narration outage/resume and exact one-use
charge, genuine zero-hull loss with unchanged operator health, ordinary defeat of the opposing
unit, a walking journey leaving the wreck behind, safe replacement, normal reload and campaign
export/import. It also executes Targeted Run against an actual vehicle-scale actor, rejects a
person target, rejects unselected obstruction and blocked-area routes, executes an explicitly
selected bypass without removing the hazard or its five hull consequence, and executes Driving
Impact against a newly authored mounted NPC. A copy after replacement exports/imports with one
new assignment, no dangling wreck references, and unchanged original campaign history.
Evasive Course then supplies its recorded owned-craft footing to an actual checked Break Pursuit
turn, producing one persisted d100 PC check. Wrong craft/token sources reject before reservation;
non-Pilot, unoccupied, remote, wrong-operator and inconsistent-condition contexts cannot supply
the typed candidate. NPC hull attacks themselves produced no checks.

`test-rules-effects.mjs` retains the passenger-health/status/position safety assertions, adds
explicit disembark/lost status expectations and proves a later invalid effect rolls back loss.
The earlier zero-hull-active assertion was replaced only because the newly explicit authored
loss lifecycle supersedes it; passenger casualty/displacement protections were not bypassed.

Guard proofs, each restored in `finally`, then followed by the passing focused integrated run:

1. Removing initial Rider recovery-support enforcement made the real unsupported-creation
   rejection assertion fail with `Missing expected rejection`.
2. Removing Targeted Run scale enforcement, with otherwise valid complete NPC branches, made
   the real person-target rejection assertion fail with `Missing expected rejection`.
3. Removing current-location permission subsetting restored the actual post-combat journey
   failure, `Actor npc:3 is outside the current scene`, before destination allocation committed.
4. Removing the exact acting-operator check allowed a foreign-operated craft to supply the
   Evasive Course candidate; its negative assertion failed. The guard was restored and the
   complete eight-campaign suite, including the checked Pilot turn, passed again.

The same actual copied-profile roundtrip exposed stale pre-binding item IDs in creation
baseline inventory. That separate lifecycle finding is owned and recorded by its fixing agent;
this suite retains the real roundtrip assertions and does not bypass its identity guard.

Root owns the final combined unit/browser runs and completion-plan updates. Stubbed integration
demonstrates reachability and consistency, not human playtest fun or calibrated encounter balance.
