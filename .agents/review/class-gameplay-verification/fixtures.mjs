import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve, sep } from 'node:path';

const CATALOG_VERSION = 'expert-development-1';
const layout = {
  name: 'Gatehouse', description: 'An open gate and its adjoining courtyard.',
  areas: [{ id: 'gate', name: 'Gate', x: 0, y: 0, w: 40, h: 40 },
    { id: 'yard', name: 'Courtyard', x: 40, y: 0, w: 40, h: 40 }],
  exits: [{ from: 'gate', to: 'yard', label: 'Open arch' }], features: []
};
const preparationNames = ['lintel repairs', 'roof braces', 'door fittings', 'signal equipment',
  'medical supplies', 'water stores', 'courtyard tools', 'watch records', 'final gatehouse inspection'];
let fixtureActive = false;

async function assertDisposableDatabase(db) {
  assert.ok(process.env.RPG_DB_PATH, 'Offline fixtures require RPG_DB_PATH before application imports.');
  const temporaryRoot = await realpath(tmpdir());
  const requested = resolve(process.env.RPG_DB_PATH);
  const directory = await realpath(dirname(requested));
  assert.ok(directory.startsWith(`${temporaryRoot}${sep}`), 'Offline fixture storage must be inside a fresh system-temporary directory.');
  const databases = await db.all('PRAGMA database_list');
  const main = databases.find(value => value.name === 'main');
  assert.ok(main?.file, 'The provided database must already be initialized in the disposable store.');
  const actual = await realpath(main.file);
  assert.equal(actual, await realpath(requested), 'The imported database connection must match the selected temporary path.');
}

function selection(familyId, branchId) {
  return { catalogVersion: CATALOG_VERSION, optionSet: 'expert', familyId, branchId,
    modules: [], capabilities: { rider: false, alliedActors: true } };
}

function outlineFor(mode) {
  const catalyst = mode === 'catalyst';
  const combat = catalyst || mode === 'direct-magic';
  return {
    title: mode === 'direct-magic' ? 'Dispatch under fire' : catalyst ? 'The contested gate' : 'The unfinished return',
    setting: 'A gatehouse with a visible open arch into its adjoining courtyard.',
    major_locations: [{ name: 'Gatehouse', description: 'A gate and a connected courtyard.' }],
    key_npcs: combat ? [
      { name: 'Nessa', role: 'Independent allied supporter', personality: 'Cooperative and attentive to danger', quirks: 'Calls her intentions clearly.' },
      { name: 'Raider', role: 'Hostile swordsman holding the gate', personality: 'Aggressive', quirks: 'Threatens anyone crossing the arch.' },
      { name: 'Sentry', role: 'Hostile bow wielder guarding the courtyard dispatch case', personality: 'Watchful', quirks: 'Keeps the case in view.' }
    ] : [
      { name: 'Tarin', role: 'Allied messenger who explicitly wants to return if fallen', personality: 'Trusting', quirks: 'Makes his wishes plain.' },
      { name: 'Nessa', role: 'Living allied witness and guide', personality: 'Patient', quirks: 'Recalls Tarin\'s stated wishes.' }
    ],
    starting_quest: combat ? { title: 'Secure the dispatch', description: 'Protect the party and recover the courtyard dispatch case.' }
      : { title: 'Restore the gatehouse', description: 'Complete the distinct gatehouse preparations and help the allied messenger.' }
  };
}

