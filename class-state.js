import { randomUUID } from 'node:crypto';
import { clearClassSceneState } from './class-progression.js';
import {
  ABILITY_FAMILIES, CATALOG_VERSION, CATALOG_RULES_VERSION, CATALOG_RESOLUTION_VERSION,
  CATALOG_EFFECT_VERSION, CATALOG_OPTION_SET, CLASS_EQUIPMENT, buildClassLoadout, getClassBranch
} from './class-catalog.js';

export const CLASS_WORLD_VERSION = 1;
export const CLASS_RULESET_ID = 'aetheria';

function invalid(message) {
  const error = new Error(message);
  error.code = 'CLASS_STATE_INVALID';
  error.publicMessage = message;
  throw error;
}

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(`Invalid ${label}.`);
  return value;
}

export function isClassRuleset(value) {
  return value?.id === CLASS_RULESET_ID;
}

export function validateClassSelection(raw, { genre = '', campaignRuleset = null } = {}) {
  object(raw, 'class selection');
  const keys = ['catalogVersion', 'optionSet', 'familyId', 'branchId', 'modules', 'capabilities'];
  if (Object.keys(raw).some(key => !keys.includes(key))) invalid('Invalid class selection fields.');
  if (raw.catalogVersion !== CATALOG_VERSION || raw.optionSet !== CATALOG_OPTION_SET) {
    invalid('This class catalog version or option set is unavailable.');
  }
  const modules = raw.modules ?? [];
  if (!Array.isArray(modules) || modules.some(value => value !== 'rider') || new Set(modules).size !== modules.length) {
    invalid('Invalid campaign modules.');
  }
  const capabilities = raw.capabilities ?? {};
  object(capabilities, 'campaign capabilities');
  if (Object.keys(capabilities).some(key => !['rider', 'alliedActors'].includes(key))
    || Object.values(capabilities).some(value => typeof value !== 'boolean')
    || (capabilities.rider !== undefined && capabilities.rider !== modules.includes('rider'))) {
    invalid('Invalid campaign capabilities.');
  }
  const selection = {
    catalogVersion: raw.catalogVersion, optionSet: raw.optionSet,
    familyId: raw.familyId, branchId: raw.branchId,
    modules: [...modules], capabilities: { rider: modules.includes('rider'), alliedActors: capabilities.alliedActors === true }
  };
  if (campaignRuleset) {
    validateClassRuleset(campaignRuleset);
    if (selection.catalogVersion !== campaignRuleset.catalogVersion || selection.optionSet !== campaignRuleset.optionSet
      || JSON.stringify([...selection.modules].sort()) !== JSON.stringify([...campaignRuleset.modules].sort())
      || selection.capabilities.alliedActors !== campaignRuleset.capabilities.alliedActors) {
      invalid('Class selection must use this campaign\'s pinned catalog and world support.');
    }
  }
  try { buildClassLoadout({ ...selection, genre }); }
  catch (error) { invalid(error.message); }
  return selection;
}

export function createClassRuleset(selection) {
  return {
    id: CLASS_RULESET_ID, name: 'Aetheria', schemaVersion: 1,
    catalogVersion: CATALOG_VERSION, rulesVersion: CATALOG_RULES_VERSION,
    resolutionVersion: CATALOG_RESOLUTION_VERSION, effectCatalogVersion: CATALOG_EFFECT_VERSION,
    optionSet: CATALOG_OPTION_SET, evidence: 'unverified',
    modules: [...selection.modules], capabilities: { ...selection.capabilities },
    resolution: 'Roll d100 to meet or exceed the target. Trained skills and the situation change the target; the engine records the result.',
    abilities: [], notes: 'Class powers use their authored costs and limits. Ordinary actions do not require a class power.'
  };
}

export function resolveClassSelection(raw, { profile = null, genre = '', campaignRuleset = null } = {}) {
  if (!profile) return validateClassSelection(raw, { genre, campaignRuleset });
  if (!profile.class_build_json) invalid('Legacy characters cannot be converted into authored classes.');
  let build;
  try { build = JSON.parse(profile.class_build_json); }
  catch { invalid('The saved class build is invalid JSON.'); }
  validateClassBuild(build, campaignRuleset);
  const selection = validateClassSelection(raw || {
    catalogVersion: build.catalogVersion, optionSet: build.optionSet, familyId: build.familyId,
    branchId: build.branchId, modules: campaignRuleset?.modules ?? build.modules,
    capabilities: campaignRuleset?.capabilities ?? build.capabilities
  }, { genre, campaignRuleset });
  if (selection.familyId !== build.familyId || selection.branchId !== build.branchId) {
    invalid('A saved character keeps its existing class. Select that class or create a new character.');
  }
  return selection;
}

