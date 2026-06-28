// ============================================================
// CHOOSY — NEXT (next.co.il) comprehensive kids/baby scraper — Playwright, LOCAL.
// ============================================================
// Drives your REAL Chrome (Akamai trusts it) via CDP, discovers every kids
// listing page, loads each fully (fresh tab per category, capped, gently paced
// so the renderer never crashes), and writes data/next-data.json. Saves after
// EVERY category and resumes on re-run, so an interruption never loses progress.
//
//   FALLBACK (required — Akamai blocks a launched browser):
//   1) Quit Chrome completely (no chrome.exe left in Task Manager).
//   2) Launch your Chrome with remote debugging (PowerShell):
//      Start-Process "C:\Program Files\Google\Chrome\Application\chrome.exe" -ArgumentList '--remote-debugging-port=9222','--user-data-dir=C:\Users\talpi\chrome-next'
//   3) In that window browse to next.co.il once (so Akamai sets its cookie).
//   4) Run:  $env:NEXT_CDP="http://localhost:9222"   then   node tools/scrape-next.js
// ============================================================
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const BASE = 'https://www.next.co.il';
const OUT = path.join(__dirname, '..', 'data', 'next-data.json');

const SECTIONS = [
  { url: '/he/boys',  gender: 'boy' },
  { url: '/he/girls', gender: 'girl' },
  { url: '/he/baby',  gender: 'baby' }
];

const EXTRACT = () => {
  const strip = s => (s || '').replace(/[‎‏‪-‮ ]/g, ' ').replace(/\s+/g, ' ').trim();
  const out = [];
  document.querySelectorAll('[data-testid="product_summary_title"]').forEach(tEl => {
    let href = '', root = tEl;
    for (let k = 0; k < 9 && root; k++) { const a = root.querySelector && root.querySelector('a[href*="/style/"]'); if (a) { href = (a.getAttribute('href') || '').split('#')[0].split('?')[0].replace(/^https?:\/\/[^/]+/, ''); break; } root = root.parentElement; }
    if (!href) return;
    const name = strip(tEl.textContent);
    const priceEl = [...(root ? root.querySelectorAll('span') : [])].map(s => strip(s.textContent)).find(t => /₪/.test(t)) || '';
    const nums = (priceEl.match(/\d+(?:\.\d+)?/g) || []).map(Number);
    out.push({ href, name, min: nums.length ? Math.min(...nums) : null, max: nums.length ? Math.max(...nums) : null });
  });
  return out;
};

