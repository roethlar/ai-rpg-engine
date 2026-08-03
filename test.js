import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { parseJsonSafe, validateTurnData, validateRequiredChecks, rollCheck, forceNoOpTurnState, applyCharacterUpdate, applyDiceConsequences, buildVoiceScript, TABLE_TALK_KINDS } from './rpg-state.js';
import { AIClient, resolveAgentConfig, isTransientAiError } from './api-client.js';
import { baseThemeVars, fullThemeVars } from './public/theme-vars.js';
import {
  applyAbilitySuggestion,
  computeAbilityInsertion,
  scanAbilityTriggers,
  validateAbilityTriggers
} from './public/ability-keywords.js';
import {
  abilityInvocationRecordFromDeclarations,
  buildAbilityDeclarations,
  buildCharacterAbilityTriggerState,
  emptyAbilityInvocationRecord,
  remapAbilityInvocationRecord,
  safeAbilityInvocationRecord,
  validateAbilityInvocationRecord
} from './ability-trigger-state.js';

// Hermetic store: db.js opens its file at module load, and several tests
// dynamically import rpg-engine.js (which pulls db.js in). Redirect BEFORE
// any of that happens, so the suite can never touch the operator's real
// campaigns. Static imports above pull no db.js, so this runs in time.
const TEST_DB_PATH = path.join(os.tmpdir(), `aetheria-test-${process.pid}-${Date.now()}.db`);
process.env.RPG_DB_PATH = TEST_DB_PATH;
// SQLite keeps the file (and its -wal/-shm siblings) open; unlinking under an
// open handle fails on Windows and silently leaves the temp store behind. So:
// close first, then unlink, then VERIFY removal rather than swallowing errors.
async function cleanupTestDb() {
  try {
    const db = await import('./db.js');
    await db.closeDb();
  } catch (e) { /* db.js may never have been imported, or is already closed */ }

  const leftovers = [];
  for (const suffix of ['', '-wal', '-shm']) {
    const file = TEST_DB_PATH + suffix;
    try {
      fs.unlinkSync(file);
    } catch (e) {
      if (e.code !== 'ENOENT') leftovers.push(file);
    }
    if (fs.existsSync(file)) leftovers.push(file);
  }
  if (leftovers.length > 0) {
    console.warn(`⚠️  Test database not removed: ${leftovers.join(', ')}`);
  }
}

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

  // sv-2: a malformed response is a container of GM-private text (the Council
  // roles are fed outline/NPC notes/memories and must emit memory_summary).
  // Its content must never ride in the thrown message, because error messages
  // cross the trust boundary into seat HTTP error bodies.
  const PRIVATE = 'PRIVATE_MARKER_the_duke_is_the_lich';
  // Round 2: EVERY failure path, not just the braced one. Native JSON.parse
  // messages QUOTE a snippet of their input ("Unexpected token 'P',
  // \"PRIVATE_PL\"... is not valid JSON"), so the no-brace path — which used
  // to rethrow the native error — leaked content AND carried no rawText.
  const failureCases = {
    'braced but unparseable': `{"memory_summary":"${PRIVATE}",}`,
    'unquoted value':         `{"memory_summary":${PRIVATE}}`,
    'no braces at all':       `${PRIVATE} is not json`,
    'truncated':              `{"memory_summary":"${PRIVATE}`,
    // sv-2 round 2, comment 2: a response truncated to a lone opening fence
    // emptied `lines`, and `lines[-1].startsWith` threw a native TypeError
    // with no rawText — a failure path outside the promised error shape.
    'lone fence':             '```',
    'lone json fence':        '```json',
    'fence + private only':   '```\n' + PRIVATE
  };
  for (const [label, malformed] of Object.entries(failureCases)) {
    assert.throws(
      () => parseJsonSafe(malformed),
      (err) => {
        // Any run of the marker in the message is a leak: the native parser
        // quotes ~10 characters around the offending token.
        for (let len = 8; len <= PRIVATE.length; len++) {
          assert.strictEqual(err.message.includes(PRIVATE.slice(0, len)), false,
            `[${label}] error message must not quote model output`);
        }
        assert.strictEqual(err.rawText, malformed, `[${label}] raw text preserved out-of-band`);
        return true;
      },
      `[${label}] throws without leaking content into the message`
    );
  }
}

