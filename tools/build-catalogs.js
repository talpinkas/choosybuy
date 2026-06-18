// ============================================================
// CHOOSY — Terminal X catalog batch builder
// ============================================================
// Builds all kids catalogs from the Terminal X listingSearch API
// and refreshes catalogs/index.js. No browser/session needed — the
// listingSearch endpoint answers plain Node POSTs.
//
// Run:  node tools/build-catalogs.js
//       node tools/build-catalogs.js boy-2-8-tops      (one segment)
//
// Mechanics (verified):
//   endpoint: POST https://www.terminalx.com/a/listingSearch
//   body:     listingSearchQuery{ categoryId, currentPage, filter:{category_id:{eq}},
//             includeAggregations:false, pageSize, sort:{default:true} }
//   wrapper:  data.elasticSearch  (fallback response.data.elasticSearch)
//   items:    elasticSearch.items[]   total: total_count
//   pageSize: use 500 — a single large page returns the full set; smaller
//             pages silently drop items to a banner slot.
//   title:    item.small_image.label (fallback image.label)
//   image:    item.small_image.url
//   slug:     from image filename  ([a-z]\d{6,})-\d+\.(jpg|jpeg|png|webp)  lowercased
//             (item.sku/url_key are unreliable/null)
//   url:      https://www.terminalx.com/<category url_path>/<slug>?color=<value_index>
//   price:    price_range.minimum_price.regular_price.value (orig),
//             final_price.value (sale, only if lower)
//   color:    configurable_options[attribute_code=color].values[0].{label, swatch_data.value, value_index}
//   dedup:    by slug (collapses color variants of the same parent)
// ============================================================
'use strict';

var fs = require('fs');
var path = require('path');

var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
var TX = 'https://www.terminalx.com';
var CATALOG_DIR = path.join(__dirname, '..', 'catalogs');

// The 14 segments. categoryId values were discovered from the live Terminal X
// category tree (the embedded menu JSON in category pages). txPath is the
// canonical path used to verify the id still points where we expect.
var SEGMENTS = [
  { gender: 'boy',  age: '0-2', category: 'tops',      txPath: 'baby/baby-boys/shirts',              categoryId: '23058' },
  { gender: 'boy',  age: '0-2', category: 'bodysuits', txPath: 'baby/baby-boys/bodysuits-overalls',  categoryId: '23057' },
  { gender: 'boy',  age: '0-2', category: 'swim',      txPath: 'baby/baby-boys/swimwear',            categoryId: '23064' },
  { gender: 'girl', age: '0-2', category: 'tops',      txPath: 'baby/baby-girls/shirts',             categoryId: '23005' },
  { gender: 'girl', age: '0-2', category: 'bodysuits', txPath: 'baby/baby-girls/bodysuits-overalls', categoryId: '23002' },
  { gender: 'girl', age: '0-2', category: 'dresses',   txPath: 'baby/baby-girls/dresses-skirts',     categoryId: '23037' },
  { gender: 'girl', age: '0-2', category: 'swim',      txPath: 'baby/baby-girls/swimwear',           categoryId: '23024' },
  { gender: 'boy',  age: '2-8', category: 'tops',      txPath: 'kids/boys/shirts',                   categoryId: '22961' },
  { gender: 'boy',  age: '2-8', category: 'bottoms',   txPath: 'kids/boys/pants-jumpsuits',          categoryId: '22962' },
  { gender: 'boy',  age: '2-8', category: 'swim',      txPath: 'kids/boys/swimwear',                 categoryId: '22967' },
  { gender: 'girl', age: '2-8', category: 'tops',      txPath: 'kids/girls/shirts',                  categoryId: '19939' },
  { gender: 'girl', age: '2-8', category: 'bottoms',   txPath: 'kids/girls/pants-jumpsuits',         categoryId: '19942' },
  { gender: 'girl', age: '2-8', category: 'dresses',   txPath: 'kids/girls/dresses',                 categoryId: '19940' },
  { gender: 'girl', age: '2-8', category: 'swim',      txPath: 'kids/girls/swimsuit',                categoryId: '19945' }
];

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function today() { return new Date().toISOString().slice(0, 10); }

// ~20-35% of products in the listing feed have NO live product page (404) —
// they slip in from "import"/unpublished feeds and carry no distinguishing
// field (same visibility/status/stock as live ones). The only reliable filter
// is to ask the server. HEAD is enough: live -> 200, dead -> real 404.
var aliveCache = {};
function bareUrl(u) { var i = u.indexOf('?'); return i === -1 ? u : u.slice(0, i); }

