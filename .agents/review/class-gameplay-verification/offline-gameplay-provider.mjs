import assert from 'node:assert/strict';

export const OFFLINE_GAMEPLAY_INPUTS = Object.freeze({
  'direct-magic': Object.freeze([
    'Who is threatening us, and who is in the Courtyard?',
    'I cast Magic Missile at the Raider.',
    'I cast Fireball into the Courtyard.'
  ]),
  catalyst: Object.freeze(['I give Nessa Advance Cue toward the Courtyard.', 'I attack the Raider with my weapon.']),
  ritual: Object.freeze(['I begin Recall the Departed for Tarin, using my Return catalyst.', 'I continue the same working.'])
});

const PROVENANCE = 'authored_offline_gameplay';
const INSTALLED = Symbol('offlineGameplayProviderInstalled');
const BANDS = ['crit_success', 'crit_failure', 'marginal_success', 'clean_success', 'marginal_failure', 'clean_failure'];

function fail(message) {
  const error = new Error(`OFFLINE_GAMEPLAY_REJECTED: ${message}`);
  error.code = 'OFFLINE_GAMEPLAY_REJECTED';
  throw error;
}

function exactlyOne(values, description) {
  if (values.length !== 1) fail(`Expected one recorded ${description}.`);
  return values[0];
}

function named(world, name) {
  return exactlyOne(Object.entries(world?.actors || {}).filter(([, value]) => value.name === name), name);
}

function area(world, id) {
  return exactlyOne(Object.values(world?.areas || {}).filter(value => value.id === id), `area ${id}`);
}

function actorRef(data) {
  if (!Number.isSafeInteger(data.actor) || data.actor < 1 || !data.world?.actors?.[`character:${data.actor}`]) fail('Missing acting player.');
  if (Object.keys(data.world.actors).filter(ref => ref.startsWith('character:')).length !== 1) fail('The authored episodes require one player.');
  return `character:${data.actor}`;
}

function opposed(world) {
  return Object.entries(world.actors).filter(([ref, value]) => ref.startsWith('npc:') && value.opposed === true && !value.party).map(([ref]) => ref);
}

function inputKind(episodeId, playerInput) {
  if (!OFFLINE_GAMEPLAY_INPUTS[episodeId]?.includes(playerInput)) fail('Input is outside this authored episode.');
  return episodeId === 'direct-magic' && playerInput === OFFLINE_GAMEPLAY_INPUTS['direct-magic'][0] ? 'clarification' : 'committed_action';
}

