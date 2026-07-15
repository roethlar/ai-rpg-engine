import net from 'net';
import dns from 'dns';
import { promisify } from 'util';
import dotenv from 'dotenv';
import { callClaudeCode } from './claude-code-provider.js';
dotenv.config();

const dnsLookup = promisify(dns.lookup);

/**
 * Checks if a given IP address is private, loopback, or link-local.
 */
function isPrivateIp(ip) {
  if (!ip) return false;
  
  // Clean brackets if it's an IPv6 literal
  const cleanIp = ip.replace(/^\[|\]$/g, '');

  const family = net.isIP(cleanIp);
  if (family === 4) {
    const parts = cleanIp.split('.').map(Number);
    // 127.0.0.0/8 (loopback)
    if (parts[0] === 127) return true;
    // 10.0.0.0/8 (private)
    if (parts[0] === 10) return true;
    // 172.16.0.0/12 (private)
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16 (private)
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 169.254.0.0/16 (link-local)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 0.0.0.0/8 (broadcast/any)
    if (parts[0] === 0) return true;
    return false;
  }
  
  if (family === 6) {
    const lowerIp = cleanIp.toLowerCase();
    // Loopback (::1)
    if (lowerIp === '::1' || lowerIp === '0:0:0:0:0:0:0:1') return true;
    // Unspecified (::)
    if (lowerIp === '::' || lowerIp === '0:0:0:0:0:0:0:0') return true;
    // Link-local (fe80::/10)
    if (lowerIp.startsWith('fe8') || lowerIp.startsWith('fe9') || lowerIp.startsWith('fea') || lowerIp.startsWith('feb')) return true;
    // Unique local address (fc00::/7)
    if (lowerIp.startsWith('fc') || lowerIp.startsWith('fd')) return true;
    
    // IPv4-mapped IPv6 address (::ffff:127.0.0.1)
    if (lowerIp.startsWith('::ffff:')) {
      const ipv4Part = cleanIp.substring(7);
      return isPrivateIp(ipv4Part);
    }
    return false;
  }
  
  return false;
}

/**
 * Validates request URLs to block SSRF (Server-Side Request Forgery) attacks (synchronous literal check).
 */
function validateUrlForSsrfSync(urlString, allowedLocalUrl) {
  if (!urlString) return;
  try {
    const url = new URL(urlString);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('Only HTTP and HTTPS protocols are permitted.');
    }
    
    const hostname = url.hostname.toLowerCase();
    
    // If it matches the server administrator's configured URL in .env, trust it
    if (allowedLocalUrl) {
      try {
        const allowed = new URL(allowedLocalUrl);
        if (url.origin === allowed.origin) {
          return; // Match found. Trust
        }
      } catch (e) {}
    }

    // List of trusted public cloud LLM API domains
    const trustedHosts = [
      'generativelanguage.googleapis.com',
      'api.openai.com',
      'api.anthropic.com',
      'api.x.ai'
    ];

    if (trustedHosts.includes(hostname)) {
      return; 
    }

    if (isPrivateIp(hostname)) {
      throw new Error('Access to local/private network addresses is blocked.');
    }
  } catch (e) {
    throw new Error(`SSRF Blocked: URL "${urlString}" is invalid. Reason: ${e.message}`);
  }
}

/**
 * Validates request URLs to block SSRF attacks asynchronously by resolving hostnames.
 */
async function validateUrlForSsrfAsync(urlString, allowedLocalUrl) {
  validateUrlForSsrfSync(urlString, allowedLocalUrl);
  if (!urlString) return;

  const url = new URL(urlString);
  const hostname = url.hostname.toLowerCase();

  // If it's a trusted public cloud host or explicitly configured, bypass DNS lookup
  const trustedHosts = [
    'generativelanguage.googleapis.com',
    'api.openai.com',
    'api.anthropic.com',
    'api.x.ai'
  ];
  if (trustedHosts.includes(hostname)) return;

  if (allowedLocalUrl) {
    try {
      const allowed = new URL(allowedLocalUrl);
      if (url.origin === allowed.origin) return;
    } catch (e) {}
  }

  let lookupResult;
  try {
    lookupResult = await dnsLookup(hostname);
  } catch (dnsErr) {
    throw new Error(`SSRF Blocked: Unable to verify hostname "${hostname}". Reason: ${dnsErr.message}`);
  }

  if (isPrivateIp(lookupResult.address)) {
    throw new Error('SSRF Blocked: Resolved host points to local/private network address.');
  }
}

