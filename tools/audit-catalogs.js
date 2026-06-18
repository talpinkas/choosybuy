// CHOOSY — classification audit. Sanity-checks the catalogs after any rebuild:
//   1) color coverage per retailer  2) category mismatches (title vs catalog)
//   3) gender dual-listing (same product in boy AND girl).
// Run: node tools/audit-catalogs.js
'use strict';
var fs = require('fs');
var path = require('path');
var CAT_DIR = path.join(__dirname, '..', 'catalogs');
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

var catalogs = fs.readdirSync(CAT_DIR).filter(function (f) { return /\.json$/.test(f); })
  .map(function (f) { return JSON.parse(fs.readFileSync(path.join(CAT_DIR, f), 'utf8')); });

// ---- 1. COLOR coverage per site ----
console.log('=== COLOR coverage per site ===');
var bySite = {};
catalogs.forEach(function (c) {
  var s = c.site; bySite[s] = bySite[s] || { n: 0, withColor: 0 };
  c.products.forEach(function (p) { bySite[s].n++; if (p.color && p.color.trim()) bySite[s].withColor++; });
});
Object.keys(bySite).forEach(function (s) { var b = bySite[s]; console.log('  ' + s + ': ' + b.withColor + '/' + b.n + ' have a color (' + Math.round(100 * b.withColor / b.n) + '%)'); });

// ---- 2. CATEGORY mismatch: title strongly indicates a different category ----
var KW = {
  swim: /בגד[יי]?\s*ים/, dresses: /שמל|טוניק/,
  bodysuits: /בגד[יי]?\s*גוף|אוברול|בייביגרו|רומפר|סרבל/,
  bottoms: /מכנס|חצאית|טייץ|ג'ינס|שורט|ברמודה|לגינ/,
  tops: /חולצ|גופי|פוטר|סווטשירט|מקטורן|סריג|\bטופ\b|טישרט/
};
function titleCats(title) { var out = []; Object.keys(KW).forEach(function (c) { if (KW[c].test(title)) out.push(c); }); return out; }
console.log('\n=== CATEGORY mismatch (catalog says X, title says only Y) ===');
var mism = {};
catalogs.forEach(function (c) {
  var cat = c.segment.category;
  c.products.forEach(function (p) {
    var tc = titleCats(p.title);
    if (tc.length && tc.indexOf(cat) === -1) { var k = c.site + ': ' + cat + ' <- ' + tc.join('/'); mism[k] = (mism[k] || 0) + 1; }
  });
});
var mk = Object.keys(mism).sort(function (a, b) { return mism[b] - mism[a]; });
mk.slice(0, 15).forEach(function (k) { console.log('  ' + mism[k] + '  ' + k); });
console.log('  total mismatched: ' + mk.reduce(function (a, k) { return a + mism[k]; }, 0));

// ---- 3. GENDER dual-listing (same product id in boy AND girl) per site ----
console.log('\n=== GENDER: products listed in BOTH boy & girl (per site) ===');
var byId = {}; // site -> id -> {boy,girl}
catalogs.forEach(function (c) {
  var s = c.site, g = c.segment.gender;
  byId[s] = byId[s] || {};
  c.products.forEach(function (p) { (byId[s][p.id] = byId[s][p.id] || {})[g] = true; });
});
Object.keys(byId).forEach(function (s) {
  var ids = Object.keys(byId[s]), both = ids.filter(function (id) { return byId[s][id].boy && byId[s][id].girl; }).length;
  console.log('  ' + s + ': ' + both + ' / ' + ids.length + ' unique products in both genders (' + Math.round(100 * both / ids.length) + '%)');
});
