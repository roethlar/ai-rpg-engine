/**
 * AETHERIA GM FRONTEND APPLICATION
 */

import { baseThemeVars, fullThemeVars } from './theme-vars.js';
import { normalizeVoiceLines, runVoiceNarration } from './voice-narration.js';
import { createClassCreator } from './class-creator.js';
import {
  applyAbilitySuggestion,
  computeAbilityInsertion,
  scanAbilityTriggers
} from './ability-keywords.js';

// Application state
let currentCampaignId = null;

// Session epoch (poll-1): bumped on every table transition — menu return,
// campaign load, fork adoption, token re-route. Async flows capture it at
// dispatch; a mismatch after an await means the table changed while the
// request was in flight, so the response is stale and must not render.
let sessionEpoch = 0;
function bumpSessionEpoch() {
  sessionEpoch += 1;
  closeAbilityDrawer(false);
  // A table transition also invalidates any dice theater still playing or
  // queued for the old table (dt-1); hoisted, defined with the theater code.
  dismissRollTheater();
  // tts-1: and any narration playing or queued for it — the departed
  // table's GM must not keep talking over the menu or the next campaign.
  stopNarration();
  resetAbilityComposerForSession();
}
let currentCampaignTitle = '';
let savedCharacters = [];
// Player-appropriate settings only: AI provider/model/keys are server-owned
// (decision 2026-06-11) and configured by the operator at /admin.
const DEFAULT_API_CONFIG = {
  accessToken: '', // Authentication token
  enableDiagnostics: false, // Dev mode flag
  voiceNarration: false,
  // Auto-play new-turn narration; toggled from the gameplay area (Phase V4).
  voiceAutoPlay: true
};
let apiConfig = { ...DEFAULT_API_CONFIG };

// Seat sessions (Phase S2/S3): a seat token in the access-token field binds
// this browser to ONE character of ONE campaign. The SERVER scopes every
// payload and rejects host actions — these flags only shape the chrome
// (hidden host controls, fixed identity, session bootstrap).
let seatMode = false;
let seatCharacterId = null;

// sv-3: MUST mirror looksLikeSeatToken in seat-auth.js exactly. If the client
// classifies a credential as a seat while the server classifies it as a host
// (e.g. ACCESS_SECRET="seat_1234567890abcdef"), the browser bootstraps through
// /api/seat/session and the valid host is locked out with a 403.
// Real minted tokens are 'seat_' + 48 hex chars, so both tests accept them.
const SEAT_TOKEN_PREFIX = 'seat_';
function isSeatToken(token) {
  return typeof token === 'string'
    && token.startsWith(SEAT_TOKEN_PREFIX)
    && token.length > SEAT_TOKEN_PREFIX.length + 16;
}

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
const selectRuleset = document.getElementById('select-ruleset');
const classCreationError = document.getElementById('class-creation-error');
const riderSupport = document.getElementById('input-class-rider');
const alliedSupport = document.getElementById('input-class-allies');
let classCreator = null;
let wizardCampaign = null;
let wizardBusy = false;
let wizardSerial = 0;
let catalogReloadTimer;
let wizardPreviousFocus = null;
const wizardDrafts = new Map();
const WIZARD_FIELDS = ['input-genre', 'input-char-name', 'input-char-concept',
  'select-character-mode', 'select-saved-character', 'select-ruleset', 'input-rules-mode',
  'input-class-rider', 'input-class-allies', 'select-helpfulness', 'select-pacing'];

// Settings Inputs
const inputAccessToken = document.getElementById('input-access-token');
const checkboxDiagnostics = document.getElementById('input-enable-diagnostics');
const checkboxVoiceNarration = document.getElementById('input-enable-voice-narration');
const voiceSettingsGroup = document.getElementById('voice-settings-group');

// Game Panel DOM Elements
const activeQuestTitle = document.getElementById('active-quest-title');
const activeQuestDesc = document.getElementById('active-quest-desc');
const activeActBadge = document.getElementById('active-act-badge');
const campaignOutlineList = document.getElementById('campaign-outline-list');
const narrativeContainer = document.getElementById('narrative-container');
const suggestedChoicesContainer = document.getElementById('suggested-choices-container');
const actionForm = document.getElementById('action-form');
const actionInput = document.getElementById('action-input');
const actionComposer = document.getElementById('action-composer');
const actionHighlightContent = document.getElementById('action-highlight-content');
const abilityCorrection = document.getElementById('ability-correction');
const abilityRecognitionStatus = document.getElementById('ability-recognition-status');
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
let currentNarrationFinish = null;
let voiceErrorShown = false;

// Ability-keyword composer (AKP-3). The native textarea is the only editable
// source. Everything else here is derived feedback over the selected
// character's server-owned trigger projection.
const ABILITY_TRIGGER_REVISION_PATTERN = /^ak\d+:[a-f0-9]{64}$/u;
const ACTION_REQUEST_ID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu;
const EMPTY_COMPOSER_SCAN = Object.freeze({ matches: [], abilityIds: [], suggestions: [] });
let activeComposerCharacterId = null;
let activeAbilityTriggerRevision = '';
let activeInvocableAbilities = [];
let activeInvocableAbilityById = new Map();
let currentComposerScan = EMPTY_COMPOSER_SCAN;
let composerScopeSerial = 0;
let composerLocked = false;
let composerIsComposing = false;
let rememberedComposerSelection = { start: 0, end: 0 };
let announcedAbilitySignature = '';
let pendingTargetAction = null;

function pendingActionKey(scope) {
  return `aetheria_pending_action_v1_${scope.campaignId}_${scope.characterId}`;
}

function normalizePendingAction(value, characterId) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || value.characterId !== characterId || value.actor !== `character:${characterId}`
    || typeof value.requestId !== 'string' || !ACTION_REQUEST_ID_PATTERN.test(value.requestId)
    || typeof value.playerAction !== 'string' || !value.playerAction.trim() || value.playerAction.length > 2000
    || typeof value.abilityTriggerRevision !== 'string' || !ABILITY_TRIGGER_REVISION_PATTERN.test(value.abilityTriggerRevision)) return null;
  return { requestId: value.requestId, actor: value.actor, characterId: value.characterId,
    playerAction: value.playerAction, abilityTriggerRevision: value.abilityTriggerRevision };
}

function readPendingAction(scope) {
  try { return normalizePendingAction(JSON.parse(localStorage.getItem(pendingActionKey(scope))), scope.characterId); }
  catch { return null; }
}

function updatePendingActionControls() {
  actionInput.readOnly = !!pendingTargetAction;
  abilityCorrection.disabled = composerLocked || !!pendingTargetAction;
  for (const button of [...charAbilities.querySelectorAll('button'), ...suggestedChoicesContainer.querySelectorAll('button')]) {
    button.disabled = composerLocked || !!pendingTargetAction;
  }
}

function releasePendingAction(scope, requestId) {
  if (!requestId) return;
  if (readPendingAction(scope)?.requestId === requestId) localStorage.removeItem(pendingActionKey(scope));
  if (scope.campaignId === currentCampaignId && scope.characterId === activeComposerCharacterId
    && pendingTargetAction?.requestId === requestId) {
    pendingTargetAction = null;
    updatePendingActionControls();
  }
}

function reconcilePendingAction(gameState) {
  const scope = captureComposerScope();
  if (gameState.ruleset?.id !== 'aetheria' || !scope.characterId) {
    pendingTargetAction = null;
    updatePendingActionControls();
    return;
  }
  const stored = readPendingAction(scope);
  const completedId = gameState.settledRequestId || gameState.turn?.requestId;
  if (stored && stored.requestId === completedId) {
    releasePendingAction(scope, stored.requestId);
    if (actionInput.value === stored.playerAction) setComposerValue('', 0, 0, { focus: false });
  }
  const authoritative = ['accepted', 'prepared', 'resolved', 'narrated'].includes(gameState.pendingAction?.stage)
    ? normalizePendingAction(gameState.pendingAction, scope.characterId) : null;
  const next = authoritative || readPendingAction(scope);
  if (authoritative) localStorage.setItem(pendingActionKey(scope), JSON.stringify(authoritative));
  const changed = pendingTargetAction?.requestId !== next?.requestId;
  if (!next && pendingTargetAction && actionInput.value === pendingTargetAction.playerAction) {
    setComposerValue('', 0, 0, { focus: false });
  }
  pendingTargetAction = next;
  if (next && (changed || actionInput.value !== next.playerAction)) {
    setComposerValue(next.playerAction, next.playerAction.length, next.playerAction.length, { focus: false });
  }
  updatePendingActionControls();
}

function renderPendingRolls(gameState) {
  const current = narrativeContainer.querySelector('.pending-action-rolls');
  const rolls = gameState.ruleset?.id === 'aetheria' && Array.isArray(gameState.pendingRollResults)
    ? gameState.pendingRollResults.filter(roll => roll?.sides === 100 && typeof roll.checkId === 'string') : [];
  if (!rolls.length) { current?.remove(); return; }
  const signature = JSON.stringify([rolls, gameState.pendingRollAnnotationDetails || []]);
  if (current?.dataset.signature === signature) return;
  const group = document.createElement('section');
  group.className = 'pending-action-rolls';
  group.setAttribute('aria-label', 'Pending action checks');
  group.dataset.signature = signature;
  const status = document.createElement('p');
  status.className = 'text-warning';
  status.textContent = 'Action pending';
  group.append(status);
  for (const roll of rolls) appendRollResultBubble(roll, undefined, gameState.pendingRollAnnotationDetails, group);
  if (current) current.replaceWith(group);
  else narrativeContainer.append(group);
  scrollToBottom();
}