// -------------------------------------------------------------
// Test: seat-safe error payloads (sv-2)
//
// Error responses were an unscoped side channel around the S2 whitelist.
// -------------------------------------------------------------
async function testSeatErrorPayloads() {
  console.log(' - Running seat error payload tests...');
  const { errorPayloadFor, apiErrorHandler } = await import('./server-errors.js');

  const seatReq = { auth: { kind: 'seat', characterId: 1 } };
  const hostReq = { auth: { kind: 'host' } };
  const PRIVATE = 'malformed model output: {"memory_summary":"the vault code is 4417"}';

  // An uncoded internal error is fully generalized for a seat...
  const seatPayload = errorPayloadFor(seatReq, new Error(PRIVATE), 'The GM could not complete that turn.');
  assert.strictEqual(seatPayload.error, 'The GM could not complete that turn.', 'Seat gets the generic message');
  assert.strictEqual(JSON.stringify(seatPayload).includes('vault code'), false, 'Seat payload carries no internal text');

  // ...while the host keeps full diagnostics, INCLUDING the raw model output
  // that parseJsonSafe moved out-of-band (pre-sv-2 parity — codex comment 5).
  const parseErr = Object.assign(new Error('The model returned malformed JSON.'), { rawText: PRIVATE });
  const hostPayload = errorPayloadFor(hostReq, parseErr, 'generic');
  assert.strictEqual(hostPayload.error, 'The model returned malformed JSON.', 'Host keeps the diagnostic message');
  assert.strictEqual(hostPayload.rawText, PRIVATE, 'Host keeps the raw model output for debugging');

  // Coded rulings reach seats — but ONLY when the engine explicitly opted in
  // by setting `publicMessage` (sv-2 round 2). The frontend switches on `code`
  // to restore the typed input, and shows `error`.
  const outOfTurn = Object.assign(new Error('It is Mira\'s turn to act.'),
    { code: 'OUT_OF_TURN', publicMessage: 'It is Mira\'s turn to act.' });
  const codedPayload = errorPayloadFor(seatReq, outOfTurn, 'generic');
  assert.strictEqual(codedPayload.code, 'OUT_OF_TURN', 'Machine-readable code survives for seats');
  assert.strictEqual(codedPayload.error, 'It is Mira\'s turn to act.', 'Authored ruling text reaches the player');
  const staleTriggers = Object.assign(new Error('Your ability list changed.'), {
    code: 'ABILITY_TRIGGERS_STALE',
    publicMessage: 'Your ability list changed.'
  });
  assert.deepStrictEqual(
    errorPayloadFor(seatReq, staleTriggers, 'generic'),
    { error: 'Your ability list changed.', code: 'ABILITY_TRIGGERS_STALE' },
    'A stale trigger ruling reaches the player without exposing server state'
  );

  // ROUND 2, comment 1: A CODE IS NOT PROVENANCE. Three spoof probes.
  // (a) An INTERNAL error that merely carries a seat-safe code must not
  //     disclose its message — it never opted in via publicMessage.
  const taggedInternal = Object.assign(new Error('SQLITE_ERROR: no such column: secret_vault_code'),
    { code: 'OUT_OF_TURN' });
  const taggedPayload = errorPayloadFor(seatReq, taggedInternal, 'generic');
  assert.strictEqual(taggedPayload.error, 'generic',
    'A seat-safe code alone must not disclose an internal message');
  assert.strictEqual(JSON.stringify(taggedPayload).includes('secret_vault_code'), false);

  // (b) An INHERITED code (prototype chain) is not an own, server-set tag.
  const inherited = Object.create({ code: 'OUT_OF_TURN', publicMessage: 'spoofed' });
  inherited.message = 'INHERITED_INTERNAL_SECRET';
  assert.strictEqual(errorPayloadFor(seatReq, inherited, 'generic').error, 'generic',
    'An inherited code/publicMessage is not provenance');

  // (c) An INHERITED auth.kind must not unlock host diagnostics.
  const spoofReq = { auth: Object.create({ kind: 'host' }) };
  const secretErr = Object.assign(new Error('HOST_ONLY_SECRET'), { rawText: 'RAW_MODEL_PRIVATE' });
  const spoofPayload = errorPayloadFor(spoofReq, secretErr, 'generic');
  assert.strictEqual(spoofPayload.error, 'generic', 'An inherited auth.kind does not unlock diagnostics');
  assert.strictEqual(spoofPayload.rawText, undefined, 'Nor the raw model output');
  assert.strictEqual(JSON.stringify(spoofPayload).includes('RAW_MODEL_PRIVATE'), false);

  // A genuine own-property host still gets everything.
  const realHost = errorPayloadFor({ auth: { kind: 'host' } }, secretErr, 'generic');
  assert.strictEqual(realHost.rawText, 'RAW_MODEL_PRIVATE', 'A real host keeps raw model output');

  // ROUND 2, codex comment 1: `code` is an ALLOWLIST, not a truthiness check.
  // sqlite3 sets error.code = 'SQLITE_ERROR'; Node sets ENOENT/ECONNREFUSED.
  // Treating any truthy code as a safe ruling disclosed schema internals.
  const sqliteErr = Object.assign(new Error('SQLITE_ERROR: no such column: secret_vault_code'),
    { code: 'SQLITE_ERROR' });
  const sqlitePayload = errorPayloadFor(seatReq, sqliteErr, 'The GM could not complete that turn.');
  assert.strictEqual(sqlitePayload.error, 'The GM could not complete that turn.',
    'An unknown error code must NOT make an internal message seat-safe');
  assert.strictEqual(JSON.stringify(sqlitePayload).includes('secret_vault_code'), false,
    'SQLITE_ERROR internals never reach a seat');
  assert.strictEqual(sqlitePayload.code, undefined, 'Unknown codes are withheld too');

  const enoent = Object.assign(new Error("ENOENT: no such file '/home/michael/.env'"), { code: 'ENOENT' });
  assert.strictEqual(errorPayloadFor(seatReq, enoent, 'generic').error, 'generic',
    'Node filesystem error codes are not seat-safe rulings');

  // FAIL CLOSED: no auth object at all (a throw before the auth middleware ran)
  // must be treated as untrusted, not silently as host.
  assert.strictEqual(errorPayloadFor({}, sqliteErr, 'generic').error, 'generic',
    'A request with no resolved auth gets the generic message');
  assert.strictEqual(errorPayloadFor(undefined, sqliteErr, 'generic').error, 'generic',
    'A missing request object fails closed');
  assert.strictEqual(errorPayloadFor({ auth: { kind: 'admin' } }, sqliteErr, 'generic').error, 'generic',
    'Only an explicit host kind unlocks diagnostics');

  // ROUND 2, codex comment 3: the terminal handler must fail closed on
  // body-parser errors, which are thrown BEFORE authentication runs.
  const capture = () => {
    const res = { statusCode: null, body: null, headersSent: false };
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (b) => { res.body = b; return res; };
    return res;
  };
  let res = capture();
  apiErrorHandler(Object.assign(new SyntaxError('Unexpected token } in JSON at position 42'),
    { type: 'entity.parse.failed' }), {}, res, () => {});
  assert.strictEqual(res.statusCode, 400, 'Malformed JSON body → 400');
  assert.strictEqual(res.body.error, 'Request body is not valid JSON.', 'No parser internals disclosed');

  res = capture();
  apiErrorHandler(Object.assign(new Error('request entity too large'), { type: 'entity.too.large' }), {}, res, () => {});
  assert.strictEqual(res.statusCode, 413, 'Oversized body → 413');

  res = capture();
  const stacky = new Error('connect ECONNREFUSED 127.0.0.1:5432 at /home/michael/secret/path.js:12');
  apiErrorHandler(stacky, {}, res, () => {});
  assert.strictEqual(res.statusCode, 500);
  assert.strictEqual(res.body.error, 'Internal server error.', 'Unknown errors never echo internals');
  assert.strictEqual(JSON.stringify(res.body).includes('secret/path'), false, 'No filesystem paths disclosed');
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
  const {
    sanitizeAdminAiConfig,
    mergeAiConfig,
    maskAiConfig,
    resolveSecretField,
    loadAdminAiConfig,
    saveAdminAiConfig
  } = await import('./server-config.js');

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
  assert.deepStrictEqual(
    sanitizeAdminAiConfig({ voiceApiKey: ' legacy-openai ' }).voiceApiKeys,
    { openai: 'legacy-openai', grok: '' },
    'A legacy flat voice key reads as OpenAI only'
  );
  assert.strictEqual(sanitizeAdminAiConfig({ voiceProvider: 'elevenlabs' }).voiceProvider, '', 'Unknown voice providers fall through');

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

  const grokAdmin = mergeAiConfig({
    voiceProvider: 'grok',
    voiceModel: 'must-not-cross',
    voiceApiKeys: { openai: 'openai-stored', grok: 'grok-stored' }
  }, { OPENAI_API_KEY: 'openai-env', XAI_API_KEY: 'grok-env' });
  assert.strictEqual(grokAdmin.voiceProvider, 'grok');
  assert.strictEqual(grokAdmin.voiceApiKey, 'grok-stored', 'Grok selects only the stored Grok key');
  assert.strictEqual(grokAdmin.voiceModel, '', 'Grok has no model field');
  const openAiAdmin = mergeAiConfig({
    voiceProvider: 'openai',
    voiceApiKeys: { openai: 'openai-stored', grok: 'grok-stored' }
  }, { XAI_API_KEY: 'grok-env' });
  assert.strictEqual(openAiAdmin.voiceApiKey, 'openai-stored', 'OpenAI selects only the stored OpenAI key');
  const grokEnv = mergeAiConfig(null, { TTS_PROVIDER: 'grok', OPENAI_API_KEY: 'wrong-vendor', GROK_API_KEY: 'grok-env' });
  assert.strictEqual(grokEnv.voiceApiKey, 'grok-env', 'Grok env fallback never uses OPENAI_API_KEY');

  const defaults = mergeAiConfig(null, {});
  assert.strictEqual(defaults.provider, 'gemini', 'Default provider is gemini');
  assert.strictEqual(defaults.fallback, undefined, 'No fallback tier unless configured');
  const subscriptionEnv = mergeAiConfig({ apiKey: 'stale-http-key' }, {
    AI_PROVIDER: 'claude-code',
    FALLBACK_AI_PROVIDER: 'claude-code',
    FALLBACK_API_KEY: 'stale-fallback-key'
  });
  assert.strictEqual(subscriptionEnv.apiKey, undefined, 'Claude Code ignores a stale legacy primary API key');
  assert.strictEqual(subscriptionEnv.fallback.apiKey, undefined, 'Claude Code ignores FALLBACK_API_KEY');

  // Masking: secrets must never be echoed
  const masked = maskAiConfig({
    provider: 'openai', apiKey: 'super-secret',
    voiceApiKeys: { openai: 'openai-voice-secret', grok: 'grok-voice-secret' },
    fallback: { apiKey: 'f' }
  });
  assert.strictEqual(JSON.stringify(masked).includes('super-secret'), false, 'Masked view must not contain the key');
  assert.strictEqual(JSON.stringify(masked).includes('openai-voice-secret'), false, 'Masked view must not contain the OpenAI voice key');
  assert.strictEqual(JSON.stringify(masked).includes('grok-voice-secret'), false, 'Masked view must not contain the Grok voice key');
  assert.strictEqual(masked.apiKeySet, true);
  assert.deepStrictEqual(masked.voiceApiKeySet, { openai: true, grok: true });
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

  // Actual storage migration and independent secret semantics. Start from a
  // legacy row rather than testing a duplicate of saveAdminAiConfig's merge.
  const db = await import('./db.js');
  await db.run(
    `INSERT INTO server_settings (key, value, updated_at) VALUES ('ai_config', ?, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
    [JSON.stringify({ voiceProvider: 'openai', voiceApiKey: 'legacy-stored' })]
  );
  await saveAdminAiConfig({ voiceProvider: 'openai' });
  const migrated = await loadAdminAiConfig();
  assert.strictEqual(Object.prototype.hasOwnProperty.call(migrated, 'voiceApiKey'), false, 'Next save removes the legacy flat key');
  assert.deepStrictEqual(migrated.voiceApiKeys, { openai: 'legacy-stored', grok: '' }, 'Legacy OpenAI key survives in the nested shape');

  await saveAdminAiConfig({ voiceApiKeys: { openai: null, grok: 'grok-new' } });
  const independentlyUpdated = await loadAdminAiConfig();
  assert.deepStrictEqual(independentlyUpdated.voiceApiKeys, { openai: '', grok: 'grok-new' }, 'One provider key clears without clearing the other');
  await saveAdminAiConfig({ voiceApiKeys: { openai: '', grok: '' } });
  assert.deepStrictEqual((await loadAdminAiConfig()).voiceApiKeys, { openai: '', grok: 'grok-new' }, 'Blank fields keep each stored key independently');
  await db.run(`DELETE FROM server_settings WHERE key = 'ai_config'`);
}

// -------------------------------------------------------------
// Test: am-1 canonical model registry, migration, and Council runtime
// -------------------------------------------------------------
async function testAdminModelRegistryV2() {
  console.log(' - Running admin model registry v2 tests...');
  const {
    AdminConfigValidationError,
    projectAdminAiConfigV2,
    validateAdminAiConfigV2,
    prepareAdminAiConfigV2Save,
    maskAdminAiConfigV2,
    mergeAiConfig,
    loadAdminAiConfig,
    saveAdminAiConfigV2
  } = await import('./server-config.js');
  const { createRegistryState, buildRegistryPayload } = await import('./admin/model-registry.js');
  const db = await import('./db.js');

  const legacy = {
    provider: 'openai',
    model: 'primary-model',
    apiKey: 'stored-primary-key',
    baseUrl: 'http://localhost:4100/v1/chat/completions',
    ollamaUrl: 'http://localhost:11434',
    fallback: { provider: 'grok', model: 'fallback-model', apiKey: '' },
    roles: {
      interaction: { provider: 'openai', model: 'interaction-model', apiKey: '' },
      continuity: { model: 'continuity-model' },
      referee: { provider: 'custom', apiKey: 'stored-role-key' }
    },
    voiceProvider: 'openai',
    voiceModel: 'gpt-4o-mini-tts',
    voiceApiKeys: { openai: 'stored-voice-key', grok: 'stored-grok-voice-key' },
    imageProvider: 'openai',
    imageModel: 'gpt-image-1',
    imageApiKey: 'stored-image-key',
    imageEndpoint: 'http://localhost:7860'
  };

  const projected = projectAdminAiConfigV2(legacy);
  assert.strictEqual(projected.configVersion, 2);
  assert.deepStrictEqual(projectAdminAiConfigV2(legacy), projected, 'Legacy projection ids are deterministic');
  assert.strictEqual(projected.providers.openai.apiKey, 'stored-primary-key');
  assert.strictEqual(projected.providers.custom.baseUrl, legacy.baseUrl);
  assert.strictEqual(projected.providers.ollama.ollamaUrl, legacy.ollamaUrl);
  assert.strictEqual(projected.defaultModel, 'legacy_primary');
  assert.strictEqual(projected.roleAssignments.setup.primary, '', 'Roles without tuples stay inherited');
  assert.strictEqual(projected.roleAssignments.interaction.primary, 'legacy_role_interaction');
  assert.strictEqual(projected.modelEntries.find(entry => entry.id === 'legacy_role_interaction').legacyDefault, true,
    'Complete-looking legacy role remains marked for blank-key precedence');
  assert.strictEqual(projected.modelEntries.find(entry => entry.id === 'legacy_role_referee').apiKey, 'stored-role-key');
  assert.strictEqual(projected.modelEntries.find(entry => entry.id === 'legacy_role_referee').keySource, 'custom');
  assert.strictEqual(projected.modelEntries.find(entry => entry.id === 'legacy_fallback').legacyDefault, true);
  assert.strictEqual(projected.roleAssignments.narration.fallback, 'legacy_fallback');
  assert.deepStrictEqual(projected.voiceApiKeys, legacy.voiceApiKeys);
  assert.strictEqual(projected.imageApiKey, legacy.imageApiKey);

  const masked = maskAdminAiConfigV2(legacy);
  const maskedRaw = JSON.stringify(masked);
  for (const secret of ['stored-primary-key', 'stored-role-key', 'stored-voice-key', 'stored-image-key']) {
    assert.strictEqual(maskedRaw.includes(secret), false, `Masked v2 DTO must not contain ${secret}`);
  }
  assert.deepStrictEqual(Object.keys(masked.providers), ['gemini', 'openai', 'claude', 'grok', 'ollama', 'custom', 'claude-code']);
  assert.deepStrictEqual(masked.providers['claude-code'], {}, 'Claude Code exposes no key or endpoint fields');
  assert.strictEqual(masked.providers.openai.apiKeySet, true);
  assert.strictEqual(masked.modelEntries.find(entry => entry.id === 'legacy_role_referee').apiKeySet, true);
  assert.deepStrictEqual(Object.keys(masked.roleAssignments), ['setup', 'interaction', 'continuity', 'referee', 'narration']);

  const noOpSaved = prepareAdminAiConfigV2Save(masked, legacy);
  assert.strictEqual(noOpSaved.providers.openai.apiKey, 'stored-primary-key', 'Blank masked provider key keeps projected secret');
  assert.strictEqual(noOpSaved.modelEntries.find(entry => entry.id === 'legacy_role_referee').apiKey, 'stored-role-key',
    'Blank masked entry key keeps deterministic projected secret');
  assert.deepStrictEqual(noOpSaved.voiceApiKeys, legacy.voiceApiKeys, 'Blank masked voice keys survive first rewrite');
  assert.strictEqual(noOpSaved.imageApiKey, 'stored-image-key', 'Blank masked image key survives first rewrite');
  assert.strictEqual(noOpSaved.modelEntries.find(entry => entry.id === 'legacy_role_interaction').legacyDefault, true,
    'No-op save retains authorized migration marker');

  const relabeled = prepareAdminAiConfigV2Save({
    ...masked,
    modelEntries: masked.modelEntries.map(entry => entry.id === 'legacy_role_interaction'
      ? { ...entry, label: 'Relabeled only' }
      : entry)
  }, legacy);
  assert.strictEqual(relabeled.modelEntries.find(entry => entry.id === 'legacy_role_interaction').legacyDefault, true,
    'Label-only edit retains migration behavior');

  const edited = prepareAdminAiConfigV2Save({
    ...masked,
    modelEntries: masked.modelEntries.map(entry => entry.id === 'legacy_role_interaction'
      ? { ...entry, model: 'operator-selected-model' }
      : entry)
  }, legacy);
  assert.strictEqual(edited.modelEntries.find(entry => entry.id === 'legacy_role_interaction').legacyDefault, false,
    'Runtime-field edit clears migration behavior');

  const replacedSecrets = prepareAdminAiConfigV2Save({
    ...masked,
    providers: { ...masked.providers, openai: { apiKey: 'replacement-provider-key' } },
    modelEntries: masked.modelEntries.map(entry => entry.id === 'legacy_role_interaction'
      ? { ...entry, keySource: 'custom', apiKey: 'replacement-entry-key' }
      : entry),
    voiceApiKeys: { openai: null, grok: '' },
    imageApiKey: null
  }, legacy);
  assert.strictEqual(replacedSecrets.providers.openai.apiKey, 'replacement-provider-key');
  assert.strictEqual(replacedSecrets.modelEntries.find(entry => entry.id === 'legacy_role_interaction').apiKey, 'replacement-entry-key');
  assert.deepStrictEqual(replacedSecrets.voiceApiKeys, { openai: '', grok: 'stored-grok-voice-key' });
  assert.strictEqual(replacedSecrets.imageApiKey, '');

  const legacyForClear = structuredClone(legacy);
  legacyForClear.roles.narration = {
    provider: 'claude', model: 'complete-legacy-model', apiKey: 'complete-legacy-key'
  };
  const maskedForClear = maskAdminAiConfigV2(legacyForClear);
  const clearRegistryPayload = buildRegistryPayload(createRegistryState(maskedForClear), { clearKeys: true });
  const clearLegacyRequest = {
    ...maskedForClear,
    ...clearRegistryPayload,
    voiceApiKeys: { openai: null, grok: null },
    imageApiKey: null
  };
  const clearedLegacySecrets = prepareAdminAiConfigV2Save(clearLegacyRequest, legacyForClear);
  const clearedPartial = clearedLegacySecrets.modelEntries.find(entry => entry.id === 'legacy_role_referee');
  assert.deepStrictEqual(clearedPartial, {
    id: 'legacy_role_referee',
    label: 'Legacy referee',
    provider: 'custom',
    model: '',
    keySource: 'custom',
    apiKey: '',
    legacyDefault: true
  }, 'Clear removes a partial legacy override without declassifying or rejecting its row');
  const clearedComplete = clearedLegacySecrets.modelEntries.find(entry => entry.id === 'legacy_role_narration');
  assert.deepStrictEqual(
    { keySource: clearedComplete.keySource, apiKey: clearedComplete.apiKey, legacyDefault: clearedComplete.legacyDefault },
    { keySource: 'custom', apiKey: '', legacyDefault: true },
    'Clear preserves complete legacy tuple precedence while removing its stored override'
  );
  assert.strictEqual(clearedLegacySecrets.providers.openai.apiKey, '');
  assert.deepStrictEqual(clearedLegacySecrets.voiceApiKeys, { openai: '', grok: '' });
  assert.strictEqual(clearedLegacySecrets.imageApiKey, '');
  assert.deepStrictEqual(clearedLegacySecrets.roleAssignments, clearRegistryPayload.roleAssignments,
    'Clear leaves legacy assignments unchanged');
  const clearEnv = {
    REFEREE_AI_MODEL: 'referee-env-model',
    REFEREE_API_KEY: 'referee-env-key',
    NARRATION_API_KEY: 'narration-env-key'
  };
  const clearRuntime = mergeAiConfig(clearedLegacySecrets, clearEnv);
  const clearedRefereeResolved = resolveAgentConfig(clearRuntime, 'referee', clearEnv);
  assert.deepStrictEqual(
    {
      provider: clearedRefereeResolved.provider,
      model: clearedRefereeResolved.model,
      apiKey: clearedRefereeResolved.apiKey
    },
    { provider: 'custom', model: 'referee-env-model', apiKey: 'referee-env-key' },
    'A cleared partial legacy row continues through its role environment precedence'
  );
  assert.strictEqual(resolveAgentConfig(clearRuntime, 'narration', clearEnv).apiKey, 'narration-env-key',
    'A cleared complete legacy row continues through ROLE_API_KEY precedence');

  const expectValidation = fn => assert.throws(fn, AdminConfigValidationError);
  const { adminSettingsErrorStatus } = await import('./server.js');
  assert.strictEqual(adminSettingsErrorStatus(new AdminConfigValidationError('bad registry')), 400,
    'Typed admin validation errors map to 400');
  assert.strictEqual(adminSettingsErrorStatus(new Error('storage failed')), 500,
    'Unexpected admin errors remain 500');
  const claudeCodeEntry = {
    id: 'subscription_default', label: 'Claude Code default', provider: 'claude-code', model: 'default',
    keySource: 'provider', apiKey: '', legacyDefault: false
  };
  const claudeCodeConfig = validateAdminAiConfigV2({
    ...projected,
    modelEntries: [...projected.modelEntries, claudeCodeEntry],
    roleAssignments: {
      ...projected.roleAssignments,
      setup: { primary: claudeCodeEntry.id, fallback: '' }
    }
  }, { legacyBaseline: legacy });
  const claudeCodeRuntime = resolveAgentConfig(mergeAiConfig(claudeCodeConfig, {}), 'setup', {});
  assert.deepStrictEqual(
    { provider: claudeCodeRuntime.provider, model: claudeCodeRuntime.model, apiKey: claudeCodeRuntime.apiKey },
    { provider: 'claude-code', model: 'default', apiKey: undefined },
    'Claude Code registry entries resolve through the Council pipeline without an API key'
  );
  expectValidation(() => validateAdminAiConfigV2({
    ...claudeCodeConfig,
    providers: { ...claudeCodeConfig.providers, 'claude-code': { apiKey: 'must-reject' } }
  }, { legacyBaseline: legacy }));
  expectValidation(() => validateAdminAiConfigV2({
    ...claudeCodeConfig,
    modelEntries: claudeCodeConfig.modelEntries.map(entry => entry.id === claudeCodeEntry.id
      ? { ...entry, keySource: 'custom', apiKey: 'must-reject' }
      : entry)
  }, { legacyBaseline: legacy }));
  expectValidation(() => validateAdminAiConfigV2({
    ...projected,
    modelEntries: [...projected.modelEntries, projected.modelEntries[0]]
  }, { legacyBaseline: legacy }));
  expectValidation(() => validateAdminAiConfigV2({
    ...projected,
    roleAssignments: { ...projected.roleAssignments, setup: { primary: 'missing', fallback: '' } }
  }, { legacyBaseline: legacy }));
  expectValidation(() => validateAdminAiConfigV2({
    ...projected,
    roleAssignments: { setup: projected.roleAssignments.setup }
  }, { legacyBaseline: legacy }));
  expectValidation(() => validateAdminAiConfigV2({
    ...projected,
    modelEntries: [...projected.modelEntries, {
      id: 'forged_legacy', label: 'Forged', provider: '', model: '', keySource: 'provider', apiKey: '', legacyDefault: true
    }]
  }, { legacyBaseline: legacy }));
  expectValidation(() => validateAdminAiConfigV2({
    ...projected,
    modelEntries: Array.from({ length: 65 }, (_, i) => ({
      id: `model_${i}`, label: `Model ${i}`, provider: 'openai', model: `m-${i}`,
      keySource: 'provider', apiKey: '', legacyDefault: false
    }))
  }));
  expectValidation(() => validateAdminAiConfigV2({
    ...projected,
    modelEntries: [{
      id: 'x'.repeat(81), label: 'Too long', provider: 'openai', model: 'm',
      keySource: 'provider', apiKey: '', legacyDefault: false
    }],
    defaultModel: '',
    roleAssignments: Object.fromEntries(['setup', 'interaction', 'continuity', 'referee', 'narration']
      .map(role => [role, { primary: '', fallback: '' }]))
  }));
  expectValidation(() => validateAdminAiConfigV2({
    ...projected,
    modelEntries: [{
      id: 'custom_missing', label: 'Missing key', provider: 'openai', model: 'm',
      keySource: 'custom', apiKey: '', legacyDefault: false
    }],
    defaultModel: '',
    roleAssignments: Object.fromEntries(['setup', 'interaction', 'continuity', 'referee', 'narration']
      .map(role => [role, { primary: '', fallback: '' }]))
  }));

  const migrationEnv = {
    AI_PROVIDER: 'openai',
    AI_MODEL: 'global-env-model',
    OPENAI_API_KEY: 'provider-env-key',
    XAI_API_KEY: 'grok-provider-env-key',
    INTERACTION_API_KEY: 'role-env-key',
    CONTINUITY_AI_PROVIDER: 'openai',
    CONTINUITY_API_KEY: 'continuity-env-key',
    FALLBACK_API_KEY: 'fallback-env-key',
    SETUP_AI_PROVIDER: 'grok'
  };
  const beforeRuntime = mergeAiConfig(legacy, migrationEnv);
  const afterRuntime = mergeAiConfig(noOpSaved, migrationEnv);
  for (const role of ['setup', 'interaction', 'continuity', 'referee', 'narration']) {
    assert.deepStrictEqual(
      resolveAgentConfig(beforeRuntime, role, migrationEnv),
      resolveAgentConfig(afterRuntime, role, migrationEnv),
      `${role} effective config survives first canonical rewrite`
    );
  }
  assert.strictEqual(resolveAgentConfig(afterRuntime, 'interaction', migrationEnv).apiKey, 'role-env-key',
    'Complete legacy role with blank key retains ROLE_API_KEY precedence');
  assert.strictEqual(resolveAgentConfig(afterRuntime, 'interaction', migrationEnv).fallback.apiKey, 'fallback-env-key',
    'Complete legacy fallback with blank key retains FALLBACK_API_KEY precedence');
  const crossProvider = resolveAgentConfig(afterRuntime, 'setup', migrationEnv);
  assert.strictEqual(crossProvider.provider, 'grok');
  assert.strictEqual(crossProvider.apiKey, undefined, 'Default-primary key never crosses provider boundary');
  assert.strictEqual(crossProvider.model, undefined, 'Default-primary model never crosses provider boundary');

  const empty = projectAdminAiConfigV2(null);
  const normalInput = {
    ...maskAdminAiConfigV2(empty),
    providers: {
      gemini: { apiKey: '' },
      openai: { apiKey: 'shared-openai-key' },
      claude: { apiKey: '' },
      grok: { apiKey: '' },
      ollama: { ollamaUrl: 'http://localhost:11434' },
      custom: { apiKey: 'custom-shared-key', baseUrl: 'http://localhost:4100/v1/chat/completions' }
    },
    modelEntries: [
      { id: 'shared_a', label: 'Shared A', provider: 'openai', model: 'gpt-a', keySource: 'provider', apiKey: '', legacyDefault: false },
      { id: 'shared_b', label: 'Shared B', provider: 'openai', model: 'gpt-b', keySource: 'provider', apiKey: '', legacyDefault: false },
      { id: 'custom_primary', label: 'Custom', provider: 'custom', model: 'custom-model', keySource: 'provider', apiKey: '', legacyDefault: false },
      { id: 'override', label: 'Override', provider: 'grok', model: 'grok-model', keySource: 'custom', apiKey: 'entry-override-key', legacyDefault: false },
      { id: 'ollama_fb', label: 'Local fallback', provider: 'ollama', model: 'llama3', keySource: 'provider', apiKey: '', legacyDefault: false }
    ],
    defaultModel: '',
    roleAssignments: {
      setup: { primary: 'shared_a', fallback: 'ollama_fb' },
      interaction: { primary: 'shared_b', fallback: 'custom_primary' },
      continuity: { primary: 'override', fallback: '' },
      referee: { primary: 'ollama_fb', fallback: '' },
      narration: { primary: 'custom_primary', fallback: '' }
    }
  };
  const normal = prepareAdminAiConfigV2Save(normalInput, null);
  const normalMasked = maskAdminAiConfigV2(normal);
  const clearedNormalSecrets = prepareAdminAiConfigV2Save({
    ...normalMasked,
    providers: { ...normalMasked.providers, openai: { apiKey: null } },
    modelEntries: normalMasked.modelEntries.map(entry => entry.id === 'override'
      ? { ...entry, keySource: 'provider', apiKey: '' }
      : entry)
  }, normal);
  assert.strictEqual(clearedNormalSecrets.providers.openai.apiKey, '', 'Explicit null clears one provider key');
  assert.strictEqual(clearedNormalSecrets.modelEntries.find(entry => entry.id === 'override').apiKey, '',
    'Switching to provider mode clears obsolete custom override');
  expectValidation(() => prepareAdminAiConfigV2Save({
    ...normalMasked,
    modelEntries: normalMasked.modelEntries.map(entry => entry.id === 'override'
      ? { ...entry, apiKey: null }
      : entry)
  }, normal));
  const normalRuntime = mergeAiConfig(normal, {});
  const setup = resolveAgentConfig(normalRuntime, 'setup', { SETUP_API_KEY: 'must-not-win' });
  assert.strictEqual(setup.apiKey, 'shared-openai-key', 'Normal assigned entry uses shared provider key');
  assert.strictEqual(setup.fallback.ollamaUrl, 'http://localhost:11434', 'Ollama fallback carries connection endpoint');
  const interaction = resolveAgentConfig(normalRuntime, 'interaction', {});
  assert.strictEqual(interaction.model, 'gpt-b', 'Different model entries may share one provider key');
  assert.strictEqual(interaction.apiKey, 'shared-openai-key');
  assert.strictEqual(interaction.fallback.baseUrl, 'http://localhost:4100/v1/chat/completions',
    'Custom fallback carries connection endpoint');
  const continuity = resolveAgentConfig(normalRuntime, 'continuity', {});
  assert.strictEqual(continuity.apiKey, 'entry-override-key', 'Per-model custom key overrides provider key');
  const referee = resolveAgentConfig(normalRuntime, 'referee', {});
  assert.strictEqual(referee.ollamaUrl, 'http://localhost:11434', 'Ollama primary carries connection endpoint');
  assert.strictEqual(resolveAgentConfig(normalRuntime, 'referee', {
    REFEREE_OLLAMA_URL: 'http://localhost:11500'
  }).ollamaUrl, 'http://localhost:11500', 'Role Ollama endpoint env beats matching provider connection');
  const narration = resolveAgentConfig(normalRuntime, 'narration', {
    NARRATION_CUSTOM_ENDPOINT_URL: 'http://localhost:4200/v1/chat/completions'
  });
  assert.strictEqual(narration.baseUrl, 'http://localhost:4200/v1/chat/completions',
    'Role endpoint env beats matching provider connection');

  const wrongKeyConfig = prepareAdminAiConfigV2Save({
    ...normalInput,
    providers: { ...normalInput.providers, openai: { apiKey: '' } },
    roleAssignments: {
      setup: { primary: 'override', fallback: 'shared_a' },
      interaction: { primary: 'shared_b', fallback: '' },
      continuity: { primary: 'override', fallback: '' },
      referee: { primary: 'shared_a', fallback: '' },
      narration: { primary: 'custom_primary', fallback: '' }
    }
  }, null);
  const wrongKeyResolved = resolveAgentConfig(mergeAiConfig(wrongKeyConfig, {}), 'setup', {
    OPENAI_API_KEY: 'correct-openai-env-key',
    FALLBACK_API_KEY: 'wrong-fallback-key'
  });
  assert.strictEqual(wrongKeyResolved.fallback.apiKey, undefined);

  const previousOpenAi = process.env.OPENAI_API_KEY;
  const previousFallbackKey = process.env.FALLBACK_API_KEY;
  const previousFallbackProvider = process.env.FALLBACK_AI_PROVIDER;
  const previousCustomEndpoint = process.env.CUSTOM_ENDPOINT_URL;
  const realFetch = globalThis.fetch;
  const calls = [];
  let failures = 2;
  try {
    process.env.OPENAI_API_KEY = 'correct-openai-env-key';
    process.env.FALLBACK_API_KEY = 'wrong-fallback-key';
    process.env.CUSTOM_ENDPOINT_URL = 'http://localhost:4100/v1/chat/completions';
    delete process.env.FALLBACK_AI_PROVIDER;
    globalThis.fetch = async (url, options) => {
      calls.push({ url: String(url), auth: options?.headers?.Authorization || '' });
      if (failures-- > 0) {
        return { ok: false, status: 503, statusText: 'Unavailable', text: async () => 'retry' };
      }
      return { ok: true, json: async () => ({ choices: [{ message: { content: 'fallback-ok' } }] }) };
    };
    const wrongKeyClient = new AIClient(wrongKeyResolved);
    assert.strictEqual(wrongKeyClient.fallback.apiKey, undefined, 'Marked normalization does not inject FALLBACK_API_KEY');
    assert.strictEqual(await wrongKeyClient.sendPrompt({ prompt: 'guard' }), 'fallback-ok');
    assert.strictEqual(calls.at(-1).auth, 'Bearer correct-openai-env-key', 'Backup uses provider env, never FALLBACK_API_KEY');

    calls.length = 0;
    failures = 2;
    const customFallbackClient = new AIClient(interaction);
    assert.strictEqual(await customFallbackClient.sendPrompt({ prompt: 'endpoint guard' }), 'fallback-ok');
    assert.strictEqual(calls.at(-1).url, 'http://localhost:4100/v1/chat/completions',
      'Failover constructor forwards the custom connection endpoint');
    assert.strictEqual(calls.at(-1).auth, 'Bearer custom-shared-key');

    const resolvedNull = resolveAgentConfig(mergeAiConfig(normal, {}), 'continuity', {});
    assert.strictEqual(resolvedNull.fallback, null);
    process.env.FALLBACK_AI_PROVIDER = 'grok';
    assert.strictEqual(new AIClient(resolvedNull).fallback, null, 'Resolved null fallback cannot be revived later');
  } finally {
    globalThis.fetch = realFetch;
    if (previousOpenAi === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousOpenAi;
    if (previousFallbackKey === undefined) delete process.env.FALLBACK_API_KEY;
    else process.env.FALLBACK_API_KEY = previousFallbackKey;
    if (previousFallbackProvider === undefined) delete process.env.FALLBACK_AI_PROVIDER;
    else process.env.FALLBACK_AI_PROVIDER = previousFallbackProvider;
    if (previousCustomEndpoint === undefined) delete process.env.CUSTOM_ENDPOINT_URL;
    else process.env.CUSTOM_ENDPOINT_URL = previousCustomEndpoint;
  }

  const previousStored = await loadAdminAiConfig();
  try {
    await db.run(
      `INSERT INTO server_settings (key, value, updated_at) VALUES ('ai_config', ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
      [JSON.stringify(legacy)]
    );
    await saveAdminAiConfigV2(masked);
    const rewritten = await loadAdminAiConfig();
    assert.strictEqual(rewritten.configVersion, 2);
    assert.strictEqual(rewritten.providers.openai.apiKey, 'stored-primary-key');
    assert.strictEqual(rewritten.modelEntries.find(entry => entry.id === 'legacy_role_referee').apiKey, 'stored-role-key');
    assert.deepStrictEqual(rewritten.voiceApiKeys, legacy.voiceApiKeys);
    assert.strictEqual(rewritten.imageApiKey, 'stored-image-key');

    await db.run(
      `UPDATE server_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'ai_config'`,
      [JSON.stringify(legacyForClear)]
    );
    await saveAdminAiConfigV2(clearLegacyRequest);
    const persistedClear = await loadAdminAiConfig();
    assert.deepStrictEqual(persistedClear, clearedLegacySecrets,
      'The server save seam atomically persists the legacy-safe all-key clear');
  } finally {
    if (previousStored) {
      await db.run(
        `INSERT INTO server_settings (key, value, updated_at) VALUES ('ai_config', ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
        [JSON.stringify(previousStored)]
      );
    } else {
      await db.run(`DELETE FROM server_settings WHERE key = 'ai_config'`);
    }
  }
}

// -------------------------------------------------------------
// Test: am-3 browser-safe registry state and assignment operations
// -------------------------------------------------------------
async function testAdminModelRegistryUiState() {
  console.log(' - Running admin model registry UI state tests...');
  const {
    createRegistryState,
    updateProviderDraft,
    setProviderCatalog,
    createModelEntry,
    addModelEntry,
    updateModelEntry,
    setRoleAssignment,
    modelUsage,
    removeModelEntry,
    validateRegistryState,
    buildRegistryPayload,
    catalogRequestFor
  } = await import('./admin/model-registry.js');

  const roles = Object.fromEntries(
    ['setup', 'interaction', 'continuity', 'referee', 'narration']
      .map(role => [role, { primary: '', fallback: '' }])
  );
  let state = createRegistryState({
    configVersion: 2,
    providers: {
      gemini: { apiKeySet: false },
      openai: { apiKeySet: true },
      claude: { apiKeySet: false },
      grok: { apiKeySet: false },
      custom: { apiKeySet: false, baseUrl: '' },
      ollama: { ollamaUrl: '' },
      'claude-code': {}
    },
    modelEntries: [
      {
        id: 'shared_a', label: 'Shared A', provider: 'openai', model: 'gpt-a',
        keySource: 'provider', apiKeySet: false, legacyDefault: false
      },
      {
        id: 'override', label: 'Override', provider: 'openai', model: 'gpt-b',
        keySource: 'custom', apiKeySet: true, legacyDefault: false
      }
    ],
    defaultModel: '',
    roleAssignments: roles
  });

  state = setProviderCatalog(state, 'openai', { models: [' z-model ', 'a-model', 'a-model'] });
  assert.deepStrictEqual(state.catalogs.openai.models, ['a-model', 'z-model']);
  state = updateProviderDraft(state, 'openai', { apiKey: 'unsaved-provider-key' });
  assert.deepStrictEqual(state.catalogs.openai.models, [], 'Changing a connection invalidates its page cache');
  assert.strictEqual(state.catalogs.openai.loaded, false);
  assert.deepStrictEqual(catalogRequestFor(state, 'openai'), {
    provider: 'openai', apiKey: 'unsaved-provider-key', baseUrl: '', ollamaUrl: ''
  });

  state = addModelEntry(state, createModelEntry('model_new', 'openai'));
  state = updateModelEntry(state, 'model_new', { label: 'Second shared', model: 'gpt-c' });
  assert.strictEqual(validateRegistryState(state), null);
  state = setRoleAssignment(state, 'setup', 'primary', 'shared_a');
  state = setRoleAssignment(state, 'narration', 'fallback', 'shared_a');
  assert.deepStrictEqual(modelUsage(state, 'shared_a'), ['Setup primary', 'Narration fallback']);
  const blockedRemoval = removeModelEntry(state, 'shared_a');
  assert.strictEqual(blockedRemoval.state, state, 'Assigned entries are not removed');
  assert.match(blockedRemoval.error, /Assigned model cannot be removed/);

  state = updateModelEntry(state, 'override', {
    provider: 'claude-code', keySource: 'custom', apiKey: 'must-not-survive', apiKeySet: true
  });
  const codeEntry = state.modelEntries.find(entry => entry.id === 'override');
  assert.deepStrictEqual(
    { keySource: codeEntry.keySource, apiKey: codeEntry.apiKey, apiKeySet: codeEntry.apiKeySet },
    { keySource: 'provider', apiKey: '', apiKeySet: false },
    'Claude Code rows cannot retain custom-key state'
  );

  state = updateModelEntry(state, 'model_new', { label: '' });
  assert.deepStrictEqual(validateRegistryState(state), {
    anchor: 'model-model_new', message: 'Model row 3 needs a label.'
  }, 'Inline validation identifies the exact model row');
  state = updateModelEntry(state, 'model_new', { label: 'Second shared' });

  const beforeClearAssignments = structuredClone(state.roleAssignments);
  const cleared = buildRegistryPayload(state, { clearKeys: true });
  assert.strictEqual(cleared.configVersion, 2, 'The browser payload uses the v2 settings wire');
  assert.strictEqual(cleared.providers.openai.apiKey, null, 'Clear action clears provider keys');
  assert.strictEqual(cleared.modelEntries.find(entry => entry.id === 'override').keySource, 'provider');
  assert.deepStrictEqual(cleared.roleAssignments, beforeClearAssignments, 'Clear action never changes assignments');
  assert.strictEqual(JSON.stringify(cleared).includes('must-not-survive'), false);
}

// -------------------------------------------------------------
// Test: am-cc Claude Code subscription transport
// -------------------------------------------------------------
async function testClaudeCodeProvider() {
  console.log(' - Running Claude Code subscription provider tests...');
  const {
    callClaudeCode,
    claudeCodeTimeoutMs,
    parseClaudeCodeAuthStatus,
    resolveClaudeCodeExecutable,
    runClaudeCodeProcess
  } = await import('./claude-code-provider.js');

  const executable = path.resolve(os.tmpdir(), 'fake-claude-code');
  const childEnv = {
    PATH: process.env.PATH || '',
    CLAUDE_CODE_PATH: executable,
    CLAUDE_CODE_OAUTH_TOKEN: 'subscription-oauth-token',
    ANTHROPIC_API_KEY: 'must-not-reach-child',
    anthropic_auth_token: 'case-insensitive-strip',
    ANTHROPIC_BASE_URL: 'https://api-key-proxy.invalid',
    CLAUDE_CODE_USE_BEDROCK: '1',
    CLAUDE_CODE_USE_VERTEX: '1',
    CLAUDE_CODE_USE_FOUNDRY: '1'
  };
  const calls = [];
  let generationStarted = false;
  const successfulRunner = async spec => {
    calls.push({ ...spec, args: [...spec.args], env: { ...spec.env } });
    if (spec.args[0] === 'auth') {
      const apiCredentialReachedChild = Object.keys(spec.env)
        .some(key => ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN'].includes(key.toUpperCase()));
      return {
        exitCode: 0,
        stdout: JSON.stringify({
          loggedIn: true,
          authMethod: apiCredentialReachedChild ? 'apiKey' : 'claude.ai',
          subscriptionType: 'max',
          apiProvider: 'firstParty',
          email: 'private@example.invalid',
          organization: 'private-org'
        }),
        stderr: ''
      };
    }
    generationStarted = true;
    return {
      exitCode: 0,
      stdout: JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'subscription-ok' }),
      stderr: ''
    };
  };

  const opaqueModel = 'available-model; touch /tmp/never';
  assert.strictEqual(await callClaudeCode({
    systemInstruction: 'You are the engine GM.',
    prompt: 'Generate the campaign.',
    model: opaqueModel,
    env: childEnv,
    runner: successfulRunner
  }), 'subscription-ok');
  assert.strictEqual(calls.length, 2, 'Auth is checked before one generation call');
  assert.strictEqual(generationStarted, true, 'Sanitized subscription auth permits generation');
  assert.deepStrictEqual(calls[0].args, ['auth', 'status', '--json']);
  assert.strictEqual(calls[0].executable, executable);
  assert.strictEqual(calls[0].cwd, calls[1].cwd, 'Auth and generation share the isolated workspace');
  assert.strictEqual(fs.existsSync(calls[0].cwd), false, 'Temporary workspace is removed after success');
  assert.strictEqual(calls[1].shell, false, 'The runner contract is explicitly shell-free');
  assert.strictEqual(calls[1].stdin, 'Generate the campaign.', 'Prompt content travels only through stdin');
  assert.strictEqual(calls[1].env.CLAUDE_CODE_OAUTH_TOKEN, 'subscription-oauth-token', 'Subscription OAuth survives sanitization');
  for (const key of ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL',
    'CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX', 'CLAUDE_CODE_USE_FOUNDRY']) {
    assert.strictEqual(Object.keys(calls[1].env).some(candidate => candidate.toUpperCase() === key), false,
      `${key} must not reach Claude Code`);
  }
  const generationArgs = calls[1].args;
  const argValue = flag => generationArgs[generationArgs.indexOf(flag) + 1];
  for (const flag of ['--print', '--no-session-persistence', '--disable-slash-commands',
    '--strict-mcp-config', '--no-chrome']) {
    assert.notStrictEqual(generationArgs.indexOf(flag), -1, `${flag} is required for isolation`);
  }
  assert.strictEqual(argValue('--output-format'), 'json');
  assert.strictEqual(argValue('--max-turns'), '1');
  assert.strictEqual(argValue('--tools'), '');
  assert.strictEqual(argValue('--setting-sources'), '');
  assert.strictEqual(argValue('--mcp-config'), '{"mcpServers":{}}');
  assert.strictEqual(argValue('--permission-mode'), 'dontAsk');
  assert.strictEqual(argValue('--system-prompt'), 'You are the engine GM.');
  assert.strictEqual(argValue('--model'), opaqueModel, 'Configured model is one opaque argv value');

  const authStatus = parseClaudeCodeAuthStatus(JSON.stringify({
    loggedIn: true,
    authMethod: 'claude.ai',
    subscriptionType: 'max',
    apiProvider: 'firstParty',
    email: 'must-not-return@example.invalid',
    organization: 'must-not-return'
  }));
  assert.deepStrictEqual(authStatus, {
    installed: true,
    loggedIn: true,
    authMethod: 'claude.ai',
    subscriptionType: 'max',
    apiProvider: 'firstParty'
  }, 'Auth parsing returns only safe plan fields');

  calls.length = 0;
  await callClaudeCode({ prompt: 'default-model', model: 'default', env: childEnv, runner: successfulRunner });
  assert.strictEqual(calls[1].args.includes('--model'), false, 'Reserved default omits --model');
  calls.length = 0;
  await callClaudeCode({ prompt: 'blank-model', model: '', env: childEnv, runner: successfulRunner });
  assert.strictEqual(calls[1].args.includes('--model'), false, 'Blank model also uses the logged-in CLI default');

  let authOnlyCalls = 0;
  await assert.rejects(callClaudeCode({
    prompt: 'must-not-run',
    env: childEnv,
    runner: async spec => {
      authOnlyCalls += 1;
      return {
        exitCode: 0,
        stdout: JSON.stringify({ loggedIn: true, authMethod: 'apiKey' }),
        stderr: 'PRIVATE_AUTH_DIAGNOSTIC'
      };
    }
  }), error => error.code === 'SUBSCRIPTION_AUTH_REQUIRED'
    && !error.message.includes('PRIVATE_AUTH_DIAGNOSTIC'));
  assert.strictEqual(authOnlyCalls, 1, 'API-key authentication fails before generation');

  const envelopeRunner = envelope => async spec => spec.args[0] === 'auth'
    ? {
        exitCode: 0,
        stdout: JSON.stringify({ loggedIn: true, authMethod: 'claude.ai', subscriptionType: 'max' }),
        stderr: ''
      }
    : envelope;
  await assert.rejects(callClaudeCode({
    prompt: 'transient',
    env: childEnv,
    runner: envelopeRunner({
      exitCode: 1,
      stdout: JSON.stringify({ is_error: true, api_error_status: 503, result: 'PRIVATE_PROVIDER_BODY' }),
      stderr: 'PRIVATE_STDERR'
    })
  }), error => error.status === 503 && isTransientAiError(error)
    && !error.message.includes('PRIVATE_PROVIDER_BODY') && !error.message.includes('PRIVATE_STDERR'));
  await assert.rejects(callClaudeCode({
    prompt: 'bad-model',
    env: childEnv,
    runner: envelopeRunner({
      exitCode: 1,
      stdout: JSON.stringify({ is_error: true, api_error_status: 404, result: 'PRIVATE_MODEL_NAME' }),
      stderr: ''
    })
  }), error => error.status === 404 && !isTransientAiError(error)
    && !error.message.includes('PRIVATE_MODEL_NAME'));
  let failedCwd = '';
  await assert.rejects(callClaudeCode({
    prompt: 'malformed',
    env: childEnv,
    runner: async spec => {
      failedCwd = spec.cwd;
      return spec.args[0] === 'auth'
        ? { exitCode: 0, stdout: JSON.stringify({ loggedIn: true, authMethod: 'claude.ai' }), stderr: '' }
        : { exitCode: 1, stdout: 'PRIVATE_MALFORMED_OUTPUT', stderr: 'PRIVATE_MALFORMED_STDERR' };
    }
  }), error => error.code === 'INVALID_RESPONSE'
    && !error.message.includes('PRIVATE_MALFORMED_OUTPUT') && !error.message.includes('PRIVATE_MALFORMED_STDERR'));
  assert.strictEqual(fs.existsSync(failedCwd), false, 'Temporary workspace is removed after failure');

  assert.strictEqual(claudeCodeTimeoutMs({ CLAUDE_CODE_TIMEOUT_MS: '1000' }), 1000);
  assert.strictEqual(claudeCodeTimeoutMs({ CLAUDE_CODE_TIMEOUT_MS: '999' }), 240000);
  assert.strictEqual(claudeCodeTimeoutMs({ CLAUDE_CODE_TIMEOUT_MS: '900001' }), 240000);
  assert.throws(() => resolveClaudeCodeExecutable({ CLAUDE_CODE_PATH: './relative-claude' }),
    error => error.code === 'INVALID_EXECUTABLE' && !error.message.includes('relative-claude'));
  await assert.rejects(callClaudeCode({
    prompt: 'missing',
    env: { CLAUDE_CODE_PATH: path.resolve(os.tmpdir(), 'definitely-missing-claude-code') }
  }), error => error.code === 'EXECUTABLE_UNAVAILABLE'
    && !error.message.includes('definitely-missing-claude-code'));
  await assert.rejects(runClaudeCodeProcess({
    executable: process.execPath,
    args: ['-e', 'setInterval(() => {}, 1000)'],
    stdin: '',
    env: process.env,
    cwd: os.tmpdir(),
    timeoutMs: 40,
    maxOutputBytes: 1024
  }), error => error.code === 'TIMEOUT' && error.transient === true);
  await assert.rejects(runClaudeCodeProcess({
    executable: process.execPath,
    args: ['-e', "process.stdout.write('x'.repeat(512))"],
    stdin: '',
    env: process.env,
    cwd: os.tmpdir(),
    timeoutMs: 1000,
    maxOutputBytes: 64
  }), error => error.code === 'OUTPUT_LIMIT' && error.transient !== true);

  assert.throws(() => new AIClient({ provider: 'claude-code', apiKey: 'must-reject' }),
    /does not accept API keys/);
  const previousProvider = process.env.AI_PROVIDER;
  const previousModel = process.env.AI_MODEL;
  const realFetch = globalThis.fetch;
  try {
    process.env.AI_PROVIDER = 'claude-code';
    delete process.env.AI_MODEL;
    calls.length = 0;
    const environmentClient = new AIClient({ claudeCodeRunner: successfulRunner, claudeCodeEnv: childEnv });
    assert.strictEqual(environmentClient.model, 'default', 'Blank Claude Code model never inherits an HTTP default');
    assert.strictEqual(environmentClient.apiKey, null);
    assert.strictEqual(await environmentClient.sendPrompt({ systemInstruction: 'system', prompt: 'environment-only' }), 'subscription-ok');
    assert.strictEqual(calls[1].args.includes('--model'), false, 'Environment-only AIClient dispatch uses the CLI default');

    let httpFailures = 2;
    process.env.AI_MODEL = 'must-not-leak-to-claude-code-fallback';
    globalThis.fetch = async () => {
      if (httpFailures-- > 0) {
        return { ok: false, status: 503, statusText: 'Unavailable', text: async () => 'retry' };
      }
      throw new Error('Unexpected third HTTP request');
    };
    calls.length = 0;
    const subscriptionFallback = new AIClient({
      provider: 'openai',
      model: 'primary-http',
      apiKey: 'http-key',
      fallbackResolved: true,
      fallback: { provider: 'claude-code', apiKey: 'must-not-survive' },
      claudeCodeRunner: successfulRunner,
      claudeCodeEnv: childEnv
    });
    assert.strictEqual(subscriptionFallback.fallback.apiKey, undefined,
      'Claude Code fallback discards FALLBACK_API_KEY/custom key material');
    assert.strictEqual(subscriptionFallback.fallback.model, 'default',
      'Blank Claude Code fallback does not inherit the primary AI_MODEL');
    assert.strictEqual(await subscriptionFallback.sendPrompt({ prompt: 'fallback-to-subscription' }), 'subscription-ok');
    assert.strictEqual(calls.at(-1).args.includes('--model'), false, 'Fallback AIClient also preserves the CLI default');

    let generationFailures = 2;
    const transientRunner = envelopeRunner({
      exitCode: 1,
      stdout: JSON.stringify({ is_error: true, api_error_status: 503 }),
      stderr: 'PRIVATE_TRANSIENT_DETAIL'
    });
    const countingTransientRunner = async spec => {
      if (spec.args[0] === 'auth') return transientRunner(spec);
      generationFailures -= 1;
      return transientRunner(spec);
    };
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'http-fallback-ok' } }] })
    });
    const transientPrimary = new AIClient({
      provider: 'claude-code',
      fallbackResolved: true,
      fallback: { provider: 'openai', model: 'backup-http', apiKey: 'backup-key' },
      claudeCodeRunner: countingTransientRunner,
      claudeCodeEnv: childEnv
    });
    assert.strictEqual(await transientPrimary.sendPrompt({ prompt: 'subscription-transient' }), 'http-fallback-ok',
      'Numeric Claude status participates in existing retry and fallback behavior');
    assert.strictEqual(generationFailures, 0, 'Claude Code retries exactly once before fallback');
  } finally {
    globalThis.fetch = realFetch;
    if (previousProvider === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = previousProvider;
    if (previousModel === undefined) delete process.env.AI_MODEL;
    else process.env.AI_MODEL = previousModel;
  }
}

// -------------------------------------------------------------
// Test: am-2 live model catalogs, endpoint policy, and admin boundary
// -------------------------------------------------------------
async function testModelCatalogs() {
  console.log(' - Running provider model catalog tests...');
  const {
    ModelCatalogError,
    deriveCustomModelsUrl,
    listModels,
    parseClaudeModels,
    parseGeminiModels,
    parseGrokModels,
    parseOllamaModels,
    parseOpenAiModels
  } = await import('./model-catalog.js');
  const { getClaudeCodeStatus } = await import('./claude-code-provider.js');
  const {
    projectAdminAiConfigV2,
    validateAdminAiConfigV2,
    loadAdminAiConfig
  } = await import('./server-config.js');

  assert.deepStrictEqual(parseGeminiModels({ models: [
    { name: 'models/zeta', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/embed-only', supportedGenerationMethods: ['embedContent'] },
    { name: 'models/alpha', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/alpha', supportedGenerationMethods: ['generateContent'] }
  ] }), ['alpha', 'zeta']);
  assert.deepStrictEqual(parseOpenAiModels({ data: [
    { id: 'text-model' }, { id: 'image-looking-name' }, { id: 'text-model' }
  ] }), ['image-looking-name', 'text-model'], 'OpenAI ids are not filtered by guessed name patterns');
  assert.deepStrictEqual(parseClaudeModels({ data: [{ id: 'claude-z' }, { id: 'claude-a' }] }),
    ['claude-a', 'claude-z']);
  assert.deepStrictEqual(parseGrokModels({ models: [
    { id: 'grok-z', aliases: ['grok-latest', 'grok-z'], output_modalities: ['text'] },
    { id: 'grok-image', aliases: ['grok-image-latest'], output_modalities: ['image'] },
    { id: 'grok-a', aliases: [], output_modalities: ['text'] }
  ] }), ['grok-a', 'grok-latest', 'grok-z'], 'Grok returns language ids plus advertised aliases only');
  assert.deepStrictEqual(parseOllamaModels({ models: [{ name: 'z-local' }, { name: 'a-local' }] }),
    ['a-local', 'z-local']);
  for (const malformed of [
    () => parseGeminiModels({ models: [{ name: 'models/x' }] }),
    () => parseOpenAiModels({ data: null }),
    () => parseClaudeModels({ data: [{ id: 3 }] }),
    () => parseGrokModels({ models: [{ id: 'x', aliases: 'latest', output_modalities: ['text'] }] }),
    () => parseOllamaModels({ models: [{}] })
  ]) assert.throws(malformed, 'Malformed success fixtures fail closed');

  assert.strictEqual(
    deriveCustomModelsUrl('https://openrouter.ai/api/v1/chat/completions/?ignored=secret'),
    'https://openrouter.ai/api/v1/models'
  );
  assert.throws(() => deriveCustomModelsUrl('https://openrouter.ai/api/v1'), ModelCatalogError);

  const catalogCalls = [];
  const response = data => ({ ok: true, status: 200, json: async () => data });
  const fetchFixture = data => async (url, options) => {
    catalogCalls.push({ url: String(url), headers: { ...options.headers } });
    return response(data);
  };

  let listed = await listModels('gemini', {
    apiKey: 'gemini secret & value',
    fetchImpl: fetchFixture({ models: [{ name: 'models/gemini-live', supportedGenerationMethods: ['generateContent'] }] })
  });
  assert.deepStrictEqual(listed, { models: ['gemini-live'], manualEntry: true });
  const geminiUrl = new URL(catalogCalls.at(-1).url);
  assert.strictEqual(geminiUrl.origin + geminiUrl.pathname,
    'https://generativelanguage.googleapis.com/v1beta/models');
  assert.strictEqual(geminiUrl.searchParams.get('pageSize'), '1000');
  assert.strictEqual(geminiUrl.searchParams.get('key'), 'gemini secret & value');

  listed = await listModels('openai', {
    apiKey: 'openai-key',
    fetchImpl: fetchFixture({ data: [{ id: 'openai-live' }] })
  });
  assert.deepStrictEqual(listed.models, ['openai-live']);
  assert.strictEqual(catalogCalls.at(-1).url, 'https://api.openai.com/v1/models');
  assert.strictEqual(catalogCalls.at(-1).headers.Authorization, 'Bearer openai-key');

  listed = await listModels('claude', {
    apiKey: 'claude-key',
    fetchImpl: fetchFixture({ data: [{ id: 'claude-live' }] })
  });
  assert.deepStrictEqual(listed.models, ['claude-live']);
  assert.strictEqual(catalogCalls.at(-1).url, 'https://api.anthropic.com/v1/models?limit=1000');
  assert.strictEqual(catalogCalls.at(-1).headers['x-api-key'], 'claude-key');
  assert.strictEqual(catalogCalls.at(-1).headers['anthropic-version'], '2023-06-01');

  listed = await listModels('grok', {
    apiKey: 'grok-key',
    fetchImpl: fetchFixture({ models: [{
      id: 'grok-live', aliases: ['grok-live-latest'], output_modalities: ['text']
    }] })
  });
  assert.deepStrictEqual(listed.models, ['grok-live', 'grok-live-latest']);
  assert.strictEqual(catalogCalls.at(-1).url, 'https://api.x.ai/v1/language-models');
  assert.strictEqual(catalogCalls.at(-1).headers.Authorization, 'Bearer grok-key');

  listed = await listModels('ollama', {
    ollamaUrl: 'http://localhost:11434',
    env: {},
    fetchImpl: fetchFixture({ models: [{ name: 'local-live' }] })
  });
  assert.deepStrictEqual(listed.models, ['local-live']);
  assert.strictEqual(catalogCalls.at(-1).url, 'http://localhost:11434/api/tags');

  listed = await listModels('custom', {
    apiKey: 'custom-key',
    baseUrl: 'https://api.openai.com/custom/v1/chat/completions/',
    env: {},
    fetchImpl: fetchFixture({ data: [{ id: 'custom-live' }] })
  });
  assert.deepStrictEqual(listed.models, ['custom-live']);
  assert.strictEqual(catalogCalls.at(-1).url, 'https://api.openai.com/custom/v1/models');
  assert.strictEqual(catalogCalls.at(-1).headers.Authorization, 'Bearer custom-key');

  const privateMarker = 'PRIVATE_CATALOG_BODY_AND_KEY';
  await assert.rejects(listModels('openai', {
    apiKey: privateMarker,
    fetchImpl: async () => ({
      ok: false,
      status: 401,
      text: async () => privateMarker,
      json: async () => { throw new Error(privateMarker); }
    })
  }), error => error.status === 502 && error.message === 'Could not list openai models (401).'
    && !error.message.includes(privateMarker));
  await assert.rejects(listModels('openai', {
    apiKey: privateMarker,
    fetchImpl: async () => { throw new Error(privateMarker); }
  }), error => error.code === 'CATALOG_NETWORK' && !error.message.includes(privateMarker));
  await assert.rejects(listModels('openai', {
    apiKey: privateMarker,
    fetchImpl: fetchFixture({ malformed: true })
  }), error => error.code === 'CATALOG_INVALID_RESPONSE' && !error.message.includes(privateMarker));
  await assert.rejects(listModels('openai', {
    apiKey: privateMarker,
    timeoutMs: 5,
    fetchImpl: async (url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => {
        const error = new Error(privateMarker);
        error.name = 'AbortError';
        reject(error);
      });
    })
  }), error => error.code === 'CATALOG_TIMEOUT' && error.status === 504
    && !error.message.includes(privateMarker));
  await assert.rejects(listModels('openai', {
    apiKey: privateMarker,
    timeoutMs: 10,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => {
        await new Promise(resolve => setTimeout(resolve, 75));
        return { data: [{ id: privateMarker }] };
      }
    })
  }), error => error.code === 'CATALOG_TIMEOUT' && error.status === 504
    && !error.message.includes(privateMarker));
  let blockedFetches = 0;
  await assert.rejects(listModels('custom', {
    baseUrl: 'https://api.openai.com/not-a-chat-url',
    fetchImpl: async () => { blockedFetches += 1; }
  }), error => error.status === 400 && !error.message.includes('api.openai.com'));
  await assert.rejects(listModels('ollama', {
    ollamaUrl: 'http://127.0.0.1:19999',
    env: {},
    fetchImpl: async () => { blockedFetches += 1; }
  }), error => error.code === 'CATALOG_ENDPOINT_BLOCKED' && !error.message.includes('127.0.0.1'));
  assert.strictEqual(blockedFetches, 0, 'Invalid/blocked endpoints never fetch');

  let statusImplCalls = 0;
  const codeCatalog = await listModels('claude-code', {
    apiKey: privateMarker,
    baseUrl: `https://${privateMarker}.invalid`,
    fetchImpl: async () => { throw new Error('Claude Code catalog must not fetch'); },
    claudeCodeStatusImpl: async () => {
      statusImplCalls += 1;
      return {
        installed: true,
        loggedIn: true,
        authMethod: 'claude.ai',
        subscriptionType: 'max',
        version: '2.1.210',
        email: 'PRIVATE_EMAIL',
        organization: 'PRIVATE_ORG',
        executable: '/PRIVATE/PATH',
        raw: 'PRIVATE_RAW'
      };
    }
  });
  assert.deepStrictEqual(codeCatalog, {
    models: [],
    manualEntry: true,
    status: {
      installed: true,
      loggedIn: true,
      authMethod: 'claude.ai',
      subscriptionType: 'max',
      version: '2.1.210'
    }
  });
  assert.strictEqual(statusImplCalls, 1);
  assert.strictEqual(JSON.stringify(codeCatalog).includes('PRIVATE_'), false);

  const statusCalls = [];
  let statusCwd = '';
  const safeStatus = await getClaudeCodeStatus({
    env: {
      CLAUDE_CODE_PATH: path.resolve(os.tmpdir(), 'fake-status-claude'),
      ANTHROPIC_API_KEY: privateMarker,
      CLAUDE_CODE_OAUTH_TOKEN: 'subscription-token'
    },
    runner: async spec => {
      statusCalls.push({ ...spec, args: [...spec.args], env: { ...spec.env } });
      statusCwd = spec.cwd;
      if (spec.args[0] === '--version') {
        return { exitCode: 0, stdout: '2.1.210 (Claude Code)\n', stderr: '' };
      }
      return {
        exitCode: 0,
        stdout: JSON.stringify({
          loggedIn: true, authMethod: 'claude.ai', subscriptionType: 'max',
          email: 'PRIVATE_EMAIL', organization: 'PRIVATE_ORG'
        }),
        stderr: ''
      };
    }
  });
  assert.deepStrictEqual(safeStatus, {
    installed: true, loggedIn: true, authMethod: 'claude.ai', subscriptionType: 'max', version: '2.1.210'
  });
  assert.deepStrictEqual(statusCalls.map(call => call.args), [['--version'], ['auth', 'status', '--json']]);
  assert.strictEqual(statusCalls.every(call => call.timeoutMs <= 10000), true, 'Status commands share the 10-second catalog deadline');
  assert.strictEqual(statusCalls[0].env.ANTHROPIC_API_KEY, undefined);
  assert.strictEqual(statusCalls[0].env.CLAUDE_CODE_OAUTH_TOKEN, 'subscription-token');
  assert.strictEqual(fs.existsSync(statusCwd), false, 'Status workspace is removed');
  const unavailableStatus = await getClaudeCodeStatus({
    env: { CLAUDE_CODE_PATH: path.resolve(os.tmpdir(), 'missing-status-claude') },
    runner: async () => { throw new Error(privateMarker); }
  });
  assert.deepStrictEqual(unavailableStatus, {
    installed: false, loggedIn: false, authMethod: '', subscriptionType: '', version: ''
  }, 'Missing/failed CLI status is safe and non-throwing');
  let apiAuthStep = 0;
  const apiAuthStatus = await getClaudeCodeStatus({
    env: { CLAUDE_CODE_PATH: path.resolve(os.tmpdir(), 'api-auth-status-claude') },
    runner: async () => apiAuthStep++ === 0
      ? { exitCode: 0, stdout: '2.1.210 (Claude Code)', stderr: '' }
      : {
          exitCode: 0,
          stdout: JSON.stringify({ loggedIn: true, authMethod: 'apiKey', email: 'PRIVATE_EMAIL' }),
          stderr: ''
        }
  });
  assert.deepStrictEqual(apiAuthStatus, {
    installed: true, loggedIn: false, authMethod: 'apiKey', subscriptionType: '', version: '2.1.210'
  }, 'API authentication is reported but never treated as subscription login');

  const { app } = await import('./server.js');
  const db = await import('./db.js');
  const http = await import('http');
  const previousStored = await loadAdminAiConfig();
  const previousAdmin = process.env.ADMIN_SECRET;
  const previousAccess = process.env.ACCESS_SECRET;
  const previousOpenAi = process.env.OPENAI_API_KEY;
  const previousNodeEnv = process.env.NODE_ENV;
  const previousCustomEndpoint = process.env.CUSTOM_ENDPOINT_URL;
  const previousOllamaEndpoint = process.env.OLLAMA_URL;
  let server;
  const routeFetches = [];
  const blank = projectAdminAiConfigV2(null);
  const storedConfig = validateAdminAiConfigV2({
    ...blank,
    providers: {
      ...blank.providers,
      openai: { apiKey: 'provider-stored-key' },
      custom: { apiKey: 'custom-stored-key', baseUrl: 'https://api.openai.com/stored/v1/chat/completions' },
      ollama: { ollamaUrl: 'https://api.openai.com/stored-ollama' }
    },
    modelEntries: [
      {
        id: 'openai_override', label: 'OpenAI override', provider: 'openai', model: 'entry-model',
        keySource: 'custom', apiKey: 'entry-override-key', legacyDefault: false
      },
      {
        id: 'claude_entry', label: 'Claude entry', provider: 'claude', model: 'claude-model',
        keySource: 'provider', apiKey: '', legacyDefault: false
      }
    ]
  });
  const writeStored = config => db.run(
    `INSERT INTO server_settings (key, value, updated_at) VALUES ('ai_config', ?, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
    [JSON.stringify(config)]
  );

  try {
    process.env.ADMIN_SECRET = 'catalog-admin';
    process.env.ACCESS_SECRET = 'catalog-host';
    process.env.OPENAI_API_KEY = 'environment-openai-key';
    delete process.env.CUSTOM_ENDPOINT_URL;
    delete process.env.OLLAMA_URL;
    process.env.NODE_ENV = 'test';
    await writeStored(storedConfig);
    app.locals.modelCatalogFetch = async (url, options) => {
      const call = { url: String(url), headers: { ...options.headers } };
      routeFetches.push(call);
      if (call.url.endsWith('/api/tags')) return response({ models: [{ name: 'route-local' }] });
      return response({ data: [{ id: 'route-model' }] });
    };
    app.locals.claudeCodeStatusImpl = async () => ({
      installed: true,
      loggedIn: true,
      authMethod: 'claude.ai',
      subscriptionType: 'max',
      version: '2.1.210',
      email: 'PRIVATE_ROUTE_EMAIL',
      raw: privateMarker
    });

    server = await new Promise(resolve => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    const port = server.address().port;
    const request = (body, token = 'catalog-admin') => new Promise((resolve, reject) => {
      const payload = Buffer.from(JSON.stringify(body));
      const req = http.request({
        host: '127.0.0.1',
        port,
        path: '/api/admin/models/catalog',
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Content-Type': 'application/json',
          'Content-Length': payload.length
        }
      }, response => {
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => resolve({
          status: response.statusCode,
          json: JSON.parse(Buffer.concat(chunks).toString('utf8'))
        }));
      });
      req.on('error', reject);
      req.end(payload);
    });
    const settingsRequest = (method, body, token = 'catalog-admin') => new Promise((resolve, reject) => {
      const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
      const req = http.request({
        host: '127.0.0.1',
        port,
        path: '/api/admin/settings',
        method,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(payload ? {
            'Content-Type': 'application/json',
            'Content-Length': payload.length
          } : {})
        }
      }, response => {
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => resolve({
          status: response.statusCode,
          json: JSON.parse(Buffer.concat(chunks).toString('utf8'))
        }));
      });
      req.on('error', reject);
      req.end(payload || undefined);
    });

    assert.strictEqual((await request({ provider: 'openai' }, null)).status, 401,
      'Catalog requires the admin credential');
    assert.strictEqual((await request({ provider: 'openai' }, 'catalog-host')).status, 401,
      'Game host credentials cannot reach admin catalogs');

    let settingsResult = await settingsRequest('GET');
    assert.strictEqual(settingsResult.status, 200);
    assert.strictEqual(settingsResult.json.configVersion, 2, 'Admin GET atomically activates the v2 DTO');
    assert.strictEqual(settingsResult.json.providers.openai.apiKeySet, true);
    assert.strictEqual(settingsResult.json.modelEntries.find(entry => entry.id === 'openai_override').apiKeySet, true);
    assert.strictEqual(JSON.stringify(settingsResult.json).includes('provider-stored-key'), false);
    assert.strictEqual(JSON.stringify(settingsResult.json).includes('entry-override-key'), false);

    settingsResult = await settingsRequest('POST', settingsResult.json);
    assert.strictEqual(settingsResult.status, 200, 'A projected masked DTO performs the canonical v2 rewrite');
    const rewrittenSettings = await loadAdminAiConfig();
    assert.strictEqual(rewrittenSettings.configVersion, 2);
    assert.strictEqual(rewrittenSettings.providers.openai.apiKey, 'provider-stored-key');
    assert.strictEqual(rewrittenSettings.modelEntries.find(entry => entry.id === 'openai_override').apiKey,
      'entry-override-key');
    assert.strictEqual(JSON.stringify(settingsResult.json).includes('stored-key'), false,
      'Admin save responses never contain credentials');
    settingsResult = await settingsRequest('POST', { configVersion: 1 });
    assert.strictEqual(settingsResult.status, 400, 'Invalid v2 settings receive a typed 400');

    let result = await request({
      provider: 'openai', modelEntryId: 'openai_override', apiKey: 'unsaved-request-key'
    });
    assert.strictEqual(result.status, 200);
    assert.strictEqual(routeFetches.at(-1).headers.Authorization, 'Bearer unsaved-request-key');
    assert.strictEqual(JSON.stringify(result.json).includes('request-key'), false, 'Route never returns credentials');

    result = await request({ provider: 'openai', modelEntryId: 'openai_override' });
    assert.strictEqual(result.status, 200);
    assert.strictEqual(routeFetches.at(-1).headers.Authorization, 'Bearer entry-override-key');

    result = await request({ provider: 'openai' });
    assert.strictEqual(result.status, 200);
    assert.strictEqual(routeFetches.at(-1).headers.Authorization, 'Bearer provider-stored-key');

    await writeStored({
      ...storedConfig,
      providers: { ...storedConfig.providers, openai: { apiKey: '' } }
    });
    result = await request({ provider: 'openai' });
    assert.strictEqual(result.status, 200);
    assert.strictEqual(routeFetches.at(-1).headers.Authorization, 'Bearer environment-openai-key');

    const beforeSpoof = routeFetches.length;
    result = await request({ provider: 'openai', modelEntryId: 'claude_entry' });
    assert.strictEqual(result.status, 400);
    assert.strictEqual(routeFetches.length, beforeSpoof, 'Cross-provider entry-id spoofing never fetches');

    await writeStored(storedConfig);
    result = await request({
      provider: 'custom',
      baseUrl: 'https://api.openai.com/unsaved/v1/chat/completions',
      apiKey: 'custom-unsaved-key'
    });
    assert.strictEqual(result.status, 200);
    assert.strictEqual(routeFetches.at(-1).url, 'https://api.openai.com/unsaved/v1/models');
    assert.strictEqual(routeFetches.at(-1).headers.Authorization, 'Bearer custom-unsaved-key');
    result = await request({ provider: 'custom' });
    assert.strictEqual(result.status, 200);
    assert.strictEqual(routeFetches.at(-1).url, 'https://api.openai.com/stored/v1/models');
    assert.strictEqual(routeFetches.at(-1).headers.Authorization, 'Bearer custom-stored-key');

    const beforeCodeStatus = routeFetches.length;
    result = await request({
      provider: 'claude-code', apiKey: privateMarker, baseUrl: `https://${privateMarker}.invalid`
    });
    assert.strictEqual(result.status, 200);
    assert.deepStrictEqual(result.json, codeCatalog);
    assert.strictEqual(routeFetches.length, beforeCodeStatus, 'Claude Code refresh performs no model/network call');
    assert.strictEqual(JSON.stringify(result.json).includes('PRIVATE_'), false);

    process.env.NODE_ENV = 'production';
    delete process.env.CUSTOM_ENDPOINT_URL;
    const beforeDiscarded = routeFetches.length;
    result = await request({
      provider: 'custom', baseUrl: 'https://api.openai.com/request/v1/chat/completions'
    });
    assert.strictEqual(result.status, 400);
    assert.strictEqual(routeFetches.length, beforeDiscarded,
      'Production discards request and stored custom endpoints before derivation/fetch');

    process.env.CUSTOM_ENDPOINT_URL = 'https://api.openai.com/env/v1/chat/completions';
    result = await request({
      provider: 'custom', baseUrl: 'https://api.openai.com/request/v1/chat/completions'
    });
    assert.strictEqual(result.status, 200);
    assert.strictEqual(routeFetches.at(-1).url, 'https://api.openai.com/env/v1/models',
      'Only the env-pinned custom URL survives production policy');

    delete process.env.OLLAMA_URL;
    const runtimeOllama = new AIClient({ provider: 'ollama', ollamaUrl: 'https://api.openai.com/request-ollama' });
    result = await request({ provider: 'ollama', ollamaUrl: 'https://api.openai.com/request-ollama' });
    assert.strictEqual(result.status, 200);
    assert.strictEqual(routeFetches.at(-1).url, 'http://localhost:11434/api/tags');
    assert.strictEqual(runtimeOllama.ollamaUrl, 'http://localhost:11434',
      'Catalog and AIClient share the same production Ollama default');
  } finally {
    delete app.locals.modelCatalogFetch;
    delete app.locals.claudeCodeStatusImpl;
    if (server) await new Promise(resolve => server.close(resolve));
    if (previousStored) await writeStored(previousStored);
    else await db.run(`DELETE FROM server_settings WHERE key = 'ai_config'`);
    if (previousAdmin === undefined) delete process.env.ADMIN_SECRET;
    else process.env.ADMIN_SECRET = previousAdmin;
    if (previousAccess === undefined) delete process.env.ACCESS_SECRET;
    else process.env.ACCESS_SECRET = previousAccess;
    if (previousOpenAi === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousOpenAi;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousCustomEndpoint === undefined) delete process.env.CUSTOM_ENDPOINT_URL;
    else process.env.CUSTOM_ENDPOINT_URL = previousCustomEndpoint;
    if (previousOllamaEndpoint === undefined) delete process.env.OLLAMA_URL;
    else process.env.OLLAMA_URL = previousOllamaEndpoint;
  }
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
  const {
    GROK_TTS_VOICES,
    VOICE_DELIVERY_VALUES,
    assignNpcVoiceProfile,
    createNarratorVoiceProfile,
    getTtsProviderCatalog,
    resolveNarratorVoiceProfile,
    resolveNpcVoiceProfile,
    synthesizeSpeech,
    validateVoiceDelivery,
    validateVoiceProfile,
    listTtsProviders
  } = await import('./tts-providers.js');

  assert.deepStrictEqual(listTtsProviders(), ['openai', 'grok'], 'OpenAI and Grok are registered');
  assert.deepStrictEqual(GROK_TTS_VOICES, [
    'altair', 'atlas', 'castor', 'cosmo', 'helios', 'helix', 'kepler', 'leo', 'lumen', 'lux', 'naksh',
    'orion', 'perseus', 'rex', 'rigel', 'sal', 'sirius', 'zagan', 'zenith',
    'ara', 'carina', 'celeste', 'eve', 'iris', 'luna', 'ursa'
  ], 'The live-verified ordered Grok voice registry stays pinned at 26');
  const catalog = getTtsProviderCatalog();
  assert.deepStrictEqual(catalog.map(entry => entry.provider), ['openai', 'grok']);
  assert.strictEqual(catalog.find(entry => entry.provider === 'grok').narratorVoice, 'leo');
  assert.strictEqual(catalog.find(entry => entry.provider === 'grok').hasModel, false);
  assert.strictEqual(catalog.find(entry => entry.provider === 'grok').maxSegmentsPerRequest, 40);
  assert.strictEqual(catalog.find(entry => entry.provider === 'openai').maxSegmentsPerRequest, 1);
  assert.deepStrictEqual(VOICE_DELIVERY_VALUES, [
    'neutral', 'warm', 'bright', 'gruff', 'whispers', 'cold',
    'weary', 'tense', 'menacing', 'angry', 'manic'
  ], 'The public delivery vocabulary is finite and ordered');
  assert.strictEqual(validateVoiceDelivery('tense'), 'tense');
  assert.strictEqual(validateVoiceDelivery(' tense '), 'neutral', 'Delivery membership is exact, not fuzzy');
  assert.strictEqual(validateVoiceDelivery('say the secret'), 'neutral', 'Free text never becomes delivery state');
  await assert.rejects(
    () => synthesizeSpeech({ provider: 'elevenlabs', apiKey: 'k', text: 'hi' }),
    /Unsupported TTS provider/,
    'Unknown providers fail with a clear error'
  );
  await assert.rejects(
    () => synthesizeSpeech({ provider: 'openai', apiKey: '', text: 'hi' }),
    /API key is required/,
    'Missing OpenAI key fails fast'
  );
  await assert.rejects(
    () => synthesizeSpeech({ provider: 'grok', apiKey: '', text: 'hi' }),
    /API key is required/,
    'Missing Grok key fails fast'
  );

  const realFetch = globalThis.fetch;
  let captured = null;
  let responseBytes = new Uint8Array([0x49, 0x44, 0x33]);
  globalThis.fetch = async (url, options) => {
    captured = { url: String(url), auth: options.headers.Authorization, body: JSON.parse(options.body) };
    return { ok: true, arrayBuffer: async () => responseBytes.buffer };
  };
  try {
    const audio = await synthesizeSpeech({
      provider: 'openai', apiKey: 'voice-key', model: 'gpt-4o-mini-tts',
      voice: 'cedar', instructions: 'gravelly Viennese accent', text: 'Guten Abend.'
    });
    assert.strictEqual(audio.length, 3, 'Returns the verified audio buffer');
    assert.strictEqual(captured.url, 'https://api.openai.com/v1/audio/speech');
    assert.strictEqual(captured.auth, 'Bearer voice-key');
    assert.strictEqual(captured.body.voice, 'cedar');
    assert.strictEqual(captured.body.instructions, 'gravelly Viennese accent', 'Steerable models receive instructions');

    await synthesizeSpeech({ provider: 'openai', apiKey: 'k', model: 'tts-1', voice: 'nope', instructions: 'x', text: 'hi' });
    assert.strictEqual(captured.body.voice, 'marin', 'Unknown voices fall back to marin');
    assert.strictEqual(captured.body.instructions, undefined, 'Fixed-character models get no instructions');

    await synthesizeSpeech({ provider: 'openai', apiKey: 'k', model: 'made-up-model', text: 'hi' });
    assert.strictEqual(captured.body.model, 'gpt-4o-mini-tts', 'Unknown TTS models fall back to the default');

    responseBytes = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00]);
    const grokAudio = await synthesizeSpeech({
      provider: 'grok', apiKey: 'xai-voice-key', model: 'must-not-send', voice: 'orion',
      instructions: 'must not send', text: '[tense] The door opens.'
    });
    assert.strictEqual(grokAudio.length, 5, 'Grok returns the verified MP3 bytes');
    assert.strictEqual(captured.url, 'https://api.x.ai/v1/tts', 'Grok endpoint is pinned');
    assert.strictEqual(captured.auth, 'Bearer xai-voice-key');
    assert.deepStrictEqual(captured.body, {
      text: '[tense] The door opens.',
      voice_id: 'orion',
      language: 'en',
      output_format: { codec: 'mp3' },
      speed: 1
    }, 'Grok receives only its pinned request contract');

    await synthesizeSpeech({ provider: 'grok', apiKey: 'x', voice: 'not-real', text: 'hi' });
    assert.strictEqual(captured.body.voice_id, 'leo', 'Invalid Grok voice falls back to the reserved narrator');

    responseBytes = new Uint8Array([0xff, 0xfb, 0x90, 0x64]);
    const frameSyncAudio = await synthesizeSpeech({ provider: 'grok', apiKey: 'x', voice: 'leo', text: 'hi' });
    assert.strictEqual(frameSyncAudio.length, 4, 'An MPEG frame-sync prefix is accepted as MP3');

    responseBytes = new Uint8Array([0x7b, 0x22, 0x65, 0x72, 0x72]);
    await assert.rejects(
      () => synthesizeSpeech({ provider: 'grok', apiKey: 'x', voice: 'leo', text: 'hi' }),
      /not MP3 audio/,
      'A successful non-MP3 response is rejected before callers can cache or serve it'
    );
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
  const grokProfile = validateVoiceProfile({ provider: 'grok', voice: 'orion', instructions: 'quiet' });
  assert.deepStrictEqual(grokProfile, {
    provider: 'grok', voice: 'orion', voiceSeed: null, mood: 'neutral', instructions: 'quiet'
  });

  const assigned = assignNpcVoiceProfile({ voice_mood: 'whispers', personality: 'PRIVATE', quirks: 'PRIVATE' }, 1, 'openai');
  assert.deepStrictEqual(assigned, { provider: 'openai', voice: 'ash', voiceSeed: 1, mood: 'whispers' });
  assert.strictEqual(JSON.stringify(assigned).includes('PRIVATE'), false, 'New profiles contain no private personality direction');
  const switched = resolveNpcVoiceProfile({ ...assigned, voice: 'cedar' }, 'grok', 99);
  assert.deepStrictEqual(switched, { provider: 'grok', voice: 'atlas', voiceSeed: 1, mood: 'whispers' },
    'A provider switch resolves the portable seed in the active provider pool');
  const switchedBack = resolveNpcVoiceProfile({ ...assigned, voice: 'cedar' }, 'openai', 99);
  assert.strictEqual(switchedBack.voice, 'cedar', 'Switching back honors the stored same-provider voice');
  const legacyWithGappedId = resolveNpcVoiceProfile({ provider: 'openai', voice: 'cedar' }, 'grok', 2);
  assert.strictEqual(legacyWithGappedId.voice, 'castor', 'Legacy resolution uses the campaign ordinal supplied by the reader');
  assert.strictEqual(legacyWithGappedId.voiceSeed, 2);

  assert.deepStrictEqual(createNarratorVoiceProfile('grok'), {
    provider: 'grok', voice: 'leo', voiceSeed: null, mood: 'neutral'
  });
  assert.strictEqual(resolveNarratorVoiceProfile({ provider: 'openai', voice: 'marin' }, 'grok').voice, 'leo',
    'A narrator profile maps to the active provider reserved narrator');
}

