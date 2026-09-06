# Campaign and character versions: portability revision

**Status: DRAFT, NOT APPROVED FOR IMPLEMENTATION.** The owner authorized this planning revision
on 2026-09-05: revise portability around version storage, atomic upgrades, compatibility, and
staged class playtests, then present the first unresolved decision. The authorization covers
planning and record updates only. No class roster, economy, authentication design, implementation
slice, external review, data disposal, or phase reorder is approved by it.

**Settled:** reusable private player keys (2026-09-05) and simple administrator-assisted recovery
(2026-09-06). `../decisions.md` owns both rulings and the owner's instruction to keep character
security proportionate to a game. Section 3.3 replaces the earlier elaborate credential proposal.
Implementation remains unapproved.

**Already settled:** character/campaign compatibility is part of the active 2026-08-02 upgrade
decision. Use a compatible saved character version or an allowed destination-campaign upgrade;
never silently downgrade or translate mechanics. The draft's additional compatibility approval
gate was an error and is removed. Remaining work concerns the Creator/class catalog and unresolved
mechanics; recheck existing decisions before presenting another owner question.

**Evidence baseline:** `e647c5a`. Function references identify current integration surfaces;
re-read them at the implementation base. No runtime or browser tests were run for this draft.

## 1. Authority and scope

The active 2026-08-02 campaign-class-set, safe-upgrade, character-version, and interaction-burden
decisions in `../decisions.md` own the product contract. This document proposes its implementation
architecture; it does not amend those decisions. `plan.md` Phase PT is the roadmap entry point.

The retained portions of `archetype-portability-matrix-v3.1.md` own live-canon retrieval,
ability-only presentation, player approval, exact saved-wording reuse, and stable archetype/title.
Its one-record/no-versions model is historical. `ability-keyword-production-plan.md` owns the
approved invocation contract and the catalog dependency of AKP-4.

The signed resolution and effects chapters are design authority, not evidence of implemented
d100 resolution or effect execution. The shipped rules-mode path still has optional d20 checks,
generated rule cards, HP/mana, and model-mediated progression. This revision does not authorize
implementing the remaining rules chassis. Any catalog mechanic needing an absent executor stays
unreleased until a separately promoted and approved rules slice implements and proves it.

In scope for the proposed phase: version identities and pins; player authorization; compatible
character selection; immutable campaign recovery state; deterministic upgrades and replacements;
version-scoped ability wording; catalog/creator dependencies; import/export, fork, release and
deletion boundaries; and staged interaction evidence. No provisional production abilities,
generated-card converter, automatic database wipe, genre-mechanics translation, or version merge.

## 2. Existing implementation and required changes

| Surface | Existing behavior | Required version boundary |
|---|---|---|
| `db.js` campaigns/characters/player_characters | Campaign rows, table-member snapshots, mutable reusable profiles; profile checkout identifies one active campaign | Distinguish logical lineages from physical campaign and character versions |
| `rpg-engine.js` createCampaign/joinCampaign | Rechecks available profile inside a write transaction | Recheck exact owned version, catalog compatibility, complete bindings, and destination active version |
| saveCharacterState/syncPlayerCharacter/takeTurn | Writes the member and reusable profile together | Update only the selected active character version; no ancestor/sibling synchronization |
| proposeStageOneAbilityWording/readStageOneAbilityBindingStatus | Uses the reusable profile as mechanics authority | Load the requested character version and compare its revision at approval |
| storeApprovedStageOneAbilityBindings | Append-only wording keyed by profile, campaign, ability; no source-version approval digest | Bind both physical versions and the reviewed source/destination revisions |
| loadParty/buildCharacterAbilityTriggerState | Empty aliases/families; catalog and character-version inputs absent | Persist aliases, use released family registry and pins, include both version identities in revision |
| `server.js` authenticate/requireHost | Shared host authority or a seat tied to one campaign/member; no durable player principal | Add the owner-approved player authorization contract; a seat alone never grants a whole lineage |
| queueCampaignTask | Queue key is physical campaign ID | Use logical campaign identity, then reject obsolete physical-version requests inside the queue |
| Seat mint/rotate/revoke routes | Currently bypass the campaign task queue | Queue by logical campaign and recheck active head, member and captured authorization before mutation |
| `db.js` withWriteTransaction/withReadTransaction | Queues all DB operations with explicit AsyncLocalStorage transaction ownership; nesting rejected | One outer transaction per activation; internal helpers must share its owner |
| forkCampaign | Replay into an independently playable campaign and fresh profiles; does not copy S1.4 wording | Keep explicit fork distinct; never use replay to build an upgrade recovery snapshot |
| exportCampaign/importCampaign/validateCampaignBundle | Atomic v1-v3 campaign bundle path; imports remap instance IDs; no version history | Explicit version envelope, local ownership assignment, catalog validation and remapping |
| releaseCharacter/releaseCampaignCharacters | Frees profile and detaches some member links; retains history | Release only the selected version; preserve recovery/history references and old backfill guard |
| Campaign deletion route | Profile release transaction, then separate campaign delete and disk-audio cleanup | New version lifecycle must own reference checks and DB changes atomically; disk cleanup follows commit |

