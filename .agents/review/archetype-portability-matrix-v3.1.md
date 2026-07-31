# Cross-genre character portability — v3.1

**Status**: ACTIVE working draft. **Gates 1-3 (§16) adopted/approved by the owner 2026-07-31** —
recorded in `.agents/decisions.md`. Gates 4-7 remain unruled. Phase PT is approved in `plan.md`;
S1.1 and S1.2 are landed. Gate 1's one-persistent-character amendment and Gate 3's
live-canon ruling control any older wording retained as historical evidence below.

**Date**: 2026-07-27

**Supersedes as the active working draft**: `.agents/review/archetype-portability-matrix-v3.md`.
The v1 draft, the independent v1 review, v2, and v3 remain evidence.

**Basis**: v3's immutable-mechanics thesis survived independent review. Six structural findings and
three smaller corrections did not. All nine are fixed here; §1 maps each fix so the delta can be
checked without re-reading the whole document.

---

## 1. What v3.1 corrects

| # | v3 defect | Fix | §|
|---|---|---|---|
| 1 | One shared campaign lexicon with generic keys (`role`, `identity:name`) cannot hold two characters — the second overwrites the first | Split into **campaign-scope vocabulary** (`role:marksman`, `implement:sidearm` — semantic key, shared) and **character-scope bindings** (eligible name wording, pins, and ability expression that references shared vocabulary without a separate `uses` row) | §5 |
| 2 | "Stage 1 is mechanically risk-free — nothing mechanical can break" | **Withdrawn.** The ruleset sheet is injected as `CAMPAIGN RULES (CANON — these must never drift)` and the model adjudicates from it (`rpg-prompts.js:101-109`); character ability prose is also in context (`rpg-prompts.js:156`). No *engine-executed* ability mechanics exist yet, but prose **is** the operative rulebook. S1.8 ships last, behind ids, bindings, validation, and player approval, and runs only during the campaign-entry handoff before activation — never as a rewrite of approved wording during play | §2, §11 |
| 3 | The §6.2 predicate filter could not even express its own seed tables | Gate 3 rejects both mechanisms. Fictional fit is a GM judgment over live campaign canon; the engine validates IDs and output structure, not setting permission | §6 |
| 4 | §7 claimed every v2 anchor kind "already exists" in the slot taxonomy — relationship, weakness, oath, and allegiance did not | Four slot families added explicitly (`identity:oath`, `identity:allegiance`, `relationship:<key>`, `weakness:<key>`). The overclaim is deleted and replaced by a coverage table | §5.2, §7 |
| 5 | Literal pins permit wording also used in another campaign, but the leak test rejected *every* such term — the two contradicted | An approved literal pin **is** a destination binding (provenance `player-pin`). The test asserts no *unapproved* cross-campaign wording, computed as other-campaign terms minus the approved binding set | §9 |
| 6 | New-character initialization was missing; only legacy profiles had a translation-time onboarding path | One identity onboarding serves new and legacy characters: concept → proposed families and slots → plain-language summary → player approval. Later campaign moves read that same identity record. Never a class menu | §8.1 |
| 7 | Ability-ID scope assignment undefined | Globally unique, engine-issued, minted once, retained on the same persistent character across campaign moves, and remapped only by bundle import | §4.4 |
| 8 | A second editable setting record could silently invalidate existing bindings or disagree with play | Rejected by Gate 3: portability reads the destination campaign's live outline/setting, bounded played history, and relevant memories; there is no second setting record or ordinary host/player editor | §6 |
| 9 | Round-trip claim ("W→F→W restores original bindings exactly") was scoped to an "original" profile rather than the persistent character | Corrected: returning to any previously visited campaign reuses that character's saved bindings exactly; only abilities gained since the prior visit need new bindings | §8, §12 |

Unchanged from v3: the immutable-mechanics thesis (§3), pins, the card, the narration binding,
and the staged delivery shape. Gate 3 replaces v3's capability-filtered permission model with a
GM fit judgment grounded in existing campaign canon.

### 1.1 Amendments after gate 1 (2026-07-31)

Gate 1 was adopted by the owner 2026-07-31 (`.agents/decisions.md`). Before gate 2, the read that
recommended adoption named three seams plus one missing definition; all four are folded into the
body below and mapped here so the delta is checkable:

| # | Seam | Fix | § |
|---|---|---|---|
| A | S1.8 derived ruleset `cost`/`effect`/`limits` from character prose, but the two shipped ability surfaces had no canonical link before D5 | S1.8 establishes a stable mechanic reference for any linked ability and projects that one canonical record into GM context with the destination display binding. It persists no destination mechanics copy. An ability with no canonical mechanic entry remains underived and is disclosed on the card; fuller packaging waits for Stage 2 / D5 | §11 |
| B | New-character onboarding rode the synchronous `new` route, so its character-summary approval could not survive reload | Every flow containing a player-approval step persists a draft: onboarding and any campaign move needing new bindings. `existing` and explicit manual `copy` (no approval step) stay synchronous; manual copy is not portability | §8.1, §13 |
| C | Tightening a separate campaign declaration was host-resolved, letting a host rewrite other players' characters | **Superseded by the 2026-07-31 authority and Gate-3 rulings:** there is no separate declaration or ordinary host/player edit surface; the creator chooses at creation and later GM worldbuilding evolves only through play | §6 |
| D | "Candidate" was used without a closed definition | Gate 3 removes the candidate-permission grammar. The GM proposes wording from the live canon pack; the engine accepts only known IDs and slots, expected shape, and expression-only text, then the player approves it | §6.3 |
| E | Gate 1 still described Continue/Branch/Translate as three result profiles | One persistent character record moves between campaigns. The same id, mechanics, and progression travel; only per-campaign expression bindings differ. Saved bindings are reused exactly, and portability creates no branch, alternate version, or merge | §3, §4, §8, §10-§14 |

