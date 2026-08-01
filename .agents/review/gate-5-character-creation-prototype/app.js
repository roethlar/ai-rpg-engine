"use strict";

const CLASSES = {
  paladin: {
    id: "class.paladin",
    name: "Paladin",
    sigil: "PA",
    family: "Oathbound martial",
    filters: ["magic", "weapons"],
    description: "Bind yourself to a declared oath, build Conviction by upholding it, and spend that resource to protect or judge.",
    loopName: "Oath + Conviction",
    loop: "Declare an oath → earn Conviction → spend it on Aegis reactions and verdicts.",
    tags: ["Heavy armor", "Martial weapons", "Conviction pool"],
    roles: ["Defender", "Support"],
    grants: [
      { name: "Aegis reaction", detail: "Spend Conviction to intercept harm aimed at a nearby ally." },
      { name: "Oath verdict", detail: "Class-exclusive actions improve as the oath track advances." },
      { name: "Armor and martial proficiency", detail: "Granted by Paladin level 1, not by the character’s title." }
    ],
    restrictions: [
      "No spellbook preparation or Netrunner Breach actions without another paid source.",
      "Breaking the declared oath suspends Conviction recovery until it is answered in play.",
      "A title such as Commander grants no extra orders, followers, or class levels."
    ],
    levelUp: {
      automatic: [
        { name: "Aegis die improves", detail: "The class reaction improves from d6 to d8." },
        { name: "Conviction capacity +1", detail: "Maximum Conviction rises from 2 to 3." }
      ],
      choices: [
        { id: "paladin-intercession", name: "Intercession", detail: "After Aegis reduces harm, the protected ally may shift one position.", kind: "Class feature" },
        { id: "paladin-verdict", name: "Binding Verdict", detail: "Spend 1 Conviction to prevent an oath-marked foe from disengaging freely.", kind: "Class feature" }
      ]
    },
    multiclass: {
      target: "fighter",
      gains: ["Fighter 1 entry stance", "One basic Combat Form"],
      costs: [
        "Paladin 4’s Aegis die and Conviction increase are delayed until the next Paladin level.",
        "Fighter weapon mastery and extra Form slot remain locked until Fighter 2."
      ]
    }
  },
  wizard: {
    id: "class.wizard",
    name: "Wizard",
    sigil: "WZ",
    family: "Prepared spellcaster",
    filters: ["magic"],
    description: "Prepare a limited spellbook loadout, manage Focus, and reshape a scene through deliberately chosen formulae.",
    loopName: "Spellbook + Focus",
    loop: "Prepare formulae → establish conditions → spend Focus for stronger or wider effects.",
    tags: ["Spellbook", "Focus pool", "Simple weapons"],
    roles: ["Controller", "Artillery"],
    grants: [
      { name: "Spellbook preparation", detail: "Prepare known formulae into a limited set of active spell slots." },
      { name: "Focus pool", detail: "Class-exclusive resource used to amplify prepared formulae." },
      { name: "Arcane revision", detail: "Replace one prepared formula during a safe rest." }
    ],
    restrictions: [
      "Only simple weapons are proficient unless a feat, package, subclass, or Fighter level says otherwise.",
      "A weapon proficiency never grants Combat Forms or Fighter progression.",
      "Unprepared formulae cannot be cast merely because the character description mentions them."
    ],
    levelUp: {
      automatic: [
        { name: "Prepared formula slot +1", detail: "The active spellbook loadout grows from 4 to 5." },
        { name: "Focus capacity +1", detail: "Maximum Focus rises from 3 to 4." }
      ],
      choices: [
        { id: "wizard-counterweave", name: "Counterweave", detail: "Spend 1 Focus as a reaction to weaken an observed magical effect.", kind: "Class feature" },
        { id: "wizard-echo", name: "Formula Echo", detail: "Once per rest, repeat an unamplified utility formula without a slot.", kind: "Class feature" }
      ]
    },
    multiclass: {
      target: "fighter",
      gains: ["Fighter 1 entry stance", "Martial weapon group proficiency"],
      costs: [
        "Wizard 4’s formula slot and Focus increase are delayed until the next Wizard level.",
        "The entry level grants no Fighter weapon mastery or extra attack sequence."
      ]
    }
  },
  fighter: {
    id: "class.fighter",
    name: "Fighter",
    sigil: "FI",
    family: "Combat discipline",
    filters: ["weapons"],
    description: "Build Tempo through committed weapon exchanges, then convert it into class-exclusive Combat Forms.",
    loopName: "Tempo + Combat Forms",
    loop: "Commit to an exchange → build Tempo → spend it on Forms, counters, and weapon mastery.",
    tags: ["All armor", "Martial weapons", "Tempo track"],
    roles: ["Defender", "Bruiser"],
    grants: [
      { name: "Combat Forms", detail: "Class-exclusive maneuvers fueled by Tempo." },
      { name: "Tempo track", detail: "Build and spend Tempo during sustained weapon exchanges." },
      { name: "Full martial proficiency", detail: "All standard armor and martial weapon groups." }
    ],
    restrictions: [
      "No spellbook, Conviction, or Breach actions without another paid source.",
      "Changing weapons may end the current Form chain.",
      "Leadership training can add Commander contribution but never another class budget."
    ],
    levelUp: {
      automatic: [
        { name: "Tempo ceiling +1", detail: "Maximum Tempo rises from 3 to 4." },
        { name: "Weapon mastery tier", detail: "One proficient weapon group advances to mastery I." }
      ],
      choices: [
        { id: "fighter-riposte", name: "Measured Riposte", detail: "Spend 1 Tempo after a successful guard to make a controlled counter.", kind: "Combat Form" },
        { id: "fighter-pressure", name: "Relentless Pressure", detail: "Keep 1 Tempo when a marked opponent retreats from the exchange.", kind: "Class feature" }
      ]
    },
    multiclass: {
      target: "wizard",
      gains: ["Wizard 1 novice spellbook", "Two novice formulae and 1 Focus"],
      costs: [
        "Fighter 4’s Tempo ceiling and weapon mastery are delayed until the next Fighter level.",
        "Amplification, formula revision, and advanced spell tiers remain locked behind Wizard progression."
      ]
    }
  },
  netrunner: {
    id: "class.netrunner",
    name: "Netrunner",
    sigil: "NR",
    family: "Access specialist",
    filters: ["systems"],
    description: "Establish Access, accept Trace, and spend that opening on exploits, countermeasures, and information control.",
    loopName: "Access + Trace",
    loop: "Probe a system → establish Access → spend Access while managing accumulating Trace.",
    tags: ["Deck implement", "Access pool", "Trace pressure"],
    roles: ["Infiltrator", "Controller"],
    grants: [
      { name: "Breach sequence", detail: "Class-exclusive actions establish and spend Access against connected systems." },
      { name: "Trace pressure", detail: "Strong exploits increase Trace and create escalating consequences." },
      { name: "Offline analysis", detail: "The deck can analyze local evidence when no network exists; it cannot invent remote access." }
    ],
    restrictions: [
      "No network means no remote Breach target; offline analysis remains available.",
      "Wealth cannot erase Trace, create connectivity, or grant a second action economy.",
      "A corporation is a separate world asset and may be unavailable in a sealed dungeon."
    ],
    levelUp: {
      automatic: [
        { name: "Access ceiling +1", detail: "Maximum stored Access rises from 3 to 4." },
        { name: "Trace buffer +1", detail: "The first Trace consequence begins one step later." }
      ],
      choices: [
        { id: "netrunner-ghost", name: "Ghost Route", detail: "Spend 1 Access to conceal one ally’s signature during an exploit.", kind: "Exploit" },
        { id: "netrunner-cold-read", name: "Cold Read", detail: "Convert unused Access into one bounded local evidence query offline.", kind: "Class feature" }
      ]
    },
    multiclass: {
      target: "fighter",
      gains: ["Fighter 1 entry stance", "One martial weapon group"],
      costs: [
        "Netrunner 4’s Access and Trace improvements are delayed until the next Netrunner level.",
        "Fighter weapon mastery remains locked until Fighter 2; wealth cannot waive that requirement."
      ]
    }
  }
};