async function testTtsCache() {
  console.log(' - Running TTS cache bound tests...');
  const { TtsCache } = await import('./tts-cache.js');
  const { SynthesisMissLimiter } = await import('./voice-narration.js');
  let now = 0;
  const cache = new TtsCache({ ttlMs: 10, maxEntries: 2, maxBytes: 5, now: () => now });
  let calls = 0;
  const make = value => async () => { calls += 1; return Buffer.from(value); };

  assert.strictEqual((await cache.getOrCreate('a', make('aa'))).cache, 'miss');
  assert.strictEqual((await cache.getOrCreate('b', make('bb'))).cache, 'miss');
  assert.strictEqual((await cache.getOrCreate('a', make('xx'))).cache, 'completed', 'Completed hits reuse bytes');
  await cache.getOrCreate('c', make('cc'));
  assert.strictEqual((await cache.getOrCreate('b', make('bb'))).cache, 'miss', 'Access-order eviction removes the oldest entry');

  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const first = cache.getOrCreate('shared', async () => { calls += 1; await gate; return Buffer.from('s'); });
  const second = cache.getOrCreate('shared', make('should-not-run'));
  release();
  assert.strictEqual((await first).cache, 'miss');
  assert.strictEqual((await second).cache, 'in-flight', 'Concurrent requests share one Promise');

  await assert.rejects(() => cache.getOrCreate('failure', async () => { throw new Error('boom'); }), /boom/);
  assert.strictEqual((await cache.getOrCreate('failure', make('ok'))).cache, 'miss', 'Failures never poison the cache');
  now = 20;
  assert.strictEqual((await cache.getOrCreate('shared', make('s'))).cache, 'miss', 'Expired entries miss');

  const limiter = new SynthesisMissLimiter({ limit: 1, windowMs: 10, now: () => now });
  limiter.take('ip');
  assert.throws(() => limiter.take('ip'), error => error.status === 429 && error.code === 'VOICE_SYNTHESIS_RATE_LIMIT');
  now += 11;
  limiter.take('ip');
}

