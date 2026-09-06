# Agent State

This file is the first place future agents should read for current repo state. Keep it
short and update it when important repo facts change. Landed/superseded entries rotate
to `docs/history/state-archive.md`.

## Now

- **THE PRODUCTION ABILITY-KEYWORD COMPOSER IS LANDED; ACTIVATION STILL NEEDS THE REAL CATALOG.** `.agents/review/ability-keyword-production-plan.md` owns the completed slices and their verification. AKP-4 remains gated on stable character-owned abilities, invocation families, and complete campaign bindings from the versioned class/catalog creator; prototype fixtures cannot satisfy that dependency.
- **REVIEW REMAINS OPT-IN; THE OWNER-SELECTED REVIEWER IS KIMI K3 AT MAX EFFORT (2026-08-03).** `.agents/review/index.md` owns the verdicts and per-finding trail. Harness configuration is machine-local in `.agents/review/harnesses.local.json`; re-check local capability before dispatch.
- **THE SIGNED RULES CHAPTERS AND VERSION DECISIONS ARE THE DESIGN BASELINE.** `.agents/decisions.md` owns the adopted resolution/effect chapters and campaign/character-version contract. Phase PT's landed storage does not implement that version architecture; its plan must be revised before further portability work. The remaining decision queue is `.agents/review/rules-system-plan-intake.md`.
- **CAMPAIGN CLASS EXPOSURE, EVIDENCE TIERS, AND VERSION UPGRADES ARE SETTLED; IMPLEMENTATION IS NOT PLANNED OR AUTHORIZED.** The active 2026-08-02 decisions in `.agents/decisions.md` define cumulative Base (recommended), Advanced, and Expert (full) class sets selected at campaign creation from the sets allowed by the administrator. Expert holds the full candidate catalog, including unproven or deliberately demanding mechanics; Advanced holds mechanics that survived focused testing but retain noticeable burden; Base holds mechanics demonstrated to be understandable and enjoyable without repeated prompting. All included classes start at level 1; tiers are not power or level gates. Campaigns pin their set/catalog version. Safe host upgrades apply deterministic catalog migrations through a validated, atomic new campaign version while retaining the prior version read-only and saving player-owned compatible PC snapshots. Character versions progress independently and never merge. Exact tier membership, schemas, UI, migrations, and code remain open.
- **THE TEXT-ENTRY INTERACTION-BURDEN AUDIT IS A PLAYTEST RISK INVENTORY, NOT A ROSTER FILTER.** `.agents/review/interaction-burden-audit.md` identifies where Forms, Exposure, ordered Adept sequences, Openings, loadouts, separately controlled companions, Catalyst Cues, Rider state, intrusion procedure, and the three frozen economies may produce repeated prompts, forgotten state, dictated rotations, or agency-erasing automation. None is admitted, removed, folded, simplified, or assigned to a tier by the paper audit. Focused testing must compare the same character and encounter with only the candidate mechanic changed, observing meaningful choice, UI direction, memory, voluntary use, automation, prompt count, and turn time. Promotion or demotion occurs through later catalog versions and safe upgrades. The audit alone approves no interaction gate, roster, economy, or implementation.
- **THE REJECTED IBP-2 RUNNER IS DELIBERATELY UNCOMMITTED AND MUST NOT BE CLEANED UP.** The modified `README.md`/`verify.mjs` and untracked `app.js`/`index.html`/`styles.css` under `.agents/review/interaction-burden-playtest-harness/` are the owner-rejected menu-driven runner, held untouched pending explicit disposal authority (2026-08-02 decision in `.agents/decisions.md`). Do not resume it, commit it, stash it, or delete it. Committed IBP-1 remains evidence. The completed and owner-accepted ability-keyword composer prototype that this working tree accompanied is rotated to `docs/history/state-archive.md`; the landed production slices below supersede its no-integration clause.
- **CATALOG AVAILABILITY IS CONFIGURED AND NEUTRAL, NOT A MODEL CHARACTER JUDGMENT.** Only the campaign's selected released set/catalog is given to generation and creation. Out-of-set, disabled-module, unreleased, or honestly incompatible options are simply unavailable with a factual reason when one is useful. The prior “exclusion is an admission of failed imagination” posture is superseded. Any offered genre expression must still preserve exact mechanics, and models still cannot invent mechanic IDs or permissions.
- **INTRUSION IS SETTLED AS TRAINING, NOT AN ARCHETYPE.** The active 2026-08-02 decision in `.agents/decisions.md` corrects the initial conclusion of `.agents/review/archetype-collapse-prototypes.md`: the prototype proved that linked nodes, system-scoped Access, exact permissions, and Alert can be a meaningful shared scenario subsystem, not that Intruder deserves a class seat. Appropriate skills let any character participate; intrusion specialization may add advanced authored operations and is naturally available to an Opportunist/Rogue-style build or through normal cross-training. The exact training package and numerical balance remain open.
- **NPC CONSTRUCTION IS ASYMMETRIC BY DESIGN.** The active 2026-08-02 decision in `.agents/decisions.md` keeps NPCs in the common resolution, effect, harm, positioning, and encounter-budget language while giving them compact encounter kits rather than full player class sheets. Bespoke NPC-only mechanics are encouraged when they sharpen encounter identity; major bosses may have substantial exclusive actions, reactions, phases, and environmental effects. Those mechanics need difficulty/action-economy accounting, intelligible tells, and counterplay. Exact NPC cards and numerical pricing remain open.
- **ADEPT PASSED FORMAL NON-COLLAPSE AND REMAINS A HIGH-RISK PLAYTEST HYPOTHESIS.** `.agents/review/archetype-collapse-prototypes.md` proves that ordered opening/flow/finisher state differs from freely selected Armsmaster Forms. The interaction audit predicts that exposing its legal sequence may yield “next, next, next, finish,” while automation may erase the choice. The owner did not approve folding it: a paired text-play comparison must establish whether the full sequence earns its burden.

