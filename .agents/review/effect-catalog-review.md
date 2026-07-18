# Effect catalog review (docs/rules/effects.md)

**Status**: CLOSED — round r28 repair-delta redispatch returned CLOSED with zero findings (pinned 6772d33ca2026bf14c26bf518a280b54e88e9061); Chapter 2 at DRAFT r24, zero open findings, review loop complete, awaiting owner sign-off.
**Artifact**: `docs/rules/effects.md` (Chapter 2: Effects — the D2 effect verb catalog).
**Owner direction**: 2026-07-16 — owner approved drafting with independent review "like the dice
spec" (the resolution chapter), which ran dual codex + grok. Claude authored this draft and
therefore cannot review it (authors never review their own work).

## Convergence contract

Both reviewers must **accept the same pinned commit SHA** of `docs/rules/effects.md` with no
material comments. Structured fail-closed verdict envelope (schema-enforced: verdict,
reviewed_sha, evidence_checked, cold_implementer_executable, findings[]): missing, invalid,
off-schema, or SHA-mismatched output is NOT acceptance (re-prompt once, then contested). Review
lenses: internal coherence (tables, weights, valences, config, worked examples consistent with the
chapter's own rules and Chapter 1's §1.5 contract); fidelity to recorded owner decisions (the D2
decision, D0/intake enums-only invariant, Chapter 1 §1.5, recorded D16 requirements);
cold-implementer executability; drift risks (number smuggling, self-chosen weight/valence, state
minting, license/valence bypass, unledgered canon); and coverage (attack the say-yes claim: find
GM-natural rulings that neither map nor belong on the §6 exceptions list). Any reopen is recorded
here before the draft changes; a revised draft gets a new pinned round. After convergence the
chapter goes to the owner for sign-off; acceptance ungates Chapter 1 edge-band implementation
planning (no rules code before a concrete phase and an accepted plan review).

## Review rounds

### Round 1 — pinned `4738e31a3e30a3de370f2ad3fba64006f8f80f58` (draft r1)

Dispatch note: codex's first dispatch failed pre-review — its structured-output API rejects any
schema property not listed in `required` (exit 1, no review content); schema fixed
(`suggested_fix` made required) and re-dispatched. Fail-closed handling worked as designed.

#### grok 0.2.101 / grok-4.5 (high reasoning, isolated worktree at pinned SHA, schema-enforced)

Structured verdict valid and SHA-matched. `evidence_checked: true`;
`cold_implementer_executable: false`; verdict: **reopened** (4 HIGH / 3 MEDIUM).

1. HIGH — valence is fixed per operation, not actor-relative: crit-success foe-directed rulings
   (trip, disarm, shove, intimidate) always fail the band-valence check.
2. HIGH — item ops have no executable identity parameters (owner vs item unclear; mundane
   `item_gain` needs a name that "parameters are enums" forbids; no stable item ids today).
3. HIGH — "LIVE seam, map GATED:D1b" is incoherent: gated ops may not execute, so harm/pools
   cannot be both; NPC vitals have no state home at all.
4. HIGH — `fact_learn`/`encounter_start`/`value_*` lack a target/parameter contract; incompatible
   implementations guaranteed.
5. MEDIUM — no time/clock/delay verb, and clocks are not on the §6 exceptions list.
6. MEDIUM — `condition_clear` is always beneficial, so stripping a boon can never be a
   complication.
7. MEDIUM — temporary scene/environment state (smoke, rubble, alarms) is neither an op nor a §6
   exception.

#### codex-cli 0.144.0 (read-only sandbox, schema-enforced output)

Structured verdict valid and SHA-matched. `evidence_checked: true`;
`cold_implementer_executable: false`; verdict: **reopened** (3 CRITICAL / 5 HIGH / 1 MEDIUM).

1. CRITICAL — static valence tags validate band-inverted outcomes (marginal failure may
   `item_lose` a hostile NPC — benefiting the actor — and pass as adverse; crit success may heal
   an enemy and pass as beneficial).
2. CRITICAL — LIVE item ops lack recorded references and let annotation prose smuggle quantities
   ("a crate of 100 grenades" as one minor `item_gain`); name-keyed stacks have no stable ids.
3. HIGH — the grammar defines no per-operation target schemas; character/NPC id namespaces
   overlap; abilities (§5) bind to a shape that does not exist yet.
4. CRITICAL — no catalog transaction exists for ordinary actions (clean-success loot, healing,
   movement, disposition): the engine must keep a free-form seam that bypasses the catalog.
5. HIGH — no evaluation order for effect arrays: state-dependent costs (degrade → broken),
   duplicate writes, and no-ops (heal at max) are unpriceable/ambiguous.
6. HIGH — the conditions store lacks a record shape and a scene-boundary lifecycle ("scene" has
   no observable trigger).
7. HIGH — vocabulary omits clocks/alerts, environmental features, faction standing, and the D16
   inter-location NPC movement seam — and §6 does not name them as deliberate exceptions.
8. HIGH — §8 worked examples violate the chapter's own schema and Chapter 1's bidirectional
   coherence rule (effects not expressed in their text; missing starting conditions).
9. MEDIUM — the suggestion assembler claims determinism but defines no selection contract.

#### Coder triage → r2

All findings ADMITTED; overlaps merged. r2 changes: **actor-relative effective valence**
(direction-toward-target × party/non-party frame; disposition ops documented as party-frame
exception; `condition_clear` direction depends on cleared class) [codex 1, grok 1, grok 6];
**per-operation schemas** with typed refs (`character:id`/`npc:id`), single-unit stack rule,
bounded engine-normalized name strings licensed explicitly for mundane `item_gain` and scene
features, quantity never model-derivable [codex 2/3, grok 2/4]; **all D1b-mapped ops gated
end-to-end**, vitals/pools targets restricted to state that exists (player characters; NPC vitals
noted absent, D8/D16) [grok 3]; **normative left-to-right tentative-state evaluator** (no-op
rejection, one write per target+property per array, atomic commit, state-dependent pricing)
[codex 5]; **condition record shape + scene boundary proxy** (current-location change; refinable
by D7) [codex 6]; **scene-feature op family** over existing object occupancy (obstruction /
hazard / smoke / darkness / alarm / cover) [grok 7, codex 7 part]; **§6 additions + narrowed
coverage claim** (clocks, faction standing, inter-location NPC movement, permanent layout — named
inexpressibles with recorded future homes) [grok 5, codex 7 part]; **consumer roadmap** — the
catalog is the vocabulary for three consumers: edge-band annotations (this chapter), abilities
(D3/D5), and the ordinary-action commit path (its own future chapter; once a campaign is
rules-governed, no free-form state seam survives — consistent with the D2 decision's "any
mechanical consequence must map to an engine verb") [codex 4]; **§8 examples rewritten as
executable acceptance cases** (full payloads, coherent text, starting states, crit-success
foe-directed case) [codex 8]; **suggestion assembler de-scoped from determinism** (advisory,
implementation-defined, cap + pre-validation only) [codex 9].

### Round 2 — pinned `594c4240385484ab0a7f35fbec8bb4c477f47c11` (draft r2)

#### grok (same incantation)

Valid, SHA-matched, `evidence_checked: true`, `cold_implementer_executable: false`: **reopened**
(3 HIGH / 4 MEDIUM).

1. HIGH — §8 example 3 grants the goal on `marginal_failure` ("the node yields"), teaching the
   exact non-negation violation Chapter 1 forbids.
2. HIGH — scene features claim LIVE but the occupancy layer cannot hold kind/duration
   (`{name, kind, area, note}` only); note-smuggling would parse strings for mechanics.
3. HIGH — significant `item_gain` is unresolvable: an item being gained is by definition not yet
   in the owner's inventory, so the item-key rule rejects all D16 loot.
4. MEDIUM — `fact_learn` overclaims: memories have no checkId column; importance is numeric and
   model-emittable today.
5. MEDIUM — one-write-per-(target, property) has no per-operation key definition.
6. MEDIUM — `reposition` has no actor→occupancy binding rule (no ids; duplicate names).
7. MEDIUM — coverage: on-scene actor arrival (reinforcements/summons) and opposition injury are
   neither ops nor §6 entries.

#### codex (same incantation)

Valid, SHA-matched, `evidence_checked: true`, `cold_implementer_executable: false`: **reopened**
(2 CRITICAL / 4 HIGH / 1 MEDIUM).

1. CRITICAL — licensed strings can smuggle semantics past the budget: a "mundane" master key,
   paralysis inside a `hindered` detail, a catastrophic named hazard priced by duration only.
2. CRITICAL — the recorded-item grammar cannot transfer D16 loot (no source holder; a
   lose+gain pair double-prices to 4 points, over every license).
3. HIGH — LIVE claims without executable identity/lifecycle state: reposition (no occupancy ids,
   duplicate names, absent-NPC pull-in), features (fields don't exist), fact_learn (no check
   linkage).
4. HIGH — fixed scene-feature valence is contextually wrong (crit-success cover impossible;
   clearing party cover on a failure tagged beneficial).
5. HIGH — `wealth_shift` accepts character targets but D16 records wealth for NPCs only.
6. MEDIUM — no canonical conflict-key definition for the one-write rule.
7. HIGH — creatures and actor arrivals are unaddressable (creature occupants have no stable
   reference; `encounter_start` needs participants already present) and not on §6.

#### Coder triage → r3

All findings ADMITTED; overlaps merged. r3 changes: **licensed strings become subordinate to
their token** — a semantic contract per string (item `name`: genre-plausible mundane object,
no rarity/power/plot weight; condition `detail`: cause/color only, never mechanics beyond the
token; feature `name`: color only), enforced by Continuity as the same semantic gate as delta
reasons, with downstream prompts required to treat string content as color [codex 1];
**`item_transfer`** (atomic, priced once by item class, preserves record/condition/provenance,
GATED:D16) replaces recorded-item `item_gain`, which keeps only the mundane licensed-string form
[codex 2, grok 3]; **scene features gated on a declared feature record**
({id, location, area, kind, name, duration, works_against, source, appliedTurn}) with
**`works_against: party|opposition`** composing valence through the party frame (place validated
by Continuity; clear computed from the stored field) [grok 2, codex 3/4]; **reposition binding
rule** — exact unique (name, kind) match required among current occupants, zero/multiple/absent →
reject [grok 6, codex 3]; **`fact_learn` mapping made honest** — idempotency inherited from the
one-atomic-annotation-per-check transaction (no new column; ledger holds the authoritative
check linkage; importance is an engine config default) [grok 4, codex 3]; **normative
conflict-key table** for every op incl. targetless singletons; reference resolution runs against
the tentative state [grok 5, codex 6]; **`wealth_shift` restricted to NPCs** (PC wealth named in
§6/§9 as requiring its own decision) [codex 5]; **§6 additions** — actor arrival
(reinforcements/summons: D7/D8/D16), opposition vitals/injury (D8/D16), creature references
(D8), PC wealth [grok 7, codex 7]; **§8 example 3 rewritten to fail the intent** and the example
set restructured into LIVE cases plus explicit gate-rejection cases [grok 1].

### Round 3 — pinned `2a57edd757186c69e4447be17a7d2e2b78d5ad79` (draft r3)

#### codex (same incantation)

Valid, SHA-matched, `evidence_checked: true`, `cold_implementer_executable: false`: **reopened**
(3 CRITICAL / 5 HIGH / 2 MEDIUM).

1. CRITICAL — the draft itself reclassifies mechanical assertions as inert color: the
   "crate of 100 grenades → decoration" line, and §8 case 7's "saber skitters away" flavor after
   a gate rejection (an unledgered disarm).
2. CRITICAL — the valence frame misclassifies allied NPCs (hurting an ally computes beneficial)
   and cannot classify same-side transfers (PC→PC, NPC→NPC).
3. CRITICAL — the no-bypass claim omits ordinary rulings that are not §6 exceptions: no
   encounter-ending op, no item-to-scene custody, no mutual/both-sides features.
4. HIGH — validation order unreachable/conflicting: gates sit behind reference resolution that
   cannot resolve pre-gate state; Continuity's position contradicts Chapter 1 §5's fixed handoff.
5. HIGH — LIVE item/area references are not uniquely resolvable (duplicate names/ids are legal
   in current validators; only occupancy had a duplicate rule).
6. HIGH — `item_lose` is incompatible with D16 durable items (legacy uniques destroyable as
   "mundane" for 1 pt; no drop/abandon/destroy semantics for records).
7. HIGH — condition/feature token semantics are never defined, so the semantic gate has no
   boundary to enforce.
8. HIGH — `fact_learn` is an unbounded canon-write priced minor (whole annotation text as
   summary; no single-fact rule; top-8 retrieval contradicts "later checks honor it").
9. MEDIUM — suggestion assembler: active deltas missing from sources; de-scope from acceptance
   should carry recorded owner approval.
10. MEDIUM — `value_reduce`/`value_enhance` need a shared conflict key; net-zero arrays.

#### grok (same incantation)

Valid, SHA-matched, `evidence_checked: true`, `cold_implementer_executable: false`: **reopened**
(2 HIGH / 3 MEDIUM).

1. HIGH — `item_transfer` net valence undefined for same-frame endpoints (PC→PC, NPC→NPC).
2. MEDIUM — `item_transfer` never says the item key resolves against `from`.
3. MEDIUM — `fact_learn`'s LIVE write is not implementable (keyword algorithm unstated;
   multi-effect annotation text pollutes the summary).