---

## 2. Grounding: what actually ships today

Verified against working-tree head.

- **Genre is free text**, not a picklist (`public/index.html:279-282`). Gate 3 adds no classifier;
  the genre string is merely one part of the campaign material the GM may already have used.
- **Two unrelated ability surfaces, both in the adjudicating model's context:**

  | Surface | Shape | Where written | Where read |
  |---|---|---|---|
  | Campaign ruleset abilities | `{name, cost, effect, limits}`, free text | Generated once per campaign by Setup (`rpg-engine.js:1124-1151`), validated as free text (`rpg-state.js:745-773`) | `rpg-prompts.js:101-109` |
  | Profile abilities | `{name, description, tier, source}`, free text | Grown in play by `ability_updates` (`rpg-engine.js:110-148`) | `rpg-prompts.js:156` |

- **The ruleset sheet is canon and explicitly anti-drift**: `=== CAMPAIGN RULES (CANON — these must
  never drift) ===` … `Apply these rules identically every turn. When the player asks what they can
  do, answer from this sheet.` (`rpg-prompts.js:102-108`).
- **Ability identity is the lowercased display name** (`rpg-engine.js:127`).
- **Reuse and copy carry the character verbatim** (`rpg-engine.js:1153-1159`,
  `rpg-engine.js:2086-2099`) into a campaign whose ruleset was regenerated **for the new genre from
  the archetype string alone** (`rpg-engine.js:1143`).
- **Shipped storage still reflects the old model**: profiles persist archetype, attributes,
  inventory, abilities, progression, checkout, and explicit manual-copy lineage
  (`db.js:240-265`); campaigns persist genre and `ruleset_json`
  (`db.js:92-95`, `db.js:121`). That is implementation evidence, not the approved portability
  result. Phase PT must keep portability on one canonical character record and leave manual copy
  separate.

### 2.1 The shipped defect, and the correct risk statement

**Defect**: the engine already re-expresses the rules for each genre; it does not know it is
re-expressing *the same character*. A western gunslinger entering a fantasy campaign gets a fantasy
rule sheet describing abilities that are not hers, alongside her own untranslated revolver
abilities.

**Risk, stated correctly** (v3 got this wrong): today's abilities have no *engine-executed*
mechanics — nothing in `rpg-state.js` or the catalog runs them. But the **model** is the adjudicator
and both ability surfaces are its rulebook. Re-expressing that prose therefore *can* change how the
game adjudicates, even though no engine number moves. Two consequences:

1. Re-expression is legal only during the destination campaign-entry handoff, before the
   character becomes active there. A return may add a missing binding for an ability gained
   elsewhere, but it never rewrites an already approved destination binding during play.
2. Re-expression must be constrained and player-approved, never a free model pass. S1.8 ships last,
   behind the card (§11).


### 2.2 Durable constraints

- **D0**: one bespoke versioned rulebook; campaigns change flavor, not mechanics.
- **D2** (catalog signed 2026-07-27): abilities select operations from the Chapter 2 catalog and
  never invent mechanics inline (`docs/rules/effects.md` §5).
- Chapter 2 §5 leaves ability packaging — costs, targeting, cooldowns, archetype assignment, the
  authorizer, the `foe`-binding affirmation carrier — to D3/D5.
- Engine owns numbers, state transitions, validation, canonical records. Models emit bounded
  identifiers, enums, and player-facing expression.

---

## 3. Thesis: mechanics do not translate, because they do not change

D0 says one rulebook applies across campaigns. Chapter 2 says abilities are selections from a
versioned catalog. A cross-genre move therefore cannot change mechanics: the same catalog is in
force on both sides.

v2 tried to generate a destination ability and prove it equivalent to the source. That has no stable
operating point: a generated candidate either copies the source mechanics, making the proof
ceremonial, or changes them, making the proof false.

**Portability never copies the mechanical record.** The same persistent character record, with the
same id, abilities, packaging, attributes, and progression, moves from one active campaign to
another. Only expression bindings are stored per campaign. Equivalence is not inferred or proved;
there is no second mechanical record to compare.

Two real problems remain:

1. **Naming** — each campaign needs its own words, used consistently whenever the system speaks to
   the player → §5.
2. **Fictional fit** — the GM must ground a particular expression in the destination canon → §6.

Everything v2 called "no honest equivalent" belongs to problem 2.

### 3.1 When mechanics genuinely must change

| Case | Disposition |
|---|---|
| Destination pins a different `catalog_version` | The move cannot commit. Chapter 2 §1.1 makes a version change an owner-approved migration; the character may move only after the campaigns share the migrated version, or the player cancels |
| The GM cannot honestly ground an expression and the player rejects alternatives | **Rebuild** — separate, future, player-driven respec of the same character. A move never silently narrows the character |
| The player wants different mechanics | Rebuild. That is a character-change feature, not translation |

---

## 4. The artifacts

### 4.1 Canon basis

