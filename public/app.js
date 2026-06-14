// Choosy Kids — app flow: welcome -> setup (3 clicks) -> loading -> game

var MIXPANEL_TOKEN = 'd0151b0b7af8502ac4bbed6a650ae33a';
var analyticsId = localStorage.getItem('choosy_id');
if (!analyticsId) {
  analyticsId = 'web-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  localStorage.setItem('choosy_id', analyticsId);
}
function track(event, props) {
  var payload = [{ event: event, properties: Object.assign({
    token: MIXPANEL_TOKEN, distinct_id: analyticsId,
    time: Math.floor(Date.now() / 1000), platform: 'web-kids'
  }, props || {}) }];
  fetch('https://api-eu.mixpanel.com/track', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(function () {});
}

// --- Categories per age band ---
var CATEGORIES = {
  '0-2': [
    { key: 'tops', label: 'חולצות', emoji: '👕' },
    { key: 'bodysuits', label: 'בגדי גוף', emoji: '🧸' },
    { key: 'sets', label: 'מארזים', emoji: '🎁' }
  ],
  '2-8': [
    { key: 'tops', label: 'טי-שירט', emoji: '👕' },
    { key: 'bottoms', label: 'מכנסיים', emoji: '👖' },
    { key: 'dresses', label: 'שמלות', emoji: '👗' }
  ]
};

var screens = {
  welcome: document.getElementById('welcome'),
  setup: document.getElementById('setup'),
  loading: document.getElementById('loading'),
  game: document.getElementById('game-container')
};
function show(name) {
  Object.keys(screens).forEach(function (k) { screens[k].classList.add('hidden'); });
  screens[name].classList.remove('hidden');
}

var selection = { gender: null, age: null, category: null, budget: null };
var game = null, comparisons = 0, pairShownAt = 0, gameStartedAt = 0, currentProducts = [];

// --- Welcome ---
document.getElementById('start-btn').addEventListener('click', function () {
  track('setup_started');
  show('setup');
  resetSetup();
});

// --- Back links ---
document.querySelectorAll('[data-back]').forEach(function (b) {
  b.addEventListener('click', function () { show(b.getAttribute('data-back')); });
});

function resetSetup() {
  document.getElementById('step-who').classList.remove('hidden');
  document.getElementById('step-what').classList.add('hidden');
  document.getElementById('step-budget').classList.add('hidden');
}

// --- Step 1: who ---
document.querySelectorAll('#step-who .choice').forEach(function (btn) {
  btn.addEventListener('click', function () {
    selection.gender = btn.getAttribute('data-gender');
    selection.age = btn.getAttribute('data-age');
    buildCategories();
    document.getElementById('step-who').classList.add('hidden');
    document.getElementById('step-what').classList.remove('hidden');
  });
});

// --- Step 2: what ---
function buildCategories() {
  var grid = document.getElementById('category-grid');
  grid.innerHTML = '';
  (CATEGORIES[selection.age] || CATEGORIES['0-2']).forEach(function (c) {
    var b = document.createElement('button');
    b.className = 'choice';
    b.innerHTML = '<span class="choice-emoji">' + c.emoji + '</span>' + c.label;
    b.addEventListener('click', function () {
      selection.category = c.key;
      document.getElementById('step-what').classList.add('hidden');
      document.getElementById('step-budget').classList.remove('hidden');
    });
    grid.appendChild(b);
  });
}

// --- Step 3: budget ---
var slider = document.getElementById('budget-slider');
slider.addEventListener('input', function () {
  document.getElementById('budget-val').textContent = slider.value;
});
document.getElementById('play-btn').addEventListener('click', function () {
  selection.budget = parseInt(slider.value);
  startFlow();
});
document.getElementById('skip-budget').addEventListener('click', function () {
  selection.budget = null;
  startFlow();
});

// --- Load pool + start game ---
function startFlow() {
  show('loading');
  track('pool_requested', selection);
  var q = '/api/get-pool?gender=' + selection.gender + '&age=' + selection.age + '&category=' + selection.category;
  fetch(q)
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var products = data.products || [];
      if (selection.budget) {
        products = products.filter(function (p) {
          var price = p.salePrice != null ? p.salePrice : p.originalPrice;
          return price <= selection.budget;
        });
      }
      if (products.length < 2) {
        document.getElementById('loading-text').textContent = 'אין מספיק פריטים בקטגוריה הזו עדיין. נסו בחירה אחרת.';
        setTimeout(function () { show('setup'); resetSetup(); }, 2500);
        return;
      }
      currentProducts = products;
      track('pool_loaded', { count: products.length });
      startGame(products);
    })
    .catch(function () {
      document.getElementById('loading-text').textContent = 'משהו השתבש. ננסה שוב?';
      setTimeout(function () { show('setup'); resetSetup(); }, 2500);
    });
}

function startGame(products) {
  show('game');
  comparisons = 0;
  gameStartedAt = Date.now();
  pairShownAt = Date.now();
  game = new ChoosingGame({ products: products, querySelector: document.querySelector.bind(document) });
  game.init();
  track('game_started', { product_count: products.length });
}

document.getElementById('card-left').addEventListener('click', function () { handleChoose('left'); });
document.getElementById('card-right').addEventListener('click', function () { handleChoose('right'); });

function handleChoose(side) {
  if (!game) return;
  comparisons++;
  track('comparison_made', { decision_time_ms: Date.now() - pairShownAt, comparison_number: comparisons });
  var loserSide = game.choose(side);
  if (loserSide) {
    pairShownAt = Date.now();
    var badge = document.getElementById('streak-' + side);
    if (badge && game.streak >= 3) badge.classList.add('hot');
    var el = document.getElementById('card-' + loserSide);
    el.classList.remove('enter-left', 'enter-right');
    void el.offsetWidth;
    el.classList.add('enter-' + loserSide);
  } else {
    // winner crowned — set brand on buy button
    var w = game.currentWinner;
    var brandEl = document.getElementById('buy-brand');
    if (brandEl && w) brandEl.textContent = w.brand || 'חנות';
    track('game_completed', {
      winner_name: w.name, brand: w.brand,
      total_comparisons: comparisons,
      time_spent_sec: Math.round((Date.now() - gameStartedAt) / 1000)
    });
  }
}

document.getElementById('keep-btn').addEventListener('click', function () {
  if (game) { game.keepChoosing(); pairShownAt = Date.now(); }
});
document.getElementById('restart-btn').addEventListener('click', function () {
  if (game) {
    game.startOver(); comparisons = 0; pairShownAt = Date.now(); gameStartedAt = Date.now();
    track('game_started', { product_count: currentProducts.length, is_restart: true });
  }
});
document.getElementById('buy-btn').addEventListener('click', function () {
  if (game && game.currentWinner) {
    track('product_clicked', { product_name: game.currentWinner.name, brand: game.currentWinner.brand, product_url: game.currentWinner.url });
  }
});
document.getElementById('exit-btn').addEventListener('click', function () { show('welcome'); });
