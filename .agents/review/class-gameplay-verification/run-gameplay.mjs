import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEpisodeProcessWorker, runEpisodeCoordinator } from './episode-coordinator.mjs';

const args = process.argv.slice(2);
assert.ok(args.every(arg => ['--run', '--verify', '--inject-abort', '--inject-narration-abort'].includes(arg)), 'Unknown gameplay-runner option.');
const execute = args.includes('--run');
assert.notEqual(execute, args.includes('--verify'), 'Select --verify for offline checks or --run for a separately approved live pilot.');
assert.ok(!execute || !args.some(arg => arg.startsWith('--inject-')), 'Failure injection cannot be used in a live pilot.');
const artifacts = await mkdtemp(join(tmpdir(), 'aetheria-gameplay-coordinator-'));
const mode = execute ? 'local_pilot' : 'offline_verification';
console.log(`Gameplay coordinator artifacts: ${artifacts}`);
const startedAt = new Date().toISOString();
const result = await runEpisodeCoordinator({ mode, runWorker: createEpisodeProcessWorker({
  workerPath: fileURLToPath(new URL('./gameplay-worker.mjs', import.meta.url)), args
}) });
await writeFile(join(artifacts, 'report.json'), JSON.stringify({ startedAt, endedAt: new Date().toISOString(), ...result }, null, 2));
for (const episode of result.episodes) {
  console.log(JSON.stringify({ episode: episode.episodeId, status: episode.report?.status,
    completedActions: episode.report?.actions?.filter(action => action.status === 'completed').length || 0,
    inputs: episode.report?.playerSubmissions, dispatches: episode.report?.dispatches?.length,
    error: episode.validationError || episode.report?.error?.message, artifacts: episode.artifacts }));
}
console.log(JSON.stringify({ mode, traversalStatus: result.status, stopReason: result.stopReason,
  playerSubmissions: result.playerSubmissions, generationDispatches: result.dispatches }));
if (result.status !== 'completed') process.exitCode = 1;
