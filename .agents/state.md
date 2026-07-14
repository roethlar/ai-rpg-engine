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
- **QUEUED, PLANNED, NOT STARTED:**
  - **Phase V — Grok TTS.** Grok won a controlled listening test and is added *alongside*
    OpenAI (decisions.md). Its plan review returned **14 findings**: the design **did not
    function for the host at all** (only for seat players), the voice assignment was not
    collision-free, the injection defence was theatre (the mood is **spoken aloud**, so a
    JSON payload scan could never prove seat-safety), and the admin premise was false.
    Redesigned; **needs another plan review before codex implements.** Grok's verified
    capabilities are in decisions.md — **26 voices, delivery tags work, accents do not.**
    Do not re-derive them from vendor docs or by asking a model; both were wrong.
  - **bh-1 — browser harness** (plan.md → Dev Tooling; owner go 2026-07-14). Guards the ONE
    class this repo keeps shipping: declarations the browser silently drops. **The PLAN has been
    through SIX adversarial review rounds (r1–r6: 9, 11, 10, 7, 4, 10 findings) and is now at r7,
    awaiting the owner's steer.** Still **NOT IMPLEMENTED**, no branch cut. Full trail and the
    disposition of every finding: `.agents/review/findings/bh-1.md`.
    - **The design is settled and VALIDATED.** The oracle has passed **four consecutive rounds**;
      from r4 onward *not one* finding has been against it. It was **executed against a real
      Chromium** before being written down: on master it measures **184 var-bearing declarations,
      282 assertions, 0 failures**, and each sabotage case is confirmed caught in all six themes.
    - **The design in one line:** the unit under test is the **declaration**, not the surface;
      apply it to a probe, set the same property to **`unset`** on a control (that is IACVT's exact
      semantics), and **if applying it changes nothing, the browser dropped it.**
    - **THE LESSON THAT COST THE MOST, and that generalizes past bh-1: DO NOT REASON ABOUT CSS IN
      THIS REPO — EXECUTE IT.** Three separate review rounds produced a careful, confident CSS claim
      that a browser then refuted. The worst: r2's reviewer reasoned the design *would* catch css-1.
      **It would not have** — a `var()` inside a **shorthand** makes its longhands serialize to the
      empty string, and css-1 was a `background` shorthand, so the collector never saw it and would
      have reported **green on the exact bug the harness exists to catch**.
    - **The other durable lesson — the one question every guard proof must survive:** *could an
      implementation that OMITS this mechanism still pass this proof?* It found real holes in three
      consecutive rounds, including a "guard" testing a shape that is **harmless**.
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
- **THERE IS STILL NO COMMITTED BROWSER HARNESS.** A Playwright plugin was enabled 2026-07-14
  and used **ad hoc** to verify Phase CT (installed in a scratchpad; `package.json` is
  untouched). That check is **not reproducible and is not a guard** — the same confusion that
  produced the fictitious `guard-css-1` (asserted 2026-07-11, found never to have existed).
  Treat every "guard-*" in older index prose as unverified until you find the artifact.
  **bh-1 is the slice that would make this real.**
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

**THE IMMEDIATE NEXT ACTION IS AN OWNER DECISION on bh-1: keep hardening the plan, or let codex
implement it now?** Six review rounds are done and every finding is closed (`e01efe0`). The design is
validated and has passed four rounds running; the last two rounds found only *guard proofs that a
wrong implementation could also pass* — real, but a tightening loop that a reviewer can always extend.
The plan is implementable as it stands. Do NOT start implementation without that steer.

- **Then Phase V (Grok TTS): re-review the redesigned plan, then implement.** It is the one the
  owner actually cares about. Weigh the workflow carve-out: V touches the **seat/auth boundary**,
  this repo's most-broken-before area (the sv-* loop found six defects, and four of the first
  fixes were themselves wrong), so **Claude implementing with codex reviewing** may fit better
  than the default codex-implements.
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
- Branch cleanup (2026-07-14): `fix/css-2-scanner-scope` **DELETED** (poison pill — see `## Now`),
  along with `fix/ct-1-codex`, `plan/ct-executable`, `docs/rescue-from-css-2` (all merged) and
  `fix/css-1-hsla-theme-vars`. **The only branches left are `master` and
  `fix/map-label-overflow`.** Earlier (2026-07-12): four merged fix branches +
  `plan/rules-system` deleted; (2026-07-11): six `fix/sv-*` deleted. Three accidental
  merge commits stay — history rewrite declined; do not re-propose it.

## Blockers

- Nothing technical. Network exposure for the playtest is owner-handled
  infrastructure (owner, 2026-07-09), not a repo task.
- Process, not technical: **map-1** fix-ups need an explicit go (or park).
- Process, not technical: **bh-1** needs an owner steer — keep hardening the plan, or implement it?
  Six review rounds are closed and the design is validated; see `## Next`.

## Verification

- Automated: `AI_RETRY_BACKOFF_MS=10 node test.js` — green at `d2d5a0b`. Run it rather than
  trusting a group count written here. The suite is hermetic: `RPG_DB_PATH` redirects it to a
  temp DB, closed and removed on exit (before 2026-07-09 it opened the operator's real dev
  database).
- **There is still NO COMMITTED browser harness** — no Playwright in `package.json` or
  `node_modules`. It was used **ad hoc** on 2026-07-14 (installed in a scratchpad) to verify
  Phase CT; that check is not reproducible and **is not a guard**. Do not assume a cited
  `guard-*` exists as an artifact until you find the file. A committed reviewer cannot reproduce
  an uncommitted guard, and the loop fails closed on that. **bh-1 is the slice that fixes this.**
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
