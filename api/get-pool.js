// Choosy — Serve a product pool for the tournament.
// GET /api/get-pool?gender=boy&age=0-2&category=tops&limit=80
// Reads static catalog JSON (no external calls), filters by segment,
// merges across sites, shuffles, returns game-ready products with color.

var catalogs = require('../catalogs');

// Map a raw Hebrew color label to a clean filter family (keyword-based).
// Map a raw color label (Hebrew or English, possibly a code or a print
// description) to a clean filter family. Multi-store data is messy — a concrete
// base color (checked first) wins over a print description.
function colorFamily(label) {
  if (!label) return null;
  var l = String(label).toLowerCase();
  if (/שחור|black|noir|onyx/.test(l)) return 'שחור';
  if (/אפור|gr[ae]y|מלאנ|מלנ|מאלנ|מרנגו|marengo|בטון|פחם|silver|כסף|smoke|אפר\b|graphite|ash/.test(l)) return 'אפור';
  if (/לבן|white|חלב|שמנת|אוף.?ווייט|off.?white|קרם|cream|ecru|שנהב|ivory|ניטרלי|natural|נוד|nude/.test(l)) return 'לבן';
  if (/כחול|blue|נייב|navy|תכלת|תכול|טורקיז|turquoise|אקווה|aqua|רויאל|royal|ג'ינס|denim|indigo|cobalt|פטרול|petrol|שמיים|sky|midnight|teal/.test(l)) return 'כחול';
  if (/ירוק|green|חאקי|khaki|מנטה|mint|זית|olive|ליים|lime|ירקרק|spruce|\bfir\b|sage|emerald|forest|פיסטוק/.test(l)) return 'ירוק';
  if (/ורוד|pink|פוקסיה|fuchsia|רוז\b|rose|סלמון|salmon|מג'נטה|magenta|blush/.test(l)) return 'ורוד';
  if (/אדום|red|בורדו|bordeaux|bordo|חמרה|maroon|wine|יין|cherry|דובדבן|crimson|scarlet/.test(l)) return 'אדום';
  if (/צהוב|yellow|זהב|gold|חרדל|mustard|בננה|banana|לימון|lemon/.test(l)) return 'צהוב';
  if (/כתום|orange|קרמל|caramel|טרקוטה|terracotta|אפרסק|peach|נחושת|copper/.test(l)) return 'כתום';
  if (/סגול|purple|לילך|lilac|violet|plum|שזיף|לבנדר|lavender/.test(l)) return 'סגול';
  if (/חום|brown|בז'|beige|לאטה|latte|מוקה|mocha|קפה|coffee|אגוז|אבן|חול|sand|טאופ|taupe|camel|קאמל|שוקולד|chocolate|\btan\b/.test(l)) return 'חום';
  if (/מולטי|multi|צבעוני|פרחוני|floral|הדפס|print|פסים|stripe|משבצ|check|דמויות|מצויר|דוגמ|pattern|פאטרן|דינוזאור|חיות|ספארי|פירות|graphic|כיתוב|דפוס|פסטל|pastel|רקמ|embroid|מיקי|מינ?י|מארוול|marvel|disney|דיסני/.test(l)) return 'מצויר';
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
