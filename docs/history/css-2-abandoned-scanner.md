# Post-mortem: the css-2 static scanner (abandoned)

> **THE CODE IN THIS FILE IS DEAD AND MUST NEVER BE RESURRECTED.**
>
> It is preserved deliberately, in a **fenced code block inside a Markdown file**, so that it
> **cannot be applied** (`git apply` will not touch it) and cannot be merged. The branch it lived on,
> `fix/css-2-scanner-scope`, was **deleted** on 2026-07-14 at the owner's instruction, precisely
> because leaving it reachable was a hazard: it is one careless `git merge` away from landing, and
> **it crashes the entire test suite**.
>
> If you are reading this because you are about to write a static analyser to catch a CSS bug:
> **read the whole file first.** That is what it is for.

**Status**: ABANDONED. Superseded by **Phase CT** (merged `77cba10`), which removed the defect class
at its root instead of policing it.
**Branch**: `fix/css-2-scanner-scope` — **DELETED**. Its commits (`b8d1b49`, `ff77b95`, `0229679`)
are unreachable and will be garbage-collected. This file is the only surviving copy.
**Full finding record**: `.agents/review/findings/css-2.md`.

---

## What it was trying to do

The `--theme-*` CSS custom properties used to hold **bare HSL component lists** (`220, 25%, 12%`).
Such a list is only meaningful inside `hsl()`/`hsla()`. Substituted into `rgb()`/`rgba()` the
declaration is **invalid**, so the browser **silently drops it** and the surface renders unpainted —
no error, nothing in the console, nothing a Node test could see. That shipped as finding **css-1**:
the app header, glass cards, narrative panel and input area were **transparent on every theme** and
nobody noticed.

css-2 was the attempt to make sure it never came back, by **scanning the source files** for the bad
pattern and failing the suite.

## Why it failed

**It was defeated 22 times across three review rounds**, each time by a reviewer who simply wrote a
bypass and watched the suite stay green:

| round | defeats | how |
|---|---|---|
| css-1 r1–r5 | 5 | custom-property aliases; nested `var()` fallbacks; underscores in names; non-ASCII identifiers |
| css-2 r1 | 1 | **HTML character references** — `r&#103;ba(` decodes to `rgba(` in the browser, but a text scanner sees no `rgba(` |
| css-2 r2 | 5 | cross-file cascade aliases; semicolon-less references; `&lpar;`/`&rpar;`; `<style>` RAWTEXT CDO/CDC semantics; CSS string tokenization |
| css-2 r3 | 16 | CSS identifier escapes (`r\gba(`); `url()` tokens; `style.setProperty()` aliases; SVG foreign content; **plus false positives, and a crash** |

By round three the scanner was **wrong in both directions**:

- **It crashed the whole suite.** `decodeHtmlEntities` passed reference values straight to
  `String.fromCodePoint`, so the perfectly harmless markup `&#x110000;` threw
  `RangeError: Invalid code point 1114112` and **aborted the entire test run**. A browser just emits
  U+FFFD.
- **It rejected valid CSS.** The `dash`/`hyphen` entity mappings silently rewrote a *different*
  custom property into `--theme-panel`; quote state survived an unescaped newline; the merged alias
  graph was not cascade semantics, so a later override that rendered perfectly well was still
  rejected.
- **Its own map-render fix didn't work.** It scanned raw JavaScript, but `public/app.js` feeds that
  SVG through `innerHTML` — so character references decode *there*, and an encoded offender in
  `map-render.js` still shipped green.

## The actual lesson

**A text scanner was re-implementing an HTML parser, a CSS tokenizer, the cascade, and a
JavaScript-output interpreter — badly — in order to guard a bug that was already fixed.**

Reviewer and coder independently reached the same verdict: *not converging*. Every round closed the
specific hole demonstrated and opened the door to the next one, because the scanner was competing
with a real browser at parsing, and it was always going to lose.

**The right move was to remove the cause, not instrument it.** Phase CT made `--theme-*` hold a
**complete colour**. There is now no loose component list in existence to smuggle anywhere, so the
defect class is gone and the scanner is unnecessary. What replaced it is a deliberately dumb,
three-line, case-insensitive typo lint — which catches the direct spelling and *nothing else*, and
says so out loud in a comment.

**Corollaries worth keeping:**

1. **When a guard keeps losing, question the guard's premise, not its regex.** Three rounds of
   "harden it" was three rounds too many. The signal was there after round one.
2. **A guard that can be wrong in *both* directions is worse than no guard.** By the end this thing
   could take down the test run on innocent input, and reject correct code.
