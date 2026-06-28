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
  // Mixpanel /track needs a "simple" request (form-urlencoded `data=`) — JSON
  // content-type triggers a CORS preflight it rejects, silently dropping events.
  fetch('https://api-eu.mixpanel.com/track', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(JSON.stringify(payload))
  }).catch(function () {});
}

// Category labels/emojis, and which categories exist per gender × age.
// Keys + segments mirror the built Terminal X catalogs (catalogs/terminalx-*).
var CAT_META = {
  tops:       { label: 'חולצות',   emoji: '👕', group: 'clothing' },
  bottoms:    { label: 'מכנסיים',  emoji: '👖', group: 'clothing' },
  bodysuits:  { label: 'בגדי גוף', emoji: '🧸', group: 'clothing' },
  dresses:    { label: 'שמלות',    emoji: '👗', group: 'clothing' },
  swim:       { label: 'בגדי ים',  emoji: '🩱', group: 'clothing' },
  outerwear:  { label: 'מעילים',   emoji: '🧥', group: 'clothing' },
  nightwear:  { label: 'פיג\'מות', emoji: '🌙', group: 'clothing' },
  shoes:      { label: 'נעליים',   emoji: '👟', group: 'shoes' },
  hats:       { label: 'כובעים',   emoji: '🧢', group: 'accessories' },
  socks:      { label: 'גרביים',   emoji: '🧦', group: 'accessories' },
  bags:       { label: 'תיקים',    emoji: '🎒', group: 'accessories' },
  sunglasses: { label: 'משקפי שמש', emoji: '🕶️', group: 'accessories' }
};
var GROUP_ORDER = ['clothing', 'shoes', 'accessories'];
var SEGMENT_CATS = {
  'boy|0-2':  ['tops', 'bottoms', 'bodysuits', 'swim', 'outerwear', 'nightwear', 'shoes'],
  'girl|0-2': ['tops', 'bottoms', 'dresses', 'bodysuits', 'swim', 'outerwear', 'nightwear', 'shoes'],
  'boy|2-8':  ['tops', 'bottoms', 'swim', 'outerwear', 'nightwear', 'shoes', 'hats', 'socks', 'bags', 'sunglasses'],
  'girl|2-8': ['tops', 'bottoms', 'dresses', 'swim', 'outerwear', 'nightwear', 'shoes', 'hats', 'socks', 'bags', 'sunglasses']
};
function categoriesFor(gender, age) {
  var keys = SEGMENT_CATS[gender + '|' + age] || SEGMENT_CATS['boy|0-2'];
  return keys.map(function (k) {
    var emoji = CAT_META[k].emoji;
    if (k === 'swim' && gender === 'boy') emoji = '🩳'; // boys' swim trunks (🩱 one-piece reads feminine)
    return { key: k, label: CAT_META[k].label, emoji: emoji, group: CAT_META[k].group };
  });
}

// Minimum pool to start a tournament. Any filter value that would drop the
// result below this is shown with a count and disabled (not hidden) — the
// "protected minimum pool" rule. A thinner base pool triggers an auto-widen note.
var POOL_FLOOR = 8;
// Vibe/style families we surface as chips (order = display priority).
var STYLE_ORDER = ['casual', 'sporty', 'dressy', 'school', 'beach', 'sleep', 'holiday', 'other'];

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

var selection = { gender: null, age: null, category: null, budget: null, colors: [], styles: [], sale: false, multipack: false, noSets: false };
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

// Step 2: what — categories grouped into clothing / shoes / accessories so a long
// list never becomes its own "gathering" step.
function buildCategories() {
  var grid = document.getElementById('category-grid');
  grid.innerHTML = '';
  grid.classList.add('grouped');
  var cats = categoriesFor(selection.gender, selection.age);
  var groupsPresent = GROUP_ORDER.filter(function (g) {
    return cats.some(function (c) { return c.group === g; });
  });
  groupsPresent.forEach(function (grp) {
    if (groupsPresent.length > 1) {
      var hdr = document.createElement('p');
      hdr.className = 'cat-group-label';
      hdr.setAttribute('data-i18n', 'grp_' + grp);
      hdr.textContent = t('grp_' + grp);
      grid.appendChild(hdr);
    }
    var sub = document.createElement('div');
    sub.className = 'choice-grid cat-group';
    cats.filter(function (c) { return c.group === grp; }).forEach(function (c) {
      var b = document.createElement('button');
      b.className = 'choice';
      b.innerHTML = '<span class="choice-emoji">' + c.emoji + '</span><span data-i18n="cat_' + c.key + '">' + t('cat_' + c.key) + '</span>';
      b.addEventListener('click', function () {
        selection.category = c.key;
        loadPoolThenRefine();
      });
      sub.appendChild(b);
    });
    grid.appendChild(sub);
  });
}

