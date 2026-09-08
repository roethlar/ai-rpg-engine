import assert from 'node:assert/strict';

export const MODELS = Object.freeze({ logic: 'qwen3.8:27b-mlx', prose: 'muse-glimmer:30b-mlx' });
export const ROLES = Object.freeze({ setup: MODELS.prose, interaction: MODELS.logic,
  continuity: MODELS.logic, referee: MODELS.logic, narration: MODELS.prose });
export const OLLAMA_ORIGIN = 'http://localhost:11434';

export async function localModelManifest(fetchImpl) {
  const response = await fetchImpl(`${OLLAMA_ORIGIN}/api/tags`, { redirect: 'error', signal: AbortSignal.timeout(5000) });
  assert.equal(response.status, 200, 'Local model metadata is unavailable.');
  const tags = await response.json();
  return Object.fromEntries(Object.values(MODELS).map(name => {
    const model = tags.models?.find(value => value.name === name);
    assert.ok(model, `Selected local model is not registered: ${name}`);
    assert.ok(!model.remote_host && !model.remote_model && model.size > 1000000 && model.digest,
      `Selected model is not demonstrably a local weight artifact: ${name}`);
    return [name, { digest: model.digest, size: model.size, format: model.details?.format || null }];
  }));
}

export function createLocalGuard({ fetchImpl, manifest, report, getActiveCall, getLocalOrigin, onDispatch,
  deadline = () => Infinity }) {
  let live = false;
  const cancellation = new AbortController();
  return {
    enable() { assert.ok(!cancellation.signal.aborted, 'A stopped pilot cannot start a fresh allowance.'); live = true; },
    disable() { live = false; },
    abort() { live = false; cancellation.abort(new Error('The pilot stopped; no further inference is permitted.')); },
    async fetch(input, init = {}) {
      const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
      if (url.origin === getLocalOrigin()) return fetchImpl(input, { ...init, redirect: 'error' });
      assert.ok(live, 'Local inference is not enabled; offline preparation cannot generate.');
      assert.equal(url.origin, OLLAMA_ORIGIN, 'Only the approved local Ollama endpoint may generate.');
      assert.equal(url.pathname, '/api/chat', 'Only the existing chat transport is approved.');
      assert.equal(init.method, 'POST');
      const body = JSON.parse(init.body);
      assert.ok(Object.values(MODELS).includes(body.model), 'Unapproved or cloud model rejected.');
      assert.equal(body.stream, false);
      const active = getActiveCall();
      assert.ok(active && active.model === body.model, 'Dispatch must match the active role call.');
      assert.ok(report.dispatches.length < report.maximumDispatches, 'The local pilot dispatch budget is exhausted.');
      assert.ok(deadline() > 0, 'The local pilot time budget is exhausted.');
      const current = await localModelManifest(fetchImpl);
      assert.deepEqual(current, manifest, 'Selected model identity changed; do not continue.');
      assert.ok(live && !cancellation.signal.aborted && deadline() > 0, 'The pilot stopped during model metadata inspection.');
      const dispatch = { index: report.dispatches.length, callIndex: active.index, model: body.model,
        stage: active.stage, request: body, startedAt: new Date().toISOString() };
      report.dispatches.push(dispatch);
      await onDispatch();
      const start = performance.now();
      try {
        const response = await fetchImpl(input, { ...init, redirect: 'error',
          signal: AbortSignal.any([init.signal, cancellation.signal, AbortSignal.timeout(Math.max(1, Math.floor(Math.min(deadline(), 240000))))].filter(Boolean)) });
        dispatch.status = response.status;
        dispatch.headersMs = performance.now() - start;
        for (const method of ['json', 'text']) {
          const read = response[method].bind(response);
          response[method] = async () => {
            try { const value = await read(); dispatch.response = value; return value; }
            catch (error) { dispatch.error = error.message; throw error; }
            finally { dispatch.bodyCompleteMs = performance.now() - start; }
          };
        }
        return response;
      } catch (error) { dispatch.error = error.message; dispatch.elapsedMs = performance.now() - start; throw error; }
    }
  };
}