async function httpAlive(url) {
  var key = bareUrl(url);
  if (key in aliveCache) return aliveCache[key];
  for (var attempt = 0; attempt < 3; attempt++) {
    try {
      var ctrl = new AbortController();
      var timer = setTimeout(function () { ctrl.abort(); }, 9000);
      var res = await fetch(key, { method: 'HEAD', headers: { 'User-Agent': UA, 'Accept': 'text/html' }, signal: ctrl.signal });
      clearTimeout(timer);
      if (res.status === 200) { aliveCache[key] = true; return true; }
      if (res.status === 404 || res.status === 410) { aliveCache[key] = false; return false; }
      // 429/5xx/etc: transient — fall through to retry
    } catch (e) { /* timeout/network — retry */ }
    await sleep(400);
  }
  aliveCache[key] = true; // undecidable after retries: keep (never drop on a hiccup)
  return true;
}

// Bounded-concurrency map.
async function mapPool(items, worker, concurrency) {
  var idx = 0, out = new Array(items.length);
  async function run() { while (idx < items.length) { var i = idx++; out[i] = await worker(items[i], i); } }
  var runners = [];
  for (var c = 0; c < Math.min(concurrency, items.length); c++) runners.push(run());
  await Promise.all(runners);
  return out;
}

async function verifyProducts(products) {
  var checked = await mapPool(products, async function (p) { return (await httpAlive(p.url)) ? p : null; }, 10);
  return checked.filter(Boolean);
}

// One listingSearch page.
async function listingPage(categoryId, pageSize, page) {
  var res = await fetch(TX + '/a/listingSearch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', 'Accept': 'application/json',
      'User-Agent': UA, 'Origin': TX, 'Referer': TX + '/'
    },
    body: JSON.stringify({
      listingSearchOptions: { myBagSkus: [] },
      listingSearchQuery: {
        categoryId: String(categoryId),
        currentPage: page,
        filter: { category_id: { eq: String(categoryId) } },
        includeAggregations: false,
        pageSize: pageSize,
        sort: { default: true }
      }
    })
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  var d = await res.json();
  return (d.data && d.data.elasticSearch) || (d.response && d.response.data && d.response.data.elasticSearch) || null;
}

// Fetch every item for a category (paginates only if a full page comes back).
async function fetchAllItems(categoryId) {
  var PAGE = 500, items = [], meta = null, page = 1;
  while (page <= 8) {
    var es = await listingPage(categoryId, PAGE, page);
    if (!es) break;
    if (!meta) meta = es;
    var batch = es.items || [];
    items = items.concat(batch);
    if (batch.length < PAGE) break;
    page++;
    await sleep(250);
  }
  return { items: items, meta: meta };
}

function colorOf(it) {
  var opts = it.configurable_options || [];
  for (var i = 0; i < opts.length; i++) {
    var o = opts[i];
    if (o.attribute_code === 'color' && o.values && o.values.length) {
      var v = o.values[0];
      return {
        label: v.label || v.store_label || v.default_label || '',
        hex: (v.swatch_data && v.swatch_data.value) || null,
        valueIndex: v.value_index != null ? v.value_index : null
      };
    }
  }
  return { label: '', hex: null, valueIndex: null };
}

function mapItems(items, urlPath) {
  var seen = {}, out = [];
  items.forEach(function (it) {
    var name = (it.small_image && it.small_image.label) || (it.image && it.image.label) || '';
    var img = (it.small_image && it.small_image.url) || (it.thumbnail && it.thumbnail.url) || '';
    if (!name || !img) return;
    var m = img.match(/([a-z]\d{6,})-\d+\.(?:jpg|jpeg|png|webp)/i);
    var slug = m ? m[1].toLowerCase() : '';
    if (!slug || seen[slug]) return;
    seen[slug] = true;

    var mp = (it.price_range && it.price_range.minimum_price) || {};
    var reg = (mp.regular_price && mp.regular_price.value) || 0;
    var fin = (mp.final_price && mp.final_price.value) || reg;
    var price = reg, sale = null;
    if (fin < reg) sale = fin; else price = fin;
    if (!price) return;

    var c = colorOf(it);
    var url = TX + '/' + (urlPath ? urlPath + '/' : '') + slug + (c.valueIndex != null ? '?color=' + c.valueIndex : '');

    out.push({
      id: 'tx-' + slug,
      title: name,
      image: img,
      price: price,
      sale_price: sale,
      currency: 'ILS',
      url: url,
      brand: 'Terminal X',
      color: c.label || '',
      color_hex: c.hex || null,
      affiliate_ready: false
    });
  });
  return out;
}

