import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseJsonSafe, validateTurnData, validateRequiredChecks, rollCheck, forceNoOpTurnState, applyCharacterUpdate, applyDiceConsequences, buildVoiceScript, TABLE_TALK_KINDS } from './rpg-state.js';
import { AIClient, resolveAgentConfig, isTransientAiError } from './api-client.js';

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
// Test: agent-generated genre theming (Phase T1)
// -------------------------------------------------------------
/**
 * css-1: the theme custom properties hold HSL *triples* ("220, 25%, 12%"), not
 * rgb channels — see validateOutlineData's theme_colors above and the writer in
 * public/app.js. A triple is only legal inside hsl()/hsla(). Substituted into
 * rgb()/rgba() it yields `rgba(220, 25%, 12%, 0.7)`, which mixes a number with
 * percentages — not valid legacy rgb syntax (CSS Color 4 §rgb-functions) — so the
 * browser drops the WHOLE declaration at parse time and the surface silently
 * renders unpainted.
 *
 * No-DOM scanner over the shipped stylesheet. It guards the defect *class*, not
 * one literal spelling (r1 reopen: a custom-property alias sailed past a
 * direct-only regex; r2 residual: nested `var(--x, var(--theme-…))` fallbacks
 * also sail past a first-arg-only matcher). Comments are blanked before scanning
 * so they cannot hide offenders or pad anti-vacuous checks. The anti-vacuous
 * side is production anchors in live CSS, not a coarse match-count heuristic.
 */
function blankCssComments(css) {
  // Keep newlines so line numbers still map to the original file.
  return css.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '));
}

