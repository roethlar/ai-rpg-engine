const ABILITY_TRIGGER_KEYS = Object.freeze([
  'abilityId',
  'definitionId',
  'definitionVersion',
  'name',
  'trigger',
  'aliases',
  'familyKey',
  'familyLabel',
  'help'
]);

const MAX_OWNED_ABILITIES = 100;
const MAX_ALIASES_PER_ABILITY = 12;
const MAX_ID_LENGTH = 128;
const MAX_NAME_LENGTH = 80;
const MAX_HELP_LENGTH = 500;
const WORD_CHARACTER = /[\p{L}\p{N}_]/u;
const WORD_TOKEN = /[\p{L}\p{N}_]+/gu;

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
}

function assertExactKeys(value, expected, label) {
  assertPlainObject(value, label);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new TypeError(`${label} must contain exactly ${wanted.join(', ')}`);
  }
}

function assertBoundedString(value, label, maximum) {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length > maximum
    || value.trim() !== value
  ) {
    throw new TypeError(`${label} must be a bounded non-empty string without outer whitespace`);
  }
}

function normalizeIdentity(value) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/gu, ' ')
    .trim();
}

function assertTrigger(value, label) {
  assertBoundedString(value, label, MAX_NAME_LENGTH);
  if (!/[\p{L}\p{N}]/u.test(value)) {
    throw new TypeError(`${label} must contain a letter or number`);
  }
  if (/[\[\]]/u.test(value)) {
    throw new TypeError(`${label} may not contain bracket command syntax`);
  }
}

/**
 * Validates the exact player-facing trigger projection shared by browser and
 * server. Empty lists are valid: until the real catalog lands, existing
 * free-text abilities deliberately project as non-invocable.
 */
