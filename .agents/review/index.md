# Review status

Current workflow: see the 2026-07-26 cross-harness review decision in `.agents/decisions.md`.
Per-finding detail: see `.agents/review/findings/<id>.md`.

## Openreview — three closed rules-system variants (2026-08-02)

Owner-requested exactly one unprimed Fable review of `dadc64a4f65a74f4a906260f092415cafd3f214c..54bf01ba68a28824d09024a9dc84cc67d4c4c579`. Reviewer: claude / claude-fable-5 / high / frontier, competitive — `high` is the owner's explicit per-invocation override of the generic openreview maximum, inline and session-only. Claude Code 2.1.220 returned a schema-valid `findings` envelope with both SHA pins exact and `capability_ok: true`; result UUID `b77edcf8-a790-4343-ac1f-67c9512eb8e6`, session `4a7ab2bb-27fd-456e-b64f-9308b466373d`. No follow-up review or schema re-emission was sent.

Transport note: two local CLI argument-parsing attempts failed before any model invocation. In the one model invocation, command-scoped permissions denied path-qualified test commands in the disposable worktree. The reviewer proved the worktree test file byte-identical to a clean shared tree at the reviewed head, then ran the allowlisted `node test.js` there successfully. This establishes repository-read and test capability for finding intake, but is recorded as an isolation caveat rather than laundered into a clean-pass proof. The CLI envelope also compressed portions of three finding strings into `<<ccr:...>>` references; intake re-established their evidence at the pinned SHA.

| ID | Severity | Impact (one line) | Status | Branch | Reviewer |
|---|---|---|---|---|---|
| rsv-1 | MEDIUM | Proposals are not oriented beside the shipped legacy runtime, inviting approval or planning from the wrong baseline | `[ ]` admitted; repair not authorized | none | claude/claude-fable-5/high/frontier |
| rsv-2 | MEDIUM | Claimed playbook/effort conflict | `[-]` declined; explicit owner instruction outranks generic max and now has provenance | none | claude/claude-fable-5/high/frontier |
| rsv-3 | LOW | State NEXT asks a future agent to repeat the design commit | `[~]` addressed by mandatory state sync; no external re-review | `master` | claude/claude-fable-5/high/frontier |
| rsv-4 | LOW | Rank-5 Ember Lance uses ambiguous Far/Near targeting in the exact-rules example | `[ ]` admitted; repair not authorized | none | claude/claude-fable-5/high/frontier |

## Accepted admin model-registry plan loop (2026-07-15)

Owner-approved replacement for the incoherent repeated `/admin` provider/model/key forms and the
superseded catalog-only plan. The draft defines shared provider credentials, reusable configured
models with custom-key overrides, and per-role primary/fallback assignment. Implementation was
gated until Claude and Grok accepted the same pinned base-plan SHA. Both accepted r8 at
`5f0261375f9b97f464f54ee406d5bafca7f3ea8d`; Claude Fable 5 accepted the later `claude-code`
extension at `0f36f0f920e2e26a0783840e49ad8144f797dec5`. Review trail:
`.agents/review/admin-model-registry-plan.md`.

## Closed admin model-registry implementation (2026-07-15)

| ID | Severity | Impact (one line) | Status | Branch |
|----|----------|-------------------|--------|--------|
| am-1 | HIGH | Repeated tuples cannot safely migrate to shared providers and per-role fallbacks | `[x]` merged (`a2ad7a7`) | `feat/am-1-config-runtime` |
| am-cc | HIGH | Unsafe CLI transport can use API billing or repository capabilities | `[x]` merged (`1a62848`) | `feat/am-cc-claude-code-runtime` |
| am-2 | HIGH | Catalog discovery can leak keys or bypass production endpoint policy | `[x]` merged (`5103f46`) | `feat/am-2-provider-catalogs` |
| am-3 | HIGH | Repeated forms cannot share credentials or assign reusable primary/fallback models | `[x]` merged (`e75c89f`) | `feat/am-3-admin-model-registry-ui` |

## Closed Phase V implementation loop (2026-07-15; owner playtest still gates the phase)

| ID | Severity | Impact (one line) | Status | Branch |
|----|----------|-------------------|--------|--------|
| v-1 | HIGH | Grok is unregistered and one generic voice-key slot can cross vendor boundaries | `[x]` merged (`7d55b77`) | `fix/v-1-grok-provider-config` |
| v-2 | HIGH | OpenAI-only/free-text profiles lose identity across providers, forks, and imports | `[x]` merged (`ef304b7`) | `fix/v-2-portable-voice-profiles` |
| v-3 | HIGH | Host/seat voice resolution diverges and identical playback multiplies provider calls | `[x]` merged (`bb5b9f0`) | `fix/v-3-canonical-voice-route` |
| v-4 | HIGH | Browser aborts after one voice error and still offers non-canonical player overrides | `[x]` merged (`54c08d1`) | `fix/v-4-browser-voice-queue` |

## Active loop (started 2026-07-13 with reviewer Codex) — owner-reported bugs

Historical process at this loop's start: the 2026-07-12 owner decision sent **all** code through an
independent review loop, and the 2026-07-14 division-of-labour decision assigned default roles.
The 2026-07-26 owner decision superseded that policy: cross-harness review is now opt-in. Dated
verdicts below retain the workflow and roles actually used at the time.

