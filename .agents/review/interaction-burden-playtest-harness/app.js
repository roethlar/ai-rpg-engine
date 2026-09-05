(() => {
  "use strict";

  const fixtures = globalThis.INTERACTION_BURDEN_FIXTURES;
  if (!fixtures) {
    document.body.textContent = "The immutable playtest fixture could not be loaded.";
    return;
  }

  const EVENT_KEYS = [
    "seq",
    "runId",
    "scenarioId",
    "variantId",
    "beatId",
    "atMs",
    "type",
    "actionId",
    "targetId",
    "stateBefore",
    "stateAfter",
    "reason"
  ];
  const STATE_BEARING_EVENTS = new Set([
    "beat_ready",
    "automation",
    "result_commit",
    "beat_complete"
  ]);
  const CLASS_KINDS = new Set(["form", "technique"]);
  const REMINDER_REASONS = new Set([
    "rules_pointer",
    "interface_clarification",
    "non_tactical_pause"
  ]);
  const CONFOUND_REASONS = new Set([
    "harness_defect",
    "stale_state",
    "wrong_result",
    "tactic_coaching",
    "interrupted_session",
    "other_declared"
  ]);
  const KNOWN_ACTION_IDS = new Set([
    ...fixtures.shared.ordinaryActions.map((action) => action.id),
    ...fixtures.variants.flatMap((variant) => variant.actions.map((action) => action.id))
  ]);
  const KNOWN_TARGET_IDS = new Set([
    fixtures.shared.character.id,
    ...fixtures.shared.scenarios.flatMap((scenario) =>
      scenario.entities.map((entity) => entity.id)
    )
  ]);
  const debugMode = new URLSearchParams(globalThis.location.search).get("debug") === "1";
  const narrowQuery = globalThis.matchMedia("(max-width: 900px)");

  const $ = (id) => document.getElementById(id);
  const elements = {
    startView: $("start-view"),
    agreement: $("agreement"),
    startSession: $("start-session"),
    reloadNotice: $("reload-notice"),
    debugStart: $("debug-start"),
    playView: $("play-view"),
    runProgress: $("run-progress"),
    runTitle: $("run-title"),
    encounterTitle: $("encounter-title"),
    encounterObjective: $("encounter-objective"),
    beatProgress: $("beat-progress"),
    beatPrompt: $("beat-prompt"),
    sceneState: $("scene-state"),
    history: $("history"),
    actionForm: $("action-form"),
    intent: $("intent"),
    intentCount: $("intent-count"),
    actionFieldset: $("action-fieldset"),
    ordinaryActions: $("ordinary-actions"),
    classActions: $("class-actions"),
    targetFieldset: $("target-fieldset"),
    targetLegend: $("target-legend"),
    targetExplanation: $("target-explanation"),
    targetOptions: $("target-options"),
    selectionSummary: $("selection-summary"),
    submitAction: $("submit-action"),
    reminderReason: $("reminder-reason"),
    recordReminder: $("record-reminder"),
    helpToggle: $("help-toggle"),
    helpClose: $("help-close"),
    drawerBackdrop: $("drawer-backdrop"),
    rulesPanel: $("rules-panel"),
    mechanicState: $("mechanic-state"),
    rulesSummary: $("rules-summary"),
    rulesActions: $("rules-actions"),
    workedExample: $("worked-example"),
    debugRun: $("debug-run"),
    betweenRunView: $("between-run-view"),
    betweenRunTitle: $("between-run-title"),
    runSummary: $("run-summary"),
    continueSession: $("continue-session"),
    surveyView: $("survey-view"),
    surveyTitle: $("survey-title"),
    surveyForm: $("survey-form"),
    surveyQuestions: $("survey-questions"),
    submitSurvey: $("submit-survey"),
    completeView: $("complete-view"),
    mappingReveal: $("mapping-reveal"),
    confoundOptions: $("confound-options"),
    optionalNote: $("optional-note"),
    includeNote: $("include-note"),
    previewExport: $("preview-export"),
    downloadExport: $("download-export"),
    validationStatus: $("validation-status"),
    exportPreview: $("export-preview"),
    exportPreviewWrap: $("export-preview-wrap"),
    liveRegion: $("live-region")
  };

  let session = null;
  let activeRun = null;
  let selectedAction = null;
  let selectedTargetId = null;
  let lastPreviewPacket = null;
  let helpDrawerOpen = false;

  const clone = (value) => globalThis.structuredClone(value);

  const deepFreeze = (value) => {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      for (const child of Object.values(value)) deepFreeze(child);
      Object.freeze(value);
    }
    return value;
  };

  const assertKeys = (value, expected, label) => {
    const actual = Object.keys(value).sort();
    const wanted = [...expected].sort();
    if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
      throw new Error(`${label} has unknown or missing fields`);
    }
  };

  const assertAllowedKeys = (value, allowed, label) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`${label} must be an object`);
    }
    for (const key of Object.keys(value)) {
      if (!allowed.includes(key)) throw new Error(`${label} has unknown field ${key}`);
    }
  };

  const uuid = () => {
    if (typeof globalThis.crypto.randomUUID === "function") {
      return globalThis.crypto.randomUUID();
    }
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
      16,
      20
    )}-${hex.slice(20)}`;
  };

  const stableBit = (id, offset) => {
    const compact = id.replaceAll("-", "");
    return Number.parseInt(compact.slice(offset, offset + 2), 16) & 1;
  };

  const setVisibleView = (view) => {
    for (const candidate of [
      elements.startView,
      elements.playView,
      elements.betweenRunView,
      elements.surveyView,
      elements.completeView
    ]) {
      candidate.hidden = candidate !== view;
    }
    view.scrollIntoView({ block: "start" });
  };

  const announce = (message) => {
    elements.liveRegion.textContent = "";
    globalThis.requestAnimationFrame(() => {
      elements.liveRegion.textContent = message;
    });
  };

  const mechanicSnapshot = () => (activeRun ? clone(activeRun.mechanicState) : null);

  const currentContext = () => ({
    runId: activeRun?.id ?? null,
    scenarioId: activeRun?.scenario.id ?? null,
    variantId: activeRun?.variant.id ?? null,
    beatId: activeRun?.scenario.beats[activeRun.beatIndex]?.id ?? null
  });

  const validateInternalEvent = (event) => {
    assertKeys(event, EVENT_KEYS, `event ${event.seq}`);
    if (!fixtures.enums.eventTypes.includes(event.type)) {
      throw new Error(`Unknown event type ${event.type}`);
    }
    if (!Number.isInteger(event.seq) || event.seq < 1) throw new Error("Invalid event sequence");
    if (!Number.isInteger(event.atMs) || event.atMs < 0) throw new Error("Invalid event time");
    if (event.actionId !== null && !KNOWN_ACTION_IDS.has(event.actionId)) {
      throw new Error(`Unknown action ${event.actionId}`);
    }
    if (event.targetId !== null && !KNOWN_TARGET_IDS.has(event.targetId)) {
      throw new Error(`Unknown target ${event.targetId}`);
    }
    if (STATE_BEARING_EVENTS.has(event.type)) {
      if (event.stateBefore === null || event.stateAfter === null) {
        throw new Error(`${event.type} requires complete mechanic state`);
      }
    }
    const reason = event.reason;
    if (event.type === "session_start") {
      assertKeys(reason, ["scheduleId", "variantSlots"], "session_start reason");
      assertKeys(reason.variantSlots, ["A", "B"], "session_start variant slots");
    } else if (event.type === "run_start") {
      assertKeys(reason, ["ordinal", "pairOrdinal", "neutralLabel"], "run_start reason");
    } else if (event.type === "beat_ready") {
      assertKeys(
        reason,
        ["legalClassActionIds", "legalOrdinaryActionIds", "legalTargetIds"],
        "beat_ready reason"
      );
    } else if (event.type === "visibility_change") {
      assertKeys(reason, ["visibility"], "visibility_change reason");
    } else if (event.type === "help_open" || event.type === "help_close") {
      assertKeys(reason, ["viewport", "stateSignature"], `${event.type} reason`);
    } else if (event.type === "locked_action_attempt") {
      assertKeys(reason, ["requiredStages", "currentStage"], "locked action reason");
    } else if (event.type === "action_select") {
      if (reason !== "player_selected") throw new Error("Unknown action_select reason");
    } else if (event.type === "action_clear") {
      if (!["player_cleared", "player_replaced"].includes(reason)) {
        throw new Error("Unknown action_clear reason");
      }
    } else if (event.type === "target_select") {
      assertKeys(reason, ["binding"], "target_select reason");
      if (!["single_legal_target", "player_selected"].includes(reason.binding)) {
        throw new Error("Unknown target binding");
      }
    } else if (event.type === "target_clear") {
      if (!["action_changed", "action_cleared", "action_replaced", "player_cleared", "player_replaced"].includes(reason)) {
        throw new Error("Unknown target_clear reason");
      }
    } else if (event.type === "intent_submit") {
      assertKeys(reason, ["intentLength"], "intent_submit reason");
    } else if (event.type === "required_prompt" || event.type === "prompt_answer") {
      assertAllowedKeys(reason, ["promptId", "phase", "answerId"], `${event.type} reason`);
    } else if (event.type === "automation") {
      assertAllowedKeys(
        reason,
        ["category", "id", "resultId", "band", "opponentResponseId"],
        "automation reason"
      );
      if (!fixtures.enums.automationCategories.includes(reason.category) || !reason.id) {
        throw new Error("Invalid automation reason");
      }
    } else if (event.type === "result_commit") {
      assertKeys(reason, ["resultId", "raw", "target", "band"], "result_commit reason");
    } else if (event.type === "beat_complete") {
      assertKeys(reason, ["resultId"], "beat_complete reason");
    } else if (event.type === "operator_reminder") {
      if (!REMINDER_REASONS.has(reason)) throw new Error("Unknown operator reminder");
    } else if (event.type === "run_complete") {
      assertKeys(reason, ["selectedActionIds", "finalSceneState"], "run_complete reason");
    } else if (event.type === "survey_answer") {
      assertKeys(reason, ["scenarioId", "questionId", "answer"], "survey_answer reason");
    } else if (event.type === "session_complete") {
      assertKeys(reason, ["completedRuns"], "session_complete reason");
    } else if (event.type === "export") {
      assertKeys(reason, ["format", "explicit"], "export reason");
    }
  };

  const appendEvent = (type, fields = {}) => {
    if (!session) throw new Error("Cannot append without an active session");
    const context = currentContext();
    const fieldOr = (name, fallback) =>
      Object.prototype.hasOwnProperty.call(fields, name) ? fields[name] : fallback;
    const event = {
      seq: session.events.length + 1,
      runId: fieldOr("runId", context.runId),
      scenarioId: fieldOr("scenarioId", context.scenarioId),
      variantId: fieldOr("variantId", context.variantId),
      beatId: fieldOr("beatId", context.beatId),
      atMs: Math.max(0, Math.round(performance.now() - session.startedAt)),
      type,
      actionId: fieldOr("actionId", null),
      targetId: fieldOr("targetId", null),
      stateBefore: fields.stateBefore === undefined ? null : clone(fields.stateBefore),
      stateAfter: fields.stateAfter === undefined ? null : clone(fields.stateAfter),
      reason: fields.reason === undefined ? null : clone(fields.reason)
    };
    validateInternalEvent(event);
    deepFreeze(event);
    session.events.push(event);
    return event;
  };

  const createRuns = (sessionId, schedule, variantSlots) => {
    const seenByScenario = new Map();
    return schedule.order.map((entry, index) => {
      const pairOrdinal = (seenByScenario.get(entry.scenarioId) ?? 0) + 1;
      seenByScenario.set(entry.scenarioId, pairOrdinal);
      return {
        id: uuid(),
        ordinal: index + 1,
        pairOrdinal,
        neutralLabel: `Run ${pairOrdinal}`,
        scenario: fixtures.shared.scenarios.find((item) => item.id === entry.scenarioId),
        variantSlot: entry.variantSlot,
        variant: variantSlots[entry.variantSlot],
        beatIndex: 0,
        mechanicState: null,
        sceneState: null,
        conditions: new Set(),
        committedResults: new Map(),
        selectedActionIds: [],
        started: false,
        completed: false,
        sessionId
      };
    });
  };

  const detectInputMode = (mode) => {
    if (session && session.inputMode === "unknown") session.inputMode = mode;
  };

  const startSession = () => {
    const id = uuid();
    const schedule = fixtures.schedules[stableBit(id, 0)];
    const assignmentBit = stableBit(id, 2);
    const freeForms = fixtures.variants.find((variant) => variant.id === "free-forms");
    const linkedTechniques = fixtures.variants.find(
      (variant) => variant.id === "linked-techniques"
    );
    const variantSlots =
      assignmentBit === 0
        ? { A: freeForms, B: linkedTechniques }
        : { A: linkedTechniques, B: freeForms };

    session = {
      id,
      startedAt: performance.now(),
      schedule,
      variantSlots,
      runs: createRuns(id, schedule, variantSlots),
      runIndex: 0,
      events: [],
      responses: [],
      inputMode: "unknown",
      exported: false
    };
    activeRun = null;
    appendEvent("session_start", {
      runId: null,
      scenarioId: null,
      variantId: null,
      beatId: null,
      reason: {
        scheduleId: schedule.id,
        variantSlots: { A: variantSlots.A.id, B: variantSlots.B.id }
      }
    });

    if (debugMode) {
      elements.debugRun.hidden = false;
      elements.debugRun.textContent = `Debug IDs only — ${schedule.id}; A=${variantSlots.A.id}; B=${variantSlots.B.id}. No debug control can alter them.`;
    }
    beginRun();
  };

  const beginRun = () => {
    activeRun = session.runs[session.runIndex];
    activeRun.beatIndex = 0;
    activeRun.mechanicState = clone(activeRun.variant.initialState);
    activeRun.sceneState = clone(activeRun.scenario.startingState);
    activeRun.conditions = new Set();
    activeRun.committedResults = new Map();
    activeRun.selectedActionIds = [];
    activeRun.started = true;
    activeRun.completed = false;
    selectedAction = null;
    selectedTargetId = null;
    elements.history.replaceChildren();

    appendEvent("run_start", {
      beatId: null,
      stateBefore: null,
      stateAfter: null,
      reason: {
        ordinal: activeRun.ordinal,
        pairOrdinal: activeRun.pairOrdinal,
        neutralLabel: activeRun.neutralLabel
      }
    });
    setVisibleView(elements.playView);
    prepareBeat();
  };

  const actionById = (actionId) =>
    fixtures.shared.ordinaryActions.find((action) => action.id === actionId) ??
    activeRun.variant.actions.find((action) => action.id === actionId) ??
    null;

  const isClassActionLegal = (action) => {
    if (activeRun.variant.stateKind === "form") return true;
    return (
      action.restartFromAny === true ||
      action.legalStages.includes(activeRun.mechanicState.stage)
    );
  };

  const lockedReason = (action) => {
    const required = action.legalStages.join(" or ");
    return `Requires ${required}; current stage is ${activeRun.mechanicState.stage}.`;
  };

  const legalOrdinaryActions = () => {
    const beat = activeRun.scenario.beats[activeRun.beatIndex];
    return beat.legalOrdinaryActionIds.map((id) => actionById(id));
  };

  const legalClassActionIds = () =>
    activeRun.variant.actions.filter(isClassActionLegal).map((action) => action.id);

  const entityLabel = (targetId) => {
    if (targetId === fixtures.shared.character.id) return fixtures.shared.character.displayName;
    for (const scenario of fixtures.shared.scenarios) {
      const entity = scenario.entities.find((item) => item.id === targetId);
      if (entity) return entity.label;
    }
    return targetId;
  };

  const targetCandidates = (action) => {
    const beat = activeRun.scenario.beats[activeRun.beatIndex];
    return action.targetIds.filter(
      (targetId) =>
        beat.legalTargetIds.includes(targetId) ||
        (targetId === fixtures.shared.character.id &&
          action.payload?.reposition?.who === "self_or_target")
    );
  };

  const appendDefinition = (list, term, description) => {
    const dt = document.createElement("dt");
    dt.textContent = term;
    const dd = document.createElement("dd");
    dd.textContent = description;
    list.append(dt, dd);
  };

  const renderSceneState = () => {
    elements.sceneState.replaceChildren();
    const state = activeRun.sceneState;
    appendDefinition(elements.sceneState, "Rowan", `${state.playerHp} / 24 HP`);
    if (activeRun.scenario.id === "stable-duel") {
      appendDefinition(elements.sceneState, "Range", "Engaged");
      appendDefinition(elements.sceneState, "Harm dealt", `${state.playerHarmDealt}`);
      appendDefinition(elements.sceneState, "Opponent", "No defeat threshold in this fixture");
    } else {
      appendDefinition(elements.sceneState, "Route", state.routeOpen ? "Open" : "Blocked");
      appendDefinition(
        elements.sceneState,
        "Ally",
        state.rescueComplete
          ? "Extracted"
          : state.allyThreatened
            ? "Threatened"
            : "Awaiting help"
      );
      appendDefinition(
        elements.sceneState,
        "Blocker",
        state.blockerEscaped
          ? "Escaped"
          : state.blockerFollowed
            ? "Followed and contained"
            : activeRun.conditions.has("hindered")
              ? "Hindered"
              : "In play"
      );
    }
  };

  const renderMechanicState = () => {
    const state = activeRun.mechanicState;
    elements.mechanicState.replaceChildren();
    const list = document.createElement("dl");
    list.className = "state-list";
    if (activeRun.variant.stateKind === "form") {
      appendDefinition(
        list,
        "Active Form",
        state.activeForm ? `${state.activeForm[0].toUpperCase()}${state.activeForm.slice(1)}` : "None"
      );
    } else {
      appendDefinition(
        list,
        "Sequence stage",
        `${state.stage[0].toUpperCase()}${state.stage.slice(1)}`
      );
    }
    appendDefinition(list, "Armed Counter", state.armedCounter ?? "None");
    appendDefinition(list, "Guard shift", state.guardShift ? "One tier harder" : "None");
    appendDefinition(list, "Reaction", state.reactionAvailable ? "Available" : "Spent");
    elements.mechanicState.append(list);
  };

  const renderRules = () => {
    elements.rulesSummary.replaceChildren();
    const explanation = document.createElement("p");
    if (activeRun.variant.stateKind === "form") {
      explanation.textContent =
        "Choose or keep any Form when you act. Changing Form replaces the previous Form and its Counter. A printed Counter uses the normal Reaction and expires before the next beat. Every known Form is legal each beat.";
      elements.workedExample.textContent =
        "Example: choose Guarding Form. Its Light-harm action resolves, then Deflect is armed. If the next physical attack hits before the next beat, Deflect spends the Reaction and reduces harm one category.";
    } else {
      explanation.textContent =
        "The sequence begins at opening, advances to flow, then finishing, and returns to opening. Hit or miss advances. An opening technique may restart from any stage. An ordinary Main resets the next technique to opening. Sequence state is not a point resource.";
      elements.workedExample.textContent =
        "Example: choose Set Root while opening. Hit or miss, the next stage is flow. At flow, choose either Turning Drive or Catching Guard, or abandon the sequence by restarting with an opening.";
    }
    elements.rulesSummary.append(explanation);
    elements.rulesActions.replaceChildren();
    for (const action of activeRun.variant.actions) {
      const legal = isClassActionLegal(action);
      const card = document.createElement("div");
      card.className = "rules-action";
      card.dataset.legal = String(legal);
      const title = document.createElement("strong");
      title.textContent = action.label;
      const summary = document.createElement("span");
      summary.textContent = action.summary;
      const status = document.createElement("small");
      status.textContent = legal ? "Legal now" : lockedReason(action);
      card.append(title, summary, status);
      elements.rulesActions.append(card);
    }
  };

  const makeActionButton = (action, legal) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "action-card";
    button.dataset.actionId = action.id;
    button.setAttribute("aria-pressed", String(selectedAction?.id === action.id));
    button.setAttribute("aria-disabled", String(!legal));
    const title = document.createElement("strong");
    title.textContent = action.label;
    const summary = document.createElement("span");
    summary.textContent = action.summary;
    const status = document.createElement("small");
    status.textContent = legal ? "Main action" : lockedReason(action);
    button.append(title, summary, status);
    button.addEventListener("click", () => {
      if (!legal) {
        const state = mechanicSnapshot();
        appendEvent("locked_action_attempt", {
          actionId: action.id,
          stateBefore: state,
          stateAfter: state,
          reason: {
            requiredStages: [...action.legalStages],
            currentStage: activeRun.mechanicState.stage
          }
        });
        announce(`${action.label} is locked. ${lockedReason(action)}`);
        return;
      }
      chooseAction(action);
    });
    return button;
  };

  const renderActions = () => {
    elements.ordinaryActions.replaceChildren();
    elements.classActions.replaceChildren();
    const ordinaryHeading = document.createElement("h4");
    ordinaryHeading.textContent = "Ordinary and scenario actions";
    elements.ordinaryActions.append(ordinaryHeading);
    for (const action of legalOrdinaryActions()) {
      elements.ordinaryActions.append(makeActionButton(action, true));
    }
    const classHeading = document.createElement("h4");
    classHeading.textContent = "Control-scheme actions";
    elements.classActions.append(classHeading);
    for (const action of activeRun.variant.actions) {
      elements.classActions.append(makeActionButton(action, isClassActionLegal(action)));
    }
  };

  const clearTarget = (reason) => {
    if (selectedTargetId !== null) {
      appendEvent("target_clear", {
        actionId: selectedAction?.id ?? null,
        targetId: selectedTargetId,
        reason
      });
    }
    selectedTargetId = null;
    elements.targetOptions.replaceChildren();
    elements.targetFieldset.hidden = true;
  };

  const renderTargets = () => {
    clearTarget("action_changed");
    if (!selectedAction) return;
    const candidates = targetCandidates(selectedAction);
    if (candidates.length === 0) {
      throw new Error(`${selectedAction.id} has no legal target for this beat`);
    }
    if (candidates.length === 1) {
      selectedTargetId = candidates[0];
      appendEvent("target_select", {
        actionId: selectedAction.id,
        targetId: selectedTargetId,
        reason: { binding: "single_legal_target" }
      });
      elements.targetFieldset.hidden = false;
      elements.targetLegend.textContent = "Bound target";
      elements.targetExplanation.textContent = `Only one target is legal: ${entityLabel(
        selectedTargetId
      )}.`;
      const bound = document.createElement("p");
      bound.textContent = entityLabel(selectedTargetId);
      elements.targetOptions.append(bound);
      return;
    }

    elements.targetFieldset.hidden = false;
    const choosesReposition = selectedAction.payload?.reposition?.who === "self_or_target";
    elements.targetLegend.textContent = choosesReposition ? "Choose who repositions" : "Choose a target";
    elements.targetExplanation.textContent = choosesReposition
      ? "The attack still targets the opposition; this selection chooses who takes the printed step."
      : "No target is preselected.";
    for (const targetId of candidates) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "target-option";
      button.dataset.targetId = targetId;
      button.setAttribute("aria-pressed", "false");
      button.textContent = choosesReposition
        ? `Reposition ${entityLabel(targetId)}`
        : entityLabel(targetId);
      button.addEventListener("click", () => chooseTarget(targetId));
      elements.targetOptions.append(button);
    }
  };

  const chooseAction = (action) => {
    if (selectedAction?.id === action.id) {
      clearTarget("action_cleared");
      appendEvent("action_clear", { actionId: action.id, reason: "player_cleared" });
      selectedAction = null;
    } else {
      if (selectedAction) {
        clearTarget("action_replaced");
        appendEvent("action_clear", {
          actionId: selectedAction.id,
          reason: "player_replaced"
        });
      }
      selectedAction = action;
      appendEvent("action_select", { actionId: action.id, reason: "player_selected" });
      renderTargets();
    }
    renderActions();
    updateSubmissionState();
  };

  const chooseTarget = (targetId) => {
    if (selectedTargetId === targetId) {
      appendEvent("target_clear", {
        actionId: selectedAction.id,
        targetId,
        reason: "player_cleared"
      });
      selectedTargetId = null;
    } else {
      if (selectedTargetId !== null) {
        appendEvent("target_clear", {
          actionId: selectedAction.id,
          targetId: selectedTargetId,
          reason: "player_replaced"
        });
      }
      selectedTargetId = targetId;
      appendEvent("target_select", {
        actionId: selectedAction.id,
        targetId,
        reason: { binding: "player_selected" }
      });
    }
    for (const button of elements.targetOptions.querySelectorAll("button[data-target-id]")) {
      button.setAttribute("aria-pressed", String(button.dataset.targetId === selectedTargetId));
    }
    updateSubmissionState();
  };

  const updateSubmissionState = () => {
    const intentLength = elements.intent.value.trim().length;
    elements.intentCount.textContent = `${elements.intent.value.length} / 500`;
    const ready = intentLength > 0 && selectedAction !== null && selectedTargetId !== null;
    elements.submitAction.disabled = !ready;
    if (!selectedAction) {
      elements.selectionSummary.textContent = "No action selected.";
    } else if (!selectedTargetId) {
      elements.selectionSummary.textContent = `${selectedAction.label} selected; choose its target.`;
    } else {
      elements.selectionSummary.textContent = `${selectedAction.label} → ${entityLabel(
        selectedTargetId
      )}.`;
    }
  };

  const appendAutomation = (id, before, after, extra = {}) =>
    appendEvent("automation", {
      actionId: extra.actionId ?? selectedAction?.id ?? null,
      targetId: extra.targetId ?? selectedTargetId,
      stateBefore: before,
      stateAfter: after,
      reason: { category: "bookkeeping", id, ...extra.reason }
    });

  const resetBeatState = () => {
    const before = mechanicSnapshot();
    let changed = false;
    if (activeRun.mechanicState.armedCounter !== null) {
      activeRun.mechanicState.armedCounter = null;
      changed = true;
    }
    if (activeRun.mechanicState.guardShift !== null) {
      activeRun.mechanicState.guardShift = null;
      changed = true;
    }
    if (activeRun.mechanicState.reactionAvailable === false) {
      activeRun.mechanicState.reactionAvailable = true;
      changed = true;
    }
    if (changed) {
      appendAutomation("start_beat_cleanup", before, mechanicSnapshot(), {
        actionId: null,
        targetId: null
      });
    }
  };

  const applyAuthoredBeatChange = () => {
    const beat = activeRun.scenario.beats[activeRun.beatIndex];
    if (beat.id === "rescue.2" && !activeRun.sceneState.allyThreatened) {
      const state = mechanicSnapshot();
      activeRun.sceneState.allyThreatened = true;
      appendAutomation("ally_pulled_toward_hazard", state, state, {
        actionId: null,
        targetId: null
      });
    }
  };

  const prepareBeat = () => {
    resetBeatState();
    applyAuthoredBeatChange();
    selectedAction = null;
    selectedTargetId = null;
    elements.intent.value = "";
    elements.targetFieldset.hidden = true;
    const beat = activeRun.scenario.beats[activeRun.beatIndex];
    const state = mechanicSnapshot();
    appendEvent("beat_ready", {
      stateBefore: state,
      stateAfter: state,
      reason: {
        legalClassActionIds: legalClassActionIds(),
        legalOrdinaryActionIds: beat.legalOrdinaryActionIds,
        legalTargetIds: beat.legalTargetIds
      }
    });

    elements.runProgress.textContent = `Session run ${activeRun.ordinal} of ${session.runs.length}`;
    elements.runTitle.textContent = `${activeRun.scenario.label} — ${activeRun.neutralLabel}`;
    elements.encounterTitle.textContent = activeRun.scenario.label;
    elements.encounterObjective.textContent = `Goal: ${activeRun.scenario.objective}`;
    elements.beatProgress.textContent = `Beat ${beat.number} of ${activeRun.scenario.beats.length}`;
    elements.beatPrompt.textContent = beat.prompt;
    elements.actionFieldset.disabled = false;
    elements.intent.disabled = false;
    renderSceneState();
    renderMechanicState();
    renderRules();
    renderActions();
    updateSubmissionState();
    elements.intent.focus();
  };

  const resultForBeat = (beatId) =>
    fixtures.shared.resultTapes.player.find((result) => result.id === beatId);

  const isSuccess = (band) => band.endsWith("success");

  const harmAmount = (harm) => (harm === null ? 0 : fixtures.shared.harmValues[harm]);

  const reduceHarmCategory = (harm) => {
    if (harm === "heavy") return "standard";
    if (harm === "standard") return "light";
    return null;
  };

  const applyMechanicTransition = (action) => {
    const before = mechanicSnapshot();
    if (!CLASS_KINDS.has(action.kind)) {
      const transition = activeRun.variant.ordinaryMainTransition;
      if (activeRun.variant.stateKind === "form") {
        if (transition.activeForm !== "preserve") {
          activeRun.mechanicState.activeForm = transition.activeForm;
        }
      } else {
        activeRun.mechanicState.stage = transition.stage;
      }
      activeRun.mechanicState.armedCounter = transition.armedCounter;
      activeRun.mechanicState.guardShift = transition.guardShift;
    } else if (activeRun.variant.stateKind === "form") {
      activeRun.mechanicState.activeForm = action.transition.activeForm;
      activeRun.mechanicState.armedCounter = action.transition.armedCounter;
      activeRun.mechanicState.guardShift = action.payload.guardShift;
    } else {
      activeRun.mechanicState.stage = action.transition.nextStage;
      activeRun.mechanicState.armedCounter = action.transition.armedCounter;
      activeRun.mechanicState.guardShift = action.payload.guardShift;
    }
    appendAutomation("apply_mechanic_transition", before, mechanicSnapshot());
  };

  const applyActionEffects = (action, targetId, success, beat) => {
    const messages = [];
    if (action.payload.harm !== null) {
      if (success) {
        const amount = harmAmount(action.payload.harm);
        if (activeRun.scenario.id === "stable-duel") {
          activeRun.sceneState.playerHarmDealt += amount;
        }
        messages.push(`${action.payload.harm} harm lands`);
      } else {
        messages.push(`${action.payload.harm} harm misses`);
      }
    }

    const reposition = action.payload.reposition;
    const repositionApplies =
      reposition !== null && (reposition.on === "always" || (reposition.on === "success" && success));
    if (repositionApplies) {
      if (activeRun.scenario.id === "stable-duel") {
        messages.push(
          targetId === fixtures.shared.character.id
            ? "Rowan steps out, and the opponent closes to remain engaged"
            : "the opponent is driven back, then closes before its response"
        );
      } else {
        if (targetId === fixtures.shared.character.id || reposition.who === "self") {
          activeRun.sceneState.playerPosition = "near";
          messages.push("Rowan takes one bounded step");
        } else {
          activeRun.sceneState.blockerPosition = "near";
          messages.push("the blocker moves one bounded step");
        }
      }
    }

    if (beat.id === "rescue.1" && success && reposition !== null) {
      activeRun.sceneState.routeOpen = true;
      messages.push("the narrow route opens");
    }
    if (action.payload.condition?.token === "hindered" && success) {
      activeRun.conditions.add("hindered");
      messages.push("the blocker is Hindered for the scene");
    }
    if (action.payload.objectiveEffect === "clear_ally_threat_on_success" && success) {
      activeRun.sceneState.allyThreatened = false;
      messages.push("the ally's immediate threat clears");
    }
    if (action.payload.objectiveEffect === "complete_rescue_on_success" && success) {
      activeRun.sceneState.rescueComplete = true;
      activeRun.sceneState.allyThreatened = false;
      messages.push("the rescue is complete");
    }
    if (CLASS_KINDS.has(action.kind)) {
      if (activeRun.variant.stateKind === "form") {
        messages.push(`${activeRun.mechanicState.activeForm} Form is active`);
      } else {
        messages.push(`the sequence advances to ${activeRun.mechanicState.stage}`);
      }
      if (action.transition.armedCounter) {
        messages.push(`${action.transition.armedCounter} is armed under the normal Reaction cap`);
      }
      if (action.payload.guardShift) {
        messages.push("Guard is one tier harder until the next beat");
      }
    } else if (activeRun.variant.stateKind === "stage") {
      messages.push("the next technique resets to opening");
    }
    return messages;
  };

  const resolveStableOpponent = (beat) => {
    const tape = fixtures.shared.resultTapes.stableOpponent.find(
      (result) => result.id === beat.opponentResponseId
    );
    const guarded = activeRun.mechanicState.guardShift !== null;
    const target = guarded ? tape.guardedTarget : tape.baselineTarget;
    const hit = tape.raw >= target;
    let harm = "standard";
    let counterMessage = "";
    if (hit && activeRun.mechanicState.armedCounter === "deflect") {
      const before = mechanicSnapshot();
      harm = reduceHarmCategory(harm);
      activeRun.mechanicState.armedCounter = null;
      activeRun.mechanicState.reactionAvailable = false;
      appendAutomation("consume_deflect", before, mechanicSnapshot(), {
        actionId: selectedAction.id,
        targetId: fixtures.shared.character.id
      });
      counterMessage = " Deflect spends Rowan's Reaction and reduces harm one category.";
    }
    if (hit) activeRun.sceneState.playerHp -= harmAmount(harm);
    return hit
      ? `Opponent ${tape.raw} meets target ${target} and hits for ${harm ?? "no"} harm.${counterMessage}`
      : `Opponent ${tape.raw} misses target ${target}.`;
  };

  const resolveBlockerFlee = (action, targetId, success) => {
    const repositionStops =
      success &&
      action.payload.reposition !== null &&
      action.payload.reposition.who !== "self" &&
      targetId !== fixtures.shared.character.id;
    const hinderStops = success && activeRun.conditions.has("hindered");
    const pursueFollows =
      activeRun.mechanicState.armedCounter === "pursue" &&
      activeRun.mechanicState.reactionAvailable;
    if (hinderStops || repositionStops) {
      activeRun.sceneState.blockerEscaped = false;
      return hinderStops
        ? "The Hindered blocker cannot complete the unimpaired sprint."
        : "The repositioned blocker cannot reach the narrow exit.";
    }
    if (pursueFollows) {
      const before = mechanicSnapshot();
      activeRun.mechanicState.armedCounter = null;
      activeRun.mechanicState.reactionAvailable = false;
      activeRun.sceneState.blockerFollowed = true;
      activeRun.sceneState.blockerEscaped = false;
      activeRun.sceneState.playerPosition = "near";
      activeRun.sceneState.blockerPosition = "near";
      appendAutomation("consume_pursue", before, mechanicSnapshot(), {
        actionId: selectedAction.id,
        targetId: "npc.blocker"
      });
      return "Pursue spends Rowan's Reaction to follow one bounded move; the blocker is contained.";
    }
    activeRun.sceneState.blockerEscaped = true;
    return "The unimpaired blocker reaches the narrow escape.";
  };

  const cleanupAfterResponse = () => {
    const before = mechanicSnapshot();
    let changed = false;
    const messages = [];
    if (activeRun.mechanicState.guardShift !== null) {
      activeRun.mechanicState.guardShift = null;
      changed = true;
      messages.push("the temporary Guard shift expires");
    }
    if (activeRun.mechanicState.armedCounter !== null) {
      messages.push(`${activeRun.mechanicState.armedCounter} expires untriggered`);
      activeRun.mechanicState.armedCounter = null;
      changed = true;
    }
    if (changed) appendAutomation("expire_end_of_beat_state", before, mechanicSnapshot());
    return messages;
  };

  const narrationFor = (beat, action, targetId, result, effectMessages, responseMessage) => {
    const outcome = isSuccess(result.expectedBand) ? "succeeds" : "fails";
    const targetSentence =
      action.payload.reposition?.who === "self_or_target"
        ? `${action.label} attacks the opposition; ${entityLabel(targetId)} is the selected reposition subject.`
        : `${action.label} targets ${entityLabel(targetId)}.`;
    const pieces = [
      beat.prompt,
      targetSentence,
      `Rowan rolls ${result.raw} against ${result.target}: ${result.expectedBand.replaceAll(
        "_",
        " "
      )}; the action ${outcome}.`
    ];
    if (effectMessages.length > 0) pieces.push(`${effectMessages.join("; ")}.`);
    if (responseMessage) pieces.push(responseMessage);
    return pieces.join(" ");
  };

  const commitBeat = (action, targetId) => {
    const beat = activeRun.scenario.beats[activeRun.beatIndex];
    const key = `${activeRun.id}:${beat.id}`;
    if (activeRun.committedResults.has(key)) {
      return activeRun.committedResults.get(key);
    }

    const result = resultForBeat(beat.resultId);
    const success = isSuccess(result.expectedBand);
    const stateBefore = mechanicSnapshot();
    applyMechanicTransition(action);
    const effectMessages = applyActionEffects(action, targetId, success, beat);
    const afterActionEffects = mechanicSnapshot();
    appendAutomation("apply_selected_action_payload", afterActionEffects, afterActionEffects, {
      reason: { resultId: result.id, band: result.expectedBand }
    });
    let responseMessage = "";
    const beforeResponse = mechanicSnapshot();
    if (activeRun.scenario.id === "stable-duel") {
      responseMessage = resolveStableOpponent(beat);
    } else if (beat.id === "rescue.3") {
      responseMessage = resolveBlockerFlee(action, targetId, success);
    }
    if (beat.opponentResponseId !== null) {
      appendAutomation("apply_authored_opponent_response", beforeResponse, mechanicSnapshot(), {
        reason: { opponentResponseId: beat.opponentResponseId }
      });
    }
    effectMessages.push(...cleanupAfterResponse());
    const stateAfter = mechanicSnapshot();
    appendAutomation("close_beat", stateAfter, stateAfter, {
      reason: { resultId: result.id }
    });
    const narration = narrationFor(beat, action, targetId, result, effectMessages, responseMessage);
    const record = deepFreeze({
      key,
      runId: activeRun.id,
      beatId: beat.id,
      resultId: result.id,
      raw: result.raw,
      target: result.target,
      band: result.expectedBand,
      actionId: action.id,
      targetId,
      stateBefore,
      stateAfter,
      sceneState: clone(activeRun.sceneState),
      narration
    });
    activeRun.committedResults.set(key, record);
    appendEvent("result_commit", {
      actionId: action.id,
      targetId,
      stateBefore,
      stateAfter,
      reason: {
        resultId: result.id,
        raw: result.raw,
        target: result.target,
        band: result.expectedBand
      }
    });
    appendEvent("beat_complete", {
      actionId: action.id,
      targetId,
      stateBefore,
      stateAfter,
      reason: { resultId: result.id }
    });
    return record;
  };

  const reviewCommittedResult = (runId, beatId) => {
    if (activeRun.id !== runId) return;
    const beatIndex = activeRun.scenario.beats.findIndex((beat) => beat.id === beatId);
    if (beatIndex < 0) return;
    const currentBeatIndex = activeRun.beatIndex;
    activeRun.beatIndex = beatIndex;
    const record = commitBeat(
      actionById(activeRun.committedResults.get(`${runId}:${beatId}`).actionId),
      activeRun.committedResults.get(`${runId}:${beatId}`).targetId
    );
    activeRun.beatIndex = currentBeatIndex;
    announce(`Committed result for ${beatId}: ${record.narration}`);
  };

  const appendHistory = (intent, record) => {
    const item = document.createElement("li");
    const intentLine = document.createElement("div");
    intentLine.className = "intent-copy";
    intentLine.textContent = `Intent: “${intent}”`;
    const resultLine = document.createElement("div");
    resultLine.textContent = record.narration;
    const review = document.createElement("button");
    review.type = "button";
    review.textContent = `Review committed result ${record.beatId}`;
    review.dataset.reviewBeat = record.beatId;
    review.addEventListener("click", () => reviewCommittedResult(record.runId, record.beatId));
    item.append(intentLine, resultLine, review);
    elements.history.append(item);
  };

  const resolveSubmission = (event) => {
    event.preventDefault();
    const intent = elements.intent.value.trim();
    if (!intent || !selectedAction || !selectedTargetId) return;
    elements.intent.disabled = true;
    elements.actionFieldset.disabled = true;
    elements.submitAction.disabled = true;
    appendEvent("intent_submit", {
      actionId: selectedAction.id,
      targetId: selectedTargetId,
      reason: { intentLength: intent.length }
    });
    activeRun.selectedActionIds.push(selectedAction.id);
    const record = commitBeat(selectedAction, selectedTargetId);
    appendHistory(intent, record);
    renderSceneState();
    renderMechanicState();
    renderRules();
    announce(record.narration);

    if (activeRun.beatIndex + 1 < activeRun.scenario.beats.length) {
      activeRun.beatIndex += 1;
      prepareBeat();
    } else {
      completeRun();
    }
  };

  const completeRun = () => {
    activeRun.completed = true;
    const state = mechanicSnapshot();
    appendEvent("run_complete", {
      beatId: null,
      stateBefore: state,
      stateAfter: state,
      reason: {
        selectedActionIds: [...activeRun.selectedActionIds],
        finalSceneState: clone(activeRun.sceneState)
      }
    });
    elements.betweenRunTitle.textContent = `${activeRun.scenario.label} — ${activeRun.neutralLabel} complete`;
    elements.runSummary.replaceChildren();
    const text = document.createElement("p");
    text.textContent = `${activeRun.committedResults.size} authored results were committed. Reviewing a result reused its original tape entry.`;
    const sequence = document.createElement("p");
    sequence.textContent = `Selected sequence: ${activeRun.selectedActionIds
      .map((id) => actionById(id).label)
      .join(" → ")}.`;
    elements.runSummary.append(text, sequence);
    elements.continueSession.textContent =
      activeRun.pairOrdinal === 2 ? "Answer paired questions" : "Begin second run";
    setVisibleView(elements.betweenRunView);
    elements.continueSession.focus();
  };

  const responseLabel = (value) =>
    value
      .replaceAll("campaignChoice", "campaign choice")
      .replaceAll("_", " ")
      .replace(/^./, (letter) => letter.toUpperCase());

  const renderSurvey = () => {
    const scenarioId = activeRun.scenario.id;
    elements.surveyTitle.textContent = `${activeRun.scenario.label}: compare Run 1 with Run 2`;
    elements.surveyQuestions.replaceChildren();
    for (const question of fixtures.survey) {
      const fieldset = document.createElement("fieldset");
      fieldset.className = "survey-question";
      const legend = document.createElement("legend");
      legend.textContent = question.prompt;
      const options = document.createElement("div");
      options.className = "radio-grid";
      for (const answer of question.answers) {
        const id = `survey-${scenarioId}-${question.id}-${answer}`;
        const label = document.createElement("label");
        const input = document.createElement("input");
        input.type = "radio";
        input.name = `survey-${question.id}`;
        input.id = id;
        input.value = answer;
        input.addEventListener("change", updateSurveyState);
        const span = document.createElement("span");
        span.textContent = responseLabel(answer);
        label.append(input, span);
        options.append(label);
      }
      fieldset.append(legend, options);
      elements.surveyQuestions.append(fieldset);
    }
    elements.submitSurvey.disabled = true;
    setVisibleView(elements.surveyView);
  };

  const updateSurveyState = () => {
    const answered = fixtures.survey.every((question) =>
      elements.surveyForm.querySelector(`input[name="survey-${question.id}"]:checked`)
    );
    elements.submitSurvey.disabled = !answered;
  };

  const submitSurvey = (event) => {
    event.preventDefault();
    const scenarioId = activeRun.scenario.id;
    const pairIndex = session.responses.filter((response) => response.scenarioId === scenarioId).length;
    if (pairIndex !== 0) throw new Error(`Survey already recorded for ${scenarioId}`);
    for (const question of fixtures.survey) {
      const selected = elements.surveyForm.querySelector(
        `input[name="survey-${question.id}"]:checked`
      );
      if (!selected) return;
      const response = deepFreeze({
        scenarioId,
        questionId: question.id,
        answer: selected.value
      });
      session.responses.push(response);
      appendEvent("survey_answer", {
        beatId: null,
        reason: clone(response)
      });
    }
    if (session.runIndex + 1 < session.runs.length) {
      session.runIndex += 1;
      beginRun();
    } else {
      completeSession();
    }
  };

  const continueSession = () => {
    if (activeRun.pairOrdinal === 2) {
      renderSurvey();
      return;
    }
    session.runIndex += 1;
    beginRun();
  };

  const completeSession = () => {
    appendEvent("session_complete", {
      runId: null,
      scenarioId: null,
      variantId: null,
      beatId: null,
      reason: { completedRuns: session.runs.length }
    });
    elements.mappingReveal.replaceChildren();
    for (const run of session.runs) {
      const card = document.createElement("article");
      card.className = "mapping-card";
      const title = document.createElement("h3");
      title.textContent = `${run.scenario.label} — ${run.neutralLabel}`;
      const label = document.createElement("p");
      label.textContent = run.variant.revealLabel;
      const sequence = document.createElement("p");
      sequence.textContent = run.selectedActionIds.map((id) => actionByIdForRun(run, id).label).join(" → ");
      card.append(title, label, sequence);
      elements.mappingReveal.append(card);
    }
    invalidatePreview();
    setVisibleView(elements.completeView);
  };

  const actionByIdForRun = (run, actionId) =>
    fixtures.shared.ordinaryActions.find((action) => action.id === actionId) ??
    run.variant.actions.find((action) => action.id === actionId);

  const helpEvent = (type) => {
    if (!session || !activeRun || elements.playView.hidden) return;
    const state = mechanicSnapshot();
    appendEvent(type, {
      stateBefore: state,
      stateAfter: state,
      reason: {
        viewport: narrowQuery.matches ? "narrow" : "desktop",
        stateSignature: JSON.stringify(state)
      }
    });
  };

  const setHelpDrawer = (open, recordEvent = true) => {
    if (!narrowQuery.matches) {
      helpDrawerOpen = false;
      document.documentElement.dataset.helpOpen = "false";
      elements.rulesPanel.setAttribute("aria-hidden", "false");
      elements.rulesPanel.removeAttribute("inert");
      elements.helpToggle.setAttribute("aria-expanded", "false");
      elements.drawerBackdrop.hidden = true;
      if (recordEvent && open) {
        helpEvent("help_open");
        $("rules-title").focus({ preventScroll: false });
      }
      return;
    }
    helpDrawerOpen = open;
    document.documentElement.dataset.helpOpen = String(open);
    elements.rulesPanel.setAttribute("aria-hidden", String(!open));
    elements.helpToggle.setAttribute("aria-expanded", String(open));
    elements.drawerBackdrop.hidden = !open;
    if (open) {
      elements.rulesPanel.removeAttribute("inert");
      if (recordEvent) helpEvent("help_open");
      elements.helpClose.focus();
    } else {
      elements.rulesPanel.setAttribute("inert", "");
      if (recordEvent) helpEvent("help_close");
      elements.helpToggle.focus();
    }
  };

  const trapDrawerFocus = (event) => {
    if (!helpDrawerOpen || event.key !== "Tab") return;
    const focusable = [...elements.rulesPanel.querySelectorAll("button, [href], [tabindex]")].filter(
      (element) => !element.hasAttribute("disabled") && element.tabIndex >= 0
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const deriveMetrics = (events) => {
    const byRun = {};
    for (const run of session.runs) {
      const runEvents = events.filter((event) => event.runId === run.id);
      const readyEvents = runEvents.filter((event) => event.type === "beat_ready");
      const submitEvents = runEvents.filter((event) => event.type === "intent_submit");
      const runStart = runEvents.find((event) => event.type === "run_start");
      const runComplete = runEvents.find((event) => event.type === "run_complete");
      const visibility = runEvents.filter(
        (event) =>
          event.type === "visibility_change" &&
          (!runStart || event.atMs >= runStart.atMs) &&
          (!runComplete || event.atMs <= runComplete.atMs)
      );
      const hiddenIntervals = [];
      let hiddenAt = null;
      for (const event of visibility) {
        if (event.reason.visibility === "hidden" && hiddenAt === null) hiddenAt = event.atMs;
        if (event.reason.visibility === "visible" && hiddenAt !== null) {
          hiddenIntervals.push([hiddenAt, event.atMs]);
          hiddenAt = null;
        }
      }
      if (hiddenAt !== null) hiddenIntervals.push([hiddenAt, runComplete?.atMs ?? hiddenAt]);
      const overlap = (start, end) =>
        hiddenIntervals.reduce(
          (total, [hiddenStart, hiddenEnd]) =>
            total + Math.max(0, Math.min(end, hiddenEnd) - Math.max(start, hiddenStart)),
          0
        );
      const decisionTimesMs = readyEvents.map((ready) => {
        const submit = submitEvents.find((event) => event.beatId === ready.beatId);
        if (!submit) return null;
        const elapsed = submit.atMs - ready.atMs;
        return {
          beatId: ready.beatId,
          elapsed,
          background: overlap(ready.atMs, submit.atMs),
          foreground: elapsed - overlap(ready.atMs, submit.atMs)
        };
      });
      const helpEvents = runEvents.filter((event) => event.type === "help_open");
      const stateSignatures = new Set();
      let repeatedHelpOpenings = 0;
      for (const event of helpEvents) {
        if (stateSignatures.has(event.reason.stateSignature)) repeatedHelpOpenings += 1;
        stateSignatures.add(event.reason.stateSignature);
      }
      const automationEvents = runEvents.filter((event) => event.type === "automation");
      const classSelections = submitEvents.filter((event) => {
        const action = actionByIdForRun(run, event.actionId);
        return CLASS_KINDS.has(action.kind);
      }).length;
      const authoredOpportunities = readyEvents.filter(
        (event) => event.reason.legalClassActionIds.length > 0
      ).length;
      byRun[run.id] = {
        ordinal: run.ordinal,
        scenarioId: run.scenario.id,
        variantId: run.variant.id,
        decisionTimesMs,
        totalRunTimeMs:
          runStart && runComplete ? Math.max(0, runComplete.atMs - runStart.atMs) : null,
        backgroundIntervalsMs: hiddenIntervals.map(([start, end]) => ({ start, end })),
        requiredPrompts: runEvents.filter((event) => event.type === "required_prompt").length,
        midResolutionPrompts: runEvents.filter(
          (event) => event.type === "required_prompt" && event.reason?.phase === "mid_resolution"
        ).length,
        helpOpenings: helpEvents.length,
        repeatedHelpOpenings,
        lockedActionAttempts: runEvents.filter((event) => event.type === "locked_action_attempt").length,
        operatorReminders: runEvents.filter((event) => event.type === "operator_reminder").length,
        voluntaryMechanicUse: { selected: classSelections, opportunities: authoredOpportunities },
        automation: {
          bookkeeping: automationEvents
            .filter((event) => event.reason.category === "bookkeeping")
            .map((event) => event.reason.id),
          tacticalChoice: automationEvents
            .filter((event) => event.reason.category === "tactical_choice")
            .map((event) => event.reason.id)
        },
        legalChoiceSurface: readyEvents.map((event) => ({
          beatId: event.beatId,
          classActionIds: [...event.reason.legalClassActionIds]
        })),
        actionSequence: submitEvents.map((event) => event.actionId)
      };
    }
    return byRun;
  };

  const selectedConfounds = () =>
    [...elements.confoundOptions.querySelectorAll("input[type='checkbox']:checked")].map(
      (input) => input.value
    );

  const viewportClass = () => (narrowQuery.matches ? "narrow" : "desktop");

  const buildPacket = () => {
    const events = session.events.map((event) => clone(event));
    return {
      schemaVersion: 1,
      harnessVersion: fixtures.harnessVersion,
      fixtureVersion: fixtures.fixtureVersion,
      sources: clone(fixtures.sources),
      session: {
        id: session.id,
        scheduleId: session.schedule.id,
        variantSlots: {
          A: session.variantSlots.A.id,
          B: session.variantSlots.B.id
        },
        runs: session.runs.map((run) => ({
          id: run.id,
          ordinal: run.ordinal,
          scenarioId: run.scenario.id,
          variantSlot: run.variantSlot,
          variantId: run.variant.id,
          neutralLabel: run.neutralLabel
        })),
        input: {
          mode: session.inputMode,
          viewport: viewportClass()
        }
      },
      events,
      metrics: deriveMetrics(events),
      pairedResponses: session.responses.map((response) => clone(response)),
      optionalNote: elements.includeNote.checked ? elements.optionalNote.value.trim() : null,
      confounds: selectedConfounds(),
      validation: null
    };
  };

  const validateExport = (packet) => {
    const errors = [];
    const check = (condition, message) => {
      if (!condition) errors.push(message);
    };
    try {
      assertKeys(
        packet,
        [
          "schemaVersion",
          "harnessVersion",
          "fixtureVersion",
          "sources",
          "session",
          "events",
          "metrics",
          "pairedResponses",
          "optionalNote",
          "confounds",
          "validation"
        ],
        "export"
      );
      assertKeys(
        packet.session,
        ["id", "scheduleId", "variantSlots", "runs", "input"],
        "export session"
      );
      assertKeys(packet.session.variantSlots, ["A", "B"], "variant slots");
      assertKeys(packet.session.input, ["mode", "viewport"], "input metadata");
      for (const run of packet.session.runs) {
        assertKeys(
          run,
          ["id", "ordinal", "scenarioId", "variantSlot", "variantId", "neutralLabel"],
          `export run ${run.ordinal}`
        );
      }
      for (const event of packet.events) validateInternalEvent(event);
      for (const response of packet.pairedResponses) {
        assertKeys(response, ["scenarioId", "questionId", "answer"], "paired response");
      }
    } catch (error) {
      errors.push(error.message);
    }

    check(packet.schemaVersion === 1, "Wrong export schema version");
    check(packet.harnessVersion === fixtures.harnessVersion, "Wrong harness version");
    check(packet.fixtureVersion === fixtures.fixtureVersion, "Wrong fixture version");
    check(packet.session.id === session.id, "Wrong anonymous session ID");
    check(packet.session.scheduleId === session.schedule.id, "Wrong schedule ID");
    check(packet.session.runs.length === 4, "Expected four runs");
    const expectedRunRows = session.runs.map((run) => ({
      id: run.id,
      ordinal: run.ordinal,
      scenarioId: run.scenario.id,
      variantSlot: run.variantSlot,
      variantId: run.variant.id,
      neutralLabel: run.neutralLabel
    }));
    check(
      JSON.stringify(packet.session.runs) === JSON.stringify(expectedRunRows),
      "Run schedule or hidden mapping changed"
    );
    check(
      packet.session.variantSlots.A === session.variantSlots.A.id &&
        packet.session.variantSlots.B === session.variantSlots.B.id,
      "Variant-slot assignment changed"
    );
    check(packet.pairedResponses.length === 10, "Expected ten paired responses");
    check(
      packet.events.every((event, index) => event.seq === index + 1),
      "Event sequence is not append-only"
    );
    check(
      packet.events.every((event) => fixtures.enums.eventTypes.includes(event.type)),
      "Unknown event type"
    );
    check(
      packet.events.every(
        (event) => event.actionId === null || KNOWN_ACTION_IDS.has(event.actionId)
      ),
      "Unknown action ID"
    );
    check(
      packet.events.every(
        (event) => event.targetId === null || KNOWN_TARGET_IDS.has(event.targetId)
      ),
      "Unknown target ID"
    );
    check(
      packet.events.filter((event) => event.type === "run_start").length === 4,
      "Expected four run starts"
    );
    check(
      packet.events.filter((event) => event.type === "run_complete").length === 4,
      "Expected four run completions"
    );
    check(
      packet.events.filter((event) => event.type === "session_complete").length === 1,
      "Expected one session completion"
    );
    check(
      packet.events.filter((event) => event.type === "required_prompt").length === 0,
      "Pilot emitted a required prompt"
    );
    check(
      packet.events
        .filter((event) => event.type === "automation")
        .every((event) => event.reason.category === "bookkeeping"),
      "Pilot emitted a tactical-choice automation event"
    );
    check(
      packet.events
        .filter((event) => event.type === "intent_submit")
        .every(
          (event) =>
            event.reason &&
            Object.keys(event.reason).length === 1 &&
            Number.isInteger(event.reason.intentLength)
        ),
      "Intent events must contain length only"
    );
    const resultEvents = packet.events.filter((event) => event.type === "result_commit");
    const resultKeys = resultEvents.map((event) => `${event.runId}:${event.beatId}`);
    check(resultEvents.length === 16, "Expected sixteen committed results");
    check(new Set(resultKeys).size === resultKeys.length, "A beat consumed more than one result");
    for (const run of session.runs) {
      const runEvents = packet.events.filter((event) => event.runId === run.id);
      const readyEvents = runEvents.filter((event) => event.type === "beat_ready");
      const submitEvents = runEvents.filter((event) => event.type === "intent_submit");
      const committed = runEvents.filter((event) => event.type === "result_commit");
      check(readyEvents.length === 4, `Run ${run.ordinal} lacks four ready beats`);
      check(submitEvents.length === 4, `Run ${run.ordinal} lacks four explicit submissions`);
      check(committed.length === 4, `Run ${run.ordinal} lacks four committed results`);
      for (const beat of run.scenario.beats) {
        const ready = readyEvents.find((event) => event.beatId === beat.id);
        const submit = submitEvents.find((event) => event.beatId === beat.id);
        const result = committed.find((event) => event.beatId === beat.id);
        const expectedResult = resultForBeat(beat.resultId);
        check(Boolean(ready && submit && result), `${run.id}:${beat.id} is incomplete`);
        if (!ready || !submit || !result) continue;
        const action = actionByIdForRun(run, submit.actionId);
        check(Boolean(action), `${run.id}:${beat.id} uses another variant's action`);
        if (!action) continue;
        const actionWasLegal = CLASS_KINDS.has(action.kind)
          ? ready.reason.legalClassActionIds.includes(action.id)
          : ready.reason.legalOrdinaryActionIds.includes(action.id);
        check(actionWasLegal, `${run.id}:${beat.id} submitted a locked action`);
        check(
          runEvents.some(
            (event) =>
              event.type === "action_select" &&
              event.beatId === beat.id &&
              event.actionId === submit.actionId &&
              event.seq < submit.seq
          ),
          `${run.id}:${beat.id} lacks explicit action selection`
        );
        check(
          runEvents.some(
            (event) =>
              event.type === "target_select" &&
              event.beatId === beat.id &&
              event.targetId === submit.targetId &&
              event.seq < submit.seq
          ),
          `${run.id}:${beat.id} lacks explicit or single-target binding`
        );
        check(
          result.reason.resultId === expectedResult.id &&
            result.reason.raw === expectedResult.raw &&
            result.reason.target === expectedResult.target &&
            result.reason.band === expectedResult.expectedBand,
          `${run.id}:${beat.id} changed the authored result tape`
        );
      }
    }
    for (const scenario of fixtures.shared.scenarios) {
      const responses = packet.pairedResponses.filter(
        (response) => response.scenarioId === scenario.id
      );
      check(responses.length === fixtures.survey.length, `${scenario.id} lacks five responses`);
      check(
        new Set(responses.map((response) => response.questionId)).size === fixtures.survey.length,
        `${scenario.id} repeats a response question`
      );
      for (const response of responses) {
        check(
          fixtures.enums.surveyAnswers[response.questionId]?.includes(response.answer) === true,
          `${scenario.id} has an unknown survey answer`
        );
      }
    }
    check(
      packet.events.filter((event) => event.type === "export").length <= 1,
      "Expected no more than one explicit export"
    );
    check(
      packet.confounds.every((reason) => CONFOUND_REASONS.has(reason)),
      "Unknown confound reason"
    );
    check(new Set(packet.confounds).size === packet.confounds.length, "Duplicate confound reason");
    check(
      packet.optionalNote === null ||
        (elements.includeNote.checked && packet.optionalNote.length <= 600),
      "Optional note lacks confirmation or exceeds its bound"
    );
    check(
      JSON.stringify(packet.metrics) === JSON.stringify(deriveMetrics(packet.events)),
      "Metrics were not derived from events"
    );
    const withoutConfirmedNote = clone(packet);
    withoutConfirmedNote.optionalNote = null;
    withoutConfirmedNote.validation = null;
    const exportedText = JSON.stringify(withoutConfirmedNote);
    const displayedIntents = [...document.querySelectorAll(".intent-copy")].map((node) =>
      node.textContent.replace(/^Intent: “|”$/g, "")
    );
    check(
      displayedIntents.every((intent) => intent.length === 0 || !exportedText.includes(intent)),
      "Typed intent leaked into export"
    );
    check(
      !/(playerName|campaignId|accountId|emailAddress|ipAddress|intentText)/i.test(exportedText),
      "Identity, campaign, or prose field leaked into export"
    );
    check(session.events.every(Object.isFrozen), "Internal event record was mutable");
    return { valid: errors.length === 0, errors };
  };

  const invalidatePreview = () => {
    lastPreviewPacket = null;
    elements.downloadExport.disabled = true;
    elements.validationStatus.dataset.valid = "";
    elements.validationStatus.textContent = "Preview has not been generated.";
  };

  const previewExport = () => {
    const packet = buildPacket();
    packet.validation = validateExport(packet);
    lastPreviewPacket = deepFreeze(clone(packet));
    elements.exportPreview.textContent = JSON.stringify(packet, null, 2);
    elements.exportPreviewWrap.open = true;
    elements.validationStatus.dataset.valid = String(packet.validation.valid);
    elements.validationStatus.textContent = packet.validation.valid
      ? "Validation passed. The record is ready for explicit download."
      : `Validation failed: ${packet.validation.errors.join("; ")}`;
    elements.downloadExport.disabled = !packet.validation.valid || session.exported;
  };

  const downloadExport = () => {
    if (!lastPreviewPacket?.validation.valid || session.exported) return;
    appendEvent("export", {
      runId: null,
      scenarioId: null,
      variantId: null,
      beatId: null,
      reason: { format: "json", explicit: true }
    });
    const packet = buildPacket();
    packet.validation = validateExport(packet);
    if (!packet.validation.valid) {
      elements.validationStatus.dataset.valid = "false";
      elements.validationStatus.textContent = `Validation failed: ${packet.validation.errors.join("; ")}`;
      return;
    }
    const blob = new Blob([`${JSON.stringify(packet, null, 2)}\n`], {
      type: "application/json"
    });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `interaction-burden-${session.id}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
    session.exported = true;
    lastPreviewPacket = deepFreeze(clone(packet));
    elements.exportPreview.textContent = JSON.stringify(packet, null, 2);
    elements.downloadExport.disabled = true;
    elements.downloadExport.textContent = "JSON downloaded";
    elements.validationStatus.dataset.valid = "true";
    elements.validationStatus.textContent = "Validated JSON downloaded by explicit request.";
  };

  const recordReminder = () => {
    const reason = elements.reminderReason.value;
    if (!REMINDER_REASONS.has(reason)) return;
    appendEvent("operator_reminder", { reason });
    elements.reminderReason.value = "";
    elements.recordReminder.disabled = true;
    announce("Operator reminder recorded without free text.");
  };

  const onVisibilityChange = () => {
    if (!session) return;
    appendEvent("visibility_change", {
      reason: { visibility: document.visibilityState }
    });
  };

  elements.agreement.addEventListener("change", () => {
    elements.startSession.disabled = !elements.agreement.checked;
  });
  elements.startSession.addEventListener("click", startSession);
  elements.actionForm.addEventListener("submit", resolveSubmission);
  elements.intent.addEventListener("input", updateSubmissionState);
  elements.continueSession.addEventListener("click", continueSession);
  elements.surveyForm.addEventListener("submit", submitSurvey);
  elements.reminderReason.addEventListener("change", () => {
    elements.recordReminder.disabled = !REMINDER_REASONS.has(elements.reminderReason.value);
  });
  elements.recordReminder.addEventListener("click", recordReminder);
  elements.helpToggle.addEventListener("click", () => setHelpDrawer(true));
  elements.helpClose.addEventListener("click", () => setHelpDrawer(false));
  elements.drawerBackdrop.addEventListener("click", () => setHelpDrawer(false));
  elements.rulesPanel.addEventListener("keydown", trapDrawerFocus);
  document.addEventListener("keydown", (event) => {
    detectInputMode("keyboard");
    if (event.key === "Escape" && helpDrawerOpen) setHelpDrawer(false);
  });
  document.addEventListener("pointerdown", () => detectInputMode("pointer"), { passive: true });
  document.addEventListener("touchstart", () => detectInputMode("touch"), { passive: true });
  document.addEventListener("visibilitychange", onVisibilityChange);
  narrowQuery.addEventListener("change", () => setHelpDrawer(false, false));
  elements.confoundOptions.addEventListener("change", invalidatePreview);
  elements.optionalNote.addEventListener("input", invalidatePreview);
  elements.includeNote.addEventListener("change", invalidatePreview);
  elements.previewExport.addEventListener("click", previewExport);
  elements.downloadExport.addEventListener("click", downloadExport);

  const navigation = performance.getEntriesByType("navigation")[0];
  if (navigation?.type === "reload") elements.reloadNotice.hidden = false;
  if (debugMode) {
    elements.debugStart.hidden = false;
    elements.debugStart.textContent =
      "Debug view shows generated fixture IDs after Start. It cannot choose a schedule, result, action, or target.";
  }
  setHelpDrawer(false, false);
})();