Portability reads the destination campaign's canonical outline/setting, bounded played history,
and relevant durable memories through shared internal helpers. It stores no second setting model.
A movement draft may retain only a deterministic digest of the exact retrieved basis for stale
review detection; that digest is not canon. See §6.

### 4.2 Campaign vocabulary (campaign scope)

Semantic key → destination term, with provenance back to the canon-grounded proposal. Shared by
every character in the campaign. See §5.2.

### 4.3 Persistent character and campaign bindings

```text
mechanics — ability records, packaging, progression, and attributes.
            Owned by the engine. One canonical record travels with the character.
            Portability never copies, re-derives, or lets a model touch it.
            D5 later defines the fuller ability package.

identity  — families and functional slots classify what the character's abilities need to
            express. They are not campaign bindings and do not assert equipment, history,
            relationships, or other D13/D16 state.

bindings  — expression only, stored per (character, campaign):
            Stage 1 contains ability display names, ability prose, and pins
            limited to Stage-1-eligible ability expression. It contains name wording only if
            Gate 7 admits it. A return reuses saved bindings exactly. A move proposes only
            destination bindings that are missing.

pins — the player's wording preferences for eligible name or ability slots; the GM judges fictional fit and the player approves the resulting destination wording. §7.
```

Persistent identity taxonomy, not a campaign-local binding:

```json
{
  "schemaVersion": 1,
  "characterId": "pc_7f2",
  "abilityIds": ["a41", "a42"],
  "families": { "primary": "marksman", "secondary": ["duelist"] },
  "expressionSlots": [
    "role:marksman",
    "source:precision-projectile",
    "implement:sidearm",
    "implement:long-range",
    "resource:ammunition",
    "ability:a41",
    "ability:a42"
  ]
}
```

Stage 1 campaign binding:

```json
{
  "schemaVersion": 1,
  "characterId": "pc_7f2",
  "campaignId": 41,
  "vocabularyVersion": 1,
  "abilities": [
    { "abilityId": "a41", "term": "Quick Draw", "prose": "She acts before her foe can react." }
  ],
  "literalPins": [
    { "slot": "ability:a41", "term": "Quick Draw", "reason": "Player keeps this ability wording" }
  ]
}
```

The character record stores **no second mechanical vocabulary** — no `reach`, `targetShape`,
`delivery`, `tempo`, `setup`, `costShapeRef`, `reliabilityBand`, or fingerprint. Where present, those
live on the canonical mechanic record/reference; D5 later owns fuller ability packaging and D6 owns
spatial vocabulary. Duplicating them into campaign bindings would create a drifting mechanical copy.

### 4.4 Ability identity

Today an ability is matched by lowercased display name (`rpg-engine.js:127`). If a campaign calls
"Quick Draw" "Fast Nock", the next level-up can mistakenly create a second ability. Stable ids are
therefore a hard precondition, not a nicety.

| Property | Rule |
|---|---|
| Scope | **Globally unique when minted**, engine-issued, and not campaign-scoped. The one persistent character keeps the same ids everywhere |
| Minting | Once, on first existence — Setup generation, an `ability_updates` insert, or one-shot legacy backfill keyed by the current name within the profile |
| Stability | The ids remain on the same ability records while the character moves; expression bindings never replace them |
| Matching | `applyAbilityUpdates` matches on id; name matching survives only as a fallback for legacy rows without an id |
| Display | Never identity. Display names live in bindings keyed by `ability:<id>` |
| Import/manual copy | Bundles remap ids under the existing entity mapping. Explicit manual character copy retains its shipped behavior but is not a portability path |

---

## 5. Vocabulary and bindings

### 5.1 Why v3's single lexicon failed

v3 declared one campaign lexicon "shared by every character" while keying entries generically:
`role`, `identity:name`, `identity:origin`. Two characters in one campaign cannot both own `role`,
and `identity:name` is per-person by definition. The second character silently overwrites the first.

The split below keeps the property that motivated the shared lexicon — one world, one set of words,
late joiners cannot shift established vocabulary — while giving each character their own identity
and expression.

### 5.2 Two scopes

**Campaign scope — shared vocabulary.** A semantic key names one concept already established for
this campaign. Entries are created lazily from campaign canon, never from a genre table:

```json
{
  "campaignId": 41,
  "vocabularyVersion": 1,
  "entries": [
    { "key": "role:marksman", "term": "Longbow ranger", "provenance": "gm-canon-review" },
    { "key": "implement:sidearm", "term": "Repeating hand crossbow", "provenance": "gm-canon-review" },
    { "key": "resource:ammunition", "term": "Arrows", "provenance": "gm-canon-review" }
  ]
}
```

**Character scope — bindings**, per `(character, campaign)`. Ability wording may reference the
shared campaign vocabulary, but remains attached to the one persistent character. The `identity`
member exists only if Gate 7 admits campaign-specific name wording:

```json
{
  "characterId": 88,
  "campaignId": 41,
  "vocabularyVersion": 1,
  "abilities": [
    {
      "abilityId": "a41",
      "term": "Fast Nock",
      "prose": "She has an arrow away before the string stops humming."
    }
  ],
  "literalPins": [
    {
      "slot": "ability:a41",
      "term": "Fast Nock",
      "approvedAt": "…"
    }
  ]
}
```

Stage 1 has no separate role-title specialization. Ability-specific term and prose stay on the
ability's binding; they never rewrite a shared entry. Any later specialization needs its own
approved scope.

