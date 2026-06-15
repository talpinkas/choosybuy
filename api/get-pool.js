// Choosy — Serve a product pool for the tournament.
// GET /api/get-pool?gender=boy&age=0-2&category=tops&limit=80
// Reads static catalog JSON (no external calls), filters by segment,
// merges across sites, shuffles, returns game-ready products with color.

var catalogs = require('../catalogs');

// Map a raw Hebrew color label to a clean filter family (keyword-based).
function colorFamily(label) {
  if (!label) return null;
  var l = String(label).trim();
  if (/שחור/.test(l)) return 'שחור';
  if (/לבן|חלב|שמנת|אוף ווייט|קרם/.test(l)) return 'לבן';
  if (/אפור/.test(l)) return 'אפור';
  if (/כחול|נייבי|תכלת|טורקיז|אקווה|רויאל|ג'ינס/.test(l)) return 'כחול';
  if (/ירוק|חאקי|מנטה|זית/.test(l)) return 'ירוק';
  if (/ורוד/.test(l)) return 'ורוד';
  if (/אדום|חמרה|בורדו/.test(l)) return 'אדום';
  if (/צהוב|חרדל|בננה/.test(l)) return 'צהוב';
  if (/כתום|קרמל/.test(l)) return 'כתום';
  if (/סגול|לילך/.test(l)) return 'סגול';
  if (/חום|בז'|אבן|חול|אגוז/.test(l)) return 'חום';
  if (/מולטי/.test(l)) return 'מצויר';
  return 'אחר';
}

function shuffle(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  var gender = req.query.gender || null;
  var age = req.query.age || null;
  var category = req.query.category || null;
  var limit = parseInt(req.query.limit) || 80;

  var matching = catalogs.filter(function (c) {
    var s = c.segment || {};
    if (gender && s.gender !== gender) return false;
    if (age && s.age !== age) return false;
    if (category && s.category !== category) return false;
    return true;
  });

  var products = [];
  matching.forEach(function (c) {
    (c.products || []).forEach(function (p) {
      if (!p.title || !p.price) return;
      products.push({
        id: p.id,
        name: p.title,
        image: p.image,
        originalPrice: p.price,
        salePrice: (p.sale_price != null && p.sale_price < p.price) ? p.sale_price : null,
        url: p.url,
        brand: p.brand || c.site,
        color: p.color || '',
        colorHex: p.color_hex || null,
        colorFamily: colorFamily(p.color),
        affiliateReady: !!p.affiliate_ready
      });
    });
  });

  shuffle(products);
  if (products.length > limit) products = products.slice(0, limit);
  products.forEach(function (p, i) { p.id = i + 1; });

  res.status(200).json({
    products: products,
    total: products.length,
    segment: { gender: gender, age: age, category: category }
  });
};
