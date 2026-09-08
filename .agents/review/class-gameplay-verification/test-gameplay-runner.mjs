import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEpisodeProcessWorker, runEpisodeCoordinator } from './episode-coordinator.mjs';

const workerPath = fileURLToPath(new URL('./gameplay-worker.mjs', import.meta.url));
const run = inject => runEpisodeCoordinator({ mode: 'offline_verification',
  runWorker: createEpisodeProcessWorker({ workerPath, args: ['--verify', ...(inject ? [inject] : [])] }) });
const player = (report, snapshot = report.finalSnapshot) => snapshot.world.actors[`character:${report.preparation.state.character.id}`];
const named = (snapshot, name) => Object.values(snapshot.world.actors).find(actor => actor.name === name);

async function verifyEvidence(result, expectedInputs) {
  assert.equal(result.status, 'completed', JSON.stringify(result.episodes.map(episode => ({ id: episode.episodeId,
    error: episode.report?.error, validationError: episode.validationError, stderr: episode.stderr }))));
  assert.equal(result.episodes.length, 3, 'Each isolated episode must be attempted exactly once.');
  assert.equal(result.dispatches, 0, 'Offline verification must never generate model responses.');
  assert.equal(result.playerSubmissions, expectedInputs);
  assert.equal(new Set(result.episodes.map(episode => episode.pid)).size, 3, 'Episodes need separate terminal workers.');
  for (const episode of result.episodes) {
    const report = episode.report;
    assert.equal(report.serverSettled, true);
    assert.equal(report.accounted, true);
    assert.equal(report.inferenceStopped, true);
    assert.deepEqual(report.uiErrors, []);
    assert.equal(report.offlineProvider.dispatchAttempts, 0);
    assert.ok(report.calls.every(call => call.provenance === 'authored_offline'));
    assert.ok(report.finalSnapshot, 'Every settled episode needs final stored evidence.');
    if (report.finalSnapshot.operations.some(operation => operation.status === 'active')) {
      assert.equal(report.export, undefined, 'Pending actions must retain the production export restriction.');
      assert.equal(report.exportUnavailable.kind, 'pending_operation');
    } else {
      assert.ok(report.export);
      await access(join(episode.artifacts, report.export));
    }
    assert.deepEqual(JSON.parse(await readFile(join(episode.artifacts, 'report.json'), 'utf8')), report);
    for (const capture of report.views) {
      assert.ok(capture.views?.length === 2, 'The open browser must capture desktop and mobile evidence.');
      for (const view of capture.views) {
        assert.equal(view.overflow, false, `${episode.episodeId}/${capture.label} overflows.`);
        const png = await readFile(join(episode.artifacts, view.screenshot));
        assert.ok(png.length > 5000 && png.subarray(1, 4).toString() === 'PNG', 'Expected rendered browser screenshot.');
      }
    }
    assert.throws(() => process.kill(episode.pid, 0), error => error.code === 'ESRCH', 'A terminal worker cannot still be running.');
  }
}

const ordinary = await run(false);
await verifyEvidence(ordinary, 8);
const [magic, catalyst, ritual] = ordinary.episodes.map(episode => episode.report);
for (const report of [magic, catalyst, ritual]) {
  assert.equal(report.status, 'episode_observed');
  assert.ok(!report.limitation, `${report.episodeId}: ${report.limitation}`);
  assert.ok(report.actions.every(action => action.status === 'completed'), `${report.episodeId} must execute every authored input.`);
}
assert.deepEqual(magic.actions[0].after.world, magic.actions[0].before.world);
assert.equal(magic.actions[0].after.checks.length, 0);
assert.equal(magic.actions[0].after.operations.length, 0);
assert.ok(magic.actions[1].recognizedTerms.includes('Magic Missile'));
assert.ok(magic.actions[2].recognizedTerms.includes('Fireball'));
const fireball = magic.preparation.state.character.abilities.find(ability => ability.name === 'Fireball');
assert.equal(player(magic).classState.recoveryUses[fireball.definition_id], 1);
assert.ok(magic.finalSnapshot.checks.length >= 2, 'Both direct casts must resolve actual signed checks.');
assert.equal(catalyst.actions.length, 2);
assert.ok(catalyst.actions[0].recognizedTerms.includes('Advance Cue'));
assert.deepEqual(catalyst.actions[1].recognizedTerms, [], 'The ordinary follow-up requires no ability declaration.');
assert.ok(['gate', 'yard'].includes(named(catalyst.finalSnapshot, 'Nessa').area), 'The ally must retain an actual recorded position.');