The turn `encounter` flag means introduced danger, not a persisted encounter lifecycle. Neither it
nor an empty turn queue proves that the campaign is outside an unresolved encounter.

## 3. Proposed identities and storage

Keep existing numeric IDs as physical version IDs to preserve the many table, seat, history and
binding references. Do not reinterpret an existing ID as a logical lineage ID in the same API.
Public responses name `campaignId`/`characterVersionId` explicitly and add distinct lineage IDs.

| Record | Proposed meaning and constraints |
|---|---|
| New `campaign_lineages` | Logical campaign ID and one active physical `campaign_id`; unique active head |
| Existing `campaigns` | One physical campaign version; add lineage, parent version, monotonic version number, lifecycle, mutation revision, rules/catalog pins, selected class set |
| New `character_lineages` | Logical player character ID with stable player-principal FK; key rotation never changes ownership; proposed contract in section 3.3 |
| Existing `player_characters` | One independently playable character version; add lineage, parent version, monotonic version number, rules/catalog pins and mutation revision; retain checkout fields |
| Existing `characters` | Campaign-version-local member and arrival/current snapshots; its `player_character_id` identifies a physical character version, never the lineage |
| Existing vocabulary/bindings | Physical campaign/version keys remain; profile key now denotes a physical character version; add validated `aliases_json` with empty-array legacy default |
| New operation drafts | Durable move/upgrade proposal, requester, source revisions, target manifest, choices, approval digest, status and idempotency key; no active membership |
| Released catalog manifests | Immutable rules/catalog identities, definition versions, option/set membership, family registry, executable dependencies and authored migration edges |

Use unique `(lineage_id, version_number)` constraints and validate every parent/head belongs to
that lineage. Enforce one active checkout per physical character version in database-backed
activation, including cross-campaign races. Versions may coexist in different compatible campaigns.
Bound monotonic counters with explicit overflow failure. An unchanged retry returns the original
result; reusing an operation key with changed content fails.

Campaign lifecycles are `active`, `archived` and a non-playable candidate state. Candidate data
belongs to the durable proposal until final activation; it must not leak into campaign lists,
seat sessions, current history, or model context. Character versions are independently playable
state, not immutable records forever. Each has an immutable rules/catalog identity and mutable
progression while active in its own campaign.

An archived campaign retains its exact member snapshots, outline, world state, history, bindings
and media references. It must never render through a character profile that later progresses in
another campaign. Historical member links are not active checkout claims. Writes, lazy ID
backfills, model calls and on-demand synthesis are prohibited on archived reads; saved media may
be replayed through the existing authorization boundary.

### 3.1 Ability identity

Keep retained ability instance IDs across an authored upgrade, as the adopted decision requires.
The executable ownership key is `(characterVersionId, abilityId)`; equal retained IDs in sibling
versions do not mean shared mutable state. New acquisitions mint IDs once. Definition identity
and version remain separate from instance identity; the selected catalog owns mechanical data.

For split/removal migrations, an authored mapping defines retained, retired and newly minted
instances and legal replacements. Bindings, declarations, history and import maps must use the
correct owner/version context. No cross-version name lookup, mechanic inference, or automatic
XP/inventory/resource synchronization is permitted.

Historical invocation records retain immutable execution provenance: physical character/campaign
version, catalog digest and the definition ID/version actually used for that turn. Retained ability
IDs acquiring new definitions do not rewrite old declarations. Update `buildTurnContext`,
`buildCampaignExport` and bundle validation to validate history against this recorded provenance,
not the successor's current owned definitions. Copied turns retain their original execution context;
import remaps included instance/version references without changing the executed definition version.

