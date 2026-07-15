import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { parseJsonSafe, validateTurnData, validateRequiredChecks, rollCheck, forceNoOpTurnState, applyCharacterUpdate, applyDiceConsequences, buildVoiceScript, TABLE_TALK_KINDS } from './rpg-state.js';
import { AIClient, resolveAgentConfig, isTransientAiError } from './api-client.js';
import { baseThemeVars, fullThemeVars } from './public/theme-vars.js';

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
    testThemeColorContract();
    await testThemeGeneration();
    await testVoiceScript();
    await testPortableVoicePersistence();
    await testCanonicalVoiceRoute();
    await testTtsProviderSeam();
    await testTtsCache();
    await testBrowserVoiceQueue();
    await testImageProviderSeam();
    await testServerConfigResolution();
    await testAdminModelRegistryV2();
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
