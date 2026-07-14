# bh-1: Browser harness — guard the declaration-dropped-by-the-browser class

**Severity**: HIGH (process) — this repo has shipped the same defect class repeatedly (css-1) and
then burned three review rounds and 22 reviewer defeats trying to catch it *statically* (css-2).
Nothing automated can currently see what the browser does with a themed declaration.
**Status**: **PLAN REVISED (2026-07-14), AWAITING RE-REVIEW.** No implementation. No branch cut.
codex must not implement until the revised plan is reviewed and accepted.
**Plan**: `plan.md` → Dev Tooling → "Browser harness — `bh-1`".
**Owner go**: 2026-07-14 (the slice is approved; the *design* was not).
**Review r1**: pinned at `df9f3f4` — **9 findings, verdict: as written it would NOT work.**
**Revision**: `plan.md` rewritten at `36c4167`+ against those findings (this document records the
disposition of each).

## Why the harness exists

CSS declarations the browser silently **drops** render nothing and raise no error. `node test.js`
cannot see it; a human skimming a diff cannot see it. css-1 shipped every panel transparent on every
theme, undetected. The root cause of the whole css-2 saga is that **nobody could see what the
browser was doing**.

## Record-keeping gap — read this before re-reviewing

The r1 review's findings were recorded **only as prose in `.agents/state.md`**, never as a findings
doc. **Seven of the nine are recoverable; two were never written down and are lost.** This document
now owns the record. The re-review is expected to re-surface anything still live, so the gap
self-heals — but it is exactly the failure `AGENTS.md` ("repo is memory") exists to prevent, and it
is recorded here rather than quietly skipped.

## Disposition of the 7 recorded findings

| # | Finding (r1) | Disposition in the revised plan |
|---|---|---|
| 1 | **The core assertion fails on master.** `.btn-primary` paints with a `linear-gradient`, so its `background-color` is transparent *when healthy*. A blanket "no themed surface is transparent" check goes red before catching any bug. | **FIXED — structurally.** The blanket assertion is deleted. The oracle is now **differential**: apply the declaration to a probe, diff its full computed style against an identical unstyled control; **zero difference ⇒ the browser dropped it**. It makes no assumption about which property should be non-transparent, so gradients, shadows and border colours all work uniformly. Listed under "Rejected designs #1" so it cannot come back. |
| 2 | **The surface matrix misses real css-1 sites, most of them STATEFUL**: `.stars-bg`, `.choice-btn:hover`, `.action-form input:focus`, `.ability-tier`, `.campaign-card:hover`, `.tab-btn.active`, `.roll-d20-icon`, a keyframe. | **FIXED — structurally.** The hand-curated matrix is deleted. Declarations are enumerated from the **browser's own parse (CSSOM)**, recursing into `CSSMediaRule` and `CSSKeyframesRule`. Self-maintaining: a themed rule added tomorrow is tested tomorrow. Pseudo-class state never needs to be *driven*, because the unit under test is the **declaration**, not the element. |
| 3 | **"Skip and exit 0" when Chromium is absent DEFEATS the gate** — the required command reports success while the assertions never run. | **FIXED.** Missing Chromium now **exits non-zero** with `browser harness CANNOT RUN — run npx playwright install chromium`. A machine that cannot verify this class must say so. |
| 4 | **Not hermetic:** `public/index.html` loads Google Fonts / cdnjs, so navigation depends on DNS. | **FIXED.** The harness **never loads `index.html`**. The probe document is built via `setContent()` and links only `http://127.0.0.1:<port>/styles.css`. Additionally `page.route()` **aborts every non-`127.0.0.1` request**, so a stray external URL fails loudly. No test-only route in `server.js`, no fixture file in `public/`. |
| 5 | **Non-transparent does not prove the *tested* declaration survived** — a later cascade rule can repaint the element and mask the failure. Use isolated fixtures with expected values. | **FIXED**, though not as suggested. Probes are **isolated** (no app cascade participates), so masking cannot occur. But *expected values* are rejected: they are golden baselines in another costume and rot on every intentional `45%`→`50%` tweak. The differential oracle needs no expected value. |
| 6 | **Reading a `--theme-*` value cannot prove it is a valid colour** — custom properties accept arbitrary token streams. Use a typed probe with a literal sentinel. | **FIXED as directed.** Phase A: a **typed sentinel probe** on the *inherited* property `color`, parent set to literal `rgb(1, 2, 3)`. `var(--theme-X, rgb(4,5,6))` → `rgb(4,5,6)` means **undefined**; `var(--theme-X)` → `rgb(1,2,3)` means **defined but not a colour** (IACVT falls back to inherited); anything else is a **valid colour**. A three-way discriminator. |
| 7 | **Driving theme classes directly bypasses `app.js`/`theme-vars.js` and never exercises `map-render.js`**, so "required before merging these files" overstates coverage. | **PARTLY FIXED, PARTLY CONCEDED — deliberately.** `theme-vars.js` is now covered for real (**Phase D** imports the *live module* from the running server and runs its output through Phase A's validity probe). `app.js` wiring and `map-render.js` are **not** covered, so they are **removed from the merge-gate list**, which is now just `public/styles.css` + `public/theme-vars.js`, with the gap stated explicitly. Guarding two files honestly beats claiming five. |

## Two r1 findings the evidence CORRECTS

Checked against `public/styles.css` @ `36c4167`. Recorded so a re-reviewer does not re-raise them:

- Finding 2 cited **"the pulse keyframe"** as a missed css-1 site. `@keyframes d20-pulse` — the one
  `.roll-d20-icon` actually runs — contains **no theme vars at all**, only `transform`. The themed
  keyframe is **`@keyframes pulse-glow`** (a `drop-shadow` `color-mix()` on `--theme-primary`).
  The finding is *closed*, but by CSSOM enumeration rather than by the mechanism it assumed.
- `.roll-d20-icon` themes `color` and `text-shadow` and has **no background at all** — a
  background-oriented oracle would have probed the wrong property on it. This is finding 1 again,
  and it reinforces why the oracle must not privilege any property.

## Guard proofs the implementation MUST produce

Non-negotiable; the harness is worthless without them.

- **G1** — reintroduce css-1 (`background: rgba(var(--theme-panel), 0.7)` on `.glass-card`): Phase B
  must **FAIL**, naming selector, property and theme. Revert: passes.
- **G2** — delete `--theme-primary` from `.theme-fantasy`: Phase A must flag it **UNDEFINED**.
- **G3 — anti-vacuity.** Break it through **custom-property indirection** (`--tmp: var(--theme-panel);`
  then `background: rgba(var(--tmp), 0.7);`). Must **still fail**. The css-1 *scanner* guard passed
  its own guard proof and was still worthless because it matched only the **literal spelling** of the
  defect and indirection walked straight past it (`.agents/state.md`, Verification — "it bit a third
  time, in a new costume"). A guard must cover the **class**, not one spelling.
- **G4 — fail-closed.** Point the probe document at a non-existent stylesheet: the harness must
  **FAIL** (Phase E), not pass with zero assertions. Without Phase E, a stylesheet that fails to load
  yields zero declarations, zero assertions, and a **green run**.

## The trap, restated

**This is not a static scanner and must never become one.** CSSOM enumeration decides *what to probe*;
the **browser** is the oracle. css-2 wrote its own CSS parser and used *that* as the oracle — it
crashed the suite, rejected valid CSS, and a reviewer defeated it 22 times across three rounds before
it was abandoned and its branch deleted. If you find yourself tempted to "just harden the scanner",
read `docs/history/css-2-abandoned-scanner.md` first — that is the trap that cost a day to escape.
