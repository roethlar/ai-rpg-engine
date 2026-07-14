# ct-1: Phase CT — store complete colours in `--theme-*`, delete the scanner

**Severity**: MEDIUM — removes the css-1 defect class at its root (a bare HSL component list in a
CSS context is silently invalid and the surface renders unpainted), and retires the css-2 scanner
that three review rounds proved could not police it.
**Status**: Verified — **ACCEPTED** by adversarial review (Claude, 2026-07-14). Awaiting owner-gated
merge.
**Branch**: `fix/ct-1-codex`
**Commit**: `072ff9d` (implementation, codex) + `861f2b5` (anti-scanner warning, grafted)
**Base**: `master` @ `5646cf0`
**Plan**: plan.md → "Phase CT". Plan correctness review ACCEPTED at r4; cold-implementer review ran
to r2.

## What

`--theme-*` held bare HSL component lists (`220, 25%, 12%`). Only valid inside `hsl()`/`hsla()`;
anywhere else the declaration is invalid, the browser drops it at parse time, and the surface
renders unpainted with no error (finding **css-1**). Phase CT stores **complete colours** instead,
so no loose component list exists to misuse, and the ~240-line static scanner is deleted.

Components remain the internal representation upstream — the model emits them, `rpg-state.js`
**clamps** them (background forced dark, text forced readable: the reason the format exists), and
they persist in `campaign_outlines.outline_json`. **No DB migration, no prompt change, no validator
change.**

## Process note — this was the codex-implements experiment

Implemented by **codex** from the approved plan (owner: "have codex implement and judge the
outcome… maybe try both and judge"). Claude implemented the same plan **independently and blind**,
and the two were compared. **codex's was better and was adopted**; Claude's was discarded
(`350a92a`, deleted). Claude then reviewed codex's work adversarially — the loop's independence is
preserved by the roles being swapped, not dropped. This settled the workflow (see
`.agents/decisions.md`, 2026-07-14).

## Guard proof (adversarial review by Claude)

**1. Behavioural equivalence against an oracle.** Both implementations' pure modules were run against
an oracle transcribed from the ORIGINAL writer (`master` `public/app.js:1603-1631`), over four cases
including the lightness-cap edge (`bg` L=92 → panel capped at 95) and a missing `text_dim`. Result:
codex ≡ Claude ≡ original, on **every** case, for **both** writer paths. Two independent
implementations agreeing with an independently-derived oracle is strong evidence of correctness — it
cannot be explained by both making the same mistake.

**2. Mutation testing — every guard is non-vacuous.** Each defect was reintroduced and the suite had
to go red. codex's tests caught all of them, including the two that emit **perfectly valid CSS** and
would defeat a grammar-only check:

| mutation | result |
|---|---|
| definition reverted to bare components | RED (caught) |
| definition bearing an alpha (would silently halve every `color-mix` consumer) | RED |
| definition with mixed separators — `hsl(210, 100% 50%)`, invalid CSS | RED |
| one alpha transposed (45% → 54%) | RED |
| css-1 reintroduced in `styles.css` | RED |
| css-1 reintroduced in an `app.js` inline style | RED |
| css-1 reintroduced in `map-render.js` | RED |
| **writer swaps `text` and `text_dim`** (valid CSS, blanks readable UI) | RED |
| **writer derives border from `bg+8` instead of `panel+8`** (valid CSS, wrong colour) | RED |

**3. End-state checks** (the plan's mandatory greps): zero `hsl/hsla(var(--theme-`, zero
`rgb/rgba(var(--theme-`, zero bare component definitions, zero `--theme-glow` in production; 42
complete-colour definitions; 25 `color-mix` consumers matching the pinned ordered table.

**4. Suite green**; the app boots and serves the migrated stylesheet.

## What the review found in codex's work

Nothing requiring a fix. It was **more complete than the reviewer's own parallel attempt**: it
updated `README.md` with the browser floors (Claude omitted this), asserted the emitted `map-render`
SVG source directly (Claude skipped it), and **rewrote** the dangerous Phase T2 clause into a correct
statement of the new contract rather than merely annotating it — which is safer, since no wrong
instruction is left for a future agent to follow. It also handled the WebKitGTK nuance honestly (MDN
publishes no WebKitGTK row, so it declared the shell verified by running it rather than by citation).

One thing was grafted in from Claude's version (`861f2b5`): the comment warning the next agent **not
to harden the typo lint into a parser**, with a pointer to `findings/css-2.md`. Without it, the next
person to find a way past the regex will "fix" it — which is precisely the trap css-2 documents.

## NOT verified (stated, not faked)

- **No browser harness exists in this repo.** The rendered appearance is unverified beyond the app
  booting and serving the migrated CSS. The visual smoke pass across the five themes and the
  holodeck idle **has not been run**.
- The Chromium/Firefox compatibility matrix **was not run** — neither is installed on this machine.
  The floors are declared in `README.md` from MDN's compatibility data, not from local testing, and
  the README says so.
- codex reported both of these honestly rather than claiming them.

## Reviewer comments

### Adversarial review — Claude (Opus 4.8), 2026-07-14, head `861f2b5`, base `5646cf0`

**Verdict: ACCEPTED.** `guard_confirmed: true` — the mutation battery and the equivalence oracle were
executed, not asserted. No defect found. The implementation is correct, complete against the plan,
and its guards are non-vacuous.

Residual risk, accepted and recorded: the typo lint catches the direct spelling only (see the
in-code warning at `test.js`), and the rendered appearance is unverified for want of a browser
harness.
