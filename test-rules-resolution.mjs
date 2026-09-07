import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import {
  checkSucceeded,
  computeCheckTarget,
  createCheckRecord,
  DIFFICULTY_TARGETS,
  evaluateOutcomeBand,
  normalizeCheckRecord,
  OUTCOME_BANDS,
  stakesLicenseFor,
  validateCheckCall
} from './rules-resolution.js';

const call = () => ({
  actor: 7, callSeq: 1, intent: 'Strike the raider', tier: 'standard',
  tierBasis: 'An armed opponent at close range', deltas: []
});
const context = () => ({ call: call(), actor: 7, turn: 4, skillBonus: 0, activeEncounter: true });
const fixedSources = {
  roll: () => 50,
  now: () => '2026-09-07T18:00:00.000Z',
  newId: () => '00000000-0000-4000-8000-000000000001'
};

export function runRulesResolutionTests() {
  for (let target = 2; target <= 99; target += 1) {
    const counts = Object.fromEntries(OUTCOME_BANDS.map(band => [band, 0]));
    for (let raw = 1; raw <= 100; raw += 1) {
      const band = evaluateOutcomeBand(raw, target);
      counts[band] += 1;
      assert.equal(checkSucceeded(band), raw === 100 || (raw !== 1 && raw >= target));
    }
    assert.equal(counts.crit_success, 1);
    assert.equal(counts.crit_failure, 1);
    assert.equal(counts.marginal_success, Math.min(5, 100 - target));
    assert.equal(counts.marginal_failure, Math.min(5, target - 2));
    assert.equal(Object.values(counts).reduce((sum, value) => sum + value, 0), 100);
  }
  assert.equal(evaluateOutcomeBand(1, 2), 'crit_failure');
  assert.equal(evaluateOutcomeBand(100, 99), 'crit_success');
  assert.equal(evaluateOutcomeBand(45, 50), 'marginal_failure');
  assert.equal(evaluateOutcomeBand(44, 50), 'clean_failure');
  assert.equal(evaluateOutcomeBand(54, 50), 'marginal_success');
  assert.equal(evaluateOutcomeBand(55, 50), 'clean_success');

  for (const [tier, target] of Object.entries(DIFFICULTY_TARGETS)) {
    assert.equal(computeCheckTarget({ tier, skillBonus: 0 }).T, target);
  }
  assert.equal(computeCheckTarget({ tier: 'trivial', skillBonus: 75 }).T, 2);
  const hindrances = ['rain', 'smoke', 'ice'].map(reason => ({ direction: 'hinders', magnitude: 'major', reason }));
  const hindered = computeCheckTarget({ tier: 'legendary', skillBonus: 0, deltas: hindrances });
  assert.equal(hindered.netDelta, 20);
  assert.equal(hindered.T, 99);
  const favored = computeCheckTarget({
    tier: 'standard', skillBonus: 10,
    deltas: hindrances.map(delta => ({ ...delta, direction: 'favors' }))
  });
  assert.equal(favored.netDelta, -20);
  assert.equal(favored.T, 20);
  assert.deepEqual(favored.deltas.map(delta => delta.value), [-12, -12, -12]);

  assert.equal(stakesLicenseFor({ tier: 'standard', band: 'marginal_success', activeEncounter: false }), 'flavor_only');
  assert.equal(stakesLicenseFor({ tier: 'standard', band: 'crit_failure', activeEncounter: false }), 'minor');
  assert.equal(stakesLicenseFor({ tier: 'hard', band: 'marginal_failure', activeEncounter: true }), 'minor');
  assert.equal(stakesLicenseFor({ tier: 'extreme', band: 'marginal_success', activeEncounter: true }), 'significant');
  assert.equal(stakesLicenseFor({ tier: 'legendary', band: 'crit_success', activeEncounter: true }), 'significant');
  assert.equal(stakesLicenseFor({ tier: 'legendary', band: 'clean_success', activeEncounter: true }), null);
  assert.throws(() => stakesLicenseFor({ tier: 'standard', band: 'marginal_success' }), /Encounter state/);

  const record = createCheckRecord(context(), fixedSources);
  assert.deepEqual(record, {
    checkId: fixedSources.newId(), turn: 4, actor: 7, callSeq: 1,
    intent: call().intent, tier: 'standard', tierBasis: call().tierBasis,
    tierTarget: 50, skillBonus: 0, deltas: [], netDelta: 0, T: 50,
    raw: 50, sides: 100, band: 'marginal_success', annotation: null,
    annotationRejected: null, stakesLicense: 'minor', timestamp: fixedSources.now()
  });
  assert.equal(Object.isFrozen(record), true);
  assert.equal(Object.isFrozen(record.deltas), true);
  assert.throws(() => { record.raw = 100; }, TypeError);
  assert.deepEqual(normalizeCheckRecord(record), record);
  assert.deepEqual(normalizeCheckRecord({ ...record, operationId: 'store-metadata' }), record);
  for (const corrupt of [{ T: 49 }, { tierTarget: 49 }, { netDelta: 3 }, { band: 'clean_success' }, { sides: 20 }, { stakesLicense: 'significant' }]) {
    assert.throws(() => normalizeCheckRecord({ ...record, ...corrupt }));
  }
  const annotated = {
    ...record,
    annotation: { text: 'A loud impact rings through the hall.', effects: [], affirmedOpposed: [] }
  };
  assert.deepEqual(normalizeCheckRecord(annotated), annotated);
  assert.throws(() => normalizeCheckRecord({ ...annotated, annotationRejected: 'Rejected.' }));
  assert.throws(() => normalizeCheckRecord({ ...annotated, band: 'clean_success', raw: 90, stakesLicense: null }));
  assert.throws(() => normalizeCheckRecord({ ...annotated, annotation: { ...annotated.annotation, affirmedOpposed: ['character:1'] } }));
  const original = call();
  const validated = validateCheckCall(original, { actor: 7 });
  original.intent = 'A different action';
  assert.equal(validated.intent, 'Strike the raider');

  for (const raw of [0, 101, 1.5, '50', NaN, Infinity]) {
    assert.throws(() => createCheckRecord(context(), { ...fixedSources, roll: () => raw }), /D100 result/);
  }
  for (const bonus of [-1, 76, 0.5, '20', NaN]) {
    assert.throws(() => createCheckRecord({ ...context(), skillBonus: bonus }, fixedSources), /Skill bonus/);
  }
  for (const tier of ['DC 12', '__proto__', 'constructor', '', 50]) {
    assert.throws(() => validateCheckCall({ ...call(), tier }, { actor: 7 }), /Difficulty tier/);
  }
  assert.throws(() => validateCheckCall({ ...call(), actor: 8 }, { actor: 7 }), /acting character/);
  assert.throws(() => validateCheckCall({ ...call(), callSeq: 0 }, { actor: 7 }), /ordinal/);
  assert.throws(() => validateCheckCall({ ...call(), dc: 12 }, { actor: 7 }), /shape/);
  assert.throws(() => validateCheckCall({ ...call(), intent: 'x'.repeat(201) }, { actor: 7 }), /intent/);
  assert.throws(() => validateCheckCall({ ...call(), tierBasis: ' ' }, { actor: 7 }), /Tier basis/);
  assert.throws(() => validateCheckCall({ ...call(), deltas: [...hindrances, hindrances[0]] }, { actor: 7 }), /three/);
  assert.throws(() => validateCheckCall({ ...call(), deltas: [hindrances[0], { ...hindrances[0], reason: 'RAIN' }] }, { actor: 7 }), /Duplicate/);
  assert.throws(() => validateCheckCall({ ...call(), deltas: [{ ...hindrances[0], value: 12 }] }, { actor: 7 }), /shape/);
  assert.throws(() => validateCheckCall({ ...call(), deltas: [{ ...hindrances[0], magnitude: 12 }] }, { actor: 7 }), /magnitude/);
  assert.throws(() => createCheckRecord(context(), { ...fixedSources, newId: () => 'not-a-uuid' }), /UUID/);
  assert.throws(() => createCheckRecord(context(), { ...fixedSources, now: () => 'yesterday' }), /timestamp/);
  assert.throws(() => createCheckRecord({ ...context(), activeEncounter: undefined }, fixedSources), /Encounter state/);

  let rolls = 0;
  assert.throws(() => createCheckRecord(
    { ...context(), call: { ...call(), actor: 9 } },
    { ...fixedSources, roll: () => { rolls += 1; return 50; } }
  ));
  assert.equal(rolls, 0, 'Rejected calls must not consume randomness.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runRulesResolutionTests();
  console.log('Signed d100 resolution tests passed.');
}
