# ChoosyBuy — project guide (source of truth)

Keep this file current. Update it after any significant change — it is the
first thing to read in a new session.

## What this is

**ChoosyBuy** (choosybuy.com) is a web app. Repo: `talpinkas/choosybuy`, branch `main`.
The whole project IS this site — there is no `web/` wrapper; everything lives at
the repo root. (An unrelated older repo named `choosy` should be ignored.)

**The idea — "2-not-3":** instead of comparing 3+ items at once (decision
paralysis), the user compares **two at a time** in a tournament until one winner
remains. Current product: **Choosy Kids** — helps parents pick kids' clothing
without the overwhelm. Direction: prove the method lowers decision load and
raises purchase intent, then sell it as an embeddable widget (B2B) to stores.

History: started as a Chrome extension, then moved to this site.

## Repo structure

```
api/         Vercel serverless functions
  get-pool.js    GET /api/get-pool — serves a filtered, shuffled product pool
  scrape.js      OLD live scraper (Terminal X mapping is broken; not in the live flow)
public/      Static frontend (vanilla JS, no framework, RTL Hebrew)
  index.html     screens: welcome / setup / loading / game
  app.js         flow: who → what → refine(color+budget) → game; Mixpanel tracking
  game.js        ChoosingGame — tournament logic (Fisher-Yates, 5-win champion, undo)
  style.css
catalogs/    Static product catalogs (one JSON per segment) + index.js registry
tools/
  build-catalogs.js     batch builder — fetches Terminal X, writes catalogs, refreshes index
  extract-terminalx.js  OLD manual console extractor (superseded by build-catalogs.js)
vercel.json  { "framework": null }   package.json  (dep: cheerio, used only by scrape.js)
```

## Data flow

1. User picks **who** (gender × age), **what** (category), then optional **refine**
   (color chips built from the pool + budget slider). All in `public/app.js`.
2. `app.js` calls `GET /api/get-pool?gender=&age=&category=&limit=`.
3. `api/get-pool.js` reads the static catalog files via `require('../catalogs')`,
   filters by `segment`, merges across sites, shuffles, slices to `limit`, and
   returns game-ready products (adds `colorFamily` from the Hebrew color label).
   **No external calls at request time** — all data is pre-built into the catalogs.
4. `game.js` runs the tournament; the winner screen links "לקנייה ב-<brand>" to the
   product `url`.

## Terminal X — listingSearch API (verified, the data source)

Catalogs are built from Terminal X's internal listing API. Key facts (verified):

- **Endpoint:** `POST https://www.terminalx.com/a/listingSearch`
  Body: `{ listingSearchOptions:{myBagSkus:[]},
  listingSearchQuery:{ categoryId, currentPage, filter:{category_id:{eq:categoryId}},
  includeAggregations:false, pageSize, sort:{default:true} } }`
- **No session needed at low volume.** A plain Node POST with a browser
  `User-Agent` + `Origin`/`Referer` returns JSON 200. `api/scrape.js` still
  establishes a session (cookies + `X-Fe-Version` from the homepage) — that path
  also works and is the safer choice at scale / if rate limits ever appear.
- **GraphQL `/graphql` (`urlResolver`) needs the session headers.** It powered the
  original catalog via `scrape.js` (POST + cookies + fe-version). A session-less POST
  404s / returns SPA HTML — which is why the builder skips GraphQL entirely: it uses
  known category IDs and verifies each by matching the response's
  `categories[0].url_path` to the expected path.
- **Response wrapper:** `data.elasticSearch` (handle `response.data.elasticSearch`
  as a fallback). Items: `elasticSearch.items[]`. Current category:
  `elasticSearch.categories[0]` → `{id, name, url_path, product_count}`.
- **pageSize:** use a large page (we use **500**) — it returns the whole set in one
  call. `pageSize:1` returns 0; mid-size pages (e.g. 200) silently DROP items to a
  banner slot. `total_count` over-counts (includes non-displayable); the real
  number of returned items is the ceiling.