### 5.3 Slot taxonomy

| Slot family | Key form | Scope | Proposal basis | Notes |
|---|---|---|---|---|
| Role name | `role:<family>` | campaign | Live canon pack + internal family | What this campaign calls that kind of person |
| Power source | `source:<pattern>` | campaign | Live canon pack + character ability | Why the wording makes sense in this campaign |
| Implement | `implement:<function>` | campaign | Live canon pack + character ability | Noun by function, never resale value |
| Resource | `resource:<cost-shape>` | campaign | Live canon pack + canonical mechanic | Renames only; cadence mechanics do not move |
| Institution | `institution:<key>` | campaign | Live canon pack | Orders, guilds, corps, agencies, cabals already grounded in canon |
| Damage language | `damage-language` | campaign | Live canon pack | How harm reads in narration |
| Ability | `ability:<abilityId>` | character | Live canon pack + canonical ability | Display name plus flavor prose for one ability record |
| Identity | `identity:name`, `identity:appearance`, `identity:origin` | character | Persistent character + live canon pack | Only `identity:name` is Gate-7/Stage-1-eligible; the rest are D13/D16 |
| Oath | `identity:oath` | character | reserved | No Stage 1 persistence, pin, or transport before D13/D16 |
| Allegiance | `identity:allegiance` | character | reserved | No Stage 1 persistence, pin, or transport before D13/D16 |
| Relationship | `relationship:<key>` | character | reserved | No Stage 1 persistence, pin, or transport before D13/D16 |
| Weakness | `weakness:<key>` | character | reserved | No Stage 1 persistence, pin, or transport before D13/D16 |

The twelve families and the rule for adding more remain Gate 4. The last four are taxonomy
placeholders only; they do not assert transported state.

### 5.4 Vocabulary lifecycle

1. **Created lazily.** A destination gets no portability vocabulary at campaign creation. When a
   character first needs a missing binding, the engine retrieves the live canon pack in §6 and asks
   the GM for only the missing wording.
2. **Structurally bounded.** The engine accepts known character and ability IDs, known requested
   slots, and expression-only text. Numbers, mechanics, new IDs, and new slots are rejected.
3. **Player-approved.** Nothing becomes a binding until the player approves the exact wording.
4. **Stable after approval.** Bound entries are reused exactly. Later GM worldbuilding can ground
   new missing terms but does not rename approved terms or invalidate a returning character.
5. **Shared without overwrite.** A late joiner may reuse existing campaign terms and add genuinely
   missing keys, but cannot change established entries.
6. **Portable with the campaign.** Vocabulary and bindings export and import with their owning
   records. They contain no copy of campaign canon or character mechanics.

### 5.5 No genre classifier or permission tables

Gate 3 rejects genre classes, capability axes, requirement predicates, and seeded permission
tables as runtime authorities. They would duplicate the campaign and eventually disagree with
what the GM has established. Free-text genre remains ordinary campaign input, not an engine
classifier target. The GM judges fictional fit directly from the live canon pack (§6).

### 5.6 Internal family set

Gate 5 still owns this internal-only onboarding taxonomy; it is not a player-facing class menu and
does not authorize vocabulary by genre. The proposed set remains:

| Id | Family | Defining player decision loop |
|---:|---|---|
| 1 | Defender | Protect someone or something by trading position or exposure |
| 2 | Bruiser | Commit at close range for force and staying power |
| 3 | Duelist | Manage movement, timing, counters, and one priority opponent |
| 4 | Marksman | Select targets and firing windows while managing range and ammunition |
| 5 | Artillery | Spend setup or resources for area pressure, destruction, or suppression |
| 6 | Controller | Alter choices, terrain, access, status, or an underlying system |
| 7 | Infiltrator | Cross a guarded boundary, remain undetected, exploit access, and escape |
| 8 | Saboteur | Prepare and trigger delayed disruption against a system or place |
| 9 | Scout | Learn routes, threats, positions, and opportunities before commitment |
| 10 | Investigator | Gather and connect evidence to reveal a hidden fact, cause, or actor |
| 11 | Face | Choose leverage and concessions with a person or small group |
| 12 | Commander | Allocate present allies, timing, formation, and immediate team tempo |
| 13 | Healer | Triage, prevent, stabilize, and recover through scarce care |
| 14 | Inspirer | Shape group morale, attention, emotion, or public feeling |
| 15 | Maker | Prepare, build, repair, or modify concrete tools and capabilities |
| 16 | Scholar | Apply established expertise to interpret, predict, or advise |
| 17 | Handler | Direct a distinct companion or agent sharing action economy and risk |
| 18 | Transformer | Choose between mechanically distinct body, stance, identity, or loadout modes |
| 19 | Pilot | Control a mount, vehicle, or platform whose position and risk matter |
| 20 | Survivor | Allocate supplies and adapt under scarcity, hazards, or isolation |
| 21 | Patron | Call on wealth, status, institutions, or networks with obligations |
| 22 | Generalist | Cover an unfilled ordinary need at a lower ceiling than a specialist |

Generalist is package-only and provisional; it never justifies an open pick-anything build.

---

## 6. Canon-grounded fictional-fit review

### 6.1 Shared canonical-context retrieval

Portability reads the same destination campaign information already exposed through MCP, but
internal engine code calls shared read helpers directly. It never calls its own MCP SSE or HTTP
endpoint. The MCP handlers and portability path are adapters over the same helpers.

