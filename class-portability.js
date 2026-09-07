import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { validateClassBuild, validateClassRuleset, validateRulesWorld, isClassRuleset } from './class-state.js';
import { getAbilityDefinition, getClassBranch } from './class-catalog.js';
import { CLASS_SCENE_VERSION, NPC_PROFILE_VERSION } from './class-scenario.js';
import { normalizeCheckRecord, STAKES_BUDGETS } from './rules-resolution.js';
import { EFFECT_CATALOG_VERSION, EFFECT_VALUES, SUPPORTED_EFFECT_OPERATIONS } from './rules-effects.js';

export const CLASS_BUNDLE_VERSION = 1;
const NAMESPACES = ['characters', 'npcs', 'locations', 'items', 'features', 'objects', 'vehicles'];
const TEXT_FIELDS = new Set(['name', 'class', 'description', 'detail', 'fact', 'text', 'narrative', 'intent', 'tierBasis', 'reason', 'prose', 'term', 'aliases', 'notes', 'summary', 'keywords', 'player_action', 'scene_grounding', 'progression_notes', 'source', 'clearedBy', 'retiredBy', 'operationId', 'requestId', 'checkId', 'sourceContext', 'knowledgeId']);
const EFFECT_FIELDS = {
  harm: ['who', 'grade'], heal: ['who', 'grade'], pool_drain: ['who', 'pool', 'depth'], pool_restore: ['who', 'pool', 'depth'],
  item_lose: ['item', 'owner?'], item_gain: ['owner', 'name'], item_transfer: ['item', 'from', 'to'], item_drop: ['item', 'area'], item_pickup: ['owner', 'item'], item_condition_shift: ['item', 'direction', 'to?'], wealth_shift: ['who', 'direction', 'to?'],
  disposition_improve: ['npc', 'step'], disposition_worsen: ['npc', 'step'], reposition: ['who', 'area', 'quality'], scene_exit: ['who', 'quality'], hindrance_apply: ['who', 'condition', 'duration', 'detail'], boon_apply: ['who', 'condition', 'duration', 'detail'], condition_clear: ['who', 'condition'],
  scene_feature_place: ['area', 'kind', 'name', 'duration', 'works_against'], scene_feature_clear: ['feature'], encounter_start: ['posture', 'outcome', 'participants'], encounter_end: ['outcome'], fact_learn: ['fact'], location_transition: ['location', 'area'], actor_status: ['who', 'status'],
  disarm: ['who', 'item'], item_consume: ['owner', 'item', 'quantity'], object_disable: ['object', 'maximumSecurity', 'duration'], object_unlock: ['object', 'maximumSecurity'], reveal: ['subject', 'scope', 'maximum'], revive: ['who', 'health', 'maximumElapsedTurns', 'condition', 'duration'], teleport: ['who', 'area', 'maximumAreas', 'mode'], traverse: ['who', 'area', 'mode', 'maximumDistance'], vehicle_repair: ['who', 'amount'], vehicle_harm: ['who', 'grade'], vehicle_condition_apply: ['who', 'condition', 'duration', 'detail']
};
const PRICING_FIELDS = {
  harm: ['health', 'maxHealth', 'amount', 'appliedAmount', 'floor?'], heal: ['health', 'maxHealth', 'amount', 'appliedAmount'],
  pool_drain: ['current', 'max'], pool_restore: ['current', 'max'], item_gain: ['quantity'], item_lose: null,
  item_transfer: ['holder', 'class'], item_drop: ['holder', 'class'], item_pickup: ['holder', 'class'], item_condition_shift: ['condition', 'class'], wealth_shift: ['wealth'], disposition_improve: ['relationshipValue'], disposition_worsen: ['relationshipValue'], reposition: ['area'], scene_exit: ['area'], hindrance_apply: [], boon_apply: [], condition_clear: ['condition'], scene_feature_place: [], scene_feature_clear: ['duration', 'works_against'], encounter_start: ['encounter'], encounter_end: ['encounter'], fact_learn: [], location_transition: ['locationId'], actor_status: ['status', 'health'], disarm: ['holder', 'wielded', 'class'], item_consume: ['holder', 'kind', 'class'], object_disable: ['security', 'locked', 'disabled'], object_unlock: ['security', 'locked', 'disabled'], reveal: ['undiscoveredIds'], revive: ['health', 'status', 'deathTurn'], teleport: ['travelers'], traverse: ['travelers'], vehicle_repair: ['hull', 'maxHull'], vehicle_harm: ['hull', 'maxHull', 'amount', 'appliedAmount'], vehicle_condition_apply: []
};
const ANNOTATION_OPERATIONS = new Set(Object.keys(EFFECT_FIELDS).slice(0, Object.keys(EFFECT_FIELDS).indexOf('location_transition')));

function fail(message) {
  const error = new Error(message);
  error.code = 'CLASS_PORTABILITY_INVALID';
  error.publicMessage = message;
  throw error;
}

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail(`Invalid ${label}.`);
  return value;
}

function exact(value, fields, label) {
  object(value, label);
  const allowed = fields.map(field => field.replace(/\?$/u, ''));
  if (fields.some(field => !field.endsWith('?') && !Object.hasOwn(value, field)) || Object.keys(value).some(key => !allowed.includes(key))) fail(`Invalid ${label} fields.`);
}

