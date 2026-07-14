# bh-1: Browser harness — guard the declaration-dropped-by-the-browser class

**Severity**: HIGH (process) — this repo has shipped the same defect class repeatedly (css-1) and
then burned three review rounds and 22 reviewer defeats trying to catch it *statically* (css-2).
Nothing automated can currently see what the browser does with a themed declaration.
**Status**: **PLAN REVISED (2026-07-14), AWAITING RE-REVIEW.** No implementation. No branch cut.
codex must not implement until the revised plan is reviewed and accepted.
**Plan**: `plan.md` → Dev Tooling → "Browser harness — `bh-1`".
**Owner go**: 2026-07-14 (the slice is approved; the *design* was not).
**Review r1** (codex): pinned at `df9f3f4` — **9 findings, verdict: as written it would NOT work.**
**Review r2** (codex): pinned at `74d464d` — **11 findings, verdict `reopened`.**
**Revision r3**: `plan.md` rewritten against both rounds **plus a scratchpad browser probe** that
executed every mechanism before it was written down (see "What the browser said" below).

> **The headline: r2's reviewer reasoned that the design WOULD catch css-1. It would not have.**
> A real Chromium found the defect in minutes. **Do not reason about CSS in this repo — execute it.**

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

## Disposition of the 11 r2 findings (pinned at `74d464d`)

All eleven were judged **valid and accepted** — none disputed. Each was independently checked against
CSS semantics and the repo before acceptance, and the sharpest ones were then **executed** rather than
argued.

| # | Lens | Finding (r2) | Disposition |
|---|---|---|---|
| 1 | correctness | **G3's indirection break is a false pass.** The collector kept declarations whose value contains the literal `var(--theme-`; the indirection break's consumer reads `var(--tmp)`, so it is never collected and the run stays green while broken. | **FIXED.** The collector now keeps **every** declaration whose value contains `var(` — the bug class is `var()`, not `--theme-`. Narrowing the filter *was* the literal-spelling trap, one level up. **Executed: G3 now caught in all six contexts.** |
| 2 | correctness | **`setContent()` gives an opaque origin**, so `cssRules` throws `SecurityError` and the `theme-vars.js` import is blocked by CORS. The harness dies before asserting anything. | **FIXED and CONFIRMED.** Observed exactly: `origin: "null"`, `SecurityError: Cannot access rules`. The probe document is now served **from the server's own origin** via `page.route(...).fulfill()`. Verified: 291 rules readable, module imports cleanly. |
| 3 | correctness | **IACVT does not restore the control's value** — it means `unset`, which can differ from whatever else styles the control. A bare control gives false passes. | **FIXED, and the fix is better than proposed.** The control now sets the same property to **`unset`** — IACVT's exact semantics. **Executed** on the reviewer's own `box-sizing` example: the bare control is wrong in *both* directions (false pass *and* false failure); the `unset` control is right in both. |
| 4 | correctness | **The CSSOM walk hard-codes `CSSMediaRule`/`CSSKeyframesRule`**, so `@supports`/`@layer`/`@container`/`@scope` would be silently skipped. | **FIXED.** Recursion is now generic: **anything with a `.cssRules` collection**. No active gap today (the sheet has only `@media` ×3 and `@keyframes` ×6) but the "self-maintaining" claim is now true. |
| 5 | correctness | **G2 misunderstands inheritance.** Deleting `--theme-primary` from `.theme-fantasy` does not make it undefined — it inherits from `:root`, so Phase A sees a valid colour. | **VALID.** G2 is now a **Phase C** proof (distinctness collapses). **G2b** (`--theme-bg: banana` → NOT-A-COLOUR) and **G2c** (delete from `:root` → UNDEFINED) were added so Phase A's other two paths are each proven. |
| 6 | cold-impl | No same-origin bootstrap specified. | **FIXED** — see #2; the `route().fulfill()` recipe is now written out. |
| 7 | cold-impl | **The six theme contexts are never enumerated**, and `body.holodeck-idle` is **type-qualified** — a wrapper `<div>` cannot activate it. | **VALID and important.** The six are now named, and the plan states they must be set as **`document.body.className`**. A div-based fixture would have made Phase C go red on healthy master. |
| 8 | cold-impl | **Server boot/readiness/free-port/teardown have no executable mechanism.** `server.js:24` reads a fixed `PORT`; `listen()` fires after async DB init; no bound port is reported. | **FIXED.** Four concrete steps now specified (bind-0 to get a port, `spawn` with `PORT` + `RPG_DB_PATH`, **poll `/styles.css`** until it answers, kill + remove the DB in `finally`). |
| 9 | cold-impl | **Phase E's ≥100 threshold is ambiguous** (raw vs deduped) and would be red on healthy master if read as deduped. | **VALID — and worse than estimated.** Measured: **184** raw var-bearing declarations but only **18** distinct `(property, value)` pairs. The threshold is now explicitly **raw**: units ≥ 150, assertions ≥ 250. |
| 10 | cold-impl | **Probe lifecycle / snapshot algorithm underspecified** (fresh elements? reset? which properties compared?). | **FIXED**, and simplified by the `unset` control: compare only the longhands the declaration **owns**, which the browser reports. |
| 11 | cold-impl | **Phase D's "representative inputs" undefined**, and `fullThemeVars` **throws** without `colors.text`. | **FIXED.** Four exact fixtures are now listed. The unguarded `toThemeColor(colors.text)` at `theme-vars.js:28` is recorded as a **latent product gap, explicitly out of scope for bh-1**. |

