"use strict";

const ARCHETYPES = {
  oathbound: {
    name: "Oathbound",
    sigil: "OA",
    family: "Vow and consequence",
    description: "Declare a binding ideal, draw on resolve to protect allies and pass judgment, then face consequences if you break it.",
    loop: "Declare a vow → spend Resolve on protection and judgment → recover without abandoning the vow.",
    strengths: ["Protection", "Judgment", "Endurance"],
    tags: ["Armored", "Resolve pool", "Reactive defense"],
    abilityDetails: [
      "Spend Resolve on stronger protection and judgment abilities; recover it only while the vow remains intact.",
      "React when a nearby ally is threatened and reduce the harm they would suffer.",
      "Place a consequence on a foe who violates the terms you declared."
    ],
    limits: [
      "Breaking the declared vow interrupts Resolve recovery until the breach is answered in play.",
      "It does not grant followers, rank, or command authority."
    ],
    levelUp: {
      automatic: [
        ["{guard} improves", "The protective reaction improves from d6 to d8."],
        ["{resource} capacity +1", "Maximum {resource} rises from 6 to 7."]
      ],
      choices: [
        ["Intercession", "After {guard} reduces harm, the protected ally may shift one position."],
        ["Binding {judgment}", "Spend 1 {resource} to prevent a judged foe from disengaging freely."]
      ]
    },
    multiclassTarget: "vanguard",
    multiclassCosts: [
      "This level does not improve {guard} or increase {resource}.",
      "Advanced weapon forms remain locked until the second Vanguard level."
    ]
  },
  arcanist: {
    name: "Arcanist",
    sigil: "AR",
    family: "Preparation and focus",
    description: "Prepare a limited repertoire, manage focus, and reshape a scene through carefully chosen supernatural effects.",
    loop: "Prepare a repertoire → establish the right conditions → spend Focus to amplify an effect.",
    strengths: ["Adaptability", "Control", "Ranged power"],
    tags: ["Prepared repertoire", "Focus pool", "Limited weapons"],
    abilityDetails: [
      "Choose a limited set of known effects to have ready before entering danger.",
      "Spend Focus to increase the reach, force, or duration of a prepared effect.",
      "Exchange one prepared effect for another during a safe rest."
    ],
    limits: [
      "Only simple weapons are trained unless another choice explicitly grants more.",
      "An unprepared effect cannot be used merely because it fits the character’s description."
    ],
    levelUp: {
      automatic: [
        ["Prepared {repertoire} +1", "Ready one additional effect after each safe rest."],
        ["{resource} capacity +1", "Maximum {resource} rises from 6 to 7."]
      ],
      choices: [
        ["Counterweave", "Spend 1 {resource} to weaken an observed supernatural effect."],
        ["Echoed {repertoire}", "Once per rest, repeat an unamplified utility effect without using a prepared slot."]
      ]
    },
    multiclassTarget: "vanguard",
    multiclassCosts: [
      "This level does not add a prepared effect or increase {resource}.",
      "Advanced weapon forms remain locked until the second Vanguard level."
    ]
  },
  vanguard: {
    name: "Vanguard",
    sigil: "VA",
    family: "Tempo and weapon forms",
    description: "Control a weapon exchange by spending tempo on precise forms and counters while weapon mastery sets what you can attempt.",
    loop: "Read the exchange → spend Tempo on a form or counter → recover between fights.",
    strengths: ["Weapon mastery", "Pressure", "Durability"],
    tags: ["Martial weapons", "Armor", "Tempo track"],
    abilityDetails: [
      "Spend Tempo on demanding martial forms and counters during a weapon exchange.",
      "Choose a trained maneuver that changes position, pressure, or defense.",
      "Advance one weapon group beyond ordinary proficiency."
    ],
    limits: [
      "Changing weapon groups may end the current form sequence.",
      "Training in magic grants only what that training names; it does not add Arcanist progression."
    ],
    levelUp: {
      automatic: [
        ["{resource} ceiling +1", "Maximum {resource} rises from 6 to 7."],
        ["{mastery} advances", "One trained weapon group reaches the next mastery tier."]
      ],
      choices: [
        ["Measured {form}", "Spend 1 {resource} after a successful guard to make a controlled counter."],
        ["Relentless Pressure", "Keep 1 {resource} when your opponent retreats from the exchange."]
      ]
    },
    multiclassTarget: "arcanist",
    multiclassCosts: [
      "This level does not increase {resource} or advance {mastery}.",
      "Amplification and advanced prepared effects remain locked behind later Arcanist levels."
    ]
  },
  intruder: {
    name: "Intruder",
    sigil: "IN",
    family: "Access and exposure",
    description: "Create an opening in a protected system, exploit that access, and manage the attention your intrusion creates.",
    loop: "Reach a system → spend Access on exploits → manage the Trace those exploits create.",
    strengths: ["Infiltration", "Information", "Disruption"],
    tags: ["Access pool", "Trace pressure", "Special implement"],
    abilityDetails: [
      "Spend Access to exploit openings in a connected or physically reachable system.",
      "Powerful intrusions raise this pressure and trigger escalating consequences.",
      "Spend an opening to alter, expose, or disable a bounded system function."
    ],
    limits: [
      "Without a reachable system there is no remote target; local analysis remains available.",
      "Money, status, and contacts cannot erase Trace or create a connection."
    ],
    levelUp: {
      automatic: [
        ["{resource} ceiling +1", "Maximum stored {resource} rises from 6 to 7."],
        ["{pressure} buffer +1", "The first exposure consequence begins one step later."]
      ],
      choices: [
        ["Ghost Route", "Spend 1 {resource} to conceal an ally’s signature during an intrusion."],
        ["Cold Read", "Convert unused {resource} into one bounded local evidence query offline."]
      ]
    },
    multiclassTarget: "vanguard",
    multiclassCosts: [
      "This level does not increase {resource} or improve the {pressure} buffer.",
      "Weapon mastery remains locked until the second Vanguard level."
    ]
  },
  shifter: {
    name: "Shifter",
    sigil: "SH",
    family: "Essence and changing forms",
    description: "Adopt a bounded alternate form, manage the strain of changing, and specialize each form for a different problem.",
    loop: "Choose a form → spend Essence to change → use its strengths while managing Strain.",
    strengths: ["Transformation", "Mobility", "Adaptation"],
    tags: ["Alternate forms", "Essence pool", "Strain"],
    abilityDetails: [
      "Spend Essence to change form or push a form beyond its ordinary limit.",
      "Adopt one learned shape with a fixed package of strengths and weaknesses.",
      "Changing too often raises this pressure and makes later transformations harder."
    ],
    limits: [
      "A form grants only its listed body and abilities; appearance alone adds nothing.",
      "Healing, command, or spellcasting requires a separate listed source."
    ],
    levelUp: {
      automatic: [
        ["{resource} capacity +1", "Maximum {resource} rises from 6 to 7."],
        ["{form} adaptation", "Add one bounded adaptation to a learned form."]
      ],
      choices: [
        ["Rapid Change", "Once per rest, change into a learned form without increasing {pressure}."],
        ["Shared Instinct", "While transformed, keep one trained social or investigative capability active."]
      ]
    },
    multiclassTarget: "arcanist",
    multiclassCosts: [
      "This level does not increase {resource} or add a {form} adaptation.",
      "Advanced prepared effects remain locked behind later Arcanist levels."
    ]
  }
};

