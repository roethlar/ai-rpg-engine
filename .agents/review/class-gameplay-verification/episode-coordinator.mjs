import { spawn } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export const MAXIMUM_RUN_MS = 1200000;
export const EPISODE_ALLOCATIONS = Object.freeze([
  Object.freeze({ id: 'direct-magic', maximumDispatches: 20, maximumPlayerSubmissions: 3, maxLiveMs: 360000 }),
  Object.freeze({ id: 'catalyst', maximumDispatches: 20, maximumPlayerSubmissions: 2, maxLiveMs: 360000 }),
  Object.freeze({ id: 'ritual', maximumDispatches: 20, maximumPlayerSubmissions: 3, maxLiveMs: 360000 })
]);
const CLOCK = { now: () => performance.now(), setTimeout, clearTimeout };
const MODES = new Set(['offline_verification', 'local_pilot']);
const CONTINUABLE = new Set(['episode_observed', 'episode_rejected', 'transport_stopped', 'time_budget_exhausted']);
const LOGIC_STAGES = new Set(['interaction', 'grounding', 'referee', 'pre_roll', 'annotation', 'annotation_review', 'table_talk']);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function validateResult(result, allocation, mode) {
  if (!result?.terminal || result.exitCode !== 0 || result.signal || result.forcedKill || result.descendantsSettled === false) return 'Worker did not exit cleanly.';
  if (result.protocolError) return result.protocolError;
  const report = result.report;
  if (!object(report) || report.episodeId !== allocation.id || report.mode !== mode) return 'Worker identity or mode does not match its allocation.';
  if (!CONTINUABLE.has(report.status)) return 'Worker reported a fatal or unknown outcome.';
  if (report.serverSettled !== true || report.inferenceStopped !== true || report.accounted !== true) return 'Worker settlement or inference accounting is incomplete.';
  const budget = report.budget;
  if (!object(budget) || Object.keys(budget).length !== 3 || budget.maximumDispatches !== allocation.maximumDispatches
    || budget.maximumPlayerSubmissions !== allocation.maximumPlayerSubmissions || budget.maxLiveMs !== allocation.maxLiveMs) return 'Worker allocation changed.';
  if (!Array.isArray(report.dispatches) || report.dispatches.length > allocation.maximumDispatches
    || !Number.isSafeInteger(report.playerSubmissions) || report.playerSubmissions < 0
    || report.playerSubmissions > allocation.maximumPlayerSubmissions) return 'Worker exceeded or omitted its usage accounting.';
  if (!Array.isArray(report.calls) || report.calls.some((call, index) => !object(call) || call.index !== index)) return 'Worker call accounting is incomplete.';
  for (const [index, dispatch] of report.dispatches.entries()) {
    const call = Number.isSafeInteger(dispatch?.callIndex) && report.calls[dispatch.callIndex];
    const model = dispatch?.stage === 'narration' ? 'muse-glimmer:30b-mlx'
      : LOGIC_STAGES.has(dispatch?.stage) ? 'qwen3.8:27b-mlx' : null;
    if (!object(dispatch) || dispatch.index !== index || !call || !model || dispatch.model !== model
      || call.model !== dispatch.model || call.stage !== dispatch.stage) return 'Worker dispatch identity or accounting is invalid.';
  }
  if (mode === 'offline_verification' && report.dispatches.length) return 'Offline verification dispatched inference.';
  const started = Date.parse(report.startedAt), ended = Date.parse(report.endedAt);
  if (!Number.isFinite(started) || !Number.isFinite(ended) || ended < started) return 'Worker timestamps are incomplete.';
  return null;
}

