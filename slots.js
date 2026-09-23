/* =========================================================
   SLOTS.JS — 3 тематических автомата + автоигра/турбо + джекпот
   ========================================================= */

const THEMES = {
  classic: {
    name: 'Потужный',
    pool: [
      { icon: '<img src="image_41d836.jpg" class="slot-img">', weight: 30 },
      { icon: '<img src="image_41d833.jpg" class="slot-img">', weight: 24 },
      { icon: '<img src="image_41d82f.jpg" class="slot-img">', weight: 18 },
      { icon: '<img src="image_41d817.jpg" class="slot-img">', weight: 12 },
      { icon: '<img src="image_41d812.jpg" class="slot-img">', weight: 9 },
      { icon: '<img src="image_41d80f.jpg" class="slot-img">', weight: 5 },
      { icon: '<img src="image_41d7f5.jpg" class="slot-img">', weight: 2 }
    ],
    mult: {
      '<img src="image_41d7f5.jpg" class="slot-img">': 20,
      '<img src="image_41d80f.jpg" class="slot-img">': 15,
      '<img src="image_41d812.jpg" class="slot-img">': 10,
      '<img src="image_41d817.jpg" class="slot-img">': 8,
      '<img src="image_41d82f.jpg" class="slot-img">': 6,
      '<img src="image_41d833.jpg" class="slot-img">': 5,
      '<img src="image_41d836.jpg" class="slot-img">': 4
    }
  },
  egypt: {
    name: 'Египет',
    pool: [
      { icon: '🪲', weight: 28 },
      { icon: '🐫', weight: 22 },
      { icon: '𓂀', weight: 16 },
      { icon: '🏺', weight: 13 },
      { icon: '🐍', weight: 10 },
      { icon: '👑', weight: 7 },
      { icon: '🔺', weight: 4 }
    ],
    mult: { '🔺': 25, '👑': 16, '🐍': 11, '🏺': 8, '𓂀': 7, '🐫': 5, '🪲': 4 }
  },
  space: {
    name: 'Космос',
    pool: [
      { icon: '☄️', weight: 27 },
      { icon: '🪐', weight: 21 },
      { icon: '👾', weight: 17 },
      { icon: '🛰️', weight: 13 },
      { icon: '🌟', weight: 10 },
      { icon: '🛸', weight: 8 },
      { icon: '🚀', weight: 4 }
    ],
    mult: { '🚀': 22, '🛸': 14, '🌟': 10, '🛰️': 8, '👾': 6, '🪐': 5, '☄️': 4 }
  }
};

let currentTheme = 'classic';
let currentBet = 50;
let turbo = false;
let autoplayRemaining = 0;
let spinning = false;
let jackpot = 18420 + Math.floor(Math.random() * 300);

const spinBtn = document.getElementById('spin-btn');
const slotMessage = document.getElementById('slot-message');
const turboBtn = document.getElementById('turbo-btn');
const autoplayBtn = document.getElementById('autoplay-btn');
const jackpotEl = document.getElementById('jackpot-amount');
const strips = [
  document.getElementById('strip1'),
  document.getElementById('strip2'),
  document.getElementById('strip3')
];

function renderJackpot() {
  jackpotEl.textContent = fmtMoney(jackpot);
}
renderJackpot();
setInterval(() => { jackpot += Math.floor(Math.random() * 8) + 1; renderJackpot(); }, 2200);

function weightedSymbol() {
  const pool = THEMES[currentTheme].pool;
  const total = pool.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (const s of pool) {
    if (r < s.weight) return s.icon;
    r -= s.weight;
  }
  return pool[0].icon;
}

// ---------- Theme tabs ----------
document.querySelectorAll('.theme-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    if (spinning) return;
    document.querySelectorAll('.theme-tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    currentTheme = tab.dataset.theme;
    renderPaytable();
    strips.forEach((s) => {
      s.innerHTML = '';
      const span = document.createElement('span');
      span.innerHTML = weightedSymbol();
      s.appendChild(span);
    });
    slotMessage.textContent = `Автомат сменён: ${THEMES[currentTheme].name}`;
  });
});

