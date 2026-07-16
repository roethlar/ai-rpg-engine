# Effect catalog review (docs/rules/effects.md)

**Status**: OPEN — round 1 dispatched.
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
