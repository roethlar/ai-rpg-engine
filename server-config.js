/**
 * Server-owned AI configuration (Phase I1, decisions 2026-06-11 + 2026-07-03).
 *
 * AI provider config — provider, model, API keys, endpoints, voice key/model,
 * fallback tier — is the operator's, managed via /admin and persisted in the
 * server_settings table. Player clients never supply it and cannot override it.
 * Resolution order for every field: admin-set value > environment > default.
 */
import * as db from './db.js';

export const AI_PROVIDERS = ['gemini', 'openai', 'claude', 'grok', 'ollama', 'custom'];
export const AI_ROLES = ['setup', 'interaction', 'continuity', 'referee', 'narration'];
const SETTING_KEY = 'ai_config';
const MAX_FIELD_LENGTH = 400;

function cleanField(value) {
  return typeof value === 'string' ? value.trim().slice(0, MAX_FIELD_LENGTH) : '';
}

function sanitizeRoleConfig(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  return {
    provider: AI_PROVIDERS.includes(data.provider) ? data.provider : '',
    model: cleanField(data.model),
    apiKey: cleanField(data.apiKey)
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
    voiceApiKey: cleanField(data.voiceApiKey),
    voiceModel: cleanField(data.voiceModel),
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
  const merged = {
    provider: admin.provider || env.AI_PROVIDER || 'gemini',
    model: admin.model || env.AI_MODEL || undefined,
    apiKey: admin.apiKey || undefined,
    baseUrl: admin.baseUrl || undefined,
    ollamaUrl: admin.ollamaUrl || undefined,
    voiceApiKey: admin.voiceApiKey || env.OPENAI_API_KEY || '',
    voiceModel: admin.voiceModel || env.TTS_MODEL || ''
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
    apiKeySet: !!admin.apiKey,
    voiceApiKeySet: !!admin.voiceApiKey,
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
  const incomingFallback = incoming.fallback && typeof incoming.fallback === 'object' ? incoming.fallback : {};
  const incomingRoles = incoming.roles && typeof incoming.roles === 'object' ? incoming.roles : {};

  const merged = sanitizeAdminAiConfig({
    ...incoming,
    apiKey: resolveSecretField(incoming.apiKey, existing.apiKey),
    voiceApiKey: resolveSecretField(incoming.voiceApiKey, existing.voiceApiKey),
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
