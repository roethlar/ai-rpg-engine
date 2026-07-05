/**
 * AETHERIA GM FRONTEND APPLICATION
 */

// Application state
let currentCampaignId = null;
let currentCampaignTitle = '';
let savedCharacters = [];
// Player-appropriate settings only: AI provider/model/keys are server-owned
// (decision 2026-06-11) and configured by the operator at /admin.
const DEFAULT_API_CONFIG = {
  accessToken: '', // Authentication token
  enableDiagnostics: false, // Dev mode flag
  voiceNarration: false,
  voiceName: 'marin',
  voiceInstructions: 'Narrate as an atmospheric game master. Keep the delivery clear, tense, and cinematic without overacting.'
};
let apiConfig = { ...DEFAULT_API_CONFIG };

const CAMPAIGN_CREATE_TIMEOUT_MS = 300000;
const TURN_TIMEOUT_MS = 420000;

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
const btnMenuSettings = document.getElementById('btn-menu-settings');
const selectCharacterMode = document.getElementById('select-character-mode');
const savedCharacterGroup = document.getElementById('saved-character-group');
const selectSavedCharacter = document.getElementById('select-saved-character');
const savedCharacterSummary = document.getElementById('saved-character-summary');
const newCharacterFields = document.getElementById('new-character-fields');
const inputCharName = document.getElementById('input-char-name');
const inputCharConcept = document.getElementById('input-char-concept');

// Settings Inputs
const inputAccessToken = document.getElementById('input-access-token');
const checkboxDiagnostics = document.getElementById('input-enable-diagnostics');
const checkboxVoiceNarration = document.getElementById('input-enable-voice-narration');
const voiceSettingsGroup = document.getElementById('voice-settings-group');
const selectVoiceName = document.getElementById('select-voice-name');
const inputVoiceInstructions = document.getElementById('input-voice-instructions');

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
const charAbilities = document.getElementById('char-abilities');

// Tab Switchers
const rightTabsHeader = document.getElementById('right-tabs-header');
const rightPanelHeading = document.getElementById('right-panel-heading');
const tabInventoryBtn = document.getElementById('tab-inventory-btn');
const tabJournalBtn = document.getElementById('tab-journal-btn');
const tabCodexBtn = document.getElementById('tab-codex-btn');
const tabRulesBtn = document.getElementById('tab-rules-btn');
const tabContentRules = document.getElementById('tab-content-rules');
const tabContentInventory = document.getElementById('tab-content-inventory');
const tabContentJournal = document.getElementById('tab-content-journal');
const tabContentCodex = document.getElementById('tab-content-codex');
const journalSearchInput = document.getElementById('journal-search-input');
const journalTimelineContainer = document.getElementById('journal-timeline-container');

// Attributes
const attrStr = document.getElementById('attr-str');
const attrAgi = document.getElementById('attr-agi');
const attrInt = document.getElementById('attr-int');
const attrWil = document.getElementById('attr-wil');

// Illustration
const visualizerFrame = document.getElementById('visualizer-frame');
let currentNarrationAudio = null;
let voiceErrorShown = false;

// Init application on load
window.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  setupEventListeners();
  loadCampaignsMenu();
  
  // Close modals on Escape key press
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      settingsModal.style.display = 'none';
      campaignWizardModal.style.display = 'none';
    }
  });
});

// Load config from localStorage
function loadSettings() {
  const saved = localStorage.getItem('aetheria_settings');
  let savedConfig = {};
  if (saved) {
    try {
      savedConfig = JSON.parse(saved);
    } catch (e) {
      console.error('Error parsing settings', e);
    }
  }
  apiConfig = normalizeApiConfig(savedConfig);

  // Populate form elements
  inputAccessToken.value = apiConfig.accessToken || '';
  checkboxDiagnostics.checked = !!apiConfig.enableDiagnostics;
  checkboxVoiceNarration.checked = !!apiConfig.voiceNarration;
  selectVoiceName.value = apiConfig.voiceName || 'marin';
  inputVoiceInstructions.value = apiConfig.voiceInstructions || '';

  toggleVoiceSettings();
}

// Save config to localStorage
function saveSettings() {
  apiConfig.accessToken = inputAccessToken.value.trim();
  apiConfig.enableDiagnostics = checkboxDiagnostics.checked;
  apiConfig.voiceNarration = checkboxVoiceNarration.checked;
  apiConfig.voiceName = selectVoiceName.value || 'marin';
  apiConfig.voiceInstructions = inputVoiceInstructions.value.trim();

  localStorage.setItem('aetheria_settings', JSON.stringify(apiConfig));

  if (currentCampaignId) {
    applyLayoutMode();
  }
}

// Picks only known player settings, dropping stale AI config that older
// versions of this app stored in localStorage.
function normalizeApiConfig(raw = {}) {
  const merged = { ...DEFAULT_API_CONFIG };
  for (const key of Object.keys(DEFAULT_API_CONFIG)) {
    if (raw[key] !== undefined) merged[key] = raw[key];
  }
  return merged;
}

function toggleVoiceSettings() {
  voiceSettingsGroup.style.display = checkboxVoiceNarration.checked ? 'block' : 'none';
}

// Dynamic spotlight (Phase 1 slice, Layout D): promote one surface to the
// stage; the rest demote to a compact rail. Same target toggles off; Esc restores.
function setSpotlight(target) {
  const next = mainGameScreen.dataset.focus === target ? null : target;
  if (next) {
    mainGameScreen.dataset.focus = next;
  } else {
    delete mainGameScreen.dataset.focus;
  }
  document.querySelectorAll('.spotlight-btn').forEach(btn => {
    btn.setAttribute('aria-pressed', String(btn.dataset.spotlight === next));
  });
}

function openSettingsModal() {
  loadSettings();
  settingsModal.style.display = 'flex';
}

async function getResponseErrorMessage(response, fallbackMessage) {
  const errorText = await response.text();
  if (!errorText) return fallbackMessage;
  try {
    const parsed = JSON.parse(errorText);
    return parsed.error || fallbackMessage;
  } catch (e) {
    return errorText;
  }
}

function shouldOpenSettingsForError(message) {
  return /api key|authorization key|access token|configured|unauthorized/i.test(message || '');
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

  // Keep rightTabsHeader always visible in our new layout
  rightTabsHeader.style.display = 'flex';
  rightPanelHeading.style.display = 'none';

  if (apiConfig.enableDiagnostics) {
    mainGameScreen.classList.remove('immersive-layout');
    leftPanel.style.display = 'flex';
    tabCodexBtn.style.display = 'block';
  } else {
    mainGameScreen.classList.add('immersive-layout');
    leftPanel.style.display = 'none';
    tabCodexBtn.style.display = 'none';
    
    // Fallback active right-tab content back to Inventory if Codex was active
    if (tabCodexBtn.classList.contains('active')) {
      setActiveTab('inventory');
    }
  }
}

