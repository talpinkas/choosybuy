// ============================================================
// CHOOSY — Shilav (shilav.co.il) catalog builder — AUTOMATED.
// ============================================================
// Shilav runs on Shopify with an OPEN /products.json API (no bot block),
// so this is a fully automated builder (no manual extraction, refreshable):
//
//   node tools/build-shilav.js
//
// - Paginates https://www.shilav.co.il/products.json (250/page) until empty.
// - Keeps only product_type === "בגדי תינוקות וילדים" (clothing; Shilav also
//   sells gear/textile/toys/furniture).
// - category  ← Hebrew keyword in the title (tops/bottoms/bodysuits/dresses/swim;
//   products that match none — hats, gloves, socks — are skipped).
// - age       ← Shopify Size option values (NB / 0-3m..18-24m → 0-2; 2Y..6Y → 2-8;
//   spanning both → both buckets).
// - gender    ← בנים/בנות in the title; dresses → girl; otherwise unisex → BOTH.
// - price/sale ← variant.price / compare_at_price (compare_at>price = on sale).
// - image ← images[0].src; url ← /products/<handle>.
// Writes catalogs/shilav-<gender>-<age>-<category>.json only for app-valid
// segments (VALID mirrors app.js SEGMENT_CATS) and refreshes catalogs/index.js.
// ============================================================
'use strict';
var fs = require('fs');
var path = require('path');
var CAT_DIR = path.join(__dirname, '..', 'catalogs');
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
var SITE = 'https://www.shilav.co.il';
var CLOTHING = 'בגדי תינוקות וילדים';

var VALID = {
  'boy|0-2': ['tops', 'bodysuits', 'swim'],
  'girl|0-2': ['tops', 'bodysuits', 'dresses', 'swim'],
  'boy|2-8': ['tops', 'bottoms', 'swim'],
  'girl|2-8': ['tops', 'bottoms', 'dresses', 'swim']
};
function validSeg(g, a, c) { return (VALID[g + '|' + a] || []).indexOf(c) !== -1; }

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function today() { return new Date().toISOString().slice(0, 10); }

