import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import * as db from './db.js';
import * as rpg from './rpg-engine.js';
import {
  getServerAiConfig,
  loadAdminAiConfig,
  saveAdminAiConfigV2,
  maskAdminAiConfigV2,
  AdminConfigValidationError,
  AI_PROVIDERS,
  projectAdminAiConfigV2
} from './server-config.js';
import { resolveAiEndpointPolicy } from './api-client.js';
import { listModels, ModelCatalogError } from './model-catalog.js';
import { looksLikeSeatToken, hashSeatToken, mintSeatToken, findLiveSeat } from './seat-auth.js';
import { scopeStateForSeat, scopeJournalForSeat } from './rpg-state.js';
import { errorPayloadFor, apiErrorHandler } from './server-errors.js';
import {
  VoiceRequestError,
  getAdminVoiceCatalog,
  getVoiceCapabilities,
  narrateVoiceRequest
} from './voice-narration.js';
import {
  AudioStoreError,
  deleteCampaignAudio,
  ensureTurnAudio,
  getTurnAudioSegment,
  publicTurnAudioManifest
} from './audio-store.js';
import {
  MAX_HISTORY_LIMIT,
  MAX_MEMORY_LIMIT,
  MAX_MEMORY_QUERY_LENGTH,
  readCampaignHistory,
  readCampaignMemories,
  readCampaignOutline
} from './campaign-context.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const TRUST_PROXY = process.env.TRUST_PROXY;

export function adminSettingsErrorStatus(error) {
  return error instanceof AdminConfigValidationError ? 400 : 500;
}

const CATALOG_FIELD_LENGTH = 400;
const CATALOG_ENTRY_ID_LENGTH = 80;

function catalogField(value, name, maxLength = CATALOG_FIELD_LENGTH) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string') {
    throw new ModelCatalogError(`${name} must be a string.`, {
      status: 400,
      code: 'CATALOG_REQUEST_INVALID'
    });
  }
  const clean = value.trim();
  if (clean.length > maxLength) {
    throw new ModelCatalogError(`${name} is too long.`, {
      status: 400,
      code: 'CATALOG_REQUEST_INVALID'
    });
  }
  return clean;
}

function providerEnvironmentKey(provider, env) {
  switch (provider) {
    case 'gemini': return env.GEMINI_API_KEY || '';
    case 'openai': return env.OPENAI_API_KEY || '';
    case 'claude': return env.ANTHROPIC_API_KEY || '';
    case 'grok': return env.XAI_API_KEY || env.GROK_API_KEY || '';
    default: return '';
  }
}

export function resolveModelCatalogRequest(body, storedRaw, env = process.env) {
  const request = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const provider = catalogField(request.provider, 'provider', 40);
  if (!AI_PROVIDERS.includes(provider)) {
    throw new ModelCatalogError('Unsupported model provider.', {
      status: 400,
      code: 'CATALOG_PROVIDER_INVALID'
    });
  }

  const stored = projectAdminAiConfigV2(storedRaw);
  const modelEntryId = catalogField(request.modelEntryId, 'modelEntryId', CATALOG_ENTRY_ID_LENGTH);
  let entry = null;
  if (modelEntryId) {
    entry = stored.modelEntries.find(candidate => candidate.id === modelEntryId) || null;
    if (!entry || entry.provider !== provider) {
      throw new ModelCatalogError('modelEntryId does not belong to the requested provider.', {
        status: 400,
        code: 'CATALOG_ENTRY_MISMATCH'
      });
    }
  }

  if (provider === 'claude-code') {
    return { provider, apiKey: '', baseUrl: '', ollamaUrl: '' };
  }

  const requestKey = catalogField(request.apiKey, 'apiKey');
  const entryKey = entry?.keySource === 'custom' ? entry.apiKey : '';
  const providerKey = stored.providers[provider]?.apiKey || '';
  const apiKey = requestKey || entryKey || providerKey || providerEnvironmentKey(provider, env);
  const endpoints = resolveAiEndpointPolicy({
    requestBaseUrl: catalogField(request.baseUrl, 'baseUrl'),
    storedBaseUrl: stored.providers.custom.baseUrl,
    requestOllamaUrl: catalogField(request.ollamaUrl, 'ollamaUrl'),
    storedOllamaUrl: stored.providers.ollama.ollamaUrl,
    env
  });
  return { provider, apiKey, ...endpoints };
}

if (TRUST_PROXY) {
  const parsedTrustProxy = TRUST_PROXY === 'true'
    ? true
    : Number.isInteger(Number(TRUST_PROXY))
      ? Number(TRUST_PROXY)
      : TRUST_PROXY;
  app.set('trust proxy', parsedTrustProxy);
}

app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
      "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com data:",
      "img-src 'self' data: blob:",
      "media-src 'self' blob:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'"
    ].join('; ')
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

// Global JSON body cap. The campaign-import route carries its own parser
// with a bundle-sized cap (Phase P) — the global parser must skip that path
// or it would reject the body before the route's parser ever ran.
const smallJsonParser = express.json({ limit: '64kb' });
app.use((req, res, next) => {
  // Express routing is case-insensitive and slash-tolerant by default, so
  // the skip must match every variant the route itself would accept.
  if (req.path.replace(/\/+$/, '').toLowerCase() === '/api/campaigns/import') return next();
  return smallJsonParser(req, res, next);
});
// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Store active MCP connections
const mcpConnections = new Map();

const campaignTaskQueues = new Map();
function queueCampaignTask(campaignId, taskFn) {
  const queueKey = String(campaignId);
  const current = campaignTaskQueues.get(queueKey) || Promise.resolve();
  const next = current.catch(() => {}).then(taskFn);
  const stored = next.catch(() => {});
  campaignTaskQueues.set(queueKey, stored);
  stored.finally(() => {
    if (campaignTaskQueues.get(queueKey) === stored) {
      campaignTaskQueues.delete(queueKey);
    }
  });
  return next;
}

