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

### Runtime State Contract

`campaigns.rules_state_json` owns a target campaign's mechanical world, with a compare-and-swap
`rules_revision`. `class-state.js` validates authored selection/pins and projects world actors;
`class-store.js` writes world and character/profile/NPC/location projections in one outer database
transaction. Profile class snapshots are portable saved state, not competing live world authority.
`characters.class_build_json` preserves selected identity; approved binding rows include aliases.
Owned ability IDs persist across reload and saved class use. No generated opening grant can
replace the authored sheet, and a legacy profile cannot silently become a class build.

World actors use exact character/NPC references. Companions have real NPC identities and one
shared Main; vehicles have typed records. Authored equipment metadata comes from exact catalog
IDs. `world.turnOrder` and each PC's `tableStatus` preserve cursor and membership for exact history
snapshots. `turns.rules_snapshot_json` owns each committed turn's world; imported check artifacts
will use `campaigns.rules_history_json` rather than colliding with live globally unique check IDs.

`class-scenario.js` binds a closed pre-DB actor-key roster to assigned IDs after scene validation.
Setup describes presence, authored asymmetric NPC profiles, actual map objects/features and stored
discoverable facts, never class grants or free numeric combat values. Every map feature must be
materialized explicitly. Target creation fails before commit if the layout/frame/world support is
invalid. Until the Council path is connected, target turns explicitly refuse to enter legacy d20
mutation logic. This temporary integration guard is not the delivered end state.

### Results

- Baseline 2026-09-07: `node test.js` passed against its disposable database.
- Signed evaluator foundation: `rules-resolution.js` implements exact call shape/actor binding,
  bounded enumerated deltas, target arithmetic, ordered d100 bands, stakes licenses and immutable
  core record construction. It performs no semantic Continuity judgment or persistence itself.
  `test-rules-resolution.mjs`, wired into `node test.js`, passed all 9,800 raw/target combinations,
  arithmetic/clamp/license examples and invalid-input/immutability guards. Mutation proof:
  widening the marginal-success comparison from `< 5` to `<= 5` failed with `6 !== 5`; restored,
  the complete `node test.js` suite passed. Runtime activation remains pending.
- Ledger projection foundation: `sanitizeDiceRollRecords` now preserves signed d100 records
  without requiring legacy total/DC fields and rejects contradictory arithmetic without a d20
  fallback. `normalizeCheckRecord` checks core arithmetic and the annotation envelope; actual
  effect authorization remains the effects consumer's responsibility. Disabling the d100
  projection branch made the new history assertion fail; after restoration, the full suite passed.
  Signed history retains all checks rather than applying the legacy three-check display cap.
- Other foundation implementation and all end-to-end requirements remain pending.
- Durable resolution foundation: `rules-store.js` and additive `db.js` tables persist operation
  bindings/checkpoints, immutable checks and one-shot annotations. One pending world action per
  campaign prevents overlapping unresolved operations even when table-talk history advances.
  Focused tests cover concurrent retries, changed-input rejection, cross-process reload, immutable
  SQL updates, annotation/completion rollback, queue isolation, null finalization and cascades.
  Disabling the input-binding guard failed the expected-rejection assertion; restored tests passed.
  `runRulesStoreTests` is wired into `node test.js`; the combined suite passed. Council orchestration
  and actual class effects still need to use this store before the retry end state is achieved.
- Authored catalog foundation: `class-catalog.js` defines 24 branch packages, 168 explicitly
  versioned abilities, levels 1-10, starting equipment/skills, profiles and closed handler contracts.
  `test-class-catalog.mjs` passed 240 sheets and 936 real declaration projections, with a proven
  Expert-only admission guard. `.agents/review/class-catalog-design.md` owns detailed design and
  evidence limits. The combined repository suite passed with the catalog present. Creation,
  effect and interface integration remains in progress; this is not complete gameplay evidence.
