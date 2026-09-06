# Campaign and character versions: portability revision

**Status: DRAFT, NOT APPROVED FOR IMPLEMENTATION.** The owner authorized this planning revision
on 2026-09-05: revise portability around version storage, atomic upgrades, compatibility, and
staged class playtests, then present the first unresolved decision. The authorization covers
planning and record updates only. No class roster, economy, authentication design, implementation
slice, external review, data disposal, or phase reorder is approved by it.

**Settled 2026-09-05:** the owner chose a reusable private player key, not account sign-in, for
cross-campaign library ownership. `../decisions.md` owns that ruling. Section 3.3 proposes the
ownership/credential contract; its implementation is still unapproved.

**Current decision:** lost-key recovery authority, section 10, item 1. Administrator-assisted
recovery and player-held recovery proof have different trust/cost consequences. Present that
choice alone before the compatibility decision; no other pending ruling is implied by choosing keys.

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

The reusable private key is owner-selected. The following schema, transport and lifecycle details
are proposed implementation requirements, not a separate implementation approval. Key recovery
authority remains the one product choice identified at the end of this section.

**Principal and credential:** add a stable server-local player principal, with every owned
character lineage referencing that principal. A key is a replaceable credential for the principal,
not the lineage ID or the ownership record. Initially permit one active private key per principal,
usable across that server's campaigns; no cross-server identity federation or account provider.
Generate an opaque typed token from cryptographically random bytes, store only its SHA-256 hash,
and return the raw value once. Reuse the existing seat-token crypto pattern with a separate prefix
and validator. Do not reuse a seat token or a host/admin secret as a player key.

**Initial claims:** propose administrator-provisioned, expiring one-use enrollment grants. The
player redeems the grant to receive the private key; enrollment consumption, principal creation
and initial credential creation commit atomically. A grant is not a normal library/play credential.
For an existing unowned legacy lineage, use a separate one-use claim bound to that exact lineage
and the authenticated player. Recheck unowned status at commit. Possession of a seat, a display
name, a numeric profile ID, an import bundle or the shared host secret never auto-claims a library.
Existing owned lineages cannot be claimed again; ownership transfer is outside this phase.

**Credential transport and browser state:** use explicit same-origin bearer authentication on the
designated player/library and admitted play routes, following the existing API header mechanism.
Keep the player key separate from `aetheria_settings.accessToken`, host and admin credentials.
Propose memory plus origin-scoped session storage for the active player key, allowing reloads but
requiring the retained key on a new browser session. Do not place it in URLs, localStorage-backed
shared settings, bundles, logs, model context, campaign records or error diagnostics. Clear it on
logout and invalidate pending player-specific UI work on identity switch. Reuse `uiShowCopyDialog`
for show-once issuance, including its selectable-field fallback; clipboard failure must never log
the raw value. Record only a redacted operation failure in that case.

Bootstrap from server-returned principal capabilities, not a browser prefix check that treats every
non-seat credential as host. Capture/check the session epoch around bootstrap as well as polls.
Player-to-player and player-to-host switches clear library/member caches and cannot reuse the
host's `aetheria_my_character_<campaignId>` selection as ownership. Authentication expiry locks the
session and stops reads/actions instead of ignoring failed polls. Preserve unsent prose only for
the same principal; it must not appear after another player signs in. Forget/rotation notifications
across open tabs contain no secret and trigger the same cleanup.

**Authorization:** resolve a presented player key to an explicit `player` principal. A malformed,
unknown or revoked typed player credential fails authentication even when localhost host auth is
disabled; it never falls through to implicit host. Authorize the library by the owner FK, not by
client identity fields. A player can inspect/select their own versions and make their own wording
or replacement decisions, subject to existing active-link and destructive-confirmation rules.
They gain no host/admin authority from library ownership. Enrollment/claim administration does
not let the shared table-host credential reset a player's key or approve choices on their behalf.

Private-player activation requires configured host authentication: the existing no-`ACCESS_SECRET`
fallback also permits anonymous host/MCP reads, so it cannot coexist with private player libraries.
Refuse enrollment/activation without a host secret and refuse startup in anonymous-host mode once
private player ownership exists. Keep no-secret localhost only as the existing non-private
single-operator mode with no private player state. Enrollment and claim administration require
an explicit configured administrator secret, even on localhost. This is a proposed deployment
prerequisite for the key implementation, not a change to current runtime configuration.

