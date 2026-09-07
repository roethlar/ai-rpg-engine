import { isDeepStrictEqual } from 'node:util';
import { caseFold } from 'unicode-case-folding';
import { STAKES_BUDGETS } from './rules-resolution.js';
import { getAbilityDefinition } from './class-catalog.js';

export const EFFECT_CATALOG_VERSION = 'effects-class-runtime-1';
export const EFFECT_VALUES = Object.freeze({
  harm: Object.freeze({ graze: 2, wound: 5, grievous: 9 }),
  heal: Object.freeze({ patch: 3, mend: 6, restore: 10 }),
  pool: Object.freeze({ shallow: 2, deep: 4 }),
  disposition: Object.freeze({ slight: 10, marked: 25 })
});
export const HINDRANCES = Object.freeze(['hindered', 'exposed', 'dazed', 'pinned', 'winded']);
export const BOONS = Object.freeze(['steadied', 'inspired', 'concealed']);
const CONDITIONS = [...HINDRANCES, ...BOONS];
const DURATIONS = ['scene', 'persistent'];
const ITEM_LADDER = ['pristine', 'worn', 'damaged', 'broken'];
const WEALTH_LADDER = ['destitute', 'struggling', 'comfortable', 'wealthy', 'opulent'];
const FEATURE_KINDS = ['obstruction', 'hazard', 'smoke', 'darkness', 'alarm', 'cover', 'passage'];
const REVEAL_SCOPES = ['quarry_route', 'combat_trait', 'defense_trait', 'leverage', 'motive', 'route', 'area_features', 'profile_senses', 'companion_scout'];
const ABILITY_EXTENSIONS = ['disarm', 'item_consume', 'object_disable', 'object_unlock', 'reveal', 'revive', 'teleport', 'traverse', 'vehicle_repair', 'vehicle_condition_apply', 'vehicle_harm'];
const ORDINARY_EXTENSIONS = ['object_unlock', 'object_disable', 'vehicle_harm'];
export const GATED_EFFECT_OPERATIONS = Object.freeze({ value_reduce: 'derived-value-channel', value_enhance: 'derived-value-channel' });
export const SUPPORTED_EFFECT_OPERATIONS = Object.freeze([
  'harm', 'heal', 'pool_drain', 'pool_restore', 'item_lose', 'item_gain', 'item_transfer',
  'item_drop', 'item_pickup', 'item_condition_shift', 'wealth_shift', 'disposition_improve',
  'disposition_worsen', 'reposition', 'scene_exit', 'hindrance_apply', 'boon_apply',
  'condition_clear', 'scene_feature_place', 'scene_feature_clear', 'encounter_start',
  'encounter_end', 'fact_learn', 'location_transition', 'actor_status', ...ABILITY_EXTENSIONS
].sort());

function fail(code, message) {
  const error = new Error(message);
  error.code = `RULES_EFFECT_${code}`;
  throw error;
}

function plain(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('SHAPE', `${name} must be a plain object.`);
  return value;
}

function integer(value, name, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) fail('SHAPE', `${name} must be an integer from ${minimum} through ${maximum}.`);
  return value;
}

function oneOf(value, choices, name) {
  if (!choices.includes(value)) fail('SHAPE', `${name} is not a supported token.`);
  return value;
}

function shape(value, fields, optional = []) {
  plain(value, 'Effect');
  const allowed = ['op', ...fields, ...optional];
  if (['op', ...fields].some(field => !Object.hasOwn(value, field)) || Object.keys(value).some(field => !allowed.includes(field))) {
    fail('SHAPE', `Invalid ${value.op} effect fields.`);
  }
}

function licensed(value, name, maximum) {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/u.test(value)) fail('SHAPE', `${name} must be bounded text.`);
  const result = value.normalize('NFC').trim().replace(/\s+/gu, ' ');
  if (!result || [...result].length > maximum) fail('SHAPE', `${name} must contain 1-${maximum} characters.`);
  return result;
}

export function effectComparisonKey(value) {
  if (typeof value !== 'string') fail('SHAPE', 'Comparison keys require text.');
  return caseFold(value.trim().replace(/\s+/gu, ' ').normalize('NFC'));
}

function stackItem(state, owner, name, { gain = false } = {}) {
  if (!/^character:[1-9]\d*$/u.test(owner)) fail('SHAPE', 'Mundane stack owners must be character refs.');
  const actor = actorRecord(state, owner);
  if (!Array.isArray(actor.inventory)) fail('STATE', 'Actor inventory must be a stack array.');
  if (typeof name !== 'string' || /^(item|feature|npc|character|area):/iu.test(name.trim())) fail('REFERENCE', 'Reserved typed prefixes cannot be inventory names.');
  const key = effectComparisonKey(name);
  const matches = actor.inventory.filter(item => effectComparisonKey(item.name) === key);
  if (matches.length > 1 || (!gain && !matches.length)) fail('REFERENCE', 'Inventory name is missing or ambiguous.');
  const item = matches[0];
  if (item) {
    const allowed = ['name', 'type', 'description', 'quantity', 'equipped', ...(gain ? [] : ['effect'])];
    if (Object.keys(item).some(field => !allowed.includes(field))) fail('PRECONDITION', 'Inventory entry is not eligible for mundane stack operations.');
    integer(item.quantity ?? 1, 'Stack quantity', 1);
  }
  return { actor, item, key: `${owner}:inventory:${key}:possession` };
}

function cloneJson(value) {
  const seen = new Set();
  function visit(item) {
    if (item === null || ['string', 'boolean'].includes(typeof item)) return;
    if (typeof item === 'number' && Number.isFinite(item)) return;
    if (typeof item !== 'object' || seen.has(item)) fail('SHAPE', 'State and effects must be acyclic JSON.');
    if (!Array.isArray(item)) plain(item, 'JSON value');
    seen.add(item);
    for (const child of Array.isArray(item) ? Array.from(item) : Object.values(item)) visit(child);
    seen.delete(item);
  }
  visit(value);
  return structuredClone(value);
}

function typed(value, prefix) {
  const pattern = prefix === 'actor' ? /^(character|npc):[1-9]\d*$/u
    : prefix === 'area' ? /^area:[1-9]\d*:[A-Za-z0-9_-]+$/u
      : new RegExp(`^${prefix}:[A-Za-z0-9][A-Za-z0-9_.:-]*$`, 'u');
  if (typeof value !== 'string' || !pattern.test(value)) fail('REFERENCE', `Expected a typed ${prefix} reference.`);
  if (prefix === 'actor') integer(Number(value.split(':')[1]), 'Actor reference id', 1);
  return value;
}

