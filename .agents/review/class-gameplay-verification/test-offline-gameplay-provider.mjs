import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { installOfflineGameplayProvider, OFFLINE_GAMEPLAY_INPUTS } from './offline-gameplay-provider.mjs';

function clientType() {
  const counters = { originalDispatch: 0 };
  class Client {
    async sendPrompt(request) { return this.dispatchPrompt(request); }
    async dispatchPrompt() { counters.originalDispatch++; throw new Error('The original transport must never run.'); }
  }
  return { Client, counters };
}

// Qualitative prompt fixtures only. Real engine/store coverage belongs to the episode worker.
function dataFor(episodeId, index = 0, phase = 'preliminary') {
  const ritual = episodeId === 'ritual';
  const input = OFFLINE_GAMEPLAY_INPUTS[episodeId][index];
  const name = ritual ? 'Recall the Departed' : episodeId === 'catalyst' ? 'Advance Cue'
    : index === 2 ? 'Fireball' : 'Magic Missile';
  const option = { name, abilityId: 'owned-selected', definitionId: `definition-${name}`,
    resolution: ritual && phase === 'preliminary' || episodeId === 'catalyst'
      ? { kind: 'no_check' } : { kind: 'contextual_check', skill: 'lore', defaultTier: 'standard' },
    ...(ritual ? { workingPhase: phase } : {}) };
  const actor = (actorName, party, area = 'gate') => ({ name: actorName, party, area, status: 'active', vitality: 'unharmed',
    opposed: !party, npcActions: [{ id: 'strike' }, { id: 'brawl' }] });
  const data = { actor: 1, playerInput: input, world: {
    actors: { 'character:1': actor('Sera', true), 'npc:1': actor('Nessa', true),
      ...(ritual ? { 'npc:2': { ...actor('Tarin', true), status: 'dead', vitality: 'incapacitated',
        intactBody: true, willingReturn: true, deathRecorded: true } }
        : { 'npc:2': actor('Raider', false), 'npc:3': actor('Sentry', false, 'yard') }) },
    areas: { 'area:7:gate': { id: 'gate', name: 'Gate' }, 'area:7:yard': { id: 'yard', name: 'Courtyard' } },
    items: { 'item:actual-weapon': { name: 'Light Weapon', holder: 'character:1', wielded: true, weaponKind: 'melee_weapon', condition: 'pristine' },
      ...(ritual ? { 'item:actual-catalyst': { holder: 'character:1', kind: 'revival-catalyst', condition: 'pristine' } } : {}) },
    encounterActive: !ritual },
  history: [{ narrative: 'Nessa says, "I agree to the Courtyard as my destination if your Advance Cue opens that opportunity."' }],
  options: { abilities: [option], utilities: [], knownAreas: [{ id: 'yard', visible: true, safeToOccupy: true, blocked: false }] },
  declarations: [{ name, abilityId: option.abilityId, definitionId: option.definitionId }], finalPlayerMainOfRound: true };
  if (ritual && index === 1) {
    data.options.abilities = []; data.declarations = [];
    data.options.utilities = [{ ...option, kind: 'continue_ritual', retainedBindings: true }];
  }
  if (episodeId === 'catalyst' && index === 1 || episodeId === 'direct-magic' && index === 0) {
    data.options.abilities = []; data.declarations = [];
  }
  return data;
}

const request = (stage, data) => ({ systemInstruction: `AETHERIA_COUNCIL:${stage}\nAuthored diagnostic contract.`, prompt: JSON.stringify(data), jsonMode: true });

