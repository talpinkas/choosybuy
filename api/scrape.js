// Choosy API — Scrapes product listing pages and returns product data as JSON.

var cheerio = require('cheerio');

var SITE_CONFIGS = {
  terminalx: { name: 'Terminal X', hostMatch: 'terminalx.com', selector: 'li[class*="listing-product"]', paginationParam: 'p', perPage: 20 },
  hm: { name: 'H&M', hostMatch: 'hm.com', selector: 'article[data-testid="product-card"], li.product-item, [class*="product-item"]', paginationParam: 'page', perPage: 36 },
  next: { name: 'NEXT', hostMatch: 'next.co.il', selector: '[class*="product" i], [class*="item" i]', paginationParam: 'p', perPage: 20 },
  asos: { name: 'ASOS', hostMatch: 'asos.com', selector: 'article[data-auto-id="productTile"], [data-auto-id="productTile"]', paginationParam: 'page', perPage: 72 }
};

var GENERIC_SELECTORS = [
  '[class*="product" i]', '[class*="item" i]', '[class*="card" i]',
  '[data-testid*="product" i]', '[data-product]', '[data-item-id]'
];

function parsePrices(text) {
  var matches = (text || '').match(/(\d[\d,]*\.?\d*)/g);
  if (!matches || matches.length === 0) return { salePrice: null, originalPrice: 0 };
  var nums = matches.map(function(m) { return parseFloat(m.replace(/,/g, '')) || 0; }).filter(function(n) { return n > 0; });
  if (nums.length === 0) return { salePrice: null, originalPrice: 0 };
  if (nums.length === 1) return { salePrice: null, originalPrice: nums[0] };
  if (nums[0] >= nums[1]) return { salePrice: null, originalPrice: nums[0] };
  return { salePrice: nums[0], originalPrice: nums[1] };
}

function detectSite(url) {
  var keys = Object.keys(SITE_CONFIGS);
  for (var i = 0; i < keys.length; i++) {
    if (url.indexOf(SITE_CONFIGS[keys[i]].hostMatch) !== -1) return SITE_CONFIGS[keys[i]];
  }
  return null;
}

function detectTotal(html) {
  var match = html.match(/(\d+)\s*(?:products|items|results|מוצרים|פריטים)/i);
  return match ? parseInt(match[1]) : null;
}

function extractProduct($el, $) {
  // Name: heading, img alt, link title, link text
  var name = '';
  var nameEl = $el.find('h2, h3, h4, [class*="title" i], [class*="name" i]').first();
  if (nameEl.length) name = nameEl.text().trim();
  if (!name || name.length < 3) {
    var img = $el.find('img').first();
    if (img.length) name = (img.attr('alt') || '').trim();
  }
  if (!name || name.length < 3) {
    var link = $el.find('a[title]').first();
    if (link.length) name = (link.attr('title') || '').trim();
  }
  if (!name || name.length < 3) {
    var aText = $el.find('a').first();
    if (aText.length) name = aText.text().trim();
  }
  if (!name || name.length < 3 || name.length > 300) return null;

  // Image: pick best (skip badges/icons)
  var image = '';
  var bestScore = -999;
  $el.find('img').each(function() {
    var src = $(this).attr('src') || $(this).attr('data-src') || '';
    if (!src || src.startsWith('data:')) return;
    var score = 0;
    var alt = $(this).attr('alt') || '';
    if (alt.length > 5) score += 500;
    if (/icon|badge|logo|flag|star|rating|choice|sprite/i.test(src)) score -= 1000;
    if (score > bestScore) { bestScore = score; image = src; }
  });

  // URL
  var linkEl = $el.is('a') ? $el : $el.find('a[href]').first();
  var url = linkEl.length ? (linkEl.attr('href') || '') : '';

  // Price
  var priceText = '';
  $el.find('[class*="price" i], [class*="Price"]').each(function() {
    priceText += ' ' + $(this).text();
  });
  if (!priceText) {
    var allText = $el.text();
    var cm = allText.match(/[₪$€£]\s*[\d,.]+|[\d,.]+\s*[₪$€£]/g);
    if (cm) priceText = cm.join(' ');
  }
  var prices = parsePrices(priceText);

  // Skip elements without useful data
  if (!prices.originalPrice && !image) return null;
  // Skip container elements (too much text = probably not a product card)
  if ($el.text().length > 1000) return null;

  return { name: name, image: image, url: url, salePrice: prices.salePrice, originalPrice: prices.originalPrice || 0 };
}

