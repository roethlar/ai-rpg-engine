# Agent State

This file is the first place future agents should read for current repo state. Keep it
short and update it when important repo facts change. Landed/superseded entries rotate
to `docs/history/state-archive.md`.

## Now

- **ALL CODE GOES THROUGH THE REVIEWLOOP** with codex as reviewer, and planning
  completes before coding starts (owner decision 2026-07-12, `.agents/decisions.md`).
  Unconditional — no exemption for small, obvious, urgent, or owner-approved
  changes, and a green suite is not a substitute. Docs-only changes are out of
  scope.
- **WORKFLOW (owner decision 2026-07-14, settled by a controlled experiment):
  codex IMPLEMENTS, Claude PLANS and ADVERSARIALLY VERIFIES.** Both agents implemented
  the same plan blind; codex's was more complete, faster, and equally correct, and was
  adopted. The loop's independence is preserved by SWAPPING roles, never dropping them —
  **codex cannot review what codex wrote.** Plan reviews now run two lenses: correctness,
  **and a cold-implementer pass** ("could a context-free agent execute this?"), which
  found what four correctness rounds missed. Full rationale: `.agents/decisions.md`.
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
- **ACTIVE IMPLEMENTATION QUEUE:**
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
    executable. Implementation starts with owner-gated reviewloop slice v-1. Grok's verified
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
- **css-2 is ABANDONED; its branch is DELETED and its commits are unreachable** (2026-07-14,
  owner: "too dangerous to leave a poison pill"). It **crashed the suite** (`RangeError` on
  `&#x110000;`) and **rejected valid CSS**. A reviewer defeated it **22 times across three
  rounds**. Phase CT is the root fix that replaced it.
  **Post-mortem, with the code preserved as un-appliable evidence:
  `docs/history/css-2-abandoned-scanner.md`** (a fenced block in Markdown — `git apply`
  rejects it, verified). Finding record: `.agents/review/findings/css-2.md`.
  **If you are tempted to "just harden the scanner", read the post-mortem first — that is the
  trap this cost a day to escape.** css-3 (dead `--theme-glow`) is SUPERSEDED, folded into CT.
- **Reviewer dispatches: a filter-triggering finding poisons its own trail.** Three css-*
  dispatches were content-filtered by the reviewer's provider. Cause: the dispatch told
  codex to read the finding doc, and that doc had become a catalogue of encoded CSS
  payloads. **Fix, now standing practice:** carry a sanitized, spec-framed brief in the
  prompt; describe the *categories* to test rather than reproducing payloads; do not point
  the reviewer at the accumulated trail. The sanitized re-dispatch returned cleanly.
- **map-1 is REOPENED and PARKED — the only live review branch.** (css-1 merged at `41e1938`
  and has since been superseded by Phase CT; its branch is gone.) Detail:
  `.agents/review/index.md` + `findings/map-1.md`.
  - `fix/map-label-overflow` @ `b178222` — three real defects. (1) **The reported
    bug is only half fixed**: `validateLocationLayout` clamps `x` and `w`
    independently, so `{x:92, w:20}` is valid and the label still runs off the
    100-wide canvas — the right-edge clipping the owner screenshotted is untouched;
    the branch only closed area-to-area collision. (2) Truncation splits UTF-16
    surrogate pairs (an emoji name becomes a lone high surrogate). (3) clipPath ids
    collide: the validated-distinct ids `east wing` and `east-wing` both slugify to
    the same fragment id, so one area's label resolves against the wrong clip and
    vanishes. Reviewer graded the guard itself REAL and the deliberately-scoped-out
    sibling defect (below) as acceptable.
- **Reviewer dispatches fail closed.** css-1 r2 was content-filtered with no schema
  envelope (residual still extracted by execution); earlier dispatches also died on
  capacity / no-return. Re-dispatch; never treat a missing envelope as an accept.
- **The "no committed browser harness" problem is SOLVED.** For months the only browser checks here
  were **ad hoc** (a scratchpad Playwright run verified Phase CT; before that, the fictitious
  `guard-css-1`, asserted 2026-07-11 and found never to have existed). bh-1 is now real, reproducible
  and on master. The old caution still applies to **older prose**: treat every `guard-*` you find
  cited in the review index as unverified until you locate the artifact.
