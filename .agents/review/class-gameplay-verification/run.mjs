import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createLocalGuard, localModelManifest, MODELS, ROLES, OLLAMA_ORIGIN } from './local-guard.mjs';

const execute = process.argv.includes('--run');
assert.ok(execute || process.argv.includes('--prepare'), 'Use --prepare for offline setup or --run for the owner-approved local pilot.');
const originalFetch = globalThis.fetch;
// A missing/remote selected model refuses before any application/database import.
const manifest = execute ? await localModelManifest(originalFetch) : null;
const artifacts = await mkdtemp(join(tmpdir(), 'aetheria-gameplay-pilot-'));
process.env.RPG_DB_PATH = join(artifacts, 'pilot.db');
process.env.ACCESS_SECRET = `pilot-${randomUUID()}`;
delete process.env.IMAGE_PROVIDER;
const report = { startedAt: new Date().toISOString(), artifacts, mode: execute ? 'local_pilot' : 'offline_preparation',
  maximumDispatches: 60, maximumPlayerSubmissions: 8, maximumLiveMs: 1200000,
  models: manifest, roles: ROLES, dispatches: [], calls: [], episodes: [], uiErrors: [], rejectedRequests: [], status: 'preparing' };
const save = () => writeFile(join(artifacts, 'report.json'), JSON.stringify(report, null, 2));
let activeCall = null;
let origin = null;
let liveStart = null;
let listener;
let browser;
let deadlineTimer;
let hardStopTimer;
const remaining = () => liveStart === null ? report.maximumLiveMs : report.maximumLiveMs - (performance.now() - liveStart);
const guard = createLocalGuard({ fetchImpl: originalFetch, manifest, report, getActiveCall: () => activeCall,
  getLocalOrigin: () => origin, onDispatch: save, deadline: remaining });
globalThis.fetch = guard.fetch;
const db = await import('../../../db.js');
const engine = await import('../../../rpg-engine.js');
const { AIClient, resolveAgentConfig } = await import('../../../api-client.js');
const { getServerAiConfig } = await import('../../../server-config.js');
const { prepareCatalystEpisode, prepareRitualEpisode } = await import('./fixtures.mjs');
const originalPrompt = AIClient.prototype.sendPrompt;
const apiConfig = { provider: 'ollama', model: MODELS.logic, ollamaUrl: OLLAMA_ORIGIN, imageProvider: '',
  voiceAlwaysGenerate: false, roles: Object.fromEntries(Object.entries(ROLES).map(([role, model]) => [role, { provider: 'ollama', model }])) };
const stageRole = stage => ['narration'].includes(stage) ? 'narration'
  : ['grounding', 'pre_roll', 'annotation_review', 'table_talk'].includes(stage) ? 'continuity'
    : ['referee', 'annotation'].includes(stage) ? 'referee' : stage === 'interaction' ? 'interaction' : 'setup';
const world = async id => JSON.parse((await db.get('SELECT rules_state_json FROM campaigns WHERE id = ?', [id])).rules_state_json);
const snapshot = async id => ({ world: await world(id),
  operations: await db.all('SELECT id, status, stage, request_id FROM rules_turn_operations WHERE campaign_id = ?', [id]),
  checks: await db.all('SELECT check_id, operation_id, record_json FROM rules_checks WHERE campaign_id = ?', [id]),
  turnCount: (await db.get('SELECT COUNT(*) AS n FROM turns WHERE campaign_id = ?', [id])).n });
const structuredError = error => ({ code: error.code || null, message: error.message });