function selected(data, episodeId) {
  const self = actorRef(data);
  const playerInput = data.playerInput;
  inputKind(episodeId, playerInput);
  if (episodeId === 'catalyst' && playerInput === OFFLINE_GAMEPLAY_INPUTS.catalyst[1]) {
    if (data.declarations?.length) fail('The ordinary alternative cannot declare a power.');
    const [target, targetActor] = named(data.world, 'Raider');
    if (targetActor.opposed !== true || targetActor.area !== data.world.actors[self].area) fail('The Raider is not an engaged opponent.');
    const [item] = exactlyOne(Object.entries(data.world.items).filter(([, value]) => value.holder === self
      && value.wielded === true && value.weaponKind === 'melee_weapon' && value.condition !== 'broken'), 'held ready melee weapon');
    return { action: { kind: 'ordinary', action: { kind: 'attack', target, method: 'melee', item } },
      resolution: { kind: 'contextual_check', defaultTier: 'standard' }, consent: [] };
  }
  const continuing = episodeId === 'ritual' && playerInput === OFFLINE_GAMEPLAY_INPUTS.ritual[1];
  const name = episodeId === 'ritual' ? 'Recall the Departed' : episodeId === 'catalyst' ? 'Advance Cue'
    : playerInput === OFFLINE_GAMEPLAY_INPUTS['direct-magic'][1] ? 'Magic Missile' : 'Fireball';
  const option = exactlyOne((continuing ? data.options?.utilities : data.options?.abilities || [])
    ?.filter(value => value.name === name && (!continuing || value.kind === 'continue_ritual')) || [], `owned ${name} option`);
  if (continuing) {
    if (data.declarations?.length || option.retainedBindings !== true) fail('Plain continuation must retain its owned working without a new declaration.');
  } else {
    const declaration = exactlyOne(data.declarations?.filter(value => value.name === name) || [], 'explicit ability declaration');
    if (declaration.abilityId !== option.abilityId || declaration.definitionId !== option.definitionId) fail('Declaration and owned option disagree.');
  }
  if (!['no_check', 'contextual_check'].includes(option.resolution?.kind)) fail('Unknown authored resolution.');
  const bindings = {};
  const consent = [];
  if (episodeId === 'ritual') {
    const [target, targetActor] = named(data.world, 'Tarin');
    if (!targetActor.party || targetActor.status !== 'dead' || targetActor.intactBody !== true
      || targetActor.willingReturn !== true || targetActor.deathRecorded !== true
      || targetActor.area !== data.world.actors[self].area) fail('The recorded fallen ally is not eligible for this working.');
    if (!['preliminary', 'completing'].includes(option.workingPhase)
      || (option.workingPhase === 'preliminary') !== (option.resolution.kind === 'no_check')) fail('Ritual phase and resolution disagree.');
    consent.push(target);
    if (!continuing) {
      const [catalyst] = exactlyOne(Object.entries(data.world.items).filter(([, value]) => value.holder === self
        && value.kind === 'revival-catalyst' && value.condition !== 'broken'), 'owned return catalyst');
      bindings.targets = [target]; bindings.catalyst = catalyst;
    }
  } else if (episodeId === 'catalyst') {
    const [target, ally] = named(data.world, 'Nessa');
    if (!ally.party || ally.status !== 'active' || ally.area !== data.world.actors[self].area) fail('The cue ally is not beside the actor.');
    if (!data.history?.some(turn => turn.narrative?.includes('Nessa says, "I agree to the Courtyard as my destination if your Advance Cue opens that opportunity.'))) fail('The fixture does not record Nessa agreeing to this destination.');
    const destination = exactlyOne(data.options.knownAreas.filter(value => value.id === 'yard'), 'known cue destination');
    if (!destination.visible || !destination.safeToOccupy || destination.blocked) fail('The cue destination is not available.');
    bindings.targets = [target]; bindings.area = destination.id; consent.push(target);
  } else if (name === 'Magic Missile') {
    const [target, value] = named(data.world, 'Raider');
    if (value.opposed !== true || value.status !== 'active') fail('The missile target is not the recorded active opponent.');
    bindings.targets = [target];
  } else {
    const destination = exactlyOne(data.options.knownAreas.filter(value => value.id === 'yard'), 'visible spell area');
    if (!destination.visible || Object.values(data.world.actors).some(value => value.party && value.area === destination.id)) fail('The conditional Fireball area is no longer clear of allies.');
    const [, sentry] = named(data.world, 'Sentry');
    if (sentry.area !== destination.id || sentry.opposed !== true || sentry.status !== 'active') fail('The courtyard opponent is no longer available.');
    bindings.area = destination.id;
  }
  return { action: continuing ? { kind: 'continue_ritual' } : { kind: 'ability', abilityId: option.abilityId, bindings, options: {} },
    resolution: option.resolution, workingPhase: option.workingPhase || null, consent };
}

function npcChoices(data, episodeId) {
  // Pre-roll omits this Referee-only hint; these authored scenes have one PC.
  if (!data.world.encounterActive || data.finalPlayerMainOfRound === false) return [];
  const self = actorRef(data);
  return Object.entries(data.world.actors).filter(([ref, value]) => ref.startsWith('npc:') && value.status === 'active'
    && value.vitality !== 'incapacitated' && (value.party || value.opposed)).map(([npc, value]) => {
    if (value.name === 'Raider') {
      if (value.area !== data.world.actors[self].area || !value.npcActions?.some(action => action.id === 'strike')) fail('The authored Raider strike is unavailable.');
      return { npc, actionId: 'strike', target: self };
    }
    if (value.name === 'Nessa') {
      if (episodeId === 'catalyst' && data.playerInput === OFFLINE_GAMEPLAY_INPUTS.catalyst[0]) {
        const [target, targetActor] = named(data.world, 'Raider');
        if (value.area !== targetActor.area || !value.npcActions?.some(action => action.id === 'brawl')) fail('The authored Nessa brawl is unavailable.');
        return { npc, actionId: 'brawl', target };
      }
      return { npc, wait: 'Nessa holds her recorded position and watches the nearby opposition.' };
    }
    if (value.name === 'Sentry') return { npc, wait: 'The Sentry stays beside the dispatch case, watching the arch instead of crossing it.' };
    fail('No authored NPC choice exists for this participant.');
  });
}