// Helper to swap active tab content in the right sidebar
function setActiveTab(tab) {
  tabInventoryBtn.classList.remove('active');
  tabJournalBtn.classList.remove('active');
  tabCodexBtn.classList.remove('active');
  tabRulesBtn.classList.remove('active');

  tabContentInventory.style.display = 'none';
  tabContentJournal.style.display = 'none';
  tabContentCodex.style.display = 'none';
  tabContentRules.style.display = 'none';

  if (tab === 'rules') {
    tabRulesBtn.classList.add('active');
    tabContentRules.style.display = 'flex';
  } else if (tab === 'inventory') {
    tabInventoryBtn.classList.add('active');
    tabContentInventory.style.display = 'flex';
  } else if (tab === 'journal') {
    tabJournalBtn.classList.add('active');
    tabContentJournal.style.display = 'flex';
    loadJournalTimeline();
  } else if (tab === 'codex') {
    tabCodexBtn.classList.add('active');
    tabContentCodex.style.display = 'flex';
  }
}

// Bind UI triggers
function setupEventListeners() {
  // Settings buttons
  document.getElementById('btn-show-settings').addEventListener('click', openSettingsModal);
  btnMenuSettings.addEventListener('click', openSettingsModal);
  document.getElementById('btn-close-settings').addEventListener('click', () => settingsModal.style.display = 'none');
  document.getElementById('btn-cancel-settings').addEventListener('click', () => settingsModal.style.display = 'none');

  checkboxVoiceNarration.addEventListener('change', toggleVoiceSettings);
  document.getElementById('btn-voice-preview').addEventListener('click', previewVoice);
  document.getElementById('btn-skip-narration').addEventListener('click', stopNarration);

  // Spotlight controls
  document.querySelectorAll('.spotlight-btn').forEach(btn => {
    btn.addEventListener('click', () => setSpotlight(btn.dataset.spotlight));
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mainGameScreen.dataset.focus) {
      setSpotlight(mainGameScreen.dataset.focus);
    }
  });

  settingsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    saveSettings();
    settingsModal.style.display = 'none';
    showToast('Settings saved.', 'success');
  });

  // Right Panel tab swapping
  tabInventoryBtn.addEventListener('click', () => setActiveTab('inventory'));
  tabJournalBtn.addEventListener('click', () => setActiveTab('journal'));
  tabCodexBtn.addEventListener('click', () => setActiveTab('codex'));
  tabRulesBtn.addEventListener('click', () => setActiveTab('rules'));

  // Journal Timeline search filter
  journalSearchInput.addEventListener('input', () => {
    filterJournalTimeline();
  });

  // Campaigns lists buttons
  document.getElementById('btn-show-campaigns').addEventListener('click', () => {
    loadCampaignsMenu();
    campaignMenuScreen.style.display = 'flex';
  });

  // Campaign create wizard
  document.getElementById('btn-new-campaign-trigger').addEventListener('click', () => {
    openCampaignWizard();
  });
  selectCharacterMode.addEventListener('change', updateCharacterModeUi);
  selectSavedCharacter.addEventListener('change', renderSavedCharacterSummary);
  document.getElementById('btn-close-wizard').addEventListener('click', closeCampaignWizard);
  document.getElementById('btn-cancel-wizard').addEventListener('click', closeCampaignWizard);

  campaignCreateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const genre = document.getElementById('input-genre').value.trim();
    const characterMode = selectCharacterMode.value;
    const selectedProfileId = Number(selectSavedCharacter.value || 0);
    const rulesMode = document.getElementById('input-rules-mode').checked;
    const body = {
      genre,
      characterMode,
      rulesMode,
      ruleset: document.getElementById('select-ruleset').value,
      tableStyle: {
        helpfulness: document.getElementById('select-helpfulness').value,
        pacing: document.getElementById('select-pacing').value
      }
    };

    if (characterMode === 'new') {
      body.characterName = inputCharName.value.trim();
      body.characterClass = inputCharConcept.value.trim();
      if (!body.characterName || !body.characterClass) {
        showToast('Enter a character name and concept.', 'error');
        return;
      }
    } else {
      if (!selectedProfileId) {
        showToast('Choose a saved character profile.', 'error');
        return;
      }
      body.characterProfileId = selectedProfileId;
    }

    closeCampaignWizard();
    showLoadingOverlay(`Game Master is crafting your campaign...\nCreating outline, character state, acts, NPCs, and initial scene.`);

    try {
      const response = await fetchWithTimeout('/api/campaigns', {
        method: 'POST',
        body: JSON.stringify(body)
      }, CAMPAIGN_CREATE_TIMEOUT_MS);

      if (!response.ok) {
        const message = await getResponseErrorMessage(response, 'Server failed to start campaign');
        throw new Error(message);
      }

      const gameState = await response.json();
      currentCampaignId = gameState.campaignId;
      renderGame(gameState, true, { narrate: true });
      campaignMenuScreen.style.display = 'none';
    } catch (error) {
      console.error(error);
      showToast(`Initialization Error: ${error.message}`, 'error');
      if (shouldOpenSettingsForError(error.message)) {
        openSettingsModal();
      }
      loadCampaignsMenu();
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
    turnSubmitInFlight = true;

    try {
      const response = await fetchWithTimeout(`/api/campaigns/${currentCampaignId}/turn`, {
        method: 'POST',
        body: JSON.stringify({
          playerAction: actionText,
          // Which character is speaking (Phase 3 M2/M3); harmless when solo
          characterId: myCharacterId ?? undefined
        })
      }, TURN_TIMEOUT_MS);

      if (!response.ok) {
        // Turn-order rejections (M2) are game rulings, not provider
        // failures: say whose turn it is, restore the input, and stop —
        // no "retry the connection" framing.
        const body = await response.json().catch(() => ({}));
        if (body.code === 'OUT_OF_TURN' || body.code === 'CHARACTER_REQUIRED') {
          appendSystemNotice(body.error || 'It is not your turn to act.');
          actionInput.value = actionText;
          actionInput.focus();
          return;
        }
        throw new Error(body.error || 'Failed to submit action');
      }

      const gameState = await response.json();
      renderGame(gameState, false, { narrate: true });
    } catch (error) {
      console.error(error);
      // Decision 2026-07-03: transient failures surface OUTSIDE the GM's voice
      // as a retriable state, with the player's typed input restored.
      appendSystemNotice(`The connection to the AI provider failed (${error.message}). Your action was not lost — it has been restored below. Press send to retry.`);
      actionInput.value = actionText;
      actionInput.focus();
      if (shouldOpenSettingsForError(error.message)) {
        openSettingsModal();
      }
    } finally {
      turnSubmitInFlight = false;
      setActionInputState(true);
    }
  });
}

