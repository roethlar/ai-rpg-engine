import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createClassSheet, createRulesWorld } from './class-state.js';
import { CATALOG_OPTION_SET, CATALOG_VERSION } from './class-catalog.js';
import { buildClassScenario, validateClassSceneFrame, CLASS_SCENE_CONTRACT, NPC_PROFILES, NPC_PROFILE_VERSION } from './class-scenario.js';
import { evaluateEffects } from './rules-effects.js';

function fixture() {
  const location = { id: 4, layout: {
    name: 'Gatehouse', areas: [{ id: 'gate', name: 'Gate' }, { id: 'yard', name: 'Courtyard' }],
    exits: [{ from: 'gate', to: 'yard' }], features: [
      { name: 'Gate lock', area: 'gate', kind: 'device' },
      { name: 'Supply crates', area: 'yard', kind: 'furniture' },
      { name: 'Carved marker', area: 'gate', kind: 'landmark' }
    ]
  } };
  let sequence = 0;
  const selection = { familyId: 'armsmaster', branchId: 'armsmaster.discipline',
    catalogVersion: CATALOG_VERSION, optionSet: CATALOG_OPTION_SET, modules: [], capabilities: { rider: false, alliedActors: false } };
  const hero = { id: 10, ...createClassSheet(selection, { name: 'Mira', idFactory: () => `owned-${++sequence}` }) };
  const world = createRulesWorld({ location, characters: [hero], npcs: [
    { id: 20, name: 'Guard', area: 'gate' }, { id: 21, name: 'Archer', area: 'yard' }, { id: 22, name: 'Medic', area: 'gate' }
  ] });
  const actorBindings = { hero: 'character:10', guard: 'npc:20', archer: 'npc:21', medic: 'npc:22' };
  const frame = {
    schemaVersion: 1,
    areas: [
      { area: 'gate', terrain: 'dry_ground', traits: ['visible', 'safe', 'visited', 'focus', 'anchor'], surfaces: ['ground', 'wall'] },
      { area: 'yard', terrain: 'dry_ground', traits: ['visible', 'safe', 'space_for_wings'], surfaces: ['ground'] }
    ],
    actors: [
      { actor: 'hero', area: 'gate', allegiance: 'party', profile: null, conditions: [] },
      { actor: 'guard', area: 'gate', allegiance: 'opposition', profile: 'combatant', conditions: [{ kind: 'hindered', duration: 'scene', detail: 'Foot caught in debris.' }] },
      { actor: 'archer', area: 'yard', allegiance: 'opposition', profile: 'ranged', conditions: [] },
      { actor: 'medic', area: 'gate', allegiance: 'party', profile: 'support', conditions: [] }
    ],
    items: [
      { key: 'saber', name: 'Plain saber', description: 'A removable steel saber.', kind: 'melee_weapon', holder: { kind: 'actor', key: 'guard' }, wielded: true, condition: 'pristine' },
      { key: 'bow', name: 'Short bow', description: 'A wooden bow.', kind: 'ranged_weapon', holder: { kind: 'actor', key: 'archer' }, wielded: true, condition: 'worn' },
      { key: 'catalyst', name: 'Recall catalyst', description: 'One authored revival material.', kind: 'revival_catalyst', holder: { kind: 'actor', key: 'hero' }, wielded: false, condition: 'pristine' }
    ],
    objects: [
      { key: 'lock', name: 'Gate lock', area: 'gate', kind: 'lock', security: 'ordinary', opposed: false, locked: true, mapFeature: 0 },
      { key: 'marker', name: 'Carved marker', area: 'gate', kind: 'scenery', security: 'ordinary', opposed: false, locked: false, mapFeature: 2 },
      { key: 'seal', name: 'Protected seal', area: 'gate', kind: 'lock', security: 'protected', opposed: false, locked: true },
      { key: 'lever', name: 'Winch lever', area: 'yard', kind: 'mechanism', security: 'ordinary', opposed: false, locked: false }
    ],
    features: [
      { key: 'crates', name: 'Supply crates', area: 'yard', kind: 'cover', duration: 'persistent', worksAgainst: 'both', origin: 'mundane', mapFeature: 1 },
      { key: 'smoke', name: 'Drifting smoke', area: 'gate', kind: 'smoke', duration: 'scene', worksAgainst: 'opposition' }
    ],
    discoveries: CLASS_SCENE_CONTRACT.tokens.revealScopes.map((scope, index) => ({ key: `fact-${index}`, scope,
      subject: { kind: index < 5 ? 'actor' : index === 5 ? 'object' : 'area', key: index < 5 ? 'guard' : index === 5 ? 'lock' : 'yard' },
      fact: `Recorded ${scope.replaceAll('_', ' ')} fact in the gatehouse.` })),
    encounter: { active: true, opposition: ['guard', 'archer'] }
  };
  return { world, location, frame, actorBindings, turn: 1 };
}

