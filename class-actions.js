import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import {
  CATALOG_VERSION, CATALOG_RULES_VERSION, CATALOG_RESOLUTION_VERSION, CATALOG_EFFECT_VERSION,
  CLASS_PROFILES, COMPANION_PROFILES, CLASS_EQUIPMENT_PERMISSIONS,
  getAbilityDefinition, getClassBranch
} from './class-catalog.js';
import { evaluateEffects, EFFECT_VALUES } from './rules-effects.js';

export const CLASS_ACTION_VERSION = 'class-actions-1';
export const SUPPORTED_CLASS_MODES = Object.freeze({
  maneuver: ['push', 'brace', 'intervene', 'skirmish', 'advance'], quarry: ['mark', 'follow', 'hunt'],
  exposure: ['raise', 'lower', 'set', 'consume_reprisal', 'endure', 'last_stand'],
  sequence: ['enter', 'transition', 'finish', 'terrain_step', 'traverse'], opening: ['create', 'consume'],
  preparation: ['cast'], channel: ['base', 'overreach', 'strain'], declaration: ['bind', 'act', 'pursue', 'limited_guard'],
  profile: ['replace', 'action', 'traverse', 'alternate', 'sense', 'switch_and_move'],
  device: ['use', 'deploy', 'deploy_or_fire', 'relocate'],
  companion: ['attack', 'coordinate', 'scout', 'rescue', 'recover', 'replace', 'advance_attack', 'replace_attack'],
  cue: ['set'], vehicle: ['move_attack', 'move', 'attack', 'repair', 'board_move', 'hold', 'impact'],
  ritual: ['work'], passive: ['modifiers']
});
export const SUPPORTED_CLASS_HANDLERS = Object.freeze(Object.keys(SUPPORTED_CLASS_MODES).sort());
const HINDRANCES = ['hindered', 'exposed', 'dazed', 'pinned', 'winded'];
const GRADES = ['graze', 'wound', 'grievous'];
const clone = value => structuredClone(value);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

function fail(code, message) {
  const error = new Error(message);
  error.code = `CLASS_ACTION_${code}`;
  throw error;
}

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('SHAPE', `${label} must be an object.`);
  return value;
}

function actorRecord(state, ref, { alive = true, present = true } = {}) {
  if (typeof ref !== 'string' || !/^(character|npc):[1-9]\d*$/u.test(ref)) fail('REFERENCE', 'An exact typed actor reference is required.');
  const value = state.actors?.[ref];
  if (!value) fail('REFERENCE', `Actor ${ref} is not recorded.`);
  if (present && (value.present === false || value.locationId !== state.currentLocationId)) fail('RANGE', 'The actor is outside the current scene.');
  if (alive && (value.health <= 0 || ['dead', 'defeated', 'incapacitated'].includes(value.status))) fail('INCAPACITATED', 'The actor cannot perform this action.');
  return value;
}

function areaRecord(state, area, location = state.currentLocationId) {
  const qualified = typeof area === 'string' && area.startsWith('area:');
  const entry = qualified ? state.areas?.[area] : state.areas?.[`area:${location}:${area}`];
  if (!entry) fail('REFERENCE', 'A recorded destination area is required.');
  return entry;
}

function distance(state, from, to, location = state.currentLocationId) {
  if (from === to) return 0;
  const seen = new Set([from]);
  let frontier = [from];
  for (let steps = 1; steps <= 2; steps += 1) {
    const next = [];
    for (const id of frontier) for (const adjacent of areaRecord(state, id, location).adjacent || []) {
      if (adjacent === to) return steps;
      if (!seen.has(adjacent)) { seen.add(adjacent); next.push(adjacent); }
    }
    frontier = next;
  }
  return Infinity;
}

function inRange(state, origin, subject, range) {
  if (range === 'known') return true;
  if (subject.locationId !== origin.locationId) return false;
  return distance(state, origin.area, subject.area ?? subject.id, origin.locationId) <= ({ self: 0, engaged: 0, near: 1, far: 2 }[range] ?? -1);
}

function validatePins(actor, state) {
  const build = actor.classBuild;
  if (!build || build.catalogVersion !== CATALOG_VERSION || build.rulesVersion !== CATALOG_RULES_VERSION
    || build.resolutionVersion !== CATALOG_RESOLUTION_VERSION || build.effectCatalogVersion !== CATALOG_EFFECT_VERSION
    || build.optionSet !== 'expert' || state.effectCatalogVersion !== CATALOG_EFFECT_VERSION) fail('VERSION', 'Class action pins are missing or incompatible.');
  if (!getClassBranch(build.familyId, build.branchId) || actor.classState?.branchId !== build.branchId) fail('STATE', 'The class state does not match its authored branch.');
  if (build.familyId === 'catalyst' && build.capabilities?.alliedActors !== true) fail('CAPABILITY', 'Catalyst requires the campaign allied-actor guarantee.');
  if (build.familyId === 'rider' && (build.capabilities?.rider !== true || !build.modules?.includes('rider'))) fail('CAPABILITY', 'Rider requires its enabled campaign module and guarantees.');
}

function consent(state, ref, actor, context) {
  const selected = actorRecord(state, ref, { alive: false });
  if (ref !== actor && ref.startsWith('character:') && !context.consentingActors?.includes(ref)) fail('CONSENT', 'This choice requires the other player recorded consent.');
  if (ref !== actor && selected.party && selected.willing === false) fail('CONSENT', 'The allied actor is unwilling.');
}

function knownSubject(state, ref) {
  return state.actors?.[ref] || state.objects?.[ref] || state.areas?.[ref] || state.vehicles?.[ref];
}

