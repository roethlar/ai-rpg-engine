# Class Runtime Experience Evidence

The owner-authorized completion scope is
`class-experience-implementation-plan.md`. This record distinguishes automated
runtime evidence from actual model behavior and from human enjoyment. None of
the checks below establishes a willing-player enjoyment verdict or promotes a
candidate class out of the unverified development Expert catalog.

## Advanced Actions

`test-class-exceptional-turns.mjs` uses actual campaign creation, character
copying, authored progression, Council orchestration, SQLite persistence and
export. Only provider responses are stubbed. Five campaigns and 22 actual
advancement turns exercise two fallen-NPC revivals, seven ritual workings and
three teleports. The fixture supplies no-stakes rulings; it does not stub RNG or
claim probabilistic balance evidence. Recall is interrupted after resolution
but before narration and resumes its exact accepted request without another
working, catalyst charge or effect.

The tests exposed and corrected two integration defects: canonical operation
JSON reorders object keys, which must not change ritual binding identity; and
group teleport needs current-action consent rather than an unreachable stored
`willingTravel` flag. Structured equality preserves binding values and ordered
target/traveler arrays. Continuity may affirm a present party NPC's established
agreement, while other PCs require their player's consent. Neither allegiance
nor a previous journey grants blanket consent. Both fixes passed removal-based
failure proofs and restored focused tests.

The earlier revival tests now author exact fallen-NPC descriptors during actual
creation instead of patching a corpse into the world. Unknown age, body and
return choice remain unknown, never inferred from allegiance. Recall validates
its eventual revival prerequisites before every working. The class action
matrix also verifies that a rescued passenger remains aboard through a later
vehicle move; the canonical vehicle registry owns the occupancy projection.

`class-council-options.js` provides all 144 active definitions with their
engine-owned qualitative selector shapes. All 24 actual class adapters pass
the selector matrix. Profiles, installations, vehicles, destinations and ritual
continuation are not hidden from the Referee or exposed as free permissions.

## Persistence

The completion audit found that the ordinary-action context still accepted only
PC consent references even though Council grounding and effects already allowed
present party NPCs. That rejected valid ally actions when the same consent
context reached an NPC consequence. The ordinary boundary now accepts exact
party character/NPC references and still rejects opposition, unknown, absent or
duplicate actors. Actual NPC kit and ordinary aid component regressions pass;
restoring the PC-only guard fails the new assertion. Restored focused and full
repository suites pass. No persistent consent flag is written.

The exceptional export test found that copied equipment's original owner and
previous item identity can belong to an earlier campaign. Item provenance is
historical, unlike the live holder. `class-portability.js` now preserves that
specific registry field verbatim while validating and remapping current
custody normally. Importing and reimporting cannot rewrite those origins. A
dangling current holder still rejects. Removing the provenance distinction
failed the new original-owner assertion; restored focused tests passed.

## Live Provider

`test-class-live.mjs` is an explicit opt-in probe, not part of the automatic
suite. It uses a disposable database and original provider calls, retaining
requests, responses and elapsed time in its temporary session artifact. The
2026-09-07 probe used the real Ollama transport with
`deepseek-v4-flash:cloud`; this describes the run, not a claim about provider
availability on another machine.

The live calls exposed failures that provider fixtures had missed:

- Setup copied a documentation wrapper as the scene response and gave absent
  independent NPCs null kits. The new authoring prompt shows the actual flat
  wire shape and separately labels reference instructions. Bounded correction
  preserves the strict validator and fails before campaign creation commits.
- Opening narration can introduce people absent from the outline roster.
  Scene authoring now accepts bounded descriptive `newActors` identities,
  backed by an actual quote from that narrative, and requires each to be
  materialized in the frame. Actual creation allocates and binds those NPCs in
  its existing transaction. Invented numeric mechanics, duplicate identities,
  missing evidence and unmaterialized additions reject. The HTTP creation
  regression and removal-based evidence-guard proof pass.
- Table talk returned bare prose despite JSON mode. Council prompts now show
  the exact narrative object and permit one formatting correction, without
  accepting unvalidated mechanics or disguising transport failures as semantic
  rejection. Removing that correction failed the prose-response regression.
- Ordinary movement twice used a typed map key where a bare area ID was
  required, then supplied an NPC wait outside an encounter. The prompt now
  distinguishes these exact selector types and explicitly requires empty NPC
  turns outside combat. Rejections name the precise required NPC set.
- A table-talk prompt omitted the player viewpoint identity and narrated Mira
  as someone beside the player. Both narration paths now receive the exact
  actor; the follow-up in the resumed session did not repeat that mistake.

The exact saved movement request then succeeded in five provider calls in
15.0 seconds, moved the canonical character once and exported successfully.
The follow-up took two calls in 12.9 seconds and changed no world state. This
opening had no nearby hostile target, so it is not live casting evidence.
Those waiting times remain a player-experience cost, not proof of fun.

