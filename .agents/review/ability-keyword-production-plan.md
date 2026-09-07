# Production ability-keyword integration plan

**Status:** OWNER-APPROVED 2026-08-03; target Aetheria producer and activation implemented
2026-09-07 under `.agents/review/class-experience-implementation-plan.md`. That plan owns the
newer delegated implementation authority, runtime completion audit and verification evidence.
AKP-1 through AKP-3 established the generic infrastructure; the real versioned class/catalog
creator now supplies stable owned abilities, invocation families and complete campaign bindings.
The absent-producer gate is satisfied. This does not complete the original blanket retirement of
legacy generated rules cards or establish the manual multiplayer turn-length verdict below.
Approval does not authorize data deletion, external review, or push. The owner has
settled the clean-cut data boundary: there are no real campaigns whose generated rules-card
abilities need preservation, so the product must not build a rules-card-to-character migration.
Disposable local test campaigns may be wiped deliberately if later implementation needs a clean
database; the application must never delete them automatically.

**Implementation dependency: SATISFIED FOR TARGET AETHERIA.** The authored development Expert
catalog, deterministic creation/join path, progression, engine effects and persisted bindings now
activate the production composer. The class-experience plan's completion audit distinguishes
actual HTTP/catalog/SQLite/Council integration from provider-stubbed tests and bounded live-provider
probes. Prototype fixtures did not become player options. Current implementation is not evidence
of willing-player enjoyment or Base/Advanced membership.

**Version/producer replanning:** `campaign-character-version-plan.md` retains the broader version
architecture draft. Its former absent-producer dependency is superseded for this target activation
by the approved class-experience work. Physical version lineages, player keys, durable upgrades and
destination-wording workflows are not made complete by catalog activation; that draft does not
independently authorize their implementation.

**Historical slice record:** the AKP-1 through AKP-3 paragraphs below describe what each slice
changed and proved on 2026-08-03. Their statements about then-inert projections, unchanged catalog
content and a then-pending AKP-4 dependency are historical, not current activation blockers.

**Implementation:** AKP-1 COMPLETE 2026-08-03. The shared pure matcher/insertion helpers,
server-owned catalog/binding projection, opaque revision digest, inert live party projection, and
seat-safe trigger whitelist are implemented. Existing free-text abilities have no invocation
metadata and project as non-invocable. The full unit suite and syntax/diff checks pass. Guard proof
temporarily disabled normalized trigger-collision rejection; the new collision assertion failed,
then passed after restoration. No catalog content, turn request, Council declaration,
persistence, or browser composer behavior changed in AKP-1.

**Implementation:** AKP-2 COMPLETE 2026-08-03. Turn requests now carry only exact player prose,
host/seat speaker selection, and an opaque trigger revision; unsupported client authority fields
are rejected. Inside the serialized turn task the engine selects the authenticated speaker,
checks the live revision before any Council call or mutation, rescans exact prose, resolves stable
owned definitions, gives one immutable declaration record to every Council role, and persists a
separate bounded invocation audit record. Bundle v3, older-bundle normalization, recent-history
validation, import remapping, and fork copying preserve that record without name fallback; seat
journals omit it. The full suite and syntax/diff checks pass. Guard proof temporarily trusted an
extra forged `abilityIds` field; the cross-character spoof assertion failed, then passed after
restoration. No ability effects, costs, catalog content, or composer UI changed in AKP-2.

**Implementation:** AKP-3 COMPLETE 2026-08-03. The production action surface is now a native
textarea over a pointer-inert, `aria-hidden` mirror. Exact owned terms and aliases highlight,
one-edit typos offer a correction without activation, invocable campaign-worded ability buttons
insert at the remembered caret, and passive/free-text abilities remain non-button cards. The
browser submits the exact textarea string with only the selected character ID and opaque revision;
off-turn/network failures preserve text and selection, stale revisions refresh and require an
explicit resend, and table/character epochs discard old responses and optimistic bubbles. The unit
suite, JavaScript syntax checks, theme/browser suite, and diff checks pass. Browser coverage includes
desktop/narrow layout, keyboard/IME/multiline behavior, host and seat identity boundaries, retries,
accessibility cues, and duplicate suppression. Guard proof temporarily trimmed the outgoing prose;
the exact-prose browser assertion failed, then the restored path returned green. A separate
hands-on Chrome pass could not run because no controllable browser was available; the automated
desktop and narrow browser runs are recorded instead. At that time AKP-4 remained blocked on the
real versioned class/catalog producer. No ability effects, costs, catalog content, generated-card
migration, or prototype player option shipped.

