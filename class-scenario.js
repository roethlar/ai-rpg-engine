import { CATALOG_SKILLS } from './class-catalog.js';
import { isDeepStrictEqual } from 'node:util';
import { validateRulesWorld } from './class-state.js';
import { BOONS, HINDRANCES, EFFECT_VALUES, effectComparisonKey } from './rules-effects.js';

export const CLASS_SCENE_VERSION = 1;
export const NPC_PROFILE_VERSION = 'npc-kits-1';

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

const brawl = { id: 'brawl', kind: 'attack', skill: 'melee', range: 'engaged', harm: 'graze', requires: 'none', tell: 'Closes to strike with an empty hand.' };
const strike = { id: 'strike', kind: 'attack', skill: 'melee', range: 'engaged', harm: 'wound', requires: 'melee_weapon', tell: 'Sets a weapon toward a nearby target before striking.' };
const shoot = { id: 'shoot', kind: 'attack', skill: 'ranged', range: 'near', harm: 'wound', requires: 'ranged_weapon', tell: 'Raises a ranged weapon and lines up a visible target.' };
const guard = { id: 'guard', kind: 'guard', skill: 'endure', range: 'self', condition: 'steadied', requires: 'none', tell: 'Plants their feet and commits to holding their ground.' };
const rally = { id: 'rally', kind: 'help', skill: 'leadership', range: 'near', condition: 'inspired', requires: 'none', tell: 'Calls to one visible ally before lending support.' };
const withdraw = { id: 'withdraw', kind: 'move', skill: 'move', range: 'adjacent', requires: 'none', tell: 'Turns toward a recorded neighboring area to withdraw.' };
const heavyStrike = { ...strike, id: 'heavy_strike', harm: 'grievous', tell: 'Draws a weapon back for a heavy close-range blow; distance denies it.' };
const mountedStrike = { ...brawl, id: 'mounted_strike', harm: 'wound', tell: 'Brings the mounted unit close enough to strike one opposing actor.' };
const hullStrike = { id: 'hull_strike', kind: 'vehicle_attack', skill: 'pilot', range: 'engaged', harm: 'wound', requires: 'none', tell: 'Lines up a close impact against one opposing mount or craft, not its passengers.' };

// These are asymmetric NPC kits, not player classes or model-authored effects.
export const NPC_PROFILES = freeze({
  combatant: { health: 18, skills: { melee: 8, endure: 5, move: 3 }, actions: [strike, brawl, guard, withdraw], defense: 'This combatant holds ground better than it pursues a moving target.' },
  ranged: { health: 14, skills: { ranged: 10, move: 5, notice: 5 }, actions: [shoot, brawl, withdraw], defense: 'This ranged combatant has no trained close-combat attack.' },
  support: { health: 14, skills: { leadership: 10, influence: 8, notice: 5 }, actions: [rally, brawl, withdraw], defense: 'This supporter has no trained weapon attack and must reach an ally to help.' },
  brute: { health: 28, skills: { melee: 8, endure: 10 }, actions: [heavyStrike, brawl, guard, withdraw], defense: 'This brute is durable but has no trained ranged attack or pursuit.' },
  boss: { health: 40, skills: { melee: 13, ranged: 8, endure: 13, leadership: 8 }, actions: [heavyStrike, shoot, rally, brawl, guard, withdraw], defense: 'This leader still spends one Main action; an attack cannot also rally an ally.' },
  mounted: { health: 36, scale: 'vehicle', skills: { melee: 8, pilot: 10, endure: 10 }, actions: [mountedStrike, hullStrike, guard, withdraw], defense: 'This mounted unit has vehicle scale and close-range impacts, but no ranged attack or independent mount turn.' }
});

const FEATURE_KINDS = ['obstruction', 'hazard', 'smoke', 'darkness', 'alarm', 'cover', 'passage'];
const REVEAL_SCOPES = ['quarry_route', 'combat_trait', 'defense_trait', 'leverage', 'motive', 'route', 'area_features', 'profile_senses', 'companion_scout'];
const AREA_TRAITS = ['visible', 'safe', 'visited', 'focus', 'anchor', 'teleport_ward', 'blocked', 'flight_blocked', 'space_for_wings', 'safe_recovery', 'immediate_threat'];
const SURFACES = ['ground', 'wall', 'ceiling', 'water'];
const ITEM_KINDS = ['melee_weapon', 'ranged_weapon', 'tool', 'mundane', 'revival_catalyst'];
export const SCENE_WEAPON_CATEGORIES = freeze({
  melee_weapon: { default: 'simple', allowed: ['simple', 'martial', 'heavy'] },
  ranged_weapon: { default: 'ranged', allowed: ['ranged'] }
});
const CONDITIONS = [...HINDRANCES, ...BOONS];
const DURATIONS = ['scene', 'persistent'];

