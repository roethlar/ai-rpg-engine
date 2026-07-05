import assert from 'assert';
import { parseJsonSafe, validateTurnData, validateRequiredChecks, rollCheck, forceNoOpTurnState, applyCharacterUpdate, applyDiceConsequences, buildVoiceScript, TABLE_TALK_KINDS } from './rpg-state.js';
import { AIClient, resolveAgentConfig, isTransientAiError } from './api-client.js';

console.log('🧪 Starting Aetheria RPG Engine tests...');

// -------------------------------------------------------------
// Test 1: parseJsonSafe
// -------------------------------------------------------------
function testParseJsonSafe() {
  console.log(' - Running parseJsonSafe tests...');
  
  const rawJson = '{"test": 123}';
  const parsed1 = parseJsonSafe(rawJson);
  assert.strictEqual(parsed1.test, 123, 'Should parse raw JSON');

  const fencedJson = '```json\n{"test": 456}\n```';
  const parsed2 = parseJsonSafe(fencedJson);
  assert.strictEqual(parsed2.test, 456, 'Should parse fenced JSON');

  const tickedJson = '```\n{"test": 789}\n```';
  const parsed3 = parseJsonSafe(tickedJson);
  assert.strictEqual(parsed3.test, 789, 'Should parse ticked JSON');

  const textWithJson = 'Here is the response: {"test": "ok"} hope it works.';
  const parsed4 = parseJsonSafe(textWithJson);
  assert.strictEqual(parsed4.test, 'ok', 'Should extract JSON from surrounding text');
}

// -------------------------------------------------------------
// Test 2: Level-Up Math Formula
// -------------------------------------------------------------
function testLevelUpMath() {
  console.log(' - Running level-up math tests...');

  const levels = [
    { xp: 0, level: 1 },
    { xp: 50, level: 1 },
    { xp: 99, level: 1 },
    { xp: 100, level: 2 },
    { xp: 150, level: 2 },
    { xp: 200, level: 3 },
    { xp: 1050, level: 11 }
  ];

  levels.forEach(testCase => {
    const computed = Math.floor(testCase.xp / 100) + 1;
    assert.strictEqual(
      computed, 
      testCase.level, 
      `XP ${testCase.xp} should evaluate to Level ${testCase.level} (got ${computed})`
    );
  });
}