const CAMPAIGNS = {
  crownfall: {
    name: "Crownfall",
    genre: "High Fantasy",
    backgrounds: ["Free household", "Sworn order", "Court service", "Arcane academy", "Border village"],
    standings: {
      none: ["No special standing", "You answer only for your personal reputation.", null],
      royal: ["Royal appointment", "The crown recognizes your office where its authority reaches.", "Royal authority may be ignored outside its jurisdiction and grants no investigation training."],
      garrison: ["Commands a garrison", "A named garrison may answer you when contact, loyalty, and distance allow.", "The garrison cannot appear in a sealed ruin or act as extra turns in an encounter."],
      patron: ["Great House patron", "A wealthy house backs you when its resources can reach the situation.", "Patronage cannot buy an immediate solution where trade, contact, or time is unavailable."]
    },
    callings: {
      oathbound: [
        ["paladin", "Paladin", "Sacred champion", "Your vow is witnessed by a divine or ancestral power.", ["Conviction", "Aegis", "Verdict"]],
        ["templar", "Templar", "Keeper of an order", "Your vow is embodied by a disciplined order and its rites.", ["Zeal", "Intercession", "Edict"]]
      ],
      arcanist: [
        ["wizard", "Wizard", "Scholar of formulae", "You prepare written spells through disciplined study.", ["Spellbook", "Focus", "Revision"]],
        ["witch", "Witch", "Keeper of bargains", "You prepare charms and workings through names, tokens, and pacts.", ["Grimoire", "Favor", "Rebinding"]]
      ],
      vanguard: [
        ["fighter", "Fighter", "Master of arms", "You turn drilled weapon practice into decisive combat forms.", ["Tempo", "Combat Form", "Weapon Mastery"]]
      ],
      intruder: [],
      shifter: [
        ["druid", "Druid", "Keeper of wild shapes", "You borrow known forms through a bond with the living world.", ["Essence", "Wild Shape", "Strain"]],
        ["beastbound", "Beastbound", "Bearer of an inner beast", "You negotiate with a powerful form carried within your own blood.", ["Instinct", "Beast Form", "Feral Strain"]]
      ]
    }
  },
  neon: {
    name: "Neon Divide",
    genre: "Cyberpunk",
    backgrounds: ["Street collective", "Corporate academy", "Public sector", "Combat circuit", "Independent contractor"],
    standings: {
      none: ["Independent", "No institution claims or backs you.", null],
      civic: ["City office", "A municipal office recognizes your authority within its narrow remit.", "Your badge carries no authority beyond its jurisdiction and grants no investigation training."],
      crew: ["Commands a crew", "A named crew may take assignments when contact, loyalty, and risk allow.", "The crew is not a pool of free actions and may be unreachable during an operation."],
      billionaire: ["Billionaire sponsor", "Personal wealth and a separately managed corporation can support long-term plans.", "Money cannot create connectivity, erase Trace, or deliver assets into a sealed site."]
    },
    callings: {
      oathbound: [
        ["corporate-justicar", "Corporate Justicar", "Licensed covenant enforcer", "Your binding code is written into a charter you publicly uphold.", ["Standing", "Interpose", "Sanction"]],
        ["street-vindicator", "Street Vindicator", "Sworn neighborhood defender", "Your code is an open promise to a community rather than a corporation.", ["Resolve", "Bodyguard", "Reckoning"]]
      ],
      arcanist: [
        ["protocol-savant", "Protocol Savant", "Prepared systems theorist", "You ready bounded protocols and amplify them through a finite cognitive rig.", ["Protocol Deck", "Focus", "Hot Swap"]]
      ],
      vanguard: [
        ["solo", "Solo", "Independent combat specialist", "You convert combat rhythm into disciplined techniques and weapon mastery.", ["Tempo", "Technique", "Weapon Mastery"]],
        ["security-operative", "Security Operative", "Tactical response professional", "Your forms come from coordinated response drills and controlled escalation.", ["Readiness", "Response Form", "Arms Mastery"]]
      ],
      intruder: [
        ["netrunner", "Netrunner", "Network intrusion specialist", "You create Access through a deck and act before rising Trace closes the window.", ["Access", "Trace", "Exploit"]]
      ],
      shifter: [
        ["bioform-adept", "Bioform Adept", "Adaptive body specialist", "You trigger licensed body plans and manage the physiological strain they create.", ["Catalyst", "Body Plan", "Strain"]]
      ]
    }
  },
  starfall: {
    name: "Starfall Reach",
    genre: "Space Opera",
    backgrounds: ["Colony born", "Fleet academy", "Temple enclave", "Trade habitat", "Frontier salvage crew"],
    standings: {
      none: ["Free agent", "No fleet, house, or station formally backs you.", null],
      fleet: ["Fleet commission", "A fleet recognizes your commission where its command structure reaches.", "The commission has no authority in hostile space and grants no tactical training."],
      ship: ["Commands a ship", "A named vessel and crew answer you subject to location, duty, and condition.", "The ship cannot participate where it cannot physically reach and never grants extra personal actions."],
      magnate: ["Station magnate", "A station enterprise can supply contacts and resources across established routes.", "The enterprise cannot deliver immediate help beyond its routes or communication range."]
    },
    callings: {
      oathbound: [
        ["star-warden", "Star Warden", "Sworn protector of the Reach", "Your vow is witnessed by an order that guards travelers between worlds.", ["Resolve", "Ward", "Censure"]]
      ],
      arcanist: [
        ["psion", "Psion", "Disciplined mind adept", "You prepare mental disciplines and amplify them through controlled focus.", ["Discipline Set", "Focus", "Recenter"]],
        ["astromancer", "Astromancer", "Reader of stellar patterns", "You prepare stellar workings from observed conjunctions and resonances.", ["Star Chart", "Resonance", "Realignment"]]
      ],
      vanguard: [
        ["marine", "Marine", "Armored boarding specialist", "Your forms come from boarding drills and close-quarters weapon mastery.", ["Tempo", "Boarding Form", "Weapon Mastery"]],
        ["duel-captain", "Duel Captain", "Formal combat officer", "You build advantage through measured exchanges and command of a chosen weapon.", ["Advantage", "Duel Form", "Weapon Mastery"]]
      ],
      intruder: [
        ["systems-infiltrator", "Systems Infiltrator", "Ship and station intrusion specialist", "You establish Access against reachable systems while managing escalating detection.", ["Access", "Detection", "Override"]]
      ],
      shifter: [
        ["xenoform-adept", "Xenoform Adept", "Bearer of adapted alien forms", "You adopt studied body plans and manage the strain of radical adaptation.", ["Essence", "Xenoform", "Strain"]]
      ]
    }
  }
};

const TRAINING = {
  command: {
    name: "Command",
    summary: "Coordinate allies who can hear and choose to follow.",
    ability: ["Coordinated Order", "After your successful check, an ally may reposition using their reaction."],
    strengths: ["Leadership"],
    limit: "Command grants neither followers nor rank; those depend on relationships and standing.",
    blocked: []
  },
  investigation: {
    name: "Investigation",
    summary: "Search, interview, and preserve the provenance of evidence.",
    ability: ["Evidence Chain", "Preserve one clue so later inquiry can distinguish fact, inference, and tampering."],
    strengths: ["Inquiry"],
    limit: "A title or royal office does not substitute for Investigation training.",
    blocked: []
  },
  martial: {
    name: "Martial Training",
    summary: "Gain one martial weapon group and basic guard drills.",
    ability: ["Axe Proficiency", "Use battle axes without the untrained penalty; this grants no Vanguard forms or Tempo."],
    strengths: ["Battle axes"],
    limit: "This does not grant Vanguard resources, forms, mastery, or progression.",
    blocked: ["vanguard"]
  },
  fieldcraft: {
    name: "Fieldcraft",
    summary: "Navigate hazards, establish safe camps, and manage local scarcity.",
    ability: ["Safe Camp", "After suitable preparation, improve the group’s next rest in hostile terrain."],
    strengths: ["Exploration"],
    limit: "Fieldcraft cannot summon supplies, a vehicle, or wilderness where none exists.",
    blocked: []
  },
  arcane: {
    name: "Arcane Initiate",
    summary: "Learn two fixed minor workings without full Arcanist progression.",
    ability: ["Two Minor Workings", "Use two chosen effects at their base strength; they cannot be prepared or amplified."],
    strengths: ["Minor magic"],
    limit: "This grants no prepared repertoire, Focus pool, or access to advanced Arcanist effects.",
    blocked: ["arcanist"]
  }
};

const EXAMPLES = {
  "paladin-commander": ["crownfall", "oathbound", "paladin", "command", "Elian Voss", "Warden of the Seventh Gate", 1, "garrison"],
  "wizard-axe": ["crownfall", "arcanist", "wizard", "martial", "Ilyra Venn", "The Ashen Scholar", 3, "none"],
  "royal-inquisitive": ["crownfall", "vanguard", "fighter", "investigation", "Aveline Rook", "Royal Inquisitive", 2, "royal"],
  "netrunner-billionaire": ["neon", "intruder", "netrunner", "investigation", "Sable Kade", "Founder of Kade Meridian", 0, "billionaire"]
};

