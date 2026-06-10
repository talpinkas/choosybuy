// CHOOSY — Shared tournament engine (2-not-3 method)
// Used by both popup.js (demo mode) and content.js (overlay)

function ChoosingGame(options) {
  this.allProducts = options.products || [];
  this.streakGoal = options.streakGoal || 5;
  this.$ = options.querySelector || document.querySelector.bind(document);
  this.queue = [];
  this.leftProduct = null;
  this.rightProduct = null;
  this.currentWinner = null;
  this.streak = 0;
}

ChoosingGame.prototype.shuffle = function (arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr;
};

ChoosingGame.prototype.priceHTML = function (product) {
  if (product.salePrice != null) {
    return '<span class="price-original">₪' + product.originalPrice + '</span> ' +
           '<span class="price-sale">₪' + product.salePrice + '</span>';
  }
  return '₪' + product.originalPrice;
};

ChoosingGame.prototype.init = function () {
  this.queue = this.shuffle([].concat(this.allProducts));
  this.leftProduct = this.queue.shift();
  this.rightProduct = this.queue.shift();
  this.currentWinner = null;
  this.streak = 0;
  var gameScreen = this.$('#game-screen');
  var winnerScreen = this.$('#winner-screen');
  if (gameScreen) gameScreen.classList.remove('hidden');
  if (winnerScreen) winnerScreen.classList.add('hidden');
  this.render();
};

ChoosingGame.prototype.choose = function (side) {
  var winner = (side === 'left') ? this.leftProduct : this.rightProduct;
  var loserSide = (side === 'left') ? 'right' : 'left';

  if (this.currentWinner && this.currentWinner.id === winner.id) {
    this.streak++;
  } else {
    this.currentWinner = winner;
    this.streak = 1;
  }

  if (this.streak >= this.streakGoal || this.queue.length === 0) {
    this.showWinner(winner);
    return null;
  }

  var next = this.queue.shift();
  if (side === 'left') { this.rightProduct = next; } else { this.leftProduct = next; }
  this.render();

  return loserSide;
};

ChoosingGame.prototype.renderStreak = function (side, product) {
  var badge = this.$('#streak-' + side);
  if (!badge) return;

  if (!this.currentWinner || this.currentWinner.id !== product.id || this.streak === 0) {
    badge.innerHTML = '';
    badge.classList.remove('visible');
    badge.classList.remove('hot');
    return;
  }

  var dots = '';
  for (var i = 0; i < this.streakGoal; i++) {
    dots += '<span class="dot ' + (i < this.streak ? 'lit' : '') + '"></span>';
  }
  badge.innerHTML = dots;
  badge.classList.add('visible');
  if (this.streak >= 3) badge.classList.add('hot');
  else badge.classList.remove('hot');
};

ChoosingGame.prototype.render = function () {
  var imgLeft = this.$('#img-left');
  var nameLeft = this.$('#name-left');
  var priceLeft = this.$('#price-left');
  if (imgLeft) imgLeft.src = this.leftProduct.image;
  if (nameLeft) nameLeft.textContent = this.leftProduct.name;
  if (priceLeft) priceLeft.innerHTML = this.priceHTML(this.leftProduct);

  var imgRight = this.$('#img-right');
  var nameRight = this.$('#name-right');
  var priceRight = this.$('#price-right');
  if (imgRight) imgRight.src = this.rightProduct.image;
  if (nameRight) nameRight.textContent = this.rightProduct.name;
  if (priceRight) priceRight.innerHTML = this.priceHTML(this.rightProduct);

  this.renderStreak('left', this.leftProduct);
  this.renderStreak('right', this.rightProduct);

  var seen = this.allProducts.length - this.queue.length;
  var progressFill = this.$('#progress-fill');
  if (progressFill) {
    var pct = Math.round((seen / this.allProducts.length) * 100);
    progressFill.style.width = pct + '%';
  }
};

ChoosingGame.prototype.showWinner = function (product) {
  var gameScreen = this.$('#game-screen');
  var winnerScreen = this.$('#winner-screen');
  if (gameScreen) gameScreen.classList.add('hidden');
  if (winnerScreen) winnerScreen.classList.remove('hidden');

  var winnerName = this.$('#winner-name');
  var winnerImg = this.$('#winner-img');
  var winnerPrice = this.$('#winner-price');
  if (winnerName) winnerName.textContent = product.name;
  if (winnerImg) winnerImg.src = product.image;
  if (winnerPrice) winnerPrice.innerHTML = this.priceHTML(product);

  var buyBtn = this.$('#buy-btn');
  if (buyBtn) {
    if (product.url) {
      var sep = product.url.indexOf('?') === -1 ? '?' : '&';
      buyBtn.href = product.url + sep + 'utm_source=choosy';
    } else {
      buyBtn.href = 'https://www.terminalx.com/?utm_source=choosy';
    }
  }

  var keepBtn = this.$('#keep-btn');
  if (keepBtn) {
    keepBtn.style.display = (this.queue.length > 0) ? 'inline-block' : 'none';
  }
};

ChoosingGame.prototype.keepChoosing = function () {
  if (this.queue.length === 0) return;
  var next = this.queue.shift();
  this.leftProduct = this.currentWinner;
  this.rightProduct = next;
  this.currentWinner = null;
  this.streak = 0;
  var winnerScreen = this.$('#winner-screen');
  var gameScreen = this.$('#game-screen');
  if (winnerScreen) winnerScreen.classList.add('hidden');
  if (gameScreen) gameScreen.classList.remove('hidden');
  this.render();
};

ChoosingGame.prototype.startOver = function () {
  this.init();
};
