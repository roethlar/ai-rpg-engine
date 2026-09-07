import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { ABILITY_DEFINITIONS, CLASS_FAMILIES, REQUIRED_MECHANIC_HANDLERS, getAbilityDefinition } from './class-catalog.js';
import { prepareClassAction, finalizeClassAction, prepareClassEvent, finalizeClassEvent, finalizeIncomingClassEffects, SUPPORTED_CLASS_HANDLERS, SUPPORTED_CLASS_MODES } from './class-actions.js';
import { advanceClassCharacter, recoverClassCharacter, configureClassPreparation, returnToBaseProfile, abandonClassRitual, clearClassSceneState } from './class-progression.js';
import { effectsTestState } from './test-rules-effects.mjs';
import { createClassSheet, createRulesWorld, addClassActor } from './class-state.js';

const ACTOR = 'character:1';
const ALLY = 'character:2';
const FOE = 'npc:2';
const COMPANION = 'npc:3';
const condition = (actor, token, duration = 'scene') => ({ actor, condition: token, class: ['steadied', 'inspired', 'concealed'].includes(token) ? 'boon' : 'hindrance', duration, detail: 'Recorded fixture condition.', source: 'fixture-condition', appliedTurn: 1 });
const definitionNamed = name => ABILITY_DEFINITIONS.find(definition => definition.name === name);
const context = extra => ({ operationId: 'class-action-10', turn: 10, actor: ACTOR, sceneId: 'scene-1', consentingActors: [ALLY], affirmedOpposed: [FOE], ...extra });

export function classActionTestState(familyId = 'armsmaster', branchId = `${familyId}.discipline`, level = 10) {
  const fixture = effectsTestState();
  let sequence = 0;
  const selection = { familyId, branchId, modules: ['rider'], capabilities: { alliedActors: true, rider: true } };
  const sheet = createClassSheet(selection, { name: 'Hero', level, idFactory: () => `owned-${familyId}-${++sequence}` });
  const state = createRulesWorld({ location: { id: 1, layout: { areas: [{ id: 'a', name: 'Start' }, { id: 'b', name: 'Passage' }, { id: 'c', name: 'Exit' }], exits: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }] } }, npcs: [{ id: 2, name: 'Foe', party: false, area: 'a' }, ...(familyId === 'bonded' ? [] : [{ id: 3, name: 'Ally NPC', party: true, area: 'a' }])] });
  addClassActor(state, { id: 1, ...sheet }, { companionActorRef: familyId === 'bonded' ? COMPANION : null });
  addClassActor(state, { id: 2, ...createClassSheet({ familyId: 'armsmaster', branchId: 'armsmaster.discipline', modules: ['rider'], capabilities: { alliedActors: true, rider: true } }, { name: 'Ally', level }) });
  Object.assign(state.items, fixture.items);
  state.objects = fixture.objects;
  state.areas['area:2:d'] = fixture.areas['area:2:d'];
  const actor = state.actors[ACTOR];
  actor.health = 12;
  state.actors[ALLY].health = 20;
  state.actors[ALLY].willingTravel = true;
  state.actors[COMPANION].willingTravel = true;
  Object.assign(state.actors[FOE], { health: 20, maxHealth: 30 });
  actor.inventory = [];
  state.areas['area:1:a'].adjacent = ['b'];
  state.areas['area:1:b'].adjacent = ['a', 'c'];
  state.areas['area:1:c'] = { ...state.areas['area:1:b'], id: 'c', adjacent: ['b'] };
  for (const area of Object.values(state.areas)) Object.assign(area, { surfaces: ['wall'], supported: true, dry_ground: true, safeRecovery: true, immediateThreat: false, anchor: true });
  for (const [ref, value] of Object.entries(state.actors)) {
    value.visible = true;
    value.knowledge = ['combat_trait', 'defense_trait', 'leverage', 'motive', 'route', 'profile_senses', 'companion_scout', 'quarry_route'].map(scope => ({ id: `${scope}-fact`, scope, fact: `Recorded ${scope} for ${ref}.`, discovered: false }));
  }
  if (actor.classState.companion) {
    const cs = actor.classState.companion;
    cs.actorRef = COMPANION;
    Object.assign(state.actors[COMPANION], { health: 12, maxHealth: cs.maxHealth, area: 'a', profile: cs.profile, status: 'active' });
  }
  if (actor.classState.vehicle) {
    const cs = actor.classState.vehicle;
    Object.assign(state.vehicles[cs.vehicleRef], { hull: 12, maxHull: cs.maxHull, conditions: {}, profile: cs.profile });
  }
  return state;
}

