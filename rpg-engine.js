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

function defaultAttributesForConcept(concept = '') {
  const text = concept.toLowerCase();
  const attributes = { strength: 10, agility: 10, intellect: 10, willpower: 10 };

  const boosts = [
    { key: 'strength', words: ['soldier', 'fighter', 'guard', 'athlete', 'bruiser', 'laborer', 'marine', 'survivor', 'warrior'] },
    { key: 'agility', words: ['pilot', 'runner', 'scout', 'spy', 'thief', 'infiltrator', 'duelist', 'racer', 'acrobat'] },
    { key: 'intellect', words: ['scientist', 'engineer', 'doctor', 'hacker', 'scholar', 'investigator', 'detective', 'analyst', 'technician', 'mage'] },
    { key: 'willpower', words: ['leader', 'diplomat', 'mystic', 'priest', 'psychic', 'medic', 'negotiator', 'artist', 'commander'] }
  ];

  const matched = boosts.filter(boost => boost.words.some(word => text.includes(word))).map(boost => boost.key);
  if (matched.length === 0) {
    attributes.intellect += 1;
    attributes.willpower += 1;
    return attributes;
  }

  attributes[matched[0]] += 4;
  if (matched[1]) {
    attributes[matched[1]] += 2;
  } else {
    attributes.willpower += 1;
  }

  return attributes;
}

function createStarterInventory() {
  return [
    { name: "Field Kit", type: "key", description: "Adaptable personal supplies appropriate to the campaign world.", quantity: 1 },
    { name: "Recovery Patch", type: "consumable", description: "Restores 20 Health Points or equivalent condition strain.", quantity: 2, effect: "heal_20" }
  ];
}

function parseJsonArray(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function parseJsonObject(value, fallback = {}) {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
  } catch (e) {
    return fallback;
  }
}

function normalizeAbility(ability) {
  if (!ability || typeof ability.name !== 'string' || ability.name.trim() === '') {
    return null;
  }
  return {
    name: ability.name.trim(),
    description: ability.description || 'A developing capability.',
    tier: ability.tier || 'emerging',
    source: ability.source || 'in-game development'
  };
}

function applyAbilityUpdates(character, turnData, turnNumber) {
  if (!Array.isArray(character.abilities)) character.abilities = [];
  const updates = Array.isArray(turnData.ability_updates) ? turnData.ability_updates : [];
  if (updates.length === 0) return;

  const notes = [];
  for (const update of updates) {
    const ability = normalizeAbility(update.ability || {});
    if (!ability) continue;
    const existingIndex = character.abilities.findIndex(item => item.name.toLowerCase() === ability.name.toLowerCase());

    if (update.action === 'remove') {
      if (existingIndex !== -1) character.abilities.splice(existingIndex, 1);
    } else if (existingIndex !== -1) {
      character.abilities[existingIndex] = {
        ...character.abilities[existingIndex],
        ...ability
      };
    } else {
      character.abilities.push(ability);
    }

    if (update.note) {
      notes.push(`[Turn ${turnNumber}] ${update.note}`);
    }
  }

  if (notes.length > 0) {
    character.progression_notes = [character.progression_notes, ...notes].filter(Boolean).join('\n');
  }
}

async function getPlayerCharacter(profileId) {
  if (!profileId) return null;
  return db.get(`SELECT * FROM player_characters WHERE id = ?`, [profileId]);
}