function actorRecord(state, ref, { present = true } = {}) {
  typed(ref, 'actor');
  const actor = state.actors[ref];
  if (!actor) fail('REFERENCE', `Actor ${ref} is not recorded.`);
  if (present && (actor.present === false || actor.locationId !== state.currentLocationId)) fail('REFERENCE', `Actor ${ref} is outside the current scene.`);
  integer(actor.health, 'Actor health');
  integer(actor.maxHealth, 'Actor maxHealth', 1);
  if (actor.health > actor.maxHealth || typeof actor.party !== 'boolean') fail('STATE', 'Invalid actor vitals or party frame.');
  if (ref.startsWith('character:') && !actor.party) fail('STATE', 'Player characters must be in the party frame.');
  plain(actor.conditions, 'Actor conditions');
  return actor;
}

function areaRecord(state, id, locationId = state.currentLocationId) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]+$/u.test(id)) fail('REFERENCE', 'Expected a bare recorded area id.');
  const matches = Object.entries(state.areas).filter(([, area]) => area.id === id && area.locationId === locationId);
  if (matches.length !== 1) fail('REFERENCE', 'Area is missing or ambiguous in the selected location.');
  const [ref, area] = matches[0];
  if (ref !== `area:${locationId}:${id}`) fail('STATE', 'Area key contradicts its location/id.');
  return { ref, area };
}

function framed(state, ref, helps, opposed) {
  const actor = actorRecord(state, ref);
  if (!actor.party && !opposed.has(ref)) fail('ALLEGIANCE', 'allegiance-unknown');
  if (helps === null) return 'neutral';
  return helps === actor.party ? 'beneficial' : 'adverse';
}

function conditionRecord(state, who, token) {
  oneOf(token, CONDITIONS, 'Condition');
  const record = actorRecord(state, who).conditions[token];
  if (!record) fail('NO_OP', 'Condition is not active.');
  if (record.actor !== who || record.condition !== token
    || record.class !== (HINDRANCES.includes(token) ? 'hindrance' : 'boon')) fail('STATE', 'Condition record contradicts its key.');
  oneOf(record.duration, DURATIONS, 'Stored condition duration');
  return record;
}

function applyCondition(state, who, token, duration, detail, envelope) {
  const actor = actorRecord(state, who);
  oneOf(token, CONDITIONS, 'Condition');
  oneOf(duration, DURATIONS, 'Condition duration');
  if (actor.conditions[token]) fail('NO_OP', 'Condition is already active.');
  actor.conditions[token] = {
    actor: who, condition: token, class: HINDRANCES.includes(token) ? 'hindrance' : 'boon',
    detail: licensed(detail, 'Condition detail', 80), source: envelope.transactionId,
    duration, appliedTurn: envelope.turn
  };
}

function featureRecord(state, ref) {
  typed(ref, 'feature');
  const feature = state.features[ref];
  if (!feature || feature.status !== 'active' || feature.location !== state.currentLocationId) fail('REFERENCE', 'Feature is not active in the current location.');
  if (feature.id !== ref) fail('STATE', 'Feature identity contradicts its key.');
  const { ref: area } = areaRecord(state, feature.area.replace(/^area:[1-9]\d*:/u, ''));
  if (feature.area !== area) fail('STATE', 'Feature area contradicts its location.');
  oneOf(feature.duration, DURATIONS, 'Stored feature duration');
  oneOf(feature.works_against, ['party', 'opposition', 'both'], 'Stored feature side');
  return feature;
}

function itemRecord(state, ref) {
  typed(ref, 'item');
  const item = state.items[ref];
  if (!item || item.lost || item.id !== ref) fail('REFERENCE', 'Item is missing or out of play.');
  if (Object.hasOwn(item, 'quantity')) fail('STATE', 'Durable records cannot carry stack quantities.');
  oneOf(item.condition, ITEM_LADDER, 'Item condition');
  oneOf(item.class, ['mundane', 'significant'], 'Item class');
  if (!Array.isArray(item.provenance)) fail('STATE', 'Durable item provenance is required.');
  for (const field of ['name', 'type', 'description']) if (typeof item[field] !== 'string') fail('STATE', 'Durable item display fields are required.');
  if (item.holder.startsWith('area:')) {
    typed(item.holder, 'area');
    const area = state.areas[item.holder];
    if (!area || area.locationId !== state.currentLocationId) fail('REFERENCE', 'Item is outside the current location.');
  } else actorRecord(state, item.holder);
  return item;
}

function strictRung(current, direction, to, ladder, increasing) {
  const index = ladder.indexOf(current);
  if (index < 0) fail('STATE', 'Stored ladder rung is invalid.');
  const sign = direction === increasing ? 1 : -1;
  const next = to === undefined ? index + sign : ladder.indexOf(to);
  if (next < 0 || next >= ladder.length || (next - index) * sign <= 0) fail('NO_OP', 'Ladder movement must make strict progress in its direction.');
  return ladder[next];
}

function clearSceneState(state, envelope, events) {
  for (const [ref, actor] of Object.entries(state.actors)) {
    for (const [token, condition] of Object.entries(actor.conditions)) {
      if (condition.duration === 'scene') {
        delete actor.conditions[token];
        events.push({ type: 'condition_expired', who: ref, condition: token });
      }
    }
  }
  for (const feature of Object.values(state.features)) {
    if (feature.status === 'active' && feature.duration === 'scene') {
      feature.status = 'cleared';
      feature.clearedBy = envelope.transactionId;
      feature.clearedTurn = envelope.turn;
      events.push({ type: 'feature_expired', feature: feature.id });
    }
  }
  for (const object of Object.values(state.objects ?? {})) {
    if (object.disabled?.duration === 'scene') object.disabled = null;
  }
  for (const vehicle of Object.values(state.vehicles ?? {})) {
    for (const [token, record] of Object.entries(vehicle.conditions ?? {})) {
      if (record.duration === 'scene') delete vehicle.conditions[token];
    }
  }
}

/** Pure, ordered evaluation. Inputs have already passed the consumer's semantic
 * gates and ability/ordinary entitlement authorizer. Mechanical failures throw
 * with RULES_EFFECT_* codes; neither input nor partial state is ever mutated.
 */
