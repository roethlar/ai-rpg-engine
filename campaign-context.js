import crypto from 'crypto';
import * as db from './db.js';
import { validateOutlineData } from './rpg-state.js';

export const MAX_HISTORY_LIMIT = 1000;
export const MAX_MEMORY_LIMIT = 100;
export const MAX_MEMORY_QUERY_LENGTH = 200;
export const STAGE_ONE_HISTORY_LIMIT = 6;
export const STAGE_ONE_MEMORY_LIMIT = 8;

export class CampaignContextError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'CampaignContextError';
    this.code = code;
  }
}

export function validateCampaignId(campaignId) {
  if (!Number.isSafeInteger(campaignId) || campaignId <= 0) {
    throw new CampaignContextError(
      'campaign_id must be a positive safe integer.',
      'CAMPAIGN_ID_INVALID'
    );
  }
  return campaignId;
}

function boundedLimit(value, fallback, maximum, fieldName) {
  const candidate = value === undefined ? fallback : value;
  if (!Number.isSafeInteger(candidate) || candidate < 0) {
    throw new CampaignContextError(
      `${fieldName} must be a non-negative safe integer.`,
      'CAMPAIGN_CONTEXT_LIMIT_INVALID'
    );
  }
  return Math.min(candidate, maximum);
}

function validateHistoryWindow(window) {
  if (window !== 'earliest' && window !== 'latest') {
    throw new CampaignContextError(
      'History window must be "earliest" or "latest".',
      'CAMPAIGN_HISTORY_WINDOW_INVALID'
    );
  }
  return window;
}

function validateMemoryQuery(query) {
  if (query === undefined || query === null || query === '') return '';
  if (typeof query !== 'string') {
    throw new CampaignContextError(
      'Memory query must be a string.',
      'CAMPAIGN_MEMORY_QUERY_INVALID'
    );
  }
  const clean = query.trim();
  if (clean.length > MAX_MEMORY_QUERY_LENGTH) {
    throw new CampaignContextError(
      `Memory query must be at most ${MAX_MEMORY_QUERY_LENGTH} characters.`,
      'CAMPAIGN_MEMORY_QUERY_INVALID'
    );
  }
  return clean;
}

/**
 * Read and validate the campaign's stored outline. A missing row is not corrupt
 * and returns null; malformed stored data fails without quoting private canon.
 */
export async function readCampaignOutline(campaignId) {
  validateCampaignId(campaignId);
  const row = await db.get(
    `SELECT outline_json FROM campaign_outlines WHERE campaign_id = ?`,
    [campaignId]
  );
  if (!row) return null;

  let parsed;
  try {
    parsed = JSON.parse(row.outline_json);
  } catch (_error) {
    throw new CampaignContextError(
      'Campaign outline is malformed.',
      'CAMPAIGN_OUTLINE_INVALID'
    );
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new CampaignContextError(
      'Campaign outline is malformed.',
      'CAMPAIGN_OUTLINE_INVALID'
    );
  }

  try {
    return validateOutlineData(parsed);
  } catch (_error) {
    throw new CampaignContextError(
      'Campaign outline is malformed.',
      'CAMPAIGN_OUTLINE_INVALID'
    );
  }
}

/**
 * Return structured turns. The latest window is selected newest-first in SQL,
 * then reversed so every caller receives chronological rows.
 */
export async function readCampaignHistory(campaignId, {
  window = 'earliest',
  limit = MAX_HISTORY_LIMIT
} = {}) {
  validateCampaignId(campaignId);
  validateHistoryWindow(window);
  const bounded = boundedLimit(limit, MAX_HISTORY_LIMIT, MAX_HISTORY_LIMIT, 'History limit');
  if (bounded === 0) return [];

  const direction = window === 'latest' ? 'DESC' : 'ASC';
  const rows = await db.all(
    `SELECT id, campaign_id, turn_number, character_id, player_action, narrative,
            state_changes_json, created_at
       FROM turns
      WHERE campaign_id = ?
      ORDER BY turn_number ${direction}, id ${direction}
      LIMIT ?`,
    [campaignId, bounded]
  );
  if (window === 'latest') rows.reverse();

  return rows.map(row => ({
    id: row.id,
    campaign_id: row.campaign_id,
    turn_number: row.turn_number,
    character_id: row.character_id ?? null,
    player_action: row.player_action ?? null,
    gm_narrative: row.narrative,
    state_changes_json: row.state_changes_json ?? null,
    created_at: row.created_at
  }));
}

