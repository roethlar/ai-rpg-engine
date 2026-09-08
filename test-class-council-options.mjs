import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { ABILITY_DEFINITIONS, CLASS_FAMILIES, getAbilityDefinition } from './class-catalog.js';
import { buildAbilityDeclarations, buildCharacterAbilityTriggerState } from './ability-trigger-state.js';
import { classTriggerOptions } from './class-state.js';
import { prepareClassAction, finalizeClassAction } from './class-actions.js';
import { classActionTestState } from './test-class-actions.mjs';
import { buildClassCouncilOptions } from './class-council-options.js';

const ACTOR = 'character:1';
const ALLY = 'character:2';
const FOE = 'npc:2';
const definitionNamed = name => ABILITY_DEFINITIONS.find(value => value.name === name);

function declarationsFor(state, names = []) {
  const character = { ...state.actors[ACTOR], id: 1, player_character_id: 101 };
  const bindings = character.abilities.filter(value => value.invocation).map(value => ({ abilityId: value.id, term: value.name, prose: value.description, aliases: [] }));
  Object.assign(character, buildCharacterAbilityTriggerState({ campaignId: 1, character, bindings, ...classTriggerOptions(character) }));
  return buildAbilityDeclarations({ character, playerAction: names.length ? `I use ${names.join(' and ')}.` : 'I wait by the passage.' });
}

function optionsFor(state, names = []) {
  return buildClassCouncilOptions({ state, actor: ACTOR, declarations: declarationsFor(state, names) });
}

function namedFixture(name, level = 10) {
  const definition = definitionNamed(name);
  return classActionTestState(definition.familyId, definition.branchId, level);
}

function applyNamed(state, name, bindings = {}, extra = {}) {
  const definition = definitionNamed(name);
  const ability = state.actors[ACTOR].abilities.find(value => value.definition_id === definition.id).id;
  const plan = prepareClassAction({ state, actor: ACTOR, ability, bindings,
    context: { operationId: `options-${name.toLowerCase().replaceAll(' ', '-')}`, turn: 10,
      sceneId: 'scene:1', affirmedOpposed: [FOE], consentingActors: [ALLY], ...extra } });
  return finalizeClassAction({ state, plan, outcome: 'success' }).state;
}

const FORBIDDEN = new Set(['health', 'maxHealth', 'hull', 'maxHull', 'skills', 'skillBonus', 'T', 'raw',
  'tierTarget', 'netDelta', 'amount', 'pointCost', 'maximum', 'minimum', 'maximumDistance', 'maximumTriggers',
  'triggerCount', 'passengerCapacity', 'slots', 'remaining', 'count', 'armedTurn', 'appliedTurn', 'bornTurn',
  'strain', 'exposure', 'reprisal', 'cost', 'payload', 'onSuccess', 'onFailure', 'grade', 'sceneUses', 'recoveryUses']);

function assertQualitative(value, path = 'options') {
  assert.notEqual(typeof value, 'number', `Numeric state escaped at ${path}.`);
  assert.notEqual(value, undefined, `Undefined selector escaped at ${path}.`);
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      assert.equal(FORBIDDEN.has(key), false, `Mechanical bookkeeping escaped at ${path}.${key}.`);
      assertQualitative(child, `${path}.${key}`);
    }
  }
}