function createActionRequestId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function familyToneForKey(familyKey) {
  let hash = 2166136261;
  for (const point of String(familyKey || '')) {
    hash ^= point.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return String((hash >>> 0) % 6);
}

function rememberComposerSelection() {
  rememberedComposerSelection = {
    start: actionInput.selectionStart ?? 0,
    end: actionInput.selectionEnd ?? 0
  };
}

function syncComposerMirrorScroll() {
  actionHighlightContent.style.transform =
    `translate(${-actionInput.scrollLeft}px, ${-actionInput.scrollTop}px)`;
}

function sizeActionComposer() {
  actionInput.style.height = 'auto';
  const height = Math.min(Math.max(actionInput.scrollHeight, 44), 132);
  actionComposer.style.height = `${height}px`;
  actionInput.style.height = '100%';
  if (actionInput.clientWidth > 0) {
    actionHighlightContent.style.width = `${actionInput.clientWidth}px`;
  }
  syncComposerMirrorScroll();
}

function renderComposerMirror(text, matches) {
  const fragment = document.createDocumentFragment();
  let cursor = 0;
  for (const match of matches) {
    fragment.append(document.createTextNode(text.slice(cursor, match.start)));
    const mark = document.createElement('mark');
    mark.className = 'ability-highlight';
    mark.dataset.familyTone = familyToneForKey(match.familyKey);
    mark.append(document.createTextNode(text.slice(match.start, match.end)));
    fragment.append(mark);
    cursor = match.end;
  }
  fragment.append(document.createTextNode(text.slice(cursor)));
  if (text.endsWith('\n')) fragment.append(document.createTextNode('\u200b'));
  actionHighlightContent.replaceChildren(fragment);
  syncComposerMirrorScroll();
}

function announceRecognizedAbilities(abilityIds) {
  const setSignature = [...new Set(abilityIds)].sort().join('|');
  const signature = `${activeComposerCharacterId ?? ''}:${setSignature}`;
  if (signature === announcedAbilitySignature) return;

  const hadRecognizedAbilities = announcedAbilitySignature.includes(':')
    && announcedAbilitySignature.split(':', 2)[1].length > 0;
  announcedAbilitySignature = signature;
  const names = abilityIds
    .map(abilityId => activeInvocableAbilityById.get(abilityId)?.name)
    .filter(Boolean);
  if (names.length > 0) {
    abilityRecognitionStatus.textContent =
      `Recognized ${names.length === 1 ? 'ability' : 'abilities'}: ${names.join(', ')}.`;
  } else if (hadRecognizedAbilities) {
    abilityRecognitionStatus.textContent = 'No ability terms recognized.';
  } else {
    abilityRecognitionStatus.textContent = '';
  }
}

function renderAbilityCorrection() {
  const suggestion = currentComposerScan.suggestions[0] ?? null;
  const ability = suggestion
    ? activeInvocableAbilityById.get(suggestion.abilityId)
    : null;
  if (!suggestion || !ability) {
    abilityCorrection.hidden = true;
    abilityCorrection.textContent = '';
    delete abilityCorrection.dataset.familyTone;
    return;
  }

  abilityCorrection.textContent = `Did you mean “${ability.name}”?`;
  abilityCorrection.dataset.familyTone = familyToneForKey(ability.familyKey);
  abilityCorrection.hidden = false;
  abilityCorrection.disabled = composerLocked || !!pendingTargetAction;
}

function scanAndRenderComposer() {
  try {
    currentComposerScan = scanAbilityTriggers(actionInput.value, activeInvocableAbilities);
  } catch (error) {
    console.error('Ability recognition unavailable:', error);
    currentComposerScan = EMPTY_COMPOSER_SCAN;
  }
  renderComposerMirror(actionInput.value, currentComposerScan.matches);
  renderAbilityCorrection();
  announceRecognizedAbilities(currentComposerScan.abilityIds);
  sizeActionComposer();
  return currentComposerScan;
}

function setComposerValue(text, selectionStart, selectionEnd, { focus = true } = {}) {
  actionInput.value = text;
  const start = Math.max(0, Math.min(selectionStart, text.length));
  const end = Math.max(start, Math.min(selectionEnd, text.length));
  if (focus) actionInput.focus();
  actionInput.setSelectionRange(start, end);
  rememberComposerSelection();
  scanAndRenderComposer();
}

function restoreComposerDraft(text, selectionStart, selectionEnd) {
  if (actionInput.value !== text) actionInput.value = text;
  const start = Math.max(0, Math.min(selectionStart, text.length));
  const end = Math.max(start, Math.min(selectionEnd, text.length));
  actionInput.focus();
  actionInput.setSelectionRange(start, end);
  rememberComposerSelection();
  scanAndRenderComposer();
}

function resetAbilityComposerForSession() {
  pendingTargetAction = null;
  actionInput.readOnly = false;
  activeComposerCharacterId = null;
  activeAbilityTriggerRevision = '';
  activeInvocableAbilities = [];
  activeInvocableAbilityById = new Map();
  currentComposerScan = EMPTY_COMPOSER_SCAN;
  composerScopeSerial += 1;
  announcedAbilitySignature = '';
  abilityRecognitionStatus.textContent = '';
  setComposerValue('', 0, 0, { focus: false });
}

function updateAbilityComposerForCharacter(character) {
  const nextCharacterId = Number.isSafeInteger(character?.id) ? character.id : null;
  const nextRevision = typeof character?.abilityTriggerRevision === 'string'
    && ABILITY_TRIGGER_REVISION_PATTERN.test(character.abilityTriggerRevision)
    ? character.abilityTriggerRevision
    : '';
  let nextAbilities = [];
  if (Array.isArray(character?.invocableAbilities)) {
    try {
      scanAbilityTriggers('', character.invocableAbilities);
      nextAbilities = character.invocableAbilities;
    } catch (error) {
      console.error('Invalid ability trigger projection:', error);
    }
  }

  const characterChanged = activeComposerCharacterId !== nextCharacterId;
  const scopeChanged = characterChanged || activeAbilityTriggerRevision !== nextRevision;
  if (scopeChanged) composerScopeSerial += 1;
  if (composerLocked && characterChanged && activeComposerCharacterId !== null) {
    actionInput.value = '';
    rememberedComposerSelection = { start: 0, end: 0 };
  }

  activeComposerCharacterId = nextCharacterId;
  activeAbilityTriggerRevision = nextRevision;
  activeInvocableAbilities = nextAbilities;
  activeInvocableAbilityById = new Map(nextAbilities.map(ability => [ability.abilityId, ability]));
  scanAndRenderComposer();
}

function insertInvocableAbility(ability) {
  if (composerLocked || pendingTargetAction || !activeInvocableAbilityById.has(ability.abilityId)) return;
  const start = Math.max(0, Math.min(rememberedComposerSelection.start, actionInput.value.length));
  const end = Math.max(start, Math.min(rememberedComposerSelection.end, actionInput.value.length));
  const insertion = computeAbilityInsertion(actionInput.value, start, end, ability.trigger);
  actionInput.focus();
  actionInput.setRangeText(insertion.insertedText, start, end, 'end');
  actionInput.setSelectionRange(insertion.selectionStart, insertion.selectionEnd);
  closeAbilityDrawer(false);
  rememberComposerSelection();
  scanAndRenderComposer();
}

function acceptAbilityCorrection() {
  const suggestion = currentComposerScan.suggestions[0] ?? null;
  if (composerLocked || pendingTargetAction || !suggestion) return;
  const replacement = applyAbilitySuggestion(actionInput.value, suggestion);
  actionInput.focus();
  actionInput.setRangeText(suggestion.replacement, suggestion.start, suggestion.end, 'end');
  actionInput.setSelectionRange(replacement.selectionStart, replacement.selectionEnd);
  rememberComposerSelection();
  scanAndRenderComposer();
}

function setupAbilityComposer() {
  for (const eventName of ['select', 'click', 'keyup', 'blur']) {
    actionInput.addEventListener(eventName, rememberComposerSelection);
  }
  actionInput.addEventListener('compositionstart', () => {
    composerIsComposing = true;
  });
  actionInput.addEventListener('compositionend', () => {
    composerIsComposing = false;
    rememberComposerSelection();
    scanAndRenderComposer();
  });
  actionInput.addEventListener('input', () => {
    rememberComposerSelection();
    if (!composerIsComposing) scanAndRenderComposer();
  });
  actionInput.addEventListener('scroll', syncComposerMirrorScroll);
  actionInput.addEventListener('keydown', event => {
    if (
      event.key === 'Enter'
      && !event.shiftKey
      && !event.isComposing
      && !composerIsComposing
    ) {
      event.preventDefault();
      actionForm.requestSubmit();
    }
  });
  abilityCorrection.addEventListener('click', acceptAbilityCorrection);
  window.addEventListener('resize', sizeActionComposer);
  scanAndRenderComposer();
}

function captureComposerScope() {
  return {
    epoch: sessionEpoch,
    campaignId: currentCampaignId,
    characterId: activeComposerCharacterId,
    triggerRevision: activeAbilityTriggerRevision,
    serial: composerScopeSerial
  };
}

function isComposerScopeCurrent(scope) {
  return scope.epoch === sessionEpoch
    && scope.campaignId === currentCampaignId
    && scope.characterId === activeComposerCharacterId
    && scope.triggerRevision === activeAbilityTriggerRevision
    && scope.serial === composerScopeSerial;
}

async function refreshComposerAfterStale(scope, draft) {
  if (!isComposerScopeCurrent(scope)) return false;
  const response = await fetchWithTimeout(
    `/api/campaigns/${scope.campaignId}`,
    {},
    15000
  );
  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response, 'Could not refresh character abilities'));
  }
  const state = await response.json();
  if (!isComposerScopeCurrent(scope)) return false;

  lastGameState = state;
  renderPartyState(state);
  renderChoices(state.turn?.suggestedChoices || []);
  if (
    scope.epoch !== sessionEpoch
    || scope.campaignId !== currentCampaignId
    || scope.characterId !== activeComposerCharacterId
  ) {
    return false;
  }

  restoreComposerDraft(draft.text, draft.selectionStart, draft.selectionEnd);
  appendSystemNotice('Your abilities changed. Review your action, then send it again.');
  return true;
}

// Init application on load
window.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  setupEventListeners();
  bootstrapSession();
  
  // Close modals on Escape key press
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      settingsModal.style.display = 'none';
      if (!document.getElementById('ability-drawer').hidden) closeAbilityDrawer();
      else if (campaignWizardModal.style.display !== 'none') closeCampaignWizard();
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

  toggleVoiceSettings();
  updateVoiceAutoPlayButton();
}

