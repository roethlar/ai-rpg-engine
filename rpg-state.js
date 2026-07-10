/**
 * RPG State Management Submodule
 */

/**
 * Utility to clean markdown formatting from LLM JSON responses.
 *
 * sv-2: the raw model output must NEVER ride in the thrown message. Council
 * roles are fed the outline, NPC notes, and memories, and their schemas
 * require private fields (memory_summary, npc note_update) — so a malformed
 * response is a container of GM-private text. Error messages cross trust
 * boundaries (they reach seats through HTTP error bodies); the raw text is a
 * debugging aid and belongs in the server log instead. `error.rawText`
 * carries it for callers that log server-side.
 */
export function parseJsonSafe(text) {
  let cleanText = text.trim();

  if (cleanText.startsWith('```')) {
    const lines = cleanText.split('\n');
    if (lines[0].startsWith('```')) {
      lines.shift();
    }
    if (lines[lines.length - 1].startsWith('```')) {
      lines.pop();
    }
    cleanText = lines.join('\n').trim();
  }

  try {
    return JSON.parse(cleanText);
  } catch (error) {
    const firstBrace = cleanText.indexOf('{');
    const lastBrace = cleanText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      try {
        return JSON.parse(cleanText.substring(firstBrace, lastBrace + 1));
      } catch (err2) {
        throw jsonParseFailure(text);
      }
    }
    // sv-2 round 2: the no-brace path used to rethrow the NATIVE error, whose
    // message quotes a snippet of the input ("Unexpected token 'P',
    // \"PRIVATE_PL\"... is not valid JSON") and which carries no rawText.
    // Two defects at once: model content in the message, diagnostics lost.
    throw jsonParseFailure(text);
  }
}

/**
 * A parse failure with a FIXED, content-free message. Native `JSON.parse`
 * messages echo a snippet of the input, and that input is model output built
 * from the GM's private record — so no parse error may ever quote it. The
 * text travels out-of-band on `rawText`, for server-side logging only.
 */
function jsonParseFailure(text) {
  const failure = new Error('The model returned malformed JSON.');
  failure.rawText = text;
  return failure;
}

/**
 * Procedurally generates a placeholder SVG graphic if the LLM fails to output valid SVG.
 */