const STANDING_EXAMPLES = {
  none: "An independent character can still earn cooperation through reputation and relationships, but cannot invoke an institution on demand.",
  royal: "A royal appointee can request records or cooperation where the crown is obeyed. Finding and interpreting the evidence still requires Investigation training and successful checks.",
  garrison: "A commander can assign patrols or defend a known location between expeditions. Inside a sealed ruin, the garrison does not become extra combat turns.",
  patron: "A Great House can arrange introductions, lodging, or supplies when its people have time and access to help. It cannot purchase an answer in an isolated dungeon.",
  civic: "A city officer can request municipal records or official cooperation inside that office’s jurisdiction. The badge does not supply investigative skill.",
  crew: "A crew can watch an exit, gather local information, or take a separate assignment when contact and loyalty permit. It does not act as extra turns for the character.",
  billionaire: "Before an operation, a billionaire sponsor can fund a safehouse, retain specialists, or arrange equipment when time and access permit. Inside a sealed site, the character relies on personal abilities and training.",
  fleet: "A fleet officer can issue lawful orders and request support where the chain of command reaches. Hostile territory may recognize none of that authority.",
  ship: "A captain can direct a named ship and crew when they are present and able to act. Away from the ship, the captain uses personal abilities like anyone else.",
  magnate: "A station magnate can arrange contacts, freight, or credit along established routes. Immediate help still depends on communication, distance, and delivery time."
};

const ABILITY_RESOURCE = {
  maximum: 6,
  breatherRecovery: 2,
  fullRecovery: "safe rest"
};

const ARCHETYPE_GUIDES = {
  oathbound: {
    genericTerms: ["Resolve", "Aegis", "Verdict"],
    summary: (className, terms) =>
      `${className} abilities draw on ${terms.resource}. Protection is reactive; judgment is deliberate and more expensive.`,
    steps: (terms) => [
      `Begin an expedition with ${ABILITY_RESOURCE.maximum} ${terms.resource}.`,
      `${terms.primary} is a reaction that costs 2 ${terms.resource} when a nearby ally is threatened.`,
      `${terms.secondary} is an action that costs 3 ${terms.resource} and places a consequence on a foe.`,
      `Recover ${ABILITY_RESOURCE.breatherRecovery} ${terms.resource} after a breather and all of it after a ${ABILITY_RESOURCE.fullRecovery}.`
    ],
    example: (className, terms) =>
      `${className} begins with ${ABILITY_RESOURCE.maximum} ${terms.resource}. ${terms.primary} protects an ally for 2, leaving 4. Later, ${terms.secondary} costs 3, leaving 1 until the group can recover.`,
    limits: (terms) => [
      "The protective reaction still uses the character’s reaction for that round.",
      `A broken vow can suspend ${terms.resource} recovery until its consequence is faced.`,
      "Rank and followers come from standing and relationships, not Oathbound abilities."
    ]
  },
  arcanist: {
    genericTerms: ["Focus", "Prepared Repertoire", "Revision"],
    summary: (className, terms) =>
      `${className} effects draw on ${terms.resource}. Preparation controls what is available; ${terms.resource} controls how much can be done before recovery.`,
    steps: (terms) => [
      `Begin an expedition with ${ABILITY_RESOURCE.maximum} ${terms.resource}.`,
      `Choose the effects in your ${terms.primary} during a safe rest.`,
      `Prepared effects cost 1–3 ${terms.resource}; stronger reach, force, or duration costs more.`,
      `Recover ${ABILITY_RESOURCE.breatherRecovery} ${terms.resource} after a breather and all of it after a ${ABILITY_RESOURCE.fullRecovery}.`
    ],
    example: (className, terms) =>
      `${className} begins with ${ABILITY_RESOURCE.maximum} ${terms.resource}. A binding effect costs 2, then an amplified blast costs 3. One ${terms.resource} remains, and only effects in the ${terms.primary} are still available.`,
    limits: (terms) => [
      `Having enough ${terms.resource} does not make an unprepared effect available.`,
      "Weapon training does not grant another prepared slot or advanced effect.",
      `Changing the ${terms.primary} requires the listed rest or revision feature.`
    ]
  },
  vanguard: {
    genericTerms: ["Tempo", "Combat Form", "Weapon Mastery"],
    summary: (className, terms) =>
      `${className} techniques draw on ${terms.resource}. Forms are paid abilities; mastery determines which weapons and advanced forms are available.`,
    steps: (terms) => [
      `Begin an expedition with ${ABILITY_RESOURCE.maximum} ${terms.resource}.`,
      `A basic ${terms.primary} costs 2 ${terms.resource} and uses the action or reaction printed on that form.`,
      `${terms.secondary} is passive progression; it does not consume ${terms.resource}.`,
      `Recover ${ABILITY_RESOURCE.breatherRecovery} ${terms.resource} after a breather and all of it after a ${ABILITY_RESOURCE.fullRecovery}.`
    ],
    example: (className, terms) =>
      `${className} begins with ${ABILITY_RESOURCE.maximum} ${terms.resource}. A Breaker ${terms.primary} costs 2, and a Guard Counter later costs 2 more. Two ${terms.resource} remain for another technique before recovery.`,
    limits: (terms) => [
      `Spending ${terms.resource} does not create an extra action or reaction.`,
      "A form still requires its listed weapon, position, and trigger.",
      `Command training and military rank do not add forms or ${terms.secondary}.`
    ]
  },
  intruder: {
    genericTerms: ["Access", "Trace", "Exploit"],
    summary: (className, terms) =>
      `${className} exploits draw on ${terms.resource}. ${terms.primary} tracks escalating exposure and can create consequences even when resource remains.`,
    steps: (terms) => [
      `Begin an operation with ${ABILITY_RESOURCE.maximum} ${terms.resource}.`,
      `${terms.secondary} actions cost 1–3 ${terms.resource}, depending on reach and effect.`,
      `Riskier exploits may also raise ${terms.primary}; spending ${terms.resource} does not remove that exposure.`,
      `Recover ${ABILITY_RESOURCE.breatherRecovery} ${terms.resource} after a breather and all of it after a ${ABILITY_RESOURCE.fullRecovery}.`
    ],
    example: (className, terms) =>
      `${className} begins with ${ABILITY_RESOURCE.maximum} ${terms.resource}. A quiet scan costs 1. A forceful ${terms.secondary} costs 3 and raises ${terms.primary}. Two ${terms.resource} remain, but the system is now watching.`,
    limits: (terms) => [
      "A reachable system or local device is still required.",
      `Recovering ${terms.resource} does not erase ${terms.primary}, alarms, or other consequences.`,
      "Wealth cannot create a connection or bypass an exploit’s prerequisites."
    ]
  },
  shifter: {
    genericTerms: ["Essence", "Form", "Strain"],
    summary: (className, terms) =>
      `${className} transformations draw on ${terms.resource}. ${terms.primary} determines the available body; ${terms.secondary} tracks the risk of repeated change.`,
    steps: (terms) => [
      `Begin an expedition with ${ABILITY_RESOURCE.maximum} ${terms.resource}.`,
      `Changing into a learned ${terms.primary} costs 2 ${terms.resource}.`,
      `Pushing a form beyond its listed limits costs more and may raise ${terms.secondary}.`,
      `Recover ${ABILITY_RESOURCE.breatherRecovery} ${terms.resource} after a breather and all of it after a ${ABILITY_RESOURCE.fullRecovery}.`
    ],
    example: (className, terms) =>
      `${className} begins with ${ABILITY_RESOURCE.maximum} ${terms.resource}. Taking a climbing ${terms.primary} costs 2. Forcing an extreme adaptation costs another 2 and raises ${terms.secondary}, leaving 2 ${terms.resource}.`,
    limits: (terms) => [
      "Each learned form grants only the abilities written on it.",
      `Recovering ${terms.resource} does not automatically remove ${terms.secondary} or its consequences.`,
      "Healing, command, and spellcasting require their own listed source."
    ]
  }
};

const state = {
  view: "creation",
  campaignId: "crownfall",
  step: "archetype",
  archetypeId: null,
  callingId: null,
  trainingId: null,
  name: "Mara Vale",
  title: "",
  backgroundIndex: 0,
  standingId: "none",
  confirmed: false,
  levelRoute: "continue",
  levelChoice: null,
  multiclassCallingId: null
};