function targetsFor(state, actor, definition, bindings, context, origin) {
  const type = definition.targeting.kind;
  const selected = bindings.targets === undefined ? [] : bindings.targets;
  if (!Array.isArray(selected) || new Set(selected).size !== selected.length) fail('TARGET', 'Targets must be an explicit unique array.');
  let targets = [...selected];
  if (type === 'self') {
    if (targets.some(ref => ref !== actor)) fail('TARGET', 'This ability targets only its owner.');
    targets = [actor];
  } else if (type === 'area_all_actors') {
    const destination = areaRecord(state, bindings.area);
    if (!inRange(state, origin, destination, definition.targeting.range) || destination.visible !== true) fail('RANGE', 'Choose a visible area within the authored range.');
    targets = Object.entries(state.actors).filter(([, value]) => value.present !== false && value.locationId === destination.locationId && value.area === destination.id && value.status !== 'dead').map(([ref]) => ref);
    if (selected.length && !isDeepStrictEqual([...selected].sort(), [...targets].sort())) fail('TARGET', 'An area spell cannot omit occupants or allies.');
    if (!targets.length) fail('TARGET', 'The selected area contains no actor targets.');
    targets.forEach(ref => { if (ref.startsWith('character:')) consent(state, ref, actor, context); });
  } else if (['area', 'known_area', 'willing_allies_and_area'].includes(type)) {
    const destination = areaRecord(state, bindings.area);
    if (!inRange(state, origin, destination, definition.targeting.range)) fail('RANGE', 'The destination is outside the authored range.');
    if (type === 'known_area') targets = [`area:${destination.locationId}:${destination.id}`];
    else if (type === 'willing_allies_and_area') {
      targets = bindings.travelers || targets;
      if (!Array.isArray(targets) || !targets.includes(actor) || new Set(targets).size !== targets.length) fail('TARGET', 'Transit travelers must explicitly include the caster once.');
      targets.forEach(ref => consent(state, ref, actor, context));
    } else targets = [actor];
  } else if (type === 'self_or_enemy' && !targets.length && context.mode === 'deploy') targets = [actor];
  else if (type === 'installation') {
    const id = bindings.installation || targets[0];
    if (targets.length > 1 || !id) fail('TARGET', 'Choose one owned installation.');
    targets = [id];
  } else if (type === 'object') targets = [bindings.object || targets[0]].filter(Boolean);
  if (!targets.length || targets.length > definition.targeting.maximum) fail('TARGET', 'Target count is outside the authored bound.');
  if (new Set(targets).size !== targets.length) fail('TARGET', 'Targets cannot repeat.');

  for (const ref of targets) {
    if (type === 'installation') continue;
    const subject = knownSubject(state, ref);
    if (!subject) fail('REFERENCE', 'A target is not recorded.');
    if (ref.startsWith('area:')) continue;
    if (!inRange(state, origin, subject, definition.targeting.range)) fail('RANGE', 'A target is outside the authored range.');
    if (ref.startsWith('object:')) {
      if (!['object', 'actor_or_object'].includes(type)) fail('TARGET', 'This ability cannot target an object.');
      continue;
    }
    const subjectActor = actorRecord(state, ref, { alive: type !== 'fallen_ally' });
    if (['enemy', 'enemy_and_ally', 'enemy_and_area'].includes(type) && (subjectActor.party || !context.affirmedOpposed?.includes(ref))) fail('TARGET', 'An enemy target requires affirmed opposition.');
    if (['ally', 'fallen_ally'].includes(type)) {
      if (!subjectActor.party) fail('TARGET', 'An allied target is required.');
      consent(state, ref, actor, context);
    }
    if (type === 'fallen_ally' && subjectActor.status !== 'dead') fail('TARGET', 'This ability requires a recorded dead ally.');
  }
  if (type === 'enemy_and_ally') {
    const allied = actorRecord(state, bindings.ally);
    if (!allied.party || !inRange(state, actorRecord(state, actor), allied, 'near')) fail('TARGET', 'Choose a nearby allied actor.');
    consent(state, bindings.ally, actor, context);
  }
  return targets;
}

function validateRequirements(state, actor, definition, targets, bindings, context) {
  const source = actorRecord(state, actor);
  const cs = source.classState;
  const chosen = knownSubject(state, targets[0]);
  for (const requirement of definition.requirements) {
    switch (requirement.kind) {
      case 'target_condition':
      case 'self_condition': {
        const refs = requirement.kind === 'self_condition' ? [actor] : targets;
        for (const ref of refs) {
          const token = bindings.conditions?.[ref] || bindings.condition;
          const record = state.actors[ref]?.conditions?.[token];
          if (!requirement.tokens.includes(token) || !record || requirement.duration && record.duration !== requirement.duration) fail('PRECONDITION', 'Choose an eligible active recorded condition.');
        }
        break;
      }
      case 'target_is_quarry': if (cs.quarry?.target !== targets[0]) fail('PRECONDITION', 'The selected target is not your quarry.'); break;
      case 'quarry_route': if (!cs.quarry?.trail?.length) fail('PRECONDITION', 'Your quarry has no recorded trail to follow.'); break;
      case 'exposure_minimum': if ((cs.exposure || 0) < requirement.value) fail('PRECONDITION', 'The required Exposure has not been reached.'); break;
      case 'reprisal_available': if (cs.reprisal !== 1) fail('PRECONDITION', 'No actual endured-harm Reprisal is available.'); break;
      case 'target_has_opening': if (cs.opening?.target !== targets[0]) fail('PRECONDITION', 'No Opening belongs to this target.'); break;
      case 'opening_available': if (!cs.opening) fail('PRECONDITION', 'No Opening is available.'); break;
      case 'target_is_ward': if (cs.declaration?.binding !== 'ward' || cs.declaration.target !== targets[0]) fail('PRECONDITION', 'The selected ally is not your ward.'); break;
      case 'target_is_judged': if (cs.declaration?.binding !== 'foe' || cs.declaration.target !== targets[0]) fail('PRECONDITION', 'The selected enemy is not your judged foe.'); break;
      case 'enemy_engaged_with_ward': {
        const ward = state.actors[cs.declaration?.target];
        if (cs.declaration?.binding !== 'ward' || !ward || ward.area !== chosen?.area || !inRange(state, source, ward, 'near')) fail('PRECONDITION', 'The enemy must engage your active nearby ward.');
        break;
      }
      case 'known_target_area': if (!chosen?.area || chosen.visible === false) fail('PRECONDITION', 'The target current area must be known.'); break;
      case 'ordinary_unopposed_lock': if (chosen?.kind !== 'lock' || chosen.security !== 'ordinary' || chosen.opposed || chosen.protectedSystem || !chosen.locked) fail('PRECONDITION', 'An ordinary unopposed locked mechanism is required.'); break;
      case 'ordinary_mechanism': if (!['lock', 'mechanism'].includes(chosen?.kind) || chosen.security !== 'ordinary' || chosen.protectedSystem) fail('PRECONDITION', 'Only an ordinary recorded mechanism is eligible.'); break;
      case 'companion_and_self_engaged':
      case 'companion_engaged_with_target': {
        const companion = actorRecord(state, cs.companion?.actorRef);
        if (companion.area !== chosen?.area || requirement.kind === 'companion_and_self_engaged' && source.area !== chosen?.area) fail('PRECONDITION', 'The companion and required actors must engage the same target.');
        break;
      }
      case 'willing_target':
      case 'willing_targets': targets.forEach(ref => consent(state, ref, actor, context)); break;
      default: fail('UNSUPPORTED', `Unsupported authored requirement: ${requirement.kind}`);
    }
  }
}

function activeCover(state, destination) {
  return Object.values(state.features || {}).some(feature => feature.status === 'active' && feature.kind === 'cover' && feature.location === state.currentLocationId && feature.area === `area:${state.currentLocationId}:${destination}`);
}

function areaHasContext(area, context) {
  return area[context] === true || area.environment === context;
}

function validateRoute(state, origin, route, maximum) {
  if (!Array.isArray(route) || !route.length || route.length > maximum) fail('ROUTE', 'An explicit bounded route is required.');
  let previous = origin;
  for (const destination of route) {
    const area = areaRecord(state, destination);
    if (!areaRecord(state, previous).adjacent?.includes(area.id) || area.safeToOccupy !== true || area.blocked === true) fail('ROUTE', 'The route must use connected occupiable unblocked areas.');
    previous = area.id;
  }
  return previous;
}

