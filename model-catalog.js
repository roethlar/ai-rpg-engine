import {
  validateUrlForSsrfAsync
} from './api-client.js';
import { getClaudeCodeStatus } from './claude-code-provider.js';

const CATALOG_TIMEOUT_MS = 10_000;
const MAX_MODEL_ID_LENGTH = 400;
const SUPPORTED_PROVIDERS = new Set([
  'gemini', 'openai', 'claude', 'grok', 'ollama', 'custom', 'claude-code'
]);

export class ModelCatalogError extends Error {
  constructor(message, { status = 502, code = 'CATALOG_FAILED' } = {}) {
    super(message);
    this.name = 'ModelCatalogError';
    this.status = status;
    this.code = code;
  }
}

class MalformedCatalogResponse extends Error {}

function responseArray(data, field) {
  if (!data || typeof data !== 'object' || !Array.isArray(data[field])) {
    throw new MalformedCatalogResponse();
  }
  return data[field];
}

function modelId(value) {
  if (typeof value !== 'string') throw new MalformedCatalogResponse();
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_MODEL_ID_LENGTH) throw new MalformedCatalogResponse();
  return trimmed;
}

function normalizedModels(values) {
  return [...new Set(values.map(modelId))].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
}

export function parseGeminiModels(data) {
  const values = [];
  for (const entry of responseArray(data, 'models')) {
    if (!entry || typeof entry !== 'object' || !Array.isArray(entry.supportedGenerationMethods)) {
      throw new MalformedCatalogResponse();
    }
    const name = modelId(entry.name);
    if (entry.supportedGenerationMethods.includes('generateContent')) {
      values.push(name.startsWith('models/') ? name.slice('models/'.length) : name);
    }
  }
  return normalizedModels(values);
}

export function parseOpenAiModels(data) {
  return normalizedModels(responseArray(data, 'data').map(entry => {
    if (!entry || typeof entry !== 'object') throw new MalformedCatalogResponse();
    return entry.id;
  }));
}

export function parseClaudeModels(data) {
  return parseOpenAiModels(data);
}

export function parseGrokModels(data) {
  const values = [];
  for (const entry of responseArray(data, 'models')) {
    if (!entry || typeof entry !== 'object' || !Array.isArray(entry.aliases)
      || !Array.isArray(entry.output_modalities)) {
      throw new MalformedCatalogResponse();
    }
    const id = modelId(entry.id);
    const aliases = entry.aliases.map(modelId);
    if (entry.output_modalities.includes('text')) values.push(id, ...aliases);
  }
  return normalizedModels(values);
}

export function parseOllamaModels(data) {
  return normalizedModels(responseArray(data, 'models').map(entry => {
    if (!entry || typeof entry !== 'object') throw new MalformedCatalogResponse();
    return entry.name;
  }));
}

export function deriveCustomModelsUrl(baseUrl) {
  let url;
  try {
    url = new URL(baseUrl);
  } catch (error) {
    throw new ModelCatalogError('Could not list custom models (catalog URL unavailable).', {
      status: 400,
      code: 'CATALOG_URL_UNAVAILABLE'
    });
  }
  const pathname = url.pathname.replace(/\/+$/, '');
  const suffix = '/chat/completions';
  if (!pathname.endsWith(suffix)) {
    throw new ModelCatalogError('Could not list custom models (catalog URL unavailable).', {
      status: 400,
      code: 'CATALOG_URL_UNAVAILABLE'
    });
  }
  url.pathname = `${pathname.slice(0, -suffix.length)}/models`;
  url.search = '';
  url.hash = '';
  return url.toString();
}

function safeStatusField(value, pattern = /^[A-Za-z0-9._ -]*$/) {
  if (typeof value !== 'string') return '';
  const clean = value.trim().slice(0, 80);
  return pattern.test(clean) ? clean : '';
}

function safeClaudeCodeStatus(raw) {
  const authMethod = safeStatusField(raw?.authMethod);
  return {
    installed: raw?.installed === true,
    loggedIn: raw?.loggedIn === true && authMethod === 'claude.ai',
    authMethod,
    subscriptionType: safeStatusField(raw?.subscriptionType),
    version: safeStatusField(raw?.version, /^[0-9.]*$/)
  };
}

