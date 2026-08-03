# Interaction-burden paired playtest harness

This is a local, non-shipping evaluation artifact for the owner-approved
Armsmaster/Adept interaction pilot. It is not part of the RPG runtime and does
not define final class, combat, or tier rules.

IBP-1 provides the immutable fixture and validator. The browser runner is the
separately planned IBP-2 slice and is not present yet.

The fixture holds the character, encounter, d100 math, result tapes, action
budget, objectives, and ordinary actions constant. Only free Forms versus
linked opening/flow/finisher techniques changes. Fixture-only numerical values
are pinned to the sources listed in `fixtures.js`; they are not adopted rules.

Run the focused validator from the repository root:

```sh
node .agents/review/interaction-burden-playtest-harness/verify.mjs
```

The artifact must remain offline and ephemeral. It may not call a model or API,
use browser persistence, parse prose into mechanics, or write playtest data to
the repository.
