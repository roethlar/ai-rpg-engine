import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';

// Authored setup only; Council decisions and all turn outcomes use the live path.
if (!process.argv.includes('--live')) throw new Error('Use --live to authorize this bounded disposable spell probe.');
const resumeIndex = process.argv.indexOf('--resume');
const resume = resumeIndex >= 0 ? resolve(process.argv[resumeIndex + 1]) : null;
if (resume && (dirname(resume) !== resolve(tmpdir()) || !basename(resume).startsWith('aetheria-class-live-spells-'))) throw new Error('Resume requires this probe\'s disposable session directory.');
const artifacts = resume || await mkdtemp(join(tmpdir(), 'aetheria-class-live-spells-'));
process.env.RPG_DB_PATH = join(artifacts, 'session.db');
delete process.env.IMAGE_PROVIDER;
const apiConfig = { provider: 'ollama', model: 'deepseek-v4-flash:cloud', ollamaUrl: 'http://localhost:11434', imageProvider: '' };
const report = resume ? JSON.parse(await readFile(join(artifacts, 'session.json'), 'utf8'))
  : { artifacts, startedAt: new Date().toISOString(), setup: 'authored_fixture', turnProvider: 'original',
  outcomeEngine: 'real', fullyUnmockedCreation: false, provider: apiConfig.provider, model: apiConfig.model,
  maximumProviderCalls: 20, setupResponses: [], calls: [], networkCalls: [], actions: [] };
if (resume && (report.artifacts !== artifacts || report.setup !== 'authored_fixture' || report.turnProvider !== 'original'
  || report.outcomeEngine !== 'real' || report.model !== apiConfig.model || report.maximumProviderCalls !== 20)) throw new Error('Resume must preserve this exact authored-setup/live-turn probe and call budget.');
