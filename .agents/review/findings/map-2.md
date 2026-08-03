# map-2: The location title overruns the map canvas

**Severity**: MEDIUM — a long location name is drawn past both canvas edges, so the map's own
caption spills over whatever sits beside it. Centre-anchored, so it overflows symmetrically.
**Status**: In progress — fix landed, pending reviewer verdict
**Branch**: `fix/map-2-title-overflow`
**Commit**: `d4f680b`

## Evidence
`map-render.js:142` (at `50711b4`) drew the title as a bare, unclipped SVG `<text>`:
`<text x="${width / 2}" y="${height + 4.2}" font-size="2.4" text-anchor="middle" ... letter-spacing="0.4">${escapeXml(layout.name)}</text>`.
SVG `<text>` neither wraps nor clips. This was recorded as a known parked defect in
`.agents/state.md`: the landed `map-1` fix deliberately covered area labels only.

## Predicted observable failure
A campaign whose location name is long (GM-generated names are not length-bounded) draws its map
caption past the left and right edges of the SVG canvas.

## Approach
Reuse `map-1`'s two-layer defence rather than inventing a second mechanism: ellipsis for the
common case, a `<clipPath>` as the backstop that a glyph-width *underestimate* cannot defeat —
there is no DOM in this renderer, so glyph width is estimated, never measured.

`fitAreaLabel` was generalised into `fitLabel(name, availableWidth, fontSize, letterSpacing)`,
keeping its code-point-safe ellipsis logic verbatim, with `fitAreaLabel` reduced to a thin caller.
The title's fit must include `letter-spacing`, which adds to *every* glyph advance: at 2.4px and
0.4 spacing the true advance is 1.888, capping the title at 50 glyphs, where ignoring spacing
would have allowed 64 and still spilled.

The `<svg aria-label>` deliberately keeps the **full** location name; only the drawn text is
shortened, so nothing is lost to assistive technology.

## Files changed
- `map-render.js` — `GLYPH_RATIO` hoisted to module scope, `TITLE` constants, `fitLabel`,
  `fitTitle`, and the title `<text>` now clipped.
- `test.js` — new `map-2` assertions inside `testStructuredLocations`.

## Guard proof
`test.js::testStructuredLocations` — a long title must not be drawn whole, must be ellipsized,
must carry a `clip-path` whose `<clipPath>` is actually defined, all clip ids must stay unique,
the accessible name must keep the full string, an 80-glyph emoji title must cut on a glyph
boundary with no lone surrogate, and two renders of the same input must be identical.

**Two-direction proof, run twice independently.** With `map-render.js` reverted to `master` and
the test retained, `node test.js` fails:

```
❌ Test suite failed: AssertionError [ERR_ASSERTION]: A long location title is not drawn at full length
```

The implementing agent additionally confirmed the reverted title carries no clip at all and emits
the whole 71-character name, so both layers of the assertion are live rather than only the
ellipsis. Restoring returns the suite to green.

**Refactor safety.** The `fitAreaLabel` generalisation was diffed against the previous renderer
across 204 combinations (12 name shapes x 17 box widths, including emoji and trailing whitespace),
comparing all output preceding the title element: 0 mismatches. Area-label rendering is
bit-identical.

`node test.js`, `npm run test:browser` (360 assertions, 0 failures, all nine browser guards),
`node --check` on both files, and `git diff --check` are clean.

## Known gaps
- One pre-existing assertion in the twins test counted **every** `<clipPath>` and expected 2; the
  title clip legitimately makes it 3. The count was scoped to area clips (`/-a\d+-/`) while the
  **uniqueness** assertion was left across the full id list — strictly stronger than before, since
  it now also proves the title id cannot collide with an area id. The original intent ("both
  colliding-slug areas get a clipPath") is preserved.
- Glyph width remains estimated, not measured. That is inherent to a DOM-free string builder and
  is exactly why the clip backstop exists.

## Process note
`.agents/state.md` recorded that this defect's fix plan should be drafted and approved before code
changed. No separate plan document was produced: the owner's 2026-08-03 instruction to stop
seeking approvals and make progress on the app was taken as authorization for this recorded,
unblocked defect. Flagged here rather than left silent, since it is a deviation from the recorded
gate.

## Reviewer comments
(pending)
