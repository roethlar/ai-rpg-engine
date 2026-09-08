# No-Provider Class Coverage

Recorded 2026-09-08 for the [approved gameplay-verification plan](../class-gameplay-verification-plan.md). This is the pre-pilot mechanical coverage matrix, not a gameplay verdict. No live generation was performed for this matrix or its offline verification runs. The authorized local pilot is separate evidence, excluded from this matrix.

## Evidence Boundaries

- **Component:** deliberately constructed state, including prerequisites, injuries, resources, facts, targets and high-level grants. It verifies mechanical contracts, not that a playable opening naturally provides those prerequisites.
- **Integrated fixture:** actual creation, engine, Council, store, progression or portability APIs, with the AI provider boundary stubbed. These tests exercise durable gameplay paths, but their authored responses and NPC choices are fixtures, not evidence of a live model's judgment or a human's enjoyment.
- **Browser:** all 24 branch previews and selected actual creation/turn/retry workflows. Preview coverage is not 24 branches played through the browser.
- **Gameplay:** requires separately reported live episodes and, for enjoyment or balance, human playtests. Neither a passing fixture nor the planned three representative episodes can establish all-package gameplay quality. No Base/Advanced promotion follows from this matrix.

The catalog has 12 families: 10 universal families, conditional Catalyst, and the Rider module. Each has two branches. All remain expert-development content, not player-validated packages.

## Shared Coverage For Every Row

1. [Catalog tests][catalog] verify the exact 24 branch IDs, 168 definitions, seven grants per branch and level 1-10 loadouts, including catalog pins, equipment, resources and support validation. [State tests][state] construct and project all branches with stable owned ability identities.
2. [Action tests][actions] execute all **144 active definitions**, covering 56 mechanic modes and 15 handlers. The same suite performs **216 pure advancement steps**: nine level increases for each branch. These are not 216 Council turns. Its `classActionTestState` and `matrixRequest` explicitly inject many prerequisites; the matrix cannot promote those injections into live reachability claims.
3. [Creation tests][creation] exercise actual HTTP/catalog/DB creation and joining all 24 branches. [Council options tests][options] check authored selectors and qualitative options. [Seat tests][seats] cover all 24 own-character projections, private boundaries and full d100 history.
4. [Browser experience tests][browser] inspect all 24 branch previews on desktop/mobile, then exercise selected real HTTP/DB creation, a Formula spell, pending failure/reload/retry and history using a stubbed provider. The separate [creator browser tests][creator-browser] use mocked APIs.
5. [Council tests][council], [ordinary tests][ordinary] and [turn tests][turns] cover signed check approval, typed provenance, explicit declarations, ordinary permissions, NPC consequences without NPC rolls, outcome branches, annotation rejection and durable retries. These shared tests do not constitute a dedicated encounter for every package.
6. [Pure portability][portability], [engine lifecycle][lifecycle], [arrival baselines][baselines] and [journey][journey] exercise exact owned IDs, version checks, complete snapshots, immutable historical checks, remapping, copy/import/fork and source preservation. Integrated fixtures use selected mixed parties; there is **not** a separate full export/import/fork episode for each of the 24 branches.

## Package Matrix

Every row includes the shared coverage above. The final column identifies limits of the evidence, not newly established production defects.