// Save config to localStorage
function saveSettings() {
  apiConfig.accessToken = inputAccessToken.value.trim();
  apiConfig.enableDiagnostics = checkboxDiagnostics.checked;
  apiConfig.voiceNarration = checkboxVoiceNarration.checked;

  localStorage.setItem('aetheria_settings', JSON.stringify(apiConfig));
  updateVoiceAutoPlayButton();

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

  // Diagnostics surfaces (outline panel, Codex) are host-only: the seat
  // payload never carries that data, so the panels would render empty.
  if (apiConfig.enableDiagnostics && !seatMode) {
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
  setupAbilityComposer();
  classCreator = createClassCreator(document.getElementById('class-creator'), {
    fetchCatalog: async genre => {
      const query = new URLSearchParams({ genre });
      if (riderSupport.checked) query.set('modules', 'rider');
      if (alliedSupport.checked) query.set('alliedActors', 'true');
      const response = await fetchWithTimeout(`/api/class-catalog?${query}`, {}, 15000);
      if (!response.ok) throw new Error(await getResponseErrorMessage(response, 'Could not load classes.'));
      return response.json();
    },
    onChange: updateWizardSubmit
  });
  const reloadClasses = () => {
    if (selectRuleset.value !== 'aetheria') return;
    clearTimeout(catalogReloadTimer);
    const selection = classCreator.getSelection();
    classCreator.invalidate();
    catalogReloadTimer = setTimeout(() => classCreator.load(document.getElementById('input-genre').value, selection), 200);
  };
  document.getElementById('input-genre').addEventListener('input', reloadClasses);
  riderSupport.addEventListener('change', reloadClasses);
  alliedSupport.addEventListener('change', reloadClasses);
  selectRuleset.addEventListener('change', () => {
    updateWizardRules();
    if (selectRuleset.value === 'aetheria') classCreator.load(document.getElementById('input-genre').value);
  });
  document.getElementById('btn-open-abilities').addEventListener('click', openAbilityDrawer);
  document.getElementById('btn-close-abilities').addEventListener('click', () => closeAbilityDrawer());
  document.getElementById('ability-drawer').addEventListener('click', event => {
    if (event.target.id === 'ability-drawer') closeAbilityDrawer();
  });
  for (const dialog of [campaignWizardModal, document.getElementById('ability-drawer')]) {
    dialog.addEventListener('keydown', trapDialogFocus);
  }
  window.addEventListener('resize', () => {
    if (window.innerWidth > 1024) closeAbilityDrawer(false);
  });

  // Settings buttons
  document.getElementById('btn-show-settings').addEventListener('click', openSettingsModal);
  btnMenuSettings.addEventListener('click', openSettingsModal);
  document.getElementById('btn-close-settings').addEventListener('click', () => settingsModal.style.display = 'none');
  document.getElementById('btn-cancel-settings').addEventListener('click', () => settingsModal.style.display = 'none');

  checkboxVoiceNarration.addEventListener('change', toggleVoiceSettings);
  document.getElementById('btn-voice-preview').addEventListener('click', previewVoice);
  document.getElementById('btn-skip-narration').addEventListener('click', stopNarration);
  document.getElementById('btn-voice-autoplay').addEventListener('click', toggleVoiceAutoPlay);

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
    const tokenBefore = apiConfig.accessToken;
    saveSettings();
    settingsModal.style.display = 'none';
    showToast('Settings saved.', 'success');
    // A token change involving a seat token re-routes the whole session:
    // a seat token boots straight into its table (S3), a host token
    // returns to the campaign menu.
    if (apiConfig.accessToken !== tokenBefore && (isSeatToken(tokenBefore) || isSeatToken(apiConfig.accessToken))) {
      bumpSessionEpoch();
      currentCampaignId = null;
      lastGameState = null;
      lastRenderedTurnNumber = null;
      mainGameScreen.style.display = 'none';
      bootstrapSession();
    }
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
    const isTarget = selectRuleset.value === 'aetheria';
    const rulesMode = isTarget || document.getElementById('input-rules-mode').checked;
    const body = {
      genre,
      characterMode,
      rulesMode,
      ruleset: selectRuleset.value,
      tableStyle: {
        helpfulness: document.getElementById('select-helpfulness').value,
        pacing: document.getElementById('select-pacing').value
      }
    };

    if (characterMode === 'new') {
      body.characterName = inputCharName.value.trim();
      body.characterClass = inputCharConcept.value.trim();
      if (!body.characterName || (!isTarget && !body.characterClass)) {
        showToast('Enter a character name and concept.', 'error');
        return;
      }
      if (isTarget) {
        const selection = classCreator.getSelection();
        if (!selection) {
          classCreationError.textContent = 'Choose an available archetype and class.';
          classCreationError.hidden = false;
          classCreator.focus();
          return;
        }
        body.classSelection = {
          ...selection,
          modules: riderSupport.checked ? ['rider'] : [],
          capabilities: { alliedActors: alliedSupport.checked }
        };
      }
    } else {
      if (!selectedProfileId) {
        showToast('Choose a saved character profile.', 'error');
        return;
      }
      body.characterProfileId = selectedProfileId;
    }

    if (wizardBusy) return;
    const submissionSerial = wizardSerial;
    const joiningCampaignId = wizardCampaign?.campaignId ?? null;
    const submissionEpoch = sessionEpoch;
    saveWizardDraft();
    wizardBusy = true;
    updateWizardSubmit();
    classCreationError.hidden = true;
    campaignCreateForm.setAttribute('aria-busy', 'true');

    try {
      const response = await fetchWithTimeout(joiningCampaignId ? `/api/campaigns/${joiningCampaignId}/join` : '/api/campaigns', {
        method: 'POST',
        body: JSON.stringify(body)
      }, CAMPAIGN_CREATE_TIMEOUT_MS);

      if (!response.ok) {
        const message = await getResponseErrorMessage(response, 'Server failed to start campaign');
        throw new Error(message);
      }

      const gameState = await response.json();
      if (submissionSerial !== wizardSerial || submissionEpoch !== sessionEpoch) return;
      wizardDrafts.delete(wizardDraftKey());
      if (joiningCampaignId) {
        myCharacterId = gameState.joinedCharacterId;
        localStorage.setItem(myCharacterKey(joiningCampaignId), String(myCharacterId));
      }
      currentCampaignId = gameState.campaignId;
      campaignWizardModal.style.display = 'none';
      renderGame(gameState, !joiningCampaignId, { narrate: !joiningCampaignId });
      if (joiningCampaignId) appendSystemNotice(`${body.characterName || displayedCharacter(gameState)?.name || 'A character'} joins the table.`);
      campaignMenuScreen.style.display = 'none';
    } catch (error) {
      if (submissionSerial !== wizardSerial || submissionEpoch !== sessionEpoch) return;
      console.error(error);
      classCreationError.textContent = error.message;
      classCreationError.hidden = false;
    } finally {
      if (submissionSerial === wizardSerial) {
        wizardBusy = false;
        campaignCreateForm.setAttribute('aria-busy', 'false');
        updateWizardSubmit();
      }
    }
  });

  // Action text submission
  actionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (composerIsComposing || turnSubmitInFlight) return;
    scanAndRenderComposer();
    if (pendingTargetAction && actionInput.value !== pendingTargetAction.playerAction) {
      const text = pendingTargetAction.playerAction;
      restoreComposerDraft(text, text.length, text.length);
      appendSystemNotice('This action is awaiting completion. Retry the submitted action before starting another.');
      return;
    }
    const actionText = actionInput.value;
    if (!actionText.trim() || !currentCampaignId) return;
    if (!ABILITY_TRIGGER_REVISION_PATTERN.test(activeAbilityTriggerRevision)) {
      appendSystemNotice('Your character abilities are still loading. Try again after the sheet refreshes.');
      return;
    }

    const draft = {
      text: actionText,
      selectionStart: actionInput.selectionStart ?? actionText.length,
      selectionEnd: actionInput.selectionEnd ?? actionText.length
    };
    const scope = captureComposerScope();
    let targetAction = null;
    if (lastGameState?.ruleset?.id === 'aetheria') {
      targetAction = pendingTargetAction || { requestId: createActionRequestId(), actor: `character:${scope.characterId}`,
        characterId: scope.characterId, playerAction: actionText, abilityTriggerRevision: scope.triggerRevision };
      try { localStorage.setItem(pendingActionKey(scope), JSON.stringify(targetAction)); }
      catch {
        appendSystemNotice('The action could not be saved for retry. Check browser storage before sending.');
        return;
      }
      pendingTargetAction = targetAction;
    }
    const optimisticBubble = appendPlayerAction(actionText, undefined, { optimistic: true });

    turnSubmitInFlight = true;
    setActionInputState(false);

    try {
      const response = await fetchWithTimeout(`/api/campaigns/${scope.campaignId}/turn`, {
        method: 'POST',
        body: JSON.stringify({
          playerAction: actionText,
          // Which character is speaking (Phase 3 M2/M3); harmless when solo
          characterId: scope.characterId ?? undefined,
          // Opaque echo only. Matches and ability IDs are recomputed server-side.
          abilityTriggerRevision: targetAction?.abilityTriggerRevision ?? scope.triggerRevision,
          ...(targetAction ? { requestId: targetAction.requestId } : {})
        })
      }, TURN_TIMEOUT_MS);

      if (!response.ok) {
        // Turn-order rejections (M2) are game rulings, not provider
        // failures: say whose turn it is, restore the input, and stop —
        // no "retry the connection" framing.
        const body = await response.json().catch(() => ({}));
        // A response for a table or character the player has since left may
        // still represent a committed turn, but it cannot touch this composer.
        if (!isComposerScopeCurrent(scope)) {
          optimisticBubble.remove();
          return;
        }
        if (body.code === 'ABILITY_TRIGGERS_STALE') {
          releasePendingAction(scope, targetAction?.requestId);
          optimisticBubble.remove();
          await refreshComposerAfterStale(scope, draft);
          return;
        }
        if (body.code === 'OUT_OF_TURN' || body.code === 'CHARACTER_REQUIRED') {
          releasePendingAction(scope, targetAction?.requestId);
          optimisticBubble.remove();
          appendSystemNotice(body.error || 'It is not your turn to act.');
          restoreComposerDraft(draft.text, draft.selectionStart, draft.selectionEnd);
          return;
        }
        if (body.code === 'CLASS_ACTION_PENDING') {
          optimisticBubble.remove();
          releasePendingAction(scope, targetAction?.requestId);
          const refreshed = await fetchWithTimeout(`/api/campaigns/${scope.campaignId}`, {}, 15000);
          if (!refreshed.ok) throw new Error('Could not reload the pending action.');
          const state = await refreshed.json();
          if (!isComposerScopeCurrent(scope)) return;
          lastGameState = state;
          renderPartyState(state);
          appendSystemNotice(body.error || 'This action is awaiting completion. Retry the submitted action before starting another.');
          return;
        }
        if (targetAction && ['CLASS_COUNCIL_REJECTED', 'CLASS_COUNCIL_GROUNDING', 'CLASS_COUNCIL_JSON', 'CLASS_COUNCIL_SHAPE'].includes(body.code)) {
          const refreshed = await fetchWithTimeout(`/api/campaigns/${scope.campaignId}`, {}, 15000);
          if (!refreshed.ok) throw new Error(body.error || 'Could not reload the action state.');
          const state = await refreshed.json();
          if (!isComposerScopeCurrent(scope)) { optimisticBubble.remove(); return; }
          const unreserved = Object.hasOwn(state, 'pendingAction') && state.pendingAction === null;
          if (unreserved) releasePendingAction(scope, targetAction.requestId);
          optimisticBubble.remove();
          lastGameState = state;
          renderPartyState(state);
          if (unreserved) restoreComposerDraft(draft.text, draft.selectionStart, draft.selectionEnd);
          appendSystemNotice(body.error || 'The action could not be resolved against the recorded scene.');
          return;
        }
        if (body.code === 'TURN_REQUEST_INVALID') releasePendingAction(scope, targetAction?.requestId);
        throw new Error(body.error || 'Failed to submit action');
      }

      const gameState = await response.json();
      releasePendingAction(scope, targetAction?.requestId);
      // The turn resolved on its original table/character. A later poll will
      // pick it up if the player switched while the request was in flight.
      if (!isComposerScopeCurrent(scope)) {
        optimisticBubble.remove();
        return;
      }
      // ds-1: never render a turn the log already shows — the poll's
      // monotonicity rule (see its `<=` check). The server numbers every
      // committed turn strictly upward, so an OK response at or below the
      // rendered head is a duplicate; rendering it would double the GM
      // narrative and replay dice theater and narration. The action itself
      // was accepted, so the composer still clears and the optimistic bubble
      // settles through the duplicate-aware path.
      if (typeof gameState.turn?.number === 'number' &&
          typeof lastRenderedTurnNumber === 'number' &&
          gameState.turn.number <= lastRenderedTurnNumber) {
        setComposerValue('', 0, 0, { focus: false });
        settleOptimisticPlayerAction(optimisticBubble, gameState.turn.number);
        return;
      }
      // Gap backfill (poll-1 r2): other players' turns may sit between the
      // last thing in this log and the turn this submit produced. Without
      // this, rendering the submit's turn buries them permanently — the
      // poll's own backfill dedupes against highestAppendedTurn and would
      // skip them afterward.
      const baseline = highestAppendedTurn ?? lastRenderedTurnNumber;
      if (typeof gameState.turn?.number === 'number' &&
          typeof baseline === 'number' &&
          gameState.turn.number > baseline + 1) {
        // Failure records the gap for the poll to retry (poll-1 r5): the
        // head still renders, but the missing turns are never sealed out.
        await backfillGap(baseline, gameState.turn.number, scope.epoch);
        if (!isComposerScopeCurrent(scope)) {
          optimisticBubble.remove();
          return;
        }
      }
      setComposerValue('', 0, 0, { focus: false });
      settleOptimisticPlayerAction(optimisticBubble, gameState.turn?.number);
      renderGame(gameState, false, { narrate: true, rollTheater: true });
    } catch (error) {
      console.error(error);
      // Decision 2026-07-03: transient failures surface OUTSIDE the GM's voice
      // as a retriable state, with the player's typed input restored — but
      // only on the table that submitted (poll-1 reopen): a stale failure
      // must not append notices, restore a foreign action into the input,
      // or pop Settings over the replacement table.
      optimisticBubble.remove();
      if (isComposerScopeCurrent(scope)) {
        appendSystemNotice(`Your action could not be sent (${error.message}). It remains below. Press send to retry.`);
        restoreComposerDraft(draft.text, draft.selectionStart, draft.selectionEnd);
        if (targetAction) {
          try {
            const response = await fetchWithTimeout(`/api/campaigns/${scope.campaignId}`, {}, 15000);
            if (response.ok && isComposerScopeCurrent(scope)) {
              const state = await response.json();
              if (isComposerScopeCurrent(scope)) { lastGameState = state; renderPartyState(state); }
            }
          } catch { /* The saved request remains retryable if the state refresh also fails. */ }
        }
        if (shouldOpenSettingsForError(error.message)) {
          openSettingsModal();
        }
      }
    } finally {
      turnSubmitInFlight = false;
      // Always re-enable the controls; but focus only when still on the
      // submitting character/table — a stale settle must not steal focus
      // from whatever the user is doing on a replacement sheet.
      setActionInputState(
        true,
        scope.epoch === sessionEpoch
          && scope.campaignId === currentCampaignId
          && scope.characterId === activeComposerCharacterId
      );
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

// Voice preview is deliberately campaign-free and always uses the active
// provider's reserved, server-owned narrator.
async function previewVoice() {
  const btn = document.getElementById('btn-voice-preview');
  btn.disabled = true;
  try {
    const response = await fetchWithTimeout('/api/audio/narrate', {
      method: 'POST',
      body: JSON.stringify({
        preview: true,
        segments: [{
          text: 'The torchlight gutters as you step into the vault. Whatever slept here is awake now — and it knows your name.',
          tone: 'tense'
        }]
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

function wizardDraftKey() {
  return wizardCampaign ? `join:${wizardCampaign.campaignId}` : 'create';
}

function saveWizardDraft() {
  wizardDrafts.set(wizardDraftKey(), {
    values: Object.fromEntries(WIZARD_FIELDS.map(id => {
      const input = document.getElementById(id);
      return [id, input.type === 'checkbox' ? input.checked : input.value];
    })),
    selection: classCreator?.getSelection()
  });
}

function updateWizardSubmit() {
  const needsSelection = selectRuleset.value === 'aetheria' && selectCharacterMode.value === 'new';
  const submit = document.getElementById('btn-submit-wizard');
  submit.disabled = wizardBusy || (needsSelection && !classCreator?.getSelection());
  document.getElementById('btn-close-wizard').disabled = wizardBusy;
  document.getElementById('btn-cancel-wizard').disabled = wizardBusy;
  submit.querySelector('span').textContent = wizardBusy
    ? wizardCampaign ? 'Joining...' : 'Creating...'
    : wizardCampaign ? 'Join campaign' : 'Start story';
}

function updateWizardRules() {
  const target = selectRuleset.value === 'aetheria';
  classCreator?.setEnabled(target && selectCharacterMode.value === 'new');
  document.getElementById('legacy-rules-fields').hidden = target;
  document.getElementById('class-campaign-support').hidden = !target;
  inputCharConcept.required = selectCharacterMode.value === 'new' && !target;
  riderSupport.disabled = !!wizardCampaign;
  alliedSupport.disabled = !!wizardCampaign;
  updateWizardSubmit();
}

function openCampaignWizard(campaign = null) {
  if (campaignWizardModal.style.display !== 'none') saveWizardDraft();
  wizardPreviousFocus = document.activeElement;
  wizardCampaign = campaign;
  wizardSerial += 1;
  wizardBusy = false;
  campaignCreateForm.setAttribute('aria-busy', 'false');
  const draft = wizardDrafts.get(wizardDraftKey());
  campaignCreateForm.reset();
  if (draft) {
    for (const [id, value] of Object.entries(draft.values)) {
      const input = document.getElementById(id);
      if (input.type === 'checkbox') input.checked = value;
      else input.value = value;
    }
  }
  if (campaign) {
    document.getElementById('input-genre').value = campaign.genre || '';
    selectRuleset.value = campaign.ruleset?.id === 'aetheria' ? 'aetheria' : campaign.ruleset ? 'house' : 'none';
    riderSupport.checked = Array.isArray(campaign.ruleset?.modules) && campaign.ruleset.modules.includes('rider');
    alliedSupport.checked = campaign.ruleset?.capabilities?.alliedActors === true;
  }
  document.getElementById('input-genre').required = !campaign;
  document.getElementById('campaign-wizard-title').textContent = campaign ? 'Join campaign' : 'New campaign';
  for (const id of ['campaign-genre-group', 'ruleset-group', 'campaign-table-style-fields']) {
    document.getElementById(id).hidden = !!campaign;
  }
  classCreationError.hidden = true;
  clearTimeout(catalogReloadTimer);
  if (selectRuleset.value === 'aetheria') classCreator.load(document.getElementById('input-genre').value, draft?.selection);
  updateCharacterModeUi();
  loadCharactersForWizard();
  campaignWizardModal.style.display = 'flex';
  (campaign ? inputCharName : document.getElementById('input-genre')).focus();
}

function closeCampaignWizard() {
  if (wizardBusy) return;
  saveWizardDraft();
  wizardSerial += 1;
  campaignWizardModal.style.display = 'none';
  if (wizardPreviousFocus?.isConnected) wizardPreviousFocus.focus();
}

function trapDialogFocus(event) {
  if (event.key !== 'Tab') return;
  const items = [...event.currentTarget.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]')]
    .filter(node => node.getClientRects().length > 0);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function openAbilityDrawer() {
  rememberComposerSelection();
  const drawer = document.getElementById('ability-drawer');
  document.getElementById('ability-drawer-slot').appendChild(charAbilities);
  drawer.hidden = false;
  document.getElementById('btn-open-abilities').setAttribute('aria-expanded', 'true');
  (charAbilities.querySelector('button:not(:disabled)') || document.getElementById('btn-close-abilities')).focus();
}

function closeAbilityDrawer(focus = true) {
  const drawer = document.getElementById('ability-drawer');
  if (!drawer || drawer.hidden) return;
  document.getElementById('ability-list-home').appendChild(charAbilities);
  drawer.hidden = true;
  document.getElementById('btn-open-abilities').setAttribute('aria-expanded', 'false');
  if (focus) actionInput.focus();
}

// === In-app confirm/prompt dialogs =========================================
// Native confirm()/prompt() are no-ops inside the Tauri (WKWebView) desktop
// shell — confirm() silently returns false and prompt() silently returns
// null there, which would abort destructive and input flows without ever
// showing the user anything. These reuse the same .modal / .modal-content /
// .modal-header / .modal-body / .form-actions structure as the settings and
// campaign wizard modals above, so they share the app's existing look.
function uiDialogShell(titleText) {
  const previouslyFocused = document.activeElement;
  const overlay = document.createElement('div');
  overlay.className = 'modal';

  const content = document.createElement('div');
  content.className = 'modal-content glass-card';
  content.style.maxWidth = '440px';
  overlay.appendChild(content);

  const header = document.createElement('div');
  header.className = 'modal-header';
  content.appendChild(header);
  const heading = document.createElement('h2');
  heading.textContent = titleText;
  header.appendChild(heading);
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'btn-close';
  closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.className = 'modal-body';
  content.appendChild(body);

  document.body.appendChild(overlay);
  return { overlay, body, closeBtn, previouslyFocused };
}

// Ask a yes/no question. Resolves true on confirm, false on cancel/Escape —
// same polarity as window.confirm() so call sites convert with `await`.
function uiConfirm(message, opts = {}) {
  const { danger = false, confirmLabel = 'Confirm', cancelLabel = 'Cancel' } = opts;
  return new Promise((resolve) => {
    const { overlay, body, closeBtn, previouslyFocused } = uiDialogShell(danger ? 'Are you sure?' : 'Confirm');

    const form = document.createElement('form');
    body.appendChild(form);

    const msg = document.createElement('p');
    msg.style.whiteSpace = 'pre-line';
    msg.textContent = message;
    form.appendChild(msg);

    const actions = document.createElement('div');
    actions.className = 'form-actions';
    form.appendChild(actions);

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = cancelLabel;
    actions.appendChild(cancelBtn);

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'submit';
    confirmBtn.className = danger ? 'btn btn-danger' : 'btn btn-primary';
    confirmBtn.textContent = confirmLabel;
    actions.appendChild(confirmBtn);

    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      document.removeEventListener('keydown', onKeydown, true);
      overlay.remove();
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') previouslyFocused.focus();
      resolve(result);
    };
    const onKeydown = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    };
    document.addEventListener('keydown', onKeydown, true);

    form.addEventListener('submit', (e) => { e.preventDefault(); finish(true); });
    cancelBtn.addEventListener('click', () => finish(false));
    closeBtn.addEventListener('click', () => finish(false));

    confirmBtn.focus();
  });
}

// Ask for a line of text. Resolves the entered string, or null on
// cancel/Escape — same polarity as window.prompt().
function uiPrompt(message, opts = {}) {
  const { placeholder = '', defaultValue = '', confirmLabel = 'OK' } = opts;
  return new Promise((resolve) => {
    const { overlay, body, closeBtn, previouslyFocused } = uiDialogShell('Input Needed');

    const form = document.createElement('form');
    body.appendChild(form);

    const msg = document.createElement('p');
    msg.style.whiteSpace = 'pre-line';
    msg.textContent = message;
    form.appendChild(msg);

    const fieldGroup = document.createElement('div');
    fieldGroup.className = 'form-group';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = placeholder;
    input.value = defaultValue;
    fieldGroup.appendChild(input);
    form.appendChild(fieldGroup);

    const actions = document.createElement('div');
    actions.className = 'form-actions';
    form.appendChild(actions);

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = 'Cancel';
    actions.appendChild(cancelBtn);

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'submit';
    confirmBtn.className = 'btn btn-primary';
    confirmBtn.textContent = confirmLabel;
    actions.appendChild(confirmBtn);

    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      document.removeEventListener('keydown', onKeydown, true);
      overlay.remove();
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') previouslyFocused.focus();
      resolve(result);
    };
    const onKeydown = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); finish(null); }
    };
    document.addEventListener('keydown', onKeydown, true);

    form.addEventListener('submit', (e) => { e.preventDefault(); finish(input.value); });
    cancelBtn.addEventListener('click', () => finish(null));
    closeBtn.addEventListener('click', () => finish(null));

    input.focus();
    input.select();
  });
}

// Read-only "copy this value" dialog. For prompt() calls that only ever
// displayed a value (e.g. a freshly minted seat token) rather than
// collecting input — a real uiPrompt would let the value be edited or
// cleared by accident before it's copied.
function uiShowCopyDialog(message, value, opts = {}) {
  const { confirmLabel = 'Done' } = opts;
  return new Promise((resolve) => {
    const { overlay, body, closeBtn, previouslyFocused } = uiDialogShell('Copy This Value');

    const msg = document.createElement('p');
    msg.style.whiteSpace = 'pre-line';
    msg.textContent = message;
    body.appendChild(msg);

    const fieldGroup = document.createElement('div');
    fieldGroup.className = 'form-group';
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.gap = '8px';

    const input = document.createElement('input');
    input.type = 'text';
    input.readOnly = true;
    input.value = value;
    input.style.flex = '1';
    row.appendChild(input);

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'btn btn-secondary';
    copyBtn.textContent = 'Copy';
    row.appendChild(copyBtn);
    fieldGroup.appendChild(row);
    body.appendChild(fieldGroup);

    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(value);
        copyBtn.textContent = 'Copied!';
      } catch (err) {
        input.focus();
        input.select();
        try {
          document.execCommand('copy');
          copyBtn.textContent = 'Copied!';
        } catch (fallbackErr) {
          copyBtn.textContent = 'Copy failed';
        }
      }
      setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
    });

    const actions = document.createElement('div');
    actions.className = 'form-actions';
    body.appendChild(actions);
    const doneBtn = document.createElement('button');
    doneBtn.type = 'button';
    doneBtn.className = 'btn btn-primary';
    doneBtn.textContent = confirmLabel;
    actions.appendChild(doneBtn);

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      document.removeEventListener('keydown', onKeydown, true);
      overlay.remove();
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') previouslyFocused.focus();
      resolve();
    };
    const onKeydown = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); finish(); }
    };
    document.addEventListener('keydown', onKeydown, true);

    doneBtn.addEventListener('click', finish);
    closeBtn.addEventListener('click', finish);

    input.focus();
    input.select();
  });
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
  updateWizardRules();

  if (!isNew) {
    populateSavedCharacterSelect(mode);
  }
}

