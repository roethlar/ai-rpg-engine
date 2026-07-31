# Rules-system plan intake — Claude

**Status**: Ready for owner decisions; no plan accepted and no implementation
authorized by this intake alone.
**Reviewer**: Claude Code 2.1.207 (`claude-opus-4-8`, high effort)
**Reviewed snapshot**: `526aa5c55d71a166690f71d07eea9366b50fd613`
**Completed**: 2026-07-11T19:34:04Z
**Input**: the handed-over `rulessystemsurvey.md`, repo guidance/decisions/plan,
and current implementation seams.

This was a read-only structured intake pass under
`.agents/playbooks/reviewloop.md`. The custom plan-intake schema returned
`ready_for_owner_decisions`: it is not the playbook's later `accepted` verdict
on a concrete plan. The plan must be written after the decisions below, then
re-reviewed against a pinned plan snapshot.

## Conclusions safe to plan from

- The engine owns every number, die, resource, condition, timer, and state
  transition. Models emit validated identifiers and enums, never arithmetic.
- D0 settled the overall frame: a versioned fixed house chassis plus generated
  campaign flavor. D1's resolution chapter and D2's effect catalog are owner-signed;
  D3's archetype boundary is the next owner decision.
- Chapter 2 r24 is the canonical effect-verb vocabulary. Generated abilities may
  select legal effects and supply flavor, but may not invent mechanics.
- Tactical positioning must be explicit engine state. The leading option is a
  zone graph over the existing location/occupancy layer.
- One player spend pool should fund push, assist, and resistance; HP and XP
  remain separate tracks. Optional GM threat currency is deferred by default.
- Old free-text campaigns cannot be truthfully auto-migrated. Chassis versions
  must be pinned per campaign and legacy bundle import must keep working.

## Admitted plan findings

| ID | Severity | Predicted observable failure | Required plan response |
|---|---|---|---|
| F1 | HIGH | "Tactical" combat remains narrated positioning, so prose and engine state disagree. | Settle zones versus grid and make adjacency/range/legality code-owned. |
| F2 | HIGH | A too-small effect enum breaks genre breadth; a loose one recreates prompt-trust. | Prototype a bounded effect catalog across fantasy, cyberpunk, social, and ranged examples before downstream work. |
| F3 | HIGH | Push, assist, PvP consent, and death choices block turns or resolve without the promised choice. | Build one restart-safe pending-choice protocol or remove mid-resolution choices from v1. |
| F4 | HIGH | Generated unique archetypes strand portable characters and late joiners. | Settle fixed versus generated archetypes and the portability mapping before character creation work. |
| F5 | HIGH | Old bundles either lose new state or import with abilities the enforced chassis cannot execute. | Pin chassis versions, preserve the v1 fixture, and choose a truthful legacy tier rather than guessing mechanics. |
| F6 | MEDIUM | HP, MP, stress, effort, fear, XP, and scars make the supposedly learnable system too fiddly. | Consolidate player-legible tracks; keep marks and GM-only state out of the spend economy. |
| F7 | MEDIUM | Keeping d20 by inertia bakes an untested probability curve into every later table and UI. | Decide the die before setting tiers, margins, damage, or the roll-record `sides` contract. |
| F8 | MEDIUM | Schema-valid model-generated enemy numbers still produce arbitrary encounter difficulty. | Let the model choose level/role/flavor only; derive stats from an authored curve. |
| F9 | MEDIUM | Reactions make sequential multiplayer stall; omitting them without replacement makes combat flat. | Set initiative and v1 reaction policy explicitly; source depth from within-turn choices. |
| F10 | MEDIUM | Undefined recovery either erases stakes or benches players, and async "rest" has no owner. | Define scene refresh, party rest, healing, and safe-haven/world-clock costs. |
| F11 | MEDIUM | A round-counted dying timer is ambiguous outside combat and unfair in async play. | Tie countdowns to an explicit actor/encounter timing rule and define noncombat 0 HP. |
| F12 | MEDIUM | Chassis updates silently change an in-flight campaign's canon rules. | Store a chassis id/version per campaign and keep old versions loadable or explicitly migrated. |
| F13 | LOW | Player-facing names bulk-copy distinctive vocabulary despite bespoke mechanics. | Run a house-vocabulary pass before strings ship. |
| F14 | LOW | The plan silently removes `rules_mode` even though its disposition is an open owner decision. | Keep freeform/legacy disposition explicit in the decision and migration plan. |

