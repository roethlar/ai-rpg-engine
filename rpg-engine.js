import * as db from './db.js';
import { AIClient, resolveAgentConfig } from './api-client.js';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import {
  parseJsonSafe,
  createFallbackSvg,
  validateTurnData,
  validateRequiredChecks,
  rollCheck,
  validateOutlineData,
  forceNoOpTurnState,
  applyCharacterUpdate,
  applyDiceConsequences,
  buildVoiceScript,
  validateRulesetData,
  validateLocationLayout,
  validateLocationOccupancy,
  validateLocationUpdate,
  validateFocalSubject,
  resolveHeroicSubject,
  validateTurnState,
  actingCharacterId,
  advanceTurnOrder,
  removeFromTurnOrder,
  validateTableStyle,
  computeEncounterCadence,
  buildEncounterHistory,
  PACING_TARGETS,
  validateCampaignBundle,
  CAMPAIGN_BUNDLE_VERSION,
  containsStageOnePrivateCanonEcho,
  hasStageOneUnsafePresentationCharacters,
  isStageOneAbilityPresentationOnly,
  normalizeCampaignVocabularyEntries,
  normalizeCharacterAbilityBindings,
  LOCATION_CANVAS,
  TABLE_TALK_KINDS
} from './rpg-state.js';
import { renderLocationMap } from './map-render.js';
import { generateImage, validateIdentityAnchor } from './image-providers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const imagesDir = path.join(__dirname, 'data', 'images');
import { assignNpcVoiceProfile, createNarratorVoiceProfile } from './tts-providers.js';
import {
  getGMSystemInstruction,
  getOutlineSystemInstruction,
  getStageOneAbilityWordingPrompt,
  getStageOneAbilityWordingSystemInstruction
} from './rpg-prompts.js';
import {
  STAGE_ONE_HISTORY_LIMIT,
  STAGE_ONE_MEMORY_LIMIT,
  readCampaignHistory,
  readCampaignMemories,
  readCampaignOutline,
  readStageOneCanonContext
} from './campaign-context.js';
import {
  abilityInvocationRecordFromDeclarations,
  buildAbilityDeclarations,
  buildCharacterAbilityTriggerState,
  emptyAbilityInvocationRecord,
  remapAbilityInvocationRecord,
  safeAbilityInvocationRecord,
  validateAbilityInvocationRecord
} from './ability-trigger-state.js';

// Export these so index/test scripts still have direct access
export { parseJsonSafe, createFallbackSvg };

/**
 * Core game engine functions linking DB and AI clients.
 */

function defaultAttributesForConcept(concept = '') {
  const text = concept.toLowerCase();
  const attributes = { strength: 10, agility: 10, intellect: 10, willpower: 10 };

  const boosts = [
    { key: 'strength', words: ['soldier', 'fighter', 'guard', 'athlete', 'bruiser', 'laborer', 'marine', 'survivor', 'warrior'] },
    { key: 'agility', words: ['pilot', 'runner', 'scout', 'spy', 'thief', 'infiltrator', 'duelist', 'racer', 'acrobat'] },
    { key: 'intellect', words: ['scientist', 'engineer', 'doctor', 'hacker', 'scholar', 'investigator', 'detective', 'analyst', 'technician', 'mage'] },
    { key: 'willpower', words: ['leader', 'diplomat', 'mystic', 'priest', 'psychic', 'medic', 'negotiator', 'artist', 'commander'] }
  ];

  const matched = boosts.filter(boost => boost.words.some(word => text.includes(word))).map(boost => boost.key);
  if (matched.length === 0) {
    attributes.intellect += 1;
    attributes.willpower += 1;
    return attributes;
  }

  attributes[matched[0]] += 4;
  if (matched[1]) {
    attributes[matched[1]] += 2;
  } else {
    attributes.willpower += 1;
  }

  return attributes;
}

function createStarterInventory() {
  return [
    { name: "Field Kit", type: "key", description: "Adaptable personal supplies appropriate to the campaign world.", quantity: 1 },
    { name: "Recovery Patch", type: "consumable", description: "Restores 20 Health Points or equivalent condition strain.", quantity: 2, effect: "heal_20" }
  ];
}

function parseJsonArray(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function parseJsonObject(value, fallback = {}) {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
  } catch (e) {
    return fallback;
  }
}

/**
 * Ability identity (S1.1): an ability IS its engine-issued opaque id, never
 * its display name — renaming used to be indistinguishable from inventing a
 * second ability, so a renamed ability forked on the next level-up. Ids are
 * minted exactly once at first existence (character seeding, an
 * `ability_updates` insert, or the legacy backfill below) and carried
 * unchanged through branch, copy, and fork. Models never have to emit one.
 */
function mintAbilityId() {
  return randomUUID();
}

function abilityIdOf(ability) {
  return typeof ability?.id === 'string' && ability.id.trim() !== '' ? ability.id.trim() : null;
}

/**
 * One-shot legacy backfill: rows written before ids existed are keyed by the
 * name they currently carry in this profile, so they heal on the next touch
 * — a load, a seeding copy, or a fork replay — and keep that id from then on.
 */
export function ensureAbilityIds(abilities) {
  if (!Array.isArray(abilities)) return [];
  return abilities.map(ability => {
    if (!ability || typeof ability !== 'object') return ability;
    return abilityIdOf(ability) ? ability : { ...ability, id: mintAbilityId() };
  });
}

function findAbilityIndex(abilities, ability) {
  // Name matching survives ONLY as the legacy fallback: rows minted before
  // ids, and updates carrying none. An id the engine does not know is
  // treated as absent (mint fresh), never as an error.
  const id = abilityIdOf(ability);
  if (id) {
    const byId = abilities.findIndex(item => abilityIdOf(item) === id);
    if (byId !== -1) return byId;
  }
  return abilities.findIndex(item => item.name.toLowerCase() === ability.name.toLowerCase());
}

function normalizeAbility(ability) {
  if (!ability || typeof ability.name !== 'string' || ability.name.trim() === '') {
    return null;
  }
  const normalized = {
    name: ability.name.trim(),
    description: ability.description || 'A developing capability.',
    tier: ability.tier || 'emerging',
    source: ability.source || 'in-game development'
  };
  const id = abilityIdOf(ability);
  if (id) normalized.id = id;
  return normalized;
}

export function applyAbilityUpdates(character, turnData, turnNumber) {
  if (!Array.isArray(character.abilities)) character.abilities = [];
  const updates = Array.isArray(turnData.ability_updates) ? turnData.ability_updates : [];
  if (updates.length === 0) return;

  const notes = [];
  for (const update of updates) {
    const ability = normalizeAbility(update.ability || {});
    if (!ability) continue;
    const existingIndex = findAbilityIndex(character.abilities, ability);

    if (update.action === 'remove') {
      if (existingIndex !== -1) character.abilities.splice(existingIndex, 1);
    } else if (existingIndex !== -1) {
      const existing = character.abilities[existingIndex];
      character.abilities[existingIndex] = {
        ...existing,
        ...ability,
        // Identity stays the engine's: a matched row keeps its own id, and a
        // legacy row matched by name gains one here.
        id: abilityIdOf(existing) || mintAbilityId()
      };
    } else {
      character.abilities.push({ ...ability, id: mintAbilityId() });
    }

    if (update.note) {
      notes.push(`[Turn ${turnNumber}] ${update.note}`);
    }
  }

  if (notes.length > 0) {
    character.progression_notes = [character.progression_notes, ...notes].filter(Boolean).join('\n');
  }
}

async function getPlayerCharacter(profileId) {
  if (!profileId) return null;
  return db.get(`SELECT * FROM player_characters WHERE id = ?`, [profileId]);
}

const STAGE_ONE_PROPOSAL_SCHEMA_VERSION = 1;
// A single proposal remains one bounded contract with at most one correction.
// Later movement orchestration may request deterministic batches, but this
// seam never hides an unbounded number of model calls inside one invocation.
export const STAGE_ONE_ABILITY_REQUEST_LIMIT = 12;
const STAGE_ONE_ABILITY_ID_LIMIT = 128;
const STAGE_ONE_TERM_LIMIT = 80;
const STAGE_ONE_PROSE_LIMIT = 500;
const STAGE_ONE_EXPLANATION_LIMIT = 500;
const STAGE_ONE_PROMPT_BYTE_LIMIT = 64 * 1024;
const STAGE_ONE_RESPONSE_BYTE_LIMIT = 64 * 1024;

function stageOneProposalError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function invalidStageOneRequest() {
  return stageOneProposalError(
    'STAGE_ONE_PROPOSAL_INPUT_INVALID',
    'Ability wording proposal request is invalid.'
  );
}

function invalidStageOneContract() {
  return stageOneProposalError(
    'STAGE_ONE_PROPOSAL_INVALID',
    'Ability wording proposal did not match the required contract.'
  );
}

function isPositiveSafeInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function isStrictAbilityId(value) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= STAGE_ONE_ABILITY_ID_LIMIT
    && value === value.trim()
    && !/[\u0000-\u001f\u007f-\u009f]/u.test(value);
}

function exactObjectKeys(value, expectedKeys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

function normalizeStageOneText(value, limit) {
  if (typeof value !== 'string') throw invalidStageOneContract();
  const normalized = value.normalize('NFC').trim();
  if (
    normalized.length === 0
    || normalized.length > limit
    || hasStageOneUnsafePresentationCharacters(normalized)
  ) {
    throw invalidStageOneContract();
  }
  return normalized;
}

// Presentation text is never parsed or applied as mechanics. These patterns
// reject high-confidence rule claims before player review; they are a lint
// boundary, not a claim that arbitrary natural-language semantics can be
// classified exhaustively. Canonical engine state and Council adjudication
// remain the only authority for every actual mechanical consequence.
function assertStageOnePresentationOnly(text) {
  if (!isStageOneAbilityPresentationOnly(text)) {
    throw invalidStageOneContract();
  }
}

function validateStageOneExpected(expected) {
  if (
    !expected
    || !isPositiveSafeInteger(expected.campaignId)
    || !isPositiveSafeInteger(expected.characterId)
    || !Array.isArray(expected.requestedAbilityIds)
    || expected.requestedAbilityIds.length === 0
    || expected.requestedAbilityIds.length > STAGE_ONE_ABILITY_REQUEST_LIMIT
    || expected.requestedAbilityIds.some(id => !isStrictAbilityId(id))
    || new Set(expected.requestedAbilityIds).size !== expected.requestedAbilityIds.length
    || !expected.canonBasis
    || typeof expected.canonBasis !== 'object'
    || Array.isArray(expected.canonBasis)
  ) {
    throw invalidStageOneContract();
  }
}

/**
 * Strict, pure Stage-1 model boundary. It accepts raw JSON text, validates an
 * exact requested-id set, and derives engine-owned slots. It never mutates or
 * persists anything and never returns the private canon basis.
 */
export function validateStageOneAbilityWordingProposal(raw, expected) {
  validateStageOneExpected(expected);
  if (
    typeof raw !== 'string'
    || Buffer.byteLength(raw, 'utf8') > STAGE_ONE_RESPONSE_BYTE_LIMIT
  ) {
    throw invalidStageOneContract();
  }

  let parsed;
  try {
    parsed = parseJsonSafe(raw);
  } catch {
    throw invalidStageOneContract();
  }

  if (!exactObjectKeys(parsed, ['schema_version', 'campaign_id', 'character_id', 'abilities'])) {
    throw invalidStageOneContract();
  }
  if (
    parsed.schema_version !== STAGE_ONE_PROPOSAL_SCHEMA_VERSION
    || parsed.campaign_id !== expected.campaignId
    || parsed.character_id !== expected.characterId
    || !Array.isArray(parsed.abilities)
    || parsed.abilities.length !== expected.requestedAbilityIds.length
  ) {
    throw invalidStageOneContract();
  }

  const requestedIds = new Set(expected.requestedAbilityIds);
  const rowsById = new Map();

  for (const row of parsed.abilities) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw invalidStageOneContract();
    }
    const id = row.ability_id;
    if (!isStrictAbilityId(id) || !requestedIds.has(id) || rowsById.has(id)) {
      throw invalidStageOneContract();
    }

    let normalized;
    if (row.status === 'ready') {
      if (!exactObjectKeys(row, ['ability_id', 'status', 'term', 'prose', 'fit_explanation'])) {
        throw invalidStageOneContract();
      }
      const term = normalizeStageOneText(row.term, STAGE_ONE_TERM_LIMIT);
      const prose = normalizeStageOneText(row.prose, STAGE_ONE_PROSE_LIMIT);
      const fitExplanation = normalizeStageOneText(
        row.fit_explanation,
        STAGE_ONE_EXPLANATION_LIMIT
      );
      for (const text of [term, prose, fitExplanation]) {
        assertStageOnePresentationOnly(text);
        if (containsStageOnePrivateCanonEcho(text, expected.canonBasis)) {
          throw invalidStageOneContract();
        }
      }
      normalized = {
        slot: `ability:${id}`,
        abilityId: id,
        status: 'ready',
        term,
        prose,
        fitExplanation
      };
    } else if (row.status === 'needs_choice') {
      if (!exactObjectKeys(row, ['ability_id', 'status', 'fit_explanation'])) {
        throw invalidStageOneContract();
      }
      const fitExplanation = normalizeStageOneText(
        row.fit_explanation,
        STAGE_ONE_EXPLANATION_LIMIT
      );
      assertStageOnePresentationOnly(fitExplanation);
      if (containsStageOnePrivateCanonEcho(fitExplanation, expected.canonBasis)) {
        throw invalidStageOneContract();
      }
      normalized = {
        slot: `ability:${id}`,
        abilityId: id,
        status: 'needs_choice',
        fitExplanation
      };
    } else {
      throw invalidStageOneContract();
    }

    rowsById.set(id, normalized);
  }

  return {
    schemaVersion: STAGE_ONE_PROPOSAL_SCHEMA_VERSION,
    campaignId: expected.campaignId,
    characterId: expected.characterId,
    abilities: expected.requestedAbilityIds.map(id => rowsById.get(id))
  };
}

function requestedStageOneAbilities(profile, requestedAbilityIds) {
  if (
    !Array.isArray(requestedAbilityIds)
    || requestedAbilityIds.length === 0
    || requestedAbilityIds.length > STAGE_ONE_ABILITY_REQUEST_LIMIT
    || requestedAbilityIds.some(id => !isStrictAbilityId(id))
    || new Set(requestedAbilityIds).size !== requestedAbilityIds.length
  ) {
    throw invalidStageOneRequest();
  }

  const canonicalAbilities = parseJsonArray(profile.abilities_json);
  const requestedIds = new Set(requestedAbilityIds);
  const byId = new Map();
  for (const ability of canonicalAbilities) {
    if (!ability || typeof ability !== 'object' || Array.isArray(ability)) continue;
    if (!isStrictAbilityId(ability.id) || !requestedIds.has(ability.id)) continue;
    if (byId.has(ability.id)) throw invalidStageOneRequest();
    byId.set(ability.id, ability);
  }

  return requestedAbilityIds.map(id => {
    const ability = byId.get(id);
    if (!ability || typeof ability.name !== 'string' || ability.name.trim() === '') {
      throw invalidStageOneRequest();
    }
    const name = ability.name.normalize('NFC').trim();
    const description = typeof ability.description === 'string'
      ? ability.description.normalize('NFC').trim()
      : '';
    if (
      name.length > 200
      || description.length > 2000
      || /[\u0000-\u001f\u007f-\u009f]/u.test(name)
      || /[\u0000-\u001f\u007f-\u009f]/u.test(description)
    ) {
      throw invalidStageOneRequest();
    }
    return { id, name, description };
  });
}

/**
 * Read-only S1.3 proposal seam. The persistent player-character profile is
 * authoritative; campaign-local character rows are never accepted here.
 */
export async function proposeStageOneAbilityWording(
  { campaignId, characterId, requestedAbilityIds, apiConfig } = {},
  { client = null } = {}
) {
  if (!isPositiveSafeInteger(campaignId) || !isPositiveSafeInteger(characterId)) {
    throw invalidStageOneRequest();
  }

  const profile = await getPlayerCharacter(characterId);
  if (!profile) throw invalidStageOneRequest();
  const abilities = requestedStageOneAbilities(profile, requestedAbilityIds);
  const canonContext = await readStageOneCanonContext(campaignId);
  if (!canonContext) {
    throw stageOneProposalError(
      'STAGE_ONE_PROPOSAL_CONTEXT_UNAVAILABLE',
      'Ability wording proposal context is unavailable.'
    );
  }

  const expected = {
    campaignId,
    characterId,
    requestedAbilityIds: abilities.map(ability => ability.id),
    canonBasis: canonContext.basis
  };
  const systemInstruction = getStageOneAbilityWordingSystemInstruction();
  const prompts = [false, true].map(correction => getStageOneAbilityWordingPrompt({
    campaignId,
    characterId,
    abilities,
    canonBasis: canonContext.basis,
    correction
  }));
  if (prompts.some(prompt => Buffer.byteLength(prompt, 'utf8') > STAGE_ONE_PROMPT_BYTE_LIMIT)) {
    throw stageOneProposalError(
      'STAGE_ONE_PROPOSAL_CONTEXT_TOO_LARGE',
      'Ability wording proposal context is too large.'
    );
  }
  const proposalClient = client || new AIClient(resolveAgentConfig(apiConfig, 'continuity'));

  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await proposalClient.sendPrompt({
      systemInstruction,
      prompt: prompts[attempt],
      jsonMode: true
    });
    try {
      const proposal = validateStageOneAbilityWordingProposal(raw, expected);
      return {
        ...proposal,
        canonBasisDigest: canonContext.digest
      };
    } catch (error) {
      if (error?.code !== 'STAGE_ONE_PROPOSAL_INVALID') throw error;
      if (attempt === 1) {
        throw stageOneProposalError(
          'STAGE_ONE_PROPOSAL_FAILED',
          'The GM could not produce a valid ability wording proposal.'
        );
      }
    }
  }

  throw stageOneProposalError(
    'STAGE_ONE_PROPOSAL_FAILED',
    'The GM could not produce a valid ability wording proposal.'
  );
}

function stageOneBindingStoreError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function invalidStageOneBindingStoreInput() {
  return stageOneBindingStoreError(
    'STAGE_ONE_BINDING_INPUT_INVALID',
    'Ability wording binding request is invalid.'
  );
}

function conflictingStageOneBinding() {
  return stageOneBindingStoreError(
    'STAGE_ONE_BINDING_CONFLICT',
    'Approved ability wording cannot be changed.'
  );
}

function staleStageOneVocabulary() {
  return stageOneBindingStoreError(
    'STAGE_ONE_VOCABULARY_STALE',
    'Campaign ability vocabulary changed before approval.'
  );
}

function hydrateStageOneVocabularyEntry(row) {
  return {
    key: row.semantic_key,
    term: row.term,
    provenance: row.provenance,
    vocabularyVersion: row.vocabulary_version,
    createdAt: row.created_at
  };
}

