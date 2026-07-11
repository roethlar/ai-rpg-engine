# dt-3: Landed die drops the theme palette for generic green/red

**Severity**: LOW — plan/code contradiction; observable as a themed die going generic at its most prominent moment. No functional harm.
**Status**: Open
**Branch**: (cut on fix start: `fix/dt-3-landed-die-theme`)
**Commit**:

## Evidence
`plan.md` dice-slice Riders: "the die body/glow follows `--theme-primary` … verdict green/red stay semantic." Code: `public/styles.css:1726-1733` recolors the landed SVG + glow green/red (`.roll-landed-success/-failure` target the svg); the tumble shadow at `public/styles.css:1697-1701` is plain black, and the die faces carry fixed dark fills (`public/app.js:1823-1824`).

## Predicted observable failure
A neon or earth-toned scene theme (owner direction 2026-07-11) shows a correctly themed die during the tumble that flips to stock green/red on landing — exactly the moment the owner said should complement the game's palette. Also contradicts what was reported to the owner in chat ("only the verdict green/red are fixed").

## What
The landing state recolors the die itself instead of confining semantic color to the verdict text.

## Approach
(proposed) Die fill/stroke/glow stay `--theme-primary` through tumble and landing; `.dice-verdict` (and `.dice-cost`) keep semantic green/red. Optionally a brief neutral flash on landing for feedback without palette override.

## Files changed
- (pending)

## Guard proof
Headless-browser screenshot check under a non-default theme: assert landed die color equals the theme primary, verdict text green/red. Frontend not suite-covered; state in verdict record.

## Coder dispute (if any)
None — the rider is the recorded intent; the code loses to the plan here.

## Known gaps
None.

## Reviewer comments
(intake verdict only; fix not yet dispatched)
