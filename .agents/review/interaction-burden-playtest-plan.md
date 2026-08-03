# Interaction-burden paired playtest plan and harness contract

**Status:** DRAFT FOR OWNER APPROVAL — planning was authorized on 2026-08-02. This document does
not authorize harness implementation, a playtest run, class or tier assignment, package
regeneration, product code, an external review, or a push.

**Authority:** the active 2026-08-02 interaction-playtest and campaign-class-set decisions in
`.agents/decisions.md`; the signed check contract in `docs/rules/resolution.md`; the signed effect
vocabulary in `docs/rules/effects.md`; and the risks inventoried in
`.agents/review/interaction-burden-audit.md`.

**Purpose:** define one cold-implementable, non-shipping harness and one exact pilot comparison
that can produce observed interaction evidence without pretending paper analysis, reviewer opinion,
or a numerical score decides whether a class is fun.

---

## 1. Settled boundaries

1. The interaction-burden audit is a risk inventory, not an admission gate. A mechanic remains an
   Expert candidate unless a separate class-coherence, rules, safety, or owner decision removes it.
2. Expert contains the full candidate catalog, including unproven or deliberately demanding
   mechanics. Advanced contains mechanics that survived focused testing but retain noticeable
   burden. Base contains mechanics demonstrated to be understandable and enjoyable without repeated
   prompting. These are evidence descriptions, not automatic score bands.
3. A focused comparison uses the same character and encounter, changing only the mechanic under
   test. The same check math, result tape, action budget, equipment, objectives, opponent behavior,
   and starting state apply to both runs.
4. Player prose never selects or invents mechanics. The player explicitly selects an engine-known
   action or class ability; the harness resolves that identifier. Typed intent is presentation only
   in this deterministic artifact and is never parsed for rules.
5. The engine may automate arithmetic, legality, declared triggers, state transitions, and cleanup.
   It may not silently choose the player's tactic. Every automated transition is visible and logged.
6. No cross-harness reviewer is implied. Fable, codereview, and openreview remain off unless the
   owner explicitly invokes one.

---

## 2. Scope and first stopping point

The first implementation approval, if granted, covers only:

- an offline static browser harness under
  `.agents/review/interaction-burden-playtest-harness/`;
- the exact Armsmaster-versus-Adept pilot in §5;
- two existing four-beat fixtures: stable duel and moving rescue under disruption;
- local structural, fixture, instrumentation, privacy, and accessibility verification; and
- a downloadable local evidence record.

The pilot is first because the repository already has exact matched cards, shared controls, and two
scenario traces in `.agents/review/archetype-collapse-prototypes.md` §§6.3–6.7. It tests the failure
mode that triggered this work: whether an ordered opening/flow/finisher mechanic produces planning
and adaptation or merely exposes “next, next, next, finish.” It needs no unresolved Power economy,
spell system, companion AI, asset subsystem, or new class mechanic.

Stop after the verified harness is committed and handed to the owner for play. Do not add Catalyst,
Exposure, Openings, companions, loadouts, Rider, intrusion, or an ability-economy comparison until
the pilot has produced an evidence packet and the owner explicitly authorizes another pair.

---

## 3. Evidence questions

The harness records evidence for the settled observations without turning them into a formula:

| Question | Direct evidence |
|---|---|
| Does the mechanic create meaningfully different choices? | selected action sequence, legal-option count at each beat, immediate and delayed effects, and the player's paired response |
| Does the UI guide intent or dictate a rotation? | whether an action was preselected or recommended, legal/locked option display, repeated sequences, and paired response |
| Is state remembered or repeatedly forgotten? | state-help openings, repeated help openings after a state change, locked-option attempts, operator reminders, and paired response |
| Does the player invoke the mechanic voluntarily? | special-ability selections divided by authored opportunities; the ordinary action remains available and no class ability is forced |
| Does automation erase agency? | complete automation-event ledger split into bookkeeping and tactical-choice categories, plus paired response |
| What interaction does the mechanic add? | required prompts, mid-resolution prompts, decision time per beat, total run time, and action count |
| Is it understandable and enjoyable? | paired preference questions and optional explanation, reported with the observed event record and confounds |

No individual measure, aggregate, threshold, or sample count assigns a tier. The evidence packet
states what happened; the owner rules on one mechanic at a time.

---

