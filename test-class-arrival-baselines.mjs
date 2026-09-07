import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function runClassArrivalBaselineTests() {
  const database = process.env.RPG_DB_PATH;
  const relativeDatabase = database && relative(tmpdir(), database);
  if (!database || !relativeDatabase || relativeDatabase.startsWith('..') || isAbsolute(relativeDatabase)) {
    throw new Error('Arrival baseline tests require a disposable RPG_DB_PATH under the system temporary directory before application imports.');
  }
  const db = await import('./db.js');
  const engine = await import('./rpg-engine.js');
  const { AIClient } = await import('./api-client.js');
  const { CATALOG_VERSION } = await import('./class-catalog.js');
  const previousPrompt = AIClient.prototype.sendPrompt;
  const previousImageProvider = process.env.IMAGE_PROVIDER;
  delete process.env.IMAGE_PROVIDER;
  const apiConfig = { provider: 'ollama', model: 'arrival-baseline-fixture', imageProvider: '' };
  const campaigns = [];
  const profiles = new Set();
  let script = {};
  const layout = { name: 'Gatehouse', description: 'An open gate and safe adjoining yard.',
    areas: [{ id: 'gate', name: 'Gate', x: 0, y: 0, w: 40, h: 40 },
      { id: 'yard', name: 'Yard', x: 40, y: 0, w: 40, h: 40 }],
    exits: [{ from: 'gate', to: 'yard', label: 'Open arch' }], features: [] };
  const characterRow = id => db.get('SELECT * FROM characters WHERE id = ?', [id]);
  const campaignRow = id => db.get('SELECT * FROM campaigns WHERE id = ?', [id]);
  const world = async id => JSON.parse((await campaignRow(id)).rules_state_json);
  const remember = state => {
    campaigns.push(state.campaignId);
    for (const character of state.party) profiles.add(character.player_character_id);
    return state;
  };
  const create = async profileId => remember(await engine.createCampaign({ genre: 'Fantasy', characterName: 'Ari',
    ruleset: 'aetheria', apiConfig, ...(profileId ? { characterProfileId: profileId, characterMode: 'copy' } : {
      classSelection: { catalogVersion: CATALOG_VERSION, optionSet: 'expert', familyId: 'rider', branchId: 'rider.ace',
        modules: ['rider'], capabilities: { rider: true, alliedActors: false } }
    }) }));
  const submit = (state, prose) => engine.takeTurn(state.campaignId, prose, apiConfig,
    state.character.id, state.character.abilityTriggerRevision, { requestId: randomUUID() });
  const verifyArrival = async (state, character) => {
    const baseline = JSON.parse((await characterRow(character.id)).baseline_json);
    const current = await world(state.campaignId);
    assert.deepEqual(baseline.inventory, character.inventory,
      'Arrival captures destination-bound item IDs, not the source profile inventory.');
    assert.ok(baseline.inventory.length > 0);
    assert.ok(baseline.inventory.every(item => current.items[item.id]?.holder === `character:${character.id}`));
    assert.equal(baseline.classState.vehicle.vehicleRef, character.classState.vehicle.vehicleRef);
    assert.ok(current.vehicles[baseline.classState.vehicle.vehicleRef], 'Arrival binds the destination vehicle identity too.');
    assert.equal(baseline.level, 3);
    return baseline;
  };
  AIClient.prototype.sendPrompt = async ({ systemInstruction, prompt }) => {
    const stage = /^AETHERIA_COUNCIL:([a-z_]+)/u.exec(systemInstruction)?.[1];
    if (!stage) {
      if (prompt.startsWith('Draft an epic,')) return JSON.stringify({ title: 'Arrival baseline regression',
        setting: 'A safe gatehouse and workshop yard.', major_locations: [{ name: 'Gatehouse', description: layout.description }],
        key_npcs: [{ name: 'Keeper', role: 'Steward', personality: 'Patient', quirks: '' }],
        starting_quest: { title: 'Practice the route', description: 'Complete the quiet deliveries.' } });
      if (systemInstruction.includes('persistent structured layout')) return JSON.stringify(layout);
      if (systemInstruction.includes('initial Aetheria scene')) {
        const data = JSON.parse(prompt);
        return JSON.stringify({ schemaVersion: 1,
          areas: layout.areas.map(area => ({ area: area.id, terrain: 'dry_ground',
            traits: ['visible', 'safe', 'visited', 'safe_recovery'], surfaces: ['ground'] })),
          actors: Object.entries(data.actors).map(([actor, source]) => ({ actor, area: 'gate',
            allegiance: source.controlled ? 'party' : 'neutral', profile: source.controlled ? null : 'support', conditions: [] })),
          items: [], objects: [], features: [], discoveries: [], encounter: { active: false, opposition: [] } });
      }
      if (prompt.startsWith('Set the scene and begin the campaign.')) return JSON.stringify({
        narrative: 'Ari waits at the open gate. The adjoining workshop yard offers safe recovery.',
        scene_grounding: 'The clear gate and yard are adjacent and unopposed.' });
      throw new Error(`Unexpected arrival setup prompt: ${systemInstruction.slice(0, 80)}`);
    }
    const data = JSON.parse(prompt);
    if (stage === 'interaction') return JSON.stringify({ inputKind: 'committed_action', intent: data.playerInput, answer: null });
    if (stage === 'grounding' || stage === 'pre_roll') return JSON.stringify({ approved: true,
      reason: 'The explicit ordinary action is unopposed and certain in the safe recorded area.',
      affirmedOpposed: [], consentingActors: [] });
    if (stage === 'referee') return JSON.stringify({ action: { kind: 'ordinary', action: script.action },
      check: null, deltaSources: [], noCheckReason: 'No opposition, obstacle or urgency makes this ordinary action uncertain.',
      npcTurns: { success: [], failure: [] }, encounter: { success: 'unchanged', failure: 'unchanged' },
      award: script.award ? { kind: 'milestone', id: script.award } : null });
    if (stage === 'narration') return JSON.stringify({ narrative: 'Ari completes the declared action at the gatehouse.' });
    throw new Error(`Unexpected arrival Council stage: ${stage}`);
  };
  try {
    let source = await create();
    for (let step = 1; step <= 2; step++) {
      script = { action: { kind: 'move', area: step === 1 ? 'yard' : 'gate' }, award: `arrival-practice-${step}` };
      source = await submit(source, `I complete delivery ${step} at the ${script.action.area}.`);
    }
    assert.equal(source.character.level, 3, 'Copied progression is earned by actual Council turns.');
    const sourceSnapshot = {
      campaign: await campaignRow(source.campaignId), character: await characterRow(source.character.id),
      profile: await db.get('SELECT * FROM player_characters WHERE id = ?', [source.character.player_character_id]),
      turns: await db.all('SELECT * FROM turns WHERE campaign_id = ? ORDER BY id', [source.campaignId])
    };
    const sourceItems = new Set(source.character.inventory.map(item => item.id));
    let copy = await create(source.character.player_character_id);
    const copyArrival = await verifyArrival(copy, copy.character);
    assert.ok(copy.character.inventory.every(item => !sourceItems.has(item.id)));
    assert.deepEqual(copy.character.abilities, source.character.abilities, 'Copying retains owned ability identities and earned grants.');
    assert.notEqual(copy.character.player_character_id, source.character.player_character_id);
    const copyBundle = await engine.exportCampaign(copy.campaignId);
    remember(await engine.importCampaign(copyBundle));

    const destination = await create();
    const founderBaseline = (await characterRow(destination.character.id)).baseline_json;
    const joined = await engine.joinCampaign(destination.campaignId, {
      characterProfileId: source.character.player_character_id, characterMode: 'copy'
    });
    const member = joined.party.find(character => character.id === joined.joinedCharacterId);
    profiles.add(member.player_character_id);
    await verifyArrival(joined, member);
    assert.ok(member.inventory.every(item => !sourceItems.has(item.id)));
    assert.equal((await characterRow(destination.character.id)).baseline_json, founderBaseline,
      'Joining establishes only the new row baseline, never the existing founder history.');
    remember(await engine.importCampaign(await engine.exportCampaign(destination.campaignId)));

    script = { action: { kind: 'drop', item: copy.character.inventory.find(item => item.equipmentId === 'equipment.sidearm').id } };
    copy = await submit(copy, 'I set down my sidearm at the gate.');
    assert.deepEqual(JSON.parse((await characterRow(copy.character.id)).baseline_json), copyArrival,
      'Later item movement cannot rebase the immutable arrival snapshot.');
    const changedCopyBundle = await engine.exportCampaign(copy.campaignId);
    remember(await engine.importCampaign(changedCopyBundle));

    const incompatible = structuredClone(changedCopyBundle);
    const oldBaseline = JSON.parse(incompatible.characters[0].baseline_json);
    oldBaseline.inventory[0].id = source.character.inventory[0].id;
    incompatible.characters[0].baseline_json = JSON.stringify(oldBaseline);
    const beforeRejectedImport = {
      campaigns: await db.get('SELECT COUNT(*) AS count FROM campaigns'),
      characters: await db.get('SELECT COUNT(*) AS count FROM characters'),
      profiles: await db.get('SELECT COUNT(*) AS count FROM player_characters')
    };
    await assert.rejects(engine.importCampaign(incompatible), /Missing items identity mapping/,
      'An already-created incompatible development copy fails explicitly without guessed identity repair.');
    assert.deepEqual({ campaigns: await db.get('SELECT COUNT(*) AS count FROM campaigns'),
      characters: await db.get('SELECT COUNT(*) AS count FROM characters'),
      profiles: await db.get('SELECT COUNT(*) AS count FROM player_characters') }, beforeRejectedImport,
    'The incompatible import transaction leaves no partial campaign, character or profile.');
    const { exported_at: afterExportTime, ...afterRejectedExport } = await engine.exportCampaign(copy.campaignId);
    const { exported_at: beforeExportTime, ...beforeRejectedExport } = changedCopyBundle;
    assert.ok(afterExportTime && beforeExportTime);
    assert.deepEqual(afterRejectedExport, beforeRejectedExport);
    assert.deepEqual({ campaign: await campaignRow(source.campaignId), character: await characterRow(source.character.id),
      profile: await db.get('SELECT * FROM player_characters WHERE id = ?', [source.character.player_character_id]),
      turns: await db.all('SELECT * FROM turns WHERE campaign_id = ? ORDER BY id', [source.campaignId]) }, sourceSnapshot,
    'Copy/create/join/import preserve the source owner, profile, history and baseline exactly.');
    return { earnedLevel: 3, createCopy: true, joinCopy: true, roundtrips: 3,
      sourcePreserved: true, incompatibleImportAtomic: true, providerOnlyStub: true };
  } finally {
    AIClient.prototype.sendPrompt = previousPrompt;
    if (previousImageProvider === undefined) delete process.env.IMAGE_PROVIDER;
    else process.env.IMAGE_PROVIDER = previousImageProvider;
    for (const campaignId of campaigns.reverse()) await db.run('DELETE FROM campaigns WHERE id = ?', [campaignId]);
    for (const profileId of profiles) await db.run('DELETE FROM player_characters WHERE id = ?', [profileId]);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const directory = await mkdtemp(join(tmpdir(), 'aetheria-arrival-baselines-'));
  process.env.RPG_DB_PATH = join(directory, 'test.db');
  const db = await import('./db.js');
  try {
    await db.initDb();
    console.log('Class arrival baseline tests passed:', await runClassArrivalBaselineTests());
  } finally {
    await db.closeDb();
    await rm(directory, { recursive: true, force: true });
  }
}
