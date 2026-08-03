import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

await import("./fixtures.js");

const fixtures = globalThis.INTERACTION_BURDEN_FIXTURES;
assert.ok(fixtures, "fixtures.js must expose INTERACTION_BURDEN_FIXTURES");

const assertKeys = (value, expected, label) => {
  assert.deepEqual(
    Object.keys(value).sort(),
    [...expected].sort(),
    `${label} has unknown or missing fields`
  );
};

const assertDeepFrozen = (value, path = "fixtures") => {
  if (!value || typeof value !== "object") return;
  assert.ok(Object.isFrozen(value), `${path} must be frozen`);
  for (const [key, child] of Object.entries(value)) {
    assertDeepFrozen(child, `${path}.${key}`);
  }
};

const unique = (values, label) => {
  assert.equal(new Set(values).size, values.length, `${label} must be unique`);
};

const bandFor = (raw, target, marginWidth) => {
  if (raw === 100) return "crit_success";
  if (raw === 1) return "crit_failure";
  if (raw >= target && raw - target <= marginWidth - 1) return "marginal_success";
  if (raw >= target) return "clean_success";
  if (target - raw <= marginWidth) return "marginal_failure";
  return "clean_failure";
};

const successFor = (band) => band.endsWith("success");

assertDeepFrozen(fixtures);
assertKeys(
  fixtures,
  [
    "schemaVersion",
    "harnessVersion",
    "fixtureVersion",
    "sources",
    "enums",
    "shared",
    "variants",
    "schedules",
    "survey"
  ],
  "fixtures"
);
assert.equal(fixtures.schemaVersion, 1);
assert.equal(fixtures.harnessVersion, "0.1.0");
assert.equal(fixtures.fixtureVersion, "armsmaster-adept-pilot-v1");

assertKeys(
  fixtures.enums,
  [
    "actionKinds",
    "actionCosts",
    "automationCategories",
    "bands",
    "harm",
    "stages",
    "eventTypes",
    "surveyAnswers"
  ],
  "enums"
);
assert.deepEqual(fixtures.enums.actionKinds, [
  "ordinary",
  "form",
  "technique",
  "scenario"
]);
assert.deepEqual(fixtures.enums.actionCosts, ["main"]);
assert.deepEqual(fixtures.enums.automationCategories, [
  "bookkeeping",
  "tactical_choice"
]);
assert.deepEqual(fixtures.enums.harm, ["light", "standard", "heavy"]);
assert.deepEqual(fixtures.enums.stages, ["opening", "flow", "finishing"]);
assertKeys(
  fixtures.enums.surveyAnswers,
  ["meaningful", "dictated", "rechecking", "enjoyable", "campaignChoice"],
  "survey answer enums"
);

assertKeys(
  fixtures.sources,
  ["plan", "collapsePrototype", "frozenRules", "resolution", "effects"],
  "sources"
);
for (const [name, source] of Object.entries(fixtures.sources)) {
  assert.equal(typeof source, "string", `source ${name} must be a string`);
  assert.ok(source.length > 10, `source ${name} must be pinned`);
}

