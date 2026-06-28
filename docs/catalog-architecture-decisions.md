# Catalog architecture decisions (CPO meeting, 2026-06-28)

Authoritative record of the catalog/category/filter decisions for the NEXT
single-site pilot. This doubles as the implementation brief for `catalog-engineer`.
Source data: ~9,000 unique NEXT products (vision-classified: gender, category,
color, color2, pattern, theme, style, pack).

## Decisions (locked)

1. **Breadth via grouping, not cutting.** Keep a rich catalog, organized in a
   2-tier picker so choosing a category never becomes "gathering."
2. **Swim is headline for all 4 segments** (start of summer).
3. **Bodysuits is headline for 0-2** (both genders) — what babies mostly wear.
4. **Multipack is a filter, not a category** (`in_pack`). Most relevant to
   bodysuits (63%) and nightwear (65%). Items already sit in their real garment
   category, so this is just exposing a flag.
5. **Outfit-sets dissolve into their garment categories** + an `is_set` flag.
   A "סט חולצה+מכנס" appears under BOTH חולצות and מכנסיים, tagged `is_set=true`.
   ~1,972 sets. (The ~127 multipacks currently filed under "sets" move to their
   real garment category too.)
6. **Accessories split into sub-types, 2-8 only:** כובעים, גרביים, תיקים, משקפי שמש.
   Archive (do not publish): 0-2 accessories (mostly sun-hats — easy to restore),
   baby-care (ביב/מגבת), gloves, hair, belts, "אחר".
7. **Filters (visible):** תקציב · צבע · וייב/סטייל · מבצע. **Adaptive toggles:**
   מולטיפק · "בלי סטים". **Theme/דמות: removed entirely** (30% coverage = friction).
8. **unisex → shown in both genders** (richest pool; most baby clothing is
   genuinely unisex). Duplication is a counting artifact, not a UX problem.
9. **Sets default ON inside a category** (richer pool). The toggle EXCLUDES them
   ("בלי סטים") for users who want single items only — a widening default, not a
   narrowing one.

## The governing rule — "protected minimum pool"

The real risk is not filter count, it's pool size after filtering. A "2-not-3"
tournament to a 5-win champion needs variety or it feels repetitive.

- **Floor = 8 items** to start a tournament; **12+ is comfortable.**
- Any filter value (color, vibe, multipack, "no sets") that would drop the result
  **below 8 is shown with a live count and disabled** (e.g. "מארזים (3)" greyed) —
  not silently hidden. Transparent, teaches the user, keeps trust. Applies to
  **all** filters uniformly, not just multipack/sets.
- **Auto-relax for thin base cells:** if category + budget alone already returns
  < 8 (real cases: מכנסיים בת 2-8 = 33, בגדי ים בן 0-2 = 19, משקפי שמש = 20),
  prompt to widen ("נמצאו 5 — להרחיב תקציב?") instead of showing a dead pool.

## Final category map

| קטגוריה | בן 0-2 | בת 0-2 | בן 2-8 | בת 2-8 | group |
|---|:-:|:-:|:-:|:-:|---|
| חולצות (tops) | ✓ | ✓ | ✓ | ✓ | ביגוד |
| מכנסיים (bottoms) | ✓ | ✓ | ✓ | ✓⚠️ | ביגוד |
| שמלות (dresses) | – | ✓ | – | ✓ | ביגוד |
| בגדי גוף (bodysuits) | ✓ | ✓ | – | – | ביגוד |
| בגדי ים (swim) | ✓ | ✓ | ✓ | ✓ | ביגוד |
| מעילים (outerwear) | ✓ | ✓ | ✓ | ✓ | ביגוד |
| פיג'מות (nightwear) | ✓ | ✓ | ✓ | ✓ | ביגוד |
| נעליים (shoes) | ⚠️ | ⚠️ | ✓ | ✓ | נעליים |
| כובעים (hats) | – | – | ✓ | ✓ | אקססוריז |
| גרביים (socks) | – | – | ✓ | ✓ | אקססוריז |
| תיקים (bags) | – | – | ✓ | ✓ | אקססוריז |
| משקפי שמש (sunglasses) | – | – | ✓ | ✓ | אקססוריז |

