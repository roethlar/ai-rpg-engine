import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { PILOT_DRAFT, validatePilotDraft, observeBrowserRequest, trackApplicationRequests, verifyRenderedNarrative } from './runner-support.mjs';

validatePilotDraft(PILOT_DRAFT);
assert.throws(() => validatePilotDraft({ ...PILOT_DRAFT, concept: 'A field arcanist defending an open rescue route from an actively attacking enemy.' }), /80-character/);
assert.throws(() => validatePilotDraft({ ...PILOT_DRAFT, concept: '' }), /required/);

let finished = 0;
let received = 0;
let aborted = false;
const server = createServer(async (request, response) => {
  if (request.method === 'GET') {
    response.setHeader('Content-Type', 'text/html');
    response.end('<!doctype html><title>Offline transport fixture</title>');
    return;
  }
  received++;
  if (request.url === '/api/campaigns/2/turn') await delay(250);
  response.statusCode = request.url === '/api/campaigns' ? 400 : 200;
  response.setHeader('Content-Type', 'application/json');
  finished++;
  response.end(JSON.stringify({ finished }));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const tracker = trackApplicationRequests(server);
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const page = await context.newPage();
  const listenerCounts = Object.fromEntries(['request', 'response', 'requestfailed', 'close'].map(event => [event, page.listenerCount(event)]));
  await page.goto(origin);
  for (const name of ['marked', 'purify']) await page.addScriptTag({ path: fileURLToPath(new URL(`../../../public/lib/${name}.min.js`, import.meta.url)) });
  const narrative = '**Tarin** remains still.\n\nThe working is *unfinished*.';
  await page.evaluate(source => {
    document.body.innerHTML = '<div class="log-gm"><div class="content"></div></div>';
    document.querySelector('.content').innerHTML = DOMPurify.sanitize(marked.parse(source));
  }, narrative);
  await verifyRenderedNarrative(page, narrative);
  await assert.rejects(verifyRenderedNarrative(page, 'Tarin returns to life.'), /visible narrative/);
  for (const pathname of ['/api/campaigns/1/turn', '/api/campaigns']) {
    const observed = observeBrowserRequest(page, { pathname, timeoutMs: 2000 });
    await page.evaluate(path => { void fetch(path, { method: 'POST' }); }, pathname);
    const outcome = await observed.result;
    assert.equal(outcome.kind, 'response');
    assert.equal(outcome.response.status(), pathname === '/api/campaigns' ? 400 : 200);
    await outcome.response.json();
    assert.equal(await tracker.waitForIdle(1000), true);
    observed.cancel();
  }
  const observed = observeBrowserRequest(page, { pathname: '/api/campaigns/2/turn', timeoutMs: 2000 });
  await page.evaluate(() => {
    void fetch('/api/campaigns/2/turn', { method: 'POST', signal: AbortSignal.timeout(60) }).catch(error => { window.requestFailure = error.name; });
  });
  const outcome = await observed.result;
  assert.equal(outcome.kind, 'request_failed', 'A browser abort must finish the response wait without another submission.');
  aborted = true;
  assert.equal(tracker.pending, 1, 'Socket close is not application settlement.');
  assert.equal(await tracker.waitForIdle(10), false, 'An unfinished handler must not be reported settled.');
  assert.equal(await tracker.waitForIdle(2000), true);
  assert.equal(finished, 3, 'The final handler outcome remains observable after browser abort.');
  assert.equal(received, 3, 'No transport retry was purchased.');
  for (const [event, count] of Object.entries(listenerCounts)) assert.equal(page.listenerCount(event), count);

  const bounded = observeBrowserRequest(page, { pathname: '/never-submitted', timeoutMs: 20 });
  assert.equal((await bounded.result).kind, 'deadline');
  const closed = observeBrowserRequest(page, { pathname: '/never-submitted', timeoutMs: 2000 });
  await page.close();
  assert.equal((await closed.result).kind, 'page_closed');
  console.log('Pilot draft, Markdown rendering, HTTP rejection, browser abort, application settlement and deadline checks passed; zero model calls.');
} finally {
  await browser.close();
  await tracker.waitForIdle(2000);
  tracker.detach();
  await new Promise(resolve => server.close(resolve));
}
assert.ok(aborted);