// -------------------------------------------------------------
// Test 3: production SSRF Endpoint Protection
// -------------------------------------------------------------
function testProductionSsrfBlock() {
  console.log(' - Running production SSRF endpoint validation tests...');
  
  const oldNodeEnv = process.env.NODE_ENV;
  const oldCustomUrl = process.env.CUSTOM_ENDPOINT_URL;
  const oldOllamaUrl = process.env.OLLAMA_URL;

  process.env.NODE_ENV = 'production';
  process.env.CUSTOM_ENDPOINT_URL = 'https://api.openai.com/v1';
  process.env.OLLAMA_URL = 'http://trusted-ollama.internal:11434';
  
  const client = new AIClient({
    baseUrl: 'http://malicious-local-address.internal/endpoint',
    ollamaUrl: 'http://localhost:11434'
  });
  
  // Assert client ignores overrides in production
  assert.strictEqual(client.baseUrl, 'https://api.openai.com/v1', 'Should ignore custom baseUrl override in production');
  assert.strictEqual(client.ollamaUrl, 'http://trusted-ollama.internal:11434', 'Should ignore custom ollamaUrl override in production');

  // Reset env
  // Assigning undefined to process.env coerces to the string "undefined" — delete instead.
  if (oldNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oldNodeEnv;
  if (oldCustomUrl === undefined) delete process.env.CUSTOM_ENDPOINT_URL; else process.env.CUSTOM_ENDPOINT_URL = oldCustomUrl;
  if (oldOllamaUrl === undefined) delete process.env.OLLAMA_URL; else process.env.OLLAMA_URL = oldOllamaUrl;
}

// -------------------------------------------------------------
// Test 4: JSON Schema Validation & Clamping
// -------------------------------------------------------------
function testJsonSchemaValidation() {
  console.log(' - Running JSON response validation and clamping tests...');
  
  const malformedData = {
    input_kind: 'committed_action', // use non-clarification so clamping assertions run
    narrative: '  A quiet clearing. ',
    suggested_choices: [' choice 1', null, ''],
    character_update: {
      health_change: 250, // out of bounds
      mana_change: -150,  // out of bounds
      xp_gain: -30,       // invalid negative XP
      inventory_changes: [
        {
          action: 'add',
          item: { name: 'Dagger', type: 'weapon', quantity: -5 } // negative quantity
        }
      ]
    },
    quest_update: {
      active_quest: 'Solve the riddle',
      current_act: 5 // invalid act
    },
    npc_updates: [
      { name: 'Garrick', relationship_change: 99, status: 'unknown' } // invalid values
    ],
    ability_updates: [
      {
        action: 'add',
        ability: {
          name: '  Neural Splice  ',
          description: '  Interfaces with damaged machine minds. ',
          tier: '',
          source: 'dockside clinic'
        },
        note: 'Earned by repairing the courier drone.'
      },
      {
        action: 'learn',
        ability: { name: 'Invalid Action' }
      },
      {
        action: 'add',
        ability: { description: 'Missing name' }
      }
    ]
  };

  const clean = validateTurnData(malformedData, 2);

  assert.strictEqual(clean.input_kind, 'committed_action', 'Should preserve valid input_kind');
  assert.strictEqual(clean.narrative, 'A quiet clearing.', 'Should trim narrative');
  assert.deepStrictEqual(clean.suggested_choices, ['choice 1'], 'Should filter empty or null choices');
  assert.strictEqual(clean.character_update.health_change, 100, 'Should clamp health_change to 100 max');
  assert.strictEqual(clean.character_update.mana_change, -100, 'Should clamp mana_change to -100 min');
  assert.strictEqual(clean.character_update.xp_gain, 0, 'Should replace negative XP gain with 0');
  
  const invChange = clean.character_update.inventory_changes[0];
  assert.strictEqual(invChange.action, 'add', 'Should keep action');
  assert.strictEqual(invChange.item.name, 'Dagger', 'Should keep item name');
  assert.strictEqual(invChange.item.quantity, 1, 'Should fallback negative quantity to 1');
  
  assert.strictEqual(clean.quest_update.current_act, 2, 'Should fallback invalid act to currentAct (2)');
  
  const npcUp = clean.npc_updates[0];
  assert.strictEqual(npcUp.relationship_change, 50, 'Should clamp npc relationship_change to 50 max');
  assert.strictEqual(npcUp.status, 'alive', 'Should fallback invalid status to alive');

  // Phase 0: clarification safety net in validateTurnData — even wild state must be forced to no-op
  const clarificationInput = {
    input_kind: 'clarification',
    narrative: 'The left goblin is closer, about 10 feet, with a rusty axe.',
    scene_grounding: 'Two goblins near the cart. Left one 10 ft, right one 20 ft back by the door.',
    suggested_choices: ['Attack the closer goblin', 'Duck behind crates'],
    character_update: { health_change: 50, mana_change: -20, xp_gain: 25, inventory_changes: [{ action: 'add', item: { name: 'Sword' } }] },
    quest_update: { active_quest: 'Kill all goblins', current_act: 2 },
    ability_updates: [{ action: 'add', ability: { name: 'Super Power' } }],
    npc_updates: [{ name: 'Goblin', relationship_change: -10 }],
    memory_summary: 'We fought',
    dice_rolls: [{ type: 'attack', total: 17 }]
  };
  const clar = validateTurnData(clarificationInput, 1);
  assert.strictEqual(clar.input_kind, 'clarification');
  assert.strictEqual(clar.scene_grounding, 'Two goblins near the cart. Left one 10 ft, right one 20 ft back by the door.');
  assert.strictEqual(clar.character_update.health_change, 0);
  assert.strictEqual(clar.character_update.xp_gain, 0);
  assert.deepStrictEqual(clar.ability_updates, []);
  assert.deepStrictEqual(clar.npc_updates, []);
  assert.strictEqual(clar.memory_summary, null);
  assert.deepStrictEqual(clar.dice_rolls, [], 'Safety net must explicitly clear dice_rolls on clarification turns');
  assert.strictEqual(clar.quest_update.active_quest, 'Kill all goblins'); // quest text passthrough is corrected engine-side from DB truth
  assert.strictEqual(clar.quest_update.current_act, 1, 'Clarification must not advance the act even if the model says otherwise');

  assert.strictEqual(clean.ability_updates.length, 1, 'Should keep only valid ability updates');
  assert.strictEqual(clean.ability_updates[0].ability.name, 'Neural Splice', 'Should trim ability names');
  assert.strictEqual(clean.ability_updates[0].ability.tier, 'emerging', 'Should default empty ability tier');

  const invalidKind = validateTurnData({ input_kind: 'monologue' }, 1);
  assert.strictEqual(invalidKind.input_kind, 'committed_action', 'Should default invalid input_kind');
}

// -------------------------------------------------------------
// Test: table-talk no-op forcing (Council 2-call path + full-chain forcing)
// -------------------------------------------------------------
function testForceNoOpTurnState() {
  console.log(' - Running table-talk no-op forcing tests...');

  assert.deepStrictEqual(TABLE_TALK_KINDS, ['clarification', 'dialogue'],
    'Table talk is exactly clarification and dialogue (decision 2026-06-05)');

  const turnContext = {
    active_quest: { title: 'Find the Heir', description: 'Search the lower city.' },
    campaign: { current_act: 2 }
  };

  for (const kind of TABLE_TALK_KINDS) {
    const dirty = {
      input_kind: 'committed_action',
      narrative: 'The guard glares at you.',
      scene_grounding: 'The guard stands three paces away, hand on his sword.',
      character_update: { health_change: -12, mana_change: 5, xp_gain: 20, inventory_changes: [{ action: 'add', item: { name: 'Bribe pouch' } }] },
      quest_update: { active_quest: 'Model-invented quest', quest_description: 'Wrong', current_act: 3 },
      ability_updates: [{ action: 'add', ability: { name: 'Silver Tongue' } }],
      npc_updates: [{ name: 'Guard', relationship_change: -20 }],
      memory_summary: 'You argued with the guard.',
      memory_keywords: 'guard, argument',
      dice_rolls: [{ attribute: 'willpower', total: 14 }]
    };

    const forced = forceNoOpTurnState(dirty, turnContext, kind);
    assert.strictEqual(forced, dirty, 'Should mutate and return the same object');
    assert.strictEqual(forced.input_kind, kind);
    assert.deepStrictEqual(forced.character_update, { health_change: 0, mana_change: 0, xp_gain: 0, inventory_changes: [] });
    assert.deepStrictEqual(forced.quest_update, {
      active_quest: 'Find the Heir',
      quest_description: 'Search the lower city.',
      current_act: 2
    }, 'Quest must be reset from turnContext (DB truth), never model output');
    assert.deepStrictEqual(forced.ability_updates, []);
    assert.deepStrictEqual(forced.npc_updates, []);
    assert.strictEqual(forced.memory_summary, null);
    assert.strictEqual(forced.memory_keywords, '');
    assert.deepStrictEqual(forced.dice_rolls, []);
    assert.strictEqual(forced.narrative, 'The guard glares at you.', 'Narrative must survive the forcing');
    assert.strictEqual(forced.scene_grounding, 'The guard stands three paces away, hand on his sword.', 'Scene grounding must survive the forcing');
  }

  // The validator net stays clarification-only: the opening turn is pinned to
  // 'dialogue' in createCampaign precisely so starting state (gear grants, NPC
  // notes, opening memory) survives validateTurnData. Dialogue no-op enforcement
  // happens in the engine (takeTurn backstop + Council paths), never here.
  const openingTurn = validateTurnData({
    input_kind: 'dialogue',
    narrative: 'You awaken in the caravan.',
    character_update: { health_change: 0, mana_change: 0, xp_gain: 0, inventory_changes: [{ action: 'add', item: { name: 'Rusty Lantern' } }] },
    memory_summary: 'The journey began.',
    npc_updates: [{ name: 'Caravan Master', relationship_change: 5 }]
  }, 1);
  assert.strictEqual(openingTurn.character_update.inventory_changes.length, 1, 'validateTurnData must NOT wipe dialogue turns (opening-turn starting state)');
  assert.strictEqual(openingTurn.memory_summary, 'The journey began.', 'validateTurnData must preserve dialogue memory (engine backstop owns dialogue no-op)');
  assert.strictEqual(openingTurn.npc_updates.length, 1, 'validateTurnData must preserve dialogue NPC updates');
}

// -------------------------------------------------------------
// Test: character update application (shared by turns, creation, fork replay)
// -------------------------------------------------------------
function testApplyCharacterUpdate() {
  console.log(' - Running character update application tests...');

  const char = () => ({
    health: 60, max_health: 100, mana: 30, max_mana: 50, xp: 80, level: 1,
    inventory: [{ name: 'Recovery Patch', type: 'consumable', quantity: 2 }]
  });

  // Clamping both directions
  const clampChar = char();
  applyCharacterUpdate(clampChar, { health_change: 90, mana_change: -80 });
  assert.strictEqual(clampChar.health, 100, 'Health must clamp at max_health');
  assert.strictEqual(clampChar.mana, 0, 'Mana must floor at 0');

  // Level-up: xp 80 + 40 = 120 → level 2, maxes grow, full refill
  const levelChar = char();
  const result = applyCharacterUpdate(levelChar, { xp_gain: 40 });
  assert.deepStrictEqual(result, { leveledUp: true, levelsGained: 1 });
  assert.strictEqual(levelChar.level, 2);
  assert.strictEqual(levelChar.max_health, 115, 'Level-up grants +15 max HP');
  assert.strictEqual(levelChar.health, 115, 'Level-up fully heals');
  assert.strictEqual(levelChar.max_mana, 60, 'Level-up grants +10 max mana');
  assert.strictEqual(levelChar.mana, 60, 'Level-up fully refills mana');

  const noLevel = applyCharacterUpdate(char(), { xp_gain: 10 });
  assert.deepStrictEqual(noLevel, { leveledUp: false, levelsGained: 0 });

  // Inventory: stack, use down to removal, add new
  const invChar = char();
  applyCharacterUpdate(invChar, { inventory_changes: [
    { action: 'add', item: { name: 'Recovery Patch', quantity: 3 } },
    { action: 'use', item: { name: 'Recovery Patch' } },
    { action: 'add', item: { name: 'Neon Blade', type: 'weapon' } }
  ]});
  assert.strictEqual(invChar.inventory.find(i => i.name === 'Recovery Patch').quantity, 4, 'Stacks then uses one');
  assert.strictEqual(invChar.inventory.find(i => i.name === 'Neon Blade').quantity, 1, 'New items default to qty 1');

  const drainChar = char();
  applyCharacterUpdate(drainChar, { inventory_changes: [
    { action: 'use', item: { name: 'Recovery Patch' } },
    { action: 'use', item: { name: 'Recovery Patch' } }
  ]});
  assert.strictEqual(drainChar.inventory.length, 0, 'Using the last unit removes the item');

  // Dice consequences: failures apply, successes do not, floors at 0
  const diceChar = char();
  applyDiceConsequences(diceChar, [
    { success: true, applied_health_change: -50, applied_mana_change: -50 },
    { success: false, applied_health_change: -8, applied_mana_change: -3 },
    { success: false, applied_health_change: -999, applied_mana_change: 0 }
  ]);
  assert.strictEqual(diceChar.health, 0, 'Failed-check damage applies and floors at 0 (successes ignored)');
  assert.strictEqual(diceChar.mana, 27, 'Failed-check mana cost applies');
  applyDiceConsequences(diceChar, null); // must not throw
}

// -------------------------------------------------------------
// Test 5: Referee-adjudicated dice — check validation & roll math
// -------------------------------------------------------------
function testRefereeDiceFlow() {
  console.log(' - Running referee-adjudicated dice check tests...');

  // validateRequiredChecks: sanitize the referee's output
  const rawChecks = [
    { attribute: 'agility', dc: 14, reason: 'Leap the chasm', failure_consequence: { description: 'You fall onto the rocks', health_change: -8, mana_change: 0 } },
    { attribute: 'luck', dc: 10 },                                            // invalid attribute → dropped
    { attribute: 'strength', dc: 99, failure_consequence: { health_change: -200, mana_change: 5 } }, // clamped
    { attribute: 'intellect' },                                               // missing dc → default
    { attribute: 'willpower', dc: 12 },                                       // over the 3-check cap → dropped
    { attribute: 'agility', dc: 12 }
  ];
  const checks = validateRequiredChecks(rawChecks);
  assert.strictEqual(checks.length, 3, 'Should cap checks at 3 per turn and drop invalid attributes');
  assert.strictEqual(checks[0].attribute, 'agility');
  assert.strictEqual(checks[0].failure_consequence.health_change, -8);
  assert.strictEqual(checks[1].dc, 25, 'Should clamp DC to 25 max');
  assert.strictEqual(checks[1].failure_consequence.health_change, -50, 'Should clamp failure damage to -50');
  assert.strictEqual(checks[1].failure_consequence.mana_change, 0, 'Positive mana consequence must clamp to 0 (consequences are costs)');
  assert.strictEqual(checks[2].dc, 12, 'Missing DC should default to 12');
  assert.deepStrictEqual(validateRequiredChecks(null), [], 'Non-array input yields no checks');
  assert.deepStrictEqual(validateRequiredChecks('roll everything'), [], 'Garbage input yields no checks');

  // rollCheck: d20 math and consequence application
  const mockChar = { attributes: { strength: 14, agility: 8, intellect: 20, willpower: 10 } };

  // Guaranteed failure: AGI 8 → mod -1, max total 19 < DC 25
  const fail = rollCheck(mockChar, {
    attribute: 'agility', dc: 25, reason: 'Impossible leap',
    failure_consequence: { description: 'You fall', health_change: -8, mana_change: -3 }
  });
  assert.strictEqual(fail.modifier, -1, 'AGI 8 modifier should be -1');
  assert.strictEqual(fail.total, fail.roll + fail.modifier, 'Total must equal roll + modifier');
  assert.strictEqual(fail.success, false, 'Total 19 max cannot beat DC 25');
  assert.strictEqual(fail.applied_health_change, -8, 'Failed check must carry the adjudicated HP consequence');
  assert.strictEqual(fail.applied_mana_change, -3, 'Failed check must carry the adjudicated mana consequence');
  assert.strictEqual(fail.consequence, 'You fall');

  // Guaranteed success: INT 20 → mod +5, min total 6 >= DC 5
  const succeed = rollCheck(mockChar, {
    attribute: 'intellect', dc: 5, reason: 'Trivial recall',
    failure_consequence: { description: 'Forgotten', health_change: -10, mana_change: -5 }
  });
  assert.strictEqual(succeed.modifier, 5, 'INT 20 modifier should be +5');
  assert.strictEqual(succeed.success, true, 'Min total 6 always beats DC 5');
  assert.strictEqual(succeed.applied_health_change, 0, 'Successful check must apply no consequence');
  assert.strictEqual(succeed.applied_mana_change, 0, 'Successful check must apply no consequence');

  // validateTurnData: dice roll records survive on committed_action, are wiped on clarification
  const withRolls = validateTurnData({
    input_kind: 'committed_action',
    narrative: 'You leap.',
    dice_rolls: [
      { attribute: 'agility', roll: 4, modifier: -1, total: 3, dc: 14, success: false, reason: 'Leap', consequence: 'Fall', applied_health_change: -8, applied_mana_change: 0 },
      { attribute: 'strength', total: 'NaN', dc: 10 },  // malformed → dropped
      { attribute: 'strength', total: 15, dc: 10, success: true, applied_health_change: -99 } // clamped
    ]
  }, 1);
  assert.strictEqual(withRolls.dice_rolls.length, 2, 'Malformed roll records must be dropped');
  assert.strictEqual(withRolls.dice_rolls[0].applied_health_change, -8);
  assert.strictEqual(withRolls.dice_rolls[1].applied_health_change, -50, 'Applied consequence must clamp to -50');

  const clarWithRolls = validateTurnData({
    input_kind: 'clarification',
    narrative: 'The chasm is about ten feet wide.',
    dice_rolls: [{ attribute: 'agility', total: 12, dc: 14, success: false, applied_health_change: -8 }]
  }, 1);
  assert.deepStrictEqual(clarWithRolls.dice_rolls, [], 'Clarification turns must never carry dice rolls');
}

// -------------------------------------------------------------
// Test 6: Task Queue Concurrency Serialization
// -------------------------------------------------------------
async function testTaskQueueSerialization() {
  console.log(' - Running task queue serialization concurrency tests...');
  
  const queue = new Map();
  function queueTask(id, fn) {
    if (!queue.has(id)) {
      queue.set(id, Promise.resolve());
    }
    const current = queue.get(id);
    const next = current.then(async () => {
      return await fn();
    });
    queue.set(id, next.catch(() => {}));
    return next;
  }

  const executionOrder = [];
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const task1 = () => delay(100).then(() => { executionOrder.push(1); return 't1'; });
  const task2 = () => delay(10).then(() => { executionOrder.push(2); return 't2'; });

  // Run them concurrently
  const p1 = queueTask('campaign-1', task1);
  const p2 = queueTask('campaign-1', task2);

  await Promise.all([p1, p2]);
  
  assert.deepStrictEqual(executionOrder, [1, 2], 'Queue must execute tasks sequentially in order of entry, despite delay duration');
}

// -------------------------------------------------------------
// Test: server-owned AI config resolution (Phase I1)
// -------------------------------------------------------------
async function testServerConfigResolution() {
  console.log(' - Running server-owned AI config tests...');
  const { sanitizeAdminAiConfig, mergeAiConfig, maskAiConfig, resolveSecretField } = await import('./server-config.js');

  // Sanitization: unknown providers fall through, strings trimmed/bounded
  const dirty = sanitizeAdminAiConfig({
    provider: 'skynet',
    model: `  ${'x'.repeat(500)}  `,
    apiKey: ' secret ',
    fallback: { provider: 'grok', apiKey: 'fb-key' }
  });
  assert.strictEqual(dirty.provider, '', 'Unknown provider must fall through to env');
  assert.strictEqual(dirty.model.length, 400, 'Fields must be length-capped');
  assert.strictEqual(dirty.apiKey, 'secret', 'Fields must be trimmed');
  assert.strictEqual(dirty.fallback.provider, 'grok');

  // Merge order: admin > env > default
  const env = { AI_PROVIDER: 'openai', AI_MODEL: 'env-model', FALLBACK_AI_PROVIDER: 'gemini', OPENAI_API_KEY: 'env-voice' };
  const adminWins = mergeAiConfig({ provider: 'claude', model: 'admin-model', apiKey: 'admin-key' }, env);
  assert.strictEqual(adminWins.provider, 'claude', 'Admin provider must beat env');
  assert.strictEqual(adminWins.model, 'admin-model');
  assert.strictEqual(adminWins.apiKey, 'admin-key');
  assert.strictEqual(adminWins.fallback.provider, 'gemini', 'Env fallback tier applies when admin sets none');

  const envWins = mergeAiConfig(null, env);
  assert.strictEqual(envWins.provider, 'openai', 'Env provider applies when no admin config');
  assert.strictEqual(envWins.model, 'env-model');
  assert.strictEqual(envWins.apiKey, undefined, 'No admin key → AIClient resolves the provider env key');
  assert.strictEqual(envWins.voiceApiKey, 'env-voice', 'Voice key falls back to OPENAI_API_KEY');

  const defaults = mergeAiConfig(null, {});
  assert.strictEqual(defaults.provider, 'gemini', 'Default provider is gemini');
  assert.strictEqual(defaults.fallback, undefined, 'No fallback tier unless configured');

  // Masking: secrets must never be echoed
  const masked = maskAiConfig({ provider: 'openai', apiKey: 'super-secret', voiceApiKey: 'v', fallback: { apiKey: 'f' } });
  assert.strictEqual(JSON.stringify(masked).includes('super-secret'), false, 'Masked view must not contain the key');
  assert.strictEqual(masked.apiKeySet, true);
  assert.strictEqual(masked.voiceApiKeySet, true);
  assert.strictEqual(masked.fallback.apiKeySet, true);

  // Secret-field update semantics against a masked form
  assert.strictEqual(resolveSecretField('', 'stored'), 'stored', 'Blank keeps the stored secret');
  assert.strictEqual(resolveSecretField(undefined, 'stored'), 'stored', 'Missing keeps the stored secret');
  assert.strictEqual(resolveSecretField(null, 'stored'), '', 'Explicit null clears');
  assert.strictEqual(resolveSecretField(' new ', 'stored'), 'new', 'New value replaces (trimmed)');

  // Phase I3: per-role configs are sanitized, merged, and masked
  const withRoles = mergeAiConfig({
    provider: 'gemini',
    roles: {
      narration: { provider: 'claude', model: 'prose-model', apiKey: 'role-key' },
      setup: { provider: 'not-a-provider', model: '' },
      referee: {}
    }
  }, {});
  assert.deepStrictEqual(withRoles.roles.narration, { provider: 'claude', model: 'prose-model', apiKey: 'role-key' });
  assert.strictEqual(withRoles.roles.setup, undefined, 'Roles with no valid fields are dropped from the merge');
  assert.strictEqual(withRoles.roles.referee, undefined);

  const maskedRoles = maskAiConfig({ roles: { narration: { provider: 'claude', apiKey: 'role-secret' } } });
  assert.strictEqual(JSON.stringify(maskedRoles).includes('role-secret'), false, 'Role keys must never be echoed');
  assert.strictEqual(maskedRoles.roles.narration.apiKeySet, true);
  assert.strictEqual(maskedRoles.roles.setup.apiKeySet, false);
}

// -------------------------------------------------------------
// Test: provider endpoint pinning — baseUrl must never redirect keyed providers
// -------------------------------------------------------------
async function testProviderEndpointPin() {
  console.log(' - Running provider endpoint pin tests...');

  const realFetch = globalThis.fetch;
  const fetchedUrls = [];
  globalThis.fetch = async (url) => {
    fetchedUrls.push(String(url));
    return {
      ok: true,
      json: async () => ({
        content: [{ text: 'claude-ok' }],          // Claude response shape
        choices: [{ message: { content: 'ok' } }]  // OpenAI-compatible shape
      })
    };
  };

  try {
    // A custom/UI baseUrl must not redirect the Anthropic call: the x-api-key
    // would leak to an arbitrary host (same key-leak pattern fixed for Grok).
    const claude = new AIClient({ provider: 'claude', apiKey: 'test-key', baseUrl: 'https://attacker.example/v1' });
    const claudeOut = await claude.callClaude('sys', 'hello', false);
    assert.strictEqual(claudeOut, 'claude-ok');
    assert.strictEqual(fetchedUrls[0], 'https://api.anthropic.com/v1/messages', 'callClaude must ignore baseUrl and pin the official endpoint');

    const grok = new AIClient({ provider: 'grok', apiKey: 'test-key', baseUrl: 'https://attacker.example/v1' });
    await grok.callGrok('sys', 'hello', false);
    assert.strictEqual(fetchedUrls[1], 'https://api.x.ai/v1/chat/completions', 'callGrok must ignore baseUrl and pin the official endpoint');
  } finally {
    globalThis.fetch = realFetch;
  }
}

// -------------------------------------------------------------
// Test: fallback tiering — retry once, then per-call backup tier (Phase I2)
// -------------------------------------------------------------
async function testFallbackTiering() {
  console.log(' - Running fallback tiering tests...');

  // Error classification
  assert.strictEqual(isTransientAiError(Object.assign(new Error('x'), { status: 503 })), true, '503 is transient');
  assert.strictEqual(isTransientAiError(Object.assign(new Error('x'), { status: 429 })), true, '429 is transient');
  assert.strictEqual(isTransientAiError(Object.assign(new Error('x'), { status: 401 })), false, '401 is not transient');
  assert.strictEqual(isTransientAiError(Object.assign(new Error('timeout'), { transient: true })), true, 'timeout flag is transient');
  assert.strictEqual(isTransientAiError(new TypeError('fetch failed')), true, 'network TypeError is transient');
  assert.strictEqual(isTransientAiError(new Error('API key is not configured.')), false, 'config errors fail fast');

  const realFetch = globalThis.fetch;
  const calls = [];
  let failures = 0;
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), auth: options?.headers?.Authorization || options?.headers?.['x-goog-api-key'] || '' });
    if (failures > 0) {
      failures--;
      return { ok: false, status: 503, statusText: 'Service Unavailable', text: async () => 'overloaded' };
    }
    return { ok: true, json: async () => ({ choices: [{ message: { content: 'recovered' } }], candidates: [{ content: { parts: [{ text: 'recovered' }] } }] }) };
  };

  try {
    // 1. Transient error then success: one retry, same provider
    failures = 1;
    calls.length = 0;
    const retryClient = new AIClient({ provider: 'openai', apiKey: 'k1' });
    const out1 = await retryClient.sendPrompt({ prompt: 'hi' });
    assert.strictEqual(out1, 'recovered');
    assert.strictEqual(calls.length, 2, 'Should retry exactly once');
    assert.strictEqual(calls[1].url.includes('api.openai.com'), true, 'Retry stays on the primary provider');

    // 2. Two transient failures with a backup tier: third call goes to the fallback provider/key
    failures = 2;
    calls.length = 0;
    const failoverClient = new AIClient({
      provider: 'openai', apiKey: 'k1',
      fallback: { provider: 'grok', model: 'grok-3-mini', apiKey: 'fb-key' }
    });
    const out2 = await failoverClient.sendPrompt({ prompt: 'hi' });
    assert.strictEqual(out2, 'recovered');
    assert.strictEqual(calls.length, 3, 'Primary, retry, then fallback');
    assert.strictEqual(calls[2].url.includes('api.x.ai'), true, 'Third call must hit the backup provider');
    assert.strictEqual(calls[2].auth, 'Bearer fb-key', 'Backup call must use the backup key');

    // 3. Two transient failures with NO backup tier: error propagates after one retry
    failures = 99;
    calls.length = 0;
    const noFallbackClient = new AIClient({ provider: 'openai', apiKey: 'k1' });
    await assert.rejects(() => noFallbackClient.sendPrompt({ prompt: 'hi' }), /503/, 'Without a backup tier the transient error surfaces');
    assert.strictEqual(calls.length, 2, 'Only primary + one retry without a backup tier');

    // 4. Non-transient error: fail fast, no retry
    calls.length = 0;
    globalThis.fetch = async (url) => {
      calls.push({ url: String(url) });
      return { ok: false, status: 401, statusText: 'Unauthorized', text: async () => 'bad key' };
    };
    const failFastClient = new AIClient({
      provider: 'openai', apiKey: 'bad',
      fallback: { provider: 'grok', apiKey: 'fb-key' }
    });
    await assert.rejects(() => failFastClient.sendPrompt({ prompt: 'hi' }), /401/, '401 must not be retried');
    assert.strictEqual(calls.length, 1, 'Non-transient errors get exactly one attempt');
  } finally {
    globalThis.fetch = realFetch;
  }

  // resolveAgentConfig must carry the fallback tier through to every role
  const roleConfig = resolveAgentConfig({ provider: 'gemini', apiKey: 'k', fallback: { provider: 'grok', apiKey: 'f' } }, 'referee');
  assert.deepStrictEqual(roleConfig.fallback, { provider: 'grok', apiKey: 'f' }, 'Per-role configs must keep the fallback tier');
}

