import { createHash } from 'crypto';
import {
  scanAbilityTriggers,
  validateAbilityTriggers
} from './public/ability-keywords.js';

export const ABILITY_TRIGGER_SCHEMA_VERSION = 1;
export const ABILITY_INVOCATION_SCHEMA_VERSION = 1;
export const EMPTY_ABILITY_FAMILY_REGISTRY = Object.freeze([]);

const ABILITY_ID_LIMIT = 128;
const BINDING_TERM_LIMIT = 80;
const BINDING_PROSE_LIMIT = 500;
const FAMILY_LABEL_LIMIT = 80;
const FAMILY_TOKEN_LIMIT = 64;
const MAX_SAFE_COUNTER = Number.MAX_SAFE_INTEGER - 1;
const PLAYER_ACTION_LIMIT = 5000;
const INVOCATION_ABILITY_LIMIT = 100;
const INVOCATION_MATCH_LIMIT = 100;
const TRIGGER_REVISION_PATTERN = /^ak\d+:[a-f0-9]{64}$/u;

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
}

function assertExactKeys(value, keys, label) {
  assertPlainObject(value, label);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new TypeError(`${label} has an invalid shape`);
  }
}

function boundedExactString(value, label, maximum) {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length > maximum
    || value.trim() !== value
  ) {
    throw new TypeError(`${label} must be a bounded exact string`);
  }
  return value;
}

function positiveSafeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_SAFE_COUNTER) {
    throw new TypeError(`${label} must be a positive safe integer`);
  }
  return value;
}

function optionalVersion(value, label) {
  if (value === null || value === undefined) return null;
  if (Number.isSafeInteger(value) && value >= 0 && value <= MAX_SAFE_COUNTER) return value;
  if (typeof value === 'string' && value.length > 0 && value.length <= ABILITY_ID_LIMIT && value.trim() === value) {
    return value;
  }
  throw new TypeError(`${label} must be a bounded version scalar`);
}

function normalizeFamilyRegistry(families) {
  if (!Array.isArray(families) || families.length > 100) {
    throw new TypeError('familyRegistry must be an array of at most 100 entries');
  }
  const keys = new Set();
  const cssTokens = new Set();
  const normalized = families.map((family, index) => {
    const label = `familyRegistry[${index}]`;
    assertExactKeys(family, ['key', 'label', 'cssToken'], label);
    const key = boundedExactString(family.key, `${label}.key`, ABILITY_ID_LIMIT);
    const familyLabel = boundedExactString(family.label, `${label}.label`, FAMILY_LABEL_LIMIT);
    const cssToken = boundedExactString(family.cssToken, `${label}.cssToken`, FAMILY_TOKEN_LIMIT);
    if (!/^[a-z][a-z0-9-]*$/u.test(cssToken)) {
      throw new TypeError(`${label}.cssToken must be a safe closed CSS token`);
    }
    if (keys.has(key) || cssTokens.has(cssToken)) {
      throw new TypeError('familyRegistry keys and CSS tokens must be unique');
    }
    keys.add(key);
    cssTokens.add(cssToken);
    return Object.freeze({ key, label: familyLabel, cssToken });
  });
  return Object.freeze(normalized);
}

function normalizeBinding(binding, index) {
  const label = `binding[${index}]`;
  assertExactKeys(binding, ['abilityId', 'term', 'aliases', 'prose'], label);
  const abilityId = boundedExactString(binding.abilityId, `${label}.abilityId`, ABILITY_ID_LIMIT);
  const term = boundedExactString(binding.term, `${label}.term`, BINDING_TERM_LIMIT);
  const prose = boundedExactString(binding.prose, `${label}.prose`, BINDING_PROSE_LIMIT);
  if (!Array.isArray(binding.aliases) || binding.aliases.length > 12) {
    throw new TypeError(`${label}.aliases must contain at most 12 entries`);
  }
  const aliases = binding.aliases.map((alias, aliasIndex) => (
    boundedExactString(alias, `${label}.aliases[${aliasIndex}]`, BINDING_TERM_LIMIT)
  ));
  return Object.freeze({ abilityId, term, aliases: Object.freeze(aliases), prose });
}