- Effect evaluator foundation: `rules-effects.js` implements strict typed references, ordered
  tentative transactions, conflict/no-op guards, signed annotation budgets and the documented
  `effects-class-runtime-1` extensions. `test-rules-effects.mjs` executes all 36 advertised
  operations and the catalog dependency set, including NPC vitals, vehicle hull, direct spell
  permissions, exact stored discoveries and the narrowly authored Refuse Defeat floor. Removing
  conflict rejection failed the duplicate-harm assertion; restored tests passed. Full Unicode
  case folding uses exact pinned `unicode-case-folding` 1.1.1, with its primary-source generator
  and license checked. `docs/rules/effects-runtime-v1.md` owns schema/calibration details. These
  component results do not claim Council, class lifecycle or narrated gameplay integration.
- Creation integration working evidence: `test-class-creation.mjs` uses actual HTTP catalog,
  create and join routes with a disposable SQLite store and only the provider prompt boundary
  stubbed. One spellcaster is created and all 24 branch packages join through real persistence;
  reload keeps abilities/trigger revisions, generated extra grants are ignored, and world writes
  synchronize projections. Removing the world revision guard failed the stale-write rejection;
  after restoration the focused checks passed. `test-class-state.mjs` covers all branches and
  atomic missing-companion rejection. `test-class-scenario.mjs` covers 37 invalid frame cases,
  all NPC kits and actual effect consumers; removing map completeness failed its guard. These
  runners are wired into `test.js`; the combined suite passed before the newest HTTP additions,
  and will be rerun with seat/UI integration before that slice lands. Actual Council play remains
  pending, and no human enjoyment claim follows from provider-stubbed tests.
- Class execution components: `class-actions.js` and `class-progression.js` execute 144 active
  definitions across 56 modes/15 handlers, including class-vs-class brace/ward/floor interactions,
  full rituals, explicit profile/preparation choices, scene transitions, recovery and advancement.
  Tests use the real class/world adapters; 216 progression transitions retain old owned IDs and
  missing health. Disabling the cadence guard failed the exhausted-use assertion; restored tests
  passed. Transfer cleanup ends scene-owned state without refilling persistent resources or
  dereferencing old scene targets. Required equipment and vehicle effect metadata are authored,
  not inferred from labels. All component, creation and seat runners now pass together in
  `node test.js`. The Council has not yet activated these components for live actions.
- Creation/interface integration: actual HTTP catalog/create/join routes now instantiate the
  pinned authored sheet, immutable bindings and a concrete scene in a single activation transaction.
  All 24 branch joins, saved copies, independent vehicle identities and reload pass against real
  SQLite; only setup prompts are stubbed. The HTTP fixture owns its app/limiter history rather than
  weakening rate limits. `class-portability.js` validates/remaps exact worlds, historical cursors,
  per-profile retained ability IDs and immutable check provenance in component tests. Legacy
  export/import/fork paths explicitly refuse target worlds until those helpers are integrated.
- Creator/seat interface: the shared create/join modal, complete authored card previews, optional
  concept, failure/draft states, sticky submit controls and mobile same-list ability drawer pass
  `npm run test:browser`. These creator API fixtures are mocked; `test-class-seats.mjs` separately
  proves actual seat API/browser behavior with real target characters and 12 recorded d100 checks.
  Privacy and count-cap guards were removed one at a time, failed, and were restored. Unsafe
  imported annotation detail has an explicitly partial display projection and text sidecar, never
  a fabricated authoritative ledger record. Local pinned FontAwesome 6.4.0 CSS matches the prior
  SRI and all referenced fonts/license are bundled; rendered glyphs are verified offline. Root
  inspected desktop creator and real mobile-seat screenshots. Full unit and browser suites pass.
  A real creator-to-cast browser session and live Council execution remain pending.

## Completion Audit

For each numbered requirement, record concrete current code and test/runtime evidence, not intent.
Foundation tests alone do not prove creator/runtime integration. Mocked UI responses do not prove
actual creation or effects. Agent agreement does not prove fun. Missing or contradictory evidence
keeps the goal active; do not mark complete at a convenient intermediate slice.