| ID | Severity | Impact (one line) | Status | Branch |
|----|----------|-------------------|--------|--------|
| map-1 | MEDIUM | Situation-panel area labels overrun their box: adjacent labels collide and the rightmost is clipped by the canvas edge | `[x]` merged at `dd59c27` (APPROVED r2; branch deleted after content-arrival verification) | none |
| css-1 | MEDIUM | Pre-existing: `rgba(var(--theme-*), α)` over HSL-triple vars is invalid CSS — header/glass/panel fills compute unpainted on every theme | `[x]` MERGED at `41e1938` (ACCEPTED r5); branch deleted | `09bb433` (was `fix/css-1-hsla-theme-vars`) |
| css-2 | MEDIUM | The css-1 guard scanned only one authoring surface, but the attempted broader scanner crashed and rejected valid CSS | `[!]` **ABANDONED / REPLACED BY PHASE CT** — branch refs deleted; never merge or recreate it. See `docs/history/css-2-abandoned-scanner.md` | none (was `fix/css-2-scanner-scope` @ `0229679`) |
| css-3 | LOW | `--theme-glow` was dead: defined 6× in `styles.css`, written on every theme apply, read nowhere | `[-]` **SUPERSEDED** — folded into Phase CT (plan.md). It was a *quadruple* (components + alpha), so it had no complete-colour form and CT deleted it. Never branched | none |

Intake, css-2 + css-3 (2026-07-14, post-merge review of the css-1 commits, owner go "yes, both"):
two candidates, both admitted, zero declined-with-work. The css-1 **fix** was re-verified as correct
and complete on master (zero invalid consumers anywhere in tracked code, not just in the scanned
file) and its guard as genuinely non-vacuous; no defect was found in the merged code itself. Both
new findings are *residue*: css-2 is the r1–r5 "guard the class, not the spelling" lesson applied one
level up (the guard covers the class in only one of the files where the class can occur); css-3 is
dead-variable hygiene that **fails the intake gate on its own merits** (no observable failure) and is
admitted solely on the owner's override — recorded that way in `findings/css-3.md` so the record does
not imply cleanup findings pass triage unaided. Per the 2026-07-12 decision both went through the
loop regardless of size or owner approval; Codex was the assigned reviewer at that time.

**css-1 r1 verdict** (codex 0.144.1, `guard_confirmed: true`): REOPENED — but the split matters.
The reviewer **independently verified the premise** (the theme vars really are HSL triples) and
**graded the fix itself correct**: a pure function-name migration, every value and alpha
unchanged, `134 + 23 = 157` reconciling exactly, with no invalid consumer left anywhere in
`public/` or `map-render.js`. What it reopened is the **guard**, and it did so by *execution*:
it appended `.probe { --panel-alias: var(--theme-panel); background: rgba(var(--panel-alias), 0.7); }`
to the stylesheet in its own worktree and the full suite still passed. The scanner matches only
the literal `rgba(var(--theme-…))` spelling, so indirection through an intermediate custom
property defeats it — a vacuous guard in a new costume. It also rated the `>100` anti-vacuous
assertion as satisfiable by 101 matches inside a CSS comment. Two prior dispatches produced no
verdict at all (a provider capacity error, and the 2026-07-11 dispatch that never returned) —
both failed closed, neither became an accept. Detail: `findings/css-1.md`.

Recorded process defect, now corrected: this index asserted from 2026-07-11 that a `guard-css-1`
existed and proved the surfaces transparent-on-master / painted-at-the-fix. **No such committed
guard ever existed** — it was an ad-hoc browser check, and at that time the repo had no committed
browser harness. bh-1 later landed at `ea9ca9b`. The
reviewer's grading is explicit that the new static scanner does **not** retroactively substantiate
that browser claim.

map-1 r1 verdict (codex 0.144.1, `guard_confirmed: true` — it observed the revert go red,
so the guard is real): REOPENED. The reviewer confirmed the guard and the glyph-estimate
approach, graded the deliberately-scoped-out sibling defect as acceptable, and then found
three defects the coder missed — a UTF-16 surrogate split on truncation, a clipPath id
collision between the validated-distinct area ids `east wing` and `east-wing`, and, most
importantly, that **the canvas-edge half of the reported bug was never fixed at all**
(`validateLocationLayout` clamps `x` and `w` independently, so a valid `{x:92, w:20}` area
runs past the 100-wide viewBox). Detail and the coder's acceptance: `findings/map-1.md`.

## Active rules-system plan loop (started 2026-07-11, reviewer: claude)

Owner-requested synthesis of the handed-over rules-system survey into a
custom, implementation-ready system and plan. Read-only intake reviewed pinned
snapshot `526aa5c` with Claude Code 2.1.207 (`claude-opus-4-8`, high effort,
structured output). Verdict: `ready_for_owner_decisions` — **not** plan
acceptance. It admitted 14 plan gaps (5 HIGH) and produced a 15-decision queue.
D0-D2 are decided; D3 Gates 1-4, 6, and Stage 1 Gate 7 and Phase PT are approved, with S1.1 through
S1.4 landed and S1.5 awaiting Gate 5. Stage 1 Gate 7's answer is no automatic character-name/title translation; broader
proper-name/alias policy and player-driven title-edit workflow remain future.
One persistent character ID is active in exactly one campaign; mechanics/progression travel, first
entry fills missing ability-presentation bindings, and returns reuse saved ability wording exactly
while reviewing only newly gained abilities without destination wording. Gate 3 rejects a
second setting model: portability reads live outline/setting, latest six turns chronological, and
top eight relevant memories by importance then recency through direct helpers shared with MCP. The
GM judges fictional fit, the engine validates requested known ability IDs and allowlisted
display-name/prose fields, and the player approves wording. A
deterministic canon-basis digest detects stale drafts but is not canon. Raw canon remains
GM-private. Archetypes are stable and player-facing; the Creator maps a concept to a known
archetype ID, tailors its campaign description, may show public local profession-name examples,
and preserves the player's separate title. The exact archetype roster remains open for S1.5
Creator/onboarding work, not S1.3. D13/D16 remain deferred. Other rules work still requires promotion into a concrete
approved phase; cross-harness review occurs only when the owner invokes it.