// ---------- Chip bet selector ----------
document.querySelectorAll('#chip-row .chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('#chip-row .chip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    currentBet = parseInt(chip.dataset.bet);
    document.getElementById('current-bet').textContent = fmtMoney(currentBet);
  });
});
document.getElementById('current-bet').textContent = fmtMoney(currentBet);

// ---------- Turbo / Autoplay toggles ----------
turboBtn.addEventListener('click', () => {
  turbo = !turbo;
  turboBtn.classList.toggle('active', turbo);
});

autoplayBtn.addEventListener('click', () => {
  if (autoplayRemaining > 0) {
    autoplayRemaining = 0;
    autoplayBtn.classList.remove('active');
    autoplayBtn.textContent = '🔁 Автоигра ×10';
    return;
  }
  autoplayRemaining = 10;
  autoplayBtn.classList.add('active');
  autoplayBtn.textContent = `🔁 Осталось ${autoplayRemaining}`;
  if (!spinning) doSpin();
});

// ---------- Paytable modal ----------
const paytableModal = document.getElementById('paytable-modal');
const paytableRows = document.getElementById('paytable-rows');
const paytableThemeName = document.getElementById('paytable-theme-name');

function renderPaytable() {
  const theme = THEMES[currentTheme];
  paytableThemeName.textContent = theme.name;
  paytableRows.innerHTML = '';
  Object.entries(theme.mult).forEach(([icon, mult]) => {
    const row = document.createElement('div');
    row.className = 'pay-row';
    row.innerHTML = `<span>${icon}${icon}${icon}</span> три подряд <b>×${mult}</b>`;
    paytableRows.appendChild(row);
  });
  const pairRow = document.createElement('div');
  pairRow.className = 'pay-row';
  pairRow.innerHTML = `<span>❔❔·</span> любые 2 одинаковых <b>×2</b>`;
  paytableRows.appendChild(pairRow);
  const jpRow = document.createElement('div');
  jpRow.className = 'pay-row';
  jpRow.innerHTML = `<span>💎💎💎</span> супер-джекпот раунд <b style="color:var(--gold-bright)">весь банк</b>`;
  paytableRows.appendChild(jpRow);
}
renderPaytable();

function openPaytable() { paytableModal.classList.add('open'); }
function closePaytable() { paytableModal.classList.remove('open'); }
document.getElementById('open-paytable').addEventListener('click', openPaytable);
document.getElementById('open-paytable-2').addEventListener('click', openPaytable);
document.getElementById('close-paytable').addEventListener('click', closePaytable);
paytableModal.addEventListener('click', (e) => { if (e.target === paytableModal) closePaytable(); });

// ---------- Reel building & spinning ----------
const STRIP_LENGTH = 14;

function buildStrip(stripEl, finalSymbol) {
  stripEl.style.transition = 'none';
  stripEl.style.transform = 'translateY(0)';
  stripEl.innerHTML = '';

  for (let i = 0; i < STRIP_LENGTH; i++) {
    const span = document.createElement('span');
    span.innerHTML = weightedSymbol();
    stripEl.appendChild(span);
  }
  const finalSpan = document.createElement('span');
  finalSpan.innerHTML = finalSymbol;
  stripEl.appendChild(finalSpan);

  void stripEl.offsetWidth;
}

function spinReel(stripEl, finalSymbol, delayMs) {
  return new Promise((resolve) => {
    buildStrip(stripEl, finalSymbol);
    const itemHeight = stripEl.children[0].getBoundingClientRect().height;
    const targetOffset = itemHeight * STRIP_LENGTH;
    const duration = turbo ? 1.1 : 2.6;
    const realDelay = turbo ? delayMs * 0.35 : delayMs;

    setTimeout(() => {
      stripEl.style.transition = `transform ${duration}s cubic-bezier(0.15, 0.85, 0.25, 1)`;
      stripEl.style.transform = `translateY(-${targetOffset}px)`;
    }, 30);

    setTimeout(resolve, duration * 1000 + realDelay);
  });
}

