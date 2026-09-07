import assert from 'node:assert/strict';
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { CLASS_FAMILIES } from './class-catalog.js';
import { createClassRuleset, createClassSheet, createRulesWorld, addClassActor, projectClassCharacter } from './class-state.js';
import { scopeStateForSeat, scopeJournalForSeat } from './rpg-state.js';
import { createCheckRecord } from './rules-resolution.js';
import { evaluateEffects } from './rules-effects.js';
import { testSelection, testClassLayout } from './test-class-state.mjs';

const PRIVATE = 'PRIVATE_CLASS_SEAT_SENTINEL';
const annotationText = 'A visible consequence <without markup> remains recorded.';

function makeRoll(actor, sequence, raw = 100) {
  return createCheckRecord({ actor, turn: 1, skillBonus: 13, activeEncounter: true,
    call: { actor, callSeq: sequence, intent: `Recorded check ${sequence}`, tier: 'standard', tierBasis: 'A defended crossing.', deltas: [] }
  }, { roll: () => raw });
}

function poison(value) {
  if (!value || typeof value !== 'object') return;
  if (!Array.isArray(value)) value.privateMetadata = { secret: PRIVATE };
  for (const [key, child] of Object.entries(value)) if (key !== 'privateMetadata') poison(child);
}

export function runClassSeatProjectionTests() {
  let count = 0;
  for (const family of CLASS_FAMILIES) for (const branch of family.branches) {
    const selection = testSelection(family.id, branch.id);
    const sheet = { ...createClassSheet(selection, { name: 'Seat owner', level: 10 }), id: 10, player_character_id: 30 };
    const world = createRulesWorld({ location: { id: 4, layout: testClassLayout } });
    addClassActor(world, sheet, { companionActorRef: 'npc:90' });
    const own = projectClassCharacter(sheet, world);
    const state = { campaignId: 1, party: [own, { ...own, id: 20, name: 'Other', classState: { secret: PRIVATE } }],
      ruleset: createClassRuleset(selection), outline: { secret: PRIVATE }, npcs: [{ secret: PRIVATE }],
      rulesWorld: { secret: PRIVATE }, turn: { number: 1, narrative: 'A shared scene.', rollResults: [] } };
    const scoped = scopeStateForSeat(state, 10);
    for (const field of ['classBuild', 'classState', 'skills', 'resources', 'conditions', 'area']) {
      assert.deepEqual(scoped.character[field], own[field], `Exact own ${field} projection for ${branch.id}`);
    }
    assert.deepEqual(Object.keys(scoped.party[1]), ['id', 'name', 'class', 'level', 'health', 'max_health']);
    const malicious = structuredClone(state);
    for (const field of ['classBuild', 'classState', 'skills', 'resources', 'conditions', 'abilities', 'inventory', 'attributes']) poison(malicious.party[0][field]);
    const sanitized = scopeStateForSeat(malicious, 10);
    assert.equal(JSON.stringify(sanitized).includes(PRIVATE), false, 'Unknown nested metadata and other class sheets cannot cross the seat boundary.');
    assert.deepEqual(sanitized.character.classState, scoped.character.classState);
    count++;
  }

  const selection = testSelection();
  const member = { ...createClassSheet(selection, { name: 'Mira' }), id: 10, area: 'gate', conditions: {} };
  const rolls = Array.from({ length: 12 }, (_, index) => makeRoll(10, index + 1));
  const effectsWorld = createRulesWorld({ location: { id: 4, layout: testClassLayout }, characters: [member] });
  effectsWorld.actors['character:10'].health -= 5;
  const effects = evaluateEffects({ state: effectsWorld, effects: [{ op: 'heal', who: 'character:10', grade: 'patch' }],
    actor: 10, turn: 1, transactionId: 'seat-check', consumer: 'annotation', band: 'crit_success', stakesLicense: rolls[0].stakesLicense }).effects;
  rolls[0] = { ...rolls[0], annotation: { text: 'A small wound closes.', effects, affirmedOpposed: [] } };
  rolls[1] = { ...rolls[1], annotation: { text: annotationText,
    effects: [{ ...effects[0], pricingPrestate: { health: { secret: PRIVATE } } }], affirmedOpposed: [] } };
  const state = { party: [member], turn: { number: 1, rollResults: rolls } };
  const scoped = scopeStateForSeat(state, 10);
  assert.equal(scoped.turn.rollResults.length, 12, 'All signed d100 checks survive the legacy eight-object display cap.');
  assert.deepEqual(scoped.turn.rollResults[0], rolls[0], 'Safe annotations and their canonical receipt remain exact.');
  assert.equal(Object.hasOwn(scoped.turn.rollResults[1], 'annotation'), false, 'Unsafe detail becomes a partial display view, not a fabricated annotation.');
  assert.deepEqual(scoped.turn.rollAnnotationDetails, [{ checkId: rolls[1].checkId, text: annotationText, detailsOmitted: true }]);
  assert.equal(JSON.stringify(scoped).includes(PRIVATE), false);
  const invalid = { ...rolls[2], T: 98, total: 22, dc: 10 };
  assert.equal(scopeStateForSeat({ ...state, turn: { rollResults: [invalid] } }, 10).turn.rollResults.length, 0, 'Bad d100 arithmetic never falls back to legacy dice.');
  const wrongCost = structuredClone(rolls[0]);
  wrongCost.annotation.effects[0].pointCost = 2;
  wrongCost.annotation.effects[0].weightClass = 'significant';
  assert.equal(scopeStateForSeat({ ...state, turn: { rollResults: [wrongCost] } }, 10).turn.rollAnnotationDetails[0].detailsOmitted, true, 'Receipt price must match the authored effect, not merely its weight label.');
  const legacy = Array.from({ length: 12 }, (_, total) => ({ total, dc: 10 }));
  assert.deepEqual(scopeStateForSeat({ party: [], turn: { rollResults: legacy } }, 10).turn.rollResults, legacy.slice(0, 8));
  const rows = [{ turn_number: 1, character_id: 10, narrative: 'Shared.', state_changes_json: JSON.stringify({ dice_rolls: rolls, private: PRIVATE }) }];
  const journal = scopeJournalForSeat(rows);
  assert.equal(journal[0].dice_rolls.length, 12);
  assert.deepEqual(journal[0].dice_rolls[0], rolls[0]);
  assert.equal(Object.hasOwn(journal[0], 'state_changes_json'), false);
  assert.equal(JSON.stringify(journal).includes(PRIVATE), false);
  const malformed = structuredClone(member);
  malformed.skills.lore = { secret: PRIVATE };
  malformed.resources = { health: { current: 999, maximum: 1 }, strain: { current: { secret: PRIVATE }, maximum: 3 } };
  malformed.classBuild.concept = { secret: PRIVATE };
  malformed.classState.prepared = [{ secret: PRIVATE }];
  malformed.classState.profile = 'predator';
  malformed.conditions = { hindered: { actor: 'npc:90', condition: 'hindered', class: 'hindrance', duration: 'scene', detail: PRIVATE } };
  const safeMalformed = scopeStateForSeat({ party: [malformed] }, 10).character;
  assert.equal(JSON.stringify(safeMalformed).includes(PRIVATE), false);
  assert.equal(safeMalformed.classState.profile, undefined, 'Another class family state is not admitted by the shared projection.');
  assert.deepEqual(safeMalformed.resources, {});
  assert.deepEqual(safeMalformed.conditions, {});
  console.log(`Class seat projection tests passed: ${count} branches, full d100 history, private-state and annotation guards.`);
}

