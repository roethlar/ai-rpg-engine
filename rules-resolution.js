import { randomInt, randomUUID } from 'node:crypto';

// Signed Chapter 1 configuration. Class progression supplies skillBonus; models never do.
export const RESOLUTION_VERSION = 'aetheria-d100-1';
export const DIFFICULTY_TARGETS = Object.freeze({
  trivial: 10,
  easy: 25,
  standard: 50,
  hard: 75,
  extreme: 90,
  legendary: 98
});
export const DELTA_MAGNITUDES = Object.freeze({ slight: 3, moderate: 7, major: 12 });
export const STAKES_BUDGETS = Object.freeze({ flavor_only: 0, minor: 1, significant: 2 });
export const OUTCOME_BANDS = Object.freeze([
  'crit_success', 'crit_failure', 'marginal_success',
  'clean_success', 'marginal_failure', 'clean_failure'
]);

const EDGE_BANDS = new Set([
  'crit_success', 'crit_failure', 'marginal_success', 'marginal_failure'
]);
const MARGIN_FACES = 5;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

function integer(value, name, minimum, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(`${name} must be an integer from ${minimum} through ${maximum}.`);
  }
  return value;
}

function exactKeys(value, keys, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object.`);
  }
  const actual = Object.keys(value);
  if (actual.length !== keys.length || keys.some(key => !owns(value, key))) {
    throw new TypeError(`${name} has an invalid shape.`);
  }
}

function boundedText(value, name, maximum) {
  if (typeof value !== 'string' || !value.trim() || value.trim() !== value
      || [...value].length > maximum || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new TypeError(`${name} must be nonempty text of at most ${maximum} characters.`);
  }
  return value;
}

function enumValue(value, vocabulary, name) {
  if (typeof value !== 'string' || !owns(vocabulary, value)) {
    throw new TypeError(`${name} is not a known rules token.`);
  }
  return value;
}

function validateDeltas(raw) {
  if (!Array.isArray(raw) || raw.length > 3) {
    throw new TypeError('A check permits at most three situational deltas.');
  }
  const reasons = new Set();
  return Object.freeze(raw.map(delta => {
    exactKeys(delta, ['direction', 'magnitude', 'reason'], 'Situational delta');
    if (!['favors', 'hinders'].includes(delta.direction)) {
      throw new TypeError('Delta direction must be favors or hinders.');
    }
    const magnitude = enumValue(delta.magnitude, DELTA_MAGNITUDES, 'Delta magnitude');
    const reason = boundedText(delta.reason, 'Delta reason', 120);
    const key = reason.normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ');
    if (reasons.has(key)) throw new TypeError('Duplicate situational delta reason.');
    reasons.add(key);
    return Object.freeze({ direction: delta.direction, magnitude, reason });
  }));
}

/** Structural validation precedes Continuity's separate semantic pre-roll judgment. */
export function validateCheckCall(raw, { actor } = {}) {
  integer(actor, 'Bound actor', 1);
  exactKeys(raw, ['actor', 'callSeq', 'intent', 'tier', 'tierBasis', 'deltas'], 'Check call');
  if (raw.actor !== actor) throw new TypeError('Check actor does not match the acting character.');
  return Object.freeze({
    actor,
    callSeq: integer(raw.callSeq, 'Check ordinal', 1),
    intent: boundedText(raw.intent, 'Check intent', 200),
    tier: enumValue(raw.tier, DIFFICULTY_TARGETS, 'Difficulty tier'),
    tierBasis: boundedText(raw.tierBasis, 'Tier basis', 120),
    deltas: validateDeltas(raw.deltas)
  });
}

export function computeCheckTarget({ tier, skillBonus, deltas = [] } = {}) {
  enumValue(tier, DIFFICULTY_TARGETS, 'Difficulty tier');
  integer(skillBonus, 'Skill bonus', 0, 75);
  const validatedDeltas = validateDeltas(deltas);
  const valuedDeltas = Object.freeze(validatedDeltas.map(delta => Object.freeze({
    ...delta,
    value: DELTA_MAGNITUDES[delta.magnitude] * (delta.direction === 'favors' ? -1 : 1)
  })));
  const netDelta = clamp(valuedDeltas.reduce((sum, delta) => sum + delta.value, 0), -20, 20);
  return Object.freeze({
    tierTarget: DIFFICULTY_TARGETS[tier],
    skillBonus,
    deltas: valuedDeltas,
    netDelta,
    T: clamp(DIFFICULTY_TARGETS[tier] - skillBonus + netDelta, 2, 99)
  });
}

export function evaluateOutcomeBand(raw, target) {
  integer(raw, 'D100 result', 1, 100);
  integer(target, 'Check target', 2, 99);
  if (raw === 100) return 'crit_success';
  if (raw === 1) return 'crit_failure';
  if (raw >= target && raw - target < MARGIN_FACES) return 'marginal_success';
  if (raw >= target) return 'clean_success';
  if (target - raw <= MARGIN_FACES) return 'marginal_failure';
  return 'clean_failure';
}

export function checkSucceeded(band) {
  if (!OUTCOME_BANDS.includes(band)) throw new TypeError('Unknown outcome band.');
  return ['crit_success', 'marginal_success', 'clean_success'].includes(band);
}

export function stakesLicenseFor({ tier, band, activeEncounter } = {}) {
  enumValue(tier, DIFFICULTY_TARGETS, 'Difficulty tier');
  if (!OUTCOME_BANDS.includes(band)) throw new TypeError('Unknown outcome band.');
  if (typeof activeEncounter !== 'boolean') {
    throw new TypeError('Encounter state must be supplied by the engine.');
  }
  if (!EDGE_BANDS.has(band)) return null;
  let budget = activeEncounter ? 1 : 0;
  if (band === 'crit_success' || band === 'crit_failure') budget += 1;
  if (tier === 'extreme' || tier === 'legendary') budget += 1;
  return ['flavor_only', 'minor', 'significant'][Math.min(budget, 2)];
}

/** Call only inside the store's new-key transaction, after Continuity has approved the call. */
export function createCheckRecord(
  { call, actor, turn, skillBonus, activeEncounter } = {},
  { roll = () => randomInt(1, 101), now = () => new Date().toISOString(), newId = randomUUID } = {}
) {
  const checkedCall = validateCheckCall(call, { actor });
  integer(turn, 'Turn number', 1);
  if (typeof activeEncounter !== 'boolean') {
    throw new TypeError('Encounter state must be supplied by the engine.');
  }
  const computed = computeCheckTarget({ ...checkedCall, skillBonus });
  const checkId = newId();
  if (typeof checkId !== 'string'
      || !/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/iu.test(checkId)) {
    throw new TypeError('Check identity must be an engine-generated UUID v4.');
  }
  const timestamp = now();
  if (typeof timestamp !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*Z$/u.test(timestamp)
      || !Number.isFinite(Date.parse(timestamp))) {
    throw new TypeError('Check timestamp must be UTC ISO-8601.');
  }
  const raw = integer(roll(), 'D100 result', 1, 100);
  const band = evaluateOutcomeBand(raw, computed.T);
  return Object.freeze({
    checkId,
    turn,
    actor,
    callSeq: checkedCall.callSeq,
    intent: checkedCall.intent,
    tier: checkedCall.tier,
    tierBasis: checkedCall.tierBasis,
    ...computed,
    raw,
    sides: 100,
    band,
    annotation: null,
    annotationRejected: null,
    stakesLicense: stakesLicenseFor({ tier: checkedCall.tier, band, activeEncounter }),
    timestamp
  });
}

/** Validates ledger arithmetic for projection/import; effect authorization belongs to its consumer. */
export function normalizeCheckRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record) || record.sides !== 100) {
    throw new TypeError('Expected a signed d100 check record.');
  }
  if (!Array.isArray(record.deltas)) throw new TypeError('Check deltas must be an array.');
  const deltas = record.deltas.map(delta => {
    exactKeys(delta, ['direction', 'magnitude', 'reason', 'value'], 'Ledger delta');
    return { direction: delta.direction, magnitude: delta.magnitude, reason: delta.reason };
  });
  const call = {
    actor: record.actor, callSeq: record.callSeq, intent: record.intent,
    tier: record.tier, tierBasis: record.tierBasis, deltas
  };
  const core = createCheckRecord({
    call, actor: record.actor, turn: record.turn, skillBonus: record.skillBonus, activeEncounter: false
  }, { roll: () => record.raw, newId: () => record.checkId, now: () => record.timestamp });
  for (const key of ['tierTarget', 'netDelta', 'T', 'band']) {
    if (record[key] !== core[key]) throw new TypeError('Check record contradicts its rules arithmetic.');
  }
  if (record.deltas.some((delta, index) => delta.value !== core.deltas[index].value)) {
    throw new TypeError('Ledger delta value contradicts its magnitude.');
  }
  const legalLicenses = [false, true].map(activeEncounter => stakesLicenseFor({
    tier: core.tier, band: core.band, activeEncounter
  }));
  if (!legalLicenses.includes(record.stakesLicense)) throw new TypeError('Invalid stakes license.');
  if (!owns(record, 'annotation') || !owns(record, 'annotationRejected')) {
    throw new TypeError('Check annotation fields are required.');
  }
  const annotationRejected = record.annotationRejected === null ? null
    : boundedText(record.annotationRejected, 'Annotation rejection', 200);
  let annotation = null;
  if (record.annotation !== null) {
    if (!EDGE_BANDS.has(core.band) || annotationRejected !== null) {
      throw new TypeError('This check cannot carry an annotation.');
    }
    exactKeys(record.annotation, ['text', 'effects', 'affirmedOpposed'], 'Annotation');
    const { text, effects, affirmedOpposed } = record.annotation;
    boundedText(text, 'Annotation text', 300);
    // Every catalog effect costs at least one point; no license grants more than two.
    if (!Array.isArray(effects) || effects.length > STAKES_BUDGETS[record.stakesLicense]
        || effects.some(effect => !effect || typeof effect !== 'object' || Array.isArray(effect))) {
      throw new TypeError('Annotation effects exceed the license envelope.');
    }
    if (!Array.isArray(affirmedOpposed) || affirmedOpposed.length > 64
        || new Set(affirmedOpposed).size !== affirmedOpposed.length
        || affirmedOpposed.some(ref => typeof ref !== 'string' || !/^npc:[1-9]\d*$/u.test(ref))) {
      throw new TypeError('Annotation opposition must be unique typed NPC references.');
    }
    annotation = structuredClone({ text, effects, affirmedOpposed });
  }
  if (!EDGE_BANDS.has(core.band) && annotationRejected !== null) {
    throw new TypeError('A clean-band check cannot carry an annotation rejection.');
  }
  return { ...core, stakesLicense: record.stakesLicense, annotation, annotationRejected };
}
