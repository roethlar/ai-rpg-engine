// cr-2 guard check: run from a FRESH worktree (isolated data/ dir). Verifies
// the startup orphan backfill cannot resurrect a deliberately released
// profile link. Scenario: legacy-style orphan appears, initDb links it, the
// link is released (campaign-card detach), initDb runs again — the release
// must survive. FAIL = the second initDb minted a duplicate profile.
import { initDb, run, get } from '../../../db.js';

await initDb(); // first boot (with the fix, the one-shot flag is set here)
await run(`INSERT INTO campaigns (title, genre) VALUES ('cr2-guard', 'g')`);
const campaign = await get(`SELECT id FROM campaigns WHERE title = 'cr2-guard' ORDER BY id DESC`);
await run(
  `INSERT INTO characters (campaign_id, name, class, health, max_health, mana, max_mana, inventory_json, attributes_json)
   VALUES (?, 'GuardChar', 'c', 1, 1, 1, 1, '[]', '{}')`,
  [campaign.id]
);
await initDb(); // may link the orphan (legacy behavior)
await run(`UPDATE characters SET player_character_id = NULL WHERE campaign_id = ?`, [campaign.id]); // the release
const before = (await get(`SELECT count(*) AS c FROM player_characters WHERE name = 'GuardChar'`)).c;
await initDb(); // the restart
const after = (await get(`SELECT count(*) AS c FROM player_characters WHERE name = 'GuardChar'`)).c;

if (after > before) {
  console.log(`FAIL: restart minted ${after - before} duplicate profile(s) after release (${before} -> ${after})`);
  process.exit(1);
}
console.log(`PASS: release survives restart (profiles: ${before} -> ${after})`);
process.exit(0);
