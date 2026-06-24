// ============================================================
// CHOOSY — Import the browser-scraped NEXT kids/baby data into catalogs.
// ============================================================
// Reads next-data.json (downloaded from the browser scrape: each product has
// href, id, name (Hebrew, carries color+pack+age), min/max price, gender,
// url, image). Classifies category/age/gender/color/pack and writes
// catalogs/next-<gender>-<age>-<category>.json for valid pilot segments.
//
//   node tools/import-next-data.js          (looks for ./next-data.json or ./data/next-data.json)
//   node tools/import-next-data.js <path>   (explicit)
//
// Single-site pilot: this WIPES all old non-NEXT + old next-* catalogs and
// writes ONLY NEXT, then refreshes the index. (Other retailers stay in git
// history; the pilot serves NEXT only.)
// ============================================================
'use strict';
const fs = require('fs');
const path = require('path');
const CAT_DIR = path.join(__dirname, '..', 'catalogs');

const SRC = process.argv[2]
  || [path.join(__dirname, '..', 'next-data.json'), path.join(__dirname, '..', 'data', 'next-data.json')]
       .find(p => fs.existsSync(p));
if (!SRC || !fs.existsSync(SRC)) { console.log('next-data.json not found. Put it in the choosybuy folder, or pass a path.'); process.exit(1); }