const TRAINING = {
  command: {
    id: "package.command",
    name: "Command Training",
    sigil: "CO",
    family: "Shared capability package",
    description: "Read a group’s readiness, issue bounded orders, and coordinate allies who can hear and choose to follow.",
    loopName: "Leadership II + Coordinated Order",
    loop: "Once per scene after your successful check, an ally may reposition using their reaction.",
    tags: ["Starting package", "Uses ally reaction", "No followers granted"],
    roles: ["Commander"],
    skills: [{ skillId: "skill.leadership", rank: 2 }],
    feats: ["feat.coordinated-order"],
    grants: [
      { name: "Leadership rank 2", detail: "Covers morale, coordination, and institutional command checks." },
      { name: "Coordinated Order", detail: "A bounded reaction-based reposition; never a second class action budget." }
    ],
    restrictions: ["Does not grant troops, rank, wealth, or obedience; those require relationships, standing, and assets."],
    ineligible: []
  },
  investigation: {
    id: "package.investigation",
    name: "Investigation Training",
    sigil: "IN",
    family: "Shared capability package",
    description: "Gather traces, preserve evidence, and ask structured questions without turning an occupation into a class.",
    loopName: "Investigation II + Evidence Chain",
    loop: "Preserve one discovered clue so later checks can distinguish fact, inference, and tampering.",
    tags: ["Starting package", "Exploration", "Social inquiry"],
    roles: ["Investigator"],
    skills: [{ skillId: "skill.investigation", rank: 2 }],
    feats: ["feat.evidence-chain"],
    grants: [
      { name: "Investigation rank 2", detail: "Covers searches, interviews, inference, and evidence handling." },
      { name: "Evidence Chain", detail: "Preserve a clue’s provenance; it does not create clues that are absent." }
    ],
    restrictions: ["Royal rank, a detective title, or Wizard lore does not substitute for this package."],
    ineligible: []
  },
  martial: {
    id: "package.martial",
    name: "Martial Training",
    sigil: "MA",
    family: "Shared capability package",
    description: "Pay for one martial weapon group and a basic guard discipline without buying the Fighter chassis.",
    loopName: "Weapon group + Guard Drills",
    loop: "Choose one group such as axes; become proficient and gain a basic defensive drill.",
    tags: ["Starting package", "One weapon group", "No Combat Forms"],
    roles: ["Bruiser"],
    skills: [{ skillId: "skill.weapon.axes", rank: 1 }],
    feats: ["feat.weapon-group.axes", "feat.guard-drills"],
    grants: [
      { name: "Axe proficiency", detail: "Use battle axes without the non-proficiency penalty." },
      { name: "Guard Drills", detail: "A basic defensive option; grants no Tempo or Fighter Combat Forms." }
    ],
    restrictions: ["Consumes the entire starting package and never grants Fighter Tempo, mastery, or class advancement."],
    ineligible: ["fighter"]
  },
  fieldcraft: {
    id: "package.fieldcraft",
    name: "Fieldcraft Training",
    sigil: "FC",
    family: "Shared capability package",
    description: "Navigate hostile terrain, establish safe camps, and manage practical scarcity in unfamiliar environments.",
    loopName: "Survival II + Safe Camp",
    loop: "Convert a successful route or forage check into a bounded rest advantage for the group.",
    tags: ["Starting package", "Exploration", "Always local"],
    roles: ["Scout", "Survivor"],
    skills: [{ skillId: "skill.survival", rank: 2 }],
    feats: ["feat.safe-camp"],
    grants: [
      { name: "Survival rank 2", detail: "Covers navigation, foraging, exposure, and route safety." },
      { name: "Safe Camp", detail: "Improves a rest only after suitable local preparation." }
    ],
    restrictions: ["Does not summon supplies, a vehicle, or wilderness where none exists."],
    ineligible: []
  },
  arcane: {
    id: "package.arcane-initiate",
    name: "Arcane Initiate",
    sigil: "AI",
    family: "Advanced capability package",
    description: "Learn two fixed novice formulae without acquiring a spellbook, Focus progression, or the Wizard chassis.",
    loopName: "Two fixed formulae",
    loop: "Use one chosen utility formula and one chosen attack formula at their base effect only.",
    tags: ["Advanced package", "Minor magic", "No spellbook"],
    roles: ["Artillery"],
    skills: [{ skillId: "skill.arcana", rank: 1 }],
    feats: ["feat.arcane-initiate"],
    grants: [
      { name: "Two novice formulae", detail: "Fixed at selection; no preparation or amplification." },
      { name: "Arcana rank 1", detail: "Recognize common magical structures and hazards." }
    ],
    restrictions: ["No spellbook, Focus, formula revision, or access to Wizard advancement tiers."],
    ineligible: ["wizard"]
  }
};

