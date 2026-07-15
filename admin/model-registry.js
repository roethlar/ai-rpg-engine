export const REGISTRY_PROVIDERS = Object.freeze([
  { id: 'gemini', label: 'Google Gemini', key: true, catalog: true },
  { id: 'openai', label: 'OpenAI', key: true, catalog: true },
  { id: 'claude', label: 'Anthropic Claude', key: true, catalog: true },
  { id: 'grok', label: 'xAI Grok', key: true, catalog: true },
  { id: 'custom', label: 'Custom OpenAI-compatible', key: true, endpoint: 'baseUrl', catalog: true },
  { id: 'ollama', label: 'Ollama', key: false, endpoint: 'ollamaUrl', catalog: true },
  { id: 'claude-code', label: 'Claude Code', key: false, catalog: false, status: true }
]);

export const COUNCIL_ROLES = Object.freeze([
  { id: 'setup', label: 'Setup', blurb: 'Campaign outline and opening scene; use your strongest creative model.' },
  { id: 'interaction', label: 'Interaction', blurb: 'Every-turn intent classification; fast, cheap, and strict wins.' },
  { id: 'continuity', label: 'Continuity', blurb: 'Grounding and consistency checks; a careful editor, not a writer.' },
  { id: 'referee', label: 'Referee', blurb: 'Adjudication and dice decisions with reliable structured output.' },
  { id: 'narration', label: 'Narration', blurb: 'Final player-facing prose; use your best stylist.' }
]);

const PROVIDER_IDS = new Set(REGISTRY_PROVIDERS.map(provider => provider.id));
const ROLE_IDS = new Set(COUNCIL_ROLES.map(role => role.id));

function clone(value) {
  return structuredClone(value);
}

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function emptyAssignments() {
  return Object.fromEntries(COUNCIL_ROLES.map(role => [role.id, { primary: '', fallback: '' }]));
}

function emptyCatalog() {
  return { models: [], status: null, error: '', loaded: false };
}

export function createRegistryState(settings = {}) {
  const sourceProviders = settings.providers && typeof settings.providers === 'object'
    ? settings.providers
    : {};
  const providers = {};
  const catalogs = {};
  for (const definition of REGISTRY_PROVIDERS) {
    const source = sourceProviders[definition.id] || {};
    providers[definition.id] = {
      apiKey: '',
      apiKeySet: source.apiKeySet === true,
      baseUrl: definition.id === 'custom' ? clean(source.baseUrl) : '',
      ollamaUrl: definition.id === 'ollama' ? clean(source.ollamaUrl) : ''
    };
    catalogs[definition.id] = emptyCatalog();
  }

  const modelEntries = Array.isArray(settings.modelEntries)
    ? settings.modelEntries.map(entry => ({
      id: clean(entry.id),
      label: clean(entry.label),
      provider: PROVIDER_IDS.has(entry.provider) ? entry.provider : '',
      model: clean(entry.model),
      keySource: entry.keySource === 'custom' ? 'custom' : 'provider',
      apiKey: '',
      apiKeySet: entry.apiKeySet === true,
      legacyDefault: entry.legacyDefault === true
    }))
    : [];

  const assignments = emptyAssignments();
  for (const role of COUNCIL_ROLES) {
    const incoming = settings.roleAssignments?.[role.id] || {};
    assignments[role.id] = {
      primary: clean(incoming.primary),
      fallback: clean(incoming.fallback)
    };
  }

  return {
    configVersion: 2,
    providers,
    catalogs,
    modelEntries,
    defaultModel: clean(settings.defaultModel),
    roleAssignments: assignments
  };
}

export function updateProviderDraft(state, provider, patch) {
  if (!PROVIDER_IDS.has(provider)) return state;
  const next = clone(state);
  next.providers[provider] = { ...next.providers[provider], ...patch };
  next.catalogs[provider] = emptyCatalog();
  return next;
}

export function setProviderCatalog(state, provider, result = {}) {
  if (!PROVIDER_IDS.has(provider)) return state;
  const next = clone(state);
  next.catalogs[provider] = {
    models: Array.isArray(result.models) ? [...new Set(result.models.map(clean).filter(Boolean))].sort() : [],
    status: result.status && typeof result.status === 'object' ? { ...result.status } : null,
    error: clean(result.error),
    loaded: result.loaded !== false
  };
  return next;
}

export function createModelEntry(id, provider = 'openai') {
  return {
    id: clean(id),
    label: '',
    provider: PROVIDER_IDS.has(provider) ? provider : 'openai',
    model: '',
    keySource: 'provider',
    apiKey: '',
    apiKeySet: false,
    legacyDefault: false
  };
}

export function addModelEntry(state, entry) {
  const next = clone(state);
  next.modelEntries.push({ ...createModelEntry(entry.id, entry.provider), ...entry });
  return next;
}