## 4. Same-world comparison contract

### 4.1 Shared fixture fields

Each pair has one immutable shared object. Variants may reference it but may not override it.

| Field | Pilot requirement |
|---|---|
| Character | same display identity, first-tier status, SkillBonus 20, durability, defenses, armor, recovery, and equipment |
| Check | signed d100 meet-or-beat; `standard` TierTarget 50 − SkillBonus 20 + no deltas = target 30 |
| Action economy | one Main, one Move, and at most one Reaction per beat |
| Resource | none; sequence state and Form state are not Power |
| Effects | the same Light, Standard, and Heavy comparison vocabulary; validator-only first-band weights `4 / 5 / 7` come from the frozen package comparison and are never presented as adopted final rules |
| Encounter | identical starting state, objectives, four authored beats, opponent behavior, and branch table |
| Results | the same authored roll ID and raw d100 result for mechanically corresponding checks |
| Narration | templated only from scenario beat, selected action ID, committed result, and state change |
| Help | same layout, density, typography, interaction pattern, and access; only mechanic-specific rules differ |
| Baseline | one ordinary Main action is always available and never requires a class mechanic |

The fixture validator rejects any variant-owned character stat, target, result tape, opponent script,
objective, equipment, or narration branch. If a future pair cannot preserve the same-world boundary,
it is not loaded into this harness; it returns to rules design with the mismatch named.

### 4.2 What may differ

Only these fields may differ between the two pilot variants:

- mechanic ID and display wording;
- tracked mechanic state;
- class-action IDs, exact payloads, prerequisites, and legal transitions;
- bookkeeping transitions caused by the chosen mechanic;
- the mechanic-specific rules/help content; and
- result prose that reports those exact mechanical differences.

Variant labels during play are neutral (`Run 1`, `Run 2`). The completion screen may identify the
mechanics after all paired responses are recorded. It never labels either mechanic “simple,”
“advanced,” “good,” “failed,” or “recommended.”

### 4.3 Counterbalancing

The harness selects one of two schedules from one stable bit of a locally generated session UUID
and records it:

| Schedule | Run order |
|---|---|
| 0 | stable duel / variant A → stable duel / variant B → moving rescue / variant B → moving rescue / variant A |
| 1 | stable duel / variant B → stable duel / variant A → moving rescue / variant A → moving rescue / variant B |

Variant A/B assignment to Armsmaster/Adept is independently swapped from a different stable UUID
bit. There is no player-facing order override. A `?debug=1` operator view may show fixture IDs, but
it may not alter schedule, results, state, or recorded metrics.

---

## 5. Exact pilot fixture: free Forms versus linked techniques

### 5.1 Source and control

The pilot copies the matched controls and ability payloads from
`.agents/review/archetype-collapse-prototypes.md` §§6.3–6.5 and completes only their shorthand through
the source-bound ledger below. All values remain prototype fixtures, not adopted player rules or
tier evidence.

The same martial character is presented twice: fixture ID `pc.test.martial`, display name `Rowan`,
they/them, a seasoned spear fighter. One run equips the free-Form mechanic; the other equips the
ordered-technique mechanic. Appearance, history, weapon, competence, and all non-class actions
remain identical.

The pilot completes the prototype shorthand only with already-authored frozen-package values:

| Fixture term | Exact pilot binding | Source |
|---|---|---|
| character durability | level 1, Hardy, Might 0, maximum/current HP 24 | `rules-system-variants.md` §3.3 formula |
| defenses | Guard, Reflex, and Resolve begin at the level-1 `standard` tier; unarmored, no shield | `rules-system-variants.md` §3.3 |
| weapon | one shared one-handed martial training spear; its ordinary attack is Standard | `rules-system-variants.md` §3.3 |
| harm | Light 4, Standard 5, Heavy 7 at level 1; the UI always shows category and value | `rules-system-variants.md` §3.3 |
| bounded step | one step on the shared `Engaged → Near → Far` range line, never a free location change | `rules-system-variants.md` §3.2 and the prototype cards |
| minor guard | Guard shifts one tier harder against the next physical attack before the next beat, then expires | `rules-system-variants.md` §3.3 one-round defense-shift contract |
| Deflect | automatically consume the already-armed normal Reaction on the next physical hit and reduce its harm one category; no interrupt prompt; expires before the next beat | collapse prototype §6.4 plus the shared Reaction cap |
| Hinder | apply the signed scene-duration `hindered` condition: movement/action is impaired but the actor still acts. Beat 3's narrow escape requires an unimpaired sprint, so a hindered blocker cannot complete that authored flee; this is not a universal movement prohibition. | `docs/rules/effects.md` condition vocabulary plus the fixture's authored circumstance |
| recovery | unavailable and unnecessary inside either four-beat fixture | fixture boundary |

