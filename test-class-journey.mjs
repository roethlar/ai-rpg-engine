import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { relative, resolve, isAbsolute, join } from 'node:path';
import { tmpdir } from 'node:os';

const forestLayout = { name: 'Forest', description: 'A forest trail and clearing.',
  areas: [{ id: 'trail', name: 'Trail', x: 0, y: 0, w: 40, h: 40 }, { id: 'clearing', name: 'Clearing', x: 40, y: 0, w: 40, h: 40 }],
  exits: [{ from: 'trail', to: 'clearing', label: 'Trail' }], features: [] };

function requireDisposableDatabase() {
  const selected = process.env.RPG_DB_PATH;
  const path = selected && relative(resolve(tmpdir()), resolve(selected));
  if (!selected || !path || path.startsWith('..') || isAbsolute(path)) {
    throw new Error('Journey tests require an explicit disposable RPG_DB_PATH under the system temporary directory before any application import.');
  }
}

async function proveJourneyImportGuard() {
  const { mkdtemp, writeFile, readFile, readdir, rm } = await import('node:fs/promises');
  const { spawnSync } = await import('node:child_process');
  const directory = await mkdtemp(fileURLToPath(new URL('./.journey-guard-', import.meta.url)));
  const database = join(directory, 'untouched.db');
  const sentinel = Buffer.from('A test-only sentinel, not a database.');
  await writeFile(database, sentinel);
  try {
    const script = `import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
const imports = [];
registerHooks({ resolve(specifier, context, next) {
  const result = next(specifier, context);
  if (result.url.startsWith(${JSON.stringify(new URL('.', import.meta.url).href)}) && result.url !== ${JSON.stringify(import.meta.url)}) imports.push(result.url);
  return result;
} });
const module = await import(${JSON.stringify(import.meta.url)});
await assert.rejects(module.runClassJourneyTests({ verifyIsolation: false }), /explicit disposable RPG_DB_PATH/);
assert.deepEqual(imports, [], 'No application module may load before the disposable database guard.');`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      env: { ...process.env, RPG_DB_PATH: database }, encoding: 'utf8', timeout: 30000 });
    assert.equal(result.status, 0, `The database isolation subprocess must reject before app imports: ${result.stderr}`);
    assert.deepEqual(await readFile(database), sentinel);
    assert.deepEqual(await readdir(directory), ['untouched.db'], 'Refusal creates no database journals or side files.');
  } finally { await rm(directory, { recursive: true, force: true }); }
}