const MAX_GENRE_LENGTH = 200;
const MAX_CHARACTER_FIELD_LENGTH = 80;
const MAX_ACTION_LENGTH = 2000;
const MAX_TITLE_LENGTH = 160;
const TURN_REQUEST_KEYS = new Set([
  'playerAction',
  'characterId',
  'abilityTriggerRevision'
]);
const ABILITY_TRIGGER_REVISION_PATTERN = /^ak\d+:[a-f0-9]{64}$/u;

function boundedString(value, fieldName, maxLength) {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string.`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${fieldName} is required.`);
  }
  if (trimmed.length > maxLength) {
    throw new Error(`${fieldName} must be ${maxLength} characters or fewer.`);
  }
  return trimmed;
}

function invalidTurnRequest(message) {
  const error = new Error(message);
  error.code = 'TURN_REQUEST_INVALID';
  error.publicMessage = message;
  return error;
}

/**
 * AKP-2 turn boundary: one exact prose string plus speaker selection and an
 * opaque trigger revision. Any extra field is rejected so client-supplied
 * matches, IDs, ranges, families, or mechanics can never become a shadow
 * authority contract.
 */
export function validateTurnRequestBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw invalidTurnRequest('Turn request must be a JSON object.');
  }
  const extraKeys = Object.keys(body).filter(key => !TURN_REQUEST_KEYS.has(key));
  if (extraKeys.length > 0) {
    throw invalidTurnRequest('Turn request contains unsupported fields.');
  }
  if (typeof body.playerAction !== 'string') {
    throw invalidTurnRequest('playerAction must be a string.');
  }
  if (body.playerAction.trim().length === 0) {
    throw invalidTurnRequest('playerAction is required.');
  }
  if (body.playerAction.length > MAX_ACTION_LENGTH) {
    throw invalidTurnRequest(`playerAction must be ${MAX_ACTION_LENGTH} characters or fewer.`);
  }
  if (
    typeof body.abilityTriggerRevision !== 'string'
    || !ABILITY_TRIGGER_REVISION_PATTERN.test(body.abilityTriggerRevision)
  ) {
    throw invalidTurnRequest('abilityTriggerRevision is required and must be an opaque trigger revision.');
  }
  return {
    playerAction: body.playerAction,
    characterId: body.characterId,
    abilityTriggerRevision: body.abilityTriggerRevision
  };
}

function parsePositiveInteger(value, fieldName) {
  const parsed = typeof value === 'number'
    ? value
    : (typeof value === 'string' && /^[1-9]\d*$/.test(value.trim()) ? Number(value) : NaN);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`Invalid ${fieldName}.`);
  }
  return parsed;
}

function optionalBoundedString(value, fieldName, maxLength, fallback = '') {
  if (value === undefined || value === null || value === '') return fallback;
  return boundedString(value, fieldName, maxLength);
}

function timingSafeTokenEqual(token, secret) {
  if (typeof token !== 'string' || typeof secret !== 'string') return false;
  const tokenBuffer = Buffer.from(token);
  const secretBuffer = Buffer.from(secret);
  if (tokenBuffer.length !== secretBuffer.length) return false;
  return crypto.timingSafeEqual(tokenBuffer, secretBuffer);
}

// Simple in-memory sliding-window IP rate limiter
const rateLimits = new Map();
function rateLimit(limitCount, windowMs) {
  return (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    
    if (!rateLimits.has(ip)) {
      rateLimits.set(ip, []);
    }
    
    // Filter timestamps older than the window
    const timestamps = rateLimits.get(ip).filter(time => now - time < windowMs);
    
    if (timestamps.length >= limitCount) {
      rateLimits.set(ip, timestamps);
      return res.status(429).json({ error: 'Too many requests. Please slow down.' });
    }
    timestamps.push(now);
    rateLimits.set(ip, timestamps);
    next();
  };
}

// Periodically clean up stale rate limit entries to prevent memory leak. The
// timer must not keep an imported app alive after its HTTP server is closed.
const rateLimitCleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of rateLimits.entries()) {
    // Evict entries where all timestamps are older than 60 seconds (max rateLimit window in use)
    const validTimestamps = timestamps.filter(time => now - time < 60000);
    if (validTimestamps.length === 0) {
      rateLimits.delete(ip);
    } else {
      rateLimits.set(ip, validTimestamps);
    }
  }
}, 300000); // Clean up every 5 minutes
rateLimitCleanupTimer.unref?.();

// -------------------------------------------------------------
// AUTHENTICATION MIDDLEWARE
// -------------------------------------------------------------

// Phase S1: two credential kinds. The HOST (ACCESS_SECRET) has full table
// authority; a SEAT is bound server-side to exactly one character of one
// campaign. req.auth carries the resolved credential for the route guards.
async function authenticate(req, res, next) {
  const secret = process.env.ACCESS_SECRET;
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  // Seat tokens authenticate regardless of whether a host secret is set.
  if (token && looksLikeSeatToken(token)) {
    try {
      // sv-1: liveness (not-revoked AND character still active) is defined
      // once, in seat-auth.js, so this guard cannot drift out of sync.
      const seat = await findLiveSeat(hashSeatToken(token));
      if (!seat) {
        return res.status(401).json({ error: 'Unauthorized. This seat token is invalid or revoked.' });
      }
      req.auth = { kind: 'seat', campaignId: seat.campaign_id, characterId: seat.character_id, seatId: seat.id };
      return next();
    } catch (error) {
      return res.status(500).json({ error: 'Seat authentication failed.' });
    }
  }

  if (!secret) {
    // Auth disabled (single-operator localhost dev): requests are the host.
    req.auth = { kind: 'host' };
    return next();
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized. Access token is required.' });
  }
  if (!timingSafeTokenEqual(token, secret)) {
    return res.status(401).json({ error: 'Unauthorized. Invalid access token.' });
  }

  req.auth = { kind: 'host' };
  next();
}