async function syncPlayerCharacter(profileId, campaignId, character, status = 'checked_out') {
  if (!profileId) return;
  await db.run(
    `UPDATE player_characters
     SET status = ?, active_campaign_id = ?, health = ?, max_health = ?, mana = ?, max_mana = ?, xp = ?, level = ?,
         inventory_json = ?, attributes_json = ?, abilities_json = ?, progression_notes = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      status,
      status === 'available' ? null : campaignId,
      character.health,
      character.max_health,
      character.mana,
      character.max_mana,
      character.xp,
      character.level,
      JSON.stringify(character.inventory || []),
      JSON.stringify(character.attributes || {}),
      JSON.stringify(character.abilities || []),
      character.progression_notes || '',
      profileId
    ]
  );
}

function isMultiAgentModeEnabled() {
  return true;
}

function resolveAgentConfig(apiConfig = {}, role) {
  const prefixes = {
    interaction: 'INTERACTION',
    continuity: 'CONTINUITY',
    referee: 'REFEREE'
  };
  const prefix = prefixes[role] || role.toUpperCase();

  return {
    provider: process.env[`${prefix}_AI_PROVIDER`] || apiConfig.provider,
    model: process.env[`${prefix}_AI_MODEL`] || apiConfig.model,
    apiKey: process.env[`${prefix}_API_KEY`] || apiConfig.apiKey,
    baseUrl: process.env[`${prefix}_CUSTOM_ENDPOINT_URL`] || apiConfig.baseUrl,
    ollamaUrl: process.env[`${prefix}_OLLAMA_URL`] || apiConfig.ollamaUrl
  };
}

function compactJson(value) {
  return JSON.stringify(value, null, 2);
}

function buildTurnContext({
  campaign,
  outline,
  character,
  npcs,
  memories,
  pastTurns,
  currentTurnNumber,
  currentAct,
  activeQuestName,
  activeQuestDesc,
  playerAction,
  finalPlayerAction,
  rollResult
}) {
  const recentTurns = pastTurns.map(turn => ({
    turn_number: turn.turn_number,
    player_action: turn.player_action,
    narrative_excerpt: turn.narrative.substring(0, 700)
  }));

  return {
    campaign: {
      id: campaign.id,
      title: campaign.title,
      genre: campaign.genre,
      current_act: currentAct,
      rules_mode: !!campaign.rules_mode
    },
    current_turn_number: currentTurnNumber,
    active_quest: {
      title: activeQuestName,
      description: activeQuestDesc
    },
    current_act_objective: outline.acts.find(a => a.act === currentAct)?.objective || '',
    character,
    npcs: npcs.map(npc => ({
      name: npc.name,
      role: npc.role,
      relationship_value: npc.relationship_value,
      status: npc.status,
      notes: npc.notes
    })),
    memories: memories.map(memory => ({
      importance: memory.importance,
      summary: memory.summary,
      keywords: memory.keywords
    })),
    recent_turns: recentTurns,
    player_input: playerAction,
    final_player_input: finalPlayerAction,
    rules_check: rollResult
  };
}

async function callJsonAgent(client, systemInstruction, prompt, fallback) {
  const response = await client.sendPrompt({
    systemInstruction,
    prompt,
    jsonMode: true
  });

  try {
    return parseJsonSafe(response);
  } catch (error) {
    return {
      ...fallback,
      parse_error: error.message,
      raw_response: response.substring(0, 2000)
    };
  }
}

async function runMultiAgentTurn({ apiConfig, dmSystem, turnContext, turnPrompt }) {
  const interactionClient = new AIClient(resolveAgentConfig(apiConfig, 'interaction'));
  const continuityClient = new AIClient(resolveAgentConfig(apiConfig, 'continuity'));
  const refereeClient = new AIClient(resolveAgentConfig(apiConfig, 'referee'));
  const contextJson = compactJson(turnContext);

  const interactionProposalSystem = `You are the interaction context call for a single-player RPG.
You interpret the player's exact table input and propose what it means.
You do not advance time, adjudicate outcomes, or write canonical state.
Return JSON only.`;

  const interactionProposalPrompt = `Review this current game context:
${contextJson}

The player input is: "${turnContext.player_input}"

Return JSON matching:
{
  "input_kind": "clarification|dialogue|committed_action",
  "player_intent": "What the player wants from the DM",
  "proposed_action": "The concrete in-fiction action only if one exists, otherwise null",
  "clarification_answer": "Direct answer if this is table-talk or clarification, otherwise null",
  "stakes": "Relevant risks, costs, or uncertainty",
  "suggested_next_actions": ["option 1", "option 2", "option 3"]
}

Use "clarification" when the player is asking what they know, what they have, what is possible, or how the scene works. Use "committed_action" only when they actually attempt something in the fiction.`;

  const interactionProposal = await callJsonAgent(interactionClient, interactionProposalSystem, interactionProposalPrompt, {
    input_kind: 'committed_action',
    player_intent: 'Unable to parse interaction proposal.',
    proposed_action: turnContext.player_input,
    clarification_answer: null,
    stakes: '',
    suggested_next_actions: []
  });

  const continuityReviewSystem = `You are the continuity context call for a persistent single-player RPG.
You approve, deny, or revise the interaction proposal against campaign continuity.
You protect pacing, act structure, known facts, NPC memory, and the game archive.
You do not write canonical state. Return JSON only.`;

  const continuityReviewPrompt = `Review this current game context:
${contextJson}

=== INTERACTION PROPOSAL ===
${compactJson(interactionProposal)}

Return JSON matching:
{
  "continuity_status": "approved|revise|denied",
  "continuity_reason": "Why this fits or conflicts with established state",
  "revised_action": "A continuity-safe action or response, if revision is needed",
  "active_pressure": "Immediate pressure that remains true",
  "state_constraints": ["What state may or may not change"],
  "archive_notes": ["Facts that should be logged if this resolves"]
}`;

  const continuityReview = await callJsonAgent(continuityClient, continuityReviewSystem, continuityReviewPrompt, {
    continuity_status: 'revise',
    continuity_reason: 'Unable to parse continuity review.',
    revised_action: null,
    active_pressure: '',
    state_constraints: [],
    archive_notes: []
  });

  const refereeSystem = `You are the referee context call for a persistent single-player RPG.
You adjudicate the continuity-reviewed proposal fairly and conservatively.
You may approve, deny, or request clarification. You define allowed state changes, but you do not write final narration.
Return JSON only.`;

  const refereePrompt = `Review this current game context:
${contextJson}

=== INTERACTION PROPOSAL ===
${compactJson(interactionProposal)}

=== CONTINUITY REVIEW ===
${compactJson(continuityReview)}

Return JSON matching:
{
  "referee_status": "approved|denied|needs_clarification",
  "input_kind": "clarification|dialogue|committed_action",
  "ruling": "The fair outcome or reason for denial",
  "approved_state_policy": "none|limited|normal",
  "allowed_character_update": {
    "health_change": 0,
    "mana_change": 0,
    "xp_gain": 0,
    "inventory_changes": []
  },
  "allowed_ability_updates": [],
  "allowed_npc_updates": [],
  "allowed_quest_update": {
    "active_quest": "${turnContext.active_quest.title}",
    "quest_description": "${turnContext.active_quest.description}",
    "current_act": ${turnContext.campaign.current_act}
  }
}

For clarification, denial, or needs_clarification, approved_state_policy must be "none" and all state changes must be no-op values.`;

  const refereeDecision = await callJsonAgent(refereeClient, refereeSystem, refereePrompt, {
    referee_status: 'needs_clarification',
    input_kind: interactionProposal.input_kind || 'clarification',
    ruling: 'Unable to parse referee decision.',
    approved_state_policy: 'none',
    allowed_character_update: { health_change: 0, mana_change: 0, xp_gain: 0, inventory_changes: [] },
    allowed_ability_updates: [],
    allowed_npc_updates: [],
    allowed_quest_update: {
      active_quest: turnContext.active_quest.title,
      quest_description: turnContext.active_quest.description,
      current_act: turnContext.campaign.current_act
    }
  });

  const continuityFinalSystem = `You are the final continuity context call for a persistent single-player RPG.
You receive the referee decision, perform a final consistency check, and prepare archive notes.
You do not narrate to the player. Return JSON only.`;

  const continuityFinalPrompt = `Review this current game context:
${contextJson}

=== INTERACTION PROPOSAL ===
${compactJson(interactionProposal)}

=== CONTINUITY REVIEW ===
${compactJson(continuityReview)}

=== REFEREE DECISION ===
${compactJson(refereeDecision)}

Return JSON matching:
{
  "final_status": "approved|denied|needs_clarification",
  "final_input_kind": "clarification|dialogue|committed_action",
  "final_constraints": ["Constraints the final in-world response must obey"],
  "archive_log": "One sentence suitable for memory/archive if a permanent event happened, otherwise null",
  "state_change_policy": "none|limited|normal",
  "approved_state_summary": "Summary of exactly what may change"
}`;

  const continuityFinal = await callJsonAgent(continuityClient, continuityFinalSystem, continuityFinalPrompt, {
    final_status: refereeDecision.referee_status || 'needs_clarification',
    final_input_kind: refereeDecision.input_kind || interactionProposal.input_kind || 'clarification',
    final_constraints: [],
    archive_log: null,
    state_change_policy: refereeDecision.approved_state_policy || 'none',
    approved_state_summary: refereeDecision.ruling || ''
  });

  const finalInteractionSystem = `${dmSystem}

=== FINAL INTERACTION CONTEXT CALL ===
You are the single DM voice the player sees.
You must relay the final approved result in in-world terms while preserving the referee and continuity decisions.
You are the last context call, and your JSON is the only response persisted to the database.
If final_status is denied or needs_clarification, explain the issue in-world and set all state changes to no-op values.
If final_input_kind is clarification, answer directly and set all state changes to no-op values.
If final_input_kind is committed_action, include only state changes approved by the referee and final continuity check.`;

  const finalInteractionPrompt = `${turnPrompt}

=== INTERACTION PROPOSAL ===
${compactJson(interactionProposal)}

=== CONTINUITY REVIEW ===
${compactJson(continuityReview)}

=== REFEREE DECISION ===
${compactJson(refereeDecision)}

=== FINAL CONTINUITY CHECK AND ARCHIVE NOTES ===
${compactJson(continuityFinal)}

Produce the final canonical JSON response now. The player must experience one coherent DM, not separate reviewers.`;

  const finalRaw = await interactionClient.sendPrompt({
    systemInstruction: finalInteractionSystem,
    prompt: finalInteractionPrompt,
    jsonMode: true
  });

  try {
    const finalData = parseJsonSafe(finalRaw);
    const noStateChange = continuityFinal.final_status !== 'approved' ||
      continuityFinal.final_input_kind === 'clarification' ||
      continuityFinal.state_change_policy === 'none' ||
      refereeDecision.referee_status !== 'approved';

    if (noStateChange) {
      finalData.input_kind = continuityFinal.final_input_kind || refereeDecision.input_kind || 'clarification';
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
    }

    if (continuityFinal.archive_log && !finalData.memory_summary && !noStateChange) {
      finalData.memory_summary = continuityFinal.archive_log;
      finalData.memory_importance = finalData.memory_importance || 3;
    }

    return JSON.stringify(finalData);
  } catch (error) {
    return finalRaw;
  }
}

export async function createCampaign({
  genre,
  characterName,
  characterClass,
  characterProfileId,
  characterMode = 'new',
  apiConfig,
  rulesMode = false
}) {
  const client = new AIClient(apiConfig);
  let sourceProfile = null;

  if (characterProfileId) {
    sourceProfile = await getPlayerCharacter(characterProfileId);
    if (!sourceProfile) throw new Error(`Character profile ${characterProfileId} not found.`);
    if (characterMode === 'existing' && sourceProfile.status !== 'available') {
      throw new Error(`Character "${sourceProfile.name}" is checked out to another active campaign. Copy the character to branch them into a new campaign.`);
    }
  }

  const resolvedCharacterName = sourceProfile ? sourceProfile.name : characterName;
  const resolvedCharacterArchetype = sourceProfile ? sourceProfile.archetype : (characterClass || 'Unformed protagonist');

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
  
  const attributes = sourceProfile
    ? parseJsonObject(sourceProfile.attributes_json, defaultAttributesForConcept(resolvedCharacterArchetype))
    : defaultAttributesForConcept(resolvedCharacterArchetype);

  const inventory = sourceProfile ? parseJsonArray(sourceProfile.inventory_json) : createStarterInventory();
  const abilities = sourceProfile ? parseJsonArray(sourceProfile.abilities_json) : [];
  const progressionNotes = sourceProfile?.progression_notes || '';

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
    name: resolvedCharacterName,
    class: resolvedCharacterArchetype,
    health: sourceProfile?.health ?? 100,
    max_health: sourceProfile?.max_health ?? 100,
    mana: sourceProfile?.mana ?? 50,
    max_mana: sourceProfile?.max_mana ?? 50,
    xp: sourceProfile?.xp ?? 0,
    level: sourceProfile?.level ?? 1,
    inventory,
    attributes,
    abilities,
    progression_notes: progressionNotes
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
    name: resolvedCharacterName,
    class: resolvedCharacterArchetype,
    health: sourceProfile?.health ?? 100,
    max_health: sourceProfile?.max_health ?? 100,
    mana: sourceProfile?.mana ?? 50,
    max_mana: sourceProfile?.max_mana ?? 50,
    xp: sourceProfile?.xp ?? 0,
    level: sourceProfile?.level ?? 1,
    inventory: [...inventory],
    attributes,
    abilities: [...abilities],
    progression_notes: progressionNotes
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
  applyAbilityUpdates(character, turnData, 1);

  const svg = turnData.svg_illustration && turnData.svg_illustration.includes('<svg') 
    ? turnData.svg_illustration 
    : createFallbackSvg(outline.title, outline.theme_colors?.primary, outline.theme_colors?.secondary);

  let campaignId;
  let playerCharacterId = sourceProfile && characterMode === 'existing' ? sourceProfile.id : null;
  const rulesModeInt = rulesMode ? 1 : 0;
  await db.withWriteTransaction(async () => {
    if (sourceProfile && characterMode === 'existing') {
      const latestProfile = await getPlayerCharacter(playerCharacterId);
      if (!latestProfile || latestProfile.status !== 'available') {
        throw new Error(`Character "${sourceProfile.name}" is no longer available. Copy the character to branch them into a new campaign.`);
      }
    }

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
    if (!playerCharacterId) {
      const profileResult = await db.run(
        `INSERT INTO player_characters (
          name, archetype, status, active_campaign_id, origin_campaign_id, copied_from_character_id,
          health, max_health, mana, max_mana, xp, level, inventory_json, attributes_json, abilities_json, progression_notes
        ) VALUES (?, ?, 'checked_out', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          character.name,
          character.class,
          campaignId,
          campaignId,
          sourceProfile?.id || null,
          character.health,
          character.max_health,
          character.mana,
          character.max_mana,
          character.xp,
          character.level,
          JSON.stringify(character.inventory),
          JSON.stringify(character.attributes),
          JSON.stringify(character.abilities),
          character.progression_notes || ''
        ]
      );
      playerCharacterId = profileResult.id;
    } else {
      await syncPlayerCharacter(playerCharacterId, campaignId, character);
    }

    await db.run(
      `INSERT INTO characters (campaign_id, player_character_id, name, class, health, max_health, mana, max_mana, xp, level, inventory_json, attributes_json, abilities_json, progression_notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        campaignId,
        playerCharacterId,
        character.name,
        character.class,
        character.health,
        character.max_health,
        character.mana,
        character.max_mana,
        character.xp,
        character.level,
        JSON.stringify(character.inventory),
        JSON.stringify(character.attributes),
        JSON.stringify(character.abilities),
        character.progression_notes || ''
      ]
    );

    // Insert NPCs
    for (const npc of npcList) {
      await db.run(
        `INSERT INTO npcs (campaign_id, name, role, personality, quirks, relationship_value, notes, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [campaignId, npc.name, npc.role, npc.personality, npc.quirks, npc.relationship_value, npc.notes, npc.status]
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
        `INSERT INTO memories (campaign_id, turn_number, importance, summary, keywords) VALUES (?, ?, ?, ?, ?)`,
        [campaignId, 1, turnData.memory_importance || 3, turnData.memory_summary, outline.starting_quest.title]
      );
    }
  });

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
      name: resolvedCharacterName,
      class: resolvedCharacterArchetype,
      health: character.health,
      max_health: character.max_health,
      mana: character.mana,
      max_mana: character.max_mana,
      xp: character.xp,
      level: character.level,
      inventory: character.inventory,
      attributes: character.attributes,
      abilities: character.abilities,
      progression_notes: character.progression_notes,
      player_character_id: playerCharacterId
    },
    npcs: finalNpcList,
    outline,
    currentQuest: {
      active_quest: outline.starting_quest.title,
      quest_description: outline.starting_quest.description
    },
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
  if (!outlineRow) throw new Error(`Campaign outline not found for campaign ${campaignId}.`);
  const outline = validateOutlineData(JSON.parse(outlineRow.outline_json));

  const characterRow = await db.get(`SELECT * FROM characters WHERE campaign_id = ?`, [campaignId]);
  if (!characterRow) throw new Error(`Character not found for campaign ${campaignId}.`);
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
    attributes: JSON.parse(characterRow.attributes_json),
    abilities: parseJsonArray(characterRow.abilities_json),
    progression_notes: characterRow.progression_notes || '',
    player_character_id: characterRow.player_character_id
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

  // Rules mode checks happen after the context calls classify and approve the input.
  let rollResult = null;
  let finalPlayerAction = playerAction;

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