**Prototype evidence:** `.agents/review/ability-keyword-composer-plan.md` and
`.agents/review/ability-keyword-composer-prototype/` are the accepted interaction proof. Production
must preserve its one-composer behavior: normal prose, exact deterministic recognition, clickable
insertion, suggestion-only typo recovery, and no second mechanic-selection step.

## 1. Outcome and stopping point

Integrate the accepted ability-word interaction into the existing browser and Council turn path:

1. The character sheet shows the campaign-specific name and help for each ability. An invocable
   ability is a keyboard-accessible button; activating it inserts its normal name at the last text
   caret.
2. Typing an exact owned ability term or curated alias highlights only that text. The input remains
   a native textarea and the submitted action remains plain prose.
3. The browser's recognition is feedback, never authority. The server selects the authenticated
   speaking character, reconstructs that character's current trigger set, and scans the submitted
   prose again with the same pure matcher.
4. The Council receives the server-validated declarations as structured context. It may rule on
   input kind, legality, resource availability, prerequisites, checks, and outcomes; it may not
   infer an undeclared ability from similar prose or silently repair a typo.
5. The engine stores the validated declaration record with the turn and preserves it through
   campaign export, import, and fork operations.

The original completion criterion required all four slices to be committed, fully verified and
manually playtested with real catalog abilities. Target activation now follows the newer approved
class-experience plan; the manual multiplayer outcome remains unverified, not an absent-code gate.
This invocation plan itself does not select the class roster, ability effects, resource economy,
action economy, prerequisites or progression rules; their current authority and evidence live in
that class-experience plan. Do not invoke Fable or another external reviewer
unless the owner separately requests it. Do not touch the rejected uncommitted IBP-2 runner.

## 2. Locked interaction contract

- A player submits one piece of prose. There are no brackets, chips in the stored text, action
  picker, target picker, reaction modal, stance menu, confirmation screen, or generated
  prose-to-mechanics translation.
- Highlight means only **recognized as one of this character's invocable abilities**. It does not
  mean legal, affordable, available, successful, or resolved.
- Recognition is exact and deterministic. It does not inspect intent, grammar, negation, targets,
  fictional positioning, or likely success.
- Every exact non-overlapping occurrence highlights. The payload deduplicates ability identity in
  first-occurrence order. At one start position, the longest trigger wins.
- Whole Unicode-aware word boundaries prevent `backstabbed` from invoking `backstab`.
- A curated alias is exact metadata. Runtime code never invents an alias, removes punctuation, or
  expands arbitrary whitespace.
- A unique one-edit suggestion for a trigger of at least five letters may be offered, but the typo
  contributes no declaration until the player accepts the replacement or edits it correctly.
- The same literal word can exist on different characters. Ownership is resolved only after the
  authenticated speaker is selected; one character's term can never invoke another's ability.
- Passive abilities have no invocation metadata. They remain visible help text but are not buttons,
  do not highlight, and are not declared through the composer.
- A recognized term inside a question or hypothetical still appears in the declaration record.
  The existing Interaction/Referee classification decides that a clarification or dialogue turn is
  a no-op; the matcher never guesses intent.

## 3. Authoritative data contract

### 3.1 Stable ability identity

Only the active character version's catalog-backed ability instances may be invocable. Each such
instance must carry, at minimum:

