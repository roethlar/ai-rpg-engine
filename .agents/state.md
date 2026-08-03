# Agent State

This file is the first place future agents should read for current repo state. Keep it
short and update it when important repo facts change. Landed/superseded entries rotate
to `docs/history/state-archive.md`.

## Now

- **CAMPAIGN CLASS EXPOSURE, EVIDENCE TIERS, AND VERSION UPGRADES ARE SETTLED; IMPLEMENTATION IS NOT PLANNED OR AUTHORIZED.** The active 2026-08-02 decisions in `.agents/decisions.md` define cumulative Base (recommended), Advanced, and Expert (full) class sets selected at campaign creation from the sets allowed by the administrator. Expert holds the full candidate catalog, including unproven or deliberately demanding mechanics; Advanced holds mechanics that survived focused testing but retain noticeable burden; Base holds mechanics demonstrated to be understandable and enjoyable without repeated prompting. All included classes start at level 1; tiers are not power or level gates. Campaigns pin their set/catalog version. Safe host upgrades apply deterministic catalog migrations through a validated, atomic new campaign version while retaining the prior version read-only and saving player-owned compatible PC snapshots. Character versions progress independently and never merge. Exact tier membership, schemas, UI, migrations, and code remain open.
- **THE TEXT-ENTRY INTERACTION-BURDEN AUDIT IS A PLAYTEST RISK INVENTORY, NOT A ROSTER FILTER.** `.agents/review/interaction-burden-audit.md` identifies where Forms, Exposure, ordered Adept sequences, Openings, loadouts, separately controlled companions, Catalyst Cues, Rider state, intrusion procedure, and the three frozen economies may produce repeated prompts, forgotten state, dictated rotations, or agency-erasing automation. None is admitted, removed, folded, simplified, or assigned to a tier by the paper audit. Focused testing must compare the same character and encounter with only the candidate mechanic changed, observing meaningful choice, UI direction, memory, voluntary use, automation, prompt count, and turn time. Promotion or demotion occurs through later catalog versions and safe upgrades. The audit alone approves no interaction gate, roster, economy, or implementation.
- **THE PAIRED-PLAYTEST HARNESS PLAN IS OWNER-APPROVED; IBP-1 IS COMPLETE AND IBP-2 IS NEXT.** `.agents/review/interaction-burden-playtest-plan.md` authorizes only a deterministic, offline, no-model/no-storage browser artifact whose pilot reuses the exact matched Armsmaster and Adept cards plus stable-duel and moving-rescue fixtures. IBP-1 supplies the immutable shared fixture, exact mechanics/scenarios/result tapes, closed schemas, and focused validator. The same character, world, check math, result tapes, action budget, objectives, and help layout are held constant; only free Forms versus linked techniques changes. IBP-2 must add the player runner, instrumentation, local evidence export, structural guards, and manual browser verification, then stop before a human result or another mechanic pair.
- **CATALOG AVAILABILITY IS CONFIGURED AND NEUTRAL, NOT A MODEL CHARACTER JUDGMENT.** Only the campaign's selected released set/catalog is given to generation and creation. Out-of-set, disabled-module, unreleased, or honestly incompatible options are simply unavailable with a factual reason when one is useful. The prior “exclusion is an admission of failed imagination” posture is superseded. Any offered genre expression must still preserve exact mechanics, and models still cannot invent mechanic IDs or permissions.
- **THE OWNER ACCEPTED THE CLASSIFICATION METHOD AND REQUESTED FAMILIAR WORKED TOUCHSTONES; THE EXACT ROSTER IS STILL UNAPPROVED.** As `fe168cc`, the audit decomposes Indiana Jones, MacGyver, Hannibal Smith, Ellen Ripley, Michael Knight/KITT, Conan, and Batman into primary class mechanics plus separate skills, occupation, rank, wealth, and assets. It replaces the unfamiliar Intruder/Catalyst/Rider references and deliberately leaves a game-character exemplar blank where no honest familiar one exists. The acceptance was of this mechanic-first decomposition and example format, not a package-level ruling.
- **THE OUT-OF-SAMPLE ARCHETYPE AUDIT IS RETAINED TAXONOMY EVIDENCE, NOT THE CURRENT WORKING-ROSTER RECOMMENDATION.** `.agents/review/archetype-concept-coverage-audit.md` still owns the concept battery, archetype-by-genre option matrix, familiar touchstones, situationality, and balance fixtures. Its proposed ten universal candidates plus conditional Catalyst predated the interaction-burden test and is superseded as the next design baseline. No replacement roster is approved; do not regenerate the three packages from it.
- **INTRUSION IS SETTLED AS TRAINING, NOT AN ARCHETYPE.** The active 2026-08-02 decision in `.agents/decisions.md` corrects the initial conclusion of `.agents/review/archetype-collapse-prototypes.md`: the prototype proved that linked nodes, system-scoped Access, exact permissions, and Alert can be a meaningful shared scenario subsystem, not that Intruder deserves a class seat. Appropriate skills let any character participate; intrusion specialization may add advanced authored operations and is naturally available to an Opportunist/Rogue-style build or through normal cross-training. The exact training package and numerical balance remain open.
- **NPC CONSTRUCTION IS ASYMMETRIC BY DESIGN.** The active 2026-08-02 decision in `.agents/decisions.md` keeps NPCs in the common resolution, effect, harm, positioning, and encounter-budget language while giving them compact encounter kits rather than full player class sheets. Bespoke NPC-only mechanics are encouraged when they sharpen encounter identity; major bosses may have substantial exclusive actions, reactions, phases, and environmental effects. Those mechanics need difficulty/action-economy accounting, intelligible tells, and counterplay. Exact NPC cards and numerical pricing remain open.
- **ADEPT PASSED FORMAL NON-COLLAPSE AND REMAINS A HIGH-RISK PLAYTEST HYPOTHESIS.** `.agents/review/archetype-collapse-prototypes.md` proves that ordered opening/flow/finisher state differs from freely selected Armsmaster Forms. The interaction audit predicts that exposing its legal sequence may yield “next, next, next, finish,” while automation may erase the choice. The owner did not approve folding it: a paired text-play comparison must establish whether the full sequence earns its burden.

