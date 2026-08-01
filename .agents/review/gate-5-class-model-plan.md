# Gate 5 restrictive character-class model — draft plan

**Status**: DRAFT — the owner authorized this plan and a context-rich `claude-fable-5`
codereview on 2026-08-01. The taxonomy, supersessions, roster, and implementation are not yet
approved. No product code is authorized by this document.

**Current gate**: Gate 5 remains open and S1.5 remains blocked. The next owner decision is G5-A in
§8.1, after the requested review. Owner decisions are presented one at a time.

**Purpose**: replace the failed one-of-22 archetype-roster question with a model that distinguishes
restrictive classes from learnable skills, emergent party roles, backgrounds/status, assets, and
player-owned titles. This plan defines the classification and balance contracts, the dependency
order for producing an exact class roster, and the adversarial cases that roster must pass.

---

## 1. Why Gate 5 must be reframed

The current Fable candidate is useful negative evidence, not a viable class roster. Its 22 rows mix
different kinds of character information:

| Kind | Current rows | Why they are not interchangeable with class |
|---|---|---|
| Tactical role | Defender, Bruiser, Duelist, Marksman, Artillery, Controller, Commander, Healer, Inspirer | Describes contribution or party position. One class can perform several roles; the same role can be reached by unrelated classes. |
| Learnable capability | Infiltrator, Saboteur, Scout, Investigator, Face, Maker, Scholar, Pilot, Survivor | Usually expressible through skill ranks, feats, equipment, or ability choices available to more than one class. |
| Build structure | Handler, Transformer, Generalist | Describes how abilities are delivered or allocated, not what exclusive progression chassis the character belongs to. |
| Background, status, or resource | Patron | Wealth, rank, networks, and obligations may change in play and can coexist with any class. |

The 22×10 matrix demonstrates that genre-native nouns can be placed in every cell. It does not
specify class access rules, progression, action economy, resource cadence, encounter contribution,
multiclass cost, skill cost, or balance. A different noun in every cell is not evidence of a
different mechanic.

Counterexamples expose the category error:

- A Paladin can defend allies and command a garrison without changing class. Leadership and the
  garrison must be represented separately from the Paladin class.
- A Wizard can command Battle Mages by buying Leadership; Commander is a role produced by the
  build, not a second mandatory class.
- A restrictive Wizard cannot use a battle axe proficiently unless a feat, skill, subclass, or
  Fighter level explicitly grants access. The restriction and its paid exception are class-system
  mechanics; “Artillery” says nothing about either.
- A Netrunner can also be a billionaire. Netrunner may be a restrictive class or discipline;
  billionaire is background/current status and assets.
- A Royal Inquisitive contributes Investigator skills in a mystery, but “royal” is rank and
  “inquisitive” is an occupation or capability. In an ordinary dungeon, secret-route discovery,
  lore, and interrogation belong to independently purchased capabilities.

The result is not “find better names for the 22.” The result is “stop asking one field to carry
five independent axes.”

---

## 2. Authority and proposed supersession boundary

### 2.1 Settled Phase PT contracts this plan retains

Nothing here reopens these owner-approved rules:

1. One persistent character record is active in exactly one campaign at a time.
2. Canonical mechanics, abilities, attributes, level, XP, and progression travel unchanged.
3. Campaign movement changes only approved ability presentation; it never translates mechanics.
4. Previously approved campaign ability wording is reused exactly; only missing bindings are
   reviewed.
5. The player's own title never auto-translates. Proper-name and title editing remain future work.
6. Creator output is bounded to engine-known identifiers and player-confirmed before persistence.
7. Portability reads live campaign canon; it adds no genre classifier, permission matrix, second
   setting model, or inferred setting axes.
8. S1.1–S1.4 remain landed and unchanged. Their ability-identity, canon-retrieval, proposal, and
   binding contracts do not depend on an exact class roster.

### 2.2 Clauses this plan proposes to supersede if G5-A is approved

The active 2026-07-31 D3 decision uses one stable, player-facing `archetypeId` such as
`Controller`, and Gate 6 currently says Creator maps every concept to one known archetype ID. G5-A
would replace only that classification shape:

- no singular `archetypeId` selected from the 22 functional rows;
- no claim that tactical role, learnable capability, build structure, or status is a class;
- no Creator assignment of an exclusive class from prose without player selection and a legal
  engine-validated build;
- no S1.5 implementation until restrictive class, skill/feat, balance, and legacy/versioning
  contracts are settled.

The stable player-facing identity requirement survives, but attaches to the character's actual
class progression and player-owned title, not to a synthetic role label. The exact replacement
wording belongs in `.agents/decisions.md` only after the owner approves G5-A.

### 2.3 Evidence retained, not promoted