### 3.2 Structural migration and legacy rows

Proposed structural migration creates one lineage and one explicit `legacy` version for each
existing live campaign/profile without inventing catalog identities or mechanics. Preserve IDs,
saved wording, member history and release state. Do not recreate profiles for detached/released
snapshots; retain the existing one-shot backfill sentinel. Old free-text ability text is preserved
verbatim and remains non-invocable. No generated-rule-card-to-owned-ability conversion exists.

This proposal preserves data; it does not settle the future legacy/freeform product mode. D13's
remaining ruling must define legacy play/import availability at final cutover. No real data is
deleted by schema startup, import, activation or catalog installation. Disposal of a resolved
throwaway store remains a separate explicit operator action.

### 3.3 Player-key ownership and recovery

The owner selected a reusable key and administrator-assisted recovery, then explicitly required
game-appropriate simplicity. Use the existing token, settings and administrator patterns. The
following contract replaces the earlier enrollment, claim and recovery-grant design.

1. Store a stable player ID and one current key hash. Character lineages reference the player ID,
   so replacing a key does not change character IDs, versions, progress or campaign membership.
   Generate the key using the existing random-token/SHA-256 pattern with a distinct player prefix.
2. The administrator creates a player and gets a key to give them, using the existing show/copy
   dialog. New characters belong to the authenticated player. An administrator can assign an
   unowned existing/imported character to a selected player directly; no enrollment or claim tokens.
   Imported IDs do not attach data to an existing local owner automatically.
3. The player pastes the key into the existing access-token settings. Reuse its bearer-header and
   saved-settings behavior. Recognize player, host and seat modes explicitly and reuse the existing
   session-epoch reset when the selected key changes. Add no account sign-in, cookie/session
   framework, alternate credential store, or mandatory cross-tab synchronization system.
4. For a lost key, the administrator selects the player and chooses Reset Key. Replace the hash
   atomically and show the new key once for the administrator to pass to the player. The old key
   stops working; the player ID and everything it owns stay intact. If the new value is lost or
   delivery fails, the administrator can reset it again. Use the current administrator route guard
   and its existing deployment behavior, without an extra proof-of-identity workflow.
5. Keep basic ownership checks: player keys select their owner's characters, never another
   player's or the host's authority. Campaign admission remains host-controlled, and player play
   uses the existing member/seat privacy boundary. Handle player tokens before any legacy host
   fallback; reject an invalid player token. Existing non-seat-equals-host response branches need
   explicit player handling so GM-only state does not appear in the player UI.
6. A key reset does not delete characters, remove them from campaigns or revoke independent seat
   tokens. Existing seat revocation remains the way to withdraw a seat; it also blocks player-key
   play through that admission. Recheck the current player key before committing queued actions.
   A request rejected after reset asks for the replacement key, using the existing error/UI flow.

Do not add backup secrets, expiring recovery grants, credential-specific audit storage, compromise
recovery modes, new startup/deployment gates, or a generalized permissions system. Existing
single-operator localhost behavior remains; this feature does not promise private hosting while
host authentication is disabled. Keep raw keys out of logs, model context and campaign bundles.
Focused acceptance is key creation/use, own-character selection, admin reset with old-key rejection,
unchanged character ownership/progression, and the existing host/seat privacy checks. No key is
implemented or generated by this planning decision.

## 4. Catalog compatibility and creation

The active 2026-08-02 campaign/character-version decision already governs compatibility. The player
selects a saved version compatible with the destination's pinned rules/catalog and allowed class
set. If the newer character version is incompatible, use a compatible saved version or upgrade the
destination campaign when administration permits it. Entry never silently downgrades, strips or
translates character mechanics. Versions progress independently and never merge.

Base/Advanced/Expert remain cumulative availability sets, not levels or power bands. Implement the
compatibility check from authored catalog/version metadata and the settled upgrade contract. Do
not treat the former draft's exact-whole-manifest-equality proposal as an additional owner policy
or approval gate. Concrete metadata and validation belong in the implementation plan; they do not
reopen the already chosen player workflow.