// Renders the campaign's canon rule sheet + table-style dials into the
// Rules tab. The dials (Phase D) are adjustable mid-campaign and show even
// for freeform campaigns.
function renderRules(ruleset, tableStyle) {
  if (!ruleset && !tableStyle) {
    tabRulesBtn.style.display = 'none';
    if (tabRulesBtn.classList.contains('active')) setActiveTab('inventory');
    return;
  }
  tabRulesBtn.style.display = 'block';
  const rulesContainer = document.getElementById('rules-container');
  // Re-render only when the underlying state changed: every renderGame call
  // hits this, and rebuilding unconditionally would reset the dial selects
  // while the player is choosing (or right after Apply, before the next
  // turn carries the new values back).
  const signature = JSON.stringify({ ruleset, tableStyle });
  if (rulesContainer.dataset.signature === signature) return;
  rulesContainer.dataset.signature = signature;
  const abilities = ruleset ? (ruleset.abilities || []).map(a => `
    <div class="rules-ability">
      <div class="rules-ability-head"><strong>${escapeHtml(a.name)}</strong><span class="rules-cost">${escapeHtml(a.cost)}</span></div>
      <div class="rules-effect">${escapeHtml(a.effect)}</div>
      <div class="rules-limits"><i class="fa-solid fa-ban"></i> ${escapeHtml(a.limits)}</div>
    </div>`).join('') : '';
  const styleBlock = tableStyle ? `
    <div class="rules-section-label">Table Style</div>
    <div class="table-style-row">
      <label>GM Style
        <select id="rules-helpfulness">
          <option value="classic">Classic</option>
          <option value="helpful">Helpful</option>
          <option value="hardline">Hardline</option>
        </select>
      </label>
      <label>Pacing
        <select id="rules-pacing">
          <option value="standard">Standard</option>
          <option value="slow_burn">Slow burn</option>
          <option value="action_heavy">Action-heavy</option>
          <option value="player_driven">Player-driven</option>
        </select>
      </label>
      <button type="button" class="btn btn-secondary" id="btn-save-table-style">Apply</button>
    </div>
    <span class="form-tip">Takes effect next turn. Pacing limits what the GM initiates, never what you may do.</span>` : '';
  rulesContainer.innerHTML = DOMPurify.sanitize(`
    ${ruleset ? `<div class="rules-title">${escapeHtml(ruleset.name)}</div>` : ''}
    ${ruleset?.resolution ? `<p class="rules-resolution">${escapeHtml(ruleset.resolution)}</p>` : ''}
    ${styleBlock}
    ${abilities ? `<div class="rules-section-label">Abilities &amp; Spells</div>${abilities}` : ''}
    ${ruleset?.notes ? `<div class="rules-section-label">House Notes</div><p class="rules-notes">${escapeHtml(ruleset.notes)}</p>` : ''}
  `);
  if (tableStyle) {
    rulesContainer.querySelector('#rules-helpfulness').value = tableStyle.helpfulness;
    rulesContainer.querySelector('#rules-pacing').value = tableStyle.pacing;
    rulesContainer.querySelector('#btn-save-table-style').addEventListener('click', async () => {
      try {
        const response = await fetchWithTimeout(`/api/campaigns/${currentCampaignId}/table-style`, {
          method: 'POST',
          body: JSON.stringify({
            helpfulness: rulesContainer.querySelector('#rules-helpfulness').value,
            pacing: rulesContainer.querySelector('#rules-pacing').value
          })
        });
        if (!response.ok) throw new Error(await getResponseErrorMessage(response, 'Failed to save'));
        showToast('Table style applied — takes effect next turn.', 'success');
      } catch (error) {
        showToast(`Table style: ${error.message}`, 'error');
      }
    });
  }
}

// Voice preview: audition the selected voice + direction on a sample line
// without spending a game turn. Uses the current (unsaved) form values.
async function previewVoice() {
  const btn = document.getElementById('btn-voice-preview');
  btn.disabled = true;
  try {
    const response = await fetchWithTimeout('/api/audio/narrate', {
      method: 'POST',
      body: JSON.stringify({
        text: 'The torchlight gutters as you step into the vault. Whatever slept here is awake now — and it knows your name.',
        audioConfig: {
          voice: selectVoiceName.value,
          instructions: inputVoiceInstructions.value.trim()
        }
      })
    }, 60000);
    if (!response.ok) {
      throw new Error(await getResponseErrorMessage(response, 'Voice preview failed'));
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const audio = new Audio(objectUrl);
    audio.addEventListener('ended', () => URL.revokeObjectURL(objectUrl), { once: true });
    await audio.play();
  } catch (error) {
    showToast(`Voice preview: ${error.message}`, 'error');
  } finally {
    btn.disabled = false;
  }
}

// A system/out-of-fiction notice in the narrative log — never the GM's voice.
function appendSystemNotice(message) {
  const el = document.createElement('div');
  el.className = 'log-entry log-system';
  el.innerHTML = DOMPurify.sanitize(`
    <div class="speaker"><i class="fa-solid fa-triangle-exclamation"></i> System</div>
    <div class="content">${escapeHtml(message)}</div>
  `);
  narrativeContainer.appendChild(el);
  scrollToBottom();
}

function openCampaignWizard() {
  selectCharacterMode.value = 'new';
  updateCharacterModeUi();
  loadCharactersForWizard();
  campaignWizardModal.style.display = 'flex';
}

function closeCampaignWizard() {
  campaignWizardModal.style.display = 'none';
}

async function loadCharactersForWizard() {
  savedCharacterSummary.textContent = '';
  if (selectCharacterMode.value !== 'new') {
    savedCharacterSummary.textContent = 'Loading saved characters...';
  }

  try {
    const response = await fetchWithTimeout('/api/characters', {}, 15000);
    if (!response.ok) {
      const message = await getResponseErrorMessage(response, 'Could not load saved characters');
      throw new Error(message);
    }
    savedCharacters = await response.json();
    updateCharacterModeUi();
  } catch (error) {
    console.error(error);
    savedCharacters = [];
    if (selectCharacterMode.value !== 'new') {
      savedCharacterSummary.textContent = `Could not load saved characters: ${error.message}`;
    }
  }
}

function updateCharacterModeUi() {
  const mode = selectCharacterMode.value;
  const isNew = mode === 'new';

  newCharacterFields.style.display = isNew ? 'flex' : 'none';
  savedCharacterGroup.style.display = isNew ? 'none' : 'block';
  inputCharName.disabled = !isNew;
  inputCharConcept.disabled = !isNew;
  inputCharName.required = isNew;
  inputCharConcept.required = isNew;

  if (!isNew) {
    populateSavedCharacterSelect(mode);
  }
}

function populateSavedCharacterSelect(mode) {
  selectSavedCharacter.innerHTML = '';

  if (savedCharacters.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No saved characters yet';
    option.disabled = true;
    option.selected = true;
    selectSavedCharacter.appendChild(option);
    savedCharacterSummary.textContent = 'Create a new character first, then future campaigns can reuse or copy them.';
    return;
  }

  let firstUsableValue = '';
  savedCharacters.forEach(character => {
    const option = document.createElement('option');
    const unavailable = mode === 'existing' && character.status !== 'available';
    option.value = String(character.id);
    option.disabled = unavailable;
    option.textContent = formatCharacterOption(character, unavailable);
    selectSavedCharacter.appendChild(option);

    if (!unavailable && !firstUsableValue) {
      firstUsableValue = option.value;
    }
  });

  selectSavedCharacter.value = firstUsableValue;
  renderSavedCharacterSummary();
}

function formatCharacterOption(character, unavailable) {
  const status = unavailable
    ? `checked out: ${character.active_campaign_title || 'active campaign'}`
    : character.status;
  return `${character.name} - ${character.archetype} (Level ${character.level}, ${status})`;
}

function renderSavedCharacterSummary() {
  const selected = savedCharacters.find(character => String(character.id) === selectSavedCharacter.value);
  if (!selected) {
    savedCharacterSummary.textContent = selectCharacterMode.value === 'existing'
      ? 'No available saved character can be checked out right now. Use copy to branch one.'
      : 'Choose a character profile to copy.';
    return;
  }

  const abilityText = selected.abilities && selected.abilities.length > 0
    ? selected.abilities.map(ability => ability.name).join(', ')
    : 'No established abilities yet';
  const statusText = selected.status === 'available'
    ? 'Available'
    : `Checked out to ${selected.active_campaign_title || 'an active campaign'}`;
  savedCharacterSummary.textContent = `${statusText}. HP ${selected.health}/${selected.max_health}, Energy ${selected.mana}/${selected.max_mana}, XP ${selected.xp}. Abilities: ${abilityText}.`;
}

// Fetch list from DB and show in overlay menu
// Holodeck entry state (Phase H, owner intent 2026-06-13): before a program
// runs, the stage is deliberately blank — neutral engine idle, no campaign
// theme. Clears every inline theme/font override a previous campaign left.
function enterHolodeckIdle() {
  document.body.className = 'holodeck-idle';
  THEME_VAR_NAMES.forEach(name => {
    document.body.style.removeProperty(name);
    document.documentElement.style.removeProperty(name);
  });
  ['--font-title', '--font-body', '--font-dialogue'].forEach(name =>
    document.documentElement.style.removeProperty(name)
  );
}

async function loadCampaignsMenu() {
  // Leaving a campaign for the menu: stop the poll and drop per-campaign
  // state so a stale campaign can never render over the holodeck idle.
  currentCampaignId = null;
  lastGameState = null;
  lastRenderedTurnNumber = null;
  myCharacterId = null;
  enterHolodeckIdle();
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
      const safeCharacterName = escapeHtml(camp.character_name || '');
      const characterLine = camp.character_name
        ? `<div class="camp-character"><i class="fa-solid fa-user"></i> ${safeCharacterName}${camp.player_character_id ? '' : ' (released)'}</div>`
        : '';
      const releaseButton = camp.player_character_id
        ? `<button class="btn btn-secondary btn-sm release-camp-btn" title="Release character profile">
             <i class="fa-solid fa-person-walking-arrow-right"></i>
           </button>`
        : '';
      
      card.innerHTML = DOMPurify.sanitize(`
        <div>
          <div class="camp-genre">${safeGenre}</div>
          <h3 class="camp-title">${safeTitle}</h3>
          <p class="camp-summary">${safeSummary}</p>
          ${characterLine}
        </div>
        <div class="camp-footer">
          <span>Created: ${dateStr}</span>
          <div class="camp-actions">
            ${releaseButton}
            <button class="btn btn-danger btn-sm delete-camp-btn" title="Delete campaign">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>`);

      const releaseBtn = card.querySelector('.release-camp-btn');
      if (releaseBtn) {
        releaseBtn.addEventListener('click', (event) => {
          event.stopPropagation();
          releaseCampaignCharacter(camp.id);
        });
      }

      const deleteBtn = card.querySelector('.delete-camp-btn');
      deleteBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        deleteCampaign(camp.id);
      });

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

