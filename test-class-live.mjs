import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';

// Explicit opt-in live-provider probe. This file is never imported by test.js.
const modelIndex = process.argv.indexOf('--model');
const model = modelIndex >= 0 ? process.argv[modelIndex + 1] : null;
if (!model || model.startsWith('--')) throw new Error('Usage: node test-class-live.mjs --model <available-ollama-model>');
const resumeIndex = process.argv.indexOf('--resume');
const resume = resumeIndex >= 0 ? resolve(process.argv[resumeIndex + 1]) : null;
if (resume && (dirname(resume) !== resolve(tmpdir()) || !basename(resume).startsWith('aetheria-class-live-'))) throw new Error('Resume requires this probe\'s disposable session directory.');
const artifacts = resume || await mkdtemp(join(tmpdir(), 'aetheria-class-live-'));
process.env.RPG_DB_PATH = join(artifacts, 'session.db');
delete process.env.IMAGE_PROVIDER;
const apiConfig = { provider: 'ollama', model, ollamaUrl: 'http://localhost:11434', imageProvider: '' };
const report = resume ? JSON.parse(await readFile(join(artifacts, 'session.json'), 'utf8'))
  : { provider: apiConfig.provider, model, mocked: false, startedAt: new Date().toISOString(), calls: [], actions: [], artifacts };
if (resume && (report.mocked !== false || report.model !== model || report.artifacts !== artifacts)) throw new Error('Resume must match the original live probe and model.');
const db = await import('./db.js');
const { AIClient } = await import('./api-client.js');
const engine = await import('./rpg-engine.js');
const { readClassWorld } = await import('./class-store.js');
const { CATALOG_VERSION, CATALOG_OPTION_SET } = await import('./class-catalog.js');
const lastFailedAction = resume ? report.actions.findLast(action => action.error) : null;
if (resume) report.resumedAt = new Date().toISOString();
const original = AIClient.prototype.sendPrompt;
AIClient.prototype.sendPrompt = async function (request) {
  if (report.calls.length >= 40) throw new Error('The bounded live session reached its provider-call limit.');
  const stage = /^AETHERIA_COUNCIL:([a-z_]+)/u.exec(request.systemInstruction)?.[1] || 'setup';
  const call = { stage, startedAt: new Date().toISOString(), request };
  report.calls.push(call);
  console.log(`Live call ${report.calls.length}: ${stage}`);
  const started = performance.now();
  try {
    const response = await original.call(this, request);
    call.seconds = Math.round((performance.now() - started) / 100) / 10;
    call.response = response;
    await writeFile(join(artifacts, 'session.json'), JSON.stringify(report, null, 2));
    return response;
  } catch (error) {
    call.seconds = Math.round((performance.now() - started) / 100) / 10;
    call.error = String(error.message).slice(0, 1000);
    throw error;
  }
};
let state;
try {
  await db.initDb();
  if (!resume) await db.run('INSERT INTO server_settings (key, value) VALUES (?, ?)', ['ai_config', JSON.stringify(apiConfig)]);
  state = resume ? await engine.getCampaignState(report.campaignId) : await engine.createCampaign({ genre: 'Fantasy', characterName: 'Mira', characterClass: 'A practical field arcanist.',
    ruleset: 'aetheria', apiConfig,
    classSelection: { catalogVersion: CATALOG_VERSION, optionSet: CATALOG_OPTION_SET, familyId: 'arcanist', branchId: 'arcanist.formula', modules: [], capabilities: { rider: false, alliedActors: false } } });
  report.campaignId = state.campaignId;
  if (!resume) report.opening = state.turn.narrative;
  const submit = async (text, requestId = randomUUID()) => {
    const before = await db.get('SELECT * FROM campaigns WHERE id = ?', [state.campaignId]);
    const calls = report.calls.length;
    const started = performance.now();
    const action = { input: text, requestId };
    report.actions.push(action);
    try {
      state = await engine.takeTurn(state.campaignId, text, apiConfig, state.character.id, state.character.abilityTriggerRevision, { requestId });
      action.seconds = Math.round((performance.now() - started) / 100) / 10;
      action.providerCalls = report.calls.length - calls;
      action.turn = state.turn.number;
      action.inputKind = state.turn.inputKind;
      action.narrative = state.turn.narrative;
      action.checks = state.turn.rollResults;
      const after = await db.get('SELECT * FROM campaigns WHERE id = ?', [state.campaignId]);
      action.worldChanged = before.rules_state_json !== after.rules_state_json;
      if (state.turn.inputKind !== 'committed_action') assert.equal(action.worldChanged, false, 'Live table talk changed the world.');
      console.log(JSON.stringify(action));
    } catch (error) {
      action.error = { code: error.code || null, message: String(error.message).slice(0, 1500) };
      throw error;
    }
  };
  if (resume && lastFailedAction) await submit(lastFailedAction.input, lastFailedAction.requestId);
  else {
    await submit('What do I see here, and what is happening right now?');
    const world = readClassWorld(await db.get('SELECT * FROM campaigns WHERE id = ?', [state.campaignId]));
    const own = world.actors[`character:${state.character.id}`];
    const origin = world.areas[`area:${world.currentLocationId}:${own.area}`];
    const enemy = Object.entries(world.actors).find(([ref, value]) => ref.startsWith('npc:') && value.present && !value.party
      && value.locationId === world.currentLocationId && value.health > 0 && (value.area === own.area || origin.adjacent.includes(value.area)));
    if (enemy) await submit(`I cast Magic Missile at ${enemy[1].name}.`);
    else {
      const destination = origin.adjacent.map(id => world.areas[`area:${world.currentLocationId}:${id}`]).find(area => area.safeToOccupy && !area.blocked);
      if (destination) await submit(`I move into ${destination.name}.`);
      else report.limitation = 'The generated opening offered neither a nearby non-party target nor an ordinary adjacent destination.';
    }
  }
  await submit('What changed after that, and where is everyone now?');
  report.export = 'campaign.json';
  await writeFile(join(artifacts, report.export), JSON.stringify(await engine.exportCampaign(state.campaignId), null, 2));
  report.status = 'passed';
  delete report.error;
} catch (error) {
  report.status = 'failed';
  report.error = { code: error.code || null, message: String(error.message).slice(0, 2000) };
  console.error(JSON.stringify(report.error));
  process.exitCode = 1;
} finally {
  report.endedAt = new Date().toISOString();
  await writeFile(join(artifacts, 'session.json'), JSON.stringify(report, null, 2));
  AIClient.prototype.sendPrompt = original;
  await db.closeDb();
  console.log(`Live session artifacts: ${artifacts}`);
}
