// Quick NEXT catalog QA — prints a SHORT summary (run after import-next-data.js).
'use strict';
const fs = require('path') && require('fs'); const path = require('path');
const DIR = path.join(__dirname, '..', 'catalogs');
const files = fs.readdirSync(DIR).filter(f => /^next-.*\.json$/.test(f));
const segs = {}, byId = {}; let total = 0;
files.forEach(f => { const c = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  const k = c.catalog_id.replace('next-', ''); segs[k] = c.products; total += c.products.length;
  c.products.forEach(p => (byId[p.id] = byId[p.id] || []).push(k)); });
const keys = Object.keys(segs).sort();
const u8 = [], u50 = [];
keys.forEach(k => { const n = segs[k].length; if (n < 8) u8.push(k + '(' + n + ')'); else if (n < 50) u50.push(k + '(' + n + ')'); });
// gender dual-listing
let dual = 0; Object.values(byId).forEach(ks => { if (new Set(ks.map(k => k.split('-')[0])).size > 1) dual++; });
// category sanity heuristic
function flag(t, cat) {
  if (cat === 'tops' && /מכנס|שורט|טייץ|חצאית/.test(t)) return 1;
  if (cat === 'bottoms' && /חולצ|טופ\b/.test(t) && !/מכנס|שורט|טייץ|חצאית|לגינ/.test(t)) return 1;
  if (cat === 'dresses' && /מכנס(?!\s*מתחת)/.test(t) && !/שמל|טוניק|חצא/.test(t)) return 1;
  return 0; }
let conf = 0; const ex = [];
keys.forEach(k => { const cat = k.split('-').slice(2).join('-'); segs[k].forEach(p => { if (flag(p.title || '', cat)) { conf++; if (ex.length < 4) ex.push(cat + ' <- ' + (p.title || '').slice(0, 35)); } }); });
// color coverage
let col = 0, packs = 0; keys.forEach(k => segs[k].forEach(p => { if (p.color && p.color.trim()) col++; if (p.in_pack) packs++; }));
console.log('SEGMENTS: ' + keys.length + ' | total rows: ' + total);
console.log('UNDER 8: ' + (u8.join(', ') || 'none'));
console.log('8-49: ' + (u50.join(', ') || 'none'));
console.log('>=50: ' + keys.filter(k => segs[k].length >= 50).length + '/' + keys.length);
console.log('gender dual-listed: ' + dual);
console.log('category conflicts: ' + conf + (ex.length ? ' | e.g. ' + JSON.stringify(ex) : ''));
console.log('color coverage: ' + (100 * col / total).toFixed(0) + '% | pack-flagged: ' + packs);
