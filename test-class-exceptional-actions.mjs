import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { prepareClassAction, finalizeClassAction } from './class-actions.js';
import { evaluateEffects } from './rules-effects.js';
import { classActionTestState } from './test-class-actions.mjs';
import { effectsTestState } from './test-rules-effects.mjs';

const ACTOR = 'character:1';
const ALLY = 'character:2';
const NPC = 'npc:3';
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;

export function runClassExceptionalActionTests() {
  let state = classActionTestState('arcanist', 'arcanist.ritual');
  const recall = state.actors[ACTOR].abilities.find(value => value.name === 'Recall the Departed');
  for (const ref of [ALLY, NPC]) Object.assign(state.actors[ref], { health: 0, status: 'dead', deathTurn: 8, intactBody: true, willingReturn: true });
  const context = { operationId: 'recall-start', turn: 10, consentingActors: [ALLY] };
  const bindings = { targets: [ALLY], catalyst: 'item:2' };
  const first = prepareClassAction({ state, actor: ACTOR, ability: recall.id, bindings, context });
  state = canonical(finalizeClassAction({ state, plan: first, outcome: 'success' }).state);
  assert.deepEqual(Object.keys(state.actors[ACTOR].classState.ritual.bindings), ['catalyst', 'targets']);
  const second = prepareClassAction({ state, actor: ACTOR, ability: recall.id,
    bindings: state.actors[ACTOR].classState.ritual.bindings, context: { ...context, operationId: 'recall-continue', turn: 11 } });
  assert.equal(second.phase, 'ritual_progress', 'Canonical JSON key ordering must not change a working identity.');
  assert.throws(() => prepareClassAction({ state, actor: ACTOR, ability: recall.id,
    bindings: { catalyst: 'item:2', targets: [NPC] }, context: { ...context, operationId: 'changed-recall-target' } }),
  error => error.code === 'CLASS_ACTION_RITUAL');

  state = classActionTestState('arcanist', 'arcanist.ritual');
  state.areas['area:1:a'].focus = true;
  const transit = state.actors[ACTOR].abilities.find(value => value.name === 'Transit Circle');
  const transitBindings = { travelers: [ACTOR, ALLY, NPC], area: 'area:2:d' };
  const transitContext = { operationId: 'transit-start', turn: 10, consentingActors: [ALLY, NPC] };
  const start = prepareClassAction({ state, actor: ACTOR, ability: transit.id, bindings: transitBindings, context: transitContext });
  state = canonical(finalizeClassAction({ state, plan: start, outcome: 'success' }).state);
  for (const changed of [{ ...transitBindings, travelers: [ACTOR, NPC, ALLY] }, { ...transitBindings, area: 'area:1:b' }]) {
    assert.throws(() => prepareClassAction({ state, actor: ACTOR, ability: transit.id, bindings: changed,
      context: { ...transitContext, operationId: 'changed-transit' } }), error => error.code === 'CLASS_ACTION_RITUAL');
  }
  const finish = prepareClassAction({ state, actor: ACTOR, ability: transit.id, bindings: state.actors[ACTOR].classState.ritual.bindings,
    context: { ...transitContext, operationId: 'transit-finish', turn: 11 } });
  assert.equal(finish.phase, 'complete');

  const effectState = effectsTestState();
  delete effectState.actors[ALLY].willingTravel;
  const circle = { op: 'teleport', who: [ACTOR, ALLY], area: 'area:1:b', maximumAreas: 1, mode: 'circle' };
  const evaluate = consentingActors => evaluateEffects({ state: effectState, effects: [circle], consumer: 'ability', actor: 1,
    turn: 10, transactionId: 'exact-circle-consent', consentingActors });
  const before = structuredClone(effectState);
  for (const refs of [[], [NPC]]) assert.throws(() => evaluate(refs), error => error.code === 'RULES_EFFECT_PRECONDITION');
  assert.throws(() => evaluate([ALLY, ALLY]), error => error.code === 'RULES_EFFECT_SHAPE');
  assert.throws(() => evaluate(['npc:2']), error => error.code === 'RULES_EFFECT_ALLEGIANCE');
  assert.throws(() => evaluate(['npc:999']), error => error.code === 'RULES_EFFECT_REFERENCE');
  assert.deepEqual(effectState, before, 'Rejected consent cannot mutate any actor.');
  const crossed = evaluate([ALLY]);
  assert.equal(crossed.state.actors[ALLY].area, 'b');
  assert.equal(crossed.state.actors[ALLY].willingTravel, undefined);
  assert.equal(crossed.state.actors[NPC].area, 'a');
  assert.deepEqual(effectState, before);
  return { persistedRituals: 2, changedBindingsRejected: 3, consentRejections: 5 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log('Exceptional class action tests passed:', runClassExceptionalActionTests());
}