function normalizeInvocationAbility(ability, binding, familyByKey, index) {
  const label = `character.abilities[${index}]`;
  assertPlainObject(ability, label);
  const abilityId = boundedExactString(ability.id, `${label}.id`, ABILITY_ID_LIMIT);
  const definitionId = boundedExactString(
    ability.definition_id,
    `${label}.definition_id`,
    ABILITY_ID_LIMIT
  );
  const definitionVersion = positiveSafeInteger(
    ability.definition_version,
    `${label}.definition_version`
  );
  boundedExactString(ability.name, `${label}.name`, BINDING_TERM_LIMIT);
  boundedExactString(ability.description, `${label}.description`, BINDING_PROSE_LIMIT);
  assertExactKeys(
    ability.invocation,
    ['schema_version', 'family_key'],
    `${label}.invocation`
  );
  if (ability.invocation.schema_version !== ABILITY_TRIGGER_SCHEMA_VERSION) {
    throw new TypeError(`${label}.invocation.schema_version is unsupported`);
  }
  const familyKey = boundedExactString(
    ability.invocation.family_key,
    `${label}.invocation.family_key`,
    ABILITY_ID_LIMIT
  );
  const family = familyByKey.get(familyKey);
  if (!family) throw new TypeError(`${label}.invocation.family_key is not in the catalog registry`);
  if (!binding) throw new TypeError(`${label} is invocable but has no campaign presentation binding`);

  return Object.freeze({
    abilityId,
    definitionId,
    definitionVersion,
    name: binding.term,
    trigger: binding.term,
    aliases: Object.freeze([...binding.aliases]),
    familyKey,
    familyLabel: family.label,
    help: binding.prose
  });
}

function revisionDigest(basis) {
  return `ak${ABILITY_TRIGGER_SCHEMA_VERSION}:${createHash('sha256')
    .update(JSON.stringify(basis), 'utf8')
    .digest('hex')}`;
}

function freezeMatches(matches) {
  return Object.freeze(matches.map(match => Object.freeze(match)));
}

function exactPlayerAction(value) {
  if (typeof value !== 'string' || value.length > PLAYER_ACTION_LIMIT) {
    throw new TypeError('playerAction must be a bounded string');
  }
  return value;
}

function exactTriggerRevision(value, { allowEmpty = false } = {}) {
  if (allowEmpty && value === '') return value;
  if (typeof value !== 'string' || !TRIGGER_REVISION_PATTERN.test(value)) {
    throw new TypeError('trigger revision is invalid');
  }
  return value;
}

function canonicalAbilitiesById(abilities) {
  if (!Array.isArray(abilities) || abilities.length > INVOCATION_ABILITY_LIMIT) {
    throw new TypeError('owned abilities must be a bounded array');
  }
  const byId = new Map();
  for (const [index, ability] of abilities.entries()) {
    if (!ability || typeof ability !== 'object' || Array.isArray(ability)) continue;
    if (typeof ability.id !== 'string' || !ability.id) continue;
    if (byId.has(ability.id)) {
      throw new TypeError(`duplicate owned ability id at index ${index}`);
    }
    byId.set(ability.id, ability);
  }
  return byId;
}

/**
 * Recomputes the authoritative declarations for one already-authenticated
 * speaking character. Browser matches never enter this function: both the
 * scan and the canonical definition lookup are rebuilt from live state.
 */
