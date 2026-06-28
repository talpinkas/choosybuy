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
// Accessories sub-types (2-8 only). Anything not matched is archived (not written).
const ACC_SUB = [
  ['hats', /כובע|טורבן|כומתה|מצחי|ברט|\bhat\b|\bcap\b|beanie/i],
  ['socks', /גרב|קרסולי|גרביונ|טייץ|\bsock|tights/i],
  ['bags', /תיק|ילקוט|קלמר|\bbag\b|backpack|מזוודה/i],
  ['sunglasses', /משקפ|sunglass/i]
];
function accSub(name) { for (const [k, re] of ACC_SUB) if (re.test(name)) return k; return null; }
// An outfit-set dissolves into the garment categories its title names.
function setGarments(name) {
  const out = [];
  if (/חולצ|טי\b|גופי|סווט|טופ|פולו|סריג/.test(name)) out.push('tops');
  if (/מכנס|שורט|טייץ|לגינ|ברמודה/.test(name)) out.push('bottoms');
  if (/שמל|חצאית/.test(name)) out.push('dresses');
  return out.length ? [...new Set(out)] : ['tops'];
}
// Resolve a raw category to the list of output categories + whether it's a set.
function resolveCats(cat, name) {
  if (cat === 'sets') return { cats: setGarments(name), isSet: true };
  if (cat === 'accessories') { const s = accSub(name); return { cats: s ? [s] : [], isSet: false }; }
  return { cats: [cat], isSet: false };
}
function packOf(name) { const m = String(name).match(/מארז\s*של\s*(\d+)/); return m ? +m[1] : (/מארז/.test(name) ? 2 : 1); }
function colorOf(name) { const m = String(name).match(/^\s*(?:בצבע|צבע)?\s*([^\-–]{1,40}?)\s*[-–]\s/); return m ? m[1].replace(/\s+/g, ' ').trim() : ''; }
function cleanTitle(n) { return String(n || '').replace(/^\s*(?:בצבע|צבע)\s+[^\-–]+[-–]\s*/, '').replace(/\s+/g, ' ').trim(); }

// age range in name -> ['0-2'] / ['2-8'] / both ; teen-only (>8 only) -> []
// Parses Hebrew AND English age strings (NEXT mixes both, e.g. "0-18mths",
// "3 months to 7 years", "גיל 3 חודשים עד 7 שנים"), single ages, cm sizing,
// and newborn labels. Months/years are normalised to years before bucketing.
const AGE_UNIT = 'חודשים|חודש|שנים|שנה|שנ|months?|mths?|mos?|mo|yrs?|years?|y';
function toYears(v, unit) {
  // months get a hair shaved off so an upper bound of exactly 24m reads as <2y
  // (a "0-24 months" item is a baby item, not a 2-8 kids item).
  return /חודש|month|mth|mos?\b|\bmo\b/i.test(unit || '') ? (+v / 12 - 0.001) : +v;
}
function bucketize(a, b) {
  const lo = Math.min(a, b), hi = Math.max(a, b), out = [];
  if (lo < 2) out.push('0-2');                 // range reaches into the baby years
  if (hi >= 2 && lo < 8) out.push('2-8');      // range reaches into the kids years
  return out;                                  // may be [] (teen-only) -> dropped upstream
}
function agesFor(name) {
  const s = String(name);
  // explicit range: "<n><unit?> <sep> <n><unit?>"  (sep = עד / to / hyphen)
  let m = s.match(new RegExp('(\\d+)\\s*(' + AGE_UNIT + ')?\\s*(?:עד|to|[-–‏])\\s*(\\d+)\\s*(' + AGE_UNIT + ')?', 'i'));
  if (m) {
    const u1 = m[2] || m[4] || 'שנים', u2 = m[4] || m[2] || 'שנים';
    return bucketize(toYears(m[1], u1), toYears(m[3], u2));
  }
  // cm sizing
  const cm = s.match(/(\d{2,3})\s*[-–]?\s*(\d{2,3})?\s*cm/i);
  if (cm) { const lo = +cm[1], hi = cm[2] ? +cm[2] : +cm[1]; const o = []; if (lo <= 98) o.push('0-2'); if (hi >= 92) o.push('2-8'); return o.length ? o : ['2-8']; }
  // single age: "(3 months)" / "גיל 6 חודשים" / "5 years"
  const sm = s.match(new RegExp('(\\d+)\\s*(' + AGE_UNIT + ')\\b', 'i'));
  if (sm) { const y = toYears(sm[1], sm[2]); return bucketize(y, y); }
  // no number, but a newborn/baby-only label -> 0-2
  if (/newborn|new born|\bNB\b|תינוק|בייבי|מארז לידה/i.test(s)) return ['0-2'];
  return ['2-8']; // truly unknown -> kids bucket (conservative; QA reviews)
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
  if (c === 'hats' || c === 'socks' || c === 'bags' || c === 'sunglasses') return a === '2-8';
  return true;
}

const data = JSON.parse(fs.readFileSync(SRC, 'utf8'));
let CLS = {};
try { CLS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'classifications.json'), 'utf8')); console.log('using vision classifications: ' + Object.keys(CLS).length); } catch (e) {}
const products = data.products || [];
console.log('source: ' + SRC + ' | raw: ' + products.length);

const buckets = {};
let dropped = 0, teen = 0, archived = 0;
const seen = {};
products.forEach(p => {
  if (!p.name || p.max == null || seen[p.id]) { if (seen[p.id]) return; dropped++; return; }
  seen[p.id] = true;
  const _cls = CLS[p.id];
  if (_cls && _cls.kids === false) { dropped++; return; }
  const rawCat = (_cls && _cls.category) ? _cls.category : (p.cat || categoryOf(p.name));   // section hint (footwear/swim) wins over name guess
  const { cats, isSet } = resolveCats(rawCat, p.name);   // sets -> garment cats; accessories -> sub-type or archived
  if (!cats.length) { archived++; return; }               // archived accessory (baby-care/gloves/hair/belt/other)
  const ages = agesFor(p.name);
  if (!ages.length) { teen++; return; }            // teen-only, out of pilot scope
  const genders = (_cls && _cls.gender) ? (_cls.gender === 'unisex' ? ['boy', 'girl'] : [_cls.gender]) : gendersFor(p.gender, p.name);
  const pack = packOf(p.name);
  const prod = {
    id: 'next-' + p.id, title: cleanTitle(p.name), image: p.image,
    price: p.max, sale_price: (p.min != null && p.min < p.max) ? p.min : null, currency: 'ILS',
    url: p.url, brand: 'NEXT', color: (_cls && _cls.color) ? _cls.color : colorOf(p.name), color_hex: null,
    pattern: (_cls && _cls.pattern) || '', theme: (_cls && _cls.theme) || '', style: (_cls && _cls.style) || '', color2: (_cls && _cls.color2) || '',
    pack: pack, in_pack: pack > 1, is_set: isSet, affiliate_ready: false
  };
  genders.forEach(g => ages.forEach(a => cats.forEach(c => {
    if (!validSeg(g, a, c)) return;
    const cid = 'next-' + g + '-' + a + '-' + c;
    (buckets[cid] = buckets[cid] || []).push(prod);
  })));
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

console.log('teen-only dropped: ' + teen + ' | archived (accessories): ' + archived + ' | bad dropped: ' + dropped);
console.log('written ' + written.length + ' catalogs:\n  ' + written.join(' | '));
console.log('index.js registers ' + files.length + ' catalogs');