Campaign admission remains host-controlled. For a player-key play request, derive eligible active
members from the player's owned version links and the current campaign head, then validate the
selected actor against that set and a live host-issued seat/admission record for that member. Mere
profile ownership or an active member row without admission is insufficient. Seat revocation blocks
play through that admission for both the seat token and player key; it does not revoke library
ownership. The library key never reveals or depends on retaining the raw seat token. A player
cannot enter or act in a campaign merely by naming its ID. A seat credential retains its existing
one-member scope and cannot access the player's library
or recover/rotate a private player key. Player-key authorization and seat admission are separate
checks; neither substitutes for the other.

Convert campaign GET, turn-response, journal and browser routing branches that currently treat
every non-seat as host. Full campaign/GM data is available only to an explicitly authorized host;
all player-key play projections use the same member privacy boundary as seats. Reuse the explicit
host check already present in `server-errors.js`. Keep unrelated library versions, private canon,
other players' state and credentials absent from player/seat campaign payloads and diagnostics.
Existing host library routes must not expose all private versions through their old unfiltered
profile list; limit private-library access to the owning principal, while retaining separately
authorized host views of current campaign members and explicitly unclaimed legacy profiles.

**Rotation/revocation:** authenticated rotation atomically replaces the key hash while preserving
the principal and all lineage/version IDs. Return the successor raw key once, invalidate old-key
sessions and queued requests, and keep active campaign state unchanged. If delivery fails, the
new key cannot be redisplayed from its hash; the chosen recovery path is required. Explicit key
revocation blocks library/player-key access without deleting characters or campaigns. Seat
credentials are independent grants: ordinary player-key rotation preserves them. Any operation
offered as compromise recovery must explicitly revoke the player's linked seats and invalidate
queued seat authorization as part of the same credential action; ordinary key rotation must not
pretend it accomplished that broader action.

**Recovery decision, still open:**

- Recommended: the server administrator can manually approve recovery after identifying the
  player outside the app, issue a short-lived one-use recovery grant, and atomically replace the
  credential when the player redeems it. Use explicit `ADMIN_SECRET` authority, never the shared
  table-host secret; recovery cannot rely on the current implicit-admin localhost fallback. Record
  actor, affected player and outcome without raw credentials. This makes the administrator trusted
  to restore, and potentially take over, library access; that power needs the owner's ruling.
- Alternative: issue a separate player-held recovery secret with rotate-only authority, stored
  hashed and rotated when used. No administrator reset through the product. Losing both the play
  key and recovery proof means no product recovery. This reduces administrator recovery authority
  but puts backup responsibility on the player and adds a second secret to retain.

Under either answer, no name-only reset, guessed identity, host impersonation, or silent ownership
reassignment exists. Routine rotation and recovery preserve the same principal and all compatible
versions. Exact endpoint/schema changes, key format/limits, grant expiry, rate limits, enrollment
delivery and the selected recovery protocol must be pinned in the authentication implementation
slice before code; no raw key or recovery grant is generated by this planning work.

## 4. Catalog compatibility and creation