// Host-only surfaces: campaign lifecycle, character library, meta-actions.
function requireHost(req, res, next) {
  if (req.auth?.kind === 'host') return next();
  return res.status(403).json({ error: 'This action belongs to the table host.' });
}

// Seats may reach play routes on their own campaign only; the host passes.
function requireSeatCampaign(req, res, next) {
  if (req.auth?.kind === 'host') return next();
  const campaignId = parseInt(req.params.id, 10);
  if (req.auth?.kind === 'seat' && Number.isInteger(campaignId) && req.auth.campaignId === campaignId) {
    return next();
  }
  return res.status(403).json({ error: 'This seat does not belong to that campaign.' });
}

function authenticateMcpSse(req, res, next) {
  const secret = process.env.ACCESS_SECRET;
  if (!secret) {
    return next();
  }

  const token = req.query.token || (req.headers.authorization && req.headers.authorization.startsWith('Bearer ') 
    ? req.headers.authorization.substring(7) 
    : null);

  if (!timingSafeTokenEqual(token, secret)) {
    return res.status(401).send('Unauthorized. Invalid token.');
  }

  next();
}

// Admin authentication (Phase I1): gated by ADMIN_SECRET, a master password
// distinct from the player ACCESS_SECRET. Unset ADMIN_SECRET leaves /admin open
// for single-operator localhost dev (warned at startup); production fails closed.
function authenticateAdmin(req, res, next) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Admin panel disabled: ADMIN_SECRET is not configured.' });
    }
    return next();
  }

  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : '';
  if (!timingSafeTokenEqual(token, secret)) {
    return res.status(401).json({ error: 'Unauthorized. Invalid admin password.' });
  }
  next();
}

// Apply authentication to game and MCP APIs
app.use('/api/campaigns', authenticate);
app.use('/api/characters', authenticate);
app.use('/api/audio', authenticate);
app.use('/api/seat', authenticate);
app.use('/api/admin', rateLimit(20, 60000), authenticateAdmin);

// -------------------------------------------------------------
// ADMIN PANEL (owner-only; not linked from the game UI)
// -------------------------------------------------------------

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'admin.html'));
});

app.get('/admin/admin.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'admin.js'));
});

app.get('/admin/model-registry.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'model-registry.js'));
});

// Login probe: 200 iff the presented password is valid (or auth is disabled).
app.post('/api/admin/verify', (req, res) => {
  res.json({ ok: true, authRequired: !!process.env.ADMIN_SECRET });
});

