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
