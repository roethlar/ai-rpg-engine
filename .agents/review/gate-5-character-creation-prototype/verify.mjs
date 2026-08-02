import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, css, script] = await Promise.all([
  readFile(new URL("./index.html", import.meta.url), "utf8"),
  readFile(new URL("./styles.css", import.meta.url), "utf8"),
  readFile(new URL("./app.js", import.meta.url), "utf8")
]);

assert.match(html, /<link rel="stylesheet" href="styles\.css">/);
assert.match(html, /<script src="app\.js" defer><\/script>/);
assert.match(css, /@media \(max-width: 760px\)/);
assert.match(css, /:focus-visible/);
assert.match(css, /prefers-reduced-motion/);

for (const helpId of [
  "context-help",
  "creation-help-slot",
  "progression-help-slot",
  "help-pin",
  "help-close",
  "mobile-help-toggle",
  "help-backdrop",
  "help-resource",
  "help-example",
  "help-limits"
]) {
  assert.match(html, new RegExp(`id="${helpId}"`), `missing rules-guide control #${helpId}`);
}

for (const helpStyle of [
  ".side-rail",
  ".context-help",
  ".context-help.is-mobile-open",
  ".mobile-help-toggle",
  ".help-backdrop.is-visible"
]) {
  assert.ok(css.includes(helpStyle), `missing rules-guide style: ${helpStyle}`);
}

assert.match(html, /aria-controls="context-help"/);
const htmlIds = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(htmlIds).size, htmlIds.length, "HTML ids must be unique");

let cssBraceDepth = 0;
for (const character of css) {
  if (character === "{") cssBraceDepth += 1;
  if (character === "}") cssBraceDepth -= 1;
  assert.ok(cssBraceDepth >= 0, "CSS closes a block before it opens");
}
assert.equal(cssBraceDepth, 0, "CSS blocks must be balanced");

assert.match(script, /const ABILITY_RESOURCE = \{\s*maximum: 6,\s*breatherRecovery: 2,\s*fullRecovery: "safe rest"\s*\}/);
assert.match(script, /genericTerms: \["Tempo", "Combat Form", "Weapon Mastery"\]/);
assert.match(script, /A basic \$\{terms\.primary\} costs 2 \$\{terms\.resource\}/);
assert.match(script, /Recover \$\{ABILITY_RESOURCE\.breatherRecovery\} \$\{terms\.resource\} after a breather/);
assert.match(script, /Spending \$\{terms\.resource\} does not create an extra action or reaction/);
assert.equal(
  (script.match(/Maximum(?: stored)? \{resource\} rises from 6 to 7\./g) || []).length,
  5,
  "every archetype level preview must use the shared starting capacity"
);
assert.doesNotMatch(script, /Maximum(?: stored)? \{resource\} rises from [23] to [34]\./);

for (const example of [
  "paladin-commander",
  "wizard-axe",
  "royal-inquisitive",
  "netrunner-billionaire",
  "battle-mage"
]) {
  assert.match(html, new RegExp(`data-example="${example}"`));
}

for (const requiredCopy of [
  "Archetype → Class → Character",
  "Choose an archetype",
  "Choose one special training",
  "Your title and standing never replace training or archetype progression."
]) {
  assert.ok(html.includes(requiredCopy), `missing required copy: ${requiredCopy}`);
}

for (const contextLeak of [
  "Gate 5",
  "evaluation artifact",
  "prototype",
  "AI is not",
  "model call",
  "engine record",
  "source ledger",
  "authoritative",
  "schemaVersion"
]) {
  assert.ok(!html.toLowerCase().includes(contextLeak.toLowerCase()), `player-facing context leak: ${contextLeak}`);
}

const playerCopy = `${html}\n${script}`.toLowerCase();
for (const implementationLeak of [
  "generic power",
  "universal power",
  "same power",
  "power stat",
  "alias for",
  "under the hood",
  "same resource with a different name"
]) {
  assert.ok(!playerCopy.includes(implementationLeak), `player-facing implementation leak: ${implementationLeak}`);
}

for (const campaign of ["Crownfall", "Neon Divide", "Starfall Reach"]) {
  assert.ok(script.includes(campaign), `missing campaign mapping: ${campaign}`);
}

assert.match(script, /mappings\(\)\.length > 1 \? "calling" : "character"/);
assert.match(script, /campaignMappings\.length === 1 \? campaignMappings\[0\]\[0\] : null/);

const visibleText = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
assert.doesNotMatch(visibleText, /\bcallings?\b/i);

for (const selector of script.matchAll(/querySelector\("#([a-z0-9-]+)"\)/g)) {
  assert.match(html, new RegExp(`id="${selector[1]}"`), `missing HTML id #${selector[1]}`);
}

for (const forbidden of [
  /\bfetch\s*\(/,
  /XMLHttpRequest/,
  /WebSocket/,
  /localStorage/,
  /sessionStorage/,
  /indexedDB/,
  /\/api\//
]) {
  assert.doesNotMatch(script, forbidden);
}

assert.doesNotMatch(html, /https?:\/\//);
console.log("Gate 5 character creation prototype verification passed.");
