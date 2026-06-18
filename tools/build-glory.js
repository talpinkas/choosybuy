// ============================================================
// CHOOSY — Glory Kids (glorykids.co.il) catalog builder — AUTOMATED (Shopify).
// ============================================================
// Pure kids retailer; product_type is empty, so gender + category come from the
// (descriptive Hebrew) TITLE and age from the Shopify Size option.
//   node tools/build-glory.js
// ============================================================
'use strict';
var fs = require('fs');
var path = require('path');
var CAT_DIR = path.join(__dirname, '..', 'catalogs');
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
var SITE = 'https://glorykids.co.il';
var BRAND = 'Glory Kids';

var VALID = {
  'boy|0-2': ['tops', 'bodysuits', 'swim'],
  'girl|0-2': ['tops', 'bodysuits', 'dresses', 'swim'],
  'boy|2-8': ['tops', 'bottoms', 'swim'],
  'girl|2-8': ['tops', 'bottoms', 'dresses', 'swim']
};
function validSeg(g, a, c) { return (VALID[g + '|' + a] || []).indexOf(c) !== -1; }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function today() { return new Date().toISOString().slice(0, 10); }

function categoryOf(s) {
  if (/גרב|סניקרס|נעל|תחתונ|בוקסר|כובע|אביזר/.test(s)) return null;
  if (/בגד[יי]?\s*ים/.test(s)) return 'swim';
  if (/שמל|טוניק/.test(s)) return 'dresses';
  if (/בגד[יי]?\s*גוף|אוברול|בייביגרו|רומפר|סרבל|גוזי/.test(s)) return 'bodysuits';
  if (/מכנס|חצאית|טייץ|ג'ינס|שורט|ברמודה|לגינ/.test(s)) return 'bottoms';
  if (/חולצ|גופי|פוטר|סווטשירט|מקטורן|סריג|\bטופ\b|טישרט|טי-?שירט|חליפ|בגד/.test(s)) return 'tops';
  return null;
}
function gendersOf(title, category) {
  if (/בנות|לבנות/.test(title)) return ['girl'];
  if (/בנים|לבנים/.test(title)) return ['boy'];
  if (category === 'dresses') return ['girl'];
  return ['boy', 'girl'];
}
function agesFromSizes(values) {
  if (!values || !values.length) return ['0-2', '2-8'];
  var infant = false, kid = false;
  values.forEach(function (v) {
    v = String(v).trim();
    if (/NB|נולד/i.test(v)) infant = true;
    if (/\d\s*m\b/i.test(v)) infant = true;
    var range = v.match(/^(\d{1,2})\s*-\s*(\d{1,2})\s*m?$/i);
    if (range) { if (+range[2] <= 24) infant = true; }
    else if (/^\d+$/.test(v)) { var n = parseInt(v, 10); if (n <= 2) infant = true; if (n >= 2 && n <= 8) kid = true; }
  });
  var out = []; if (infant) out.push('0-2'); if (kid) out.push('2-8'); return out;
}
var COLORS = ['שמנת', 'לבן', 'שחור', 'אפור', 'ורוד', 'כחול', 'תכלת', 'נייבי', 'ירוק', 'אדום', 'צהוב', 'סגול', 'חום', 'בז\'', 'כתום', 'חרדל', 'זית', 'מולטי', 'צבעוני'];
function colorOf(t) { for (var i = 0; i < COLORS.length; i++) if (t.indexOf(COLORS[i]) !== -1) return COLORS[i]; return ''; }
function sizeVals(p) { var out = []; (p.options || []).forEach(function (o) { if (/size|מידה|גיל/i.test(o.name)) out = out.concat(o.values || []); }); return out; }

function refreshIndex() {
  var files = fs.readdirSync(CAT_DIR).filter(function (f) { return /\.json$/.test(f); }).sort();
  var body = '// Choosy catalogs registry — AUTO-GENERATED (every catalogs/*.json).\n\nmodule.exports = [\n' +
    files.map(function (f) { return "  require('./" + f + "')"; }).join(',\n') + '\n];\n';
  fs.writeFileSync(path.join(CAT_DIR, 'index.js'), body);
  return files.length;
}

async function main() {
  var all = [];
  for (var pg = 1; pg <= 20; pg++) {
    var r = await fetch(SITE + '/products.json?limit=250&page=' + pg, { headers: { 'User-Agent': UA } });
    if (!r.ok) break;
    var items = ((await r.json()).products) || [];
    all = all.concat(items);
    if (items.length < 250) break;
    await sleep(200);
  }
  console.log('fetched ' + all.length + ' products');

  var buckets = {}, kept = 0, skipCat = 0, skipAge = 0;
  all.forEach(function (p) {
    if (!(p.variants || []).some(function (v) { return v.available === true; })) return; // out of stock
    var category = categoryOf((p.product_type || '') + ' ' + (p.title || ''));
    if (!category) { skipCat++; return; }
    var ages = agesFromSizes(sizeVals(p));
    if (!ages.length) { skipAge++; return; }
    var v = (p.variants || [])[0] || {};
    var cur = parseFloat(v.price) || 0, cmp = parseFloat(v.compare_at_price) || 0;
    var img = (p.images && p.images[0] && p.images[0].src) || '';
    if (!cur || !img) return;
    var prod = {
      id: 'glory-' + (p.id || p.handle), title: String(p.title || '').replace(/\s+/g, ' ').trim(),
      image: img, price: cmp > cur ? cmp : cur, sale_price: cmp > cur ? cur : null, currency: 'ILS',
      url: SITE + '/products/' + encodeURIComponent(p.handle), brand: BRAND, color: colorOf(p.title || ''), color_hex: null, affiliate_ready: false
    };
    gendersOf(p.title || '', category).forEach(function (g) {
      ages.forEach(function (a) { if (validSeg(g, a, category)) (buckets['glory-' + g + '-' + a + '-' + category] = buckets['glory-' + g + '-' + a + '-' + category] || []).push(prod); });
    });
    kept++;
  });

  var written = [];
  Object.keys(buckets).sort().forEach(function (id) {
    var seen = {}, products = buckets[id].filter(function (p) { if (seen[p.id]) return false; seen[p.id] = true; return true; });
    var m = id.match(/^glory-(boy|girl)-(0-2|2-8)-(\w+)$/);
    fs.writeFileSync(path.join(CAT_DIR, id + '.json'), JSON.stringify({
      catalog_id: id, site: BRAND, segment: { gender: m[1], age: m[2], category: m[3] }, updated_at: today(), products: products
    }, null, 2));
    written.push(id.replace('glory-', '') + ' (' + products.length + ')');
  });
  console.log('kept ' + kept + ' | skipped: no-category ' + skipCat + ', out-of-age ' + skipAge);
  console.log('written ' + written.length + ' catalogs: ' + written.join(' | '));
  console.log('index.js now registers ' + refreshIndex() + ' catalogs');
}
main().catch(function (e) { console.log('FATAL', e.stack || e.message); process.exit(1); });
