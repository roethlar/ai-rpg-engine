import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { evaluateEffects, EFFECT_CATALOG_VERSION, EFFECT_VALUES, effectComparisonKey, SUPPORTED_EFFECT_OPERATIONS } from './rules-effects.js';
import { REQUIRED_EFFECT_OPERATIONS, getAbilityDefinition } from './class-catalog.js';

const errorCode = name => error => error.code === `RULES_EFFECT_${name}`;
const condition = (actor, token, duration = 'scene') => ({ actor, condition: token,
  class: ['steadied', 'inspired', 'concealed'].includes(token) ? 'boon' : 'hindrance',
  duration, detail: 'Recorded condition.', source: 'previous', appliedTurn: 1 });

export function effectsTestState() {
  const actor = (name, party, area = 'a') => ({ name, health: 20, maxHealth: 30, party, present: true,
    locationId: 1, area, status: 'active', inventory: [], resources: { mana: { current: 4, max: 6 }, strain: { current: 2, max: 6 } },
    conditions: {}, classState: {}, relationshipValue: 0, wealth: 'comfortable', willingTravel: true });
  const area = (id, locationId = 1) => ({ id, locationId, adjacent: id === 'a' ? ['b'] : ['a'], exits: [],
    visible: true, safeToOccupy: true, visited: true, focus: true, anchor: true, teleportWard: false });
  const item = (id, holder) => ({ id, holder, name: 'Recorded saber', type: 'weapon', description: 'A plain saber.',
    condition: 'pristine', class: 'mundane', lost: false, provenance: ['authored'], weapon: true, wielded: true });
  const state = {
    effectCatalogVersion: EFFECT_CATALOG_VERSION, currentLocationId: 1,
    actors: { 'character:1': actor('Hero', true), 'character:2': actor('Ally', true),
      'npc:2': actor('Foe', false), 'npc:3': actor('Companion', true) },
    areas: { 'area:1:a': area('a'), 'area:1:b': area('b'), 'area:2:d': area('d', 2) },
    items: { 'item:1': item('item:1', 'npc:2'), 'item:2': { ...item('item:2', 'character:1'), kind: 'revival-catalyst', weapon: false, wielded: false, class: 'significant' } },
    features: {}, facts: [], encounter: { active: false, participants: [] },
    objects: { 'object:1': { kind: 'lock', locationId: 1, area: 'a', security: 'ordinary', opposed: false, locked: true, disabled: null } },
    vehicles: { 'vehicle:1': { locationId: 1, area: 'a', hull: 10, maxHull: 20, operator: 'character:1', status: 'active' } }
  };
  state.areas['area:1:a'].exits = ['area:2:d'];
  state.actors['character:1'].inventory = [{ name: 'Rope', type: 'general', description: 'Ordinary rope.', quantity: 2 }];
  state.actors['npc:2'].knowledge = [{ id: 'attack', scope: 'combat_trait', fact: 'The recorded attack favors reach.', discovered: false }];
  state.areas['area:2:d'].knowledge = [
    { id: 'bridge', scope: 'area_features', fact: 'The bridge crosses the canal.', discovered: false },
    { id: 'tower', scope: 'area_features', fact: 'The tower overlooks the bridge.', discovered: false }
  ];
  return state;
}