export function validateAbilityTriggers(abilities, allowedFamilyKeys = null) {
  if (!Array.isArray(abilities) || abilities.length > MAX_OWNED_ABILITIES) {
    throw new TypeError(`abilities must be an array of at most ${MAX_OWNED_ABILITIES} entries`);
  }

  let allowedFamilies = null;
  if (allowedFamilyKeys !== null) {
    if (!Array.isArray(allowedFamilyKeys) || allowedFamilyKeys.some(key => typeof key !== 'string')) {
      throw new TypeError('allowedFamilyKeys must be an array of strings');
    }
    allowedFamilies = new Set(allowedFamilyKeys);
    if (allowedFamilies.size !== allowedFamilyKeys.length) {
      throw new TypeError('allowedFamilyKeys must be unique');
    }
  }

  const abilityIds = new Set();
  const spellings = new Map();

  abilities.forEach((ability, abilityIndex) => {
    const label = `ability[${abilityIndex}]`;
    assertExactKeys(ability, ABILITY_TRIGGER_KEYS, label);
    assertBoundedString(ability.abilityId, `${label}.abilityId`, MAX_ID_LENGTH);
    assertBoundedString(ability.definitionId, `${label}.definitionId`, MAX_ID_LENGTH);
    if (!Number.isSafeInteger(ability.definitionVersion) || ability.definitionVersion < 1) {
      throw new TypeError(`${label}.definitionVersion must be a positive safe integer`);
    }
    assertBoundedString(ability.name, `${label}.name`, MAX_NAME_LENGTH);
    assertTrigger(ability.trigger, `${label}.trigger`);
    assertBoundedString(ability.familyKey, `${label}.familyKey`, MAX_ID_LENGTH);
    assertBoundedString(ability.familyLabel, `${label}.familyLabel`, MAX_NAME_LENGTH);
    if (typeof ability.help !== 'string' || ability.help.length > MAX_HELP_LENGTH) {
      throw new TypeError(`${label}.help must be a string of at most ${MAX_HELP_LENGTH} characters`);
    }
    if (abilityIds.has(ability.abilityId)) {
      throw new TypeError(`duplicate ability id ${ability.abilityId}`);
    }
    abilityIds.add(ability.abilityId);

    if (allowedFamilies && !allowedFamilies.has(ability.familyKey)) {
      throw new TypeError(`${label}.familyKey is not in the closed family registry`);
    }
    if (!Array.isArray(ability.aliases) || ability.aliases.length > MAX_ALIASES_PER_ABILITY) {
      throw new TypeError(`${label}.aliases must contain at most ${MAX_ALIASES_PER_ABILITY} entries`);
    }

    [ability.trigger, ...ability.aliases].forEach((spelling, spellingIndex) => {
      const spellingLabel = spellingIndex === 0
        ? `${label}.trigger`
        : `${label}.aliases[${spellingIndex - 1}]`;
      assertTrigger(spelling, spellingLabel);
      const normalized = normalizeIdentity(spelling);
      if (spellings.has(normalized)) {
        throw new TypeError(
          `${spellingLabel} collides with an existing trigger or alias (${spelling})`
        );
      }
      spellings.set(normalized, ability.abilityId);
    });
  });

  return true;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function codePointBefore(text, index) {
  if (index <= 0) return '';
  const first = text.charCodeAt(index - 1);
  if (first >= 0xdc00 && first <= 0xdfff && index >= 2) {
    const second = text.charCodeAt(index - 2);
    if (second >= 0xd800 && second <= 0xdbff) return text.slice(index - 2, index);
  }
  return text.slice(index - 1, index);
}

function codePointAt(text, index) {
  if (index >= text.length) return '';
  const first = text.charCodeAt(index);
  if (first >= 0xd800 && first <= 0xdbff && index + 1 < text.length) {
    const second = text.charCodeAt(index + 1);
    if (second >= 0xdc00 && second <= 0xdfff) return text.slice(index, index + 2);
  }
  return text.slice(index, index + 1);
}

function hasWordBoundary(text, start, end, spelling) {
  const spellingStart = codePointAt(spelling, 0);
  const spellingEnd = codePointBefore(spelling, spelling.length);
  const before = codePointBefore(text, start);
  const after = codePointAt(text, end);
  if (WORD_CHARACTER.test(spellingStart) && before && WORD_CHARACTER.test(before)) return false;
  if (WORD_CHARACTER.test(spellingEnd) && after && WORD_CHARACTER.test(after)) return false;
  return true;
}

function rangesOverlap(left, right) {
  return left.start < right.end && right.start < left.end;
}

function collectExactMatches(text, abilities) {
  const candidates = [];
  abilities.forEach((ability, abilityIndex) => {
    [ability.trigger, ...ability.aliases].forEach((declaredSpelling, spellingIndex) => {
      const expression = new RegExp(escapeRegExp(declaredSpelling), 'giu');
      let result;
      while ((result = expression.exec(text)) !== null) {
        const start = result.index;
        const end = start + result[0].length;
        if (!hasWordBoundary(text, start, end, result[0])) continue;
        candidates.push({
          abilityId: ability.abilityId,
          familyKey: ability.familyKey,
          start,
          end,
          spelling: text.slice(start, end),
          canonicalTrigger: ability.trigger,
          abilityIndex,
          spellingIndex
        });
      }
    });
  });

  candidates.sort((left, right) => (
    left.start - right.start
    || (right.end - right.start) - (left.end - left.start)
    || left.abilityIndex - right.abilityIndex
    || left.spellingIndex - right.spellingIndex
  ));

  const accepted = [];
  for (const candidate of candidates) {
    if (accepted.some(match => rangesOverlap(match, candidate))) continue;
    const { abilityIndex, spellingIndex, ...publicMatch } = candidate;
    accepted.push(publicMatch);
  }
  return accepted;
}

function damerauLevenshtein(leftValue, rightValue, maximum = Number.POSITIVE_INFINITY) {
  const left = Array.from(normalizeIdentity(leftValue));
  const right = Array.from(normalizeIdentity(rightValue));
  if (Math.abs(left.length - right.length) > maximum) return maximum + 1;

  const matrix = Array.from(
    { length: left.length + 1 },
    () => new Array(right.length + 1).fill(0)
  );
  for (let row = 0; row <= left.length; row += 1) matrix[row][0] = row;
  for (let column = 0; column <= right.length; column += 1) matrix[0][column] = column;

  for (let row = 1; row <= left.length; row += 1) {
    let rowMinimum = Number.POSITIVE_INFINITY;
    for (let column = 1; column <= right.length; column += 1) {
      const substitutionCost = left[row - 1] === right[column - 1] ? 0 : 1;
      let distance = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + substitutionCost
      );
      if (
        row > 1
        && column > 1
        && left[row - 1] === right[column - 2]
        && left[row - 2] === right[column - 1]
      ) {
        distance = Math.min(distance, matrix[row - 2][column - 2] + 1);
      }
      matrix[row][column] = distance;
      rowMinimum = Math.min(rowMinimum, distance);
    }
    if (rowMinimum > maximum) return maximum + 1;
  }
  return matrix[left.length][right.length];
}