export const CLASS_SCENE_CONTRACT = freeze({
  schemaVersion: CLASS_SCENE_VERSION,
  fields: {
    areas: [{ area: 'provided-area-id', terrain: 'dry_ground', traits: ['visible', 'safe', 'visited'], surfaces: ['ground'] }],
    actors: [{ actor: 'provided-actor-key', area: 'provided-area-id', allegiance: 'neutral', profile: 'combatant', conditions: [] }],
    items: [{ key: 'saber', name: 'Saber', description: 'A plain saber.', kind: 'melee_weapon', weaponCategory: 'simple', holder: { kind: 'actor', key: 'provided-actor-key' }, wielded: true, condition: 'pristine' }],
    objects: [{ key: 'gate-lock', name: 'Gate lock', area: 'provided-area-id', kind: 'lock', security: 'ordinary', opposed: false, locked: true, mapFeature: 0 }],
    features: [{ key: 'barrier', name: 'Barrier', area: 'provided-area-id', kind: 'cover', duration: 'persistent', worksAgainst: 'both', origin: 'mundane' }],
    discoveries: [{ key: 'gate-route', subject: { kind: 'area', key: 'provided-area-id' }, scope: 'route', fact: 'The gate connects to the courtyard.' }],
    encounter: { active: false, opposition: [] }
  },
  tokens: { npcProfiles: Object.keys(NPC_PROFILES), allegiance: ['party', 'neutral', 'opposition'], terrain: ['dry_ground', 'underwater'], areaTraits: AREA_TRAITS,
    surfaces: SURFACES, itemKinds: ITEM_KINDS, itemConditions: ['pristine', 'worn', 'damaged', 'broken'], objectKinds: ['lock', 'mechanism', 'scenery'],
    security: ['ordinary', 'protected'], featureKinds: FEATURE_KINDS, worksAgainst: ['party', 'opposition', 'both'], durations: DURATIONS,
    conditions: CONDITIONS, revealScopes: REVEAL_SCOPES, featureOrigins: ['mundane', 'magical', 'unknown'], weaponCategories: SCENE_WEAPON_CATEGORIES,
    injury: Object.keys(EFFECT_VALUES.harm),
    fallen: { age: ['recent', 'unknown'], body: ['intact', 'unknown', 'destroyed'], returnChoice: ['willing', 'unwilling', 'unknown'] } },
  rules: [
    'Return every required top-level field, even empty arrays. No additional fields, numbers for combat power, effect operations, or invented actor/area references.',
    'Include each provided area and actor exactly once. Actor area may be null for an absent NPC; player actors and engine-controlled companions use profile:null and allegiance:party.',
    'Only a newly introduced independent NPC may have optional fallen:{age:recent|unknown,body:intact|unknown|destroyed,returnChoice:willing|unwilling|unknown}. All three fields are required when present. Recent means the NPC falls in this authored scene; the engine owns health, status and death turn. Unknown age never invents a recent death. Return choice belongs to that NPC, never follows from party allegiance. Never supply fallen for a PC, controlled companion or already initialized NPC. Existing NPCs must retain their authored profile and mechanical state.',
    'A newly introduced present independent NPC with a visible existing injury may use injury:graze|wound|grievous. The engine subtracts that single existing harm grade from its authored health; never give numeric vitals. Injury cannot accompany fallen, apply to an absent NPC, or change a PC, controlled companion or already initialized NPC. Use it when the scene describes a wound that healing should actually mend.',
    'Each recorded map feature index must appear exactly once as mapFeature on an object or feature, with its recorded name and area unchanged. New non-map records omit mapFeature.',
    'A condition has exactly kind, duration, and detail (1-80 characters). Absent actors have no conditions. Do not imply consent through allegiance.',
    'A discovery has exact stored fact text (1-120 characters), one listed scope, and a recorded actor, area, or object subject. Fact text never grants permission or changes state.',
    'A lock has an explicit locked flag; mechanisms and scenery must use locked:false. Protected security cannot be unlocked or disabled by ordinary access powers.',
    'Held items require a provided actor holder or recorded area holder. Only a held weapon can be wielded. Items grant only their engine-defined kind, never numeric bonuses.',
    'Optional weaponCategory must match the typed weapon kind: melee permits simple, martial, or heavy and defaults to simple; ranged permits and defaults to ranged. Nonweapons omit it or use null. Display names never grant a weapon category.',
    'Active encounters list present opposition actors, never party or neutral actors. Inactive encounters have an empty opposition list.',
    'The mounted NPC profile represents a mounted or vehicle-scale opposing unit with one shared Main. Use it only when the established fiction supports that scale; never assign it merely to exercise a Rider ability. The engine supplies its scale, health and closed actor-or-hull attack options.',
    'Safe occupancy is not safe recovery. Only explicit safe_recovery permits a recovery opportunity; immediate_threat forbids it. These two traits cannot coexist in an area.',
    'Set feature origin explicitly to mundane or magical when known. Omitted origin is unknown; a name or feature kind never proves its origin.'
  ]
});

