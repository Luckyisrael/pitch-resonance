const db = require('better-sqlite3')('data/pitch.db');
const fixtureId = '18175983';
const frames = db.prepare(`
  SELECT seq, clock_sec, home_score, away_score, phase, action, team
  FROM fixture_frames
  WHERE fixture_id = ?
  ORDER BY seq
  LIMIT 10
`).all(fixtureId);
console.log('=== First 10 frames of Germany vs Paraguay ===');
for (const f of frames) {
  const min = Math.floor(f.clock_sec / 60);
  const sec = f.clock_sec % 60;
  console.log(`  seq=${f.seq} clock=${min}:${sec.toString().padStart(2,'0')} phase=${f.phase} score=${f.home_score}-${f.away_score} action=${f.action} team=${f.team}`);
}

const mid = db.prepare(`
  SELECT seq, clock_sec, home_score, away_score, phase, action, team
  FROM fixture_frames
  WHERE fixture_id = ? AND clock_sec BETWEEN 2700 AND 3600
  ORDER BY seq
  LIMIT 5
`).all(fixtureId);
console.log('\n=== Around half time ===');
for (const f of mid) {
  const min = Math.floor(f.clock_sec / 60);
  const sec = f.clock_sec % 60;
  console.log(`  seq=${f.seq} clock=${min}:${sec.toString().padStart(2,'0')} phase=${f.phase} score=${f.home_score}-${f.away_score} action=${f.action} team=${f.team}`);
}

const last = db.prepare(`
  SELECT seq, clock_sec, home_score, away_score, phase, action, team
  FROM fixture_frames
  WHERE fixture_id = ? AND phase = 13
  ORDER BY seq
  LIMIT 5
`).all(fixtureId);
console.log('\n=== Full time (phase 13) ===');
for (const f of last) {
  const min = Math.floor(f.clock_sec / 60);
  const sec = f.clock_sec % 60;
  console.log(`  seq=${f.seq} clock=${min}:${sec.toString().padStart(2,'0')} phase=${f.phase} score=${f.home_score}-${f.away_score} action=${f.action} team=${f.team}`);
}
db.close();