AIClient.prototype.sendPrompt = async function (request) {
  const stage = /^AETHERIA_COUNCIL:([a-z_]+)/u.exec(request.systemInstruction)?.[1] || 'setup';
  assert.equal(activeCall, null, 'Unplanned concurrent generation refused.');
  assert.equal(this.provider, 'ollama');
  assert.equal(this.model, ROLES[stageRole(stage)], `Wrong model for ${stage}.`);
  assert.equal(this.ollamaUrl, OLLAMA_ORIGIN);
  assert.ok(!this.fallback, 'Cloud or unapproved fallback refused.');
  const call = { index: report.calls.length, model: this.model, stage, request, startedAt: new Date().toISOString() };
  report.calls.push(call);
  activeCall = call;
  const start = performance.now();
  console.log(`Local call ${call.index + 1}: ${stage} / ${this.model}`);
  try { call.response = await originalPrompt.call(this, request); return call.response; }
  catch (error) { call.error = structuredError(error); throw error; }
  finally { call.elapsedMs = performance.now() - start; activeCall = null; await save(); }
};

let submissions = 0;
async function recordView(page, episode, label) {
  const views = [];
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(500);
    const screenshot = `${episode.id}-${label}-${viewport.width}.png`;
    await page.screenshot({ path: join(artifacts, screenshot), fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    views.push({ viewport, screenshot, overflow, visibleText: await page.locator('body').innerText() });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  episode.views ||= [];
  episode.views.push({ label, views });
  return views[0].visibleText;
}

async function openCampaign(page, state) {
  const listed = page.waitForResponse(response => new URL(response.url()).pathname === '/api/campaigns' && response.request().method() === 'GET');
  await page.goto(origin);
  const campaigns = await (await listed).json();
  const index = campaigns.findIndex(campaign => campaign.id === state.campaignId);
  assert.ok(index >= 0, 'The prepared campaign must be in the actual browser listing.');
  await page.locator('.campaign-card').nth(index).click();
  await page.locator('#main-game-screen').waitFor({ state: 'visible' });
  await page.locator('#action-input').waitFor({ state: 'visible' });
}

async function submit(page, episode, prose) {
  assert.ok(submissions < report.maximumPlayerSubmissions && remaining() > 0, 'Player/time budget exhausted.');
  assert.ok(report.dispatches.length < report.maximumDispatches, 'Local dispatch budget exhausted.');
  const before = await snapshot(episode.campaignId);
  const action = { prose, before, callStart: report.calls.length, dispatchStart: report.dispatches.length,
    visibleBefore: await page.locator('body').innerText() };
  episode.actions.push(action);
  submissions++;
  report.playerSubmissions = submissions;
  await page.locator('#action-input').fill(prose);
  action.recognizedTerms = await page.locator('.ability-highlight').allTextContents();
  const responsePromise = page.waitForResponse(response => new URL(response.url()).pathname === `/api/campaigns/${episode.campaignId}/turn`,
    { timeout: Math.max(1, remaining()) });
  const start = performance.now();
  await page.locator('#btn-send-action').click();
  const response = await responsePromise;
  action.elapsedMs = performance.now() - start;
  action.httpStatus = response.status();
  action.response = await response.json();
  action.after = await snapshot(episode.campaignId);
  action.callEnd = report.calls.length;
  action.dispatchEnd = report.dispatches.length;
  const pending = action.after.operations.some(value => value.status === 'active');
  action.status = response.ok() ? 'completed' : pending ? 'pending' : 'rejected';
  if (action.status === 'rejected') {
    assert.deepEqual(action.after, before, 'An unreserved rejected action changed persistent state.');
    report.rejectedRequests.push({ episode: episode.id, prose, response: action.response });
  }
  if (response.ok() && action.response.turn.inputKind !== 'committed_action') {
    assert.deepEqual(action.after.world, before.world, 'Table talk changed the world.');
    assert.deepEqual(action.after.operations, before.operations);
    assert.deepEqual(action.after.checks, before.checks);
  }
  if (response.ok()) {
    await page.waitForFunction(() => !document.querySelector('#action-input').disabled);
    assert.equal((await page.locator('.log-gm .content').last().innerText()).trim(), action.response.turn.narrative.trim());
  }
  await recordView(page, episode, `action-${episode.actions.length}`);
  await save();
  console.log(JSON.stringify({ episode: episode.id, input: prose, status: action.status,
    ms: Math.round(action.elapsedMs), calls: action.callEnd - action.callStart, narrative: action.response.turn?.narrative, error: action.response.error }));
  return action;
}

try {
  await db.initDb();
  await db.run('INSERT INTO server_settings (key, value) VALUES (?, ?)', ['ai_config', JSON.stringify(apiConfig)]);
  const effective = await getServerAiConfig();
  report.effectiveRoles = {};
  for (const [role, model] of Object.entries(ROLES)) {
    const client = new AIClient(resolveAgentConfig(effective, role));
    assert.equal(client.provider, 'ollama');
    assert.equal(client.model, model);
    assert.equal(client.ollamaUrl, OLLAMA_ORIGIN);
    assert.ok(!client.fallback, 'The actual server configuration must have no fallback.');
    report.effectiveRoles[role] = { provider: client.provider, model: client.model, ollamaUrl: client.ollamaUrl, fallback: null };
  }
  const fixtureStartCalls = report.calls.length;
  const catalyst = await prepareCatalystEpisode({ engine, db, AIClient, apiConfig });
  const ritual = await prepareRitualEpisode({ engine, db, AIClient, apiConfig });
  assert.equal(report.calls.length, fixtureStartCalls, 'Authored setup escaped its provider stub.');
  assert.equal(report.dispatches.length, 0, 'Offline setup generated a model response.');
  report.preparation = { catalyst, ritual };
  await save();
  if (!execute) {
    report.status = 'prepared_offline';
  } else {
    const { chromium } = await import('playwright');
    const { app } = await import('../../../server.js?local-gameplay-pilot');
    listener = await new Promise(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
    origin = `http://127.0.0.1:${listener.address().port}`;
    report.origin = origin;
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    await context.addInitScript(token => localStorage.setItem('aetheria_settings', JSON.stringify({ accessToken: token, voiceNarration: false })), process.env.ACCESS_SECRET);
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => report.uiErrors.push(error.message));
    liveStart = performance.now();
    guard.enable();
    deadlineTimer = setTimeout(() => {
      guard.disable(); report.status = 'time_budget_exhausted';
      save().finally(() => { browser?.close().catch(() => {}); listener?.close(); });
      hardStopTimer = setTimeout(() => process.exit(2), 5000);
    }, report.maximumLiveMs);
    const magic = { id: 'direct-magic', setup: 'live', actions: [] };
    report.episodes.push(magic);
    await page.goto(origin);
    await page.locator('#btn-new-campaign-trigger').click();
    await page.locator('#input-genre').fill('Fantasy battlefield rescue');
    await page.locator('#input-char-name').fill('Mira Local Pilot');
    await page.locator('#input-char-concept').fill('A field arcanist defending an open rescue route from an actively attacking enemy.');
    await page.locator('#class-family').selectOption('arcanist');
    await page.locator('#class-branch').selectOption('arcanist.formula');
    await page.locator('#input-class-rider').uncheck();
    await page.locator('#input-class-allies').uncheck();
    const creating = page.waitForResponse(response => new URL(response.url()).pathname === '/api/campaigns' && response.request().method() === 'POST', { timeout: remaining() });
    await page.locator('#btn-submit-wizard').click();
    const created = await creating;
    magic.creationStatus = created.status();
    magic.creationResponse = await created.json();
    if (created.ok()) {
      magic.campaignId = magic.creationResponse.campaignId;
      await page.locator('#main-game-screen').waitFor({ state: 'visible' });
      await recordView(page, magic, 'opening');
      const question = await submit(page, magic, 'What is happening right now, where are the threats, and what could I do next?');
      if (question.status === 'completed') {
        const current = await world(magic.campaignId);
        const actor = current.actors[`character:${magic.creationResponse.character.id}`];
        const shown = await page.locator('body').innerText();
        const originArea = current.areas[`area:${current.currentLocationId}:${actor.area}`];
        // This only checks scenario applicability; submitted prose uses visible names.
        const foe = Object.values(current.actors).find(value => value.present && value.opposed && !value.party && value.health > 0
          && value.locationId === actor.locationId && (value.area === actor.area || originArea.adjacent.includes(value.area)) && shown.includes(value.name));
        if (foe) {
          const missile = await submit(page, magic, `I cast Magic Missile directly at ${foe.name}.`);
          if (missile.status === 'completed') {
            const after = await world(magic.campaignId);
            const hero = after.actors[`character:${magic.creationResponse.character.id}`];
            const target = Object.values(after.actors).find(value => value.name === foe.name && value.opposed && value.health > 0 && value.present);
            const area = target && after.areas[`area:${after.currentLocationId}:${target.area}`];
            const occupants = target && Object.entries(after.actors).filter(([, value]) => value.present && value.locationId === hero.locationId && value.area === target.area);
            const visible = await page.locator('body').innerText();
            if (target && area && visible.includes(area.name) && (target.area === hero.area || after.areas[`area:${hero.locationId}:${hero.area}`].adjacent.includes(target.area))
              && occupants.every(([ref, value]) => !value.party || ref === `character:${magic.creationResponse.character.id}`)) {
              await submit(page, magic, `I cast Fireball directly into ${area.name} at ${target.name}. I accept that it affects every occupant, including me if I am there.`);
            } else magic.limitation = 'The evolved visible scene did not offer a legal Fireball target without inventing allied consent.';
          }
        } else magic.limitation = 'Live creation/question did not expose a legal visible near enemy for direct casting; no setup was rewritten.';
      }
    } else magic.limitation = 'Live creation failed; no regeneration or authored replacement was used for this episode.';
    if (magic.campaignId) {
      magic.export = 'direct-magic-campaign.json';
      await writeFile(join(artifacts, magic.export), JSON.stringify(await engine.exportCampaign(magic.campaignId), null, 2));
    }
    await save();

    for (const prepared of [catalyst, ritual]) {
      if (report.dispatches.length >= report.maximumDispatches || remaining() <= 0) break;
      const episode = { id: prepared.episodeId, setup: prepared.setup, campaignId: prepared.state.campaignId, actions: [] };
      report.episodes.push(episode);
      await openCampaign(page, prepared.state);
      await recordView(page, episode, 'opening');
      for (const planned of prepared.playerPlan) {
        const current = await world(episode.campaignId);
        const actor = current.actors[`character:${prepared.state.character.id}`];
        let input = planned.input;
        if (planned.kind === 'ritual_continue' && !actor.classState.ritual) {
          episode.limitation = 'The prior result left no active ritual to continue; no restart was substituted.';
          break;
        }
        if (planned.kind === 'ordinary_choice') {
          const visible = await page.locator('body').innerText();
          const threat = Object.values(current.actors).find(value => value.present && value.opposed && !value.party
            && value.health > 0 && value.locationId === actor.locationId && value.area === actor.area && visible.includes(value.name));
          if (threat) input = `I attack ${threat.name} with my weapon.`;
          else {
            episode.limitation = 'The changed scene offered no visible immediate ordinary attack; no ally intent was invented to force aid.';
            break;
          }
        }
        assert.ok(input, 'Authored episode needs a visible-name prose input.');
        const result = await submit(page, episode, input);
        if (result.status !== 'completed') { episode.limitation = 'A rejected or pending input ended the episode without buying a replacement attempt.'; break; }
      }
      episode.export = `${episode.id}-campaign.json`;
      await writeFile(join(artifacts, episode.export), JSON.stringify(await engine.exportCampaign(episode.campaignId), null, 2));
      await save();
    }
    report.status = 'pilot_observed';
  }
} catch (error) {
  report.status = report.status === 'time_budget_exhausted' ? report.status : 'pilot_stopped';
  report.error = structuredError(error);
  process.exitCode = 1;
  console.error(error);
} finally {
  guard.disable();
  clearTimeout(deadlineTimer);
  clearTimeout(hardStopTimer);
  report.endedAt = new Date().toISOString();
  await save();
  if (browser) await browser.close();
  if (listener) await new Promise(resolve => listener.close(resolve));
  AIClient.prototype.sendPrompt = originalPrompt;
  globalThis.fetch = originalFetch;
  await db.closeDb();
  console.log(`Gameplay pilot artifacts: ${artifacts}`);
}