app.get('/api/admin/settings', async (req, res) => {
  try {
    res.json(maskAdminAiConfigV2(await loadAdminAiConfig()));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/voice-catalog', (req, res) => {
  res.json({ providers: getAdminVoiceCatalog() });
});

app.post('/api/admin/models/catalog', async (req, res) => {
  try {
    const options = resolveModelCatalogRequest(req.body, await loadAdminAiConfig(), process.env);
    const result = await listModels(options.provider, {
      ...options,
      fetchImpl: app.locals.modelCatalogFetch || globalThis.fetch,
      claudeCodeStatusImpl: app.locals.claudeCodeStatusImpl,
      env: process.env
    });
    res.json(result);
  } catch (error) {
    if (error instanceof ModelCatalogError) {
      return res.status(error.status).json({ error: error.message });
    }
    res.status(500).json({ error: 'Could not list models.' });
  }
});

app.post('/api/admin/settings', async (req, res) => {
  try {
    const saved = await saveAdminAiConfigV2(req.body);
    res.json(maskAdminAiConfigV2(saved));
  } catch (error) {
    res.status(adminSettingsErrorStatus(error)).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// GAME API ENDPOINTS
// -------------------------------------------------------------

// List all campaigns
app.get('/api/campaigns', requireHost, async (req, res) => {
  try {
    // One row per campaign (M1 made characters 1:N): the card shows the
    // active party as a name list; the first active member's profile link
    // keeps the release-character button working as before.
    const campaigns = await db.all(
      `SELECT campaigns.*,
              (SELECT group_concat(c2.name, ', ') FROM characters c2
                WHERE c2.campaign_id = campaigns.id AND COALESCE(c2.status, 'active') = 'active') AS character_name,
              (SELECT c3.player_character_id FROM characters c3
                WHERE c3.campaign_id = campaigns.id AND COALESCE(c3.status, 'active') = 'active'
                ORDER BY c3.id ASC LIMIT 1) AS player_character_id
       FROM campaigns
       ORDER BY campaigns.created_at DESC`
    );
    res.json(campaigns);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/characters', requireHost, async (req, res) => {
  try {
    const characters = await rpg.listPlayerCharacters();
    res.json(characters);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new campaign (Rate limited: 5 campaigns per minute per IP)
app.post('/api/campaigns', rateLimit(5, 60000), requireHost, async (req, res) => {
  try {
    // Server-owned AI config (decision 2026-06-11): client-supplied apiConfig is
    // ignored; the operator's /admin + env configuration is authoritative.
    const { genre, characterName, characterClass, characterProfileId, characterMode, rulesMode, ruleset, tableStyle } = req.body;
    const cleanRuleset = ['house', 'none'].includes(ruleset) ? ruleset : 'house';
    const apiConfig = await getServerAiConfig();
    const cleanGenre = boundedString(genre, 'genre', MAX_GENRE_LENGTH);
    const mode = ['new', 'existing', 'copy'].includes(characterMode) ? characterMode : 'new';
    const cleanCharacterProfileId = characterProfileId ? parsePositiveInteger(characterProfileId, 'characterProfileId') : null;
    if ((mode === 'existing' || mode === 'copy') && !cleanCharacterProfileId) {
      return res.status(400).json({ error: 'characterProfileId is required for existing or copied characters.' });
    }
    const cleanCharacterName = cleanCharacterProfileId ? '' : boundedString(characterName, 'characterName', MAX_CHARACTER_FIELD_LENGTH);
    const cleanCharacterClass = cleanCharacterProfileId ? '' : boundedString(characterClass, 'characterConcept', MAX_CHARACTER_FIELD_LENGTH);
    const state = await rpg.createCampaign({
      genre: cleanGenre,
      characterName: cleanCharacterName,
      characterClass: cleanCharacterClass,
      characterProfileId: cleanCharacterProfileId,
      characterMode: mode,
      apiConfig,
      rulesMode,
      ruleset: cleanRuleset,
      // Validated engine-side against the option whitelist (Phase D)
      tableStyle: tableStyle && typeof tableStyle === 'object' ? tableStyle : null
    });
    res.json(state);
  } catch (error) {
    // sv-2: log rawText, and serialize through the trust boundary so this
    // host-only route regains the model output that used to ride in the
    // message (parseJsonSafe now carries it out-of-band).
    console.error('Error creating campaign:', error, error.rawText ? `\nRaw model output: ${error.rawText}` : '');
    const status = error.message.includes('checked out') || error.message.includes('no longer available')
      ? 409
      : error.message.includes('not found')
        ? 404
        : error.message.includes('API key') || error.message.includes('configured') || error.message.includes('Invalid') || error.message.includes('required') || error.message.includes('characters or fewer') || error.message.includes('must be a string')
          ? 400
          : 500;
    res.status(status).json(errorPayloadFor(req, error, 'Could not create the campaign.'));
  }
});

// Load an existing campaign
app.get('/api/campaigns/:id', requireSeatCampaign, async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id, 10);
    if (isNaN(campaignId)) {
      return res.status(400).json({ error: 'Invalid campaign ID.' });
    }
    const state = await rpg.getCampaignState(campaignId);
    if (!state) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    // Phase S2: seats get the scoped view, never the host payload.
    res.json(req.auth?.kind === 'seat' ? scopeStateForSeat(state, req.auth.characterId) : state);
  } catch (error) {
    console.error('Error loading campaign:', error);
    res.status(500).json(errorPayloadFor(req, error, 'Could not load the campaign.'));
  }
});

// Process a game turn (serialized per campaign and rate limited)
app.post('/api/campaigns/:id/turn', rateLimit(10, 60000), requireSeatCampaign, async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id, 10);
    if (isNaN(campaignId)) {
      return res.status(400).json({ error: 'Invalid campaign ID.' });
    }
    const { playerAction, characterId, abilityTriggerRevision } = validateTurnRequestBody(req.body);
    // Phase S1: for seats the speaking character DERIVES from the
    // credential — the body parameter is ignored entirely (nothing to
    // spoof). The host keeps explicit selection for solo/hosted play.
    const speakingCharacterId = req.auth?.kind === 'seat'
      ? req.auth.characterId
      : (characterId === undefined || characterId === null
        ? null
        : parsePositiveInteger(characterId, 'characterId'));
    const apiConfig = await getServerAiConfig();
    const state = await queueCampaignTask(campaignId, () =>
      rpg.takeTurn(
        campaignId,
        playerAction,
        apiConfig,
        speakingCharacterId,
        abilityTriggerRevision
      )
    );
    // Save-once narration (Phase V4): with the operator's always-generate
    // flag on, synthesize + persist this turn's audio in the background so
    // every seat replays the identical performance. Strictly fire-and-forget:
    // a voice failure must never delay or fail the committed turn.
    if (apiConfig.voiceAlwaysGenerate && Number.isInteger(state?.turn?.number)) {
      ensureTurnAudio(campaignId, state.turn.number).catch(error => {
        console.error(`Turn audio generation failed (campaign ${campaignId}, turn ${state.turn.number}):`, error.message);
      });
    }
    // Phase S2: seats get the scoped view, never the host payload.
    res.json(req.auth?.kind === 'seat' ? scopeStateForSeat(state, req.auth.characterId) : state);
  } catch (error) {
    // rawText (parseJsonSafe) carries the malformed model output: log it for
    // the operator, never serialize it to the client.
    console.error('Error processing turn:', error, error.rawText ? `\nRaw model output: ${error.rawText}` : '');
    const status = error.code === 'OUT_OF_TURN' || error.code === 'ABILITY_TRIGGERS_STALE' ? 409
      : error.code === 'CHARACTER_REQUIRED' ? 400
      : error.code === 'TURN_REQUEST_INVALID' ? 400
      // sv-1: the credential authenticated, but its character has left the
      // table (possibly mid-request, after auth). It is dead, not malformed.
      : error.code === 'CHARACTER_NOT_AT_TABLE' ? 401
      : error.message.includes('required') || error.message.includes('characters or fewer') || error.message.includes('must be a string') ? 400
      : 500;
    res.status(status).json(errorPayloadFor(req, error, 'The GM could not complete that turn. Your action was not lost — try again.'));
  }
});

// Campaign portability (Phase P): export one self-contained versioned bundle
app.get('/api/campaigns/:id/export', requireHost, async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id, 10);
    if (isNaN(campaignId)) {
      return res.status(400).json({ error: 'Invalid campaign ID.' });
    }
    // Serialized with the campaign's mutations so a concurrent turn commit
    // can never produce a torn bundle.
    const bundle = await queueCampaignTask(campaignId, () => rpg.exportCampaign(campaignId));
    res.setHeader('Content-Disposition', `attachment; filename="aetheria-campaign-${campaignId}.json"`);
    res.json(bundle);
  } catch (error) {
    const status = error.message.includes('not found') ? 404 : 500;
    res.status(status).json({ error: error.message });
  }
});