These values are exact evaluation-fixture inputs, not an adoption of the frozen rules package. Any
other missing payload is a plan defect: the implementer stops rather than selecting a plausible
interpretation.

### 5.2 Variant A — free Forms

Tracked state is one active Form and at most one armed Counter. At the start of each beat the player
may choose or keep any Form. Changing Form replaces the prior Form and Counter.

| Action ID | Main action | Prepared Counter |
|---|---|---|
| `form.pressing` | deal Standard harm to the engaged target | `Pursue`: if that target leaves the engagement before the next beat, follow one bounded move |
| `form.driving` | deal Light harm and reposition self or target one bounded step on success | none |
| `form.guarding` | deal Light harm | `Deflect`: reduce the next incoming hit by one printed harm category before the next beat |

All three actions are legal on every combat beat. Choosing a Form and its action is one selection,
not separate stance and attack prompts. For the pilot's validator-only budget check, three Standard
results are `5 + 5 + 5 = 15`, while a clean opening/flow/finisher chain is `4 + 4 + 7 = 15`, using
the frozen first-band harm values in `.agents/review/rules-system-variants.md` §3.3. The player UI
shows harm categories, not those provisional numbers.

### 5.3 Variant B — linked techniques

Tracked state is `opening`, `flow`, or `finishing`; it begins at `opening`. Hit or miss advances to
the selected technique's printed next state. A finisher returns to `opening`. An opening is legal
from any state and voluntarily restarts the chain. A non-technique Main resets the next technique to
`opening`.

| Required state | Action ID | Main action | Next state |
|---|---|---|---|
| opening or voluntary restart | `technique.closing-step` | deal Light harm and take one bounded step | flow |
| opening or voluntary restart | `technique.set-root` | deal Light harm and gain the printed minor guard until next beat | flow |
| flow | `technique.turning-drive` | deal Light harm and reposition the target on success | finishing |
| flow | `technique.catching-guard` | deal Light harm and arm `Deflect` under the normal Reaction cap | finishing |
| finishing | `technique.break-line` | deal Heavy harm and Hinder the target on success | opening |
| finishing | `technique.return-force` | deal Heavy harm and reposition the target on success | opening |

The action surface shows every known technique. Illegal techniques remain visible but disabled with
one exact prerequisite sentence. The harness does not highlight a recommended or “next” technique.

### 5.4 Authored result tapes

Both variants consume the same roll ID for the corresponding beat. At target 30, these avoid edge
bands and therefore avoid complication/annotation prompts that are unrelated to the class mechanic.

| Scenario | Beat results |
|---|---|
| stable duel | `stable.1 = 62 clean_success`; `stable.2 = 18 clean_failure`; `stable.3 = 74 clean_success`; `stable.4 = 81 clean_success` |
| moving rescue | `rescue.1 = 67 clean_success`; `rescue.2 = 18 clean_failure`; `rescue.3 = 76 clean_success`; `rescue.4 = 84 clean_success` |

A selected technique advances on the authored miss exactly as the prototype specifies. A replay or
back-navigation attempt returns the already committed beat result and never consumes another roll.

The stable opponent's physical attack uses SkillBonus 25. Against baseline `standard` Guard its
target is 25; against one-tier-harder Guard its target is 50. Its fixed attack tape is
`stable.enemy.1 = 60`, `.2 = 40`, `.3 = 60`, `.4 = 40`. Each hit deals Standard 5 before Deflect.
All resulting bands are clean. The opponent is an interaction fixture with no defeat threshold;
player harm is recorded, but the four-beat comparison never ends early from opponent HP.

### 5.5 Stable duel

The opponent begins and remains engaged for four beats. It has no special vulnerability, terrain
interaction, or hidden phase. After each player Main it makes the fixed physical attack in §5.4 in
both variants; minor guard changes the exact target, and an armed `Deflect` reduces a hit by one
category. The player's stated goal is to pressure the opponent while limiting incoming harm.

