import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const YARD_FACT = 'A narrow dry passage runs behind the courtyard retaining wall.';
const GATE_FACT = 'Fresh tracks lead from the gate arch toward the abandoned lookout.';
const layout = {
  name: 'Gatehouse', description: 'A safe gate and adjoining courtyard.',
  areas: [{ id: 'gate', name: 'Gate', x: 0, y: 0, w: 40, h: 40 },
    { id: 'yard', name: 'Courtyard', x: 40, y: 0, w: 40, h: 40 }],
  exits: [{ from: 'gate', to: 'yard', label: 'Open arch' }], features: []
};

export async function runClassScoutTurnTests() {
  const db = await import('./db.js');
  const engine = await import('./rpg-engine.js');
  const { AIClient } = await import('./api-client.js');
  const { CATALOG_VERSION } = await import('./class-catalog.js');
  const { validateClassBundle } = await import('./class-portability.js');
  const originalPrompt = AIClient.prototype.sendPrompt;
  const previousImageProvider = process.env.IMAGE_PROVIDER;
  delete process.env.IMAGE_PROVIDER;
  const apiConfig = { provider: 'ollama', model: 'scout-turn-fixture', imageProvider: '' };
  const stages = [];
  let script = {};
  let failNarration = false;
  let campaignId;
  let profileId;
  const row = () => db.get('SELECT * FROM campaigns WHERE id = ?', [campaignId]);
  const world = async () => JSON.parse((await row()).rules_state_json);
  const submit = (state, prose, requestId = randomUUID()) => engine.takeTurn(campaignId, prose, apiConfig,
    state.character.id, state.character.abilityTriggerRevision, { requestId });
  const counts = async () => ({
    turns: (await db.get('SELECT COUNT(*) AS count FROM turns WHERE campaign_id = ?', [campaignId])).count,
    operations: (await db.get('SELECT COUNT(*) AS count FROM rules_turn_operations WHERE campaign_id = ?', [campaignId])).count,
    checks: (await db.get('SELECT COUNT(*) AS count FROM rules_checks WHERE campaign_id = ?', [campaignId])).count,
    revision: (await row()).rules_revision
  });
  AIClient.prototype.sendPrompt = async ({ systemInstruction, prompt }) => {
    const stage = /^AETHERIA_COUNCIL:([a-z_]+)/u.exec(systemInstruction)?.[1];
    if (!stage) {
      if (prompt.startsWith('Draft an epic,')) return JSON.stringify({
        title: 'Partner Scout regression', setting: 'A quiet gatehouse and a safe adjoining courtyard.',
        major_locations: [{ name: 'Gatehouse', description: 'A gate and courtyard with routes that a companion can inspect.' }],
        key_npcs: [{ name: 'Keeper', role: 'Gatehouse steward', personality: 'Patient', quirks: '' }],
        starting_quest: { title: 'Survey the gatehouse', description: 'Finish the deliveries and inspect the old routes.' }
      });
      if (systemInstruction.includes('persistent structured layout')) return JSON.stringify(layout);
      if (systemInstruction.includes('initial Aetheria scene')) return JSON.stringify({
        schemaVersion: 1,
        areas: layout.areas.map(area => ({ area: area.id, terrain: 'dry_ground',
          traits: ['visible', 'safe', 'visited', 'safe_recovery'], surfaces: ['ground'] })),
        actors: [{ actor: 'player', area: 'gate', allegiance: 'party', profile: null, conditions: [] },
          { actor: 'npc0', area: 'gate', allegiance: 'neutral', profile: 'support', conditions: [] },
          { actor: 'companion', area: 'gate', allegiance: 'party', profile: null, conditions: [] }],
        items: [], objects: [], features: [], discoveries: [
          { key: 'yard-route', subject: { kind: 'area', key: 'yard' }, scope: 'companion_scout', fact: YARD_FACT },
          { key: 'gate-tracks', subject: { kind: 'area', key: 'gate' }, scope: 'companion_scout', fact: GATE_FACT }
        ], encounter: { active: false, opposition: [] }
      });
      if (prompt.startsWith('Set the scene and begin the campaign.')) return JSON.stringify({
        narrative: 'Sera and her companion wait at the quiet gate. The courtyard is open.',
        scene_grounding: 'The gate and courtyard are adjacent, unopposed areas.'
      });
      throw new Error(`Unexpected scout setup prompt: ${systemInstruction.slice(0, 80)}`);
    }
    const data = JSON.parse(prompt);
    stages.push(stage);
    switch (stage) {
      case 'interaction': return JSON.stringify({ inputKind: 'committed_action', intent: data.playerInput, answer: null });
      case 'grounding':
      case 'pre_roll': return JSON.stringify({ approved: true,
        reason: 'The recorded adjacent area is safe and unopposed, without time pressure or uncertainty.',
        affirmedOpposed: [], consentingActors: [] });
      case 'referee': {
        let action;
        if (script.kind === 'move') action = { kind: 'ordinary', action: { kind: 'move', area: script.area } };
        else {
          const scout = data.options.abilities.find(ability => ability.name === 'Partner Scout');
          assert.ok(scout, 'The earned exact owned Partner Scout declaration reaches the real Council.');
          action = { kind: 'ability', abilityId: scout.abilityId, bindings: { area: script.area }, options: {} };
        }
        return JSON.stringify({ action, check: null, deltaSources: [],
          noCheckReason: 'The safe recorded area has no opposition, obstacle, urgency or uncertain circumstance.',
          npcTurns: { success: [], failure: [] }, encounter: { success: 'unchanged', failure: 'unchanged' },
          award: script.award ? { kind: 'milestone', id: script.award } : null });
      }
      case 'narration':
        if (failNarration) { failNarration = false; throw new Error('Scout narration outage after durable preparation.'); }
        return JSON.stringify({ narrative: script.kind === 'move' ? 'Sera completes the delivery at the recorded destination.'
          : `The companion returns its findings: ${script.area === 'yard' ? YARD_FACT : GATE_FACT}` });
      default: throw new Error(`Unexpected scout Council stage ${stage}.`);
    }
  };
  try {
    let state = await engine.createCampaign({ genre: 'Fantasy', characterName: 'Sera', ruleset: 'aetheria', apiConfig,
      classSelection: { catalogVersion: CATALOG_VERSION, optionSet: 'expert', familyId: 'bonded', branchId: 'bonded.partner',
        modules: [], capabilities: { rider: false, alliedActors: false } } });
    campaignId = state.campaignId;
    profileId = state.character.player_character_id;
    const ownerRef = `character:${state.character.id}`;
    const startingIds = state.character.abilities.map(ability => ability.id);
    assert.equal(state.character.level, 1);
    assert.equal(state.character.abilities.some(ability => ability.name === 'Partner Scout'), false);
    for (let step = 1; step <= 2; step++) {
      script = { kind: 'move', area: step === 1 ? 'yard' : 'gate', award: `scout-delivery-${step}` };
      state = await submit(state, `I complete delivery ${step} at the ${script.area}.`);
      assert.equal(state.character.level, step + 1);
      assert.equal(state.character.xp, step * 100);
    }
    const scout = state.character.abilities.find(ability => ability.name === 'Partner Scout');
    assert.ok(scout);
    assert.ok(startingIds.every(id => state.character.abilities.some(ability => ability.id === id)));
    assert.ok(state.character.invocableAbilities.some(ability => ability.abilityId === scout.id));
    assert.ok(await db.get('SELECT * FROM character_ability_bindings WHERE campaign_id = ? AND player_character_id = ? AND ability_id = ?',
      [campaignId, profileId, scout.id]));
    const initial = await world();
    const companionRef = initial.actors[ownerRef].classState.companion.actorRef;
    const yardRef = `area:${initial.currentLocationId}:yard`;
    const gateRef = `area:${initial.currentLocationId}:gate`;
    assert.equal(initial.actors[ownerRef].area, 'gate');
    assert.equal(initial.actors[companionRef].area, 'gate');
    assert.equal(initial.actors[ownerRef].knowledge.some(fact => fact.scope === 'companion_scout'), false,
      'The fixture never plants destination discoveries on the caster.');
    assert.equal(initial.areas[yardRef].knowledge.find(fact => fact.fact === YARD_FACT).discovered, false);
    assert.deepEqual(initial.facts, []);

    script = { kind: 'scout', area: 'yard' };
    const requestId = randomUUID();
    const prose = 'I use Partner Scout to inspect the courtyard while I remain at the gate.';
    const before = await counts();
    failNarration = true;
    await assert.rejects(submit(state, prose, requestId), /Scout narration outage/);
    assert.deepEqual(await world(), initial, 'A narration outage cannot commit movement or discovery early.');
    state = await engine.getCampaignState(campaignId);
    assert.equal(state.pendingAction.requestId, requestId);
    const beforeResume = stages.length;
    state = await submit(state, prose, requestId);
    assert.deepEqual(stages.slice(beforeResume), ['narration'], 'Exact resume reuses the durable action rather than scouting twice.');
    const scouted = await world();
    assert.equal(scouted.actors[ownerRef].area, 'gate', 'Scouting never moves the owner.');
    assert.equal(scouted.actors[companionRef].area, 'yard');
    assert.equal(scouted.actors[ownerRef].classState.companion.area, 'yard');
    assert.equal(scouted.areas[yardRef].knowledge.find(fact => fact.fact === YARD_FACT).discovered, true);
    assert.equal(scouted.areas[gateRef].knowledge.find(fact => fact.fact === GATE_FACT).discovered, false);
    assert.equal(scouted.facts.filter(fact => fact.fact === YARD_FACT).length, 1);
    assert.equal(typeof scouted.actors[ownerRef].classState.lastMainOperationId, 'string');
    assert.equal(scouted.actors[ownerRef].classState.lastMainOperationId, scouted.actors[ownerRef].classState.companion.lastMainOperationId,
      'Owner and companion spend one shared Main, never two independent actions.');
    assert.deepEqual(Object.fromEntries(Object.entries(scouted.actors).map(([ref, actor]) => [ref, actor.health])),
      Object.fromEntries(Object.entries(initial.actors).map(([ref, actor]) => [ref, actor.health])), 'Scouting includes no attack or healing.');
    const after = await counts();
    assert.equal(after.turns, before.turns + 1);
    assert.equal(after.operations, before.operations + 1);
    assert.equal(after.checks, before.checks, 'The unopposed no-stakes scout does not invent a roll.');
    await submit(state, prose, requestId);
    assert.deepEqual(await counts(), after);
    assert.deepEqual(await world(), scouted);

    state = await engine.getCampaignState(campaignId);
    assert.equal(state.character.classState.companion.area, 'yard');
    const turn = await db.get('SELECT * FROM turns WHERE campaign_id = ? AND turn_number = ?', [campaignId, state.turn.number]);
    assert.equal(JSON.parse(turn.ability_invocations_json).abilities[0].ability_id, scout.id);
    const reveal = JSON.parse(turn.state_changes_json).rules_effects.find(effect => effect.op === 'reveal');
    assert.equal(reveal.subject, yardRef, 'The persisted effect binds the typed destination, not the caster.');
    assert.match(turn.narrative, /narrow dry passage/);
    const bundle = await engine.exportCampaign(campaignId);
    validateClassBundle(bundle);
    assert.equal(bundle.class_runtime.world.facts.filter(fact => fact.fact === YARD_FACT).length, 1);

    script = { kind: 'scout', area: 'gate' };
    state = await submit(state, 'I use Partner Scout to inspect the gate arch and return beside me.');
    const returned = await world();
    assert.equal(returned.actors[companionRef].area, 'gate');
    assert.equal(returned.facts.filter(fact => fact.fact === GATE_FACT).length, 1);
    assert.equal(returned.facts.filter(fact => fact.fact === YARD_FACT).length, 1);
    const beforeRepeat = await counts();
    script = { kind: 'scout', area: 'yard' };
    await assert.rejects(submit(state, prose), error => error.code === 'CLASS_COUNCIL_REJECTED');
    assert.deepEqual(await world(), returned, 'No new destination fact rejects the entire tentative move and shared Main.');
    assert.deepEqual(await counts(), beforeRepeat, 'An exhausted discovery cannot reserve an operation or spend a turn.');
    assert.equal((await engine.getCampaignState(campaignId)).pendingAction, null);
    validateClassBundle(await engine.exportCampaign(campaignId));
    return { earnedLevel: 3, companionScouts: 2, exactAreaFacts: 2, narrationRetry: true, repeatedDiscoveryRejected: true, providerOnlyStub: true };
  } finally {
    AIClient.prototype.sendPrompt = originalPrompt;
    if (previousImageProvider === undefined) delete process.env.IMAGE_PROVIDER;
    else process.env.IMAGE_PROVIDER = previousImageProvider;
    if (campaignId) await db.run('DELETE FROM campaigns WHERE id = ?', [campaignId]);
    if (profileId) await db.run('DELETE FROM player_characters WHERE id = ?', [profileId]);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const directory = await mkdtemp(path.join(tmpdir(), 'aetheria-scout-turns-'));
  process.env.RPG_DB_PATH = path.join(directory, 'test.db');
  const db = await import('./db.js');
  try {
    await db.initDb();
    console.log('Partner Scout turn tests passed:', await runClassScoutTurnTests());
  } finally {
    await db.closeDb();
    await rm(directory, { recursive: true, force: true });
  }
}
