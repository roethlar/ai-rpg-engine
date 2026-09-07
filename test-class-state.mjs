import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { CLASS_FAMILIES, CATALOG_VERSION } from './class-catalog.js';
import {
  validateClassSelection, createClassRuleset, createClassSheet, createRulesWorld, addClassActor,
  projectClassCharacter, validateClassRuleset, validateClassBuild, restoreClassSheet, classTriggerOptions
} from './class-state.js';
import { buildCharacterAbilityTriggerState } from './ability-trigger-state.js';

export const testSelection = (familyId = 'arcanist', branchId = 'arcanist.formula') => ({
  catalogVersion: CATALOG_VERSION, optionSet: 'expert', familyId, branchId,
  modules: ['rider'], capabilities: { rider: true, alliedActors: true }
});
export const testClassLayout = {
  name: 'Gatehouse', description: 'Two connected areas.',
  areas: [{ id: 'gate', name: 'Gate', x: 0, y: 0, w: 40, h: 40 }, { id: 'yard', name: 'Yard', x: 40, y: 0, w: 40, h: 40 }],
  exits: [{ from: 'gate', to: 'yard', label: 'Arch' }], features: []
};

export function runClassStateTests() {
  const selection = validateClassSelection(testSelection());
  const ruleset = createClassRuleset(selection);
  assert.deepEqual(validateClassRuleset(ruleset), ruleset);
  for (const key of ['catalogVersion', 'rulesVersion', 'resolutionVersion', 'effectCatalogVersion', 'optionSet']) {
    assert.throws(() => validateClassRuleset({ ...ruleset, [key]: 'unknown' }), /unsupported/i);
  }
  assert.throws(() => validateClassSelection({ ...selection, grants: ['all'] }), /fields/);
  assert.throws(() => validateClassSelection({ ...selection, optionSet: 'base' }), /unavailable/);
  assert.throws(() => validateClassSelection({ ...selection, modules: [], capabilities: { rider: true } }), /capabilities/);
  assert.throws(() => validateClassSelection({ ...selection, capabilities: { alliedActors: false } }, { campaignRuleset: ruleset }), /pinned/);
  assert.throws(() => restoreClassSheet({}, ruleset), /Legacy/);
  const world = createRulesWorld({ location: { id: 1, layout: testClassLayout }, npcs: [{ id: 10, name: 'Keeper' }] });
  assert.equal(world.actors['npc:10'].present, false, 'Narration does not infer NPC presence.');
  assert.deepEqual(world.areas['area:1:gate'].adjacent, ['yard']);
  let index = 0;
  for (const family of CLASS_FAMILIES) for (const branch of family.branches) {
    const selected = validateClassSelection(testSelection(family.id, branch.id));
    const sheet = createClassSheet(selected, { name: `Player ${++index}` });
    validateClassBuild(sheet.classBuild, ruleset);
    const character = { ...sheet, id: index, player_character_id: index + 100 };
    if (sheet.classState.companion) {
      const before = structuredClone(world);
      assert.throws(() => addClassActor(world, character), /companion/);
      assert.deepEqual(world, before, 'Failed companion activation cannot leave character/items behind.');
    }
    addClassActor(world, character, { companionActorRef: `npc:${index + 100}` });
    const projection = projectClassCharacter(character, world);
    assert.deepEqual(projection.abilities, sheet.abilities);
    assert.deepEqual(projection.skills, sheet.skills);
    assert.equal(projection.health, sheet.health);
    assert.equal(projection.resources.health.maximum, sheet.max_health);
    assert.ok(projection.inventory.every(item => item.id.startsWith('item:')));
    const triggers = buildCharacterAbilityTriggerState({ campaignId: 1, character: projection,
      bindings: sheet.bindings, ...classTriggerOptions(character) });
    assert.ok(triggers.invocableAbilities.length >= 1);
    const restored = restoreClassSheet({ name: sheet.name, archetype: sheet.class,
      class_build_json: JSON.stringify(sheet.classBuild), class_state_json: JSON.stringify({ ...projection, bindings: sheet.bindings }) }, ruleset);
    assert.deepEqual(restored.abilities, sheet.abilities, 'Restore preserves opaque owned IDs.');
  }
  assert.equal(index, 24);
  return { branches: index };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log('Class state tests passed:', runClassStateTests());
}