S1.3 landed a read-only ability-wording proposal seam over persistent player-character IDs. It
sends only requested stable ability IDs/name/prose plus destination canon, derives slots internally,
strictly allowlists response fields and statuses, reorders exact IDs, and permits one generic retry.
Presentation text cannot write or apply mechanics; high-confidence numeric/stat/rule claims fail,
while every actual consequence remains canonical-Council authority under the 2026-07-31 owner
ruling. Full `node test.js` passed. Guard proof: temporarily allowing nested model `cost` made the
retry-count test fail; restoring the strict allowlist returned the suite green. No playtest was
possible for this internal-only seam; S1.6 later exposes the approval card. Raw canon containers,
anchors, and long/verbatim excerpts are structurally excluded; because canon lacks visibility
metadata, no deterministic validator can prove that every semantic paraphrase is player-safe.

S1.4 landed immutable per-character/campaign/ability display/prose rows plus versioned shared
campaign vocabulary storage. S1.3 has no engine-owned semantic-key output, so runtime shared batches
fail closed instead of minting arbitrary immutable terms; character-local approved wording works now.
Every direct SQLite operation shares transaction ownership with approvals and read/export snapshots;
expired async owner tokens cannot join a later transaction. Exact retries are idempotent, conflicts
are atomic, and bundle v2 remaps profile/ability IDs while v1 imports empty portability state. Canon
echo checks neutralize all Unicode formatting/default-ignorable characters while storage preserves
legitimate non-Latin and emoji shaping and rejects unsafe invisible/bidi controls at both S1.3 and
S1.4 boundaries. Adversarial review closed the partial-read/export and stale-owner races,
counter-headroom boundary, Unicode/outline-copy guard, and per-ability remap proof with zero remaining
findings. Full `node test.js` passed. Guard mutations independently made the immutability trigger,
operation ownership, stale-owner expiry, Unicode echo, proposal/persistence alignment, and shaping
regressions fail before restoration. No playtest was run because S1.4 adds no route or UI, and
existing host/seat state remains byte-scope unchanged.

Detailed intake decision queue:
`.agents/review/rules-system-plan-intake.md`.

---

## Active loop (started 2026-07-11, reviewer: codex)

Owner-ordered retroactive review of the dice roll theater (code + its plan
slice, pinned range `fea8fb5..53dd6f3`) and plan review of the Phase T2
scene-dynamic theming DRAFT (working tree at `53dd6f3`). Reviewer:
codex-cli 0.144.1, read-only sandbox, structured-output schema. Context: the
dice slice was implemented without owner plan approval (process defect,
acknowledged); this review is part of its retroactive gate. Code fixes await
an owner go; merges stay owner-gated.

### Code findings (dt-* dice theater, poll-* pre-existing)

| ID | Severity | Impact (one line) | Status | Branch |
|----|----------|-------------------|--------|--------|
| dt-1 | MEDIUM | Stale roll theater renders over the menu/another campaign after a switch, intercepting input until skip/timeout | `[x]` merged | `fix/dt-1-theater-epoch` @ `497ffc5` |
| dt-2 | LOW | Clicking to skip turn A's dice also silently suppresses an already-queued turn B's theater | `[x]` merged | `fix/dt-2-skip-per-batch` @ `c04f0cd` |
| dt-3 | LOW | Landed die goes generic green/red, contradicting the recorded theme-follow rider (plan/code conflict) | `[x]` merged | `fix/dt-3-landed-die-theme` @ `e96a873` |
| poll-1 | HIGH | Pre-existing: a stale poll response renders campaign A's full state (theme incl.) over campaign B or the menu — no epoch/ownership check after await | `[x]` merged (ACCEPTED at r5; 4 real probed reopens en route) | `fix/poll-1-response-epoch` @ `e30bb06` |

Merge state (2026-07-11, owner go): all four merged to master in stack order
(merges `3862fa4`, `ebb3fa8`, `4a1482f`, `87808cf`; every merge auto-clean).
The MERGED combination re-verified: suite green and the full ten-guard
browser battery (poll 1/1b/1c/1d/1e/1f/1g + dice dt1/dt2/dt3) ALL PASS
against merged master — the stack was reviewed on per-branch bases, so this
combined run is the integration proof. The branches were retained at that point, then deleted on
the owner's 2026-07-12 go after content-arrival verification.
| jt-1 | HIGH | Pre-existing: Journal tab renders a stale campaign's history over the current one (empirically confirmed); Fork buttons then fork the wrong campaign | `[x]` verified; awaiting owner-gated merge (codex/gpt-5.6-sol/xhigh/frontier esc:T2 — guard audited, not reviewer-executed; see finding) | `fix/jt-1-journal-epoch` @ `09768e1` |
| dr-1 | MEDIUM | Pre-existing: delete/release settle callbacks wipe theme/state over whichever table the user has since entered | `[~]` fixed, pending reviewer verdict | `fix/dr-1-settle-epoch` @ `92c19eb` |
| tts-1 | MEDIUM | Pre-existing: the old table's GM voice keeps narrating over the menu/next campaign; skip pill unreachable on the menu | `[ ]` owner-approved; not started | |
| ds-1 | MEDIUM | Pre-existing: choice buttons allow overlapping submits — duplicated transcript entries and a mid-turn UI lie | `[ ]` owner-approved; not started | |
| fk-1 | MEDIUM | Pre-existing: a fork resolving after the user left (keyboard path) silently seizes the table | `[ ]` owner-approved; not started | |

