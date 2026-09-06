# State Archive

Landed or superseded entries rotated verbatim out of `.agents/state.md` so its
`## Now` holds only live items. Newest first. This file is history, not current
state — never read it to answer "what is true now".

---

## Rotated 2026-09-05 (drift, evidence at `af69a85`)

Completed implementation, superseded review transport, and duplicated decision summaries follow
verbatim. The parked location-title claim is historical: `map-2` is now merged and its record owns
the correction. Remaining catalog, portability, and playtest gates stay in `.agents/state.md`.

- **THE ENTIRE OWNER-APPROVED UI BACKLOG IS MERGED TO MASTER (owner go 2026-08-03).** `jt-1`, `dr-1`, `tts-1`, `fk-1` and `ds-1` — every remaining stale-cross-campaign finding — each landed as one fix commit plus one record commit, then merged to master in stack order with `--no-ff` (merges `4d8ad1e`, `1792a34`, `1367cbc`, `671df7a`, `d1fd432`; every merge auto-clean, no path overlap with master's concurrent state-file commit). Each carries a new durable browser guard in `test-browser.mjs` with a two-direction proof run at least twice independently, and each was accepted by `codex / gpt-5.6-sol / xhigh` with zero comments. Content arrival was verified by diff, not ancestry: the stack tip has a zero-line diff against master across `public/app.js`, `test-browser.mjs` and `.agents/review/`. **Merged-master integration proof:** `node test.js` green and `npm run test:browser` green with nine harness/guard pass lines and no failures. All four findings other than `ds-1` were re-verified as still live in current code before any fix was written. The five `fix/*` branches are retained pending an explicit owner go to delete them; `.agents/review/index.md` owns the per-finding trail.

- **REVIEW IS NOW KIMI K3 AT MAX EFFORT, AND THE BROWSER-GUARD GAP IS CLOSED (owner decision 2026-08-03).** The owner named `kimi k3` as the reviewer and pinned effort `max` after being told kimi exposes only `low|high|max` and has no `xhigh`. This supersedes codex/gpt-5.6-sol for review dispatches. The reason is capability, not preference: `kimi-code/k3` can launch Chromium and run `npm run test:browser`, which codex's macOS sandbox denies, so a kimi reviewer executes the two-direction guard proof itself instead of auditing a supplied transcript. All five UI-backlog findings were re-reviewed on the full mandate and all five were accepted again with zero comments, each with a reviewer-executed revert→fail→restore→pass cycle confirmed from its own transcript rather than from its claim. **The trade-off is recorded, not hidden:** kimi's `-p` mode cannot command-scope Bash, so the reviewer holds broader shell access than codex did, restricted only by an agent-file tool allowlist and confined to a disposable worktree. Tighter sandbox versus ability to actually run the tests — the owner chose the latter. Machine-local incantations and the pinned tier live in `.agents/review/harnesses.local.json`. When reading kimi transcripts, note that `npm run test:browser | tail -N; echo $?` reports `tail`'s exit status: grade on the `Browser guard failed:` line, not the echoed code.

- **SUPERSEDED, RETAINED AS HISTORY — the codex reviewer could not execute browser guards.** codex's macOS sandbox denies the Mach port rendezvous Playwright needs, so `npm run test:browser` cannot run inside it. (A first, separate denial — loopback socket binding — was fixed with codex's own `sandbox_workspace_write.network_access=true` and is recorded in the machine-local harness cache.) The only codex option that would lift the Chromium denial is `--dangerously-bypass-approvals-and-sandbox`, which grants an unsandboxed shell on the owner's machine; that exceeds the codereview playbook's "read-only inspection plus a disposable worktree" grant and was **not** taken on agent authority. All five reviews therefore ran a narrowed, explicitly labelled mandate: the reviewer read the finding and diff, ran `node test.js` itself, adversarially audited the guard **source** for vacuity, and judged the coder-run two-direction transcript against it. `guard_confirmed: true` in these records means *sound by construction and consistent with its transcript*, not *reviewer re-executed*. **Owner call:** authorize the bypass, accept source-audited guard proofs as the standing norm here, or route browser-guarded findings to a harness that can run Chromium. `jt-1.md` carries the full account.