window.releaseCampaignCharacter = async function (campaignId) {
  if (!confirm('Release this campaign character profile for use in new campaigns? The current campaign keeps a local snapshot.')) return;

  try {
    const response = await fetchWithTimeout(`/api/campaigns/${campaignId}/release-character`, {
      method: 'POST'
    });
    if (!response.ok) {
      const message = await getResponseErrorMessage(response, 'Release request failed');
      throw new Error(message);
    }
    loadCampaignsMenu();
    showToast('Character profile released.', 'success');
  } catch (err) {
    showToast(`Release Error: ${err.message}`, 'error');
  }
};

// Render whole UI from state response
function renderGame(gameState, resetNarrative = false, options = {}) {
  mainGameScreen.style.display = 'grid';

  currentCampaignTitle = gameState.title || 'Adventure';

  // Apply layout diagnostics toggle
  applyLayoutMode();

  // Apply genre theme dynamically (colors + generated font pairing)
  if (gameState.themeColors) {
    applyCampaignTheme(gameState.genre, gameState.themeColors, gameState.themeFonts);
  }

  // Update Quest Details (Sanitized)
  activeQuestTitle.textContent = gameState.currentQuest.active_quest || 'Main Quest';
  activeQuestDesc.textContent = gameState.currentQuest.quest_description || '';
  activeActBadge.textContent = `Act ${gameState.currentAct || 1}`;

  // Update Outline List
  renderOutline(gameState.outline, gameState.currentAct);

  // Party & turn order (Phase 3 M3): who this browser plays, the party
  // strip, and the off-turn input state. The sheet shows YOUR character.
  lastGameState = gameState;
  lastRenderedTurnNumber = gameState.turn?.number ?? lastRenderedTurnNumber;
  resolveMyCharacter(gameState);
  renderParty(gameState);
  updateTurnBanner(gameState);
  renderCharacterSheet(displayedCharacter(gameState));

  // Render Codex (NPC Dossiers)
  renderCodex(gameState.npcs || []);

  // Campaign rule sheet + table-style dials (canon surfaces)
  renderRules(gameState.ruleset || null, gameState.tableStyle || null);

  // Graphic illustration (Sanitized using DOMPurify SVG profile)
  if (gameState.turn.svg) {
    const cleanSvg = DOMPurify.sanitize(gameState.turn.svg, { USE_PROFILES: { svg: true } });
    document.getElementById('visualizer-svg').innerHTML = cleanSvg;
  }

  // Heroic render (Phase V4): when the engine holds a heroic pointer, the
  // image takes the visualizer slot; the SVG stays as the fallback surface.
  updateHeroicImage(gameState.turn.heroic);

  // Situation surface (Phase V4): grounding text always; the deterministic
  // location map joins it when position matters (or when spotlighted).
  // A campaign switch clears it first so nothing bleeds between campaigns.
  if (resetNarrative) {
    resetSituationPanel();
  }
  renderSituation(gameState.turn);

  // Text narrative & roll checks
  if (resetNarrative) {
    narrativeContainer.innerHTML = '';
  }
  const turnRolls = Array.isArray(gameState.turn.rollResults)
    ? gameState.turn.rollResults
    : (gameState.turn.rollResult ? [gameState.turn.rollResult] : []);
  turnRolls.forEach(appendRollResultBubble);
  appendGMDialogue(gameState.turn.narrative);
  if (options.narrate) {
    narrateGmResponse(gameState.turn);
  }

  // Scene grounding — especially valuable on clarification turns
  if (gameState.turn.sceneGrounding) {
    appendSceneGrounding(gameState.turn.sceneGrounding);
  }

  // If the active tab is Journal, refresh the timeline
  if (tabJournalBtn.classList.contains('active')) {
    loadJournalTimeline();
  }

  // Suggested choices
  renderChoices(gameState.turn.suggestedChoices || []);
}

