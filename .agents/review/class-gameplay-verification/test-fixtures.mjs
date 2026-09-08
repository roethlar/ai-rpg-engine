import assert from 'node:assert/strict';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { prepareDirectMagicEpisode, prepareCatalystEpisode, prepareRitualEpisode } from './fixtures.mjs';

export async function runGameplayFixtureTests() {
  const directory = await mkdtemp(join(tmpdir(), 'aetheria-gameplay-fixtures-'));
  const databasePath = join(directory, 'test.db');
  const previousDatabasePath = process.env.RPG_DB_PATH;
  const originalFetch = globalThis.fetch;
  let fetchAttempts = 0;
  let providerAttempts = 0;
  let db;
  let AIClient;
  let ownsDatabase = false;
  let originalPrompt;
  let originalDispatch;
  process.env.RPG_DB_PATH = databasePath;
  globalThis.fetch = async () => {
    fetchAttempts++;
    throw new Error('Fixture tests forbid every network fetch, including local inference.');
  };
  try {
    db = await import('../../../db.js');
    const main = (await db.all('PRAGMA database_list')).find(value => value.name === 'main');
    assert.equal(await realpath(main.file), await realpath(databasePath), 'A cached non-fixture database must never be initialized.');
    ownsDatabase = true;
    await db.initDb();
    const engine = await import('../../../rpg-engine.js');
    ({ AIClient } = await import('../../../api-client.js'));
    const { getAbilityDefinition } = await import('../../../class-catalog.js');
    const { prepareClassAction } = await import('../../../class-actions.js');
    const { prepareOrdinaryAction } = await import('../../../class-ordinary.js');
    const { validateClassBundle } = await import('../../../class-portability.js');
    originalPrompt = AIClient.prototype.sendPrompt;
    originalDispatch = AIClient.prototype.dispatchPrompt;
    const forbiddenProvider = async () => {
      providerAttempts++;
      throw new Error('Fixture preparation cannot forward an unhandled provider request.');
    };
    AIClient.prototype.sendPrompt = forbiddenProvider;
    AIClient.prototype.dispatchPrompt = forbiddenProvider;
    const apiConfig = { provider: 'ollama', model: 'offline-fixture-test', imageProvider: '', voiceProvider: '' };
    const originalConfig = structuredClone(apiConfig);
    const dependencies = { engine, db, AIClient, apiConfig };
    const direct = await prepareDirectMagicEpisode(dependencies);
    const campaignId = direct.state.campaignId;
    const row = await db.get('SELECT rules_state_json FROM campaigns WHERE id = ?', [campaignId]);
    const saved = JSON.parse(row.rules_state_json);
    const snapshot = structuredClone(saved);
    const actorRef = `character:${direct.state.character.id}`;
    const actor = saved.actors[actorRef];
    const raiderRef = Object.keys(saved.actors).find(ref => saved.actors[ref].name === 'Raider');
    const sentryRef = Object.keys(saved.actors).find(ref => saved.actors[ref].name === 'Sentry');
    assert.equal(direct.episodeId, 'direct-magic');
    assert.equal(actor.classBuild.branchId, 'arcanist.formula');
    assert.equal(actor.level, 1);
    assert.equal(actor.xp, 0);
    assert.equal(saved.encounter.active, true);
    assert.equal(saved.actors[raiderRef].area, actor.area);
    assert.ok(saved.actors[raiderRef].opposed && saved.actors[raiderRef].health > 0);
    const yard = saved.areas[`area:${saved.currentLocationId}:yard`];
    assert.ok(yard.visible && yard.adjacent.includes(actor.area));
    assert.deepEqual(Object.keys(saved.actors).filter(ref => saved.actors[ref].present && saved.actors[ref].area === 'yard'), [sentryRef],
      'The initial Fireball area contains the real opposed Sentry and no silently excluded party member.');
    assert.ok(saved.actors[sentryRef].opposed && saved.actors[sentryRef].health > 0);
    const context = { operationId: 'fixture-authorizer-preview', turn: 2, round: saved.turnOrder.round,
      affirmedOpposed: [raiderRef, sentryRef] };
    for (const name of ['Magic Missile', 'Fireball']) {
      const ability = actor.abilities.find(value => value.name === name);
      assert.ok(ability?.invocation, `The level-one sheet owns invocable ${name}.`);
      assert.equal(getAbilityDefinition(ability.definition_id, ability.definition_version).grantedAtLevel, 1);
      const plan = prepareClassAction({ state: saved, actor: actorRef, ability: ability.id,
        bindings: name === 'Magic Missile' ? { targets: [raiderRef] } : { area: 'yard' }, context });
      assert.equal(plan.phase, 'complete', 'Routine spells are immediately executable without a setup sequence.');
      assert.equal(plan.check.skill, 'lore');
      assert.deepEqual(plan.targets, [name === 'Magic Missile' ? raiderRef : sentryRef]);
    }
    const attack = prepareOrdinaryAction({ state: saved, actor: actorRef, action: { kind: 'attack', method: 'unarmed', target: raiderRef }, context });
    const move = prepareOrdinaryAction({ state: saved, actor: actorRef, action: { kind: 'move', area: 'yard' }, context });
    assert.equal(attack.check.skill, 'melee');
    assert.equal(move.check.skill, 'move', 'Leaving a threatened position is an ordinary attempt, not guaranteed escape.');
    assert.deepEqual(saved, snapshot, 'Authorizer previews cannot mutate the scene or spend a spell.');
    assert.equal((await db.get('SELECT rules_state_json FROM campaigns WHERE id = ?', [campaignId])).rules_state_json, row.rules_state_json);
    assert.deepEqual(direct.playerPlan.map(value => value.kind), ['question', 'direct_spell', 'conditional_fireball']);
    assert.ok(direct.playerPlan.every(value => typeof value.input === 'string' && value.input.length > 0));
    assert.match(direct.playerPlan[2].description, /current visible Courtyard.*living opposition.*no party member/u);
    assert.equal(direct.setup.stubbedResponses, 4);
    assert.deepEqual(direct.setup.stages, Array(4).fill('setup:direct-magic'));

    const catalyst = await prepareCatalystEpisode(dependencies);
    const ritual = await prepareRitualEpisode(dependencies);
    assert.equal(catalyst.state.character.level, 1);
    assert.equal(catalyst.state.character.classState.cue, null);
    assert.equal(ritual.state.character.level, 10);
    assert.equal(ritual.earnedAdvancements, 9);
    assert.equal(ritual.state.character.classState.ritual, null);
    for (const fixture of [direct, catalyst, ritual]) {
      assert.equal(fixture.setup.kind, 'authored_fixture');
      assert.equal(fixture.setup.liveProviderCalls, 0);
      assert.equal(fixture.setup.providerDispatchAttempts, 0);
      assert.equal(fixture.state.turn.number, 1);
      assert.equal(fixture.state.pendingAction, null);
      for (const table of ['rules_turn_operations', 'rules_checks']) {
        assert.equal((await db.get(`SELECT COUNT(*) AS count FROM ${table} WHERE campaign_id = ?`, [fixture.state.campaignId])).count, 0,
          'Prepared gameplay episodes have no fabricated gameplay operation or signed outcome.');
      }
      validateClassBundle(await engine.exportCampaign(fixture.state.campaignId));
    }
    assert.equal((await db.get('SELECT COUNT(*) AS count FROM rules_turn_operations')).count, 9,
      'Only actual offline advancement turns created operations.');
    assert.deepEqual(apiConfig, originalConfig);
    assert.equal(AIClient.prototype.sendPrompt, forbiddenProvider);
    assert.equal(AIClient.prototype.dispatchPrompt, forbiddenProvider);
    assert.equal(fetchAttempts, 0);
    assert.equal(providerAttempts, 0);
    const savedCampaigns = (await db.get('SELECT COUNT(*) AS count FROM campaigns')).count;
    const authoredSetupResponses = [direct, catalyst, ritual].reduce((total, fixture) => total + fixture.setup.stubbedResponses, 0);
    assert.equal(savedCampaigns, 4);
    assert.equal(authoredSetupResponses, 61);
    return { fixtures: 3, savedCampaigns, earnedAdvancements: 9, authoredSetupResponses,
      gameplayOperations: 0, providerDispatches: 0, fetches: 0 };
  } finally {
    if (originalPrompt) AIClient.prototype.sendPrompt = originalPrompt;
    if (originalDispatch) AIClient.prototype.dispatchPrompt = originalDispatch;
    globalThis.fetch = originalFetch;
    if (ownsDatabase) await db.closeDb();
    if (previousDatabasePath === undefined) delete process.env.RPG_DB_PATH;
    else process.env.RPG_DB_PATH = previousDatabasePath;
    await rm(directory, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log('Gameplay fixture tests passed:', await runGameplayFixtureTests());
}
