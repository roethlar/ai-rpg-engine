# Exact Class Lifecycle Integration

Status: implemented under the owner-delegated class-experience implementation plan;
focused automated verification complete. No current-system human playtest or fun claim.

## Contract

- Target campaigns export format v4 with the exact current mechanical world, every
  retained turn snapshot, complete profile-scoped invocation wording and aliases,
  source NPC/location identities, membership/order, version pins and immutable checks.
  Legacy campaigns continue exporting v3; v1-v3 legacy validation/import stays intact.
- Import validates before writing and allocates/remaps under one database transaction.
  Character profiles, table rows, NPCs, locations and typed world registries receive
  destination identities. Owned ability instance IDs and definition/version IDs do not
  change. Independent copied profiles may own equal instance IDs without sharing state.
- Imported checks retain globally unique IDs and original execution provenance in
  `campaigns.rules_history_json`. They are never reinserted into the live ledger.
  New checks append normally and export alongside historical artifacts.
- Fork uses the selected exact turn snapshot, not legacy delta replay or the current
  character sheet. Later grants, healing, deaths, release and progression cannot leak
  backward into that snapshot. Historical membership decides who is active in the fork.
- Release captures current profile state before making it available, removes the actor
  from world turn order, marks historical membership released, and revokes its seats.
  Historical character rows retain profile identity and campaign bindings. Released
  rows are not projected back into a profile later checked out elsewhere.
- An entirely released target table remains readable and importable with an empty party
  and null current character. Existing-mode re-entry of a profile with history in that
  same campaign rejects transactionally; returning there requires an explicit copy.
- Pending operations block export, fork, release and join. Active encounters also block
  release/join. No automatic class migration, upgrade or cross-version conversion exists.
- Within turn state-change records, only `dice_rolls`, `rules_effects`, `rules_events`
  and `rules_award` undergo structured mechanical reference remapping. Arbitrary quest
  and prose trees remain text, even when a value happens to equal a typed reference.

## Evidence

- `node test-class-lifecycle.mjs`: real SQLite creation/join/copy, v4 export/import,
  earlier and released-member forks, release/re-entry, authored advancement, d100
  ledger checks and annotation effects, companion/vehicle remapping, exact resources,
  aliases, source independence, malformed-catalog/binding rejection without partial rows.
- The imported character advances from level 3 to 5 with a new live check while its
  source remains level 3. Historical checks remain in history rather than the live ledger.
- `node test-class-portability.mjs`: strict artifact validation and reference remapping,
  including prose that resembles typed actor references and original check provenance.
- Guard proof: temporarily disabling export's pending-operation predicate caused the
  lifecycle test to fail with `Missing expected rejection`; restoration passed.
- `test.js` includes both the exact lifecycle suite and the ordinary-action suite.
  `node test.js` passed with these suites integrated on 2026-09-07, after preserving
  the legacy-export expectation as format v3 rather than the maximum supported v4.
- `git diff --check` passed. No external reviewer or human playtest was invoked.

The approved implementation plan and `.agents/state.md` own overall completion status.