The Stage 1 canon pack is deterministic and bounded:

1. the campaign's canonical outline and setting;
2. the latest **six** played turns, selected newest-first for the bound then returned in
   chronological order; and
3. the top **eight** relevant memories, ranked by importance and then recency with deterministic
   tie-breaking.

The helper interface may accept an explicit limit, search query, or other bounded selector so MCP
tools can preserve their public behavior. Portability pins the defaults above. Retrieval validates
the destination campaign ID and outline shape before any model call.

### 6.2 What counts as canon

The outline/setting, GM narration in played history, and committed memories ground the fit review.
A stored `player_action` is an attempted action or player claim; it is useful context but does not
establish the claimed world fact by itself.

The canon pack and its retrieval anchors are GM-private. The player-facing card shows proposed
wording and a concise, player-safe GM explanation of why it fits. It does not expose hidden outline
material, unrevealed memories, raw search hits, ranks, IDs, or digest inputs.

### 6.3 GM judgment and engine boundary

The GM decides whether wording honestly belongs in the destination campaign. That is a
worldbuilding judgment, not an enum lookup. The GM may keep the source wording when canon supports
it, translate it into established language, or introduce a canon-consistent expression and explain
the fit. If a player asks why guns are common, for example, the GM may affirm and justify that fact;
the engine does not overrule the world with a checklist.

The proposal contract contains only requested expression bindings plus a player-safe fit
explanation. The engine validates:

- destination campaign, persistent character, and ability IDs are the requested known IDs;
- output has the expected bounded shape;
- every returned slot was requested and already exists in the approved taxonomy;
- wording contains no numbers, costs, limits, operations, or other mechanics;
- no new slot, ability, character fact, or campaign fact is smuggled into the response; and
- saved bindings and pins are not rewritten.

Invalid output gets one bounded retry and can never commit. The player approves the exact wording;
approval does not let the player rewrite campaign canon. A requested literal pin still requires the
GM to judge it consistent with canon or offer an alternative.

### 6.4 Live canon and stale-review detection

Every proposal uses live reads, so later GM worldbuilding naturally informs the next missing
binding. There is no `capability_json`, revisioned setting checklist, synchronization workflow,
ordinary host/player setting editor, or Stage 1 administrative editor.

A movement draft stores a deterministic digest of the exact normalized canon basis used for its
proposal. Before approval, the engine repeats the same bounded reads and digest. A mismatch marks
the draft stale and requires a fresh review; it does not choose which version of canon is "right."
The digest is freshness metadata, not campaign canon, and is never injected into play.

Already approved per-campaign wording is stable. Live canon changes do not invalidate or rewrite it;
on return, the same character reuses it exactly and only newly gained abilities without destination
wording enter this review.

---

## 7. Pins

In Stage 1, a pin is a player wording preference for an eligible name or ability-expression slot.
It is not permission to rewrite the campaign.

```json
{ "slot": "ability:a41", "policy": "literal", "reason": "Player wants to keep 'Quick Draw'" }
```

| Policy | Meaning |
|---|---|
| `literal` | Ask the GM to keep this exact wording. It becomes a destination binding only if the GM judges it consistent with canon and the player approves the card |
| `ask` | Never auto-bind; always surface the wording for GM review and player choice |
| *(unpinned)* | The GM may propose canon-grounded wording for the requested slot; the player still approves it |

`identity:name` defaults to `ask` if Gate 7 admits campaign-specific name wording. Other identity
and non-ability slots have no Stage 1 pin policy.

The broader anchor vocabulary remains scoped, not transported state:

| Anchor kind | Stage 1 expression slot | Boundary |
|---|---|---|
| power source | `source:<pattern>` | Describes ability expression; does not establish oath or history |
| signature item | `implement:<function>` | May describe delivery; durable item identity is D13/D16 |
| companion | `implement:companion` / `implement:companion-sentient` | May classify an ability; companion entity and relationship state are D13/D16 |
| identity/body | Gate-7 `identity:name`; other identity slots reserved | Appearance and body state are D13/D16 |
| faith/oath/allegiance | source wording only; identity slots reserved | Belief, oath, and allegiance state are D13/D16 |
| relationship/weakness | reserved slots | Entity links and durable weakness state are D13/D16 |

Stage 1 does not pin, persist, translate, or transport deferred state unless the relevant D13/D16
decision explicitly brings it into scope.

---

## 8. Character initialization and campaign movement

### 8.1 One identity-onboarding mechanism

One mechanism serves new and legacy characters:

```text
free-text concept (or legacy archetype + ability list)
  -> model proposes internal families, occupied known slots, and eligible wording pins
  -> engine validates structure only: known families and slots, no numbers or mechanics
  -> player reviews a plain-language CHARACTER SUMMARY
  -> player approves or corrects it
  -> engine stores it on the one persistent character record
```

The player never sees a 22-item family menu. New characters use this after the existing concept box;
legacy characters use it at their first move if no identity record exists. Later moves read the
approved record and never re-derive it. Every approval step is a restart-safe persisted draft.
Explicit manual `copy` remains a separate synchronous feature, not portability.

### 8.2 One character move, with or without new wording

Portability has one result: the same character becomes active in the destination campaign.

