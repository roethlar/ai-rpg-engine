import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { CATALOG_VERSION, CATALOG_OPTION_SET } from './class-catalog.js';
import { createClassSheet, createClassRuleset, createRulesWorld } from './class-state.js';
import { createCheckRecord } from './rules-resolution.js';
import { evaluateEffects } from './rules-effects.js';
import { NPC_PROFILE_VERSION } from './class-scenario.js';
import {
  validateClassBundle, validatePortableRulesWorld, validateClassCharacterSnapshot,
  createClassReferenceMaps, remapClassBundle, forkClassBundle
} from './class-portability.js';

function fixture() {
  const selection = { catalogVersion: CATALOG_VERSION, optionSet: CATALOG_OPTION_SET, familyId: 'armsmaster', branchId: 'discipline', modules: [], capabilities: { rider: false, alliedActors: false } };
  let id = 0;
  const sheet = createClassSheet(selection, { name: 'Hero', idFactory: () => `owned-${++id}` });
  const character = { ...sheet, id: 10, player_character_id: 100 };
  const ruleset = createClassRuleset(selection);
  const location = { id: 30, name: 'Court', key: 'court', layout: { areas: [{ id: 'a', name: 'Court' }, { id: 'b', name: 'Gate' }], exits: [{ from: 'a', to: 'b' }] } };
  const world = createRulesWorld({ location, characters: [character], npcs: [{ id: 20, name: 'Foe', area: 'a' }] });
  world.scenarioFrames = { 'scene:30': { schemaVersion: 1, npcProfileVersion: NPC_PROFILE_VERSION, turn: 1,
    refs: { actors: { hero: 'character:10', foe: 'npc:20' }, areas: { a: 'area:30:a' }, items: {}, objects: {}, features: {} } } };
  const outcome = createCheckRecord({ call: { actor: 10, callSeq: 1, intent: 'Act against npc:20.', tier: 'standard', tierBasis: 'An alert foe.', deltas: [] }, actor: 10, turn: 1, skillBonus: 0, activeEncounter: true },
    { roll: () => 100, newId: () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', now: () => '2026-09-07T12:00:00.000Z' });
  const evaluated = evaluateEffects({ state: world,
    effects: [{ op: 'harm', who: 'npc:20', grade: 'graze' }, { op: 'scene_feature_place', area: 'a', kind: 'smoke', name: 'Veil', duration: 'scene', works_against: 'opposition' }],
    actor: 10, turn: 1, transactionId: outcome.checkId, consumer: 'annotation', band: outcome.band, stakesLicense: outcome.stakesLicense, affirmedOpposed: ['npc:20'] });
  const check = { ...outcome, annotation: { text: 'A phrase mentioning npc:20 must remain verbatim.', effects: evaluated.effects, affirmedOpposed: ['npc:20'] },
    campaignId: 1000, operationId: 'original-operation', annotationFinalized: true };
  const first = evaluated.state;
  first.turnOrder.round = 1;
  const featureRef = evaluated.effects[1].resolvedTargets.feature;
  const current = evaluateEffects({ state: first, effects: [{ op: 'scene_feature_clear', feature: featureRef }], actor: 10, turn: 2, transactionId: 'second-operation', consumer: 'ordinary' }).state;
  current.actors['character:10'].health = 7;
  current.actors['character:10'].classState.sceneUses['ability.armsmaster.discipline.disarming-cut'] = 1;
  current.turnOrder.round = 2;
  return {
    sheet,
    bundle: {
      kind: 'aetheria-campaign', format_version: 4,
      campaign: { title: 'Portable class campaign', genre: 'fantasy', rules_mode: true, ruleset_json: JSON.stringify(ruleset) },
      class_runtime: { schemaVersion: 1, sourceCampaignId: 1000, rulesRevision: 2, world: current, checks: [check] },
      characters: [{ source_id: 10, source_profile_id: 100, name: 'Hero', class: sheet.class, health: 7, max_health: sheet.max_health, mana: 0, max_mana: 0,
        xp: sheet.xp, level: sheet.level, status: 'active', attributes_json: JSON.stringify(sheet.attributes), abilities_json: JSON.stringify(sheet.abilities), inventory_json: '[]', class_build_json: JSON.stringify(sheet.classBuild) }],
      npcs: [{ source_id: 20, name: 'Foe' }],
      locations: [{ source_id: 30, name: 'Court', key: 'court', layout_json: JSON.stringify(location.layout) }],
      memories: [{ turn_number: 1, summary: 'npc:20 is text.' }, { turn_number: 2, summary: 'A later fact.' }],
      turns: [
        { turn_number: 1, source_character_id: 10, player_action: 'A literal npc:20.', narrative: 'Never rewrite npc:20 or character:10 here.', state_changes_json: JSON.stringify({ dice_rolls: [check], scene_grounding: 'npc:20 is prose.', quest_update: { active_quest: 'npc:20', quest_description: 'character:10' }, arbitrary_prose: { actor: 10, detail: 'npc:20' }, rules_effects: evaluated.effects, rules_events: [{ who: 'npc:20', detail: 'npc:20' }], rules_award: { actor: 10, award: 'milestone' } }), rules_snapshot_json: JSON.stringify(first), ability_invocations: { schema_version: 1, trigger_revision: 'original-revision', abilities: [] } },
        { turn_number: 2, source_character_id: 10, player_action: 'Wait.', narrative: 'Later.', state_changes_json: '{}', rules_snapshot_json: JSON.stringify(current), ability_invocations: { schema_version: 1, trigger_revision: 'original-revision', abilities: [] } }
      ],
      portability: { vocabulary_version: 0, vocabulary_entries: [], character_ability_bindings: sheet.bindings.map(binding => ({ source_profile_id: 100, ability_id: binding.abilityId, term: binding.term, prose: binding.prose, aliases: binding.aliases })) },
      pointers: { current_location_key: 'court', turn_order: { order: [10], current_index: 0, round: 2 } }
    }
  };
}

export function runClassPortabilityTests() {
  console.log(' - Running exact class snapshot portability tests...');
  const { bundle, sheet } = fixture();
  const original = structuredClone(bundle);
  const runtime = validateClassBundle(bundle);
  assert.deepEqual(bundle, original, 'Validation must not mutate source artifacts.');
  assert.deepEqual(runtime.checks[0].sourceContext, { campaignId: 1000, actor: 10, turn: 1 });
  assert.equal(validateClassBundle({ kind: 'aetheria-campaign', format_version: 3, campaign: { ruleset_json: null } }), null);
  const legacySanitizerInput = { kind: 'aetheria-campaign', format_version: 3, campaign: { ruleset_json: null }, npcs: [{ voice_json: { voiceSeed: Infinity, mood: undefined } }] };
  assert.equal(validateClassBundle(legacySanitizerInput), null, 'Target-only validation must not preempt existing legacy sanitizers.');
  assert.deepEqual(remapClassBundle(legacySanitizerInput, {}), legacySanitizerInput);
  assert.deepEqual(remapClassBundle({ kind: 'aetheria-campaign', format_version: 3, campaign: { ruleset_json: null }, arbitraryLegacy: 'preserved' }, {}),
    { kind: 'aetheria-campaign', format_version: 3, campaign: { ruleset_json: null }, arbitraryLegacy: 'preserved' });
  const reject = mutate => {
    const invalid = structuredClone(bundle);
    mutate(invalid);
    assert.throws(() => validateClassBundle(invalid), undefined, 'Malformed class artifacts must reject, never be repaired/dropped.');
  };
  reject(value => { delete value.class_runtime; });
  reject(value => { value.class_runtime.schemaVersion = 9; });
  reject(value => { value.class_runtime.world.effectCatalogVersion = 'unknown-effects'; });
  reject(value => { value.class_runtime.world.scenarioFrames['scene:30'].npcProfileVersion = 'unknown-npc-kit'; });
  reject(value => { const rules = JSON.parse(value.campaign.ruleset_json); rules.catalogVersion = 'unknown-catalog'; value.campaign.ruleset_json = JSON.stringify(rules); });
  reject(value => { value.npcs[0].source_id = 21; });
  reject(value => { value.npcs[0].name = 'A foreign campaign foe'; });
  reject(value => { value.locations[0].source_id = 31; });
  reject(value => { value.characters[0].health = 8; });
  reject(value => { value.class_runtime.world.actors['character:10'].abilities[0].definition_id = 'invented.definition'; });
  reject(value => { value.class_runtime.world.actors['character:10'].classState.declaration = { target: 'npc:999' }; });
  reject(value => { value.class_runtime.world.actors['character:10'].conditions.pinned = { actor: 'npc:20', condition: 'pinned', class: 'hindrance', detail: 'Mismatch', source: 'old', duration: 'scene', appliedTurn: 1 }; });
  reject(value => { value.class_runtime.world.actors['character:10'].classState.companion = { actorRef: 'npc:999' }; });
  reject(value => { value.class_runtime.world.actors['character:10'].classState.vehicle = { vehicleRef: 'vehicle:missing' }; });
  reject(value => { value.portability.character_ability_bindings = []; });
  reject(value => { value.portability.character_ability_bindings[0].source_profile_id = 999; });
  reject(value => { value.portability.character_ability_bindings.push(structuredClone(value.portability.character_ability_bindings[0])); });
  reject(value => { delete value.turns[0].rules_snapshot_json; });
  reject(value => { value.class_runtime.checks[0].campaignId = 9999; });
  reject(value => { value.class_runtime.checks[0].actor = 999; });
  reject(value => { value.class_runtime.checks[0].T += 1; });
  reject(value => { value.class_runtime.checks[0].annotationFinalized = false; });
  reject(value => { value.class_runtime.checks.push(structuredClone(value.class_runtime.checks[0])); });
  reject(value => { value.class_runtime.checks[0].annotation.effects[0].catalogVersion = 'unknown'; });
  reject(value => { value.class_runtime.checks[0].annotation.effects[0].pricingPrestate.hiddenPrompt = 'Foreign private content'; });
  reject(value => { value.class_runtime.checks[0].annotation.effects[0].pricingPrestate.amount = 99; });
  reject(value => { value.class_runtime.checks[0].annotation.effects[0].effectiveValence = 'adverse'; });
  reject(value => { const effect = value.class_runtime.checks[0].annotation.effects[0]; effect.weightClass = 'significant'; effect.pointCost = 2; });
  reject(value => { value.class_runtime.checks[0].annotation.effects[0].who = { hidden: 'not an actor reference' }; });
  reject(value => { const turn = JSON.parse(value.turns[0].state_changes_json); turn.dice_rolls[0].raw = 99; value.turns[0].state_changes_json = JSON.stringify(turn); });

  let registryId = 0;
  const maps = createClassReferenceMaps(bundle, { campaignId: 2000,
    characters: new Map([[10, 110]]), npcs: { 20: 120 }, locations: { 30: 130 }, profiles: { 100: 200 }, idFactory: () => `fresh-${++registryId}` });
  for (const ability of sheet.abilities) assert.equal(maps.abilities[ability.id], ability.id, 'Owned IDs are preserved by default.');
  const remapped = remapClassBundle(bundle, maps);
  const mappedWorld = remapped.class_runtime.world;
  assert.equal(mappedWorld.currentLocationId, 130);
  assert.equal(mappedWorld.actors['character:110'].health, 7);
  assert.equal(mappedWorld.actors['npc:120'].locationId, 130);
  assert.deepEqual(mappedWorld.turnOrder.order, ['character:110']);
  assert.ok(mappedWorld.scenarioFrames['scene:130']);
  assert.equal(mappedWorld.scenarioFrames['scene:130'].refs.actors.foe, 'npc:120');
  assert.equal(remapped.characters[0].source_profile_id, 200);
  assert.equal(remapped.npcs[0].source_id, 120);
  assert.equal(remapped.locations[0].source_id, 130);
  for (const item of Object.values(mappedWorld.items)) assert.equal(item.holder, 'character:110');
  assert.ok(Object.keys(mappedWorld.features).every(key => key.startsWith('feature:fresh-')));
  assert.ok(Object.values(mappedWorld.features).every(feature => feature.status === 'cleared' && feature.location === 130));
  const importedCheck = remapped.class_runtime.checks[0];
  assert.equal(importedCheck.actor, 110);
  assert.equal(importedCheck.campaignId, 2000);
  assert.equal(importedCheck.annotation.effects[0].who, 'npc:120');
  assert.deepEqual(importedCheck.sourceContext, { campaignId: 1000, actor: 10, turn: 1 });
  for (const key of ['checkId', 'T', 'raw', 'band', 'timestamp', 'intent']) assert.equal(importedCheck[key], runtime.checks[0][key]);
  assert.equal(importedCheck.annotation.text, runtime.checks[0].annotation.text);
  assert.equal(remapped.turns[0].player_action, bundle.turns[0].player_action);
  assert.equal(remapped.turns[0].narrative, bundle.turns[0].narrative);
  assert.equal(JSON.parse(remapped.turns[0].state_changes_json).scene_grounding, 'npc:20 is prose.');
  const remappedChanges = JSON.parse(remapped.turns[0].state_changes_json);
  assert.deepEqual(remappedChanges.quest_update, { active_quest: 'npc:20', quest_description: 'character:10' });
  assert.deepEqual(remappedChanges.arbitrary_prose, { actor: 10, detail: 'npc:20' });
  assert.equal(remappedChanges.rules_effects[0].who, 'npc:120');
  assert.deepEqual(remappedChanges.rules_events, [{ who: 'npc:120', detail: 'npc:20' }]);
  assert.equal(remappedChanges.rules_award.actor, 110);
  assert.equal(remapped.memories[0].summary, 'npc:20 is text.');
  assert.deepEqual(bundle, original, 'Remapping cannot mutate source identities.');
  const twice = remapClassBundle(remapped, createClassReferenceMaps(remapped, { campaignId: 3000,
    characters: { 110: 210 }, npcs: { 120: 220 }, locations: { 130: 230 }, profiles: { 200: 300 }, idFactory: () => `third-${++registryId}` }));
  assert.equal(twice.class_runtime.checks[0].actor, 210);
  assert.deepEqual(twice.class_runtime.checks[0].sourceContext, { campaignId: 1000, actor: 10, turn: 1 }, 'A subsequent import cannot rewrite original execution provenance.');
  assert.equal(twice.class_runtime.checks[0].checkId, runtime.checks[0].checkId);

  const missing = { ...maps, npcs: {} };
  assert.throws(() => remapClassBundle(bundle, missing), /Missing npcs identity mapping/);
  const duplicateItems = { ...maps, items: Object.fromEntries(Object.keys(maps.items).map(id => [id, 'item:collision'])) };
  if (Object.keys(duplicateItems.items).length > 1) assert.throws(() => remapClassBundle(bundle, duplicateItems), /Non-injective items/);
  const wrongType = { ...maps, features: Object.fromEntries(Object.keys(maps.features).map(id => [id, 'object:wrong'])) };
  assert.throws(() => remapClassBundle(bundle, wrongType), /wrong namespace/);
  const forked = forkClassBundle(bundle, 1);
  assert.equal(forked.turns.length, 1);
  assert.equal(forked.memories.length, 1);
  assert.equal(forked.characters[0].health, JSON.parse(bundle.turns[0].rules_snapshot_json).actors['character:10'].health);
  assert.deepEqual(forked.class_runtime.world.actors['character:10'].classState.sceneUses, {});
  assert.ok(Object.values(forked.class_runtime.world.features).every(feature => feature.status === 'active'));
  assert.equal(forked.pointers.turn_order.round, 1, 'Historical round comes from the exact snapshot.');
  assert.equal(forked.class_runtime.rulesRevision, 0, 'A new fork starts its own persistence revision, not future gameplay.');
  assert.throws(() => forkClassBundle(bundle, 99), /exact recorded/);
  assert.deepEqual(validateClassCharacterSnapshot(sheet, { ruleset: JSON.parse(bundle.campaign.ruleset_json) }), sheet);
  assert.throws(() => validateClassCharacterSnapshot({ ...sheet, bindings: [] }), /lacks its exact campaign binding/);

  const renamed = structuredClone(bundle);
  renamed.characters[0].name = 'Current name';
  renamed.class_runtime.world.actors['character:10'].name = 'Current name';
  const currentSnapshot = JSON.parse(renamed.turns[1].rules_snapshot_json); currentSnapshot.actors['character:10'].name = 'Current name';
  renamed.turns[1].rules_snapshot_json = JSON.stringify(currentSnapshot);
  assert.equal(forkClassBundle(renamed, 1).characters[0].name, 'Hero', 'Historical names are preserved rather than rebound from current projection.');
  const copied = structuredClone(bundle);
  const copiedActor = structuredClone(copied.class_runtime.world.actors['character:10']);
  copiedActor.name = 'Independent copy';
  copied.class_runtime.world.actors['character:11'] = copiedActor;
  copied.class_runtime.world.turnOrder.order.push('character:11');
  copied.characters.push({ ...structuredClone(copied.characters[0]), source_id: 11, source_profile_id: 101, name: copiedActor.name });
  const copySnapshot = JSON.parse(copied.turns[1].rules_snapshot_json);
  copySnapshot.actors['character:11'] = structuredClone(copiedActor);
  copySnapshot.turnOrder.order.push('character:11');
  copied.turns[1].rules_snapshot_json = JSON.stringify(copySnapshot);
  copied.portability.character_ability_bindings.push(...copied.portability.character_ability_bindings.map(binding => ({ ...binding, source_profile_id: 101, prose: `Copy: ${binding.prose}` })));
  copied.pointers.turn_order.order.push(11);
  assert.ok(validateClassBundle(copied), 'Independent character versions may retain identical owned IDs.');
  const copyMaps = createClassReferenceMaps(copied, { campaignId: 4000, characters: { 10: 410, 11: 411 }, npcs: { 20: 420 }, locations: { 30: 430 }, profiles: { 100: 500, 101: 501 }, idFactory: () => `copy-${++registryId}` });
  const copyImport = remapClassBundle(copied, copyMaps);
  assert.deepEqual(copyImport.class_runtime.world.actors['character:410'].abilities.map(ability => ability.id), copyImport.class_runtime.world.actors['character:411'].abilities.map(ability => ability.id));
  assert.ok(copyImport.portability.character_ability_bindings.filter(binding => binding.source_profile_id === 501).every(binding => binding.prose.startsWith('Copy: ')));
  const beforeCopy = forkClassBundle(copied, 1);
  assert.equal(beforeCopy.characters.length, 1);
  assert.ok(beforeCopy.portability.character_ability_bindings.every(binding => binding.source_profile_id === 100), 'Forking before a copied profile existed cannot retain its otherwise-identical owned bindings.');
  assert.equal(forkClassBundle(copied, 2).characters.length, 2);
  const roundTrip = JSON.parse(JSON.stringify(remapped));
  assert.deepEqual(validateClassBundle(roundTrip), remapped.class_runtime);
  assert.deepEqual(validatePortableRulesWorld(mappedWorld, JSON.parse(bundle.campaign.ruleset_json)), mappedWorld);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runClassPortabilityTests();
  console.log('Class portability tests passed.');
}
