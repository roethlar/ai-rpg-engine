/**
 * Server-owned AI configuration (Phase I1, decisions 2026-06-11 + 2026-07-03).
 *
 * AI provider config — provider, model, API keys, endpoints, voice key/model,
 * fallback tier — is the operator's, managed via /admin and persisted in the
 * server_settings table. Player clients never supply it and cannot override it.
 * Resolution order for every field: admin-set value > environment > default.
 */
import * as db from './db.js';
import { listImageProviders } from './image-providers.js';
import { listTtsProviders } from './tts-providers.js';

export const AI_PROVIDERS = ['gemini', 'openai', 'claude', 'grok', 'ollama', 'custom'];
export const AI_ROLES = ['setup', 'interaction', 'continuity', 'referee', 'narration'];
const IMAGE_PROVIDERS = listImageProviders();
const VOICE_PROVIDERS = listTtsProviders();
const SETTING_KEY = 'ai_config';
const MAX_FIELD_LENGTH = 400;

function cleanField(value) {
  return typeof value === 'string' ? value.trim().slice(0, MAX_FIELD_LENGTH) : '';
}

function isLoopbackUrl(value) {
  try {
    const url = new URL(value);
    return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname.toLowerCase());
  } catch (e) {
    return false;
  }
}

function sanitizeRoleConfig(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  return {
    provider: AI_PROVIDERS.includes(data.provider) ? data.provider : '',
    model: cleanField(data.model),
    apiKey: cleanField(data.apiKey)
  };
}

function sanitizeVoiceApiKeys(data) {
  const nested = data.voiceApiKeys && typeof data.voiceApiKeys === 'object' && !Array.isArray(data.voiceApiKeys)
    ? data.voiceApiKeys
    : {};
  const hasNestedOpenAi = Object.prototype.hasOwnProperty.call(nested, 'openai');
  return {
    // Legacy ai_config rows stored one scalar OpenAI key. Read it until the
    // next save rewrites the canonical nested shape.
    openai: cleanField(hasNestedOpenAi ? nested.openai : data.voiceApiKey),
    grok: cleanField(nested.grok)
  };
}

/**
 * Validates and bounds an admin-supplied AI config object. Unknown providers
 * become '' (fall through to env), all strings are trimmed and length-capped.
 */
export function sanitizeAdminAiConfig(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const fallbackRaw = data.fallback && typeof data.fallback === 'object' ? data.fallback : {};
  return {
    provider: AI_PROVIDERS.includes(data.provider) ? data.provider : '',
    model: cleanField(data.model),
    apiKey: cleanField(data.apiKey),
    baseUrl: cleanField(data.baseUrl),
    ollamaUrl: cleanField(data.ollamaUrl),
    voiceApiKeys: sanitizeVoiceApiKeys(data),
    voiceModel: cleanField(data.voiceModel),
    voiceProvider: VOICE_PROVIDERS.includes(cleanField(data.voiceProvider)) ? cleanField(data.voiceProvider) : '',
    imageProvider: IMAGE_PROVIDERS.includes(data.imageProvider) ? data.imageProvider : '',
    imageModel: cleanField(data.imageModel),
    imageApiKey: cleanField(data.imageApiKey),
    imageEndpoint: cleanField(data.imageEndpoint),
    fallback: {
      provider: AI_PROVIDERS.includes(fallbackRaw.provider) ? fallbackRaw.provider : '',
      model: cleanField(fallbackRaw.model),
      apiKey: cleanField(fallbackRaw.apiKey)
    },
    roles: Object.fromEntries(
      AI_ROLES.map(role => [role, sanitizeRoleConfig(data.roles && data.roles[role])])
    )
  };
}

/**
 * Pure merge of admin config over environment config. Empty admin fields fall
 * through to env; empty env falls through to AIClient's own defaults (provider
 * env keys, CUSTOM_ENDPOINT_URL, etc.), so `undefined` here means "let the
 * client resolve it".
 */
export function mergeAiConfig(adminConfig, env = process.env) {
  const admin = sanitizeAdminAiConfig(adminConfig);
  const envVoiceProvider = VOICE_PROVIDERS.includes(cleanField(env.TTS_PROVIDER))
    ? cleanField(env.TTS_PROVIDER)
    : '';
  const voiceProvider = admin.voiceProvider || envVoiceProvider || 'openai';
  const voiceEnvKey = voiceProvider === 'grok'
    ? (env.XAI_API_KEY || env.GROK_API_KEY || '')
    : (env.OPENAI_API_KEY || '');
  const merged = {
    provider: admin.provider || env.AI_PROVIDER || 'gemini',
    model: admin.model || env.AI_MODEL || undefined,
    apiKey: admin.apiKey || undefined,
    baseUrl: admin.baseUrl || undefined,
    ollamaUrl: admin.ollamaUrl || undefined,
    voiceApiKey: admin.voiceApiKeys[voiceProvider] || voiceEnvKey,
    voiceModel: voiceProvider === 'openai' ? (admin.voiceModel || env.TTS_MODEL || '') : '',
    voiceProvider,
    // Image generation (Phase V1): no provider configured = feature inert.
    // Endpoint SSRF posture (mirrors the custom-LLM endpoint rule, and /admin
    // may run ungated in dev): an admin-set endpoint is honored only when it
    // is loopback — the local-GPU case; any other host must be pinned by the
    // operator via IMAGE_ENDPOINT_URL env. Production is env-only.
    imageProvider: admin.imageProvider || env.IMAGE_PROVIDER || '',
    imageModel: admin.imageModel || env.IMAGE_MODEL || '',
    imageApiKey: admin.imageApiKey || env.IMAGE_API_KEY || env.OPENAI_API_KEY || '',
    imageEndpoint: (env.NODE_ENV === 'production' || !isLoopbackUrl(admin.imageEndpoint) ? '' : admin.imageEndpoint)
      || env.IMAGE_ENDPOINT_URL || ''
  };

  const fallbackProvider = admin.fallback.provider || env.FALLBACK_AI_PROVIDER || '';
  if (fallbackProvider) {
    merged.fallback = {
      provider: fallbackProvider,
      model: admin.fallback.model || env.FALLBACK_AI_MODEL || undefined,
      apiKey: admin.fallback.apiKey || env.FALLBACK_API_KEY || undefined
    };
  }

  // Per-role admin config rides along; resolveAgentConfig (api-client.js)
  // applies the full precedence chain (admin role > role env > primary) at
  // call time. Empty fields are dropped so they fall through cleanly.
  merged.roles = {};
  for (const role of AI_ROLES) {
    const roleConfig = admin.roles[role];
    const entry = {};
    if (roleConfig.provider) entry.provider = roleConfig.provider;
    if (roleConfig.model) entry.model = roleConfig.model;
    if (roleConfig.apiKey) entry.apiKey = roleConfig.apiKey;
    if (Object.keys(entry).length > 0) merged.roles[role] = entry;
  }

  return merged;
}

