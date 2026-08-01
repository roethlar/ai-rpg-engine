# pt-5: Campaign-tailored archetype description has no settled move boundary

**Severity**: MEDIUM — origin-campaign vocabulary can become stale player-facing identity or
leak into destination narration, depending on how later slices interpret the same frozen field.
**Status**: Admitted; design ruling not authorized
**Branch**: none
**Commit**: none — no repair or ruling started

## Evidence

- `.agents/decisions.md` says Creator writes a campaign-tailored description that may mention
  public profession names grounded in that campaign.
- `.agents/review/archetype-portability-matrix-v3.1.md:189-200` stores
  `archetypeDescription` on the persistent character beside stable `archetypeId` and
  `playerTitle`.
- `.agents/review/archetype-portability-matrix-v3.1.md:493-505` says the Creator writes the
  tailored description, then later moves read the approved record and never re-derive it.
- `.agents/review/archetype-portability-matrix-v3.1.md:681-707` requires the confirmed
  description to remain strictly unchanged across every move.
- `.agents/review/archetype-portability-matrix-v3.1.md` §9 defines stable archetype and title as
  narration authority and narrows the leak check to ability terms, but does not say whether the
  description enters Council context or later player-facing cards.

## Predicted observable failure

A character created in a cyberpunk campaign can carry a description containing a public local
term such as “netrunner” into a fantasy campaign. If S1.7 injects the description into Council
context, origin-campaign vocabulary becomes destination narration authority and the ability-only
leak guard does not catch it. If S1.7 excludes it, the unchanged description can still appear as
stale origin-campaign flavor on a sheet or move card. The current design permits both readings.

## What

The design simultaneously treats `archetypeDescription` as campaign-tailored presentation and
as immutable character identity without defining its post-move surfaces. Stable archetype ID and
player-owned title are settled; description scope is not.

## Approach

No repair is authorized. The owner must choose one coherent contract before S1.5: keep a stable,
genre-neutral description and explicitly bound its surfaces; store a separate per-campaign
description; or define another concrete boundary. Any choice must update §8.1, §8.5, §9, the
identity matrix, leak coverage, and the moved-character playtest together.

## Files changed

None — intake record only.

## Guard proof

Docs-only design finding. The reviewer traced the field from Creator output through the persistent
identity invariant and both possible later surfaces. No executable fix exists to guard yet.

## Known gaps

The Fable roster proposal produced in the follow-up codereview assumes a campaign-tailored
description but does not itself settle storage or post-move surfacing.

## Reviewer comments

- Reviewer: claude / claude-fable-5 / max / frontier (competitive; owner-selected)
- Openreview range: `9e4916d49cb052381f322e07d8714fdd88949076..810a008f2905bcaf8771d1fee3aef016d4bae6e1`
- Valid envelope UUID: `ef8f1e86-31b5-44e9-9688-a0c91fab827e`; exact SHAs matched and
  `capability_ok` was true.
- Verdict: candidate admitted at current-head intake.
