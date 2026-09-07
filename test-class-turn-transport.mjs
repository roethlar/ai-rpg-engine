import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { scopeStateForSeat } from './rpg-state.js';
import { errorPayloadFor } from './server-errors.js';

const UUID = '87e19d25-a165-4dd8-8cbd-bdb76cb2ed0b';
const OTHER_UUID = '2a9d7e46-58ea-495a-bc40-9a45d590ccae';
const REVISION = `ak1:${'a'.repeat(64)}`;
const NEW_REVISION = `ak1:${'b'.repeat(64)}`;
const PRIVATE = 'private pending adjudication';
const pending = (overrides = {}) => ({ requestId: UUID, actor: 'character:1', characterId: 1,
  playerAction: 'Magic Missile at the gate', abilityTriggerRevision: REVISION, stage: 'prepared', ...overrides });

function fixture() {
  const character = { id: 1, name: 'Mira', class: 'Wizard', player_character_id: 10,
    health: 24, max_health: 24, mana: 0, max_mana: 0, level: 1, xp: 0, skills: { lore: 13 },
    inventory: [], abilities: [{ id: 'missile', name: 'Magic Missile', description: 'A direct bolt.' }],
    abilityTriggerRevision: REVISION, invocableAbilities: [{ abilityId: 'missile', definitionId: 'arcanist.magic-missile',
      definitionVersion: 1, name: 'Magic Missile', trigger: 'Magic Missile', aliases: [], familyKey: 'arcanist', familyLabel: 'Arcanist', help: 'A direct bolt.' }] };
  return { campaignId: 7, title: 'Pending Transport', genre: 'Fantasy', ruleset: { id: 'aetheria' }, rulesMode: true,
    character, party: [character, { id: 2, name: 'Other', class: 'Fighter', health: 30, max_health: 30 }], seatCharacterId: 1,
    turnOrder: { actingCharacterId: 1, order: [{ id: 1, name: 'Mira' }, { id: 2, name: 'Other' }] },
    currentQuest: { active_quest: 'Cross the gate', quest_description: '' }, outline: { acts: [] }, npcs: [], pendingAction: null,
    turn: { number: 1, characterId: 1, narrative: 'The gate stands open.', suggestedChoices: [], rollResults: [], svg: '' } };
}