export async function runClassJourneyTests({ verifyIsolation = true } = {}) {
  requireDisposableDatabase();
  if (verifyIsolation) await proveJourneyImportGuard();
  const db = await import('./db.js');
  const { prepareClassJourney } = await import('./class-journey.js');
  const { testClassLayout, testSelection } = await import('./test-class-state.mjs');
  const { validateClassBundle } = await import('./class-portability.js');
  const originLayout = { ...testClassLayout, exits: [...testClassLayout.exits, { from: 'yard', to: 'out:Forest', label: 'Forest path' }] };
  const engine = await import('./rpg-engine.js');
  const { AIClient } = await import('./api-client.js');
  const originalPrompt = AIClient.prototype.sendPrompt;
  const priorImageProvider = process.env.IMAGE_PROVIDER;
  delete process.env.IMAGE_PROVIDER;
  const campaigns = [];
  const profiles = new Set();
  let layoutFailures = 0;
  let narrationFailures = 0;
  let invalidArrivalFrames = 0;
  let invalidExit = false;
  let invalidJourneyRuling = false;
  let consentAll = true;
  let raceCampaignId = null;
  const calls = [];
  const apiConfig = { provider: 'ollama', model: 'class-journey-fixture', imageProvider: '' };
  AIClient.prototype.sendPrompt = async ({ systemInstruction, prompt }) => {
    if (prompt.startsWith('Draft an epic,')) return JSON.stringify({ title: 'The forest road', setting: 'A gatehouse beside the forest.',
      major_locations: [{ name: 'Gatehouse', description: 'A gatehouse.' }, { name: 'Forest', description: 'The road leads to the forest.' }],
      key_npcs: [{ name: 'Keeper', role: 'Gate keeper', personality: 'Quiet', quirks: '' },
        { name: 'Scout', role: 'Forest scout', personality: 'Watchful', quirks: '' }],
      starting_quest: { title: 'Follow the road', description: 'Find the scout in the forest.' } });
    if (prompt.startsWith('Set the scene and begin the campaign.')) return JSON.stringify({ narrative: 'Mira and the keeper wait beside the gate. The forest road leaves through the courtyard.', scene_grounding: 'Mira stands at the gate.' });
    if (systemInstruction.includes('persistent structured layout')) {
      const next = prompt.includes('called "Forest"');
      calls.push(next ? 'destination_layout' : 'origin_layout');
      if (next && layoutFailures > 0) { layoutFailures--; throw new Error('Destination layout transport failed.'); }
      return JSON.stringify(next ? forestLayout : originLayout);
    }
    if (systemInstruction.startsWith('AETHERIA_JOURNEY:arrival')) {
      calls.push('arrival_draft');
      return JSON.stringify({ narrative: 'Mira arrives on the forest trail. The scout waits there beside Cora, a traveler resting against a tree.' });
    }
    if (systemInstruction.includes('Aetheria scene as structured world facts')) {
      const data = JSON.parse(prompt);
      const next = systemInstruction.includes('next Aetheria');
      calls.push(next ? 'destination_scene' : 'origin_scene');
      const duplicateCondition = next && invalidArrivalFrames-- > 0;
      if (next && raceCampaignId) {
        await db.run('UPDATE campaigns SET rules_revision = rules_revision + 1 WHERE id = ?', [raceCampaignId]);
        raceCampaignId = null;
      }
      return JSON.stringify({ schemaVersion: 1,
        areas: data.layout.areas.map(area => ({ area: area.id, terrain: 'dry_ground', traits: ['visible', 'safe', 'visited', 'safe_recovery'], surfaces: ['ground'] })),
        actors: Object.entries(data.actors).map(([actor, source]) => ({ actor,
          area: source.controlled ? next ? 'trail' : 'gate' : source.name === 'Keeper' ? next ? duplicateCondition ? 'trail' : null : 'gate' : next ? 'trail' : null,
          allegiance: source.controlled ? 'party' : 'neutral', profile: source.controlled ? null : source.npcProfile || 'support',
          conditions: source.name === 'Keeper' && (!next || duplicateCondition) ? [{ kind: 'winded', duration: 'persistent', detail: 'The keeper remains winded.' }] : [] }))
          .concat(next ? [{ actor: 'new1', area: 'trail', allegiance: 'neutral', profile: 'support',
            conditions: [{ kind: 'winded', duration: 'persistent', detail: 'Cora is winded from a long walk.' }] }] : []),
        items: [], objects: [], features: [], discoveries: [], encounter: { active: false, opposition: [] },
        ...(next ? { newActors: [{ key: 'new1', name: 'Cora', role: 'Traveling stranger', evidence: 'Cora, a traveler resting against a tree' }] } : {}) });
    }
    const match = /^AETHERIA_COUNCIL:([a-z_]+)/u.exec(systemInstruction);
    if (!match) throw new Error(`Unexpected journey provider call: ${systemInstruction.slice(0, 90)}`);
    const stage = match[1];
    const data = JSON.parse(prompt);
    calls.push(stage);
    const review = { approved: true, reason: 'The party explicitly follows the clear recorded external exit.', affirmedOpposed: [],
      consentingActors: consentAll ? Object.keys(data.world?.actors || {}).filter(ref => ref.startsWith('character:') && ref !== `character:${data.actor}`) : [] };
    switch (stage) {
      case 'interaction': return JSON.stringify({ inputKind: 'committed_action', intent: data.playerInput, answer: null });
      case 'grounding': case 'pre_roll': return JSON.stringify(review);
      case 'referee': {
        const exit = data.journeyExits[0];
        return JSON.stringify({ action: { kind: 'journey', from: exit.from, exit: invalidExit ? 'out:Moon' : exit.exit,
          basis: `Follow the clear ${exit.label} from ${exit.from}.` }, check: null, deltaSources: [],
          noCheckReason: 'Clear walking on the recorded exit has no uncertainty.', npcTurns: { success: invalidJourneyRuling ? {} : [], failure: [] },
          encounter: { success: 'unchanged', failure: 'unchanged' }, award: null });
      }
      case 'narration':
        assert.ok(data.sceneIntroduction);
        assert.ok(data.sceneIntroduction.authority.includes('binding world'));
        if (data.sceneIntroduction.arrivalDraft) {
          assert.ok(data.sceneIntroduction.arrivalDraft.includes('Cora'));
          assert.ok(Object.values(data.worldAfter.actors).some(actor => actor.name === 'Scout'));
        }
        if (narrationFailures > 0) { narrationFailures--; throw new Error('Journey narration transport failed.'); }
        return JSON.stringify({ narrative: 'Mira follows the recorded road and arrives with her mount.' });
      default: throw new Error(`Unexpected journey Council stage ${stage}`);
    }
  };
  const row = id => db.get('SELECT * FROM campaigns WHERE id = ?', [id]);
  const worldOf = record => JSON.parse(record.rules_state_json);
  const submit = (state, prose, requestId) => engine.takeTurn(state.campaignId, prose, apiConfig,
    state.character.id, state.character.abilityTriggerRevision, { requestId });
  try {
    let state = await engine.createCampaign({ genre: 'Fantasy', characterName: 'Mira', ruleset: 'aetheria',
      classSelection: { ...testSelection('rider', 'rider.cavalier'), capabilities: { rider: true, alliedActors: false } }, apiConfig });
    campaigns.push(state.campaignId); profiles.add(state.character.player_character_id);
    state = await engine.joinCampaign(state.campaignId, { characterName: 'Tess',
      classSelection: { ...testSelection('armsmaster', 'armsmaster.discipline'), capabilities: { rider: true, alliedActors: false } } });
    for (const member of state.party) profiles.add(member.player_character_id);
    const initial = await row(state.campaignId);
    const initialWorld = worldOf(initial);
    const actor = `character:${state.character.id}`;
    const vehicleRef = initialWorld.actors[actor].classState.vehicle.vehicleRef;
    const keeperRef = Object.keys(initialWorld.actors).find(ref => initialWorld.actors[ref].name === 'Keeper');
    const scoutRef = Object.keys(initialWorld.actors).find(ref => initialWorld.actors[ref].name === 'Scout');
    assert.equal((await db.get('SELECT COUNT(*) AS n FROM locations WHERE campaign_id = ?', [state.campaignId])).n, 1, 'Creation does not frontload outline locations.');
    const location = { id: initialWorld.currentLocationId, name: 'Gatehouse', layout: originLayout };
    const action = { kind: 'journey', from: 'yard', exit: 'out:Forest', basis: 'Walk through the clear courtyard to the forest path.' };
    const otherPlayer = Object.keys(initialWorld.actors).find(ref => ref.startsWith('character:') && ref !== actor);
    const consent = [otherPlayer];
    assert.doesNotThrow(() => prepareClassJourney({ state: initialWorld, actor, action, location, consentingActors: consent }));
    assert.throws(() => prepareClassJourney({ state: initialWorld, actor, action: { ...action, exit: 'out:Moon' }, location, consentingActors: consent }), /not recorded/);
    for (const mutate of [world => { world.encounter.active = true; }, world => { world.areas[`area:${location.id}:yard`].blocked = true; },
      world => { world.actors[actor].conditions.hindered = { duration: 'scene' }; }, world => { world.areas[`area:${location.id}:gate`].adjacent = []; }]) {
      const world = structuredClone(initialWorld); mutate(world);
      assert.throws(() => prepareClassJourney({ state: world, actor, action, location, consentingActors: consent }), /encounter|clear/);
    }
    const unconsented = structuredClone(initialWorld);
    unconsented.actors[keeperRef].party = true;
    assert.throws(() => prepareClassJourney({ state: unconsented, actor, action, location }), /agree|consent/);
    assert.doesNotThrow(() => prepareClassJourney({ state: unconsented, actor, action, location, consentingActors: [otherPlayer, keeperRef] }));
    consentAll = false;
    await assert.rejects(submit(state, 'I take everyone through the forest exit.', randomUUID()), /agree|consent/);
    assert.equal((await db.get('SELECT COUNT(*) AS n FROM rules_turn_operations WHERE campaign_id = ?', [state.campaignId])).n, 0);
    consentAll = true;
    invalidExit = true;
    await assert.rejects(submit(state, 'I walk to the moon.', randomUUID()), /exit|recorded/);
    assert.equal((await db.get('SELECT COUNT(*) AS n FROM rules_turn_operations WHERE campaign_id = ?', [state.campaignId])).n, 0);
    invalidExit = false;
    invalidJourneyRuling = true;
    await assert.rejects(submit(state, 'I follow the forest path.', randomUUID()), /journey cannot invent/);
    assert.equal((await db.get('SELECT COUNT(*) AS n FROM rules_turn_operations WHERE campaign_id = ?', [state.campaignId])).n, 0);
    invalidJourneyRuling = false;

    const requestId = randomUUID();
    const prose = 'I ride through the clear courtyard and follow the forest path.';
    layoutFailures = 1;
    await assert.rejects(submit(state, prose, requestId), /layout|pending journey/);
    const accepted = await db.get("SELECT * FROM rules_turn_operations WHERE campaign_id = ? AND status = 'active'", [state.campaignId]);
    assert.equal(accepted.stage, 'accepted');
    assert.equal((await db.get('SELECT COUNT(*) AS n FROM locations WHERE campaign_id = ?', [state.campaignId])).n, 1);
    assert.deepEqual(worldOf(await row(state.campaignId)), initialWorld);
    const beforeResume = calls.length;
    invalidArrivalFrames = 1;
    await assert.rejects(submit(state, prose, requestId), /overwrite an existing condition/);
    assert.equal((await db.get('SELECT COUNT(*) AS n FROM locations WHERE campaign_id = ?', [state.campaignId])).n, 1, 'Failed materialization rolls back reserved destination rows.');
    assert.equal((await db.get('SELECT COUNT(*) AS n FROM npcs WHERE campaign_id = ?', [state.campaignId])).n, 2);
    narrationFailures = 1;
    await assert.rejects(submit(state, prose, requestId), /narration transport/);
    assert.ok(!calls.slice(beforeResume).includes('referee'), 'Retry resumes the exact accepted journey without reruling.');
    const pending = await db.get("SELECT * FROM rules_turn_operations WHERE campaign_id = ? AND status = 'active'", [state.campaignId]);
    assert.equal(pending.stage, 'resolved');
    const checkpoint = JSON.parse(pending.checkpoint_json);
    const destinationId = checkpoint.journey.locationId;
    const coraRef = checkpoint.journey.actorBindings.new1;
    const pendingNpc = await db.get('SELECT * FROM npcs WHERE id = ?', [Number(coraRef.slice(4))]);
    assert.ok(pendingNpc.voice_json, 'New NPC voice identity is stored once with the reserved real ID.');
    assert.equal(pendingNpc.pending_rules_operation_id, pending.id);
    assert.equal((await engine.getCampaignState(state.campaignId)).npcs.some(npc => npc.name === 'Cora'), false);
    assert.deepEqual(worldOf(await row(state.campaignId)), initialWorld, 'Pending scenery cannot modify the published world.');
    await assert.rejects(engine.exportCampaign(state.campaignId), /pending|unresolved/i);
    await assert.rejects(engine.forkCampaign(state.campaignId, 1, 'Pending fork'), /pending|unresolved/i);
    const beforeNarrationRetry = calls.length;
    state = await submit(state, prose, requestId);
    assert.deepEqual(calls.slice(beforeNarrationRetry), ['narration']);
    const arrived = worldOf(await row(state.campaignId));
    assert.equal(arrived.currentLocationId, destinationId);
    assert.equal(arrived.actors[actor].area, 'trail');
    assert.equal(arrived.vehicles[vehicleRef].locationId, destinationId);
    assert.equal(arrived.actors[actor].classState.vehicle.area, 'trail');
    assert.equal(arrived.actors[scoutRef].locationId, destinationId, 'A known absent NPC becomes present under its original ID.');
    assert.equal(arrived.actors[scoutRef].present, true);
    for (const field of ['locationId', 'area', 'present', 'party', 'allegiance', 'health', 'npcKit']) assert.deepEqual(arrived.actors[keeperRef][field], initialWorld.actors[keeperRef][field]);
    assert.equal(arrived.actors[coraRef].conditions.winded.duration, 'persistent');
    assert.equal(arrived.actors[keeperRef].conditions.winded.duration, 'persistent');
    const blockedReturn = structuredClone(arrived);
    blockedReturn.areas[`area:${initialWorld.currentLocationId}:yard`].blocked = true;
    const forest = await db.get('SELECT * FROM locations WHERE id = ?', [destinationId]);
    assert.throws(() => prepareClassJourney({ state: blockedReturn, actor, action: { kind: 'journey', from: 'trail', exit: 'out:Gatehouse', basis: 'Return by the same road.' },
      location: { id: destinationId, name: 'Forest', layout: JSON.parse(forest.layout_json) }, consentingActors: [otherPlayer] }), /arrival is blocked/);
    assert.equal((await db.get('SELECT pending_rules_operation_id FROM npcs WHERE id = ?', [Number(coraRef.slice(4))])).pending_rules_operation_id, null);
    assert.equal((await db.get('SELECT COUNT(*) AS n FROM rules_checks WHERE campaign_id = ?', [state.campaignId])).n, 0, 'A clear journey never manufactures a roll.');
    const turn = await db.get('SELECT * FROM turns WHERE campaign_id = ? ORDER BY turn_number DESC LIMIT 1', [state.campaignId]);
    assert.deepEqual(JSON.parse(turn.rules_snapshot_json), arrived);
    assert.equal(JSON.parse(turn.state_changes_json).rules_effects.find(effect => effect.op === 'location_transition').resolvedTargets.location, `location:${destinationId}`);
    const destinationCalls = calls.filter(call => ['destination_layout', 'arrival_draft', 'destination_scene'].includes(call)).length;
    state = await submit(state, 'I return along the same road to the gatehouse.', randomUUID());
    const returned = worldOf(await row(state.campaignId));
    assert.equal(returned.currentLocationId, initialWorld.currentLocationId);
    assert.equal(returned.actors[keeperRef].present, true);
    state = await submit(state, 'I follow the forest path again.', randomUUID());
    const revisited = worldOf(await row(state.campaignId));
    assert.equal(revisited.currentLocationId, destinationId);
    assert.equal(revisited.actors[coraRef].conditions.winded.duration, 'persistent');
    assert.equal(calls.filter(call => ['destination_layout', 'arrival_draft', 'destination_scene'].includes(call)).length, destinationCalls, 'Revisits do not regenerate scenery or reset NPCs.');
    assert.equal((await db.get('SELECT COUNT(*) AS n FROM locations WHERE campaign_id = ?', [state.campaignId])).n, 2);
    const bundle = await engine.exportCampaign(state.campaignId);
    validateClassBundle(bundle);
    const imported = await engine.importCampaign(bundle);
    campaigns.push(imported.campaignId); profiles.add(imported.character.player_character_id);
    const importedWorld = worldOf(await row(imported.campaignId));
    assert.notEqual(importedWorld.currentLocationId, destinationId);
    assert.ok(Object.values(importedWorld.areas).some(area => area.journeyRoutes?.some(route => route.destination.startsWith(`area:${importedWorld.currentLocationId}:`))));
    assert.deepEqual(imported.character.abilities.map(ability => ability.id), state.character.abilities.map(ability => ability.id), 'Travel portability preserves owned declaration identities.');
    validateClassBundle(await engine.exportCampaign(imported.campaignId));
    const forked = await engine.forkCampaign(state.campaignId, 1, 'Before the journey');
    campaigns.push(forked.campaignId); profiles.add(forked.character.player_character_id);
    const forkedWorld = worldOf(await row(forked.campaignId));
    assert.equal(new Set(Object.values(forkedWorld.areas).map(area => area.locationId)).size, 1);
    assert.ok(!Object.values(forkedWorld.actors).some(actor => actor.name === 'Cora'), 'A prior-turn fork contains no future destination NPC.');
    validateClassBundle(await engine.exportCampaign(forked.campaignId));
    const raced = await engine.createCampaign({ genre: 'Fantasy', characterName: 'Mira', ruleset: 'aetheria',
      classSelection: { ...testSelection('armsmaster', 'armsmaster.discipline'), modules: [], capabilities: { rider: false, alliedActors: false } }, apiConfig });
    campaigns.push(raced.campaignId); profiles.add(raced.character.player_character_id);
    const beforeRace = worldOf(await row(raced.campaignId));
    raceCampaignId = raced.campaignId;
    await assert.rejects(submit(raced, 'I follow the recorded forest path.', randomUUID()), /changed before destination identities/);
    assert.equal((await db.get('SELECT COUNT(*) AS n FROM locations WHERE campaign_id = ?', [raced.campaignId])).n, 1);
    assert.equal((await db.get('SELECT COUNT(*) AS n FROM npcs WHERE campaign_id = ?', [raced.campaignId])).n, 2);
    assert.deepEqual(worldOf(await row(raced.campaignId)), beforeRace, 'A concurrent revision change rejects before any destination rows or world updates.');
    return { realCreations: 2, journeys: 3, providerOnlyStub: true, destinationIdentityRetries: 3, portableCopies: 2 };
  } finally {
    AIClient.prototype.sendPrompt = originalPrompt;
    if (priorImageProvider === undefined) delete process.env.IMAGE_PROVIDER; else process.env.IMAGE_PROVIDER = priorImageProvider;
    for (const id of campaigns) {
      for (const character of await db.all('SELECT player_character_id FROM characters WHERE campaign_id = ?', [id])) profiles.add(character.player_character_id);
      await db.run('DELETE FROM campaigns WHERE id = ?', [id]);
    }
    for (const id of profiles) if (id) await db.run('DELETE FROM player_characters WHERE id = ?', [id]);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const directory = await mkdtemp(join(tmpdir(), 'aetheria-class-journey-'));
  process.env.RPG_DB_PATH = join(directory, 'test.db');
  requireDisposableDatabase();
  const db = await import('./db.js');
  try { await db.initDb(); console.log('Class journey tests passed:', await runClassJourneyTests()); }
  finally { await db.closeDb(); await rm(directory, { recursive: true, force: true }); }
}
