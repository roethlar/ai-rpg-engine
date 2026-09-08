import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EPISODE_ALLOCATIONS, MAXIMUM_RUN_MS, runEpisodeCoordinator, createEpisodeProcessWorker } from './episode-coordinator.mjs';

function fakeClock() {
  let now = 0, sequence = 0;
  const timers = new Map();
  return { now: () => now,
    setTimeout(fn, delay) { const id = ++sequence; timers.set(id, { at: now + delay, fn }); return id; },
    clearTimeout(id) { timers.delete(id); },
    advance(ms) {
      const end = now + ms;
      while (true) {
        const next = [...timers.entries()].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        now = next[1].at; timers.delete(next[0]); next[1].fn();
      }
      now = end;
    }
  };
}

function result(allocation, { status = 'episode_observed', count = 0, mode = 'offline_verification', patch = {} } = {}) {
  return { terminal: true, exitCode: 0, signal: null, report: {
    episodeId: allocation.id, mode, status, serverSettled: true, inferenceStopped: true, accounted: true,
    startedAt: '2026-09-08T00:00:00.000Z', endedAt: '2026-09-08T00:00:01.000Z',
    budget: { maximumDispatches: 20, maximumPlayerSubmissions: allocation.maximumPlayerSubmissions, maxLiveMs: 360000 },
    dispatches: Array.from({ length: count }, (_, index) => ({ index, callIndex: index, stage: 'interaction', model: 'qwen3.8:27b-mlx' })),
    calls: Array.from({ length: count }, (_, index) => ({ index, stage: 'interaction', model: 'qwen3.8:27b-mlx' })),
    playerSubmissions: allocation.maximumPlayerSubmissions, ...patch
  } };
}

const clock = fakeClock();
let active = 0;
const reservations = [];
const continued = await runEpisodeCoordinator({ mode: 'local_pilot', clock,
  runWorker: async ({ allocation, signal, onLiveStart }) => {
    assert.equal(active++, 0, 'Episodes cannot overlap.');
    assert.ok(Object.isFrozen(allocation));
    reservations.push(allocation);
    onLiveStart();
    clock.advance(allocation.id === 'direct-magic' ? 360000 : 1000);
    if (allocation.id === 'direct-magic') assert.equal(signal.reason.code, 'EPISODE_DEADLINE');
    active--;
    return result(allocation, { mode: 'local_pilot', count: allocation.id === 'direct-magic' ? 1 : 20,
      status: allocation.id === 'direct-magic' ? 'transport_stopped' : 'episode_observed' });
  }
});
assert.equal(continued.status, 'completed');
assert.equal(continued.dispatches, 41);
assert.equal(continued.playerSubmissions, 8);
assert.deepEqual(reservations.map(value => [value.id, value.maximumDispatches, value.maximumPlayerSubmissions, value.maxLiveMs]),
  [['direct-magic', 20, 3, 360000], ['catalyst', 20, 2, 360000], ['ritual', 20, 3, 360000]], 'Unused capacity is never transferred or reset.');

for (const patch of [
  { accounted: false }, { serverSettled: false }, { inferenceStopped: false }, { status: 'fatal' },
  { episodeId: 'ritual' }, { mode: 'local_pilot' }, { budget: { maximumDispatches: 21, maximumPlayerSubmissions: 3, maxLiveMs: 360000 } },
  { playerSubmissions: 4 }, { dispatches: [{ index: 1, callIndex: 0, stage: 'interaction', model: 'qwen3.8:27b-mlx' }] }
]) {
  let starts = 0;
  const stopped = await runEpisodeCoordinator({ mode: 'offline_verification', clock: fakeClock(), runWorker: async ({ allocation, onLiveStart }) => {
    starts++; onLiveStart(); return result(allocation, { patch });
  } });
  assert.equal(stopped.status, 'stopped');
  assert.equal(starts, 1, 'Unaccounted, unsettled or identity failures cannot release another episode.');
}
for (const options of [
  { count: 21 },
  { patch: { calls: [{ index: 0, model: 'wrong', stage: 'interaction' }], dispatches: [{ index: 0, callIndex: 0, model: 'wrong', stage: 'interaction' }] } }
]) {
  const stopped = await runEpisodeCoordinator({ mode: 'local_pilot', clock: fakeClock(), runWorker: async ({ allocation, onLiveStart }) => {
    onLiveStart(); return result(allocation, { mode: 'local_pilot', ...options });
  } });
  assert.equal(stopped.status, 'stopped', 'Dispatch overflow and wrong model identity must stop the whole run.');
  assert.equal(stopped.episodes.length, 1);
}