function invalid(message) {
  const error = new Error(message);
  error.code = 'CLASS_SCENE_INVALID';
  error.publicMessage = message;
  throw error;
}

function shape(value, required, optional = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) invalid('Scene entries must be plain objects.');
  if (required.some(key => !Object.hasOwn(value, key))
    || Object.keys(value).some(key => !required.includes(key) && !optional.includes(key))) invalid('Unknown or missing scene descriptor fields.');
  return value;
}

function list(value, label, maximum = 64) {
  if (!Array.isArray(value) || value.length > maximum) invalid(`Invalid ${label} list.`);
  return value;
}

function oneOf(value, values, label) {
  if (!values.includes(value)) invalid(`Invalid ${label}.`);
  return value;
}

function text(value, maximum, label) {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/u.test(value)) invalid(`Invalid ${label}.`);
  const normalized = value.normalize('NFC').trim().replace(/\s+/gu, ' ');
  if (!normalized || [...normalized].length > maximum) invalid(`Invalid ${label} length.`);
  return normalized;
}

function key(value) {
  if (typeof value !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,39}$/u.test(value)
    || ['constructor', 'prototype', '__proto__'].includes(value)) invalid('Invalid local scene key.');
  return value;
}

function unique(values, label) {
  if (new Set(values).size !== values.length) invalid(`Duplicate ${label}.`);
  return values;
}

function boolean(value, label) {
  if (typeof value !== 'boolean') invalid(`Invalid ${label}.`);
  return value;
}

function layoutContext(layout) {
  if (!layout || !Array.isArray(layout.areas) || !layout.areas.length) invalid('The scene requires recorded areas.');
  const areaIds = unique(list(layout.areas, 'layout areas', 16).map(area => {
    if (typeof area?.id !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/u.test(area.id)) invalid('Invalid recorded area id.');
    return area.id;
  }), 'recorded area');
  const mapFeatures = list(layout.features || [], 'map features', 64);
  for (const feature of mapFeatures) {
    if (!areaIds.includes(feature?.area)) invalid('A recorded map feature has an unknown area.');
    text(feature.name, 60, 'map feature name');
  }
  return { areaIds, mapFeatures };
}