4. MEDIUM — LIVE `item_gain` doesn't specify the stored inventory record shape (type,
   description, quantity fields exist today).
5. HIGH — forced exit from the scene has no op and is only half-covered by §6 ("the brigand
   flees" desyncs occupancy or free-form-edits it).

#### Coder triage → r4

ADMITTED: all except one partial dispute. **Partial dispute (codex 9)**: the assembler's
exclusion from cold-implementation acceptance is itself the accepted resolution of codex's own r2
finding 9 (its stated option b); the de-scope stands, the missing **active-deltas source is
added**, and the advisory-MAY reading (from the D2 decision wording "complication SUGGESTIONS,
maybe") is **flagged in §4 for explicit owner sign-off**. r4 changes: **string gate hardened** —
names asserting counts, contents, quantities, or properties are rejected (the grenade example
inverted to a rejection case), and §8 case 7's flavor rewritten possession-neutral, with new
rejection cases for unledgered-disarm prose [codex 1]; **frame fixed** — frame-composed ops may
target an NPC only when Continuity affirms the target is presently opposed in the established
fiction (allegiance-unknown → reject), helping allied NPCs moves to §6 pending recorded
allegiance (D8/D16); same-side nets defined (PC→PC = neutral, and neutral effects are illegal in
edge-band annotations; NPC→NPC rejected pending allegiance); `item_transfer` resolves `item`
against `from` on the tentative state, `from ≠ to` [codex 2, grok 1/2]; **new operations** —
`encounter_end` (GATED:D7, fixed beneficial, rationale stated), `item_drop`/`item_pickup`
(scene-held custody, GATED:D16), `scene_exit` (NPC refs, LIVE over occupancy with the reposition
binding rule; party-member exit → §6) [codex 3, grok 5]; **features gain
`works_against: both`** (adverse by rule: a mutual hazard always costs the party) [codex 3];
**validation pipeline rewritten to instantiate Chapter 1 §5's handoff** (Continuity first;
engine: catalog membership → availability gate before any dependency-owned lookup → schema →
reference resolution → evaluator → license/valence) [codex 4]; **exactly-one-match rule** for
item names and area ids (ambiguity rejects, mirroring occupancy) [codex 5]; **`item_lose`
re-scoped** — pre-D16 a Continuity mundane-check applies (unique/powerful legacy items reject
pending D16); post-D16 it is custody loss (records persist with provenance; destruction is a
future op) [codex 6]; **§7 token semantics table** (canonical meaning + must-not-assert boundary
per condition/feature token; absent tokens — blinded, silenced, poisoned, restrained — named in
§6) [codex 7]; **`fact_learn` redesigned** — `{op, fact: licensed string}`: one verifiable fact,
Continuity-checked for singularity/novelty/expressed-in-text, summary = the fact string, keywords
engine-default empty (out of acceptance), retrieval boundedness honestly stated with binding
force living in the ledger [codex 8, grok 3]; **LIVE `item_gain` write shape specified** onto
today's inventory fields (engine constructs name/type/description/quantity; model supplies name
only) [grok 4]; **shared conflict key for value ops** + array-level net-zero rejection
[codex 10].

### Round 4 — pinned `1db5be433780a1a54e10146f6eaa6a31577603cb` (draft r4)

#### codex — valid, SHA-matched, evidence-checked: **reopened** (2 CRITICAL / 5 HIGH / 2 MEDIUM)

1. CRITICAL — encounter lifecycle valences contextually false (a party-costing ending can't be
   ledgered; a party-favored start can't either).
2. CRITICAL — recorded scene objects (crates, consoles, hatches) have no verbs and aren't on §6.
3. HIGH — LIVE `item_gain` has no collision rule against existing (possibly special) same-name
   entries, and no conflict-key identity.
4. HIGH — the ordinary-action consumer cannot encode neutral changes (a no-check walk must be
   falsely valenced).
5. HIGH — validation is inseparable from the edge license; abilities/ordinary consumers can't
   reuse it as written.
6. HIGH — the LIVE edge subset cannot price licenses: Chapter 1's base license needs
   active-encounter state that doesn't exist (cadence enum is not a lifecycle).
7. HIGH — gated ops lack full schemas (`item_pickup`'s ref type undefined; `encounter_start`
   participants unbounded/unbound).
8. MEDIUM — §8 case 8 demonstrates evaluator behavior with gated ops, contradicting
   availability-first precedence.
9. MEDIUM — the suggestion assembler's sign-off flag is unresolved (empty-list implementations
   conform).

#### grok — valid, SHA-matched, evidence-checked: **reopened** (2 HIGH / 5 MEDIUM)

1. HIGH — `item_pickup` invents a field type outside §1's closed grammar.
2. HIGH — §7 never partitions condition tokens into boon vs hindrance sets (r3's table dropped
   the explicit enums; `condition_clear` valence becomes a guess).
3. MEDIUM — `item_gain` conflict key undefined (mint-by-name has no holder-resolved entry).
4. MEDIUM — no Continuity→engine handoff artifact for affirmed opposition (engine coders will
   re-implement fiction or assume every NPC is opposed).
