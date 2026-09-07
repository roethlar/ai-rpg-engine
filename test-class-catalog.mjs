import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import {
  ABILITY_DEFINITIONS, ABILITY_FAMILIES, CATALOG_EFFECT_VERSION, CATALOG_LEVEL_CAP,
  CATALOG_RESOLUTION_VERSION, CATALOG_RULES_VERSION, CATALOG_SKILLS, CATALOG_VERSION,
  CLASS_FAMILIES, CLASS_PROFILES, CLASS_RECOVERY_RULES, COMPANION_PROFILES,
  REQUIRED_EFFECT_OPERATIONS, REQUIRED_MECHANIC_HANDLERS, VEHICLE_PROFILES,
  assertCatalogExecutorSupport, buildClassLoadout, getAbilityDefinition,
  getCatalogSummary, getClassBranch
} from './class-catalog.js';
import { buildAbilityDeclarations, buildCharacterAbilityTriggerState } from './ability-trigger-state.js';

const expectedBranches = {
  armsmaster: ['discipline', 'pursuit'], berserker: ['fury', 'endurance'],
  adept: ['flow', 'stillness'], opportunist: ['opening', 'mastery'],
  arcanist: ['formula', 'ritual'], channeler: ['restoration', 'manifestation'],
  oathbound: ['aegis', 'judgment'], shifter: ['predator', 'adaptive'],
  maker: ['kit', 'forge'], bonded: ['partner', 'caller'],
  catalyst: ['tactics', 'resonance'], rider: ['ace', 'cavalier']
};
const supported = { capabilities: { alliedActors: true, rider: true }, modules: ['rider'] };
const load = (familyId = 'armsmaster', branchId = `${familyId}.discipline`, extra = {}) => (
  buildClassLoadout({ familyId, branchId, ...supported, ...extra })
);
const byName = name => ABILITY_DEFINITIONS.find(definition => definition.name === name);