assertKeys(
  fixtures.shared,
  [
    "character",
    "actionEconomy",
    "resource",
    "check",
    "harmValues",
    "rangeLine",
    "conditionSemantics",
    "ordinaryActions",
    "scenarios",
    "resultTapes"
  ],
  "shared fixture"
);
assertKeys(
  fixtures.shared.character,
  [
    "id",
    "displayName",
    "pronouns",
    "description",
    "level",
    "healthBand",
    "might",
    "skillBonus",
    "maxHp",
    "startingHp",
    "defenses",
    "armor",
    "shield",
    "weapon"
  ],
  "shared character"
);
assertKeys(
  fixtures.shared.character.pronouns,
  ["subject", "object", "possessive"],
  "character pronouns"
);
assertKeys(
  fixtures.shared.character.defenses,
  ["guard", "reflex", "resolve"],
  "character defenses"
);
assertKeys(
  fixtures.shared.character.weapon,
  ["id", "label", "group", "ordinaryHarm"],
  "character weapon"
);
assertKeys(
  fixtures.shared.actionEconomy,
  ["main", "move", "reaction", "pilotPromptsForMove"],
  "action economy"
);
assertKeys(
  fixtures.shared.check,
  ["die", "meetOrBeat", "marginWidth", "tierTargets", "player", "opponent"],
  "shared check"
);
assertKeys(
  fixtures.shared.check.tierTargets,
  ["trivial", "easy", "standard", "hard", "extreme", "legendary"],
  "tier targets"
);
assertKeys(
  fixtures.shared.check.player,
  ["tier", "skillBonus", "netDelta", "target"],
  "player check"
);
assertKeys(
  fixtures.shared.check.opponent,
  [
    "baselineTier",
    "guardedTier",
    "skillBonus",
    "netDelta",
    "baselineTarget",
    "guardedTarget"
  ],
  "opponent check"
);
assertKeys(fixtures.shared.harmValues, fixtures.enums.harm, "harm values");
assertKeys(fixtures.shared.conditionSemantics, ["hindered"], "condition semantics");
assertKeys(
  fixtures.shared.conditionSemantics.hindered,
  ["duration", "means", "mustNotAssert", "fixtureConsequence"],
  "hindered semantics"
);
assertKeys(
  fixtures.shared.resultTapes,
  ["player", "stableOpponent"],
  "result tapes"
);

assert.equal(fixtures.shared.resource, null, "the pilot must not introduce Power");
assert.deepEqual(fixtures.shared.rangeLine, ["engaged", "near", "far"]);
assert.deepEqual(fixtures.shared.harmValues, {
  light: 4,
  standard: 5,
  heavy: 7
});
assert.equal(fixtures.shared.character.id, "pc.test.martial");
assert.equal(fixtures.shared.character.skillBonus, 20);
assert.equal(fixtures.shared.character.maxHp, 24);
assert.equal(fixtures.shared.character.startingHp, 24);
assert.deepEqual(fixtures.shared.actionEconomy, {
  main: 1,
  move: 1,
  reaction: 1,
  pilotPromptsForMove: false
});

const check = fixtures.shared.check;
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const playerTarget = clamp(
  check.tierTargets[check.player.tier] - check.player.skillBonus + check.player.netDelta,
  2,
  99
);
const baselineOpponentTarget = clamp(
  check.tierTargets[check.opponent.baselineTier] -
    check.opponent.skillBonus +
    check.opponent.netDelta,
  2,
  99
);
const guardedOpponentTarget = clamp(
  check.tierTargets[check.opponent.guardedTier] -
    check.opponent.skillBonus +
    check.opponent.netDelta,
  2,
  99
);
assert.equal(playerTarget, 30);
assert.equal(check.player.target, playerTarget);
assert.equal(baselineOpponentTarget, 25);
assert.equal(check.opponent.baselineTarget, baselineOpponentTarget);
assert.equal(guardedOpponentTarget, 50);
assert.equal(check.opponent.guardedTarget, guardedOpponentTarget);

unique(fixtures.enums.eventTypes, "event types");
unique(fixtures.enums.bands, "bands");
unique(fixtures.enums.harm, "harm tokens");
unique(fixtures.enums.stages, "stages");
assert.ok(fixtures.enums.automationCategories.includes("bookkeeping"));
assert.ok(fixtures.enums.automationCategories.includes("tactical_choice"));

const allActionIds = [];
for (const action of fixtures.shared.ordinaryActions) allActionIds.push(action.id);
for (const variant of fixtures.variants) {
  for (const action of variant.actions) allActionIds.push(action.id);
}
unique(allActionIds, "action ids");

