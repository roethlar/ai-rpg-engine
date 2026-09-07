import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { resolve, sep, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { testSelection, testClassLayout } from './test-class-state.mjs';
import { validateClassBundle } from './class-portability.js';

export async function runClassMakerTurnTests() {
  assert.ok(process.env.RPG_DB_PATH && resolve(process.env.RPG_DB_PATH).startsWith(`${resolve(tmpdir())}${sep}`),
    'Maker integration requires a disposable database selected before importing db.js.');
  const db = await import('./db.js');
  const engine = await import('./rpg-engine.js');
  const { AIClient } = await import('./api-client.js');
  const originalPrompt = AIClient.prototype.sendPrompt;
  const priorImageProvider = process.env.IMAGE_PROVIDER;
  delete process.env.IMAGE_PROVIDER;
  const apiConfig = { provider: 'ollama', model: 'maker-turn-fixture', imageProvider: '' };
  let campaignId;
  let profileId;
  let script = {};
  let providerCalls = 0;
  const campaign = id => db.get('SELECT * FROM campaigns WHERE id = ?', [id]);
  const world = async () => JSON.parse((await campaign(campaignId)).rules_state_json);
  const submit = (state, prose, requestId = randomUUID()) => engine.takeTurn(state.campaignId, prose, apiConfig,
    state.character.id, state.character.abilityTriggerRevision, { requestId });
  const review = () => ({ approved: true, reason: 'The exact owned installation and recorded safe route follow the declared intent.',
    affirmedOpposed: [], consentingActors: [] });
  AIClient.prototype.sendPrompt = async ({ systemInstruction, prompt }) => {
    providerCalls++;
    const stage = /^AETHERIA_COUNCIL:([a-z_]+)/u.exec(systemInstruction)?.[1];
    if (!stage) {
      if (prompt.startsWith('Draft an epic,')) return JSON.stringify({ title: 'Gatehouse preparations', setting: 'A quiet workshop beside the courtyard.',
        major_locations: [{ name: 'Gatehouse', description: 'Two open connected areas.' }],
        key_npcs: [{ name: 'Keeper', role: 'Allied workshop keeper', personality: 'Patient', quirks: '' }],
        starting_quest: { title: 'Prepare the defenses', description: 'Deliver the completed preparations and position a bulwark.' } });
      if (systemInstruction.includes('persistent structured layout')) return JSON.stringify(testClassLayout);
      if (systemInstruction.includes('initial Aetheria scene')) return JSON.stringify({ schemaVersion: 1,
        areas: testClassLayout.areas.map(area => ({ area: area.id, terrain: 'dry_ground',
          traits: ['visible', 'safe', 'visited', 'safe_recovery'], surfaces: ['ground'] })),
        actors: [{ actor: 'player', area: 'gate', allegiance: 'party', profile: null, conditions: [] },
          { actor: 'npc0', area: 'gate', allegiance: 'party', profile: 'support', conditions: [] }],
        items: [], objects: [], features: [], discoveries: [], encounter: { active: false, opposition: [] } });
      if (prompt.startsWith('Set the scene and begin the campaign.')) return JSON.stringify({
        narrative: 'The Keeper checks completed preparations at the gate. The adjoining courtyard is open.',
        scene_grounding: 'Six distinct completed defense preparations await delivery. Both connected areas are safe and unopposed.' });
      throw new Error(`Unexpected Maker setup call: ${systemInstruction.slice(0, 80)}`);
    }
    const data = JSON.parse(prompt);
    if (stage === 'interaction') return JSON.stringify({ inputKind: 'committed_action', intent: data.playerInput, answer: null });
    if (stage === 'grounding' || stage === 'pre_roll') return JSON.stringify(review());
    if (stage === 'referee') {
      let action;
      if (script.ability) {
        const ability = data.options.abilities.find(value => value.name === script.ability);
        assert.ok(ability, 'Only the exact owned declaration enters the live Referee action context.');
        const bindings = {};
        if (script.installation) {
          assert.ok(data.options.installations.some(value => value.id === script.installation));
          assert.ok(ability.bindings.installation.values.includes(script.installation));
          bindings.installation = script.installation;
          bindings.area = script.area;
        }
        action = { kind: 'ability', abilityId: ability.abilityId, bindings, options: {} };
      } else action = { kind: 'ordinary', action: { kind: 'move', area: script.area } };
      return JSON.stringify({ action, check: null, deltaSources: [],
        noCheckReason: 'The recorded safe unopposed scene has no uncertainty or immediate threat; the chosen deployment or movement is deterministic.',
        npcTurns: { success: [], failure: [] }, encounter: { success: 'unchanged', failure: 'unchanged' },
        award: script.award ? { kind: 'milestone', id: script.award } : null });
    }
    if (stage === 'narration') return JSON.stringify({ narrative: 'The completed preparation and the selected installation occupy their recorded positions.' });
    throw new Error(`Unexpected Maker stage: ${stage}`);
  };
  try {
    let state = await engine.createCampaign({ genre: 'Fantasy', characterName: 'Tess', ruleset: 'aetheria', apiConfig,
      classSelection: { ...testSelection('maker', 'maker.forge'), modules: [], capabilities: { rider: false, alliedActors: false } } });
    campaignId = state.campaignId;
    profileId = state.character.player_character_id;
    const actor = `character:${state.character.id}`;
    const initialIds = state.character.abilities.map(value => value.id);
    for (let step = 1; step <= 6; step++) {
      script = { area: step % 2 ? 'yard' : 'gate', award: `maker-preparation-${step}` };
      state = await submit(state, `I deliver completed defense preparation ${step} to the ${script.area}.`);
      assert.equal(state.character.level, step + 1);
      assert.equal(state.character.xp, step * 100);
    }
    assert.ok(initialIds.every(id => state.character.abilities.some(value => value.id === id)));
    const mobile = state.character.abilities.find(value => value.name === 'Mobile Bastion');
    assert.ok(mobile && state.character.invocableAbilities.some(value => value.abilityId === mobile.id));
    script = { ability: 'Deploy Bulwark' };
    state = await submit(state, 'I use Deploy Bulwark at the gate.');
    state = await engine.getCampaignState(campaignId);
    let current = await world();
    const installation = current.actors[actor].classState.installations.find(value => value.status === 'active');
    assert.equal(installation.kind, 'bulwark');
    assert.equal(installation.area, 'gate');
    assert.equal(Object.hasOwn(installation, 'health'), false);
    assert.equal(Object.hasOwn(installation, 'maxHealth'), false);
    assert.equal(installation.features.length, 1);
    const oldCover = installation.features[0];
    assert.equal(current.features[oldCover].kind, 'cover');
    assert.equal(current.features[oldCover].status, 'active');

    const beforeNoOp = current;
    const beforeNoOpRow = await campaign(campaignId);
    const operationsBefore = (await db.get('SELECT COUNT(*) AS n FROM rules_turn_operations WHERE campaign_id = ?', [campaignId])).n;
    script = { ability: 'Mobile Bastion', installation: installation.id, area: 'gate' };
    await assert.rejects(submit(state, 'I use Mobile Bastion to leave the same bulwark in its current gate area.'), /adjacent|route|resolved|recorded scene/i);
    assert.deepEqual(await world(), beforeNoOp, 'A same-area no-op cannot relocate the cover or spend the scene use.');
    assert.equal((await campaign(campaignId)).rules_revision, beforeNoOpRow.rules_revision);
    assert.equal((await db.get('SELECT COUNT(*) AS n FROM rules_turn_operations WHERE campaign_id = ?', [campaignId])).n, operationsBefore);

    const requestId = randomUUID();
    const prose = 'I use Mobile Bastion to move my bulwark into the courtyard while I stay at the gate.';
    script = { ability: 'Mobile Bastion', installation: installation.id, area: 'yard' };
    state = await submit(state, prose, requestId);
    state = await engine.getCampaignState(campaignId);
    current = await world();
    const moved = current.actors[actor].classState.installations.find(value => value.id === installation.id);
    assert.equal(moved.area, 'yard');
    assert.equal(moved.status, 'active');
    assert.equal(current.actors[actor].classState.installations.length, 1, 'Relocation cannot mint a replacement installation.');
    assert.equal(Object.hasOwn(moved, 'health'), false);
    assert.equal(Object.hasOwn(moved, 'maxHealth'), false);
    assert.equal(current.actors[actor].area, 'gate', 'The owner stays in place when its installation moves.');
    assert.equal(current.features[oldCover].status, 'cleared');
    assert.equal(moved.features.length, 1);
    assert.notEqual(moved.features[0], oldCover, 'The cleared feature remains historical while the same installation owns its new feature.');
    const cover = current.features[moved.features[0]];
    assert.equal(cover.status, 'active');
    assert.equal(cover.kind, 'cover');
    assert.equal(cover.area, `area:${current.currentLocationId}:yard`);
    assert.equal(cover.name, beforeNoOp.features[oldCover].name);
    assert.equal(current.actors[actor].classState.sceneUses[mobile.definition_id], 1);
    assert.equal(current.turnOrder.round, beforeNoOp.turnOrder.round + 1, 'Moving the installation consumes one owner Main.');
    const committed = await db.get('SELECT * FROM turns WHERE campaign_id = ? ORDER BY turn_number DESC LIMIT 1', [campaignId]);
    assert.deepEqual(JSON.parse(committed.rules_snapshot_json), current);
    const changes = JSON.parse(committed.state_changes_json);
    assert.ok(changes.rules_effects.some(effect => effect.op === 'scene_feature_clear'));
    assert.ok(changes.rules_effects.some(effect => effect.op === 'scene_feature_place'));
    assert.equal((await db.get('SELECT COUNT(*) AS n FROM rules_checks WHERE campaign_id = ?', [campaignId])).n, 0);
    const callsBeforeRetry = providerCalls;
    await submit(state, prose, requestId);
    assert.equal(providerCalls, callsBeforeRetry, 'An exact completed request retry cannot rerun relocation.');
    assert.deepEqual(await world(), current);
    script.area = 'gate';
    await assert.rejects(submit(state, 'I use Mobile Bastion again to bring the same bulwark back to the gate.'), /uses remaining|resolved|recorded scene/i);
    assert.deepEqual(await world(), current, 'A fresh repeated use cannot move the installation or charge another use.');
    validateClassBundle(await engine.exportCampaign(campaignId));
    return { campaigns: 1, authoredAdvancements: 6, deployments: 1, relocations: 1,
      guards: ['same_area_no_op', 'spent_scene_use', 'completed_retry'], providerCalls, providerOnlyStub: true };
  } finally {
    AIClient.prototype.sendPrompt = originalPrompt;
    if (priorImageProvider === undefined) delete process.env.IMAGE_PROVIDER;
    else process.env.IMAGE_PROVIDER = priorImageProvider;
    if (campaignId) await db.run('DELETE FROM campaigns WHERE id = ?', [campaignId]);
    if (profileId) await db.run('DELETE FROM player_characters WHERE id = ?', [profileId]);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { mkdtemp, rm } = await import('node:fs/promises');
  const directory = await mkdtemp(join(tmpdir(), 'aetheria-maker-turns-'));
  process.env.RPG_DB_PATH = join(directory, 'test.db');
  const db = await import('./db.js');
  try {
    await db.initDb();
    console.log('Maker class turn tests passed:', await runClassMakerTurnTests());
  } finally {
    await db.closeDb();
    await rm(directory, { recursive: true, force: true });
  }
}
