# Isolated Gameplay Verification

## Outcome

The offline correction in [the isolation plan](../class-gameplay-isolation-plan.md)
is implemented and verified on 2026-09-08. Real browser-composer submissions now
reach the actual Council validators, engine, RNG, database and rendered output
for all three disclosed authored scenes, independently of campaign generation.
**No local or cloud model generated a response in this correction.**

This demonstrates working diagnostic execution and engine behavior under
authored Council responses. It does not establish that the selected local
models complete these exchanges, that players enjoy them, or that the failed
creation experience is corrected. Both earlier failed pilots remain separate.

## Executed Inputs

| Episode | Actual browser inputs | Verified result |
| --- | --- | --- |
| Formula | Scene question, Magic Missile, Fireball | Three completed responses; question changed no world/check/operation; both direct casts resolved signed checks without preparatory inputs; Fireball charged one use. |
| Catalyst | Advance Cue, ordinary weapon attack | Two completed actions; cue used real NPC kit consequences; ordinary follow-up declared no ability. |
| Recall | Begin Recall, two identical plain continuations | Three completed workings; no preliminary check, charge or revival; one final signed check and use; living/dead state and catalyst consumption matched its actual outcome. |

Actual strings are retained in fixture plans and per-episode reports. Preparatory
work uses supported creation/scene validation; the level-ten character uses nine
real earned advancement turns and a real profile copy with authored responses.
There is no direct world patching or injected RNG.

An inspected first integration run illustrates the receipts: Magic Missile
missed; Fireball hit the Courtyard Sentry; Nessa's own close attack triggered her
agreed cue movement to the Courtyard; the subsequent ordinary attack missed;
the third Recall working revived Tarin and consumed the catalyst. These are
actual engine outcomes with **authored**, outcome-derived narration, not local
model performance. Later verification also observed a failed final Recall,
correctly leaving Tarin dead, so success is not prescribed by the fixture.

## Failure Isolation

- Normal execution: all eight planned inputs completed in three separate worker
  processes and stores, with zero generation dispatches.
- Abort before adjudication: one actual browser request aborted while its
  authored Interaction response was pending. World and stored operation/check
  state stayed unchanged. No retry or additional role call occurred there;
  Catalyst and Recall then completed all five of their inputs.
- Abort after a roll: the question completed, then the missile's narration was
  interrupted through the actual browser request. The original roll and active
  operation checkpoint remained recorded, with no unpublished world changes
  committed. The real export guard refused the pending campaign. The runner
  retained that refusal and its database/snapshot rather than bypassing it.
  Catalyst and Recall again completed all five later inputs.
- Complete-response observation covers HTTP success/rejection, truncated body,
  invalid completed JSON, header/body deadlines, browser abort and page closure.
  Invalid JSON remains a fatal integrity failure, not permission to continue.
- Every episode waits for application settlement and terminal process/group
  cleanup. Unknown/overlapping/unaccounted work stops the entire traversal.
  Fixed allocations cannot be refunded, transferred or reset.

The pending-action screenshot shows the retained input and its original d100
result. Its timeout message says 420 seconds because that is the application's
generic abort copy; the deliberately injected abort did not wait 420 seconds.
Do not present injected-failure timing as a live wait measurement.

## Guard Proofs

Each mutation was restored and its focused test rerun successfully:

1. Moving the Courtyard opponent out of that area failed the direct-scene check;
   replacing Formula with a level-one Ritual sheet failed owned-spell coverage.
2. Removing the 20-dispatch allocation check admitted a 21-dispatch report and
   failed the coordinator assertion.
3. Returning on worker startup instead of terminal exit produced overlapping
   start events and failed the real child-process sequencing assertion.
4. Removing offline dispatch denial failed its expected rejection.
5. Removing body-read failure capture reproduced the truncated-response error.
6. Treating the known pending export refusal as fatal stopped traversal and
   failed the post-roll-abort integration check.
7. The separate [dispatch persistence race record](dispatch-guard-results.md)
   owns the final pre-dispatch recheck and its removal proof.

## Final Verification

With the offline preload inherited through `NODE_OPTIONS`, all passed:

- `node test.js`.
- `npm run test:browser`: 366 baseline assertions, zero failures and zero external
  requests attempted; actual class creator/transport/browser checks also passed.
- `test-local-guard.mjs`, `test-fixtures.mjs`, `test-episode-coordinator.mjs`,
  `test-offline-gameplay-provider.mjs`, `test-submission-evidence.mjs` and
  `test-gameplay-runner.mjs` under this directory.
- `git diff --check`.
- The actual `run-gameplay.mjs --verify` CLI also completed three/two/three inputs
  with zero dispatches; its aggregate report is in the system-temporary
  `aetheria-gameplay-coordinator-vdVEMr` directory.

The focused final integration produced eight normal completed inputs, two
deliberately aborted inputs across independent failure runs, ten later completed
inputs, a retained pending roll and zero generation dispatches. These are three
offline test traversals, not three repetitions of an authorized live pilot.

Final-suite artifacts are system-temporary directories:

| Traversal | Direct magic | Catalyst | Recall |
| --- | --- | --- | --- |
| Normal | `aetheria-gameplay-episode-direct-magic-cV12HV` | `aetheria-gameplay-episode-catalyst-dCLo8e` | `aetheria-gameplay-episode-ritual-BZ983O` |
| Early abort | `aetheria-gameplay-episode-direct-magic-2RrwhC` | `aetheria-gameplay-episode-catalyst-LFtqpD` | `aetheria-gameplay-episode-ritual-We8O9W` |
| Post-roll abort | `aetheria-gameplay-episode-direct-magic-FY2KVt` | `aetheria-gameplay-episode-catalyst-jr8wML` | `aetheria-gameplay-episode-ritual-46tFjd` |

Each includes `report.json`, the closed temporary database, desktop/mobile
screenshots and a campaign export unless the real pending-operation guard
forbids export. No configured operator database or admin setting was used.
Desktop Catalyst, mobile Recall and desktop pending-roll views were visually
inspected; automated captures reported no horizontal overflow. These are not
separate mobile play sessions. The existing Situation prose can remain the
opening description after actors move, even while the map updates; this is an
unresolved player-facing consistency risk, not repaired by this diagnostic work.

## Next Gate

The proposed single gameplay-only local-model run remains unapproved. It uses
the already selected role mapping, three episodes/eight inputs, fixed 20-request
and six-minute episode allocations, and 60-request/20-minute overall limits.
No cloud, fallback, tuning, downloads or automatic reruns. That live evidence is
still needed; this record is not a substitute for it.
