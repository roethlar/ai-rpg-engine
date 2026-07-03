import * as db from './db.js';
import { AIClient, resolveAgentConfig } from './api-client.js';
import {
  parseJsonSafe,
  createFallbackSvg,
  validateTurnData,
  validateRequiredChecks,
  rollCheck,
  validateOutlineData,
  forceNoOpTurnState,
  applyCharacterUpdate,
  applyDiceConsequences,
  buildVoiceScript,
  validateRulesetData,
  TABLE_TALK_KINDS
} from './rpg-state.js';
import { assignNpcVoiceProfile } from './tts-providers.js';
import { getGMSystemInstruction } from './rpg-prompts.js';

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
  ruleset
}) {
  // GM omniscience (decision 2026-06-11): the mechanical record — dice rolls, applied
  // damage and its causes — must be visible to the Council on later turns, so the GM
  // can always explain its own mechanics. Legacy roll_result/roll_damage records from
  // pre-refactor campaigns are mapped into the same shape.
  const recentTurns = pastTurns.map(turn => {
    let diceRolls = [];
    try {
      const stateChanges = JSON.parse(turn.state_changes_json || '{}');
      if (Array.isArray(stateChanges.dice_rolls)) {
        diceRolls = stateChanges.dice_rolls;
      } else if (stateChanges.roll_result) {
        diceRolls = [{
          ...stateChanges.roll_result,
          applied_health_change: typeof stateChanges.roll_damage === 'number' ? -stateChanges.roll_damage : 0
        }];
      }
    } catch (e) {}

    return {
      turn_number: turn.turn_number,
      player_action: turn.player_action,
      narrative_excerpt: turn.narrative.substring(0, 700),
      dice_rolls: diceRolls
    };
  });

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
    campaign_rules: ruleset || null
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

async function runMultiAgentTurn({ apiConfig, gmSystem, turnContext, turnPrompt }) {
  const interactionClient = new AIClient(resolveAgentConfig(apiConfig, 'interaction'));
  const continuityClient = new AIClient(resolveAgentConfig(apiConfig, 'continuity'));
  const refereeClient = new AIClient(resolveAgentConfig(apiConfig, 'referee'));
  // Narration is its own role (decision 2026-07-03): the final player-facing
  // voice can run a different (typically stronger prose) model than the
  // classifier. Unconfigured, it inherits the primary config as before.
  const narrationClient = new AIClient(resolveAgentConfig(apiConfig, 'narration'));
  const contextJson = compactJson(turnContext);

  const interactionProposalSystem = `You are the interaction context call for a single-player RPG.
You are extremely conservative and precise when classifying player input.
You interpret the player's exact table input and propose what it means.
You do not advance time, adjudicate outcomes, or write canonical state.
Return JSON only.`;

  const interactionProposalPrompt = `Review this current game context:
${contextJson}

The player input is: "${turnContext.player_input}"

=== CLASSIFICATION RULES (BE VERY STRICT) ===
- "clarification": The player is asking a question, seeking information, checking their situation, or engaging in table-talk. Examples: "Which goblin is closer?", "Can I see the door from here?", "What's the orc carrying?", "How far away is the ledge?", "Do I recognize this symbol?", "What do I know about goblins?", "Can I throw my dagger at it?", "Which way is north?", asking about their own stats/gear/abilities, or any "what/where/can I see" question.
- "dialogue": The player is speaking in-character to an NPC or the world ("I say to the guard...", "I yell at the goblins").
- "committed_action": The player states a clear, immediate intention to do something specific in the fiction right now ("I draw my sword and attack the closest goblin", "I climb the wall", "I cast magic missile at the leader", "I run toward the exit").

When the input is even slightly ambiguous (a question that could lead to an action later), classify as "clarification". A real tabletop GM would answer the question first and let the player decide what to do.

Return JSON matching:
{
  "input_kind": "clarification|dialogue|committed_action",
  "player_intent": "What the player wants from the GM",
  "proposed_action": "The concrete in-fiction action only if one exists, otherwise null",
  "clarification_answer": "Direct answer if this is table-talk or clarification, otherwise null",
  "stakes": "Relevant risks, costs, or uncertainty",
  "suggested_next_actions": ["option 1", "option 2", "option 3"]
}`;

  const interactionProposal = await callJsonAgent(interactionClient, interactionProposalSystem, interactionProposalPrompt, {
    input_kind: 'committed_action',
    player_intent: 'Unable to parse interaction proposal.',
    proposed_action: turnContext.player_input,
    clarification_answer: null,
    stakes: '',
    suggested_next_actions: []
  });

  // 2-call table-talk path: a question or in-character conversation must not cost the
  // full 5-call chain when its state outcome is forced to no-op anyway. The Interaction
  // Agent answered and classified; one independent grounding verifier checks that answer
  // against the campaign record (anti-hallucination) and speaks as the GM.
  if (TABLE_TALK_KINDS.includes(interactionProposal.input_kind)) {
    const kind = interactionProposal.input_kind;
    console.log(`[COUNCIL] Table-talk path (${kind}): 2 calls (interaction + grounding verifier), state forced to no-op.`);

    const verifierSystem = `${gmSystem}

=== GROUNDING VERIFIER CONTEXT CALL ===
You are the single GM voice the player sees, acting as an independent grounding check.
Another context call proposed an answer to the player's table talk. Verify that answer
against the campaign context before speaking it as the GM. Your JSON is the only
response persisted to the database.

VERIFICATION RULES (STRICT):
- Check every factual claim in the proposed answer against the game context: scene,
  NPCs, memories, recent turns, character sheet, inventory, abilities, quest, and rules.
  Correct or drop anything the record does not support. Do not invent new canonical facts.
- If the record cannot answer the question, answer from what the character knows or can
  perceive, or say the character does not know or cannot tell yet. Never break the
  fourth wall or say the GM does not know.
- This is a "${kind}" turn: pure information exchange or in-character conversation.
  Never advance time, resolve actions, spend resources, or change any state.
- Always produce a useful "scene_grounding" so the player understands the current
  physical situation.
- input_kind must be "${kind}". All state update fields must be complete no-ops
  (0 changes, empty arrays, null memory).`;

    const verifierPrompt = `${turnPrompt}

=== INTERACTION PROPOSAL (UNVERIFIED) ===
${compactJson(interactionProposal)}

Verify the proposed answer against the campaign context and produce the final canonical JSON response now. The player must experience one coherent GM, not separate reviewers.`;

    const finalRaw = await continuityClient.sendPrompt({
      systemInstruction: verifierSystem,
      prompt: verifierPrompt,
      jsonMode: true
    });

    try {
      const finalData = parseJsonSafe(finalRaw);
      console.log(`[CLARIFICATION] Table-talk path: forcing strict no-op (${kind}). scene_grounding + direct answer expected from verifier narration.`);
      return JSON.stringify(forceNoOpTurnState(finalData, turnContext, kind));
    } catch (error) {
      return finalRaw;
    }
  }

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

=== REFEREE RULES (STRICT) ===
Your primary job is to prevent the game from feeling like a video game that forces action.

- If the Interaction Proposal has input_kind "clarification" (or the player's words are a question about the current situation), you MUST set:
  * referee_status: "approved" (or "needs_clarification" only if the question is impossible to answer)
  * input_kind: "clarification"
  * approved_state_policy: "none"
  * All allowed_*_update fields must be complete no-ops (0 changes, empty arrays)
- A clarification turn is pure information exchange. The player is trying to understand the scene so they can make a good decision later. This is normal and desirable tabletop play.
- Only treat something as "committed_action" if the player has clearly stated an immediate intention to do a specific thing.

=== DICE & CHECKS (rules_mode for this campaign: ${turnContext.campaign.rules_mode}) ===
Dice are a service you order for the table, not a tax on acting. The engine rolls; you adjudicate.
- Your FIRST decision is WHETHER a check is warranted at all. Trivial, safe, or routine actions — walking somewhere, talking, looking around, cautious movement with no active threat, using an obviously suitable tool — require NO check. Most turns require no check.
- Require a check only when the action has genuine uncertainty AND meaningful stakes (something is risked by failure).
- required_checks must be [] when: rules_mode is false, the action is denied or needs clarification, input_kind is not committed_action, or the action simply doesn't warrant one.
- For each required check YOU decide the attribute, the DC (5 easy – 25 near-impossible), why it is needed, and the concrete failure consequence under this campaign's rules and fiction. health_change/mana_change are 0 or negative; 0 is legitimate — failure can be purely narrative (noticed, blocked, lost time).

Return JSON matching:
{
  "referee_status": "approved|denied|needs_clarification",
  "input_kind": "clarification|dialogue|committed_action",
  "ruling": "The fair outcome or reason for denial",
  "required_checks": [
    {
      "attribute": "strength|agility|intellect|willpower",
      "dc": 12,
      "reason": "Why this check is warranted and what is at stake",
      "failure_consequence": { "description": "What concretely goes wrong on failure", "health_change": 0, "mana_change": 0 }
    }
  ],
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

For clarification, denial, or needs_clarification, approved_state_policy must be "none" and all state changes must be no-op values. The final narration will still give the player a rich answer and scene_grounding on clarification turns.`;

  const refereeDecision = await callJsonAgent(refereeClient, refereeSystem, refereePrompt, {
    referee_status: 'needs_clarification',
    input_kind: interactionProposal.input_kind || 'clarification',
    ruling: 'Unable to parse referee decision.',
    required_checks: [],
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

  // Dice before narration (approved refactor, plan.md): the referee ordered the
  // checks; the engine rolls them now, deterministically in code, so every later
  // call — final continuity and narration — works from resolved facts. Denied or
  // reclassified actions get no rolls, so they can never take roll damage.
  let diceRolls = [];
  const rollsWarranted = turnContext.campaign.rules_mode &&
    refereeDecision.referee_status === 'approved' &&
    refereeDecision.input_kind === 'committed_action';
  if (rollsWarranted) {
    const checks = validateRequiredChecks(refereeDecision.required_checks);
    diceRolls = checks.map(check => rollCheck(turnContext.character, check));
    for (const record of diceRolls) {
      console.log(`[DICE] ${record.attribute} check (${record.reason || 'no reason given'}): ${record.total} vs DC ${record.dc} → ${record.success ? 'success' : `FAILURE (${record.applied_health_change} HP, ${record.applied_mana_change} MP)`}`);
    }
  }

  const diceResultsSection = `=== DICE RESULTS (ENGINE-ROLLED, ALREADY FINAL) ===
${diceRolls.length > 0 ? compactJson(diceRolls) : 'No checks were required this turn.'}`;

  const continuityFinalSystem = `You are the final continuity context call for a persistent single-player RPG.
You receive the referee decision and the engine-rolled dice results, perform a final consistency check, and prepare archive notes.
Dice results are already final: do not re-roll, reinterpret, or contradict them.
You do not narrate to the player. Return JSON only.`;

  const continuityFinalPrompt = `Review this current game context:
${contextJson}

=== INTERACTION PROPOSAL ===
${compactJson(interactionProposal)}

=== CONTINUITY REVIEW ===
${compactJson(continuityReview)}

=== REFEREE DECISION ===
${compactJson(refereeDecision)}

${diceResultsSection}

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

  const finalInteractionSystem = `${gmSystem}

=== FINAL INTERACTION CONTEXT CALL ===
You are the single GM voice the player sees.
You must relay the final approved result in in-world terms while preserving the referee and continuity decisions.
You are the last context call, and your JSON is the only response persisted to the database.

CLARIFICATION BEHAVIOR (VERY IMPORTANT):
- If final_input_kind is "clarification", you are answering a question or providing scene information.
- Write like a good tabletop GM: clear, direct, atmospheric, and informative.
- Always produce a useful "scene_grounding" field so the player understands the current physical situation.
- Never advance time or apply state changes on clarification turns.

If final_status is denied or needs_clarification, explain the issue in-world and set all state changes to no-op values.
If final_input_kind is clarification or dialogue, answer directly and set all state changes to no-op values.
If final_input_kind is committed_action, include only state changes approved by the referee and final continuity check.

DICE RESULTS (VERY IMPORTANT):
- Any dice results provided are already rolled and final, and their failure consequences (HP/mana costs) are applied mechanically by the engine.
- Narrate so the prose matches each result exactly: successes succeed, failures fail, and the stated consequence is what goes wrong.
- Do NOT add the consequence again to character_update — the engine already applies it. Do not invent extra rolls, damage, or costs beyond the results given.`;

  const finalInteractionPrompt = `${turnPrompt}

=== INTERACTION PROPOSAL ===
${compactJson(interactionProposal)}

=== CONTINUITY REVIEW ===
${compactJson(continuityReview)}

=== REFEREE DECISION ===
${compactJson(refereeDecision)}

=== FINAL CONTINUITY CHECK AND ARCHIVE NOTES ===
${compactJson(continuityFinal)}

${diceResultsSection}

Produce the final canonical JSON response now. The player must experience one coherent GM, not separate reviewers.`;

  const finalRaw = await narrationClient.sendPrompt({
    systemInstruction: finalInteractionSystem,
    prompt: finalInteractionPrompt,
    jsonMode: true
  });

  try {
    const finalData = parseJsonSafe(finalRaw);
    // The engine's roll records are canonical; whatever the narrator emitted is discarded.
    finalData.dice_rolls = diceRolls;
    const noStateChange = continuityFinal.final_status !== 'approved' ||
      TABLE_TALK_KINDS.includes(continuityFinal.final_input_kind) ||
      continuityFinal.state_change_policy === 'none' ||
      refereeDecision.referee_status !== 'approved';

    if (noStateChange) {
      console.log('[CLARIFICATION] Council path: noStateChange true (table talk, denial, or policy=none) — forcing strict no-op. scene_grounding + direct answer expected from final narration.');
      forceNoOpTurnState(
        finalData,
        turnContext,
        continuityFinal.final_input_kind || refereeDecision.input_kind || 'clarification'
      );
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
  rulesMode = false,
  ruleset = 'house'
}) {
  // Setup is its own role (decision 2026-07-03): the campaign outline and
  // opening scene are the highest-leverage calls and can run the strongest
  // model. Unconfigured, it inherits the primary config as before.
  const client = new AIClient(resolveAgentConfig(apiConfig, 'setup'));
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

  const outlineSystem = `You are a legendary RPG game designer and Game Master.
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

  // Ruleset as canon campaign state (decision 2026-07-03): generated once at
  // creation by the Setup role, stored, and injected into every turn.
  let rulesetData = null;
  if (ruleset === 'house') {
    const rulesetSystem = `You design a compact, self-consistent rule sheet for a tabletop RPG campaign.
The engine already resolves risky actions with a d20 + attribute modifier (strength/agility/intellect/willpower; modifier = floor((score - 10) / 2)) against a difficulty class from 5 (easy) to 25 (near-impossible), and failed checks have referee-adjudicated consequences. Advancement: level = floor(XP / 100) + 1; leveling fully restores and raises maximums.
Your job is the campaign-specific layer on top. Return JSON ONLY matching:
{
  "name": "Short ruleset name themed to this campaign",
  "resolution": "One-paragraph player-facing summary of how checks work, restating the engine mechanics above in the campaign's voice",
  "abilities": [
    { "name": "Ability or spell name", "cost": "e.g. 5 mana / free / once per scene", "effect": "What it does in fiction and in checks", "limits": "Constraints, cooldowns, requirements" }
  ],
  "notes": "House rules for resources, recovery, and anything genre-specific a referee needs to apply these identically every time"
}
Give the player character 4 to 8 starting abilities fitting their concept and the genre. Every rule must be concrete enough that a referee applies it the same way every turn.`;

    console.log('Generating campaign ruleset...');
    try {
      const rulesetResponse = await client.sendPrompt({
        systemInstruction: rulesetSystem,
        prompt: `Campaign genre: "${genre}". Campaign title: "${outline.title}". Setting: ${outline.setting}\nPlayer character: ${resolvedCharacterName}, concept: "${resolvedCharacterArchetype}".`,
        jsonMode: true
      });
      rulesetData = validateRulesetData(parseJsonSafe(rulesetResponse));
    } catch (error) {
      // A campaign without a rule sheet is playable (freeform); creation must not fail on this call.
      console.warn(`Ruleset generation failed (continuing freeform): ${error.message}`);
    }
  }
  
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
  const gmSystem = getGMSystemInstruction(outline, {
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
  }, npcList, 1, rulesetData);

  const turn1Prompt = `Set the scene and begin the campaign.
Start the story at the beginning of Act I. Introduce the starting quest: "${outline.starting_quest.title}".
Describe the starting location, atmosphere, and initial situation in rich detail. Provide a clear "scene_grounding" describing positions, distances, lighting, and what the character can immediately perceive.
If you introduce any of the NPCs now, write them fully in character with their described personality and quirks.
Output the JSON object containing the opening narrative, scene_grounding, suggested choices, state updates, and an SVG illustration of the scene.`;

  console.log(`Generating opening turn for campaign...`);
  const turn1Response = await client.sendPrompt({
    systemInstruction: gmSystem,
    prompt: turn1Prompt,
    jsonMode: true
  });

  const parsedRaw = parseJsonSafe(turn1Response);
  // The opening turn has no player input to classify. If the model labels it
  // 'clarification' (the prompts bias toward that on any doubt), the validator's
  // clarification safety net would silently wipe the starting state — gear grants,
  // NPC notes, opening memory. GM scene-setting narration is 'dialogue'.
  if (parsedRaw && typeof parsedRaw === 'object') {
    parsedRaw.input_kind = 'dialogue';
  }
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
  const turn1Level = applyCharacterUpdate(character, turnData.character_update);
  if (turn1Level.leveledUp) {
    turnData.narrative += `\n\n🎉 **LEVEL UP! You have reached Level ${character.level}! Your maximum Health and Mana have increased!**`;
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
      `INSERT INTO campaigns (title, genre, summary, current_act, rules_mode, ruleset_json) VALUES (?, ?, ?, 1, ?, ?)`,
      [outline.title, genre, outline.setting, rulesModeInt, rulesetData ? JSON.stringify(rulesetData) : null]
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
    for (const [npcIndex, npc] of npcList.entries()) {
      // Sticky voice identity (Phase 2): assigned once at creation, stored as state.
      await db.run(
        `INSERT INTO npcs (campaign_id, name, role, personality, quirks, relationship_value, notes, status, voice_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [campaignId, npc.name, npc.role, npc.personality, npc.quirks, npc.relationship_value, npc.notes, npc.status,
         JSON.stringify(assignNpcVoiceProfile(npc, npcIndex))]
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
    ruleset: rulesetData,
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
      sceneGrounding: turnData.scene_grounding || null,
      svg,
      suggestedChoices: turnData.suggested_choices || [],
      rollResults: [],
      voiceLines: buildVoiceScript(turnData.narration_lines, finalNpcList),
      inputKind: turnData.input_kind || 'dialogue'
    }
  };
}

export async function takeTurn(campaignId, playerAction, apiConfig) {
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

  // Rules-mode checks are adjudicated by the Referee and rolled by the engine inside
  // the Council pipeline (dice before narration); this function only applies the
  // resulting consequences to character state.
  const finalPlayerAction = playerAction;

  // 2. Build the context prompt
  const rulesetData = validateRulesetData(parseJsonObject(campaign.ruleset_json, null));
  const gmSystem = getGMSystemInstruction(outline, character, npcs, currentAct, rulesetData);

  let historyPrompt = `=== CAMPAIGN HISTORY ===\n`;
  if (memories.length > 0) {
    historyPrompt += `Summary of key past events:\n` + memories.map(m => `- [Importance ${m.importance}] ${m.summary}`).join('\n') + `\n\n`;
  }
  historyPrompt += `Last active turns:\n`;
  pastTurns.forEach(turn => {
    if (turn.player_action) {
      historyPrompt += `> PLAYER: ${turn.player_action}\n`;
    }
    historyPrompt += `> GM: ${turn.narrative.substring(0, 500)}...\n`;
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

=== FINAL RESPONSE RULES ===
First decide input_kind:
- "clarification" — player asked a question or wants to understand the current situation better. Answer fully and naturally. Provide rich "scene_grounding".
- "dialogue" — player is talking to someone.
- "committed_action" — player has clearly stated they are doing something specific right now.

CRITICAL FOR CLARIFICATION TURNS:
- Speak like a patient, helpful tabletop GM at the table.
- Give a direct, informative answer in the "narrative" field.
- Always include a detailed "scene_grounding" so the player has a clear mental picture (positions, distances, cover, lighting, what they can and cannot see).
- Do not describe the player doing anything. Do not resolve any action. Do not advance the clock.
- End by giving the player good information and 2–4 natural things they could choose to do next (suggested_choices). Do not pressure them.

For committed_action turns, write vivid narrative of what happens as a result.

Output the JSON object containing the narrative response, scene_grounding, suggested_choices, player state updates, active quest, any NPC updates, and an svg_illustration of the current scene.`;

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
    ruleset: rulesetData
  });
  const aiResponse = await runMultiAgentTurn({ apiConfig, gmSystem, turnContext, turnPrompt });

  const parsedRaw = parseJsonSafe(aiResponse);
  const turnData = validateTurnData(parsedRaw, currentAct);

  // Decision 2026-06-05: dialogue is table talk too — no state mutation. The opening
  // turn (pinned to 'dialogue' in createCampaign so starting state survives the
  // validator net) never passes through takeTurn, so this backstop cannot wipe it.
  if (turnData.input_kind === 'clarification' || turnData.input_kind === 'dialogue') {
    console.log(`[CLARIFICATION] Engine backstop: forcing strict no-op on ${turnData.input_kind} turn (character/quest/ability/NPC/memory cleared, no dice). scene_grounding + narrative answer preserved for tabletop-style table talk.`);
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
    turnData.dice_rolls = [];
  }

  // Dice results are referee-adjudicated and engine-rolled inside the Council pipeline;
  // the narration was written from them. The engine applies the adjudicated failure
  // consequences carried on each roll record — no hardcoded penalties.
  const diceRolls = Array.isArray(turnData.dice_rolls) ? turnData.dice_rolls : [];
  applyDiceConsequences(character, diceRolls);

  // Apply state updates (health/mana clamps, XP with unified level-up, inventory)
  const turnLevel = applyCharacterUpdate(character, turnData.character_update);
  if (turnLevel.leveledUp) {
    turnData.narrative += `\n\n🎉 **LEVEL UP! You have reached Level ${character.level}! Your maximum Health and Mana have increased!**`;
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
    ruleset: rulesetData,
    turn: {
      number: currentTurnNumber,
      playerAction,
      inputKind: turnData.input_kind,
      narrative: turnData.narrative,
      sceneGrounding: turnData.scene_grounding || null,
      svg,
      suggestedChoices: turnData.suggested_choices || [],
      rollResults: diceRolls,
      voiceLines: buildVoiceScript(turnData.narration_lines, updatedNpcs)
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
  let rollResults = [];
  let inputKind = 'committed_action';
  let lastTurnData = null;

  if (lastTurn) {
    try {
      lastTurnData = JSON.parse(lastTurn.state_changes_json || '{}');
      if (lastTurnData.quest_update?.active_quest) {
        activeQuestName = lastTurnData.quest_update.active_quest;
        activeQuestDesc = lastTurnData.quest_update.quest_description || '';
      }
      suggestedChoices = lastTurnData.suggested_choices || [];
      if (Array.isArray(lastTurnData.dice_rolls) && lastTurnData.dice_rolls.length > 0) {
        rollResults = lastTurnData.dice_rolls;
      } else if (lastTurnData.roll_result) {
        // Legacy pre-refactor turn record
        rollResults = [lastTurnData.roll_result];
      }
      inputKind = lastTurnData.input_kind || inputKind;
    } catch(e) {}
  }

  return {
    campaignId,
    title: campaign.title,
    genre: campaign.genre,
    setting: campaign.summary,
    themeColors: outline.theme_colors,
    rulesMode: !!campaign.rules_mode,
    ruleset: validateRulesetData(parseJsonObject(campaign.ruleset_json, null)),
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
      sceneGrounding: lastTurnData ? lastTurnData.scene_grounding || null : null,
      svg: lastTurn ? lastTurn.svg_illustration : createFallbackSvg(campaign.title),
      suggestedChoices,
      rollResults
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

    // Replay the turn's character update (health/mana/XP/level-up/inventory)
    applyCharacterUpdate(character, turnData.character_update);

    // Applying failed roll penalty if turn is not the first one and a failed roll is logged in state changes
    // (legacy pre-refactor turn records)
    if (turn.turn_number > 1 && turnData.roll_result && !turnData.roll_result.success && typeof turnData.roll_damage === 'number') {
      character.health = Math.max(0, character.health - turnData.roll_damage);
    }

    // Replay referee-adjudicated dice consequences (dice-before-narration turn records)
    if (turn.turn_number > 1) {
      applyDiceConsequences(character, turnData.dice_rolls);
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
      `INSERT INTO campaigns (title, genre, summary, current_act, rules_mode, ruleset_json) VALUES (?, ?, ?, ?, ?, ?)`,
      [newTitle, campaign.genre, campaign.summary, lastAct, campaign.rules_mode, campaign.ruleset_json || null]
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
    for (const [npcIndex, npc] of npcs.entries()) {
      await db.run(
        `INSERT INTO npcs (campaign_id, name, role, personality, quirks, relationship_value, notes, status, voice_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newCampaignId, npc.name, npc.role, npc.personality, npc.quirks, npc.relationship_value, npc.notes, npc.status,
         JSON.stringify(assignNpcVoiceProfile(npc, npcIndex))]
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