- **THREE CLOSED RULES-SYSTEM VARIANTS HAVE ONE COMPLETED FABLE REVIEW; NONE IS APPROVED OR IMPLEMENTED.** `.agents/review/rules-system-variants.md` owns exactly three whole packages over the signed d100/effect contracts: WWN/CWN-derived Commitment, SRD 5.2.1-derived Slots and rests, and 13th Age-derived Cadence. The frozen packages share nine archetypes, eighteen branches, a 9×10 mapping, deterministic 7–10 minute creation, exact spell/resource/recovery rules, opposition curves, assets/status, persistent help, worked builds, and a licensing/deviation ledger; their Intruder rows are now superseded, so no package can be adopted as written. One `claude-fable-5` openreview ran at owner-specified `high` over `dadc64a..54bf01b`; there was no model follow-up. Fable returned four candidates: legacy-runtime orientation and one spell-target phrase are admitted/open, the stale NEXT was corrected by mandatory state sync without re-review, and the claimed high-vs-max conflict is declined because the explicit owner instruction controls. `.agents/review/index.md` and `findings/rsv-*.md` own the trail. That review found no taxonomy or economy contradiction in its frozen input; later rulings supersede its roster assumptions. The audit predicts Commitment has lower interaction burden than Slots and rests or Cadence, but all three remain playtest hypotheses rather than paper admissions or rejections.

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
- **THE GREENFIELD RUNTIME REWRITE IS ABANDONED** (owner decision 2026-07-26). The shipped Council
  pipeline remains canonical. Product work continues incrementally through rules, UI, mapping, and
  related improvements. The discarded proposal survives only as historical evidence at
  `docs/history/runtime-greenfield-plan-abandoned.md`; none of its gates or open questions apply.