// -------------------------------------------------------------
// Test: TTS provider seam + voice profiles (Phase 2 groundwork)
// -------------------------------------------------------------
async function testTtsProviderSeam() {
  console.log(' - Running TTS provider seam tests...');
  const { synthesizeSpeech, validateVoiceProfile, listTtsProviders } = await import('./tts-providers.js');

  assert.deepStrictEqual(listTtsProviders(), ['openai'], 'OpenAI is the baseline provider');
  await assert.rejects(
    () => synthesizeSpeech({ provider: 'elevenlabs', apiKey: 'k', text: 'hi' }),
    /Unsupported TTS provider/,
    'Unknown providers fail with a clear error'
  );
  await assert.rejects(
    () => synthesizeSpeech({ provider: 'openai', apiKey: '', text: 'hi' }),
    /API key is required/,
    'Missing key fails fast'
  );

  const realFetch = globalThis.fetch;
  let captured = null;
  globalThis.fetch = async (url, options) => {
    captured = { url: String(url), auth: options.headers.Authorization, body: JSON.parse(options.body) };
    return { ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
  };
  try {
    const audio = await synthesizeSpeech({
      provider: 'openai', apiKey: 'voice-key', model: 'gpt-4o-mini-tts',
      voice: 'cedar', instructions: 'gravelly Viennese accent', text: 'Guten Abend.'
    });
    assert.strictEqual(audio.length, 3, 'Returns the audio buffer');
    assert.strictEqual(captured.url, 'https://api.openai.com/v1/audio/speech');
    assert.strictEqual(captured.auth, 'Bearer voice-key');
    assert.strictEqual(captured.body.voice, 'cedar');
    assert.strictEqual(captured.body.instructions, 'gravelly Viennese accent', 'Steerable models receive instructions');

    await synthesizeSpeech({ provider: 'openai', apiKey: 'k', model: 'tts-1', voice: 'nope', instructions: 'x', text: 'hi' });
    assert.strictEqual(captured.body.voice, 'marin', 'Unknown voices fall back to marin');
    assert.strictEqual(captured.body.instructions, undefined, 'Fixed-character models get no instructions');

    await synthesizeSpeech({ provider: 'openai', apiKey: 'k', model: 'made-up-model', text: 'hi' });
    assert.strictEqual(captured.body.model, 'gpt-4o-mini-tts', 'Unknown TTS models fall back to the default');
  } finally {
    globalThis.fetch = realFetch;
  }

  // Voice profiles: the stored voice identity of a speaker (audio canon commitment)
  const profile = validateVoiceProfile({ voice: 'cedar', instructions: `  ${'x'.repeat(700)}  `, provider: ' openai ' });
  assert.strictEqual(profile.voice, 'cedar');
  assert.strictEqual(profile.provider, 'openai');
  assert.strictEqual(profile.instructions.length, 600, 'Instructions are bounded');
  const fallbackProfile = validateVoiceProfile({ voice: 'not-a-voice' });
  assert.strictEqual(fallbackProfile.voice, 'marin');
  assert.strictEqual(fallbackProfile.provider, 'openai');
}

// -------------------------------------------------------------
// Test: round-robin turn order (Phase 3 M2)
// -------------------------------------------------------------
async function testTurnOrder() {
  console.log(' - Running turn order tests...');
  const { validateTurnState, actingCharacterId, advanceTurnOrder, removeFromTurnOrder } = await import('./rpg-state.js');

  // Normalization: unknown ids dropped, missing members appended, index clamped
  const state = validateTurnState({ order: [7, 99, 7, 3], current_index: 9, round: 0 }, [3, 5, 7]);
  assert.deepStrictEqual(state.order, [7, 3, 5], 'Unknown ids dropped, dupes removed, missing members appended');
  assert.strictEqual(state.current_index, 2, 'Index clamps into range');
  assert.strictEqual(state.round, 1, 'Round floors at 1');
  const fresh = validateTurnState(null, [4, 8]);
  assert.deepStrictEqual(fresh, { order: [4, 8], current_index: 0, round: 1 }, 'No stored state → party order, round 1');
  assert.strictEqual(actingCharacterId(fresh), 4);
  assert.strictEqual(actingCharacterId(validateTurnState(null, [])), null, 'Empty party → no acting character');

  // Round-robin advance: wraps into a new round; single member = order of one
  const two = validateTurnState(null, [4, 8]);
  const afterOne = advanceTurnOrder(two);
  assert.strictEqual(actingCharacterId(afterOne), 8);
  assert.strictEqual(afterOne.round, 1, 'Mid-round advance keeps the round');
  const afterWrap = advanceTurnOrder(afterOne);
  assert.strictEqual(actingCharacterId(afterWrap), 4);
  assert.strictEqual(afterWrap.round, 2, 'Wrapping starts a new round');
  const solo = advanceTurnOrder(validateTurnState(null, [4]));
  assert.strictEqual(actingCharacterId(solo), 4, 'Order of one: always your turn');
  assert.strictEqual(solo.round, 2, 'Solo rounds still count actions');

  // Leaving: order shrinks, the turn stays with (or passes to) the right member
  const three = { order: [4, 8, 12], current_index: 1, round: 3 };
  const midLeft = removeFromTurnOrder(three, 4);
  assert.deepStrictEqual(midLeft.order, [8, 12]);
  assert.strictEqual(actingCharacterId(midLeft), 8, 'Removing an earlier member keeps the acting one');
  const actorLeft = removeFromTurnOrder(three, 8);
  assert.strictEqual(actingCharacterId(actorLeft), 12, 'Removing the acting member passes to the next');
  const wrapLeft = removeFromTurnOrder({ order: [4, 8], current_index: 1, round: 2 }, 8);
  assert.strictEqual(actingCharacterId(wrapLeft), 4, 'Removing the last acting member wraps');
  assert.deepStrictEqual(removeFromTurnOrder(three, 99), three, 'Unknown leaver is a no-op');

  // A committed action consumes the turn only when it actually resolved:
  // denials/needs_clarification stamp action_resolved false engine-side.
  assert.strictEqual(validateTurnData({ input_kind: 'committed_action', narrative: 'N.', action_resolved: true }, 1).action_resolved, true);
  assert.strictEqual(validateTurnData({ input_kind: 'committed_action', narrative: 'N.' }, 1).action_resolved, false, 'Unstamped → not resolved');
  assert.strictEqual(validateTurnData({ input_kind: 'clarification', narrative: 'N.', action_resolved: true }, 1).action_resolved, false, 'Clarification net clears resolution');
  const forcedTurn = forceNoOpTurnState({ action_resolved: true }, { campaign: { current_act: 1 }, active_quest: { title: 'Q', description: 'D' } }, 'dialogue');
  assert.strictEqual(forcedTurn.action_resolved, false, 'forceNoOpTurnState clears resolution');
}

// -------------------------------------------------------------
// Test: structured location state (Phase V2)
// -------------------------------------------------------------
async function testStructuredLocations() {
  console.log(' - Running structured location state tests...');
  const {
    validateLocationLayout, validateLocationOccupancy, validateLocationUpdate,
    validateTurnData: validate, forceNoOpTurnState: forceNoOp
  } = await import('./rpg-state.js');
  const { renderLocationMap } = await import('./map-render.js');
  const { getGMSystemInstruction } = await import('./rpg-prompts.js');

  // Layout validation: clamps coordinates, drops broken pieces, null when unusable
  const layout = validateLocationLayout({
    name: `  ${'n'.repeat(200)}  `,
    description: 'A drowned chapel beneath the reef.',
    areas: [
      { id: 'nave', name: 'Flooded Nave', x: -20, y: 5, w: 500, h: 30 },
      { id: 'crypt', name: 'Crypt', x: 60, y: 40, w: 30, h: 20 },
      { name: '' },
      'garbage'
    ],
    exits: [
      { from: 'nave', to: 'crypt', label: 'broken stair' },
      { from: 'nave', to: 'out:the reef', label: 'shattered doors' },
      { from: 'nowhere', to: 'crypt' },
      { from: 'nave', to: 'atlantis' }
    ],
    features: [
      { area: 'crypt', name: 'Coral altar', kind: 'furniture' },
      { area: 'unknown-area', name: 'Anchor chain', kind: 'device' },
      { area: 'nave', name: '' }
    ]
  });
  assert.strictEqual(layout.name.length, 120, 'Location names are bounded');
  assert.strictEqual(layout.areas.length, 2, 'Nameless/garbage areas dropped');
  assert.strictEqual(layout.areas[0].x, 0, 'Coordinates clamp into the canvas');
  assert.strictEqual(layout.areas[0].w, 100, 'Sizes clamp into the canvas');
  assert.strictEqual(layout.exits.length, 2, 'Exits referencing unknown areas dropped; out: targets allowed');
  assert.strictEqual(layout.features.length, 2, 'Nameless features dropped');
  assert.strictEqual(layout.features[1].area, 'nave', 'Features in unknown areas fall back to the first area');
  assert.strictEqual(validateLocationLayout({ name: 'No areas' }), null, 'No usable areas → null (turn proceeds untracked)');

  // Occupancy: kinds whitelisted, unknown areas fall back on-map
  const occupancy = validateLocationOccupancy([
    { name: 'Vex', kind: 'player', area: 'crypt' },
    { name: 'Reef Warden', kind: 'creature', area: 'not-an-area', note: 'circling' },
    { name: 'Chest', kind: 'mimic' },
    { name: '' }
  ], layout);
  assert.strictEqual(occupancy.length, 3, 'Nameless occupants dropped');
  assert.strictEqual(occupancy[1].area, 'nave', 'Unknown areas fall back to the first area');
  assert.strictEqual(occupancy[2].kind, 'object', 'Unknown kinds fall back to object');

  // The turn-record signal: engine-stamped, wiped by BOTH no-op layers
  const update = validateLocationUpdate({ name: ' The Sunken Chapel ', positional: 1, occupancy: [{ name: 'Vex', kind: 'player' }] });
  assert.strictEqual(update.name, 'The Sunken Chapel');
  assert.strictEqual(update.positional, true);
  assert.strictEqual(validateLocationUpdate({ positional: true }), null, 'No name → no signal');

  const clarified = validate({
    input_kind: 'clarification', narrative: 'Answer.',
    location_update: { name: 'Somewhere New', positional: true, occupancy: [] }
  }, 1);
  assert.strictEqual(clarified.location_update, null, 'Clarification net wipes the location signal');

  const acted = validate({
    input_kind: 'committed_action', narrative: 'You dive.',
    location_update: { name: 'The Sunken Chapel', positional: true }
  }, 1);
  assert.strictEqual(acted.location_update.name, 'The Sunken Chapel', 'Committed actions keep the signal');

  const turnContext = {
    campaign: { current_act: 1 },
    active_quest: { title: 'Q', description: 'D' }
  };
  for (const kind of TABLE_TALK_KINDS) {
    const forced = forceNoOp({ location_update: { name: 'X', positional: true } }, turnContext, kind);
    assert.strictEqual(forced.location_update, null, `forceNoOpTurnState clears location state on ${kind}`);
  }

  // Deterministic render: same state → same SVG; names escaped; player ringed
  const svg1 = renderLocationMap(layout, occupancy);
  const svg2 = renderLocationMap(layout, occupancy);
  assert.strictEqual(svg1, svg2, 'Render is deterministic');
  assert.strictEqual(svg1.includes('Flooded Nave'), true, 'Area labels drawn');
  assert.strictEqual(svg1.includes('<circle'), true, 'Occupancy tokens drawn');
  assert.strictEqual(renderLocationMap(null, []), null, 'No layout → no map');
  const hostile = renderLocationMap(
    validateLocationLayout({ name: 'X', areas: [{ id: 'a', name: '<script>alert(1)</script>', x: 0, y: 0, w: 20, h: 20 }] }),
    [{ name: '"quoted" & <tagged>', kind: 'npc', area: 'a', note: '' }]
  );
  assert.strictEqual(hostile.includes('<script>'), false, 'Model-supplied names are XML-escaped');
  assert.strictEqual(hostile.includes('&lt;script&gt;'), true);

  // Canon injection: the GM sees the structured record (omniscience)
  const outline = { title: 'T', setting: 'S', acts: [], major_locations: [{ name: 'L', description: 'D' }], key_npcs: [{ name: 'N', role: 'R', personality: 'P' }], starting_quest: { title: 'Q', description: 'D' }, theme_colors: {} };
  const character = { name: 'Vex', class: 'Diver', attributes: {}, health: 100, max_health: 100, mana: 50, max_mana: 50, xp: 0, level: 1, inventory: [], abilities: [] };
  const withLocation = getGMSystemInstruction(outline, character, [], 1, null, { name: 'The Sunken Chapel', layout, occupancy });
  assert.strictEqual(withLocation.includes('CURRENT LOCATION (CANON'), true, 'Location section present when tracked');
  assert.strictEqual(withLocation.includes('Flooded Nave'), true, 'Areas listed');
  assert.strictEqual(withLocation.includes('Reef Warden'), true, 'Occupancy listed');
  const withoutLocation = getGMSystemInstruction(outline, character, [], 1, null, null);
  assert.strictEqual(withoutLocation.includes('CURRENT LOCATION'), false, 'No section before first tracked entry');
}

// -------------------------------------------------------------
// Test: engine-owned current_heroic — focal signal + stickiness (Phase V3)
// -------------------------------------------------------------
async function testHeroicPointer() {
  console.log(' - Running current_heroic stickiness tests...');
  const {
    validateFocalSubject, resolveHeroicSubject,
    validateTurnData: validate, forceNoOpTurnState: forceNoOp
  } = await import('./rpg-state.js');

  // Signal validation: none/invalid → null (keep current visual)
  assert.deepStrictEqual(
    validateFocalSubject({ kind: 'npc', name: ' Kessler ', reason: 'combat' }),
    { kind: 'npc', name: 'Kessler', reason: 'combat' }
  );
  assert.strictEqual(validateFocalSubject({ kind: 'none', name: 'X' }), null, '"none" keeps the current visual');
  assert.strictEqual(validateFocalSubject({ kind: 'npc', name: '' }), null, 'No name → no signal');
  assert.strictEqual(validateFocalSubject(null), null);

  // Stickiness rules (owner direction 2026-06-13)
  const current = { subject_kind: 'location', subject_key: 'the drowned bar', image_id: 1, generated_turn: 5 };

  // Entering a new location always retargets — even one turn later
  assert.deepStrictEqual(
    resolveHeroicSubject({ current, focal: null, locationChanged: true, locationKey: 'the reef road', turnNumber: 6 }),
    { kind: 'location', key: 'the reef road' }
  );
  // ...unless the "new" location is already the subject
  assert.strictEqual(
    resolveHeroicSubject({ current, focal: null, locationChanged: true, locationKey: 'the drowned bar', turnNumber: 6 }),
    null
  );
  // NPC prominence retargets after the thrash interval
  assert.deepStrictEqual(
    resolveHeroicSubject({ current, focal: { kind: 'npc', name: 'Kessler' }, locationChanged: false, locationKey: 'the drowned bar', turnNumber: 9 }),
    { kind: 'npc', key: 'Kessler' }
  );
  // ...but not immediately after the last swap (thrash guard)
  assert.strictEqual(
    resolveHeroicSubject({ current, focal: { kind: 'npc', name: 'Kessler' }, locationChanged: false, locationKey: 'the drowned bar', turnNumber: 6 }),
    null,
    'Too soon after the last swap → keep'
  );
  // Same subject again → keep (no re-render churn), regardless of casing
  assert.strictEqual(
    resolveHeroicSubject({
      current: { subject_kind: 'npc', subject_key: 'Kessler', generated_turn: 2 },
      focal: { kind: 'npc', name: 'Kessler' }, locationChanged: false, locationKey: null, turnNumber: 9
    }),
    null
  );
  assert.strictEqual(
    resolveHeroicSubject({
      current: { subject_kind: 'npc', subject_key: 'Kessler', generated_turn: 2 },
      focal: { kind: 'npc', name: 'KESSLER' }, locationChanged: false, locationKey: null, turnNumber: 9
    }),
    null,
    'Subject matching is case-insensitive'
  );
  // No signal, no move → keep; first-ever heroic needs no interval
  assert.strictEqual(resolveHeroicSubject({ current, focal: null, locationChanged: false, locationKey: null, turnNumber: 20 }), null);
  assert.deepStrictEqual(
    resolveHeroicSubject({ current: null, focal: { kind: 'npc', name: 'Kessler' }, locationChanged: false, locationKey: null, turnNumber: 2 }),
    { kind: 'npc', key: 'Kessler' }
  );

  // Both no-op layers wipe the focal signal (state, not presentation)
  const clarified = validate({ input_kind: 'clarification', narrative: 'A.', focal_subject: { kind: 'npc', name: 'Kessler' } }, 1);
  assert.strictEqual(clarified.focal_subject, null, 'Clarification net wipes the focal signal');
  const acted = validate({ input_kind: 'committed_action', narrative: 'A.', focal_subject: { kind: 'npc', name: 'Kessler' } }, 1);
  assert.strictEqual(acted.focal_subject.name, 'Kessler', 'Committed actions keep the signal');
  const turnContext = { campaign: { current_act: 1 }, active_quest: { title: 'Q', description: 'D' } };
  for (const kind of TABLE_TALK_KINDS) {
    const forced = forceNoOp({ focal_subject: { kind: 'npc', name: 'X' } }, turnContext, kind);
    assert.strictEqual(forced.focal_subject, null, `forceNoOpTurnState clears the focal signal on ${kind}`);
  }
}

// -------------------------------------------------------------
// Test: campaign bundle — the pinned-fixture forward-importability guard (Phase P)
// -------------------------------------------------------------
async function testCampaignBundle() {
  console.log(' - Running campaign bundle tests...');
  const { validateCampaignBundle, CAMPAIGN_BUNDLE_VERSION } = await import('./rpg-state.js');
  const fs = await import('fs');

  // THE GUARANTEE: this committed v1 fixture (a real export) must validate
  // in every future engine version. If a state-shape change breaks this
  // test, add a migration in validateCampaignBundle — do not regenerate the
  // fixture.
  const fixture = JSON.parse(fs.readFileSync(new URL('./test-fixtures/campaign-bundle-v1.json', import.meta.url)));
  const bundle = validateCampaignBundle(fixture);
  assert.strictEqual(bundle.format_version, 1);
  assert.strictEqual(bundle.campaign.title, 'Shadows of the Sunken Sands');
  assert.strictEqual(bundle.characters.filter(c => c.status === 'active').length >= 1, true, 'Active character survives');
  assert.strictEqual(bundle.turns.length, 3, 'All turns survive, deduped and sorted');
  assert.strictEqual(bundle.turns.every((t, i) => i === 0 || t.turn_number > bundle.turns[i - 1].turn_number), true, 'Turns sorted');
  assert.strictEqual(bundle.locations.length, 1, 'Structured location survives with a valid layout');
  assert.strictEqual(bundle.pointers.current_location_key, 'ancient ruins chamber', 'Location pointer resolves by key');
  const activeIds = new Set(bundle.characters.filter(c => c.status === 'active').map(c => c.source_id));
  assert.strictEqual(bundle.pointers.turn_order.order.every(id => activeIds.has(id)), true, 'Turn order references active characters only');
  assert.strictEqual(CAMPAIGN_BUNDLE_VERSION >= 1, true);

  // Rejections: garbage, missing version, future version
  assert.throws(() => validateCampaignBundle({ kind: 'not-a-bundle' }), /kind mismatch/);
  assert.throws(() => validateCampaignBundle({ kind: 'aetheria-campaign' }), /format_version/);
  assert.throws(() => validateCampaignBundle({ ...fixture, format_version: CAMPAIGN_BUNDLE_VERSION + 1 }), /newer than this engine/);
  assert.throws(() => validateCampaignBundle({ ...fixture, characters: [] }), /no active characters/);
  assert.throws(() => validateCampaignBundle({ ...fixture, turns: [] }), /no turns/);

  // Hostile shapes are normalized as data, never trusted
  const hostile = validateCampaignBundle({
    ...fixture,
    characters: [{ source_id: 1, name: '  Vex  ', health: 'NaNish', level: -5, status: 'weird' }],
    turns: [{ turn_number: 1, narrative: 'n', state_changes_json: 'not json{{' }, { turn_number: 1, narrative: 'dupe' }],
    pointers: { current_location_key: 'nowhere', turn_order: { order: [99], current_index: 9, round: -2 } }
  });
  assert.strictEqual(hostile.characters[0].name, 'Vex');
  assert.strictEqual(hostile.characters[0].level, 1, 'Numbers clamp');
  assert.strictEqual(hostile.characters[0].status, 'active', 'Unknown statuses normalize');
  assert.strictEqual(hostile.turns.length, 1, 'Duplicate turn numbers dropped');
  assert.strictEqual(hostile.turns[0].state_changes_json, '{}', 'Unparseable state records become empty');
  assert.strictEqual(hostile.pointers.current_location_key, null, 'Unknown location pointers cleared');
  assert.deepStrictEqual(hostile.pointers.turn_order.order, [], 'Order references only known active characters');

  // cr-4: hostile presentation-field shapes inside records are stripped at
  // the trust boundary (suggested_choices reaches choices.forEach in the UI)
  const shapes = validateCampaignBundle({
    ...fixture,
    turns: [{
      turn_number: 1, narrative: 'n',
      state_changes_json: JSON.stringify({ suggested_choices: { bad: 'shape' }, roll_result: { legacy: true }, input_kind: 'dialogue' })
    }]
  });
  const shaped = JSON.parse(shapes.turns[0].state_changes_json);
  assert.strictEqual('suggested_choices' in shaped, false, 'Non-array suggested_choices is stripped on import');
  assert.deepStrictEqual(shaped.roll_result, { legacy: true }, 'Legacy fields pass through untouched');
  const okShapes = validateCampaignBundle({
    ...fixture,
    turns: [{ turn_number: 1, narrative: 'n', state_changes_json: JSON.stringify({ suggested_choices: ['a', 'b'] }) }]
  });
  assert.deepStrictEqual(JSON.parse(okShapes.turns[0].state_changes_json).suggested_choices, ['a', 'b'], 'Well-formed choices survive');
}

// -------------------------------------------------------------
// Test: table-style dials — validation, choice caps, pacing state (Phase D)
// -------------------------------------------------------------
async function testTableStyle() {
  console.log(' - Running table-style dial tests...');
  const { validateTableStyle, computeEncounterCadence } = await import('./rpg-state.js');
  const { getGMSystemInstruction } = await import('./rpg-prompts.js');

  // Validation: whitelists with the decided defaults (classic + standard)
  assert.deepStrictEqual(validateTableStyle(null), { helpfulness: 'classic', pacing: 'standard' });
  assert.deepStrictEqual(validateTableStyle({ helpfulness: 'sycophant', pacing: 'chaos' }),
    { helpfulness: 'classic', pacing: 'standard' }, 'Unknown values fall to defaults');
  assert.deepStrictEqual(validateTableStyle({ helpfulness: 'hardline', pacing: 'player_driven' }),
    { helpfulness: 'hardline', pacing: 'player_driven' });

  // Choice caps are structural (validateTurnData), not prompt hopes
  const chatty = { input_kind: 'dialogue', narrative: 'N.', suggested_choices: ['a', 'b', 'c', 'd', 'e'] };
  assert.strictEqual(validateTurnData(chatty, 1, { helpfulness: 'helpful' }).suggested_choices.length, 4, 'Helpful caps at 4');
  assert.strictEqual(validateTurnData(chatty, 1, { helpfulness: 'classic' }).suggested_choices.length, 3, 'Classic caps at 3');
  assert.deepStrictEqual(validateTurnData(chatty, 1, { helpfulness: 'hardline' }).suggested_choices, [],
    'Hardline shows no choices even when the model emits them');
  const silent = { input_kind: 'dialogue', narrative: 'N.' };
  assert.strictEqual(validateTurnData(silent, 1, { helpfulness: 'helpful' }).suggested_choices.length, 3, 'Helpful backfills when empty');
  assert.deepStrictEqual(validateTurnData(silent, 1, { helpfulness: 'classic' }).suggested_choices, [],
    'Classic never invents choices');

  // Encounter report: engine-recorded fact behind the pacing rule
  assert.strictEqual(validateTurnData({ input_kind: 'committed_action', narrative: 'N.', encounter: 'gm_initiated' }, 1).encounter, 'gm_initiated');
  assert.strictEqual(validateTurnData({ input_kind: 'committed_action', narrative: 'N.', encounter: 'ambush!!' }, 1).encounter, 'none', 'Unknown reports fall to none');
  assert.strictEqual(validateTurnData({ input_kind: 'clarification', narrative: 'N.', encounter: 'gm_initiated' }, 1).encounter, 'none', 'Clarification net wipes the encounter report');
  const forced = forceNoOpTurnState({ encounter: 'gm_initiated' }, { campaign: { current_act: 1 }, active_quest: { title: 'Q', description: 'D' } }, 'dialogue');
  assert.strictEqual(forced.encounter, 'none', 'forceNoOpTurnState clears the encounter report');

  // Cadence: turns since the last GM-initiated encounter
  assert.strictEqual(computeEncounterCadence(['none', 'gm_initiated', 'none', 'none']), 2);
  assert.strictEqual(computeEncounterCadence(['player_sought', 'none']), null, 'Player-sought danger never counts against the GM');
  assert.strictEqual(computeEncounterCadence([]), null);
  assert.strictEqual(computeEncounterCadence(['gm_initiated']), 0, 'Encounter this turn → zero turns ago');

  // Prompt layer: the style section rides the GM system instruction
  const outline = { title: 'T', setting: 'S', acts: [], major_locations: [{ name: 'L', description: 'D' }], key_npcs: [{ name: 'N', role: 'R', personality: 'P' }], starting_quest: { title: 'Q', description: 'D' }, theme_colors: {} };
  const character = { name: 'Vex', class: 'Diver', attributes: {}, health: 100, max_health: 100, mana: 50, max_mana: 50, xp: 0, level: 1, inventory: [], abilities: [] };
  const hardline = getGMSystemInstruction(outline, character, [], 1, null, null, null, { helpfulness: 'hardline', pacing: 'standard' });
  assert.strictEqual(hardline.includes('TABLE STYLE'), true, 'Style section present');
  assert.strictEqual(hardline.includes('HARDLINE'), true);
  const unstyled = getGMSystemInstruction(outline, character, [], 1, null, null, null, null);
  assert.strictEqual(unstyled.includes('TABLE STYLE'), false, 'No section without a style (legacy campaigns)');
}

// -------------------------------------------------------------
// Test: generated NPC appearance descriptors (Phase V5b)
// -------------------------------------------------------------
async function testNpcAppearance() {
  console.log(' - Running NPC appearance descriptor tests...');
  const { generateNpcAppearance } = await import('./rpg-engine.js');
  const npc = { name: 'Kessler', role: 'Dock boss', personality: 'Cold, patient predator', quirks: 'Never raises his voice' };

  const good = await generateNpcAppearance(
    { sendPrompt: async ({ systemInstruction, prompt }) => {
      assert.strictEqual(prompt.includes('Kessler'), true, 'NPC identity reaches the call');
      assert.strictEqual(systemInstruction.includes('appearance'), true);
      return '{"appearance": "  A broad, gray-bearded man with a milky left eye and a docker\'s slicker.  "}';
    } },
    npc, 'Harbor Noir'
  );
  assert.strictEqual(good, "Kessler: A broad, gray-bearded man with a milky left eye and a docker's slicker.",
    'Generated appearance is name-prefixed and trimmed (committed as the anchor descriptor)');

  const bounded = await generateNpcAppearance(
    { sendPrompt: async () => JSON.stringify({ appearance: 'x'.repeat(2000) }) }, npc, 'G'
  );
  assert.strictEqual(bounded.length <= 'Kessler: '.length + 700, true, 'Appearance is bounded');

  assert.strictEqual(
    await generateNpcAppearance({ sendPrompt: async () => { throw new Error('provider down'); } }, npc, 'G'),
    null, 'Call failure → null (caller falls back to character-notes composition)'
  );
  assert.strictEqual(
    await generateNpcAppearance({ sendPrompt: async () => '"just a string"' }, npc, 'G'),
    null, 'Shapeless output → null fallback'
  );
}

// -------------------------------------------------------------
// Test: agent-generated genre theming (Phase T1)
// -------------------------------------------------------------
async function testThemeGeneration() {
  console.log(' - Running agent-generated theming tests...');
  const { validateOutlineData, THEME_FONT_OPTIONS } = await import('./rpg-state.js');
  const { getOutlineSystemInstruction } = await import('./rpg-prompts.js');

  const outline = validateOutlineData({
    title: 'T', setting: 'S',
    theme_colors: { primary: '320, 100%, 55%', background: '275, 45%, 60%', text: '180, 100%, 30%', text_dim: '320, 30%, 70%' },
    theme_fonts: { title: 'orbitron', body: 'Comic Sans MS', dialogue: 'Cormorant Garamond' }
  });
  assert.strictEqual(outline.theme_colors.background, '275, 45%, 30%', 'Backgrounds are clamped dark');
  assert.strictEqual(outline.theme_colors.text, '180, 100%, 60%', 'Generated text is clamped readable');
  assert.strictEqual(outline.theme_colors.text_dim, '320, 30%, 70%');
  assert.strictEqual(outline.theme_fonts.title, 'Orbitron', 'Pool matching is case-insensitive');
  assert.strictEqual(outline.theme_fonts.body, 'Inter', 'Off-pool fonts fall back to the slot default');
  assert.strictEqual(outline.theme_fonts.dialogue, 'Cormorant Garamond');

  // Pre-theming outlines keep their legacy shape so old campaigns render unchanged
  const legacy = validateOutlineData({ title: 'Old', theme_colors: { primary: '210, 100%, 50%' } });
  assert.strictEqual(legacy.theme_colors.text, undefined, 'No generated text slot → legacy shape (client keeps preset behavior)');
  assert.deepStrictEqual(legacy.theme_fonts, { title: 'Outfit', body: 'Inter', dialogue: 'Playfair Display' }, 'Base pairing injected for pre-theming outlines');

  const junk = validateOutlineData({ theme_colors: { primary: 'red', text: 'not-hsl' } });
  assert.strictEqual(junk.theme_colors.primary, '210, 100%, 50%', 'Unparseable colors fall back to defaults');
  assert.strictEqual(junk.theme_colors.text, '210, 20%, 95%', 'Unparseable generated text falls back bright');

  // The Setup prompt requests the theme and constrains fonts to the pool
  const prompt = getOutlineSystemInstruction('Cyberpunk Noir');
  assert.strictEqual(prompt.includes('Cyberpunk Noir'), true);
  assert.strictEqual(prompt.includes('"theme_fonts"'), true, 'Outline schema requests a font pairing');
  assert.strictEqual(prompt.includes('"text_dim"'), true, 'Outline schema requests text colors');
  for (const slot of Object.keys(THEME_FONT_OPTIONS)) {
    assert.strictEqual(prompt.includes(THEME_FONT_OPTIONS[slot].join(' | ')), true, `Prompt lists the ${slot} font pool`);
  }
}

// -------------------------------------------------------------
// Test: image provider seam + identity anchors (Phase V1)
// -------------------------------------------------------------
async function testImageProviderSeam() {
  console.log(' - Running image provider seam tests...');
  const { generateImage, listImageProviders, validateIdentityAnchor } = await import('./image-providers.js');
  const { sanitizeAdminAiConfig, mergeAiConfig, maskAiConfig } = await import('./server-config.js');

  assert.deepStrictEqual(listImageProviders(), ['openai', 'sdwebui'], 'Hosted + local dev providers registered');
  await assert.rejects(
    () => generateImage({ provider: 'midjourney', prompt: 'x' }),
    /Unsupported image provider/,
    'Unknown providers fail with a clear error'
  );
  await assert.rejects(
    () => generateImage({ provider: 'openai', apiKey: '', prompt: 'x' }),
    /API key is missing/,
    'Missing OpenAI key fails fast'
  );
  await assert.rejects(
    () => generateImage({ provider: 'sdwebui', endpoint: '', prompt: 'x' }),
    /endpoint is missing/,
    'Missing SD-WebUI endpoint fails fast'
  );

  // Identity anchors: the stored visual identity of a subject (visual canon)
  const anchor = validateIdentityAnchor({ descriptor: `  ${'d'.repeat(900)}  `, seed: 7.9 });
  assert.strictEqual(anchor.descriptor.length, 800, 'Descriptor is bounded');
  assert.strictEqual(anchor.seed, 7, 'Seeds are floored integers');
  assert.strictEqual(validateIdentityAnchor({ seed: -5 }).seed, null, 'Negative seeds are dropped');
  assert.strictEqual(validateIdentityAnchor(null).seed, null);

  const realFetch = globalThis.fetch;
  let captured = null;
  const pngB64 = Buffer.from([1, 2, 3]).toString('base64');
  globalThis.fetch = async (url, options) => {
    captured = {
      url: String(url),
      auth: options.headers?.Authorization,
      body: JSON.parse(options.body)
    };
    return {
      ok: true,
      json: async () => ({
        data: [{ b64_json: pngB64 }],                          // OpenAI shape
        images: [pngB64], info: JSON.stringify({ seed: 1234 }) // SD-WebUI shape
      })
    };
  };
  try {
    // OpenAI: pinned endpoint, descriptor folded into the prompt, landscape size
    const hosted = await generateImage({
      provider: 'openai', apiKey: 'img-key', prompt: 'A drowned throne room',
      identityAnchor: { descriptor: 'silver-haired queen with a cracked crown' },
      width: 1024, height: 768
    });
    assert.strictEqual(captured.url, 'https://api.openai.com/v1/images/generations', 'OpenAI images endpoint is pinned');
    assert.strictEqual(captured.auth, 'Bearer img-key');
    assert.strictEqual(captured.body.model, 'gpt-image-1', 'Default model when unconfigured');
    assert.strictEqual(captured.body.size, '1536x1024', 'Landscape request maps to a supported size');
    assert.strictEqual(captured.body.response_format, undefined, 'gpt-image models reject response_format');
    assert.strictEqual(captured.body.prompt.includes('cracked crown'), true, 'Identity descriptor conditions the prompt');
    assert.strictEqual(hosted.image.length, 3, 'Returns the decoded image buffer');
    assert.strictEqual(hosted.seed, null, 'OpenAI cannot report a reusable seed');

    await generateImage({ provider: 'openai', apiKey: 'k', model: 'dall-e-3', prompt: 'x', width: 1024, height: 768 });
    assert.strictEqual(captured.body.response_format, 'b64_json', 'dall-e models must request base64');
    assert.strictEqual(captured.body.size, '1792x1024', 'dall-e landscape size differs');

    // SD-WebUI: configurable local endpoint, seed conditioning, no key ever attached
    const local = await generateImage({
      provider: 'sdwebui', endpoint: 'http://localhost:7860', apiKey: 'must-not-leak',
      model: 'realvis-xl', prompt: 'A drowned throne room',
      identityAnchor: { seed: 42 }, width: 1000, height: 700
    });
    assert.strictEqual(captured.url, 'http://localhost:7860/sdapi/v1/txt2img', 'SD-WebUI path derives from the endpoint');
    assert.strictEqual(captured.auth, undefined, 'The configurable-endpoint provider never sends an API key');
    assert.strictEqual(captured.body.seed, 42, 'Anchor seed conditions the render');
    assert.strictEqual(captured.body.width % 8, 0, 'Dimensions snap to multiples of 8');
    assert.deepStrictEqual(captured.body.override_settings, { sd_model_checkpoint: 'realvis-xl' });
    assert.strictEqual(local.seed, 1234, 'The actually-used seed is returned for anchor recording');

    await generateImage({ provider: 'sdwebui', endpoint: 'http://localhost:7860', prompt: 'x' });
    assert.strictEqual(captured.body.seed, -1, 'No anchor → provider-random seed');
    assert.strictEqual(captured.body.override_settings, undefined, 'No model → keep the loaded checkpoint');
  } finally {
    globalThis.fetch = realFetch;
  }

  // Admin config: sanitize/merge/mask for the image fields (Phase V1 wiring)
  const dirty = sanitizeAdminAiConfig({ imageProvider: 'midjourney', imageModel: ' m ', imageApiKey: ' k ', imageEndpoint: ' http://gpu-box:7860 ' });
  assert.strictEqual(dirty.imageProvider, '', 'Unknown image providers fall through');
  assert.strictEqual(dirty.imageModel, 'm');
  assert.strictEqual(dirty.imageEndpoint, 'http://gpu-box:7860');
  assert.strictEqual(sanitizeAdminAiConfig({ imageProvider: 'sdwebui' }).imageProvider, 'sdwebui');

  const adminWins = mergeAiConfig({ imageProvider: 'sdwebui', imageEndpoint: 'http://localhost:7860' }, { IMAGE_PROVIDER: 'openai' });
  assert.strictEqual(adminWins.imageProvider, 'sdwebui', 'Admin image provider beats env');
  assert.strictEqual(adminWins.imageEndpoint, 'http://localhost:7860', 'Admin loopback endpoint honored in dev');
  const lanAdmin = mergeAiConfig({ imageEndpoint: 'http://gpu-box:7860' }, {});
  assert.strictEqual(lanAdmin.imageEndpoint, '', 'Non-loopback admin endpoints are ignored (SSRF posture: pin via IMAGE_ENDPOINT_URL)');
  const lanEnv = mergeAiConfig({ imageEndpoint: 'http://sneaky:7860' }, { IMAGE_ENDPOINT_URL: 'http://gpu-box:7860' });
  assert.strictEqual(lanEnv.imageEndpoint, 'http://gpu-box:7860', 'Env-pinned LAN endpoints are trusted');
  const envWins = mergeAiConfig(null, { IMAGE_PROVIDER: 'openai', OPENAI_API_KEY: 'shared-key' });
  assert.strictEqual(envWins.imageProvider, 'openai');
  assert.strictEqual(envWins.imageApiKey, 'shared-key', 'Image key falls back to OPENAI_API_KEY');
  assert.strictEqual(mergeAiConfig(null, {}).imageProvider, '', 'Unconfigured = image generation inert');
  const prod = mergeAiConfig({ imageEndpoint: 'http://sneaky:7860' }, { NODE_ENV: 'production', IMAGE_ENDPOINT_URL: 'http://env-box:7860' });
  assert.strictEqual(prod.imageEndpoint, 'http://env-box:7860', 'Production ignores admin endpoints (SSRF posture)');

  const masked = maskAiConfig({ imageProvider: 'openai', imageApiKey: 'image-secret', imageEndpoint: 'http://gpu-box:7860' });
  assert.strictEqual(JSON.stringify(masked).includes('image-secret'), false, 'Masked view must not contain the image key');
  assert.strictEqual(masked.imageApiKeySet, true);
  assert.strictEqual(masked.imageEndpoint, 'http://gpu-box:7860', 'Non-secret image fields echo for the form');
}

// -------------------------------------------------------------
// Test: campaign ruleset — validation and canon injection
// -------------------------------------------------------------
async function testRulesetCanon() {
  console.log(' - Running campaign ruleset tests...');
  const { validateRulesetData } = await import('./rpg-state.js');
  const { getGMSystemInstruction } = await import('./rpg-prompts.js');

  const ruleset = validateRulesetData({
    name: '  Brine Protocol  ',
    resolution: 'd20 plus your attribute modifier against the referee\'s DC.',
    abilities: [
      { name: 'Grid Dive', cost: '8 mana', effect: 'Interface with a networked system within sight.', limits: 'Once per scene' },
      { name: '', effect: 'nameless — dropped' },
      { name: 'Slip Away', cost: '', effect: '', limits: '' }
    ],
    notes: 'Mana recovers fully on rest.'
  });
  assert.strictEqual(ruleset.name, 'Brine Protocol');
  assert.strictEqual(ruleset.abilities.length, 2, 'Nameless abilities dropped');
  assert.strictEqual(ruleset.abilities[1].cost, 'free', 'Missing cost defaults to free');
  assert.strictEqual(validateRulesetData({ name: 'Empty' }), null, 'No resolution and no abilities → null (freeform)');
  assert.strictEqual(validateRulesetData(null), null);

  // Canon injection: the GM system instruction carries the sheet when present
  const outline = { title: 'T', setting: 'S', acts: [], major_locations: [{ name: 'L', description: 'D' }], key_npcs: [{ name: 'N', role: 'R', personality: 'P' }], starting_quest: { title: 'Q', description: 'D' }, theme_colors: {} };
  const character = { name: 'Vex', class: 'Diver', attributes: {}, health: 100, max_health: 100, mana: 50, max_mana: 50, xp: 0, level: 1, inventory: [], abilities: [] };
  const withRules = getGMSystemInstruction(outline, character, [], 1, ruleset);
  assert.strictEqual(withRules.includes('CAMPAIGN RULES (CANON'), true, 'Rules section present with a ruleset');
  assert.strictEqual(withRules.includes('Grid Dive | 8 mana'), true, 'Abilities listed with costs');
  const withoutRules = getGMSystemInstruction(outline, character, [], 1, null);
  assert.strictEqual(withoutRules.includes('CAMPAIGN RULES'), false, 'No rules section for freeform campaigns');
}

// -------------------------------------------------------------
// Test: multi-voice narration — script validation, sticky NPC voices (Phase 2)
// -------------------------------------------------------------
async function testVoiceScript() {
  console.log(' - Running multi-voice narration tests...');
  const { assignNpcVoiceProfile, NPC_VOICE_POOL } = await import('./tts-providers.js');

  // narration_lines validation: drops empty/garbage, defaults speaker, bounds fields
  const validated = validateTurnData({
    input_kind: 'dialogue',
    narrative: 'Kessler laughs.',
    narration_lines: [
      { speaker: 'narrator', tone: 'low, tense', text: 'The bar falls quiet.' },
      { speaker: 'Kessler', tone: 'amused contempt', text: '"You again."' },
      { speaker: '', text: 'orphan line gets narrator' },
      { text: '   ' },
      'not an object'
    ]
  }, 1);
  assert.strictEqual(validated.narration_lines.length, 3, 'Empty/garbage lines dropped');
  assert.strictEqual(validated.narration_lines[1].speaker, 'Kessler');
  assert.strictEqual(validated.narration_lines[2].speaker, 'narrator', 'Blank speaker defaults to narrator');

  // The table-talk no-op net must NOT strip the voice script (presentation, not state)
  const clarified = validateTurnData({
    input_kind: 'clarification',
    narrative: 'Answer.',
    narration_lines: [{ speaker: 'narrator', text: 'Answer.' }]
  }, 1);
  assert.strictEqual(clarified.narration_lines.length, 1, 'Voice script survives clarification forcing');

  // Sticky NPC voice assignment: deterministic, marin excluded, direction from character
  assert.strictEqual(NPC_VOICE_POOL.includes('marin'), false, 'NPC pool must exclude the default narrator voice');
  const npc = { name: 'Kessler', personality: 'Cold, patient predator', quirks: 'Never raises his voice' };
  const profile1 = assignNpcVoiceProfile(npc, 0);
  const profile2 = assignNpcVoiceProfile(npc, 0);
  assert.deepStrictEqual(profile1, profile2, 'Same NPC + index → same profile (sticky)');
  assert.notStrictEqual(assignNpcVoiceProfile(npc, 1).voice, profile1.voice, 'Different index → different voice');
  assert.strictEqual(profile1.instructions.includes('Never raises his voice'), true, 'Direction derives from quirks');

  // Script resolution: NPC lines get stored profiles (case-insensitive), narrator gets nulls
  const npcs = [{ name: 'Kessler', voice_json: JSON.stringify({ provider: 'openai', voice: 'cedar', instructions: 'Cold, quiet menace.' }) }];
  const script = buildVoiceScript(validated.narration_lines, npcs);
  assert.strictEqual(script[0].voice, null, 'Narrator line: client falls back to player voice');
  assert.strictEqual(script[0].instructions, 'Tone: low, tense.', 'Narrator tone rides as suffix');
  assert.strictEqual(script[1].voice, 'cedar', 'NPC line uses the stored sticky voice');
  assert.strictEqual(script[1].instructions, 'Cold, quiet menace. Tone: amused contempt.', 'NPC direction + line tone compose');
  const unknownSpeaker = buildVoiceScript([{ speaker: 'Someone New', tone: '', text: 'Hi.' }], npcs);
  assert.strictEqual(unknownSpeaker[0].voice, null, 'Unknown speakers degrade to narrator voice');
  assert.deepStrictEqual(buildVoiceScript(undefined, npcs), [], 'Missing script → empty (single-voice fallback)');
}

// -------------------------------------------------------------
// Test: per-role Council config resolution (provider-scoped inheritance)
// -------------------------------------------------------------
function testResolveAgentConfig() {
  console.log(' - Running per-role agent config resolution tests...');

  const uiConfig = {
    provider: 'gemini',
    apiKey: 'ui-gemini-key',
    model: 'gemini-1.5-flash',
    baseUrl: 'http://custom.example/v1'
  };

  // Role env switches provider, no role key set: must NOT inherit the UI
  // provider's key/model/urls — AIClient should fall through to the role
  // provider's own env key instead.
  process.env.INTERACTION_AI_PROVIDER = 'grok';
  const cross = resolveAgentConfig(uiConfig, 'interaction');
  assert.strictEqual(cross.provider, 'grok');
  assert.strictEqual(cross.apiKey, undefined, 'Must not send the UI provider key to a different role provider');
  assert.strictEqual(cross.model, undefined, 'Must not send the UI provider model name to a different role provider');
  assert.strictEqual(cross.baseUrl, undefined, 'Must not carry the UI custom endpoint across providers');

  // Downstream: AIClient falls back to the role provider's env key.
  process.env.XAI_API_KEY = 'env-xai-key';
  assert.strictEqual(new AIClient(cross).apiKey, 'env-xai-key', 'AIClient must resolve the role provider env key');
  delete process.env.XAI_API_KEY;

  // Explicit role key always wins.
  process.env.INTERACTION_API_KEY = 'role-key';
  assert.strictEqual(resolveAgentConfig(uiConfig, 'interaction').apiKey, 'role-key');
  delete process.env.INTERACTION_API_KEY;

  // Same provider for the role: inherit the UI config.
  process.env.INTERACTION_AI_PROVIDER = 'gemini';
  const same = resolveAgentConfig(uiConfig, 'interaction');
  assert.strictEqual(same.apiKey, 'ui-gemini-key');
  assert.strictEqual(same.model, 'gemini-1.5-flash');
  delete process.env.INTERACTION_AI_PROVIDER;

  // No role env at all: role runs the UI config unchanged.
  const plain = resolveAgentConfig(uiConfig, 'interaction');
  assert.strictEqual(plain.provider, 'gemini');
  assert.strictEqual(plain.apiKey, 'ui-gemini-key');

  // Phase I3: narration and setup are first-class roles that inherit the
  // primary config when unconfigured (previous implicit behavior preserved).
  const narrationPlain = resolveAgentConfig(uiConfig, 'narration');
  assert.strictEqual(narrationPlain.provider, 'gemini');
  assert.strictEqual(narrationPlain.apiKey, 'ui-gemini-key');
  const setupPlain = resolveAgentConfig(uiConfig, 'setup');
  assert.strictEqual(setupPlain.model, 'gemini-1.5-flash');

  // Admin role config beats role env vars, which beat the primary.
  process.env.NARRATION_AI_PROVIDER = 'openai';
  process.env.NARRATION_AI_MODEL = 'env-model';
  const adminConfig = {
    ...uiConfig,
    roles: { narration: { provider: 'claude', model: 'admin-prose-model', apiKey: 'admin-claude-key' } }
  };
  const narrationAdmin = resolveAgentConfig(adminConfig, 'narration');
  assert.strictEqual(narrationAdmin.provider, 'claude', 'Admin role provider must beat role env');
  assert.strictEqual(narrationAdmin.model, 'admin-prose-model');
  assert.strictEqual(narrationAdmin.apiKey, 'admin-claude-key');
  delete process.env.NARRATION_AI_PROVIDER;
  delete process.env.NARRATION_AI_MODEL;

  // Cross-provider key safety holds for admin role configs too: switching a
  // role's provider without a role key must NOT inherit the primary's key.
  const crossAdmin = resolveAgentConfig({ ...uiConfig, roles: { setup: { provider: 'claude' } } }, 'setup');
  assert.strictEqual(crossAdmin.provider, 'claude');
  assert.strictEqual(crossAdmin.apiKey, undefined, 'Admin role on a different provider must not get the primary key');
  assert.strictEqual(crossAdmin.model, undefined, 'Admin role on a different provider must not get the primary model');
}

// Run all test functions
async function runAll() {
  try {
    testParseJsonSafe();
    testLevelUpMath();
    testProductionSsrfBlock();
    testJsonSchemaValidation();
    testForceNoOpTurnState();
    testApplyCharacterUpdate();
    testRefereeDiceFlow();
    testResolveAgentConfig();
    await testRulesetCanon();
    await testTurnOrder();
    await testStructuredLocations();
    await testHeroicPointer();
    await testNpcAppearance();
    await testTableStyle();
    await testCampaignBundle();
    await testThemeGeneration();
    await testVoiceScript();
    await testTtsProviderSeam();
    await testImageProviderSeam();
    await testServerConfigResolution();
    await testFallbackTiering();
    await testProviderEndpointPin();
    await testTaskQueueSerialization();
    console.log('✅ All unit tests completed successfully!');
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  }
}

runAll();