function integer(value, label, minimum = 1) {
  if (!Number.isSafeInteger(value) || value < minimum) fail(`Invalid ${label}.`);
  return value;
}

function clone(value) {
  const ancestors = new Set();
  function visit(item) {
    if (item === null || ['string', 'boolean'].includes(typeof item)) return;
    if (typeof item === 'number' && Number.isFinite(item)) return;
    if (typeof item !== 'object' || ancestors.has(item)) fail('Portable class data must be acyclic JSON.');
    if (!Array.isArray(item)) object(item, 'JSON value');
    ancestors.add(item);
    for (const child of Array.isArray(item) ? Array.from(item) : Object.values(item)) visit(child);
    ancestors.delete(item);
  }
  visit(value);
  return structuredClone(value);
}

function parsed(value, label) {
  if (typeof value !== 'string') return object(value, label);
  try { return object(JSON.parse(value), label); }
  catch { fail(`Invalid ${label} JSON.`); }
}

function array(value, label) {
  if (!Array.isArray(value) || value.length > 100000) fail(`Invalid ${label} collection.`);
  return value;
}

function rulesetOf(bundle) {
  const source = bundle.campaign?.ruleset_json ?? bundle.ruleset;
  if (source === null || source === undefined) return null;
  return parsed(source, 'bundle ruleset');
}

function table(rows, label) {
  const result = new Map();
  for (const row of array(rows, label)) {
    object(row, `${label} row`);
    integer(row.source_id, `${label} source identity`);
    if (result.has(row.source_id)) fail(`Duplicate ${label} source identity.`);
    result.set(row.source_id, row);
  }
  return result;
}

function refParts(ref) {
  if (typeof ref !== 'string') return null;
  let match = /^(character|npc|location):([1-9]\d*)$/u.exec(ref);
  if (match) return { namespace: { character: 'characters', npc: 'npcs', location: 'locations' }[match[1]], id: integer(Number(match[2]), 'reference identity'), prefix: match[1] };
  match = /^area:([1-9]\d*):([A-Za-z0-9_-]+)$/u.exec(ref);
  if (match) return { namespace: 'locations', id: integer(Number(match[1]), 'area location identity'), prefix: 'area', area: match[2] };
  match = /^(item|feature|object|vehicle):([A-Za-z0-9][A-Za-z0-9_.:-]*)$/u.exec(ref);
  if (match) return { namespace: `${match[1]}s`, id: ref, prefix: match[1] };
  if (/^(character|npc|location|area|item|feature|object|vehicle):/u.test(ref)) fail('Malformed structured rules reference.');
  return null;
}

function ownedAbilities(actor) {
  validateClassBuild(actor.classBuild);
  integer(actor.level, 'class actor level');
  if (actor.level > 10) fail('Unsupported class actor level.');
  const branch = getClassBranch(actor.classBuild.familyId, actor.classBuild.branchId);
  const expected = branch.abilityDefinitionIds.filter(id => getAbilityDefinition(id).grantedAtLevel <= actor.level);
  const definitions = new Set();
  const ids = new Set();
  for (const ability of array(actor.abilities, 'owned abilities')) {
    object(ability, 'owned ability');
    if (typeof ability.id !== 'string' || !ability.id || ability.id.length > 128 || ids.has(ability.id)) fail('Invalid or duplicate owned ability identity.');
    const definition = getAbilityDefinition(ability.definition_id, ability.definition_version);
    if (!definition || !expected.includes(definition.id) || definitions.has(definition.id)) fail('Owned ability definition is unknown, foreign, duplicate or not granted at this level.');
    ids.add(ability.id);
    definitions.add(definition.id);
  }
  if (definitions.size !== expected.length) fail('Class snapshot is missing authored owned ability grants.');
  return ids;
}

function checkCondition(record, ref, token, vehicle = false) {
  exact(record, [vehicle ? 'vehicle' : 'actor', 'condition', 'class', 'detail', 'source', 'duration', 'appliedTurn'], 'condition record');
  const hindrance = ['hindered', 'exposed', 'dazed', 'pinned', 'winded'].includes(token);
  if ((!hindrance && !['steadied', 'inspired', 'concealed'].includes(token))
    || record[vehicle ? 'vehicle' : 'actor'] !== ref || record.condition !== token
    || record.class !== (hindrance ? 'hindrance' : 'boon') || !['scene', 'persistent'].includes(record.duration)
    || typeof record.detail !== 'string' || typeof record.source !== 'string') fail('Condition record contradicts its owner, token or duration.');
  if (vehicle && (token !== 'steadied' || record.duration !== 'scene')) fail('Unsupported vehicle condition.');
  integer(record.appliedTurn, 'condition applied turn');
}

function visitReferences(value, visit, field = '') {
  if (TEXT_FIELDS.has(field)) return;
  if (typeof value === 'string') { const ref = refParts(value); if (ref) visit(value, ref); return; }
  if (value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach(item => visitReferences(item, visit, field)); return; }
  for (const [key, child] of Object.entries(value)) {
    const ref = refParts(key);
    if (ref) visit(key, ref);
    visitReferences(child, visit, key);
  }
}

/** Validate complete world-owned class identities and every structured reference.
 * Foreign artifact row binding is checked separately by validateClassBundle.
 */