async function testBrowserVoiceQueue() {
  console.log(' - Running browser voice queue policy tests...');
  const {
    normalizeVoiceLines,
    buildNarrationRuns,
    runVoiceNarration
  } = await import('./public/voice-narration.js');

  const fallback = normalizeVoiceLines([], 'x'.repeat(2501));
  assert.deepStrictEqual(fallback.map(line => line.text.length), [2000, 501],
    'Voice-line-less narrative fallback is split to the server segment bound without losing text');

  const lines = normalizeVoiceLines([
    { speaker: 'Aster', tone: 'warm', text: 'First.' },
    { speaker: 'aster', tone: 'tense', text: 'Second.' },
    { speaker: 'Borel', tone: 'gruff', text: 'Third.' },
    { speaker: 'Aster', tone: 'cold', text: 'Fourth.' }
  ]);
  const grouped = buildNarrationRuns(lines, 40);
  assert.deepStrictEqual(grouped, [
    { speaker: 'Aster', segments: [{ text: 'First.', tone: 'warm' }, { text: 'Second.', tone: 'tense' }] },
    { speaker: 'Borel', segments: [{ text: 'Third.', tone: 'gruff' }] },
    { speaker: 'Aster', segments: [{ text: 'Fourth.', tone: 'cold' }] }
  ], 'Grok groups adjacent same-speaker lines case-insensitively and preserves each tone');
  assert.deepStrictEqual(buildNarrationRuns(lines, 1).map(run => run.segments.length), [1, 1, 1, 1],
    'A provider limit of one creates OpenAI singleton runs');

  const longLines = Array.from({ length: 8 }, () => ({ speaker: 'Aster', tone: 'neutral', text: 'y'.repeat(2000) }));
  assert.deepStrictEqual(buildNarrationRuns(longLines, 40).map(run => run.segments.length), [7, 1],
    'Browser batching also honors the server aggregate-text bound');

  const openAiCalls = [];
  const openAiPlayed = [];
  const openAiResult = await runVoiceNarration(lines.slice(0, 3), {
    loadCapabilities: async () => ({ provider: 'openai', maxSegmentsPerRequest: 1 }),
    synthesize: async (run, expectedProvider) => {
      openAiCalls.push({ run, expectedProvider });
      return run.speaker;
    },
    play: async audio => openAiPlayed.push(audio)
  });
  assert.strictEqual(openAiResult.hadError, false);
  assert.deepStrictEqual(openAiCalls.map(call => call.expectedProvider), ['openai', 'openai', 'openai']);
  assert.deepStrictEqual(openAiCalls.map(call => call.run.segments.length), [1, 1, 1]);
  assert.deepStrictEqual(openAiPlayed, ['Aster', 'aster', 'Borel']);

  const failedRuns = [];
  const playedAfterFailure = [];
  let notices = 0;
  const continued = await runVoiceNarration(lines.slice(0, 3), {
    loadCapabilities: async () => ({ provider: 'grok', maxSegmentsPerRequest: 40 }),
    synthesize: async (run, expectedProvider) => {
      failedRuns.push({ run, expectedProvider });
      if (failedRuns.length === 1) throw new Error('temporary synthesis failure');
      return run.speaker;
    },
    play: async audio => playedAfterFailure.push(audio),
    onError: () => { notices += 1; }
  });
  assert.strictEqual(continued.hadError, true);
  assert.strictEqual(failedRuns.length, 2, 'A failed first run does not abort the remaining queue');
  assert.deepStrictEqual(playedAfterFailure, ['Borel'], 'The next run still plays');
  assert.strictEqual(notices, 1, 'Voice errors are reported once per queue');

  for (const loadCapabilities of [
    async () => { throw new Error('capabilities timeout'); },
    async () => ({ provider: 'grok', maxSegmentsPerRequest: '40' }),
    async () => ({ provider: 'unknown', maxSegmentsPerRequest: 40 }),
    async () => ({ provider: 'grok', maxSegmentsPerRequest: 41 }),
    async () => ({ provider: 'openai', maxSegmentsPerRequest: 40 })
  ]) {
    const singletonCalls = [];
    await runVoiceNarration(lines.slice(0, 2), {
      loadCapabilities,
      synthesize: async (run, expectedProvider) => {
        singletonCalls.push({ run, expectedProvider });
        return run.segments[0].text;
      },
      play: async () => {}
    });
    assert.deepStrictEqual(singletonCalls.map(call => call.run.segments.length), [1, 1]);
    assert.deepStrictEqual(singletonCalls.map(call => call.expectedProvider), [null, null],
      'Failed or malformed capabilities fail closed to provider-agnostic singletons');
  }

  let capabilityLoads = 0;
  const firstRaceCalls = [];
  await runVoiceNarration(lines.slice(0, 2), {
    loadCapabilities: async () => (++capabilityLoads === 1
      ? { provider: 'grok', maxSegmentsPerRequest: 40 }
      : { provider: 'openai', maxSegmentsPerRequest: 1 }),
    synthesize: async (run, expectedProvider) => {
      firstRaceCalls.push({ run, expectedProvider });
      if (firstRaceCalls.length === 1) {
        const error = new Error('provider changed');
        error.code = 'VOICE_PROVIDER_CHANGED';
        throw error;
      }
      return run.segments[0].text;
    },
    play: async () => {}
  });
  assert.strictEqual(capabilityLoads, 2, 'The first provider race refreshes capabilities once');
  assert.deepStrictEqual(firstRaceCalls.map(call => call.expectedProvider), ['grok', 'openai', 'openai']);
  assert.deepStrictEqual(firstRaceCalls.map(call => call.run.segments.length), [2, 1, 1]);

  capabilityLoads = 0;
  const repeatedRaceCalls = [];
  const repeatedRacePlayed = [];
  await runVoiceNarration(lines.slice(0, 2), {
    loadCapabilities: async () => (++capabilityLoads === 1
      ? { provider: 'grok', maxSegmentsPerRequest: 40 }
      : { provider: 'openai', maxSegmentsPerRequest: 1 }),
    synthesize: async (run, expectedProvider) => {
      repeatedRaceCalls.push({ run, expectedProvider });
      if (repeatedRaceCalls.length <= 2) {
        const error = new Error('provider changed again');
        error.code = 'VOICE_PROVIDER_CHANGED';
        throw error;
      }
      return run.segments[0].text;
    },
    play: async audio => repeatedRacePlayed.push(audio)
  });
  assert.strictEqual(capabilityLoads, 2, 'A second race does not trigger another capability fetch');
  assert.deepStrictEqual(repeatedRaceCalls.map(call => call.expectedProvider), ['grok', 'openai', null, null]);
  assert.deepStrictEqual(repeatedRaceCalls.map(call => call.run.segments.length), [2, 1, 1, 1]);
  assert.deepStrictEqual(repeatedRacePlayed, ['First.', 'Second.'],
    'Repeated provider flips degrade to singletons and still finish the queue');

  let cancelled = false;
  let cancellationSyntheses = 0;
  let cancellationPlays = 0;
  const cancellation = await runVoiceNarration(lines.slice(0, 3), {
    loadCapabilities: async () => ({ provider: 'openai', maxSegmentsPerRequest: 1 }),
    synthesize: async () => {
      cancellationSyntheses += 1;
      cancelled = true;
      return 'audio';
    },
    play: async () => { cancellationPlays += 1; },
    isCancelled: () => cancelled
  });
  assert.strictEqual(cancellation.cancelled, true);
  assert.strictEqual(cancellationSyntheses, 1);
  assert.strictEqual(cancellationPlays, 0, 'Cancellation stops before stale audio is played');

  const indexSource = fs.readFileSync(path.join(process.cwd(), 'public', 'index.html'), 'utf8');
  const appSource = fs.readFileSync(path.join(process.cwd(), 'public', 'app.js'), 'utf8');
  assert.strictEqual(/select-voice-name|input-voice-instructions/.test(indexSource), false,
    'Player voice and free-text direction controls are removed');
  assert.strictEqual(/voiceName|voiceInstructions|selectVoiceName|inputVoiceInstructions/.test(appSource), false,
    'Player voice and free-text direction state is removed');
  assert.strictEqual(appSource.includes('runVoiceNarration(queue'), true,
    'The browser executes the guarded production queue helper');
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
  assert.strictEqual(
    svg1.includes('var(--theme-primary, hsl(210 100% 55%))'),
    true,
    'Map source carries a complete-colour fallback when theme variables are absent'
  );
  assert.strictEqual(svg1.includes('hsl(var(--theme-'), false, 'Map source never wraps whole-colour theme variables in hsl()');
  assert.strictEqual(renderLocationMap(null, []), null, 'No layout → no map');
  const hostile = renderLocationMap(
    validateLocationLayout({ name: 'X', areas: [{ id: 'a', name: '<script>alert(1)</script>', x: 0, y: 0, w: 20, h: 20 }] }),
    [{ name: '"quoted" & <tagged>', kind: 'npc', area: 'a', note: '' }]
  );
  assert.strictEqual(hostile.includes('<script>'), false, 'Model-supplied names are XML-escaped');
  assert.strictEqual(hostile.includes('&lt;script&gt;'), true);

  // Labels fit their box. SVG <text> neither wraps nor clips, so a long area
  // name used to run out of its rect and collide with the neighbouring area
  // (owner-reported: "Collapsed Windmills" overlapping "Cracked Plaza", and the
  // rightmost label clipped by the canvas edge).
  const LONG_AREA = 'Collapsed Windmills of the Eastern Reach';
  const narrow = renderLocationMap(
    validateLocationLayout({
      name: 'Dusthaven',
      areas: [
        { id: 'windmills', name: LONG_AREA, x: 0, y: 0, w: 20, h: 20 },
        { id: 'plaza', name: 'Cracked Plaza', x: 22, y: 0, w: 20, h: 20 }
      ]
    }),
    []
  );
  assert.strictEqual(narrow.includes(LONG_AREA), false, 'A long area name is not drawn at full length in a narrow box');
  assert.strictEqual(narrow.includes('…'), true, 'Overlong area labels are ellipsized');
  assert.strictEqual(narrow.includes('clip-path='), true, 'Area labels are clipped to their own box');

  // …but a label that fits is left alone.
  const roomy = renderLocationMap(
    validateLocationLayout({ name: 'Dusthaven', areas: [{ id: 'plaza', name: 'Cracked Plaza', x: 0, y: 0, w: 60, h: 20 }] }),
    []
  );
  assert.strictEqual(roomy.includes('Cracked Plaza'), true, 'A label that fits its box is drawn in full');
  assert.strictEqual(roomy.includes('…'), false, 'A label that fits is not ellipsized');

  // map-1 review guards.
  // (1) Ellipsizing cuts on code points — never mid-surrogate (U+FFFD in the UI).
  const emoji = renderLocationMap(
    validateLocationLayout({ name: 'Dusthaven', areas: [{ id: 'shrine', name: '😀😀😀😀😀😀😀😀', x: 0, y: 0, w: 8, h: 20 }] }),
    []
  );
  assert.strictEqual(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/u.test(emoji), false, 'Ellipsizing never emits a lone surrogate');
  assert.strictEqual(emoji.includes('😀…'), true, 'The cut lands after a whole glyph');

  // (2) Clip ids stay unique even when distinct area ids slugify identically.
  const twins = renderLocationMap(
    validateLocationLayout({
      name: 'Dusthaven',
      areas: [
        { id: 'east wing', name: 'East Wing', x: 0, y: 0, w: 20, h: 20 },
        { id: 'east-wing', name: 'East Wing Annex', x: 22, y: 0, w: 20, h: 20 }
      ]
    }),
    []
  );
  const clipIds = [...twins.matchAll(/<clipPath id="([^"]+)"/g)].map(m => m[1]);
  assert.strictEqual(clipIds.length, 2, 'Both colliding-slug areas get a clipPath');
  assert.strictEqual(new Set(clipIds).size, clipIds.length, 'Clip-path ids are unique when slugs collide');

  // (3) The validator clamps position against the clamped size: x+w and y+h
  // stay inside the 100×70 canvas instead of overhanging by up to 92 units.
  const tower = validateLocationLayout({
    name: 'X',
    areas: [{ id: 't', name: 'Leaning Tower', x: 92, y: 66, w: 20, h: 15 }]
  }).areas[0];
  assert.strictEqual(tower.x + tower.w <= 100, true, 'Area x+w is clamped to the canvas width');
  assert.strictEqual(tower.y + tower.h <= 70, true, 'Area y+h is clamped to the canvas height');

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
  assert.deepStrictEqual(bundle.portability, {
    vocabulary_version: 0,
    vocabulary_entries: [],
    character_ability_bindings: []
  }, 'Released v1 bundles migrate to empty S1.4 portability state');
  assert.deepStrictEqual(
    bundle.turns.map(turn => turn.ability_invocations),
    bundle.turns.map(() => emptyAbilityInvocationRecord()),
    'Released bundles from before AKP-2 migrate to empty historical invocation records'
  );

  const portableVoiceFixture = JSON.parse(JSON.stringify(fixture));
  portableVoiceFixture.campaign.narrator_voice_json = JSON.stringify({
    provider: 'grok', voice: 'leo', voiceSeed: null, mood: 'warm'
  });
  portableVoiceFixture.npcs[0].voice_json = JSON.stringify({
    provider: 'grok', voice: 'atlas', voiceSeed: 7.9, mood: 'whispers'
  });
  const portableVoiceBundle = validateCampaignBundle(portableVoiceFixture);
  assert.deepStrictEqual(portableVoiceBundle.campaign.narrator_voice, {
    provider: 'grok', voice: 'leo', instructions: '', voiceSeed: null, mood: 'warm'
  });
  assert.deepStrictEqual(portableVoiceBundle.npcs[0].voice, {
    provider: 'grok', voice: 'atlas', instructions: '', voiceSeed: 7, mood: 'whispers'
  }, 'Import validation preserves a numeric seed and finite public mood');
  assert.strictEqual(typeof portableVoiceBundle.npcs[0].voice.voiceSeed, 'number');

  for (const invalidSeed of ['7', -1, Number.POSITIVE_INFINITY, {}, null]) {
    const hostileVoiceFixture = JSON.parse(JSON.stringify(fixture));
    hostileVoiceFixture.npcs[0].voice_json = {
      provider: 'openai', voice: 'cedar', voiceSeed: invalidSeed, mood: 'say the secret'
    };
    const cleanedVoice = validateCampaignBundle(hostileVoiceFixture).npcs[0].voice;
    assert.strictEqual(cleanedVoice.voiceSeed, null, `Invalid seed ${String(invalidSeed)} becomes null`);
    assert.strictEqual(cleanedVoice.mood, 'neutral', 'Unknown mood falls closed to neutral');
  }

  // sv-4 round 2: bundles are untrusted DATA. getCampaignState promotes the
  // last turn's quest_update into `currentQuest`, which crosses the seat
  // boundary — so a hostile bundle must not be able to park a nested object
  // under a player-facing quest field. Sanitized at the import boundary too,
  // not only in the seat scope (defense at both ends).
  const hostileBundle = JSON.parse(JSON.stringify(fixture));
  hostileBundle.turns[0].state_changes_json = JSON.stringify({
    quest_update: {
      active_quest: { current_act: 3, outline: 'LEAK_IMPORT_TWIST' },
      quest_description: ['LEAK_IMPORT_ARRAY'],
      current_act: 3
    }
  });
  const cleaned = validateCampaignBundle(hostileBundle);
  const record = JSON.parse(cleaned.turns[0].state_changes_json);
  assert.strictEqual('active_quest' in (record.quest_update || {}), false,
    'A non-string active_quest is stripped at the import boundary');
  assert.strictEqual('quest_description' in (record.quest_update || {}), false,
    'A non-string quest_description is stripped at the import boundary');
  assert.strictEqual(JSON.stringify(cleaned).includes('LEAK_IMPORT_TWIST'), false,
    'Nested private data cannot survive import inside a quest field');

  // sv-4 round 3: input_kind and scene_grounding are promoted into the seat
  // payload from this same record, so they are normalized here too.
  const poisonedKinds = JSON.parse(JSON.stringify(fixture));
  poisonedKinds.turns[0].state_changes_json = JSON.stringify({
    input_kind: { nested: 'LEAK_IMPORT_INPUTKIND' },
    scene_grounding: ['LEAK_IMPORT_GROUNDING']
  });
  const kindsCleaned = JSON.stringify(validateCampaignBundle(poisonedKinds));
  assert.strictEqual(kindsCleaned.includes('LEAK_IMPORT_INPUTKIND'), false,
    'A non-string input_kind is stripped at the import boundary');
  assert.strictEqual(kindsCleaned.includes('LEAK_IMPORT_GROUNDING'), false,
    'A non-string scene_grounding is stripped at the import boundary');

  // A quest_update that is not an object at all is dropped wholesale.
  const arrayQuest = JSON.parse(JSON.stringify(fixture));
  arrayQuest.turns[0].state_changes_json = JSON.stringify({ quest_update: ['LEAK_ARRAY_QUEST'] });
  assert.strictEqual(
    JSON.stringify(validateCampaignBundle(arrayQuest)).includes('LEAK_ARRAY_QUEST'), false,
    'A non-object quest_update is dropped');

  // Legitimate string fields survive untouched.
  const goodQuest = JSON.parse(JSON.stringify(fixture));
  goodQuest.turns[0].state_changes_json = JSON.stringify({
    quest_update: { active_quest: 'The Vault', quest_description: 'Crack it.', current_act: 2 }
  });
  const goodRecord = JSON.parse(validateCampaignBundle(goodQuest).turns[0].state_changes_json);
  assert.strictEqual(goodRecord.quest_update.active_quest, 'The Vault', 'Valid quest text survives import');
  assert.strictEqual(goodRecord.quest_update.quest_description, 'Crack it.');
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
      state_changes_json: JSON.stringify({ suggested_choices: { bad: 'shape' }, roll_damage: 7, input_kind: 'dialogue' })
    }]
  });
  const shaped = JSON.parse(shapes.turns[0].state_changes_json);
  assert.strictEqual('suggested_choices' in shaped, false, 'Non-array suggested_choices is stripped on import');
  assert.strictEqual(shaped.roll_damage, 7, 'Legacy fields pass through untouched');
  const okShapes = validateCampaignBundle({
    ...fixture,
    turns: [{ turn_number: 1, narrative: 'n', state_changes_json: JSON.stringify({ suggested_choices: ['a', 'b'] }) }]
  });
  assert.deepStrictEqual(JSON.parse(okShapes.turns[0].state_changes_json).suggested_choices, ['a', 'b'], 'Well-formed choices survive');

  // cr-4 reopen: roll records reach the roll bubble's dereferences — coerce
  // dice_rolls entries and legacy roll_result through the live sanitizer
  const rollShapes = validateCampaignBundle({
    ...fixture,
    turns: [{
      turn_number: 1, narrative: 'n',
      state_changes_json: JSON.stringify({
        dice_rolls: [null, { attribute: {}, total: 9, dc: 5 }, 'junk'],
        roll_result: { attribute: {} } // no total/dc → dropped entirely
      })
    }]
  });
  const rollRecord = JSON.parse(rollShapes.turns[0].state_changes_json);
  assert.strictEqual(rollRecord.dice_rolls.length, 1, 'Null/junk roll entries dropped on import');
  assert.strictEqual(rollRecord.dice_rolls[0].attribute, 'strength', 'Non-string attributes coerced');
  assert.strictEqual('roll_result' in rollRecord, false, 'Unsalvageable legacy roll_result dropped');
  const okRoll = validateCampaignBundle({
    ...fixture,
    turns: [{ turn_number: 1, narrative: 'n', state_changes_json: JSON.stringify({ roll_result: { attribute: 'agility', total: 14, dc: 10, success: true } }) }]
  });
  assert.strictEqual(JSON.parse(okRoll.turns[0].state_changes_json).roll_result.success, true, 'Valid legacy roll_result survives');
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

  // Cadence history counts RESOLVED world turns only (cr-3): denied and
  // needs-clarification attempts keep committed_action but must not widen
  // the window; pre-flag records (no action_resolved) count as resolved.
  const { buildEncounterHistory } = await import('./rpg-state.js');
  const rows = [
    { state_changes_json: JSON.stringify({ input_kind: 'committed_action', action_resolved: true, encounter: 'gm_initiated' }) },
    { state_changes_json: JSON.stringify({ input_kind: 'clarification', encounter: 'none' }) },
    { state_changes_json: JSON.stringify({ input_kind: 'committed_action', action_resolved: false, encounter: 'none' }) },
    { state_changes_json: JSON.stringify({ input_kind: 'committed_action', action_resolved: false, encounter: 'none' }) },
    { state_changes_json: JSON.stringify({ input_kind: 'committed_action', action_resolved: true, encounter: 'none' }) },
    { state_changes_json: 'not json' },
    { state_changes_json: JSON.stringify({ input_kind: 'committed_action', encounter: 'none' }) } // legacy, counts
  ];
  const history = buildEncounterHistory(rows);
  assert.deepStrictEqual(history, ['gm_initiated', 'none', 'none'], 'Only resolved world turns enter the window');
  assert.strictEqual(computeEncounterCadence(history), 2, 'Denied attempts do not inflate the cadence');

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
// Test: complete-colour theme contract (Phase CT) + generated theming (Phase T1)
// -------------------------------------------------------------
function testThemeColorContract() {
  console.log(' - Running complete-colour theme contract tests (Phase CT)...');
  const hslColor = /^hsl\((?:\d{1,3}, ?\d{1,3}%, ?\d{1,3}%|\d{1,3} \d{1,3}% \d{1,3}%)\)$/;

  const fullColors = {
    primary: '320, 100%, 55%',
    secondary: '180, 100%, 45%',
    background: '275, 45%, 30%',
    text: '180, 100%, 60%',
    text_dim: '320, 30%, 70%'
  };
  const full = fullThemeVars(fullColors);
  assert.deepStrictEqual(full, {
    '--theme-primary': 'hsl(320, 100%, 55%)',
    '--theme-secondary': 'hsl(180, 100%, 45%)',
    '--theme-bg': 'hsl(275, 45%, 30%)',
    '--theme-text': 'hsl(180, 100%, 60%)',
    '--theme-text-dim': 'hsl(320, 30%, 70%)',
    '--theme-panel': 'hsl(275, 45%, 34%)',
    '--theme-border': 'hsl(275, 45%, 42%)'
  }, 'Full generated themes map every slot and derive panel/border from the background');

  const legacy = baseThemeVars('210, 100%, 50%', '330, 100%, 50%', '220, 30%, 8%');
  assert.deepStrictEqual(legacy, {
    '--theme-primary': 'hsl(210, 100%, 50%)',
    '--theme-secondary': 'hsl(330, 100%, 50%)',
    '--theme-bg': 'hsl(220, 30%, 8%)',
    '--theme-panel': 'hsl(220, 30%, 12%)',
    '--theme-border': 'hsl(220, 30%, 20%)'
  }, 'Legacy themes keep their root-level key set and do not acquire text slots');
  assert.strictEqual('--theme-text' in legacy, false);
  assert.strictEqual('--theme-text-dim' in legacy, false);

  for (const [pathLabel, vars] of [['full theme writer', full], ['legacy theme writer', legacy]]) {
    for (const [name, value] of Object.entries(vars)) {
      assert.match(value, hslColor, `${pathLabel} ${name} must be an opaque complete HSL colour: ${value}`);
    }
  }

  const styles = fs.readFileSync(new URL('./public/styles.css', import.meta.url), 'utf8');
  const definitions = [...styles.matchAll(/^\s*(--theme-[\w-]+)\s*:\s*([^;]+);/gm)]
    .map((match) => [match[1], match[2].trim()]);
  assert.strictEqual(definitions.length, 42, 'All six theme blocks define the seven live theme variables');
  for (const [name, value] of definitions) {
    assert.match(value, hslColor, `${name} stylesheet definition must be an opaque complete HSL colour: ${value}`);
  }

  const expectedAlphaConsumers = [
    ['--theme-primary', 5],
    ['--theme-secondary', 3],
    ['--theme-panel', 70],
    ['--theme-panel', 45],
    ['--theme-primary', 30],
    ['--theme-primary', 50],
    ['--theme-panel', 35],
    ['--theme-primary', 15],
    ['--theme-primary', 30],
    ['--theme-panel', 20],
    ['--theme-primary', 10],
    ['--theme-primary', 25],
    ['--theme-primary', 5],
    ['--theme-secondary', 8],
    ['--theme-secondary', 30],
    ['--theme-panel', 80],
    ['--theme-primary', 8],
    ['--theme-primary', 20],
    ['--theme-primary', 25],
    ['--theme-primary', 10],
    ['--theme-primary', 60],
    ['--theme-primary', 15],
    ['--theme-secondary', 15],
    ['--theme-primary', 30],
    ['--theme-primary', 60]
  ];
  const alphaConsumers = [...styles.matchAll(
    /color-mix\(in srgb, var\((--theme-[^)]+)\) (\d+)%, transparent\)/g
  )].map((match) => [match[1], Number(match[2])]);
  assert.deepStrictEqual(
    alphaConsumers,
    expectedAlphaConsumers,
    'Theme translucency must match the independently pinned 25-entry ordered alpha table'
  );

  // Consumer typo lint. Case-insensitive because CSS function names are (`RGBA(` is legal).
  //
  // ⚠ THIS LINT CATCHES THE DIRECT SPELLING AND NOTHING MORE — BY DESIGN. It does not catch
  // aliasing through an intermediate custom property, styles composed in JavaScript, or encoded
  // CSS. That residual risk is ACCEPTED, deliberately, and it is small precisely because the
  // migration removed the TRAP: now that --theme-* holds a whole colour, there is no reason to
  // wrap it in a colour function at all, so the direct spelling is the only slip anyone plausibly
  // makes.
  //
  // DO NOT "HARDEN" THIS INTO A PARSER. A previous attempt (finding css-2) tried to police this
  // class with a static scanner and was defeated by a reviewer 1, then 5, then 16 times across
  // three rounds — HTML character references, RAWTEXT <style> semantics, CSS string tokenization,
  // cross-file cascade aliases, CSS identifier escapes — until it crashed the suite on malformed
  // markup AND rejected valid CSS. It had become a bad re-implementation of an HTML parser, a CSS
  // tokenizer, and the cascade. Reviewer and coder independently concluded it was not converging;
  // THIS PHASE is the agreed alternative. If a future round finds a way past this regex, the
  // correct response is to shrug — an encoded offender is not an accident, and someone with commit
  // access has better options than hiding a colour from a linter.
  //
  // Read .agents/review/findings/css-2.md before you touch this.
  const runtimeTargets = ['public/styles.css', 'public/index.html', 'public/app.js', 'map-render.js'];
  const wrappedThemeVar = /\b(?:rgba?|hsla?)\(\s*var\(\s*--theme-/gi;
  for (const target of runtimeTargets) {
    const source = fs.readFileSync(new URL(`./${target}`, import.meta.url), 'utf8');
    assert.strictEqual(
      wrappedThemeVar.test(source),
      false,
      `${target} wraps a whole-colour --theme-* variable in a colour function. A --theme-* var now ` +
      'holds a COMPLETE COLOUR, so wrapping it in rgb()/rgba()/hsl()/hsla() is invalid CSS and the ' +
      'browser silently drops the declaration (that was finding css-1). Use var(--theme-x), or ' +
      'color-mix(in srgb, var(--theme-x) N%, transparent) for translucency.'
    );
    wrappedThemeVar.lastIndex = 0;
  }
}

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
// Test: ability-keyword matcher and canonical trigger projection (AKP-1)
// -------------------------------------------------------------
async function testAbilityKeywordProjection() {
  console.log(' - Running ability-keyword projection tests...');

  const families = [
    { key: 'opportunity', label: 'Opportunity', cssToken: 'opportunity' },
    { key: 'command', label: 'Command', cssToken: 'command' }
  ];
  const character = {
    id: 41,
    player_character_id: 501,
    abilities: [
      {
        id: 'owned-backstab',
        definition_id: 'opportunist.backstab',
        definition_version: 3,
        name: 'Exploit Opening',
        description: 'Use an opening for a decisive attack.',
        invocation: { schema_version: 1, family_key: 'opportunity' }
      },
      {
        id: 'owned-rally',
        definition_id: 'commander.rally',
        definition_version: 2,
        name: 'Restore Cohesion',
        description: 'Steady an ally under pressure.',
        invocation: { schema_version: 1, family_key: 'command' }
      },
      {
        id: 'passive-mastery',
        definition_id: 'armsmaster.weapon-mastery',
        definition_version: 1,
        name: 'Weapon Mastery',
        description: 'A passive weapon benefit.',
        invocation: null
      },
      { id: 'free-text-legacy', name: 'Ghostline', description: 'No catalog invocation metadata.' }
    ]
  };
  const bindings = [
    {
      abilityId: 'owned-backstab',
      term: 'backstab',
      aliases: ['back stab'],
      prose: 'Strike when attention is elsewhere.'
    },
    {
      abilityId: 'owned-rally',
      term: 'rally',
      aliases: [],
      prose: 'Call an ally back into the moment.'
    }
  ];
  const state = buildCharacterAbilityTriggerState({
    campaignId: 9,
    character,
    bindings,
    familyRegistry: families,
    catalogVersion: 'catalog-7',
    characterVersionId: 4
  });

  assert.match(state.abilityTriggerRevision, /^ak1:[a-f0-9]{64}$/);
  assert.strictEqual(Object.isFrozen(state), true, 'Trigger state is immutable');
  assert.strictEqual(Object.isFrozen(state.invocableAbilities), true, 'Projected ability list is immutable');
  assert.deepStrictEqual(
    state.invocableAbilities.map(ability => ability.abilityId),
    ['owned-backstab', 'owned-rally'],
    'Only explicitly invocable catalog abilities project; passives and free-text rows remain inert'
  );
  assert.deepStrictEqual(state.invocableAbilities[0], {
    abilityId: 'owned-backstab',
    definitionId: 'opportunist.backstab',
    definitionVersion: 3,
    name: 'backstab',
    trigger: 'backstab',
    aliases: ['back stab'],
    familyKey: 'opportunity',
    familyLabel: 'Opportunity',
    help: 'Strike when attention is elsewhere.'
  });
  assert.strictEqual(Object.isFrozen(state.invocableAbilities[0].aliases), true, 'Aliases are immutable');
  assert.strictEqual(validateAbilityTriggers(state.invocableAbilities, families.map(family => family.key)), true);

  let scan = scanAbilityTriggers('🗡️ I BACKSTAB, rally, then backstab again.', state.invocableAbilities, {
    familyKeys: families.map(family => family.key)
  });
  assert.deepStrictEqual(scan.abilityIds, ['owned-backstab', 'owned-rally'], 'IDs are ordered and deduplicated');
  assert.strictEqual(scan.matches.length, 3, 'Every exact non-overlapping occurrence highlights');
  assert.strictEqual(scan.matches[0].start, '🗡️ I '.length, 'Ranges use textarea-compatible UTF-16 indices');
  assert.strictEqual(scan.matches[0].spelling, 'BACKSTAB');
  assert.deepStrictEqual(
    scanAbilityTriggers('I back stab, not backstabbed.', state.invocableAbilities).abilityIds,
    ['owned-backstab'],
    'Curated aliases match while joined suffixes do not'
  );

  scan = scanAbilityTriggers('I bakcstab the orc.', state.invocableAbilities);
  assert.deepStrictEqual(scan.abilityIds, [], 'A typo never activates an ability');
  assert.deepStrictEqual(scan.matches, [], 'A typo never highlights');
  assert.deepStrictEqual(scan.suggestions, [
    { start: 2, end: 10, replacement: 'backstab', abilityId: 'owned-backstab' }
  ]);
  assert.deepStrictEqual(
    applyAbilitySuggestion('I bakcstab the orc.', scan.suggestions[0]),
    { text: 'I backstab the orc.', selectionStart: 10, selectionEnd: 10 },
    'Accepting a suggestion replaces only the typo'
  );
  assert.deepStrictEqual(computeAbilityInsertion('I orc', 2, 2, 'backstab'), {
    text: 'I backstab orc',
    insertedText: 'backstab ',
    selectionStart: 11,
    selectionEnd: 11
  });

  const collision = structuredClone(state.invocableAbilities);
  collision[1].aliases.push('BACKSTAB');
  assert.throws(
    () => validateAbilityTriggers(collision, families.map(family => family.key)),
    /collides with an existing trigger or alias/,
    'One character cannot own two normalized spellings with ambiguous identity'
  );

  const shadowAbility = {
    ...structuredClone(state.invocableAbilities[0]),
    abilityId: 'owned-buckstab',
    definitionId: 'opportunist.buckstab',
    name: 'buckstab',
    trigger: 'buckstab',
    aliases: []
  };
  const ambiguous = [...state.invocableAbilities, shadowAbility];
  assert.deepStrictEqual(
    scanAbilityTriggers('I bickstab.', ambiguous).suggestions,
    [],
    'Equally close abilities never produce a guessed correction'
  );
  const shadowStep = {
    ...structuredClone(state.invocableAbilities[0]),
    abilityId: 'owned-shadow-step',
    definitionId: 'opportunist.shadow-step',
    name: 'shadow step',
    trigger: 'shadow step',
    aliases: []
  };
  const shadow = {
    ...structuredClone(state.invocableAbilities[0]),
    abilityId: 'owned-shadow',
    definitionId: 'opportunist.shadow',
    name: 'shadow',
    trigger: 'shadow',
    aliases: []
  };
  assert.deepStrictEqual(
    scanAbilityTriggers('I shadow step behind it.', [shadow, shadowStep]).abilityIds,
    ['owned-shadow-step'],
    'At one starting position the longest exact trigger wins'
  );

  assert.throws(
    () => buildCharacterAbilityTriggerState({
      campaignId: 9,
      character,
      bindings: bindings.slice(1),
      familyRegistry: families
    }),
    /has no campaign presentation binding/,
    'Missing campaign wording never falls back to an internal catalog name'
  );
  assert.throws(
    () => buildCharacterAbilityTriggerState({
      campaignId: 9,
      character,
      bindings,
      familyRegistry: families.slice(1)
    }),
    /not in the catalog registry/,
    'Unknown families fail closed'
  );

  const repeat = buildCharacterAbilityTriggerState({
    campaignId: 9,
    character: structuredClone(character),
    bindings: structuredClone(bindings),
    familyRegistry: structuredClone(families),
    catalogVersion: 'catalog-7',
    characterVersionId: 4
  });
  assert.strictEqual(repeat.abilityTriggerRevision, state.abilityTriggerRevision, 'Unchanged trigger state has one revision');
  const changedAlias = structuredClone(bindings);
  changedAlias[0].aliases.push('knife opening');
  assert.notStrictEqual(
    buildCharacterAbilityTriggerState({
      campaignId: 9,
      character,
      bindings: changedAlias,
      familyRegistry: families,
      catalogVersion: 'catalog-7',
      characterVersionId: 4
    }).abilityTriggerRevision,
    state.abilityTriggerRevision,
    'Relevant presentation changes invalidate the revision'
  );
  assert.notStrictEqual(
    buildCharacterAbilityTriggerState({
      campaignId: 10,
      character,
      bindings,
      familyRegistry: families,
      catalogVersion: 'catalog-7',
      characterVersionId: 4
    }).abilityTriggerRevision,
    state.abilityTriggerRevision,
    'A revision cannot be replayed across campaigns'
  );
  const changedDefinition = structuredClone(character);
  changedDefinition.abilities[0].definition_version += 1;
  assert.notStrictEqual(
    buildCharacterAbilityTriggerState({
      campaignId: 9,
      character: changedDefinition,
      bindings,
      familyRegistry: families,
      catalogVersion: 'catalog-7',
      characterVersionId: 4
    }).abilityTriggerRevision,
    state.abilityTriggerRevision,
    'A catalog definition change invalidates the revision'
  );

  const inert = buildCharacterAbilityTriggerState({
    campaignId: 9,
    character: {
      id: 42,
      player_character_id: 502,
      abilities: [{ id: 'free-text-only', name: 'Grid Dive' }]
    }
  });
  assert.deepStrictEqual(inert.invocableAbilities, [], 'Legacy free-text names never become trigger fallbacks');

  const exactPlayerAction = '  I BACKSTAB, then rally.  ';
  const authoritativeCharacter = {
    ...character,
    ...state
  };
  const declarations = buildAbilityDeclarations({
    character: authoritativeCharacter,
    playerAction: exactPlayerAction
  });
  assert.strictEqual(Object.isFrozen(declarations), true, 'Server declaration record is immutable');
  assert.deepStrictEqual(
    declarations.abilities.map(ability => ability.ability_id),
    ['owned-backstab', 'owned-rally'],
    'Server recomputation derives ordered owned identities from exact prose'
  );
  assert.strictEqual(
    declarations.abilities[0].canonical_description,
    character.abilities[0].description,
    'Council declarations carry the canonical mechanical definition'
  );
  const invocationRecord = abilityInvocationRecordFromDeclarations(
    declarations,
    exactPlayerAction
  );
  assert.deepStrictEqual(
    invocationRecord.abilities[0].matches[0],
    {
      start: exactPlayerAction.indexOf('BACKSTAB'),
      end: exactPlayerAction.indexOf('BACKSTAB') + 'BACKSTAB'.length,
      spelling: 'BACKSTAB'
    },
    'Durable ranges reproduce the exact stored player prose'
  );
  assert.deepStrictEqual(
    validateAbilityInvocationRecord(
      invocationRecord,
      exactPlayerAction,
      { ownedAbilities: character.abilities }
    ),
    invocationRecord,
    'The shared persistence/import validator accepts the server-built record'
  );

  const forgedInvocation = structuredClone(invocationRecord);
  forgedInvocation.abilities[0].ability_id = 'another-character-ability';
  assert.throws(
    () => validateAbilityInvocationRecord(
      forgedInvocation,
      exactPlayerAction,
      { ownedAbilities: character.abilities }
    ),
    /unowned definition/,
    'A forged ability identity belonging to another character fails closed'
  );
  const forgedRange = structuredClone(invocationRecord);
  forgedRange.abilities[0].matches[0].start += 1;
  assert.throws(
    () => validateAbilityInvocationRecord(forgedRange, exactPlayerAction),
    /does not reproduce player_action/,
    'A persisted range must reproduce the exact action spelling'
  );
  assert.deepStrictEqual(
    safeAbilityInvocationRecord(forgedRange, exactPlayerAction),
    emptyAbilityInvocationRecord(),
    'Corrupt recent-history records become empty declarations, never permission'
  );

  const remappedAbilityId = 'imported-owned-backstab';
  const remappedOwned = [{
    ...character.abilities[0],
    id: remappedAbilityId
  }, character.abilities[1]];
  const remappedInvocation = remapAbilityInvocationRecord(
    {
      ...structuredClone(invocationRecord),
      abilities: [structuredClone(invocationRecord.abilities[0])]
    },
    new Map([['owned-backstab', remappedAbilityId]]),
    exactPlayerAction,
    { ownedAbilities: remappedOwned }
  );
  assert.strictEqual(remappedInvocation.abilities[0].ability_id, remappedAbilityId);
  assert.strictEqual(
    remappedInvocation.abilities[0].definition_id,
    invocationRecord.abilities[0].definition_id,
    'Import remaps instance identity without changing stable catalog identity'
  );

  const {
    buildCouncilAbilityDeclarationInstructions,
    stampServerAbilityDeclarations
  } = await import('./rpg-engine.js');
  const instruction = buildCouncilAbilityDeclarationInstructions(declarations);
  assert.strictEqual(instruction.includes('owned-backstab'), true, 'Every Council role receives the exact declaration record');
  assert.strictEqual(instruction.includes('does not prove intent, legality'), true,
    'Council rules keep recognition separate from adjudication');
  const engineSource = fs.readFileSync(new URL('./rpg-engine.js', import.meta.url), 'utf8');
  const councilSource = engineSource.slice(
    engineSource.indexOf('async function runMultiAgentTurn'),
    engineSource.indexOf('export async function createCampaign')
  );
  assert.strictEqual((councilSource.match(/\$\{abilityDeclarationRules\}/g) || []).length, 6,
    'Interaction, table-talk verifier, both Continuity calls, Referee, and Narration share one declaration contract');
  const modelTurn = {
    narrative: 'Result.',
    ability_declarations: { forged: true },
    abilityIds: ['another-character-ability']
  };
  stampServerAbilityDeclarations(modelTurn, declarations);
  assert.strictEqual(modelTurn.ability_declarations, declarations,
    'Engine declarations overwrite model-emitted declaration fields');
  assert.strictEqual('abilityIds' in modelTurn, false, 'Forged shadow authority fields are removed');

  const { validateTurnRequestBody } = await import('./server.js');
  const exactRequest = validateTurnRequestBody({
    playerAction: exactPlayerAction,
    characterId: 41,
    abilityTriggerRevision: state.abilityTriggerRevision
  });
  assert.strictEqual(exactRequest.playerAction, exactPlayerAction,
    'The HTTP boundary uses trim only for emptiness and preserves exact prose');
  assert.throws(
    () => validateTurnRequestBody({
      ...exactRequest,
      abilityIds: ['another-character-ability']
    }),
    error => error.code === 'TURN_REQUEST_INVALID',
    'Client-supplied ability identities are rejected instead of ignored'
  );
}

// -------------------------------------------------------------
// Test: authoritative declaration boundary and invocation portability (AKP-2)
// -------------------------------------------------------------
async function testAbilityKeywordAuthorityPersistence() {
  console.log(' - Running ability-keyword authority and persistence tests...');
  const db = await import('./db.js');
  const rpg = await import('./rpg-engine.js');
  const { readCampaignHistory } = await import('./campaign-context.js');
  const { validateCampaignBundle } = await import('./rpg-state.js');
  await db.initDb();

  const outline = {
    title: 'Invocation Boundary Probe',
    setting: 'A sealed test chamber.',
    theme_colors: {
      primary: '210, 50%, 50%', secondary: '30, 50%, 50%', background: '220, 20%, 8%'
    },
    theme_fonts: { title: 'Cinzel', body: 'Inter', dialogue: 'Crimson Pro' },
    acts: [{ act: 1, title: 'Probe', objective: 'Verify authority', key_events: ['begin'] }],
    major_locations: [{ name: 'Test Chamber', description: 'A controlled room.' }],
    key_npcs: [],
    starting_quest: { title: 'Verify', description: 'Exercise the declaration boundary.' }
  };
  const campaignId = (await db.run(
    `INSERT INTO campaigns (title, genre, summary, current_act, rules_mode)
     VALUES ('Invocation Boundary Probe', 'test', 'A sealed test chamber.', 1, 0)`
  )).id;
  await db.run(
    `INSERT INTO campaign_outlines (campaign_id, outline_json) VALUES (?, ?)`,
    [campaignId, JSON.stringify(outline)]
  );

  const ownedAbility = {
    id: 'source-owned-backstab',
    definition_id: 'opportunist.backstab',
    definition_version: 4,
    name: 'Exploit Opening',
    description: 'Use a clear opening for a decisive strike.'
  };
  const otherAbility = {
    id: 'other-character-rally',
    definition_id: 'commander.rally',
    definition_version: 2,
    name: 'Restore Cohesion',
    description: 'Steady an ally under pressure.'
  };
  const baseline = ability => JSON.stringify({
    health: 10,
    max_health: 10,
    mana: 5,
    max_mana: 5,
    xp: 0,
    level: 1,
    inventory: [],
    abilities: [ability],
    progression_notes: ''
  });
  const insertCharacter = async (name, ability) => (await db.run(
    `INSERT INTO characters (
       campaign_id, name, class, health, max_health, mana, max_mana, xp, level,
       inventory_json, attributes_json, abilities_json, progression_notes, status, baseline_json
     ) VALUES (?, ?, 'Tester', 10, 10, 5, 5, 0, 1, '[]', '{}', ?, '', 'active', ?)`,
    [campaignId, name, JSON.stringify([ability]), baseline(ability)]
  )).id;
  const ownerCharacterId = await insertCharacter('Owner', ownedAbility);
  const otherCharacterId = await insertCharacter('Other', otherAbility);
  await db.run(
    `UPDATE campaigns SET turn_state_json = ? WHERE id = ?`,
    [JSON.stringify({ order: [ownerCharacterId, otherCharacterId], current_index: 0, round: 1 }), campaignId]
  );

  const liveState = await rpg.getCampaignState(campaignId);
  const ownerState = liveState.party.find(member => member.id === ownerCharacterId);
  const otherState = liveState.party.find(member => member.id === otherCharacterId);
  assert.notStrictEqual(ownerState.abilityTriggerRevision, otherState.abilityTriggerRevision,
    'Trigger revisions bind the authenticated table character even when both projections are empty');

  const realFetch = globalThis.fetch;
  let modelCalls = 0;
  globalThis.fetch = async () => {
    modelCalls += 1;
    throw new Error('A stale request must stop before any model call.');
  };
  try {
    await assert.rejects(
      () => rpg.takeTurn(
        campaignId,
        '  I wait and watch.  ',
        { provider: 'openai', apiKey: 'must-not-be-used' },
        otherCharacterId,
        ownerState.abilityTriggerRevision
      ),
      error => error.code === 'ABILITY_TRIGGERS_STALE'
    );
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.strictEqual(modelCalls, 0, 'Stale trigger metadata stops before Council or dice work');
  assert.strictEqual(
    (await db.get(`SELECT COUNT(*) AS count FROM turns WHERE campaign_id = ?`, [campaignId])).count,
    0,
    'Stale trigger metadata inserts no turn'
  );
  assert.deepStrictEqual(
    JSON.parse((await db.get(`SELECT abilities_json FROM characters WHERE id = ?`, [otherCharacterId])).abilities_json),
    [otherAbility],
    'Stale trigger metadata mutates no character state'
  );

  const { app } = await import('./server.js');
  const { mintSeatToken, hashSeatToken } = await import('./seat-auth.js');
  const http = await import('http');
  const previousAccess = process.env.ACCESS_SECRET;
  const seatToken = mintSeatToken();
  await db.run(
    `INSERT INTO seats (campaign_id, character_id, token_hash, label)
     VALUES (?, ?, ?, 'AKP-2 authority probe')`,
    [campaignId, otherCharacterId, hashSeatToken(seatToken)]
  );
  let listener;
  let unexpectedHttpModelCalls = 0;
  globalThis.fetch = async () => {
    unexpectedHttpModelCalls += 1;
    throw new Error('Authenticated stale requests must not reach a model.');
  };
  try {
    process.env.ACCESS_SECRET = 'akp2-host-secret';
    listener = await new Promise(resolve => {
      const server = app.listen(0, '127.0.0.1', () => resolve(server));
    });
    const port = listener.address().port;
    const request = (token, body) => new Promise((resolve, reject) => {
      const payload = Buffer.from(JSON.stringify(body));
      const req = http.request({
        host: '127.0.0.1',
        port,
        path: `/api/campaigns/${campaignId}/turn`,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': payload.length
        }
      }, response => {
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => resolve({
          status: response.statusCode,
          body: JSON.parse(Buffer.concat(chunks).toString('utf8'))
        }));
      });
      req.on('error', reject);
      req.end(payload);
    });
    const seatStale = await request(seatToken, {
      playerAction: 'I wait.',
      characterId: ownerCharacterId,
      abilityTriggerRevision: ownerState.abilityTriggerRevision
    });
    assert.deepStrictEqual(
      { status: seatStale.status, code: seatStale.body.code },
      { status: 409, code: 'ABILITY_TRIGGERS_STALE' },
      'Seat credentials select their bound character before scanning and ignore a spoofed body characterId'
    );
    const hostStale = await request('akp2-host-secret', {
      playerAction: 'I wait.',
      characterId: otherCharacterId,
      abilityTriggerRevision: ownerState.abilityTriggerRevision
    });
    assert.deepStrictEqual(
      { status: hostStale.status, code: hostStale.body.code },
      { status: 409, code: 'ABILITY_TRIGGERS_STALE' },
      'Host character selection also occurs before authoritative scanning'
    );
  } finally {
    if (listener) await new Promise(resolve => listener.close(resolve));
    globalThis.fetch = realFetch;
    if (previousAccess === undefined) delete process.env.ACCESS_SECRET;
    else process.env.ACCESS_SECRET = previousAccess;
  }
  assert.strictEqual(unexpectedHttpModelCalls, 0, 'HTTP stale responses stop before every model call');

  const playerAction = '  I backstab the orc.  ';
  const start = playerAction.indexOf('backstab');
  const invocations = validateAbilityInvocationRecord({
    schema_version: 1,
    trigger_revision: `ak1:${'c'.repeat(64)}`,
    abilities: [{
      ability_id: ownedAbility.id,
      definition_id: ownedAbility.definition_id,
      definition_version: ownedAbility.definition_version,
      matches: [{ start, end: start + 'backstab'.length, spelling: 'backstab' }]
    }]
  }, playerAction, { ownedAbilities: [ownedAbility] });
  const stateChanges = {
    input_kind: 'committed_action',
    action_resolved: true,
    character_update: { health_change: 0, mana_change: 0, xp_gain: 0, inventory_changes: [] },
    ability_updates: [],
    npc_updates: [],
    dice_rolls: [],
    quest_update: { active_quest: 'Verify', quest_description: 'Exercise the boundary.', current_act: 1 }
  };
  await db.run(
    `INSERT INTO turns (
       campaign_id, turn_number, character_id, player_action, narrative,
       state_changes_json, ability_invocations_json
     ) VALUES (?, 1, ?, ?, 'The probe records the strike.', ?, ?)`,
    [campaignId, ownerCharacterId, playerAction, JSON.stringify(stateChanges), JSON.stringify(invocations)]
  );

  const history = await readCampaignHistory(campaignId, { window: 'latest', limit: 1 });
  assert.strictEqual(history[0].player_action, playerAction, 'History preserves exact player prose');
  assert.deepStrictEqual(
    validateAbilityInvocationRecord(
      history[0].ability_invocations_json,
      history[0].player_action,
      { ownedAbilities: [ownedAbility] }
    ),
    invocations,
    'Recent history uses the same bounded invocation validator'
  );

  const exported = await rpg.exportCampaign(campaignId);
  const validatedExport = validateCampaignBundle(exported);
  assert.strictEqual(validatedExport.turns[0].player_action, playerAction,
    'Bundle validation does not trim or rewrite audited player prose');
  assert.deepStrictEqual(validatedExport.turns[0].ability_invocations, invocations,
    'Export carries the structured invocation audit record');

  const spoofedBundle = structuredClone(exported);
  const spoofedAbility = spoofedBundle.turns[0].ability_invocations.abilities[0];
  spoofedAbility.ability_id = otherAbility.id;
  spoofedAbility.definition_id = otherAbility.definition_id;
  spoofedAbility.definition_version = otherAbility.definition_version;
  assert.throws(
    () => validateCampaignBundle(spoofedBundle),
    /Bundle ability invocation record is invalid/,
    'A turn cannot import another character\'s otherwise-valid ability identity'
  );

  const importedState = await rpg.importCampaign(exported);
  const importedOwner = await db.get(
    `SELECT id, abilities_json FROM characters WHERE campaign_id = ? AND name = 'Owner'`,
    [importedState.campaignId]
  );
  const importedOwnedAbility = JSON.parse(importedOwner.abilities_json)[0];
  const importedTurn = await db.get(
    `SELECT player_action, ability_invocations_json FROM turns WHERE campaign_id = ? AND turn_number = 1`,
    [importedState.campaignId]
  );
  const importedInvocations = validateAbilityInvocationRecord(
    importedTurn.ability_invocations_json,
    importedTurn.player_action,
    { ownedAbilities: [importedOwnedAbility] }
  );
  assert.strictEqual(importedTurn.player_action, playerAction, 'Import preserves exact audited prose');
  assert.notStrictEqual(importedOwnedAbility.id, ownedAbility.id, 'Import remaps the ability instance ID');
  assert.strictEqual(importedInvocations.abilities[0].ability_id, importedOwnedAbility.id,
    'Import remaps the turn audit to the new owned ability instance');
  assert.deepStrictEqual(
    {
      id: importedInvocations.abilities[0].definition_id,
      version: importedInvocations.abilities[0].definition_version
    },
    { id: ownedAbility.definition_id, version: ownedAbility.definition_version },
    'Import preserves stable catalog definition identity and version'
  );

  const forkedState = await rpg.forkCampaign(campaignId, 1, 'Invocation Boundary Fork');
  const forkedOwner = await db.get(
    `SELECT abilities_json FROM characters WHERE campaign_id = ? AND name = 'Owner'`,
    [forkedState.campaignId]
  );
  const forkedTurn = await db.get(
    `SELECT player_action, ability_invocations_json FROM turns WHERE campaign_id = ? AND turn_number = 1`,
    [forkedState.campaignId]
  );
  const forkedOwnedAbility = JSON.parse(forkedOwner.abilities_json)[0];
  const forkedInvocations = validateAbilityInvocationRecord(
    forkedTurn.ability_invocations_json,
    forkedTurn.player_action,
    { ownedAbilities: [forkedOwnedAbility] }
  );
  assert.strictEqual(forkedTurn.player_action, playerAction, 'Fork preserves exact audited prose');
  assert.strictEqual(forkedInvocations.abilities[0].ability_id, forkedOwnedAbility.id,
    'Fork follows its existing identity policy consistently in the turn audit');
}