function bindTemplates(templates, state, actor, targets, bindings, context) {
  const source = state.actors[actor];
  const records = [];
  const replacements = {
    $self: actor, $ally: bindings.ally, $ward: source.classState.declaration?.target,
    $companion: source.classState.companion?.actorRef, $vehicle: source.classState.vehicle?.vehicleRef,
    $item: bindings.item, $catalyst: bindings.catalyst, $object: bindings.object || targets.find(ref => ref.startsWith('object:')),
    $feature: bindings.feature, $travelers: bindings.travelers || targets,
    $passengers: (source.classState.vehicle?.occupants || []).filter(ref => ref !== actor),
    $area: bindings.area || source.area
  };
  for (const template of templates) {
    const repeats = JSON.stringify(template).includes('$target') || JSON.stringify(template).includes('$condition') ? targets : [targets[0]];
    for (const selected of repeats) {
      const current = { ...replacements, $target: selected, $condition: bindings.conditions?.[selected] || bindings.condition };
      const effect = {};
      for (const [key, value] of Object.entries(template)) {
        if (key === 'optional') continue;
        effect[key] = typeof value === 'string' && value.startsWith('$') ? current[value] : clone(value);
        if (effect[key] === undefined) fail('BINDING', `The authored ${key} requires an explicit recorded binding.`);
      }
      if (effect.op === 'reposition' && bindings.areas?.[effect.who]) effect.area = bindings.areas[effect.who];
      if (effect.op === 'reveal' && ['area_features', 'companion_scout'].includes(effect.scope)) {
        const destination = areaRecord(state, bindings.area);
        effect.subject = `area:${destination.locationId}:${destination.id}`;
      }
      const expand = Array.isArray(effect.who) && effect.op !== 'teleport' ? effect.who : [effect.who];
      for (const who of expand) {
        const concrete = { ...effect, ...(who === undefined ? {} : { who }) };
        if (concrete.op === 'condition_clear' && !state.actors[who]?.conditions?.[concrete.condition] && template.optional === true) continue;
        if (['boon_apply', 'hindrance_apply'].includes(concrete.op) && state.actors[who]?.conditions?.[concrete.condition]) continue;
        if (concrete.op === 'reposition') {
          const moving = actorRecord(state, who);
          const path = context.route || [concrete.area];
          validateRoute(state, moving.area, path, context.authoredMaximumDistance || 1);
          if (path.at(-1) !== concrete.area) fail('ROUTE', 'The route and selected destination disagree.');
        }
        if (concrete.op === 'disarm') {
          const item = state.items?.[concrete.item];
          if (!item || item.lost || item.holder !== who || !item.weapon || !item.wielded || item.natural || item.fixed) fail('PRECONDITION', 'Choose a recorded held removable weapon.');
        }
        records.push(concrete);
      }
    }
  }
  return records;
}

function patchActor(patches, actor, fields) {
  patches.actors[actor] = { ...(patches.actors[actor] || {}), ...clone(fields) };
}

function validateContext(context) {
  if (typeof context.operationId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/u.test(context.operationId)) fail('SHAPE', 'A stable action operation ID is required.');
  if (!Number.isSafeInteger(context.turn) || context.turn < 1) fail('SHAPE', 'A positive ledger turn is required.');
  if (context.overreach !== undefined && typeof context.overreach !== 'boolean') fail('SHAPE', 'Overreach must be an explicit binary choice.');
}

