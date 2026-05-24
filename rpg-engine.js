import * as db from './db.js';
import { AIClient } from './api-client.js';

/**
 * Utility to clean markdown formatting from LLM JSON responses.
 */
function parseJsonSafe(text) {
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
    console.error('Failed to parse JSON directly. Attempting extraction...', error);
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
function createFallbackSvg(title, primaryColor = '200, 70%, 50%', secondaryColor = '300, 70%, 50%') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" class="w-full h-full rounded-lg shadow-2xl">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:hsl(${primaryColor.replace(/%/g, '')});stop-opacity:0.15" />
        <stop offset="100%" style="stop-color:hsl(${secondaryColor.replace(/%/g, '')});stop-opacity:0.05" />
      </linearGradient>
      <linearGradient id="gridGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style="stop-color:hsl(${primaryColor.replace(/%/g, '')});stop-opacity:0.2" />
        <stop offset="100%" style="stop-color:transparent;stop-opacity:0" />
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="#0a0a0c" />
    <rect width="100%" height="100%" fill="url(#bgGrad)" />
    <path d="M 0,200 L 800,200 M 400,0 L 400,400" stroke="url(#gridGrad)" stroke-width="1" />
    <circle cx="400" cy="200" r="100" fill="none" stroke="hsl(${primaryColor})" stroke-width="2" stroke-dasharray="5,5" opacity="0.3" />
    <g transform="translate(400, 200)">
      <polygon points="0,-60 52,30 -52,30" fill="none" stroke="hsl(${secondaryColor})" stroke-width="2" opacity="0.6">
        <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="20s" repeatCount="indefinite" />
      </polygon>
    </g>
    <text x="400" y="210" font-family="'Outfit', 'Inter', sans-serif" font-size="24" fill="#ffffff" text-anchor="middle" font-weight="bold" letter-spacing="4" opacity="0.9">${title.toUpperCase()}</text>
    <text x="400" y="240" font-family="'Inter', sans-serif" font-size="14" fill="#a0a0b0" text-anchor="middle" opacity="0.6">AETHERIA RPG ENGINE</text>
  </svg>`;
}

/**
 * Core game engine functions linking DB and AI clients.
 */

export async function createCampaign({ genre, characterName, characterClass, apiConfig }) {
  const client = new AIClient(apiConfig);

  const outlineSystem = `You are a legendary RPG game designer and Dungeon Master.
Your job is to draft a coherent, epic 2-4 hour single-player campaign outline for the genre: "${genre}".
You MUST return a JSON object ONLY matching this schema, with no additional text:
{
  "title": "Campaign Title",
  "setting": "Detailed description of the setting and its atmosphere",
  "theme_colors": {
     "primary": "HSL color (e.g. '210, 100%, 50%')",
     "secondary": "HSL color (e.g. '330, 100%, 50%')",
     "background": "HSL color for deep dark backgrounds (e.g. '220, 30%, 8%')"
  },
  "acts": [
    { "act": 1, "title": "Act I Name", "objective": "Act I core objective", "key_events": ["event 1", "event 2"] },
    { "act": 2, "title": "Act II Name", "objective": "Act II core objective", "key_events": ["event 1", "event 2", "event 3"] },
    { "act": 3, "title": "Act III Name", "objective": "Act III core objective (Climax and Resolution)", "key_events": ["event 1", "event 2"] }
  ],
  "major_locations": [
    { "name": "Location Name", "description": "Atmospheric details" }
  ],
  "key_npcs": [
    { 
      "name": "NPC Name", 
      "role": "Their role in the plot (e.g., local blacksmith, rebel spy)", 
      "personality": "Fleshed-out persistent personality traits, values, and flaws", 
      "quirks": "Speech patterns, dialogue habits, physical ticks, or obsessions" 
    }
  ],
  "starting_quest": {
    "title": "Starting Quest Name",
    "description": "Initial task for the player"
  }
}`;

  const outlinePrompt = `Draft an epic, highly coherent RPG campaign structure for the genre: "${genre}". Provide 3 to 5 key NPCs with highly distinct, fleshed-out personalities and memorable quirks. Specify rich HSL theme colors appropriate for the genre. Ensure the outline maps out a complete 2-4 hour questline.`;

  console.log(`Generating campaign outline for genre: ${genre}...`);
  const outlineResponse = await client.sendPrompt({
    systemInstruction: outlineSystem,
    prompt: outlinePrompt,
    jsonMode: true
  });

  const outline = parseJsonSafe(outlineResponse);
  
  // Choose base attributes based on class
  const classAttributes = {
    Warrior: { strength: 14, agility: 10, intellect: 8, willpower: 12 },
    Mage: { strength: 8, agility: 10, intellect: 15, willpower: 11 },
    Rogue: { strength: 10, agility: 15, intellect: 11, willpower: 8 },
    Cleric: { strength: 11, agility: 8, intellect: 12, willpower: 13 },
    Custom: { strength: 10, agility: 10, intellect: 10, willpower: 10 }
  };
  const attributes = classAttributes[characterClass] || classAttributes.Custom;

  // Starting inventory
  const inventory = [
    { name: "Starter Kit", type: "key", description: "Essential survival gear and tokens.", quantity: 1 },
    { name: "Healing Salve", type: "consumable", description: "Restores 20 Health Points.", quantity: 2, effect: "heal_20" }
  ];
  
  if (characterClass === 'Warrior') inventory.push({ name: "Iron Sword", type: "weapon", description: "A simple blade.", stats: "+4 Physical Power", equipped: true });
  else if (characterClass === 'Mage') inventory.push({ name: "Apprentice Staff", type: "weapon", description: "Channels magic.", stats: "+4 Magical Power", equipped: true });
  else if (characterClass === 'Rogue') inventory.push({ name: "Steel Daggers", type: "weapon", description: "Dual stealth blades.", stats: "+4 Agility Power", equipped: true });
  else if (characterClass === 'Cleric') inventory.push({ name: "Wooden Mace", type: "weapon", description: "Blunt force focus.", stats: "+3 Divine Power", equipped: true });

  // DB Transaction for creation
  await db.run('BEGIN IMMEDIATE;');
  let campaignId;
  try {
    // 2. Insert campaign into DB
    const campaignResult = await db.run(
      `INSERT INTO campaigns (title, genre, summary, current_act) VALUES (?, ?, ?, 1)`,
      [outline.title, genre, outline.setting]
    );
    campaignId = campaignResult.id;

    // Insert outline
    await db.run(
      `INSERT INTO campaign_outlines (campaign_id, outline_json) VALUES (?, ?)`,
      [campaignId, JSON.stringify(outline)]
    );

    // Insert character
    await db.run(
      `INSERT INTO characters (campaign_id, name, class, health, max_health, mana, max_mana, xp, level, inventory_json, attributes_json)
       VALUES (?, ?, ?, 100, 100, 50, 50, 0, 1, ?, ?)`,
      [campaignId, characterName, characterClass, JSON.stringify(inventory), JSON.stringify(attributes)]
    );

    // Insert NPCs
    if (outline.key_npcs && Array.isArray(outline.key_npcs)) {
      for (const npc of outline.key_npcs) {
        await db.run(
          `INSERT INTO npcs (campaign_id, name, role, personality, quirks, relationship_value, notes, status)
           VALUES (?, ?, ?, ?, ?, 0, ?, 'alive')`,
          [campaignId, npc.name, npc.role, npc.personality, npc.quirks, `Created at campaign start. Role: ${npc.role}.`]
        );
      }
    }
    await db.run('COMMIT;');
  } catch (err) {
    await db.run('ROLLBACK;');
    throw err;
  }

  // Refetch initial NPCs
  const npcList = await db.all(`SELECT * FROM npcs WHERE campaign_id = ?`, [campaignId]);

  // 3. Generate Turn 1 (Opening Narrative and Scene SVG)
  const dmSystem = getDMSystemInstruction(outline, {
    name: characterName,
    class: characterClass,
    health: 100,
    max_health: 100,
    mana: 50,
    max_mana: 50,
    xp: 0,
    level: 1,
    inventory,
    attributes
  }, npcList, 1);

  const turn1Prompt = `Set the scene and begin the campaign.
Start the story at the beginning of Act I. Introduce the starting quest: "${outline.starting_quest.title}".
Describe the starting location, atmosphere, and initial encounter. If you introduce any of the NPCs now, write them fully in character with their described personality and quirks. Output the JSON object containing the opening narrative, suggested choices, state updates, and an SVG illustration of the scene.`;

  console.log(`Generating opening turn for campaign ${campaignId}...`);
  const turn1Response = await client.sendPrompt({
    systemInstruction: dmSystem,
    prompt: turn1Prompt,
    jsonMode: true
  });

  const turnData = parseJsonSafe(turn1Response);

  const svg = turnData.svg_illustration && turnData.svg_illustration.includes('<svg') 
    ? turnData.svg_illustration 
    : createFallbackSvg(outline.title, outline.theme_colors?.primary, outline.theme_colors?.secondary);

  // Save Turn 1 in a transaction
  await db.run('BEGIN IMMEDIATE;');
  try {
    await db.run(
      `INSERT INTO turns (campaign_id, turn_number, player_action, narrative, state_changes_json, svg_illustration)
       VALUES (?, 1, NULL, ?, ?, ?)`,
      [campaignId, turnData.narrative, JSON.stringify(turnData.character_update || {}), svg]
    );

    if (turnData.memory_summary) {
      await db.run(
        `INSERT INTO memories (campaign_id, importance, summary, keywords) VALUES (?, ?, ?, ?)`,
        [campaignId, turnData.memory_importance || 3, turnData.memory_summary, outline.starting_quest.title]
      );
    }
    await db.run('COMMIT;');
  } catch (err) {
    await db.run('ROLLBACK;');
    throw err;
  }

  return {
    campaignId,
    title: outline.title,
    genre,
    setting: outline.setting,
    themeColors: outline.theme_colors,
    character: {
      name: characterName,
      class: characterClass,
      health: 100,
      max_health: 100,
      mana: 50,
      max_mana: 50,
      xp: 0,
      level: 1,
      inventory,
      attributes
    },
    npcs: npcList,
    outline,
    currentQuest: outline.starting_quest,
    currentAct: 1,
    turn: {
      number: 1,
      playerAction: null,
      narrative: turnData.narrative,
      svg,
      suggestedChoices: turnData.suggested_choices || []
    }
  };
}

export async function takeTurn(campaignId, playerAction, apiConfig) {
  const client = new AIClient(apiConfig);

  // 1. Fetch current campaign details (outside transaction for low lock overhead)
  const campaign = await db.get(`SELECT * FROM campaigns WHERE id = ?`, [campaignId]);
  if (!campaign) throw new Error(`Campaign ${campaignId} not found.`);

  const outlineRow = await db.get(`SELECT * FROM campaign_outlines WHERE campaign_id = ?`, [campaignId]);
  const outline = JSON.parse(outlineRow.outline_json);

  const characterRow = await db.get(`SELECT * FROM characters WHERE campaign_id = ?`, [campaignId]);
  const character = {
    name: characterRow.name,
    class: characterRow.class,
    health: characterRow.health,
    max_health: characterRow.max_health,
    mana: characterRow.mana,
    max_mana: characterRow.max_mana,
    xp: characterRow.xp,
    level: characterRow.level,
    inventory: JSON.parse(characterRow.inventory_json),
    attributes: JSON.parse(characterRow.attributes_json)
  };

  const npcs = await db.all(`SELECT * FROM npcs WHERE campaign_id = ?`, [campaignId]);

  // Fetch last 6 turns for immediate context
  const pastTurns = await db.all(
    `SELECT * FROM turns WHERE campaign_id = ? ORDER BY turn_number DESC LIMIT 6`,
    [campaignId]
  );
  pastTurns.reverse();

  // Fetch campaign memories (Top importance + recency ranked)
  const memories = await db.all(
    `SELECT * FROM memories WHERE campaign_id = ? ORDER BY importance DESC, id DESC LIMIT 8`,
    [campaignId]
  );

  const currentTurnNumber = pastTurns.length > 0 ? pastTurns[pastTurns.length - 1].turn_number + 1 : 1;
  const currentAct = campaign.current_act || 1;

  // 2. Build the context prompt
  const dmSystem = getDMSystemInstruction(outline, character, npcs, currentAct);

  let historyPrompt = `=== CAMPAIGN HISTORY ===\n`;
  if (memories.length > 0) {
    historyPrompt += `Summary of key past events:\n` + memories.map(m => `- [Importance ${m.importance}] ${m.summary}`).join('\n') + `\n\n`;
  }
  historyPrompt += `Last active turns:\n`;
  pastTurns.forEach(turn => {
    if (turn.player_action) {
      historyPrompt += `> PLAYER: ${turn.player_action}\n`;
    }
    historyPrompt += `> DM: ${turn.narrative.substring(0, 500)}...\n`;
  });
  
  // Extract active quest
  let activeQuestName = outline.starting_quest.title;
  let activeQuestDesc = outline.starting_quest.description;

  if (pastTurns.length > 0) {
    for (const turn of [...pastTurns].reverse()) {
      if (turn.state_changes_json) {
        try {
          const stateChanges = JSON.parse(turn.state_changes_json);
          if (stateChanges.quest_update?.active_quest) {
            activeQuestName = stateChanges.quest_update.active_quest;
            activeQuestDesc = stateChanges.quest_update.quest_description || '';
            break;
          }
        } catch (e) {}
      }
    }
  }

  const turnPrompt = `${historyPrompt}
=== CURRENT STATUS ===
Turn Number: ${currentTurnNumber}
Current Act: Act ${currentAct} - Objective: "${outline.acts.find(a => a.act === currentAct)?.objective || ''}"
Active Quest: "${activeQuestName}" (${activeQuestDesc})

PLAYER ACTION: "${playerAction}"

Dungeon Master, process this action. Output the JSON object containing the narrative story, suggested choices, player state updates, active quest, a beautiful SVG matching HSL guidelines, and any relationship/interaction updates for NPCs.`;

  console.log(`Processing Turn ${currentTurnNumber} for Campaign ${campaignId}...`);
  const aiResponse = await client.sendPrompt({
    systemInstruction: dmSystem,
    prompt: turnPrompt,
    jsonMode: true
  });

  const turnData = parseJsonSafe(aiResponse);

  // Apply state updates (Unify Level Up mechanics)
  const updates = turnData.character_update || {};
  
  // Health
  if (typeof updates.health_change === 'number') {
    character.health = Math.max(0, Math.min(character.max_health, character.health + updates.health_change));
  }
  // Mana
  if (typeof updates.mana_change === 'number') {
    character.mana = Math.max(0, Math.min(character.max_mana, character.mana + updates.mana_change));
  }
  
  // XP & Level (XP is single source of truth: level = floor(xp/100)+1)
  if (typeof updates.xp_gain === 'number') {
    const oldLevel = character.level;
    character.xp += updates.xp_gain;
    const computedLevel = Math.floor(character.xp / 100) + 1;
    
    if (computedLevel > oldLevel) {
      const levelDiff = computedLevel - oldLevel;
      character.level = computedLevel;
      character.max_health += levelDiff * 15;
      character.health = character.max_health; // full heal
      character.max_mana += levelDiff * 10;
      character.mana = character.max_mana;
      turnData.narrative += `\n\n🎉 **LEVEL UP! You have reached Level ${character.level}! Your maximum Health and Mana have increased!**`;
    }
  }

  // Inventory changes
  if (updates.inventory_changes && Array.isArray(updates.inventory_changes)) {
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

  const nextAct = turnData.quest_update?.current_act || currentAct;

  // Fallback for SVG
  const svg = turnData.svg_illustration && turnData.svg_illustration.includes('<svg') 
    ? turnData.svg_illustration 
    : createFallbackSvg(activeQuestName, outline.theme_colors?.primary, outline.theme_colors?.secondary);

  // 3. EXECUTE WRITE TRANSACTION (Immediate Transaction block to prevent interleaved concurrent mutations)
  await db.run('BEGIN IMMEDIATE;');
  try {
    // A. Check unique constraint race conditions
    const checkTurnExists = await db.get(
      `SELECT 1 FROM turns WHERE campaign_id = ? AND turn_number = ?`,
      [campaignId, currentTurnNumber]
    );
    if (checkTurnExists) {
      throw new Error(`Turn ${currentTurnNumber} has already been written. Transaction aborted.`);
    }

    // B. Save character updates
    await db.run(
      `UPDATE characters SET health = ?, mana = ?, xp = ?, level = ?, inventory_json = ? WHERE campaign_id = ?`,
      [character.health, character.mana, character.xp, character.level, JSON.stringify(character.inventory), campaignId]
    );

    // C. Save campaign progress (current act)
    await db.run(
      `UPDATE campaigns SET current_act = ? WHERE id = ?`,
      [nextAct, campaignId]
    );

    // D. Apply NPC updates
    if (turnData.npc_updates && Array.isArray(turnData.npc_updates)) {
      for (const update of turnData.npc_updates) {
        const existingNpc = npcs.find(n => n.name.toLowerCase() === update.name.toLowerCase());
        if (existingNpc) {
          const newRelation = Math.max(-100, Math.min(100, existingNpc.relationship_value + (update.relationship_change || 0)));
          
          let updatedNotes = existingNpc.notes || '';
          if (update.note_update) {
            updatedNotes += `\n[Turn ${currentTurnNumber}]: ${update.note_update}`;
          }

          await db.run(
            `UPDATE npcs SET relationship_value = ?, notes = ?, status = ? WHERE id = ?`,
            [newRelation, updatedNotes, update.status || existingNpc.status, existingNpc.id]
          );
        }
      }
    }

    // E. Save turn
    await db.run(
      `INSERT INTO turns (campaign_id, turn_number, player_action, narrative, state_changes_json, svg_illustration)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [campaignId, currentTurnNumber, playerAction, turnData.narrative, JSON.stringify(turnData), svg]
    );

    // F. Save memories with dynamic importance
    if (turnData.memory_summary) {
      await db.run(
        `INSERT INTO memories (campaign_id, importance, summary, keywords) VALUES (?, ?, ?, ?)`,
        [campaignId, turnData.memory_importance || 3, turnData.memory_summary, turnData.memory_keywords || activeQuestName]
      );
    }

    // G. Update campaign summary
    if (currentTurnNumber % 5 === 0 && turnData.memory_summary) {
      await db.run(
        `UPDATE campaigns SET summary = ? WHERE id = ?`,
        [`Act ${nextAct}. Level ${character.level} ${character.class} pursuing: ${activeQuestName}. Last events: ${turnData.memory_summary}`, campaignId]
      );
    }

    await db.run('COMMIT;');
  } catch (err) {
    await db.run('ROLLBACK;');
    throw err;
  }

  // Refetch updated NPCs to return
  const updatedNpcs = await db.all(`SELECT * FROM npcs WHERE campaign_id = ?`, [campaignId]);

  return {
    campaignId,
    character,
    npcs: updatedNpcs,
    currentQuest: turnData.quest_update || { active_quest: activeQuestName, quest_description: activeQuestDesc },
    currentAct: nextAct,
    turn: {
      number: currentTurnNumber,
      playerAction,
      narrative: turnData.narrative,
      svg,
      suggestedChoices: turnData.suggested_choices || []
    }
  };
}