Proposed initial compatibility rule: exact installed rules and catalog manifest identities, plus
every owned option allowed by the destination's selected set. Base/Advanced/Expert are cumulative
availability sets, not levels or power bands. A narrower-set character can enter a broader-set
campaign only when those exact mechanics already match; entry never strips options or upgrades
definitions. Different manifests require an authored upgrade or an existing compatible version.
This rule is a proposal for the section 10 compatibility decision, not a settled implementation.

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
authorization to attach to local data. Map ownership only through the approved local claim/admission
flow. Map retained ability IDs consistently across included versions and historical declarations;
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
| Planning gates | Resolve section 10 individually; approve concrete version and catalog/creator slices | This plan, decisions, roadmap, intake/findings | No unresolved product choice disguised as a default |
| Independent evidence branch | Separately approved non-shipping single-composer pilot, then observed paired evidence before relevant catalog membership/release rulings | New bounded runner plan/artifact and evidence records; retained IBP-1 fixtures | Only the tested mechanic changes; rejected IBP-2 remains untouched; owner verdict required; no reorder of production S1.5-S1.8 |
| Identity repairs | PT-R1, then PT-R2, one finding per commit | rpg-prompts.js, rpg-state.js, rpg-engine.js, ability-trigger-state.js, test.js | Exact production identity/Referee proof; consistent source limits; preserved replay/legacy text |
| Inert version storage | Lineages, physical versions, pins, constraints, structural migration, read-only guards | db.js, rpg-engine.js, rpg-state.js, test.js | Restart/idempotence, rollback, detached-member preservation, zero sibling mutation |
| Player authorization | Owner-selected reusable key; approved claim/recovery contract and scoped library | server.js, seat-auth.js, db.js, public/app.js, public/index.html, tests | Explicit host-only full projections; own-library access only; key rotation preserves ownership; seats remain limited; no imported ownership escalation |
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
- Player-key tests cover enrollment/claim single-use races, cross-player library denial, unknown
  typed credentials under no-host-secret localhost mode, explicit host/player/seat projection,
  zero URL/log/clipboard-fallback credential exposure, and queued-request invalidation on rotation.
  Prove unchanged lineage/version ownership after rotation and recovery, the selected reset
  authority boundary, and the distinct seat consequences of routine rotation and compromise recovery.
  Revoking host-issued admission must block player-key play as well as its seat token while keeping
  owner-library access intact; an owned but unadmitted member must never become an eligible actor.
- Include anonymous/host/admin/player/seat HTTP authorization over library, campaign, journal,
  audio and MCP surfaces; private-player startup/enrollment must reject missing host authentication.
  Browser checks cover session reload, stale bootstrap after identity switch, expired-key polling,
  cross-tab forget/rotation and non-disclosure of the previous player's cached library or draft.

Final real-data session: two catalog-backed characters, same-word ownership isolation, unavailable
and multiple declarations under the approved action economy, table-talk no-op, upgrade refresh
with unsent prose preserved, exact return wording, independent older-version play, archived-state
inspection, and export/import. Record unrun surfaces explicitly. Phase V and the existing remote
two-human feel gates remain independently pending.

## 10. Owner decisions and stopping point

This list is agent-facing sequencing, not a batch owner ask. The reusable-private-key direction
is settled in the 2026-09-05 decision; the remaining product rulings below are open.

1. **Lost-key recovery authority.** Section 3.3 specifies the proposed stable ownership, claims,
   credential separation and rotation contract. Choose administrator-assisted recovery or a
   separate player-held recovery secret with no product administrator reset. Recommendation:
   administrator-assisted recovery, with explicit administrator authentication and recorded manual
   authorization. It avoids permanent lockout but entrusts that administrator with recovery power.
   A shared table host or seat cannot recover a library key under either choice. This question
   does not reopen private key versus account sign-in or authorize implementation.
2. **Compatibility and legacy boundary.** Rule on section 4's exact-manifest/allowed-options
   proposal, then the remaining D13 legacy/freeform treatment. These are separate asks. No guessed
   legacy conversion, automatic downgrade, or automatic deletion under either answer.
3. **Creator identity and description.** Revise the class-model proposal around the adopted class
   sets, then rule on taxonomy separately from `pt-5`'s description surfaces. Do not implement the
   rejected prose-to-model-selected-mechanics flow. Keep the existing phase order unless explicitly
   amended; this draft requests no implicit reorder.
4. **Rules and catalog content.** Resume D4/D5/D6 and the dependent recovery/opposition/action-
   timing decisions one at a time from `rules-system-plan-intake.md`. Define the authored encounter
   boundary before upgrade activation. D16 is required only for mechanics depending on durable
   assets; unavailable assets cannot be supplied by invented state.
5. **Paired evidence and release.** Approve a replacement single-composer pilot plan, evaluate
   actual observations, then choose the next pair or catalog release. Catalog membership, economy,
   numeric definitions and the executable producer remain separately approved artifacts.
6. **Recovery lifecycle.** Define host recovery/archive deletion, retention, and any full-chain
   export behavior before exposing those controls. The existing player-version deletion restriction
   remains intact; this decision cannot be inferred from ordinary release authority.

After these rulings, revise affected sections and bring the first concrete implementation slice
for approval. Do not treat this draft, a reviewer opinion, or an answer to the first ownership
question as permission to start code, publish a class catalog, run a paid reviewer, or wipe data.