export function validatePortableRulesWorld(raw, ruleset) {
  const world = clone(raw);
  validateRulesWorld(world, ruleset);
  for (const name of ['objects', 'vehicles']) object(world[name], name);
  const locations = new Set();
  for (const [ref, area] of Object.entries(world.areas)) {
    const parts = refParts(ref);
    if (parts?.prefix !== 'area' || parts.id !== area.locationId || parts.area !== area.id) fail('Area record identity is inconsistent.');
    locations.add(parts.id);
    for (const adjacent of array(area.adjacent, 'area adjacency')) if (!world.areas[`area:${area.locationId}:${adjacent}`]) fail('Area adjacency is dangling.');
    array(area.exits, 'area exits');
  }
  if (!locations.has(world.currentLocationId)) fail('Current location has no recorded area.');
  for (const [key, frame] of Object.entries(world.scenarioFrames ?? {})) {
    const match = /^scene:([1-9]\d*)$/u.exec(key);
    if (!match || !locations.has(Number(match[1])) || frame.schemaVersion !== CLASS_SCENE_VERSION
      || frame.npcProfileVersion !== NPC_PROFILE_VERSION) fail('Scenario frame has an unknown version or dangling location.');
  }
  for (const [ref, actor] of Object.entries(world.actors)) {
    if (actor.locationId !== null && actor.locationId !== undefined && !locations.has(actor.locationId)) fail('Actor location is dangling.');
    if (typeof actor.present !== 'boolean' || !['active', 'downed', 'dead'].includes(actor.status)) fail('Actor presence or status is invalid.');
    object(actor.conditions, 'actor conditions');
    for (const [token, record] of Object.entries(actor.conditions)) checkCondition(record, ref, token);
    if (ref.startsWith('character:')) {
      if (!['active', 'released'].includes(actor.tableStatus)) fail('Class snapshot lacks historical table membership.');
      ownedAbilities(actor);
      object(actor.classState, 'class state');
      if (actor.classState.familyId !== actor.classBuild.familyId || actor.classState.branchId !== actor.classBuild.branchId) fail('Class state belongs to a different class build.');
      if (actor.classState.companion) {
        const companion = actor.classState.companion;
        if (!/^npc:[1-9]\d*$/u.test(companion.actorRef || '') || world.actors[companion.actorRef]?.controller !== ref) fail('Companion reference or controller is dangling.');
      }
      if (actor.classState.vehicle) {
        const vehicle = world.vehicles[actor.classState.vehicle.vehicleRef];
        if (!vehicle || (vehicle.operator ?? vehicle.controller) !== ref) fail('Vehicle reference or operator is dangling.');
      }
    }
  }
  for (const tableName of ['items', 'features', 'objects', 'vehicles']) {
    for (const [ref, record] of Object.entries(world[tableName])) {
      const parts = refParts(ref);
      if (parts?.namespace !== tableName || (record.id !== undefined && record.id !== ref)) fail('World registry identity is inconsistent.');
      if (tableName !== 'objects' && record.id === undefined) fail('World registry is missing its recorded identity.');
      if (record.locationId !== undefined && !locations.has(record.locationId)) fail('Registry location is dangling.');
      if (tableName === 'items') {
        if (!refParts(record.holder) || !['character', 'npc', 'area'].includes(refParts(record.holder).prefix)) fail('Item custody is invalid.');
        if (Object.hasOwn(record, 'quantity') || !Array.isArray(record.provenance)) fail('Durable item shape is invalid.');
      }
      if (tableName === 'features') {
        if (!['active', 'cleared'].includes(record.status) || !['scene', 'persistent'].includes(record.duration)
          || refParts(record.area)?.id !== record.location) fail('Feature state or location is invalid.');
      }
      if (tableName === 'vehicles') {
        for (const [token, condition] of Object.entries(record.conditions ?? {})) checkCondition(condition, ref, token, true);
      }
    }
  }
  visitReferences(world, (ref, parts) => {
    const exists = parts.prefix === 'area' ? world.areas[ref]
      : parts.prefix === 'location' ? locations.has(parts.id)
        : ['character', 'npc'].includes(parts.prefix) ? world.actors[ref] : world[parts.namespace]?.[ref];
    if (!exists) fail(`Dangling structured reference ${ref}.`);
  });
  return world;
}