/**
 * Fetch wrapper with timeout protection to prevent hung requests from blocking queues.
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 240000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // The SSRF guard validates DNS before fetch. Node's fetch performs its own
    // resolution afterward, so this reduces accidental/private endpoint access
    // but is not a complete DNS-rebinding defense for untrusted domains.
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      const timeoutError = new Error(`AI Request Timed Out (Limit: ${timeoutMs / 1000}s)`);
      timeoutError.transient = true;
      throw timeoutError;
    }
    throw error;
  }
}

/**
 * Builds a provider API error carrying the HTTP status so retry/fallback
 * logic can classify it.
 */
function providerApiError(label, response, errText) {
  const error = new Error(`${label} error: ${response.status} ${response.statusText} - ${errText}`);
  error.status = response.status;
  return error;
}

const TRANSIENT_HTTP_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

/**
 * Transient = worth retrying: provider overload/unavailability, rate limits,
 * timeouts, and network-layer failures (fetch throws TypeError). Config errors
 * (missing key, 401/403, bad request) are not transient and fail fast.
 */
export function isTransientAiError(error) {
  if (!error) return false;
  if (error.transient === true) return true;
  if (TRANSIENT_HTTP_STATUSES.has(error.status)) return true;
  return error.name === 'TypeError';
}

const RETRY_BACKOFF_MS = Number(process.env.AI_RETRY_BACKOFF_MS || 1000);

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeFallbackConfig(config = {}) {
  if (config.fallbackResolved === true) {
    const fallback = config.fallback;
    if (!fallback?.provider) return null;
    return {
      provider: fallback.provider,
      model: fallback.model || (fallback.provider === 'claude-code' ? 'default' : undefined),
      apiKey: fallback.provider === 'claude-code' ? undefined : (fallback.apiKey || undefined),
      baseUrl: fallback.baseUrl || undefined,
      ollamaUrl: fallback.ollamaUrl || undefined
    };
  }

  const provider = config.fallback?.provider || process.env.FALLBACK_AI_PROVIDER;
  if (!provider) return null;
  return {
    provider,
    model: config.fallback?.model || process.env.FALLBACK_AI_MODEL
      || (provider === 'claude-code' ? 'default' : undefined),
    apiKey: provider === 'claude-code'
      ? undefined
      : (config.fallback?.apiKey || process.env.FALLBACK_API_KEY || undefined),
    baseUrl: config.fallback?.baseUrl || undefined,
    ollamaUrl: config.fallback?.ollamaUrl || undefined
  };
}

/**
 * Resolves the effective AI config for a Council role from per-role environment
 * variables (e.g. INTERACTION_AI_PROVIDER / INTERACTION_API_KEY) over the
 * request-supplied base config.
 *
 * The base apiConfig belongs to its own provider: its key, model, and endpoint
 * URLs are inherited only when the role resolves to that same provider. When a
 * role env var switches the provider, unset fields stay unset so AIClient falls
 * back to that provider's own env key (e.g. XAI_API_KEY) instead of sending
 * another provider's credentials to the wrong API.
 */
function providerConnection(council, provider) {
  const connection = council?.connections?.[provider];
  return connection && typeof connection === 'object' ? connection : {};
}

function descriptorStoredKey(descriptor, council, provider) {
  if (!descriptor) return undefined;
  if (provider === 'claude-code') return undefined;
  if (descriptor.keySource === 'custom') return descriptor.customApiKey || undefined;
  return providerConnection(council, provider).apiKey || undefined;
}

function descriptorEndpoints(council, provider, env, prefix = '') {
  const connection = providerConnection(council, provider);
  return {
    baseUrl: provider === 'custom'
      ? ((prefix && env[`${prefix}_CUSTOM_ENDPOINT_URL`]) || connection.baseUrl || undefined)
      : undefined,
    ollamaUrl: provider === 'ollama'
      ? ((prefix && env[`${prefix}_OLLAMA_URL`]) || connection.ollamaUrl || undefined)
      : undefined
  };
}

function resolveCouncilDefault(apiConfig, env) {
  const council = apiConfig.council;
  const descriptor = council?.defaultPrimary;
  if (!descriptor) return null;
  const provider = descriptor.provider || env.AI_PROVIDER || apiConfig.provider || 'gemini';
  const endpoints = descriptorEndpoints(council, provider, env);
  return {
    provider,
    model: descriptor.model || undefined,
    apiKey: descriptorStoredKey(descriptor, council, provider),
    ...endpoints
  };
}