Admin allowed-set changes affect new campaigns only. A separate allow-upgrades policy controls
host requests. Validate installation, allowed target set and monotonic set widening both at
proposal and activation; an admin policy change invalidates a stale draft. Catalog releases are
immutable. A changed definition requires a new catalog version, never editing a pinned manifest.

The real catalog/creator must produce all of the AKP contract before a version is playable:

- Engine-owned stable instances with `definition_id`, `definition_version` and exact invocation
  metadata; no model-minted IDs, grants, permissions, costs or effect definitions.
- A closed family registry with validated labels and CSS tokens, including every invocable family.
- Complete player-approved campaign term, aliases and prose for each invocable owned instance;
  collisions are rejected per character using the shared deterministic matcher.
- Complete initial mechanics, resources and progression under the owner-approved rules package,
  with every required engine operation actually implemented and tested.

These invariants also apply after creation. Every catalog-backed gain, improvement or removal must
follow the pinned authored grant/progression rules and exact owner/version identity. The Referee
may request only legal authored changes; it never authors a new catalog mechanic. Resolve any
required player choice and new truthful campaign wording before atomically committing the complete
ability/binding change and trigger revision. Existing legal terms remain unchanged; incomplete new
bindings or invalid grants leave the previous playable state intact.

Creator may propose campaign presentation for already selected legal IDs. It cannot select a
class or grant mechanics from prose. The final taxonomy, selection flow, description scope and
candidate membership require their own rulings; the old restrictive-class draft is evidence.

Keep canonical source-text limits separate from binding presentation limits. The held PT-R2
proposal uses name/description maxima of 200/2,000 Unicode code points, while binding term/alias/prose remain
80/80/500. Reconcile `ability-trigger-state.js`, live writes, catalog validation, migration and
imports with the same source contract before approving code. Its current 80/500 canonical-source
limits and UTF-16 `.length` measurement must not silently truncate or reject an otherwise valid
catalog definition. Canonical source validators measure Unicode code points consistently; textarea
match ranges remain UTF-16 offsets. Oversized local legacy rows remain preserved. Retain PT-R2's
safe, bounded read-only presentation projection and valid-sibling processing after full original
string validation; that projection cannot change mechanics or establish catalog eligibility.
Legacy-to-catalog conversion remains absent regardless of whether source text fits the limits.

## 5. Durable drafts, movement and upgrades

### 5.1 Common approval protocol

Prepare from a consistent read snapshot. Store the exact source campaign/character version IDs,
mutation revisions, source/target catalog digests, destination canon-basis digest, binding revisions,
requested operation and authored migration path. Player choices and approved wording are bound to
an immutable proposal digest. The server derives all identities and permissions from authenticated
ownership; client-provided owner IDs or replacement definitions are never authority.

No model call, user wait, or filesystem operation holds a SQLite transaction. At commit, re-read
every authority and revision in the operation queue and one outer write transaction. A mismatch
invalidates the draft, produces no membership/mechanics changes, and requires a refreshed proposal
and any affected approvals. Cancellation/restart preserves the current playable state. Drafts are
not new character versions and cannot be selected or exported as playable characters.

### 5.2 Campaign entry and movement

1. Resolve the exact owned character version and current destination version. Distinguish an
   available version from an explicit move of its current active membership. Recheck compatibility
   and host admission independently of character ownership.
2. Reuse saved destination ability wording exactly; propose only missing ability bindings against
   live outline/setting, latest six chronological turns and top eight relevant memories through
   existing internal helpers. Shared semantic keys remain rejected until a separate producer exists.
3. Show the player the missing wording, any incompatibility, and the exact destination. Archetype
   and player-owned title do not translate. Description surfaces await the separate `pt-5` ruling.
4. Acquire source/destination logical campaign queues in deterministic ascending ID order, removing
   duplicate keys and never waiting for a queue inside a DB transaction. An available version needs
   only the destination queue. Revalidate both heads and checkout ownership in one write transaction.
5. For an active move, atomically synchronize the exact source version, release its source member
   and seat, append destination bindings, and attach the same version at the destination. Do not
   perform a separate release before approval/activation. Failure, cancellation or stale destination
   leaves source membership and credentials unchanged. No genre translation creates a new version.

Do not infer that the owner has approved moving an active character out of an unresolved encounter.
Use the authored safe-boundary rules for any movement that changes active membership; ordinary
seat release behavior and its authorization remain separately specified.

### 5.3 Safe upgrade preparation

