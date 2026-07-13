# css-1: rgba() over HSL-triple theme variables is invalid CSS — panel fills compute unpainted

**Severity**: MEDIUM — the header, glass panels, narrative panel, and several primary/secondary
glows silently render without their intended fills/effects on EVERY theme, today. Scene-dynamic
theming (T2) would visibly no-op on the dominant surfaces, which is why this is also a T2
prerequisite.
**Status**: REOPENED (r1, 2026-07-13) — the FIX is confirmed correct; the GUARD is
incomplete (a demonstrated bypass). Guard fix-ups pending.
**Branch**: `fix/css-1-hsla-theme-vars`
**Commit**: `32af1ba` (the fix) + `d4d18bd` (the guard)

## Evidence
`public/app.js:1446-1450` stores `--theme-panel` (and friends) as **HSL triples** like
`220, 25%, 12%`. `test.js::testThemeGeneration` and `validateOutlineData`'s `theme_colors`
confirm the same shape (`'320, 100%, 55%'`).

`public/styles.css` then substitutes those vars into `rgba()` in **23 places across 22 lines**
(at base `a58fc58`), e.g. `styles.css:99, 100, 126, 174, 202, 262, 307`.

> **Correction (r1).** An earlier revision of this doc — and the commit message of `d4d18bd`,
> which cannot be amended without an owner go — claimed one of the 23 was a bare `rgb(`. That is
> **false**, as the reviewer established: there are 23 `rgba()` consumers and **zero** bare
> `rgb()`. The 22-vs-23 discrepancy was `grep -c` counting *lines* against `grep -o` counting
> *occurrences*; one line carries two consumers. No missed migration was hidden by the error.

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

### r1 — codex, 2026-07-13T04:05Z — verdict: **REOPENED**

- **Reviewer**: codex-cli 0.144.1, `--sandbox workspace-write`, enforced output schema
- **Reviewed head SHA**: `d4d18bdc08d0b40c35a5c59e53072a5a2fd8a527`
- **Base SHA**: `a58fc58ce4f13e5fcb126464f28f58c63f26aee3`
- **`guard_confirmed`**: **true** — reviewer independently ran revert → FAIL → restore → PASS.
- (A first dispatch at 04:02Z died on a provider capacity error — no verdict, no worktree
  left behind. Failed closed and re-dispatched, per the playbook. The 2026-07-11 dispatch
  also never returned.)

**THE FIX IS CONFIRMED CORRECT. THE GUARD IS NOT.**

**Premise verified independently** (`rpg-state.js:110`, `public/app.js:1605-1615`): the theme
vars really are HSL triples, and the 23 changed sites consume only `--theme-primary`,
`--theme-secondary`, `--theme-panel`, all of which the writer emits as triples. Note:
`--theme-glow` is an HSL-plus-**alpha quadruple** (currently unused), not an RGB triple —
it does not undermine the finding.

**Fix graded (`public/styles.css:99`)**: a pure function-name migration — every value and
alpha unchanged, `134 + 23 = 157` reconciles exactly, and **no production consumer remains
invalid anywhere** in `public/` or `map-render.js`. The visible repaint is the intended blast
radius. The reviewer found nothing wrong with `32af1ba`.

**Guard reopened — two defects, one of them demonstrated by execution:**

1. **`test.js:1334` — the scanner has a real BYPASS, and the reviewer proved it.** It appended
   this to the stylesheet **in its own worktree** and *the full suite still passed*:
   ```css
   .probe { --panel-alias: var(--theme-panel); background: rgba(var(--panel-alias), 0.7); }
   ```
   Substitution still produces the invalid `rgba(220, 25%, 12%, 0.7)` and the background is
   still unpainted — but my regex only matches `rgba(var(--theme-…))` **directly**, so
   indirection through an intermediate custom property sails past it. The guard does not
   guard the class of defect; it guards one spelling of it.
2. **`test.js:1352` — the anti-vacuous assertion is weak.** `validConsumers > 100` is a coarse
   non-empty-file check: 101 matching strings **inside a CSS comment** satisfy it while the
   real stylesheet is arbitrarily broken.

**Confirmed sound (`test.js:1330`)**: the guard does read the genuinely shipped asset —
`public/index.html:18` links `styles.css` and `server.js:68` serves that directory.

**Graded "Known gaps":**

- **Gap 1 — a form-level guard IS sufficient.** This is a deterministic grammar defect; a
  rendered-state/browser test is *not* required to prove it. But *this* scanner is incomplete
  because of the bypass above. (So: the approach is right, the implementation is not.)
- **Gap 2 — the new scanner does NOT substantiate the old claim.** It supplies narrower static
  evidence and cannot back the 2026-07-11 assertion that the surfaces were observed
  transparent-then-painted in a browser. The disclosure corrects the process record, but the
  old claim remains unproven, not retroactively justified.
- **Gap 3 — accepted.** See "Fix graded" above.
- **Gap 4 — I WAS WRONG ON A FACT.** I claimed one of the 23 sites was a bare `rgb(`. It is not:
  base has **23 `rgba()` consumers and zero bare `rgb()`**. The 22-vs-23 discrepancy I
  "explained" with a bare `rgb(` was actually `grep -c` counting *lines* while `grep -o`
  counted *occurrences* — one line carries two consumers. The commit message of `d4d18bd`
  repeats this error; it cannot be amended (no history rewrite without an owner go), so it is
  corrected here and in the Evidence section above. The error hid no missed migration.

**Coder's assessment: I accept the verdict.** The bypass is the important one — a guard that
only catches the literal spelling I happened to write is exactly the "vacuous guard" failure
mode this repo has already been bitten by twice, in a new costume. Fix-ups required:
resolve custom-property indirection transitively, strip comments before scanning, and replace
the `>100` heuristic with something that cannot be satisfied by commented-out text.
