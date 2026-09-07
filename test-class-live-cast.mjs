import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Explicit opt-in live probe; never imported by the automated entry point.
if (!process.argv.includes('--live')) throw new Error('Use --live to authorize this bounded disposable provider probe.');
const artifacts = await mkdtemp(join(tmpdir(), 'aetheria-class-live-cast-'));
process.env.RPG_DB_PATH = join(artifacts, 'session.db');
delete process.env.IMAGE_PROVIDER;
const db = await import('./db.js');
const { AIClient } = await import('./api-client.js');
const engine = await import('./rpg-engine.js');
const { CATALOG_VERSION, CATALOG_OPTION_SET } = await import('./class-catalog.js');
const apiConfig = { provider: 'ollama', model: 'deepseek-v4-flash:cloud', ollamaUrl: 'http://localhost:11434', imageProvider: '' };
const report = { artifacts, startedAt: new Date().toISOString(), mocked: false, provider: apiConfig.provider,
  model: apiConfig.model, maximumProviderCalls: 20, calls: [], networkCalls: [], actions: [] };
const save = () => writeFile(join(artifacts, 'session.json'), JSON.stringify(report, null, 2));
const originalPrompt = AIClient.prototype.sendPrompt;
const originalFetch = globalThis.fetch;
globalThis.fetch = async function (input, init) {
  const url = typeof input === 'string' ? input : input.url;
  if (!url.includes('/api/chat')) return originalFetch.call(this, input, init);
  if (report.networkCalls.length >= report.maximumProviderCalls) throw new Error('The live cast probe exhausted its 20-provider-call limit.');
  const call = { url, startedAt: new Date().toISOString(), body: init?.body };
  report.networkCalls.push(call);
  const start = performance.now();
  try {
    const response = await originalFetch.call(this, input, init);
    call.status = response.status;
    call.response = await response.clone().text();
    return response;
  } catch (error) { call.error = error.message; throw error; }
  finally { call.seconds = Math.round((performance.now() - start) / 100) / 10; await save(); }
};
AIClient.prototype.sendPrompt = async function (request) {
  const call = { stage: /^AETHERIA_COUNCIL:([a-z_]+)/u.exec(request.systemInstruction)?.[1] || 'setup', request };
  report.calls.push(call);
  const start = performance.now();
  console.log(`Live cast call ${report.calls.length}: ${call.stage}`);
  try { call.response = await originalPrompt.call(this, request); return call.response; }
  catch (error) { call.error = error.message; throw error; }
  finally { call.seconds = Math.round((performance.now() - start) / 100) / 10; await save(); }
};
let state;
const world = async () => JSON.parse((await db.get('SELECT rules_state_json FROM campaigns WHERE id = ?', [state.campaignId])).rules_state_json);
const submit = async text => {
  const before = await world();
  const start = performance.now();
  const count = report.networkCalls.length;
  const action = { text, requestId: randomUUID(), before };
  report.actions.push(action);
  try {
    state = await engine.takeTurn(state.campaignId, text, apiConfig, state.character.id, state.character.abilityTriggerRevision, { requestId: action.requestId });
    action.narrative = state.turn.narrative;
    action.inputKind = state.turn.inputKind;
    action.checks = state.turn.rollResults;
    action.after = await world();
    action.abilityStatus = state.character.abilityStatus;
    if (action.inputKind !== 'committed_action') assert.deepEqual(action.after, before);
    console.log(JSON.stringify({ text, narrative: action.narrative, checks: action.checks }));
  } catch (error) { action.error = { code: error.code, message: error.message }; throw error; }
  finally { action.seconds = Math.round((performance.now() - start) / 100) / 10; action.providerCalls = report.networkCalls.length - count; await save(); }
};
try {
  await db.initDb();
  await db.run('INSERT INTO server_settings (key, value) VALUES (?, ?)', ['ai_config', JSON.stringify(apiConfig)]);
  state = await engine.createCampaign({ genre: 'Fantasy battlefield rescue', characterName: 'Mira',
    characterClass: 'A field arcanist defending a rescue passage against visibly attacking enemy soldiers.', ruleset: 'aetheria', apiConfig,
    classSelection: { catalogVersion: CATALOG_VERSION, optionSet: CATALOG_OPTION_SET, familyId: 'arcanist', branchId: 'arcanist.formula', modules: [], capabilities: { rider: false, alliedActors: false } } });
  report.campaignId = state.campaignId;
  report.opening = state.turn.narrative;
  report.initial = await world();
  const nearEnemy = saved => {
    const hero = saved.actors[`character:${state.character.id}`];
    const area = saved.areas[`area:${saved.currentLocationId}:${hero.area}`];
    return Object.entries(saved.actors).find(([ref, actor]) => ref.startsWith('npc:') && actor.present && actor.opposed && !actor.party
      && actor.health > 0 && actor.locationId === saved.currentLocationId && (actor.area === hero.area || area.adjacent.includes(actor.area)));
  };
  let enemy = nearEnemy(report.initial);
  if (!enemy) report.limitation = 'The single generated scene had no recorded living near hostile; no target or power was fabricated.';
  else {
    await submit(`I cast Magic Missile directly at ${enemy[1].name}.`);
    const saved = await world();
    enemy = nearEnemy(saved);
    const fireball = state.character.abilities.find(ability => ability.name === 'Fireball');
    if (enemy && fireball && report.networkCalls.length <= 12) {
      const area = saved.areas[`area:${saved.currentLocationId}:${enemy[1].area}`];
      const occupants = Object.entries(saved.actors).filter(([, actor]) => actor.present && actor.locationId === saved.currentLocationId && actor.area === area.id && actor.health > 0);
      if (occupants.every(([ref, actor]) => !actor.party || ref === `character:${state.character.id}`)) {
        await submit(`I cast Fireball directly into ${area.name} at ${enemy[1].name}, accepting that it affects everyone in that area, including me if I am there.`);
      } else report.fireballLimitation = 'The hostile area contained an allied actor without established consent to collateral harm.';
    } else report.fireballLimitation = enemy ? 'Insufficient remaining provider-call budget or no authored Fireball grant.' : 'No living nearby hostile remained after Magic Missile.';
  }
  const bundle = await engine.exportCampaign(state.campaignId);
  await writeFile(join(artifacts, 'campaign.json'), JSON.stringify(bundle, null, 2));
  report.exported = true;
  report.status = report.actions.length ? 'completed' : 'limited';
} catch (error) {
  report.status = 'failed';
  report.error = { code: error.code || null, message: error.message };
  if (state) {
    report.final = await world();
    report.pending = await db.all('SELECT id, request_id, stage, status FROM rules_turn_operations WHERE campaign_id = ?', [state.campaignId]);
  }
  console.error(JSON.stringify(report.error));
  process.exitCode = 1;
} finally {
  report.endedAt = new Date().toISOString();
  await save();
  AIClient.prototype.sendPrompt = originalPrompt;
  globalThis.fetch = originalFetch;
  await db.closeDb();
  console.log(`Live cast artifacts: ${artifacts}`);
}