- **RULES CHAPTERS 1 AND 2 ARE OWNER-SIGNED; THE DECISION QUEUE CONTINUES.** Chapter 1
  (`docs/rules/resolution.md`) and Chapter 2 (`docs/rules/effects.md`, r24 substantive pin
  `6772d33`) are canonical. Chapter 2 closed r28 with zero findings and was signed off
  2026-07-27, enacting its three declared Chapter 1 refinements and closing the D2 catalog-design
  gate. `.agents/review/rules-system-plan-intake.md` owns the remaining decision queue; no rules
  code before a concrete phase and an owner-approved plan.
- **PHASE PT'S S1.1-S1.4 ARE LANDED, BUT ITS ONE-RECORD FOUNDATION IS SUPERSEDED AND THE PLAN MUST BE REVISED BEFORE MORE PORTABILITY WORK.** The 2026-08-02 versioning decision replaces one canonical character record/no branches with one player-owned lineage containing independently playable rules-version snapshots created during safe campaign upgrades. Each version may be active in at most one compatible campaign and progresses independently without merging. Retained D3 rules still require first entry to fill missing ability-presentation bindings; returns reuse saved ability wording exactly and review only newly gained abilities lacking destination wording. Archetype is
  stable and player-facing; the player's own title never auto-translates. Creator maps a concept to
  a known archetype ID, tailors its campaign description, may show public local profession-name
  examples, and asks the player to confirm. Stage 1 Gate 7 is settled: no automatic
  character-name/title translation; broader proper-name/alias policy and player-driven title-edit
  workflow remain future. The exact archetype roster remains Gate 5 and blocks
  S1.5 Creator/onboarding work, not S1.3. Portability reads
  live destination outline/setting, latest six turns chronological, and top eight relevant
  memories by importance then recency through direct helpers shared with MCP. The GM judges fit,
  the engine validates exact requested known ability IDs and allowlisted display-name/prose fields,
  and the player approves wording. S1.3's proposal seam is read-only, derives ability slots
  internally, permits one generic contract retry, and treats wording as non-authoritative flavor.
  Every actual number/stat/resource change, damage result, or XP award remains canonical-Council
  authority. A
  deterministic canon-basis digest detects stale drafts but is not canon. There is no second
  settings checklist, classifier, editor, sync workflow, or self-network call. The landed storage
  does not implement the new campaign-version, character-version, migration, or deletion contract;
  `plan.md` and the v3.1 design record are no longer cold-implementable until revised.
  S1.4 stores immutable character/campaign/ability wording separately from versioned campaign
  vocabulary, gives every direct SQLite operation explicit transaction ownership, and round-trips
  active linked rows through bundle v2 while v1 imports empty portability state. Because S1.3 emits
  no engine-owned campaign semantic keys, runtime shared batches are rejected rather than inferred from prose;
  shared storage awaits a later producer. Canon-echo comparison neutralizes Unicode formatting while
  preserving legitimate script/emoji shaping; unsafe invisible and bidi controls fail at both proposal
  and persistence boundaries. No route, UI, movement, narration, or mechanic path changed.
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
- **THE OWNER-APPROVED UI BACKLOG REMAINS UNSTARTED, REVERIFIED AT `3b659bc`.**
  `.agents/review/index.md` owns the exact findings and order; resume at `jt-1`.
- **THE REMOTE TWO-HUMAN MULTIPLAYER PLAYTEST REMAINS PENDING.** App-side seat work is landed;
  connectivity is owner-handled and out of repo scope. Seat isolation must be re-tested whenever a
  field crosses a seat payload, audio, or error boundary.
- **KNOWN PARKED DEFECT, REVERIFIED AT `3b659bc`:** `map-render.js:142` draws the location title
  as an unclipped SVG `<text>`. A long location name can overrun the canvas; the landed `map-1`
  fix deliberately covered area labels only.