async function fetchCatalogJson(provider, url, options, fetchImpl, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let response;
    try {
      response = await fetchImpl(url, { ...options, signal: controller.signal });
    } catch (error) {
      const timedOut = error?.name === 'AbortError' || controller.signal.aborted;
      throw new ModelCatalogError(
        `Could not list ${provider} models (${timedOut ? 'timeout' : 'network error'}).`,
        { status: timedOut ? 504 : 502, code: timedOut ? 'CATALOG_TIMEOUT' : 'CATALOG_NETWORK' }
      );
    }

    if (!response?.ok) {
      const upstreamStatus = Number.isInteger(response?.status) ? response.status : 502;
      throw new ModelCatalogError(`Could not list ${provider} models (${upstreamStatus}).`, {
        status: 502,
        code: 'CATALOG_UPSTREAM'
      });
    }

    let rejectOnAbort;
    const aborted = new Promise((_, reject) => {
      rejectOnAbort = () => {
        const error = new Error('Catalog response timed out.');
        error.name = 'AbortError';
        reject(error);
      };
      if (controller.signal.aborted) rejectOnAbort();
      else controller.signal.addEventListener('abort', rejectOnAbort, { once: true });
    });
    try {
      return await Promise.race([response.json(), aborted]);
    } catch (error) {
      const timedOut = error?.name === 'AbortError' || controller.signal.aborted;
      throw new ModelCatalogError(
        `Could not list ${provider} models (${timedOut ? 'timeout' : 'invalid response'}).`,
        {
          status: timedOut ? 504 : 502,
          code: timedOut ? 'CATALOG_TIMEOUT' : 'CATALOG_INVALID_RESPONSE'
        }
      );
    } finally {
      controller.signal.removeEventListener('abort', rejectOnAbort);
    }
  } finally {
    clearTimeout(timeout);
  }
}

function requireCredential(provider, apiKey) {
  if (!apiKey) {
    throw new ModelCatalogError(`Could not list ${provider} models (credentials required).`, {
      status: 400,
      code: 'CATALOG_CREDENTIAL_REQUIRED'
    });
  }
}

function parseCatalog(provider, data) {
  try {
    switch (provider) {
      case 'gemini': return parseGeminiModels(data);
      case 'openai': return parseOpenAiModels(data);
      case 'claude': return parseClaudeModels(data);
      case 'grok': return parseGrokModels(data);
      case 'ollama': return parseOllamaModels(data);
      case 'custom': return parseOpenAiModels(data);
      default: throw new MalformedCatalogResponse();
    }
  } catch (error) {
    if (error instanceof ModelCatalogError) throw error;
    throw new ModelCatalogError(`Could not list ${provider} models (invalid response).`, {
      status: 502,
      code: 'CATALOG_INVALID_RESPONSE'
    });
  }
}

export async function listModels(provider, {
  apiKey = '',
  baseUrl = '',
  ollamaUrl = '',
  fetchImpl = globalThis.fetch,
  claudeCodeStatusImpl = getClaudeCodeStatus,
  timeoutMs = CATALOG_TIMEOUT_MS,
  env = process.env
} = {}) {
  if (!SUPPORTED_PROVIDERS.has(provider)) {
    throw new ModelCatalogError('Unsupported model provider.', {
      status: 400,
      code: 'CATALOG_PROVIDER_INVALID'
    });
  }

  if (provider === 'claude-code') {
    let rawStatus;
    try {
      rawStatus = await claudeCodeStatusImpl({ env, timeoutMs });
    } catch (error) {
      rawStatus = {};
    }
    return { models: [], manualEntry: true, status: safeClaudeCodeStatus(rawStatus) };
  }

  let url;
  let headers = { Accept: 'application/json' };
  if (provider === 'gemini') {
    requireCredential(provider, apiKey);
    url = new URL('https://generativelanguage.googleapis.com/v1beta/models');
    url.searchParams.set('pageSize', '1000');
    url.searchParams.set('key', apiKey);
    url = url.toString();
  } else if (provider === 'openai') {
    requireCredential(provider, apiKey);
    url = 'https://api.openai.com/v1/models';
    headers.Authorization = `Bearer ${apiKey}`;
  } else if (provider === 'claude') {
    requireCredential(provider, apiKey);
    url = 'https://api.anthropic.com/v1/models?limit=1000';
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
  } else if (provider === 'grok') {
    requireCredential(provider, apiKey);
    url = 'https://api.x.ai/v1/language-models';
    headers.Authorization = `Bearer ${apiKey}`;
  } else if (provider === 'ollama') {
    url = `${ollamaUrl.replace(/\/+$/, '')}/api/tags`;
    try {
      await validateUrlForSsrfAsync(url, env.OLLAMA_URL || 'http://localhost:11434');
    } catch (error) {
      throw new ModelCatalogError('Could not list ollama models (blocked endpoint).', {
        status: 400,
        code: 'CATALOG_ENDPOINT_BLOCKED'
      });
    }
  } else {
    url = deriveCustomModelsUrl(baseUrl);
    try {
      await validateUrlForSsrfAsync(url, env.CUSTOM_ENDPOINT_URL);
    } catch (error) {
      throw new ModelCatalogError('Could not list custom models (blocked endpoint).', {
        status: 400,
        code: 'CATALOG_ENDPOINT_BLOCKED'
      });
    }
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  }

  const data = await fetchCatalogJson(provider, url, { method: 'GET', headers }, fetchImpl, timeoutMs);
  return { models: parseCatalog(provider, data), manualEntry: true };
}
