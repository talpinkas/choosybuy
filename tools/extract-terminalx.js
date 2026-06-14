// ============================================================
// CHOOSY — Manual catalog extractor for Terminal X (V1)
// ============================================================
// HOW TO USE:
// 1. Open a Terminal X KIDS category page in your browser
//    (e.g. filtered to the segment you want to build).
// 2. Open DevTools (F12) -> Console.
// 3. Edit the SEGMENT below to match the page you're on.
// 4. Paste this whole script, press Enter.
// 5. Trigger a product load (apply/remove a filter, or reload the
//    category). The script catches the page's listingSearch call,
//    replays it with pageSize 500, and prints a ready-to-save
//    Choosy catalog JSON. Copy it into web/catalogs/<name>.json
//    and register it in web/catalogs/index.js.
// ============================================================

(function () {
  var SEGMENT = { gender: "boy", age: "0-2", category: "tops" }; // <-- EDIT THIS

  var origFetch = window.fetch;
  var origOpen = XMLHttpRequest.prototype.open;
  var origSend = XMLHttpRequest.prototype.send;
  var done = false;

  console.log('%c[CHOOSY] Extractor armed. Apply/remove a filter or reload the category to trigger a product load...', 'color:#ff6b4a;font-weight:bold');

  function findProductsArray(obj) {
    var best = [];
    (function walk(o) {
      if (!o || typeof o !== 'object') return;
      if (Array.isArray(o)) {
        if (o.length > best.length && o[0] && typeof o[0] === 'object' && o[0].name) best = o;
        o.forEach(walk);
        return;
      }
      Object.keys(o).forEach(function (k) { walk(o[k]); });
    })(obj);
    return best;
  }

  function normalize(items) {
    var out = [];
    items.forEach(function (item) {
      if (!item.name) return;
      var image = '';
      if (item.small_image && item.small_image.url) image = item.small_image.url;
      else if (item.thumbnail && item.thumbnail.url) image = item.thumbnail.url;
      else if (item.image && item.image.url) image = item.image.url;

      var url = item.url_key ? ('https://www.terminalx.com/' + item.url_key) : (item.url || '');
      if (url && url.indexOf('utm_source') === -1) url += (url.indexOf('?') === -1 ? '?' : '&') + 'utm_source=choosy';

      var price = 0, sale = null;
      if (item.price_range && item.price_range.minimum_price) {
        var mp = item.price_range.minimum_price;
        price = (mp.regular_price && mp.regular_price.value) || 0;
        var fin = (mp.final_price && mp.final_price.value) || price;
        if (fin < price) sale = fin; else price = fin;
      }
      if (!price) return;

      out.push({
        id: 'tx-' + (item.sku || item.id || out.length),
        title: String(item.name),
        image: image,
        price: price,
        sale_price: sale,
        currency: 'ILS',
        url: url,
        brand: 'Terminal X',
        affiliate_ready: false
      });
    });
    return out;
  }

  async function replayAndPrint(query) {
    if (done) return;
    done = true;
    window.fetch = origFetch;
    XMLHttpRequest.prototype.open = origOpen;
    XMLHttpRequest.prototype.send = origSend;

    query.pageSize = 500;
    query.currentPage = 1;

    var data = await origFetch('/a/listingSearch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingSearchQuery: query, listingSearchOptions: { myBagSkus: [] } })
    }).then(function (r) { return r.json(); });

    var products = normalize(findProductsArray(data));
    var catalog = {
      catalog_id: 'terminalx-' + SEGMENT.gender + '-' + SEGMENT.age + '-' + SEGMENT.category,
      site: 'Terminal X',
      segment: SEGMENT,
      updated_at: new Date().toISOString().slice(0, 10),
      products: products
    };
    console.log('%c[CHOOSY] Extracted ' + products.length + ' products. Copy the JSON below:', 'color:#2ecc71;font-weight:bold');
    console.log(JSON.stringify(catalog, null, 2));
  }

  // Intercept fetch
  window.fetch = function () {
    try {
      var url = (arguments[0] && arguments[0].url) || arguments[0];
      if (typeof url === 'string' && url.indexOf('listingSearch') !== -1 && arguments[1] && arguments[1].body) {
        var body = JSON.parse(arguments[1].body);
        if (body && body.listingSearchQuery) replayAndPrint(body.listingSearchQuery);
      }
    } catch (e) {}
    return origFetch.apply(this, arguments);
  };

  // Intercept XHR (in case the page uses it)
  XMLHttpRequest.prototype.open = function () { this.__choosyUrl = arguments[1]; return origOpen.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function (body) {
    try {
      if (this.__choosyUrl && this.__choosyUrl.indexOf('listingSearch') !== -1 && body) {
        var parsed = JSON.parse(body);
        if (parsed && parsed.listingSearchQuery) replayAndPrint(parsed.listingSearchQuery);
      }
    } catch (e) {}
    return origSend.apply(this, arguments);
  };
})();
