import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { authorClassScene } from './class-scene-author.js';
import { validateClassSceneFrame } from './class-scenario.js';

export async function runClassSceneAuthorTests() {
  const layout = { areas: [{ id: 'gate', name: 'Gate' }], features: [] };
  const actors = { player: { name: 'Mira', controlled: true }, npc0: { name: 'Keeper' } };
  const frame = { schemaVersion: 1, areas: [{ area: 'gate', terrain: 'dry_ground', traits: ['visible', 'safe'], surfaces: ['ground'] }],
    actors: [{ actor: 'player', area: 'gate', allegiance: 'party', profile: null, conditions: [] },
      { actor: 'npc0', area: 'gate', allegiance: 'party', profile: 'support', conditions: [] }],
    items: [], objects: [], features: [], discoveries: [], encounter: { active: false, opposition: [] } };
  const options = { narrative: 'The keeper waits by the gate.', layout, actors, capabilities: { alliedActors: true, rider: false } };
  let calls = [];
  const client = sequence => ({ sendPrompt: async request => {
    calls.push(request);
    const next = sequence[calls.length - 1];
    if (next instanceof Error) throw next;
    return typeof next === 'string' ? next : JSON.stringify(next);
  } });
  const wrapped = { schemaVersion: 1, fields: structuredClone(frame), tokens: {}, rules: [] };
  const result = await authorClassScene(client([wrapped, frame]), options);
  assert.deepEqual(result, { frame: validateClassSceneFrame(frame, { layout, actorKeys: Object.keys(actors) }), introducedActors: [] });
  assert.equal(calls.length, 2, 'The real-model contract-wrapper failure must receive a bounded correction.');
  assert.match(calls[0].systemInstruction, /one FLAT JSON object/);
  assert.match(calls[0].systemInstruction, /Do not return fields, tokens, rules/);
  assert.ok(JSON.parse(calls[1].prompt).rejected.response.includes('fields'));
  assert.ok(calls[0].systemInstruction.includes(JSON.stringify({ actor: 'npc0', area: null, allegiance: 'neutral', profile: 'combatant', conditions: [] })),
    'The author prompt must enumerate absent NPC rows rather than only show a placeholder actor.');
  calls = [];
  const omitted = structuredClone(frame); omitted.actors.pop();
  await authorClassScene(client([omitted, frame]), options);
  assert.match(JSON.parse(calls[1].prompt).rejected.reason, /omitted required keys \["npc0"\]/);
  calls = [];
  const untyped = structuredClone(frame); untyped.actors[1].profile = null;
  await authorClassScene(client([untyped, frame]), options);
  assert.equal(calls.length, 2, 'Neutral and absent independent NPCs still need a real kit.');
  calls = [];
  const fallen = structuredClone(frame);
  fallen.actors[1].fallen = { age: 'recent', body: 'intact', returnChoice: 'willing' };
  await authorClassScene(client([fallen, frame]), options);
  assert.equal(calls.length, 2, 'A fallen NPC cannot satisfy promised cooperative support.');
  calls = [];
  await assert.rejects(authorClassScene(client([wrapped, wrapped, wrapped]), options), /exhausted/);
  assert.equal(calls.length, 3);
  calls = [];
  await authorClassScene(client(['not JSON', frame]), options);
  assert.equal(calls.length, 2);
  calls = [];
  await assert.rejects(authorClassScene(client([new Error('Provider unavailable')]), options), /Provider unavailable/);
  assert.equal(calls.length, 1, 'Transport failures must not be disguised as malformed scene corrections.');
  const addition = { ...structuredClone(frame), newActors: [{ key: 'new1', name: 'Wounded Courier', role: 'Messenger', evidence: 'A wounded courier waits beside him.' }] };
  addition.actors.push({ actor: 'new1', area: 'gate', allegiance: 'neutral', profile: 'support', conditions: [] });
  const withCourier = { ...options, narrative: `${options.narrative} A wounded courier waits beside him.` };
  calls = [];
  const introduced = await authorClassScene(client([addition]), withCourier);
  assert.equal(introduced.introducedActors[0].name, 'Wounded Courier');
  assert.equal(introduced.frame.actors.at(-1).actor, 'new1');
  assert.equal(Object.hasOwn(introduced.frame, 'newActors'), false, 'Authoring descriptors do not change the canonical scene frame.');
  calls = [];
  const existingInjury = structuredClone(frame); existingInjury.actors[1].injury = 'wound';
  await authorClassScene(client([existingInjury, frame]), { ...options, actors: { ...actors, npc0: { name: 'Keeper', npcProfile: 'support' } } });
  assert.equal(calls.length, 2, 'Scene generation preserves existing NPC vitals instead of imposing another starting injury.');
  for (const mutate of [
    value => { value.newActors[0].health = 100; },
    value => { value.newActors[0].key = 'npc0'; },
    value => { value.newActors[0].name = 'KEEPER'; },
    value => { value.newActors[0].evidence = 'A new opponent arrives.'; },
    value => { value.actors.at(-1).area = null; },
    value => { value.actors.pop(); }
  ]) {
    calls = [];
    const bad = structuredClone(addition); mutate(bad);
    await authorClassScene(client([bad, addition]), withCourier);
    assert.equal(calls.length, 2, 'Invalid or unmaterialized introduced NPCs must be repaired before persistence.');
  }
  return { boundedCorrections: true, exactFlatWireShape: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log('Class scene author tests passed:', await runClassSceneAuthorTests());
}