function hydrateStageOneAbilityBinding(row) {
  return {
    characterId: row.player_character_id,
    campaignId: row.campaign_id,
    abilityId: row.ability_id,
    term: row.term,
    prose: row.prose,
    provenance: row.provenance,
    vocabularyVersion: row.vocabulary_version,
    bindingSetRevision: row.binding_set_revision,
    createdAt: row.created_at
  };
}

function validateStageOneBindingIdentity(campaignId, characterId) {
  if (!isPositiveSafeInteger(campaignId) || !isPositiveSafeInteger(characterId)) {
    throw invalidStageOneBindingStoreInput();
  }
}

function validateStageOneBindingAbilityIds(abilityIds) {
  if (
    !Array.isArray(abilityIds)
    || abilityIds.length === 0
    || abilityIds.length > STAGE_ONE_ABILITY_REQUEST_LIMIT
    || abilityIds.some(id => !isStrictAbilityId(id))
    || new Set(abilityIds).size !== abilityIds.length
  ) {
    throw invalidStageOneBindingStoreInput();
  }
}

/**
 * Converts only a validated S1.3 ready proposal into the character-local
 * fields S1.4 is allowed to persist. Fit rationale, freshness digest, slots,
 * status, and every private canon input are deliberately discarded.
 */
export function extractPersistableStageOneAbilityBindings(
  proposal,
  { campaignId, characterId, expectedMissingAbilityIds } = {}
) {
  validateStageOneBindingIdentity(campaignId, characterId);
  validateStageOneBindingAbilityIds(expectedMissingAbilityIds);
  if (
    !exactObjectKeys(proposal, [
      'schemaVersion',
      'campaignId',
      'characterId',
      'abilities',
      'canonBasisDigest'
    ])
    || proposal.schemaVersion !== STAGE_ONE_PROPOSAL_SCHEMA_VERSION
    || proposal.campaignId !== campaignId
    || proposal.characterId !== characterId
    || !/^[a-f0-9]{64}$/u.test(proposal.canonBasisDigest)
    || !Array.isArray(proposal.abilities)
    || proposal.abilities.length !== expectedMissingAbilityIds.length
  ) {
    throw invalidStageOneBindingStoreInput();
  }

  const rowsById = new Map();
  for (const row of proposal.abilities) {
    if (
      !exactObjectKeys(row, [
        'slot',
        'abilityId',
        'status',
        'term',
        'prose',
        'fitExplanation'
      ])
      || row.status !== 'ready'
      || row.slot !== `ability:${row.abilityId}`
      || !expectedMissingAbilityIds.includes(row.abilityId)
      || rowsById.has(row.abilityId)
    ) {
      throw invalidStageOneBindingStoreInput();
    }
    try {
      assertStageOnePresentationOnly(row.term);
      assertStageOnePresentationOnly(row.prose);
      normalizeStageOneText(row.fitExplanation, STAGE_ONE_EXPLANATION_LIMIT);
    } catch {
      throw invalidStageOneBindingStoreInput();
    }
    rowsById.set(row.abilityId, {
      abilityId: row.abilityId,
      term: row.term,
      prose: row.prose,
      provenance: 'generated'
    });
  }

  let bindings;
  try {
    bindings = normalizeCharacterAbilityBindings(
      expectedMissingAbilityIds.map(id => rowsById.get(id))
    );
  } catch {
    throw invalidStageOneBindingStoreInput();
  }
  return { campaignId, characterId, bindings };
}

/** Read the immutable shared vocabulary; an absent state row is version 0. */
export async function readStageOneCampaignVocabulary(campaignId) {
  if (!isPositiveSafeInteger(campaignId)) throw invalidStageOneBindingStoreInput();
  return db.withReadTransaction(async () => {
    const campaign = await db.get(`SELECT id FROM campaigns WHERE id = ?`, [campaignId]);
    if (!campaign) throw invalidStageOneBindingStoreInput();
    const state = await db.get(
      `SELECT vocabulary_version FROM campaign_vocabulary_state WHERE campaign_id = ?`,
      [campaignId]
    );
    const rows = await db.all(
      `SELECT * FROM campaign_vocabulary_entries
       WHERE campaign_id = ? ORDER BY semantic_key ASC`,
      [campaignId]
    );
    return {
      campaignId,
      vocabularyVersion: state?.vocabulary_version ?? 0,
      entries: rows.map(hydrateStageOneVocabularyEntry)
    };
  });
}

/** Read one character's destination-specific wording, never another's. */
export async function readStageOneAbilityBindings(characterId, campaignId) {
  validateStageOneBindingIdentity(campaignId, characterId);
  return db.withReadTransaction(async () => {
    const [campaign, profile] = await Promise.all([
      db.get(`SELECT id FROM campaigns WHERE id = ?`, [campaignId]),
      getPlayerCharacter(characterId)
    ]);
    if (!campaign || !profile) throw invalidStageOneBindingStoreInput();
    const rows = await db.all(
      `SELECT * FROM character_ability_bindings
       WHERE player_character_id = ? AND campaign_id = ?
       ORDER BY ability_id ASC`,
      [characterId, campaignId]
    );
    return rows.map(hydrateStageOneAbilityBinding);
  });
}

/**
 * Resolves a requested canonical ability set into exact saved rows plus only
 * the IDs that still need S1.3 review. Existing wording is returned verbatim.
 */
export async function readStageOneAbilityBindingStatus({
  campaignId,
  characterId,
  requestedAbilityIds
} = {}) {
  validateStageOneBindingIdentity(campaignId, characterId);
  validateStageOneBindingAbilityIds(requestedAbilityIds);
  return db.withReadTransaction(async () => {
    const [campaign, profile] = await Promise.all([
      db.get(`SELECT id FROM campaigns WHERE id = ?`, [campaignId]),
      getPlayerCharacter(characterId)
    ]);
    if (!campaign || !profile) throw invalidStageOneBindingStoreInput();
    try {
      requestedStageOneAbilities(profile, requestedAbilityIds);
    } catch {
      throw invalidStageOneBindingStoreInput();
    }

    const placeholders = requestedAbilityIds.map(() => '?').join(', ');
    const rows = await db.all(
      `SELECT * FROM character_ability_bindings
       WHERE player_character_id = ? AND campaign_id = ?
         AND ability_id IN (${placeholders})`,
      [characterId, campaignId, ...requestedAbilityIds]
    );
    const byId = new Map(rows.map(row => [row.ability_id, hydrateStageOneAbilityBinding(row)]));
    return {
      campaignId,
      characterId,
      bindings: requestedAbilityIds.filter(id => byId.has(id)).map(id => byId.get(id)),
      missingAbilityIds: requestedAbilityIds.filter(id => !byId.has(id))
    };
  });
}

/**
 * Atomically appends approved shared terms and character-local wording.
 * There is intentionally no update/upsert/delete wording path. Exact replay
 * is idempotent; any changed approved text conflicts. S1.3 currently has no
 * engine-owned semantic-key producer, so sharedEntries must be empty and keys
 * are never inferred from free-form ability wording.
 */