`.agents/review/archetype-roster-fable-candidate.md` remains reviewer evidence showing why a
role-to-profession mapping is insufficient. It is neither the class roster nor a runtime seed
table. The older portability matrices remain historical design evidence.

---

## 3. Proposed character classification model

The layers below are deliberately composable. A fact belongs in one canonical layer; displaying a
combined character summary does not merge their authority.

### 3.1 Class progression

A class is a versioned, engine-known progression chassis. It may grant or gate:

- ability families and level benefits;
- weapon, armor, implement, or system proficiencies;
- resource pools and recovery rules;
- class-exclusive actions, reactions, or upgrade paths;
- prerequisites and multiclass entry costs.

A character may have one or more class level tracks only through explicit multiclass rules. Class
names and levels persist across campaigns and are never genre-translated. A player-facing class
name such as `Wizard`, `Paladin`, or `Netrunner` is not replaced by `Controller`, `Defender`, or
`Patron` merely because the party or setting changes.

### 3.2 Skills and feats

Skills are ranked, engine-known capabilities purchased through a common advancement budget. Feats
are discrete permissions or exceptions. They may be class-gated, generally available, or granted
by a class, but their ownership is explicit.

Examples:

- Leadership enables commanding followers or coordinating allies; it does not create a Commander
  class.
- Investigation, medicine, stealth, crafting, piloting, and survival are skills unless an eventual
  class admission record proves a class-exclusive progression loop beyond the skill.
- Battle-axe proficiency is a feat, skill, or class grant. A Wizard without that grant remains
  non-proficient; prose cannot bypass the restriction.

### 3.3 Roles

Roles are zero-or-more derived descriptors of what the current build can contribute: defender,
controller, artillery, commander, scout, healer, and similar labels. They are computed from class
features, abilities, skills, equipment, and assets for explanation or party-composition help.

Roles:

- are not exclusive;
- do not grant mechanics;
- are not progression tracks;
- are not persisted as authoritative character identity;
- may change when the build or equipment changes;
- never replace class or title during campaign movement.

### 3.4 Background, occupation, rank, and mutable status

Background describes origin or prior life. Occupation and rank describe fiction. Mutable status
describes current wealth, office, reputation, or obligations. These may affect permissions only
through separately specified, engine-owned rules; prose labels grant nothing by themselves.

`Billionaire`, `royal`, `guildmaster`, `criminal`, and `garrison commander` therefore do not name
classes. A class may require or grant a particular background feature, but that relationship must
be explicit in the class catalog.

### 3.5 Assets and relationships

Followers, a garrison, a corporation, a companion, and a vehicle are persistent world assets or
relationships. They require D16's durable-entity ownership, availability, and lifecycle rules.
Possessing an asset does not change class. A class feature may grant or improve an asset, but the
asset remains a referenced entity with its own state.

### 3.6 Player-owned title

The player's title remains free character identity wording, separate from class, role, occupation,
and rank. It travels unchanged under the settled Phase PT contract.

### 3.7 Canonical abilities

Abilities remain engine-owned mechanic records. Class levels, skills, feats, equipment, or assets
may grant them. Campaign bindings may change their display name and explanatory prose, never their
mechanical identity or entitlement source.

### 3.8 Target logical record

This is a logical contract, not authorization for a database migration:

```json
{
  "schemaVersion": 1,
  "chassisVersion": "<pinned-rules-version>",
  "classLevels": [
    { "classId": "<engine-known-class-id>", "level": 7 }
  ],
  "skillRanks": [
    { "skillId": "skill.leadership", "rank": 2 }
  ],
  "featIds": ["feat.weapon.battle-axe"],
  "backgroundIds": ["<engine-known-mechanical-background-id>"],
  "playerTitle": "<player-owned wording>"
}
```

Purely fictional backgrounds need not become IDs. Mutable status and asset references live in the
systems that own them, not this build record. Derived roles are intentionally absent.

---

## 4. Class-admission contract

No exact roster may be proposed until every candidate has a completed admission record. A class
candidate passes only if all answers are concrete and mechanically testable.

| Test | Required answer |
|---|---|
| Exclusive chassis | What progression access, restriction, or subsystem makes this more than a skill, feat, role, item, or background? |
| Repeated decisions | What decisions recur during ordinary play, rather than only in one campaign premise or downtime scene? |
| Action and resource cost | What actions, reactions, charges, pools, setup, or opportunity costs govern its strongest effects? |
| Advancement | What changes at each progression band, and what remains inaccessible without taking this class? |
| Multiclass boundary | What is gained at entry, what is delayed or lost, and how are one-level dips prevented from buying the full chassis? |
| Cross-pillar floor | What can the class contribute in combat, exploration, and social/world interaction, including a deliberate weakness where relevant? |
| Missing-subsystem fallback | What remains playable when no vehicle, mystery, followers, crafting time, wilderness scarcity, or institutional network is present? |
| Composition | Can leadership, wealth, rank, weapon proficiency, or another class coexist without changing this class's identity? |
| Portability | Does the same class and mechanic record remain honest in every campaign without renaming it to a role or profession? |
| Versioning | Which pinned chassis/catalog version owns its grants, prerequisites, and upgrade path? |