export async function getCampaignState(campaignId) {
  const campaign = await db.get(`SELECT * FROM campaigns WHERE id = ?`, [campaignId]);
  if (!campaign) return null;

  const outlineRow = await db.get(`SELECT * FROM campaign_outlines WHERE campaign_id = ?`, [campaignId]);
  const outline = JSON.parse(outlineRow.outline_json);

  const characterRow = await db.get(`SELECT * FROM characters WHERE campaign_id = ?`, [campaignId]);
  const character = {
    name: characterRow.name,
    class: characterRow.class,
    health: characterRow.health,
    max_health: characterRow.max_health,
    mana: characterRow.mana,
    max_mana: characterRow.max_mana,
    xp: characterRow.xp,
    level: characterRow.level,
    inventory: JSON.parse(characterRow.inventory_json),
    attributes: JSON.parse(characterRow.attributes_json)
  };

  const npcs = await db.all(`SELECT * FROM npcs WHERE campaign_id = ?`, [campaignId]);

  const lastTurn = await db.get(
    `SELECT * FROM turns WHERE campaign_id = ? ORDER BY turn_number DESC LIMIT 1`,
    [campaignId]
  );

  let activeQuestName = outline.starting_quest.title;
  let activeQuestDesc = outline.starting_quest.description;
  let currentAct = campaign.current_act || 1;
  let suggestedChoices = [];

  if (lastTurn) {
    try {
      const turnData = JSON.parse(lastTurn.state_changes_json || '{}');
      if (turnData.quest_update?.active_quest) {
        activeQuestName = turnData.quest_update.active_quest;
        activeQuestDesc = turnData.quest_update.quest_description || '';
      }
      suggestedChoices = turnData.suggested_choices || [];
    } catch(e) {}
  }

  return {
    campaignId,
    title: campaign.title,
    genre: campaign.genre,
    setting: campaign.summary,
    themeColors: outline.theme_colors,
    character,
    npcs,
    outline,
    currentQuest: { active_quest: activeQuestName, quest_description: activeQuestDesc },
    currentAct,
    turn: {
      number: lastTurn ? lastTurn.turn_number : 1,
      playerAction: lastTurn ? lastTurn.player_action : null,
      narrative: lastTurn ? lastTurn.narrative : 'Beginning campaign...',
      svg: lastTurn ? lastTurn.svg_illustration : createFallbackSvg(campaign.title),
      suggestedChoices
    }
  };
}