export function evaluateEffects({ state, effects, consumer, actor, turn, transactionId, band = null, stakesLicense = null, affirmedOpposed = [], harmFloors = [] }) {
  oneOf(consumer, ['ordinary', 'ability', 'annotation'], 'Consumer');
  integer(actor, 'Acting character', 1);
  integer(turn, 'Ledger turn', 1);
  if (typeof transactionId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/u.test(transactionId)) fail('SHAPE', 'A stable transaction identity is required.');
  plain(state, 'State');
  if (state.effectCatalogVersion !== EFFECT_CATALOG_VERSION) fail('VERSION', 'Missing or unsupported effect catalog version.');
  for (const table of ['actors', 'areas', 'items', 'features']) plain(state[table], `State ${table}`);
  plain(state.encounter, 'Encounter');
  if (typeof state.encounter.active !== 'boolean' || !Array.isArray(state.encounter.participants) || !Array.isArray(state.facts)) fail('STATE', 'Invalid encounter or fact store.');
  integer(state.currentLocationId, 'Current location', 1);
  if (!Array.isArray(effects) || effects.length > 128) fail('SHAPE', 'Effects must be an array with at most 128 entries.');
  if (!Array.isArray(affirmedOpposed) || affirmedOpposed.length > 64
    || new Set(affirmedOpposed).size !== affirmedOpposed.length) fail('SHAPE', 'Opposition must be a unique bounded NPC-ref array.');
  const next = cloneJson(state);
  const proposals = cloneJson(effects);
  actorRecord(next, `character:${actor}`);
  const opposed = new Set(affirmedOpposed);
  for (const ref of opposed) {
    if (typeof ref !== 'string' || !/^npc:[1-9]\d*$/u.test(ref) || actorRecord(next, ref).party) fail('ALLEGIANCE', 'Opposition must reference present non-party NPCs.');
  }
  if (consumer === 'annotation') {
    oneOf(band, ['crit_success', 'crit_failure', 'marginal_success', 'marginal_failure'], 'Annotation band');
    oneOf(stakesLicense, Object.keys(STAKES_BUDGETS), 'Stakes license');
  }
  if (!Array.isArray(harmFloors) || harmFloors.length > effects.length) fail('SHAPE', 'Invalid engine harm-floor receipt list.');
  const floors = new Map();
  for (const floor of cloneJson(harmFloors)) {
    plain(floor, 'Harm floor');
    if (Object.keys(floor).sort().join(',') !== 'effectIndex,minimum,sourceAbilityId,who'
      || floor.minimum !== 1 || typeof floor.sourceAbilityId !== 'string' || !floor.sourceAbilityId) fail('SHAPE', 'Invalid engine harm-floor receipt.');
    integer(floor.effectIndex, 'Effect ordinal', 0, effects.length - 1);
    const effect = proposals[floor.effectIndex];
    if (effect.op !== 'harm' || effect.who !== floor.who || floors.has(floor.effectIndex)) fail('PRECONDITION', 'Harm floor must bind one actual harm entry and target.');
    const target = actorRecord(next, floor.who);
    const matches = target.abilities?.filter(ability => ability.id === floor.sourceAbilityId) ?? [];
    const owned = matches[0];
    const definition = owned && getAbilityDefinition(owned.definition_id, owned.definition_version);
    if (matches.length !== 1 || !definition || definition.mechanic?.kind !== 'exposure'
      || definition.mechanic.mode !== 'last_stand' || definition.mechanic.minimumHealth !== 1
      || definition.cadence.kind !== 'recovery_use' || definition.cadence.uses !== 1) fail('AUTHORIZATION', 'Harm floor requires the owned catalog Refuse Defeat definition.');
    plain(target.classState, 'Target class state');
    plain(target.classState.recoveryUses, 'Recovery uses');
    if (integer(target.classState.recoveryUses[definition.id] ?? 0, 'Recorded recovery use') !== 0) fail('PRECONDITION', 'Refuse Defeat has already been spent this recovery.');
    floors.set(floor.effectIndex, { ...floor, definitionId: definition.id, definitionVersion: definition.version });
  }
  const context = { state: next, consumer, actor, turn, transactionId, opposed, floors, events: [] };
  const used = new Set();
  const resolved = [];
  let cost = 0;
  for (const [index, effect] of proposals.entries()) {
    plain(effect, 'Effect');
    if (Object.hasOwn(GATED_EFFECT_OPERATIONS, effect.op)) fail('GATED', `GATED:${GATED_EFFECT_OPERATIONS[effect.op]}`);
    if (!SUPPORTED_EFFECT_OPERATIONS.includes(effect.op)) fail('MEMBERSHIP', 'Operation is not in the pinned catalog.');
    if (ABILITY_EXTENSIONS.includes(effect.op) && consumer !== 'ability'
      && !(consumer === 'ordinary' && ORDINARY_EXTENSIONS.includes(effect.op))) fail('AUTHORIZATION', 'This operation is restricted to authored abilities.');
    if (['location_transition', 'actor_status'].includes(effect.op) && consumer !== 'ordinary') fail('AUTHORIZATION', 'This operation is restricted to the ordinary engine authorizer.');
    const result = executeEffect(effect, { ...context, index });
    for (const key of result.keys) {
      if (used.has(key)) fail('CONFLICT', 'Two effects address the same conflict key.');
      used.add(key);
    }
    const pointCost = result.significant ? 2 : 1;
    cost += pointCost;
    if (consumer === 'annotation') {
      if (result.valence !== (band === 'crit_success' ? 'beneficial' : 'adverse')) fail('VALENCE', 'Effect valence is not legal for this outcome band.');
      if (cost > STAKES_BUDGETS[stakesLicense]) fail('BUDGET', 'Effects exceed the committed stakes license.');
    } else if (consumer === 'ability' && result.valence === 'neutral') fail('VALENCE', 'Only ordinary actions may authorize neutral core effects.');
    resolved.push({
      ...result.effect, catalogVersion: EFFECT_CATALOG_VERSION,
      weightClass: result.significant ? 'significant' : 'minor', pointCost,
      effectiveValence: result.valence, resolvedTargets: result.targets,
      pricingPrestate: result.prestate
    });
  }
  if (effects.length && isDeepStrictEqual(state, next)) fail('NO_OP', 'The complete effect array cancels itself.');
  return { state: next, effects: resolved, events: context.events, cost };
}

