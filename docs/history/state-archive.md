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
