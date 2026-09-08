import { validateRulesWorld } from './class-state.js';
import { CLASS_PROFILES, COMPANION_PROFILES, VEHICLE_PROFILES, getAbilityDefinition } from './class-catalog.js';

function fail(message) {
  const error = new Error(message);
  error.code = 'CLASS_COUNCIL_OPTIONS_INVALID';
  throw error;
}

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

function conditionTokens(record) {
  return Object.entries(record || {}).map(([token, condition]) => ({ token, duration: condition.duration }));
}

function areaRef(record) {
  return record?.area && record.locationId ? `area:${record.locationId}:${record.area}` : null;
}

function projectProfile(profile, current, companion) {
  return {
    id: profile.id, active: profile.id === current,
    subject: companion ? 'companion' : 'self', movement: [...profile.movement], senses: [...profile.senses],
    ...(companion ? { attackRange: profile.attackRange, canCarry: profile.canCarry, canHandleObjects: profile.canHandleObjects }
      : { naturalWeapon: profile.naturalWeapon, underwaterBreathing: profile.underwaterBreathing === true,
        movementRequirements: profile.movementRequirements ? { fly: profile.movementRequirements.fly } : {} })
  };
}

function requirementOptions(requirement) {
  return { kind: requirement.kind,
    ...(requirement.tokens ? { tokens: [...requirement.tokens] } : {}),
    ...(requirement.duration ? { duration: requirement.duration } : {}) };
}

function resolutionOptions({ ability, definition }, classState) {
  const active = classState.ritual;
  const progress = active?.abilityId === ability.id && active.definitionId === definition.id ? active.completed : 0;
  const workingPhase = definition.mechanic.kind === 'ritual'
    ? progress + 1 < definition.mechanic.steps ? 'preliminary' : 'completing' : null;
  const check = workingPhase === 'preliminary' ? null : definition.check;
  return { resolution: check ? { kind: 'contextual_check', skill: check.skill, defaultTier: check.defaultTier,
    automaticSuccess: false, omitOnlyFor: ['established_certainty', 'no_stakes'] } : { kind: 'no_check' },
  ...(workingPhase ? { workingPhase } : {}) };
}

