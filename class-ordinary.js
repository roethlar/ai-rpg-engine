import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { CATALOG_SKILLS, CLASS_EQUIPMENT, CLASS_EQUIPMENT_PERMISSIONS, CLASS_PROFILES } from './class-catalog.js';
import { NPC_PROFILES, NPC_PROFILE_VERSION } from './class-scenario.js';
import { validateRulesWorld } from './class-state.js';
import { effectComparisonKey } from './rules-effects.js';
import { prepareClassEvent, finalizeClassEvent, finalizeIncomingClassEffects } from './class-actions.js';

export const ORDINARY_ACTION_VERSION = 'ordinary-actions-1';
export const ORDINARY_CONSUMABLE_VERSION = 1;
const clone = value => structuredClone(value);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const SKILL_SCOPES = Object.freeze({
  influence: ['leverage', 'motive'], lore: ['combat_trait', 'defense_trait'],
  notice: ['area_features', 'combat_trait', 'defense_trait'], craft: ['area_features', 'defense_trait'],
  survival: ['route', 'quarry_route']
});
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

function fail(code, message) {
  const error = new Error(message);
  error.code = `ORDINARY_ACTION_${code}`;
  error.publicMessage = message;
  throw error;
}

function shape(value, required, optional = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('SHAPE', 'Action data must be a plain object.');
  if (required.some(key => !Object.hasOwn(value, key)) || Object.keys(value).some(key => !required.includes(key) && !optional.includes(key))) fail('SHAPE', 'Unknown or missing action fields.');
}

function positive(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) fail('SHAPE', `Invalid ${label}.`);
  return value;
}

function contextFor(state, actor, raw, npc = false) {
  shape(raw, ['turn', 'operationId'], ['round', 'affirmedOpposed', 'consentingActors']);
  positive(raw.turn, 'turn');
  if (typeof raw.operationId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/u.test(raw.operationId)) fail('SHAPE', 'A stable action operation ID is required.');
  if (npc || raw.round !== undefined) positive(raw.round, 'round');
  if (raw.round !== undefined && raw.round !== state.turnOrder.round) fail('STALE', 'The action round is not the current recorded round.');
  for (const [field, pattern] of [['affirmedOpposed', /^npc:[1-9]\d*$/u], ['consentingActors', /^(character|npc):[1-9]\d*$/u]]) {
    const refs = raw[field] ?? [];
    if (!Array.isArray(refs) || refs.length > 64 || new Set(refs).size !== refs.length
      || refs.some(ref => !pattern.test(ref))) fail('SHAPE', `Invalid ${field} references.`);
    for (const ref of refs) {
      const selected = actorRecord(state, ref, false);
      if (field === 'affirmedOpposed' && selected.party) fail('ALLEGIANCE', 'A party actor cannot be affirmed as opposition.');
      if (field === 'consentingActors' && !selected.party) fail('ALLEGIANCE', 'Current-action consent requires a present party member.');
    }
  }
  const affirmedOpposed = [...new Set([...Object.entries(state.actors).filter(([ref, value]) => ref.startsWith('npc:') && value.present
    && value.locationId === state.currentLocationId && !value.party && value.opposed === true).map(([ref]) => ref), ...(raw.affirmedOpposed ?? [])])];
  return { ...clone(raw), actor, consumer: 'ordinary', affirmedOpposed };
}

function actorRecord(state, ref, alive = true) {
  if (typeof ref !== 'string' || !/^(character|npc):[1-9]\d*$/u.test(ref)) fail('REFERENCE', 'Choose an exact recorded actor.');
  const value = state.actors[ref];
  if (!value || !value.present || value.locationId !== state.currentLocationId) fail('RANGE', 'The selected actor is outside the current scene.');
  if (alive && (value.health <= 0 || value.status !== 'active')) fail('INCAPACITATED', 'The selected actor cannot act while incapacitated.');
  return value;
}

