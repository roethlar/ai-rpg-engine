# Catalyst NPC Integration Evidence

This is automated development evidence under the approved class-experience
implementation plan, not a human playtest, balance result, or fun verdict.
Current overall status remains in `.agents/state.md`.

## Runtime Contract

An actual completed NPC kit Main now dispatches the existing class action-completed
lifecycle after its authorized effects and movement. Its action kind and target
come from the selected canonical kit action, not a provider-authored result.
Advance, Exploit and Harmony cues can therefore pay off through the allied NPC
support that permits Catalyst selection.

Courage Cue retains its consequential-PC-check trigger and explicitly supports
an allied NPC's completed authored Main. This engine-tagged NPC completion must
match its recorded operation and round; it invents no NPC check, reroll or extra
Main. A grounded wait is not a completed NPC Main. Cue-caused movement also passes
through the movement lifecycle. The exact Courage ability description states the
NPC equivalent and the wait exclusion.

## Integrated Evidence

`test-class-catalyst-turns.mjs` calls the actual creation, progression, profile-copy,
turn and export APIs against disposable SQLite storage selected before
database imports. Only `AIClient.prototype.sendPrompt` is stubbed. The structured
setup establishes recorded NPC profiles, existing injury and conditions; tests
do not insert synthetic cues, mutate the world, dispatch synthetic lifecycle
events, grant abilities directly, or replace RNG/effect/action results.

The focused run passed with five campaigns, ten distinct authored milestone
advancements, four NPC cue kinds and one real PC aid check:

- Advance Cue moves the allied NPC after its actual kit attack. The target takes
  only that attack's authored harm, and the NPC spends only its existing Main.
- Exploit Cue survives an attack on a different enemy, then exposes its named
  target and is consumed after the actual matching NPC attack.
- Courage Cue survives waiting and table talk. A completed NPC attack clears
  its ally's recorded dazed condition, applies inspired and consumes the cue.
- An NPC rally that would repeat an already active condition is rejected before
  operation reservation. The waiting cue and complete world remain unchanged.
- Harmony Cue follows the actual NPC rally, heals the injured ally and is
  consumed. It does not produce another action.
- All five campaigns pass exact export validation. The only stored check belongs
  to the PC's ordinary aid action; NPC cue follow-through adds none.

## Verification

- `node test-class-catalyst-turns.mjs` passed on 2026-09-07.
- Removing only the NPC equivalent from the Courage matching condition caused
  the integrated test to fail because the completed NPC attack left its cue
  unconsumed. The exact change was restored in `finally`.
- Bypassing only the new NPC action-completed dispatch caused the integrated
  Advance test to fail: the ally remained at the gate instead of moving to the
  courtyard. The exact change was restored in `finally`.
- The focused suite passed again after both restorations. Syntax checks and
  `git diff --check` passed. Root owns full-entry wiring and combined verification.

No live provider or external reviewer was used for these checks.