Failure of any row means the concept moves to the appropriate skill, feat, role, background, asset,
or title layer. It does not receive a class ID merely to keep a target roster count.

Generalist receives no special exemption. Breadth is an allocation outcome; a Generalist class
would need exclusive breadth mechanics and opportunity costs that cannot be reproduced by buying
ordinary cross-class skills.

---

## 5. Balance contract before roster approval

The 22×10 noun matrix contains no balance evidence. G5-B's exact class roster must carry a common
mechanical comparison packet for each class:

1. **Progression snapshots** at initial, middle, and cap levels: granted features, legal choices,
   resource capacity, and access restrictions.
2. **Common action budget**: expected action/reaction/setup use and effect-catalog weight per scene.
3. **Opportunity accounting**: expected access to the class's signature loop in the standard
   scenario suite; rare opportunities require a compensating always-available floor.
4. **Cross-pillar profile**: intentional strengths and weaknesses across combat, exploration, and
   social/world interaction. Equal output every scene is not required; chronic non-participation is
   not acceptable.
5. **Multiclass and feat pricing**: every cross-class permission has an explicit cost; combining two
   packages cannot receive two full progression budgets at one level.
6. **Asset separation**: wealth, followers, vehicles, and institutions have independent availability
   and obligation costs. They cannot become unbounded class power through GM fiat.
7. **Build comparison**: at equal total advancement, specialist, multiclass, and broad-skill builds
   are compared against the same engine-owned effect and check vocabulary.
8. **Feel gate**: simulation can reject obvious mathematical failures, but final class balance and
   enjoyment require playtests. Reviewer agreement alone is not balance evidence.

Numerical budgets cannot be finalized before the rules queue settles the attributes, player-spend
economy, tactical-space assumptions relevant to class actions, and chassis/versioning policy.

---

## 6. Adversarial acceptance suite

Every future taxonomy, class roster, Creator contract, and persistence design must represent these
without category collapse:

| Case | Required representation | Failure caught |
|---|---|---|
| Paladin commanding a garrison | Paladin class progression + Leadership skill/feat + garrison asset/rank; Defender and Commander may both be derived roles | Requiring a Commander class or granting a free second class budget |
| Wizard commanding Battle Mages | Wizard class + Leadership; command target is a relationship/asset | Treating party role as exclusive identity |
| Wizard using a battle axe | Wizard remains Wizard; proficiency requires a legal feat, skill, subclass, or Fighter level | Prose bypassing class restriction |
| Netrunner billionaire | Netrunner class/discipline + wealth/status + corporation/assets | Treating Patron as mutually exclusive class |
| Battle Mage | One admitted class/subclass or explicit multiclass build with costed martial and spell access | Mapping the concept to generic Artillery while losing entitlement rules |
| Royal Inquisitive in a dungeon | Class remains whatever progression grants; Investigation skill + royal rank/occupation. Scout, Scholar, or Face capabilities require their own purchases | Job title masquerading as a universal play loop |
| Pilot without a vehicle | Pilot skill remains usable only where specified; character's class retains an always-available floor | Class becoming nonfunctional when optional asset is absent |
| Billionaire in a sealed dungeon | Wealth/status does not create remote assets without availability rules; class and learned capabilities still determine play | Patron alternating between dead turn and unlimited narrative fiat |
| Transformer who also heals | Transformation is a class feature, feat, or ability delivery mode; healing entitlement remains separately sourced | Build structure replacing contribution and access rules |
| Generalist versus specialist | Same advancement budget; broader access pays explicit depth/ceiling/opportunity cost | Catch-all receiving unrestricted best-of-everything access |

Passing means both the data representation and the legal build preserve every independent axis.
Merely describing the character correctly in prose does not pass.

---

## 7. Creator and S1.5 target shape after all gates close

The current S1.5 sentence is not implementable under this model and must remain blocked. Its later
replacement must obey this flow:

```text
player concept + player title
  -> Creator may recommend only engine-known class, skill, and feat IDs
  -> engine validates prerequisites, advancement budget, class levels, and catalog version
  -> player sees and edits the legal build, not just prose
  -> player explicitly confirms exact build and title
  -> engine persists one canonical build on the persistent character
  -> Creator may write non-authoritative description around that approved build
```

