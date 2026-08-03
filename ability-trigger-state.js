import { createHash } from 'crypto';
import { validateAbilityTriggers } from './public/ability-keywords.js';

export const ABILITY_TRIGGER_SCHEMA_VERSION = 1;
export const EMPTY_ABILITY_FAMILY_REGISTRY = Object.freeze([]);

const ABILITY_ID_LIMIT = 128;
const BINDING_TERM_LIMIT = 80;
const BINDING_PROSE_LIMIT = 500;
const FAMILY_LABEL_LIMIT = 80;
const FAMILY_TOKEN_LIMIT = 64;
const MAX_SAFE_COUNTER = Number.MAX_SAFE_INTEGER - 1;

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