- **GATE 5'S PROTOTYPE EXPOSED AN UNDEFINED CORE RULES CONTRACT AND IS NOT READY FOR APPROVAL.**
  The owner accepted the interaction hierarchy as the direction: choose a mechanical archetype,
  conditionally choose among its campaign-specific classes, then choose training, background,
  standing, and identity; one class mapping is automatic.
  `.agents/review/gate-5-character-creation-prototype/index.html` now makes the rules guide the
  dominant full-height right pane, with the compact current-character summary inside it. The
  selected choice persists while hover or keyboard focus previews another topic; below 901px the
  same pane becomes a full-height drawer. The provisional ability economy starts at six, recovers
  two after a breather and fully after a safe rest, and appears only under class/genre terms.
  Tempo is concretely the Fighter's
  budget for Combat Forms and counters while Weapon Mastery remains passive. Training, background,
  title, command, wealth, and institutional standing each show operative examples and boundaries.
  The local verifier covers assets-only/no-network/no-storage structure, guide controls, resource
  coherence, and player-copy leak guards. Owner evaluation found that the common pool mostly changes
  names while "breather," "safe rest," capacity growth, and spell rank/cost/upcasting lack operational
  rules; the hard-coded full recovery to six also conflicts with the sample progression to seven.
  All catalogs, values, and mechanics remain provisional; nothing is approved or shipped.
- **THE SIGNED TARGET CHASSIS AND THE SHIPPED LEGACY RUNTIME ARE DIFFERENT SYSTEMS.** Canonical
  `docs/rules/resolution.md` specifies d100 meet-or-beat checks and `docs/rules/effects.md` specifies
  an engine-owned effect vocabulary, but neither is implemented as the complete game. The shipped
  rules-mode path still uses optional d20 + four-attribute modifiers, generated per-campaign rule
  sheets, HP/mana, and XP-per-level behavior. Attributes, spend economy, tactical space, initiative,
  opposition curves, dying, recovery, class roster/mechanics, and version migration remain unsettled
  or merely proposed. Do not present prototype mechanics as the rules system.

