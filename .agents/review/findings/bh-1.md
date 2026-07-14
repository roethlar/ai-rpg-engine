# bh-1: Browser harness — guard the declaration-dropped-by-the-browser class

**Severity**: HIGH (process) — this repo has shipped the same defect class repeatedly (css-1) and
then burned three review rounds and 22 reviewer defeats trying to catch it *statically* (css-2).
Nothing automated can currently see what the browser does with a themed declaration.
**Status**: **PLAN REVISED (2026-07-14), AWAITING RE-REVIEW.** No implementation. No branch cut.
codex must not implement until the revised plan is reviewed and accepted.
**Plan**: `plan.md` → Dev Tooling → "Browser harness — `bh-1`".
**Owner go**: 2026-07-14 (the slice is approved; the *design* was not).
**Reviews (all codex, adversarial, two lenses: correctness + cold-implementer):**

| Round | Pinned at | Findings | Verdict |
|---|---|---|---|
| r1 | `df9f3f4` | 9 | **as written it would NOT work** — the core assertion went red on healthy master |
| r2 | `74d464d` | 11 | `reopened` — the collector was broken |
| r3 | `a014cb7` | 10 | `reopened` — a cardinality self-contradiction + 4 soundness gaps |
| r4 | `520424c` | 7 | `reopened` — three load-bearing mechanisms had **no guard proof** |
| r5 | `371520b` | 4 | `reopened` — the cascade guard permitted a **real false pass** |
| r6 | `ba5cda5` | 10 | `reopened` — **none against the oracle**; all guard-proof discrimination |
| **r7** | *current* | *pending* | — |

**The oracle has now passed four consecutive rounds.** From r4 onward, every single finding has been
about the *guard proofs* rather than the design.

> **The headline: r2's reviewer reasoned that the design WOULD catch css-1. It would not have.**
> A real Chromium found the defect in minutes. Three separate rounds have since produced a confident,
> careful CSS claim that execution then refuted. **Do not reason about CSS in this repo — execute it.**
> Every mechanism and every guard proof in the current plan was run against a real browser before it
> was written down.

## Why the harness exists

CSS declarations the browser silently **drops** render nothing and raise no error. `node test.js`
cannot see it; a human skimming a diff cannot see it. css-1 shipped every panel transparent on every
theme, undetected. The root cause of the whole css-2 saga is that **nobody could see what the
browser was doing**.

## Record-keeping gap — read this before re-reviewing

The r1 review's findings were recorded **only as prose in `.agents/state.md`**, never as a findings
doc. **Seven of the nine are recoverable; two were never written down and are lost.** This document
now owns the record. The re-review is expected to re-surface anything still live, so the gap
self-heals — but it is exactly the failure `AGENTS.md` ("repo is memory") exists to prevent, and it
is recorded here rather than quietly skipped.

## Disposition of the 7 recorded findings

