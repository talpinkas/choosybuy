// ============================================================
// CHOOSY — Vision re-classification of NEXT products. Rule-based can't read the
// IMAGE, so girl items leak into boy segments via cross-sell carousels. This sends
// each product IMAGE+title to gpt-4o-mini and writes data/classifications.json
// (id -> {gender,category,color,color2,pattern,theme,style,kids}). Resumable +
// checkpointed + 429-safe (honors Retry-After, never drops an item).
//
//   $env:OPENAI_API_KEY="sk-..."   then   node tools/classify-vision.js
// ============================================================
'use strict';
const fs = require('fs');
const path = require('path');
const DATA = path.join(__dirname, '..', 'data', 'next-data.json');
const OUT = path.join(__dirname, '..', 'data', 'classifications.json');
const KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.VISION_MODEL || 'gpt-4o-mini';
const CONC = parseInt(process.env.VISION_CONC || '6', 10);
if (!KEY) { console.error('Set OPENAI_API_KEY first.'); process.exit(1); }

const CATS = ['tops','bottoms','dresses','bodysuits','swim','outerwear','nightwear','sets','shoes','accessories'];
const PATS = ['solid','stripes','floral','polkadot','graphic','character','hearts','animal','camo','plaid','other'];
const STYLES = ['casual','dressy','sporty','holiday','beach','sleep','school','other'];
const PROMPT =
  "You analyze a CHILDREN'S clothing/footwear/accessory product from its IMAGE and Hebrew title. " +
  'Return STRICT JSON only, choosing EXACTLY ONE value per field (never arrays, never pipes, never multiple options). Keys: ' +
  'gender (one of: boy, girl, unisex), ' +
  'category (one of: ' + CATS.join(', ') + '), ' +
  'color (dominant color as ONE Hebrew word), color2 (secondary color ONE Hebrew word or empty), ' +
  'pattern (one of: ' + PATS.join(', ') + '), ' +
  'theme (short Hebrew motif if any e.g. דינוזאור / חד-קרן / כדורגל / לבבות, else empty), ' +
  'style (one of: ' + STYLES.join(', ') + '), ' +
  'kids (true or false; false ONLY if clearly NOT a child item). ' +
  'gender = who the item is visually designed for (cut, print, colors); use unisex only if genuinely neutral. Judge mainly from the IMAGE; the title may mislead. JSON only.';

const products = JSON.parse(fs.readFileSync(DATA, 'utf8')).products;
let done = {};
try { done = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) {}
const todo = products.filter(p => p.image && p.id && !done[p.id]);
const LIMIT = parseInt(process.env.VISION_LIMIT || '0', 10);
const work = LIMIT > 0 ? todo.slice(0, LIMIT) : todo;
console.log('total ' + products.length + ' | already done ' + Object.keys(done).length + ' | to classify ' + todo.length + ' | conc ' + CONC);

const sleep = ms => new Promise(s => setTimeout(s, ms));
const one = v => Array.isArray(v) ? String(v[0] || '') : String(v == null ? '' : v).split(/[|\/,]/)[0].trim();
let i = 0, ok = 0, fail = 0, waited = 0, since = 0;
function saveCk() { fs.writeFileSync(OUT, JSON.stringify(done)); }

async function classify(p) {
  const body = { model: MODEL, max_tokens: 150, temperature: 0, response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: [
      { type: 'text', text: PROMPT + '\nTitle: ' + (p.name || '').slice(0, 120) },
      { type: 'image_url', image_url: { url: p.image, detail: 'low' } } ] }] };
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST',
        headers: { 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (r.status === 429 || r.status >= 500) {
        const ra = parseFloat(r.headers.get('retry-after')) || (2 * (attempt + 1));
        waited++; await sleep(Math.min(ra, 30) * 1000 + 400); continue;
      }
      if (r.status !== 200) { await sleep(800); if (attempt >= 4) return null; continue; }
      const j = await r.json();
      const txt = j.choices && j.choices[0] && j.choices[0].message.content;
      const o = JSON.parse(txt);
      const gender = ['boy','girl','unisex'].includes(o.gender) ? o.gender : null;
      const cat = CATS.includes(o.category) ? o.category : null;
      if (!gender && !cat) throw new Error('no usable fields');
      return { gender, category: cat, color: one(o.color), color2: one(o.color2),
        pattern: one(o.pattern), theme: String(o.theme || '').slice(0, 24), style: one(o.style), kids: o.kids !== false };
    } catch (e) { if (attempt >= 9) return null; await sleep(900); }
  }
  return null;
}

async function worker() {
  while (i < work.length) {
    const p = work[i++];
    const res = await classify(p);
    if (res) { done[p.id] = res; ok++; } else { fail++; }
    if (++since >= 50) { since = 0; saveCk(); process.stdout.write('  ...' + (ok + fail) + '/' + work.length + ' (ok ' + ok + ', fail ' + fail + ', rate-waits ' + waited + ')\n'); }
  }
}

(async () => {
  const t0 = Date.now();
  await Promise.all(Array.from({ length: CONC }, worker));
  saveCk();
  console.log('DONE. ok=' + ok + ' fail=' + fail + ' | total in file=' + Object.keys(done).length + ' | ' + ((Date.now() - t0) / 60000).toFixed(1) + ' min');
  console.log('Next: node tools/import-next-data.js');
})();
