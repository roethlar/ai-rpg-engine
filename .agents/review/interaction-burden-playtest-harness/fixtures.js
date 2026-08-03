(() => {
  "use strict";

  const deepFreeze = (value) => {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      for (const child of Object.values(value)) deepFreeze(child);
      Object.freeze(value);
    }
    return value;
  };

  const fixtures = {
    schemaVersion: 1,
    harnessVersion: "0.1.0",
    fixtureVersion: "armsmaster-adept-pilot-v1",
    sources: {
      plan: "b55b7ba:.agents/review/interaction-burden-playtest-plan.md",
      collapsePrototype:
        "048c828:.agents/review/archetype-collapse-prototypes.md#6.3-6.7",
      frozenRules:
        "048c828:.agents/review/rules-system-variants.md#3.2-3.3",
      resolution: "docs/rules/resolution.md:owner-signed-2026-07-16-amended-2026-07-27",
      effects: "docs/rules/effects.md:owner-signed-r24-2026-07-27"
    },
    enums: {
      actionKinds: ["ordinary", "form", "technique", "scenario"],
      actionCosts: ["main"],
      automationCategories: ["bookkeeping", "tactical_choice"],
      bands: [
        "crit_success",
        "marginal_success",
        "clean_success",
        "crit_failure",
        "marginal_failure",
        "clean_failure"
      ],
      harm: ["light", "standard", "heavy"],
      stages: ["opening", "flow", "finishing"],
      eventTypes: [
        "session_start",
        "run_start",
        "beat_ready",
        "visibility_change",
        "help_open",
        "help_close",
        "locked_action_attempt",
        "action_select",
        "action_clear",
        "target_select",
        "target_clear",
        "intent_submit",
        "required_prompt",
        "prompt_answer",
        "automation",
        "result_commit",
        "beat_complete",
        "operator_reminder",
        "run_complete",
        "survey_answer",
        "session_complete",
        "export"
      ],
      surveyAnswers: {
        meaningful: ["first", "second", "same", "unclear"],
        dictated: ["first", "second", "both", "neither"],
        rechecking: ["first", "second", "both", "neither"],
        enjoyable: ["first", "second", "same", "neither"],
        campaignChoice: ["first", "second", "either", "neither"]
      }
    },
    shared: {
      character: {
        id: "pc.test.martial",
        displayName: "Rowan",
        pronouns: {
          subject: "they",
          object: "them",
          possessive: "their"
        },
        description: "A seasoned spear fighter.",
        level: 1,
        healthBand: "hardy",
        might: 0,
        skillBonus: 20,
        maxHp: 24,
        startingHp: 24,
        defenses: {
          guard: "standard",
          reflex: "standard",
          resolve: "standard"
        },
        armor: "unarmored",
        shield: false,
        weapon: {
          id: "item.training-spear",
          label: "Training spear",
          group: "one-handed-martial",
          ordinaryHarm: "standard"
        }
      },
      actionEconomy: {
        main: 1,
        move: 1,
        reaction: 1,
        pilotPromptsForMove: false
      },
      resource: null,
      check: {
        die: "d100",
        meetOrBeat: true,
        marginWidth: 5,
        tierTargets: {
          trivial: 10,
          easy: 25,
          standard: 50,
          hard: 75,
          extreme: 90,
          legendary: 98
        },
        player: {
          tier: "standard",
          skillBonus: 20,
          netDelta: 0,
          target: 30
        },
        opponent: {
          baselineTier: "standard",
          guardedTier: "hard",
          skillBonus: 25,
          netDelta: 0,
          baselineTarget: 25,
          guardedTarget: 50
        }
      },
      harmValues: {
        light: 4,
        standard: 5,
        heavy: 7
      },
      rangeLine: ["engaged", "near", "far"],
      conditionSemantics: {
        hindered: {
          duration: "scene",
          means: "Movement or action is impaired; the actor still acts.",
          mustNotAssert: ["incapacity", "paralysis", "unconsciousness"],
          fixtureConsequence:
            "The beat-3 escape requires an unimpaired sprint, so a hindered blocker cannot complete it."
        }
      },
      ordinaryActions: [
        {
          id: "ordinary.standard-attack",
          kind: "ordinary",
          label: "Standard attack",
          summary: "Attack with the training spear without using the class mechanic.",
          cost: "main",
          requiresCheck: true,
          targetIds: ["npc.sparring-partner", "npc.blocker"],
          payload: {
            harm: "standard",
            reposition: null,
            condition: null,
            objectiveEffect: null
          }
        },
        {
          id: "scene.protect-ally",
          kind: "scenario",
          label: "Protect the ally",
          summary: "Spend the Main helping the ally out of the immediate hazard.",
          cost: "main",
          requiresCheck: true,
          targetIds: ["npc.ally"],
          payload: {
            harm: null,
            reposition: null,
            condition: null,
            objectiveEffect: "clear_ally_threat_on_success"
          }
        },
        {
          id: "scene.extract-ally",
          kind: "scenario",
          label: "Extract the ally",
          summary: "Spend the Main completing the rescue instead of attacking.",
          cost: "main",
          requiresCheck: true,
          targetIds: ["npc.ally"],
          payload: {
            harm: null,
            reposition: null,
            condition: null,
            objectiveEffect: "complete_rescue_on_success"
          }
        }
      ],
      scenarios: [
        {
          id: "stable-duel",
          label: "Stable duel",
          objective: "Pressure the opponent while limiting incoming harm.",
          startingState: {
            playerHp: 24,
            playerPosition: "engaged",
            opponentPosition: "engaged",
            playerHarmDealt: 0,
            opponentHasDefeatThreshold: false
          },
          entities: [
            {
              id: "npc.sparring-partner",
              label: "Sparring partner",
              kind: "opposition"
            }
          ],
          beats: [
            {
              id: "stable.1",
              number: 1,
              prompt: "The sparring partner holds steady at spear length.",
              resultId: "stable.1",
              legalOrdinaryActionIds: ["ordinary.standard-attack"],
              legalTargetIds: ["npc.sparring-partner"],
              opponentResponseId: "stable.enemy.1",
              objectiveRule: "record_harm_only"
            },
            {
              id: "stable.2",
              number: 2,
              prompt: "Nothing in the terrain changes; the same exchange continues.",
              resultId: "stable.2",
              legalOrdinaryActionIds: ["ordinary.standard-attack"],
              legalTargetIds: ["npc.sparring-partner"],
              opponentResponseId: "stable.enemy.2",
              objectiveRule: "record_harm_only"
            },
            {
              id: "stable.3",
              number: 3,
              prompt: "The opponent remains engaged without revealing a special weakness.",
              resultId: "stable.3",
              legalOrdinaryActionIds: ["ordinary.standard-attack"],
              legalTargetIds: ["npc.sparring-partner"],
              opponentResponseId: "stable.enemy.3",
              objectiveRule: "record_harm_only"
            },
            {
              id: "stable.4",
              number: 4,
              prompt: "The final exchange begins under the same conditions.",
              resultId: "stable.4",
              legalOrdinaryActionIds: ["ordinary.standard-attack"],
              legalTargetIds: ["npc.sparring-partner"],
              opponentResponseId: "stable.enemy.4",
              objectiveRule: "record_harm_only"
            }
          ]
        },
        {
          id: "moving-rescue",
          label: "Moving rescue",
          objective: "Open the route, protect the ally, contain the blocker, and complete the rescue.",
          startingState: {
            playerHp: 24,
            playerPosition: "engaged",
            blockerPosition: "engaged",
            allyPosition: "near",
            routeOpen: false,
            allyThreatened: false,
            blockerEscaped: false,
            blockerFollowed: false,
            rescueComplete: false
          },
          entities: [
            {
              id: "npc.blocker",
              label: "Blocker",
              kind: "opposition"
            },
            {
              id: "npc.ally",
              label: "Endangered ally",
              kind: "ally"
            }
          ],
          beats: [
            {
              id: "rescue.1",
              number: 1,
              prompt: "A blocker holds the narrow route to the stranded ally.",
              resultId: "rescue.1",
              legalOrdinaryActionIds: ["ordinary.standard-attack"],
              legalTargetIds: ["npc.blocker"],
              opponentResponseId: null,
              objectiveRule: "reposition_success_opens_route"
            },
            {
              id: "rescue.2",
              number: 2,
              prompt: "The ally is pulled toward the hazard while the blocker remains in play.",
              resultId: "rescue.2",
              legalOrdinaryActionIds: [
                "ordinary.standard-attack",
                "scene.protect-ally"
              ],
              legalTargetIds: ["npc.blocker", "npc.ally"],
              opponentResponseId: null,
              objectiveRule: "only_protect_action_clears_threat_on_success"
            },
            {
              id: "rescue.3",
              number: 3,
              prompt: "The blocker turns toward a narrow escape and prepares to run.",
              resultId: "rescue.3",
              legalOrdinaryActionIds: ["ordinary.standard-attack"],
              legalTargetIds: ["npc.blocker"],
              opponentResponseId: "rescue.blocker-flee",
              objectiveRule: "hinder_reposition_or_pursue_resolves_flee"
            },
            {
              id: "rescue.4",
              number: 4,
              prompt: "The rescue now requires Rowan's full attention before the hazard closes.",
              resultId: "rescue.4",
              legalOrdinaryActionIds: [
                "ordinary.standard-attack",
                "scene.extract-ally"
              ],
              legalTargetIds: ["npc.blocker", "npc.ally"],
              opponentResponseId: null,
              objectiveRule: "only_extract_action_completes_rescue_on_success"
            }
          ]
        }
      ],
      resultTapes: {
        player: [
          {
            id: "stable.1",
            raw: 62,
            target: 30,
            expectedBand: "clean_success"
          },
          {
            id: "stable.2",
            raw: 18,
            target: 30,
            expectedBand: "clean_failure"
          },
          {
            id: "stable.3",
            raw: 74,
            target: 30,
            expectedBand: "clean_success"
          },
          {
            id: "stable.4",
            raw: 81,
            target: 30,
            expectedBand: "clean_success"
          },
          {
            id: "rescue.1",
            raw: 67,
            target: 30,
            expectedBand: "clean_success"
          },
          {
            id: "rescue.2",
            raw: 18,
            target: 30,
            expectedBand: "clean_failure"
          },
          {
            id: "rescue.3",
            raw: 76,
            target: 30,
            expectedBand: "clean_success"
          },
          {
            id: "rescue.4",
            raw: 84,
            target: 30,
            expectedBand: "clean_success"
          }
        ],
        stableOpponent: [
          {
            id: "stable.enemy.1",
            raw: 60,
            baselineTarget: 25,
            guardedTarget: 50
          },
          {
            id: "stable.enemy.2",
            raw: 40,
            baselineTarget: 25,
            guardedTarget: 50
          },
          {
            id: "stable.enemy.3",
            raw: 60,
            baselineTarget: 25,
            guardedTarget: 50
          },
          {
            id: "stable.enemy.4",
            raw: 40,
            baselineTarget: 25,
            guardedTarget: 50
          }
        ]
      }
    },
    variants: [
      {
        id: "free-forms",
        revealLabel: "Free Forms",
        summary:
          "Choose any known Form for the current exchange; its Counter is armed automatically.",
        stateKind: "form",
        initialState: {
          activeForm: null,
          armedCounter: null,
          guardShift: null,
          reactionAvailable: true
        },
        ordinaryMainTransition: {
          activeForm: "preserve",
          armedCounter: null,
          guardShift: null
        },
        actions: [
          {
            id: "form.pressing",
            kind: "form",
            label: "Pressing Form",
            summary: "Deal Standard harm and arm Pursue.",
            cost: "main",
            legalStages: ["any"],
            restartFromAny: false,
            targetIds: ["npc.sparring-partner", "npc.blocker"],
            advanceOn: ["success", "failure"],
            payload: {
              harm: "standard",
              reposition: null,
              condition: null,
              guardShift: null
            },
            transition: {
              activeForm: "pressing",
              nextStage: null,
              armedCounter: "pursue"
            }
          },
          {
            id: "form.driving",
            kind: "form",
            label: "Driving Form",
            summary: "Deal Light harm and reposition self or target one step on success.",
            cost: "main",
            legalStages: ["any"],
            restartFromAny: false,
            targetIds: [
              "pc.test.martial",
              "npc.sparring-partner",
              "npc.blocker"
            ],
            advanceOn: ["success", "failure"],
            payload: {
              harm: "light",
              reposition: {
                who: "self_or_target",
                steps: 1,
                on: "success"
              },
              condition: null,
              guardShift: null
            },
            transition: {
              activeForm: "driving",
              nextStage: null,
              armedCounter: null
            }
          },
          {
            id: "form.guarding",
            kind: "form",
            label: "Guarding Form",
            summary: "Deal Light harm and arm Deflect.",
            cost: "main",
            legalStages: ["any"],
            restartFromAny: false,
            targetIds: ["npc.sparring-partner", "npc.blocker"],
            advanceOn: ["success", "failure"],
            payload: {
              harm: "light",
              reposition: null,
              condition: null,
              guardShift: null
            },
            transition: {
              activeForm: "guarding",
              nextStage: null,
              armedCounter: "deflect"
            }
          }
        ]
      },
      {
        id: "linked-techniques",
        revealLabel: "Linked Techniques",
        summary:
          "Choose a legal technique at the current opening, flow, or finishing stage.",
        stateKind: "stage",
        initialState: {
          stage: "opening",
          armedCounter: null,
          guardShift: null,
          reactionAvailable: true
        },
        ordinaryMainTransition: {
          stage: "opening",
          armedCounter: null,
          guardShift: null
        },
        actions: [
          {
            id: "technique.closing-step",
            kind: "technique",
            label: "Closing Step",
            summary: "Deal Light harm, step once, and enter flow.",
            cost: "main",
            legalStages: ["opening"],
            restartFromAny: true,
            targetIds: ["npc.sparring-partner", "npc.blocker"],
            advanceOn: ["success", "failure"],
            payload: {
              harm: "light",
              reposition: {
                who: "self",
                steps: 1,
                on: "always"
              },
              condition: null,
              guardShift: null
            },
            transition: {
              activeForm: null,
              nextStage: "flow",
              armedCounter: null
            }
          },
          {
            id: "technique.set-root",
            kind: "technique",
            label: "Set the Root",
            summary: "Deal Light harm, gain minor guard, and enter flow.",
            cost: "main",
            legalStages: ["opening"],
            restartFromAny: true,
            targetIds: ["npc.sparring-partner", "npc.blocker"],
            advanceOn: ["success", "failure"],
            payload: {
              harm: "light",
              reposition: null,
              condition: null,
              guardShift: {
                defense: "guard",
                tiersHarder: 1,
                expires: "before_next_beat"
              }
            },
            transition: {
              activeForm: null,
              nextStage: "flow",
              armedCounter: null
            }
          },
          {
            id: "technique.turning-drive",
            kind: "technique",
            label: "Turning Drive",
            summary: "Deal Light harm, reposition the target on success, and enter finishing.",
            cost: "main",
            legalStages: ["flow"],
            restartFromAny: false,
            targetIds: ["npc.sparring-partner", "npc.blocker"],
            advanceOn: ["success", "failure"],
            payload: {
              harm: "light",
              reposition: {
                who: "target",
                steps: 1,
                on: "success"
              },
              condition: null,
              guardShift: null
            },
            transition: {
              activeForm: null,
              nextStage: "finishing",
              armedCounter: null
            }
          },
          {
            id: "technique.catching-guard",
            kind: "technique",
            label: "Catching Guard",
            summary: "Deal Light harm, arm Deflect, and enter finishing.",
            cost: "main",
            legalStages: ["flow"],
            restartFromAny: false,
            targetIds: ["npc.sparring-partner", "npc.blocker"],
            advanceOn: ["success", "failure"],
            payload: {
              harm: "light",
              reposition: null,
              condition: null,
              guardShift: null
            },
            transition: {
              activeForm: null,
              nextStage: "finishing",
              armedCounter: "deflect"
            }
          },
          {
            id: "technique.break-line",
            kind: "technique",
            label: "Break the Line",
            summary: "Deal Heavy harm, Hinder on success, and return to opening.",
            cost: "main",
            legalStages: ["finishing"],
            restartFromAny: false,
            targetIds: ["npc.sparring-partner", "npc.blocker"],
            advanceOn: ["success", "failure"],
            payload: {
              harm: "heavy",
              reposition: null,
              condition: {
                token: "hindered",
                duration: "scene",
                on: "success"
              },
              guardShift: null
            },
            transition: {
              activeForm: null,
              nextStage: "opening",
              armedCounter: null
            }
          },
          {
            id: "technique.return-force",
            kind: "technique",
            label: "Return the Force",
            summary: "Deal Heavy harm, reposition the target on success, and return to opening.",
            cost: "main",
            legalStages: ["finishing"],
            restartFromAny: false,
            targetIds: ["npc.sparring-partner", "npc.blocker"],
            advanceOn: ["success", "failure"],
            payload: {
              harm: "heavy",
              reposition: {
                who: "target",
                steps: 1,
                on: "success"
              },
              condition: null,
              guardShift: null
            },
            transition: {
              activeForm: null,
              nextStage: "opening",
              armedCounter: null
            }
          }
        ]
      }
    ],
    schedules: [
      {
        id: "schedule-0",
        order: [
          {
            scenarioId: "stable-duel",
            variantSlot: "A"
          },
          {
            scenarioId: "stable-duel",
            variantSlot: "B"
          },
          {
            scenarioId: "moving-rescue",
            variantSlot: "B"
          },
          {
            scenarioId: "moving-rescue",
            variantSlot: "A"
          }
        ]
      },
      {
        id: "schedule-1",
        order: [
          {
            scenarioId: "stable-duel",
            variantSlot: "B"
          },
          {
            scenarioId: "stable-duel",
            variantSlot: "A"
          },
          {
            scenarioId: "moving-rescue",
            variantSlot: "A"
          },
          {
            scenarioId: "moving-rescue",
            variantSlot: "B"
          }
        ]
      }
    ],
    survey: [
      {
        id: "meaningful",
        prompt: "Which run produced more meaningfully different choices?",
        answers: ["first", "second", "same", "unclear"]
      },
      {
        id: "dictated",
        prompt: "Which run most often made the next move feel dictated?",
        answers: ["first", "second", "both", "neither"]
      },
      {
        id: "rechecking",
        prompt: "Which run's state required more re-checking?",
        answers: ["first", "second", "both", "neither"]
      },
      {
        id: "enjoyable",
        prompt: "Which run was more enjoyable?",
        answers: ["first", "second", "same", "neither"]
      },
      {
        id: "campaignChoice",
        prompt: "Which would you choose for this character in a campaign?",
        answers: ["first", "second", "either", "neither"]
      }
    ]
  };

  globalThis.INTERACTION_BURDEN_FIXTURES = deepFreeze(fixtures);
})();