function validateEffectArtifact(effect) {
  if (!SUPPORTED_EFFECT_OPERATIONS.includes(effect?.op) || !EFFECT_FIELDS[effect.op]) fail('Historical effect operation is unsupported.');
  exact(effect, ['op', ...EFFECT_FIELDS[effect.op], 'catalogVersion', 'weightClass', 'pointCost', 'effectiveValence', 'resolvedTargets', 'pricingPrestate'], 'historical effect');
  if (effect.catalogVersion !== EFFECT_CATALOG_VERSION || !['minor', 'significant'].includes(effect.weightClass)
    || effect.pointCost !== (effect.weightClass === 'minor' ? 1 : 2) || !['beneficial', 'adverse', 'neutral'].includes(effect.effectiveValence)) fail('Historical effect catalog or pricing is invalid.');
  exact(effect.resolvedTargets, ['who?', 'owner?', 'item?', 'from?', 'to?', 'area?', 'holder?', 'npc?', 'feature?', 'participants?', 'location?', 'travelers?', 'object?', 'subject?', 'operator?'], 'resolved effect targets');
  exact(effect.pricingPrestate, PRICING_FIELDS[effect.op] ?? (effect.owner ? ['quantity'] : ['holder', 'class']), 'effect pricing prestate');
  for (const field of EFFECT_FIELDS[effect.op].map(name => name.replace(/\?$/u, ''))) {
    if (!Object.hasOwn(effect, field)) continue;
    const value = effect[field];
    if (field === 'participants' || field === 'who' && Array.isArray(value)) {
      if (array(value, 'effect actor references').some(ref => !['character', 'npc'].includes(refParts(ref)?.prefix))) fail('Invalid effect actor reference collection.');
    } else if (!['string', 'number'].includes(typeof value)) fail('Invalid historical effect parameter type.');
  }
  for (const value of Object.values(effect.resolvedTargets)) {
    const refs = Array.isArray(value) ? value : [value];
    if (refs.some(ref => !refParts(ref))) fail('Invalid resolved effect target.');
  }
  const prestate = effect.pricingPrestate;
  for (const [field, value] of Object.entries(prestate)) {
    if (['condition', 'floor', 'encounter', 'disabled', 'travelers', 'undiscoveredIds'].includes(field)) continue;
    if (value !== null && !['string', 'number', 'boolean'].includes(typeof value)) fail('Invalid historical pricing value.');
  }
  if (['harm', 'heal', 'vehicle_harm'].includes(effect.op)) {
    const values = effect.op === 'heal' ? EFFECT_VALUES.heal : EFFECT_VALUES.harm;
    const current = prestate[effect.op === 'vehicle_harm' ? 'hull' : 'health'];
    const maximum = prestate[effect.op === 'vehicle_harm' ? 'maxHull' : 'maxHealth'];
    integer(current, 'historical vitality', 0); integer(maximum, 'historical maximum vitality');
    integer(prestate.appliedAmount, 'historical applied amount', 0);
    if (current > maximum || prestate.amount !== values[effect.grade] || prestate.appliedAmount > prestate.amount
      || prestate.appliedAmount > (effect.op === 'heal' ? maximum - current : current)) fail('Historical vitality pricing is inconsistent.');
  }
  if (prestate.condition && typeof prestate.condition === 'object') checkCondition(prestate.condition, effect.who, effect.condition);
  if (prestate.floor) exact(prestate.floor, ['effectIndex', 'who', 'minimum', 'sourceAbilityId', 'definitionId', 'definitionVersion'], 'harm floor provenance');
  if (prestate.encounter) exact(prestate.encounter, ['active', 'participants', 'posture?', 'startedTurn?', 'endedTurn?', 'source?'], 'encounter prestate');
  if (prestate.disabled) exact(prestate.disabled, ['duration', 'source', 'appliedTurn'], 'disabled object prestate');
  if (prestate.travelers) for (const traveler of array(prestate.travelers, 'traveler prestate')) exact(traveler, ['who', 'area'], 'traveler prestate');
}

/** Add source provenance once to fresh checks; never rebind it on later forks. */
export function validateClassCheckArtifact(raw, { campaignId } = {}) {
  const value = clone(raw);
  integer(campaignId, 'artifact campaign');
  const record = normalizeCheckRecord(value);
  exact(value, [...Object.keys(record), 'campaignId', 'operationId', 'annotationFinalized', 'sourceContext?'], 'immutable check artifact');
  if (value.campaignId !== campaignId || typeof value.operationId !== 'string' || !value.operationId
    || typeof value.annotationFinalized !== 'boolean') fail('Check artifact belongs to another campaign or lacks its operation identity.');
  if (record.stakesLicense !== null && !value.annotationFinalized) fail('Unfinalized checks cannot be exported as historical artifacts.');
  let cost = 0;
  for (const effect of record.annotation?.effects ?? []) {
    validateEffectArtifact(effect);
    if (!ANNOTATION_OPERATIONS.has(effect.op)
      || effect.effectiveValence !== (record.band === 'crit_success' ? 'beneficial' : 'adverse')) fail('Historical annotation exceeds its consumer or valence permission.');
    cost += effect.pointCost;
  }
  if (cost > (STAKES_BUDGETS[record.stakesLicense] ?? 0)) fail('Historical annotation exceeds its committed stakes budget.');
  const sourceContext = value.sourceContext ?? { campaignId, actor: record.actor, turn: record.turn };
  exact(sourceContext, ['campaignId', 'actor', 'turn'], 'original check source context');
  integer(sourceContext.campaignId, 'original campaign identity');
  integer(sourceContext.actor, 'original actor identity');
  if (sourceContext.turn !== record.turn) fail('Check provenance contradicts its immutable ledger turn.');
  return { ...record, campaignId, operationId: value.operationId, annotationFinalized: value.annotationFinalized, sourceContext: clone(sourceContext) };
}

/** Version-4 class extension validation. Legacy bundles remain untouched and
 * return null; a target ruleset without its extension is never downgraded.
 */
