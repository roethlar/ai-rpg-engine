// Diagnostic fetch boundary, not process-wide network isolation. NODE_OPTIONS=--import=<URL>
// propagates this preload to ordinary child Node processes that inherit their environment.
export const OFFLINE_FETCH_MARKER = Symbol.for('aetheria.offline-verification-fetch');

export function createOfflineFetch(fetchImpl) {
  if (typeof fetchImpl !== 'function') throw new TypeError('Offline verification requires a fetch implementation.');
  const guarded = async function (input, init) {
    let url;
    try { url = new URL(input instanceof Request ? input.url : input); }
    catch {
      const error = new Error('Offline verification blocked an invalid fetch URL.');
      error.code = 'OFFLINE_FETCH_BLOCKED';
      throw error;
    }
    const loopback = url.hostname === 'localhost' || url.hostname === '[::1]'
      || /^127(?:\.\d{1,3}){3}$/u.test(url.hostname);
    if (!['http:', 'https:'].includes(url.protocol) || !loopback || url.port === '11434') {
      const error = new Error(`Offline verification blocked fetch to ${url.origin}.`);
      error.code = 'OFFLINE_FETCH_BLOCKED';
      throw error;
    }
    // A permitted local endpoint must not redirect native fetch outside this boundary.
    // Explicit manual responses remain inspectable; automatic redirects fail closed.
    const redirect = init?.redirect ?? (input instanceof Request ? input.redirect : 'follow');
    return Reflect.apply(fetchImpl, this, [input, { ...init, redirect: redirect === 'manual' ? 'manual' : 'error' }]);
  };
  Object.defineProperty(guarded, OFFLINE_FETCH_MARKER, { value: true });
  return guarded;
}

// Writable by design: existing test fixtures may replace fetch with inert mocks and restore it.
globalThis.fetch = createOfflineFetch(globalThis.fetch);