function executeEffect(effect, context) {
  const { state, opposed, events, turn, transactionId, index } = context;
  const result = (keys, valence, { significant = false, targets = {}, prestate = {}, params = effect } = {}) => ({ keys, valence, significant, targets, prestate, effect: params });
  const frame = (who, helps) => framed(state, who, helps, opposed);
  const presence = who => {
    const target = actorRecord(state, who);
    areaRecord(state, target.area);
    if (target.conditions.pinned) fail('PRECONDITION', 'Pinned actors cannot leave their area.');
    return target;
  };
  switch (effect.op) {
    case 'harm':
    case 'heal': {
      shape(effect, ['who', 'grade']);
      oneOf(effect.grade, Object.keys(EFFECT_VALUES[effect.op]), 'Vital grade');
      const target = actorRecord(state, effect.who);
      if (target.status === 'dead') fail('PRECONDITION', 'Vitals operations cannot harm or heal a dead actor.');
      const before = target.health;
      const amount = EFFECT_VALUES[effect.op][effect.grade];
      const healing = effect.op === 'heal';
      target.health = Math.max(0, Math.min(target.maxHealth, before + (healing ? amount : -amount)));
      const floor = context.floors.get(index);
      if (floor) {
        if (healing || before < 1 || target.health !== 0) fail('PRECONDITION', 'Refuse Defeat only applies to otherwise-lethal incoming harm.');
        if ((target.classState.recoveryUses[floor.definitionId] ?? 0) !== 0) fail('PRECONDITION', 'Refuse Defeat cannot trigger twice in one array.');
        target.health = 1;
        target.classState.recoveryUses[floor.definitionId] = 1;
        if (!target.conditions.winded) applyCondition(state, effect.who, 'winded', 'scene', 'Refused a recorded defeat.', context);
        events.push({ type: 'defeat_prevented', who: effect.who, sourceAbilityId: floor.sourceAbilityId, definitionId: floor.definitionId });
      }
      if (target.health === before && !floor) fail('NO_OP', 'Vital effect changes no health.');
      events.push({ type: 'health_changed', who: effect.who, before, after: target.health, amount, appliedAmount: Math.abs(target.health - before) });
      if (target.health === 0) events.push({ type: 'health_zero', who: effect.who });
      return result([`${effect.who}:health`], frame(effect.who, healing), {
        significant: !['graze', 'patch'].includes(effect.grade), targets: { who: effect.who },
        prestate: { health: before, maxHealth: target.maxHealth, amount, appliedAmount: Math.abs(target.health - before), ...(floor ? { floor } : {}) }
      });
    }
    case 'pool_drain':
    case 'pool_restore': {
      shape(effect, ['who', 'pool', 'depth']);
      if (!/^character:[1-9]\d*$/u.test(effect.who)) fail('SHAPE', 'Signed pool operations target characters.');
      oneOf(effect.pool, ['mana', 'strain'], 'Pool');
      oneOf(effect.depth, ['shallow', 'deep'], 'Pool depth');
      const target = actorRecord(state, effect.who);
      const pool = target.resources?.[effect.pool];
      if (!pool) fail('REFERENCE', 'Actor does not have that recorded pool.');
      integer(pool.current, 'Pool current');
      integer(pool.max, 'Pool max');
      if (pool.current > pool.max) fail('STATE', 'Pool exceeds maximum.');
      const before = pool.current;
      const restore = effect.op === 'pool_restore';
      pool.current = Math.max(0, Math.min(pool.max, before + EFFECT_VALUES.pool[effect.depth] * (restore ? 1 : -1)));
      if (before === pool.current) fail('NO_OP', 'Pool effect changes no resource.');
      return result([`${effect.who}:pool:${effect.pool}`], frame(effect.who, restore), {
        significant: effect.depth === 'deep', targets: { who: effect.who }, prestate: { current: before, max: pool.max }
      });
    }
    case 'item_gain': {
      shape(effect, ['owner', 'name']);
      const name = licensed(effect.name, 'Item name', 48);
      const { actor: owner, item, key } = stackItem(state, effect.owner, name, { gain: true });
      const quantity = item?.quantity ?? (item ? 1 : 0);
      if (quantity === Number.MAX_SAFE_INTEGER) fail('STATE', 'Stack quantity cannot overflow.');
      if (item) item.quantity = quantity + 1;
      else owner.inventory.push({ name, type: 'general', description: 'No description.', quantity: 1 });
      return result([key], frame(effect.owner, true), { targets: { owner: effect.owner }, prestate: { quantity }, params: { ...effect, name } });
    }
    case 'item_lose': {
      if (typeof effect.item === 'string' && effect.item.startsWith('item:')) {
        shape(effect, ['item']);
        const item = itemRecord(state, effect.item);
        const holder = item.holder;
        if (holder.startsWith('area:')) fail('REFERENCE', 'Loss requires an actor-held item.');
        const valence = frame(holder, false);
        item.lost = true;
        return result([`${effect.item}:possession`], valence, { significant: item.class === 'significant', targets: { item: effect.item, owner: holder }, prestate: { holder, class: item.class } });
      }
      shape(effect, ['owner', 'item']);
      const { actor: owner, item, key } = stackItem(state, effect.owner, effect.item);
      const quantity = item.quantity ?? 1;
      if (quantity === 1) owner.inventory.splice(owner.inventory.indexOf(item), 1);
      else item.quantity = quantity - 1;
      return result([key], frame(effect.owner, false), { targets: { owner: effect.owner }, prestate: { quantity } });
    }
    case 'item_transfer': {
      shape(effect, ['item', 'from', 'to']);
      const item = itemRecord(state, effect.item);
      const from = actorRecord(state, effect.from);
      const to = actorRecord(state, effect.to);
      if (item.holder !== effect.from || effect.from === effect.to) fail('PRECONDITION', 'Transfer must change the recorded holder.');
      frame(effect.from, false);
      frame(effect.to, true);
      if (!from.party && !to.party) fail('ALLEGIANCE', 'NPC-to-NPC transfers need a richer allegiance contract.');
      const valence = from.party === to.party ? 'neutral' : to.party ? 'beneficial' : 'adverse';
      item.holder = effect.to;
      if (Object.hasOwn(item, 'wielded')) item.wielded = false;
      return result([`${effect.item}:possession`], valence, { significant: item.class === 'significant', targets: { item: effect.item, from: effect.from, to: effect.to }, prestate: { holder: effect.from, class: item.class } });
    }
    case 'item_drop':
    case 'item_pickup': {
      shape(effect, effect.op === 'item_drop' ? ['item', 'area'] : ['owner', 'item']);
      const item = itemRecord(state, effect.item);
      const before = item.holder;
      const pickup = effect.op === 'item_pickup';
      let who;
      let params = effect;
      if (pickup) {
        who = effect.owner;
        actorRecord(state, who);
        if (!before.startsWith(`area:${state.currentLocationId}:`)) fail('PRECONDITION', 'Pickup requires scene-held custody.');
        item.holder = who;
      } else {
        who = before;
        actorRecord(state, who);
        const area = areaRecord(state, effect.area).ref;
        item.holder = area;
        params = { ...effect, area };
      }
      if (Object.hasOwn(item, 'wielded')) item.wielded = false;
      return result([`${effect.item}:possession`], frame(who, pickup), { significant: item.class === 'significant', targets: { item: effect.item, owner: who, holder: item.holder }, prestate: { holder: before, class: item.class }, params });
    }
    case 'item_condition_shift': {
      shape(effect, ['item', 'direction'], ['to']);
      oneOf(effect.direction, ['degrade', 'improve'], 'Condition direction');
      if (effect.to !== undefined) oneOf(effect.to, ITEM_LADDER, 'Target condition');
      const item = itemRecord(state, effect.item);
      actorRecord(state, item.holder);
      const before = item.condition;
      item.condition = strictRung(before, effect.direction, effect.to, ITEM_LADDER, 'degrade');
      return result([`${effect.item}:condition`], frame(item.holder, effect.direction === 'improve'), { significant: item.condition === 'broken', targets: { item: effect.item, owner: item.holder }, prestate: { condition: before, class: item.class } });
    }
    case 'wealth_shift': {
      shape(effect, ['who', 'direction'], ['to']);
      if (!/^npc:[1-9]\d*$/u.test(effect.who)) fail('SHAPE', 'Wealth is NPC-only.');
      oneOf(effect.direction, ['up', 'down'], 'Wealth direction');
      if (effect.to !== undefined) oneOf(effect.to, WEALTH_LADDER, 'Wealth target');
      const target = actorRecord(state, effect.who);
      const before = target.wealth;
      target.wealth = strictRung(before, effect.direction, effect.to, WEALTH_LADDER, 'up');
      return result([`${effect.who}:wealth`], frame(effect.who, effect.direction === 'up'), { significant: ['destitute', 'opulent'].includes(target.wealth), targets: { who: effect.who }, prestate: { wealth: before } });
    }
    case 'disposition_improve':
    case 'disposition_worsen': {
      shape(effect, ['npc', 'step']);
      if (!/^npc:[1-9]\d*$/u.test(effect.npc)) fail('SHAPE', 'Disposition targets NPC refs.');
      oneOf(effect.step, ['slight', 'marked'], 'Disposition step');
      const target = actorRecord(state, effect.npc);
      const before = integer(target.relationshipValue, 'NPC relationship', -100, 100);
      const improve = effect.op === 'disposition_improve';
      target.relationshipValue = Math.max(-100, Math.min(100, before + EFFECT_VALUES.disposition[effect.step] * (improve ? 1 : -1)));
      if (before === target.relationshipValue) fail('NO_OP', 'Disposition is already at its clamp.');
      return result([`${effect.npc}:disposition`], improve ? 'beneficial' : 'adverse', { significant: effect.step === 'marked', targets: { npc: effect.npc }, prestate: { relationshipValue: before } });
    }
    case 'reposition':
    case 'scene_exit': {
      const exiting = effect.op === 'scene_exit';
      shape(effect, exiting ? ['who', 'quality'] : ['who', 'area', 'quality']);
      oneOf(effect.quality, ['favorable', 'unfavorable', 'neutral'], 'Position quality');
      if (exiting && !/^npc:[1-9]\d*$/u.test(effect.who)) fail('SHAPE', 'scene_exit is NPC-only.');
      const target = presence(effect.who);
      const valence = frame(effect.who, effect.quality === 'neutral' ? null : effect.quality === 'favorable');
      const before = `area:${target.locationId}:${target.area}`;
      let params = effect;
      if (exiting) {
        target.present = false;
        target.area = null;
        state.encounter.participants = state.encounter.participants.filter(ref => ref !== effect.who);
        if (state.encounter.active && !state.encounter.participants.length) {
          state.encounter.active = false;
          state.encounter.endedTurn = turn;
          events.push({ type: 'encounter_ended', reason: 'empty_opposition' });
        }
      } else {
        const { ref: area } = areaRecord(state, effect.area);
        if (target.area === effect.area) fail('NO_OP', 'Actor is already in that area.');
        target.area = effect.area;
        params = { ...effect, area };
      }
      return result([`${effect.who}:presence`], valence, { targets: { who: effect.who, ...(exiting ? {} : { area: params.area }) }, prestate: { area: before }, params });
    }
    case 'hindrance_apply':
    case 'boon_apply': {
      shape(effect, ['who', 'condition', 'duration', 'detail']);
      oneOf(effect.condition, effect.op === 'hindrance_apply' ? HINDRANCES : BOONS, 'Condition');
      applyCondition(state, effect.who, effect.condition, effect.duration, effect.detail, context);
      return result([`${effect.who}:condition:${effect.condition}`], frame(effect.who, effect.op === 'boon_apply'), { significant: effect.duration === 'persistent', targets: { who: effect.who }, params: { ...effect, detail: state.actors[effect.who].conditions[effect.condition].detail } });
    }
    case 'condition_clear': {
      shape(effect, ['who', 'condition']);
      const condition = conditionRecord(state, effect.who, effect.condition);
      const valence = frame(effect.who, condition.class === 'hindrance');
      delete state.actors[effect.who].conditions[effect.condition];
      return result([`${effect.who}:condition:${effect.condition}`], valence, { significant: condition.duration === 'persistent', targets: { who: effect.who }, prestate: { condition } });
    }
    case 'scene_feature_place': {
      shape(effect, ['area', 'kind', 'name', 'duration', 'works_against']);
      oneOf(effect.kind, FEATURE_KINDS, 'Feature kind');
      oneOf(effect.duration, DURATIONS, 'Feature duration');
      oneOf(effect.works_against, ['party', 'opposition', 'both'], 'Feature side');
      const area = areaRecord(state, effect.area).ref;
      if (Object.values(state.features).some(feature => feature.status === 'active' && feature.area === area && feature.kind === effect.kind)) fail('NO_OP', 'That feature kind is already active in the area.');
      const id = `feature:${transactionId}:${index + 1}`;
      if (state.features[id]) fail('CONFLICT', 'Feature identity already exists; resume the originating transaction.');
      const name = licensed(effect.name, 'Feature name', 48);
      state.features[id] = { id, location: state.currentLocationId, area, kind: effect.kind, name, duration: effect.duration, works_against: effect.works_against, status: 'active', source: transactionId, appliedTurn: turn };
      return result([`${area}:feature:${effect.kind}`], effect.works_against === 'opposition' ? 'beneficial' : 'adverse', { significant: effect.duration === 'persistent', targets: { feature: id, area }, params: { ...effect, area, name } });
    }
    case 'scene_feature_clear': {
      shape(effect, ['feature']);
      const feature = featureRecord(state, effect.feature);
      const prestate = { duration: feature.duration, works_against: feature.works_against };
      feature.status = 'cleared';
      feature.clearedBy = transactionId;
      feature.clearedTurn = turn;
      return result([`${effect.feature}:active`], feature.works_against === 'opposition' ? 'adverse' : 'beneficial', { significant: feature.duration === 'persistent', targets: { feature: effect.feature, area: feature.area }, prestate });
    }
    case 'encounter_start':
    case 'encounter_end': {
      const starting = effect.op === 'encounter_start';
      shape(effect, starting ? ['posture', 'outcome', 'participants'] : ['outcome']);
      oneOf(effect.outcome, ['party_favored', 'party_costing'], 'Encounter outcome');
      if (state.encounter.active === starting) fail('NO_OP', 'Encounter already has that activity state.');
      const before = cloneJson(state.encounter);
      if (starting) {
        oneOf(effect.posture, ['hostile', 'social_standoff'], 'Encounter posture');
        if (!Array.isArray(effect.participants) || effect.participants.length < 1 || effect.participants.length > 6
          || new Set(effect.participants).size !== effect.participants.length) fail('SHAPE', 'Encounter requires 1-6 unique NPC refs.');
        for (const ref of effect.participants) {
          if (!/^npc:[1-9]\d*$/u.test(ref)) fail('SHAPE', 'Encounter opposition uses NPC refs.');
          const target = actorRecord(state, ref);
          areaRecord(state, target.area);
          if (target.party || target.status === 'dead') fail('PRECONDITION', 'Encounter opposition must be present non-party living actors.');
        }
        state.encounter = { active: true, posture: effect.posture, participants: [...effect.participants], startedTurn: turn, source: transactionId };
      } else {
        state.encounter.active = false;
        state.encounter.endedTurn = turn;
      }
      events.push({ type: starting ? 'encounter_started' : 'encounter_ended' });
      return result(['encounter'], effect.outcome === 'party_favored' ? 'beneficial' : 'adverse', { significant: starting, targets: starting ? { participants: effect.participants } : {}, prestate: { encounter: before } });
    }
    case 'fact_learn': {
      shape(effect, ['fact']);
      const fact = licensed(effect.fact, 'Fact', 120);
      if (state.facts.some(entry => effectComparisonKey(entry.fact) === effectComparisonKey(fact))) fail('NO_OP', 'Fact is already recorded.');
      state.facts.push({ fact, turn, importance: 3, keywords: [] });
      return result(['fact_learn'], 'beneficial', { params: { ...effect, fact } });
    }
    case 'location_transition': {
      shape(effect, ['location', 'area']);
      if (typeof effect.location !== 'string' || !/^location:[1-9]\d*$/u.test(effect.location)) fail('REFERENCE', 'Travel requires a typed recorded location.');
      const locationId = Number(effect.location.slice('location:'.length));
      integer(locationId, 'Destination location', 1);
      if (state.encounter.active) fail('PRECONDITION', 'Resolve the active encounter before ordinary location travel.');
      if (locationId === state.currentLocationId) fail('NO_OP', 'Travel must change location.');
      const destination = areaRecord(state, effect.area, locationId);
      const acting = presence(`character:${context.actor}`);
      const origin = areaRecord(state, acting.area);
      if (!Array.isArray(origin.area.exits) || !origin.area.exits.includes(destination.ref)) fail('PRECONDITION', 'No recorded ordinary route reaches that destination.');
      if (destination.area.safeToOccupy !== true) fail('PRECONDITION', 'Destination cannot be occupied safely.');
      const travelers = Object.entries(state.actors).filter(([, target]) => target.party && target.present !== false && target.locationId === state.currentLocationId);
      for (const [ref] of travelers) presence(ref);
      const before = state.currentLocationId;
      for (const [, target] of travelers) { target.locationId = locationId; target.area = effect.area; }
      state.currentLocationId = locationId;
      clearSceneState(state, context, events);
      events.push({ type: 'location_changed', from: before, to: locationId });
      return result(['location', ...travelers.map(([ref]) => `${ref}:presence`)], 'neutral', { targets: { location: effect.location, area: destination.ref, travelers: travelers.map(([ref]) => ref) }, prestate: { locationId: before }, params: { ...effect, area: destination.ref } });
    }
    case 'actor_status': {
      shape(effect, ['who', 'status']);
      oneOf(effect.status, ['active', 'downed', 'dead'], 'Actor status');
      const target = actorRecord(state, effect.who);
      const before = target.status;
      if (before === effect.status) fail('NO_OP', 'Actor already has that status.');
      const legal = effect.status === 'downed' ? before === 'active' && target.health === 0
        : effect.status === 'dead' ? before === 'downed' && target.health === 0
          : before === 'downed' && target.health > 0;
      if (!legal) fail('PRECONDITION', 'Status transition contradicts recorded vitals or prior status.');
      target.status = effect.status;
      if (effect.status === 'dead') target.deathTurn = turn;
      events.push({ type: 'actor_status_changed', who: effect.who, before, after: effect.status });
      return result([`${effect.who}:status`], frame(effect.who, effect.status === 'active'), { significant: effect.status === 'dead', targets: { who: effect.who }, prestate: { status: before, health: target.health } });
    }
    case 'disarm': {
      shape(effect, ['who', 'item']);
      const target = actorRecord(state, effect.who);
      const item = itemRecord(state, effect.item);
      if (item.holder !== effect.who || item.weapon !== true || item.wielded !== true || item.natural === true || item.fixed === true) fail('PRECONDITION', 'Disarm requires the target\'s recorded wielded, removable weapon.');
      const area = areaRecord(state, target.area).ref;
      item.holder = area;
      item.wielded = false;
      return result([`${effect.item}:possession`], frame(effect.who, false), { significant: item.class === 'significant', targets: { who: effect.who, item: effect.item, area }, prestate: { holder: effect.who, wielded: true, class: item.class } });
    }
    case 'item_consume': {
      shape(effect, ['owner', 'item', 'quantity']);
      if (effect.quantity !== 1) fail('SHAPE', 'Authored consumption permits exactly one catalyst.');
      const item = itemRecord(state, effect.item);
      if (effect.owner !== `character:${context.actor}` || item.holder !== effect.owner || item.kind !== 'revival-catalyst') fail('PRECONDITION', 'Consumption requires one recorded catalyst held by the acting character.');
      item.lost = true;
      return result([`${effect.item}:possession`], 'adverse', { significant: item.class === 'significant', targets: { owner: effect.owner, item: effect.item }, prestate: { holder: effect.owner, kind: item.kind, class: item.class } });
    }
    case 'object_unlock':
    case 'object_disable': {
      const unlocking = effect.op === 'object_unlock';
      shape(effect, unlocking ? ['object', 'maximumSecurity'] : ['object', 'maximumSecurity', 'duration']);
      typed(effect.object, 'object');
      if (effect.maximumSecurity !== 'ordinary' || (!unlocking && effect.duration !== 'scene')) fail('SHAPE', 'Only ordinary scene mechanisms are authorized by this extension.');
      const object = state.objects?.[effect.object];
      if (!object || object.locationId !== state.currentLocationId) fail('REFERENCE', 'Object is not recorded in the current location.');
      areaRecord(state, object.area);
      if (object.security !== 'ordinary' || object.protectedSystem === true || !['lock', 'mechanism'].includes(object.kind)) fail('PRECONDITION', 'This object requires a stronger or separate access operation.');
      const prestate = { security: object.security, locked: object.locked ?? false, disabled: object.disabled ?? null };
      if (unlocking) {
        if (object.kind !== 'lock' || context.consumer === 'ability' && object.opposed !== false) fail('PRECONDITION', 'Checkless unlocking requires an unopposed recorded lock.');
        if (object.locked !== true) fail('NO_OP', 'Object is not locked.');
        object.locked = false;
      } else {
        if (object.disabled) fail('NO_OP', 'Object is already disabled.');
        object.disabled = { duration: 'scene', source: transactionId, appliedTurn: turn };
      }
      return result([`${effect.object}:${unlocking ? 'lock' : 'operation'}`], 'beneficial', { targets: { object: effect.object }, prestate });
    }
    case 'vehicle_repair': {
      shape(effect, ['who', 'amount']);
      typed(effect.who, 'vehicle');
      if (effect.amount !== 8) fail('SHAPE', 'This authored repair restores exactly eight hull before clamping.');
      const vehicle = state.vehicles?.[effect.who];
      if (!vehicle || vehicle.locationId !== state.currentLocationId) fail('REFERENCE', 'Vehicle is not present.');
      areaRecord(state, vehicle.area);
      integer(vehicle.hull, 'Vehicle hull', 1);
      integer(vehicle.maxHull, 'Vehicle maxHull', 1);
      if (vehicle.operator !== `character:${context.actor}` || vehicle.status !== 'active') fail('PRECONDITION', 'Repair requires the acting character\'s active vehicle.');
      if (vehicle.hull >= vehicle.maxHull) fail('NO_OP', 'Vehicle is already at maximum hull.');
      const before = vehicle.hull;
      vehicle.hull = Math.min(vehicle.maxHull, vehicle.hull + 8);
      return result([`${effect.who}:hull`], 'beneficial', { significant: true, targets: { who: effect.who }, prestate: { hull: before, maxHull: vehicle.maxHull } });
    }
    case 'vehicle_harm':
    case 'vehicle_condition_apply': {
      const harming = effect.op === 'vehicle_harm';
      shape(effect, harming ? ['who', 'grade'] : ['who', 'condition', 'duration', 'detail']);
      typed(effect.who, 'vehicle');
      const vehicle = state.vehicles?.[effect.who];
      if (!vehicle || vehicle.locationId !== state.currentLocationId || vehicle.status !== 'active') fail('REFERENCE', 'An active recorded vehicle must be present.');
      areaRecord(state, vehicle.area);
      integer(vehicle.hull, 'Vehicle hull');
      integer(vehicle.maxHull, 'Vehicle maxHull', 1);
      if (vehicle.hull > vehicle.maxHull) fail('STATE', 'Vehicle hull exceeds maximum.');
      const valence = frame(vehicle.operator, !harming);
      if (harming) {
        oneOf(effect.grade, Object.keys(EFFECT_VALUES.harm), 'Vehicle harm grade');
        if (vehicle.hull === 0) fail('NO_OP', 'Vehicle already has zero hull.');
        const before = vehicle.hull;
        const amount = EFFECT_VALUES.harm[effect.grade];
        vehicle.hull = Math.max(0, vehicle.hull - amount);
        events.push({ type: 'vehicle_hull_changed', who: effect.who, before, after: vehicle.hull, amount, appliedAmount: before - vehicle.hull });
        if (vehicle.hull === 0) events.push({ type: 'vehicle_hull_zero', who: effect.who });
        return result([`${effect.who}:hull`], valence, { significant: effect.grade !== 'graze', targets: { who: effect.who, operator: vehicle.operator }, prestate: { hull: before, maxHull: vehicle.maxHull, amount, appliedAmount: before - vehicle.hull } });
      }
      if (effect.condition !== 'steadied' || effect.duration !== 'scene') fail('SHAPE', 'This vehicle capability applies only scene-duration steadied.');
      if (vehicle.hull === 0) fail('PRECONDITION', 'A zero-hull vehicle cannot be steadied.');
      vehicle.conditions ??= {};
      plain(vehicle.conditions, 'Vehicle conditions');
      if (vehicle.conditions.steadied) fail('NO_OP', 'Vehicle is already steadied.');
      const detail = licensed(effect.detail, 'Vehicle condition detail', 80);
      vehicle.conditions.steadied = { vehicle: effect.who, condition: 'steadied', class: 'boon', duration: 'scene', detail, source: transactionId, appliedTurn: turn };
      return result([`${effect.who}:condition:steadied`], valence, { targets: { who: effect.who, operator: vehicle.operator }, params: { ...effect, detail } });
    }
    case 'revive': {
      shape(effect, ['who', 'health', 'maximumElapsedTurns', 'condition', 'duration']);
      if (effect.health !== 1 || ![2, 10].includes(effect.maximumElapsedTurns) || effect.condition !== 'winded') fail('SHAPE', 'Unsupported authored revival parameters.');
      oneOf(effect.duration, DURATIONS, 'Revival condition duration');
      const target = actorRecord(state, effect.who);
      integer(target.deathTurn, 'Recorded death turn', 1, turn);
      if (target.status !== 'dead' || target.health !== 0 || !target.party || target.intactBody !== true
        || target.willingReturn !== true || turn - target.deathTurn > effect.maximumElapsedTurns) fail('PRECONDITION', 'Revival requires a willing party member, intact body, and a recent recorded death.');
      const prestate = { health: target.health, status: target.status, deathTurn: target.deathTurn };
      if (target.conditions.winded) fail('NO_OP', 'Revival cannot reapply an active winded record.');
      target.health = 1;
      target.status = 'active';
      delete target.deathTurn;
      applyCondition(state, effect.who, 'winded', effect.duration, 'Returned from a recorded death.', context);
      events.push({ type: 'actor_revived', who: effect.who });
      return result([`${effect.who}:health`, `${effect.who}:status`, `${effect.who}:condition:winded`], 'beneficial', { significant: true, targets: { who: effect.who }, prestate });
    }
    case 'reveal': {
      shape(effect, ['subject', 'scope', 'maximum']);
      oneOf(effect.scope, REVEAL_SCOPES, 'Reveal scope');
      if (![1, 2].includes(effect.maximum)) fail('SHAPE', 'Reveal maximum must match an authored one- or two-fact selection.');
      let subject;
      if (typeof effect.subject === 'string' && /^(character|npc):/u.test(effect.subject)) subject = actorRecord(state, effect.subject);
      else if (typeof effect.subject === 'string' && effect.subject.startsWith('area:')) {
        typed(effect.subject, 'area');
        subject = state.areas[effect.subject];
        if (!subject || (subject.locationId !== state.currentLocationId && (effect.scope !== 'area_features' || subject.visited !== true))) fail('REFERENCE', 'Remote reveal requires a previously visited recorded area.');
      } else if (typeof effect.subject === 'string' && effect.subject.startsWith('object:')) {
        typed(effect.subject, 'object');
        subject = state.objects?.[effect.subject];
        if (!subject || subject.locationId !== state.currentLocationId) fail('REFERENCE', 'Reveal object must be present.');
      } else fail('REFERENCE', 'Reveal requires a recorded actor, area, or object ref.');
      if (!Array.isArray(subject.knowledge)) fail('NO_OP', 'No recorded discoveries exist for this subject.');
      const ids = subject.knowledge.map(entry => entry.id);
      if (ids.some(id => typeof id !== 'string' || !id) || new Set(ids).size !== ids.length) fail('STATE', 'Knowledge records require unique stable local ids.');
      const selected = subject.knowledge.filter(entry => entry.scope === effect.scope && entry.discovered === false
        && !state.facts.some(fact => effectComparisonKey(fact.fact) === effectComparisonKey(entry.fact))).slice(0, effect.maximum);
      if (!selected.length) fail('NO_OP', 'No new recorded fact matches the selected discovery scope.');
      for (const entry of selected) {
        const fact = licensed(entry.fact, 'Recorded discovery', 120);
        entry.discovered = true;
        state.facts.push({ fact, turn, importance: 3, keywords: [] });
        events.push({ type: 'knowledge_revealed', subject: effect.subject, knowledgeId: entry.id, fact });
      }
      return result(selected.map(entry => `${effect.subject}:knowledge:${entry.id}`), 'beneficial', { significant: selected.length > 1, targets: { subject: effect.subject }, prestate: { undiscoveredIds: selected.map(entry => entry.id) } });
    }
    case 'teleport':
    case 'traverse': {
      const teleport = effect.op === 'teleport';
      shape(effect, teleport ? ['who', 'area', 'maximumAreas', 'mode'] : ['who', 'area', 'mode', 'maximumDistance']);
      if ((teleport ? effect.maximumAreas : effect.maximumDistance) !== 1) fail('SHAPE', 'This movement operation permits one destination.');
      oneOf(effect.mode, teleport ? ['blink', 'circle'] : ['flight', 'grapple'], 'Movement mode');
      const circle = teleport && effect.mode === 'circle';
      const travelers = Array.isArray(effect.who) ? effect.who : [effect.who];
      if ((!circle && travelers.length !== 1) || travelers.length < 1 || travelers.length > 3 || new Set(travelers).size !== travelers.length) fail('SHAPE', 'Movement travelers must be a unique authored group of at most three.');
      if (circle && !travelers.includes(`character:${context.actor}`)) fail('PRECONDITION', 'Circle travel must include its acting caster.');
      let destination;
      if (circle && typeof effect.area === 'string' && effect.area.startsWith('area:')) {
        typed(effect.area, 'area');
        const area = state.areas[effect.area];
        if (!area) fail('REFERENCE', 'Circle destination is not recorded.');
        destination = areaRecord(state, area.id, area.locationId);
      } else destination = areaRecord(state, effect.area);
      if (destination.area.safeToOccupy !== true || destination.area.teleportWard === true && teleport) fail('PRECONDITION', 'Movement destination is unsafe or warded.');
      const before = [];
      const caster = state.actors[`character:${context.actor}`];
      const casterArea = circle ? areaRecord(state, caster.area).area : null;
      if (circle && casterArea.focus !== true) fail('PRECONDITION', 'Circle requires the caster at a recorded focus.');
      for (const who of travelers) {
        const target = presence(who);
        const origin = areaRecord(state, target.area);
        if (origin.ref === destination.ref) fail('NO_OP', 'Traveler is already in the destination area.');
        if (circle) {
          if (destination.area.visited !== true || (who !== `character:${context.actor}` && (target.willingTravel !== true
            || (target.area !== caster.area && !casterArea.adjacent?.includes(target.area))))) fail('PRECONDITION', 'Circle requires a visited destination and willing nearby travelers.');
        } else {
          if (!Array.isArray(origin.area.adjacent) || !origin.area.adjacent.includes(destination.area.id) || destination.area.visible !== true) fail('PRECONDITION', 'Movement requires a visible adjacent recorded destination.');
          if (effect.mode === 'grapple' && (destination.area.anchor !== true || destination.area.blocked === true)) fail('PRECONDITION', 'Grapple requires a reachable recorded anchor.');
          if (effect.mode === 'flight' && destination.area.flightBlocked === true) fail('PRECONDITION', 'This crossing blocks flight.');
        }
        if (teleport && origin.area.teleportWard === true) fail('PRECONDITION', 'A recorded teleport ward blocks departure.');
        before.push({ who, area: origin.ref });
      }
      const remote = destination.area.locationId !== state.currentLocationId;
      for (const who of travelers) { state.actors[who].area = destination.area.id; state.actors[who].locationId = destination.area.locationId; }
      if (remote) {
        const from = state.currentLocationId;
        state.currentLocationId = destination.area.locationId;
        clearSceneState(state, context, events);
        events.push({ type: 'location_changed', from, to: state.currentLocationId });
      }
      return result([...travelers.map(who => `${who}:presence`), ...(remote ? ['location'] : [])], 'beneficial', { significant: circle, targets: { travelers, area: destination.ref }, prestate: { travelers: before }, params: { ...effect, area: destination.ref } });
    }
    default: fail('MEMBERSHIP', 'Operation has no executable implementation.');
  }
}