```json
{
  "id": "engine-issued stable ability-instance id",
  "definition_id": "stable catalog mechanic id",
  "definition_version": 1,
  "name": "catalog/internal name",
  "description": "canonical mechanical description",
  "invocation": {
    "schema_version": 1,
    "family_key": "closed catalog family key"
  }
}
```

`invocation` is either the exact object above or `null` for a passive/non-invocable ability. The
catalog may own additional mechanical fields; the invocation projector reads only this allowlisted
identity metadata and never treats arbitrary character JSON as a trigger definition. A model may
not mint `id`, `definition_id`, `definition_version`, `schema_version`, or `family_key`.

The catalog owns a closed presentation registry for every `family_key` (label plus safe CSS token).
This plan does not invent the final family list. Unknown families are catalog validation failures,
not arbitrary CSS class names or a generic silent fallback.

### 3.2 Campaign presentation binding

`character_ability_bindings` remains the mapping from a stable owned ability ID to the wording the
player approved for this campaign. Extend its normalized record with a closed `aliases` array (and
persist it as validated JSON). For an invocable ability the production projection is:

```json
{
  "abilityId": "engine-issued ability-instance id",
  "definitionId": "stable catalog mechanic id",
  "definitionVersion": 1,
  "name": "campaign binding term",
  "trigger": "campaign binding term",
  "aliases": ["curated campaign-specific alias"],
  "familyKey": "closed catalog family key",
  "familyLabel": "player-facing family label",
  "help": "campaign binding prose"
}
```

The binding `term` is both the displayed ability name and its canonical inserted trigger. There is
no fallback to the internal catalog name and no fallback to `ruleset.abilities`. This prevents a
player from seeing or learning a hidden generic mechanics label just because campaign wording is
missing. Campaign/character creation must fail atomically before activation if an invocable owned
ability lacks a binding, uses invalid aliases, has an unknown family, or collides with another exact
trigger/alias owned by the same character.

The existing presentation-only limits continue to apply to `term`, `aliases`, and `prose`: wording
may express the ability in the setting but may not change its cost, effect, permission, or other
mechanics. A setup model may propose wording within an already supplied ability-ID allowlist; it
never creates or chooses the mechanics.

### 3.3 Opaque trigger revision

The server emits an opaque revision with each character's projected trigger list. Compute it from a
canonical serialization containing the campaign ID, table-character ID, player-owned character
version ID when available, pinned catalog/rules version, and the complete ordered trigger
projection. Prefix the SHA-256 digest with the trigger schema version (for example `ak1:`). The
browser only echoes this token; it never calculates or interprets it.

The digest must change when ownership, binding term, aliases, family, definition version, campaign
version, or character version changes. It prevents a submission highlighted against one sheet from
silently resolving against a different sheet after a join, gain/removal, character switch, or safe
campaign upgrade.

## 4. Clean cut from generated rules cards

**Current boundary:** target Aetheria creates and invokes only authored character-owned catalog
abilities. Target Setup supplies scene/fiction data, not grants; creation/join persist complete
bindings, and there is no generated-card-to-trigger conversion. Explicit legacy House campaigns
still retain their generated rule-sheet Setup, validation, GM text and Rules-tab display. Thus the
blanket retirement described below is not completed by this work and must not be recorded as such.
The compatible legacy path does not become a second source of target invocation authority.

The historical Setup prompt asks a model to invent 4–8 `ruleset.abilities` entries such as `Grid
Dive`, while new characters' stable `abilities_json` is initialized separately. This is the dead
generated-mechanics design already superseded by the fixed-house-chassis decision.

The original blanket-cutover scope was:

- Setup no longer requests or returns campaign-rule abilities or spells. Its rule-sheet output may
  retain player-facing flavor for the fixed resolution chassis and non-mechanical table notes.
- `validateRulesetData`, the GM rules section, and the Rules-tab renderer no longer treat
  `ruleset.abilities` as a source of player mechanics.
- New characters receive starting abilities only from the selected versioned class/catalog and the
  character-creation transaction stores their stable ability instances and complete campaign
  bindings before the campaign becomes active.
