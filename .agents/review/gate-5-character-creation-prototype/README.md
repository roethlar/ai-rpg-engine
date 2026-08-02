# Gate 5 character creation prototype

This is a local, non-shipping evaluation artifact. Its player-facing flow is:

1. choose the mechanical archetype;
2. choose its campaign-specific class only when more than one is available;
3. choose training, background, standing, and identity separately.

Open `index.html` directly in a browser. It has no dependencies, model calls,
network requests, persistence, or connection to the shipped application.

The click-through includes:

- three campaign genres with zero, one, and multiple class mappings;
- automatic class selection when an archetype has only one campaign mapping;
- separate training, background, standing, and title choices;
- a persistent contextual rules guide that follows hovered or focused choices, can be pinned, and becomes a full-height mobile drawer;
- class-specific resource explanations with starting amount, ability costs, recovery, worked examples, and restrictions;
- concrete examples of what backgrounds, titles, command, institutional authority, and wealth do and do not provide;
- Paladin Commander, Wizard with battle axe, Royal Inquisitive, and Netrunner
  Billionaire examples;
- a Battle Mage path that requires an explicit archetype choice;
- normal archetype advancement and a costed multiclass alternative, including
  a campaign class choice when the new archetype has several mappings.

All mechanics, values, archetypes, genre classes, and packages are provisional. The
page uses player-facing language; review metadata remains in this README only.

Run `node verify.mjs` from this directory for the local structural and
no-network/no-persistence checks.