function requestNamed(name, options = {}) {
  const definition = definitionNamed(name);
  const [family] = definition.branchId.split('.');
  const state = options.state || classActionTestState(family, definition.branchId, options.level || 10);
  const owned = state.actors[ACTOR].abilities.find(ability => ability.definition_id === definition.id);
  return { state, actor: ACTOR, ability: owned?.id || 'missing', bindings: options.bindings || { targets: [FOE] }, context: context(options.context), definition };
}

function runAction(request, outcome = 'success') {
  const before = structuredClone(request.state);
  const plan = prepareClassAction(request);
  assert.deepEqual(request.state, before, 'Preparation must not mutate state.');
  const result = finalizeClassAction({ state: request.state, plan, outcome });
  assert.deepEqual(request.state, before, 'Finalization returns a new state.');
  return { plan, ...result };
}

function matrixRequest(definition) {
  const request = requestNamed(definition.name);
  const { state, bindings, context: ctx } = request;
  const source = state.actors[ACTOR];
  const cs = source.classState;
  const mechanic = definition.mechanic;
  const kind = definition.targeting.kind;
  bindings.ally = ALLY;
  bindings.item = 'item:1'; bindings.object = 'object:1'; bindings.catalyst = 'item:2';
  bindings.area = 'b';
  if (['self', 'self_or_enemy'].includes(kind)) bindings.targets = [ACTOR];
  if (kind === 'ally') bindings.targets = [ALLY];
  if (kind === 'object') bindings.targets = ['object:1'];
  if (['area', 'known_area', 'willing_allies_and_area'].includes(kind)) bindings.targets = [];
  if (kind === 'area_all_actors') { bindings.targets = []; bindings.area = 'a'; }
  if (kind === 'known_area') bindings.area = 'area:2:d';
  if (kind === 'willing_allies_and_area') { bindings.area = 'area:2:d'; bindings.travelers = [ACTOR, ALLY, COMPANION]; }
  if (kind === 'fallen_ally') {
    bindings.targets = [ALLY];
    Object.assign(state.actors[ALLY], { health: 0, status: 'dead', intactBody: true, willingReturn: true, deathTurn: 8 });
  }
  if (kind === 'enemy_and_area') bindings.area = 'a';
  if (kind === 'enemy_and_ally') bindings.targets = [FOE];
  for (const requirement of definition.requirements) {
    if (['target_condition', 'self_condition'].includes(requirement.kind)) {
      bindings.condition = requirement.tokens[0];
      const ref = requirement.kind === 'self_condition' ? ACTOR : bindings.targets[0];
      state.actors[ref].conditions[bindings.condition] = condition(ref, bindings.condition, requirement.duration || 'scene');
    }
  }
  if (mechanic.kind === 'exposure') { cs.exposure = 2; cs.reprisal = 1; }
  if (definition.requirements.some(requirement => requirement.kind === 'exposure_minimum')) cs.exposure = 2;
  if (mechanic.kind === 'opening') cs.opening = { target: bindings.targets[0], sourceAbilityId: 'fixture' };
  if (mechanic.clearTokens) { bindings.condition = mechanic.clearTokens[0]; source.conditions[bindings.condition] = condition(ACTOR, bindings.condition); }
  if (mechanic.kind === 'quarry') cs.quarry = { target: FOE, trail: ['b'], lastKnownArea: 'b' };
  if (definition.requirements.some(requirement => requirement.kind === 'target_is_quarry')) cs.quarry = { target: FOE, trail: [] };
  if (mechanic.kind === 'sequence') cs.stance = mechanic.bonusFrom || 'ready';
  if (mechanic.kind === 'declaration') cs.declaration = { binding: mechanic.binding, target: mechanic.binding === 'foe' ? FOE : ALLY, area: 'a' };
  if (mechanic.kind === 'profile') {
    if (mechanic.bonusProfile) cs.profile = mechanic.bonusProfile;
    if (mechanic.mode === 'sense') cs.profile = 'climber';
    if (mechanic.profile === '$profile') bindings.profile = cs.learnedProfiles.find(profile => profile !== cs.profile);
  }
  if (mechanic.kind === 'device') {
    cs.prepared = source.abilities.filter(ability => ability.invocation).map(ability => ability.definition_id);
    if (mechanic.mode === 'deploy_or_fire') ctx.mode = 'deploy';
    if (mechanic.mode === 'relocate') {
      cs.installations = [{ id: 'installation:fixture', kind: 'bulwark', slots: 1, area: 'a', locationId: 1, status: 'active', health: 2, maxHealth: 8, source: 'old', features: [] }];
      bindings.targets = ['installation:fixture']; bindings.installation = 'installation:fixture';
    }
  }
  if (mechanic.kind === 'companion') {
    if (mechanic.mode === 'replace' && cs.companion.profile === mechanic.profile) cs.companion.profile = 'scout';
    if (mechanic.profile === '$profile') bindings.profile = 'scout';
  }
  if (mechanic.kind === 'cue' && kind !== 'enemy_and_ally') bindings.targets = [ALLY];
  if (mechanic.kind === 'vehicle') {
    state.actors[FOE].scale = 'vehicle';
    if (mechanic.mode === 'move_attack' && cs.vehicle.profile === 'cavalier') state.actors[FOE].area = 'b';
  }
  if (mechanic.kind === 'maneuver' && mechanic.mode === 'intervene') {
    bindings.area = 'b'; state.actors[ALLY].area = 'b'; state.actors[FOE].area = 'b';
  }
  const movesSelfAndMelee = definition.check?.skill === 'melee' && definition.onSuccess.some(effect => effect.op === 'reposition' && effect.who === '$self') && definition.onSuccess.some(effect => effect.op === 'harm');
  if (movesSelfAndMelee && mechanic.mode !== 'intervene') state.actors[FOE].area = 'b';
  if (mechanic.mode === 'traverse' && definition.onSuccess.some(effect => effect.op === 'harm')) state.actors[FOE].area = 'b';
  if (mechanic.kind === 'declaration' && mechanic.mode === 'pursue') state.actors[FOE].area = 'b';
  if (mechanic.kind === 'companion' && mechanic.mode === 'advance_attack') state.actors[FOE].area = 'b';
  if (definition.onSuccess.some(effect => effect.op === 'scene_feature_clear')) {
    bindings.feature = 'feature:fixture';
    state.features[bindings.feature] = { id: bindings.feature, location: 1, area: 'area:1:a', kind: 'obstruction', name: 'Breakable barricade', duration: 'scene', works_against: 'party', status: 'active', source: 'fixture', appliedTurn: 1, breakable: true };
  }
  return request;
}

