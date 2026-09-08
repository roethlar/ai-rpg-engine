import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';

// No application import may precede the disposable database assignment.
const fixtureIndex = process.argv.indexOf('--fixture');
assert.ok(process.argv.includes('--live') && fixtureIndex >= 0 && process.argv[fixtureIndex + 1],
  'Usage: node .agents/review/council-latency-probe.mjs --live --fixture <temporary spell session.json>');
const fixturePath = resolve(process.argv[fixtureIndex + 1]);
assert.equal(basename(fixturePath), 'session.json');
assert.equal(dirname(dirname(fixturePath)), resolve(tmpdir()), 'Only a retained disposable spell fixture is accepted.');
assert.ok(basename(dirname(fixturePath)).startsWith('aetheria-class-live-spells-'));
const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
assert.equal(fixture.setup, 'authored_fixture');
assert.equal(fixture.turnProvider, 'original');
assert.equal(fixture.outcomeEngine, 'real');
assert.equal(fixture.setupResponses.length, 4);
const artifacts = await mkdtemp(join(tmpdir(), 'aetheria-council-profile-'));
process.env.RPG_DB_PATH = join(artifacts, 'profile.db');
const db = await import('../../db.js');
const { AIClient, resolveAgentConfig } = await import('../../api-client.js');
const engine = await import('../../rpg-engine.js');
const { CATALOG_VERSION, CATALOG_OPTION_SET } = await import('../../class-catalog.js');
const apiConfig = { provider: 'ollama', model: 'deepseek-v4-flash:cloud', ollamaUrl: 'http://localhost:11434', imageProvider: '' };
const report = { version: 1, startedAt: new Date().toISOString(), artifacts, fixturePath,
  model: apiConfig.model, setup: 'retained_authored_fixture', turns: 'original_provider_real_engine',
  maximumNetworkCalls: 30, maximumSeconds: 600, calls: [], networkCalls: [], actions: [] };
const save = () => writeFile(join(artifacts, 'profile.json'), JSON.stringify(report, null, 2));
const originalPrompt = AIClient.prototype.sendPrompt;
const originalFetch = globalThis.fetch;
const startRun = performance.now();
let setupIndex = 0;
let activeCall = null;
const elapsed = start => Math.round((performance.now() - start) * 1000) / 1000;
const bytes = value => Buffer.byteLength(value, 'utf8');
const setupStage = request => request.prompt.startsWith('Draft an epic,') ? 'outline'
  : request.systemInstruction.includes('persistent structured layout') ? 'layout'
    : request.systemInstruction.includes('initial Aetheria scene') ? 'scene'
      : request.prompt.startsWith('Set the scene and begin the campaign.') ? 'opening' : null;

globalThis.fetch = async function (input, init) {
  const url = new URL(typeof input === 'string' ? input : input.url);
  assert.equal(url.origin, 'http://localhost:11434', 'The probe cannot call another endpoint.');
  assert.equal(url.pathname, '/api/chat');
  assert.ok(activeCall, 'Every network request needs an active Council call.');
  const remaining = report.maximumSeconds * 1000 - (performance.now() - startRun);
  assert.ok(report.networkCalls.length < report.maximumNetworkCalls && remaining > 0, 'Probe budget exhausted.');
  const call = { callIndex: activeCall.index, stage: activeCall.stage, requestBody: init.body,
    requestBytes: bytes(init.body), startedAt: new Date().toISOString() };
  report.networkCalls.push(call);
  const start = performance.now();
  try {
    const response = await originalFetch.call(this, input, { ...init,
      signal: AbortSignal.any([init.signal, AbortSignal.timeout(Math.max(1, Math.floor(Math.min(remaining, 120000))))].filter(Boolean)) });
    call.headersMs = elapsed(start);
    call.status = response.status;
    // Observe the consumer's actual body read, without a blocking clone or disk write.
    for (const method of ['json', 'text']) {
      const original = response[method].bind(response);
      response[method] = async () => {
        try {
          const value = await original();
          call.response = value;
          return value;
        } catch (error) { call.error = error.message; throw error; }
        finally { call.bodyCompleteMs = elapsed(start); }
      };
    }
    return response;
  } catch (error) { call.error = error.message; call.failedMs = elapsed(start); throw error; }
};

AIClient.prototype.sendPrompt = async function (request) {
  const stage = /^AETHERIA_COUNCIL:([a-z_]+)/u.exec(request.systemInstruction)?.[1];
  if (!stage) {
    const entry = fixture.setupResponses[setupIndex++];
    assert.ok(entry, 'Only the four retained setup responses are permitted.');
    assert.ok(setupStage(request), 'An unknown setup request cannot use a retained fixture.');
    assert.equal(setupStage(request), setupStage(entry.request), 'Setup request order changed.');
    return entry.response;
  }
  assert.equal(activeCall, null, 'Concurrent model calls need separate timing attribution.');
  assert.equal(this.provider, apiConfig.provider);
  assert.equal(this.model, apiConfig.model);
  assert.equal(this.ollamaUrl, apiConfig.ollamaUrl);
  assert.ok(!this.fallback, 'No silent fallback model in this comparison.');
  const call = { index: report.calls.length, stage, request, systemBytes: bytes(request.systemInstruction),
    promptBytes: bytes(request.prompt), startedAt: new Date().toISOString() };
  report.calls.push(call);
  activeCall = call;
  const start = performance.now();
  try { call.response = await originalPrompt.call(this, request); return call.response; }
  catch (error) { call.error = error.message; throw error; }
  finally { call.elapsedMs = elapsed(start); activeCall = null; }
};