// -------------------------------------------------------------
// Test: ability identity — engine-issued ids (Phase PT S1.1)
// -------------------------------------------------------------
async function testAbilityIdentity() {
  console.log(' - Running ability identity tests...');
  const db = await import('./db.js');
  const rpg = await import('./rpg-engine.js');

  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  const update = (ability, action = 'add') => ({ ability_updates: [{ action, ability }] });

  // A brand-new ability is born with an engine-issued id.
  const character = { abilities: [] };
  rpg.applyAbilityUpdates(character, update({ name: 'Quick Draw', description: 'Snap shot.' }), 1);
  const quickDrawId = character.abilities[0].id;
  assert.strictEqual(UUID.test(quickDrawId), true, 'A new ability is minted with an engine-issued id');

  // THE DEFECT THIS SLICE CLOSES: identity was the lowercased display name,
  // so renaming an ability was indistinguishable from inventing a second one.
  rpg.applyAbilityUpdates(character, update({ id: quickDrawId, name: 'Fast Nock', description: 'Snap loose.' }, 'improve'), 2);
  assert.strictEqual(character.abilities.length, 1, 'Renaming through the id updates in place — it must never fork');
  assert.strictEqual(character.abilities[0].id, quickDrawId, 'The id is stable across a rename');
  assert.strictEqual(character.abilities[0].name, 'Fast Nock', 'The display name is the only thing that changed');

  // Legacy rows (written before ids) still match by name — and heal as they match.
  const legacy = { abilities: [{ name: 'Iron Stomach', description: 'Eats anything.', tier: 'trained', source: 'play' }] };
  rpg.applyAbilityUpdates(legacy, update({ name: 'iron stomach', description: 'Eats anything, twice.' }, 'improve'), 3);
  assert.strictEqual(legacy.abilities.length, 1, 'A pre-id row still matches on its name');
  const healedId = legacy.abilities[0].id;
  assert.strictEqual(UUID.test(healedId), true, 'A row matched by the legacy name fallback gains its id');
  assert.strictEqual(legacy.abilities[0].description, 'Eats anything, twice.', 'The fallback match still applies the update');

  // Re-applying the same update is a no-op on identity: no re-mint, no duplicate.
  rpg.applyAbilityUpdates(legacy, update({ name: 'iron stomach', description: 'Eats anything, twice.' }, 'improve'), 4);
  assert.strictEqual(legacy.abilities.length, 1, 'Re-applying an update never duplicates the row');
  assert.strictEqual(legacy.abilities[0].id, healedId, 'Re-applying an update never re-mints the id');

  // An id this engine never issued is treated as ABSENT (never as an error):
  // the name fallback runs, and the engine's own id survives.
  rpg.applyAbilityUpdates(character, update({ id: 'model-invented-id', name: 'Fast Nock', description: 'Faster.' }, 'improve'), 5);
  assert.strictEqual(character.abilities.length, 1, 'An unknown id falls back to the name rather than failing');
  assert.strictEqual(character.abilities[0].id, quickDrawId, 'A model-invented id never overwrites an engine-issued one');
  rpg.applyAbilityUpdates(character, update({ id: 'model-invented-id', name: 'Powder Burn' }), 6);
  const powderBurnId = character.abilities[1].id;
  assert.strictEqual(UUID.test(powderBurnId), true, 'An insert always mints — a model id is never adopted');

  // Removal matches on id too, even when the display name has moved on.
  rpg.applyAbilityUpdates(character, { ability_updates: [{ action: 'remove', ability: { id: powderBurnId, name: 'Renamed Since' } }] }, 7);
  assert.strictEqual(character.abilities.length, 1, 'Removal matches on id, not on the display name');

  // Validation accepts an echoed id but never requires one: the engine mints.
  const validated = validateTurnData({
    input_kind: 'committed_action', narrative: 'N.',
    ability_updates: [
      { action: 'improve', ability: { name: 'Fast Nock', id: `  ${quickDrawId}  ` } },
      { action: 'add', ability: { name: 'No Id Needed' } },
      { action: 'add', ability: { name: 'Junk Id', id: 42 } }
    ]
  }, 1);
  assert.strictEqual(validated.ability_updates[0].ability.id, quickDrawId, 'A model-echoed id survives validation, trimmed');
  assert.strictEqual('id' in validated.ability_updates[1].ability, false, 'Models are never required to emit an id');
  assert.strictEqual('id' in validated.ability_updates[2].ability, false, 'A non-string id is dropped, not an error');

  // The one-shot backfill mints only where an id is missing.
  const backfilled = rpg.ensureAbilityIds([{ name: 'A' }, { name: 'B', id: 'already-issued' }]);
  assert.strictEqual(UUID.test(backfilled[0].id), true, 'A legacy row heals on touch');
  assert.strictEqual(backfilled[1].id, 'already-issued', 'A row that has an id keeps it — minting happens once');

  await db.initDb();

  // Copy into a campaign carries ability ids unchanged (branch lineage).
  const campaignId = (await db.run(
    `INSERT INTO campaigns (title, genre, summary, current_act) VALUES ('t','g','s',1)`
  )).id;
  await db.run(`INSERT INTO campaign_outlines (campaign_id, outline_json) VALUES (?, ?)`,
    [campaignId, JSON.stringify({ acts: [], starting_quest: { title: 'q', description: 'd' }, theme_colors: {} })]);
  const sourceAbilities = [
    { id: 'source-ability-1', name: 'Quick Draw', description: 'Snap shot.', tier: 'trained', source: 'play' },
    { name: 'Trail Sense', description: 'Reads sign.', tier: 'emerging', source: 'play' } // legacy: no id yet
  ];
  const profileId = (await db.run(
    `INSERT INTO player_characters (name, archetype, status, health, max_health, mana, max_mana, xp, level,
      inventory_json, attributes_json, abilities_json, progression_notes)
     VALUES ('Asha', 'Gunslinger', 'available', 10, 10, 5, 5, 0, 1, '[]', '{}', ?, '')`,
    [JSON.stringify(sourceAbilities)]
  )).id;

  const joinedState = await rpg.joinCampaign(campaignId, { characterProfileId: profileId, characterMode: 'copy' });
  const joinedCharacter = joinedState.party.find(member => member.id === joinedState.joinedCharacterId);
  assert.match(joinedCharacter.abilityTriggerRevision, /^ak1:[a-f0-9]{64}$/,
    'Live party state carries an opaque server-owned trigger revision');
  assert.deepStrictEqual(joinedCharacter.invocableAbilities, [],
    'Existing free-text abilities stay non-invocable in live state');
  const copiedRow = await db.get(
    `SELECT abilities_json FROM characters WHERE campaign_id = ? ORDER BY id DESC LIMIT 1`, [campaignId]);
  const copied = JSON.parse(copiedRow.abilities_json);
  assert.strictEqual(copied[0].id, 'source-ability-1', 'A copy carries the source ability id unchanged');
  assert.strictEqual(UUID.test(copied[1].id), true, 'A legacy row is backfilled as it is copied');

  // Import: ability records land as NEW records with fresh ids, remapped
  // consistently so rows that shared an id in the bundle still share one.
  const fixture = JSON.parse(fs.readFileSync(new URL('./test-fixtures/campaign-bundle-v1.json', import.meta.url)));
  const bundle = JSON.parse(JSON.stringify(fixture));
  const shared = { id: 'bundle-ability-1', name: 'Quick Draw', description: 'Snap shot.', tier: 'trained', source: 'play' };
  bundle.characters[0].abilities_json = JSON.stringify([
    shared,
    { name: 'Written Before Ids', description: 'Legacy bundle row.', tier: 'emerging', source: 'play' }
  ]);
  bundle.characters.push({
    ...bundle.characters[0], source_id: 99, name: 'Asha (branch)', status: 'released',
    abilities_json: JSON.stringify([shared])
  });
  const importedState = await rpg.importCampaign(bundle);
  const importedRows = await db.all(
    `SELECT abilities_json FROM characters WHERE campaign_id = ? ORDER BY id ASC`, [importedState.campaignId]);
  const importedAbilities = JSON.parse(importedRows[0].abilities_json);
  const branchAbilities = JSON.parse(importedRows[1].abilities_json);
  assert.strictEqual(UUID.test(importedAbilities[0].id), true, 'Imported rows get freshly minted engine-issued ids');
  assert.notStrictEqual(importedAbilities[0].id, 'bundle-ability-1', 'A bundle id is never adopted as-is');
  assert.strictEqual(branchAbilities[0].id, importedAbilities[0].id,
    'One bundle id remaps to one new id across every row that shared it');
  assert.strictEqual(UUID.test(importedAbilities[1].id), true, 'A bundle written before ids imports cleanly, minting as it lands');

  // Old bundles carrying no ability ids at all still import without failing.
  const idlessBundle = JSON.parse(JSON.stringify(fixture));
  const idlessState = await rpg.importCampaign(idlessBundle);
  assert.strictEqual(typeof idlessState.campaignId, 'number', 'A pre-id bundle imports cleanly');
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
      { speaker: 'narrator', tone: 'tense', text: 'The bar falls quiet.' },
      { speaker: 'Kessler', tone: 'menacing', text: '"You again."' },
      { speaker: '', text: 'orphan line gets narrator' },
      { text: '   ' },
      'not an object'
    ]
  }, 1);
  assert.strictEqual(validated.narration_lines.length, 3, 'Empty/garbage lines dropped');
  assert.strictEqual(validated.narration_lines[1].speaker, 'Kessler');
  assert.strictEqual(validated.narration_lines[1].tone, 'menacing');
  assert.strictEqual(validated.narration_lines[2].tone, 'neutral', 'Missing tone is the canonical neutral value');
  assert.strictEqual(validated.narration_lines[2].speaker, 'narrator', 'Blank speaker defaults to narrator');

  // The table-talk no-op net must NOT strip the voice script (presentation, not state)
  const clarified = validateTurnData({
    input_kind: 'clarification',
    narrative: 'Answer.',
    narration_lines: [{ speaker: 'narrator', text: 'Answer.' }]
  }, 1);
  assert.strictEqual(clarified.narration_lines.length, 1, 'Voice script survives clarification forcing');

  // Sticky NPC voice assignment: deterministic, marin excluded, no private direction
  assert.strictEqual(NPC_VOICE_POOL.includes('marin'), false, 'NPC pool must exclude the default narrator voice');
  const npc = { name: 'Kessler', personality: 'Cold, patient predator', quirks: 'Never raises his voice', voice_mood: 'cold' };
  const profile1 = assignNpcVoiceProfile(npc, 0);
  const profile2 = assignNpcVoiceProfile(npc, 0);
  assert.deepStrictEqual(profile1, profile2, 'Same NPC + index → same profile (sticky)');
  assert.notStrictEqual(assignNpcVoiceProfile(npc, 1).voice, profile1.voice, 'Different index → different voice');
  assert.strictEqual(profile1.voiceSeed, 0);
  assert.strictEqual(profile1.mood, 'cold');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(profile1, 'instructions'), false,
    'New profiles never derive audible direction from private quirks');

  // Script resolution: NPC lines get stored profiles (case-insensitive), narrator gets nulls
  const npcs = [{ name: 'Kessler', voice_json: JSON.stringify({
    provider: 'openai', voice: 'cedar', voiceSeed: 0, mood: 'cold', instructions: 'Legacy direction.'
  }) }];
  const script = buildVoiceScript(validated.narration_lines, npcs);
  assert.strictEqual(script[0].voice, null, 'Narrator line: client falls back to player voice');
  assert.strictEqual(script[0].instructions, 'Tone: tense.', 'Narrator tone uses the finite enum');
  assert.strictEqual(script[1].voice, 'cedar', 'NPC line uses the stored sticky voice');
  assert.strictEqual(script[1].instructions, 'Legacy direction. Mood: cold. Tone: menacing.',
    'Legacy OpenAI direction plus canonical mood/tone compose during compatibility');
  const unknownSpeaker = buildVoiceScript([{ speaker: 'Someone New', tone: 'invented prose', text: 'Hi.' }], npcs);
  assert.strictEqual(unknownSpeaker[0].voice, null, 'Unknown speakers degrade to narrator voice');
  assert.deepStrictEqual(buildVoiceScript(undefined, npcs), [], 'Missing script → empty (single-voice fallback)');

  // A seat hands speaker/tone back to the compatibility route. The speaker is
  // bounded and the delivery value is exact enum membership.
  const { boundVoiceDirective } = await import('./rpg-state.js');
  const widest = validateTurnData({
    input_kind: 'dialogue',
    narrative: 'x',
    narration_lines: [{ speaker: 'S'.repeat(500), tone: 'manic', text: 'Line.' }]
  }, 1).narration_lines[0];
  const bounded = boundVoiceDirective(widest.speaker, widest.tone);
  assert.strictEqual(bounded.tone, widest.tone,
    'The narrate route passes through the longest tone validateTurnData emits');
  assert.strictEqual(bounded.speaker, widest.speaker,
    'The narrate route passes through the longest speaker validateTurnData emits');

  // Hostile free text cannot become a model instruction; speaker remains bounded.
  const hostile = boundVoiceDirective('x'.repeat(9000), 'y'.repeat(9000));
  assert.strictEqual(hostile.tone, 'neutral', 'Unknown delivery text falls closed to neutral');
  assert.strictEqual(hostile.speaker.length, 80, 'Over-length speaker is truncated to the cap');
  assert.deepStrictEqual(boundVoiceDirective(undefined, null), { speaker: '', tone: 'neutral' }, 'Missing fields degrade to neutral');
}

// -------------------------------------------------------------
// Test: portable voice state across creation, fork, export, and import (v-2)
// -------------------------------------------------------------
async function testPortableVoicePersistence() {
  console.log(' - Running portable voice persistence tests...');
  const db = await import('./db.js');
  const { createCampaign, exportCampaign, forkCampaign, importCampaign } = await import('./rpg-engine.js');
  const { resolveNpcVoiceProfile } = await import('./tts-providers.js');

  const outline = {
    title: 'Voice Portability Probe',
    setting: 'A compact test stage.',
    theme_colors: { primary: '210, 50%, 50%', secondary: '30, 50%, 50%', background: '220, 20%, 8%' },
    theme_fonts: { title: 'Cinzel', body: 'Inter', dialogue: 'Crimson Pro' },
    acts: [{ act: 1, title: 'Probe', objective: 'Verify voice state', key_events: ['begin'] }],
    major_locations: [{ name: 'Test Stage', description: 'A single controlled room.' }],
    key_npcs: [
      { name: 'Aster', role: 'Guide', personality: 'PRIVATE_ASTER', quirks: 'PRIVATE_QUIRK', voice_mood: 'warm' },
      { name: 'Borel', role: 'Guard', personality: 'PRIVATE_BOREL', quirks: 'PRIVATE_QUIRK', voice_mood: 'gruff' }
    ],
    starting_quest: { title: 'Begin', description: 'Start the probe.' }
  };
  const opening = {
    input_kind: 'dialogue',
    narrative: 'The test stage waits.',
    narration_lines: [{ speaker: 'narrator', tone: 'neutral', text: 'The test stage waits.' }],
    scene_grounding: 'A single room with one exit.',
    suggested_choices: ['Begin'],
    character_update: {},
    quest_update: { active_quest: 'Begin', quest_description: 'Start the probe.', current_act: 1 },
    npc_updates: [],
    memory_summary: 'The probe began.',
    memory_importance: 1,
    memory_keywords: 'probe'
  };
  const layout = {
    name: 'Test Stage', description: 'A single controlled room.',
    areas: [{ id: 'stage', name: 'Stage', x: 0, y: 0, w: 100, h: 100 }],
    exits: [], features: []
  };

  const realFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    const prompt = body.messages.map(message => message.content).join('\n');
    const payload = prompt.includes('Draft an epic')
      ? outline
      : prompt.includes('Set the scene and begin')
        ? opening
        : layout;
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] })
    };
  };

  try {
    const created = await createCampaign({
      genre: 'test', characterName: 'Tester', characterClass: 'Observer',
      apiConfig: { provider: 'openai', apiKey: 'test-key', voiceProvider: 'grok' },
      rulesMode: false, ruleset: 'none'
    });
    const createdCampaign = await db.get(`SELECT * FROM campaigns WHERE id = ?`, [created.campaignId]);
    assert.deepStrictEqual(JSON.parse(createdCampaign.narrator_voice_json), {
      provider: 'grok', voice: 'leo', voiceSeed: null, mood: 'neutral'
    }, 'Campaign creation persists the active provider reserved narrator');
    const openingInvocationRow = await db.get(
      `SELECT player_action, ability_invocations_json FROM turns
       WHERE campaign_id = ? AND turn_number = 1`,
      [created.campaignId]
    );
    const openingInvocations = validateAbilityInvocationRecord(
      openingInvocationRow.ability_invocations_json,
      openingInvocationRow.player_action
    );
    assert.deepStrictEqual(openingInvocations.abilities, [],
      'Opening turns persist the same empty versioned invocation shape');
    assert.match(openingInvocations.trigger_revision, /^ak1:[a-f0-9]{64}$/,
      'Opening invocation records bind to the opening character trigger revision');

    const createdNpcs = await db.all(`SELECT id, name, voice_json FROM npcs WHERE campaign_id = ? ORDER BY id`, [created.campaignId]);
    const createdProfiles = createdNpcs.map(npc => JSON.parse(npc.voice_json));
    assert.deepStrictEqual(createdProfiles, [
      { provider: 'grok', voice: 'altair', voiceSeed: 0, mood: 'warm' },
      { provider: 'grok', voice: 'atlas', voiceSeed: 1, mood: 'gruff' }
    ], 'Creation indexes are collision-free within the provider pool cycle');
    assert.strictEqual(JSON.stringify(createdProfiles).includes('PRIVATE_'), false,
      'New stored profiles contain no private personality or quirk text');

    const forked = await forkCampaign(created.campaignId, 1, 'Voice Portability Fork');
    const forkCampaignRow = await db.get(`SELECT narrator_voice_json FROM campaigns WHERE id = ?`, [forked.campaignId]);
    assert.strictEqual(forkCampaignRow.narrator_voice_json, createdCampaign.narrator_voice_json,
      'Fork copies the canonical narrator profile verbatim');
    const forkProfiles = (await db.all(`SELECT voice_json FROM npcs WHERE campaign_id = ? ORDER BY id`, [forked.campaignId]))
      .map(row => JSON.parse(row.voice_json));
    assert.deepStrictEqual(forkProfiles, createdProfiles, 'Fork copies NPC voice profiles instead of reassigning them');

    const exported = await exportCampaign(created.campaignId);
    assert.deepStrictEqual(JSON.parse(exported.campaign.narrator_voice_json), JSON.parse(createdCampaign.narrator_voice_json));
    assert.deepStrictEqual(JSON.parse(exported.npcs[0].voice_json), createdProfiles[0]);
    const imported = await importCampaign(exported);
    const importedCampaign = await db.get(`SELECT narrator_voice_json FROM campaigns WHERE id = ?`, [imported.campaignId]);
    const importedNpc = await db.get(`SELECT voice_json FROM npcs WHERE campaign_id = ? ORDER BY id LIMIT 1`, [imported.campaignId]);
    assert.deepStrictEqual(JSON.parse(importedCampaign.narrator_voice_json), {
      provider: 'grok', voice: 'leo', instructions: '', voiceSeed: null, mood: 'neutral'
    });
    assert.deepStrictEqual(JSON.parse(importedNpc.voice_json), {
      provider: 'grok', voice: 'altair', instructions: '', voiceSeed: 0, mood: 'warm'
    }, 'Export/import preserves numeric seed type and mood');

    const legacyRows = [
      { id: 4, voice_json: JSON.stringify({ provider: 'openai', voice: 'cedar' }) },
      { id: 91, voice_json: JSON.stringify({ provider: 'openai', voice: 'ash' }) },
      { id: 400, voice_json: JSON.stringify({ provider: 'openai', voice: 'onyx' }) }
    ];
    const legacyResolved = legacyRows.map((row, ordinal) => resolveNpcVoiceProfile(row.voice_json, 'grok', ordinal));
    assert.deepStrictEqual(legacyResolved.map(profile => profile.voice), ['altair', 'atlas', 'castor'],
      'Legacy gapped global ids resolve by zero-based campaign ordinal, not id modulo the pool');
  } finally {
    globalThis.fetch = realFetch;
  }
}