export function validateClassRuleset(raw) {
  object(raw, 'Aetheria ruleset');
  if (raw.id !== CLASS_RULESET_ID || raw.schemaVersion !== 1 || raw.catalogVersion !== CATALOG_VERSION
    || raw.rulesVersion !== CATALOG_RULES_VERSION || raw.resolutionVersion !== CATALOG_RESOLUTION_VERSION
    || raw.effectCatalogVersion !== CATALOG_EFFECT_VERSION || raw.optionSet !== CATALOG_OPTION_SET
    || raw.evidence !== 'unverified' || !Array.isArray(raw.modules)
    || raw.modules.some(value => value !== 'rider') || new Set(raw.modules).size !== raw.modules.length
    || typeof raw.capabilities?.alliedActors !== 'boolean' || raw.capabilities.rider !== raw.modules.includes('rider')) {
    invalid('This campaign has an unsupported or inconsistent Aetheria rules version. No conversion was applied.');
  }
  return structuredClone(raw);
}

export function createClassSheet(selection, { genre = '', name, concept = '', level = 1, idFactory = randomUUID } = {}) {
  const loadout = buildClassLoadout({ ...selection, genre, level, idFactory });
  const classBuild = {
    schemaVersion: 1, familyId: loadout.familyId, branchId: loadout.branchId, ...loadout.pins,
    modules: [...selection.modules], capabilities: { ...selection.capabilities }, concept
  };
  return {
    name, class: loadout.classLabel, health: loadout.health, max_health: loadout.maxHealth,
    mana: 0, max_mana: 0, xp: loadout.xp, level: loadout.level,
    attributes: loadout.attributes, inventory: loadout.inventory, abilities: loadout.abilities,
    progression_notes: '', classBuild, classState: loadout.classState,
    skills: loadout.skills, resources: loadout.resources, bindings: loadout.bindings,
    equipmentPermissions: loadout.equipmentPermissions
  };
}

export function validateClassBuild(build, ruleset = null) {
  object(build, 'class build');
  if (build.schemaVersion !== 1 || build.catalogVersion !== CATALOG_VERSION
    || build.rulesVersion !== CATALOG_RULES_VERSION || build.resolutionVersion !== CATALOG_RESOLUTION_VERSION
    || build.effectCatalogVersion !== CATALOG_EFFECT_VERSION || build.optionSet !== CATALOG_OPTION_SET
    || !getClassBranch(build.familyId, build.branchId)) invalid('Unsupported saved class build.');
  validateClassSelection({
    familyId: build.familyId, branchId: build.branchId, catalogVersion: build.catalogVersion,
    optionSet: build.optionSet, modules: build.modules, capabilities: build.capabilities
  });
  if (ruleset) {
    validateClassRuleset(ruleset);
    validateClassSelection({
      familyId: build.familyId, branchId: build.branchId, catalogVersion: build.catalogVersion,
      optionSet: build.optionSet, modules: ruleset.modules, capabilities: ruleset.capabilities
    }, { campaignRuleset: ruleset });
  }
  return structuredClone(build);
}

export function classTriggerOptions(character) {
  if (!character.classBuild) return {};
  validateClassBuild(character.classBuild);
  return {
    familyRegistry: ABILITY_FAMILIES, catalogVersion: character.classBuild.catalogVersion,
    characterVersionId: character.player_character_id
  };
}

export function createRulesWorld({ location, characters = [], npcs = [] }) {
  if (!Number.isSafeInteger(location?.id) || location.id < 1 || !location.layout?.areas?.length) {
    invalid('Aetheria requires a recorded starting location with playable areas.');
  }
  const world = {
    schemaVersion: CLASS_WORLD_VERSION, catalogVersion: CATALOG_VERSION,
    effectCatalogVersion: CATALOG_EFFECT_VERSION, currentLocationId: location.id,
    actors: {}, areas: {}, items: {}, features: {}, objects: {}, vehicles: {}, facts: [],
    encounter: { active: false, participants: [] }, turnOrder: { order: [], currentIndex: 0, round: 1 }
  };
  for (const area of location.layout.areas) {
    const adjacent = new Set();
    for (const exit of location.layout.exits || []) {
      if (exit.from === area.id && location.layout.areas.some(candidate => candidate.id === exit.to)) adjacent.add(exit.to);
      if (exit.to === area.id && location.layout.areas.some(candidate => candidate.id === exit.from)) adjacent.add(exit.from);
    }
    world.areas[`area:${location.id}:${area.id}`] = {
      id: area.id, name: area.name, locationId: location.id, adjacent: [...adjacent], exits: [],
      visible: true, safeToOccupy: true, visited: true, focus: area.id === location.layout.areas[0].id,
      teleportWard: false, anchor: area.id === location.layout.areas[0].id, knowledge: []
    };
  }
  for (const npc of npcs) {
    const present = npc.area !== null && npc.area !== undefined;
    world.actors[`npc:${npc.id}`] = {
      name: npc.name, health: 18, maxHealth: 18, party: npc.party === true, present,
      locationId: location.id, area: present ? npc.area : null, conditions: {}, resources: {},
      status: 'active', inventory: [], knowledge: [], relationshipValue: npc.relationship_value ?? 0
    };
  }
  for (const character of characters) addClassActor(world, character);
  return world;
}