export async function storeApprovedStageOneAbilityBindings({
  campaignId,
  characterId,
  expectedVocabularyVersion,
  sharedEntries = [],
  bindings
} = {}) {
  validateStageOneBindingIdentity(campaignId, characterId);
  if (!Number.isSafeInteger(expectedVocabularyVersion) || expectedVocabularyVersion < 0) {
    throw invalidStageOneBindingStoreInput();
  }

  let normalizedEntries;
  let normalizedBindings;
  try {
    normalizedEntries = normalizeCampaignVocabularyEntries(sharedEntries);
    normalizedBindings = normalizeCharacterAbilityBindings(bindings);
  } catch {
    throw invalidStageOneBindingStoreInput();
  }
  if (normalizedEntries.length !== 0) {
    throw invalidStageOneBindingStoreInput();
  }
  for (const binding of normalizedBindings) {
    try {
      assertStageOnePresentationOnly(binding.term);
      assertStageOnePresentationOnly(binding.prose);
    } catch {
      throw invalidStageOneBindingStoreInput();
    }
  }

  return db.withWriteTransaction(async () => {
    const campaign = await db.get(`SELECT id FROM campaigns WHERE id = ?`, [campaignId]);
    const profile = await getPlayerCharacter(characterId);
    if (!campaign || !profile) throw invalidStageOneBindingStoreInput();
    try {
      requestedStageOneAbilities(
        profile,
        normalizedBindings.map(binding => binding.abilityId)
      );
    } catch {
      throw invalidStageOneBindingStoreInput();
    }

    const vocabularyState = await db.get(
      `SELECT vocabulary_version FROM campaign_vocabulary_state WHERE campaign_id = ?`,
      [campaignId]
    );
    const currentVocabularyVersion = vocabularyState?.vocabulary_version ?? 0;

    const existingBindingRows = await db.all(
      `SELECT * FROM character_ability_bindings
       WHERE player_character_id = ? AND campaign_id = ?
         AND ability_id IN (${normalizedBindings.map(() => '?').join(', ')})`,
      [characterId, campaignId, ...normalizedBindings.map(binding => binding.abilityId)]
    );
    const existingBindings = new Map(existingBindingRows.map(row => [row.ability_id, row]));
    for (const binding of normalizedBindings) {
      const existing = existingBindings.get(binding.abilityId);
      if (
        existing
        && (
          existing.term !== binding.term
          || existing.prose !== binding.prose
          || existing.provenance !== binding.provenance
        )
      ) {
        throw conflictingStageOneBinding();
      }
    }

    const newBindings = normalizedBindings.filter(binding => !existingBindings.has(binding.abilityId));
    if (newBindings.length > 0) {
      const canonContext = await readStageOneCanonContext(campaignId);
      if (!canonContext) throw invalidStageOneBindingStoreInput();
      for (const binding of newBindings) {
        if (
          containsStageOnePrivateCanonEcho(binding.term, canonContext.basis)
          || containsStageOnePrivateCanonEcho(binding.prose, canonContext.basis)
        ) {
          throw invalidStageOneBindingStoreInput();
        }
      }
    }
    const exactReplay = newBindings.length === 0;
    if (currentVocabularyVersion !== expectedVocabularyVersion && !exactReplay) {
      throw staleStageOneVocabulary();
    }

    const resultingVocabularyVersion = currentVocabularyVersion;

    if (newBindings.length > 0) {
      const revisionRow = await db.get(
        `SELECT COALESCE(MAX(binding_set_revision), 0) AS revision
         FROM character_ability_bindings
         WHERE player_character_id = ? AND campaign_id = ?`,
        [characterId, campaignId]
      );
      if (revisionRow.revision >= Number.MAX_SAFE_INTEGER - 1) {
        throw invalidStageOneBindingStoreInput();
      }
      const bindingSetRevision = revisionRow.revision + 1;
      for (const binding of newBindings) {
        await db.run(
          `INSERT INTO character_ability_bindings
             (player_character_id, campaign_id, ability_id, term, prose,
              provenance, vocabulary_version, binding_set_revision)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            characterId,
            campaignId,
            binding.abilityId,
            binding.term,
            binding.prose,
            binding.provenance,
            resultingVocabularyVersion,
            bindingSetRevision
          ]
        );
      }
    }

    const storedRows = await db.all(
      `SELECT * FROM character_ability_bindings
       WHERE player_character_id = ? AND campaign_id = ?
         AND ability_id IN (${normalizedBindings.map(() => '?').join(', ')})`,
      [characterId, campaignId, ...normalizedBindings.map(binding => binding.abilityId)]
    );
    const storedById = new Map(storedRows.map(row => [row.ability_id, row]));
    return {
      campaignId,
      characterId,
      vocabularyVersion: resultingVocabularyVersion,
      bindings: normalizedBindings.map(binding => (
        hydrateStageOneAbilityBinding(storedById.get(binding.abilityId))
      ))
    };
  });
}

/**
 * Phase 3 M1: a campaign holds a party. Rows hydrate to the engine's
 * character shape (now carrying id + initiative); the acting character is
 * selected by the caller (v1 turn order in M2; first member for legacy
 * single-character flows).
 */
function hydrateCharacterRow(row) {
  return {
    id: row.id,
    name: row.name,
    class: row.class,
    health: row.health,
    max_health: row.max_health,
    mana: row.mana,
    max_mana: row.max_mana,
    xp: row.xp,
    level: row.level,
    initiative: row.initiative ?? null,
    inventory: parseJsonArray(row.inventory_json),
    attributes: parseJsonObject(row.attributes_json),
    abilities: ensureAbilityIds(parseJsonArray(row.abilities_json)),
    progression_notes: row.progression_notes || '',
    player_character_id: row.player_character_id
  };
}

/**
 * Resolves which party member is speaking for this request (sv-1, round 2).
 *
 * A SUPPLIED character id is authoritative and must name a currently active
 * party member — always, even when the party has shrunk to one. The old
 * `party.length === 1` fast path discarded the id and bound the request to
 * the sole survivor, which is the real root of sv-1 in both its forms:
 *
 *   - persisted: a released character's seat token, still live, acts as the
 *     remaining player (closed also by revoke-on-release); and
 *   - in-flight (TOCTOU): `authenticate` captures the seat's characterId,
 *     then the request awaits the AI-config lookup and the campaign queue.
 *     A release landing in that window leaves a *live, already-authorized*
 *     context whose character is gone — and the fast path re-bound it.
 *     Revoking the credential cannot close this; only refusing to re-bind can.
 *
 * Omitting the id stays legal for the host's solo/single-character play,
 * where there is exactly one member and no ambiguity about who acts. Seats
 * always supply an id (the server derives it from the credential), so a
 * seat can never reach the omitted-id path.
 */
export function selectSpeakingCharacter(party, submittingCharacterId) {
  const supplied = submittingCharacterId !== null && submittingCharacterId !== undefined;
  if (supplied) {
    const character = party.find(c => c.id === Number(submittingCharacterId));
    if (!character) {
      const err = new Error('That character is no longer at this table.');
      err.code = 'CHARACTER_NOT_AT_TABLE';
      // sv-2: OPT IN to disclosure. The trust boundary reveals publicMessage
      // only — never message — so a player-authored ruling must say so.
      err.publicMessage = err.message;
      throw err;
    }
    return character;
  }
  if (party.length === 1) return party[0];
  const err = new Error('This campaign seats multiple characters: the request must say which character is speaking (characterId).');
  err.code = 'CHARACTER_REQUIRED';
  err.publicMessage = err.message; // sv-2: authored for players
  throw err;
}

async function loadParty(campaignId) {
  // Released members keep their row for history but leave the table (M3);
  // legacy rows predate the status column and count as active.
  const rows = await db.all(
    `SELECT * FROM characters WHERE campaign_id = ? AND COALESCE(status, 'active') = 'active' ORDER BY id ASC`,
    [campaignId]
  );
  const party = rows.map(hydrateCharacterRow);
  const bindingRows = await db.all(
    `SELECT player_character_id, ability_id, term, prose
       FROM character_ability_bindings
      WHERE campaign_id = ?
      ORDER BY player_character_id ASC, ability_id ASC`,
    [campaignId]
  );
  const bindingsByProfile = new Map();
  for (const row of bindingRows) {
    const bindings = bindingsByProfile.get(row.player_character_id) || [];
    bindings.push({
      abilityId: row.ability_id,
      term: row.term,
      // AKP-1 keeps the runtime inert until the catalog/binding schema owns
      // curated aliases. Never infer aliases from prose or spacing.
      aliases: [],
      prose: row.prose
    });
    bindingsByProfile.set(row.player_character_id, bindings);
  }

  return party.map(character => ({
    ...character,
    ...buildCharacterAbilityTriggerState({
      campaignId,
      character,
      bindings: bindingsByProfile.get(character.player_character_id) || []
    })
  }));
}

function characterBaselineJson(seed) {
  return JSON.stringify({
    health: seed.health,
    max_health: seed.max_health,
    mana: seed.mana,
    max_mana: seed.max_mana,
    xp: seed.xp,
    level: seed.level,
    inventory: seed.inventory,
    abilities: seed.abilities,
    progression_notes: seed.progression_notes || ''
  });
}

async function saveCharacterState(character) {
  await db.run(
    `UPDATE characters SET health = ?, max_health = ?, mana = ?, max_mana = ?, xp = ?, level = ?,
     inventory_json = ?, abilities_json = ?, progression_notes = ? WHERE id = ?`,
    [
      character.health,
      character.max_health,
      character.mana,
      character.max_mana,
      character.xp,
      character.level,
      JSON.stringify(character.inventory),
      JSON.stringify(character.abilities),
      character.progression_notes || '',
      character.id
    ]
  );
}

async function syncPlayerCharacter(profileId, campaignId, character, status = 'checked_out') {
  if (!profileId) return;
  await db.run(
    `UPDATE player_characters
     SET status = ?, active_campaign_id = ?, health = ?, max_health = ?, mana = ?, max_mana = ?, xp = ?, level = ?,
         inventory_json = ?, attributes_json = ?, abilities_json = ?, progression_notes = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      status,
      status === 'available' ? null : campaignId,
      character.health,
      character.max_health,
      character.mana,
      character.max_mana,
      character.xp,
      character.level,
      JSON.stringify(character.inventory || []),
      JSON.stringify(character.attributes || {}),
      JSON.stringify(character.abilities || []),
      character.progression_notes || '',
      profileId
    ]
  );
}

function compactJson(value) {
  return JSON.stringify(value, null, 2);
}

export function buildCouncilAbilityDeclarationInstructions(abilityDeclarations) {
  return `=== ENGINE-VALIDATED ABILITY DECLARATIONS ===
${compactJson(abilityDeclarations)}

These declarations mean only that the authenticated speaking character's exact owned campaign
term appeared in the submitted prose. They are immutable engine context: do not invent, delete,
rename, replace, or infer an undeclared ability from similar prose. A typo suggestion is not a
declaration until the submitted prose is corrected. Recognition does not prove intent, legality,
availability, resource payment, prerequisites, target, success, or action-economy compatibility.
Interaction and Referee still classify whether the player is attempting use now; clarification and
dialogue remain strict no-op turns even if a declaration is present. Never expose ability-instance
IDs or catalog definition IDs in player-facing narration.`;
}

export function stampServerAbilityDeclarations(modelTurn, abilityDeclarations) {
  if (!modelTurn || typeof modelTurn !== 'object' || Array.isArray(modelTurn)) return modelTurn;
  for (const key of [
    'abilityDeclarations',
    'ability_invocations',
    'abilityInvocations',
    'ability_ids',
    'abilityIds',
    'ability_matches',
    'abilityMatches'
  ]) {
    delete modelTurn[key];
  }
  modelTurn.ability_declarations = abilityDeclarations;
  return modelTurn;
}

function scrubDeclaredAbilityIdsFromPlayerText(turnData, abilityDeclarations) {
  const replacements = [];
  for (const ability of abilityDeclarations.abilities) {
    for (const opaque of [ability.ability_id, ability.definition_id]) {
      if (opaque) replacements.push([opaque, ability.campaign_term || ability.canonical_name || 'ability']);
    }
  }
  const scrub = value => {
    if (typeof value !== 'string') return value;
    return replacements.reduce(
      (text, [opaque, replacement]) => text.split(opaque).join(replacement),
      value
    );
  };
  turnData.narrative = scrub(turnData.narrative);
  turnData.scene_grounding = scrub(turnData.scene_grounding);
  turnData.suggested_choices = turnData.suggested_choices.map(scrub);
  turnData.narration_lines = turnData.narration_lines.map(line => ({
    ...line,
    text: scrub(line.text)
  }));
}

/**
 * Structured location state (Phase V2): DB row ↔ engine shape helpers.
 * The lookup key is the normalized name so the Referee can reference
 * locations by name without knowing row ids.
 */
function locationKey(name) {
  return String(name).trim().toLowerCase();
}

function hydrateLocationRow(row) {
  if (!row) return null;
  const layout = validateLocationLayout(parseJsonObject(row.layout_json, null));
  if (!layout) return null;
  return {
    id: row.id,
    name: row.name,
    layout,
    occupancy: validateLocationOccupancy(parseJsonArray(row.occupancy_json), layout)
  };
}

async function getCurrentLocation(campaign) {
  if (!campaign.current_location_id) return null;
  const row = await db.get(
    `SELECT * FROM locations WHERE id = ? AND campaign_id = ?`,
    [campaign.current_location_id, campaign.id]
  );
  return hydrateLocationRow(row);
}

/**
 * Builds the player-facing location view on a turn payload: the stored
 * structured state plus its deterministic map render. Display only — the
 * mutation path runs through the referee/continuity gate.
 */
function buildLocationView(location, positional = false) {
  if (!location) return null;
  return {
    name: location.name,
    positional: !!positional,
    layout: location.layout,
    occupancy: location.occupancy,
    mapSvg: renderLocationMap(location.layout, location.occupancy)
  };
}

/**
 * Heroic render pipeline (Phase V3): given the engine's stickiness decision,
 * compose the prompt (identity anchor + current mutable state), call the
 * image seam, and hand back everything the turn transaction needs to commit.
 * Any failure returns null — the previous heroic persists and the turn is
 * never killed by image generation.
 */
/**
 * V5b: a one-time visual appearance for an NPC — improvised once by the
 * continuity role and committed as canon via the identity anchor (the
 * omniscience pattern: improvise, then record). Injectable client so tests
 * can stub it; returns null on failure and the caller falls back to the
 * mechanical character-notes composition.
 */
export async function generateNpcAppearance(client, npc, genre) {
  const system = `You define the stable visual appearance of one RPG NPC.
Return JSON only: {"appearance": "2-3 sentences of purely physical description — build, face, hair, attire, distinguishing marks — that a portrait artist could paint. Consistent with the character notes; no personality abstractions, no actions."}`;
  const prompt = `Genre: ${genre}. NPC: ${npc.name}, ${npc.role || 'a notable figure'}. Personality: ${npc.personality || 'unknown'}. Habits: ${npc.quirks || 'none recorded'}.`;
  try {
    const parsed = parseJsonSafe(await client.sendPrompt({ systemInstruction: system, prompt, jsonMode: true }));
    const appearance = typeof parsed?.appearance === 'string' ? parsed.appearance.trim().slice(0, 700) : '';
    if (appearance) return `${npc.name}: ${appearance}`;
  } catch (error) {
    // sv-2: parseJsonSafe moved model output to error.rawText; logging only
    // error.message would silently lose the operator's diagnostics.
    console.warn(`[HEROIC] Appearance generation for "${npc.name}" failed (${error.message}); using character-notes composition.`, error.rawText ? `\nRaw model output: ${error.rawText}` : '');
  }
  return null;
}

async function generateHeroicRender({ apiConfig, campaignId, subject, npcs, locationName, locationDescription, outline, genre, currentTurnNumber, descriptorClient = null }) {
  let prompt;
  let anchor;
  let npcRow = null;

  if (subject.kind === 'npc') {
    npcRow = npcs.find(npc => npc.name.toLowerCase() === subject.key.toLowerCase());
    if (!npcRow) return null;
    anchor = validateIdentityAnchor(parseJsonObject(npcRow.anchor_json, null));
    if (!anchor.descriptor) {
      // First render: commit the identity descriptor as visual canon so every
      // later render of this NPC is conditioned on the same identity, even if
      // the NPC's mutable notes drift. Preferred source is a generated
      // appearance (V5b); the character-notes composition is the fallback.
      const generated = descriptorClient ? await generateNpcAppearance(descriptorClient, npcRow, genre) : null;
      anchor.descriptor = (generated ||
        `${npcRow.name} — ${npcRow.role || 'a notable figure'}. Personality: ${npcRow.personality || 'unknown'}. Habits: ${npcRow.quirks || 'none recorded'}.`
      ).slice(0, 800);
    }
    prompt = `Cinematic heroic portrait for a ${genre} tabletop RPG: ${npcRow.name}, ${npcRow.role || 'a notable figure'}. Backdrop: ${locationDescription || locationName || outline.setting}. Atmospheric dramatic lighting, painterly, high detail, no text, no UI elements.`;
  } else {
    const description = locationDescription || outline.setting;
    anchor = validateIdentityAnchor({ descriptor: `${locationName}: ${description}`.slice(0, 800) });
    prompt = `Cinematic establishing shot of ${locationName} — ${description}. Genre: ${genre}. Atmospheric, painterly, dramatic lighting, no text, no characters in close focus.`;
  }

  try {
    const render = await generateImage({
      provider: apiConfig.imageProvider,
      apiKey: apiConfig.imageApiKey,
      model: apiConfig.imageModel,
      endpoint: apiConfig.imageEndpoint,
      prompt,
      identityAnchor: anchor,
      width: 1216,
      height: 704
    });

    const relPath = path.join('images', `campaign-${campaignId}`, `heroic-t${currentTurnNumber}.png`);
    const absPath = path.join(__dirname, 'data', relPath);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, render.image);
    console.log(`[HEROIC] Rendered ${subject.kind} "${subject.key}" via ${apiConfig.imageProvider} (turn ${currentTurnNumber}).`);

    return {
      subjectKind: subject.kind,
      subjectKey: subject.kind === 'npc' ? npcRow.name : subject.key,
      npcId: npcRow ? npcRow.id : null,
      relPath,
      mimeType: render.mimeType,
      // Persist the anchor with the seed that actually produced this render.
      anchor: { descriptor: anchor.descriptor, seed: render.seed ?? anchor.seed }
    };
  } catch (error) {
    console.warn(`[HEROIC] Render failed (${error.message}); keeping the previous heroic.`);
    return null;
  }
}

/**
 * Commits a completed heroic render inside a write transaction: image index
 * row, the engine-owned pointer, and the subject's identity anchor (visual
 * canon). Shared by takeTurn (D3) and the opening heroic (V5a).
 */
async function commitHeroicRender(campaignId, heroicRender, turnNumber) {
  const imageInsert = await db.run(
    `INSERT INTO campaign_images (campaign_id, kind, subject_key, file_path, mime_type, created_turn)
     VALUES (?, 'heroic', ?, ?, ?, ?)`,
    [campaignId, heroicRender.subjectKey, heroicRender.relPath, heroicRender.mimeType, turnNumber]
  );
  const pointer = {
    subject_kind: heroicRender.subjectKind,
    subject_key: heroicRender.subjectKind === 'location' ? locationKey(heroicRender.subjectKey) : heroicRender.subjectKey,
    image_id: imageInsert.id,
    generated_turn: turnNumber
  };
  await db.run(`UPDATE campaigns SET current_heroic_json = ? WHERE id = ?`, [JSON.stringify(pointer), campaignId]);
  if (heroicRender.subjectKind === 'npc' && heroicRender.npcId) {
    await db.run(`UPDATE npcs SET anchor_json = ? WHERE id = ?`, [JSON.stringify(heroicRender.anchor), heroicRender.npcId]);
  } else if (heroicRender.subjectKind === 'location') {
    await db.run(
      `UPDATE locations SET anchor_json = ? WHERE campaign_id = ? AND key = ?`,
      [JSON.stringify(heroicRender.anchor), campaignId, pointer.subject_key]
    );
  }
  return pointer;
}

/**
 * Player-facing turn-order view (Phase 3 M2).
 */
function buildTurnOrderView(turnState, party) {
  const byId = new Map(party.map(member => [member.id, member]));
  return {
    round: turnState.round,
    actingCharacterId: actingCharacterId(turnState),
    order: turnState.order.map(id => ({ id, name: byId.get(id)?.name || `#${id}` }))
  };
}

/**
 * The player-facing heroic view from the engine-owned pointer.
 */
function buildHeroicView(campaignId, heroicPointer) {
  if (!heroicPointer || !heroicPointer.image_id) return null;
  return {
    imageUrl: `/api/campaigns/${campaignId}/images/${heroicPointer.image_id}`,
    subjectKind: heroicPointer.subject_kind,
    subjectKey: heroicPointer.subject_key,
    generatedTurn: heroicPointer.generated_turn
  };
}

/**
 * One-time structured layout generation on first entry (Phase V2). The
 * continuity role does it — the agent that "knows what's around the next
 * twelve corners". Failure returns null: the turn proceeds untracked rather
 * than failing or storing garbage.
 */
async function generateLocationLayout(client, turnContext, name) {
  const system = `You design the persistent structured layout of one RPG location for a top-down tactical map.
Return a JSON object ONLY matching:
{
  "name": "Location name",
  "description": "One or two sentences of stable identity: what this place is and feels like",
  "areas": [ { "id": "short-slug", "name": "Area name", "x": 0, "y": 0, "w": 30, "h": 20 } ],
  "exits": [ { "from": "area id", "to": "area id, or out:<where it leads> for exits leaving the location", "label": "door / path / stair" } ],
  "features": [ { "area": "area id", "name": "Fixed feature (altar, bar, wreck)", "kind": "door|furniture|hazard|cover|device|nature|other" } ]
}
The canvas is ${LOCATION_CANVAS.width} wide by ${LOCATION_CANVAS.height} tall in abstract units, origin top-left.
Use 2 to 6 areas that tile the space sensibly without overlapping. Areas are zones (rooms, clearings, decks), not grid squares — this supports theater-of-mind play, not tactical simulation. Only include features that are fixed parts of the place; people and movable things are tracked separately.`;

  const prompt = `Campaign: "${turnContext.campaign.title}" (${turnContext.campaign.genre}).
The player has just entered a location called "${name}".
Recent context: ${turnContext.recent_turns.slice(-2).map(t => t.narrative_excerpt).join(' ... ') || 'campaign opening'}
Design the persistent layout for "${name}" now. Stay consistent with everything already narrated about it.`;

  try {
    const response = await client.sendPrompt({ systemInstruction: system, prompt, jsonMode: true });
    const layout = validateLocationLayout(parseJsonSafe(response));
    if (!layout) {
      console.warn(`[LOCATION] Generated layout for "${name}" was unusable; turn proceeds untracked.`);
    }
    return layout;
  } catch (error) {
    console.warn(`[LOCATION] Layout generation for "${name}" failed (${error.message}); turn proceeds untracked.`, error.rawText ? `\nRaw model output: ${error.rawText}` : '');
    return null;
  }
}

function buildTurnContext({
  campaign,
  outline,
  character,
  npcs,
  memories,
  pastTurns,
  currentTurnNumber,
  currentAct,
  activeQuestName,
  activeQuestDesc,
  playerAction,
  finalPlayerAction,
  ruleset,
  currentLocation,
  knownLocations,
  party,
  actingCharacter,
  speakingCharacter,
  pacing,
  abilityDeclarations
}) {
  // GM omniscience (decision 2026-06-11): the mechanical record — dice rolls, applied
  // damage and its causes — must be visible to the Council on later turns, so the GM
  // can always explain its own mechanics. Legacy roll_result/roll_damage records from
  // pre-refactor campaigns are mapped into the same shape.
  const partyById = new Map((Array.isArray(party) ? party : []).map(member => [member.id, member]));
  const recentTurns = pastTurns.map(turn => {
    let diceRolls = [];
    try {
      const stateChanges = JSON.parse(turn.state_changes_json || '{}');
      if (Array.isArray(stateChanges.dice_rolls)) {
        diceRolls = stateChanges.dice_rolls;
      } else if (stateChanges.roll_result) {
        diceRolls = [{
          ...stateChanges.roll_result,
          applied_health_change: typeof stateChanges.roll_damage === 'number' ? -stateChanges.roll_damage : 0
        }];
      }
    } catch (e) {}

    return {
      turn_number: turn.turn_number,
      player_action: turn.player_action,
      narrative_excerpt: turn.narrative.substring(0, 700),
      dice_rolls: diceRolls,
      ability_invocations: safeAbilityInvocationRecord(
        turn.ability_invocations_json,
        turn.player_action,
        { ownedAbilities: partyById.get(turn.character_id)?.abilities || [] }
      )
    };
  });

  return {
    campaign: {
      id: campaign.id,
      title: campaign.title,
      genre: campaign.genre,
      current_act: currentAct,
      rules_mode: !!campaign.rules_mode
    },
    current_turn_number: currentTurnNumber,
    active_quest: {
      title: activeQuestName,
      description: activeQuestDesc
    },
    current_act_objective: outline.acts.find(a => a.act === currentAct)?.objective || '',
    character,
    npcs: npcs.map(npc => ({
      name: npc.name,
      role: npc.role,
      relationship_value: npc.relationship_value,
      status: npc.status,
      notes: npc.notes
    })),
    memories: memories.map(memory => ({
      importance: memory.importance,
      summary: memory.summary,
      keywords: memory.keywords
    })),
    recent_turns: recentTurns,
    ability_declarations: abilityDeclarations,
    player_input: playerAction,
    final_player_input: finalPlayerAction,
    campaign_rules: ruleset || null,
    // Pacing as recorded state (Phase D): the cadence fact every agent can
    // check as a rule, injected by takeTurn.
    pacing: pacing || null,
    // Structured location record (Phase V2, omniscience): where the player
    // is, what the place looks like, and who is present — canon, not vibes.
    current_location: currentLocation
      ? { name: currentLocation.name, layout: currentLocation.layout, occupancy: currentLocation.occupancy }
      : null,
    known_locations: Array.isArray(knownLocations) ? knownLocations : [],
    // Phase 3 M2: the table. `character` above is the SPEAKING character
    // (whose sheet answers table talk); only the acting character commits.
    party: Array.isArray(party) && party.length > 1
      ? party.map(member => ({
          name: member.name,
          class: member.class,
          level: member.level,
          health: `${member.health}/${member.max_health}`,
          acting: member.id === actingCharacter?.id,
          speaking: member.id === speakingCharacter?.id
        }))
      : null,
    acting_character: actingCharacter?.name || null,
    speaking_character: speakingCharacter?.name || null
  };
}

/**
 * The Council contract is one JSON object, but jsonMode providers (local
 * models especially) can emit arrays or bare scalars. Coerce to a plain
 * object so the no-op forcing and the engine-stamped fields can never be
 * dropped by serialization (arrays lose named props) or throw (scalars).
 */
function coerceTurnObject(parsed) {
  if (Array.isArray(parsed)) {
    return parsed.find(item => item && typeof item === 'object' && !Array.isArray(item)) || {};
  }
  return parsed && typeof parsed === 'object'
    ? parsed
    : { narrative: typeof parsed === 'string' ? parsed : '' };
}

async function callJsonAgent(client, systemInstruction, prompt, fallback) {
  const response = await client.sendPrompt({
    systemInstruction,
    prompt,
    jsonMode: true
  });

  try {
    return parseJsonSafe(response);
  } catch (error) {
    return {
      ...fallback,
      parse_error: error.message,
      raw_response: response.substring(0, 2000)
    };
  }
}

async function runMultiAgentTurn({ apiConfig, gmSystem, turnContext, turnPrompt, turnGate = null }) {
  const interactionClient = new AIClient(resolveAgentConfig(apiConfig, 'interaction'));
  const continuityClient = new AIClient(resolveAgentConfig(apiConfig, 'continuity'));
  const refereeClient = new AIClient(resolveAgentConfig(apiConfig, 'referee'));
  // Narration is its own role (decision 2026-07-03): the final player-facing
  // voice can run a different (typically stronger prose) model than the
  // classifier. Unconfigured, it inherits the primary config as before.
  const narrationClient = new AIClient(resolveAgentConfig(apiConfig, 'narration'));
  const contextJson = compactJson(turnContext);
  const abilityDeclarationRules = buildCouncilAbilityDeclarationInstructions(
    turnContext.ability_declarations
  );

  const interactionProposalSystem = `You are the interaction context call for a single-player RPG.
You are extremely conservative and precise when classifying player input.
You interpret the player's exact table input and propose what it means.
You do not advance time, adjudicate outcomes, or write canonical state.
Return JSON only.

${abilityDeclarationRules}`;

  const interactionProposalPrompt = `Review this current game context:
${contextJson}

The player input is: "${turnContext.player_input}"

=== CLASSIFICATION RULES (BE VERY STRICT) ===
- "clarification": The player is asking a question, seeking information, checking their situation, or engaging in table-talk. Examples: "Which goblin is closer?", "Can I see the door from here?", "What's the orc carrying?", "How far away is the ledge?", "Do I recognize this symbol?", "What do I know about goblins?", "Can I throw my dagger at it?", "Which way is north?", asking about their own stats/gear/abilities, or any "what/where/can I see" question.
- "dialogue": The player is speaking in-character to an NPC or the world ("I say to the guard...", "I yell at the goblins").
- "committed_action": The player states a clear, immediate intention to do something specific in the fiction right now ("I draw my sword and attack the closest goblin", "I climb the wall", "I cast magic missile at the leader", "I run toward the exit").

When the input is even slightly ambiguous (a question that could lead to an action later), classify as "clarification". A real tabletop GM would answer the question first and let the player decide what to do.

Return JSON matching:
{
  "input_kind": "clarification|dialogue|committed_action",
  "player_intent": "What the player wants from the GM",
  "proposed_action": "The concrete in-fiction action only if one exists, otherwise null",
  "clarification_answer": "Direct answer if this is table-talk or clarification, otherwise null",
  "stakes": "Relevant risks, costs, or uncertainty",
  "suggested_next_actions": ["option 1", "option 2", "option 3"]
}`;

  const interactionProposal = await callJsonAgent(interactionClient, interactionProposalSystem, interactionProposalPrompt, {
    input_kind: 'committed_action',
    player_intent: 'Unable to parse interaction proposal.',
    proposed_action: turnContext.player_input,
    clarification_answer: null,
    stakes: '',
    suggested_next_actions: []
  });

  // Turn gate (Phase 3 M2): gating happens AFTER classification because only
  // the Interaction agent knows what the input is. Off-turn table talk is
  // answered for anyone; an off-turn committed action stops here — one call
  // spent, no adjudication, no state.
  if (turnGate && !turnGate.allowCommitted && interactionProposal.input_kind === 'committed_action') {
    const gateError = new Error(`It is ${turnGate.actingName}'s turn to act. You can still ask questions or talk (table talk is always open) — committed actions wait for your turn.`);
    gateError.code = 'OUT_OF_TURN';
    // sv-2: OPT IN to disclosure. A code is a tag, not provenance — the
    // trust boundary reveals `publicMessage` only, never `message`, so the
    // engine must state explicitly that this text was authored for players.
    gateError.publicMessage = gateError.message;
    throw gateError;
  }

  // 2-call table-talk path: a question or in-character conversation must not cost the
  // full 5-call chain when its state outcome is forced to no-op anyway. The Interaction
  // Agent answered and classified; one independent grounding verifier checks that answer
  // against the campaign record (anti-hallucination) and speaks as the GM.
  if (TABLE_TALK_KINDS.includes(interactionProposal.input_kind)) {
    const kind = interactionProposal.input_kind;
    console.log(`[COUNCIL] Table-talk path (${kind}): 2 calls (interaction + grounding verifier), state forced to no-op.`);

    const verifierSystem = `${gmSystem}

${abilityDeclarationRules}

=== GROUNDING VERIFIER CONTEXT CALL ===
You are the single GM voice the player sees, acting as an independent grounding check.
Another context call proposed an answer to the player's table talk. Verify that answer
against the campaign context before speaking it as the GM. Your JSON is the only
response persisted to the database.

VERIFICATION RULES (STRICT):
- Check every factual claim in the proposed answer against the game context: scene,
  NPCs, memories, recent turns, character sheet, inventory, abilities, quest, and rules.
  Correct or drop anything the record does not support. Do not invent new canonical facts.
- If the record cannot answer the question, answer from what the character knows or can
  perceive, or say the character does not know or cannot tell yet. Never break the
  fourth wall or say the GM does not know.
- This is a "${kind}" turn: pure information exchange or in-character conversation.
  Never advance time, resolve actions, spend resources, or change any state.
- Always produce a useful "scene_grounding" so the player understands the current
  physical situation.
- input_kind must be "${kind}". All state update fields must be complete no-ops
  (0 changes, empty arrays, null memory).`;

    const verifierPrompt = `${turnPrompt}

=== INTERACTION PROPOSAL (UNVERIFIED) ===
${compactJson(interactionProposal)}

Verify the proposed answer against the campaign context and produce the final canonical JSON response now. The player must experience one coherent GM, not separate reviewers.`;

    const finalRaw = await continuityClient.sendPrompt({
      systemInstruction: verifierSystem,
      prompt: verifierPrompt,
      jsonMode: true
    });

    try {
      const finalData = coerceTurnObject(parseJsonSafe(finalRaw));
      console.log(`[CLARIFICATION] Table-talk path: forcing strict no-op (${kind}). scene_grounding + direct answer expected from verifier narration.`);
      forceNoOpTurnState(finalData, turnContext, kind);
      stampServerAbilityDeclarations(finalData, turnContext.ability_declarations);
      return JSON.stringify(finalData);
    } catch (error) {
      return finalRaw;
    }
  }

  const continuityReviewSystem = `You are the continuity context call for a persistent single-player RPG.
You approve, deny, or revise the interaction proposal against campaign continuity.
You protect pacing, act structure, known facts, NPC memory, and the game archive.
You do not write canonical state. Return JSON only.

${abilityDeclarationRules}`;

  const continuityReviewPrompt = `Review this current game context:
${contextJson}

=== INTERACTION PROPOSAL ===
${compactJson(interactionProposal)}

Return JSON matching:
{
  "continuity_status": "approved|revise|denied",
  "continuity_reason": "Why this fits or conflicts with established state",
  "revised_action": "A continuity-safe action or response, if revision is needed",
  "active_pressure": "Immediate pressure that remains true",
  "state_constraints": ["What state may or may not change"],
  "archive_notes": ["Facts that should be logged if this resolves"]
}`;

  const continuityReview = await callJsonAgent(continuityClient, continuityReviewSystem, continuityReviewPrompt, {
    continuity_status: 'revise',
    continuity_reason: 'Unable to parse continuity review.',
    revised_action: null,
    active_pressure: '',
    state_constraints: [],
    archive_notes: []
  });

  const refereeSystem = `You are the referee context call for a persistent single-player RPG.
You adjudicate the continuity-reviewed proposal fairly and conservatively.
You may approve, deny, or request clarification. You define allowed state changes, but you do not write final narration.
Return JSON only.

${abilityDeclarationRules}`;

  const refereePrompt = `Review this current game context:
${contextJson}

=== INTERACTION PROPOSAL ===
${compactJson(interactionProposal)}

=== CONTINUITY REVIEW ===
${compactJson(continuityReview)}

=== REFEREE RULES (STRICT) ===
Your primary job is to prevent the game from feeling like a video game that forces action.

- If the Interaction Proposal has input_kind "clarification" (or the player's words are a question about the current situation), you MUST set:
  * referee_status: "approved" (or "needs_clarification" only if the question is impossible to answer)
  * input_kind: "clarification"
  * approved_state_policy: "none"
  * All allowed_*_update fields must be complete no-ops (0 changes, empty arrays)
- A clarification turn is pure information exchange. The player is trying to understand the scene so they can make a good decision later. This is normal and desirable tabletop play.
- Only treat something as "committed_action" if the player has clearly stated an immediate intention to do a specific thing.

=== DICE & CHECKS (rules_mode for this campaign: ${turnContext.campaign.rules_mode}) ===
Dice are a service you order for the table, not a tax on acting. The engine rolls; you adjudicate.
- Your FIRST decision is WHETHER a check is warranted at all. Trivial, safe, or routine actions — walking somewhere, talking, looking around, cautious movement with no active threat, using an obviously suitable tool — require NO check. Most turns require no check.
- Require a check only when the action has genuine uncertainty AND meaningful stakes (something is risked by failure).
- required_checks must be [] when: rules_mode is false, the action is denied or needs clarification, input_kind is not committed_action, or the action simply doesn't warrant one.
- For each required check YOU decide the attribute, the DC (5 easy – 25 near-impossible), why it is needed, and the concrete failure consequence under this campaign's rules and fiction. health_change/mana_change are 0 or negative; 0 is legitimate — failure can be purely narrative (noticed, blocked, lost time).

=== LOCATION & POSITION (structured location record) ===
The engine keeps a persistent structured record per location (layout + occupancy). Known locations: ${(turnContext.known_locations || []).join('; ') || 'none recorded yet'}. The player is currently in: ${turnContext.current_location?.name || 'no recorded location yet'}.
- "location.name": where the player is AFTER this action resolves. Reuse the EXACT known-location name when it is the same place; introduce a new name only when the fiction genuinely moves somewhere new.
- "location.positional": true only when position materially matters this turn (combat, stealth, a chase, climbing, ranged positioning). Most turns are false.
- "location.occupancy": everyone and everything notable present there after the action — always include the player character. kind is player|npc|creature|object; "area" uses the area ids from the current location record when known.

=== ENCOUNTER PACING (recorded state — check it as a rule, not a mood) ===
${turnContext.pacing ? `Table pacing: ${turnContext.pacing.style} — ${turnContext.pacing.target === null
    ? 'the GM NEVER initiates encounters at this table; danger only answers player action.'
    : `target at most ~1 GM-initiated encounter per ${turnContext.pacing.target} world turns.`}
Last GM-initiated encounter: ${turnContext.pacing.turns_since_gm_encounter === null ? 'none recorded in the recent window.' : `${turnContext.pacing.turns_since_gm_encounter} turn(s) ago.`}
${turnContext.pacing.target === null
    ? 'Do not introduce GM-initiated threats.'
    : (turnContext.pacing.turns_since_gm_encounter !== null && turnContext.pacing.turns_since_gm_encounter < turnContext.pacing.target
      ? 'Do NOT introduce a new GM-initiated threat this turn unless the player is deliberately seeking danger.'
      : 'You have room to initiate an encounter if the fiction genuinely calls for one — never forced.')}` : 'No pacing dial recorded (legacy campaign): use good-table judgment; most turns need no new threat.'}
- The dial governs what the GM initiates, never what the player may do: player-sought danger always resolves normally.
- In your JSON, report "encounter": "none" | "player_sought" (the player went looking for this danger) | "gm_initiated" (you introduced the threat this turn).

=== FOCAL SUBJECT (persistent heroic visual) ===
The engine keeps one persistent "heroic" visual of the current focal subject; it changes rarely and the engine enforces stickiness.
- "focal_subject": who or what deserves the table's visual focus after this action. kind "npc" only when an NPC takes real prominence (an extended conversation, a combat confrontation, a dramatic reveal — use their EXACT name). kind "location" when the place itself is the moment. kind "none" on ordinary turns — most turns are "none" and the current visual persists.

Return JSON matching:
{
  "referee_status": "approved|denied|needs_clarification",
  "input_kind": "clarification|dialogue|committed_action",
  "ruling": "The fair outcome or reason for denial",
  "location": {
    "name": "Location name after this action",
    "positional": false,
    "occupancy": [
      { "name": "Name", "kind": "player|npc|creature|object", "area": "area id", "note": "brief state note" }
    ]
  },
  "focal_subject": { "kind": "location|npc|none", "name": "", "reason": "" },
  "encounter": "none|player_sought|gm_initiated",
  "required_checks": [
    {
      "attribute": "strength|agility|intellect|willpower",
      "dc": 12,
      "reason": "Why this check is warranted and what is at stake",
      "failure_consequence": { "description": "What concretely goes wrong on failure", "health_change": 0, "mana_change": 0 }
    }
  ],
  "approved_state_policy": "none|limited|normal",
  "allowed_character_update": {
    "health_change": 0,
    "mana_change": 0,
    "xp_gain": 0,
    "inventory_changes": []
  },
  "allowed_ability_updates": [],
  "allowed_npc_updates": [],
  "allowed_quest_update": {
    "active_quest": "${turnContext.active_quest.title}",
    "quest_description": "${turnContext.active_quest.description}",
    "current_act": ${turnContext.campaign.current_act}
  }
}

For clarification, denial, or needs_clarification, approved_state_policy must be "none" and all state changes must be no-op values. The final narration will still give the player a rich answer and scene_grounding on clarification turns.`;

  const refereeDecision = await callJsonAgent(refereeClient, refereeSystem, refereePrompt, {
    referee_status: 'needs_clarification',
    input_kind: interactionProposal.input_kind || 'clarification',
    ruling: 'Unable to parse referee decision.',
    location: null,
    focal_subject: null,
    encounter: 'none',
    required_checks: [],
    approved_state_policy: 'none',
    allowed_character_update: { health_change: 0, mana_change: 0, xp_gain: 0, inventory_changes: [] },
    allowed_ability_updates: [],
    allowed_npc_updates: [],
    allowed_quest_update: {
      active_quest: turnContext.active_quest.title,
      quest_description: turnContext.active_quest.description,
      current_act: turnContext.campaign.current_act
    }
  });

  // Dice before narration (approved refactor, plan.md): the referee ordered the
  // checks; the engine rolls them now, deterministically in code, so every later
  // call — final continuity and narration — works from resolved facts. Denied or
  // reclassified actions get no rolls, so they can never take roll damage.
  let diceRolls = [];
  const rollsWarranted = turnContext.campaign.rules_mode &&
    refereeDecision.referee_status === 'approved' &&
    refereeDecision.input_kind === 'committed_action';
  if (rollsWarranted) {
    const checks = validateRequiredChecks(refereeDecision.required_checks);
    diceRolls = checks.map(check => rollCheck(turnContext.character, check));
    for (const record of diceRolls) {
      console.log(`[DICE] ${record.attribute} check (${record.reason || 'no reason given'}): ${record.total} vs DC ${record.dc} → ${record.success ? 'success' : `FAILURE (${record.applied_health_change} HP, ${record.applied_mana_change} MP)`}`);
    }
  }

  const diceResultsSection = `=== DICE RESULTS (ENGINE-ROLLED, ALREADY FINAL) ===
${diceRolls.length > 0 ? compactJson(diceRolls) : 'No checks were required this turn.'}`;

  // Structured location resolution (Phase V2): the Referee's location block
  // is the gated signal. On first entry to an unknown location, the
  // continuity role generates the persistent layout now — one call, once per
  // location — so the whole round is ready before it is sent.
  let locationUpdate = null;
  if (refereeDecision.referee_status === 'approved' && refereeDecision.input_kind === 'committed_action') {
    locationUpdate = validateLocationUpdate(refereeDecision.location);
    if (locationUpdate) {
      const known = (turnContext.known_locations || [])
        .some(name => name.toLowerCase() === locationUpdate.name.toLowerCase());
      locationUpdate.generated_layout = known
        ? null
        : await generateLocationLayout(continuityClient, turnContext, locationUpdate.name);
      if (!known && !locationUpdate.generated_layout) {
        locationUpdate = null;
      }
    }
  }

  const continuityFinalSystem = `You are the final continuity context call for a persistent single-player RPG.
You receive the referee decision and the engine-rolled dice results, perform a final consistency check, and prepare archive notes.
Dice results are already final: do not re-roll, reinterpret, or contradict them.
You do not narrate to the player. Return JSON only.

${abilityDeclarationRules}`;

  const continuityFinalPrompt = `Review this current game context:
${contextJson}

=== INTERACTION PROPOSAL ===
${compactJson(interactionProposal)}

=== CONTINUITY REVIEW ===
${compactJson(continuityReview)}

=== REFEREE DECISION ===
${compactJson(refereeDecision)}

${diceResultsSection}

Return JSON matching:
{
  "final_status": "approved|denied|needs_clarification",
  "final_input_kind": "clarification|dialogue|committed_action",
  "final_constraints": ["Constraints the final in-world response must obey"],
  "archive_log": "One sentence suitable for memory/archive if a permanent event happened, otherwise null",
  "state_change_policy": "none|limited|normal",
  "approved_state_summary": "Summary of exactly what may change"
}`;

  const continuityFinal = await callJsonAgent(continuityClient, continuityFinalSystem, continuityFinalPrompt, {
    final_status: refereeDecision.referee_status || 'needs_clarification',
    final_input_kind: refereeDecision.input_kind || interactionProposal.input_kind || 'clarification',
    final_constraints: [],
    archive_log: null,
    state_change_policy: refereeDecision.approved_state_policy || 'none',
    approved_state_summary: refereeDecision.ruling || ''
  });

  const finalInteractionSystem = `${gmSystem}

${abilityDeclarationRules}

=== FINAL INTERACTION CONTEXT CALL ===
You are the single GM voice the player sees.
You must relay the final approved result in in-world terms while preserving the referee and continuity decisions.
You are the last context call, and your JSON is the only response persisted to the database.

CLARIFICATION BEHAVIOR (VERY IMPORTANT):
- If final_input_kind is "clarification", you are answering a question or providing scene information.
- Write like a good tabletop GM: clear, direct, atmospheric, and informative.
- Always produce a useful "scene_grounding" field so the player understands the current physical situation.
- Never advance time or apply state changes on clarification turns.

If final_status is denied or needs_clarification, explain the issue in-world and set all state changes to no-op values.
If final_input_kind is clarification or dialogue, answer directly and set all state changes to no-op values.
If final_input_kind is committed_action, include only state changes approved by the referee and final continuity check.

DICE RESULTS (VERY IMPORTANT):
- Any dice results provided are already rolled and final, and their failure consequences (HP/mana costs) are applied mechanically by the engine.
- Narrate so the prose matches each result exactly: successes succeed, failures fail, and the stated consequence is what goes wrong.
- Do NOT add the consequence again to character_update — the engine already applies it. Do not invent extra rolls, damage, or costs beyond the results given.`;

  const finalInteractionPrompt = `${turnPrompt}

=== INTERACTION PROPOSAL ===
${compactJson(interactionProposal)}

=== CONTINUITY REVIEW ===
${compactJson(continuityReview)}

=== REFEREE DECISION ===
${compactJson(refereeDecision)}

=== FINAL CONTINUITY CHECK AND ARCHIVE NOTES ===
${compactJson(continuityFinal)}

${diceResultsSection}

Produce the final canonical JSON response now. The player must experience one coherent GM, not separate reviewers.`;

  const finalRaw = await narrationClient.sendPrompt({
    systemInstruction: finalInteractionSystem,
    prompt: finalInteractionPrompt,
    jsonMode: true
  });

  try {
    const finalData = coerceTurnObject(parseJsonSafe(finalRaw));
    // The engine's roll records are canonical; whatever the narrator emitted is discarded.
    finalData.dice_rolls = diceRolls;
    // Same for the location, focal, and encounter signals: referee-emitted,
    // engine-stamped.
    finalData.location_update = locationUpdate;
    const committedApproved = refereeDecision.referee_status === 'approved' && refereeDecision.input_kind === 'committed_action';
    finalData.focal_subject = committedApproved ? validateFocalSubject(refereeDecision.focal_subject) : null;
    finalData.encounter = committedApproved && ['player_sought', 'gm_initiated'].includes(refereeDecision.encounter)
      ? refereeDecision.encounter
      : 'none';
    // A committed action "resolved" only when the whole gate approved it —
    // denials and needs_clarification narrate but do not consume the turn.
    finalData.action_resolved = committedApproved;
    const noStateChange = continuityFinal.final_status !== 'approved' ||
      TABLE_TALK_KINDS.includes(continuityFinal.final_input_kind) ||
      continuityFinal.state_change_policy === 'none' ||
      refereeDecision.referee_status !== 'approved';

    if (noStateChange) {
      console.log('[CLARIFICATION] Council path: noStateChange true (table talk, denial, or policy=none) — forcing strict no-op. scene_grounding + direct answer expected from final narration.');
      forceNoOpTurnState(
        finalData,
        turnContext,
        continuityFinal.final_input_kind || refereeDecision.input_kind || 'clarification'
      );
    }

    if (continuityFinal.archive_log && !finalData.memory_summary && !noStateChange) {
      finalData.memory_summary = continuityFinal.archive_log;
      finalData.memory_importance = finalData.memory_importance || 3;
    }

    stampServerAbilityDeclarations(finalData, turnContext.ability_declarations);
    return JSON.stringify(finalData);
  } catch (error) {
    return finalRaw;
  }
}

export async function createCampaign({
  genre,
  characterName,
  characterClass,
  characterProfileId,
  characterMode = 'new',
  apiConfig,
  rulesMode = false,
  ruleset = 'house',
  tableStyle = null
}) {
  // Table-style dials (Phase D): chosen in the wizard, defaults classic +
  // standard (decision 2026-07-04), adjustable later via setTableStyle.
  const tableStyleData = validateTableStyle(tableStyle);
  // Setup is its own role (decision 2026-07-03): the campaign outline and
  // opening scene are the highest-leverage calls and can run the strongest
  // model. Unconfigured, it inherits the primary config as before.
  const client = new AIClient(resolveAgentConfig(apiConfig, 'setup'));
  let sourceProfile = null;

  if (characterProfileId) {
    sourceProfile = await getPlayerCharacter(characterProfileId);
    if (!sourceProfile) throw new Error(`Character profile ${characterProfileId} not found.`);
    if (characterMode === 'existing' && sourceProfile.status !== 'available') {
      throw new Error(`Character "${sourceProfile.name}" is checked out to another active campaign. Copy the character to branch them into a new campaign.`);
    }
  }

  const resolvedCharacterName = sourceProfile ? sourceProfile.name : characterName;
  const resolvedCharacterArchetype = sourceProfile ? sourceProfile.archetype : (characterClass || 'Unformed protagonist');

  const outlineSystem = getOutlineSystemInstruction(genre);

  const outlinePrompt = `Draft an epic, highly coherent RPG campaign structure for the genre: "${genre}". Provide 3 to 5 key NPCs with highly distinct, fleshed-out personalities and memorable quirks. Specify rich HSL theme colors and a font pairing that match the genre's atmosphere. Ensure the outline maps out a complete 2-4 hour questline.`;

  console.log(`Generating campaign outline for genre: ${genre}...`);
  const outlineResponse = await client.sendPrompt({
    systemInstruction: outlineSystem,
    prompt: outlinePrompt,
    jsonMode: true
  });

  const rawOutline = parseJsonSafe(outlineResponse);
  const outline = validateOutlineData(rawOutline);

  // Ruleset as canon campaign state (decision 2026-07-03): generated once at
  // creation by the Setup role, stored, and injected into every turn.
  let rulesetData = null;
  if (ruleset === 'house') {
    const rulesetSystem = `You design a compact, self-consistent rule sheet for a tabletop RPG campaign.
The engine already resolves risky actions with a d20 + attribute modifier (strength/agility/intellect/willpower; modifier = floor((score - 10) / 2)) against a difficulty class from 5 (easy) to 25 (near-impossible), and failed checks have referee-adjudicated consequences. Advancement: level = floor(XP / 100) + 1; leveling fully restores and raises maximums.
Your job is the campaign-specific layer on top. Return JSON ONLY matching:
{
  "name": "Short ruleset name themed to this campaign",
  "resolution": "One-paragraph player-facing summary of how checks work, restating the engine mechanics above in the campaign's voice",
  "abilities": [
    { "name": "Ability or spell name", "cost": "e.g. 5 mana / free / once per scene", "effect": "What it does in fiction and in checks", "limits": "Constraints, cooldowns, requirements" }
  ],
  "notes": "House rules for resources, recovery, and anything genre-specific a referee needs to apply these identically every time"
}
Give the player character 4 to 8 starting abilities fitting their concept and the genre. Every rule must be concrete enough that a referee applies it the same way every turn.`;

    console.log('Generating campaign ruleset...');
    try {
      const rulesetResponse = await client.sendPrompt({
        systemInstruction: rulesetSystem,
        prompt: `Campaign genre: "${genre}". Campaign title: "${outline.title}". Setting: ${outline.setting}\nPlayer character: ${resolvedCharacterName}, concept: "${resolvedCharacterArchetype}".`,
        jsonMode: true
      });
      rulesetData = validateRulesetData(parseJsonSafe(rulesetResponse));
    } catch (error) {
      // A campaign without a rule sheet is playable (freeform); creation must not fail on this call.
      console.warn(`Ruleset generation failed (continuing freeform): ${error.message}`, error.rawText ? `\nRaw model output: ${error.rawText}` : '');
    }
  }
  
  const attributes = sourceProfile
    ? parseJsonObject(sourceProfile.attributes_json, defaultAttributesForConcept(resolvedCharacterArchetype))
    : defaultAttributesForConcept(resolvedCharacterArchetype);

  const inventory = sourceProfile ? parseJsonArray(sourceProfile.inventory_json) : createStarterInventory();
  // Branch and copy carry the source's ability records verbatim, ids included.
  const abilities = ensureAbilityIds(sourceProfile ? parseJsonArray(sourceProfile.abilities_json) : []);
  const progressionNotes = sourceProfile?.progression_notes || '';

  // Construct initial NPC list in-memory to build system instruction
  const npcList = (outline.key_npcs || []).map(npc => ({
    name: npc.name,
    role: npc.role,
    personality: npc.personality,
    quirks: npc.quirks,
    voice_mood: npc.voice_mood,
    relationship_value: 0,
    notes: `Created at campaign start. Role: ${npc.role}.`,
    status: 'alive'
  }));

  // Generate Turn 1 (Opening Narrative and Scene SVG)
  const gmSystem = getGMSystemInstruction(outline, {
    name: resolvedCharacterName,
    class: resolvedCharacterArchetype,
    health: sourceProfile?.health ?? 100,
    max_health: sourceProfile?.max_health ?? 100,
    mana: sourceProfile?.mana ?? 50,
    max_mana: sourceProfile?.max_mana ?? 50,
    xp: sourceProfile?.xp ?? 0,
    level: sourceProfile?.level ?? 1,
    inventory,
    attributes,
    abilities,
    progression_notes: progressionNotes
  }, npcList, 1, rulesetData, null, null, tableStyleData);

  const turn1Prompt = `Set the scene and begin the campaign.
Start the story at the beginning of Act I. Introduce the starting quest: "${outline.starting_quest.title}".
Describe the starting location, atmosphere, and initial situation in rich detail. Provide a clear "scene_grounding" describing positions, distances, lighting, and what the character can immediately perceive.
If you introduce any of the NPCs now, write them fully in character with their described personality and quirks.
Output the JSON object containing the opening narrative, scene_grounding, suggested choices, state updates, and an SVG illustration of the scene.`;

  console.log(`Generating opening turn for campaign...`);
  const turn1Response = await client.sendPrompt({
    systemInstruction: gmSystem,
    prompt: turn1Prompt,
    jsonMode: true
  });

  const parsedRaw = parseJsonSafe(turn1Response);
  // The opening turn has no player input to classify. If the model labels it
  // 'clarification' (the prompts bias toward that on any doubt), the validator's
  // clarification safety net would silently wipe the starting state — gear grants,
  // NPC notes, opening memory. GM scene-setting narration is 'dialogue'.
  if (parsedRaw && typeof parsedRaw === 'object') {
    parsedRaw.input_kind = 'dialogue';
  }
  const turnData = validateTurnData(parsedRaw, 1, tableStyleData);

  const character = {
    name: resolvedCharacterName,
    class: resolvedCharacterArchetype,
    health: sourceProfile?.health ?? 100,
    max_health: sourceProfile?.max_health ?? 100,
    mana: sourceProfile?.mana ?? 50,
    max_mana: sourceProfile?.max_mana ?? 50,
    xp: sourceProfile?.xp ?? 0,
    level: sourceProfile?.level ?? 1,
    inventory: [...inventory],
    attributes,
    abilities: [...abilities],
    progression_notes: progressionNotes
  };
  // Arrival snapshot BEFORE turn-1 updates: what fork replay seeds from.
  const characterBaseline = characterBaselineJson(character);

  // Apply Turn 1 character updates so state matches the turn data
  const turn1Level = applyCharacterUpdate(character, turnData.character_update);
  if (turn1Level.leveledUp) {
    turnData.narrative += `\n\n🎉 **LEVEL UP! You have reached Level ${character.level}! Your maximum Health and Mana have increased!**`;
  }
  applyAbilityUpdates(character, turnData, 1);

  const svg = turnData.svg_illustration && turnData.svg_illustration.includes('<svg')
    ? turnData.svg_illustration
    : createFallbackSvg(outline.title, outline.theme_colors?.primary, outline.theme_colors?.secondary);

  // V5a: the campaign opens with a structured starting location (the first
  // major location from the outline), generated by the setup role from the
  // opening scene. Failure → the campaign starts untracked, as before.
  const startingLocationName = outline.major_locations[0]?.name || 'Starting Area';
  const startingLayout = await generateLocationLayout(client, {
    campaign: { title: outline.title, genre },
    recent_turns: [{ narrative_excerpt: turnData.narrative.substring(0, 700) }]
  }, startingLocationName);

  let campaignId;
  let newCharacterRowId;
  let playerCharacterId = sourceProfile && characterMode === 'existing' ? sourceProfile.id : null;
  const rulesModeInt = rulesMode ? 1 : 0;
  await db.withWriteTransaction(async () => {
    if (sourceProfile && characterMode === 'existing') {
      const latestProfile = await getPlayerCharacter(playerCharacterId);
      if (!latestProfile || latestProfile.status !== 'available') {
        throw new Error(`Character "${sourceProfile.name}" is no longer available. Copy the character to branch them into a new campaign.`);
      }
    }

    // Insert campaign into DB
    const campaignResult = await db.run(
      `INSERT INTO campaigns (title, genre, summary, current_act, rules_mode, ruleset_json, table_style_json, narrator_voice_json)
       VALUES (?, ?, ?, 1, ?, ?, ?, ?)`,
      [
        outline.title, genre, outline.setting, rulesModeInt,
        rulesetData ? JSON.stringify(rulesetData) : null,
        JSON.stringify(tableStyleData),
        JSON.stringify(createNarratorVoiceProfile(apiConfig?.voiceProvider))
      ]
    );
    campaignId = campaignResult.id;

    // Insert outline
    await db.run(
      `INSERT INTO campaign_outlines (campaign_id, outline_json) VALUES (?, ?)`,
      [campaignId, JSON.stringify(outline)]
    );

    // Insert character directly with final state
    if (!playerCharacterId) {
      const profileResult = await db.run(
        `INSERT INTO player_characters (
          name, archetype, status, active_campaign_id, origin_campaign_id, copied_from_character_id,
          health, max_health, mana, max_mana, xp, level, inventory_json, attributes_json, abilities_json, progression_notes
        ) VALUES (?, ?, 'checked_out', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          character.name,
          character.class,
          campaignId,
          campaignId,
          sourceProfile?.id || null,
          character.health,
          character.max_health,
          character.mana,
          character.max_mana,
          character.xp,
          character.level,
          JSON.stringify(character.inventory),
          JSON.stringify(character.attributes),
          JSON.stringify(character.abilities),
          character.progression_notes || ''
        ]
      );
      playerCharacterId = profileResult.id;
    } else {
      await syncPlayerCharacter(playerCharacterId, campaignId, character);
    }

    const characterInsert = await db.run(
      `INSERT INTO characters (campaign_id, player_character_id, name, class, health, max_health, mana, max_mana, xp, level, inventory_json, attributes_json, abilities_json, progression_notes, baseline_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        campaignId,
        playerCharacterId,
        character.name,
        character.class,
        character.health,
        character.max_health,
        character.mana,
        character.max_mana,
        character.xp,
        character.level,
        JSON.stringify(character.inventory),
        JSON.stringify(character.attributes),
        JSON.stringify(character.abilities),
        character.progression_notes || '',
        characterBaseline
      ]
    );

    newCharacterRowId = characterInsert.id;

    const openingTriggerState = buildCharacterAbilityTriggerState({
      campaignId,
      character: {
        ...character,
        id: newCharacterRowId,
        player_character_id: playerCharacterId
      },
      bindings: []
    });
    const openingAbilityInvocations = emptyAbilityInvocationRecord(
      openingTriggerState.abilityTriggerRevision
    );

    // Turn order starts as an order of one (Phase 3 M2)
    await db.run(
      `UPDATE campaigns SET turn_state_json = ? WHERE id = ?`,
      [JSON.stringify({ order: [characterInsert.id], current_index: 0, round: 1 }), campaignId]
    );

    // Insert NPCs
    for (const [npcIndex, npc] of npcList.entries()) {
      // Sticky voice identity (Phase 2): assigned once at creation, stored as state.
      await db.run(
        `INSERT INTO npcs (campaign_id, name, role, personality, quirks, relationship_value, notes, status, voice_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [campaignId, npc.name, npc.role, npc.personality, npc.quirks, npc.relationship_value, npc.notes, npc.status,
         JSON.stringify(assignNpcVoiceProfile(npc, npcIndex, apiConfig?.voiceProvider))]
      );
    }

    // Insert Turn 1
    await db.run(
      `INSERT INTO turns (
         campaign_id, turn_number, player_action, narrative,
         state_changes_json, ability_invocations_json, svg_illustration
       ) VALUES (?, 1, NULL, ?, ?, ?, ?)`,
      [
        campaignId,
        turnData.narrative,
        JSON.stringify(turnData),
        JSON.stringify(openingAbilityInvocations),
        svg
      ]
    );

    // Insert memory
    if (turnData.memory_summary) {
      await db.run(
        `INSERT INTO memories (campaign_id, turn_number, importance, summary, keywords) VALUES (?, ?, ?, ?, ?)`,
        [campaignId, 1, turnData.memory_importance || 3, turnData.memory_summary, outline.starting_quest.title]
      );
    }

    // Starting location (V5a): stored + pointed at from turn one
    if (startingLayout) {
      const startKey = locationKey(startingLocationName);
      const occupancy = validateLocationOccupancy(
        [{ name: resolvedCharacterName, kind: 'player', area: startingLayout.areas[0].id }],
        startingLayout
      );
      const locationInsert = await db.run(
        `INSERT INTO locations (campaign_id, name, key, description, layout_json, occupancy_json, first_seen_turn, last_seen_turn)
         VALUES (?, ?, ?, ?, ?, ?, 1, 1)`,
        [campaignId, startingLocationName, startKey, startingLayout.description || '',
         JSON.stringify(startingLayout), JSON.stringify(occupancy)]
      );
      await db.run(`UPDATE campaigns SET current_location_id = ? WHERE id = ?`, [locationInsert.id, campaignId]);
    }
  });

  // Refetch initial NPCs to include database-assigned IDs
  const finalNpcList = await db.all(`SELECT * FROM npcs WHERE campaign_id = ?`, [campaignId]);

  // Opening heroic (V5a): the starting location's establishing shot, when an
  // image provider is configured. Synchronous like every render; a failure
  // leaves the SVG surface, never the campaign.
  let startingLocationView = null;
  let openingHeroicView = null;
  if (startingLayout) {
    const startingLocation = hydrateLocationRow(
      await db.get(`SELECT * FROM locations WHERE campaign_id = ? AND key = ?`, [campaignId, locationKey(startingLocationName)])
    );
    startingLocationView = buildLocationView(startingLocation, false);
    if (apiConfig?.imageProvider) {
      const heroicRender = await generateHeroicRender({
        apiConfig,
        campaignId,
        subject: { kind: 'location', key: locationKey(startingLocationName) },
        npcs: finalNpcList,
        locationName: startingLocationName,
        locationDescription: startingLayout.description || '',
        outline,
        genre,
        currentTurnNumber: 1
      });
      if (heroicRender) {
        let pointer = null;
        await db.withWriteTransaction(async () => {
          pointer = await commitHeroicRender(campaignId, heroicRender, 1);
        });
        openingHeroicView = buildHeroicView(campaignId, pointer);
      }
    }
  }

  const openingCharacter = {
    id: newCharacterRowId,
    name: resolvedCharacterName,
    class: resolvedCharacterArchetype,
    health: character.health,
    max_health: character.max_health,
    mana: character.mana,
    max_mana: character.max_mana,
    xp: character.xp,
    level: character.level,
    inventory: character.inventory,
    attributes: character.attributes,
    abilities: character.abilities,
    progression_notes: character.progression_notes,
    player_character_id: playerCharacterId
  };
  Object.assign(openingCharacter, buildCharacterAbilityTriggerState({
    campaignId,
    character: openingCharacter,
    bindings: []
  }));

  return {
    campaignId,
    title: outline.title,
    genre,
    setting: outline.setting,
    themeColors: outline.theme_colors,
    themeFonts: outline.theme_fonts,
    rulesMode: !!rulesModeInt,
    ruleset: rulesetData,
    tableStyle: tableStyleData,
    character: openingCharacter,
    npcs: finalNpcList,
    outline,
    turnOrder: {
      round: 1,
      actingCharacterId: newCharacterRowId,
      order: [{ id: newCharacterRowId, name: resolvedCharacterName }]
    },
    currentQuest: {
      active_quest: outline.starting_quest.title,
      quest_description: outline.starting_quest.description
    },
    currentAct: 1,
    turn: {
      number: 1,
      // Nobody acted on the opening scene: the transcript falls back to its
      // pre-attribution label for a turn with no author (pa-1).
      characterId: null,
      playerAction: null,
      narrative: turnData.narrative,
      sceneGrounding: turnData.scene_grounding || null,
      svg,
      suggestedChoices: turnData.suggested_choices || [],
      rollResults: [],
      voiceLines: buildVoiceScript(turnData.narration_lines, finalNpcList),
      inputKind: turnData.input_kind || 'dialogue',
      // V5a: the campaign opens with its starting location (and heroic when
      // an image provider is configured) instead of waiting for the first
      // committed action.
      location: startingLocationView,
      heroic: openingHeroicView
    }
  };
}

export async function takeTurn(
  campaignId,
  playerAction,
  apiConfig,
  submittingCharacterId = null,
  abilityTriggerRevision = null
) {
  // 1. Fetch current campaign details
  const campaign = await db.get(`SELECT * FROM campaigns WHERE id = ?`, [campaignId]);
  if (!campaign) throw new Error(`Campaign ${campaignId} not found.`);

  const outline = await readCampaignOutline(campaignId);
  if (!outline) throw new Error(`Campaign outline not found for campaign ${campaignId}.`);

  // Phase 3 M2: the party, the round-robin order, and who is speaking. The
  // SPEAKING character (which browser typed) supplies the perspective for
  // table talk; the ACTING character (whose turn it is) is the only one who
  // may commit actions. Single-character campaigns are an order of one.
  const party = await loadParty(campaignId);
  if (party.length === 0) throw new Error(`Character not found for campaign ${campaignId}.`);
  const turnState = validateTurnState(parseJsonObject(campaign.turn_state_json, null), party.map(c => c.id));
  const actingId = actingCharacterId(turnState);
  const actingCharacter = party.find(c => c.id === actingId) || party[0];

  // the speaking character — perspective and (gated) writes
  const character = selectSpeakingCharacter(party, submittingCharacterId);
  if (abilityTriggerRevision !== character.abilityTriggerRevision) {
    const error = new Error('Your ability list changed. Review the refreshed character sheet and resend your action.');
    error.code = 'ABILITY_TRIGGERS_STALE';
    error.publicMessage = error.message;
    throw error;
  }
  const abilityDeclarations = buildAbilityDeclarations({ character, playerAction });
  const abilityInvocations = abilityInvocationRecordFromDeclarations(
    abilityDeclarations,
    playerAction
  );
  const allowCommitted = party.length === 1 || character.id === actingCharacter.id;

  const npcs = await db.all(`SELECT * FROM npcs WHERE campaign_id = ?`, [campaignId]);

  // Structured location state (Phase V2): where the player is (engine-owned
  // pointer) and which locations already exist for name reuse.
  const currentLocation = await getCurrentLocation(campaign);
  const knownLocationRows = await db.all(
    `SELECT id, name, key FROM locations WHERE campaign_id = ?`,
    [campaignId]
  );

  // Fetch last 6 turns for immediate context
  const pastTurns = (await readCampaignHistory(campaignId, {
    window: 'latest',
    limit: STAGE_ONE_HISTORY_LIMIT
  })).map(turn => ({ ...turn, narrative: turn.gm_narrative }));

  // Fetch campaign memories (Top importance + recency ranked)
  const memories = await readCampaignMemories(campaignId, { limit: STAGE_ONE_MEMORY_LIMIT });

  const currentTurnNumber = pastTurns.length > 0 ? pastTurns[pastTurns.length - 1].turn_number + 1 : 1;
  const currentAct = campaign.current_act || 1;

  // Rules-mode checks are adjudicated by the Referee and rolled by the engine inside
  // the Council pipeline (dice before narration); this function only applies the
  // resulting consequences to character state.
  const finalPlayerAction = playerAction;

  // 2. Build the context prompt
  const rulesetData = validateRulesetData(parseJsonObject(campaign.ruleset_json, null));
  // Table style + pacing cadence (Phase D): the dial values and the recorded
  // fact the Council checks as a rule.
  const tableStyle = validateTableStyle(parseJsonObject(campaign.table_style_json, null));
  // Cadence counts WORLD turns (committed actions) only — table talk must
  // not stretch the recorded gap and shift what the GM may initiate.
  const encounterRows = await db.all(
    `SELECT state_changes_json FROM turns WHERE campaign_id = ? ORDER BY turn_number DESC LIMIT 48`,
    [campaignId]
  );
  const encounterHistory = buildEncounterHistory(encounterRows.reverse());
  const pacing = {
    style: tableStyle.pacing,
    target: PACING_TARGETS[tableStyle.pacing],
    turns_since_gm_encounter: computeEncounterCadence(encounterHistory)
  };
  const partyPromptView = party.map(member => ({
    name: member.name,
    class: member.class,
    level: member.level,
    health: `${member.health}/${member.max_health}`,
    acting: member.id === actingCharacter.id,
    speaking: member.id === character.id
  }));
  const gmSystem = getGMSystemInstruction(outline, character, npcs, currentAct, rulesetData, currentLocation, partyPromptView, tableStyle);

  let historyPrompt = `=== CAMPAIGN HISTORY ===\n`;
  if (memories.length > 0) {
    historyPrompt += `Summary of key past events:\n` + memories.map(m => `- [Importance ${m.importance}] ${m.summary}`).join('\n') + `\n\n`;
  }
  historyPrompt += `Last active turns:\n`;
  pastTurns.forEach(turn => {
    if (turn.player_action) {
      historyPrompt += `> PLAYER: ${turn.player_action}\n`;
    }
    historyPrompt += `> GM: ${turn.narrative.substring(0, 500)}...\n`;
  });
  
  // Extract active quest
  let activeQuestName = outline.starting_quest.title;
  let activeQuestDesc = outline.starting_quest.description;

  if (pastTurns.length > 0) {
    for (const turn of [...pastTurns].reverse()) {
      if (turn.state_changes_json) {
        try {
          const stateChanges = JSON.parse(turn.state_changes_json);
          if (stateChanges.quest_update?.active_quest) {
            activeQuestName = stateChanges.quest_update.active_quest;
            activeQuestDesc = stateChanges.quest_update.quest_description || '';
            break;
          }
        } catch (e) {}
      }
    }
  }

  const turnPrompt = `${historyPrompt}
=== CURRENT STATUS ===
Turn Number: ${currentTurnNumber}
Current Act: Act ${currentAct} - Objective: "${outline.acts.find(a => a.act === currentAct)?.objective || ''}"
Active Quest: "${activeQuestName}" (${activeQuestDesc})

PLAYER INPUT: "${finalPlayerAction}"

=== FINAL RESPONSE RULES ===
First decide input_kind:
- "clarification" — player asked a question or wants to understand the current situation better. Answer fully and naturally. Provide rich "scene_grounding".
- "dialogue" — player is talking to someone.
- "committed_action" — player has clearly stated they are doing something specific right now.

CRITICAL FOR CLARIFICATION TURNS:
- Speak like a patient, helpful tabletop GM at the table.
- Give a direct, informative answer in the "narrative" field.
- Always include a detailed "scene_grounding" so the player has a clear mental picture (positions, distances, cover, lighting, what they can and cannot see).
- Do not describe the player doing anything. Do not resolve any action. Do not advance the clock.
- End by giving the player good information and 2–4 natural things they could choose to do next (suggested_choices). Do not pressure them.

For committed_action turns, write vivid narrative of what happens as a result.

Output the JSON object containing the narrative response, scene_grounding, suggested_choices, player state updates, active quest, any NPC updates, and an svg_illustration of the current scene.`;

  console.log(`Processing Turn ${currentTurnNumber} for Campaign ${campaignId}...`);
  const turnContext = buildTurnContext({
    campaign,
    outline,
    character,
    npcs,
    memories,
    pastTurns,
    currentTurnNumber,
    currentAct,
    activeQuestName,
    activeQuestDesc,
    playerAction,
    finalPlayerAction,
    ruleset: rulesetData,
    currentLocation,
    knownLocations: knownLocationRows.map(row => row.name),
    party,
    actingCharacter,
    speakingCharacter: character,
    pacing,
    abilityDeclarations
  });
  const aiResponse = await runMultiAgentTurn({
    apiConfig,
    gmSystem,
    turnContext,
    turnPrompt,
    turnGate: { allowCommitted, actingName: actingCharacter.name }
  });

  const parsedRaw = parseJsonSafe(aiResponse);
  const turnData = validateTurnData(parsedRaw, currentAct, tableStyle);
  scrubDeclaredAbilityIdsFromPlayerText(turnData, abilityDeclarations);

  // Off-turn belt-and-braces (M2): the classification gate already rejected
  // off-turn committed actions; if a later call relabeled table talk as
  // committed, force it back to stateless dialogue rather than let an
  // off-turn actor mutate the world.
  if (!allowCommitted && turnData.input_kind === 'committed_action') {
    console.warn('[TURN ORDER] Off-turn input relabeled committed_action downstream; forcing table-talk no-op.');
    turnData.input_kind = 'dialogue';
  }

  // Decision 2026-06-05: dialogue is table talk too — no state mutation. The opening
  // turn (pinned to 'dialogue' in createCampaign so starting state survives the
  // validator net) never passes through takeTurn, so this backstop cannot wipe it.
  if (turnData.input_kind === 'clarification' || turnData.input_kind === 'dialogue') {
    console.log(`[CLARIFICATION] Engine backstop: forcing strict no-op on ${turnData.input_kind} turn (character/quest/ability/NPC/memory cleared, no dice). scene_grounding + narrative answer preserved for tabletop-style table talk.`);
    turnData.character_update = {
      health_change: 0,
      mana_change: 0,
      xp_gain: 0,
      inventory_changes: []
    };
    turnData.quest_update = {
      active_quest: activeQuestName,
      quest_description: activeQuestDesc,
      current_act: currentAct
    };
    turnData.ability_updates = [];
    turnData.npc_updates = [];
    turnData.memory_summary = null;
    turnData.memory_keywords = '';
    turnData.dice_rolls = [];
    turnData.location_update = null;
    // The heroic pipeline keys off this signal; a table-talk turn must not
    // trigger a render or move the heroic pointer any more than it may move
    // the location pointer above.
    turnData.focal_subject = null;
    // Pacing state is recorded from committed actions only.
    turnData.encounter = 'none';
  }

  // Dice results are referee-adjudicated and engine-rolled inside the Council pipeline;
  // the narration was written from them. The engine applies the adjudicated failure
  // consequences carried on each roll record — no hardcoded penalties.
  const diceRolls = Array.isArray(turnData.dice_rolls) ? turnData.dice_rolls : [];
  applyDiceConsequences(character, diceRolls);

  // Apply state updates (health/mana clamps, XP with unified level-up, inventory)
  const turnLevel = applyCharacterUpdate(character, turnData.character_update);
  if (turnLevel.leveledUp) {
    turnData.narrative += `\n\n🎉 **LEVEL UP! You have reached Level ${character.level}! Your maximum Health and Mana have increased!**`;
  }
  applyAbilityUpdates(character, turnData, currentTurnNumber);

  const nextAct = turnData.quest_update?.current_act || currentAct;

  // Fallback for SVG
  const svg = turnData.svg_illustration && turnData.svg_illustration.includes('<svg')
    ? turnData.svg_illustration
    : createFallbackSvg(activeQuestName, outline.theme_colors?.primary, outline.theme_colors?.secondary);

  // Resolved location for this turn (display + pointer update). Starts as the
  // current one; a gated location_update may move or refresh it below.
  let activeLocation = currentLocation;
  let nextTurnState = turnState;

  // Heroic pipeline (Phase V3): engine-owned pointer + stickiness. Generation
  // is synchronous within the turn (whole round ready before send, owner
  // direction 2026-06-13) but only runs when an image provider is configured;
  // otherwise the feature is inert and the SVG visualizer path is untouched.
  let currentHeroic = parseJsonObject(campaign.current_heroic_json, null);
  let heroicRender = null;
  if (apiConfig?.imageProvider) {
    const targetLocationName = turnData.location_update?.name || currentLocation?.name || null;
    const targetKey = targetLocationName ? locationKey(targetLocationName) : null;
    const locationChanged = !!(turnData.location_update && (!currentLocation || locationKey(currentLocation.name) !== targetKey));
    const subject = resolveHeroicSubject({
      current: currentHeroic,
      focal: turnData.focal_subject,
      locationChanged,
      locationKey: targetKey,
      turnNumber: currentTurnNumber
    });
    if (subject) {
      // The render is conditioned on the SUBJECT's identity record: for a
      // location subject that is the focal location itself (which may differ
      // from where the player stands); for an NPC the current location is
      // only the backdrop. Anchors are visual canon — a mismatched lookup
      // here would permanently cross-contaminate identities.
      let subjectLocationName = null;
      let subjectLocationDescription = '';
      const lookupKey = subject.kind === 'location' ? subject.key : targetKey;
      if (turnData.location_update && locationKey(turnData.location_update.name) === lookupKey) {
        subjectLocationName = turnData.location_update.name;
        subjectLocationDescription = turnData.location_update.generated_layout?.description || '';
      }
      if (lookupKey && (!subjectLocationName || !subjectLocationDescription)) {
        const row = await db.get(`SELECT name, description FROM locations WHERE campaign_id = ? AND key = ?`, [campaignId, lookupKey]);
        if (row) {
          subjectLocationName = subjectLocationName || row.name;
          subjectLocationDescription = subjectLocationDescription || row.description || '';
        }
      }
      if (subject.kind === 'location' && !subjectLocationName) {
        // A focal location with no structured record has no identity to
        // anchor; skip rather than render (and anchor) the wrong place.
        console.warn(`[HEROIC] Focal location "${subject.key}" has no location record; skipping render.`);
      } else {
        heroicRender = await generateHeroicRender({
          apiConfig,
          campaignId,
          subject,
          npcs,
          locationName: subjectLocationName,
          locationDescription: subjectLocationDescription,
          outline,
          genre: campaign.genre,
          currentTurnNumber,
          // V5b: first NPC renders get a generated appearance descriptor
          descriptorClient: new AIClient(resolveAgentConfig(apiConfig, 'continuity'))
        });
      }
    }
  }

  await db.withWriteTransaction(async () => {
    // A. Check unique constraint race conditions
    const checkTurnExists = await db.get(
      `SELECT 1 FROM turns WHERE campaign_id = ? AND turn_number = ?`,
      [campaignId, currentTurnNumber]
    );
    if (checkTurnExists) {
      throw new Error(`Turn ${currentTurnNumber} has already been written. Transaction aborted.`);
    }

    // B. Save the acting character's updates (by character id — party-safe)
    await saveCharacterState(character);
    await syncPlayerCharacter(character.player_character_id, campaignId, character);

    // C. Save campaign progress (current act)
    await db.run(
      `UPDATE campaigns SET current_act = ? WHERE id = ?`,
      [nextAct, campaignId]
    );

    // D. Apply NPC updates
    if (turnData.npc_updates && Array.isArray(turnData.npc_updates)) {
      for (const update of turnData.npc_updates) {
        const existingNpc = npcs.find(n => n.name.toLowerCase() === update.name.toLowerCase());
        if (existingNpc) {
          const newRelation = Math.max(-100, Math.min(100, existingNpc.relationship_value + (update.relationship_change || 0)));
          
          let updatedNotes = existingNpc.notes || '';
          if (update.note_update) {
            updatedNotes += `\n[Turn ${currentTurnNumber}]: ${update.note_update}`;
          }

          await db.run(
            `UPDATE npcs SET relationship_value = ?, notes = ?, status = ? WHERE id = ?`,
            [newRelation, updatedNotes, update.status || existingNpc.status, existingNpc.id]
          );
        }
      }
    }

    // D2. Apply the gated location update (Phase V2): create on first entry,
    // refresh occupancy on revisit, move the engine-owned pointer. The
    // positional flag persists (V5c) so table talk mid-fight keeps the map.
    if (turnData.location_update) {
      await db.run(
        `UPDATE campaigns SET last_positional = ? WHERE id = ?`,
        [turnData.location_update.positional ? 1 : 0, campaignId]
      );
    }
    if (turnData.location_update) {
      const update = turnData.location_update;
      const key = locationKey(update.name);
      let locationRow = await db.get(
        `SELECT * FROM locations WHERE campaign_id = ? AND key = ?`,
        [campaignId, key]
      );

      if (!locationRow && update.generated_layout) {
        const layout = update.generated_layout;
        const insert = await db.run(
          `INSERT INTO locations (campaign_id, name, key, description, layout_json, occupancy_json, first_seen_turn, last_seen_turn)
           VALUES (?, ?, ?, ?, ?, '[]', ?, ?)`,
          [campaignId, update.name, key, layout.description || '', JSON.stringify(layout), currentTurnNumber, currentTurnNumber]
        );
        locationRow = await db.get(`SELECT * FROM locations WHERE id = ?`, [insert.id]);
        console.log(`[LOCATION] First entry: created structured layout for "${update.name}" (${layout.areas.length} areas).`);
      }

      const hydrated = hydrateLocationRow(locationRow);
      if (hydrated) {
        // The referee reports full occupancy (always including the player);
        // an empty list means it omitted the block — keep the prior layer.
        const occupancy = update.occupancy.length > 0
          ? validateLocationOccupancy(update.occupancy, hydrated.layout)
          : hydrated.occupancy;
        await db.run(
          `UPDATE locations SET occupancy_json = ?, last_seen_turn = ? WHERE id = ?`,
          [JSON.stringify(occupancy), currentTurnNumber, hydrated.id]
        );
        await db.run(
          `UPDATE campaigns SET current_location_id = ? WHERE id = ?`,
          [hydrated.id, campaignId]
        );
        activeLocation = { ...hydrated, occupancy };
      }
    }

    // D3. Commit the heroic render (Phase V3)
    if (heroicRender) {
      currentHeroic = await commitHeroicRender(campaignId, heroicRender, currentTurnNumber);
    }

    // D4. Advance the round-robin only when a committed action actually
    // RESOLVED (M2 + review fix): table talk never advances, and neither do
    // denials, needs_clarification, or referee parse failures — a player
    // never loses their turn to a "no". The normalized state persists either
    // way so legacy campaigns pick up a valid order on their first turn.
    nextTurnState = turnData.input_kind === 'committed_action' && turnData.action_resolved
      ? advanceTurnOrder(turnState)
      : turnState;
    await db.run(`UPDATE campaigns SET turn_state_json = ? WHERE id = ?`, [JSON.stringify(nextTurnState), campaignId]);

    // E. Save turn (character_id records who acted — Phase 3 M1)
    await db.run(
      `INSERT INTO turns (
         campaign_id, turn_number, character_id, player_action, narrative,
         state_changes_json, ability_invocations_json, svg_illustration
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        campaignId,
        currentTurnNumber,
        character.id,
        playerAction,
        turnData.narrative,
        JSON.stringify(turnData),
        JSON.stringify(abilityInvocations),
        svg
      ]
    );

    // F. Save memories with dynamic importance
    if (turnData.memory_summary) {
      await db.run(
        `INSERT INTO memories (campaign_id, turn_number, importance, summary, keywords) VALUES (?, ?, ?, ?, ?)`,
        [campaignId, currentTurnNumber, turnData.memory_importance || 3, turnData.memory_summary, turnData.memory_keywords || activeQuestName]
      );
    }

    // G. Update campaign summary
    if (currentTurnNumber % 5 === 0 && turnData.memory_summary) {
      await db.run(
        `UPDATE campaigns SET summary = ? WHERE id = ?`,
        [`Act ${nextAct}. Level ${character.level} ${character.class} pursuing: ${activeQuestName}. Last events: ${turnData.memory_summary}`, campaignId]
      );
    }

  });

  // Refetch updated NPCs to return
  const updatedNpcs = await db.all(`SELECT * FROM npcs WHERE campaign_id = ?`, [campaignId]);

  return {
    campaignId,
    title: campaign.title,
    genre: campaign.genre,
    setting: campaign.summary,
    themeColors: outline.theme_colors,
    themeFonts: outline.theme_fonts,
    tableStyle,
    character,
    party,
    turnOrder: buildTurnOrderView(nextTurnState, party),
    npcs: updatedNpcs,
    outline,
    currentQuest: turnData.quest_update || { active_quest: activeQuestName, quest_description: activeQuestDesc },
    currentAct: nextAct,
    rulesMode: !!campaign.rules_mode,
    ruleset: rulesetData,
    turn: {
      number: currentTurnNumber,
      // Who actually took this turn (pa-1). This is the SAME value written to
      // turns.character_id above — never turnOrder.actingCharacterId, which
      // has already advanced to the NEXT player by the time this view is
      // built (step D4).
      characterId: character.id,
      playerAction,
      inputKind: turnData.input_kind,
      narrative: turnData.narrative,
      sceneGrounding: turnData.scene_grounding || null,
      svg,
      suggestedChoices: turnData.suggested_choices || [],
      rollResults: diceRolls,
      voiceLines: buildVoiceScript(turnData.narration_lines, updatedNpcs),
      // Positional stickiness (V5c): a table-talk turn inherits the last
      // committed turn's positional state instead of dropping the map.
      location: buildLocationView(
        activeLocation,
        turnData.location_update ? turnData.location_update.positional : !!campaign.last_positional
      ),
      heroic: buildHeroicView(campaignId, currentHeroic)
    }
  };
}

export async function getCampaignState(campaignId) {
  const campaign = await db.get(`SELECT * FROM campaigns WHERE id = ?`, [campaignId]);
  if (!campaign) return null;

  const outlineRow = await db.get(`SELECT * FROM campaign_outlines WHERE campaign_id = ?`, [campaignId]);
  if (!outlineRow) throw new Error(`Campaign outline not found for campaign ${campaignId}.`);
  const outline = validateOutlineData(JSON.parse(outlineRow.outline_json));

  const party = await loadParty(campaignId);
  if (party.length === 0) throw new Error(`Character not found for campaign ${campaignId}.`);
  const turnState = validateTurnState(parseJsonObject(campaign.turn_state_json, null), party.map(c => c.id));
  const character = party.find(c => c.id === actingCharacterId(turnState)) || party[0];

  const npcs = await db.all(`SELECT * FROM npcs WHERE campaign_id = ?`, [campaignId]);

  const lastTurn = await db.get(
    `SELECT * FROM turns WHERE campaign_id = ? ORDER BY turn_number DESC LIMIT 1`,
    [campaignId]
  );

  let activeQuestName = outline.starting_quest.title;
  let activeQuestDesc = outline.starting_quest.description;
  let currentAct = campaign.current_act || 1;
  let suggestedChoices = [];
  let rollResults = [];
  let inputKind = 'committed_action';
  let lastTurnData = null;
  const currentLocation = await getCurrentLocation(campaign);

  if (lastTurn) {
    try {
      lastTurnData = JSON.parse(lastTurn.state_changes_json || '{}');
      if (lastTurnData.quest_update?.active_quest) {
        activeQuestName = lastTurnData.quest_update.active_quest;
        activeQuestDesc = lastTurnData.quest_update.quest_description || '';
      }
      // cr-4: records can be legacy or imported — never assume field shapes
      suggestedChoices = Array.isArray(lastTurnData.suggested_choices) ? lastTurnData.suggested_choices : [];
      if (Array.isArray(lastTurnData.dice_rolls) && lastTurnData.dice_rolls.length > 0) {
        // cr-4: element shapes are not guaranteed on legacy/imported records
        rollResults = lastTurnData.dice_rolls.filter(r => r && typeof r === 'object' && !Array.isArray(r));
      } else if (lastTurnData.roll_result && typeof lastTurnData.roll_result === 'object' && !Array.isArray(lastTurnData.roll_result)) {
        // Legacy pre-refactor turn record
        rollResults = [lastTurnData.roll_result];
      }
      inputKind = lastTurnData.input_kind || inputKind;
    } catch(e) {}
  }

  return {
    campaignId,
    title: campaign.title,
    genre: campaign.genre,
    setting: campaign.summary,
    themeColors: outline.theme_colors,
    themeFonts: outline.theme_fonts,
    rulesMode: !!campaign.rules_mode,
    ruleset: validateRulesetData(parseJsonObject(campaign.ruleset_json, null)),
    tableStyle: validateTableStyle(parseJsonObject(campaign.table_style_json, null)),
    character,
    party,
    turnOrder: buildTurnOrderView(turnState, party),
    npcs,
    outline,
    currentQuest: { active_quest: activeQuestName, quest_description: activeQuestDesc },
    currentAct,
    turn: {
      number: lastTurn ? lastTurn.turn_number : 1,
      // pa-1: the poll renders the shared transcript from THIS view, so the
      // author travels with the action. Legacy and solo rows carry NULL and
      // keep the pre-attribution label.
      characterId: lastTurn ? (lastTurn.character_id ?? null) : null,
      playerAction: lastTurn ? lastTurn.player_action : null,
      inputKind,
      narrative: lastTurn ? lastTurn.narrative : 'Beginning campaign...',
      sceneGrounding: lastTurnData ? lastTurnData.scene_grounding || null : null,
      svg: lastTurn ? lastTurn.svg_illustration : createFallbackSvg(campaign.title),
      suggestedChoices,
      rollResults,
      location: buildLocationView(currentLocation, !!campaign.last_positional),
      heroic: buildHeroicView(campaignId, parseJsonObject(campaign.current_heroic_json, null))
    }
  };
}

export async function listPlayerCharacters() {
  const rows = await db.all(
    `SELECT pc.*, c.title AS active_campaign_title
     FROM player_characters pc
     LEFT JOIN campaigns c ON c.id = pc.active_campaign_id
     ORDER BY pc.updated_at DESC, pc.created_at DESC`
  );

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    archetype: row.archetype,
    status: row.status,
    active_campaign_id: row.active_campaign_id,
    active_campaign_title: row.active_campaign_title || null,
    origin_campaign_id: row.origin_campaign_id,
    copied_from_character_id: row.copied_from_character_id,
    health: row.health,
    max_health: row.max_health,
    mana: row.mana,
    max_mana: row.max_mana,
    xp: row.xp,
    level: row.level,
    inventory: parseJsonArray(row.inventory_json),
    attributes: parseJsonObject(row.attributes_json),
    abilities: parseJsonArray(row.abilities_json),
    progression_notes: row.progression_notes || '',
    created_at: row.created_at,
    updated_at: row.updated_at
  }));
}

/**
 * Table-style dials (Phase D): adjustable mid-campaign (decision
 * 2026-07-04); takes effect on the next turn.
 */
export async function setTableStyle(campaignId, rawStyle) {
  const campaign = await db.get(`SELECT id FROM campaigns WHERE id = ?`, [campaignId]);
  if (!campaign) throw new Error(`Campaign ${campaignId} not found.`);
  const style = validateTableStyle(rawStyle);
  await db.run(`UPDATE campaigns SET table_style_json = ? WHERE id = ?`, [JSON.stringify(style), campaignId]);
  return style;
}

/**
 * Phase 3 M3: a new character joins an existing campaign's table — created
 * fresh or checked out from an available profile — and enters the
 * round-robin at the end of the order. Mirrors createCampaign's character
 * sourcing; no AI calls (the GM meets them in fiction on their first turn).
 */
export async function joinCampaign(campaignId, { characterName, characterClass, characterProfileId, characterMode = 'new' } = {}) {
  const campaign = await db.get(`SELECT * FROM campaigns WHERE id = ?`, [campaignId]);
  if (!campaign) throw new Error(`Campaign ${campaignId} not found.`);

  let sourceProfile = null;
  if (characterProfileId) {
    sourceProfile = await getPlayerCharacter(characterProfileId);
    if (!sourceProfile) throw new Error(`Character profile ${characterProfileId} not found.`);
    if (characterMode === 'existing' && sourceProfile.status !== 'available') {
      throw new Error(`Character "${sourceProfile.name}" is checked out to another active campaign. Copy the character to branch them into a new campaign.`);
    }
  }

  const name = sourceProfile ? sourceProfile.name : (typeof characterName === 'string' ? characterName.trim() : '');
  if (!name) throw new Error('characterName is required to join.');
  const archetype = sourceProfile ? sourceProfile.archetype : ((characterClass || '').trim() || 'Unformed protagonist');
  const attributes = sourceProfile
    ? parseJsonObject(sourceProfile.attributes_json, defaultAttributesForConcept(archetype))
    : defaultAttributesForConcept(archetype);
  const character = {
    name,
    class: archetype,
    health: sourceProfile?.health ?? 100,
    max_health: sourceProfile?.max_health ?? 100,
    mana: sourceProfile?.mana ?? 50,
    max_mana: sourceProfile?.max_mana ?? 50,
    xp: sourceProfile?.xp ?? 0,
    level: sourceProfile?.level ?? 1,
    inventory: sourceProfile ? parseJsonArray(sourceProfile.inventory_json) : createStarterInventory(),
    attributes,
    abilities: ensureAbilityIds(sourceProfile ? parseJsonArray(sourceProfile.abilities_json) : []),
    progression_notes: sourceProfile?.progression_notes || ''
  };

  let newCharacterId;
  await db.withWriteTransaction(async () => {
    let profileId = sourceProfile && characterMode === 'existing' ? sourceProfile.id : null;
    if (profileId) {
      const latest = await getPlayerCharacter(profileId);
      if (!latest || latest.status !== 'available') {
        throw new Error(`Character "${sourceProfile.name}" is no longer available.`);
      }
      await syncPlayerCharacter(profileId, campaignId, character);
    } else {
      const profileResult = await db.run(
        `INSERT INTO player_characters (
          name, archetype, status, active_campaign_id, origin_campaign_id, copied_from_character_id,
          health, max_health, mana, max_mana, xp, level, inventory_json, attributes_json, abilities_json, progression_notes
        ) VALUES (?, ?, 'checked_out', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          character.name, character.class, campaignId, campaignId, sourceProfile?.id || null,
          character.health, character.max_health, character.mana, character.max_mana,
          character.xp, character.level,
          JSON.stringify(character.inventory), JSON.stringify(character.attributes),
          JSON.stringify(character.abilities), character.progression_notes || ''
        ]
      );
      profileId = profileResult.id;
    }

    const characterResult = await db.run(
      `INSERT INTO characters (campaign_id, player_character_id, name, class, health, max_health, mana, max_mana, xp, level, inventory_json, attributes_json, abilities_json, progression_notes, baseline_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        campaignId, profileId, character.name, character.class,
        character.health, character.max_health, character.mana, character.max_mana,
        character.xp, character.level,
        JSON.stringify(character.inventory), JSON.stringify(character.attributes),
        JSON.stringify(character.abilities), character.progression_notes || '',
        characterBaselineJson(character)
      ]
    );
    newCharacterId = characterResult.id;

    // Enter the round-robin at the end of the order (active members only)
    const partyRows = await db.all(
      `SELECT id FROM characters WHERE campaign_id = ? AND COALESCE(status, 'active') = 'active' ORDER BY id ASC`,
      [campaignId]
    );
    const turnState = validateTurnState(parseJsonObject(campaign.turn_state_json, null), partyRows.map(row => row.id));
    await db.run(`UPDATE campaigns SET turn_state_json = ? WHERE id = ?`, [JSON.stringify(turnState), campaignId]);
  });

  const state = await getCampaignState(campaignId);
  state.joinedCharacterId = newCharacterId;
  return state;
}

/**
 * Phase 3 M2: one character leaves the table. Their profile is released
 * with current state written back and they drop out of the turn order; the
 * character row (and the campaign history it anchors) stays. The
 * campaign-scoped release below still frees the whole party when a campaign
 * ends.
 */
export async function releaseCharacter(campaignId, characterId) {
  const campaign = await db.get(`SELECT * FROM campaigns WHERE id = ?`, [campaignId]);
  if (!campaign) throw new Error(`Campaign ${campaignId} not found.`);
  const party = await loadParty(campaignId);
  const character = party.find(c => c.id === Number(characterId));
  if (!character) throw new Error(`Character ${characterId} not found in campaign ${campaignId}.`);

  await db.withWriteTransaction(async () => {
    await syncPlayerCharacter(character.player_character_id, campaignId, character, 'available');
    // 'released' takes the row out of loadParty (so order normalization can
    // never re-seat them) while history keeps its attribution.
    await db.run(`UPDATE characters SET player_character_id = NULL, status = 'released' WHERE id = ?`, [character.id]);
    // sv-1: the seat credential must not outlive the character's table
    // membership. A live token bound to a released character is orphaned,
    // and takeTurn's single-character fast path would re-bind it to whoever
    // remains — letting a departed player act as another one.
    await db.run(
      `UPDATE seats SET revoked_at = CURRENT_TIMESTAMP WHERE character_id = ? AND revoked_at IS NULL`,
      [character.id]
    );
    const turnState = validateTurnState(parseJsonObject(campaign.turn_state_json, null), party.map(c => c.id));
    const nextState = removeFromTurnOrder(turnState, character.id);
    await db.run(`UPDATE campaigns SET turn_state_json = ? WHERE id = ?`, [JSON.stringify(nextState), campaignId]);
  });
}

export async function releaseCampaignCharacters(campaignId, options = {}) {
  await db.withWriteTransaction(async () => {
    await db.run(
      `UPDATE player_characters
       SET status = 'available', active_campaign_id = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE active_campaign_id = ?`,
      [campaignId]
    );

    if (options.detachCampaign) {
      await db.run(
        `UPDATE characters SET player_character_id = NULL WHERE campaign_id = ?`,
        [campaignId]
      );
    }
  });
}

/**
 * Campaign portability (Phase P): one self-contained versioned JSON bundle
 * carrying the structured state the Council consults. Image binaries stay
 * behind (identity anchors travel; renders regenerate), so the heroic
 * pointer is deliberately not exported.
 */
async function buildCampaignExport(campaignId) {
  const campaign = await db.get(`SELECT * FROM campaigns WHERE id = ?`, [campaignId]);
  if (!campaign) throw new Error(`Campaign ${campaignId} not found.`);
  const outlineRow = await db.get(`SELECT outline_json FROM campaign_outlines WHERE campaign_id = ?`, [campaignId]);
  const characterRows = await db.all(`SELECT * FROM characters WHERE campaign_id = ? ORDER BY id ASC`, [campaignId]);
  const npcRows = await db.all(`SELECT * FROM npcs WHERE campaign_id = ? ORDER BY id ASC`, [campaignId]);
  const locationRows = await db.all(`SELECT * FROM locations WHERE campaign_id = ? ORDER BY id ASC`, [campaignId]);
  const memoryRows = await db.all(`SELECT * FROM memories WHERE campaign_id = ? ORDER BY id ASC`, [campaignId]);
  const turnRows = await db.all(`SELECT * FROM turns WHERE campaign_id = ? ORDER BY turn_number ASC`, [campaignId]);
  const vocabularyStateRow = await db.get(
    `SELECT vocabulary_version FROM campaign_vocabulary_state WHERE campaign_id = ?`,
    [campaignId]
  );
  const vocabularyRows = await db.all(
    `SELECT semantic_key, term, provenance, vocabulary_version
     FROM campaign_vocabulary_entries
     WHERE campaign_id = ? ORDER BY semantic_key ASC`,
    [campaignId]
  );
  const bindingRows = await db.all(
    `SELECT b.player_character_id, b.ability_id, b.term, b.prose,
            b.provenance, b.vocabulary_version, b.binding_set_revision
     FROM character_ability_bindings b
     WHERE b.campaign_id = ?
       AND EXISTS (
         SELECT 1 FROM characters c
         WHERE c.campaign_id = b.campaign_id
           AND c.player_character_id = b.player_character_id
           AND COALESCE(c.status, 'active') = 'active'
       )
     ORDER BY b.player_character_id ASC, b.ability_id ASC`,
    [campaignId]
  );
  const activeAbilityIdsByProfile = new Map();
  for (const row of characterRows) {
    if (
      (row.status || 'active') !== 'active'
      || !isPositiveSafeInteger(row.player_character_id)
    ) {
      continue;
    }
    const abilityIds = activeAbilityIdsByProfile.get(row.player_character_id) || new Set();
    for (const ability of parseJsonArray(row.abilities_json)) {
      const abilityId = abilityIdOf(ability);
      if (abilityId) abilityIds.add(abilityId);
    }
    activeAbilityIdsByProfile.set(row.player_character_id, abilityIds);
  }
  const portableBindingRows = bindingRows.filter(row => (
    activeAbilityIdsByProfile.get(row.player_character_id)?.has(row.ability_id)
  ));
  const currentLocationRow = campaign.current_location_id
    ? locationRows.find(row => row.id === campaign.current_location_id)
    : null;
  const turnState = validateTurnState(
    parseJsonObject(campaign.turn_state_json, null),
    characterRows.filter(row => (row.status || 'active') === 'active').map(row => row.id)
  );
  const ownedAbilitiesByCharacterId = new Map(
    characterRows.map(row => [row.id, parseJsonArray(row.abilities_json)])
  );

  return {
    kind: 'aetheria-campaign',
    format_version: CAMPAIGN_BUNDLE_VERSION,
    exported_at: new Date().toISOString(),
    campaign: {
      title: campaign.title,
      genre: campaign.genre,
      summary: campaign.summary,
      current_act: campaign.current_act,
      rules_mode: !!campaign.rules_mode,
      last_positional: !!campaign.last_positional,
      ruleset_json: campaign.ruleset_json,
      table_style_json: campaign.table_style_json,
      narrator_voice_json: campaign.narrator_voice_json
    },
    outline_json: outlineRow ? outlineRow.outline_json : '{}',
    characters: characterRows.map(row => ({
      source_id: row.id,
      source_profile_id: isPositiveSafeInteger(row.player_character_id)
        ? row.player_character_id
        : null,
      name: row.name,
      class: row.class,
      health: row.health,
      max_health: row.max_health,
      mana: row.mana,
      max_mana: row.max_mana,
      xp: row.xp,
      level: row.level,
      inventory_json: row.inventory_json,
      attributes_json: row.attributes_json,
      abilities_json: row.abilities_json,
      progression_notes: row.progression_notes,
      status: row.status || 'active'
    })),
    portability: {
      vocabulary_version: vocabularyStateRow?.vocabulary_version ?? 0,
      vocabulary_entries: vocabularyRows.map(row => ({
        semantic_key: row.semantic_key,
        term: row.term,
        provenance: row.provenance,
        vocabulary_version: row.vocabulary_version
      })),
      character_ability_bindings: portableBindingRows.map(row => ({
        source_profile_id: row.player_character_id,
        ability_id: row.ability_id,
        term: row.term,
        prose: row.prose,
        provenance: row.provenance,
        vocabulary_version: row.vocabulary_version,
        binding_set_revision: row.binding_set_revision
      }))
    },
    npcs: npcRows.map(row => ({
      name: row.name,
      role: row.role,
      personality: row.personality,
      quirks: row.quirks,
      relationship_value: row.relationship_value,
      notes: row.notes,
      status: row.status,
      voice_json: row.voice_json,
      anchor_json: row.anchor_json
    })),
    locations: locationRows.map(row => ({
      name: row.name,
      key: row.key,
      description: row.description,
      layout_json: row.layout_json,
      occupancy_json: row.occupancy_json,
      anchor_json: row.anchor_json,
      first_seen_turn: row.first_seen_turn,
      last_seen_turn: row.last_seen_turn
    })),
    memories: memoryRows.map(row => ({
      turn_number: row.turn_number,
      importance: row.importance,
      summary: row.summary,
      keywords: row.keywords,
      created_at: row.created_at
    })),
    turns: turnRows.map(row => ({
      turn_number: row.turn_number,
      source_character_id: row.character_id,
      player_action: row.player_action,
      narrative: row.narrative,
      state_changes_json: row.state_changes_json,
      ability_invocations: safeAbilityInvocationRecord(
        row.ability_invocations_json,
        row.player_action,
        { ownedAbilities: ownedAbilitiesByCharacterId.get(row.character_id) || [] }
      ),
      svg_illustration: row.svg_illustration,
      created_at: row.created_at
    })),
    pointers: {
      current_location_key: currentLocationRow ? currentLocationRow.key : null,
      turn_order: turnState
    }
  };
}

/** Export one internally consistent snapshot, serialized with approvals. */
export async function exportCampaign(campaignId) {
  return db.withReadTransaction(() => buildCampaignExport(campaignId));
}

/**
 * Imports a bundle as a NEW campaign: everything re-validated
 * (validateCampaignBundle), every id-bearing pointer remapped to the fresh
 * ids, active characters get fresh checked-out profiles, and the heroic
 * pointer starts empty (renders regenerate from the imported anchors).
 */
export async function importCampaign(rawBundle) {
  const bundle = validateCampaignBundle(rawBundle);

  let newCampaignId;
  await db.withWriteTransaction(async () => {
    const campaignResult = await db.run(
      `INSERT INTO campaigns (title, genre, summary, current_act, rules_mode, ruleset_json, table_style_json, narrator_voice_json, last_positional)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        bundle.campaign.title, bundle.campaign.genre, bundle.campaign.summary, bundle.campaign.current_act,
        bundle.campaign.rules_mode,
        bundle.ruleset ? JSON.stringify(bundle.ruleset) : null,
        JSON.stringify(bundle.tableStyle),
        bundle.campaign.narrator_voice ? JSON.stringify(bundle.campaign.narrator_voice) : null,
        bundle.campaign.last_positional
      ]
    );
    newCampaignId = campaignResult.id;

    await db.run(
      `INSERT INTO campaign_outlines (campaign_id, outline_json) VALUES (?, ?)`,
      [newCampaignId, JSON.stringify(bundle.outline)]
    );

    const characterIdMap = new Map();
    const profileIdMap = new Map();
    const remappedAbilitiesBySourceCharacterId = new Map();
    // Imported ability records are new records in this store, so they get
    // fresh engine-issued ids — remapped consistently, so rows that shared an
    // id in the bundle still share one here. Bundles written before ids
    // simply have theirs minted.
    const abilityIdMap = new Map();
    const remapAbilityIds = (abilities) => (Array.isArray(abilities) ? abilities : []).map(ability => {
      if (!ability || typeof ability !== 'object') return ability;
      const sourceId = abilityIdOf(ability);
      if (!sourceId) return { ...ability, id: mintAbilityId() };
      if (!abilityIdMap.has(sourceId)) abilityIdMap.set(sourceId, mintAbilityId());
      return { ...ability, id: abilityIdMap.get(sourceId) };
    });
    for (const character of bundle.characters) {
      character.abilities = remapAbilityIds(character.abilities);
      if (character.source_id !== null) {
        remappedAbilitiesBySourceCharacterId.set(character.source_id, character.abilities);
      }
      let profileId = null;
      if (character.status === 'active') {
        const profileResult = await db.run(
          `INSERT INTO player_characters (
            name, archetype, status, active_campaign_id, origin_campaign_id,
            health, max_health, mana, max_mana, xp, level, inventory_json, attributes_json, abilities_json, progression_notes
          ) VALUES (?, ?, 'checked_out', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            character.name, character.class, newCampaignId, newCampaignId,
            character.health, character.max_health, character.mana, character.max_mana,
            character.xp, character.level,
            JSON.stringify(character.inventory), JSON.stringify(character.attributes),
            JSON.stringify(character.abilities), character.progression_notes
          ]
        );
        profileId = profileResult.id;
        if (character.source_profile_id !== null) {
          profileIdMap.set(character.source_profile_id, profileId);
        }
      }
      const characterResult = await db.run(
        `INSERT INTO characters (campaign_id, player_character_id, name, class, health, max_health, mana, max_mana, xp, level, inventory_json, attributes_json, abilities_json, progression_notes, status, baseline_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newCampaignId, profileId, character.name, character.class,
          character.health, character.max_health, character.mana, character.max_mana,
          character.xp, character.level,
          JSON.stringify(character.inventory), JSON.stringify(character.attributes),
          JSON.stringify(character.abilities), character.progression_notes, character.status,
          characterBaselineJson(character)
        ]
      );
      if (character.source_id !== null) characterIdMap.set(character.source_id, characterResult.id);
    }

    if (bundle.portability.vocabulary_version > 0) {
      await db.run(
        `INSERT INTO campaign_vocabulary_state (campaign_id, vocabulary_version)
         VALUES (?, ?)`,
        [newCampaignId, bundle.portability.vocabulary_version]
      );
    }
    for (const entry of bundle.portability.vocabulary_entries) {
      await db.run(
        `INSERT INTO campaign_vocabulary_entries
           (campaign_id, semantic_key, term, provenance, vocabulary_version)
         VALUES (?, ?, ?, ?, ?)`,
        [
          newCampaignId,
          entry.semantic_key,
          entry.term,
          entry.provenance,
          entry.vocabulary_version
        ]
      );
    }
    for (const binding of bundle.portability.character_ability_bindings) {
      const remappedProfileId = profileIdMap.get(binding.source_profile_id);
      const remappedAbilityId = abilityIdMap.get(binding.ability_id);
      if (!remappedProfileId || !remappedAbilityId) {
        throw new Error('Validated bundle portability reference could not be remapped.');
      }
      await db.run(
        `INSERT INTO character_ability_bindings
           (player_character_id, campaign_id, ability_id, term, prose,
            provenance, vocabulary_version, binding_set_revision)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          remappedProfileId,
          newCampaignId,
          remappedAbilityId,
          binding.term,
          binding.prose,
          binding.provenance,
          binding.vocabulary_version,
          binding.binding_set_revision
        ]
      );
    }

    for (const npc of bundle.npcs) {
      await db.run(
        `INSERT INTO npcs (campaign_id, name, role, personality, quirks, relationship_value, notes, status, voice_json, anchor_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newCampaignId, npc.name, npc.role, npc.personality, npc.quirks, npc.relationship_value,
         npc.notes, npc.status, npc.voice ? JSON.stringify(npc.voice) : null, npc.anchor ? JSON.stringify(npc.anchor) : null]
      );
    }

    const locationIdByKey = new Map();
    for (const location of bundle.locations) {
      const locationResult = await db.run(
        `INSERT INTO locations (campaign_id, name, key, description, layout_json, occupancy_json, anchor_json, first_seen_turn, last_seen_turn)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newCampaignId, location.name, location.key, location.description,
         JSON.stringify(location.layout), JSON.stringify(location.occupancy),
         location.anchor ? JSON.stringify(location.anchor) : null,
         location.first_seen_turn, location.last_seen_turn]
      );
      locationIdByKey.set(location.key, locationResult.id);
    }

    for (const memory of bundle.memories) {
      await db.run(
        `INSERT INTO memories (campaign_id, turn_number, importance, summary, keywords, created_at)
         VALUES (?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))`,
        [newCampaignId, memory.turn_number, memory.importance, memory.summary, memory.keywords, memory.created_at]
      );
    }

    for (const turn of bundle.turns) {
      const remappedInvocations = remapAbilityInvocationRecord(
        turn.ability_invocations,
        abilityIdMap,
        turn.player_action,
        {
          ownedAbilities: remappedAbilitiesBySourceCharacterId.get(turn.source_character_id) || []
        }
      );
      await db.run(
        `INSERT INTO turns (
           campaign_id, turn_number, character_id, player_action, narrative,
           state_changes_json, ability_invocations_json, svg_illustration, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))`,
        [newCampaignId, turn.turn_number,
         characterIdMap.get(turn.source_character_id) ?? null,
         turn.player_action, turn.narrative, turn.state_changes_json,
         JSON.stringify(remappedInvocations), turn.svg_illustration, turn.created_at]
      );
    }

    // Pointers, remapped to the fresh ids (heroic deliberately absent)
    const remappedOrder = bundle.pointers.turn_order.order
      .map(sourceId => characterIdMap.get(sourceId))
      .filter(id => id !== undefined);
    const activeIds = bundle.characters
      .filter(c => c.status === 'active' && c.source_id !== null)
      .map(c => characterIdMap.get(c.source_id))
      .filter(id => id !== undefined);
    const turnState = validateTurnState({
      order: remappedOrder,
      current_index: bundle.pointers.turn_order.current_index,
      round: bundle.pointers.turn_order.round
    }, activeIds);
    await db.run(`UPDATE campaigns SET turn_state_json = ? WHERE id = ?`, [JSON.stringify(turnState), newCampaignId]);

    if (bundle.pointers.current_location_key && locationIdByKey.has(bundle.pointers.current_location_key)) {
      await db.run(
        `UPDATE campaigns SET current_location_id = ? WHERE id = ?`,
        [locationIdByKey.get(bundle.pointers.current_location_key), newCampaignId]
      );
    }
  });

  return getCampaignState(newCampaignId);
}