/** Validate the model frame before opening a transaction or allocating NPC ids. */
export function validateClassSceneFrame(raw, { layout, actorKeys } = {}) {
  shape(raw, ['schemaVersion', 'areas', 'actors', 'items', 'objects', 'features', 'discoveries', 'encounter']);
  if (raw.schemaVersion !== CLASS_SCENE_VERSION) invalid('Unsupported scene descriptor version.');
  const { areaIds, mapFeatures } = layoutContext(layout);
  const knownActors = unique(list(actorKeys, 'provided actors').map(key), 'provided actor');
  const area = value => oneOf(value, areaIds, 'recorded area reference');
  const actor = value => oneOf(value, knownActors, 'provided actor reference');
  const stringTokens = (values, tokens, label) => unique(list(values, label, tokens.length).map(value => oneOf(value, tokens, label)), label);
  const areas = list(raw.areas, 'areas', 16).map(entry => {
    shape(entry, ['area', 'terrain', 'traits', 'surfaces']);
    const traits = stringTokens(entry.traits, AREA_TRAITS, 'area traits');
    if (traits.includes('safe_recovery') && traits.includes('immediate_threat')) invalid('Safe recovery cannot coexist with an immediate threat.');
    return { area: area(entry.area), terrain: oneOf(entry.terrain, ['dry_ground', 'underwater'], 'terrain'),
      traits, surfaces: stringTokens(entry.surfaces, SURFACES, 'surfaces') };
  });
  unique(areas.map(entry => entry.area), 'area descriptor');
  if (areas.length !== areaIds.length) invalid('Every recorded area requires one descriptor.');
  const actors = list(raw.actors, 'actors').map(entry => {
    shape(entry, ['actor', 'area', 'allegiance', 'profile', 'conditions'], ['fallen', 'injury']);
    const conditions = list(entry.conditions, 'conditions', CONDITIONS.length).map(condition => {
      shape(condition, ['kind', 'duration', 'detail']);
      return { kind: oneOf(condition.kind, CONDITIONS, 'condition'), duration: oneOf(condition.duration, DURATIONS, 'condition duration'), detail: text(condition.detail, 80, 'condition detail') };
    });
    unique(conditions.map(condition => condition.kind), 'actor condition');
    if (entry.area === null && conditions.length) invalid('Absent actors cannot acquire scene conditions.');
    let injury;
    if (Object.hasOwn(entry, 'injury')) {
      injury = oneOf(entry.injury, Object.keys(EFFECT_VALUES.harm), 'NPC injury grade');
      if (entry.area === null || Object.hasOwn(entry, 'fallen') || entry.profile === null) invalid('An injury requires a present living independent NPC.');
    }
    let fallen;
    if (Object.hasOwn(entry, 'fallen')) {
      shape(entry.fallen, ['age', 'body', 'returnChoice']);
      fallen = { age: oneOf(entry.fallen.age, ['recent', 'unknown'], 'fallen NPC age'),
        body: oneOf(entry.fallen.body, ['intact', 'unknown', 'destroyed'], 'fallen NPC body'),
        returnChoice: oneOf(entry.fallen.returnChoice, ['willing', 'unwilling', 'unknown'], 'fallen NPC return choice') };
    }
    return { actor: actor(entry.actor), area: entry.area === null ? null : area(entry.area),
      allegiance: oneOf(entry.allegiance, ['party', 'neutral', 'opposition'], 'allegiance'),
      profile: entry.profile === null ? null : oneOf(entry.profile, Object.keys(NPC_PROFILES), 'NPC profile'), conditions,
      ...(fallen ? { fallen } : {}), ...(injury ? { injury } : {}) };
  });
  unique(actors.map(entry => entry.actor), 'actor descriptor');
  if (actors.length !== knownActors.length) invalid('Every provided actor requires one descriptor.');
  const seenMapFeatures = new Set();
  function mapped(entry) {
    if (!Object.hasOwn(entry, 'mapFeature')) return {};
    const index = entry.mapFeature;
    if (!Number.isSafeInteger(index) || index < 0 || index >= mapFeatures.length || seenMapFeatures.has(index)) invalid('Invalid or duplicate map feature binding.');
    const feature = mapFeatures[index];
    if (entry.area !== feature.area || entry.name !== feature.name) invalid('A map feature binding must preserve its recorded area and name.');
    seenMapFeatures.add(index);
    return { mapFeature: index };
  }
  const objects = list(raw.objects, 'objects').map(entry => {
    shape(entry, ['key', 'name', 'area', 'kind', 'security', 'opposed', 'locked'], ['mapFeature']);
    const result = { key: key(entry.key), name: text(entry.name, 60, 'object name'), area: area(entry.area),
      kind: oneOf(entry.kind, ['lock', 'mechanism', 'scenery'], 'object kind'), security: oneOf(entry.security, ['ordinary', 'protected'], 'object security'),
      opposed: boolean(entry.opposed, 'object opposition'), locked: boolean(entry.locked, 'object lock'), ...mapped(entry) };
    if (result.kind !== 'lock' && result.locked) invalid('Only a lock may have locked state.');
    return result;
  });
  unique(objects.map(entry => entry.key), 'object key');
  const features = list(raw.features, 'features').map(entry => {
    shape(entry, ['key', 'name', 'area', 'kind', 'duration', 'worksAgainst'], ['mapFeature', 'origin']);
    return { key: key(entry.key), name: text(entry.name, 60, 'feature name'), area: area(entry.area),
      kind: oneOf(entry.kind, FEATURE_KINDS, 'feature kind'), duration: oneOf(entry.duration, DURATIONS, 'feature duration'),
      worksAgainst: oneOf(entry.worksAgainst, ['party', 'opposition', 'both'], 'feature side'),
      origin: entry.origin === undefined ? 'unknown' : oneOf(entry.origin, ['mundane', 'magical', 'unknown'], 'feature origin'), ...mapped(entry) };
  });
  unique(features.map(entry => entry.key), 'feature key');
  if (seenMapFeatures.size !== mapFeatures.length) invalid('Every recorded map feature must be materialized.');
  const subject = (entry, kinds) => {
    shape(entry, ['kind', 'key']);
    oneOf(entry.kind, kinds, 'subject kind');
    const value = entry.kind === 'actor' ? actor(entry.key) : entry.kind === 'area' ? area(entry.key)
      : oneOf(entry.key, objects.map(object => object.key), 'object subject');
    return { kind: entry.kind, key: value };
  };
  const items = list(raw.items, 'items').map(entry => {
    shape(entry, ['key', 'name', 'description', 'kind', 'holder', 'wielded', 'condition'], ['weaponCategory']);
    const result = { key: key(entry.key), name: text(entry.name, 80, 'item name'), description: text(entry.description, 300, 'item description'),
      kind: oneOf(entry.kind, ITEM_KINDS, 'item kind'), holder: subject(entry.holder, ['actor', 'area']),
      wielded: boolean(entry.wielded, 'item wielded'), condition: oneOf(entry.condition, ['pristine', 'worn', 'damaged', 'broken'], 'item condition') };
    const categories = SCENE_WEAPON_CATEGORIES[result.kind];
    if (categories) result.weaponCategory = oneOf(entry.weaponCategory ?? categories.default, categories.allowed, 'weapon category');
    else {
      if (entry.weaponCategory !== undefined && entry.weaponCategory !== null) invalid('Nonweapons cannot claim weapon training categories.');
      result.weaponCategory = null;
    }
    if (result.wielded && (result.holder.kind !== 'actor' || !['melee_weapon', 'ranged_weapon'].includes(result.kind))) invalid('Only a held weapon may be wielded.');
    if (result.holder.kind === 'actor' && actors.find(value => value.actor === result.holder.key).area === null) invalid('Scene items require a present holder.');
    return result;
  });
  unique(items.map(entry => entry.key), 'item key');
  const discoveries = list(raw.discoveries, 'discoveries', 128).map(entry => {
    shape(entry, ['key', 'subject', 'scope', 'fact']);
    return { key: key(entry.key), subject: subject(entry.subject, ['actor', 'area', 'object']),
      scope: oneOf(entry.scope, REVEAL_SCOPES, 'reveal scope'), fact: text(entry.fact, 120, 'discovery') };
  });
  unique(discoveries.map(entry => entry.key), 'discovery key');
  unique(discoveries.map(entry => effectComparisonKey(entry.fact)), 'discovery fact');
  shape(raw.encounter, ['active', 'opposition']);
  const encounter = { active: boolean(raw.encounter.active, 'encounter activity'), opposition: unique(list(raw.encounter.opposition, 'opposition').map(actor), 'opposition actor') };
  if (encounter.active !== (encounter.opposition.length > 0)) invalid('Encounter activity contradicts its opposition.');
  if (encounter.opposition.some(value => !actors.some(entry => entry.actor === value && entry.area !== null && !entry.fallen && entry.allegiance === 'opposition'))) invalid('An encounter requires present active opposition actors.');
  return { schemaVersion: CLASS_SCENE_VERSION, areas, actors, items, objects, features, discoveries, encounter };
}

