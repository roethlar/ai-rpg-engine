# css-1: rgba() over HSL-triple theme variables is invalid CSS — panel fills compute unpainted

**Severity**: MEDIUM — the header, glass panels, narrative panel, and several primary/secondary
glows silently render without their intended fills/effects on EVERY theme, today. Scene-dynamic
theming (T2) would visibly no-op on the dominant surfaces, which is why this is also a T2
prerequisite.
**Status**: REOPENED (r4, 2026-07-14) — custom-property name matcher still ASCII-only; non-ASCII name residual. Fix-up pending.

**Branch**: `fix/css-1-hsla-theme-vars`
**Commit**: `32af1ba` (fix) + `d4d18bd` + `76502b2` + `bbbeda2` + `5ab50ef` (underscore names)

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
- `test.js` — `testThemeVarConsumers()` and helpers (`blankCssComments`, `collectVarAliases`,
  `resolvesToThemeTriple`, `findInvalidThemeRgbConsumers`); `fileURLToPath` import

## Guard proof
`test.js::testThemeVarConsumers` — a **no-DOM scanner** over the shipped stylesheet. Guards the
defect *class*, not one spelling (`76502b2` + `bbbeda2`):

1. **Comments blanked** (newlines preserved for line numbers) before any scan.
2. **Transitive custom-property indirection** including **nested `var()` fallbacks**: every
   `var(--name)` in a custom-property value is an alias edge; every `var(--name)` inside an
   `rgb()`/`rgba()` argument list (balanced parens) is checked. Catches one-hop aliases,
   multi-hop chains, and forms like
   `--panel-alias: var(--absent, var(--theme-panel)); rgba(var(--panel-alias), …)` and
   `rgba(var(--absent, var(--theme-panel)), …)`.
3. **Anti-vacuous via production anchors** in live CSS (body `hsl(--theme-bg)`, header
   `hsla(--theme-panel, α)`, primary `hsla(--theme-primary, α)`, and a `--theme-panel` triple
   definition) — not a match-count heuristic.
4. **Fixture probes**: one-hop, multi-hop, nested-fallback definition, nested-fallback arg,
   comment-only invalid form (must not false-positive), non-theme rgba (must not flag).

Revert-proof: styles restored to base `a58fc58` → RED (23 offenders); r1 alias probe → RED;
nested-fallback probes → RED; fixed stylesheet → green.

## Coder dispute (if any)
None.

## Known gaps
Reviewer should grade these explicitly on r3:

1. **r1 defects closed?** one-hop alias + anti-vacuous comment-padding. Prove by execution.
2. **r2 residual closed?** nested `var()` fallbacks (definition and in-arg). Prove by execution.
3. **Further residual class gaps** material to this codebase (relative color, `color-mix`, …)?
4. **Form-level guard sufficiency** — graded yes in r1; confirm still holds.
5. **Blast radius / prior process defect** — no re-litigation unless production CSS changed
   (it did not; only `test.js`).

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

### r2 — codex, 2026-07-14T05:16Z — **no schema verdict (fail-closed)**; residual residual found by execution

- **Reviewer**: codex-cli 0.144.3, `--sandbox workspace-write`, enforced output schema
- **Reviewed head SHA**: `76502b2379544662dbe104b8608acdb64195664c`
- **Base SHA**: `a58fc58ce4f13e5fcb126464f28f58c63f26aee3`
- **Outcome**: non-zero exit; no `verdict.json` written. Session was terminated by a provider
  **content filter** ("flagged for possible cybersecurity risk") after the executable proof
  steps. Per the playbook this is **not an accept**. Partial evidence from the worktree is
  retained below because it was observed by execution before the filter killed the session.

**What the reviewer did confirm by execution** (disposable worktree at `76502b2`):

1. Suite **green** at head.
2. Styles restored to base `a58fc58` → suite **RED** naming the 23 `rgba(var(--theme-…))` offenders.
3. The r1 one-hop alias form was in scope of the rewrite (fixture + prior coder proof).
4. **Residual still green**: appending
   `.probe { --panel-alias: var(--css1-absent, var(--theme-panel)); background: rgba(var(--panel-alias), 0.7); }`
   left the suite **green**. Nested `var()` fallbacks were not walked by `76502b2`'s
   first-arg-only matcher — same defect class, new costume.

**Coder's assessment:** treat as reopen-equivalent on the residual (no formal schema
envelope, but the red/green observation is unambiguous). Fix-up `bbbeda2` walks every
`var(--name)` in custom-property values and inside `rgb()`/`rgba()` argument lists
(balanced parens), with fixture probes for both nested-fallback shapes. Re-dispatch as r3
at `bbbeda2`.

### r3 — codex, 2026-07-14T05:30Z — verdict: **REOPENED**

- **Reviewer**: codex-cli 0.144.3, `--sandbox workspace-write`, enforced output schema
- **Reviewed head SHA**: `bbbeda2824ef47fbfef2de85e749c930e381fc07`
- **Base SHA**: `a58fc58ce4f13e5fcb126464f28f58c63f26aee3`
- **`guard_confirmed`**: **true** — suite green at head; base styles → RED; probes (a)(b)(c)
  each RED; restore green. Observed in disposable worktree.

**Comments:**

1. `test.js:1338` (also `test.js:1366`) — the custom-property-name regex
   `[a-zA-Z0-9-]+` **excludes underscores**, which are valid in CSS custom property names.
   Reviewer appended
   `.probe { --panel_alias: var(--theme-panel); background: rgba(var(--panel_alias), 0.7); }`
   and the **full suite stayed green**, while CSS still resolves the alias to the HSL triple
   and drops the invalid `rgba()` declaration.

**Coder's assessment: I accept the verdict.** Underscore is a real CSS ident character;
excluding it is another spelling-only hole. Fix: allow `_` in the custom-property name
pattern, add a fixture probe, re-dispatch.

### r4 — codex, 2026-07-14T05:40Z — verdict: **REOPENED**

- **Reviewer**: codex-cli 0.144.3, `--sandbox workspace-write`, enforced output schema
- **Reviewed head SHA**: `5ab50efdfb06bc8927af90bc05f196478f939a7f`
- **Base SHA**: `a58fc58ce4f13e5fcb126464f28f58c63f26aee3`
- **`guard_confirmed`**: **true** — green at head; base styles RED; probes a–d RED.

**Comments:**

1. `test.js:1339` / `test.js:1367` — custom-property regex remains ASCII-only. Appending
   `.probe { --panél-alias: var(--theme-panel); background: rgba(var(--panél-alias), 0.7); }`
   left the suite **green**. `--panél-alias` is a valid CSS custom-property name; substitution
   still feeds the HSL triple into `rgba()`.

**Coder's assessment: I accept the verdict as a class hole, not as an invitation to keep
adding characters.** The durable fix is to stop matching "ASCII identifier chars" and instead
match a custom-property name as CSS delimits it (`--` then until `,` / whitespace / `)` /
other value delimiters). That closes underscore, non-ASCII letters, and the next spelling
in one change.