export function runClassCatalogTests() {
  assert.equal(CATALOG_LEVEL_CAP, 10);
  assert.equal(CLASS_FAMILIES.length, 12);
  assert.equal(CLASS_FAMILIES.filter(family => family.kind === 'universal').length, 10);
  assert.equal(CLASS_FAMILIES.filter(family => family.kind === 'conditional').length, 1);
  assert.equal(CLASS_FAMILIES.filter(family => family.kind === 'module').length, 1);
  assert.equal(ABILITY_DEFINITIONS.length, 168);
  assert.deepEqual(ABILITY_FAMILIES.map(family => family.key), Object.keys(expectedBranches));
  assert.equal(new Set(ABILITY_DEFINITIONS.map(definition => definition.id)).size, ABILITY_DEFINITIONS.length);
  assert.equal(new Set(ABILITY_DEFINITIONS.map(definition => definition.name.toLowerCase())).size, ABILITY_DEFINITIONS.length);

  let sheets = 0;
  let declarations = 0;
  for (const family of CLASS_FAMILIES) {
    assert.deepEqual(family.branches.map(branch => branch.id), expectedBranches[family.id].map(branch => `${family.id}.${branch}`));
    for (const branch of family.branches) {
      assert.equal(getClassBranch(branch.id), branch);
      assert.equal(getClassBranch(family.id, branch.id), branch);
      assert.equal(branch.progression.length, 10);
      assert.equal(branch.abilityDefinitionIds.length, 7);
      assert.equal(new Set(branch.abilityDefinitionIds).size, 7);
      assert.equal(branch.progression[0].grants.length, 3);
      assert.equal(branch.progression[9].grants.length, 1);
      for (let level = 1; level <= 10; level += 1) {
        let nextId = 0;
        const sheet = load(family.id, branch.id, { level, idFactory: () => `fixture-${family.id}-${level}-${++nextId}` });
        sheets += 1;
        assert.equal(sheet.level, level);
        assert.equal(sheet.xp, (level - 1) * 100);
        assert.equal(sheet.familyId, family.id);
        assert.equal(sheet.branchId, branch.id);
        assert.equal(sheet.mana, 0);
        assert.equal(sheet.maxMana, 0);
        assert.equal(sheet.resources.health.current, sheet.health);
        assert.equal(sheet.resources.health.maximum, sheet.maxHealth);
        assert.deepEqual(sheet.pins, { catalogVersion: CATALOG_VERSION, rulesVersion: CATALOG_RULES_VERSION, resolutionVersion: CATALOG_RESOLUTION_VERSION, effectCatalogVersion: CATALOG_EFFECT_VERSION, optionSet: 'expert' });
        assert.deepEqual(Object.keys(sheet.skills), CATALOG_SKILLS);
        assert.ok(Object.values(sheet.skills).every(value => Number.isSafeInteger(value) && value >= 0 && value <= 75));
        assert.equal(sheet.abilities.filter(ability => !ability.invocation).length, 1);
        assert.equal(sheet.bindings.length, sheet.abilities.length - 1);
        assert.deepEqual(sheet.abilities.map(ability => ability.definition_id), branch.abilityDefinitionIds.filter(id => getAbilityDefinition(id).grantedAtLevel <= level));
        assert.equal(new Set(sheet.abilities.map(ability => ability.id)).size, sheet.abilities.length);
        assert.ok(sheet.inventory.length > 0);
        assert.deepEqual(sheet.requiredOperations, REQUIRED_EFFECT_OPERATIONS);
        assert.deepEqual(sheet.requiredHandlers, REQUIRED_MECHANIC_HANDLERS);

        const character = { id: 1, player_character_id: 2, abilities: sheet.abilities };
        const projection = buildCharacterAbilityTriggerState({ campaignId: 3, character, bindings: sheet.bindings, familyRegistry: ABILITY_FAMILIES, catalogVersion: CATALOG_VERSION, characterVersionId: 2 });
        assert.equal(projection.invocableAbilities.length, sheet.bindings.length);
        for (const ability of projection.invocableAbilities) {
          const declaration = buildAbilityDeclarations({ character: { ...character, ...projection }, playerAction: `I use ${ability.trigger} on the recorded target.` });
          assert.equal(declaration.abilities.length, 1);
          assert.equal(declaration.abilities[0].ability_id, ability.abilityId);
          assert.equal(declaration.abilities[0].definition_id, ability.definitionId);
          declarations += 1;
        }
        assert.deepEqual(buildAbilityDeclarations({ character: { ...character, ...projection }, playerAction: 'I attack the raider with my ordinary weapon.' }).abilities, []);
        if (level > 1) {
          assert.ok(branch.progression[level - 1].maxHealth > branch.progression[level - 2].maxHealth);
          assert.ok(branch.progression[level - 1].skillBonus > branch.progression[level - 2].skillBonus);
        }
      }
    }
  }
  assert.equal(sheets, 240);
  assert.ok(declarations > 900);

  for (const definition of ABILITY_DEFINITIONS) {
    assert.equal(Object.isFrozen(definition), true);
    assert.equal(Object.isFrozen(definition.mechanic), true);
    assert.equal(Object.isFrozen(definition.onSuccess), true);
    assert.ok(definition.name.length <= 80);
    assert.ok(definition.description.length <= 500);
    assert.ok(definition.name.trim() === definition.name);
    assert.ok(definition.description.trim() === definition.description);
    assert.equal(getAbilityDefinition(definition.id, 1), definition);
    assert.equal(getAbilityDefinition(definition.id, 2), null);
    assert.ok(definition.onSuccess.length || definition.mechanic.kind !== 'none');
    assert.ok(!/bodyguard/i.test(definition.name));
    if (definition.activation === 'passive') {
      assert.equal(definition.check, null);
      assert.equal(definition.mechanic.kind, 'passive');
      assert.ok(Object.keys(definition.mechanic.modifiers).length > 0);
    }
    if (definition.activation === 'ritual') {
      assert.equal(definition.mechanic.kind, 'ritual');
      assert.ok(definition.mechanic.steps >= 2);
      assert.ok(definition.mechanic.requirements.length > 0);
      assert.ok(definition.mechanic.interruptedBy.includes('harm'));
    }
  }
  assert.throws(() => { CLASS_FAMILIES[0].branches[0].name = 'Changed'; }, TypeError);
  assert.throws(() => { byName('Magic Missile').onSuccess.push({ op: 'harm' }); }, TypeError);
  assert.equal(getAbilityDefinition('unknown'), null);
  assert.equal(getClassBranch('unknown'), null);
  assert.equal(getClassBranch(null), null);
  assert.equal(getClassBranch('armsmaster', 4), null);

  const first = load();
  const second = load();
  assert.notEqual(first.abilities[0].id, second.abilities[0].id);
  assert.equal(first.abilities[0].definition_id, second.abilities[0].definition_id);
  first.abilities[0].description = 'Changed owned copy';
  first.classState.sceneUses.changed = 99;
  assert.notEqual(getAbilityDefinition(first.abilities[0].definition_id).description, 'Changed owned copy');
  assert.deepEqual(second.classState.sceneUses, {});
  assert.throws(() => load('armsmaster', 'armsmaster.discipline', { idFactory: () => 'same-id' }), /unique bounded/);
  for (const idFactory of [null, () => '', () => ' bad ', () => 'x'.repeat(129), () => 1]) {
    assert.throws(() => load('armsmaster', 'armsmaster.discipline', { idFactory }));
  }
  for (const level of [0, 11, -1, 1.5, '1', NaN, Infinity]) assert.throws(() => load('armsmaster', 'armsmaster.discipline', { level }), /level/);
  for (const optionSet of ['base', 'advanced', 'unknown', null]) assert.throws(() => load('armsmaster', 'armsmaster.discipline', { optionSet }), /Expert/);
  assert.throws(() => load('armsmaster', 'armsmaster.discipline', { catalogVersion: 'future' }), /version/);
  assert.throws(() => load('armsmaster', 'berserker.fury'), /Unknown class/);
  assert.throws(() => load('intruder', 'intruder.access'), /Unknown class/);
  assert.throws(() => load('rider', 'rider.ace', { capabilities: {} }), /vehicle/);
  assert.throws(() => load('rider', 'rider.ace', { modules: [] }), /module/);
  assert.throws(() => load('catalyst', 'catalyst.tactics', { capabilities: {} }), /allied actor/);
  assert.throws(() => load('armsmaster', 'armsmaster.discipline', { modules: ['intrusion'] }), /Unknown campaign/);

  const noSupport = getCatalogSummary();
  assert.equal(noSupport.optionSet, 'expert');
  assert.equal(noSupport.evidence, 'unverified');
  assert.deepEqual(noSupport.optionSets.map(set => set.id), ['expert']);
  assert.equal(noSupport.families.filter(family => family.available).length, 10);
  assert.equal(noSupport.families.find(family => family.id === 'catalyst').available, false);
  assert.equal(noSupport.families.find(family => family.id === 'rider').available, false);
  const allSupport = getCatalogSummary(supported);
  assert.equal(allSupport.families.filter(family => family.available).length, 12);
  assert.equal(allSupport.modules[0].grantsSecondClass, false);
  const cyberpunk = getCatalogSummary({ ...supported, genre: 'Cyberpunk / tech-noir' });
  assert.equal(cyberpunk.families[0].branches[0].classLabel, 'Street Samurai');
  assert.equal(cyberpunk.families[8].branches[1].classLabel, 'Augmenter');
  const space = getCatalogSummary({ ...supported, genre: 'Space opera / science fiction' });
  assert.equal(space.families[11].branches[0].classLabel, 'Starfighter Ace');
  assert.equal(load('armsmaster', 'armsmaster.discipline', { genre: 'Cyberpunk' }).classLabel, 'Street Samurai');
  cyberpunk.families[0].branches[0].abilities[0].name = 'Changed summary';
  assert.equal(byName('Driving Strike').name, 'Driving Strike');
  assert.throws(() => getCatalogSummary({ optionSet: 'base' }), /earned/);

  for (const name of ['Magic Missile', 'Fireball', 'Arcane Lance', 'Radiant Rebuke', 'Force Bolt', 'Nature Lash']) {
    const spell = byName(name);
    assert.equal(spell.grantedAtLevel, 1);
    assert.equal(spell.activation, 'main');
    assert.deepEqual(spell.requirements, []);
    assert.ok(spell.onSuccess.some(effect => effect.op === 'harm'));
    assert.ok(!['ritual', 'sequence', 'opening'].includes(spell.mechanic.kind));
  }
  assert.equal(byName('Magic Missile').mechanic.requiresWeapon, false);
  assert.equal(byName('Magic Missile').mechanic.requiresAmmunition, false);
  assert.deepEqual(byName('Magic Missile').mechanic.ignoredDeltaSources, ['mundane_aim', 'mundane_cover']);
  assert.equal(byName('Fireball').targeting.kind, 'area_all_actors');
  assert.equal(byName('Fireball').mechanic.friendlyFire, true);
  assert.equal(byName('Blink').onSuccess[0].mode, 'blink');
  assert.equal(byName('Transit Circle').onSuccess[0].mode, 'circle');
  assert.equal(byName('Recall the Departed').mechanic.steps, 3);
  assert.equal(byName('Recall the Departed').onSuccess[1].item, '$catalyst');
  assert.equal(byName('Breath of Return').onSuccess[0].maximumElapsedTurns, 2);

  const caster = load('arcanist', 'arcanist.formula');
  assert.ok(caster.abilities.filter(ability => ability.invocation).every(ability => caster.classState.prepared.includes(ability.definition_id)));
  assert.equal(load('channeler', 'channeler.manifestation').classState.strain, 0);
  assert.equal(load('berserker', 'berserker.fury').classState.exposure, 0);
  assert.equal(load('adept', 'adept.flow').classState.stance, 'ready');
  const caller = load('bonded', 'bonded.caller');
  assert.equal(caller.classState.companion.sharedMain, true);
  assert.equal(caller.classState.companion.maxHealth, 22);
  assert.deepEqual(caller.classState.learnedProfiles, ['guardian', 'scout']);
  assert.ok(load('bonded', 'bonded.caller', { level: 5 }).classState.learnedProfiles.includes('wisp'));
  assert.equal(load('rider', 'rider.cavalier').classState.vehicle.passengerCapacity, 2);
  assert.equal(load('rider', 'rider.ace').classState.vehicle.sharedMain, true);
  assert.equal(CLASS_PROFILES.predator.checkDeltas[0].skill, 'influence');
  assert.equal(CLASS_PROFILES.predator.checkDeltas[0].direction, 'hinders');
  assert.equal(CLASS_PROFILES.predator.checkDeltas[0].magnitude, 'slight');
  assert.equal(CLASS_PROFILES.ironhide.minimumIncomingGrade, 'graze');
  assert.equal(COMPANION_PROFILES.wisp.canCarry, false);
  assert.equal(VEHICLE_PROFILES.ace.scale, 'vehicle');
  assert.equal(CLASS_RECOVERY_RULES.advancement.heals, false);
  assert.equal(CLASS_RECOVERY_RULES.safeRecovery.clearsPersistentConditions, false);

  assert.throws(() => assertCatalogExecutorSupport(), /executor is incomplete/);
  assert.equal(assertCatalogExecutorSupport({ operations: REQUIRED_EFFECT_OPERATIONS, handlers: REQUIRED_MECHANIC_HANDLERS }), true);
  for (const missing of REQUIRED_EFFECT_OPERATIONS) {
    assert.throws(() => assertCatalogExecutorSupport({ operations: REQUIRED_EFFECT_OPERATIONS.filter(operation => operation !== missing), handlers: REQUIRED_MECHANIC_HANDLERS }), /Missing operations/);
  }
  for (const missing of REQUIRED_MECHANIC_HANDLERS) {
    assert.throws(() => assertCatalogExecutorSupport({ operations: REQUIRED_EFFECT_OPERATIONS, handlers: REQUIRED_MECHANIC_HANDLERS.filter(handler => handler !== missing) }), /Missing handlers/);
  }
  return { branches: 24, definitions: 168, sheets, declarations };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log('Class catalog tests passed:', runClassCatalogTests());
}
