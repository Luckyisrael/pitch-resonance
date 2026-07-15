const db = require('better-sqlite3')('data/pitch.db');
db.pragma('journal_mode = WAL');

// Replicate getFrameCount logic:
const count = db.prepare('SELECT COUNT(*) as cnt FROM fixture_frames WHERE fixture_id = ?').get('18175983');
console.log('fixture_frames count:', count.cnt);

// Replicate getTelemetryFrameCount logic:
const tcount = db.prepare('SELECT COUNT(*) as cnt FROM telemetry_frames WHERE match_id = ?').get('18175983');
console.log('telemetry_frames count:', tcount ? tcount.cnt : 'table empty');

// Check all fixture_frames fixture_ids
const ids = db.prepare('SELECT DISTINCT fixture_id FROM fixture_frames').all();
console.log('Distinct fixture_ids:', ids.map(r=>r.fixture_id).join(', '));

// How many frames per fixture?
for (const id of ids) {
  const c = db.prepare('SELECT COUNT(*) as cnt FROM fixture_frames WHERE fixture_id = ?').get(id.fixture_id);
  console.log(`  ${id.fixture_id}: ${c.cnt} frames`);
}
db.close();