// ---- classification ----------------------------------------------------------
function categoryOf(name) {
  const n = name || '';
  if (/נעל|סנדל|כפכף|מגף/.test(n)) return 'shoes';
  if (/כובע|כפפ|גרב|צעיף|חגור\b|תיק\b|מצחי|משקפ|סיכת|גרביונ/.test(n)) return 'accessories';
  if (/בגד[יי]?\s*ים|ביקיני|בגד-ים|חליפת ים/.test(n)) return 'swim';
  if (/שמל|טוניק/.test(n)) return 'dresses';
  if (/בגד[יי]?\s*גוף|אוברול|רומפר|סרבל|בייביגרו/.test(n)) return 'bodysuits';
  if (/פיג'מ|פיג׳מ|חלוק|בגד שינה|כותונת לילה/.test(n)) return 'nightwear';
  if (/מעיל|ג'קט|ג׳קט|פליז|אנורק|פארקה|קפוצ'ון|ווינדברייקר|מעילים/.test(n)) return 'outerwear';
  const hasTop = /חולצ|טי\b|גופ|סווט|טופ|פולו|סריג/.test(n);
  const hasBottom = /מכנס|שורט|טייץ|חצאית|לגינ/.test(n);
  if ((/^\s*סט\b|סט של|מערכת/.test(n)) && hasTop && hasBottom) return 'sets';   // true multi-garment set
  if (/מכנס|שורט|טייץ|ג'ינס|חצאית|לגינ|ברמודה/.test(n)) return 'bottoms';
  if (hasTop) return 'tops';
  return 'tops';
}
function packOf(name) { const m = String(name).match(/מארז\s*של\s*(\d+)/); return m ? +m[1] : (/מארז/.test(name) ? 2 : 1); }
function colorOf(name) { const m = String(name).match(/^\s*(?:בצבע|צבע)\s+([^\-–]+?)\s*[-–]/); return m ? m[1].replace(/\s+/g, ' ').trim() : ''; }
function cleanTitle(n) { return String(n || '').replace(/^\s*(?:בצבע|צבע)\s+[^\-–]+[-–]\s*/, '').replace(/\s+/g, ' ').trim(); }

// age range in name -> ['0-2'] / ['2-8'] / both ; teen-only (>8 only) -> []
function agesFor(name) {
  let m = String(name).match(/(\d+)\s*(חודשים|חודש|שנים|שנה|שנ)?\s*(?:עד|-|–|‏)\s*(\d+)\s*(חודשים|חודש|שנים|שנה|שנ)?/);
  if (!m) {
    const cm = String(name).match(/(\d{2,3})\s*[-–]?\s*(\d{2,3})?\s*cm/i);
    if (cm) { const lo = +cm[1], hi = cm[2] ? +cm[2] : +cm[1]; const o = []; if (lo <= 98) o.push('0-2'); if (hi >= 92) o.push('2-8'); return o.length ? o : ['2-8']; }
    return ['2-8']; // unknown -> kids bucket (conservative; QA reviews)
  }
  const yr = (v, u) => (/חודש/.test(u || '') ? +v / 12 : +v);
  let a = yr(m[1], m[2] || m[4] || 'שנים'), b = yr(m[3], m[4] || m[2] || 'שנים');
  const lo = Math.min(a, b), hi = Math.max(a, b), out = [];
  if (lo <= 2) out.push('0-2');
  if (lo < 8 && hi >= 2) out.push('2-8');         // overlaps the 2-8 kids bucket
  return out;                                      // may be [] for teen-only items -> dropped
}
function gendersFor(g, name) {
  if (g === 'boy') return ['boy'];
  if (g === 'girl') return ['girl'];
  if (/בנות|לבנות|girls?/i.test(name)) return ['girl'];
  if (/בנים|לבנים|boys?/i.test(name)) return ['boy'];
  return ['boy', 'girl']; // unisex baby -> both
}
function validSeg(g, a, c) {
  if (c === 'bodysuits') return a === '0-2';
  if (c === 'dresses') return g === 'girl';
  return true;
}

const data = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const products = data.products || [];
console.log('source: ' + SRC + ' | raw: ' + products.length);

const buckets = {};
let dropped = 0, teen = 0;
const seen = {};
products.forEach(p => {
  if (!p.name || p.max == null || seen[p.id]) { if (seen[p.id]) return; dropped++; return; }
  seen[p.id] = true;
  const cat = p.cat || categoryOf(p.name);   // section hint (footwear/swim) wins over name guess
  const ages = agesFor(p.name);
  if (!ages.length) { teen++; return; }            // teen-only, out of pilot scope
  const genders = gendersFor(p.gender, p.name);
  const pack = packOf(p.name);
  const prod = {
    id: 'next-' + p.id, title: cleanTitle(p.name), image: p.image,
    price: p.max, sale_price: (p.min != null && p.min < p.max) ? p.min : null, currency: 'ILS',
    url: p.url, brand: 'NEXT', color: colorOf(p.name), color_hex: null,
    pack: pack, in_pack: pack > 1, affiliate_ready: false
  };
  genders.forEach(g => ages.forEach(a => {
    if (!validSeg(g, a, cat)) return;
    const cid = 'next-' + g + '-' + a + '-' + cat;
    (buckets[cid] = buckets[cid] || []).push(prod);
  }));
});

// SINGLE-SITE: wipe ALL existing catalog json, write only NEXT
fs.readdirSync(CAT_DIR).filter(f => /\.json$/.test(f)).forEach(f => fs.unlinkSync(path.join(CAT_DIR, f)));
const written = [];
Object.keys(buckets).sort().forEach(cid => {
  const m = cid.match(/^next-(boy|girl)-(0-2|2-8)-(\w+)$/);
  fs.writeFileSync(path.join(CAT_DIR, cid + '.json'), JSON.stringify({
    catalog_id: cid, site: 'NEXT', segment: { gender: m[1], age: m[2], category: m[3] },
    updated_at: new Date().toISOString().slice(0, 10), products: buckets[cid]
  }, null, 2));
  written.push(cid.replace('next-', '') + '(' + buckets[cid].length + ')');
});
const files = fs.readdirSync(CAT_DIR).filter(f => /\.json$/.test(f)).sort();
fs.writeFileSync(path.join(CAT_DIR, 'index.js'),
  '// Choosy catalogs registry — AUTO-GENERATED (NEXT single-site pilot).\n\nmodule.exports = [\n' +
  files.map(f => "  require('./" + f + "')").join(',\n') + '\n];\n');

console.log('teen-only dropped: ' + teen + ' | bad dropped: ' + dropped);
console.log('written ' + written.length + ' catalogs:\n  ' + written.join(' | '));
console.log('index.js registers ' + files.length + ' catalogs');