export function prepareClassAction({ state, actor, ability, bindings = {}, context = {} } = {}) {
  object(state, 'State'); object(bindings, 'Bindings'); object(context, 'Context'); validateContext(context);
  if (!/^character:[1-9]\d*$/u.test(actor)) fail('ACTOR', 'A player-owned acting character is required.');
  const source = actorRecord(state, actor);
  validatePins(source, state);
  const abilityId = typeof ability === 'string' ? ability : ability?.id;
  const owned = source.abilities?.find(entry => entry.id === abilityId);
  if (!owned) fail('OWNERSHIP', 'The selected opaque ability ID is not owned by the acting character.');
  const definition = getAbilityDefinition(owned.definition_id, owned.definition_version);
  if (!definition || definition.branchId !== source.classBuild.branchId || definition.grantedAtLevel > source.level
    || owned.invocation?.family_key !== definition.familyId || owned.invocation?.schema_version !== 1) fail('ENTITLEMENT', 'The owned definition is not a legal active grant for this class version.');
  if (typeof ability === 'object' && (ability.definition_id !== owned.definition_id || ability.definition_version !== owned.definition_version)) fail('OWNERSHIP', 'Selected definition metadata disagrees with its owned instance.');
  if (definition.activation === 'passive') fail('PASSIVE', 'Passive grants are not player-invoked actions.');
  const originalBindings = clone(bindings);
  const originalContext = clone(context);
  bindings = clone(bindings); context = clone(context);
  delete context.authoredMaximumDistance;
  const mechanic = definition.mechanic;
  if (mechanic.kind !== 'none' && !SUPPORTED_CLASS_MODES[mechanic.kind]?.includes(mechanic.mode || (mechanic.kind === 'ritual' ? 'work' : 'modifiers'))) fail('UNSUPPORTED', 'The authored class mode has no executable handler.');
  const before = source.classState;
  const afterUse = clone(before);
  const afterSuccess = clone(before);
  for (const cs of [afterUse, afterSuccess]) {
    cs.brace = null;
    cs.endure = null;
    if (cs.declaration?.guard) delete cs.declaration.guard;
    cs.lastMainOperationId = context.operationId;
  }
  const set = (key, value, when = 'use') => {
    if (when === 'use') afterUse[key] = clone(value);
    afterSuccess[key] = clone(value);
  };
  const successPatches = { actors: {}, vehicles: {} };
  const failurePatches = { actors: {}, vehicles: {} };
  let successTemplates = clone(definition.onSuccess);
  let failureTemplates = clone(definition.onFailure);
  let check = clone(definition.check);
  let phase = 'complete';
  let origin = source;
  if (['armsmaster', 'berserker', 'oathbound', 'opportunist'].includes(definition.familyId)
    && ['melee', 'ranged'].includes(definition.check?.skill) && definition.onSuccess.some(effect => effect.op === 'harm')) {
    const permissions = CLASS_EQUIPMENT_PERMISSIONS[definition.familyId];
    const weapons = Object.entries(state.items || {}).filter(([ref, item]) => item.holder === actor && item.weapon && item.wielded && !item.lost && item.condition !== 'broken'
      && item.weaponKind === `${definition.check.skill}_weapon` && permissions.weapons.includes(item.weaponCategory)
      && (!bindings.weapon || ref === bindings.weapon));
    if (weapons.length !== 1) fail('EQUIPMENT', 'An exact usable trained wielded weapon is required; choose one explicitly when several qualify.');
  }
  const cadenceKey = definition.cadence.kind === 'scene_use' ? 'sceneUses' : definition.cadence.kind === 'recovery_use' ? 'recoveryUses' : null;
  if (cadenceKey && (before[cadenceKey]?.[definition.id] || 0) >= definition.cadence.uses) fail('EXHAUSTED', 'This authored ability has no uses remaining in its current cadence.');
  if (mechanic.kind === 'companion') {
    origin = actorRecord(state, before.companion?.actorRef);
    if (before.companion?.status !== 'active' || before.companion.sharedMain !== true) fail('STATE', 'An active companion with the shared action budget is required.');
  }
  if (mechanic.kind === 'vehicle') {
    origin = state.vehicles?.[before.vehicle?.vehicleRef];
    if (!origin || origin.operator !== actor || origin.hull <= 0 || origin.status !== 'active') fail('STATE', 'An active owned vehicle is required.');
  }
  const effectiveDefinition = clone(definition);
  if (mechanic.kind === 'channel' && context.overreach && mechanic.range) effectiveDefinition.targeting.range = mechanic.range;
  if (mechanic.useProfileAttack) effectiveDefinition.targeting.range = COMPANION_PROFILES[before.companion.profile]?.attackRange;
  const targets = targetsFor(state, actor, effectiveDefinition, bindings, context, origin);
  validateRequirements(state, actor, definition, targets, bindings, context);
  if (cadenceKey && mechanic.mode !== 'last_stand' && mechanic.kind !== 'ritual') {
    const uses = { ...(before[cadenceKey] || {}), [definition.id]: (before[cadenceKey]?.[definition.id] || 0) + 1 };
    set(cadenceKey, uses);
  }
  const replaceGrade = grade => { successTemplates = successTemplates.map(effect => ['harm', 'heal'].includes(effect.op) ? { ...effect, grade } : effect); };
  const routeFor = (ref, maximum, destination = bindings.area) => {
    const moving = actorRecord(state, ref);
    const route = context.route || [destination];
    const end = validateRoute(state, moving.area, route, maximum);
    bindings.area = end;
    context.authoredMaximumDistance = maximum;
    return { op: 'reposition', who: ref, area: end, quality: 'favorable' };
  };

  switch (mechanic.kind) {
    case 'none': break;
    case 'maneuver':
      if (mechanic.mode === 'brace') set('brace', { remaining: 1, area: source.area, sourceAbilityId: abilityId, armedTurn: context.turn });
      else if (mechanic.mode === 'intervene') {
        const destination = state.actors[bindings.ally].area;
        if (state.actors[targets[0]].area !== destination) fail('TARGET', 'Intervention strikes only a foe engaged with the selected ally.');
        if (bindings.area && bindings.area !== destination) fail('TARGET', 'Intervention must finish with the selected ally.');
        bindings.area = destination;
      }
      break;
    case 'quarry':
      if (mechanic.mode === 'mark') set('quarry', { target: targets[0], trail: [], lastKnownArea: state.actors[targets[0]].area, sourceAbilityId: abilityId }, 'success');
      else if (['follow', 'hunt'].includes(mechanic.mode)) {
        if (!before.quarry?.trail?.length) fail('PRECONDITION', 'No recorded quarry trail is available.');
        const maximum = mechanic.maximumDistance;
        const route = context.route || before.quarry.trail.slice(0, maximum);
        if (!route.every((id, index) => id === before.quarry.trail[index])) fail('ROUTE', 'Follow the actual recorded quarry trail.');
        bindings.area = route.at(-1); context.route = route;
        successTemplates = successTemplates.filter(effect => effect.op !== 'reveal' && effect.op !== 'reposition');
        successTemplates.push(routeFor(actor, maximum));
        set('quarry', { ...before.quarry, trail: before.quarry.trail.slice(route.length) }, 'success');
      } else fail('UNSUPPORTED', 'Unknown quarry action.');
      break;
    case 'exposure':
      if (mechanic.mode === 'raise') {
        if ((before.exposure || 0) + mechanic.amount > mechanic.maximum) fail('RESOURCE', 'Exposure is already too high for this escalation.');
        set('exposure', (before.exposure || 0) + mechanic.amount);
      } else if (mechanic.mode === 'lower') {
        if (!before.exposure) fail('NO_OP', 'Exposure is already zero.');
        set('exposure', Math.max(0, before.exposure - mechanic.amount));
      } else if (mechanic.mode === 'set') set('exposure', mechanic.value);
      else if (mechanic.mode === 'consume_reprisal') set('reprisal', 0);
      else if (['endure', 'last_stand'].includes(mechanic.mode)) set('endure', { remaining: 1, area: source.area, sourceAbilityId: abilityId, armedTurn: context.turn, refuseDefeat: mechanic.mode === 'last_stand' });
      else fail('UNSUPPORTED', 'Unknown Exposure action.');
      break;
    case 'sequence':
      if (mechanic.bonusFrom === before.stance) {
        successTemplates.push(...clone(mechanic.bonus || []));
        if (mechanic.replaceGrade) replaceGrade(mechanic.replaceGrade);
      }
      if (mechanic.mode === 'terrain_step') {
        const destination = areaRecord(state, bindings.area);
        if (!destination.surfaces?.length && destination.supported !== true) fail('PRECONDITION', 'A recorded supporting surface is required.');
        if (mechanic.coverBoon && activeCover(state, destination.id)) successTemplates.push({ op: 'boon_apply', who: actor, condition: mechanic.coverBoon, duration: 'scene', detail: 'Recorded destination cover.' });
      }
      if (mechanic.mode === 'traverse') successTemplates.unshift(routeFor(actor, mechanic.maximumDistance));
      set('stance', mechanic.stance || 'ready');
      break;
    case 'opening':
      if (mechanic.mode === 'create') set('opening', { target: targets[0], sourceAbilityId: abilityId, appliedTurn: context.turn }, 'success');
      else if (mechanic.mode === 'consume') {
        set('opening', null);
        if (mechanic.clearTokens && !mechanic.clearTokens.includes(bindings.condition)) fail('PRECONDITION', 'Choose a printed removable condition.');
        if (mechanic.coverBoon && activeCover(state, source.area)) successTemplates.push({ op: 'boon_apply', who: actor, condition: mechanic.coverBoon, duration: 'scene', detail: 'Recorded ambush cover.' });
      } else fail('UNSUPPORTED', 'Unknown Opening action.');
      break;
    case 'preparation':
      if (mechanic.requiresPrepared && !before.prepared?.includes(definition.id)) fail('PREPARATION', 'This learned immediate spell is not prepared.');
      break;
    case 'channel': {
      const overreach = mechanic.mode === 'overreach' && context.overreach === true;
      if (context.overreach && mechanic.mode !== 'overreach') fail('CHOICE', 'This spell has no overreach line.');
      if (overreach || mechanic.mode === 'strain') {
        if ((before.strain || 0) + mechanic.strain > mechanic.maximum) fail('RESOURCE', 'This overreach exceeds the authored Strain limit.');
        const strain = (before.strain || 0) + mechanic.strain;
        set('strain', strain);
        if (overreach) { successTemplates.push(...clone(mechanic.bonus || [])); if (mechanic.replaceGrade) replaceGrade(mechanic.replaceGrade); }
        if (strain === mechanic.maximum && !source.conditions?.[mechanic.thresholdCondition]) {
          const effect = { op: 'hindrance_apply', who: actor, condition: mechanic.thresholdCondition, duration: 'persistent', detail: 'Channeling strain.' };
          successTemplates.push(effect); failureTemplates.push(clone(effect)); set('strainConditionSource', context.operationId);
        }
      }
      break;
    }
    case 'declaration': {
      if (mechanic.mode === 'bind') set('declaration', { binding: mechanic.binding, target: mechanic.binding === 'area' ? `area:${state.currentLocationId}:${source.area}` : targets[0], area: source.area, sourceAbilityId: abilityId, appliedTurn: context.turn }, 'success');
      else {
        const declaration = before.declaration;
        if (!declaration || declaration.binding !== mechanic.binding) fail('PRECONDITION', 'The required declaration is not active.');
        if (declaration.binding === 'ward' && !inRange(state, source, actorRecord(state, declaration.target), 'near')) fail('RANGE', 'Your ward has left the declaration range.');
        if (mechanic.mode === 'pursue') successTemplates = [routeFor(actor, mechanic.maximumDistance, state.actors[targets[0]].area), ...successTemplates.filter(effect => effect.op !== 'reposition')];
        if (mechanic.mode === 'limited_guard') {
          bindings.area = state.actors[declaration.target].area;
          if (source.area === bindings.area) successTemplates = successTemplates.filter(effect => effect.op !== 'reposition');
          set('declaration', { ...declaration, guard: { remaining: 1, sourceAbilityId: abilityId, armedTurn: context.turn } }, 'success');
        }
      }
      break;
    }
    case 'profile': {
      if (['replace', 'switch_and_move'].includes(mechanic.mode)) {
        const profileId = mechanic.profile === '$profile' ? bindings.profile : mechanic.profile;
        if (!before.learnedProfiles?.includes(profileId) || !CLASS_PROFILES[profileId]) fail('PRECONDITION', 'Choose an actually learned complete profile.');
        if (before.profile === profileId && mechanic.mode === 'replace') fail('NO_OP', 'That complete profile is already active.');
        const baseSkills = before.baseSkills || source.skills;
        const profile = CLASS_PROFILES[profileId];
        const skills = Object.fromEntries(Object.entries(baseSkills).map(([name, bonus]) => [name, Math.max(0, Math.min(75, bonus + (profile.skills[name] || 0)))]));
        set('profile', profileId, 'success'); set('baseSkills', baseSkills, 'success');
        patchActor(successPatches, actor, { skills, profileCapabilities: profile });
        if (mechanic.mode === 'switch_and_move') successTemplates.push(routeFor(actor, mechanic.maximumDistance));
      } else {
        if (mechanic.bonusProfile === before.profile) { successTemplates.push(...clone(mechanic.bonus || [])); if (mechanic.replaceGrade) replaceGrade(mechanic.replaceGrade); }
        if (mechanic.mode === 'alternate' && context.mode === 'alternate') {
          if (before.profile !== mechanic.profile) fail('PRECONDITION', 'The explicit alternate needs its printed profile.');
          successTemplates = clone(mechanic.alternate);
        }
        if (mechanic.mode === 'sense' && !CLASS_PROFILES[before.profile]?.senses.length) fail('PRECONDITION', 'Your current profile grants no exceptional senses.');
        if (mechanic.mode === 'traverse') successTemplates.unshift(routeFor(actor, mechanic.maximumDistance));
      }
      break;
    }
    case 'device': {
      if (mechanic.mode === 'use' && !before.prepared?.includes(definition.id)) fail('PREPARATION', 'This authored device is not in the prepared kit.');
      const installations = clone(before.installations || []);
      if (['deploy', 'deploy_or_fire'].includes(mechanic.mode)) {
        if (mechanic.mode === 'deploy_or_fire' && context.mode === 'fire') {
          const installation = installations.find(entry => entry.id === bindings.installation && entry.status === 'active' && entry.kind === mechanic.installation);
          if (!installation) fail('PRECONDITION', 'Choose your active relay installation.');
          const foe = state.actors[targets[0]];
          if (!foe || foe.party || !inRange(state, installation, foe, 'near')) fail('RANGE', 'A relay target must be near its installation.');
          successTemplates.push(...clone(mechanic.payload));
        } else {
          if (mechanic.mode === 'deploy_or_fire' && context.mode !== 'deploy') fail('CHOICE', 'Choose deploy or fire explicitly.');
          const retire = bindings.retireInstallation === undefined ? [] : [].concat(bindings.retireInstallation);
          if (new Set(retire).size !== retire.length) fail('CHOICE', 'Installation retirement cannot repeat.');
          for (const id of retire) {
            const entry = installations.find(installation => installation.id === id && installation.status === 'active');
            if (!entry) fail('OWNERSHIP', 'Only an active owned installation can be retired.');
            entry.status = 'retired'; entry.retiredBy = context.operationId;
            for (const feature of entry.features || []) if (state.features[feature]?.status === 'active') successTemplates.unshift({ op: 'scene_feature_clear', feature });
          }
          const slots = mechanic.slots || 1;
          if (installations.filter(entry => entry.status === 'active').reduce((sum, entry) => sum + entry.slots, 0) + slots > before.installationCapacity) fail('CAPACITY', 'Explicitly retire an installation before exceeding capacity.');
          installations.push({ id: `installation:${context.operationId}`, kind: mechanic.installation, slots, area: bindings.area || source.area, locationId: source.locationId, status: 'active', health: 8, maxHealth: 8, source: context.operationId, features: [], trigger: mechanic.trigger || null, payload: clone(mechanic.payload || []), maximumTriggers: mechanic.maximumTriggers || 0, triggerCount: 0 });
          set('installations', installations, 'success');
          check = mechanic.mode === 'deploy_or_fire' ? null : check;
        }
      } else if (mechanic.mode === 'relocate') {
        const installation = installations.find(entry => entry.id === targets[0] && entry.status === 'active');
        if (!installation) fail('OWNERSHIP', 'Choose an active owned installation.');
        const destination = validateRoute(state, installation.area, context.route || [bindings.area], mechanic.maximumDistance);
        for (const ref of installation.features) {
          const prior = state.features[ref];
          if (prior?.status === 'active') successTemplates.push({ op: 'scene_feature_clear', feature: ref }, { op: 'scene_feature_place', area: destination, kind: prior.kind, name: prior.name, duration: prior.duration, works_against: prior.works_against });
        }
        installation.area = destination; installation.health = Math.min(installation.maxHealth, installation.health + mechanic.repair); installation.features = []; installation.source = context.operationId;
        set('installations', installations, 'success');
      }
      break;
    }
    case 'companion': {
      const companionRef = before.companion.actorRef;
      const companion = actorRecord(state, companionRef);
      if (mechanic.useProfileAttack) replaceGrade(COMPANION_PROFILES[before.companion.profile].attackGrade);
      if (['replace', 'replace_attack'].includes(mechanic.mode)) {
        const profileId = mechanic.profile === '$profile' ? bindings.profile : mechanic.profile;
        if (!before.learnedProfiles?.includes(profileId) || !COMPANION_PROFILES[profileId]) fail('PRECONDITION', 'Choose an actually learned companion profile.');
        if (profileId === before.companion.profile && mechanic.mode === 'replace') fail('NO_OP', 'That companion profile is already active.');
        const profile = COMPANION_PROFILES[profileId];
        const branch = getClassBranch(source.classBuild.branchId);
        const maximum = branch.progression[source.level - 1].companionMaxHealth + profile.healthBonus;
        const health = Math.max(1, Math.min(maximum, Math.floor(companion.health / companion.maxHealth * maximum)));
        set('companion', { ...before.companion, profile: profileId, health, maxHealth: maximum, area: source.area }, 'success');
        patchActor(successPatches, companionRef, { profile: profileId, profileCapabilities: profile, health, maxHealth: maximum, area: source.area });
      }
      if (['scout', 'advance_attack'].includes(mechanic.mode)) successTemplates.unshift(routeFor(companionRef, mechanic.maximumDistance));
      if (mechanic.mode === 'scout') bindings.area = `area:${state.currentLocationId}:${bindings.area}`;
      if (mechanic.mode === 'rescue' && !COMPANION_PROFILES[before.companion.profile].canCarry) fail('PRECONDITION', 'This companion profile cannot carry another actor.');
      set('companion', { ...afterSuccess.companion, lastMainOperationId: context.operationId }, 'success');
      break;
    }
    case 'cue': {
      targets.forEach(ref => consent(state, ref, actor, context));
      const cueAlly = definition.targeting.kind === 'enemy_and_ally' ? bindings.ally : targets[0];
      if (cueAlly === actor) fail('PRECONDITION', 'Catalyst cues require another allied actor, not a self-cue.');
      if (mechanic.payload.some(effect => effect.op === 'reposition')) validateRoute(state, state.actors[cueAlly].area, [bindings.area], 1);
      set('cue', { ally: cueAlly, target: definition.targeting.kind === 'enemy_and_ally' ? targets[0] : null, trigger: mechanic.trigger, payload: clone(mechanic.payload), area: bindings.area || null, requiresCover: mechanic.requiresCover || false, sourceAbilityId: abilityId, source: context.operationId, appliedTurn: context.turn }, 'success');
      break;
    }
    case 'vehicle': {
      const vehicleRef = before.vehicle.vehicleRef;
      const vehicle = state.vehicles[vehicleRef];
      const nextVehicle = {};
      if (['move', 'move_attack', 'board_move'].includes(mechanic.mode)) {
        const destination = validateRoute(state, vehicle.area, context.route || [bindings.area], mechanic.maximumDistance);
        if (mechanic.mode === 'move_attack') {
          const reached = state.actors[targets[0]];
          if (!reached || distance(state, destination, reached.area) > (before.vehicle.profile === 'cavalier' ? 0 : 1)) fail('RANGE', 'The chosen vehicle route does not reach the attack target.');
        }
        nextVehicle.area = destination;
        const passengers = (before.vehicle.occupants || []).filter(ref => ref !== actor);
        if (mechanic.mode === 'board_move') {
          for (const ref of targets) { consent(state, ref, actor, context); if (state.actors[ref].area !== vehicle.area) fail('RANGE', 'Passengers must be engaged with the vehicle.'); if (!passengers.includes(ref) && ref !== actor) passengers.push(ref); }
          if (passengers.length > before.vehicle.passengerCapacity || targets.length > mechanic.maximumPassengers) fail('CAPACITY', 'Passenger capacity is exceeded.');
        }
        for (const ref of [actor, ...passengers]) {
          const traveler = state.actors[ref];
          if (!traveler || traveler.area !== vehicle.area) fail('STATE', 'Recorded occupants must actually occupy the vehicle area.');
          patchActor(successPatches, ref, { area: destination });
        }
        set('vehicle', { ...before.vehicle, area: destination, occupants: [actor, ...passengers], lastMainOperationId: context.operationId }, 'success');
        nextVehicle.occupants = [actor, ...passengers]; nextVehicle.passengers = [...passengers];
      }
      if (mechanic.mode === 'hold') set('vehicle', { ...before.vehicle, hold: { source: context.operationId, area: vehicle.area }, lastMainOperationId: context.operationId }, 'success');
      if (mechanic.mode === 'impact') {
        const targetActor = state.actors[targets[0]];
        if (targetActor.scale !== 'vehicle' || targetActor.immovable) fail('PRECONDITION', 'Impact needs a movable vehicle-scale target.');
      }
      successPatches.vehicles[vehicleRef] = nextVehicle;
      break;
    }
    case 'ritual': {
      const subject = state.actors[targets[0]];
      for (const requirement of mechanic.requirements) {
        if (requirement === 'recorded_focus' && areaRecord(state, source.area).focus !== true) fail('PRECONDITION', 'A recorded ritual focus is required.');
        if (requirement === 'visited_area' && areaRecord(state, bindings.area).visited !== true) fail('PRECONDITION', 'The ritual destination must be previously visited.');
        if (requirement === 'intact_body' && subject?.intactBody !== true) fail('PRECONDITION', 'The fallen ally intact body must be recorded.');
        if (requirement === 'willing_return' && subject?.willingReturn !== true) fail('CONSENT', 'The fallen ally has not chosen to return.');
        if (requirement === 'willing_travelers') (bindings.travelers || []).forEach(ref => consent(state, ref, actor, context));
        if (requirement === 'revival_catalyst') {
          const item = state.items?.[bindings.catalyst];
          if (!item || item.holder !== actor || item.kind !== 'revival-catalyst' || item.lost) fail('PRECONDITION', 'An exact held revival catalyst is required.');
        }
      }
      // Validate the eventual revival before recording progress; discard the pure preview state.
      const revival = bindTemplates(definition.onSuccess.filter(effect => effect.op === 'revive'), state, actor, targets, bindings, context);
      if (revival.length) evaluateEffects({ state, effects: revival, consumer: 'ability', actor: Number(actor.split(':')[1]),
        turn: context.turn, transactionId: context.operationId, affirmedOpposed: context.affirmedOpposed || [] });
      const identity = hash({ definitionId: definition.id, targets, bindings, area: source.area });
      if (before.ritual && !isDeepStrictEqual(
        { definitionId: before.ritual.definitionId, targets: before.ritual.targets, bindings: before.ritual.bindings, area: before.ritual.area },
        { definitionId: definition.id, targets, bindings, area: source.area }
      )) fail('RITUAL', 'Finish or explicitly abandon the active working before changing its bindings.');
      const completed = (before.ritual?.completed || 0) + 1;
      if (completed < mechanic.steps) {
        phase = 'ritual_progress'; check = null; successTemplates = []; failureTemplates = [];
        set('ritual', { identity, definitionId: definition.id, abilityId, completed, required: mechanic.steps, area: source.area, targets: clone(targets), bindings: clone(bindings), startedTurn: before.ritual?.startedTurn || context.turn });
      } else {
        set('ritual', null);
        if (cadenceKey) set(cadenceKey, { ...(before[cadenceKey] || {}), [definition.id]: (before[cadenceKey]?.[definition.id] || 0) + 1 });
      }
      break;
    }
    default: fail('UNSUPPORTED', `No executable class handler exists for ${mechanic.kind}.`);
  }

  const onSuccess = bindTemplates(successTemplates, state, actor, targets, bindings, context);
  const onFailure = bindTemplates(failureTemplates, state, actor, targets, bindings, context);
  const selfMoveIndex = onSuccess.findIndex(effect => effect.op === 'reposition' && effect.who === actor);
  const harmIndex = onSuccess.findIndex(effect => effect.op === 'harm');
  const selfMove = onSuccess[selfMoveIndex];
  if (selfMove && definition.check?.skill === 'melee' && harmIndex > selfMoveIndex) {
    if (targets.some(ref => state.actors[ref]?.area !== selfMove.area)) fail('RANGE', 'The selected movement does not bring the melee target into reach.');
  }
  const profile = CLASS_PROFILES[before.profile];
  const classDeltas = (profile?.checkDeltas || []).filter(delta => delta.skill === check?.skill && (!delta.context || areaHasContext(areaRecord(state, source.area), delta.context))).map(({ skill: ignored, context: ignoredContext, ...delta }) => delta);
  const contextualBonus = (profile?.contextualSkills || []).filter(entry => entry.skill === check?.skill && areaHasContext(areaRecord(state, source.area), entry.context)).reduce((sum, entry) => sum + entry.bonus, 0);
  if (check) check = { ...check, skillBonus: Math.min(75, (source.skills?.[check.skill] || 0) + contextualBonus), classDeltas, ignoredDeltaSources: clone(mechanic.ignoredDeltaSources || []) };
  return freeze({
    schemaVersion: 1, version: CLASS_ACTION_VERSION, sourceHash: hash(state), actor, abilityId,
    definitionId: definition.id, definitionVersion: definition.version, operationId: context.operationId,
    turn: context.turn, phase, consumeMain: true, check, targets, onSuccess, onFailure,
    afterUse, afterSuccess, successPatches, failurePatches,
    request: { actor, ability: abilityId, bindings: originalBindings, context: originalContext }
  });
}