| Family | Package | Specific mechanical or integrated evidence | Remaining gameplay question / coverage limit |
| --- | --- | --- | --- |
| Armsmaster | **Discipline** (`armsmaster.discipline`) | [Actions][actions]: Driving Strike harm/push, Disarming Cut ownership, Brace and explicit protection. [Turns][turns] and [journey][journey]: a real mixed-party Discipline character uses ordinary movement/travel. | No dedicated live hold-position versus pursue/protect encounter. Attacking a threat is not proof of automatic ally protection. |
| Armsmaster | **Pursuit** (`armsmaster.pursuit`) | [Actions][actions]: ranged attacks, marked quarry, pinning and recorded-route discovery with exact target binding. | Quarry and recorded trail prerequisites are supplied in the component matrix; natural pursuit setup and target changes remain unproven. |
| Berserker | **Fury** (`berserker.fury`) | [Actions][actions]: Reckless Blow failure still creates Exposure; incoming harm uses the authored grade adjustment. | No sustained live risk/recovery episode or attrition balance evidence. |
| Berserker | **Endurance** (`berserker.endurance`) | [Actions][actions]: Endure, Reprisal, incoming harm and Refuse Defeat's one-health floor, consumed cadence and rollback guards. | Component damage is intentional fixture setup; repeated live hold-or-withdraw decisions are not covered. |
| Adept | **Flow** (`adept.flow`) | [Actions][actions]: every authored action and stance/sequence handler; legal explicit bindings and costs. | Matrix-seeded stance is not evidence that a sequence is enjoyable, optional in practice, or useful after a target changes. |
| Adept | **Stillness** (`adept.stillness`) | [Actions][actions]: every authored action, stance permission and incoming-effect handling. | No dedicated freeform encounter showing an abandoned setup and an immediately useful alternative. |
| Opportunist | **Opening** (`opportunist.opening`) | [Actions][actions]: target-bound Opening acquisition/spend and authored attacks. | The matrix supplies Opening prerequisites where required; a naturally played target-switch sequence is not established. |
| Opportunist | **Mastery** (`opportunist.mastery`) | [Actions][actions] and [ordinary][ordinary]: recorded discoveries, object permissions, interactions and strict known facts. | No live variety sample for social leverage, locks or information gathering; a recorded fact is not proof of an interesting discovery. |
| Arcanist | **Formula** (`arcanist.formula`) | [Actions][actions]: direct Magic Missile, Fireball collateral/target completeness and explicit spell permissions. [Turns][turns] and [browser][browser]: actual durable spell/check/charge/history path and narration-failure retry. | Strong selected-path integration evidence, but stubbed prose does not establish spell clarity, live targeting judgment or fun under pressure. |
| Arcanist | **Ritual** (`arcanist.ritual`) | [Actions][actions]: working progress, interruption and prerequisite rejection. [Exceptional turns][exceptional]: actual earned progression/copy, Recall continuation, one final catalyst/use, outage/resume and Transit consent. | High-level access is earned through controlled fixture episodes, not a natural campaign. Long-working pacing and understandable interruption remain playtest questions. |
| Channeler | **Restoration** (`channeler.restoration`) | [Actions][actions]: healing, optional overreach/Strain and caps. [Revival][revival] and [exceptional turns][exceptional]: actual authored fallen-NPC eligibility and Breath of Return through creation/Council/store. | No live healing-triage or long recovery balance evidence; unknown body, consent and age intentionally fail closed. |
| Channeler | **Manifestation** (`channeler.manifestation`) | [Actions][actions]: all direct-force/phenomenon grants, their exact effects and optional overreach. | No dedicated live direct-spell pressure encounter or comparison of ordinary action versus spending Strain. |
| Oathbound | **Aegis** (`oathbound.aegis`) | [Actions][actions]: exact ally/ward binding, incoming guard and shared harm interactions; [ordinary][ordinary] covers the separate ordinary aid baseline. | No dedicated mixed-party encounter proving meaningful ward selection or naturally grounded ally agreement. |
| Oathbound | **Judgment** (`oathbound.judgment`) | [Actions][actions]: chosen-foe prerequisites and the authored pursuit/judgment actions. | No live chosen-foe replacement, abandoned commitment or competing-objective episode. |
| Shifter | **Predator** (`shifter.predator`) | [Actions][actions]: all profiles/actions, profile permissions and return-to-base utility; identity survives progression. | No live form-change-under-pressure episode or evidence that profile choice remains understandable without a dictated rotation. |
| Shifter | **Adaptive** (`shifter.adaptive`) | [Actions][actions]: environment permissions, profile effects, caps and bound destinations. | Fixtures supply the necessary terrain/space; naturally authored environmental variety is not established. |
| Maker | **Kit** (`maker.kit`) | [Actions][actions] and [options][options]: prepared devices, closed bindings and complete authored effects. | No dedicated Council device/resource episode; preparation and deployment opportunity costs remain unplayed. |
| Maker | **Forge** (`maker.forge`) | [Maker turns][maker]: actual creation, six earned advancements, deployment, Mobile Bastion relocation, identity/cadence and narration retry. | This proves relocation, not a complete deployment strategy or fun. The removed installation-durability repair promise is not claimed as covered. |
| Bonded | **Partner** (`bonded.partner`) | [Scout turns][scout]: actual level-3 Companion Scout, movement, exact area facts, shared Main, repeated-discovery rejection, retry and export. [Actions][actions] covers the remaining grants. | No live companion decision-variety or complete rescue episode; fixture-selected scouting is not autonomous companion intelligence. |
| Bonded | **Caller** (`bonded.caller`) | [Actions][actions]: every companion/profile grant, replacement and authored health/permission handling. | No dedicated Caller Council encounter; useful profile switching and companion tradeoffs remain gameplay questions. |
| Catalyst | **Tactics** (`catalyst.tactics`) | [Catalyst turns][catalyst]: real creation/progression and explicit NPC Main completion triggering authored cues, exact target binding and one-shot use. | NPC actions are scripted provider responses. Coherent live ally choices and cue opportunity cost are not yet established. |
| Catalyst | **Resonance** (`catalyst.resonance`) | [Catalyst turns][catalyst]: shared four-cue-kind coverage includes Courage NPC support and an actual PC check; NPC wait does not trigger and no NPC roll is introduced. | Mechanical support is covered, but live coordination, comprehensibility and enjoyment are not. |
| Rider | **Ace** (`rider.ace`) | [Rider turns][rider]: authored vehicle opponents, real hull harm, useful repair/retry, zero-hull loss, walking away from a wreck, safe replacement/copy, targeted scale guards, hazard bypass and Evasive Course provenance into a checked action. | Fixed hazard calibration is not proven balance. No long live vehicle campaign or natural replacement-pacing sample. |
| Rider | **Cavalier** (`rider.cavalier`) | [Rider turns][rider]: actual mounted-opponent Driving Impact. [Actions][actions]: Passenger Rescue followed by Mounted Charge preserves the rescued passenger. | The rescue-to-charge assertion is component coverage, not a dedicated live passenger-rescue episode; passenger/objective tradeoffs remain unplayed. |

