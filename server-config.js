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

export const AI_PROVIDERS = ['gemini', 'openai', 'claude', 'grok', 'ollama', 'custom', 'claude-code'];
export const AI_ROLES = ['setup', 'interaction', 'continuity', 'referee', 'narration'];
const IMAGE_PROVIDERS = listImageProviders();
const VOICE_PROVIDERS = listTtsProviders();
const SETTING_KEY = 'ai_config';
const MAX_FIELD_LENGTH = 400;
const MAX_MODEL_ENTRIES = 64;
const MAX_ENTRY_ID_LENGTH = 80;
const MAX_ENTRY_LABEL_LENGTH = 80;
const API_KEY_PROVIDERS = new Set(['gemini', 'openai', 'claude', 'grok', 'custom']);

export class AdminConfigValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AdminConfigValidationError';
  }
}

function cleanField(value) {
  return typeof value === 'string' ? value.trim().slice(0, MAX_FIELD_LENGTH) : '';
}

function cleanLimitedField(value, limit) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function validationFailure(message) {
  throw new AdminConfigValidationError(message);
}

function emptyProviderConnections() {
  return {
    gemini: { apiKey: '' },
    openai: { apiKey: '' },
    claude: { apiKey: '' },
    grok: { apiKey: '' },
    ollama: { ollamaUrl: '' },
    custom: { apiKey: '', baseUrl: '' },
    'claude-code': {}
  };
}

