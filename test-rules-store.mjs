import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const code = expected => error => error.code === `RULES_STORE_${expected}`;

/** The main suite initializes its disposable DB before calling this export.
 * Keep DB imports here, after the caller has set RPG_DB_PATH.
 */
export async function runRulesStoreTests() {
  assert.ok(process.env.RPG_DB_PATH, 'Rules store tests require a disposable RPG_DB_PATH.');
  const { run, get, all } = await import('./db.js');
  const {
    beginRulesOperation, readRulesOperation, readRulesOperationByRequest, checkpointRulesOperation,
    completeRulesOperation, commitRulesCheck, readRulesCheck, finalizeRulesAnnotation
  } = await import('./rules-store.js');
  const campaign = await run('INSERT INTO campaigns (title, genre) VALUES (?, ?)', ['Rules store test', 'fantasy']);
  const otherCampaign = await run('INSERT INTO campaigns (title, genre) VALUES (?, ?)', ['Rules store other test', 'fantasy']);
  const makeActor = campaignId => run(`INSERT INTO characters
    (campaign_id, name, class, health, max_health, mana, max_mana, inventory_json, attributes_json)
    VALUES (?, 'Rules tester', 'Fighter', 10, 10, 6, 6, '[]', '{}')`, [campaignId]);
  const actor = (await makeActor(campaign.id)).id;
  const ally = (await makeActor(campaign.id)).id;
  const outsider = (await makeActor(otherCampaign.id)).id;
  const unrelatedKey = `rules-store-${randomUUID()}`;
  try {
    console.log(' - Running durable rules operation/check store tests...');
    const binding = {
      campaignId: campaign.id, actor, turn: 1, input: { prose: 'Strike the foe.', declarations: [] },
      catalogVersion: 'test-catalog-1', requestId: randomUUID()
    };
    const [operation, duplicate] = await Promise.all([beginRulesOperation(binding), beginRulesOperation(binding)]);
    assert.deepEqual(duplicate, operation, 'Concurrent identical requests must reserve exactly one operation.');
    assert.equal(operation.status, 'active');
    assert.equal(operation.revision, 0);
    assert.equal(await readRulesOperation('absent'), null);
    assert.equal(await readRulesOperationByRequest('absent'), null);
    assert.deepEqual(await readRulesOperationByRequest(binding.requestId), operation);
    for (const patch of [
      { input: { prose: 'Attack a different foe.', declarations: [] } },
      { actor: ally }, { campaignId: otherCampaign.id }, { turn: 2 }, { catalogVersion: 'test-catalog-2' }
    ]) {
      await assert.rejects(beginRulesOperation({ ...binding, ...patch }), code('CONFLICT'), 'Request binding must be immutable.');
    }
    await assert.rejects(beginRulesOperation({ ...binding, requestId: randomUUID() }), code('CONFLICT'));
    await assert.rejects(beginRulesOperation({ ...binding, requestId: randomUUID(), actor: outsider }), code('INVALID'));
    await assert.rejects(beginRulesOperation({ ...binding, requestId: randomUUID(), turn: 2 }), code('CONFLICT'));
    await assert.rejects(beginRulesOperation({ ...binding, requestId: randomUUID(), input: { unsupported: undefined } }), code('INVALID'));
    await assert.rejects(run('UPDATE rules_turn_operations SET actor = ? WHERE id = ?', [ally, operation.operationId]), /binding is immutable/);

    const otherBinding = { ...binding, campaignId: otherCampaign.id, actor: outsider, requestId: randomUUID() };
    const pending = await beginRulesOperation(otherBinding);
    await run('INSERT INTO turns (campaign_id, turn_number, narrative) VALUES (?, 1, ?)', [otherCampaign.id, 'Table talk history entry']);
    await assert.rejects(beginRulesOperation({ ...otherBinding, requestId: randomUUID(), turn: 2 }), code('CONFLICT'),
      'Unresolved operations must block new actions even if table-talk history advanced.');
    await assert.rejects(run(`INSERT INTO rules_turn_operations
      (id, campaign_id, actor, turn_number, request_id, input_json, catalog_version,
        stage, checkpoint_json, created_at, updated_at)
      SELECT ?, campaign_id, actor, 2, ?, input_json, catalog_version,
        stage, checkpoint_json, created_at, updated_at FROM rules_turn_operations WHERE id = ?`,
    [randomUUID(), randomUUID(), pending.operationId]), /UNIQUE constraint failed/);
    assert.deepEqual(await readRulesOperationByRequest(otherBinding.requestId), pending);
    await completeRulesOperation(pending.operationId, { recovered: true });
    assert.equal((await beginRulesOperation({ ...otherBinding, requestId: randomUUID(), turn: 2 })).turn, 2);

    const checkpoint = { stage: 'continuity-approved', expectedRevision: 0, data: { intent: 'Strike the foe.', targets: ['foe-1'], accepted: true } };
    const [saved, savedAgain] = await Promise.all([
      checkpointRulesOperation(operation.operationId, checkpoint),
      checkpointRulesOperation(operation.operationId, checkpoint)
    ]);
    assert.deepEqual(savedAgain, saved);
    assert.equal(saved.revision, 1);
    await assert.rejects(checkpointRulesOperation(operation.operationId, { ...checkpoint, data: { targets: ['foe-2'] } }), code('STALE'));
    assert.deepEqual((await beginRulesOperation(binding)).data, checkpoint.data, 'Retry resumes accepted intent, not fresh generation.');

    const call = { actor, callSeq: 1, intent: 'Strike the foe.', tier: 'standard', tierBasis: 'An alert foe in ordinary reach.', deltas: [] };
    const checkInput = { operationId: operation.operationId, call, skillBonus: 0, activeEncounter: true };
    let rolls = 0;
    const resolverOptions = {
      roll: () => { rolls += 1; return 50; },
      now: () => '2026-09-07T12:00:00.000Z',
      newId: () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    };
    await assert.rejects(commitRulesCheck({ ...checkInput, call: { ...call, actor: ally } }, resolverOptions), /actor does not match/);
    await assert.rejects(commitRulesCheck({ ...checkInput, call: { ...call, callSeq: 2 } }, resolverOptions), code('CONFLICT'));
    assert.equal(rolls, 0, 'Invalid binding/order must reject before RNG.');
    const [check, retry] = await Promise.all([
      commitRulesCheck(checkInput, resolverOptions), commitRulesCheck(checkInput, resolverOptions)
    ]);
    assert.equal(rolls, 1, 'Concurrent same-key checks must roll once.');
    assert.deepEqual(retry, check);
    assert.equal(check.T, 50);
    assert.equal(check.raw, 50);
    assert.equal(check.band, 'marginal_success');
    assert.equal(check.annotationFinalized, false);
    const key = { operationId: operation.operationId, actor, callSeq: 1 };
    await assert.rejects(Promise.resolve().then(() => { throw new Error('Narrator unavailable'); }), /Narrator unavailable/);
    assert.deepEqual(await readRulesCheck(key), check, 'Narration failure must not undo an already committed check.');
    const noReroll = { roll: () => assert.fail('Persisted checks must not reroll.') };
    assert.deepEqual(await commitRulesCheck(checkInput, noReroll), check);
    assert.equal(await readRulesCheck({ ...key, callSeq: 99 }), null);
    for (const patch of [
      { call: { ...call, intent: 'Push the foe.' } },
      { skillBonus: 1 }, { activeEncounter: false }
    ]) {
      await assert.rejects(commitRulesCheck({ ...checkInput, ...patch }, noReroll), code('CONFLICT'));
    }
    await assert.rejects(run('UPDATE rules_checks SET record_json = ? WHERE check_id = ?', ['{}', check.checkId]), /check is immutable/);
    const raw = await get('SELECT * FROM rules_checks WHERE check_id = ?', [check.checkId]);
    await assert.rejects(run(`INSERT INTO rules_checks
      (check_id, operation_id, campaign_id, turn_number, actor, call_seq, request_json, record_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [randomUUID(), raw.operation_id, raw.campaign_id, raw.turn_number, raw.actor, raw.call_seq, raw.request_json, raw.record_json]), /UNIQUE constraint failed/);
    await assert.rejects(run(`INSERT INTO rules_checks
      (check_id, operation_id, campaign_id, turn_number, actor, call_seq, request_json, record_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [randomUUID(), raw.operation_id, otherCampaign.id, raw.turn_number, raw.actor, 2, raw.request_json, raw.record_json]), /FOREIGN KEY constraint failed/);

    // A separate connection/process reads the committed checkpoint and outcome;
    // the assertions do not rely on an in-memory request or RNG cache.
    const child = await execFileAsync(process.execPath, ['--input-type=module', '-e', `
      const store = await import(${JSON.stringify(new URL('./rules-store.js', import.meta.url).href)});
      const db = await import(${JSON.stringify(new URL('./db.js', import.meta.url).href)});
      try {
        console.log(JSON.stringify({ operation: await store.readRulesOperation(${JSON.stringify(operation.operationId)}),
          check: await store.readRulesCheck(${JSON.stringify(key)}) }));
      } finally { await db.closeDb(); }
    `], { env: { ...process.env } });
    const reloaded = JSON.parse(child.stdout);
    assert.deepEqual(reloaded.operation, saved);
    assert.deepEqual(reloaded.check, check);

    await assert.rejects(completeRulesOperation(operation.operationId, { narrative: 'Premature' }), code('INVALID'));
    const annotation = { text: 'The foe loses ground.', effects: [{ effectId: 'test_effect', target: actor }], affirmedOpposed: [] };
    await assert.rejects(finalizeRulesAnnotation({ ...key, annotation }), code('INVALID'));
    for (const invalid of [
      { ...annotation, text: '' }, { ...annotation, text: 'x'.repeat(301) },
      { ...annotation, effects: [...annotation.effects, ...annotation.effects] },
      { ...annotation, affirmedOpposed: ['npc:1', 'npc:1'] },
      { ...annotation, affirmedOpposed: ['character:1'] },
      { ...annotation, affirmedOpposed: ['npc:01'] }
    ]) {
      await assert.rejects(finalizeRulesAnnotation({ ...key, annotation: invalid }, () => assert.fail('Invalid envelope must not apply effects.')), code('INVALID'));
    }
    await assert.rejects(finalizeRulesAnnotation({ ...key, annotation: null, annotationRejected: '' }), code('INVALID'));
    await assert.rejects(finalizeRulesAnnotation({ ...key, annotation }, value => { value.effects.push({ effectId: 'mutated' }); }), /not extensible/);
    assert.equal((await readRulesCheck(key)).annotationFinalized, false);
    let entered;
    let release;
    const enteredPromise = new Promise(resolve => { entered = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    const failedAnnotation = finalizeRulesAnnotation({ ...key, annotation }, async () => {
      await run('UPDATE characters SET health = health - 2 WHERE id = ?', [actor]);
      entered();
      await gate;
      throw new Error('Effect transaction failed');
    });
    await enteredPromise;
    let unrelatedCompleted = false;
    const unrelatedWrite = run('INSERT INTO server_settings (key, value) VALUES (?, ?)', [unrelatedKey, 'kept'])
      .then(() => { unrelatedCompleted = true; });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(unrelatedCompleted, false, 'Unrelated writes must not join the annotation transaction.');
    release();
    await assert.rejects(failedAnnotation, /Effect transaction failed/);
    await unrelatedWrite;
    assert.equal((await get('SELECT health FROM characters WHERE id = ?', [actor])).health, 10);
    assert.equal((await get('SELECT value FROM server_settings WHERE key = ?', [unrelatedKey])).value, 'kept');
    assert.equal((await readRulesCheck(key)).annotationFinalized, false);
    let applications = 0;
    const apply = async (value, storedCheck) => {
      assert.deepEqual(value, annotation);
      assert.equal(storedCheck.checkId, check.checkId);
      applications += 1;
      await run('UPDATE characters SET health = health - 2 WHERE id = ?', [actor]);
    };
    const [annotated, annotatedRetry] = await Promise.all([
      finalizeRulesAnnotation({ ...key, annotation }, apply), finalizeRulesAnnotation({ ...key, annotation }, apply)
    ]);
    assert.equal(applications, 1);
    assert.deepEqual(annotatedRetry, annotated);
    assert.equal(annotated.annotationFinalized, true);
    assert.deepEqual(await finalizeRulesAnnotation({ ...key, annotation }), annotated, 'Finalized effects replay needs no applicator.');
    assert.equal((await get('SELECT health FROM characters WHERE id = ?', [actor])).health, 8);
    assert.equal((await get('SELECT record_json FROM rules_checks WHERE check_id = ?', [check.checkId])).record_json, raw.record_json);
    await assert.rejects(finalizeRulesAnnotation({ ...key, annotation: null }), code('CONFLICT'));
    await assert.rejects(run('UPDATE rules_check_annotations SET annotation_json = NULL WHERE check_id = ?', [check.checkId]), /annotation is immutable/);

    const secondInput = { ...checkInput, call: { ...call, callSeq: 2 } };
    await commitRulesCheck(secondInput, { roll: () => 1 });
    const secondKey = { ...key, callSeq: 2 };
    const rejected = { ...secondKey, annotation: null, annotationRejected: 'Both proposals failed catalog validation.' };
    const rejectedCheck = await finalizeRulesAnnotation(rejected, () => assert.fail('Null finalization must not apply effects.'));
    assert.equal(rejectedCheck.annotation, null);
    assert.equal(rejectedCheck.annotationFinalized, true, 'Null/rejected finalization needs its own sentinel.');
    assert.equal(rejectedCheck.annotationRejected, rejected.annotationRejected);
    assert.deepEqual(await finalizeRulesAnnotation(rejected), rejectedCheck);
    await assert.rejects(finalizeRulesAnnotation({ ...rejected, annotationRejected: null }), code('CONFLICT'));
    await assert.rejects(finalizeRulesAnnotation({ ...secondKey, annotation }), code('CONFLICT'));

    const thirdInput = { ...checkInput, call: { ...call, callSeq: 3 } };
    await commitRulesCheck(thirdInput, { roll: () => 80 });
    await assert.rejects(finalizeRulesAnnotation({ ...key, callSeq: 3, annotation: null }), code('INVALID'));
    const result = { narrative: 'The foe retreats.', turn: 1 };
    await assert.rejects(completeRulesOperation(operation.operationId, result, async () => {
      await run('UPDATE characters SET mana = 0 WHERE id = ?', [actor]);
      throw new Error('History commit failed');
    }), /History commit failed/);
    assert.equal((await get('SELECT mana FROM characters WHERE id = ?', [actor])).mana, 6);
    assert.equal((await readRulesOperation(operation.operationId)).status, 'active');
    let completions = 0;
    const complete = async () => {
      completions += 1;
      await run('INSERT INTO turns (campaign_id, turn_number, character_id, player_action, narrative) VALUES (?, ?, ?, ?, ?)',
        [campaign.id, 1, actor, binding.input.prose, result.narrative]);
    };
    const [completed, completedRetry] = await Promise.all([
      completeRulesOperation(operation.operationId, result, complete), completeRulesOperation(operation.operationId, result, complete)
    ]);
    assert.equal(completions, 1);
    assert.deepEqual(completedRetry, completed);
    assert.deepEqual((await beginRulesOperation(binding)).result, result);
    assert.equal(completed.status, 'complete');
    assert.deepEqual(await commitRulesCheck(checkInput, noReroll), annotated);
    await assert.rejects(completeRulesOperation(operation.operationId, { narrative: 'Changed' }), code('CONFLICT'));
    await assert.rejects(checkpointRulesOperation(operation.operationId, { ...checkpoint, expectedRevision: completed.revision }), code('COMPLETED'));
    await assert.rejects(commitRulesCheck({ ...checkInput, call: { ...call, callSeq: 4 } }), code('COMPLETED'));
    await assert.rejects(run("UPDATE rules_turn_operations SET status = 'active', result_json = NULL WHERE id = ?", [operation.operationId]), /Completed rules operation is immutable/);
    const next = await beginRulesOperation({ ...binding, turn: 2, requestId: randomUUID() });
    assert.equal(next.turn, 2);
    assert.equal((await all('SELECT check_id FROM rules_checks WHERE campaign_id = ?', [campaign.id])).length, 3);

    await run('DELETE FROM campaigns WHERE id = ?', [campaign.id]);
    assert.equal((await all('SELECT id FROM rules_turn_operations WHERE campaign_id = ?', [campaign.id])).length, 0);
    assert.equal((await all('SELECT check_id FROM rules_checks WHERE campaign_id = ?', [campaign.id])).length, 0);
    assert.equal(await get('SELECT check_id FROM rules_check_annotations WHERE check_id = ?', [check.checkId]), undefined);
  } finally {
    await run('DELETE FROM server_settings WHERE key = ?', [unrelatedKey]);
    await run('DELETE FROM campaigns WHERE id IN (?, ?)', [campaign.id, otherCampaign.id]);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const directory = await mkdtemp(path.join(tmpdir(), 'aetheria-rules-store-'));
  process.env.RPG_DB_PATH = path.join(directory, 'test.db');
  const db = await import('./db.js');
  try {
    await db.initDb();
    await runRulesStoreTests();
    console.log('Rules store tests passed.');
  } finally {
    await db.closeDb();
    await rm(directory, { recursive: true, force: true });
  }
}
