# css-1: rgba() over HSL-triple theme variables is invalid CSS — panel fills compute unpainted

**Severity**: MEDIUM — the header, glass panels, narrative panel, and several primary/secondary
glows silently render without their intended fills/effects on EVERY theme, today. Scene-dynamic
theming (T2) would visibly no-op on the dominant surfaces, which is why this is also a T2
prerequisite.
**Status**: In progress (fix + guard committed; awaiting reviewer verdict)
**Branch**: `fix/css-1-hsla-theme-vars`
**Commit**: `32af1ba` (the fix) + `d4d18bd` (the guard)

## Evidence
`public/app.js:1446-1450` stores `--theme-panel` (and friends) as **HSL triples** like
`220, 25%, 12%`. `test.js::testThemeGeneration` and `validateOutlineData`'s `theme_colors`
confirm the same shape (`'320, 100%, 55%'`).

`public/styles.css` then substitutes those vars into `rgba()` in **23 places** (at base
`a58fc58`), e.g. `styles.css:99, 100, 126, 174, 202, 262, 307`. One of the 23 is a bare `rgb(`,
not `rgba(`.

`rgba(220, 25%, 12%, 0.7)` mixes a number with percentages. That is not valid legacy rgb
syntax (CSS Color 4 §rgb-functions), so the **entire declaration is dropped at parse time**.
Consumers using `hsl(var(--theme-*))` (e.g. `styles.css:952`) were always correct — 134 of them
at base.

## Predicted observable failure
Under any theme, the main header, glass panels, and narrative panel backgrounds compute
**transparent** (falling through to whatever paints beneath), and the primary/secondary alpha
glows never render at all. Theme changes appear to recolor only body text and borders.

Statically detectable without a browser: `public/styles.css` contains `rgba(var(--theme-…))`
declarations at all. The parse-drop follows from the form.

## What
Pre-existing since the theme variables became HSL triples: a form mismatch between how the
variables are **stored** (HSL components) and how ~two dozen stylesheet rules **consume** them
(`rgba()`). Discovered during the T2 r3 plan review, which claimed "derived vars recompute …
every themed surface follows" — false for every `rgba(var(--theme-*))` consumer.

## Approach
Mechanical migration: every `rgb()`/`rgba()` consuming a `--theme-*` var becomes `hsl()`/`hsla()`.
No variable format change (the 134 existing `hsl()` consumers stay valid, and the writer in
`app.js` is untouched). This fixes the root cause — the form mismatch — rather than the symptom,
and it is the minimal change that makes the declarations parseable.

Counts corroborate the migration exactly: base = 134 valid + 23 invalid; head = **157 valid + 0
invalid**.

## Files changed
- `public/styles.css` — 22 lines changed (23 consumer sites; two share a line), `rgb*()` → `hsl*()`
- `test.js` — `testThemeVarConsumers()`, the guard, plus a `fileURLToPath` import

## Guard proof
`test.js::testThemeVarConsumers` — a **no-DOM scanner** over the shipped stylesheet:

1. Asserts **zero** `rgb()`/`rgba()` consumers of any `--theme-*` var, reporting each offender
   with a `public/styles.css:<line>` anchor.
2. **Anti-vacuous assertion**: the stylesheet must still consume `--theme-*` widely through the
   *valid* `hsl()`/`hsla()` form (>100 sites) — so an empty, moved, or renamed file cannot satisfy
   the guard trivially.

Revert-proof performed at `d4d18bd`: with `public/styles.css` restored to base and the guard
retained, the suite goes **RED**, naming the offenders (`styles.css:99, 100, 126, 174, 202, …`);
restoring the fix returns it to **green**. Full suite green at the branch head.

The guard reads the **real shipped asset** and re-implements no production predicate, so it
cannot be vacuous in the way this repo has been bitten by twice.

## Coder dispute (if any)
None.

## Known gaps
Reviewer should grade these explicitly:

1. **The guard proves the FORM, not the pixels.** It asserts the invalid CSS form is absent, which
   is the defect; it does not assert that the header/panel backgrounds now compute to a
   non-transparent color in a real browser. The repo has **no browser harness** (no Playwright in
   `package.json` or `node_modules`), which is precisely why the previously-claimed `guard-css-1`
   never existed as a committed artifact. Is a form-level guard sufficient here, or does this
   finding genuinely require a rendered-state check?
2. **Prior process defect, disclosed.** `.agents/review/index.md` has asserted since 2026-07-11
   that a `guard-css-1` existed and proved "all three surfaces transparent/none on master, painted
   at the fix". No such committed guard exists. It was an ad-hoc browser check. The index was
   wrong; this finding doc is the correction.
3. **Blast radius.** This visibly changes how every existing campaign theme renders — panels gain
   their intended tints for the first time. That is the intended fix, but it is a user-visible
   change to every surface, and worth an owner one-look after landing.
4. **Bare `rgb(` vs `rgba(`.** One of the 23 sites was `rgb(`, not `rgba(`. The scanner regex
   (`\b(rgba?)\(`) catches both. Confirm no other color function (e.g. `color-mix`, relative color
   syntax) consumes a theme triple in a form the scanner would miss.

## Reviewer comments
(pending first dispatch — the 2026-07-11 dispatch never returned a verdict)
