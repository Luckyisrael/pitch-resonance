const db = require('better-sqlite3')('data/pitch.db');
const fid = '18175983';

// Find halftime_finalised in frames
const ht = db.prepare(`
  SELECT seq, clock_sec, home_score, away_score, phase, action, team
  FROM fixture_frames WHERE fixture_id = ? AND action = 'halftime_finalised'
`).all(fid);
console.log('=== Halftime finalised events ===');
for (const f of ht) console.log(`  seq=${f.seq} clock=${Math.floor(f.clock_sec/60)}:${(f.clock_sec%60).toString().padStart(2,'0')} phase=${f.phase} score=${f.home_score}-${f.away_score}`);

// Show events around where phase changes
console.log('\n=== Around halftime boundary (seq 555-575) ===');
const around = db.prepare(`
  SELECT seq, clock_sec, home_score, away_score, phase, action, team
  FROM fixture_frames WHERE fixture_id = ? AND seq BETWEEN 555 AND 575
  ORDER BY seq
`).all(fid);
for (const f of around) console.log(`  seq=${f.seq} clock=${Math.floor(f.clock_sec/60)}:${(f.clock_sec%60).toString().padStart(2,'0')} phase=${f.phase} score=${f.home_score}-${f.away_score} action=${f.action || '-'} team=${f.team}`);

// Check penalty shootout frames
console.log('\n=== Penalty shootout frames (seq > 1530) ===');
const pens = db.prepare(`
  SELECT seq, clock_sec, home_score, away_score, phase, action, team
  FROM fixture_frames WHERE fixture_id = ? AND seq > 1530
  ORDER BY seq LIMIT 10
`).all(fid);
for (const f of pens) console.log(`  seq=${f.seq} clock=${Math.floor(f.clock_sec/60)}:${(f.clock_sec%60).toString().padStart(2,'0')} phase=${f.phase} score=${f.home_score}-${f.away_score} action=${f.action || '-'} team=${f.team}`);

db.close();