- **Item → product mapping** (`item.name` / `item.url_key` are always null — do NOT use):
  - `title` = `small_image.label` (fallback `image.label`)
  - `image` = `small_image.url`
  - `slug`  = from the image filename: `([a-z]\d{6,})-\d+\.(jpg|jpeg|png|webp)`, lowercased.
    The image filename is the authoritative slug (sku is the color-less parent).
  - `url`   = `https://www.terminalx.com/<categories[0].url_path>/<slug>?color=<value_index>`
  - price: `price_range.minimum_price.regular_price.value` (orig);
    `final_price.value` is the sale price only if lower.
  - color: `configurable_options[attribute_code="color"].values[0]` →
    `.label` (Hebrew name), `.swatch_data.value` (hex), `.value_index` (for `?color=`).
  - **dedup by slug** (collapses color variants of one parent product).
- **Resolving category IDs:** the embedded category tree lives in each category
  page's HTML as `"url_path":"…","level":N,"id":M`. The 14 IDs we use are already
  resolved (table below). `build-catalogs.js` verifies each by checking that the
  API's returned `categories[0].url_path` matches the expected `txPath`.
- **~20–35% of listed products have NO live page (404).** They come from
  import/unpublished feeds and carry NO distinguishing field — empirically tested:
  dead and live products have identical `visibility` (4), `status` (1), and
  `stock_status2` (IN_STOCK). The URL format does not help — they 404 in every form
  (category-path AND slug-only). The only reliable fix is to **verify each product
  URL (HTTP HEAD) at build time and drop the dead ones.** `build-catalogs.js` does
  this by default. (`hide_until` is the one field not yet exhaustively checked as a
  possible cheap signal — a future optimization to avoid the HEAD pass.)

## Catalog format

`catalogs/terminalx-<gender>-<age>-<category>.json`:

```json
{
  "catalog_id": "terminalx-boy-0-2-tops",
  "site": "Terminal X",
  "segment": { "gender": "boy", "age": "0-2", "category": "tops" },
  "updated_at": "YYYY-MM-DD",
  "products": [{
    "id": "tx-<slug>", "title": "...", "image": "https://…",
    "price": 79.9, "sale_price": null, "currency": "ILS",
    "url": "https://www.terminalx.com/<path>/<slug>?color=<value_index>",
    "brand": "Terminal X", "color": "חרדל", "color_hex": "#dbbd36",
    "affiliate_ready": false
  }]
}
```

`catalogs/index.js` is AUTO-GENERATED by the builder — it just `require()`s every
`terminalx-*.json`. Don't edit it by hand.

## Taxonomy — the 14 segments

Categories per segment (keys must match `app.js` `SEGMENT_CATS` and the catalogs):

| gender | age | categories |
|--------|-----|------------|
| boy    | 0-2 | tops, bodysuits, swim |
| girl   | 0-2 | tops, bodysuits, dresses, swim |
| boy    | 2-8 | tops, bottoms, swim |
| girl   | 2-8 | tops, bottoms, dresses, swim |

Category keys → label: tops=חולצות, bottoms=מכנסיים, bodysuits=בגדי גוף,
dresses=שמלות, swim=בגדי ים.

Terminal X category IDs (0-2 → `baby/baby-*`, 2-8 → `kids/boys|girls/*`):