function resolveCouncilFallback(apiConfig, role, env) {
  const council = apiConfig.council;
  const descriptor = council?.roles?.[role]?.fallback || null;

  if (!descriptor) {
    const provider = env.FALLBACK_AI_PROVIDER || '';
    if (!provider) return null;
    return {
      provider,
      model: env.FALLBACK_AI_MODEL || undefined,
      apiKey: provider === 'claude-code' ? undefined : (env.FALLBACK_API_KEY || undefined),
      baseUrl: undefined,
      ollamaUrl: undefined
    };
  }

  if (!descriptor.legacyDefault) {
    const provider = descriptor.provider;
    return {
      provider,
      model: descriptor.model,
      apiKey: descriptorStoredKey(descriptor, council, provider),
      ...descriptorEndpoints(council, provider, env)
    };
  }

  const provider = descriptor.provider || env.FALLBACK_AI_PROVIDER || '';
  if (!provider) return null;
  return {
    provider,
    model: descriptor.model || env.FALLBACK_AI_MODEL || undefined,
    apiKey: provider === 'claude-code'
      ? undefined
      : (descriptor.customApiKey || env.FALLBACK_API_KEY || undefined),
    ...descriptorEndpoints(council, provider, env)
  };
}

export function resolveAgentConfig(apiConfig = {}, role, env = process.env) {
  const prefixes = {
    setup: 'SETUP',
    interaction: 'INTERACTION',
    continuity: 'CONTINUITY',
    referee: 'REFEREE',
    narration: 'NARRATION'
  };
  const prefix = prefixes[role] || String(role).toUpperCase();

  if (apiConfig.council) {
    const council = apiConfig.council;
    const descriptor = council.roles?.[role]?.primary || null;
    const defaultPrimary = resolveCouncilDefault(apiConfig, env);
    let provider;
    let model;
    let apiKey;

    if (descriptor && !descriptor.legacyDefault) {
      provider = descriptor.provider;
      model = descriptor.model;
      apiKey = descriptorStoredKey(descriptor, council, provider);
    } else if (descriptor) {
      provider = descriptor.provider
        || env[`${prefix}_AI_PROVIDER`]
        || defaultPrimary?.provider
        || apiConfig.provider
        || 'gemini';
      const inheritDefault = provider === defaultPrimary?.provider;
      model = descriptor.model
        || env[`${prefix}_AI_MODEL`]
        || (inheritDefault ? defaultPrimary.model : undefined);
      apiKey = descriptor.customApiKey
        || env[`${prefix}_API_KEY`]
        || (inheritDefault ? defaultPrimary.apiKey : undefined);
    } else {
      provider = env[`${prefix}_AI_PROVIDER`]
        || defaultPrimary?.provider
        || apiConfig.provider
        || 'gemini';
      const inheritDefault = provider === defaultPrimary?.provider;
      model = env[`${prefix}_AI_MODEL`]
        || (inheritDefault ? defaultPrimary.model : undefined);
      apiKey = env[`${prefix}_API_KEY`]
        || (inheritDefault ? defaultPrimary.apiKey : undefined);
    }

    return {
      provider,
      model,
      apiKey: provider === 'claude-code' ? undefined : apiKey,
      ...descriptorEndpoints(council, provider, env, prefix),
      fallback: resolveCouncilFallback(apiConfig, role, env),
      fallbackResolved: true
    };
  }

  // Per-role admin config (decision 2026-07-03): /admin values beat role env
  // vars, which beat the primary config.
  const adminRole = (apiConfig.roles && apiConfig.roles[role]) || {};

  const provider = adminRole.provider || env[`${prefix}_AI_PROVIDER`] || apiConfig.provider;
  const inherit = provider === apiConfig.provider;

  return {
    provider,
    model: adminRole.model || env[`${prefix}_AI_MODEL`] || (inherit ? apiConfig.model : undefined),
    apiKey: provider === 'claude-code'
      ? undefined
      : (adminRole.apiKey || env[`${prefix}_API_KEY`] || (inherit ? apiConfig.apiKey : undefined)),
    baseUrl: env[`${prefix}_CUSTOM_ENDPOINT_URL`] || (inherit ? apiConfig.baseUrl : undefined),
    ollamaUrl: env[`${prefix}_OLLAMA_URL`] || (inherit ? apiConfig.ollamaUrl : undefined),
    // The fallback tier is role-independent: any role's failing call may fail
    // over to the backup model (per-call, so role separation is preserved).
    fallback: apiConfig.fallback
  };
}

/**
 * AI client class to unify API calls across Gemini, OpenAI, Claude, xAI Grok, Ollama, and custom endpoints.
 */