function actingCharacter(state, actor, alive = true) {
  validateRulesWorld(state);
  if (typeof actor !== 'string' || !/^character:[1-9]\d*$/u.test(actor)) fail('ACTOR', 'Only the current player character owns this action.');
  const value = actorRecord(state, actor, alive);
  if (value.tableStatus !== 'active' || state.turnOrder.order[state.turnOrder.currentIndex] !== actor) fail('ACTOR', 'This character does not own the current turn.');
  return value;
}

function areaRecord(state, id, locationId = state.currentLocationId) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]+$/u.test(id)) fail('REFERENCE', 'Choose one bare recorded area ID.');
  const value = state.areas[`area:${locationId}:${id}`];
  if (!value || value.id !== id || value.locationId !== locationId) fail('REFERENCE', 'The selected area is not recorded.');
  return value;
}

function near(state, origin, target, maximum = 1) {
  if (origin.locationId !== target.locationId) return false;
  return origin.area === (target.area ?? target.id) || maximum >= 1 && areaRecord(state, origin.area).adjacent.includes(target.area ?? target.id);
}

function requireRange(state, origin, target, maximum, visible = false) {
  if (!near(state, origin, target, maximum) || visible && areaRecord(state, target.area ?? target.id).visible !== true) fail('RANGE', 'The target is outside the ordinary action range or visibility.');
}

function itemRecord(state, ref) {
  if (typeof ref !== 'string' || !/^item:[A-Za-z0-9][A-Za-z0-9_.:-]*$/u.test(ref)) fail('REFERENCE', 'Choose an exact recorded item.');
  const item = state.items[ref];
  if (!item || item.id !== ref || item.lost) fail('REFERENCE', 'The selected item is not available.');
  return item;
}

function heldTool(state, actor) {
  return Object.values(state.items).some(item => item.holder === actor && !item.lost && item.condition !== 'broken'
    && (item.kind === 'tool' || item.type === 'tool' || item.tags?.includes('tool')));
}

function npcProfile(actor) {
  const kit = actor.npcKit;
  const profile = NPC_PROFILES[kit?.id];
  if (!profile || actor.npcProfile !== kit.id || kit.version !== NPC_PROFILE_VERSION || kit.mainActions !== 1
    || !isDeepStrictEqual(kit.actions, profile.actions) || !isDeepStrictEqual(kit.tells, profile.actions.map(action => action.tell))
    || actor.maxHealth !== profile.health || (actor.scale || 'person') !== (profile.scale || 'person')) fail('KIT', 'The NPC does not have an intact authored encounter kit.');
  return profile;
}

function ordinaryWeapon(state, actor, source, action) {
  if (action.method === 'unarmed') {
    if (Object.hasOwn(action, 'item')) fail('EQUIPMENT', 'An unarmed attack cannot select an item.');
    return 'graze';
  }
  const item = itemRecord(state, action.item);
  const permissions = CLASS_EQUIPMENT_PERMISSIONS[source.classBuild.familyId];
  const definition = item.equipmentId ? CLASS_EQUIPMENT[item.equipmentId] : null;
  if (item.holder !== actor || !item.weapon || !item.wielded || item.condition === 'broken'
    || item.weaponKind !== `${action.method}_weapon` || !permissions?.weapons.includes(item.weaponCategory)) fail('EQUIPMENT', 'The attack requires one usable, trained, wielded weapon.');
  if (definition && (definition.weaponKind !== item.weaponKind || definition.weaponCategory !== item.weaponCategory)) fail('EQUIPMENT', 'The weapon disagrees with its authored equipment definition.');
  return 'wound';
}

