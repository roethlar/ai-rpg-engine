# css-2: the css-1 scanner guards one file, not the class — an invalid consumer in index.html or app.js ships silently

**Severity**: MEDIUM — the css-1 guard exists *specifically* to stop an invalid theme-var consumer
from reaching a surface unpainted, and it took five reopen rounds (r1–r5) to close the last
spelling-vs-class hole. It still reads only `public/styles.css`. Two other tracked files consume
`--theme-*` today, so the same defect can be reintroduced in either one and the suite stays green.
**Status**: Open
**Branch**: `fix/css-2-scanner-scope`
**Commit**: (filled in after commit)

## Evidence
`test.js::testThemeVarConsumers` (at `41e1938`) reads exactly one file:

    const stylesPath = path.join(..., 'public', 'styles.css');
    const raw = fs.readFileSync(stylesPath, 'utf8');

`findInvalidThemeRgbConsumers` itself is already file-agnostic — it takes a `pathLabel` option and
operates on a CSS *fragment*, not on a path. The narrow scope is in the caller, not the scanner.

Theme variables are consumed outside that one file:

- `public/index.html:215` — `style="… border: 1px solid hsl(var(--theme-border)); …"` (inline
  attribute CSS; also `:409`, `:416`).
- `map-render.js:30-99` — `hsl(var(--theme-primary, …))` inside generated SVG (server-side).
- `public/app.js:1579-1631` — writes the `--theme-*` custom properties.

Both `public/index.html` and `public/app.js` are places where a CSS *value* can be authored (an
inline `style=` attribute; a JS-built style string), so both can carry the css-1 defect.

## Predicted observable failure
Author `style="background: rgba(var(--theme-panel), 0.7)"` into `public/index.html` (the exact
defect css-1 fixed, in a file the guard does not read). The declaration is invalid, the browser
drops it, the surface renders unpainted — and `node test.js` stays **green**. That is the
observable failure: the guard reports success while the defect class it was built to catch has
shipped.

This is directly executable as a red/green proof (see Guard proof).

## What
A scope gap, not a live defect: as of `41e1938` there are **zero** invalid consumers anywhere in
tracked code (verified by grep across the repo, not just the scanned file). The finding is that the
guard's coverage is narrower than the class it claims to guard — the same *kind* of gap the r1–r5
reopens kept finding, one level up. r5's lesson was "a guard must cover the class, not the one
spelling you thought of"; the residue is that it covers the class in only one of the files where
the class can occur.

## Approach
Point the existing scanner at every tracked file that can author a CSS value consuming a theme var,
rather than rewriting it: `public/styles.css`, `public/index.html`, `public/app.js`. The scanner
core (`collectVarAliases`, `resolvesToThemeTriple`, `findInvalidThemeRgbConsumers`) is unchanged —
only the caller's target list and the comment-blanking grow.

Comment handling per syntax, because a comment must not hide an offender *or* manufacture one:

- CSS (`/* … */`) — already handled by `blankCssComments`; also valid in JS.
- HTML (`<!-- … -->`) — new `blankHtmlComments`, same newline-preserving technique so line numbers
  still map.
- JS line comments (`//`) are **deliberately not blanked**. Blanking to end-of-line would let a
  same-line offender hide behind a `//` in a string (e.g. a URL), which is a false *negative* — the
  failure mode this whole finding is about. A `//`-commented offender therefore fails the suite
  spuriously (a false positive). That is the fail-closed direction and is the intended trade, kept
  consistent with the loop's "a parse miss never silently becomes an accept" rule.

`map-render.js` is **not** added: it emits SVG for a server-rendered map and its theme reads are
already `hsl(var(--theme-*, <fallback triple>))`. Adding it is defensible but widens the blast
radius of this fix beyond the finding; recorded as a known gap below rather than smuggled in.

## Files changed
- `test.js` — `blankHtmlComments()` (new); `testThemeVarConsumers()` scans a target list instead of
  one path; per-file anti-vacuous anchors; HTML inline-style and HTML-comment fixture probes.

## Guard proof
- `test.js::testThemeVarConsumers` — with the fix in place, inserting
  `style="background: rgba(var(--theme-panel), 0.7)"` into `public/index.html` makes the suite
  **FAIL**; removing it makes it **PASS**. Against `41e1938` (pre-fix) that same insertion leaves
  the suite **GREEN** — which is the defect.
- Fixture probes additionally pin the behaviour without touching the real files: an inline-style
  offender in an HTML fragment is caught; an offender that exists only inside an `<!-- -->` comment
  is not.
- Anti-vacuous anchors per scanned file (a real marker from each: the `hsl(var(--theme-border))`
  inline style in `index.html`, `THEME_VAR_NAMES` in `app.js`) so an emptied, moved, or renamed file
  fails loudly instead of passing by scanning nothing.

## Coder dispute (if any)
None. (Severity is arguable — there is no live defect, so a case exists for LOW. MEDIUM is claimed
because this repo's guards have repeatedly been the thing standing between a known defect class and
a shipped regression, and because the cost of closing it is one test-file change.)

## Known gaps
- `map-render.js` is left unscanned (rationale above). If a later change makes it consume a theme
  var through `rgb()`/`rgba()`, this guard will not see it. The reviewer should grade explicitly
  whether that exclusion is acceptable or whether the file belongs in the target list.
- The scanner is a static text scanner, not a CSS parser. It does not know which declarations are
  reachable, and it cannot see styles built by string concatenation across lines.

## Reviewer comments
(pending dispatch)
