import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { testSelection, testClassLayout } from './test-class-state.mjs';
import { advanceClassCharacter } from './class-progression.js';
import { prepareClassAction, finalizeClassAction } from './class-actions.js';

const recentWilling = { age: 'recent', body: 'intact', returnChoice: 'willing' };

// Progression is the real pure handler; this does not claim live turn-by-turn leveling.
function advanceToRevival(world, actor) {
  let state = world;
  for (let level = 2; level <= 10; level++) {
    const result = advanceClassCharacter({ state, actor, award: 'milestone', awardId: `revival-level-${level}` });
    assert.equal(result.levelsGained, 1);
    state = result.state;
  }
  return state;
}

function performRevival(world, actor, target, name) {
  let state = advanceToRevival(world, actor);
  const ability = state.actors[actor].abilities.find(value => value.name === name);
  assert.ok(ability, 'The real progression handler grants the authored revival ability.');
  const catalyst = Object.keys(state.items).find(ref => state.items[ref].kind === 'revival-catalyst');
  const phases = [];
  for (let turn = 2; turn <= 4; turn++) {
    const before = structuredClone(state);
    const plan = prepareClassAction({ state, actor, ability: ability.id,
      bindings: { targets: [target], ...(name === 'Recall the Departed' ? { catalyst } : {}) },
      context: { operationId: `revival-action-${turn}`, turn, actor, sceneId: 'creation-scene', affirmedOpposed: [], consentingActors: [] } });
    const result = finalizeClassAction({ state, plan, outcome: 'success' });
    assert.deepEqual(state, before, 'Preparing and finalizing return new state without mutating the persisted input.');
    phases.push(result.phase);
    state = result.state;
    if (result.phase === 'complete') return { state, phases, catalyst, effects: result.effects };
    assert.equal(state.actors[target].health, 0);
    assert.equal(state.items[catalyst].lost, false, 'An unfinished working does not consume the catalyst.');
  }
  assert.fail('The authored revival did not complete in its declared workings.');
}

