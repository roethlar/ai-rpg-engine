# Ability-keyword composer prototype

This is a non-shipping, offline interaction artifact. It tests whether a player can invoke an owned
ability inside one ordinary prose submission without brackets or a second mechanics control.

AKC-1 provides the closed demonstration fixture, deterministic matcher, and focused verifier.
AKC-2 will add the browser composer only after AKC-1 is committed. Nothing here defines an approved
class roster, rules system, production ability schema, or server activation contract.

Run the focused verifier from the repository root:

```sh
node .agents/review/ability-keyword-composer-prototype/verify.mjs
```

The matcher recognizes only exact current-character triggers and curated aliases. Fuzzy spelling
recovery returns suggestions separately and never creates an ability invocation.