export function addClassActor(world, character, { area = null, companionActorRef = null } = {}) {
  validateClassBuild(character.classBuild);
  const ref = `character:${character.id}`;
  if (!Number.isSafeInteger(character.id) || character.id < 1 || world.actors[ref]) invalid('Invalid or duplicate character identity.');
  const locationAreas = Object.values(world.areas).filter(candidate => candidate.locationId === world.currentLocationId);
  area ??= locationAreas.find(candidate => candidate.focus)?.id ?? locationAreas[0]?.id;
  if (!locationAreas.some(candidate => candidate.id === area)) invalid('The character needs a recorded arrival area.');
  const classState = structuredClone(character.classState);
  if (classState.companion && (!/^npc:[1-9]\d*$/u.test(companionActorRef || '') || world.actors[companionActorRef])) {
    invalid('A bonded companion requires its own unused NPC identity.');
  }
  const resources = Object.fromEntries(Object.entries(character.resources || {}).filter(([key]) => key !== 'health')
    .map(([key, value]) => [key, { current: value.current, max: value.max ?? value.maximum }]));
  const actor = {
    name: character.name, class: character.class, health: character.health, maxHealth: character.max_health,
    party: true, present: true, locationId: world.currentLocationId, area,
    conditions: Object.fromEntries(Object.entries(character.conditions || {}).map(([token, condition]) =>
      [token, { ...structuredClone(condition), actor: ref }])), resources,
    status: character.health > 0 ? 'active' : 'downed', tableStatus: 'active', inventory: [], knowledge: [],
    classBuild: structuredClone(character.classBuild), classState, skills: structuredClone(character.skills),
    abilities: structuredClone(character.abilities), xp: character.xp, level: character.level,
    equipmentPermissions: structuredClone(character.equipmentPermissions || {})
  };
  world.actors[ref] = actor;
  world.turnOrder.order.push(ref);
  for (const item of character.inventory || []) {
    const carried = character.carriedItems?.find(record => record.id === item.id);
    if (carried) {
      const id = `item:${randomUUID()}`;
      world.items[id] = { ...structuredClone(carried), id, holder: ref,
        provenance: [...structuredClone(carried.provenance || []), { kind: 'character_arrival', owner: ref, previousId: carried.id }] };
      continue;
    }
    const equipmentId = item.equipmentId || item.id;
    const equipment = CLASS_EQUIPMENT[equipmentId];
    if (!equipment) { actor.inventory.push(structuredClone(item)); continue; }
    const id = `item:${randomUUID()}`;
    world.items[id] = {
      ...structuredClone(equipment), id, equipmentId, name: item.name, description: item.description || '', holder: ref,
      class: 'mundane', condition: 'pristine', provenance: [{ kind: 'class_start', owner: ref }],
      equipped: true
    };
  }
  if (classState.companion) {
    const companion = classState.companion;
    companion.actorRef = companionActorRef;
    companion.area = area;
    world.actors[companionActorRef] = {
      name: `${character.name}'s companion`, health: companion.health, maxHealth: companion.maxHealth,
      party: true, present: companion.status === 'active', locationId: world.currentLocationId, area,
      conditions: Object.fromEntries(Object.entries(companion.conditions || {}).map(([token, condition]) =>
        [token, { ...structuredClone(condition), actor: companionActorRef }])),
      resources: {}, inventory: [], knowledge: [], status: companion.status,
      controller: ref, profile: companion.profile, sharedMain: true
    };
  }
  if (classState.vehicle) {
    const vehicle = classState.vehicle;
    vehicle.vehicleRef = `vehicle:${character.id}:${vehicle.id}`;
    vehicle.area = area;
    vehicle.occupants = [ref];
    world.vehicles[vehicle.vehicleRef] = {
      ...structuredClone(vehicle), id: vehicle.vehicleRef, controller: ref, operator: ref, conditions: {},
      locationId: world.currentLocationId, area, passengers: [ref], sharedMain: true
    };
  }
  return ref;
}

