(() => {
  "use strict";

  const WORD_CHARACTER = /[\p{L}\p{N}_]/u;

  const finalCodePoint = (value) => {
    const points = Array.from(value);
    return points.length === 0 ? "" : points[points.length - 1];
  };

  const firstCodePoint = (value) => Array.from(value)[0] ?? "";

  const computeAbilityInsertion = (text, start, end, trigger) => {
    if (typeof text !== "string" || typeof trigger !== "string" || trigger.length === 0) {
      throw new TypeError("text and trigger must be strings, and trigger must not be empty");
    }
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end > text.length) {
      throw new RangeError("selection must be a valid UTF-16 range");
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
    const insertedText = `${needsLeadingSpace ? " " : ""}${trigger}${
      needsJoinedWordSpace || needsContinuationSpace ? " " : ""
    }`;
    const nextText = `${before}${insertedText}${after}`;
    const caret = start + insertedText.length;

    return { text: nextText, insertedText, selectionStart: caret, selectionEnd: caret };
  };

  const applySuggestionToText = (text, suggestion) => {
    if (
      typeof text !== "string"
      || !suggestion
      || !Number.isInteger(suggestion.start)
      || !Number.isInteger(suggestion.end)
      || typeof suggestion.replacement !== "string"
      || suggestion.start < 0
      || suggestion.end < suggestion.start
      || suggestion.end > text.length
    ) {
      throw new TypeError("suggestion must describe a valid replacement range");
    }
    const nextText = `${text.slice(0, suggestion.start)}${suggestion.replacement}${text.slice(
      suggestion.end
    )}`;
    const caret = suggestion.start + suggestion.replacement.length;
    return { text: nextText, selectionStart: caret, selectionEnd: caret };
  };

  const createSubmission = (text, scanResult) => {
    if (typeof text !== "string") throw new TypeError("submission text must be a string");
    if (!scanResult || !Array.isArray(scanResult.matches) || !Array.isArray(scanResult.abilityIds)) {
      throw new TypeError("scanResult must contain matches and abilityIds");
    }
    return {
      prose: text,
      abilityIds: [...scanResult.abilityIds],
      matches: scanResult.matches.map((match) => ({
        abilityId: match.abilityId,
        start: match.start,
        end: match.end,
        spelling: match.spelling
      }))
    };
  };

  const api = Object.freeze({ computeAbilityInsertion, applySuggestionToText, createSubmission });
  globalThis.AbilityKeywordComposerApp = api;

  if (typeof document === "undefined") return;

  const fixture = globalThis.ABILITY_KEYWORD_COMPOSER_FIXTURE;
  const matcher = globalThis.AbilityKeywordMatcher;
  if (!fixture || !matcher) {
    document.body.textContent = "The local composer fixture could not be loaded.";
    return;
  }

  const familyKeys = fixture.families.map((family) => family.key);
  matcher.validateAbilityCatalog(fixture.abilities, familyKeys);
  const familyKeySet = new Set(familyKeys);
  const abilityById = new Map(fixture.abilities.map((ability) => [ability.id, ability]));

  const elements = {
    transcript: document.getElementById("transcript"),
    openingNarration: document.getElementById("opening-narration"),
    actionForm: document.getElementById("action-form"),
    composerShell: document.getElementById("composer-shell"),
    actionInput: document.getElementById("action-input"),
    highlightContent: document.getElementById("highlight-content"),
    correctionButton: document.getElementById("correction-button"),
    recognitionStatus: document.getElementById("recognition-status"),
    characterName: document.getElementById("character-name"),
    abilityList: document.getElementById("ability-list"),
    debugPanel: document.getElementById("debug-panel"),
    debugOutput: document.getElementById("debug-output")
  };

  const debugMode = new URLSearchParams(globalThis.location.search).get("debug") === "1";
  let currentScan = { matches: [], abilityIds: [], suggestions: [] };
  let composing = false;
  let lastSelection = { start: 0, end: 0 };
  let recognitionSignature = "";

  const rememberSelection = () => {
    lastSelection = {
      start: elements.actionInput.selectionStart ?? 0,
      end: elements.actionInput.selectionEnd ?? 0
    };
  };

  const syncMirrorScroll = () => {
    elements.highlightContent.style.transform = `translate(${-elements.actionInput.scrollLeft}px, ${
      -elements.actionInput.scrollTop
    }px)`;
  };

  const sizeComposer = () => {
    elements.actionInput.style.height = "auto";
    const height = Math.min(Math.max(elements.actionInput.scrollHeight, 52), 144);
    elements.composerShell.style.height = `${height}px`;
    elements.actionInput.style.height = "100%";
    syncMirrorScroll();
  };

  const renderMirror = (text, matches) => {
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    for (const match of matches) {
      fragment.append(document.createTextNode(text.slice(cursor, match.start)));
      const highlight = document.createElement("mark");
      highlight.className = "ability-highlight";
      if (!familyKeySet.has(match.familyKey)) throw new Error("Unknown ability family");
      highlight.dataset.family = match.familyKey;
      highlight.append(document.createTextNode(text.slice(match.start, match.end)));
      fragment.append(highlight);
      cursor = match.end;
    }
    fragment.append(document.createTextNode(text.slice(cursor)));
    if (text.endsWith("\n")) fragment.append(document.createTextNode("\u200b"));
    elements.highlightContent.replaceChildren(fragment);
    syncMirrorScroll();
  };

  const renderCorrection = () => {
    const suggestion = currentScan.suggestions[0] ?? null;
    if (!suggestion) {
      elements.correctionButton.hidden = true;
      elements.correctionButton.textContent = "";
      elements.correctionButton.removeAttribute("data-family");
      return;
    }
    const ability = abilityById.get(suggestion.abilityId);
    if (!ability) throw new Error("Suggestion referenced an unowned ability");
    elements.correctionButton.textContent = `Did you mean ${ability.name}?`;
    elements.correctionButton.dataset.family = ability.familyKey;
    elements.correctionButton.hidden = false;
  };

  const announceRecognition = () => {
    const signature = currentScan.abilityIds.join("|");
    if (signature === recognitionSignature) return;
    recognitionSignature = signature;
    const names = currentScan.abilityIds.map((id) => abilityById.get(id)?.name).filter(Boolean);
    elements.recognitionStatus.textContent = names.length === 0
      ? "No ability name recognized."
      : `${names.join(", ")} recognized.`;
  };

  const scanAndRender = () => {
    currentScan = matcher.scanAbilityTriggers(elements.actionInput.value, fixture.abilities, {
      familyKeys
    });
    renderMirror(elements.actionInput.value, currentScan.matches);
    renderCorrection();
    announceRecognition();
    sizeComposer();
  };

  const replaceTextareaValue = (nextValue, selectionStart, selectionEnd) => {
    elements.actionInput.value = nextValue;
    elements.actionInput.focus();
    elements.actionInput.setSelectionRange(selectionStart, selectionEnd);
    rememberSelection();
    scanAndRender();
  };

  const insertAbility = (ability) => {
    const length = elements.actionInput.value.length;
    const start = Math.min(lastSelection.start, length);
    const end = Math.min(Math.max(lastSelection.end, start), length);
    const insertion = computeAbilityInsertion(elements.actionInput.value, start, end, ability.trigger);
    elements.actionInput.setRangeText(insertion.insertedText, start, end, "end");
    elements.actionInput.focus();
    elements.actionInput.setSelectionRange(insertion.selectionStart, insertion.selectionEnd);
    rememberSelection();
    scanAndRender();
  };

  const appendPlayerMessage = (prose) => {
    const message = document.createElement("article");
    message.className = "message message-player";
    const speaker = document.createElement("div");
    speaker.className = "speaker";
    speaker.textContent = "You";
    const playerText = document.createElement("p");
    playerText.textContent = prose;
    message.append(speaker, playerText);
    elements.transcript.append(message);
    message.scrollIntoView({ block: "nearest" });
  };

  const renderAbilities = () => {
    const fragment = document.createDocumentFragment();
    fixture.abilities.forEach((ability) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ability-button";
      button.dataset.family = ability.familyKey;
      button.setAttribute("aria-label", `Insert ${ability.name}`);

      const name = document.createElement("span");
      name.className = "ability-name";
      name.textContent = ability.name;
      const family = document.createElement("span");
      family.className = "family-label";
      family.textContent = ability.familyLabel;
      const help = document.createElement("span");
      help.className = "ability-help";
      help.textContent = fixture.abilityHelp[ability.id];
      button.append(name, family, help);
      button.addEventListener("click", () => insertAbility(ability));
      fragment.append(button);
    });
    elements.abilityList.replaceChildren(fragment);
  };

  elements.openingNarration.textContent = fixture.scene.gm;
  elements.actionInput.placeholder = fixture.scene.placeholder;
  elements.characterName.textContent = fixture.character.name;
  elements.debugPanel.hidden = !debugMode;
  renderAbilities();
  scanAndRender();

  for (const eventName of ["select", "click", "keyup", "blur"]) {
    elements.actionInput.addEventListener(eventName, rememberSelection);
  }
  elements.actionInput.addEventListener("compositionstart", () => {
    composing = true;
  });
  elements.actionInput.addEventListener("compositionend", () => {
    composing = false;
    rememberSelection();
    scanAndRender();
  });
  elements.actionInput.addEventListener("input", () => {
    rememberSelection();
    if (!composing) scanAndRender();
  });
  elements.actionInput.addEventListener("scroll", syncMirrorScroll);
  elements.actionInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      elements.actionForm.requestSubmit();
    }
  });

  elements.correctionButton.addEventListener("click", () => {
    const suggestion = currentScan.suggestions[0];
    if (!suggestion) return;
    const replacement = applySuggestionToText(elements.actionInput.value, suggestion);
    replaceTextareaValue(replacement.text, replacement.selectionStart, replacement.selectionEnd);
  });

  elements.actionForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const prose = elements.actionInput.value;
    if (prose.trim() === "") return;
    currentScan = matcher.scanAbilityTriggers(prose, fixture.abilities, { familyKeys });
    const submission = createSubmission(prose, currentScan);
    appendPlayerMessage(submission.prose);
    if (debugMode) elements.debugOutput.textContent = JSON.stringify(submission, null, 2);
    replaceTextareaValue("", 0, 0);
  });

  globalThis.addEventListener("resize", sizeComposer);
})();