function mergePatches(state, patches) {
  for (const [ref, fields] of Object.entries(patches.actors)) Object.assign(state.actors[ref], clone(fields));
  for (const [ref, fields] of Object.entries(patches.vehicles)) Object.assign(state.vehicles[ref], clone(fields));
}

export function finalizeClassAction({ state, plan, outcome, effectResult } = {}) {
  if (!['success', 'failure'].includes(outcome)) fail('OUTCOME', 'An engine-owned success or failure is required.');
  if (hash(state) !== plan?.sourceHash) fail('STALE', 'The class action was prepared against a different state.');
  const expected = prepareClassAction({ state, ...plan.request });
  if (!isDeepStrictEqual(expected, plan)) fail('PLAN', 'The prepared class action is not canonical.');
  const effects = outcome === 'success' ? plan.onSuccess : plan.onFailure;
  const eventContext = { ...plan.request.context, actor: plan.actor, operationId: plan.operationId, turn: plan.turn, consumer: 'ability' };
  const incoming = prepareClassEvent({ state, event: { type: 'incoming_effects', effects }, context: eventContext });
  const result = finalizeIncomingClassEffects({ state, plan: incoming });
  if (effectResult && !isDeepStrictEqual(effectResult, result)) fail('RECEIPT', 'The effect receipt disagrees with the canonical action effects.');
  const next = result.state;
  mergePatches(next, outcome === 'success' ? plan.successPatches : plan.failurePatches);
  const ownClassState = clone(outcome === 'success' ? plan.afterSuccess : plan.afterUse);
  for (const [key, value] of Object.entries(result.state.actors[plan.actor].classState || {})) {
    const prior = state.actors[plan.actor].classState[key];
    if (['companion', 'vehicle'].includes(key) && value && prior && ownClassState[key]) {
      // Effect projections may update position or vitals without erasing planned control fields.
      for (const field of new Set([...Object.keys(prior), ...Object.keys(value)])) {
        if (isDeepStrictEqual(value[field], prior[field])) continue;
        if (Object.hasOwn(value, field)) ownClassState[key][field] = clone(value[field]);
        else delete ownClassState[key][field];
      }
    } else if (!isDeepStrictEqual(value, prior)) ownClassState[key] = clone(value);
  }
  next.actors[plan.actor].classState = ownClassState;
  const cs = next.actors[plan.actor].classState;
  for (const installation of cs.installations || []) if (installation.source === plan.operationId && installation.status === 'active') {
    installation.features = Object.entries(next.features).filter(([, feature]) => feature.source === plan.operationId && feature.status === 'active').map(([ref]) => ref);
  }
  synchronizeClassState(next);
  return { state: next, effects: result.effects, events: result.events, provenance: result.provenance, operationId: plan.operationId, phase: plan.phase };
}