export function runClassCouncilOptionsTests() {
  let branches = 0;
  let activeDefinitions = 0;
  for (const family of CLASS_FAMILIES) for (const branch of family.branches) {
    branches += 1;
    const state = classActionTestState(family.id, branch.id);
    const before = structuredClone(state);
    for (const ability of state.actors[ACTOR].abilities.filter(value => value.invocation)) {
      const definition = getAbilityDefinition(ability.definition_id, ability.definition_version);
      const declarations = declarationsFor(state, [ability.name]);
      assert.equal(declarations.abilities.length, 1, `Exact producer declaration for ${ability.name}.`);
      const options = buildClassCouncilOptions({ state, actor: ACTOR, declarations });
      assert.equal(options.abilities.length, 1);
      const projected = options.abilities[0];
      assert.equal(projected.abilityId, ability.id);
      assert.equal(projected.definitionId, definition.id);
      assert.equal(projected.name, definition.name);
      assert.deepEqual(projected.targeting, { kind: definition.targeting.kind, range: definition.targeting.range });
      assertQualitative(options);
      assert.ok(Object.isFrozen(options));
      assert.ok(Object.isFrozen(projected.bindings));
      if (definition.mechanic.profile === '$profile') assert.deepEqual(projected.bindings.profile.values, state.actors[ACTOR].classState.learnedProfiles);
      if (definition.mechanic.requiresPrepared) assert.equal(projected.preparation,
        state.actors[ACTOR].classState.prepared.includes(definition.id) ? 'prepared' : 'not_prepared');
      activeDefinitions += 1;
    }
    const ordinary = optionsFor(state);
    assert.deepEqual(ordinary.abilities, [], 'Ordinary intent cannot acquire an undeclared active power.');
    assert.equal(ordinary.utilities.some(value => value.kind === 'prepare'), ['arcanist', 'maker'].includes(family.id));
    assert.equal(ordinary.utilities.some(value => value.kind === 'return_to_base'), family.id === 'shifter');
    assert.deepEqual(state, before, 'Selector projection cannot mutate the authoritative world.');
  }
  assert.equal(branches, 24);
  assert.equal(activeDefinitions, 144);

  const wizard = namedFixture('Magic Missile');
  const missile = optionsFor(wizard, ['Magic Missile']).abilities[0];
  assert.deepEqual(missile.options, {});
  assert.equal(missile.bindings.area, undefined);
  assert.equal(missile.bindings.weapon, undefined);
  assert.deepEqual(missile.resolution, { kind: 'contextual_check', skill: 'lore', defaultTier: 'standard',
    automaticSuccess: false, omitOnlyFor: ['established_certainty', 'no_stakes'] }, 'A familiar spell name cannot substitute another game\'s automatic-hit rule.');
  assert.deepEqual(optionsFor(wizard, ['Blink']).abilities[0].resolution, { kind: 'no_check' });
  const spellbook = optionsFor(wizard).utilities.find(value => value.kind === 'prepare');
  assert.ok(spellbook.choices.some(value => value.definitionId === definitionNamed('Magic Missile').id && value.basic && value.prepared));
  assert.ok(spellbook.choices.every(value => wizard.actors[ACTOR].abilities.some(owned => owned.definition_id === value.definitionId && owned.invocation)));
  const fireball = optionsFor(wizard, ['Fireball']).abilities[0];
  assert.equal(fireball.bindings.area.occupants, 'all_including_allies');
  assert.equal(fireball.bindings.targets, undefined, 'Area bursts must not invite a handpicked target subset.');

  let adaptive = namedFixture('Fluid Adaptation');
  const fluid = optionsFor(adaptive, ['Fluid Adaptation']);
  assert.deepEqual(fluid.abilities[0].bindings.profile.values, ['base', 'climber', 'aquatic', 'winged']);
  assert.deepEqual(fluid.profiles.find(value => value.id === 'winged').movementRequirements, { fly: 'space_for_wings' });
  assert.equal(fluid.profiles.find(value => value.id === 'aquatic').underwaterBreathing, true);
  const lash = optionsFor(adaptive, ['Nature Lash']).abilities[0];
  assert.deepEqual(lash.options.mode, { values: ['alternate'], required: false, omitted: 'base_action', requiresProfile: 'climber' });
  assert.equal(lash.fixed.profile, undefined, 'The alternate profile must not become a basic-cast requirement.');
  assert.deepEqual(lash.bindings.area.when, { any: [{ mode: 'alternate' }] });
  assert.deepEqual(lash.options.route.when, lash.bindings.area.when);
  adaptive = applyNamed(adaptive, 'Climber Form');
  assert.equal(optionsFor(adaptive).profiles.find(value => value.id === 'climber').active, true);
  assert.equal(optionsFor(adaptive).utilities.find(value => value.kind === 'return_to_base').activeProfile, 'climber');
  const lowAdaptive = optionsFor(namedFixture('Fluid Adaptation', 1));
  assert.deepEqual(lowAdaptive.profiles.map(value => value.id), ['base', 'climber']);
  assert.ok(lowAdaptive.utilities.some(value => value.kind === 'return_to_base'), 'The starting passive already grants return to base.');

  const adept = optionsFor(namedFixture('Sweeping Finish'), ['Sweeping Finish']);
  assert.deepEqual(adept.abilities[0].bindings.area.when, { any: [{ stance: 'turn' }] });
  assert.equal(adept.commitments.stance, 'ready');
  const overreach = optionsFor(namedFixture('Mending Light'), ['Mending Light']).abilities[0];
  assert.deepEqual(overreach.options.overreach, { values: [false, true], required: false, explicitPlayerChoice: true });
  const cleanse = optionsFor(namedFixture('Purifying Touch'), ['Purifying Touch']).abilities[0];
  assert.deepEqual(cleanse.bindings.condition.values, ['hindered', 'dazed', 'winded']);
  assert.ok(cleanse.requirements.some(value => value.duration === 'scene'));

  let forge = namedFixture('Relay Emplacement');
  forge = applyNamed(forge, 'Deploy Bulwark');
  forge = applyNamed(forge, 'Relay Emplacement', {}, { mode: 'deploy' });
  forge = applyNamed(forge, 'Deploy Snare', { area: 'b' });
  const devices = optionsFor(forge, ['Relay Emplacement', 'Mobile Bastion']);
  assert.equal(devices.installations.length, 3);
  const relay = devices.abilities.find(value => value.name === 'Relay Emplacement');
  assert.deepEqual(relay.options.mode.values, ['deploy', 'fire']);
  assert.deepEqual(relay.bindings.installation.values, [forge.actors[ACTOR].classState.installations.find(value => value.kind === 'relay').id]);
  assert.deepEqual(relay.bindings.retireInstallation.values, devices.installations.map(value => value.id));
  assert.deepEqual(relay.bindings.retireInstallation.when, { mode: 'deploy' });
  assert.equal(relay.fixed.fireOrigin, 'selected_installation');
  assert.ok(devices.installations.find(value => value.kind === 'bulwark').features.every(ref => forge.features[ref].status === 'active'));
  assert.deepEqual(devices.abilities.find(value => value.name === 'Mobile Bastion').bindings.installation.values, devices.installations.map(value => value.id));
  forge.actors[ACTOR].classState.installations[0].status = 'retired';
  assert.equal(optionsFor(forge, ['Mobile Bastion']).installations.length, 2);

  const caller = namedFixture('Greater Calling');
  const calling = optionsFor(caller, ['Greater Calling']);
  assert.deepEqual(calling.abilities[0].bindings.profile.values, ['guardian', 'scout', 'wisp']);
  assert.equal(calling.companion.ref, caller.actors[ACTOR].classState.companion.actorRef);
  assert.equal(calling.companion.controller, ACTOR);
  assert.equal(calling.companion.sharedMain, true);
  assert.equal(calling.profiles.find(value => value.id === 'wisp').canCarry, false);
  assert.equal(calling.profiles.find(value => value.id === 'wisp').attackRange, 'near');
  let rider = namedFixture('Passenger Rescue');
  rider = applyNamed(rider, 'Passenger Rescue', { targets: [ALLY], area: 'b' });
  const rescue = optionsFor(rider, ['Passenger Rescue']);
  assert.equal(rescue.vehicle.ref, rider.actors[ACTOR].classState.vehicle.vehicleRef);
  assert.equal(rescue.vehicle.operator, ACTOR);
  assert.equal(rescue.vehicle.area, 'area:1:b');
  assert.ok(rescue.vehicle.occupants.includes(ALLY));
  assert.equal(rescue.abilities[0].fixed.origin, 'vehicle');
  assertQualitative(rescue);

  let ritualist = namedFixture('Far Sight');
  ritualist.areas['area:1:a'].focus = true;
  const transit = optionsFor(ritualist, ['Transit Circle']).abilities[0];
  assert.equal(transit.bindings.area.type, 'area_ref');
  assert.equal(transit.bindings.travelers.relation, 'explicit_willing_travelers_including_self');
  assert.ok(optionsFor(ritualist).knownAreas.some(value => value.ref === 'area:2:d' && value.visited));
  ritualist.areas['area:2:hidden'] = { ...ritualist.areas['area:2:d'], id: 'hidden', visible: false, visited: false, name: 'Unrecorded destination' };
  assert.ok(!optionsFor(ritualist).knownAreas.some(value => value.id === 'hidden'));
  ritualist = applyNamed(ritualist, 'Far Sight', { area: 'area:2:d' });
  const working = optionsFor(ritualist);
  assert.equal(working.utilities.find(value => value.kind === 'continue_ritual').definitionId, definitionNamed('Far Sight').id);
  assert.equal(working.utilities.find(value => value.kind === 'continue_ritual').retainedBindings, true);
  assert.equal(working.utilities.find(value => value.kind === 'continue_ritual').workingPhase, 'completing');
  assert.equal(working.utilities.find(value => value.kind === 'continue_ritual').resolution.kind, 'contextual_check');
  assert.equal(optionsFor(ritualist, ['Transit Circle']).abilities[0].workingPhase, 'preliminary',
    'A different ritual cannot borrow the active working progress.');
  assert.deepEqual(optionsFor(ritualist, ['Transit Circle']).abilities[0].resolution, { kind: 'no_check' });
  assert.ok(working.utilities.some(value => value.kind === 'abandon_ritual'));
  assertQualitative(working);
  const sanctuary = optionsFor(ritualist, ['Sanctuary Working']).abilities[0];
  assert.equal(sanctuary.bindings.area, undefined);
  assert.equal(sanctuary.fixed.destination, 'current_area');
  const recall = optionsFor(ritualist, ['Recall the Departed']).abilities[0];
  assert.equal(recall.bindings.catalyst.relation, 'owned_revival_catalyst');

  let recallState = namedFixture('Recall the Departed');
  Object.assign(recallState.actors[ALLY], { health: 0, status: 'dead', intactBody: true, willingReturn: true, deathTurn: 8 });
  const recallDefinition = definitionNamed('Recall the Departed');
  const recallAbility = recallState.actors[ACTOR].abilities.find(value => value.definition_id === recallDefinition.id);
  const recallBindings = { targets: [ALLY], catalyst: 'item:2' };
  for (let step = 1; step <= 3; step++) {
    const declared = optionsFor(recallState, ['Recall the Departed']).abilities[0];
    const plan = prepareClassAction({ state: recallState, actor: ACTOR, ability: recallAbility.id, bindings: recallBindings,
      context: { operationId: `options-recall-${step}`, turn: 9 + step, sceneId: 'scene:1', consentingActors: [ALLY] } });
    assert.equal(declared.workingPhase, step < 3 ? 'preliminary' : 'completing');
    assert.equal(declared.resolution.kind, plan.check ? 'contextual_check' : 'no_check',
      'Ritual selector resolution must match the executable current working, not just the final definition.');
    if (step < 3) assert.deepEqual(declared.resolution, { kind: 'no_check' });
    else assert.deepEqual(declared.resolution, { kind: 'contextual_check', skill: 'lore', defaultTier: 'standard',
      automaticSuccess: false, omitOnlyFor: ['established_certainty', 'no_stakes'] });
    if (step > 1) {
      const plain = optionsFor(recallState);
      const continuation = plain.utilities.find(value => value.kind === 'continue_ritual');
      assert.deepEqual(plain.abilities, []);
      assert.equal(continuation.workingPhase, declared.workingPhase);
      assert.deepEqual(continuation.resolution, declared.resolution);
      assert.equal(continuation.retainedBindings, true);
      assertQualitative(plain);
    }
    assertQualitative(declared);
    recallState = finalizeClassAction({ state: recallState, plan, outcome: 'success' }).state;
  }
  assert.equal(recallState.actors[ACTOR].classState.ritual, null);
  assert.equal(recallState.actors[ALLY].health, 1);

  let hunter = namedFixture('Mark Quarry');
  hunter = applyNamed(hunter, 'Mark Quarry', { targets: [FOE] });
  hunter.actors[ACTOR].classState.quarry.trail = ['b', 'c'];
  const hunt = optionsFor(hunter, ['Close the Distance']);
  assert.deepEqual(hunt.commitments.quarry.trail, ['b', 'c']);
  assert.equal(hunt.commitments.quarry.target, FOE);
  assert.deepEqual(hunt.abilities[0].options.route.values, ['b', 'c']);
  assert.equal(hunt.abilities[0].bindings.area, undefined);
  let oath = namedFixture('Declare Ward');
  oath = applyNamed(oath, 'Declare Ward', { targets: [ALLY] });
  oath = applyNamed(oath, 'Sanctuary Stand', { targets: [ALLY] });
  const ward = optionsFor(oath, ['Sanctuary Stand']);
  assert.equal(ward.commitments.declaration.target, ALLY);
  assert.equal(ward.commitments.declaration.guardActive, true);
  assert.equal(ward.abilities[0].fixed.destination, 'bound_ward_area');
  assert.equal(ward.abilities[0].bindings.area, undefined);
  let catalyst = namedFixture('Advance Cue');
  catalyst = applyNamed(catalyst, 'Advance Cue', { targets: [ALLY], area: 'b' });
  const cue = optionsFor(catalyst);
  assert.deepEqual(cue.commitments.cue, { ally: ALLY, target: null, trigger: 'ally_attack_success', area: 'b', requiresCover: false });
  assertQualitative(cue);

  for (const state of [wizard, adaptive, forge, caller, rider, ritualist, hunter, oath, catalyst]) {
    const cs = state.actors[ACTOR].classState;
    cs.secretArithmetic = { amount: 918273, grade: 'grievous', skillBonus: 999 };
    state.actors[ACTOR].profileCapabilities = { skills: { melee: 918273 }, health: 918273 };
    for (const value of [cs.quarry, cs.opening, cs.declaration, cs.cue, cs.companion, cs.vehicle, ...cs.installations || []].filter(Boolean)) {
      Object.assign(value, { bornTurn: 918273, count: 918273, secretArithmetic: cs.secretArithmetic });
    }
    const before = structuredClone(state);
    const options = optionsFor(state);
    assertQualitative(options);
    assert.ok(!JSON.stringify(options).includes('918273'));
    assert.deepEqual(state, before);
  }

  let rejected = 0;
  const bad = (state, declarations, actor = ACTOR) => {
    assert.throws(() => buildClassCouncilOptions({ state, actor, declarations }), error => error.code === 'CLASS_COUNCIL_OPTIONS_INVALID');
    rejected += 1;
  };
  const valid = declarationsFor(wizard, ['Magic Missile']);
  bad(wizard, undefined);
  bad(wizard, valid, FOE);
  bad(wizard, { ...valid, abilities: [...valid.abilities, ...valid.abilities] });
  for (const replacement of [{ ability_id: 'foreign-owned-id' }, { definition_id: definitionNamed('Fireball').id }, { definition_version: 99 }]) {
    bad(wizard, { ...valid, abilities: [{ ...valid.abilities[0], ...replacement }] });
  }
  const passive = wizard.actors[ACTOR].abilities.find(value => !value.invocation);
  bad(wizard, { ...valid, abilities: [{ ability_id: passive.id, definition_id: passive.definition_id, definition_version: passive.definition_version }] });
  const unowned = namedFixture('Magic Missile', 1);
  bad(unowned, { ...valid, abilities: [{ ...valid.abilities[0], definition_id: definitionNamed('Meteor Crown').id }] });
  const brokenCompanion = structuredClone(caller);
  brokenCompanion.actors[ACTOR].classState.companion.actorRef = 'npc:999';
  bad(brokenCompanion, declarationsFor(brokenCompanion));
  const brokenProfile = structuredClone(adaptive);
  brokenProfile.actors[ACTOR].classState.learnedProfiles.push('invented-profile');
  bad(brokenProfile, declarationsFor(brokenProfile));
  return { branches, activeDefinitions, rejected };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log('Class Council options tests passed:', runClassCouncilOptionsTests());
}