function extractFromHtml(html, siteConfig, baseUrl) {
  var $ = cheerio.load(html);
  var products = [];
  var seen = {};

  // Try site-specific selector first
  var selectors = siteConfig ? [siteConfig.selector] : [];
  selectors = selectors.concat(GENERIC_SELECTORS);

  for (var s = 0; s < selectors.length; s++) {
    $(selectors[s]).each(function() {
      var $el = $(this);
      if ($el.children().length > 30) return;
      var p = extractProduct($el, $);
      if (p && p.name && !seen[p.name]) {
        seen[p.name] = true;
        if (p.url && !p.url.startsWith('http')) {
          try { p.url = new URL(p.url, baseUrl).toString(); } catch(e) {}
        }
        if (p.image && !p.image.startsWith('http')) {
          try { p.image = new URL(p.image, baseUrl).toString(); } catch(e) {}
        }
        products.push(p);
      }
    });
    if (products.length >= 3) break;
  }

  // Also try JSON-LD
  $('script[type="application/ld+json"]').each(function() {
    try {
      var data = JSON.parse($(this).html());
      var items = [];
      if (Array.isArray(data)) items = data;
      else if (data['@type'] === 'ItemList' && data.itemListElement) items = data.itemListElement.map(function(e) { return e.item || e; });
      else if (data['@graph']) items = data['@graph'];
      items.forEach(function(item) {
        if (!item || item['@type'] !== 'Product' || !item.name || seen[item.name]) return;
        seen[item.name] = true;
        var origPrice = 0;
        if (item.offers) {
          var offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
          origPrice = parseFloat(offer.price || offer.lowPrice) || 0;
        }
        products.push({
          name: item.name, image: (Array.isArray(item.image) ? item.image[0] : item.image) || '',
          url: item.url || '', salePrice: null, originalPrice: origPrice
        });
      });
    } catch(e) {}
  });

  return products;
}

var HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml',
  'Accept-Language': 'he-IL,he;q=0.9,en;q=0.8'
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  var targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).json({ error: 'Missing url parameter' });
  try { new URL(targetUrl); } catch(e) { return res.status(400).json({ error: 'Invalid URL' }); }

  var siteConfig = detectSite(targetUrl);
  var startTime = Date.now();

  try {
    var response = await fetch(targetUrl, { headers: HEADERS });
    var html = await response.text();

    var allProducts = extractFromHtml(html, siteConfig, targetUrl);
    var totalHint = detectTotal(html);
    var perPage = allProducts.length || (siteConfig ? siteConfig.perPage : 20);

    // Fetch more pages — time-bounded
    var shouldFetchMore = (totalHint && allProducts.length < totalHint) || (!totalHint && allProducts.length >= 3);
    if (shouldFetchMore && perPage > 0) {
      var totalPages = totalHint ? Math.min(Math.ceil(totalHint / perPage), 15) : 10;
      var pagParam = (siteConfig && siteConfig.paginationParam) || 'page';

      for (var batch = 0; batch < 3; batch++) {
        if (Date.now() - startTime > 7000) break;

        var bStart = batch * 5 + 2;
        var bEnd = Math.min(bStart + 5, totalPages + 1);
        if (bStart > totalPages) break;

        var fetches = [];
        for (var p = bStart; p < bEnd; p++) {
          var pageUrl = new URL(targetUrl);
          pageUrl.searchParams.set(pagParam, String(p));
          fetches.push(
            fetch(pageUrl.toString(), { headers: HEADERS })
              .then(function(r) { return r.text(); })
              .then(function(pageHtml) { return extractFromHtml(pageHtml, siteConfig, targetUrl); })
              .catch(function() { return []; })
          );
        }

        var pageResults = await Promise.all(fetches);
        var seen = {};
        allProducts.forEach(function(p) { seen[p.name] = true; });
        pageResults.forEach(function(prods) {
          prods.forEach(function(p) {
            if (!seen[p.name]) { seen[p.name] = true; allProducts.push(p); }
          });
        });
      }
    }

    allProducts.forEach(function(p, i) { p.id = i + 1; });

    res.status(200).json({
      products: allProducts,
      site: siteConfig ? siteConfig.name : 'Unknown',
      total: allProducts.length,
      totalHint: totalHint
    });

  } catch(err) {
    res.status(500).json({ error: 'Failed to fetch products', details: err.message });
  }
};
