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
  saveAdminAiConfig,
  maskAiConfig
} from './server-config.js';
import { synthesizeSpeech, TTS_VOICES } from './tts-providers.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const TRUST_PROXY = process.env.TRUST_PROXY;

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

app.use(express.json({ limit: '64kb' }));
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
const MAX_NARRATION_LENGTH = 4000;
const MAX_TTS_INSTRUCTIONS_LENGTH = 600;

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

function stripNarrationText(value) {
  return String(value || '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[[^\]]*]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/[*_#>`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
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

// Periodically clean up stale rate limit entries to prevent memory leak
setInterval(() => {
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

// -------------------------------------------------------------
// AUTHENTICATION MIDDLEWARE
// -------------------------------------------------------------

function authenticate(req, res, next) {
  const secret = process.env.ACCESS_SECRET;
  if (!secret) {
    return next(); // Auth disabled if ACCESS_SECRET is not set
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized. Access token is required.' });
  }

  const token = authHeader.substring(7);
  if (!timingSafeTokenEqual(token, secret)) {
    return res.status(401).json({ error: 'Unauthorized. Invalid access token.' });
  }

  next();
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

// Login probe: 200 iff the presented password is valid (or auth is disabled).
app.post('/api/admin/verify', (req, res) => {
  res.json({ ok: true, authRequired: !!process.env.ADMIN_SECRET });
});

app.get('/api/admin/settings', async (req, res) => {
  try {
    res.json(maskAiConfig(await loadAdminAiConfig()));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/settings', async (req, res) => {
  try {
    const saved = await saveAdminAiConfig(req.body);
    res.json(maskAiConfig(saved));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// GAME API ENDPOINTS
// -------------------------------------------------------------

// List all campaigns
app.get('/api/campaigns', async (req, res) => {
  try {
    const campaigns = await db.all(
      `SELECT campaigns.*, characters.name AS character_name, characters.player_character_id
       FROM campaigns
       LEFT JOIN characters ON characters.campaign_id = campaigns.id
       ORDER BY campaigns.created_at DESC`
    );
    res.json(campaigns);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/characters', async (req, res) => {
  try {
    const characters = await rpg.listPlayerCharacters();
    res.json(characters);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new campaign (Rate limited: 5 campaigns per minute per IP)
app.post('/api/campaigns', rateLimit(5, 60000), async (req, res) => {
  try {
    // Server-owned AI config (decision 2026-06-11): client-supplied apiConfig is
    // ignored; the operator's /admin + env configuration is authoritative.
    const { genre, characterName, characterClass, characterProfileId, characterMode, rulesMode, ruleset } = req.body;
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
      ruleset: cleanRuleset
    });
    res.json(state);
  } catch (error) {
    console.error('Error creating campaign:', error);
    const status = error.message.includes('checked out') || error.message.includes('no longer available')
      ? 409
      : error.message.includes('not found')
        ? 404
        : error.message.includes('API key') || error.message.includes('configured') || error.message.includes('Invalid') || error.message.includes('required') || error.message.includes('characters or fewer') || error.message.includes('must be a string')
          ? 400
          : 500;
    res.status(status).json({ error: error.message });
  }
});

// Load an existing campaign
app.get('/api/campaigns/:id', async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id, 10);
    if (isNaN(campaignId)) {
      return res.status(400).json({ error: 'Invalid campaign ID.' });
    }
    const state = await rpg.getCampaignState(campaignId);
    if (!state) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    res.json(state);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Process a game turn (serialized per campaign and rate limited)
app.post('/api/campaigns/:id/turn', rateLimit(10, 60000), async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id, 10);
    if (isNaN(campaignId)) {
      return res.status(400).json({ error: 'Invalid campaign ID.' });
    }
    const { playerAction } = req.body;
    const cleanPlayerAction = boundedString(playerAction, 'playerAction', MAX_ACTION_LENGTH);
    const apiConfig = await getServerAiConfig();
    const state = await queueCampaignTask(campaignId, () =>
      rpg.takeTurn(campaignId, cleanPlayerAction, apiConfig)
    );
    res.json(state);
  } catch (error) {
    console.error('Error processing turn:', error);
    const status = error.message.includes('required') || error.message.includes('characters or fewer') || error.message.includes('must be a string') ? 400 : 500;
    res.status(status).json({ error: error.message });
  }
});

// Fork campaign at a specific turn number (serialized per campaign)
app.post('/api/campaigns/:id/fork', async (req, res) => {
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
app.get('/api/campaigns/:id/journal', async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id, 10);
    if (isNaN(campaignId)) {
      return res.status(400).json({ error: 'Invalid campaign ID.' });
    }
    const turns = await db.all(
      `SELECT turn_number, player_action, narrative, state_changes_json, created_at FROM turns WHERE campaign_id = ? ORDER BY turn_number ASC`,
      [campaignId]
    );
    const memories = await db.all(
      `SELECT turn_number, importance, summary, keywords, created_at FROM memories WHERE campaign_id = ? ORDER BY id ASC`,
      [campaignId]
    );
    res.json({ turns, memories });
  } catch (error) {
    console.error('Error fetching journal:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a campaign (serialized per campaign)
app.delete('/api/campaigns/:id', async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id, 10);
    if (isNaN(campaignId)) {
      return res.status(400).json({ error: 'Invalid campaign ID.' });
    }
    await queueCampaignTask(campaignId, async () => {
      await rpg.releaseCampaignCharacters(campaignId);
      await db.run(`DELETE FROM campaigns WHERE id = ?`, [campaignId]);
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/campaigns/:id/release-character', async (req, res) => {
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
app.get('/api/campaigns/:id/images/:imageId', async (req, res) => {
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

app.post('/api/audio/narrate', rateLimit(20, 60000), async (req, res) => {
  try {
    const { text, audioConfig = {} } = req.body;
    const narrationText = boundedString(stripNarrationText(text), 'text', MAX_NARRATION_LENGTH);
    // Voice API key and TTS model are server-owned (decision 2026-07-03); the
    // voice choice and style instructions remain player preferences.
    const serverConfig = await getServerAiConfig();
    const voice = TTS_VOICES.has(audioConfig.voice || process.env.TTS_VOICE)
      ? (audioConfig.voice || process.env.TTS_VOICE)
      : 'marin';
    const instructions = optionalBoundedString(
      audioConfig.instructions,
      'instructions',
      MAX_TTS_INSTRUCTIONS_LENGTH,
      'Narrate as an atmospheric game master. Keep the delivery clear, tense, and cinematic without overacting.'
    );

    const audioBuffer = await synthesizeSpeech({
      provider: serverConfig.voiceProvider,
      apiKey: serverConfig.voiceApiKey,
      model: serverConfig.voiceModel,
      voice,
      instructions,
      text: narrationText
    });
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.send(audioBuffer);
  } catch (error) {
    const status = error.message.includes('required') || error.message.includes('characters or fewer') || error.message.includes('must be a string') ? 400 : 500;
    res.status(status).json({ error: error.message });
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
                  campaign_id: { type: 'integer', description: 'The unique campaign ID' }
                },
                required: ['campaign_id']
              }
            },
            {
              name: 'get_campaign_history',
              description: 'Fetch the full chronological narrative log and choices of player actions and GM stories.',
              inputSchema: {
                type: 'object',
                properties: {
                  campaign_id: { type: 'integer', description: 'The unique campaign ID' },
                  limit: { type: 'integer', description: 'Number of turns to fetch (default: all)' }
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
                  campaign_id: { type: 'integer', description: 'The unique campaign ID' },
                  query: { type: 'string', description: 'Keyword query search terms' }
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
async function handleToolCall(toolName, args) {
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
        const row = await db.get(`SELECT * FROM campaign_outlines WHERE campaign_id = ?`, [args.campaign_id]);
        contentText = row ? JSON.stringify(JSON.parse(row.outline_json), null, 2) : 'Campaign outline not found.';
        break;
      }

      case 'get_campaign_history': {
        const rawLimit = args.limit !== undefined ? parseInt(args.limit, 10) : 1000;
        const limit = isNaN(rawLimit) ? 1000 : rawLimit;
        const rows = await db.all(
          `SELECT turn_number, player_action, narrative FROM turns WHERE campaign_id = ? ORDER BY turn_number ASC LIMIT ?`,
          [args.campaign_id, limit]
        );
        if (rows.length === 0) {
          contentText = 'No history turns found for this campaign.';
        } else {
          contentText = rows.map(r => `[Turn ${r.turn_number}]\nPLAYER: ${r.player_action || '(Start Campaign)'}\nGM: ${r.narrative}\n---`).join('\n\n');
        }
        break;
      }

      case 'get_character_state': {
        const row = await db.get(`SELECT * FROM characters WHERE campaign_id = ?`, [args.campaign_id]);
        if (!row) {
          contentText = 'Character state not found.';
        } else {
          contentText = JSON.stringify({
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
          }, null, 2);
        }
        break;
      }

      case 'search_memories': {
        const query = `%${args.query}%`;
        const rows = await db.all(
          `SELECT summary, importance, keywords, created_at FROM memories WHERE campaign_id = ? AND (summary LIKE ? OR keywords LIKE ?) ORDER BY importance DESC, id DESC`,
          [args.campaign_id, query, query]
        );
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

// Production safety checks: fail closed if production is active without ACCESS_SECRET configured
if (process.env.NODE_ENV === 'production' && !process.env.ACCESS_SECRET) {
  console.error('\n❌ CRITICAL STARTUP ERROR: ACCESS_SECRET is not configured in .env!');
  console.error('In a production environment, you must set ACCESS_SECRET to secure your database and API endpoints.\n');
  process.exit(1);
}

// Start server after successful database initialization
db.initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`--------------------------------------------------------`);
      console.log(`   Aetheria GM Game & MCP Server running on port ${PORT}`);
      console.log(`   Local URL: http://localhost:${PORT}`);
      console.log(`   MCP SSE Endpoint: http://localhost:${PORT}/api/mcp/sse`);
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
  })
  .catch(err => {
    console.error('\n❌ CRITICAL: Failed to initialize SQLite database:', err);
    process.exit(1);
  });
