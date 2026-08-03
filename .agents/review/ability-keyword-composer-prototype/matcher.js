(() => {
  "use strict";

  const ABILITY_KEYS = [
    "id",
    "name",
    "trigger",
    "aliases",
    "familyKey",
    "familyLabel"
  ];
  const WORD_CHARACTER = /[\p{L}\p{N}_]/u;
  const WORD_TOKEN = /[\p{L}\p{N}_]+/gu;

  const assertPlainObject = (value, label) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError(`${label} must be an object`);
    }
  };

  const assertExactKeys = (value, expected, label) => {
    assertPlainObject(value, label);
    const actual = Object.keys(value).sort();
    const wanted = [...expected].sort();
    if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
      throw new TypeError(`${label} must contain exactly ${wanted.join(", ")}`);
    }
  };

  const normalizeIdentity = (value) => value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/gu, " ")
    .trim();

  const assertTrigger = (value, label) => {
    if (typeof value !== "string" || value.length === 0 || value.trim() !== value) {
      throw new TypeError(`${label} must be a non-empty string without outer whitespace`);
    }
    if (!/[\p{L}\p{N}]/u.test(value)) {
      throw new TypeError(`${label} must contain a letter or number`);
    }
    if (/[\[\]]/u.test(value)) {
      throw new TypeError(`${label} may not contain bracket command syntax`);
    }
  };

  const validateAbilityCatalog = (abilities, familyKeys = null) => {
    if (!Array.isArray(abilities) || abilities.length === 0) {
      throw new TypeError("abilities must be a non-empty array");
    }

    const allowedFamilies = familyKeys === null ? null : new Set(familyKeys);
    if (allowedFamilies && allowedFamilies.size !== familyKeys.length) {
      throw new TypeError("familyKeys must be unique");
    }

    const ids = new Set();
    const spellings = new Map();

    abilities.forEach((ability, abilityIndex) => {
      const label = `ability[${abilityIndex}]`;
      assertExactKeys(ability, ABILITY_KEYS, label);

      for (const key of ["id", "name", "familyKey", "familyLabel"]) {
        if (typeof ability[key] !== "string" || ability[key].trim() === "") {
          throw new TypeError(`${label}.${key} must be a non-empty string`);
        }
      }
      if (ids.has(ability.id)) throw new TypeError(`duplicate ability id ${ability.id}`);
      ids.add(ability.id);

      if (allowedFamilies && !allowedFamilies.has(ability.familyKey)) {
        throw new TypeError(`${label}.familyKey is not in the closed family palette`);
      }
      if (!Array.isArray(ability.aliases)) {
        throw new TypeError(`${label}.aliases must be an array`);
      }

      const ownedSpellings = [ability.trigger, ...ability.aliases];
      ownedSpellings.forEach((spelling, spellingIndex) => {
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
        spellings.set(normalized, ability.id);
      });
    });

    return true;
  };

  const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

  const codePointBefore = (text, index) => {
    if (index <= 0) return "";
    const first = text.charCodeAt(index - 1);
    if (first >= 0xdc00 && first <= 0xdfff && index >= 2) {
      const second = text.charCodeAt(index - 2);
      if (second >= 0xd800 && second <= 0xdbff) return text.slice(index - 2, index);
    }
    return text.slice(index - 1, index);
  };

  const codePointAt = (text, index) => {
    if (index >= text.length) return "";
    const first = text.charCodeAt(index);
    if (first >= 0xd800 && first <= 0xdbff && index + 1 < text.length) {
      const second = text.charCodeAt(index + 1);
      if (second >= 0xdc00 && second <= 0xdfff) return text.slice(index, index + 2);
    }
    return text.slice(index, index + 1);
  };

  const hasWordBoundary = (text, start, end, spelling) => {
    const spellingStart = codePointAt(spelling, 0);
    const spellingEnd = codePointBefore(spelling, spelling.length);
    const before = codePointBefore(text, start);
    const after = codePointAt(text, end);
    if (WORD_CHARACTER.test(spellingStart) && before && WORD_CHARACTER.test(before)) return false;
    if (WORD_CHARACTER.test(spellingEnd) && after && WORD_CHARACTER.test(after)) return false;
    return true;
  };

  const rangesOverlap = (left, right) => left.start < right.end && right.start < left.end;

  const collectExactMatches = (text, abilities) => {
    const candidates = [];
    abilities.forEach((ability, abilityIndex) => {
      [ability.trigger, ...ability.aliases].forEach((declaredSpelling, spellingIndex) => {
        const expression = new RegExp(escapeRegExp(declaredSpelling), "giu");
        let result;
        while ((result = expression.exec(text)) !== null) {
          const start = result.index;
          const end = start + result[0].length;
          if (!hasWordBoundary(text, start, end, result[0])) continue;
          candidates.push({
            abilityId: ability.id,
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
      if (accepted.some((match) => rangesOverlap(match, candidate))) continue;
      const { abilityIndex, spellingIndex, ...publicMatch } = candidate;
      accepted.push(publicMatch);
    }
    return accepted;
  };

  const damerauLevenshtein = (leftValue, rightValue, maximum = Number.POSITIVE_INFINITY) => {
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
  };

  const collectSuggestions = (text, abilities, matches) => {
    const suggestionCandidates = [];
    WORD_TOKEN.lastIndex = 0;
    let tokenMatch;
    while ((tokenMatch = WORD_TOKEN.exec(text)) !== null) {
      const start = tokenMatch.index;
      const end = start + tokenMatch[0].length;
      if (matches.some((match) => rangesOverlap(match, { start, end }))) continue;

      const perAbility = new Map();
      abilities.forEach((ability) => {
        for (const spelling of [ability.trigger, ...ability.aliases]) {
          if (/\s/u.test(spelling) || Array.from(normalizeIdentity(spelling)).length < 5) continue;
          const distance = damerauLevenshtein(tokenMatch[0], spelling, 1);
          if (distance !== 1) continue;
          const existing = perAbility.get(ability.id);
          if (!existing || distance < existing.distance) {
            perAbility.set(ability.id, { ability, distance });
          }
        }
      });

      if (perAbility.size === 0) continue;
      const closestDistance = Math.min(...[...perAbility.values()].map((item) => item.distance));
      const closest = [...perAbility.values()].filter((item) => item.distance === closestDistance);
      if (closest.length !== 1) continue;
      suggestionCandidates.push({
        start,
        end,
        replacement: closest[0].ability.trigger,
        abilityId: closest[0].ability.id
      });
    }
    return suggestionCandidates;
  };

  const scanAbilityTriggers = (text, ownedAbilities, options = {}) => {
    if (typeof text !== "string") throw new TypeError("text must be a string");
    const familyKeys = options.familyKeys ?? null;
    validateAbilityCatalog(ownedAbilities, familyKeys);

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
  };

  globalThis.AbilityKeywordMatcher = Object.freeze({
    scanAbilityTriggers,
    validateAbilityCatalog
  });
})();
