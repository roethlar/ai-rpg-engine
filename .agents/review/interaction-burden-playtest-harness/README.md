# Interaction-burden paired playtest harness

This is a local, non-shipping evaluation artifact for the owner-approved
Armsmaster/Adept interaction pilot. It is not part of the RPG runtime and does
not define final class, combat, or tier rules.

IBP-1 provides the immutable fixture and validator. IBP-2 adds the offline
browser runner, instrumentation, neutral paired survey, local validation, and
explicit JSON download.

The fixture holds the character, encounter, d100 math, result tapes, action
budget, objectives, and ordinary actions constant. Only free Forms versus
linked opening/flow/finisher techniques changes. Fixture-only numerical values
are pinned to the sources listed in `fixtures.js`; they are not adopted rules.

Run the focused validator from the repository root:

```sh
node .agents/review/interaction-burden-playtest-harness/verify.mjs
```

Run the pilot by opening
`.agents/review/interaction-burden-playtest-harness/index.html` directly in a
browser. Do not start the RPG server or configure a provider. The page
deliberately resets on refresh and writes no session state outside page memory.
Complete all four runs and both paired surveys, then use **Preview and validate JSON**
before the explicit download.

The downloaded record contains anonymous fixture IDs, event timing, selected
engine-known action and target IDs, derived interaction metrics, closed survey
answers, declared confounds, and only a separately confirmed optional note. It
excludes typed intent, player identity, campaign data, and unconfirmed note
text. Keep raw JSON outside the repository.

The artifact must remain offline and ephemeral. It may not call a model or API,
use browser persistence, parse prose into mechanics, or write playtest data to
the repository.
