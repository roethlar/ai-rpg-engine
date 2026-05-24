/**
 * AETHERIA DM FRONTEND APPLICATION
 */

// Application state
let currentCampaignId = null;
let apiConfig = {
  provider: 'gemini',
  model: '',
  apiKey: '',
  baseUrl: '',
  ollamaUrl: '',
  accessToken: '', // Authentication token
  enableDiagnostics: false // Dev mode flag
};

// DOM Elements
const mainGameScreen = document.getElementById('main-game-screen');
const campaignMenuScreen = document.getElementById('campaign-menu-screen');
const campaignListContainer = document.getElementById('campaign-list-container');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingMessage = document.getElementById('loading-message');

// Modals & Forms
const settingsModal = document.getElementById('settings-modal');
const settingsForm = document.getElementById('settings-form');
const campaignWizardModal = document.getElementById('campaign-wizard-modal');
const campaignCreateForm = document.getElementById('campaign-create-form');

// Settings Inputs
const selectProvider = document.getElementById('select-provider');
const inputModel = document.getElementById('input-model');
const inputApiKey = document.getElementById('input-api-key');
const inputCustomUrl = document.getElementById('input-custom-url');
const inputOllamaUrl = document.getElementById('input-ollama-url');
const inputAccessToken = document.getElementById('input-access-token');
const checkboxDiagnostics = document.getElementById('input-enable-diagnostics');

// Game Panel DOM Elements
const activeQuestTitle = document.getElementById('active-quest-title');
const activeQuestDesc = document.getElementById('active-quest-desc');
const activeActBadge = document.getElementById('active-act-badge');
const campaignOutlineList = document.getElementById('campaign-outline-list');
const narrativeContainer = document.getElementById('narrative-container');
const suggestedChoicesContainer = document.getElementById('suggested-choices-container');
const actionForm = document.getElementById('action-form');
const actionInput = document.getElementById('action-input');
const btnSendAction = document.getElementById('btn-send-action');

// Stats Elements
const charName = document.getElementById('char-name');
const charClass = document.getElementById('char-class');
const charLevel = document.getElementById('char-level');
const healthText = document.getElementById('health-text');
const healthFill = document.getElementById('health-fill');
const manaText = document.getElementById('mana-text');
const manaFill = document.getElementById('mana-fill');
const xpText = document.getElementById('xp-text');
const xpFill = document.getElementById('xp-fill');
const inventoryContainer = document.getElementById('inventory-container');
const codexContainer = document.getElementById('codex-container');

// Tab Switchers
const rightTabsHeader = document.getElementById('right-tabs-header');
const rightPanelHeading = document.getElementById('right-panel-heading');
const tabInventoryBtn = document.getElementById('tab-inventory-btn');
const tabCodexBtn = document.getElementById('tab-codex-btn');
const tabContentInventory = document.getElementById('tab-content-inventory');
const tabContentCodex = document.getElementById('tab-content-codex');

// Attributes
const attrStr = document.getElementById('attr-str');
const attrAgi = document.getElementById('attr-agi');
const attrInt = document.getElementById('attr-int');
const attrWil = document.getElementById('attr-wil');

// Illustration
const visualizerFrame = document.getElementById('visualizer-frame');

// Init application on load
window.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  setupEventListeners();
  loadCampaignsMenu();
});

// Load config from localStorage
function loadSettings() {
  const saved = localStorage.getItem('aetheria_settings');
  if (saved) {
    try {
      apiConfig = JSON.parse(saved);
    } catch (e) {
      console.error('Error parsing settings', e);
    }
  }

  // Populate form elements
  selectProvider.value = apiConfig.provider || 'gemini';
  inputModel.value = apiConfig.model || '';
  inputApiKey.value = apiConfig.apiKey || '';
  inputCustomUrl.value = apiConfig.baseUrl || '';
  inputOllamaUrl.value = apiConfig.ollamaUrl || '';
  inputAccessToken.value = apiConfig.accessToken || '';
  checkboxDiagnostics.checked = !!apiConfig.enableDiagnostics;

  toggleSettingsFields(selectProvider.value);
}

// Save config to localStorage
function saveSettings() {
  apiConfig.provider = selectProvider.value;
  apiConfig.model = inputModel.value.trim();
  apiConfig.apiKey = inputApiKey.value.trim();
  apiConfig.baseUrl = inputCustomUrl.value.trim();
  apiConfig.ollamaUrl = inputOllamaUrl.value.trim();
  apiConfig.accessToken = inputAccessToken.value.trim();
  apiConfig.enableDiagnostics = checkboxDiagnostics.checked;

  localStorage.setItem('aetheria_settings', JSON.stringify(apiConfig));
  
  if (currentCampaignId) {
    applyLayoutMode();
  }
}

