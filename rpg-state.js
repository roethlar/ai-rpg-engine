/**
 * RPG State Management Submodule
 */

/**
 * Utility to clean markdown formatting from LLM JSON responses.
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
        throw new Error(`JSON parsing failed: ${error.message}. Raw text was: ${text}`);
      }
    }
    throw error;
  }
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
 * Validates and sanitizes LLM JSON output to prevent malformed values from corrupting the DB/UI.
 */
export function validateTurnData(raw, currentAct = 1) {
  const data = raw || {};
  const validated = {};

  const inputKinds = ['clarification', 'dialogue', 'committed_action'];
  validated.input_kind = inputKinds.includes(data.input_kind)
    ? data.input_kind
    : 'committed_action';

  // 1. Narrative Log
  validated.narrative = typeof data.narrative === 'string' && data.narrative.trim() !== ''
    ? data.narrative.trim()
    : 'The scene continues...';

  // 2. Suggested choices
  validated.suggested_choices = [];
  if (Array.isArray(data.suggested_choices)) {
    validated.suggested_choices = data.suggested_choices
      .filter(item => typeof item === 'string' && item.trim() !== '')
      .map(item => item.trim());
  }
  if (validated.suggested_choices.length === 0) {
    validated.suggested_choices = ['Continue exploring', 'Look around carefully', 'Prepare yourself'];
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
  validated.dice_rolls = [];
  if (Array.isArray(data.dice_rolls)) {
    data.dice_rolls.slice(0, 3).forEach(roll => {
      if (!roll || typeof roll !== 'object') return;
      if (typeof roll.total !== 'number' || isNaN(roll.total)) return;
      if (typeof roll.dc !== 'number' || isNaN(roll.dc)) return;
      validated.dice_rolls.push({
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

  // 5e. Location signal (Phase V2): engine-stamped from the Referee's
  // location block on committed actions; sanitized here so the durable turn
  // record — which forks and later turns replay — stays well-formed.
  validated.location_update = data.location_update ? validateLocationUpdate(data.location_update) : null;

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
    // Location state never mutates on table talk (the display path is
    // separate: the engine still returns the current stored location).
    validated.location_update = null;
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
    let profile = null;
    if (npc && npc.voice_json) {
      try {
        profile = JSON.parse(npc.voice_json);
      } catch (e) {}
    }
    const toneSuffix = line.tone ? `Tone: ${line.tone}.` : '';
    return {
      speaker: line.speaker,
      text: line.text,
      voice: profile?.voice || null,
      instructions: profile
        ? [profile.instructions || '', toneSuffix].filter(Boolean).join(' ')
        : (toneSuffix || null)
    };
  });
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
