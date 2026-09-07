# Partner Scout Integration

**Authority:** `.agents/review/class-experience-implementation-plan.md` owns the approved class
experience implementation and completion criteria. This record covers the bounded Partner Scout
regression, not roster promotion or an enjoyment verdict.

## Defects And Repair

Partner Scout's reveal template previously used the caster as its subject. A component fixture
could hide this by putting `companion_scout` knowledge on that caster, but actual scene authoring
stores the discoverable route or threat on the destination area. `class-actions.js` now binds
that reveal scope to the canonical typed destination area, as it does for area-feature reveals.

The actual-turn regression also exposed a class-state merge defect: the effect-updated companion
position replaced the complete prepared companion object, dropping its `lastMainOperationId`.
The owner retained its Main stamp, but the companion stamp became undefined. The engine did not
use that missing companion field to grant an extra action; it was incorrect persisted bookkeeping.
The repaired merge preserves the prepared companion fields alongside the resolved movement state.

## Executed Evidence

`test-class-scout-turns.mjs` uses actual `createCampaign`, Council orchestration, authored class
progression/actions, SQLite, reload and v4 export. Only `AIClient.sendPrompt` is replaced with
deterministic setup/Council responses. No world patch or class-state injection supplies the grant,
movement or discovery. Both discoveries are authored on areas, never on the caster.

The runner starts a level-1 Bonded Partner, earns two distinct milestone advances through real
ordinary-action turns, and verifies the level-3 Partner Scout grant, retained starting ability
IDs, complete binding and invocable projection. It then:

- Scouts the adjacent courtyard while the owner stays at the gate; only the companion moves,
  no actor gains or loses health, and both shared-Main stamps identify the same operation.
- Interrupts narration after durable preparation, verifies no partial movement/discovery commit,
  reloads the pending identity, and resumes only narration using the exact original request.
- Confirms one committed turn/operation, one exact destination fact, its discovered knowledge
  flag and typed area subject in the persisted reveal receipt. A completed retry changes neither
  the world nor counts. The safe unopposed fixture deliberately requires no random check.
- Reloads and validates an actual export containing that one fact and the recorded invocation.
- Scouts back to the gate using a second area-authored fact, then repeats the courtyard request.
  The destination is adjacent again, so this is a no-new-discovery rejection rather than an
  already-at-destination rejection. The whole world, turn/operation/check counts and revision stay
  unchanged, and no pending action is reserved.

## Failure Proof

Removing `companion_scout` from the destination-binding branch made the class-action matrix fail
Partner Scout with no matching discovery; restoring the binding returned that matrix green.
The actual-turn runner independently failed against the original whole-object merge: its shared
Main assertion compared the owner's real operation UUID with an undefined companion stamp.
After the merge repair, the complete standalone Partner Scout runner passed, including all later
retry, persistence, export and repeated-discovery assertions. These are observed failures, not
claims about unexecuted mutations.

The standalone runner imports only Node builtins statically. It assigns a new temporary
`RPG_DB_PATH` before dynamically importing any application module, closes the database and removes
the temporary directory afterward. `test.js` also invokes the runner inside its disposable suite.
The evidence is automated integration coverage, not a live-provider or willing-player playtest.
