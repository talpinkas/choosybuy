// ============================================================
// CHOOSY — Import a manually-extracted NEXT category into catalogs.
// ============================================================
// NEXT (next.co.il) has Akamai bot protection, so catalogs are built
// by hand: paste the browser console extractor on a category page, which
// downloads a JSON; then run this importer on that file.
//
//   node tools/import-next.js "C:/Users/talpi/Downloads/next-boys-clothing-tops.json"
//
// It infers gender+category from the NEXT path, parses the Hebrew age range
// from each title, buckets products into ChoosyBuy age segments (0-2 / 2-8)
// by overlap, writes catalogs/next-<gender>-<age>-<category>.json, and
// refreshes catalogs/index.js (covering terminalx-* AND next-*).
// ============================================================
'use strict';
var fs = require('fs');
var path = require('path');
var CAT_DIR = path.join(__dirname, '..', 'catalogs');

// NEXT category path -> { gender, category }
function segOf(catPath) {
  var lc = String(catPath || '').toLowerCase();
  var gender = /girl/.test(lc) ? 'girl' : 'boy';
  var category =
    /swim/.test(lc) ? 'swim' :
    /dress/.test(lc) ? 'dresses' :
    /bodysuit|romper|sleepsuit|all-in-one|babygrow/.test(lc) ? 'bodysuits' :
    /trouser|pant|short|jogger|legging|jean|bottom|skirt/.test(lc) ? 'bottoms' :
    'tops';
  return { gender: gender, category: category };
}

// Hebrew age range in a title -> [minYears, maxYears] | null
function ageRange(title) {
  var m = String(title).match(/גיל\s*(\d+)\s*(חודשים|חודש|שנים|שנה)?\s*(?:עד|-|–)\s*(\d+)\s*(חודשים|חודש|שנים|שנה)?/);
  if (!m) return null;
  var unit2 = m[2], unit4 = m[4];
  function toYears(n, u) { n = parseInt(n, 10); return /חודש/.test(u || '') ? n / 12 : n; }
  var a = toYears(m[1], unit2 || unit4 || 'שנים');
  var b = toYears(m[3], unit4 || unit2 || 'שנים');
  return [Math.min(a, b), Math.max(a, b)];
}
// which ChoosyBuy age segments a product belongs to (overlap based)
function agesFor(title) {
  var r = ageRange(title);
  if (!r) return ['0-2', '2-8']; // unknown -> show in both
  var out = [];
  if (r[0] <= 2) out.push('0-2');
  if (r[0] <= 8 && r[1] >= 2) out.push('2-8');
  return out.length ? out : ['2-8'];
}
function cleanTitle(t) { return String(t || '').replace(/\s*[-–—]\s*$/, '').replace(/\s+/g, ' ').trim(); }

function refreshIndex() {
  var files = fs.readdirSync(CAT_DIR).filter(function (f) { return /^(terminalx|next)-.*\.json$/.test(f); }).sort();
  var body = '// Choosy catalogs registry — AUTO-GENERATED (terminalx-* + next-*).\n' +
    '// require() with a static path is bundled reliably by Vercel.\n\n' +
    'module.exports = [\n' + files.map(function (f) { return "  require('./" + f + "')"; }).join(',\n') + '\n];\n';
  fs.writeFileSync(path.join(CAT_DIR, 'index.js'), body);
  return files.length;
}

function main() {
  var src = process.argv[2];
  if (!src) { console.log('Usage: node tools/import-next.js <downloaded-next-json>'); process.exit(1); }
  var data = JSON.parse(fs.readFileSync(src, 'utf8'));
  var s = segOf(data.category);
  console.log('source: ' + data.category + '  ->  gender=' + s.gender + ', category=' + s.category + '  | raw products: ' + (data.products || []).length);

  var buckets = {}, dropped = 0, seen = {};
  (data.products || []).forEach(function (p) {
    if (!p.price || !p.title) { dropped++; return; }
    var item = String(p.id).replace(/^next-/, '');
    if (seen[item]) return; seen[item] = true;
    var prod = {
      id: 'next-' + item,
      title: cleanTitle(p.title),
      image: p.image,
      price: p.price,
      sale_price: (p.sale_price != null && p.sale_price < p.price) ? p.sale_price : null,
      currency: 'ILS',
      url: p.url,
      brand: 'NEXT',
      color: p.color || '',
      color_hex: null,
      affiliate_ready: false
    };
    agesFor(p.title).forEach(function (age) { (buckets[age] = buckets[age] || []).push(prod); });
  });

  var written = [];
  Object.keys(buckets).sort().forEach(function (age) {
    var id = 'next-' + s.gender + '-' + age + '-' + s.category;
    var catalog = {
      catalog_id: id, site: 'NEXT',
      segment: { gender: s.gender, age: age, category: s.category },
      updated_at: new Date().toISOString().slice(0, 10),
      products: buckets[age]
    };
    fs.writeFileSync(path.join(CAT_DIR, id + '.json'), JSON.stringify(catalog, null, 2));
    written.push(id + ' (' + buckets[age].length + ')');
  });

  console.log('dropped (no price/title): ' + dropped);
  console.log('written: ' + written.join(' | '));
  console.log('index.js now registers ' + refreshIndex() + ' catalogs');
}
main();