export function validateClassBundle(rawBundle) {
  let ruleset;
  try { ruleset = rulesetOf(rawBundle); }
  catch {
    if (rawBundle?.class_runtime !== undefined && rawBundle.class_runtime !== null) fail('A class runtime artifact requires a valid matching target ruleset.');
    return null;
  }
  if (!isClassRuleset(ruleset)) {
    if (rawBundle.class_runtime !== undefined && rawBundle.class_runtime !== null) fail('A class runtime artifact requires its matching target ruleset.');
    return null;
  }
  const bundle = clone(rawBundle);
  validateClassRuleset(ruleset);
  if (bundle.kind !== 'aetheria-campaign' || bundle.format_version !== 4) fail('Target class campaigns require campaign bundle format version 4.');
  const runtime = bundle.class_runtime;
  exact(runtime, ['schemaVersion', 'sourceCampaignId', 'rulesRevision', 'world', 'checks'], 'class runtime envelope');
  if (runtime.schemaVersion !== CLASS_BUNDLE_VERSION) fail('Unsupported class bundle schema.');
  integer(runtime.sourceCampaignId, 'source campaign identity');
  integer(runtime.rulesRevision, 'rules revision', 0);
  runtime.world = validatePortableRulesWorld(runtime.world, ruleset);
  const manifests = { characters: table(bundle.characters, 'character'), npcs: table(bundle.npcs, 'NPC'), locations: table(bundle.locations, 'location') };
  const turns = new Map();
  const worlds = [runtime.world];
  for (const row of array(bundle.turns, 'turns')) {
    integer(row.turn_number, 'turn number');
    if (turns.has(row.turn_number)) fail('Duplicate target turn number.');
    const world = validatePortableRulesWorld(parsed(row.rules_snapshot_json ?? row.rules_snapshot, 'turn rules snapshot'), ruleset);
    worlds.push(world);
    turns.set(row.turn_number, { row, world });
    if (row.source_character_id !== null && row.source_character_id !== undefined
      && !world.actors[`character:${integer(row.source_character_id, 'acting character')}`]) fail('Turn actor is absent from its exact snapshot.');
  }
  if (!turns.size) fail('Target class bundle has no turn snapshots.');
  for (const world of worlds) {
    for (const [ref, actor] of Object.entries(world.actors)) {
      const parts = refParts(ref);
      const row = manifests[parts.namespace].get(parts.id);
      if (!row || world === runtime.world && row.name !== actor.name) fail('Mechanical actor belongs to a different or missing bundle artifact.');
    }
    for (const area of Object.values(world.areas)) {
      const row = manifests.locations.get(area.locationId);
      const layout = row && parsed(row.layout_json ?? row.layout, 'location layout');
      if (!layout?.areas?.some(candidate => candidate.id === area.id)) fail('Mechanical area belongs to a different or missing location artifact.');
    }
  }
  for (const [sourceId, row] of manifests.characters) {
    const actor = runtime.world.actors[`character:${sourceId}`];
    if (!actor) fail('Character artifact lacks an authoritative class actor.');
    const abilities = typeof row.abilities_json === 'string' ? JSON.parse(row.abilities_json) : row.abilities;
    if (!isDeepStrictEqual(abilities, actor.abilities) || row.health !== actor.health || row.max_health !== actor.maxHealth
      || row.level !== actor.level || row.xp !== actor.xp || (row.status ?? 'active') !== actor.tableStatus) fail('Character artifact disagrees with its authoritative class snapshot.');
  }
  const charactersByProfile = new Map();
  for (const [id, row] of manifests.characters) {
    integer(row.source_profile_id, 'class profile identity');
    if (charactersByProfile.has(row.source_profile_id)) fail('Class profile identity is shared by different character artifacts.');
    charactersByProfile.set(row.source_profile_id, runtime.world.actors[`character:${id}`]);
  }
  const bindingIds = new Set();
  for (const binding of array(bundle.portability?.character_ability_bindings, 'class campaign bindings')) {
    const actor = charactersByProfile.get(binding.source_profile_id);
    const key = `${binding.source_profile_id}:${binding.ability_id}`;
    if (!actor?.abilities.some(ability => ability.id === binding.ability_id) || bindingIds.has(key)) fail('Campaign binding is foreign, dangling or duplicate.');
    if (typeof binding.term !== 'string' || !binding.term.trim() || typeof binding.prose !== 'string' || !binding.prose.trim()) fail('Campaign binding has no preserved wording.');
    bindingIds.add(key);
  }
  for (const [profile, actor] of charactersByProfile) {
    for (const ability of actor.abilities) if (ability.invocation && !bindingIds.has(`${profile}:${ability.id}`)) fail('Invocable class ability lacks its preserved campaign binding.');
  }
  const ids = new Set();
  const logicalKeys = new Set();
  runtime.checks = array(runtime.checks, 'historical checks').map(raw => {
    const check = validateClassCheckArtifact(raw, { campaignId: runtime.sourceCampaignId });
    const turn = turns.get(check.turn);
    if (!turn || turn.row.source_character_id !== check.actor) fail('Check artifact is foreign to its owning turn.');
    const key = `${check.turn}:${check.actor}:${check.callSeq}`;
    if (ids.has(check.checkId) || logicalKeys.has(key)) fail('Duplicate immutable check identity.');
    ids.add(check.checkId); logicalKeys.add(key);
    visitReferences(check.annotation?.effects ?? [], ref => {
      const parts = refParts(ref);
      const exists = parts.prefix === 'area' ? turn.world.areas[ref]
        : parts.prefix === 'location' ? Object.values(turn.world.areas).some(area => area.locationId === parts.id)
          : ['character', 'npc'].includes(parts.prefix) ? turn.world.actors[ref] : turn.world[parts.namespace]?.[ref];
      if (!exists) fail('Historical effect has a dangling reference in its exact turn snapshot.');
    });
    for (const ref of check.annotation?.affirmedOpposed ?? []) if (!turn.world.actors[ref] || turn.world.actors[ref].party) fail('Historical opposition reference is foreign or party-aligned.');
    return check;
  });
  const checksById = new Map(runtime.checks.map(check => [check.checkId, check]));
  for (const { row } of turns.values()) {
    const changes = row.state_changes_json === undefined && row.state_changes === undefined ? {} : parsed(row.state_changes_json ?? row.state_changes, 'turn state changes');
    for (const raw of array(changes.dice_rolls ?? [], 'turn roll projections')) {
      const check = normalizeCheckRecord(raw);
      const artifact = checksById.get(check.checkId);
      if (!artifact || artifact.turn !== row.turn_number || !isDeepStrictEqual(check, normalizeCheckRecord(artifact))) fail('Turn roll projection disagrees with its immutable check artifact.');
    }
  }
  return runtime;
}

