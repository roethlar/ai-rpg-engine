# Class Journey Integration

Scope: ordinary cross-location reachability for the pinned class runtime. This is
implementation evidence, not live-model quality, balance, or player enjoyment evidence.

## Contract

- Existing map-local movement and recorded `travel {locationId,area}` remain unchanged.
  The Council can additionally select `{kind:'journey',from,exit,basis}` from the current
  persisted layout's exact `out:...` exits. It cannot name an arbitrary destination.
- An active encounter, established opposition, blocked/unsafe/threatened route, pinned or
  hindered traveler, unavailable vehicle, or disconnected approach rejects before reservation.
  Only clear connected walking to the chosen exit is folded into the same Main.
- Other PCs and independent party NPCs require the current action's explicit Continuity
  consent. A controlled companion shares its consenting controller's journey. No lasting
  consent is inferred from party membership or written into the character.
- A journey has no RNG, NPC action, encounter override or XP award. The usual independent
  semantic gates authorize its exact route before reservation. The common class lifecycle
  completes the departing Main before newly authored arrival opposition enters the world.
- Destination layouts are generated on demand, not frontloaded from the outline. An arrival
  draft supplies scene context; the strict scene author returns frame facts and any introduced
  NPC identities. The final narrator receives that draft as subordinate context, never as a
  binding mechanical outcome.

## Persistence

The existing request ID, original input, selected route, initial world and expected revision
are reserved in `rules_turn_operations`. Its accepted-stage checkpoint retains layout, then
arrival draft, then scene descriptor. A generation failure retains the accepted action; retry
does not select a different action or regenerate an already accepted earlier artifact.

Actual location and NPC rows are inserted by normal SQLite allocation inside a short write
transaction. Their exact IDs are used to validate and resolve the complete mechanical arrival
before that same transaction stores the resolved checkpoint. A rejected mechanical preview
rolls back the inserted rows and returns the scene descriptor to a retryable stage. No fake
IDs, sequence manipulation, provisional check records or provider calls occur in that transaction.

The reserved rows carry `pending_rules_operation_id`. Shared campaign state and voice NPC
lookups exclude them; the published current-location pointer and world remain unchanged.
Export and fork retain their existing unresolved-operation guard. Final operation completion
publishes the rows, writes the world/projections and exact turn snapshot, and advances the
turn atomically. Lost narration and completed-request retries reuse the same identities.

The world stores typed destination links on the originating area's `journeyRoutes`, alongside
the ordinary core exit link. Crossing establishes the reverse route as well. Revisit loads the
existing scene rather than regenerating its actors, items, conditions or terrain. Known absent
NPCs can be placed at a later destination under their existing IDs; absent nontraveling NPCs
retain their prior location and presence. New NPC voice identity is assigned once on allocation.
Vehicles follow their operators and actual occupants, with an explicit journey movement event.

## Verification

`test-class-journey.mjs` uses actual creation, joining, Council, SQLite, turn completion, export,
import and historical fork. Only the AI provider boundary is stubbed. It exercises refusal,
layout outage, invalid mechanical arrival rollback, narration outage and exact retry, hidden
pending rows, no manufactured checks, known/new NPC identity, persistent conditions, Rider
transport and revisits. The standalone and exported runners require a database path inside
the system temporary directory before any application import. A subprocess import-hook test
proves that a non-temporary sentinel path is refused without loading application modules or
changing the sentinel file.

Focused verification passed on disposable paths: two actual creations, one actual join,
three completed journeys, three retry boundaries, and two portable copies. The suite also
rejects malformed deferred NPC arrays before reservation, blocked recorded return arrivals,
and a world-revision race before destination allocation. Removing the exact external-exit
guard made the unsupported `out:Moon` assertion fail; restoring it passed. Removing the
exported runner's disposable-path guard made the sentinel subprocess fail its expected
pre-import refusal; restoring it passed with no application import or sentinel change.

The first standalone attempt had an import-order isolation incident before the guard was
added. It is not disposable verification evidence. The root incident record owns that audit;
no configured database rollback or additional cleanup was undertaken by this slice.
