// Aetheria GM admin panel (Phases I1 + I3). Operator-only; talks to /api/admin/*.

let adminToken = sessionStorage.getItem('aetheria_admin_token') || '';

const el = (id) => document.getElementById(id);

const PROVIDERS = [
  ['', '(inherit)'],
  ['gemini', 'Google Gemini'],
  ['openai', 'OpenAI'],
  ['claude', 'Anthropic Claude'],
  ['grok', 'xAI Grok'],
  ['ollama', 'Ollama (local)'],
  ['custom', 'Custom OpenAI-compatible']
];

const AI_ROLES = [
  ['setup', 'Setup', 'Campaign outline + opening scene. Once per campaign — put your strongest, most creative model here.'],
  ['interaction', 'Interaction', 'Classifies player input every turn. Needs strict instruction-following and reliable JSON; fast and cheap wins.'],
  ['continuity', 'Continuity', 'Grounding checks against the campaign record (twice per action turn + table-talk verifier). A careful editor, not a writer.'],
  ['referee', 'Referee', 'Adjudication and dice decisions. Mid-tier reasoning with strict structured output.'],
  ['narration', 'Narration', 'The final voice the player reads. Your best prose stylist.']
];

function buildRolesGrid() {
  const grid = el('roles-grid');
  grid.innerHTML = AI_ROLES.map(([key, name, blurb]) => `
    <div style="border-top:1px solid var(--border);padding:10px 0 4px;margin-top:8px">
      <div style="font-family:'Outfit',system-ui,sans-serif;font-size:12px;font-weight:700">${name}</div>
      <div class="hint">${blurb}</div>
      <label for="role-${key}-provider">Provider</label>
      <select id="role-${key}-provider">${PROVIDERS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>
      <label for="role-${key}-model">Model</label>
      <input type="text" id="role-${key}-model" placeholder="blank = inherit">
      <label for="role-${key}-key">API key</label>
      <input type="password" id="role-${key}-key" placeholder="blank = keep current" autocomplete="off">
      <div class="secret-state" id="role-${key}-key-state"></div>
    </div>`).join('');
}
buildRolesGrid();

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
  el('voice-provider').value = settings.voiceProvider || '';
  el('fb-provider').value = settings.fallback?.provider || '';
  el('fb-model').value = settings.fallback?.model || '';
  renderSecretState('api-key-state', settings.apiKeySet);
  renderSecretState('voice-api-key-state', settings.voiceApiKeySet);
  renderSecretState('fb-api-key-state', settings.fallback?.apiKeySet);
  el('api-key').value = '';
  el('voice-api-key').value = '';
  el('fb-api-key').value = '';
  for (const [key] of AI_ROLES) {
    const role = settings.roles?.[key] || {};
    el(`role-${key}-provider`).value = role.provider || '';
    el(`role-${key}-model`).value = role.model || '';
    el(`role-${key}-key`).value = '';
    renderSecretState(`role-${key}-key-state`, role.apiKeySet);
  }
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
    voiceProvider: el('voice-provider').value,
    fallback: {
      provider: el('fb-provider').value,
      model: el('fb-model').value,
      apiKey: secret('fb-api-key')
    },
    roles: Object.fromEntries(AI_ROLES.map(([key]) => [key, {
      provider: el(`role-${key}-provider`).value,
      model: el(`role-${key}-model`).value,
      apiKey: secret(`role-${key}-key`)
    }]))
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
