// cr-1 guard check: extract resolveMyCharacter verbatim from a given app.js
// and simulate: two-char campaign, our char (7) released, member 9 remains.
// Sequence: resolve (stale claim) -> resolve again (the poll). The fix must
// leave identity unclaimed on BOTH; the bug claims member 9 on the second.
import { readFileSync } from 'fs';
const src = readFileSync(process.argv[2], 'utf8');
const start = src.indexOf('function resolveMyCharacter');
const end = src.indexOf('\n}', start) + 2;
const fnSrc = src.slice(start, end);

const store = new Map([[ 'aetheria_my_character_1', '7' ]]);
const localStorage = {
  getItem: k => store.has(k) ? store.get(k) : null,
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k)
};
const currentCampaignId = 1;
const myCharacterKey = id => `aetheria_my_character_${id}`;
let myCharacterId = null;
let resolveMyCharacter;
eval(fnSrc.replace('function resolveMyCharacter', 'resolveMyCharacter = function'));

const state = { party: [{ id: 9, name: 'Other' }] }; // our 7 is gone
resolveMyCharacter(state);   // first render after release
resolveMyCharacter(state);   // the next poll — where the bug bites
if (myCharacterId === null) {
  console.log('PASS: identity stays unclaimed after our character departed');
  process.exit(0);
}
console.log(`FAIL: browser claimed character ${myCharacterId} belonging to another player`);
process.exit(1);