function synchronizeClassState(state) {
  for (const value of Object.values(state.actors || {})) {
    if (value.resources?.health) {
      value.resources.health.current = value.health;
      if (Object.hasOwn(value.resources.health, 'max')) value.resources.health.max = value.maxHealth;
      if (Object.hasOwn(value.resources.health, 'maximum')) value.resources.health.maximum = value.maxHealth;
    }
    const cs = value.classState;
    if (!cs) continue;
    for (const name of ['strain', 'exposure']) if (value.resources?.[name]) value.resources[name].current = cs[name] || 0;
    if (cs.companion?.actorRef && state.actors[cs.companion.actorRef]) {
      const companion = state.actors[cs.companion.actorRef];
      Object.assign(cs.companion, { health: companion.health, maxHealth: companion.maxHealth, area: companion.area, conditions: clone(companion.conditions), status: companion.status });
    }
    if (cs.vehicle?.vehicleRef && state.vehicles?.[cs.vehicle.vehicleRef]) {
      const vehicle = state.vehicles[cs.vehicle.vehicleRef];
      Object.assign(cs.vehicle, { hull: vehicle.hull, maxHull: vehicle.maxHull, area: vehicle.area, status: vehicle.status, occupants: clone(vehicle.occupants || []) });
    }
  }
}