export function buildAbilityDeclarations({ character, playerAction } = {}) {
  assertPlainObject(character, 'character');
  const action = exactPlayerAction(playerAction);
  const revision = exactTriggerRevision(character.abilityTriggerRevision);
  const projected = character.invocableAbilities;
  validateAbilityTriggers(projected);

  const canonicalById = canonicalAbilitiesById(character.abilities);
  const projectedById = new Map(projected.map(ability => [ability.abilityId, ability]));
  const scan = scanAbilityTriggers(action, projected);
  const abilities = scan.abilityIds.map(abilityId => {
    const presentation = projectedById.get(abilityId);
    const canonical = canonicalById.get(abilityId);
    if (!presentation || !canonical) {
      throw new Error('Ability trigger scan produced a dangling owned ability');
    }
    if (
      canonical.definition_id !== presentation.definitionId
      || canonical.definition_version !== presentation.definitionVersion
    ) {
      throw new Error('Ability trigger projection disagrees with its canonical definition');
    }
    boundedExactString(canonical.name, 'canonical ability name', BINDING_TERM_LIMIT);
    boundedExactString(canonical.description, 'canonical ability description', BINDING_PROSE_LIMIT);
    assertExactKeys(
      canonical.invocation,
      ['schema_version', 'family_key'],
      'canonical ability invocation'
    );
    if (
      canonical.invocation.schema_version !== ABILITY_TRIGGER_SCHEMA_VERSION
      || canonical.invocation.family_key !== presentation.familyKey
    ) {
      throw new Error('Ability trigger projection disagrees with its invocation family');
    }

    const matches = scan.matches
      .filter(match => match.abilityId === abilityId)
      .map(match => Object.freeze({
        start: match.start,
        end: match.end,
        spelling: match.spelling,
        canonical_trigger: match.canonicalTrigger
      }));
    return Object.freeze({
      ability_id: abilityId,
      definition_id: canonical.definition_id,
      definition_version: canonical.definition_version,
      canonical_name: canonical.name,
      canonical_description: canonical.description,
      family_key: canonical.invocation.family_key,
      campaign_term: presentation.trigger,
      matches: Object.freeze(matches)
    });
  });

  return Object.freeze({
    schema_version: ABILITY_INVOCATION_SCHEMA_VERSION,
    trigger_revision: revision,
    abilities: Object.freeze(abilities)
  });
}

export function emptyAbilityInvocationRecord(triggerRevision = '') {
  const revision = exactTriggerRevision(triggerRevision, { allowEmpty: true });
  return Object.freeze({
    schema_version: ABILITY_INVOCATION_SCHEMA_VERSION,
    trigger_revision: revision,
    abilities: Object.freeze([])
  });
}

function normalizeInvocationSource(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      throw new TypeError('ability invocation record is not valid JSON');
    }
  }
  return raw;
}

function normalizeOwnedDefinitionMap(ownedAbilities) {
  if (ownedAbilities === null || ownedAbilities === undefined) return null;
  const canonicalById = canonicalAbilitiesById(ownedAbilities);
  const definitions = new Map();
  for (const [abilityId, ability] of canonicalById) {
    if (
      typeof ability.definition_id !== 'string'
      || ability.definition_id.length === 0
      || !Number.isSafeInteger(ability.definition_version)
      || ability.definition_version < 1
    ) {
      continue;
    }
    definitions.set(abilityId, {
      definitionId: ability.definition_id,
      definitionVersion: ability.definition_version
    });
  }
  return definitions;
}

/**
 * Validates the engine-owned durable invocation record. It is shared by live
 * persistence, recent-history reads, bundle import/export, and forks. Ranges
 * must reproduce the exact stored player prose; no name lookup or repair is
 * permitted.
 */