const elements = {
  views: document.querySelectorAll("[data-view]"),
  viewTargets: document.querySelectorAll("[data-view-target]"),
  campaignSelect: document.querySelector("#campaign-select"),
  campaignKicker: document.querySelector("#campaign-kicker"),
  levelCampaignKicker: document.querySelector("#level-campaign-kicker"),
  pathSummary: document.querySelector("#path-summary"),
  stepTargets: document.querySelectorAll("[data-step-target]"),
  stepPanels: document.querySelectorAll("[data-step]"),
  callingStepKicker: document.querySelector("#calling-step-kicker"),
  callingStepLabel: document.querySelector("#calling-step-label"),
  archetypeOptions: document.querySelector("#archetype-options"),
  callingKicker: document.querySelector("#calling-kicker"),
  callingTitle: document.querySelector("#calling-title"),
  callingHelp: document.querySelector("#calling-help"),
  callingContext: document.querySelector("#calling-context"),
  callingOptions: document.querySelector("#calling-options"),
  trainingOptions: document.querySelector("#training-options"),
  previousStep: document.querySelector("#previous-step"),
  nextStep: document.querySelector("#next-step"),
  stepStatus: document.querySelector("#step-status"),
  nameInput: document.querySelector("#character-name"),
  titleInput: document.querySelector("#character-title"),
  backgroundInput: document.querySelector("#character-background"),
  standingInput: document.querySelector("#character-standing"),
  standingNote: document.querySelector("#standing-note"),
  summaryName: document.querySelector("#summary-name"),
  summaryTitle: document.querySelector("#summary-title"),
  portrait: document.querySelector(".portrait-placeholder span"),
  validity: document.querySelector("#build-validity"),
  summaryArchetype: document.querySelector("#summary-archetype"),
  summaryCalling: document.querySelector("#summary-calling"),
  summaryTraining: document.querySelector("#summary-training"),
  summaryStanding: document.querySelector("#summary-standing"),
  playstyle: document.querySelector("#playstyle-summary"),
  strengths: document.querySelector("#character-strengths"),
  creationHelpSlot: document.querySelector("#creation-help-slot"),
  progressionHelpSlot: document.querySelector("#progression-help-slot"),
  contextHelp: document.querySelector("#context-help"),
  helpKicker: document.querySelector("#help-kicker"),
  helpTitle: document.querySelector("#help-title"),
  helpPin: document.querySelector("#help-pin"),
  helpPinLabel: document.querySelector("#help-pin-label"),
  helpClose: document.querySelector("#help-close"),
  helpResource: document.querySelector("#help-resource"),
  helpResourceLabel: document.querySelector("#help-resource-label"),
  helpResourceName: document.querySelector("#help-resource-name"),
  helpResourceCurrent: document.querySelector("#help-resource-current"),
  helpResourceMaximum: document.querySelector("#help-resource-maximum"),
  helpResourceRule: document.querySelector("#help-resource-rule"),
  helpSummary: document.querySelector("#help-summary"),
  helpSteps: document.querySelector("#help-steps"),
  helpExample: document.querySelector("#help-example"),
  helpLimits: document.querySelector("#help-limits"),
  mobileHelpToggle: document.querySelector("#mobile-help-toggle"),
  helpBackdrop: document.querySelector("#help-backdrop"),
  battleMageDialog: document.querySelector("#battle-mage-dialog"),
  toast: document.querySelector("#character-toast"),
  levelName: document.querySelector("#level-character-name"),
  levelCalling: document.querySelector("#level-character-calling"),
  levelCurrentBuild: document.querySelector("#level-current-build"),
  continueRouteName: document.querySelector("#continue-route-name"),
  continueRouteCopy: document.querySelector("#continue-route-copy"),
  multiclassRouteName: document.querySelector("#multiclass-route-name"),
  multiclassRouteCopy: document.querySelector("#multiclass-route-copy"),
  routeTargets: document.querySelectorAll("[data-level-route]"),
  multiclassCallingSection: document.querySelector("#multiclass-calling-section"),
  multiclassCallingTitle: document.querySelector("#multiclass-calling-title"),
  multiclassCallingOptions: document.querySelector("#multiclass-calling-options"),
  automaticRouteLabel: document.querySelector("#automatic-route-label"),
  automaticGains: document.querySelector("#automatic-gains"),
  developmentSection: document.querySelector("#development-choice-section"),
  developmentOptions: document.querySelector("#development-options"),
  multiclassWarning: document.querySelector("#multiclass-warning"),
  multiclassCostCopy: document.querySelector("#multiclass-cost-copy"),
  levelStatus: document.querySelector("#level-status"),
  confirmLevel: document.querySelector("#confirm-level"),
  levelGains: document.querySelector("#level-gains-summary"),
  levelCosts: document.querySelector("#level-costs-summary")
};

let toastTimer = null;
let helpPinned = false;
const mobileHelpQuery = window.matchMedia("(max-width: 760px)");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function campaign() {
  return CAMPAIGNS[state.campaignId];
}

function mappings(archetypeId = state.archetypeId) {
  return archetypeId ? campaign().callings[archetypeId] || [] : [];
}

function callingById(archetypeId = state.archetypeId, callingId = state.callingId) {
  return mappings(archetypeId).find((entry) => entry[0] === callingId) || null;
}

function standing() {
  return campaign().standings[state.standingId] || Object.values(campaign().standings)[0];
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 3200);
}

function flavorText(text, calling) {
  if (!calling) return text;
  const names = calling[4];
  const callingArchetypeId = Object.keys(ARCHETYPES).find((archetypeId) =>
    mappings(archetypeId).some((entry) => entry[0] === calling[0])
  );
  const replacements = {
    resource: callingArchetypeId === "arcanist" ? names[1] : names[0],
    repertoire: names[0],
    guard: names[1],
    form: names[1],
    pressure: names[1],
    judgment: names[2],
    mastery: names[2]
  };
  return Object.entries(replacements).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, value),
    text
  );
}

function guideTerms(archetypeId, selectedCalling = null) {
  if (!selectedCalling) {
    const [resource, primary, secondary] = ARCHETYPE_GUIDES[archetypeId].genericTerms;
    return { resource, primary, secondary };
  }
  const names = selectedCalling[4];
  if (archetypeId === "arcanist") {
    return { resource: names[1], primary: names[0], secondary: names[2] };
  }
  return { resource: names[0], primary: names[1], secondary: names[2] };
}

function archetypeHelp(archetypeId, selectedCalling = null) {
  const archetype = ARCHETYPES[archetypeId];
  const guide = ARCHETYPE_GUIDES[archetypeId];
  const terms = guideTerms(archetypeId, selectedCalling);
  const className = selectedCalling ? selectedCalling[1] : archetype.name;
  return {
    kicker: selectedCalling ? `${archetype.name} · ${className}` : `${archetype.name} archetype`,
    title: selectedCalling ? `How a ${className} works` : `How ${archetype.name} works`,
    summary: guide.summary(className, terms),
    resource: {
      label: `${className} resource`,
      name: terms.resource,
      current: ABILITY_RESOURCE.maximum,
      maximum: ABILITY_RESOURCE.maximum,
      rule: `${terms.resource} pays for ${className} abilities. A breather restores ${ABILITY_RESOURCE.breatherRecovery}; a ${ABILITY_RESOURCE.fullRecovery} restores it to ${ABILITY_RESOURCE.maximum}.`
    },
    steps: guide.steps(terms),
    example: guide.example(className, terms),
    limits: guide.limits(terms)
  };
}

function trainingHelp(trainingId) {
  const item = TRAINING[trainingId];
  return {
    kicker: "Special training",
    title: item.name,
    summary: item.summary,
    resource: null,
    steps: [
      `Selecting ${item.name} grants ${item.ability[0]}.`,
      item.ability[1],
      "The action or reaction printed on the ability still applies.",
      "Training advances separately from archetype levels."
    ],
    example: `${item.ability[0]} is available because this training was selected; a title, job, or background with similar wording would not grant it.`,
    limits: [item.limit]
  };
}

function backgroundHelp() {
  const background = campaign().backgrounds[state.backgroundIndex];
  return {
    kicker: `${campaign().genre} background`,
    title: background,
    summary: "Background establishes prior experience, likely knowledge, and plausible relationships. It is not another ability package.",
    resource: null,
    steps: [
      "Choose the history that best explains where the character learned ordinary things.",
      "Use it to establish familiarity, contacts, or context when the fiction supports them.",
      "Resolve uncertain actions with the character’s actual training and abilities."
    ],
    example: `“${background}” can establish what the character plausibly knows or who they may recognize; it does not grant a class ability with a similar theme.`,
    limits: ["Background grants no archetype level, special training, standing, followers, or extra action."]
  };
}

function identityHelp() {
  return {
    kicker: "Character identity",
    title: "Name and title",
    summary: "Name and title tell the table who the character is and how others address them. They do not replace a mechanical choice.",
    resource: null,
    steps: [
      "Enter the character’s personal name.",
      "Add a title, office, or reputation if it belongs in the concept.",
      "Represent any actual skill or authority through training and standing."
    ],
    example: "A Royal Inquisitive might be a Wizard with Investigation training and a royal appointment. The title describes that combination; it does not create it.",
    limits: ["A title alone grants no class ability, training, jurisdiction, followers, wealth, or extra action."]
  };
}

