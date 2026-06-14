// ============================================================
// CHOOSY — Manual catalog extractor for Terminal X (V1)
// ============================================================
// HOW TO USE:
// 1. Open a Terminal X kids category page (e.g. baby/baby-boys/shirts).
// 2. Find the category_id: in DevTools Console run the diagnostic, or use
//    the direct call below with the categoryId you captured.
// 3. Edit SEGMENT + categoryId, paste into Console, Enter.
//    The catalog JSON is copied to your clipboard (copy()) — paste it
//    into web/catalogs/<name>.json and register it in catalogs/index.js.
//
// STRUCTURE (verified):
//   products: data.elasticSearch.items[]  (each item = a product)
//   name:  item.small_image.label   (NOT item.name — that's null)
//   image: item.small_image.url
//   price: item.price_range.minimum_price.{regular_price,final_price}.value
//   slug:  parsed from the image filename (e.g. r657620001-123.jpg ->
//          r657620001). The item.sku is the parent sku WITHOUT color
//          digits, so slicing it is unreliable — the image filename is
//          the authoritative slug source.
//   url:   https://www.terminalx.com/{category url_path}/{slug}
// ============================================================

(function () {
  var SEGMENT = { gender: "boy", age: "0-2", category: "tops" }; // <-- EDIT
  var CATEGORY_ID = "23058"; // <-- EDIT (the page's category_id)

  fetch('/a/listingSearch', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      listingSearchQuery: { categoryId: CATEGORY_ID, filter: { category_id: { eq: CATEGORY_ID } }, pageSize: 500, currentPage: 1, sort: { default: true }, includeAggregations: false },
      listingSearchOptions: { myBagSkus: [] }
    })
  }).then(function (r) { return r.json(); }).then(function (d) {
    var es = d.data.elasticSearch, items = es.items || [];
    var cp = (es.categories && es.categories[0] && es.categories[0].url_path) || '';
    var seen = {}, out = [];
    items.forEach(function (it) {
      var name = (it.small_image && it.small_image.label) || (it.image && it.image.label) || '';
      var img = (it.small_image && it.small_image.url) || (it.thumbnail && it.thumbnail.url) || '';
      if (!name || !img) return;
      var m = img.match(/([a-z]\d{6,})-\d+\.(?:jpg|jpeg|png|webp)/i);
      var slug = m ? m[1].toLowerCase() : '';
      if (!slug || seen[slug]) return; seen[slug] = true;
      var mp = (it.price_range && it.price_range.minimum_price) || {};
      var reg = (mp.regular_price && mp.regular_price.value) || 0;
      var fin = (mp.final_price && mp.final_price.value) || reg;
      var price = reg, sale = null; if (fin < reg) sale = fin; else price = fin;
      if (!price) return;
      out.push({ id: 'tx-' + slug, title: name, image: img, price: price, sale_price: sale, currency: 'ILS', url: 'https://www.terminalx.com/' + (cp ? cp + '/' : '') + slug + '?utm_source=choosy', brand: 'Terminal X', affiliate_ready: false });
    });
    var cat = { catalog_id: 'terminalx-' + SEGMENT.gender + '-' + SEGMENT.age + '-' + SEGMENT.category, site: 'Terminal X', segment: SEGMENT, updated_at: new Date().toISOString().slice(0, 10), products: out };
    try { copy(JSON.stringify(cat, null, 2)); } catch (e) {}
    console.log('%c[CHOOSY] ' + out.length + ' products copied to clipboard.', 'color:#2ecc71;font-weight:bold;font-size:14px');
    console.log(JSON.stringify(cat, null, 2));
  }).catch(function (e) { console.log('[CHOOSY] error', e); });
})();