/** Every custom-property name referenced by a `var(--name…)` in `fragment`. */
function extractCssVarNames(fragment) {
  const names = [];
  // Underscore is a valid CSS ident character (r3 reopen: --panel_alias slipped past).
  const re = /var\(\s*(--[a-zA-Z0-9_-]+)/gi;
  let m;
  while ((m = re.exec(fragment)) !== null) names.push(m[1]);
  return names;
}

/** Index of the matching `)` for `css[openIdx] === '('`, or -1. */
function findMatchingParen(css, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < css.length; i++) {
    const ch = css[i];
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Custom props whose value references other custom props via var(), including
 * nested fallbacks (`var(--missing, var(--theme-panel))`). Each ref is an edge
 * in the alias graph; a theme triple flowing through any fallback taints the name.
 */
function collectVarAliases(css) {
  const aliases = new Map(); // --name -> [--ref, ...]
  // Value ends at `;` or `{`/`}` (selector boundaries). Nested parens allowed.
  const defRe = /(--[a-zA-Z0-9_-]+)\s*:([^;{}]+)/g;
  let m;
  while ((m = defRe.exec(css)) !== null) {
    const name = m[1];
    const refs = extractCssVarNames(m[2]);
    if (refs.length === 0) continue;
    if (!aliases.has(name)) aliases.set(name, []);
    aliases.get(name).push(...refs);
  }
  return aliases;
}

function resolvesToThemeTriple(name, aliases, seen = new Set()) {
  // --theme-* is the HSL-triple contract (written by app.js / :root defaults).
  if (name.startsWith('--theme-')) return true;
  if (seen.has(name)) return false;
  seen.add(name);
  const refs = aliases.get(name);
  if (!refs) return false;
  return refs.some((ref) => resolvesToThemeTriple(ref, aliases, seen));
}

/**
 * Find rgb()/rgba() calls whose arguments reference any custom property that
 * is, or transitively aliases (including via nested var() fallbacks), a
 * --theme-* triple. `css` must already have comments blanked if the caller
 * wants comment-immunity.
 */
function findInvalidThemeRgbConsumers(css, { pathLabel = 'stylesheet' } = {}) {
  const aliases = collectVarAliases(css);
  const invalid = [];
  const startRe = /\b(rgba?)\(/gi;
  let match;
  while ((match = startRe.exec(css)) !== null) {
    const fn = match[1];
    const openIdx = match.index + match[0].length - 1;
    const closeIdx = findMatchingParen(css, openIdx);
    if (closeIdx < 0) continue;
    const args = css.slice(openIdx + 1, closeIdx);
    const refs = extractCssVarNames(args);
    const themeRefs = [...new Set(refs.filter((r) => resolvesToThemeTriple(r, aliases)))];
    if (themeRefs.length === 0) continue;
    const line = css.slice(0, match.index).split('\n').length;
    const detail = themeRefs.map((r) => (
      r.startsWith('--theme-') ? r : `${r} (aliases a --theme-* triple)`
    )).join(', ');
    invalid.push(`${pathLabel}:${line} — ${fn}(… ${detail} …)`);
  }
  return invalid;
}

async function testThemeVarConsumers() {
  console.log(' - Running theme-variable consumer tests (css-1)...');
  const stylesPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public', 'styles.css');
  const raw = fs.readFileSync(stylesPath, 'utf8');
  const css = blankCssComments(raw);

  const invalid = findInvalidThemeRgbConsumers(css, { pathLabel: 'public/styles.css' });
  assert.deepStrictEqual(
    invalid, [],
    'rgb()/rgba() cannot consume an HSL-triple theme var (directly or via custom-property ' +
    'indirection): the declaration is invalid and the browser drops it, so the surface never ' +
    'paints. Use hsl()/hsla(). Offenders:\n  ' +
    invalid.join('\n  ')
  );

  // Anti-vacuous: prove we are reading the real themed stylesheet and that the
  // defect's critical surfaces still use the valid form. Comments are blanked
  // above, so commented-out matches cannot satisfy these. A coarse "> N matches"
  // heuristic is deliberately not used — r1 showed 101 hits inside a comment
  // (or any non-production padding) could satisfy one.
  const anchors = [
    {
      label: '--theme-panel is defined as an HSL triple',
      re: /--theme-panel\s*:\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*;/,
    },
    {
      label: 'body background uses hsl(var(--theme-bg))',
      re: /background-color\s*:\s*hsl\(\s*var\(\s*--theme-bg\s*\)\s*\)/,
    },
    {
      label: 'header/panel fill uses hsla(var(--theme-panel), α)',
      re: /background-color\s*:\s*hsla\(\s*var\(\s*--theme-panel\s*\)\s*,/,
    },
    {
      label: 'primary accent uses hsla(var(--theme-primary), α)',
      re: /\bhsla\(\s*var\(\s*--theme-primary\s*\)\s*,/,
    },
  ];
  for (const anchor of anchors) {
    assert.ok(
      anchor.re.test(css),
      `css-1 guard anti-vacuous anchor missing: ${anchor.label}. ` +
      'Either public/styles.css moved/emptied or the valid form was removed from a critical surface.'
    );
  }

  // Fixture probes: prior demonstrated bypasses must stay caught. If this
  // scanner is weakened, these fail.
  const probeOneHop = blankCssComments(
    '.probe { --panel-alias: var(--theme-panel); background: rgba(var(--panel-alias), 0.7); }'
  );
  const probeOneHopHits = findInvalidThemeRgbConsumers(probeOneHop, { pathLabel: 'probe' });
  assert.strictEqual(
    probeOneHopHits.length, 1,
    `css-1 guard must catch one-hop custom-property indirection; got: ${JSON.stringify(probeOneHopHits)}`
  );
  assert.ok(
    probeOneHopHits[0].includes('--panel-alias') && probeOneHopHits[0].includes('aliases'),
    `css-1 guard probe message should name the alias: ${probeOneHopHits[0]}`
  );

  const probeMultiHop = blankCssComments(
    '.probe { --a: var(--theme-panel); --b: var(--a); background: rgba(var(--b), 0.5); }'
  );
  const probeMultiHopHits = findInvalidThemeRgbConsumers(probeMultiHop, { pathLabel: 'probe' });
  assert.strictEqual(
    probeMultiHopHits.length, 1,
    `css-1 guard must catch multi-hop indirection; got: ${JSON.stringify(probeMultiHopHits)}`
  );

  // r2 residual (executed by codex before its session was content-filtered):
  // nested var() fallbacks that still resolve to a theme triple.
  const probeNestedFallbackDef = blankCssComments(
    '.probe { --panel-alias: var(--css1-absent, var(--theme-panel)); background: rgba(var(--panel-alias), 0.7); }'
  );
  assert.strictEqual(
    findInvalidThemeRgbConsumers(probeNestedFallbackDef, { pathLabel: 'probe' }).length, 1,
    'css-1 guard must catch theme triples reached via nested var() fallbacks in a definition'
  );

  const probeNestedFallbackArg = blankCssComments(
    '.probe { background: rgba(var(--css1-absent, var(--theme-panel)), 0.7); }'
  );
  assert.strictEqual(
    findInvalidThemeRgbConsumers(probeNestedFallbackArg, { pathLabel: 'probe' }).length, 1,
    'css-1 guard must catch theme triples nested in var() fallbacks inside rgba() args'
  );

  // r3 residual: underscore is a valid CSS custom-property character.
  const probeUnderscoreName = blankCssComments(
    '.probe { --panel_alias: var(--theme-panel); background: rgba(var(--panel_alias), 0.7); }'
  );
  assert.strictEqual(
    findInvalidThemeRgbConsumers(probeUnderscoreName, { pathLabel: 'probe' }).length, 1,
    'css-1 guard must catch custom-property names that use underscores'
  );

  // Comments must not create false positives (invalid form only in a comment).
  const probeCommentOnly = blankCssComments(
    '/* rgba(var(--theme-panel), 0.7) */ .ok { background: hsla(var(--theme-panel), 0.7); }'
  );
  assert.deepStrictEqual(
    findInvalidThemeRgbConsumers(probeCommentOnly, { pathLabel: 'probe' }),
    [],
    'css-1 guard must ignore invalid forms that exist only inside CSS comments'
  );

  // Non-theme custom props used in rgba are out of this finding's scope.
  const probeUnrelated = blankCssComments(
    '.x { --rgb-channels: 255, 0, 0; background: rgba(var(--rgb-channels), 0.5); }'
  );
  assert.deepStrictEqual(
    findInvalidThemeRgbConsumers(probeUnrelated, { pathLabel: 'probe' }),
    [],
    'css-1 guard must not flag rgba() over non-theme custom properties'
  );
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

  // sv-5: a seat hands speaker/tone back to the narrate route, which bounds
  // them via boundVoiceDirective — the same function server.js calls. It must
  // accept, unchanged, the widest values validateTurnData can emit; a
  // stricter cap there 400s a valid line and kills the rest of the queue.
  const { boundVoiceDirective } = await import('./rpg-state.js');
  const widest = validateTurnData({
    input_kind: 'dialogue',
    narrative: 'x',
    narration_lines: [{ speaker: 'S'.repeat(500), tone: 'T'.repeat(500), text: 'Line.' }]
  }, 1).narration_lines[0];
  assert.strictEqual(widest.tone.length, 120, 'validateTurnData caps tone at 120');
  const bounded = boundVoiceDirective(widest.speaker, widest.tone);
  assert.strictEqual(bounded.tone, widest.tone,
    'The narrate route passes through the longest tone validateTurnData emits');
  assert.strictEqual(bounded.speaker, widest.speaker,
    'The narrate route passes through the longest speaker validateTurnData emits');

  // A hostile over-length value is truncated, not rejected: bounded, and the
  // narration queue survives.
  const hostile = boundVoiceDirective('x'.repeat(9000), 'y'.repeat(9000));
  assert.strictEqual(hostile.tone.length, 120, 'Over-length tone is truncated to the cap');
  assert.strictEqual(hostile.speaker.length, 80, 'Over-length speaker is truncated to the cap');
  assert.deepStrictEqual(boundVoiceDirective(undefined, null), { speaker: '', tone: '' }, 'Missing fields degrade to empty');
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
      { id: 1, name: 'Joe', class: 'Netrunner', level: 3, health: 10, max_health: 14, mana: 5, max_mana: 8, xp: 240, inventory: ['deck', 'sidearm'], attributes: { intellect: 4 }, abilities: [{ name: 'Ghostline' }], progression_notes: 'learned Ghostline turn 4', player_character_id: 11 },
      { id: 2, name: 'Mira', class: 'Face', level: 3, health: 9, max_health: 12, mana: 6, max_mana: 6, xp: 230, inventory: [LEAK.partymateInventory], attributes: { charm: 4 }, abilities: [], progression_notes: '', player_character_id: 12 }
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
        { speaker: 'narrator', text: 'The lobby hums.', tone: 'low, tense', voice: null, instructions: 'Tone: low, tense.' },
        { speaker: 'Kessler', text: '"You again."', tone: 'amused contempt', voice: 'cedar', instructions: `${LEAK.voiceInstructions} Tone: amused contempt.` }
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
  assert.deepStrictEqual(scoped.turn.voiceLines[1], { speaker: 'Kessler', text: '"You again."', tone: 'amused contempt' });

  // The narrate route recomposes the same directive the host client sends.
  const resolved = resolveSpeakerVoice(hostState.npcs[0].voice_json, 'amused contempt');
  assert.strictEqual(resolved.voice, 'cedar');
  assert.strictEqual(resolved.instructions, `${LEAK.voiceInstructions} Tone: amused contempt.`);
  assert.deepStrictEqual(resolveSpeakerVoice(null, 'gentle'), { voice: null, instructions: 'Tone: gentle.' }, 'Unknown speaker keeps narrator fallback + tone');
  assert.deepStrictEqual(resolveSpeakerVoice('not json', ''), { voice: null, instructions: null }, 'Corrupt profile degrades to narrator');

  // Journal: sanitized shape, no state_changes_json.
  const journal = scopeJournalForSeat([
    { turn_number: 1, player_action: 'start', narrative: 'It begins.', state_changes_json: `{"memory_update":"${LEAK.stateChanges}"}`, created_at: 't0' }
  ]);
  assert.strictEqual(JSON.stringify(journal).includes(LEAK.stateChanges), false, 'Journal drops state_changes_json');
  assert.deepStrictEqual(journal[0], { turn_number: 1, player_action: 'start', narrative: 'It begins.', created_at: 't0' });

  // Silhouette tolerates junk without throwing.
  assert.strictEqual(silhouetteCharacter(null), null);

  // A state with no turn yet (defensive) scopes without throwing.
  assert.strictEqual(scopeStateForSeat({ party: [] }, 1).turn, null);
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
    await testSeatAuth();
    await testSeatLifecycle();
    await testSeatErrorPayloads();
    await testSeatVisibility();
    await testThemeVarConsumers();
    await testThemeGeneration();
    await testVoiceScript();
    await testTtsProviderSeam();
    await testImageProviderSeam();
    await testServerConfigResolution();
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