Use the logical campaign queue, not two independent source/target queues. The engine must have a
persisted, authored encounter lifecycle and pending-choice state that establish an upgrade-safe
boundary. An empty queue, absence of recent combat prose, or a model's unvalidated assertion is
insufficient. Missing/unknown lifecycle state fails closed. This depends on approved rules and
encounter work; this planning revision does not invent initiative, action economy or encounter ends.

Capture the complete campaign and all linked character state directly. Do not call `forkCampaign`
or rebuild a recovery snapshot by replaying turns. Resolve an explicit installed deterministic
migration path; no guessed intermediate versions or downgrade paths. For every affected player,
show retained/removed/changed mechanics and resource/progression changes. When no single authored
successor exists, collect that player's legal replacement choice before activation. A model cannot
choose it; a host cannot silently supply another player's required choice.

The migration set is precisely the current campaign's active members linked to character versions
whose checkout still belongs to this active campaign version. Released, departed and historical
members remain exact historical snapshots; their referenced versions may be progressing elsewhere
and must never be synchronized or migrated by this upgrade. Include their history in recovery and
the successor's retained history, but create successors only for the active linked migration set.

Reused binding text remains byte-identical when still truthful for a retained definition. If the
new mechanics make its approved prose false or trigger ambiguous, retain the old version's binding
and require new player-approved wording on the candidate version. No update to an immutable row.

### 5.4 Atomic activation

Within one outer `withWriteTransaction` owned by the queued activation:

1. Verify requester authority, admin policy, active head, safe boundary, all source revisions,
   each migrating version's checkout ownership, target manifests, migration path and required
   player choices/wording approvals.
2. Freeze the prior physical campaign's complete state as read-only recovery data. Preserve every
   linked player's complete pre-upgrade state as that lineage's prior independently playable version.
3. Create the candidate physical campaign and successor character versions. Apply only authored
   deterministic migration functions to copied state. No model/network/disk operations occur here.
4. Validate the whole party, world references, catalog definitions, resources, progression,
   membership, compatible pins, binding coverage and trigger uniqueness. Any failure rolls back all.
5. Release prior character-version checkout claims; link successors to the new campaign version.
   Mark predecessor member references historical, preserving attribution and snapshots.
6. Transfer non-revoked seats to their exact successor member within the same logical campaign,
   preserving their one-member scope. Never create two live scopes for one credential. Old physical
   campaign requests must fail; `/api/seat/session` resolves the current binding on refresh.
7. Archive the predecessor, atomically replace the lineage active head, record the committed
   operation result, and increment revisions. The candidate becomes visible only after commit.

The transfer and archived-read policy are proposed engineering details requiring the final plan
approval. They do not give a seat access to a character's other versions or the host's recovery data.
UI refresh must preserve unsent prose and require an explicit resend after trigger-version change.
Two simultaneous activations can yield only one successor; retries return its recorded result.

Seat mint/rotate/revoke must join the same logical campaign queue, revalidate the requested active
head and exact member inside their mutation transaction, and reject obsolete physical requests.
Revalidate captured seat authorization after any queued wait. `findLiveSeat` must require matching
seat/member campaign IDs and active-head membership. A concurrent revoke cannot miss a transferred
seat, and a delayed mint cannot recreate a credential for the archived predecessor.

## 6. Release, deletion, media, import and fork

Version deletion requires the owner-approved persistent player authority and explicit destructive
confirmation. Reject deletion while active or linked to any live or retained campaign record;
historical/recovery references count as links under the adopted rule. Do not weaken that rule with
a cascade. A deleted version never deletes its lineage siblings. Campaign/recovery deletion policy
is still open; expose no automatic retention cleanup in this phase.

Releasing a seat or character affects only its current physical membership and checkout. It does
not delete a version, erase saved wording or relink a historical row. Include released and departed
party members in recovery snapshots even when they no longer have a reusable-profile link.

Snapshot all DB-owned campaign content, including NPC/location/image metadata, history, invocation
records, table settings and saved voice references. Reuse immutable saved media only with explicit
reference ownership: deleting one campaign version cannot erase a file still referenced by another.
Perform file garbage collection only after a committed reference update; interruption must leave
at worst unreachable files, never committed records whose media were already removed.

