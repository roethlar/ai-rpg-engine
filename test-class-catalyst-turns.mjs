import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { resolve, sep, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { testSelection, testClassLayout } from './test-class-state.mjs';
import { validateClassBundle } from './class-portability.js';

export async function runClassCatalystTurnTests() {
  assert.ok(process.env.RPG_DB_PATH && resolve(process.env.RPG_DB_PATH).startsWith(`${resolve(tmpdir())}${sep}`),
    'Catalyst integration requires a disposable database selected before importing db.js.');
  const db = await import('./db.js');
  const engine = await import('./rpg-engine.js');
  const { AIClient } = await import('./api-client.js');
  const originalPrompt = AIClient.prototype.sendPrompt;
  const priorImageProvider = process.env.IMAGE_PROVIDER;
  delete process.env.IMAGE_PROVIDER;
  const apiConfig = { provider: 'ollama', model: 'catalyst-turn-fixture', imageProvider: '' };
  const campaigns = [];
  const profiles = new Set();
  let encounter = true;
  let script = {};
  let providerCalls = 0;
  let advancements = 0;
  const world = async id => JSON.parse((await db.get('SELECT rules_state_json FROM campaigns WHERE id = ?', [id])).rules_state_json);
  const submit = (state, prose) => engine.takeTurn(state.campaignId, prose, apiConfig,
    state.character.id, state.character.abilityTriggerRevision, { requestId: randomUUID() });
  const refs = data => Object.fromEntries(Object.entries(data.world.actors).map(([ref, value]) => [value.name, ref]));
  const review = data => ({ approved: true, reason: 'The selected existing actors, actions and current consent match the declared intent.',
    affirmedOpposed: Object.entries(data.world.actors).filter(([, value]) => !value.party).map(([ref]) => ref),
    consentingActors: script.ability ? [refs(data).Nessa] : [] });
  AIClient.prototype.sendPrompt = async ({ systemInstruction, prompt }) => {
    providerCalls++;
    const stage = /^AETHERIA_COUNCIL:([a-z_]+)/u.exec(systemInstruction)?.[1];
    if (!stage) {
      if (prompt.startsWith('Draft an epic,')) return JSON.stringify({ title: 'Coordinated gatehouse', setting: 'A gatehouse and a connected courtyard.',
        major_locations: [{ name: 'Gatehouse', description: 'Open adjoining areas.' }],
        key_npcs: [{ name: 'Nessa', role: 'Willing allied supporter', personality: 'Cooperative', quirks: '' },
          { name: 'Raider', role: 'Opposing combatant', personality: 'Hostile', quirks: '' },
          { name: 'Sentry', role: 'Second opposing combatant', personality: 'Hostile', quirks: '' }],
        starting_quest: { title: 'Coordinate the defense', description: 'Deliver the completed preparations and direct the defense.' } });
      if (systemInstruction.includes('persistent structured layout')) return JSON.stringify(testClassLayout);
      if (systemInstruction.includes('initial Aetheria scene')) return JSON.stringify({ schemaVersion: 1,
        areas: testClassLayout.areas.map(area => ({ area: area.id, terrain: 'dry_ground',
          traits: ['visible', 'safe', 'visited', encounter ? 'immediate_threat' : 'safe_recovery'], surfaces: ['ground'] })),
        actors: [{ actor: 'player', area: 'gate', allegiance: 'party', profile: null, conditions: [] },
          { actor: 'npc0', area: 'gate', allegiance: 'party', profile: 'support',
            conditions: encounter ? [{ kind: 'dazed', duration: 'scene', detail: 'A recent blow left Nessa dazed.' }] : [],
            ...(encounter ? { injury: 'wound' } : {}) },
          { actor: 'npc1', area: encounter ? 'gate' : null, allegiance: 'opposition', profile: 'combatant', conditions: [] },
          { actor: 'npc2', area: encounter ? 'gate' : null, allegiance: 'opposition', profile: 'combatant', conditions: [] }],
        items: [], objects: [], features: [], discoveries: [], encounter: { active: encounter, opposition: encounter ? ['npc1', 'npc2'] : [] } });
      if (prompt.startsWith('Set the scene and begin the campaign.')) return JSON.stringify({ narrative: encounter
        ? 'The injured, dazed Nessa agrees to follow the stated cue. Two opponents hold the gate.' : 'Nessa helps complete the preparations before the opposition arrives.',
      scene_grounding: 'The gate and courtyard are connected. The defense preparations have distinct completed deliveries.' });
      throw new Error(`Unexpected Catalyst setup call: ${systemInstruction.slice(0, 80)}`);
    }
    const data = JSON.parse(prompt);
    if (stage === 'interaction') return JSON.stringify({ inputKind: script.talk ? 'clarification' : 'committed_action', intent: data.playerInput,
      answer: script.talk ? 'Nessa is waiting for the agreed opportunity.' : null });
    if (stage === 'table_talk') return JSON.stringify({ narrative: 'Nessa is waiting for the agreed opportunity.' });
    if (stage === 'grounding' || stage === 'pre_roll') return JSON.stringify(review(data));
    if (stage === 'referee') {
      const byName = refs(data);
      const declaration = data.options.abilities.find(value => value.name === script.ability);
      const bindings = script.ability === 'Exploit Cue' ? { targets: [byName.Raider], ally: byName.Nessa }
        : { targets: [byName.Nessa], ...(script.area ? { area: script.area } : {}) };
      const action = script.ability ? { kind: 'ability', abilityId: declaration.abilityId, bindings, options: {} }
        : script.aid ? { kind: 'ordinary', action: { kind: 'aid', target: byName.Nessa } }
          : { kind: 'ordinary', action: { kind: 'move', area: script.area } };
      const npcTurns = data.world.encounterActive ? Object.entries(data.world.actors).filter(([ref]) => ref.startsWith('npc:')).map(([npc, value]) =>
        value.name === 'Nessa' && script.npcAction ? { npc, actionId: script.npcAction,
          ...(script.npcTarget ? { target: script.npcTarget === 'self' ? byName.Nessa : script.npcTarget === 'player' ? `character:${data.actor}` : byName[script.npcTarget] } : {}) }
          : { npc, wait: 'Holds the recorded position while watching the named opponent.' }) : [];
      return JSON.stringify({ action, check: script.aid ? { actor: data.actor, callSeq: 1, intent: 'Help Nessa under pressure.',
        tier: 'standard', tierBasis: 'Providing useful coordination during the active exchange.', deltas: [] } : null,
      deltaSources: [], noCheckReason: script.aid ? null : script.ability ? 'Choosing the explicit willing cue is a deterministic authored commitment.'
        : 'The completed delivery crosses a safe unopposed area with no uncertainty.',
      npcTurns: { success: npcTurns, failure: npcTurns }, encounter: { success: 'unchanged', failure: 'unchanged' },
      award: script.award ? { kind: 'milestone', id: script.award } : null });
    }
    if (stage === 'annotation') return JSON.stringify({ text: 'The exchange carries no additional mechanical event.', effects: [] });
    if (stage === 'annotation_review') return JSON.stringify({ approved: true, reason: 'No additional consequence is proposed.', affirmedOpposed: review(data).affirmedOpposed });
    if (stage === 'narration') return JSON.stringify({ narrative: 'The chosen cue and the completed actions have their recorded consequences.' });
    throw new Error(`Unexpected Catalyst stage: ${stage}`);
  };
  const create = async (branch, active, profileId = null) => {
    encounter = active;
    const state = await engine.createCampaign({ genre: 'Fantasy', characterName: 'Sera', ruleset: 'aetheria', apiConfig,
      classSelection: { ...testSelection('catalyst', `catalyst.${branch}`), modules: [], capabilities: { rider: false, alliedActors: true } },
      ...(profileId ? { characterProfileId: profileId, characterMode: 'copy' } : {}) });
    campaigns.push(state.campaignId);
    profiles.add(state.character.player_character_id);
    return state;
  };
  const advanced = async (branch, level) => {
    let state = await create(branch, false);
    const initialIds = state.character.abilities.map(value => value.id);
    for (let step = 1; step < level; step++) {
      script = { area: step % 2 ? 'yard' : 'gate', award: `${branch}-preparation-${step}` };
      state = await submit(state, `I deliver completed defense preparation ${step} to the ${script.area}.`);
      assert.equal(state.character.level, step + 1);
      advancements++;
    }
    assert.ok(initialIds.every(id => state.character.abilities.some(value => value.id === id)));
    const copy = await create(branch, true, state.character.player_character_id);
    assert.deepEqual(copy.character.abilities.map(value => value.id), state.character.abilities.map(value => value.id));
    return copy;
  };
  const references = saved => Object.fromEntries(Object.entries(saved.actors).map(([ref, value]) => [value.name, ref]));
  try {
    let tactics = await create('tactics', true);
    let current = await world(tactics.campaignId);
    let names = references(current);
    script = { ability: 'Advance Cue', area: 'yard' };
    tactics = await submit(tactics, 'I give Nessa Advance Cue toward the courtyard; she agrees and waits.');
    current = await world(tactics.campaignId);
    assert.equal(current.actors[names.Sera].classState.cue.ally, names.Nessa);
    assert.equal(current.actors[names.Nessa].area, 'gate', 'A grounded wait never activates the cue.');
    const foeBefore = current.actors[names.Raider].health;
    const roundBefore = current.turnOrder.round;
    script = { ability: 'Advance Cue', area: 'yard', npcAction: 'brawl', npcTarget: 'Raider' };
    tactics = await submit(tactics, 'I give Nessa Advance Cue toward the courtyard; she agrees and strikes the Raider.');
    current = await world(tactics.campaignId);
    assert.equal(current.actors[names.Nessa].area, 'yard');
    assert.equal(current.actors[names.Raider].health, foeBefore - 2, 'Only the real NPC brawl deals its authored harm.');
    assert.equal(current.actors[names.Sera].classState.cue, null);
    assert.equal(current.turnOrder.round, roundBefore + 1);
    assert.equal(current.actors[names.Nessa].npcState.lastMainRound, roundBefore, 'Cue movement grants no second NPC Main.');

    tactics = await advanced('tactics', 7);
    current = await world(tactics.campaignId);
    names = references(current);
    script = { ability: 'Exploit Cue', npcAction: 'brawl', npcTarget: 'Sentry' };
    tactics = await submit(tactics, 'I give Nessa Exploit Cue against the Raider; she agrees but first strikes the Sentry.');
    current = await world(tactics.campaignId);
    assert.equal(current.actors[names.Sera].classState.cue.target, names.Raider);
    assert.equal(current.actors[names.Raider].conditions.exposed, undefined, 'An attack on a different target cannot consume Exploit Cue.');
    script = { aid: true, npcAction: 'brawl', npcTarget: 'Raider' };
    tactics = await submit(tactics, 'I help Nessa coordinate; she now strikes the Raider.');
    current = await world(tactics.campaignId);
    assert.equal(current.actors[names.Sera].classState.cue, null);
    assert.equal(current.actors[names.Raider].conditions.exposed.duration, 'scene');

    let resonance = await advanced('resonance', 5);
    current = await world(resonance.campaignId);
    names = references(current);
    script = { ability: 'Courage Cue' };
    resonance = await submit(resonance, 'I give willing Nessa Courage Cue; she waits for an opening.');
    const beforeTalk = await world(resonance.campaignId);
    script = { talk: true };
    resonance = await submit(resonance, 'Is Nessa still waiting?');
    assert.deepEqual(await world(resonance.campaignId), beforeTalk, 'Table talk is not an NPC Main or cue trigger.');
    script = { ability: 'Courage Cue', npcAction: 'brawl', npcTarget: 'Raider' };
    resonance = await submit(resonance, 'I renew willing Nessa\'s Courage Cue; she strikes the Raider.');
    current = await world(resonance.campaignId);
    assert.equal(current.actors[names.Sera].classState.cue, null);
    assert.equal(current.actors[names.Nessa].conditions.dazed, undefined);
    assert.equal(current.actors[names.Nessa].conditions.inspired.duration, 'scene');
    script = { ability: 'Courage Cue' };
    resonance = await submit(resonance, 'I give willing Nessa Courage Cue again; she waits.');
    const beforeNoOp = await world(resonance.campaignId);
    const operationsBefore = (await db.get('SELECT COUNT(*) AS n FROM rules_turn_operations WHERE campaign_id = ?', [resonance.campaignId])).n;
    script = { ability: 'Courage Cue', npcAction: 'rally', npcTarget: 'self' };
    await assert.rejects(submit(resonance, 'I renew Courage Cue while Nessa rallies her already inspired self.'), /already active|resolved|recorded scene/i);
    assert.deepEqual(await world(resonance.campaignId), beforeNoOp, 'A rejected no-op NPC action neither consumes the waiting cue nor commits a new one.');
    assert.equal((await db.get('SELECT COUNT(*) AS n FROM rules_turn_operations WHERE campaign_id = ?', [resonance.campaignId])).n, operationsBefore);
    const priorHealth = beforeNoOp.actors[names.Nessa].health;
    script = { ability: 'Harmony Cue', npcAction: 'rally', npcTarget: 'player' };
    resonance = await submit(resonance, 'I give willing Nessa Harmony Cue; she rallies me.');
    current = await world(resonance.campaignId);
    assert.equal(current.actors[names.Sera].classState.cue, null);
    assert.equal(current.actors[names.Nessa].health, Math.min(current.actors[names.Nessa].maxHealth, priorHealth + 6));
    assert.equal(current.actors[names.Sera].conditions.inspired.duration, 'scene');
    for (const id of campaigns) validateClassBundle(await engine.exportCampaign(id));
    const checks = await db.all(`SELECT actor FROM rules_checks WHERE campaign_id IN (${campaigns.map(() => '?').join(',')})`, campaigns);
    assert.equal(checks.length, 1, 'Only the actual PC aid check rolls; NPC cue follow-through invents no checks.');
    assert.equal(checks[0].actor, tactics.character.id);
    return { campaigns: campaigns.length, authoredAdvancements: advancements, npcCueKinds: 4, realPcChecks: 1,
      guards: ['wait', 'table_talk', 'different_target', 'npc_no_op'], providerCalls, providerOnlyStub: true };
  } finally {
    AIClient.prototype.sendPrompt = originalPrompt;
    if (priorImageProvider === undefined) delete process.env.IMAGE_PROVIDER;
    else process.env.IMAGE_PROVIDER = priorImageProvider;
    for (const id of campaigns) await db.run('DELETE FROM campaigns WHERE id = ?', [id]);
    for (const id of profiles) await db.run('DELETE FROM player_characters WHERE id = ?', [id]);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { mkdtemp, rm } = await import('node:fs/promises');
  const directory = await mkdtemp(join(tmpdir(), 'aetheria-catalyst-turns-'));
  process.env.RPG_DB_PATH = join(directory, 'test.db');
  const db = await import('./db.js');
  try {
    await db.initDb();
    console.log('Catalyst class turn tests passed:', await runClassCatalystTurnTests());
  } finally {
    await db.closeDb();
    await rm(directory, { recursive: true, force: true });
  }
}
