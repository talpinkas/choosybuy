// ============================================================
// CHOOSY — Import a manually-extracted NEXT category into catalogs.
// ============================================================
// NEXT (next.co.il) has Akamai bot protection, so catalogs are built by hand:
// paste the browser console extractor on a category page (it downloads a JSON),
// then run this importer on that file.
//
//   node tools/import-next.js "C:/Users/talpi/Downloads/next-boys-clothing-tops.json"
//
// Infers gender(s)+category from the NEXT path, parses the Hebrew age range per
// title and buckets into ChoosyBuy age segments (0-2 / 2-8) by overlap. Writes
// catalogs/next-<gender>-<age>-<category>.json ONLY for segments the app
// actually serves (see VALID), and refreshes catalogs/index.js (terminalx-* +
// next-*). A gender-less "baby" path (e.g. unisex bodysuits) writes to BOTH
// genders.
// ============================================================
'use strict';
var fs = require('fs');
var path = require('path');
var CAT_DIR = path.join(__dirname, '..', 'catalogs');

// Valid gender|age -> categories. MUST mirror app.js SEGMENT_CATS, so we never
// emit a catalog the app can't request (e.g. 0-2 has no bottoms; 2-8 no bodysuits).
var VALID = {
  'boy|0-2': ['tops', 'bodysuits', 'swim'],
  'girl|0-2': ['tops', 'bodysuits', 'dresses', 'swim'],
  'boy|2-8': ['tops', 'bottoms', 'swim'],
  'girl|2-8': ['tops', 'bottoms', 'dresses', 'swim']
};
function validSeg(g, a, c) { return (VALID[g + '|' + a] || []).indexOf(c) !== -1; }

function gendersOf(lc) {
  var boy = /boy/.test(lc), girl = /girl/.test(lc);
  if (boy && !girl) return ['boy'];
  if (girl && !boy) return ['girl'];
  return ['boy', 'girl']; // unisex / gender-less baby -> both
}
function categoryOf(lc) {
  return /swim/.test(lc) ? 'swim'
    : /dress/.test(lc) ? 'dresses'
    : /bodysuit|romper|sleepsuit|all-in-one|babygrow/.test(lc) ? 'bodysuits'
    : /trouser|pant|short|jogger|legging|jean|bottom|skirt/.test(lc) ? 'bottoms'
    : 'tops';
}

// Hebrew age range in a title -> [minYears, maxYears] | null
function ageRange(title) {
  var m = String(title).match(/גיל\s*(\d+)\s*(חודשים|חודש|שנים|שנה)?\s*(?:עד|-|–)\s*(\d+)\s*(חודשים|חודש|שנים|שנה)?/);
  if (!m) return null;
  function toYears(n, u) { n = parseInt(n, 10); return /חודש/.test(u || '') ? n / 12 : n; }
  var a = toYears(m[1], m[2] || m[4] || 'שנים');
  var b = toYears(m[3], m[4] || m[2] || 'שנים');
  return [Math.min(a, b), Math.max(a, b)];
}
function agesFor(title) {
  var r = ageRange(title);
  if (!r) return ['0-2', '2-8']; // unknown -> both buckets
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
  var lc = String(data.category || '').toLowerCase();
  var genders = gendersOf(lc), category = categoryOf(lc);
  console.log('source: ' + data.category + '  ->  ' + genders.join('+') + ' / ' + category + '  | raw: ' + (data.products || []).length);

  var items = [], dropped = 0, seen = {};
  (data.products || []).forEach(function (p) {
    if (!p.price || !p.title) { dropped++; return; }
    var item = String(p.id).replace(/^next-/, '');
    if (seen[item]) return; seen[item] = true;
    items.push({
      ages: agesFor(p.title),
      prod: {
        id: 'next-' + item, title: cleanTitle(p.title), image: p.image,
        price: p.price, sale_price: (p.sale_price != null && p.sale_price < p.price) ? p.sale_price : null,
        currency: 'ILS', url: p.url, brand: 'NEXT', color: p.color || '', color_hex: null, affiliate_ready: false
      }
    });
  });

  var written = [], skipped = {};
  genders.forEach(function (gender) {
    var byAge = {};
    items.forEach(function (x) {
      x.ages.forEach(function (age) {
        if (validSeg(gender, age, category)) (byAge[age] = byAge[age] || []).push(x.prod);
        else skipped[gender + '/' + age + '/' + category] = true;
      });
    });
    Object.keys(byAge).sort().forEach(function (age) {
      var id = 'next-' + gender + '-' + age + '-' + category;
      fs.writeFileSync(path.join(CAT_DIR, id + '.json'), JSON.stringify({
        catalog_id: id, site: 'NEXT', segment: { gender: gender, age: age, category: category },
        updated_at: new Date().toISOString().slice(0, 10), products: byAge[age]
      }, null, 2));
      written.push(id + ' (' + byAge[age].length + ')');
    });
  });

  console.log('dropped: ' + dropped + ' | written: ' + (written.join(' | ') || '(none)'));
  if (Object.keys(skipped).length) console.log('skipped (not an app segment): ' + Object.keys(skipped).join(', '));
  console.log('index.js now registers ' + refreshIndex() + ' catalogs');
}
main();