const failedAction = resume && report.status === 'failed' ? report.actions.at(-1) : null;
if (resume && !failedAction?.error) throw new Error('Resume requires the latest recorded action to have failed, not a completed campaign rerun.');
const db = await import('./db.js');
const { AIClient } = await import('./api-client.js');
const engine = await import('./rpg-engine.js');
const { testClassLayout, testSelection } = await import('./test-class-state.mjs');
if (resume) report.resumedAt = new Date().toISOString();
const save = () => writeFile(join(artifacts, 'session.json'), JSON.stringify(report, null, 2));
const originalPrompt = AIClient.prototype.sendPrompt;
const originalFetch = globalThis.fetch;
globalThis.fetch = async function (input, init) {
  const url = typeof input === 'string' ? input : input.url;
  if (!url.includes('/api/chat')) return originalFetch.call(this, input, init);
  if (report.networkCalls.length >= report.maximumProviderCalls) throw new Error('The live spell probe exhausted its 20-provider-call limit.');
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
  const stage = /^AETHERIA_COUNCIL:([a-z_]+)/u.exec(request.systemInstruction)?.[1];
  if (!stage) {
    let response;
    if (request.prompt.startsWith('Draft an epic,')) response = { title: 'Gatehouse spell exchange', setting: 'A raider attacks a field arcanist at an open gatehouse.',
      major_locations: [{ name: 'Gatehouse', description: 'An open gate and adjacent courtyard.' }],
      key_npcs: [{ name: 'Raider', role: 'Hostile swordsman attacking Mira', personality: 'Aggressive and intent on stopping Mira', quirks: '' }],
      starting_quest: { title: 'Hold the gate', description: 'Survive the attacking raider and cross the courtyard.' } };
    else if (request.systemInstruction.includes('persistent structured layout')) response = testClassLayout;
    else if (request.systemInstruction.includes('initial Aetheria scene')) response = { schemaVersion: 1,
      areas: testClassLayout.areas.map(area => ({ area: area.id, terrain: 'dry_ground', traits: ['visible', 'safe', 'visited', 'immediate_threat'], surfaces: ['ground'] })),
      actors: [{ actor: 'player', area: 'gate', allegiance: 'party', profile: null, conditions: [] },
        { actor: 'npc0', area: 'gate', allegiance: 'opposition', profile: 'combatant', conditions: [] }],
      items: [{ key: 'raider-sword', name: 'Raider sword', description: 'A usable ordinary sword raised to strike Mira.',
        kind: 'melee_weapon', weaponCategory: 'simple', holder: { kind: 'actor', key: 'npc0' }, wielded: true, condition: 'pristine' }],
      objects: [], features: [], discoveries: [], encounter: { active: true, opposition: ['npc0'] } };
    else if (request.prompt.startsWith('Set the scene and begin the campaign.')) response = {
      narrative: 'Mira and the hostile Raider are engaged in the Gate area. The Raider has raised a usable sword to strike her and is actively resisting her passage. The adjacent Yard is visible and empty. No bystanders are present.',
      scene_grounding: 'Mira and Raider occupy Gate. The Raider is attacking at close range with a wielded sword; the conflict is active. Yard is adjacent and empty.' };
    else throw new Error(`Unexpected non-Council request; only four setup responses are authored: ${request.systemInstruction.slice(0, 80)}`);
    const text = JSON.stringify(response);
    report.setupResponses.push({ request, response: text });
    await save();
    return text;
  }
  const call = { stage, request };
  report.calls.push(call);
  const start = performance.now();
  console.log(`Live spell call ${report.calls.length}: ${stage}`);
  try { call.response = await originalPrompt.call(this, request); return call.response; }
  catch (error) { call.error = error.message; throw error; }
  finally { call.seconds = Math.round((performance.now() - start) / 100) / 10; await save(); }
};
let state;
const world = async () => JSON.parse((await db.get('SELECT rules_state_json FROM campaigns WHERE id = ?', [state.campaignId])).rules_state_json);
const submit = async (text, requestId = randomUUID()) => {
  const action = { text, requestId, before: await world() };
  report.actions.push(action);
  const start = performance.now();
  const count = report.networkCalls.length;
  try {
    state = await engine.takeTurn(state.campaignId, text, apiConfig, state.character.id, state.character.abilityTriggerRevision, { requestId: action.requestId });
    action.inputKind = state.turn.inputKind;
    action.narrative = state.turn.narrative;
    action.after = await world();
    action.abilityStatus = state.character.abilityStatus;
    const operation = await db.get('SELECT * FROM rules_turn_operations WHERE campaign_id = ? AND request_id = ?', [state.campaignId, action.requestId]);
    action.operation = operation;
    action.checks = operation ? await db.all('SELECT * FROM rules_checks WHERE operation_id = ?', [operation.id]) : [];
    action.turn = await db.get('SELECT * FROM turns WHERE campaign_id = ? ORDER BY turn_number DESC LIMIT 1', [state.campaignId]);
    assert.equal(action.inputKind, 'committed_action', 'A direct cast must not become table talk.');
    assert.equal(operation?.status, 'complete');
    assert.deepEqual(JSON.parse(action.turn.rules_snapshot_json), action.after);
    console.log(JSON.stringify({ text, narrative: action.narrative, checks: action.checks.map(value => JSON.parse(value.record_json)) }));
  } catch (error) {
    action.error = { code: error.code || null, message: error.message };
    action.after = await world();
    action.pending = await db.all('SELECT * FROM rules_turn_operations WHERE campaign_id = ? AND request_id = ?', [state.campaignId, action.requestId]);
    throw error;
  } finally { action.seconds = Math.round((performance.now() - start) / 100) / 10; action.providerCalls = report.networkCalls.length - count; await save(); }
};
try {
  await db.initDb();
  if (!resume) await db.run('INSERT INTO server_settings (key, value) VALUES (?, ?)', ['ai_config', JSON.stringify(apiConfig)]);
  state = resume ? await engine.getCampaignState(report.campaignId) : await engine.createCampaign({ genre: 'Fantasy', characterName: 'Mira', ruleset: 'aetheria', apiConfig,
    classSelection: { ...testSelection(), modules: [], capabilities: { rider: false, alliedActors: false } } });
  assert.equal(report.setupResponses.length, 4);
  report.campaignId = state.campaignId;
  if (!resume) report.initial = await world();
  const raiderRef = Object.keys(report.initial.actors).find(ref => ref.startsWith('npc:'));
  assert.equal(report.initial.actors[raiderRef].opposed, true);
  assert.equal(state.character.level, 1);
  assert.ok(state.character.abilities.some(value => value.name === 'Magic Missile'));
  assert.ok(state.character.abilities.some(value => value.name === 'Fireball'));
  await submit(failedAction?.text || 'I cast Magic Missile directly at the attacking Raider.', failedAction?.requestId || randomUUID());
  const current = await world();
  const raider = current.actors[raiderRef];
  const hero = current.actors[`character:${state.character.id}`];
  const origin = current.areas[`area:${current.currentLocationId}:${hero.area}`];
  const completedSpells = report.actions.filter(action => !action.error && action.operation?.status === 'complete').length;
  if (completedSpells < 2 && raider.health > 0 && hero.health > 0 && raider.present && raider.locationId === hero.locationId
    && (raider.area === hero.area || origin.adjacent.includes(raider.area)) && report.networkCalls.length <= 12) {
    const area = current.areas[`area:${current.currentLocationId}:${raider.area}`];
    await submit(`I cast Fireball directly into ${area.name} at the Raider. I explicitly accept that every occupant is affected, including me if I remain there.`);
  } else if (completedSpells < 2) report.fireballLimitation = 'After the real first turn the actors, range, or remaining call budget did not permit this second direct cast.';
  await writeFile(join(artifacts, 'campaign.json'), JSON.stringify(await engine.exportCampaign(state.campaignId), null, 2));
  report.exported = true;
  report.status = 'completed';
  delete report.error;
} catch (error) {
  report.status = 'failed';
  report.error = { code: error.code || null, message: error.message };
  console.error(JSON.stringify(report.error));
  process.exitCode = 1;
} finally {
  report.endedAt = new Date().toISOString();
  await save();
  AIClient.prototype.sendPrompt = originalPrompt;
  globalThis.fetch = originalFetch;
  await db.closeDb();
  console.log(`Live spell artifacts: ${artifacts}`);
}