async function loadFully(page, url) {
  await page.goto(BASE + url, { waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(3000);
  const collected = {};
  let stable = 0;
  for (let i = 0; i < 1000 && stable < 12; i++) {
    let batch = [];
    try { batch = await page.evaluate(EXTRACT); } catch (e) {}
    const before = Object.keys(collected).length;
    batch.forEach(p => { if (p.href && !collected[p.href]) collected[p.href] = p; });
    await page.evaluate(() => window.scrollBy(0, 1200)).catch(() => {});
    try { const more = await page.$('xpath=//button[normalize-space(.)="עוד"] | //a[normalize-space(.)="עוד"]'); if (more) await more.click({ timeout: 1500 }).catch(() => {}); } catch (e) {}
    await page.waitForTimeout(550);
    if (Object.keys(collected).length === before) stable++; else stable = 0;
    if (Object.keys(collected).length >= 250) break;   // per-category cap: keep DOM light + lighter Akamai load
  }
  return Object.values(collected);
}

async function discover(ctx, section) {
  const page = await ctx.newPage();
  let links = [];
  try {
    await page.goto(BASE + section.url, { waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => {});
    await page.waitForTimeout(2500);
    links = await page.evaluate(() => {
      const set = new Set();
      document.querySelectorAll('a[href]').forEach(a => {
        let h = (a.getAttribute('href') || '').split('#')[0].split('?')[0].replace(/^https?:\/\/[^/]+/, '');
        if (/^\/he\/shop\//.test(h) && h.indexOf('/f/') === -1 && h.split('/').length >= 5) set.add(h);
      });
      return [...set];
    }).catch(() => []);
  } finally { await page.close().catch(() => {}); }
  return links;
}

function catHint(url) { return /footwear/.test(url) ? 'shoes' : /accessor/.test(url) ? 'accessories' : ''; }

(async () => {
  let browser, ctx;
  if (process.env.NEXT_CDP) {
    browser = await chromium.connectOverCDP(process.env.NEXT_CDP);
    ctx = browser.contexts()[0] || await browser.newContext();
    console.log('attached to your Chrome via CDP ' + process.env.NEXT_CDP);
  } else {
    browser = await chromium.launch({ headless: false, channel: 'chrome', args: ['--disable-blink-features=AutomationControlled'] }).catch(async () => chromium.launch({ headless: false }));
    ctx = await browser.newContext({ locale: 'he-IL' });
    await ctx.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });
  }

  // warm-up
  { const w = await ctx.newPage(); await w.goto(BASE + '/he', { waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => {}); await w.waitForTimeout(4000); await w.close().catch(() => {}); }

  // optional section filter (e.g. NEXT_ONLY=girl,baby) to target a gap with a fresh Akamai budget
  const ONLY = (process.env.NEXT_ONLY || '').split(',').map(s => s.trim()).filter(Boolean);
  const sections = ONLY.length ? SECTIONS.filter(s => ONLY.includes(s.gender)) : SECTIONS;
  const CATS = (process.env.NEXT_CATS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (CATS.length) console.log('NEXT_CATS=' + CATS.join(',') + ' — only listing pages whose URL matches one of these');
  if (ONLY.length) console.log('NEXT_ONLY=' + ONLY.join(',') + ' — scraping ONLY these sections, fresh (prior "done" ignored)');

  // build the listing queue from each section's discovered listings
  const queue = [];
  for (const sec of sections) {
    let found = await discover(ctx, sec);
    const seg = sec.url.replace('/he/', '');
    found = found.filter(u => u.indexOf('/' + seg + '/') !== -1 || u.indexOf('/shop/' + seg) !== -1);
    if (!found.length) found = [`/he/shop/${seg}/clothing`];
    found.filter(u => !CATS.length || CATS.some(c => u.indexOf(c) !== -1)).forEach(u => queue.push({ url: u, gender: sec.gender }));
    console.log(sec.gender + ': discovered ' + found.length + ' listing pages');
  }

  // resume: load prior progress so a re-run CONTINUES
  let seen = {}, products = [], done = new Set();
  try { const prev = JSON.parse(fs.readFileSync(OUT, 'utf8')); (prev.products || []).forEach(p => { products.push(p); seen[p.id] = true; }); (prev.done || []).forEach(u => done.add(u)); if (products.length) console.log('resuming: ' + products.length + ' products, ' + done.size + ' categories already done'); } catch (e) {}
  if (ONLY.length) done = new Set();   // subset run: re-evaluate these sections fresh; existing products kept + deduped via seen
  function save() { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify({ scraped_at: new Date().toISOString(), total: products.length, products, done: [...done] })); }

  for (const item of queue) {
    if (done.has(item.url)) { console.log('  skip (done) ' + item.url); continue; }
    let list = [];
    for (let attempt = 0; attempt < 2; attempt++) {   // one retry: empty often = transient throttle, not a real empty category
      let p = null;
      try { p = await ctx.newPage(); list = await loadFully(p, item.url); }
      catch (e) { console.log('!! ' + item.url + ' failed: ' + e.message); }
      finally { if (p) await p.close().catch(() => {}); }
      if (list.length) break;
      await new Promise(r => setTimeout(r, 6000));   // cool down before the retry
    }
    const hint = catHint(item.url);
    let added = 0;
    for (const it of list) {
      if (!it.name || it.max == null) continue;
      const id = ((it.href.match(/\/([^/]+)$/) || [])[1] || '').toUpperCase();
      if (!id || seen[id]) continue; seen[id] = true; added++;
      products.push({ href: it.href.replace('/he/style/', ''), id, name: it.name, min: it.min, max: it.max, gender: item.gender, cat: hint, url: BASE + it.href, image: 'https://xcdn.next.co.uk/Common/Items/Default/Default/ItemImages/3_4Ratio/SearchINT/Lge/' + id + '.jpg' });
    }
    if (list.length > 0) done.add(item.url);   // mark done ONLY if productive — throttled/empty pages retry next run
    save();
    console.log('  ' + item.gender + ' ' + item.url + ' -> ' + list.length + ' (new ' + added + ', total ' + products.length + ')');
    await new Promise(r => setTimeout(r, 2000));   // gentle pause between categories — ease Akamai
  }

  save();
  console.log('\nDONE. ' + products.length + ' unique products -> data/next-data.json');
  console.log('Next: node tools/import-next-data.js');
  try { await browser.close(); } catch (e) {}
  process.exit(0);
})();
