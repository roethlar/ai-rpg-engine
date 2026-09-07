import { randomUUID } from 'node:crypto';
import {
  CATALOG_LEVEL_CAP, CATALOG_VERSION, CATALOG_OPTION_SET, CLASS_PROFILES, COMPANION_PROFILES, VEHICLE_PROFILES,
  buildClassLoadout, getAbilityDefinition, getClassBranch
} from './class-catalog.js';

const clone = value => structuredClone(value);
export const CLASS_XP_AWARDS = Object.freeze({ encounter: 25, objective: 50, milestone: 100 });

function fail(code, message) {
  const error = new Error(message); error.code = `CLASS_PROGRESSION_${code}`; throw error;
}

function character(state, actor) {
  const value = state?.actors?.[actor];
  if (!/^character:[1-9]\d*$/u.test(actor) || !value || value.classBuild?.catalogVersion !== CATALOG_VERSION
    || value.classBuild.optionSet !== CATALOG_OPTION_SET || !getClassBranch(value.classBuild.branchId)) fail('CHARACTER', 'An authored current-catalog character is required.');
  return value;
}

function contextId(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/u.test(value)) fail('IDENTITY', 'A stable engine-owned award or recovery ID is required.');
}

export function replaceClassVehicle({ state, actor, operationId } = {}) {
  contextId(operationId);
  const source = character(state, actor);
  const cs = source.classState;
  const previousRef = cs.vehicle?.vehicleRef;
  const previous = state.vehicles?.[previousRef];
  const area = state.areas?.[`area:${source.locationId}:${source.area}`];
  if (source.classBuild.familyId !== 'rider' || source.classBuild.capabilities?.rider !== true
    || !source.classBuild.modules?.includes('rider') || !previous || previous.operator !== actor) fail('CHARACTER', 'Only the assigned Rider can replace this craft.');
  if (source.tableStatus !== 'active' || state.turnOrder.order[state.turnOrder.currentIndex] !== actor
    || source.health <= 0 || source.status !== 'active' || !source.present || source.locationId !== state.currentLocationId
    || state.encounter.active || area?.safeRecovery !== true || area.immediateThreat === true) fail('SAFETY', 'Replacement requires your Main at a recorded safe recovery opportunity.');
  if (previous.hull !== 0 || previous.status !== 'lost' || previous.occupants?.length) fail('PRECONDITION', 'Only a genuinely lost, disembarked craft can be replaced.');
  const profile = VEHICLE_PROFILES[cs.vehicle.profile];
  const maximum = getClassBranch(source.classBuild.branchId).progression[source.level - 1].vehicleMaxHull;
  if (!profile || !Number.isSafeInteger(maximum)) fail('STATE', 'The assigned craft profile is invalid.');
  const ref = `vehicle:${actor.slice('character:'.length)}:${operationId}`;
  if (state.vehicles[ref]) fail('IDENTITY', 'The replacement identity is already recorded.');
  const next = clone(state);
  const craft = { id: ref, profile: profile.id, hull: maximum, maxHull: maximum, area: source.area,
    locationId: source.locationId, controller: actor, operator: actor, occupants: [actor], passengers: [],
    passengerCapacity: profile.passengerCapacity, scale: profile.scale, status: 'active', sharedMain: true,
    conditions: {}, replacementOf: previousRef, source: operationId };
  next.vehicles[ref] = craft;
  next.vehicles[previousRef].replacedBy = ref;
  next.actors[actor].classState.vehicle = { id: operationId, vehicleRef: ref, profile: profile.id,
    hull: maximum, maxHull: maximum, area: source.area, occupants: [actor], passengerCapacity: profile.passengerCapacity,
    scale: profile.scale, status: 'active', sharedMain: true, lastMainOperationId: operationId };
  next.actors[actor].classState.lastMainOperationId = operationId;
  return { state: next, applied: true, events: [{ type: 'vehicle_replaced', who: ref, previous: previousRef, actor }], effects: [] };
}

