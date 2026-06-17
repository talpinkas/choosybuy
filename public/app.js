// Choosy Kids — welcome -> who -> what -> refine (color+budget) -> game

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

// Category labels/emojis, and which categories exist per gender × age.
// Keys + segments mirror the built Terminal X catalogs (catalogs/terminalx-*).
var CAT_META = {
  tops:      { label: 'חולצות',  emoji: '👕' },
  bottoms:   { label: 'מכנסיים', emoji: '👖' },
  bodysuits: { label: 'בגדי גוף', emoji: '🧸' },
  dresses:   { label: 'שמלות',   emoji: '👗' },
  swim:      { label: 'בגדי ים', emoji: '🩱' }
};
var SEGMENT_CATS = {
  'boy|0-2':  ['tops', 'bodysuits', 'swim'],
  'girl|0-2': ['tops', 'bodysuits', 'dresses', 'swim'],
  'boy|2-8':  ['tops', 'bottoms', 'swim'],
  'girl|2-8': ['tops', 'bottoms', 'dresses', 'swim']
};
function categoriesFor(gender, age) {
  var keys = SEGMENT_CATS[gender + '|' + age] || SEGMENT_CATS['boy|0-2'];
  return keys.map(function (k) {
    var emoji = CAT_META[k].emoji;
    if (k === 'swim' && gender === 'boy') emoji = '🩳'; // boys' swim trunks (🩱 one-piece reads feminine)
    return { key: k, label: CAT_META[k].label, emoji: emoji };
  });
}

