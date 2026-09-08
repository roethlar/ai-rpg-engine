import assert from 'node:assert/strict';
import { createLocalGuard, localModelManifest, MODELS, OLLAMA_ORIGIN } from './local-guard.mjs';

let generated = 0;
let cloud = false;
let missing = false;
let drift = false;
let remaining = 10000;
const fetchImpl = async (input, init) => {
  if (new URL(input).pathname === '/api/tags') return new Response(JSON.stringify({ models: Object.values(MODELS)
    .filter(name => !missing || name !== MODELS.prose)
    .map(name => ({ name, size: 2000000000, digest: `${drift ? 'changed' : 'digest'}:${name}`, ...(cloud ? { remote_host: 'https://ollama.com' } : {}) })) }));
  generated++;
  assert.equal(init.redirect, 'error');
  return new Response(JSON.stringify({ message: { content: '{}' } }));
};
const manifest = await localModelManifest(fetchImpl);
const report = { maximumDispatches: 1, dispatches: [] };
const active = { index: 0, stage: 'referee', model: MODELS.logic };
const guard = createLocalGuard({ fetchImpl, manifest, report, getActiveCall: () => active,
  getLocalOrigin: () => null, onDispatch: async () => {}, deadline: () => remaining });
const request = model => ({ method: 'POST', body: JSON.stringify({ model, stream: false, messages: [] }) });
await assert.rejects(guard.fetch(`${OLLAMA_ORIGIN}/api/chat`, request(MODELS.logic)), /not enabled/);
guard.enable();
await assert.rejects(guard.fetch('https://ollama.com/api/chat', request(MODELS.logic)), /local Ollama/);
await assert.rejects(guard.fetch(`${OLLAMA_ORIGIN}/api/pull`, request(MODELS.logic)), /chat transport/);
await assert.rejects(guard.fetch(`${OLLAMA_ORIGIN}/api/chat`, request('deepseek-v4-flash:cloud')), /Unapproved/);
await assert.rejects(guard.fetch(`${OLLAMA_ORIGIN}/api/chat`, request(MODELS.prose)), /active role/);
remaining = 0;
await assert.rejects(guard.fetch(`${OLLAMA_ORIGIN}/api/chat`, request(MODELS.logic)), /time budget/);
remaining = 10000;
drift = true;
await assert.rejects(guard.fetch(`${OLLAMA_ORIGIN}/api/chat`, request(MODELS.logic)), /identity changed/);
drift = false;
missing = true;
await assert.rejects(guard.fetch(`${OLLAMA_ORIGIN}/api/chat`, request(MODELS.logic)), /not registered/);
missing = false; cloud = true;
await assert.rejects(guard.fetch(`${OLLAMA_ORIGIN}/api/chat`, request(MODELS.logic)), /local weight/);
cloud = false;
assert.equal(generated, 0, 'Every rejection happens before the fake generation endpoint.');
const response = await guard.fetch(`${OLLAMA_ORIGIN}/api/chat`, request(MODELS.logic));
assert.deepEqual(await response.json(), { message: { content: '{}' } });
assert.equal(report.dispatches.length, 1);
assert.equal(generated, 1);
await assert.rejects(guard.fetch(`${OLLAMA_ORIGIN}/api/chat`, request(MODELS.logic)), /budget/);
assert.equal(generated, 1);
console.log('Local pilot guard checks passed with a fake transport; no network or model calls.');