async function buildSegment(seg, opts) {
  var id = 'terminalx-' + seg.gender + '-' + seg.age + '-' + seg.category;
  var res = await fetchAllItems(seg.categoryId);
  var meta = res.meta;
  if (!meta) throw new Error('no elasticSearch wrapper');

  var cat0 = (meta.categories && meta.categories[0]) || {};
  var urlPath = cat0.url_path || seg.txPath;
  var verified = urlPath === seg.txPath;

  var products = mapItems(res.items, urlPath);
  var mapped = products.length;
  if (!opts.skipVerify) products = await verifyProducts(products);

  var catalog = {
    catalog_id: id,
    site: 'Terminal X',
    segment: { gender: seg.gender, age: seg.age, category: seg.category },
    updated_at: today(),
    products: products
  };
  fs.writeFileSync(path.join(CATALOG_DIR, id + '.json'), JSON.stringify(catalog, null, 2));

  return {
    id: id, count: products.length, mapped: mapped, raw: res.items.length,
    totalCount: meta.total_count, urlPath: urlPath, catName: cat0.name || '',
    verified: verified
  };
}

// Rewrite catalogs/index.js from the .json files actually present.
function refreshIndex() {
  var files = fs.readdirSync(CATALOG_DIR)
    .filter(function (f) { return /\.json$/.test(f); })
    .sort();
  var lines = files.map(function (f) { return "  require('./" + f + "')"; });
  var body = '// Choosy catalogs registry — AUTO-GENERATED by tools/build-catalogs.js.\n' +
    '// Each catalog is a static JSON file. require() with a static path is bundled\n' +
    '// reliably by Vercel. Re-run the builder to refresh.\n\n' +
    'module.exports = [\n' + lines.join(',\n') + '\n];\n';
  fs.writeFileSync(path.join(CATALOG_DIR, 'index.js'), body);
  return files.length;
}

async function main() {
  var args = process.argv.slice(2);
  var skipVerify = args.indexOf('--no-verify') !== -1;
  var only = args.filter(function (a) { return a.indexOf('--') !== 0; })[0];
  var segs = SEGMENTS.filter(function (s) {
    return !only || (s.gender + '-' + s.age + '-' + s.category) === only;
  });
  if (!segs.length) { console.log('No segment matches "' + only + '"'); return; }

  console.log('Building ' + segs.length + ' catalog(s) from Terminal X' +
    (skipVerify ? ' (URL verification OFF)' : ' (verifying live URLs)') + '...\n');
  var ok = 0, totalProducts = 0, problems = [];

  for (var i = 0; i < segs.length; i++) {
    var seg = segs[i];
    var label = seg.gender + '-' + seg.age + '-' + seg.category;
    try {
      var r = await buildSegment(seg, { skipVerify: skipVerify });
      var flag = r.verified ? 'verified' : 'PATH MISMATCH got "' + r.urlPath + '"';
      var warn = r.count < 2 ? '  <-- TOO FEW' : '';
      var dropped = skipVerify ? '' : ', ' + (r.mapped - r.count) + ' dead dropped';
      console.log('OK   ' + pad(label, 18) + r.count + ' live products  (raw ' + r.raw + ', mapped ' + r.mapped + dropped + ', cat "' + r.catName + '", ' + flag + ')' + warn);
      if (r.count < 2 || !r.verified) problems.push(label + ' (' + (warn ? 'few products' : 'path mismatch') + ')');
      ok++; totalProducts += r.count;
    } catch (e) {
      console.log('ERR  ' + pad(label, 18) + (e && e.message));
      problems.push(label + ' (error: ' + (e && e.message) + ')');
    }
    await sleep(350);
  }

  var registered = refreshIndex();
  console.log('\nDone. ' + ok + '/' + segs.length + ' catalogs built, ' + totalProducts + ' products total.');
  console.log('catalogs/index.js now registers ' + registered + ' catalog file(s).');
  if (problems.length) {
    console.log('\nReview needed:');
    problems.forEach(function (p) { console.log('  - ' + p); });
  }
}

function pad(s, n) { s = String(s); while (s.length < n) s += ' '; return s; }

main().catch(function (e) { console.log('FATAL', e && e.stack || e); process.exit(1); });
