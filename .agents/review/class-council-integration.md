# Class Council Integration Evidence

This is automated development evidence under the approved class-experience
implementation plan. It is not a human playtest, balance result, or fun verdict.
Overall completion remains tracked in `.agents/state.md`.

## Test Boundary

`test-class-turns.mjs` calls the real `createCampaign`, `joinCampaign`, `takeTurn`,
`getCampaignState` and `exportCampaign` APIs against disposable SQLite storage.
Only `AIClient.prototype.sendPrompt` is stubbed. The fixture supplies structured
setup/Council responses, not resolved actions or check results. Random d100 rolls,
authored costs, typed effects, NPC state, progression, checkpoints and ledger
commits execute through their real modules.

## Verified Cases

- Creation ignores narrated XP and invented abilities; the authored level-one
  Wizard can invoke Magic Missile directly against a recorded NPC. NPC health
  changes agree with the actual signed random outcome, and the committed turn
  contains its invocation, immutable check and exact world snapshot.
- Clarification, including an ability name, preserves world state, revision and
  round. It adds no action operation or check; an exact response retry adds no
  duplicate transcript. The no-op transcript still carries an exact snapshot.
- An invalid target exhausts bounded Referee repair without reserving a rules
  operation or writing a turn, check, resource change or world revision.
- A provider narration failure happens after a real Fireball check is durable.
  The accepted action remains pending across a state reload. Its world and cost
  are not partially applied. Changed text or another request cannot replace it.
- The retry resumes only narration, preserves the stored check ID/raw record,
  commits one Fireball recovery use and one Main, and clears pending state.
  Repeating the completed request makes no provider call or duplicate write.
- A mixed Wizard/Fighter table rejects out-of-turn committed actions before
  reservation while allowing off-turn questions without time advancement.
- Two distinct established milestone awards advance the Wizard from level one
  to three. Existing owned IDs remain stable and the new authored grant receives
  its campaign binding in the same commit. Retrying an older completed award
  cannot duplicate XP, downgrade the current sheet or restore an old snapshot.
- Both successful-turn campaigns pass exact v4 export validation.

## Runs

- `node test-class-turns.mjs` passed.
- Twelve additional complete runs with fresh real RNG passed, comprising 24
  newly committed checks. This is repetition evidence, not exhaustive band coverage.
- `test.js` invokes `runClassTurnTests` after the other database lifecycle suites.
- `node test.js` passed with the turn suite integrated on 2026-09-07.
- `git diff --check` passed.
- Guard proof: removing only the existing-operation comparison against original
  player text caused the changed-text/same-request test to fail with
  `Missing expected rejection`. The comparison was restored in `finally`, and
  the focused suite passed again. Lower store idempotence remained enabled.

No external reviewer or human player participated in these checks.

## Council Module Checks

`test-class-council.mjs` exercises `prepareClassCouncilTurn` and
`resumeClassCouncilTurn` directly. Only `AIClient.prototype.sendPrompt` is stubbed;
creation of authored sheets and structured scenes, ordinary/class authorization,
effect evaluation, SQLite operation/check/annotation persistence and deterministic
d100 resolution all use the actual modules. Every standalone run creates and
removes its own disposable database. `runClassCouncilTests` is also called by
`test.js` after the live engine-turn suite.

Verified on 2026-09-07:

- The Interaction, Continuity grounding, Referee, Continuity pre-roll and Narration
  stages occur in order. Qualitative pre-roll input excludes arithmetic fields and
  remains strict JSON without undefined optional properties.
- Structural arithmetic-bearing check requests and rejected semantic pre-roll
  judgments bounce before a check or durable operation exists. An ability selected
  without the explicit owned declaration is rejected; mentioning a spell in an
  off-turn question remains table talk with no mechanical action.
- Magic Missile resolves as a direct declared spell with distinct success/failure
  branches and no combo preparation. Typed mundane cover is ignored, while magical
  cover remains an eligible circumstance; feature names cannot establish origin.
- No-roll utility never calls RNG. NPC kit consequences create no extra checks,
  use the common harm hooks and consume the current NPC round budget. A downed last
  registered PC is skipped without suppressing the actual NPC round boundary.
- Deterministic clean-success, clean-failure, marginal-success and marginal-failure
  checks preserve their original binary outcome. Edge annotations never turn a
  failed attack into a hit or remove a succeeded hit.
- Accepted critical annotations store engine-stamped resolved effects, including
  catalog version, pricing prestate and actual applied quantity. Class prevention
  transforms are validated under the annotation valence/budget before the one-shot
  append and tentative-state checkpoint are committed together.
- Invalid valence and overlong annotation text exhaust the same two-proposal limit
  and persist a null annotation with bounded rejection text. A valid proposal is
  checkpointed before Continuity review; transport interruption resumes that
  proposal, does not consume another semantic attempt and cannot grant a third
  proposal after one prior rejection.
- Narration interruption resumes the durable resolved state and original check
  without another Referee call or RNG invocation. A narrated-operation retry is
  inert. A two-working ritual can continue in plain language from its exact saved
  bindings without another declaration or an invented power.

The module fixes cover the strict NPC-context mismatch, undefined qualitative
projection fields, structural check-bounce error classification, annotation
resolved metadata and durable proposal/rejection state, and the skipped-PC round
boundary. Annotation prompts now list the actual permitted primitive parameter
shapes and enum tokens, excluding ability-only and ordinary-only extensions.

Verification: `node test-class-council.mjs` and the complete `node test.js` passed
with the module suite wired. The required guard proof removed only the existing
owned-declaration check; the undeclared Magic Missile test failed with
`Missing expected rejection` at its assertion. The guard was restored and the
focused suite passed before the full run. `git diff --check` passed.

These are bounded automated checks, not model-quality, human-playtest or balance
evidence. They do not establish complete runtime reachability: the recorded-death
and willing-return lifecycle needed for revival, future-scene materialization for
remote travel, and the full class selector context remain integration work tracked
by the active implementation plan. No external reviewer was invoked.