function openingFor(mode) {
  if (mode === 'direct-magic') return {
    narrative: 'Sera and Nessa stand at the Gate. The Raider faces them with a drawn sword. Through the open arch, the Sentry holds a bow beside the dispatch case in the Courtyard. Both enemies are actively opposing the party. The Courtyard contains no allies. Nessa watches the Raider and chooses her own response; nobody has acted yet.',
    scene_grounding: 'Sera, Nessa and Raider occupy Gate. Only Sentry occupies the adjacent visible Courtyard, beside the dispatch case. Both areas have stable dry ground and the connecting arch is open. The Raider is within unarmed striking distance. Ordinary attack, aid and movement remain choices; no spell or NPC response has been selected.'
  };
  if (mode === 'catalyst') return {
    narrative: 'Sera and Nessa stand at the Gate beside the open arch. The Raider faces them with a drawn sword. Across the arch, the Sentry holds a bow near the dispatch case in the Courtyard. Nessa says, "I agree to the Courtyard as my destination if your Advance Cue opens that opportunity. I will decide whether an attack, help or waiting best serves us." Both enemies are actively opposing the party; securing the dispatch and handling the Raider are competing priorities.',
    scene_grounding: 'Sera, Nessa and Raider occupy Gate. Sentry and the dispatch case occupy the adjacent visible Courtyard. Both areas have stable dry ground and the connecting arch is open. Nessa carries no weapon and acts from her own support kit; no NPC action has been selected for her.'
  };
  if (mode === 'ritual') return {
    narrative: 'Sera kneels at the Gate beside Tarin, who died moments ago. His body is intact. Before he fell he explicitly asked to be brought back if Sera could do so, and Nessa confirms that wish. Sera holds one Return catalyst, an unused material for the working. Nessa waits nearby; the gatehouse is quiet, the Courtyard is open, and no immediate threat is present.',
    scene_grounding: 'Sera, Tarin\'s intact body and the living Nessa are at Gate. Tarin is dead, not merely injured, and his willing return is established. The Return catalyst is held by Sera. Gate is a recorded focus and a safe recovery area. Courtyard is adjacent, visible and previously visited.'
  };
  return {
    narrative: `Sera, Tarin and Nessa have completed nine distinct gatehouse preparations: ${preparationNames.join(', ')}. Each finished preparation still needs its final delivery or inspection sign-off. They work between the Gate and Courtyard without opposition or time pressure.`,
    scene_grounding: 'Sera, Tarin and Nessa begin at Gate. Courtyard is visible through the open arch. Both recorded areas are safe, previously visited and unopposed.'
  };
}

function frameFor(mode) {
  const combat = mode === 'catalyst' || mode === 'direct-magic';
  const fallen = mode === 'ritual';
  return { schemaVersion: 1,
    areas: layout.areas.map(area => ({ area: area.id, terrain: 'dry_ground',
      traits: ['visible', 'safe', 'visited', combat ? 'immediate_threat' : 'safe_recovery',
        ...(!combat && area.id === 'gate' ? ['focus'] : [])], surfaces: ['ground'] })),
    actors: [{ actor: 'player', area: 'gate', allegiance: 'party', profile: null, conditions: [] },
      ...(combat ? [
        { actor: 'npc0', area: 'gate', allegiance: 'party', profile: 'support', conditions: [] },
        { actor: 'npc1', area: 'gate', allegiance: 'opposition', profile: 'combatant', conditions: [] },
        { actor: 'npc2', area: 'yard', allegiance: 'opposition', profile: 'ranged', conditions: [] }
      ] : [
        { actor: 'npc0', area: 'gate', allegiance: 'party', profile: 'support', conditions: [],
          ...(fallen ? { fallen: { age: 'recent', body: 'intact', returnChoice: 'willing' } } : {}) },
        { actor: 'npc1', area: 'gate', allegiance: 'party', profile: 'support', conditions: [] }
      ])],
    items: combat ? [
      { key: 'raider-sword', name: 'Raider sword', description: 'A usable ordinary sword.', kind: 'melee_weapon',
        holder: { kind: 'actor', key: 'npc1' }, wielded: true, condition: 'pristine', weaponCategory: 'simple' },
      { key: 'sentry-bow', name: 'Sentry bow', description: 'A usable ordinary bow.', kind: 'ranged_weapon',
        holder: { kind: 'actor', key: 'npc2' }, wielded: true, condition: 'pristine', weaponCategory: 'ranged' },
      { key: 'dispatch-case', name: 'Dispatch case', description: 'The recorded objective lying in the courtyard.', kind: 'mundane',
        holder: { kind: 'area', key: 'yard' }, wielded: false, condition: 'pristine' }
    ] : fallen ? [{ key: 'return-material', name: 'Return catalyst', description: 'One unused revival catalyst held for Tarin\'s return.',
      kind: 'revival_catalyst', holder: { kind: 'actor', key: 'player' }, wielded: false, condition: 'pristine' }] : [],
    objects: [], features: [], discoveries: [], encounter: { active: combat, opposition: combat ? ['npc1', 'npc2'] : [] }
  };
}

