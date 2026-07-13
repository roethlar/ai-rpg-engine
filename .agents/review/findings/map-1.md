# map-1: area labels overrun their box in the Situation panel

**Severity**: MEDIUM — the Situation panel is on screen every turn; adjacent area labels
overlap into an unreadable collision and the rightmost label is clipped by the canvas
edge, so the panel misinforms about where things are. Cosmetic in mechanism, but the map
is a *spatial* surface — an unreadable one is worse than none.
**Status**: REOPENED (r1, 2026-07-13) — three real defects found; fix-ups pending
**Branch**: `fix/map-label-overflow`
**Commit**: `b178222` (reviewed; not accepted)

## Evidence
`map-render.js:68` (at base `af4b2bd`) draws each area's name as a bare SVG `<text>`
pinned to the area's top-left corner:

```js
parts.push(`<text x="${area.x + 1.5}" y="${area.y + 3.4}" font-size="2.8" …>${escapeXml(area.name)}</text>`);
```

Nothing constrains the string to `area.w`. SVG `<text>` neither wraps nor clips, so the
label simply keeps drawing past its own rect.

Trigger: any area whose name is wider than its box at font-size 2.8 in the 100×70
`LOCATION_CANVAS`. `validateLocationLayout` (`rpg-state.js:468-470`) clamps area widths to
a minimum of 8 units, and model-generated names routinely exceed what 8–20 units can hold.

Owner-reported from a live session (campaign "Dusthaven"): "Collapsed Windmills" rendered
across the top of "Cracked Plaza", and "Leaning Eastern …" ran off the right edge.

## Predicted observable failure
Render a layout with two adjacent narrow areas whose names are long. The emitted SVG
contains both names at full length, positioned so their text ranges overlap; the
rightmost name extends beyond `viewBox` width and is clipped by the canvas. Detectable
without a browser: the SVG string contains the full untruncated name for an area whose
box cannot hold it.

## What
A rendering bug, pre-existing since Phase V2. The renderer treats an area name as if the
box would contain it, but SVG text has no box — it has an origin. Long names therefore
escape their area, collide with the neighbouring area's label, and overflow the canvas.

## Approach
Fit the label to the box rather than hoping it fits. `fitAreaLabel()` computes how many
glyphs the box can hold at the label font size and ellipsizes past that; an area too
narrow for even one glyph draws no label at all. Because the renderer is a pure string
builder with no DOM, there is no text-measurement API available — the character count is
an *estimate*, using a deliberately generous glyph-width ratio (0.62 × font-size) so it
errs toward keeping fewer characters and a wide-glyph name ("WWW") still fits.

An estimate alone would be a weak fix, so the per-area `clipPath` is the backstop: even
if the ratio underestimates a particular font's advance width, the label is hard-clipped
to its own rect and physically cannot bleed into the neighbour. Belt and braces —
ellipsis for the common case, clip for correctness.

The render stays deterministic (same state → same SVG), which is the property the module
header declares and the suite already asserts.

## Files changed
- `map-render.js:29-62` — new `AREA_LABEL` constants, `fitAreaLabel()`, `slugify()`
- `map-render.js:95-104` — area loop emits a `clipPath` per area and a clipped, fitted label
- `test.js` (structured-location block) — the guard

## Guard proof
`test.js::testStructuredLocations` — four assertions:
- a long name in a narrow box (w=20) is **not** present at full length in the SVG
- overlong labels are ellipsized (`…` present)
- area labels carry `clip-path=`
- a name that **fits** its box (w=60) is drawn in full and is **not** ellipsized

Revert-proof performed: with `map-render.js` restored to base and the guard retained, the
suite goes RED on "A long area name is not drawn at full length in a narrow box";
restoring the fix returns it to green. The guard calls the production `renderLocationMap`
— it does not re-implement the fitting logic, so it is not vacuous.

Full suite green at `b178222` (`AI_RETRY_BACKOFF_MS=10 node test.js`).

## Coder dispute (if any)
None.

## Known gaps
Reviewer should grade these explicitly:

1. **Sibling defect deliberately left unfixed.** `map-render.js:99` draws the *location
   title* as an equally unclipped `<text>`. A long location name will overrun the canvas
   the same way. Scoped out because the owner reported the area labels; recorded in
   `.agents/state.md` so it is not lost. Is leaving it acceptable, or does the fix as
   shipped create a misleading half-guarantee?