export class AIClient {
  constructor(config = {}) {
    // Merge server environment configuration with optional runtime overrides
    this.provider = config.provider || process.env.AI_PROVIDER || 'gemini';
    this.model = config.model || process.env.AI_MODEL;
    if (this.provider === 'claude-code' && config.apiKey) {
      throw new Error('Claude Code uses its logged-in subscription and does not accept API keys.');
    }
    this.apiKey = this.provider === 'claude-code' ? null : (config.apiKey || this.getEnvKey(this.provider));
    this.claudeCodeRunner = config.claudeCodeRunner;
    this.claudeCodeEnv = config.claudeCodeEnv;
    
    const isProduction = process.env.NODE_ENV === 'production';
    const rawBaseUrl = (isProduction ? null : config.baseUrl) || process.env.CUSTOM_ENDPOINT_URL || '';
    const rawOllamaUrl = (isProduction ? null : config.ollamaUrl) || process.env.OLLAMA_URL || 'http://localhost:11434';

    // Run SSRF verification checks on endpoints
    validateUrlForSsrfSync(rawBaseUrl, process.env.CUSTOM_ENDPOINT_URL);
    validateUrlForSsrfSync(rawOllamaUrl, process.env.OLLAMA_URL || 'http://localhost:11434');

    this.baseUrl = rawBaseUrl;
    this.ollamaUrl = rawOllamaUrl;

    // Backup tier for transient-error failover (decision 2026-07-03). The
    // backup client itself never gets a fallback, so failover cannot recurse.
    this.fallback = normalizeFallbackConfig(config);

    // Set default models based on provider
    if (!this.model) {
      switch (this.provider) {
        case 'gemini':
          this.model = 'gemini-1.5-flash';
          break;
        case 'openai':
          this.model = 'gpt-4o-mini';
          break;
        case 'claude':
          this.model = 'claude-3-5-sonnet-20241022';
          break;
        case 'grok':
          this.model = 'grok-3';
          break;
        case 'ollama':
          this.model = 'llama3';
          break;
        case 'claude-code':
          this.model = 'default';
          break;
        default:
          this.model = 'gpt-4o-mini';
      }
    }
  }

  getEnvKey(provider) {
    switch (provider) {
      case 'gemini': return process.env.GEMINI_API_KEY;
      case 'openai': return process.env.OPENAI_API_KEY;
      case 'claude': return process.env.ANTHROPIC_API_KEY;
      case 'grok': return process.env.XAI_API_KEY || process.env.GROK_API_KEY;
      case 'claude-code': return null;
      default: return null;
    }
  }

  /**
   * Sends a prompt with transient-error handling (decision 2026-07-03):
   * retry once against the same config, then fail over the single call to the
   * configured backup tier. Non-transient errors fail fast.
   */
  async sendPrompt(args) {
    try {
      return await this.dispatchPrompt(args);
    } catch (firstError) {
      if (!isTransientAiError(firstError)) throw firstError;
      console.warn(`[AI] Transient ${this.provider} error (${firstError.message}). Retrying once...`);
      await delay(RETRY_BACKOFF_MS);

      try {
        return await this.dispatchPrompt(args);
      } catch (retryError) {
        if (!isTransientAiError(retryError) || !this.fallback) throw retryError;
        console.warn(`[AI] Retry failed (${retryError.message}). Failing over to backup tier: ${this.fallback.provider}.`);
        const backupClient = new AIClient({
          provider: this.fallback.provider,
          model: this.fallback.model,
          apiKey: this.fallback.apiKey,
          baseUrl: this.fallback.baseUrl,
          ollamaUrl: this.fallback.ollamaUrl,
          claudeCodeRunner: this.claudeCodeRunner,
          claudeCodeEnv: this.claudeCodeEnv
        });
        return backupClient.dispatchPrompt(args);
      }
    }
  }

  async dispatchPrompt({ systemInstruction, prompt, jsonMode = false }) {
    if (this.baseUrl) {
      await validateUrlForSsrfAsync(this.baseUrl, process.env.CUSTOM_ENDPOINT_URL);
    }
    if (this.ollamaUrl && this.provider === 'ollama') {
      await validateUrlForSsrfAsync(this.ollamaUrl, process.env.OLLAMA_URL || 'http://localhost:11434');
    }

    if (this.provider === 'gemini') {
      return this.callGemini(systemInstruction, prompt, jsonMode);
    } else if (this.provider === 'openai') {
      return this.callOpenAI(systemInstruction, prompt, jsonMode);
    } else if (this.provider === 'claude') {
      return this.callClaude(systemInstruction, prompt, jsonMode);
    } else if (this.provider === 'grok') {
      return this.callGrok(systemInstruction, prompt, jsonMode);
    } else if (this.provider === 'ollama') {
      return this.callOllama(systemInstruction, prompt, jsonMode);
    } else if (this.provider === 'custom') {
      return this.callCustomOpenAI(systemInstruction, prompt, jsonMode);
    } else if (this.provider === 'claude-code') {
      return this.callClaudeCode(systemInstruction, prompt);
    } else {
      throw new Error(`Unsupported AI provider: ${this.provider}`);
    }
  }