⚠️ = thin / data-quality flag (see below). Shoes 0-2 is thin (32/34) — show in the
accessories-style group, not headline.

## Implementation tasks

### A. `tools/import-next-data.js`
- **Accessories sub-split:** when category resolves to `accessories`, re-derive a
  sub-type from the title — `hats` (כובע/טורבן/hat/cap/מצחי), `socks`
  (גרב/קרסולי/sock/טייץ/גרביון), `bags` (תיק/ילקוט/קלמר/bag/backpack), `sunglasses`
  (משקפי/sunglass). Anything else (ביב/מגבת/כפפה/שיער/חגורה) → `_archive` (not written).
- **Accessories segment rule:** the 4 sub-types are valid only for `age==='2-8'`.
- **Sets dissolve:** when category resolves to `sets`, parse the title for garment
  terms and emit the product into each garment category it contains
  (חולצה→tops, מכנס/שורט→bottoms, שמלה→dresses, etc.), with `is_set=true`.
  Drop the standalone `sets` category.
- **Multipack under sets:** the ~127 `in_pack` items currently in `sets` follow the
  same dissolve (they land in their garment category with `in_pack=true`).
- **girl-2-8 bottoms leak (33):** investigate — girls' pants/leggings likely
  mis-binned into sets/dresses. Fix the classifier so the count is realistic.
- Add `is_set` to the product object (alongside `in_pack`, `style`).
- Update `validSeg()` for the accessories sub-types; drop `sets` as an output cat.

### B. `api/get-pool.js`
- Pass through to the frontend: `style` (vibe), `inPack` (`p.in_pack`),
  `isSet` (`p.is_set`), and a `sale` boolean (already computed as `salePrice`).
- Keep `colorFamily` logic as-is (do NOT revert the left-most-wins fix).

### C. `public/app.js` + `index.html` + `style.css`
- `CAT_META`: add outerwear, nightwear, shoes, hats, socks, bags, sunglasses
  (label + emoji). Remove nothing used elsewhere.
- `SEGMENT_CATS`: replace with the final map above.
- Category picker: 2-tier grouping (ביגוד / נעליים / אקססוריז). 0-2 = single group.
- Refine page: keep budget + color (existing); add vibe/style chips, "רק במבצע"
  toggle, "רק מארזים" toggle, "בלי סטים" toggle. No theme.
- **Adaptive logic** (client-side over the fetched pool): compute live counts per
  filter value; disable + show count when applying would drop below floor (8);
  auto-relax prompt when base pool < 8. Mixpanel: log filter usage.
- **Design unchanged** — original vintage identity, real CHOOSY logo, tokens.

## Rebuild + verify + deploy runbook (CEO machine)

The catalog rebuild reads large local files (`data/next-data.json`,
`data/classifications.json`) — run on the CEO machine, NOT the sandbox
(stale-mount = data-loss risk).

```
node --check tools/import-next-data.js && node --check api/get-pool.js \
  && node --check public/app.js && node --check public/i18n.js   # syntax gate
node tools/import-next-data.js          # rebuild NEXT catalogs (wipes + writes)
node -e "require('./catalogs')"         # registry must load clean
node tools/audit-next.js                # classification audit (>=8 gate, gender, category)
node tools/gen-gallery.js               # next-catalog-check.html for visual approval
# eyeball the gallery, then:
bash tools/load-push-token.sh && git add -A && git commit -m "catalog: new category architecture + adaptive filters" && git push
curl -s -o /dev/null -w "%{http_code}\n" https://choosybuy.com/   # expect 2xx/3xx
```

## Open flags (non-blocking)
- Age parsing (improved 2026-06-28): now reads Hebrew + English + single ages +
  newborn labels, with a months fence-post fix. Residual minor leak: items with
  NO age string in the title default to 2-8 (a small minority — NEXT usually
  states age). Future polish: infer age from size codes or a light vision pass.
- girl-2-8 bottoms = 33 → FIXED (now ~1,338, the sets-dissolve corrected it).
- shoes 0-2 thin (32/34) — grouped, not headline.
- 0-2 sun-hats archived by decision — restorable if wanted.