const BACKGROUNDS = {
  independent: "Independent",
  "sworn-order": "Raised by a sworn order",
  "court-service": "Court service",
  academy: "Academy trained",
  "street-collective": "Street collective"
};

const STANDINGS = {
  none: {
    name: "None",
    id: null,
    assetRef: null,
    ledger: null,
    restriction: null
  },
  "royal-office": {
    name: "Royal appointment",
    id: "status.royal-office",
    assetRef: null,
    ledger: "Conditional audience and requisition permission where the appointing crown is recognized. Grants no Investigation.",
    restriction: "Royal authority may be ignored outside its jurisdiction and never grants class features."
  },
  "garrison-command": {
    name: "Commands a garrison",
    id: "status.garrison-command",
    assetRef: "asset.garrison.seventh-watch",
    ledger: "Rank plus a referenced garrison asset. Orders depend on contact, loyalty, location, and the asset’s current state.",
    restriction: "The garrison cannot appear in a sealed dungeon, take extra turns, or bypass Command Training."
  },
  billionaire: {
    name: "Billionaire sponsor",
    id: "status.billionaire-sponsor",
    assetRef: "asset.corporation.vale-holdings",
    ledger: "Wealth status plus a separately tracked corporation. Purchases and contacts require availability and time.",
    restriction: "Wealth provides no remote assets, connectivity, or class power when access is unavailable."
  }
};