3. **The root cause of this whole saga was that nobody could see what the browser was doing.** The
   fix for *that* is a browser harness (`bh-1`), not a better parser. A static scanner is the wrong
   tool for a dynamic question.
4. **The reviewer earned its keep every single round.** It never once failed to break the scanner.
   Adversarial review with an independent model is what stopped this shipping.

---

## The artifact

Below is the scanner's **most-hardened state** (`0229679`), after all three rounds of fixes — i.e.
this is the version that was *still* defeated 16 times, *still* crashed the suite, and *still*
rejected valid CSS. It is preserved as evidence of how much machinery this approach demands and how
little it buys.

Note the comments: nearly every function documents a bypass it was added to close. That density of
"r2 #3 fixed this", "r1 reopen fixed that" is itself the diagnosis.

```javascript
// ⚠ DEAD CODE — DO NOT USE. Preserved as a post-mortem artifact only.
// This is test.js @ 0229679 (branch fix/css-2-scanner-scope, deleted).
// It crashes on `&#x110000;` and rejects valid CSS. See above.

function blankCssComments(css) {
  // css-2 r2 #4: string-aware. A comment opener inside a CSS *string* is not a comment. The
  // reviewer showed a `content` string holding an opener, and a custom property holding the
  // closer, blanked the LIVE declaration between them and left the suite green. Track quote
  // state so only real comments are blanked. Newline-preserving, so line numbers still map.
  let out = '';
  let quote = null;
  let i = 0;
  while (i < css.length) {
    const ch = css[i];
    if (quote) {
      if (ch === '\\') { out += css.slice(i, i + 2); i += 2; continue; }
      if (ch === quote) quote = null;
      out += ch; i++; continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; out += ch; i++; continue; }
    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      const stop = end === -1 ? css.length : end + 2;
      out += css.slice(i, stop).replace(/[^\n]/g, ' ');
      i = stop; continue;
    }
    out += ch; i++;
  }
  return out;
}

/**
 * Newline-preserving blank of an HTML comment.
 * Only ever applied OUTSIDE raw-text elements (see mapOutsideRawText).
 */
function blankHtmlComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, (block) => block.replace(/[^\n]/g, ' '));
}

/**
 * css-2 r2 #3: `<style>` and `<script>` are RAWTEXT elements. Inside them the HTML comment
 * markers are NOT an HTML comment — the CSS tokenizer treats them as CDO/CDC tokens and parses
 * the enclosed rules anyway — and character references are NOT decoded there. The reviewer
 * showed that blanking them inside `<style>` made the scanner hide LIVE CSS from itself. So all
 * HTML-level rewriting (comment blanking, entity decoding) applies only OUTSIDE raw-text
 * elements; those regions pass through verbatim to the CSS-level pass.
 */
function mapOutsideRawText(html, fn) {
  const rawText = /<(style|script)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
  let out = '';
  let last = 0;
  let m;
  while ((m = rawText.exec(html)) !== null) {
    out += fn(html.slice(last, m.index));
    out += m[0];                   // raw text: verbatim — no comment blanking, no decoding
    last = m.index + m[0].length;
  }
  return out + fn(html.slice(last));
}

/**
 * Named references whose expansion is an ASCII character that can change how CSS tokenizes.
 * Deliberately bounded: the full HTML set is ~2200 entries, but only those able to forge CSS
 * syntax matter here — the reviewer's r2 bypass spelled the parens as named references.
 */
const HTML_NAMED_ENTITIES = {
  lpar: '(', rpar: ')', comma: ',', period: '.', semi: ';', colon: ':',
  sol: '/', ast: '*', midast: '*', num: '#', percnt: '%', plus: '+', equals: '=',
  lowbar: '_', hyphen: '-', dash: '-', excl: '!', quest: '?', commat: '@', dollar: '$',
  verbar: '|', bsol: '\\', grave: '`', tilde: '~',
  lbrace: '{', rbrace: '}', lcub: '{', rcub: '}', lsqb: '[', rsqb: ']',
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
};

/**
 * css-2 r1 (reviewer-demonstrated bypass): the browser decodes character references in
 * an attribute value *before* the value is parsed as CSS, so
 * `style="background: r&#103;ba(var(--theme-panel), 0.7)"` reaches the CSS parser as
 * `rgba(…)` — invalid, dropped, surface unpainted — while a raw-text scanner looking for
 * `rgba(` sees `r&#103;ba(` and reports nothing. Decode before scanning so we scan what
 * the browser actually parses, not what the file literally spells.
 *
 * Single-pass by design: browsers do not recursively re-decode, so neither do we
 * (`&amp;#103;` is the literal text `&#103;`, not a `g`).
 * Entities contain no newlines, so line numbers still map to the original file.
 */