This fixture exposes repetition without giving either mechanic a world-authored ideal answer. The
player may repeat Pressing, trade output for Guarding, or use Driving; the linked variant must choose
an opening, flow, and finisher to complete a chain while still choosing between its two techniques at
each stage.

### 5.6 Moving rescue under disruption

The starting scene and four beats operationalize the existing matched trace with shared ordinary
scenario actions rather than granting either class a new permission:

| Beat | Authored change and exact shared consequence |
|---|---|
| 1 | a blocker holds a narrow route. A successful class action with a printed reposition effect opens it; another action may harm the blocker but leaves the route closed. |
| 2 | an ally is pulled toward a hazard. The shared `scene.protect-ally` Main uses `rescue.2`; success clears the threat. A class action does only its printed payload and does not acquire ally protection from narration. |
| 3 | the blocker attempts a narrow escape that requires an unimpaired sprint after the player's Main. `Hinder` or a successful reposition away from the exit defeats that authored attempt; an armed `Pursue` follows it one range step; otherwise it escapes. |
| 4 | the shared `scene.extract-ally` Main uses `rescue.4`; success completes the rescue. A class action does only its payload and leaves the extraction incomplete. Any ordinary Main resets linked-technique state exactly as printed. |

`rescue.1` and `rescue.3` apply only when the selected class or ordinary action calls for a check;
the result ID is still consumed at most once for that beat. The opponent, ally, hazard, legal
ordinary actions, and result tape are identical. The harness does not force the scenario-preferred
action. Ignoring an objective changes the authored outcome in the same way for both variants and is
recorded as a player choice, not an invalid input.

---

## 6. Player interaction contract

### 6.1 Layout

Desktop uses three functional regions:

1. encounter state and resolved history;
2. text intent and one explicit ordinary-action or class-ability selection; and
3. a persistent rules/state panel showing the current mechanic state, all exact transitions,
   legal and locked abilities, counters, and one worked use.

At narrow widths the rules/state panel becomes a full-height accessible drawer. Keyboard focus,
screen-reader labels, visible focus, reduced motion, and color-independent legal/locked states are
required. No information needed for a decision exists only on hover.

### 6.2 One-beat flow

1. Enable the input only after the authored beat state and current mechanic state are visible.
2. The player types an intent. The text is displayed in the local transcript but is not parsed,
   retained in telemetry, or used to select mechanics.
3. The player explicitly selects one engine-known ordinary action or legal class ability from the
   combined action surface. No action is preselected. Submit remains disabled until the intent is
   nonempty and one legal action ID is selected. If the action has one legal target, the harness
   binds and displays it; with more than one legal target, the player selects one up front and no
   target is preselected. The harness cannot judge whether the prose matches and never interprets
   it. The start screen asks the player to make them agree. Ordinary Standard attack, movement, and
   scenario actions remain available where authored.
4. One Submit resolves the declared action. A required follow-up prompt is legal only when the
   fixture explicitly declares it; it is logged. The pilot declares none.
5. The harness applies the committed result, visible bookkeeping transitions, authored opponent or
   environment response, and cleanup. It then enables the next beat.

The UI never says “recommended,” moves focus to the presumed best action, sorts the legal action
first based on encounter state, auto-confirms a trigger, or opens a mandatory ability tour. Help is
available persistently and on demand; the operator never coaches a rotation.

### 6.3 Automation manifest

Every automatic event has one of two categories:

- `bookkeeping`: apply the selected action's printed result, advance/reset sequence state, replace
  a Form, arm/expire/consume a Counter, enforce Reaction cap, apply the fixed opponent response, or
  close the beat; or
- `tactical_choice`: select an action, target, restart, binding, replacement, or trigger response on
  the player's behalf.

The pilot fixture permits only `bookkeeping`. The runner supports and records
`tactical_choice` so a future pair cannot hide it, but the verifier fails if a pilot fixture emits
one.

---

## 7. Instrumentation and local evidence schema

### 7.1 Event record

The harness keeps one in-memory append-only event array. Each event has:

```json
{
  "seq": 1,
  "runId": "<session-local UUID>",
  "scenarioId": "stable-duel",
  "variantId": "<neutral hidden mapping>",
  "beatId": "stable.1",
  "atMs": 0,
  "type": "beat_ready",
  "actionId": null,
  "targetId": null,
  "stateBefore": null,
  "stateAfter": null,
  "reason": null
}
```