- Joining a campaign follows the same compatible character-version and complete-binding boundary.
- There is no converter from generated rules cards, no name-based identity healing for them, and no
  dual trigger path. Local test campaigns created by the superseded path may be deliberately wiped;
  code must not delete a database or campaign automatically.

Existing generic campaign-bundle compatibility is not permission to revive these cards. An older
bundle may continue through the bundle validator under the repo's portability contract, but its
free-text rules entries do not become invocable abilities and no new migration code converts them.

## 5. Shared matcher and server-owned projection

Create `public/ability-keywords.js` as a pure ES module imported by both `public/app.js` and
`rpg-engine.js` (or a root server helper). Port the accepted prototype algorithms without importing
runtime code from `.agents/review/`:

```js
validateAbilityTriggers(abilities, allowedFamilyKeys)
scanAbilityTriggers(text, ownedAbilities)
computeAbilityInsertion(text, start, end, trigger)
applyAbilitySuggestion(text, suggestion)
```

The scan result contains UTF-16 ranges so it aligns with textarea selection APIs:

```json
{
  "matches": [
    {
      "abilityId": "...",
      "familyKey": "...",
      "start": 2,
      "end": 10,
      "spelling": "backstab",
      "canonicalTrigger": "backstab"
    }
  ],
  "abilityIds": ["..."],
  "suggestions": []
}
```

Keep catalog/binding assembly in a server-only helper because it reads canonical character state
and presentation rows. It returns only frozen, allowlisted projection objects and the opaque
revision. The browser receives projections; it never receives private catalog administration,
unselected class options, other characters' bindings in seat mode, or GM-private canon used to
generate the wording.

## 6. State projection and seat isolation

Add two server-produced fields to each full character view used by the composer:

```json
{
  "abilityTriggerRevision": "ak1:opaque-digest",
  "invocableAbilities": []
}
```

Build these fields from live stable ability instances plus the campaign binding rows; never expose
raw binding database rows. Host state may carry the full projection for the party characters the
host can legitimately select. `scopeStateForSeat` must explicitly reconstruct the seat owner's
full character view with only validated player-facing ability fields. `silhouetteCharacter` keeps
omitting abilities, trigger metadata, inventory, attributes, and progression for every other seat.

Campaign load, polling, party join/release, character selection, and safe campaign-version change
must replace the active projection atomically. A stale response from a prior `sessionEpoch` must not
replace the current composer metadata or insert an ability for a character the browser no longer
controls.

## 7. Turn request and server recomputation

The original allowlisted shape remains the legacy request contract:

```json
{
  "playerAction": "I backstab the orc",
  "characterId": 123,
  "abilityTriggerRevision": "ak1:opaque-digest"
}
```

Target Aetheria additionally requires a bounded UUID `requestId`. It is non-authoritative
transport identity for exact, durable retries, not an ability selector or permission. A pending
retry retains the original prose and trigger revision with that identity; a settled request can
return its completion without rerolling or consuming another use. Exact retry lookup precedes
fresh-action revision checks. The class-experience plan owns the implemented transport evidence.

`characterId` retains its existing host behavior and remains ignored in favor of the seat
credential for seat requests. The request accepts no `abilityIds`, ranges, matched spellings,
family keys, catalog IDs, or mechanic data. Reject explicit attempts to supply those authority
fields rather than leaving a misleading shadow contract.

Validate non-empty/maximum-length prose without rewriting it: use `value.trim()` only to decide
whether the action is empty, but pass and persist the original string. The player bubble, Council
input, matcher input, and stored `player_action` must be the same plain text; highlight markup is
never submitted.

Inside the existing per-campaign serialized task, after `selectSpeakingCharacter` establishes the
authenticated speaker:

1. Load that live character/version's canonical abilities and campaign bindings.
2. Build the current trigger projection and revision.
3. Compare the request revision. On mismatch, stop before any model call, roll, state mutation, or
   turn insert and return `409 ABILITY_TRIGGERS_STALE` with a player-safe message.