## What the browser said — the r3 scratchpad probe

Before writing r3, every mechanism was **executed** against a real Chromium and the real
`public/styles.css` (server booted on a temp DB and a free port). This was a **design validation, not
a guard**: it is **not committed and is not reproducible** — the same status `.agents/state.md` gives
Phase CT's ad-hoc check. **bh-1 itself is still the only thing that would make this a guard.** Its
*measurements*, however, are now durable — they are quoted in `plan.md`.

**It found a defect that both the plan and the r2 reviewer had missed — and that the reviewer had
explicitly reasoned was fine:**

> **THE SHORTHAND TRAP.** A `var()` inside a **shorthand** makes that shorthand's longhands
> "pending-substitution": CSSOM still *enumerates* them via `rule.style[i]`, but
> **`getPropertyValue()` returns the EMPTY STRING for every one of them.**
>
> **css-1 was `background: rgba(var(--theme-panel), 0.7)` — a `background` shorthand.** So a collector
> that reads declaration *values* by index would have collected **nothing** for it, never probed it,
> and **reported green on the exact bug the harness exists to catch.** Measured: that collector sees
> **115** var-bearing declarations; the correct one sees **184**.

r2's reviewer wrote, in as many words, that the design *would* catch css-1. It would not have. This is
the third time this repo has been bitten by a guard that matched the shape of the defect its author
had in mind rather than the defect's *class* — and the first time the browser, rather than another
round of argument, is what caught it.

**Measured on master @ `74d464d`:**

| Check | Result |
|---|---|
| Healthy master | **184 units, 282 assertions, 0 failures**, 2 declarations excluded (both `transition`, logged) |
| **G1** — `background: rgba(var(--theme-panel), 0.7)` on `.glass-card` | **CAUGHT in all 6 theme contexts** |
| **G1b** — `border-color: rgba(var(--theme-border), 0.5)` (the shorthand shape) | **CAUGHT in all 6** |
| **G3** — indirection via `--tmp` | **CAUGHT in all 6** |
| Same-origin probe document | 291 rules readable; `theme-vars.js` imports cleanly |
| `all: initial` wrapper vs custom properties | theme vars **still inherit** (`hsl(210 100% 55%)`) — the isolation is safe |

Two **false-positive classes** were also found and killed, both of which would have made healthy master
red:
1. **Inherited-value coincidence.** `font-family: var(--font-body)` on `body` is indistinguishable from
   `unset`, because the probe inherits the very value it is setting. Cured by `all: initial` on the
   probe wrapper.
2. **The animation freeze.** r1 mandated a global `animation/transition: none !important` freeze
   (carried over from the *screenshot* experiment). It **overrides the declarations under test** and
   manufactured false failures. This harness never screenshots, so the freeze is **removed** — and
   `transition*`/`animation*` declarations are excluded from the battery outright (and logged), since a
   dropped transition cannot leave a surface unpainted.

## Guard proofs the implementation MUST produce

Non-negotiable; the harness is worthless without them. G1, G1b and G3 are already **known to be
achievable** — the r3 probe achieved them.

- **G1** — reintroduce css-1 (`background: rgba(var(--theme-panel), 0.7)` on `.glass-card`): Phase B
  must **FAIL**, naming selector, property and theme. Revert: passes.
- **G1b** — `border-color: rgba(var(--theme-border), 0.5)` on `.glass-card` must also **FAIL**. This is
  the **shorthand shape** a naive collector renders invisible.
- **G2** — delete `--theme-primary` from `.theme-fantasy`: **Phase C** must fail (distinctness
  collapses). It does **NOT** make Phase A report UNDEFINED — custom properties inherit from `:root`.
- **G2b** — `--theme-bg: banana` in a theme block: Phase A must report **DEFINED BUT NOT A COLOUR**.
- **G2c** — delete `--theme-primary` from **`:root`**: Phase A must report **UNDEFINED**.
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
