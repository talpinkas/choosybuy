// ============================================================
// CHOOSY — Fox (fox.co.il) catalog builder — AUTOMATED.
// ============================================================
// Fox runs on Shopify with an open /products.json. It's a multi-department
// brand, so we fetch the 4 gender×age KIDS collections directly (clean gender
// + age), and derive the category from product_type/title.
//
//   node tools/build-fox.js
//
// - gender + age ← the collection (בייבי-* = 0-2, boys/בנות-1 = 2-8).
// - category     ← product_type + title (tops/bottoms/bodysuits/dresses/swim;
//   shoes/accessories — no match — are skipped).
// - price/sale ← variant.price / compare_at_price; image ← images[0].src;
//   url ← /products/<handle>.
// Writes catalogs/fox-<gender>-<age>-<category>.json for app-valid segments and
// refreshes catalogs/index.js (globs every catalogs/*.json).
// ============================================================
'use strict';
var fs = require('fs');
var path = require('path');
var CAT_DIR = path.join(__dirname, '..', 'catalogs');
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
var SITE = 'https://www.fox.co.il';

var COLLECTIONS = [
  { handle: 'בייבי-בנים', gender: 'boy', age: '0-2' },
  { handle: 'בייבי-בנות', gender: 'girl', age: '0-2' },
  { handle: 'boys', gender: 'boy', age: '2-8' },
  { handle: 'בנות-1', gender: 'girl', age: '2-8' }
];

var VALID = {
  'boy|0-2': ['tops', 'bodysuits', 'swim'],
  'girl|0-2': ['tops', 'bodysuits', 'dresses', 'swim'],
  'boy|2-8': ['tops', 'bottoms', 'swim'],
  'girl|2-8': ['tops', 'bottoms', 'dresses', 'swim']
};
function validSeg(g, a, c) { return (VALID[g + '|' + a] || []).indexOf(c) !== -1; }

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function today() { return new Date().toISOString().slice(0, 10); }

// product_type + title -> category, or null to skip (shoes/accessories)
function categoryOf(s) {
  if (/בגד[יי]?\s*ים/.test(s)) return 'swim';
  if (/שמל|טוניק/.test(s)) return 'dresses';
  if (/בגד[יי]?\s*גוף|אוברול|בייביגרו|רומפר|סרבל/.test(s)) return 'bodysuits';
  if (/מכנס|חצאית|טייץ|ג'ינס|שורט|ברמודה|לגינ/.test(s)) return 'bottoms';
  if (/חולצ|גופי|פוטר|סווטשירט|סווט שירט|מקטורן|סריג|\bטופ\b|טישרט|טי-?שירט|מיינט/.test(s)) return 'tops';
  return null;
}
var COLORS = ['שמנת', 'לבן', 'שחור', 'אפור', 'ורוד', 'כחול', 'תכלת', 'נייבי', 'ירוק', 'אדום', 'צהוב', 'סגול', 'חום', 'בז\'', 'כתום', 'חרדל', 'זית', 'מולטי', 'צבעוני'];
function colorOf(title) { for (var i = 0; i < COLORS.length; i++) if (title.indexOf(COLORS[i]) !== -1) return COLORS[i]; return ''; }

async function fetchCollection(handle) {
  var all = [];
  for (var pg = 1; pg <= 12; pg++) {
    var r = await fetch(SITE + '/collections/' + encodeURIComponent(handle) + '/products.json?limit=250&page=' + pg, { headers: { 'User-Agent': UA } });
    if (!r.ok) break;
    var items = ((await r.json()).products) || [];
    all = all.concat(items);
    if (items.length < 250) break;
    await sleep(200);
  }
  return all;
}

function refreshIndex() {
  var files = fs.readdirSync(CAT_DIR).filter(function (f) { return /\.json$/.test(f); }).sort();
  var body = '// Choosy catalogs registry — AUTO-GENERATED (every catalogs/*.json).\n' +
    '// require() with a static path is bundled reliably by Vercel.\n\n' +
    'module.exports = [\n' + files.map(function (f) { return "  require('./" + f + "')"; }).join(',\n') + '\n];\n';
  fs.writeFileSync(path.join(CAT_DIR, 'index.js'), body);
  return files.length;
}

async function main() {
  var buckets = {};
  for (var col of COLLECTIONS) {
    var prods = await fetchCollection(col.handle);
    var kept = 0;
    prods.forEach(function (p) {
      var category = categoryOf((p.product_type || '') + ' ' + (p.title || ''));
      if (!category || !validSeg(col.gender, col.age, category)) return;
      var v = (p.variants || [])[0] || {};
      var cur = parseFloat(v.price) || 0, cmp = parseFloat(v.compare_at_price) || 0;
      if (!cur) return;
      var img = (p.images && p.images[0] && p.images[0].src) || '';
      if (!img) return;
      var id = 'fox-' + col.gender + '-' + col.age + '-' + category;
      var prod = {
        id: 'fox-' + (p.id || p.handle),
        title: String(p.title || '').replace(/\s+/g, ' ').trim(),
        image: img,
        price: cmp > cur ? cmp : cur, sale_price: cmp > cur ? cur : null, currency: 'ILS',
        url: SITE + '/products/' + encodeURIComponent(p.handle),
        brand: 'Fox', color: colorOf(p.title || ''), color_hex: null, affiliate_ready: false
      };
      (buckets[id] = buckets[id] || []).push(prod);
      kept++;
    });
    console.log('  ' + col.handle + ' (' + col.gender + '/' + col.age + '): ' + prods.length + ' fetched, ' + kept + ' kept');
  }

  var written = [];
  Object.keys(buckets).sort().forEach(function (id) {
    var seen = {}, products = buckets[id].filter(function (p) { if (seen[p.id]) return false; seen[p.id] = true; return true; });
    var m = id.match(/^fox-(boy|girl)-(0-2|2-8)-(\w+)$/);
    fs.writeFileSync(path.join(CAT_DIR, id + '.json'), JSON.stringify({
      catalog_id: id, site: 'Fox', segment: { gender: m[1], age: m[2], category: m[3] },
      updated_at: today(), products: products
    }, null, 2));
    written.push(id.replace('fox-', '') + ' (' + products.length + ')');
  });

  console.log('\nwritten ' + written.length + ' catalogs: ' + written.join(' | '));
  console.log('index.js now registers ' + refreshIndex() + ' catalogs');
}
main().catch(function (e) { console.log('FATAL', e.stack || e.message); process.exit(1); });