const EXAMPLES = {
  "paladin-commander": {
    classId: "paladin",
    trainingId: "command",
    name: "Elian Voss",
    title: "Warden of the Seventh Gate",
    background: "sworn-order",
    standing: "garrison-command",
    message: "Paladin remains the class. Command comes from training; the garrison remains a separate asset."
  },
  "wizard-axe": {
    classId: "wizard",
    trainingId: "martial",
    name: "Ilyra Venn",
    title: "The Ashen Scholar",
    background: "academy",
    standing: "none",
    message: "The Wizard legally gains axe proficiency, but no Tempo, Combat Forms, or Fighter progression."
  },
  "royal-inquisitive": {
    classId: "fighter",
    trainingId: "investigation",
    name: "Aveline Rook",
    title: "Royal Inquisitive",
    background: "court-service",
    standing: "royal-office",
    message: "Fighter supplies the dungeon-ready chassis; Investigation and royal authority come from separate sources."
  },
  "netrunner-billionaire": {
    classId: "netrunner",
    trainingId: "investigation",
    name: "Sable Kade",
    title: "Founder of Kade Meridian",
    background: "street-collective",
    standing: "billionaire",
    message: "Netrunner remains the play loop. Wealth is conditional status and a separate asset, not another class."
  }
};

const STEPS = ["class", "training", "identity"];

const state = {
  view: "creation",
  step: "class",
  classId: null,
  trainingId: null,
  classFilter: "all",
  name: "Mara Vale",
  title: "",
  background: "independent",
  standing: "none",
  confirmed: false,
  levelRoute: "continue",
  levelChoice: null
};

const elements = {
  views: document.querySelectorAll("[data-view]"),
  viewTargets: document.querySelectorAll("[data-view-target]"),
  stepTargets: document.querySelectorAll("[data-step-target]"),
  stepPanels: document.querySelectorAll("[data-step]"),
  classOptions: document.querySelector("#class-options"),
  trainingOptions: document.querySelector("#training-options"),
  previousStep: document.querySelector("#previous-step"),
  nextStep: document.querySelector("#next-step"),
  stepStatus: document.querySelector("#step-status"),
  nameInput: document.querySelector("#character-name"),
  titleInput: document.querySelector("#character-title"),
  backgroundInput: document.querySelector("#character-background"),
  standingInput: document.querySelector("#character-standing"),
  summaryName: document.querySelector("#summary-name"),
  summaryTitle: document.querySelector("#summary-title"),
  summaryClass: document.querySelector("#summary-class"),
  summaryTraining: document.querySelector("#summary-training"),
  summaryStanding: document.querySelector("#summary-standing"),
  portrait: document.querySelector(".portrait-placeholder span"),
  validity: document.querySelector("#build-validity"),
  ledger: document.querySelector("#source-ledger"),
  roles: document.querySelector("#derived-roles"),
  restrictions: document.querySelector("#build-restrictions"),
  record: document.querySelector("#record-preview"),
  dialog: document.querySelector("#battle-mage-dialog"),
  toast: document.querySelector("#prototype-toast"),
  levelCurrentBuild: document.querySelector("#level-current-build"),
  continueRouteName: document.querySelector("#continue-route-name"),
  multiclassRouteName: document.querySelector("#multiclass-route-name"),
  routeTargets: document.querySelectorAll("[data-level-route]"),
  automaticRouteLabel: document.querySelector("#automatic-route-label"),
  automaticGains: document.querySelector("#automatic-gains"),
  developmentSection: document.querySelector("#development-choice-section"),
  developmentOptions: document.querySelector("#development-options"),
  multiclassWarning: document.querySelector("#multiclass-warning"),
  multiclassCostCopy: document.querySelector("#multiclass-cost-copy"),
  levelStatus: document.querySelector("#level-status"),
  confirmLevel: document.querySelector("#confirm-level"),
  levelGains: document.querySelector("#level-gains-summary"),
  levelCosts: document.querySelector("#level-costs-summary"),
  levelRecord: document.querySelector("#level-record-preview")
};

let toastTimer = null;

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 3600);
}

