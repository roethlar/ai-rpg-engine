# Journey Test Database Incident

On 2026-09-07, the first standalone `test-class-journey.mjs` run imported
`class-journey.js` statically. Its transitive database import opened the
configured `data/rpg_engine.db` before the runner assigned its temporary
`RPG_DB_PATH`. This violated the implementation plan's disposable-store rule.
It is not counted as disposable verification evidence.

The run performed normal `initDb` setup and missing migrations, including the
new pending-operation columns, and wrote the `character_profile_backfill_done`
marker. It created one test campaign and completed one journey before an
assertion failed. Its existing finally block deleted that test campaign and
profile. It did not run a schema reversal or broad cleanup.

The responsible agent's subsequent read-only audit found:

- Test identities began at campaign/character/profile 1, NPCs 1-3, locations
  1-2 and turns 1-2; the corresponding sequences remain advanced.
- No campaign, character, profile, NPC, location, outline, vocabulary, binding,
  operation, check or memory rows remained. There were no pending rows.
- The only server setting was the newly timestamped backfill marker. No
  provider or administrator settings existed in that inspection.
- The connection was closed, with no remaining WAL or SHM files.

These observations are consistent with an absent or empty pre-run database,
but there is no pre-run snapshot proving that. Do not claim the database was
unchanged or that earlier user data was proven absent. The owner was informed
in chat. Normal additive schema, migration marker and sequence changes were
left in place; reversing them without a sound baseline would add risk.

The runner now has only Node built-in static imports. Its exported function
and standalone entry require a path inside the system temporary directory
before importing any application module. Subsequent verification must log
its temporary database and demonstrate that invalid-path refusal precedes
application loading. The active implementation record owns those results.