function mappingValue(map, key, label) {
  const exists = map instanceof Map ? map.has(key) || map.has(String(key)) : map && Object.hasOwn(map, key);
  const value = map instanceof Map ? map.get(key) ?? map.get(String(key)) : map?.[key];
  if (!exists) fail(`Missing ${label} identity mapping.`);
  return value;
}

function allWorlds(bundle, runtime) {
  return [runtime.world, ...bundle.turns.map(row => parsed(row.rules_snapshot_json ?? row.rules_snapshot, 'turn rules snapshot'))];
}

/** Allocate only registry aliases. Numeric row identities come from the caller's
 * transaction; owned ability IDs default to identity mappings, preserving the
 * character-version ownership contract. No definition ID is ever reminted.
 */
export function createClassReferenceMaps(bundle, { campaignId, characters, npcs, locations, profiles, abilities, idFactory = randomUUID }) {
  const runtime = validateClassBundle(bundle);
  if (!runtime) return null;
  integer(campaignId, 'destination campaign identity');
  const maps = { campaignId, characters, npcs, locations, profiles, abilities: {}, items: {}, features: {}, objects: {}, vehicles: {} };
  for (const world of allWorlds(bundle, runtime)) {
    for (const name of ['items', 'features', 'objects', 'vehicles']) {
      for (const ref of Object.keys(world[name])) {
        if (!Object.hasOwn(maps[name], ref)) {
          const value = idFactory();
          if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/u.test(value)) fail('Registry identity factory returned an invalid identity.');
          maps[name][ref] = `${name.slice(0, -1)}:${value}`;
        }
      }
    }
    for (const actor of Object.values(world.actors)) {
      for (const ability of actor.abilities ?? []) {
        maps.abilities[ability.id] = abilities ? mappingValue(abilities, ability.id, 'ability') : ability.id;
      }
    }
  }
  validateMappings(bundle, runtime, maps);
  return maps;
}

function validateMappings(bundle, runtime, maps) {
  object(maps, 'reference maps');
  integer(maps.campaignId, 'destination campaign identity');
  const required = Object.fromEntries([...NAMESPACES, 'abilities', 'profiles'].map(name => [name, new Set()]));
  for (const name of ['characters', 'npcs', 'locations']) for (const row of bundle[name]) required[name].add(row.source_id);
  for (const row of bundle.characters) if (row.source_profile_id !== null && row.source_profile_id !== undefined) required.profiles.add(row.source_profile_id);
  for (const world of allWorlds(bundle, runtime)) {
    for (const name of ['items', 'features', 'objects', 'vehicles']) Object.keys(world[name]).forEach(ref => required[name].add(ref));
    for (const actor of Object.values(world.actors)) for (const ability of actor.abilities ?? []) required.abilities.add(ability.id);
  }
  for (const [name, keys] of Object.entries(required)) {
    const values = new Set();
    for (const key of keys) {
      const value = mappingValue(maps[name], key, name);
      if (['characters', 'npcs', 'locations', 'profiles'].includes(name)) integer(value, `destination ${name} identity`);
      else if (name === 'abilities') {
        if (typeof value !== 'string' || !value || value.length > 128) fail('Invalid mapped owned ability identity.');
      } else if (refParts(value)?.namespace !== name) fail('Mapped registry reference has the wrong namespace.');
      if (name !== 'abilities' && values.has(value)) fail(`Non-injective ${name} mapping would merge independent identities.`);
      values.add(value);
    }
  }
  for (const world of allWorlds(bundle, runtime)) for (const actor of Object.values(world.actors)) {
    const ids = (actor.abilities ?? []).map(ability => mappingValue(maps.abilities, ability.id, 'ability'));
    if (new Set(ids).size !== ids.length) fail('Non-injective ability mapping would merge one character version owned abilities.');
  }
}