function decodeHtmlEntities(html) {
  // css-2 r2 #2: the trailing semicolon is OPTIONAL. Browsers consume `&#103ba` as `g` + `ba`
  // (a parse error, but decoded all the same), so requiring `;` was itself a bypass.
  return html.replace(
    /&(?:#(\d+)|#[xX]([0-9a-fA-F]+)|([a-zA-Z][a-zA-Z0-9]*));?/g,
    (whole, dec, hex, name) => {
      if (dec !== undefined) return String.fromCodePoint(Number(dec));
      if (hex !== undefined) return String.fromCodePoint(parseInt(hex, 16));
      const named = HTML_NAMED_ENTITIES[name.toLowerCase()];
      return named !== undefined ? named : whole;
    }
  );
}

/** Prepare HTML the way a browser resolves it, in the browser's own order. */
function prepareHtml(src) {
  return blankCssComments(
    mapOutsideRawText(src, (chunk) => decodeHtmlEntities(blankHtmlComments(chunk)))
  );
}

/**
 * css-2 r2 #1: CSS custom properties are DOCUMENT-GLOBAL — they cascade from `:root`, so an
 * alias defined in styles.css is visible to an inline style in index.html. Collecting aliases
 * per-file was a design error: the reviewer defined `--css2-cross-file-panel: var(--theme-panel)`
 * in styles.css, consumed it via `rgba(var(--css2-cross-file-panel), 0.7)` in index.html, and the
 * suite stayed green. The alias graph must span every scanned file.
 */
function mergeAliasMaps(maps) {
  const merged = new Map();
  for (const m of maps) {
    for (const [name, refs] of m) {
      if (!merged.has(name)) merged.set(name, []);
      merged.get(name).push(...refs);
    }
  }
  return merged;
}

/**
 * Every custom-property name referenced by a `var(--name…)` in `fragment`.
 * Names are matched by CSS delimiters (not an ASCII character class): after `--`,
 * take characters until whitespace, comma, or `)` — so underscore, non-ASCII
 * letters, etc. are included (r3/r4 reopen class).
 */
function extractCssVarNames(fragment) {
  const names = [];
  const re = /var\(\s*(--[^,\s)]+)/gi;
  let m;
  while ((m = re.exec(fragment)) !== null) names.push(m[1]);
  return names;
}

/** Index of the matching `)` for `css[openIdx] === '('`, or -1. */
function findMatchingParen(css, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < css.length; i++) {
    const ch = css[i];
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Custom props whose value references other custom props via var(), including
 * nested fallbacks (`var(--missing, var(--theme-panel))`). Each ref is an edge
 * in the alias graph; a theme triple flowing through any fallback taints the name.
 */
function collectVarAliases(css) {
  const aliases = new Map(); // --name -> [--ref, ...]
  // Value ends at `;` or `{`/`}` (selector boundaries). Nested parens allowed.
  // Name: `--` then until `:` / whitespace (delimiter-based, not ASCII-class).
  const defRe = /(--[^:\s]+)\s*:([^;{}]+)/g;
  let m;
  while ((m = defRe.exec(css)) !== null) {
    const name = m[1];
    const refs = extractCssVarNames(m[2]);
    if (refs.length === 0) continue;
    if (!aliases.has(name)) aliases.set(name, []);
    aliases.get(name).push(...refs);
  }
  return aliases;
}

function resolvesToThemeTriple(name, aliases, seen = new Set()) {
  // --theme-* is the HSL-triple contract (written by app.js / :root defaults).
  if (name.startsWith('--theme-')) return true;
  if (seen.has(name)) return false;
  seen.add(name);
  const refs = aliases.get(name);
  if (!refs) return false;
  return refs.some((ref) => resolvesToThemeTriple(ref, aliases, seen));
}

/**
 * Find rgb()/rgba() calls whose arguments reference any custom property that
 * is, or transitively aliases (including via nested var() fallbacks), a
 * --theme-* triple. `css` must already have comments blanked if the caller
 * wants comment-immunity.
 */
function findInvalidThemeRgbConsumers(css, { pathLabel = 'stylesheet', aliases = null } = {}) {
  // A caller scanning the real files passes the DOCUMENT-GLOBAL alias graph (css-2 r2 #1).
  // Self-contained fixture probes omit it and resolve against their own fragment.
  const graph = aliases || collectVarAliases(css);
  const invalid = [];
  const startRe = /\b(rgba?)\(/gi;
  let match;
  while ((match = startRe.exec(css)) !== null) {
    const fn = match[1];
    const openIdx = match.index + match[0].length - 1;
    const closeIdx = findMatchingParen(css, openIdx);
    if (closeIdx < 0) continue;
    const args = css.slice(openIdx + 1, closeIdx);
    const refs = extractCssVarNames(args);
    const themeRefs = [...new Set(refs.filter((r) => resolvesToThemeTriple(r, graph)))];
    if (themeRefs.length === 0) continue;
    const line = css.slice(0, match.index).split('\n').length;
    const detail = themeRefs.map((r) => (
      r.startsWith('--theme-') ? r : `${r} (aliases a --theme-* triple)`
    )).join(', ');
    invalid.push(`${pathLabel}:${line} — ${fn}(… ${detail} …)`);
  }
  return invalid;
}

/**
 * css-2: every tracked file that can author a CSS value consuming a theme var. The scanner
 * core is file-agnostic — only this list and the per-syntax preparation differ.
 *
 * css-2 r2 #5: `map-render.js` IS in scope. I had excluded it as "server-side SVG, already
 * uses hsl() with fallbacks", and the reviewer disproved that with a one-line edit to
 * map-render.js:67 — an `rgba()` fill there is browser-parsed CSS like any other, the map areas
 * lose their themed paint, and the suite stayed green. The exclusion was a rationalization.
 *
 * Comment blanking is per-syntax, and JS files get NONE by design:
 *   - .css  → string-aware CSS comment blanking.
 *   - .html → HTML comments + entity decoding OUTSIDE raw-text elements, then CSS comments.
 *   - .js   → nothing. Blanking `//` to end-of-line could hide a same-line offender behind a
 *     `//` inside a string literal, and string-aware block-comment blanking would need a JS
 *     tokenizer (template literals, regex literals, apostrophes in comments). A commented-out
 *     offender in a JS file therefore fails the suite — a false POSITIVE, which is the
 *     fail-closed direction. The alternative risks a false NEGATIVE, which is the whole bug.
 */
function themeConsumerTargets(publicDir, repoRoot) {
  return [
    {
      label: 'public/styles.css',
      path: path.join(publicDir, 'styles.css'),
      prepare: (src) => blankCssComments(src),
      anchors: [
        {
          label: '--theme-panel is defined as an HSL triple',
          re: /--theme-panel\s*:\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*;/,
        },
        {
          label: 'body background uses hsl(var(--theme-bg))',
          re: /background-color\s*:\s*hsl\(\s*var\(\s*--theme-bg\s*\)\s*\)/,
        },
        {
          label: 'header/panel fill uses hsla(var(--theme-panel), α)',
          re: /background-color\s*:\s*hsla\(\s*var\(\s*--theme-panel\s*\)\s*,/,
        },
        {
          label: 'primary accent uses hsla(var(--theme-primary), α)',
          re: /\bhsla\(\s*var\(\s*--theme-primary\s*\)\s*,/,
        },
      ],
    },
    {
      label: 'public/index.html',
      path: path.join(publicDir, 'index.html'),
      prepare: (src) => prepareHtml(src),
      anchors: [
        {
          label: 'an inline style attribute consumes hsl(var(--theme-border))',
          re: /hsl\(\s*var\(\s*--theme-border\s*\)\s*\)/,
        },
      ],
    },
    {
      label: 'public/app.js',
      path: path.join(publicDir, 'app.js'),
      prepare: (src) => src,          // JS: no comment blanking, by design (see above)
      anchors: [
        {
          label: 'THEME_VAR_NAMES declares the --theme-* contract',
          re: /const\s+THEME_VAR_NAMES\s*=/,
        },
      ],
    },
    {
      label: 'map-render.js',
      path: path.join(repoRoot, 'map-render.js'),
      prepare: (src) => src,          // JS: no comment blanking, by design (see above)
      anchors: [
        {
          label: 'the map SVG fills from hsl(var(--theme-*, <fallback triple>))',
          re: /hsl\(\s*var\(\s*--theme-(primary|panel|bg)\s*,/,
        },
      ],
    },
  ];
}
```

## What replaced it

`test.js` on master, in `testThemeColorContract()`:

- the **definition/writer grammar** — every `--theme-*` value is a complete, opaque colour;
- an **ordered 25-entry alpha table** — the translucent consumers, pinned independently;
- a **case-insensitive typo lint** over the four runtime files, which catches the direct spelling and
  openly accepts that it catches nothing else.

Roughly 40 lines, doing the job the 290 above could not.
