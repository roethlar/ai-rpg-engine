import * as db from './db.js';
import { addClassActor, projectClassCharacter, validateRulesWorld, validateClassRuleset } from './class-state.js';
import { buildCharacterAbilityTriggerState } from './ability-trigger-state.js';
import { classTriggerOptions } from './class-state.js';

export function readClassWorld(campaign) {
  const ruleset = validateClassRuleset(JSON.parse(campaign.ruleset_json));
  if (!campaign.rules_state_json) throw new Error('This class campaign has no mechanical world.');
  return validateRulesWorld(JSON.parse(campaign.rules_state_json), ruleset);
}

// Activation and world projection share their caller's outer write transaction.
export async function installClassActorInTransaction(campaignId, character, world) {
  let companionActorRef = null;
  if (character.classState.companion) {
    const companion = await db.run(
      `INSERT INTO npcs (campaign_id, name, role, personality, quirks, notes, status)
       VALUES (?, ?, 'class_companion', '', '', 'One shared Main with the controller.', 'alive')`,
      [campaignId, `${character.name}'s companion`]
    );
    companionActorRef = `npc:${companion.id}`;
  }
  addClassActor(world, character, { companionActorRef });
  await db.run(`UPDATE characters SET class_build_json = ? WHERE id = ? AND campaign_id = ?`,
    [JSON.stringify(character.classBuild), character.id, campaignId]);
  await db.run(`INSERT INTO campaign_vocabulary_state (campaign_id, vocabulary_version) VALUES (?, 0)
    ON CONFLICT(campaign_id) DO NOTHING`, [campaignId]);
  buildCharacterAbilityTriggerState({ campaignId, character, bindings: character.bindings, ...classTriggerOptions(character) });
  for (const binding of character.bindings) {
    await db.run(
      `INSERT INTO character_ability_bindings
       (player_character_id, campaign_id, ability_id, term, prose, aliases_json, provenance, vocabulary_version, binding_set_revision)
       VALUES (?, ?, ?, ?, ?, ?, 'player-choice', 0, 1)`,
      [character.player_character_id, campaignId, binding.abilityId, binding.term, binding.prose, JSON.stringify(binding.aliases)]
    );
  }
}

export async function writeClassWorldInTransaction(campaignId, world, expectedRevision) {
  const campaign = await db.get(`SELECT ruleset_json, rules_revision FROM campaigns WHERE id = ?`, [campaignId]);
  if (!campaign) throw new Error('Class campaign not found.');
  validateRulesWorld(world, validateClassRuleset(JSON.parse(campaign.ruleset_json)));
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || expectedRevision >= Number.MAX_SAFE_INTEGER) {
    throw new Error('Invalid mechanical world revision.');
  }
  const update = await db.run(
    `UPDATE campaigns SET rules_state_json = ?, rules_revision = rules_revision + 1, current_location_id = ?
     WHERE id = ? AND rules_revision = ?`,
    [JSON.stringify(world), world.currentLocationId, campaignId, expectedRevision]
  );
  if (update.changes !== 1) {
    const error = new Error('The mechanical world changed before this action committed.');
    error.code = 'CLASS_WORLD_STALE';
    throw error;
  }
  await db.run(`UPDATE campaigns SET turn_state_json = ? WHERE id = ?`, [JSON.stringify({
    order: world.turnOrder.order.map(ref => Number(ref.slice('character:'.length))),
    current_index: world.turnOrder.currentIndex, round: world.turnOrder.round
  }), campaignId]);
  const rows = await db.all(`SELECT * FROM characters WHERE campaign_id = ? AND COALESCE(status, 'active') = 'active'`, [campaignId]);
  for (const row of rows) {
    const character = projectClassCharacter({ id: row.id, name: row.name, class: row.class }, world);
    const fields = [character.health, character.max_health, character.xp, character.level,
      JSON.stringify(character.inventory), JSON.stringify(character.abilities), JSON.stringify(character.classBuild)];
    await db.run(`UPDATE characters SET health = ?, max_health = ?, xp = ?, level = ?, mana = 0, max_mana = 0,
      inventory_json = ?, abilities_json = ?, class_build_json = ? WHERE id = ?`, [...fields, row.id]);
    if (row.player_character_id) {
      const bindings = (await db.all(
        `SELECT ability_id, term, prose, aliases_json FROM character_ability_bindings WHERE campaign_id = ? AND player_character_id = ? ORDER BY ability_id`,
        [campaignId, row.player_character_id]
      )).map(binding => ({ abilityId: binding.ability_id, term: binding.term, prose: binding.prose, aliases: JSON.parse(binding.aliases_json) }));
      const snapshot = { ...character, attributes: JSON.parse(row.attributes_json || '{}'), bindings };
      delete snapshot.id;
      await db.run(`UPDATE player_characters SET health = ?, max_health = ?, xp = ?, level = ?, mana = 0, max_mana = 0,
        inventory_json = ?, abilities_json = ?, class_build_json = ?, class_state_json = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND active_campaign_id = ? AND status = 'checked_out'`,
      [...fields, JSON.stringify(snapshot), row.player_character_id, campaignId]);
    }
  }
  for (const [ref, actor] of Object.entries(world.actors)) {
    if (!ref.startsWith('npc:')) continue;
    await db.run(`UPDATE npcs SET status = ?, relationship_value = ? WHERE id = ? AND campaign_id = ?`,
      [actor.status === 'dead' ? 'dead' : 'alive', actor.relationshipValue ?? 0, Number(ref.slice(4)), campaignId]);
  }
  const occupancy = Object.entries(world.actors).filter(([, actor]) => actor.present && actor.locationId === world.currentLocationId)
    .map(([ref, actor]) => ({ name: actor.name, kind: ref.startsWith('character:') ? 'player' : 'npc', area: actor.area, note: '' }));
  await db.run(`UPDATE locations SET occupancy_json = ? WHERE id = ? AND campaign_id = ?`,
    [JSON.stringify(occupancy), world.currentLocationId, campaignId]);
  return expectedRevision + 1;
}
