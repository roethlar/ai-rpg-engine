# State Archive

Landed or superseded entries rotated verbatim out of `.agents/state.md` so its
`## Now` holds only live items. Newest first. This file is history, not current
state — never read it to answer "what is true now".

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
