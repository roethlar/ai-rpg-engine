# css-1: rgba() over HSL-triple theme variables is invalid CSS — panel fills compute unpainted

**Severity**: MEDIUM — the header, glass panels, narrative panel, and several primary/secondary glows silently render without their intended fills/effects on EVERY theme, today; scene-dynamic theming (T2) would visibly no-op on the dominant surfaces.
**Status**: Open (admitted 2026-07-11 from the T2 r3 plan review; fix awaits an owner go)
**Branch**: (cut on fix start: `fix/css-1-hsla-theme-vars`)
**Commit**:

## Evidence
`public/app.js:1446-1450` stores `--theme-panel` (and friends) as HSL triples like `220, 25%, 12%`, but `public/styles.css:99-100, 126, 174, 202, 262, 307` (and more — grep `rgba(var(--theme`) substitute them into `rgba()`. `rgba(220, 25%, 12%, 0.7)` mixes a number with percentages, which is not valid legacy RGB syntax (CSS Color 4 §rgb-functions), so the whole declaration is dropped at parse time. Consumers using `hsl(var(--theme-*))` (e.g. `public/styles.css:952`) are correct.

## Predicted observable failure
Theme changes recolor body text and borders but the main header/glass/panel fills compute transparent (falling through to whatever paints beneath), and the primary/secondary alpha glows never render. Discovered because the T2 plan claimed "derived vars recompute … every themed surface follows" — false for every `rgba(var(--theme-*))` consumer.

## What
Pre-existing since the theme variables became HSL triples: a form mismatch between how the variables are stored (HSL components) and how ~a dozen stylesheet rules consume them (`rgba()`).

## Approach
(proposed) Mechanical migration: every `rgba(var(--theme-*), α)` → `hsla(var(--theme-*), α)`. No variable format change (hsl consumers stay valid). Verify by computed style: under a non-default palette, the header, glass-panel, and narrative-panel backgrounds and one glow must compute to non-transparent colors derived from the palette.

## Files changed
- (pending)

## Guard proof
(planned) Headless-browser computed-style check: set a distinctive body-level palette, assert `getComputedStyle` backgrounds of header/glass/narrative panels are non-transparent and hue-match the palette; FAIL on current master (transparent), PASS after migration.

## Coder dispute (if any)
None — verified directly: `grep -n 'rgba(var(--theme' public/styles.css` shows 8+ affected declarations.

## Known gaps
Recorded as a T2 prerequisite (plan.md Phase T2 r4). Pure CSS fix, but it visibly changes how every existing campaign theme renders (panels gain their intended tints) — worth an owner one-look after landing.

## Reviewer comments
(none yet — finding admitted from the r3 plan-review verdict; no fix dispatched)
