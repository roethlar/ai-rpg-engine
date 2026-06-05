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

  return validated;
}

/**
 * Performs a d20 roll check against one of the player's core attributes.
 */
export function performDiceCheck(character, actionText) {
  const actionLower = actionText.toLowerCase();
  
  // Decide the attribute based on keywords
  let attribute = 'strength'; // fallback default
  
  const strKeywords = ['strength', 'force', 'break', 'shatter', 'lift', 'pull', 'push', 'strike', 'hit', 'smash', 'climb', 'jump', 'swim', 'kick', 'bash'];
  const agiKeywords = ['agility', 'dodge', 'sneak', 'steal', 'pick', 'lock', 'hide', 'slip', 'tumble', 'reflex', 'throw', 'shoot', 'arrow', 'run', 'escape', 'leap'];
  const intKeywords = ['intellect', 'spell', 'cast', 'magic', 'read', 'decipher', 'lore', 'study', 'remember', 'analyze', 'examine', 'investigate', 'understand', 'identify'];
  const wilKeywords = ['willpower', 'resist', 'endure', 'persuade', 'diplomacy', 'intimidate', 'charm', 'bluff', 'pray', 'heal', 'meditate', 'convince', 'calm'];

  if (agiKeywords.some(kw => actionLower.includes(kw))) {
    attribute = 'agility';
  } else if (intKeywords.some(kw => actionLower.includes(kw))) {
    attribute = 'intellect';
  } else if (wilKeywords.some(kw => actionLower.includes(kw))) {
    attribute = 'willpower';
  } else if (strKeywords.some(kw => actionLower.includes(kw))) {
    attribute = 'strength';
  } else {
    // If no keyword matches, use the highest character attribute to reward character specialization
    const attrs = character.attributes || {};
    let highestVal = -1;
    for (const [key, val] of Object.entries(attrs)) {
      if (val > highestVal) {
        highestVal = val;
        attribute = key;
      }
    }
  }

  const attrValue = character.attributes?.[attribute] || 10;
  
  // D&D modifier calculation formula: floor((val - 10) / 2)
  const modifier = Math.floor((attrValue - 10) / 2);
  
  // Roll a d20
  const roll = Math.floor(Math.random() * 20) + 1;
  const total = roll + modifier;

  // Determine difficulty class (DC) randomly
  // 10: Easy (35%), 13: Medium-Easy (20%), 15: Medium (30%), 18: Hard (15%)
  const dcs = [10, 10, 10, 13, 13, 15, 15, 15, 18, 18];
  const dcIndex = Math.floor(Math.random() * dcs.length);
  const dc = dcs[dcIndex];
  
  const success = total >= dc;

  return {
    attribute,
    roll,
    modifier,
    total,
    dc,
    success
  };
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
     
  // Theme colors
  const colors = data.theme_colors || {};
  validated.theme_colors = {
    primary: typeof colors.primary === 'string' && colors.primary.trim() !== ''
      ? colors.primary.trim()
      : '210, 100%, 50%',
    secondary: typeof colors.secondary === 'string' && colors.secondary.trim() !== ''
      ? colors.secondary.trim()
      : '330, 100%, 50%',
    background: typeof colors.background === 'string' && colors.background.trim() !== ''
      ? colors.background.trim()
      : '220, 30%, 8%'
  };
  
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
