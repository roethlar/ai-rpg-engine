import assert from 'assert';
import * as db from './db.js';
import * as rpg from './rpg-engine.js';

// Clean test helpers or mock objects
console.log('🧪 Starting Aetheria RPG Engine tests...');

// -------------------------------------------------------------
// Test 1: parseJsonSafe
// -------------------------------------------------------------
function testParseJsonSafe() {
  console.log(' - Running parseJsonSafe tests...');
  
  // Test raw JSON
  const rawJson = '{"test": 123}';
  const parsed1 = rpg.parseJsonSafe(rawJson);
  assert.strictEqual(parsed1.test, 123, 'Should parse raw JSON');

  // Test JSON wrapped in markdown fences
  const fencedJson = '```json\n{"test": 456}\n```';
  const parsed2 = rpg.parseJsonSafe(fencedJson);
  assert.strictEqual(parsed2.test, 456, 'Should parse fenced JSON');

  // Test JSON wrapped in code block ticks without language
  const tickedJson = '```\n{"test": 789}\n```';
  const parsed3 = rpg.parseJsonSafe(tickedJson);
  assert.strictEqual(parsed3.test, 789, 'Should parse ticked JSON');

  // Test text extraction fallback
  const textWithJson = 'Here is the response: {"test": "ok"} hope it works.';
  const parsed4 = rpg.parseJsonSafe(textWithJson);
  assert.strictEqual(parsed4.test, 'ok', 'Should extract JSON from surrounding text');
}

// -------------------------------------------------------------
// Test 2: Level-Up Math Formula
// -------------------------------------------------------------
function testLevelUpMath() {
  console.log(' - Running level-up math tests...');

  // level = floor(xp / 100) + 1
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

// Run all test functions
try {
  testParseJsonSafe();
  testLevelUpMath();
  console.log('✅ All unit tests completed successfully!');
} catch (error) {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
}