4. Scan the original player prose with the server projection.
5. Resolve each result ID back to the owned canonical ability instance. Any impossible/dangling
   result is an internal invariant failure; never repair it by name.
6. Pass the immutable server-built declaration record into the Council and later persistence.

## 8. Council contract

Add `ability_declarations` to `buildTurnContext`. It contains the trigger revision and an ordered
list of server-validated owned abilities, with their matched UTF-16 ranges/spellings and canonical
ability definition needed for adjudication. It is engine context, not model output.

Every Council role sees the same record. Prompt rules state:

- declarations identify abilities whose exact owned terms the player explicitly included; the
  Interaction/Referee path still decides whether the prose attempts to use them now;
- no declaration may be invented, deleted, renamed, or replaced by a similar ability;
- no typo suggestion counts until corrected in the submitted prose;
- recognition does not establish legality, availability, resource payment, prerequisites, target,
  success, or action-economy compatibility;
- clarification/dialogue classification still forces the existing no-op behavior even when the
  prose mentions an ability; and
- player-facing narration never exposes opaque ability or catalog IDs.

The Referee uses the declarations when applying whatever canonical mechanics are supplied by the
approved rules/catalog work. This integration does not implement those mechanics and must not fill
their current gaps with prompt improvisation. If two declared abilities cannot legally coexist,
the eventual canonical action-economy validator or Referee contract rules on them; the composer
does not add another selection step.

Before validating or saving the final narration, overwrite any model-emitted declaration-like
field with the server record. Model output can never become the source of invocation identity.

## 9. Persistence, history, export, and forks

Add an engine-owned `ability_invocations_json` field to each turn rather than hiding authority
inside model-produced `state_changes_json`. Its version-1 shape is:

```json
{
  "schema_version": 1,
  "trigger_revision": "ak1:opaque-digest",
  "abilities": [
    {
      "ability_id": "engine ability-instance id",
      "definition_id": "catalog mechanic id",
      "definition_version": 1,
      "matches": [
        { "start": 2, "end": 10, "spelling": "backstab" }
      ]
    }
  ]
}
```

The engine creates this object from the server scan for every submitted turn, including an empty
`abilities` list. Opening turns use the same empty validated shape. Bounds must cap ability count,
occurrence count, strings, and ranges; each range must reproduce the recorded spelling in the exact
stored `player_action`.

Later Council context reads recent records through the same validator. Corrupt or imported data
fails closed to an empty historical declaration and never becomes permission to use an ability.

Campaign export carries the structured invocation object per turn. Import validates it, verifies
that referenced ability IDs belonged to the source character, remaps instance IDs alongside
character abilities, and leaves stable catalog definition IDs/versions unchanged. Forking copies
or remaps the same records consistently with its character-identity policy. Missing invocation
records in older supported bundle formats normalize to empty; this is not a generated-card
migration and must never synthesize abilities by matching names.

Seat journals continue to expose only turn number, plain player prose, narration, and timestamp.
They do not need historical invocation metadata. Host export and internal Council history retain
the auditable record.

## 10. Browser composer

Replace the production single-line `<input>` with the accepted native textarea/mirror structure:

- the textarea remains the sole editable source of truth;
- an `aria-hidden`, pointer-inert mirror behind it renders text nodes plus safe `<mark>` ranges;
- matching font, padding, line height, wrapping, dimensions, and scroll offsets keep highlights
  aligned;
- the textarea retains visible text/caret, spellcheck, selection, paste, native undo/redo, keyboard
  navigation, and IME composition;
- Enter submits; Shift+Enter inserts a newline; an active IME composition never submits;
- the scanner runs after ordinary input, `compositionend`, correction, ability insertion, suggested
  choice insertion, state refresh, and immediately before submit;
- family styling uses only the closed server-projected registry and includes a non-color underline
  or border cue; and
- a restrained screen-reader status announces only changes to the recognized ability-ID set.

