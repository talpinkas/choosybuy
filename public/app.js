// Choosy Web App — Main application logic

var MIXPANEL_TOKEN = 'd0151b0b7af8502ac4bbed6a650ae33a';
var MIXPANEL_API = 'https://api-eu.mixpanel.com/track';
var analyticsId = localStorage.getItem('choosy_id');
if (!analyticsId) {
  analyticsId = 'web-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  localStorage.setItem('choosy_id', analyticsId);
}

function track(event, props) {
  var payload = [{ event: event, properties: Object.assign({
    token: MIXPANEL_TOKEN, distinct_id: analyticsId,
    time: Math.floor(Date.now() / 1000), platform: 'web'
  }, props || {}) }];
  fetch(MIXPANEL_API, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(function() {});
}

// --- Screens ---
var landing = document.getElementById('landing');
var loadingScreen = document.getElementById('loading');
var gameContainer = document.getElementById('game-container');
var feedbackScreen = document.getElementById('feedback');
var urlInput = document.getElementById('url-input');
var goBtn = document.getElementById('go-btn');
var loadingText = document.getElementById('loading-text');

var game = null;
var gameStartedAt = 0;
var comparisons = 0;
var pairShownAt = 0;
var currentProducts = [];

function showScreen(screen) {
  [landing, loadingScreen, gameContainer, feedbackScreen].forEach(function(s) {
    s.classList.add('hidden');
  });
  screen.classList.remove('hidden');
}

// --- Go Button ---
goBtn.addEventListener('click', function() {
  var url = urlInput.value.trim();
  if (!url) { urlInput.focus(); return; }
  if (!url.startsWith('http')) url = 'https://' + url;

  showScreen(loadingScreen);
  loadingText.textContent = 'Finding products...';
  track('scrape_started', { url: url });

  fetch('/api/scrape?url=' + encodeURIComponent(url))
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.products || data.products.length < 2) {
        loadingText.textContent = 'Couldn\'t find enough products. Try a different link.';
        setTimeout(function() { showScreen(landing); }, 2500);
        return;
      }
      currentProducts = data.products;
      startGame(data.products);
    })
    .catch(function(err) {
      loadingText.textContent = 'Something went wrong. Try again.';
      setTimeout(function() { showScreen(landing); }, 2000);
    });
});

urlInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') goBtn.click();
});

// --- Game ---
function startGame(products) {
  showScreen(gameContainer);
  comparisons = 0;
  gameStartedAt = Date.now();
  pairShownAt = Date.now();

  var countEl = document.getElementById('product-count');
  if (countEl) countEl.textContent = products.length + ' products loaded';

  game = new ChoosingGame({
    products: products,
    querySelector: document.querySelector.bind(document)
  });

  game.init();
  track('game_started', { product_count: products.length });
}

document.getElementById('card-left').addEventListener('click', function() { handleChoose('left'); });
document.getElementById('card-right').addEventListener('click', function() { handleChoose('right'); });

function handleChoose(side) {
  if (!game) return;
  var decisionMs = Date.now() - pairShownAt;
  comparisons++;
  track('comparison_made', { decision_time_ms: decisionMs, comparison_number: comparisons });

  var loserSide = game.choose(side);
  if (loserSide) {
    pairShownAt = Date.now();
    var badge = document.getElementById('streak-' + (side === 'left' ? 'left' : 'right'));
    if (badge && game.streak >= 3) badge.classList.add('hot');
    var el = document.getElementById('card-' + loserSide);
    el.classList.remove('enter-left', 'enter-right');
    void el.offsetWidth;
    el.classList.add('enter-' + loserSide);
  } else {
    track('game_completed', {
      winner_name: game.currentWinner.name,
      total_comparisons: comparisons,
      time_spent_sec: Math.round((Date.now() - gameStartedAt) / 1000)
    });
  }
}

document.getElementById('keep-btn').addEventListener('click', function() {
  if (game) { game.keepChoosing(); pairShownAt = Date.now(); }
});

document.getElementById('restart-btn').addEventListener('click', function() {
  if (game) {
    game.startOver();
    comparisons = 0;
    pairShownAt = Date.now();
    gameStartedAt = Date.now();
    track('game_started', { product_count: currentProducts.length, is_restart: true });
  }
});

document.getElementById('buy-btn').addEventListener('click', function() {
  if (game && game.currentWinner) {
    track('product_clicked', { product_name: game.currentWinner.name, product_url: game.currentWinner.url });
  }
});

document.getElementById('back-btn').addEventListener('click', function() {
  showScreen(landing);
});