/** Bind only engine-provided identities; no inference from actor/item names. */
export function buildClassScenario({ world, location, frame, actorBindings, turn = 1 } = {}) {
  validateRulesWorld(world);
  if (!Number.isSafeInteger(turn) || turn < 1) invalid('Invalid scene ledger turn.');
  if (location?.id !== world.currentLocationId) invalid('The scenario location must be the current recorded location.');
  shape(actorBindings, [], Object.keys(actorBindings || {}));
  const normalized = validateClassSceneFrame(frame, { layout: location.layout, actorKeys: Object.keys(actorBindings) });
  const refs = { actors: {}, areas: {}, items: {}, objects: {}, features: {} };
  const boundActors = new Set();
  for (const [name, ref] of Object.entries(actorBindings)) {
    if (typeof ref !== 'string' || !/^(character|npc):[1-9]\d*$/u.test(ref)
      || !Number.isSafeInteger(Number(ref.split(':')[1])) || !world.actors[ref] || boundActors.has(ref)) invalid('Actor bindings must identify distinct recorded actors.');
    boundActors.add(ref);
    refs.actors[name] = ref;
  }
  for (const entry of normalized.areas) {
    const ref = `area:${location.id}:${entry.area}`;
    if (!world.areas[ref]) invalid('A scene area is absent from the mechanical world.');
    refs.areas[entry.area] = ref;
  }
  const source = `scene:${location.id}`;
  if (Object.hasOwn(world.scenarioFrames || {}, source)) invalid('This scene frame was already applied; load its existing state.');
  const result = structuredClone(world);
  const subjectRef = subject => refs[`${subject.kind}s`][subject.key];
  for (const entry of normalized.areas) {
    const target = result.areas[refs.areas[entry.area]];
    for (const [field, trait] of Object.entries({ visible: 'visible', safeToOccupy: 'safe', visited: 'visited', focus: 'focus', anchor: 'anchor', teleportWard: 'teleport_ward', blocked: 'blocked', flightBlocked: 'flight_blocked', spaceForWings: 'space_for_wings', safeRecovery: 'safe_recovery', immediateThreat: 'immediate_threat' })) {
      target[field] = entry.traits.includes(trait);
    }
    target.terrain = entry.terrain;
    target.underwater = entry.terrain === 'underwater';
    target.dry_ground = entry.terrain === 'dry_ground';
    target.surfaces = [...entry.surfaces];
    target.supported = entry.surfaces.some(surface => surface === 'ground' || surface === 'water');
    target.knowledge ??= [];
  }
  for (const entry of normalized.actors) {
    const ref = refs.actors[entry.actor];
    const target = result.actors[ref];
    const engineControlled = ref.startsWith('character:') || !!target.controller;
    if (engineControlled && (entry.profile !== null || entry.allegiance !== 'party' || entry.area === null || entry.fallen || entry.injury)) invalid('Player and controlled actors retain their existing class authority, vitals and return choice.');
    if (!engineControlled) {
      if (!entry.profile) invalid('An independent NPC requires one authored profile.');
      const profile = NPC_PROFILES[entry.profile];
      const kit = { id: entry.profile, version: NPC_PROFILE_VERSION, mainActions: 1, actions: structuredClone(profile.actions), tells: profile.actions.map(action => action.tell) };
      if (target.npcKit) {
        if (entry.fallen || entry.injury || target.npcProfile !== entry.profile || !isDeepStrictEqual(target.npcKit, kit)) invalid('Existing NPCs retain their authored profile, vitals and return choice.');
      } else {
        target.health = entry.fallen ? 0 : profile.health - (entry.injury ? EFFECT_VALUES.harm[entry.injury] : 0);
        target.maxHealth = profile.health;
        target.skills = Object.fromEntries(CATALOG_SKILLS.map(skill => [skill, profile.skills[skill] || 0]));
        target.npcProfile = entry.profile;
        target.npcKit = kit;
        target.status = entry.fallen ? 'dead' : 'active';
        target.relationshipValue = target.relationshipValue ?? target.disposition ?? 0;
        target.wealth = 'comfortable';
        target.scale = profile.scale || 'person';
        if (entry.fallen) {
          target.deathAge = entry.fallen.age;
          target.bodyState = entry.fallen.body;
          target.returnChoice = entry.fallen.returnChoice;
          if (entry.fallen.age === 'recent') target.deathTurn = turn;
          else delete target.deathTurn;
          if (entry.fallen.body !== 'unknown') target.intactBody = entry.fallen.body === 'intact';
          else delete target.intactBody;
          if (entry.fallen.returnChoice !== 'unknown') target.willingReturn = entry.fallen.returnChoice === 'willing';
          else delete target.willingReturn;
        }
      }
    }
    target.party = entry.allegiance === 'party';
    target.allegiance = entry.allegiance;
    target.opposed = entry.allegiance === 'opposition';
    target.present = entry.area !== null;
    target.locationId = location.id;
    target.area = entry.area;
    if (normalized.encounter.opposition.includes(entry.actor) && (target.health <= 0 || target.status !== 'active')) invalid('An encounter requires living active opposition actors.');
    target.knowledge ??= [];
    target.conditions ??= {};
    for (const condition of entry.conditions) {
      if (target.conditions[condition.kind]) invalid('Scene conditions cannot overwrite an existing condition.');
      target.conditions[condition.kind] = { actor: ref, condition: condition.kind,
        class: HINDRANCES.includes(condition.kind) ? 'hindrance' : 'boon', duration: condition.duration,
        detail: condition.detail, source, appliedTurn: turn };
    }
  }
  for (const entry of normalized.objects) {
    const id = `object:${source}:${entry.key}`;
    if (result.objects[id]) invalid('Scene object identity is already recorded.');
    refs.objects[entry.key] = id;
    result.objects[id] = { id, name: entry.name, area: entry.area, locationId: location.id,
      kind: entry.kind, security: entry.security, protectedSystem: entry.security === 'protected',
      opposed: entry.opposed, locked: entry.locked, disabled: null, knowledge: [], source,
      ...(entry.mapFeature === undefined ? {} : { mapFeature: entry.mapFeature }) };
  }
  for (const entry of normalized.features) {
    const id = `feature:${source}:${entry.key}`;
    if (result.features[id]) invalid('Scene feature identity is already recorded.');
    refs.features[entry.key] = id;
    result.features[id] = { id, name: entry.name, area: refs.areas[entry.area], location: location.id,
      kind: entry.kind, duration: entry.duration, works_against: entry.worksAgainst, origin: entry.origin, status: 'active', source, appliedTurn: turn,
      ...(entry.mapFeature === undefined ? {} : { mapFeature: entry.mapFeature }) };
  }
  for (const entry of normalized.items) {
    const id = `item:${source}:${entry.key}`;
    if (result.items[id]) invalid('Scene item identity is already recorded.');
    refs.items[entry.key] = id;
    const weapon = ['melee_weapon', 'ranged_weapon'].includes(entry.kind);
    result.items[id] = { id, name: entry.name, description: entry.description, holder: subjectRef(entry.holder),
      type: weapon ? 'weapon' : entry.kind === 'tool' ? 'equipment' : 'general',
      kind: entry.kind === 'revival_catalyst' ? 'revival-catalyst' : entry.kind,
      class: entry.kind === 'revival_catalyst' ? 'significant' : 'mundane', condition: entry.condition,
      weapon, weaponKind: weapon ? entry.kind : null, weaponCategory: entry.weaponCategory, wielded: entry.wielded, equipped: entry.wielded,
      natural: false, fixed: false, lost: false, provenance: [{ kind: 'scene_authored', source }] };
  }
  for (const entry of normalized.discoveries) {
    const ref = subjectRef(entry.subject);
    const record = entry.subject.kind === 'actor' ? result.actors[ref] : entry.subject.kind === 'area' ? result.areas[ref] : result.objects[ref];
    const id = `${source}:${entry.key}`;
    if (record.knowledge.some(known => known.id === id) || result.facts.some(known => effectComparisonKey(known.fact) === effectComparisonKey(entry.fact))) invalid('A scene discovery is already known or recorded.');
    record.knowledge.push({ id, scope: entry.scope, fact: entry.fact, discovered: false, source });
  }
  if (result.encounter.active) invalid('Scene authoring cannot replace an active encounter.');
  result.encounter = { active: normalized.encounter.active, participants: normalized.encounter.opposition.map(name => refs.actors[name]),
    ...(normalized.encounter.active ? { posture: 'hostile', startedTurn: turn } : {}) };
  result.scenarioFrames = { ...(result.scenarioFrames || {}), [source]: { schemaVersion: CLASS_SCENE_VERSION, npcProfileVersion: NPC_PROFILE_VERSION, turn, refs: structuredClone(refs) } };
  validateRulesWorld(result);
  return { world: result, refs };
}
