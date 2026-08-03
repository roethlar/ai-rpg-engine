import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

await import("./fixture.js");
await import("./matcher.js");

const fixture = globalThis.ABILITY_KEYWORD_COMPOSER_FIXTURE;
const matcher = globalThis.AbilityKeywordMatcher;

assert.ok(Object.isFrozen(fixture), "fixture root must be immutable");
assert.ok(Object.isFrozen(fixture.abilities), "fixture abilities must be immutable");
assert.deepEqual(
  Object.keys(fixture).sort(),
  ["abilities", "abilityHelp", "character", "families", "scene", "version"].sort()
);
assert.equal(fixture.version, 1);

const familyKeys = fixture.families.map((family) => family.key);
assert.deepEqual(familyKeys, ["opportunity", "command", "protection"]);
assert.equal(matcher.validateAbilityCatalog(fixture.abilities, familyKeys), true);

const scan = (text, abilities = fixture.abilities) => matcher.scanAbilityTriggers(text, abilities, {
  familyKeys
});

let result = scan("I BACKSTAB the orc.");
assert.deepEqual(result.abilityIds, ["fixture.ability.backstab"]);
assert.deepEqual(result.matches.map(({ abilityId, spelling }) => ({ abilityId, spelling })), [
  { abilityId: "fixture.ability.backstab", spelling: "BACKSTAB" }
]);

result = scan("I back stab the orc.");
assert.deepEqual(result.abilityIds, ["fixture.ability.backstab"]);
assert.equal(result.matches[0].canonicalTrigger, "backstab");
assert.equal(result.matches[0].spelling, "back stab");

assert.deepEqual(scan("I backstabbed the orc.").abilityIds, []);
assert.deepEqual(scan("I rallying everyone.").abilityIds, []);

result = scan("I rally, then protect ally, then rally again.");
assert.deepEqual(result.abilityIds, [
  "fixture.ability.rally",
  "fixture.ability.protect-ally"
]);
assert.equal(result.matches.length, 3);

const emojiText = "🗡️ Rowan will backstab now.";
result = scan(emojiText);
assert.equal(result.matches[0].start, emojiText.indexOf("backstab"));
assert.equal(result.matches[0].end, emojiText.indexOf("backstab") + "backstab".length);
assert.equal(emojiText.slice(result.matches[0].start, result.matches[0].end), "backstab");

const overlapAbilities = [
  {
    id: "fixture.ability.shadow",
    name: "Shadow",
    trigger: "shadow",
    aliases: [],
    familyKey: "opportunity",
    familyLabel: "Opportunity"
  },
  {
    id: "fixture.ability.shadow-step",
    name: "Shadow Step",
    trigger: "shadow step",
    aliases: [],
    familyKey: "opportunity",
    familyLabel: "Opportunity"
  }
];
result = scan("I shadow step behind it.", overlapAbilities);
assert.deepEqual(result.abilityIds, ["fixture.ability.shadow-step"]);
assert.equal(result.matches[0].spelling, "shadow step");

const onlyRally = fixture.abilities.filter((ability) => ability.id === "fixture.ability.rally");
result = scan("I backstab, then rally.", onlyRally);
assert.deepEqual(result.abilityIds, ["fixture.ability.rally"]);
assert.equal(result.matches[0].spelling, "rally");

result = scan("I bakcstab the orc.");
assert.deepEqual(result.matches, []);
assert.deepEqual(result.abilityIds, [], "a typo suggestion must never activate an ability");
assert.deepEqual(result.suggestions, [
  {
    start: 2,
    end: 10,
    replacement: "backstab",
    abilityId: "fixture.ability.backstab"
  }
]);

const ambiguousAbilities = [
  {
    id: "fixture.ability.backstab",
    name: "Backstab",
    trigger: "backstab",
    aliases: [],
    familyKey: "opportunity",
    familyLabel: "Opportunity"
  },
  {
    id: "fixture.ability.buckstab",
    name: "Buckstab",
    trigger: "buckstab",
    aliases: [],
    familyKey: "opportunity",
    familyLabel: "Opportunity"
  }
];
assert.deepEqual(scan("I bickstab now.", ambiguousAbilities).suggestions, []);

const duplicateTrigger = structuredClone(fixture.abilities);
duplicateTrigger[1].aliases.push("BACKSTAB");
assert.throws(
  () => matcher.validateAbilityCatalog(duplicateTrigger, familyKeys),
  /collides with an existing trigger or alias/
);

const duplicateId = structuredClone(fixture.abilities);
duplicateId[1].id = duplicateId[0].id;
assert.throws(() => matcher.validateAbilityCatalog(duplicateId, familyKeys), /duplicate ability id/);

const unknownFamily = structuredClone(fixture.abilities);
unknownFamily[0].familyKey = "invented";
assert.throws(
  () => matcher.validateAbilityCatalog(unknownFamily, familyKeys),
  /not in the closed family palette/
);

const bracketTrigger = structuredClone(fixture.abilities);
bracketTrigger[0].trigger = "[backstab]";
assert.throws(
  () => matcher.validateAbilityCatalog(bracketTrigger, familyKeys),
  /may not contain bracket command syntax/
);

const unchangedText = "I Protect Ally while Rowan says 🗡️.";
const beforeText = unchangedText;
scan(unchangedText);
assert.equal(unchangedText, beforeText, "scanning must preserve player prose byte-for-byte");

for (const file of ["fixture.js", "matcher.js"]) {
  const source = await readFile(new URL(`./${file}`, import.meta.url), "utf8");
  assert.doesNotMatch(source, /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b/);
  assert.doesNotMatch(source, /\b(?:localStorage|sessionStorage|indexedDB|document\.cookie)\b/);
  assert.doesNotMatch(source, /\b(?:OpenAI|Anthropic|Claude|Gemini|AI_PROVIDER)\b/i);
}

console.log("Ability-keyword matcher verification passed.");