function targetLoadout(source, level, idFactory) {
  const branch = getClassBranch(source.classBuild.branchId);
  const entitled = branch.abilityDefinitionIds.filter(id => getAbilityDefinition(id).grantedAtLevel <= level);
  const existing = new Map(source.abilities.map(ability => [ability.definition_id, ability]));
  let position = 0;
  return buildClassLoadout({
    ...source.classBuild, level,
    idFactory: () => {
      const definitionId = entitled[position++];
      if (definitionId) return existing.get(definitionId)?.id || idFactory();
      return source.classState.companion?.id || source.classState.vehicle?.id || idFactory();
    }
  });
}

function updateHealthResource(actor) {
  if (!actor.resources?.health) return;
  actor.resources.health.current = actor.health;
  if (Object.hasOwn(actor.resources.health, 'max')) actor.resources.health.max = actor.maxHealth;
  if (Object.hasOwn(actor.resources.health, 'maximum')) actor.resources.health.maximum = actor.maxHealth;
}

export function advanceClassCharacter({ state, actor, award, awardId, idFactory = randomUUID } = {}) {
  contextId(awardId);
  if (!Object.hasOwn(CLASS_XP_AWARDS, award)) fail('AWARD', 'Choose an authored engine XP award, not an arbitrary numeric amount.');
  if (typeof idFactory !== 'function') fail('IDENTITY', 'idFactory must be a function.');
  const source = character(state, actor);
  if (!Number.isSafeInteger(source.xp) || source.xp < 0 || !Number.isSafeInteger(source.level) || source.level < 1 || source.level > CATALOG_LEVEL_CAP) fail('STATE', 'Existing progression values are invalid.');
  const history = source.classState.awards || {};
  if (Object.hasOwn(history, awardId)) {
    if (history[awardId] !== award) fail('IDENTITY', 'The award ID already identifies a different authored award.');
    return { state: clone(state), applied: false, levelsGained: 0, newAbilities: [], newBindings: [] };
  }
  const xp = source.xp + CLASS_XP_AWARDS[award];
  if (!Number.isSafeInteger(xp)) fail('STATE', 'XP would exceed safe integer storage.');
  const level = Math.min(CATALOG_LEVEL_CAP, Math.floor(xp / 100) + 1);
  if (level < source.level) fail('STATE', 'Existing XP and level contradict the authored progression.');
  const next = clone(state);
  const value = next.actors[actor];
  value.xp = xp;
  value.classState.awards = { ...history, [awardId]: award };
  if (level === source.level) return { state: next, applied: true, levelsGained: 0, newAbilities: [], newBindings: [] };
  const desired = targetLoadout(source, level, idFactory);
  const previous = targetLoadout(source, source.level, idFactory);
  const existing = new Map(source.abilities.map(ability => [ability.definition_id, ability]));
  const additions = desired.abilities.filter(ability => !existing.has(ability.definition_id));
  value.abilities = desired.abilities.map(ability => existing.has(ability.definition_id) ? clone(existing.get(ability.definition_id)) : ability);
  value.level = level;
  const missingHealth = source.maxHealth - source.health;
  value.maxHealth = desired.maxHealth;
  value.health = source.health === 0 || source.status === 'dead' ? 0 : Math.max(1, desired.maxHealth - missingHealth);
  const oldBase = source.classState.baseSkills || source.skills;
  const baseSkills = Object.fromEntries(Object.entries(desired.skills).map(([skill, bonus]) => [skill, Math.max(0, Math.min(75, bonus + (oldBase[skill] || 0) - (previous.skills[skill] || 0)))]));
  const profile = CLASS_PROFILES[source.classState.profile];
  value.skills = Object.fromEntries(Object.entries(baseSkills).map(([skill, bonus]) => [skill, Math.min(75, bonus + (profile?.skills[skill] || 0))]));
  if (source.classState.baseSkills) value.classState.baseSkills = baseSkills;
  for (const key of ['preparationCapacity', 'installationCapacity']) if (Object.hasOwn(desired.classState, key)) value.classState[key] = desired.classState[key];
  if (desired.classState.learned) value.classState.learned = desired.classState.learned;
  if (desired.classState.learnedProfiles) value.classState.learnedProfiles = desired.classState.learnedProfiles;
  if (Array.isArray(value.classState.prepared)) {
    const prepared = new Set(value.classState.prepared);
    for (const ability of additions) if (prepared.size < value.classState.preparationCapacity && getAbilityDefinition(ability.definition_id).activation === 'main') prepared.add(ability.definition_id);
    value.classState.prepared = [...prepared];
  }
  if (value.classState.companion?.actorRef) {
    const ref = value.classState.companion.actorRef;
    const companion = next.actors[ref];
    if (!companion) fail('STATE', 'The companion identity has no authoritative actor.');
    const branch = getClassBranch(value.classBuild.branchId);
    const maximum = branch.progression[level - 1].companionMaxHealth + COMPANION_PROFILES[value.classState.companion.profile].healthBonus;
    const missing = companion.maxHealth - companion.health;
    companion.maxHealth = maximum;
    companion.health = companion.health === 0 || companion.status === 'dead' ? 0 : Math.max(1, maximum - missing);
    Object.assign(value.classState.companion, { health: companion.health, maxHealth: companion.maxHealth });
  }
  if (value.classState.vehicle?.vehicleRef) {
    const vehicle = next.vehicles[value.classState.vehicle.vehicleRef];
    if (!vehicle) fail('STATE', 'The vehicle identity has no authoritative hull record.');
    const missing = vehicle.maxHull - vehicle.hull;
    vehicle.maxHull = desired.classState.vehicle.maxHull;
    vehicle.hull = vehicle.hull === 0 ? 0 : Math.max(1, vehicle.maxHull - missing);
    Object.assign(value.classState.vehicle, { hull: vehicle.hull, maxHull: vehicle.maxHull });
  }
  updateHealthResource(value);
  const newIds = new Set(additions.map(ability => ability.id));
  return { state: next, applied: true, levelsGained: level - source.level, newAbilities: clone(additions), newBindings: desired.bindings.filter(binding => newIds.has(binding.abilityId)) };
}

