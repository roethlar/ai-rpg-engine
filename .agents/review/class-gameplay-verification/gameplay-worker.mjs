import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { realpath, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createLocalGuard, localModelManifest, MODELS, ROLES, OLLAMA_ORIGIN } from './local-guard.mjs';
import { trackApplicationRequests, verifyRenderedNarrative } from './runner-support.mjs';
import { observeSubmission } from './submission-evidence.mjs';
import { EPISODE_ALLOCATIONS } from './episode-coordinator.mjs';

const args = process.argv.slice(2);
const value = name => args[args.indexOf(name) + 1];
const execute = args.includes('--run');
assert.notEqual(execute, args.includes('--verify'), 'Select exactly one execution mode.');
const episodeId = value('--episode');
const allocation = EPISODE_ALLOCATIONS.find(entry => entry.id === episodeId);
assert.ok(allocation && args.includes('--artifacts'), 'An allocated episode and fresh artifacts directory are required.');
const injectAbort = args.includes('--inject-abort') && episodeId === 'direct-magic';
const injectNarrationAbort = args.includes('--inject-narration-abort') && episodeId === 'direct-magic';
assert.ok(!execute || !args.some(arg => arg.startsWith('--inject-')), 'Failure injection is offline only.');
assert.ok(!(injectAbort && injectNarrationAbort), 'Use one failure injection per verification run.');
const artifacts = await realpath(resolve(value('--artifacts')));
assert.ok(artifacts.startsWith(`${await realpath(tmpdir())}${sep}`), 'Worker artifacts must be system-temporary.');
assert.deepEqual(await readdir(artifacts), [], 'Worker requires a fresh, empty artifact directory.');
process.env.RPG_DB_PATH = join(artifacts, 'pilot.db');
process.env.ACCESS_SECRET = `gameplay-${randomUUID()}`;
delete process.env.IMAGE_PROVIDER;

const report = { schemaVersion: 1, episodeId, mode: execute ? 'local_pilot' : 'offline_verification',
  startedAt: new Date().toISOString(), artifacts, status: 'preparing',
  budget: { maximumDispatches: allocation.maximumDispatches,
    maximumPlayerSubmissions: allocation.maximumPlayerSubmissions, maxLiveMs: allocation.maxLiveMs },
  maximumDispatches: allocation.maximumDispatches, playerSubmissions: 0,
  calls: [], dispatches: [], actions: [], views: [], uiErrors: [], accounted: false,
  serverSettled: false, inferenceStopped: false };
const save = () => writeFile(join(artifacts, 'report.json'), JSON.stringify(report, null, 2));
await save();
const originalFetch = globalThis.fetch;
const cancellation = new AbortController();
let activeCall = null;
let origin = null;
let liveStart = null;
let guard;
let adapter;
let db;
let engine;
let AIClient;
let originalPrompt;
let listener;
let tracker;
let browser;
let page;
let timer;
let policyFailure;
const remaining = () => liveStart === null ? allocation.maxLiveMs : allocation.maxLiveMs - (performance.now() - liveStart);
const stop = reason => {
  guard?.abort();
  adapter?.abort(reason);
  cancellation.abort(reason || new Error('Episode stopped.'));
  report.inferenceStopped = true;
};
const onTerminate = () => {
  report.status = 'time_budget_exhausted';
  stop(new Error('The coordinator stopped this episode.'));
  void page?.close().catch(() => {});
};
process.once('SIGTERM', onTerminate);
const stageRole = stage => stage === 'narration' ? 'narration'
  : ['grounding', 'pre_roll', 'annotation_review', 'table_talk'].includes(stage) ? 'continuity'
    : ['referee', 'annotation'].includes(stage) ? 'referee' : stage === 'interaction' ? 'interaction' : 'setup';
const snapshot = async () => ({
  world: JSON.parse((await db.get('SELECT rules_state_json FROM campaigns WHERE id = ?', [report.campaignId])).rules_state_json),
  operations: await db.all('SELECT id,status,stage,request_id,input_json,checkpoint_json,result_json FROM rules_turn_operations WHERE campaign_id = ?', [report.campaignId]),
  checks: await db.all('SELECT check_id,operation_id,record_json FROM rules_checks WHERE campaign_id = ?', [report.campaignId]),
  turnCount: (await db.get('SELECT COUNT(*) AS n FROM turns WHERE campaign_id = ?', [report.campaignId])).n
});

