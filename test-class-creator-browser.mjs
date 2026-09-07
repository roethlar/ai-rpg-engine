// UI contract checks use deterministic API responses. Real creation and effects
// need the separate integrated server suite; this test never calls a provider.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { verifyLocalIcon } from './test-browser-icons.mjs';
import { CLASS_FAMILIES, getAbilityDefinition } from './class-catalog.js';
import { createClassSheet, createRulesWorld, addClassActor, projectClassCharacter, classTriggerOptions } from './class-state.js';
import { buildCharacterAbilityTriggerState } from './ability-trigger-state.js';
import { testSelection, testClassLayout } from './test-class-state.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const artifacts = await fs.mkdtemp(path.join(os.tmpdir(), 'aetheria-class-creator-'));
const server = http.createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
  const filename = path.resolve(root, 'public', relative);
  if (!filename.startsWith(path.join(root, 'public') + path.sep)) {
    response.writeHead(403).end();
    return;
  }
  try {
    const bytes = await fs.readFile(filename);
    const type = filename.endsWith('.js') ? 'text/javascript'
      : filename.endsWith('.css') ? 'text/css'
        : filename.endsWith('.woff2') ? 'font/woff2' : 'text/html';
    response.writeHead(200, { 'Content-Type': type }).end(bytes);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const grant = (name, activation = 'main') => ({
  definitionId: `spell.${name.toLowerCase().replaceAll(' ', '-')}`,
  name, activation, description: `A direct ${name.toLowerCase()} with a distinct consequence.`,
  costLabel: activation === 'passive' ? '' : '1 focus', cadence: { kind: 'none' }
});
const catalog = {
  catalogVersion: 'test-catalog-v1', optionSet: 'expert',
  families: [
    { id: 'arcanist', name: 'Arcanist', available: true, complexity: 'moderate',
      description: 'Choose spells with different effects.', branches: [
        { id: 'arcanist.evoker', name: 'Evoker', complexity: 'moderate',
          summary: 'Direct magic changes the immediate situation.',
          starterAbilities: [grant('Magic Missile'), grant('Fireball'), grant('Arcane Sight', 'passive')],
          progression: [{ level: 3, grants: [{ name: 'Dispel Magic' }] }] },
        { id: 'arcanist.ritualist', name: 'Ritualist', complexity: 'high',
          summary: 'Exceptional magic rewards preparation.', starterAbilities: [grant('Binding Circle', 'ritual')] }
      ] },
    { id: 'opportunist', name: 'Opportunist', available: true, branches: [
      { id: 'opportunist.scout', name: 'Scout', complexity: 'low', summary: 'Find a useful opening.', starterAbilities: [grant('Exploit Opening')] }
    ] },
    { id: 'rider', name: 'Rider', available: false, unavailableReason: 'Requires mounts or vehicles.',
      branches: [{ id: 'rider.mounted', name: 'Mounted Rider', starterAbilities: [grant('Ride Through')] }] }
  ]
};
const invocable = {
  abilityId: 'owned-missile', definitionId: 'arcanist.magic-missile', definitionVersion: 1,
  name: 'Magic Missile', trigger: 'Magic Missile', aliases: [], familyKey: 'magic',
  familyLabel: 'Magic', help: 'Strike one visible target with force.'
};
function character(id, name) {
  const abilityId = id === 1 ? invocable.abilityId : 'owned-second';
  return { id, name, class: 'Evoker', level: 1, health: 20, max_health: 20,
    mana: 0, max_mana: 0, xp: 0, inventory: [],
    attributes: { strength: 10, agility: 10, intellect: 14, willpower: 12 },
    skills: { melee: 0, magic: 13 }, resources: { strain: { current: 1, maximum: 3 } },
    classState: { prepared: [invocable.definitionId] },
    abilities: [{ id: abilityId, definition_id: invocable.definitionId,
      name: invocable.name, description: invocable.help }],
    player_character_id: id + 100, abilityTriggerRevision: `ak1:${'a'.repeat(64)}`,
    invocableAbilities: [{ ...invocable, abilityId }] };
}
function campaign() {
  const player = character(1, 'Mira');
  return { campaignId: 7, title: 'The Broken Crossing', genre: 'Fantasy',
    character: player, party: [player], joinedCharacterId: 1, currentAct: 1,
    currentQuest: { active_quest: 'Keep the crossing open', quest_description: 'Reach the far bank.' },
    outline: { acts: [] }, npcs: [],
    ruleset: { id: 'aetheria', catalogVersion: catalog.catalogVersion, optionSet: 'expert',
      modules: [], capabilities: { alliedActors: false }, name: 'Aetheria', abilities: [] },
    tableStyle: null, turnOrder: { actingCharacterId: 1, order: [{ id: 1, name: 'Mira' }] },
    turn: { number: 1, playerAction: null, narrative: 'The river has broken the crossing.',
      sceneGrounding: 'A narrow bridge spans the river.', suggestedChoices: [], svg: '', rollResults: [] } };
}

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const errors = [];
  const posts = [];
  const turns = [];
  const unexpected = [];
  let catalogMode = 'ok';
  let createFails = true;
  let state = campaign();
  let hasCampaign = false;
  let releaseOld;
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const send = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.origin !== origin) return route.abort();
    if (url.pathname === '/api/class-catalog') {
      if (url.searchParams.get('genre') === 'Old request') {
        await new Promise(resolve => { releaseOld = resolve; });
        return send({ ...catalog, families: [] });
      }
      if (catalogMode === 'error') return send({ error: 'Catalog offline' }, 503);
      if (catalogMode === 'empty') return send({ ...catalog, families: [] });
      if (catalogMode === 'malformed') return send({ ...catalog, families: [{ id: 'invalid' }] });
      const result = structuredClone(catalog);
      result.families[2].available = url.searchParams.get('modules') === 'rider';
      return send(result);
    }
    if (url.pathname === '/api/characters') return send([
      { id: 91, name: 'Legacy Ada', archetype: 'Scout', status: 'available', level: 2, health: 10, max_health: 10, mana: 0, max_mana: 0, xp: 100, abilities: [] },
      { id: 92, name: 'Saved Mira', archetype: 'Wizard', status: 'available', level: 2, health: 24, max_health: 24, mana: 0, max_mana: 0, xp: 100,
        classBuild: createClassSheet(testSelection(), { name: 'Saved Mira' }).classBuild, abilities: [{ name: 'Magic Missile' }, { name: 'Fireball' }] }
    ]);
    if (url.pathname === '/api/campaigns' && request.method() === 'GET') return send(hasCampaign ? [{ id: 7, title: state.title, genre: state.genre, summary: 'The crossing waits.' }] : []);
    if (url.pathname === '/api/campaigns' && request.method() === 'POST') {
      posts.push(request.postDataJSON());
      if (createFails) return send({ error: 'Creation paused. Try again.' }, 503);
      hasCampaign = true;
      return send(state);
    }
    if (url.pathname === '/api/campaigns/7/join') {
      const body = request.postDataJSON();
      posts.push(body);
      const joined = character(2, body.characterName);
      state.party.push(joined);
      state.joinedCharacterId = 2;
      state.turnOrder.order.push({ id: 2, name: joined.name });
      return send(state);
    }
    if (url.pathname === '/api/campaigns/7/turn') {
      const body = request.postDataJSON();
      turns.push(body);
      state.turn = { ...state.turn, number: state.turn.number + 1, playerAction: body.playerAction,
        narrative: 'The bolt breaks the obstruction.', rollResults: [
          { sides: 100, raw: 62, T: 45, band: 'clean_success', intent: 'Break the obstruction' },
          { roll: 14, modifier: 2, total: 16, dc: 12, attribute: 'intellect', success: true }
        ] };
      return send(state);
    }
    if (url.pathname === '/api/campaigns/7') return send(state);
    if (url.pathname === '/api/campaigns/7/journal') return send({ turns: [{
      turn_number: state.turn.number, player_action: state.turn.playerAction,
      narrative: state.turn.narrative, created_at: '2026-09-07T12:00:00Z',
      state_changes_json: JSON.stringify({ dice_rolls: state.turn.rollResults })
    }], memories: [] });
    if (url.pathname.startsWith('/api/')) {
      unexpected.push(`${request.method()} ${url.pathname}`);
      return send({ error: 'Unexpected route' }, 404);
    }
    return route.continue();
  });

  await page.goto(origin);
  await page.locator('#btn-new-campaign-trigger').click();
  await verifyLocalIcon(page, '#btn-close-wizard i');
  await page.locator('#input-genre').fill('Fantasy');
  await page.locator('#input-char-name').fill('Mira');
  await page.locator('#class-family').selectOption('arcanist');
  assert.equal(await page.locator('#btn-submit-wizard').isDisabled(), true, 'An unselected branch cannot create a character');
  await page.locator('#class-branch').selectOption('arcanist.evoker');
  assert.match(await page.locator('.class-preview').innerText(), /Magic Missile/);
  assert.match(await page.locator('.class-preview').innerText(), /Fireball/);
  assert.equal(await page.locator('.class-preview input').count(), 0, 'Starting grants require no per-ability sorting');
  assert.equal(await page.locator('#class-family option[value="rider"]').isDisabled(), true);
  await page.screenshot({ path: path.join(artifacts, 'creator-desktop.png') });
  await page.locator('#btn-submit-wizard').click();
  await page.locator('#class-creation-error').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#input-char-name').inputValue(), 'Mira');
  assert.equal(await page.locator('#class-branch').inputValue(), 'arcanist.evoker');
  assert.deepEqual(posts[0].classSelection, { catalogVersion: catalog.catalogVersion, optionSet: 'expert',
    familyId: 'arcanist', branchId: 'arcanist.evoker', modules: [], capabilities: { alliedActors: false } });
  assert.equal(posts[0].ruleset, 'aetheria');
  assert.equal(posts[0].rulesMode, true);
  assert.equal(posts[0].characterClass, '', 'Concept is optional presentation');
  await page.locator('#btn-close-wizard').click();
  await page.locator('#btn-new-campaign-trigger').click();
  await page.locator('#class-branch').selectOption('arcanist.evoker');
  assert.equal(await page.locator('#input-char-name').inputValue(), 'Mira', 'Closing preserves the unsent draft');

  catalogMode = 'empty';
  await page.locator('#input-genre').fill('No classes');
  await page.waitForFunction(() => document.querySelector('.class-catalog-status').textContent.includes('No classes'));
  assert.equal(await page.locator('#btn-submit-wizard').isDisabled(), true);
  catalogMode = 'error';
  await page.locator('.class-catalog-retry').click();
  await page.waitForFunction(() => document.querySelector('.class-catalog-status').textContent === 'Catalog offline');
  assert.equal(await page.locator('#input-char-name').inputValue(), 'Mira');
  catalogMode = 'malformed';
  await page.locator('.class-catalog-retry').click();
  await page.waitForFunction(() => document.querySelector('.class-catalog-status').textContent.includes('could not be read'));
  assert.equal(await page.locator('#btn-submit-wizard').isDisabled(), true);
  catalogMode = 'ok';
  await page.locator('.class-catalog-retry').click();
  await page.locator('#class-family').selectOption('opportunist');
  assert.equal(await page.locator('#class-branch').inputValue(), 'opportunist.scout', 'A single branch is automatic');
  assert.equal(await page.locator('#class-branch').isVisible(), false);
  await page.locator('#input-genre').fill('Old request');
  const oldRequestDeadline = Date.now() + 8000;
  while (!releaseOld && Date.now() < oldRequestDeadline) await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(typeof releaseOld, 'function', 'The delayed request reached the catalog route');
  await page.locator('#input-genre').fill('Fantasy');
  await page.locator('#class-family').selectOption('arcanist');
  await page.locator('#class-branch').selectOption('arcanist.evoker');
  releaseOld();
  await page.waitForTimeout(100);
  assert.equal(await page.locator('#class-branch').inputValue(), 'arcanist.evoker', 'An old catalog response cannot erase the current choice');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#class-branch').scrollIntoViewIfNeeded();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: path.join(artifacts, 'creator-mobile.png') });
  await page.locator('.class-preview').evaluate(node => node.scrollIntoView({ block: 'start' }));
  assert.equal(await page.locator('.class-starting-abilities li').first().evaluate(node => {
    const box = node.getBoundingClientRect();
    return node.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
  }), true, 'Starting grants are reachable without sticky-control occlusion');
  await page.screenshot({ path: path.join(artifacts, 'creator-kit-mobile.png') });
  createFails = false;
  await page.locator('#btn-submit-wizard').click();
  await page.locator('#main-game-screen').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#mana-text').evaluate(node => getComputedStyle(node.closest('.stat-bar-group')).display), 'none');
  assert.equal(await page.locator('#char-attributes').evaluate(node => getComputedStyle(node).display), 'none');
  assert.match(await page.locator('#class-runtime-details').textContent(), /Strain1\/3PreparedMagic MissileSkillsMelee\+0Magic\+13/);
  assert.doesNotMatch(await page.locator('#class-runtime-details').textContent(), /undefined|arcanist\./);
  const maker = { skills: { craft: 13 }, classState: {
    installationCapacity: 4, installations: [
      { id: 'citadel-active', kind: 'citadel', status: 'active', slots: 2 },
      { id: 'relay-active', kind: 'relay', status: 'active', slots: 1 },
      { id: 'snare-retired', kind: 'snare', status: 'retired', slots: 1 },
      { id: 'bulwark-destroyed', kind: 'bulwark', status: 'destroyed', slots: 1 }
    ]
  } };
  const originalClassState = state.character.classState;
  const refreshSheet = async (classState, expectedText) => {
    state.character.classState = classState;
    await page.locator('#btn-show-campaigns').click();
    await page.locator('.campaign-card').first().click();
    await page.locator('#main-game-screen').waitFor({ state: 'visible' });
    await page.waitForFunction(text => document.querySelector('#class-runtime-details').textContent.includes(text), expectedText);
  };
  await refreshSheet(maker.classState, 'Installation slots3/4');
  assert.match(await page.locator('#class-runtime-details').textContent(), /Installation slots3\/4/,
    'Only active installations occupy capacity, using authored slot weights');
  maker.classState.installations.forEach(installation => { installation.status = 'retired'; });
  await refreshSheet(maker.classState, 'Installation slots0/4');
  assert.match(await page.locator('#class-runtime-details').textContent(), /Installation slots0\/4/,
    'Retired installation history does not consume capacity');
  await refreshSheet(originalClassState, 'PreparedMagic Missile');
  const input = page.locator('#action-input');
  await input.fill(' at the obstruction');
  await input.evaluate(node => { node.focus(); node.setSelectionRange(0, 0); node.dispatchEvent(new Event('select')); });
  await page.locator('#btn-open-abilities').click();
  assert.equal(await page.locator('#char-abilities').count(), 1, 'The drawer moves the original list rather than cloning a picker');
  assert.equal(await page.locator('#ability-drawer #char-abilities').count(), 1);
  await page.screenshot({ path: path.join(artifacts, 'abilities-mobile.png') });
  await page.locator('#ability-drawer .ability-button').first().click();
  assert.equal(await page.locator('#ability-drawer').isVisible(), false);
  assert.equal(await input.evaluate(node => document.activeElement === node), true, 'Ability insertion returns to the same prose input');
  assert.equal(await input.inputValue(), 'Magic Missile at the obstruction');
  assert.equal(await page.locator('textarea').count(), 1);
  await page.locator('#btn-send-action').click();
  await page.locator('.log-roll').first().waitFor();
  assert.equal(turns[0].playerAction, 'Magic Missile at the obstruction');
  assert.equal('abilityIds' in turns[0], false);
  const rollText = await page.locator('.log-roll').allTextContents();
  assert.match(rollText[0], /D100 CHECK:.*62.*45/s);
  assert.match(rollText[0], /Clean success/);
  assert.doesNotMatch(rollText[0], /undefined|DC/);
  assert.match(rollText[1], /16.*DC 12/s);
  await page.screenshot({ path: path.join(artifacts, 'play-mobile.png') });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => window.queueRollTheater([{ sides: 100, raw: 62, T: 45, band: 'clean_success' }]));
  await page.locator('.dice-result.shown').waitFor();
  assert.equal(await page.locator('.dice-number').textContent(), '62');
  assert.equal(await page.locator('.dice-math').textContent(), 'Roll 62 vs target 45');
  assert.equal(await page.locator('.dice-verdict.success').textContent(), 'Clean success');
  await verifyLocalIcon(page, '.percentile-die');
  await page.screenshot({ path: path.join(artifacts, 'd100-mobile.png') });
  await page.locator('#dice-overlay').click();
  await page.emulateMedia({ reducedMotion: 'reduce' });

  await page.locator('#party-join-btn').click();
  await page.locator('#input-char-name').fill('Jon');
  await page.locator('#class-family').selectOption('opportunist');
  await page.locator('#btn-submit-wizard').click();
  await page.waitForFunction(() => document.querySelector('#char-name').textContent === 'Jon');
  assert.equal(posts.at(-1).classSelection.branchId, 'opportunist.scout');
  assert.equal(await page.locator('.log-gm').count(), 2, 'Joining does not repeat the head narrative');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.locator('.class-skills summary').click();
  await page.screenshot({ path: path.join(artifacts, 'character-desktop.png') });
  await page.locator('#tab-journal-btn').click();
  await page.locator('.timeline-roll-badge').first().waitFor();
  assert.match(await page.locator('.timeline-roll-badge.success').first().textContent(), /d100: 62 vs target 45 \/ Clean success/);
  assert.match(await page.locator('.timeline-roll-badge').last().textContent(), /16 vs DC 12/);
  for (const family of CLASS_FAMILIES) for (const branch of family.branches) {
    const sheet = { ...createClassSheet(testSelection(family.id, branch.id), { name: 'Runtime class fixture', level: 10 }), id: 1, player_character_id: 101 };
    const world = createRulesWorld({ location: { id: 4, layout: testClassLayout }, npcs: [{ id: 90, name: 'Keeper' }] });
    addClassActor(world, sheet, { companionActorRef: 'npc:91' });
    const actor = world.actors['character:1'];
    const cs = actor.classState;
    const active = sheet.abilities.filter(ability => getAbilityDefinition(ability.definition_id).activation !== 'passive');
    const ritual = active.find(ability => getAbilityDefinition(ability.definition_id).activation === 'ritual');
    actor.conditions.pinned = { actor: 'character:1', condition: 'pinned', class: 'hindrance', duration: 'persistent', detail: 'Pinned at the gate.', source: 'fixture', appliedTurn: 1 };
    for (const ability of active) {
      const definition = getAbilityDefinition(ability.definition_id);
      const key = definition.cadence.kind === 'scene_use' ? 'sceneUses' : definition.cadence.kind === 'recovery_use' ? 'recoveryUses' : null;
      if (key) cs[key][definition.id] = definition.cadence.uses;
    }
    if (family.id === 'arcanist' && ritual) cs.ritual = { abilityId: ritual.id, definitionId: ritual.definition_id,
      completed: 1, required: getAbilityDefinition(ritual.definition_id).mechanic.steps, identity: 'a'.repeat(64), bindings: { private: 'HIDDEN_WORKING' } };
    if (family.id === 'armsmaster') cs.quarry = { target: 'npc:90' };
    if (family.id === 'berserker') { cs.reprisal = 1; cs.endure = { remaining: 1, refuseDefeat: true }; }
    if (family.id === 'opportunist') cs.opening = { target: 'npc:90' };
    if (family.id === 'oathbound') cs.declaration = { binding: 'ward', target: 'npc:90', guard: { remaining: 1 } };
    if (family.id === 'catalyst') cs.cue = { ally: 'npc:90', sourceAbilityId: active[0].id };
    if (family.id === 'maker') cs.installations = [{ id: 'installation:old', status: 'retired', slots: 1 }, { id: 'installation:current', status: 'active', slots: 2 }];
    const own = projectClassCharacter(sheet, world);
    Object.assign(own, buildCharacterAbilityTriggerState({ campaignId: 7, character: own, bindings: sheet.bindings, ...classTriggerOptions(own) }));
    state.character = own;
    state.party = [own];
    state.joinedCharacterId = own.id;
    await page.locator('#btn-show-campaigns').click();
    await page.locator('.campaign-card').first().click();
    await page.waitForFunction(name => document.querySelector('#char-class').textContent === name, own.class);
    assert.match(await page.locator('#class-runtime-details').textContent(), /Pinned \(persistent\)/);
    assert.doesNotMatch(await page.locator('#class-runtime-details').textContent(), /HIDDEN_WORKING|a{64}|npc:|installation:|\.formula/);
    if (ritual) assert.match(await page.locator('#class-runtime-details').textContent(), new RegExp(`Working${ritual.name} / 1/`));
    if (family.id === 'berserker') assert.match(await page.locator('#class-runtime-details').textContent(), /Reprisal1\/1EndureActive \/ Refuse Defeat armed/);
    if (['armsmaster', 'opportunist', 'oathbound', 'catalyst'].includes(family.id)) assert.match(await page.locator('#class-runtime-details').textContent(), /Keeper/);
    for (const ability of active) {
      const card = page.locator(`.ability-button[data-ability-id="${ability.id}"]`);
      assert.equal(await card.locator('.ability-desc').first().textContent(), ability.description);
      const status = own.abilityStatus.find(value => value.abilityId === ability.id);
      if (status.cadence.maximum) assert.match(await card.locator('.ability-usage').textContent(), /0\/\d+ remaining/);
      if (status.prepared === false) assert.match(await card.locator('.ability-usage').textContent(), /Not prepared/);
      assert.ok(await card.evaluate(node => {
        const help = node.querySelector('.ability-desc').getBoundingClientRect();
        const usage = node.querySelector('.ability-usage').getBoundingClientRect();
        return usage.top >= help.bottom;
      }), 'Authored timing and remaining uses occupy a separate line from the description.');
      assert.equal(await card.isDisabled(), false, 'Spent ability names remain insertable for prose and table talk.');
    }
    for (const ability of sheet.abilities.filter(value => getAbilityDefinition(value.definition_id).activation === 'passive')) {
      const passive = page.locator('.ability-passive').filter({ has: page.locator('.ability-name', { hasText: ability.name }) });
      assert.equal(await passive.locator('.ability-desc').textContent(), ability.description);
    }
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.locator('#class-runtime-details').scrollIntoViewIfNeeded();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${branch.id} sheet stays within viewport`);
      assert.ok(await page.locator('#class-runtime-details').evaluate(node => node.scrollWidth <= node.clientWidth + 1), `${branch.id} state does not overflow`);
      if (family.id === 'arcanist' && ritual) await page.screenshot({ path: path.join(artifacts, `working-${viewport.width}.png`) });
    }
  }
  await page.locator('#btn-show-campaigns').click();
  await page.locator('#btn-new-campaign-trigger').click();
  await page.locator('#select-ruleset').selectOption('house');
  await page.locator('#select-character-mode').selectOption('existing');
  await page.locator('#select-saved-character').selectOption('91');
  assert.match(await page.locator('#saved-character-summary').innerText(), /HP 10\/10/);
  assert.equal(await page.locator('#class-creator').isVisible(), false, 'Legacy saved-character flow does not choose new entitlements');
  await page.locator('#select-ruleset').selectOption('aetheria');
  await page.locator('#select-saved-character').selectOption('92');
  assert.match(await page.locator('#saved-character-summary').innerText(), /Wizard\. Available\. HP 24\/24.*Magic Missile, Fireball/);
  assert.doesNotMatch(await page.locator('#saved-character-summary').innerText(), /Energy|arcanist\./);
  assert.equal(await page.locator('#class-creator').isVisible(), false, 'A saved class preview cannot replace its pinned build.');
  assert.deepEqual(errors, [], 'Browser errors');
  assert.deepEqual(unexpected, [], 'Unexpected API requests');
  console.log(`Class creator browser checks passed (mocked API responses; no provider playtest). Screenshots: ${artifacts}`);
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