function setView(view) {
  state.view = view;
  elements.views.forEach((element) => {
    const active = element.dataset.view === view;
    element.hidden = !active;
    element.classList.toggle("is-active", active);
  });
  document.querySelectorAll(".view-tab").forEach((button) => {
    const active = button.dataset.viewTarget === view;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  if (view === "progression") {
    renderProgression();
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setStep(step, force = false) {
  const targetIndex = STEPS.indexOf(step);
  if (!force && targetIndex >= 1 && !state.classId) {
    showToast("Choose a class chassis before moving to training.");
    return;
  }
  if (!force && targetIndex >= 2 && !state.trainingId) {
    showToast("Choose a training package before moving to identity.");
    return;
  }
  state.step = step;
  state.confirmed = false;
  renderStep();
}

function renderStep() {
  const currentIndex = STEPS.indexOf(state.step);
  elements.stepPanels.forEach((panel) => {
    const active = panel.dataset.step === state.step;
    panel.hidden = !active;
    panel.classList.toggle("is-active", active);
  });
  elements.stepTargets.forEach((button) => {
    const index = STEPS.indexOf(button.dataset.stepTarget);
    const active = index === currentIndex;
    const complete = (index === 0 && Boolean(state.classId)) ||
      (index === 1 && Boolean(state.trainingId)) ||
      (index === 2 && state.confirmed);
    button.classList.toggle("is-active", active);
    button.classList.toggle("is-complete", complete && !active);
    if (active) {
      button.setAttribute("aria-current", "step");
    } else {
      button.removeAttribute("aria-current");
    }
  });

  elements.previousStep.disabled = currentIndex === 0;
  elements.nextStep.disabled =
    (state.step === "class" && !state.classId) ||
    (state.step === "training" && !state.trainingId);

  if (state.step === "class") {
    elements.nextStep.textContent = "Continue";
    elements.stepStatus.textContent = state.classId
      ? `${CLASSES[state.classId].name} selected. Its restrictions are visible in the ledger.`
      : "Choose one class chassis to continue.";
  } else if (state.step === "training") {
    elements.nextStep.textContent = "Continue";
    elements.stepStatus.textContent = state.trainingId
      ? `${TRAINING[state.trainingId].name} selected as the one starting package.`
      : "Choose one training package to continue.";
  } else if (state.confirmed) {
    elements.nextStep.textContent = "Preview level-up";
    elements.nextStep.disabled = false;
    elements.stepStatus.textContent = "Prototype build confirmed. Nothing was saved.";
  } else {
    elements.nextStep.textContent = "Confirm prototype build";
    elements.nextStep.disabled = !(state.classId && state.trainingId);
    elements.stepStatus.textContent = "Review the exact source ledger, then confirm the visible build.";
  }
}

function renderClasses() {
  const visibleClasses = Object.entries(CLASSES).filter(([, item]) =>
    state.classFilter === "all" || item.filters.includes(state.classFilter)
  );

  elements.classOptions.innerHTML = visibleClasses.map(([key, item]) => {
    const selected = state.classId === key;
    return `
      <button
        type="button"
        class="choice-card${selected ? " is-selected" : ""}"
        role="radio"
        aria-checked="${selected}"
        data-class-choice="${key}"
      >
        <span class="choice-card-header">
          <span class="choice-sigil" aria-hidden="true">${item.sigil}</span>
          <span><strong>${item.name}</strong><small>${item.family}</small></span>
          <span class="radio-mark" aria-hidden="true"></span>
        </span>
        <span class="choice-description">${item.description}</span>
        <span class="mechanic-callout">
          <span>${item.loopName}</span>
          <strong>${item.loop}</strong>
        </span>
        <span class="choice-meta">${item.tags.map((tag) => `<span>${tag}</span>`).join("")}</span>
      </button>
    `;
  }).join("");

  elements.classOptions.querySelectorAll("[data-class-choice]").forEach((button) => {
    button.addEventListener("click", () => selectClass(button.dataset.classChoice));
  });
}

function selectClass(classId) {
  state.classId = classId;
  state.confirmed = false;
  if (state.trainingId && TRAINING[state.trainingId].ineligible.includes(classId)) {
    state.trainingId = null;
    showToast("That training duplicates the selected class, so the package choice was cleared.");
  }
  renderClasses();
  renderTraining();
  renderSummary();
  renderStep();
}

function renderTraining() {
  elements.trainingOptions.innerHTML = Object.entries(TRAINING).map(([key, item]) => {
    const selected = state.trainingId === key;
    const unavailable = Boolean(state.classId && item.ineligible.includes(state.classId));
    const duplicateCopy = unavailable
      ? `<span class="unavailable-reason">Already included in ${CLASSES[state.classId].name}</span>`
      : "";
    return `
      <button
        type="button"
        class="choice-card${selected ? " is-selected" : ""}"
        role="radio"
        aria-checked="${selected}"
        data-training-choice="${key}"
        ${unavailable ? "disabled" : ""}
      >
        <span class="choice-card-header">
          <span class="choice-sigil" aria-hidden="true">${item.sigil}</span>
          <span><strong>${item.name}</strong><small>${item.family}</small></span>
          <span class="radio-mark" aria-hidden="true"></span>
        </span>
        <span class="choice-description">${item.description}</span>
        <span class="mechanic-callout">
          <span>${item.loopName}</span>
          <strong>${item.loop}</strong>
        </span>
        <span class="choice-meta">${item.tags.map((tag) => `<span>${tag}</span>`).join("")}${duplicateCopy}</span>
      </button>
    `;
  }).join("");

  elements.trainingOptions.querySelectorAll("[data-training-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      state.trainingId = button.dataset.trainingChoice;
      state.confirmed = false;
      renderTraining();
      renderSummary();
      renderStep();
    });
  });
}

function initials(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.slice(0, 2).map((part) => part[0]).join("") || "?").toUpperCase();
}

