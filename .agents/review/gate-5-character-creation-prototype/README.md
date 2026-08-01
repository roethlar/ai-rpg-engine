# Gate 5 character creation prototype

This is a local, non-shipping evaluation artifact. It demonstrates deterministic
character creation and progression without prose-to-mechanics inference.

Open `index.html` directly in a browser. It has no dependencies, model calls,
network requests, persistence, or connection to the shipped application.

The click-through includes:

- a quick path with two mechanical selections: class chassis and training package;
- identity, standing, assets, derived roles, and source-ledger separation;
- Paladin Commander, Wizard with battle axe, Royal Inquisitive, and Netrunner
  Billionaire examples;
- an ambiguous Battle Mage path that requires an explicit player choice;
- a normal class level and a costed multiclass alternative.

All mechanics, values, classes, and packages are provisional. The artifact is
for evaluating the interaction before any Gate 5 model or roster approval.

Run `node verify.mjs` from this directory for the local structural and
no-network/no-persistence checks.