// Heroic image loader: the image route is authenticated, so the bytes are
// fetched with the access token and shown via an object URL (CSP allows
// blob: for img-src). Failures leave the previous visual in place.
let currentHeroicUrl = null;
let heroicRequestToken = 0;
async function updateHeroicImage(heroic) {
  const img = document.getElementById('heroic-image');
  const svgHost = document.getElementById('visualizer-svg');
  // Overlapping requests (fast campaign switches) must resolve in call
  // order, not completion order: stale responses are abandoned.
  const token = ++heroicRequestToken;
  if (!heroic || !heroic.imageUrl) {
    // This campaign/turn has no heroic: restore the SVG surface so a
    // previous campaign's render can never impersonate this one.
    if (img.dataset.objectUrl) {
      URL.revokeObjectURL(img.dataset.objectUrl);
      delete img.dataset.objectUrl;
    }
    img.removeAttribute('src');
    img.style.display = 'none';
    svgHost.style.display = '';
    currentHeroicUrl = null;
    return;
  }
  if (heroic.imageUrl === currentHeroicUrl) return;
  try {
    const response = await fetchWithTimeout(heroic.imageUrl, {}, 60000);
    if (!response.ok) throw new Error(`status ${response.status}`);
    const blob = await response.blob();
    if (token !== heroicRequestToken) return; // superseded while in flight
    if (img.dataset.objectUrl) URL.revokeObjectURL(img.dataset.objectUrl);
    const objectUrl = URL.createObjectURL(blob);
    img.src = objectUrl;
    img.dataset.objectUrl = objectUrl;
    img.style.display = 'block';
    svgHost.style.display = 'none';
    currentHeroicUrl = heroic.imageUrl;
  } catch (error) {
    console.warn(`Heroic render unavailable (${error.message}); keeping the current visual.`);
  }
}

// ---------------------------------------------------------------
// Party & turn order (Phase 3 M3): which character this browser plays,
// the party strip, the off-turn input state, and the join flow.
// ---------------------------------------------------------------
const DEFAULT_ACTION_PLACEHOLDER = "Act or ask the GM (e.g., 'Scan the corridor', 'Do I know this symbol?', 'Take cover')...";
let myCharacterId = null;
let lastGameState = null;
let lastRenderedTurnNumber = null;

function myCharacterKey(campaignId) {
  return `aetheria_my_character_${campaignId}`;
}

// Resolves which party member this browser plays: stored claim first, then
// the only member of a solo campaign, then a fresh join.
function resolveMyCharacter(gameState) {
  const party = gameState.party || [];
  const stored = Number(localStorage.getItem(myCharacterKey(currentCampaignId)));
  let mine = party.find(c => c.id === stored) || null;
  if (!mine && gameState.joinedCharacterId) {
    mine = party.find(c => c.id === gameState.joinedCharacterId) || null;
  }
  if (!mine && party.length === 1) mine = party[0];
  if (!mine && gameState.character?.id && party.length <= 1) mine = gameState.character;
  myCharacterId = mine ? mine.id : null;
  if (mine) localStorage.setItem(myCharacterKey(currentCampaignId), String(mine.id));
  return mine;
}

function renderParty(gameState) {
  const strip = document.getElementById('party-strip');
  const party = gameState.party || [];
  const actingId = gameState.turnOrder?.actingCharacterId ?? null;
  strip.style.display = '';
  strip.innerHTML = party.map(member => {
    const classes = ['party-member'];
    if (member.id === myCharacterId) classes.push('is-you');
    if (member.id === actingId) classes.push('is-acting');
    return `<button type="button" class="${classes.join(' ')}" data-character-id="${member.id}" title="Play as ${escapeHtml(member.name)}">` +
      `${member.id === actingId ? '<i class="fa-solid fa-circle-play"></i> ' : ''}${escapeHtml(member.name)}` +
      `${member.id === myCharacterId ? ' <span class="party-you">you</span>' : ''}` +
      `<span class="party-hp">${member.health}/${member.max_health}</span></button>`;
  }).join('') +
    `<button type="button" class="party-member party-join" id="party-join-btn" title="Join this table with a new character"><i class="fa-solid fa-user-plus"></i> Join</button>`;

  strip.querySelectorAll('.party-member[data-character-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      myCharacterId = Number(btn.dataset.characterId);
      localStorage.setItem(myCharacterKey(currentCampaignId), String(myCharacterId));
      if (lastGameState) renderPartyState(lastGameState);
    });
  });
  strip.querySelector('#party-join-btn').addEventListener('click', joinTableFlow);
}

async function joinTableFlow() {
  const name = window.prompt('Character name for this table:');
  if (!name || !name.trim()) return;
  const concept = window.prompt('Character concept (e.g. "Wry salvage pilot", "Disgraced court mage"):') || '';
  try {
    showLoadingOverlay('Joining the table...');
    const response = await fetchWithTimeout(`/api/campaigns/${currentCampaignId}/join`, {
      method: 'POST',
      body: JSON.stringify({ characterName: name.trim(), characterClass: concept.trim() })
    });
    if (!response.ok) throw new Error(await getResponseErrorMessage(response, 'Failed to join'));
    const state = await response.json();
    localStorage.setItem(myCharacterKey(currentCampaignId), String(state.joinedCharacterId));
    myCharacterId = state.joinedCharacterId;
    renderGame(state, false);
    appendSystemNotice(`${name.trim()} joins the table. The GM will meet them in the fiction on their first turn.`);
  } catch (error) {
    showToast(`Join failed: ${error.message}`, 'error');
  } finally {
    hideLoadingOverlay();
  }
}

// Off-turn state: the input stays enabled — table talk is always open — but
// says whose turn it is; committed actions come back rejected server-side.
function updateTurnBanner(gameState) {
  const order = gameState.turnOrder;
  const party = gameState.party || [];
  const offTurn = order && party.length > 1 && myCharacterId !== null && order.actingCharacterId !== myCharacterId;
  if (offTurn) {
    const actingName = order.order.find(entry => entry.id === order.actingCharacterId)?.name || 'another player';
    actionInput.placeholder = `Table talk — waiting for ${actingName} to act…`;
  } else {
    actionInput.placeholder = DEFAULT_ACTION_PLACEHOLDER;
  }
  actionForm.classList.toggle('off-turn', !!offTurn);
}

// Re-resolve identity-dependent surfaces without appending to the log.
function renderPartyState(gameState) {
  resolveMyCharacter(gameState);
  renderParty(gameState);
  updateTurnBanner(gameState);
  renderCharacterSheet(displayedCharacter(gameState));
}

function displayedCharacter(gameState) {
  const party = gameState.party || [];
  return party.find(c => c.id === myCharacterId) || gameState.character;
}

