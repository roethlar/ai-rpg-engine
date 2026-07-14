# css-3: `--theme-glow` is a dead custom property — defined six times, written on every theme apply, read nowhere

**Severity**: LOW — dead code. There is **no observable failure**: nothing reads the variable, so
nothing renders wrong. By the playbook's intake gate (`Evidence` + `Predicted observable failure` +
`Justified severity`) this is a **DECLINE**, and it is recorded as such below. It is admitted
anyway on an **explicit owner go** (2026-07-14, "yes, both"), which outranks the intake default.
The honest justification is hygiene, not correctness.
**Status**: Open
**Branch**: `fix/css-3-dead-theme-glow` (stacked on `fix/css-2-scanner-scope` — see Approach)
**Commit**: (filled in after commit)

## Evidence
Every occurrence of `theme-glow` in tracked code (at `41e1938`):

- `public/styles.css:18, 37, 48, 59, 70, 1198` — six **definitions**, one per theme block
  (`--theme-glow: 210, 100%, 55%, 0.15;` — an HSL triple **plus alpha**, a quadruple).
- `public/app.js:1610` — `set('--theme-glow', \`${primary}, 0.18\`)`, recomputed and written on
  every `applyCampaignTheme` call.
- `public/app.js:1579` — listed in `THEME_VAR_NAMES`, whose only job is to clear body-level theme
  overrides between campaigns.

There is **no** `var(--theme-glow)` anywhere in the repo, and no `getComputedStyle` /
`getPropertyValue` call exists in `public/` or `admin/` at all — so it is not read from script
either. `.agents/review/findings/css-1.md:110` already noted it as "currently unused".

Likely provenance: the flat-design decision (2026-07-11, `.agents/decisions.md` — gradients out,
`b8633ec`) removed the glow consumers and left the definitions and the writer behind.

## Predicted observable failure
**None.** This is the finding's honest weakness and the reason it would otherwise be declined.
Nothing consumes the variable, so no surface renders differently whether it is present or absent.

What *is* observable — and what the guard below asserts — is the **class**: a `--theme-*` custom
property defined in the stylesheet with no consumer anywhere. That check fails today (on
`--theme-glow`) and passes once it is removed, so the change is not an unguardable deletion.

## What
Residue from the flat-design change. Six stylesheet definitions and one per-theme-apply write are
maintained for a variable nobody reads. It costs nothing at runtime beyond a wasted `setProperty`,
but it is a live trap for the next reader: `--theme-glow` is the *only* theme var stored as a
quadruple rather than a triple, so anyone reasoning about the `--theme-*` contract (as css-1 and
css-2 both had to) must first discover that this one is exempt and dead.

## Approach
Delete the variable and its writer, then guard the class so the next dead theme var cannot
accumulate silently:

1. `public/styles.css` — remove the six `--theme-glow` definitions.
2. `public/app.js` — remove the `set('--theme-glow', …)` call (`:1610`) and the `'--theme-glow'`
   entry in `THEME_VAR_NAMES` (`:1579`). Removing it from the clear-list is safe *because* nothing
   reads it: a stale body-level override cannot affect any surface.
3. `test.js` — assert every `--theme-*` custom property **defined** in the scanned files is
   **consumed** by at least one `var(--theme-…)` in them.

Step 3 is why this branch **stacks on `fix/css-2-scanner-scope`**: the "is it consumed?" question is
only sound across the full scanned file set. Asking it against `styles.css` alone would be correct
today (every other theme var is consumed within `styles.css`) but would false-positive the moment a
theme var is consumed solely from `index.html`. Stacking keeps the check honest instead of
tautological.

## Files changed
- `public/styles.css` — 6 lines removed (the `--theme-glow` definitions)
- `public/app.js` — `THEME_VAR_NAMES` entry removed; the `set('--theme-glow', …)` line removed
- `test.js` — new dead-theme-var assertion in `testThemeVarConsumers`

## Guard proof
- `test.js::testThemeVarConsumers` — the dead-var assertion **FAILS at the css-2 head** (it names
  `--theme-glow`: defined in `public/styles.css`, consumed nowhere) and **PASSES** once the
  definitions and the writer are removed. Restoring any one of the six definitions makes it fail
  again. This is a genuine red/green proof: the assertion is red *before* the production change and
  green *after*, which is exactly the direction AGENTS.md requires.
- Not vacuous: the assertion does not re-implement the deletion. It derives the *defined* set and
  the *consumed* set from the shipped files by two independent code paths (`collectVarAliases`'
  definition regex vs `extractCssVarNames`' `var()` regex) and compares them; it would catch any
  future dead `--theme-*`, not just this one.
- Suite green at the head (`AI_RETRY_BACKOFF_MS=10 node test.js`).
- Manual check, since no automated browser harness exists in this repo: load the app, switch
  campaigns/themes, confirm the surfaces still repaint (the deletion touches the theme writer).

## Coder dispute (if any)
Recorded, not a blocker: by the playbook's own intake rules this finding is a DECLINE — it has no
predicted observable failure, and "dead code" is a hygiene claim, not a correctness one. I am
implementing it on the owner's explicit instruction, which is the higher authority (AGENTS.md
Source Of Truth §1). Noting it so the record shows the intake gate was applied rather than skipped,
and so a future reader does not mistake this for evidence that cleanup findings pass triage on their
own merits.

## Known gaps
- Removing `'--theme-glow'` from `THEME_VAR_NAMES` means a body-level `--theme-glow` override
  written by an *older* session's JS would no longer be cleared on campaign switch. Harmless while
  nothing reads it (and the property is being deleted in the same change), but the reviewer should
  grade that reasoning rather than take it on trust.
- The new assertion enforces "defined ⇒ consumed". It deliberately does **not** enforce the converse
  ("consumed ⇒ defined"), which would be a separate finding: a `var(--theme-typo)` with no
  definition falls back to `initial` and can silently unstyle a surface. Out of scope here; flagged
  so it is not lost.

## Reviewer comments
(pending dispatch)
