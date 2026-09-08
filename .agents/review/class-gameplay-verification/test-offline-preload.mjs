import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createOfflineFetch, OFFLINE_FETCH_MARKER } from './offline-preload.mjs';

const calls = [];
const fakeFetch = async (input, init) => {
  calls.push({ input, init });
  return { ok: true, status: 200 };
};
const fetch = createOfflineFetch(fakeFetch);
const denied = [
  'http://localhost:11434/api/chat', 'http://127.0.0.1:11434/api/generate',
  'http://127.0.0.2:11434/api/chat', 'http://[::1]:11434/api/chat',
  'http://2130706433:11434/api/chat', 'https://api.openai.com/v1/responses',
  'http://example.invalid:32000/fixture', 'http://0.0.0.0:32000/fixture',
  'http://localhost.example.invalid:32000/fixture', 'http://[::ffff:7f00:1]:32000/fixture',
  'data:text/plain,not-an-http-fixture', 'file:///tmp/offline-fixture', 'not a URL'
];
for (const url of denied) {
  await assert.rejects(fetch(url), error => error.code === 'OFFLINE_FETCH_BLOCKED');
  assert.equal(calls.length, 0, 'Denied targets cannot reach even the fake transport.');
}
await assert.rejects(fetch(new Request('http://localhost:11434/api/chat')), error => error.code === 'OFFLINE_FETCH_BLOCKED');
assert.equal(calls.length, 0);
for (const url of ['http://localhost:32000/fixture', 'http://127.0.0.1:32001/fixture', 'http://[::1]:32002/fixture']) {
  assert.equal((await fetch(new URL(url))).status, 200);
  assert.equal(calls.at(-1).init.redirect, 'error');
}
const request = new Request('http://127.0.0.1:32000/post', { method: 'POST', body: 'fixture', redirect: 'manual' });
await fetch(request);
assert.equal(calls.at(-1).input, request);
assert.equal(calls.at(-1).init.redirect, 'manual');
await fetch('http://127.0.0.1:32000/redirect', { redirect: 'follow' });
assert.equal(calls.at(-1).init.redirect, 'error', 'Native redirects cannot escape the checked initial URL.');
assert.equal(fetch[OFFLINE_FETCH_MARKER], true);

const preload = new URL('./offline-preload.mjs', import.meta.url).href;
const inherited = `${process.env.NODE_OPTIONS || ''} --import=${preload}`.trim();
const child = execFileSync(process.execPath, ['--input-type=module', '-e',
  "if (!globalThis.fetch[Symbol.for('aetheria.offline-verification-fetch')]) throw new Error('Missing inherited preload'); process.stdout.write('inherited');"],
{ env: { ...process.env, NODE_OPTIONS: inherited }, encoding: 'utf8' });
assert.equal(child, 'inherited');
console.log(`Offline preload guard passed: ${denied.length + 1} denied fake-transport targets, local fixtures, redirect guard, inherited child preload; no network requests.`);