// After category: fetch the pool, then show color+budget refine
function loadPoolThenRefine() {
  show('loading');
  document.getElementById('loading-text').textContent = t('loading_default');
  track('pool_requested', { gender: selection.gender, age: selection.age, category: selection.category });
  // Fetch a large pool so the adaptive filter counts reflect the real catalog, not an 80-item slice.
  var q = '/api/get-pool?gender=' + selection.gender + '&age=' + selection.age + '&category=' + selection.category + '&limit=400';
  fetch(q).then(function (r) { return r.json(); }).then(function (data) {
    poolProducts = data.products || [];
    if (poolProducts.length < 2) {
      document.getElementById('loading-text').textContent = t('err_fewitems');
      setTimeout(function () { show('setup'); resetSetup(); }, 2500);
      return;
    }
    track('pool_loaded', { count: poolProducts.length });
    selection.colors = []; selection.styles = []; selection.sale = false; selection.multipack = false; selection.noSets = false;
    buildRefine();
    show('setup');
    document.getElementById('step-who').classList.add('hidden');
    document.getElementById('step-what').classList.add('hidden');
    document.getElementById('step-refine').classList.remove('hidden');
  }).catch(function () {
    document.getElementById('loading-text').textContent = t('err_generic');
    setTimeout(function () { show('setup'); resetSetup(); }, 2500);
  });
}

// Step 3: refine — color + vibe chips and toggles, all built from the actual pool,
// with the "protected minimum pool" rule: any value that would leave < POOL_FLOOR
// items is shown with its count and disabled (not hidden).

// Apply every active filter EXCEPT the named one (so we can count what a value would leave).
function poolWith(except) {
  return poolProducts.filter(function (p) {
    if (except !== 'budget' && selection.budget) {
      var price = p.salePrice != null ? p.salePrice : p.originalPrice;
      if (price > selection.budget) return false;
    }
    if (except !== 'colors' && selection.colors.length && selection.colors.indexOf(p.colorFamily || 'אחר') === -1) return false;
    if (except !== 'styles' && selection.styles.length && selection.styles.indexOf(p.style || 'other') === -1) return false;
    if (except !== 'sale' && selection.sale && !p.sale) return false;
    if (except !== 'multipack' && selection.multipack && !p.inPack) return false;
    if (except !== 'noSets' && selection.noSets && p.isSet) return false;
    return true;
  });
}

function buildRefine() {
  buildColorChips();
  buildVibeChips();
  refreshAdaptive();
  var note = document.getElementById('few-note');
  if (note) note.classList.toggle('hidden', poolProducts.length >= POOL_FLOOR);
}

function buildColorChips() {
  var counts = {};
  poolProducts.forEach(function (p) { var f = p.colorFamily || 'אחר'; counts[f] = (counts[f] || 0) + 1; });
  var families = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
  var wrap = document.getElementById('color-chips');
  wrap.innerHTML = '';
  families.forEach(function (fam) {
    var chip = document.createElement('button');
    chip.className = 'color-chip';
    chip.setAttribute('data-fam', fam);
    var hex = FAMILY_HEX[fam];
    var dot = fam === 'מצויר'
      ? '<span class="chip-dot chip-multi"></span>'
      : '<span class="chip-dot" style="background:' + (hex || '#ccc') + '"></span>';
    chip.innerHTML = dot + '<span data-i18n="color_' + fam + '">' + t('color_' + fam) + '</span><span class="chip-count"></span>';
    chip.addEventListener('click', function () {
      if (chip.classList.contains('disabled')) return;
      chip.classList.toggle('selected');
      var i = selection.colors.indexOf(fam);
      if (i === -1) selection.colors.push(fam); else selection.colors.splice(i, 1);
      refreshAdaptive();
    });
    wrap.appendChild(chip);
  });
}

