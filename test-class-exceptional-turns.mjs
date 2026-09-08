import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { testSelection, testClassLayout } from './test-class-state.mjs';
import { validateClassBundle } from './class-portability.js';
import { getAbilityDefinition } from './class-catalog.js';
import { checkSucceeded, normalizeCheckRecord } from './rules-resolution.js';
import { runClassExceptionalActionTests } from './test-class-exceptional-actions.mjs';

const selection = (family, branch) => ({ ...testSelection(family, branch), modules: [], capabilities: { rider: false, alliedActors: true } });

export async function runClassExceptionalTurnTests() {
  runClassExceptionalActionTests();
  const db = await import('./db.js');
  const engine = await import('./rpg-engine.js');
  const { AIClient } = await import('./api-client.js');
  const originalPrompt = AIClient.prototype.sendPrompt;
  const priorImageProvider = process.env.IMAGE_PROVIDER;
  delete process.env.IMAGE_PROVIDER;
  const apiConfig = { provider: 'ollama', model: 'exceptional-turn-fixture', imageProvider: '' };
  const campaigns = [];
  const profiles = new Set();
  const calls = [];
  let fallen = false;
  let uncertainReturn = false;
  let script = {};
  let failNarration = false;
  const row = id => db.get('SELECT * FROM campaigns WHERE id = ?', [id]);
  const world = async id => JSON.parse((await row(id)).rules_state_json);
  const submit = (state, prose, requestId = randomUUID()) => engine.takeTurn(state.campaignId, prose, apiConfig,
    state.character.id, state.character.abilityTriggerRevision, { requestId });
  const review = () => ({ approved: true, reason: uncertainReturn
    ? 'Prerequisites are recorded and nobody interrupts the working, but the final attempt to restore Tarin may fail.'
    : 'The exact action has recorded prerequisites and no opposition or uncertain circumstance.',
    affirmedOpposed: [], consentingActors: script.travelers?.filter(ref => ref !== script.actor) || [] });
  AIClient.prototype.sendPrompt = async ({ systemInstruction, prompt }) => {
    const stage = /^AETHERIA_COUNCIL:([a-z_]+)/u.exec(systemInstruction)?.[1];
    if (!stage) {
      if (prompt.startsWith('Draft an epic,')) return JSON.stringify({ title: 'Exceptional workings', setting: 'A secure gatehouse and adjoining courtyard.',
        major_locations: [{ name: 'Gatehouse', description: 'A recorded focus and a connected courtyard.' }],
        key_npcs: [{ name: 'Tarin', role: 'Willing allied messenger', personality: 'Cooperative', quirks: '' },
          { name: 'Nessa', role: 'Living allied guide', personality: 'Patient', quirks: '' }],
        starting_quest: { title: 'Restore the gatehouse', description: 'Complete distinct repairs, bring the messenger home and return to the courtyard.' } });
      if (systemInstruction.includes('persistent structured layout')) return JSON.stringify(testClassLayout);
      if (systemInstruction.includes('initial Aetheria scene')) return JSON.stringify({ schemaVersion: 1,
        areas: testClassLayout.areas.map(area => ({ area: area.id, terrain: 'dry_ground',
          traits: ['visible', 'safe', 'visited', 'safe_recovery', ...(area.id === 'gate' ? ['focus'] : [])], surfaces: ['ground'] })),
        actors: [
          { actor: 'player', area: 'gate', allegiance: 'party', profile: null, conditions: [] },
          { actor: 'npc0', area: 'gate', allegiance: 'party', profile: 'support', conditions: [],
            ...(fallen ? { fallen: { age: 'recent', body: 'intact', returnChoice: 'willing' } } : {}) },
          { actor: 'npc1', area: 'gate', allegiance: 'party', profile: 'support', conditions: [] }
        ],
        items: fallen ? [{ key: 'return-material', name: 'Return catalyst', description: 'One recorded revival catalyst.',
          kind: 'revival_catalyst', holder: { kind: 'actor', key: 'player' }, wielded: false, condition: 'pristine' }] : [],
        objects: [], features: [], discoveries: [], encounter: { active: false, opposition: [] } });
      if (prompt.startsWith('Set the scene and begin the campaign.')) return JSON.stringify({
        narrative: fallen ? `Tarin has just fallen beside the gatehouse focus. His intact body and willing return are established.${uncertainReturn
          ? ' Nessa warns that even an uninterrupted final recall may fail to restore him; his return is not certain.' : ''}`
          : 'Tarin waits beside the gatehouse focus. The courtyard is open and safe.',
        scene_grounding: 'The gate and courtyard are connected, visible recorded areas.' });
      throw new Error(`Unexpected exceptional setup call: ${systemInstruction.slice(0, 80)}`);
    }
    const data = JSON.parse(prompt);
    calls.push({ stage, data: structuredClone(data) });
    if (script.workingPhase && ['interaction', 'grounding', 'referee', 'pre_roll'].includes(stage)) {
      const working = script.kind === 'continue'
        ? data.options.utilities.find(value => value.kind === 'continue_ritual')
        : data.options.abilities.find(value => value.name === script.ability);
      assert.equal(working?.workingPhase, script.workingPhase, 'Every pre-roll seat receives the current ritual working phase.');
      assert.deepEqual(working.resolution, script.workingPhase === 'preliminary' ? { kind: 'no_check' }
        : { kind: 'contextual_check', skill: 'lore', defaultTier: 'standard', automaticSuccess: false,
          omitOnlyFor: ['established_certainty', 'no_stakes'] });
    }
    switch (stage) {
      case 'interaction': return JSON.stringify({ inputKind: 'committed_action', intent: data.playerInput, answer: null });
      case 'grounding':
      case 'pre_roll': return JSON.stringify(review());
      case 'referee': {
        const declared = data.options.abilities.find(value => value.name === script.ability);
        let action;
        if (script.kind === 'move') action = { kind: 'ordinary', action: { kind: 'move', area: script.area } };
        else if (script.kind === 'recover') action = { kind: 'recover' };
        else if (script.kind === 'continue') {
          assert.ok(data.options.utilities.some(value => value.kind === 'continue_ritual'));
          assert.deepEqual(data.options.abilities, [], 'Plain continuation uses only the recorded owned ritual utility.');
          action = { kind: 'continue_ritual' };
        } else {
          assert.ok(declared, 'The exact owned declaration must reach Referee context.');
          const bindings = {};
          if (script.target) bindings.targets = [script.target];
          if (script.area) {
            assert.ok(data.options.knownAreas.some(value => value.id === script.area || value.ref === script.area));
            bindings.area = script.area;
          }
          if (script.catalyst) {
            assert.equal(declared.bindings.catalyst.relation, 'owned_revival_catalyst');
            assert.ok(data.world.items[script.catalyst]);
            bindings.catalyst = script.catalyst;
          }
          if (script.travelers) {
            assert.equal(declared.bindings.travelers.relation, 'explicit_willing_travelers_including_self');
            bindings.travelers = script.travelers;
          }
          action = { kind: 'ability', abilityId: declared.abilityId, bindings, options: {} };
        }
        return JSON.stringify({ action, check: script.check ? { actor: data.actor, callSeq: 1,
          intent: 'Complete the final working to restore Tarin from death.', tier: 'standard',
          tierBasis: 'Completing the return requires precise magical execution, and the established scene leaves its success uncertain.', deltas: [] } : null,
          deltaSources: [], noCheckReason: script.check ? null : script.workingPhase === 'preliminary'
            ? 'This preliminary working records uninterrupted progress, not the final outcome. It is deterministic.'
            : 'The recorded safe scene has no opposition, time pressure or uncertainty; all exact authored prerequisites are established.',
          npcTurns: { success: [], failure: [] }, encounter: { success: 'unchanged', failure: 'unchanged' },
          award: script.award ? { kind: 'milestone', id: script.award } : null });
      }
      case 'annotation': return JSON.stringify({ text: 'The final working carries particular weight.', effects: [] });
      case 'annotation_review': return JSON.stringify({ approved: true, reason: 'The text adds no mechanical event.', affirmedOpposed: [] });
      case 'narration':
        if (failNarration) { failNarration = false; throw new Error('Simulated exceptional narration outage.'); }
        return JSON.stringify({ narrative: 'The declared working proceeds with its recorded consequences.' });
      default: throw new Error(`Unexpected exceptional Council stage ${stage}.`);
    }
  };
  const create = async (family, branch, profileId = null) => {
    const state = await engine.createCampaign({ genre: 'Fantasy', characterName: 'Sera', ruleset: 'aetheria',
      classSelection: selection(family, branch), apiConfig,
      ...(profileId ? { characterProfileId: profileId, characterMode: 'copy' } : {}) });
    campaigns.push(state.campaignId);
    profiles.add(state.character.player_character_id);
    return state;
  };
  const progress = async (family, branch, level) => {
    fallen = false;
    let state = await create(family, branch);
    const startingIds = state.character.abilities.map(value => value.id);
    for (let step = 1; step < level; step++) {
      script = { kind: 'move', area: step % 2 ? 'yard' : 'gate', award: `${branch}-repair-${step}` };
      state = await submit(state, `I deliver the completed repair ${step} to the ${script.area}.`);
      assert.equal(state.character.level, step + 1);
      assert.equal(state.character.xp, step * 100);
      assert.ok(startingIds.every(id => state.character.abilities.some(value => value.id === id)));
    }
    return state;
  };
  const copyIntoFallenScene = async (family, branch) => {
    const progressed = await progress(family, branch, 10);
    fallen = true;
    const state = await create(family, branch, progressed.character.player_character_id);
    assert.equal(state.character.level, 10);
    assert.deepEqual(state.character.abilities.map(value => value.id), progressed.character.abilities.map(value => value.id));
    assert.notEqual(state.character.player_character_id, progressed.character.player_character_id);
    const saved = await world(state.campaignId);
    const npcRef = Object.keys(saved.actors).find(ref => ref.startsWith('npc:'));
    assert.equal(saved.actors[npcRef].health, 0);
    assert.equal(saved.actors[npcRef].status, 'dead');
    assert.equal(saved.actors[npcRef].deathTurn, 1);
    assert.equal(saved.actors[npcRef].intactBody, true);
    assert.equal(saved.actors[npcRef].willingReturn, true);
    const reload = await engine.getCampaignState(state.campaignId);
    assert.equal(reload.npcs.find(value => `npc:${value.id}` === npcRef).status, 'dead');
    return { state: reload, npcRef, actor: `character:${state.character.id}`, sourceProfileId: progressed.character.player_character_id };
  };
  try {
    let { state: cleric, npcRef: breathTarget, actor: clericActor } = await copyIntoFallenScene('channeler', 'channeler.restoration');
    const breath = cleric.character.abilities.find(value => value.name === 'Breath of Return');
    assert.ok(cleric.character.invocableAbilities.some(value => value.abilityId === breath.id));
    script = { ability: 'Breath of Return', target: breathTarget };
    cleric = await submit(cleric, 'I invoke Breath of Return on Tarin.');
    const afterBreath = await world(cleric.campaignId);
    assert.equal(afterBreath.actors[breathTarget].health, 1);
    assert.equal(afterBreath.actors[breathTarget].status, 'active');
    assert.equal(afterBreath.actors[breathTarget].conditions.winded.duration, 'scene');
    assert.equal(afterBreath.actors[clericActor].classState.strain, 3);
    assert.equal(afterBreath.actors[clericActor].conditions.winded.duration, 'persistent');
    assert.equal(afterBreath.actors[clericActor].classState.recoveryUses[breath.definition_id], 1);
    const breathStatus = cleric.character.abilityStatus.find(value => value.abilityId === breath.id);
    const breathDefinition = getAbilityDefinition(breath.definition_id, breath.definition_version);
    assert.deepEqual(breathStatus.cadence, { kind: 'recovery_use', maximum: breathDefinition.cadence.uses,
      remaining: breathDefinition.cadence.uses - afterBreath.actors[clericActor].classState.recoveryUses[breath.definition_id] });

    let { state: ritualist, npcRef: recallTarget, actor: ritualActor, sourceProfileId: ritualProfileId } = await copyIntoFallenScene('arcanist', 'arcanist.ritual');
    const recall = ritualist.character.abilities.find(value => value.name === 'Recall the Departed');
    const initialRitualWorld = await world(ritualist.campaignId);
    const catalyst = Object.entries(initialRitualWorld.items).find(([, item]) => item.kind === 'revival-catalyst' && item.holder === ritualActor)[0];
    script = { ability: 'Recall the Departed', target: recallTarget, catalyst, workingPhase: 'preliminary' };
    ritualist = await submit(ritualist, 'I begin Recall the Departed for Tarin using the return catalyst.');
    let current = await world(ritualist.campaignId);
    assert.equal(current.actors[ritualActor].classState.ritual.completed, 1);
    assert.equal(current.actors[recallTarget].health, 0);
    assert.equal(current.items[catalyst].lost, false);
    assert.equal(current.actors[ritualActor].classState.recoveryUses[recall.definition_id], undefined);
    ritualist = await engine.getCampaignState(ritualist.campaignId);
    script = { kind: 'continue', workingPhase: 'preliminary' };
    ritualist = await submit(ritualist, 'I continue the same working for Tarin.');
    current = await world(ritualist.campaignId);
    assert.equal(current.actors[ritualActor].classState.ritual.completed, 2);
    assert.deepEqual(current.actors[ritualActor].classState.ritual.bindings, { targets: [recallTarget], catalyst });
    const beforeFinal = (await row(ritualist.campaignId)).rules_state_json;
    const finalRequest = randomUUID();
    const finalText = 'I finish the same working for Tarin.';
    script = { kind: 'continue', workingPhase: 'completing' };
    failNarration = true;
    await assert.rejects(submit(ritualist, finalText, finalRequest), /narration|outage|resume/i);
    assert.equal((await row(ritualist.campaignId)).rules_state_json, beforeFinal, 'Narration failure cannot partially revive or consume the catalyst.');
    ritualist = await engine.getCampaignState(ritualist.campaignId);
    assert.equal(ritualist.pendingAction.requestId, finalRequest);
    const beforeResume = calls.length;
    ritualist = await submit(ritualist, finalText, finalRequest);
    assert.deepEqual(calls.slice(beforeResume).map(value => value.stage), ['narration']);
    current = await world(ritualist.campaignId);
    assert.equal(current.actors[recallTarget].health, 1);
    assert.equal(current.actors[recallTarget].status, 'active');
    assert.equal(current.actors[recallTarget].conditions.winded.duration, 'persistent');
    assert.equal(current.items[catalyst].lost, true);
    assert.equal(current.actors[ritualActor].classState.ritual, null);
    assert.equal(current.actors[ritualActor].classState.recoveryUses[recall.definition_id], 1);
    assert.deepEqual(await submit(ritualist, finalText, finalRequest), ritualist);
    assert.deepEqual(await world(ritualist.campaignId), current);

    const destination = Object.keys(current.areas).find(ref => current.areas[ref].id === 'yard');
    script = { ability: 'Transit Circle', area: destination, travelers: [ritualActor], actor: ritualActor };
    ritualist = await submit(ritualist, 'I begin Transit Circle to the visited courtyard, taking only myself.');
    assert.equal((await world(ritualist.campaignId)).actors[ritualActor].area, 'gate');
    script = { kind: 'continue' };
    ritualist = await submit(ritualist, 'I complete the same circle.');
    current = await world(ritualist.campaignId);
    assert.equal(current.actors[ritualActor].area, 'yard');
    assert.equal(current.actors[recallTarget].area, 'gate', 'Unselected allies cannot be silently transported.');
    const transit = ritualist.character.abilities.find(value => value.name === 'Transit Circle');
    assert.equal(current.actors[ritualActor].classState.recoveryUses[transit.definition_id], 1);
    script = { kind: 'move', area: 'gate' };
    ritualist = await submit(ritualist, 'I walk back to the focus.');
    script = { kind: 'recover' };
    ritualist = await submit(ritualist, 'I recover in the safe gatehouse.');
    const livingGuide = Object.keys(current.actors).find(ref => ref.startsWith('npc:') && ref !== recallTarget);
    assert.equal((await world(ritualist.campaignId)).actors[recallTarget].willingTravel, undefined);
    script = { ability: 'Transit Circle', area: destination, travelers: [ritualActor, recallTarget], actor: ritualActor };
    ritualist = await submit(ritualist, 'I begin Transit Circle for myself and Tarin to the courtyard. Tarin explicitly agrees to this crossing.');
    script = { kind: 'continue', travelers: [ritualActor, recallTarget], actor: ritualActor };
    ritualist = await submit(ritualist, 'I complete the same circle with Tarin, who confirms this crossing.');
    current = await world(ritualist.campaignId);
    assert.equal(current.actors[ritualActor].area, 'yard');
    assert.equal(current.actors[recallTarget].area, 'yard');
    assert.equal(current.actors[livingGuide].area, 'gate', 'A willing selected traveler does not imply every ally travels.');
    assert.equal(current.actors[recallTarget].willingTravel, undefined, 'One crossing cannot persist general travel consent.');

    let mage = await progress('arcanist', 'arcanist.formula', 5);
    assert.ok(mage.character.abilities.some(value => value.name === 'Blink'));
    const blink = mage.character.abilities.find(value => value.name === 'Blink');
    script = { ability: 'Blink', area: 'yard' };
    mage = await submit(mage, 'I cast Blink directly into the visible courtyard.');
    const blinkWorld = await world(mage.campaignId);
    assert.equal(blinkWorld.actors[`character:${mage.character.id}`].area, 'yard');
    assert.equal(blinkWorld.actors[`character:${mage.character.id}`].classState.sceneUses[blink.definition_id], 1);
    validateClassBundle(await engine.exportCampaign(cleric.campaignId));
    validateClassBundle(await engine.exportCampaign(ritualist.campaignId));
    validateClassBundle(await engine.exportCampaign(mage.campaignId));

    fallen = true;
    uncertainReturn = true;
    let checkedRitual = await create('arcanist', 'arcanist.ritual', ritualProfileId);
    const checkedActor = `character:${checkedRitual.character.id}`;
    const checkedInitial = await world(checkedRitual.campaignId);
    const checkedTarget = Object.keys(checkedInitial.actors).find(ref => checkedInitial.actors[ref].name === 'Tarin');
    const checkedCatalyst = Object.entries(checkedInitial.items).find(([, item]) => item.kind === 'revival-catalyst' && item.holder === checkedActor)[0];
    const checkedRecall = checkedRitual.character.abilities.find(value => value.name === 'Recall the Departed');
    assert.equal(checkedRitual.character.level, 10);
    for (let step = 1; step <= 3; step++) {
      script = step === 1 ? { ability: 'Recall the Departed', target: checkedTarget, catalyst: checkedCatalyst, workingPhase: 'preliminary' }
        : { kind: 'continue', workingPhase: step < 3 ? 'preliminary' : 'completing', check: step === 3 };
      checkedRitual = await submit(checkedRitual, step === 1
        ? 'I begin Recall the Departed for Tarin using the return catalyst.' : 'I continue the same working for Tarin.');
      if (step < 3) {
        const progress = await world(checkedRitual.campaignId);
        assert.equal(progress.actors[checkedActor].classState.ritual.completed, step);
        assert.equal(progress.actors[checkedTarget].health, 0);
        assert.equal(progress.items[checkedCatalyst].lost, false);
        assert.equal(progress.actors[checkedActor].classState.recoveryUses[checkedRecall.definition_id], undefined);
        assert.equal((await db.get('SELECT COUNT(*) AS count FROM rules_checks WHERE campaign_id = ?', [checkedRitual.campaignId])).count, 0);
      }
    }
    const checkedRecords = await db.all('SELECT record_json FROM rules_checks WHERE campaign_id = ?', [checkedRitual.campaignId]);
    assert.equal(checkedRecords.length, 1, 'Only the completing working makes a check under established uncertainty.');
    const finalCheck = normalizeCheckRecord(JSON.parse(checkedRecords[0].record_json));
    assert.ok(finalCheck.raw >= 1 && finalCheck.raw <= 100);
    assert.equal(finalCheck.skillBonus, checkedInitial.actors[checkedActor].skills.lore);
    const succeeded = checkSucceeded(finalCheck.band);
    const checkedFinal = await world(checkedRitual.campaignId);
    assert.equal(checkedFinal.actors[checkedActor].classState.ritual, null);
    assert.equal(checkedFinal.actors[checkedActor].classState.recoveryUses[checkedRecall.definition_id], 1);
    assert.equal(checkedFinal.actors[checkedTarget].health, succeeded ? 1 : 0);
    assert.equal(checkedFinal.items[checkedCatalyst].lost, succeeded);
    validateClassBundle(await engine.exportCampaign(checkedRitual.campaignId));
    return { campaigns: campaigns.length, authoredAdvancements: 22, revivedNpcs: 2 + Number(succeeded), ritualWorkings: 10,
      teleports: 3, providerOnlyStub: true, noStakesNoRoll: true, uncertainFinalChecks: 1 };
  } finally {
    AIClient.prototype.sendPrompt = originalPrompt;
    if (priorImageProvider === undefined) delete process.env.IMAGE_PROVIDER;
    else process.env.IMAGE_PROVIDER = priorImageProvider;
    for (const campaignId of campaigns) await db.run('DELETE FROM campaigns WHERE id = ?', [campaignId]);
    for (const profile of profiles) await db.run('DELETE FROM player_characters WHERE id = ?', [profile]);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const directory = await mkdtemp(join(tmpdir(), 'aetheria-exceptional-turns-'));
  process.env.RPG_DB_PATH = join(directory, 'test.db');
  const db = await import('./db.js');
  try {
    await db.initDb();
    console.log('Exceptional class turn tests passed:', await runClassExceptionalTurnTests());
  } finally {
    await db.closeDb();
    await rm(directory, { recursive: true, force: true });
  }
}