// Import a bundle as a new campaign. Bundles are untrusted data — fully
// re-validated engine-side, never treated as instructions. NOTE: the global
// JSON parser skips this path; the 20mb cap lives here.
app.post('/api/campaigns/import', rateLimit(5, 60000), requireHost, express.json({ limit: '20mb' }), async (req, res) => {
  try {
    const state = await rpg.importCampaign(req.body);
    res.json(state);
  } catch (error) {
    const status = error.message.includes('bundle') || error.message.includes('format_version') || error.message.includes('contains no')
      ? 400
      : 500;
    res.status(status).json({ error: error.message });
  }
});

// Table-style dials (Phase D): adjustable mid-campaign, effect next turn
app.post('/api/campaigns/:id/table-style', requireHost, async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id, 10);
    if (isNaN(campaignId)) {
      return res.status(400).json({ error: 'Invalid campaign ID.' });
    }
    const style = await queueCampaignTask(campaignId, () => rpg.setTableStyle(campaignId, req.body));
    res.json({ tableStyle: style });
  } catch (error) {
    const status = error.message.includes('not found') ? 404 : 500;
    res.status(status).json({ error: error.message });
  }
});

// A character joins an existing campaign's table (Phase 3 M3)
app.post('/api/campaigns/:id/join', rateLimit(10, 60000), requireHost, async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id, 10);
    if (isNaN(campaignId)) {
      return res.status(400).json({ error: 'Invalid campaign ID.' });
    }
    const { characterName, characterClass, characterProfileId, characterMode } = req.body;
    const state = await queueCampaignTask(campaignId, () => rpg.joinCampaign(campaignId, {
      characterName: optionalBoundedString(characterName, 'characterName', 80, ''),
      characterClass: optionalBoundedString(characterClass, 'characterClass', 120, ''),
      characterProfileId: characterProfileId ? parsePositiveInteger(characterProfileId, 'characterProfileId') : null,
      characterMode: characterMode === 'existing' ? 'existing' : 'new'
    }));
    res.json(state);
  } catch (error) {
    const status = error.message.includes('required') || error.message.includes('checked out') ? 400
      : error.message.includes('not found') ? 404
      : 500;
    res.status(status).json({ error: error.message });
  }
});

// Seat lifecycle (Phase S1, host-only): mint issues (or rotates) the one
// credential bound to a character — plaintext returned exactly once, only
// the hash is stored. Revoke kills it immediately.
app.post('/api/campaigns/:id/characters/:characterId/seat', requireHost, async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id, 10);
    const characterId = parseInt(req.params.characterId, 10);
    if (isNaN(campaignId) || isNaN(characterId)) {
      return res.status(400).json({ error: 'Invalid campaign or character ID.' });
    }
    const character = await db.get(
      `SELECT id, name FROM characters WHERE id = ? AND campaign_id = ? AND COALESCE(status, 'active') = 'active'`,
      [characterId, campaignId]
    );
    if (!character) {
      return res.status(404).json({ error: 'No active character with that ID in this campaign.' });
    }
    const token = mintSeatToken();
    // Rotation semantics: minting again replaces the old seat — the previous
    // token stops working the moment a new one exists.
    await db.run(`DELETE FROM seats WHERE character_id = ?`, [characterId]);
    await db.run(
      `INSERT INTO seats (campaign_id, character_id, token_hash, label) VALUES (?, ?, ?, ?)`,
      [campaignId, characterId, hashSeatToken(token), character.name]
    );
    res.json({ seatToken: token, characterId, characterName: character.name, note: 'Shown once — share it with that player only.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/campaigns/:id/characters/:characterId/seat', requireHost, async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id, 10);
    const characterId = parseInt(req.params.characterId, 10);
    if (isNaN(campaignId) || isNaN(characterId)) {
      return res.status(400).json({ error: 'Invalid campaign or character ID.' });
    }
    const result = await db.run(
      `UPDATE seats SET revoked_at = CURRENT_TIMESTAMP WHERE campaign_id = ? AND character_id = ? AND revoked_at IS NULL`,
      [campaignId, characterId]
    );
    res.json({ revoked: result.changes > 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Seat bootstrap (Phase S1): a seat token resolves straight to its campaign
// — seats never see the campaign list. The payload is the S2-scoped view
// (own sheet full, silhouettes, shared surfaces only).
app.get('/api/seat/session', async (req, res) => {
  try {
    if (req.auth?.kind !== 'seat') {
      return res.status(403).json({ error: 'Seat tokens only. Hosts load campaigns from the list.' });
    }
    const state = await rpg.getCampaignState(req.auth.campaignId);
    if (!state) {
      return res.status(404).json({ error: 'This seat\'s campaign no longer exists.' });
    }
    res.json(scopeStateForSeat(state, req.auth.characterId));
  } catch (error) {
    console.error('Error loading seat session:', error);
    res.status(500).json(errorPayloadFor(req, error, 'Could not load your seat.'));
  }
});

// One character leaves the table (Phase 3 M2): releases the profile and
// drops them from the turn order; campaign history keeps the character row.
app.post('/api/campaigns/:id/characters/:characterId/release', requireHost, async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id, 10);
    const characterId = parseInt(req.params.characterId, 10);
    if (isNaN(campaignId) || isNaN(characterId)) {
      return res.status(400).json({ error: 'Invalid campaign or character ID.' });
    }
    await queueCampaignTask(campaignId, () => rpg.releaseCharacter(campaignId, characterId));
    res.json({ success: true });
  } catch (error) {
    const status = error.message.includes('not found') ? 404 : 500;
    res.status(status).json({ error: error.message });
  }
});