export async function runClassRevivalTests() {
  const db = await import('./db.js');
  const engine = await import('./rpg-engine.js');
  const { AIClient } = await import('./api-client.js');
  const originalPrompt = AIClient.prototype.sendPrompt;
  const priorImageProvider = process.env.IMAGE_PROVIDER;
  delete process.env.IMAGE_PROVIDER;
  const campaigns = [];
  const profiles = new Set();
  let fallen = recentWilling;
  let playerOverride = false;
  AIClient.prototype.sendPrompt = async ({ systemInstruction, prompt }) => {
    if (prompt.startsWith('Draft an epic,')) return JSON.stringify({ title: 'The fallen keeper', setting: 'An open gatehouse after a skirmish.',
      major_locations: [{ name: 'Gatehouse', description: 'Two connected areas.' }],
      key_npcs: [{ name: 'Keeper', role: 'Fallen ally', personality: 'Loyal', quirks: '' }],
      starting_quest: { title: 'Bring the keeper home', description: 'Aid the keeper beside the gate.' } });
    if (systemInstruction.includes('persistent structured layout')) return JSON.stringify(testClassLayout);
    if (systemInstruction.includes('initial Aetheria scene')) return JSON.stringify({ schemaVersion: 1,
      areas: testClassLayout.areas.map(area => ({ area: area.id, terrain: 'dry_ground',
        traits: ['visible', 'safe', 'visited', 'safe_recovery'], surfaces: ['ground'] })),
      actors: [
        { actor: 'player', area: 'gate', allegiance: 'party', profile: null, conditions: [], ...(playerOverride ? { fallen } : {}) },
        { actor: 'npc0', area: 'gate', allegiance: 'party', profile: 'support', conditions: [], ...(fallen ? { fallen } : {}) }
      ],
      items: [{ key: 'catalyst', name: 'Revival catalyst', description: 'A recorded revival catalyst.', kind: 'revival_catalyst',
        holder: { kind: 'actor', key: 'player' }, wielded: false, condition: 'pristine' }],
      objects: [], features: [], discoveries: [], encounter: { active: false, opposition: [] }
    });
    if (prompt.startsWith('Set the scene and begin the campaign.')) return JSON.stringify({
      narrative: 'The fallen keeper lies beside the gate.', scene_grounding: 'Mira and the keeper are beside the gate.' });
    throw new Error(`Unexpected revival provider call: ${systemInstruction.slice(0, 100)}`);
  };
  const create = async (family = 'arcanist', branch = 'arcanist.ritual') => {
    const result = await engine.createCampaign({ genre: 'Fantasy', characterName: 'Mira', ruleset: 'aetheria',
      classSelection: { ...testSelection(family, branch), modules: [], capabilities: { rider: false, alliedActors: false } },
      apiConfig: { provider: 'ollama', model: 'class-revival-fixture', imageProvider: '' } });
    campaigns.push(result.campaignId);
    profiles.add(result.character.player_character_id);
    const row = await db.get('SELECT rules_state_json FROM campaigns WHERE id = ?', [result.campaignId]);
    const world = JSON.parse(row.rules_state_json);
    const target = Object.keys(world.actors).find(ref => ref.startsWith('npc:'));
    return { result, world, actor: `character:${result.character.id}`, target };
  };
  try {
    const ritual = await create();
    const original = structuredClone(ritual.world);
    assert.equal(ritual.world.actors[ritual.actor].level, 1);
    const npc = ritual.world.actors[ritual.target];
    assert.equal(npc.status, 'dead');
    assert.equal(npc.health, 0);
    assert.equal(npc.deathTurn, 1, 'The creation turn, not model arithmetic, supplies recorded death age.');
    assert.equal(npc.intactBody, true);
    assert.equal(npc.willingReturn, true);
    const opening = await db.get('SELECT rules_snapshot_json FROM turns WHERE campaign_id = ? AND turn_number = 1', [ritual.result.campaignId]);
    assert.deepEqual(JSON.parse(opening.rules_snapshot_json), ritual.world);
    const recalled = performRevival(ritual.world, ritual.actor, ritual.target, 'Recall the Departed');
    assert.deepEqual(recalled.phases, ['ritual_progress', 'ritual_progress', 'complete']);
    assert.equal(recalled.state.actors[ritual.target].status, 'active');
    assert.equal(recalled.state.actors[ritual.target].health, 1);
    assert.equal(recalled.state.actors[ritual.target].conditions.winded.duration, 'persistent');
    assert.equal(recalled.state.items[recalled.catalyst].lost, true);
    assert.deepEqual(ritual.world, original);

    const channel = await create('channeler', 'channeler.restoration');
    const returned = performRevival(channel.world, channel.actor, channel.target, 'Breath of Return');
    assert.deepEqual(returned.phases, ['complete']);
    assert.equal(returned.state.actors[channel.target].health, 1);
    assert.equal(returned.state.actors[channel.actor].classState.strain, 3);
    assert.equal(returned.state.actors[channel.actor].conditions.winded.duration, 'persistent');
    assert.equal(returned.state.items[returned.catalyst].lost, false, 'Breath of Return does not consume a ritual catalyst.');

    for (const changed of [{ age: 'unknown' }, { body: 'unknown' }, { body: 'destroyed' }, { returnChoice: 'unknown' }, { returnChoice: 'unwilling' }]) {
      fallen = { ...recentWilling, ...changed };
      const created = await create();
      const before = structuredClone(created.world);
      assert.throws(() => performRevival(created.world, created.actor, created.target, 'Recall the Departed'), /body|chosen|return|death|reviv/i);
      assert.deepEqual(created.world, before, 'An unavailable revival never modifies the creation snapshot.');
      assert.equal(created.world.actors[created.target].health, 0);
      if (changed.age) assert.equal(Object.hasOwn(created.world.actors[created.target], 'deathTurn'), false);
      if (changed.returnChoice === 'unknown') assert.equal(Object.hasOwn(created.world.actors[created.target], 'willingReturn'), false);
      if (changed.body === 'unknown') assert.equal(Object.hasOwn(created.world.actors[created.target], 'intactBody'), false);
    }

    fallen = null;
    const living = await create();
    assert.equal(living.world.actors[living.target].status, 'active');
    assert.equal(Object.hasOwn(living.world.actors[living.target], 'willingReturn'), false, 'Party allegiance alone supplies no return choice.');
    const counts = async () => Object.fromEntries(await Promise.all(['campaigns', 'characters', 'player_characters', 'npcs'].map(async table =>
      [table, (await db.get(`SELECT COUNT(*) AS n FROM ${table}`)).n])));
    const beforeInvalid = await counts();
    fallen = recentWilling;
    playerOverride = true;
    await assert.rejects(create(), /player|controlled|vitals|return choice/i);
    assert.deepEqual(await counts(), beforeInvalid, 'A model PC death override rolls back actual campaign creation.');
    return { createdCampaigns: campaigns.length, revivalPaths: 2, unavailableRevivalCases: 5, providerOnlyStub: true, liveLeveling: false };
  } finally {
    AIClient.prototype.sendPrompt = originalPrompt;
    if (priorImageProvider === undefined) delete process.env.IMAGE_PROVIDER;
    else process.env.IMAGE_PROVIDER = priorImageProvider;
    for (const id of campaigns) {
      for (const row of await db.all('SELECT player_character_id FROM characters WHERE campaign_id = ?', [id])) profiles.add(row.player_character_id);
      await db.run('DELETE FROM campaigns WHERE id = ?', [id]);
    }
    for (const id of profiles) if (id) await db.run('DELETE FROM player_characters WHERE id = ?', [id]);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const directory = await mkdtemp(join(tmpdir(), 'aetheria-class-revival-'));
  process.env.RPG_DB_PATH = join(directory, 'test.db');
  const db = await import('./db.js');
  try {
    await db.initDb();
    console.log('Class revival reachability tests passed:', await runClassRevivalTests());
  } finally {
    await db.closeDb();
    await rm(directory, { recursive: true, force: true });
  }
}