Creator never invents an ID, treats a role/status/job as class, grants an unpaid proficiency, or
uses description text to authorize mechanics. Recommendation is optional assistance; player
selection plus engine validation is authority.

Legacy free-text characters are not auto-classified from prose. D13 must choose their truthful
legacy/versioning path before S1.5 can assign restrictive mechanics. Existing abilities and
progression must not be silently reinterpreted as class grants.

Campaign movement reads the approved build unchanged. It does not rerun class mapping, alter skill
ranks, recompute backgrounds, or acquire assets. Only the already-settled ability-presentation flow
runs.

---

## 8. Gate and dependency order

### 8.1 G5-A — classification ontology (next owner decision)

Approve or reject the §3 separation and §2.2 supersession boundary. Approval retires the singular
one-of-22 archetype model as the intended class identity, but approves no class names, mechanics,
schema migration, or product code.

### 8.2 Required rules prerequisites

After G5-A, settle the existing rules queue one decision at a time:

1. D4 attribute contract, because class prerequisites and bonuses must target a settled attribute
   model.
2. D5 player-spend/resource economy, because class action and multiclass budgets require a common
   cost model.
3. D6 tactical space to the extent class features depend on range, adjacency, interception, or
   positioning.
4. D13 chassis versioning and truthful legacy behavior before restrictive builds are persisted or
   imported.
5. D16 durable assets before followers, vehicles, corporations, or garrisons can carry mechanical
   authority. D16 does not block class design that treats these as unavailable external assets.

### 8.3 G5-B — exact class roster and catalogs

Produce the exact versioned class roster, skill catalog, feat catalog, per-class admission records,
multiclass rules, and target build schema. No fixed class count is assumed. Every rejected candidate
is routed to another layer with a reason.

### 8.4 G5-C — mechanical and adversarial validation

Run the §5 comparison packets and §6 cases. Record simulation results and playtest risks. Revise
one class or shared rule per reviewable slice; do not sweep unrelated failures into one commit.

### 8.5 G5-D — S1.5 implementation plan

Only after G5-B and G5-C are owner-approved may `plan.md` receive a cold-implementable product-code
slice for schema migration, catalogs, Creator contract, UI, API, bundle import/export, seat/privacy
boundaries, tests, guard proof, and legacy handling. No placeholder roster or prose-only class ID may
ship to unblock S1.5 early.

---

## 9. Durable artifact updates after an owner ruling

If G5-A is approved, the same docs-only commit must:

- add the precise superseding decision to `.agents/decisions.md`;
- amend `.agents/review/archetype-portability-matrix-v3.1.md` only where it currently requires one
  known archetype ID and a 22-row candidate;
- update D3 in `.agents/review/rules-system-plan-intake.md` with the new open-gate sequence;
- update Phase PT status and S1.5 in `plan.md`;
- mark `.agents/review/archetype-roster-fable-candidate.md` retained evidence, not an active roster;
- update `.agents/state.md` to point here as Gate 5's current entry point.

Until that ruling, this plan and its review provenance are the only new durable artifacts. Existing
approved guidance is not silently rewritten.

---

## 10. Verification for this planning slice

Before presenting G5-A:

1. `git diff --check` passes.
2. Every one of the 22 candidate rows is accounted for in §1 without being silently deleted.
3. The §6 suite covers the owner-supplied counterexamples: Paladin commander, Wizard battle-axe,
   Wizard commander, Netrunner billionaire, Billionaire Sponsor, and Royal Inquisitive.
4. The plan explicitly identifies the active 2026-07-31 decision it would supersede and preserves
   all unaffected Phase PT decisions.
5. `claude-fable-5` reviews the pinned draft at `high` effort with the reasoning context that led to
   the redesign. Findings are triaged against repo authority and observable design failures; reviewer
   preference alone does not rewrite the plan.

This is docs-only design work. Product verification (`node test.js`) becomes mandatory only when a
later approved implementation changes shipped behavior.

---

## 11. Non-goals

- Choosing the final class roster or class count in this planning slice.
- Treating the 22 rows as subclasses merely to preserve prior work.
- Implementing Leadership, wealth, followers, vehicles, transformation, or multiclass mechanics.
- Adding a runtime genre classifier, permission table, capability axes, or automatic class/title
  translation.
- Reopening S1.1–S1.4, campaign-movement identity, ability-presentation authority, title ownership,
  or canon-retrieval decisions.
- Guessing restrictive mechanics for legacy free-text characters before D13.
- Claiming mathematical balance or fun from reviewer approval without simulation and playtest.

---

## 12. Review provenance

Pending the owner-requested context-rich `claude-fable-5` review.