Skeptic-panel round (2026-07-11, three parallel adversarial agents, ultracode):
13 candidates. Five admitted as NEW pre-existing findings of the poll-1 class
on untouched surfaces (jt-1 confirmed by an executed rig; docs above). One was
a REGRESSION in the poll-1 branch itself — a delete settling mid-load left a
blank screen — fixed at `1409b58` (loadCampaignsMenu now owns the menu
screen) with guard `guard-poll-1e` (FAIL at `06d331d`, PASS at `1409b58`).
Three were guard gaps proven by MUTATION TESTING: the headline submit-success
discard was exercised by no guard (now `guard-poll-1c`, FAIL at base), the
catch-path gate was untested (now `guard-poll-1d`, FAIL at `6188461`), and
the journal fixtures diverged from the real full-history API (guard-poll-1b
fixtures now serve full history + playerAction, with a never-re-append
assertion). One duplicate declined: "dice theater replays over transitions"
is dt-1, already fixed on its branch — the panel reviewed the poll-1 branch,
which does not contain it; the stacked merge order covers it. Two LOW
coverage notes (same-turn else-branch, pollInFlight not individually
guarded) recorded here as accepted residual risk: the epoch check covers
their scenarios; guarding each line individually is diminishing returns.

poll-1 reopen round 1 (codex): two unguarded paths — the journal-backfill
rollback window and the submit's error-path UI. Fix-up `555335a`. Reopen
round 2 (codex, which EXECUTED its own probes): (1) the r1 fix-up's discard
permanently buried other players' intervening turns — the journal filter
used the mutated `lastRenderedTurnNumber`, so turns 6–8 vanished from the
transcript while every guard passed; (2) the finally block's
`setActionInputState(true)` always focused the input, stealing focus on the
replacement table. Fix-up `06d331d`: the submit path now gap-backfills too,
and BOTH paths append through one helper that dedupes per turn at APPEND
time (`highestAppendedTurn`), so racing backfills neither duplicate nor drop
a turn; focus became a parameter granted only on the submitting table's
epoch. Guard `guard-poll-1b.mjs` rewritten to the reviewer's proof standard:
non-empty journal, exactly-once + chronological-order assertions, and an
activeElement assertion — FAIL at `555335a` (j6/j7/j8 all 0, focus stolen),
PASS at `06d331d`; original scenario still passes; suite green.

Reopen round 3 (codex, probed again): a transiently FAILING submit-side
journal request still permanently sealed turns 6–8 out of the transcript
(the watermark dedupe rejected everything below the rendered head; its 503
probe showed j6/j7/j8: 0 with no recovery through turn 10). Fix `588fbe5`:
membership dedupe (`appendedTurnNumbers` Set), failed ranges recorded in
`pendingGaps` and retried on EVERY poll tick (same-turn branch included),
and log nodes now carry `data-turn` so recovered turns insert at their
chronological position (`placeLogEntry`) instead of the tail. Guard
`guard-poll-1f`: gap present after the 503, recovered by the next poll
exactly once and in reading order — FAIL at `1409b58` (gap sealed), PASS at
`588fbe5`; all six guards green at the head; suite green.

Fix stack (owner go 2026-07-11): poll-1 → dt-1 → dt-2 → dt-3, each branch
stacked on the previous (dt-1 builds on poll-1's epoch; merges owner-gated,
in that order). Every fix carries a two-direction browser guard proof
(PASS-on-fix / FAIL-on-revert, results in the finding docs); suite green at
the stack head. Process deviations, recorded: (1) all four fixes were
implemented before their reviewer verdicts, and the four verdict dispatches
run in parallel — a wall-clock tradeoff, reopens land as fix-up commits on
the same branches; (2) dt-1's first guard was VACUOUS (playwright pointer
click auto-waited out the overlay; both sides passed) and was caught by its
own revert-proof, then corrected; (3) poll-1's first revert-proof ran
against the then-uncommitted fix and destroyed it (`git checkout` over
uncommitted work) — reapplied identically, committed, re-proven. Lesson:
commit before revert-proofs.

Intake: codex returned 3 candidates on the dice range; all 3 admitted, 0
declined. poll-1 admitted from the T2 pass's evidence (public/app.js:1223-1259,
783-793) — both passes independently hit the same root cause; it predates the
dice slice. dt-1's clean fix shares poll-1's epoch mechanism.

### Plan findings (t2-*, against the Phase T2 draft in plan.md)

| ID | Severity | Impact (one line) | Status |
|----|----------|-------------------|--------|
| t2-1 | HIGH | Draft named no persistence carrier — validators would silently discard the generated theme (NULL rows, never regenerated) | `[~]` revised |
| t2-2 | HIGH | Stale-response repaint (= poll-1) breaks scene theming; draft ignored it | `[~]` prerequisite recorded |
| t2-3 | HIGH | Draft's "export carries location rows wholesale" claim is FALSE — export/import project explicit fields; theme_json would be silently dropped | `[~]` revised |
| t2-4 | MEDIUM | Forks omit theme_json; a turn-1 fork cannot reconstruct the opening-location pointer | `[~]` revised |
| t2-5 | MEDIUM | Palette slots (primary/secondary/text/text_dim) cannot move bg/panel/border — nightclub keeps the forest background | `[~]` revised |
| t2-6 | LOW | "Once per location, first entry only" is false when final continuity rejects the entry turn | `[~]` reworded |
| t2-7 | LOW | Success criteria omitted the mandatory seat-boundary regression (sceneTheme enters the seat payload) | `[~]` revised |