function ruling(data, episodeId) {
  const choice = selected(data, episodeId);
  const checked = choice.resolution.kind === 'contextual_check';
  const npcTurns = npcChoices(data, episodeId);
  return { action: choice.action,
    check: checked ? { actor: data.actor, callSeq: 1, intent: data.playerInput, tier: choice.resolution.defaultTier,
      tierBasis: episodeId === 'ritual' ? 'Completing the return requires precise magical execution; the final outcome remains uncertain.'
        : 'An alert armed opponent resists the immediate attack.', deltas: [] } : null,
    deltaSources: [], noCheckReason: checked ? null : choice.workingPhase === 'preliminary'
      ? 'This preliminary working records deterministic progress, not the final return.'
      : 'Setting the explicit willing cue is a deterministic authored commitment, not a rolled attack.',
    npcTurns: { success: npcTurns, failure: npcTurns }, encounter: { success: 'unchanged', failure: 'unchanged' }, award: null };
}

function narration(data, episodeId) {
  inputKind(episodeId, data.playerInput);
  if (!data.worldBefore?.actors || !data.worldAfter?.actors || !Array.isArray(data.effects) || !Array.isArray(data.events)) fail('Narration is missing the binding result.');
  if (data.check !== null && !BANDS.includes(data.check?.band)) fail('Narration has no known signed outcome.');
  const self = data.actor;
  if (!data.worldAfter.actors[self]) fail('Narration is missing the acting player.');
  const sentences = [];
  if (episodeId === 'ritual') {
    const [target, fallen] = named(data.worldAfter, 'Tarin');
    if (data.phase === 'ritual_progress') {
      if (fallen.status !== 'dead' || data.check !== null) fail('A preliminary working cannot narrate a completed return.');
      sentences.push('You sustain the working beside Tarin. He remains dead; the return is not complete.');
    } else if (data.events.some(event => event.type === 'actor_revived' && event.who === target)) {
      if (fallen.status !== 'active') fail('Revival event and final state disagree.');
      sentences.push('Tarin draws a breath and returns, winded, beside you.');
    } else {
      if (fallen.status !== 'dead' || !data.check?.band.endsWith('_failure')) fail('No authored final ritual outcome matches the result.');
      sentences.push('The final working fails to bring Tarin back. He remains beside you, still dead.');
    }
    if (data.effects.some(effect => effect.op === 'item_consume')) sentences.push('The Return catalyst is consumed.');
  } else if (episodeId === 'catalyst' && data.playerInput === OFFLINE_GAMEPLAY_INPUTS.catalyst[0]) {
    sentences.push('You give Nessa the agreed Advance Cue.');
  } else {
    const [target] = named(data.worldBefore, data.playerInput === OFFLINE_GAMEPLAY_INPUTS['direct-magic'][2] ? 'Sentry' : 'Raider');
    const landed = data.effects.some(effect => effect.op === 'harm' && effect.who === target);
    if (!data.check || landed !== data.check.band.endsWith('_success')) fail('Attack narration disagrees with the signed outcome and harm receipt.');
    if (data.playerInput === OFFLINE_GAMEPLAY_INPUTS['direct-magic'][1]) sentences.push(landed ? 'Your seeking bolt strikes the Raider.' : 'Your seeking bolt fails to strike the Raider.');
    else if (data.playerInput === OFFLINE_GAMEPLAY_INPUTS['direct-magic'][2]) sentences.push(landed ? 'Your burst catches the Sentry in the Courtyard.' : 'Your burst fails to catch the Sentry in the Courtyard.');
    else sentences.push(landed ? 'Your weapon catches the Raider.' : 'Your swing misses the Raider.');
  }
  for (const event of data.events) {
    if (event.type === 'health_changed' && event.who === self && event.after < event.before) sentences.push('You are wounded in the exchange.');
    if (event.type === 'npc_acted' && data.worldAfter.actors[event.who]?.name === 'Nessa' && event.actionId === 'brawl') sentences.push('Nessa strikes the Raider with her own close attack.');
  }
  for (const [ref, value] of Object.entries(data.worldAfter.actors)) {
    const before = data.worldBefore.actors[ref];
    if (before && before.area !== value.area) sentences.push(`${value.name} moves to the ${area(data.worldAfter, value.area).name}.`);
  }
  return { narrative: sentences.join(' ') };
}