// Fork campaign at a specific turn number (serialized per campaign)
app.post('/api/campaigns/:id/fork', requireHost, async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id, 10);
    if (isNaN(campaignId)) {
      return res.status(400).json({ error: 'Invalid campaign ID.' });
    }
    const { turnNumber, newTitle } = req.body;
    const cleanTurnNumber = parsePositiveInteger(turnNumber, 'turnNumber');
    const cleanNewTitle = boundedString(newTitle, 'newTitle', MAX_TITLE_LENGTH);
    const state = await queueCampaignTask(campaignId, () => 
      rpg.forkCampaign(campaignId, cleanTurnNumber, cleanNewTitle)
    );
    res.json(state);
  } catch (error) {
    console.error('Error forking campaign:', error);
    const status = error.message.startsWith('Invalid') || error.message.includes('required') || error.message.includes('characters or fewer') || error.message.includes('must be a string') ? 400 : 500;
    res.status(status).json({ error: error.message });
  }
});

// Fetch journal history for timeline
app.get('/api/campaigns/:id/journal', requireSeatCampaign, async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id, 10);
    if (isNaN(campaignId)) {
      return res.status(400).json({ error: 'Invalid campaign ID.' });
    }
    const turns = await db.all(
      `SELECT turn_number, player_action, narrative, state_changes_json, created_at FROM turns WHERE campaign_id = ? ORDER BY turn_number ASC`,
      [campaignId]
    );
    // Phase S2: seats get the sanitized journal — no state_changes_json
    // (it embeds memories and NPC updates), no memories at all.
    if (req.auth?.kind === 'seat') {
      return res.json({ turns: scopeJournalForSeat(turns), memories: [] });
    }
    const memories = await db.all(
      `SELECT turn_number, importance, summary, keywords, created_at FROM memories WHERE campaign_id = ? ORDER BY id ASC`,
      [campaignId]
    );
    res.json({ turns, memories });
  } catch (error) {
    console.error('Error fetching journal:', error);
    res.status(500).json(errorPayloadFor(req, error, 'Could not load the journal.'));
  }
});