function standingHelp(standingEntry = standing()) {
  return {
    kicker: "Current standing",
    title: standingEntry[0],
    summary: standingEntry[1],
    resource: null,
    steps: [
      "Standing describes the authority, wealth, or institution currently available to the character.",
      "The campaign checks whether that standing is recognized and able to reach the present situation.",
      "Any followers, property, corporation, garrison, or vehicle remain separately tracked."
    ],
    example: STANDING_EXAMPLES[state.standingId],
    limits: [standingEntry[2] || "Standing does not add archetype levels, training, or extra actions."]
  };
}

function creationOverviewHelp() {
  return {
    kicker: "Character creation",
    title: "Choosing an archetype",
    summary: "An archetype determines progression, signature abilities, and important restrictions.",
    resource: null,
    steps: [
      "Choose the style of progression you want to play.",
      "If the campaign has several classes for that archetype, choose the class that fits your character.",
      "Add one special training, then choose background, standing, name, and title."
    ],
    example: "Oathbound can become a Paladin or Templar in Crownfall. Both advance as Oathbound; the class determines how that path appears in the campaign.",
    limits: ["Background, standing, and title never grant an archetype’s abilities by themselves."]
  };
}

function classChoiceHelp(archetypeId) {
  const archetype = ARCHETYPES[archetypeId];
  return {
    kicker: `${campaign().name} classes`,
    title: `Choose an ${archetype.name} class`,
    summary: `These classes share ${archetype.name} progression but give its abilities names and a place suited to ${campaign().name}.`,
    resource: null,
    steps: [
      "Compare the class descriptions and signature terms.",
      "Choose the version that fits the character’s place in this campaign.",
      `The ${archetype.name} progression and restrictions remain the same.`
    ],
    example: `In ${campaign().name}, selecting one class changes the character’s class presentation without creating another progression track.`,
    limits: ["A campaign class does not add a second archetype or a second advancement budget."]
  };
}

function developmentHelp(choice, currentCalling, archetype) {
  return {
    kicker: "Level development",
    title: choice.name,
    summary: choice.detail,
    resource: null,
    steps: [
      `Advance ${currentCalling[1]} to level 4.`,
      `Gain the automatic ${archetype.name} improvements shown above.`,
      `Add ${choice.name} as this level’s one development.`
    ],
    example: `${choice.name} becomes available after the level is confirmed; no other development from this list is gained.`,
    limits: ["This uses the level’s one development choice."]
  };
}

function routeHelp(route) {
  const context = progressionContext();
  const { archetype, currentCalling, target, targetCallings, targetCalling } = context;
  if (route === "continue") {
    return {
      kicker: "Continue current path",
      title: `${currentCalling[1]} level 4`,
      summary: `Advance the ${archetype.name} archetype, gain its automatic improvements, and choose one development.`,
      resource: null,
      steps: [
        `Keep ${currentCalling[1]} as the character’s only class.`,
        `Gain both automatic ${archetype.name} improvements shown in the level preview.`,
        "Choose one development from the available list.",
        "Confirm the level after reviewing the complete result."
      ],
      example: `${currentCalling[1]} 3 becomes ${currentCalling[1]} 4 and gains one selected development alongside its automatic improvements.`,
      limits: ["Continuing this path does not grant the entry abilities or training of another archetype."]
    };
  }
  const selectedClass = targetCalling || (targetCallings.length === 1 ? targetCallings[0] : null);
  return {
    kicker: "Begin another archetype",
    title: selectedClass ? `${target.name} · ${selectedClass[1]}` : `Begin ${target.name}`,
    summary: `This level goes to ${target.name} instead of advancing ${currentCalling[1]}.`,
    resource: selectedClass ? archetypeHelp(archetype.multiclassTarget, selectedClass).resource : null,
    steps: [
      targetCallings.length > 1 ? `Choose the ${target.name} class used in ${campaign().name}.` : `${targetCallings[0][1]} is selected for ${campaign().name}.`,
      `Gain the entry abilities from ${target.name} level 1.`,
      `Keep ${currentCalling[1]} at level 3.`,
      `Return to ${archetype.name} later if you want its level 4 improvements.`
    ],
    example: `${currentCalling[1]} 3 / ${selectedClass ? selectedClass[1] : target.name} 1 has four total levels, not two simultaneous level-4 progressions.`,
    limits: archetype.multiclassCosts.map((item) => flavorText(item, currentCalling))
  };
}

function defaultHelpTopic() {
  if (state.view === "progression") return routeHelp(state.levelRoute);
  if (state.step === "archetype") {
    return state.archetypeId ? archetypeHelp(state.archetypeId, callingById()) : creationOverviewHelp();
  }
  if (state.step === "calling") {
    return state.callingId ? archetypeHelp(state.archetypeId, callingById()) : classChoiceHelp(state.archetypeId);
  }
  return state.archetypeId ? archetypeHelp(state.archetypeId, callingById()) : creationOverviewHelp();
}

function renderHelpTopic(topic) {
  elements.helpKicker.textContent = topic.kicker;
  elements.helpTitle.textContent = topic.title;
  elements.helpSummary.textContent = topic.summary;
  elements.helpSteps.innerHTML = topic.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("");
  elements.helpExample.textContent = topic.example;
  elements.helpLimits.innerHTML = topic.limits.map((limit) => `<li>${escapeHtml(limit)}</li>`).join("");
  if (topic.resource) {
    elements.helpResource.hidden = false;
    elements.helpResourceLabel.textContent = topic.resource.label;
    elements.helpResourceName.textContent = topic.resource.name;
    elements.helpResourceCurrent.textContent = String(topic.resource.current);
    elements.helpResourceMaximum.textContent = String(topic.resource.maximum);
    elements.helpResourceRule.textContent = topic.resource.rule;
  } else {
    elements.helpResource.hidden = true;
  }
}

function showHelp(topic) {
  if (!helpPinned) renderHelpTopic(topic);
}

function refreshHelp() {
  if (!helpPinned) renderHelpTopic(defaultHelpTopic());
}

function bindHelp(element, topicFactory) {
  element.addEventListener("mouseenter", () => showHelp(topicFactory()));
  element.addEventListener("focus", () => showHelp(topicFactory()));
}

function moveHelpPanel(view) {
  const slot = view === "progression" ? elements.progressionHelpSlot : elements.creationHelpSlot;
  if (elements.contextHelp.parentElement !== slot) slot.append(elements.contextHelp);
}

function openMobileHelp() {
  elements.contextHelp.classList.add("is-mobile-open");
  elements.helpBackdrop.classList.add("is-visible");
  document.body.classList.add("rules-guide-open");
  elements.contextHelp.setAttribute("role", "dialog");
  elements.contextHelp.setAttribute("aria-modal", "true");
  elements.mobileHelpToggle.setAttribute("aria-expanded", "true");
  elements.helpClose.focus();
}

function closeMobileHelp(restoreFocus = false) {
  elements.contextHelp.classList.remove("is-mobile-open");
  elements.helpBackdrop.classList.remove("is-visible");
  document.body.classList.remove("rules-guide-open");
  elements.contextHelp.removeAttribute("role");
  elements.contextHelp.removeAttribute("aria-modal");
  elements.mobileHelpToggle.setAttribute("aria-expanded", "false");
  if (restoreFocus) elements.mobileHelpToggle.focus();
}