function makeSourceRow(token, name, detail) {
  return `
    <div class="source-row">
      <span class="source-token">${escapeHtml(token)}</span>
      <div><strong>${escapeHtml(name)}</strong><span>${escapeHtml(detail)}</span></div>
    </div>
  `;
}

function buildRecord() {
  const selectedClass = state.classId ? CLASSES[state.classId] : null;
  const training = state.trainingId ? TRAINING[state.trainingId] : null;
  const standing = STANDINGS[state.standing];
  return {
    build: {
      schemaVersion: 1,
      chassisVersion: "prototype-0",
      classLevels: selectedClass ? [{ classId: selectedClass.id, level: 1 }] : [],
      skillRanks: training ? training.skills : [],
      featIds: training ? training.feats : [],
      backgroundIds: [],
      playerTitle: state.title
    },
    identity: {
      name: state.name,
      backgroundText: BACKGROUNDS[state.background]
    },
    worldStateRefs: {
      standingId: standing.id,
      assetRefs: standing.assetRef ? [standing.assetRef] : []
    },
    note: "Derived roles are intentionally not persisted."
  };
}

function renderSummary() {
  const selectedClass = state.classId ? CLASSES[state.classId] : null;
  const training = state.trainingId ? TRAINING[state.trainingId] : null;
  const standing = STANDINGS[state.standing];
  const valid = Boolean(selectedClass && training);

  elements.summaryName.textContent = state.name.trim() || "Unnamed character";
  elements.summaryTitle.textContent = state.title.trim() || "Title not set";
  elements.portrait.textContent = initials(state.name);
  elements.summaryClass.textContent = selectedClass ? `${selectedClass.name} 1` : "Not selected";
  elements.summaryTraining.textContent = training ? training.name : "Not selected";
  elements.summaryStanding.textContent = standing.name;
  elements.validity.textContent = valid ? "Legal build" : "Incomplete";
  elements.validity.classList.toggle("is-valid", valid);

  const rows = [];
  if (selectedClass) {
    selectedClass.grants.forEach((grant) => rows.push(makeSourceRow("Class", grant.name, grant.detail)));
  }
  if (training) {
    training.grants.forEach((grant) => rows.push(makeSourceRow("Package", grant.name, grant.detail)));
  }
  if (standing.ledger) {
    rows.push(makeSourceRow("Status", standing.name, standing.ledger));
  }
  elements.ledger.innerHTML = rows.length
    ? rows.join("")
    : '<div class="empty-ledger">Select a class and package to reveal every entitlement source.</div>';

  const roles = [...new Set([...(selectedClass?.roles || []), ...(training?.roles || [])])];
  elements.roles.innerHTML = roles.length
    ? roles.map((role) => `<span class="tag">${escapeHtml(role)}</span>`).join("")
    : '<span class="empty-tag">None yet</span>';

  const restrictions = [
    ...(selectedClass?.restrictions || []),
    ...(training?.restrictions || []),
    ...(standing.restriction ? [standing.restriction] : [])
  ];
  elements.restrictions.innerHTML = restrictions.length
    ? restrictions.map((restriction) => `<li>${escapeHtml(restriction)}</li>`).join("")
    : "<li>Select a class to expose its restrictions.</li>";

  elements.record.textContent = JSON.stringify(buildRecord(), null, 2);
}