A second bounded live creation probe initially failed because the model omitted
four absent outline NPC rows on all three scene attempts. The prompt now
enumerates every required actor row, and repair feedback names the missing
keys explicitly. Its focused regression passes. A later fresh creation and
export succeeded in four real calls over 218.9 seconds, including a newly
introduced scout. That scene contained five allies and no hostile target;
it did not exercise casting or prove repair of the earlier absent-row case.

The scout's narration described bleeding, but the initial scene contract could
only represent full health or a fallen NPC. Optional engine-valued injury
grades now make such wounds mechanically healable. Scene and actual HTTP
creation tests pass; restoring unconditional full health made the new guard
fail. Existing NPC vitals, PCs and controlled companions cannot be rewritten
through this authoring field.

`test-class-live-spells.mjs` separately labels `setup=authored_fixture`,
`turnProvider=original` and `outcomeEngine=real`. Only four setup responses are
authored fixtures, passed through actual creation and scene validation. The
level-one Formula grants, live Council decisions, RNG, effects, NPC actions and
SQLite persistence are real. This is not fully unmocked creation. All three
attempts below reuse one disposable campaign and the exact same cast request;
they do not regenerate grants, targets or outcomes.

The first direct Magic Missile attempt took five live calls and 50.3 seconds,
rejecting before reservation. The model assumed another game's automatic-hit
rule and alternated between `deltaSources:null` and a missing NPC strike target.
Every declared ability now supplies its authored contextual-check or no-check
contract, with explicit limits on omitting a contextual check. The Referee
prompt rejects imported name-based rules and specifies array and NPC-target
fields. The metadata guard failed when that contextual information was removed
and passed after restoration.

The second attempt took five calls and 35.7 seconds. It correctly selected a
contextual check but supplied `check.actor` as a typed string instead of the
numeric acting-character ID, then moved the required top-level `deltaSources`
inside `check`. It also rejected before reservation. Both rejected attempts
left the world unchanged, with no operation, roll or cost committed. Referee
requests now include a complete illustrative response skeleton distinguishing
the numeric check actor and the top-level provenance array.

The third attempt completed in five calls and 23.3 seconds. The real d100 check
rolled 14 against T=37 and produced `clean_failure`. The Raider remained at
18 health; its actual NPC-kit sword strike dealt wound harm of 5, reducing Mira
from 24 to 19. One owned invocation, one player check and one completed
operation were persisted, and the round advanced from 1 to 2. Narration
described the missed bolt and sword injury without adding an extra condition,
inventory loss or NPC roll. Its descriptive backward step did not change the
recorded Gate area. Exact campaign export passed. This proves a live miss and
counterattack, not a successful-hit damage case or player enjoyment.

The probe used 15 of its cumulative 20 real HTTP calls. Fireball was not
attempted: five remaining calls could not cover the five normal roles plus two
possible annotation calls. Exact prompts, raw HTTP responses, timings, world
snapshots and receipts remain in the temporary
`aetheria-class-live-spells-EL5flg/session.json` artifact, alongside its exported
`campaign.json`. The earlier failures remain in that same report.

## Player Feedback

All 24 branch sheets now have authored ability-use status derived from the
canonical definition and actual scene/recovery counters. The interface shows
remaining uses, preparation, conditions and ritual working progress alongside
compact current commitments. Spent powers remain insertable for questions or
prose rather than being mistaken for unavailable vocabulary. Maker capacity
counts active installation slots rather than all historical records. Saved
target profiles identify their pinned branch and omit the legacy zero-energy
display. Seats recompute the closed status projection from their own approved
fields rather than trusting imported display metadata.

Root inspected mobile ritual/condition and desktop pending-check screenshots:
the status and signed roll remain readable without overlap. The full browser,
seat and repository suites passed after the interface changes. Four removed
guards (slot count, remaining uses, imported-status privacy and condition
rendering) failed and were restored. Combined verification after journey
integration passed, including the actual creator/cast browser flows.

## Verification Boundary

Root's focused Council, scene-author and portability suites passed after their
guard mutations were restored. The final combined `node test.js` passed after
the live Referee response-example fix. `npm run test:browser` subsequently
passed its 366 baseline assertions, existing interaction regressions, all
24 class previews, actual persisted casts, failure/reload/exact retry and
desktop/mobile history. Provider-stubbed integration remains distinct from the
bounded live probes above.

Both resumable live runners now reject session directories outside the system
temporary directory and validate the saved report before application imports.
The spell runner also defers its fixture import until its path is assigned.
The non-temporary resume refusal checks passed; removing the spell path guard
failed its expected refusal before any database import, and restoration passed.

The final completion audit found remaining Rider reachability work: actual hull
damage, vehicle-scale foes and replacement after genuine vehicle loss. It also
found missing NPC action-completion events for Catalyst cues and a misbound
destination discovery for Partner Scout. Mobile Bastion's movement works, but
its advertised installation repair has no live damage producer. Earlier
component fixtures do not establish those actual-play paths. The active plan
owns that required follow-through; this verified integration slice does not
close the goal early.

The first standalone journey runner violated the disposable-store rule through
an early module import. `class-runtime-test-incident.md` owns the known writes,
cleanup and uncertainty. That run is excluded from disposable test evidence.