// title -> ChoosyBuy category (most specific first), or null to skip
function categoryOf(title) {
  var t = title;
  if (/בגד[יי]?\s*ים|בגד-ים/.test(t)) return 'swim';
  if (/שמל|טוניק/.test(t)) return 'dresses';
  if (/בגד[יי]?\s*גוף|בגד-גוף|אוברול|אוברל|בייביגרו|רומפר|סרבל/.test(t)) return 'bodysuits';
  if (/מכנס|טייץ|חצאית|ג'ינס|שורט|לגינ/.test(t)) return 'bottoms';
  if (/חולצ|טישרט|טי-?שירט|גופ[יי]|סווטשירט|סווט שירט|סריג|טופ|חזיי|מקטורן/.test(t)) return 'tops';
  return null;
}
// gender(s): explicit בנים/בנות wins; dresses are girls; else unisex -> both
function gendersOf(title, category) {
  if (/בנות|לבנות/.test(title)) return ['girl'];
  if (/בנים|לבנים/.test(title)) return ['boy'];
  if (category === 'dresses') return ['girl'];
  return ['boy', 'girl'];
}
// Shopify size values -> age buckets
function agesFromSizes(values) {
  var infant = false, kid = false;
  (values || []).forEach(function (v) {
    v = String(v).toUpperCase();
    if (/NB/.test(v)) infant = true;                 // newborn
    if (/\d\s*-?\s*\d*\s*M\b/.test(v) || /\dM/.test(v)) infant = true; // months
    var ym = v.match(/(\d+)\s*Y/);
    if (ym) { var y = +ym[1]; if (y <= 2) infant = true; if (y >= 2) kid = true; }
  });
  var out = [];
  if (infant) out.push('0-2');
  if (kid) out.push('2-8');
  return out.length ? out : ['0-2', '2-8'];
}
var COLORS = ['שמנת', 'לבן', 'שחור', 'אפור', 'ורוד', 'כחול', 'תכלת', 'נייבי', 'ירוק', 'אדום', 'צהוב', 'סגול', 'חום', 'בז\'', 'כתום', 'חרדל', 'זית', 'קאמל', 'מולטי', 'צבעוני'];
function colorOf(p) {
  var opts = p.options || [];
  for (var k = 0; k < opts.length; k++) {
    if (/צבע|colou?r/i.test(opts[k].name) && (opts[k].values || []).length) {
      var ov = String(opts[k].values[0]).trim(); if (ov && !/default/i.test(ov)) return ov;
    }
  }
  var title = p.title || '';
  var m = title.match(/בגוון\s+([^,()]{2,12})/);
  if (m) return m[1].trim();
  for (var i = 0; i < COLORS.length; i++) if (title.indexOf(COLORS[i]) !== -1) return COLORS[i];
  return '';
}
function sizeValues(p) {
  var out = [];
  (p.options || []).forEach(function (o) { if (/size|מידה|גיל/i.test(o.name)) out = out.concat(o.values || []); });
  return out;
}

async function fetchAll() {
  var all = [];
  for (var pg = 1; pg <= 40; pg++) {
    var r = await fetch(SITE + '/products.json?limit=250&page=' + pg, { headers: { 'User-Agent': UA } });
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
  var body = '// Choosy catalogs registry — AUTO-GENERATED (terminalx-* + next-* + shilav-*).\n' +
    '// require() with a static path is bundled reliably by Vercel.\n\n' +
    'module.exports = [\n' + files.map(function (f) { return "  require('./" + f + "')"; }).join(',\n') + '\n];\n';
  fs.writeFileSync(path.join(CAT_DIR, 'index.js'), body);
  return files.length;
}

async function main() {
  console.log('Fetching Shilav products...');
  var all = await fetchAll();
  var clothing = all.filter(function (p) { return p.product_type === CLOTHING; });
  console.log('fetched ' + all.length + ' products | clothing: ' + clothing.length);

  var buckets = {}; // seg id -> products[]
  var stats = { skipNoCat: 0, kept: 0 };
  clothing.forEach(function (p) {
    if (!(p.variants || []).some(function (v) { return v.available === true; })) return; // out of stock — skip
    var category = categoryOf(p.title);
    if (!category) { stats.skipNoCat++; return; }
    var v = (p.variants || [])[0] || {};
    var cur = parseFloat(v.price) || 0;
    var cmp = parseFloat(v.compare_at_price) || 0;
    if (!cur) return;
    var price = cmp > cur ? cmp : cur;
    var sale = cmp > cur ? cur : null;
    var img = (p.images && p.images[0] && p.images[0].src) || '';
    if (!img) return;
    var prod = {
      id: 'shilav-' + (p.id || p.handle),
      title: String(p.title || '').replace(/\s+/g, ' ').trim(),
      image: img,
      price: price, sale_price: sale, currency: 'ILS',
      url: SITE + '/products/' + encodeURIComponent(p.handle),
      brand: 'שילב', color: colorOf(p), color_hex: null, affiliate_ready: false
    };
    var ages = agesFromSizes(sizeValues(p));
    var genders = gendersOf(p.title, category);
    genders.forEach(function (g) {
      ages.forEach(function (a) {
        if (!validSeg(g, a, category)) return;
        var id = 'shilav-' + g + '-' + a + '-' + category;
        (buckets[id] = buckets[id] || []).push(prod);
      });
    });
    stats.kept++;
  });

  var written = [];
  Object.keys(buckets).sort().forEach(function (id) {
    var m = id.match(/^shilav-(boy|girl)-(0-2|2-8)-(\w+)$/);
    var catalog = {
      catalog_id: id, site: 'Shilav',
      segment: { gender: m[1], age: m[2], category: m[3] },
      updated_at: today(), products: buckets[id]
    };
    fs.writeFileSync(path.join(CAT_DIR, id + '.json'), JSON.stringify(catalog, null, 2));
    written.push(id.replace('shilav-', '') + ' (' + buckets[id].length + ')');
  });

  console.log('kept ' + stats.kept + ' clothing items | skipped (no category): ' + stats.skipNoCat);
  console.log('written ' + written.length + ' catalogs: ' + written.join(' | '));
  console.log('index.js now registers ' + refreshIndex() + ' catalogs');
}
main().catch(function (e) { console.log('FATAL', e.stack || e.message); process.exit(1); });