Render invocable character-sheet abilities as buttons containing the campaign term, family label,
and persistent help prose. A button click uses `setRangeText` at the remembered caret/selection,
adds only necessary surrounding whitespace, keeps focus in the textarea, and then follows the same
scan path as typing. Passive abilities remain non-button cards.

Show at most one unambiguous typo correction control at a time. It replaces only the suggested
range and never blocks submission. There is no submit-time warning when a typo remains.

On normal success, the transcript receives the exact plain action and the composer clears. On a
network/server failure or stale-trigger response, remove or roll back any optimistic duplicate,
restore the exact text and caret, and keep it available for retry. A stale-trigger response first
reloads the scoped campaign state, rescans against the new sheet, and presents a concise non-modal
notice to review and resend; it never silently submits against changed metadata.

## 11. Implementation slices

Each slice is one commit and must be green before the next starts. Do not stage, edit, delete, or
commit the unrelated uncommitted IBP-2 runner files.

### AKP-1 — shared matcher and canonical trigger projection

**Implementation: COMPLETE 2026-08-03.**

Files:

- new `public/ability-keywords.js`
- new server-only ability projection helper (name selected to match repo conventions)
- `rpg-engine.js`
- `rpg-state.js`
- `test.js`

Port and harden the pure matcher, define the exact production projection, validate bindings and
families, compute the opaque revision, and project full-character versus silhouette state without
changing the composer or turn API yet. With no real catalog metadata the projection is empty; no
prototype fixture ships.

Guard proof: temporarily allow two owned abilities to claim one normalized trigger/alias. The
collision test must fail before restoration; the focused and full tests must pass afterward.

### AKP-2 — authoritative server declaration, Council context, and turn record

**Implementation: COMPLETE 2026-08-03.**

Files:

- `db.js`
- `server.js`
- `rpg-engine.js`
- `rpg-state.js`
- campaign bundle/fork helpers in those files
- `test.js`

Add the revision-only request contract, server recomputation after authenticated speaker selection,
stale handling, Council context/prompt constraints, engine-stamped invocation persistence, and
export/import/fork validation/remapping. Do not implement ability effects or costs.

Guard proof: temporarily trust a forged request `abilityIds` entry belonging to another character.
The spoofing test must fail before restoration; the focused and full tests must pass afterward.

### AKP-3 — production textarea, highlights, insertion, and recovery

**Implementation: COMPLETE 2026-08-03.**

Files:

- `public/index.html`
- `public/app.js`
- `public/styles.css`
- browser/structural tests and `test.js` as required

Replace the input with the overlay-backed textarea, render invocable ability buttons and passive
cards, add exact highlighting/corrections/insertion, echo only the opaque revision, and implement
retry/stale/session-epoch behavior. Preserve the existing table-turn gate, suggested choices,
polling, and narration flows.

Guard proof: temporarily submit a canonical replacement or rendered markup instead of the exact
textarea value. The exact-prose browser assertion must fail before restoration. Run the required
theme/browser suite after restoration because this slice changes `public/styles.css`.

### AKP-4 — catalog-backed clean cut and end-to-end playtest

**Target producer and activation: IMPLEMENTED 2026-09-07.** The approved class-experience plan
owns the integration and its completion audit. Real catalog-backed creation/join, complete
bindings, exact declarations, executable actions, progression, seat isolation and v4 lifecycle
storage now feed the production composer. Actual desktop/mobile HTTP/catalog/DB creator-to-cast
tests and bounded live-provider probes are recorded there. Neither prototype option seeding nor
generated-card migration supplied this path.

The original prerequisite was an owner-approved versioned catalog/creator supplying stable ability
instances, invocation family metadata and complete campaign bindings. That prerequisite is now
satisfied for target Aetheria. The remaining original blanket legacy retirement and manual
multiplayer evidence requirements are distinguished in sections 4 and 12; they are not missing
catalog infrastructure.

Files expected:

- the eventual catalog/character-creation modules
- `rpg-engine.js`
- `rpg-prompts.js`
- `rpg-state.js`
- `public/app.js`
- `README.md`
- `test.js`