// -------------------------------------------------------------
// Test: canonical host/seat audio HTTP boundary and shared cost (v-3)
// -------------------------------------------------------------
async function testCanonicalVoiceRoute() {
  console.log(' - Running canonical voice HTTP route tests...');
  const http = await import('http');
  const db = await import('./db.js');
  const { mintSeatToken, hashSeatToken } = await import('./seat-auth.js');
  const { loadAdminAiConfig, saveAdminAiConfig } = await import('./server-config.js');
  const { cleanSpokenText, resetVoiceNarrationState } = await import('./voice-narration.js');
  const { app } = await import('./server.js');

  assert.strictEqual(
    cleanSpokenText('The [angry] guard says [open the vault] now. A stray ] remains.'),
    'The guard says now. A stray remains.',
    'Bracket interiors and unmatched brackets are deleted before server tags are composed'
  );
  assert.strictEqual(cleanSpokenText('Read [the visible label](https://secret.example).'), 'Read the visible label.',
    'Existing narration cleanup preserves a Markdown link label before bracket deletion');

  const previousAccess = process.env.ACCESS_SECRET;
  const previousAdmin = process.env.ADMIN_SECRET;
  const previousConfig = await loadAdminAiConfig();
  const realFetch = globalThis.fetch;
  let server;
  const providerCalls = [];
  let failNext = false;

  try {
    process.env.ACCESS_SECRET = 'voice-route-host';
    process.env.ADMIN_SECRET = 'voice-route-admin';
    await saveAdminAiConfig({
      voiceProvider: 'grok',
      voiceApiKeys: { openai: 'openai-route-key', grok: 'grok-route-key' }
    });
    resetVoiceNarrationState();

    const campaignId = (await db.run(
      `INSERT INTO campaigns (title, genre, summary, current_act, narrator_voice_json)
       VALUES ('Voice Route One', 'test', 'test', 1, ?)`,
      [JSON.stringify({ provider: 'grok', voice: 'leo', voiceSeed: null, mood: 'neutral' })]
    )).id;
    const otherCampaignId = (await db.run(
      `INSERT INTO campaigns (title, genre, summary, current_act, narrator_voice_json)
       VALUES ('Voice Route Two', 'test', 'test', 1, ?)`,
      [JSON.stringify({ provider: 'grok', voice: 'leo', voiceSeed: null, mood: 'manic' })]
    )).id;
    await db.run(
      `INSERT INTO npcs (campaign_id, name, role, personality, quirks, relationship_value, notes, status, voice_json)
       VALUES (?, 'Aster', 'guide', 'PRIVATE_PERSONALITY', 'PRIVATE_QUIRK', 0, '', 'alive', ?)`,
      [campaignId, JSON.stringify({
        provider: 'grok', voice: 'altair', voiceSeed: 0, mood: 'warm',
        instructions: 'PRIVATE_DIRECTION_NEVER_SEND'
      })]
    );
    await db.run(
      `INSERT INTO npcs (campaign_id, name, role, personality, quirks, relationship_value, notes, status, voice_json)
       VALUES (?, 'Borel', 'guard', '', '', 0, '', 'alive', ?)`,
      [campaignId, JSON.stringify({ provider: 'grok', voice: 'atlas', voiceSeed: 1, mood: 'gruff' })]
    );
    const characterId = (await db.run(
      `INSERT INTO characters (campaign_id, name, class, health, max_health, mana, max_mana, xp, level,
       inventory_json, attributes_json, abilities_json, status)
       VALUES (?, 'Seat Player', 'tester', 10, 10, 5, 5, 0, 1, '[]', '{}', '[]', 'active')`,
      [campaignId]
    )).id;
    const seatToken = mintSeatToken();
    await db.run(
      `INSERT INTO seats (campaign_id, character_id, token_hash, label) VALUES (?, ?, ?, 'voice route')`,
      [campaignId, characterId, hashSeatToken(seatToken)]
    );

    globalThis.fetch = async (url, options) => {
      const call = {
        url: String(url),
        auth: options.headers.Authorization,
        body: JSON.parse(options.body)
      };
      providerCalls.push(call);
      await new Promise(resolve => setTimeout(resolve, 20));
      if (failNext) {
        failNext = false;
        return { ok: false, status: 503, statusText: 'Unavailable', text: async () => 'temporary' };
      }
      return {
        ok: true,
        arrayBuffer: async () => new Uint8Array([0x49, 0x44, 0x33, 0x04]).buffer
      };
    };

    server = await new Promise(resolve => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    const port = server.address().port;
    const request = (pathname, { method = 'GET', token = 'voice-route-host', body } = {}) => new Promise((resolve, reject) => {
      const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
      const req = http.request({
        host: '127.0.0.1', port, path: pathname, method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': payload.length } : {})
        }
      }, response => {
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => resolve({
          status: response.statusCode,
          headers: response.headers,
          body: Buffer.concat(chunks)
        }));
      });
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
    const json = response => JSON.parse(response.body.toString('utf8'));

    const capabilities = await request('/api/audio/capabilities');
    assert.strictEqual(capabilities.status, 200);
    assert.deepStrictEqual(json(capabilities), { provider: 'grok', maxSegmentsPerRequest: 40 });
    const catalog = await request('/api/admin/voice-catalog', { token: 'voice-route-admin' });
    assert.strictEqual(catalog.status, 200);
    assert.deepStrictEqual(json(catalog).providers.map(entry => entry.provider), ['openai', 'grok']);
    assert.strictEqual(json(catalog).providers[1].narratorVoice, 'leo');

    const canonicalBody = {
      campaignId,
      speaker: 'Aster',
      segments: [{
        text: 'The [angry] guard says [open the vault] now. A stray ] remains.',
        tone: 'tense'
      }]
    };
    const [hostAudio, seatAudio] = await Promise.all([
      request('/api/audio/narrate', { method: 'POST', body: canonicalBody }),
      request('/api/audio/narrate', {
        method: 'POST', token: seatToken,
        body: { ...canonicalBody, campaignId: otherCampaignId }
      })
    ]);
    assert.strictEqual(hostAudio.status, 200);
    assert.strictEqual(seatAudio.status, 200);
    assert.deepStrictEqual(hostAudio.body, seatAudio.body);
    assert.strictEqual(providerCalls.length, 1, 'Simultaneous host and seat playback causes one provider call');
    assert.strictEqual(providerCalls[0].url, 'https://api.x.ai/v1/tts');
    assert.strictEqual(providerCalls[0].auth, 'Bearer grok-route-key');
    assert.strictEqual(providerCalls[0].body.voice_id, 'altair', 'Seat body campaign spoof is ignored');
    assert.strictEqual(providerCalls[0].body.text, '[warm, tense] The guard says now. A stray remains.');
    assert.strictEqual(JSON.stringify(providerCalls[0]).includes('PRIVATE_'), false,
      'Private NPC profile text never crosses the audio boundary');

    assert.strictEqual((await request('/api/audio/narrate', { method: 'POST', body: canonicalBody })).status, 200);
    assert.strictEqual(providerCalls.length, 1, 'Later identical playback hits the completed cache');
    await request('/api/audio/narrate', {
      method: 'POST', body: { ...canonicalBody, segments: [{ text: canonicalBody.segments[0].text, tone: 'angry' }] }
    });
    assert.strictEqual(providerCalls.length, 2, 'Different tone misses the cache');
    await request('/api/audio/narrate', {
      method: 'POST', body: { campaignId: otherCampaignId, speaker: 'narrator', segments: [{ text: 'Same words.', tone: 'neutral' }] }
    });
    await request('/api/audio/narrate', {
      method: 'POST', body: { campaignId, speaker: 'narrator', segments: [{ text: 'Same words.', tone: 'neutral' }] }
    });
    assert.strictEqual(providerCalls.length, 4, 'Campaign scope is part of the cache key');

    const previewText = 'Preview scope words.';
    await request('/api/audio/narrate', {
      method: 'POST', body: { campaignId, speaker: 'narrator', segments: [{ text: previewText, tone: 'neutral' }] }
    });
    await request('/api/audio/narrate', {
      method: 'POST', body: { preview: true, segments: [{ text: previewText, tone: 'neutral' }] }
    });
    assert.strictEqual(providerCalls.length, 6, 'Preview has a distinct cache scope');

    assert.strictEqual((await request('/api/audio/narrate', {
      method: 'POST', body: { segments: [{ text: 'No campaign.', tone: 'neutral' }] }
    })).status, 400, 'Host campaign narration requires campaignId');
    assert.strictEqual((await request('/api/audio/narrate', {
      method: 'POST', body: { campaignId: 0, segments: [{ text: 'Bad id.', tone: 'neutral' }] }
    })).status, 400);
    assert.strictEqual((await request('/api/audio/narrate', {
      method: 'POST', body: { campaignId: 999999999, segments: [{ text: 'Missing.', tone: 'neutral' }] }
    })).status, 404);
    assert.strictEqual((await request('/api/audio/narrate', {
      method: 'POST', body: { preview: true, campaignId, segments: [{ text: 'Conflict.', tone: 'neutral' }] }
    })).status, 400);
    assert.strictEqual((await request('/api/audio/narrate', {
      method: 'POST', body: { preview: true, speaker: 'Aster', segments: [{ text: 'Conflict.', tone: 'neutral' }] }
    })).status, 400);

    const beforeRace = providerCalls.length;
    await saveAdminAiConfig({
      voiceProvider: 'openai',
      voiceApiKeys: { openai: 'openai-route-key', grok: '' }
    });
    const raced = await request('/api/audio/narrate', {
      method: 'POST', body: { ...canonicalBody, expectedProvider: 'grok' }
    });
    assert.strictEqual(raced.status, 409);
    assert.strictEqual(json(raced).code, 'VOICE_PROVIDER_CHANGED');
    assert.strictEqual(providerCalls.length, beforeRace, 'Provider mismatch returns before synthesis');
    const oversized = await request('/api/audio/narrate', {
      method: 'POST', body: {
        campaignId, expectedProvider: 'openai', speaker: 'Aster',
        segments: [{ text: 'one', tone: 'neutral' }, { text: 'two', tone: 'neutral' }]
      }
    });
    assert.strictEqual(oversized.status, 400);
    assert.strictEqual(providerCalls.length, beforeRace, 'Provider maximum is enforced before synthesis');

    const openAiAudio = await request('/api/audio/narrate', {
      method: 'POST', body: {
        campaignId, expectedProvider: 'openai', speaker: 'Aster',
        segments: [{ text: 'Provider key isolation.', tone: 'cold' }]
      }
    });
    assert.strictEqual(openAiAudio.status, 200);
    assert.strictEqual(providerCalls.at(-1).url, 'https://api.openai.com/v1/audio/speech');
    assert.strictEqual(providerCalls.at(-1).auth, 'Bearer openai-route-key');
    assert.strictEqual(providerCalls.at(-1).body.voice, 'cedar');

    await saveAdminAiConfig({
      voiceProvider: 'grok',
      voiceApiKeys: { openai: '', grok: 'grok-route-key' }
    });
    const grokAgain = await request('/api/audio/narrate', {
      method: 'POST', body: {
        campaignId, expectedProvider: 'grok', speaker: 'Aster',
        segments: [{ text: 'Provider key isolation.', tone: 'cold' }]
      }
    });
    assert.strictEqual(grokAgain.status, 200);
    assert.strictEqual(providerCalls.at(-1).url, 'https://api.x.ai/v1/tts');
    assert.strictEqual(providerCalls.at(-1).auth, 'Bearer grok-route-key');
    assert.strictEqual(providerCalls.at(-1).body.voice_id, 'altair');

    failNext = true;
    const failed = await request('/api/audio/narrate', {
      method: 'POST', body: { campaignId, speaker: 'Borel', segments: [{ text: 'Retry after failure.', tone: 'gruff' }] }
    });
    assert.strictEqual(failed.status, 500);
    const callsAfterFailure = providerCalls.length;
    const recovered = await request('/api/audio/narrate', {
      method: 'POST', body: { campaignId, speaker: 'Borel', segments: [{ text: 'Retry after failure.', tone: 'gruff' }] }
    });
    assert.strictEqual(recovered.status, 200);
    assert.strictEqual(providerCalls.length, callsAfterFailure + 1, 'A failed synthesis is not cached');
  } finally {
    globalThis.fetch = realFetch;
    resetVoiceNarrationState();
    if (server) await new Promise(resolve => server.close(resolve));
    if (previousConfig) {
      await db.run(
        `INSERT INTO server_settings (key, value, updated_at) VALUES ('ai_config', ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
        [JSON.stringify(previousConfig)]
      );
    } else {
      await db.run(`DELETE FROM server_settings WHERE key = 'ai_config'`);
    }
    if (previousAccess === undefined) delete process.env.ACCESS_SECRET;
    else process.env.ACCESS_SECRET = previousAccess;
    if (previousAdmin === undefined) delete process.env.ADMIN_SECRET;
    else process.env.ADMIN_SECRET = previousAdmin;
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

// -------------------------------------------------------------
// Test: seat credentials (Phase S1)
// -------------------------------------------------------------
async function testSeatAuth() {
  console.log(' - Running seat credential tests...');
  const { mintSeatToken, looksLikeSeatToken, hashSeatToken } = await import('./seat-auth.js');

  const token = mintSeatToken();
  assert.strictEqual(looksLikeSeatToken(token), true, 'Minted tokens carry the seat prefix');
  assert.strictEqual(token.length >= 53, true, 'Tokens carry 24 bytes of entropy');
  assert.notStrictEqual(mintSeatToken(), token, 'Every mint is unique');

  assert.strictEqual(hashSeatToken(token), hashSeatToken(token), 'Hashing is deterministic');
  assert.notStrictEqual(hashSeatToken(token), hashSeatToken(mintSeatToken()), 'Different tokens, different hashes');
  assert.strictEqual(hashSeatToken(token).includes(token.slice(5, 20)), false, 'The hash does not embed the token');

  assert.strictEqual(looksLikeSeatToken('not-a-seat'), false);
  assert.strictEqual(looksLikeSeatToken('seat_short'), false, 'Truncated tokens rejected by shape');
  assert.strictEqual(looksLikeSeatToken(null), false);

  // sv-3: the browser duplicates this shape test (it cannot import a server
  // module). The two MUST agree: if the client calls a credential a seat while
  // the server calls it a host, the browser bootstraps via /api/seat/session
  // and a valid host is locked out with a 403. Extract the client's predicate
  // from source and compare behavior, so a divergence fails the suite.
  const appSource = fs.readFileSync(new URL('./public/app.js', import.meta.url), 'utf8');
  const clientFnMatch = appSource.match(/function isSeatToken\(token\) \{[\s\S]*?\n\}/);
  assert.notStrictEqual(clientFnMatch, null, 'public/app.js must define isSeatToken');
  const clientPrefixMatch = appSource.match(/const SEAT_TOKEN_PREFIX = '([^']+)';/);
  assert.notStrictEqual(clientPrefixMatch, null, 'public/app.js must define SEAT_TOKEN_PREFIX');
  // eslint-disable-next-line no-new-func
  const clientIsSeatToken = new Function(
    `const SEAT_TOKEN_PREFIX = '${clientPrefixMatch[1]}';
     ${clientFnMatch[0]}
     return isSeatToken;`
  )();

  const corpus = [
    mintSeatToken(),                 // a real minted token
    'seat_' + 'a'.repeat(48),        // real shape
    'seat_1234567890abcdef',         // seat_ prefix, exactly 16 after → HOST secret
    'seat_' + 'b'.repeat(17),        // 17 after → seat
    'seat_short',
    'seat_',
    'plain-access-secret',
    'not-a-seat',
    ''
  ];
  for (const token of corpus) {
    assert.strictEqual(
      clientIsSeatToken(token), looksLikeSeatToken(token),
      `Client and server must classify "${token.slice(0, 24)}…" identically`
    );
  }
  assert.strictEqual(looksLikeSeatToken('seat_1234567890abcdef'), false,
    'A short seat_-prefixed host secret is NOT a seat token');
}

// -------------------------------------------------------------
// Test: seat credential lifecycle against a throwaway DB (sv-1)
//
// A seat must not outlive its character's table membership: a released
// character's token, if still live, gets re-bound by takeTurn's
// single-character fast path to whoever remains at the table.
// -------------------------------------------------------------
async function testSeatLifecycle() {
  console.log(' - Running seat lifecycle tests...');
  const db = await import('./db.js');
  const rpg = await import('./rpg-engine.js');
  const { mintSeatToken, hashSeatToken, findLiveSeat } = await import('./seat-auth.js');

  {
    await db.initDb();

    const campaignId = (await db.run(
      `INSERT INTO campaigns (title, genre, summary, current_act) VALUES ('t','g','s',1)`
    )).id;
    await db.run(`INSERT INTO campaign_outlines (campaign_id, outline_json) VALUES (?, ?)`,
      [campaignId, JSON.stringify({ acts: [], starting_quest: { title: 'q', description: 'd' }, theme_colors: {} })]);

    const mkChar = async (name) => (await db.run(
      `INSERT INTO characters (campaign_id, name, class, health, max_health, mana, max_mana, xp, level,
        inventory_json, attributes_json, abilities_json, status)
       VALUES (?, ?, 'c', 10, 10, 5, 5, 0, 1, '[]', '{}', '[]', 'active')`, [campaignId, name])).id;
    const alice = await mkChar('Alice');
    const bob = await mkChar('Bob');
    await db.run(`UPDATE campaigns SET turn_state_json = ? WHERE id = ?`,
      [JSON.stringify({ order: [alice, bob], current_index: 0, round: 1 }), campaignId]);

    // The host mints Alice's seat, then releases Alice from the table.
    const aliceToken = mintSeatToken();
    await db.run(`INSERT INTO seats (campaign_id, character_id, token_hash, label) VALUES (?,?,?,?)`,
      [campaignId, alice, hashSeatToken(aliceToken), 'Alice']);
    await rpg.releaseCharacter(campaignId, alice);

    // (a) Release revokes the seat.
    const aliceSeat = await db.get(`SELECT revoked_at FROM seats WHERE character_id = ?`, [alice]);
    assert.notStrictEqual(aliceSeat.revoked_at, null, 'Releasing a character revokes its seat');

    // (b) findLiveSeat — the exact predicate server.js authenticates with —
    // rejects an orphaned seat.
    assert.strictEqual(await findLiveSeat(hashSeatToken(aliceToken)), undefined,
      'A released character\'s seat token must not authenticate');

    // Backstop proof: even un-revoked, a seat on an inactive character is dead.
    // This is what protects against any FUTURE path that deactivates a
    // character without going through releaseCharacter.
    await db.run(`UPDATE seats SET revoked_at = NULL WHERE character_id = ?`, [alice]);
    assert.strictEqual(await findLiveSeat(hashSeatToken(aliceToken)), undefined,
      'An un-revoked seat on a released character still must not authenticate');

    // Bob is untouched: an active character's seat authenticates normally.
    const bobToken = mintSeatToken();
    await db.run(`INSERT INTO seats (campaign_id, character_id, token_hash, label) VALUES (?,?,?,?)`,
      [campaignId, bob, hashSeatToken(bobToken), 'Bob']);
    const bobSeat = await findLiveSeat(hashSeatToken(bobToken));
    assert.strictEqual(bobSeat?.character_id, bob, 'An active character\'s seat still authenticates');

    // (c) THE IN-FLIGHT RACE (codex, sv-1 round 2). authenticate() captures
    // the seat's characterId, then the request awaits the AI-config lookup
    // and the campaign queue. A release landing in that window leaves a
    // live, already-authorized context whose character is gone — revoking
    // the credential cannot help, because auth already happened. takeTurn
    // must refuse to re-bind the stale id to the sole survivor.
    const staleAliceId = alice;                       // captured at auth time
    const partyNow = await db.all(
      `SELECT * FROM characters WHERE campaign_id = ? AND COALESCE(status,'active') = 'active' ORDER BY id ASC`,
      [campaignId]);
    assert.deepStrictEqual(partyNow.map(c => c.id), [bob], 'Alice is gone; Bob is the sole member');
    assert.throws(
      () => rpg.selectSpeakingCharacter(partyNow, staleAliceId),
      (err) => err.code === 'CHARACTER_NOT_AT_TABLE',
      'A stale seat context must NOT be re-bound to the sole remaining character'
    );

    // The legitimate paths still work.
    assert.strictEqual(rpg.selectSpeakingCharacter(partyNow, bob).id, bob, 'Bob may still act as Bob');
    assert.strictEqual(rpg.selectSpeakingCharacter(partyNow, null).id, bob,
      'Host solo play (no characterId supplied, one member) is unchanged');
    assert.throws(
      () => rpg.selectSpeakingCharacter([{ id: 1 }, { id: 2 }], null),
      (err) => err.code === 'CHARACTER_REQUIRED',
      'A multi-character campaign still demands an explicit speaker'
    );
  }
}

// -------------------------------------------------------------
// Test: seat-scoped visibility (Phase S2)
// -------------------------------------------------------------
async function testSeatVisibility() {
  console.log(' - Running seat visibility scoping tests...');
  const { scopeStateForSeat, scopeJournalForSeat, resolveSpeakerVoice, silhouetteCharacter } = await import('./rpg-state.js');

  // Distinctive markers: if ANY of these strings survives into a seat
  // payload, the corresponding GM-private surface leaked.
  const LEAK = {
    outline: 'LEAK_OUTLINE_the_duke_is_secretly_the_lich',
    npcNotes: 'LEAK_NPC_NOTES_kessler_betrays_the_party_in_act_3',
    npcPersonality: 'LEAK_PERSONALITY_cold_patient_predator',
    voiceInstructions: 'LEAK_VOICE_speak_as_a_cold_patient_predator',
    summaryMemory: 'LEAK_SUMMARY_last_events_the_vault_heist',
    partymateInventory: 'LEAK_INVENTORY_mira_hidden_poison_vial',
    partymateAbility: 'LEAK_ABILITY_mira_secret_trigger',
    dials: 'LEAK_DIALS_hardline',
    stateChanges: 'LEAK_STATE_CHANGES_memory_update_text',
    memory: 'LEAK_MEMORY_the_password_is_ravenlight'
  };

  const hostState = {
    campaignId: 7,
    title: 'Velvet Protocol',
    genre: 'cyberpunk heist',
    setting: `Act 2. Level 3 Netrunner pursuing: The Vault. ${LEAK.summaryMemory}`,
    themeColors: { primary: '#101018' },
    themeFonts: { heading: 'Cinzel' },
    rulesMode: true,
    ruleset: { name: 'House Rules', resolution: 'd20 + mod vs DC', abilities: [], notes: '' },
    tableStyle: { helpfulness: LEAK.dials, pacing: 'standard' },
    character: { id: 2, name: 'Mira', class: 'Face', level: 3, health: 9, max_health: 12, inventory: [LEAK.partymateInventory], attributes: { charm: 4 }, abilities: [], progression_notes: '' },
    party: [
      {
        id: 1, name: 'Joe', class: 'Netrunner', level: 3, health: 10, max_health: 14,
        mana: 5, max_mana: 8, xp: 240, inventory: ['deck', 'sidearm'], attributes: { intellect: 4 },
        abilities: [{ name: 'Ghostline' }], progression_notes: 'learned Ghostline turn 4', player_character_id: 11,
        abilityTriggerRevision: `ak1:${'a'.repeat(64)}`,
        invocableAbilities: [{
          abilityId: 'joe-ghostline', definitionId: 'operator.ghostline', definitionVersion: 1,
          name: 'ghostline', trigger: 'ghostline', aliases: [], familyKey: 'access',
          familyLabel: 'Access', help: 'Slip through a guarded system.'
        }]
      },
      {
        id: 2, name: 'Mira', class: 'Face', level: 3, health: 9, max_health: 12,
        mana: 6, max_mana: 6, xp: 230, inventory: [LEAK.partymateInventory], attributes: { charm: 4 },
        abilities: [], progression_notes: '', player_character_id: 12,
        abilityTriggerRevision: `ak1:${'b'.repeat(64)}`,
        invocableAbilities: [{
          abilityId: 'mira-secret', definitionId: 'face.secret', definitionVersion: 1,
          name: 'secret', trigger: 'secret', aliases: [], familyKey: 'influence',
          familyLabel: 'Influence', help: LEAK.partymateAbility
        }]
      }
    ],
    turnOrder: { round: 2, actingCharacterId: 2, order: [{ id: 1, name: 'Joe' }, { id: 2, name: 'Mira' }] },
    npcs: [{ id: 5, name: 'Kessler', role: 'fixer', personality: LEAK.npcPersonality, quirks: 'never raises his voice', notes: LEAK.npcNotes, relationship_value: -2, voice_json: JSON.stringify({ voice: 'cedar', instructions: LEAK.voiceInstructions }) }],
    outline: { acts: [{ twist: LEAK.outline }], starting_quest: { title: 'The Vault', description: 'Crack it.' } },
    // sv-4: production sends the validated quest_update here, which carries
    // current_act — outline progression the whitelist drops at top level.
    currentQuest: { active_quest: 'The Vault', quest_description: 'Crack it.', current_act: 2 },
    currentAct: 2,
    turn: {
      number: 9,
      playerAction: 'I case the lobby.',
      inputKind: 'committed_action',
      narrative: 'The lobby hums with drone traffic.',
      sceneGrounding: 'Two guards flank the east door.',
      svg: '<svg></svg>',
      suggestedChoices: ['Talk to the clerk'],
      rollResults: [{ attribute: 'stealth', roll: 14, dc: 12, success: true }],
      voiceLines: [
        { speaker: 'narrator', text: 'The lobby hums.', tone: 'tense', voice: null, instructions: 'Tone: tense.' },
        { speaker: 'Kessler', text: '"You again."', tone: 'menacing', voice: 'cedar', instructions: `${LEAK.voiceInstructions} Tone: menacing.` }
      ],
      location: { name: 'Corporate Lobby', positional: true },
      heroic: { imageUrl: '/api/campaigns/7/images/3', subjectKind: 'location', subjectKey: 'corporate lobby' }
    }
  };

  // Seat 1 (Joe) views the table while Mira is acting.
  const scoped = scopeStateForSeat(hostState, 1);
  const raw = JSON.stringify(scoped);
  for (const [surface, marker] of Object.entries(LEAK)) {
    assert.strictEqual(raw.includes(marker), false, `Seat payload must not leak ${surface}`);
  }
  assert.strictEqual(raw.includes('outline'), false, 'No outline field at all');
  assert.strictEqual(raw.includes('npcs'), false, 'No npcs field at all');

  // Own sheet full; partymate silhouetted to name/class/level/HP.
  assert.strictEqual(scoped.seatCharacterId, 1);
  assert.strictEqual(scoped.character.id, 1, 'Seat sees its OWN sheet, not the acting character');
  assert.deepStrictEqual(scoped.character.inventory, ['deck', 'sidearm'], 'Own inventory intact');
  assert.strictEqual(scoped.character.abilityTriggerRevision, `ak1:${'a'.repeat(64)}`,
    'Seat receives its own opaque trigger revision');
  assert.deepStrictEqual(scoped.character.invocableAbilities.map(ability => ability.abilityId), ['joe-ghostline'],
    'Seat receives only its own validated trigger projection');
  const mira = scoped.party.find(m => m.id === 2);
  assert.deepStrictEqual(Object.keys(mira).sort(), ['class', 'health', 'id', 'level', 'max_health', 'name'], 'Partymate is a silhouette');

  // Shared table surfaces survive.
  assert.strictEqual(scoped.turn.narrative, hostState.turn.narrative);
  assert.strictEqual(scoped.turn.sceneGrounding, hostState.turn.sceneGrounding);
  assert.deepStrictEqual(scoped.turn.location, hostState.turn.location);
  assert.deepStrictEqual(scoped.turn.heroic, hostState.turn.heroic);
  assert.deepStrictEqual(scoped.turn.suggestedChoices, hostState.turn.suggestedChoices);
  assert.deepStrictEqual(scoped.ruleset, hostState.ruleset, 'Ruleset is player-viewable canon');
  assert.deepStrictEqual(scoped.turnOrder, hostState.turnOrder);
  assert.strictEqual(scoped.currentAct, undefined, 'Act structure stays with the outline');
  // sv-4: and it must not ride along nested inside currentQuest either.
  assert.strictEqual(raw.includes('current_act'), false, 'No act index anywhere in the seat payload');
  assert.deepStrictEqual(scoped.currentQuest, { active_quest: 'The Vault', quest_description: 'Crack it.' },
    'currentQuest is whitelisted to its player-facing fields');

  // sv-4 ROUND 2 (reviewer): whitelisting property NAMES is not whitelisting.
  // A permitted name can hold an arbitrary value. validateCampaignBundle used
  // to preserve adversarial quest_update shapes, and getCampaignState promotes
  // the last turn's quest_update into currentQuest — so an imported
  // `active_quest: {current_act: 3, outline: "…"}` sailed through untouched.
  const hostile = scopeStateForSeat({
    party: [{ id: 1, name: 'A' }],
    currentQuest: {
      active_quest: { current_act: 3, outline: 'LEAK_NESTED_TWIST_the_duke_is_the_lich' },
      quest_description: ['LEAK_NESTED_ARRAY']
    },
    turn: null
  }, 1);
  const hostileRaw = JSON.stringify(hostile);
  assert.strictEqual(hostileRaw.includes('LEAK_NESTED_TWIST_the_duke_is_the_lich'), false,
    'A nested object under a permitted quest field must not reach a seat');
  assert.strictEqual(hostileRaw.includes('LEAK_NESTED_ARRAY'), false,
    'A nested array under a permitted quest field must not reach a seat');
  assert.strictEqual(hostileRaw.includes('current_act'), false, 'Nor the act index it carried');
  assert.strictEqual(typeof hostile.currentQuest.active_quest, 'string',
    'Seat-facing quest fields are coerced to scalar strings');
  assert.strictEqual(typeof hostile.currentQuest.quest_description, 'string');

  const hostileAbility = scopeStateForSeat({
    party: [{
      id: 1,
      name: 'A',
      abilityTriggerRevision: { nested: 'LEAK_TRIGGER_REVISION' },
      invocableAbilities: [{
        abilityId: 'a', definitionId: 'b', definitionVersion: 1,
        name: 'n', trigger: 't', aliases: [], familyKey: 'f', familyLabel: 'F',
        help: { nested: 'LEAK_TRIGGER_HELP' }
      }]
    }],
    currentQuest: { active_quest: 'q', quest_description: 'd' },
    turn: null
  }, 1);
  assert.strictEqual(JSON.stringify(hostileAbility).includes('LEAK_TRIGGER'), false,
    'Malformed nested trigger metadata never crosses the seat whitelist');
  assert.strictEqual(hostileAbility.character.abilityTriggerRevision, '');
  assert.deepStrictEqual(hostileAbility.character.invocableAbilities, []);

  // sv-4 ROUND 3 (reviewer): fixing currentQuest alone patched the instance,
  // not the CLASS. inputKind and sceneGrounding forwarded arbitrary values
  // too, and both are promoted from an imported turn record. Sweep EVERY
  // seat-facing turn field with a poisoned object, so a future field added
  // without a coercion fails here instead of leaking silently.
  const poisonedFields = ['playerAction', 'inputKind', 'narrative', 'sceneGrounding', 'svg',
    'suggestedChoices', 'rollResults', 'number'];
  for (const field of poisonedFields) {
    const marker = `LEAK_VIA_${field.toUpperCase()}_private_twist`;
    const poisoned = scopeStateForSeat({
      party: [{ id: 1, name: 'A' }],
      currentQuest: { active_quest: 'q', quest_description: 'd' },
      turn: { number: 1, narrative: 'n', [field]: { nested: marker } }
    }, 1);
    assert.strictEqual(JSON.stringify(poisoned).includes(marker), false,
      `A nested object under turn.${field} must not reach a seat`);
  }

  // Arrays of junk are filtered, not forwarded.
  const junk = scopeStateForSeat({
    party: [{ id: 1, name: 'A' }],
    currentQuest: { active_quest: 'q', quest_description: 'd' },
    turn: {
      number: 1, narrative: 'n',
      suggestedChoices: ['ok', { leak: 'LEAK_IN_CHOICES' }, 42],
      rollResults: [{ attribute: 'stealth' }, ['LEAK_IN_ROLLS'], 'junk']
    }
  }, 1);
  const junkRaw = JSON.stringify(junk);
  assert.strictEqual(junkRaw.includes('LEAK_IN_CHOICES'), false, 'Non-string choices are dropped');
  assert.strictEqual(junkRaw.includes('LEAK_IN_ROLLS'), false, 'Non-object roll records are dropped');
  assert.deepStrictEqual(junk.turn.suggestedChoices, ['ok'], 'Valid choices survive');
  assert.strictEqual(junk.turn.rollResults.length, 1, 'Valid roll records survive');

  // Legitimate values pass through untouched, and absent optional fields stay
  // null rather than '' — the frontend tests them for truthiness.
  const good = scopeStateForSeat({
    party: [{ id: 1, name: 'A' }],
    currentQuest: { active_quest: 'q', quest_description: 'd' },
    turn: { number: 7, playerAction: 'I look', inputKind: 'clarification',
            narrative: 'The lobby hums.', sceneGrounding: 'Two guards.', svg: '<svg/>',
            suggestedChoices: ['Ask'], rollResults: [{ attribute: 'wits' }] }
  }, 1);
  assert.strictEqual(good.turn.number, 7);
  assert.strictEqual(good.turn.inputKind, 'clarification');
  assert.strictEqual(good.turn.sceneGrounding, 'Two guards.');
  assert.strictEqual(good.turn.narrative, 'The lobby hums.');
  const sparse = scopeStateForSeat({
    party: [{ id: 1, name: 'A' }], currentQuest: { active_quest: 'q', quest_description: 'd' },
    turn: { number: 1, narrative: 'n' }
  }, 1);
  assert.strictEqual(sparse.turn.sceneGrounding, null, 'Absent grounding stays null');
  assert.strictEqual(sparse.turn.playerAction, null, 'Absent player action stays null');

  // Voice lines: speaker/tone/text only — the profile resolves server-side.
  assert.deepStrictEqual(scoped.turn.voiceLines[1], { speaker: 'Kessler', text: '"You again."', tone: 'menacing' });

  // The narrate route recomposes the same directive the host client sends.
  const resolved = resolveSpeakerVoice(hostState.npcs[0].voice_json, 'menacing');
  assert.strictEqual(resolved.voice, 'cedar');
  assert.strictEqual(resolved.instructions, `${LEAK.voiceInstructions} Tone: menacing.`);
  assert.deepStrictEqual(resolveSpeakerVoice(null, 'gentle'), { voice: null, instructions: null },
    'Unknown free-text delivery falls closed to neutral');
  assert.deepStrictEqual(resolveSpeakerVoice('not json', ''), { voice: null, instructions: null }, 'Corrupt profile degrades to narrator');

  // Journal: sanitized shape, no state_changes_json.
  const journal = scopeJournalForSeat([
    {
      turn_number: 1,
      player_action: 'start',
      narrative: 'It begins.',
      state_changes_json: `{"memory_update":"${LEAK.stateChanges}"}`,
      ability_invocations_json: `{"abilities":[{"ability_id":"${LEAK.partymateAbility}"}]}`,
      created_at: 't0'
    }
  ]);
  assert.strictEqual(JSON.stringify(journal).includes(LEAK.stateChanges), false, 'Journal drops state_changes_json');
  assert.strictEqual(JSON.stringify(journal).includes(LEAK.partymateAbility), false,
    'Seat journals do not expose historical invocation metadata');
  assert.deepStrictEqual(journal[0], { turn_number: 1, player_action: 'start', narrative: 'It begins.', created_at: 't0' });

  // Silhouette tolerates junk without throwing.
  assert.strictEqual(silhouetteCharacter(null), null);

  // A state with no turn yet (defensive) scopes without throwing.
  assert.strictEqual(scopeStateForSeat({ party: [] }, 1).turn, null);
}

// -------------------------------------------------------------
// Test: strict ability-wording proposal seam (Phase PT S1.3)
// -------------------------------------------------------------
async function testStageOneAbilityWordingProposal() {
  console.log(' - Running Stage 1 ability-wording proposal tests...');
  const db = await import('./db.js');
  const {
    extractPersistableStageOneAbilityBindings,
    proposeStageOneAbilityWording,
    STAGE_ONE_ABILITY_REQUEST_LIMIT,
    validateStageOneAbilityWordingProposal
  } = await import('./rpg-engine.js');

  await db.initDb();

  const privateOutlineMarker = 'hidden violet monastery beneath the salt harbor where silent bells wake only for the exiled moon';
  const privateHistoryMarker = 'private history says the glass ferryman opens a drowned passage beneath the western tide gate';
  const privateMemoryMarker = 'private memory records the copper choir answering only when the nameless beacon turns inland';
  const privateShortFact = 'The duke is the lich.';
  const privateSourceCampaignMarker = 'private source campaign marker where the old forest keeps a wholly different forbidden road';
  const privateCharacterName = 'PRIVATE_CHARACTER_NAME_ELMINSTER';
  const privateArchetype = 'PRIVATE_ARCHETYPE_CONTROLLER';
  const unrelatedAbilityName = 'PRIVATE_UNRELATED_ABILITY_STARFALL';

  const campaignId = (await db.run(
    `INSERT INTO campaigns (title, genre, summary, current_act)
     VALUES ('Stage One Proposal', 'science fantasy', 'proposal test', 1)`
  )).id;
  await db.run(
    `INSERT INTO campaign_outlines (campaign_id, outline_json) VALUES (?, ?)`,
    [campaignId, JSON.stringify({
      title: 'Stage One Proposal',
      setting: privateOutlineMarker,
      acts: [{ act: 1, title: 'Arrival', objective: 'Find the gate', key_events: ['Open it'] }],
      major_locations: [{ name: 'Salt Harbor', description: 'A storm-dark quay.' }],
      starting_quest: { title: 'The Gate', description: 'Find the hidden gate.' },
      theme_colors: {}
    })]
  );
  await db.run(
    `INSERT INTO turns (campaign_id, turn_number, player_action, narrative, state_changes_json)
     VALUES (?, 1, 'I claim the moon is a machine.', ?, '{}')`,
    [campaignId, privateHistoryMarker]
  );
  await db.run(
    `INSERT INTO memories (campaign_id, turn_number, importance, summary, keywords)
     VALUES (?, 1, 5, ?, 'choir,beacon')`,
    [campaignId, privateMemoryMarker]
  );
  await db.run(
    `INSERT INTO memories (campaign_id, turn_number, importance, summary, keywords)
     VALUES (?, 1, 4, ?, 'duke,secret')`,
    [campaignId, privateShortFact]
  );

  const sourceCampaignId = (await db.run(
    `INSERT INTO campaigns (title, genre, summary, current_act)
     VALUES ('Stage One Source', 'forest fantasy', 'source isolation test', 1)`
  )).id;
  await db.run(
    `INSERT INTO campaign_outlines (campaign_id, outline_json) VALUES (?, ?)`,
    [sourceCampaignId, JSON.stringify({
      title: 'Stage One Source',
      setting: privateSourceCampaignMarker,
      starting_quest: { title: 'Remain', description: 'Stay in the old forest.' }
    })]
  );

  const abilityA = {
    id: 'ability-alpha-stage-one',
    name: 'Arcane Hand',
    description: 'Move a distant object through focused will.',
    tier: 'PRIVATE_TIER_EXPERT',
    source: 'PRIVATE_SOURCE_ANCIENT_TUTOR'
  };
  const abilityB = {
    id: 'ability-beta-stage-one',
    name: 'Veil Step',
    description: 'Pass unseen through a watched threshold.',
    tier: 'trained',
    source: 'play'
  };
  const unrelatedAbility = {
    id: 'ability-unrelated-stage-one',
    name: unrelatedAbilityName,
    description: 'PRIVATE_UNRELATED_DESCRIPTION',
    tier: 'master',
    source: 'PRIVATE_UNRELATED_SOURCE'
  };
  const unrelatedLegacyAbility = {
    name: 'PRIVATE_UNREQUESTED_LEGACY_WITHOUT_ID',
    description: 'This unrelated legacy row must not block a requested stable id.'
  };
  const characterId = (await db.run(
    `INSERT INTO player_characters (
       name, archetype, status, active_campaign_id, origin_campaign_id,
       health, max_health, mana, max_mana, xp, level,
       inventory_json, attributes_json, abilities_json, progression_notes
     ) VALUES (?, ?, 'checked_out', ?, ?, 10, 10, 5, 5, 0, 1, ?, ?, ?, ?)`,
    [
      privateCharacterName,
      privateArchetype,
      sourceCampaignId,
      sourceCampaignId,
      JSON.stringify([{ name: 'PRIVATE_INVENTORY_RELIC' }]),
      JSON.stringify({ strength: 'PRIVATE_ATTRIBUTE_VALUE' }),
      JSON.stringify([abilityA, abilityB, unrelatedAbility, unrelatedLegacyAbility]),
      'PRIVATE_PROGRESSION_NOTES'
    ]
  )).id;

  const localOnlyCharacterId = 900000000;
  await db.run(
    `INSERT INTO characters (
       id, campaign_id, name, class, health, max_health, mana, max_mana,
       xp, level, inventory_json, attributes_json, abilities_json, progression_notes
     ) VALUES (?, ?, 'LOCAL_ONLY_CHARACTER', 'LOCAL_ONLY_CLASS', 10, 10, 5, 5,
       0, 1, '[]', '{}', ?, '')`,
    [
      localOnlyCharacterId,
      campaignId,
      JSON.stringify([{ id: 'local-only-ability', name: 'Local Only', description: 'Not a profile.' }])
    ]
  );

  const readyRow = (abilityId, term, prose, fitExplanation) => ({
    ability_id: abilityId,
    status: 'ready',
    term,
    prose,
    fit_explanation: fitExplanation
  });
  const choiceRow = (abilityId, fitExplanation) => ({
    ability_id: abilityId,
    status: 'needs_choice',
    fit_explanation: fitExplanation
  });
  const responseObject = abilities => ({
    schema_version: 1,
    campaign_id: campaignId,
    character_id: characterId,
    abilities
  });
  const validRows = () => [
    readyRow(
      abilityA.id,
      'Neural Weave',
      'Focused intent moves a nearby object through a quiet signal.',
      'The established fiction supports will expressed through local interfaces.'
    ),
    readyRow(
      abilityB.id,
      'Shadow Passage',
      'A brief fold in attention carries the traveler past a watched threshold.',
      'Subtle passage fits the campaign without changing what the ability does.'
    )
  ];

  const makeClient = responses => ({
    calls: [],
    async sendPrompt(args) {
      this.calls.push(args);
      const response = responses.shift();
      if (response instanceof Error) throw response;
      return response;
    }
  });
  const snapshotStore = async () => ({
    campaigns: await db.all(`SELECT * FROM campaigns ORDER BY id`),
    outlines: await db.all(`SELECT * FROM campaign_outlines ORDER BY campaign_id`),
    profiles: await db.all(`SELECT * FROM player_characters ORDER BY id`),
    characters: await db.all(`SELECT * FROM characters ORDER BY id`),
    turns: await db.all(`SELECT * FROM turns ORDER BY id`),
    memories: await db.all(`SELECT * FROM memories ORDER BY id`)
  });

  const storeBefore = await snapshotStore();
  const request = Object.freeze({
    campaignId,
    characterId,
    requestedAbilityIds: Object.freeze([abilityA.id, abilityB.id]),
    apiConfig: Object.freeze({})
  });
  const requestBefore = structuredClone(request);
  const validClient = makeClient([
    JSON.stringify(responseObject([...validRows()].reverse()))
  ]);
  const proposal = await proposeStageOneAbilityWording(request, { client: validClient });
  assert.strictEqual(validClient.calls.length, 1, 'Valid first response uses one logical model call');
  assert.deepStrictEqual(request, requestBefore, 'Proposal does not mutate its request');
  assert.deepStrictEqual(
    proposal.abilities.map(ability => ability.abilityId),
    [abilityA.id, abilityB.id],
    'Reverse-order model rows normalize to requested order'
  );
  assert.deepStrictEqual(
    proposal.abilities.map(ability => ability.slot),
    [`ability:${abilityA.id}`, `ability:${abilityB.id}`],
    'Engine derives every ability slot'
  );
  assert.match(proposal.canonBasisDigest, /^[a-f0-9]{64}$/, 'Internal proposal carries freshness digest');
  assert.strictEqual('canonBasis' in proposal, false, 'Raw canon basis is never returned');
  const proposalText = JSON.stringify(proposal);
  for (const marker of [privateOutlineMarker, privateHistoryMarker, privateMemoryMarker, privateShortFact]) {
    assert.strictEqual(proposalText.includes(marker), false, 'Validated result never returns raw private canon');
  }

  const firstPrompt = validClient.calls[0].prompt;
  assert.strictEqual(firstPrompt.includes(privateOutlineMarker), true, 'GM receives private outline canon');
  assert.strictEqual(firstPrompt.includes(privateHistoryMarker), true, 'GM receives private history canon');
  assert.strictEqual(firstPrompt.includes(privateMemoryMarker), true, 'GM receives private memory canon');
  assert.strictEqual(firstPrompt.includes(privateShortFact), true, 'GM receives short private canon for fit review');
  assert.strictEqual(firstPrompt.includes(privateSourceCampaignMarker), false, 'Prompt reads destination canon, never the character active source campaign');
  assert.strictEqual(firstPrompt.includes(abilityA.name), true, 'Requested canonical ability enters prompt');
  assert.strictEqual(firstPrompt.includes(abilityB.name), true, 'Every requested canonical ability enters prompt');
  for (const marker of [
    privateCharacterName,
    privateArchetype,
    unrelatedAbilityName,
    'PRIVATE_UNRELATED_DESCRIPTION',
    'PRIVATE_UNRELATED_SOURCE',
    'PRIVATE_UNREQUESTED_LEGACY_WITHOUT_ID',
    'PRIVATE_TIER_EXPERT',
    'PRIVATE_SOURCE_ANCIENT_TUTOR',
    'PRIVATE_INVENTORY_RELIC',
    'PRIVATE_ATTRIBUTE_VALUE',
    'PRIVATE_PROGRESSION_NOTES'
  ]) {
    assert.strictEqual(firstPrompt.includes(marker), false, `Prompt excludes unrelated character data: ${marker}`);
  }
  assert.strictEqual(validClient.calls[0].jsonMode, true, 'Proposal requests JSON mode');
  assert.strictEqual(
    validClient.calls[0].systemInstruction.includes('needs_choice'),
    true,
    'System contract explains unresolved fictional fit'
  );
  assert.deepStrictEqual(await snapshotStore(), storeBefore, 'Proposal performs no database writes');

  const invalidRawMarker = 'PRIVATE_INVALID_MODEL_RESPONSE_MUST_NOT_RETURN';
  const invalidWithCost = responseObject(validRows());
  invalidWithCost.abilities[0].cost = invalidRawMarker;
  const retryClient = makeClient([
    JSON.stringify(invalidWithCost),
    JSON.stringify(responseObject(validRows()))
  ]);
  const retried = await proposeStageOneAbilityWording(request, { client: retryClient });
  assert.strictEqual(retryClient.calls.length, 2, 'One contract failure gets exactly one retry');
  assert.strictEqual(retried.abilities.length, 2, 'Valid retry returns normalized proposal');
  assert.strictEqual(
    retryClient.calls[1].prompt.includes(invalidRawMarker),
    false,
    'Correction never includes raw model output'
  );
  assert.strictEqual(
    retryClient.calls[1].prompt.includes('previous response did not satisfy the contract'),
    true,
    'Retry uses a generic correction'
  );
  assert.strictEqual(
    retryClient.calls[0].prompt.includes(privateOutlineMarker)
      && retryClient.calls[1].prompt.includes(privateOutlineMarker),
    true,
    'Both attempts reuse the same canon basis'
  );

  const exhaustedRawMarker = 'PRIVATE_EXHAUSTED_RAW_RESPONSE';
  const invalidWithSlot = responseObject(validRows());
  invalidWithSlot.abilities[1].slot = `ability:${abilityB.id}`;
  const exhaustedClient = makeClient([
    `not json ${exhaustedRawMarker}`,
    JSON.stringify(invalidWithSlot)
  ]);
  await assert.rejects(
    () => proposeStageOneAbilityWording(request, { client: exhaustedClient }),
    error => {
      assert.strictEqual(error.code, 'STAGE_ONE_PROPOSAL_FAILED');
      assert.strictEqual(error.message, 'The GM could not produce a valid ability wording proposal.');
      assert.strictEqual(error.message.includes(exhaustedRawMarker), false);
      assert.strictEqual(error.message.includes(privateOutlineMarker), false);
      assert.strictEqual('rawText' in error, false, 'Public failure carries no raw model response');
      return true;
    }
  );
  assert.strictEqual(exhaustedClient.calls.length, 2, 'Two invalid responses never trigger a third call');

  const transportError = new Error('transport unavailable');
  const transportClient = makeClient([transportError]);
  await assert.rejects(
    () => proposeStageOneAbilityWording(request, { client: transportClient }),
    error => error === transportError,
    'Transport errors escape instead of consuming the contract retry'
  );
  assert.strictEqual(transportClient.calls.length, 1, 'Transport failure is one logical call');

  const zeroCallClient = makeClient([]);
  for (const invalidRequest of [
    { campaignId, characterId, requestedAbilityIds: ['unknown-ability'] },
    { campaignId, characterId, requestedAbilityIds: [abilityA.id, abilityA.id] },
    { campaignId, characterId: localOnlyCharacterId, requestedAbilityIds: ['local-only-ability'] },
    {
      campaignId,
      characterId,
      requestedAbilityIds: Array.from(
        { length: STAGE_ONE_ABILITY_REQUEST_LIMIT + 1 },
        (_, index) => `ability-over-limit-${index}`
      )
    }
  ]) {
    await assert.rejects(
      () => proposeStageOneAbilityWording(invalidRequest, { client: zeroCallClient }),
      error => error.code === 'STAGE_ONE_PROPOSAL_INPUT_INVALID',
      'Invalid preflight fails safely'
    );
  }
  assert.strictEqual(zeroCallClient.calls.length, 0, 'Invalid preflight performs zero model calls');

  const expected = Object.freeze({
    campaignId,
    characterId,
    requestedAbilityIds: Object.freeze([abilityA.id, abilityB.id]),
    canonBasis: Object.freeze({
      outline: Object.freeze({ setting: privateOutlineMarker }),
      history: Object.freeze([{ gm_narrative: privateHistoryMarker }]),
      memories: Object.freeze([
        { summary: privateMemoryMarker },
        { summary: privateShortFact }
      ])
    })
  });
  const expectedBefore = structuredClone(expected);
  const validChoiceObject = responseObject([
    validRows()[0],
    choiceRow(abilityB.id, 'No honest destination wording is ready from the established fiction.')
  ]);
  const normalizedChoice = validateStageOneAbilityWordingProposal(
    JSON.stringify(validChoiceObject),
    expected
  );
  assert.deepStrictEqual(
    normalizedChoice.abilities[1],
    {
      slot: `ability:${abilityB.id}`,
      abilityId: abilityB.id,
      status: 'needs_choice',
      fitExplanation: 'No honest destination wording is ready from the established fiction.'
    },
    'needs_choice has explanation but no invented term or prose'
  );
  assert.deepStrictEqual(expected, expectedBefore, 'Pure validator does not mutate expected contract');
  const fencedChoice = validateStageOneAbilityWordingProposal(
    `\`\`\`json\n${JSON.stringify(validChoiceObject)}\n\`\`\``,
    expected
  );
  assert.deepStrictEqual(fencedChoice, normalizedChoice, 'Provider-added JSON fences do not weaken the inner contract');
  const flavorOnlyObject = responseObject(validRows());
  flavorOnlyObject.abilities[0].prose = 'You drink the whiskey and feel tipsy, then notice yourself getting tired.';
  assert.doesNotThrow(
    () => validateStageOneAbilityWordingProposal(JSON.stringify(flavorOnlyObject), expected),
    'Fictional sensation remains valid flavor when it asserts no mechanical consequence'
  );
  const shapedPresentationObject = responseObject(validRows());
  shapedPresentationObject.abilities[0].term = 'جادوگر می‌روم ⚡️';
  shapedPresentationObject.abilities[0].prose =
    'A family 👨‍👩‍👧 follows the quiet signal.';
  const shapedValidatedProposal = {
    ...validateStageOneAbilityWordingProposal(
      JSON.stringify(shapedPresentationObject),
      expected
    ),
    canonBasisDigest: 'a'.repeat(64)
  };
  assert.doesNotThrow(
    () => extractPersistableStageOneAbilityBindings(shapedValidatedProposal, {
      campaignId,
      characterId,
      expectedMissingAbilityIds: [abilityA.id, abilityB.id]
    }),
    'Every player-reviewable shaped presentation is persistable unchanged'
  );

  const mutateResponse = mutator => {
    const value = responseObject(validRows());
    mutator(value);
    return JSON.stringify(value);
  };
  const invalidContracts = [
    ['malformed JSON', '{"schema_version": 1,'],
    ['missing requested id', mutateResponse(value => { value.abilities.pop(); })],
    ['duplicate requested id', mutateResponse(value => { value.abilities[1].ability_id = abilityA.id; })],
    ['unknown id', mutateResponse(value => { value.abilities[1].ability_id = 'unknown-ability'; })],
    ['case-altered id', mutateResponse(value => { value.abilities[0].ability_id = abilityA.id.toUpperCase(); })],
    ['whitespace-altered id', mutateResponse(value => { value.abilities[0].ability_id = ` ${abilityA.id}`; })],
    ['wrong campaign id', mutateResponse(value => { value.campaign_id = campaignId + 1; })],
    ['wrong character id', mutateResponse(value => { value.character_id = characterId + 1; })],
    ['wrong schema version', mutateResponse(value => { value.schema_version = 2; })],
    ['extra top-level field', mutateResponse(value => { value.archetype = 'Controller'; })],
    ['model-supplied slot', mutateResponse(value => { value.abilities[0].slot = `ability:${abilityA.id}`; })],
    ['model-supplied cost', mutateResponse(value => { value.abilities[0].cost = 'free'; })],
    ['model-supplied archetype', mutateResponse(value => { value.abilities[0].archetype = 'Controller'; })],
    ['model-supplied canon basis', mutateResponse(value => { value.abilities[0].canonBasis = {}; })],
    ['numeric wording', mutateResponse(value => { value.abilities[0].term = 'Signal Seven 7'; })],
    ['nonnumeric mechanic', mutateResponse(value => { value.abilities[0].prose = 'Spend mana to move the object.'; })],
    ['nonnumeric cost', mutateResponse(value => { value.abilities[0].prose = 'This expression has no cost.'; })],
    ['spelled quantity mechanic', mutateResponse(value => { value.abilities[0].prose = 'It reaches seven meters and affects three foes.'; })],
    ['resource operation mechanic', mutateResponse(value => { value.abilities[0].prose = 'Expend stamina to restore health and double movement speed.'; })],
    ['resource-healing claim', mutateResponse(value => { value.abilities[0].prose = 'Burn stamina to heal yourself and sprint farther.'; })],
    ['synonym resource claim', mutateResponse(value => { value.abilities[0].prose = 'Sacrifice vitality to mend wounds and move farther.'; })],
    ['strength change claim', mutateResponse(value => { value.abilities[0].prose = 'Increase strength.'; })],
    ['agility change claim', mutateResponse(value => { value.abilities[0].prose = 'Raise agility.'; })],
    ['intellect change claim', mutateResponse(value => { value.abilities[0].prose = 'Lower intellect.'; })],
    ['cadence mechanic', mutateResponse(value => { value.abilities[0].fit_explanation = 'Available once per scene.'; })],
    ['ready missing term', mutateResponse(value => { delete value.abilities[0].term; })],
    ['needs_choice with wording', mutateResponse(value => { value.abilities[0].status = 'needs_choice'; })],
    ['unknown status', mutateResponse(value => { value.abilities[0].status = 'invalid'; })],
    ['blank text', mutateResponse(value => { value.abilities[0].term = '   '; })],
    ['non-string text', mutateResponse(value => { value.abilities[0].prose = { text: 'No' }; })],
    ['overlong text', mutateResponse(value => { value.abilities[0].term = 'x'.repeat(81); })],
    ['control character', mutateResponse(value => { value.abilities[0].prose = 'Quiet\nSignal'; })],
    ['unpaired surrogate', mutateResponse(value => { value.abilities[0].prose = 'Quiet\uD800Signal'; })],
    ['line separator', mutateResponse(value => { value.abilities[0].prose = 'Quiet\u2028Signal'; })],
    ['paragraph separator', mutateResponse(value => { value.abilities[0].prose = 'Quiet\u2029Signal'; })],
    ['zero-width space', mutateResponse(value => { value.abilities[0].prose = 'Quiet\u200BSignal'; })],
    ['word joiner', mutateResponse(value => { value.abilities[0].prose = 'Quiet\u2060Signal'; })],
    ['bidi isolate', mutateResponse(value => { value.abilities[0].prose = 'Quiet\u2066Signal'; })],
    ['byte-order mark', mutateResponse(value => { value.abilities[0].prose = 'Quiet\uFEFFSignal'; })],
    ['interlinear annotation', mutateResponse(value => { value.abilities[0].prose = 'Quiet\uFFF9Signal'; })],
    ['deprecated vowel separator', mutateResponse(value => { value.abilities[0].prose = 'Quiet\u180ESignal'; })],
    ['long private canon echo', mutateResponse(value => { value.abilities[0].fit_explanation = privateOutlineMarker; })],
    ['short private canon echo', mutateResponse(value => { value.abilities[0].fit_explanation = privateShortFact; })]
  ];
  for (const [label, raw] of invalidContracts) {
    assert.throws(
      () => validateStageOneAbilityWordingProposal(raw, expected),
      error => error.code === 'STAGE_ONE_PROPOSAL_INVALID'
        && !error.message.includes(privateOutlineMarker),
      `${label} fails closed with a safe error`
    );
  }

  const engineSource = fs.readFileSync(new URL('./rpg-engine.js', import.meta.url), 'utf8');
  const proposalStart = engineSource.indexOf('export async function proposeStageOneAbilityWording');
  const proposalEnd = engineSource.indexOf('function stageOneBindingStoreError', proposalStart);
  const proposalSource = engineSource.slice(proposalStart, proposalEnd);
  assert.strictEqual(proposalSource.includes('getPlayerCharacter(characterId)'), true, 'Persistent profile is authoritative');
  assert.strictEqual(proposalSource.includes('ensureAbilityIds'), false, 'Preflight never invents missing stable ids');
  assert.strictEqual(proposalSource.includes('readStageOneCanonContext(campaignId)'), true, 'Proposal uses shared canon helper');
  assert.strictEqual(proposalSource.includes("resolveAgentConfig(apiConfig, 'continuity')"), true, 'Default proposer uses the continuity role');
  assert.strictEqual((proposalSource.match(/readStageOneCanonContext\(campaignId\)/g) || []).length, 1, 'Canon basis is read once for both attempts');
  assert.strictEqual(/fetch\s*\(|\/api\/mcp|https?:\/\//.test(proposalSource), false, 'Proposal never loops through MCP or HTTP');
  assert.strictEqual(/applyCharacterUpdate|applyAbilityUpdates|db\.run|\b(?:INSERT|UPDATE|DELETE)\b/.test(proposalSource), false, 'Presentation proposal cannot apply a mechanical or database change');
  assert.deepStrictEqual(await snapshotStore(), storeBefore, 'All proposal paths remain read-only');
}

// -------------------------------------------------------------
// Test: immutable Stage 1 ability-presentation persistence (PT S1.4)
// -------------------------------------------------------------
async function testStageOneAbilityBindingPersistence() {
  console.log(' - Running Stage 1 ability-binding persistence tests...');
  const db = await import('./db.js');
  const {
    extractPersistableStageOneAbilityBindings,
    exportCampaign,
    getCampaignState,
    importCampaign,
    readStageOneAbilityBindings,
    readStageOneAbilityBindingStatus,
    readStageOneCampaignVocabulary,
    storeApprovedStageOneAbilityBindings
  } = await import('./rpg-engine.js');
  const {
    CAMPAIGN_BUNDLE_VERSION,
    containsStageOnePrivateCanonEcho,
    normalizeCharacterAbilityBindings,
    scopeStateForSeat,
    validateCampaignBundle
  } = await import('./rpg-state.js');
  await db.initDb();

  const privateCanon = 'PRIVATE_BINDING_CANON_the_glass_duke_keeps_the_hidden_gate';
  const privateFit = 'PRIVATE_BINDING_FIT_the_GM_knows_why_the_signal_belongs_here';
  const privateTitle = 'PRIVATE_BINDING_TITLE_WIZARD';
  const privateArchetype = 'PRIVATE_BINDING_ARCHETYPE_CONTROLLER';
  const privateInventory = 'PRIVATE_BINDING_INVENTORY_STAR_RELIC';
  const privateMechanics = 'PRIVATE_BINDING_MECHANICS_COST_AND_EFFECT';
  const privateDigest = 'd'.repeat(64);

  const makeCampaign = async title => {
    const id = (await db.run(
      `INSERT INTO campaigns (title, genre, summary, current_act)
       VALUES (?, 'science fantasy', ?, 1)`,
      [title, privateCanon]
    )).id;
    await db.run(
      `INSERT INTO campaign_outlines (campaign_id, outline_json) VALUES (?, ?)`,
      [id, JSON.stringify({
        title,
        setting: privateCanon,
        acts: [],
        major_locations: [],
        starting_quest: { title: 'Arrival', description: 'Find the quiet gate.' },
        theme_colors: {}
      })]
    );
    return id;
  };
  const campaignId = await makeCampaign('Stage One Binding');
  const otherCampaignId = await makeCampaign('Stage One Binding Elsewhere');

  const abilitiesOne = [
    { id: 'binding-ability-alpha', name: 'Arcane Hand', description: privateMechanics, cost: privateMechanics },
    { id: 'binding-ability-beta', name: 'Veil Step', description: 'Pass unseen through a watched threshold.' },
    { id: 'binding-ability-gamma', name: 'Glass Compass', description: 'Find a path through uncertain terrain.' }
  ];
  const abilitiesTwo = [
    { id: 'binding-ability-delta', name: 'Still Chorus', description: 'Gather attention around a quiet signal.' },
    { id: 'binding-ability-epsilon', name: 'Copper Thread', description: 'Trace a hidden connection.' }
  ];
  const abilitiesThree = [
    { id: 'binding-ability-zeta', name: 'Quiet Relay', description: 'Carry a signal.' },
    { id: 'binding-ability-eta', name: 'Hidden Route', description: 'Cross unseen.' }
  ];
  const makeProfile = async (name, abilities) => (await db.run(
    `INSERT INTO player_characters (
       name, archetype, status, health, max_health, mana, max_mana, xp, level,
       inventory_json, attributes_json, abilities_json, progression_notes
     ) VALUES (?, ?, 'available', 10, 10, 5, 5, 0, 1, ?, ?, ?, ?)`,
    [
      name,
      privateArchetype,
      JSON.stringify([{ name: privateInventory }]),
      JSON.stringify({ hidden: privateMechanics }),
      JSON.stringify(abilities),
      privateMechanics
    ]
  )).id;
  const characterOneId = await makeProfile(privateTitle, abilitiesOne);
  const characterTwoId = await makeProfile('Second Traveler', abilitiesTwo);
  const characterThreeId = await makeProfile('Concurrent Traveler', abilitiesThree);

  // Campaign creation does not create vocabulary state. Version zero is the
  // absence of a state row, not an eager campaign-initialization write.
  assert.deepStrictEqual(await readStageOneCampaignVocabulary(campaignId), {
    campaignId,
    vocabularyVersion: 0,
    entries: []
  });
  assert.strictEqual(
    await db.get(`SELECT * FROM campaign_vocabulary_state WHERE campaign_id = ?`, [campaignId]),
    undefined
  );
  for (const table of ['campaign_vocabulary_entries', 'character_ability_bindings']) {
    assert.strictEqual(
      (await db.get(`SELECT COUNT(*) AS count FROM ${table} WHERE campaign_id = ?`, [campaignId])).count,
      0,
      `${table} starts empty`
    );
  }
  const columns = async table => (await db.all(`PRAGMA table_info(${table})`)).map(row => row.name);
  assert.deepStrictEqual(await columns('campaign_vocabulary_entries'), [
    'campaign_id', 'semantic_key', 'term', 'provenance', 'vocabulary_version', 'created_at'
  ]);
  assert.deepStrictEqual(await columns('character_ability_bindings'), [
    'player_character_id', 'campaign_id', 'ability_id', 'term', 'prose', 'provenance',
    'vocabulary_version', 'binding_set_revision', 'created_at'
  ]);

  const ready = (abilityId, term, prose) => ({
    slot: `ability:${abilityId}`,
    abilityId,
    status: 'ready',
    term,
    prose,
    fitExplanation: privateFit
  });
  const proposal = {
    schemaVersion: 1,
    campaignId,
    characterId: characterOneId,
    abilities: [
      ready(abilitiesOne[1].id, 'Shadow Passage', 'A folded hush carries the traveler past a watched threshold.'),
      ready(abilitiesOne[0].id, 'Neural Weave', 'Focused intent moves a nearby object through a quiet signal.')
    ],
    canonBasisDigest: privateDigest
  };
  const proposalBefore = structuredClone(proposal);
  const extracted = extractPersistableStageOneAbilityBindings(proposal, {
    campaignId,
    characterId: characterOneId,
    expectedMissingAbilityIds: [abilitiesOne[0].id, abilitiesOne[1].id]
  });
  assert.deepStrictEqual(proposal, proposalBefore, 'Extraction is pure');
  assert.deepStrictEqual(extracted, {
    campaignId,
    characterId: characterOneId,
    bindings: [
      {
        abilityId: abilitiesOne[0].id,
        term: 'Neural Weave',
        prose: 'Focused intent moves a nearby object through a quiet signal.',
        provenance: 'generated'
      },
      {
        abilityId: abilitiesOne[1].id,
        term: 'Shadow Passage',
        prose: 'A folded hush carries the traveler past a watched threshold.',
        provenance: 'generated'
      }
    ]
  });
  const extractedText = JSON.stringify(extracted);
  for (const marker of [privateDigest, privateFit, 'slot', 'status']) {
    assert.strictEqual(extractedText.includes(marker), false, `Extraction drops ${marker}`);
  }
  const extractionExpected = {
    campaignId,
    characterId: characterOneId,
    expectedMissingAbilityIds: [abilitiesOne[0].id, abilitiesOne[1].id]
  };
  const rejectsExtraction = (candidate, label) => assert.throws(
    () => extractPersistableStageOneAbilityBindings(candidate, extractionExpected),
    error => error.code === 'STAGE_ONE_BINDING_INPUT_INVALID',
    label
  );
  rejectsExtraction({ ...structuredClone(proposal), canonBasis: privateCanon }, 'Extra proposal field');
  const rowExtra = structuredClone(proposal);
  rowExtra.abilities[0].cost = 'free';
  rejectsExtraction(rowExtra, 'Extra row mechanics field');
  const needsChoice = structuredClone(proposal);
  needsChoice.abilities[0] = {
    slot: `ability:${abilitiesOne[1].id}`,
    abilityId: abilitiesOne[1].id,
    status: 'needs_choice',
    fitExplanation: privateFit
  };
  rejectsExtraction(needsChoice, 'needs_choice cannot persist');
  const numericMechanic = structuredClone(proposal);
  numericMechanic.abilities[0].term = 'Signal 2';
  rejectsExtraction(numericMechanic, 'Numeric mechanic cannot persist');
  const namedMechanic = structuredClone(proposal);
  namedMechanic.abilities[0].prose = 'This ability deals damage.';
  rejectsExtraction(namedMechanic, 'Named mechanic cannot persist');

  const visibleUnicodeBinding = {
    abilityId: 'visible-unicode-binding',
    term: 'Écho می‌روم ⚡️',
    prose: 'Une lueur discrète guide 👨‍👩‍👧 vers la voie 静かな光。',
    provenance: 'generated'
  };
  assert.deepStrictEqual(
    normalizeCharacterAbilityBindings([visibleUnicodeBinding]),
    [visibleUnicodeBinding],
    'Visible NFC, non-Latin shaping, and emoji presentation remain valid'
  );

  const canonEchoFormatCharacters = [
    '\u200B', // zero-width space
    '\u200C', // zero-width non-joiner
    '\u200D', // zero-width joiner
    '\u2060', // word joiner
    '\u00AD', // soft hyphen
    '\u2066', // bidi isolate
    '\uFEFF', // zero-width no-break space
    '\uFE0F', // variation selector
    '\u034F', // combining grapheme joiner
    '\u070F', // Syriac abbreviation mark
    '\uFFF9', // interlinear annotation anchor (Cf, not default-ignorable)
    '\u{E0001}' // tag character
  ];
  for (const formatCharacter of canonEchoFormatCharacters) {
    const disguisedCanon = [...privateCanon]
      .map(character => /\p{L}/u.test(character) ? `${character}${formatCharacter}` : character)
      .join('');
    assert.strictEqual(
      containsStageOnePrivateCanonEcho(disguisedCanon, { outline: privateCanon }),
      true,
      'Unicode formatting cannot split a private-canon echo window'
    );
    await assert.rejects(
      () => storeApprovedStageOneAbilityBindings({
        campaignId,
        characterId: characterOneId,
        expectedVocabularyVersion: 0,
        sharedEntries: [],
        bindings: [{
          abilityId: abilitiesOne[2].id,
          term: 'Glass Bearing',
          prose: disguisedCanon,
          provenance: 'generated'
        }]
      }),
      error => error.code === 'STAGE_ONE_BINDING_INPUT_INVALID',
      'Unicode formatting cannot smuggle canon through runtime persistence'
    );
  }
  for (const unsafeCharacter of ['\u0000', '\u200B', '\u2060', '\u2066', '\uFEFF', '\uFFF9']) {
    assert.throws(
      () => normalizeCharacterAbilityBindings([{
        ...visibleUnicodeBinding,
        term: `Quiet${unsafeCharacter}Signal`
      }]),
      /invalid/,
      'Unsafe invisible or bidi controls cannot persist in presentation text'
    );
  }

  for (const invalidWrite of [
    {
      sharedEntries: [],
      bindings: [{
        abilityId: abilitiesOne[2].id,
        term: 'Signal 2',
        prose: 'A harmless-looking numeric rule claim.',
        provenance: 'generated'
      }]
    },
    {
      sharedEntries: [{
        key: `ability:${abilitiesOne[2].id}`,
        term: 'Arbitrary Slot',
        provenance: 'gm-canon-review'
      }],
      bindings: [{
        abilityId: abilitiesOne[2].id,
        term: 'Glass Bearing',
        prose: 'A pale reflection points toward a viable passage.',
        provenance: 'generated'
      }]
    },
    {
      sharedEntries: [],
      bindings: [{
        abilityId: abilitiesOne[2].id,
        term: 'Glass Bearing',
        prose: 'A pale reflection points toward a viable passage.',
        provenance: 'generated',
        cost: privateMechanics
      }]
    },
    {
      sharedEntries: [],
      bindings: [{
        abilityId: abilitiesOne[2].id,
        term: 'Glass Bearing',
        prose: privateCanon,
        provenance: 'generated'
      }]
    }
  ]) {
    await assert.rejects(
      () => storeApprovedStageOneAbilityBindings({
        campaignId,
        characterId: characterOneId,
        expectedVocabularyVersion: 0,
        ...invalidWrite
      }),
      error => error.code === 'STAGE_ONE_BINDING_INPUT_INVALID'
    );
  }
  assert.deepStrictEqual(
    (await readStageOneAbilityBindingStatus({
      campaignId,
      characterId: characterOneId,
      requestedAbilityIds: [abilitiesOne[2].id]
    })).missingAbilityIds,
    [abilitiesOne[2].id],
    'Invalid direct writes cannot bypass the validated proposal boundary'
  );

  const requested = [abilitiesOne[1].id, abilitiesOne[2].id, abilitiesOne[0].id];
  assert.deepStrictEqual(
    (await readStageOneAbilityBindingStatus({
      campaignId,
      characterId: characterOneId,
      requestedAbilityIds: requested
    })).missingAbilityIds,
    requested,
    'Missing-only result preserves exact request order'
  );

  const sharedWeave = [{
    key: 'source:system-control',
    term: 'The Weave',
    provenance: 'gm-canon-review'
  }];
  const firstWrite = await storeApprovedStageOneAbilityBindings({
    campaignId,
    characterId: characterOneId,
    expectedVocabularyVersion: 0,
    sharedEntries: [],
    bindings: extracted.bindings
  });
  assert.strictEqual(firstWrite.vocabularyVersion, 0);
  const status = await readStageOneAbilityBindingStatus({
    campaignId,
    characterId: characterOneId,
    requestedAbilityIds: requested
  });
  assert.deepStrictEqual(status.bindings.map(row => row.abilityId), [
    abilitiesOne[1].id,
    abilitiesOne[0].id
  ]);
  assert.deepStrictEqual(status.missingAbilityIds, [abilitiesOne[2].id]);
  assert.strictEqual(status.bindings[0].term, 'Shadow Passage');

  // S1.3 emits no engine-owned semantic keys. Current runtime writes must keep
  // sharedEntries empty; these rows simulate an already approved/imported
  // campaign vocabulary so S1.4 can prove immutable reuse and round-trip.
  await db.withWriteTransaction(async () => {
    await db.run(
      `INSERT INTO campaign_vocabulary_state (campaign_id, vocabulary_version) VALUES (?, 1)`,
      [campaignId]
    );
    await db.run(
      `INSERT INTO campaign_vocabulary_entries
         (campaign_id, semantic_key, term, provenance, vocabulary_version)
       VALUES (?, 'source:system-control', 'The Weave', 'gm-canon-review', 1)`,
      [campaignId]
    );
  });

  // Exact stale-version replay is idempotent: no metadata or row changes.
  const beforeReplay = await readStageOneAbilityBindings(characterOneId, campaignId);
  const replay = await storeApprovedStageOneAbilityBindings({
    campaignId,
    characterId: characterOneId,
    expectedVocabularyVersion: 0,
    sharedEntries: [],
    bindings: extracted.bindings
  });
  assert.strictEqual(replay.vocabularyVersion, 1);
  assert.deepStrictEqual(await readStageOneAbilityBindings(characterOneId, campaignId), beforeReplay);
  await assert.rejects(
    () => storeApprovedStageOneAbilityBindings({
      campaignId,
      characterId: characterOneId,
      expectedVocabularyVersion: 1,
      sharedEntries: [{
        key: 'implement:unused-focus',
        term: 'Unused Focus',
        provenance: 'gm-canon-review'
      }],
      bindings: extracted.bindings
    }),
    error => error.code === 'STAGE_ONE_BINDING_INPUT_INVALID',
    'Shared vocabulary cannot be created without a missing binding'
  );
  assert.strictEqual(
    (await db.get(
      `SELECT COUNT(*) AS count FROM campaign_vocabulary_entries WHERE campaign_id = ?`,
      [campaignId]
    )).count,
    1
  );

  const lateJoinerBinding = [{
    abilityId: abilitiesTwo[0].id,
    term: 'Copper Echo',
    prose: 'A quiet relay carries intent through the surrounding lattice.',
    provenance: 'generated'
  }];
  assert.strictEqual((await storeApprovedStageOneAbilityBindings({
    campaignId,
    characterId: characterTwoId,
    expectedVocabularyVersion: 1,
    sharedEntries: [],
    bindings: lateJoinerBinding
  })).vocabularyVersion, 1, 'Late-joiner reuse does not rename or rev vocabulary');
  assert.deepStrictEqual(
    (await readStageOneAbilityBindings(characterOneId, campaignId)).map(row => row.abilityId),
    [abilitiesOne[0].id, abilitiesOne[1].id]
  );
  assert.deepStrictEqual(
    (await readStageOneAbilityBindings(characterTwoId, campaignId)).map(row => row.abilityId),
    [abilitiesTwo[0].id]
  );
  assert.deepStrictEqual(await readStageOneAbilityBindings(characterOneId, otherCampaignId), []);

  const secondNewBinding = [{
    abilityId: abilitiesTwo[1].id,
    term: 'Pale Signal',
    prose: 'A dim pulse reveals the hidden path.',
    provenance: 'generated'
  }];
  await assert.rejects(
    () => storeApprovedStageOneAbilityBindings({
      campaignId,
      characterId: characterTwoId,
      expectedVocabularyVersion: 1,
      sharedEntries: [{ ...sharedWeave[0], term: 'The Lattice' }],
      bindings: secondNewBinding
    }),
    error => error.code === 'STAGE_ONE_BINDING_INPUT_INVALID'
  );
  assert.deepStrictEqual(
    (await readStageOneAbilityBindings(characterTwoId, campaignId)).map(row => row.abilityId),
    [abilitiesTwo[0].id],
    'Shared conflict inserts no late-joiner binding'
  );

  // Conflict in one member makes the whole multi-binding batch a no-op.
  await assert.rejects(
    () => storeApprovedStageOneAbilityBindings({
      campaignId,
      characterId: characterOneId,
      expectedVocabularyVersion: 1,
      sharedEntries: [],
      bindings: [
        { ...extracted.bindings[0], term: 'Changed Neural Weave' },
        {
          abilityId: abilitiesOne[2].id,
          term: 'Glass Bearing',
          prose: 'A pale reflection points toward a viable passage.',
          provenance: 'generated'
        }
      ]
    }),
    error => error.code === 'STAGE_ONE_BINDING_CONFLICT'
  );
  assert.deepStrictEqual((await readStageOneAbilityBindingStatus({
    campaignId,
    characterId: characterOneId,
    requestedAbilityIds: [abilitiesOne[2].id]
  })).missingAbilityIds, [abilitiesOne[2].id]);
  assert.strictEqual((await readStageOneCampaignVocabulary(campaignId)).vocabularyVersion, 1);

  assert.strictEqual((await storeApprovedStageOneAbilityBindings({
    campaignId,
    characterId: characterOneId,
    expectedVocabularyVersion: 1,
    bindings: [{
      abilityId: abilitiesOne[2].id,
      term: 'Glass Bearing',
      prose: 'A pale reflection points toward a viable passage.',
      provenance: 'generated'
    }]
  })).vocabularyVersion, 1, 'Character-local rows alone do not increment shared vocabulary');

  // The DB transaction queue serializes identical and conflicting concurrent calls.
  const concurrentBinding = [{
    abilityId: abilitiesThree[0].id,
    term: 'Quiet Relay',
    prose: 'A muted current carries intent across the local network.',
    provenance: 'generated'
  }];
  const identical = await Promise.all([
    storeApprovedStageOneAbilityBindings({
      campaignId, characterId: characterThreeId, expectedVocabularyVersion: 1,
      sharedEntries: [], bindings: concurrentBinding
    }),
    storeApprovedStageOneAbilityBindings({
      campaignId, characterId: characterThreeId, expectedVocabularyVersion: 1,
      sharedEntries: [], bindings: concurrentBinding
    })
  ]);
  assert.deepStrictEqual(identical.map(result => result.vocabularyVersion), [1, 1]);
  assert.strictEqual((await db.get(
    `SELECT COUNT(*) AS count FROM character_ability_bindings
     WHERE player_character_id = ? AND campaign_id = ? AND ability_id = ?`,
    [characterThreeId, campaignId, abilitiesThree[0].id]
  )).count, 1);

  const conflictResults = await Promise.allSettled([
    storeApprovedStageOneAbilityBindings({
      campaignId, characterId: characterThreeId, expectedVocabularyVersion: 1,
      bindings: [{
        abilityId: abilitiesThree[1].id,
        term: 'Hidden Route',
        prose: 'A folded shadow hides the traveler from watching eyes.',
        provenance: 'generated'
      }]
    }),
    storeApprovedStageOneAbilityBindings({
      campaignId, characterId: characterThreeId, expectedVocabularyVersion: 1,
      bindings: [{
        abilityId: abilitiesThree[1].id,
        term: 'Veiled Transit',
        prose: 'A soft distortion hides the traveler from watching eyes.',
        provenance: 'generated'
      }]
    })
  ]);
  assert.deepStrictEqual(conflictResults.map(result => result.status), ['fulfilled', 'rejected']);
  assert.strictEqual(conflictResults[1].reason.code, 'STAGE_ONE_BINDING_CONFLICT');
  assert.strictEqual(
    (await readStageOneAbilityBindings(characterThreeId, campaignId))
      .find(row => row.abilityId === abilitiesThree[1].id).term,
    'Hidden Route'
  );
  assert.strictEqual((await readStageOneCampaignVocabulary(campaignId)).vocabularyVersion, 1);

  assert.strictEqual((await storeApprovedStageOneAbilityBindings({
    campaignId,
    characterId: characterTwoId,
    expectedVocabularyVersion: 1,
    sharedEntries: [],
    bindings: secondNewBinding
  })).vocabularyVersion, 1, 'Character-local wording never mutates shared vocabulary');
  const vocabulary = await readStageOneCampaignVocabulary(campaignId);
  assert.deepStrictEqual(
    vocabulary.entries.map(row => [row.key, row.term, row.vocabularyVersion]),
    [['source:system-control', 'The Weave', 1]]
  );

  await assert.rejects(
    () => db.run(
      `UPDATE campaign_vocabulary_entries SET term = 'Changed'
       WHERE campaign_id = ? AND semantic_key = 'source:system-control'`,
      [campaignId]
    ),
    /immutable/
  );
  await assert.rejects(
    () => db.run(
      `UPDATE character_ability_bindings SET term = 'Changed'
       WHERE player_character_id = ? AND campaign_id = ? AND ability_id = ?`,
      [characterOneId, campaignId, abilitiesOne[0].id]
    ),
    /immutable/
  );
  assert.strictEqual(
    (await readStageOneCampaignVocabulary(campaignId)).entries
      .find(row => row.key === 'source:system-control').term,
    'The Weave'
  );
  assert.strictEqual(
    (await readStageOneAbilityBindings(characterOneId, campaignId))
      .find(row => row.abilityId === abilitiesOne[0].id).term,
    'Neural Weave'
  );

  const persistedText = JSON.stringify([
    ...await db.all(`SELECT * FROM campaign_vocabulary_state WHERE campaign_id = ?`, [campaignId]),
    ...await db.all(`SELECT * FROM campaign_vocabulary_entries WHERE campaign_id = ?`, [campaignId]),
    ...await db.all(`SELECT * FROM character_ability_bindings WHERE campaign_id = ?`, [campaignId])
  ]);
  for (const marker of [
    privateCanon,
    privateFit,
    privateTitle,
    privateArchetype,
    privateInventory,
    privateMechanics,
    privateDigest
  ]) {
    assert.strictEqual(persistedText.includes(marker), false, `Persistence copied ${marker}`);
  }

  // S1.4 does not put bindings or vocabulary into existing host/seat state.
  const tableCharacterId = (await db.run(
    `INSERT INTO characters (
       campaign_id, player_character_id, name, class, health, max_health,
       mana, max_mana, xp, level, inventory_json, attributes_json,
       abilities_json, progression_notes, status
     ) VALUES (?, ?, ?, ?, 10, 10, 5, 5, 0, 1, ?, '{}', ?, '', 'active')`,
    [
      campaignId,
      characterOneId,
      privateTitle,
      privateArchetype,
      JSON.stringify([{ name: privateInventory }]),
      JSON.stringify(abilitiesOne)
    ]
  )).id;
  await db.run(
    `UPDATE campaigns SET turn_state_json = ? WHERE id = ?`,
    [JSON.stringify({ order: [tableCharacterId], current_index: 0, round: 1 }), campaignId]
  );
  const hostState = await getCampaignState(campaignId);
  const seatState = scopeStateForSeat(hostState, tableCharacterId);
  for (const [label, state] of [['host', hostState], ['seat', seatState]]) {
    const stateText = JSON.stringify(state);
    for (const marker of [
      'Neural Weave', 'Shadow Passage', 'The Weave', 'Signal Flux', privateFit,
      privateDigest, 'bindingSetRevision', 'vocabularyVersion', 'source:system-control'
    ]) {
      assert.strictEqual(stateText.includes(marker), false, `${label} state leaked ${marker}`);
    }
  }

  // Bundle v2 carries approved presentation state across deployments while
  // remapping both the persistent profile and its globally unique ability IDs.
  await db.run(
    `INSERT INTO turns
       (campaign_id, turn_number, character_id, player_action, narrative, state_changes_json)
     VALUES (?, 1, ?, 'I approach the gate.',
       'A folded hush carries the traveler past a watched threshold.', '{}')`,
    [campaignId, tableCharacterId]
  );
  const exported = await exportCampaign(campaignId);
  assert.strictEqual(exported.format_version, CAMPAIGN_BUNDLE_VERSION);
  const validatedExport = validateCampaignBundle(exported);
  assert.strictEqual(validatedExport.portability.vocabulary_version, 1);
  assert.strictEqual(validatedExport.portability.vocabulary_entries.length, 1);
  assert.deepStrictEqual(
    validatedExport.portability.character_ability_bindings
      .map(row => row.term)
      .sort(),
    ['Glass Bearing', 'Neural Weave', 'Shadow Passage'],
    'Only bindings for the active linked campaign character are portable'
  );

  const hostileBundles = [];
  const withDuplicateVocabulary = structuredClone(exported);
  withDuplicateVocabulary.portability.vocabulary_entries.push(
    structuredClone(withDuplicateVocabulary.portability.vocabulary_entries[0])
  );
  hostileBundles.push(withDuplicateVocabulary);
  const withDanglingAbility = structuredClone(exported);
  withDanglingAbility.portability.character_ability_bindings[0].ability_id = 'missing-ability';
  hostileBundles.push(withDanglingAbility);
  const withExtraMechanics = structuredClone(exported);
  withExtraMechanics.portability.character_ability_bindings[0].cost = privateMechanics;
  hostileBundles.push(withExtraMechanics);
  const withMechanicalProse = structuredClone(exported);
  withMechanicalProse.portability.character_ability_bindings[0].prose = 'The target loses 2 hp.';
  hostileBundles.push(withMechanicalProse);
  const withOutlineCanonCopy = structuredClone(exported);
  withOutlineCanonCopy.portability.character_ability_bindings[0].prose = privateCanon;
  hostileBundles.push(withOutlineCanonCopy);
  for (const ignorable of canonEchoFormatCharacters) {
    const withDisguisedOutlineCanonCopy = structuredClone(exported);
    withDisguisedOutlineCanonCopy.portability.character_ability_bindings[0].prose =
      [...privateCanon]
        .map(character => /\p{L}/u.test(character) ? `${character}${ignorable}` : character)
        .join('');
    hostileBundles.push(withDisguisedOutlineCanonCopy);
  }
  const withUnsafeCounter = structuredClone(exported);
  withUnsafeCounter.portability.vocabulary_version = Number.MAX_SAFE_INTEGER;
  hostileBundles.push(withUnsafeCounter);
  for (const hostile of hostileBundles) {
    assert.throws(
      () => validateCampaignBundle(hostile),
      /Bundle portability/,
      'Untrusted bundles cannot smuggle duplicate, dangling, or mechanical binding data'
    );
  }

  const maxRevisionBundle = structuredClone(exported);
  for (const binding of maxRevisionBundle.portability.character_ability_bindings) {
    binding.binding_set_revision = Number.MAX_SAFE_INTEGER - 1;
  }
  const maxRevisionState = await importCampaign(maxRevisionBundle);
  const maxRevisionCharacter = await db.get(
    `SELECT player_character_id, abilities_json FROM characters
     WHERE campaign_id = ? AND COALESCE(status, 'active') = 'active'`,
    [maxRevisionState.campaignId]
  );
  const afterMaxAbility = {
    id: 'binding-after-max-revision',
    name: 'Last Horizon',
    description: 'Reveal a distant path.'
  };
  const maxRevisionAbilities = [
    ...JSON.parse(maxRevisionCharacter.abilities_json),
    afterMaxAbility
  ];
  await db.run(
    `UPDATE player_characters SET abilities_json = ? WHERE id = ?`,
    [JSON.stringify(maxRevisionAbilities), maxRevisionCharacter.player_character_id]
  );
  await db.run(
    `UPDATE characters SET abilities_json = ?
     WHERE campaign_id = ? AND player_character_id = ?`,
    [
      JSON.stringify(maxRevisionAbilities),
      maxRevisionState.campaignId,
      maxRevisionCharacter.player_character_id
    ]
  );
  await assert.rejects(
    () => storeApprovedStageOneAbilityBindings({
      campaignId: maxRevisionState.campaignId,
      characterId: maxRevisionCharacter.player_character_id,
      expectedVocabularyVersion: 1,
      sharedEntries: [],
      bindings: [{
        abilityId: afterMaxAbility.id,
        term: 'Last Horizon',
        prose: 'A pale line reveals a distant path.',
        provenance: 'generated'
      }]
    }),
    error => error.code === 'STAGE_ONE_BINDING_INPUT_INVALID',
    'Revision counters fail safely instead of exceeding JavaScript integer precision'
  );

  const importedState = await importCampaign(exported);
  const importedCampaignId = importedState.campaignId;
  const importedCharacter = await db.get(
    `SELECT player_character_id, abilities_json FROM characters
     WHERE campaign_id = ? AND COALESCE(status, 'active') = 'active'`,
    [importedCampaignId]
  );
  assert.notStrictEqual(importedCharacter.player_character_id, characterOneId);
  const importedVocabulary = await db.all(
    `SELECT semantic_key, term, provenance, vocabulary_version
     FROM campaign_vocabulary_entries WHERE campaign_id = ? ORDER BY semantic_key ASC`,
    [importedCampaignId]
  );
  const sourceVocabulary = await db.all(
    `SELECT semantic_key, term, provenance, vocabulary_version
     FROM campaign_vocabulary_entries WHERE campaign_id = ? ORDER BY semantic_key ASC`,
    [campaignId]
  );
  assert.deepStrictEqual(importedVocabulary, sourceVocabulary);
  const importedBindings = await db.all(
    `SELECT ability_id, term, prose, provenance, vocabulary_version, binding_set_revision
     FROM character_ability_bindings
     WHERE player_character_id = ? AND campaign_id = ? ORDER BY term ASC`,
    [importedCharacter.player_character_id, importedCampaignId]
  );
  const sourcePortableBindings = await db.all(
    `SELECT ability_id, term, prose, provenance, vocabulary_version, binding_set_revision
     FROM character_ability_bindings
     WHERE player_character_id = ? AND campaign_id = ? ORDER BY term ASC`,
    [characterOneId, campaignId]
  );
  assert.deepStrictEqual(
    importedBindings.map(({ ability_id, ...row }) => row),
    sourcePortableBindings.map(({ ability_id, ...row }) => row),
    'Bundle import preserves exact wording and binding metadata'
  );
  assert.strictEqual(
    importedBindings.some((row, index) => row.ability_id === sourcePortableBindings[index].ability_id),
    false,
    'Imported bindings point at freshly remapped ability IDs'
  );
  const importedAbilityIds = new Set(JSON.parse(importedCharacter.abilities_json).map(ability => ability.id));
  assert.strictEqual(
    importedBindings.every(row => importedAbilityIds.has(row.ability_id)),
    true,
    'Every imported binding references its remapped canonical ability'
  );
  const sourceAbilityNameById = new Map(abilitiesOne.map(ability => [ability.id, ability.name]));
  const importedAbilities = JSON.parse(importedCharacter.abilities_json);
  const importedAbilityNameById = new Map(importedAbilities.map(ability => [ability.id, ability.name]));
  const sourceTermByAbilityName = [...sourcePortableBindings]
    .map(row => [sourceAbilityNameById.get(row.ability_id), row.term])
    .sort(([left], [right]) => left.localeCompare(right));
  const importedTermByAbilityName = [...importedBindings]
    .map(row => [importedAbilityNameById.get(row.ability_id), row.term])
    .sort(([left], [right]) => left.localeCompare(right));
  assert.deepStrictEqual(
    importedTermByAbilityName,
    sourceTermByAbilityName,
    'ID remapping keeps each approved term attached to the same canonical ability'
  );
  const reExported = validateCampaignBundle(await exportCampaign(importedCampaignId));
  assert.deepStrictEqual(
    reExported.portability.character_ability_bindings.map(row => row.term).sort(),
    ['Glass Bearing', 'Neural Weave', 'Shadow Passage'],
    'Imported approved wording remains forward-portable'
  );

  // Reads and exports share the transaction queue, so neither can observe a
  // partial approval on SQLite's single connection—even if that write rolls back.
  let signalPartialWrite;
  const partialWriteReady = new Promise(resolve => { signalPartialWrite = resolve; });
  let releasePartialWrite;
  const partialWriteGate = new Promise(resolve => { releasePartialWrite = resolve; });
  const rolledBackWrite = db.withWriteTransaction(async () => {
    await db.run(
      `INSERT INTO campaign_vocabulary_state (campaign_id, vocabulary_version) VALUES (?, 1)`,
      [otherCampaignId]
    );
    signalPartialWrite();
    await partialWriteGate;
    throw new Error('EXPECTED_S1_4_ROLLBACK');
  });
  await partialWriteReady;
  let readSettled = false;
  let exportSettled = false;
  const queuedRead = readStageOneCampaignVocabulary(otherCampaignId)
    .then(value => { readSettled = true; return value; });
  const queuedExport = exportCampaign(campaignId)
    .then(value => { exportSettled = true; return value; });
  await new Promise(resolve => setImmediate(resolve));
  assert.strictEqual(readSettled, false, 'Read waits for the active approval transaction');
  assert.strictEqual(exportSettled, false, 'Export waits for the active approval transaction');
  releasePartialWrite();
  await assert.rejects(rolledBackWrite, /EXPECTED_S1_4_ROLLBACK/);
  assert.deepStrictEqual(await queuedRead, {
    campaignId: otherCampaignId,
    vocabularyVersion: 0,
    entries: []
  }, 'Queued read sees only committed state after rollback');
  const queuedExportBundle = await queuedExport;
  assert.doesNotThrow(
    () => validateCampaignBundle(queuedExportBundle),
    'Queued export remains internally self-consistent'
  );

  // Direct run/get/all calls share transaction ownership too. A write issued
  // while a read snapshot is open must wait, then survive even if the reader
  // rolls back; it can never be absorbed into the reader's transaction.
  const outsideWriteSummary = 'DIRECT_WRITE_SURVIVES_FAILED_READER';
  let signalReadSnapshot;
  const readSnapshotReady = new Promise(resolve => { signalReadSnapshot = resolve; });
  let releaseReadSnapshot;
  const readSnapshotGate = new Promise(resolve => { releaseReadSnapshot = resolve; });
  const failedReader = db.withReadTransaction(async () => {
    const before = await db.get(`SELECT summary FROM campaigns WHERE id = ?`, [otherCampaignId]);
    signalReadSnapshot();
    await readSnapshotGate;
    const after = await db.get(`SELECT summary FROM campaigns WHERE id = ?`, [otherCampaignId]);
    assert.deepStrictEqual(after, before, 'Read transaction keeps one snapshot');
    throw new Error('EXPECTED_S1_4_READ_ROLLBACK');
  });
  await readSnapshotReady;
  let outsideWriteSettled = false;
  const outsideWrite = db.run(
    `UPDATE campaigns SET summary = ? WHERE id = ?`,
    [outsideWriteSummary, otherCampaignId]
  ).then(value => { outsideWriteSettled = true; return value; });
  await new Promise(resolve => setImmediate(resolve));
  assert.strictEqual(
    outsideWriteSettled,
    false,
    'Direct write waits instead of joining an active reader transaction'
  );
  releaseReadSnapshot();
  await assert.rejects(failedReader, /EXPECTED_S1_4_READ_ROLLBACK/);
  await outsideWrite;
  assert.strictEqual(
    (await db.get(`SELECT summary FROM campaigns WHERE id = ?`, [otherCampaignId])).summary,
    outsideWriteSummary,
    'Failed reader cannot roll back an acknowledged direct write'
  );

  // AsyncLocalStorage descendants keep their inherited store after the owner
  // transaction commits. That stale token must not let a later continuation
  // bypass the queue and join some other request's transaction.
  const staleOwnerWriteSummary = 'STALE_OWNER_WRITE_SURVIVES_LATER_READER';
  let releaseStaleOwnerWrite;
  const staleOwnerWriteGate = new Promise(resolve => { releaseStaleOwnerWrite = resolve; });
  let staleOwnerWrite;
  await db.withWriteTransaction(async () => {
    staleOwnerWrite = (async () => {
      await staleOwnerWriteGate;
      return db.run(
        `UPDATE campaigns SET summary = ? WHERE id = ?`,
        [staleOwnerWriteSummary, campaignId]
      );
    })();
  });
  let signalLaterReader;
  const laterReaderReady = new Promise(resolve => { signalLaterReader = resolve; });
  let releaseLaterReader;
  const laterReaderGate = new Promise(resolve => { releaseLaterReader = resolve; });
  const laterFailedReader = db.withReadTransaction(async () => {
    await db.get(`SELECT summary FROM campaigns WHERE id = ?`, [campaignId]);
    signalLaterReader();
    await laterReaderGate;
    throw new Error('EXPECTED_LATER_READER_ROLLBACK');
  });
  await laterReaderReady;
  let staleOwnerWriteSettled = false;
  staleOwnerWrite = staleOwnerWrite.then(value => {
    staleOwnerWriteSettled = true;
    return value;
  });
  releaseStaleOwnerWrite();
  await new Promise(resolve => setImmediate(resolve));
  const staleOwnerWriteSettledInsideLaterReader = staleOwnerWriteSettled;
  releaseLaterReader();
  await assert.rejects(laterFailedReader, /EXPECTED_LATER_READER_ROLLBACK/);
  await staleOwnerWrite;
  assert.strictEqual(
    staleOwnerWriteSettledInsideLaterReader,
    false,
    'A stale transaction owner waits instead of joining a later transaction'
  );
  assert.strictEqual(
    (await db.get(`SELECT summary FROM campaigns WHERE id = ?`, [campaignId])).summary,
    staleOwnerWriteSummary,
    'Later rollback cannot erase a stale-owner continuation once it resolves'
  );

  await db.withReadTransaction(async () => {
    await assert.rejects(
      db.withWriteTransaction(async () => {}),
      error => error.code === 'DB_NESTED_TRANSACTION',
      'Nested transaction wrappers fail fast instead of self-deadlocking'
    );
  });
}

// -------------------------------------------------------------
// Test: shared campaign canon context (Phase PT S1.2)
// -------------------------------------------------------------
async function testCampaignContext() {
  console.log('  - Running shared campaign-context tests...');
  const db = await import('./db.js');
  const {
    MAX_HISTORY_LIMIT,
    MAX_MEMORY_LIMIT,
    MAX_MEMORY_QUERY_LENGTH,
    digestCanonBasis,
    readCampaignHistory,
    readCampaignMemories,
    readCampaignOutline,
    readStageOneCanonContext,
    stableCanonBasisJson
  } = await import('./campaign-context.js');
  const { handleToolCall } = await import('./server.js');
  const { scopeStateForSeat } = await import('./rpg-state.js');

  await db.initDb();

  const createCampaign = async (title, outlineJson) => {
    const campaignId = (await db.run(
      `INSERT INTO campaigns (title, genre, summary, current_act)
       VALUES (?, 'context-test', 'context-test', 1)`,
      [title]
    )).id;
    if (outlineJson !== undefined) {
      await db.run(
        `INSERT INTO campaign_outlines (campaign_id, outline_json) VALUES (?, ?)`,
        [campaignId, outlineJson]
      );
    }
    return campaignId;
  };

  const privateSetting = 'CANON_PRIVATE_laser_monastery_beneath_the_harbor';
  const rawOutline = {
    title: '  Context Campaign  ',
    setting: `  ${privateSetting}  `,
    acts: [{ act: 1, title: 'Arrival', objective: 'Find the gate', key_events: ['Open it'] }],
    major_locations: [{ name: 'Harbor', description: 'A rain-black quay.' }],
    starting_quest: { title: 'The Gate', description: 'Find the hidden gate.' },
    theme_colors: {}
  };
  const campaignId = await createCampaign('Context Campaign', JSON.stringify(rawOutline));
  const otherCampaignId = await createCampaign('Other Campaign', JSON.stringify({
    title: 'Other',
    setting: 'Elsewhere.',
    starting_quest: { title: 'Other Quest', description: 'Stay separate.' }
  }));
  const missingOutlineCampaignId = await createCampaign('No Outline');
  const corruptMarker = 'CORRUPT_PRIVATE_outline_marker';
  const corruptCampaignId = await createCampaign('Corrupt Outline', `{${corruptMarker}`);
  const nonObjectCampaignId = await createCampaign('Array Outline', '[]');

  for (const invalidId of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '1', null]) {
    await assert.rejects(
      () => readCampaignOutline(invalidId),
      error => error.code === 'CAMPAIGN_ID_INVALID',
      `Campaign id ${String(invalidId)} must fail before a database read`
    );
  }
  assert.strictEqual(await readCampaignOutline(missingOutlineCampaignId), null, 'Missing outline is distinct from corrupt data');
  await assert.rejects(
    () => readCampaignOutline(corruptCampaignId),
    error => error.code === 'CAMPAIGN_OUTLINE_INVALID' && !error.message.includes(corruptMarker),
    'Malformed outline fails without quoting private stored canon'
  );
  await assert.rejects(
    () => readCampaignOutline(nonObjectCampaignId),
    error => error.code === 'CAMPAIGN_OUTLINE_INVALID',
    'A JSON array is not a campaign outline object'
  );

  const outline = await readCampaignOutline(campaignId);
  assert.strictEqual(outline.title, 'Context Campaign', 'Outline passes through canonical validator');
  assert.strictEqual(outline.setting, privateSetting, 'Validated setting is the canon source');

  await db.run(
    `WITH RECURSIVE sequence(n) AS (
       SELECT 1
       UNION ALL
       SELECT n + 1 FROM sequence WHERE n < 1010
     )
     INSERT INTO turns (
       campaign_id, turn_number, player_action, narrative, state_changes_json
     )
     SELECT ?, n, 'Action ' || n, 'Narrative ' || n,
            '{"dice_rolls":[{"total":' || n || '}]}'
       FROM sequence`,
    [campaignId]
  );
  await db.run(
    `INSERT INTO turns (campaign_id, turn_number, player_action, narrative, state_changes_json)
     VALUES (?, 1, 'Other action', 'Other narrative', '{"private":"other"}')`,
    [otherCampaignId]
  );

  const earliest = await readCampaignHistory(campaignId, { window: 'earliest', limit: 3 });
  assert.deepStrictEqual(earliest.map(row => row.turn_number), [1, 2, 3], 'Earliest window is chronological');
  const latest = await readCampaignHistory(campaignId, { window: 'latest', limit: 6 });
  assert.deepStrictEqual(
    latest.map(row => row.turn_number),
    [1005, 1006, 1007, 1008, 1009, 1010],
    'Latest window selects newest rows then returns them chronologically'
  );
  assert.strictEqual(latest[0].player_action, 'Action 1005', 'Player action remains explicitly labeled as player input');
  assert.strictEqual(latest[0].gm_narrative, 'Narrative 1005', 'GM narration has its own explicit field');
  assert.strictEqual(
    JSON.parse(latest[0].state_changes_json).dice_rolls[0].total,
    1005,
    'Council mechanics context keeps state_changes_json intact'
  );
  assert.strictEqual(latest.some(row => row.campaign_id !== campaignId), false, 'History never crosses campaigns');
  assert.strictEqual(
    (await readCampaignHistory(campaignId, { window: 'earliest', limit: MAX_HISTORY_LIMIT + 500 })).length,
    MAX_HISTORY_LIMIT,
    'History reads clamp at the public maximum'
  );
  assert.deepStrictEqual(
    await readCampaignHistory(campaignId, { window: 'latest', limit: 0 }),
    [],
    'An explicit zero limit returns no history'
  );
  await assert.rejects(
    () => readCampaignHistory(campaignId, { window: 'middle', limit: 1 }),
    error => error.code === 'CAMPAIGN_HISTORY_WINDOW_INVALID'
  );
  await assert.rejects(
    () => readCampaignHistory(campaignId, { window: 'earliest', limit: -1 }),
    error => error.code === 'CAMPAIGN_CONTEXT_LIMIT_INVALID'
  );

  await db.run(
    `WITH RECURSIVE sequence(n) AS (
       SELECT 1
       UNION ALL
       SELECT n + 1 FROM sequence WHERE n < 105
     )
     INSERT INTO memories (campaign_id, turn_number, importance, summary, keywords)
     SELECT ?, n, (n % 5) + 1, 'General memory ' || n, 'general'
       FROM sequence`,
    [campaignId]
  );
  const olderTieId = (await db.run(
    `INSERT INTO memories (campaign_id, turn_number, importance, summary, keywords)
     VALUES (?, 200, 9, 'Older ranked memory', 'ranked')`,
    [campaignId]
  )).id;
  const newerTieId = (await db.run(
    `INSERT INTO memories (campaign_id, turn_number, importance, summary, keywords)
     VALUES (?, 201, 9, 'Newer ranked memory', 'ranked')`,
    [campaignId]
  )).id;
  const lexicalId = (await db.run(
    `INSERT INTO memories (campaign_id, turn_number, importance, summary, keywords)
     VALUES (?, 202, 1, 'The wizard mapped the drowned archive', 'wizard archive')`,
    [campaignId]
  )).id;
  await db.run(
    `INSERT INTO memories (campaign_id, turn_number, importance, summary, keywords)
     VALUES (?, 1, 99, 'Other campaign memory', 'wizard')`,
    [otherCampaignId]
  );

  const ranked = await readCampaignMemories(campaignId, { limit: 8 });
  assert.deepStrictEqual(ranked.slice(0, 2).map(row => row.id), [newerTieId, olderTieId], 'Memory ties break by newest id');
  assert.strictEqual(ranked.some(row => row.campaign_id !== campaignId), false, 'Memory reads never cross campaigns');
  assert.strictEqual(
    (await readCampaignMemories(campaignId, { limit: MAX_MEMORY_LIMIT + 50 })).length,
    MAX_MEMORY_LIMIT,
    'Memory reads clamp at the public search maximum'
  );
  const searched = await readCampaignMemories(campaignId, { query: 'wizard', limit: 8 });
  assert.deepStrictEqual(searched.map(row => row.id), [lexicalId], 'Lexical search stays campaign-scoped and ranked');
  await assert.rejects(
    () => readCampaignMemories(campaignId, { query: 'x'.repeat(MAX_MEMORY_QUERY_LENGTH + 1) }),
    error => error.code === 'CAMPAIGN_MEMORY_QUERY_INVALID',
    'Memory queries over 200 characters fail before SQL'
  );

  const stageContext = await readStageOneCanonContext(campaignId, { memoryQuery: 'wizard' });
  assert.strictEqual(stageContext.basis.history.length, 6, 'Stage 1 pins six latest turns');
  assert.deepStrictEqual(
    stageContext.basis.history.map(turn => turn.turn_number),
    [1005, 1006, 1007, 1008, 1009, 1010],
    'Stage 1 history remains chronological'
  );
  assert.strictEqual(
    stageContext.basis.history[0].player_action.source,
    'player_action_or_claim',
    'Player statements are labeled as attempted actions or claims, not world canon'
  );
  assert.strictEqual(stageContext.basis.history[0].gm_narrative.source, 'gm_narrative');
  assert.strictEqual('state_changes_json' in stageContext.basis.history[0], false, 'Portability basis excludes Council mechanics records');
  assert.strictEqual(stageContext.basis.memories.length, 8, 'Lexical selection stays capped at eight');
  assert.strictEqual(stageContext.basis.memories.some(memory => memory.memory_id === lexicalId), true, 'Lexical match is included');
  assert.strictEqual(stageContext.basis.memories.some(memory => memory.memory_id === newerTieId), true, 'Always-ranked fallback survives lexical search');
  assert.strictEqual(
    new Set(stageContext.basis.memories.map(memory => memory.memory_id)).size,
    stageContext.basis.memories.length,
    'Lexical and ranked memory reads are deduplicated'
  );
  assert.strictEqual(await readStageOneCanonContext(missingOutlineCampaignId), null, 'Stage 1 does not invent a missing outline');

  const reorderedA = { z: [{ b: 'line 1\r\nline 2', a: 1 }], a: true };
  const reorderedB = { a: true, z: [{ a: 1, b: 'line 1\nline 2' }] };
  assert.strictEqual(stableCanonBasisJson(reorderedA), stableCanonBasisJson(reorderedB), 'Digest basis sorts keys and normalizes lines');
  assert.strictEqual(digestCanonBasis(reorderedA), digestCanonBasis(reorderedB), 'Equivalent normalized canon has one digest');
  assert.match(stageContext.digest, /^[a-f0-9]{64}$/, 'Canon basis digest is SHA-256 hex');
  const deterministicallyRankedMemoryIds = [...stageContext.basis.memories]
    .sort((a, b) => (b.importance - a.importance) || (b.memory_id - a.memory_id))
    .map(memory => memory.memory_id);
  assert.deepStrictEqual(
    stageContext.basis.memories.map(memory => memory.memory_id),
    deterministicallyRankedMemoryIds,
    'The selected canon memories remain ordered by importance then recency'
  );

  const repeatedContext = await readStageOneCanonContext(campaignId, { memoryQuery: 'wizard' });
  assert.strictEqual(repeatedContext.digest, stageContext.digest, 'Unchanged selected canon yields a stable digest');
  await db.run(
    `UPDATE turns SET narrative = 'Narrative 1010 changed by later GM ruling'
      WHERE campaign_id = ? AND turn_number = 1010`,
    [campaignId]
  );
  const changedContext = await readStageOneCanonContext(campaignId, { memoryQuery: 'wizard' });
  assert.notStrictEqual(changedContext.digest, stageContext.digest, 'A selected canon change invalidates stale review');

  const mcpOutline = await handleToolCall('get_campaign_outline', { campaign_id: campaignId });
  assert.deepStrictEqual(JSON.parse(mcpOutline.content[0].text), outline, 'MCP outline adapter returns shared validated data');
  const sharedMcpHistory = await readCampaignHistory(campaignId, { window: 'earliest', limit: 2 });
  const expectedHistoryText = sharedMcpHistory
    .map(row => `[Turn ${row.turn_number}]\nPLAYER: ${row.player_action || '(Start Campaign)'}\nGM: ${row.gm_narrative}\n---`)
    .join('\n\n');
  const mcpHistory = await handleToolCall('get_campaign_history', { campaign_id: campaignId, limit: 2 });
  assert.strictEqual(mcpHistory.content[0].text, expectedHistoryText, 'MCP keeps earliest-history text format over shared rows');
  const sharedMcpMemories = await readCampaignMemories(campaignId, { query: 'wizard', limit: MAX_MEMORY_LIMIT });
  const expectedMemoryText = sharedMcpMemories
    .map(row => `- [Importance ${row.importance}] [${row.created_at}] [Tags: ${row.keywords || 'None'}]: ${row.summary}`)
    .join('\n');
  const mcpMemories = await handleToolCall('search_memories', { campaign_id: campaignId, query: 'wizard' });
  assert.strictEqual(mcpMemories.content[0].text, expectedMemoryText, 'MCP memory text is an adapter over the shared ranked search');
  const limitedMcpMemories = await handleToolCall('search_memories', {
    campaign_id: campaignId,
    query: 'ranked',
    limit: 1
  });
  assert.strictEqual(
    limitedMcpMemories.content[0].text.split('\\n').length,
    1,
    'MCP memory search honors its explicit bounded limit'
  );
  const missingQueryMemories = await handleToolCall('search_memories', { campaign_id: campaignId });
  assert.match(
    missingQueryMemories.content[0].text,
    /query must be a non-empty string/,
    'A malformed MCP call cannot turn a missing query into an unfiltered memory read'
  );
  assert.strictEqual(
    missingQueryMemories.content[0].text.includes('ranked memory'),
    false,
    'The malformed MCP error does not disclose campaign memory text'
  );
  const missingMcpOutline = await handleToolCall('get_campaign_outline', { campaign_id: missingOutlineCampaignId });
  assert.strictEqual(missingMcpOutline.content[0].text, 'Campaign outline not found.');

  const scoped = scopeStateForSeat({
    party: [{ id: 1, name: 'Seat Character' }],
    currentQuest: { active_quest: 'Safe quest', quest_description: 'Safe description' },
    turn: { number: 1, narrative: 'Player-safe narration.' },
    canon_context: changedContext.basis,
    canon_basis_digest: changedContext.digest
  }, 1);
  const scopedText = JSON.stringify(scoped);
  assert.strictEqual(scopedText.includes(privateSetting), false, 'Raw canon basis never rides in a seat payload');
  assert.strictEqual(scopedText.includes(changedContext.digest), false, 'Freshness digest remains GM-private');

  const engineSource = fs.readFileSync(new URL('./rpg-engine.js', import.meta.url), 'utf8');
  const takeTurnSource = engineSource.slice(
    engineSource.indexOf('export async function takeTurn'),
    engineSource.indexOf('export async function getCampaignState')
  );
  assert.strictEqual(takeTurnSource.includes('readCampaignOutline(campaignId)'), true, 'Council uses shared outline helper');
  assert.strictEqual(takeTurnSource.includes('readCampaignHistory(campaignId'), true, 'Council uses shared history helper');
  assert.strictEqual(takeTurnSource.includes('readCampaignMemories(campaignId'), true, 'Council uses shared memory helper');
  assert.strictEqual(/fetch\s*\(|\/api\/mcp|https?:\/\//.test(takeTurnSource), false, 'Council never loops through MCP or HTTP');
  assert.strictEqual(takeTurnSource.includes('state_changes_json'), true, 'Council still consumes structured turn mechanics');

  const campaignContextSource = fs.readFileSync(new URL('./campaign-context.js', import.meta.url), 'utf8');
  assert.strictEqual(
    /fetch\s*\(|EventSource|\/api\/mcp|https?:\/\//.test(campaignContextSource),
    false,
    'The portability canon helper contains no HTTP, SSE, or self-MCP transport'
  );

  const serverSource = fs.readFileSync(new URL('./server.js', import.meta.url), 'utf8');
  const mcpRouterSource = serverSource.slice(
    serverSource.indexOf('export async function handleToolCall'),
    serverSource.indexOf('// Terminal error handler')
  );
  assert.strictEqual(mcpRouterSource.includes('readCampaignOutline(args.campaign_id)'), true);
  assert.strictEqual(mcpRouterSource.includes('readCampaignHistory(args.campaign_id'), true);
  assert.strictEqual(mcpRouterSource.includes('readCampaignMemories(args.campaign_id'), true);
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
    await testAbilityKeywordProjection();
    await testAbilityKeywordAuthorityPersistence();
    await testAbilityIdentity();
    await testStageOneAbilityWordingProposal();
    await testCampaignContext();
    await testTurnOrder();
    await testStructuredLocations();
    await testHeroicPointer();
    await testNpcAppearance();
    await testTableStyle();
    await testStageOneAbilityBindingPersistence();
    await testCampaignBundle();
    await testSeatAuth();
    await testSeatLifecycle();
    await testSeatErrorPayloads();
    await testSeatVisibility();
    testThemeColorContract();
    await testThemeGeneration();
    await testVoiceScript();
    await testPortableVoicePersistence();
    await testModelCatalogs();
    await testCanonicalVoiceRoute();
    await testTtsProviderSeam();
    await testTtsCache();
    await testBrowserVoiceQueue();
    await testImageProviderSeam();
    await testServerConfigResolution();
    await testAdminModelRegistryV2();
    await testAdminModelRegistryUiState();
    await testClaudeCodeProvider();
    await testFallbackTiering();
    await testProviderEndpointPin();
    await testTaskQueueSerialization();
    console.log('✅ All unit tests completed successfully!');
    await cleanupTestDb();
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    await cleanupTestDb();
    process.exit(1);
  }
}

runAll();
