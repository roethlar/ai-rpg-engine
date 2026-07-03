// Aetheria GM admin panel (Phase I1). Operator-only; talks to /api/admin/*.

let adminToken = sessionStorage.getItem('aetheria_admin_token') || '';

const el = (id) => document.getElementById(id);

function authHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
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

function renderSecretState(id, isSet) {
  const state = el(id);
  state.textContent = isSet ? 'A key is stored on the server.' : 'No key stored.';
  state.className = `secret-state${isSet ? ' set' : ''}`;
}

function renderSettings(settings) {
  el('provider').value = settings.provider || '';
  el('model').value = settings.model || '';
  el('base-url').value = settings.baseUrl || '';
  el('ollama-url').value = settings.ollamaUrl || '';
  el('voice-model').value = settings.voiceModel || '';
  el('fb-provider').value = settings.fallback?.provider || '';
  el('fb-model').value = settings.fallback?.model || '';
  renderSecretState('api-key-state', settings.apiKeySet);
  renderSecretState('voice-api-key-state', settings.voiceApiKeySet);
  renderSecretState('fb-api-key-state', settings.fallback?.apiKeySet);
  el('api-key').value = '';
  el('voice-api-key').value = '';
  el('fb-api-key').value = '';
}

async function loadSettings() {
  const settings = await api('/api/admin/settings');
  renderSettings(settings);
  showPanel();
}

function collectSettings(clearKeys = false) {
  const secret = (id) => {
    if (clearKeys) return null; // explicit clear
    const value = el(id).value.trim();
    return value === '' ? '' : value; // '' = keep stored key
  };
  return {
    provider: el('provider').value,
    model: el('model').value,
    apiKey: secret('api-key'),
    baseUrl: el('base-url').value,
    ollamaUrl: el('ollama-url').value,
    voiceApiKey: secret('voice-api-key'),
    voiceModel: el('voice-model').value,
    fallback: {
      provider: el('fb-provider').value,
      model: el('fb-model').value,
      apiKey: secret('fb-api-key')
    }
  };
}

async function saveSettings(clearKeys = false) {
  try {
    const saved = await api('/api/admin/settings', {
      method: 'POST',
      body: JSON.stringify(collectSettings(clearKeys))
    });
    renderSettings(saved);
    setStatus(clearKeys ? 'Stored keys cleared.' : 'Settings saved.', true);
  } catch (error) {
    if (error.message !== 'unauthorized') setStatus(error.message, false);
  }
}

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

el('admin-password').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') el('btn-login').click();
});

el('btn-save').addEventListener('click', () => saveSettings(false));
el('btn-clear-keys').addEventListener('click', () => {
  if (confirm('Clear all stored API keys from the server settings?')) saveSettings(true);
});

// Boot: try loading directly (works when ADMIN_SECRET is unset or a valid token is cached).
loadSettings().catch(() => showLogin());