/**
 * System Instruction Compiler for the Dungeon Master LLM.
 */
function getDMSystemInstruction(outline, character, npcs = [], currentAct = 1) {
  // Dynamically map acts array to prevent index boundary crashes on different counts
  const actsOutlinePrompt = outline.acts && Array.isArray(outline.acts)
    ? outline.acts.map(act => `* Act ${act.act}: "${act.title}" - Objective: "${act.objective}" (Key milestones: ${act.key_events?.join(', ') || 'none'})`).join('\n')
    : 'No acts defined.';

  const npcSection = npcs.length > 0 
    ? `=== DYNAMIC NPCs & RELATIONSHIPS ===
These characters populate the world. They have persistent personalities, specific speech quirks, and relationship levels with the player (range: -100 to +100).
Keep their actions, dialogue, attitudes, and reactions strictly coherent with these definitions:
${npcs.map(npc => `- **${npc.name}** (Role: ${npc.role}):
   * Personality: ${npc.personality}
   * Quirks/Habits: ${npc.quirks}
   * Player Relationship: ${npc.relationship_value} / 100 (${npc.relationship_value > 60 ? 'Crush / Deep Ally' : npc.relationship_value < -60 ? 'Nemesis / Grudge' : 'Neutral'})
   * History of Interactions: ${npc.notes}
   * Status: ${npc.status}`).join('\n')}`
    : `=== NPCs ===
${outline.key_npcs.map(npc => `- ${npc.name} (${npc.role}): ${npc.description}`).join('\n')}`;

  return `You are a legendary Dungeon Master (DM) for a single-player role-playing game.
Your task is to orchestrate an immersive campaign for the player, adhering to the overall campaign blueprint but reacting dynamically to what they do.

=== CAMPAIGN BLUEPRINT ===
Campaign Title: "${outline.title}"
Genre & Atmosphere: "${outline.setting}"
Theme Colors: Primary HSL: ${outline.theme_colors?.primary || '210, 100%, 50%'}, Secondary HSL: ${outline.theme_colors?.secondary || '300, 100%, 50%'}

=== THE CAMPAIGN PATH ===
Current Active Act: Act ${currentAct}
Acts Blueprint:
${actsOutlinePrompt}

Major Locations in the World:
${outline.major_locations.map(loc => `- ${loc.name}: ${loc.description}`).join('\n')}

${npcSection}

=== PLAYER DETAILS ===
Character Name: ${character.name}
Class: ${character.class}
Stats: Strength ${character.attributes.strength}, Agility ${character.attributes.agility}, Intellect ${character.attributes.intellect}, Willpower ${character.attributes.willpower}
Health: ${character.health}/${character.max_health}
Mana: ${character.mana}/${character.max_mana}
Level: ${character.level} (XP: ${character.xp})
Current Inventory:
${character.inventory.map(item => `- ${item.name} (${item.type}): ${item.description} [Qty: ${item.quantity || 1}]`).join('\n')}

=== DM RULES ===
1. Narrative Quality: Write vivid, rich description with high atmospheric focus. Write 2-3 paragraphs. If any NPCs speak, use their unique voice, habits, or stuttering quirks.
2. Coherence: Ensure you keep the story aligned with the current Act and Quest. Do not jump to the conclusion early. Let the player explore.
3. Challenge & Rules: The player's actions can fail or succeed. If they try something dangerous, assess damage (-5 to -20 HP) or deduct mana for spells. Add useful loot to inventory, and reward XP (10-35 XP) for actions that advance the quest.
4. Characters, Grudges & Crushes: NPCs react strongly to player dialogue and choices. If a player acts kindly, helps, or flirts with an NPC, increase their relationship value. If they betray, insult, or ignore them, decrease it. Grudges or Crushes should translate to future dialogue lines (blushing, stuttering, anger, refusal to cooperate, or helping them in battle).
5. Act Progress: If the objectives of the current Act have been fully met by the player's choices, increment the active Act in your quest_update output.
6. JSON Format: You MUST respond with a JSON object ONLY matching this schema, with no surrounding text or markdown formatting outside of JSON structure:
{
  "narrative": "Vivid narrative markdown description of what happens, ending in a hook.",
  "suggested_choices": [
    "Suggested action 1",
    "Suggested action 2",
    "Suggested action 3"
  ],
  "character_update": {
    "health_change": 0, // Number between -50 and +50
    "mana_change": 0,   // Number between -30 and +30
    "xp_gain": 0,       // XP awarded (10-35 for progress)
    "level_up": false,  // Set true only if leveling up
    "inventory_changes": [
      // array of changes. Options: action "add", "remove", or "use"
      { "action": "add", "item": { "name": "Glowing Core", "type": "key", "description": "Glows with plasma energy." } }
    ]
  },
  "quest_update": {
    "active_quest": "Current active quest title",
    "quest_description": "Updated detail of what the player should do next",
    "current_act": ${currentAct} // Keep at ${currentAct} or increment if this act objectives are resolved
  },
  "svg_illustration": "<svg xmlns=\\\"http://www.w3.org/2000/svg\\\" viewBox=\\\"0 0 800 400\\\" class=\\\"w-full h-full rounded-lg shadow-2xl\\\">...beautiful stylized SVG illustration of the scene. Use dark tones, rich linearGradients reflecting HSL: primary ${outline.theme_colors?.primary} and secondary ${outline.theme_colors?.secondary}. Combine shapes like path, polygon, circle and g to make silhouette scenes. Keep it atmospheric and visually beautiful. Avoid text tags inside the SVG.</svg>",
  "memory_summary": "One sentence summary of any permanent story developments this turn (or null if none).",
  "memory_importance": 3, // Rating from 1 (low importance) to 5 (high milestone importance)
  "memory_keywords": "comma, separated, tags", // Tags describing this memory
  "npc_updates": [
    {
      "name": "NPC Name",
      "relationship_change": 0, // Integer change between -50 and +50 to add/subtract
      "note_update": "A brief summary of what they think/remember about this specific exchange",
      "status": "alive|dead|missing"
    }
  ]
}

Double check that the SVG contains valid, clean SVG code with proper quote escaping for JSON values. Do not use unescaped double quotes inside the svg_illustration string! Use \\" for double quotes in JSON.`;
}