- **THE PRODUCTION ABILITY-KEYWORD PLAN IS OWNER-APPROVED; AKP-1 THROUGH AKP-3 ARE COMPLETE AS OF `f042082`.** `.agents/review/ability-keyword-production-plan.md` authorizes AKP-1 through AKP-4 in order, one verified commit per slice. AKP-1 supplies the shared deterministic matcher/insertion helpers, canonical server-owned trigger projection and revision digest, inert live party projection, and seat-safe trigger whitelist. AKP-2 adds the exact-prose/revision-only request boundary, authenticated server recomputation, immutable Council declarations, stale-before-model handling, and the separate bounded invocation record preserved through recent history, bundle v3 import/export, and forks while remaining absent from seat journals. AKP-3 replaces the live action input with the native textarea/pointer-inert mirror, exact owned-term highlights, campaign-worded ability insertion, suggestion-only typo recovery, opaque revision echo, exact-prose retry/stale recovery, and character/table-safe optimistic cleanup. Invocable abilities are accessible family-labelled buttons; passive and existing free-text abilities remain non-button cards. Unit/browser verification and the exact-prose guard proof are green; the separate hands-on Chrome pass was unavailable, while automated desktop and narrow runs passed. AKP-4 remains blocked until the real versioned class/catalog creator supplies complete stable abilities and bindings; prototype fixtures cannot fill that gap. No real campaigns need generated-rules-card migration, code never deletes disposable test campaigns automatically, and no generated-card converter or dual trigger path is built.

- **THE OWNER ACCEPTED THE CLASSIFICATION METHOD AND REQUESTED FAMILIAR WORKED TOUCHSTONES; THE EXACT ROSTER IS STILL UNAPPROVED.** As `fe168cc`, the audit decomposes Indiana Jones, MacGyver, Hannibal Smith, Ellen Ripley, Michael Knight/KITT, Conan, and Batman into primary class mechanics plus separate skills, occupation, rank, wealth, and assets. It replaces the unfamiliar Intruder/Catalyst/Rider references and deliberately leaves a game-character exemplar blank where no honest familiar one exists. The acceptance was of this mechanic-first decomposition and example format, not a package-level ruling.

- **THE OUT-OF-SAMPLE ARCHETYPE AUDIT IS RETAINED TAXONOMY EVIDENCE, NOT THE CURRENT WORKING-ROSTER RECOMMENDATION.** `.agents/review/archetype-concept-coverage-audit.md` still owns the concept battery, archetype-by-genre option matrix, familiar touchstones, situationality, and balance fixtures. Its proposed ten universal candidates plus conditional Catalyst predated the interaction-burden test and is superseded as the next design baseline. No replacement roster is approved; do not regenerate the three packages from it.

- **THREE CLOSED RULES-SYSTEM VARIANTS HAVE ONE COMPLETED FABLE REVIEW; NONE IS APPROVED OR IMPLEMENTED.** `.agents/review/rules-system-variants.md` owns exactly three whole packages over the signed d100/effect contracts: WWN/CWN-derived Commitment, SRD 5.2.1-derived Slots and rests, and 13th Age-derived Cadence. The frozen packages share nine archetypes, eighteen branches, a 9×10 mapping, deterministic 7–10 minute creation, exact spell/resource/recovery rules, opposition curves, assets/status, persistent help, worked builds, and a licensing/deviation ledger; their Intruder rows are now superseded, so no package can be adopted as written. One `claude-fable-5` openreview ran at owner-specified `high` over `dadc64a..54bf01b`; there was no model follow-up. Fable returned four candidates: legacy-runtime orientation and one spell-target phrase are admitted/open, the stale NEXT was corrected by mandatory state sync without re-review, and the claimed high-vs-max conflict is declined because the explicit owner instruction controls. `.agents/review/index.md` and `findings/rsv-*.md` own the trail. That review found no taxonomy or economy contradiction in its frozen input; later rulings supersede its roster assumptions. The audit predicts Commitment has lower interaction burden than Slots and rests or Cadence, but all three remain playtest hypotheses rather than paper admissions or rejections.

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

