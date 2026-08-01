# Agent State

This file is the first place future agents should read for current repo state. Keep it
short and update it when important repo facts change. Landed/superseded entries rotate
to `docs/history/state-archive.md`.

## Now

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
- **PHASE PT IS APPROVED AND RUNNING; S1.1-S1.4 ARE LANDED AND S1.5 AWAITS GATE 5.** D3
  records one persistent character active in exactly one campaign: mechanics and progression
  travel; first entry fills missing ability-presentation bindings; returns reuse saved ability
  wording exactly and review only newly gained abilities lacking destination wording. Archetype is
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
  settings checklist, classifier, editor, sync workflow, self-network call, branch, or alternate
  character. Phase PT in `plan.md` owns the fixed slice order and coding assignments.
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
- **THE OWNER-APPROVED UI BACKLOG REMAINS UNSTARTED, REVERIFIED AT `c0bedb6`.**
  `.agents/review/index.md` owns the exact findings and order; resume at `jt-1`.
- **THE REMOTE TWO-HUMAN MULTIPLAYER PLAYTEST REMAINS PENDING.** App-side seat work is landed;
  connectivity is owner-handled and out of repo scope. Seat isolation must be re-tested whenever a
  field crosses a seat payload, audio, or error boundary.
- **KNOWN PARKED DEFECT, REVERIFIED AT `c0bedb6`:** `map-render.js:142` draws the location title
  as an unclipped SVG `<text>`. A long location name can overrun the canvas; the landed `map-1`
  fix deliberately covered area labels only.

## Next

**NEXT:** Ask the owner to approve or reject the drafted Phase PT review repair plan. No code repair
is authorized before that ruling. If approved, implement PT-R1 (`pt-1`) and PT-R2 (`pt-3`) in that
order, one finding per commit with guard proof, then return to Gate 5 with a roster that keeps
mechanically distinct chassis distinct.

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

- Phase PT progression is held while the drafted two-slice repair plan awaits owner approval;
  `.agents/review/index.md` owns the admitted findings and `plan.md` owns the proposed repairs.
- Phase PT S1.4 is landed. Gate 5's exact archetype roster separately blocks S1.5
  Creator/onboarding work.
- Broader Chapter 1/2 effect-catalog runtime implementation remains blocked until promoted into
  a concrete owner-approved phase; the D2 catalog-design gate is closed.
- Phase V closure requires the owner's real-session voice verdict.
- Multiplayer network exposure is owner-handled infrastructure.

## Verification

- Automated: `node test.js` — green through Phase PT S1.4 on 2026-07-31.
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
- Manual/browser playtest: not run; S1.3-S1.4 are internal-only seams with no route or UI. See
  `.agents/repo-guidance.md` (Verification) for required surfaces and the coverage boundary.
- Guard-proof requirements and anti-vacuity practice live in `AGENTS.md` and
  `.agents/decisions.md`; the codereview playbook applies only when explicitly invoked.
- Live seat verification uses a throwaway store: mint seat → `/api/seat/session` → leak-scan the
  payload. Release/revoke are destructive.
- Desktop shell verification is `cargo build` in `desktop/src-tauri`.

## Active Sources

- `AGENTS.md`, `.agents/repo-guidance.md`, `.agents/decisions.md`
- `docs/rules/effects.md`, `.agents/review/effect-catalog-review.md`, and
  `.agents/review/rules-system-plan-intake.md`
- `.agents/review/archetype-portability-matrix-v3.1.md` — active D3 plan;
  `.agents/review/archetype-portability-matrix.md`,
  `.agents/review/archetype-portability-matrix-review.md`,
  `.agents/review/archetype-portability-matrix-v2.md`, and
  `.agents/review/archetype-portability-matrix-v3.md` — retained evidence.
- `plan.md` — the broader phased roadmap.
- `.agents/review/index.md` — implementation findings, order, and verdicts.
- `README.md` — current setup, hosting, seat, and voice flow.
- `.agents/machines.md` — machine-local facts and cleanup blockers.
- `docs/history/state-archive.md` — rotated history; not current state.
