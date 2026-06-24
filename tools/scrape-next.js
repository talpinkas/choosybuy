// ============================================================
// CHOOSY — NEXT (next.co.il) kids/baby scraper — Playwright, LOCAL run.
// ============================================================
// NEXT is Akamai-protected, virtualized, and loads via a "עוד" (load more)
// button — so it can't be scraped from the sandbox/Node fetch, and the live
// in-browser JS hits a 45s cap. This script drives a REAL Chromium locally
// (no time cap), walks the kids taxonomy, handles scroll + load-more +
// virtualization, extracts the rich fields, classifies, and writes catalogs.
//
//   npm i playwright            (one time; then: npx playwright install chromium)
//   node tools/scrape-next.js   (a real browser window opens and works)
//
// Output: catalogs/next-<gender>-<age>-<category>.json  +  data/next-raw.json
// (raw, every product + its classification, for the QA audit).
//
// DOM facts (reverse-engineered): product name = [data-testid="product_summary_title"];
// price = a <span> containing ₪ (range "79 ₪ - 97 ₪", RTL marks stripped);
// url = nearest <a href*="/style/<style>/<id>">; the name carries color
// ("בצבע X/Y - ..."), pack ("מארז של N"), and age ("גיל 3 חודשים עד 7 שנים").
// ============================================================
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const CAT_DIR = path.join(__dirname, '..', 'catalogs');
const RAW_OUT = path.join(__dirname, '..', 'data', 'next-raw.json');
const BASE = 'https://www.next.co.il';

// --- Seed listing pages (broad "Shop All" pages cover everything in one walk).
// Edit freely; the per-seed product count is logged so wrong URLs are obvious.
const SEEDS = [
  { gender: 'boy',  url: '/he/shop/boys/clothing' },
  { gender: 'girl', url: '/he/shop/girls/clothing' },
  { gender: 'boy',  url: '/he/shop/boys/footwear' },
  { gender: 'girl', url: '/he/shop/girls/footwear' },
  { gender: 'boy',  url: '/he/shop/boys/accessories' },
  { gender: 'girl', url: '/he/shop/girls/accessories' },
  { gender: 'baby', url: '/he/shop/baby/boys/clothing' },
  { gender: 'baby', url: '/he/shop/baby/girls/clothing' },
  { gender: 'baby', url: '/he/shop/baby/unisex/clothing' }
];

// --- Expanded taxonomy. Categories the pilot serves (Phase 2 wires the UI/get-pool).
// gender 'baby' is resolved per-product (boys/girls/unisex) from the seed + name.
const AGES = ['0-2', '2-8'];
const VALID_CATS = ['tops','bottoms','dresses','bodysuits','swim','outerwear','nightwear','sets','shoes','accessories'];
// gender|age -> allowed categories (bodysuits only 0-2; dresses only girl)
function validSeg(gender, age, cat) {
  if (cat === 'bodysuits') return age === '0-2';
  if (cat === 'dresses') return gender === 'girl';
  return VALID_CATS.indexOf(cat) !== -1;
}