- **GATE 5'S RESTRICTIVE CLASS MODEL NEEDS REVISION BEFORE AN OWNER RULING.**
  The owner explicitly rejected §7's prose-to-model-selected-mechanics flow and retrying generation
  as its correction. The next design must keep creation and progression short without making AI
  inference authoritative; deterministic class/package selection is proposed but not owner-approved.
  Do not present the current G5-A as ready for ruling. The
  owner-requested context-rich `claude-fable-5` high-effort review of draft `d00c34f` reopened four
  concrete plan gaps. Dedicated commits carried `pt-5`, exposed the fixed-order consequence and
  separate reorder choice, defined subclass, and covered stale intake restatements. An unauthorized
  high-effort repair-delta review accepted `ed91b95`; its verdict is provenance only and grants no
  authority for another external-model call. It recorded no comments, exact SHA pins,
  `guard_confirmed: true`, and `capability_ok: true`. `.agents/review/gate-5-class-model-plan.md`
  owns the reviewed plan; `.agents/review/index.md` and `.agents/review/findings/g5p-*.md` own the
  review trail. No taxonomy decision or code is approved; the active 2026-07-31 singular-archetype
  decision remains authority until an explicit owner ruling. The earlier 22×10 roster remains
  evidence only.

- **CROSS-HARNESS REVIEW IS OFF BY DEFAULT** (owner decision 2026-07-26,
  `.agents/decisions.md`). Do not invoke an external reviewer unless the owner explicitly requests
  `codereview`, `review`, `openreview`, or names one for the work. Code still requires an
  owner-approved plan and normal repository verification.
- **PHASE PT REVIEW REPAIR PLAN IS DRAFTED, NOT APPROVED; GATE 5'S ROSTER IS STILL UNSETTLED.**
  `plan.md` specifies two one-finding commits: PT-R1 makes live ability identity and Referee
  authority exact end to end; PT-R2 unifies source-ability text limits without truncating mechanics
  or rewriting local legacy rows. The owner authorized planning only, so no repair code is
  authorized yet. `.agents/review/index.md` owns the admitted 2026-08-01 `claude-fable-5`
  findings. Separately, the owner rejected the reduced roster because a shared tactical result does
  not imply a shared mechanical chassis: a Barbarian and Battle Mage cannot be conflated when only
  one requires spell mechanics. No replacement roster is authorized.
- **PHASE V CODE IS COMPLETE; THE OWNER VOICE PLAYTEST IS PENDING.** The live contract is one
  campaign-canonical narrator, server-resolved NPC voices, shared host/seat synthesis, and
  save-once replay. `.agents/review/index.md` owns the accepted implementation trail. The phase
  remains open until a real session confirms the voice experience is better.
- **THE REMOTE TWO-HUMAN MULTIPLAYER PLAYTEST REMAINS PENDING.** App-side seat work is landed;
  connectivity is owner-handled and out of repo scope. Seat isolation must be re-tested whenever a
  field crosses a seat payload, audio, or error boundary.

## Next

**NEXT:** Revise Phase PT around the settled campaign/character-version contract before seeking
approval for further portability work. AKP-4 and real ability activation remain blocked until the
versioned class/catalog creator supplies complete stable character abilities, invocation families,
and campaign bindings; do not seed provisional prototype abilities. Do not resume the rejected
IBP-2 runner. The prior Fable items `rsv-1` and `rsv-4` remain downstream. Completed UI work is
tracked in `.agents/review/index.md`; deleting retained local branches requires a separate owner go.

## Prior queue context

The three-package comparison is complete in `.agents/review/rules-system-variants.md`, but Fable's
admitted `rsv-1` leaves the compact shipped-legacy versus signed-target orientation open. The
remaining bullets retain their independent priority.

- Revise Phase PT around the settled campaign/character-version contract before returning either
  admitted repair to the owner. The revision must incorporate staged interaction playtesting and
  must not treat either formal chassis distinction or the paper audit as a roster verdict. No
  portability repair code is authorized meanwhile.

- Continue the owner decision queue one item at a time from the canonical queue in
  `.agents/review/rules-system-plan-intake.md`.
- Phase V's pending feel gate is a real voice session with narrator plus multiple NPC lines,
  checking sticky identities, moods/tones, Skip, and shared host/seat delivery.
- For the combined host/seat playtest, configure `ACCESS_SECRET` and `ADMIN_SECRET`, expose the
  server, add the second character, mint its seat, and send that seat token to the other player.

## Blockers

- Former mapping blocker cleared as of `af69a85`: the parked location-title premise is false.
  `map-render.js` now fits and clips the title; fix `d4f680b` arrived through merge `a5c15d2`,
  whose renderer/test/review content matches its merged branch. `.agents/review/findings/map-2.md`
  owns the completed proof and verdict; no title-overflow repair remains queued.