export function runRulesEffectsTests() {
  console.log(' - Running versioned effect evaluator tests...');
  const executed = new Set();
  const evaluate = (effects, state = effectsTestState(), options = {}) => {
    const before = structuredClone(state);
    const input = structuredClone(effects);
    const result = evaluateEffects({ state, effects, consumer: 'ordinary', actor: 1, turn: 5, transactionId: 'transaction-5', affirmedOpposed: ['npc:2'], ...options });
    assert.deepEqual(state, before, 'Successful evaluation must not mutate the input snapshot.');
    assert.deepEqual(effects, input, 'Evaluator cannot rewrite input proposals.');
    result.effects.forEach(effect => executed.add(effect.op));
    return result;
  };
  const reject = (effects, expected, state = effectsTestState(), options = {}) => {
    const before = structuredClone(state);
    assert.throws(() => evaluate(effects, state, options), errorCode(expected));
    assert.deepEqual(state, before, 'Failed arrays cannot leak partial changes.');
  };
  const harm = { op: 'harm', who: 'npc:2', grade: 'wound' };
  const heal = { op: 'heal', who: 'character:1', grade: 'mend' };
  const step = { op: 'reposition', who: 'character:1', area: 'b', quality: 'neutral' };
  const feature = { op: 'scene_feature_place', area: 'a', kind: 'smoke', name: 'Drifting smoke', duration: 'scene', works_against: 'opposition' };
  const hinder = { op: 'hindrance_apply', who: 'npc:2', condition: 'hindered', duration: 'scene', detail: 'Awkward footing.' };
  const boon = { op: 'boon_apply', who: 'character:1', condition: 'steadied', duration: 'scene', detail: 'Braced footing.' };

  assert.deepEqual(EFFECT_VALUES.harm, { graze: 2, wound: 5, grievous: 9 });
  assert.deepEqual(EFFECT_VALUES.heal, { patch: 3, mend: 6, restore: 10 });
  assert.equal(evaluate([harm]).state.actors['npc:2'].health, 15);
  assert.equal(evaluate([heal]).state.actors['character:1'].health, 26);
  for (const [grade, amount] of Object.entries(EFFECT_VALUES.harm)) assert.equal(evaluate([{ ...harm, grade }]).state.actors['npc:2'].health, 20 - amount);
  for (const [grade, amount] of Object.entries(EFFECT_VALUES.heal)) assert.equal(evaluate([{ ...heal, grade }]).state.actors['character:1'].health, Math.min(30, 20 + amount));
  let state = effectsTestState();
  state.actors['npc:2'].health = 1;
  const zero = evaluate([harm], state);
  assert.equal(zero.state.actors['npc:2'].health, 0);
  assert.equal(zero.state.actors['npc:2'].status, 'active', 'Zero health is not an implicit death/removal.');
  assert.equal(zero.state.actors['npc:2'].present, true);
  assert.ok(zero.events.some(event => event.type === 'health_zero'));
  state.actors['character:1'].health = 30;
  reject([heal], 'NO_OP', state);
  assert.equal(evaluate([{ op: 'pool_drain', who: 'character:1', pool: 'mana', depth: 'shallow' }]).state.actors['character:1'].resources.mana.current, 2);
  assert.equal(evaluate([{ op: 'pool_restore', who: 'character:1', pool: 'mana', depth: 'deep' }]).state.actors['character:1'].resources.mana.current, 6);
  reject([{ op: 'pool_drain', who: 'character:1', pool: 'invented', depth: 'deep' }], 'SHAPE');

  assert.equal(effectComparisonKey('  Stra\u00dfe\t ROPE '), effectComparisonKey('STRASSE rope'));
  assert.notEqual(effectComparisonKey('\u0131'), effectComparisonKey('i'), 'Full default fold must preserve dotless i.');
  assert.equal(effectComparisonKey('\u03c2'), effectComparisonKey('\u03c3'));
  assert.equal(effectComparisonKey('Cafe\u0301'), effectComparisonKey('CAF\u00c9'));
  assert.equal(evaluate([{ op: 'item_gain', owner: 'character:1', name: ' rope ' }]).state.actors['character:1'].inventory[0].quantity, 3);
  assert.equal(evaluate([{ op: 'item_lose', owner: 'character:1', item: 'ROPE' }]).state.actors['character:1'].inventory[0].quantity, 1);
  assert.equal(evaluate([{ op: 'item_gain', owner: 'character:1', name: 'Copper key' }]).state.actors['character:1'].inventory[1].quantity, 1);
  assert.equal(evaluate([{ op: 'item_lose', item: 'item:1' }]).state.items['item:1'].lost, true);
  assert.equal(evaluate([{ op: 'item_transfer', item: 'item:1', from: 'npc:2', to: 'character:1' }]).state.items['item:1'].holder, 'character:1');
  assert.equal(evaluate([{ op: 'item_drop', item: 'item:1', area: 'b' }]).state.items['item:1'].holder, 'area:1:b');
  state = effectsTestState(); state.items['item:1'].holder = 'area:1:a';
  assert.equal(evaluate([{ op: 'item_pickup', item: 'item:1', owner: 'character:1' }], state).state.items['item:1'].holder, 'character:1');
  reject([{ op: 'item_lose', item: 'item:1' }], 'REFERENCE', state);
  state = effectsTestState();
  state.actors['character:1'].classBuild = { familyId: 'armsmaster', branchId: 'discipline' };
  Object.assign(state.items['item:1'], { holder: 'character:1', weaponKind: 'melee_weapon', weaponCategory: 'martial', wielded: false, equipped: false });
  const ready = { op: 'item_ready', owner: 'character:1', item: 'item:1' };
  const readied = evaluate([ready], state);
  assert.equal(readied.state.items['item:1'].wielded, true);
  assert.equal(readied.state.items['item:1'].equipped, true);
  assert.deepEqual(readied.effects[0].pricingPrestate, { holder: 'character:1', wielded: false, equipped: false, class: 'mundane' });
  reject([ready], 'NO_OP', readied.state);
  reject([ready], 'AUTHORIZATION', state, { consumer: 'ability' });
  reject([ready], 'AUTHORIZATION', state, { consumer: 'annotation', band: 'crit_success', stakesLicense: 'minor' });
  reject([{ ...ready, owner: 'character:2' }], 'AUTHORIZATION', state);
  reject([{ ...ready, grade: 'grievous' }], 'SHAPE', state);
  const untrainedReady = structuredClone(state);
  untrainedReady.actors['character:1'].classBuild = { familyId: 'arcanist', branchId: 'formula' };
  reject([ready], 'AUTHORIZATION', untrainedReady);
  for (const fields of [{ condition: 'broken' }, { natural: true }, { fixed: true }, { holder: 'npc:2' }, { weapon: false }]) {
    const unusable = structuredClone(state); Object.assign(unusable.items['item:1'], fields);
    reject([ready], 'PRECONDITION', unusable);
  }
  const incompatibleCategory = structuredClone(state); incompatibleCategory.items['item:1'].weaponKind = 'ranged_weapon';
  reject([ready], 'STATE', incompatibleCategory);
  const forgedEquipment = structuredClone(state); forgedEquipment.items['item:1'].equipmentId = 'equipment.unknown';
  reject([ready], 'AUTHORIZATION', forgedEquipment);
  reject([ready, ready], 'NO_OP', state);
  reject([ready, { op: 'harm', who: 'npc:missing', grade: 'wound' }], 'REFERENCE', state);
  state = effectsTestState(); state.actors['character:1'].inventory[0].stats = { attack: 1 };
  reject([{ op: 'item_gain', owner: 'character:1', name: 'rope' }], 'PRECONDITION', state);
  reject([{ op: 'item_lose', owner: 'character:1', item: 'rope' }], 'PRECONDITION', state);
  state = effectsTestState(); state.actors['character:1'].inventory.push({ name: ' ROPE ', quantity: 1 });
  reject([{ op: 'item_lose', owner: 'character:1', item: 'rope' }], 'REFERENCE', state);
  state = effectsTestState(); state.actors['character:1'].inventory[0].effect = 'heal_20';
  assert.equal(evaluate([{ op: 'item_lose', owner: 'character:1', item: 'rope' }], state).state.actors['character:1'].health, 20);
  reject([{ op: 'item_gain', owner: 'character:1', name: 'rope' }], 'PRECONDITION', state);
  reject([{ op: 'item_gain', owner: 'character:1', name: 'item:1' }], 'REFERENCE');
  assert.equal(evaluate([{ op: 'item_condition_shift', item: 'item:1', direction: 'degrade', to: 'broken' }]).effects[0].pointCost, 2);
  reject([{ op: 'item_condition_shift', item: 'item:1', direction: 'degrade', to: 'pristine' }], 'NO_OP');
  assert.equal(evaluate([{ op: 'wealth_shift', who: 'npc:2', direction: 'down', to: 'destitute' }]).effects[0].pointCost, 2);
  assert.equal(evaluate([{ op: 'disposition_improve', npc: 'npc:2', step: 'marked' }], undefined, { affirmedOpposed: [] }).state.actors['npc:2'].relationshipValue, 25);
  assert.equal(evaluate([{ op: 'disposition_worsen', npc: 'npc:2', step: 'slight' }]).state.actors['npc:2'].relationshipValue, -10);

  const moved = evaluate([step]);
  assert.equal(moved.state.actors['character:1'].area, 'b');
  assert.equal(moved.effects[0].area, 'area:1:b');
  reject([{ ...step, area: 'd' }], 'REFERENCE');
  reject([{ ...step, area: 'a' }], 'NO_OP');
  state = effectsTestState(); state.actors['character:1'].conditions.pinned = condition('character:1', 'pinned');
  reject([step], 'PRECONDITION', state);
  const cleared = evaluate([{ op: 'condition_clear', who: 'character:1', condition: 'pinned' }, step], state);
  assert.equal(cleared.state.actors['character:1'].area, 'b');
  reject([step, { op: 'condition_clear', who: 'character:1', condition: 'pinned' }], 'PRECONDITION', state);
  assert.equal(evaluate([hinder]).state.actors['npc:2'].conditions.hindered.appliedTurn, 5);
  assert.equal(evaluate([boon]).state.actors['character:1'].conditions.steadied.source, 'transaction-5');
  state = evaluate([{ ...hinder, duration: 'persistent' }]).state;
  assert.equal(evaluate([{ op: 'condition_clear', who: 'npc:2', condition: 'hindered' }], state).effects[0].pointCost, 2);
  const placed = evaluate([feature]);
  const featureRef = placed.effects[0].resolvedTargets.feature;
  const removed = evaluate([{ op: 'scene_feature_clear', feature: featureRef }], placed.state);
  assert.equal(removed.state.features[featureRef].status, 'cleared');
  assert.equal(removed.state.features[featureRef].clearedBy, 'transaction-5');
  reject([{ op: 'scene_feature_clear', feature: featureRef }], 'REFERENCE', removed.state);
  const start = { op: 'encounter_start', posture: 'hostile', outcome: 'party_costing', participants: ['npc:2'] };
  const encounter = evaluate([start]);
  assert.equal(encounter.state.encounter.active, true);
  assert.equal(evaluate([{ op: 'encounter_end', outcome: 'party_favored' }], encounter.state).state.encounter.active, false);
  const exited = evaluate([{ op: 'scene_exit', who: 'npc:2', quality: 'unfavorable' }], encounter.state);
  assert.equal(exited.state.actors['npc:2'].present, false);
  assert.deepEqual(exited.state.encounter.participants, []);
  assert.equal(exited.state.encounter.active, false);
  reject([{ ...start, participants: ['npc:2', 'npc:2'] }], 'SHAPE');
  const fact = { op: 'fact_learn', fact: 'The hinge faces inward.' };
  const learned = evaluate([fact]);
  assert.deepEqual(learned.state.facts[0], { fact: fact.fact, turn: 5, importance: 3, keywords: [] });
  reject([fact], 'NO_OP', learned.state);

  state = placed.state;
  state.actors['character:1'].conditions.winded = condition('character:1', 'winded');
  state.actors['character:1'].conditions.hindered = condition('character:1', 'hindered', 'persistent');
  const traveled = evaluate([{ op: 'location_transition', location: 'location:2', area: 'd' }], state);
  assert.equal(traveled.state.currentLocationId, 2);
  assert.equal(traveled.state.actors['character:2'].locationId, 2);
  assert.equal(traveled.state.actors['npc:2'].locationId, 1);
  assert.equal(traveled.state.actors['character:1'].conditions.winded, undefined);
  assert.ok(traveled.state.actors['character:1'].conditions.hindered);
  assert.equal(traveled.state.features[featureRef].status, 'cleared');
  reject([{ op: 'location_transition', location: 'location:2', area: 'd' }], 'PRECONDITION', encounter.state);
  state = effectsTestState(); state.actors['npc:2'].health = 0;
  const downed = evaluate([{ op: 'actor_status', who: 'npc:2', status: 'downed' }], state);
  assert.equal(downed.state.actors['npc:2'].status, 'downed');
  const dead = evaluate([{ op: 'actor_status', who: 'npc:2', status: 'dead' }], downed.state);
  assert.equal(dead.state.actors['npc:2'].deathTurn, 5);
  reject([harm], 'PRECONDITION', dead.state);

  const ability = { consumer: 'ability' };
  assert.equal(evaluate([{ op: 'disarm', who: 'npc:2', item: 'item:1' }], undefined, ability).state.items['item:1'].holder, 'area:1:a');
  state = effectsTestState(); state.items['item:1'].natural = true;
  reject([{ op: 'disarm', who: 'npc:2', item: 'item:1' }], 'PRECONDITION', state, ability);
  assert.equal(evaluate([{ op: 'item_consume', owner: 'character:1', item: 'item:2', quantity: 1 }], undefined, ability).state.items['item:2'].lost, true);
  const unlock = { op: 'object_unlock', object: 'object:1', maximumSecurity: 'ordinary' };
  assert.equal(evaluate([unlock], undefined, ability).state.objects['object:1'].locked, false);
  state = effectsTestState(); state.objects['object:1'].opposed = true;
  assert.equal(evaluate([unlock], state).state.objects['object:1'].locked, false, 'Ordinary successful lockpicking has a real object operation.');
  reject([unlock], 'PRECONDITION', state, ability);
  const disable = { op: 'object_disable', object: 'object:1', maximumSecurity: 'ordinary', duration: 'scene' };
  assert.equal(evaluate([disable], undefined, ability).state.objects['object:1'].disabled.appliedTurn, 5);
  state = effectsTestState(); state.objects['object:1'].security = 'protected';
  reject([unlock], 'PRECONDITION', state, ability);
  const repair = { op: 'vehicle_repair', who: 'vehicle:1', amount: 8 };
  assert.equal(evaluate([repair], undefined, ability).state.vehicles['vehicle:1'].hull, 18);
  reject([{ ...repair, amount: 80 }], 'SHAPE', undefined, ability);
  const vehicleHarm = { op: 'vehicle_harm', who: 'vehicle:1', grade: 'wound' };
  assert.equal(evaluate([vehicleHarm]).state.vehicles['vehicle:1'].hull, 5);
  const vehicleBoon = { op: 'vehicle_condition_apply', who: 'vehicle:1', condition: 'steadied', duration: 'scene', detail: 'An evasive course.' };
  const steadiedVehicle = evaluate([vehicleBoon], undefined, ability);
  assert.equal(steadiedVehicle.state.vehicles['vehicle:1'].conditions.steadied.vehicle, 'vehicle:1');
  reject([vehicleBoon], 'NO_OP', steadiedVehicle.state, ability);
  reject([{ ...vehicleBoon, condition: 'inspired' }], 'SHAPE', undefined, ability);
  reject([{ ...boon, who: 'vehicle:1' }], 'REFERENCE', undefined, ability);
  reject([{ ...harm, who: 'vehicle:1' }], 'REFERENCE');
  state = effectsTestState(); state.vehicles['vehicle:1'].hull = 1;
  const zeroHull = evaluate([vehicleHarm], state);
  assert.equal(zeroHull.state.vehicles['vehicle:1'].hull, 0);
  assert.equal(zeroHull.state.vehicles['vehicle:1'].status, 'active', 'Zero hull cannot imply undeclared destruction or passenger harm.');
  reject([vehicleHarm], 'NO_OP', zeroHull.state);
  const revive = { op: 'revive', who: 'character:2', health: 1, maximumElapsedTurns: 2, condition: 'winded', duration: 'scene' };
  state = effectsTestState(); Object.assign(state.actors['character:2'], { health: 0, status: 'dead', deathTurn: 3, intactBody: true, willingReturn: true });
  const revived = evaluate([revive], state, ability);
  assert.equal(revived.state.actors['character:2'].health, 1);
  assert.equal(revived.state.actors['character:2'].status, 'active');
  assert.equal(revived.state.actors['character:2'].conditions.winded.duration, 'scene');
  state.actors['character:2'].conditions.winded = condition('character:2', 'winded', 'persistent');
  assert.equal(evaluate([revive], state, ability).state.actors['character:2'].conditions.winded.duration, 'persistent', 'An existing winded condition cannot prevent actual revival.');
  reject([revive], 'PRECONDITION', state, { ...ability, turn: 6 });
  state.actors['character:2'].willingReturn = false;
  reject([revive], 'PRECONDITION', state, ability);
  const reveal = { op: 'reveal', subject: 'npc:2', scope: 'combat_trait', maximum: 1 };
  const discovery = evaluate([reveal], undefined, ability);
  assert.equal(discovery.state.facts[0].fact, 'The recorded attack favors reach.');
  assert.equal(discovery.state.actors['npc:2'].knowledge[0].discovered, true);
  reject([reveal], 'NO_OP', discovery.state, ability);
  assert.equal(evaluate([{ ...reveal, subject: 'area:2:d', scope: 'area_features', maximum: 2 }], undefined, ability).state.facts.length, 2);
  const blink = { op: 'teleport', who: 'character:1', area: 'b', maximumAreas: 1, mode: 'blink' };
  assert.equal(evaluate([blink], undefined, ability).state.actors['character:1'].area, 'b');
  state = effectsTestState(); state.areas['area:1:b'].teleportWard = true;
  reject([blink], 'PRECONDITION', state, ability);
  reject([{ ...blink, area: 'area:2:d' }], 'REFERENCE', undefined, ability);
  const circle = { ...blink, who: ['character:1', 'character:2'], area: 'area:2:d', mode: 'circle' };
  reject([circle], 'PRECONDITION', undefined, ability);
  const transited = evaluate([circle], undefined, { ...ability, consentingActors: ['character:2'] });
  assert.equal(transited.state.actors['character:2'].locationId, 2);
  assert.equal(transited.state.actors['npc:3'].locationId, 1, 'Unselected allies must never be silently teleported.');
  const traverse = { op: 'traverse', who: 'character:1', area: 'b', mode: 'grapple', maximumDistance: 1 };
  assert.equal(evaluate([traverse], undefined, ability).state.actors['character:1'].area, 'b');
  state = effectsTestState(); state.areas['area:1:b'].anchor = false;
  reject([traverse], 'PRECONDITION', state, ability);
  assert.equal(evaluate([{ ...traverse, mode: 'flight' }], state, ability).state.actors['character:1'].area, 'b');

  const annotation = { consumer: 'annotation', band: 'crit_success', stakesLicense: 'significant' };
  assert.equal(evaluate([harm], undefined, annotation).cost, 2);
  reject([{ ...harm, who: 'character:1' }], 'VALENCE', undefined, annotation);
  reject([harm], 'VALENCE', undefined, { ...annotation, band: 'marginal_success' });
  reject([harm, boon], 'BUDGET', undefined, annotation);
  reject([step], 'VALENCE', undefined, annotation);
  reject([harm], 'ALLEGIANCE', undefined, { ...annotation, affirmedOpposed: [] });
  reject([blink], 'AUTHORIZATION', undefined, annotation);
  assert.equal(evaluate([], undefined, { ...annotation, stakesLicense: 'flavor_only' }).cost, 0);
  reject([boon], 'BUDGET', undefined, { ...annotation, stakesLicense: 'flavor_only' });
  reject([boon], 'SHAPE', undefined, { ...annotation, band: 'clean_success' });
  assert.equal(evaluate([{ ...boon, who: 'npc:3' }], undefined, annotation).effects[0].effectiveValence, 'beneficial', 'Recorded allied NPC frame is explicit runtime state.');
  const refuse = getAbilityDefinition('ability.berserker.endurance.refuse-defeat');
  assert.ok(refuse);
  state = effectsTestState();
  Object.assign(state.actors['character:2'], {
    health: 1,
    abilities: [{ id: 'owned-refusal', definition_id: refuse.id, definition_version: refuse.version }],
    classState: { recoveryUses: {} }
  });
  const incoming = { op: 'harm', who: 'character:2', grade: 'wound' };
  const floor = { effectIndex: 0, who: 'character:2', minimum: 1, sourceAbilityId: 'owned-refusal' };
  const prevented = evaluate([incoming], state, { harmFloors: [floor] });
  assert.equal(prevented.state.actors['character:2'].health, 1);
  assert.equal(prevented.state.actors['character:2'].classState.recoveryUses[refuse.id], 1);
  assert.equal(prevented.effects[0].pricingPrestate.appliedAmount, 0);
  assert.equal(prevented.effects[0].pricingPrestate.floor.definitionId, refuse.id);
  assert.equal(prevented.state.actors['character:2'].conditions.winded.duration, 'scene');
  reject([incoming], 'PRECONDITION', prevented.state, { harmFloors: [floor] });
  reject([incoming, { op: 'invented' }], 'MEMBERSHIP', state, { harmFloors: [floor] });
  assert.equal(state.actors['character:2'].classState.recoveryUses[refuse.id], undefined, 'Later failure rolls back floor consumption too.');
  reject([incoming], 'SHAPE', state, { harmFloors: [{ ...floor, minimum: 9 }] });
  reject([incoming], 'AUTHORIZATION', state, { harmFloors: [{ ...floor, sourceAbilityId: 'forged' }] });
  reject([incoming], 'PRECONDITION', state, { harmFloors: [{ ...floor, who: 'character:1' }] });
  state.actors['character:2'].health = 30;
  reject([incoming], 'PRECONDITION', state, { harmFloors: [floor] });
  assert.equal(state.actors['character:2'].classState.recoveryUses[refuse.id], undefined, 'Harmless input cannot spend a floor.');
  state.actors['character:2'].health = 1;
  state.actors['character:2'].abilities[0].definition_id = 'ability.invented';
  reject([incoming], 'AUTHORIZATION', state, { harmFloors: [floor] });
  state.actors['character:2'].abilities[0].definition_id = refuse.id;
  state.actors['character:2'].conditions.winded = condition('character:2', 'winded', 'persistent');
  assert.equal(evaluate([incoming], state, { harmFloors: [floor] }).state.actors['character:2'].conditions.winded.duration, 'persistent', 'Existing winded cannot invalidate actual defeat prevention.');
  reject([{ op: 'value_reduce', invented: 'ignored' }], 'GATED');
  reject([{ op: 'invented' }], 'MEMBERSHIP');
  reject([{ ...harm, amount: 100 }], 'SHAPE');
  reject([{ ...harm, who: 'Foe' }], 'REFERENCE');
  reject([{ ...harm, who: 'npc:99' }], 'REFERENCE');
  reject([{ ...harm, who: 'npc:2' }], 'ALLEGIANCE', undefined, { affirmedOpposed: [] });
  reject([harm, harm], 'CONFLICT');
  reject([hinder, { op: 'condition_clear', who: 'npc:2', condition: 'hindered' }], 'CONFLICT');
  reject([{ op: 'item_lose', item: 'item:1' }, { op: 'item_drop', item: 'item:1', area: 'b' }], 'REFERENCE');
  state = effectsTestState(); state.actors['npc:2'].locationId = 2;
  reject([harm], 'REFERENCE', state, { affirmedOpposed: [] });
  state = effectsTestState(); state.areas.duplicate = { ...state.areas['area:1:b'] };
  reject([step], 'REFERENCE', state);
  state = effectsTestState(); delete state.effectCatalogVersion;
  reject([harm], 'VERSION', state);
  assert.deepEqual([...executed].sort(), [...SUPPORTED_EFFECT_OPERATIONS], 'Every advertised operation needs an executable positive test.');
  assert.deepEqual(REQUIRED_EFFECT_OPERATIONS.filter(op => !SUPPORTED_EFFECT_OPERATIONS.includes(op)), [], 'The full authored catalog must have real operation support.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runRulesEffectsTests();
  console.log('Rules effects tests passed.');
}
