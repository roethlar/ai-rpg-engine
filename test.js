import assert from 'assert';
import { parseJsonSafe, validateTurnData, performDiceCheck } from './rpg-state.js';
import { AIClient } from './api-client.js';

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
  process.env.NODE_ENV = oldNodeEnv;
  process.env.CUSTOM_ENDPOINT_URL = oldCustomUrl;
  process.env.OLLAMA_URL = oldOllamaUrl;
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
  assert.deepStrictEqual(clar.dice_rolls || [], []);
  assert.strictEqual(clar.quest_update.active_quest, 'Kill all goblins'); // description can stay but no act change side effects

  assert.strictEqual(clean.ability_updates.length, 1, 'Should keep only valid ability updates');
  assert.strictEqual(clean.ability_updates[0].ability.name, 'Neural Splice', 'Should trim ability names');
  assert.strictEqual(clean.ability_updates[0].ability.tier, 'emerging', 'Should default empty ability tier');

  const invalidKind = validateTurnData({ input_kind: 'monologue' }, 1);
  assert.strictEqual(invalidKind.input_kind, 'committed_action', 'Should default invalid input_kind');
}

// -------------------------------------------------------------
// Test 5: Dice Check modifier & DC success math
// -------------------------------------------------------------
function testDiceCheckMath() {
  console.log(' - Running dice roll and DC math tests...');
  
  const mockChar = {
    attributes: { strength: 14, agility: 8, intellect: 16, willpower: 10 }
  };
  
  // Agility check keywords should trigger agility check
  const res1 = performDiceCheck(mockChar, 'Try to sneak past the guards');
  assert.strictEqual(res1.attribute, 'agility');
  assert.strictEqual(res1.modifier, -1, 'AGI 8 modifier should be -1');

  // Intellect check keywords should trigger intellect check
  const res2 = performDiceCheck(mockChar, 'Attempt to decipher the ancient scroll');
  assert.strictEqual(res2.attribute, 'intellect');
  assert.strictEqual(res2.modifier, 3, 'INT 16 modifier should be 3');

  // Default behavior should choose highest attribute (intellect = 16)
  const res3 = performDiceCheck(mockChar, 'Do some random action');
  assert.strictEqual(res3.attribute, 'intellect', 'Should default to highest attribute');
  
  // Math validation
  assert.strictEqual(res3.total, res3.roll + res3.modifier, 'Total must equal roll + modifier');
  assert.strictEqual(res3.success, res3.total >= res3.dc, 'Success flag should match total >= DC');
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

// Run all test functions
async function runAll() {
  try {
    testParseJsonSafe();
    testLevelUpMath();
    testProductionSsrfBlock();
    testJsonSchemaValidation();
    testDiceCheckMath();
    await testTaskQueueSerialization();
    console.log('✅ All unit tests completed successfully!');
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  }
}

runAll();