// Representative swatch color per family (for the chip dot)
var FAMILY_HEX = {
  'שחור': '#2a2a2a', 'לבן': '#f1ece3', 'אפור': '#9a9a9a', 'כחול': '#2a4d8f',
  'ירוק': '#4a7c47', 'ורוד': '#e89ab0', 'אדום': '#c0392b', 'צהוב': '#e8c84a',
  'כתום': '#e08a3c', 'סגול': '#7d5ba6', 'חום': '#8a6240', 'מצויר': null, 'אחר': '#cfc7bb'
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

var selection = { gender: null, age: null, category: null, budget: null, colors: [] };
var poolProducts = [];
var game = null, comparisons = 0, pairShownAt = 0, gameStartedAt = 0, currentProducts = [];

document.getElementById('start-btn').addEventListener('click', function () {
  track('setup_started');
  show('setup');
  resetSetup();
});

document.querySelectorAll('[data-back]').forEach(function (b) {
  b.addEventListener('click', function () { show(b.getAttribute('data-back')); });
});

function resetSetup() {
  selection.colors = [];
  document.getElementById('step-who').classList.remove('hidden');
  document.getElementById('step-what').classList.add('hidden');
  document.getElementById('step-refine').classList.add('hidden');
}

// Step 1: who
document.querySelectorAll('#step-who .choice').forEach(function (btn) {
  btn.addEventListener('click', function () {
    selection.gender = btn.getAttribute('data-gender');
    selection.age = btn.getAttribute('data-age');
    buildCategories();
    document.getElementById('step-who').classList.add('hidden');
    document.getElementById('step-what').classList.remove('hidden');
  });
});

// Step 2: what
function buildCategories() {
  var grid = document.getElementById('category-grid');
  grid.innerHTML = '';
  categoriesFor(selection.gender, selection.age).forEach(function (c) {
    var b = document.createElement('button');
    b.className = 'choice';
    b.innerHTML = '<span class="choice-emoji">' + c.emoji + '</span>' + c.label;
    b.addEventListener('click', function () {
      selection.category = c.key;
      loadPoolThenRefine();
    });
    grid.appendChild(b);
  });
}

// After category: fetch the pool, then show color+budget refine
function loadPoolThenRefine() {
  show('loading');
  track('pool_requested', { gender: selection.gender, age: selection.age, category: selection.category });
  var q = '/api/get-pool?gender=' + selection.gender + '&age=' + selection.age + '&category=' + selection.category;
  fetch(q).then(function (r) { return r.json(); }).then(function (data) {
    poolProducts = data.products || [];
    if (poolProducts.length < 2) {
      document.getElementById('loading-text').textContent = 'אין מספיק פריטים בקטגוריה הזו עדיין. נסו בחירה אחרת.';
      setTimeout(function () { show('setup'); resetSetup(); }, 2500);
      return;
    }
    track('pool_loaded', { count: poolProducts.length });
    buildColorChips();
    show('setup');
    document.getElementById('step-who').classList.add('hidden');
    document.getElementById('step-what').classList.add('hidden');
    document.getElementById('step-refine').classList.remove('hidden');
  }).catch(function () {
    document.getElementById('loading-text').textContent = 'משהו השתבש. ננסה שוב?';
    setTimeout(function () { show('setup'); resetSetup(); }, 2500);
  });
}

// Step 3: refine — color chips built from what's actually in the pool
function buildColorChips() {
  var counts = {};
  poolProducts.forEach(function (p) {
    var f = p.colorFamily || 'אחר';
    counts[f] = (counts[f] || 0) + 1;
  });
  // Sort families by frequency, drop tiny "אחר" if others exist
  var families = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
  var wrap = document.getElementById('color-chips');
  wrap.innerHTML = '';
  selection.colors = [];
  families.forEach(function (fam) {
    var chip = document.createElement('button');
    chip.className = 'color-chip';
    chip.setAttribute('data-fam', fam);
    var hex = FAMILY_HEX[fam];
    var dot = fam === 'מצויר'
      ? '<span class="chip-dot chip-multi"></span>'
      : '<span class="chip-dot" style="background:' + (hex || '#ccc') + '"></span>';
    chip.innerHTML = dot + fam;
    chip.addEventListener('click', function () {
      chip.classList.toggle('selected');
      var i = selection.colors.indexOf(fam);
      if (i === -1) selection.colors.push(fam); else selection.colors.splice(i, 1);
    });
    wrap.appendChild(chip);
  });
}

var slider = document.getElementById('budget-slider');
slider.addEventListener('input', function () {
  document.getElementById('budget-val').textContent = slider.value;
});
document.getElementById('play-btn').addEventListener('click', function () {
  selection.budget = parseInt(slider.value);
  applyFiltersAndPlay();
});
document.getElementById('skip-refine').addEventListener('click', function () {
  selection.budget = null;
  selection.colors = [];
  applyFiltersAndPlay();
});

function applyFiltersAndPlay() {
  var filtered = poolProducts.filter(function (p) {
    if (selection.colors.length && selection.colors.indexOf(p.colorFamily) === -1) return false;
    if (selection.budget) {
      var price = p.salePrice != null ? p.salePrice : p.originalPrice;
      if (price > selection.budget) return false;
    }
    return true;
  });
  if (filtered.length < 2) {
    // too strict — fall back to the full pool
    filtered = poolProducts.slice();
  }
  track('filters_applied', { colors: selection.colors.join(',') || 'all', budget: selection.budget || 0, result_count: filtered.length });
  currentProducts = filtered;
  startGame(filtered);
}

function startGame(products) {
  show('game');
  comparisons = 0;
  gameStartedAt = Date.now();
  pairShownAt = Date.now();
  game = new ChoosingGame({ products: products, querySelector: document.querySelector.bind(document) });
  game.init();
  updateUndo();
  track('game_started', { product_count: products.length });
}

document.getElementById('card-left').addEventListener('click', function () { handleChoose('left'); });
document.getElementById('card-right').addEventListener('click', function () { handleChoose('right'); });

function updateUndo() {
  var u = document.getElementById('undo-btn');
  if (!u) return;
  if (game && game.canUndo()) u.classList.remove('hidden');
  else u.classList.add('hidden');
}

function handleChoose(side) {
  if (!game) return;
  comparisons++;
  track('comparison_made', { decision_time_ms: Date.now() - pairShownAt, comparison_number: comparisons });
  var loserSide = game.choose(side);
  updateUndo();
  if (loserSide) {
    pairShownAt = Date.now();
    var badge = document.getElementById('streak-' + side);
    if (badge && game.streak >= 3) badge.classList.add('hot');
    var el = document.getElementById('card-' + loserSide);
    el.classList.remove('enter-left', 'enter-right');
    void el.offsetWidth;
    el.classList.add('enter-' + loserSide);
  } else {
    var w = game.currentWinner;
    var brandEl = document.getElementById('buy-brand');
    if (brandEl && w) brandEl.textContent = w.brand || 'חנות';
    track('game_completed', { winner_name: w.name, brand: w.brand, total_comparisons: comparisons, time_spent_sec: Math.round((Date.now() - gameStartedAt) / 1000) });
  }
}

document.getElementById('keep-btn').addEventListener('click', function () {
  if (game) { game.keepChoosing(); pairShownAt = Date.now(); }
});
document.getElementById('restart-btn').addEventListener('click', function () {
  if (game) { game.startOver(); comparisons = 0; pairShownAt = Date.now(); gameStartedAt = Date.now(); track('game_started', { product_count: currentProducts.length, is_restart: true }); }
});
document.getElementById('buy-btn').addEventListener('click', function () {
  if (game && game.currentWinner) track('product_clicked', { product_name: game.currentWinner.name, brand: game.currentWinner.brand, product_url: game.currentWinner.url });
});
document.getElementById('winner-img').addEventListener('click', function () {
  if (game && game.currentWinner) track('product_clicked', { product_name: game.currentWinner.name, brand: game.currentWinner.brand, product_url: game.currentWinner.url, via: 'image' });
});
document.getElementById('undo-btn').addEventListener('click', function () {
  if (game && game.undo()) {
    if (comparisons > 0) comparisons--;
    pairShownAt = Date.now();
    track('undo');
    updateUndo();
  }
});
document.getElementById('exit-btn').addEventListener('click', function () { show('welcome'); });
