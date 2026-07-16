import {
  REGISTRY_PROVIDERS,
  COUNCIL_ROLES,
  createRegistryState,
  updateProviderDraft,
  setProviderCatalog,
  createModelEntry,
  addModelEntry,
  updateModelEntry,
  setRoleAssignment,
  modelUsage,
  removeModelEntry,
  validateRegistryState,
  buildRegistryPayload,
  catalogRequestFor
} from './model-registry.js';

let adminToken = sessionStorage.getItem('aetheria_admin_token') || '';
let voiceProviderCatalog = [];
let registry = createRegistryState();

const el = id => document.getElementById(id);

function authHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (adminToken) headers.Authorization = `Bearer ${adminToken}`;
  return headers;
}

async function api(pathname, options = {}) {
  const response = await fetch(pathname, { ...options, headers: authHeaders() });
  if (response.status === 401) {
    showLogin('Invalid or expired admin password.');
    throw new Error('unauthorized');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  return response.json();
}

function showLogin(message = '') {
  document.body.className = 'show-login';
  el('login-status').textContent = message;
  el('login-status').className = message ? 'error' : '';
}

function showPanel() {
  document.body.className = 'show-panel';
}

function setStatus(message, ok) {
  const status = el('status');
  status.textContent = message;
  status.className = ok ? 'ok' : 'error';
}

function renderSecretState(target, isSet, typed = false) {
  target.textContent = typed
    ? 'Unsaved key ready.'
    : isSet ? 'Stored on the server.' : 'No stored key.';
  target.className = `secret-state${isSet || typed ? ' set' : ''}`;
}

function labeledControl(labelText, control) {
  const wrapper = document.createElement('div');
  const label = document.createElement('label');
  label.textContent = labelText;
  if (control.id) label.htmlFor = control.id;
  wrapper.append(label, control);
  return wrapper;
}

function providerDefinition(provider) {
  return REGISTRY_PROVIDERS.find(entry => entry.id === provider);
}

function providerLabel(provider) {
  return providerDefinition(provider)?.label || 'Legacy inherited provider';
}

function catalogStateText(provider) {
  const catalog = registry.catalogs[provider];
  if (catalog.error) return { message: catalog.error, className: 'catalog-state error' };
  if (provider === 'claude-code' && catalog.status) {
    if (!catalog.status.installed) return { message: 'Claude Code is not installed.', className: 'catalog-state error' };
    const version = catalog.status.version ? ` · v${catalog.status.version}` : '';
    if (!catalog.status.loggedIn) {
      return { message: `Installed${version}; Claude subscription login required.`, className: 'catalog-state error' };
    }
    const plan = catalog.status.subscriptionType || 'subscription';
    return { message: `Logged in · ${plan}${version}`, className: 'catalog-state ok' };
  }
  if (catalog.loaded) {
    return { message: `${catalog.models.length} model${catalog.models.length === 1 ? '' : 's'} loaded.`, className: 'catalog-state ok' };
  }
  return { message: provider === 'claude-code' ? 'Status not checked.' : 'Not refreshed.', className: 'catalog-state' };
}

function ensureDatalist(provider) {
  const id = `catalog-${provider}`;
  let datalist = el(id);
  if (!datalist) {
    datalist = document.createElement('datalist');
    datalist.id = id;
    document.body.append(datalist);
  }
  datalist.replaceChildren(...registry.catalogs[provider].models.map(model => new Option(model, model)));
}

function updateProviderCatalogDisplay(provider) {
  ensureDatalist(provider);
  const target = document.querySelector(`[data-catalog-state="${provider}"]`);
  if (!target) return;
  const display = catalogStateText(provider);
  target.textContent = display.message;
  target.className = display.className;
}

async function refreshProvider(provider, button) {
  button.disabled = true;
  const stateTarget = document.querySelector(`[data-catalog-state="${provider}"]`);
  stateTarget.textContent = provider === 'claude-code' ? 'Checking status…' : 'Refreshing…';
  stateTarget.className = 'catalog-state';
  try {
    const result = await api('/api/admin/models/catalog', {
      method: 'POST',
      body: JSON.stringify(catalogRequestFor(registry, provider))
    });
    registry = setProviderCatalog(registry, provider, result);
  } catch (error) {
    if (error.message === 'unauthorized') return;
    registry = setProviderCatalog(registry, provider, { error: error.message, loaded: true });
  } finally {
    button.disabled = false;
    updateProviderCatalogDisplay(provider);
  }
}

function renderProviders() {
  const rows = el('provider-rows');
  rows.replaceChildren();

  for (const definition of REGISTRY_PROVIDERS) {
    const connection = registry.providers[definition.id];
    const row = document.createElement('div');
    row.className = 'provider-row';
    row.dataset.providerRow = definition.id;

    const identity = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'provider-name';
    name.textContent = definition.label;
    const note = document.createElement('div');
    note.className = 'provider-note';
    note.textContent = definition.id === 'claude-code'
      ? 'Uses the server process’s logged-in Claude subscription.'
      : definition.id === 'ollama' ? 'Local or environment-pinned runtime.' : 'Reusable connection.';
    identity.append(name, note);

    const credential = document.createElement('div');
    if (definition.key) {
      const input = document.createElement('input');
      input.type = 'password';
      input.id = `provider-${definition.id}-key`;
      input.placeholder = 'blank = keep current';
      input.autocomplete = 'off';
      const state = document.createElement('div');
      renderSecretState(state, connection.apiKeySet, false);
      input.addEventListener('input', () => {
        registry = updateProviderDraft(registry, definition.id, { apiKey: input.value });
        renderSecretState(state, connection.apiKeySet, input.value.trim() !== '');
        updateProviderCatalogDisplay(definition.id);
      });
      credential.append(input, state);
    } else {
      const text = document.createElement('div');
      text.className = 'provider-note';
      text.textContent = definition.id === 'claude-code' ? 'Claude Code login — no API key' : 'No credential required';
      credential.append(text);
    }

    const endpoint = document.createElement('div');
    if (definition.endpoint) {
      const input = document.createElement('input');
      input.type = 'text';
      input.id = `provider-${definition.id}-endpoint`;
      input.value = connection[definition.endpoint] || '';
      input.placeholder = definition.endpoint === 'baseUrl'
        ? 'https://…/chat/completions'
        : 'http://localhost:11434';
      input.addEventListener('input', () => {
        registry = updateProviderDraft(registry, definition.id, { [definition.endpoint]: input.value });
        updateProviderCatalogDisplay(definition.id);
      });
      endpoint.append(input);
    } else {
      const text = document.createElement('div');
      text.className = 'provider-note';
      text.textContent = definition.id === 'claude-code' ? 'CLI-managed' : 'Pinned official endpoint';
      endpoint.append(text);
    }

    const actions = document.createElement('div');
    actions.className = 'provider-actions';
    const refresh = document.createElement('button');
    refresh.type = 'button';
    refresh.className = 'secondary';
    refresh.dataset.refreshProvider = definition.id;
    refresh.textContent = definition.id === 'claude-code' ? 'Check status' : 'Refresh models';
    refresh.addEventListener('click', () => refreshProvider(definition.id, refresh));
    const catalogState = document.createElement('div');
    catalogState.dataset.catalogState = definition.id;
    actions.append(refresh, catalogState);

    row.append(identity, credential, endpoint, actions);
    rows.append(row);
    updateProviderCatalogDisplay(definition.id);
  }
}

function providerSelect(entry) {
  const select = document.createElement('select');
  if (entry.legacyDefault || !entry.provider) select.append(new Option('Legacy inherited', ''));
  for (const provider of REGISTRY_PROVIDERS) select.append(new Option(provider.label, provider.id));
  select.value = entry.provider;
  return select;
}

function renderModels() {
  const rows = el('model-rows');
  rows.replaceChildren();
  for (const entry of registry.modelEntries) {
    if (entry.provider) ensureDatalist(entry.provider);
    const row = document.createElement('div');
    row.className = 'model-row';
    row.id = `model-${entry.id}`;
    row.dataset.modelRow = entry.id;

    const labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.value = entry.label;
    labelInput.placeholder = 'e.g. Fast interaction';
    labelInput.dataset.field = 'label';
    labelInput.addEventListener('input', () => {
      registry = updateModelEntry(registry, entry.id, { label: labelInput.value });
      renderAssignments();
    });
    const labelCell = labeledControl('Label', labelInput);
    if (entry.legacyDefault) {
      const badge = document.createElement('span');
      badge.className = 'legacy-badge';
      badge.textContent = 'Legacy inherited default';
      labelCell.append(badge);
    }

    const provider = providerSelect(entry);
    provider.dataset.field = 'provider';
    provider.addEventListener('change', () => {
      registry = updateModelEntry(registry, entry.id, { provider: provider.value });
      renderModels();
      renderAssignments();
    });

    const modelInput = document.createElement('input');
    modelInput.type = 'text';
    modelInput.value = entry.model;
    modelInput.placeholder = entry.legacyDefault ? 'Inherited until edited' : 'Model id';
    modelInput.dataset.field = 'model';
    if (entry.provider) modelInput.setAttribute('list', `catalog-${entry.provider}`);
    modelInput.addEventListener('input', () => {
      registry = updateModelEntry(registry, entry.id, { model: modelInput.value });
    });

    let keySourceCell;
    let customCell;
    if (entry.provider === 'claude-code') {
      const login = document.createElement('div');
      login.className = 'provider-note';
      login.textContent = 'Claude Code login';
      keySourceCell = labeledControl('Key source', login);
      const noKey = document.createElement('div');
      noKey.className = 'provider-note';
      noKey.textContent = 'No API-key control';
      customCell = labeledControl('Credential', noKey);
    } else {
      const keySource = document.createElement('select');
      keySource.append(new Option('Provider shared key', 'provider'), new Option('Custom key', 'custom'));
      keySource.value = entry.keySource;
      keySource.dataset.field = 'key-source';
      keySource.addEventListener('change', () => {
        registry = updateModelEntry(registry, entry.id, { keySource: keySource.value });
        renderModels();
      });
      keySourceCell = labeledControl('Key source', keySource);

      if (entry.keySource === 'custom') {
        const key = document.createElement('input');
        key.type = 'password';
        key.placeholder = 'blank = keep current';
        key.autocomplete = 'off';
        key.dataset.field = 'custom-key';
        key.addEventListener('input', () => {
          registry = updateModelEntry(registry, entry.id, { apiKey: key.value });
          renderSecretState(keyState, entry.apiKeySet, key.value.trim() !== '');
        });
        const keyState = document.createElement('div');
        renderSecretState(keyState, entry.apiKeySet, false);
        customCell = labeledControl('Custom credential', key);
        customCell.append(keyState);
      } else {
        const shared = document.createElement('div');
        shared.className = 'provider-note';
        shared.textContent = entry.legacyDefault ? 'Legacy precedence retained' : 'Uses provider connection';
        customCell = labeledControl('Credential', shared);
      }
    }

    const actions = document.createElement('div');
    actions.className = 'model-actions';
    const usage = modelUsage(registry, entry.id);
    const usageText = document.createElement('div');
    usageText.className = 'usage';
    usageText.textContent = usage.length > 0 ? usage.join(' · ') : 'Unused';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'danger';
    remove.textContent = 'Remove';
    remove.dataset.removeModel = entry.id;
    remove.disabled = usage.length > 0;
    remove.title = usage.length > 0 ? 'Clear this model’s assignments before removing it.' : '';
    remove.addEventListener('click', () => {
      const result = removeModelEntry(registry, entry.id);
      if (result.error) {
        setRowError(row, result.error);
        return;
      }
      registry = result.state;
      renderModels();
      renderAssignments();
    });
    actions.append(usageText, remove);

    const rowError = document.createElement('div');
    rowError.className = 'row-error';
    rowError.style.gridColumn = '1 / -1';
    row.append(labelCell, labeledControl('Provider', provider), labeledControl('Model', modelInput), keySourceCell, customCell, actions, rowError);
    rows.append(row);
  }

  if (registry.modelEntries.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'provider-note';
    empty.style.padding = '14px 10px';
    empty.textContent = 'No configured models yet.';
    rows.append(empty);
  }
}

function assignmentSelect(tier, selected) {
  const select = document.createElement('select');
  select.append(new Option(tier === 'primary' ? 'Environment / default' : 'No stored fallback', ''));
  for (const entry of registry.modelEntries) {
    const detail = entry.provider && entry.model ? ` — ${providerLabel(entry.provider)} / ${entry.model}` : ' — legacy inherited';
    select.append(new Option(`${entry.label || 'Unnamed model'}${detail}`, entry.id));
  }
  select.value = selected;
  return select;
}

function renderAssignments() {
  const rows = el('assignment-rows');
  rows.replaceChildren();
  for (const role of COUNCIL_ROLES) {
    const row = document.createElement('div');
    row.className = 'assignment-row';
    row.id = `role-${role.id}`;
    row.dataset.roleRow = role.id;
    const identity = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'role-name';
    name.textContent = role.label;
    const blurb = document.createElement('div');
    blurb.className = 'role-blurb';
    blurb.textContent = role.blurb;
    const error = document.createElement('div');
    error.className = 'row-error';
    identity.append(name, blurb, error);

    const primary = assignmentSelect('primary', registry.roleAssignments[role.id].primary);
    primary.dataset.tier = 'primary';
    primary.addEventListener('change', () => {
      registry = setRoleAssignment(registry, role.id, 'primary', primary.value);
      renderModels();
    });
    const fallback = assignmentSelect('fallback', registry.roleAssignments[role.id].fallback);
    fallback.dataset.tier = 'fallback';
    fallback.addEventListener('change', () => {
      registry = setRoleAssignment(registry, role.id, 'fallback', fallback.value);
      renderModels();
    });
    row.append(identity, primary, fallback);
    rows.append(row);
  }
}

function setRowError(row, message) {
  const error = row.querySelector('.row-error');
  if (error) error.textContent = message;
}

function clearRowErrors() {
  document.querySelectorAll('.row-error').forEach(target => { target.textContent = ''; });
}

function showValidationError(validation) {
  clearRowErrors();
  const target = el(validation.anchor);
  if (target) {
    setRowError(target, validation.message);
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  setStatus(validation.message, false);
}

function showServerValidation(message) {
  const modelMatch = message.match(/modelEntries\[(\d+)\]/);
  if (modelMatch) {
    const entry = registry.modelEntries[Number(modelMatch[1])];
    if (entry) return showValidationError({ anchor: `model-${entry.id}`, message });
  }
  const roleMatch = message.match(/roleAssignments\.([a-z]+)/);
  if (roleMatch) return showValidationError({ anchor: `role-${roleMatch[1]}`, message });
  setStatus(message, false);
}

function updateVoiceProviderUi() {
  const selected = voiceProviderCatalog.find(entry => entry.provider === el('voice-provider').value);
  el('voice-model-group').style.display = selected?.hasModel === false ? 'none' : '';
}

function renderVoiceProviderCatalog(providers) {
  voiceProviderCatalog = Array.isArray(providers) ? providers : [];
  const select = el('voice-provider');
  select.replaceChildren(new Option('(default: OpenAI)', ''));
  for (const entry of voiceProviderCatalog) {
    const label = entry.provider === 'grok' ? 'xAI Grok' : entry.provider === 'openai' ? 'OpenAI' : entry.provider;
    select.append(new Option(label, entry.provider));
  }
}

function renderMedia(settings) {
  el('voice-model').value = settings.voiceModel || '';
  el('voice-provider').value = settings.voiceProvider || '';
  el('voice-always-generate').checked = settings.voiceAlwaysGenerate === true;
  el('image-provider').value = settings.imageProvider || '';
  el('image-model').value = settings.imageModel || '';
  el('image-endpoint').value = settings.imageEndpoint || '';
  el('voice-api-key-openai').value = '';
  el('voice-api-key-grok').value = '';
  el('image-api-key').value = '';
  renderSecretState(el('voice-api-key-openai-state'), settings.voiceApiKeySet?.openai);
  renderSecretState(el('voice-api-key-grok-state'), settings.voiceApiKeySet?.grok);
  renderSecretState(el('image-api-key-state'), settings.imageApiKeySet);
  updateVoiceProviderUi();
}

function renderSettings(settings, { preserveCatalogs = false } = {}) {
  const pageCatalogs = preserveCatalogs ? registry.catalogs : null;
  registry = createRegistryState(settings);
  if (pageCatalogs) registry.catalogs = pageCatalogs;
  renderProviders();
  renderModels();
  renderAssignments();
  renderMedia(settings);
  clearRowErrors();
}

async function loadSettings() {
  const [settings, catalog] = await Promise.all([
    api('/api/admin/settings'),
    api('/api/admin/voice-catalog')
  ]);
  renderVoiceProviderCatalog(catalog.providers);
  renderSettings(settings);
  showPanel();
}

function secretValue(id, clearKeys) {
  if (clearKeys) return null;
  const value = el(id).value.trim();
  return value === '' ? '' : value;
}

function collectSettings(clearKeys = false) {
  return {
    ...buildRegistryPayload(registry, { clearKeys }),
    voiceApiKeys: {
      openai: secretValue('voice-api-key-openai', clearKeys),
      grok: secretValue('voice-api-key-grok', clearKeys)
    },
    voiceModel: el('voice-model').value,
    voiceProvider: el('voice-provider').value,
    voiceAlwaysGenerate: el('voice-always-generate').checked,
    imageProvider: el('image-provider').value,
    imageModel: el('image-model').value,
    imageApiKey: secretValue('image-api-key', clearKeys),
    imageEndpoint: el('image-endpoint').value
  };
}

async function saveSettings(clearKeys = false) {
  const validation = validateRegistryState(registry);
  if (validation) return showValidationError(validation);
  clearRowErrors();
  try {
    const saved = await api('/api/admin/settings', {
      method: 'POST',
      body: JSON.stringify(collectSettings(clearKeys))
    });
    renderSettings(saved, { preserveCatalogs: !clearKeys });
    setStatus(clearKeys ? 'Stored keys cleared.' : 'Settings saved.', true);
  } catch (error) {
    if (error.message !== 'unauthorized') showServerValidation(error.message);
  }
}

el('btn-add-model').addEventListener('click', () => {
  const id = `model_${crypto.randomUUID().replaceAll('-', '')}`;
  registry = addModelEntry(registry, createModelEntry(id));
  renderModels();
  renderAssignments();
  document.querySelector(`[data-model-row="${id}"] input`).focus();
});

el('btn-login').addEventListener('click', async () => {
  adminToken = el('admin-password').value;
  try {
    await api('/api/admin/verify', { method: 'POST' });
    sessionStorage.setItem('aetheria_admin_token', adminToken);
    await loadSettings();
  } catch (error) {
    if (error.message !== 'unauthorized') el('login-status').textContent = error.message;
  }
});

el('admin-password').addEventListener('keydown', event => {
  if (event.key === 'Enter') el('btn-login').click();
});
el('btn-save').addEventListener('click', () => saveSettings(false));
el('voice-provider').addEventListener('change', updateVoiceProviderUi);
el('btn-clear-keys').addEventListener('click', () => {
  if (confirm('Clear every stored provider, model-override, voice, and image key? Assignments stay unchanged.')) {
    saveSettings(true);
  }
});

loadSettings().catch(() => showLogin());
