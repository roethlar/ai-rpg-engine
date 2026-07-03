import assert from 'assert';
import { parseJsonSafe, validateTurnData, validateRequiredChecks, rollCheck, forceNoOpTurnState, TABLE_TALK_KINDS } from './rpg-state.js';
import { AIClient, resolveAgentConfig } from './api-client.js';

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
}

// Run all test functions
async function runAll() {
  try {
    testParseJsonSafe();
    testLevelUpMath();
    testProductionSsrfBlock();
    testJsonSchemaValidation();
    testForceNoOpTurnState();
    testRefereeDiceFlow();
    testResolveAgentConfig();
    await testServerConfigResolution();
    await testProviderEndpointPin();
    await testTaskQueueSerialization();
    console.log('✅ All unit tests completed successfully!');
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  }
}

runAll();