// Shared-table freshness (v1): poll for new turns so every browser sees the
// shared narrative without reloading. Runs for ANY loaded campaign — the
// founding browser must discover joiners, and its own lastGameState only
// changes when someone else acts (a stale party-size gate would never open).
let turnSubmitInFlight = false;
setInterval(async () => {
  if (!currentCampaignId || document.hidden || !lastGameState) return;
  // Never race an in-flight submit: the submit's own render owns that turn.
  if (turnSubmitInFlight) return;
  try {
    const response = await fetchWithTimeout(`/api/campaigns/${currentCampaignId}`, {}, 15000);
    if (turnSubmitInFlight) return; // submit started while we were fetching
    if (!response.ok) return;
    const state = await response.json();
    if (state.turn?.number !== lastRenderedTurnNumber) {
      // More than one turn may have landed between polls (table talk does
      // not advance the order, so bursts happen): backfill the gap from the
      // journal so the log stays complete, then render the latest normally.
      if (typeof lastRenderedTurnNumber === 'number' && state.turn.number > lastRenderedTurnNumber + 1) {
        try {
          const journalResponse = await fetchWithTimeout(`/api/campaigns/${currentCampaignId}/journal`, {}, 15000);
          if (journalResponse.ok) {
            const journal = await journalResponse.json();
            (journal.turns || [])
              .filter(t => t.turn_number > lastRenderedTurnNumber && t.turn_number < state.turn.number)
              .forEach(t => {
                if (t.player_action) appendPlayerAction(t.player_action);
                appendGMDialogue(t.narrative);
              });
          }
        } catch (e) { /* gap backfill is best-effort */ }
      }
      if (state.turn?.playerAction) appendPlayerAction(state.turn.playerAction);
      renderGame(state, false);
    } else {
      // Same turn, possibly changed table (joins, releases, style edits):
      // adopt the fresh snapshot so chip clicks re-render current data.
      lastGameState = state;
      renderPartyState(state);
    }
  } catch (e) { /* transient — next poll retries */ }
}, 12000);

// Clears the situation surface: campaigns must never inherit another
// campaign's map, location label, grounding text, or positional state.
function resetSituationPanel() {
  document.getElementById('situation-section').style.display = 'none';
  document.getElementById('situation-map').innerHTML = '';
  document.getElementById('situation-text').textContent = '';
  document.getElementById('situation-location-name').textContent = '';
  mainGameScreen.classList.remove('positional-turn');
}

// Situation surface: map + grounding text always coexist (owner Layout D
// pick) — the text is always present once known; the map is revealed on
// positional turns and whenever the panel is spotlighted (CSS rules).
function renderSituation(turn) {
  const location = turn.location;
  const grounding = turn.sceneGrounding;
  if (!location && !grounding) return; // keep the previous situation visible

  document.getElementById('situation-section').style.display = '';
  if (grounding) {
    document.getElementById('situation-text').textContent = grounding;
  }
  document.getElementById('situation-location-name').textContent = location?.name || '';
  if (location?.mapSvg) {
    document.getElementById('situation-map').innerHTML =
      DOMPurify.sanitize(location.mapSvg, { USE_PROFILES: { svg: true } });
  }
  mainGameScreen.classList.toggle('positional-turn', !!location?.positional);
}