const ordinaryIds = new Set(fixtures.shared.ordinaryActions.map((action) => action.id));
for (const action of fixtures.shared.ordinaryActions) {
  assertKeys(
    action,
    [
      "id",
      "kind",
      "label",
      "summary",
      "cost",
      "requiresCheck",
      "targetIds",
      "payload"
    ],
    `ordinary action ${action.id}`
  );
  assertKeys(
    action.payload,
    ["harm", "reposition", "condition", "objectiveEffect"],
    `${action.id} payload`
  );
  assert.ok(fixtures.enums.actionKinds.includes(action.kind));
  assert.ok(fixtures.enums.actionCosts.includes(action.cost));
  assert.equal(action.requiresCheck, true);
  assert.ok(action.targetIds.length > 0);
}

unique(fixtures.variants.map((variant) => variant.id), "variant ids");
assert.deepEqual(
  fixtures.variants.map((variant) => variant.id).sort(),
  ["free-forms", "linked-techniques"]
);

const forbiddenVariantFields = [
  "character",
  "check",
  "actionEconomy",
  "resource",
  "harmValues",
  "rangeLine",
  "scenarios",
  "resultTapes",
  "schedules"
];
for (const variant of fixtures.variants) {
  for (const field of forbiddenVariantFields) {
    assert.ok(!(field in variant), `${variant.id} may not override shared ${field}`);
  }
  assertKeys(
    variant,
    [
      "id",
      "revealLabel",
      "summary",
      "stateKind",
      "initialState",
      "ordinaryMainTransition",
      "actions"
    ],
    `variant ${variant.id}`
  );
  assert.ok(variant.actions.length > 0);
  for (const action of variant.actions) {
    assertKeys(
      action,
      [
        "id",
        "kind",
        "label",
        "summary",
        "cost",
        "legalStages",
        "restartFromAny",
        "targetIds",
        "advanceOn",
        "payload",
        "transition"
      ],
      `variant action ${action.id}`
    );
    assertKeys(
      action.payload,
      ["harm", "reposition", "condition", "guardShift"],
      `${action.id} payload`
    );
    assertKeys(
      action.transition,
      ["activeForm", "nextStage", "armedCounter"],
      `${action.id} transition`
    );
    if (action.payload.reposition !== null) {
      assertKeys(
        action.payload.reposition,
        ["who", "steps", "on"],
        `${action.id} reposition`
      );
    }
    if (action.payload.condition !== null) {
      assertKeys(
        action.payload.condition,
        ["token", "duration", "on"],
        `${action.id} condition`
      );
    }
    if (action.payload.guardShift !== null) {
      assertKeys(
        action.payload.guardShift,
        ["defense", "tiersHarder", "expires"],
        `${action.id} guard shift`
      );
    }
    assert.ok(fixtures.enums.actionCosts.includes(action.cost));
    assert.ok(fixtures.enums.actionKinds.includes(action.kind));
    assert.ok(action.targetIds.length > 0);
    assert.deepEqual(
      [...action.advanceOn].sort(),
      ["failure", "success"],
      `${action.id} must resolve the same transition after hit or miss`
    );
    if (action.payload.harm !== null) {
      assert.ok(fixtures.enums.harm.includes(action.payload.harm));
    }
  }
}

const forms = fixtures.variants.find((variant) => variant.id === "free-forms");
const techniques = fixtures.variants.find(
  (variant) => variant.id === "linked-techniques"
);
assert.equal(forms.stateKind, "form");
assert.equal(techniques.stateKind, "stage");
assertKeys(
  forms.initialState,
  ["activeForm", "armedCounter", "guardShift", "reactionAvailable"],
  "free-forms initial state"
);
assertKeys(
  forms.ordinaryMainTransition,
  ["activeForm", "armedCounter", "guardShift"],
  "free-forms ordinary transition"
);
assertKeys(
  techniques.initialState,
  ["stage", "armedCounter", "guardShift", "reactionAvailable"],
  "linked-techniques initial state"
);
assertKeys(
  techniques.ordinaryMainTransition,
  ["stage", "armedCounter", "guardShift"],
  "linked-techniques ordinary transition"
);
assert.equal(techniques.initialState.stage, "opening");
assert.equal(techniques.ordinaryMainTransition.stage, "opening");

