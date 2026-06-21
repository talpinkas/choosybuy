// Choosy — Serve a product pool for the tournament.
// GET /api/get-pool?gender=boy&age=0-2&category=tops&limit=80
// Reads static catalog JSON (no external calls), filters by segment,
// merges across sites, shuffles, returns game-ready products with color.

var catalogs = require('../catalogs');

// Map a raw color label (Hebrew or English, possibly a code or a print
// description) to a clean filter family. Multi-store data is messy: labels are
// often "<base> <accent/print>" or "<base>/<secondary>" (e.g. "בז'/חום בעיטור
// דובדבן", "ורוד/כחול"). The DOMINANT colour leads the label, so we pick the
// base-colour family whose keyword appears LEFT-MOST — a print/accent word can
// no longer override the base colour (the old fixed-priority order let "דובדבן"
// turn a beige item red). A print family is only a fallback when no real colour
// is present; denim is a fallback too, so "ג'ינס שחור" stays black not blue.
var COLOR_FAMILIES = [
  ['שחור', /שחור|black|noir|onyx/],
  ['אפור', /אפור|gr[ae]y|מלאנ|מלנ|מאלנ|מרנגו|marengo|בטון|פחם|silver|כסף|smoke|אפר\b|graphite|ash/],
  ['לבן', /לבן|white|חלב|שמנת|אוף.?ווייט|off.?white|קרם|cream|ecru|שנהב|ivory|ניטרלי|natural|נוד|nude/],
  ['כחול', /כחול|blue|נייב|navy|תכלת|תכול|טורקיז|turquoise|אקווה|aqua|רויאל|royal|indigo|cobalt|פטרול|petrol|שמיים|sky|midnight|teal/],
  ['ירוק', /ירוק|green|חאקי|khaki|מנטה|mint|זית|olive|ליים|lime|ירקרק|spruce|\bfir\b|sage|emerald|forest|פיסטוק/],
  ['ורוד', /ורוד|pink|פוקסיה|fuchsia|רוז\b|rose|סלמון|salmon|מג'נטה|magenta|blush/],
  ['אדום', /אדום|red|בורדו|bordeaux|bordo|חמרה|maroon|wine|יין|cherry|דובדבן|crimson|scarlet/],
  ['צהוב', /צהוב|yellow|זהב|gold|חרדל|mustard|בננה|banana|לימון|lemon/],
  ['כתום', /כתום|orange|קרמל|caramel|טרקוטה|terracotta|אפרסק|peach|נחושת|copper/],
  ['סגול', /סגול|purple|לילך|lilac|violet|plum|שזיף|לבנדר|lavender/],
  ['חום', /חום|brown|בז'|beige|לאטה|latte|מוקה|mocha|קפה|coffee|אגוז|אבן|חול|sand|טאופ|taupe|camel|קאמל|שוקולד|chocolate|\btan\b/]
];
var COLOR_DENIM = /ג'ינס|denim/;
var COLOR_PRINT = /מולטי|multi|צבעוני|פרחוני|floral|הדפס|print|פסים|stripe|משבצ|check|דמויות|מצויר|דוגמ|pattern|פאטרן|דינוזאור|חיות|ספארי|פירות|graphic|כיתוב|דפוס|פסטל|pastel|רקמ|embroid|מיקי|מינ?י|מארוול|marvel|disney|דיסני/;
function colorFamily(label) {
  if (!label) return null;
  var l = String(label).toLowerCase();
  var best = null, bestIdx = Infinity;
  for (var i = 0; i < COLOR_FAMILIES.length; i++) {
    var m = l.match(COLOR_FAMILIES[i][1]);
    if (m && m.index < bestIdx) { bestIdx = m.index; best = COLOR_FAMILIES[i][0]; }
  }
  if (best) return best;
  if (COLOR_DENIM.test(l)) return 'כחול';
  if (COLOR_PRINT.test(l)) return 'מצויר';
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