// Delete a campaign (serialized per campaign)
app.delete('/api/campaigns/:id', requireHost, async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id, 10);
    if (isNaN(campaignId)) {
      return res.status(400).json({ error: 'Invalid campaign ID.' });
    }
    await queueCampaignTask(campaignId, async () => {
      await rpg.releaseCampaignCharacters(campaignId);
      await db.run(`DELETE FROM campaigns WHERE id = ?`, [campaignId]);
      // Saved narration audio lives on disk (Phase V4) — ON DELETE CASCADE
      // cannot reach it.
      await deleteCampaignAudio(campaignId);
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/campaigns/:id/release-character', requireHost, async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id, 10);
    if (isNaN(campaignId)) {
      return res.status(400).json({ error: 'Invalid campaign ID.' });
    }
    await queueCampaignTask(campaignId, () => rpg.releaseCampaignCharacters(campaignId, { detachCampaign: true }));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generated renders (Phase V3): served from the campaign_images index under
// the authenticated /api/campaigns mount. Renders are immutable once written.
app.get('/api/campaigns/:id/images/:imageId', requireSeatCampaign, async (req, res) => {
  try {
    const campaignId = Number(req.params.id);
    const imageId = Number(req.params.imageId);
    if (!Number.isInteger(campaignId) || !Number.isInteger(imageId)) {
      return res.status(400).json({ error: 'Invalid image reference.' });
    }
    const row = await db.get(
      `SELECT * FROM campaign_images WHERE id = ? AND campaign_id = ?`,
      [imageId, campaignId]
    );
    if (!row) {
      return res.status(404).json({ error: 'Image not found.' });
    }
    // file_path is stored relative to data/; resolve and confine it there.
    const dataDir = path.resolve(__dirname, 'data');
    const filePath = path.resolve(dataDir, row.file_path);
    if (!filePath.startsWith(dataDir + path.sep)) {
      return res.status(404).json({ error: 'Image data unavailable.' });
    }
    // Read errors (missing/unreadable file, directory at the path) must not
    // echo server filesystem paths to the client.
    let imageBytes;
    try {
      imageBytes = fs.readFileSync(filePath);
    } catch (readError) {
      return res.status(404).json({ error: 'Image data unavailable.' });
    }
    res.setHeader('Content-Type', row.mime_type || 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    res.send(imageBytes);
  } catch (error) {
    res.status(500).json({ error: 'Image lookup failed.' });
  }
});

// Save-once turn narration (Phase V4): the manifest request materializes the
// audio on first demand — synthesized once, persisted under data/audio/, then
// served from disk forever — so every seat replays the identical performance.
app.get('/api/campaigns/:id/audio/:turnNumber', rateLimit(60, 60000), requireSeatCampaign, async (req, res) => {
  try {
    const campaignId = Number(req.params.id);
    const turnNumber = Number(req.params.turnNumber);
    if (!Number.isInteger(campaignId) || !Number.isInteger(turnNumber)) {
      return res.status(400).json({ error: 'Invalid audio reference.' });
    }
    const manifest = await ensureTurnAudio(campaignId, turnNumber);
    res.json(publicTurnAudioManifest(manifest));
  } catch (error) {
    if (error instanceof AudioStoreError || error instanceof VoiceRequestError) {
      return res.status(error.status).json({
        error: error.message,
        ...(error.code ? { code: error.code } : {})
      });
    }
    res.status(500).json(errorPayloadFor(req, error, 'Turn narration is unavailable.'));
  }
});

app.get('/api/campaigns/:id/audio/:turnNumber/segments/:segmentId', rateLimit(240, 60000), requireSeatCampaign, async (req, res) => {
  try {
    const campaignId = Number(req.params.id);
    const turnNumber = Number(req.params.turnNumber);
    const segmentId = Number(req.params.segmentId);
    if (!Number.isInteger(campaignId) || !Number.isInteger(turnNumber) || !Number.isInteger(segmentId)) {
      return res.status(400).json({ error: 'Invalid audio reference.' });
    }
    const segment = await getTurnAudioSegment(campaignId, turnNumber, segmentId);
    // Segments are immutable once their manifest exists.
    res.setHeader('Content-Type', segment.mime);
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    res.send(segment.buffer);
  } catch (error) {
    if (error instanceof AudioStoreError) {
      return res.status(error.status).json({ error: error.message });
    }
    res.status(500).json({ error: 'Audio segment lookup failed.' });
  }
});

app.get('/api/audio/capabilities', async (req, res) => {
  try {
    res.json(await getVoiceCapabilities());
  } catch (error) {
    res.status(500).json(errorPayloadFor(req, error, 'Voice capabilities unavailable.'));
  }
});

app.post('/api/audio/narrate', rateLimit(240, 60000), async (req, res) => {
  try {
    const result = await narrateVoiceRequest({
      auth: req.auth,
      body: req.body,
      requester: req.ip || req.socket.remoteAddress || 'unknown'
    });
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.send(result.audio);
  } catch (error) {
    console.error('Error synthesizing narration:', error);
    const status = error instanceof VoiceRequestError ? error.status : 500;
    const payload = errorPayloadFor(req, error, 'Voice narration failed.');
    if (error instanceof VoiceRequestError && error.code) payload.code = error.code;
    res.status(status).json(payload);
  }
});

// -------------------------------------------------------------
// MODEL CONTEXT PROTOCOL (MCP) IMPLEMENTATION OVER SSE
// -------------------------------------------------------------

// MCP SSE Handshake Endpoint (Authenticated)
app.get('/api/mcp/sse', authenticateMcpSse, (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  const connectionId = crypto.randomUUID();
  const messageToken = crypto.randomUUID();
  console.log('MCP client connected.');

  mcpConnections.set(connectionId, { stream: res, messageToken });

  // Send SSE initial message endpoint link
  const messageUrl = `/api/mcp/message?connection_id=${connectionId}&message_token=${messageToken}`;
  res.write(`event: endpoint\ndata: ${messageUrl}\n\n`);

  // Start a periodic heartbeat to prevent network dropouts
  const heartbeatInterval = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  req.on('close', () => {
    console.log('MCP client disconnected.');
    clearInterval(heartbeatInterval);
    mcpConnections.delete(connectionId);
  });
});

// MCP Client Message Endpoint (authenticated via per-SSE capability token)
app.post('/api/mcp/message', async (req, res) => {
  const connectionId = req.query.connection_id;
  const messageToken = req.query.message_token;
  const connection = mcpConnections.get(connectionId);

  if (!connection) {
    return res.status(400).json({ error: 'Connection expired or invalid.' });
  }
  if (!timingSafeTokenEqual(String(messageToken || ''), connection.messageToken)) {
    return res.status(401).json({ error: 'Unauthorized. Invalid MCP message token.' });
  }

  const rpcRequest = req.body;
  console.log('Received MCP RPC request:', rpcRequest.method);

  let rpcResponse = {
    jsonrpc: '2.0',
    id: rpcRequest.id
  };

  try {
    switch (rpcRequest.method) {
      case 'initialize':
        rpcResponse.result = {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: 'aetheria-gm-mcp',
            version: '1.0.0'
          }
        };
        break;

      case 'tools/list':
        rpcResponse.result = {
          tools: [
            {
              name: 'list_campaigns',
              description: 'Retrieve a list of all active and completed campaigns in the RPG engine database.',
              inputSchema: { type: 'object', properties: {} }
            },
            {
              name: 'list_characters',
              description: 'List reusable player character profiles, checkout status, current campaign, stats, and known abilities.',
              inputSchema: { type: 'object', properties: {} }
            },
            {
        name: 'get_campaign_outline',
              description: 'Retrieve the 2-4 hour quest outline, main NPCs, settings, and acts structure of a campaign.',
              inputSchema: {
                type: 'object',
                properties: {
              campaign_id: { type: 'integer', minimum: 1, description: 'The unique campaign ID' }
                },
                required: ['campaign_id']
              }
            },
            {
        name: 'get_campaign_history',
              description: 'Fetch a bounded chronological narrative log of player actions and GM stories.',
              inputSchema: {
                type: 'object',
                properties: {
              campaign_id: { type: 'integer', minimum: 1, description: 'The unique campaign ID' },
              limit: {
                type: 'integer',
                minimum: 0,
                maximum: MAX_HISTORY_LIMIT,
                description: `Number of earliest turns to fetch (default/max: ${MAX_HISTORY_LIMIT})`
              }
                },
                required: ['campaign_id']
              }
            },
            {
              name: 'get_character_state',
              description: 'Retrieve the player character details, stats (HP/Mana/XP/Level), and inventory logs.',
              inputSchema: {
                type: 'object',
                properties: {
                  campaign_id: { type: 'integer', description: 'The unique campaign ID' }
                },
                required: ['campaign_id']
              }
            },
            {
        name: 'search_memories',
              description: 'Search campaign long-term memories for important plot points, character events, or summaries.',
              inputSchema: {
                type: 'object',
                properties: {
              campaign_id: { type: 'integer', minimum: 1, description: 'The unique campaign ID' },
              query: {
                type: 'string',
                    minLength: 1,
                    maxLength: MAX_MEMORY_QUERY_LENGTH,
                description: 'Keyword query search terms'
                  },
                  limit: {
                    type: 'integer',
                    minimum: 0,
                    maximum: MAX_MEMORY_LIMIT,
                    description: `Maximum matching memories to fetch (default/max: ${MAX_MEMORY_LIMIT})`
                  }
                },
                required: ['campaign_id', 'query']
              }
            }
          ]
        };
        break;

      case 'tools/call':
        rpcResponse.result = await handleToolCall(rpcRequest.params.name, rpcRequest.params.arguments);
        break;

      default:
        rpcResponse.error = {
          code: -32601,
          message: `Method not found: ${rpcRequest.method}`
        };
    }
  } catch (error) {
    rpcResponse.error = {
      code: -32603,
      message: error.message
    };
  }

  connection.stream.write(`event: message\ndata: ${JSON.stringify(rpcResponse)}\n\n`);
  res.status(202).send('Accepted');
});

// Helper for MCP Tools router
export async function handleToolCall(toolName, args) {
  let contentText = '';

  try {
    switch (toolName) {
      case 'list_campaigns': {
        const campaigns = await db.all(`SELECT * FROM campaigns`);
        contentText = JSON.stringify(campaigns, null, 2);
        break;
      }

      case 'list_characters': {
        const characters = await rpg.listPlayerCharacters();
        contentText = JSON.stringify(characters, null, 2);
        break;
      }

      case 'get_campaign_outline': {
        const outline = await readCampaignOutline(args.campaign_id);
        contentText = outline ? JSON.stringify(outline, null, 2) : 'Campaign outline not found.';
        break;
      }

      case 'get_campaign_history': {
        const limit = args.limit === undefined ? MAX_HISTORY_LIMIT : args.limit;
        const rows = await readCampaignHistory(args.campaign_id, {
          window: 'earliest',
          limit
        });
        if (rows.length === 0) {
          contentText = 'No history turns found for this campaign.';
        } else {
          contentText = rows.map(r => `[Turn ${r.turn_number}]\nPLAYER: ${r.player_action || '(Start Campaign)'}\nGM: ${r.gm_narrative}\n---`).join('\n\n');
        }
        break;
      }

      case 'get_character_state': {
        // Phase 3 M1: campaigns hold a party; report every member.
        const rows = await db.all(`SELECT * FROM characters WHERE campaign_id = ? ORDER BY id ASC`, [args.campaign_id]);
        if (rows.length === 0) {
          contentText = 'Character state not found.';
        } else {
          contentText = JSON.stringify(rows.map(row => ({
            character_id: row.id,
            name: row.name,
            class: row.class,
            archetype: row.class,
            player_character_id: row.player_character_id,
            health: `${row.health}/${row.max_health}`,
            mana: `${row.mana}/${row.max_mana}`,
            level: row.level,
            xp: row.xp,
            inventory: JSON.parse(row.inventory_json),
            attributes: JSON.parse(row.attributes_json),
            abilities: JSON.parse(row.abilities_json || '[]'),
            progression_notes: row.progression_notes || ''
          })), null, 2);
        }
        break;
      }

      case 'search_memories': {
        if (typeof args.query !== 'string' || args.query.trim() === '') {
          throw new Error('query must be a non-empty string.');
        }
        const rows = await readCampaignMemories(args.campaign_id, {
          query: args.query,
          limit: args.limit === undefined ? MAX_MEMORY_LIMIT : args.limit
        });
        contentText = rows.length > 0 
          ? rows.map(r => `- [Importance ${r.importance}] [${r.created_at}] [Tags: ${r.keywords || 'None'}]: ${r.summary}`).join('\n')
          : `No memories found matching "${args.query}"`;
        break;
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  } catch (err) {
    contentText = `Error executing tool: ${err.message}`;
  }

  return {
    content: [
      {
        type: 'text',
        text: contentText
      }
    ]
  };
}

// Terminal error handler (sv-2). Body-parser failures are thrown BEFORE
// `authenticate` runs, so without this Express's default handler answers a
// malformed or oversized body with a stack trace outside production —
// leaking internal paths to any caller, seat or stranger. Registered last,
// after every route, as Express requires.
app.use(apiErrorHandler);

export { app };

export async function startServer(port = PORT) {
  // Production safety checks: fail closed if production is active without ACCESS_SECRET configured
  if (process.env.NODE_ENV === 'production' && !process.env.ACCESS_SECRET) {
    throw new Error('ACCESS_SECRET is required in production.');
  }
  await db.initDb();
  return app.listen(port, () => {
      console.log(`--------------------------------------------------------`);
      console.log(`   Aetheria GM Game & MCP Server running on port ${port}`);
      console.log(`   Local URL: http://localhost:${port}`);
      console.log(`   MCP SSE Endpoint: http://localhost:${port}/api/mcp/sse`);
      if (!process.env.ADMIN_SECRET) {
        console.log(`   ⚠️  ADMIN_SECRET not set: /admin is open (single-operator dev mode).`);
        console.log(`   Set ADMIN_SECRET before hosting for others.`);
      }
      if (process.env.ACCESS_SECRET) {
        console.log(`   Authentication: ENABLED (Secret token configured)`);
      } else {
        console.log(`\n   ⚠️  WARNING: ACCESS_SECRET IS NOT CONFIGURED IN .env!`);
        console.log(`   ----------------------------------------------------`);
        console.log(`   API endpoints and MCP tools are running in open mode.`);
        console.log(`   If deploying to a public server, configure ACCESS_SECRET`);
        console.log(`   to protect from unauthorized requests & financial DoS.\n`);
      }
      console.log(`--------------------------------------------------------`);
  });
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  startServer().catch(err => {
    console.error('\n❌ CRITICAL: Failed to initialize SQLite database:', err);
    process.exit(1);
  });
}