/**
 * Read campaign memories by importance, then newest row id. A query narrows
 * the same ranked read and retains the MCP tool's LIKE matching behavior.
 */
export async function readCampaignMemories(campaignId, {
  query = '',
  limit = MAX_MEMORY_LIMIT
} = {}) {
  validateCampaignId(campaignId);
  const bounded = boundedLimit(limit, MAX_MEMORY_LIMIT, MAX_MEMORY_LIMIT, 'Memory limit');
  const cleanQuery = validateMemoryQuery(query);
  if (bounded === 0) return [];

  const where = cleanQuery
    ? 'AND (summary LIKE ? OR keywords LIKE ?)'
    : '';
  const params = cleanQuery
    ? [campaignId, `%${cleanQuery}%`, `%${cleanQuery}%`, bounded]
    : [campaignId, bounded];
  return db.all(
    `SELECT id, campaign_id, turn_number, importance, summary, keywords, created_at
       FROM memories
      WHERE campaign_id = ? ${where}
      ORDER BY importance DESC, id DESC
      LIMIT ?`,
    params
  );
}

function normalizeDigestValue(value, inArray = false) {
  if (value === null) return null;
  if (typeof value === 'string') {
    return value.normalize('NFC').replace(/\r\n?/g, '\n');
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.map(item => {
      const normalized = normalizeDigestValue(item, true);
      return normalized === undefined ? null : normalized;
    });
  }
  if (typeof value === 'object') {
    const normalized = {};
    for (const key of Object.keys(value).sort()) {
      const child = normalizeDigestValue(value[key], false);
      if (child !== undefined) normalized[key] = child;
    }
    return normalized;
  }
  return inArray ? null : undefined;
}

export function stableCanonBasisJson(basis) {
  return JSON.stringify(normalizeDigestValue(basis));
}

export function digestCanonBasis(basis) {
  return crypto.createHash('sha256').update(stableCanonBasisJson(basis), 'utf8').digest('hex');
}

function stageOneHistoryRow(row) {
  return {
    turn_id: row.id,
    turn_number: row.turn_number,
    player_action: {
      source: 'player_action_or_claim',
      text: row.player_action
    },
    gm_narrative: {
      source: 'gm_narrative',
      text: row.gm_narrative
    }
  };
}

function mergeRelevantMemories(matches, ranked, limit) {
  const merged = [];
  const seen = new Set();
  for (const row of [...matches, ...ranked]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    merged.push(row);
    if (merged.length === limit) break;
  }

  // A broad lexical query must not crowd out the always-ranked fallback.
  // Reserve the final slot for its strongest row when no ranked row survived.
  if (merged.length === limit && ranked.length > 0) {
    const rankedIds = new Set(ranked.map(row => row.id));
    const hasRanked = merged.some(row => rankedIds.has(row.id));
    if (!hasRanked) merged[limit - 1] = ranked[0];
  }
  return merged.sort((a, b) =>
    (b.importance - a.importance) || (b.id - a.id)
  );
}

/**
 * Build the GM-private Stage-1 canon basis. Lexical matches are optional; the
 * always-ranked read fills every unused slot and prevents an empty/weak query
 * from erasing the campaign's strongest memories.
 */
export async function readStageOneCanonContext(campaignId, {
  memoryQuery = ''
} = {}) {
  validateCampaignId(campaignId);
  const cleanMemoryQuery = validateMemoryQuery(memoryQuery);
  const outline = await readCampaignOutline(campaignId);
  if (!outline) return null;

  const history = await readCampaignHistory(campaignId, {
    window: 'latest',
    limit: STAGE_ONE_HISTORY_LIMIT
  });
  const rankedMemories = await readCampaignMemories(campaignId, {
    limit: STAGE_ONE_MEMORY_LIMIT
  });
  const matchedMemories = cleanMemoryQuery
    ? await readCampaignMemories(campaignId, {
      query: cleanMemoryQuery,
      limit: STAGE_ONE_MEMORY_LIMIT
    })
    : [];
  const memories = mergeRelevantMemories(
    matchedMemories,
    rankedMemories,
    STAGE_ONE_MEMORY_LIMIT
  );

  const basis = {
    campaign_id: campaignId,
    outline,
    history: history.map(stageOneHistoryRow),
    memories: memories.map(memory => ({
      memory_id: memory.id,
      turn_number: memory.turn_number ?? null,
      importance: memory.importance,
      summary: memory.summary,
      keywords: memory.keywords ?? null,
      created_at: memory.created_at
    }))
  };

  return {
    basis,
    digest: digestCanonBasis(basis)
  };
}