| catalog_id | txPath | categoryId |
|---|---|---|
| terminalx-boy-0-2-tops      | baby/baby-boys/shirts              | 23058 |
| terminalx-boy-0-2-bodysuits | baby/baby-boys/bodysuits-overalls  | 23057 |
| terminalx-boy-0-2-swim      | baby/baby-boys/swimwear            | 23064 |
| terminalx-girl-0-2-tops     | baby/baby-girls/shirts             | 23005 |
| terminalx-girl-0-2-bodysuits| baby/baby-girls/bodysuits-overalls | 23002 |
| terminalx-girl-0-2-dresses  | baby/baby-girls/dresses-skirts     | 23037 |
| terminalx-girl-0-2-swim     | baby/baby-girls/swimwear           | 23024 |
| terminalx-boy-2-8-tops      | kids/boys/shirts                   | 22961 |
| terminalx-boy-2-8-bottoms   | kids/boys/pants-jumpsuits          | 22962 |
| terminalx-boy-2-8-swim      | kids/boys/swimwear                 | 22967 |
| terminalx-girl-2-8-tops     | kids/girls/shirts                  | 19939 |
| terminalx-girl-2-8-bottoms  | kids/girls/pants-jumpsuits         | 19942 |
| terminalx-girl-2-8-dresses  | kids/girls/dresses                 | 19940 |
| terminalx-girl-2-8-swim     | kids/girls/swimsuit                | 19945 |

## Building catalogs

```
node tools/build-catalogs.js                 # build all 14 (verifies live URLs, ~2 min)
node tools/build-catalogs.js boy-2-8-tops    # one segment
node tools/build-catalogs.js --no-verify     # skip URL verification (fast, dev only)
```

The builder logs `raw / mapped / live (dead dropped)` per segment and flags any
path mismatch or too-few-products, then refreshes `catalogs/index.js`. The `SEGMENTS`
config (paths + IDs) is at the top of the file — to add/fix a segment, edit it there.

To add a new Terminal X segment: find its `categoryId` from the category page HTML
(`"url_path":"…","id":N`), add a row to `SEGMENTS`, run the builder.

## Multi-store: NEXT (next.co.il) — second source (manual)

`get-pool.js` merges any catalogs that share a `segment`, so a new retailer just
needs catalog JSONs in the same format. TX has an open API; **NEXT does not** —
next.co.il is behind **Akamai bot protection** (Node fetch is blocked/inconsistent),
so NEXT catalogs are built **by hand from a real browser**:

