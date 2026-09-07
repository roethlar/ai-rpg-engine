# Class Experience Implementation

**Authority:** owner 2026-09-07: "you have enough info from me to understand what I want? if so,
implement it. all gos are given. if not, ask questions." The agent confirmed sufficient direction.
This delegates the remaining design and implementation choices for the class experience, including
its necessary rules/catalog/creation integration. It supersedes prior planning-only stops within
this scope. It does not authorize unrelated product work, destructive cleanup, history rewriting,
or an external reviewer. No further class-by-class or ability-by-ability owner approvals are needed.

**Status:** implementation active. No completed runtime or enjoyment claim.

## Required End State

1. Real campaign creation and joining offer authored, mechanically distinct class packages, with
   coherent starting grants and progression. All eleven candidate families, their distinct branches,
   and the optional Rider module receive coverage. No paper simplification silently removes a class.
2. Abilities provide useful distinctive capabilities with engine-enforced costs, targeting,
   prerequisites and effects. Ordinary actions remain available without class declarations.
   Routine spells such as magic missile and fireball need no prerequisite keyword/combo sequence.
   Richer magic can earn additional choices or preparation. Optional combinations are not required
   to make a basic action worthwhile. The canonical fun-per-action decision owns this criterion.
3. Keep one prose submission, deliberate ability selection and the existing insertion/recognition
   contract. No second action/target/stance picker, no model-inferred undeclared powers, no silent
   best-tactic automation. The player need not memorize invocation syntax.
4. Use the signed d100 resolution and versioned effect vocabulary for target-rule campaigns.
   Engine-owned checks and state transitions, including NPC consequences, bind narration. A class
   card or Council prompt alone is not an implemented mechanic. Needed catalog extensions are
   documented and versioned, not improvised per campaign or hidden in prose.
5. Resolution is durable and idempotent: checks commit before narration, their outcome fields are
   immutable, annotations append once, and retry after provider failure cannot reroll or charge
   twice. Table talk and rejected actions cannot mutate game state or consume a turn.
6. Character-owned opaque ability IDs, definition versions, invocation families and complete
   campaign bindings activate the existing composer. Creation, joining, progression, save/reload,
   fork/export/import and seat views preserve identities and authoritative state. Existing legacy
   campaigns are not silently converted or given guessed entitlements.
7. Campaign/catalog pins preserve reproducibility. Respect the settled class-set and safe-upgrade
   contracts; untested candidate designs belong to the development Expert catalog, not fabricated
   Base/Advanced evidence. Incompatible or unknown versions fail explicitly without data loss.
8. Verify full creation-to-play flows on desktop/mobile, all class-family mechanics, routine and
   exceptional magic, mixed-party interactions, progression, retries and persistence. Run the
   repository suite, browser suite for CSS changes, guard-failure proofs, and a bounded integrated
   session. Report human enjoyment as unverified unless actual willing-player evidence exists.

## Delivery Sequence

Each slice is committed with focused evidence and state updates. Incomplete slices do not redefine
the goal as a smaller task. Independent modules can proceed in parallel; root owns integration.

1. **Foundations:** authored catalog, signed d100 evaluator, durable operation/check/annotation
   store, and functional creator controls. Define module APIs before integration. Tests cover the
   full candidate inventory and all d100 boundary cases, duplicate logical keys, and rollback.
2. **Executable mechanics:** versioned ability/action authorizer and effect evaluator, finite
   class state/resource lifecycles, ordinary-action comparison, NPC vitals and encounter state,
   progression and recovery. Spell outcomes must exist in stored state. Document new effect
   operations and numerical configuration without changing signed resolution semantics.
3. **Creation and persistence integration:** catalog selection and bindings in actual create/join
   flows, complete sheets/help, campaign pins, portable snapshot fields, compatibility guards,
   and no generative entitlement path for target-rule characters.
4. **Council integration:** validate intent/targets against authored grants, perform Continuity's
   pre-roll check, commit rules outcomes before narration, validate edge annotations, and stamp
   canonical effects/rolls into history. Preserve no-op, turn ownership and retry behavior.
5. **Experience verification:** desktop/mobile creation, insertion, casting, exceptional actions,
   varied encounters and party workflows, full regression suite, fault injection, and explicit
   completion audit against every requirement above. Start a local server and provide its URL.

## Ownership And Files

- Root: this plan/decisions/state, `plan.md`, pure `rules-resolution.js`, test entry wiring,
  `rpg-engine.js` integration and cross-module verification.
- Catalog agent: `class-catalog.js`, its focused tests, class coverage and design records.
- Storage agent: `rules-store.js`, additive `db.js` schema, focused persistence tests; subsequent
  campaign/character pin and snapshot work by explicit file assignment.
- Interface agent: `public/class-creator.js`, `public/app.js`, `public/index.html`, scoped styles
  and focused browser tests. Use current icons/components and preserve the single composer.
- Later effects/rules work: dedicated modules and tests, assigned after foundation contracts agree.
- `rpg-state.js`, `server.js`, bundle fixtures and existing tests change where integration requires.

The rejected interaction runner is untouched. Prototype fixtures are evidence, never production
catalog seeds. Player-key recovery, unrelated voice work and campaign-outline redesign remain
separate unless an actual class-path dependency is established. No real user data is used for tests.

## Verification Record

- Baseline 2026-09-07: `node test.js` passed against its disposable database.
- Signed evaluator foundation: `rules-resolution.js` implements exact call shape/actor binding,
  bounded enumerated deltas, target arithmetic, ordered d100 bands, stakes licenses and immutable
  core record construction. It performs no semantic Continuity judgment or persistence itself.
  `test-rules-resolution.mjs`, wired into `node test.js`, passed all 9,800 raw/target combinations,
  arithmetic/clamp/license examples and invalid-input/immutability guards. Mutation proof:
  widening the marginal-success comparison from `< 5` to `<= 5` failed with `6 !== 5`; restored,
  the complete `node test.js` suite passed. Runtime activation remains pending.
- Other foundation implementation and all end-to-end requirements remain pending.

## Completion Audit

For each numbered requirement, record concrete current code and test/runtime evidence, not intent.
Foundation tests alone do not prove creator/runtime integration. Mocked UI responses do not prove
actual creation or effects. Agent agreement does not prove fun. Missing or contradictory evidence
keeps the goal active; do not mark complete at a convenient intermediate slice.