async function request(origin, route, token) {
  return new Promise((resolve, reject) => {
    const req = http.get(new URL(route, origin), { headers: { Authorization: `Bearer ${token}` } }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) }));
    });
    req.on('error', reject);
  });
}

export async function runClassSeatTests({ verifyBrowser = false } = {}) {
  runClassSeatProjectionTests();
  const db = await import('./db.js');
  const { AIClient } = await import('./api-client.js');
  const { createCampaign, joinCampaign, getCampaignState } = await import('./rpg-engine.js');
  const { app } = await import('./server.js');
  const { mintSeatToken, hashSeatToken } = await import('./seat-auth.js');
  const original = AIClient.prototype.sendPrompt;
  const previousAccess = process.env.ACCESS_SECRET;
  let campaignId;
  let listener;
  let browser;
  let calls = 0;
  AIClient.prototype.sendPrompt = async ({ systemInstruction }) => {
    calls++;
    if (systemInstruction.includes('persistent structured layout')) return JSON.stringify(testClassLayout);
    if (systemInstruction.includes('initial Aetheria scene')) return JSON.stringify({ schemaVersion: 1,
      areas: testClassLayout.areas.map(area => ({ area: area.id, terrain: 'dry_ground', traits: ['visible', 'safe', 'visited'], surfaces: ['ground'] })),
      actors: [{ actor: 'player', area: 'gate', allegiance: 'party', profile: null, conditions: [] },
        { actor: 'npc0', area: 'gate', allegiance: 'party', profile: 'support', conditions: [] }],
      items: [], objects: [], features: [], discoveries: [], encounter: { active: false, opposition: [] }
    });
    if (calls === 1) return JSON.stringify({ title: 'Seat Class Verification', setting: 'A shared gate.', acts: [],
      major_locations: [{ name: 'Gatehouse', description: 'Two connected areas.' }],
      key_npcs: [{ name: 'Keeper', role: 'Guide', personality: PRIVATE }], starting_quest: { title: 'Cross the Gate', description: 'Reach the yard.' } });
    return JSON.stringify({ narrative: 'The keeper waits by the gate.' });
  };
  try {
    const state = await createCampaign({ genre: 'Fantasy', characterName: 'Mira', ruleset: 'aetheria',
      classSelection: testSelection(), apiConfig: { provider: 'ollama', model: 'test' } });
    campaignId = state.campaignId;
    const joined = await joinCampaign(campaignId, { characterName: 'Hidden branch', classSelection: testSelection('channeler', 'channeler.restoration') });
    const ownId = state.character.id;
    const token = mintSeatToken();
    await db.run('INSERT INTO seats (campaign_id, character_id, token_hash, label) VALUES (?,?,?,?)', [campaignId, ownId, hashSeatToken(token), 'Class seat probe']);
    const rolls = Array.from({ length: 12 }, (_, index) => makeRoll(ownId, index + 1));
    rolls[0] = { ...rolls[0], annotation: { text: annotationText,
      effects: [{ op: 'harm', privateWorld: { secret: PRIVATE } }], affirmedOpposed: [] } };
    const last = await db.get('SELECT state_changes_json FROM turns WHERE campaign_id = ? AND turn_number = 1', [campaignId]);
    await db.run('UPDATE turns SET state_changes_json = ? WHERE campaign_id = ? AND turn_number = 1',
      [JSON.stringify({ ...JSON.parse(last.state_changes_json), dice_rolls: rolls, privateWorld: PRIVATE }), campaignId]);
    process.env.ACCESS_SECRET = 'seat-class-host-test';
    listener = await new Promise(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
    const origin = `http://127.0.0.1:${listener.address().port}`;
    const response = await request(origin, '/api/seat/session', token);
    assert.equal(response.status, 200);
    const current = await getCampaignState(campaignId);
    assert.deepEqual(response.body.character.classState, current.party.find(member => member.id === ownId).classState);
    assert.deepEqual(response.body.character.skills, current.character.skills);
    assert.equal(response.body.turn.rollResults.length, 12);
    assert.equal(JSON.stringify(response.body).includes(PRIVATE), false, 'Real API seat response contains no GM-private fixture or unsafe annotation object.');
    assert.equal(response.body.party.find(member => member.id === joined.joinedCharacterId).classState, undefined);
    const journal = await request(origin, `/api/campaigns/${campaignId}/journal`, token);
    assert.equal(journal.status, 200);
    assert.equal(journal.body.turns[0].dice_rolls.length, 12);
    assert.equal(JSON.stringify(journal.body).includes(PRIVATE), false);
    if (verifyBrowser) {
      const { chromium } = await import('playwright');
      const { mkdtemp } = await import('node:fs/promises');
      const { tmpdir } = await import('node:os');
      const { join } = await import('node:path');
      const artifacts = await mkdtemp(join(tmpdir(), 'aetheria-class-seat-'));
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
      await context.addInitScript(value => localStorage.setItem('aetheria_settings', JSON.stringify({ accessToken: value, voiceNarration: false })), token);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      await page.goto(origin);
      await page.locator('#main-game-screen').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#char-name').textContent(), 'Mira');
      assert.equal(await page.locator('.log-roll').count(), 12);
      assert.equal(await page.locator('.roll-annotation').first().textContent(), annotationText);
      assert.equal(await page.locator('.roll-annotation script').count(), 0);
      await page.locator('.roll-annotation').first().scrollIntoViewIfNeeded();
      await page.screenshot({ path: join(artifacts, 'seat-annotation-desktop.png') });
      await page.locator('.class-skills summary').click();
      assert.match(await page.locator('#class-runtime-details').textContent(), new RegExp(`Lore\\+${response.body.character.skills.lore}`));
      await page.screenshot({ path: join(artifacts, 'seat-desktop.png') });
      await page.locator('#tab-journal-btn').click();
      await page.locator('.timeline-roll-badge').first().waitFor();
      assert.equal(await page.locator('.timeline-roll-badge').count(), 12);
      assert.match(await page.locator('.timeline-roll-badge').first().textContent(), /visible consequence/);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator('.log-roll .roll-annotation').first().scrollIntoViewIfNeeded();
      assert.equal(await page.locator('.log-roll .roll-annotation').first().isVisible(), true);
      await page.screenshot({ path: join(artifacts, 'seat-annotation-mobile.png') });
      await page.locator('#btn-open-abilities').click();
      assert.ok(await page.locator('#ability-drawer .ability-button').count() > 0);
      await page.locator('#ability-drawer .ability-button').first().click();
      assert.equal(await page.locator('#action-input').evaluate(node => document.activeElement === node), true);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.screenshot({ path: join(artifacts, 'seat-mobile.png') });
      assert.deepEqual(errors, []);
      console.log(`Real class seat API/browser checks passed (provider setup stub only). Screenshots: ${artifacts}`);
    }
    return { branches: 24, seatApi: true, browser: verifyBrowser };
  } finally {
    if (browser) await browser.close();
    if (listener) await new Promise(resolve => listener.close(resolve));
    AIClient.prototype.sendPrompt = original;
    if (previousAccess === undefined) delete process.env.ACCESS_SECRET; else process.env.ACCESS_SECRET = previousAccess;
    if (campaignId) {
      const profiles = await db.all('SELECT player_character_id FROM characters WHERE campaign_id = ?', [campaignId]);
      await db.run('DELETE FROM campaigns WHERE id = ?', [campaignId]);
      for (const profile of profiles) await db.run('DELETE FROM player_characters WHERE id = ?', [profile.player_character_id]);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const directory = await mkdtemp(join(tmpdir(), 'aetheria-class-seats-'));
  process.env.RPG_DB_PATH = join(directory, 'test.db');
  const db = await import('./db.js');
  try {
    await db.initDb();
    console.log('Class seat tests passed:', await runClassSeatTests({ verifyBrowser: true }));
  } finally {
    await db.closeDb();
    await rm(directory, { recursive: true, force: true });
  }
}
