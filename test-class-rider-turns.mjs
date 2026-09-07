import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

function disposableDatabase() {
  const path = process.env.RPG_DB_PATH;
  const rel = path && relative(tmpdir(), path);
  if (!path || !rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error('Rider tests require an explicit disposable RPG_DB_PATH under the system temporary directory before application imports.');
}

export async function runClassRiderTurnTests() {
  disposableDatabase();
  const db = await import('./db.js');
  const engine = await import('./rpg-engine.js');
  const { AIClient } = await import('./api-client.js');
  const { testSelection, testClassLayout } = await import('./test-class-state.mjs');
  const { prepareClassAction } = await import('./class-actions.js');
  const { prepareNpcConsequence, buildOrdinaryCheckContext } = await import('./class-ordinary.js');
  const { replaceClassVehicle } = await import('./class-progression.js');
  const { validateClassBundle } = await import('./class-portability.js');
  const previousPrompt = AIClient.prototype.sendPrompt;
  const previousImageProvider = process.env.IMAGE_PROVIDER;
  delete process.env.IMAGE_PROVIDER;
  const apiConfig = { provider: 'ollama', model: 'rider-turn-fixture', imageProvider: '' };
  const campaigns = [];
  const profiles = new Set();
  const calls = [];
  let battle = false;
  let terrain = false;
  let support = true;
  let failNarration = false;
  let script = {};
  const layout = { ...structuredClone(testClassLayout), exits: [...testClassLayout.exits, { from: 'yard', to: 'out:Workshop', label: 'Workshop road' }] };
  const readWorld = async id => JSON.parse((await db.get('SELECT rules_state_json FROM campaigns WHERE id = ?', [id])).rules_state_json);
  const submit = (state, text, requestId = randomUUID()) => engine.takeTurn(state.campaignId, text, apiConfig,
    state.character.id, state.character.abilityTriggerRevision, { requestId });
  const review = () => ({ approved: true, reason: 'The exact recorded action and its prerequisites are established.',
    affirmedOpposed: script.opposed || [], consentingActors: [] });
  AIClient.prototype.sendPrompt = async ({ systemInstruction, prompt }) => {
    const stage = /^AETHERIA_COUNCIL:([a-z_]+)/u.exec(systemInstruction)?.[1];
    if (!stage) {
      if (prompt.startsWith('Draft an epic,')) return JSON.stringify({ title: 'The workshop road', setting: 'A gate and an open workshop road.',
        major_locations: [{ name: 'Gatehouse', description: 'A connected gate and yard with workshop access.' }],
        key_npcs: [{ name: 'Mounted Raider', role: 'A hostile mounted unit', personality: 'Resolute', quirks: '' },
          { name: 'Onlooker', role: 'A neutral person', personality: 'Quiet', quirks: '' }],
        starting_quest: { title: 'Open the workshop road', description: 'Defend the gate and reach the workshop.' } });
      if (systemInstruction.includes('persistent structured layout')) return JSON.stringify(layout);
      if (/Author the (?:initial|next) Aetheria scene/u.test(systemInstruction)) {
        const data = JSON.parse(prompt);
        const initial = systemInstruction.includes('initial Aetheria scene');
        return JSON.stringify({ schemaVersion: 1,
          areas: data.layout.areas.map(area => ({ area: area.id, terrain: 'dry_ground',
            traits: ['visible', 'safe', 'visited', ...(support && area.id === (terrain ? 'gate' : 'yard') ? ['safe_recovery'] : [])], surfaces: ['ground'] })),
          actors: Object.entries(data.actors).map(([actor, source]) => ({ actor, area: source.controlled ? initial ? 'gate' : 'yard' : initial && battle ? 'gate' : null,
            allegiance: source.controlled ? 'party' : source.name === 'Mounted Raider' && initial && battle ? 'opposition' : 'neutral',
            profile: source.controlled ? null : source.npcProfile || (source.name === 'Mounted Raider' ? 'mounted' : 'combatant'), conditions: [] })),
          items: [], objects: [], features: initial && terrain ? [
            { key: 'fallen-timber', name: 'Fallen timber', area: 'yard', kind: 'obstruction', duration: 'persistent', worksAgainst: 'party', origin: 'mundane' },
            { key: 'burning-ground', name: 'Burning ground', area: 'yard', kind: 'hazard', duration: 'persistent', worksAgainst: 'party', origin: 'mundane' }
          ] : [], discoveries: [],
          encounter: { active: initial && battle, opposition: initial && battle ? ['npc0'] : [] } });
      }
      if (prompt.startsWith('Set the scene and begin the campaign.')) return JSON.stringify({ narrative: battle
        ? 'A mounted raider blocks the gate. The onlooker stands aside. The yard leads to a safe workshop road.'
        : 'The open gate and yard offer safe practice and a workshop road.', scene_grounding: 'The connected yard provides safe recovery after danger ends.' });
      if (systemInstruction.startsWith('AETHERIA_JOURNEY:arrival')) return JSON.stringify({ narrative: 'The rider reaches the workshop on foot, leaving the lost craft at the gate.' });
      throw new Error(`Unexpected Rider setup call: ${systemInstruction.slice(0, 90)}`);
    }
    const data = JSON.parse(prompt);
    calls.push({ stage, data: structuredClone(data) });
    if (stage === 'interaction') return JSON.stringify({ inputKind: 'committed_action', intent: data.playerInput, answer: null });
    if (stage === 'grounding') return JSON.stringify(review());
    if (stage === 'pre_roll') return JSON.stringify({ ...review(), affirmedOpposed: data.grounding.affirmedOpposed, consentingActors: data.grounding.consentingActors });
    if (stage === 'referee') {
      let action;
      if (script.ability) {
        const selected = data.options.abilities.find(value => value.name === script.ability);
        assert.ok(selected, 'The exact declared owned Rider ability reaches Referee.');
        action = { kind: 'ability', abilityId: selected.abilityId, bindings: script.bindings || {}, options: script.options || {} };
      } else if (script.kind === 'replace_vehicle') {
        assert.ok(data.options.utilities.some(value => value.kind === 'replace_vehicle'));
        action = { kind: 'replace_vehicle' };
      } else if (script.kind === 'journey') action = { kind: 'journey', from: 'yard', exit: 'out:Workshop', basis: 'The recorded workshop road leaves the connected clear yard.' };
      else action = { kind: 'ordinary', action: script.action };
      const npcTurns = script.npc ? [{ npc: script.npc, ...(script.hull ? { actionId: 'hull_strike', target: script.hull } : { wait: 'The unit remains engaged defending its position.' }) }] : [];
      for (const npc of script.extraNpcs || []) npcTurns.push({ npc, wait: 'The newly opposed actor commits to defending its position.' });
      if (script.hull) {
        assert.equal(data.world.actors[script.npc].scale, 'vehicle');
        assert.ok(data.world.vehicles[script.hull]);
        assert.ok(data.world.actors[script.npc].npcActions.some(value => value.kind === 'vehicle_attack'));
      }
      return JSON.stringify({ action, check: script.checked ? { actor: script.actorId, callSeq: 1, intent: data.playerInput,
        tier: 'standard', tierBasis: 'A committed escape maneuver with uncertain footing.',
        deltas: [{ direction: 'favors', magnitude: 'slight', reason: 'The occupied craft has recorded steadied footing.' }] } : null,
        deltaSources: script.checked ? [script.deltaSource] : [], noCheckReason: script.checked ? null : 'This specific committed action has established certainty; NPC consequences still use their exact authored kit.',
        npcTurns: { success: npcTurns, failure: npcTurns }, encounter: { success: script.end ? 'end' : 'unchanged', failure: 'unchanged' },
        award: script.award ? { kind: 'milestone', id: script.award } : null });
    }
    if (stage === 'narration') {
      if (failNarration) { failNarration = false; throw new Error('Simulated Rider narration outage.'); }
      return JSON.stringify({ narrative: 'The declared action completes with exactly the recorded craft and actor consequences.' });
    }
    if (stage === 'annotation') return JSON.stringify({ text: 'The movement leaves a visible trail across the yard.', effects: [] });
    if (stage === 'annotation_review') return JSON.stringify({ approved: true, reason: 'The inert detail leaves the recorded outcome unchanged.', affirmedOpposed: [] });
    throw new Error(`Unexpected Rider Council stage: ${stage}`);
  };
  const create = async (branch = 'rider.ace', profileId = null) => {
    const state = await engine.createCampaign({ genre: 'Fantasy', characterName: 'Ari', ruleset: 'aetheria',
      classSelection: { ...testSelection('rider', branch), capabilities: { rider: true, alliedActors: false } }, apiConfig,
      ...(profileId ? { characterProfileId: profileId, characterMode: 'copy' } : {}) });
    campaigns.push(state.campaignId); profiles.add(state.character.player_character_id); return state;
  };
  try {
    support = false;
    const beforeUnsupported = await db.get('SELECT COUNT(*) AS count FROM campaigns');
    await assert.rejects(create(), /safe recovery|scene.*consisten|replacement/i);
    assert.deepEqual(await db.get('SELECT COUNT(*) AS count FROM campaigns'), beforeUnsupported);
    support = true;
    let training = await create();
    for (let level = 2; level <= 10; level++) {
      script = { action: { kind: 'move', area: level % 2 ? 'gate' : 'yard' }, award: `rider-practice-${level}` };
      training = await submit(training, `I complete the route practice ${level} and move to ${script.action.area}.`);
      assert.equal(training.character.level, level);
    }
    battle = true;
    let state = await create('rider.ace', training.character.player_character_id);
    let world = await readWorld(state.campaignId);
    const actor = `character:${state.character.id}`;
    const npc = Object.keys(world.actors).find(ref => world.actors[ref].name === 'Mounted Raider');
    const person = Object.keys(world.actors).find(ref => world.actors[ref].name === 'Onlooker');
    const craft = world.actors[actor].classState.vehicle.vehicleRef;
    const item = Object.keys(world.items).find(ref => world.items[ref].holder === actor && world.items[ref].weapon);
    const hp = world.actors[actor].health;
    assert.equal(world.actors[npc].scale, 'vehicle');
    assert.equal(world.vehicles[craft].hull, world.vehicles[craft].maxHull);
    assert.throws(() => replaceClassVehicle({ state: world, actor, operationId: randomUUID() }), /safe recovery|genuinely lost/i);
    const beforeInvalid = await db.get('SELECT rules_revision FROM campaigns WHERE id = ?', [state.campaignId]);
    script = { ability: 'Targeted Run', bindings: { targets: [person] }, opposed: [npc, person], npc, extraNpcs: [person] };
    await assert.rejects(submit(state, 'I invoke Targeted Run against the onlooker.'), /vehicle.scale/i);
    assert.deepEqual(await db.get('SELECT rules_revision FROM campaigns WHERE id = ?', [state.campaignId]), beforeInvalid);
    const wrong = structuredClone(world); wrong.vehicles[craft].area = 'yard';
    assert.throws(() => prepareNpcConsequence({ state: wrong, actingActor: actor, npc, actionId: 'hull_strike', target: craft,
      context: { operationId: randomUUID(), turn: 2, round: world.turnOrder.round, affirmedOpposed: [npc] } }), /opposing occupied|range/i);
    const unseen = structuredClone(world); unseen.areas[`area:${world.currentLocationId}:gate`].visible = false;
    assert.throws(() => prepareClassAction({ state: unseen, actor, ability: state.character.abilities.find(value => value.name === 'Targeted Run').id,
      bindings: { targets: [npc] }, context: { operationId: randomUUID(), turn: 2, affirmedOpposed: [npc] } }), /visible vehicle.scale/);
    script = { action: { kind: 'drop', item }, npc, hull: craft, opposed: [npc] };
    state = await submit(state, 'I set down my sidearm while the mounted raider impacts my craft.');
    world = await readWorld(state.campaignId);
    assert.equal(world.vehicles[craft].hull, world.vehicles[craft].maxHull - 5);
    assert.equal(world.actors[actor].health, hp, 'A hull strike does not silently injure its operator.');
    const repair = state.character.abilities.find(value => value.name === 'Field Damage Control');
    const beforeRepair = world.vehicles[craft].hull;
    script = { ability: 'Field Damage Control', npc, opposed: [npc] };
    const requestId = randomUUID(); failNarration = true;
    await assert.rejects(submit(state, 'I invoke Field Damage Control.', requestId), /narration|outage|resume/i);
    assert.equal((await readWorld(state.campaignId)).vehicles[craft].hull, beforeRepair);
    state = await engine.getCampaignState(state.campaignId);
    const resumeAt = calls.length;
    state = await submit(state, 'I invoke Field Damage Control.', requestId);
    assert.deepEqual(calls.slice(resumeAt).map(value => value.stage), ['narration']);
    world = await readWorld(state.campaignId);
    assert.equal(world.vehicles[craft].hull, world.vehicles[craft].maxHull);
    assert.equal(world.actors[actor].classState.recoveryUses[repair.definition_id], 1);
    const repaired = structuredClone(world);
    assert.deepEqual(await submit(state, 'I invoke Field Damage Control.', requestId), state);
    assert.deepEqual(await readWorld(state.campaignId), repaired);
    let damageTurns = 1;
    while (world.vehicles[craft].hull > 0) {
      const held = world.items[item].holder === actor;
      script = { action: { kind: held ? 'drop' : 'pickup', item }, npc, hull: craft, opposed: [npc] };
      state = await submit(state, `I ${held ? 'set down' : 'pick up'} my sidearm as the raider attacks the craft.`);
      world = await readWorld(state.campaignId); damageTurns++;
    }
    assert.equal(world.vehicles[craft].status, 'lost');
    assert.deepEqual(world.vehicles[craft].occupants, []);
    assert.equal(world.actors[actor].classState.vehicle.status, 'lost');
    assert.deepEqual(world.actors[actor].classState.vehicle.occupants, []);
    assert.equal(world.actors[actor].health, hp);
    assert.throws(() => prepareClassAction({ state: world, actor, ability: repair.id,
      context: { turn: 99, operationId: randomUUID(), affirmedOpposed: [npc] } }), /active owned vehicle/);
    while (world.actors[npc].health > 0) {
      const last = world.actors[npc].health <= 2;
      script = { action: { kind: 'attack', target: npc, method: 'unarmed' }, opposed: [npc], ...(last ? { end: true } : { npc }) };
      state = await submit(state, 'I strike the mounted unit directly with an ordinary unarmed attack.');
      world = await readWorld(state.campaignId);
    }
    assert.equal(world.encounter.active, false);
    script = { kind: 'journey' };
    state = await submit(state, 'I walk through the clear yard along the recorded road to the workshop, leaving the wreck behind.');
    world = await readWorld(state.campaignId);
    assert.notEqual(world.currentLocationId, world.vehicles[craft].locationId);
    assert.equal(world.actors[actor].locationId, world.currentLocationId);
    assert.equal(world.vehicles[craft].area, 'gate');
    script = { kind: 'replace_vehicle' };
    state = await submit(state, 'At the workshop I claim my assigned replacement craft.');
    world = await readWorld(state.campaignId);
    const replacement = world.actors[actor].classState.vehicle.vehicleRef;
    assert.notEqual(replacement, craft);
    assert.equal(world.vehicles[replacement].replacementOf, craft);
    assert.equal(world.vehicles[craft].replacedBy, replacement);
    assert.equal(world.vehicles[replacement].hull, world.vehicles[replacement].maxHull);
    assert.deepEqual(world.vehicles[replacement].occupants, [actor]);
    assert.equal(world.vehicles[replacement].locationId, world.currentLocationId);
    assert.equal(world.actors[actor].level, 10);
    assert.deepEqual(state.character.abilities.map(value => value.id), training.character.abilities.map(value => value.id));
    assert.equal((await db.get('SELECT COUNT(*) AS count FROM rules_checks WHERE campaign_id = ?', [state.campaignId])).count, 0, 'NPC craft strikes create no NPC or opposed rolls.');

    script = { ability: 'Evasive Course', bindings: { area: 'gate' }, options: { route: ['gate'] } };
    state = await submit(state, 'I invoke Evasive Course to bring the replacement craft into the gate area.');
    world = await readWorld(state.campaignId);
    const vehicleSource = { kind: 'vehicle_condition', ref: replacement, token: 'steadied' };
    const candidates = input => buildOrdinaryCheckContext({ state: input, actor, skill: 'pilot' }).deltaSources;
    assert.ok(candidates(world).some(value => JSON.stringify(value.source) === JSON.stringify(vehicleSource)));
    assert.ok(!buildOrdinaryCheckContext({ state: world, actor, skill: 'ranged' }).deltaSources.some(value => value.source.kind === 'vehicle_condition'));
    for (const alter of [
      value => { value.vehicles[replacement].occupants = []; },
      value => { value.vehicles[replacement].operator = npc; },
      value => { value.vehicles[replacement].locationId = value.vehicles[craft].locationId; },
      value => { value.vehicles[replacement].conditions.steadied.vehicle = craft; }
    ]) {
      const invalid = structuredClone(world); alter(invalid);
      assert.ok(!candidates(invalid).some(value => value.source.kind === 'vehicle_condition'));
    }
    script = { ability: 'Break Pursuit', bindings: { area: 'yard' }, options: { route: ['yard'] }, checked: true,
      actorId: state.character.id, deltaSource: { ...vehicleSource, ref: craft } };
    const beforeBadSource = await db.get('SELECT rules_revision FROM campaigns WHERE id = ?', [state.campaignId]);
    await assert.rejects(submit(state, 'I invoke Break Pursuit using the lost craft footing.'), /typed evidence/i);
    script.deltaSource = { ...vehicleSource, token: 'inspired' };
    await assert.rejects(submit(state, 'I invoke Break Pursuit using an unrecorded craft inspiration.'), /typed evidence/i);
    assert.deepEqual(await db.get('SELECT rules_revision FROM campaigns WHERE id = ?', [state.campaignId]), beforeBadSource);
    script.deltaSource = vehicleSource;
    state = await submit(state, 'I invoke Break Pursuit through the yard, using the replacement craft steadied footing.');
    world = await readWorld(state.campaignId);
    const pilotChecks = await db.all('SELECT record_json FROM rules_checks WHERE campaign_id = ?', [state.campaignId]);
    assert.equal(pilotChecks.length, 1);
    const pilotCheck = JSON.parse(pilotChecks[0].record_json);
    assert.equal(pilotCheck.actor, state.character.id);
    assert.equal(pilotCheck.sides, 100);
    assert.equal(pilotCheck.deltas[0].direction, 'favors');
    assert.equal(pilotCheck.deltas[0].magnitude, 'slight');

    terrain = true;
    let routeState = await create('rider.ace', training.character.player_character_id);
    let routeWorld = await readWorld(routeState.campaignId);
    const routeActor = `character:${routeState.character.id}`;
    const routeNpc = Object.keys(routeWorld.actors).find(ref => routeWorld.actors[ref].name === 'Mounted Raider');
    const routeVehicle = routeWorld.actors[routeActor].classState.vehicle.vehicleRef;
    const obstruction = Object.keys(routeWorld.features).find(ref => routeWorld.features[ref].kind === 'obstruction');
    script = { ability: 'Targeted Run', bindings: { targets: [routeNpc] }, npc: routeNpc, opposed: [routeNpc] };
    routeState = await submit(routeState, 'I invoke Targeted Run against the mounted raider.');
    routeWorld = await readWorld(routeState.campaignId);
    assert.equal(routeWorld.actors[routeNpc].health, 31);
    assert.ok(routeWorld.actors[routeNpc].conditions.hindered);
    script = { ability: 'Impossible Approach', bindings: { targets: [routeNpc], area: 'yard' }, options: { route: ['yard'] }, npc: routeNpc, opposed: [routeNpc] };
    const routeBefore = structuredClone(routeWorld);
    await assert.rejects(submit(routeState, 'I invoke Impossible Approach through the yard.'), /obstruct|consistent|resolve/i);
    assert.deepEqual(await readWorld(routeState.campaignId), routeBefore);
    const approach = routeState.character.abilities.find(value => value.name === 'Impossible Approach');
    const blocked = structuredClone(routeWorld); blocked.areas[`area:${blocked.currentLocationId}:yard`].blocked = true;
    assert.throws(() => prepareClassAction({ state: blocked, actor: routeActor, ability: approach.id,
      bindings: { ...script.bindings, feature: obstruction }, context: { operationId: randomUUID(), turn: 3, route: ['yard'], affirmedOpposed: [routeNpc] } }), /unblocked/);
    script.bindings.feature = obstruction;
    routeState = await submit(routeState, 'I invoke Impossible Approach, bypassing the fallen timber into the burning yard and striking the mounted raider.');
    routeWorld = await readWorld(routeState.campaignId);
    assert.equal(routeWorld.actors[routeNpc].health, 22);
    assert.equal(routeWorld.vehicles[routeVehicle].hull, routeWorld.vehicles[routeVehicle].maxHull - 5, 'An authored obstruction bypass cannot erase the recorded hazard.');
    assert.equal(routeWorld.vehicles[routeVehicle].area, 'yard');
    assert.equal(routeWorld.features[obstruction].status, 'active', 'Bypassing does not destroy an obstruction for everybody.');

    battle = false; terrain = false;
    let cavalierTraining = await create('rider.cavalier');
    for (let level = 2; level <= 7; level++) {
      script = { action: { kind: 'move', area: level % 2 ? 'gate' : 'yard' }, award: `cavalier-practice-${level}` };
      cavalierTraining = await submit(cavalierTraining, `I complete mounted practice ${level} and move to ${script.action.area}.`);
    }
    battle = true;
    let cavalier = await create('rider.cavalier', cavalierTraining.character.player_character_id);
    const cavalierWorld = await readWorld(cavalier.campaignId);
    const impactNpc = Object.keys(cavalierWorld.actors).find(ref => cavalierWorld.actors[ref].name === 'Mounted Raider');
    script = { ability: 'Driving Impact', bindings: { targets: [impactNpc], area: 'yard' }, npc: impactNpc, opposed: [impactNpc] };
    cavalier = await submit(cavalier, 'I invoke Driving Impact to drive the mounted raider into the clear yard.');
    const impacted = await readWorld(cavalier.campaignId);
    assert.equal(impacted.actors[impactNpc].health, 31);
    assert.equal(impacted.actors[impactNpc].area, 'yard');
    const exported = await engine.exportCampaign(state.campaignId);
    validateClassBundle(exported);
    const imported = await engine.importCampaign(exported);
    campaigns.push(imported.campaignId); profiles.add(imported.character.player_character_id);
    const importedWorld = await readWorld(imported.campaignId);
    assert.equal(Object.values(importedWorld.vehicles).filter(value => value.status === 'lost').length, 1);
    assert.equal(Object.values(importedWorld.vehicles).filter(value => value.status === 'active').length, 1);
    const importedVehicle = importedWorld.actors[`character:${imported.character.id}`].classState.vehicle.vehicleRef;
    assert.ok(importedWorld.vehicles[importedWorld.vehicles[importedVehicle].replacementOf]);
    battle = false;
    const replacementCopy = await create('rider.ace', state.character.player_character_id);
    const copiedWorld = await readWorld(replacementCopy.campaignId);
    const copiedVehicle = copiedWorld.actors[`character:${replacementCopy.character.id}`].classState.vehicle.vehicleRef;
    assert.equal(Object.keys(copiedWorld.vehicles).length, 1);
    assert.equal(copiedWorld.vehicles[copiedVehicle].replacementOf, undefined, 'A new character version cannot acquire foreign live wreck links.');
    assert.equal(copiedWorld.vehicles[copiedVehicle].replacedBy, undefined);
    assert.deepEqual(await readWorld(state.campaignId), world, 'Copying preserves the original campaign wreck and replacement history.');
    const copiedBundle = await engine.exportCampaign(replacementCopy.campaignId);
    validateClassBundle(copiedBundle);
    const copiedImport = await engine.importCampaign(copiedBundle);
    campaigns.push(copiedImport.campaignId); profiles.add(copiedImport.character.player_character_id);
    assert.equal(Object.keys((await readWorld(copiedImport.campaignId)).vehicles).length, 1);
    return { campaigns: campaigns.length, advancementTurns: 15, damageTurns, repair: true, loss: true, walkingJourney: true, replacement: true, targetScale: true, obstructionAndHazard: true, drivingImpact: true, evasivePilotCheck: true, import: true };
  } finally {
    AIClient.prototype.sendPrompt = previousPrompt;
    if (previousImageProvider === undefined) delete process.env.IMAGE_PROVIDER; else process.env.IMAGE_PROVIDER = previousImageProvider;
    for (const id of campaigns.reverse()) await db.run('DELETE FROM campaigns WHERE id = ?', [id]);
    for (const id of profiles) await db.run('DELETE FROM player_characters WHERE id = ?', [id]);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const directory = await mkdtemp(join(tmpdir(), 'aetheria-class-rider-'));
  process.env.RPG_DB_PATH = join(directory, 'test.db');
  disposableDatabase();
  const db = await import('./db.js');
  try { await db.initDb(); console.log('Class Rider turn tests:', await runClassRiderTurnTests()); }
  finally { await db.closeDb(); await rm(directory, { recursive: true, force: true }); }
}