Evidence anchors: survey §§3 and 6; `.agents/decisions.md` rules reopen,
tactical-combat, portability, GM-authority, and licensing entries;
`rpg-state.js` (`validateRulesetData`, `validateRequiredChecks`, `rollCheck`,
`validateCampaignBundle`, `scopeStateForSeat`); `rpg-engine.js` campaign setup,
Council turn flow, turn ordering, and export/import; `db.js` character and
initiative fields; `map-render.js` location-area graph.

## Owner decision queue

Per the `plan` operator, present these in chat one at a time. Record the
owner-approved wording in `.agents/decisions.md` and the eventual plan status.

| ID | Decision | Reviewer recommendation | Status |
|---|---|---|---|
| D0 | Overall frame | Bespoke fixed chassis plus campaign flavor skins | **DECIDED 2026-07-12** — fixed house chassis + generated flavor skins; see `.agents/decisions.md`. Unblocks D1, D2, D4, D6, D11, D12, D14. |
| D1 | Dice engine | Keep d20, but prove the curve before wiring | **DECIDED 2026-07-16, then superseded same day** by the signed-off resolution chapter (`docs/rules/resolution.md` @ `8f7862d`): d100 meet-or-beat with licensed edge texture; die-agnostic core carries forward. See `.agents/decisions.md` sign-off entry. Unblocks D8. |
| D2 | Ability representation | Fixed effect catalog, genre-spread prototype first | **DECIDED 2026-07-16; CATALOG SIGNED OFF 2026-07-27** — complications are free text with optional contextual suggestions, never a fixed complication table; any mechanical consequence maps to an engine **verb** (state operation) from the deliberately wide, canonical Chapter 2 r24 catalog (`docs/rules/effects.md`). Model trust is tuned via the ledgered stakes license, never by unledgered effects. The catalog-document design gate is satisfied; rules code still requires a concrete phase and owner-approved plan. Unblocks D3, D5, D13. |
| D3 | Archetype boundary | Stable chassis archetypes, flavor-skinned | V3.1 portability plan drafted 2026-07-27 (`.agents/review/archetype-portability-matrix-v3.1.md`); v1, v2, and v3 retained as evidence. V3 replaced v2's mechanical-equivalence fingerprint with immutable mechanics plus per-campaign expression bindings; v3.1 fixed nine review findings against it. Awaiting the owner's first architecture ruling. D2 prerequisite is satisfied. |
| D4 | Attribute count | Keep STR/AGI/INT/WIL | Pending owner decision |
| D5 | Player spend economy | One Strain/Effort pool plus HP and XP | Ready — D2 catalog signed off 2026-07-27 |
| D6 | Tactical space | Zones over existing location occupancy | Pending owner decision |
| D7 | Initiative/reactions | Seed then fixed rotation; no v1 reactions | Pending D6 |
| D8 | Opposition | Model chooses level/role/flavor; engine derives stats | Pending D1 |
| D9 | Dying/death | Visible countdown plus player-chosen outcome | Pending D11 |
| D10 | Recovery | Partial scene refresh plus explicit party rest | Pending D5 |
| D11 | Mid-resolution choices | One offer/deadline/default state machine | Pending owner decision |
| D12 | GM threat currency | Defer until a feel experiment | Pending owner decision |
| D13 | Legacy/versioning/freeform | Legacy tier, pinned chassis, explicit `rules_mode` decision | Ready — D2 catalog signed off 2026-07-27 |
| D14 | CC0 balance shortcut | Allow WWN/CWN CC0 reference data | Pending owner decision |
| D15 | Outline divergence & re-planning | Owner-raised 2026-07-16 (F&F evidence: the GM refused an off-path attack on an "ally", then ended the encounter rather than adapt — the 3-act outline risks the same failure at campaign timescale). Required shape: split world-facts (canon) from plot-intentions (GM prep, never canon, injected as revisable); an invalidation-triggered forward re-outline step (played acts immutable, future acts regenerated from actual state, amendments ledgered); world momentum for wandering players (re-plan on invalidation, never on slowness). Additional owner evidence 2026-07-30 (from an earlier session, observed via the host-only outline diagnostics panel): the problem starts at *creation*, not first divergence — `getOutlineSystemInstruction` (`rpg-prompts.js:13`) authors acts II–III objectives and `key_events` before any player choice, and the GM instruction holds play "aligned with the current Act", so the blueprint assumes a path. Owner principle, stated verbatim: "campaign needs morph around player choices, not force them." Implies the initial outline must be authored as situations/pressures (opposition plan), never an event script; the re-outline step then handles drift. Principle is evidence, not yet a recorded decision; queue order unchanged by owner instruction 2026-07-30, reaffirmed 2026-07-31 with the ordering rationale: character-side correctness outranks campaign morphing — "I can test player mechanics on doomed campaign but experiencing whole multi-act campaign with broken character isn't fun" | Pending — interacts with D2 (disposition/encounter effects) and the pacing dials |
| D16 | Persistent NPC & durable world-state ("campaign static-states") | Owner-raised 2026-07-16. Goal: campaigns must feel alive and coherent to drive engagement — "this is hard, but it's the whole thing." Required shape: (a) **registry lifecycle** — NPCs invented mid-play and significant durable items get recorded rows; today NPCs enter the DB only at campaign creation and fork/import, and a turn `npc_updates` entry naming an unknown NPC is silently dropped (`rpg-engine.js:1791`), so improvised NPCs have no dossier, disposition, sticky voice, or anchor; (b) **location/movement** — the existing occupancy layer stays ("probably fine"); movement is **plausibility-bounded, not simulated**: each NPC's locomotion capability (who/what they are — teleporting wizard, jet-owning magnate, bartender) bounds where they may plausibly appear next, and an out-of-bounds appearance is legal only when the fiction earns it (they are following the party, or they are not who they seemed) — a continuity check, "realistic bounds based on who / what. that's all we really need"; (c) **wealth** — a coarse general wealth category per NPC, never itemized finances; (d) **loot** — NPCs carry concrete significant equipment: what an NPC visibly wields in an encounter must be lootable afterward **in its end-of-fight condition**, and items carry provenance, because encounter rewards drive character investment ("I got this light saber from that old guy on the desert planet" beats "5 gold pieces from the GM"); note today items exist only as the player's `inventory_json` — no item records, condition, or provenance anywhere | Pending — interacts with D2 (disposition/encounter/inventory verbs need recorded targets; loot drops and condition changes are catalog operations), D15 (world momentum), D8 (reward/opposition curve), D13 (bundle export/versioning of the new state) |