function selectors(definition, source, profiles, installations) {
  const type = definition.targeting.kind;
  const mechanic = definition.mechanic;
  const bindings = {};
  const options = {};
  const destination = (required = true) => ({ type: definition.targeting.range === 'known' ? 'area_ref' : 'area_id',
    choices: 'knownAreas', required });
  if (['enemy', 'ally', 'fallen_ally', 'actor', 'actor_or_object', 'enemy_and_ally', 'enemy_and_area', 'self_or_enemy'].includes(type)) {
    bindings.targets = { type: 'recorded_subject_refs', relation: type,
      choices: type === 'actor_or_object' ? ['world.actors', 'world.objects'] : ['world.actors'],
      ...(type === 'self_or_enemy' ? { when: { mode: 'fire' } } : {}) };
  }
  if (type === 'enemy_and_ally') bindings.ally = { type: 'actor_ref', relation: 'willing_ally', choices: ['world.actors'] };
  if (['area', 'known_area', 'area_all_actors', 'enemy_and_area', 'willing_allies_and_area'].includes(type)) bindings.area = destination();
  if (type === 'area_all_actors') bindings.area.occupants = 'all_including_allies';
  if (type === 'willing_allies_and_area') bindings.travelers = { type: 'actor_refs', relation: 'explicit_willing_travelers_including_self', choices: ['world.actors'] };
  if (type === 'object') bindings.object = { type: 'object_ref', choices: ['world.objects'] };
  if (type === 'installation') bindings.installation = { type: 'installation_id', values: installations.map(value => value.id) };

  // Only selector-bearing template fields are projected. Effects, grade values,
  // costs and numeric mechanic configuration never cross this context boundary.
  const primaryTemplates = [...definition.onSuccess, ...definition.onFailure, ...(mechanic.payload || [])];
  const bonusWhen = mechanic.bonusFrom ? { stance: mechanic.bonusFrom } : mechanic.bonusProfile ? { profile: mechanic.bonusProfile }
    : mechanic.mode === 'overreach' ? { overreach: true } : null;
  const groups = [{ templates: primaryTemplates }, { templates: mechanic.bonus || [], when: bonusWhen },
    { templates: mechanic.alternate || [], when: { mode: 'alternate' } }];
  const templates = groups.flatMap(group => group.templates);
  const areaGroups = groups.filter(group => group.templates.some(effect => effect.area === '$area'));
  const areaWhen = areaGroups.length && areaGroups.every(group => group.when) ? { any: areaGroups.map(group => group.when) } : null;
  const uses = token => templates.some(effect => ['who', 'area', 'subject', 'item', 'feature', 'object', 'condition'].some(field => effect[field] === token));
  if (uses('$item')) bindings.item = { type: 'item_ref', choices: ['world.items'], relation: 'selected_subject_held_removable_weapon' };
  if (uses('$catalyst')) bindings.catalyst = { type: 'item_ref', choices: ['world.items'], relation: 'owned_revival_catalyst' };
  if (uses('$feature')) bindings.feature = { type: 'feature_ref', choices: ['world.features'] };
  if (uses('$object')) bindings.object = { type: 'object_ref', choices: ['world.objects'] };
  if (uses('$condition')) {
    const tokens = [...new Set([...definition.requirements.flatMap(value => value.tokens || []), ...(mechanic.clearTokens || [])])];
    bindings.condition = { type: 'active_condition_token', values: tokens };
    bindings.conditions = { type: 'subject_to_active_condition_map', values: tokens, optional: true };
  }
  if (uses('$area') && !bindings.area) bindings.area = { ...destination(templates.some(effect => ['reposition', 'traverse', 'teleport'].includes(effect.op))),
    ...(areaWhen ? { when: areaWhen } : {}) };
  if (['armsmaster', 'berserker', 'oathbound', 'opportunist'].includes(definition.familyId)
    && ['melee', 'ranged'].includes(definition.check?.skill) && definition.onSuccess.some(effect => effect.op === 'harm')) {
    bindings.weapon = { type: 'item_ref', choices: ['world.items'], relation: 'owned_trained_wielded_weapon', optional: true };
  }
  if (mechanic.profile === '$profile') bindings.profile = { type: 'learned_profile_id', values: profiles.map(profile => profile.id) };
  if (mechanic.kind === 'device' && ['deploy', 'deploy_or_fire'].includes(mechanic.mode)) {
    bindings.retireInstallation = { type: 'installation_ids', values: installations.map(value => value.id), optional: true };
  }
  if (mechanic.kind === 'device' && mechanic.mode === 'deploy_or_fire') {
    options.mode = { values: ['deploy', 'fire'], required: true };
    bindings.installation = { type: 'installation_id', values: installations.filter(value => value.kind === mechanic.installation).map(value => value.id), when: { mode: 'fire' } };
    bindings.retireInstallation.when = { mode: 'deploy' };
  }
  if (mechanic.kind === 'profile' && mechanic.mode === 'alternate') options.mode = { values: ['alternate'], required: false, omitted: 'base_action', requiresProfile: mechanic.profile };
  if (mechanic.kind === 'channel' && mechanic.mode === 'overreach') options.overreach = { values: [false, true], required: false, explicitPlayerChoice: true };
  const movementHandler = ['traverse', 'switch_and_move', 'scout', 'advance_attack', 'relocate', 'move', 'move_attack', 'board_move', 'follow', 'hunt', 'pursue'].includes(mechanic.mode);
  if (movementHandler || templates.some(effect => effect.op === 'reposition')) {
    options.route = { type: 'connected_area_ids', choices: 'knownAreas', optional: true, ...(areaWhen ? { when: areaWhen } : {}) };
    if (!bindings.area) bindings.area = destination(!['follow', 'hunt', 'pursue'].includes(mechanic.mode));
  }
  if (templates.some(effect => effect.op === 'reposition')) bindings.areas = { type: 'subject_to_destination_area_map', choices: 'knownAreas', optional: true,
    ...(areaWhen ? { when: areaWhen } : {}) };
  if (mechanic.kind === 'quarry' && ['follow', 'hunt'].includes(mechanic.mode)) {
    delete bindings.area;
    delete bindings.areas;
    options.route = { type: 'recorded_quarry_trail_prefix', values: [...source.classState.quarry?.trail || []], optional: true, omitted: 'follow_recorded_trail' };
  }
  const derivedDestination = mechanic.mode === 'intervene' ? 'selected_ally_area'
    : mechanic.kind === 'declaration' && mechanic.mode === 'limited_guard' ? 'bound_ward_area'
      : mechanic.kind === 'declaration' && mechanic.mode === 'pursue' ? 'selected_foe_area' : null;
  if (derivedDestination) { delete bindings.area; delete bindings.areas; }
  const currentArea = type === 'self' && !movementHandler && !templates.some(effect => ['reposition', 'teleport', 'traverse'].includes(effect.op));
  if (currentArea) delete bindings.area;
  if (mechanic.kind === 'cue') delete options.route;
  const fixed = { origin: mechanic.kind === 'companion' ? 'companion' : mechanic.kind === 'vehicle' ? 'vehicle' : 'self',
    ...(derivedDestination ? { destination: derivedDestination } : {}),
    ...(currentArea && uses('$area') ? { destination: 'current_area' } : {}),
    ...(mechanic.kind === 'device' && mechanic.mode === 'deploy_or_fire' ? { fireOrigin: 'selected_installation' } : {}),
    ...(mechanic.profile && mechanic.profile !== '$profile' && mechanic.mode !== 'alternate' ? { profile: mechanic.profile } : {}),
    ...(mechanic.stance ? { resultingStance: mechanic.stance } : {}),
    ...(mechanic.binding ? { declaration: mechanic.binding } : {}),
    ...(mechanic.trigger ? { trigger: mechanic.trigger } : {}),
    ...(mechanic.installation ? { installationKind: mechanic.installation } : {}),
    ...(mechanic.targetScale ? { targetScale: mechanic.targetScale } : {}) };
  if (mechanic.ignoreHindranceCount) bindings.feature = { type: 'feature_ref', relation: 'explicit_route_obstruction_to_bypass', optional: true };
  return { bindings, options, fixed,
    preparation: mechanic.requiresPrepared || mechanic.kind === 'device' && mechanic.mode === 'use'
      ? source.classState.prepared?.includes(definition.id) ? 'prepared' : 'not_prepared' : 'not_required' };
}