function safeDowntime(state, source) {
  if (state.encounter?.active || source.present === false || source.locationId !== state.currentLocationId || source.health <= 0 || source.status === 'dead') fail('TIMING', 'This change requires a living present character outside an encounter.');
}

export function recoverClassCharacter({ state, actor, recoveryId } = {}) {
  contextId(recoveryId);
  const source = character(state, actor);
  safeDowntime(state, source);
  const area = state.areas[`area:${source.locationId}:${source.area}`];
  if (area?.safeRecovery !== true || area.immediateThreat === true) fail('SAFETY', 'A recorded safe recovery opportunity is required; prose alone cannot create one.');
  if (source.classState.lastRecoveryId === recoveryId) return { state: clone(state), applied: false };
  const next = clone(state);
  const value = next.actors[actor];
  const strainSource = value.classState.strainConditionSource;
  value.health = value.maxHealth;
  Object.assign(value.classState, { sceneUses: {}, recoveryUses: {}, exposure: 0, reprisal: 0, strain: 0, brace: null, endure: null, opening: null, cue: null, quarry: null, declaration: null, ritual: null, stance: 'ready', lastRecoveryId: recoveryId });
  delete value.classState.strainConditionSource;
  for (const [token, record] of Object.entries(value.conditions || {})) if (record.duration === 'scene' || record.source === strainSource && token === 'winded') delete value.conditions[token];
  for (const pool of ['exposure', 'strain']) if (value.resources?.[pool]) value.resources[pool].current = 0;
  if (value.classState.companion?.actorRef) {
    const companion = next.actors[value.classState.companion.actorRef];
    if (!companion) fail('STATE', 'The recorded companion is missing.');
    if (companion.status !== 'dead') { companion.health = companion.maxHealth; companion.status = 'active'; }
    for (const [token, record] of Object.entries(companion.conditions || {})) if (record.duration === 'scene') delete companion.conditions[token];
    Object.assign(value.classState.companion, { health: companion.health, maxHealth: companion.maxHealth, status: companion.status, conditions: clone(companion.conditions) });
  }
  for (const installation of value.classState.installations || []) if (installation.status === 'active') {
    installation.status = 'retired'; installation.retiredBy = recoveryId;
    for (const ref of installation.features || []) if (next.features[ref]?.status === 'active') Object.assign(next.features[ref], { status: 'cleared', clearedBy: recoveryId });
  }
  updateHealthResource(value);
  return { state: next, applied: true };
}