/**
 * Fork campaign from any prior turn
 */
export async function forkCampaign(campaignId, turnNumber, newTitle) {
  // A. Get campaign info
  const campaign = await db.get(`SELECT * FROM campaigns WHERE id = ?`, [campaignId]);
  if (!campaign) throw new Error(`Campaign ${campaignId} not found.`);

  const outlineRow = await db.get(`SELECT * FROM campaign_outlines WHERE campaign_id = ?`, [campaignId]);
  if (!outlineRow) throw new Error(`Campaign outline not found for campaign ${campaignId}.`);
  const outline = validateOutlineData(JSON.parse(outlineRow.outline_json));

  // Phase 3 M1: fork the whole party. Each member's state is reconstructed
  // by replaying the turns THEY acted in (turns.character_id; legacy turns
  // with no character_id belong to the first member).
  // Active members only: released characters stay in the source history but
  // do not join the forked table (their old turns attribute to the first
  // member on replay, same as legacy turns).
  const sourceParty = await db.all(
    `SELECT * FROM characters WHERE campaign_id = ? AND COALESCE(status, 'active') = 'active' ORDER BY id ASC`,
    [campaignId]
  );
  if (sourceParty.length === 0) throw new Error(`Character not found for campaign ${campaignId}.`);

  // B. Fetch all turns up to turnNumber
  const turns = await db.all(
    `SELECT * FROM turns WHERE campaign_id = ? AND turn_number <= ? ORDER BY turn_number ASC`,
    [campaignId, turnNumber]
  );
  if (turns.length === 0) throw new Error(`No turns found up to turn ${turnNumber}.`);

  // C. Reconstruct per-character state and NPC states up to turnNumber
  const forkCharacters = new Map();
  for (const row of sourceParty) {
    // Seed from the member's arrival snapshot (review fix): a joiner who
    // arrived at level 5 replays from level 5, not from a fresh sheet.
    // Legacy rows without a baseline keep the old starter seed.
    const baseline = parseJsonObject(row.baseline_json, null);
    forkCharacters.set(row.id, {
      sourceId: row.id,
      sourceProfileId: row.player_character_id,
      baselineJson: row.baseline_json || null,
      name: row.name,
      class: row.class,
      health: baseline?.health ?? 100,
      max_health: baseline?.max_health ?? 100,
      mana: baseline?.mana ?? 50,
      max_mana: baseline?.max_mana ?? 50,
      xp: baseline?.xp ?? 0,
      level: baseline?.level ?? 1,
      inventory: Array.isArray(baseline?.inventory) ? baseline.inventory : createStarterInventory(),
      attributes: JSON.parse(row.attributes_json),
      abilities: ensureAbilityIds(Array.isArray(baseline?.abilities) ? baseline.abilities : []),
      progression_notes: baseline?.progression_notes || ''
    });
  }
  const firstSourceId = sourceParty[0].id;

  const sourceNpcs = await db.all(`SELECT * FROM npcs WHERE campaign_id = ? ORDER BY id ASC`, [campaignId]);
  const sourceNpcByName = new Map(sourceNpcs.map(npc => [npc.name.toLowerCase(), npc]));
  const npcs = (outline.key_npcs || []).map(npc => ({
    ...sourceNpcByName.get(npc.name.toLowerCase()),
    name: npc.name,
    role: npc.role,
    personality: npc.personality,
    quirks: npc.quirks,
    voice_mood: npc.voice_mood,
    relationship_value: 0,
    notes: `Created at campaign start. Role: ${npc.role}.`,
    status: 'alive'
  }));

  let lastAct = 1;
  // Location state is replayed to the fork point like character/NPC state:
  // each committed turn's location_update carries where the player was and
  // that location's occupancy at the time.
  let forkLocationKey = null;
  const forkLocationState = new Map();
  for (const turn of turns) {
    if (!turn.state_changes_json) continue;
    let turnData;
    try {
      turnData = JSON.parse(turn.state_changes_json);
    } catch (e) {
      continue;
    }

    if (turnData.location_update?.name) {
      const key = locationKey(turnData.location_update.name);
      forkLocationKey = key;
      forkLocationState.set(key, {
        occupancy: Array.isArray(turnData.location_update.occupancy) ? turnData.location_update.occupancy : [],
        lastSeen: turn.turn_number
      });
    }

    // Replay the turn's character update against whoever acted that turn
    const character = forkCharacters.get(turn.character_id) || forkCharacters.get(firstSourceId);
    applyCharacterUpdate(character, turnData.character_update);

    // Applying failed roll penalty if turn is not the first one and a failed roll is logged in state changes
    // (legacy pre-refactor turn records)
    if (turn.turn_number > 1 && turnData.roll_result && !turnData.roll_result.success && typeof turnData.roll_damage === 'number') {
      character.health = Math.max(0, character.health - turnData.roll_damage);
    }

    // Replay referee-adjudicated dice consequences (dice-before-narration turn records)
    if (turn.turn_number > 1) {
      applyDiceConsequences(character, turnData.dice_rolls);
    }
    applyAbilityUpdates(character, turnData, turn.turn_number);

    if (turnData.quest_update?.current_act) {
      lastAct = turnData.quest_update.current_act;
    }

    if (turnData.npc_updates && Array.isArray(turnData.npc_updates)) {
      turnData.npc_updates.forEach(update => {
        const existingNpc = npcs.find(n => n.name.toLowerCase() === update.name.toLowerCase());
        if (existingNpc) {
          existingNpc.relationship_value = Math.max(-100, Math.min(100, existingNpc.relationship_value + (update.relationship_change || 0)));
          if (update.note_update) {
            existingNpc.notes += `\n[Turn ${turn.turn_number}]: ${update.note_update}`;
          }
          if (update.status) {
            existingNpc.status = update.status;
          }
        }
      });
    }
  }

  let newCampaignId;
  let newPlayerCharacterId;
  await db.withWriteTransaction(async () => {
    const campaignResult = await db.run(
      `INSERT INTO campaigns (title, genre, summary, current_act, rules_mode, ruleset_json, table_style_json, narrator_voice_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newTitle, campaign.genre, campaign.summary, lastAct, campaign.rules_mode,
        campaign.ruleset_json || null, campaign.table_style_json || null,
        campaign.narrator_voice_json || null
      ]
    );
    newCampaignId = campaignResult.id;

    // Outline
    await db.run(
      `INSERT INTO campaign_outlines (campaign_id, outline_json) VALUES (?, ?)`,
      [newCampaignId, JSON.stringify(outline)]
    );

    // Characters: every party member forks with a fresh profile branch;
    // source ids map to new ids so copied turns stay attributed.
    const characterIdMap = new Map();
    for (const forked of forkCharacters.values()) {
      const profileResult = await db.run(
        `INSERT INTO player_characters (
          name, archetype, status, active_campaign_id, origin_campaign_id, copied_from_character_id,
          health, max_health, mana, max_mana, xp, level, inventory_json, attributes_json, abilities_json, progression_notes
        ) VALUES (?, ?, 'checked_out', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          forked.name,
          forked.class,
          newCampaignId,
          newCampaignId,
          forked.sourceProfileId || null,
          forked.health,
          forked.max_health,
          forked.mana,
          forked.max_mana,
          forked.xp,
          forked.level,
          JSON.stringify(forked.inventory),
          JSON.stringify(forked.attributes),
          JSON.stringify(forked.abilities),
          forked.progression_notes || ''
        ]
      );
      if (!newPlayerCharacterId) newPlayerCharacterId = profileResult.id;

      const characterResult = await db.run(
        `INSERT INTO characters (campaign_id, player_character_id, name, class, health, max_health, mana, max_mana, xp, level, inventory_json, attributes_json, abilities_json, progression_notes, baseline_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newCampaignId,
          profileResult.id,
          forked.name,
          forked.class,
          forked.health,
          forked.max_health,
          forked.mana,
          forked.max_mana,
          forked.xp,
          forked.level,
          JSON.stringify(forked.inventory),
          JSON.stringify(forked.attributes),
          JSON.stringify(forked.abilities),
          forked.progression_notes || '',
          forked.baselineJson
        ]
      );
      characterIdMap.set(forked.sourceId, characterResult.id);
    }

    // Fresh round-robin over the forked party in source order (M2)
    await db.run(
      `UPDATE campaigns SET turn_state_json = ? WHERE id = ?`,
      [JSON.stringify({
        order: sourceParty.map(row => characterIdMap.get(row.id)),
        current_index: 0,
        round: 1
      }), newCampaignId]
    );

    // NPCs
    for (const [npcIndex, npc] of npcs.entries()) {
      await db.run(
        `INSERT INTO npcs (campaign_id, name, role, personality, quirks, relationship_value, notes, status, voice_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newCampaignId, npc.name, npc.role, npc.personality, npc.quirks, npc.relationship_value, npc.notes, npc.status,
         npc.voice_json || JSON.stringify(assignNpcVoiceProfile(npc, npcIndex))]
      );
    }

    // Copy structured locations as they stood at the fork point: only places
    // discovered by then, with occupancy and last-seen replayed from the turn
    // records (a location's layout and identity anchor are canon once
    // created, so those copy verbatim). The engine-owned pointer goes to the
    // location the player was in at the fork turn — not the source
    // campaign's latest position.
    const locationRows = await db.all(
      `SELECT * FROM locations WHERE campaign_id = ? AND first_seen_turn <= ?`,
      [campaignId, turnNumber]
    );
    for (const location of locationRows) {
      const replayed = forkLocationState.get(location.key);
      const layout = validateLocationLayout(parseJsonObject(location.layout_json, null));
      const occupancy = replayed ? validateLocationOccupancy(replayed.occupancy, layout) : [];
      const copied = await db.run(
        `INSERT INTO locations (campaign_id, name, key, description, layout_json, occupancy_json, anchor_json, first_seen_turn, last_seen_turn, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newCampaignId, location.name, location.key, location.description, location.layout_json,
         JSON.stringify(occupancy), location.anchor_json, location.first_seen_turn,
         replayed ? replayed.lastSeen : location.first_seen_turn, location.created_at]
      );
      if (location.key === forkLocationKey) {
        await db.run(`UPDATE campaigns SET current_location_id = ? WHERE id = ?`, [copied.id, newCampaignId]);
      }
    }

    // Copy Turns up to turnNumber (acting-character ids remapped to the
    // forked party; legacy/opening turns keep null)
    for (const turn of turns) {
      const forkAbilityInvocations = safeAbilityInvocationRecord(
        turn.ability_invocations_json,
        turn.player_action,
        { ownedAbilities: forkCharacters.get(turn.character_id)?.abilities || [] }
      );
      await db.run(
        `INSERT INTO turns (
           campaign_id, turn_number, character_id, player_action, narrative,
           state_changes_json, ability_invocations_json, svg_illustration, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newCampaignId, turn.turn_number, characterIdMap.get(turn.character_id) ?? null,
         turn.player_action, turn.narrative, turn.state_changes_json,
         JSON.stringify(forkAbilityInvocations), turn.svg_illustration, turn.created_at]
      );
    }

    // Copy memories
    const lastTurnTimestamp = turns[turns.length - 1].created_at;
    const memoriesToCopy = await db.all(
      `SELECT * FROM memories 
       WHERE campaign_id = ? 
       AND (turn_number <= ? OR (turn_number IS NULL AND created_at <= ?))`,
      [campaignId, turnNumber, lastTurnTimestamp]
    );
    for (const memory of memoriesToCopy) {
      await db.run(
        `INSERT INTO memories (campaign_id, turn_number, importance, summary, keywords, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [newCampaignId, memory.turn_number, memory.importance, memory.summary, memory.keywords, memory.created_at]
      );
    }
  });

  return getCampaignState(newCampaignId);
}