const aggregateClock = fakeClock();
let aggregateStarts = 0;
const aggregate = await runEpisodeCoordinator({ mode: 'offline_verification', clock: aggregateClock,
  runWorker: async ({ allocation, signal, onLiveStart }) => {
    aggregateStarts++;
    aggregateClock.advance(aggregateStarts === 1 ? MAXIMUM_RUN_MS - 1000 : 0);
    onLiveStart();
    aggregateClock.advance(1000);
    assert.equal(signal.reason.code, 'AGGREGATE_DEADLINE');
    aggregateClock.advance(20000);
    return result(allocation, { status: 'time_budget_exhausted' });
  }
});
assert.equal(aggregate.status, 'stopped');
assert.equal(aggregateStarts, 1, 'Cleanup after the immutable aggregate deadline cannot start a fresh allocation.');

const directory = await mkdtemp(join(tmpdir(), 'aetheria-episode-coordinator-test-'));
const artifacts = [];
try {
  const fixture = join(directory, 'worker.mjs');
  const trace = join(directory, 'trace.jsonl');
  await writeFile(fixture, `import { appendFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
const value = flag => process.argv[process.argv.indexOf(flag) + 1];
const episodeId = value('--episode'), artifacts = value('--artifacts');
await appendFile(process.env.EPISODE_TEST_TRACE, JSON.stringify({event:'start',episodeId,pid:process.pid})+'\\n');
process.send({type:'live_started',episodeId});
if (process.env.EPISODE_TEST_HANG === 'yes' || process.env.EPISODE_TEST_GRACEFUL === 'yes') {
  const descendant = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {stdio:'ignore'});
  await appendFile(process.env.EPISODE_TEST_TRACE, JSON.stringify({event:'descendant',pid:descendant.pid})+'\\n');
  process.on('SIGTERM', async () => {
    if (process.env.EPISODE_TEST_HANG === 'yes') return;
    let alive = true;
    try { process.kill(descendant.pid,0); } catch { alive = false; }
    await appendFile(process.env.EPISODE_TEST_TRACE, JSON.stringify({event:'graceful',alive})+'\\n');
    const closed = new Promise(resolve => descendant.once('close',resolve));
    descendant.kill('SIGTERM');
    await closed;
    await writeFile(join(artifacts,'report.json'), JSON.stringify({episodeId,mode:'offline_verification',
      status:'transport_stopped',serverSettled:true,inferenceStopped:true,accounted:true,
      budget:{maximumDispatches:20,maximumPlayerSubmissions:episodeId==='catalyst'?2:3,maxLiveMs:360000},
      calls:[],dispatches:[],playerSubmissions:1,startedAt:new Date().toISOString(),endedAt:new Date().toISOString()}));
    process.exit(0);
  });
  setInterval(() => {}, 1000);
} else {
  await writeFile(join(artifacts,'report.json'), JSON.stringify({episodeId,mode:'offline_verification',
    status:episodeId==='direct-magic'?'transport_stopped':'episode_observed',serverSettled:true,inferenceStopped:true,accounted:true,
    budget:{maximumDispatches:20,maximumPlayerSubmissions:episodeId==='catalyst'?2:3,maxLiveMs:360000},
    calls:[],dispatches:[],playerSubmissions:1,startedAt:new Date().toISOString(),endedAt:new Date().toISOString()}));
  await new Promise(resolve => setTimeout(resolve,80));
  await appendFile(process.env.EPISODE_TEST_TRACE, JSON.stringify({event:'end',episodeId,pid:process.pid})+'\\n');
  process.exit(0);
}`);
  const worker = createEpisodeProcessWorker({ workerPath: fixture, env: { EPISODE_TEST_TRACE: trace } });
  const real = await runEpisodeCoordinator({ mode: 'offline_verification', runWorker: worker });
  artifacts.push(...real.episodes.map(episode => episode.artifacts));
  assert.equal(real.status, 'completed');
  const events = (await readFile(trace, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(events.map(event => event.event), ['start', 'end', 'start', 'end', 'start', 'end'],
    'A report on disk cannot start the next episode before the previous process exits.');
  assert.equal(new Set(events.map(event => event.pid)).size, 3, 'Every episode uses an independent process.');
  for (const episode of real.episodes) assert.throws(() => process.kill(episode.pid, 0), error => error.code === 'ESRCH');

  const gracefulTrace = join(directory, 'graceful.jsonl');
  const gracefulClock = fakeClock();
  const gracefulWorker = createEpisodeProcessWorker({ workerPath: fixture, terminationGraceMs: 1000,
    env: { EPISODE_TEST_TRACE: gracefulTrace, EPISODE_TEST_GRACEFUL: 'yes' } });
  const graceful = await runEpisodeCoordinator({ mode: 'offline_verification', clock: gracefulClock,
    runWorker: options => gracefulWorker({ ...options, onLiveStart: () => {
      options.onLiveStart(); setTimeout(() => gracefulClock.advance(360000), 100);
    } })
  });
  artifacts.push(...graceful.episodes.map(episode => episode.artifacts));
  assert.equal(graceful.status, 'completed', 'A settled graceful timeout can release the next independent allocation.');
  assert.ok(graceful.episodes.every(episode => !episode.forcedKill && episode.descendantsSettled));
  const gracefulEvents = (await readFile(gracefulTrace, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(gracefulEvents.filter(event => event.event === 'graceful').map(event => event.alive), [true, true, true],
    'SIGTERM reaches only the worker, preserving its opportunity to settle browser/server descendants.');

  const hangTrace = join(directory, 'hang.jsonl');
  const hangClock = fakeClock();
  const hangingWorker = createEpisodeProcessWorker({ workerPath: fixture, terminationGraceMs: 100,
    env: { EPISODE_TEST_TRACE: hangTrace, EPISODE_TEST_HANG: 'yes' } });
  const killed = await runEpisodeCoordinator({ mode: 'offline_verification', clock: hangClock,
    runWorker: options => hangingWorker({ ...options, onLiveStart: () => {
      options.onLiveStart();
      setTimeout(() => hangClock.advance(360000), 100);
    } })
  });
  artifacts.push(...killed.episodes.map(episode => episode.artifacts));
  assert.equal(killed.status, 'stopped');
  assert.equal(killed.episodes.length, 1, 'An unaccounted killed worker cannot release another allocation.');
  assert.equal(killed.episodes[0].forcedKill, true);
  assert.equal(killed.episodes[0].terminal, true);
  assert.equal(killed.episodes[0].signal, 'SIGKILL');
  const hung = (await readFile(hangTrace, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  for (const event of hung) assert.throws(() => process.kill(event.pid, 0), error => error.code === 'ESRCH',
    'Containment removes only the owned worker and its descendant, leaving no stale process.');
  console.log('Episode coordinator tests passed: fixed reservations, sequential terminal workers, accounting stops, deadlines and owned-child containment.');
} finally {
  for (const artifact of artifacts) await rm(artifact, { recursive: true, force: true });
  await rm(directory, { recursive: true, force: true });
}