PLAYER INPUT: "${finalPlayerAction}"

First decide input_kind in your JSON:
- "clarification" if the player is asking what they know, what they have, what is possible, or how the scene works.
- "dialogue" if the player speaks in-character to an NPC or entity.
- "committed_action" if the player attempts a concrete action in the fiction.

For clarification, answer directly using the character's known state, visible scene details, and reasonable in-world knowledge. Do not advance the scene clock, resolve attacks, spend resources, award XP, change inventory, change HP/mana, or move the quest forward unless the player also commits to an action. End by presenting concrete actions they could take next.

Output the JSON object containing the narrative response, suggested choices, player state updates, active quest, a beautiful SVG matching HSL guidelines, and any relationship/interaction updates for NPCs.`;

  console.log(`Processing Turn ${currentTurnNumber} for Campaign ${campaignId}...`);
  const turnContext = buildTurnContext({
    campaign,
    outline,
    character,
    npcs,
    memories,
    pastTurns,
    currentTurnNumber,
    currentAct,
    activeQuestName,
    activeQuestDesc,
    playerAction,
    finalPlayerAction,
    rollResult
  });
  const aiResponse = isMultiAgentModeEnabled(apiConfig)
    ? await runMultiAgentTurn({ apiConfig, dmSystem, turnContext, turnPrompt })
    : await client.sendPrompt({
        systemInstruction: dmSystem,
        prompt: turnPrompt,
        jsonMode: true
      });

  const parsedRaw = parseJsonSafe(aiResponse);
  const turnData = validateTurnData(parsedRaw, currentAct);

  if (turnData.input_kind === 'clarification') {
    turnData.character_update = {
      health_change: 0,
      mana_change: 0,
      xp_gain: 0,
      inventory_changes: []
    };
    turnData.quest_update = {
      active_quest: activeQuestName,
      quest_description: activeQuestDesc,
      current_act: currentAct
    };
    turnData.ability_updates = [];
    turnData.npc_updates = [];
    turnData.memory_summary = null;
    turnData.memory_keywords = '';
    rollResult = null;
  }

  if (campaign.rules_mode && turnData.input_kind === 'committed_action') {
    rollResult = performDiceCheck(character, playerAction);
    turnData.roll_result = rollResult;
    console.log(`Rules check generated: ${rollResult.attribute} ${rollResult.total} vs DC ${rollResult.dc}`);
  }

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
    turnData.roll_damage = damage;
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
  applyAbilityUpdates(character, turnData, currentTurnNumber);

  const nextAct = turnData.quest_update?.current_act || currentAct;

  // Fallback for SVG
  const svg = turnData.svg_illustration && turnData.svg_illustration.includes('<svg') 
    ? turnData.svg_illustration 
    : createFallbackSvg(activeQuestName, outline.theme_colors?.primary, outline.theme_colors?.secondary);

  await db.withWriteTransaction(async () => {
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
      `UPDATE characters SET health = ?, max_health = ?, mana = ?, max_mana = ?, xp = ?, level = ?, inventory_json = ?, abilities_json = ?, progression_notes = ? WHERE campaign_id = ?`,
      [
        character.health,
        character.max_health,
        character.mana,
        character.max_mana,
        character.xp,
        character.level,
        JSON.stringify(character.inventory),
        JSON.stringify(character.abilities),
        character.progression_notes || '',
        campaignId
      ]
    );
    await syncPlayerCharacter(character.player_character_id, campaignId, character);

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
        `INSERT INTO memories (campaign_id, turn_number, importance, summary, keywords) VALUES (?, ?, ?, ?, ?)`,
        [campaignId, currentTurnNumber, turnData.memory_importance || 3, turnData.memory_summary, turnData.memory_keywords || activeQuestName]
      );
    }

    // G. Update campaign summary
    if (currentTurnNumber % 5 === 0 && turnData.memory_summary) {
      await db.run(
        `UPDATE campaigns SET summary = ? WHERE id = ?`,
        [`Act ${nextAct}. Level ${character.level} ${character.class} pursuing: ${activeQuestName}. Last events: ${turnData.memory_summary}`, campaignId]
      );
    }

  });

  // Refetch updated NPCs to return
  const updatedNpcs = await db.all(`SELECT * FROM npcs WHERE campaign_id = ?`, [campaignId]);

  return {
    campaignId,
    title: campaign.title,
    genre: campaign.genre,
    setting: campaign.summary,
    themeColors: outline.theme_colors,
    character,
    npcs: updatedNpcs,
    outline,
    currentQuest: turnData.quest_update || { active_quest: activeQuestName, quest_description: activeQuestDesc },
    currentAct: nextAct,
    rulesMode: !!campaign.rules_mode,
    turn: {
      number: currentTurnNumber,
      playerAction,
      inputKind: turnData.input_kind,
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
  if (!outlineRow) throw new Error(`Campaign outline not found for campaign ${campaignId}.`);
  const outline = validateOutlineData(JSON.parse(outlineRow.outline_json));

  const characterRow = await db.get(`SELECT * FROM characters WHERE campaign_id = ?`, [campaignId]);
  if (!characterRow) throw new Error(`Character not found for campaign ${campaignId}.`);
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
    attributes: JSON.parse(characterRow.attributes_json),
    abilities: parseJsonArray(characterRow.abilities_json),
    progression_notes: characterRow.progression_notes || '',
    player_character_id: characterRow.player_character_id
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
  let inputKind = 'committed_action';

  if (lastTurn) {
    try {
      const turnData = JSON.parse(lastTurn.state_changes_json || '{}');
      if (turnData.quest_update?.active_quest) {
        activeQuestName = turnData.quest_update.active_quest;
        activeQuestDesc = turnData.quest_update.quest_description || '';
      }
      suggestedChoices = turnData.suggested_choices || [];
      rollResult = turnData.roll_result || null;
      inputKind = turnData.input_kind || inputKind;
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
      inputKind,
      narrative: lastTurn ? lastTurn.narrative : 'Beginning campaign...',
      svg: lastTurn ? lastTurn.svg_illustration : createFallbackSvg(campaign.title),
      suggestedChoices,
      rollResult
    }
  };
}

export async function listPlayerCharacters() {
  const rows = await db.all(
    `SELECT pc.*, c.title AS active_campaign_title
     FROM player_characters pc
     LEFT JOIN campaigns c ON c.id = pc.active_campaign_id
     ORDER BY pc.updated_at DESC, pc.created_at DESC`
  );

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    archetype: row.archetype,
    status: row.status,
    active_campaign_id: row.active_campaign_id,
    active_campaign_title: row.active_campaign_title || null,
    origin_campaign_id: row.origin_campaign_id,
    copied_from_character_id: row.copied_from_character_id,
    health: row.health,
    max_health: row.max_health,
    mana: row.mana,
    max_mana: row.max_mana,
    xp: row.xp,
    level: row.level,
    inventory: parseJsonArray(row.inventory_json),
    attributes: parseJsonObject(row.attributes_json),
    abilities: parseJsonArray(row.abilities_json),
    progression_notes: row.progression_notes || '',
    created_at: row.created_at,
    updated_at: row.updated_at
  }));
}

export async function releaseCampaignCharacters(campaignId, options = {}) {
  await db.withWriteTransaction(async () => {
    await db.run(
      `UPDATE player_characters
       SET status = 'available', active_campaign_id = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE active_campaign_id = ?`,
      [campaignId]
    );

    if (options.detachCampaign) {
      await db.run(
        `UPDATE characters SET player_character_id = NULL WHERE campaign_id = ?`,
        [campaignId]
      );
    }
  });
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
  const characterArchetype = characterRow.class;
  const characterName = characterRow.name;

  // B. Fetch all turns up to turnNumber
  const turns = await db.all(
    `SELECT * FROM turns WHERE campaign_id = ? AND turn_number <= ? ORDER BY turn_number ASC`,
    [campaignId, turnNumber]
  );
  if (turns.length === 0) throw new Error(`No turns found up to turn ${turnNumber}.`);

  // C. Reconstruct character state and NPC states up to turnNumber
  const attributes = JSON.parse(characterRow.attributes_json);
  const inventory = createStarterInventory();

  const character = {
    name: characterName,
    class: characterArchetype,
    health: 100,
    max_health: 100,
    mana: 50,
    max_mana: 50,
    xp: 0,
    level: 1,
    inventory,
    attributes,
    abilities: [],
    progression_notes: ''
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
    if (turn.turn_number > 1 && turnData.roll_result && !turnData.roll_result.success && typeof turnData.roll_damage === 'number') {
      character.health = Math.max(0, character.health - turnData.roll_damage);
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
    applyAbilityUpdates(character, turnData, turn.turn_number);

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

  let newCampaignId;
  let newPlayerCharacterId;
  await db.withWriteTransaction(async () => {
    const campaignResult = await db.run(
      `INSERT INTO campaigns (title, genre, summary, current_act, rules_mode) VALUES (?, ?, ?, ?, ?)`,
      [newTitle, campaign.genre, campaign.summary, lastAct, campaign.rules_mode]
    );
    newCampaignId = campaignResult.id;

    const profileResult = await db.run(
      `INSERT INTO player_characters (
        name, archetype, status, active_campaign_id, origin_campaign_id, copied_from_character_id,
        health, max_health, mana, max_mana, xp, level, inventory_json, attributes_json, abilities_json, progression_notes
      ) VALUES (?, ?, 'checked_out', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        character.name,
        character.class,
        newCampaignId,
        newCampaignId,
        characterRow.player_character_id || null,
        character.health,
        character.max_health,
        character.mana,
        character.max_mana,
        character.xp,
        character.level,
        JSON.stringify(character.inventory),
        JSON.stringify(character.attributes),
        JSON.stringify(character.abilities),
        character.progression_notes || ''
      ]
    );
    newPlayerCharacterId = profileResult.id;

    // Outline
    await db.run(
      `INSERT INTO campaign_outlines (campaign_id, outline_json) VALUES (?, ?)`,
      [newCampaignId, JSON.stringify(outline)]
    );

    // Character
    await db.run(
      `INSERT INTO characters (campaign_id, player_character_id, name, class, health, max_health, mana, max_mana, xp, level, inventory_json, attributes_json, abilities_json, progression_notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newCampaignId,
        newPlayerCharacterId,
        character.name,
        character.class,
        character.health,
        character.max_health,
        character.mana,
        character.max_mana,
        character.xp,
        character.level,
        JSON.stringify(character.inventory),
        JSON.stringify(character.attributes),
        JSON.stringify(character.abilities),
        character.progression_notes || ''
      ]
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
      `SELECT * FROM memories 
       WHERE campaign_id = ? 
       AND (turn_number <= ? OR (turn_number IS NULL AND created_at <= ?))`,
      [campaignId, turnNumber, lastTurnTimestamp]
    );
    for (const memory of memoriesToCopy) {
      await db.run(
        `INSERT INTO memories (campaign_id, turn_number, importance, summary, keywords, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [newCampaignId, memory.turn_number, memory.importance, memory.summary, memory.keywords, memory.created_at]
      );
    }
  });

  return getCampaignState(newCampaignId);
}