## Next

**NEXT:** Implement and verify IBP-2, the offline player runner and instrumentation, then stop for the owner's human playtest. The approval does not authorize a tier result, later pair, product integration, reviewer, or push. Separately, no further Phase PT implementation may proceed until an owner-approved revision incorporates campaign sets, safe upgrades, class migrations, and player-owned character versions. The prior Fable items `rsv-1` and `rsv-4` remain downstream.

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
- The first approved UI backlog slice is `jt-1` (prevent stale cross-campaign Journal responses);
  select it when UI implementation should resume.
- The concrete mapping candidate is the parked location-title overflow defect; draft and approve
  its fix plan before changing code.
- Phase V's pending feel gate is a real voice session with narrator plus multiple NPC lines,
  checking sticky identities, moods/tones, Skip, and shared host/seat delivery.
- For the combined host/seat playtest, configure `ACCESS_SECRET` and `ADMIN_SECRET`, expose the
  server, add the second character, mint its seat, and send that seat token to the other player.

## Blockers

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

- Automated: `node test.js` — green for IBP-1 on 2026-08-02. The focused
  `node .agents/review/interaction-burden-playtest-harness/verify.mjs` is also green. Its guard proof
  rejected a variant-owned result tape, a linked technique that advanced only on success, and an
  unknown nested character field before each mutation was restored. Prototype-local
  `node .agents/review/gate-5-character-creation-prototype/verify.mjs` is also green;
  prominence guard proof temporarily narrowed the right pane from 390px to 300px, and the new
  assertion failed before restoration and passed afterward.
- S1.4 guard proof: temporarily disabling the campaign-vocabulary UPDATE trigger failed the new
  immutable-row assertion. Separately weakening direct-operation queue ownership, stale-owner expiry,
  Unicode-format echo normalization, proposal/persistence alignment, or shaping support made its
  corresponding regression fail; restoring each returned the full suite green.
- S1.4 adversarial coverage proves missing-only exact reuse, two-character isolation, no runtime
  arbitrary shared keys, atomic conflict/idempotency behavior, owned read/export snapshots with stale
  async-owner rejection, Unicode canon-copy resistance without an English-only presentation boundary,
  mechanics/canon/title/inventory exclusion, bundle v1→v2 compatibility and exact ID remapping,
  counter headroom, and unchanged host/seat payloads.
- S1.3 guard proof: temporarily allowing a nested model-supplied `cost` field failed the suite at
  the invalid-first retry assertion; restoring the strict row allowlist returned the full suite green.
- Read-only adversarial review confirmed flavor-only sensation passes, explicit numeric/stat/resource
  claims fail, and the proposal has no DML or mechanics-application path.
- Privacy boundary is structural plus verbatim-overlap lint: raw canon/basis/anchors never return.
  Canon has no visibility metadata, so semantic secret paraphrases cannot be proven impossible.
- Manual/browser playtest: not run for the Gate 5 contextual guide; the owner's experience evaluation
  is pending. S1.3-S1.4 remain internal-only seams with no route or shipped UI change. See
  `.agents/repo-guidance.md` (Verification) for required surfaces and coverage boundaries.
- Guard-proof requirements and anti-vacuity practice live in `AGENTS.md` and
  `.agents/decisions.md`; the codereview playbook applies only when explicitly invoked.
- Live seat verification uses a throwaway store: mint seat → `/api/seat/session` → leak-scan the
  payload. Release/revoke are destructive.
- Desktop shell verification is `cargo build` in `desktop/src-tauri`.

## Active Sources

- `.agents/review/interaction-burden-audit.md` — current text-entry risk inventory, paired-test hypotheses, and settled tier-evidence policy; no roster or tier membership is approved.
- `.agents/review/interaction-burden-playtest-plan.md` — owner-approved offline Armsmaster/Adept pilot and harness contract; IBP-1 is complete and IBP-2 is next, with no human result or later pair authorized.
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