Allowed event types are:

`session_start`, `run_start`, `beat_ready`, `visibility_change`, `help_open`, `help_close`, `locked_action_attempt`,
`action_select`, `action_clear`, `target_select`, `target_clear`, `intent_submit`, `required_prompt`, `prompt_answer`,
`automation`, `result_commit`, `beat_complete`, `operator_reminder`, `run_complete`,
`survey_answer`, `session_complete`, and `export`.

`action_select`, `target_select`, `automation`, and `result_commit` require exact engine-known IDs.
State-bearing events require complete before/after mechanic state. Unknown fields or event types
fail local validation; event records are never edited after append.

### 7.2 Metric definitions

Metrics are derived from events at display/export time; the fixture and UI may not write summary
numbers directly.

| Metric | Exact derivation |
|---|---|
| decision time | milliseconds from `beat_ready` to the first resolvable `intent_submit`; background-tab time is reported separately and excluded only with the recorded visibility interval |
| total run time | `run_complete.atMs − run_start.atMs`, with visibility intervals reported |
| required prompts | count of `required_prompt` after `intent_submit` and before `result_commit` |
| mid-resolution prompts | required prompts after the first `automation` or committed check event |
| help openings | count of `help_open`; repeated state help is an opening after the same state's prior display |
| forgotten-state signals | `locked_action_attempt` plus `operator_reminder`, reported separately rather than merged into a score |
| voluntary mechanic use | class `action_select` count and number of beats on which a legal class action was available |
| automation | counts and full IDs split by `bookkeeping` and `tactical_choice` |
| legal-choice surface | number and IDs of legal class actions stamped into each `beat_ready` event |
| action sequence | ordered selected IDs; no “rotation score” is inferred automatically |

The harness records intent length, not intent text. It records no name, account, campaign, IP
address, provider data, database ID, or browser fingerprint.

### 7.3 Paired responses

After both variants of one scenario are complete, ask five compact comparisons in neutral order:

1. Which run produced more meaningfully different choices? `first`, `second`, `same`, `unclear`.
2. Which run most often made the next move feel dictated? `first`, `second`, `both`, `neither`.
3. Which run's state required more re-checking? `first`, `second`, `both`, `neither`.
4. Which run was more enjoyable? `first`, `second`, `same`, `neither`.
5. Which would the player choose for this character in a campaign? `first`, `second`, `either`,
   `neither`.

After the full session, one optional bounded note asks why. The export keeps that note only after a
separate explicit Include note confirmation; otherwise it is discarded with the in-memory session.

### 7.4 Export

The completion screen downloads one JSON file after explicit action. It contains:

- schema, harness, fixture, and source-document versions;
- anonymous session UUID and counterbalanced schedule;
- browser viewport class and input mode only;
- immutable events without intent text;
- mechanically derived metrics;
- paired responses and optional confirmed note; and
- validation result and any declared confounds.

There is no network request, API call, database write, cookie, localStorage, sessionStorage,
IndexedDB, service worker, clipboard write, or automatic download. Raw exports remain outside the
repository. Only an anonymized human-written evidence summary may be committed.

---

## 8. Playtest procedure

1. Open `index.html` directly in a supported browser. Do not start the RPG server or configure a
   provider.
2. Read the neutral start screen: this compares two control schemes for the same character; typed
   intent is not interpreted; events listed in §7 are held in memory; no data leaves the browser
   unless the player downloads it.
3. Start the generated schedule. Do not reveal the mechanical mapping or expected risk.
4. During a run, answer rules questions only by pointing to the persistent rules/state panel. Every
   additional operator explanation is entered through the operator-reminder control with a short
   enum reason; do not coach an action.
5. Complete both runs of a scenario, answer its five paired questions, then complete the second
   scenario pair.
6. Review the export preview, optionally include the bounded note, download the JSON, and use the
   built-in validation display to confirm it is complete.
7. If a harness defect, stale state, wrong result, or accidental coaching changed a run, mark the
   declared confound and discard the run for tier evidence. Do not silently edit its event record.
8. Summarize valid runs in `.agents/review/interaction-burden-playtest-results.md`; keep raw exports
   outside the repository.