function buildVibeChips() {
  var counts = {};
  poolProducts.forEach(function (p) { var s = p.style || 'other'; counts[s] = (counts[s] || 0) + 1; });
  var styles = STYLE_ORDER.filter(function (s) { return counts[s]; });
  var block = document.getElementById('vibe-block');
  if (block) block.classList.toggle('hidden', styles.length < 2); // no point offering a single vibe
  var wrap = document.getElementById('vibe-chips');
  wrap.innerHTML = '';
  styles.forEach(function (st) {
    var chip = document.createElement('button');
    chip.className = 'color-chip vibe-chip';
    chip.setAttribute('data-style', st);
    chip.innerHTML = '<span data-i18n="style_' + st + '">' + t('style_' + st) + '</span><span class="chip-count"></span>';
    chip.addEventListener('click', function () {
      if (chip.classList.contains('disabled')) return;
      chip.classList.toggle('selected');
      var i = selection.styles.indexOf(st);
      if (i === -1) selection.styles.push(st); else selection.styles.splice(i, 1);
      refreshAdaptive();
    });
    wrap.appendChild(chip);
  });
}

function setChipState(chip, count, selected) {
  var c = chip.querySelector('.chip-count');
  if (c) c.textContent = count;
  // Color/style are multi-select — never freeze them, even at low counts.
  // The user can combine several, and a too-narrow result falls back safely at play time.
  chip.classList.remove('disabled');
}

function updateToggle(key, sel, count) {
  var el = document.getElementById('t-' + key);
  if (!el) return;
  var c = el.querySelector('.chip-count');
  if (c) c.textContent = count;
  el.classList.toggle('on', !!sel);
  el.classList.remove('disabled');                    // count is shown -> let the user decide, even at low counts
  el.classList.toggle('hidden', count === 0 && !sel); // only hide when there's truly nothing to offer
}

// Recompute every filter value's count + disabled/selected state against the current selection.
function refreshAdaptive() {
  var byColor = {};
  poolWith('colors').forEach(function (p) { var f = p.colorFamily || 'אחר'; byColor[f] = (byColor[f] || 0) + 1; });
  Array.prototype.forEach.call(document.querySelectorAll('#color-chips .color-chip'), function (chip) {
    var fam = chip.getAttribute('data-fam');
    setChipState(chip, byColor[fam] || 0, selection.colors.indexOf(fam) !== -1);
  });
  var byStyle = {};
  poolWith('styles').forEach(function (p) { var s = p.style || 'other'; byStyle[s] = (byStyle[s] || 0) + 1; });
  Array.prototype.forEach.call(document.querySelectorAll('#vibe-chips .vibe-chip'), function (chip) {
    var st = chip.getAttribute('data-style');
    setChipState(chip, byStyle[st] || 0, selection.styles.indexOf(st) !== -1);
  });
  updateToggle('sale', selection.sale, poolWith('sale').filter(function (p) { return p.sale; }).length);
  updateToggle('multipack', selection.multipack, poolWith('multipack').filter(function (p) { return p.inPack; }).length);
  updateToggle('nosets', selection.noSets, poolWith('noSets').filter(function (p) { return !p.isSet; }).length);
}

var slider = document.getElementById('budget-slider');
slider.addEventListener('input', function () {
  document.getElementById('budget-val').textContent = slider.value;
  selection.budget = parseInt(slider.value); // live so adaptive counts respect budget
  refreshAdaptive();
});
[['sale', 'sale'], ['multipack', 'multipack'], ['nosets', 'noSets']].forEach(function (pair) {
  var el = document.getElementById('t-' + pair[0]);
  if (!el) return;
  el.addEventListener('click', function () {
    if (el.classList.contains('disabled')) return;
    selection[pair[1]] = !selection[pair[1]];
    refreshAdaptive();
  });
});
document.getElementById('play-btn').addEventListener('click', function () { applyFiltersAndPlay(); });
document.getElementById('skip-refine').addEventListener('click', function () {
  selection.budget = null; selection.colors = []; selection.styles = [];
  selection.sale = false; selection.multipack = false; selection.noSets = false;
  applyFiltersAndPlay();
});

function applyFiltersAndPlay() {
  var filtered = poolWith(null); // all active filters
  if (filtered.length < 2) filtered = poolProducts.slice(); // safety net
  track('filters_applied', {
    colors: selection.colors.join(',') || 'all', styles: selection.styles.join(',') || 'all',
    budget: selection.budget || 0, sale: selection.sale, multipack: selection.multipack,
    no_sets: selection.noSets, result_count: filtered.length
  });
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
    if (brandEl && w) brandEl.textContent = w.brand || t('store_fallback');
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

// Keyboard support for card selection (Enter or Space fires the same handler as click)
document.getElementById('card-left').addEventListener('keydown', function (e) {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleChoose('left'); }
});
document.getElementById('card-right').addEventListener('keydown', function (e) {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleChoose('right'); }
});