const cases = [
  ['table_talk', 'Where is the Raider, and what is he doing right now?'],
  ['ordinary_move', 'I move into the Yard.'],
  ['magic_missile_1', 'I cast Magic Missile directly at the attacking Raider.'],
  ['magic_missile_2', 'I cast Magic Missile directly at the attacking Raider.'],
  ['fireball', 'I cast Fireball directly into Gate at the Raider. I explicitly accept that every occupant is affected, including me.']
];
try {
  for (const role of ['interaction', 'continuity', 'referee', 'narration']) {
    const config = resolveAgentConfig(apiConfig, role);
    assert.equal(config.provider, apiConfig.provider, 'Role override would invalidate the single-provider profile.');
    assert.equal(config.model, apiConfig.model);
    assert.equal(config.ollamaUrl, apiConfig.ollamaUrl);
    assert.ok(!config.fallback);
  }
  await db.initDb();
  await db.run('INSERT INTO server_settings (key, value) VALUES (?, ?)', ['ai_config', JSON.stringify(apiConfig)]);
  for (const [name, text] of cases) {
    if (report.networkCalls.length > report.maximumNetworkCalls - 7 || performance.now() - startRun > report.maximumSeconds * 1000) {
      report.limitation = `Stopped before ${name} to retain a bounded per-action call allowance.`;
      break;
    }
    setupIndex = 0;
    const state = await engine.createCampaign({ genre: 'Fantasy', characterName: 'Mira', ruleset: 'aetheria', apiConfig,
      classSelection: { catalogVersion: CATALOG_VERSION, optionSet: CATALOG_OPTION_SET, familyId: 'arcanist',
        branchId: 'arcanist.formula', modules: [], capabilities: { rider: false, alliedActors: false } } });
    assert.equal(setupIndex, 4);
    const campaign = () => db.get('SELECT rules_revision, rules_state_json FROM campaigns WHERE id = ?', [state.campaignId]);
    const before = await campaign();
    const action = { name, text, campaignId: state.campaignId, requestId: randomUUID(), callStart: report.calls.length,
      networkStart: report.networkCalls.length, before };
    report.actions.push(action);
    console.log(`Profiling ${name}`);
    const start = performance.now();
    try {
      const result = await engine.takeTurn(state.campaignId, text, apiConfig, state.character.id,
        state.character.abilityTriggerRevision, { requestId: action.requestId });
      action.elapsedMs = elapsed(start);
      action.inputKind = result.turn.inputKind;
      action.narrative = result.turn.narrative;
      action.status = 'completed';
    } catch (error) {
      action.elapsedMs = elapsed(start);
      action.error = { code: error.code || null, message: error.message };
      action.status = 'rejected_or_pending';
    }
    action.callEnd = report.calls.length;
    action.networkEnd = report.networkCalls.length;
    action.providerMs = report.calls.slice(action.callStart).reduce((sum, call) => sum + call.elapsedMs, 0);
    action.nonProviderMs = action.elapsedMs - action.providerMs;
    action.after = await campaign();
    action.operations = await db.all('SELECT id, status, stage FROM rules_turn_operations WHERE campaign_id = ?', [state.campaignId]);
    action.checks = await db.all('SELECT record_json FROM rules_checks WHERE campaign_id = ?', [state.campaignId]);
    if (action.error && !action.operations.length || action.inputKind === 'clarification' || action.inputKind === 'dialogue') {
      assert.deepEqual(action.after, before, 'Rejected/uncommitted or table-talk input changed the world.');
      assert.equal(action.checks.length, 0);
    }
    await save();
    console.log(JSON.stringify({ name, status: action.status, elapsedMs: action.elapsedMs,
      providerMs: action.providerMs, nonProviderMs: action.nonProviderMs, calls: action.callEnd - action.callStart, error: action.error }));
  }
  report.status = 'profiled';
} catch (error) {
  report.status = 'probe_failed';
  report.error = { code: error.code || null, message: error.message };
  process.exitCode = 1;
  console.error(error);
} finally {
  report.endedAt = new Date().toISOString();
  AIClient.prototype.sendPrompt = originalPrompt;
  globalThis.fetch = originalFetch;
  await save();
  await db.closeDb();
  console.log(`Profile artifacts: ${artifacts}`);
}