No minimum tester count or numeric pass threshold is invented here. The evidence summary must name
the tester count, schedule distribution, repeat exposure, input modes, invalid/discarded runs, and
known confounds so the owner can judge how much confidence it deserves.

---

## 9. Evidence packet and owner ruling

The tracked evidence summary for one mechanic contains:

1. exact harness and fixture commit;
2. proof that same-world invariants and result tapes matched;
3. number of valid and discarded sessions, counterbalance distribution, and input modes;
4. per-variant raw counts and medians without a composite score;
5. paired response counts and consented notes;
6. observed examples of meaningful choice, dictated rotation, forgotten state, voluntary use, and
   agency-preserving or agency-erasing automation;
7. power, scenario, order, familiarity, and harness confounds;
8. one recommendation: keep Expert-only and test further, promote to Advanced, promote to Base,
   redesign and retest, or remove from a future catalog because the observed play failure outweighs
   the mechanic's value; and
9. one owner decision request carrying the evidence and concrete consequence of each available
   ruling.

The recommendation is judgment over evidence, not an algorithm. Promotion or demotion is recorded
in `.agents/decisions.md` and enters a future catalog version. Existing campaigns change only through
the separately settled safe-upgrade procedure. A playtest result never edits a live campaign or
character directly.

---

## 10. Later comparison queue — not authorized by this plan

After the pilot ruling, propose at most one next pair. Each proposal needs an exact mechanic packet,
same-world equivalence ledger, authored scenario, and simpler comparator before implementation.

| Risk family | Candidate comparison direction | Existing evidence source |
|---|---|---|
| Catalyst Cues | full Cue chassis versus immediate support abilities plus ordinary Leadership | interaction audit §2; concept audit §3.3; collapse prototype §7 |
| Armsmaster Forms | per-beat Form/Counter state versus immediate authored maneuvers | interaction audit §2; concept audit §3.3 |
| Berserker Exposure | ordered Exposure track versus one persistent power-for-danger commitment | interaction audit §2; concept audit §3.3 |
| Opportunist Openings | personal setup/payoff token versus immediate exploits with exact scene prerequisites | interaction audit §2; concept audit §3.3 |
| Bonded companion | separately positioned second body versus following companion invoked through selected abilities | interaction audit §2; concept audit §3.3 |
| Maker loadout | configurable devices/installations versus a fixed default kit | interaction audit §2; concept audit §3.3 |
| Arcanist loadout | prepared immediate loadout versus fixed immediate access | interaction audit §§2, 4–5; frozen variants |
| Channeler overreach | explicit base/overreach alternatives versus base-only authored effects | interaction audit §2; concept audit §3.3 |
| Oathbound binding | persistent authored binding versus immediate unbound oath effects | interaction audit §2; concept audit §3.3 |
| Shifter profiles | whole persistent profiles versus immediate transformation abilities | interaction audit §2; concept audit §3.3 |
| Rider module | full vehicle-scale layer versus Pilot skill plus vehicle asset in a vehicle-guaranteed campaign | interaction audit §§2–3; concept audit §3.3 |
| Shared intrusion | Probe/Breach/Access/Alert route versus reduced shared protected-system procedure | interaction audit §3; collapse prototypes §§1–5 |
| Ability economies | exact frozen economy versus an exact reduced-counter comparator over one shared microcatalog | interaction audit §4; rules-system variants §§4–6 |

If authoring a comparator would require inferring mechanics from prose, inventing an unresolved core
rule, disguising one universal resource with class names, or changing more than the mechanic under
test, stop. Route that prerequisite to the rules queue; do not fill the gap with model judgment.

---

## 11. Planned implementation slices

### IBP-1 — fixture schema, exact pilot data, and validator

Create:

- `.agents/review/interaction-burden-playtest-harness/README.md`
- `.agents/review/interaction-burden-playtest-harness/fixtures.js`
- `.agents/review/interaction-burden-playtest-harness/verify.mjs`

`fixtures.js` exposes one deeply frozen global usable by a plain browser script and importable by
Node. It contains the shared world, two mechanics, both scenarios, exact result tapes, schedules,
event enums, and survey enums. `verify.mjs` validates schema closure, unique IDs, total deterministic
state transitions, result bands, shared-world ownership, effect-budget source assertions, and the
absence of variant overrides. It exits nonzero on the first violation.

