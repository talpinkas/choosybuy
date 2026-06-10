// Choosy API — Scrapes product listing pages and returns product data as JSON.
// Accepts: GET /api/scrape?url=https://www.terminalx.com/men/shirts
// Returns: { products: [...], site: "Terminal X", total: 42 }

const SITE_CONFIGS = {
  terminalx: {
    name: 'Terminal X',
    hostMatch: 'terminalx.com',
    productSelector: 'li[class*="listing-product"]',
    paginationParam: 'p',
    perPage: 13,
    extract: function(el) {
      var img = el.querySelector('img');
      if (!img) return null;
      var name = (img.getAttribute('alt') || '').trim();
      if (!name) return null;
      var image = img.getAttribute('src') || img.getAttribute('data-src') || '';
      var link = el.querySelector('a[href]');
      var url = link ? link.getAttribute('href') : '';
      var priceText = '';
      var priceEls = el.querySelectorAll('[class*="price"]');
      priceEls.forEach(function(p) { priceText += ' ' + p.textContent; });
      var prices = parsePrices(priceText);
      if (!prices.originalPrice) return null;
      return { name: name, image: image, url: url, salePrice: prices.salePrice, originalPrice: prices.originalPrice };
    }
  },
  hm: {
    name: 'H&M',
    hostMatch: 'hm.com',
    productSelector: 'article[data-testid="product-card"], li.product-item, [class*="product-item"]',
    paginationParam: 'page',
    perPage: 36,
    extract: null
  },
  next: {
    name: 'NEXT',
    hostMatch: 'next.co.il',
    productSelector: '[class*="product" i], [class*="item" i], [class*="card" i]',
    paginationParam: 'p',
    perPage: 20,
    extract: null
  },
  asos: {
    name: 'ASOS',
    hostMatch: 'asos.com',
    productSelector: 'article[data-auto-id="productTile"], [data-auto-id="productTile"]',
    paginationParam: 'page',
    perPage: 72,
    extract: null
  }
};

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

function genericExtract(el) {
  // Name
  var name = '';
  var nameEl = el.querySelector('h2, h3, h4, h5, [class*="title" i], [class*="name" i], [class*="description" i]');
  if (nameEl) name = nameEl.textContent.trim();
  if (!name || name.length < 3) {
    var img = el.querySelector('img');
    if (img) name = (img.getAttribute('alt') || '').trim();
  }
  if (!name || name.length < 3) {
    var link = el.querySelector('a[title]');
    if (link) name = (link.getAttribute('title') || '').trim();
  }
  if (!name || name.length < 3) {
    var aEl = el.querySelector('a');
    if (aEl) name = aEl.textContent.trim();
  }
  if (!name || name.length < 3 || name.length > 300) return null;

  // Image
  var imgs = el.querySelectorAll('img');
  var image = '';
  var bestScore = -999;
  imgs.forEach(function(img) {
    var src = img.getAttribute('src') || img.getAttribute('data-src') || '';
    if (!src || src.startsWith('data:')) return;
    var score = 0;
    var alt = img.getAttribute('alt') || '';
    if (alt.length > 5) score += 500;
    if (/icon|badge|logo|flag|star|rating|choice|sprite/i.test(src)) score -= 1000;
    if (score > bestScore) { bestScore = score; image = src; }
  });

  // URL
  var linkEl = el.tagName === 'A' ? el : el.querySelector('a[href]');
  var url = linkEl ? (linkEl.getAttribute('href') || '') : '';

  // Price
  var priceText = '';
  el.querySelectorAll('[class*="price" i], [class*="Price"]').forEach(function(p) {
    priceText += ' ' + p.textContent;
  });
  if (!priceText) {
    var allText = el.textContent || '';
    var cm = allText.match(/[₪$€£]\s*[\d,.]+|[\d,.]+\s*[₪$€£]/g);
    if (cm) priceText = cm.join(' ');
  }
  var prices = parsePrices(priceText);
  if (!prices.originalPrice && !image) return null;

  return { name: name, image: image, url: url, salePrice: prices.salePrice, originalPrice: prices.originalPrice || 0 };
}

