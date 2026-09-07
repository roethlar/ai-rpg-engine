import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { testSelection, testClassLayout } from './test-class-state.mjs';
import { createClassRuleset, createRulesWorld } from './class-state.js';
import { buildClassScenario } from './class-scenario.js';
import { advanceClassCharacter } from './class-progression.js';
import { evaluateEffects } from './rules-effects.js';
import { normalizeCheckRecord } from './rules-resolution.js';
import { validateCampaignBundle, validateOutlineData } from './rpg-state.js';
import { validateClassBundle } from './class-portability.js';
import { emptyAbilityInvocationRecord } from './ability-trigger-state.js';

export async function runClassLifecycleTests() {
  const db = await import('./db.js');
  const engine = await import('./rpg-engine.js');
  const { readClassWorld, writeClassWorldInTransaction } = await import('./class-store.js');
  const { beginRulesOperation, commitRulesCheck, finalizeRulesAnnotation, completeRulesOperation } = await import('./rules-store.js');
  const campaignIds = [];
  const profileIds = new Set();
  const remember = async state => {
    campaignIds.push(state.campaignId);
    for (const row of await db.all('SELECT player_character_id FROM characters WHERE campaign_id = ?', [state.campaignId])) profileIds.add(row.player_character_id);
    return state;
  };
  const campaign = id => db.get('SELECT * FROM campaigns WHERE id = ?', [id]);
  const snapshotTurn = async (id, number, actor, world, rolls = []) => db.run(`INSERT INTO turns
    (campaign_id, turn_number, character_id, player_action, narrative, state_changes_json, ability_invocations_json, rules_snapshot_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [id, number, actor, number === 1 ? null : 'I act at the gate.',
    'Literal npc:999 and character:999 remain prose.', JSON.stringify({ dice_rolls: rolls }),
    JSON.stringify(emptyAbilityInvocationRecord()), JSON.stringify(world)]);
  try {
    const ruleset = createClassRuleset(testSelection());
    const created = await db.run(`INSERT INTO campaigns (title, genre, rules_mode, ruleset_json)
      VALUES ('Exact lifecycle', 'Fantasy', 1, ?)`, [JSON.stringify(ruleset)]);
    const id = created.id;
    campaignIds.push(id);
    await db.run('INSERT INTO campaign_outlines (campaign_id, outline_json) VALUES (?, ?)',
      [id, JSON.stringify(validateOutlineData({ starting_quest: { title: 'Reach the yard', description: 'Pass the gate.' } }))]);
    const location = await db.run(`INSERT INTO locations (campaign_id, name, key, description, layout_json, occupancy_json)
      VALUES (?, 'Gatehouse', 'gatehouse', 'Two connected areas.', ?, '[]')`, [id, JSON.stringify(testClassLayout)]);
    const foe = await db.run(`INSERT INTO npcs (campaign_id, name, role, personality, quirks, notes, status)
      VALUES (?, 'Guard', 'Guard', 'Watchful', '', '', 'alive')`, [id]);
    const initialWorld = createRulesWorld({ location: { id: location.id, layout: testClassLayout }, npcs: [{ id: foe.id, name: 'Guard' }] });
    await db.run('UPDATE campaigns SET rules_state_json = ?, current_location_id = ? WHERE id = ?', [JSON.stringify(initialWorld), location.id, id]);
    const first = await engine.joinCampaign(id, { characterName: 'Mira', classSelection: testSelection() });
    const hero = first.character;
    profileIds.add(hero.player_character_id);
    const partnerState = await engine.joinCampaign(id, { characterName: 'Partner', classSelection: testSelection('bonded', 'bonded.partner') });
    const partner = partnerState.party.find(row => row.id === partnerState.joinedCharacterId);
    const riderState = await engine.joinCampaign(id, { characterName: 'Pilot', classSelection: testSelection('rider', 'rider.ace') });
    const rider = riderState.party.find(row => row.id === riderState.joinedCharacterId);
    const copiedState = await engine.joinCampaign(id, { characterProfileId: hero.player_character_id, characterMode: 'copy' });
    const copy = copiedState.party.find(row => row.id === copiedState.joinedCharacterId);
    assert.deepEqual(copy.abilities, hero.abilities);
    assert.notEqual(copy.player_character_id, hero.player_character_id);
    for (const member of copiedState.party) profileIds.add(member.player_character_id);
    let row = await campaign(id);
    let world = readClassWorld(row);
    const bindings = Object.fromEntries(Object.keys(world.actors).map((ref, index) => [`actor${index}`, ref]));
    const frame = { schemaVersion: 1,
      areas: testClassLayout.areas.map(area => ({ area: area.id, terrain: 'dry_ground', traits: ['visible', 'safe', 'visited', 'safe_recovery'], surfaces: ['ground'] })),
      actors: Object.entries(bindings).map(([key, ref]) => ({ actor: key, area: 'gate', allegiance: ref === `npc:${foe.id}` ? 'opposition' : 'party',
        profile: ref.startsWith('character:') || world.actors[ref].controller ? null : 'combatant', conditions: [] })),
      items: [], objects: [], features: [], discoveries: [], encounter: { active: false, opposition: [] } };
    world = buildClassScenario({ world, location: { id: location.id, layout: testClassLayout }, frame, actorBindings: bindings, turn: 1 }).world;
    await db.withWriteTransaction(async () => {
      await writeClassWorldInTransaction(id, world, row.rules_revision);
      await snapshotTurn(id, 1, hero.id, world);
    });
    const firstSnapshot = structuredClone(world);
    const opening = await engine.exportCampaign(id);
    assert.equal(opening.format_version, 4);
    assert.ok(opening.npcs.every(npc => npc.source_id));
    assert.ok(opening.locations.every(place => place.source_id));
    assert.deepEqual(validateCampaignBundle(opening).class_runtime.world, world);

    const operation = await beginRulesOperation({ campaignId: id, actor: hero.id, turn: 2,
      input: { prose: 'I act at the gate.' }, catalogVersion: ruleset.catalogVersion, requestId: randomUUID() });
    const beforePending = JSON.stringify(await campaign(id));
    for (const task of [() => engine.exportCampaign(id), () => engine.forkCampaign(id, 1, 'Blocked'),
      () => engine.releaseCharacter(id, hero.id), () => engine.releaseCampaignCharacters(id),
      () => engine.joinCampaign(id, { characterName: 'Blocked', classSelection: testSelection() })]) {
      await assert.rejects(task(), /unresolved/);
    }
    assert.equal(JSON.stringify(await campaign(id)), beforePending);
    let check = await commitRulesCheck({ operationId: operation.operationId, call: { actor: hero.id, callSeq: 1,
      intent: 'Press the guard.', tier: 'standard', tierBasis: 'The guard resists.', deltas: [] }, skillBonus: 10, activeEncounter: true },
    { roll: () => 100, now: () => '2026-09-07T12:00:00.000Z', newId: randomUUID });
    const effects = evaluateEffects({ state: world, effects: [{ op: 'harm', who: `npc:${foe.id}`, grade: 'graze' }], actor: hero.id,
      turn: 2, transactionId: check.checkId, consumer: 'annotation', band: check.band, stakesLicense: check.stakesLicense, affirmedOpposed: [`npc:${foe.id}`] });
    world = effects.state;
    check = await finalizeRulesAnnotation({ operationId: operation.operationId, actor: hero.id, callSeq: 1,
      annotation: { text: 'The guard gives ground.', effects: effects.effects, affirmedOpposed: [`npc:${foe.id}`] } }, async () => {
      const current = await campaign(id);
      await writeClassWorldInTransaction(id, world, current.rules_revision);
    });
    world.actors[`character:${hero.id}`].health -= 7;
    const additions = [];
    for (let index = 0; index < 2; index++) {
      const advanced = advanceClassCharacter({ state: world, actor: `character:${hero.id}`, award: 'milestone', awardId: `lifecycle-award-${index}` });
      world = advanced.state;
      additions.push(...advanced.newBindings);
    }
    assert.equal(world.actors[`character:${hero.id}`].level, 3);
    assert.equal(world.actors[`character:${hero.id}`].maxHealth - world.actors[`character:${hero.id}`].health, 7);
    await completeRulesOperation(operation.operationId, { turn: 2 }, async () => {
      for (const binding of additions) await db.run(`INSERT INTO character_ability_bindings
        (player_character_id, campaign_id, ability_id, term, prose, aliases_json, provenance, vocabulary_version, binding_set_revision)
        VALUES (?, ?, ?, ?, ?, ?, 'player-choice', 0, 1)`, [hero.player_character_id, id, binding.abilityId, binding.term, binding.prose, JSON.stringify(['Seeking Dart'])]);
      const current = await campaign(id);
      await writeClassWorldInTransaction(id, world, current.rules_revision);
      await snapshotTurn(id, 2, hero.id, world, [normalizeCheckRecord(check)]);
    });
    const progressed = await engine.exportCampaign(id);
    assert.equal(progressed.class_runtime.checks.length, 1);
    assert.equal(progressed.class_runtime.checks[0].checkId, check.checkId);
    const sourceBeforeImport = JSON.stringify(await campaign(id));
    const imported = await remember(await engine.importCampaign(progressed));
    const importedHero = imported.party.find(member => member.name === 'Mira' && member.level === 3);
    assert.deepEqual(importedHero.abilities, world.actors[`character:${hero.id}`].abilities);
    assert.deepEqual(importedHero.resources, (await engine.getCampaignState(id)).party.find(member => member.id === hero.id).resources);
    assert.equal(importedHero.max_health - importedHero.health, 7);
    assert.equal(JSON.stringify(await campaign(id)), sourceBeforeImport);
    assert.equal((await db.get('SELECT COUNT(*) AS n FROM rules_checks WHERE campaign_id = ?', [imported.campaignId])).n, 0);
    const importedRow = await campaign(imported.campaignId);
    const historicalCheck = JSON.parse(importedRow.rules_history_json)[0];
    assert.equal(historicalCheck.checkId, check.checkId);
    assert.equal(historicalCheck.actor, importedHero.id);
    assert.deepEqual(historicalCheck.sourceContext, { campaignId: id, actor: hero.id, turn: 2 });
    const importedWorld = readClassWorld(importedRow);
    const importedPartner = imported.party.find(member => member.name === 'Partner');
    const importedRider = imported.party.find(member => member.name === 'Pilot');
    assert.notEqual(importedPartner.classState.companion.actorRef, partner.classState.companion.actorRef);
    assert.ok(importedWorld.actors[importedPartner.classState.companion.actorRef]);
    assert.ok(importedWorld.vehicles[importedRider.classState.vehicle.vehicleRef]);
    assert.notEqual(importedRider.classState.vehicle.vehicleRef, rider.classState.vehicle.vehicleRef);
    assert.equal((await engine.exportCampaign(imported.campaignId)).class_runtime.checks[0].checkId, check.checkId);
    const importedTurns = await db.all('SELECT * FROM turns WHERE campaign_id = ? ORDER BY turn_number', [imported.campaignId]);
    assert.equal(importedTurns[0].narrative, 'Literal npc:999 and character:999 remain prose.');
    assert.equal(JSON.parse(importedTurns[1].state_changes_json).dice_rolls[0].actor, importedHero.id);
    const resumed = await beginRulesOperation({ campaignId: imported.campaignId, actor: importedHero.id, turn: 3,
      input: { prose: 'I continue after import.' }, catalogVersion: ruleset.catalogVersion, requestId: randomUUID() });
    const resumedCheck = await commitRulesCheck({ operationId: resumed.operationId, call: { actor: importedHero.id, callSeq: 1,
      intent: 'Continue past the guard.', tier: 'standard', tierBasis: 'The guard resists.', deltas: [] }, skillBonus: 10, activeEncounter: true },
    { roll: () => 30, newId: randomUUID });
    let resumedWorld = importedWorld;
    const resumedBindings = [];
    for (let index = 0; index < 2; index++) {
      const advanced = advanceClassCharacter({ state: resumedWorld, actor: `character:${importedHero.id}`, award: 'milestone', awardId: `imported-award-${index}` });
      resumedWorld = advanced.state;
      resumedBindings.push(...advanced.newBindings);
    }
    await completeRulesOperation(resumed.operationId, { turn: 3 }, async () => {
      for (const binding of resumedBindings) await db.run(`INSERT INTO character_ability_bindings
        (player_character_id, campaign_id, ability_id, term, prose, aliases_json, provenance, vocabulary_version, binding_set_revision)
        VALUES (?, ?, ?, ?, ?, ?, 'player-choice', 0, 1)`, [importedHero.player_character_id, imported.campaignId,
        binding.abilityId, binding.term, binding.prose, JSON.stringify(binding.aliases)]);
      const current = await campaign(imported.campaignId);
      await writeClassWorldInTransaction(imported.campaignId, resumedWorld, current.rules_revision);
      await snapshotTurn(imported.campaignId, 3, importedHero.id, resumedWorld, [normalizeCheckRecord(resumedCheck)]);
    });
    const resumedExport = await engine.exportCampaign(imported.campaignId);
    assert.equal(resumedExport.class_runtime.checks.length, 2, 'Imported artifacts and new live checks coexist without ledger reinsertion.');
    assert.equal(resumedWorld.actors[`character:${importedHero.id}`].level, 5);
    for (const ability of importedHero.abilities) assert.ok(resumedWorld.actors[`character:${importedHero.id}`].abilities.some(value => value.id === ability.id));
    assert.equal((await engine.getCampaignState(id)).party.find(member => member.id === hero.id).level, 3);

    const invalid = structuredClone(progressed);
    const badRules = JSON.parse(invalid.campaign.ruleset_json);
    badRules.catalogVersion = 'unknown-catalog';
    invalid.campaign.ruleset_json = JSON.stringify(badRules);
    const counts = async () => Promise.all(['campaigns', 'characters', 'player_characters', 'npcs', 'locations', 'turns', 'character_ability_bindings']
      .map(async table => (await db.get(`SELECT COUNT(*) AS n FROM ${table}`)).n));
    const beforeInvalid = await counts();
    await assert.rejects(engine.importCampaign(invalid), /unsupported|unavailable/i);
    assert.deepEqual(await counts(), beforeInvalid);
    const missingBinding = structuredClone(progressed);
    missingBinding.portability.character_ability_bindings.shift();
    await assert.rejects(engine.importCampaign(missingBinding), /binding/);
    assert.deepEqual(await counts(), beforeInvalid);

    const early = await remember(await engine.forkCampaign(id, 1, 'Earlier exact world'));
    const earlyHero = early.party.find(member => member.name === 'Mira');
    assert.equal(earlyHero.level, 1);
    assert.equal(earlyHero.health, firstSnapshot.actors[`character:${hero.id}`].health);
    assert.deepEqual(earlyHero.abilities, hero.abilities);
    assert.equal(JSON.parse((await campaign(early.campaignId)).rules_history_json).length, 0);
    assert.equal((await engine.getCampaignState(id)).party.find(member => member.id === hero.id).level, 3);

    row = await campaign(id);
    world = readClassWorld(row);
    world.encounter = { active: true, participants: [`npc:${foe.id}`] };
    await db.withWriteTransaction(() => writeClassWorldInTransaction(id, world, row.rules_revision));
    await assert.rejects(engine.releaseCharacter(id, hero.id), /encounter/);
    row = await campaign(id);
    world.encounter = { active: false, participants: [] };
    await db.withWriteTransaction(() => writeClassWorldInTransaction(id, world, row.rules_revision));
    const bindingsBeforeRelease = await db.all('SELECT * FROM character_ability_bindings WHERE campaign_id = ? AND player_character_id = ?', [id, hero.player_character_id]);
    await engine.releaseCharacter(id, hero.id);
    const releasedRow = await db.get('SELECT * FROM characters WHERE id = ?', [hero.id]);
    assert.equal(releasedRow.player_character_id, hero.player_character_id);
    assert.equal(releasedRow.status, 'released');
    const releasedProfile = await db.get('SELECT * FROM player_characters WHERE id = ?', [hero.player_character_id]);
    assert.equal(releasedProfile.status, 'available');
    assert.equal(JSON.parse(releasedProfile.class_state_json).level, 3);
    assert.deepEqual(await db.all('SELECT * FROM character_ability_bindings WHERE campaign_id = ? AND player_character_id = ?', [id, hero.player_character_id]), bindingsBeforeRelease);
    const releasedWorld = readClassWorld(await campaign(id));
    assert.equal(releasedWorld.actors[`character:${hero.id}`].tableStatus, 'released');
    assert.ok(!releasedWorld.turnOrder.order.includes(`character:${hero.id}`));
    const beforeReentry = await counts();
    await assert.rejects(engine.joinCampaign(id, { characterProfileId: hero.player_character_id, characterMode: 'existing' }), /already has history/);
    assert.deepEqual(await counts(), beforeReentry);
    assert.equal((await db.get('SELECT status FROM player_characters WHERE id = ?', [hero.player_character_id])).status, 'available');
    await snapshotTurn(id, 3, copy.id, releasedWorld);
    const releasedExport = await engine.exportCampaign(id);
    validateClassBundle(releasedExport);
    const afterRelease = await remember(await engine.importCampaign(releasedExport));
    assert.equal(afterRelease.party.length, 3);
    const afterReleaseExport = await engine.exportCampaign(afterRelease.campaignId);
    assert.equal(afterReleaseExport.characters.filter(member => member.status === 'released').length, 1);
    const releasedBindings = afterReleaseExport.portability.character_ability_bindings.filter(binding =>
      binding.source_profile_id === afterReleaseExport.characters.find(member => member.status === 'released').source_profile_id);
    assert.equal(releasedBindings.length, bindingsBeforeRelease.length);
    assert.ok(releasedBindings.some(binding => binding.aliases.includes('Seeking Dart')));
    const late = await remember(await engine.forkCampaign(id, 3, 'Released remains released'));
    assert.equal(late.party.length, 3);
    const historical = await remember(await engine.forkCampaign(id, 1, 'Historical member returns only in fork'));
    assert.equal(historical.party.length, 4);
    const arrival = await engine.joinCampaign(imported.campaignId, { characterProfileId: hero.player_character_id, characterMode: 'existing' });
    const arrived = arrival.party.find(member => member.id === arrival.joinedCharacterId);
    assert.equal(arrived.level, 3);
    assert.equal(arrived.max_health - arrived.health, 7);
    assert.deepEqual(arrived.abilities, JSON.parse(releasedProfile.abilities_json));
    assert.ok(arrived.invocableAbilities.some(ability => ability.aliases.includes('Seeking Dart')));
    assert.deepEqual((await engine.exportCampaign(id)).class_runtime.world, releasedWorld, 'Re-entry cannot mutate the departed campaign snapshot.');
    await engine.releaseCampaignCharacters(late.campaignId, { detachCampaign: true });
    const fullyReleased = await engine.exportCampaign(late.campaignId);
    assert.equal(fullyReleased.class_runtime.world.turnOrder.order.length, 0);
    assert.ok(fullyReleased.characters.every(member => member.status === 'released' && member.source_profile_id));
    const emptyState = await engine.getCampaignState(late.campaignId);
    assert.equal(emptyState.character, null);
    assert.deepEqual(emptyState.party, []);
    assert.equal(emptyState.turn.number, 3);
    const archived = await remember(await engine.importCampaign(fullyReleased));
    assert.equal(archived.character, null);
    assert.deepEqual(archived.party, []);
    assert.equal(archived.turn.number, 3);
    assert.ok((await engine.exportCampaign(archived.campaignId)).characters.every(member => member.status === 'released'));
    return { imported: 3, forked: 3, grantsPreserved: progressed.characters.reduce((sum, member) => sum + JSON.parse(member.abilities_json).length, 0), checksPreserved: 2 };
  } finally {
    for (const id of campaignIds) {
      for (const row of await db.all('SELECT player_character_id FROM characters WHERE campaign_id = ?', [id])) profileIds.add(row.player_character_id);
      await db.run('DELETE FROM campaigns WHERE id = ?', [id]);
    }
    for (const id of profileIds) if (id) await db.run('DELETE FROM player_characters WHERE id = ?', [id]);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const directory = await mkdtemp(join(tmpdir(), 'aetheria-class-lifecycle-'));
  process.env.RPG_DB_PATH = join(directory, 'test.db');
  const db = await import('./db.js');
  try {
    await db.initDb();
    console.log('Class lifecycle tests passed:', await runClassLifecycleTests());
  } finally {
    await db.closeDb();
    await rm(directory, { recursive: true, force: true });
  }
}