Commit IBP-1 only after its focused verifier and the repository test suite pass. This slice has no
browser runner and changes no shipped path.

### IBP-2 — offline player runner and instrumentation

Create:

- `.agents/review/interaction-burden-playtest-harness/index.html`
- `.agents/review/interaction-burden-playtest-harness/styles.css`
- `.agents/review/interaction-burden-playtest-harness/app.js`

Expand `verify.mjs` to cover DOM/control references, accessible names, persistent-help structure,
complete action/result/state rendering, counterbalancing, immutable event append, metric derivation,
export validation, and forbidden network/storage/model patterns. Open the page directly and perform
the manual desktop, narrow-width, keyboard, and refresh/reset checks in §12.

Commit IBP-2 only when the pilot can be completed end to end and both variants use the same fixture
object. Stop and hand the verified artifact to the owner; do not self-simulate a human preference or
add another pair.

### IBP-3 — observed pilot evidence

After a human playtest, create or append:

- `.agents/review/interaction-burden-playtest-results.md`

Record the §9 evidence packet, update `.agents/state.md`, and commit the evidence without raw JSON or
personal data. Present exactly one owner ruling. Record the ruling through the `decision` workflow
before changing tier guidance or planning another pair.

---

## 12. Verification and guard proof

For IBP-1 and IBP-2 run:

```text
node .agents/review/interaction-burden-playtest-harness/verify.mjs
node test.js
git diff --check
```

Before claiming each new verifier guard, prove it is load-bearing by temporarily making the named
mutation, confirming the focused verifier fails, restoring the production artifact, and confirming
both commands pass:

1. allow one variant to override a shared result tape or character field;
2. change one Adept hit/miss transition so it does not advance;
3. preselect or recommend a class action;
4. emit a pilot `tactical_choice` automation event;
5. store or export typed intent text;
6. introduce `fetch`, `/api/`, WebSocket, local/session storage, IndexedDB, or an external URL; and
7. permit a replayed beat to consume a second result.

Manual IBP-2 checks:

- complete both counterbalanced schedules in a fresh page;
- verify direct `file://` operation with no console error or network request;
- operate every control by keyboard and verify focus never disappears behind the rules drawer;
- at desktop and narrow width, verify current mechanic state and exact legal/locked reasons remain
  reachable without losing typed intent;
- refresh mid-run and confirm the intentionally non-persistent session resets with an explicit
  notice rather than reconstructing partial state; and
- download an export, validate it locally, and confirm it contains no typed intent, identity,
  campaign data, or unconfirmed note.

Because the harness is code even though it does not ship, `node test.js` remains required. The
public theme browser suite is not required because no file under `public/` changes.

---

## 13. Failure and stall handling

- A same-world invariant failure invalidates the comparison; fix the fixture before running it.
- A deterministic transition or replay failure invalidates the affected session; never repair the
  raw event log by hand.
- An operator reminder is evidence, not a reason to restart, unless it coached a specific tactic;
  tactic coaching marks the run confounded.
- A player choosing the ordinary action or ignoring the scenario objective is valid behavior and
  must not be “corrected.”
- Two consecutive implementation cycles that produce no new passing guard, completed fixture path,
  or committed slice constitute a stall. Stop and report the exact blocker rather than expanding
  scope or adding model inference.

---

## 14. Non-goals

- Selecting Base, Advanced, or Expert membership on paper.
- Implementing a class catalog, campaign versions, safe upgrades, or character snapshots.
- Integrating the pilot into `public/`, the server, SQLite, Council prompts, or player accounts.
- Testing numerical class balance, full encounter balance, progression, spell rank, recovery, or
  the three complete ability economies.
- Parsing free text, calling a model, generating narration, or using repeated generation as error
  correction.
- Adding a hotbar, cooldown wall, combo animation, recommended-action glow, or automatic tactic.
- Treating the pilot's neutral labels or prototype effects as final player-facing class content.
- Committing raw playtest exports or personal data.
- Running Fable or any other external review without a new explicit owner request.

---

## 15. Approval boundary

Approval of this plan would authorize IBP-1 and IBP-2 only: build and verify the offline
Armsmaster/Adept pilot, commit each slice, and hand the artifact to the owner. It would not authorize
the agent to simulate or record a human playtest result, any tier or roster ruling, another mechanic
pair, product integration, external review, or push.
