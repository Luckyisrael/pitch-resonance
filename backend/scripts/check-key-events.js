const db = require('better-sqlite3')('data/pitch.db');
const r = db.prepare('SELECT raw_data FROM fixture_raw WHERE fixture_id = ?').get('18175983');
if (!r) { process.exit(0); }
const lines = r.raw_data.split('\n');
let events = [];
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (l.startsWith('data: ')) {
    try {
      const p = JSON.parse(l.slice(6));
      const a = p.Action || '';
      const seq = parseInt(lines[i+1]?.startsWith('id: ') ? lines[i+1].slice(4) : '0');
      events.push({ action: a, seq, participant: p.Participant, confirmed: p.Confirmed, clockSec: p.Clock?.Seconds, data: p.Data || {} });
    } catch(e) { }
  }
}
// Show goal, var, discard, halftime_finalised, game_finalised, penalty_outcome sequence
const keyActions = ['goal','var','var_end','action_discarded','halftime_finalised','game_finalised','penalty_outcome','penalty_shootout_team'];
console.log('=== Key events in sequence ===');
for (const e of events) {
  if (keyActions.includes(e.action)) {
    console.log(`  [${e.clockSec || '???'}s] seq=${e.seq} ${e.action} p=${e.participant} confirmed=${e.confirmed} data=${JSON.stringify(Object.keys(e.data))}`);
  }
}
console.log('\n=== Full goal+var+discard details ===');
for (const e of events) {
  if (['goal','var','var_end','action_discarded','halftime_finalised','game_finalised'].includes(e.action)) {
    console.log(`  [${e.clockSec || '???'}s] seq=${e.seq} ${e.action} p=${e.participant} confirmed=${e.confirmed} data=${JSON.stringify(e.data).slice(0,200)}`);
  }
}
db.close();
