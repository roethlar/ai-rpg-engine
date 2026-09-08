import assert from 'node:assert/strict';

export const PILOT_DRAFT = Object.freeze({ genre: 'Fantasy battlefield rescue', name: 'Mira Local Pilot',
  concept: 'A field arcanist defending a rescue route from an attacking enemy.' });

export function validatePilotDraft(draft) {
  for (const key of ['genre', 'name', 'concept']) {
    assert.ok(typeof draft[key] === 'string' && draft[key].trim(), `Pilot ${key} is required.`);
    assert.ok(draft[key].trim().length <= 80, `Pilot ${key} exceeds the supported 80-character draft limit.`);
  }
}

export async function verifyRenderedNarrative(page, narrative) {
  const rendered = await page.evaluate(source => {
    const expected = document.createElement('div');
    expected.innerHTML = DOMPurify.sanitize(marked.parse(source));
    const actual = [...document.querySelectorAll('.log-gm .content')].at(-1);
    return { expected: expected.innerHTML.trim(), actual: actual?.innerHTML.trim() };
  }, narrative);
  assert.equal(rendered.actual, rendered.expected, 'The visible narrative must match the application\'s sanitized Markdown rendering.');
}

export function observeBrowserRequest(page, { pathname, method = 'POST', timeoutMs }) {
  let finish;
  let request;
  let timer;
  const result = new Promise(resolve => {
    finish = value => {
      clearTimeout(timer);
      page.off('request', onRequest);
      page.off('response', onResponse);
      page.off('requestfailed', onFailure);
      page.off('close', onClose);
      resolve(value);
    };
  });
  const matches = value => value.method() === method && new URL(value.url()).pathname === pathname;
  const onRequest = value => { if (!request && matches(value)) request = value; };
  const onResponse = value => { if (value.request() === request) finish({ kind: 'response', response: value }); };
  const onFailure = value => {
    if (value === request) finish({ kind: 'request_failed', error: value.failure()?.errorText || 'Browser request failed.' });
  };
  const onClose = () => finish({ kind: 'page_closed', error: 'The browser page closed before a response.' });
  page.on('request', onRequest);
  page.on('response', onResponse);
  page.on('requestfailed', onFailure);
  page.on('close', onClose);
  timer = setTimeout(() => finish({ kind: 'deadline', error: 'The original pilot deadline expired.' }), timeoutMs);
  return { result, cancel: () => finish({ kind: 'cancelled', error: 'The browser submission was cancelled.' }) };
}

// A disconnected socket can close before the application handler finishes its
// work. Track its final res.end call, not the socket's close event.
export function trackApplicationRequests(server) {
  const pending = new Set();
  const onRequest = (request, response) => {
    if (request.method !== 'POST' || !/^\/api\/campaigns(?:\/\d+\/turn)?$/u.test(new URL(request.url, 'http://localhost').pathname)) return;
    let resolve;
    const settled = new Promise(done => { resolve = done; });
    const entry = { settled };
    const end = response.end;
    pending.add(entry);
    response.end = function (...args) {
      try { return Reflect.apply(end, this, args); }
      finally { pending.delete(entry); response.end = end; resolve(); }
    };
  };
  server.prependListener('request', onRequest);
  return {
    get pending() { return pending.size; },
    async waitForIdle(timeoutMs) {
      let timer;
      const expired = new Promise(resolve => { timer = setTimeout(() => resolve(false), Math.max(1, timeoutMs)); });
      try {
        while (pending.size) {
          if (!await Promise.race([Promise.all([...pending].map(value => value.settled)).then(() => true), expired])) return false;
        }
        return true;
      } finally { clearTimeout(timer); }
    },
    detach() { server.off('request', onRequest); }
  };
}
