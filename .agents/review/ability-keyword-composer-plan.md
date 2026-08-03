# Fiction-first ability-keyword composer plan

**Status:** DRAFT 2026-08-02 — the owner selected the plain-word interaction direction, but this
implementation plan is not yet approved. No code, product integration, mechanics activation,
external review, playtest verdict, or push is authorized by this draft.

**Authority and context:** the owner rejected IBP-2's prose-plus-action-menu runner during manual
evaluation. Normal play must remain one fiction-first text submission. A player may invoke an owned
ability by using its ordinary name in that prose, with live inline recognition as confirmation; an
ability-card click may insert the same name. Brackets, a second mechanic selection, flowcharts,
stance menus, reaction modals, automatic prose inference, and silently inferred typo activation are
out of scope. The current shipped runtime still has generated free-text ability cards rather than
an approved canonical class-mechanics catalog, so it cannot yet make a complete legality or
action-economy ruling for this interaction.

## 1. Purpose and stopping point

Build one non-shipping browser prototype that proves the significant editor interaction before any
production composer or turn-contract change is approved. The prototype answers only:

1. Can a player type ordinary prose while exact owned ability names or curated aliases visibly
   highlight in place?
2. Can clicking an ability insert its canonical word at the current caret without making the player
   manage brackets or surrounding spaces?
3. Can spelling recovery help without guessing that a misspelling activated a mechanic?
4. Can editing, paste, selection replacement, undo, mobile-width layout, and keyboard use remain
   ordinary text-entry behavior?
5. Can the UI derive an exact ability ID and text range while preserving the submitted prose byte
   for byte?

Stop after the prototype and its automated checks are committed and opened for owner evaluation.
Do not integrate it into `public/`, change an API or database schema, pass ability IDs to the
Council, activate an ability, classify any archetype, restart the paired Armsmaster/Adept test, call
an external reviewer, or push.

## 2. Player-visible contract

The prototype presents a short game transcript, one action composer, and a compact character-sheet
ability list. It does not present a mechanics flow, action picker, target picker, sequence meter,
state diagram, survey, or instrumentation dashboard.

### 2.1 Typing

- The player writes ordinary prose such as `I backstab the orc while it watches Rowan.`
- `backstab` highlights in the composer when it is an exact case-insensitive trigger owned by the
  current character.
- The visible prose contains no brackets, chips, replacement labels, or hidden extra sentence.
- Recognition is deterministic. It does not inspect intent, grammar, negation, target, fictional
  positioning, or likely success.
- A recognized trigger anywhere in the submitted prose declares that ability. The highlight warns
  the player that a descriptive use such as `I could backstab him later` would also declare it; the
  prototype does not ask a model to distinguish those meanings.
- Editing a recognized spelling so it no longer matches removes the highlight and the derived
  invocation immediately.
- Highlighting means only `recognized as your ability`. It does not promise legality, resource
  availability, a successful check, or a mechanical outcome.

### 2.2 Ability-card insertion

- Each invocable demonstration ability is a keyboard-accessible button on the character sheet.
- Clicking or keyboard-activating it inserts the canonical trigger at the current composer
  selection. A selection is replaced; otherwise insertion occurs at the caret.
- Insertion adds only the minimum surrounding whitespace needed to avoid joining the trigger to an
  adjacent word. At the end of a non-empty sentence fragment, it leaves the caret after one trailing
  space so the player can continue writing.
- The inserted text is ordinary editable text. It is recognized by the same scanner as typed text;
  there is no separate click-only marker or hidden activation state.
- The composer retains focus and a usable caret after insertion.

### 2.3 Aliases and spelling recovery

- Every ability has one canonical trigger and may have a closed list of curated aliases. Aliases
  are fixture data, never generated from prose and never invented at runtime.
- `back stab` is a curated alias for the demonstration ability `Backstab` and therefore highlights
  and resolves to the same ability ID.
- An unrecognized spelling never activates. For a single unambiguous adjacent transposition or
  one-edit misspelling of an owned trigger of at least five letters, the composer may show one
  unobtrusive `Did you mean Backstab?` correction control.
- Fuzzy matching is suggestion-only. The typo remains plain text and no ability ID is derived until
  the player accepts the correction or edits the text into an exact trigger or alias.
- If two abilities are equally close, no suggestion appears. There is no automatic correction and
  no submit-time warning or blocking modal.

### 2.4 Multiple and overlapping matches

