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
  "Two mechanical choices",
  "AI is not in this loop",
  "Unsupported is an honest result",
  "No model calls. No persistence. No hidden grants."
]) {
  assert.ok(html.includes(requiredCopy), `missing required copy: ${requiredCopy}`);
}

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