function collectSuggestions(text, abilities, matches) {
  const suggestions = [];
  WORD_TOKEN.lastIndex = 0;
  let tokenMatch;
  while ((tokenMatch = WORD_TOKEN.exec(text)) !== null) {
    const start = tokenMatch.index;
    const end = start + tokenMatch[0].length;
    if (matches.some(match => rangesOverlap(match, { start, end }))) continue;

    const perAbility = new Map();
    abilities.forEach(ability => {
      for (const spelling of [ability.trigger, ...ability.aliases]) {
        if (/\s/u.test(spelling) || Array.from(normalizeIdentity(spelling)).length < 5) continue;
        const distance = damerauLevenshtein(tokenMatch[0], spelling, 1);
        if (distance !== 1) continue;
        if (!perAbility.has(ability.abilityId)) perAbility.set(ability.abilityId, ability);
      }
    });

    if (perAbility.size !== 1) continue;
    const [ability] = perAbility.values();
    suggestions.push({
      start,
      end,
      replacement: ability.trigger,
      abilityId: ability.abilityId
    });
  }
  return suggestions;
}

export function scanAbilityTriggers(text, ownedAbilities, options = {}) {
  if (typeof text !== 'string') throw new TypeError('text must be a string');
  const familyKeys = options.familyKeys ?? null;
  validateAbilityTriggers(ownedAbilities, familyKeys);

  const matches = collectExactMatches(text, ownedAbilities);
  const abilityIds = [];
  const seenIds = new Set();
  for (const match of matches) {
    if (seenIds.has(match.abilityId)) continue;
    seenIds.add(match.abilityId);
    abilityIds.push(match.abilityId);
  }

  return {
    matches,
    abilityIds,
    suggestions: collectSuggestions(text, ownedAbilities, matches)
  };
}

function finalCodePoint(value) {
  const points = Array.from(value);
  return points.length === 0 ? '' : points[points.length - 1];
}

function firstCodePoint(value) {
  return Array.from(value)[0] ?? '';
}

export function computeAbilityInsertion(text, start, end, trigger) {
  if (typeof text !== 'string' || typeof trigger !== 'string' || trigger.length === 0) {
    throw new TypeError('text and trigger must be strings, and trigger must not be empty');
  }
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end > text.length) {
    throw new RangeError('selection must be a valid UTF-16 range');
  }

  const before = text.slice(0, start);
  const after = text.slice(end);
  const needsLeadingSpace = WORD_CHARACTER.test(finalCodePoint(before))
    && WORD_CHARACTER.test(firstCodePoint(trigger));
  const needsJoinedWordSpace = WORD_CHARACTER.test(finalCodePoint(trigger))
    && WORD_CHARACTER.test(firstCodePoint(after));
  const needsContinuationSpace = after.length === 0
    && before.trim().length > 0
    && !/\s$/u.test(trigger);
  const insertedText = `${needsLeadingSpace ? ' ' : ''}${trigger}${
    needsJoinedWordSpace || needsContinuationSpace ? ' ' : ''
  }`;
  const caret = start + insertedText.length;
  return {
    text: `${before}${insertedText}${after}`,
    insertedText,
    selectionStart: caret,
    selectionEnd: caret
  };
}

export function applyAbilitySuggestion(text, suggestion) {
  if (
    typeof text !== 'string'
    || !suggestion
    || !Number.isInteger(suggestion.start)
    || !Number.isInteger(suggestion.end)
    || typeof suggestion.replacement !== 'string'
    || suggestion.start < 0
    || suggestion.end < suggestion.start
    || suggestion.end > text.length
  ) {
    throw new TypeError('suggestion must describe a valid replacement range');
  }
  const nextText = `${text.slice(0, suggestion.start)}${suggestion.replacement}${text.slice(
    suggestion.end
  )}`;
  const caret = suggestion.start + suggestion.replacement.length;
  return { text: nextText, selectionStart: caret, selectionEnd: caret };
}