function setView(view) {
  state.view = view;
  moveHelpPanel(view);
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
  if (view === "progression") renderProgression();
  refreshHelp();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function populateCampaignPicker() {
  elements.campaignSelect.innerHTML = Object.entries(CAMPAIGNS)
    .map(([id, item]) => `<option value="${id}">${escapeHtml(item.name)} · ${escapeHtml(item.genre)}</option>`)
    .join("");
  elements.campaignSelect.value = state.campaignId;
}

function populateIdentityOptions() {
  const currentCampaign = campaign();
  elements.backgroundInput.innerHTML = currentCampaign.backgrounds
    .map((name, index) => `<option value="${index}">${escapeHtml(name)}</option>`)
    .join("");
  elements.standingInput.innerHTML = Object.entries(currentCampaign.standings)
    .map(([id, item]) => `<option value="${id}">${escapeHtml(item[0])}</option>`)
    .join("");
  if (!currentCampaign.backgrounds[state.backgroundIndex]) state.backgroundIndex = 0;
  if (!currentCampaign.standings[state.standingId]) state.standingId = Object.keys(currentCampaign.standings)[0];
  elements.backgroundInput.value = String(state.backgroundIndex);
  elements.standingInput.value = state.standingId;
  renderStandingNote();
}

function chooseCampaign(campaignId) {
  Object.assign(state, {
    campaignId,
    step: "archetype",
    archetypeId: null,
    callingId: null,
    trainingId: null,
    backgroundIndex: 0,
    standingId: Object.keys(CAMPAIGNS[campaignId].standings)[0],
    confirmed: false,
    levelRoute: "continue",
    levelChoice: null,
    multiclassCallingId: null
  });
  populateIdentityOptions();
  syncInputs();
  renderAll();
  setView("creation");
}

function nextStepFrom(step) {
  if (step === "archetype") return mappings().length > 1 ? "calling" : "character";
  if (step === "calling") return "character";
  return null;
}

function previousStepFrom(step) {
  if (step === "character") return mappings().length > 1 ? "calling" : "archetype";
  if (step === "calling") return "archetype";
  return null;
}

function setStep(step, force = false) {
  if (!force && step !== "archetype" && !state.archetypeId) {
    showToast("Choose an archetype first.");
    return;
  }
  if (!force && step === "calling" && mappings().length <= 1) {
    showToast("This archetype has one calling in the current campaign, so it is already selected.");
    return;
  }
  if (!force && step === "character" && mappings().length > 1 && !state.callingId) {
    showToast("Choose a calling before completing the character.");
    return;
  }
  state.step = step;
  state.confirmed = false;
  renderStep();
}

function renderStep() {
  const selectedMappings = mappings();
  elements.stepPanels.forEach((panel) => {
    const active = panel.dataset.step === state.step;
    panel.hidden = !active;
    panel.classList.toggle("is-active", active);
  });

  elements.stepTargets.forEach((button) => {
    const target = button.dataset.stepTarget;
    const active = target === state.step;
    const complete =
      (target === "archetype" && Boolean(state.archetypeId)) ||
      (target === "calling" && Boolean(state.callingId)) ||
      (target === "character" && state.confirmed);
    button.classList.toggle("is-active", active);
    button.classList.toggle("is-complete", complete && !active);
    if (active) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
    button.disabled = target === "calling" && Boolean(state.archetypeId) && selectedMappings.length <= 1;
  });

  if (!state.archetypeId) {
    elements.callingStepKicker.textContent = "In this campaign";
    elements.callingStepLabel.textContent = "Class";
  } else if (selectedMappings.length === 1) {
    elements.callingStepKicker.textContent = "Chosen automatically";
    elements.callingStepLabel.textContent = selectedMappings[0][1];
  } else {
    elements.callingStepKicker.textContent = `${selectedMappings.length} choices`;
    elements.callingStepLabel.textContent = state.callingId ? callingById()[1] : "Class";
  }

  const previous = previousStepFrom(state.step);
  elements.previousStep.disabled = !previous;

  if (state.step === "archetype") {
    elements.nextStep.textContent = "Continue";
    elements.nextStep.disabled = !state.archetypeId;
    elements.stepStatus.textContent = state.archetypeId
      ? selectedMappings.length === 1
        ? `${selectedMappings[0][1]} is the ${ARCHETYPES[state.archetypeId].name} class in ${campaign().name}.`
        : `${selectedMappings.length} ${campaign().genre} classes are available for ${ARCHETYPES[state.archetypeId].name}.`
      : "Choose an archetype to continue.";
  } else if (state.step === "calling") {
    elements.nextStep.textContent = "Continue";
    elements.nextStep.disabled = !state.callingId;
    elements.stepStatus.textContent = state.callingId
      ? `${callingById()[1]} selected.`
      : `Choose one ${campaign().genre} class.`;
  } else if (state.confirmed) {
    elements.nextStep.textContent = "Preview level-up";
    elements.nextStep.disabled = false;
    elements.stepStatus.textContent = "Character ready.";
  } else {
    elements.nextStep.textContent = "Create character";
    elements.nextStep.disabled = !(state.archetypeId && state.callingId && state.trainingId);
    elements.stepStatus.textContent = state.trainingId
      ? "Review the character sheet, then create the character."
      : "Choose one special training to finish.";
  }
}

function renderArchetypes() {
  const available = Object.entries(ARCHETYPES).filter(([id]) => mappings(id).length > 0);
  elements.archetypeOptions.innerHTML = available.map(([id, item]) => {
    const selected = state.archetypeId === id;
    const campaignMappings = mappings(id);
    const callingCopy = campaignMappings.length === 1
      ? `${campaignMappings[0][1]} in ${campaign().name}`
      : `${campaignMappings.length} classes in ${campaign().name}`;
    return `
      <button class="choice-card${selected ? " is-selected" : ""}" type="button" role="radio"
        aria-checked="${selected}" data-archetype-choice="${id}">
        <span class="choice-card-header">
          <span class="choice-sigil" aria-hidden="true">${item.sigil}</span>
          <span><strong>${item.name}</strong><small>${item.family}</small></span>
          <span class="radio-mark" aria-hidden="true"></span>
        </span>
        <span class="choice-description">${item.description}</span>
        <span class="mechanic-callout"><span>Signature play</span><strong>${item.loop}</strong></span>
        <span class="choice-meta"><span>${callingCopy}</span>${item.tags.map((tag) => `<span>${tag}</span>`).join("")}</span>
      </button>
    `;
  }).join("");
  elements.archetypeOptions.querySelectorAll("[data-archetype-choice]").forEach((button) => {
    button.addEventListener("click", () => selectArchetype(button.dataset.archetypeChoice));
    bindHelp(button, () => archetypeHelp(button.dataset.archetypeChoice));
  });
}

function selectArchetype(archetypeId) {
  const campaignMappings = mappings(archetypeId);
  state.archetypeId = archetypeId;
  state.callingId = campaignMappings.length === 1 ? campaignMappings[0][0] : null;
  state.confirmed = false;
  state.levelChoice = null;
  state.multiclassCallingId = null;
  if (state.trainingId && TRAINING[state.trainingId].blocked.includes(archetypeId)) {
    state.trainingId = null;
    showToast("That training is already part of this archetype, so choose a different training.");
  }
  renderAll();
}

function renderCallings() {
  const item = state.archetypeId ? ARCHETYPES[state.archetypeId] : null;
  const choices = mappings();
  elements.callingKicker.textContent = `Your path in ${campaign().name}`;
  elements.callingTitle.textContent = item ? `Choose an ${item.name} class` : "Choose a class";
  elements.callingHelp.textContent = item
    ? `Each choice follows the same ${item.name} progression. Choose how that path belongs in ${campaign().name}.`
    : "Choose an archetype first.";
  elements.callingContext.innerHTML = item
    ? `<span class="choice-sigil" aria-hidden="true">${item.sigil}</span><div><strong>${item.name}</strong><span>${escapeHtml(item.loop)}</span></div>`
    : "";
  elements.callingOptions.innerHTML = choices.map((entry) => {
    const [id, name, tagline, description, abilityNames] = entry;
    const selected = state.callingId === id;
    return `
      <button class="choice-card calling-card${selected ? " is-selected" : ""}" type="button" role="radio"
        aria-checked="${selected}" data-calling-choice="${id}">
        <span class="choice-card-header">
          <span class="choice-sigil" aria-hidden="true">${escapeHtml(name.slice(0, 2).toUpperCase())}</span>
          <span><strong>${escapeHtml(name)}</strong><small>${escapeHtml(tagline)}</small></span>
          <span class="radio-mark" aria-hidden="true"></span>
        </span>
        <span class="choice-description">${escapeHtml(description)}</span>
        <span class="calling-ability-preview">${abilityNames.map((ability) => `<span>${escapeHtml(ability)}</span>`).join("")}</span>
        <span class="same-path-note">Follows ${escapeHtml(item.name)} progression</span>
      </button>
    `;
  }).join("");
  elements.callingOptions.querySelectorAll("[data-calling-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      state.callingId = button.dataset.callingChoice;
      state.confirmed = false;
      renderAll();
    });
    bindHelp(button, () => {
      const selectedCalling = callingById(state.archetypeId, button.dataset.callingChoice);
      return archetypeHelp(state.archetypeId, selectedCalling);
    });
  });
}

function renderTraining() {
  elements.trainingOptions.innerHTML = Object.entries(TRAINING).map(([id, item]) => {
    const selected = state.trainingId === id;
    const blocked = state.archetypeId && item.blocked.includes(state.archetypeId);
    return `
      <button class="training-compact${selected ? " is-selected" : ""}" type="button" role="radio"
        aria-checked="${selected}" data-training-choice="${id}" ${blocked ? "disabled" : ""}>
        <span class="radio-mark" aria-hidden="true"></span>
        <span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(blocked ? "Already included in this archetype" : item.summary)}</small></span>
      </button>
    `;
  }).join("");
  elements.trainingOptions.querySelectorAll("[data-training-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      state.trainingId = button.dataset.trainingChoice;
      state.confirmed = false;
      renderAll();
      showHelp(trainingHelp(state.trainingId));
    });
    bindHelp(button, () => trainingHelp(button.dataset.trainingChoice));
  });
}