## Encounter Clusters And Gaps

The plan's six clusters are accounted for without requiring one live episode per card:

- **Direct spell under pressure:** Formula/Restoration have selected integrated paths; all four Arcanist/Channeler packages have component coverage. Freeform pressure and optional-resource clarity still need the separate pilot/playtests.
- **Hold position or pursue:** all four Armsmaster/Berserker packages have authored mechanics covered. Dedicated live retreat, competing protection and multi-round attrition comparisons are absent.
- **Setup meets a changed situation:** all six Adept/Opportunist/Shifter packages have complete active-definition coverage. The component matrix is not a demonstration of abandoning setup, changing targets or playing without a prescribed rotation.
- **Ally or objective:** all six Oathbound/Bonded/Catalyst packages have coverage, with stronger integrated Partner and both Catalyst paths. That does not validate another player's agency or live allied NPC judgment.
- **Move assets:** all four Maker/Rider packages have coverage, with integrated Forge and Rider follow-through. [Journey tests][journey] separately verify recorded external exits, whole-party consent, pending IDs/privacy, retry, known NPC arrival, preserved revisit state and route portability; they do not demonstrate unscripted exploration quality.
- **Exceptional working:** [Exceptional tests][exceptional] exercise real persistence and continuation, including revival and teleport consent. Their controlled advancement and authored setup are disclosed, not described as an organic level-10 campaign.

## Offline Execution Evidence

Executed in the isolated PTK `rules_effects` session. No production files were changed for this verification. The only executable additions are [offline-preload.mjs](offline-preload.mjs) and its [fake-only guard test](test-offline-preload.mjs).

The session preserved its prior environment, appended this exact preload to `NODE_OPTIONS`, and set a unique temporary fallback `RPG_DB_PATH` before the suite entry points:

