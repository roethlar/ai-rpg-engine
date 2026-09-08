import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { observeSubmission } from './submission-evidence.mjs';

const HTML = `<!doctype html><html><body><button id="send">Send</button><output id="result"></output>
<script>
document.querySelector('#send').addEventListener('click', async () => {
  window.requestController = new AbortController();
  try {
    const response = await fetch(window.destination, {method:'POST',signal:window.requestController.signal});
    document.querySelector('#result').textContent = await response.text();
  } catch (error) { document.querySelector('#result').textContent = error.name; }
});
</script></body></html>`;

export async function runSubmissionEvidenceTests() {
  const { chromium } = await import('playwright');
  const counts = new Map();
  const sockets = new Set();
  const timers = new Set();
  const unhandled = [];
  const onUnhandled = error => unhandled.push(error);
  process.on('unhandledRejection', onUnhandled);
  const server = createServer((request, response) => {
    if (request.method !== 'POST') { response.writeHead(200, { 'Content-Type': 'text/html' }); response.end(HTML); return; }
    counts.set(request.url, (counts.get(request.url) || 0) + 1);
    if (request.url === '/headers-deadline' || request.url === '/client-abort') return;
    response.writeHead(request.url === '/rejected' ? 400 : 200, { 'Content-Type': 'application/json' });
    if (request.url === '/success') response.end(JSON.stringify({ ok: true, message: 'Complete response.' }));
    else if (request.url === '/rejected') response.end(JSON.stringify({ error: 'An ordinary rejected request.' }));
    else if (request.url === '/invalid-json') response.end('complete but not JSON');
    else if (request.url === '/truncated-body') {
      response.write('{"ok":');
      const timer = setTimeout(() => { timers.delete(timer); response.destroy(); }, 40);
      timers.add(timer);
    } else if (request.url === '/body-deadline') response.write('{"ok":');
    else { response.statusCode = 404; response.end('{}'); }
  });
  server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  const events = ['request', 'response', 'requestfailed', 'close'];
  const listeners = page => events.map(event => page.listenerCount(event));
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(2000);
    const choose = async pathname => {
      await page.goto(origin);
      await page.evaluate(value => { window.destination = value; }, pathname);
    };
    const run = async (pathname, timeoutMs = 2000) => {
      await choose(pathname);
      const before = listeners(page);
      const result = await observeSubmission(page, { pathname, timeoutMs, submit: () => page.locator('#send').click() });
      assert.deepEqual(listeners(page), before, `${pathname} must dispose all observer listeners.`);
      assert.equal(counts.get(pathname), 1, `${pathname} submits exactly one request.`);
      return result;
    };
    const success = await run('/success');
    assert.equal(success.kind, 'response');
    assert.equal(success.response.status(), 200);
    assert.deepEqual(success.body, { ok: true, message: 'Complete response.' });
    const rejected = await run('/rejected');
    assert.equal(rejected.kind, 'response');
    assert.equal(rejected.response.status(), 400);
    assert.deepEqual(rejected.body, { error: 'An ordinary rejected request.' });
    const truncated = await run('/truncated-body');
    assert.equal(truncated.kind, 'request_failed', 'Headers alone must not turn an aborted body into a completed response.');
    assert.equal(truncated.httpStatus, 200);
    const invalid = await run('/invalid-json');
    assert.equal(invalid.kind, 'invalid_response', 'A fully read invalid JSON body is not a transport failure.');
    assert.equal(invalid.httpStatus, 200);
    assert.equal(invalid.bodyText, 'complete but not JSON');
    for (const pathname of ['/headers-deadline', '/body-deadline']) {
      const deadline = await run(pathname, 180);
      assert.equal(deadline.kind, 'deadline', 'One budget must cover both headers and a body that never completes.');
    }
    await choose('/client-abort');
    const beforeAbort = listeners(page);
    const aborted = await observeSubmission(page, { pathname: '/client-abort', timeoutMs: 2000, submit: async () => {
      await page.locator('#send').click();
      await page.waitForFunction(() => !!window.requestController);
      await page.evaluate(() => window.requestController.abort());
    } });
    assert.equal(aborted.kind, 'request_failed');
    assert.deepEqual(listeners(page), beforeAbort);

    const beforeSelector = listeners(page);
    await assert.rejects(observeSubmission(page, { pathname: '/never-submitted', timeoutMs: 2000,
      submit: () => page.locator('#missing-button').click({ timeout: 30 }) }), /Timeout/u,
    'An unrelated selector failure is not a successful or transport-completed submission.');
    assert.deepEqual(listeners(page), beforeSelector);
    assert.equal(counts.get('/never-submitted'), undefined);

    await page.locator('#send').evaluate(button => { button.disabled = true; });
    const beforeClose = listeners(page);
    let closeTimer;
    const closure = await observeSubmission(page, { pathname: '/closed-page', timeoutMs: 2000, submit: async () => {
      closeTimer = setTimeout(() => { void page.close().catch(error => unhandled.push(error)); }, 30);
      await page.locator('#send').click();
    } });
    clearTimeout(closeTimer);
    assert.equal(closure.kind, 'page_closed');
    events.forEach((event, index) => assert.ok(page.listenerCount(event) <= beforeClose[index],
      'Closing the page may consume existing one-shot listeners, but must not leave observer listeners.'));
    assert.equal(counts.get('/closed-page'), undefined);
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.deepEqual(unhandled, [], 'Late body/click completion cannot leave unhandled rejections.');
    return { completedResponses: 2, truncatedBodies: 1, invalidJsonBodies: 1,
      deadlines: 2, clientAborts: 1, closedClicks: 1, unrelatedSelectorFailures: 1, providerCalls: 0 };
  } finally {
    for (const timer of timers) clearTimeout(timer);
    if (browser) await browser.close();
    for (const socket of sockets) socket.destroy();
    await new Promise(resolve => server.close(resolve));
    process.off('unhandledRejection', onUnhandled);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log('Submission evidence tests passed:', await runSubmissionEvidenceTests());
}
