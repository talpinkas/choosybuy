// Choosy API — Scrapes products via site APIs or HTML parsing.

var cheerio = require('cheerio');

var HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/json',
  'Accept-Language': 'he-IL,he;q=0.9,en;q=0.8'
};

// --- Terminal X: Direct API ---
async function scrapeTerminalX(targetUrl, debug) {
  var urlObj = new URL(targetUrl);
  var diag = {};

  // Step 1: Fetch the page HTML to capture session cookies + fe-version token
  // (the listingSearch API returns empty results without a valid session)
  var cookies = '';
  var feVersion = '';
  var html = '';
  try {
    var htmlRes = await fetch(targetUrl, { headers: HEADERS });
    html = await htmlRes.text();
    // Capture Set-Cookie headers
    var setCookie = (htmlRes.headers.getSetCookie ? htmlRes.headers.getSetCookie() : []) || [];
    if (setCookie.length === 0) {
      var sc = htmlRes.headers.get('set-cookie');
      if (sc) setCookie = [sc];
    }
    cookies = setCookie.map(function(c) { return c.split(';')[0]; }).join('; ');
    // Extract fe-version from cookie or HTML
    var feMatch = cookies.match(/fe-version=([a-f0-9]+)/i)
      || html.match(/fe-version["'=:\s]+([a-f0-9]{20,})/i)
      || html.match(/"version"\s*:\s*"([a-f0-9]{20,})"/i);
    if (feMatch) feVersion = feMatch[1];
  } catch(e) { diag.htmlError = e.message; }

  diag.cookiesFound = cookies ? cookies.length : 0;
  diag.feVersion = feVersion || null;

  // Step 2: Resolve categoryId — GraphQL urlResolver FIRST (authoritative
  // for the URL path), since HTML contains many nav category IDs.
  var categoryId = null;
  var urlPath = urlObj.pathname.replace(/^\//, '').replace(/\/$/, '');
  try {
    var gqlRes = await fetch('https://www.terminalx.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': HEADERS['User-Agent'] },
      body: JSON.stringify({ query: '{ urlResolver(url: "' + urlPath + '") { id type } }' })
    });
    var gqlData = await gqlRes.json();
    diag.urlResolver = gqlData && gqlData.data ? gqlData.data.urlResolver : null;
    if (gqlData.data && gqlData.data.urlResolver && gqlData.data.urlResolver.id) {
      categoryId = String(gqlData.data.urlResolver.id);
    }
  } catch(e) { diag.gqlError = e.message; }

  // Fallback: HTML regex (last resort)
  if (!categoryId) {
    var catMatch = html.match(/"categoryId"\s*:\s*"?(\d{4,7})"?/)
      || html.match(/"category_id"\s*:\s*"?(\d{4,7})"?/);
    if (catMatch) categoryId = catMatch[1];
  }

  diag.categoryId = categoryId;

  if (!categoryId) {
    return { products: [], site: 'Terminal X', total: 0, error: 'Could not resolve category', diag: diag };
  }

  // Step 3: Build filter from URL query params
  var filter = { category_id: { eq: categoryId } };
  urlObj.searchParams.forEach(function(value, key) {
    if (key === 'p' || key === 'product_list_order') return;
    var values = value.split('_');
    if (values.length > 1) {
      filter[key] = { in: values };
    } else {
      filter[key] = { eq: value };
    }
  });

  // Step 4: Call the API with the session headers (cookies + fe-version)
  var apiHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': HEADERS['User-Agent'],
    'Referer': targetUrl,
    'Origin': 'https://www.terminalx.com'
  };
  if (cookies) apiHeaders['Cookie'] = cookies;
  if (feVersion) apiHeaders['X-Fe-Version'] = feVersion;

  var apiRes = await fetch('https://www.terminalx.com/a/listingSearch', {
    method: 'POST',
    headers: apiHeaders,
    body: JSON.stringify({
      listingSearchQuery: {
        categoryId: categoryId,
        filter: filter,
        pageSize: 500,
        currentPage: 1,
        sort: { default: true },
        includeAggregations: false
      },
      listingSearchOptions: { myBagSkus: [] }
    })
  });

  var apiText = await apiRes.text();
  if (debug) {
    return { debug: true, diag: diag, apiStatus: apiRes.status, apiRaw: apiText.substring(0, 1500) };
  }
  var apiData;
  try { apiData = JSON.parse(apiText); } catch(e) { apiData = {}; }

  // Extract products from response
  var items = findItemsArray(apiData);
  var products = [];

  items.forEach(function(item, i) {
    var name = item.name || '';
    if (!name) return;

    var image = '';
    if (item.small_image && item.small_image.url) image = item.small_image.url;
    else if (item.thumbnail && item.thumbnail.url) image = item.thumbnail.url;
    else if (item.image && item.image.url) image = item.image.url;

    var url = '';
    if (item.url_key) url = 'https://www.terminalx.com/' + item.url_key;
    else if (item.url) url = item.url;

    var originalPrice = 0, salePrice = null;
    if (item.price_range && item.price_range.minimum_price) {
      var minPrice = item.price_range.minimum_price;
      originalPrice = (minPrice.regular_price && minPrice.regular_price.value) || 0;
      var finalPrice = (minPrice.final_price && minPrice.final_price.value) || originalPrice;
      if (finalPrice < originalPrice) salePrice = finalPrice;
      else originalPrice = finalPrice;
    } else if (item.price) {
      originalPrice = typeof item.price === 'number' ? item.price : parseFloat(item.price) || 0;
    }

    products.push({
      id: i + 1, name: name, image: image, url: url,
      salePrice: salePrice, originalPrice: originalPrice
    });
  });

  var totalCount = 0;
  try { totalCount = apiData.data.listingSearch.total_count || products.length; } catch(e) { totalCount = products.length; }

  return { products: products, site: 'Terminal X', total: products.length, totalHint: totalCount };
}