const recall = ritual.preparation.state.character.abilities.find(ability => ability.name === 'Recall the Departed');
const material = Object.keys(ritual.initialSnapshot.world.items).find(ref => ritual.initialSnapshot.world.items[ref].kind === 'revival-catalyst');
for (const [index, action] of ritual.actions.slice(0, 2).entries()) {
  assert.equal(player(ritual, action.after).classState.ritual.completed, index + 1);
  assert.equal(named(action.after, 'Tarin').health, 0);
  assert.equal(action.after.world.items[material].lost, false);
  assert.equal(action.after.checks.length, 0, 'Preliminary workings cannot invent checks.');
  assert.equal(player(ritual, action.after).classState.recoveryUses[recall.definition_id], undefined);
}
assert.equal(ritual.actions[1].prose, 'I continue the same working.');
assert.equal(ritual.actions[2].prose, ritual.actions[1].prose);
assert.deepEqual(ritual.actions[1].recognizedTerms, []);
assert.deepEqual(ritual.actions[2].recognizedTerms, []);
assert.equal(player(ritual).classState.ritual, null);
assert.equal(player(ritual).classState.recoveryUses[recall.definition_id], 1);
assert.equal(ritual.finalSnapshot.checks.length, 1, 'Only the completing ritual makes its authored uncertain check.');
const finalCheck = JSON.parse(ritual.finalSnapshot.checks[0].record_json);
const succeeded = ['crit_success', 'clean_success', 'marginal_success'].includes(finalCheck.band);
assert.equal(named(ritual.finalSnapshot, 'Tarin').health, succeeded ? 1 : 0);
assert.equal(ritual.finalSnapshot.world.items[material].lost, succeeded);

const interrupted = await run('--inject-abort');
await verifyEvidence(interrupted, 6);
const stopped = interrupted.episodes[0].report;
assert.equal(stopped.status, 'transport_stopped');
assert.equal(stopped.actions.length, 1, 'An aborted input cannot be retried.');
assert.equal(stopped.calls.length, 1, 'The aborted episode cannot start another Council role.');
assert.equal(stopped.actions[0].transport.kind, 'request_failed');
assert.deepEqual(stopped.finalSnapshot, stopped.initialSnapshot, 'The aborted question must leave stored state unchanged.');
for (const episode of interrupted.episodes.slice(1)) {
  assert.equal(episode.report.status, 'episode_observed');
  assert.ok(episode.report.actions.every(action => action.status === 'completed'), 'A settled abort cannot prevent later real gameplay.');
}
const reserved = await run('--inject-narration-abort');
await verifyEvidence(reserved, 7);
const pending = reserved.episodes[0].report;
assert.equal(pending.status, 'transport_stopped');
assert.equal(pending.actions.length, 2, 'Only the question and one interrupted cast may be submitted.');
assert.equal(pending.actions[0].status, 'completed');
assert.equal(pending.actions[1].status, 'transport_failed');
assert.equal(pending.calls.at(-1).stage, 'narration');
assert.equal(pending.finalSnapshot.operations.filter(operation => operation.status === 'active').length, 1);
assert.ok(pending.finalSnapshot.checks.length >= 1, 'The interrupted cast must retain its actual recorded roll.');
assert.deepEqual(pending.finalSnapshot.world, pending.actions[1].before.world, 'Unnarrated changes must not be published.');
assert.equal(pending.exportUnavailable.kind, 'pending_operation');
for (const episode of reserved.episodes.slice(1)) {
  assert.equal(episode.report.status, 'episode_observed');
  assert.ok(episode.report.actions.every(action => action.status === 'completed'), 'A preserved pending action cannot starve unrelated episodes.');
}
console.log(JSON.stringify({ verification: 'authored_offline', normalCompletedInputs: 8,
  injectedAbortInputs: 2, laterCompletedInputs: 10, pendingRollRetained: true, generationDispatches: 0,
  artifacts: [...ordinary.episodes, ...interrupted.episodes, ...reserved.episodes].map(episode => episode.artifacts) }, null, 2));