| Path | Work |
|---|---|
| First entry | Fill only the Gate-7-approved Stage 1 name/ability bindings that are missing |
| Return with no new abilities | Reuse every saved destination binding exactly |
| Return with new abilities | Reuse saved wording exactly; review only abilities gained since the prior visit that lack destination wording |

No path creates a profile, branch, incarnation, lineage record, or merge. The character remains
active in the current campaign until approval commits. Entering an existing campaign never
recreates its rules, outline, history, current scene, or opening scene.

### 8.3 Flow

```text
persistent character, active in one campaign
  -> choose existing destination or draft a new campaign
  -> verify shared catalog version
  -> load saved (character, destination campaign) bindings
  -> determine only missing Gate-7-approved Stage 1 bindings
  -> if none are missing, present exact saved wording for move confirmation
  -> otherwise retrieve §6 live canon pack through shared internal helpers
  -> compute and store deterministic canon-basis digest on the draft
  -> GM proposes canon-grounded terms/prose and a player-safe fit explanation
  -> engine validates known IDs, expected shape, requested slots only, no mechanics
  -> invalid output: one bounded retry, then honest failure
  -> unresolved fictional fit: card in needs_choice; never invent engine permission
  -> otherwise card in ready
  -> player approves exact card hash
  -> engine repeats §6 reads and canon-basis digest
  -> stale digest, character revision, vocabulary version, or card: recompute review
  -> prepare and validate everything needed after commit
  -> one transaction stores newly approved bindings and switches the same character's membership
  -> existing destination loads current state; new destination returns its one opening scene
```

Cancel, stale review, invalid output, exhausted retry, or preparation/transaction failure leaves
the current campaign membership unchanged.

### 8.4 Outcomes

| Status | Meaning | Allowed next |
|---|---|---|
| `ready` | Every required binding is saved or GM-proposed from current canon; mechanics are unchanged | Approve, request different wording, or cancel |
| `needs_choice` | GM found no honest canon-grounded wording or the player rejected the proposal | Ask the GM for another grounded expression, choose rebuild when available, or cancel |
| `invalid` | Model output is off-contract | Internal bounded retry; never playable |
| `stale` | Character, vocabulary, card, or exact canon basis changed | Recompute review |
| `committed` | New bindings and the same character's active-campaign switch persisted once | Load destination without recreating existing campaign state |

### 8.5 Player card

The card says, in plain language:

1. **What remains unchanged** — mechanics, costs, limits, level, XP, and progression.
2. **Already established here** — saved destination wording that will be reused exactly.
3. **New wording proposed here** — only missing first-entry bindings or newly gained abilities.
4. **Why it fits** — a concise player-safe GM explanation grounded in the destination campaign.
5. **What remains unresolved** — any expression the GM could not honestly fit to current canon.

The card never exposes raw outline text, hidden memories, retrieval anchors, or the canon-basis
digest. Actions are **Approve this move**, **Ask for different wording**, or **Cancel**; future
rebuild remains a separate character-change feature. Approval carries a card-hash idempotency key.

---


## 9. Narration binding

A translation that is correct in storage but wrong in the narrator's mouth has failed. This is an
LLM-led RPG; words are part of the product.

1. The active character bindings and campaign vocabulary enter Council context as naming authority.
2. Unapproved wording from other campaigns remains only in those saved bindings and is excluded.
3. A literal pin appears only after the GM judged it canon-consistent and the player approved it;
   it is then an ordinary active destination binding.
4. `ability_updates` write stable ability IDs with current-campaign display names. A new ability
   minted in play gets a current-campaign binding and keeps the same ID everywhere.
5. Approved entries are not renamed mid-campaign or on return.
6. The raw Gate-3 canon pack, retrieval anchors, and digest are GM-private proposal inputs, never
   seat payload or player-facing card data.

The leak check is:

```
leaked = terms(otherCampaignBindings) - terms(activeCampaignBindings)
assert: no member of leaked appears in assembled Council context
```

The approved literal-pin case must remain in the active set and appear naturally in narration.
Seat isolation applies unchanged: a seat receives its own character's bindings and shared campaign
vocabulary, never another character's pins, provenance, alternatives, or GM-private canon material
(`.agents/repo-guidance.md`, Runtime Contracts).

---

## 10. Name and ability wording; all other character state deferred

Gate 7 owns the Stage 1 name policy. This section proposes only expression behavior; it does not
authorize history or other character-state transport.

| Item | Stage 1 boundary |
|---|---|
| Character name | If Gate 7 admits a campaign-specific name binding, the card may offer keep verbatim, accept proposed wording, or edit. A saved destination name is reused exactly on return |
| Ability display name and prose | Stored per `(character, campaign)` and keyed by stable ability id. Existing rows are reused exactly; on return, only newly gained abilities can require new rows |
| Appearance, origin, history, biographical provenance, oaths, allegiance, relationships, weaknesses, inventory nouns, and inventory mechanics | **Deferred wholesale to D13/D16.** Stage 1 does not translate, pin, transport, persist, inject, or promise bundle round-trip behavior for them |

The broader slot-taxonomy rows in §5/§7 are future vocabulary placeholders. Until their owner gates
close, Stage 1 implements only the name/ability expression slots Gate 7 explicitly approves.

---

## 11. Staged delivery

Each stage needs its owner-approved phase plan. Phase PT approves Stage 1 in the fixed order below.

### Stage 1 — expression translation over today's free-text characters