function remapper(maps) {
  const ref = value => {
    const parts = refParts(value);
    if (!parts) return value;
    const target = mappingValue(maps[parts.namespace], parts.id, parts.namespace);
    return parts.prefix === 'area' ? `area:${target}:${parts.area}`
      : ['character', 'npc', 'location'].includes(parts.prefix) ? `${parts.prefix}:${target}` : target;
  };
  function walk(value, field = '') {
    if (TEXT_FIELDS.has(field)) return clone(value);
    if (typeof value === 'number') {
      if (['locationId', 'currentLocationId', 'location'].includes(field)) return mappingValue(maps.locations, value, 'location');
      if (['actor', 'characterId', 'character_id', 'source_character_id'].includes(field)) return mappingValue(maps.characters, value, 'character');
      if (['npcId', 'npc_id'].includes(field)) return mappingValue(maps.npcs, value, 'NPC');
      if (field === 'campaignId') return maps.campaignId;
      return value;
    }
    if (typeof value === 'string') {
      if (['abilityId', 'ability_id', 'sourceAbilityId'].includes(field)) return mappingValue(maps.abilities, value, 'ability');
      return ref(value);
    }
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(item => walk(item, field));
    const result = {};
    for (const [key, child] of Object.entries(value)) {
      const mappedKey = refParts(key) ? ref(key) : key;
      if (Object.hasOwn(result, mappedKey)) fail('Reference remapping collided within an object.');
      result[mappedKey] = walk(child, key);
    }
    return result;
  }
  const world = raw => {
    const mapped = walk(raw);
    if (raw.scenarioFrames) mapped.scenarioFrames = Object.fromEntries(Object.entries(raw.scenarioFrames)
      .map(([key, frame]) => [`scene:${mappingValue(maps.locations, Number(key.slice(6)), 'scenario location')}`, walk(frame)]));
    for (const [oldRef, actor] of Object.entries(raw.actors)) {
      if (!actor.abilities) continue;
      mapped.actors[ref(oldRef)].abilities = actor.abilities.map(ability => ({ ...clone(ability), id: mappingValue(maps.abilities, ability.id, 'ability') }));
    }
    return mapped;
  };
  return { ref, walk, world };
}

/** Remap a validated target bundle without touching prose. Returns a new full
 * bundle. Engine import owns SQL insertion and the outer transaction; historical
 * check artifacts belong in rules_history_json, never the live check PK table.
 */
export function remapClassBundle(rawBundle, maps) {
  const runtime = validateClassBundle(rawBundle);
  if (!runtime) return structuredClone(rawBundle);
  validateMappings(rawBundle, runtime, maps);
  const bundle = clone(rawBundle);
  const mapper = remapper(maps);
  const remapChanges = raw => Object.fromEntries(Object.entries(raw).map(([key, value]) => [key,
    ['dice_rolls', 'rules_effects', 'rules_events', 'rules_award'].includes(key) ? mapper.walk(value) : clone(value)]));
  bundle.class_runtime = {
    ...runtime, sourceCampaignId: maps.campaignId, world: mapper.world(runtime.world),
    checks: runtime.checks.map(check => mapper.walk(check))
  };
  for (const row of bundle.characters) {
    row.source_id = mappingValue(maps.characters, row.source_id, 'character');
    if (row.source_profile_id !== null && row.source_profile_id !== undefined) row.source_profile_id = mappingValue(maps.profiles, row.source_profile_id, 'profile');
    const actor = bundle.class_runtime.world.actors[`character:${row.source_id}`];
    if (typeof row.abilities_json === 'string') row.abilities_json = JSON.stringify(actor.abilities);
    else row.abilities = clone(actor.abilities);
    if (row.class_build_json !== undefined) row.class_build_json = JSON.stringify(actor.classBuild);
    if (row.classBuild !== undefined) row.classBuild = clone(actor.classBuild);
    for (const field of ['inventory_json', 'baseline_json']) {
      if (typeof row[field] === 'string') {
        const original = JSON.parse(row[field]);
        const remapped = mapper.walk(original);
        if (field === 'baseline_json' && Array.isArray(original.abilities)) remapped.abilities = original.abilities.map(ability => ({ ...clone(ability), id: mappingValue(maps.abilities, ability.id, 'ability') }));
        row[field] = JSON.stringify(remapped);
      }
    }
  }
  for (const row of bundle.npcs) row.source_id = mappingValue(maps.npcs, row.source_id, 'NPC');
  for (const row of bundle.locations) row.source_id = mappingValue(maps.locations, row.source_id, 'location');
  for (const row of bundle.turns) {
    if (row.source_character_id !== null && row.source_character_id !== undefined) row.source_character_id = mappingValue(maps.characters, row.source_character_id, 'turn character');
    const snapshot = mapper.world(parsed(row.rules_snapshot_json ?? row.rules_snapshot, 'turn rules snapshot'));
    if (typeof row.rules_snapshot_json === 'string') row.rules_snapshot_json = JSON.stringify(snapshot);
    else row.rules_snapshot = snapshot;
    if (row.ability_invocations) row.ability_invocations = mapper.walk(row.ability_invocations);
    if (typeof row.state_changes_json === 'string') row.state_changes_json = JSON.stringify(remapChanges(parsed(row.state_changes_json, 'turn state changes')));
    else if (row.state_changes) row.state_changes = remapChanges(row.state_changes);
  }
  if (bundle.portability?.character_ability_bindings) {
    for (const binding of bundle.portability.character_ability_bindings) {
      binding.source_profile_id = mappingValue(maps.profiles, binding.source_profile_id, 'binding profile');
      binding.ability_id = mappingValue(maps.abilities, binding.ability_id, 'binding ability');
    }
  }
  if (bundle.pointers?.turn_order?.order) bundle.pointers.turn_order.order = bundle.pointers.turn_order.order.map(id => mappingValue(maps.characters, id, 'turn-order character'));
  validateClassBundle(bundle);
  return bundle;
}

