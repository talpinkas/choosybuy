// Choosy API — Scrapes product listing pages and returns product data as JSON.

var SITE_CONFIGS = {
  terminalx: { name: 'Terminal X', hostMatch: 'terminalx.com', paginationParam: 'p', perPage: 20 },
  hm: { name: 'H&M', hostMatch: 'hm.com', paginationParam: 'page', perPage: 36 },
  next: { name: 'NEXT', hostMatch: 'next.co.il', paginationParam: 'p', perPage: 20 },
  asos: { name: 'ASOS', hostMatch: 'asos.com', paginationParam: 'page', perPage: 72 }
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

function detectTotalFromHtml(html) {
  var match = html.match(/(\d+)\s*(?:products|items|results|מוצרים|פריטים)/i);
  return match ? parseInt(match[1]) : null;
}

// Fast regex-based extraction — no jsdom needed
function extractProductsRegex(html, baseUrl) {
  var products = [];
  var seen = {};

  // Strategy 1: Find product links with images and alt text (Terminal X pattern)
  var linkPattern = /<a[^>]+href="([^"]*\/(?:product|item|p\/)[^"]*)"[^>]*>[\s\S]*?<img[^>]+alt="([^"]+)"[^>]+src="([^"]+)"[\s\S]*?<\/a>/gi;
  var match;
  while ((match = linkPattern.exec(html)) !== null) {
    var url = match[1], name = match[2].trim(), image = match[3];
    if (name && name.length > 3 && !seen[name]) {
      seen[name] = true;
      products.push({ name: name, image: image, url: url, salePrice: null, originalPrice: 0 });
    }
  }

  // Strategy 2: Find img tags with alt text inside product-like containers
  if (products.length < 3) {
    var imgPattern = /<img[^>]+alt="([^"]{5,80})"[^>]+src="(https?:\/\/[^"]+(?:jpg|jpeg|png|webp)[^"]*)"[^>]*>/gi;
    while ((match = imgPattern.exec(html)) !== null) {
      var name = match[1].trim(), image = match[2];
      if (name && !seen[name] && !/logo|icon|banner|sprite/i.test(image)) {
        seen[name] = true;
        products.push({ name: name, image: image, url: '', salePrice: null, originalPrice: 0 });
      }
    }
  }

  // Strategy 3: JSON-LD
  var jsonLdPattern = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  while ((match = jsonLdPattern.exec(html)) !== null) {
    try {
      var data = JSON.parse(match[1]);
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
  }

  // Extract prices from nearby price elements
  products.forEach(function(p) {
    if (p.originalPrice > 0) return;
    var nameEsc = p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var priceNearby = new RegExp(nameEsc + '[\\s\\S]{0,500}?([\\d,.]+)\\s*₪', 'i');
    var pm = html.match(priceNearby);
    if (pm) p.originalPrice = parseFloat(pm[1].replace(/,/g, '')) || 0;
  });

  // Resolve relative URLs
  products.forEach(function(p) {
    if (p.url && !p.url.startsWith('http')) {
      try { p.url = new URL(p.url, baseUrl).toString(); } catch(e) {}
    }
    if (p.image && !p.image.startsWith('http')) {
      try { p.image = new URL(p.image, baseUrl).toString(); } catch(e) {}
    }
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

  try { new URL(targetUrl); } catch(e) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  var siteConfig = detectSite(targetUrl);
  var startTime = Date.now();

  try {
    var response = await fetch(targetUrl, { headers: HEADERS });
    var html = await response.text();

    var allProducts = extractProductsRegex(html, targetUrl);
    var totalHint = detectTotalFromHtml(html);
    var perPage = allProducts.length || (siteConfig ? siteConfig.perPage : 20);

    // Fetch remaining pages — time-bounded to stay within Vercel's limit
    var shouldFetchMore = (totalHint && allProducts.length < totalHint) || (!totalHint && allProducts.length >= 3);
    if (shouldFetchMore && perPage > 0) {
      var totalPages = totalHint ? Math.min(Math.ceil(totalHint / perPage), 15) : 10;
      var pagParam = (siteConfig && siteConfig.paginationParam) || 'page';

      // Fetch in batches of 5 to avoid overwhelming the target site
      for (var batch = 0; batch < 3; batch++) {
        if (Date.now() - startTime > 7000) break; // stop at 7s to leave time for response

        var batchStart = batch * 5 + 2;
        var batchEnd = Math.min(batchStart + 5, totalPages + 1);
        if (batchStart > totalPages) break;

        var fetches = [];
        for (var p = batchStart; p < batchEnd; p++) {
          var pageUrl = new URL(targetUrl);
          pageUrl.searchParams.set(pagParam, String(p));
          fetches.push(
            fetch(pageUrl.toString(), { headers: HEADERS })
              .then(function(r) { return r.text(); })
              .then(function(pageHtml) { return extractProductsRegex(pageHtml, targetUrl); })
              .catch(function() { return []; })
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