2. **The glyph-width ratio is an estimate, not a measurement.** 0.62 is a judgement call.
   The clip makes an underestimate *safe* (text is cut, not spilled) but an
   overestimate wastes space (labels truncate earlier than needed). No measurement is
   available in a DOM-free string builder.
3. **`clipPath` ids.** Built from `slugify(layout.name)` + `slugify(area.id)`. Deterministic
   by design (the module contract forbids randomness). Two *different* locations rendered
   into one document could collide only if both name and area id slugify identically; the
   app renders one Situation map at a time.
4. Guard is a string-level assertion on emitted SVG, not a rendered-pixel check. The repo
   has no browser harness (no Playwright in `package.json` or `node_modules`).

## Reviewer comments

### r1 — codex, 2026-07-13T03:46Z — verdict: **REOPENED**

- **Reviewer**: codex-cli 0.144.1, `--sandbox workspace-write`, enforced output schema
- **Reviewed head SHA**: `b17822205005a59b8a5d6805051b0e737ea42518`
- **Base SHA** (derived by the reviewer): `9050b9ca34852b923af62313fc6b398466ae1d10`
- **`guard_confirmed`**: **true** — the reviewer independently ran revert → FAIL →
  restore → PASS in its own worktree and observed the red. The guard is real, not vacuous.

**Three defects found. All three are real; none are style.**

1. **`map-render.js:51` — Unicode surrogate split.** `slice(0, maxChars - 1)` cuts by UTF-16
   code unit, not by grapheme. A validated width-8 area named `😀A` gives `maxChars = 2`, so
   the label becomes a **lone high surrogate** plus `…` — the renderer emits a replacement
   glyph instead of a valid label prefix. My "Known gaps" note raised Unicode as a question;
   the reviewer confirmed it is an actual defect, not a hypothetical.

2. **`map-render.js:103` — clipPath id collision is real, and my mitigation was wrong.** I
   claimed ids could only collide if *both* name and area id slugified identically. False:
   two areas with the **validated, distinct** ids `east wing` and `east-wing` both slugify to
   `am-x-east-wing`. A duplicate SVG fragment id makes one disjoint area's label resolve
   against the **wrong** clip rect and disappear entirely. The prefix keeps ids syntactically
   valid and deterministic — but not collision-free, which is the property that matters.

3. **`rpg-state.js:468` — the reported symptom is NOT fully fixed.** `validateLocationLayout`
   clamps `x` and `w` **independently**, so `{x: 92, w: 20}` is a valid area whose box runs to
   112 while the `viewBox` ends at 100. The label starts at x=93.5 and is still cut by the
   **canvas edge**. My fix closed area-to-area collision but never addressed canvas overflow —
   and canvas overflow is half of what the owner actually reported ("Leaning Eastern …" clipped
   at the right edge). The fix as shipped does not close its own finding.

**Graded "Known gaps" (reviewer's explicit answers):**

- **Gap 1 (sibling defect at `map-render.js:99`, location title) — ACCEPTABLE scoping.** A
  120-char title still visibly overflows, but it is a separate, durably recorded defect outside
  the area-label guarantee, and is not itself a reason to reopen map-1.
- **Gap 2 (glyph-width estimate) — SOUND.** For a unique, in-canvas clip id, the `clipPath` is a
  genuine containment backstop against underestimates; overestimates only truncate early.
  Validated widths cannot be zero or negative, whitespace-only names are rejected, and long
  single words ellipsize correctly.
- **Gap 3 (clip ids) — DEFECTIVE.** See defect 2 above.
- **Gap 4 (string-level guard, no browser) — ACCEPTABLE for the original regression.** The
  hostile-name assertion at `test.js:975` passes for the *intended* reason (width 20 retains
  `<script>` and emits `&lt;script&gt;…`), not because truncation happened to remove the hostile
  token. But the string guard misses the collision, canvas-edge, and Unicode cases above.

**Coder's assessment of the verdict: all three findings are correct and I accept them.**
Defect 3 is the one that matters most — it means the fix does not fully close the bug the owner
reported. Fix-ups required on this branch, then re-dispatch.
