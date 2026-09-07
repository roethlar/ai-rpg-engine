import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { getCatalogSummary } from './class-catalog.js';
import { testClassLayout } from './test-class-state.mjs';
import { verifyLocalIcon } from './test-browser-icons.mjs';
import { checkSucceeded, normalizeCheckRecord } from './rules-resolution.js';

async function assertFits(page, selector) {
  const overflow = await page.locator(selector).evaluateAll(nodes => nodes.filter(node => {
    const box = node.getBoundingClientRect();
    return box.width > 0 && node.scrollWidth > node.clientWidth + 1;
  }).map(node => ({ text: node.textContent.trim(), width: node.clientWidth, content: node.scrollWidth })));
  assert.deepEqual(overflow, [], `${selector} must fit its actual container`);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal page overflow');
}

async function selectBranch(page, familyId, branchId) {
  await page.locator('#class-family').selectOption(familyId);
  await page.locator('#class-branch').selectOption(branchId);
}

// Only the AIClient provider boundary is replaced. Browser requests use the real
// Express routes, class catalog, campaign transaction, SQLite and state projection.
export async function runClassExperienceBrowserTests({ afterCreation } = {}) {
  const db = await import('./db.js');
  const { AIClient } = await import('./api-client.js');
  const { getCampaignState } = await import('./rpg-engine.js');
  const artifacts = await mkdtemp(join(tmpdir(), 'aetheria-class-experience-'));
  const previous = { sendPrompt: AIClient.prototype.sendPrompt, access: process.env.ACCESS_SECRET,
    imageProvider: process.env.IMAGE_PROVIDER, config: await db.get("SELECT value FROM server_settings WHERE key = 'ai_config'") };
  const campaigns = [];
  const providerCalls = [];
  const councilCalls = [];
  let failNextOutline = false;
  let failNextNarration = false;
  let browser;
  let listener;
  AIClient.prototype.sendPrompt = async ({ systemInstruction, prompt }) => {
    const stage = /^AETHERIA_COUNCIL:([a-z_]+)/u.exec(systemInstruction)?.[1];
    if (stage) {
      const data = JSON.parse(prompt);
      councilCalls.push(stage);
      const opposed = () => Object.entries(data.world.actors).filter(([ref, actor]) => ref.startsWith('npc:') && !actor.party).map(([ref]) => ref);
      const review = () => ({ approved: true, reason: 'The declared direct cast selects the visible opposing keeper.', affirmedOpposed: opposed(), consentingActors: [] });
      switch (stage) {
        case 'interaction': return JSON.stringify({ inputKind: 'committed_action', intent: data.playerInput, answer: null });
        case 'grounding': case 'pre_roll': return JSON.stringify(review());
        case 'referee': {
          const ability = data.declarations.find(value => value.name === 'Magic Missile');
          assert.ok(ability, 'The real composer declaration reaches the Referee');
          const wait = data.finalPlayerMainOfRound && data.world.encounterActive
            ? opposed().map(npc => ({ npc, wait: 'The keeper holds the courtyard position instead of crossing the gate.' })) : [];
          return JSON.stringify({ action: { kind: 'ability', abilityId: ability.abilityId, bindings: { targets: [opposed()[0]] }, options: {} },
            check: { actor: data.actor, callSeq: 1, intent: 'Strike the resisting keeper.', tier: 'standard', tierBasis: 'The alert keeper resists the direct spell.', deltas: [] },
            deltaSources: [], noCheckReason: null, npcTurns: { success: wait, failure: wait },
            encounter: { success: 'unchanged', failure: 'unchanged' }, award: null });
        }
        case 'annotation': return JSON.stringify({ text: 'The exchange is especially tense.', effects: [] });
        case 'annotation_review': return JSON.stringify({ approved: true, reason: 'The text adds no mechanical event.', affirmedOpposed: opposed() });
        case 'narration':
          if (failNextNarration) {
            failNextNarration = false;
            throw new Error('Narration interrupted after the durable check.');
          }
          return JSON.stringify({ narrative: checkSucceeded(data.check.band) ? 'The missile strikes the keeper.' : 'The keeper escapes the missile.' });
        default: throw new Error(`Unexpected Council phase: ${stage}`);
      }
    }
    if (prompt.startsWith('Draft an epic')) {
      providerCalls.push('outline');
      if (failNextOutline) {
        failNextOutline = false;
        throw new Error('Provider setup temporarily unavailable.');
      }
      return JSON.stringify({ title: 'The Open Gate', setting: 'A gatehouse and its courtyard.', acts: [],
        major_locations: [{ name: 'Gatehouse', description: 'Two connected areas.' }],
        key_npcs: [{ name: 'Keeper', role: 'Courtyard guard', personality: 'Watchful' }],
        starting_quest: { title: 'Cross the Gate', description: 'Reach the yard.' } });
    }
    if (systemInstruction.includes('persistent structured layout')) {
      providerCalls.push('layout');
      return JSON.stringify(testClassLayout);
    }
    if (systemInstruction.includes('initial Aetheria scene')) {
      providerCalls.push('scene');
      const supplied = JSON.parse(prompt);
      return JSON.stringify({ schemaVersion: 1,
        areas: testClassLayout.areas.map(area => ({ area: area.id, terrain: 'dry_ground',
          traits: ['visible', 'safe', 'visited', 'immediate_threat'], surfaces: ['ground'] })),
        actors: Object.keys(supplied.actors).map(actor => ({ actor, area: actor === 'player' ? 'gate' : 'yard', allegiance: actor === 'player' ? 'party' : 'opposition',
          profile: actor === 'player' ? null : 'combatant', conditions: [] })),
        items: [], objects: [], features: [], discoveries: [], encounter: { active: true, opposition: ['npc0'] } });
    }
    if (prompt.startsWith('Set the scene and begin')) {
      providerCalls.push('opening');
      return JSON.stringify({ narrative: 'The keeper guards the courtyard beyond the open gate.' });
    }
    throw new Error(`Unexpected provider phase: ${systemInstruction.slice(0, 100)}`);
  };
  try {
    process.env.ACCESS_SECRET = 'class-experience-browser-host';
    delete process.env.IMAGE_PROVIDER;
    await db.run(`INSERT INTO server_settings (key, value) VALUES ('ai_config', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value`, [JSON.stringify({ provider: 'ollama', model: 'test', imageProvider: '' })]);
    const expectedCatalog = getCatalogSummary({ genre: 'Fantasy', capabilities: { rider: true, alliedActors: true } });
    const roster = expectedCatalog.families.flatMap(family => family.branches.map(branch => ({ family, branch })));
    assert.equal(roster.length, 24);
    browser = await chromium.launch({ headless: true });
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      const label = viewport.width < 600 ? 'mobile' : 'desktop';
      // Independent viewport sessions also own independent production limiter history.
      const { app } = await import(`./server.js?class-experience-browser-${label}`);
      listener = await new Promise(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
      const origin = `http://127.0.0.1:${listener.address().port}`;
      const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
      await context.addInitScript(token => localStorage.setItem('aetheria_settings', JSON.stringify({ accessToken: token, voiceNarration: false })), process.env.ACCESS_SECRET);
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      const errors = [];
      const posts = [];
      const catalogs = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => {
        if (new URL(request.url()).pathname.startsWith('/api/') && request.method() === 'POST') {
          posts.push({ path: new URL(request.url()).pathname, body: request.postDataJSON() });
        }
      });
      page.on('response', response => {
        if (new URL(response.url()).pathname === '/api/class-catalog') catalogs.push(response);
      });
      // Fonts and other external assets may not hide missing local controls.
      await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      await page.goto(origin);
      await page.locator('#btn-new-campaign-trigger').click();
      await verifyLocalIcon(page, '#btn-close-wizard i');
      await page.locator('#input-genre').fill('Fantasy');
      const characterName = `Mira ${label}`;
      await page.locator('#input-char-name').fill(characterName);
      await selectBranch(page, 'arcanist', 'arcanist.formula');
      assert.equal(await page.locator('#class-family option[value="rider"]').isDisabled(), true);
      assert.equal(await page.locator('#class-family option[value="catalyst"]').isDisabled(), true);
      await page.locator('#input-class-rider').check();
      await page.locator('#input-class-allies').check();
      await page.waitForFunction(() => !document.querySelector('#class-family option[value="catalyst"]').disabled);
      const allCatalog = await catalogs.at(-1).json();
      assert.deepEqual(allCatalog, expectedCatalog, 'The UI receives the real authored catalog');
      assert.equal(await page.locator('#class-family option').count(), expectedCatalog.families.length + 1);
      let longest = roster[0];
      for (const entry of roster) {
        const { family, branch } = entry;
        await selectBranch(page, family.id, branch.id);
        assert.equal(await page.locator('.class-preview h3').textContent(), branch.classLabel || branch.name);
        assert.equal(await page.locator('.class-description').textContent(), branch.description || branch.summary);
        const grants = page.locator('.class-starting-abilities li');
        assert.equal(await grants.count(), branch.starterAbilities.length);
        for (const [index, ability] of branch.starterAbilities.entries()) {
          assert.equal(await grants.nth(index).locator('strong').textContent(), ability.name);
          assert.equal(await grants.nth(index).locator('p').textContent(), ability.description);
          const activation = ability.activation === 'passive' ? 'Passive' : ability.activation === 'ritual' ? 'Ritual' : 'Action';
          assert.equal(await grants.nth(index).locator('.class-grant-cost').textContent(), [activation, ability.costLabel].filter(Boolean).join(' / '));
        }
        assert.equal(await page.locator('.class-preview input').count(), 0, 'Grants do not require per-ability selection');
        await assertFits(page, '.class-preview, .class-description, .class-grant-heading, .class-grant-cost, .class-starting-abilities p');
        if (branch.starterAbilities.some(ability => ability.description.length > Math.max(...longest.branch.starterAbilities.map(item => item.description.length)))) longest = entry;
      }
      await selectBranch(page, longest.family.id, longest.branch.id);
      await page.locator('.class-preview').evaluate(node => node.scrollIntoView({ block: 'start' }));
      await page.screenshot({ path: join(artifacts, `roster-long-help-${label}.png`) });
      await page.locator('#input-class-rider').uncheck();
      await page.locator('#input-class-allies').uncheck();
      await page.waitForFunction(() => document.querySelector('#class-family option[value="catalyst"]').disabled);
      await selectBranch(page, 'arcanist', 'arcanist.formula');
      await page.locator('#btn-close-wizard').click();
      await page.locator('#btn-new-campaign-trigger').click();
      await page.waitForFunction(() => document.querySelector('#class-branch').value === 'arcanist.formula');
      assert.equal(await page.locator('#input-char-name').inputValue(), characterName, 'Closing preserves the unsent draft');
      assert.equal(await page.locator('#input-char-concept').inputValue(), '', 'Presentation concept is optional');
      await page.locator('.class-preview').evaluate(node => node.scrollIntoView({ block: 'start' }));
      await page.screenshot({ path: join(artifacts, `creator-${label}.png`) });
      const beforeFailure = (await db.get('SELECT COUNT(*) AS n FROM campaigns')).n;
      failNextOutline = true;
      const failedResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/campaigns' && response.request().method() === 'POST');
      await page.locator('#btn-submit-wizard').click();
      assert.equal((await failedResponse).status(), 500);
      await page.locator('#class-creation-error').waitFor({ state: 'visible' });
      assert.equal((await db.get('SELECT COUNT(*) AS n FROM campaigns')).n, beforeFailure, 'Failed provider setup creates no campaign');
      assert.equal(await page.locator('#input-char-name').inputValue(), characterName);
      assert.equal(await page.locator('#class-branch').inputValue(), 'arcanist.formula', 'Provider errors retain the chosen class');
      const createdResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/campaigns' && response.request().method() === 'POST');
      await page.locator('#btn-submit-wizard').click();
      const response = await createdResponse;
      assert.equal(response.status(), 200, await response.text());
      const state = await response.json();
      campaigns.push(state.campaignId);
      await page.locator('#main-game-screen').waitFor({ state: 'visible' });
      assert.equal(posts.length, 2);
      assert.deepEqual(posts[1].body.classSelection, { catalogVersion: expectedCatalog.catalogVersion, optionSet: 'expert', familyId: 'arcanist',
        branchId: 'arcanist.formula', modules: [], capabilities: { alliedActors: false } });
      assert.equal(posts[1].body.ruleset, 'aetheria');
      assert.equal(posts[1].body.rulesMode, true);
      assert.equal(posts[1].body.characterClass, '');
      const persisted = await getCampaignState(state.campaignId);
      assert.deepEqual(persisted.character.classBuild, state.character.classBuild);
      assert.deepEqual(persisted.character.inventory, state.character.inventory);
      assert.deepEqual(persisted.character.skills, state.character.skills);
      assert.equal(await page.locator('#char-name').textContent(), characterName);
      assert.equal(await page.locator('#char-class').textContent(), state.character.class);
      assert.equal(await page.locator('#char-abilities .ability-source').count(), 0, 'Authored class cards do not expose internal branch IDs');
      const headerGeometry = await page.locator('.character-header').evaluate(header => {
        const range = document.createRange();
        range.selectNodeContents(header.querySelector('#char-name'));
        const text = range.getBoundingClientRect();
        const level = header.querySelector('.char-level-badge').getBoundingClientRect();
        return { textRight: text.right, levelLeft: level.left, textBottom: text.bottom, levelTop: level.top };
      });
      assert.ok(headerGeometry.textRight + 4 <= headerGeometry.levelLeft || headerGeometry.textBottom <= headerGeometry.levelTop,
        `Character name and level badge need separation: ${JSON.stringify(headerGeometry)}`);
      assert.deepEqual(await page.locator('.inventory-item-name').allTextContents(), state.character.inventory.map(item => item.name));
      assert.ok(state.character.inventory.length > 0, 'Actual starting equipment is present');
      await page.locator('.class-skills summary').click();
      assert.deepEqual(await page.locator('.class-skills dt').allTextContents(), Object.keys(state.character.skills)
        .map(skill => skill.replaceAll('_', ' ').replace(/^./u, letter => letter.toUpperCase())));
      assert.deepEqual(await page.locator('.class-skills dd').allTextContents(), Object.values(state.character.skills)
        .map(value => `${value >= 0 ? '+' : ''}${value}`));
      assert.equal(await page.locator('#mana-text').evaluate(node => getComputedStyle(node.closest('.stat-bar-group')).display), 'none');
      assert.equal(await page.locator('#char-attributes').isVisible(), false);
      await assertFits(page, '#class-runtime-details, .inventory-item-name');
      await page.locator('[data-spotlight="character"]').click();
      await page.locator('#char-name').scrollIntoViewIfNeeded();
      await page.screenshot({ path: join(artifacts, `sheet-${label}.png`) });
      await page.keyboard.press('Escape');
      await page.locator('[data-spotlight="tabs"]').click();
      await page.locator('#tab-inventory-btn').click();
      await page.locator('.inventory-item-name').first().scrollIntoViewIfNeeded();
      await page.screenshot({ path: join(artifacts, `equipment-${label}.png`) });
      await page.keyboard.press('Escape');
      const missile = state.character.invocableAbilities.find(ability => ability.name === 'Magic Missile');
      assert.ok(missile, 'Canonical Magic Missile is immediately invocable');
      const input = page.locator('#action-input');
      await input.fill(' at the keeper');
      await input.evaluate(node => { node.focus(); node.setSelectionRange(0, 0); node.dispatchEvent(new Event('select')); });
      if (label === 'mobile') {
        await verifyLocalIcon(page, '#btn-open-abilities i');
        await page.locator('#btn-open-abilities').click();
        assert.equal(await page.locator('#ability-drawer #char-abilities').count(), 1);
      }
      assert.equal(await page.locator('#char-abilities').count(), 1, 'Mobile and desktop use the same insertion list');
      const button = page.locator('.ability-button').filter({ hasText: 'Magic Missile' });
      assert.equal(await button.count(), 1, 'An owned grant is not duplicated by its catalog definition');
      await button.scrollIntoViewIfNeeded();
      await assertFits(page, '.ability-button');
      await page.screenshot({ path: join(artifacts, `abilities-${label}.png`) });
      await button.click();
      assert.equal(await input.inputValue(), `${missile.trigger} at the keeper`);
      assert.equal(await input.evaluate(node => document.activeElement === node), true);
      assert.equal(await page.locator('textarea:visible').count(), 1, 'The action remains one prose input');
      assert.equal(posts.filter(post => post.path.endsWith('/turn')).length, 0, 'Insertion does not silently execute a turn');
      assert.equal((await db.get('SELECT COUNT(*) AS n FROM turns WHERE campaign_id = ?', [state.campaignId])).n, 1);
      await page.screenshot({ path: join(artifacts, `inserted-${label}.png`) });
      const before = await db.get('SELECT rules_state_json, rules_revision FROM campaigns WHERE id = ?', [state.campaignId]);
      const beforeWorld = JSON.parse(before.rules_state_json);
      const foeRef = Object.keys(beforeWorld.actors).find(ref => ref.startsWith('npc:'));
      const responseForTurn = () => page.waitForResponse(value => new URL(value.url()).pathname === `/api/campaigns/${state.campaignId}/turn`);
      failNextNarration = true;
      const interrupted = responseForTurn();
      await page.locator('#btn-send-action').click();
      assert.equal((await interrupted).status(), 500);
      await page.waitForFunction(() => !document.querySelector('#action-input').disabled);
      const turnPosts = () => posts.filter(post => post.path.endsWith('/turn'));
      const exactRequest = turnPosts()[0].body;
      const operation = await db.get("SELECT * FROM rules_turn_operations WHERE campaign_id = ? AND status = 'active'", [state.campaignId]);
      assert.equal(operation.request_id, exactRequest.requestId);
      assert.equal(operation.stage, 'resolved');
      const checkRow = await db.get('SELECT * FROM rules_checks WHERE operation_id = ?', [operation.id]);
      const signed = normalizeCheckRecord(JSON.parse(checkRow.record_json));
      assert.ok(signed.raw >= 1 && signed.raw <= 100, 'The live engine owns the real random roll');
      assert.equal((await db.get('SELECT rules_state_json FROM campaigns WHERE id = ?', [state.campaignId])).rules_state_json, before.rules_state_json,
        'A narration failure does not partially apply the prepared action');
      await page.reload();
      await page.locator('.campaign-card').filter({ hasText: characterName }).click();
      await page.locator('#main-game-screen').waitFor({ state: 'visible' });
      assert.equal(await input.inputValue(), exactRequest.playerAction, 'Real pending action reload restores its exact submitted prose');
      assert.equal(await input.getAttribute('readonly'), '');
      await page.screenshot({ path: join(artifacts, `pending-${label}.png`) });
      const callsBeforeRetry = councilCalls.length;
      const resumed = responseForTurn();
      await page.locator('#btn-send-action').click();
      const settledResponse = await resumed;
      assert.equal(settledResponse.status(), 200, await settledResponse.text());
      const settled = await settledResponse.json();
      await page.waitForFunction(() => !document.querySelector('#action-input').disabled);
      assert.deepEqual(turnPosts()[1].body, exactRequest, 'The real HTTP retry preserves UUID, prose, actor and original revision');
      assert.deepEqual(councilCalls.slice(callsBeforeRetry), ['narration'], 'Reload resumes after the saved check without reruling or rerolling');
      assert.equal(settled.settledRequestId, exactRequest.requestId);
      assert.equal(settled.turn.requestId, exactRequest.requestId);
      assert.equal(settled.pendingAction, null);
      assert.equal(settled.turn.rollResults[0].checkId, signed.checkId);
      assert.equal(settled.turn.rollResults[0].raw, signed.raw);
      const after = await db.get('SELECT rules_state_json, rules_revision FROM campaigns WHERE id = ?', [state.campaignId]);
      assert.equal(after.rules_revision, before.rules_revision + 1);
      assert.equal(JSON.parse(after.rules_state_json).actors[foeRef].health, beforeWorld.actors[foeRef].health - (checkSucceeded(signed.band) ? 5 : 0));
      assert.equal((await db.get('SELECT COUNT(*) AS n FROM rules_checks WHERE campaign_id = ?', [state.campaignId])).n, 1);
      assert.equal((await db.get('SELECT COUNT(*) AS n FROM turns WHERE campaign_id = ?', [state.campaignId])).n, 2);
      const committed = await db.get('SELECT * FROM turns WHERE campaign_id = ? AND turn_number = 2', [state.campaignId]);
      assert.equal(JSON.parse(committed.ability_invocations_json).abilities[0].ability_id, missile.abilityId);
      assert.equal(JSON.parse(committed.state_changes_json).dice_rolls[0].checkId, signed.checkId);
      assert.equal(await input.inputValue(), '');
      assert.equal(await input.getAttribute('readonly'), null);
      await page.locator('.log-roll').waitFor({ state: 'visible' });
      assert.equal(await page.locator('.log-roll').count(), 1);
      assert.equal(await page.locator('.roll-calculation').textContent(), `D100 CHECK: Roll ${signed.raw} vs target ${signed.T}`);
      await verifyLocalIcon(page, '.log-roll .fa-dice');
      await assertFits(page, '.roll-calculation, .roll-details, .log-roll');
      await page.waitForTimeout(450);
      const latestNarrative = page.locator('.log-gm .content').last();
      assert.equal((await latestNarrative.innerText()).trim(), settled.turn.narrative);
      const outcomeGeometry = await latestNarrative.evaluate(node => {
        const range = document.createRange();
        range.selectNodeContents(node);
        const text = range.getBoundingClientRect();
        const viewport = document.querySelector('#narrative-container').getBoundingClientRect();
        const composer = document.querySelector('.input-area').getBoundingClientRect();
        return { top: text.top, bottom: text.bottom, left: text.left, right: text.right,
          viewportTop: viewport.top, viewportBottom: viewport.bottom, viewportLeft: viewport.left, viewportRight: viewport.right, composerTop: composer.top };
      });
      assert.ok(outcomeGeometry.top >= outcomeGeometry.viewportTop && outcomeGeometry.bottom <= outcomeGeometry.viewportBottom
        && outcomeGeometry.bottom <= outcomeGeometry.composerTop && outcomeGeometry.left >= outcomeGeometry.viewportLeft
        && outcomeGeometry.right <= outcomeGeometry.viewportRight,
      `The full latest outcome remains visible above the composer: ${JSON.stringify(outcomeGeometry)}`);
      await page.screenshot({ path: join(artifacts, `cast-${label}.png`) });
      await page.locator('#tab-journal-btn').click();
      await page.locator('.timeline-roll-badge').waitFor({ state: 'visible' });
      assert.equal(await page.locator('.timeline-roll-badge').count(), 1, 'The actual journal contains the same single committed check');
      await page.screenshot({ path: join(artifacts, `history-${label}.png`) });
      assert.deepEqual(errors, []);
      if (afterCreation) await afterCreation({ page, state: settled, origin, db, viewport });
      await context.close();
      await new Promise(resolve => listener.close(resolve));
      listener = null;
    }
    assert.deepEqual(providerCalls, Array.from({ length: 2 }, () => ['outline', 'outline', 'opening', 'layout', 'scene']).flat());
    console.log(`Real class creator browser checks passed: all 24 branch previews at desktop/mobile, HTTP/catalog/DB creation, equipment/skills, Magic Missile cast, durable-check failure/reload/exact retry and history. Provider boundary stub only; real RNG, no player validation. Screenshots: ${artifacts}`);
    return { campaigns: campaigns.length, branches: roster.length, viewports: 2, artifacts };
  } finally {
    if (browser) await browser.close();
    if (listener) await new Promise(resolve => listener.close(resolve));
    AIClient.prototype.sendPrompt = previous.sendPrompt;
    if (previous.access === undefined) delete process.env.ACCESS_SECRET; else process.env.ACCESS_SECRET = previous.access;
    if (previous.imageProvider === undefined) delete process.env.IMAGE_PROVIDER; else process.env.IMAGE_PROVIDER = previous.imageProvider;
    if (previous.config) await db.run("UPDATE server_settings SET value = ? WHERE key = 'ai_config'", [previous.config.value]);
    else await db.run("DELETE FROM server_settings WHERE key = 'ai_config'");
    for (const campaignId of campaigns) {
      const profiles = await db.all('SELECT player_character_id FROM characters WHERE campaign_id = ?', [campaignId]);
      await db.run('DELETE FROM campaigns WHERE id = ?', [campaignId]);
      for (const profile of profiles) await db.run('DELETE FROM player_characters WHERE id = ?', [profile.player_character_id]);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const directory = await mkdtemp(join(tmpdir(), 'aetheria-class-experience-db-'));
  process.env.RPG_DB_PATH = join(directory, 'test.db');
  const db = await import('./db.js');
  try {
    await db.initDb();
    await runClassExperienceBrowserTests();
  } finally {
    await db.closeDb();
    await rm(directory, { recursive: true, force: true });
  }
}