// Show/Hide provider fields
function toggleSettingsFields(provider) {
  const apiGroup = document.getElementById('group-api-key');
  const customGroup = document.getElementById('group-custom-endpoint');
  const ollamaGroup = document.getElementById('group-ollama-url');

  apiGroup.style.display = 'block';
  customGroup.style.display = 'none';
  ollamaGroup.style.display = 'none';

  if (provider === 'custom') {
    customGroup.style.display = 'block';
  } else if (provider === 'ollama') {
    ollamaGroup.style.display = 'block';
    apiGroup.style.display = 'none';
  } else if (provider === 'gemini') {
    inputModel.placeholder = 'e.g. gemini-1.5-flash, gemini-2.5-flash';
  } else if (provider === 'openai') {
    inputModel.placeholder = 'e.g. gpt-4o-mini, gpt-4o';
  } else if (provider === 'claude') {
    inputModel.placeholder = 'e.g. claude-3-5-sonnet-20241022';
  }
}

// Helper to compile authorization headers
function getRequestHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (apiConfig.accessToken) {
    headers['Authorization'] = `Bearer ${apiConfig.accessToken}`;
  }
  return headers;
}

// Fetch helper with timeout protection
async function fetchWithTimeout(url, options = {}, timeoutMs = 60000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...getRequestHeaders(),
        ...(options.headers || {})
      },
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs / 1000}s`);
    }
    throw error;
  }
}

// Controls visibility of Outline panel and Codex tabs based on diagnostics settings
function applyLayoutMode() {
  const leftPanel = document.getElementById('left-diagnostics-panel');

  if (apiConfig.enableDiagnostics) {
    mainGameScreen.classList.remove('immersive-layout');
    leftPanel.style.display = 'flex';
    rightTabsHeader.style.display = 'flex';
    rightPanelHeading.style.display = 'none';
  } else {
    mainGameScreen.classList.add('immersive-layout');
    leftPanel.style.display = 'none';
    rightTabsHeader.style.display = 'none';
    rightPanelHeading.style.display = 'block';
    
    // Fallback active right-tab content back to Inventory
    tabContentInventory.style.display = 'flex';
    tabContentCodex.style.display = 'none';
    tabInventoryBtn.classList.add('active');
    tabCodexBtn.classList.remove('active');
  }
}

// Bind UI triggers
function setupEventListeners() {
  // Settings buttons
  document.getElementById('btn-show-settings').addEventListener('click', () => {
    loadSettings();
    settingsModal.style.display = 'flex';
  });
  document.getElementById('btn-close-settings').addEventListener('click', () => settingsModal.style.display = 'none');
  document.getElementById('btn-cancel-settings').addEventListener('click', () => settingsModal.style.display = 'none');

  selectProvider.addEventListener('change', (e) => {
    toggleSettingsFields(e.target.value);
  });

  settingsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    saveSettings();
    settingsModal.style.display = 'none';
    showToast('AI configurations saved.', 'success');
  });

  // Right Panel tab swapping
  tabInventoryBtn.addEventListener('click', () => {
    tabInventoryBtn.classList.add('active');
    tabCodexBtn.classList.remove('active');
    tabContentInventory.style.display = 'flex';
    tabContentCodex.style.display = 'none';
  });

  tabCodexBtn.addEventListener('click', () => {
    tabCodexBtn.classList.add('active');
    tabInventoryBtn.classList.remove('active');
    tabContentCodex.style.display = 'flex';
    tabContentInventory.style.display = 'none';
  });

  // Campaigns lists buttons
  document.getElementById('btn-show-campaigns').addEventListener('click', () => {
    loadCampaignsMenu();
    campaignMenuScreen.style.display = 'flex';
  });

  // Campaign create wizard
  document.getElementById('btn-new-campaign-trigger').addEventListener('click', () => {
    campaignWizardModal.style.display = 'flex';
  });
  document.getElementById('btn-close-wizard').addEventListener('click', () => campaignWizardModal.style.display = 'none');
  document.getElementById('btn-cancel-wizard').addEventListener('click', () => campaignWizardModal.style.display = 'none');

  campaignCreateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const genre = document.getElementById('input-genre').value.trim();
    const charNameVal = document.getElementById('input-char-name').value.trim();
    const charClassVal = document.getElementById('select-char-class').value;

    campaignWizardModal.style.display = 'none';
    showLoadingOverlay(`Dungeon Master is crafting your campaign...\nCreating outline, acts, NPCs, and initial scene.`);

    try {
      const response = await fetchWithTimeout('/api/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          genre,
          characterName: charNameVal,
          characterClass: charClassVal,
          apiConfig
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Server failed to start campaign');
      }

      const gameState = await response.json();
      currentCampaignId = gameState.campaignId;
      renderGame(gameState, true);
      campaignMenuScreen.style.display = 'none';
    } catch (error) {
      console.error(error);
      showToast(`Initialization Error: ${error.message}`, 'error');
    } finally {
      hideLoadingOverlay();
    }
  });

  // Action text submission
  actionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const actionText = actionInput.value.trim();
    if (!actionText || !currentCampaignId) return;

    actionInput.value = '';
    appendPlayerAction(actionText);

    setActionInputState(false);

    try {
      const response = await fetchWithTimeout(`/api/campaigns/${currentCampaignId}/turn`, {
        method: 'POST',
        body: JSON.stringify({
          playerAction: actionText,
          apiConfig
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Failed to submit action');
      }

      const gameState = await response.json();
      renderGame(gameState, false);
    } catch (error) {
      console.error(error);
      appendDMDialogue(`❌ **Error from Dungeon Master:** ${error.message}\n\nPlease check server logs, network, or your API key settings.`);
    } finally {
      setActionInputState(true);
    }
  });
}

// Fetch list from DB and show in overlay menu
async function loadCampaignsMenu() {
  campaignListContainer.innerHTML = `<div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Loading campaigns...</div>`;
  
  try {
    const response = await fetchWithTimeout('/api/campaigns');
    if (!response.ok) throw new Error(response.status === 401 ? 'Unauthorized. Check Access Token.' : 'Could not fetch campaigns');

    const campaigns = await response.json();
    campaignListContainer.innerHTML = '';

    if (campaigns.length === 0) {
      campaignListContainer.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-feather-pointed"></i>
          <p>No active campaigns found.</p>
          <p style="font-size: 12px; margin-top: 8px;">Click "Create Campaign" in the top right to start a new adventure!</p>
        </div>`;
      return;
    }

    campaigns.forEach(camp => {
      const dateStr = new Date(camp.created_at).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const card = document.createElement('div');
      card.className = 'campaign-card glass-card';
      
      const safeTitle = escapeHtml(camp.title);
      const safeGenre = escapeHtml(camp.genre);
      const safeSummary = escapeHtml(camp.summary || 'Setting up adventure...');
      
      card.innerHTML = DOMPurify.sanitize(`
        <div>
          <div class="camp-genre">${safeGenre}</div>
          <h3 class="camp-title">${safeTitle}</h3>
          <p class="camp-summary">${safeSummary}</p>
        </div>
        <div class="camp-footer">
          <span>Created: ${dateStr}</span>
          <button class="btn btn-danger btn-sm delete-camp-btn" data-id="${camp.id}" onclick="event.stopPropagation(); deleteCampaign(${camp.id})">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>`);

      card.addEventListener('click', () => loadCampaign(camp.id));
      campaignListContainer.appendChild(card);
    });
  } catch (err) {
    campaignListContainer.innerHTML = DOMPurify.sanitize(`<div class="empty-state text-danger"><i class="fa-solid fa-circle-exclamation"></i> Error loading campaigns: ${escapeHtml(err.message)}</div>`);
  }
}