Original full-slice scope: wire new/joined characters to that source, require complete binding
coverage, remove generated `ruleset.abilities` from Setup/validation/prompt/UI, update documentation,
and run the full real-data playtest. No old-card conversion or campaign data migration is added.

Guard proof: temporarily restore a fallback that turns a `ruleset.abilities[].name` into an
invocable trigger. The clean-cut assertion must fail before restoration; all verification must pass
afterward.

**Evidence limit:** this exact fallback-restoration mutation has not been recorded as run.
Existing free-text non-invocation assertions, catalog authority checks and other restored guards
do not substitute for that specific proof. Do not mark it passed by implication.

## 12. Required verification

For every code slice:

```sh
node test.js
git diff --check
```

AKP-1 focused tests cover exact/case-insensitive matches, curated aliases, Unicode UTF-16 ranges,
whole-word rejection, leftmost/longest overlap, ordered deduplication, ambiguous spelling, passive
exclusion, binding completeness, family allowlisting, collision rejection, and deterministic
revision changes.

AKP-2 integration tests cover:

- seat and host speaker selection before scanning;
- another character's trigger and forged ID/range rejection;
- client/server scan parity with no client authority;
- stale revision returning 409 before any model call, roll, mutation, or turn insert;
- questions/dialogue mentioning an ability remaining no-op;
- Council roles receiving the exact immutable declaration record;
- model-emitted invocation fields being overwritten;
- bounded persistence whose ranges reproduce stored prose;
- recent-history validation;
- export/import/fork identity remapping; and
- seat-state and journal leak scans.

AKP-3 must run:

```sh
npm run test:browser
```

Browser coverage includes desktop and narrow layouts, caret insertion between words, selection
replacement, undo/redo, paste, multiline scrolling, IME composition, Enter/Shift+Enter, typo
acceptance, multiple highlights, session switching, host character switching, seat isolation,
off-turn entry, stale refresh, network retry, no duplicate optimistic bubble, reduced motion, focus
order, screen-reader status, and non-color recognition cues.

**Original manual outcome gate: UNVERIFIED.** Automated browser/seat/mixed-party tests and bounded
live-provider probes cover implementation contracts, but do not establish a two-human session or
show that recognition improves turn length. These results do not simulate human approval. Owner
participation is not a prerequisite for the separately authorized implementation work.

The AKP-4 end-to-end manual playtest calls for at least two real catalog-backed characters in one
local multiplayer campaign:

1. Each player sees only their own invocable terms and can insert/type them naturally.
2. The same term on two characters resolves to the authenticated speaker's stable ID.
3. Another character's unique term remains ordinary prose.
4. A typo offers help without activation.
5. A declared but illegal/unavailable ability is recognized, then fairly ruled on without the UI
   promising success.
6. Two declared abilities exercise the canonical action-economy ruling without a second picker.
7. A question containing a trigger stays table talk and mutates nothing.
8. A simulated ability/catalog refresh produces the stale non-modal resend path.
9. Export/import preserves the declaration audit record and current owned triggers.
10. No step adds a mechanic-choice prompt; ordinary actions without ability terms remain unchanged.

The original manual outcome criterion remains open until such evidence shows that recognition is
useful without lengthening multiplayer turns. This is an unverified experience claim, not proof
that the now-implemented catalog producer is absent. Report any concrete unresolved mechanics
dependency rather than asking a model to improvise it.

## 13. Explicit non-goals

- choosing the final archetype/class roster or Base/Advanced/Expert membership;
- defining ability effects, costs, resources, recovery, prerequisites, action economy, progression,
  balance, or NPC kits;
- model inference from prose when no exact owned term appears;
- automatic reaction prompts or private per-player narration rewrites;
- converting generated campaign-rule cards into character abilities;
- retaining disposable local test campaigns through the cutover;
- exposing internal generic mechanics names when campaign binding wording exists;
- external review or push; and
- deleting the rejected IBP-2 runner or any local database automatically.