Proposed bundle revision is v4; recheck the current format before implementation. Keep the existing
v1-v3 fixture behavior until D13 defines final legacy treatment. Export one consistent campaign
version with the linked version snapshots and presentation needed to reproduce it, not a player's
unrelated library or credentials. Whether a recovery chain is optionally exportable is deferred;
v4 does not claim to back up the entire lineage. Retain the source version's provenance without
making an absent parent a dangling local FK.

Import validates first and creates new local lineage/version/member/ability IDs in one transaction.
Never trust imported player ownership, credentials, server paths, or an external lineage ID as
authorization to attach to local data. Assign imported ownership through the local administrator
selection in section 3.3. Map retained ability IDs consistently across included versions and historical declarations;
definition IDs/versions remain catalog references. Missing executable catalogs or migration paths
must not produce a playable catalog campaign. An inspect-only import mode, if wanted, needs an
explicit product contract; do not silently fall back to model-interpreted mechanics.

An explicit playable fork remains a different operation with new lineages. Adapt its binding,
catalog-pin and invocation remapping under its own slice; current replay and historical artifacts
are not automatically version-correct. A safe campaign upgrade never calls that fork operation.

## 7. Reconcile the admitted portability repairs

`findings/pt-1.md` and `findings/pt-3.md` remain open. Their older detailed proposals in `plan.md`
are retained input, not an authorization or a current bundle-version specification.

- PT-R1: carry opaque owned IDs into the real GM/Referee contract; require exact known IDs for
  improvement/removal of the selected character version, and engine minting for additions. Name
  fallback is forbidden on the live path. Only the validated Referee result may authorize the
  ability change. Retained history replay uses an explicit code-only adapter, never a client/model
  opt-in. Version-copy equality of retained IDs must not permit cross-version mutation.
  On the catalog path, additions/improvements also require the authored progression/entitlement and
  complete binding boundary in section 4; Referee authority is not permission to generate mechanics.
- PT-R2: unify canonical source limits across create/update/catalog/proposal/import/migration and
  the invocation projector. Keep shorter presentation limits separate. Preserve oversized local
  legacy text and historical replay without truncation, lazy rewrite, or accepting malformed new
  mechanics. Do not retain the old draft's instruction to keep bundle format v2; the baseline is v3.

One finding per verified commit after approval. Neither finding is closed by this document, by
the landed composer, or by a unit fixture that still permits ID-less live improvement.

## 8. Staged class and interaction evidence

The catalog gate is not satisfied by the three frozen packages, a taxonomy matrix, simulation,
or the accepted composer prototype. None selects an economy or approves tier membership.

Propose a separately approved replacement paired runner using the retained IBP-1 Armsmaster/Adept
fixtures. The rejected IBP-2 interaction and any uncommitted artifacts stay untouched. A replacement
must use the accepted single prose composer, exact deterministic owned terms, click-to-insert and
non-activating typo suggestions. Its design must settle target/result handling explicitly without
reintroducing a second mechanic selector or making inferred model mechanics authoritative.

Keep the same character, equipment, check math, action budget, objectives, opponent behavior,
scenario branches and corresponding result tape. Change only the candidate mechanic. Use stable
duel and moving rescue/disruption to test both repetition and adaptation. Fixture numbers are
non-shipping test inputs, not approved class resources or a rules economy. Match information/help
access and record familiarity, run order, power and UI confounds; counterbalance order when feasible.

Record meaningful choices, dictated rotations, forgotten state, voluntary use, tactical automation,
prompt count, turn time and the player's experience. Never turn a score or sample count into
automatic tier assignment. Real observations and a separate owner ruling determine membership.
After the pilot, propose at most one next mechanic pair; do not pre-authorize a test campaign for
all candidates. Expertise tier and character level remain independent.

Before a production catalog release, author the exact class/skill/feat/subclass definitions that
the owner has selected: initial/middle/cap progression, exclusive permissions, action/resource and
recovery costs, cross-pillar contribution, multiclass costs where applicable, migration mappings,
and implemented operation dependencies. No class count, taxonomy replacement, universal renamed
pool, economy, companion system, or NPC symmetry is chosen by this plan.

## 9. Proposed delivery and verification

The existing S1.5 -> S1.6 -> S1.7 -> S1.8 relative order remains in force. The following prerequisite
work and integration grouping are proposed additions, not an approved reorder. Each row needs a
cold implementation slice with its closed decisions, exact schema/API diff, failure behavior and
guard proof before code begins. Shared changes are split further if they cannot land coherently.