function authoredResponse(stage, data, episodeId) {
  if (stage === 'narration') return narration(data, episodeId);
  const kind = inputKind(episodeId, data.playerInput);
  if (stage === 'interaction') return { inputKind: kind, intent: data.playerInput,
    answer: kind === 'clarification' ? 'The Raider threatens the Gate; the Sentry holds the Courtyard.' : null };
  if (stage === 'table_talk') {
    if (kind !== 'clarification') fail('Unexpected table-talk stage.');
    const [, raider] = named(data.world, 'Raider'); const [, sentry] = named(data.world, 'Sentry');
    return { narrative: `The Raider faces you at the ${area(data.world, raider.area).name}. The Sentry is in the ${area(data.world, sentry.area).name}, beside the dispatch case.` };
  }
  if (kind !== 'committed_action') fail('A question cannot enter mechanical resolution.');
  if (stage === 'annotation') {
    if (!BANDS.includes(data.check?.band)) fail('Annotation requires a signed outcome.');
    return { text: 'The moment passes without an additional consequence.', effects: [] };
  }
  if (stage === 'annotation_review') {
    assert.deepEqual(data.proposal, { text: 'The moment passes without an additional consequence.', effects: [] });
    return { approved: true, reason: 'The authored annotation adds no mechanical event.', affirmedOpposed: opposed(data.world) };
  }
  const choice = selected(data, episodeId);
  if (stage === 'grounding' || stage === 'pre_roll') {
    if (stage === 'pre_roll') assert.deepEqual(data.ruling, ruling(data, episodeId), 'Only the exact authored ruling may receive offline semantic approval.');
    return { approved: true, reason: 'The authored episode selects the declared owned action and its recorded targets and agreement.',
      affirmedOpposed: opposed(data.world), consentingActors: choice.consent };
  }
  if (stage === 'referee') return ruling(data, episodeId);
  fail('Unknown Council stage.');
}

/** Isolated diagnostic process only. restore() never re-enables provider dispatch. */
export function installOfflineGameplayProvider({ AIClient, episodeId, onResponse = async () => {} }) {
  if (!Object.hasOwn(OFFLINE_GAMEPLAY_INPUTS, episodeId) || typeof onResponse !== 'function'
    || typeof AIClient?.prototype?.sendPrompt !== 'function' || typeof AIClient.prototype.dispatchPrompt !== 'function') fail('Invalid adapter installation.');
  if (AIClient.prototype[INSTALLED]) fail('An offline gameplay adapter cannot be reinstalled or reset.');
  AIClient.prototype[INSTALLED] = true;
  const originalPrompt = AIClient.prototype.sendPrompt;
  const report = { kind: PROVENANCE, episodeId, liveProviderCalls: 0, dispatchAttempts: 0, calls: [], stopped: false };
  let stopped = false;
  const assertRunning = () => { if (stopped) fail('This offline episode has stopped permanently.'); };
  AIClient.prototype.dispatchPrompt = async function () {
    report.dispatchAttempts++;
    fail('Real provider dispatch is permanently forbidden in offline gameplay.');
  };
  AIClient.prototype.sendPrompt = async function ({ systemInstruction, prompt }) {
    assertRunning();
    const stage = /^AETHERIA_COUNCIL:([a-z_]+)\n/u.exec(systemInstruction)?.[1];
    if (!stage) fail('Only gameplay Council prompts are allowed; setup and unknown prompts are forbidden.');
    const data = JSON.parse(prompt);
    const response = authoredResponse(stage, data, episodeId);
    const record = { kind: PROVENANCE, stage, playerInput: data.playerInput, response: structuredClone(response) };
    report.calls.push(record);
    await onResponse(structuredClone(record));
    assertRunning();
    return JSON.stringify(response);
  };
  return { report,
    abort(reason) { stopped = true; report.stopped = true; report.stopReason = String(reason?.message || reason || 'Episode stopped.'); },
    restore() { stopped = true; report.stopped = true; AIClient.prototype.sendPrompt = originalPrompt; }
  };
}