async function recordView(label) {
  if (!page || page.isClosed()) { report.views.push({ label, unavailable: 'Browser page closed.' }); return; }
  const views = [];
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(100);
    const screenshot = `${label}-${viewport.width}.png`;
    await page.screenshot({ path: join(artifacts, screenshot), fullPage: true });
    views.push({ viewport, screenshot, visibleText: await page.locator('body').innerText(),
      overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1) });
  }
  report.views.push({ label, views });
  await page.setViewportSize({ width: 1280, height: 900 });
}

async function submit(prose) {
  assert.ok(report.playerSubmissions < allocation.maximumPlayerSubmissions, 'Player submission allocation exhausted.');
  if (remaining() <= 0 || report.dispatches.length >= allocation.maximumDispatches) {
    report.status = 'time_budget_exhausted';
    return false;
  }
  const action = { prose, before: await snapshot(), callStart: report.calls.length,
    dispatchStart: report.dispatches.length, visibleBefore: await page.locator('body').innerText() };
  report.actions.push(action);
  report.playerSubmissions++;
  await page.locator('#action-input').fill(prose);
  action.recognizedTerms = await page.locator('.ability-highlight').allTextContents();
  const start = performance.now();
  const outcome = await observeSubmission(page, { pathname: `/api/campaigns/${report.campaignId}/turn`,
    timeoutMs: Math.max(1, remaining()), submit: async () => {
      await page.locator('#btn-send-action').click();
      if ((injectAbort && report.playerSubmissions === 1) || (injectNarrationAbort && report.playerSubmissions === 2)) {
        await page.waitForFunction(() => typeof window.__abortPilotTurn === 'function');
        // Wait for the real server handler to reach the deliberately pending
        // authored provider, then abort the actual browser request once.
        const waitingUntil = performance.now() + 5000;
        while (!report.injectedCallPending && performance.now() < waitingUntil) await new Promise(done => setTimeout(done, 10));
        assert.equal(report.injectedCallPending, true, 'The failure fixture must reach its real server handler.');
        await page.evaluate(() => window.__abortPilotTurn());
      }
    }
  });
  action.elapsedMs = performance.now() - start;
  if (outcome.kind === 'invalid_response') {
    action.status = 'invalid_response';
    action.transport = outcome;
    throw new Error(outcome.error);
  }
  if (policyFailure) throw policyFailure;
  if (outcome.kind !== 'response') {
    action.status = 'transport_failed';
    action.transport = outcome;
    report.status = outcome.kind === 'deadline' ? 'time_budget_exhausted' : 'transport_stopped';
    stop(new Error(outcome.error));
    action.serverSettled = await tracker.waitForIdle(15000);
    if (action.serverSettled) action.after = await snapshot();
    else throw new Error('The failed episode did not settle its application work.');
  } else {
    action.httpStatus = outcome.response.status();
    action.response = outcome.body;
    action.after = await snapshot();
    const pending = action.after.operations.some(operation => operation.status === 'active');
    action.status = outcome.response.ok() ? 'completed' : pending ? 'pending' : 'rejected';
    if (policyFailure) throw policyFailure;
    if (action.status === 'rejected') assert.deepEqual(action.after, action.before, 'An unreserved rejection changed stored state.');
    if (action.status === 'completed') {
      if (action.response.turn.inputKind !== 'committed_action') {
        assert.deepEqual(action.after.world, action.before.world, 'A question changed the world.');
        assert.deepEqual(action.after.operations, action.before.operations);
        assert.deepEqual(action.after.checks, action.before.checks);
      }
      await page.waitForFunction(() => !document.querySelector('#action-input').disabled);
      await verifyRenderedNarrative(page, action.response.turn.narrative);
    } else if (!cancellation.signal.aborted) report.status = 'episode_rejected';
  }
  action.callEnd = report.calls.length;
  action.dispatchEnd = report.dispatches.length;
  await recordView(`action-${report.actions.length}`);
  await save();
  console.log(JSON.stringify({ episodeId, input: prose, status: action.status,
    elapsedMs: Math.round(action.elapsedMs), narrative: action.response?.turn?.narrative,
    error: action.response?.error || action.transport?.error }));
  return action.status === 'completed';
}

