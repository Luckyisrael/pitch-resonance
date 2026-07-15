const db = require('better-sqlite3')('data/pitch.db');
const r = db.prepare('SELECT raw_data FROM fixture_raw WHERE fixture_id = ?').get('18175983');
if (!r) { console.log('no fixture_raw'); db.close(); process.exit(0); }
const lines = r.raw_data.split('\n');
let goals = [];
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (l.includes('"Goal"')) {
    const dataLine = l.startsWith('data: ') ? l.slice(6) : '';
    if (dataLine) {
      try { 
        const p = JSON.parse(dataLine);
        goals.push({action: p.Action, participant: p.Participant, confirmed: p.Confirmed, confirmedType: typeof p.Confirmed, clock: p.Clock, dataKeys: p.Data ? Object.keys(p.Data) : []});
      } catch(e) { }
    }
  }
}
console.log('Goal count:', goals.length);
for (const g of goals) {
  console.log(JSON.stringify(g));
}
db.close();
