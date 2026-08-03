(() => {
  "use strict";

  const deepFreeze = (value) => {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
  };

  const fixture = {
    version: 1,
    character: {
      id: "fixture.character.rowan",
      name: "Rowan",
      summary: "A capable adventurer with three demonstration abilities."
    },
    scene: {
      gm: "The orc turns toward Rowan as the chamber falls quiet.",
      placeholder: "What do you do?"
    },
    families: [
      { key: "opportunity", label: "Opportunity" },
      { key: "command", label: "Command" },
      { key: "protection", label: "Protection" }
    ],
    abilities: [
      {
        id: "fixture.ability.backstab",
        name: "Backstab",
        trigger: "backstab",
        aliases: ["back stab"],
        familyKey: "opportunity",
        familyLabel: "Opportunity"
      },
      {
        id: "fixture.ability.rally",
        name: "Rally",
        trigger: "rally",
        aliases: [],
        familyKey: "command",
        familyLabel: "Command"
      },
      {
        id: "fixture.ability.protect-ally",
        name: "Protect Ally",
        trigger: "protect ally",
        aliases: [],
        familyKey: "protection",
        familyLabel: "Protection"
      }
    ],
    abilityHelp: {
      "fixture.ability.backstab": "Type “backstab” naturally or insert it at the caret.",
      "fixture.ability.rally": "A second single-word trigger demonstrates another family color.",
      "fixture.ability.protect-ally": "A multiword trigger demonstrates phrase recognition."
    }
  };

  globalThis.ABILITY_KEYWORD_COMPOSER_FIXTURE = deepFreeze(fixture);
})();
