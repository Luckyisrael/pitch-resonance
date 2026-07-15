const db = require('better-sqlite3')('data/pitch.db');
const r = db.prepare('SELECT raw_data FROM fixture_raw WHERE fixture_id = ?').get('18175983');
const lines = r.raw_data.split('\n');
let clockSecs = [];
let currentData = '';
for (const line of lines) {
  if (line.startsWith('data: ')) currentData = line.slice(6);
  else if (line.startsWith('id: ') && currentData) {
    try {
      const obj = JSON.parse(currentData);
      const cs = obj.Clock?.Seconds;
      if (cs !== undefined) clockSecs.push(cs);
    } catch(e) {}
    currentData = '';
  }
}
// Show unique clockSec values sorted
const unique = [...new Set(clockSecs)].sort((a,b)=>a-b);
console.log('Total events:', clockSecs.length);
console.log('Unique clockSec values:', unique.length);
console.log('First 30 unique clockSec:', unique.slice(0, 30));
console.log('Last 30 unique clockSec:', unique.slice(-30));
// Show gaps
let maxGap = 0; let maxGapIdx = 0;
for (let i = 1; i < clockSecs.length; i++) {
  const gap = clockSecs[i] - clockSecs[i-1];
  if (gap > maxGap) { maxGap = gap; maxGapIdx = i; }
}
console.log(`\nMax gap: ${maxGap}s at index ${maxGapIdx}`);
console.log(`  clockSec[${maxGapIdx-1}]: ${clockSecs[maxGapIdx-1]}`);
console.log(`  clockSec[${maxGapIdx}]: ${clockSecs[maxGapIdx]}`);
db.close();