function checkFor(state, actor, source, skill, { target = null, attack = ['melee', 'ranged'].includes(skill), defaultTier = 'standard', tierBasis = 'A grounded ordinary action.' } = {}) {
  if (!CATALOG_SKILLS.includes(skill)) fail('SKILL', 'A known authored skill is required.');
  const profile = CLASS_PROFILES[source.classState.profile];
  const origin = areaRecord(state, source.area);
  const contextual = (profile?.contextualSkills ?? []).filter(entry => entry.skill === skill && origin[entry.context] === true)
    .reduce((sum, entry) => sum + entry.bonus, 0);
  const skillBonus = (source.skills?.[skill] ?? 0) + contextual;
  if (!Number.isSafeInteger(skillBonus) || skillBonus < 0 || skillBonus > 75) fail('STATE', 'The ordinary skill bonus is outside the signed bounds.');
  const deltaSources = [];
  for (const [token, condition] of Object.entries(source.conditions)) {
    if (condition.class === 'hindrance' || ['steadied', 'inspired'].includes(token)) deltaSources.push({ direction: condition.class === 'hindrance' ? 'hinders' : 'favors', magnitude: 'slight', reason: `Acting character is ${token}.`, source: { kind: 'condition', ref: actor, token } });
  }
  if (skill === 'pilot' && source.classBuild.familyId === 'rider') {
    const ref = source.classState.vehicle?.vehicleRef;
    const vehicle = state.vehicles[ref];
    const condition = vehicle?.conditions?.steadied;
    if (vehicle?.operator === actor && vehicle.controller === actor && vehicle.status === 'active' && vehicle.hull > 0
      && vehicle.locationId === source.locationId && vehicle.area === source.area && vehicle.occupants?.includes(actor)
      && condition?.vehicle === ref && condition.condition === 'steadied' && condition.class === 'boon' && condition.duration === 'scene') {
      deltaSources.push({ direction: 'favors', magnitude: 'slight', reason: 'The occupied craft has recorded steadied footing.',
        source: { kind: 'vehicle_condition', ref, token: 'steadied' } });
    }
  }
  for (const entry of profile?.checkDeltas ?? []) if (entry.skill === skill && (!entry.context || origin[entry.context] === true)) {
    deltaSources.push({ direction: entry.direction, magnitude: entry.magnitude, reason: entry.reason, source: { kind: 'class_profile', ref: actor, profile: profile.id } });
  }
  if (target && attack) {
    const victim = actorRecord(state, target);
    if (victim.conditions.exposed) deltaSources.push({ direction: 'favors', magnitude: 'slight', reason: 'The target is exposed.', source: { kind: 'condition', ref: target, token: 'exposed' } });
    for (const [ref, feature] of Object.entries(state.features)) if (feature.status === 'active' && feature.area === `area:${victim.locationId}:${victim.area}`
      && ['cover', 'smoke', 'darkness'].includes(feature.kind) && ['party', 'both'].includes(feature.works_against)) {
      const kind = feature.origin === 'mundane' ? feature.kind === 'cover' ? 'mundane_cover' : 'mundane_aim'
        : feature.origin === 'magical' ? 'magical_ward' : 'recorded_obstacle';
      deltaSources.push({ direction: 'hinders', magnitude: 'slight', reason: `Recorded ${feature.kind} affects the attack.`, source: { kind, ref } });
    }
  }
  return { skill, skillBonus, defaultTier, tierBasis, deltaSources };
}

/** Shared evidence candidates, not an extra roll or unbounded delta list. The
 * signed check caller chooses at most three grounded deltas. Spell consumers
 * explicitly mark an attack; a Lore check alone does not imply harmful magic.
 */
export function buildOrdinaryCheckContext({ state, actor, skill, target = null, attack = ['melee', 'ranged'].includes(skill) } = {}) {
  if (typeof attack !== 'boolean') fail('SHAPE', 'Check attack context must be explicit boolean data.');
  const source = actingCharacter(state, actor);
  return freeze(checkFor(state, actor, source, skill, { target, attack }));
}