export async function runEpisodeCoordinator({ runWorker, mode, clock = CLOCK }) {
  if (typeof runWorker !== 'function' || !MODES.has(mode)) throw new TypeError('A worker and an explicit supported mode are required.');
  const started = clock.now();
  const episodes = [];
  let stopReason = null;
  for (const allocation of EPISODE_ALLOCATIONS) {
    const remaining = MAXIMUM_RUN_MS - (clock.now() - started);
    if (remaining <= 0) { stopReason = 'Aggregate deadline exhausted.'; break; }
    const controller = new AbortController();
    let liveStarted = false;
    let protocolError = null;
    let episodeTimer;
    const abort = code => { if (!controller.signal.aborted) controller.abort(Object.assign(new Error(code), { code })); };
    const aggregateTimer = clock.setTimeout(() => abort('AGGREGATE_DEADLINE'), remaining);
    const onLiveStart = () => {
      if (liveStarted || controller.signal.aborted) {
        protocolError = 'Worker live start was duplicated or arrived after cancellation.';
        abort('WORKER_PROTOCOL');
        return;
      }
      liveStarted = true;
      episodeTimer = clock.setTimeout(() => abort('EPISODE_DEADLINE'), allocation.maxLiveMs);
    };
    let result;
    try {
      result = await runWorker({ allocation, signal: controller.signal, onLiveStart });
    } catch (error) {
      result = { terminal: false, exitCode: null, signal: null, report: null, error: error.message };
    } finally {
      clock.clearTimeout(aggregateTimer);
      clock.clearTimeout(episodeTimer);
    }
    const invalid = protocolError || (!liveStarted ? 'Worker never confirmed live start.' : null)
      || validateResult(result, allocation, mode);
    episodes.push({ episodeId: allocation.id, allocation, ...result, validationError: invalid });
    if (invalid) { stopReason = invalid; break; }
    if (clock.now() - started >= MAXIMUM_RUN_MS) { stopReason = 'Aggregate deadline exhausted.'; break; }
  }
  return { mode, status: stopReason ? 'stopped' : 'completed', stopReason, episodes,
    dispatches: episodes.reduce((sum, entry) => sum + (Array.isArray(entry.report?.dispatches) ? entry.report.dispatches.length : 0), 0),
    playerSubmissions: episodes.reduce((sum, entry) => sum + (Number.isSafeInteger(entry.report?.playerSubmissions) ? entry.report.playerSubmissions : 0), 0) };
}

// A returned worker promise is terminal: even cancellation waits for this owned
// process to close before the coordinator can inspect its report or start another.
export function createEpisodeProcessWorker({ workerPath, args = [], env = {}, cwd = process.cwd(), terminationGraceMs = 20000 }) {
  if (typeof workerPath !== 'string' || !workerPath || !Array.isArray(args)
    || args.some(value => typeof value !== 'string') || !Number.isFinite(terminationGraceMs)
    || terminationGraceMs < 1 || terminationGraceMs > 20000) throw new TypeError('Invalid episode worker configuration.');
  const entrypoint = resolve(workerPath);
  return async ({ allocation, signal, onLiveStart }) => {
    const artifacts = await mkdtemp(join(tmpdir(), `aetheria-gameplay-episode-${allocation.id}-`));
    if (signal.aborted) return { terminal: true, exitCode: null, signal: null, report: null, artifacts };
    const grouped = process.platform !== 'win32';
    const child = spawn(process.execPath, [entrypoint, ...args, '--episode', allocation.id, '--artifacts', artifacts],
      { cwd, env: { ...process.env, ...env }, detached: grouped, stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
    let forcedKill = false;
    let protocolError = null;
    let processError = null;
    let stderr = '';
    let forceTimer;
    const sendSignal = name => {
      if (!child.pid) return;
      try { if (grouped && name === 'SIGKILL') process.kill(-child.pid, name); else child.kill(name); }
      catch (error) { if (error.code !== 'ESRCH') processError ||= error.message; }
    };
    const stop = () => {
      if (forceTimer) return;
      sendSignal('SIGTERM');
      forceTimer = setTimeout(() => { forcedKill = true; sendSignal('SIGKILL'); }, terminationGraceMs);
    };
    child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-16000); });
    child.on('message', message => {
      if (!object(message) || message.type !== 'live_started' || message.episodeId !== allocation.id
        || Object.keys(message).length !== 2) {
        protocolError = 'Worker sent an invalid live-start message.';
        stop();
      } else onLiveStart();
    });
    child.on('error', error => { processError = error.message; });
    signal.addEventListener('abort', stop, { once: true });
    if (signal.aborted) stop();
    const terminal = await new Promise(resolveExit => child.once('close', (exitCode, exitSignal) => resolveExit({ exitCode, signal: exitSignal })));
    signal.removeEventListener('abort', stop);
    clearTimeout(forceTimer);
    // The detached process group belongs only to this worker. Remove any surviving
    // descendants after terminal exit; never target an unrelated server or model.
    let descendantsSettled = false;
    if (grouped && child.pid) {
      sendSignal('SIGKILL');
      const cleanupDeadline = performance.now() + 2000;
      while (performance.now() < cleanupDeadline) {
        try { process.kill(-child.pid, 0); }
        catch (error) {
          if (error.code === 'ESRCH') descendantsSettled = true;
          else processError ||= error.message;
          break;
        }
        await new Promise(resolveWait => setTimeout(resolveWait, 25));
      }
    }
    if (!descendantsSettled) processError ||= 'Owned worker process-group cleanup could not be confirmed.';
    let report = null;
    try { report = JSON.parse(await readFile(join(artifacts, 'report.json'), 'utf8')); }
    catch (error) { processError ||= `Final report unavailable: ${error.message}`; }
    return { terminal: true, ...terminal, report, artifacts, pid: child.pid, forcedKill, descendantsSettled,
      protocolError: protocolError || processError, stderr };
  };
}