- **The rules system is the next big feature** (owner, 2026-07-12: "it's the next
  big feature, and a lot rides on it"), but it is NOT being designed yet — the
  owner is housekeeping first. **D0 is DECIDED** (2026-07-12, `.agents/decisions.md`):
  a fixed house chassis with generated per-campaign flavor skins. That unblocks
  D1, D2, D4, D6, D11, D12 and D14 in the decision queue —
  `.agents/review/rules-system-plan-intake.md`, which holds all fourteen admitted
  findings and the queue; D1 (the die) is the next ask when the owner is ready.
  Present decisions ONE AT A TIME (owner, 2026-07-12) and never bundle "should we?"
  with "now?" — those are separate questions. No rules code before the remaining
  decisions, a concrete phase, and an accepted plan review.
- Review loop backlog (from the 2026-07-11 owner quadruple-go; T2+T2-s plan
  APPROVED, four fixes merged, push done). Still owner-approved to fix through the
  loop, none started: **jt-1 (HIGH — Journal tab renders a stale campaign's history
  and Fork then forks the wrong campaign)**, dr-1, tts-1, ds-1, fk-1. Then T2-s,
  then T2 (css-1 is T2-s's prerequisite). Table: `.agents/review/index.md`.
- Queued, planned, owner-approved, not started: the `/admin` model catalog
  (plan.md → Dev Tooling). Fetches real model names from the selected provider so
  the operator need not know them; combo-box shape (suggestions over a text input,
  never a strict select). Motivated partly by stale hardcoded defaults in
  `api-client.js` — `grok-3` (:283) and `claude-3-5-sonnet-20241022` (:280, retired
  Oct 2025) — which a provider selected with a blank model still resolves to.
- **Priority: the remote two-human multiplayer playtest** (decision 2026-07-09).
  App-side readiness is DONE — Phase S seats S1–S3 are built, reviewed, and on
  master. Connectivity (transport/TLS/tunnel) is owner-handled and out of repo
  scope. This playtest is the scheduled close for every open feel gate.
- Seat isolation is a boundary to RE-TEST, not a finished category. A
  cross-model review on 2026-07-09 found six defects in the fresh S2/S3 work,
  and **four of the six first fixes were themselves wrong** — a TOCTOU race
  survived the obvious fix; a name-only whitelist let nested values through;
  an error `code` was trusted as provenance. All six are merged and verified
  live. Re-test the boundary whenever a field is added to a seat payload or an
  error path. Table and verdict trail: `.agents/review/index.md` (it owns that
  enumeration; do not copy it here).
- Solo play with no seats minted behaves exactly as before, as it always has.
- AI and image provider config is machine-local (`.env`, `AI_PROVIDER`, the
  admin `ai_config` row) and the owner develops across several machines, so
  it legitimately differs per host. Check it where you are — its absence here
  says nothing about anywhere else, and is not a fact worth recording. Where
  no image provider is configured, heroics are inert by design.
- Known, unfixed, recorded here so it is not rediscovered: `map-render.js:99`
  draws the location title as an unclipped SVG `<text>`, the same defect class the
  parked `fix/map-label-overflow` fixes for area labels. A long location name will
  overrun the canvas. Deliberately left out of that branch's scope.

## Next

**THE IMMEDIATE NEXT ACTION: Phase V (Grok TTS) — implement and review v-4.**
v-1 through v-3 are merged and post-merge green. v-4 owns the production browser queue helper,
provider-aware adjacent-speaker batching, provider-race fallback, skip-and-continue playback,
player voice/direction control removal, fallback text bounding, and README updates. Start from the
updated `master`; this is the final planned Phase V code slice before the owner playtest gate.

- **Carry the bh-1 lessons into it.** Both are now decisions (`.agents/decisions.md`): *do not reason
  about CSS in this repo — execute it*; and *a guard proof must fail if its mechanism is removed*
  ("could an implementation that OMITS this still pass this proof?"). The second is general — it
  applies to Phase V's guards too, not just to CSS.
- **map-1** is still REOPENED and PARKED; its fix-ups (grapheme-safe truncation, collision-free
  clip ids, clamp the box to the canvas) need an explicit go (or a park decision). Do not start
  it without one.
- Optional, recorded so it is not lost: **accents come from dialect spelling in the narration
  text** ("Ye'll not be findin'…"), not from any TTS provider — none can do accents. That is an
  `rpg-prompts.js` slice, provider-agnostic and free. Not part of Phase V.
- Continue the rules-system decision queue — the next big feature, but the owner sets
  the pace and was housekeeping when D0 landed. D0 is DECIDED; **D1 (the die) is the
  next ask**. Present the queue in
  `.agents/review/rules-system-plan-intake.md` ONE item at a time and wait; record
  approved wording durably as each lands. Then write the concrete phase and iterate
  pinned reviews to acceptance before any implementation. The synthesis must settle
  the die (the dice theater generalizes
  from d20-only via a `sides` field on the roll record — rider on the Phase 1
  slice in plan.md), the engine-owned ability/effect schema, multiplayer choice
  timing, legacy/versioning policy, and tactical combat (owner decision
  2026-07-11: in scope; the old non-goal line was agent drift, now struck).
  Downstream and BLOCKED on the chassis: the character sheet, the deterministic
  resolver that replaces part of the Referee role, and tactical positioning —
  see the Friends & Fables entries in plan.md Future Topics.
- Run the playtest. Owner steps before play, on the hosting machine: set
  `ACCESS_SECRET` + `ADMIN_SECRET`, confirm an AI provider is configured
  there, expose the server, create the second character (party strip
  **+ Join**, host-only), mint its seat (key icon beside the chip), send that
  token to the other player.
- Branch cleanup (2026-07-14): `fix/bh-1-browser-harness` deleted after merge (content verified
  landed, not just ancestry). Earlier the same day: `fix/css-2-scanner-scope` **DELETED** (poison
  pill — see `## Now`), along with `fix/ct-1-codex`, `plan/ct-executable`, `docs/rescue-from-css-2`
  (all merged) and `fix/css-1-hsla-theme-vars`. **The only branches left are `master` and
  `fix/map-label-overflow`.** Earlier (2026-07-12): four merged fix branches +
  `plan/rules-system` deleted; (2026-07-11): six `fix/sv-*` deleted. Three accidental
  merge commits stay — history rewrite declined; do not re-propose it.

## Blockers

- Nothing technical. Network exposure for the playtest is owner-handled
  infrastructure (owner, 2026-07-09), not a repo task.
- Process, not technical: **map-1** fix-ups need an explicit go (or park).

## Verification

- Automated: `AI_RETRY_BACKOFF_MS=10 node test.js` — green at `ea9ca9b`. Run it rather than
  trusting a group count written here. The suite is hermetic: `RPG_DB_PATH` redirects it to a
  temp DB, closed and removed on exit (before 2026-07-09 it opened the operator's real dev
  database). It is **unchanged by bh-1** — no browser dependency reaches it.
- **Browser: `npm run test:browser`** (the bh-1 harness) — green at `ea9ca9b`. **REQUIRED before
  merging any change to `public/styles.css` or `public/theme-vars.js`** (`.agents/repo-guidance.md`);
  it does **not** cover `app.js` theme wiring or `map-render.js`. One-time setup per machine:
  `npx playwright install chromium` — machine-local, so its absence here says nothing about
  anywhere else. **Missing Chromium makes the command exit NON-ZERO, never skip:** a gate that
  reports success while running no assertions is worse than no gate.
- When a change ships with a test, prove the test guards it (AGENTS.md), and
  beware the vacuous guard — a test that re-implements the logic it checks
  cannot fail when the fix is reverted. This bit twice on 2026-07-09; the
  anti-pattern and its cure are recorded in `.agents/playbooks/reviewloop.md`.
  **It bit a third time on 2026-07-13, in a new costume:** the css-1 scanner guard
  did not re-implement anything, but it matched only the *literal spelling* of the
  defect (`rgba(var(--theme-…))`), so custom-property indirection defeated it. A guard
  must cover the *class*, not the one spelling you thought of. The reviewer found this
  by writing a bypass and watching the suite pass — that is the standard to hold.
  The seat boundary's predicates are already extracted for exactly this
  reason: `findLiveSeat`, `boundVoiceDirective`, `selectSpeakingCharacter`,
  `errorPayloadFor`.
  **A FOURTH costume, found during bh-1 (now a decision in `.agents/decisions.md`):** a guard proof
  that **a wrong implementation also passes**. Ask of every guard proof — *could an implementation
  that OMITS the mechanism this exists to protect still pass it?* In bh-1 the answer was yes for
  three mechanisms, and yes for the design's most load-bearing decision. Applies to any guard, not
  just CSS ones.
- Live: `node server.js`, then a seat smoke (mint seat → `/api/seat/session` →
  leak-scan the payload). Do it against a throwaway store —
  `RPG_DB_PATH=/tmp/x.db` — never the dev DB; release/revoke are destructive.
- Desktop shell (Rust), outside the suite: `cargo build` in `desktop/src-tauri`.

## Active Sources

- `AGENTS.md`, `.agents/repo-guidance.md`, `.agents/decisions.md`,
  `.agents/playbooks/reviewloop.md`
- `plan.md` — phases and the current priority.
- `.agents/review/index.md` — review loops, findings, verdicts.
- `README.md` — hosting/seat flow; accurate as of 2026-07-09.
- `docs/ruleset-licensing.md` (evidence for the dropped-rulesets decision)
- `docs/history/state-archive.md` — rotated history; not current state.

## Unrecorded Repo Memory

- Engine: `db.js` / `rpg-state.js` / `rpg-engine.js`; prompts `rpg-prompts.js`;
  seams `api-client.js` (text), `tts-providers.js` (speech),
  `image-providers.js` (images); `map-render.js`; `seat-auth.js`;
  `server-errors.js` (the seat/host error trust boundary); `admin/` panel.
- The dev DB (`data/rpg_engine.db`) is gitignored and machine-local; its
  contents and sibling files (backups) differ per machine. Ask sqlite on the
  machine you are on rather than trusting any list. The owner keeps no real
  campaigns on any machine — "I don't have any real campaigns. just tests."
  (2026-07-09) — so the DB is throwaway, but release/revoke are still
  destructive: smoke-test against `RPG_DB_PATH=/tmp/x.db`.
- The party-strip **+ Join** button is HOST-only (it creates characters); the
  host mints each character's seat token from the key icon beside its chip.
  Seat sessions see neither control.
- Codex reviewer incantation cache: `.agents/review/harnesses.local.json`
  (gitignored, machine-local). `codex exec` needs `< /dev/null` on stdin and
  generous timeouts.