- **THE OWNER-APPROVED UI BACKLOG IS COMPLETE AND MERGED.** All five findings are fixed, guarded,
  reviewed, accepted and on master; see the stack entry at the top of this section. The backlog
  has no items left.

- **KNOWN PARKED DEFECT, REVERIFIED AT `3b659bc`:** `map-render.js:142` draws the location title
  as an unclipped SVG `<text>`. A long location name can overrun the canvas; the landed `map-1`
  fix deliberately covered area labels only.

---

## Rotated 2026-08-03 (catchup)

### Ability-keyword composer prototype completed and superseded by the landed production slices

Superseded by the 2026-08-03 production ability-keyword approval and the landed AKP-1 through
AKP-3 slices: this entry's "no product integration ... is authorized" clause no longer holds. The
live constraint on the uncommitted IBP-2 runner was retained in `.agents/state.md`.

- **THE FICTION-FIRST ABILITY-KEYWORD COMPOSER PROTOTYPE IS COMPLETE AND OWNER-ACCEPTED.** `.agents/review/ability-keyword-composer-prototype/index.html` uses one plain textarea with an inline highlight mirror: exact owned ability words and curated aliases highlight, ability-card clicks insert canonical words at the remembered caret, and one-edit spelling recovery only offers a correction. Submitted transcript text remains exact plain prose; debug mode alone shows derived IDs/ranges. AKC-1 and AKC-2 are landed and guard-proved. Browser control was unavailable to the implementing agent, but the owner opened the artifact and accepted the visible interaction as looking right; exhaustive narrow-layout, undo/redo, paste, and IME results were not separately recorded. This remains non-shipping interaction evidence only; no product integration, mechanics activation, class verdict, or push is authorized. The rejected IBP-2 runner remains uncommitted and untouched pending explicit disposal authority; committed IBP-1 remains evidence.

---

## Rotated 2026-07-15 (drift)

### Phase CT landed

- **Phase CT is MERGED** (`77cba10`). `--theme-*` now holds **complete colours**, not bare
  HSL component lists. The css-1 defect class is gone at the root and the css-2 scanner is
  **deleted**. Verified: behavioural equivalence against an oracle from the original
  writer; a 9-mutation battery, none vacuous; and **pixel-identical to the old master in
  Chromium across all six themes**. Detail: `.agents/review/findings/ct-1.md`.
  - **The theme-var contract is now: `--theme-*` holds a COMPLETE COLOUR.** Consume it as
    `var(--theme-x)`, or `color-mix(in srgb, var(--theme-x) N%, transparent)` for
    translucency. **Wrapping it in `hsl()`/`rgba()`/anything is invalid CSS and the browser
    silently drops the declaration.** Components survive only *internally* (the model emits
    them, `rpg-state.js` clamps them, the DB stores them) — `public/theme-vars.js` is the
    one boundary that turns them into colours.

### Phase V implementation landed; feel gate remained open

