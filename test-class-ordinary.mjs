import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { CATALOG_VERSION, CATALOG_OPTION_SET } from './class-catalog.js';
import { createClassSheet, createRulesWorld } from './class-state.js';
import { buildClassScenario } from './class-scenario.js';
import { prepareOrdinaryAction, finalizeOrdinaryAction, prepareNpcConsequence, finalizeNpcConsequence, buildOrdinaryCheckContext } from './class-ordinary.js';

function fixture(familyId = 'armsmaster', branchId = 'discipline') {
  let id = 0;
  const selection = { catalogVersion: CATALOG_VERSION, optionSet: CATALOG_OPTION_SET, familyId, branchId, modules: [], capabilities: { rider: false, alliedActors: false } };
  const hero = { id: 1, ...createClassSheet(selection, { name: 'Hero', idFactory: () => `hero-${++id}` }) };
  const ally = { id: 2, ...createClassSheet({ ...selection, familyId: 'armsmaster', branchId: 'discipline' }, { name: 'Mira', idFactory: () => `ally-${++id}` }) };
  const location = { id: 4, layout: { areas: [{ id: 'gate', name: 'Gate' }, { id: 'yard', name: 'Yard' }, { id: 'tower', name: 'Tower' }], exits: [{ from: 'gate', to: 'yard' }, { from: 'yard', to: 'tower' }], features: [] } };
  const world = createRulesWorld({ location, characters: [hero, ally], npcs: [{ id: 3, name: 'Guard', area: 'gate' }, { id: 4, name: 'Archer', area: 'yard' }, { id: 5, name: 'Medic', area: 'gate' }] });
  const frame = { schemaVersion: 1,
    areas: ['gate', 'yard', 'tower'].map(area => ({ area, terrain: 'dry_ground', traits: ['visible', 'safe', 'visited'], surfaces: ['ground'] })),
    actors: [{ actor: 'hero', area: 'gate', allegiance: 'party', profile: null, conditions: [] },
      { actor: 'ally', area: 'gate', allegiance: 'party', profile: null, conditions: [] },
      { actor: 'guard', area: 'gate', allegiance: 'opposition', profile: 'combatant', conditions: [] },
      { actor: 'archer', area: 'yard', allegiance: 'opposition', profile: 'ranged', conditions: [] },
      { actor: 'medic', area: 'gate', allegiance: 'party', profile: 'support', conditions: [] }],
    items: [{ key: 'saber', name: 'Saber', description: 'A plain saber.', kind: 'melee_weapon', holder: { kind: 'actor', key: 'guard' }, wielded: true, condition: 'pristine' },
      { key: 'bow', name: 'Bow', description: 'A plain bow.', kind: 'ranged_weapon', holder: { kind: 'actor', key: 'archer' }, wielded: true, condition: 'pristine' },
      { key: 'catalyst', name: 'Revival catalyst', description: 'A ritual material.', kind: 'revival_catalyst', holder: { kind: 'actor', key: 'hero' }, wielded: false, condition: 'pristine' },
      { key: 'loose', name: 'Loose token', description: 'A plain token.', kind: 'mundane', holder: { kind: 'area', key: 'gate' }, wielded: false, condition: 'pristine' }],
    objects: [{ key: 'lock', name: 'Ordinary lock', area: 'gate', kind: 'lock', security: 'ordinary', opposed: false, locked: true },
      { key: 'lever', name: 'Lever', area: 'gate', kind: 'mechanism', security: 'ordinary', opposed: false, locked: false },
      { key: 'protected', name: 'Protected lock', area: 'gate', kind: 'lock', security: 'protected', opposed: false, locked: true }],
    features: [{ key: 'cover', name: 'Crates', area: 'yard', kind: 'cover', duration: 'scene', worksAgainst: 'party', origin: 'mundane' }],
    discoveries: [{ key: 'trait', subject: { kind: 'actor', key: 'guard' }, scope: 'combat_trait', fact: 'The guard has no ranged attack.' },
      { key: 'route', subject: { kind: 'area', key: 'yard' }, scope: 'route', fact: 'The yard connects to the tower.' },
      { key: 'motive', subject: { kind: 'actor', key: 'guard' }, scope: 'motive', fact: 'The guard hopes to leave safely.' },
      { key: 'mechanism', subject: { kind: 'object', key: 'lever' }, scope: 'area_features', fact: 'The lever opens the yard hatch.' }],
    encounter: { active: true, opposition: ['guard', 'archer'] } };
  return buildClassScenario({ world, location, frame, actorBindings: { hero: 'character:1', ally: 'character:2', guard: 'npc:3', archer: 'npc:4', medic: 'npc:5' } }).world;
}