- The scanner highlights every non-overlapping exact owned trigger occurrence.
- Matching uses Unicode-aware letter/number boundaries, so `backstabbed` does not invoke
  `Backstab`.
- At the same starting index, the longest exact trigger wins. Fixture validation rejects two
  abilities that claim the same normalized trigger or alias.
- Repeating one trigger may produce multiple highlighted ranges but one ordered, deduplicated
  ability-ID declaration. A later rules validator, not this prototype, owns whether multiple
  declared abilities fit the action economy.

### 2.5 Submission and transcript

- Submit remains one action: Enter or the existing-style Send button.
- The player bubble displays exactly the plain composer text, without highlight markup or bracket
  syntax. This demonstrates the text other players and the canonical transcript would receive.
- A debug-only panel, hidden unless `?debug=1` is present, displays the derived prototype payload:
  plain prose, ordered unique ability IDs, and the recognized UTF-16 ranges and spellings. The
  normal view contains no technical payload display.
- Empty prose does not submit. An unrecognized typo does not block ordinary prose submission; it
  simply contributes no ability ID.

## 3. Demonstration metadata

Use a closed, explicitly non-canonical fixture. It demonstrates editor behavior and must not be
described as an approved roster, class package, or rules system.

Each fixture ability has exactly:

```json
{
  "id": "fixture.ability.backstab",
  "name": "Backstab",
  "trigger": "backstab",
  "aliases": ["back stab"],
  "familyKey": "opportunity",
  "familyLabel": "Opportunity"
}
```

Include three familiar, mechanically neutral names so matching, multiple colors, and multiword
handling are visible: `Backstab` (`opportunity`), `Rally` (`command`), and `Protect Ally`
(`protection`). Their descriptions explain only how to use the prototype, not imagined game
effects. Family colors use three fixed prototype CSS custom properties with text/background/border
contrast that does not rely on hue alone.

The production metadata contract is deliberately not selected here. The future canonical catalog
must eventually own stable ability ID, canonical invocation trigger, curated aliases, and family
key; a model must not mint them during a turn.

## 4. Editor implementation

Use a native `<textarea>` as the source of truth and place a non-interactive, `aria-hidden` mirror
behind it. The mirror reproduces the textarea's font, padding, line height, wrapping, whitespace,
and scroll offset; it renders transparent text plus colored backgrounds/borders for matched ranges.
The textarea retains normal visible text, selection, caret, spellcheck, keyboard navigation, paste,
and browser undo behavior. Do not use `contenteditable`, inject markup into player text, or add a
rich-text dependency.

The matcher is a pure module with no DOM dependency:

```js
scanAbilityTriggers(text, ownedAbilities) => {
  matches: [{ abilityId, familyKey, start, end, spelling, canonicalTrigger }],
  abilityIds: [abilityId],
  suggestions: [{ start, end, replacement, abilityId }]
}
```

Requirements:

- ranges use JavaScript UTF-16 indices so they align with `selectionStart`, `selectionEnd`, and
  `setRangeText`;
- display text is created with text nodes, never unsanitized `innerHTML`;
- exact scanning is case-insensitive but never mutates submitted text;
- aliases tolerate only the whitespace encoded by the alias; normalization does not remove random
  punctuation or silently repair spelling;
- the scanner runs on `input`, after `compositionend`, after programmatic insertion, after accepted
  correction, and immediately before submit;
- during IME composition it leaves the prior mirror stable and derives no intermediate invocation;
- the mirror scroll position follows the textarea on `scroll` and after auto-growth;
- click insertion uses the textarea selection APIs and dispatches the same local rescan/render path
  as typing; and
- family keys are validated against the closed fixture palette before they become CSS class names.

The prototype uses no network, model, storage, cookies, service worker, analytics, clipboard API,
or external assets. Refresh resets it.

## 5. Files and slices

Create a new isolated artifact under:

`.agents/review/ability-keyword-composer-prototype/`

### AKC-1 — matcher, fixture, and guard proof

Files:

- `README.md`
- `fixture.js`
- `matcher.js`
- `verify.mjs`

Implement the closed fixture, metadata validator, exact scanner, overlap policy, ordered ID
deduplication, and suggestion-only spelling recovery. `matcher.js` must work both as a plain browser
script and under the Node verifier without a build step or dependency.

Tests cover at minimum:

