import * as db from './db.js';
import { AIClient } from './api-client.js';
import { 
  parseJsonSafe, 
  createFallbackSvg, 
  validateTurnData, 
  performDiceCheck,
  validateOutlineData
} from './rpg-state.js';
import { getDMSystemInstruction } from './rpg-prompts.js';

// Export these so index/test scripts still have direct access
export { parseJsonSafe, createFallbackSvg };

/**
 * Core game engine functions linking DB and AI clients.
 */

export async function createCampaign({ genre, characterName, characterClass, apiConfig, rulesMode = false }) {
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

  const rawOutline = parseJsonSafe(outlineResponse);
  const outline = validateOutlineData(rawOutline);
  
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

  // Construct initial NPC list in-memory to build system instruction
  const npcList = (outline.key_npcs || []).map(npc => ({
    name: npc.name,
    role: npc.role,
    personality: npc.personality,
    quirks: npc.quirks,
    relationship_value: 0,
    notes: `Created at campaign start. Role: ${npc.role}.`,
    status: 'alive'
  }));

  // Generate Turn 1 (Opening Narrative and Scene SVG)
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

  console.log(`Generating opening turn for campaign...`);
  const turn1Response = await client.sendPrompt({
    systemInstruction: dmSystem,
    prompt: turn1Prompt,
    jsonMode: true
  });

  const parsedRaw = parseJsonSafe(turn1Response);
  const turnData = validateTurnData(parsedRaw, 1);

  const character = {
    name: characterName,
    class: characterClass,
    health: 100,
    max_health: 100,
    mana: 50,
    max_mana: 50,
    xp: 0,
    level: 1,
    inventory: [...inventory],
    attributes
  };

  // Apply Turn 1 character updates so state matches the turn data
  const updates = turnData.character_update || {};
  if (typeof updates.health_change === 'number') {
    character.health = Math.max(0, Math.min(character.max_health, character.health + updates.health_change));
  }
  if (typeof updates.mana_change === 'number') {
    character.mana = Math.max(0, Math.min(character.max_mana, character.mana + updates.mana_change));
  }
  if (typeof updates.xp_gain === 'number') {
    const oldLevel = character.level;
    character.xp += updates.xp_gain;
    const computedLevel = Math.floor(character.xp / 100) + 1;
    if (computedLevel > oldLevel) {
      const levelDiff = computedLevel - oldLevel;
      character.level = computedLevel;
      character.max_health += levelDiff * 15;
      character.health = character.max_health;
      character.max_mana += levelDiff * 10;
      character.mana = character.max_mana;
      turnData.narrative += `\n\n🎉 **LEVEL UP! You have reached Level ${character.level}! Your maximum Health and Mana have increased!**`;
    }
  }
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

  const svg = turnData.svg_illustration && turnData.svg_illustration.includes('<svg') 
    ? turnData.svg_illustration 
    : createFallbackSvg(outline.title, outline.theme_colors?.primary, outline.theme_colors?.secondary);

  // DB Transaction for creation - all writes are compiled atomically
  await db.run('BEGIN IMMEDIATE;');
  let campaignId;
  const rulesModeInt = rulesMode ? 1 : 0;
  try {
    // Insert campaign into DB
    const campaignResult = await db.run(
      `INSERT INTO campaigns (title, genre, summary, current_act, rules_mode) VALUES (?, ?, ?, 1, ?)`,
      [outline.title, genre, outline.setting, rulesModeInt]
    );
    campaignId = campaignResult.id;

    // Insert outline
    await db.run(
      `INSERT INTO campaign_outlines (campaign_id, outline_json) VALUES (?, ?)`,
      [campaignId, JSON.stringify(outline)]
    );

    // Insert character directly with final state
    await db.run(
      `INSERT INTO characters (campaign_id, name, class, health, max_health, mana, max_mana, xp, level, inventory_json, attributes_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [campaignId, character.name, character.class, character.health, character.max_health, character.mana, character.max_mana, character.xp, character.level, JSON.stringify(character.inventory), JSON.stringify(character.attributes)]
    );

    // Insert NPCs
    for (const npc of npcList) {
      await db.run(
        `INSERT INTO npcs (campaign_id, name, role, personality, quirks, relationship_value, notes, status)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, 'alive')`,
        [campaignId, npc.name, npc.role, npc.personality, npc.quirks, npc.notes]
      );
    }

    // Insert Turn 1
    await db.run(
      `INSERT INTO turns (campaign_id, turn_number, player_action, narrative, state_changes_json, svg_illustration)
       VALUES (?, 1, NULL, ?, ?, ?)`,
      [campaignId, turnData.narrative, JSON.stringify(turnData), svg]
    );

    // Insert memory
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

  // Refetch initial NPCs to include database-assigned IDs
  const finalNpcList = await db.all(`SELECT * FROM npcs WHERE campaign_id = ?`, [campaignId]);

  return {
    campaignId,
    title: outline.title,
    genre,
    setting: outline.setting,
    themeColors: outline.theme_colors,
    rulesMode: !!rulesModeInt,
    character: {
      name: characterName,
      class: characterClass,
      health: character.health,
      max_health: character.max_health,
      mana: character.mana,
      max_mana: character.max_mana,
      xp: character.xp,
      level: character.level,
      inventory: character.inventory,
      attributes: character.attributes
    },
    npcs: finalNpcList,
    outline,
    currentQuest: outline.starting_quest,
    currentAct: 1,
    turn: {
      number: 1,
      playerAction: null,
      narrative: turnData.narrative,
      svg,
      suggestedChoices: turnData.suggested_choices || [],
      rollResult: null
    }
  };
}

export async function takeTurn(campaignId, playerAction, apiConfig) {
  const client = new AIClient(apiConfig);

  // 1. Fetch current campaign details
  const campaign = await db.get(`SELECT * FROM campaigns WHERE id = ?`, [campaignId]);
  if (!campaign) throw new Error(`Campaign ${campaignId} not found.`);

  const outlineRow = await db.get(`SELECT * FROM campaign_outlines WHERE campaign_id = ?`, [campaignId]);
  const outline = validateOutlineData(JSON.parse(outlineRow.outline_json));

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

  // Perform lightweight Rules Mode check if enabled
  let rollResult = null;
  let finalPlayerAction = playerAction;

  if (campaign.rules_mode) {
    const cleanAction = playerAction.trim();
    // Rules checks apply to active verbs. Dialogue inside quotes bypasses checks.
    const isConversation = cleanAction.startsWith('"') || cleanAction.startsWith("'") || 
                           cleanAction.toLowerCase().startsWith('say ') || 
                           cleanAction.toLowerCase().startsWith('talk to ') ||
                           cleanAction.toLowerCase().startsWith('ask ');
    
    if (!isConversation) {
      rollResult = performDiceCheck(character, playerAction);
      const rollText = `🎲 [${rollResult.attribute.toUpperCase()} Check] d20 roll: ${rollResult.roll} + Mod: ${rollResult.modifier} = ${rollResult.total} vs DC: ${rollResult.dc} ➔ ${rollResult.success ? 'SUCCESS' : 'FAILURE'}`;
      finalPlayerAction = `[Rules Check: ${rollText}] Player action: ${playerAction}`;
      console.log(`Rules check generated: ${rollText}`);
    }
  }

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

PLAYER ACTION: "${finalPlayerAction}"

Dungeon Master, process this action. Output the JSON object containing the narrative story, suggested choices, player state updates, active quest, a beautiful SVG matching HSL guidelines, and any relationship/interaction updates for NPCs.`;

  console.log(`Processing Turn ${currentTurnNumber} for Campaign ${campaignId}...`);
  const aiResponse = await client.sendPrompt({
    systemInstruction: dmSystem,
    prompt: turnPrompt,
    jsonMode: true
  });

  const parsedRaw = parseJsonSafe(aiResponse);
  const turnData = validateTurnData(parsedRaw, currentAct);

  // If rules check occurred, bundle it inside turnData to store in DB
  if (rollResult) {
    turnData.roll_result = rollResult;
  }

  // Apply state updates (Unify Level Up mechanics)
  const updates = turnData.character_update || {};
  
  // Health
  if (typeof updates.health_change === 'number') {
    character.health = Math.max(0, Math.min(character.max_health, character.health + updates.health_change));
  }
  // Modifier checks or special roll results can also apply damage checks
  if (rollResult && !rollResult.success) {
    // Penalty for failed roll
    const damage = Math.floor(Math.random() * 6) + 5; // 5-10 damage
    character.health = Math.max(0, character.health - damage);
    if (!updates.health_change) updates.health_change = 0;
    updates.health_change -= damage;
    turnData.narrative += `\n\n⚠️ **You took ${damage} damage from the failed challenge!**`;
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

  // 3. EXECUTE WRITE TRANSACTION (Immediate Transaction block)
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
    rulesMode: !!campaign.rules_mode,
    turn: {
      number: currentTurnNumber,
      playerAction,
      narrative: turnData.narrative,
      svg,
      suggestedChoices: turnData.suggested_choices || [],
      rollResult
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
  let rollResult = null;

  if (lastTurn) {
    try {
      const turnData = JSON.parse(lastTurn.state_changes_json || '{}');
      if (turnData.quest_update?.active_quest) {
        activeQuestName = turnData.quest_update.active_quest;
        activeQuestDesc = turnData.quest_update.quest_description || '';
      }
      suggestedChoices = turnData.suggested_choices || [];
      rollResult = turnData.roll_result || null;
    } catch(e) {}
  }

  return {
    campaignId,
    title: campaign.title,
    genre: campaign.genre,
    setting: campaign.summary,
    themeColors: outline.theme_colors,
    rulesMode: !!campaign.rules_mode,
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
      suggestedChoices,
      rollResult
    }
  };
}

/**
 * Fork campaign from any prior turn
 */
export async function forkCampaign(campaignId, turnNumber, newTitle) {
  // A. Get campaign info
  const campaign = await db.get(`SELECT * FROM campaigns WHERE id = ?`, [campaignId]);
  if (!campaign) throw new Error(`Campaign ${campaignId} not found.`);

  const outlineRow = await db.get(`SELECT * FROM campaign_outlines WHERE campaign_id = ?`, [campaignId]);
  if (!outlineRow) throw new Error(`Campaign outline not found for campaign ${campaignId}.`);
  const outline = validateOutlineData(JSON.parse(outlineRow.outline_json));

  const characterRow = await db.get(`SELECT * FROM characters WHERE campaign_id = ?`, [campaignId]);
  if (!characterRow) throw new Error(`Character not found for campaign ${campaignId}.`);
  const characterClass = characterRow.class;
  const characterName = characterRow.name;

  // B. Fetch all turns up to turnNumber
  const turns = await db.all(
    `SELECT * FROM turns WHERE campaign_id = ? AND turn_number <= ? ORDER BY turn_number ASC`,
    [campaignId, turnNumber]
  );
  if (turns.length === 0) throw new Error(`No turns found up to turn ${turnNumber}.`);

  // C. Reconstruct character state and NPC states up to turnNumber
  const attributes = JSON.parse(characterRow.attributes_json);

  const inventory = [
    { name: "Starter Kit", type: "key", description: "Essential survival gear and tokens.", quantity: 1 },
    { name: "Healing Salve", type: "consumable", description: "Restores 20 Health Points.", quantity: 2, effect: "heal_20" }
  ];
  if (characterClass === 'Warrior') inventory.push({ name: "Iron Sword", type: "weapon", description: "A simple blade.", stats: "+4 Physical Power", equipped: true });
  else if (characterClass === 'Mage') inventory.push({ name: "Apprentice Staff", type: "weapon", description: "Channels magic.", stats: "+4 Magical Power", equipped: true });
  else if (characterClass === 'Rogue') inventory.push({ name: "Steel Daggers", type: "weapon", description: "Dual stealth blades.", stats: "+4 Agility Power", equipped: true });
  else if (characterClass === 'Cleric') inventory.push({ name: "Wooden Mace", type: "weapon", description: "Blunt force focus.", stats: "+3 Divine Power", equipped: true });

  const character = {
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
  };

  const npcs = (outline.key_npcs || []).map((npc, idx) => ({
    name: npc.name,
    role: npc.role,
    personality: npc.personality,
    quirks: npc.quirks,
    relationship_value: 0,
    notes: `Created at campaign start. Role: ${npc.role}.`,
    status: 'alive'
  }));

  let lastAct = 1;
  for (const turn of turns) {
    if (!turn.state_changes_json) continue;
    let turnData;
    try {
      turnData = JSON.parse(turn.state_changes_json);
    } catch (e) {
      continue;
    }

    const updates = turnData.character_update || {};
    
    // Apply updates
    if (typeof updates.health_change === 'number') {
      character.health = Math.max(0, Math.min(character.max_health, character.health + updates.health_change));
    }
    if (typeof updates.mana_change === 'number') {
      character.mana = Math.max(0, Math.min(character.max_mana, character.mana + updates.mana_change));
    }
    if (typeof updates.xp_gain === 'number') {
      const oldLevel = character.level;
      character.xp += updates.xp_gain;
      const computedLevel = Math.floor(character.xp / 100) + 1;
      if (computedLevel > oldLevel) {
        const levelDiff = computedLevel - oldLevel;
        character.level = computedLevel;
        character.max_health += levelDiff * 15;
        character.health = character.max_health;
        character.max_mana += levelDiff * 10;
        character.mana = character.max_mana;
      }
    }
    
    // Applying failed roll penalty if turn is not the first one and a failed roll is logged in state changes
    if (turn.turn_number > 1 && turnData.roll_result && !turnData.roll_result.success) {
      // Failed roll penalties are already counted in the turn narrative logs but to be fully aligned:
      // If our replay logic above processed updates.health_change, the penalties that we generated
      // during the original takeTurn execution are already stored in updates.health_change!
      // So we don't need to re-apply the random penalty again, since it's already captured in updates.health_change.
    }

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

    if (turnData.quest_update?.current_act) {
      lastAct = turnData.quest_update.current_act;
    }

    if (turnData.npc_updates && Array.isArray(turnData.npc_updates)) {
      turnData.npc_updates.forEach(update => {
        const existingNpc = npcs.find(n => n.name.toLowerCase() === update.name.toLowerCase());
        if (existingNpc) {
          existingNpc.relationship_value = Math.max(-100, Math.min(100, existingNpc.relationship_value + (update.relationship_change || 0)));
          if (update.note_update) {
            existingNpc.notes += `\n[Turn ${turn.turn_number}]: ${update.note_update}`;
          }
          if (update.status) {
            existingNpc.status = update.status;
          }
        }
      });
    }
  }

  // D. DB Transaction to write new branched campaign
  await db.run('BEGIN IMMEDIATE;');
  let newCampaignId;
  try {
    const campaignResult = await db.run(
      `INSERT INTO campaigns (title, genre, summary, current_act, rules_mode) VALUES (?, ?, ?, ?, ?)`,
      [newTitle, campaign.genre, campaign.summary, lastAct, campaign.rules_mode]
    );
    newCampaignId = campaignResult.id;

    // Outline
    await db.run(
      `INSERT INTO campaign_outlines (campaign_id, outline_json) VALUES (?, ?)`,
      [newCampaignId, JSON.stringify(outline)]
    );

    // Character
    await db.run(
      `INSERT INTO characters (campaign_id, name, class, health, max_health, mana, max_mana, xp, level, inventory_json, attributes_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newCampaignId, character.name, character.class, character.health, character.max_health, character.mana, character.max_mana, character.xp, character.level, JSON.stringify(character.inventory), JSON.stringify(character.attributes)]
    );

    // NPCs
    for (const npc of npcs) {
      await db.run(
        `INSERT INTO npcs (campaign_id, name, role, personality, quirks, relationship_value, notes, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [newCampaignId, npc.name, npc.role, npc.personality, npc.quirks, npc.relationship_value, npc.notes, npc.status]
      );
    }

    // Copy Turns up to turnNumber
    for (const turn of turns) {
      await db.run(
        `INSERT INTO turns (campaign_id, turn_number, player_action, narrative, state_changes_json, svg_illustration, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [newCampaignId, turn.turn_number, turn.player_action, turn.narrative, turn.state_changes_json, turn.svg_illustration, turn.created_at]
      );
    }

    // Copy memories
    const lastTurnTimestamp = turns[turns.length - 1].created_at;
    const memoriesToCopy = await db.all(
      `SELECT * FROM memories WHERE campaign_id = ? AND created_at <= ?`,
      [campaignId, lastTurnTimestamp]
    );
    for (const memory of memoriesToCopy) {
      await db.run(
        `INSERT INTO memories (campaign_id, importance, summary, keywords, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [newCampaignId, memory.importance, memory.summary, memory.keywords, memory.created_at]
      );
    }

    await db.run('COMMIT;');
  } catch (err) {
    await db.run('ROLLBACK;');
    throw err;
  }

  return getCampaignState(newCampaignId);
}