function populateSavedCharacterSelect(mode) {
  const previous = selectSavedCharacter.value || wizardDrafts.get(wizardDraftKey())?.values['select-saved-character'];
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

  selectSavedCharacter.value = [...selectSavedCharacter.options].some(item => item.value === previous && !item.disabled)
    ? previous : firstUsableValue;
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
  const classText = selected.classBuild ? `${selected.archetype}. ` : '';
  const energyText = selected.classBuild ? '' : `, Energy ${selected.mana}/${selected.max_mana}`;
  savedCharacterSummary.textContent = `${classText}${statusText}. HP ${selected.health}/${selected.max_health}${energyText}, XP ${selected.xp}. Abilities: ${abilityText}.`;
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

// Routes startup (and token changes) to the right session kind: a seat
// token bootstraps straight into its bound campaign — seats never see the
// campaign list (S3); anything else lands on the host campaign menu.
function bootstrapSession() {
  seatMode = isSeatToken(apiConfig.accessToken);
  applySeatChrome();
  if (seatMode) {
    enterSeatSession();
  } else {
    seatCharacterId = null;
    campaignMenuScreen.style.display = 'flex';
    loadCampaignsMenu();
  }
}

// Host-only chrome that per-state rendering does not already govern.
function applySeatChrome() {
  document.getElementById('btn-show-campaigns').style.display = seatMode ? 'none' : '';
  const wizardTrigger = document.getElementById('btn-new-campaign-trigger');
  if (wizardTrigger) wizardTrigger.style.display = seatMode ? 'none' : '';
}

async function enterSeatSession() {
  showLoadingOverlay('Taking your seat at the table...');
  try {
    const response = await fetchWithTimeout('/api/seat/session');
    if (!response.ok) {
      throw new Error(response.status === 401
        ? 'This seat token is invalid or has been revoked. Ask your host for a fresh one.'
        : await getResponseErrorMessage(response, 'Could not load your seat'));
    }
    const state = await response.json();
    currentCampaignId = state.campaignId;
    seatCharacterId = state.seatCharacterId ?? null;
    campaignMenuScreen.style.display = 'none';
    renderGame(state, true);
  } catch (error) {
    showToast(`Seat: ${error.message}`, 'error');
    enterHolodeckIdle();
    campaignMenuScreen.style.display = 'flex';
    campaignListContainer.innerHTML = DOMPurify.sanitize(`
      <div class="empty-state">
        <i class="fa-solid fa-chair"></i>
        <p>Your seat could not be loaded.</p>
        <p style="font-size: 12px; margin-top: 8px;">Check the seat token in Settings, or ask your host to mint a fresh one.</p>
      </div>`);
    openSettingsModal();
  } finally {
    hideLoadingOverlay();
  }
}

async function loadCampaignsMenu() {
  // Seats have no campaign list (the route is host-only); their entry
  // point is the seat session bootstrap above.
  if (seatMode) return;
  // Leaving a campaign for the menu: stop the poll and drop per-campaign
  // state so a stale campaign can never render over the holodeck idle.
  bumpSessionEpoch();
  currentCampaignId = null;
  lastGameState = null;
  lastRenderedTurnNumber = null;
  myCharacterId = null;
  pendingGaps = [];
  characterNamesById = new Map();
  enterHolodeckIdle();
  // Whoever loads the menu owns the screen (poll-1 r3): when this runs as
  // a settle callback (campaign delete/release) it may have superseded an
  // in-flight campaign load that already hid the menu — that load discards
  // itself on the epoch check, so without this line NOTHING is visible.
  campaignMenuScreen.style.display = 'flex';
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
  bumpSessionEpoch();
  const epoch = sessionEpoch;

  try {
    const response = await fetchWithTimeout(`/api/campaigns/${campaignId}`);
    if (!response.ok) throw new Error(response.status === 401 ? 'Unauthorized. Check Access Token.' : 'Failed to load campaign data');

    const gameState = await response.json();
    if (epoch !== sessionEpoch) return; // superseded by a newer transition
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
  // dr-1: only the menu that asked may reload itself when this settles.
  // If the user has since entered a table — or does so during the confirm
  // dialog, whose overlay blocks pointers but is not a focus trap —
  // reloading the menu would wipe that table's state and theme.
  const epoch = sessionEpoch;
  const confirmed = await uiConfirm('Are you sure you want to delete this campaign? All history will be lost.', { danger: true, confirmLabel: 'Delete' });
  if (!confirmed) return;

  try {
    const response = await fetchWithTimeout(`/api/campaigns/${campaignId}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Delete request failed');
    if (epoch === sessionEpoch) loadCampaignsMenu();
    showToast('Campaign deleted.', 'info');
  } catch (err) {
    showToast(`Delete Error: ${err.message}`, 'error');
  }
};

window.releaseCampaignCharacter = async function (campaignId) {
  // dr-1: same settle rule as deleteCampaign above — the menu reload only
  // belongs to the session that asked for the release.
  const epoch = sessionEpoch;
  const confirmed = await uiConfirm('Release this campaign character profile for use in new campaigns? The current campaign keeps a local snapshot.', { confirmLabel: 'Release' });
  if (!confirmed) return;

  try {
    const response = await fetchWithTimeout(`/api/campaigns/${campaignId}/release-character`, {
      method: 'POST'
    });
    if (!response.ok) {
      const message = await getResponseErrorMessage(response, 'Release request failed');
      throw new Error(message);
    }
    if (epoch === sessionEpoch) loadCampaignsMenu();
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
  // Act structure belongs to the outline; seat payloads do not carry it.
  activeActBadge.style.display = seatMode ? 'none' : '';
  activeActBadge.textContent = `Act ${gameState.currentAct || 1}`;

  // Update Outline List
  renderOutline(gameState.outline, gameState.currentAct);

  // Party & turn order (Phase 3 M3): who this browser plays, the party
  // strip, and the off-turn input state. The sheet shows YOUR character.
  lastGameState = gameState;
  lastRenderedTurnNumber = gameState.turn?.number ?? lastRenderedTurnNumber;
  // Track the furthest narrative in the log (poll-1 r2). A full reset
  // (campaign load/fork) re-anchors it; incremental renders only advance it.
  if (resetNarrative) {
    appendedTurnNumbers = new Set();
    pendingGaps = [];
    // renderParty below refills this from the incoming table's own party.
    characterNamesById = new Map();
  }
  // Append-once (jd-1). The transcript is append-only, so an INCREMENTAL
  // render must never re-append a turn the log already shows. Callers that
  // hand renderGame the current head state rather than a new turn — the join
  // flow does exactly that — would otherwise duplicate the GM narrative, its
  // dice cards and its scene grounding. Membership, not a watermark, for the
  // same reason appendJournalTurns uses it: gap recovery legitimately appends
  // turns BELOW the watermark. Read BEFORE the add below, which records this
  // turn as present. Panels (party, sheet, situation, choices) still re-render:
  // they replace rather than append, and a join must refresh them.
  const alreadyInLog = !resetNarrative
    && typeof gameState.turn?.number === 'number'
    && appendedTurnNumbers.has(gameState.turn.number);
  if (typeof gameState.turn?.number === 'number') {
    highestAppendedTurn = resetNarrative
      ? gameState.turn.number
      : Math.max(highestAppendedTurn ?? gameState.turn.number, gameState.turn.number);
    appendedTurnNumbers.add(gameState.turn.number);
  } else if (resetNarrative) {
    highestAppendedTurn = null;
  }
  resolveMyCharacter(gameState);
  renderParty(gameState);
  updateTurnBanner(gameState);
  renderCharacterSheet(displayedCharacter(gameState));
  reconcilePendingAction(gameState);

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
  // A turn already in the log is re-rendered, never re-appended (jd-1):
  // no second narrative, no second dice card, no replayed theater or
  // narration for a beat the player has already lived through.
  if (!alreadyInLog) {
    const turnRolls = Array.isArray(gameState.turn.rollResults)
      ? gameState.turn.rollResults
      : (gameState.turn.rollResult ? [gameState.turn.rollResult] : []);
    turnRolls.forEach(r => appendRollResultBubble(r, gameState.turn?.number, gameState.turn.rollAnnotationDetails));
    // Theater only on turns that just happened (own submit, poll pickup) —
    // never on campaign load, join, or backfill, where the rolls are history.
    if (options.rollTheater) queueRollTheater(turnRolls);
    appendGMDialogue(gameState.turn.narrative, gameState.turn?.number);
    if (options.narrate) {
      narrateGmResponse(gameState.turn);
    }

    // Scene grounding — especially valuable on clarification turns
    if (gameState.turn.sceneGrounding) {
      appendSceneGrounding(gameState.turn.sceneGrounding, gameState.turn?.number);
    }
  }

  // If the active tab is Journal, refresh the timeline
  if (tabJournalBtn.classList.contains('active')) {
    loadJournalTimeline();
  }

  // Suggested choices
  renderChoices(gameState.turn.suggestedChoices || []);
  renderPendingRolls(gameState);
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
// Furthest turn whose narrative is in the log (poll-1 r2): the baseline
// for gap detection.
let highestAppendedTurn = null;
// Exact turns present in the log (poll-1 r5): dedupe must be membership,
// not a watermark — gap RECOVERY legitimately appends turns BELOW the
// watermark after a transient journal failure.
let appendedTurnNumbers = new Set();
// Ranges a failed backfill could not fill (inclusive bounds). Every poll
// tick retries them: a flaky journal request must not permanently seal
// other players' turns out of the shared transcript.
let pendingGaps = [];
// Author names for the shared transcript (pa-1), keyed by character id. Every
// party this browser sees feeds the map, so a turn stays attributed to its
// author even after that player leaves the table (a released character drops
// out of the party payload but its history keeps its character_id). Cleared
// with the rest of the per-campaign state — a name from one table must never
// label a turn at another.
let characterNamesById = new Map();

function rememberCharacterNames(party) {
  (party || []).forEach(member => {
    if (!member || typeof member.name !== 'string') return;
    const id = Number(member.id);
    if (Number.isInteger(id)) characterNamesById.set(id, member.name);
  });
}

// Whose action this is. In multiplayer the transcript is SHARED: labelling
// every entry "You" tells each player their partymates' deeds are their own.
// `myCharacterId` is the one identity mechanism this client has (seat
// credential, stored claim, or sole-member auto-claim) — this reuses it
// rather than adding a second notion of "me".
//
// `fallbackLabel` covers turns with no recorded author — solo campaigns,
// pre-attribution rows, the opening scene — which must render exactly as they
// did before attribution existed.
function turnAuthorLabel(characterId, fallbackLabel) {
  if (characterId === null || characterId === undefined) return fallbackLabel;
  const id = Number(characterId);
  if (!Number.isInteger(id)) return fallbackLabel;
  if (myCharacterId !== null && id === myCharacterId) return 'You';
  // A character who has left the table is no longer in any party we can see,
  // so there is no name to show — but it is still NOT this browser's action.
  return characterNamesById.get(id) || 'Another player';
}

// Places a log node at its chronological position: nodes carry data-turn,
// and a tagged node goes before the first node with a HIGHER turn — so
// late gap recovery lands in reading order, not at the log's tail.
function placeLogEntry(el, turnNumber) {
  if (typeof turnNumber === 'number') {
    el.dataset.turn = String(turnNumber);
    const nodes = narrativeContainer.children;
    for (let i = 0; i < nodes.length; i++) {
      const t = Number(nodes[i].dataset ? nodes[i].dataset.turn : NaN);
      if (Number.isFinite(t) && t > turnNumber) {
        narrativeContainer.insertBefore(el, nodes[i]);
        return;
      }
    }
  }
  narrativeContainer.appendChild(el);
}

// Appends journal turns in chronological order, skipping any turn already
// in the log. Membership is checked at APPEND time, which makes racing
// backfills (poll vs submit vs recovery) safe against both duplication
// and loss.
function appendJournalTurns(turns) {
  (turns || [])
    .filter(t => t && typeof t.turn_number === 'number')
    .sort((a, b) => a.turn_number - b.turn_number)
    .forEach(t => {
      if (appendedTurnNumbers.has(t.turn_number)) return;
      if (t.player_action) {
        appendPlayerAction(t.player_action, t.turn_number, { characterId: t.character_id ?? null });
      }
      if (Array.isArray(t.dice_rolls)) t.dice_rolls.forEach(roll => appendRollResultBubble(roll, t.turn_number, t.rollAnnotationDetails));
      appendGMDialogue(t.narrative, t.turn_number);
      appendedTurnNumbers.add(t.turn_number);
      highestAppendedTurn = Math.max(highestAppendedTurn ?? t.turn_number, t.turn_number);
    });
}

// Fetches the journal and fills the EXCLUSIVE range (fromExclusive,
// toExclusive). Any failure records the range in pendingGaps for the next
// poll tick to retry (poll-1 r5).
async function backfillGap(fromExclusive, toExclusive, epoch) {
  try {
    const journalResponse = await fetchWithTimeout(`/api/campaigns/${currentCampaignId}/journal`, {}, 15000);
    if (epoch !== sessionEpoch) return;
    if (!journalResponse.ok) throw new Error(`journal ${journalResponse.status}`);
    const journal = await journalResponse.json();
    if (epoch !== sessionEpoch) return;
    appendJournalTurns((journal.turns || [])
      .filter(t => t && t.turn_number > fromExclusive && t.turn_number < toExclusive));
  } catch (e) {
    // A STALE failure must not seed the replacement table's retry queue
    // (poll-1 r6): pendingGaps is per-table state, and this request was
    // for a table we already left.
    if (epoch !== sessionEpoch) return;
    const from = fromExclusive + 1, to = toExclusive - 1;
    if (to >= from && !pendingGaps.some(g => g.from === from && g.to === to)) {
      pendingGaps.push({ from, to });
    }
  }
}

function myCharacterKey(campaignId) {
  return `aetheria_my_character_${campaignId}`;
}

// Resolves which party member this browser plays: stored claim first, then
// the only member of a solo campaign, then a fresh join.
function resolveMyCharacter(gameState) {
  const party = gameState.party || [];
  // Seat sessions have a fixed identity: the credential IS the character
  // (S2). No claims, no localStorage machinery, no auto-claim.
  if (seatMode) {
    seatCharacterId = gameState.seatCharacterId ?? seatCharacterId;
    const mine = party.find(c => c.id === seatCharacterId) || null;
    myCharacterId = mine ? mine.id : null;
    return mine;
  }
  const storedRaw = localStorage.getItem(myCharacterKey(currentCampaignId));
  let mine = storedRaw ? party.find(c => c.id === Number(storedRaw)) || null : null;
  if (!mine && gameState.joinedCharacterId) {
    mine = party.find(c => c.id === gameState.joinedCharacterId) || null;
  }
  // Auto-claim the sole member only when this browser never claimed anyone:
  // if OUR character left the party, the remaining member belongs to another
  // player — never silently take over their character.
  if (!mine && !storedRaw && party.length === 1) mine = party[0];
  if (!mine && !storedRaw && gameState.character?.id && party.length <= 1) mine = gameState.character;
  if (!mine && storedRaw) {
    // Durable tombstone (cr-1): our character left this table. REMOVING the
    // key would recreate the never-claimed state, and the sole-member
    // auto-claim above would take over ANOTHER player's character on the
    // very next poll. The sentinel keeps the guard closed until the player
    // explicitly claims a character or joins.
    localStorage.setItem(myCharacterKey(currentCampaignId), 'departed');
  }
  myCharacterId = mine ? mine.id : null;
  if (mine) localStorage.setItem(myCharacterKey(currentCampaignId), String(mine.id));
  return mine;
}

function renderParty(gameState) {
  const strip = document.getElementById('party-strip');
  const party = gameState.party || [];
  // The party strip is where character names become visible; it is also the
  // one place both render paths pass through, so it feeds the transcript's
  // author names (pa-1).
  rememberCharacterNames(party);
  const actingId = gameState.turnOrder?.actingCharacterId ?? null;
  strip.style.display = '';
  strip.innerHTML = party.map(member => {
    const classes = ['party-member'];
    if (member.id === myCharacterId) classes.push('is-you');
    if (member.id === actingId) classes.push('is-acting');
    // Seats cannot switch identity: chips are informational, not claims.
    const chipTitle = seatMode ? escapeHtml(member.name) : `Play as ${escapeHtml(member.name)}`;
    const mintBtn = seatMode ? '' :
      `<button type="button" class="party-seat-btn" data-seat-character-id="${member.id}" data-seat-character-name="${escapeHtml(member.name)}" title="Mint a seat token for ${escapeHtml(member.name)} (replaces any existing token)"><i class="fa-solid fa-key"></i></button>`;
    return `<button type="button" class="${classes.join(' ')}${seatMode ? ' seat-static' : ''}" data-character-id="${member.id}" title="${chipTitle}">` +
      `${member.id === actingId ? '<i class="fa-solid fa-circle-play"></i> ' : ''}${escapeHtml(member.name)}` +
      `${member.id === myCharacterId ? ' <span class="party-you">you</span>' : ''}` +
      `<span class="party-hp">${member.health}/${member.max_health}</span></button>${mintBtn}`;
  }).join('') +
    (seatMode ? '' : `<button type="button" class="party-member party-join" id="party-join-btn" title="Join this table with a new character"><i class="fa-solid fa-user-plus"></i> Join</button>`);

  if (seatMode) return; // The claim/join flow is host-mode only (S3).

  strip.querySelectorAll('.party-member[data-character-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      myCharacterId = Number(btn.dataset.characterId);
      localStorage.setItem(myCharacterKey(currentCampaignId), String(myCharacterId));
      if (lastGameState) renderPartyState(lastGameState);
    });
  });
  strip.querySelectorAll('.party-seat-btn').forEach(btn => {
    btn.addEventListener('click', () =>
      mintSeatFlow(Number(btn.dataset.seatCharacterId), btn.dataset.seatCharacterName)
    );
  });
  strip.querySelector('#party-join-btn').addEventListener('click', joinTableFlow);
}

// Host mints (or rotates) the one seat credential bound to a character
// (S1 route, S3 flow). The token is shown exactly once; minting again
// replaces it, which is also the recovery path for a leaked token.
async function mintSeatFlow(characterId, characterName) {
  const confirmed = await uiConfirm(`Mint a seat token for ${characterName}?\n\nAny previous token for this character stops working immediately.`, { danger: true, confirmLabel: 'Mint Token' });
  if (!confirmed) return;
  try {
    const response = await fetchWithTimeout(`/api/campaigns/${currentCampaignId}/characters/${characterId}/seat`, {
      method: 'POST'
    });
    if (!response.ok) throw new Error(await getResponseErrorMessage(response, 'Failed to mint seat token'));
    const seat = await response.json();
    await uiShowCopyDialog(
      `Seat token for ${seat.characterName} — shown ONCE. Copy it and send it to that player only; they paste it as their access token in Settings:`,
      seat.seatToken
    );
  } catch (error) {
    showToast(`Seat: ${error.message}`, 'error');
  }
}

async function joinTableFlow() {
  if (lastGameState && lastGameState.campaignId === currentCampaignId) openCampaignWizard(lastGameState);
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
  reconcilePendingAction(gameState);
  renderPendingRolls(gameState);
}

function displayedCharacter(gameState) {
  const party = gameState.party || [];
  // A seat's sheet is always its own character — partymates arrive as
  // silhouettes (no attributes/inventory) and cannot be displayed.
  if (seatMode) return party.find(c => c.id === seatCharacterId) || gameState.character;
  return party.find(c => c.id === myCharacterId) || gameState.character;
}

// Shared-table freshness (v1): poll for new turns so every browser sees the
// shared narrative without reloading. Runs for ANY loaded campaign — the
// founding browser must discover joiners, and its own lastGameState only
// changes when someone else acts (a stale party-size gate would never open).
let turnSubmitInFlight = false;
let pollInFlight = false;
setInterval(async () => {
  if (!currentCampaignId || document.hidden || !lastGameState) return;
  // Never race an in-flight submit: the submit's own render owns that turn.
  // Serialize polls too — overlapping polls can resolve out of order.
  if (turnSubmitInFlight || pollInFlight) return;
  pollInFlight = true;
  // Stale-response guard (poll-1): everything below renders only if the
  // table is still the one this poll was dispatched against.
  const epoch = sessionEpoch;
  try {
    const response = await fetchWithTimeout(`/api/campaigns/${currentCampaignId}`, {}, 15000);
    if (epoch !== sessionEpoch) return; // table changed while fetching
    if (turnSubmitInFlight) return; // submit started while we were fetching
    if (!response.ok) return;
    const state = await response.json();
    if (epoch !== sessionEpoch) return;
    // Learn this snapshot's party BEFORE anything appends to the transcript
    // (pa-1): a player who joined and acted since the last render is only
    // nameable from the payload that carries their turn.
    rememberCharacterNames(state.party);
    // Retry gaps a failed backfill left behind (poll-1 r5) — on EVERY tick,
    // same-turn branch included; recovered turns insert in reading order
    // via placeLogEntry and dedupe by membership.
    if (pendingGaps.length) {
      const gaps = pendingGaps;
      pendingGaps = [];
      for (const g of gaps) {
        await backfillGap(g.from - 1, g.to + 1, epoch);
        if (epoch !== sessionEpoch) return;
      }
      if (turnSubmitInFlight) return;
    }
    if (state.turn?.number !== lastRenderedTurnNumber) {
      // Within one campaign turn numbers only grow; an older snapshot is a
      // stale response that lost a race, never something to render.
      if (typeof lastRenderedTurnNumber === 'number' &&
          typeof state.turn?.number === 'number' &&
          state.turn.number < lastRenderedTurnNumber) return;
      // More than one turn may have landed between polls (table talk does
      // not advance the order, so bursts happen): backfill the gap from the
      // journal so the log stays complete, then render the latest normally.
      // The append helper dedupes at append time against whatever a racing
      // submit backfilled meanwhile (poll-1 r2) — no turn duplicates, none
      // are lost.
      const gapBaseline = highestAppendedTurn ?? lastRenderedTurnNumber;
      if (typeof gapBaseline === 'number' && state.turn.number > gapBaseline + 1) {
        await backfillGap(gapBaseline, state.turn.number, epoch);
      }
      if (epoch !== sessionEpoch) return;
      // Re-check AFTER the backfill awaits: a same-campaign submit never
      // bumps the epoch but may have rendered a newer turn while the
      // journal was in flight — rendering this snapshot would roll the
      // table backward (duplicate log entries, reverted theme/party/dice).
      if (turnSubmitInFlight) return;
      if (typeof state.turn?.number === 'number' &&
          typeof lastRenderedTurnNumber === 'number' &&
          state.turn.number <= lastRenderedTurnNumber) return;
      if (state.turn?.playerAction) {
        appendPlayerAction(state.turn.playerAction, state.turn.number,
          { characterId: state.turn.characterId ?? null });
      }
      renderGame(state, false, { rollTheater: true });
    } else {
      // Same turn, possibly changed table (joins, releases, style edits):
      // adopt the fresh snapshot so chip clicks re-render current data.
      lastGameState = state;
      renderPartyState(state);
    }
  } catch (e) { /* transient — next poll retries */ }
  finally { pollInFlight = false; }
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
    if (currentNarrationFinish) {
      currentNarrationFinish();
    } else {
      URL.revokeObjectURL(currentNarrationAudio.src);
      currentNarrationAudio = null;
    }
  }
  document.getElementById('btn-skip-narration').style.display = 'none';
}

function playAudioBlob(blob) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const audio = new Audio(objectUrl);
    let settled = false;
    const finish = error => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(objectUrl);
      if (currentNarrationAudio === audio) currentNarrationAudio = null;
      if (currentNarrationFinish === finish) currentNarrationFinish = null;
      if (error) reject(error); else resolve();
    };
    currentNarrationAudio = audio;
    currentNarrationFinish = finish;
    audio.addEventListener('ended', () => finish(), { once: true });
    audio.addEventListener('error', () => finish(new Error('Voice audio playback failed.')), { once: true });
    audio.play().catch(finish);
  });
}

async function loadVoiceCapabilities() {
  const response = await fetchWithTimeout('/api/audio/capabilities', {}, 5000);
  if (!response.ok) throw new Error('Voice capabilities unavailable.');
  return response.json();
}

async function requestNarrationRun(run, expectedProvider) {
  const response = await fetchWithTimeout('/api/audio/narrate', {
    method: 'POST',
    body: JSON.stringify({
      campaignId: currentCampaignId,
      speaker: run.speaker,
      segments: run.segments,
      ...(expectedProvider ? { expectedProvider } : {})
    })
  }, 90000);
  if (!response.ok) {
    const raw = await response.text();
    let payload = null;
    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      // Preserve a non-JSON server message below.
    }
    const error = new Error(payload?.error || raw || 'Voice narration failed');
    if (typeof payload?.code === 'string') error.code = payload.code;
    throw error;
  }
  return response.blob();
}

// The production helper groups adjacent same-speaker lines for providers that
// support it, preserves each tone, and skips failed runs instead of silencing
// the remainder of the GM turn.
// ---- Save-once turn audio (Phase V4) ----
// The server synthesizes a turn at most once, persists it, and replays the
// identical audio to every seat afterwards. These helpers drive both the
// per-message play buttons and new-turn auto-play.

let activeTurnAudio = null; // { turnNumber, button } while a saved turn plays

function updateVoiceAutoPlayButton() {
  const btn = document.getElementById('btn-voice-autoplay');
  if (!btn) return;
  btn.style.display = apiConfig.voiceNarration ? 'inline-flex' : 'none';
  const on = apiConfig.voiceAutoPlay !== false;
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  btn.innerHTML = `<i class="fa-solid ${on ? 'fa-volume-high' : 'fa-volume-xmark'}"></i> Auto-play: ${on ? 'on' : 'off'}`;
}

function toggleVoiceAutoPlay() {
  apiConfig.voiceAutoPlay = apiConfig.voiceAutoPlay === false ? true : false;
  localStorage.setItem('aetheria_settings', JSON.stringify(apiConfig));
  updateVoiceAutoPlayButton();
}

function setTurnAudioButtonState(button, playing) {
  if (!button) return;
  button.classList.toggle('playing', playing);
  button.title = playing ? 'Stop narration' : 'Play narration';
  button.innerHTML = playing
    ? '<i class="fa-solid fa-stop"></i>'
    : '<i class="fa-solid fa-volume-high"></i>';
}

// Fetches (materializing on first listen) and plays one turn's saved audio.
async function playSavedTurnAudio(turnNumber, button = null) {
  stopNarration();
  const token = {};
  narrationQueueToken = token;
  activeTurnAudio = { turnNumber, button };
  setTurnAudioButtonState(button, true);
  const skipBtn = document.getElementById('btn-skip-narration');
  skipBtn.style.display = 'inline-flex';
  try {
    // The first listen may synthesize server-side — allow generous time.
    const manifestResponse = await fetchWithTimeout(
      `/api/campaigns/${currentCampaignId}/audio/${turnNumber}`, {}, 180000
    );
    if (!manifestResponse.ok) {
      const raw = await manifestResponse.text();
      let payload = null;
      try {
        payload = raw ? JSON.parse(raw) : null;
      } catch {
        // Preserve a non-JSON server message below.
      }
      const error = new Error(payload?.error || 'Turn narration is unavailable.');
      error.status = manifestResponse.status;
      throw error;
    }
    const manifest = await manifestResponse.json();
    const segments = Array.isArray(manifest.segments) ? manifest.segments : [];
    for (const segment of segments) {
      if (narrationQueueToken !== token) return { cancelled: true };
      const segmentResponse = await fetchWithTimeout(
        `/api/campaigns/${currentCampaignId}/audio/${turnNumber}/segments/${segment.id}`, {}, 60000
      );
      if (!segmentResponse.ok) throw new Error('Voice audio unavailable.');
      const blob = await segmentResponse.blob();
      if (narrationQueueToken !== token) return { cancelled: true };
      await playAudioBlob(blob);
    }
    return { cancelled: false };
  } finally {
    setTurnAudioButtonState(button, false);
    if (activeTurnAudio && activeTurnAudio.button === button) activeTurnAudio = null;
    if (narrationQueueToken === token) {
      narrationQueueToken = null;
      skipBtn.style.display = 'none';
    }
  }
}

// Per-message play/stop (the on-demand path): gated only by the master
// voice enable — the auto-play preference does not apply here.
async function toggleTurnAudioPlayback(turnNumber, button) {
  if (activeTurnAudio && activeTurnAudio.turnNumber === turnNumber && narrationQueueToken) {
    stopNarration();
    return;
  }
  if (!apiConfig.voiceNarration) {
    showToast('Enable voice narration in AI Settings to play audio.', 'error');
    return;
  }
  try {
    await playSavedTurnAudio(turnNumber, button);
  } catch (error) {
    console.error(error);
    showToast(`Voice Error: ${error.message}`, 'error');
  }
}

async function narrateGmResponse(turn) {
  if (!apiConfig.voiceNarration) return;
  // Auto-play is a gameplay-area preference (V4); the per-message play
  // button stays available when it is off.
  if (apiConfig.voiceAutoPlay === false) return;
  const epoch = sessionEpoch;

  // Prefer the saved (save-once) performance: every seat hears the same
  // audio and a replay never pays for a second synthesis.
  const savedTurnNumber = Number(turn?.number);
  if (Number.isInteger(savedTurnNumber) && savedTurnNumber > 0) {
    try {
      await playSavedTurnAudio(savedTurnNumber);
      return;
    } catch (error) {
      if (error?.status === 404) return; // nothing narratable this turn
      console.warn('Saved narration unavailable; falling back to live synthesis.', error);
    }
  }

  // tts-1: a failed saved-audio attempt must not restart narration for a
  // table the user has already left — the fallback would mint a fresh
  // token after the transition's stopNarration().
  if (epoch !== sessionEpoch) return;

  stopNarration();

  const script = Array.isArray(turn.voiceLines)
    ? turn.voiceLines.map(line => ({ ...line, text: stripNarrationText(line.text) }))
    : [];
  const queue = normalizeVoiceLines(script, stripNarrationText(turn.narrative));
  if (queue.length === 0) return;

  const token = {};
  narrationQueueToken = token;
  const skipBtn = document.getElementById('btn-skip-narration');
  skipBtn.style.display = 'inline-flex';

  try {
    const result = await runVoiceNarration(queue, {
      loadCapabilities: loadVoiceCapabilities,
      synthesize: requestNarrationRun,
      play: playAudioBlob,
      isCancelled: () => narrationQueueToken !== token,
      onError: error => {
        console.error(error);
        if (!voiceErrorShown) {
          showToast(`Voice Error: ${error.message}`, 'error');
          voiceErrorShown = true;
        }
      }
    });
    if (!result.hadError) voiceErrorShown = false;
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
const THEME_VAR_NAMES = ['--theme-primary', '--theme-secondary', '--theme-bg', '--theme-panel', '--theme-border', '--theme-text', '--theme-text-dim'];

// Generate HSL styles and apply class theme
function applyCampaignTheme(genre, colors, fonts) {
  document.body.className = '';
  // A previously loaded full-theme campaign may have left body-level variable
  // overrides behind; clear them so this campaign starts from a clean slate.
  THEME_VAR_NAMES.forEach(name => document.body.style.removeProperty(name));

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
    for (const [name, value] of Object.entries(fullThemeVars(colors))) {
      document.body.style.setProperty(name, value);
    }
    document.body.classList.add('theme-default');
    return;
  }

  for (const [name, value] of Object.entries(baseThemeVars(
    colors?.primary,
    colors?.secondary,
    colors?.background
  ))) {
    document.documentElement.style.setProperty(name, value);
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
  charName.closest('.character-section').style.display = char ? '' : 'none';
  if (!char) {
    updateAbilityComposerForCharacter(null);
    renderAbilities([], []);
    renderClassDetails(null);
    renderInventory([]);
    for (const field of [charName, charClass, charLevel, healthText, manaText, xpText, attrStr, attrAgi, attrInt, attrWil]) field.textContent = '';
    for (const fill of [healthFill, manaFill, xpFill]) fill.style.width = '0%';
    setActionInputState(true, false);
    return;
  }
  updateAbilityComposerForCharacter(char);
  charName.textContent = char.name;
  charClass.textContent = char.class || char.archetype || 'Developing concept';
  charLevel.textContent = char.level;

  healthText.textContent = `${char.health}/${char.max_health}`;
  const hpPercent = char.max_health > 0 ? Math.max(0, Math.min(100, (char.health / char.max_health) * 100)) : 0;
  healthFill.style.width = `${hpPercent}%`;

  manaText.textContent = `${char.mana}/${char.max_mana}`;
  const manaPercent = char.max_mana > 0 ? Math.max(0, Math.min(100, (char.mana / char.max_mana) * 100)) : 0;
  manaFill.style.width = `${manaPercent}%`;
  const targetCharacter = !!char.skills && typeof char.skills === 'object' && !Array.isArray(char.skills);
  manaText.closest('.stat-bar-group').style.display = targetCharacter && char.max_mana === 0 ? 'none' : '';
  document.getElementById('char-attributes').style.display = targetCharacter ? 'none' : '';

  const relativeXp = char.xp % 100;
  xpText.textContent = `${relativeXp}/100`;
  xpFill.style.width = `${relativeXp}%`;

  attrStr.textContent = char.attributes?.strength || 10;
  attrAgi.textContent = char.attributes?.agility || 10;
  attrInt.textContent = char.attributes?.intellect || 10;
  attrWil.textContent = char.attributes?.willpower || 10;

  renderClassDetails(char);
  renderInventory(char.inventory);
  renderAbilities(char.abilities || [], activeInvocableAbilities, !!char.classBuild, char.abilityStatus);
  setActionInputState(!turnSubmitInFlight, false);
}

function renderClassDetails(character) {
  const root = document.getElementById('class-runtime-details');
  root.replaceChildren();
  if (!character?.skills || typeof character.skills !== 'object' || Array.isArray(character.skills)) return;
  const label = value => String(value).replaceAll('_', ' ').replaceAll('-', ' ').replace(/^./u, letter => letter.toUpperCase());
  const statistics = document.createElement('dl');
  statistics.className = 'class-live-state';
  const add = (name, value) => {
    const term = document.createElement('dt');
    term.textContent = name;
    const description = document.createElement('dd');
    description.textContent = value;
    statistics.append(term, description);
  };
  for (const key of ['exposure', 'strain']) {
    const resource = character.resources?.[key];
    if (Number.isFinite(resource?.current) && Number.isFinite(resource?.maximum)) {
      add(label(key), `${resource.current}/${resource.maximum}`);
    }
  }
  const state = character.classState || {};
  const names = new Map((character.abilities || []).flatMap(ability => [[ability.id, ability.name], [ability.definition_id, ability.name]]));
  const targets = character.classTargets || {};
  const conditionNames = ['hindered', 'exposed', 'dazed', 'pinned', 'winded', 'steadied', 'inspired', 'concealed']
    .filter(token => character.conditions?.[token]?.condition === token)
    .map(token => `${label(token)}${character.conditions[token].duration === 'persistent' ? ' (persistent)' : ''}`);
  if (conditionNames.length) add('Conditions', conditionNames.join(', '));
  if (Number.isFinite(state.reprisal)) add('Reprisal', `${state.reprisal}/${state.reprisalMaximum}`);
  if (state.brace?.remaining > 0) add('Brace', 'Active');
  if (state.endure?.remaining > 0) add('Endure', state.endure.refuseDefeat ? 'Active / Refuse Defeat armed' : 'Active');
  if (state.quarry) add('Quarry', targets.quarry || 'Marked');
  if (state.opening) add('Opening', targets.opening || 'Established');
  if (state.declaration) {
    const binding = { ward: 'Ward', foe: 'Judged foe', area: 'Bound area' }[state.declaration.binding];
    if (binding) add(binding, `${targets.declaration || 'Bound'}${state.declaration.guard?.remaining > 0 ? ' / Guard active' : ''}`);
  }
  if (state.cue) add('Cue', `${names.get(state.cue.sourceAbilityId) || 'Active'}: ${targets.cueAlly || 'Ally'}${targets.cueTarget ? ` against ${targets.cueTarget}` : ''}`);
  if (state.ritual && names.has(state.ritual.abilityId)
    && Number.isFinite(state.ritual.completed) && Number.isFinite(state.ritual.required)) {
    add('Working', `${names.get(state.ritual.abilityId)} / ${state.ritual.completed}/${state.ritual.required}`);
  }
  for (const key of ['stance', 'profile']) {
    if (typeof state[key] === 'string') add(label(key), label(state[key]));
  }
  if (state.companion && Number.isFinite(state.companion.health)) {
    add('Companion', `${label(state.companion.profile)} / ${state.companion.health}/${state.companion.maxHealth} HP`);
  }
  if (state.vehicle && Number.isFinite(state.vehicle.hull)) {
    add('Vehicle', `${label(state.vehicle.profile)} / ${state.vehicle.hull}/${state.vehicle.maxHull} hull`);
  }
  if (Array.isArray(state.prepared)) {
    const prepared = state.prepared.map(id => names.get(id)).filter(Boolean);
    add('Prepared', prepared.length ? prepared.join(', ') : 'None');
  }
  if (Array.isArray(state.installations) && Number.isFinite(state.installationCapacity)) {
    const occupiedSlots = state.installations
      .filter(installation => installation.status === 'active')
      .reduce((total, installation) => total + installation.slots, 0);
    add('Installation slots', `${occupiedSlots}/${state.installationCapacity}`);
  }
  if (statistics.childElementCount) root.append(statistics);
  const details = document.createElement('details');
  details.className = 'class-skills';
  const summary = document.createElement('summary');
  summary.textContent = 'Skills';
  const skills = document.createElement('dl');
  for (const [key, value] of Object.entries(character.skills)) {
    if (!Number.isFinite(value)) continue;
    const name = document.createElement('dt');
    name.textContent = label(key);
    const bonus = document.createElement('dd');
    bonus.textContent = `${value >= 0 ? '+' : ''}${value}`;
    skills.append(name, bonus);
  }
  details.append(summary, skills);
  root.append(details);
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
    actCard.style.borderLeft = isActive ? '2px solid var(--theme-primary)' : 'none';
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
    inventoryContainer.innerHTML = `<div style="font-size: 12px; color: var(--theme-text-dim); padding: 8px;">Inventory empty.</div>`;
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

function renderAbilities(abilities, invocableAbilities, authoredClass = false, abilityStatus = []) {
  charAbilities.innerHTML = '';
  const canonicalAbilities = Array.isArray(abilities) ? abilities : [];
  const projectedAbilities = Array.isArray(invocableAbilities) ? invocableAbilities : [];
  if (canonicalAbilities.length === 0 && projectedAbilities.length === 0) {
    charAbilities.innerHTML = `<div class="ability-empty">No abilities established yet.</div>`;
    return;
  }

  const projectedById = new Map(projectedAbilities.map(ability => [ability.abilityId, ability]));
  const statusById = new Map((Array.isArray(abilityStatus) ? abilityStatus : []).map(status => [status.abilityId, status]));
  const renderedProjectionIds = new Set();

  function appendInvocableAbility(ability) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ability-item ability-button';
    button.dataset.abilityId = ability.abilityId;
    button.dataset.familyTone = familyToneForKey(ability.familyKey);
    button.disabled = composerLocked;
    button.setAttribute(
      'aria-label',
      `Insert ${ability.name}. ${ability.familyLabel}. ${ability.help}`
    );

    const head = document.createElement('span');
    head.className = 'ability-head';
    const name = document.createElement('span');
    name.className = 'ability-name';
    name.textContent = ability.name;
    const family = document.createElement('span');
    family.className = 'ability-family-label';
    family.textContent = ability.familyLabel;
    head.append(name, family);

    const help = document.createElement('span');
    help.className = 'ability-desc';
    help.textContent = ability.help;
    button.append(head, help);
    const status = statusById.get(ability.abilityId);
    if (authoredClass && status) {
      const usage = document.createElement('span');
      usage.className = 'ability-usage ability-desc';
      const parts = [status.costLabel];
      if (Number.isSafeInteger(status.cadence?.remaining)) parts.push(`${status.cadence.remaining}/${status.cadence.maximum} remaining`);
      if (status.prepared === false) parts.push('Not prepared');
      usage.textContent = parts.filter(Boolean).join(' / ');
      if (status.cadence?.remaining === 0 || status.prepared === false) usage.classList.add('text-warning');
      button.append(usage);
    }
    button.addEventListener('click', () => insertInvocableAbility(ability));
    charAbilities.appendChild(button);
  }

  function appendPassiveAbility(ability) {
    const div = document.createElement('div');
    div.className = 'ability-item ability-passive';
    const head = document.createElement('div');
    head.className = 'ability-head';
    const name = document.createElement('span');
    name.className = 'ability-name';
    name.textContent = ability.name || 'Unnamed Ability';
    const tier = document.createElement('span');
    tier.className = 'ability-tier';
    tier.textContent = ability.tier || 'emerging';
    head.append(name, tier);

    const description = document.createElement('div');
    description.className = 'ability-desc';
    description.textContent = ability.description || 'A developing capability.';
    div.append(head, description);
    if (!authoredClass) {
      const source = document.createElement('div');
      source.className = 'ability-source';
      source.textContent = ability.source || 'in-game development';
      div.append(source);
    }
    charAbilities.appendChild(div);
  }

  for (const ability of canonicalAbilities) {
    const projected = typeof ability?.id === 'string'
      ? projectedById.get(ability.id)
      : null;
    if (projected) {
      appendInvocableAbility(projected);
      renderedProjectionIds.add(projected.abilityId);
    } else {
      appendPassiveAbility(ability || {});
    }
  }
  for (const ability of projectedAbilities) {
    if (!renderedProjectionIds.has(ability.abilityId)) appendInvocableAbility(ability);
  }
}

// Render character Codex dossiers
function renderCodex(npcs) {
  codexContainer.innerHTML = '';
  
  if (!npcs || npcs.length === 0) {
    codexContainer.innerHTML = `<div style="font-size: 12px; color: var(--theme-text-dim); padding: 8px;">No character details recorded.</div>`;
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
    btn.disabled = composerLocked || !!pendingTargetAction;
    btn.addEventListener('click', () => {
      setComposerValue(choice, choice.length, choice.length);
      // requestSubmit fires a cancelable submit event; dispatchEvent(new Event('submit'))
      // is non-cancelable, so preventDefault was ignored and Firefox performed the native
      // form submission (full page reload back to the campaign menu).
      actionForm.requestSubmit();
    });
    suggestedChoicesContainer.appendChild(btn);
  });
}

// Dialog input handlers
function setActionInputState(enabled, focusInput = true) {
  composerLocked = !enabled || activeComposerCharacterId === null;
  actionInput.disabled = composerLocked;
  actionInput.readOnly = !!pendingTargetAction;
  btnSendAction.disabled = composerLocked;
  abilityCorrection.disabled = composerLocked || !!pendingTargetAction;
  charAbilities.querySelectorAll('button').forEach(button => {
    button.disabled = composerLocked || !!pendingTargetAction;
  });
  suggestedChoicesContainer.querySelectorAll('button').forEach(button => {
    button.disabled = composerLocked || !!pendingTargetAction;
  });
  actionForm.classList.toggle('is-submitting', !enabled);

  if (enabled) {
    btnSendAction.innerHTML = '<span>Send</span> <i class="fa-solid fa-paper-plane"></i>';
    if (focusInput) actionInput.focus();
  } else {
    btnSendAction.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
  }
  renderAbilityCorrection();
}

// Append player bubble. `characterId` is the turn's author (pa-1): omitted for
// the optimistic bubble, which is by construction this browser's own action.
function appendPlayerAction(text, turnNumber, { optimistic = false, characterId = null } = {}) {
  const el = document.createElement('div');
  el.className = 'log-entry log-player';
  if (optimistic) el.dataset.optimistic = 'true';
  const authorLabel = optimistic ? 'You' : turnAuthorLabel(characterId, 'You');
  const speaker = document.createElement('div');
  speaker.className = 'speaker';
  speaker.innerHTML = `<i class="fa-solid fa-user"></i> ${escapeHtml(authorLabel)}`;
  const content = document.createElement('div');
  content.className = 'content';
  content.textContent = text;
  el.append(speaker, content);
  placeLogEntry(el, turnNumber);
  scrollToBottom();
  return el;
}

function settleOptimisticPlayerAction(el, turnNumber) {
  if (!el?.isConnected) return;
  delete el.dataset.optimistic;
  if (typeof turnNumber !== 'number') return;
  const duplicate = [...narrativeContainer.querySelectorAll('.log-player[data-turn]')]
    .find(node => node !== el && Number(node.dataset.turn) === turnNumber);
  if (duplicate) {
    el.remove();
    return;
  }
  placeLogEntry(el, turnNumber);
}

// Append GM description with markdown support and DOMPurify sanitization
function appendGMDialogue(markdownText, turnNumber) {
  const el = document.createElement('div');
  el.className = 'log-entry log-gm';

  // Guard against undefined or null narrative string inputs
  const htmlContent = marked.parse(markdownText || '*The scene progresses in silence...*');
  const cleanHtml = DOMPurify.sanitize(htmlContent);

  el.innerHTML = `
    <div class="speaker"><i class="fa-solid fa-dice-d20"></i> Game Master</div>
    <div class="content">${cleanHtml}</div>
  `;
  // Save-once narration (V4): every numbered GM turn is replayable on demand.
  const numericTurn = Number(turnNumber);
  if (Number.isInteger(numericTurn) && numericTurn > 0) {
    const playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.className = 'btn-play-narration';
    playBtn.setAttribute('aria-label', 'Play narration');
    setTurnAudioButtonState(playBtn, false);
    playBtn.addEventListener('click', () => toggleTurnAudioPlayback(numericTurn, playBtn));
    el.querySelector('.speaker').appendChild(playBtn);
  }
  placeLogEntry(el, turnNumber);
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

function appendSceneGrounding(groundingText, turnNumber) {
  if (!groundingText || !narrativeContainer) return;
  const el = document.createElement('div');
  el.className = 'log-entry log-scene';
  const safeText = escapeHtml(groundingText);
  el.innerHTML = `
    <div class="speaker"><i class="fa-solid fa-eye"></i> Current Situation</div>
    <div class="content scene-grounding">${safeText}</div>
  `;
  placeLogEntry(el, turnNumber);
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

// === Dice roll theater (plan.md Phase 1 slice, owner request 2026-07-11) ===
// Cosmetic overlay on top of engine-rolled results: the die always lands on
// the recorded roll; the log card (appendRollResultBubble) stays the record.
const diceOverlayEl = document.getElementById('dice-overlay');
const DICE_D20_SVG = `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
  <polygon points="60,10 105,36 105,88 60,114 15,88 15,36" fill="rgba(10,10,14,0.85)" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
  <polygon points="60,34 86,82 34,82" fill="rgba(255,255,255,0.05)" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
  <path d="M60 10 L60 34 M15 36 L60 34 M105 36 L60 34 M15 36 L34 82 M15 88 L34 82 M60 114 L34 82 M105 36 L86 82 M105 88 L86 82 M60 114 L86 82" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
let diceTheaterQueue = Promise.resolve();
// Finish handle of the roll currently on screen, so a table transition can
// dismiss it synchronously (dt-1). Null when nothing is playing.
let activeTheaterFinish = null;

// Dismiss the active overlay immediately. Queued rolls die on their own:
// each captured the epoch of the table that queued it and is dropped at
// play time when the epoch has moved on.
function dismissRollTheater() {
  if (activeTheaterFinish) activeTheaterFinish();
}

function queueRollTheater(rolls) {
  if (!Array.isArray(rolls) || rolls.length === 0) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // One batch per turn (dt-2): click-to-skip drains only this turn's
  // remaining rolls; a batch queued by a later turn keeps its own state.
  const batch = { skipped: false, epoch: sessionEpoch };
  rolls.forEach(roll => {
    diceTheaterQueue = diceTheaterQueue.then(() => playOneRollTheater(roll, batch)).catch(() => {});
  });
}
// Exposed for live smoke tests and console debugging; cosmetic only.
window.queueRollTheater = queueRollTheater;

function playOneRollTheater(roll, batch) {
  if (batch.epoch !== sessionEpoch) return Promise.resolve(); // queued for a table we left
  if (batch.skipped || !roll || typeof (roll.sides === 100 ? roll.raw : roll.roll) !== 'number') return Promise.resolve();
  const percentile = roll.sides === 100;
  const success = percentile ? ['crit_success', 'marginal_success', 'clean_success'].includes(roll.band) : roll.success;
  return new Promise(resolve => {
    const costs = [];
    if (!success && typeof roll.applied_health_change === 'number' && roll.applied_health_change < 0) {
      costs.push(`${roll.applied_health_change} HP`);
    }
    if (!success && typeof roll.applied_mana_change === 'number' && roll.applied_mana_change < 0) {
      costs.push(`${roll.applied_mana_change} MP`);
    }
    diceOverlayEl.innerHTML = `
      <div class="dice-caption">
        <div class="dice-check-label">${percentile ? `d100 check / Target ${escapeHtml(roll.T)}` : `${escapeHtml(roll.attribute || 'stat')} check &mdash; DC ${Number(roll.dc) || '?'}`}</div>
        ${roll.reason ? `<div class="dice-reason">${escapeHtml(roll.reason)}</div>` : ''}
      </div>
      <div class="dice-stage tumbling">${percentile ? '<i class="fa-solid fa-dice percentile-die" aria-hidden="true"></i>' : DICE_D20_SVG}<div class="dice-number"></div></div>
      <div class="dice-result">
        <div class="dice-math"></div>
        <div class="dice-verdict"></div>
        ${costs.length ? `<div class="dice-cost">${escapeHtml(costs.join(', '))}</div>` : ''}
      </div>
      <div class="dice-skip-hint">click to skip</div>`;
    diceOverlayEl.style.display = 'flex';
    const stage = diceOverlayEl.querySelector('.dice-stage');
    const numberEl = diceOverlayEl.querySelector('.dice-number');
    const resultEl = diceOverlayEl.querySelector('.dice-result');
    // The cycling digits are pure animation; only the landing value matters,
    // and it is the engine's recorded roll.
    numberEl.textContent = String(1 + Math.floor(Math.random() * (percentile ? 100 : 20)));
    const tick = setInterval(() => {
      numberEl.textContent = String(1 + Math.floor(Math.random() * (percentile ? 100 : 20)));
    }, 80);
    const timers = [];
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearInterval(tick);
      timers.forEach(clearTimeout);
      diceOverlayEl.onclick = null;
      diceOverlayEl.style.display = 'none';
      diceOverlayEl.innerHTML = '';
      activeTheaterFinish = null;
      resolve();
    };
    activeTheaterFinish = finish;
    // A click skips this roll and the rest of ITS turn's batch only.
    diceOverlayEl.onclick = () => { batch.skipped = true; finish(); };
    timers.push(setTimeout(() => {
      clearInterval(tick);
      numberEl.textContent = String(percentile ? roll.raw : roll.roll);
      stage.classList.remove('tumbling');
      stage.classList.add('landed');
      const mod = Number(roll.modifier) || 0;
      resultEl.querySelector('.dice-math').textContent =
        percentile ? `Roll ${roll.raw} vs target ${roll.T}` : `${roll.roll} ${mod >= 0 ? '+' : '-'} ${Math.abs(mod)} = ${roll.total} vs DC ${roll.dc}`;
      const verdictEl = resultEl.querySelector('.dice-verdict');
      verdictEl.textContent = percentile ? percentileOutcome(roll.band) : success ? 'Success' : 'Failure';
      verdictEl.classList.add(success ? 'success' : 'failure');
      resultEl.classList.add('shown');
    }, 1400));
    timers.push(setTimeout(finish, 3200));
  });
}

// Append a dice roll card in the narrative log (Rules Mode check results)
function percentileOutcome(band) {
  const labels = { crit_success: 'Critical success', marginal_success: 'Marginal success',
    clean_success: 'Clean success', crit_failure: 'Critical failure', marginal_failure: 'Marginal failure', clean_failure: 'Clean failure' };
  return labels[band] || 'Recorded outcome';
}

function rollAnnotationText(roll, details) {
  if (typeof roll.annotation?.text === 'string') return roll.annotation.text;
  const omitted = Array.isArray(details) ? details.find(entry => entry?.checkId === roll.checkId && entry.detailsOmitted === true) : null;
  return typeof omitted?.text === 'string' ? omitted.text : '';
}

function appendRollResultBubble(roll, turnNumber, annotationDetails, pendingContainer = null) {
  const el = document.createElement('div');
  el.className = 'log-entry log-roll';
  if (roll.sides === 100) {
    const success = ['crit_success', 'marginal_success', 'clean_success'].includes(roll.band);
    const annotationText = rollAnnotationText(roll, annotationDetails);
    el.innerHTML = DOMPurify.sanitize(`
      <div class="roll-badge-container">
        <span class="roll-d20-icon"><i class="fa-solid fa-dice"></i></span>
        <div class="roll-details">
          <div class="roll-calculation"><strong>D100 CHECK:</strong> Roll ${escapeHtml(roll.raw)} vs target <strong>${escapeHtml(roll.T)}</strong></div>
          ${typeof roll.intent === 'string' ? `<div class="roll-reason">${escapeHtml(roll.intent)}</div>` : ''}
          <div class="roll-outcome ${success ? 'roll-success' : 'roll-failure'}">${percentileOutcome(roll.band)}</div>
        </div>
      </div>
      ${annotationText ? `<div class="roll-reason roll-annotation" style="margin-top:8px;overflow-wrap:anywhere">${escapeHtml(annotationText)}</div>` : ''}`);
    if (pendingContainer) pendingContainer.append(el);
    else { placeLogEntry(el, turnNumber); scrollToBottom(); }
    return;
  }
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
  placeLogEntry(el, turnNumber);
  scrollToBottom();
}

// In-memory cache for timeline filtering
let activeTimelineData = [];

// Fetch journal chronology and render it
async function loadJournalTimeline() {
  if (!currentCampaignId) return;
  // Stale-response guard (jt-1, poll-1's mechanism): capture at dispatch,
  // discard after every await if the table has moved on.
  const epoch = sessionEpoch;
  // The search filter reads this cache synchronously; it must never hold a
  // departed table's history while the replacement fetch is in flight.
  activeTimelineData = [];
  journalTimelineContainer.innerHTML = `<div style="font-size: 12px; opacity: 0.6; padding: 8px;"><i class="fa-solid fa-spinner fa-spin"></i> Fetching journal history...</div>`;

  try {
    const response = await fetchWithTimeout(`/api/campaigns/${currentCampaignId}/journal`);
    if (epoch !== sessionEpoch) return; // table changed while fetching
    if (!response.ok) throw new Error('Could not retrieve timeline data');

    const data = await response.json();
    if (epoch !== sessionEpoch) return;

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
    if (epoch !== sessionEpoch) return; // a stale failure must not paint over the new table
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
      // Same attribution as the transcript (pa-1): a turn with no recorded
      // author keeps the generic label this surface has always used.
      const turnText = turn.player_action
        ? `<strong>${escapeHtml(turnAuthorLabel(turn.character_id, 'Player'))}:</strong> "${escapeHtml(turn.player_action)}"`
        : `<em>Campaign started</em>`;
      const narrativeSample = marked.parse(turn.narrative.substring(0, 180) + (turn.narrative.length > 180 ? '...' : ''));
      
      let stateChanges = {};
      try { stateChanges = JSON.parse(turn.state_changes_json || '{}'); } catch(e) {}
      
      const timelineRolls = Array.isArray(turn.dice_rolls) ? turn.dice_rolls
        : Array.isArray(stateChanges.dice_rolls) && stateChanges.dice_rolls.length > 0 ? stateChanges.dice_rolls
        : (stateChanges.roll_result ? [stateChanges.roll_result] : []);
      const rollBadgeHtml = timelineRolls.map(roll =>
        `<div class="timeline-roll-badge ${(roll.sides === 100 ? ['crit_success', 'marginal_success', 'clean_success'].includes(roll.band) : roll.success) ? 'success' : 'fail'}">
           <i class="fa-solid ${roll.sides === 100 ? 'fa-dice' : 'fa-dice-d20'}"></i> ${roll.sides === 100 ? `d100: ${escapeHtml(roll.raw)} vs target ${escapeHtml(roll.T)} / ${percentileOutcome(roll.band)}` : `${(roll.attribute || 'stat').toUpperCase()} check: ${roll.total} vs DC ${roll.dc}`}
           ${roll.sides === 100 && rollAnnotationText(roll, turn.rollAnnotationDetails) ? `<span class="roll-annotation">${escapeHtml(rollAnnotationText(roll, turn.rollAnnotationDetails))}</span>` : ''}
         </div>`
      ).join('');

      // Forking is a host meta-action (S2): seats never see the control.
      const forkFooter = seatMode ? '' : `
        <div class="timeline-node-footer">
          <button class="btn btn-secondary btn-sm timeline-fork-btn">
            <i class="fa-solid fa-code-fork"></i> Fork Timeline
          </button>
        </div>`;
      const safeHtml = DOMPurify.sanitize(`
        <div class="timeline-node-header">
          <span class="timeline-node-badge badge-turn">Turn ${turn.turn_number}</span>
          <span class="timeline-node-time">${timeStr}</span>
        </div>
        <div class="timeline-node-action">${turnText}</div>
        <div class="timeline-node-summary">${narrativeSample}</div>
        ${rollBadgeHtml}
        ${forkFooter}
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
  // fk-1: the table this fork was asked from. Both the name prompt and the
  // fork fetch can outlive a table transition — the loading overlay blocks
  // pointers, not keyboard focus, and the prompt has no overlay at all — so
  // a stale resolution must not seize whatever table the user is on now.
  const epoch = sessionEpoch;
  const newTitle = await uiPrompt(
    `Branch timeline from Turn ${turnNumber}?\nThis creates a new campaign fork without modifying the current run.\n\nEnter new campaign name:`,
    { defaultValue: `${currentCampaignTitle} [Fork - Turn ${turnNumber}]` }
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
    if (epoch !== sessionEpoch) {
      // The user left this table while the fork was reconstructing. The
      // fork exists server-side; tell them where to find it, adopt nothing.
      showToast(`Fork "${newTitle.trim()}" was created — find it in your campaign list.`, 'info');
      return;
    }
    // Adopting the fork is a table transition: invalidate anything still
    // in flight against the source campaign before rendering the new one.
    bumpSessionEpoch();
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