| Slice | Work | Exit |
|---|---|---|
| S1.1 | Ability IDs: mint, backfill legacy rows, match ability_updates by ID with legacy name fallback (§4.4) | **LANDED**: renaming no longer forks an ability; legacy rows still match |
| S1.2 | **LANDED:** Shared canonical-context retrieval and freshness (§6) | Direct helpers return validated outline/setting, latest six turns chronological, and top eight relevant memories by importance then recency; MCP and portability share helpers; deterministic digest detects stale drafts; no self-network call or new campaign schema |
| S1.3 | Canon-grounded GM wording proposal plus structural validation (§6.2-6.3) | GM judges fictional fit; engine admits only requested known IDs/slots, expected shape, and expression-only text; player-safe explanation does not leak raw canon |
| S1.4 | Lazy campaign vocabulary and per-(character, campaign) bindings (§5) | Vocabulary is created only when a missing binding needs it; two characters coexist; approved wording is reusable and contains no mechanics or canon copy |
| S1.5 | Identity onboarding, families, slots, pins, restart-safe approval (§8.1) | New and legacy characters get one approved identity record without a class menu |
| S1.6 | Drafted move of the persistent character (§8.2-8.5) | Same ID, exactly one active campaign, existing campaign never recreated; every non-approved result preserves current membership |
| S1.7 | Narration binding and leak checks (§9) | No unapproved cross-campaign term or GM-private canon material reaches Council/seat context |
| S1.8 | Canonical mechanic projection, last (§2.1) | GM context overlays active destination wording on one mechanic record; no destination mechanic copy; player saw every wording change |

S1.2 is landed. Its implementation seam begins at the existing MCP reads
(server.js:920+, tool declarations around 1004-1047, reads around 1074-1150) and the Council context
assembly already using outline, memories, and recent turns (rpg-engine.js:570-646). Extract those
reads into a transport-neutral `campaign-context.js` module used directly by both consumers; do not make an internal MCP, SSE, or HTTP request.

S1.8 remains last because the ruleset sheet is operative GM context. It runs only at campaign-entry
handoff for a missing binding and never rewrites approved rows while the character is active.

### Stage 2 — catalog-bound abilities

Depends on D5. Mechanics become catalog-bound records on the same persistent character. Campaign
movement still never copies or reconstructs them; vocabulary remains expression only.

### Stage 3 — rebuild

Depends on D5 and a separate owner decision. Rebuild is a player-driven respec of the same
character, not automatic translation and never an alternate version.

### Stage 4 — non-ability state

Depends on D13/D16. Inventory, relationships, history, and other non-ability state are not decided
by this ability-portability contract.

---

## 12. Verification

Entry point: node test.js (npm test). Every new behavior test requires the AGENTS.md guard proof:
revert the implementation, prove the test fails, restore it, and prove the suite passes.

The core invariant remains:

    const idBefore = character.id;
    const mechanicsBefore = structuredClone(character.mechanics);
    await approveCampaignMove(character.id, destinationCampaignId);

    assert.strictEqual(character.id, idBefore);
    assert.deepStrictEqual(character.mechanics, mechanicsBefore);
    assert.strictEqual(character.activeCampaignId, destinationCampaignId);
    assert.strictEqual(activeMembershipCount(character.id), 1);

| Area | Required coverage |
|---|---|
| Canon retrieval | Validate campaign ID and outline shape; latest six turns are selected deterministically and returned chronological; top eight relevant memories are ordered by importance then recency with deterministic ties |
| Shared helpers | MCP adapters and portability receive the same structured results for the same selectors; a test proves portability performs no loopback HTTP/SSE/MCP call |
| Canon meaning | Prompt/fixture marks player_action as action or claim, while outline/setting, GM narration, and committed memories ground canon |
| Freshness | Same normalized canon pack yields the same digest; any selected canon change yields a new digest and stale draft; digest never becomes campaign canon or invalidates approved bindings |
| Privacy | Raw outline/history/memory excerpts, retrieval anchors, ranks, IDs, and digest inputs stay GM-private and out of cards and seat payloads |
| GM proposal boundary | Known requested IDs and slots pass; unknown IDs, new slots, mechanics, numeric changes, pin rewrites, and malformed shapes fail; bounded retry exhaustion cannot commit |
| Live worldbuilding | New GM narration or committed memory informs the next missing binding without an editor or sync job |
| Identity | Same character ID before and after every move; one canonical record, no duplicate or reconciliation state |
| Mechanics/progression | Mechanics, level, XP, tiers, and subsequent progression remain on the one record unchanged by wording |
| Round trip | Returning to a visited campaign reuses saved bindings exactly; only newly gained abilities can need wording |
| Atomic move | Approval stores new bindings and switches membership once; cancel, stale review, invalid output, retry exhaustion, and transaction failure leave the old campaign active |
| Two scopes | Two characters retain separate bindings; shared terms remain shared; late joiners cannot rewrite established vocabulary |
| Narration | §9 leak test passes, including an approved literal pin that remains available in active narration |
| Compatibility | Manual copy remains separate; bundles round-trip character ID, active campaign, vocabulary, bindings, pins, ability IDs, mechanic references, and draft digest without claiming D13/D16 state |
| Seat isolation | Bindings, pins, alternatives, fit rationale, and especially GM-private canon material obey the leak/route guards in .agents/repo-guidance.md |