| # | Finding (r1) | Disposition in the revised plan |
|---|---|---|
| 1 | **The core assertion fails on master.** `.btn-primary` paints with a `linear-gradient`, so its `background-color` is transparent *when healthy*. A blanket "no themed surface is transparent" check goes red before catching any bug. | **FIXED — structurally.** The blanket assertion is deleted. The oracle is now **differential**: apply the declaration to a probe, diff its full computed style against an identical unstyled control; **zero difference ⇒ the browser dropped it**. It makes no assumption about which property should be non-transparent, so gradients, shadows and border colours all work uniformly. Listed under "Rejected designs #1" so it cannot come back. |
| 2 | **The surface matrix misses real css-1 sites, most of them STATEFUL**: `.stars-bg`, `.choice-btn:hover`, `.action-form input:focus`, `.ability-tier`, `.campaign-card:hover`, `.tab-btn.active`, `.roll-d20-icon`, a keyframe. | **FIXED — structurally.** The hand-curated matrix is deleted. Declarations are enumerated from the **browser's own parse (CSSOM)**, recursing into `CSSMediaRule` and `CSSKeyframesRule`. Self-maintaining: a themed rule added tomorrow is tested tomorrow. Pseudo-class state never needs to be *driven*, because the unit under test is the **declaration**, not the element. |
| 3 | **"Skip and exit 0" when Chromium is absent DEFEATS the gate** — the required command reports success while the assertions never run. | **FIXED.** Missing Chromium now **exits non-zero** with `browser harness CANNOT RUN — run npx playwright install chromium`. A machine that cannot verify this class must say so. |
| 4 | **Not hermetic:** `public/index.html` loads Google Fonts / cdnjs, so navigation depends on DNS. | **FIXED.** The harness **never loads `index.html`**. The probe document is built via `setContent()` and links only `http://127.0.0.1:<port>/styles.css`. Additionally `page.route()` **aborts every non-`127.0.0.1` request**, so a stray external URL fails loudly. No test-only route in `server.js`, no fixture file in `public/`. |
| 5 | **Non-transparent does not prove the *tested* declaration survived** — a later cascade rule can repaint the element and mask the failure. Use isolated fixtures with expected values. | **FIXED**, though not as suggested. Probes are **isolated** (no app cascade participates), so masking cannot occur. But *expected values* are rejected: they are golden baselines in another costume and rot on every intentional `45%`→`50%` tweak. The differential oracle needs no expected value. |
| 6 | **Reading a `--theme-*` value cannot prove it is a valid colour** — custom properties accept arbitrary token streams. Use a typed probe with a literal sentinel. | **FIXED as directed.** Phase A: a **typed sentinel probe** on the *inherited* property `color`, parent set to literal `rgb(1, 2, 3)`. `var(--theme-X, rgb(4,5,6))` → `rgb(4,5,6)` means **undefined**; `var(--theme-X)` → `rgb(1,2,3)` means **defined but not a colour** (IACVT falls back to inherited); anything else is a **valid colour**. A three-way discriminator. |
| 7 | **Driving theme classes directly bypasses `app.js`/`theme-vars.js` and never exercises `map-render.js`**, so "required before merging these files" overstates coverage. | **PARTLY FIXED, PARTLY CONCEDED — deliberately.** `theme-vars.js` is now covered for real (**Phase D** imports the *live module* from the running server and runs its output through Phase A's validity probe). `app.js` wiring and `map-render.js` are **not** covered, so they are **removed from the merge-gate list**, which is now just `public/styles.css` + `public/theme-vars.js`, with the gap stated explicitly. Guarding two files honestly beats claiming five. |

## Two r1 findings the evidence CORRECTS

Checked against `public/styles.css` @ `36c4167`. Recorded so a re-reviewer does not re-raise them:

- Finding 2 cited **"the pulse keyframe"** as a missed css-1 site. `@keyframes d20-pulse` — the one
  `.roll-d20-icon` actually runs — contains **no theme vars at all**, only `transform`. The themed
  keyframe is **`@keyframes pulse-glow`** (a `drop-shadow` `color-mix()` on `--theme-primary`).
  The finding is *closed*, but by CSSOM enumeration rather than by the mechanism it assumed.
- `.roll-d20-icon` themes `color` and `text-shadow` and has **no background at all** — a
  background-oriented oracle would have probed the wrong property on it. This is finding 1 again,
  and it reinforces why the oracle must not privilege any property.

## Disposition of the 11 r2 findings (pinned at `74d464d`)

All eleven were judged **valid and accepted** — none disputed. Each was independently checked against
CSS semantics and the repo before acceptance, and the sharpest ones were then **executed** rather than
argued.

| # | Lens | Finding (r2) | Disposition |
|---|---|---|---|
| 1 | correctness | **G3's indirection break is a false pass.** The collector kept declarations whose value contains the literal `var(--theme-`; the indirection break's consumer reads `var(--tmp)`, so it is never collected and the run stays green while broken. | **FIXED.** The collector now keeps **every** declaration whose value contains `var(` — the bug class is `var()`, not `--theme-`. Narrowing the filter *was* the literal-spelling trap, one level up. **Executed: G3 now caught in all six contexts.** |
| 2 | correctness | **`setContent()` gives an opaque origin**, so `cssRules` throws `SecurityError` and the `theme-vars.js` import is blocked by CORS. The harness dies before asserting anything. | **FIXED and CONFIRMED.** Observed exactly: `origin: "null"`, `SecurityError: Cannot access rules`. The probe document is now served **from the server's own origin** via `page.route(...).fulfill()`. Verified: 291 rules readable, module imports cleanly. |
| 3 | correctness | **IACVT does not restore the control's value** — it means `unset`, which can differ from whatever else styles the control. A bare control gives false passes. | **FIXED, and the fix is better than proposed.** The control now sets the same property to **`unset`** — IACVT's exact semantics. **Executed** on the reviewer's own `box-sizing` example: the bare control is wrong in *both* directions (false pass *and* false failure); the `unset` control is right in both. |
| 4 | correctness | **The CSSOM walk hard-codes `CSSMediaRule`/`CSSKeyframesRule`**, so `@supports`/`@layer`/`@container`/`@scope` would be silently skipped. | **FIXED.** Recursion is now generic: **anything with a `.cssRules` collection**. No active gap today (the sheet has only `@media` ×3 and `@keyframes` ×6) but the "self-maintaining" claim is now true. |
| 5 | correctness | **G2 misunderstands inheritance.** Deleting `--theme-primary` from `.theme-fantasy` does not make it undefined — it inherits from `:root`, so Phase A sees a valid colour. | **VALID.** G2 is now a **Phase C** proof (distinctness collapses). **G2b** (`--theme-bg: banana` → NOT-A-COLOUR) and **G2c** (delete from `:root` → UNDEFINED) were added so Phase A's other two paths are each proven. |
| 6 | cold-impl | No same-origin bootstrap specified. | **FIXED** — see #2; the `route().fulfill()` recipe is now written out. |
| 7 | cold-impl | **The six theme contexts are never enumerated**, and `body.holodeck-idle` is **type-qualified** — a wrapper `<div>` cannot activate it. | **VALID and important.** The six are now named, and the plan states they must be set as **`document.body.className`**. A div-based fixture would have made Phase C go red on healthy master. |
| 8 | cold-impl | **Server boot/readiness/free-port/teardown have no executable mechanism.** `server.js:24` reads a fixed `PORT`; `listen()` fires after async DB init; no bound port is reported. | **FIXED.** Four concrete steps now specified (bind-0 to get a port, `spawn` with `PORT` + `RPG_DB_PATH`, **poll `/styles.css`** until it answers, kill + remove the DB in `finally`). |
| 9 | cold-impl | **Phase E's ≥100 threshold is ambiguous** (raw vs deduped) and would be red on healthy master if read as deduped. | **VALID — and worse than estimated.** Measured: **184** raw var-bearing declarations but only **18** distinct `(property, value)` pairs. The threshold is now explicitly **raw**: units ≥ 150, assertions ≥ 250. |
| 10 | cold-impl | **Probe lifecycle / snapshot algorithm underspecified** (fresh elements? reset? which properties compared?). | **FIXED**, and simplified by the `unset` control: compare only the longhands the declaration **owns**, which the browser reports. |
| 11 | cold-impl | **Phase D's "representative inputs" undefined**, and `fullThemeVars` **throws** without `colors.text`. | **FIXED.** Four exact fixtures are now listed. The unguarded `toThemeColor(colors.text)` at `theme-vars.js:28` is recorded as a **latent product gap, explicitly out of scope for bh-1**. |

## What the browser said — the r3 scratchpad probe

Before writing r3, every mechanism was **executed** against a real Chromium and the real
`public/styles.css` (server booted on a temp DB and a free port). This was a **design validation, not
a guard**: it is **not committed and is not reproducible** — the same status `.agents/state.md` gives
Phase CT's ad-hoc check. **bh-1 itself is still the only thing that would make this a guard.** Its
*measurements*, however, are now durable — they are quoted in `plan.md`.

**It found a defect that both the plan and the r2 reviewer had missed — and that the reviewer had
explicitly reasoned was fine:**

> **THE SHORTHAND TRAP.** A `var()` inside a **shorthand** makes that shorthand's longhands
> "pending-substitution": CSSOM still *enumerates* them via `rule.style[i]`, but
> **`getPropertyValue()` returns the EMPTY STRING for every one of them.**
>
> **css-1 was `background: rgba(var(--theme-panel), 0.7)` — a `background` shorthand.** So a collector
> that reads declaration *values* by index would have collected **nothing** for it, never probed it,
> and **reported green on the exact bug the harness exists to catch.** Measured: that collector sees
> **115** var-bearing declarations; the correct one sees **184**.

r2's reviewer wrote, in as many words, that the design *would* catch css-1. It would not have. This is
the third time this repo has been bitten by a guard that matched the shape of the defect its author
had in mind rather than the defect's *class* — and the first time the browser, rather than another
round of argument, is what caught it.

**Measured on master @ `74d464d`:**

| Check | Result |
|---|---|
| Healthy master | **184 units, 282 assertions, 0 failures**, 2 declarations excluded (both `transition`, logged) |
| **G1** — `background: rgba(var(--theme-panel), 0.7)` on `.glass-card` | **CAUGHT in all 6 theme contexts** |
| **G1b** — `border-color: rgba(var(--theme-border), 0.5)` (the shorthand shape) | **CAUGHT in all 6** |
| **G3** — indirection via `--tmp` | **CAUGHT in all 6** |
| Same-origin probe document | 291 rules readable; `theme-vars.js` imports cleanly |
| `all: initial` wrapper vs custom properties | theme vars **still inherit** (`hsl(210 100% 55%)`) — the isolation is safe |

Two **false-positive classes** were also found and killed, both of which would have made healthy master
red:
1. **Inherited-value coincidence.** `font-family: var(--font-body)` on `body` is indistinguishable from
   `unset`, because the probe inherits the very value it is setting. Cured by `all: initial` on the
   probe wrapper.
2. **The animation freeze.** r1 mandated a global `animation/transition: none !important` freeze
   (carried over from the *screenshot* experiment). It **overrides the declarations under test** and
   manufactured false failures. This harness never screenshots, so the freeze is **removed** — and
   `transition*`/`animation*` declarations are excluded from the battery outright (and logged), since a
   dropped transition cannot leave a surface unpainted.

## Disposition of the 10 r3 findings (pinned at `a014cb7`)

r3's verdict on the core: *"should PASS healthy master … would catch css-1 … I found no existing
declaration that should falsely fail."* The oracle is settled. What it found instead was one **real
self-contradiction in the plan text**, one **precedence trap**, and four **soundness gaps** — all
accepted, none disputed.

| # | Lens | Finding (r3) | Disposition |
|---|---|---|---|
| 1 | correctness | **A declaration's fate is not selector-independent.** A custom property defined by a *different* rule matching the same element is a cascade the isolated probe cannot model — it would inherit the `:root` alias, differ from `unset`, and report **green while the real element drops its background**. | **VALID; now GUARDED, not engineered around.** Measured: **all 47 custom-property definitions in `styles.css` live inside the six theme blocks**, so the probe's isolation model is exactly right *today*. Phase B step **2b** now **FAILS** if any custom property is defined outside a theme block (and outside the rule consuming it), with "unsupported cascade — extend the harness". Verified: injecting `.some-widget { --local-accent: … }` fires it; master is clean. A silent unsoundness became a loud stop. |
| 2 | correctness | **Equality with `unset` is not proof of a drop.** A *valid* declaration whose computed value coincides with `unset`'s (e.g. `--fx: none` consumed by `filter`) is a **false failure**. | **VALID; documented limit + fail-closed cure.** There are **zero** such declarations on master (0 failures / 282 assertions), so no speculative machinery is being built. Every Phase B failure is hard; the only escape is an explicit allowlist entry `{selector, property, value, reason}` that **ships empty** and needs a written justification. |
| 3 | correctness | **Generic `.cssRules` recursion misses `@import`** — a `CSSImportRule` exposes its rules at `.styleSheet.cssRules`, not `.cssRules`. | **FIXED and verified.** An `else if (rule.styleSheet?.cssRules)` branch added. Importing the sheet a second time doubled the unit count 184 → 368, proving the branch runs. (No `@import` in `styles.css` today — closed before it opened.) |
| 4 | correctness | **The spawned server inherits `NODE_ENV`.** `server.js:1043` `process.exit(1)`s when `NODE_ENV=production && !ACCESS_SECRET`, so a developer with that in their shell gets a dead child and a readiness timeout on a healthy checkout. | **FIXED and verified.** The spawn env now sets `NODE_ENV: 'test'` and **deletes** `ACCESS_SECRET`/`ADMIN_SECRET`. |
| 5 | correctness | **No guard proof covers Phase D.** Every proof mutated `styles.css`, so an implementation that skipped or re-implemented the module import would pass them all — and the browser command could stay green while `theme-vars.js` returned bare component lists. | **VALID — this is the vacuous-guard anti-pattern, caught before it shipped.** New **G5**: make `toThemeColor` return the bare component list (i.e. **revert Phase CT**); Phase D must FAIL, reporting every `--theme-*` as NOT-A-COLOUR. Confirmed achievable: `220, 25%, 12%` → `DEFINED-BUT-NOT-A-COLOUR`; `hsl(220 25% 12%)` → `VALID`. |
| 6 | correctness | **Aborting non-local requests is not the same as asserting nobody made one.** The run could be hermetic and green while an external URL was silently aborted. | **FIXED.** The route handler now **records** every aborted URL and **Phase E fails if the list is non-empty**. Measured: empty on master. |
| 7 | cold-impl | **The plan contradicted itself on cardinality**: it claimed 282 assertions but also "only 18 distinct `(property, value)` pairs", which over six contexts is 108 — below Phase E's own floor of 250. A cold agent following it goes RED. | **VALID — and the number was mine.** The "18" came from this plan's own earlier draft, produced by the **broken pre-shorthand collector**. The real figure, measured: **184 units → 47 distinct per context → 282 assertions**. The bogus number is struck. |
| 8 | cold-impl | **Two overlapping Playwright routes have unspecified precedence.** Handlers match in reverse registration order and `continue()` does not chain (only `fallback()` does) — register them wrong and the catch-all `continue()`s `/__bh1__` to Express, which 404s: no probe document, Phase E red on healthy master. | **FIXED.** The plan now mandates **exactly ONE route handler** (fulfil the probe URL / continue local / record+abort external) and ships the code. No precedence left to get wrong. |
| 9 | cold-impl | **Phase D's fixtures used bare identifiers** (`fullThemeVars({primary, secondary, …})`) — a `ReferenceError` if copied literally. | **FIXED.** Four fixtures now given as a literal, copy-paste code block. |
| 10 | cold-impl | **Teardown omits awaiting exit and the SQLite WAL sidecars.** `db.js:88` enables WAL; `test.js:25` removes `-wal`/`-shm` for exactly this reason. | **FIXED.** Teardown now awaits child exit, then removes `<db>`, `<db>-wal`, `<db>-shm`. |

## Disposition of the 7 r4 findings (pinned at `520424c`)

r4's verdict on the core, again: *"sound on current master and concretely catches css-1."* Six
findings accepted; **one refuted with evidence.**

**The headline finding — and it is the sharpest process point of the whole exercise:**

> **THREE LOAD-BEARING MECHANISMS HAD NO GUARD PROOF.** A cold implementation could omit the
> unsupported-cascade guard, the grouping-rule recursion, *and* the `@import` branch **entirely** and
> still pass every listed proof — because the main sheet's 184 units keep Phase E's floors satisfied
> either way. That is the **vacuous-guard anti-pattern aimed at the guards themselves**. This repo has
> now shipped that mistake three times in product code; r4 caught the fourth before it was written.

| # | Lens | Finding (r4) | Disposition |
|---|---|---|---|
| 1 | correctness | **Step 2b (unsupported cascade) is unproved, and G3 can pass for the wrong reason.** No proof forces 2b to exist; and if G3's `--tmp` is placed in a *separate* rule, 2b fires and the run fails — so a cold agent ticks "G3 passed" **without ever proving the collector follows indirection**. | **VALID, both halves.** New **G6** proves 2b exists (inject a custom property outside a theme block → must stop with the unsupported-cascade diagnostic). **G3 is tightened**: `--tmp` goes in the **consumer's own rule**, the failure must be a **Phase B declaration failure** naming `.glass-card`/`background`, and the **stray list must stay EMPTY**. Confirmed: G3 fails as a Phase B failure with the stray list empty; G6 fires while Phase B stays at 0 — two distinct signals. |
| 2 | correctness | **Nothing proves the collector recurses.** An implementation omitting the grouping-rule walk or the `@import` branch passes master and all of G1–G5. | **VALID.** New **G7a** (broken declaration nested in `@media`) and **G7b** (broken declaration inside an `@import`ed sheet). Both **confirmed caught in all six contexts**. G7b is the one that exercises `rule.styleSheet.cssRules`, which plain `.cssRules` recursion never reaches. |
| 3 | correctness | **The route matches the loopback *hostname*, not the origin** — so a request to any *other* local port is continued and never recorded, while the plan claims hermeticity. | **VALID.** The handler now matches the **exact origin** (`url.startsWith(ORIGIN + '/')`), host **and** port. |
| 4 | correctness | **`!important` is unhandled.** `cssText` serializes priority into the value; passing it to `setProperty()` will leave the declaration unset, so `owned` is empty and **valid CSS is rejected**. | **REFUTED — the predicted failure does not occur.** Measured in Chromium: `setProperty('background', 'rgba(var(--p), 0.7) !important')` **parses fine** and yields all nine `background` longhands. Kept as **hardening only** (strip the priority rather than rest on a browser quirk). Today `styles.css` has two `!important` declarations (`:1920-1921`) and **neither uses `var()`**. *This is the third round in which a reviewer's careful CSS reasoning was wrong — which is the entire argument for this harness.* |
| 5 | cold-impl | G3's alias placement and required diagnostic unspecified. | **FIXED** — see #1. |
| 6 | cold-impl | **`browser.close()` is missing from the failure-safe path.** A failing assertion — or a sabotage proof, which is *expected* to fail — leaves Chromium alive; the command can hang instead of returning non-zero, and orphan processes accumulate. | **VALID and FIXED.** `await browser.close()` moves into `finally`, ahead of the server kill and DB cleanup. |
| 7 | cold-impl | Priority parsing left to the implementer. | **FIXED** — the strip is now specified (`/\s*!\s*important\s*$/i`), with its measured status recorded so it is not mistaken for a bug fix. |

**Measured on master with every r5 mechanism in place:** 184 units, 47 distinct per context, 282
assertions, **0 failures, 0 stray custom properties, 0 external requests attempted**. G1, G1b, G3, G6,
G7a, G7b all confirmed caught.

## Disposition of the 4 r5 findings (pinned at `371520b`)

The oracle passed a third time. But r5 found a **real false pass** — the harness reporting green while
the real element is broken — and executing its counterexample confirmed it exactly.

| # | Lens | Finding (r5) | Disposition |
|---|---|---|---|
| 1 | correctness | **The step-2b exemption permits a cross-rule cascade that is a genuine IACVT false pass.** Exempting a custom property because *its own rule* also consumes it says nothing about *other* rules consuming it. | **VALID, and CONFIRMED IN CHROMIUM.** See below — this is the most important finding of the round. The rule is now strict, and **G6 is replaced**, because the old G6 tested a shape that is *harmless*. |
| 2 | correctness | **Phase E's cardinality floors and external-request assertion have no non-vacuous proof.** G4 only exercises reachability, so an implementation could drop both and pass everything. | **VALID.** New **G8** (replace `styles.css` with a small but *valid* sheet — reachability passes, the unit floor must still fail) and **G9** (add an external subresource — the harness must fail, naming the aborted URL). |
| 3 | cold-impl | **Fixtures are never said to be attached to `document.body`,** yet theme activation depends entirely on inheritance from the body class. | **VALID and dangerous.** A **detached** element inherits nothing, so **every `--theme-*` would read UNDEFINED** and Phase A would go red on healthy master *while looking like a real finding*. Now specified, along with a full `style.cssText = ''` reset between assertions. |
| 4 | cold-impl | **G7b has no executable recipe** — no such stylesheet exists, and CSS ignores an `@import` that follows a style rule. | **VALID.** G7b now uses a `data:` URL `@import` (no file to create, serve or clean up), with an explicit instruction to place it **at the top of the sheet** — a proof placed at the bottom silently does nothing and "passes". |

### The false pass, confirmed

```css
.some-widget       { --shared: 10px; width: var(--shared); }
.some-widget:hover { background-color: var(--shared, red); }
```

The probe for the hover unit receives **no customs** (they live in a *different* rule), so
`var(--shared, red)` takes its **fallback**, computes `red`, differs from `unset`, and Phase B reports
**GREEN**. On the real hovered element `--shared` is `10px`, the fallback is never used, and
`background-color: 10px` is **IACVT — silently dropped**.

**Measured in Chromium:** old guard **silent**, Phase B **green (0 failures)**, real element
**broken** (`--shared` really does compute to `10px`). The refined guard catches it, stays silent on
G3's same-rule shape, and stays silent on healthy master.

**The strict rule:** a custom property defined outside the six theme blocks is **UNSUPPORTED if any
rule other than its defining rule consumes it**. Defined-and-consumed only within its own rule is
fine (the same-rule customs travel with the unit — G3's shape). Defined and **never consumed** is fine
and **harmless**: nothing reads it, so nothing can go IACVT.

**That last clause retires the old G6.** It injected an *unconsumed* custom property — measured
harmless — so a **lenient** guard could fire on it, pass G6, and still ship the false pass. G6 is now
r5's counterexample itself, the only shape that proves the guard is strict enough. *A guard proof that
a wrong implementation also passes is not a guard proof.*

## Disposition of the 10 r6 findings (pinned at `ba5cda5`)

**Not one finding was against the oracle** — it passed a fourth time. Every finding was a **guard proof
that a wrong implementation would also pass**, plus one more unmodelled source of custom properties.
All accepted; all verified in Chromium.

**The lens that produced them (and that r4, r5 and r6 have now each used to find real holes):**

> **Could an implementation that OMITS this mechanism still pass this proof?**

| # | Finding (r6) | Disposition |
|---|---|---|
| 1 | **Runtime-injected custom properties are unmodelled** — `app.js:1602-1604` really does set them inline. `.widget { background-color: var(--runtime-colour, red) }` with runtime supplying `10px`: the probe takes the `red` fallback, differs from `unset`, reports **GREEN**; the real element drops the declaration. | **VALID — same false-pass shape as r5's, via a different route.** New **step 2c**: FAIL if any `var(--x)` consumed in the sheet has **no definition in the sheet**. **Measured: master consumes zero custom properties it does not also define**, so it is green today. Proof: **G6c**. |
| 2 | **G3 does not prove that same-rule customs are APPLIED**, only collected. An implementation that gathers `customs` for the diagnostic but never applies them to probe/control **still passes G3** — and then false-passes `.widget { --tmp: 10px; background-color: var(--tmp, red) }`. | **VALID and sharp.** New **G3b**: `.g3b { --bad: 10px; background-color: var(--bad, red); }` must **FAIL**. **Confirmed to discriminate**: it fails when customs are applied and reports **green** when they are not. |
| 3 | **G7a proves `@media`, not generic recursion** — `@media` is precisely what the *rejected* `CSSMediaRule`/`CSSKeyframesRule` allowlist already handled. The old hard-coded walker passes G7a. | **VALID.** G7a now uses **`@supports`**. Confirmed: `CSSSupportsRule` is reached and the broken declaration caught. |
| 4 | **The missing-Chromium non-zero exit has no proof.** An implementation that catches the launch failure and exits 0 passes everything **on a machine that has Chromium** — then reports a green merge gate on a clean machine having run zero assertions. **That is r1's failure mode, resurrected.** | **VALID.** New **G10**: run with `PLAYWRIGHT_BROWSERS_PATH` at an empty directory; the command must exit non-zero. |
| 5 | **G8 proves only the unit floor**, not the post-dedupe assertion floor. | **VALID.** New **G8b**: a sheet with ≥150 *duplicate* var-bearing declarations passes the unit floor but must fail the assertion floor. |
| 6 | **G9 does not prove the exact-origin branch.** A hostname-only implementation aborts `example.com` (passing G9) but silently continues `http://127.0.0.1:<other-port>/x.css`. | **VALID.** New **G9b**. |
| 7 | **G6 does not prove the harmless-unconsumed branch.** An **over-strict** guard that rejects zero-consumer definitions passes master, G3 and G6 — then rejects valid CSS like `.widget { --local-accent: red }`. | **VALID.** New **G6b**: an unconsumed outside custom property must **PASS**. *(This is the shape my own earlier G6 wrongly used as a **failure** proof.)* |
| 8 | **G2 proves only `--theme-primary`**, leaving Phase C's `--theme-bg` assertion unproved. | **VALID.** G2 now exercises **both** vars. |
| 9 | **Teardown can hang.** `child.kill(); await once(child, 'exit')` **hangs forever** if the child already exited (failed DB init, lost port race) — the event already fired. The command then never returns its non-zero result. | **VALID.** Register the exit promise **at spawn time**. |
| 10 | **Keyframe declarations have `keyText`, not `selectorText`** — a naive reporter yields `undefined` (or throws) on the themed `pulse-glow` keyframe. | **VALID.** Label is `rule.selectorText \|\| rule.keyText`. |

## Guard proofs the implementation MUST produce

**The suite now lives in `plan.md` → Success metrics**, as a table of 18 proofs (G1…G10), each with the
mechanism it makes non-optional. It is not duplicated here — `plan.md` owns that enumeration.

G1, G1b, G3, G3b, G6, G6b, G6c, G7a, G7b and G5's mechanism are all **known to be achievable** — the
scratchpad probes achieved every one of them, and G3b and G6b are confirmed to *discriminate* (they
behave differently against a wrong implementation, which is the only thing that makes a guard proof
worth writing).

## The trap, restated

**This is not a static scanner and must never become one.** CSSOM enumeration decides *what to probe*;
the **browser** is the oracle. css-2 wrote its own CSS parser and used *that* as the oracle — it
crashed the suite, rejected valid CSS, and a reviewer defeated it 22 times across three rounds before
it was abandoned and its branch deleted. If you find yourself tempted to "just harden the scanner",
read `docs/history/css-2-abandoned-scanner.md` first — that is the trap that cost a day to escape.