/** Select an exact historical target snapshot. The engine then creates fresh
 * physical rows and calls remapClassBundle; no future progression, cadence or
 * ability grant is replayed backward from the current character projection.
 */
export function forkClassBundle(rawBundle, turnNumber) {
  const runtime = validateClassBundle(rawBundle);
  if (!runtime) fail('Legacy forks must use their existing lifecycle.');
  integer(turnNumber, 'fork turn');
  const sourceTurn = rawBundle.turns.find(turn => turn.turn_number === turnNumber);
  if (!sourceTurn) fail('Fork requires an exact recorded target turn snapshot.');
  const bundle = clone(rawBundle);
  const world = validatePortableRulesWorld(parsed(sourceTurn.rules_snapshot_json ?? sourceTurn.rules_snapshot, 'fork rules snapshot'), rulesetOf(bundle));
  bundle.turns = bundle.turns.filter(turn => turn.turn_number <= turnNumber);
  bundle.class_runtime = { ...runtime, world, rulesRevision: 0, checks: runtime.checks.filter(check => check.turn <= turnNumber) };
  bundle.characters = bundle.characters.filter(row => world.actors[`character:${row.source_id}`]).map(row => {
    const actor = world.actors[`character:${row.source_id}`];
    const inventory = [...clone(actor.inventory), ...Object.values(world.items).filter(item => item.holder === `character:${row.source_id}` && !item.lost)
      .map(item => ({ id: item.id, name: item.name, description: item.description, type: item.type, quantity: 1, condition: item.condition, equipped: item.equipped === true }))];
    return { ...row, name: actor.name, class: actor.class, health: actor.health, max_health: actor.maxHealth,
      mana: 0, max_mana: 0, xp: actor.xp, level: actor.level, status: actor.tableStatus,
      ...(typeof row.abilities_json === 'string' ? { abilities_json: JSON.stringify(actor.abilities) } : { abilities: clone(actor.abilities) }),
      ...(typeof row.inventory_json === 'string' ? { inventory_json: JSON.stringify(inventory) } : { inventory }),
      ...(row.class_build_json !== undefined ? { class_build_json: JSON.stringify(actor.classBuild) } : {}) };
  });
  if (!bundle.characters.some(row => row.status === 'active')) fail('Fork snapshot has no active player character.');
  bundle.npcs = bundle.npcs.filter(row => world.actors[`npc:${row.source_id}`]).map(row => ({ ...row, name: world.actors[`npc:${row.source_id}`].name }));
  const retainedLocations = new Set(Object.values(world.areas).map(area => area.locationId));
  bundle.locations = bundle.locations.filter(row => retainedLocations.has(row.source_id));
  bundle.memories = (bundle.memories ?? []).filter(row => row.turn_number === null || row.turn_number <= turnNumber);
  const abilityIds = new Set(bundle.characters.flatMap(row => world.actors[`character:${row.source_id}`].abilities.map(ability => `${row.source_profile_id}:${ability.id}`)));
  if (bundle.portability?.character_ability_bindings) bundle.portability.character_ability_bindings = bundle.portability.character_ability_bindings.filter(binding => abilityIds.has(`${binding.source_profile_id}:${binding.ability_id}`));
  if (bundle.pointers) {
    const cursor = world.turnOrder;
    if (!cursor) fail('Fork snapshot lacks exact historical turn ownership.');
    bundle.pointers.turn_order = { order: cursor.order.map(ref => refParts(ref).id), current_index: cursor.currentIndex, round: cursor.round };
    bundle.pointers.current_location_key = bundle.locations.find(row => row.source_id === world.currentLocationId)?.key ?? null;
  }
  validateClassBundle(bundle);
  return bundle;
}

/** A reusable PC snapshot is not a newly generated class sheet. Validate its
 * exact definition versions and owned IDs without assigning replacement IDs.
 */
export function validateClassCharacterSnapshot(raw, { ruleset } = {}) {
  const snapshot = clone(raw);
  validateClassBuild(snapshot.classBuild, ruleset);
  integer(snapshot.health, 'saved character health', 0);
  integer(snapshot.max_health, 'saved character maximum health');
  if (snapshot.health > snapshot.max_health) fail('Saved health exceeds maximum.');
  ownedAbilities({ ...snapshot, maxHealth: snapshot.max_health });
  object(snapshot.classState, 'saved class state');
  if (snapshot.classState.familyId !== snapshot.classBuild.familyId || snapshot.classState.branchId !== snapshot.classBuild.branchId) fail('Saved class state belongs to a different class build.');
  const ids = new Set(snapshot.abilities.map(ability => ability.id));
  const bindingIds = new Set();
  for (const binding of array(snapshot.bindings, 'saved bindings')) {
    if (!ids.has(binding.abilityId) || bindingIds.has(binding.abilityId)) fail('Saved binding refers to a missing or duplicate owned ability.');
    bindingIds.add(binding.abilityId);
  }
  for (const ability of snapshot.abilities) if (ability.invocation && !bindingIds.has(ability.id)) fail('Invocable saved ability lacks its exact campaign binding.');
  return snapshot;
}