try {
  report.models = execute ? await localModelManifest(originalFetch) : null;
  guard = createLocalGuard({ fetchImpl: originalFetch, manifest: report.models, report,
    getActiveCall: () => activeCall, getLocalOrigin: () => origin, onDispatch: save, deadline: remaining });
  globalThis.fetch = async (...request) => {
    try { return await guard.fetch(...request); }
    catch (error) {
      const expectedStop = (cancellation.signal.aborted || remaining() <= 0)
        && ['The pilot stopped during model metadata inspection.', 'The pilot stopped before generation dispatch.'].includes(error.message);
      if (error.code === 'ERR_ASSERTION' && !/budget is exhausted/u.test(error.message) && !expectedStop) policyFailure = error;
      throw error;
    }
  };
  db = await import('../../../db.js');
  engine = await import('../../../rpg-engine.js');
  ({ AIClient } = await import('../../../api-client.js'));
  const { resolveAgentConfig } = await import('../../../api-client.js');
  const { getServerAiConfig } = await import('../../../server-config.js');
  const fixtures = await import('./fixtures.mjs');
  const prepare = { 'direct-magic': fixtures.prepareDirectMagicEpisode,
    catalyst: fixtures.prepareCatalystEpisode, ritual: fixtures.prepareRitualEpisode }[episodeId];
  const apiConfig = { provider: 'ollama', model: MODELS.logic, ollamaUrl: OLLAMA_ORIGIN,
    imageProvider: '', voiceAlwaysGenerate: false,
    roles: Object.fromEntries(Object.entries(ROLES).map(([role, model]) => [role, { provider: 'ollama', model }])) };
  await db.initDb();
  await db.run('INSERT INTO server_settings (key,value) VALUES (?,?)', ['ai_config', JSON.stringify(apiConfig)]);
  const effective = await getServerAiConfig();
  report.effectiveRoles = {};
  for (const [role, model] of Object.entries(ROLES)) {
    const client = new AIClient(resolveAgentConfig(effective, role));
    assert.equal(client.provider, 'ollama');
    assert.equal(client.model, model);
    assert.equal(client.ollamaUrl, OLLAMA_ORIGIN);
    assert.ok(!client.fallback, 'A worker cannot use fallback inference.');
    report.effectiveRoles[role] = { provider: client.provider, model: client.model, ollamaUrl: client.ollamaUrl };
  }
  report.preparation = await prepare({ engine, db, AIClient, apiConfig });
  report.campaignId = report.preparation.state.campaignId;
  report.initialSnapshot = await snapshot();
  assert.equal(report.dispatches.length, 0, 'Fixture preparation generated a response.');
  if (!execute) {
    const { installOfflineGameplayProvider } = await import('./offline-gameplay-provider.mjs');
    adapter = installOfflineGameplayProvider({ AIClient, episodeId });
    report.offlineProvider = adapter.report;
  }
  originalPrompt = AIClient.prototype.sendPrompt;
  AIClient.prototype.sendPrompt = async function (request) {
    const stage = /^AETHERIA_COUNCIL:([a-z_]+)/u.exec(request.systemInstruction)?.[1];
    try {
      assert.ok(stage && stageRole(stage) !== 'setup', 'Gameplay worker cannot generate setup.');
      assert.equal(activeCall, null, 'Overlapping role calls are forbidden.');
      assert.equal(this.provider, 'ollama');
      assert.equal(this.model, ROLES[stageRole(stage)]);
      assert.equal(this.ollamaUrl, OLLAMA_ORIGIN);
      assert.ok(!this.fallback);
    } catch (error) { policyFailure = error; throw error; }
    assert.ok(!cancellation.signal.aborted, 'The stopped episode cannot call another provider.');
    const call = { index: report.calls.length, stage, model: this.model, request,
      provenance: execute ? 'local_generation' : 'authored_offline', startedAt: new Date().toISOString() };
    report.calls.push(call);
    activeCall = call;
    const start = performance.now();
    await save();
    try {
      if ((injectAbort && report.calls.length === 1) || (injectNarrationAbort && stage === 'narration')) {
        report.injectedCallPending = true;
        await new Promise((_, reject) => cancellation.signal.addEventListener('abort', () => reject(cancellation.signal.reason), { once: true }));
      }
      call.response = await originalPrompt.call(this, request);
      return call.response;
    } catch (error) { call.error = { code: error.code || null, message: error.message }; throw error; }
    finally { call.elapsedMs = performance.now() - start; activeCall = null; await save(); }
  };
  report.accounted = true;
  const { chromium } = await import('playwright');
  const { app } = await import('../../../server.js?isolated-gameplay-worker');
  listener = await new Promise(done => { const server = app.listen(0, '127.0.0.1', () => done(server)); });
  tracker = trackApplicationRequests(listener);
  origin = `http://127.0.0.1:${listener.address().port}`;
  report.origin = origin;
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  await context.addInitScript(token => localStorage.setItem('aetheria_settings', JSON.stringify({ accessToken: token, voiceNarration: false })), process.env.ACCESS_SECRET);
  if (injectAbort || injectNarrationAbort) await context.addInitScript(() => {
    const original = window.fetch;
    window.fetch = (input, init = {}) => {
      if (init.method === 'POST' && /\/turn$/u.test(String(input))) {
        const controller = new AbortController();
        window.__abortPilotTurn = () => controller.abort();
        return original(input, { ...init, signal: AbortSignal.any([init.signal, controller.signal].filter(Boolean)) });
      }
      return original(input, init);
    };
  });
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.uiErrors.push(error.message));
  const listed = page.waitForResponse(response => new URL(response.url()).pathname === '/api/campaigns' && response.request().method() === 'GET');
  await page.goto(origin);
  const campaigns = await (await listed).json();
  const index = campaigns.findIndex(campaign => campaign.id === report.campaignId);
  assert.ok(index >= 0, 'The authored scene must appear in the real campaign browser.');
  await page.locator('.campaign-card').nth(index).click();
  await page.locator('#main-game-screen').waitFor({ state: 'visible' });
  await recordView('opening');
  liveStart = performance.now();
  report.liveStartedAt = new Date().toISOString();
  process.send?.({ type: 'live_started', episodeId });
  if (execute) guard.enable();
  timer = setTimeout(() => {
    report.status = 'time_budget_exhausted';
    stop(new Error('The episode live-time allocation expired.'));
  }, allocation.maxLiveMs);
  report.status = 'episode_observed';
  for (const planned of report.preparation.playerPlan) {
    const current = (await snapshot()).world;
    const actor = current.actors[`character:${report.preparation.state.character.id}`];
    const visible = await page.locator('body').innerText();
    let input = planned.input;
    if (planned.kind === 'ritual_continue' && !actor.classState.ritual) {
      report.limitation = 'No active working remains to continue; no restart was substituted.';
      break;
    }
    if (planned.kind === 'ordinary_choice') {
      const threat = Object.values(current.actors).find(value => value.present && value.opposed && !value.party
        && value.health > 0 && value.locationId === actor.locationId && value.area === actor.area && visible.includes(value.name));
      if (!threat) { report.limitation = 'No visible immediate ordinary attack remains; no ally intent was invented.'; break; }
      input = `I attack the ${threat.name} with my weapon.`;
    }
    if (planned.kind === 'conditional_fireball') {
      const occupants = Object.values(current.actors).filter(value => value.present && value.locationId === actor.locationId && value.area === 'yard');
      if (!visible.includes('Courtyard') || !occupants.some(value => value.opposed && value.health > 0)
        || occupants.some(value => value.party && value.health > 0)) {
        report.limitation = 'The current Courtyard no longer offers the planned opposing area without allied collateral; no scene rewrite or consent invented.';
        break;
      }
    }
    assert.ok(input, 'Each actual input must come from the visible episode plan.');
    if (!await submit(input)) break;
  }
} catch (error) {
  report.error = { code: error.code || null, message: error.message };
  const interrupted = report.actions.at(-1);
  if (interrupted && !interrupted.status) {
    interrupted.status = 'diagnostic_failed';
    interrupted.error = report.error;
    interrupted.callEnd = report.calls.length;
    interrupted.dispatchEnd = report.dispatches.length;
  }
  report.status = 'fatal';
  process.exitCode = 1;
  console.error(error);
} finally {
  clearTimeout(timer);
  stop();
  report.serverSettled = tracker ? await tracker.waitForIdle(15000) : true;
  if (!report.serverSettled || policyFailure) {
    report.status = 'fatal';
    if (policyFailure) report.error = { code: policyFailure.code || null, message: policyFailure.message };
    process.exitCode = 1;
  }
  try {
    if (db && report.campaignId && report.serverSettled) {
      report.finalSnapshot = await snapshot();
      let bundle;
      try { bundle = await engine.exportCampaign(report.campaignId); }
      catch (error) {
        const pending = report.finalSnapshot.operations.some(operation => operation.status === 'active');
        if (!pending || error.message !== 'Finish the unresolved action before exporting or forking this campaign.') throw error;
        report.exportUnavailable = { kind: 'pending_operation', reason: error.message };
      }
      if (bundle) {
        report.export = 'campaign.json';
        await writeFile(join(artifacts, report.export), JSON.stringify(bundle, null, 2));
      }
    }
    await recordView('final');
  } catch (error) { report.evidenceError = error.message; report.status = 'fatal'; process.exitCode = 1; }
  report.endedAt = new Date().toISOString();
  await save();
  if (browser) await browser.close();
  if (listener) await new Promise(done => listener.close(done));
  tracker?.detach();
  if (AIClient && originalPrompt) AIClient.prototype.sendPrompt = originalPrompt;
  adapter?.restore();
  globalThis.fetch = originalFetch;
  if (db) await db.closeDb();
  process.removeListener('SIGTERM', onTerminate);
  console.log(`Episode artifacts: ${artifacts}`);
}