// Load a specific campaign state
async function loadCampaign(campaignId) {
  campaignMenuScreen.style.display = 'none';
  showLoadingOverlay('Resuming campaign state...');

  try {
    const response = await fetchWithTimeout(`/api/campaigns/${campaignId}`);
    if (!response.ok) throw new Error(response.status === 401 ? 'Unauthorized. Check Access Token.' : 'Failed to load campaign data');

    const gameState = await response.json();
    currentCampaignId = campaignId;
    renderGame(gameState, true);
  } catch (error) {
    showToast(`Load Error: ${error.message}`, 'error');
    campaignMenuScreen.style.display = 'flex';
  } finally {
    hideLoadingOverlay();
  }
}

// Delete campaign
window.deleteCampaign = async function (campaignId) {
  if (!confirm('Are you sure you want to delete this campaign? All history will be lost.')) return;

  try {
    const response = await fetchWithTimeout(`/api/campaigns/${campaignId}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Delete request failed');
    loadCampaignsMenu();
    showToast('Campaign deleted.', 'info');
  } catch (err) {
    showToast(`Delete Error: ${err.message}`, 'error');
  }
};

// Render whole UI from state response
function renderGame(gameState, resetNarrative = false) {
  mainGameScreen.style.display = 'grid';

  // Apply layout diagnostics toggle
  applyLayoutMode();

  // Apply genre HSL colors dynamically
  if (gameState.themeColors) {
    applyCampaignTheme(gameState.genre, gameState.themeColors);
  }

  // Update Quest Details (Sanitized)
  activeQuestTitle.textContent = gameState.currentQuest.active_quest || 'Main Quest';
  activeQuestDesc.textContent = gameState.currentQuest.quest_description || '';
  activeActBadge.textContent = `Act ${gameState.currentAct || 1}`;

  // Update Outline List
  renderOutline(gameState.outline, gameState.currentAct);

  // Update Character Sheet (Sanitized)
  const char = gameState.character;
  charName.textContent = char.name;
  charClass.textContent = char.class;
  charLevel.textContent = char.level;

  healthText.textContent = `${char.health}/${char.max_health}`;
  const hpPercent = char.max_health > 0 ? Math.max(0, Math.min(100, (char.health / char.max_health) * 100)) : 0;
  healthFill.style.width = `${hpPercent}%`;

  manaText.textContent = `${char.mana}/${char.max_mana}`;
  const manaPercent = char.max_mana > 0 ? Math.max(0, Math.min(100, (char.mana / char.max_mana) * 100)) : 0;
  manaFill.style.width = `${manaPercent}%`;

  const relativeXp = char.xp % 100;
  xpText.textContent = `${relativeXp}/100`;
  xpFill.style.width = `${relativeXp}%`;

  // Attributes
  attrStr.textContent = char.attributes.strength || 10;
  attrAgi.textContent = char.attributes.agility || 10;
  attrInt.textContent = char.attributes.intellect || 10;
  attrWil.textContent = char.attributes.willpower || 10;

  // Inventory
  renderInventory(char.inventory);

  // Render Codex (NPC Dossiers)
  renderCodex(gameState.npcs || []);

  // Graphic illustration (Sanitized using DOMPurify SVG profile)
  if (gameState.turn.svg) {
    const cleanSvg = DOMPurify.sanitize(gameState.turn.svg, { USE_PROFILES: { svg: true } });
    visualizerFrame.innerHTML = cleanSvg;
  }

  // Text narrative
  if (resetNarrative) {
    narrativeContainer.innerHTML = '';
    appendDMDialogue(gameState.turn.narrative);
  } else {
    appendDMDialogue(gameState.turn.narrative);
  }

  // Suggested choices
  renderChoices(gameState.turn.suggestedChoices || []);
}

// Generate HSL styles and apply class theme
function applyCampaignTheme(genre, colors) {
  document.body.className = '';
  
  const primary = colors.primary.trim();
  const secondary = colors.secondary.trim();
  const background = colors.background.trim();

  document.documentElement.style.setProperty('--theme-primary', primary);
  document.documentElement.style.setProperty('--theme-secondary', secondary);
  document.documentElement.style.setProperty('--theme-bg', background);

  const bgParts = background.match(/\d+/g);
  if (bgParts && bgParts.length >= 3) {
    const h = bgParts[0];
    const s = bgParts[1];
    const l = Math.min(95, parseInt(bgParts[2]) + 4);
    document.documentElement.style.setProperty('--theme-panel', `${h}, ${s}%, ${l}%`);
    document.documentElement.style.setProperty('--theme-border', `${h}, ${s}%, ${l + 8}%`);
  }

  const genreLower = genre.toLowerCase();
  if (genreLower.includes('cyber') || genreLower.includes('punk') || genreLower.includes('synth')) {
    document.body.classList.add('theme-cyberpunk');
  } else if (genreLower.includes('fantas') || genreLower.includes('magic') || genreLower.includes('elven')) {
    document.body.classList.add('theme-fantasy');
  } else if (genreLower.includes('horror') || genreLower.includes('gothic') || genreLower.includes('vampire') || genreLower.includes('blood')) {
    document.body.classList.add('theme-horror');
  } else if (genreLower.includes('space') || genreLower.includes('star') || genreLower.includes('sci-fi') || genreLower.includes('orbit')) {
    document.body.classList.add('theme-scifi');
  } else {
    document.body.classList.add('theme-default');
  }
}

// Render campaign outline in the sidebar
function renderOutline(outline, activeAct = 1) {
  campaignOutlineList.innerHTML = '';
  if (!outline || !outline.acts) return;

  outline.acts.forEach(act => {
    const actCard = document.createElement('div');
    const isActive = act.act === activeAct;
    const isCompleted = act.act < activeAct;

    actCard.className = `outline-act-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`;
    actCard.style.opacity = isCompleted ? '0.5' : isActive ? '1' : '0.6';
    actCard.style.borderLeft = isActive ? '2px solid hsl(var(--theme-primary))' : 'none';
    actCard.style.paddingLeft = isActive ? '8px' : '0';

    const safeTitle = escapeHtml(act.title);
    const safeObj = escapeHtml(act.objective);

    const htmlContent = DOMPurify.sanitize(`
      <div class="outline-act-hdr">
        <span>Act ${act.act}</span>
        ${isActive ? '<span class="text-success" style="font-size: 9px;"><i class="fa-solid fa-spinner fa-spin"></i> Active</span>' : ''}
        ${isCompleted ? '<span class="text-primary" style="font-size: 9px;"><i class="fa-solid fa-circle-check"></i> Completed</span>' : ''}
      </div>
      <div class="outline-act-title" style="color: ${isActive ? '#fff' : 'inherit'};">${safeTitle}</div>
      <div class="outline-act-obj" style="font-size: 11px;">${safeObj}</div>
    `);

    actCard.innerHTML = htmlContent;
    campaignOutlineList.appendChild(actCard);
  });
}

// Render items in inventory
function renderInventory(items) {
  inventoryContainer.innerHTML = '';
  if (!items || items.length === 0) {
    inventoryContainer.innerHTML = `<div style="font-size: 12px; color: hsl(var(--theme-text-dim)); padding: 8px;">Inventory empty.</div>`;
    return;
  }

  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'inventory-item';
    
    let icon = 'fa-suitcase';
    if (item.type === 'weapon') icon = 'fa-sword';
    else if (item.type === 'armor') icon = 'fa-shield-halved';
    else if (item.type === 'consumable') icon = 'fa-flask';
    else if (item.type === 'key') icon = 'fa-key';

    const safeName = escapeHtml(item.name);
    const safeStats = escapeHtml(item.stats || item.description || '');

    const htmlContent = DOMPurify.sanitize(`
      <i class="fa-solid ${icon} text-primary" style="font-size: 14px;"></i>
      <div class="inventory-item-details">
        <div class="inventory-item-name">${safeName}</div>
        <div class="inventory-item-desc">${safeStats}</div>
      </div>
      ${item.quantity > 1 ? `<span class="inventory-item-qty">${item.quantity}</span>` : ''}
    `);

    div.innerHTML = htmlContent;
    div.addEventListener('click', () => {
      showToast(`${item.name} (${item.type})\n\n${item.description}\n${item.stats ? `Stats: ${item.stats}` : ''}`, 'info');
    });

    inventoryContainer.appendChild(div);
  });
}

// Render character Codex dossiers
function renderCodex(npcs) {
  codexContainer.innerHTML = '';
  
  if (!npcs || npcs.length === 0) {
    codexContainer.innerHTML = `<div style="font-size: 12px; color: hsl(var(--theme-text-dim)); padding: 8px;">No character details recorded.</div>`;
    return;
  }

  npcs.forEach(npc => {
    const card = document.createElement('div');
    card.className = 'npc-card';

    const relationVal = npc.relationship_value || 0;
    let relClass = 'relation-neutral';
    let relLabel = 'Neutral';

    if (relationVal > 60) {
      relClass = 'relation-crush';
      relLabel = 'Crush / Devoted';
    } else if (relationVal > 15) {
      relClass = 'relation-ally';
      relLabel = 'Friendly / Ally';
    } else if (relationVal < -60) {
      relClass = 'relation-enemy';
      relLabel = 'Enemy / Nemesis';
    } else if (relationVal < -15) {
      relClass = 'relation-grudge';
      relLabel = 'Dislikes / Grudge';
    }

    const statusClass = `status-${(npc.status || 'alive').toLowerCase()}`;
    const safeName = escapeHtml(npc.name);
    const safeRole = escapeHtml(npc.role || 'Supporting Character');
    const safePersonality = escapeHtml(npc.personality || 'Unknown');
    const safeQuirks = escapeHtml(npc.quirks || 'No visible habits');
    const safeNotes = escapeHtml(npc.notes || 'No notes.');

    const htmlContent = DOMPurify.sanitize(`
      <div class="npc-header">
        <div class="npc-title-area">
          <div class="npc-name">${safeName}</div>
          <div class="npc-role">${safeRole}</div>
        </div>
        <span class="npc-status ${statusClass}">${npc.status || 'alive'}</span>
      </div>
      <div class="npc-relations">
        <span class="relation-label">Opinion:</span>
        <span class="relation-badge ${relClass}">${relLabel} (${relationVal})</span>
      </div>
      <div class="npc-details">
        <div class="npc-details-field">
          <strong>Personality Profile</strong>
          <span>${safePersonality}</span>
        </div>
        <div class="npc-details-field">
          <strong>Unique Quirks</strong>
          <span>${safeQuirks}</span>
        </div>
        <div class="npc-details-field">
          <strong>Interaction Logs</strong>
          <span class="notes-history">${safeNotes}</span>
        </div>
      </div>
    `);

    card.innerHTML = htmlContent;
    codexContainer.appendChild(card);
  });
}

// Render dynamic action buttons
function renderChoices(choices) {
  suggestedChoicesContainer.innerHTML = '';
  choices.forEach(choice => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.textContent = choice;
    btn.title = choice;
    btn.addEventListener('click', () => {
      actionInput.value = choice;
      actionForm.dispatchEvent(new Event('submit'));
    });
    suggestedChoicesContainer.appendChild(btn);
  });
}

// Dialog input handlers
function setActionInputState(enabled) {
  actionInput.disabled = !enabled;
  btnSendAction.disabled = !enabled;
  
  if (enabled) {
    btnSendAction.innerHTML = '<span>Send</span> <i class="fa-solid fa-paper-plane"></i>';
    actionInput.focus();
  } else {
    btnSendAction.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
  }
}

// Append player bubble
function appendPlayerAction(text) {
  const el = document.createElement('div');
  el.className = 'log-entry log-player';
  const cleanPlayerText = escapeHtml(text);
  
  el.innerHTML = DOMPurify.sanitize(`
    <div class="speaker"><i class="fa-solid fa-user"></i> You</div>
    <div class="content">${cleanPlayerText}</div>
  `);
  narrativeContainer.appendChild(el);
  scrollToBottom();
}

// Append DM description with markdown support and DOMPurify sanitization
function appendDMDialogue(markdownText) {
  const el = document.createElement('div');
  el.className = 'log-entry log-dm';

  const htmlContent = marked.parse(markdownText);
  const cleanHtml = DOMPurify.sanitize(htmlContent);

  el.innerHTML = `
    <div class="speaker"><i class="fa-solid fa-dice-d20"></i> Dungeon Master</div>
    <div class="content">${cleanHtml}</div>
  `;
  narrativeContainer.appendChild(el);
  scrollToBottom();
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}

function scrollToBottom() {
  setTimeout(() => {
    narrativeContainer.scrollTop = narrativeContainer.scrollHeight;
  }, 50);
}

// UI Overlays
function showLoadingOverlay(msg) {
  loadingMessage.textContent = msg;
  loadingOverlay.style.display = 'flex';
}
function hideLoadingOverlay() {
  loadingOverlay.style.display = 'none';
}

function showToast(msg, type = 'info') {
  const toast = document.createElement('div');
  toast.style.position = 'fixed';
  toast.style.bottom = '24px';
  toast.style.right = '24px';
  toast.style.padding = '12px 24px';
  toast.style.borderRadius = '8px';
  toast.style.color = '#fff';
  toast.style.fontFamily = 'var(--font-title)';
  toast.style.fontWeight = '600';
  toast.style.fontSize = '13px';
  toast.style.zIndex = '1000';
  toast.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)';
  toast.style.animation = 'slide-up 0.3s ease-out';
  
  if (type === 'success') toast.style.background = 'hsl(140, 70%, 35%)';
  else if (type === 'error') toast.style.background = 'hsl(0, 70%, 45%)';
  else toast.style.background = 'hsl(210, 50%, 25%)';

  // Format linebreaks in toast
  toast.innerText = msg;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.5s';
    setTimeout(() => toast.remove(), 500);
  }, 4000);
}