function applyExample(exampleId) {
  const example = EXAMPLES[exampleId];
  if (!example) {
    openBattleMageDialog();
    return;
  }
  Object.assign(state, {
    classId: example.classId,
    trainingId: example.trainingId,
    name: example.name,
    title: example.title,
    background: example.background,
    standing: example.standing,
    step: "identity",
    confirmed: false,
    levelRoute: "continue",
    levelChoice: null
  });
  syncInputs();
  renderAll();
  showToast(example.message);
  document.querySelector(".builder-panel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function syncInputs() {
  elements.nameInput.value = state.name;
  elements.titleInput.value = state.title;
  elements.backgroundInput.value = state.background;
  elements.standingInput.value = state.standing;
}

function openBattleMageDialog() {
  if (typeof elements.dialog.showModal === "function") {
    elements.dialog.showModal();
  } else {
    elements.dialog.setAttribute("open", "");
  }
}

function chooseBattleMage(choice) {
  if (choice === "wizard-martial") {
    Object.assign(state, {
      classId: "wizard",
      trainingId: "martial",
      name: "Corin Ash",
      title: "Battle Mage",
      background: "academy",
      standing: "none",
      step: "identity",
      confirmed: false
    });
    elements.dialog.close();
    syncInputs();
    renderAll();
    showToast("Spell-first alternative selected explicitly: Wizard + Martial Training.");
  } else if (choice === "fighter-arcane") {
    Object.assign(state, {
      classId: "fighter",
      trainingId: "arcane",
      name: "Corin Ash",
      title: "Battle Mage",
      background: "academy",
      standing: "none",
      step: "identity",
      confirmed: false
    });
    elements.dialog.close();
    syncInputs();
    renderAll();
    showToast("Weapon-first alternative selected explicitly: Fighter + Arcane Initiate.");
  } else {
    Object.assign(state, {
      classId: "fighter",
      trainingId: "arcane",
      name: "Corin Ash",
      title: "Battle Mage Aspirant",
      background: "academy",
      standing: "none",
      step: "identity",
      confirmed: true,
      levelRoute: "multiclass",
      levelChoice: null
    });
    elements.dialog.close();
    syncInputs();
    renderAll();
    setView("progression");
    showToast("Advanced route shown: a later Wizard level replaces, rather than accompanies, Fighter advancement.");
  }
}

function progressionClass() {
  return state.classId ? CLASSES[state.classId] : CLASSES.paladin;
}

function progressionTraining() {
  return state.trainingId ? TRAINING[state.trainingId] : TRAINING.command;
}

function continuationChoices(selectedClass, training) {
  return [
    ...selectedClass.levelUp.choices,
    {
      id: `deepen-${training.id}`,
      name: `Deepen ${training.name}`,
      detail: `Advance the package’s ranked skill and improve its existing permission; no new class resource is added.`,
      kind: "Training"
    }
  ];
}

function renderProgression() {
  const selectedClass = progressionClass();
  const training = progressionTraining();
  const targetClass = CLASSES[selectedClass.multiclass.target];
  const continuing = state.levelRoute === "continue";

  elements.levelCurrentBuild.textContent = `${selectedClass.name} 3 · ${training.name}`;
  elements.continueRouteName.textContent = `Continue ${selectedClass.name}`;
  elements.multiclassRouteName.textContent = `Take ${targetClass.name} 1`;
  elements.routeTargets.forEach((button) => {
    const active = button.dataset.levelRoute === state.levelRoute;
    button.classList.toggle("is-selected", active);
    button.setAttribute("aria-checked", String(active));
  });

  if (continuing) {
    elements.automaticRouteLabel.textContent = `${selectedClass.name} 3 → ${selectedClass.name} 4`;
    elements.automaticGains.innerHTML = selectedClass.levelUp.automatic.map((gain) => `
      <div class="gain-card">
        <span class="gain-icon" aria-hidden="true">+</span>
        <div><strong>${escapeHtml(gain.name)}</strong><span>${escapeHtml(gain.detail)}</span></div>
      </div>
    `).join("");
    elements.developmentSection.hidden = false;
    elements.multiclassWarning.hidden = true;
    const choices = continuationChoices(selectedClass, training);
    elements.developmentOptions.innerHTML = choices.map((choice) => {
      const active = state.levelChoice === choice.id;
      return `
        <button
          class="development-card${active ? " is-selected" : ""}"
          type="button"
          role="radio"
          aria-checked="${active}"
          data-development-choice="${escapeHtml(choice.id)}"
        >
          <span class="radio-mark" aria-hidden="true"></span>
          <div><strong>${escapeHtml(choice.name)}</strong><span>${escapeHtml(choice.detail)}</span></div>
          <small>${escapeHtml(choice.kind)}</small>
        </button>
      `;
    }).join("");
    elements.developmentOptions.querySelectorAll("[data-development-choice]").forEach((button) => {
      button.addEventListener("click", () => {
        state.levelChoice = button.dataset.developmentChoice;
        renderProgression();
      });
    });
    elements.confirmLevel.disabled = !state.levelChoice;
    elements.levelStatus.textContent = state.levelChoice
      ? "The exact level result is ready to confirm."
      : "Choose one development to preview the result.";
  } else {
    elements.automaticRouteLabel.textContent = `${selectedClass.name} 3 → ${selectedClass.name} 3 / ${targetClass.name} 1`;
    elements.automaticGains.innerHTML = selectedClass.multiclass.gains.map((gain) => `
      <div class="gain-card">
        <span class="gain-icon" aria-hidden="true">+</span>
        <div><strong>${escapeHtml(gain)}</strong><span>Granted by ${escapeHtml(targetClass.name)} level 1 entry.</span></div>
      </div>
    `).join("");
    elements.developmentSection.hidden = true;
    elements.multiclassWarning.hidden = false;
    elements.multiclassCostCopy.textContent = selectedClass.multiclass.costs.join(" ");
    elements.confirmLevel.disabled = false;
    elements.levelStatus.textContent = "The multiclass cost is explicit. Confirm only if the delay is acceptable.";
  }

  renderLevelSummary(selectedClass, targetClass, training);
}

function renderLevelSummary(selectedClass, targetClass, training) {
  const continuing = state.levelRoute === "continue";
  const choices = continuationChoices(selectedClass, training);
  const selectedChoice = choices.find((choice) => choice.id === state.levelChoice);
  const gains = continuing
    ? [
        ...selectedClass.levelUp.automatic.map((gain) => gain.name),
        ...(selectedChoice ? [selectedChoice.name] : ["One development choice still required"])
      ]
    : selectedClass.multiclass.gains;
  const costs = continuing
    ? ["Consumes this level’s one development choice", "No second class entry package"]
    : selectedClass.multiclass.costs;

  elements.levelGains.innerHTML = gains.map((gain) => `<li>${escapeHtml(gain)}</li>`).join("");
  elements.levelCosts.innerHTML = costs.map((cost) => `<li>${escapeHtml(cost)}</li>`).join("");

  const classLevels = continuing
    ? [{ classId: selectedClass.id, level: 4 }]
    : [
        { classId: selectedClass.id, level: 3 },
        { classId: targetClass.id, level: 1 }
      ];
  elements.levelRecord.textContent = JSON.stringify({
    chassisVersion: "prototype-0",
    classLevels,
    selectedDevelopmentId: continuing ? state.levelChoice : null,
    retainedPackageId: training.id
  }, null, 2);
}

function resetPrototype() {
  Object.assign(state, {
    view: "creation",
    step: "class",
    classId: null,
    trainingId: null,
    classFilter: "all",
    name: "Mara Vale",
    title: "",
    background: "independent",
    standing: "none",
    confirmed: false,
    levelRoute: "continue",
    levelChoice: null
  });
  syncInputs();
  document.querySelectorAll("[data-class-filter]").forEach((button) => {
    const active = button.dataset.classFilter === "all";
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  renderAll();
  setView("creation");
  showToast("Prototype reset. No data was stored.");
}

function renderAll() {
  renderClasses();
  renderTraining();
  renderSummary();
  renderStep();
  renderProgression();
}

elements.viewTargets.forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.viewTarget));
});