function renderStandingNote() {
  const currentStanding = standing();
  elements.standingNote.innerHTML = `
    <span aria-hidden="true">i</span>
    <div><strong>${escapeHtml(currentStanding[0])}</strong><p>${escapeHtml(currentStanding[1])}</p>
    ${currentStanding[2] ? `<small>${escapeHtml(currentStanding[2])}</small>` : ""}</div>
  `;
}

function initials(name) {
  return (name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("") || "?").toUpperCase();
}

function renderSummary() {
  const archetype = state.archetypeId ? ARCHETYPES[state.archetypeId] : null;
  const currentCalling = callingById();
  const training = state.trainingId ? TRAINING[state.trainingId] : null;
  const currentStanding = standing();
  const valid = Boolean(archetype && currentCalling && training);

  elements.summaryName.textContent = state.name.trim() || "Unnamed character";
  elements.summaryTitle.textContent = state.title.trim() || "Title not set";
  elements.portrait.textContent = initials(state.name);
  elements.summaryArchetype.textContent = archetype ? archetype.name : "Not selected";
  elements.summaryCalling.textContent = currentCalling ? currentCalling[1] : "Not selected";
  elements.summaryTraining.textContent = training ? training.name : "Not selected";
  elements.summaryStanding.textContent = currentStanding[0];
  elements.validity.textContent = valid ? "Ready" : "Incomplete";
  elements.validity.classList.toggle("is-valid", valid);

  elements.playstyle.textContent = archetype && currentCalling
    ? `As a ${currentCalling[1]}, ${archetype.loop.charAt(0).toLowerCase()}${archetype.loop.slice(1)}`
    : archetype
      ? archetype.loop
      : "Choose an archetype to see its signature play.";

  const strengths = [...new Set([...(archetype?.strengths || []), ...(training?.strengths || [])])];
  elements.strengths.innerHTML = strengths.length
    ? strengths.map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join("")
    : '<span class="empty-tag">None yet</span>';
}

function syncInputs() {
  elements.campaignSelect.value = state.campaignId;
  elements.nameInput.value = state.name;
  elements.titleInput.value = state.title;
  elements.backgroundInput.value = String(state.backgroundIndex);
  elements.standingInput.value = state.standingId;
}