export function prepareClassEvent({ state, event, context = {} } = {}) {
  object(state, 'State'); object(event, 'Event'); validateContext(context);
  const next = clone(state);
  const effects = [];
  const harmFloors = [];
  const provenance = [];
  let adjustedEffects = null;
  const ownerEntries = Object.entries(next.actors).filter(([ref, value]) => ref.startsWith('character:') && value.classBuild && value.classState);
  const retire = (installation, reason) => {
    installation.status = 'retired'; installation.retiredBy = context.operationId;
    for (const ref of installation.features || []) if (next.features[ref]?.status === 'active') effects.push({ op: 'scene_feature_clear', feature: ref });
    installation.retirementReason = reason;
  };
  const resetCommitments = cs => { cs.brace = null; cs.endure = null; if (cs.declaration?.guard) delete cs.declaration.guard; };
  switch (event.type) {
    case 'incoming_effects': {
      if (!Array.isArray(event.effects)) fail('SHAPE', 'Incoming effects must be an array.');
      adjustedEffects = clone(event.effects);
      for (const [effectIndex, effect] of adjustedEffects.entries()) {
        if (effect.op !== 'harm') continue;
        const victim = actorRecord(next, effect.who);
        let index = GRADES.indexOf(effect.grade);
        if (index < 0) fail('SHAPE', 'Incoming harm needs an authored grade.');
        const originalGrade = effect.grade;
        const sources = [];
        const cs = victim.classState;
        if (cs?.profile && CLASS_PROFILES[cs.profile]?.incomingGradeReduction) {
          index = Math.max(0, index - CLASS_PROFILES[cs.profile].incomingGradeReduction);
          sources.push({ actor: effect.who, handler: 'profile', profile: cs.profile });
        }
        if (cs?.exposure > 0) {
          index = Math.min(2, index + 1); cs.exposure -= 1;
          sources.push({ actor: effect.who, handler: 'exposure', mode: 'risk' });
        }
        if (cs?.brace?.remaining > 0 && cs.brace.area === victim.area && victim.health > 0) {
          index = Math.max(0, index - 1); cs.brace = null;
          sources.push({ actor: effect.who, handler: 'maneuver', mode: 'brace' });
        }
        if (cs?.endure?.remaining > 0 && victim.health > 0) {
          const endure = cs.endure;
          index = Math.max(0, index - 1); cs.endure = null;
          cs.pendingReprisal = { operationId: context.operationId, priorHealth: victim.health };
          sources.push({ actor: effect.who, handler: 'exposure', mode: 'endure' });
          if (endure.refuseDefeat && victim.health <= EFFECT_VALUES.harm[GRADES[index]]) {
            const owned = victim.abilities.find(ability => ability.id === endure.sourceAbilityId);
            const definition = owned && getAbilityDefinition(owned.definition_id, owned.definition_version);
            if (!definition || definition.mechanic.kind !== 'exposure' || definition.mechanic.mode !== 'last_stand') fail('STATE', 'The armed last stand has no owned authored definition.');
            if ((cs.recoveryUses?.[definition.id] || 0) >= definition.cadence.uses) fail('EXHAUSTED', 'The armed last stand has no recovery use remaining.');
            harmFloors.push({ effectIndex, who: effect.who, minimum: 1, sourceAbilityId: owned.id });
          }
        }
        for (const [owner, guardian] of ownerEntries) {
          const declaration = guardian.classState.declaration;
          if (declaration?.binding !== 'ward' || declaration.target !== effect.who || !declaration.guard?.remaining) continue;
          if (guardian.health > 0 && guardian.area === victim.area && guardian.locationId === victim.locationId) {
            index = Math.max(0, index - 1); delete declaration.guard;
            sources.push({ actor: owner, handler: 'declaration', mode: 'limited_guard' });
          }
        }
        effect.grade = GRADES[index];
        if (sources.length) provenance.push({ effectIndex, originalGrade, appliedGrade: effect.grade, sources });
      }
      break;
    }
    case 'health_changed': {
      const victim = actorRecord(next, event.who, { alive: false });
      if (!Number.isSafeInteger(event.before) || !Number.isSafeInteger(event.after) || event.after !== victim.health) fail('EVENT', 'Health lifecycle must match the actual effect receipt.');
      if (event.after < event.before && victim.classState) {
        victim.classState.ritual = null;
        if (victim.classState.pendingReprisal) victim.classState.reprisal = 1;
      }
      if (victim.classState) delete victim.classState.pendingReprisal;
      break;
    }
    case 'main_started': {
      const value = actorRecord(next, event.who);
      if (value.classState) { resetCommitments(value.classState); value.classState.lastMainOperationId = context.operationId; }
      break;
    }
    case 'movement': {
      const moving = actorRecord(next, event.who, { alive: false });
      if (moving.area !== event.to || !areaRecord(next, event.from)) fail('EVENT', 'Movement lifecycle must match the actual destination.');
      if (moving.classState) {
        resetCommitments(moving.classState);
        if (event.forced === true) moving.classState.ritual = null;
      }
      for (const [owner, value] of ownerEntries) {
        const cs = value.classState;
        if (cs.quarry?.target === event.who) {
          cs.quarry.lastKnownArea = event.to;
          cs.quarry.trail = [...(cs.quarry.trail || []), event.to].slice(-10);
        }
        if (cs.declaration?.binding === 'ward') {
          const ward = next.actors[cs.declaration.target];
          if (!ward || !inRange(next, value, ward, 'near')) cs.declaration = null;
        } else if (cs.declaration?.binding === 'area' && cs.declaration.area !== value.area) cs.declaration = null;
        if (cs.cue?.ally === event.who && cs.cue.trigger === 'ally_reposition') {
          const cue = cs.cue; cs.cue = null;
          if (!cue.requiresCover || activeCover(next, event.to)) effects.push(...bindTemplates(cue.payload, next, owner, [event.who], { ally: event.who, area: event.to }, context));
        }
        for (const installation of cs.installations || []) {
          if (installation.status !== 'active' || installation.trigger !== 'opposition_enters' || installation.area !== event.to || moving.party) continue;
          if (!context.affirmedOpposed?.includes(event.who)) fail('CONSENT', 'An installation trigger requires affirmed opposing status.');
          effects.push(...bindTemplates(installation.payload, next, owner, [event.who], {}, context));
          installation.triggerCount += 1;
          if (installation.triggerCount >= installation.maximumTriggers) retire(installation, 'trigger_consumed');
        }
      }
      break;
    }
    case 'action_completed': {
      actorRecord(next, event.who, { alive: false });
      if (typeof event.success !== 'boolean' || !['attack', 'help', 'protect', 'other'].includes(event.kind)) fail('EVENT', 'Action lifecycle needs a checked result and authored action kind.');
      for (const [owner, value] of ownerEntries) {
        const cue = value.classState.cue;
        if (!cue || cue.ally !== event.who) continue;
        const matches = cue.trigger === 'ally_check_completed' && event.checked === true
          || cue.trigger === 'ally_attack_success' && event.kind === 'attack' && event.success
          || cue.trigger === 'ally_attack_named_target_success' && event.kind === 'attack' && event.success && event.targets?.includes(cue.target)
          || cue.trigger === 'ally_help_success' && ['help', 'protect'].includes(event.kind) && event.success;
        if (!matches) continue;
        value.classState.cue = null;
        effects.push(...bindTemplates(cue.payload, next, owner, [cue.target || cue.ally], { ally: cue.ally, area: cue.area }, context));
      }
      break;
    }
    case 'scene_end':
      for (const [, value] of ownerEntries) {
        const cs = value.classState;
        Object.assign(cs, { sceneUses: {}, exposure: 0, reprisal: 0, stance: 'ready', opening: null, quarry: null, cue: null, declaration: null, ritual: null });
        resetCommitments(cs);
        for (const installation of cs.installations || []) if (installation.status === 'active') retire(installation, 'scene_end');
      }
      effects.length = 0;
      for (const value of Object.values(next.actors)) if (value.locationId === next.currentLocationId) {
        for (const [token, record] of Object.entries(value.conditions || {})) if (record.duration === 'scene') delete value.conditions[token];
      }
      for (const feature of Object.values(next.features)) if (feature.location === next.currentLocationId && feature.status === 'active' && feature.duration === 'scene') Object.assign(feature, { status: 'cleared', clearedBy: context.operationId, clearedTurn: context.turn });
      for (const vehicle of Object.values(next.vehicles || {})) if (vehicle.locationId === next.currentLocationId) {
        for (const [token, record] of Object.entries(vehicle.conditions || {})) if (record.duration === 'scene') delete vehicle.conditions[token];
      }
      break;
    case 'incapacitated': {
      const value = actorRecord(next, event.who, { alive: false });
      if (value.health > 0 && !['dead', 'defeated', 'incapacitated'].includes(value.status)) fail('EVENT', 'Incapacitation requires authoritative state.');
      if (value.classState) { resetCommitments(value.classState); value.classState.ritual = null; value.classState.declaration = null; }
      break;
    }
    default: fail('UNSUPPORTED', `Unsupported class lifecycle event: ${event.type}`);
  }
  synchronizeClassState(next);
  return freeze({ schemaVersion: 1, version: CLASS_ACTION_VERSION, sourceHash: hash(state), operationId: context.operationId, event: clone(event), context: clone(context), state: next, effects, adjustedEffects, harmFloors, provenance });
}