export function createFallbackSvg(title, primaryColor = '200, 70%, 50%', secondaryColor = '300, 70%, 50%') {
  const pColor = normalizeHslColor(primaryColor, '200, 70%, 50%');
  const sColor = normalizeHslColor(secondaryColor, '300, 70%, 50%');
  const safeTitle = escapeXmlText(String(title || 'Aetheria').toUpperCase());
  
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" class="w-full h-full rounded-lg shadow-2xl">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:hsl(${pColor});stop-opacity:0.15" />
        <stop offset="100%" style="stop-color:hsl(${sColor});stop-opacity:0.05" />
      </linearGradient>
      <linearGradient id="gridGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style="stop-color:hsl(${pColor});stop-opacity:0.2" />
        <stop offset="100%" style="stop-color:transparent;stop-opacity:0" />
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="#0a0a0c" />
    <rect width="100%" height="100%" fill="url(#bgGrad)" />
    <path d="M 0,200 L 800,200 M 400,0 L 400,400" stroke="url(#gridGrad)" stroke-width="1" />
    <circle cx="400" cy="200" r="100" fill="none" stroke="hsl(${pColor})" stroke-width="2" stroke-dasharray="5,5" opacity="0.3" />
    <g transform="translate(400, 200)">
      <polygon points="0,-60 52,30 -52,30" fill="none" stroke="hsl(${sColor})" stroke-width="2" opacity="0.6">
        <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="20s" repeatCount="indefinite" />
      </polygon>
    </g>
    <text x="400" y="210" font-family="'Outfit', 'Inter', sans-serif" font-size="24" fill="#ffffff" text-anchor="middle" font-weight="bold" letter-spacing="4" opacity="0.9">${safeTitle}</text>
    <text x="400" y="240" font-family="'Inter', sans-serif" font-size="14" fill="#a0a0b0" text-anchor="middle" opacity="0.6">AETHERIA RPG ENGINE</text>
  </svg>`;
}

function normalizeHslColor(value, fallback) {
  const raw = String(value || fallback).trim();
  const match = raw.match(/^(\d{1,3})\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%$/);
  if (!match) return fallback;

  const h = Math.max(0, Math.min(360, Number(match[1])));
  const s = Math.max(0, Math.min(100, Number(match[2])));
  const l = Math.max(0, Math.min(100, Number(match[3])));
  return `${h}, ${s}%, ${l}%`;
}

function escapeXmlText(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Coerces dice-roll records to the canonical shape (cr-4: shared by live
 * play and the import trust boundary — the roll bubble dereferences these).
 * Entries without numeric total+dc are dropped; everything else is coerced.
 */
export function sanitizeDiceRollRecords(raw) {
  const rolls = [];
  if (Array.isArray(raw)) {
    raw.slice(0, 3).forEach(roll => {
      if (!roll || typeof roll !== 'object' || Array.isArray(roll)) return;
      if (typeof roll.total !== 'number' || isNaN(roll.total)) return;
      if (typeof roll.dc !== 'number' || isNaN(roll.dc)) return;
      rolls.push({
        attribute: typeof roll.attribute === 'string' ? roll.attribute : 'strength',
        roll: typeof roll.roll === 'number' && !isNaN(roll.roll) ? roll.roll : 0,
        modifier: typeof roll.modifier === 'number' && !isNaN(roll.modifier) ? roll.modifier : 0,
        total: roll.total,
        dc: roll.dc,
        success: !!roll.success,
        reason: typeof roll.reason === 'string' ? roll.reason.trim() : '',
        consequence: typeof roll.consequence === 'string' ? roll.consequence.trim() : '',
        applied_health_change: typeof roll.applied_health_change === 'number' && !isNaN(roll.applied_health_change)
          ? Math.max(-50, Math.min(0, Math.floor(roll.applied_health_change)))
          : 0,
        applied_mana_change: typeof roll.applied_mana_change === 'number' && !isNaN(roll.applied_mana_change)
          ? Math.max(-30, Math.min(0, Math.floor(roll.applied_mana_change)))
          : 0
      });
    });
  }
  return rolls;
}

/**
 * Validates and sanitizes LLM JSON output to prevent malformed values from corrupting the DB/UI.
 */
export function validateTurnData(raw, currentAct = 1, tableStyle = null) {
  const data = raw || {};
  const validated = {};
  const style = validateTableStyle(tableStyle);

  const inputKinds = ['clarification', 'dialogue', 'committed_action'];
  validated.input_kind = inputKinds.includes(data.input_kind)
    ? data.input_kind
    : 'committed_action';

  // 1. Narrative Log
  validated.narrative = typeof data.narrative === 'string' && data.narrative.trim() !== ''
    ? data.narrative.trim()
    : 'The scene continues...';

  // 2. Suggested choices — style-aware caps (Phase D, decision 2026-07-04):
  // choices are unsolicited hints, so they fade with the helpfulness dial.
  // hardline shows none regardless of what the model emitted; classic keeps
  // at most 3 with no invented backfill; helpful keeps today's behavior.
  validated.suggested_choices = [];
  if (Array.isArray(data.suggested_choices)) {
    validated.suggested_choices = data.suggested_choices
      .filter(item => typeof item === 'string' && item.trim() !== '')
      .map(item => item.trim());
  }
  if (style.helpfulness === 'hardline') {
    validated.suggested_choices = [];
  } else {
    validated.suggested_choices = validated.suggested_choices.slice(0, style.helpfulness === 'classic' ? 3 : 4);
    if (validated.suggested_choices.length === 0 && style.helpfulness === 'helpful') {
      validated.suggested_choices = ['Continue exploring', 'Look around carefully', 'Prepare yourself'];
    }
  }

  // 3. Character updates
  const charUp = data.character_update || {};
  validated.character_update = {
    health_change: typeof charUp.health_change === 'number' && !isNaN(charUp.health_change)
      ? Math.max(-100, Math.min(100, charUp.health_change))
      : 0,
    mana_change: typeof charUp.mana_change === 'number' && !isNaN(charUp.mana_change)
      ? Math.max(-100, Math.min(100, charUp.mana_change))
      : 0,
    xp_gain: typeof charUp.xp_gain === 'number' && !isNaN(charUp.xp_gain)
      ? Math.max(0, Math.min(100, charUp.xp_gain))
      : 0,
    inventory_changes: []
  };

  if (Array.isArray(charUp.inventory_changes)) {
    charUp.inventory_changes.forEach(change => {
      if (!change || typeof change !== 'object') return;
      const action = change.action;
      const item = change.item;
      if ((action === 'add' || action === 'remove' || action === 'use') && item && typeof item === 'object' && item.name) {
        const validatedItem = {
          name: String(item.name).trim(),
          type: typeof item.type === 'string' ? item.type : 'general',
          description: typeof item.description === 'string' ? item.description : 'No description.',
          quantity: typeof item.quantity === 'number' && item.quantity > 0 ? Math.floor(item.quantity) : 1
        };
        if (item.stats) validatedItem.stats = String(item.stats);
        if (item.equipped !== undefined) validatedItem.equipped = !!item.equipped;
        
        validated.character_update.inventory_changes.push({
          action,
          item: validatedItem
        });
      }
    });
  }

  // 4. Quest updates
  const questUp = data.quest_update || {};
  validated.quest_update = {
    active_quest: typeof questUp.active_quest === 'string' && questUp.active_quest.trim() !== ''
      ? questUp.active_quest.trim()
      : 'Explore the world',
    quest_description: typeof questUp.quest_description === 'string'
      ? questUp.quest_description.trim()
      : '',
    current_act: typeof questUp.current_act === 'number' && [1, 2, 3].includes(questUp.current_act)
      ? questUp.current_act
      : currentAct
  };

  // 5. Illustration SVG
  validated.svg_illustration = typeof data.svg_illustration === 'string'
    ? data.svg_illustration.trim()
    : null;

  // 5b. Scene grounding (new — critical for good clarification/table-talk experience)
  validated.scene_grounding = typeof data.scene_grounding === 'string' && data.scene_grounding.trim() !== ''
    ? data.scene_grounding.trim()
    : null;

  // 5c. Dice roll records (engine-rolled in the Council path; sanitized here so the
  // durable turn state — which clarification turns and forks replay — stays well-formed)
  validated.dice_rolls = sanitizeDiceRollRecords(data.dice_rolls);

  // 5e. Location signal (Phase V2): engine-stamped from the Referee's
  // location block on committed actions; sanitized here so the durable turn
  // record — which forks and later turns replay — stays well-formed.
  validated.location_update = data.location_update ? validateLocationUpdate(data.location_update) : null;

  // 5f. Focal-subject signal (Phase V3): engine-stamped from the Referee,
  // consumed by the heroic stickiness rules. State, not presentation.
  validated.focal_subject = data.focal_subject ? validateFocalSubject(data.focal_subject) : null;

  // 5g. Encounter report (Phase D): engine-stamped from the Referee; the
  // recorded fact behind the pacing dial's cadence rule.
  validated.encounter = ['none', 'player_sought', 'gm_initiated'].includes(data.encounter)
    ? data.encounter
    : 'none';

  // 5h. Did a committed action actually resolve? Engine-stamped (M2 review
  // fix): denials and needs_clarification keep input_kind committed_action
  // for narration but must not consume the acting player's turn.
  validated.action_resolved = !!data.action_resolved;

  // 5d. Voice script (Phase 2): speaker+tone-tagged segments mirroring the
  // narrative, emitted at generation time so dialogue attribution comes from
  // the narrator, not post-hoc parsing. Presentation data, not game state —
  // survives the table-talk no-op net.
  validated.narration_lines = [];
  if (Array.isArray(data.narration_lines)) {
    data.narration_lines.slice(0, 40).forEach(line => {
      if (!line || typeof line !== 'object') return;
      const text = typeof line.text === 'string' ? line.text.trim() : '';
      if (!text) return;
      validated.narration_lines.push({
        speaker: typeof line.speaker === 'string' && line.speaker.trim() !== ''
          ? line.speaker.trim().slice(0, 80)
          : 'narrator',
        tone: typeof line.tone === 'string' ? line.tone.trim().slice(0, 120) : '',
        text: text.slice(0, 2000)
      });
    });
  }

  // 6. Memory logs
  validated.memory_summary = typeof data.memory_summary === 'string' && data.memory_summary.trim() !== ''
    ? data.memory_summary.trim()
    : null;

  validated.memory_importance = typeof data.memory_importance === 'number' && !isNaN(data.memory_importance)
    ? Math.max(1, Math.min(5, Math.floor(data.memory_importance)))
    : 3;

  validated.memory_keywords = typeof data.memory_keywords === 'string'
    ? data.memory_keywords.trim()
    : '';

  // 7. Character ability progression
  validated.ability_updates = [];
  if (Array.isArray(data.ability_updates)) {
    data.ability_updates.forEach(update => {
      if (!update || typeof update !== 'object') return;
      const action = update.action;
      if (!['add', 'improve', 'remove'].includes(action)) return;

      const ability = update.ability && typeof update.ability === 'object' ? update.ability : {};
      const name = typeof ability.name === 'string' ? ability.name.trim() : '';
      if (!name) return;

      validated.ability_updates.push({
        action,
        ability: {
          name,
          description: typeof ability.description === 'string' && ability.description.trim() !== ''
            ? ability.description.trim()
            : 'A developing capability.',
          tier: typeof ability.tier === 'string' && ability.tier.trim() !== ''
            ? ability.tier.trim()
            : 'emerging',
          source: typeof ability.source === 'string' && ability.source.trim() !== ''
            ? ability.source.trim()
            : 'in-game development'
        },
        note: typeof update.note === 'string' ? update.note.trim() : ''
      });
    });
  }

  // 8. NPC updates
  validated.npc_updates = [];
  if (Array.isArray(data.npc_updates)) {
    data.npc_updates.forEach(update => {
      if (!update || typeof update !== 'object' || !update.name) return;
      validated.npc_updates.push({
        name: String(update.name).trim(),
        relationship_change: typeof update.relationship_change === 'number' && !isNaN(update.relationship_change)
          ? Math.max(-50, Math.min(50, Math.floor(update.relationship_change)))
          : 0,
        note_update: typeof update.note_update === 'string' ? update.note_update.trim() : '',
        status: ['alive', 'dead', 'missing'].includes(update.status) ? update.status : 'alive'
      });
    });
  }

  // Phase 0 safety net: if the model (or any upstream) marked this turn clarification,
  // force zero state mutations here. The engine post-processing (rpg-engine.js) does
  // the same, but this makes the guarantee hold even for direct DB consumers or partial responses.
  if (validated.input_kind === 'clarification') {
    validated.character_update = { health_change: 0, mana_change: 0, xp_gain: 0, inventory_changes: [] };
    validated.quest_update = {
      active_quest: validated.quest_update?.active_quest || 'Explore the world',
      quest_description: validated.quest_update?.quest_description || '',
      // Pin the act: a clarification turn must never advance (or rewind) the act,
      // even when the model emits a different valid current_act.
      current_act: currentAct
    };
    validated.ability_updates = [];
    validated.npc_updates = [];
    validated.memory_summary = null;
    validated.memory_keywords = '';
    validated.dice_rolls = [];
    validated.roll_result = null;
    // Location, heroic, and pacing state never mutate on table talk (the
    // display path is separate: the engine still returns stored state).
    validated.location_update = null;
    validated.focal_subject = null;
    validated.encounter = 'none';
    validated.action_resolved = false;
  }

  return validated;
}

/**
 * Turn kinds that are table talk: pure information exchange or in-character
 * conversation, never a state mutation.
 */
export const TABLE_TALK_KINDS = ['clarification', 'dialogue'];

/**
 * Decision 2026-06-05: clarification and dialogue turns must never mutate canonical
 * state. Forces every state-bearing field of a turn payload to a no-op. Quest is
 * reset from turnContext (DB truth), never from model output.
 */
export function forceNoOpTurnState(finalData, turnContext, inputKind) {
  finalData.input_kind = inputKind;
  finalData.character_update = {
    health_change: 0,
    mana_change: 0,
    xp_gain: 0,
    inventory_changes: []
  };
  finalData.quest_update = {
    active_quest: turnContext.active_quest.title,
    quest_description: turnContext.active_quest.description,
    current_act: turnContext.campaign.current_act
  };
  finalData.ability_updates = [];
  finalData.npc_updates = [];
  finalData.memory_summary = null;
  finalData.memory_keywords = '';
  finalData.dice_rolls = [];
  finalData.location_update = null;
  finalData.focal_subject = null;
  finalData.encounter = 'none';
  finalData.action_resolved = false;
  return finalData;
}

/**
 * Structured location state (Phase V2, owner direction 2026-06-11/13):
 * locations are first-class entities with a stored layout — areas on a coarse
 * 100x70 canvas, exits, fixed features — plus a mutable occupancy layer.
 * Generated once on first entry, loaded on revisit, mutated only through the
 * referee/continuity gate. A map is the structured evolution of
 * scene_grounding; the render is deterministic (map-render.js), never AI.
 */
export const LOCATION_CANVAS = { width: 100, height: 70 };
const OCCUPANT_KINDS = ['player', 'npc', 'creature', 'object'];
const MAX_AREAS = 8;
const MAX_FEATURES = 16;
const MAX_OCCUPANTS = 16;

function cleanText(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/**
 * Validates a generated location layout. Returns null when there is no
 * usable area list — callers treat that as "no structured layout" and skip
 * location tracking for the turn rather than storing garbage.
 */
export function validateLocationLayout(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};

  const areas = [];
  if (Array.isArray(data.areas)) {
    data.areas.slice(0, MAX_AREAS).forEach((area, index) => {
      if (!area || typeof area !== 'object') return;
      const name = cleanText(area.name, 60);
      if (!name) return;
      const clampNum = (value, min, max, fallback) =>
        typeof value === 'number' && !isNaN(value) ? Math.max(min, Math.min(max, Math.round(value))) : fallback;
      areas.push({
        id: cleanText(area.id, 40) || `area-${index + 1}`,
        name,
        x: clampNum(area.x, 0, LOCATION_CANVAS.width - 8, (index * 20) % 80),
        y: clampNum(area.y, 0, LOCATION_CANVAS.height - 8, 10),
        w: clampNum(area.w, 8, LOCATION_CANVAS.width, 20),
        h: clampNum(area.h, 8, LOCATION_CANVAS.height, 15)
      });
    });
  }
  if (areas.length === 0) return null;
  const areaIds = new Set(areas.map(a => a.id));

  const exits = [];
  if (Array.isArray(data.exits)) {
    data.exits.slice(0, MAX_FEATURES).forEach(exit => {
      if (!exit || typeof exit !== 'object') return;
      const from = cleanText(exit.from, 40);
      const to = cleanText(exit.to, 60);
      // Exits connect two areas, or lead out of the location ("out:" targets).
      if (!areaIds.has(from)) return;
      if (!areaIds.has(to) && !to.startsWith('out:')) return;
      exits.push({ from, to, label: cleanText(exit.label, 60) });
    });
  }

  const features = [];
  if (Array.isArray(data.features)) {
    data.features.slice(0, MAX_FEATURES).forEach(feature => {
      if (!feature || typeof feature !== 'object') return;
      const name = cleanText(feature.name, 60);
      if (!name) return;
      features.push({
        area: areaIds.has(cleanText(feature.area, 40)) ? cleanText(feature.area, 40) : areas[0].id,
        name,
        kind: cleanText(feature.kind, 30) || 'feature'
      });
    });
  }

  return {
    name: cleanText(data.name, 120) || 'Unnamed location',
    description: cleanText(data.description, 600),
    areas,
    exits,
    features
  };
}

/**
 * Validates an occupancy list (the mutable layer over a stored layout).
 * Area references are resolved against the layout when provided; unknown
 * areas fall back to the first area so tokens never vanish off-map.
 */
export function validateLocationOccupancy(raw, layout = null) {
  if (!Array.isArray(raw)) return [];
  const areaIds = layout && Array.isArray(layout.areas) ? new Set(layout.areas.map(a => a.id)) : null;
  const fallbackArea = layout && layout.areas?.[0]?.id ? layout.areas[0].id : '';
  const occupants = [];
  raw.slice(0, MAX_OCCUPANTS).forEach(entry => {
    if (!entry || typeof entry !== 'object') return;
    const name = cleanText(entry.name, 80);
    if (!name) return;
    const area = cleanText(entry.area, 40);
    occupants.push({
      name,
      kind: OCCUPANT_KINDS.includes(entry.kind) ? entry.kind : 'object',
      area: areaIds ? (areaIds.has(area) ? area : fallbackArea) : area,
      note: cleanText(entry.note, 200)
    });
  });
  return occupants;
}

/**
 * Validates the engine-stamped location signal on a turn record (emitted by
 * the Referee on committed actions, never on table talk). Returns null when
 * there is no usable location name.
 */
export function validateLocationUpdate(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const name = cleanText(data.name, 120);
  if (!name) return null;
  return {
    name,
    positional: !!data.positional,
    occupancy: validateLocationOccupancy(data.occupancy),
    generated_layout: data.generated_layout ? validateLocationLayout(data.generated_layout) : null
  };
}

/**
 * Table-style dials (Phase D, decision 2026-07-04): two campaign-level
 * settings stored as campaigns.table_style_json and enforced structurally —
 * the helpfulness dial shapes prompts AND caps suggested choices in
 * validation; the pacing dial is a recorded cadence rule, never a mood.
 */
export const TABLE_STYLE_OPTIONS = {
  helpfulness: ['helpful', 'classic', 'hardline'],
  pacing: ['slow_burn', 'standard', 'action_heavy', 'player_driven']
};
export const TABLE_STYLE_DEFAULTS = { helpfulness: 'classic', pacing: 'standard' };

/** GM-initiated encounters: at most ~1 per N world turns (null = never). */
export const PACING_TARGETS = { slow_burn: 8, standard: 5, action_heavy: 3, player_driven: null };

export function validateTableStyle(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  return {
    helpfulness: TABLE_STYLE_OPTIONS.helpfulness.includes(data.helpfulness)
      ? data.helpfulness
      : TABLE_STYLE_DEFAULTS.helpfulness,
    pacing: TABLE_STYLE_OPTIONS.pacing.includes(data.pacing)
      ? data.pacing
      : TABLE_STYLE_DEFAULTS.pacing
  };
}

/**
 * Builds the pacing cadence history from raw turn rows (oldest → newest):
 * WORLD turns only — committed actions that actually RESOLVED. Denied and
 * needs-clarification attempts keep input_kind 'committed_action' but carry
 * action_resolved false and must not widen the cadence window (cr-3: the
 * same resolved-action definition that gates turn-order advancement).
 * Records predating the action_resolved flag count as resolved.
 */
export function buildEncounterHistory(rows, windowSize = 12) {
  if (!Array.isArray(rows)) return [];
  return rows.map(row => {
    try {
      const record = JSON.parse(row.state_changes_json || '{}');
      return record && typeof record === 'object' && !Array.isArray(record)
        ? { kind: record.input_kind, resolved: record.action_resolved, encounter: record.encounter || 'none' }
        : null;
    } catch (e) {
      return null;
    }
  }).filter(entry => entry && entry.kind === 'committed_action' && entry.resolved !== false)
    .map(entry => entry.encounter)
    .slice(-windowSize);
}

/**
 * Turns since the last GM-initiated encounter, from the turn records'
 * engine-stamped encounter field (oldest → newest). null = none recorded in
 * the window (the GM has room to initiate).
 */
export function computeEncounterCadence(encounterHistory) {
  if (!Array.isArray(encounterHistory)) return null;
  for (let i = encounterHistory.length - 1; i >= 0; i--) {
    if (encounterHistory[i] === 'gm_initiated') {
      return encounterHistory.length - 1 - i;
    }
  }
  return null;
}

/**
 * Turn order (Phase 3 M2): round-robin over the party, engine-owned and
 * persisted as campaigns.turn_state_json. Pure helpers over plain objects —
 * DB truth comes in via the party id list. Single-character campaigns are an
 * order of one and behave exactly like before (every action is your turn).
 */
export function validateTurnState(raw, partyIds = []) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const known = new Set(partyIds);
  const seen = new Set();
  const order = [];
  if (Array.isArray(data.order)) {
    for (const id of data.order) {
      if (known.has(id) && !seen.has(id)) {
        seen.add(id);
        order.push(id);
      }
    }
  }
  // Party members missing from the order (fresh state, or joined before the
  // order existed) append in party order.
  for (const id of partyIds) {
    if (!seen.has(id)) {
      seen.add(id);
      order.push(id);
    }
  }
  const rawIndex = typeof data.current_index === 'number' && !isNaN(data.current_index)
    ? Math.floor(data.current_index)
    : 0;
  return {
    order,
    current_index: order.length > 0 ? Math.max(0, Math.min(order.length - 1, rawIndex)) : 0,
    round: typeof data.round === 'number' && data.round >= 1 ? Math.floor(data.round) : 1
  };
}

export function actingCharacterId(turnState) {
  return turnState.order.length > 0 ? turnState.order[turnState.current_index] : null;
}

/**
 * Round-robin advance after a committed action: next member, wrapping into
 * a new round. Table talk never advances (it is stateless — decision
 * 2026-06-05), so rounds count real actions even solo.
 */
export function advanceTurnOrder(turnState) {
  if (turnState.order.length === 0) return turnState;
  const nextIndex = (turnState.current_index + 1) % turnState.order.length;
  return {
    order: [...turnState.order],
    current_index: nextIndex,
    round: nextIndex === 0 ? turnState.round + 1 : turnState.round
  };
}

/**
 * Removes a leaving character, keeping the current turn pointed at the same
 * member when possible (or the next one when the leaver was acting).
 */
export function removeFromTurnOrder(turnState, characterId) {
  const index = turnState.order.indexOf(characterId);
  if (index === -1) return turnState;
  const order = turnState.order.filter(id => id !== characterId);
  let currentIndex = turnState.current_index;
  if (index < currentIndex) currentIndex -= 1;
  if (order.length === 0) currentIndex = 0;
  else currentIndex = currentIndex % order.length;
  return { order, current_index: currentIndex, round: turnState.round };
}

/**
 * Engine-owned current_heroic (Phase V3, owner direction 2026-06-13): the
 * heroic visual persists until the game moves past it. The Referee emits a
 * small focal-subject signal through the gate; the engine holds the pointer
 * and applies stickiness — the model never "remembers" what is displayed.
 */
const FOCAL_KINDS = ['location', 'npc'];

/**
 * Validates the Referee's focal-subject signal. "none"/invalid → null (keep
 * the current visual), which is the expected answer on most turns.
 */
export function validateFocalSubject(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  if (!FOCAL_KINDS.includes(data.kind)) return null;
  const name = cleanText(data.name, 120);
  if (!name) return null;
  return { kind: data.kind, name, reason: cleanText(data.reason, 200) };
}

/**
 * Engine-side stickiness for the heroic pointer. Returns the new subject
 * { kind, key } when the visual should change, or null to keep the current
 * one. Rules (owner direction 2026-06-13): entering a new location always
 * retargets; an NPC taking prominence retargets unless it is already the
 * subject or the last swap was too recent (thrash guard).
 */
export function resolveHeroicSubject({ current, focal, locationChanged, locationKey, turnNumber, minInterval = 2 }) {
  if (locationChanged && locationKey) {
    if (current && current.subject_kind === 'location' && current.subject_key === locationKey) return null;
    return { kind: 'location', key: locationKey };
  }
  if (!focal) return null;
  const key = focal.kind === 'location' ? String(focal.name).trim().toLowerCase() : focal.name;
  // Case-insensitive: the stored pointer carries the NPC's canonical name,
  // but the referee may re-signal the same subject with different casing —
  // that must read as "same subject", not a fresh paid render.
  if (current && current.subject_kind === focal.kind &&
      String(current.subject_key).toLowerCase() === key.toLowerCase()) return null;
  if (current && typeof current.generated_turn === 'number' && turnNumber - current.generated_turn < minInterval) {
    return null;
  }
  return { kind: focal.kind, key };
}

/**
 * Validates a generated campaign ruleset (decision 2026-07-03: ruleset is
 * canon campaign state — Council-consultable, player-viewable, must not
 * drift). Returns null when there is no usable content, which callers treat
 * as "no ruleset" (freeform play).
 */
export function validateRulesetData(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const clean = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';

  const abilities = [];
  if (Array.isArray(data.abilities)) {
    data.abilities.slice(0, 12).forEach(ability => {
      if (!ability || typeof ability !== 'object') return;
      const name = clean(ability.name, 80);
      if (!name) return;
      abilities.push({
        name,
        cost: clean(ability.cost, 120) || 'free',
        effect: clean(ability.effect, 500) || 'Effect to be clarified in play.',
        limits: clean(ability.limits, 300) || 'None stated.'
      });
    });
  }

  const validated = {
    name: clean(data.name, 80) || 'House Rules',
    resolution: clean(data.resolution, 1000),
    abilities,
    notes: clean(data.notes, 1000)
  };

  if (!validated.resolution && abilities.length === 0) return null;
  return validated;
}

/**
 * Resolves a validated voice script against the campaign's NPCs: each line's
 * speaker is matched (case-insensitively) to a stored voice profile
 * (npcs.voice_json). Narrator/unknown speakers get null voice/instructions so
 * the client falls back to the player's narrator settings. Tone directions
 * ride along as instruction suffixes.
 */
export function buildVoiceScript(narrationLines, npcs = []) {
  if (!Array.isArray(narrationLines)) return [];
  return narrationLines.map(line => {
    const npc = npcs.find(n => n.name && line.speaker && n.name.toLowerCase() === line.speaker.toLowerCase());
    return {
      speaker: line.speaker,
      text: line.text,
      tone: line.tone || null,
      ...resolveSpeakerVoice(npc ? npc.voice_json : null, line.tone)
    };
  });
}

/**
 * The single composition point for a spoken line's voice + delivery
 * directive. Used by buildVoiceScript for host payloads and by the narrate
 * route to resolve a seat's speaker server-side (Phase S2): the stored
 * profile's personality-derived instructions never travel in seat payloads,
 * so the seat client sends speaker + tone back and the server recomposes.
 */
export function resolveSpeakerVoice(voiceJson, tone) {
  let profile = null;
  if (voiceJson) {
    try {
      const parsed = JSON.parse(voiceJson);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) profile = parsed;
    } catch (e) {}
  }
  const toneSuffix = tone ? `Tone: ${tone}.` : '';
  return {
    voice: profile?.voice || null,
    instructions: profile
      ? [profile.instructions || '', toneSuffix].filter(Boolean).join(' ')
      : (toneSuffix || null)
  };
}

/**
 * Seat-scoped visibility (Phase S2, decision 2026-07-05 reactivated
 * 2026-07-09): a seat sees its own sheet in full, partymates as
 * silhouettes, and the shared table surfaces — never the GM's private
 * record (outline acts, NPC personalities/relationship notes, memories,
 * the memory-bearing campaign summary) and never the host-only dials.
 * Both scope functions WHITELIST fields rather than deleting known-bad
 * ones, so a field added to the host payload later stays seat-invisible
 * until someone deliberately shares it.
 */
export function silhouetteCharacter(member) {
  if (!member || typeof member !== 'object') return null;
  return {
    id: member.id,
    name: member.name,
    class: member.class,
    level: member.level,
    health: member.health,
    max_health: member.max_health
  };
}

function scopeVoiceLinesForSeat(voiceLines) {
  if (!Array.isArray(voiceLines)) return [];
  // speaker/tone/text only: the client hands speaker + tone back to the
  // narrate route, which recomposes the stored profile server-side.
  return voiceLines.map(line => ({
    speaker: line.speaker ?? null,
    text: line.text,
    tone: line.tone ?? null
  }));
}

export function scopeStateForSeat(state, seatCharacterId) {
  if (!state || typeof state !== 'object') return state;
  const party = Array.isArray(state.party) ? state.party : [];
  const own = party.find(member => member && member.id === seatCharacterId) || null;
  const turn = state.turn && typeof state.turn === 'object' ? state.turn : null;
  return {
    campaignId: state.campaignId,
    title: state.title,
    genre: state.genre,
    themeColors: state.themeColors,
    themeFonts: state.themeFonts,
    rulesMode: state.rulesMode,
    // Ruleset is player-viewable canon (decision 2026-07-03); the dials are not.
    ruleset: state.ruleset,
    seatCharacterId,
    character: own,
    party: party.map(member => (member && member.id === seatCharacterId ? member : silhouetteCharacter(member))),
    turnOrder: state.turnOrder,
    currentQuest: state.currentQuest,
    turn: turn && {
      number: turn.number,
      playerAction: turn.playerAction,
      inputKind: turn.inputKind,
      narrative: turn.narrative,
      sceneGrounding: turn.sceneGrounding,
      svg: turn.svg,
      suggestedChoices: turn.suggestedChoices,
      rollResults: turn.rollResults,
      voiceLines: scopeVoiceLinesForSeat(turn.voiceLines),
      location: turn.location,
      heroic: turn.heroic
    }
  };
}

/**
 * The seat journal shape (Phase S2): turn_number, player_action, narrative
 * only — no state_changes_json (it embeds memories, quest structure, and
 * NPC updates), no memories. The frontend timeline and the poll
 * gap-backfill consume this same shape for seats.
 */
export function scopeJournalForSeat(turns) {
  const list = Array.isArray(turns) ? turns : [];
  return list.map(turn => ({
    turn_number: turn.turn_number,
    player_action: turn.player_action,
    narrative: turn.narrative,
    created_at: turn.created_at
  }));
}

/**
 * Campaign portability (Phase P, decision 2026-07-04): one self-contained
 * versioned JSON bundle. This validator is the forward-importability
 * boundary — every released format_version must keep importing here, with
 * migrations applied in this function as the version grows. Bundles are
 * untrusted DATA, never instructions: everything is re-validated through
 * the same validators live play uses, bounded, and shape-normalized before
 * any caller may write it.
 */
export const CAMPAIGN_BUNDLE_VERSION = 1;

function bundleJsonObject(value, fallback = null) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
    } catch (e) {
      return fallback;
    }
  }
  return fallback;
}

function bundleJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }
  return [];
}

function bundleInt(value, fallback, min, max) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(num)));
}

/** Object-entry array, capped in count and serialized size. */
function bundleObjectList(value, maxEntries, maxBytes) {
  const list = bundleJsonArray(value)
    .filter(entry => entry && typeof entry === 'object' && !Array.isArray(entry))
    .slice(0, maxEntries);
  return JSON.stringify(list).length <= maxBytes ? list : [];
}

/** Plain object with size cap; anything oversized falls to the fallback. */
function bundleBoundedObject(value, maxBytes, fallback = {}) {
  const obj = bundleJsonObject(value, fallback);
  return obj && JSON.stringify(obj).length <= maxBytes ? obj : fallback;
}

/** Voice profile shape: bounded strings only (mirrors validateVoiceProfile). */
function bundleVoice(value) {
  const raw = bundleJsonObject(value);
  if (!raw) return null;
  return {
    provider: cleanText(raw.provider, 40) || 'openai',
    voice: cleanText(raw.voice, 40),
    instructions: cleanText(raw.instructions, 600)
  };
}

/** Identity anchor shape: descriptor + seed (mirrors validateIdentityAnchor). */
function bundleAnchor(value) {
  const raw = bundleJsonObject(value);
  if (!raw) return null;
  const seed = Number(raw.seed);
  return {
    descriptor: cleanText(raw.descriptor, 800),
    seed: Number.isFinite(seed) && seed >= 0 ? Math.floor(seed) : null
  };
}

export function validateCampaignBundle(raw) {
  const bundle = raw && typeof raw === 'object' ? raw : {};
  if (bundle.kind !== 'aetheria-campaign') {
    throw new Error('Not an Aetheria campaign bundle (kind mismatch).');
  }
  if (!Number.isInteger(bundle.format_version) || bundle.format_version < 1) {
    throw new Error('Bundle format_version is missing or invalid.');
  }
  if (bundle.format_version > CAMPAIGN_BUNDLE_VERSION) {
    throw new Error(`Bundle format_version ${bundle.format_version} is newer than this engine supports (${CAMPAIGN_BUNDLE_VERSION}).`);
  }
  // Older versions migrate here as the format grows. v1 is current.

  const rawCampaign = bundle.campaign && typeof bundle.campaign === 'object' ? bundle.campaign : {};
  const campaign = {
    title: cleanText(rawCampaign.title, 200) || 'Imported Campaign',
    genre: cleanText(rawCampaign.genre, 200) || 'Unknown genre',
    summary: cleanText(rawCampaign.summary, 2000),
    current_act: bundleInt(rawCampaign.current_act, 1, 1, 3),
    rules_mode: rawCampaign.rules_mode ? 1 : 0,
    last_positional: rawCampaign.last_positional ? 1 : 0,
    narrator_voice: bundleVoice(rawCampaign.narrator_voice_json ?? rawCampaign.narrator_voice)
  };

  const outline = validateOutlineData(bundleJsonObject(bundle.outline ?? bundle.outline_json, {}));
  const ruleset = validateRulesetData(bundleJsonObject(rawCampaign.ruleset_json ?? bundle.ruleset));
  const tableStyle = validateTableStyle(bundleJsonObject(rawCampaign.table_style_json ?? bundle.table_style));

  const characters = bundleJsonArray(bundle.characters).map(row => {
    if (!row || typeof row !== 'object') return null;
    const name = cleanText(row.name, 80);
    if (!name) return null;
    return {
      source_id: Number.isInteger(row.source_id) ? row.source_id : null,
      name,
      class: cleanText(row.class, 120) || 'Unformed protagonist',
      health: bundleInt(row.health, 100, 0, 100000),
      max_health: bundleInt(row.max_health, 100, 1, 100000),
      mana: bundleInt(row.mana, 50, 0, 100000),
      max_mana: bundleInt(row.max_mana, 50, 0, 100000),
      xp: bundleInt(row.xp, 0, 0, 10000000),
      level: bundleInt(row.level, 1, 1, 1000),
      inventory: bundleObjectList(row.inventory ?? row.inventory_json, 200, 200000),
      attributes: bundleBoundedObject(row.attributes ?? row.attributes_json, 5000),
      abilities: bundleObjectList(row.abilities ?? row.abilities_json, 100, 200000),
      progression_notes: cleanText(row.progression_notes, 10000),
      status: row.status === 'released' ? 'released' : 'active'
    };
  }).filter(Boolean);
  if (!characters.some(c => c.status === 'active')) {
    throw new Error('Bundle contains no active characters.');
  }

  const npcs = bundleJsonArray(bundle.npcs).map(row => {
    if (!row || typeof row !== 'object') return null;
    const name = cleanText(row.name, 120);
    if (!name) return null;
    return {
      name,
      role: cleanText(row.role, 200),
      personality: cleanText(row.personality, 2000),
      quirks: cleanText(row.quirks, 2000),
      relationship_value: bundleInt(row.relationship_value, 0, -100, 100),
      notes: cleanText(row.notes, 20000),
      status: ['alive', 'dead', 'missing'].includes(row.status) ? row.status : 'alive',
      voice: bundleVoice(row.voice ?? row.voice_json),
      anchor: bundleAnchor(row.anchor ?? row.anchor_json)
    };
  }).filter(Boolean);

  const seenLocationKeys = new Set();
  const locations = bundleJsonArray(bundle.locations).map(row => {
    if (!row || typeof row !== 'object') return null;
    const layout = validateLocationLayout(bundleJsonObject(row.layout ?? row.layout_json));
    const name = cleanText(row.name, 120);
    if (!layout || !name) return null;
    // Keys are unique per campaign (DB index); lowercasing can collide, so
    // dedupe here instead of blowing up mid-import.
    const key = cleanText(row.key, 120).toLowerCase() || name.toLowerCase();
    if (seenLocationKeys.has(key)) return null;
    seenLocationKeys.add(key);
    return {
      name,
      key,
      description: cleanText(row.description, 600),
      layout,
      occupancy: validateLocationOccupancy(bundleJsonArray(row.occupancy ?? row.occupancy_json), layout),
      anchor: bundleAnchor(row.anchor ?? row.anchor_json),
      first_seen_turn: bundleInt(row.first_seen_turn, 1, 1, 1000000),
      last_seen_turn: bundleInt(row.last_seen_turn, 1, 1, 1000000)
    };
  }).filter(Boolean);

  const memories = bundleJsonArray(bundle.memories).map(row => {
    if (!row || typeof row !== 'object') return null;
    const summary = cleanText(row.summary, 2000);
    if (!summary) return null;
    return {
      turn_number: Number.isInteger(row.turn_number) ? row.turn_number : null,
      importance: bundleInt(row.importance, 3, 1, 5),
      summary,
      keywords: cleanText(row.keywords, 500),
      created_at: cleanText(row.created_at, 40) || null
    };
  }).filter(Boolean);

  const seenTurnNumbers = new Set();
  const turns = bundleJsonArray(bundle.turns).map(row => {
    if (!row || typeof row !== 'object') return null;
    const turnNumber = bundleInt(row.turn_number, 0, 1, 1000000);
    if (!turnNumber || seenTurnNumbers.has(turnNumber)) return null;
    seenTurnNumbers.add(turnNumber);
    const narrative = cleanText(row.narrative, 60000) || 'The scene continues...';
    // Downstream consumers (fork replay, quest extraction, cadence) assume a
    // plain object; "null", scalars, and arrays parse as JSON but crash or
    // corrupt them — only object records survive. Presentation fields INSIDE
    // the record are consumed with assumed shapes too (cr-4:
    // suggested_choices reaches choices.forEach in the browser), so hostile
    // shapes are stripped at this trust boundary while every other field —
    // including legacy ones like roll_result — passes through untouched.
    let stateChanges = '{}';
    let parsedRecord = null;
    if (typeof row.state_changes_json === 'string' && row.state_changes_json.length <= 500000) {
      try {
        const parsed = JSON.parse(row.state_changes_json);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) parsedRecord = parsed;
      } catch (e) { /* keep '{}' */ }
    } else if (row.state_changes && typeof row.state_changes === 'object' && !Array.isArray(row.state_changes)) {
      parsedRecord = row.state_changes;
    }
    if (parsedRecord) {
      if ('suggested_choices' in parsedRecord &&
          !(Array.isArray(parsedRecord.suggested_choices) && parsedRecord.suggested_choices.every(c => typeof c === 'string'))) {
        delete parsedRecord.suggested_choices;
      }
      // Roll records reach the roll bubble's dereferences (cr-4 reopen):
      // coerce dice_rolls through live play's sanitizer, and legacy
      // roll_result through the same single-record rules.
      if ('dice_rolls' in parsedRecord) {
        parsedRecord.dice_rolls = sanitizeDiceRollRecords(parsedRecord.dice_rolls);
      }
      if ('roll_result' in parsedRecord) {
        const legacyRoll = sanitizeDiceRollRecords([parsedRecord.roll_result]);
        if (legacyRoll.length === 1) parsedRecord.roll_result = legacyRoll[0];
        else delete parsedRecord.roll_result;
      }
      stateChanges = JSON.stringify(parsedRecord);
    }
    const svg = typeof row.svg_illustration === 'string' && row.svg_illustration.includes('<svg') && row.svg_illustration.length <= 500000
      ? row.svg_illustration
      : null;
    return {
      turn_number: turnNumber,
      source_character_id: Number.isInteger(row.source_character_id) ? row.source_character_id : null,
      player_action: cleanText(row.player_action, 5000) || null,
      narrative,
      state_changes_json: stateChanges,
      svg_illustration: svg,
      created_at: cleanText(row.created_at, 40) || null
    };
  }).filter(Boolean).sort((a, b) => a.turn_number - b.turn_number);
  if (turns.length === 0) {
    throw new Error('Bundle contains no turns.');
  }

  const rawPointers = bundle.pointers && typeof bundle.pointers === 'object' ? bundle.pointers : {};
  const locationKeys = new Set(locations.map(l => l.key));
  const activeSourceIds = new Set(characters.filter(c => c.status === 'active' && c.source_id !== null).map(c => c.source_id));
  const rawOrder = bundleJsonArray(rawPointers.turn_order?.order).filter(id => activeSourceIds.has(id));
  const pointers = {
    current_location_key: locationKeys.has(cleanText(rawPointers.current_location_key, 120).toLowerCase())
      ? cleanText(rawPointers.current_location_key, 120).toLowerCase()
      : null,
    turn_order: {
      order: rawOrder,
      current_index: bundleInt(rawPointers.turn_order?.current_index, 0, 0, Math.max(0, rawOrder.length - 1)),
      round: bundleInt(rawPointers.turn_order?.round, 1, 1, 1000000)
    }
  };

  return { format_version: bundle.format_version, campaign, outline, ruleset, tableStyle, characters, npcs, locations, memories, turns, pointers };
}

/**
 * Applies a validated character_update to a character in place: health/mana
 * clamped to their maxima, XP with level-up mechanics (level = floor(xp/100)+1;
 * each level grants +15 max HP / +10 max mana and a full refill), and inventory
 * add/stack/use/remove. Shared by campaign creation, turns, and fork replay.
 * Returns { leveledUp, levelsGained } so callers can narrate.
 */
export function applyCharacterUpdate(character, updates = {}) {
  if (typeof updates.health_change === 'number') {
    character.health = Math.max(0, Math.min(character.max_health, character.health + updates.health_change));
  }
  if (typeof updates.mana_change === 'number') {
    character.mana = Math.max(0, Math.min(character.max_mana, character.mana + updates.mana_change));
  }

  let levelsGained = 0;
  if (typeof updates.xp_gain === 'number') {
    const oldLevel = character.level;
    character.xp += updates.xp_gain;
    const computedLevel = Math.floor(character.xp / 100) + 1;
    if (computedLevel > oldLevel) {
      levelsGained = computedLevel - oldLevel;
      character.level = computedLevel;
      character.max_health += levelsGained * 15;
      character.health = character.max_health;
      character.max_mana += levelsGained * 10;
      character.mana = character.max_mana;
    }
  }

  if (Array.isArray(updates.inventory_changes)) {
    updates.inventory_changes.forEach(change => {
      const item = change.item;
      if (!item || !item.name) return;
      if (change.action === 'add') {
        const existing = character.inventory.find(i => i.name === item.name);
        if (existing) {
          existing.quantity = (existing.quantity || 1) + (item.quantity || 1);
        } else {
          character.inventory.push({ ...item, quantity: item.quantity || 1 });
        }
      } else if (change.action === 'remove' || change.action === 'use') {
        const idx = character.inventory.findIndex(i => i.name === item.name);
        if (idx !== -1) {
          if (character.inventory[idx].quantity > 1) {
            character.inventory[idx].quantity--;
          } else {
            character.inventory.splice(idx, 1);
          }
        }
      }
    });
  }

  return { leveledUp: levelsGained > 0, levelsGained };
}

/**
 * Applies the engine-adjudicated failure consequences carried on dice roll
 * records (dice-before-narration). Successful checks apply nothing. Shared by
 * live turns and fork replay.
 */
export function applyDiceConsequences(character, diceRolls) {
  if (!Array.isArray(diceRolls)) return;
  for (const record of diceRolls) {
    if (!record || record.success) continue;
    if (typeof record.applied_health_change === 'number' && record.applied_health_change < 0) {
      character.health = Math.max(0, character.health + record.applied_health_change);
    }
    if (typeof record.applied_mana_change === 'number' && record.applied_mana_change < 0) {
      character.mana = Math.max(0, character.mana + record.applied_mana_change);
    }
  }
}

/**
 * Dice-before-narration (approved Council refactor, plan.md): the Referee decides
 * which checks a committed action requires; the engine rolls; the narrator writes
 * prose from the resolved results. These helpers own the engine side.
 */
const CHECK_ATTRIBUTES = ['strength', 'agility', 'intellect', 'willpower'];
const MAX_CHECKS_PER_TURN = 3;

/**
 * Sanitizes the Referee's required_checks output. Drops malformed entries,
 * clamps DCs and failure consequences, caps the number of checks per turn.
 */
export function validateRequiredChecks(raw) {
  if (!Array.isArray(raw)) return [];
  const checks = [];
  for (const entry of raw) {
    if (checks.length >= MAX_CHECKS_PER_TURN) break;
    if (!entry || typeof entry !== 'object') continue;
    if (!CHECK_ATTRIBUTES.includes(entry.attribute)) continue;

    const consequence = entry.failure_consequence && typeof entry.failure_consequence === 'object'
      ? entry.failure_consequence
      : {};

    checks.push({
      attribute: entry.attribute,
      dc: typeof entry.dc === 'number' && !isNaN(entry.dc)
        ? Math.max(5, Math.min(25, Math.floor(entry.dc)))
        : 12,
      reason: typeof entry.reason === 'string' ? entry.reason.trim() : '',
      failure_consequence: {
        description: typeof consequence.description === 'string' ? consequence.description.trim() : '',
        health_change: typeof consequence.health_change === 'number' && !isNaN(consequence.health_change)
          ? Math.max(-50, Math.min(0, Math.floor(consequence.health_change)))
          : 0,
        mana_change: typeof consequence.mana_change === 'number' && !isNaN(consequence.mana_change)
          ? Math.max(-30, Math.min(0, Math.floor(consequence.mana_change)))
          : 0
      }
    });
  }
  return checks;
}

/**
 * Rolls one referee-defined check: d20 + D&D-style attribute modifier vs DC.
 * The returned record is the canonical roll record for the turn state: on
 * failure it carries the referee-adjudicated consequence as applied_* values.
 */
export function rollCheck(character, check) {
  const attrValue = character.attributes?.[check.attribute] ?? 10;
  const modifier = Math.floor((attrValue - 10) / 2);
  const roll = Math.floor(Math.random() * 20) + 1;
  const total = roll + modifier;
  const success = total >= check.dc;

  return {
    attribute: check.attribute,
    roll,
    modifier,
    total,
    dc: check.dc,
    success,
    reason: check.reason || '',
    consequence: check.failure_consequence?.description || '',
    applied_health_change: success ? 0 : (check.failure_consequence?.health_change || 0),
    applied_mana_change: success ? 0 : (check.failure_consequence?.mana_change || 0)
  };
}

/**
 * Bundled-safe font pools for agent-generated theming (Phase T1, decision
 * 2026-07-03: theming is generated at campaign setup, not curated). Every
 * family here is loaded by public/index.html; the validator rejects anything
 * outside the pool, and the body slot is a high-readability subset.
 */
export const THEME_FONT_OPTIONS = {
  title: ['Outfit', 'Cinzel', 'Orbitron', 'Special Elite', 'Playfair Display', 'Cormorant Garamond', 'Rajdhani'],
  body: ['Inter', 'Lora', 'Rajdhani'],
  dialogue: ['Playfair Display', 'Cormorant Garamond', 'Lora', 'Special Elite', 'Inter']
};
const THEME_FONT_DEFAULTS = { title: 'Outfit', body: 'Inter', dialogue: 'Playfair Display' };

function clampHslLightness(triple, minL, maxL) {
  const match = triple.match(/^(\d{1,3}), (\d{1,3})%, (\d{1,3})%$/);
  if (!match) return triple;
  const l = Math.max(minL, Math.min(maxL, Number(match[3])));
  return `${match[1]}, ${match[2]}%, ${l}%`;
}

/**
 * Validates and sanitizes campaign outlines generated by the LLM.
 */
export function validateOutlineData(raw) {
  const data = raw || {};
  const validated = {};

  validated.title = typeof data.title === 'string' && data.title.trim() !== ''
    ? data.title.trim()
    : 'Aetheria Campaign';

  validated.setting = typeof data.setting === 'string' && data.setting.trim() !== ''
    ? data.setting.trim()
    : 'A mysterious land.';

  // Theme colors (Phase T1): normalized to bare HSL triples so the CSS
  // hsl(var())/rgba(var()) composition never breaks; the background is
  // clamped dark (the whole design system assumes it) and the generated
  // text slots — present only when the Setup agent produced them, so
  // pre-theming outlines keep their exact legacy shape — clamp readable.
  const colors = data.theme_colors || {};
  validated.theme_colors = {
    primary: normalizeHslColor(colors.primary, '210, 100%, 50%'),
    secondary: normalizeHslColor(colors.secondary, '330, 100%, 50%'),
    background: clampHslLightness(normalizeHslColor(colors.background, '220, 30%, 8%'), 0, 30)
  };
  if (colors.text !== undefined || colors.text_dim !== undefined) {
    validated.theme_colors.text = clampHslLightness(normalizeHslColor(colors.text, '210, 20%, 95%'), 60, 100);
    validated.theme_colors.text_dim = clampHslLightness(normalizeHslColor(colors.text_dim, '210, 10%, 65%'), 40, 80);
  }

  // Font pairing (Phase T1): validated against the bundled pool per slot,
  // defaulting to the app's base pairing so older campaigns render unchanged.
  const fonts = data.theme_fonts && typeof data.theme_fonts === 'object' ? data.theme_fonts : {};
  validated.theme_fonts = Object.fromEntries(
    Object.entries(THEME_FONT_OPTIONS).map(([slot, pool]) => {
      const requested = typeof fonts[slot] === 'string' ? fonts[slot].trim().toLowerCase() : '';
      const match = pool.find(family => family.toLowerCase() === requested);
      return [slot, match || THEME_FONT_DEFAULTS[slot]];
    })
  );

  // Acts
  validated.acts = [];
  if (Array.isArray(data.acts)) {
    data.acts.forEach(act => {
      if (!act || typeof act !== 'object') return;
      validated.acts.push({
        act: typeof act.act === 'number' ? act.act : (validated.acts.length + 1),
        title: typeof act.title === 'string' ? act.title.trim() : 'Act Title',
        objective: typeof act.objective === 'string' ? act.objective.trim() : 'Core objective',
        key_events: Array.isArray(act.key_events) ? act.key_events.filter(e => typeof e === 'string').map(e => e.trim()) : []
      });
    });
  }
  if (validated.acts.length === 0) {
    validated.acts = [
      { act: 1, title: 'Act I', objective: 'Explore the vicinity', key_events: ['Investigate starting area'] },
      { act: 2, title: 'Act II', objective: 'Unravel the mystery', key_events: ['Find clues'] },
      { act: 3, title: 'Act III', objective: 'Resolve the climax', key_events: ['Defeat boss'] }
    ];
  }
  
  // Major locations
  validated.major_locations = [];
  if (Array.isArray(data.major_locations)) {
    data.major_locations.forEach(loc => {
      if (!loc || typeof loc !== 'object' || !loc.name) return;
      validated.major_locations.push({
        name: String(loc.name).trim(),
        description: typeof loc.description === 'string' ? loc.description.trim() : 'A notable location.'
      });
    });
  }
  if (validated.major_locations.length === 0) {
    validated.major_locations = [{ name: 'Starting Area', description: 'Where the journey begins.' }];
  }
  
  // Key NPCs
  validated.key_npcs = [];
  if (Array.isArray(data.key_npcs)) {
    data.key_npcs.forEach(npc => {
      if (!npc || typeof npc !== 'object' || !npc.name) return;
      validated.key_npcs.push({
        name: String(npc.name).trim(),
        role: typeof npc.role === 'string' ? npc.role.trim() : 'Supporting character',
        personality: typeof npc.personality === 'string' ? npc.personality.trim() : 'Mysterious and quiet.',
        quirks: typeof npc.quirks === 'string' ? npc.quirks.trim() : 'None visible.'
      });
    });
  }
  if (validated.key_npcs.length === 0) {
    validated.key_npcs = [{ name: 'Mysterious Stranger', role: 'Guide', personality: 'Shy but helpful', quirks: 'Stutters occasionally' }];
  }
  
  // Starting quest
  const sq = data.starting_quest || {};
  validated.starting_quest = {
    title: typeof sq.title === 'string' && sq.title.trim() !== '' ? sq.title.trim() : 'First Steps',
    description: typeof sq.description === 'string' ? sq.description.trim() : 'Begin your journey.'
  };
  
  return validated;
}