  async callClaudeCode(system, prompt) {
    return callClaudeCode({
      systemInstruction: system,
      prompt,
      model: this.model,
      env: this.claudeCodeEnv || process.env,
      runner: this.claudeCodeRunner
    });
  }

  async callGemini(system, prompt, jsonMode) {
    const key = this.apiKey;
    if (!key) throw new Error('Gemini API key is not configured.');

    // Note: Gemini 1.5 flash uses v1beta endpoint
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
    
    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {}
    };

    if (system) {
      requestBody.systemInstruction = {
        parts: [{ text: system }]
      };
    }

    if (jsonMode) {
      requestBody.generationConfig.responseMimeType = 'application/json';
    }

    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw providerApiError('Gemini API', response, errText);
    }

    const data = await response.json();
    try {
      return data.candidates[0].content.parts[0].text;
    } catch (e) {
      throw new Error(`Failed to parse Gemini response structure: ${JSON.stringify(data)}`);
    }
  }

  async callOpenAI(system, prompt, jsonMode) {
    const key = this.apiKey;
    if (!key) throw new Error('OpenAI API key is not configured.');

    const url = 'https://api.openai.com/v1/chat/completions';
    
    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: prompt });

    const requestBody = {
      model: this.model,
      messages,
    };

    if (jsonMode) {
      requestBody.response_format = { type: 'json_object' };
    }

    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw providerApiError('OpenAI API', response, errText);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  async callGrok(system, prompt, jsonMode) {
    const key = this.apiKey;
    if (!key) throw new Error('xAI Grok API key is not configured (set XAI_API_KEY or provide in UI).');

    // Pinned to the official endpoint: this.baseUrl carries CUSTOM_ENDPOINT_URL (or a
    // saved UI custom URL), which is config for the 'custom' provider — honoring it here
    // would send the xAI bearer key to an unrelated host. Proxy/OpenRouter setups that
    // serve Grok models should use the 'custom' provider instead.
    const url = 'https://api.x.ai/v1/chat/completions';
    
    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: prompt });

    const requestBody = {
      model: this.model,
      messages,
    };

    if (jsonMode) {
      requestBody.response_format = { type: 'json_object' };
    }

    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw providerApiError('xAI Grok API', response, errText);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  async callClaude(system, prompt, jsonMode) {
    const key = this.apiKey;
    if (!key) throw new Error('Claude API key is not configured.');

    // Pinned to the official endpoint: this.baseUrl carries CUSTOM_ENDPOINT_URL (or a
    // saved UI custom URL), which is config for the 'custom' provider — honoring it here
    // would send the Anthropic key to an unrelated host. Proxy/OpenRouter setups that
    // serve Claude models should use the 'custom' provider instead.
    const url = 'https://api.anthropic.com/v1/messages';
    
    const messages = [{ role: 'user', content: prompt }];
    
    const requestBody = {
      model: this.model,
      messages,
      max_tokens: 4000
    };

    if (system) {
      requestBody.system = system;
    }

    // Claude does not support jsonMode response parameter directly in the same way,
    // but we prompt it strongly to return JSON in the system instruction.
    // If it's a proxy that supports OpenAI format, we could route through callCustomOpenAI.
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw providerApiError('Claude API', response, errText);
    }

    const data = await response.json();
    return data.content[0].text;
  }

  async callOllama(system, prompt, jsonMode) {
    const url = `${this.ollamaUrl}/api/chat`;

    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: prompt });

    const requestBody = {
      model: this.model,
      messages,
      stream: false
    };

    if (jsonMode) {
      requestBody.format = 'json';
    }

    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw providerApiError('Ollama', response, errText);
    }

    const data = await response.json();
    return data.message.content;
  }

  async callCustomOpenAI(system, prompt, jsonMode) {
    if (!this.baseUrl) throw new Error('Custom endpoint base URL is not configured.');

    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: prompt });

    const requestBody = {
      model: this.model,
      messages
    };

    if (jsonMode) {
      requestBody.response_format = { type: 'json_object' };
    }

    const headers = { 'Content-Type': 'application/json' };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetchWithTimeout(this.baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw providerApiError('Custom OpenAI endpoint', response, errText);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }
}