Intake: codex returned 7 candidates on the T2 draft; all 7 admitted (each
verified against cited code), 0 declined. All are plan-text defects fixed by
revising the draft; `[~]` until the codex re-review of the revision accepts.

r2 re-review verdict: NOT accepted — t2-2…t2-7 closed; t2-1 REOPENED plus two
new findings, all admitted and folded into draft r3:

| ID | Severity | Impact (one line) | Status |
|----|----------|-------------------|--------|
| r2-1 | HIGH | t2-1 carrier still broken: validateTurnData's second validation pass re-projects the location and drops the engine-stamped generated_theme before INSERT (generated_layout survives, theme would not) | `[x]` closed by r3 (confirmed by r3 verdict) |
| r2-2 | MEDIUM | Independent HSL lightness clamps allow ~1.2:1 contrast — a valid palette can be unreadable while all stated tests pass | `[x]` closed by r3 (confirmed by r3 verdict) |
| r2-3 | LOW | "Dice theater follows for free" is false until dt-3 lands (landed die is hard green/red) | `[x]` closed by r3 (confirmed by r3 verdict) |

r3 verdict: NOT accepted — carrier and dt-3 closed; three rendering findings,
all admitted and folded into draft r4:

| ID | Severity | Impact (one line) | Status |
|----|----------|-------------------|--------|
| r3-1 | MEDIUM | Accents (primary/secondary) outside the contrast contract — a passing palette can render the Send button white-on-white | `[~]` r4 → subsumed by the r5 rendered-state contract |
| r3-2 | MEDIUM | 0.7–0.85 opacity on text_dim surfaces drops below the promised 3:1 floor while validator tests pass | `[~]` r4 → subsumed by the r5 rendered-state contract |
| r3-3 | LOW | `rgba(var(--theme-*), α)` with HSL triples is invalid — panel/glow fills compute unpainted, contradicting the no-per-surface-work claim | `[x]` promoted to code finding css-1; a T2 prerequisite (r4 verdict confirmed this closure) |

r4 verdict: NOT accepted — css-1 closure confirmed; three findings showing
the r4 contract still checked TOKENS where the UI renders STATES (consumer
opacity 0.8/0.9/0.55 incl. map-render.js SVG; reachable 0.65 cumulative
group opacity in spotlight demotion; gradients + hover brightness + label
alpha defeating a single on-accent color). All admitted; r5 closes the CLASS:
the contrast contract moves to rendered states over one audited
consumer-envelope manifest shared by validator and tests, with computed-DOM
drift guards for reachable states.

| ID | Severity | Impact (one line) | Status |
|----|----------|-------------------|--------|
| r4-1 | MEDIUM | Accent checks ignore consumer opacity/tint compositing (0.8/0.9/0.55; CSS and generated SVG) — passing palettes render below 3:1 | `[~]` r5 manifest: worst-case effective opacity per token |
| r4-2 | MEDIUM | The 0.7 floor misses reachable 0.65 cumulative group opacity (spotlight demotion) and non-CSS generators | `[~]` r5 manifest: cumulative ancestor opacity + map-render audit |
| r4-3 | MEDIUM | One on-accent color cannot cover gradient endpoints, hover brightness(1.1), and 0.8 label alpha | `[~]` r5: on-accent validated against both endpoints + state transforms |

r5 verdict: NOT accepted — three findings, folded into r6: (r5-1) the "0.65
floor" was falsified by yet another reachable state (completed outline cards
at 0.5, public/app.js:1516-1522) → r6 removes ALL numeric constants from the
plan; the manifest is the only source of floors; (r5-2) gradient ENDPOINTS
do not bound the sRGB interior (a complementary-hue pair passes endpoints,
dips to ≈4.18:1 mid-gradient) → r6 validates the full interpolation at ≥16
stops after alpha/opacity/filters; (r5-3) the drift guard was not
implementable — `node test.js` has no DOM and the manifest had no schema,
path, or completeness rule → r6 names `theme-envelope.js`, a no-DOM scanner
oracle inside test.js that fails on unregistered `--theme-` consumers, and
a `test:theme-dom` playwright-core harness recorded as part of the phase's
verification entry point.