assert.deepEqual(
  forms.actions.map((action) => action.id).sort(),
  ["form.driving", "form.guarding", "form.pressing"]
);
for (const action of forms.actions) {
  assert.deepEqual(action.legalStages, ["any"]);
  assert.equal(action.transition.activeForm, action.id.split(".")[1]);
}

const byStage = Object.fromEntries(
  fixtures.enums.stages.map((stage) => [
    stage,
    techniques.actions.filter((action) => action.legalStages.includes(stage))
  ])
);
for (const [stage, actions] of Object.entries(byStage)) {
  assert.equal(actions.length, 2, `stage ${stage} must have two choices`);
}
for (const action of byStage.opening) {
  assert.equal(action.restartFromAny, true);
  assert.equal(action.transition.nextStage, "flow");
}
for (const action of byStage.flow) {
  assert.equal(action.restartFromAny, false);
  assert.equal(action.transition.nextStage, "finishing");
}
for (const action of byStage.finishing) {
  assert.equal(action.restartFromAny, false);
  assert.equal(action.transition.nextStage, "opening");
}

const weights = fixtures.shared.harmValues;
assert.equal(weights.standard * 3, 15, "three Standard actions must total 15");
for (const opening of byStage.opening) {
  for (const flow of byStage.flow) {
    for (const finishing of byStage.finishing) {
      const total =
        weights[opening.payload.harm] +
        weights[flow.payload.harm] +
        weights[finishing.payload.harm];
      assert.equal(
        total,
        weights.standard * 3,
        `${opening.id} → ${flow.id} → ${finishing.id} must match three Standard actions`
      );
    }
  }
}

const breakLine = techniques.actions.find(
  (action) => action.id === "technique.break-line"
);
assert.deepEqual(breakLine.payload.condition, {
  token: "hindered",
  duration: "scene",
  on: "success"
});
assert.match(
  fixtures.shared.conditionSemantics.hindered.fixtureConsequence,
  /unimpaired sprint/
);

unique(fixtures.shared.scenarios.map((scenario) => scenario.id), "scenario ids");
assert.deepEqual(
  fixtures.shared.scenarios.map((scenario) => scenario.id).sort(),
  ["moving-rescue", "stable-duel"]
);
const entityIds = new Set([fixtures.shared.character.id]);
for (const scenario of fixtures.shared.scenarios) {
  assertKeys(
    scenario,
    ["id", "label", "objective", "startingState", "entities", "beats"],
    `scenario ${scenario.id}`
  );
  const expectedStartingStateKeys =
    scenario.id === "stable-duel"
      ? [
          "playerHp",
          "playerPosition",
          "opponentPosition",
          "playerHarmDealt",
          "opponentHasDefeatThreshold"
        ]
      : [
          "playerHp",
          "playerPosition",
          "blockerPosition",
          "allyPosition",
          "routeOpen",
          "allyThreatened",
          "blockerEscaped",
          "blockerFollowed",
          "rescueComplete"
        ];
  assertKeys(
    scenario.startingState,
    expectedStartingStateKeys,
    `${scenario.id} starting state`
  );
  assert.equal(scenario.beats.length, 4, `${scenario.id} must have four beats`);
  unique(scenario.entities.map((entity) => entity.id), `${scenario.id} entity ids`);
  for (const entity of scenario.entities) {
    assertKeys(entity, ["id", "label", "kind"], `entity ${entity.id}`);
    entityIds.add(entity.id);
  }
  unique(scenario.beats.map((beat) => beat.id), `${scenario.id} beat ids`);
  for (const beat of scenario.beats) {
    assertKeys(
      beat,
      [
        "id",
        "number",
        "prompt",
        "resultId",
        "legalOrdinaryActionIds",
        "legalTargetIds",
        "opponentResponseId",
        "objectiveRule"
      ],
      `beat ${beat.id}`
    );
    assert.equal(beat.number, scenario.beats.indexOf(beat) + 1);
    for (const actionId of beat.legalOrdinaryActionIds) {
      assert.ok(ordinaryIds.has(actionId), `${beat.id} references unknown ordinary action`);
    }
  }
}
for (const variant of fixtures.variants) {
  for (const action of variant.actions) {
    for (const targetId of action.targetIds) {
      assert.ok(entityIds.has(targetId), `${action.id} has unknown target ${targetId}`);
    }
  }
}