async function withOfflineProvider({ engine, db, AIClient, apiConfig }, task) {
  assert.equal(fixtureActive, false, 'Offline fixture preparation must run sequentially.');
  assert.ok(engine?.createCampaign && engine?.takeTurn && engine?.getCampaignState && AIClient?.prototype?.sendPrompt);
  fixtureActive = true;
  const originalPrompt = AIClient.prototype.sendPrompt;
  const originalDispatch = AIClient.prototype.dispatchPrompt;
  const stages = [];
  const campaignIds = [];
  const profileIds = [];
  let providerDispatchAttempts = 0;
  const control = { mode: 'training', advancement: null };
  const offlineApiConfig = { ...apiConfig, imageProvider: '', voiceProvider: '' };
  try {
    await assertDisposableDatabase(db);
    AIClient.prototype.dispatchPrompt = async function () {
      providerDispatchAttempts++;
      throw new Error('OFFLINE_FIXTURE_DISPATCH_FORBIDDEN: authored setup cannot reach a real provider.');
    };
    AIClient.prototype.sendPrompt = async function ({ systemInstruction, prompt }) {
      let response;
      const stage = /^AETHERIA_COUNCIL:([a-z_]+)/u.exec(systemInstruction)?.[1];
      if (!stage) {
        if (prompt.startsWith('Draft an epic,')) response = outlineFor(control.mode);
        else if (systemInstruction.includes('persistent structured layout')) response = layout;
        else if (systemInstruction.includes('initial Aetheria scene')) response = frameFor(control.mode);
        else if (prompt.startsWith('Set the scene and begin the campaign.')) response = openingFor(control.mode);
        else throw new Error(`OFFLINE_FIXTURE_PROMPT_UNKNOWN: ${systemInstruction.slice(0, 100)}`);
      } else {
        assert.ok(control.mode === 'training' && control.advancement, 'Only the authored offline advancement may stub Council turns.');
        const data = JSON.parse(prompt);
        const approved = { approved: true, reason: 'The distinct completed preparation is delivered through a recorded safe unopposed route.', affirmedOpposed: [], consentingActors: [] };
        if (stage === 'interaction') response = { inputKind: 'committed_action', intent: data.playerInput, answer: null };
        else if (stage === 'grounding' || stage === 'pre_roll') response = approved;
        else if (stage === 'referee') response = {
          action: { kind: 'ordinary', action: { kind: 'move', area: control.advancement.area } },
          check: null, deltaSources: [], noCheckReason: 'The completed delivery crosses a clear safe area with no opposition or uncertainty.',
          npcTurns: { success: [], failure: [] }, encounter: { success: 'unchanged', failure: 'unchanged' },
          award: { kind: 'milestone', id: control.advancement.awardId }
        };
        else if (stage === 'narration') response = { narrative: `Sera completes the ${control.advancement.name} sign-off in the ${control.advancement.area === 'yard' ? 'Courtyard' : 'Gate'}. Tarin and Nessa remain at Gate.` };
        else throw new Error(`OFFLINE_FIXTURE_STAGE_UNKNOWN: ${stage}`);
      }
      stages.push(stage || `setup:${control.mode}`);
      return JSON.stringify(response);
    };
    const create = async (mode, familyId, branchId, profileId = null) => {
      control.mode = mode;
      control.advancement = null;
      const state = await engine.createCampaign({ genre: 'Fantasy', characterName: 'Sera', ruleset: 'aetheria',
        classSelection: selection(familyId, branchId), apiConfig: offlineApiConfig,
        ...(profileId ? { characterProfileId: profileId, characterMode: 'copy' } : {}) });
      campaignIds.push(state.campaignId);
      profileIds.push(state.character.player_character_id);
      return state;
    };
    const result = await task({ create, control, offlineApiConfig });
    assert.equal(providerDispatchAttempts, 0, 'Every offline fixture response must be authored without real provider dispatch.');
    return { ...result, campaignIds, profileIds,
      setup: { kind: 'authored_fixture', liveProviderCalls: 0, providerDispatchAttempts, stubbedResponses: stages.length,
        stages, earnedAdvancements: result.earnedAdvancements || 0, networkRequirement: 'caller_denies_all_network_during_fixture' } };
  } catch (error) {
    error.fixtureOwnership = { campaignIds, profileIds, providerDispatchAttempts };
    throw error;
  } finally {
    AIClient.prototype.sendPrompt = originalPrompt;
    AIClient.prototype.dispatchPrompt = originalDispatch;
    fixtureActive = false;
  }
}