export function restoreClassSheet(profile, ruleset) {
  if (!profile?.class_build_json || !profile.class_state_json) {
    invalid('Legacy characters cannot be converted into authored classes. Choose a compatible saved class character.');
  }
  let build;
  let snapshot;
  try {
    build = JSON.parse(profile.class_build_json);
    snapshot = JSON.parse(profile.class_state_json);
  } catch { invalid('The saved class character is not valid JSON.'); }
  validateClassBuild(build, ruleset);
  object(snapshot, 'saved class snapshot');
  if (JSON.stringify(snapshot.classBuild) !== JSON.stringify(build)
    || !Array.isArray(snapshot.abilities) || !Array.isArray(snapshot.bindings)
    || !Number.isSafeInteger(snapshot.level) || snapshot.level < 1 || snapshot.level > 10
    || !Number.isSafeInteger(snapshot.health) || snapshot.health < 0
    || !Number.isSafeInteger(snapshot.max_health) || snapshot.health > snapshot.max_health) {
    invalid('The saved class character snapshot is incomplete or inconsistent.');
  }
  return clearClassSceneState({ ...snapshot, name: profile.name, class: profile.archetype });
}

export function validateRulesWorld(world, ruleset = null) {
  object(world, 'mechanical world');
  if (world.schemaVersion !== CLASS_WORLD_VERSION || world.catalogVersion !== CATALOG_VERSION
    || world.effectCatalogVersion !== CATALOG_EFFECT_VERSION || !Number.isSafeInteger(world.currentLocationId)
    || world.currentLocationId < 1) invalid('Unsupported or invalid mechanical world version.');
  for (const key of ['actors', 'areas', 'items', 'features', 'objects', 'vehicles', 'encounter']) object(world[key], key);
  if (!Array.isArray(world.facts) || typeof world.encounter.active !== 'boolean') invalid('Invalid world facts or encounter.');
  if (!Array.isArray(world.turnOrder?.order) || new Set(world.turnOrder.order).size !== world.turnOrder.order.length
    || !Number.isSafeInteger(world.turnOrder.currentIndex) || world.turnOrder.currentIndex < 0
    || world.turnOrder.currentIndex >= Math.max(1, world.turnOrder.order.length)
    || !Number.isSafeInteger(world.turnOrder.round) || world.turnOrder.round < 1) invalid('Invalid world turn order.');
  for (const [ref, actor] of Object.entries(world.actors)) {
    if (!/^(character|npc):[1-9]\d*$/u.test(ref) || !Number.isSafeInteger(actor.health)
      || !Number.isSafeInteger(actor.maxHealth) || actor.health < 0 || actor.maxHealth < 1
      || actor.health > actor.maxHealth || typeof actor.party !== 'boolean') invalid('Invalid stored actor.');
    if (actor.present && !world.areas[`area:${actor.locationId}:${actor.area}`]) invalid('Stored actor area is missing.');
    if (ref.startsWith('character:')) {
      validateClassBuild(actor.classBuild, ruleset);
      if (!['active', 'released'].includes(actor.tableStatus)
        || world.turnOrder.order.includes(ref) !== (actor.tableStatus === 'active')) invalid('Actor membership contradicts the world turn order.');
    }
  }
  if (world.turnOrder.order.some(ref => !ref.startsWith('character:') || !world.actors[ref])) invalid('World turn order refers to a missing character.');
  return world;
}

export function projectClassCharacter(character, world) {
  validateRulesWorld(world);
  const actor = world.actors[`character:${character.id}`];
  if (!actor) invalid('This character has no authoritative rules state.');
  const inventory = [
    ...structuredClone(actor.inventory),
    ...Object.values(world.items).filter(item => item.holder === `character:${character.id}` && !item.lost)
      .map(item => ({ id: item.id, ...(item.equipmentId ? { equipmentId: item.equipmentId } : {}), name: item.name, description: item.description, type: item.type,
        quantity: 1, condition: item.condition, equipped: item.equipped === true }))
  ];
  const carriedItems = Object.values(world.items).filter(item => item.holder === `character:${character.id}` && !item.lost)
    .map(item => structuredClone(item));
  const resources = {
    health: { current: actor.health, maximum: actor.maxHealth },
    ...Object.fromEntries(Object.entries(actor.resources).map(([key, value]) => [key, { current: value.current, maximum: value.max }]))
  };
  return {
    ...character, health: actor.health, max_health: actor.maxHealth, mana: 0, max_mana: 0,
    level: actor.level, xp: actor.xp, inventory, abilities: structuredClone(actor.abilities),
    classBuild: structuredClone(actor.classBuild), classState: structuredClone(actor.classState),
    skills: structuredClone(actor.skills), resources, conditions: structuredClone(actor.conditions),
    area: actor.area, equipmentPermissions: structuredClone(actor.equipmentPermissions || {}), carriedItems
  };
}