function emptyRoleAssignments() {
  return Object.fromEntries(AI_ROLES.map(role => [role, { primary: '', fallback: '' }]));
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

function voiceAndImageFields(raw) {
  const legacy = sanitizeAdminAiConfig(raw);
  return {
    voiceApiKeys: { ...legacy.voiceApiKeys },
    voiceModel: legacy.voiceModel,
    voiceProvider: legacy.voiceProvider,
    imageProvider: legacy.imageProvider,
    imageModel: legacy.imageModel,
    imageApiKey: legacy.imageApiKey,
    imageEndpoint: legacy.imageEndpoint
  };
}

function legacyEntryKey(entry) {
  return JSON.stringify([
    entry.provider,
    entry.model,
    entry.keySource,
    entry.apiKey,
    entry.legacyDefault
  ]);
}

function projectLegacyAiConfigV2(raw) {
  const legacy = sanitizeAdminAiConfig(raw);
  const providers = emptyProviderConnections();
  providers.custom.baseUrl = legacy.baseUrl;
  providers.ollama.ollamaUrl = legacy.ollamaUrl;

  if (legacy.provider && API_KEY_PROVIDERS.has(legacy.provider) && legacy.apiKey) {
    providers[legacy.provider].apiKey = legacy.apiKey;
  }

  const modelEntries = [];
  const entryIdsByTuple = new Map();
  const addEntry = entry => {
    const tuple = legacyEntryKey(entry);
    if (entryIdsByTuple.has(tuple)) return entryIdsByTuple.get(tuple);
    modelEntries.push(entry);
    entryIdsByTuple.set(tuple, entry.id);
    return entry.id;
  };

  let defaultModel = '';
  if (legacy.provider || legacy.model || legacy.apiKey) {
    const primaryUsesCustomKey = !legacy.provider && !!legacy.apiKey;
    defaultModel = addEntry({
      id: 'legacy_primary',
      label: 'Legacy primary',
      provider: legacy.provider,
      model: legacy.model,
      keySource: primaryUsesCustomKey ? 'custom' : 'provider',
      apiKey: primaryUsesCustomKey ? legacy.apiKey : '',
      legacyDefault: !legacy.provider || !legacy.model
    });
  }

  const roleAssignments = emptyRoleAssignments();
  for (const role of AI_ROLES) {
    const tuple = legacy.roles[role];
    if (!tuple.provider && !tuple.model && !tuple.apiKey) continue;
    const id = addEntry({
      id: `legacy_role_${role}`,
      label: `Legacy ${role}`,
      provider: tuple.provider,
      model: tuple.model,
      keySource: tuple.apiKey ? 'custom' : 'provider',
      apiKey: tuple.apiKey,
      legacyDefault: true
    });
    roleAssignments[role].primary = id;
  }

  if (legacy.fallback.provider || legacy.fallback.model || legacy.fallback.apiKey) {
    const fallbackId = addEntry({
      id: 'legacy_fallback',
      label: 'Legacy fallback',
      provider: legacy.fallback.provider,
      model: legacy.fallback.model,
      keySource: legacy.fallback.apiKey ? 'custom' : 'provider',
      apiKey: legacy.fallback.apiKey,
      legacyDefault: true
    });
    for (const role of AI_ROLES) roleAssignments[role].fallback = fallbackId;
  }

  return {
    configVersion: 2,
    providers,
    modelEntries,
    defaultModel,
    roleAssignments,
    ...voiceAndImageFields(raw)
  };
}

function normalizeProviderConnections(raw) {
  if (!isPlainObject(raw)) validationFailure('providers must be an object.');
  const unknown = Object.keys(raw).filter(provider => !AI_PROVIDERS.includes(provider));
  if (unknown.length > 0) validationFailure(`Unsupported provider connection: ${unknown[0]}.`);

  const providers = emptyProviderConnections();
  for (const provider of AI_PROVIDERS) {
    const connection = isPlainObject(raw[provider]) ? raw[provider] : {};
    if (provider === 'claude-code' && cleanField(connection.apiKey)) {
      validationFailure('Claude Code provider connections cannot store API keys.');
    }
    if (API_KEY_PROVIDERS.has(provider)) providers[provider].apiKey = cleanField(connection.apiKey);
    if (provider === 'custom') providers.custom.baseUrl = cleanField(connection.baseUrl);
    if (provider === 'ollama') providers.ollama.ollamaUrl = cleanField(connection.ollamaUrl);
  }
  return providers;
}

function normalizeModelEntries(
  raw,
  legacyBaseline = null,
  trustStoredLegacy = false,
  legacySecretClearIds = new Set()
) {
  if (!Array.isArray(raw)) validationFailure('modelEntries must be an array.');
  if (raw.length > MAX_MODEL_ENTRIES) {
    validationFailure(`modelEntries cannot contain more than ${MAX_MODEL_ENTRIES} entries.`);
  }

  const baselineEntries = Array.isArray(legacyBaseline?.modelEntries) ? legacyBaseline.modelEntries : [];
  const baselineById = new Map(baselineEntries.map(entry => [entry.id, entry]));
  const ids = new Set();

  return raw.map((value, index) => {
    if (!isPlainObject(value)) validationFailure(`modelEntries[${index}] must be an object.`);
    const rawId = typeof value.id === 'string' ? value.id.trim() : '';
    if (rawId.length > MAX_ENTRY_ID_LENGTH) validationFailure(`modelEntries[${index}].id is too long.`);
    const id = rawId;
    if (!id || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(id)) {
      validationFailure(`modelEntries[${index}].id is invalid.`);
    }
    if (ids.has(id)) validationFailure(`Duplicate model entry id: ${id}.`);
    ids.add(id);

    const rawLabel = typeof value.label === 'string' ? value.label.trim() : '';
    if (rawLabel.length > MAX_ENTRY_LABEL_LENGTH) validationFailure(`modelEntries[${index}].label is too long.`);
    const label = rawLabel;
    if (!label) validationFailure(`modelEntries[${index}].label is required.`);
    const provider = AI_PROVIDERS.includes(value.provider) ? value.provider : '';
    const rawModel = typeof value.model === 'string' ? value.model.trim() : '';
    if (rawModel.length > MAX_FIELD_LENGTH) validationFailure(`modelEntries[${index}].model is too long.`);
    const model = rawModel;
    const keySource = value.keySource === 'custom' ? 'custom' : value.keySource === 'provider' ? 'provider' : '';
    if (!keySource) validationFailure(`modelEntries[${index}].keySource is invalid.`);
    if (provider === 'claude-code' && keySource !== 'provider') {
      validationFailure(`modelEntries[${index}] must use Claude Code login authentication.`);
    }
    const apiKey = keySource === 'custom' ? cleanField(value.apiKey) : '';
    if (Object.prototype.hasOwnProperty.call(value, 'legacyDefault') && typeof value.legacyDefault !== 'boolean') {
      validationFailure(`modelEntries[${index}].legacyDefault must be boolean.`);
    }

    let legacyDefault = value.legacyDefault === true;
    if (legacyDefault && !trustStoredLegacy) {
      const baseline = baselineById.get(id);
      if (!baseline?.legacyDefault) validationFailure(`modelEntries[${index}] cannot claim legacyDefault.`);
      const runtimeFieldChanged = provider !== baseline.provider
        || model !== baseline.model
        || keySource !== baseline.keySource
        || (apiKey !== baseline.apiKey && !legacySecretClearIds.has(id));
      if (runtimeFieldChanged) legacyDefault = false;
    }

    if (!legacyDefault && (!provider || !model)) {
      validationFailure(`modelEntries[${index}] requires provider and model.`);
    }
    // A cleared legacy override keeps custom mode as a provenance marker so
    // role/fallback environment-key precedence remains identical to v1.
    if (keySource === 'custom' && !apiKey && !legacyDefault) {
      validationFailure(`modelEntries[${index}] requires a custom API key.`);
    }

    return { id, label, provider, model, keySource, apiKey, legacyDefault };
  });
}

function normalizeRoleAssignments(raw, entryIds) {
  if (!isPlainObject(raw)) validationFailure('roleAssignments must be an object.');
  const unknown = Object.keys(raw).filter(role => !AI_ROLES.includes(role));
  if (unknown.length > 0) validationFailure(`Unsupported Council role: ${unknown[0]}.`);

  const assignments = {};
  for (const role of AI_ROLES) {
    if (!Object.prototype.hasOwnProperty.call(raw, role) || !isPlainObject(raw[role])) {
      validationFailure(`roleAssignments.${role} is required.`);
    }
    const primary = typeof raw[role].primary === 'string' ? raw[role].primary.trim() : '';
    const fallback = typeof raw[role].fallback === 'string' ? raw[role].fallback.trim() : '';
    if (primary.length > MAX_ENTRY_ID_LENGTH || fallback.length > MAX_ENTRY_ID_LENGTH) {
      validationFailure(`roleAssignments.${role} contains an overlong entry id.`);
    }
    if (primary && !entryIds.has(primary)) validationFailure(`roleAssignments.${role}.primary is dangling.`);
    if (fallback && !entryIds.has(fallback)) validationFailure(`roleAssignments.${role}.fallback is dangling.`);
    assignments[role] = { primary, fallback };
  }
  return assignments;
}

function normalizeAdminAiConfigV2(raw, {
  legacyBaseline = null,
  trustStoredLegacy = false,
  legacySecretClearIds = new Set()
} = {}) {
  if (!isPlainObject(raw) || raw.configVersion !== 2) {
    validationFailure('configVersion must be 2.');
  }
  const providers = normalizeProviderConnections(raw.providers);
  const modelEntries = normalizeModelEntries(
    raw.modelEntries,
    legacyBaseline,
    trustStoredLegacy,
    legacySecretClearIds
  );
  const entryIds = new Set(modelEntries.map(entry => entry.id));
  const roleAssignments = normalizeRoleAssignments(raw.roleAssignments, entryIds);
  let defaultModel = typeof raw.defaultModel === 'string' ? raw.defaultModel.trim() : '';
  if (defaultModel.length > MAX_ENTRY_ID_LENGTH) validationFailure('defaultModel is too long.');
  if (defaultModel && !entryIds.has(defaultModel)) validationFailure('defaultModel is dangling.');
  if (AI_ROLES.every(role => !!roleAssignments[role].primary)) defaultModel = '';

  return {
    configVersion: 2,
    providers,
    modelEntries,
    defaultModel,
    roleAssignments,
    ...voiceAndImageFields(raw)
  };
}

/**
 * Pure, secret-preserving projection of either stored wire version into the
 * canonical v2 registry. Environment values are deliberately never read.
 */
export function projectAdminAiConfigV2(raw) {
  if (isPlainObject(raw) && raw.configVersion === 2) {
    return normalizeAdminAiConfigV2(raw, { legacyBaseline: raw, trustStoredLegacy: true });
  }
  return projectLegacyAiConfigV2(raw);
}

/** Validate an incoming canonical registry against an optional projected baseline. */
export function validateAdminAiConfigV2(raw, { legacyBaseline = null } = {}) {
  const baseline = legacyBaseline ? projectAdminAiConfigV2(legacyBaseline) : null;
  return normalizeAdminAiConfigV2(raw, { legacyBaseline: baseline });
}

/**
 * Pure first-save helper. The raw stored row is projected before masked-form
 * secret semantics are applied, so deterministic legacy ids keep their keys.
 */
export function prepareAdminAiConfigV2Save(raw, existingRaw = null) {
  if (!isPlainObject(raw) || raw.configVersion !== 2) validationFailure('configVersion must be 2.');
  const baseline = projectAdminAiConfigV2(existingRaw);
  const incomingProviders = isPlainObject(raw.providers) ? raw.providers : {};
  const providers = emptyProviderConnections();

  for (const provider of AI_PROVIDERS) {
    const incoming = isPlainObject(incomingProviders[provider]) ? incomingProviders[provider] : {};
    const existing = baseline.providers[provider];
    if (API_KEY_PROVIDERS.has(provider)) {
      providers[provider].apiKey = resolveSecretField(incoming.apiKey, existing.apiKey);
    }
    if (provider === 'custom') providers.custom.baseUrl = cleanField(incoming.baseUrl);
    if (provider === 'ollama') providers.ollama.ollamaUrl = cleanField(incoming.ollamaUrl);
  }

  if (!Array.isArray(raw.modelEntries)) validationFailure('modelEntries must be an array.');
  const baselineEntries = new Map(baseline.modelEntries.map(entry => [entry.id, entry]));
  const legacySecretClearIds = new Set();
  const modelEntries = raw.modelEntries.map(value => {
    const entry = isPlainObject(value) ? value : {};
    const id = cleanLimitedField(entry.id, MAX_ENTRY_ID_LENGTH);
    const existing = baselineEntries.get(id);
    const keySource = entry.keySource === 'provider' ? 'provider' : entry.keySource;
    // Only the save seam can authorize a secret-only legacy transition. The
    // normal validator still declassifies any client-forged or runtime edit.
    if (entry.apiKey === null && entry.legacyDefault === true && existing?.legacyDefault
      && keySource === existing.keySource) {
      legacySecretClearIds.add(id);
    }
    return {
      ...entry,
      apiKey: keySource === 'provider'
        ? ''
        : resolveSecretField(entry.apiKey, existing?.apiKey || '')
    };
  });

  const incomingVoiceKeys = isPlainObject(raw.voiceApiKeys) ? raw.voiceApiKeys : {};
  const candidate = {
    ...raw,
    providers,
    modelEntries,
    voiceApiKeys: {
      openai: resolveSecretField(incomingVoiceKeys.openai, baseline.voiceApiKeys.openai),
      grok: resolveSecretField(incomingVoiceKeys.grok, baseline.voiceApiKeys.grok)
    },
    imageApiKey: resolveSecretField(raw.imageApiKey, baseline.imageApiKey)
  };

  return normalizeAdminAiConfigV2(candidate, { legacyBaseline: baseline, legacySecretClearIds });
}

/** Display-safe canonical v2 DTO. */
export function maskAdminAiConfigV2(raw) {
  const config = projectAdminAiConfigV2(raw);
  return {
    configVersion: 2,
    providers: {
      gemini: { apiKeySet: !!config.providers.gemini.apiKey },
      openai: { apiKeySet: !!config.providers.openai.apiKey },
      claude: { apiKeySet: !!config.providers.claude.apiKey },
      grok: { apiKeySet: !!config.providers.grok.apiKey },
      ollama: { ollamaUrl: config.providers.ollama.ollamaUrl },
      custom: { apiKeySet: !!config.providers.custom.apiKey, baseUrl: config.providers.custom.baseUrl },
      'claude-code': {}
    },
    modelEntries: config.modelEntries.map(entry => ({
      id: entry.id,
      label: entry.label,
      provider: entry.provider,
      model: entry.model,
      keySource: entry.keySource,
      apiKeySet: !!entry.apiKey,
      legacyDefault: entry.legacyDefault
    })),
    defaultModel: config.defaultModel,
    roleAssignments: config.roleAssignments,
    voiceModel: config.voiceModel,
    voiceProvider: config.voiceProvider,
    voiceApiKeySet: {
      openai: !!config.voiceApiKeys.openai,
      grok: !!config.voiceApiKeys.grok
    },
    imageProvider: config.imageProvider,
    imageModel: config.imageModel,
    imageEndpoint: config.imageEndpoint,
    imageApiKeySet: !!config.imageApiKey
  };
}

function entryDescriptor(entry) {
  if (!entry) return null;
  return {
    id: entry.id,
    legacyDefault: entry.legacyDefault,
    provider: entry.provider,
    model: entry.model,
    keySource: entry.keySource,
    customApiKey: entry.keySource === 'custom' ? entry.apiKey : ''
  };
}

function buildCouncilRuntime(raw) {
  const config = projectAdminAiConfigV2(raw);
  const byId = new Map(config.modelEntries.map(entry => [entry.id, entry]));
  return {
    connections: Object.fromEntries(
      AI_PROVIDERS.map(provider => [provider, { ...config.providers[provider] }])
    ),
    defaultPrimary: entryDescriptor(byId.get(config.defaultModel)),
    roles: Object.fromEntries(AI_ROLES.map(role => [role, {
      primary: entryDescriptor(byId.get(config.roleAssignments[role].primary)),
      fallback: entryDescriptor(byId.get(config.roleAssignments[role].fallback))
    }]))
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
  const provider = admin.provider || env.AI_PROVIDER || 'gemini';
  const envVoiceProvider = VOICE_PROVIDERS.includes(cleanField(env.TTS_PROVIDER))
    ? cleanField(env.TTS_PROVIDER)
    : '';
  const voiceProvider = admin.voiceProvider || envVoiceProvider || 'openai';
  const voiceEnvKey = voiceProvider === 'grok'
    ? (env.XAI_API_KEY || env.GROK_API_KEY || '')
    : (env.OPENAI_API_KEY || '');
  const merged = {
    provider,
    model: admin.model || env.AI_MODEL || undefined,
    apiKey: provider === 'claude-code' ? undefined : (admin.apiKey || undefined),
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
      apiKey: fallbackProvider === 'claude-code'
        ? undefined
        : (admin.fallback.apiKey || env.FALLBACK_API_KEY || undefined)
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

  // Internal Council registry. It is intentionally nested so the v2
  // assignment shape cannot collide with the temporary top-level v1 roles.
  merged.council = buildCouncilRuntime(adminConfig);

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

/** Canonical v2 save seam used by the admin settings route. */
export async function saveAdminAiConfigV2(raw) {
  const merged = prepareAdminAiConfigV2Save(raw, await loadAdminAiConfig());
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