/**
 * Display-safe view of the stored admin config: secrets are reported only as
 * set/unset booleans and never echoed back to any client.
 */
export function maskAiConfig(adminConfig) {
  const admin = sanitizeAdminAiConfig(adminConfig);
  return {
    provider: admin.provider,
    model: admin.model,
    baseUrl: admin.baseUrl,
    ollamaUrl: admin.ollamaUrl,
    voiceModel: admin.voiceModel,
    voiceProvider: admin.voiceProvider,
    imageProvider: admin.imageProvider,
    imageModel: admin.imageModel,
    imageEndpoint: admin.imageEndpoint,
    apiKeySet: !!admin.apiKey,
    voiceApiKeySet: {
      openai: !!admin.voiceApiKeys.openai,
      grok: !!admin.voiceApiKeys.grok
    },
    imageApiKeySet: !!admin.imageApiKey,
    fallback: {
      provider: admin.fallback.provider,
      model: admin.fallback.model,
      apiKeySet: !!admin.fallback.apiKey
    },
    roles: Object.fromEntries(
      AI_ROLES.map(role => [role, {
        provider: admin.roles[role].provider,
        model: admin.roles[role].model,
        apiKeySet: !!admin.roles[role].apiKey
      }])
    )
  };
}

/**
 * Secret-field update semantics for saves against a masked form: a blank or
 * missing value keeps the stored secret (the form can't render it), explicit
 * null clears it, and a non-empty string replaces it.
 */
export function resolveSecretField(incoming, existing) {
  if (incoming === null) return '';
  if (typeof incoming === 'string' && incoming.trim() !== '') return incoming.trim();
  return existing;
}

export async function loadAdminAiConfig() {
  const row = await db.get(`SELECT value FROM server_settings WHERE key = ?`, [SETTING_KEY]);
  if (!row) return null;
  try {
    return JSON.parse(row.value);
  } catch (e) {
    return null;
  }
}

export async function saveAdminAiConfig(raw) {
  const existing = sanitizeAdminAiConfig(await loadAdminAiConfig());
  const incoming = raw && typeof raw === 'object' ? raw : {};
  const incomingVoiceKeys = incoming.voiceApiKeys && typeof incoming.voiceApiKeys === 'object' && !Array.isArray(incoming.voiceApiKeys)
    ? incoming.voiceApiKeys
    : {};
  const hasNestedOpenAi = Object.prototype.hasOwnProperty.call(incomingVoiceKeys, 'openai');
  const hasLegacyOpenAi = Object.prototype.hasOwnProperty.call(incoming, 'voiceApiKey');
  const incomingFallback = incoming.fallback && typeof incoming.fallback === 'object' ? incoming.fallback : {};
  const incomingRoles = incoming.roles && typeof incoming.roles === 'object' ? incoming.roles : {};

  const merged = sanitizeAdminAiConfig({
    ...incoming,
    apiKey: resolveSecretField(incoming.apiKey, existing.apiKey),
    voiceApiKeys: {
      openai: resolveSecretField(
        hasNestedOpenAi ? incomingVoiceKeys.openai : (hasLegacyOpenAi ? incoming.voiceApiKey : undefined),
        existing.voiceApiKeys.openai
      ),
      grok: resolveSecretField(incomingVoiceKeys.grok, existing.voiceApiKeys.grok)
    },
    imageApiKey: resolveSecretField(incoming.imageApiKey, existing.imageApiKey),
    fallback: {
      ...incomingFallback,
      apiKey: resolveSecretField(incomingFallback.apiKey, existing.fallback.apiKey)
    },
    roles: Object.fromEntries(
      AI_ROLES.map(role => {
        const roleIncoming = incomingRoles[role] && typeof incomingRoles[role] === 'object' ? incomingRoles[role] : {};
        return [role, {
          ...roleIncoming,
          apiKey: resolveSecretField(roleIncoming.apiKey, existing.roles[role].apiKey)
        }];
      })
    )
  });

  await db.run(
    `INSERT INTO server_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
    [SETTING_KEY, JSON.stringify(merged)]
  );
  return merged;
}

/**
 * The effective AI config for engine calls. This is the ONLY config source the
 * game routes use — client-supplied apiConfig is ignored by design.
 */
export async function getServerAiConfig() {
  return mergeAiConfig(await loadAdminAiConfig());
}