| Step | Deliverable | Files/surfaces | Required acceptance |
|---|---|---|---|
| Planning gates | Resolve the open section 10 decisions needed by the next concrete slice, then approve that slice | This plan, decisions, roadmap, intake/findings | Reuse settled decisions; unrelated deferred features are not blanket prerequisites |
| Independent evidence branch | Separately approved non-shipping single-composer pilot, then observed paired evidence before relevant catalog membership/release rulings | New bounded runner plan/artifact and evidence records; retained IBP-1 fixtures | Only the tested mechanic changes; rejected IBP-2 remains untouched; owner verdict required; no reorder of production S1.5-S1.8 |
| Identity repairs | PT-R1, then PT-R2, one finding per commit | rpg-prompts.js, rpg-state.js, rpg-engine.js, ability-trigger-state.js, test.js | Exact production identity/Referee proof; consistent source limits; preserved replay/legacy text |
| Inert version storage | Lineages, physical versions, pins, constraints, structural migration, read-only guards | db.js, rpg-engine.js, rpg-state.js, test.js | Restart/idempotence, rollback, detached-member preservation, zero sibling mutation |
| Player keys | Stable player ownership, existing token settings, simple administrator Reset Key | server.js, seat-auth.js, db.js, public/app.js, public/index.html, tests | Own-character selection; old key rejected after reset; ownership/progression unchanged; existing host/seat boundaries retained |
| Draft/upgrade services | Durable candidate state, authored migration registry, approval digest, safe-boundary checks; routes remain unavailable without real catalog/runtime prerequisites | New focused version service/catalog modules, existing DB/engine/queue, tests | Whole-party atomicity, no nested transaction or model calls inside commit, stale/concurrent rejection |
| Catalog and S1.5 | Real released definitions/families, deterministic legal choices, exact approved wording and complete starting state | Approved catalog modules, prompts, engine, server, creator UI, tests | Creator cannot mint mechanics; no partial or unexecutable activation; description gate closed |
| S1.6 | Compatible version selection, missing-wording approval and membership change | Engine, server, public/app.js, test.js, test-browser.mjs | Exact return wording, restart/cancel/stale safety, independent versions |
| S1.7 | Destination narration binding | Council prompts/projections, seat projection, tests | Stable archetype/title; approved destination wording; private-canon and other-version exclusion |
| S1.8 and AKP-4 | Compatible mechanics projection and catalog-backed invocation cutover | ability-trigger-state.js, engine, prompts, state, UI, README, tests | Complete real producer; exact revision invalidation; no generated-card fallback |
| Version lifecycle integration | Enable approved upgrades; adapt export/import, explicit forks, deletion and media ownership | Engine, server, audio-store.js, state validators, UI and tests | Read-only recovery, whole-party upgrade/replacement, v1-v4 compatibility policy, no media/reference loss |
| Product feel gate | Full real-catalog versioned multiplayer session | Evidence records, state | Owner experience verdict; no simulated human approval |

Browser-visible upgrade/lifecycle features may not land as incomplete controls waiting for a later
storage patch. Keep internal services inert until the coherent user flow is ready. Full catalog
play additionally depends on separately approved/implemented rules execution; this table is not
authorization to implement every unresolved chapter as part of portability.

Automated entry points: `node test.js` and `git diff --check` for code; `npm run test:browser` for
new version/creator/move controls and always for `public/styles.css` or `public/theme-vars.js`.
Preserve the existing legacy bundle, seat lifecycle/TOCTOU, attribution, immutable binding,
transaction-owner, invocation and voice tests. Prove every new behavior guard fails when its
mechanism is removed, then restore and run the applicable full suite.

New acceptance matrix:

- Failed migration for the last party member leaves every head, version, seat, binding and
  resource byte-equivalent to the source; crash/restart cannot expose a candidate as playable.
- A delayed turn/join/release/approval after upgrade cannot mutate the archived campaign or the
  wrong active version. Concurrent upgrades create one successor; stale trigger revisions fail
  before Council/model calls, rolls, costs, turn insert or optimistic duplicate output.
- Seat mint/rotate/revoke racing an upgrade cannot restore revoked access or create predecessor
  credentials. Active moves acquire both queues without deadlock and preserve source membership
  on failure. Historical/departed profiles already active elsewhere never enter a migration batch.