- exact and case-insensitive recognition;
- `back stab` alias recognition;
- `backstabbed` boundary rejection;
- unowned and duplicate-trigger rejection;
- leftmost/longest overlap resolution;
- multiple matches and ordered ID deduplication;
- Unicode text before a trigger with correct UTF-16 ranges;
- `bakcstab` producing a suggestion but no match or ID;
- ambiguous fuzzy candidates producing no suggestion; and
- input text remaining byte-identical after scanning.

Guard proof: temporarily make the typo suggestion populate `abilityIds`; the relevant assertion
must fail. Restore the implementation and confirm the focused verifier passes before committing
AKC-1.

### AKC-2 — representative composer prototype

Files:

- `index.html`
- `styles.css`
- `app.js`
- `verify.mjs`
- `README.md`

Build the transcript, overlay-backed textarea, ability buttons, inline matches, correction control,
plain-text submission, and debug payload. The normal page should be immediately usable without an
intro agreement or instructions screen.

Automated structural checks cover:

- local assets only and a network-denying content security policy;
- no inline scripts, inline handlers, persistence, model/provider references, or network APIs;
- unique element IDs and complete label/ARIA relationships;
- no bracket syntax inserted or rendered;
- no action, target, stance, sequence, or confirmation controls;
- mirror rendering via text nodes rather than player-controlled HTML;
- source-order and keyboard access for ability buttons, correction, composer, and Send;
- color-independent recognized-state styling;
- responsive layout and reduced-motion behavior; and
- debug payload exclusion from the normal view.

Guard proof: temporarily make submitted transcript text include the mirror's highlight markup or
canonical replacement spelling; the exact-prose assertion must fail. Restore it and confirm the
focused verifier passes before committing AKC-2.

Run for both slices:

```sh
node .agents/review/ability-keyword-composer-prototype/verify.mjs
node test.js
git diff --check
```

Manual AKC-2 checks in Chromium at desktop and narrow/mobile widths:

1. type `I backstab the orc`; only `backstab` highlights;
2. type `I backstabbed the orc`; nothing highlights;
3. type `I back stab the orc`; the alias highlights as Backstab;
4. type `I bakcstab the orc`; no highlight appears, the correction is offered, and accepting it
   replaces only the typo and then highlights;
5. put the caret between existing words and click each ability; spacing, focus, and caret remain
   natural;
6. replace a selection via an ability click, then undo and redo;
7. paste and edit text containing two abilities; both mirror ranges track the textarea;
8. enter composed/IME text before an ability and confirm ranges do not drift;
9. submit; the player bubble is exact plain prose and the composer clears; and
10. repeat with `?debug=1`; the payload IDs/ranges match the visible highlights while the prose is
    unchanged.

Stop and report any browser behavior that the native-overlay approach cannot preserve. Do not swap
to `contenteditable` or add a dependency without a new owner-approved plan.

## 6. Existing rejected runner

The rejected, uncommitted IBP-2 files remain outside this plan's implementation scope until the
owner explicitly authorizes their removal. AKC-1 and AKC-2 do not edit, rename, stage, commit, or
delete them. Committed IBP-1 fixtures remain retained evidence.

## 7. Downstream production contract — not authorized here

If the owner accepts the prototype's feel, a separate production plan must establish all of the
following before shipping:

1. an approved, versioned source for canonical trigger, aliases, and family key;
2. seat-scoped delivery of only the current player's owned invocation metadata;
3. a turn request carrying plain prose plus exact candidate IDs/ranges;
4. server recomputation and validation against the authenticated acting character, campaign rules
   version, owned ability IDs, exact spelling/ranges, prerequisites, resources, and action economy;
5. a clear failure contract for stale catalog/version data that restores the untouched prose;
6. structured Council context that receives validated ability IDs and never guesses an invocation
   from prose;
7. persistence/replay/export rules for the invocation record without exposing internal IDs to other
   seats; and
8. seat-isolation, spoofing, retry, suggested-choice, accessibility, and full play-session tests.

Private narration cues and per-seat family-colored highlights are a separate read-side feature.
They may reuse family keys later, but they do not ride this composer prototype or alter canonical
narration text.

## 8. Approval boundary

Approval of this plan authorizes only AKC-1 and AKC-2, in order, with one commit per slice and a stop
for owner evaluation. It does not authorize disposing of the rejected uncommitted IBP-2 runner,
changing shipped code, defining production ability metadata, activating mechanics, restarting the
paired class test, assigning evidence tiers, external review, or push.