/** Engine-owned selector context, not a grant or an action authorizer. Every
 * returned choice still passes the existing prepare/finalize rules handlers.
 */
export function buildClassCouncilOptions({ state, actor, declarations } = {}) {
  validateRulesWorld(state);
  const source = state.actors[actor];
  if (!/^character:[1-9]\d*$/u.test(actor) || !source || source.tableStatus !== 'active') fail('An active authored player character is required.');
  if (!Array.isArray(declarations?.abilities)) fail('Engine-validated ability declarations are required.');
  const owned = new Map();
  for (const ability of source.abilities) {
    const definition = getAbilityDefinition(ability.definition_id, ability.definition_version);
    if (!definition || definition.branchId !== source.classBuild.branchId || definition.grantedAtLevel > source.level || owned.has(ability.id)) fail('An owned ability does not match this class version.');
    owned.set(ability.id, { ability, definition });
  }
  const cs = source.classState;
  const profileCatalog = source.classBuild.familyId === 'bonded' ? COMPANION_PROFILES : CLASS_PROFILES;
  const profiles = (cs.learnedProfiles || []).map(id => {
    if (!profileCatalog[id]) fail('A learned profile is not in the authored catalog.');
    return projectProfile(profileCatalog[id], cs.companion?.profile || cs.profile, source.classBuild.familyId === 'bonded');
  });
  const installations = (cs.installations || []).filter(value => value.status === 'active').map(value => ({
    id: value.id, kind: value.kind, area: areaRef(value), status: value.status,
    features: (value.features || []).filter(ref => state.features[ref]?.status === 'active')
  }));
  const seen = new Set();
  const abilities = declarations.abilities.map(declaration => {
    const entry = owned.get(declaration.ability_id);
    if (!entry || entry.definition.activation === 'passive' || !entry.ability.invocation || seen.has(declaration.ability_id)
      || declaration.definition_id !== entry.definition.id || declaration.definition_version !== entry.definition.version) fail('A declaration is foreign, duplicated or not an owned active ability.');
    seen.add(declaration.ability_id);
    const definition = entry.definition;
    return { abilityId: entry.ability.id, definitionId: definition.id, name: definition.name,
      activation: definition.activation, targeting: { kind: definition.targeting.kind, range: definition.targeting.range },
      ...resolutionOptions(entry, cs),
      ...selectors(definition, source, profiles, installations),
      requirements: [...definition.requirements.map(requirementOptions), ...(definition.mechanic.kind === 'ritual'
        ? definition.mechanic.requirements.map(kind => ({ kind })) : [])] };
  });
  const known = Object.entries(state.areas).filter(([, area]) => area.visible === true || area.visited === true || areaRef(source) === `area:${area.locationId}:${area.id}`);
  const knownRefs = new Set(known.map(([ref]) => ref));
  const knownAreas = known.map(([ref, area]) => ({ ref, id: area.id, locationRef: `location:${area.locationId}`, name: area.name || area.id,
    adjacent: (area.adjacent || []).map(id => `area:${area.locationId}:${id}`).filter(value => knownRefs.has(value)),
    exits: (area.exits || []).filter(value => knownRefs.has(value)),
    visible: area.visible === true, visited: area.visited === true, safeToOccupy: area.safeToOccupy === true,
    supported: area.supported === true, surfaces: [...area.surfaces || []], focus: area.focus === true, anchor: area.anchor === true,
    blocked: area.blocked === true, teleportWard: area.teleportWard === true, flightBlocked: area.flightBlocked === true,
    spaceForWings: area.spaceForWings === true, safeRecovery: area.safeRecovery === true, immediateThreat: area.immediateThreat === true }));
  let companion = null;
  if (cs.companion) {
    const value = state.actors[cs.companion.actorRef];
    if (!value || value.controller !== actor || !COMPANION_PROFILES[cs.companion.profile]) fail('The owned companion reference is invalid.');
    companion = { ref: cs.companion.actorRef, profile: cs.companion.profile, area: areaRef(value),
      controller: value.controller, status: value.status, present: value.present, conditions: conditionTokens(value.conditions), sharedMain: true };
  }
  let vehicle = null;
  if (cs.vehicle) {
    const value = state.vehicles[cs.vehicle.vehicleRef];
    if (!value || value.controller !== actor && value.operator !== actor || !VEHICLE_PROFILES[cs.vehicle.profile]) fail('The owned vehicle reference is invalid.');
    vehicle = { ref: cs.vehicle.vehicleRef, profile: cs.vehicle.profile, area: areaRef(value),
      controller: value.controller || null, operator: value.operator || null, occupants: [...value.occupants || []],
      status: value.status, operable: value.status === 'active' && value.hull > 0 && value.operator === actor,
      conditions: conditionTokens(value.conditions), sharedMain: true };
  }
  const utilities = [{ kind: 'recover', requires: ['no_active_encounter', 'recorded_safe_recovery', 'no_immediate_threat'] }];
  if (vehicle?.status === 'lost') utilities.push({ kind: 'replace_vehicle', requires: ['own_lost_craft', 'no_active_encounter', 'recorded_safe_recovery', 'one_main'], previous: vehicle.ref });
  if (['arcanist', 'maker'].includes(source.classBuild.familyId) && Array.isArray(cs.prepared)) {
    utilities.push({ kind: 'prepare', requires: ['no_active_encounter'], choices: [...owned.values()].filter(value => value.definition.activation === 'main')
      .map(({ definition }) => ({ definitionId: definition.id, name: definition.name, prepared: cs.prepared.includes(definition.id), basic: definition.grantedAtLevel === 1 })) });
  }
  if ([...owned.values()].some(({ definition }) => definition.mechanic.modifiers?.returnToBase)) utilities.push({ kind: 'return_to_base', profile: 'base', activeProfile: cs.profile });
  if (cs.ritual) {
    const ritual = owned.get(cs.ritual.abilityId);
    if (!ritual || ritual.definition.activation !== 'ritual') fail('The active ritual is not an owned authored working.');
    utilities.push({ kind: 'continue_ritual', abilityId: ritual.ability.id, definitionId: ritual.definition.id,
      name: ritual.definition.name, retainedBindings: true, ...resolutionOptions(ritual, cs) });
    utilities.push({ kind: 'abandon_ritual', abilityId: ritual.ability.id });
  }
  const commitments = {
    stance: cs.stance || null,
    quarry: cs.quarry ? { target: cs.quarry.target, lastKnownArea: cs.quarry.lastKnownArea || null, trail: [...cs.quarry.trail || []] } : null,
    opening: cs.opening ? { target: cs.opening.target } : null,
    declaration: cs.declaration ? { binding: cs.declaration.binding, target: cs.declaration.target,
      area: cs.declaration.area, guardActive: !!cs.declaration.guard } : null,
    cue: cs.cue ? { ally: cs.cue.ally, target: cs.cue.target || null, trigger: cs.cue.trigger,
      area: cs.cue.area || null, requiresCover: cs.cue.requiresCover === true } : null,
    braceActive: !!cs.brace, endureActive: !!cs.endure
  };
  return freeze({ actor, abilities, utilities, profiles, installations, companion, vehicle, knownAreas, commitments });
}