export function runClassActionTests() {
  assert.deepEqual(SUPPORTED_CLASS_HANDLERS, REQUIRED_MECHANIC_HANDLERS);
  const coveredModes = new Set();
  let actions = 0;
  for (const definition of ABILITY_DEFINITIONS.filter(definition => definition.activation !== 'passive')) {
    let request = matrixRequest(definition);
    try {
      let result = runAction(request);
      while (result.phase === 'ritual_progress') {
        request = { ...request, state: result.state, context: { ...request.context, turn: request.context.turn + 1, operationId: `${request.context.operationId}-next` } };
        result = runAction(request);
      }
      assert.equal(result.phase, 'complete');
      if (definition.mechanic.kind !== 'none') coveredModes.add(`${definition.mechanic.kind}:${definition.mechanic.mode || 'work'}`);
      actions += 1;
    } catch (error) {
      error.message = `${definition.name} (${definition.mechanic.kind}/${definition.mechanic.mode}): ${error.message}`;
      throw error;
    }
  }
  for (const [handler, modes] of Object.entries(SUPPORTED_CLASS_MODES)) if (handler !== 'passive') for (const mode of modes) assert.ok(coveredModes.has(`${handler}:${mode}`), `Missing executed class mode ${handler}:${mode}`);

  let request = requestNamed('Magic Missile');
  const before = structuredClone(request.state);
  request.state.items = {};
  assert.equal(runAction(request).state.actors[FOE].health, 15, 'A routine spell works without a weapon or preparation combo.');
  request = requestNamed('Driving Strike', { bindings: { targets: [FOE], area: 'b' } });
  let result = runAction(request);
  assert.equal(result.state.actors[FOE].health, 18);
  assert.equal(result.state.actors[FOE].area, 'b');
  request.state.items = {};
  assert.throws(() => prepareClassAction(request), /weapon/);
  request = requestNamed('Reckless Blow');
  result = runAction(request, 'failure');
  assert.equal(result.state.actors[ACTOR].classState.exposure, 1);
  assert.equal(result.state.actors[FOE].health, 20);
  request = requestNamed('Mending Light', { bindings: { targets: [ALLY] }, context: { overreach: true } });
  result = runAction(request);
  assert.equal(result.state.actors[ALLY].health, 26);
  assert.equal(result.state.actors[ACTOR].classState.strain, 1);
  assert.equal(result.state.actors[ACTOR].classState.sceneUses[request.definition.id], 1);
  request.state.actors[ACTOR].classState.strain = 3;
  assert.throws(() => prepareClassAction(request), /Strain/);
  request.context.overreach = false;
  assert.doesNotThrow(() => prepareClassAction(request));

  request = requestNamed('Fireball', { bindings: { area: 'a' } });
  result = runAction(request);
  assert.equal(result.state.actors[ALLY].health, 15);
  assert.equal(result.state.actors[ACTOR].health, 7);
  request.bindings.targets = [FOE];
  assert.throws(() => prepareClassAction(request), /omit/);
  delete request.bindings.targets;
  for (let id = 10; id < 14; id += 1) request.state.actors[`npc:${id}`] = { ...structuredClone(request.state.actors[FOE]), name: `Other ${id}` };
  assert.throws(() => prepareClassAction(request), /Target count/);

  request = requestNamed('Disarming Cut');
  request.bindings.item = 'item:1';
  const plan = prepareClassAction(request);
  const corrupt = structuredClone(plan); corrupt.afterSuccess.exposure = 999;
  assert.throws(() => finalizeClassAction({ state: request.state, plan: corrupt, outcome: 'success' }), /canonical/);
  const stale = structuredClone(request.state); stale.actors[ACTOR].health -= 1;
  assert.throws(() => finalizeClassAction({ state: stale, plan, outcome: 'success' }), /different state/);
  const failedEffect = structuredClone(request.state); failedEffect.items['item:1'].lost = true;
  assert.throws(() => prepareClassAction({ ...request, state: failedEffect }));
  assert.deepEqual(request.state.actors[ACTOR].classState.sceneUses, {});
  const exhausted = structuredClone(request.state); exhausted.actors[ACTOR].classState.sceneUses[request.definition.id] = 1;
  assert.throws(() => prepareClassAction({ ...request, state: exhausted }), /no uses/);
  assert.throws(() => prepareClassAction({ ...request, ability: 'unowned' }), /not owned/);
  const wrongVersion = structuredClone(request.state); wrongVersion.actors[ACTOR].classBuild.catalogVersion = 'future';
  assert.throws(() => prepareClassAction({ ...request, state: wrongVersion }), /incompatible/);

  request = requestNamed('Refuse Defeat', { bindings: { targets: [ACTOR] } });
  result = runAction(request);
  assert.equal(result.state.actors[ACTOR].classState.recoveryUses[request.definition.id], undefined);
  result.state.actors[ACTOR].health = 2;
  let eventPlan = prepareClassEvent({ state: result.state, event: { type: 'incoming_effects', effects: [{ op: 'harm', who: ACTOR, grade: 'grievous' }] }, context: context({ operationId: 'incoming-hit' }) });
  assert.equal(eventPlan.harmFloors.length, 1);
  result = finalizeIncomingClassEffects({ state: result.state, plan: eventPlan });
  assert.equal(result.state.actors[ACTOR].health, 1);
  assert.equal(result.state.actors[ACTOR].classState.recoveryUses[request.definition.id], 1);
  assert.ok(result.state.actors[ACTOR].conditions.winded);

  let duel = classActionTestState('arcanist', 'arcanist.formula');
  const brace = duel.actors[ALLY].abilities.find(ability => getAbilityDefinition(ability.definition_id).name === 'Brace');
  let defense = prepareClassAction({ state: duel, actor: ALLY, ability: brace.id, bindings: { targets: [ALLY] }, context: context({ actor: ALLY, operationId: 'ally-brace' }) });
  duel = finalizeClassAction({ state: duel, plan: defense, outcome: 'success' }).state;
  result = runAction(requestNamed('Fireball', { state: duel, bindings: { area: 'a' }, context: { operationId: 'fireball-versus-brace' } }));
  assert.equal(result.state.actors[ALLY].health, 18);
  assert.equal(result.effects.find(effect => effect.who === ALLY).grade, 'graze');
  assert.equal(result.state.actors[ALLY].classState.brace, null);
  assert.ok(result.provenance.some(entry => entry.sources.some(source => source.handler === 'maneuver')));

  duel = classActionTestState('arcanist', 'arcanist.formula');
  delete duel.actors[ALLY];
  for (const [ref, item] of Object.entries(duel.items)) if (item.holder === ALLY) delete duel.items[ref];
  duel.turnOrder.order = duel.turnOrder.order.filter(ref => ref !== ALLY);
  addClassActor(duel, { id: 2, ...createClassSheet({ familyId: 'berserker', branchId: 'berserker.endurance', modules: [], capabilities: {} }, { name: 'Enduring ally', level: 10 }) });
  const refuse = duel.actors[ALLY].abilities.find(ability => getAbilityDefinition(ability.definition_id).name === 'Refuse Defeat');
  defense = prepareClassAction({ state: duel, actor: ALLY, ability: refuse.id, bindings: { targets: [ALLY] }, context: context({ actor: ALLY, operationId: 'ally-refusal' }) });
  duel = finalizeClassAction({ state: duel, plan: defense, outcome: 'success' }).state;
  duel.actors[ALLY].health = 2;
  result = runAction(requestNamed('Fireball', { state: duel, bindings: { area: 'a' }, context: { operationId: 'fireball-versus-floor' } }));
  assert.equal(result.state.actors[ALLY].health, 1);
  assert.equal(result.state.actors[ALLY].classState.recoveryUses[refuse.definition_id], 1);
  assert.ok(result.state.actors[ALLY].conditions.winded);
  assert.equal(result.effects.find(effect => effect.who === ALLY).pricingPrestate.health, 2);

  duel = classActionTestState('arcanist', 'arcanist.formula');
  delete duel.actors[ALLY];
  for (const [ref, item] of Object.entries(duel.items)) if (item.holder === ALLY) delete duel.items[ref];
  duel.turnOrder.order = duel.turnOrder.order.filter(ref => ref !== ALLY);
  addClassActor(duel, { id: 2, ...createClassSheet({ familyId: 'oathbound', branchId: 'oathbound.aegis', modules: [], capabilities: {} }, { name: 'Warding ally', level: 10 }) });
  duel.actors[ALLY].health = 20;
  duel.actors[ALLY].classState.declaration = { binding: 'ward', target: ACTOR, area: 'a' };
  const sanctuary = duel.actors[ALLY].abilities.find(ability => getAbilityDefinition(ability.definition_id).name === 'Sanctuary Stand');
  defense = prepareClassAction({ state: duel, actor: ALLY, ability: sanctuary.id, bindings: { targets: [ACTOR] }, context: context({ actor: ALLY, operationId: 'ally-sanctuary', consentingActors: [ACTOR] }) });
  duel = finalizeClassAction({ state: duel, plan: defense, outcome: 'success' }).state;
  const shelteredHealth = duel.actors[ACTOR].health;
  result = runAction(requestNamed('Fireball', { state: duel, bindings: { area: 'a' }, context: { operationId: 'fireball-versus-ward' } }));
  assert.equal(result.state.actors[ACTOR].health, shelteredHealth - 2);
  assert.equal(result.state.actors[ALLY].health, 15, 'The ward does not protect an unrelated target or redirect all area harm.');
  assert.equal(result.state.actors[ALLY].classState.declaration.guard, undefined);
  assert.ok(result.provenance.some(entry => entry.sources.some(source => source.handler === 'declaration')));

  request = requestNamed('Mending Light', { bindings: { targets: [ALLY] } });
  request.state.actors[ALLY].health = request.state.actors[ALLY].maxHealth;
  const unchanged = structuredClone(request.state);
  const noHealing = prepareClassAction(request);
  assert.throws(() => finalizeClassAction({ state: request.state, plan: noHealing, outcome: 'success' }), /changes no health/);
  assert.deepEqual(request.state, unchanged, 'A late effect rejection must not spend the prepared scene use.');

  request = requestNamed('Advance Cue', { bindings: { targets: [ALLY], area: 'b' } });
  result = runAction(request);
  eventPlan = prepareClassEvent({ state: result.state, event: { type: 'action_completed', who: ALLY, success: true, kind: 'attack', checked: true, targets: [FOE] }, context: context({ operationId: 'ally-action' }) });
  result = finalizeClassEvent({ state: result.state, plan: eventPlan });
  assert.equal(result.state.actors[ALLY].area, 'b');
  assert.equal(result.state.actors[ACTOR].classState.cue, null);

  request = requestNamed('Far Sight', { bindings: { area: 'area:2:d' } });
  result = runAction(request);
  assert.equal(result.phase, 'ritual_progress');
  const hp = result.state.actors[ACTOR].health;
  result.state.actors[ACTOR].health -= 2;
  eventPlan = prepareClassEvent({ state: result.state, event: { type: 'health_changed', who: ACTOR, before: hp, after: hp - 2 }, context: context({ operationId: 'ritual-interrupted' }) });
  result = finalizeClassEvent({ state: result.state, plan: eventPlan });
  assert.equal(result.state.actors[ACTOR].classState.ritual, null);
  assert.equal(result.state.actors[ACTOR].classState.recoveryUses[request.definition.id], undefined);

  let state = classActionTestState('arcanist', 'arcanist.formula', 1);
  state.actors[ACTOR].health = state.actors[ACTOR].maxHealth - 7;
  state.actors[ACTOR].classState.recoveryUses.old = 1;
  const oldIds = state.actors[ACTOR].abilities.map(ability => ability.id);
  let nextId = 0;
  let advancement = advanceClassCharacter({ state, actor: ACTOR, award: 'milestone', awardId: 'award-1', idFactory: () => `new-grant-${++nextId}` });
  assert.equal(advancement.state.actors[ACTOR].level, 2);
  assert.equal(advancement.state.actors[ACTOR].maxHealth - advancement.state.actors[ACTOR].health, 7);
  assert.deepEqual(advancement.state.actors[ACTOR].abilities.map(ability => ability.id), oldIds);
  assert.equal(advancement.state.actors[ACTOR].classState.recoveryUses.old, 1);
  assert.equal(advanceClassCharacter({ state: advancement.state, actor: ACTOR, award: 'milestone', awardId: 'award-1' }).applied, false);
  advancement = advanceClassCharacter({ state: advancement.state, actor: ACTOR, award: 'milestone', awardId: 'award-2', idFactory: () => `new-grant-${++nextId}` });
  assert.equal(advancement.newAbilities.length, 1);
  assert.equal(advancement.newBindings.length, 1);
  assert.deepEqual(advancement.state.actors[ACTOR].abilities.slice(0, 3).map(ability => ability.id), oldIds);
  assert.throws(() => advanceClassCharacter({ state, actor: ACTOR, award: 100000, awardId: 'bad-award' }), /authored/);
  state = advancement.state;
  state.actors[ACTOR].conditions.winded = condition(ACTOR, 'winded', 'persistent');
  const recovered = recoverClassCharacter({ state, actor: ACTOR, recoveryId: 'recovery-1' });
  assert.equal(recovered.state.actors[ACTOR].health, recovered.state.actors[ACTOR].maxHealth);
  assert.ok(recovered.state.actors[ACTOR].conditions.winded);
  assert.deepEqual(recovered.state.actors[ACTOR].classState.recoveryUses, {});
  assert.equal(recoverClassCharacter({ state: recovered.state, actor: ACTOR, recoveryId: 'recovery-1' }).applied, false);
  const unavailable = structuredClone(state); unavailable.encounter.active = true;
  assert.throws(() => recoverClassCharacter({ state: unavailable, actor: ACTOR, recoveryId: 'recovery-2' }), /outside an encounter/);
  const spell = state.actors[ACTOR].abilities.find(ability => ability.invocation).definition_id;
  assert.deepEqual(configureClassPreparation({ state, actor: ACTOR, definitionIds: [spell] }).state.actors[ACTOR].classState.prepared, [spell]);
  assert.throws(() => configureClassPreparation({ state, actor: ACTOR, definitionIds: ['invented'] }), /owned/);
  assert.throws(() => configureClassPreparation({ state: unavailable, actor: ACTOR, definitionIds: [spell] }), /outside an encounter/);
  request = requestNamed('Predator Form', { bindings: { targets: [ACTOR] } });
  result = runAction(request);
  assert.equal(returnToBaseProfile({ state: result.state, actor: ACTOR, operationId: 'base-shape' }).state.actors[ACTOR].classState.profile, 'base');
  request = requestNamed('Far Sight', { bindings: { area: 'area:2:d' } });
  result = runAction(request);
  assert.equal(abandonClassRitual({ state: result.state, actor: ACTOR }).state.actors[ACTOR].classState.ritual, null);
  const portableSource = classActionTestState('bonded', 'bonded.partner').actors[ACTOR];
  Object.assign(portableSource.classState, { quarry: { target: 'npc:999' }, cue: { ally: 'character:999' }, ritual: { target: 'npc:888' }, sceneUses: { used: 1 }, recoveryUses: { limited: 1 }, strain: 2, prepared: ['retained-definition'] });
  portableSource.conditions = { dazed: condition(ACTOR, 'dazed'), winded: condition(ACTOR, 'winded', 'persistent') };
  portableSource.classState.companion.conditions = { dazed: condition(COMPANION, 'dazed'), winded: condition(COMPANION, 'winded', 'persistent') };
  const arrived = clearClassSceneState(portableSource);
  assert.equal(arrived.health, portableSource.health);
  assert.deepEqual(arrived.abilities, portableSource.abilities);
  assert.deepEqual(arrived.classState.recoveryUses, { limited: 1 });
  assert.deepEqual(arrived.classState.prepared, ['retained-definition']);
  assert.equal(arrived.classState.strain, 2);
  assert.equal(arrived.classState.quarry, null);
  assert.equal(arrived.classState.ritual, null);
  assert.equal(arrived.classState.companion.actorRef, undefined);
  assert.ok(arrived.classState.companion.conditions.winded);
  assert.equal(arrived.classState.companion.conditions.dazed, undefined);
  assert.ok(arrived.conditions.winded);
  assert.equal(arrived.conditions.dazed, undefined);
  assert.equal(portableSource.classState.quarry.target, 'npc:999');
  let progressionSteps = 0;
  for (const family of CLASS_FAMILIES) for (const branch of family.branches) {
    let growing = classActionTestState(family.id, branch.id, 1);
    const companionId = growing.actors[ACTOR].classState.companion?.actorRef;
    const vehicleId = growing.actors[ACTOR].classState.vehicle?.vehicleRef;
    growing.actors[ACTOR].classState.recoveryUses.fixtureLimited = 1;
    for (let level = 2; level <= 10; level += 1) {
      const previousIds = growing.actors[ACTOR].abilities.map(ability => ability.id);
      const missingHealth = growing.actors[ACTOR].maxHealth - growing.actors[ACTOR].health;
      const advanced = advanceClassCharacter({ state: growing, actor: ACTOR, award: 'milestone', awardId: `matrix-award-${level}`, idFactory: () => `advance-${family.id}-${branch.id}-${++nextId}` });
      growing = advanced.state;
      assert.equal(growing.actors[ACTOR].level, level);
      assert.deepEqual(growing.actors[ACTOR].abilities.slice(0, previousIds.length).map(ability => ability.id), previousIds);
      assert.equal(growing.actors[ACTOR].maxHealth - growing.actors[ACTOR].health, missingHealth);
      assert.equal(growing.actors[ACTOR].classState.recoveryUses.fixtureLimited, 1);
      assert.equal(growing.actors[ACTOR].classState.companion?.actorRef, companionId);
      assert.equal(growing.actors[ACTOR].classState.vehicle?.vehicleRef, vehicleId);
      progressionSteps += 1;
    }
  }
  assert.ok(before.actors[ACTOR]);
  return { actions, handlerModes: coveredModes.size, handlers: SUPPORTED_CLASS_HANDLERS.length, progressionSteps };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log('Class action tests passed:', runClassActionTests());