export function validateAbilityInvocationRecord(raw, playerAction, {
  ownedAbilities = null
} = {}) {
  const action = playerAction === null || playerAction === undefined
    ? ''
    : exactPlayerAction(playerAction);
  const source = normalizeInvocationSource(raw);
  if (source === null) return emptyAbilityInvocationRecord();
  assertExactKeys(source, ['schema_version', 'trigger_revision', 'abilities'], 'ability invocation record');
  if (source.schema_version !== ABILITY_INVOCATION_SCHEMA_VERSION) {
    throw new TypeError('ability invocation schema version is unsupported');
  }
  if (!Array.isArray(source.abilities) || source.abilities.length > INVOCATION_ABILITY_LIMIT) {
    throw new TypeError('ability invocation list is invalid');
  }
  const revision = exactTriggerRevision(source.trigger_revision, {
    allowEmpty: source.abilities.length === 0
  });
  const ownedDefinitions = normalizeOwnedDefinitionMap(ownedAbilities);
  const seenAbilityIds = new Set();
  const allRanges = [];
  let previousFirstStart = -1;
  const abilities = source.abilities.map((ability, abilityIndex) => {
    const label = `ability invocation[${abilityIndex}]`;
    assertExactKeys(
      ability,
      ['ability_id', 'definition_id', 'definition_version', 'matches'],
      label
    );
    const abilityId = boundedExactString(ability.ability_id, `${label}.ability_id`, ABILITY_ID_LIMIT);
    const definitionId = boundedExactString(
      ability.definition_id,
      `${label}.definition_id`,
      ABILITY_ID_LIMIT
    );
    const definitionVersion = positiveSafeInteger(
      ability.definition_version,
      `${label}.definition_version`
    );
    if (seenAbilityIds.has(abilityId)) throw new TypeError('ability invocation identity is duplicate');
    seenAbilityIds.add(abilityId);
    if (!Array.isArray(ability.matches) || ability.matches.length === 0 || ability.matches.length > INVOCATION_MATCH_LIMIT) {
      throw new TypeError(`${label}.matches is invalid`);
    }
    const owned = ownedDefinitions?.get(abilityId);
    if (ownedDefinitions && (
      !owned
      || owned.definitionId !== definitionId
      || owned.definitionVersion !== definitionVersion
    )) {
      throw new TypeError('ability invocation references an unowned definition');
    }

    let previousEnd = -1;
    const matches = ability.matches.map((match, matchIndex) => {
      const matchLabel = `${label}.matches[${matchIndex}]`;
      assertExactKeys(match, ['start', 'end', 'spelling'], matchLabel);
      if (
        !Number.isSafeInteger(match.start)
        || !Number.isSafeInteger(match.end)
        || match.start < 0
        || match.end <= match.start
        || match.end > action.length
        || match.start < previousEnd
      ) {
        throw new TypeError(`${matchLabel} range is invalid`);
      }
      const spelling = boundedExactString(match.spelling, `${matchLabel}.spelling`, BINDING_TERM_LIMIT);
      if (action.slice(match.start, match.end) !== spelling) {
        throw new TypeError(`${matchLabel} does not reproduce player_action`);
      }
      previousEnd = match.end;
      allRanges.push({ start: match.start, end: match.end });
      return Object.freeze({ start: match.start, end: match.end, spelling });
    });
    if (matches[0].start < previousFirstStart) {
      throw new TypeError('ability invocations are not ordered by first occurrence');
    }
    previousFirstStart = matches[0].start;
    return Object.freeze({
      ability_id: abilityId,
      definition_id: definitionId,
      definition_version: definitionVersion,
      matches: freezeMatches(matches)
    });
  });

  const orderedRanges = [...allRanges].sort((left, right) => left.start - right.start || left.end - right.end);
  for (let index = 1; index < orderedRanges.length; index += 1) {
    if (orderedRanges[index].start < orderedRanges[index - 1].end) {
      throw new TypeError('ability invocation ranges overlap');
    }
  }
  if (abilities.length > 0 && action.length === 0) {
    throw new TypeError('an empty player action cannot invoke an ability');
  }
  return Object.freeze({
    schema_version: ABILITY_INVOCATION_SCHEMA_VERSION,
    trigger_revision: revision,
    abilities: Object.freeze(abilities)
  });
}

export function abilityInvocationRecordFromDeclarations(declarations, playerAction) {
  assertExactKeys(declarations, ['schema_version', 'trigger_revision', 'abilities'], 'ability declarations');
  const raw = {
    schema_version: ABILITY_INVOCATION_SCHEMA_VERSION,
    trigger_revision: declarations.trigger_revision,
    abilities: declarations.abilities.map(ability => ({
      ability_id: ability.ability_id,
      definition_id: ability.definition_id,
      definition_version: ability.definition_version,
      matches: ability.matches.map(match => ({
        start: match.start,
        end: match.end,
        spelling: match.spelling
      }))
    }))
  };
  return validateAbilityInvocationRecord(raw, playerAction);
}

