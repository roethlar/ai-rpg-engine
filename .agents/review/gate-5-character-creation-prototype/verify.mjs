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