export async function prepareDirectMagicEpisode(dependencies) {
  const { engine, db } = dependencies;
  return withOfflineProvider(dependencies, async ({ create }) => {
    const created = await create('direct-magic', 'arcanist', 'arcanist.formula');
    const state = await engine.getCampaignState(created.campaignId);
    const saved = JSON.parse((await db.get('SELECT rules_state_json FROM campaigns WHERE id = ?', [state.campaignId])).rules_state_json);
    const actor = saved.actors[`character:${state.character.id}`];
    const raider = Object.values(saved.actors).find(value => value.name === 'Raider');
    const sentry = Object.values(saved.actors).find(value => value.name === 'Sentry');
    assert.equal(state.character.level, 1);
    assert.equal(state.character.xp, 0);
    for (const name of ['Magic Missile', 'Fireball']) assert.ok(state.character.invocableAbilities.some(ability => ability.name === name),
      `The direct-magic episode requires an actually owned invocable ${name}.`);
    assert.equal(saved.encounter.active, true);
    assert.ok(raider?.present && raider.opposed && raider.health > 0 && raider.area === actor.area,
      'The direct spell needs a real living opponent in the player area.');
    assert.ok(sentry?.present && sentry.opposed && sentry.health > 0 && sentry.area === 'yard',
      'The conditional Fireball needs a real living opponent in the separate Courtyard.');
    const yard = saved.areas[`area:${saved.currentLocationId}:yard`];
    assert.ok(yard.visible && yard.safeToOccupy && yard.adjacent.includes(actor.area));
    assert.equal(Object.values(saved.actors).filter(value => value.present && value.area === 'yard' && value.party).length, 0);
    assert.equal((await db.get('SELECT COUNT(*) AS count FROM rules_turn_operations WHERE campaign_id = ?', [state.campaignId])).count, 0);
    return { episodeId: 'direct-magic', state, earnedAdvancements: 0,
      playerPlan: [
        { kind: 'question', description: 'Ask about visible threats and occupants without committing an action.',
          input: 'Who is threatening us, and who is in the Courtyard?' },
        { kind: 'direct_spell', description: 'Cast the owned routine spell at the recorded nearby Raider, without a preparatory sequence.',
          input: 'I cast Magic Missile at the Raider.' },
        { kind: 'conditional_fireball', description: 'Proceed only if the current visible Courtyard still contains living opposition and no party member. Otherwise record why it was skipped; never omit an occupant or force NPC positioning.',
          input: 'I cast Fireball into the Courtyard.' }
      ],
      visibleChoices: ['The Raider threatens Sera and Nessa at Gate; ordinary unarmed attack or aid is possible.',
        'The Sentry guards the dispatch case across the open arch in the Courtyard.',
        'Ordinary movement can attempt to leave the threatened Gate; it is not guaranteed escape.',
        'Fireball affects every current occupant of its selected area, so inspect the scene again after others act.'] };
  });
}

export async function prepareCatalystEpisode(dependencies) {
  const { engine, db } = dependencies;
  return withOfflineProvider(dependencies, async ({ create }) => {
    const created = await create('catalyst', 'catalyst', 'catalyst.tactics');
    const state = await engine.getCampaignState(created.campaignId);
    const saved = JSON.parse((await db.get('SELECT rules_state_json FROM campaigns WHERE id = ?', [state.campaignId])).rules_state_json);
    assert.equal(state.character.level, 1);
    assert.equal(state.character.xp, 0);
    assert.ok(state.character.invocableAbilities.some(ability => ability.name === 'Advance Cue'));
    assert.equal(saved.encounter.active, true);
    assert.equal(saved.actors[`character:${state.character.id}`].classState.cue, null);
    const ally = Object.values(saved.actors).find(actor => actor.name === 'Nessa');
    assert.ok(ally?.party && ally.present && ally.npcKit && !ally.controller);
    assert.equal(Object.values(saved.actors).filter(actor => actor.present && actor.opposed).length, 2);
    return { episodeId: 'catalyst', state, earnedAdvancements: 0,
      playerPlan: [
        { kind: 'cue', description: 'Commit Advance Cue to Nessa and the visibly adjacent Courtyard; leave her actual action to her independent kit and Council.',
          input: 'I give Nessa Advance Cue toward the Courtyard.' },
        { kind: 'ordinary_choice', description: 'After observing the actual result, choose one legal ordinary attack or aid. Do not dictate an NPC action or repeat the cue to force activation.' }
      ],
      visibleChoices: ['The Raider threatens the party at Gate.', 'The Sentry and dispatch case are in the adjacent Courtyard.',
        'Nessa agreed to the cue destination but retains her own choice of action.', 'An ordinary attack or aid remains available without another class commitment.'] };
  });
}