1. Open a NEXT kids category (e.g. `next.co.il/he/shop/boys/clothing/tops`), scroll
   to load all products, and run the **console extractor** (paste in DevTools). It
   reads each product tile (link → itemNumber, Hebrew title, price, color; image is
   derived as `xcdn.next.co.uk/.../3_4Ratio/SearchINT/Lge/<ITEM>.jpg`) and
   **downloads** `next-<path>.json` to Downloads. (Prices hide behind RTL marks
   `‏` in the tile text — strip them before parsing. The product list/price
   only fully render in a real, hydrated browser — automation/Node won't do.)
2. `node tools/import-next.js <downloaded-json>` converts it: infers gender(s)+category
   from the NEXT path (a gender-less `baby` path → BOTH genders), **parses the Hebrew
   age range from each title and buckets into 0-2 / 2-8 by overlap** (NEXT mixes ages,
   e.g. "גיל 3 חודשים עד 7 שנים"), and writes `catalogs/next-<gender>-<age>-<category>.json`
   **only for segments the app serves** (a `VALID` map mirrors app.js `SEGMENT_CATS` —
   no 0-2 bottoms, no 2-8 bodysuits). Refreshes `catalogs/index.js` (globs `terminalx-*`
   AND `next-*`).

NEXT catalogs are static manual snapshots (no auto-refresh / no live-URL HEAD pass —
the links are NEXT's own product hrefs, verified to resolve). Titles are Hebrew;
`color_hex` is null (only a Hebrew color label, which `get-pool` maps to a family).
Status: **full 14-segment coverage** (boy+girl × all categories, both age buckets),
matching TX — live in production. To refresh prices/stock, re-extract a category
in-browser and re-run the importer.

## Multi-store: Shilav (shilav.co.il) — third source (Shopify, automated)

Shilav runs on **Shopify with an open `/products.json`** (no bot block), so unlike
NEXT it has a fully **automated, refreshable builder**:

```
node tools/build-shilav.js     # full 14-segment build, ~10s
```

- Paginates `/products.json` (250/page), keeps `product_type === "בגדי תינוקות וילדים"`
  (Shilav also sells gear/textile/toys/furniture — those are dropped).
- **category** ← Hebrew keyword in the title (tops/bottoms/bodysuits/dresses/swim;
  no-match items like hats/gloves/socks are skipped).
- **age** ← Shopify Size option values (`NB`/`0-3m`…`18-24m` → 0-2; `2Y`…`6Y` → 2-8;
  spanning both → both buckets) — structured, no title parsing.
- **gender** ← בנים/בנות in title; dresses → girl; otherwise unisex → BOTH genders
  (most baby clothing). NOTE: "לבן" means *white*, not "for a boy" — don't use it.
- price/sale ← `variant.price` / `compare_at_price`; image ← `images[0].src`;
  url ← `/products/<handle>` (Hebrew handle, URL-encoded; verified to resolve).
- Writes `catalogs/shilav-<gender>-<age>-<category>.json` only for app-valid segments.
  `color_hex` null (color parsed from the title when present, else ''). Titles are
  short/generic (Shilav's own names).

Status: ~666 clothing items → full 14-segment coverage, merged with TX + NEXT.

## Multi-store: Fox (fox.co.il) — fourth source (Shopify, automated)

Also Shopify with an open `/products.json`, but a multi-department brand — so
`tools/build-fox.js` fetches the 4 gender×age **kids collections** directly:
`בייבי-בנים`/`בייבי-בנות` → 0-2, `boys`/`בנות-1` → 2-8 (gender+age come from the
collection). category ← `product_type` + title; shoes/accessories skipped.
price/sale/image/url/color same shape as Shilav. ~1230 items → full 14 segments.

```
node tools/build-fox.js        # ~15s
```

**Registry note:** all four builders' `refreshIndex` now globs **every
`catalogs/*.json`** (not a per-prefix list), so running any one builder rebuilds
the full index without dropping the others. A new retailer just needs a builder
that emits `<brand>-<gender>-<age>-<category>.json` in the standard format.

Live retailers: **Terminal X (Magento API) · NEXT (manual) · Shilav (Shopify) ·
Fox (Shopify)** — 4 catalogs per segment, 56 catalogs total.

## Known issues / gotchas

- Color chips: now populated — every product carries `color`/`color_hex` from the
  API. `get-pool.js` maps the Hebrew label to a `colorFamily` for the chips.
- `api/scrape.js` + `tools/extract-terminalx.js` are legacy. `scrape.js`'s mapping
  reads `item.name`/`item.url_key` (null) so it returns nothing useful — not in the
  live flow.
- Catalog freshness: catalogs are static snapshots. Re-run the builder to refresh
  prices/stock and prune newly-dead links.

## Working conventions

- Hebrew, RTL in UI copy. Avoid English words inside a Hebrew sentence (breaks
  rendering); English code/API terms are fine.
- Verify, don't assume — check real state before acting; don't claim "works" until
  observed working.
- After any change: `node --check` changed files, `node -e "require('./catalogs')"`
  to validate the registry, commit with a clear message, push.
- Update this CLAUDE.md after significant changes.

## Autonomy (how to operate here)

Work autonomously and don't ask permission for routine work (reading, editing,
running the build/probes, committing, pushing). **Proactively STOP and ask the
user first** only before:
- **Security** — installing dependencies/extensions, touching secrets or
  credentials, changing auth, or sending project data to an external service.
- **Spend** — anything that costs money or commits to a paid service (deploying to
  paid infra, buying a domain/SaaS, publishing a package).
- **Irreversible** — deleting files you didn't create, force-push, dropping data,
  or rewriting shared git history.

Permissions are configured in `.claude/settings.json` (committed: auto-allow
node/git, deny reading secrets) so routine commands don't prompt. That's an
optimization — this judgment rule is the real guardrail, not the settings.