export function safeAbilityInvocationRecord(raw, playerAction, options = {}) {
  try {
    return validateAbilityInvocationRecord(raw, playerAction, options);
  } catch {
    return emptyAbilityInvocationRecord();
  }
}

export function remapAbilityInvocationRecord(record, abilityIdMap, playerAction, {
  ownedAbilities = null
} = {}) {
  if (!(abilityIdMap instanceof Map)) throw new TypeError('abilityIdMap must be a Map');
  const validated = validateAbilityInvocationRecord(record, playerAction);
  const remapped = {
    schema_version: validated.schema_version,
    trigger_revision: validated.trigger_revision,
    abilities: validated.abilities.map(ability => {
      const remappedId = abilityIdMap.get(ability.ability_id);
      if (!remappedId) throw new TypeError('ability invocation identifier could not be remapped');
      return {
        ability_id: remappedId,
        definition_id: ability.definition_id,
        definition_version: ability.definition_version,
        matches: ability.matches.map(match => ({ ...match }))
      };
    })
  };
  return validateAbilityInvocationRecord(remapped, playerAction, { ownedAbilities });
}

/**
 * Builds the only trigger metadata allowed to cross into browser state. An
 * ability with absent/null invocation metadata is passive for this feature;
 * current free-text abilities therefore remain inert instead of acquiring a
 * name-based legacy fallback.
 */
export function buildCharacterAbilityTriggerState({
  campaignId,
  character,
  bindings = [],
  familyRegistry = EMPTY_ABILITY_FAMILY_REGISTRY,
  catalogVersion = null,
  characterVersionId = null
} = {}) {
  positiveSafeInteger(campaignId, 'campaignId');
  assertPlainObject(character, 'character');
  positiveSafeInteger(character.id, 'character.id');
  const playerCharacterId = character.player_character_id === null
    || character.player_character_id === undefined
    ? null
    : positiveSafeInteger(character.player_character_id, 'character.player_character_id');
  const normalizedCatalogVersion = optionalVersion(catalogVersion, 'catalogVersion');
  const normalizedCharacterVersionId = optionalVersion(characterVersionId, 'characterVersionId');
  if (!Array.isArray(character.abilities) || character.abilities.length > 100) {
    throw new TypeError('character.abilities must be an array of at most 100 entries');
  }
  if (!Array.isArray(bindings) || bindings.length > 100) {
    throw new TypeError('bindings must be an array of at most 100 entries');
  }

  const families = normalizeFamilyRegistry(familyRegistry);
  const familyByKey = new Map(families.map(family => [family.key, family]));
  const normalizedBindings = bindings.map(normalizeBinding);
  const bindingByAbilityId = new Map();
  for (const binding of normalizedBindings) {
    if (bindingByAbilityId.has(binding.abilityId)) {
      throw new TypeError(`duplicate campaign binding for ability ${binding.abilityId}`);
    }
    bindingByAbilityId.set(binding.abilityId, binding);
  }

  const invocableAbilities = [];
  character.abilities.forEach((ability, index) => {
    if (!ability || typeof ability !== 'object' || ability.invocation === null || ability.invocation === undefined) {
      return;
    }
    const abilityId = typeof ability.id === 'string' ? ability.id : null;
    const binding = abilityId ? bindingByAbilityId.get(abilityId) : null;
    invocableAbilities.push(normalizeInvocationAbility(ability, binding, familyByKey, index));
  });
  validateAbilityTriggers(invocableAbilities, families.map(family => family.key));

  const frozenAbilities = Object.freeze([...invocableAbilities]);
  const revisionBasis = {
    schemaVersion: ABILITY_TRIGGER_SCHEMA_VERSION,
    campaignId,
    tableCharacterId: character.id,
    playerCharacterId,
    characterVersionId: normalizedCharacterVersionId,
    catalogVersion: normalizedCatalogVersion,
    abilities: frozenAbilities
  };
  return Object.freeze({
    abilityTriggerRevision: revisionDigest(revisionBasis),
    invocableAbilities: frozenAbilities
  });
}