## Candidate implementation order from intake

This is evidence for the eventual plan, not a promoted phase:

1. Effect schema and validator.
2. Setup emits only validated ability instances.
3. Enum-only Referee envelope.
4. Code-computed outcome bands.
5. Engine-owned resources and conditions.
6. Public ruling/roll ledger and generalized die record.
7. Character creation menus.
8. Advancement menus.
9. Engine-validated zone positioning.
10. Combat initiative/action state.
11. Engine-filled opposition, reaction, and morale.
12. Pending choices plus dying/death.
13. Cooperation and PvP bright lines.
14. Chassis versioning, legacy migration, and bundle evolution.

The cold implementation pass must refine this into smaller vertical slices,
with a pure resolver/probability artifact before runtime wiring and explicit
UI, seat-boundary, tactical-map, export/fork, guard-proof, and playtest work.

## Reviewer comments

- The survey's code characterization is substantially correct. One stale
  phrase remains: current failed-check damage is Referee-adjudicated and
  clamped, not the old hardcoded penalty, except for a legacy replay seam.
- `validateCampaignBundle` has a migration seam but no migration body yet.
- Licensing does not gate mechanics-only synthesis. It still gates copied
  expression and coined vocabulary; CC0 WWN/CWN material is the clean shortcut.
- Exact currency values, tier numbers, archetype list, death options, and
  action-economy depth are game-design hypotheses until simulated and
  playtested; reviewer agreement is not evidence of feel.