5. MEDIUM — `encounter_start` "present" has no binding rule (reuse §2.5's).
6. MEDIUM — adverse encounter conclusion (surrender, capture) is neither expressible nor a §6
   exception.
7. MEDIUM — NPC/world intelligence state (cover blown, password burned) is a say-yes hole
   outside §6.

#### Coder triage → r5

ADMITTED: all except one recorded dispute. **Dispute (codex 9)**: the §4 owner flag is a
deliberate open sign-off question following Chapter 1's accepted "Flag for owner sign-off"
precedent (its §3 delta-magnitude flag), not a drafting defect; it resolves at owner sign-off,
which is already the acceptance gate. r5 changes, deliberately favoring §6 growth over new
mechanisms: **encounter lifecycle verbs gain a Continuity-validated `outcome:
party_favored|party_costing` param** with composed valence (fixes both directions; adverse
endings expressible) [codex 1, grok 6]; **recorded scene objects and NPC/world intelligence
state added to §6** with named future homes; E2's coverage claim narrowed to recorded *actors
and held items* [codex 2, grok 7]; **`item_gain` collision + identity rules** (pre-D16: reject
on any normalized-name match in the owner's inventory; conflict key = (owner, normalized name);
post-D16: fresh engine-minted record id) [codex 3, grok 3]; **valence classes gain `neutral`** —
quality enums accept it, neutral rejects in edge-band annotations and becomes legal only under
ordinary authorization; the full directional-op audit is assigned to the ordinary-action chapter
(§9) [codex 4]; **pipeline factored into a consumer-independent core** (Continuity gates →
catalog/availability/schema/reference/evaluator → computed cost + valence) **plus per-consumer
authorizers** (edge-band license here; abilities D3/D5; ordinary future) [codex 5]; **pre-D7
license input defined conservatively** — the encounter-active input to Chapter 1's license map
is constantly false until D7 ships a real lifecycle (never wider, only narrower; cadence enum
explicitly disclaimed as a proxy; feel consequence flagged for the owner) [codex 6]; **closed
field type `item-record ref` added** and `item_pickup` rewritten onto it; `encounter_start`
participants: unique, 1..cap, each bound via §2.5's occupancy rule, cost fixed regardless of
cardinality [codex 7, grok 1/5]; **§7 splits normative enums** — hindrances {hindered, exposed,
dazed, pinned, winded}, boons {steadied, inspired, concealed}, feature kinds §2.7-only [grok 2];
**Continuity emits an engine-readable `affirmedOpposed` set** recorded with the annotation;
engine composes frame valence only from it [grok 4]; **§8 case 7/8 split** into current-version
LIVE rejection cases (disposition conflict, gain-collision, no-op reposition) and explicitly
labeled post-dependency cases [codex 8].

### Round 5 — pinned `1ad84c79182547360584acf6031d7d863afbee89` (draft r5)

#### codex — valid, SHA-matched, evidence-checked: **reopened** (1 CRITICAL / 7 HIGH)

1. CRITICAL — `encounter_end(party_costing)` lets one minor point narrate party capture while
   ledgering only a lifecycle flag (restraint/custody/position unchanged).
2. HIGH — clear ops are always minor, so a minor license can remove persistent state that cost
   a significant license to establish (trust bypass).
3. HIGH — `affirmedOpposed` has no ledger home: Chapter 1 §5 fixes annotation as `{text,
   effects}`.
4. HIGH — D16 item ops mix name-key and record-ref schemas with no versioned transition.
5. HIGH — the pre-D16 mundane gate ignores mechanical fields (`stats`, `effect`) already on
   inventory records.
6. HIGH — `pinned` semantics aren't enforced: `reposition`/`scene_exit` have no active-condition
   precondition.
7. HIGH — encounter participants go stale when an NPC exits (roster vs snapshot undefined).
8. HIGH — item readiness/wielded state (draw, stow, disarm-in-hand) is neither an op nor a §6
   exception, though D16's loot requirement depends on wielded-state.

#### grok — valid, SHA-matched, evidence-checked: **reopened** (2 HIGH / 4 MEDIUM)

1. HIGH — frame-composed ops reject *all* non-opposed NPCs (bystanders, neutrals — help or
   hurt), but §6 names only allied boons.
2. HIGH — `affirmedOpposed` unshaped against Chapter 1's annotation contract (same as codex 3).
3. MEDIUM — no way to replenish an existing mundane stack ("another power cell" collides).
4. MEDIUM — name normalization/matching underspecified (case, Unicode) across collision,
   resolution, and conflict keys.
5. MEDIUM — `fact_learn` beneficial-only leaves pure discoveries on failure bands homeless.
6. MEDIUM — §3's "setting a pack down" neutral example contradicts `item_drop`'s fixed adverse
   direction.

#### Coder triage → r6

All 14 ADMITTED. r6 changes: **`encounter_end` scope restricted to lifecycle-only
consequences** — capture, surrender, and binding the party are named §6-inexpressible (restraint
tokens and party-custody state don't exist) [codex 1]; **clear weights derive from the stored
record** — clearing scene-duration state is minor, persistent state significant, priced on the
tentative state [codex 2]; **the edge-band annotation shape is normatively extended to `{text,
effects, affirmedOpposed}`** as a declared Chapter 1 §5 refinement enacted at this chapter's
sign-off (Continuity-emitted only; a model-emitted field rejects) [codex 3, grok 2]; **versioned
item schemas** — at D16 activation the catalog version bumps and every durable-item op takes
`item:<record id>`; name keys remain only in the legacy LIVE shapes [codex 4]; **deterministic
pre-D16 non-mundane rule** — any inventory entry carrying `stats` or `effect` fields rejects as
non-mundane by construction, alongside the Continuity name gate [codex 5]; **`pinned`
precondition** — `reposition`/`scene_exit` reject while the target's `pinned` is active on the
tentative state unless cleared earlier in the array (ordering acceptance case added) [codex 6];
**participants are a live roster** — post-D7 `scene_exit` atomically removes the exiter from the
active roster (a declared cross-store write); last-opponent lifecycle consequences are D7-owned
[codex 7]; **readiness retired as mechanical state** — the legacy `equipped` field is declared
display-only; wielded-state becomes D16 item-record data with readiness ops as a future catalog
version, recorded in §6 [codex 8]; **§6 generalizes the frame exception** — any frame-composed
effect on an NPC outside `affirmedOpposed` (ally, neutral, bystander, help or hurt) is
inexpressible pending allegiance records, and E2 is scoped to party + affirmed-opposed [grok 1];
**mundane stack replenishment** — `item_gain` on a same-key match that passes the mundane gates
increments quantity by exactly one instead of rejecting; non-mundane matches still reject
[grok 3]; **one comparison key** — trim, collapse whitespace, NFC, Unicode case-fold — used for
collision, resolution, and conflict keys, with display form preserved [grok 4]; **fact
commitment scoped honestly** — among edge bands `fact_learn` is crit-success-only; discoveries
on other bands are reword-or-flavor, and routine fact commitment belongs to the ordinary path
(§6 entry) [grok 5]; **the neutral example fixed** and §2.3 notes the ordinary authorizer may
treat self-directed custody ops as neutral per §9's audit [grok 6].

### Round 6 — pinned `f35aa5936c082245217064bb0e33104d8a0ea96e` (draft r6)

Dispatch note: the first codex r6 run died silently ~15:03 when the ptk MCP server restarted
(reaping its background job); the owner's "is there actually a review running?" prompted the
check that found it. Re-dispatched under harness-tracked background execution (kill → notify);
grok's run had completed before the restart. Watcher lesson recorded: a grep-for-exit-marker
watcher cannot distinguish "running" from "killed"; reviewer dispatches now run harness-tracked.

#### grok — valid, SHA-matched, evidence-checked: **reopened** (2 HIGH / 4 MEDIUM)

1. HIGH — the §2.3 table documents name-key schemas for GATED:D16 durable ops that can never
   execute in any version (pre-gate they're gated; post-gate the transition says record refs).
2. HIGH — `item_transfer` valence undefined when an endpoint is a non-opposed NPC (gift to the
   bartender).
3. MEDIUM — LIVE `item_lose` can't spend effect-bearing consumables (the starter Recovery Patch
   carries `effect: heal_20`), gutting held-item loss coverage.
4. MEDIUM — `item_lose` on a stack: unit decrement vs whole-entry delete unspecified.
5. MEDIUM — quest/objective state (`quest_update` — live, mutable, every turn) has no verb and
   no §6 home.
6. MEDIUM — occupancy binding demands exact name equality while the rest of the system
   case-folds.

#### codex (re-run) — valid, SHA-matched, evidence-checked: **reopened** (4 HIGH / 1 MEDIUM)

1. HIGH — the Status hard-gates edge bands on D7 while §1.1/§3 permit pre-D7 shipping with the
   conservative false input — direct contradiction.
2. HIGH — the post-D16 NPC `item_gain` form is incoherent (mint vs transfer vs recover
   undefined; conflicts with "recorded items move only through transfer/drop/pickup").
3. HIGH — `item_gain` undefined when multiple legacy entries share one normalized key.
4. HIGH — the suggestion assembler is intentionally non-executable yet described substantively.
5. MEDIUM — allegiance *changes* (betrayal, defection) are neither an op nor a §6 entry.

#### Coder triage → r7

All 11 ADMITTED (no criticals this round — softest verdicts of the loop). r7 changes: **Status
contradiction resolved in favor of shipping** — edge bands gate on this chapter's acceptance
only; pre-D7 pricing follows §3's conservative rule [codex 1]; **GATED:D16 durable-item ops
documented with their post-D16 record-ref schemas only** — no name-key form of
transfer/drop/pickup/condition_shift is legal in any catalog version; name keys survive solely
in the LIVE lose/gain shapes [grok 1, codex 2 part]; **NPC-owner `item_gain` removed outright**
— NPC acquisition is transfer/pickup; gain mints/stacks mundane player items only [codex 2];
**`item_gain` matching totalized** — zero normalized matches mints, exactly one stacks if both
mundane gates pass, more than one rejects as ambiguous [codex 3]; **`item_lose` write rule** —
decrement by one, delete the entry at zero; post-D16 lost-holder described separately [grok 4];
**consumable carve** — an entry with `effect` but no `stats` may be lost/wasted as minor (the
effect never fires; Continuity's name gate still rejects unique/powerful names) [grok 3];
**`item_transfer` endpoints restricted** — any non-party endpoint outside `affirmedOpposed`
rejects `allegiance-unknown`; the four nets apply only to party/affirmed-opposed endpoints
[grok 2]; **§4 collapsed to its executable core** — normative contract is exactly (a) any shown
suggestion is pre-validated legal and (b) absence conforms; sources/selection demoted to
non-normative guidance; a substantive assembler is explicitly NOT this chapter's deliverable,
pending the recorded owner flag [codex 4]; **one comparison key everywhere** — §2.5/participant
binding adopts the same NFC/case-fold key as items [grok 6]; **§6 additions** — allegiance
changes (betrayal/defection → D8/D16) and quest/objective/act state (→ D15/outline + ordinary
path), with `quest_update` named a migration-target seam beside the §2.4 note [codex 5,
grok 5].

### Round 7 — pinned `c5eb86554f7bcd5a3e0b563391b4eb7dbad8dcf7` (draft r7)

#### grok — valid, SHA-matched, evidence-checked: **reopened** (2 HIGH / 2 MEDIUM)

1. HIGH — post-D16 `item_lose`/`item_gain` identity model internally inconsistent (name-key
   legacy forms vs record-id promises; hybrid LIVE/GATED availability by owner kind).
2. HIGH — strain's extra D5 gate has no validation-pipeline rejection point (availability is
   per-op only).
3. MEDIUM — `encounter_end` valence gloss says "driven off", smuggling an unledgerable party
   displacement.
4. MEDIUM — `fact_learn`'s memory write omits `turn_number`/`campaign_id` binding.

#### codex — valid, SHA-matched, evidence-checked: **reopened** (3 HIGH / 3 MEDIUM)

1. HIGH — no verb can commit an *ordinary* party location transition; E1/§9's "reuses the
   catalog wholesale" claim is therefore false as written.
2. HIGH — post-D16 loss cannot address durable loot once a character holds it (same identity
   inconsistency as grok 1).
3. HIGH — `item_condition_shift` has no valence for scene-held or `lost` records.
4. MEDIUM — temporary access-enabling scene changes (bridge, opened passage) neither expressible
   nor excepted.
5. MEDIUM — "driven off" contradiction (same as grok 3).
6. MEDIUM — typed integer refs (`character:<id>`, item ids, `affirmedOpposed`) silently expand
   Chapter 1's "exactly two numeric protocol identifiers" enumeration.

#### Coder triage → r8

All 10 ADMITTED (overlaps merged; zero criticals second round running). r8 changes: **one
post-D16 identity rule** — a durable-record loss form `{op:"item_lose", item: item-record ref}`
valid for any holder with the owner derived from the record; the name-key `{op, owner, item}`
form is explicitly the *legacy mundane-stack* loss; availability is redefined to attach to
**each documented schema form and enumerated parameter predicate**, not the bare op token — which
also gives strain its rejection point (`pool:"strain"` → `GATED:D5` even after D1b lifts, with a
§8 case) [grok 1/2, codex 2]; **ordinary party travel honestly scoped** — §6 gains "party
location transitions (ordinary travel)" (→ the location system / ordinary-action chapter,
D15/D16), and E1/§9 retract "wholesale reuse": the ordinary chapter reuses the vocabulary and
validation core and *extends* the catalog with ordinary-only verbs through versioning [codex 1];
**`item_condition_shift` restricted to actor-held records** (scene-held/`lost` reject) [codex
3]; **`passage` feature kind added** (temporary access enabled — bridge, opened way; must not
assert permanent layout or destinations; valence via the existing `works_against` composition,
cover-precedent) [codex 4]; **"driven off" removed** — lifecycle-true examples only, plus an
explicit rule that displacement wording rejects without an accompanying legal position/location
op [grok 3, codex 5]; **`fact_learn` memory fields pinned** (campaign from the transaction,
`turn_number` from the check's ledger turn; checkId linkage ledger-only) [grok 4]; **a second
declared Chapter 1 refinement** — effect target references (typed actor/item ids,
`affirmedOpposed`) are engine-issued reference tokens outside game arithmetic, refining Chapter
1's two-identifier enumeration at sign-off exactly like the annotation-shape refinement
[codex 6].

### Round 8 — pinned `de35fa574fc2bb33cd84f1401c3278ac93e38d29` (draft r8)

#### grok — valid, SHA-matched, evidence-checked: **reopened** (2 HIGH / 4 MEDIUM)

1. HIGH — scene-held durable `item_lose` has no frame valence (r8's "any holder" fix collided
   with the condition-shift restriction's own rationale).
2. HIGH — the shared validation core is annotation-bound: abilities have no `affirmedOpposed`
   carrier, so "only authorization differs" forks the validator.
3. MEDIUM — `item_gain` schema says `actor ref` while availability forbids NPC owners.
4. MEDIUM — NPC restraint/capture ("bind the defeated thug") has no verb and no §6 home.
5. MEDIUM — effect-bearing consumable *acquisition* (restock) is inexpressible and unexcepted.
6. MEDIUM — `neutral` valence expands Chapter 1's beneficial/adverse contract without a declared
   refinement.

#### codex — valid, SHA-matched, evidence-checked: **reopened** (4 HIGH / 3 MEDIUM)

1. HIGH — scene-held durable-item loss valence (same as grok 1).
2. HIGH — name-bound occupancy can alias distinct same-named actor ids (no per-campaign NPC name
   uniqueness).
3. MEDIUM — suggestion "prevalidation" demands text-coherence checks against text that does not
   exist yet.
4. HIGH — catalog-version pinning is ungated and mislabeled (D12 is threat currency; only D13 is
   versioning) with no storage contract.
5. HIGH — the ledger omits state-dependent pricing/valence results, so cleared-record costs are
   unauditable afterward — undermining the D2 trust-audit goal itself.
6. MEDIUM — NPC acquisition contradictions (`item_pickup` accepts NPC owners; "solely via
   transfer"; mundane NPC minting unexcepted).
7. MEDIUM — held-item charges/ammo/fuel are neither expressible nor excepted.

#### Coder triage → r9

All 13 ADMITTED. r9 changes: **durable `item_lose` restricted to actor-held records**;
scene-held destruction folds into §6's durable-destruction entry [grok 1, codex 1]; **the
opposition-affirmation requirement declared consumer-independent** — every frame-composed NPC
target needs a Continuity-emitted affirmation whatever the consumer; the annotation's third
field is the edge-band carrier, and each other authorizer must define its own (assigned to
D3/D5 / the ordinary chapter) [grok 2]; **`item_gain.owner` typed `character ref`** [grok 3];
**binding uniqueness doubled** — (normalized name, kind) must identify exactly one campaign
actor record AND exactly one occupancy row; either ambiguity rejects [codex 2]; **suggestion
prevalidation redefined** as mechanical eligibility (state, budget, computable valence), with
the full semantic core running after the Referee adopts and writes text [codex 3]; **catalog
versioning corrected to D13 and given a storage contract here** — a declared `catalog_version`
campaign field (required state addition), initial version `effects-1`, carried through
bundles/forks, changed only by explicit migrations [codex 4]; **executed effects are ledgered
with engine-stamped resolved metadata** — catalog version, weight class, point cost, effective
valence, resolved target ids, and the pricing-relevant prestate (e.g. a cleared record's
duration); model-emitted versions of those fields reject; recorded as part of Chapter 1
refinement 1 [codex 5]; **NPC acquisition wording fixed** (transfer *or pickup*; mundane NPC
minting → §6) [codex 6]; **§6 additions** — NPC restraint/custody, mechanical-consumable
restock (with the discrete-unit representation noted as the expressible footprint), and item
resource state (charges/ammo/fuel → D1b/D16) [grok 4/5, codex 7]; **third declared Chapter 1
refinement** — the valence domain becomes beneficial|adverse|neutral, neutral illegal in
edge-band authorization [grok 6].

### Round 9 — SPLIT (pin `dfd2ab3`)

**grok: ACCEPTED** — zero findings, evidence-checked, and the first
cold-implementer-executable TRUE of the loop. **codex: reopened, 4 HIGH.**

1. HIGH — the r8 `catalog_version` contract silently depends on pending D13: every existing
   campaign lacks the field, and no rule said what happens to them.
2. HIGH — executed-effect metadata had no serialization or identity-remapping contract;
   ledgered target ids are store-local autoincrements, while import/fork copy turn state
   verbatim → dangling refs by construction.
3. HIGH — intentional use of an effect-bearing consumable was inexpressible (`item_lose`
   required "effect never fires"), yet live data mints a Recovery Patch with `effect: heal_20`.
4. HIGH — the `item_gain` stacking predicate was not total over legacy inventory shapes
   (unknown keys, arbitrary `type`, malformed `quantity`).

#### Coder triage → r10

All 4 ADMITTED. r10 changes: **legacy sentinel rule** — new campaigns stamped `effects-1` at
creation; field absence *is* the pre-catalog sentinel; catalog execution fail-closed for
legacy campaigns pending D13; creation/import/export/fork carry the field or its absence
verbatim (fork never auto-migrates) [codex 1]; **persistence & identity contract** — exact
committed-effect field set, `affirmedOpposed` as an `npc:<id>` token array, all persisted refs
engine-issued typed tokens, and export/import/fork MUST remap every token under the bundle's
entity mapping, failing whole on unmappable tokens; the verbatim-copy import path is legal
only while no ledgered effects exist [codex 2]; **composed-pair consumable use** — the fired
effect rides the same annotation as its own first-class entry plus the `item_lose`, each
priced independently at full freestanding cost (conservative, mirrors the pre-D7 license
rule); the engine never parses legacy `effect` strings; dedicated item-sourced `item_use`
pricing added to §6 (D1b/D16) [codex 3]; **stack eligibility totalized fail-closed** — key
whitelist {name, type, description, quantity, equipped}, unknown keys reject, quantity absent
(=1, normalized) or positive safe integer, mundane gate over *stored* name/type/description;
no second-line fallback (would break `item_lose` unique-match) [codex 4].

### Round 10 — pinned `02d6e4586fb3984311d988457f4528c1af874aa8` (draft r10)

#### grok — valid, SHA-matched, evidence-checked: **reopened** (3 HIGH / 3 MEDIUM)

1. HIGH — the r10 composed-pair "intentional use" prose overclaims LIVE expressibility:
   `heal` is GATED, so the mixed-valence pair (beneficial fire + adverse loss) can never pass
   the single-valence edge bands on the current surface.
2. HIGH — post-D16 `item_gain` storage ("fresh engine-minted record id" on mint) contradicts
   the schema-versioning rule that live forms persist unchanged.
3. HIGH — models must emit engine-issued refs (`npc:44`, `item:<record id>`), but no contract
   says how the model ever *learns* those ids.
4. MEDIUM — the mundane-gate wording ("same §1 standard as `item_gain` names") re-applied to
   stored text would reject every legacy consumable whose description asserts mechanics
   ("Restores 20 Health Points."), hollowing out the Recovery Patch carve.
5. MEDIUM — `encounter_start` is vocabulary-present but license-unreachable in the modal case
   (2 points vs the standard-tier out-of-encounter budget).
6. MEDIUM — suggestion eligibility requires a computable band-legal valence, but frame
   valence for NPC targets depends on `affirmedOpposed` entries that may not exist yet.

#### codex — valid, SHA-matched, evidence-checked: **reopened** (4 HIGH / 2 MEDIUM)

1. HIGH — the LIVE consumable-use composition cannot pass edge-band authorization (same
   arithmetic as grok 1, demonstrated on the starter Recovery Patch).
2. HIGH — post-D16 stack and record identity rules cannot be implemented consistently:
   same-name gains incrementing a record's quantity fights "every item operation moves
   exactly one unit" and record-form ops that preserve/move *the* record.
3. HIGH — `scene_feature_clear` "removes the referenced feature record", destroying the
   identity §1.1's persistence contract simultaneously requires every executed effect to
   retain, serialize, and remap.
4. HIGH — LIVE legacy `item_lose` is not fail-closed over actual inventory shapes: the
   unknown-key/malformed-quantity rejections bound only `item_gain`, so loss-side matching
   ran over untrusted records.
5. MEDIUM — the feature-reference wire format is undefined (feature refs named only as "the
   id of a feature record", with no typed-token form like `character:<id>`).
6. MEDIUM — held-item capability changes (draw/stow/switch a wielded item) are neither
   expressible nor listed in §6's deliberate-exception list.

#### Coder triage → r11

All 12 ADMITTED — two cross-reviewer duplicates (grok 1 ≡ codex 1, grok 2 ≈ codex 2) → ten
distinct fixes. r11 changes: **intentional-use honesty** — declared NOT expressible on the
current surface *by valence arithmetic, not omission* (mixed-valence pair vs single-valence
edge bands); the all-adverse mishap pair is what LIVE carries; deliberate use is the ordinary
path (§9/D15) or D1b `item_use` (§6), and the composed-pair contract survives as the binding
template for whichever surface first carries it [grok 1 / codex 1]; **quantity-one registry
records** — declared for D16: record-ref ops move/degrade/destroy whole discrete units;
stacking/splitting/merging are mundane-list semantics that never enter the registry;
`item_gain` writes the mundane stack list only in *every* catalog version — durable records
are minted exclusively by engine flows (loot placement, import, D16 migration), never by this
op [grok 2 / codex 2]; **`scene_feature_clear` is a status flip** — records are never
deleted: `status: active|cleared` with `clearedBy`/`clearedTurn`, identity append-only,
tombstones export and remap, clear-on-cleared is an unresolvable reference (double-clear
guard) [codex 3]; **loss-side totalization** — fail-closed mirror of stack eligibility: key
whitelist ∪ {`effect`}, unknown keys reject pending D16, quantity absent (=1) or positive
safe integer, removes exactly one unit, malformed quantities reject before mutation
[codex 4]; **feature wire format** — `feature:<record id>` typed token naming an active
record, persisted state, remaps like every typed token [codex 5]; **held-item exception** —
item readiness/wielded state added to §6: legacy `equipped` is display-only and never
mechanical state; wielded state becomes D16 item-record data; readiness ops are a future
catalog version [codex 6]; **ref disclosure (normative)** — engine-stamped ref directory in
model context (party character ids, recorded NPCs at the location, layout area ids, active
feature records, item records once stores exist); the model never invents an id; refs
outside the directory reject as unresolvable; bare names never accepted in ref fields
[grok 3]; **mundane gate scoped to significance** — §1's mechanical-property rejection
governs model-emitted `item_gain` names only and is never re-applied to *stored* text; stored
mechanics are policed by the deterministic rules, never by re-parsing strings, so the
Recovery Patch carve survives [grok 4]; **`encounter_start` tiering declared deliberate** —
a priced consequence of Chapter 1, not an oversight: standard-tier out-of-encounter
annotation cannot flip a room hostile; escalation lives in extreme/legendary tiers, post-D7
in-encounter criticals, or GM-authored turn flow [grok 5]; **"computable" is restrictive** —
ops whose effective valence depends on not-yet-persisted inputs (declared judgments,
`affirmedOpposed` membership) are not suggestion-eligible; frame-composed NPC ops are
suggested only against NPCs already in the persisted `affirmedOpposed` set; assemblers never
guess opposition [grok 6].

### Round 11 — pinned `5c287cdbc1c3e8a85cf381ae49aa35bb4b2b728d` (draft r11)

#### grok — valid, SHA-matched, evidence-checked: **reopened** (2 HIGH / 2 MEDIUM)

1. HIGH — §6 calls §2.3's composed pair "the LIVE interim" for item use while §2.3 itself
   declares intentional beneficial use NOT expressible on the current surface, and the only
   concrete edge-band-legal mishap example rides `harm`, which is GATED:D1b end-to-end.
2. HIGH — the ref directory is location-scoped ("recorded NPCs at the current location")
   while §2.4 disposition says it "may target any recorded NPC" — and the engine has no
   normative definition of NPC location membership at all.
3. MEDIUM — recoverable scene custody of stack-list inventory has no op (`item_drop` is
   record-ref only, GATED:D16; no name-key form is ever legal) and was absent from §6's
   deliberate-exception list.
4. MEDIUM — suggestion eligibility depends on a multi-turn `affirmedOpposed` set with no
   store contract: no aggregation rule (union vs latest), no lifecycle, no campaign or
   scene store.

#### codex — valid, SHA-matched, evidence-checked: **reopened** (1 CRITICAL / 3 HIGH / 3 MEDIUM)

1. CRITICAL — failure-band flavor can commit a new fact without a ledgered effect:
   `fact_learn` is the canon-commitment verb (beneficial-only), yet §2.8 permitted "you
   still notice the hinge is backwards" as failure-band flavor with no memory write while
   resolution §1.5 makes annotation text binding narrative canon.
2. HIGH — §1.1 step 2 rejects any array whose final tentative state equals its starting
   state; an empty array necessarily satisfies that, contradicting §8 example 1's legal
   `effects: []` and resolution §1.5's flavor-only guarantee.
3. HIGH — persisted area targets carried only a bare within-location area id, lacking the
   location identity §1.1's exact-persisted-references and export/import/fork remapping
   require.
4. HIGH — `passage` was defined as enabling crossing/entry, but the feature record has no
   source, destination, or exit reference: it cannot encode the connection its semantics
   claimed to create.
5. MEDIUM — ref-directory rule vs "any recorded NPC" disposition targeting (≡ grok 2).
6. MEDIUM — the D2 decision describes scene-derived suggestion candidates; §4 declared no
   substantive assembler deliverable, making the suggestion feature unimplementable from
   the normative contract alone.
7. MEDIUM — common multi-unit inventory rulings ("you recover three torches") neither map
   to the one-unit ops nor appeared in §6's deliberate-exception list.

#### Coder triage → r12

All 11 ADMITTED — one cross-reviewer duplicate (grok 2 ≡ codex 5) → ten distinct fixes.
r12 changes: **no LIVE interim for intentional use** — §6 states it outright: §2.3's
composed pair is mixed-valence and Chapter 1's single-valence edge bands cannot carry it;
deliberate use is inexpressible until D1b (reword to the ordinary path, §9/D15); the
composed-pair shape survives today only as the all-adverse mishap, and remains the binding
template for whichever surface first carries intentional use [grok 1]; **directory-scoped
disposition** — §2.4: fixed valence relaxes *opposition*, never *resolution* — the npc ref
must resolve inside the turn's stamped ref directory like every other actor ref; "word of
this reaches Lady Voss" is an off-screen disposition change, now a named §6 entry riding
the D16 movement seam [grok 2 / codex 5]; **stack-unit custody honesty** — new §6 entry: a
mundane stack unit has exactly two ledgerable states (held, or gone-from-play via priced
`item_lose`); recoverable parting is inexpressible today — possession-neutral readiness
texture or commit the loss; scene custody arrives with D16 record identity [grok 3];
**opposed-set projection defined** — the suggestion-time opposed set is defined, not
implementer-chosen: the union of persisted `affirmedOpposed` arrays across annotations
committed since the campaign's current-location pointer last changed (the same v1 scene
proxy conditions and scene features already use), restricted to targets that still
reference-resolve; an implementation that does not compute the projection must treat the
set as empty, never guess [grok 4]; **flavor-canon boundary** — a *novel* discovery inside
failure-band texture must be reworded away: there is no flavor channel for new facts
(binding text with no memory row is an unledgered canon commitment); flavor may restate
established truths only; new §6 entry + §2.8/E2 wording [codex 1]; **empty array exempt** —
§1.1's wholesale no-op rejection catches only non-empty self-cancelling arrays;
`effects: []` is the flavor-only annotation and is always legal (§8 example 1, resolution
§1.5) [codex 2]; **location-qualified area identity** — persisted area targets carry the
location component stamped from the turn's location pointer; it remaps like any record id,
and §2.7's stored `location` field must equal the token's location component [codex 3];
**`passage` is texture, not topology** — it creates no exit, edits no layout, and gates no
`reposition` (§2.5 binds occupancy and conditions, never topology); actual new
exits/destinations stay §6-inexpressible [codex 4]; **assembler minimalism is the
contract** — §4 keeps the D2 wording ("complication SUGGESTIONS, maybe") as a deliberately
minimal reading with an explicit owner sign-off flag for a *guaranteed* substantive
feature; absence conforms; everything beyond eligibility is non-normative guidance
[codex 6]; **one unit per name per annotation** — new §6 entry: the stack rule plus
one-conflict-key-per-(owner, name) means an annotation ledgers at most one unit per item
name; narrate the single unit actually moved, or spread acquisition across turns;
post-D16, plural movement of *recorded* items is multiple record-ref entries with distinct
conflict keys [codex 7].

### Round 12 — pinned `89ba8be7c1e2f0485341f411ff5d0679f51ddabf` (draft r12)

Both verdicts valid, SHA-matched, `evidence_checked: true`,
`cold_implementer_executable: false`. **Triage is IN PROGRESS — no r13 edit is applied yet.**
Verification notes below are this session's, not a reviewer's.

#### grok — **reopened** (1 CRITICAL / 1 HIGH / 2 MEDIUM)

1. CRITICAL — §3's pre-D7 parenthetical ("critical bands and extreme/legendary tiers still
   raise it to `minor`") caps the ladder one step below Chapter 1: with encounter-active
   false, base `flavor_only` +1 critical → `minor` +1 extreme/legendary → **`significant`**.
   §2.8 already says extreme/legendary criticals "do reach significant/2" and §8's recap
   restates the real stacking, so §3 contradicts both and the signed Chapter 1 §1.5.
   *Confirmed against effects.md L558 vs L478 vs L780–782.*
2. HIGH — §4 clause 1 both forbids and allows judgment-bearing ops: an op whose valence
   depends on a declared judgment (`quality`/`works_against`/`outcome`) "has no computable
   valence and is **not eligible**", yet the next sentence says frame-composed NPC ops in the
   projection "may appear" — and `reposition`/`scene_exit`, `scene_feature_*`, `encounter_*`
   always carry exactly those fields. *Confirmed: L582–585 vs L591–592.*
3. MEDIUM — §8 examples 3 and 4 assert legal `disposition_worsen` with only tier/license
   setup, omitting the directory/occupancy precondition r12's §2.4 now requires (example 6
   states its preconditions). *Confirmed: L799–807 vs L364.*
4. MEDIUM — §1's ref-disclosure prose points occupancy binding at "§2.3's comparison keys"
   and calls "the comparison-key rule in §2.3" an occupancy-binding rule; §2.3 is Items and
   wealth. The comparison key is defined in §1 and occupancy binding in §2.5.
   *Confirmed: L124 and L129 vs L86 and L389.*

#### codex — **reopened** (1 CRITICAL / 3 HIGH / 4 MEDIUM)

1. CRITICAL — flavor/prose can still move mechanically relevant NPC state: §2.4 offers
   "flavor" for "the enemy now fears you" and §6 calls allegiance changes "prose-only",
   but those facts feed Continuity's `affirmedOpposed` set and therefore later valence and
   suggestions — an unledgered canon commitment r12's own flavor-canon boundary forbids.
   *Confirmed: L373 and L651 vs E2 L52–53 and the r12 §2.8 rule at L496–500.*
2. HIGH — `fact_learn` is LIVE but its novelty check is unenforceable: §2.8 requires
   Continuity to reject already-established facts while admitting retrieval is a bounded
   window and deferring a stronger contract to §9; once a fact leaves the window a duplicate
   inserts a fresh row and passes the no-op rule.
3. HIGH — `catalog_version` conflates catalog pinning, rules enablement, and dependency
   activation: new campaigns are stamped `effects-1` and absence disables execution, yet
   gated forms activate when dependencies ship *and* adding operations is a version change;
   rules_mode=false still exists for new campaigns and D13 is pending.
4. HIGH — the D16 item-record ops are called executable but the record schema is never
   declared (holder, area, class, condition, provenance, `lost`), and §1's directory says
   only "referenceable item records" — circular.
5. MEDIUM — availability-before-schema cannot dispatch `item_lose`'s overloaded `item`
   field: no discriminator precedence or reserved-prefix rule, and hybrid payloads are
   undefined.
6. MEDIUM — no suggestion assembler is derivable from §4. **Likely DISPUTE**: this is the
   deliberate de-scope carrying an explicit owner sign-off flag, and codex's own r2 finding 9
   was resolved this way (partial dispute recorded at r4). Confirm against that trail before
   admitting.
7. MEDIUM — r12's opposition projection goes stale *within* a location: an encounter can end
   or an NPC surrender while `current_location_id` is unchanged, so the union keeps
   suggesting hostile ops against a reconciled NPC.
8. MEDIUM — GM-natural rulings outside both the ops and §6: same-item compound changes
   ("the blade chips and falls from your hand") collide on one conflict key, and action
   economy (lose your next action, initiative) is absent from §6 though §9 names initiative
   D7 scope.

#### Coder triage → r13 — COMPLETE (11 admitted+fixed, 1 partial dispute)

All line refs below are r13 (working tree) unless marked r12.

**grok:**

1. CRITICAL — **admitted, fixed.** §3's pre-D7 parenthetical rewritten to restate the real
   Chapter 1 §1.5 stacking: encounter-active false + critical band + extreme/legendary tier
   reaches `significant`; the parenthetical no longer caps one step below. Now agrees with
   §2.8 and §8's recap.
2. HIGH — **admitted, fixed** (clarification, not redesign). The two sentences were
   reconcilable but never composed: projection membership supplies only the *frame* valence
   input, while forms carrying declared-judgment inputs (`reposition`/`scene_exit`
   `works_against`, `scene_feature_*` judgments, `encounter_*` `outcome`) stay ineligible even
   against a projection member. §4 clause 1 now states both legs apply together and names the
   judgment-free NPC-target candidate forms (`harm`, `disposition_*`, condition ops).
3. MEDIUM — **admitted, fixed.** §8 examples 3 and 4 now state their directory/occupancy
   preconditions explicitly, matching example 6's pattern and §2.4's r12 requirement.
4. MEDIUM — **admitted, fixed.** §1's ref-disclosure prose now points the comparison key at
   §1's own definition and occupancy binding at §2.5; the stray "§2.3" attributions removed.

**codex:**

1. CRITICAL — **admitted, fixed** (two legs). §2.4's stance guidance no longer offers bare
   "flavor" for opposition-relevant facts: any wording that would feed `affirmedOpposed` or
   later valence must either be ledgered through an op or be reworded to restate only
   already-established truths. §6's allegiance bullet no longer calls side-switches
   "prose-only": a defection asserted in binding text is exactly the unledgered canon
   commitment §2.8 forbids; until D8/D16 the change is reworded away, expressible footprint
   `disposition_*` + `crit_success` `fact_learn`.
2. HIGH — **admitted, fixed.** `fact_learn` novelty: the check is now scoped to the
   retrieval window and named a *dedup guard, not a novelty guarantee*; a
   window-escaped duplicate row is defined as harmless (facts are idempotent canon,
   duplicates confer no mechanical advantage) and the stronger contract stays §9/D14 scope.
3. HIGH — **admitted, fixed.** `catalog_version` responsibilities split and stated where the
   stamp is defined: the stamp pins the *catalog document version* only; form availability is
   governed solely by per-form gates (dependency-keyed), so gated forms activating when a
   dependency ships is not a version change, while adding/removing/redefining forms is;
   absence-disables-execution restated as the campaign-level kill switch, D13 noted pending.
4. HIGH — **admitted, fixed.** D16 item-record schema declared as a normative minimum
   (id, `name`, holder-or-area location, class, condition enum, provenance, `lost` flag)
   next to the loot requirement; §1's directory language now points at that declaration
   instead of the circular "referenceable item records".
5. MEDIUM — **admitted, fixed** in the same block: `item` field dispatch gets a declared
   precedence — record id resolves first iff it matches the stamped id shape, else
   holder-inventory name key; hybrid payloads rejected as ambiguous rather than guessed.
6. MEDIUM — **partial dispute, recorded** (matches the r2-finding-9 → r4 trail): the absent
   assembler is the deliberate, owner-flagged de-scope; §4's two executable clauses and the
   sign-off flag stand. No edit beyond the r13 clarifications already made for grok 2 /
   codex 7. Reviewer instructed to carry it as disputed-by-design, not reopen-worthy,
   absent new evidence.
7. MEDIUM — **admitted, fixed.** §4's projection gains a per-target reconciliation trim:
   an NPC drops when a later committed annotation records reconciliation
   (`disposition_improve` toward them; post-D7 `encounter_end` scope), decidable from
   persisted rows; fled NPCs already drop via reference resolution; residual unledgered
   staleness explicitly bounded — projection gates suggestions only, full §1 validation and
   Referee choice still stand between a stale suggestion and the ledger.
8. MEDIUM — **admitted, fixed** (two legs). Conflict keys: `item_condition_shift` moved to
   its own (item, "condition") axis, so "chips *and* falls from your hand" ledgers as
   `[item_condition_shift(degrade), item_drop]` without collision; possession ops keep the
   shared (item, "possession") key and every dependent passage (§2.3 multi-unit rule, §8
   evaluator cases) still holds. §6 gains an **action economy and turn order** bullet:
   no turn machine or action tokens in v1, D7 scope per §9, expressible footprint
   `hindrance_apply` condition texture; skipped/granted/reordered turns may never be
   asserted as mechanical fact.

Also fixed (session-noted, unflagged): Status block updated **DRAFT r10 → DRAFT r13** with
the r10–r12 reopen history folded into the trail sentence.

### Round 13 — pinned `507475ec404035836f3345d10c3d1ec326ab8669` (draft r13)

Owner direction: codex MCP only, conservative single pass — "use codereview with codex mcp.
review conservatively. no need to burn tokens on ever slice." No grok dispatch this round.
Verdict valid, SHA-matched, `evidence_checked` across 8 ranges (effects.md §0–§9 whole-file,
resolution.md, `.agents/decisions.md:1060-1152`, rules-system-plan-intake),
`cold_implementer_executable: false`.

#### codex — **reopened** (1 HIGH / 2 MEDIUM)

1. HIGH — §1.1 and §2.3's versioning rules conflict: §1.1 says `effects-1` already contains
   every gated form and lifting D16 activates those forms without a version change; §2.3's
   schema-versioning note instead says "the version bump adds the record-ref ops".
   Implementers cannot determine whether existing `effects-1` campaigns receive D16 forms
   automatically or require migration. *Confirmed: L225–237 vs L380–385.*
2. MEDIUM — the durable-item lost state has incompatible representations: `item_lose` said
   the record persists "with holder `lost`" (a literal holder value), while the required
   item-record interface restricts `holder` to exactly one of an actor ref or a
   location-qualified area and separately declares a `lost` flag.
   *Confirmed: L288–300 vs L371–375.*
3. MEDIUM — §8 example 7 promises full executable payloads, but the `allegiance-unknown`
   `reposition` case omitted the required `area` field behind an ellipsis; schema validation
   precedes valence authorization, so the shown payload would reject for malformed shape,
   never reaching the gate it illustrates. *Confirmed: L860–867 vs L914–916.*

#### Coder triage → r14 — COMPLETE (3 admitted+fixed, 5 edits)

1. HIGH — admitted, fixed. §2.3's schema-versioning note now states the D16 gate lift
   activates the already-pinned record-ref forms with **no** `catalog_version` change
   (§1.1's three axes); the live `item_lose`/`item_gain` shapes are never rewritten.
   Existing `effects-1` campaigns therefore receive the forms at gate lift; no migration.
2. MEDIUM — admitted, fixed via the **flag** leg (opposite of codex's minimal suggestion,
   which would have widened the holder union with a literal): `lost` stays a flag and the
   holder union is unchanged. Three edits — the `item_lose` table row and the custody prose
   now read "persist out of play with the `lost` flag set and full provenance", with the
   holder field retaining its last value; a `lost` record is out of play, never
   directory-referenceable, and every record-form op rejects it; the record-interface
   paragraph now defines directory-referenceable as "iff `lost` is unset and" the existing
   holder/area test.
3. MEDIUM — admitted, fixed. Example 7's `reposition` payload now carries `area:"cellar"`
   (destination valid and distinct from the NPC's current area), so the shape passes and
   missing `affirmedOpposed` membership is isolated as the sole rejection cause.

Effects.md Status block bumped **DRAFT r13 → DRAFT r14** with the r13 codex-only pass noted
in the trail sentence.

### Round 14 — pinned `91f851936a0d6fd98adce92d51bbf7b1147fb824` (draft r14)

Owner direction unchanged (codex MCP only, conservative single pass). No grok dispatch.
Verdict valid, SHA-matched, `evidence_checked` across 6 ranges (effects.md §0–§9 whole-file,
resolution.md full chapter, `.agents/decisions.md:1043-1152`, rules-system-plan-intake,
this review doc's Rounds 12–14 incl. the standing §4 dispute),
`cold_implementer_executable: false`. Second consecutive round with zero CRITICAL/HIGH; the
§4 assembler de-scope dispute was carried, not reopened.

#### codex — **reopened** (1 MEDIUM)

1. MEDIUM — §4 clause 1's suggestion-eligibility examples contradict the operation schemas
   and the computable-valence rule on three legs: it named `works_against` as
   `reposition`/`scene_exit`'s judgment field (the schema field is `quality`, L428–429);
   it classified every `scene_feature_*` form as judgment-dependent although
   `scene_feature_clear`'s valence is engine-computed from the stored record (L476,
   L493–495); and it offered `harm` and `disposition_*` as frame-composed NPC candidates
   although `harm` is character-only (L270, L274) and disposition valence is fixed, not
   frame-composed (L401, L592). An assembler could not derive one consistent eligibility
   set from the clause. *Confirmed: L641–668 against the cited schema/valence lines — all
   three legs reproduce.*

#### Coder triage → r15 — COMPLETE (1 admitted+fixed, 1 edit)

1. MEDIUM — admitted, fixed in a single rewrite of the flagged sentence pair (§4 clause 1):
   the declared-judgment examples now read `reposition`/`scene_exit`'s `quality`,
   `scene_feature_place`'s `works_against`, `encounter_*`'s `outcome`; a new parenthetical
   permits `scene_feature_clear` whenever its `feature` ref resolves (valence
   engine-computed from the stored record, §2.7 — no judgment to wait on); and the
   NPC-candidate list is corrected to the genuinely judgment-free frame-composed forms —
   the §2.6 condition ops and `item_transfer` same-frame nets (§3) — with `disposition_*`
   noted as already eligible under the fixed-valence category and `harm` excluded as
   character-only (§2.1).

Effects.md Status block bumped **DRAFT r14 → DRAFT r15** (zero-CRITICAL/HIGH streak noted
in the trail sentence).

### Round r15 — repair-delta redispatch (codex, conservative) — REOPENED, then fixed

Narrow mandate: verify the r14 MEDIUM (R14-1) repair only, pins
91f851936a0d6fd98adce92d51bbf7b1147fb824 → 390981b37d98559cf39e3a701098d9d48f500a4b.
Guard proof at dispatch: revert→FAIL (all 7 assertions), restore→PASS (7/7).

#### Reviewer verdict — machine envelope, verbatim reason

REOPENED (1 finding, MEDIUM, on the repaired clause itself):

1. MEDIUM — "The corrected candidate set at docs/rules/effects.md:669-672 is still not
   schema-true: it limits judgment-free frame-composed NPC candidates to condition ops and
   item_transfer, but wealth_shift at docs/rules/effects.md:295 also targets an NPC, has
   mechanically determined up/down direction, and carries none of the declared-judgment
   inputs excluded at lines 641-666. It is GATED:D16 just like item_transfer, so when
   available against a projected NPC it is another eligible candidate under the §3
   composition rule."

#### Coder adjudication → r16 — COMPLETE (admitted; scope widened once, deliberately)

Admitted against the text: `wealth_shift` (L295) is npc-ref by schema, absent from §3
rule 6's fixed-valence list, judgment-free, GATED:D16 — both eligibility legs pass, the
enumeration omitted it. Adjudication also surfaced the same defect class one layer wider:
the §2.3 record-item ops (`item_pickup`/`item_drop`/`item_lose` record form/
`item_condition_shift`) take **actor** holders, so with an NPC holder they are equally
judgment-free frame-composed NPC candidates the list omitted. Fixed in one rewrite rather
than per-op drip: the clause now states the membership criterion as decidable from the
operation tables alone (no declared-judgment field **and** frame-composed valence per §3),
then enumerates the full current-catalog set — §2.6 condition ops, `wealth_shift` (§2.3),
`item_transfer` within its §3 rule-4 net domain, and the NPC-holder record-item ops — with
the party-holder reading routed to the party-frame category and gates left intact.

Effects.md Status block bumped **DRAFT r15 → DRAFT r16** (r15 reopen recorded in the trail
sentence; zero-CRITICAL/HIGH streak preserved).

#### Round r16 — repair-delta redispatch (codex, conservative) — CLOSED

Pins 390981b37d98559cf39e3a701098d9d48f500a4b → 786e8dac421d43ed602da218830024e40e9dd0de.
Guard at dispatch: 11 assertions, revert→FAIL (exactly the four new legs), restore→PASS.
Reviewer verdict (machine envelope): "closed", finding R15-1, reason empty; evidence spans
docs/rules/effects.md 1–15, 288–298, 454–460, 564–610, 638–685 — the widened enumeration
verified schema-true against the §2.3 table and §3 rules, no adjacent regression in the
touched surface. Chapter 2 stands at **DRAFT r16**, zero open findings, not yet owner-signed.

#### Round r17 — full-scope round on draft r16 — 1 CRITICAL admitted, fixed

Pins 786e8dac421d43ed602da218830024e40e9dd0de → 1523bfd5cbeb474e499bad362a8b6bf4319ab987.
Finding R17-1 (CRITICAL, admitted): `item_condition_shift` moved exactly one ladder rung,
the §1.1 conflict key admits at most one condition op per item per array, and §6 carried no
exception — so a compound GM-natural ruling ("the pristine sword snaps" → `broken`, three
rungs) was inexpressible, defeating E2's held-item-consequence promise and D16(d)'s
end-of-fight-condition loot requirement (intake L81). Fix, in place (§2 op-table row, §7 config
table, §8 evaluator cases): optional `to:` **target rung** — a ladder token, never a number
(enums-only invariant preserved); when present it must lie strictly beyond the current rung
in `direction` on the tentative state (equal/backward → strict-progress rejection); absent
keeps the one-step reading. Weight restated over the **result** rung (result `broken`:
significant; else minor), so multi-step pricing needs no new numbers; valence, gating
(GATED:D16), and the one-condition-op-per-item conflict key are unchanged — the compound
ruling is now a single op. Effects.md Status block bumped **DRAFT r16 → DRAFT r17**.

#### Round r17 — repair-delta redispatch (codex, conservative) — reopened LOW, trail corrected — CLOSED

Pins 786e8dac421d43ed602da218830024e40e9dd0de → 1523bfd5cbeb474e499bad362a8b6bf4319ab987.
Guard at dispatch: 6 assertions, revert-proxy (r16 pin) → all legs absent, restore → PASS.
Reviewer verdict (machine envelope): "reopen", finding R17-1, severity **LOW** — "the
mechanical repair closes R17-1", but this trail's entry mislabeled the touched sections
(config table and evaluator cases were each cited one section too high; effects.md numbers
them **§7** and **§8**), failing the
trail-to-delta match. Evidence spans docs/rules/effects.md 3–19, 83–125, 164–219, 291–397,
578–634, 725–860, 882–960; this trail 972–986; intake L81. Disposition: admitted — the
defect was in this trail file only, the draft is untouched; the entry above now reads
"§2 op-table row, §7 config table, §8 evaluator cases". Chapter 2 stands at **DRAFT r17**,
zero open findings against the draft text, not yet owner-signed.

#### Round r17 — redispatch closure (codex, conservative)
Reviewer re-ran the three checks against commit 883d33dc28f78b25f641a13160b96124c5903ca8 and
returned verdict **closed** on R17-1 with empty reason. Evidence spans: this trail 972–1000
(r17 entries cite §2 op-table, §7 config, §8 evaluator cases; zero §9 occurrences in the r17
scope), docs/rules/effects.md 266, 841, 882 (headings §2 Operations, §7 Config block,
§8 Worked examples), and git diff 1523bfd5cbeb474e499bad362a8b6bf4319ab987 --
docs/rules/effects.md exited 0 with both blobs at 6073df46a040bda57f7b89eb279d1ae7b96e0b04.
R17-1 is closed as a trail-only defect; the draft text was never touched by this finding.
Chapter 2 remains **DRAFT r17** — round r17 is closed with zero open findings, awaiting
owner sign-off before any status change beyond DRAFT.

#### Round r18 — full-scope round (codex, conservative)
Dispatched against pin 1523bfd5cbeb474e499bad362a8b6bf4319ab987 (DRAFT r17). Verdict:
**reopened**, evidence_checked true, cold_implementer_executable false, 2 findings.
- **R18-1 (MEDIUM, §1/§2.6/§6/§7)** — the NPC-injury boundary contradicted itself:
  `hindrance_apply` accepts any actor ref and §1 licenses "twisted ankle on the scree" as
  `hindered` color, while §6 declared injuring opposition "at all" inexpressible; a cold
  Continuity implementer could not decide pass-or-reject for injury-flavored NPC conditions.
  Evidence spans effects.md 85–88, 117–125, 457–475, 729–730, 863–874. Disposition:
  **admitted** — the §6 bullet is narrowed to *vital* injury (`harm`/`heal`, wounds, HP,
  dying, death) and now states the non-vital license explicitly (condition `detail` may carry
  injury-flavored cause inside the token's §7 must-not-assert boundary); §2.6's condition
  record prose gains the mirror sentence (NPC refs licensed, §6 gates only vitals).
- **R18-2 (MEDIUM, §1.1/§2.3/§6/§7)** — `wealth_shift` moved exactly one rung under a
  one-wealth-op-per-NPC-per-annotation conflict key, so a single-event multi-rung ruin
  (opulent → destitute) was inexpressible and §6 did not claim it as deliberate. Evidence
  spans effects.md 191, 301, 807–816, 835–850; intake L81 (D16(c) coarse wealth).
  Disposition: **admitted** — `wealth_shift` gains the same optional `to:` target-rung form
  the r17 fix gave `item_condition_shift`: enums-only, strict-progress in `direction` on the
  tentative state, one op under the existing (who, "wealth") key; weight rule is
  engine-owned — result rung at a ladder end (`destitute`/`opulent`) prices significant,
  else minor; §8 gains the paired evaluator cases (strict-progress rejection spans both
  ladders; opulent→`to: destitute` = one op, significant).
Both fixes applied in place; status block bumped **DRAFT r17 → DRAFT r18**. Zero open
findings against the draft text, not yet owner-signed.

#### Round r19 — full-scope round (codex, conservative)
Dispatched against pin 0f7d0447eed50b22f1d4a012d1d83abdbc6dbdae (DRAFT r18). Verdict:
**reopened**, evidence_checked true, cold_implementer_executable false, 2 findings.
- **R19-1 (MEDIUM, §4/§6)** — §4's projection-trim prose named "a surrender that was never
  ledgered by any op" as residual staleness, but an individual NPC's in-place capitulation
  (yielding while remaining present) was neither expressible (`disposition_improve` is
  attitude only, `scene_exit` requires leaving, `encounter_end` concludes the whole
  encounter) nor claimed by §6 as a deliberate exception — an undocumented gap the chapter
  itself referenced. Evidence spans effects.md 57–64, 512–523, 661–670, 794–796, 845–849.
  Disposition: **admitted** — §6 gains an "NPC standing down in place" bullet (future home
  **D7 per-participant status**, plus **D9/D11** for follow-on custody, mirroring the
  adjacent restraint entries), and §4's parenthetical now cites §6-inexpressibility instead
  of positing an unledgered event.
- **R19-2 (MEDIUM, §8)** — §8's preamble claimed "every effect is shown as its full
  payload," but the evaluator cases added in r17/r18 (and several older gate cases) use
  abbreviated forms (`wealth_shift{direction:"down", to:"destitute"}`, bare op tokens for
  gate rejections) that omit `op`/`who` and prestates — a self-contradiction a cold reader
  cannot resolve. Evidence spans effects.md 896–899, 940–972. Disposition: **admitted** —
  the claim is rescoped: shape-testing cases remain full payloads; gate, pricing, and
  conflict-key cases use a stated section-local abbreviation whose omitted fields are
  well-formed and irrelevant to the tested outcome, never a licensed wire shape.
Both fixes applied in place; status block bumped **DRAFT r18 → DRAFT r19**. Zero open
findings against the draft text, not yet owner-signed.

## Round r20 — repair-delta redispatch (codex, conservative) — REOPENED, then FIXED
- Pinned: 0ce2525b66bdba5335090f8c2671b86ac2180674 (draft r19)
- R20-1 (MEDIUM, admitted): §6 standing-down bullet listed "dropping weapons" as flatly
  inexpressible; post-D16 `item_drop` (holder: any actor, NPCs included) legally ledgers the
  physical relinquishment. Bullet narrowed to claim only the capitulation *status*, with
  `item_drop` named as a ledgerable neighbor ("ledgers the physical relinquishment only,
  never the yielding it dramatizes"). Draft r20.

## Round r21 — repair-delta redispatch (codex, conservative) — CLOSED, zero findings
- Pinned: 10eae8b44b2b3e2b5aea99009724d9832fb6456d (draft r20)
- Delta scope (r19 pin -> r20 pin) introduced no new contradictions; no admitted finding
  remains unfixed. Convergence signal — full-scope verification round r22 dispatched per
  contract before declaring the catalog converged.

## Round r22 — full-scope verification (codex, conservative) — REOPENED, then FIXED
- Pinned: b90cec437819631006e68a1f0e3b727eae6031a5 (draft r20)
- R22-1 (HIGH, admitted): §6 standing-down bullet said capitulation is `reword-or-flavor`,
  contradicting §2.4's stance rule (reword, never flavor — stance prose feeds opposition
  affirmation). Bullet now demands reword-away; §4's residual-staleness parenthetical
  updated to note neither ledger nor binding text can carry an in-place surrender.
- R22-2 (HIGH, admitted): §6 intelligence-state and absent-condition bullets plus the §6
  coverage-claim tail offered bare `let it be flavor`, contradicting E2's inert-flavor
  definition (no change to the body of established fact) and §2.8's ledger-or-reword rule.
  All three sites now confine flavor to restating already-binding truth and demand
  reword-away for any sentence asserting the unexpressible change.
- Draft r21.

## Round r23 — repair-delta redispatch (codex, conservative) — CLOSED, zero findings
- Pinned: b7ac73130fff9a73ea0933c969cd150e3488b11b (draft r21)
- Delta scope (r20 pin -> r21 pin) introduced no new contradictions; no admitted finding
  remains unfixed. Full-scope verification round r24 dispatched per contract.

## Round r24 — full-scope verification (codex, conservative) — REOPENED, then FIXED
- Pinned: b7ac73130fff9a73ea0933c969cd150e3488b11b (draft r21)
- R24-1 (HIGH, admitted): §2.3's registry-atomicity sentence said record-ref ops "move,
  degrade, or destroy **whole records**", contradicting the custody rule and §6, which
  make destruction of a durable record an inexpressible future op. Sentence now reads:
  a record-ref op acts on exactly one whole record and may move it, degrade it, or mark
  it `lost`, never delete it.
- R24-2 (HIGH, admitted): the "(pre-D16)"/"until D16 ships" qualifiers on the legacy
  mundane gates implied the gates lapse when D16 activates, though `item_gain` writes
  classless stack entries in every catalog version. Gates are now permanent per-form:
  name-key stack forms gate by Continuity + the deterministic `stats` rule in every
  catalog version (remediation is D16 migration, never erasure or time); class pricing
  is record-ref-only.
- Draft r22 (pinned 363b3abee8e002704492e9ce559cef180b5b46a1). Repair-delta redispatch
  round r25 dispatched per contract.

## Round r25 — repair-delta redispatch (codex, conservative) — CLOSED, zero findings
- Pinned: 363b3abee8e002704492e9ce559cef180b5b46a1 (draft r22)
- Delta scope (r21 pin -> r22 pin) verified both R24 fixes present and complete; no new
  contradictions introduced; no admitted finding remains unfixed. Envelope valid,
  SHA-matched, evidence_checked: true, cold_implementer_executable: true. Convergence
  signal — full-scope verification round r26 dispatched per contract.

## Round r26 — full-scope verification (codex, conservative) — REOPENED, then FIXED
- Pinned: 363b3abee8e002704492e9ce559cef180b5b46a1 (draft r22)
- R26-1 (admitted): the §2 gate preamble claimed every condition and feature token carries
  §7 canonical semantics, but §7's token-semantics table had no rows for ladder rungs.
  Preamble now reads "condition, ladder-rung, and feature token"; §7 gained semantics/
  overclaim rows for `pristine`/`worn`/`damaged`/`broken` and `destitute`…`opulent`.
- R26-2 (admitted): §2.3 non-recoverable partings did not state that destructive narration
  license differs by form. Now: the legacy stack form deletes the entry and only its text
  may narrate the unit destroyed; the record form (GATED:D16) marks `lost` and expresses
  loss from play, never cessation of existence; the future-op carve-out says "physical
  annihilation included".
- R26-3 (admitted): condition-record `source`/`clearedBy` were typed as `checkId`, minting
  a fake-check obligation for §5 ability and §9 ordinary-path consumers that commit under
  their own transaction ids. Now normative as "originating transaction id (§2.6)" here and
  in §2.7 — today's instance is the edge-band annotation's `checkId`.
- R26-4 (admitted): `fact_learn` pinned `turn_number` to "the check's ledger turn" and
  memory-row atomicity to per-`checkId`, assuming a check-based committer. Now "the
  committing transaction's ledger turn (the check's turn today)" and at most once per
  originating transaction.
- R26-5 (admitted): the fresh-council texture test classified manner color of the current
  row's resolved outcome as a novel fact (the derivability base omitted the check's own
  resolved row). Now: the base includes this check's resolved row; the test governs
  standing facts; manner color is restateable flavor that licenses nothing. The §8
  `disposition_worsen` example was reworded to drop an NPC-internal-state assertion
  ("suspicion hardens into certainty") accordingly.
- R26-6 (admitted): §6's inexpressible-futures enumeration lacked two entries now added:
  novel qualitative item properties/transformations (no store records them; reword or
  route through a verb; item property vocabulary is D16) and encounters beyond the §7
  `participants` cap (surplus staged as directory-present non-participants until D7).
- Severities per the r26 dispatch transcript; all six admitted, none contested. Draft r23
  (pinned fa80e2fc72fdd1397bf04e0c3a839e023bbd8478). Repair-delta redispatch round r27
  dispatched per contract.

## Round r27 — repair-delta redispatch (codex, conservative) — REOPENED, then FIXED
- Pinned: fa80e2fc72fdd1397bf04e0c3a839e023bbd8478 (draft r23)
- R27-1 (admitted): the r26-3/r26-4 fixes replaced `checkId` with a consumer-agnostic
  transaction *id*, but §1.1 step 5 still committed "atomically with the annotation" and
  the pinned turn fields (`appliedTurn`, `fact_learn` `turn_number`) still assumed a
  check-shaped committer. §2.6 now defines a full **originating transaction envelope** —
  a stable id plus the ledger turn the transaction commits on, normative for every record
  `source`/`clearedBy` field and every schema-pinned turn field; §1.1 step 5 commits
  inside the consumer's envelope (the annotation commit today); §9's carry-over names the
  adapter's own envelope explicitly.
- R27-2 (admitted): the fresh-council derivability base included "this check's own resolved
  row (band, quality, resolved effects)", but the Continuity texture pass runs while the
  annotation is still under validation — `quality` and the effect entries bind nothing
  yet. The base now names only the check's **already-resolved band** (the resolution fact
  Chapter 1 commits before the annotation is drafted), states the timing rule ("binds at
  the moment this pass runs"), and manner color is derivable from the band it renders.
- R27-3 (admitted): the §7 token-semantics table collapsed the wealth ladder into one
  `destitute` … `opulent` row whose semantics column ("material means at that station")
  restated the rung name and pinned nothing per token. The row is now five rows, one per
  rung, each with its own fictional meaning and the full must-not-assert boundary
  (purchasing arithmetic, party wealth, non-wealth capability) stated per row.
- Severities per the r27 dispatch transcript; all three admitted, none contested. Draft
  r24. Repair-delta redispatch round r28 dispatched per contract.

## Round r28 — repair-delta redispatch (codex, conservative) — CLOSED, zero findings
- Pinned: 6772d33ca2026bf14c26bf518a280b54e88e9061 (draft r24)
- Delta scope: fa80e2fc72fdd1397bf04e0c3a839e023bbd8478 (r23) -> 6772d33ca2026bf14c26bf518a280b54e88e9061 (r24)
- Reviewer verified SHA match and clean working tree before reading; `git diff --check` passed.
- R27-1 fix verified: §§1.1, 2.6, 2.7, 2.8, 9 plus all transaction/source/clearedBy/turn-field/checkId references — the originating transaction envelope consistently supplies provenance id and ledger turn without imposing a check-shaped committer anywhere.
- R27-2 fix verified: §2.8 checked against resolution.md's commit/annotation-validation order — only the already-resolved band binds during the Continuity texture pass; `quality`/effect entries do not. Prompt-context beliefs remain excluded; standing facts remain governed.
- R27-3 fix verified: five per-rung wealth rows checked against §2.3 `wealth_shift` and the §7 configured ladder — all rungs present in order, distinct fictional meanings, complete per-row must-not-assert boundary.
- No new contradictions in the status narrative, review trail cross-references, §2.7 record shape, or §9 carry-over.
- Verdict envelope: CLOSED, findings [], cold_implementer_executable true. Draft r24 stands. Review loop complete — chapter awaits owner sign-off.