const invalid = error => error.code === 'CLASS_SCENE_INVALID';

export function runClassScenarioTests() {
  console.log(' - Running strict class scene authoring tests...');
  const input = fixture();
  const before = structuredClone(input);
  const result = buildClassScenario(input);
  assert.deepEqual(input, before, 'Scene authoring must not mutate source state or the model frame.');
  assert.deepEqual(buildClassScenario(input), result, 'The same bound frame produces stable typed records.');
  const { world, refs } = result;
  assert.equal(refs.items.saber, 'item:scene:4:saber');
  assert.equal(refs.objects.lock, 'object:scene:4:lock');
  assert.equal(refs.features.crates, 'feature:scene:4:crates');
  assert.deepEqual(world.encounter.participants, ['npc:20', 'npc:21']);
  assert.equal(world.actors['npc:22'].party, true);
  assert.equal(world.actors['npc:22'].willingTravel, undefined, 'Party allegiance cannot grant travel consent.');
  assert.equal(world.actors['character:10'].health, input.world.actors['character:10'].health);
  assert.deepEqual(world.actors['character:10'].skills, input.world.actors['character:10'].skills);
  assert.equal(world.actors['npc:20'].npcKit.version, NPC_PROFILE_VERSION);
  assert.equal(world.actors['npc:20'].npcKit.mainActions, 1);
  assert.equal(world.actors['npc:20'].conditions.hindered.actor, 'npc:20');
  assert.equal(world.actors['npc:20'].conditions.hindered.class, 'hindrance');
  assert.equal(world.areas['area:4:yard'].visited, false, 'No inherited blanket visited permission.');
  assert.equal(world.areas['area:4:yard'].focus, false, 'No inferred ritual focus.');
  assert.equal(world.areas['area:4:yard'].anchor, false, 'No inferred grapple anchor.');
  assert.equal(world.areas['area:4:yard'].spaceForWings, true);
  assert.equal(world.areas['area:4:yard'].safeToOccupy, true);
  assert.equal(world.areas['area:4:yard'].safeRecovery, false, 'Safe occupancy cannot grant recovery permission.');
  assert.equal(world.areas['area:4:yard'].immediateThreat, false);
  assert.deepEqual(world.areas['area:4:gate'].adjacent, ['yard']);
  assert.equal(world.features[refs.features.crates].area, 'area:4:yard');
  assert.equal(world.features[refs.features.crates].origin, 'mundane');
  assert.equal(world.features[refs.features.smoke].origin, 'unknown');
  const magicalCover = fixture();
  magicalCover.frame.features[0].origin = 'magical';
  assert.equal(buildClassScenario(magicalCover).world.features[refs.features.crates].origin, 'magical');
  delete magicalCover.frame.features[0].origin;
  magicalCover.frame.features[0].name = 'Magical ward';
  magicalCover.location.layout.features[1].name = 'Magical ward';
  assert.equal(buildClassScenario(magicalCover).world.features[refs.features.crates].origin, 'unknown', 'Names and cover kind cannot imply magical or mundane origin.');
  assert.equal(world.objects[refs.objects.marker].kind, 'scenery', 'Noncombat map features remain recorded objects.');
  assert.equal(world.objects[refs.objects.seal].protectedSystem, true);
  assert.equal(world.items[refs.items.saber].weapon, true);
  assert.equal(world.items[refs.items.saber].weaponCategory, 'simple');
  assert.equal(world.items[refs.items.bow].weaponCategory, 'ranged');
  const categoryFixture = fixture();
  categoryFixture.frame.items[0].weaponCategory = 'martial';
  assert.equal(buildClassScenario(categoryFixture).world.items[refs.items.saber].weaponCategory, 'martial');
  delete categoryFixture.frame.items[0].weaponCategory;
  categoryFixture.frame.items[0].name = 'Heavy Martial Weapon';
  assert.equal(buildClassScenario(categoryFixture).world.items[refs.items.saber].weaponCategory, 'simple', 'Display text cannot change the pinned category default.');
  assert.equal(world.items[refs.items.saber].natural, false);
  assert.equal(world.items[refs.items.saber].fixed, false);
  assert.equal(world.items[refs.items.catalyst].kind, 'revival-catalyst');
  const fallenFixture = fixture();
  fallenFixture.turn = 5;
  fallenFixture.frame.actors[3].fallen = { age: 'recent', body: 'intact', returnChoice: 'willing' };
  const fallenWorld = buildClassScenario(fallenFixture).world;
  const fallen = fallenWorld.actors['npc:22'];
  assert.equal(fallen.health, 0);
  assert.equal(fallen.status, 'dead');
  assert.equal(fallen.deathTurn, 5, 'Only the engine scene turn establishes a recent death.');
  assert.equal(fallen.intactBody, true);
  assert.equal(fallen.willingReturn, true);
  const revive = { op: 'revive', who: 'npc:22', health: 1, maximumElapsedTurns: 2, condition: 'winded', duration: 'scene' };
  const reviveIn = (state, turn = 6) => evaluateEffects({ state, effects: [revive], consumer: 'ability', actor: 10, turn, transactionId: 'scene-revival' });
  assert.equal(reviveIn(fallenWorld).state.actors['npc:22'].health, 1, 'An actually materialized fallen NPC satisfies the core revival boundary.');
  assert.throws(() => reviveIn(fallenWorld, 8), /recent recorded death/);
  for (const [field, token] of [['age', 'unknown'], ['body', 'unknown'], ['body', 'destroyed'], ['returnChoice', 'unknown'], ['returnChoice', 'unwilling']]) {
    const sample = fixture();
    sample.frame.actors[3].fallen = { age: 'recent', body: 'intact', returnChoice: 'willing', [field]: token };
    const uncertain = buildClassScenario({ ...sample, turn: 5 }).world;
    assert.throws(() => reviveIn(uncertain), undefined, `${field}:${token} cannot invent revival permission.`);
    if (field === 'age') assert.equal(Object.hasOwn(uncertain.actors['npc:22'], 'deathTurn'), false);
  }
  assert.equal(Object.hasOwn(world.actors['npc:22'], 'willingReturn'), false, 'An allied NPC is not implicitly willing to return.');

  const revisitInput = fixture();
  const laterLocation = { ...revisitInput.location, id: 9 };
  const revisitWorld = evaluateEffects({ state: fallenWorld, effects: [{ op: 'encounter_end', outcome: 'party_favored' }],
    consumer: 'ordinary', actor: 10, turn: 6, transactionId: 'leave-old-scene', affirmedOpposed: ['npc:20', 'npc:21'] }).state;
  revisitWorld.currentLocationId = laterLocation.id;
  for (const area of Object.values(fallenWorld.areas)) revisitWorld.areas[`area:9:${area.id}`] = { ...structuredClone(area), locationId: 9 };
  revisitInput.frame.actors.forEach(actor => { actor.conditions = []; });
  revisitInput.frame.items = [];
  const rememberedVitals = structuredClone(revisitWorld.actors['npc:22']);
  const revisited = buildClassScenario({ ...revisitInput, world: revisitWorld, location: laterLocation, turn: 9 }).world;
  for (const field of ['health', 'maxHealth', 'status', 'deathTurn', 'intactBody', 'willingReturn', 'npcKit', 'skills']) {
    assert.deepEqual(revisited.actors['npc:22'][field], rememberedVitals[field], `A new location cannot reset existing NPC ${field}.`);
  }
  assert.equal(revisited.actors['npc:22'].locationId, 9);
  const changedProfile = structuredClone(revisitInput.frame);
  changedProfile.actors[3].profile = 'boss';
  assert.throws(() => buildClassScenario({ ...revisitInput, frame: changedProfile, world: revisitWorld, location: laterLocation, turn: 9 }), /retain their authored profile/);
  const changedDeath = structuredClone(revisitInput.frame);
  changedDeath.actors[3].fallen = { age: 'recent', body: 'intact', returnChoice: 'willing' };
  assert.throws(() => buildClassScenario({ ...revisitInput, frame: changedDeath, world: revisitWorld, location: laterLocation, turn: 9 }), /retain their authored profile/);
  const deadOpposition = structuredClone(revisitInput.frame);
  deadOpposition.actors[3].allegiance = 'opposition';
  deadOpposition.encounter.opposition.push(deadOpposition.actors[3].actor);
  assert.throws(() => buildClassScenario({ ...revisitInput, frame: deadOpposition, world: revisitWorld, location: laterLocation, turn: 9 }), /living active opposition/);
  assert.deepEqual(revisitWorld.actors['npc:22'], rememberedVitals);
  const controlled = fixture();
  controlled.world.actors['npc:22'].controller = 'character:10';
  controlled.frame.actors[3].profile = null;
  controlled.frame.actors[3].fallen = { age: 'recent', body: 'intact', returnChoice: 'willing' };
  assert.throws(() => buildClassScenario(controlled), /controlled actors retain/);

  for (const [id, profile] of Object.entries(NPC_PROFILES)) {
    const sample = fixture();
    sample.frame.actors[1].profile = id;
    const npc = buildClassScenario(sample).world.actors['npc:20'];
    assert.equal(npc.health, profile.health);
    assert.equal(npc.maxHealth, profile.health);
    assert.equal(npc.skills.melee, profile.skills.melee || 0);
    assert.ok(npc.npcKit.actions.every(action => typeof action.tell === 'string' && action.tell.length > 0));
    assert.ok(npc.npcKit.actions.some(action => action.kind !== 'attack'), 'NPC profiles retain nonattack choices.');
  }
  assert.throws(() => { NPC_PROFILES.boss.health = 999; }, TypeError);
  for (const [injury, amount] of Object.entries({ graze: 2, wound: 5, grievous: 9 })) {
    const sample = fixture();
    sample.frame.actors[3].injury = injury;
    const injured = buildClassScenario(sample).world;
    assert.equal(injured.actors['npc:22'].health, NPC_PROFILES.support.health - amount);
    assert.equal(injured.actors['npc:22'].status, 'active');
    const healed = evaluateEffects({ state: injured, effects: [{ op: 'heal', who: 'npc:22', grade: 'mend' }],
      consumer: 'ability', actor: 10, turn: 2, transactionId: `heal-${injury}` });
    assert.equal(healed.state.actors['npc:22'].health, Math.min(NPC_PROFILES.support.health, injured.actors['npc:22'].health + 6),
      'Ordinary authored healing can mend a scene injury without an artificial later world patch.');
    const again = { ...fixture(), world: structuredClone(injured) };
    again.location.id = 5;
    again.world.currentLocationId = 5;
    Object.assign(again.world.areas, createRulesWorld({ location: again.location }).areas);
    for (const actor of again.frame.actors) actor.conditions = [];
    again.frame.actors[3].injury = injury;
    assert.throws(() => buildClassScenario(again), /Existing NPCs retain/, 'Scene authoring cannot reapply injury to an initialized NPC.');
  }
  const peaceful = fixture();
  peaceful.frame.encounter = { active: false, opposition: [] };
  peaceful.frame.actors[1].allegiance = 'neutral';
  peaceful.frame.actors[2].allegiance = 'neutral';
  const quietWorld = buildClassScenario(peaceful).world;
  assert.equal(quietWorld.encounter.active, false, 'Scenario authoring does not require combat.');
  assert.equal(quietWorld.actors['npc:20'].opposed, false);
  const absent = fixture();
  absent.frame.actors[3].area = null;
  assert.equal(buildClassScenario(absent).world.actors['npc:22'].present, false);
  const underwater = fixture();
  underwater.frame.areas[1].terrain = 'underwater';
  underwater.frame.areas[1].surfaces = ['water'];
  const flooded = buildClassScenario(underwater).world.areas['area:4:yard'];
  assert.equal(flooded.underwater, true);
  assert.equal(flooded.dry_ground, false);
  assert.equal(flooded.supported, true);
  const namedSafe = fixture();
  namedSafe.location.layout.name = 'Safe Recovery Sanctuary';
  namedSafe.location.layout.areas[1].name = 'Safe Resting Room';
  assert.equal(buildClassScenario(namedSafe).world.areas['area:4:yard'].safeRecovery, false, 'Location and area names never authorize recovery.');
  namedSafe.frame.areas[1].traits.push('safe_recovery');
  assert.equal(buildClassScenario(namedSafe).world.areas['area:4:yard'].safeRecovery, true);
  namedSafe.frame.areas[1].traits.pop();
  namedSafe.frame.areas[1].traits.push('immediate_threat');
  assert.equal(buildClassScenario(namedSafe).world.areas['area:4:yard'].immediateThreat, true);

  const evaluate = effects => evaluateEffects({ state: world, effects, consumer: 'ability', actor: 10, turn: 2,
    transactionId: 'scene-integration', affirmedOpposed: ['npc:20', 'npc:21'] });
  assert.equal(evaluate([{ op: 'disarm', who: 'npc:20', item: refs.items.saber }]).state.items[refs.items.saber].holder, 'area:4:gate');
  assert.equal(evaluate([{ op: 'object_unlock', object: refs.objects.lock, maximumSecurity: 'ordinary' }]).state.objects[refs.objects.lock].locked, false);
  assert.throws(() => evaluate([{ op: 'object_unlock', object: refs.objects.seal, maximumSecurity: 'ordinary' }]), error => error.code === 'RULES_EFFECT_PRECONDITION');
  assert.equal(evaluate([{ op: 'object_disable', object: refs.objects.lever, maximumSecurity: 'ordinary', duration: 'scene' }]).state.objects[refs.objects.lever].disabled.duration, 'scene');
  assert.equal(evaluate([{ op: 'scene_feature_clear', feature: refs.features.smoke }]).state.features[refs.features.smoke].status, 'cleared');
  assert.equal(evaluate([{ op: 'item_consume', owner: 'character:10', item: refs.items.catalyst, quantity: 1 }]).state.items[refs.items.catalyst].lost, true);
  for (const discovery of input.frame.discoveries) {
    const subject = refs[`${discovery.subject.kind}s`][discovery.subject.key];
    const revealed = evaluate([{ op: 'reveal', subject, scope: discovery.scope, maximum: 1 }]);
    assert.equal(revealed.state.facts.at(-1).fact, discovery.fact, 'Reveal learns only the exact previously stored fact.');
  }
  assert.deepEqual(input, before);

  const rejectFrame = (mutate, label) => {
    const sample = fixture();
    mutate(sample.frame);
    const original = structuredClone(sample);
    assert.throws(() => buildClassScenario(sample), invalid, label);
    assert.deepEqual(sample, original, `Rejected ${label} cannot leak partial mutations.`);
  };
  const cases = [
    [frame => { frame.effects = [{ op: 'harm', amount: 999 }]; }, 'arbitrary effects'],
    [frame => { frame.actors[1].health = 999; }, 'model combat numbers'],
    [frame => { frame.actors[3].injury = 5; }, 'numeric NPC injury'],
    [frame => { frame.actors[3].injury = 'fatal'; }, 'invented NPC injury'],
    [frame => { frame.actors[0].injury = 'wound'; }, 'PC injury override'],
    [frame => { frame.actors[3].injury = 'wound'; frame.actors[3].area = null; }, 'injury on absent actor'],
    [frame => { frame.actors[3].injury = 'wound'; frame.actors[3].fallen = { age: 'recent', body: 'intact', returnChoice: 'willing' }; }, 'injury combined with fallen'],
    [frame => { frame.actors[0].fallen = { age: 'recent', body: 'intact', returnChoice: 'willing' }; }, 'PC death and return override'],
    [frame => { frame.actors[3].fallen = { age: 2, body: 'intact', returnChoice: 'willing' }; }, 'numeric fallen age'],
    [frame => { frame.actors[3].fallen = { body: 'intact', returnChoice: 'willing' }; }, 'missing fallen age'],
    [frame => { frame.actors[3].fallen = { age: 'recent', body: 'intact', returnChoice: 'willing', deathTurn: 1 }; }, 'model death turn'],
    [frame => { frame.actors[3].fallen = { age: 'recent', body: 'invulnerable', returnChoice: 'willing' }; }, 'invented body condition'],
    [frame => { frame.actors[3].fallen = { age: 'recent', body: 'intact', returnChoice: 'party' }; }, 'allegiance as consent'],
    [frame => { frame.actors[1].fallen = { age: 'recent', body: 'intact', returnChoice: 'willing' }; }, 'dead encounter opposition'],
    [frame => { frame.actors[1].profile = 'unstoppable'; }, 'invented NPC profile'],
    [frame => { frame.actors[1].actor = 'unknown'; }, 'unrecorded actor'],
    [frame => { frame.actors[1].area = 'nowhere'; }, 'unrecorded area'],
    [frame => { frame.actors.push(frame.actors[1]); }, 'duplicate actor'],
    [frame => { frame.actors.pop(); }, 'missing actor'],
    [frame => { frame.areas.pop(); }, 'missing area'],
    [frame => { frame.areas[1].area = 'gate'; }, 'duplicate area'],
    [frame => { frame.areas[1].traits.push('unlimited_flight'); }, 'invented area permission'],
    [frame => { frame.areas[1].traits.push('visible'); }, 'duplicate area permission'],
    [frame => { frame.areas[1].traits.push('safe_recovery', 'immediate_threat'); }, 'contradictory recovery safety'],
    [frame => { frame.actors[1].conditions[0].kind = 'invincible'; }, 'invented condition'],
    [frame => { frame.actors[1].conditions.push(frame.actors[1].conditions[0]); }, 'duplicate condition'],
    [frame => { frame.actors[1].area = null; }, 'condition on absent actor'],
    [frame => { delete frame.features[0].mapFeature; }, 'missing map materialization'],
    [frame => { frame.features[0].mapFeature = 0; }, 'duplicate map binding'],
    [frame => { frame.features[0].name = 'Imagined cover'; }, 'map name rewrite'],
    [frame => { frame.features[0].area = 'gate'; }, 'map area rewrite'],
    [frame => { frame.features[0].mapFeature = 100; }, 'unrecorded map index'],
    [frame => { frame.features[0].worksAgainst = 'nobody'; }, 'invalid feature side'],
    [frame => { frame.features[0].origin = 'all_powerful'; }, 'invented feature origin'],
    [frame => { frame.objects[0].kind = 'living_actor'; }, 'actor disguised as object'],
    [frame => { frame.objects[0].security = 'none'; }, 'unknown security'],
    [frame => { frame.objects[1].locked = true; }, 'lock state on scenery'],
    [frame => { frame.items[0].holder.key = 'not-present'; }, 'invented item holder'],
    [frame => { frame.items[0].holder = { kind: 'area', key: 'gate' }; }, 'wielded ground weapon'],
    [frame => { frame.items[0].kind = 'mundane'; }, 'wielded nonweapon'],
    [frame => { frame.items[0].condition = 'indestructible'; }, 'invented item condition'],
    [frame => { frame.items[0].weaponCategory = 'ranged'; }, 'ranged category on melee weapon'],
    [frame => { frame.items[1].weaponCategory = 'heavy'; }, 'melee category on ranged weapon'],
    [frame => { frame.items[2].weaponCategory = 'simple'; }, 'weapon category on catalyst'],
    [frame => { frame.items[0].weaponCategory = 'legendary'; }, 'invented training category'],
    [frame => { frame.items[0].key = '__proto__'; }, 'unsafe local key'],
    [frame => { frame.discoveries[0].fact = 'x'.repeat(121); }, 'unbounded discovery'],
    [frame => { frame.discoveries[0].scope = 'omniscience'; }, 'invented reveal scope'],
    [frame => { frame.discoveries[0].subject = { kind: 'object', key: 'invented' }; }, 'unrecorded discovery subject'],
    [frame => { frame.discoveries[1].fact = frame.discoveries[0].fact.toUpperCase(); }, 'duplicate folded fact'],
    [frame => { frame.encounter.opposition.push('medic'); }, 'ally as opposition'],
    [frame => { frame.encounter.active = false; }, 'inactive encounter with participants'],
    [frame => { frame.actors[0].profile = 'boss'; }, 'NPC authority on a player'],
    [frame => { frame.actors[0].allegiance = 'neutral'; }, 'player party removal'],
    [frame => { frame.actors[1].profile = null; }, 'NPC without authored authority']
  ];
  for (const [mutate, label] of cases) rejectFrame(mutate, label);
  for (const badBinding of ['npc:999', 'character:999', 'guard', 20]) {
    const sample = fixture();
    sample.actorBindings.guard = badBinding;
    assert.throws(() => buildClassScenario(sample), invalid);
  }
  const duplicate = fixture();
  duplicate.actorBindings.guard = duplicate.actorBindings.archer;
  assert.throws(() => buildClassScenario(duplicate), invalid);
  assert.throws(() => buildClassScenario({ ...input, world }), invalid, 'Repeat authoring cannot reset an already applied scene.');
  assert.throws(() => buildClassScenario({ ...input, turn: 0 }), invalid);
  assert.throws(() => validateClassSceneFrame({ ...input.frame, schemaVersion: 2 }, { layout: input.location.layout, actorKeys: Object.keys(input.actorBindings) }), invalid);
  console.log(` - Strict class scene tests passed: ${cases.length} frame rejection cases, all NPC profiles and stored effect consumers.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) runClassScenarioTests();