function stripNarrationText(markdownText) {
  return String(markdownText || '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[[^\]]*]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/[*_#>`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4000);
}

// Token invalidated by stopNarration; a stale token aborts a running queue.
let narrationQueueToken = null;

// Stops any playing narration (and any queued segments) and hides the skip control.
function stopNarration() {
  narrationQueueToken = null;
  if (currentNarrationAudio) {
    currentNarrationAudio.pause();
    URL.revokeObjectURL(currentNarrationAudio.src);
    currentNarrationAudio = null;
  }
  document.getElementById('btn-skip-narration').style.display = 'none';
}

function playAudioBlob(blob) {
  return new Promise(resolve => {
    const objectUrl = URL.createObjectURL(blob);
    currentNarrationAudio = new Audio(objectUrl);
    currentNarrationAudio.addEventListener('ended', () => {
      URL.revokeObjectURL(objectUrl);
      currentNarrationAudio = null;
      resolve();
    }, { once: true });
    currentNarrationAudio.play().catch(() => resolve());
  });
}

// Multi-voice narration (Phase 2): plays the turn's voice script segment by
// segment — NPC lines in their sticky stored voices, narrator lines in the
// player's chosen voice. Falls back to single-voice narration of the whole
// narrative when no script is present. Skip stops the entire queue.
async function narrateGmResponse(turn) {
  if (!apiConfig.voiceNarration) return;

  stopNarration();

  const script = Array.isArray(turn.voiceLines) && turn.voiceLines.length > 0
    ? turn.voiceLines
    : [{ text: turn.narrative, voice: null, instructions: null }];

  const queue = script
    .map(line => ({ ...line, text: stripNarrationText(line.text) }))
    .filter(line => line.text);
  if (queue.length === 0) return;

  const token = {};
  narrationQueueToken = token;
  const skipBtn = document.getElementById('btn-skip-narration');
  skipBtn.style.display = 'inline-flex';

  try {
    for (const line of queue) {
      if (narrationQueueToken !== token) return;

      // NPC lines carry their full stored direction; narrator lines compose
      // the player's chosen direction with the line's tone.
      const audioConfig = line.voice
        ? { voice: line.voice, instructions: line.instructions || '' }
        : { voice: apiConfig.voiceName, instructions: [apiConfig.voiceInstructions, line.instructions].filter(Boolean).join(' ') };

      const response = await fetchWithTimeout('/api/audio/narrate', {
        method: 'POST',
        body: JSON.stringify({ text: line.text, audioConfig })
      }, 90000);

      if (!response.ok) {
        const message = await getResponseErrorMessage(response, 'Voice narration failed');
        throw new Error(message);
      }
      if (narrationQueueToken !== token) return;

      await playAudioBlob(await response.blob());
    }
    voiceErrorShown = false;
  } catch (error) {
    console.error(error);
    if (!voiceErrorShown) {
      showToast(`Voice Error: ${error.message}`, 'error');
      voiceErrorShown = true;
    }
  } finally {
    if (narrationQueueToken === token) {
      narrationQueueToken = null;
      skipBtn.style.display = 'none';
    }
  }
}

// Font stacks for agent-generated pairings (Phase T1). Families must match
// the Google Fonts loaded in index.html and the server-side pool in
// rpg-state.js THEME_FONT_OPTIONS; anything else is ignored.
const THEME_FONT_STACKS = {
  'Outfit': "'Outfit', 'Inter', sans-serif",
  'Inter': "'Inter', sans-serif",
  'Rajdhani': "'Rajdhani', 'Inter', sans-serif",
  'Orbitron': "'Orbitron', 'Outfit', sans-serif",
  'Cinzel': "'Cinzel', serif",
  'Playfair Display': "'Playfair Display', serif",
  'Cormorant Garamond': "'Cormorant Garamond', serif",
  'Lora': "'Lora', serif",
  'Special Elite': "'Special Elite', serif"
};
const THEME_FONT_SLOT_DEFAULTS = { title: 'Outfit', body: 'Inter', dialogue: 'Playfair Display' };
const THEME_VAR_NAMES = ['--theme-primary', '--theme-secondary', '--theme-bg', '--theme-panel', '--theme-border', '--theme-text', '--theme-text-dim', '--theme-glow'];

// Generate HSL styles and apply class theme
function applyCampaignTheme(genre, colors, fonts) {
  document.body.className = '';
  // A previously loaded full-theme campaign may have left body-level variable
  // overrides behind; clear them so this campaign starts from a clean slate.
  THEME_VAR_NAMES.forEach(name => document.body.style.removeProperty(name));

  const primary = (typeof colors?.primary === 'string') ? colors.primary.trim() : '210, 100%, 50%';
  const secondary = (typeof colors?.secondary === 'string') ? colors.secondary.trim() : '330, 100%, 50%';
  const background = (typeof colors?.background === 'string') ? colors.background.trim() : '220, 30%, 8%';

  // Font pairing (Phase T1): generated at setup, validated server-side.
  // Preset classes never set fonts, so root-level values apply cleanly.
  for (const [slot, fallback] of Object.entries(THEME_FONT_SLOT_DEFAULTS)) {
    const family = THEME_FONT_STACKS[fonts?.[slot]] ? fonts[slot] : fallback;
    document.documentElement.style.setProperty(`--font-${slot}`, THEME_FONT_STACKS[family]);
  }

  // A generated text slot marks a full agent-generated theme (decision
  // 2026-07-03: generated theming beats curated presets). Apply it at body
  // level — where the preset classes define their variables — so it wins,
  // and skip the genre keyword matching entirely.
  if (typeof colors?.text === 'string') {
    const set = (name, value) => document.body.style.setProperty(name, value);
    set('--theme-primary', primary);
    set('--theme-secondary', secondary);
    set('--theme-bg', background);
    set('--theme-text', colors.text.trim());
    if (typeof colors.text_dim === 'string') set('--theme-text-dim', colors.text_dim.trim());
    set('--theme-glow', `${primary}, 0.18`);
    const bgParts = background.match(/\d+/g);
    if (bgParts && bgParts.length >= 3) {
      const l = Math.min(95, parseInt(bgParts[2]) + 4);
      set('--theme-panel', `${bgParts[0]}, ${bgParts[1]}%, ${l}%`);
      set('--theme-border', `${bgParts[0]}, ${bgParts[1]}%, ${l + 8}%`);
    }
    document.body.classList.add('theme-default');
    return;
  }

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

// Character sheet renderer (extracted for party support — Phase 3 M3)
function renderCharacterSheet(char) {
  if (!char) return;
  charName.textContent = char.name;
  charClass.textContent = char.class || char.archetype || 'Developing concept';
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

  attrStr.textContent = char.attributes.strength || 10;
  attrAgi.textContent = char.attributes.agility || 10;
  attrInt.textContent = char.attributes.intellect || 10;
  attrWil.textContent = char.attributes.willpower || 10;

  renderInventory(char.inventory);
  renderAbilities(char.abilities || []);
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

function renderAbilities(abilities) {
  charAbilities.innerHTML = '';
  if (!abilities || abilities.length === 0) {
    charAbilities.innerHTML = `<div class="ability-empty">No abilities established yet.</div>`;
    return;
  }

  abilities.forEach(ability => {
    const div = document.createElement('div');
    div.className = 'ability-item';
    const safeName = escapeHtml(ability.name || 'Unnamed Ability');
    const safeTier = escapeHtml(ability.tier || 'emerging');
    const safeDescription = escapeHtml(ability.description || 'A developing capability.');
    const safeSource = escapeHtml(ability.source || 'in-game development');

    div.innerHTML = DOMPurify.sanitize(`
      <div class="ability-head">
        <span class="ability-name">${safeName}</span>
        <span class="ability-tier">${safeTier}</span>
      </div>
      <div class="ability-desc">${safeDescription}</div>
      <div class="ability-source">${safeSource}</div>
    `);
    charAbilities.appendChild(div);
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
      // requestSubmit fires a cancelable submit event; dispatchEvent(new Event('submit'))
      // is non-cancelable, so preventDefault was ignored and Firefox performed the native
      // form submission (full page reload back to the campaign menu).
      actionForm.requestSubmit();
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

// Append GM description with markdown support and DOMPurify sanitization
function appendGMDialogue(markdownText) {
  const el = document.createElement('div');
  el.className = 'log-entry log-gm';

  // Guard against undefined or null narrative string inputs
  const htmlContent = marked.parse(markdownText || '*The scene progresses in silence...*');
  const cleanHtml = DOMPurify.sanitize(htmlContent);

  el.innerHTML = `
    <div class="speaker"><i class="fa-solid fa-dice-d20"></i> Game Master</div>
    <div class="content">${cleanHtml}</div>
  `;
  narrativeContainer.appendChild(el);
  scrollToBottom();
}

function escapeHtml(str) {
  // String guard to cast numbers/booleans and prevent throws on null/undefined
  const safeStr = typeof str === 'string' ? str : String(str ?? '');
  return safeStr.replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
}

function appendSceneGrounding(groundingText) {
  if (!groundingText || !narrativeContainer) return;
  const el = document.createElement('div');
  el.className = 'log-entry log-scene';
  const safeText = escapeHtml(groundingText);
  el.innerHTML = `
    <div class="speaker"><i class="fa-solid fa-eye"></i> Current Situation</div>
    <div class="content scene-grounding">${safeText}</div>
  `;
  narrativeContainer.appendChild(el);
  scrollToBottom();
}

function scrollToBottom() {
  // Immediate + two delayed passes: SVGs and roll cards can settle layout
  // after the first scroll, leaving fresh text below the fold.
  narrativeContainer.scrollTop = narrativeContainer.scrollHeight;
  setTimeout(() => {
    narrativeContainer.scrollTop = narrativeContainer.scrollHeight;
  }, 50);
  setTimeout(() => {
    narrativeContainer.scrollTop = narrativeContainer.scrollHeight;
  }, 350);
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

// Append a dice roll card in the narrative log (Rules Mode check results)
function appendRollResultBubble(roll) {
  const el = document.createElement('div');
  el.className = 'log-entry log-roll';
  const costs = [];
  if (!roll.success && typeof roll.applied_health_change === 'number' && roll.applied_health_change < 0) {
    costs.push(`${roll.applied_health_change} HP`);
  }
  if (!roll.success && typeof roll.applied_mana_change === 'number' && roll.applied_mana_change < 0) {
    costs.push(`${roll.applied_mana_change} MP`);
  }
  const outcomeText = roll.success ? 'SUCCESS' : `FAILURE${costs.length ? ` (${costs.join(', ')})` : ''}`;
  const outcomeClass = roll.success ? 'roll-success' : 'roll-failure';
  const reasonHtml = roll.reason
    ? `<div class="roll-reason">${escapeHtml(roll.reason)}</div>`
    : '';

  el.innerHTML = DOMPurify.sanitize(`
    <div class="roll-badge-container">
      <span class="roll-d20-icon"><i class="fa-solid fa-dice-d20"></i></span>
      <div class="roll-details">
        <div class="roll-calculation">
          <strong>${(roll.attribute || 'stat').toUpperCase()} CHECK:</strong>
          Roll ${roll.roll} + Mod ${roll.modifier >= 0 ? '+' : ''}${roll.modifier} = <strong>${roll.total}</strong> vs DC ${roll.dc}
        </div>
        ${reasonHtml}
        <div class="roll-outcome ${outcomeClass}">${outcomeText}</div>
      </div>
    </div>
  `);
  narrativeContainer.appendChild(el);
  scrollToBottom();
}

// In-memory cache for timeline filtering
let activeTimelineData = [];

// Fetch journal chronology and render it
async function loadJournalTimeline() {
  if (!currentCampaignId) return;
  journalTimelineContainer.innerHTML = `<div style="font-size: 12px; opacity: 0.6; padding: 8px;"><i class="fa-solid fa-spinner fa-spin"></i> Fetching journal history...</div>`;

  try {
    const response = await fetchWithTimeout(`/api/campaigns/${currentCampaignId}/journal`);
    if (!response.ok) throw new Error('Could not retrieve timeline data');

    const data = await response.json();
    
    // Unify turns and memories
    const chronology = [];
    if (data.turns && Array.isArray(data.turns)) {
      data.turns.forEach(t => {
        chronology.push({
          type: 'turn',
          timestamp: new Date(t.created_at),
          data: t
        });
      });
    }
    if (data.memories && Array.isArray(data.memories)) {
      data.memories.forEach(m => {
        chronology.push({
          type: 'memory',
          timestamp: new Date(m.created_at),
          data: m
        });
      });
    }

    // Sort ascending
    chronology.sort((a, b) => a.timestamp - b.timestamp);
    activeTimelineData = chronology;

    renderChronologyTimeline(activeTimelineData);
  } catch (error) {
    console.error(error);
    journalTimelineContainer.innerHTML = `<div style="font-size: 12px; color: hsl(0, 70%, 65%); padding: 8px;"><i class="fa-solid fa-triangle-exclamation"></i> Error: ${error.message}</div>`;
  }
}

// Render the Unified Chronology timeline
function renderChronologyTimeline(items) {
  journalTimelineContainer.innerHTML = '';
  if (items.length === 0) {
    journalTimelineContainer.innerHTML = `<div style="font-size: 11px; opacity: 0.5; padding: 8px;">No chronology events found matching criteria.</div>`;
    return;
  }

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = `timeline-node timeline-${item.type}`;
    
    const timeStr = item.timestamp.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

    if (item.type === 'turn') {
      const turn = item.data;
      const turnText = turn.player_action 
        ? `<strong>Player:</strong> "${escapeHtml(turn.player_action)}"`
        : `<em>Campaign started</em>`;
      const narrativeSample = marked.parse(turn.narrative.substring(0, 180) + (turn.narrative.length > 180 ? '...' : ''));
      
      let stateChanges = {};
      try { stateChanges = JSON.parse(turn.state_changes_json || '{}'); } catch(e) {}
      
      const timelineRolls = Array.isArray(stateChanges.dice_rolls) && stateChanges.dice_rolls.length > 0
        ? stateChanges.dice_rolls
        : (stateChanges.roll_result ? [stateChanges.roll_result] : []);
      const rollBadgeHtml = timelineRolls.map(roll =>
        `<div class="timeline-roll-badge ${roll.success ? 'success' : 'fail'}">
           <i class="fa-solid fa-dice-d20"></i> ${(roll.attribute || 'stat').toUpperCase()} check: ${roll.total} vs DC ${roll.dc}
         </div>`
      ).join('');

      const safeHtml = DOMPurify.sanitize(`
        <div class="timeline-node-header">
          <span class="timeline-node-badge badge-turn">Turn ${turn.turn_number}</span>
          <span class="timeline-node-time">${timeStr}</span>
        </div>
        <div class="timeline-node-action">${turnText}</div>
        <div class="timeline-node-summary">${narrativeSample}</div>
        ${rollBadgeHtml}
        <div class="timeline-node-footer">
          <button class="btn btn-secondary btn-sm timeline-fork-btn">
            <i class="fa-solid fa-code-fork"></i> Fork Timeline
          </button>
        </div>
      `);
      card.innerHTML = safeHtml;

      const forkBtn = card.querySelector('.timeline-fork-btn');
      if (forkBtn) {
        forkBtn.addEventListener('click', () => {
          forkCampaignTimeline(turn.turn_number);
        });
      }
    } else if (item.type === 'memory') {
      const memory = item.data;
      const keywordsHtml = memory.keywords 
        ? `<span class="timeline-keywords"><i class="fa-solid fa-tags"></i> ${escapeHtml(memory.keywords)}</span>`
        : '';
      const safeHtml = DOMPurify.sanitize(`
        <div class="timeline-node-header">
          <span class="timeline-node-badge badge-memory">Memory (Imp: ${memory.importance})</span>
          <span class="timeline-node-time">${timeStr}</span>
        </div>
        <div class="timeline-node-summary"><i class="fa-solid fa-sparkles text-warning" style="margin-right: 4px;"></i> ${escapeHtml(memory.summary)}</div>
        ${keywordsHtml}
      `);
      card.innerHTML = safeHtml;
    }
    
    journalTimelineContainer.appendChild(card);
  });
}

// Filter the timeline by search text
function filterJournalTimeline() {
  const query = journalSearchInput.value.toLowerCase().trim();
  if (!query) {
    renderChronologyTimeline(activeTimelineData);
    return;
  }

  const filtered = activeTimelineData.filter(item => {
    if (item.type === 'turn') {
      const turn = item.data;
      return (turn.player_action && turn.player_action.toLowerCase().includes(query)) ||
             (turn.narrative && turn.narrative.toLowerCase().includes(query));
    } else if (item.type === 'memory') {
      const memory = item.data;
      return (memory.summary && memory.summary.toLowerCase().includes(query)) ||
             (memory.keywords && memory.keywords.toLowerCase().includes(query));
    }
    return false;
  });

  renderChronologyTimeline(filtered);
}

// Fork the campaign branch from timeline click
let forkInFlight = false;
window.forkCampaignTimeline = async function(turnNumber) {
  if (forkInFlight) return;
  forkInFlight = true;
  const newTitle = prompt(
    `Branch timeline from Turn ${turnNumber}?\nThis creates a new campaign fork without modifying the current run.\n\nEnter new campaign name:`,
    `${currentCampaignTitle} [Fork - Turn ${turnNumber}]`
  );
  if (!newTitle) {
    forkInFlight = false;
    return;
  }

  showLoadingOverlay(`Game Master is forking timeline...\nReconstructing character and NPC relationships at Turn ${turnNumber}.`);

  try {
    const response = await fetchWithTimeout(`/api/campaigns/${currentCampaignId}/fork`, {
      method: 'POST',
      body: JSON.stringify({
        turnNumber,
        newTitle: newTitle.trim()
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Fork request failed');
    }

    const newCampaignState = await response.json();
    currentCampaignId = newCampaignState.campaignId;
    
    // Switch to the newly created branched campaign!
    renderGame(newCampaignState, true);
    setActiveTab('inventory'); // return tab focus to inventory
    showToast(`Successfully branched campaign: "${newTitle}"`, 'success');
  } catch (error) {
    console.error(error);
    showToast(`Fork Error: ${error.message}`, 'error');
  } finally {
    forkInFlight = false;
    hideLoadingOverlay();
  }
};
