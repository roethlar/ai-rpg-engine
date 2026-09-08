import assert from 'node:assert/strict';
import { observeBrowserRequest } from './runner-support.mjs';

const messageOf = error => error instanceof Error ? error.message : String(error);
const closed = () => ({ kind: 'page_closed', error: 'The browser page closed before the complete response.' });

/** Observe one submission through its complete response body. The caller owns
 * stopping application/provider work after a returned transport failure.
 */
export async function observeSubmission(page, { pathname, timeoutMs, submit }) {
  assert.ok(typeof pathname === 'string' && pathname.startsWith('/'));
  assert.ok(Number.isFinite(timeoutMs) && timeoutMs > 0, 'A positive whole-submission deadline is required.');
  assert.equal(typeof submit, 'function');
  if (page.isClosed()) return closed();
  const observed = observeBrowserRequest(page, { pathname, timeoutMs });
  let timer;
  let onClose;
  const stopped = new Promise(resolve => {
    onClose = () => resolve(closed());
    page.once('close', onClose);
    timer = setTimeout(() => resolve({ kind: 'deadline', error: 'The submission deadline expired before the complete response.' }), timeoutMs);
  });
  const complete = async () => {
    try { await submit(); }
    catch (error) {
      if (page.isClosed()) return closed();
      if (error?.name === 'AbortError') return { kind: 'request_failed', error: messageOf(error) };
      throw error;
    }
    const outcome = await observed.result;
    if (outcome.kind !== 'response') return outcome;
    const { response } = outcome;
    let text;
    try { text = await response.text(); }
    catch (error) {
      if (page.isClosed()) return closed();
      return { kind: 'request_failed', httpStatus: response.status(),
        error: response.request().failure()?.errorText || messageOf(error) };
    }
    try { return { kind: 'response', response, body: JSON.parse(text) }; }
    catch (error) {
      return { kind: 'invalid_response', httpStatus: response.status(), bodyText: text,
        error: `The completed response body was not valid JSON: ${messageOf(error)}` };
    }
  };
  try {
    // Promise.race retains rejection handlers if a late click/body read settles
    // after the deadline; the observer and both timers still clean up below.
    return await Promise.race([complete(), stopped]);
  } finally {
    clearTimeout(timer);
    page.off('close', onClose);
    observed.cancel();
  }
}