export async function prepareRitualEpisode(dependencies) {
  const { engine, db } = dependencies;
  return withOfflineProvider(dependencies, async ({ create, control, offlineApiConfig }) => {
    let training = await create('training', 'arcanist', 'arcanist.ritual');
    const initialIds = training.character.abilities.map(ability => ability.id);
    for (let step = 1; step <= 9; step++) {
      control.advancement = { name: preparationNames[step - 1], area: step % 2 ? 'yard' : 'gate', awardId: `pilot-offline-preparation-${step}` };
      training = await engine.takeTurn(training.campaignId,
        `I deliver the completed ${control.advancement.name} for its final sign-off at the ${control.advancement.area === 'yard' ? 'Courtyard' : 'Gate'}.`,
        offlineApiConfig, training.character.id, training.character.abilityTriggerRevision, { requestId: randomUUID() });
      assert.equal(training.character.level, step + 1);
      assert.equal(training.character.xp, step * 100);
    }
    assert.ok(initialIds.every(id => training.character.abilities.some(ability => ability.id === id)));
    const originalProfile = await db.get('SELECT * FROM player_characters WHERE id = ?', [training.character.player_character_id]);
    const created = await create('ritual', 'arcanist', 'arcanist.ritual', training.character.player_character_id);
    const state = await engine.getCampaignState(created.campaignId);
    assert.equal(state.character.level, 10);
    assert.deepEqual(state.character.abilities.map(ability => ability.id), training.character.abilities.map(ability => ability.id));
    assert.notEqual(state.character.player_character_id, training.character.player_character_id);
    assert.deepEqual(await db.get('SELECT * FROM player_characters WHERE id = ?', [training.character.player_character_id]), originalProfile);
    assert.ok(state.character.invocableAbilities.some(ability => ability.name === 'Recall the Departed'));
    const saved = JSON.parse((await db.get('SELECT rules_state_json FROM campaigns WHERE id = ?', [state.campaignId])).rules_state_json);
    const actorRef = `character:${state.character.id}`;
    const fallen = Object.values(saved.actors).find(actor => actor.name === 'Tarin');
    assert.equal(fallen.health, 0);
    assert.equal(fallen.status, 'dead');
    assert.equal(fallen.deathTurn, 1);
    assert.equal(fallen.intactBody, true);
    assert.equal(fallen.willingReturn, true);
    assert.equal(fallen.area, saved.actors[actorRef].area);
    assert.equal(Object.values(saved.items).filter(item => item.kind === 'revival-catalyst' && item.holder === actorRef && !item.lost).length, 1);
    assert.equal(saved.actors[actorRef].classState.ritual, null);
    assert.equal(saved.encounter.active, false);
    assert.equal((await db.get('SELECT COUNT(*) AS count FROM rules_turn_operations WHERE campaign_id = ?', [state.campaignId])).count, 0);
    return { episodeId: 'ritual', state, earnedAdvancements: 9,
      playerPlan: [
        { kind: 'ritual_start', description: 'Use the visible body, stated return choice and owned material to make the initial ritual commitment.',
          input: 'I begin Recall the Departed for Tarin, using my Return catalyst.' },
        { kind: 'ritual_continue', description: 'Continue the recorded working without restating the target or material, provided it remains active.', input: 'I continue the same working.' },
        { kind: 'ritual_continue', description: 'Complete the recorded working if it remains uninterrupted; otherwise record the interruption rather than buying a restart.', input: 'I continue the same working.' }
      ],
      visibleChoices: ['Tarin has just died; his intact body and explicit wish to return are visible scene facts.',
        'Sera holds one Return catalyst and has Recall the Departed on the earned sheet.',
        'Nessa is alive nearby. The gatehouse has no immediate threat.',
        'Ordinary care cannot itself perform the authored revival; direct spells remain separate immediate actions.'] };
  });
}
