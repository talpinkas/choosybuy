// Choosy — Serve a product pool for the tournament.
// GET /api/get-pool?gender=boy&age=0-2&category=tops&limit=60
// Reads static catalog JSON (no external calls), filters by segment,
// merges across sites, shuffles, returns game-ready products.

var catalogs = require('../catalogs');

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
  var limit = parseInt(req.query.limit) || 60;

  // Match catalogs by the provided segment dimensions (any omitted dim = wildcard)
  var matching = catalogs.filter(function (c) {
    var s = c.segment || {};
    if (gender && s.gender !== gender) return false;
    if (age && s.age !== age) return false;
    if (category && s.category !== category) return false;
    return true;
  });

  // Merge products into game-ready shape
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
        affiliateReady: !!p.affiliate_ready
      });
    });
  });

  shuffle(products);
  if (products.length > limit) products = products.slice(0, limit);
  // Re-id for the game engine
  products.forEach(function (p, i) { p.id = i + 1; });

  res.status(200).json({
    products: products,
    total: products.length,
    segment: { gender: gender, age: age, category: category }
  });
};