Manual playtests retain the v3.1 cases: western gunslinger into fantasy; fantasy wizard into
cyberpunk and back; one character through three destinations; a vehicle-dependent ability in a
vehicle-poor campaign; cancel/reload/retry/failure paths; two moved characters sharing one campaign;
and ten turns checking that approved wording stays natural. Add one test where later GM
worldbuilding changes the next proposal without rewriting an older binding, and one where the GM
explains why an apparently surprising term belongs in the world.

The bar before first play is that the player can state what the character can do, what wording is
new, what costs remain unchanged, and what the GM ruled about fictional fit.

---

## 13. Persistence sketch

**Character**: one persistent record with approved identity taxonomy, Gate-7-approved name/ability
bindings, mechanics, attributes, level/XP/tiers, mechanic revision, and one active campaign ID.
Portability adds no duplicate character and no campaign-local mechanics/progression copy.

**Campaign**: existing canonical outline/setting, history, and memories remain the only world
authority. Portability adds no capability record, axes, classifier result, permission table, or
canon synchronization fields. Campaign vocabulary may persist with its version; it is expression,
not a second description of the world.

**Bindings**: Stage 1 rows keyed by (character_id, campaign_id) contain semantic key, destination
term/prose, binding provenance (generated, player-pin, or player-choice), vocabulary version, and
binding-set revision. They contain no mechanics, campaign canon, requirement predicate, biography,
relationship, or inventory state. Approved rows survive inactivity and are reused exactly.

**Active membership**: a uniqueness constraint or equivalent transaction guard ensures one active
campaign per character. Historical bindings are not active memberships.

**Drafts**: a move draft stores persistent character ID, current mechanic/progression revision,
destination campaign ID, vocabulary revision, only missing bindings, exact card/hash, player
choices, status, timestamps, idempotent result, and the deterministic canonBasisDigest. It stores
no raw outline, history, memories, retrieval anchors, rules, current scene, or opening scene for an
existing destination. A new-campaign draft may hold the campaign material being created, but that
is ordinary campaign creation and is validated before membership changes.

**Endpoints** expose host-authorized create/read/review/approve/cancel operations using the exact
card hash. They never return the GM-private canon pack or digest inputs. Approval rechecks character
revision, vocabulary revision, and live canon-basis digest before the one membership-switch
transaction. Entering an existing campaign loads its current state and never generates another
opening scene.

---

## 14. Non-goals

- A second campaign-setting checklist, capability_json, capability axes, or synchronization job.
- A genre classifier, predicate grammar, seeded permission table, or engine-authored fictional-fit rule.
- A host/player setting editor or retroactive world rewrite.
- Internal portability calls to the server's MCP SSE/HTTP endpoint.
- Exposing raw canon, hidden outline material, memory-search anchors, or digest inputs to players.
- A class-name dictionary assuming every noun has a safe counterpart.
- A player-facing menu of the internal families.
- Model-generated numbers, operations, costs, limits, or mechanical permissions.
- Changing mechanics, progression, or character identity as part of campaign movement.
- Rewriting approved per-campaign wording because later worldbuilding changed.
- Claiming complete portability before D13/D16 settle non-ability state.
- Mechanical rebuild inside campaign movement.

---

## 15. Honest risks

1. **The bounded canon pack can omit an older relevant fact.** The outline and durable memory search
   mitigate this; six turns and eight memories are Council-matching defaults to verify in play.
2. **Fictional fit is a GM judgment, not mechanically provable.** Structural validation prevents
   mechanics drift, but only playtesting can show whether explanations feel coherent.
3. **Live canon can change during review.** The deterministic digest makes this visible and forces a
   fresh proposal before approval.
4. **Later worldbuilding may make old wording surprising.** Saved wording still returns exactly;
   the GM must reconcile it organically in play rather than silently rewrite the past.
5. **Retrieval and proposal add move latency.** Lazy execution avoids campaign-creation cost and
   runs only when a missing binding exists.
6. **The internal family and slot sets remain unvalidated in play.** Gates 4-6 and Stage 1
   playtests, not Gate 3, decide whether they are useful.
7. **S1.8 changes words in operative GM context.** The card and one-record projection reduce risk,
   but the real-session phase gate remains necessary.

---

## 16. Owner gates

Taken in chat one at a time and recorded durably.

1. **Architecture — SETTLED 2026-07-31.** One persistent character, one active campaign; mechanics
   and progression travel; per-campaign wording persists and returns exactly; no branches.
2. **Stage 1 phase — SETTLED 2026-07-31.** S1.1 → S1.8 order is load-bearing.
3. **Canon basis — SETTLED 2026-07-31.** Read live destination outline/setting, latest six turns
   chronological, and top eight relevant memories by importance then recency through shared direct
   helpers. GM judges fit; engine validates structure; player approves wording. Store only a
   deterministic stale-review digest, never a second setting model.
4. **Slot taxonomy — OPEN.** The twelve families and the rule for adding more (§5.3).
5. **Family set — OPEN.** Internal only (§5.6), never a player-facing class system.
6. **Onboarding shape — OPEN.** Plain-language character summary, never a family menu (§8.1).
7. **Campaign-specific name expression — OPEN.** Whether Stage 1 permits it and how the card presents it (§10).
8. **D5 ability packaging — FUTURE.** Stage 2 only.
9. **D13/D16 non-ability state — FUTURE.** Stage 4 only.

Gate 3 is closed and S1.2 is landed. Gates 4-7 remain required only before their affected slices.