```powershell
$offlinePreload = 'file:///Users/michael/Dev/ai-rpg-engine/.agents/review/class-gameplay-verification/offline-preload.mjs'
$env:NODE_OPTIONS = (($priorOfflineNodeOptions + ' --import=' + $offlinePreload).Trim())
$env:RPG_DB_PATH = Join-Path ([System.IO.Path]::GetTempPath()) ('aetheria-offline-verification-' + [guid]::NewGuid().ToString() + '.db')
rtk proxy node .agents/review/class-gameplay-verification/test-offline-preload.mjs
rtk proxy node test.js
rtk proxy npm run test:browser
```

These are completed results, not commands requested for a later run:

- **Guard test passed:** 14 denied fake-transport targets, allowed local fixtures, redirect protection and inherited child preload. No network requests were made by this guard test.
- **Full unit entry passed:** `All unit tests completed successfully!` This includes the class, Council, exceptional, journey, Catalyst, Scout, Maker, Rider and copied-arrival runners wired into `test.js`. Expected mocked failure logs were part of negative assertions.
- **Full browser entry passed:** baseline 366 assertions, zero failures, zero unsupported cascades, zero undefined variables, and its own assertion of **zero external requests attempted**. Creator, class turn transport, all-24 desktop/mobile previews and the selected actual class experience/retry workflow passed. Installed Chromium was used; no download or installation was performed.
- **Disposable stores confirmed:** observed unit database `aetheria-test-42766-1788890337731.db`, transport database `aetheria-class-transport-PUXbTr/test.db`, and experience database `aetheria-class-experience-db-wS8s0D/test.db` were beneath the OS temporary directory. Read-only existence checks after completion confirmed all three were removed by their harnesses. The unique fallback `aetheria-offline-verification-509f461c-c3f3-489a-a243-c7d9b70c5fee.db` was never created. This assignment did not access the configured application database.
- Prior `NODE_OPTIONS` and `RPG_DB_PATH` values were restored after completion. No further provider or test runs were made to assemble this matrix.

### Failure Proof

Using `apply_patch`, temporarily removed only the preload's `url.port === '11434'` refusal, then ran the fake-only guard test. It failed with `AssertionError: Missing expected rejection` at its denied-target assertion. The guard was restored in `finally`; the same test then passed. The injected transport was an inert counter, so even the deliberately broken guard could not generate a real request. This demonstrates that the new test detects loss of the local-provider denial, not merely that the test passes with the implementation present.

### Guard Scope

The preload denies Node global-fetch requests to every non-loopback origin and every loopback port 11434, allows HTTP(S) loopback fixture servers on other ports, and prevents automatic redirect escape. Child Node processes retaining `NODE_OPTIONS` inherit it. Fixture mocks may replace/restore `fetch` intentionally.

This is **not complete process-network isolation**: it does not intercept direct `http.request`, sockets, an independently imported transport, Chromium, shell clients, or a child that drops the environment. Other loopback ports remain allowed for the real test servers. The browser harness's zero-external-request assertion is separate evidence, not a property of the Node preload. Passing these offline entries establishes the stated regression coverage only; it does not establish live-model compliance, latency, balance or enjoyment.

[catalog]: ../../../test-class-catalog.mjs
[state]: ../../../test-class-state.mjs
[actions]: ../../../test-class-actions.mjs
[creation]: ../../../test-class-creation.mjs
[options]: ../../../test-class-council-options.mjs
[seats]: ../../../test-class-seats.mjs
[browser]: ../../../test-class-experience-browser.mjs
[creator-browser]: ../../../test-class-creator-browser.mjs
[council]: ../../../test-class-council.mjs
[ordinary]: ../../../test-class-ordinary.mjs
[turns]: ../../../test-class-turns.mjs
[portability]: ../../../test-class-portability.mjs
[lifecycle]: ../../../test-class-lifecycle.mjs
[baselines]: ../../../test-class-arrival-baselines.mjs
[journey]: ../../../test-class-journey.mjs
[exceptional]: ../../../test-class-exceptional-turns.mjs
[revival]: ../../../test-class-revival.mjs
[catalyst]: ../../../test-class-catalyst-turns.mjs
[scout]: ../../../test-class-scout-turns.mjs
[maker]: ../../../test-class-maker-turns.mjs
[rider]: ../../../test-class-rider-turns.mjs