- Ability activation remains gated on the real versioned class/catalog creator, as recorded in
  `.agents/review/ability-keyword-production-plan.md`; the landed generic composer supplies no
  provisional player abilities.
- Phase PT's approved plan and v3.1 design still encode one canonical character record with no alternate versions. The 2026-08-02 owner decision supersedes that foundation; campaign/character version storage, atomic migrations, compatibility, and deletion require a revised plan before code work.
- Phase PT's drafted two-slice repair plan still owns admitted findings, but a simple approval is no
  longer sufficient: the campaign/character-version replan must first prove those repairs' identity
  and storage assumptions still fit. `.agents/review/index.md` owns the findings and `plan.md` owns
  the held proposal.
- Phase PT S1.4 is landed. The owner found Gate 5's deterministic local prototype mechanically
  under-specified: resource recovery, capacity growth, ability rank/cost scaling, the exact class
  catalog, balance, and all sample mechanics remain unsettled. A later classification ruling and the `pt-5`
  description-scope ruling still block S1.5 Creator/onboarding work.
- Broader Chapter 1/2 effect-catalog runtime implementation remains blocked until promoted into
  a concrete owner-approved phase; the D2 catalog-design gate is closed.
- Phase V closure requires the owner's real-session voice verdict.
- Multiplayer network exposure is owner-handled infrastructure.

## Verification

- `.agents/repo-guidance.md` owns the required automated and playtest entry points.
- `.agents/review/ability-keyword-production-plan.md` owns production composer verification and
  its outstanding hands-on browser limitation. Prototype results remain in their plan records.
- `.agents/review/index.md` and its per-finding records own landed fixes and guard proofs;
  Phase PT's implementation evidence remains in `plan.md` and the portability design record.
- Phase V's owner voice verdict and the remote two-human session remain unrecorded; neither feel
  gate is treated as complete by the automated implementation results.

## Active Sources

- `.agents/review/ability-keyword-production-plan.md` — landed composer contract and catalog-gated activation.
- `.agents/review/rules-system-variants.md` — retained package comparison, not an approved roster or economy.
- `.agents/review/interaction-burden-audit.md` — current text-entry risk inventory, paired-test hypotheses, and settled tier-evidence policy; no roster or tier membership is approved.
- `.agents/review/interaction-burden-playtest-plan.md` — retained Armsmaster/Adept fixture contract; IBP-1 is complete and its rejected menu-driven IBP-2 is superseded.
- `.agents/review/ability-keyword-composer-plan.md` — completed and owner-accepted non-shipping proof contract for inline exact-word recognition, ability-card insertion, and non-activating spelling recovery.
- `.agents/review/ability-keyword-composer-prototype/` — completed AKC-1/AKC-2 artifact and focused verifier; no production contract.
- `.agents/review/archetype-collapse-prototypes.md` — matched-card evidence: Intruder removed by a separate decision; Adept formally differs and awaits paired interaction testing.
- `.agents/review/archetype-concept-coverage-audit.md` — retained option atlas, mapping, touchstones, and failure evidence; its working-roster recommendation is superseded.
- `AGENTS.md`, `.agents/repo-guidance.md`, `.agents/decisions.md`
- `docs/rules/effects.md`, `.agents/review/effect-catalog-review.md`, and
  `.agents/review/rules-system-plan-intake.md`
- `.agents/review/archetype-portability-matrix-v3.1.md` — partially superseded D3 plan; retained wording/live-canon evidence, not cold-implementable version architecture;
  `.agents/review/archetype-portability-matrix.md`,
  `.agents/review/archetype-portability-matrix-review.md`,
  `.agents/review/archetype-portability-matrix-v2.md`, and
  `.agents/review/archetype-portability-matrix-v3.md` — retained evidence.
- `.agents/review/gate-5-class-model-plan.md` — draft replacement Gate 5 taxonomy and gate order;
  `.agents/review/archetype-roster-fable-candidate.md` — retained reviewer evidence.
- `plan.md` — the broader phased roadmap.
- `.agents/review/index.md` — implementation findings, order, and verdicts.
- `README.md` — current setup, hosting, seat, and voice flow.
- `.agents/machines.md` — machine-local facts and cleanup blockers.
- `docs/history/state-archive.md` — rotated history; not current state.