function opponent(state, target, context) {
  const value = actorRecord(state, target);
  if (!target.startsWith('npc:') || value.party || !context.affirmedOpposed.includes(target)) fail('ALLEGIANCE', 'An ordinary attack requires a recorded or explicitly affirmed opposing NPC.');
  return value;
}

/** One explicit world action. Council owns prose classification and grounded
 * signed-check judgment; this authorizer owns permissions, quantities and refs.
 */
export function prepareOrdinaryAction({ state, actor, action, context = {} } = {}) {
  const source = actingCharacter(state, actor);
  const frame = contextFor(state, actor, context);
  shape(action, ['kind'], ['target', 'method', 'item', 'area', 'object', 'locationId', 'skill', 'subject', 'discoveryId']);
  let onSuccess = [];
  const onFailure = [];
  let check = null;
  let targets = [];
  let discovery = null;
  switch (action.kind) {
    case 'attack': {
      shape(action, ['kind', 'target', 'method'], ['item']);
      if (!['melee', 'ranged', 'unarmed'].includes(action.method)) fail('SHAPE', 'Choose a melee, ranged or unarmed attack.');
      const target = opponent(state, action.target, frame);
      const profile = npcProfile(target);
      requireRange(state, source, target, action.method === 'ranged' ? 1 : 0, true);
      const grade = ordinaryWeapon(state, actor, source, action);
      onSuccess = [{ op: 'harm', who: action.target, grade }];
      check = checkFor(state, actor, source, action.method === 'ranged' ? 'ranged' : 'melee', { target: action.target,
        defaultTier: (profile.skills.endure ?? 0) >= 10 ? 'hard' : 'standard', tierBasis: profile.defense });
      check.opposition = { kind: 'npc_kit', ref: action.target, profile: target.npcProfile, version: NPC_PROFILE_VERSION, skill: 'endure', value: profile.skills.endure ?? 0 };
      targets = [action.target];
      break;
    }
    case 'move': {
      shape(action, ['kind', 'area']);
      const destination = areaRecord(state, action.area);
      if (source.area === action.area) fail('NO_OP', 'The character is already in that area.');
      requireRange(state, source, destination, 1);
      if (!destination.safeToOccupy || destination.blocked) fail('RANGE', 'The destination is not an ordinary traversable area.');
      const threatened = frame.affirmedOpposed.some(ref => state.actors[ref].health > 0 && state.actors[ref].area === source.area);
      if (source.conditions.pinned) fail('PRECONDITION', 'The recorded pinned condition must be cleared before ordinary movement.');
      if (threatened || source.conditions.hindered) check = checkFor(state, actor, source, 'move', { tierBasis: 'Leaving a threatened or hindered position.' });
      onSuccess = [{ op: 'reposition', who: actor, area: action.area, quality: 'neutral' }];
      targets = [`area:${state.currentLocationId}:${action.area}`];
      break;
    }
    case 'aid': {
      shape(action, ['kind', 'target']);
      const target = actorRecord(state, action.target);
      if (action.target === actor || !target.party || target.willing === false
        || action.target.startsWith('character:') && !frame.consentingActors?.includes(action.target)) fail('CONSENT', 'Aid requires another willing party member and any required player consent.');
      requireRange(state, source, target, 1, true);
      if (target.conditions.inspired) fail('NO_OP', 'That ally is already inspired.');
      if (state.encounter.active) check = checkFor(state, actor, source, 'leadership');
      onSuccess = [{ op: 'boon_apply', who: action.target, condition: 'inspired', duration: 'scene', detail: 'A party member committed an action to helping.' }];
      targets = [action.target];
      break;
    }
    case 'unlock':
    case 'disable': {
      shape(action, ['kind', 'object']);
      const target = state.objects[action.object];
      if (typeof action.object !== 'string' || !/^object:[A-Za-z0-9][A-Za-z0-9_.:-]*$/u.test(action.object) || !target) fail('REFERENCE', 'Choose a recorded mechanism.');
      requireRange(state, source, target, 0);
      if (target.security !== 'ordinary' || target.protectedSystem || !['lock', 'mechanism'].includes(target.kind)) fail('PERMISSION', 'This object exceeds ordinary mechanical access.');
      if (!heldTool(state, actor) || (source.skills.craft ?? 0) < 1) fail('TRAINING', 'Working this mechanism requires trained Craft and usable tools.');
      if (action.kind === 'unlock' && (target.kind !== 'lock' || !target.locked || target.opposed)) fail('PRECONDITION', 'Choose an ordinary unopposed locked mechanism.');
      if (action.kind === 'disable' && target.disabled) fail('NO_OP', 'That mechanism is already disabled.');
      onSuccess = [{ op: action.kind === 'unlock' ? 'object_unlock' : 'object_disable', object: action.object, maximumSecurity: 'ordinary', ...(action.kind === 'disable' ? { duration: 'scene' } : {}) }];
      check = checkFor(state, actor, source, 'craft');
      targets = [action.object];
      break;
    }
    case 'pickup':
    case 'drop':
    case 'wield':
    case 'consume': {
      shape(action, ['kind', 'item']);
      const item = itemRecord(state, action.item);
      if (action.kind === 'pickup') {
        if (item.holder !== `area:${source.locationId}:${source.area}` || item.fixed || item.natural) fail('CUSTODY', 'Only a loose movable item in this area can be picked up.');
        onSuccess = [{ op: 'item_pickup', owner: actor, item: action.item }];
      } else {
        if (item.holder !== actor || item.fixed || item.natural) fail('CUSTODY', 'The character must hold that movable item.');
        if (action.kind === 'drop') onSuccess = [{ op: 'item_drop', item: action.item, area: source.area }];
        else if (action.kind === 'wield') onSuccess = [{ op: 'item_ready', owner: actor, item: action.item }];
        else {
          if (item.kind !== 'consumable' || !isDeepStrictEqual(item.consume, { id: 'mundane-supply', version: ORDINARY_CONSUMABLE_VERSION })) fail('PERMISSION', 'This item has no ordinary consumption permission.');
          onSuccess = [{ op: 'item_lose', item: action.item }];
        }
      }
      targets = [action.item];
      break;
    }
    case 'travel': {
      shape(action, ['kind', 'locationId', 'area']);
      positive(action.locationId, 'destination location');
      const destination = areaRecord(state, action.area, action.locationId);
      if (state.encounter.active || action.locationId === state.currentLocationId || !destination.safeToOccupy
        || !areaRecord(state, source.area).exits.includes(`area:${action.locationId}:${action.area}`)) fail('RANGE', 'Ordinary travel requires a recorded safe route outside an active encounter.');
      onSuccess = [{ op: 'location_transition', location: `location:${action.locationId}`, area: action.area }];
      targets = [`area:${action.locationId}:${action.area}`];
      break;
    }
    case 'skill': {
      shape(action, ['kind', 'skill', 'subject', 'discoveryId']);
      if (!Object.hasOwn(SKILL_SCOPES, action.skill)) fail('SKILL', 'This is not a supported ordinary discovery skill.');
      const subject = state.actors[action.subject] ?? state.areas[action.subject] ?? state.objects[action.subject];
      if (!subject || subject.present === false) fail('REFERENCE', 'The discovery subject is not present and recorded.');
      requireRange(state, source, subject, 1, true);
      const matches = subject.knowledge?.filter(entry => entry.id === action.discoveryId) ?? [];
      const found = matches[0];
      if (matches.length !== 1 || found.discovered || !SKILL_SCOPES[action.skill].includes(found.scope)
        || typeof found.fact !== 'string' || state.facts.some(entry => effectComparisonKey(entry.fact) === effectComparisonKey(found.fact))) fail('KNOWLEDGE', 'That skill has no undiscovered eligible fact on this subject.');
      discovery = { subject: action.subject, id: found.id };
      onSuccess = [{ op: 'fact_learn', fact: found.fact }];
      check = checkFor(state, actor, source, action.skill);
      targets = [action.subject];
      break;
    }
    default: fail('KIND', 'This ordinary action kind is not authorized.');
  }
  const started = finalizeClassEvent({ state, plan: prepareClassEvent({ state, event: { type: 'main_started', who: actor }, context: frame }) });
  applyIncoming(started.state, onSuccess, frame);
  return freeze({ schemaVersion: 1, version: ORDINARY_ACTION_VERSION, sourceHash: hash(state), actor,
    operationId: context.operationId, turn: context.turn, consumeMain: true, check, targets, onSuccess, onFailure, discovery,
    request: { actor, action: clone(action), context: clone(context) } });
}