// Returns the LARGEST array of named objects in the response (the products
// array — bigger than any categories/breadcrumb array).
function findItemsArray(obj) {
  var best = [];
  function walk(o) {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) {
      if (o.length > best.length && o[0] && typeof o[0] === 'object' && o[0].name) best = o;
      o.forEach(walk);
      return;
    }
    Object.keys(o).forEach(function(k) { walk(o[k]); });
  }
  walk(obj);
  return best;
}

// --- Generic HTML Scraping (for H&M, NEXT, ASOS, etc.) ---
var SITE_CONFIGS = {
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

function extractProduct($el, $) {
  var name = '';
  var nameEl = $el.find('h2, h3, h4, [class*="title" i], [class*="name" i]').first();
  if (nameEl.length) name = nameEl.text().trim();
  if (!name || name.length < 3) {
    var img = $el.find('img').first();
    if (img.length) name = (img.attr('alt') || '').trim();
  }
  if (!name || name.length < 3 || name.length > 300) return null;

  var image = '', bestScore = -999;
  $el.find('img').each(function() {
    var src = $(this).attr('src') || $(this).attr('data-src') || '';
    if (!src || src.startsWith('data:')) return;
    var score = 0;
    if (($(this).attr('alt') || '').length > 5) score += 500;
    if (/icon|badge|logo|flag|star|rating|choice|sprite/i.test(src)) score -= 1000;
    if (score > bestScore) { bestScore = score; image = src; }
  });

  var linkEl = $el.is('a') ? $el : $el.find('a[href]').first();
  var url = linkEl.length ? (linkEl.attr('href') || '') : '';

  var priceText = '';
  $el.find('[class*="price" i]').each(function() { priceText += ' ' + $(this).text(); });
  if (!priceText) {
    var cm = $el.text().match(/[₪$€£]\s*[\d,.]+|[\d,.]+\s*[₪$€£]/g);
    if (cm) priceText = cm.join(' ');
  }
  var prices = parsePrices(priceText);
  if (!prices.originalPrice && !image) return null;
  if ($el.text().length > 1000) return null;

  return { name: name, image: image, url: url, salePrice: prices.salePrice, originalPrice: prices.originalPrice || 0 };
}

function extractFromHtml(html, siteConfig, baseUrl) {
  var $ = cheerio.load(html);
  var products = [], seen = {};

  var selectors = siteConfig ? [siteConfig.selector] : [];
  selectors = selectors.concat(GENERIC_SELECTORS);

  for (var s = 0; s < selectors.length; s++) {
    $(selectors[s]).each(function() {
      var $el = $(this);
      if ($el.children().length > 30) return;
      var p = extractProduct($el, $);
      if (p && p.name && !seen[p.name]) {
        seen[p.name] = true;
        if (p.url && !p.url.startsWith('http')) try { p.url = new URL(p.url, baseUrl).toString(); } catch(e) {}
        if (p.image && !p.image.startsWith('http')) try { p.image = new URL(p.image, baseUrl).toString(); } catch(e) {}
        products.push(p);
      }
    });
    if (products.length >= 3) break;
  }

  return products;
}

function detectSiteConfig(url) {
  var keys = Object.keys(SITE_CONFIGS);
  for (var i = 0; i < keys.length; i++) {
    if (url.indexOf(SITE_CONFIGS[keys[i]].hostMatch) !== -1) return SITE_CONFIGS[keys[i]];
  }
  return null;
}

async function scrapeHtml(targetUrl, pageNum) {
  var siteConfig = detectSiteConfig(targetUrl);
  var fetchUrl = new URL(targetUrl);
  if (pageNum) {
    var pagParam = (siteConfig && siteConfig.paginationParam) || 'page';
    fetchUrl.searchParams.set(pagParam, String(pageNum));
  }

  var response = await fetch(fetchUrl.toString(), { headers: HEADERS });
  var html = await response.text();
  var products = extractFromHtml(html, siteConfig, targetUrl);
  products.forEach(function(p, i) { p.id = i + 1; });

  var result = { products: products, site: siteConfig ? siteConfig.name : 'Unknown', total: products.length };
  if (!pageNum) {
    var totalMatch = html.match(/(\d+)\s*(?:products|items|results|מוצרים|פריטים)/i);
    result.totalHint = totalMatch ? parseInt(totalMatch[1]) : null;
    result.perPage = products.length;
  }
  return result;
}

// --- Main Handler ---
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  var targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).json({ error: 'Missing url parameter' });
  try { new URL(targetUrl); } catch(e) { return res.status(400).json({ error: 'Invalid URL' }); }

  try {
    var result;

    if (targetUrl.indexOf('terminalx.com') !== -1) {
      // Terminal X: use direct API (gets 100% of products)
      result = await scrapeTerminalX(targetUrl, req.query.debug === '1');
    } else {
      // Other sites: HTML scraping
      var pageNum = req.query.p ? parseInt(req.query.p) : null;
      result = await scrapeHtml(targetUrl, pageNum);
    }

    res.status(200).json(result);

  } catch(err) {
    res.status(500).json({ error: 'Failed to fetch products', details: err.message });
  }
};