elements.stepTargets.forEach((button) => {
  button.addEventListener("click", () => setStep(button.dataset.stepTarget));
});

elements.previousStep.addEventListener("click", () => {
  const index = STEPS.indexOf(state.step);
  if (index > 0) setStep(STEPS[index - 1], true);
});

elements.nextStep.addEventListener("click", () => {
  const index = STEPS.indexOf(state.step);
  if (index < STEPS.length - 1) {
    setStep(STEPS[index + 1]);
    return;
  }
  if (!state.confirmed) {
    state.confirmed = true;
    renderStep();
    showToast("Build confirmed for evaluation only. Nothing was saved.");
  } else {
    setView("progression");
  }
});

document.querySelectorAll("[data-class-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    state.classFilter = button.dataset.classFilter;
    document.querySelectorAll("[data-class-filter]").forEach((filterButton) => {
      const active = filterButton === button;
      filterButton.classList.toggle("is-active", active);
      filterButton.setAttribute("aria-pressed", String(active));
    });
    renderClasses();
  });
});

document.querySelectorAll("[data-example]").forEach((button) => {
  button.addEventListener("click", () => applyExample(button.dataset.example));
});

elements.nameInput.addEventListener("input", () => {
  state.name = elements.nameInput.value;
  state.confirmed = false;
  renderSummary();
  renderStep();
});

elements.titleInput.addEventListener("input", () => {
  state.title = elements.titleInput.value;
  state.confirmed = false;
  renderSummary();
  renderStep();
});

elements.backgroundInput.addEventListener("change", () => {
  state.background = elements.backgroundInput.value;
  state.confirmed = false;
  renderSummary();
  renderStep();
});

elements.standingInput.addEventListener("change", () => {
  state.standing = elements.standingInput.value;
  state.confirmed = false;
  renderSummary();
  renderStep();
});

document.querySelectorAll("[data-battle-mage-choice]").forEach((button) => {
  button.addEventListener("click", () => chooseBattleMage(button.dataset.battleMageChoice));
});

elements.routeTargets.forEach((button) => {
  button.addEventListener("click", () => {
    state.levelRoute = button.dataset.levelRoute;
    state.levelChoice = null;
    renderProgression();
  });
});

elements.confirmLevel.addEventListener("click", () => {
  showToast("Advancement confirmed for evaluation only. No character data was changed.");
});

document.querySelector("#reset-prototype").addEventListener("click", resetPrototype);

syncInputs();
renderAll();