// --- Classification helpers ---------------------------------------------------
function categoryOf(name, url) {
  const t = (name || '') + ' ' + (url || '');
  if (/footwear|נעל|סנדל|כפכף|מגף|נעלי/.test(t)) return /סנדל|כפכף/.test(t) ? 'shoes' : 'shoes';
  if (/accessor|אקססו|כובע|כפפ|גרבי|צעיף|חגור|תיק|כפפות/.test(t)) return 'accessories';
  if (/בגד[יי]?\s*ים|swim|בגד-ים|ביקיני/.test(t)) return 'swim';
  if (/שמל|dress|טוניק|חצאית|skirt/.test(t)) return 'dresses';
  if (/בגד[יי]?\s*גוף|bodysuit|אוברול|רומפר|סרבל|בייביגרו|vest|romper/.test(t)) return 'bodysuits';
  if (/פיג'מ|pajama|pyjama|sleepsuit|nightwear|חלוק|שינה|sleepwear/.test(t)) return 'nightwear';
  if (/מעיל|ג'קט|coat|jacket|פליז|fleece|outerwear|מעילים/.test(t)) return 'outerwear';
  if (/מארז|set\b|סט\b/.test(t)) return 'sets';
  if (/מכנס|trouser|pant|short|jogger|legging|jean|טייץ|לגינ|ברמודה/.test(t)) return 'bottoms';
  return 'tops';
}
function gendersFor(seedGender, name) {
  if (seedGender === 'boy') return ['boy'];
  if (seedGender === 'girl') return ['girl'];
  // baby seed: infer from URL/name if possible, else BOTH
  if (/girls?|בנות|לבנות/.test(name)) return ['girl'];
  if (/boys?|בנים|לבנים/.test(name)) return ['boy'];
  return ['boy', 'girl'];
}
// Hebrew age range in a name -> buckets
function agesFor(name) {
  const m = String(name).match(/גיל\s*(\d+)\s*(חודשים|חודש|שנים|שנה)?\s*(?:עד|-|–)\s*(\d+)\s*(חודשים|חודש|שנים|שנה)?/);
  if (!m) {
    // try cm sizes (NEXT uses 50-98cm etc.) -> rough mapping: <=98cm baby, else kids
    const cm = String(name).match(/(\d{2,3})\s*-?\s*(\d{2,3})?\s*cm/i);
    if (cm) { const lo = +cm[1]; const out = []; if (lo <= 98) out.push('0-2'); if ((cm[2] ? +cm[2] : lo) >= 92) out.push('2-8'); return out.length ? out : ['2-8']; }
    return ['0-2', '2-8'];
  }
  const yr = (n, u) => (/חודש/.test(u || '') ? +n / 12 : +n);
  const a = yr(m[1], m[2] || m[4] || 'שנים'), b = yr(m[3], m[4] || m[2] || 'שנים');
  const lo = Math.min(a, b), hi = Math.max(a, b), out = [];
  if (lo <= 2) out.push('0-2');
  if (lo <= 8 && hi >= 2) out.push('2-8');
  return out.length ? out : ['2-8'];
}
function colorOf(name) {
  const m = String(name).match(/^\s*(?:בצבע|צבע)\s+([^\-–]+?)\s*[-–]/);
  return m ? m[1].replace(/\s+/g, ' ').trim() : '';
}
function packOf(name) { const m = String(name).match(/מארז\s*של\s*(\d+)/); return m ? +m[1] : (/מארז/.test(name) ? 2 : 1); }
function cleanName(n) { return String(n || '').replace(/^\s*(?:בצבע|צבע)\s+[^\-–]+[-–]\s*/, '').replace(/\s+/g, ' ').trim(); }

// --- In-page extraction (runs inside the real browser; no 45s cap here) ------
async function scrapeListing(page, url) {
  await page.goto(BASE + url, { waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(3000);
  const collected = {};
  let stable = 0;
  for (let i = 0; i < 400 && stable < 8; i++) {
    const batch = await page.evaluate(() => {
      const strip = s => (s || '').replace(/[‎‏‪-‮ ]/g, ' ').replace(/\s+/g, ' ').trim();
      window.scrollBy(0, 900);
      const more = [...document.querySelectorAll('button,a')].find(x => strip(x.textContent) === 'עוד');
      if (more) more.click();
      const out = [];
      document.querySelectorAll('[data-testid="product_summary_title"]').forEach(tEl => {
        let href = '', root = tEl;
        for (let k = 0; k < 9 && root; k++) { const a = root.querySelector && root.querySelector('a[href*="/style/"]'); if (a) { href = (a.getAttribute('href') || '').split('#')[0].split('?')[0].replace(/^https?:\/\/[^/]+/, ''); break; } root = root.parentElement; }
        if (!href) return;
        const name = strip(tEl.textContent);
        const priceEl = [...(root ? root.querySelectorAll('span') : [])].map(s => strip(s.textContent)).find(t => /₪/.test(t)) || '';
        const nums = (priceEl.match(/\d+(?:\.\d+)?/g) || []).map(Number);
        let img = '';
        (root ? [...root.querySelectorAll('img')] : []).forEach(im => { const s = im.getAttribute('src') || im.getAttribute('data-src') || ''; if (/xcdn|next\.co/.test(s) && !/21x21|Swatch/i.test(s) && !img) img = s; });
        out.push({ href, name, min: nums.length ? Math.min(...nums) : null, max: nums.length ? Math.max(...nums) : null, img });
      });
      return out;
    });
    const before = Object.keys(collected).length;
    batch.forEach(p => { if (p.href && !collected[p.href]) collected[p.href] = p; });
    stable = Object.keys(collected).length === before ? stable + 1 : 0;
    await page.waitForTimeout(650);
  }
  return Object.values(collected);
}

function refreshIndex() {
  const files = fs.readdirSync(CAT_DIR).filter(f => /\.json$/.test(f)).sort();
  fs.writeFileSync(path.join(CAT_DIR, 'index.js'),
    '// Choosy catalogs registry — AUTO-GENERATED.\n\nmodule.exports = [\n' +
    files.map(f => "  require('./" + f + "')").join(',\n') + '\n];\n');
  return files.length;
}

(async () => {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({
    locale: 'he-IL', viewport: { width: 1366, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
  });
  const page = await ctx.newPage();

  const raw = [];                 // every product + classification (for QA)
  const buckets = {};             // catalog_id -> products[]
  const seenId = {};              // global dedupe by item id

  for (const seed of SEEDS) {
    let items = [];
    try { items = await scrapeListing(page, seed.url); }
    catch (e) { console.log('!! ' + seed.url + ' FAILED: ' + e.message); continue; }
    console.log(seed.gender + ' ' + seed.url + ' -> ' + items.length + ' products');

    for (const it of items) {
      if (!it.name || it.max == null) continue;
      const id = (it.href.match(/\/([^/]+)$/) || [])[1] || it.href;
      if (seenId[id]) continue; seenId[id] = true;
      const cat = categoryOf(it.name, seed.url);
      const ages = agesFor(it.name);
      const genders = gendersFor(seed.gender, it.name + ' ' + seed.url);
      const color = colorOf(it.name);
      const pack = packOf(it.name);
      const prod = {
        id: 'next-' + id, title: cleanName(it.name), image: it.img || ('https://xcdn.next.co.uk/Common/Items/Default/Default/ItemImages/3_4Ratio/SearchINT/Lge/' + String(id).toUpperCase() + '.jpg'),
        price: it.max, sale_price: (it.min != null && it.min < it.max) ? it.min : null, currency: 'ILS',
        url: BASE + it.href, brand: 'NEXT', color: color, color_hex: null,
        pack: pack, in_pack: pack > 1, affiliate_ready: false
      };
      raw.push({ id, gender: genders.join('+'), ages: ages.join('+'), category: cat, color, pack, name: prod.title, url: prod.url });
      for (const g of genders) for (const a of ages) {
        if (!validSeg(g, a, cat)) continue;
        const cid = 'next-' + g + '-' + a + '-' + cat;
        (buckets[cid] = buckets[cid] || []).push(prod);
      }
    }
  }
  await browser.close();

  // Wipe old next-* catalogs, write fresh
  fs.readdirSync(CAT_DIR).filter(f => /^next-.*\.json$/.test(f)).forEach(f => fs.unlinkSync(path.join(CAT_DIR, f)));
  let written = 0;
  Object.keys(buckets).sort().forEach(cid => {
    const m = cid.match(/^next-(boy|girl)-(0-2|2-8)-(\w+)$/);
    fs.writeFileSync(path.join(CAT_DIR, cid + '.json'), JSON.stringify({
      catalog_id: cid, site: 'NEXT', segment: { gender: m[1], age: m[2], category: m[3] },
      updated_at: new Date().toISOString().slice(0, 10), products: buckets[cid]
    }, null, 2));
    written++;
  });
  fs.mkdirSync(path.dirname(RAW_OUT), { recursive: true });
  fs.writeFileSync(RAW_OUT, JSON.stringify({ scraped_at: new Date().toISOString(), total: raw.length, products: raw }, null, 2));
  console.log('\nwritten ' + written + ' NEXT catalogs | ' + raw.length + ' unique products | raw -> data/next-raw.json');
  console.log('index.js now registers ' + refreshIndex() + ' catalogs');
})();