export function configureClassPreparation({ state, actor, definitionIds } = {}) {
  const source = character(state, actor);
  safeDowntime(state, source);
  if (!['arcanist', 'maker'].includes(source.classBuild.familyId) || !Array.isArray(source.classState.prepared)) fail('CLASS', 'This class has no prepared loadout.');
  if (!Array.isArray(definitionIds) || new Set(definitionIds).size !== definitionIds.length || definitionIds.length < 1 || definitionIds.length > source.classState.preparationCapacity) fail('CAPACITY', 'Choose a nonempty unique loadout within authored capacity.');
  const owned = new Set(source.abilities.map(ability => ability.definition_id));
  for (const id of definitionIds) if (!owned.has(id) || getAbilityDefinition(id)?.activation !== 'main') fail('OWNERSHIP', 'Only owned immediate abilities may enter the prepared loadout.');
  const basicIds = source.abilities.filter(ability => getAbilityDefinition(ability.definition_id).grantedAtLevel === 1 && getAbilityDefinition(ability.definition_id).activation === 'main').map(ability => ability.definition_id);
  if (!basicIds.some(id => definitionIds.includes(id))) fail('FLOOR', 'Keep at least one basic immediate ability prepared.');
  const next = clone(state);
  next.actors[actor].classState.prepared = [...definitionIds];
  return { state: next, applied: true };
}

export function returnToBaseProfile({ state, actor, operationId } = {}) {
  contextId(operationId);
  const source = character(state, actor);
  if (source.health <= 0 || source.status === 'dead') fail('TIMING', 'An incapacitated character cannot change profile.');
  if (source.classBuild.familyId !== 'shifter' || !source.abilities.some(ability => getAbilityDefinition(ability.definition_id)?.mechanic.modifiers?.returnToBase)) fail('OWNERSHIP', 'An owned shape-return permission is required.');
  if (source.classState.profile === 'base') fail('NO_OP', 'The base profile is already active.');
  const next = clone(state);
  const value = next.actors[actor];
  value.skills = clone(value.classState.baseSkills || value.skills);
  value.classState.profile = 'base'; value.classState.lastMainOperationId = operationId;
  value.profileCapabilities = clone(CLASS_PROFILES.base);
  return { state: next, applied: true, consumeMain: true };
}

export function abandonClassRitual({ state, actor } = {}) {
  const source = character(state, actor);
  if (!source.classState.ritual) fail('NO_OP', 'There is no active ritual to abandon.');
  const next = clone(state); next.actors[actor].classState.ritual = null;
  return { state: next, applied: true };
}

export function clearClassSceneState(character, { sceneId = null } = {}) {
  if (!character?.classBuild || character.classBuild.catalogVersion !== CATALOG_VERSION || !character.classState) fail('CHARACTER', 'An authored portable character snapshot is required.');
  const next = clone(character);
  const cs = next.classState;
  Object.assign(cs, { sceneId, sceneUses: {}, exposure: 0, reprisal: 0, stance: 'ready', opening: null, quarry: null, cue: null, declaration: null, ritual: null, brace: null, endure: null, commitments: {}, installations: [] });
  delete cs.pendingReprisal;
  const persistent = records => Object.fromEntries(Object.entries(records || {}).filter(([, record]) => record.duration === 'persistent'));
  if (next.conditions) next.conditions = persistent(next.conditions);
  if (cs.companion) {
    delete cs.companion.actorRef; cs.companion.area = null;
    cs.companion.conditions = persistent(cs.companion.conditions);
    delete cs.companion.lastMainOperationId;
  }
  if (cs.vehicle) {
    delete cs.vehicle.vehicleRef; delete cs.vehicle.hold;
    cs.vehicle.area = null; cs.vehicle.occupants = [];
    if (cs.vehicle.conditions) cs.vehicle.conditions = persistent(cs.vehicle.conditions);
    delete cs.vehicle.lastMainOperationId;
  }
  for (const pool of ['exposure']) if (next.resources?.[pool]) next.resources[pool].current = 0;
  return next;
}