function extractFromHtml(html, siteConfig, baseUrl) {
  // Use a lightweight DOM parser
  var { JSDOM } = require('jsdom');
  var dom = new JSDOM(html);
  var doc = dom.window.document;
  var products = [];
  var seen = {};

  // Try site-specific selector first
  var selector = siteConfig ? siteConfig.productSelector : '[class*="product" i], [class*="item" i]';
  var elements = doc.querySelectorAll(selector);

  if (elements.length < 2 && siteConfig) {
    elements = doc.querySelectorAll('[class*="product" i], [class*="item" i]');
  }

  elements.forEach(function(el) {
    if (el.children.length > 30) return;
    var extractFn = (siteConfig && siteConfig.extract) ? siteConfig.extract : genericExtract;
    var p = extractFn(el);
    if (p && p.name && !seen[p.name]) {
      seen[p.name] = true;
      // Resolve relative URLs
      if (p.url && !p.url.startsWith('http')) {
        try { p.url = new URL(p.url, baseUrl).toString(); } catch(e) {}
      }
      if (p.image && !p.image.startsWith('http')) {
        try { p.image = new URL(p.image, baseUrl).toString(); } catch(e) {}
      }
      products.push(p);
    }
  });

  // Also try JSON-LD
  doc.querySelectorAll('script[type="application/ld+json"]').forEach(function(script) {
    try {
      var data = JSON.parse(script.textContent);
      var items = [];
      if (Array.isArray(data)) items = data;
      else if (data['@type'] === 'ItemList' && data.itemListElement) items = data.itemListElement.map(function(e) { return e.item || e; });
      else if (data['@graph']) items = data['@graph'];
      items.forEach(function(item) {
        if (!item || item['@type'] !== 'Product' || !item.name) return;
        if (seen[item.name]) return;
        seen[item.name] = true;
        var origPrice = 0, salePrice = null;
        if (item.offers) {
          var offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
          origPrice = parseFloat(offer.price || offer.lowPrice) || 0;
        }
        products.push({
          name: item.name, image: (Array.isArray(item.image) ? item.image[0] : item.image) || '',
          url: item.url || '', salePrice: salePrice, originalPrice: origPrice
        });
      });
    } catch(e) {}
  });

  dom.window.close();
  return products;
}

function detectTotalFromHtml(html) {
  var match = html.match(/(\d+)\s*(?:products|items|results|מוצרים|פריטים)/i);
  return match ? parseInt(match[1]) : null;
}

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  var targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).json({ error: 'Missing url parameter' });

  try {
    new URL(targetUrl);
  } catch(e) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  var siteConfig = detectSite(targetUrl);

  try {
    // Fetch the first page
    var response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'he-IL,he;q=0.9,en;q=0.8'
      }
    });
    var html = await response.text();

    var allProducts = extractFromHtml(html, siteConfig, targetUrl);
    var totalHint = detectTotalFromHtml(html);
    var perPage = allProducts.length || (siteConfig ? siteConfig.perPage : 20);

    // Fetch remaining pages if there are more
    var shouldFetchMore = (totalHint && allProducts.length < totalHint) || (!totalHint && allProducts.length >= 3);
    if (shouldFetchMore && perPage > 0) {
      var totalPages = totalHint ? Math.min(Math.ceil(totalHint / perPage), 15) : 10;
      var pagParam = (siteConfig && siteConfig.paginationParam) || 'page';
      var fetches = [];

      for (var p = 2; p <= totalPages; p++) {
        var pageUrl = new URL(targetUrl);
        pageUrl.searchParams.set(pagParam, String(p));
        fetches.push(
          fetch(pageUrl.toString(), {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml',
              'Accept-Language': 'he-IL,he;q=0.9,en;q=0.8'
            }
          }).then(function(r) { return r.text(); }).then(function(pageHtml) {
            return extractFromHtml(pageHtml, siteConfig, targetUrl);
          }).catch(function() { return []; })
        );
      }

      var pageResults = await Promise.all(fetches);
      var seen = {};
      allProducts.forEach(function(p) { seen[p.name] = true; });
      pageResults.forEach(function(products) {
        products.forEach(function(p) {
          if (!seen[p.name]) { seen[p.name] = true; allProducts.push(p); }
        });
      });
    }

    // Assign IDs
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