Round 4 (poll-1): the r3 transcript-sealing defect CONFIRMED CLOSED (all six
guards + the reviewer's own two-range same-turn probe); one new MEDIUM — a
stale backfill failure seeded the replacement table's pendingGaps (probed:
B imported a historical slice for A's numeric gap). Fixed at `e30bb06`
(epoch check before mutating pendingGaps); guard `guard-poll-1g` FAILS at
`588fbe5`, PASSES at `e30bb06`; 1b/1f re-green; suite green.

T2 r6 verdict: REJECTED — the numeric-floor concern closed, but the
validation INFRASTRUCTURE demands escalated again: (1) HIGH — the on-accent
contract is infeasible against current consumers (fixed white button text
needs accent luminance ≤0.1833 while map-render's fixed dark labels need
≥0.2142: repair can never converge; map-render.js also missing from the
file list); (2) MEDIUM — 16 gradient samples provably do not bound the
continuous interior (counterexample at t≈0.51); (3) HIGH — the manifest
schema cannot bind one-to-one to real sites (multi-site functions,
repeated selectors, pseudo-elements); (4) MEDIUM — the browser harness
lacks an install/lockfile/isolation story. STATUS: the feature core
(anchor, carrier, portability, seats, payload) has been stable since r3;
every remaining finding targets the contrast-validation infrastructure,
whose depth is a SCOPING DECISION now routed to the owner (simplify the
UI's rendering states vs build the full rig vs ship pragmatic checks).
The loop pauses here rather than iterating autonomously on scope.

RESOLVED by owner decision (2026-07-11, flat design — `.agents/decisions.md`):
gradients removed, opacities unified, one derived on-accent color; T2 draft
r7 adds the T2-s styling-normalization slice and shrinks validation to
enumerated flat-pair checks + the no-DOM scanner. The r6 browser harness,
gradient mathematics, and manifest bijection are out of scope — their cause
is removed rather than instrumented.

poll-1 r5 verdict: **ACCEPTED** at `e30bb06` ("adds the stale-epoch return
before any pendingGaps access…; guard 1g provides a genuine red/green proof;
guards 1b/1f and the full suite remain green. No new defect."). All four
owner-approved code findings (poll-1, dt-1, dt-2, dt-3) are now
reviewer-accepted and await owner-gated merges, in stack order
poll-1 → dt-1 → dt-2 → dt-3.

---

## Closed loop (2026-07-09, reviewer: codex)

Cross-model review of the landed S2/S3 seat-visibility work, pinned range
`9effed2..0a8d712` (S2 server scoping 5595071, S2/S3 frontend a7d0f73,
README 2c3e131, plus decision/state docs). Intake dispatched to codex
(codex-cli 0.144.0, read-only sandbox, structured-output schema); findings
triaged below when it returns. Finding ids: `sv-*` (seat visibility).

### Findings (sv-*)

| ID | Severity | Impact (one line) | Status | Branch |
|----|----------|-------------------|--------|--------|
| sv-1 | HIGH | Released/stale seat context acts as the sole remaining player's character | `[x]` merged | deleted (was `fix/sv-1-revoke-seat-on-release`) |
| sv-2 | HIGH | Internal error text (incl. raw model output) reaches a seat through error bodies | `[x]` merged | deleted (was `fix/sv-2-seat-error-sanitization`) |
| sv-3 | LOW | A `seat_`-prefixed host secret locks the host out of the browser UI | `[x]` merged | deleted (was `fix/sv-3-seat-token-shape`) |
| sv-4 | LOW | Seat payload leaks the act index — and any nested value — inside `currentQuest` | `[x]` merged | deleted (was `fix/sv-4-scope-current-quest`) |
| sv-5 | LOW | An 81–120-char tone 400s and kills the rest of a seat's turn narration | `[x]` merged | deleted (was `fix/sv-5-tone-bound`) |
| sv-6 | LOW | `state.md` asserts both "S2 landed" and "S2 never landed" | `[x]` merged | deleted (was `fix/sv-6-state-contradictions`) |

Merge state (2026-07-09): **all six merged to master** on the owner's explicit
go. Master live-smoked after the merges: no leak markers in a seat payload; a
failed turn returns a generic message (no internals); a malformed body returns
400 with no stack trace; a released character's seat token returns 401.

Rounds needed: sv-1 took 2, sv-2 took 3, sv-4 took 3, sv-6 took 2; sv-3 and
sv-5 were accepted first pass. Every reopen named a real defect. Two of the
reopens (sv-2 r2, sv-4 r2) were caught only because the fixes were themselves
re-reviewed — and two more (sv-2 r3, sv-4 r3) only because those were.

**Reopen rounds — the loop earning its keep.** Four of six findings were
reopened by the reviewer, and every reopen named a real defect the coder missed:

- **sv-1** (`dd0d895` → reopened → accepted at `b5d3a81`): a TOCTOU race.
  `authenticate` captures the seat's character id, then the request awaits the
  config lookup and campaign queue. A release landing in that window leaves an
  *already-authorized* context whose character is gone, and `takeTurn`'s
  `party.length === 1` fast path re-bound it to the sole survivor. Revoking a
  credential cannot close that — only refusing to re-bind can. Reproduced by
  execution; fixed at the root (`selectSpeakingCharacter`).
- **sv-2** (reopened twice, 8 comments total): the "allowlist" was a truthiness
  check on `error.code`, and `sqlite3` sets `code` — a seat received
  `SQLITE_ERROR: no such column: …`. Testing `kind === 'seat'` meant an *absent*
  auth object fell through to the host branch: fail-open exactly where the
  credential is unknown. Native `JSON.parse` messages quote their input.
  `express.json` throws before authentication with no terminal handler. Then, on
  re-review: **a code is a tag, not provenance** — an internal error that merely
  *carries* or *inherits* a seat-safe code still disclosed its message, and an
  inherited `auth.kind` unlocked `rawText`. Disclosure is now opt-in: the
  boundary reveals only an own `publicMessage` the engine deliberately set.
- **sv-4** (reopened twice): first, whitelisting property *names* is not
  whitelisting — a permitted name holds an arbitrary value. Fixed `currentQuest`;
  the reviewer then found the *same defect in four more fields* (`inputKind`,
  `sceneGrounding`, `suggestedChoices`, `rollResults`), i.e. the first fix
  patched the instance, not the class. Every seat-facing field now declares a
  type, and the guard sweeps all of them.
- **sv-6** (`5cb0cc9` → reopened; fix-up at `731d3c5`): the fix for documentation
  drift *contained* documentation drift — it asserted the hermetic-suite property
  from a sibling branch (`fix/sv-1-*`, not an ancestor) as though it held there.

Two guards were caught being **vacuous** during the work (tests that duplicated
the logic instead of calling it, so reverting the fix could not fail them) and
were rewritten against the production functions (`findLiveSeat`,
`boundVoiceDirective`). Enabling change from sv-1: `RPG_DB_PATH` makes the suite
hermetic — it had been opening the operator's real campaign database.

---

## Closed loop (2026-07-05, reviewer: codex)

Cross-model review of the
2026-07-04 queue implementation batch, pinned range `f9ecbd8..6c372c0`
(multiplayer M1–M4, V5 gap closers, Phase D dials, Phase H holodeck, Phase P
portability, plus the 21 same-model review fixes). Intake pass dispatched to
codex; findings triaged below.

## Legend
- `[ ]` Admitted, open (passed intake triage; not yet started)
- `[~]` In progress / pending review
- `[x]` Verified; the row or close-out paragraph says whether it is merged
- `[!]` Contested — declined, disputed, or ruled invalid; awaiting owner adjudication
- `[-]` Declined at intake (kept for the record; no work)

## Findings

| ID | Severity | Impact (one line) | Status | Branch |
|----|----------|-------------------|--------|--------|
| cr-1 | HIGH | Released browser silently becomes another player's character on the next poll | `[x]` merged | deleted (was `fix/cr-1-claim-tombstone`) |
| cr-2 | MEDIUM | Campaign-card profile release reverts on restart, minting duplicate checked-out profiles | `[x]` merged | deleted (was `fix/cr-2-backfill-once`) |
| cr-3 | MEDIUM | Denied actions inflate pacing cadence, licensing GM encounters early | `[x]` merged | deleted (was `fix/cr-3-cadence-resolved`) |
| cr-4 | MEDIUM | Hostile bundle field shapes crash the imported campaign's UI | `[x]` merged | deleted (was `fix/cr-4-record-field-shapes`) |

Intake pass result: codex (gpt-5.5, xhigh) returned 4 candidates against
`f9ecbd8..6c372c0`; all 4 admitted (evidence verified against code at HEAD),
0 declined. Three are gaps in the prior same-model review's own fixes.

Loop worked to completion 2026-07-05: 4/4 verified (cr-4 via one reopen
round — the reviewer found a sibling crash path, fixed and re-accepted).
CLOSED: all four branches merged to master on the owner's explicit go
(merge commits eb5bec3/57c2451/d8fbab0/6123dff), content-verified on master,
branches deleted after verification. Verdict trail lives in each finding doc.

---

## Openreview (2026-07-31, reviewer: kimi)

Owner-dispatched `openreview` with kimi k3 max over pinned range `8320db7..770b3e5` — this
session's records batch: catchup hygiene sweep, npm 12 `allowScripts` fix, D15 evidence
captures, D3 gate-1 decision record, post-gate-1 seam amendments.

Reviewer: kimi / kimi-code/k3 / max / frontier (inline, session-only)
Dispatch notes: kimi CLI 0.31.0, `-p --agent-file --output-format stream-json`; prompt mode
exposes no effort flag, so effort was pinned via a temporary `default_effort = "max"` on the k3
config entry (backed up, restored after the run, restore verified); the agent-file tool
allowlist cannot scope `Bash` to git-only, so the no-write boundary rode the agent contract —
post-run check: no leftover worktree, no tree mutation. Verdict envelope validated fail-closed:
SHAs match the dispatched pins, `capability_ok` true (reviewer read repo files and ran
`npm test` green in its own disposable head-SHA worktree).

Verdict: **findings** (1). The reviewer also independently verified the `allowScripts`
entries fully cover the tree, the §1.1 amendment map's cross-references hold, and the
machines.md removal was factually correct on this machine.

| ID | Severity | Impact (one line) | Status | Branch |
|----|----------|-------------------|--------|--------|
| rq-1 | LOW | Intake D3 row still said Stage 1 seam-blocked, contradicting state.md after `770b3e5` | `[x]` fixed on master (same commit as this record) | none (docs sync) |

Intake: 1/1 admitted, 0 declined. Docs-only fix closed in lockstep with this record per the
repo's docs-only verification rule; detail in `.agents/review/findings/rq-1.md`.

---

## Openreview (2026-08-01, reviewer: claude)

Owner-dispatched `openreview` with literal model `claude-fable-5` at max effort over
the complete landed Phase PT implementation range
`263f3be67a0f9d7d87b3ae212faf86f39c69a397..f75bcc16c5614cad1d9ccb7ba18362019910db2a`
(S1.1 through S1.4).

Reviewer: claude / claude-fable-5 / max / frontier (competitive; owner-selected)

Transport: Claude CLI 2.1.220, headless JSON-schema mode, launch-local read/Grep/Glob,
git, and `node test.js` grant, inside a detached disposable worktree. The valid envelope
UUID was `2ac741a2-4378-4e07-a565-c84fad72e7a3`; both SHA pins matched and
`capability_ok` was true. An earlier otherwise structured result with `capability_ok: false`
was discarded fail-closed because its disposable worktree lacked `node_modules`; no candidate
from that invalid result entered intake.

| ID | Severity | Impact (one line) | Status | Branch |
|----|----------|-------------------|--------|--------|
| pt-1 | MEDIUM | A contract-valid renamed ability improvement can create a second canonical ability because the live GM never receives the existing ID | `[ ]` admitted; repair not authorized | none |
| pt-2 | LOW | Concurrent canon can make the S1.4 helper return invalid-input instead of the later move flow's stale classification | `[-]` declined: stale by contract, no current product caller; carry as S1.6 acceptance coverage | none |
| pt-3 | LOW | Engine-authored oversized ability text can make S1.3 reject an entire wording batch before the GM is called | `[ ]` admitted; repair not authorized | none |

Intake: 2/3 admitted, 1 declined. No repair branch or product-code change is authorized.
The open findings are detailed in `.agents/review/findings/pt-1.md` and
`.agents/review/findings/pt-3.md`; the declined candidate is recorded in
`.agents/review/pt-2.contested.md`.

## Openreview (2026-08-01, reviewer: kimi, archetype-presentation design)

`openreview kimi (kimi-code/k3 @ max, competitive) over 9e4916d49cb052381f322e07d8714fdd88949076..810a008f2905bcaf8771d1fee3aef016d4bae6e1: no material issue`.

Reviewer: kimi / kimi-code/k3 / max / frontier, competitive (inline, session-only)

Dispatch notes: kimi CLI 0.31.1, session
`session_b0fbaf9f-1749-4df4-9993-928c0a48f093`,
`KIMI_MODEL_THINKING_EFFORT=max`, `-p --agent-file --output-format stream-json`.
The live catalog resolved the owner's `k3` request to `kimi-code/k3` after the new CLI rejected
the short alias before model dispatch. The reviewer read repository files, ran read-only Git checks,
left the detached head worktree clean, and returned a schema-valid `clean` envelope with the exact
base/head SHAs, `capability_ok: true`, and no findings.

## Openreview (2026-08-01, reviewer: claude, archetype-presentation design)

Owner-dispatched `openreview` with literal model `claude-fable-5` over the corrected design-only
range `9e4916d49cb052381f322e07d8714fdd88949076..810a008f2905bcaf8771d1fee3aef016d4bae6e1`.

Reviewer: claude / claude-fable-5 / max / frontier (competitive; owner-selected)

Transport: Claude CLI 2.1.220, headless JSON-schema mode, launch-local Read/Grep/Glob, Git, and
`node test.js` grant in a detached disposable worktree. Envelope
`ef8f1e86-31b5-44e9-9688-a0c91fab827e` matched both SHA pins and returned
`capability_ok: true` with two candidate findings.

| ID | Severity | Impact (one line) | Status | Branch |
|----|----------|-------------------|--------|--------|
| pt-4 | HIGH | The historical design required shared campaign vocabulary after narrowing away its only bounded producer | `[-]` declined as superseded by the landed S1.4 no-producer boundary | none |
| pt-5 | MEDIUM | A campaign-tailored archetype description is frozen across moves without a settled destination surface | `[ ]` admitted; design ruling not authorized | none |

Intake: 1 of 2 admitted, 1 declined. The open finding is detailed in
`.agents/review/findings/pt-5.md`; the historical candidate is retained in
`.agents/review/pt-4.contested.md`.

## Codereview mapping fallback (2026-08-01, reviewer: claude)

The corrected-scope openreview returned no archetype roster, so the owner-directed fallback ran
`codereview claude claude-fable-5 high` over the same pinned design range. Fable returned a valid
`reopened` verdict with `guard_confirmed: true`, `capability_ok: true`, and both SHA pins matched.

Reviewer: claude / claude-fable-5 / high / standard (inline, session-only)

The reviewer recommends retaining the 22 candidate names and count while replacing ordinals with
stable slug IDs and replacing tactical-result definitions with mechanical-chassis definitions. It
maps Barbarian to `arch.bruiser` and Battle Mage to `arch.artillery`, with explicit hybrid and
secondary rules. Full candidate and provenance:
`.agents/review/archetype-roster-fable-candidate.md`.

The owner's requested artifact is a full archetype-by-genre matrix, not sparse examples. A fresh
`claude-fable-5` high-effort structured pass filled all 22 roster rows across all 10 genre columns;
the candidate document owns the matrix and the second pass's provenance.

This is reviewer evidence, not an approved Gate 5 roster.

## Codereview (2026-08-01, Gate 5 restrictive class-model plan)

Owner-requested context-rich review of draft `d00c34f77cd9e0c6a72345e45874292aa941f831`
against `03739475c8e7ec1fb72e0884bbd8b88b72d5733e` returned a schema-valid `reopened`
verdict with four actionable plan findings.

Reviewer: claude / claude-fable-5 / high / standard (inline, session-only)

| ID | Severity | Impact (one line) | Status | Branch |
|---|---|---|---|---|
| g5p-1 | MEDIUM | Replacement gate omits the separately admitted `pt-5` description lifecycle | `[x]` verified | `master` |
| g5p-2 | MEDIUM | Extended S1.5 silently blocks S1.6–S1.8 under the fixed slice order | `[x]` verified | `master` |
| g5p-3 | LOW | Subclass is used without an ontology, record shape, or catalog owner | `[x]` verified | `master` |
| g5p-4 | LOW | Eventual supersession checklist leaves two stale intake restatements | `[x]` verified | `master` |

Result UUID: `13a849c6-1587-4873-9edc-40e0511eabcd`; session:
`565def47-5355-43c1-9231-c92cc9410e66`; `guard_confirmed: true`;
`capability_ok: true`; both SHA pins matched. Detailed records are in
`.agents/review/findings/g5p-*.md`.

Four dedicated repair commits (`07d89e8`, `3d5c69d`, `8e4506c`, `ed91b95`) closed the findings.
A fresh high-effort repair-delta review accepted
`d00c34f77cd9e0c6a72345e45874292aa941f831..ed91b95af2072a2b61ef3ca8aeb389c694f71a4f`
with no comments, exact SHA pins, `guard_confirmed: true`, and `capability_ok: true`. Result UUID:
`a64b588b-e196-477f-b4f3-6636aae2060d`; session:
`ea4f2f86-306e-48a8-9d3a-17f82fc08349`.