function applyExample(exampleId) {
  if (exampleId === "battle-mage") {
    if (state.campaignId !== "crownfall") chooseCampaign("crownfall");
    if (typeof elements.battleMageDialog.showModal === "function") elements.battleMageDialog.showModal();
    else elements.battleMageDialog.setAttribute("open", "");
    return;
  }
  const [campaignId, archetypeId, callingId, trainingId, name, title, backgroundIndex, standingId] = EXAMPLES[exampleId];
  state.campaignId = campaignId;
  populateIdentityOptions();
  Object.assign(state, {
    archetypeId,
    callingId,
    trainingId,
    name,
    title,
    backgroundIndex,
    standingId,
    step: "character",
    confirmed: false,
    levelRoute: "continue",
    levelChoice: null,
    multiclassCallingId: null
  });
  populateIdentityOptions();
  syncInputs();
  renderAll();
  setView("creation");
  showToast(`${name} is ready to review.`);
  document.querySelector(".builder-panel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function chooseBattleMage(choice) {
  const base = {
    campaignId: "crownfall",
    name: "Corin Ash",
    title: "Battle Mage",
    backgroundIndex: 3,
    standingId: "none",
    confirmed: false,
    levelChoice: null,
    multiclassCallingId: null
  };
  if (choice === "spell-first") {
    Object.assign(state, base, { archetypeId: "arcanist", callingId: "wizard", trainingId: "martial", step: "character", levelRoute: "continue" });
  } else if (choice === "weapon-first") {
    Object.assign(state, base, { archetypeId: "vanguard", callingId: "fighter", trainingId: "arcane", step: "character", levelRoute: "continue" });
  } else {
    Object.assign(state, base, { archetypeId: "arcanist", callingId: "wizard", trainingId: "martial", step: "character", levelRoute: "multiclass", confirmed: true, multiclassCallingId: "fighter" });
  }
  elements.battleMageDialog.close();
  populateIdentityOptions();
  syncInputs();
  renderAll();
  if (choice === "full-hybrid") setView("progression");
  else setView("creation");
  showToast(choice === "full-hybrid" ? "The later Vanguard level and its delay are shown." : "Battle Mage path selected.");
}

function progressionContext() {
  let archetypeId = state.archetypeId;
  if (!archetypeId || mappings(archetypeId).length === 0) {
    archetypeId = Object.keys(ARCHETYPES).find((id) => mappings(id).length > 0);
  }
  const archetype = ARCHETYPES[archetypeId];
  const currentCalling = callingById(archetypeId, state.callingId) || mappings(archetypeId)[0];
  const training = state.trainingId ? TRAINING[state.trainingId] : TRAINING.command;
  const targetId = archetype.multiclassTarget;
  const target = ARCHETYPES[targetId];
  const targetCallings = mappings(targetId);
  if (state.levelRoute === "multiclass" && targetCallings.length === 1) {
    state.multiclassCallingId = targetCallings[0][0];
  }
  const targetCalling = targetCallings.find((entry) => entry[0] === state.multiclassCallingId) || null;
  return { archetypeId, archetype, currentCalling, training, targetId, target, targetCallings, targetCalling };
}

function developmentChoices(archetype, currentCalling, training) {
  const classChoices = archetype.levelUp.choices.map(([name, detail], index) => ({
    id: `path-${index}`,
    name: flavorText(name, currentCalling),
    detail: flavorText(detail, currentCalling),
    kind: currentCalling[1]
  }));
  classChoices.push({
    id: "deepen-training",
    name: `Deepen ${training.name}`,
    detail: `Improve the capability already granted by ${training.name}; this does not add another archetype.`,
    kind: "Training"
  });
  return classChoices;
}

function renderProgression() {
  const context = progressionContext();
  const { archetype, currentCalling, training, target, targetCallings, targetCalling } = context;
  const continuing = state.levelRoute === "continue";

  elements.levelCampaignKicker.textContent = `${campaign().name} · ${campaign().genre}`;
  elements.levelName.textContent = state.name.trim() || "Unnamed character";
  elements.levelCalling.textContent = `${currentCalling[1]} · ${archetype.name} archetype`;
  elements.levelCurrentBuild.textContent = `${currentCalling[1]} 3 · ${archetype.name}`;
  elements.continueRouteName.textContent = `${currentCalling[1]} 4`;
  elements.continueRouteCopy.textContent = `Gain the next ${archetype.name} tier and choose one development.`;
  elements.multiclassRouteName.textContent = `Begin ${target.name}`;
  elements.multiclassRouteCopy.textContent = targetCallings.length === 1
    ? `${targetCallings[0][1]} is the ${target.name} class in ${campaign().name}.`
    : `Choose one of ${targetCallings.length} ${campaign().genre} classes, then take its first level.`;

  elements.routeTargets.forEach((button) => {
    const active = button.dataset.levelRoute === state.levelRoute;
    button.classList.toggle("is-selected", active);
    button.setAttribute("aria-checked", String(active));
  });

  if (continuing) {
    elements.multiclassCallingSection.hidden = true;
    elements.developmentSection.hidden = false;
    elements.multiclassWarning.hidden = true;
    elements.automaticRouteLabel.textContent = `${currentCalling[1]} 3 → ${currentCalling[1]} 4`;
    const automatic = archetype.levelUp.automatic.map(([name, detail]) => [flavorText(name, currentCalling), flavorText(detail, currentCalling)]);
    renderGains(automatic);
    const choices = developmentChoices(archetype, currentCalling, training);
    elements.developmentOptions.innerHTML = choices.map((choice) => {
      const selected = state.levelChoice === choice.id;
      return `
        <button class="development-card${selected ? " is-selected" : ""}" type="button" role="radio"
          aria-checked="${selected}" data-development-choice="${choice.id}">
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
      const choice = choices.find((item) => item.id === button.dataset.developmentChoice);
      bindHelp(button, () => developmentHelp(choice, currentCalling, archetype));
    });
    elements.confirmLevel.disabled = !state.levelChoice;
    elements.levelStatus.textContent = state.levelChoice ? "Review the result, then confirm the level." : "Choose one development to continue.";
  } else {
    elements.multiclassCallingSection.hidden = targetCallings.length <= 1;
    elements.developmentSection.hidden = true;
    elements.multiclassWarning.hidden = false;
    elements.multiclassCallingTitle.textContent = `Choose a ${target.name} class`;
    renderMulticlassCallings(targetCallings, context.targetId);
    const selectedName = targetCalling ? targetCalling[1] : target.name;
    elements.automaticRouteLabel.textContent = `${currentCalling[1]} 3 → ${currentCalling[1]} 3 / ${selectedName} 1`;
    const entryNames = targetCalling ? targetCalling[4] : [`${target.name} resource`, `${target.name} action`, "Later mastery"];
    renderGains([
      [targetCalling ? `Begin ${selectedName}` : `Begin ${target.name}`, `Take level 1 in the ${target.name} archetype.`],
      [entryNames[0], `Gain the entry-level ${entryNames[0]} capacity and one basic ${entryNames[1]}.`]
    ]);
    const costs = archetype.multiclassCosts.map((item) => flavorText(item, currentCalling));
    elements.multiclassCostCopy.textContent = costs.join(" ");
    elements.confirmLevel.disabled = targetCallings.length > 1 && !targetCalling;
    elements.levelStatus.textContent = elements.confirmLevel.disabled
      ? `Choose the ${target.name} class for ${campaign().name}.`
      : "Review what the current path delays, then confirm the level.";
  }
  renderLevelSummary(context);
}

function renderGains(gains) {
  elements.automaticGains.innerHTML = gains.map(([name, detail]) => `
    <div class="gain-card"><span class="gain-icon" aria-hidden="true">+</span><div>
      <strong>${escapeHtml(name)}</strong><span>${escapeHtml(detail)}</span>
    </div></div>
  `).join("");
}

function renderMulticlassCallings(callings, targetArchetypeId) {
  elements.multiclassCallingOptions.innerHTML = callings.map((entry) => {
    const selected = state.multiclassCallingId === entry[0];
    return `
      <button class="mini-calling${selected ? " is-selected" : ""}" type="button" role="radio"
        aria-checked="${selected}" data-multiclass-calling="${entry[0]}">
        <span class="radio-mark" aria-hidden="true"></span>
        <span><strong>${escapeHtml(entry[1])}</strong><small>${escapeHtml(entry[2])}</small></span>
      </button>
    `;
  }).join("");
  elements.multiclassCallingOptions.querySelectorAll("[data-multiclass-calling]").forEach((button) => {
    button.addEventListener("click", () => {
      state.multiclassCallingId = button.dataset.multiclassCalling;
      renderProgression();
    });
    bindHelp(button, () => {
      const selectedClass = callings.find((entry) => entry[0] === button.dataset.multiclassCalling);
      return archetypeHelp(targetArchetypeId, selectedClass);
    });
  });
}

function renderLevelSummary(context) {
  const { archetype, currentCalling, training, target, targetCallings, targetCalling } = context;
  const continuing = state.levelRoute === "continue";
  let gains;
  let costs;
  if (continuing) {
    const choices = developmentChoices(archetype, currentCalling, training);
    const choice = choices.find((item) => item.id === state.levelChoice);
    gains = [
      ...archetype.levelUp.automatic.map(([name]) => flavorText(name, currentCalling)),
      choice ? choice.name : "One development still required"
    ];
    costs = ["Uses this level’s one development choice", `Does not begin a second archetype`];
  } else {
    gains = [`${target.name} level 1`, targetCalling ? `${targetCalling[1]} class` : `A ${target.name} class still required`];
    costs = archetype.multiclassCosts.map((item) => flavorText(item, currentCalling));
  }
  elements.levelGains.innerHTML = gains.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  elements.levelCosts.innerHTML = costs.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function renderCampaignText() {
  elements.campaignKicker.textContent = `${campaign().name} · ${campaign().genre}`;
  elements.pathSummary.textContent = `${campaign().name} supplies the classes and standings shown here.`;
}

function renderAll() {
  renderCampaignText();
  renderArchetypes();
  renderCallings();
  renderTraining();
  renderStandingNote();
  renderSummary();
  renderStep();
  renderProgression();
  refreshHelp();
}

function resetCharacter() {
  Object.assign(state, {
    step: "archetype",
    archetypeId: null,
    callingId: null,
    trainingId: null,
    name: "Mara Vale",
    title: "",
    backgroundIndex: 0,
    standingId: Object.keys(campaign().standings)[0],
    confirmed: false,
    levelRoute: "continue",
    levelChoice: null,
    multiclassCallingId: null
  });
  populateIdentityOptions();
  syncInputs();
  renderAll();
  setView("creation");
  showToast("Character choices cleared.");
}

elements.campaignSelect.addEventListener("change", () => chooseCampaign(elements.campaignSelect.value));
elements.viewTargets.forEach((button) => button.addEventListener("click", () => setView(button.dataset.viewTarget)));
elements.stepTargets.forEach((button) => button.addEventListener("click", () => setStep(button.dataset.stepTarget)));
elements.previousStep.addEventListener("click", () => {
  const previous = previousStepFrom(state.step);
  if (previous) setStep(previous, true);
});
elements.nextStep.addEventListener("click", () => {
  const next = nextStepFrom(state.step);
  if (next) {
    setStep(next);
    return;
  }
  if (!state.confirmed) {
    state.confirmed = true;
    renderStep();
    showToast(`${state.name.trim() || "Character"} is ready.`);
  } else {
    setView("progression");
  }
});
document.querySelectorAll("[data-example]").forEach((button) => {
  button.addEventListener("click", () => applyExample(button.dataset.example));
});
document.querySelectorAll("[data-battle-mage-choice]").forEach((button) => {
  button.addEventListener("click", () => chooseBattleMage(button.dataset.battleMageChoice));
});
elements.nameInput.addEventListener("input", () => {
  state.name = elements.nameInput.value;
  state.confirmed = false;
  renderSummary();
  renderStep();
});
bindHelp(elements.nameInput, identityHelp);
elements.titleInput.addEventListener("input", () => {
  state.title = elements.titleInput.value;
  state.confirmed = false;
  renderSummary();
  renderStep();
});
bindHelp(elements.titleInput, identityHelp);
elements.backgroundInput.addEventListener("change", () => {
  state.backgroundIndex = Number(elements.backgroundInput.value);
  state.confirmed = false;
  renderStep();
  showHelp(backgroundHelp());
});
bindHelp(elements.backgroundInput, backgroundHelp);
elements.standingInput.addEventListener("change", () => {
  state.standingId = elements.standingInput.value;
  state.confirmed = false;
  renderStandingNote();
  renderSummary();
  renderStep();
  showHelp(standingHelp());
});
bindHelp(elements.standingInput, () => standingHelp());
elements.routeTargets.forEach((button) => {
  button.addEventListener("click", () => {
    state.levelRoute = button.dataset.levelRoute;
    state.levelChoice = null;
    state.multiclassCallingId = null;
    renderProgression();
    refreshHelp();
  });
  bindHelp(button, () => routeHelp(button.dataset.levelRoute));
});
elements.confirmLevel.addEventListener("click", () => showToast("Level choice confirmed."));
document.querySelector("#reset-character").addEventListener("click", resetCharacter);
elements.helpPin.addEventListener("click", () => {
  helpPinned = !helpPinned;
  elements.helpPin.setAttribute("aria-pressed", String(helpPinned));
  elements.helpPin.classList.toggle("is-pinned", helpPinned);
  elements.helpPinLabel.textContent = helpPinned ? "Pinned" : "Pin";
  if (!helpPinned) refreshHelp();
});
elements.mobileHelpToggle.addEventListener("click", openMobileHelp);
elements.helpClose.addEventListener("click", () => closeMobileHelp(true));
elements.helpBackdrop.addEventListener("click", () => closeMobileHelp(false));
document.addEventListener("keydown", (event) => {
  if (!elements.contextHelp.classList.contains("is-mobile-open")) return;
  if (event.key === "Escape") {
    closeMobileHelp(true);
    return;
  }
  if (event.key === "Tab") {
    const firstControl = elements.helpPin;
    const lastControl = elements.helpClose;
    if (event.shiftKey && document.activeElement === firstControl) {
      event.preventDefault();
      lastControl.focus();
    } else if (!event.shiftKey && document.activeElement === lastControl) {
      event.preventDefault();
      firstControl.focus();
    }
  }
});
mobileHelpQuery.addEventListener("change", (event) => {
  if (!event.matches && elements.contextHelp.classList.contains("is-mobile-open")) {
    closeMobileHelp(false);
  }
});

populateCampaignPicker();
populateIdentityOptions();
syncInputs();
renderAll();
