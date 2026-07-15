const db = require('better-sqlite3')('data/pitch.db');
const fid = '18175983';

// Same logic as getFrames with stride=1
const rows = db.prepare('SELECT seq, clock_sec as clockSec, pixel_data as pixelData, possession, ball_x as ballX, ball_y as ballY, home_score as homeScore, away_score as awayScore, phase, action, team FROM fixture_frames WHERE fixture_id = ? ORDER BY seq ASC').all(fid);
console.log('Raw rows from SQL:', rows.length);

// Apply stride=1 filter
const filtered = rows.filter((_, i) => i % 1 === 0);
console.log('After stride=1 filter:', filtered.length);

// Check the home_score values in first and last few
console.log('\nFirst 3 scores:', filtered.slice(0,3).map(r => r.homeScore + '-' + r.awayScore));
console.log('Last 3 scores:', filtered.slice(-3).map(r => r.homeScore + '-' + r.awayScore));

// Price check: how many distinct scores?
const scoreChanges = [];
let prev = {home: -1, away: -1};
for (const r of filtered) {
  if (r.homeScore !== prev.home || r.awayScore !== prev.away) {
    scoreChanges.push({ seq: r.seq, clock: r.clockSec, score: r.homeScore + '-' + r.awayScore, phase: r.phase });
    prev = {home: r.homeScore, away: r.awayScore};
  }
}
console.log('\nScore changes:', scoreChanges.length);
for (const sc of scoreChanges) {
  console.log(`  seq=${sc.seq} clock=${sc.clock}s score=${sc.score} phase=${sc.phase}`);
}
db.close();