function applyIncoming(state, effects, context) {
  return finalizeIncomingClassEffects({ state, plan: prepareClassEvent({ state, event: { type: 'incoming_effects', effects }, context }) });
}

export function finalizeOrdinaryAction({ state, plan, outcome } = {}) {
  if (!['success', 'failure'].includes(outcome)) fail('OUTCOME', 'An engine-owned success or failure is required.');
  if (hash(state) !== plan?.sourceHash) fail('STALE', 'The ordinary action was prepared against another state.');
  if (!isDeepStrictEqual(prepareOrdinaryAction({ state, ...plan.request }), plan)) fail('PLAN', 'The ordinary action receipt is not canonical.');
  if (!plan.check && outcome !== 'success') fail('OUTCOME', 'A deterministic permitted action cannot receive a fabricated failed check.');
  const context = contextFor(state, plan.actor, plan.request.context);
  const started = finalizeClassEvent({ state, plan: prepareClassEvent({ state, event: { type: 'main_started', who: plan.actor }, context }) });
  const result = applyIncoming(started.state, outcome === 'success' ? plan.onSuccess : plan.onFailure, context);
  if (outcome === 'success' && plan.discovery) {
    const subject = result.state.actors[plan.discovery.subject] ?? result.state.areas[plan.discovery.subject] ?? result.state.objects[plan.discovery.subject];
    const discovery = subject.knowledge.find(entry => entry.id === plan.discovery.id);
    discovery.discovered = true;
    discovery.discoveredTurn = context.turn;
  }
  return { ...result, events: [...started.events, ...result.events], operationId: plan.operationId, consumeMain: true };
}