export async function runClassTurnTransportTests({ verifyBrowser = false } = {}) {
  const { validateTurnRequestBody, app } = await import('./server.js?class-turn-transport');
  const db = await import('./db.js');
  const legacy = { playerAction: '  Look around.  ', characterId: 1, abilityTriggerRevision: REVISION };
  assert.deepEqual(validateTurnRequestBody(legacy), legacy, 'Legacy payload remains exact');
  const target = { ...legacy, requestId: UUID };
  assert.deepEqual(validateTurnRequestBody(target, { target: true }), target);
  assert.throws(() => validateTurnRequestBody(target), error => error.code === 'TURN_REQUEST_INVALID', 'Legacy does not accept target identity metadata');
  for (const value of [undefined, null, '', 123, {}, 'request-1', UUID + 'extra', UUID.replace('-4dd8-', '-1dd8-')]) {
    assert.throws(() => validateTurnRequestBody({ ...target, requestId: value }, { target: true }), error => error.code === 'TURN_REQUEST_INVALID');
  }
  assert.throws(() => validateTurnRequestBody({ ...target, effects: [] }, { target: true }), /unsupported/);
  const state = fixture();
  state.pendingAction = { ...pending(), hidden: { text: PRIVATE } };
  state.turn.requestId = UUID;
  state.settledRequestId = UUID;
  assert.deepEqual(scopeStateForSeat(state, 1).pendingAction, pending());
  assert.equal(scopeStateForSeat(state, 1).turn.requestId, UUID);
  assert.equal(scopeStateForSeat(state, 1).settledRequestId, undefined, 'GET projection cannot disclose an unrelated submission receipt');
  assert.equal(scopeStateForSeat(state, 1, { allowSettledRequestId: true }).settledRequestId, UUID);
  assert.equal(scopeStateForSeat(state, 2).pendingAction, null, 'Other members do not see pending prose or checks');
  assert.equal(scopeStateForSeat(state, 2).turn.requestId, undefined);
  assert.equal(JSON.stringify(scopeStateForSeat(state, 1)).includes(PRIVATE), false);
  for (const changes of [{ stage: PRIVATE }, { requestId: {} }, { actor: 'character:2' }, { characterId: 2 },
    { playerAction: { text: PRIVATE } }, { playerAction: 'x'.repeat(2001) }, { abilityTriggerRevision: { text: PRIVATE } }]) {
    assert.equal(scopeStateForSeat({ ...state, pendingAction: pending(changes) }, 1).pendingAction, null);
  }
  assert.equal(scopeStateForSeat({ ...state, turnOrder: { actingCharacterId: 2 } }, 1).pendingAction, null);
  for (const stage of ['accepted', 'prepared', 'resolved', 'narrated']) {
    assert.equal(scopeStateForSeat({ ...state, pendingAction: pending({ stage }) }, 1).pendingAction.stage, stage);
  }
  const legacyView = scopeStateForSeat({ ...state, ruleset: null }, 1);
  assert.equal(Object.hasOwn(legacyView, 'pendingAction'), false);
  assert.equal(Object.hasOwn(legacyView.turn, 'requestId'), false);
  for (const code of ['CLASS_ACTION_PENDING', 'CLASS_COUNCIL_REJECTED', 'CLASS_COUNCIL_GROUNDING', 'CLASS_COUNCIL_JSON', 'CLASS_COUNCIL_SHAPE']) {
    assert.deepEqual(errorPayloadFor({ auth: { kind: 'seat' } }, { code, message: PRIVATE, publicMessage: 'Retry the submitted action.' }, 'Unavailable'),
      { code, error: 'Retry the submitted action.' });
    assert.deepEqual(errorPayloadFor({ auth: { kind: 'seat' } }, { code, message: PRIVATE }, 'Unavailable'), { error: 'Unavailable' });
  }
  assert.deepEqual(errorPayloadFor({ auth: { kind: 'seat' } }, { code: 'CLASS_COUNCIL_UNTRUSTED', publicMessage: PRIVATE }, 'Unavailable'), { error: 'Unavailable' });
  let listener;
  let browser;
  let campaignId;
  const previousAccess = process.env.ACCESS_SECRET;
  try {
    process.env.ACCESS_SECRET = 'transport-host-test';
    listener = await new Promise(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
    const origin = `http://127.0.0.1:${listener.address().port}`;
    const row = await db.run('INSERT INTO campaigns (title, genre, ruleset_json) VALUES (?, ?, ?)', ['Transport boundary', 'Fantasy', JSON.stringify({ id: 'aetheria' })]);
    campaignId = row.id;
    for (const body of [legacy, { ...target, requestId: 'invalid' }, { ...target, effects: [] }]) {
      const response = await fetch(`${origin}/api/campaigns/${campaignId}/turn`, { method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.ACCESS_SECRET}` }, body: JSON.stringify(body) });
      assert.equal(response.status, 400);
      assert.equal((await response.json()).code, 'TURN_REQUEST_INVALID');
    }
    if (verifyBrowser) {
      const { chromium } = await import('playwright');
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
      await context.addInitScript(() => localStorage.setItem('aetheria_settings', JSON.stringify({ accessToken: `seat_${'d'.repeat(48)}`, voiceNarration: false })));
      const page = await context.newPage();
      const errors = [];
      const posts = [];
      let current = fixture();
      let reply = 'failure';
      let structuralPending = false;
      let refreshFails = false;
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => {
        const request = route.request();
        const url = new URL(request.url());
        const send = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
        if (url.origin !== origin) return route.abort();
        if (url.pathname === '/api/seat/session' || url.pathname === '/api/campaigns/7') {
          if (refreshFails && url.pathname === '/api/campaigns/7') return send({ error: 'Refresh interrupted.' }, 503);
          return send(current);
        }
        if (url.pathname === '/api/campaigns/7/journal') return send({ turns: [], memories: [] });
        if (url.pathname === '/api/campaigns/7/turn') {
          const body = request.postDataJSON();
          posts.push(body);
          if (reply === 'failure') return send({ error: 'Provider interrupted.' }, 503);
          if (reply === 'pending') return send({ error: 'This action is awaiting completion. Retry the submitted action before starting another.', code: 'CLASS_ACTION_PENDING' }, 409);
          if (reply === 'structural') {
            current.pendingAction = structuralPending ? pending({ ...body, actor: 'character:1' }) : null;
            return send({ error: 'The action could not be resolved against the recorded scene.', code: 'CLASS_COUNCIL_SHAPE' }, 500);
          }
          current.pendingAction = null;
          current.turn = { ...current.turn, number: current.turn.number + 1, characterId: 1, playerAction: body.playerAction,
            narrative: `Completed ${posts.length}.`, ...(current.ruleset?.id === 'aetheria' ? { requestId: reply === 'settled' ? UUID : body.requestId } : {}) };
          return send({ ...current, ...(reply === 'settled' ? { settledRequestId: body.requestId } : {}) });
        }
        if (url.pathname.startsWith('/api/')) return send({ error: `Unexpected ${url.pathname}` }, 404);
        return route.continue();
      });
      await page.goto(origin);
      await page.locator('#main-game-screen').waitFor({ state: 'visible' });
      const input = page.locator('#action-input');
      const submit = async () => {
        const response = page.waitForResponse(value => new URL(value.url()).pathname === '/api/campaigns/7/turn');
        await page.locator('#btn-send-action').click();
        await response;
        await page.waitForFunction(() => !document.querySelector('#action-input').disabled);
      };
      await input.fill('Magic Missile at the gate');
      await submit();
      assert.match(posts[0].requestId, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u);
      assert.equal(await input.inputValue(), posts[0].playerAction);
      assert.equal(await input.getAttribute('readonly'), '');
      await input.evaluate(node => { node.value = 'Different action'; });
      await page.locator('#btn-send-action').click();
      assert.equal(posts.length, 1, 'A pending request ID cannot be reused with changed prose');
      assert.equal(await input.inputValue(), posts[0].playerAction);
      await page.reload();
      await page.locator('#main-game-screen').waitFor({ state: 'visible' });
      assert.equal(await input.inputValue(), posts[0].playerAction, 'Unknown delivery survives reload even without a server pending snapshot');
      await submit();
      assert.deepEqual(posts[1], posts[0], 'Failure and reload retry the exact UUID, text, actor and revision');
      current.pendingAction = pending({ requestId: posts[0].requestId });
      current.character.abilityTriggerRevision = NEW_REVISION;
      await page.setViewportSize({ width: 390, height: 844 });
      await page.reload();
      await page.locator('#main-game-screen').waitFor({ state: 'visible' });
      reply = 'success';
      await submit();
      assert.deepEqual(posts[2], posts[0], 'Accepted retries preserve their older revision despite a refreshed sheet');
      assert.equal(await input.inputValue(), '');
      assert.equal(await input.getAttribute('readonly'), null);
      assert.equal(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('aetheria_pending_action_v1_')).length), 0);
      await input.fill('Look into the yard');
      current.pendingAction = pending({ requestId: OTHER_UUID, playerAction: 'Wait by the gate', abilityTriggerRevision: NEW_REVISION });
      reply = 'pending';
      await submit();
      await page.waitForFunction(() => document.querySelector('#action-input').value === 'Wait by the gate');
      assert.notEqual(posts[3].requestId, posts[0].requestId, 'A new action receives a new identity');
      reply = 'settled';
      await submit();
      assert.equal(posts[4].requestId, OTHER_UUID, 'Server-owned pending action replaces the rejected new draft for retry');
      assert.equal(posts[4].playerAction, 'Wait by the gate');
      assert.equal(await input.inputValue(), '');
      assert.notEqual(current.turn.requestId, posts[4].requestId, 'An older exact retry can settle without being the latest turn');
      await page.evaluate(value => localStorage.setItem('aetheria_pending_action_v1_7_1', JSON.stringify(value)), pending({ requestId: UUID, playerAction: 'Wait by the gate' }));
      await page.reload();
      await page.locator('#main-game-screen').waitFor({ state: 'visible' });
      assert.equal(await input.inputValue(), '', 'A matching latest completion clears a stale local pending record on reload');
      for (const reserved of [false, true]) {
        structuralPending = reserved;
        reply = 'structural';
        await input.fill('Magic Missile at an uncertain target');
        await submit();
        assert.equal(await input.getAttribute('readonly'), reserved ? '' : null,
          'Structural errors unlock only after a refreshed state confirms no reserved action');
        assert.equal(await input.inputValue(), 'Magic Missile at an uncertain target');
        if (reserved) {
          const submitted = posts.at(-1);
          reply = 'success';
          await submit();
          assert.deepEqual(posts.at(-1), submitted);
        }
      }
      structuralPending = false;
      refreshFails = true;
      reply = 'structural';
      await input.fill('Magic Missile at the gate');
      await submit();
      assert.equal(await input.getAttribute('readonly'), '', 'A failed refresh cannot prove the action unreserved');
      const uncertain = posts.at(-1);
      refreshFails = false;
      reply = 'success';
      await submit();
      assert.deepEqual(posts.at(-1), uncertain);
      current.ruleset = null;
      delete current.turn.requestId;
      await page.reload();
      await page.locator('#main-game-screen').waitFor({ state: 'visible' });
      reply = 'failure';
      await input.fill('Ask the keeper a question');
      await submit();
      assert.equal(Object.hasOwn(posts.at(-1), 'requestId'), false, 'Legacy transport remains unchanged');
      assert.equal(await input.getAttribute('readonly'), null, 'Legacy failed drafts remain editable');
      current.character = null;
      current.party = [];
      current.turnOrder = { actingCharacterId: null, order: [] };
      await page.reload();
      await page.locator('#main-game-screen').waitFor({ state: 'visible' });
      assert.equal(await page.locator('.character-section').isVisible(), false, 'Archived tables do not retain an old owned sheet');
      assert.equal(await page.locator('#char-name').textContent(), '');
      assert.equal(await input.isDisabled(), true, 'An archived table cannot submit as a stale character');
      assert.deepEqual(errors, []);
      console.log('Class pending-action browser guards passed (mocked turn/state responses; real HTTP validation tested separately).');
    }
    return { requestValidation: true, seatPrivacy: true, browser: verifyBrowser };
  } finally {
    if (browser) await browser.close();
    if (listener) await new Promise(resolve => listener.close(resolve));
    if (campaignId) await db.run('DELETE FROM campaigns WHERE id = ?', [campaignId]);
    if (previousAccess === undefined) delete process.env.ACCESS_SECRET; else process.env.ACCESS_SECRET = previousAccess;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const directory = await mkdtemp(join(tmpdir(), 'aetheria-class-transport-'));
  process.env.RPG_DB_PATH = join(directory, 'test.db');
  const db = await import('./db.js');
  try {
    await db.initDb();
    console.log('Class turn transport tests passed:', await runClassTurnTransportTests({ verifyBrowser: true }));
  } finally {
    await db.closeDb();
    await rm(directory, { recursive: true, force: true });
  }
}