export async function runOfflineGameplayProviderTests() {
  let replies = 0;
  for (const episodeId of Object.keys(OFFLINE_GAMEPLAY_INPUTS)) {
    const { Client, counters } = clientType();
    const adapter = installOfflineGameplayProvider({ AIClient: Client, episodeId, onResponse: record => {
      assert.equal(record.kind, 'authored_offline_gameplay'); replies++;
    } });
    const client = new Client();
    const ask = async (stage, data) => JSON.parse(await client.sendPrompt(request(stage, data)));
    const indices = episodeId === 'direct-magic' ? [0, 1, 2] : episodeId === 'ritual' ? [0, 1, 1] : [0, 1];
    for (const [step, index] of indices.entries()) {
      const data = dataFor(episodeId, index, step === 2 ? 'completing' : 'preliminary');
      const before = structuredClone(data);
      const interaction = await ask('interaction', data);
      if (interaction.inputKind === 'clarification') {
        assert.match((await ask('table_talk', data)).narrative, /Sentry is in the Courtyard/u);
        continue;
      }
      const grounding = await ask('grounding', data);
      const ruling = await ask('referee', data);
      const preRoll = { ...data, ruling, grounding }; delete preRoll.finalPlayerMainOfRound;
      assert.deepEqual(await ask('pre_roll', preRoll), grounding);
      assert.equal(ruling.award, null);
      assert.deepEqual(ruling.deltaSources, []);
      assert.deepEqual(data, before, 'The provider adapter must not modify its input world or options.');
      if (episodeId === 'direct-magic') {
        assert.equal(ruling.check.actor, 1);
        assert.equal(Object.hasOwn(ruling.check, 'raw'), false);
        assert.equal(ruling.action.abilityId, 'owned-selected');
        assert.equal(ruling.npcTurns.success.some(value => value.actionId === 'withdraw'), false);
        assert.deepEqual(ruling.npcTurns.success.find(value => value.npc === 'npc:2'), { npc: 'npc:2', actionId: 'strike', target: 'character:1' });
      } else if (episodeId === 'catalyst' && index === 0) {
        assert.equal(ruling.check, null);
        assert.deepEqual(grounding.consentingActors, ['npc:1']);
        assert.deepEqual(ruling.npcTurns.success[0], { npc: 'npc:1', actionId: 'brawl', target: 'npc:2' });
      } else if (episodeId === 'catalyst') {
        assert.deepEqual(ruling.action, { kind: 'ordinary', action: { kind: 'attack', target: 'npc:2', method: 'melee', item: 'item:actual-weapon' } });
      } else {
        assert.equal(ruling.check === null, step !== 2, 'Only the completing contextual working may check.');
        assert.deepEqual(ruling.npcTurns, { success: [], failure: [] });
        if (index === 1) assert.deepEqual(ruling.action, { kind: 'continue_ritual' });
        else assert.deepEqual(ruling.action.bindings, { targets: ['npc:2'], catalyst: 'item:actual-catalyst' });
      }
      if (ruling.noCheckReason) assert.ok([...ruling.noCheckReason].length <= 500);
      const forged = { ...preRoll, ruling: { ...ruling, award: { kind: 'milestone', id: 'invented' } } };
      await assert.rejects(ask('pre_roll', forged));
    }
    const invalid = dataFor(episodeId);
    invalid.playerInput += ' Then teleport.';
    await assert.rejects(ask('interaction', invalid), /outside this authored episode/u);
    await assert.rejects(client.sendPrompt({ systemInstruction: 'Set up a campaign', prompt: '{}' }), /Only gameplay Council/u);
    await assert.rejects(ask('unknown_stage', dataFor(episodeId, 1)));
    assert.equal(counters.originalDispatch, 0);
    assert.equal(adapter.report.dispatchAttempts, 0);
    adapter.abort(new Error('Expected fixture stop.'));
    await assert.rejects(ask('interaction', dataFor(episodeId)), /stopped permanently/u);
    await assert.rejects(client.dispatchPrompt({}), /permanently forbidden/u);
    adapter.restore();
    await assert.rejects(client.sendPrompt({}), /permanently forbidden/u);
    assert.equal(counters.originalDispatch, 0, 'Abort and restore cannot reopen the original transport.');
    assert.throws(() => installOfflineGameplayProvider({ AIClient: Client, episodeId }), /cannot be reinstalled/u);
  }

  const { Client, counters } = clientType();
  const adapter = installOfflineGameplayProvider({ AIClient: Client, episodeId: 'direct-magic' });
  const client = new Client();
  const ask = async (stage, data) => JSON.parse(await client.sendPrompt(request(stage, data)));
  const data = dataFor('direct-magic', 1);
  for (const band of ['clean_success', 'marginal_success', 'crit_success', 'clean_failure', 'marginal_failure', 'crit_failure']) {
    const success = band.endsWith('_success');
    const result = { actor: 'character:1', playerInput: data.playerInput, worldBefore: data.world, worldAfter: data.world,
      check: { band }, effects: success ? [{ op: 'harm', who: 'npc:2' }] : [], events: [], phase: 'complete' };
    assert.match((await ask('narration', result)).narrative, success ? /bolt strikes/u : /fails to strike/u);
    await assert.rejects(ask('narration', { ...result, effects: success ? [] : [{ op: 'harm', who: 'npc:2' }] }), /disagrees/u);
  }
  const fireball = dataFor('direct-magic', 2); fireball.world.actors['npc:1'].area = 'yard';
  await assert.rejects(ask('referee', fireball), /no longer clear of allies/u);
  const missing = dataFor('direct-magic', 1); missing.declarations = [];
  await assert.rejects(ask('referee', missing), /explicit ability declaration/u);
  const proposed = await ask('annotation', { playerInput: data.playerInput, world: data.world, check: { band: 'crit_success' } });
  assert.deepEqual(proposed.effects, []);
  assert.equal((await ask('annotation_review', { playerInput: data.playerInput, world: data.world, proposal: proposed })).approved, true);
  await assert.rejects(ask('annotation_review', { playerInput: data.playerInput, world: data.world, proposal: { ...proposed, effects: [{ op: 'heal', who: 'character:1' }] } }));
  adapter.restore();
  assert.equal(counters.originalDispatch, 0);
  return { episodes: 3, authoredResponses: replies, outcomeBands: 6, originalDispatches: 0, pureFixturesOnly: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log('Offline gameplay provider tests passed:', await runOfflineGameplayProviderTests());
}
