import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

await import("./fixture.js");
await import("./matcher.js");
await import("./app.js");

const fixture = globalThis.ABILITY_KEYWORD_COMPOSER_FIXTURE;
const matcher = globalThis.AbilityKeywordMatcher;
const composer = globalThis.AbilityKeywordComposerApp;

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
const unchangedScan = scan(unchangedText);
assert.equal(unchangedText, beforeText, "scanning must preserve player prose byte-for-byte");

const submission = composer.createSubmission(unchangedText, unchangedScan);
assert.equal(submission.prose, unchangedText, "submission must preserve exact player prose");
assert.deepEqual(submission.abilityIds, ["fixture.ability.protect-ally"]);
assert.deepEqual(submission.matches, [
  {
    abilityId: "fixture.ability.protect-ally",
    start: unchangedText.indexOf("Protect Ally"),
    end: unchangedText.indexOf("Protect Ally") + "Protect Ally".length,
    spelling: "Protect Ally"
  }
]);

assert.deepEqual(composer.computeAbilityInsertion("I the orc", 2, 2, "backstab"), {
  text: "I backstab the orc",
  insertedText: "backstab ",
  selectionStart: 11,
  selectionEnd: 11
});
assert.deepEqual(composer.computeAbilityInsertion("I", 1, 1, "backstab"), {
  text: "I backstab ",
  insertedText: " backstab ",
  selectionStart: 11,
  selectionEnd: 11
});
assert.deepEqual(composer.computeAbilityInsertion("strike the orc", 0, 6, "backstab"), {
  text: "backstab the orc",
  insertedText: "backstab",
  selectionStart: 8,
  selectionEnd: 8
});
assert.deepEqual(composer.computeAbilityInsertion("", 0, 0, "protect ally"), {
  text: "protect ally",
  insertedText: "protect ally",
  selectionStart: 12,
  selectionEnd: 12
});

const typoText = "I bakcstab the orc.";
const typoSuggestion = scan(typoText).suggestions[0];
assert.deepEqual(composer.applySuggestionToText(typoText, typoSuggestion), {
  text: "I backstab the orc.",
  selectionStart: 10,
  selectionEnd: 10
});

const uiFiles = ["index.html", "styles.css", "app.js"];
const [htmlText, cssText, appText] = await Promise.all(
  uiFiles.map((file) => readFile(new URL(`./${file}`, import.meta.url), "utf8"))
);

for (const source of [htmlText, appText]) {
  assert.doesNotMatch(source, /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b/);
  assert.doesNotMatch(source, /\b(?:localStorage|sessionStorage|indexedDB|document\.cookie)\b/);
  assert.doesNotMatch(source, /\b(?:OpenAI|Anthropic|Claude|Gemini|AI_PROVIDER)\b/i);
}
assert.match(
  htmlText,
  /Content-Security-Policy[^>]+default-src 'none';[^>]+connect-src 'none';[^>]+object-src 'none'/
);
assert.match(
  htmlText,
  /src="fixture\.js" defer><\/script>[\s\S]*src="matcher\.js" defer><\/script>[\s\S]*src="app\.js" defer><\/script>/
);
assert.doesNotMatch(htmlText, /\son[a-z]+\s*=/iu, "HTML may not contain inline handlers");
assert.doesNotMatch(htmlText, /\sstyle\s*=/iu, "HTML may not contain inline styles");
assert.doesNotMatch(htmlText, /contenteditable/iu, "prototype must retain a native textarea");
assert.match(htmlText, /<textarea[^>]+id="action-input"/u);
assert.match(htmlText, /<label[^>]+for="action-input"/u);
assert.match(htmlText, /id="highlight-backdrop"[^>]+aria-hidden="true"/u);
assert.match(htmlText, /id="recognition-status"[^>]+role="status"[^>]+aria-live="polite"/u);
assert.match(htmlText, /id="debug-panel"[^>]+hidden/u);
assert.doesNotMatch(htmlText, /\[(?:backstab|rally|protect ally)\]/iu);
assert.doesNotMatch(htmlText, /<(?:select|fieldset)\b/iu);

const htmlIds = [...htmlText.matchAll(/\sid="([^"]+)"/gu)].map((match) => match[1]);
assert.equal(new Set(htmlIds).size, htmlIds.length, "HTML IDs must be unique");
for (const requiredId of [
  "transcript",
  "action-form",
  "composer-shell",
  "highlight-content",
  "action-input",
  "correction-button",
  "recognition-status",
  "send-action",
  "ability-list",
  "debug-panel",
  "debug-output"
]) {
  assert.ok(htmlIds.includes(requiredId), `prototype is missing #${requiredId}`);
}
assert.ok(
  htmlText.indexOf('id="action-input"') < htmlText.indexOf('id="correction-button"')
  && htmlText.indexOf('id="correction-button"') < htmlText.indexOf('id="send-action"'),
  "composer, correction, and Send must have logical source order"
);

assert.match(appText, /document\.createTextNode/u);
assert.match(appText, /highlightContent\.replaceChildren/u);
assert.match(appText, /playerText\.textContent = prose/u);
assert.doesNotMatch(appText, /\.innerHTML\b|insertAdjacentHTML/u);
assert.match(appText, /setRangeText\(insertion\.insertedText/u);
assert.match(appText, /compositionstart/u);
assert.match(appText, /compositionend/u);
assert.match(appText, /new URLSearchParams\(globalThis\.location\.search\)\.get\("debug"\) === "1"/u);

assert.match(cssText, /\.ability-highlight[\s\S]*border-bottom:/u);
assert.match(cssText, /\.family-label/u);
assert.match(cssText, /\[data-family="opportunity"\]/u);
assert.match(cssText, /\[data-family="command"\]/u);
assert.match(cssText, /\[data-family="protection"\]/u);
assert.match(cssText, /@media \(max-width: 760px\)/u);
assert.match(cssText, /@media \(prefers-reduced-motion: reduce\)/u);
assert.match(cssText, /:focus-visible/u);

for (const file of ["fixture.js", "matcher.js", "app.js"]) {
  const source = await readFile(new URL(`./${file}`, import.meta.url), "utf8");
  assert.doesNotMatch(source, /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b/);
  assert.doesNotMatch(source, /\b(?:localStorage|sessionStorage|indexedDB|document\.cookie)\b/);
  assert.doesNotMatch(source, /\b(?:OpenAI|Anthropic|Claude|Gemini|AI_PROVIDER)\b/i);
}

console.log("Ability-keyword composer verification passed.");