const playerTape = fixtures.shared.resultTapes.player;
unique(playerTape.map((result) => result.id), "player result ids");
assert.equal(playerTape.length, 8);
for (const result of playerTape) {
  assertKeys(
    result,
    ["id", "raw", "target", "expectedBand"],
    `player result ${result.id}`
  );
  assert.equal(result.target, playerTarget);
  const band = bandFor(result.raw, result.target, check.marginWidth);
  assert.equal(band, result.expectedBand, `${result.id} has wrong expected band`);
  assert.ok(
    band === "clean_success" || band === "clean_failure",
    `${result.id} must avoid edge-band prompts`
  );
  assert.equal(successFor(band), result.expectedBand === "clean_success");
}
for (const scenario of fixtures.shared.scenarios) {
  for (const beat of scenario.beats) {
    assert.ok(
      playerTape.some((result) => result.id === beat.resultId),
      `${beat.id} has no shared result`
    );
  }
}

const enemyTape = fixtures.shared.resultTapes.stableOpponent;
unique(enemyTape.map((result) => result.id), "opponent result ids");
assert.equal(enemyTape.length, 4);
for (const result of enemyTape) {
  assertKeys(
    result,
    ["id", "raw", "baselineTarget", "guardedTarget"],
    `opponent result ${result.id}`
  );
  assert.equal(result.baselineTarget, baselineOpponentTarget);
  assert.equal(result.guardedTarget, guardedOpponentTarget);
  for (const target of [result.baselineTarget, result.guardedTarget]) {
    assert.ok(
      ["clean_success", "clean_failure"].includes(
        bandFor(result.raw, target, check.marginWidth)
      ),
      `${result.id} must stay out of edge bands at target ${target}`
    );
  }
}

assert.equal(fixtures.schedules.length, 2);
unique(fixtures.schedules.map((schedule) => schedule.id), "schedule ids");
for (const schedule of fixtures.schedules) {
  assertKeys(schedule, ["id", "order"], `schedule ${schedule.id}`);
  assert.equal(schedule.order.length, 4);
  for (const entry of schedule.order) {
    assertKeys(
      entry,
      ["scenarioId", "variantSlot"],
      `${schedule.id} schedule entry`
    );
  }
  for (const scenarioId of ["stable-duel", "moving-rescue"]) {
    const slots = schedule.order
      .filter((entry) => entry.scenarioId === scenarioId)
      .map((entry) => entry.variantSlot)
      .sort();
    assert.deepEqual(slots, ["A", "B"], `${schedule.id} must pair ${scenarioId}`);
  }
}
assert.notDeepEqual(fixtures.schedules[0].order, fixtures.schedules[1].order);

assert.equal(fixtures.survey.length, 5);
unique(fixtures.survey.map((question) => question.id), "survey question ids");
for (const question of fixtures.survey) {
  assertKeys(question, ["id", "prompt", "answers"], `survey ${question.id}`);
  assert.deepEqual(
    question.answers,
    fixtures.enums.surveyAnswers[question.id],
    `${question.id} answers must use the closed enum`
  );
}

const fixtureText = await readFile(new URL("./fixtures.js", import.meta.url), "utf8");
for (const forbidden of [
  /\bfetch\s*\(/,
  /XMLHttpRequest/,
  /WebSocket/,
  /localStorage/,
  /sessionStorage/,
  /indexedDB/,
  /\/api\//,
  /https?:\/\//,
  /recommendedAction/,
  /defaultSelected/,
  /selectBestAction/
]) {
  assert.doesNotMatch(fixtureText, forbidden);
}

console.log("Interaction-burden pilot fixture verification passed.");
