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
- **PHASE PT IS APPROVED AND RUNNING; S1.1-S1.2 ARE LANDED AND S1.3 IS READY.** D3
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
  and the player approves wording. A
  deterministic canon-basis digest detects stale drafts but is not canon. There is no second
  settings checklist, classifier, editor, sync workflow, self-network call, branch, or alternate
  character. Phase PT in `plan.md` owns the fixed slice order and coding assignments.
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

**NEXT:** Implement S1.3 as an internal ability-only proposal and strict-validation seam over
existing stable ability IDs; accept no archetype, family, character-name, title, or arbitrary-slot
output.

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

- No product-code defect blocks development.
- Phase PT S1.3 has no decision blocker. Gate 5's exact archetype roster blocks S1.5
  Creator/onboarding work only.
- Broader Chapter 1/2 effect-catalog runtime implementation remains blocked until promoted into
  a concrete owner-approved phase; the D2 catalog-design gate is closed.
- Phase V closure requires the owner's real-session voice verdict.
- Multiplayer network exposure is owner-handled infrastructure.

## Verification

- Docs-only D3 gate sync: `git diff --check` and the active-record stale-language scan are green
  on 2026-07-31. Runtime tests were not rerun because no shipped file changed.
- Automated: `npm test` — green for Phase PT S1.2 on 2026-07-31.
- S1.2 guard proof: changing the Stage 1 history window from latest to earliest failed the dedicated
  test with turns 1-6 instead of 1005-1010; restoring latest returned the full suite to green.
- Browser: not run during the 2026-07-31 catchup; no trigger surface changed. See
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
