import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createClassSheet, createClassRuleset, createRulesWorld } from './class-state.js';
import { CATALOG_VERSION, CATALOG_OPTION_SET, getAbilityDefinition } from './class-catalog.js';
import { buildClassScenario } from './class-scenario.js';
import { computeCheckTarget } from './rules-resolution.js';

export async function runClassCouncilTests() {
  assert.ok(process.env.RPG_DB_PATH, 'Council tests require a disposable database.');
  const db = await import('./db.js');
  const { AIClient } = await import('./api-client.js');
  const { prepareClassCouncilTurn, resumeClassCouncilTurn, classCouncilWorld } = await import('./class-council.js');
  const { beginRulesOperation, readRulesOperation, completeRulesOperation } = await import('./rules-store.js');
  const originalPrompt = AIClient.prototype.sendPrompt;
  const campaigns = [];
  const apiConfig = { provider: 'openai', model: 'test', apiKey: 'test-only' };
  let responder;
  let calls = [];
  AIClient.prototype.sendPrompt = async request => {
    const stage = /^AETHERIA_COUNCIL:([a-z_]+)/u.exec(request.systemInstruction)?.[1];
    assert.ok(stage, 'All AI calls must pass through a named Council role.');
    const data = JSON.parse(request.prompt);
    calls.push({ stage, data, instruction: request.systemInstruction });
    const response = await responder(stage, data);
    return typeof response === 'string' ? response : JSON.stringify(response);
  };
  async function fixture(familyId = 'armsmaster', branchId = 'discipline', { encounter = false, level = 1 } = {}) {
    const selection = { catalogVersion: CATALOG_VERSION, optionSet: CATALOG_OPTION_SET, familyId, branchId, modules: [], capabilities: { rider: false, alliedActors: false } };
    let sequence = 0;
    const sheet = createClassSheet(selection, { name: 'Hero', level, idFactory: () => `council-owned-${++sequence}` });
    const campaign = await db.run('INSERT INTO campaigns (title, genre, rules_mode, ruleset_json) VALUES (?, ?, 1, ?)', ['Council test', 'fantasy', JSON.stringify(createClassRuleset(selection))]);
    campaigns.push(campaign.id);
    const character = await db.run(`INSERT INTO characters (campaign_id, name, class, health, max_health, mana, max_mana, inventory_json, attributes_json)
      VALUES (?, ?, ?, ?, ?, 0, 0, '[]', '{}')`, [campaign.id, sheet.name, sheet.class, sheet.health, sheet.max_health]);
    const layout = { areas: [{ id: 'gate', name: 'Gate' }, { id: 'yard', name: 'Yard' }], exits: [{ from: 'gate', to: 'yard' }], features: [] };
    const location = await db.run('INSERT INTO locations (campaign_id, name, key, layout_json) VALUES (?, ?, ?, ?)', [campaign.id, 'Gate', 'gate', JSON.stringify(layout)]);
    const foe = await db.run('INSERT INTO npcs (campaign_id, name) VALUES (?, ?)', [campaign.id, 'Guard']);
    const actor = `character:${character.id}`;
    const enemy = `npc:${foe.id}`;
    const initial = createRulesWorld({ location: { id: location.id, layout }, characters: [{ id: character.id, ...sheet }], npcs: [{ id: foe.id, name: 'Guard' }] });
    const world = buildClassScenario({ world: initial, location: { id: location.id, layout }, actorBindings: { hero: actor, foe: enemy },
      frame: { schemaVersion: 1, areas: ['gate', 'yard'].map(area => ({ area, terrain: 'dry_ground', traits: ['visible', 'safe', 'visited', 'focus', 'safe_recovery'], surfaces: ['ground'] })),
        actors: [{ actor: 'hero', area: 'gate', allegiance: 'party', profile: null, conditions: [] }, { actor: 'foe', area: 'gate', allegiance: 'opposition', profile: 'combatant', conditions: [] }],
        items: [], objects: [{ key: 'lock', name: 'Lock', area: 'gate', kind: 'lock', security: 'ordinary', opposed: false, locked: true }],
        features: [], discoveries: [], encounter: { active: encounter, opposition: encounter ? ['foe'] : [] } } }).world;
    const weapon = Object.keys(world.items).find(ref => world.items[ref].holder === actor && world.items[ref].weaponKind === 'melee_weapon');
    return { world, actor, actorId: character.id, enemy, campaignId: campaign.id, weapon, locationId: location.id, sheet };
  }
  const checkCall = sample => ({ actor: sample.actorId, callSeq: 1, intent: 'Strike the guard.', tier: 'standard', tierBasis: 'An alert guard in ordinary reach.', deltas: [] });
  const rulingFor = (sample, patch = {}) => ({ action: { kind: 'ordinary', action: { kind: 'attack', target: sample.enemy, method: 'unarmed' } },
    check: checkCall(sample), deltaSources: [], noCheckReason: null,
    npcTurns: { success: sample.world.encounter.active ? [{ npc: sample.enemy, wait: 'The guard watches the approach.' }] : [], failure: sample.world.encounter.active ? [{ npc: sample.enemy, wait: 'The guard watches the approach.' }] : [] },
    encounter: { success: 'unchanged', failure: 'unchanged' }, award: null, ...patch });
  function responses(sample, ruling, overrides = {}) {
    calls = [];
    responder = async (stage, data) => {
      if (overrides[stage]) return overrides[stage](data);
      if (stage === 'interaction') return { inputKind: 'committed_action', intent: 'Take the stated action.', answer: null };
      if (['grounding', 'pre_roll'].includes(stage)) return { approved: true, reason: 'Grounded in the current scene.', affirmedOpposed: [sample.enemy], consentingActors: [] };
      if (stage === 'referee') return ruling;
      if (stage === 'annotation') return { text: 'The moment passes without another consequence.', effects: [] };
      if (stage === 'annotation_review') return { approved: true, reason: 'The annotation is inert.', affirmedOpposed: [sample.enemy] };
      if (stage === 'narration') return { narrative: 'The action resolves in the courtyard.' };
      if (stage === 'table_talk') return { narrative: 'The guard stands beside the gate.' };
      assert.fail(`Unexpected stage ${stage}.`);
    };
  }
  const prepare = (sample, declarations = { abilities: [] }, extras = {}) => prepareClassCouncilTurn({ apiConfig, state: sample.world, actorId: sample.actorId,
    playerAction: 'I strike the guard.', declarations, history: [], turn: 1, requestId: randomUUID(), ...extras });
  async function reserve(sample, prepared) {
    return beginRulesOperation({ campaignId: sample.campaignId, actor: sample.actorId, turn: prepared.context.turn, requestId: prepared.context.operationId,
      input: { prepared }, catalogVersion: CATALOG_VERSION });
  }
  const resolve = (operation, raw, onRoll = () => {}) => resumeClassCouncilTurn({ apiConfig, operation, resolverOptions: { roll: () => { onRoll(); return raw; }, newId: randomUUID, now: () => '2026-09-07T12:00:00.000Z' } });
  try {
    console.log(' - Running Council role, signed check and durable resume tests...');
    const sample = await fixture();
    responses(sample, rulingFor(sample));
    const prepared = await prepare(sample);
    assert.equal((await db.get('SELECT COUNT(*) AS n FROM rules_checks WHERE campaign_id = ?', [sample.campaignId])).n, 0, 'Preparation cannot roll or persist a check.');
    const operation = await reserve(sample, prepared);
    let rolls = 0;
    const narrated = await resolve(operation, 80, () => rolls++);
    assert.equal(narrated.stage, 'narrated');
    assert.equal(narrated.data.check.band, 'clean_success');
    assert.equal(narrated.data.result.state.actors[sample.enemy].health, sample.world.actors[sample.enemy].health - 2);
    assert.equal(rolls, 1);
    assert.deepEqual(calls.map(call => call.stage), ['interaction', 'grounding', 'referee', 'pre_roll', 'narration'], 'The five-role Council workflow stays in order.');
    const forbidden = new Set(['health', 'maxHealth', 'skillBonus', 'skills', 'T', 'raw', 'tierTarget', 'netDelta', 'amount', 'pointCost']);
    function noArithmetic(value) {
      if (!value || typeof value !== 'object') return;
      for (const [key, child] of Object.entries(value)) { assert.ok(!forbidden.has(key), `Pre-roll role received ${key}.`); noArithmetic(child); }
    }
    calls.slice(0, 4).forEach(call => noArithmetic(call.data));
    assert.deepEqual(classCouncilWorld(sample.world), JSON.parse(JSON.stringify(classCouncilWorld(sample.world))), 'Persistable qualitative projection cannot contain undefined properties.');
    await completeRulesOperation(operation.operationId, { done: true });

    const bounced = await fixture();
    let refereeAttempts = 0;
    responses(bounced, rulingFor(bounced), { referee: () => {
      refereeAttempts++;
      return refereeAttempts === 1 ? rulingFor(bounced, { check: { ...checkCall(bounced), total: 99 } }) : rulingFor(bounced);
    } });
    await prepare(bounced);
    assert.equal(refereeAttempts, 2, 'A structurally invalid arithmetic-bearing call bounces before any roll.');
    assert.equal((await db.get('SELECT COUNT(*) AS n FROM rules_checks WHERE campaign_id = ?', [bounced.campaignId])).n, 0);
    responses(bounced, rulingFor(bounced), { pre_roll: () => ({ approved: false, reason: 'The same circumstance appears in tier and delta.', affirmedOpposed: [bounced.enemy], consentingActors: [] }) });
    await assert.rejects(prepare(bounced), /same circumstance/);
    assert.equal(calls.filter(call => call.stage === 'pre_roll').length, 3);
    assert.equal((await db.get('SELECT COUNT(*) AS n FROM rules_turn_operations WHERE campaign_id = ?', [bounced.campaignId])).n, 0);

    const utility = await fixture();
    responses(utility, rulingFor(utility, { action: { kind: 'ordinary', action: { kind: 'move', area: 'yard' } }, check: null, noCheckReason: 'The route is clear and certain.' }));
    const direct = await prepare(utility);
    const moved = await resolve(await reserve(utility, direct), 100, () => assert.fail('A no-roll utility must not call RNG.'));
    assert.equal(moved.data.check, null);
    assert.equal(moved.data.result.state.actors[utility.actor].area, 'yard');
    assert.equal(calls.filter(call => call.stage === 'annotation').length, 0);
    responses(utility, null, { interaction: () => ({ inputKind: 'clarification', intent: 'Ask about a spell.', answer: 'A question is not a cast.' }) });
    const talk = await prepare(utility, { abilities: [] }, { playerAction: 'What would Magic Missile do?', allowCommitted: false });
    assert.equal(talk.kind, 'table_talk');
    assert.deepEqual(calls.map(call => call.stage), ['interaction', 'table_talk']);

    const wizard = await fixture('arcanist', 'formula');
    const missile = wizard.sheet.abilities.find(ability => getAbilityDefinition(ability.definition_id).name === 'Magic Missile');
    const declaration = { abilities: [{ ability_id: missile.id, definition_id: missile.definition_id, canonical_name: missile.name, canonical_description: missile.description }] };
    const cast = rulingFor(wizard, { action: { kind: 'ability', abilityId: missile.id, bindings: { targets: [wizard.enemy] }, options: {} } });
    responses(wizard, cast);
    const spell = await prepare(wizard, declaration, { playerAction: 'I cast Magic Missile at the guard.' });
    assert.equal(spell.selectedKind, 'ability');
    assert.equal(spell.success.state.actors[wizard.enemy].health, wizard.world.actors[wizard.enemy].health - 5);
    assert.equal(spell.failure.state.actors[wizard.enemy].health, wizard.world.actors[wizard.enemy].health);
    assert.equal(spell.phase, 'complete', 'A basic spell requires no prior combo or working.');
    responses(wizard, cast);
    await assert.rejects(prepare(wizard), /undeclared ability/);
    const coverRef = 'feature:missile-cover';
    wizard.world.features[coverRef] = { id: coverRef, name: 'Crates', area: `area:${wizard.locationId}:gate`, location: wizard.locationId,
      kind: 'cover', duration: 'scene', works_against: 'party', origin: 'mundane', status: 'active', source: 'test', appliedTurn: 1 };
    const coverDelta = { direction: 'hinders', magnitude: 'slight', reason: 'The recorded cover obscures the target.' };
    responses(wizard, { ...cast, check: { ...cast.check, deltas: [coverDelta] }, deltaSources: [{ kind: 'mundane_cover', ref: coverRef }] });
    await assert.rejects(prepare(wizard, declaration), /ignores the selected circumstance/);
    wizard.world.features[coverRef].origin = 'magical';
    responses(wizard, { ...cast, check: { ...cast.check, deltas: [coverDelta] }, deltaSources: [{ kind: 'magical_ward', ref: coverRef }] });
    assert.equal((await prepare(wizard, declaration)).check.call.deltas.length, 1, 'Magical cover is not ignored through name-based inference.');

    const combat = await fixture('armsmaster', 'discipline', { encounter: true });
    const npcTurns = { success: [{ npc: combat.enemy, actionId: 'brawl', target: combat.actor }], failure: [{ npc: combat.enemy, actionId: 'brawl', target: combat.actor }] };
    responses(combat, rulingFor(combat, { npcTurns }));
    const combatPlan = await prepare(combat);
    assert.equal(combatPlan.success.state.actors[combat.actor].health, combat.world.actors[combat.actor].health - 2);
    assert.equal(combatPlan.success.state.actors[combat.enemy].npcState.lastMainRound, 1);
    assert.equal(combatPlan.success.state.turnOrder.round, 2);
    assert.equal(combatPlan.failure.state.actors[combat.enemy].health, combat.world.actors[combat.enemy].health);
    const combatResult = await resolve(await reserve(combat, combatPlan), 2);
    assert.equal(combatResult.data.check.band, 'clean_failure');
    assert.equal(combatResult.data.result.state.actors[combat.enemy].health, combat.world.actors[combat.enemy].health, 'Clean failure cannot apply the success-branch attack.');
    assert.equal((await db.get('SELECT COUNT(*) AS n FROM rules_checks WHERE campaign_id = ?', [combat.campaignId])).n, 1, 'NPC consequences never create extra rolls.');
    const skipped = await fixture('armsmaster', 'discipline', { encounter: true });
    const fallen = await db.run(`INSERT INTO characters (campaign_id, name, class, health, max_health, mana, max_mana, inventory_json, attributes_json)
      VALUES (?, 'Fallen ally', 'Fighter', 0, 32, 0, 0, '[]', '{}')`, [skipped.campaignId]);
    const fallenRef = `character:${fallen.id}`;
    skipped.world.actors[fallenRef] = { ...structuredClone(skipped.world.actors[skipped.actor]), name: 'Fallen ally', health: 0, status: 'downed' };
    skipped.world.turnOrder.order.push(fallenRef);
    const skippedNpcTurns = { success: [{ npc: skipped.enemy, actionId: 'brawl', target: skipped.actor }], failure: [{ npc: skipped.enemy, actionId: 'brawl', target: skipped.actor }] };
    responses(skipped, rulingFor(skipped, { npcTurns: skippedNpcTurns }));
    const skippedPlan = await prepare(skipped);
    assert.equal(calls.find(call => call.stage === 'referee').data.finalPlayerMainOfRound, true);
    assert.equal(skippedPlan.success.state.actors[skipped.enemy].npcState.lastMainRound, 1, 'An incapacitated final registered PC cannot suppress the NPC round.');
    assert.equal(skippedPlan.success.state.turnOrder.currentIndex, 0);
    assert.equal(skippedPlan.success.state.turnOrder.round, 2);

    const edge = await fixture('armsmaster', 'discipline', { encounter: true });
    responses(edge, rulingFor(edge), { annotation: () => ({ text: 'The guard suffers another glancing impact.', effects: [{ op: 'harm', who: edge.enemy, grade: 'graze' }] }) });
    const edgePrepared = await prepare(edge);
    const edgeOperation = await reserve(edge, edgePrepared);
    const critical = await resolve(edgeOperation, 100);
    assert.equal(critical.data.check.annotation.effects[0].catalogVersion, edge.world.effectCatalogVersion, 'The immutable annotation stores engine-stamped resolved effects.');
    assert.equal(critical.data.check.annotation.effects[0].pricingPrestate.appliedAmount, 2);
    assert.equal(critical.data.result.state.actors[edge.enemy].health, edge.world.actors[edge.enemy].health - 4);
    assert.equal(calls.find(call => call.stage === 'annotation').instruction.includes('harm {who,grade:graze|wound|grievous}'), true);
    const beforeResume = calls.length;
    assert.deepEqual(await resolve(await readRulesOperation(edgeOperation.operationId), 1, () => assert.fail('A narrated operation cannot reroll.')), critical);
    assert.equal(calls.length, beforeResume);

    const marginal = await fixture('armsmaster', 'discipline', { encounter: true });
    responses(marginal, rulingFor(marginal), { annotation: () => ({ text: 'The effort leaves the hero exposed.', effects: [{ op: 'hindrance_apply', who: marginal.actor, condition: 'exposed', duration: 'scene', detail: 'Committed to the action.' }] }) });
    const marginalPrepared = await prepare(marginal);
    const target = computeCheckTarget({ tier: marginalPrepared.check.call.tier, skillBonus: marginalPrepared.check.skillBonus }).T;
    const marginalResult = await resolve(await reserve(marginal, marginalPrepared), target);
    assert.equal(marginalResult.data.check.band, 'marginal_success');
    assert.equal(marginalResult.data.result.state.actors[marginal.enemy].health, marginal.world.actors[marginal.enemy].health - 2);
    assert.ok(marginalResult.data.result.state.actors[marginal.actor].conditions.exposed);
    const marginalFailure = await fixture('armsmaster', 'discipline', { encounter: true });
    responses(marginalFailure, rulingFor(marginalFailure), { annotation: () => ({ text: 'The failed effort leaves the hero exposed.', effects: [{ op: 'hindrance_apply', who: marginalFailure.actor, condition: 'exposed', duration: 'scene', detail: 'Committed to the failed action.' }] }) });
    const failurePrepared = await prepare(marginalFailure);
    const failureTarget = computeCheckTarget({ tier: failurePrepared.check.call.tier, skillBonus: failurePrepared.check.skillBonus }).T;
    const failedMarginal = await resolve(await reserve(marginalFailure, failurePrepared), failureTarget - 1);
    assert.equal(failedMarginal.data.check.band, 'marginal_failure');
    assert.equal(failedMarginal.data.result.state.actors[marginalFailure.enemy].health, marginalFailure.world.actors[marginalFailure.enemy].health, 'A marginal failure cannot acquire its attack success through texture.');
    assert.ok(failedMarginal.data.result.state.actors[marginalFailure.actor].conditions.exposed);

    const longAnnotation = await fixture();
    responses(longAnnotation, rulingFor(longAnnotation), { annotation: () => ({ text: 'x'.repeat(301), effects: [] }) });
    const tooLong = await resolve(await reserve(longAnnotation, await prepare(longAnnotation)), 100);
    assert.equal(tooLong.data.check.annotation, null);
    assert.ok(tooLong.data.check.annotationRejected.length <= 200);
    assert.equal(calls.filter(call => call.stage === 'annotation').length, 2, 'Malformed annotations exhaust the same single-revision budget.');

    const rejected = await fixture('armsmaster', 'discipline', { encounter: true });
    responses(rejected, rulingFor(rejected), { annotation: () => ({ text: 'The hero suffers an unpermitted extra hit.', effects: [{ op: 'harm', who: rejected.actor, grade: 'graze' }] }) });
    const rejectPrepared = await prepare(rejected);
    const rejectedResult = await resolve(await reserve(rejected, rejectPrepared), 100);
    assert.equal(rejectedResult.data.check.annotation, null);
    assert.equal(rejectedResult.data.check.annotationFinalized, true);
    assert.ok(rejectedResult.data.check.annotationRejected);
    assert.equal(calls.filter(call => call.stage === 'annotation').length, 2);
    assert.equal(rejectedResult.data.result.state.actors[rejected.actor].health, rejected.world.actors[rejected.actor].health);

    const interrupted = await fixture('armsmaster', 'discipline', { encounter: true });
    let reviews = 0;
    let proposals = 0;
    responses(interrupted, rulingFor(interrupted), {
      annotation: () => { proposals++; return { text: 'No mechanical complication occurs.', effects: [] }; },
      annotation_review: () => { reviews++; if (reviews === 1) return { approved: false, reason: 'First semantic rejection.', affirmedOpposed: [] };
        if (reviews === 2) throw new Error('Provider temporarily unavailable.');
        return { approved: false, reason: 'Final semantic rejection.', affirmedOpposed: [] }; }
    });
    const interruptedPlan = await prepare(interrupted);
    const interruptedOperation = await reserve(interrupted, interruptedPlan);
    let interruptedRolls = 0;
    await assert.rejects(resolve(interruptedOperation, 100, () => interruptedRolls++), /temporarily unavailable/);
    const saved = await readRulesOperation(interruptedOperation.operationId);
    assert.equal(saved.data.annotationWork.failures, 1);
    assert.ok(saved.data.annotationWork.proposal, 'The valid proposal is durable before its review network call.');
    const resumed = await resolve(saved, 1, () => interruptedRolls++);
    assert.equal(interruptedRolls, 1);
    assert.equal(proposals, 2, 'A provider interruption resumes the saved revision, never grants extra proposals.');
    assert.equal(resumed.data.check.annotationRejected, 'Final semantic rejection.');

    const narrationRetry = await fixture();
    let narrations = 0;
    responses(narrationRetry, rulingFor(narrationRetry), { narration: () => { if (++narrations === 1) throw new Error('Narration connection lost.'); return { narrative: 'The same committed hit is narrated.' }; } });
    const retryPlan = await prepare(narrationRetry);
    const retryOperation = await reserve(narrationRetry, retryPlan);
    let retryRolls = 0;
    await assert.rejects(resolve(retryOperation, 80, () => retryRolls++), /connection lost/);
    const retrySaved = await readRulesOperation(retryOperation.operationId);
    assert.equal(retrySaved.stage, 'resolved');
    const retryFinished = await resolve(retrySaved, 1, () => retryRolls++);
    assert.equal(retryRolls, 1);
    assert.equal(retryFinished.data.check.raw, 80);
    assert.equal(calls.filter(call => call.stage === 'referee').length, 1);

    const ritual = await fixture('arcanist', 'ritual', { level: 5 });
    const transit = ritual.sheet.abilities.find(ability => getAbilityDefinition(ability.definition_id).name === 'Transit Circle');
    const ritualDeclaration = { abilities: [{ ability_id: transit.id, definition_id: transit.definition_id, canonical_name: transit.name, canonical_description: transit.description }] };
    const ritualRuling = rulingFor(ritual, { action: { kind: 'ability', abilityId: transit.id, bindings: { travelers: [ritual.actor], area: 'yard' }, options: {} }, check: null, noCheckReason: 'This is the initial recorded working.' });
    responses(ritual, ritualRuling);
    const ritualStart = await prepare(ritual, ritualDeclaration, { playerAction: 'I begin Transit Circle to the yard.' });
    assert.equal(ritualStart.phase, 'ritual_progress');
    assert.equal(ritualStart.success.state.actors[ritual.actor].area, 'gate');
    assert.equal(ritualStart.success.state.actors[ritual.actor].classState.ritual.completed, 1);
    ritual.world = ritualStart.success.state;
    responses(ritual, rulingFor(ritual, { action: { kind: 'continue_ritual' } }));
    const ritualEnd = await prepare(ritual, { abilities: [] }, { playerAction: 'I continue the working.', turn: 2 });
    assert.equal(ritualEnd.phase, 'complete');
    assert.equal(ritualEnd.success.state.actors[ritual.actor].area, 'yard');
    assert.equal(ritualEnd.success.state.actors[ritual.actor].classState.ritual, null);
  } finally {
    AIClient.prototype.sendPrompt = originalPrompt;
    for (const id of campaigns) await db.run('DELETE FROM campaigns WHERE id = ?', [id]);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const directory = await mkdtemp(path.join(tmpdir(), 'aetheria-class-council-'));
  process.env.RPG_DB_PATH = path.join(directory, 'test.db');
  const db = await import('./db.js');
  try { await db.initDb(); await runClassCouncilTests(); console.log('Council tests passed.'); }
  finally { await db.closeDb(); await rm(directory, { recursive: true, force: true }); }
}