- **PHASE V CODE COMPLETE — OWNER PLAYTEST PENDING:**
  - **Phase V — Grok TTS.** Grok won a controlled listening test and is added *alongside*
    OpenAI (decisions.md). Its plan review returned **14 findings**: the design **did not
    function for the host at all** (only for seat players), the voice assignment was not
    collision-free, the injection defence was theatre (the mood is **spoken aloud**, so a
    JSON payload scan could never prove seat-safety), and the admin premise was false.
    The r2 cold-implementer review REOPENED the redesign: host campaign identity was false,
    batching could not carry per-line tone, provider capability was invisible to the client,
    legacy ordinals/key migration were undefined, and the narrator had two authorities. The owner
    settled the product conflict: **one campaign-canonical GM voice, and identical host/seat audio
    is synthesized once and reused — no per-player accent and no multiplied provider charge.** The
    r3 plan pinned request/cache/migration/guard contracts, but its independent reviews split:
    Claude accepted while a manual Grok pass REOPENED five material gaps. All five were admitted;
    r4 now pins preview identity, v3 client compatibility, bracket deletion, capabilities fallback,
    and numeric seed validation. **r4 is ACCEPTED** (`43879bd`, Claude Code 2.1.209 / Opus 4.8):
    all five r3 findings independently verified closed, zero new findings, cold-implementer
    executable. All four reviewloop slices are now merged and post-merge green. Grok's verified
    capabilities are in decisions.md — **26 voices, delivery tags work, accents do not.**
    Do not re-derive them from vendor docs or by asking a model; both were wrong.
  - **v-1 MERGED** (`7d55b77`, 2026-07-15): provider registry/request contract,
    provider-isolated key/config compatibility, admin storage, and guards. Claude accepted pinned
    head `0371e35` with independent red→green confirmation; the full suite passed again after merge.
    Status and verdict trail: `.agents/review/index.md` + `findings/v-1.md`.
  - **v-2 MERGED** (`ef304b7`, 2026-07-15): finite delivery schema and portable narrator/NPC
    profiles across creation, legacy read, fork, export, and import. Claude accepted pinned head
    `dc7d169` with independent red→green confirmation; the full suite passed again after merge. The owner granted
    standing authorization on 2026-07-15 to execute the queued Phase V slices serially through
    accepted merges without pausing; stop only for a genuine blocker. Review trail:
    `.agents/review/index.md` + `findings/v-2.md`.
  - **v-3 MERGED** (`bb5b9f0`, 2026-07-15): canonical host/seat audio route and minimum client
    cutover, active-provider profile resolution, bracket neutralization, capabilities, and shared
    synthesis cache. Claude accepted pinned head `9d23b3f` after independent base and mutation
    proofs; the full suite passed again after merge. Review trail: `.agents/review/index.md` +
    `findings/v-3.md`.
  - **v-4 MERGED** (`54c08d1`, 2026-07-15): production browser queue helper,
    provider-aware batching/race recovery, skip-and-continue playback, canonical control cleanup,
    and README. Claude accepted pinned head `ce86e53` after independent base and three mutation
    proofs; the full suite passed again after merge. Review trail: `.agents/review/index.md` +
    `findings/v-4.md`.

### Browser harness landed

