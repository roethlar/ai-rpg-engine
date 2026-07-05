import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'rpg_engine.db');
const db = new sqlite3.Database(dbPath);

// sqlite3 serializes individual statements, but multi-statement transactions
// still need an application-level queue so concurrent BEGIN/COMMIT blocks do not
// interleave on the same connection.
let writeTransactionQueue = Promise.resolve();

// Helper to run query with promise
export function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

// Helper to get single row
export function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// Helper to get multiple rows
export function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

export function withWriteTransaction(taskFn) {
  const next = writeTransactionQueue.catch(() => {}).then(async () => {
    await run('BEGIN IMMEDIATE;');
    try {
      const result = await taskFn();
      await run('COMMIT;');
      return result;
    } catch (err) {
      await run('ROLLBACK;');
      throw err;
    }
  });

  writeTransactionQueue = next.catch(() => {});
  return next;
}

// Initialize database schema
export async function initDb() {
  // Enable foreign keys & WAL mode for concurrency
  await run('PRAGMA foreign_keys = ON;');
  await run('PRAGMA journal_mode = WAL;');

  // Create campaigns table
  await run(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      genre TEXT NOT NULL,
      summary TEXT,
      current_act INTEGER DEFAULT 1,
      rules_mode INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migrate campaigns table if current_act column doesn't exist
  try {
    await run('ALTER TABLE campaigns ADD COLUMN current_act INTEGER DEFAULT 1;');
  } catch (e) {
    // Ignore error if column already exists
  }

  // Migrate campaigns table if rules_mode column doesn't exist
  try {
    await run('ALTER TABLE campaigns ADD COLUMN rules_mode INTEGER DEFAULT 0;');
  } catch (e) {
    // Ignore error if column already exists
  }

  // Ruleset as canon campaign state (decision 2026-07-03): the campaign's rule
  // sheet — resolution summary, abilities with costs/limits — generated at
  // creation, consulted by the Council, viewable by the player.
  try {
    await run('ALTER TABLE campaigns ADD COLUMN ruleset_json TEXT;');
  } catch (e) {
    // Ignore error if column already exists
  }

  // Create campaign_outlines table
  await run(`
    CREATE TABLE IF NOT EXISTS campaign_outlines (
      campaign_id INTEGER PRIMARY KEY,
      outline_json TEXT NOT NULL,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    )
  `);

  // Create characters table (Phase 3 M1: many characters per campaign — a
  // surrogate id primary key; campaign_id is an indexed foreign key).
  // initiative is stored for future turn ordering (unused by v1 round-robin).
  await run(`
    CREATE TABLE IF NOT EXISTS characters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      player_character_id INTEGER,
      name TEXT NOT NULL,
      class TEXT NOT NULL,
      health INTEGER NOT NULL,
      max_health INTEGER NOT NULL,
      mana INTEGER NOT NULL,
      max_mana INTEGER NOT NULL,
      xp INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      initiative INTEGER,
      inventory_json TEXT NOT NULL,
      attributes_json TEXT NOT NULL,
      abilities_json TEXT DEFAULT '[]',
      progression_notes TEXT,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    )
  `);

  // Migration (M1): the original table used campaign_id as its PRIMARY KEY —
  // structurally one character per campaign. Detect the id-less legacy shape
  // and rebuild, preserving rows.
  const characterColumns = await all(`PRAGMA table_info(characters)`);
  if (characterColumns.length > 0 && !characterColumns.some(col => col.name === 'id')) {
    await run('ALTER TABLE characters RENAME TO characters_legacy;');
    await run(`
      CREATE TABLE characters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id INTEGER NOT NULL,
        player_character_id INTEGER,
        name TEXT NOT NULL,
        class TEXT NOT NULL,
        health INTEGER NOT NULL,
        max_health INTEGER NOT NULL,
        mana INTEGER NOT NULL,
        max_mana INTEGER NOT NULL,
        xp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        initiative INTEGER,
        inventory_json TEXT NOT NULL,
        attributes_json TEXT NOT NULL,
        abilities_json TEXT DEFAULT '[]',
        progression_notes TEXT,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
      )
    `);
    await run(`
      INSERT INTO characters (campaign_id, player_character_id, name, class, health, max_health,
                              mana, max_mana, xp, level, inventory_json, attributes_json,
                              abilities_json, progression_notes)
      SELECT campaign_id, player_character_id, name, class, health, max_health,
             mana, max_mana, xp, level, inventory_json, attributes_json,
             COALESCE(abilities_json, '[]'), progression_notes
      FROM characters_legacy
    `);
    await run('DROP TABLE characters_legacy;');
    console.log('Migrated characters to the multi-character schema (Phase 3 M1).');
  }

  try {
    await run('ALTER TABLE characters ADD COLUMN initiative INTEGER;');
  } catch (e) {
    // Ignore error if column already exists
  }

  // Phase 3 M3: released members leave the table but keep their row (turn
  // history attribution). null/'active' = seated; 'released' = departed.
  try {
    await run("ALTER TABLE characters ADD COLUMN status TEXT DEFAULT 'active';");
  } catch (e) {
    // Ignore error if column already exists
  }

  await run(`
    CREATE INDEX IF NOT EXISTS idx_characters_campaign ON characters (campaign_id)
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_characters_player_profile ON characters (player_character_id)
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS player_characters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      archetype TEXT NOT NULL,
      status TEXT DEFAULT 'available',
      active_campaign_id INTEGER,
      origin_campaign_id INTEGER,
      copied_from_character_id INTEGER,
      health INTEGER NOT NULL,
      max_health INTEGER NOT NULL,
      mana INTEGER NOT NULL,
      max_mana INTEGER NOT NULL,
      xp INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      inventory_json TEXT NOT NULL,
      attributes_json TEXT NOT NULL,
      abilities_json TEXT DEFAULT '[]',
      progression_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (active_campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL,
      FOREIGN KEY (origin_campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL,
      FOREIGN KEY (copied_from_character_id) REFERENCES player_characters(id) ON DELETE SET NULL
    )
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_player_characters_status ON player_characters (status)
  `);

  // Backfill reusable character profiles for campaigns created before the
  // player_characters table existed. Existing campaigns are treated as active.
  // Released members (M3) intentionally have a NULL profile link and must
  // never be resurrected as fresh checked-out profiles here.
  const orphanCharacterRows = await all(`
    SELECT *
    FROM characters
    WHERE player_character_id IS NULL
      AND COALESCE(status, 'active') = 'active'
  `);

  for (const character of orphanCharacterRows) {
    const profileResult = await run(
      `INSERT INTO player_characters (
        name, archetype, status, active_campaign_id, origin_campaign_id,
        health, max_health, mana, max_mana, xp, level,
        inventory_json, attributes_json, abilities_json, progression_notes
      ) VALUES (?, ?, 'checked_out', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        character.name,
        character.class,
        character.campaign_id,
        character.campaign_id,
        character.health,
        character.max_health,
        character.mana,
        character.max_mana,
        character.xp,
        character.level,
        character.inventory_json,
        character.attributes_json,
        character.abilities_json || '[]',
        character.progression_notes || ''
      ]
    );

    await run(
      `UPDATE characters SET player_character_id = ? WHERE id = ?`,
      [profileResult.id, character.id]
    );
  }

  // Create turns table
  await run(`
    CREATE TABLE IF NOT EXISTS turns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      turn_number INTEGER NOT NULL,
      player_action TEXT,
      narrative TEXT NOT NULL,
      state_changes_json TEXT,
      svg_illustration TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    )
  `);

  // Create unique index index on campaign_id + turn_number to prevent overlapping race conditions
  await run(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_turns_campaign_turn ON turns (campaign_id, turn_number)
  `);

  // Phase 3 M1: which character acted this turn (null on legacy turns and
  // turns with no acting character, e.g. the opening scene).
  try {
    await run('ALTER TABLE turns ADD COLUMN character_id INTEGER;');
  } catch (e) {
    // Ignore error if column already exists
  }

  // Create memories table
  await run(`
    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      turn_number INTEGER,
      importance INTEGER DEFAULT 3,
      summary TEXT NOT NULL,
      keywords TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    )
  `);

  try {
    await run('ALTER TABLE memories ADD COLUMN turn_number INTEGER;');
  } catch (e) {
    // Ignore error if column already exists
  }

  await run(`
    CREATE INDEX IF NOT EXISTS idx_memories_campaign_turn ON memories (campaign_id, turn_number)
  `);

  // Server-owned settings (Phase I1): operator-managed configuration such as AI
  // provider config, persisted server-side and never player-suppliable.
  await run(`
    CREATE TABLE IF NOT EXISTS server_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create npcs table
  await run(`
    CREATE TABLE IF NOT EXISTS npcs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      role TEXT,
      personality TEXT,
      quirks TEXT,
      relationship_value INTEGER DEFAULT 0,
      notes TEXT,
      status TEXT DEFAULT 'alive',
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    )
  `);

  // Create index for fast NPC lookups
  await run(`
    CREATE INDEX IF NOT EXISTS idx_npcs_campaign ON npcs (campaign_id)
  `);

  // Structured location state (Phase V2): locations are first-class entities
  // with a stored layout (areas/exits/features), a mutable occupancy layer,
  // and an identity anchor for future renders. Generated on first entry,
  // loaded on revisit, mutated only through the referee/continuity gate.
  await run(`
    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      key TEXT NOT NULL,
      description TEXT,
      layout_json TEXT NOT NULL,
      occupancy_json TEXT DEFAULT '[]',
      anchor_json TEXT,
      first_seen_turn INTEGER,
      last_seen_turn INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_campaign_key ON locations (campaign_id, key)
  `);

  // Engine-owned pointer to where the player currently is (the model never
  // "remembers" position; the engine holds it).
  try {
    await run('ALTER TABLE campaigns ADD COLUMN current_location_id INTEGER;');
  } catch (e) {
    // Ignore error if column already exists
  }

  // Engine-owned current_heroic pointer (Phase V3): which subject the heroic
  // visual shows, which render backs it, and when it last changed.
  try {
    await run('ALTER TABLE campaigns ADD COLUMN current_heroic_json TEXT;');
  } catch (e) {
    // Ignore error if column already exists
  }

  // Turn order (Phase 3 M2): round-robin state {order, current_index, round},
  // engine-owned like the location/heroic pointers.
  try {
    await run('ALTER TABLE campaigns ADD COLUMN turn_state_json TEXT;');
  } catch (e) {
    // Ignore error if column already exists
  }

  // Table-style dials (Phase D): {helpfulness, pacing}, campaign state,
  // adjustable mid-campaign (decision 2026-07-04).
  try {
    await run('ALTER TABLE campaigns ADD COLUMN table_style_json TEXT;');
  } catch (e) {
    // Ignore error if column already exists
  }

  // Sticky positional flag (Phase V5c): whether the last committed action
  // left the scene positional, so table-talk turns during a fight keep
  // showing the map (display only — table talk still mutates nothing).
  try {
    await run('ALTER TABLE campaigns ADD COLUMN last_positional INTEGER DEFAULT 0;');
  } catch (e) {
    // Ignore error if column already exists
  }

  // Visual identity anchor per NPC (Phase V3): descriptor + seed recorded at
  // first render so the same NPC renders as the same person (the visual
  // analog of the sticky voice profile below).
  try {
    await run('ALTER TABLE npcs ADD COLUMN anchor_json TEXT;');
  } catch (e) {
    // Ignore error if column already exists
  }

  // Generated renders (Phase V3): bytes live on disk under data/images/
  // (gitignored); this table is the authoritative index the authenticated
  // image route serves from.
  await run(`
    CREATE TABLE IF NOT EXISTS campaign_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      kind TEXT DEFAULT 'heroic',
      subject_key TEXT,
      file_path TEXT NOT NULL,
      mime_type TEXT DEFAULT 'image/png',
      created_turn INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_campaign_images_campaign ON campaign_images (campaign_id)
  `);

  // Voice identity as recorded state (Phase 2 groundwork, decision context in
  // plan.md "Voice of the Council"): stable voice profiles for the GM narrator
  // (per campaign) and each NPC — the audio analog of canon commitment.
  // Consumed once structured narration carries per-line speakers.
  try {
    await run('ALTER TABLE campaigns ADD COLUMN narrator_voice_json TEXT;');
  } catch (e) {
    // Ignore error if column already exists
  }
  try {
    await run('ALTER TABLE npcs ADD COLUMN voice_json TEXT;');
  } catch (e) {
    // Ignore error if column already exists
  }

  // Backfill sticky voice profiles for NPCs created before voice_json existed,
  // deterministic per campaign so revisited campaigns keep consistent voices.
  const voicelessNpcs = await all(`SELECT id, campaign_id, name, personality, quirks FROM npcs WHERE voice_json IS NULL ORDER BY campaign_id, id`);
  if (voicelessNpcs.length > 0) {
    const { assignNpcVoiceProfile } = await import('./tts-providers.js');
    let campaignCursor = null;
    let voiceIndex = 0;
    for (const npc of voicelessNpcs) {
      if (npc.campaign_id !== campaignCursor) {
        campaignCursor = npc.campaign_id;
        voiceIndex = 0;
      }
      await run(`UPDATE npcs SET voice_json = ? WHERE id = ?`, [JSON.stringify(assignNpcVoiceProfile(npc, voiceIndex)), npc.id]);
      voiceIndex++;
    }
    console.log(`Assigned voice profiles to ${voicelessNpcs.length} existing NPC(s).`);
  }

  console.log('Database initialized successfully at:', dbPath);
}