function calcPayout(result) {
  const mults = THEMES[currentTheme].mult;
  if (result[0] === result[1] && result[1] === result[2]) {
    const mult = mults[result[0]] || 4;
    return { mult, type: 'triple' };
  }
  if (result[0] === result[1] || result[1] === result[2] || result[0] === result[2]) {
    return { mult: 2, type: 'pair' };
  }
  return { mult: 0, type: 'none' };
}


function doSpin() {
  if (spinning) return;

  if (balance < currentBet) {
    try { SFX.error(); } catch(e) {}
    slotMessage.textContent = 'Недостаточно средств!';
    autoplayRemaining = 0;
    autoplayBtn.classList.remove('active');
    autoplayBtn.textContent = '🔁 Автоигра ×10';
    return;
  }

  spinning = true;
  try { SFX.spin(); } catch(e) {}
  spinBtn.disabled = true;
  slotMessage.textContent = '';
  updateBalance(-currentBet);

  if (Math.random() < 0.35) showRandomFlavor();

  // rare mega-jackpot chance
  const megaJackpot = Math.random() < 0.003;
  const result = megaJackpot
    ? [Object.keys(THEMES[currentTheme].mult)[0], Object.keys(THEMES[currentTheme].mult)[0], Object.keys(THEMES[currentTheme].mult)[0]]
    : [weightedSymbol(), weightedSymbol(), weightedSymbol()];
  const d1 = turbo ? 0 : 0, d2 = turbo ? 90 : 250, d3 = turbo ? 180 : 500;

  Promise.all([
    spinReel(strips[0], result[0], d1),
    spinReel(strips[1], result[1], d2),
    spinReel(strips[2], result[2], d3)
  ]).then(() => {
    try { SFX.reelStop(); } catch(e) {}
    const { mult, type } = calcPayout(result);

    if (megaJackpot) {
      const win = jackpot;
      updateBalance(win);
      showWinOverlay('МЕГА ДЖЕКПОТ! 💎', `Сорван банк — +${fmtMoney(win)}`);
      jackpot = 5000 + Math.floor(Math.random() * 500);
      renderJackpot();
    } else if (mult > 0) {
      const win = currentBet * mult;
      updateBalance(win);
      if (type === 'triple' && mult >= 10) {
        showWinOverlay('Джекпот!', `Выигрыш +${fmtMoney(win)} (×${mult})`);
      } else {
        slotMessage.textContent = `🎉 Комбинация! +${fmtMoney(win)} (×${mult})`;
      }
    } else {
      try { SFX.lose(); } catch(e) {}
      slotMessage.textContent = 'Не повезло, попробуй ещё раз';
    }

    spinning = false;
    spinBtn.disabled = false;

    if (autoplayRemaining > 0) {
      autoplayRemaining--;
      if (autoplayRemaining > 0 && balance >= currentBet) {
        autoplayBtn.textContent = `🔁 Осталось ${autoplayRemaining}`;
        setTimeout(doSpin, turbo ? 250 : 500);
      } else {
        autoplayRemaining = 0;
        autoplayBtn.classList.remove('active');
        autoplayBtn.textContent = '🔁 Автоигра ×10';
      }
    }
  });
}

spinBtn.addEventListener('click', doSpin);

// initial static reels
strips.forEach((s) => {
  const span = document.createElement('span');
  span.innerHTML = weightedSymbol();
  s.appendChild(span);
});


// Custom bet input
(function() {
  const input = document.getElementById('custom-bet-input');
  const btn = document.getElementById('custom-bet-apply');
  if (!input || !btn) return;
  btn.addEventListener('click', () => {
    const v = Math.floor(parseFloat(input.value));
    if (!v || v < 1) { input.focus(); return; }
    currentBet = Math.max(1, Math.floor(v));
    const el = document.getElementById('current-bet');
    if (el) el.textContent = fmtMoney(currentBet);
    document.querySelectorAll('#chip-row .chip, .chip-row .chip').forEach(c => c.classList.remove('active'));
    
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') btn.click(); });
})();
