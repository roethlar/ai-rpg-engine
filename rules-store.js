import { randomUUID } from 'node:crypto';
import { all, get, run, withWriteTransaction } from './db.js';
import { createCheckRecord, normalizeCheckRecord, validateCheckCall } from './rules-resolution.js';

function fail(code, message) {
  const error = new Error(message);
  error.code = `RULES_STORE_${code}`;
  throw error;
}

function integer(value, name, minimum = 1) {
  if (!Number.isSafeInteger(value) || value < minimum) fail('INVALID', `${name} must be an integer >= ${minimum}.`);
  return value;
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) fail('INVALID', `${name} must be a nonempty string.`);
  return value;
}

// Stable JSON is both the stored snapshot and the idempotency comparison. Do
// not silently discard undefined, non-finite numbers, or non-JSON objects.
function json(value) {
  const ancestors = new Set();
  function normalize(item) {
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return item;
    if (typeof item === 'number' && Number.isFinite(item)) return item;
    if (typeof item !== 'object' || ancestors.has(item)) fail('INVALID', 'Expected acyclic JSON data.');
    const proto = Object.getPrototypeOf(item);
    if (!Array.isArray(item) && proto !== Object.prototype && proto !== null) fail('INVALID', 'Expected plain JSON data.');
    ancestors.add(item);
    const result = Array.isArray(item)
      ? Array.from(item, normalize)
      : Object.fromEntries(Object.keys(item).sort().map(key => [key, normalize(item[key])]));
    ancestors.delete(item);
    return result;
  }
  return JSON.stringify(normalize(value));
}

