import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { testSelection, testClassLayout } from './test-class-state.mjs';
import { checkSucceeded, normalizeCheckRecord } from './rules-resolution.js';
import { validateClassBundle } from './class-portability.js';

const selection = (family, branch) => ({ ...testSelection(family, branch), modules: [], capabilities: { rider: false, alliedActors: false } });

export async function runClassTurnTests() {
  const db = await import('./db.js');
  const engine = await import('./rpg-engine.js');
  const { AIClient } = await import('./api-client.js');
  const originalPrompt = AIClient.prototype.sendPrompt;
  const priorImageProvider = process.env.IMAGE_PROVIDER;
  delete process.env.IMAGE_PROVIDER;
  const apiConfig = { provider: 'ollama', model: 'class-turn-fixture', imageProvider: '' };
  const campaigns = [];
  const profiles = new Set();
  const calls = [];
  let sceneEncounter = true;
  let script = {};
  let failNarration = 0;
  const rawCampaign = id => db.get('SELECT * FROM campaigns WHERE id = ?', [id]);
  const worldOf = row => JSON.parse(row.rules_state_json);
  const counts = async id => {
    const result = {};
    for (const table of ['turns', 'rules_turn_operations', 'rules_checks']) {
      result[table] = (await db.get(`SELECT COUNT(*) AS n FROM ${table} WHERE campaign_id = ?`, [id])).n;
    }
    return result;
  };
  const nextActor = (state, id) => state.party.find(actor => actor.id === id);
  const submit = (state, actor, prose, requestId = randomUUID()) => engine.takeTurn(
    state.campaignId, prose, apiConfig, actor.id, actor.abilityTriggerRevision, { requestId });
  const opposedRefs = data => Object.entries(data.world.actors).filter(([ref, actor]) => ref.startsWith('npc:') && !actor.party).map(([ref]) => ref);
  const review = data => ({ approved: true, reason: 'The exact intent and selected recorded targets agree.',
    affirmedOpposed: opposedRefs(data), consentingActors: [] });
  AIClient.prototype.sendPrompt = async ({ systemInstruction, prompt }) => {
    const match = /^AETHERIA_COUNCIL:([a-z_]+)/u.exec(systemInstruction);
    if (!match) {
      if (prompt.startsWith('Draft an epic,')) return JSON.stringify({ title: 'Direct class turns', setting: 'A gatehouse with an open courtyard.',
        major_locations: [{ name: 'Gatehouse', description: 'Two connected areas.' }],
        key_npcs: [{ name: 'Guard', role: 'Courtyard guard', personality: 'Watchful', quirks: '' }],
        starting_quest: { title: 'Cross the court', description: 'Reach the courtyard and return with the message.' } });
      if (systemInstruction.includes('persistent structured layout')) return JSON.stringify(testClassLayout);
      if (systemInstruction.includes('initial Aetheria scene')) return JSON.stringify({ schemaVersion: 1,
        areas: testClassLayout.areas.map(area => ({ area: area.id, terrain: 'dry_ground',
          traits: ['visible', 'safe', 'visited', ...(sceneEncounter ? ['immediate_threat'] : ['safe_recovery'])], surfaces: ['ground'] })),
        actors: [
          { actor: 'player', area: 'gate', allegiance: 'party', profile: null, conditions: [] },
          { actor: 'npc0', area: 'yard', allegiance: 'opposition', profile: 'combatant', conditions: [] }
        ], items: [], objects: [], features: [], discoveries: [], encounter: { active: sceneEncounter, opposition: sceneEncounter ? ['npc0'] : [] }
      });
      if (prompt.startsWith('Set the scene and begin the campaign.')) return JSON.stringify({
        narrative: 'The guard waits in the courtyard beyond the open gate.', scene_grounding: 'Mira stands at the gate. The guard is in the adjacent courtyard.',
        character_update: { health_change: -99, xp_gain: 900 },
        ability_updates: [{ type: 'add', name: 'Invented Power', description: 'Narration cannot grant this.' }]
      });
      throw new Error(`Unexpected setup provider call: ${systemInstruction.slice(0, 80)}`);
    }
    const stage = match[1];
    const data = JSON.parse(prompt);
    calls.push({ stage, data: structuredClone(data) });
    switch (stage) {
      case 'interaction': return JSON.stringify({ inputKind: script.kind === 'talk' ? 'clarification' : 'committed_action',
        intent: data.playerInput, answer: script.kind === 'talk' ? 'The courtyard is visible beyond the gate.' : null });
      case 'table_talk': return JSON.stringify({ narrative: 'The courtyard is visible beyond the gate.' });
      case 'grounding': return JSON.stringify(review(data));
      case 'pre_roll': {
        for (const actor of Object.values(data.world.actors)) {
          assert.equal(Object.hasOwn(actor, 'health'), false, 'Pre-roll semantic context is qualitative.');
          assert.equal(Object.hasOwn(actor, 'skills'), false);
        }
        assert.equal(Object.hasOwn(data.ruling.check || {}, 'raw'), false);
        return JSON.stringify(review(data));
      }
      case 'referee': {
        const foe = opposedRefs(data)[0];
        const ability = data.declarations.find(value => value.name === script.ability);
        const action = script.kind === 'move' ? { kind: 'ordinary', action: { kind: 'move', area: script.area } }
          : { kind: 'ability', abilityId: ability?.abilityId,
            bindings: script.ability === 'Fireball' ? { area: 'yard' } : { targets: [script.invalid ? 'npc:99999999' : foe] }, options: {} };
        const wait = data.finalPlayerMainOfRound && data.world.encounterActive
          ? opposedRefs(data).map(npc => ({ npc, wait: 'The guard holds the courtyard position instead of crossing the gate.' })) : [];
        return JSON.stringify({ action,
          check: script.kind === 'move' ? null : { actor: data.actor, callSeq: 1, intent: 'Strike the resisting guard.',
            tier: 'standard', tierBasis: 'The alert guard resists the spell.', deltas: [] },
          deltaSources: [], noCheckReason: script.kind === 'move' ? 'The adjacent recorded area is safe and unobstructed.' : null,
          npcTurns: { success: wait, failure: wait }, encounter: { success: 'unchanged', failure: 'unchanged' },
          award: script.award ? { kind: 'milestone', id: script.award } : null });
      }
      case 'annotation': return JSON.stringify({ text: 'The exchange is especially tense.', effects: [] });
      case 'annotation_review': return JSON.stringify({ approved: true, reason: 'The text adds no mechanical event.', affirmedOpposed: opposedRefs(data) });
      case 'narration':
        if (failNarration > 0) { failNarration--; throw new Error('Simulated narration outage after the durable check.'); }
        return JSON.stringify({ narrative: data.check
          ? checkSucceeded(data.check.band) ? 'The spell strikes the guard.' : 'The guard escapes the spell.'
          : 'The character crosses the open passage.' });
      default: throw new Error(`Unexpected class Council stage ${stage}.`);
    }
  };
  const create = async encounter => {
    sceneEncounter = encounter;
    const result = await engine.createCampaign({ genre: 'Fantasy', characterName: 'Mira', ruleset: 'aetheria', classSelection: selection(), apiConfig });
    campaigns.push(result.campaignId);
    profiles.add(result.character.player_character_id);
    return result;
  };
  try {
    let state = await create(true);
    const id = state.campaignId;
    const heroId = state.character.id;
    const initial = await rawCampaign(id);
    const initialWorld = worldOf(initial);
    const foeRef = Object.keys(initialWorld.actors).find(ref => ref.startsWith('npc:'));
    assert.equal(state.character.level, 1, 'Setup prose does not award XP or invent grants.');
    assert.ok(state.character.abilities.some(ability => ability.name === 'Magic Missile'));
    assert.ok(!state.character.abilities.some(ability => ability.name === 'Invented Power'));
    script = { ability: 'Magic Missile' };
    const directRequest = randomUUID();
    const directProse = 'I cast Magic Missile at the guard.';
    state = await submit(state, state.character, directProse, directRequest);
    const directRow = await rawCampaign(id);
    const directWorld = worldOf(directRow);
    const directChecks = await db.all('SELECT * FROM rules_checks WHERE campaign_id = ? ORDER BY turn_number, call_seq', [id]);
    assert.equal(directChecks.length, 1);
    const directCheck = normalizeCheckRecord(JSON.parse(directChecks[0].record_json));
    assert.ok(directCheck.raw >= 1 && directCheck.raw <= 100);
    assert.equal(directCheck.skillBonus, initialWorld.actors[`character:${heroId}`].skills.lore);
    assert.equal(directWorld.actors[foeRef].health, initialWorld.actors[foeRef].health - (checkSucceeded(directCheck.band) ? 5 : 0));
    assert.equal(directWorld.turnOrder.round, initialWorld.turnOrder.round + 1);
    assert.equal(directRow.rules_revision, initial.rules_revision + 1);
    assert.equal(state.turn.playerAction, directProse);
    assert.equal(state.settledRequestId, directRequest);
    const directTurn = await db.get('SELECT * FROM turns WHERE campaign_id = ? ORDER BY turn_number DESC LIMIT 1', [id]);
    assert.deepEqual(JSON.parse(directTurn.rules_snapshot_json), directWorld);
    assert.equal(JSON.parse(directTurn.state_changes_json).dice_rolls[0].checkId, directCheck.checkId);
    assert.equal(JSON.parse(directTurn.ability_invocations_json).abilities[0].ability_id,
      state.character.abilities.find(ability => ability.name === 'Magic Missile').id);

    script = { kind: 'talk' };
    const beforeTalk = await counts(id);
    const talkRequest = randomUUID();
    const talkActor = nextActor(state, heroId);
    state = await submit(state, talkActor, 'Can Magic Missile reach the courtyard?', talkRequest);
    assert.deepEqual(worldOf(await rawCampaign(id)), directWorld);
    assert.equal((await rawCampaign(id)).rules_revision, directRow.rules_revision);
    const afterTalk = await counts(id);
    assert.equal(afterTalk.turns, beforeTalk.turns + 1);
    assert.equal(afterTalk.rules_turn_operations, beforeTalk.rules_turn_operations);
    assert.equal(afterTalk.rules_checks, beforeTalk.rules_checks);
    assert.deepEqual(await submit(state, talkActor, 'Can Magic Missile reach the courtyard?', talkRequest), state);
    assert.deepEqual(await counts(id), afterTalk, 'A lost table-talk response cannot duplicate its transcript.');
    assert.deepEqual(JSON.parse((await db.get('SELECT rules_snapshot_json FROM turns WHERE campaign_id = ? ORDER BY turn_number DESC LIMIT 1', [id])).rules_snapshot_json), directWorld);

    script = { ability: 'Magic Missile', invalid: true };
    const beforeRejected = await counts(id);
    await assert.rejects(submit(state, nextActor(state, heroId), 'I cast Magic Missile at the guard.'), /recorded|resolve|reference|target|actor/i);
    assert.deepEqual(await counts(id), beforeRejected, 'All action validation must finish before reserving an operation.');
    assert.deepEqual(worldOf(await rawCampaign(id)), directWorld);

    script = { ability: 'Fireball' };
    failNarration = 1;
    const retryRequest = randomUUID();
    const retryProse = 'I cast Fireball into the courtyard.';
    const retryActor = nextActor(state, heroId);
    const fireball = retryActor.abilities.find(ability => ability.name === 'Fireball');
    const beforeFailure = await rawCampaign(id);
    await assert.rejects(submit(state, retryActor, retryProse, retryRequest), /narration|outage|pending|resume/i);
    const pending = await db.get("SELECT * FROM rules_turn_operations WHERE campaign_id = ? AND status = 'active'", [id]);
    assert.ok(pending);
    assert.equal(pending.request_id, retryRequest);
    assert.equal(pending.stage, 'resolved');
    const durableCheck = await db.get('SELECT * FROM rules_checks WHERE operation_id = ?', [pending.id]);
    assert.ok(durableCheck, 'The check exists before provider narration succeeds.');
    assert.deepEqual(worldOf(await rawCampaign(id)), worldOf(beforeFailure), 'Unfinished narration cannot partially charge or apply the resolved action.');
    const reload = await engine.getCampaignState(id);
    assert.deepEqual(reload.pendingAction, { requestId: retryRequest, actor: `character:${heroId}`, characterId: heroId,
      playerAction: retryProse, abilityTriggerRevision: retryActor.abilityTriggerRevision, stage: 'resolved' });
    const callsBeforeRetry = calls.length;
    await assert.rejects(submit(reload, retryActor, `${retryProse} Then move.`, retryRequest), error => error.code === 'CLASS_ACTION_PENDING');
    await assert.rejects(submit(reload, retryActor, retryProse, randomUUID()), error => error.code === 'CLASS_ACTION_PENDING');
    assert.equal(calls.length, callsBeforeRetry, 'A pending identity conflict must not ask the provider to rerule.');
    state = await submit(reload, retryActor, retryProse, retryRequest);
    assert.deepEqual(calls.slice(callsBeforeRetry).map(call => call.stage), ['narration'], 'Retry resumes after the saved check instead of reruling or rerolling.');
    const afterRetry = await rawCampaign(id);
    const retryWorld = worldOf(afterRetry);
    assert.equal(retryWorld.actors[`character:${heroId}`].classState.recoveryUses[fireball.definition_id], 1);
    assert.equal(retryWorld.turnOrder.round, directWorld.turnOrder.round + 1);
    assert.equal((await db.get('SELECT record_json FROM rules_checks WHERE operation_id = ?', [pending.id])).record_json, durableCheck.record_json);
    assert.equal((await db.get('SELECT COUNT(*) AS n FROM rules_checks WHERE operation_id = ?', [pending.id])).n, 1);
    assert.equal((await db.get('SELECT status FROM rules_turn_operations WHERE id = ?', [pending.id])).status, 'complete');
    assert.equal(state.pendingAction, null);
    const beforeCompletedRetry = await counts(id);
    const callsBeforeCompletedRetry = calls.length;
    const repeated = await submit(state, retryActor, retryProse, retryRequest);
    assert.deepEqual(repeated, state);
    assert.equal(calls.length, callsBeforeCompletedRetry);
    assert.deepEqual(await counts(id), beforeCompletedRetry);
    assert.equal((await rawCampaign(id)).rules_revision, afterRetry.rules_revision);
    validateClassBundle(await engine.exportCampaign(id));

    let mixed = await create(false);
    const mageId = mixed.character.id;
    const joined = await engine.joinCampaign(mixed.campaignId, { characterName: 'Rook', classSelection: selection('armsmaster', 'armsmaster.discipline') });
    const fighterId = joined.joinedCharacterId;
    profiles.add(nextActor(joined, fighterId).player_character_id);
    mixed = joined;
    script = { kind: 'move', area: 'yard' };
    const beforeOutOfTurn = await counts(mixed.campaignId);
    const worldBeforeOutOfTurn = (await rawCampaign(mixed.campaignId)).rules_state_json;
    await assert.rejects(submit(mixed, nextActor(mixed, fighterId), 'I walk into the courtyard.'), error => error.code === 'OUT_OF_TURN');
    assert.deepEqual(await counts(mixed.campaignId), beforeOutOfTurn);
    assert.equal((await rawCampaign(mixed.campaignId)).rules_state_json, worldBeforeOutOfTurn);
    script = { kind: 'talk' };
    mixed = await submit(mixed, nextActor(mixed, fighterId), 'Is the gate open?');
    assert.equal((await rawCampaign(mixed.campaignId)).rules_state_json, worldBeforeOutOfTurn, 'Off-turn talk consumes neither PC Main nor NPC turn.');
    const mageBefore = nextActor(mixed, mageId);
    script = { kind: 'move', area: 'yard', award: 'reach-courtyard' };
    const awardRequest = randomUUID();
    mixed = await submit(mixed, mageBefore, 'I cross the open gate and reach the courtyard.', awardRequest);
    assert.equal(nextActor(mixed, mageId).level, 2);
    script = { kind: 'move', area: 'yard' };
    mixed = await submit(mixed, nextActor(mixed, fighterId), 'I follow into the courtyard.');
    script = { kind: 'move', area: 'gate', award: 'return-message' };
    mixed = await submit(mixed, nextActor(mixed, mageId), 'I return through the open gate with the message.');
    const advancedMage = nextActor(mixed, mageId);
    assert.equal(advancedMage.level, 3);
    assert.equal(advancedMage.xp, 200);
    assert.equal(advancedMage.abilities.length, mageBefore.abilities.length + 1);
    for (const ability of mageBefore.abilities) assert.ok(advancedMage.abilities.some(value => value.id === ability.id));
    const newAbility = advancedMage.abilities.find(value => !mageBefore.abilities.some(prior => prior.id === value.id));
    const grantBinding = await db.get('SELECT * FROM character_ability_bindings WHERE campaign_id = ? AND player_character_id = ? AND ability_id = ?',
      [mixed.campaignId, advancedMage.player_character_id, newAbility.id]);
    assert.equal(grantBinding.term, newAbility.name);
    assert.ok(advancedMage.invocableAbilities.some(ability => ability.abilityId === newAbility.id));
    const afterProgression = await counts(mixed.campaignId);
    const settledOldAward = await submit(mixed, mageBefore, 'I cross the open gate and reach the courtyard.', awardRequest);
    assert.equal(nextActor(settledOldAward, mageId).level, 3, 'Retrying an older completed request cannot replay its award or revert later progress.');
    assert.deepEqual(await counts(mixed.campaignId), afterProgression);
    validateClassBundle(await engine.exportCampaign(mixed.campaignId));
    return { campaigns: 2, liveChecks: 2, authoredAdvancements: 2, providerOnlyStub: true };
  } finally {
    AIClient.prototype.sendPrompt = originalPrompt;
    if (priorImageProvider === undefined) delete process.env.IMAGE_PROVIDER;
    else process.env.IMAGE_PROVIDER = priorImageProvider;
    for (const campaignId of campaigns) {
      for (const row of await db.all('SELECT player_character_id FROM characters WHERE campaign_id = ?', [campaignId])) profiles.add(row.player_character_id);
      await db.run('DELETE FROM campaigns WHERE id = ?', [campaignId]);
    }
    for (const profile of profiles) if (profile) await db.run('DELETE FROM player_characters WHERE id = ?', [profile]);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const directory = await mkdtemp(join(tmpdir(), 'aetheria-class-turns-'));
  process.env.RPG_DB_PATH = join(directory, 'test.db');
  const db = await import('./db.js');
  try {
    await db.initDb();
    console.log('Class turn integration tests passed:', await runClassTurnTests());
  } finally {
    await db.closeDb();
    await rm(directory, { recursive: true, force: true });
  }
}