export function updateModelEntry(state, id, patch) {
  const next = clone(state);
  const entry = next.modelEntries.find(candidate => candidate.id === id);
  if (!entry) return state;

  const runtimeFields = ['provider', 'model', 'keySource', 'apiKey'];
  if (runtimeFields.some(field => Object.prototype.hasOwnProperty.call(patch, field)
    && patch[field] !== entry[field])) {
    entry.legacyDefault = false;
  }
  Object.assign(entry, patch);

  if (!PROVIDER_IDS.has(entry.provider)) entry.provider = '';
  if (entry.provider === 'claude-code') {
    entry.keySource = 'provider';
    entry.apiKey = '';
    entry.apiKeySet = false;
  } else if (entry.keySource === 'provider') {
    entry.apiKey = '';
    entry.apiKeySet = false;
  }
  return next;
}

export function setRoleAssignment(state, role, tier, entryId) {
  if (!ROLE_IDS.has(role) || !['primary', 'fallback'].includes(tier)) return state;
  const next = clone(state);
  next.roleAssignments[role][tier] = clean(entryId);
  return next;
}

export function modelUsage(state, entryId) {
  const usage = [];
  if (state.defaultModel === entryId) usage.push('Environment/default');
  for (const role of COUNCIL_ROLES) {
    const assignment = state.roleAssignments[role.id];
    if (assignment.primary === entryId) usage.push(`${role.label} primary`);
    if (assignment.fallback === entryId) usage.push(`${role.label} fallback`);
  }
  return usage;
}

export function removeModelEntry(state, entryId) {
  const usage = modelUsage(state, entryId);
  if (usage.length > 0) {
    return { state, error: `Assigned model cannot be removed: ${usage.join(', ')}.` };
  }
  const next = clone(state);
  next.modelEntries = next.modelEntries.filter(entry => entry.id !== entryId);
  return { state: next, error: '' };
}

export function validateRegistryState(state) {
  const ids = new Set();
  for (let index = 0; index < state.modelEntries.length; index += 1) {
    const entry = state.modelEntries[index];
    if (!entry.id || ids.has(entry.id)) {
      return { anchor: `model-${entry.id || index}`, message: `Model row ${index + 1} has an invalid id.` };
    }
    ids.add(entry.id);
    if (!clean(entry.label)) {
      return { anchor: `model-${entry.id}`, message: `Model row ${index + 1} needs a label.` };
    }
    if (!entry.legacyDefault && !PROVIDER_IDS.has(entry.provider)) {
      return { anchor: `model-${entry.id}`, message: `Model row ${index + 1} needs a provider.` };
    }
    if (!entry.legacyDefault && !clean(entry.model)) {
      return { anchor: `model-${entry.id}`, message: `Model row ${index + 1} needs a model id.` };
    }
    if (entry.keySource === 'custom' && !entry.legacyDefault
      && !clean(entry.apiKey) && !entry.apiKeySet) {
      return { anchor: `model-${entry.id}`, message: `Model row ${index + 1} needs its custom API key.` };
    }
  }

  for (const role of COUNCIL_ROLES) {
    for (const tier of ['primary', 'fallback']) {
      const entryId = state.roleAssignments[role.id][tier];
      if (entryId && !ids.has(entryId)) {
        return {
          anchor: `role-${role.id}`,
          message: `${role.label} ${tier} points to a missing configured model.`
        };
      }
    }
  }
  return null;
}

export function buildRegistryPayload(state, { clearKeys = false } = {}) {
  const providers = {};
  for (const definition of REGISTRY_PROVIDERS) {
    const connection = state.providers[definition.id] || {};
    providers[definition.id] = {};
    if (definition.key) providers[definition.id].apiKey = clearKeys ? null : clean(connection.apiKey);
    if (definition.endpoint === 'baseUrl') providers[definition.id].baseUrl = clean(connection.baseUrl);
    if (definition.endpoint === 'ollamaUrl') providers[definition.id].ollamaUrl = clean(connection.ollamaUrl);
  }

  return {
    configVersion: 2,
    providers,
    modelEntries: state.modelEntries.map(entry => {
      const preserveLegacyCustom = clearKeys && entry.legacyDefault && entry.keySource === 'custom';
      const keySource = clearKeys && entry.keySource === 'custom' && !preserveLegacyCustom
        ? 'provider'
        : entry.keySource;
      return {
        id: entry.id,
        label: clean(entry.label),
        provider: entry.provider,
        model: clean(entry.model),
        keySource,
        apiKey: keySource === 'custom' ? (clearKeys ? null : clean(entry.apiKey)) : '',
        legacyDefault: entry.legacyDefault === true
      };
    }),
    defaultModel: state.defaultModel,
    roleAssignments: clone(state.roleAssignments)
  };
}

export function catalogRequestFor(state, provider) {
  if (!PROVIDER_IDS.has(provider)) return null;
  const connection = state.providers[provider] || {};
  return {
    provider,
    apiKey: clean(connection.apiKey),
    baseUrl: provider === 'custom' ? clean(connection.baseUrl) : '',
    ollamaUrl: provider === 'ollama' ? clean(connection.ollamaUrl) : ''
  };
}