function operationView(row) {
  if (!row) return null;
  return {
    operationId: row.id,
    campaignId: row.campaign_id,
    actor: row.actor,
    turn: row.turn_number,
    requestId: row.request_id,
    input: JSON.parse(row.input_json),
    catalogVersion: row.catalog_version,
    stage: row.stage,
    data: JSON.parse(row.checkpoint_json),
    revision: row.revision,
    status: row.status,
    result: row.result_json === null ? null : JSON.parse(row.result_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function freezeJson(value) {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(freezeJson);
    Object.freeze(value);
  }
  return value;
}

async function operationRow(operationId) {
  text(operationId, 'operationId');
  const row = await get('SELECT * FROM rules_turn_operations WHERE id = ?', [operationId]);
  if (!row) fail('NOT_FOUND', 'Rules operation does not exist.');
  return row;
}

function active(row) {
  if (row.status !== 'active') fail('COMPLETED', 'Rules operation is already complete.');
}

/** Reserve one accepted action. Classify no-ops first. Exact request retries
 * return the saved operation; every binding field, including input, is fixed.
 * input is JSON (prose plus engine-owned declarations when applicable).
 */
export async function beginRulesOperation({ campaignId, actor, turn, input, catalogVersion, requestId, expectedWorldRevision = null }) {
  integer(campaignId, 'campaignId');
  integer(actor, 'actor');
  integer(turn, 'turn');
  text(catalogVersion, 'catalogVersion');
  text(requestId, 'requestId');
  if (expectedWorldRevision !== null) integer(expectedWorldRevision, 'expectedWorldRevision', 0);
  const inputJson = json(input);
  return withWriteTransaction(async () => {
    const previous = await get('SELECT * FROM rules_turn_operations WHERE request_id = ?', [requestId]);
    if (previous) {
      if (previous.campaign_id !== campaignId || previous.actor !== actor || previous.turn_number !== turn
        || previous.input_json !== inputJson || previous.catalog_version !== catalogVersion) {
        fail('CONFLICT', 'Request identity is already bound to a different action.');
      }
      return operationView(previous);
    }
    if (expectedWorldRevision !== null) {
      const campaign = await get('SELECT rules_revision FROM campaigns WHERE id = ?', [campaignId]);
      if (!campaign || campaign.rules_revision !== expectedWorldRevision) fail('STALE', 'The world changed while this action was being validated.');
    }
    const character = await get('SELECT campaign_id, status FROM characters WHERE id = ?', [actor]);
    if (!character || character.campaign_id !== campaignId || character.status !== 'active') {
      fail('INVALID', 'The acting character must be active in the selected campaign.');
    }
    if (await get("SELECT id FROM rules_turn_operations WHERE campaign_id = ? AND status = 'active'", [campaignId])) {
      fail('CONFLICT', 'This campaign already has an unresolved rules operation.');
    }
    if (await get('SELECT id FROM rules_turn_operations WHERE campaign_id = ? AND turn_number = ?', [campaignId, turn])) {
      fail('CONFLICT', 'This campaign turn is already reserved.');
    }
    const committed = await get('SELECT MAX(turn_number) AS last_turn FROM turns WHERE campaign_id = ?', [campaignId]);
    if (turn !== (committed.last_turn ?? 0) + 1) fail('CONFLICT', 'Only the next uncommitted campaign turn can be reserved.');
    const operationId = randomUUID();
    const timestamp = new Date().toISOString();
    await run(`INSERT INTO rules_turn_operations
      (id, campaign_id, actor, turn_number, request_id, input_json, catalog_version,
        stage, checkpoint_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'accepted', 'null', ?, ?)`,
    [operationId, campaignId, actor, turn, requestId, inputJson, catalogVersion, timestamp, timestamp]);
    return operationView(await operationRow(operationId));
  });
}

/** Read the complete durable binding and latest stage, or null if absent. */
export async function readRulesOperation(operationId) {
  text(operationId, 'operationId');
  return operationView(await get('SELECT * FROM rules_turn_operations WHERE id = ?', [operationId]));
}

/** Internal retry lookup: recover the original reserved turn before consulting
 * current history. Request IDs are global opaque client-generated identities.
 */
export async function readRulesOperationByRequest(requestId) {
  text(requestId, 'requestId');
  return operationView(await get('SELECT * FROM rules_turn_operations WHERE request_id = ?', [requestId]));
}

/** Save validated pre-roll/post-roll work. data is a complete stage snapshot,
 * not a merge patch. CAS prevents concurrent retries overwriting newer work.
 */
export async function checkpointRulesOperation(operationId, { expectedRevision, stage, data }) {
  integer(expectedRevision, 'expectedRevision', 0);
  text(stage, 'stage');
  const dataJson = json(data);
  return withWriteTransaction(async () => {
    const row = await operationRow(operationId);
    active(row);
    if (row.stage === stage && row.checkpoint_json === dataJson) return operationView(row);
    if (row.revision !== expectedRevision) fail('STALE', 'Rules operation checkpoint changed; reload it before continuing.');
    await run(`UPDATE rules_turn_operations SET stage = ?, checkpoint_json = ?,
      revision = revision + 1, updated_at = ? WHERE id = ?`, [stage, dataJson, new Date().toISOString(), operationId]);
    return operationView(await operationRow(operationId));
  });
}

/** Commit final history/world writes and result together. The optional callback
 * runs once under the existing DB write owner; use db.run/get, not a nested
 * transaction. Keep provider/network work outside every store callback.
 */
export async function completeRulesOperation(operationId, result, applyEffects) {
  const resultJson = json(result);
  if (applyEffects !== undefined && typeof applyEffects !== 'function') fail('INVALID', 'applyEffects must be a function.');
  return withWriteTransaction(async () => {
    const row = await operationRow(operationId);
    if (row.status === 'complete') {
      if (row.result_json !== resultJson) fail('CONFLICT', 'Completed operation has a different result.');
      return operationView(row);
    }
    const checks = await all(`SELECT c.record_json, a.finalized FROM rules_checks c
      LEFT JOIN rules_check_annotations a ON a.check_id = c.check_id WHERE c.operation_id = ?`, [operationId]);
    if (checks.some(check => JSON.parse(check.record_json).stakesLicense !== null && check.finalized !== 1)) {
      fail('INVALID', 'Edge checks must finalize their annotation before operation completion.');
    }
    if (applyEffects) await applyEffects(operationView(row));
    await run(`UPDATE rules_turn_operations SET status = 'complete', result_json = ?,
      revision = revision + 1, updated_at = ? WHERE id = ?`, [resultJson, new Date().toISOString(), operationId]);
    return operationView(await operationRow(operationId));
  });
}

function checkKey({ operationId, actor, callSeq }) {
  return [text(operationId, 'operationId'), integer(actor, 'actor'), integer(callSeq, 'callSeq')];
}

async function checkRow(key) {
  return get(`SELECT c.*, a.annotation_json, a.annotation_rejected,
    COALESCE(a.finalized, 0) AS annotation_finalized, a.request_json AS annotation_request_json
    FROM rules_checks c LEFT JOIN rules_check_annotations a ON a.check_id = c.check_id
    WHERE c.operation_id = ? AND c.actor = ? AND c.call_seq = ?`, key);
}

function checkView(row) {
  if (!row) return null;
  return {
    ...JSON.parse(row.record_json),
    operationId: row.operation_id,
    campaignId: row.campaign_id,
    annotation: row.annotation_json === null ? null : JSON.parse(row.annotation_json),
    annotationRejected: row.annotation_rejected,
    annotationFinalized: row.annotation_finalized === 1
  };
}

/** Validate and atomically create an immutable signed check. Exact retries
 * return the old record without calling roll/now/newId. resolverOptions is the
 * pure resolver's deterministic test injection API, not model-authored input.
 */
export async function commitRulesCheck({ operationId, call, skillBonus, activeEncounter }, resolverOptions) {
  text(operationId, 'operationId');
  const requestJson = json({ call, skillBonus, activeEncounter });
  const request = JSON.parse(requestJson);
  return withWriteTransaction(async () => {
    const operation = await operationRow(operationId);
    validateCheckCall(request.call, { actor: operation.actor });
    const key = [operationId, operation.actor, request.call.callSeq];
    const previous = await checkRow(key);
    if (previous) {
      if (previous.request_json !== requestJson) fail('CONFLICT', 'Logical check identity has a different request.');
      return checkView(previous);
    }
    active(operation);
    const prior = await get('SELECT MAX(call_seq) AS last_seq FROM rules_checks WHERE operation_id = ?', [operationId]);
    if (request.call.callSeq !== (prior.last_seq ?? 0) + 1) fail('CONFLICT', 'Check ordinals must be committed in order, starting at one.');
    const record = createCheckRecord({ ...request, actor: operation.actor, turn: operation.turn_number }, resolverOptions);
    await run(`INSERT INTO rules_checks
      (check_id, operation_id, campaign_id, turn_number, actor, call_seq, request_json, record_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [record.checkId, operationId, operation.campaign_id, operation.turn_number, operation.actor, record.callSeq, requestJson, json(record)]);
    return checkView(await checkRow(key));
  });
}

/** Read a committed check, including its separate annotation-finalized sentinel. */
export async function readRulesCheck(key) {
  return checkView(await checkRow(checkKey(key)));
}

/** Append an already validated edge annotation and its catalog effects once.
 * annotationRejected records exhausted validation; a null annotation still
 * finalizes. An effects callback is mandatory for nonempty effects, executes
 * under this transaction, and must perform only awaited database operations.
 */
export async function finalizeRulesAnnotation({ operationId, actor, callSeq, annotation, annotationRejected = null }, applyEffects) {
  const key = checkKey({ operationId, actor, callSeq });
  if (applyEffects !== undefined && typeof applyEffects !== 'function') fail('INVALID', 'applyEffects must be a function.');
  const requestJson = json({ annotation, annotationRejected });
  const snapshot = freezeJson(JSON.parse(requestJson));
  return withWriteTransaction(async () => {
    const row = await checkRow(key);
    if (!row) fail('NOT_FOUND', 'Rules check does not exist.');
    if (row.annotation_finalized === 1) {
      if (row.annotation_request_json !== requestJson) fail('CONFLICT', 'Check annotation is already finalized differently.');
      return checkView(row);
    }
    const operation = await operationRow(operationId);
    active(operation);
    const check = checkView(row);
    if (check.stakesLicense === null) fail('INVALID', 'Only edge-band checks can receive annotations.');
    try {
      normalizeCheckRecord({ ...check, ...snapshot });
    } catch (error) {
      fail('INVALID', error.message);
    }
    if (snapshot.annotation?.effects.length && !applyEffects) fail('INVALID', 'Annotation effects require a transactional applicator.');
    if (applyEffects && snapshot.annotation !== null) await applyEffects(snapshot.annotation, check);
    await run(`INSERT INTO rules_check_annotations
      (check_id, annotation_json, annotation_rejected, finalized, request_json, created_at)
      VALUES (?, ?, ?, 1, ?, ?)`,
    [row.check_id, snapshot.annotation === null ? null : json(snapshot.annotation), snapshot.annotationRejected, requestJson, new Date().toISOString()]);
    return checkView(await checkRow(key));
  });
}