const context = { turn: 2, operationId: 'ordinary-test', round: 1 };
const prepare = (state, action, extra = {}) => prepareOrdinaryAction({ state, actor: 'character:1', action, context: { ...context, ...extra } });
const finish = (state, action, outcome = 'success', extra = {}) => finalizeOrdinaryAction({ state, plan: prepare(state, action, extra), outcome });
const npc = (state, ref, actionId, target, extra = {}) => prepareNpcConsequence({ state, actingActor: 'character:1', npc: ref, actionId, target, context: { ...context, ...extra } });
const condition = (actor, token, type = 'hindrance') => ({ actor, condition: token, class: type, detail: 'Recorded condition.', duration: 'scene', source: 'test', appliedTurn: 1 });

export function runClassOrdinaryTests() {
  console.log(' - Running ordinary action and asymmetric NPC kit tests...');
  let state = fixture();
  const original = structuredClone(state);
  const weapon = Object.keys(state.items).find(ref => state.items[ref].holder === 'character:1' && state.items[ref].weaponKind === 'melee_weapon');
  const attack = { kind: 'attack', target: 'npc:3', method: 'melee', item: weapon };
  const plan = prepare(state, attack);
  assert.equal(plan.check.skill, 'melee');
  assert.equal(plan.check.skillBonus, state.actors['character:1'].skills.melee);
  assert.deepEqual(plan.onSuccess, [{ op: 'harm', who: 'npc:3', grade: 'wound' }]);
  assert.equal(plan.consumeMain, true);
  const hit = finalizeOrdinaryAction({ state, plan, outcome: 'success' });
  assert.equal(hit.state.actors['npc:3'].health, state.actors['npc:3'].health - 5);
  assert.equal(hit.state.actors['character:1'].classState.lastMainOperationId, context.operationId);
  assert.equal(finalizeOrdinaryAction({ state, plan, outcome: 'failure' }).state.actors['npc:3'].health, state.actors['npc:3'].health);
  assert.deepEqual(state, original, 'Preparation and resolution cannot mutate source state.');
  assert.equal(finish(state, { kind: 'attack', target: 'npc:3', method: 'unarmed' }).state.actors['npc:3'].health, state.actors['npc:3'].health - 2);
  for (const action of [{ ...attack, quantity: 99 }, { ...attack, grade: 'grievous' }, { ...attack, method: 'magic' }, { ...attack, target: 'character:2' }, { ...attack, target: 'npc:4' }, { kind: 'teleport', area: 'yard' }, { kind: 'revive', target: 'character:2' }]) assert.throws(() => prepare(state, action));
  assert.throws(() => prepareOrdinaryAction({ state, actor: 'character:2', action: attack, context }), /does not own the current turn/);
  assert.throws(() => prepareOrdinaryAction({ state, actor: 'npc:3', action: attack, context }), /player character/);
  const stale = structuredClone(state); stale.actors['npc:3'].health -= 1;
  assert.throws(() => finalizeOrdinaryAction({ state: stale, plan, outcome: 'success' }), /another state/);
  assert.throws(() => finalizeOrdinaryAction({ state, plan: { ...plan, onSuccess: [{ op: 'harm', who: 'npc:3', grade: 'grievous' }] }, outcome: 'success' }), /not canonical/);

  const move = prepare(state, { kind: 'move', area: 'yard' });
  assert.equal(move.check.skill, 'move');
  assert.equal(finalizeOrdinaryAction({ state, plan: move, outcome: 'failure' }).state.actors['character:1'].area, 'gate');
  const moved = finalizeOrdinaryAction({ state, plan: move, outcome: 'success' });
  assert.equal(moved.state.actors['character:1'].area, 'yard');
  assert.equal(moved.state.actors['character:2'].area, 'gate', 'Positioning does not relocate an unselected ally.');
  assert.throws(() => prepare(state, { kind: 'move', area: 'tower' }), /range/);
  state.actors['character:1'].conditions.pinned = condition('character:1', 'pinned');
  assert.throws(() => prepare(state, { kind: 'move', area: 'yard' }), /pinned/);
  state = fixture();
  state.actors['npc:3'].area = 'tower';
  assert.equal(prepare(state, { kind: 'move', area: 'yard' }).check, null);
  assert.throws(() => finalizeOrdinaryAction({ state, plan: prepare(state, { kind: 'move', area: 'yard' }), outcome: 'failure' }), /fabricated failed check/);
  state = fixture();
  assert.throws(() => prepare(state, { kind: 'aid', target: 'character:2' }), /consent/);
  const aided = finish(state, { kind: 'aid', target: 'character:2' }, 'success', { consentingActors: ['character:2'] });
  assert.equal(aided.state.actors['character:2'].conditions.inspired.class, 'boon');
  assert.throws(() => prepare(aided.state, { kind: 'aid', target: 'character:2' }, { consentingActors: ['character:2'] }), /already inspired/);

  const loose = 'item:scene:4:loose';
  const picked = finish(state, { kind: 'pickup', item: loose });
  assert.equal(picked.state.items[loose].holder, 'character:1');
  assert.equal(finish(picked.state, { kind: 'drop', item: loose }).state.items[loose].holder, 'area:4:gate');
  const recoveryWeapon = Object.keys(state.items).find(ref => state.items[ref].holder === 'character:1' && state.items[ref].weaponKind === 'melee_weapon');
  const recoveryAttack = { ...attack, item: recoveryWeapon };
  const droppedWeapon = finish(state, { kind: 'drop', item: recoveryWeapon }).state;
  const recoveredWeapon = finish(droppedWeapon, { kind: 'pickup', item: recoveryWeapon }).state;
  assert.equal(recoveredWeapon.items[recoveryWeapon].wielded, false);
  assert.throws(() => prepare(recoveredWeapon, recoveryAttack), /trained, wielded weapon/);
  const readyPlan = prepare(recoveredWeapon, { kind: 'wield', item: recoveryWeapon });
  assert.equal(readyPlan.check, null);
  assert.equal(readyPlan.consumeMain, true);
  assert.deepEqual(readyPlan.onSuccess, [{ op: 'item_ready', owner: 'character:1', item: recoveryWeapon }]);
  const recoveredAndReady = finalizeOrdinaryAction({ state: recoveredWeapon, plan: readyPlan, outcome: 'success' });
  assert.equal(recoveredAndReady.state.items[recoveryWeapon].wielded, true);
  assert.ok(prepare(recoveredAndReady.state, recoveryAttack));
  assert.throws(() => prepare(recoveredAndReady.state, { kind: 'wield', item: recoveryWeapon }), /already wielded/);
  assert.throws(() => prepare(state, { kind: 'wield', item: 'item:scene:4:saber' }), /must hold/);
  assert.throws(() => prepare(picked.state, { kind: 'wield', item: loose }));
  const looted = fixture('arcanist', 'formula');
  Object.assign(looted.items['item:scene:4:saber'], { holder: 'character:1', wielded: false, equipped: false, weaponCategory: 'martial' });
  assert.throws(() => prepare(looted, { kind: 'wield', item: 'item:scene:4:saber' }), /recorded class training/);
  looted.items['item:scene:4:saber'].weaponCategory = 'simple';
  const usableLoot = finish(looted, { kind: 'wield', item: 'item:scene:4:saber' }).state;
  assert.ok(prepare(usableLoot, { kind: 'attack', method: 'melee', target: 'npc:3', item: 'item:scene:4:saber' }));
  assert.throws(() => prepare(state, { kind: 'drop', item: 'item:scene:4:saber' }), /must hold/);
  assert.throws(() => prepare(state, { kind: 'consume', item: 'item:scene:4:catalyst' }), /no ordinary consumption/);
  state.items[loose] = { ...state.items[loose], holder: 'character:1', kind: 'consumable', consume: { id: 'mundane-supply', version: 1 } };
  const consumed = finish(state, { kind: 'consume', item: loose });
  assert.equal(consumed.state.items[loose].lost, true);
  assert.equal(consumed.state.actors['character:1'].health, state.actors['character:1'].health, 'A mundane supply grants no unrecorded healing.');

  state = fixture('maker', 'kit');
  const lock = { kind: 'unlock', object: 'object:scene:4:lock' };
  assert.equal(prepare(state, lock).check.skill, 'craft');
  assert.equal(finish(state, lock).state.objects[lock.object].locked, false);
  assert.equal(finish(state, { kind: 'disable', object: 'object:scene:4:lever' }).state.objects['object:scene:4:lever'].disabled.duration, 'scene');
  assert.throws(() => prepare(state, { kind: 'unlock', object: 'object:scene:4:protected' }), /exceeds ordinary/);
  assert.throws(() => prepare(fixture(), lock), /trained Craft/);
  for (const action of [{ kind: 'skill', skill: 'notice', subject: 'npc:3', discoveryId: 'scene:4:trait' },
    { kind: 'skill', skill: 'lore', subject: 'npc:3', discoveryId: 'scene:4:trait' },
    { kind: 'skill', skill: 'influence', subject: 'npc:3', discoveryId: 'scene:4:motive' },
    { kind: 'skill', skill: 'survival', subject: 'area:4:yard', discoveryId: 'scene:4:route' },
    { kind: 'skill', skill: 'craft', subject: 'object:scene:4:lever', discoveryId: 'scene:4:mechanism' }]) {
    const result = finish(state, action);
    assert.equal(result.state.facts.length, 1);
    assert.throws(() => prepare(result.state, action), /no undiscovered/);
    assert.equal(finish(state, action, 'failure').state.facts.length, 0);
  }
  assert.throws(() => prepare(state, { kind: 'skill', skill: 'influence', subject: 'npc:3', discoveryId: 'scene:4:trait' }), /no undiscovered/);

  state = fixture();
  state.encounter = { active: false, participants: [] };
  state.areas['area:4:gate'].exits.push('area:8:road');
  state.areas['area:8:road'] = { ...structuredClone(state.areas['area:4:gate']), id: 'road', locationId: 8, adjacent: [], exits: [] };
  const travel = { kind: 'travel', locationId: 8, area: 'road' };
  const traveled = finish(state, travel);
  assert.equal(traveled.state.currentLocationId, 8);
  assert.equal(traveled.state.actors['character:2'].locationId, 8);
  assert.equal(traveled.state.actors['npc:3'].locationId, 4);
  assert.throws(() => prepare(fixture(), travel));

  state = fixture('armsmaster', 'pursuit');
  const bow = Object.keys(state.items).find(ref => state.items[ref].holder === 'character:1' && state.items[ref].weaponKind === 'ranged_weapon');
  const shot = { kind: 'attack', method: 'ranged', target: 'npc:4', item: bow };
  assert.equal(prepare(state, shot).check.deltaSources[0].source.kind, 'mundane_cover');
  state.features['feature:scene:4:cover'].origin = 'magical';
  assert.equal(prepare(state, shot).check.deltaSources[0].source.kind, 'magical_ward');
  state.features['feature:scene:4:cover'].origin = 'unknown';
  assert.equal(prepare(state, shot).check.deltaSources[0].source.kind, 'recorded_obstacle');
  assert.equal(buildOrdinaryCheckContext({ state, actor: 'character:1', skill: 'lore', target: 'npc:4', attack: true }).deltaSources[0].source.kind, 'recorded_obstacle');
  assert.equal(buildOrdinaryCheckContext({ state, actor: 'character:1', skill: 'lore', target: 'npc:4' }).deltaSources.length, 0, 'A non-attack Lore check cannot acquire an invented aiming penalty.');
  assert.throws(() => buildOrdinaryCheckContext({ state, actor: 'character:1', skill: 'invented' }), /known authored skill/);

  state = fixture();
  const consequence = npc(state, 'npc:3', 'strike', 'character:2');
  assert.equal(consequence.check, null, 'NPCs never roll checks or add PC inputs.');
  const injuredAlly = finalizeNpcConsequence({ state, plan: consequence });
  assert.equal(injuredAlly.state.actors['character:2'].health, state.actors['character:2'].health - 5);
  assert.equal(injuredAlly.state.actors['character:1'].health, state.actors['character:1'].health, 'Being present does not create automatic interception.');
  assert.throws(() => npc(injuredAlly.state, 'npc:3', 'brawl', 'character:1'), /already spent/);
  injuredAlly.state.turnOrder.round = 2;
  assert.ok(npc(injuredAlly.state, 'npc:3', 'brawl', 'character:1', { round: 2 }));
  assert.throws(() => npc(state, 'npc:3', 'invented', 'character:1'), /not in this NPC kit/);
  assert.throws(() => npc(state, 'npc:3', 'shoot', 'character:1'), /not in this NPC kit/);
  assert.equal(finalizeNpcConsequence({ state, plan: npc(state, 'npc:4', 'shoot', 'character:1') }).state.actors['character:1'].health, state.actors['character:1'].health - 5);
  assert.equal(finalizeNpcConsequence({ state, plan: npc(state, 'npc:3', 'guard') }).state.actors['npc:3'].conditions.steadied.class, 'boon');
  assert.equal(finalizeNpcConsequence({ state, plan: npc(state, 'npc:5', 'rally', 'character:1') }).state.actors['character:1'].conditions.inspired.class, 'boon');
  assert.equal(finalizeNpcConsequence({ state, plan: npc(state, 'npc:3', 'withdraw', 'yard') }).state.actors['npc:3'].area, 'yard');
  const forged = structuredClone(state); forged.actors['npc:3'].npcKit.actions[0].harm = 'grievous';
  assert.throws(() => npc(forged, 'npc:3', 'strike', 'character:1'), /intact authored/);
  const badBudget = structuredClone(state); badBudget.actors['npc:3'].npcState = { lastMainRound: 20, lastMainOperationId: 'future', lastActionId: 'strike' };
  assert.throws(() => npc(badBudget, 'npc:3', 'strike', 'character:1'), /budget is inconsistent/);
  const unarmed = structuredClone(state); unarmed.items['item:scene:4:saber'].lost = true;
  assert.throws(() => npc(unarmed, 'npc:3', 'strike', 'character:1'), /requires its recorded usable weapon/);
  assert.ok(npc(unarmed, 'npc:3', 'brawl', 'character:1'));
  assert.throws(() => finalizeNpcConsequence({ state, plan: { ...consequence, effects: [{ op: 'harm', who: 'character:2', grade: 'grievous' }] } }), /not canonical/);
  state.actors['character:2'].classState.brace = { remaining: 1, area: 'gate', armedTurn: 1 };
  const braced = finalizeNpcConsequence({ state, plan: npc(state, 'npc:3', 'strike', 'character:2') });
  assert.equal(braced.state.actors['character:2'].health, state.actors['character:2'].health - 2, 'Incoming NPC harm uses the same authored class prevention hook.');
  assert.equal(braced.effects[0].grade, 'graze');
  assert.equal(state.actors['character:2'].classState.brace.remaining, 1, 'Preview/finalization cannot consume source-state protection.');
  state.actors['character:1'].classState.brace = { remaining: 1, area: 'gate', armedTurn: 1 };
  assert.equal(finish(state, { kind: 'attack', target: 'npc:3', method: 'unarmed' }).state.actors['character:1'].classState.brace, null, 'An ordinary Main ends its own commitment.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runClassOrdinaryTests();
  console.log('Ordinary action tests passed.');
}
