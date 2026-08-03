# Ability-keyword composer prototype

This is a non-shipping, offline interaction artifact. It tests whether a player can invoke an owned
ability inside one ordinary prose submission without brackets or a second mechanics control.

AKC-1 provides the closed demonstration fixture and deterministic matcher. AKC-2 adds the browser
composer. Nothing here defines an approved class roster, rules system, production ability schema,
or server activation contract.

Run the focused verifier from the repository root:

```sh
node .agents/review/ability-keyword-composer-prototype/verify.mjs
```

The matcher recognizes only exact current-character triggers and curated aliases. Fuzzy spelling
recovery returns suggestions separately and never creates an ability invocation.

Open `index.html` directly in a browser. The page starts at the representative writing surface:

- type `I backstab the orc` to see exact inline recognition;
- type `I bakcstab the orc` to see a non-activating correction;
- click an ability card to insert its canonical words at the current caret; and
- add `?debug=1` to the file URL only when inspecting the derived IDs and text ranges.

The normal transcript receives plain prose only. Refresh clears it, and nothing leaves the browser.
