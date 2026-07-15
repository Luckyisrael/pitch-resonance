const db = require('better-sqlite3')('data/pitch.db');
const r = db.prepare('SELECT raw_data FROM fixture_raw WHERE fixture_id = ?').get('18175983');
if (!r) { console.log('no fixture_raw'); process.exit(0); }
const lines = r.raw_data.split('\n');
let actions = {};
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (l.startsWith('data: ')) {
    try {
      const p = JSON.parse(l.slice(6));
      const a = p.Action || 'NO_ACTION';
      if (!actions[a]) actions[a] = 0;
      actions[a]++;
    } catch(e) { }
  }
}
console.log('Actions by type:');
for (const [k, v] of Object.entries(actions).sort((a,b)=>b[1]-a[1])) {
  console.log(`  ${k}: ${v}`);
}
db.close();