- Old and new character versions can progress in two compatible campaigns without shared XP,
  inventory, abilities, resources or rewritten bindings. Archived campaign views remain unchanged.
- Removed/split abilities cannot activate until the correct player chooses an authored successor;
  unknown families, incomplete wording, alias collisions and absent executors reject activation.
- Live gain/improvement/removal cannot bypass authored grants or leave partially bound abilities;
  trigger revisions change atomically. Earlier invocations retain their executed definition version
  across progression, upgrades, archive reads, context construction and export/import.
- Canonical source limits admit exact Unicode-code-point boundaries and reject +1 uniformly,
  including non-BMP characters. Oversized legacy projection leaves originals unchanged and permits
  valid sibling proposals; match ranges still reproduce the exact UTF-16 textarea substring.
- Returning versions reuse exact saved wording; only missing/new bindings need review. Include
  non-Latin text, stable archetype/title, the eventual description-scope ruling and privacy guards.
- Version deletion rejects all active/historical links; deleting an eligible version preserves
  siblings. Media remains available to every surviving snapshot. Import cannot steal local
  ownership or synthesize a playable definition, and all included invocation references remap.
- Throwaway-store host/seat smoke and desktop/narrow browser runs exercise create, join, move,
  upgrade, stale retry, archive, export/import and the selected ownership flow without data leaks.
- Player-key checks cover the short flow in section 3.3: create/use a key, select the owner's
  character, reset through the existing admin surface, reject the old key and retain character
  state. Include a queued old-key request and player switching in the existing stale-response
  checks; reuse host/seat privacy guards for player-facing campaign data. No separate enrollment,
  recovery-grant or credential-security test program is required.

Final real-data session: two catalog-backed characters, same-word ownership isolation, unavailable
and multiple declarations under the approved action economy, table-talk no-op, upgrade refresh
with unsent prose preserved, exact return wording, independent older-version play, archived-state
inspection, and export/import. Record unrun surfaces explicitly. Phase V and the existing remote
two-human feel gates remain independently pending.

## 10. Owner decisions and stopping point

This list is agent-facing sequencing, not a batch owner ask. Items marked settled are not another
approval gate. The remaining product questions are presented individually.

1. **Player keys and recovery: SETTLED.** Reusable key plus simple administrator reset, under the
   2026-09-05 and 2026-09-06 decisions. Section 3.3 is the bounded contract; no authentication
   subproject or further recovery-policy question is required before returning to game behavior.
2. **Version compatibility: SETTLED.** Apply section 4 and the 2026-08-02 upgrade decision; do not
   ask the owner to choose this again. The no-generated-card-conversion boundary is also settled.
   D13 retains only legacy/freeform questions that the eventual cutover actually changes; preserve
   existing behavior until a concrete change is proposed, rather than adding an early generic gate.
3. **Creator identity and description.** Revise the class-model proposal around the adopted class
   sets, then rule on taxonomy separately from `pt-5`'s description surfaces. Do not implement the
   rejected prose-to-model-selected-mechanics flow. Keep the existing phase order unless explicitly
   amended; this draft requests no implicit reorder.
4. **Rules and catalog content.** Resume D4/D5/D6 and the dependent recovery/opposition/action-
   timing decisions one at a time from `rules-system-plan-intake.md`. Define the authored encounter
   boundary before upgrade activation. D16 is required only for mechanics depending on durable
   assets; unavailable assets cannot be supplied by invented state.
5. **Paired evidence and release.** The single-prose composer direction and staged evidence/tier
   policy are already settled. What remains is a concrete replacement pilot implementation plan,
   observed play and later membership/release judgments. Do not ask the owner to choose the
   interaction direction or evidence policy again. Catalog content still needs its own approval.
6. **Optional archive controls: DEFERRED.** Read-only prior campaign snapshots, host campaign
   authority and player-version deletion restrictions are settled. Archive retention/deletion and
   full-chain export can stay deferred until those optional controls are actually proposed; they
   are not blanket prerequisites for the next implementation slice.

After the applicable open rulings, revise affected sections and bring the first concrete implementation slice
for approval. Do not treat this draft, a reviewer opinion, or an answer to the first ownership
question as permission to start code, publish a class catalog, run a paid reviewer, or wipe data.
