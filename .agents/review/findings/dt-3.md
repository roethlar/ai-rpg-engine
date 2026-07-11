# dt-3: Landed die drops the theme palette for generic green/red

**Severity**: LOW — plan/code contradiction; observable as a themed die going generic at its most prominent moment. No functional harm.
**Status**: Verified (ACCEPTED; awaiting owner-gated merge)
**Branch**: `fix/dt-3-landed-die-theme` (stacked on `fix/dt-2-skip-per-batch`)
**Commit**: `e96a873` (base `c04f0cd`)

## Evidence
`plan.md` dice-slice Riders: "the die body/glow follows `--theme-primary` … verdict green/red stay semantic." Code: `public/styles.css:1726-1733` recolors the landed SVG + glow green/red (`.roll-landed-success/-failure` target the svg); the tumble shadow at `public/styles.css:1697-1701` is plain black, and the die faces carry fixed dark fills (`public/app.js:1823-1824`).

## Predicted observable failure
A neon or earth-toned scene theme (owner direction 2026-07-11) shows a correctly themed die during the tumble that flips to stock green/red on landing — exactly the moment the owner said should complement the game's palette. Also contradicts what was reported to the owner in chat ("only the verdict green/red are fixed").

## What
The landing state recolors the die itself instead of confining semantic color to the verdict text.

## Approach
The landed-state green/red override on the die svg is removed (CSS rules deleted, `roll-landed-*` class plumbing dropped); the die follows `--theme-primary` through tumble and landing; `.dice-verdict`/`.dice-cost` keep semantic green/red.

## Files changed
- `public/styles.css` — landed-color override rules removed
- `public/app.js` — `classList.add('landed')` only

## Guard proof
`guard-dt3.mjs` (session scratchpad, headless browser): set a magenta test `--theme-primary` (at BODY level — this app applies themes there, which beats a root inline var; the first run set it on :root and read the default gold), land a success roll, read computed colors.
- Fix present (`e96a873`): die `rgb(255,0,255)` (theme), verdict `rgb(16,185,129)` (semantic) → PASS.
- Fix reverted (`c04f0cd` tree): die `rgb(16,185,129)` (stock green) → FAIL.
- Suite green at the stack head (`e96a873`).

## Coder dispute (if any)
None — the rider is the recorded intent; the code loses to the plan here.

## Known gaps
None.

## Reviewer comments
codex-cli 0.144.1 · reviewed `e96a873` vs base `c04f0cd` · 2026-07-11 (UTC) ·
verdict **ACCEPTED**, findings: none. "The diff removes all roll-landed-*
selectors and class plumbing while retaining the landed animation; the die
stays on --theme-primary and .dice-verdict/.dice-cost retain semantic
green/red. The guard is non-vacuous and genuinely distinguishes the fix
(magenta landed die at e96a873, stock green at c04f0cd)."