/** An explicitly selected NPC kit action spends one authored Main for the
 * recorded round. It never creates a check, reaction roll or extra PC action.
 */
export function prepareNpcConsequence({ state, actingActor, npc, actionId, target, context = {} } = {}) {
  actingCharacter(state, actingActor, false);
  const frame = contextFor(state, actingActor, context, true);
  const source = actorRecord(state, npc);
  if (!npc.startsWith('npc:') || !source.party && !frame.affirmedOpposed.includes(npc)) fail('ALLEGIANCE', 'NPC consequences require a party or affirmed opposing actor.');
  const profile = npcProfile(source);
  const action = profile.actions.find(entry => entry.id === actionId);
  if (!action) fail('KIT', 'The selected action is not in this NPC kit.');
  if (source.npcState) {
    shape(source.npcState, [], ['lastMainRound', 'lastMainOperationId', 'lastActionId']);
    if (source.npcState.lastMainRound !== undefined && (positive(source.npcState.lastMainRound, 'NPC spent round') > context.round
      || typeof source.npcState.lastMainOperationId !== 'string' || !profile.actions.some(entry => entry.id === source.npcState.lastActionId))) fail('STATE', 'The recorded NPC action budget is inconsistent.');
  }
  if (source.npcState?.lastMainRound === context.round) fail('BUDGET', 'That NPC has already spent its Main action this round.');
  let effects = [];
  if (action.kind === 'vehicle_attack') {
    const victim = typeof target === 'string' && /^vehicle:[A-Za-z0-9][A-Za-z0-9_.:-]*$/u.test(target) ? state.vehicles[target] : null;
    if (!victim || victim.locationId !== state.currentLocationId || victim.hull <= 0 || victim.status !== 'active') fail('REFERENCE', 'Choose one present active recorded craft.');
    const operator = actorRecord(state, victim.operator);
    if (operator.party === source.party || !operator.party && !frame.affirmedOpposed.includes(victim.operator)
      || operator.area !== victim.area || !victim.occupants?.includes(victim.operator)) fail('ALLEGIANCE', 'A hull attack requires an opposing occupied craft.');
    requireRange(state, source, victim, action.range === 'near' ? 1 : 0, true);
    effects = [{ op: 'vehicle_harm', who: target, grade: action.harm }];
  } else if (action.kind === 'attack') {
    const victim = actorRecord(state, target);
    if (target === npc || victim.party === source.party || !victim.party && !frame.affirmedOpposed.includes(target)) fail('ALLEGIANCE', 'The NPC attack must name an actual opposing actor.');
    requireRange(state, source, victim, action.range === 'near' ? 1 : 0, true);
    if (action.requires !== 'none' && !Object.values(state.items).some(item => item.holder === npc && !item.lost && item.wielded && item.weapon
      && item.weaponKind === action.requires && item.condition !== 'broken')) fail('EQUIPMENT', 'This NPC kit attack requires its recorded usable weapon.');
    effects = [{ op: 'harm', who: target, grade: action.harm }];
  } else if (action.kind === 'move') {
    const destination = areaRecord(state, target);
    requireRange(state, source, destination, 1);
    if (source.area === target || !destination.safeToOccupy || destination.blocked || source.conditions.pinned) fail('RANGE', 'The NPC has no permitted ordinary movement to that area.');
    effects = [{ op: 'reposition', who: npc, area: target, quality: 'neutral' }];
  } else {
    const who = action.kind === 'guard' ? npc : target;
    if (action.kind === 'guard' && target !== undefined && target !== npc) fail('TARGET', 'The guard action targets only its acting NPC.');
    const recipient = actorRecord(state, who);
    if (recipient.party !== source.party || !recipient.party && !frame.affirmedOpposed.includes(who)) fail('ALLEGIANCE', 'This NPC support action requires an allied target.');
    requireRange(state, source, recipient, action.kind === 'guard' ? 0 : 1, true);
    if (recipient.conditions[action.condition]) fail('NO_OP', 'The NPC condition is already active.');
    effects = [{ op: 'boon_apply', who, condition: action.condition, duration: 'scene', detail: action.tell }];
  }
  applyIncoming(state, effects, frame);
  return freeze({ schemaVersion: 1, version: ORDINARY_ACTION_VERSION, sourceHash: hash(state), actingActor, npc, actionId,
    operationId: context.operationId, turn: context.turn, round: context.round, check: null, consumeMain: true,
    tell: action.tell, effects, request: { actingActor, npc, actionId, ...(target === undefined ? {} : { target }), context: clone(context) } });
}

export function finalizeNpcConsequence({ state, plan } = {}) {
  if (hash(state) !== plan?.sourceHash) fail('STALE', 'The NPC consequence was prepared against another state.');
  if (!isDeepStrictEqual(prepareNpcConsequence({ state, ...plan.request }), plan)) fail('PLAN', 'The NPC consequence receipt is not canonical.');
  const result = applyIncoming(state, plan.effects, contextFor(state, plan.actingActor, plan.request.context, true));
  result.state.actors[plan.npc].npcState = { ...(result.state.actors[plan.npc].npcState ?? {}), lastMainRound: plan.round,
    lastMainOperationId: plan.operationId, lastActionId: plan.actionId };
  return { ...result, operationId: plan.operationId, consumeMain: true, tell: plan.tell };
}