- **bh-1 — the browser harness is MERGED** (`ea9ca9b`, 2026-07-14; branch deleted). codex
  implemented; Claude verified adversarially — roles swapped, since codex cannot review what codex
  wrote. Plan accepted after **seven review rounds**. Full trail:
  `.agents/review/findings/bh-1.md`.
  - `npm run test:browser` on master: **186 var-bearing declarations, 49 distinct per theme context,
    294 assertions, 0 failures.** One-time setup per machine: `npx playwright install chromium`.
  - **Verification that matters:** 19/19 guard proofs re-run independently; **16 deliberate bypass
    attempts, 0 escapes** (including `@layer`, `@container`, two-hop indirection, `!important`, and
    the original css-1 spelling); missing Chromium and an unreachable stylesheet both **exit
    non-zero**; no process or file leaks on any path. **And the harness itself was sabotaged** — its
    `unset` control swapped for a bare one — which made it miss a bug, proving guard proof G11 is a
    real discriminator rather than decoration.
  - **The design in one line:** the unit under test is the **declaration**, not the surface; apply it
    to a probe, set the same property to **`unset`** on a control (that is IACVT's exact semantics),
    and **if applying it changes nothing, the browser dropped it.**
  - **Merge gate it establishes** (`.agents/repo-guidance.md`): `npm run test:browser` is REQUIRED
    before merging any change to `public/styles.css` or `public/theme-vars.js`. Deliberately narrow —
    it does **not** cover `app.js` theme wiring or `map-render.js`, and says so.
  - **THE LESSON THAT COST THE MOST, and that generalizes past bh-1: DO NOT REASON ABOUT CSS IN THIS
    REPO — EXECUTE IT.** Three separate review rounds produced a careful, confident CSS claim that a
    browser then refuted. The worst: r2's reviewer reasoned the design *would* catch css-1. **It would
    not have** — a `var()` inside a **shorthand** makes its longhands serialize to the empty string,
    and css-1 was a `background` shorthand, so the collector never saw it and would have reported
    **green on the exact bug the harness exists to catch**. Recorded in `.agents/decisions.md`.
  - **The other durable lesson — the one question every guard proof must survive:** *could an
    implementation that OMITS this mechanism still pass this proof?* It found real holes in four
    consecutive rounds, including a "guard" testing a shape that is **harmless**, and the discovery
    that **nothing proved the `unset` control**. Also in `.agents/decisions.md`.

### css-2 abandoned and superseded

- **css-2 is ABANDONED; its branch is DELETED and its commits are unreachable** (2026-07-14,
  owner: "too dangerous to leave a poison pill"). It **crashed the suite** (`RangeError` on
  `&#x110000;`) and **rejected valid CSS**. A reviewer defeated it **22 times across three
  rounds**. Phase CT is the root fix that replaced it.
  **Post-mortem, with the code preserved as un-appliable evidence:
  `docs/history/css-2-abandoned-scanner.md`** (a fenced block in Markdown — `git apply`
  rejects it, verified). Finding record: `.agents/review/findings/css-2.md`.
  **If you are tempted to "just harden the scanner", read the post-mortem first — that is the
  trap this cost a day to escape.** css-3 (dead `--theme-glow`) is SUPERSEDED, folded into CT.

Drift note (2026-07-15): detached registered worktrees can retain object reachability after project
branch refs are deleted, so the archived “commits are unreachable” clause is not portable. Current
machine-local evidence, if any, belongs only in `.agents/machines.md`.

### Absence of a browser harness was resolved

- **The "no committed browser harness" problem is SOLVED.** For months the only browser checks here
  were **ad hoc** (a scratchpad Playwright run verified Phase CT; before that, the fictitious
  `guard-css-1`, asserted 2026-07-11 and found never to have existed). bh-1 is now real, reproducible
  and on master. The old caution still applies to **older prose**: treat every `guard-*` you find
  cited in the review index as unverified until you locate the artifact.

### Seat-boundary review history

- Seat isolation is a boundary to RE-TEST, not a finished category. A
  cross-model review on 2026-07-09 found six defects in the fresh S2/S3 work,
  and **four of the six first fixes were themselves wrong** — a TOCTOU race
  survived the obvious fix; a name-only whitelist let nested values through;
  an error `code` was trusted as provenance. All six are merged and verified
  live. Re-test the boundary whenever a field is added to a seat payload or an
  error path. Table and verdict trail: `.agents/review/index.md` (it owns that
  enumeration; do not copy it here).

### Branch-cleanup history

- Branch cleanup history (2026-07-14): `fix/bh-1-browser-harness` deleted after merge (content verified
  landed, not just ancestry). Earlier the same day: `fix/css-2-scanner-scope` **DELETED** (poison
  pill — see `## Now`), along with `fix/ct-1-codex`, `plan/ct-executable`, `docs/rescue-from-css-2`
  (all merged) and `fix/css-1-hsla-theme-vars`. Earlier (2026-07-12): four merged fix branches +
  `plan/rules-system` deleted; (2026-07-11): six `fix/sv-*` deleted. Three accidental
  merge commits stay — history rewrite declined; do not re-propose it.

---

## Rotated 2026-07-09 (handoff)

### S2 + S3 built, reviewed, and merged (2026-07-09)

- **MULTIPLAYER REOPENED (owner, 2026-07-09) — S2 + S3 BUILT same day.**
  Target: a playtest with a second human on their own machine outside the
  owner's network; connectivity (transport/TLS/tunneling) is owner-handled,
  out of repo scope. Landed 2026-07-09: S2 seat-scoped visibility
  (whitelist-built seat payloads — own sheet full, silhouettes, shared
  surfaces; no outline/NPC notes/memories/summary/dials; sanitized journal;
  voiceLines stripped to speaker/tone/text with the narrate route resolving
  stored voice profiles server-side) and S3 seat sessions (seat token in the
  token field boots via /api/seat/session; host-only chrome hidden; host
  mint-seat key button on party chips; README rewritten to the seat flow).
  Decision entry 2026-07-09 in `.agents/decisions.md`.

- The 2026-07-09 cross-model review (codex) then found six defects in that
  work; all six were fixed and merged the same day. Detail and verdict trail:
  `.agents/review/index.md` and `.agents/review/findings/sv-*.md`. The durable
  lesson survives in `.agents/state.md`, not here.

### Earlier phase work (2026-07-04/05)

- Landed, all playable solo: Visual Phases V1–V4 + T1 (image seam, structured
  locations + deterministic map, engine-owned current_heroic, agent-generated
  theming), V5 gap closers, Phase D table-style dials (classic/standard
  defaults), Phase H holodeck idle, Phase P campaign export/import.
- Phase 3 M1–M3 (multi-character schema, round-robin turn order) and Phase S1
  (per-seat tokens, server-side character binding, host/seat route guards).
- The 2026-07-05 codex review loop: closed, 4/4 verified and merged. A codex
  plan pass shaped Phase S before it was parked (park later reversed by the
  2026-07-09 reopen decision).

---

## Rotated 2026-07-26 (catchup)

### Closed and superseded findings

- **css-2 is abandoned and replaced by Phase CT.** Its project branch was deleted and, as
  reverified 2026-07-15, is absent from the canonical remotes; it must never be merged or revived.
  `.agents/machines.md` owns the machine-local cleanup blocker. The durable post-mortem is
  `docs/history/css-2-abandoned-scanner.md`.
- **map-1 is CLOSED — landed on `master`** via merge `dd59c27` (2026-07-15) on the owner's
  explicit go, after a codex r2 APPROVED verdict (3/3 defects fixed, guards confirmed, no new
  findings). Content verified on master (both fixed lines present, no `hsl(var(`, suite green:
  pass 1 / fail 0) and `fix/map-label-overflow` deleted after verification.
  `.agents/review/findings/map-1.md` owns the defect enumeration and both verdicts. No review
  finding has an open branch.

### Admin model registry landed

- **The old `/admin` catalog-only plan is superseded by the admin model registry redesign.** Owner
  direction 2026-07-15: compact provider connections with shared keys, reusable configured models
  with optional custom key overrides and live editable catalogs, then primary + fallback assignment
  per Council role. The `am-*` r8 plan in plan.md is accepted by Claude and Grok at
  `5f0261375f9b97f464f54ee406d5bafca7f3ea8d`. A first-class, no-key
  `claude-code` provider using the server process's logged-in plan is covered by the accepted r11
  extension at `0f36f0f920e2e26a0783840e49ad8144f797dec5`; model ids remain manually editable
  because the installed CLI has no documented machine-readable account catalog. Claude Fable 5
  accepted the pinned extension with evidence checked and no comments.
- **`am-1` is accepted at review head `80c2143` and merged into `master` under the owner's go.**
  It adds canonical v2 projection/validation/save seams and Council runtime resolution
  while leaving the v1 admin HTTP wire active. `.agents/review/findings/am-1.md` owns the scope,
  guard proof, and verdict.
- **`am-cc` is accepted and merged into `master` at `1a62848`.** Implementation commit `abbf956`
  adds the isolated, subscription-authenticated Claude Code adapter and routes it through the
  existing AIClient/Council pipeline. Claude Fable independently confirmed the red/green guard
  proof. `.agents/review/findings/am-cc.md` owns the verdict trail.
- **`am-2` is accepted and merged into `master` at `5103f46`.** Implementation commits `619b838`
  and `0578115` add live provider model catalogs, safe Claude Code account status, shared production
  endpoint provenance, a bounded response-body timeout, and the admin-authenticated catalog route.
  Fable independently confirmed the red/green timeout guard and found no remaining material issue.
  `.agents/review/findings/am-2.md` owns the verdict trail.
- **`am-3` is accepted and merged into `master` at `e75c89f`.** Commit `93a91e8`
  atomically activates the v2 admin settings wire and replaces repeated forms with compact provider
  connections, reusable configured models, and five primary/fallback Council assignments. Fable's
  first review found that clearing stored keys can reject or declassify migrated legacy entries;
  fix-up `6e05325` preserves the marker and environment precedence while clearing the secret, with
  server persistence and mutation proof. Fable accepted review head `5c2aeb5` after independently
  reproducing the old failure and rerunning both suites green. `.agents/review/findings/am-3.md`
  owns the full trail.

### Other landed and closed work

- **Two UI slices landed 2026-07-15 on owner request** (workflow-reviewed in-session): `8ade369`
  replaced native confirm()/prompt() with in-app promise-based modals (Tauri/WKWebView no-ops broke
  campaign delete and every input dialog in the desktop shell); `b984eb9` added save-once narration
  audio (see the Phase V bullet). Both verified headless; suite green.
- **Outline-leak report investigated 2026-07-15, no code defect found**: the owner-reported
  "players can see the campaign outline" did not reproduce — every seat-reachable payload routes
  through the `scopeStateForSeat`/`scopeJournalForSeat` allowlists, which never carry the outline,
  and `testSeatVisibility` guards it with leak markers. Most likely cause: an unset `ACCESS_SECRET`
  makes every tokenless request a HOST (full payload) — dev-mode by design. Open hardening
  candidates (unscheduled, would need the loop): fail closed when binding non-loopback without
  `ACCESS_SECRET`; scope the host-only `/fork` response; per-campaign ownership check on the MCP
  `get_campaign_outline` tool.
- Solo play with no seats minted behaves exactly as before, as it always has.

---

## Rotated 2026-07-26 (owner abandoned the greenfield rewrite)

- **THE COST-FIRST GREENFIELD RUNTIME PLAN IS REVIEW-CLOSED, NOT IMPLEMENTATION-APPROVED.**
  `docs/runtime-greenfield-plan.md` is at post-r5 blob
  `03ec483f46e0e476ce261a2854294c2f75f643e1`; the independent r5 verdict was APPROVED with zero
  open findings. The owner mandate makes this plan authoritative over earlier runtime/rules choices
  where they conflict, but §8 still owns the unresolved owner decisions and the plan still needs
  owner sign-off. The shipped Council remains canonical until the plan's gates and cutover criteria
  pass; no greenfield runtime code is authorized yet.

Archive note: the owner abandoned this proposal later on 2026-07-26. Its final artifact moved to
`docs/history/runtime-greenfield-plan-abandoned.md`; it has no current authority.

## Rotated 2026-07-31 (catchup)

- **D3 GATE 1 IS OWNER-ADOPTED (2026-07-31; recorded in `.agents/decisions.md`).** Immutable
  mechanics plus per-campaign expression bindings, three modes (Continue/Branch/Translate),
  mandatory player approval. `.agents/review/archetype-portability-matrix-v3.1.md` is the active
  working draft; v1, v2, v3, and the review file are retained evidence. Gates 2-7 remain unruled;
  no product code is authorized.
- **PHASE PT IS APPROVED AND RUNNING; S1.1 IS LANDED AT `9343e79`** (gate 1 adopted, gate 2 +
  plan approved, all 2026-07-31; decisions recorded). S1.1: engine-issued ability ids, id-first
  matching with legacy name fallback and heal-on-touch; guard proof executed both legs. Coding
  is dispatched to Opus/Sonnet subagents (owner instruction, recorded in the Phase PT status
  line). Gates 4-5 ride S1.3, 6-7 ride S1.5. D5 is not a Stage 1 dependency.

## Rotated 2026-07-31 (campaign-setting authority ruling)

- **GATE 3 (CAPABILITY AXES) IS ON HOLD BEHIND AN OPEN DESIGN CONVERSATION — NOT A DECISION.**
  The owner is talking out the host-authority model and explicitly said "I did not make a rule.
  I'm talking this out." Position in progress: "the GM is the one who controls the ruleset…
  the host controls the environment, not the game." Open threads from the discussion:
  corrections-as-appeal-to-the-GM instead of settings levers; the host already picks the GM's
  brain (model/provider config) so host trust is load-bearing regardless; whether a "table /
  session zero" consent organ is needed for world-level premise or the campaign creator just is
  session zero. A premature decision record + §6.1 draft edit were made and fully reverted —
  decisions.md and the v3.1 draft carry NOTHING from this conversation. S1.2 must not start
  until gate 3 rules AND this settles (it shapes S1.2's declaration edit surfaces).
