import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { CLASS_FAMILIES } from './class-catalog.js';
import { testSelection, testClassLayout } from './test-class-state.mjs';

export async function runClassCreationTests() {
  const db = await import('./db.js');
  const { AIClient } = await import('./api-client.js');
  const { joinCampaign, getCampaignState, listPlayerCharacters } = await import('./rpg-engine.js');
  const { readClassWorld, writeClassWorldInTransaction } = await import('./class-store.js');
  const original = AIClient.prototype.sendPrompt;
  const campaignIds = [];
  let server;
  let priorConfig;
  let priorImageProvider;
  let configured = false;
  let calls = 0;
  AIClient.prototype.sendPrompt = async ({ systemInstruction }) => {
    calls++;
    if (systemInstruction.includes('persistent structured layout')) return JSON.stringify(testClassLayout);
    if (systemInstruction.includes('initial Aetheria scene')) return JSON.stringify({ schemaVersion: 1,
      areas: testClassLayout.areas.map(area => ({ area: area.id, terrain: 'dry_ground', traits: ['visible', 'safe', 'visited', 'anchor'], surfaces: ['ground'] })),
      actors: [
        { actor: 'player', area: 'gate', allegiance: 'party', profile: null, conditions: [] },
        { actor: 'npc0', area: 'gate', allegiance: 'party', profile: 'combatant', conditions: [] }
      ],
      items: [], objects: [], features: [], discoveries: [], encounter: { active: false, opposition: [] }
    });
    if (calls === 1) return JSON.stringify({
      title: 'Class Verification', setting: 'A bounded courtyard.', acts: [],
      major_locations: [{ name: 'Gatehouse', description: 'Two connected areas.' }],
      key_npcs: [{ name: 'Keeper', role: 'Guard', personality: 'Watchful' }],
      starting_quest: { title: 'Cross the Gate', description: 'Reach the yard.' }
    });
    return JSON.stringify({ narrative: 'The keeper watches the gate.',
      character_update: { health_change: -99, xp_gain: 300, inventory_changes: [] },
      ability_updates: [{ type: 'add', name: 'Invented Power', description: 'Not a real grant.' }]
    });
  };
  try {
    // Each HTTP fixture owns its limiter history, just as a fresh server process does.
    const { app } = await import('./server.js?class-creation-tests');
    priorConfig = await db.get(`SELECT value FROM server_settings WHERE key = 'ai_config'`);
    priorImageProvider = process.env.IMAGE_PROVIDER;
    delete process.env.IMAGE_PROVIDER;
    await db.run(`INSERT INTO server_settings (key, value) VALUES ('ai_config', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value`, [JSON.stringify({ provider: 'ollama', model: 'test', imageProvider: '' })]);
    configured = true;
    server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
    const base = `http://127.0.0.1:${server.address().port}`;
    const headers = { 'Content-Type': 'application/json',
      ...(process.env.ACCESS_SECRET ? { Authorization: `Bearer ${process.env.ACCESS_SECRET}` } : {}) };
    const catalogResponse = await fetch(`${base}/api/class-catalog?genre=Fantasy&modules=rider&alliedActors=true`, { headers });
    assert.equal(catalogResponse.status, 200);
    const catalog = await catalogResponse.json();
    assert.equal(catalog.families.reduce((sum, family) => sum + family.branches.length, 0), 24);
    assert.equal((await fetch(`${base}/api/class-catalog?modules=unreleased`, { headers })).status, 400);
    assert.equal((await fetch(`${base}/api/class-catalog?alliedActors=maybe`, { headers })).status, 400);
    const created = await fetch(`${base}/api/campaigns`, { method: 'POST', headers,
      body: JSON.stringify({ genre: 'Fantasy', characterName: 'Mira', ruleset: 'aetheria', classSelection: testSelection() }) });
    assert.equal(created.status, 200);
    const state = await created.json();
    campaignIds.push(state.campaignId);
    assert.equal(calls, 4, 'Setup authors outline, opening, layout and concrete scene, not class mechanics.');
    assert.equal(state.ruleset.id, 'aetheria');
    assert.equal(state.rulesMode, true);
    assert.equal(state.character.level, 1);
    assert.equal(state.character.xp, 0);
    assert.equal(state.character.health, state.character.max_health);
    assert.ok(state.character.invocableAbilities.some(ability => ability.name === 'Magic Missile'));
    assert.ok(!state.character.abilities.some(ability => ability.name === 'Invented Power'));
    const reloaded = await getCampaignState(state.campaignId);
    assert.deepEqual(reloaded.character.abilities, state.character.abilities);
    assert.deepEqual(reloaded.character.skills, state.character.skills);
    assert.equal(reloaded.character.abilityTriggerRevision, state.character.abilityTriggerRevision);
    let joinedCount = 0;
    for (const family of CLASS_FAMILIES) for (const branch of family.branches) {
      const payload = { characterName: `Joined ${++joinedCount}`, classSelection: testSelection(family.id, branch.id) };
      let joined;
      if (joinedCount === 1) {
        const response = await fetch(`${base}/api/campaigns/${state.campaignId}/join`, { method: 'POST', headers, body: JSON.stringify(payload) });
        assert.equal(response.status, 200);
        joined = await response.json();
      } else joined = await joinCampaign(state.campaignId, payload);
      const character = joined.party.find(member => member.id === joined.joinedCharacterId);
      assert.equal(character.classBuild.branchId, branch.id);
      assert.ok(character.invocableAbilities.length > 0);
      const bindings = await db.all(`SELECT * FROM character_ability_bindings WHERE campaign_id = ? AND player_character_id = ?`,
        [state.campaignId, character.player_character_id]);
      assert.equal(bindings.length, character.abilities.filter(ability => ability.invocation).length);
      if (family.id === 'bonded') {
        const world = readClassWorld(await db.get(`SELECT * FROM campaigns WHERE id = ?`, [state.campaignId]));
        assert.ok(world.actors[character.classState.companion.actorRef]);
      }
      if (family.id === 'rider') {
        const world = readClassWorld(await db.get(`SELECT * FROM campaigns WHERE id = ?`, [state.campaignId]));
        assert.ok(world.vehicles[character.classState.vehicle.vehicleRef]);
      }
    }
    assert.equal(calls, 4, 'Joining an authored class does not generate mechanics.');
    assert.ok((await listPlayerCharacters()).some(profile => profile.id === state.character.player_character_id
      && profile.classBuild.branchId === 'arcanist.formula'));
    const copied = await joinCampaign(state.campaignId, { characterProfileId: state.character.player_character_id, characterMode: 'copy' });
    const copy = copied.party.find(member => member.id === copied.joinedCharacterId);
    assert.deepEqual(copy.abilities, state.character.abilities, 'A copied version retains owned ability IDs.');
    assert.notEqual(copy.player_character_id, state.character.player_character_id, 'Copies progress in separate profile snapshots.');
    assert.ok(copy.inventory.every(item => item.id.startsWith('item:') && item.equipmentId), 'Saved gear rebinds by authored identity.');
    await assert.rejects(joinCampaign(state.campaignId, { characterProfileId: state.character.player_character_id,
      characterMode: 'copy', classSelection: testSelection('armsmaster', 'armsmaster.discipline') }), /keeps its existing class/);
    const rider = copied.party.find(member => member.classBuild.branchId === 'rider.ace');
    const riderCopyState = await joinCampaign(state.campaignId, { characterProfileId: rider.player_character_id, characterMode: 'copy' });
    const riderCopy = riderCopyState.party.find(member => member.id === riderCopyState.joinedCharacterId);
    assert.notEqual(riderCopy.classState.vehicle.vehicleRef, rider.classState.vehicle.vehicleRef,
      'Independent copied vehicle states cannot overwrite one another in the same world.');
    const row = await db.get(`SELECT * FROM campaigns WHERE id = ?`, [state.campaignId]);
    const world = readClassWorld(row);
    world.actors[`character:${state.character.id}`].health -= 5;
    await db.withWriteTransaction(() => writeClassWorldInTransaction(state.campaignId, world, row.rules_revision));
    const hurt = await getCampaignState(state.campaignId);
    assert.equal(hurt.party[0].health, state.character.health - 5);
    const after = await db.get(`SELECT * FROM campaigns WHERE id = ?`, [state.campaignId]);
    await assert.rejects(db.withWriteTransaction(() => writeClassWorldInTransaction(state.campaignId, world, row.rules_revision)), /changed/);
    assert.equal((await db.get(`SELECT rules_revision FROM campaigns WHERE id = ?`, [state.campaignId])).rules_revision, after.rules_revision);
    const countBefore = (await db.get(`SELECT COUNT(*) AS n FROM characters WHERE campaign_id = ?`, [state.campaignId])).n;
    await assert.rejects(joinCampaign(state.campaignId, { characterName: 'Invalid', classSelection: { ...testSelection(), catalogVersion: 'missing' } }), /unavailable/);
    assert.equal((await db.get(`SELECT COUNT(*) AS n FROM characters WHERE campaign_id = ?`, [state.campaignId])).n, countBefore);
    return { created: 1, joined: joinedCount };
  } finally {
    if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    if (configured) {
      if (priorConfig) await db.run(`UPDATE server_settings SET value = ? WHERE key = 'ai_config'`, [priorConfig.value]);
      else await db.run(`DELETE FROM server_settings WHERE key = 'ai_config'`);
      if (priorImageProvider === undefined) delete process.env.IMAGE_PROVIDER;
      else process.env.IMAGE_PROVIDER = priorImageProvider;
    }
    AIClient.prototype.sendPrompt = original;
    for (const campaignId of campaignIds) {
      const profiles = await db.all(`SELECT player_character_id FROM characters WHERE campaign_id = ?`, [campaignId]);
      await db.run(`DELETE FROM campaigns WHERE id = ?`, [campaignId]);
      for (const profile of profiles) await db.run(`DELETE FROM player_characters WHERE id = ?`, [profile.player_character_id]);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const directory = await mkdtemp(join(tmpdir(), 'aetheria-class-create-'));
  process.env.RPG_DB_PATH = join(directory, 'test.db');
  const db = await import('./db.js');
  try {
    await db.initDb();
    console.log('Class creation tests passed:', await runClassCreationTests());
  } finally {
    await db.closeDb();
    await rm(directory, { recursive: true, force: true });
  }
}
