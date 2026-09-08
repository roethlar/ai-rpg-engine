# Gameplay Episode Isolation

## Authority And Objective

On 2026-09-08, after the corrected pilot failed during campaign creation, the
agent proposed an offline runner revision: all three gameplay episodes start
from disclosed authored scenes, with independent failure limits. The owner's
subsequent instruction, "do something successfully", directs continued work
toward that proposed correction. This plan records its concrete implementation
scope. No new live inference allowance, production change or model tuning is
inferred from that instruction.

The actual target remains a completed and assessable gameplay exchange with
the owner-selected local models, not a successful setup or a substituted
fixture verdict. Offline verification is a prerequisite, not that live result.
The two failed runs retain their separate records and consumed allowances.

## Implementation

Only diagnostic files under `class-gameplay-verification/` change:

1. Add a direct-magic authored fixture through actual creation/scene validation,
   alongside existing Catalyst and earned-level-ten Recall fixtures. The visible
   scene provides a real opposing target and a separate area for a conditional
   Fireball. No direct world/resource mutation or guaranteed roll result.
2. Add a gameplay-only coordinator and episode worker. Each episode gets a fresh
   disposable process/store and an immutable allocation: at most 20 generation
   dispatches, three/two/three player inputs and six minutes of live work.
   Allocations sum to at most 60 dispatches/eight inputs; unused capacity is not
   transferred. The coordinator enforces a 20-minute whole-run ceiling.
3. Keep `createLocalGuard` permanently stopped after abort. Never reset or
   re-enable a cancelled guard. A later episode is a new isolated process with
   its own already-reserved allocation, not a reset of the previous allowance.
   Start it only after the previous worker exits and confirms application
   settlement. Unknown state, integrity/identity/configuration failure or
   unaccounted dispatch stops the whole run. Ordinary episode rejection or
   settled transport timeout may end that episode without starving the next.
4. Reuse browser composer submission, independent Council requests, signed
   engine/store outcomes, exact role identities and provider defaults. No live
   setup generation. Capture visible input/result, screenshots and final stored
   state even for failed episodes. Missing evidence must remain explicit.
5. Add an explicit offline verification mode with disclosed authored Council
   responses. Exercise actual browser/server/engine/storage, not a fabricated
   HTTP success. This mode cannot enable local or cloud inference. Include a
   first-episode abort and prove a later real episode resolves, with no stale
   provider work, overlapping workers, duplicated input or refunded allocation.

The existing creation-inclusive runner and both failed reports remain history;
do not modify them to make prior results look successful. Production creation's
timeout/cancellation experience remains a separate unresolved issue.

## Verification

Use temporary database paths before all application imports, denied provider
dispatch for fixture work and actual local HTTP/Chromium only. Verify the three
authored scenes, ordinary alternatives, actual spell/cue/ritual stored outcomes,
plain continuation and exact use accounting. Allow either real signed RNG
outcome; do not claim a miss proves a hit-specific effect.

Prove failure tests bite by removing the relevant isolation/budget behavior,
observing failure and restoring. Run focused tests, `node test.js`,
`npm run test:browser` and `git diff --check` offline before landing. Commit each
finding with its evidence and current-state pointer. No push or history rewrite.

## Live Gate

No execution is authorized yet. After offline verification, present one bounded
gameplay-only run using exactly `qwen3.8:27b-mlx` for Interaction/Continuity/Referee
and `muse-glimmer:30b-mlx` for Narration, three episodes/eight inputs, reserved
20-dispatch/six-minute episode limits and 60-dispatch/20-minute whole-run limits.
No cloud, fallback, tuning, downloads, extra scenarios or automatic reruns.

Deliver actual player inputs, resolved/rejected results, changes, choices,
typing/repetition/wait burden and known/unknown usage. Neither authored setup
nor authored offline Council output constitutes live gameplay or human fun.

## Status

Offline implementation and verification are complete. The
[evidence record](class-gameplay-verification/isolation-results.md) owns executed
browser/engine outcomes, mutation proofs, full-suite results and limitations.
All eight planned inputs completed with authored responses and real RNG. Both
an early abort and a post-roll narration abort preserved their evidence and
allowed the five later inputs to complete in isolated workers.

The diagnostic dispatch guard also rechecks cancellation/deadline after its
awaited ledger write, before transport. Its fake-transport regression proves
deadline expiry, abort and disablement cannot dispatch after that wait or refund
the reserved entry. This closes an existing guard race without resetting it.

The owner was asked during implementation to authorize exactly the single live
run specified above after offline verification. No answer or new model-call
authority has been received. Do not treat the goal instruction, offline success
or unused older allowances as approval. The selected-model gameplay result
remains outstanding.