export function finalizeClassEvent({ state, plan, effectResult } = {}) {
  if (hash(state) !== plan?.sourceHash) fail('STALE', 'The class event was prepared against another state.');
  const expected = prepareClassEvent({ state, event: plan.event, context: plan.context });
  if (!isDeepStrictEqual(expected, plan)) fail('PLAN', 'The lifecycle receipt is not canonical.');
  if (plan.adjustedEffects) fail('EVENT', 'Incoming effects require their separate core effect commit and harm-floor receipt.');
  const actor = plan.context.actor || Object.keys(state.actors).find(ref => ref.startsWith('character:'));
  const evaluated = evaluateEffects({ state: plan.state, effects: plan.effects, consumer: 'ability', actor: Number(actor.split(':')[1]), turn: plan.context.turn, transactionId: plan.operationId, affirmedOpposed: plan.context.affirmedOpposed || [] });
  if (effectResult && !isDeepStrictEqual(effectResult, evaluated)) fail('RECEIPT', 'The lifecycle effect receipt is not canonical.');
  synchronizeClassState(evaluated.state);
  return { ...evaluated, operationId: plan.operationId, provenance: plan.provenance };
}

export function finalizeIncomingClassEffects({ state, plan, effectResult } = {}) {
  if (hash(state) !== plan?.sourceHash) fail('STALE', 'Incoming effects were prepared against another state.');
  if (!plan.adjustedEffects || !isDeepStrictEqual(prepareClassEvent({ state, event: plan.event, context: plan.context }), plan)) fail('PLAN', 'Incoming-effect receipt is not canonical.');
  const actor = plan.context.actor || Object.keys(state.actors).find(ref => ref.startsWith('character:'));
  const evaluated = evaluateEffects({ state: plan.state, effects: plan.adjustedEffects, consumer: plan.context.consumer || 'ordinary', actor: Number(actor.split(':')[1]), turn: plan.context.turn, transactionId: plan.operationId, affirmedOpposed: plan.context.affirmedOpposed || [], consentingActors: plan.context.consentingActors || [], harmFloors: plan.harmFloors });
  if (effectResult && !isDeepStrictEqual(effectResult, evaluated)) fail('RECEIPT', 'Incoming effect receipt disagrees with its canonical adjustments.');
  for (const event of evaluated.events.filter(entry => entry.type === 'health_changed')) {
    const value = evaluated.state.actors[event.who];
    if (!value?.classState) continue;
    if (event.after < event.before) { value.classState.ritual = null; if (value.classState.pendingReprisal) value.classState.reprisal = 1; }
    delete value.classState.pendingReprisal;
  }
  synchronizeClassState(evaluated.state);
  return { ...evaluated, operationId: plan.operationId, provenance: plan.provenance };
}
