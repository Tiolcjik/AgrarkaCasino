/* =========================================================
   COMMON.JS — shared across every page (Аграрка Элит Казино)
   (USD balance, realistic deposit gateway, toasts, daily bonus, ticker, win overlay)
   Must be loaded BEFORE any page-specific script.
   ========================================================= */

// ---------- Balance (USD) ----------

/* =========================================================
   AUTH — local accounts (register / login / remember)
   ========================================================= */
const AUTH_KEY = 'casinoAccounts';
const SESSION_KEY = 'casinoSession';

function _loadAccounts() {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY) || '{}'); } catch { return {}; }
}
function _saveAccounts(map) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(map));
}
function getSessionUser() {
  return localStorage.getItem(SESSION_KEY) || null;
}
function setSessionUser(login) {
  if (login) localStorage.setItem(SESSION_KEY, login);
  else localStorage.removeItem(SESSION_KEY);
}
function balanceKeyFor(user) {
  return user ? ('casinoBalance_' + user) : 'casinoBalance';
}
function hashPass(p) {
  // lightweight non-crypto fingerprint for demo (not real security)
  let h = 2166136261;
  const s = 'agrarka#' + p + '#elit';
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

function registerAccount(login, pass, displayName) {
  login = (login || '').trim().toLowerCase();
  pass = (pass || '');
  if (login.length < 3) return { ok: false, err: 'Логин минимум 3 символа' };
  if (pass.length < 4) return { ok: false, err: 'Пароль минимум 4 символа' };
  if (!/^[a-z0-9_\.\-]+$/i.test(login)) return { ok: false, err: 'Только латиница, цифры, _ . -' };
  const map = _loadAccounts();
  if (map[login]) return { ok: false, err: 'Такой логин уже занят' };
  map[login] = {
    login,
    pass: hashPass(pass),
    name: (displayName || login).trim().slice(0, 24),
    created: Date.now(),
    balance: 1000
  };
  _saveAccounts(map);
  localStorage.setItem(balanceKeyFor(login), '1000');
  setSessionUser(login);
  return { ok: true, user: map[login] };
}

function loginAccount(login, pass) {
  login = (login || '').trim().toLowerCase();
  const map = _loadAccounts();
  const u = map[login];
  if (!u) return { ok: false, err: 'Аккаунт не найден' };
  if (u.pass !== hashPass(pass || '')) return { ok: false, err: 'Неверный пароль' };
  setSessionUser(login);
  // ensure balance key exists
  if (localStorage.getItem(balanceKeyFor(login)) === null) {
    localStorage.setItem(balanceKeyFor(login), String(u.balance != null ? u.balance : 1000));
  }
  return { ok: true, user: u };
}

function logoutAccount() {
  // sync balance into account record
  const user = getSessionUser();
  if (user) {
    const map = _loadAccounts();
    if (map[user]) {
      map[user].balance = parseFloat(localStorage.getItem(balanceKeyFor(user)) || '0');
      _saveAccounts(map);
    }
  }
  setSessionUser(null);
}

function currentAccount() {
  const login = getSessionUser();
  if (!login) return null;
  const map = _loadAccounts();
  return map[login] || null;
}

window.CasinoAuth = { registerAccount, loginAccount, logoutAccount, getSessionUser, currentAccount };


/* ---- Require login to play / deposit ---- */
function isLoggedIn() {
  return !!getSessionUser();
}

function requireAuth(reason) {
  if (isLoggedIn()) return true;
  try { SFX.error(); } catch (e) {}
  showToast(reason || '⚠️ Войди в аккаунт, чтобы продолжить');
  try { openAuthModal('login'); } catch (e) {
    setTimeout(() => { try { openAuthModal('login'); } catch (e2) {} }, 100);
  }
  return false;
}

function installAuthGates() {
  // Block deposit
  document.addEventListener('click', function (e) {
    const dep = e.target.closest('#deposit-btn, .deposit-btn, [data-deposit], #dep-pay, #deposit-custom-btn');
    if (dep && !isLoggedIn()) {
      e.preventDefault();
      e.stopPropagation();
      requireAuth('⚠️ Войди, чтобы пополнить баланс');
    }
  }, true);

  // Block daily bonus
  document.addEventListener('click', function (e) {
    const b = e.target.closest('#bonus-btn');
    if (b && !isLoggedIn()) {
      e.preventDefault();
      e.stopPropagation();
      requireAuth('⚠️ Войди, чтобы забрать бонус');
    }
  }, true);

  // Block game cards on home
  document.addEventListener('click', function (e) {
    const card = e.target.closest('a.game-card, a.game-card-pro');
    if (card && !isLoggedIn()) {
      e.preventDefault();
      e.stopPropagation();
      requireAuth('⚠️ Войди в аккаунт, чтобы играть');
    }
  }, true);

  // Block primary game actions if somehow on game page without auth
  document.addEventListener('click', function (e) {
    if (isLoggedIn()) return;
    const action = e.target.closest(
      '#spin-btn, #roll-btn, #drop-btn, #deal-btn, #cashout-btn, #bet-btn, ' +
      '.primary-btn, #autoplay-btn, #turbo-btn, .chip, #mines-cashout, ' +
      '#scratch-buy, #keno-draw, #poker-deal, #poker-draw, #hilo-higher, #hilo-lower'
    );
    if (!action) return;
    // allow auth buttons
    if (action.closest('#auth-modal, #auth-user-box')) return;
    e.preventDefault();
    e.stopPropagation();
    requireAuth('⚠️ Войди в аккаунт, чтобы играть');
  }, true);

  // Game page lock overlay
  const isGamePage = !!document.querySelector('.game-shell') && !document.body.classList.contains('home-page');
  if (isGamePage && !isLoggedIn()) {
    showAuthLockOverlay();
  }
}

function showAuthLockOverlay() {
  if (document.getElementById('auth-lock-overlay')) return;
  const ov = document.createElement('div');
  ov.id = 'auth-lock-overlay';
  ov.innerHTML = `
    <div class="auth-lock-card">
      <div class="auth-seal" aria-hidden="true">
        <svg viewBox="0 0 80 80" width="56" height="56">
          <defs>
            <linearGradient id="lockG" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#ffe08a"/>
              <stop offset="100%" stop-color="#ff2e9a"/>
            </linearGradient>
          </defs>
          <polygon points="40,4 72,22 72,58 40,76 8,58 8,22" fill="none" stroke="url(#lockG)" stroke-width="2"/>
          <circle cx="40" cy="40" r="8" fill="url(#lockG)"/>
        </svg>
      </div>
      <h2>Нужен вход</h2>
      <p>Без аккаунта нельзя играть и пополнять баланс.<br>Войди или зарегистрируйся — займёт минуту.</p>
      <div class="auth-lock-actions">
        <button type="button" class="primary-btn" id="lock-login">Войти</button>
        <button type="button" class="auth-open-btn auth-open-reg" id="lock-reg">Регистрация</button>
      </div>
      <a href="index.html" class="back-link" style="margin-top:16px;display:inline-block">← На главную</a>
    </div>
  `;
  document.body.appendChild(ov);
  document.body.classList.add('auth-locked');
  ov.querySelector('#lock-login').onclick = () => openAuthModal('login');
  ov.querySelector('#lock-reg').onclick = () => openAuthModal('register');
}

function hideAuthLockOverlay() {
  document.getElementById('auth-lock-overlay')?.remove();
  document.body.classList.remove('auth-locked');
}

window.requireAuth = requireAuth;
window.isLoggedIn = isLoggedIn;



let balance = (function() {
  const k = balanceKeyFor(getSessionUser());
  const v = localStorage.getItem(k);
  if (v !== null && v !== undefined && v !== '') return parseFloat(v);
  return 1000;
})();

const balanceEl = document.getElementById('balance-amount');

// $ formatting helpers, used across every game script
function fmtMoney(n, withCents) {
  const val = Math.round((n + Number.EPSILON) * 100) / 100;
  if (withCents) {
    return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return '$' + Math.round(val).toLocaleString('en-US');
}

function renderBalance() {
  if (balanceEl) balanceEl.textContent = fmtMoney(balance, true);
}
renderBalance();

function updateBalance(amount) {
  balance += amount;
  if (balance < 0) balance = 0;
  localStorage.setItem(balanceKeyFor(getSessionUser()), balance);
  try {
    const u = getSessionUser();
    if (u) { const m = _loadAccounts(); if (m[u]) { m[u].balance = balance; _saveAccounts(m); } }
  } catch(e) {}
  renderBalance();
  if (balanceEl) {
    balanceEl.classList.remove('balance-pulse');
    void balanceEl.offsetWidth;
    balanceEl.classList.add('balance-pulse');
  }
}

// ---------- Toasts (funny flavor lines) ----------
const FLAVOR_LINES = [
  '🍀 Удача любит смелых...',
  '🔥 Атмосфера накаляется!',
  '👑 VIP-стол ждёт своего игрока',
  '💸 Ставки сделаны, ставок больше нет',
  '🎩 Дилер в предвкушении',
  '✨ Сегодня твой день?',
  '🐉 Дракон удачи проснулся',
  '🥂 За крупный куш!',
  '🌾 Аграрка на удачу не скупится',
  '💎 Джекпот где-то рядом',
  '🐸 Зелебоба смотрит на тебя с одобрением',
  '🚀 Потужно зашло бы...',
  '🎯 Перемога уже в пути',
  '👙 Хозяйка зала подмигнула — хороший знак',
  '🤡 RNG сегодня в настроении',
  '📦 Ещё один спин для коллекции',
  '🧠 Математика на твоей стороне (возможно)',
  '🌙 Ночной джекпот близко',
  '🦾 Ставка как заявление о намерениях',
  '🎬 Главный герой зашёл в кадр'
];

const MEME_POPUPS = [
  { emoji: '🐸', text: 'Зелебоба: «Ещё один спин и точно зайдёт. Я эксперт.»' },
  { emoji: '😎', text: 'Ты только что сделал ставку увереннее, чем твой последний экзамен.' },
  { emoji: '🧠', text: 'Факт: 73% игроков, которые читают мемы, потом выигрывают. (Источник: нам сказали.)' },
  { emoji: '💎', text: 'Джекпот где-то рядом. Или далеко. Или в другой вкладке.' },
  { emoji: '🚀', text: 'Потужный момент: ты всё ещё здесь. Уважение.' },
  { emoji: '🎰', text: 'Слотики шепчут: «Крути ещё. Мы почти настроены.»' },
  { emoji: '✈️', text: 'Літачок: «Я могу улететь на ×1.01. Или на ×52. Сюрприз.»' },
  { emoji: '💣', text: 'Міни: одна клетка — и ты либо король, либо история.' },
  { emoji: '🎲', text: 'Кости не врут. Они просто не всегда согласны с тобой.' },
  { emoji: '🎡', text: 'Срулетка крутится — мир подождёт.' },
  { emoji: '🃏', text: 'БлэкДжек: 21 — это не возраст, это цель.' },
  { emoji: '🔥', text: 'Потужне Казино напоминает: удача любит смелых и тех, кто не закрыл сайт.' },
  { emoji: '👑', text: 'VIP-статус активирован… в твоей голове. Но это считается.' },
  { emoji: '💸', text: 'Баланс — это не цифра. Это настроение.' },
  { emoji: '🎯', text: 'Колесо Фортуны: «Я честное. Иногда.»' }
];

function showMemePopup() {
  const popup = document.getElementById('meme-popup');
  if (!popup) {
    // create on the fly if missing
    const div = document.createElement('div');
    div.id = 'meme-popup';
    div.className = 'meme-popup';
    div.innerHTML = '<div class="meme-popup-card"><button class="meme-popup-close" id="meme-popup-close">✕</button><div class="meme-popup-emoji" id="meme-popup-emoji">🐸</div><p id="meme-popup-text"></p></div>';
    document.body.appendChild(div);
    div.querySelector('#meme-popup-close').addEventListener('click', () => div.classList.remove('show'));
    div.addEventListener('click', (e) => { if (e.target === div) div.classList.remove('show'); });
  }
  const p = document.getElementById('meme-popup');
  const m = MEME_POPUPS[Math.floor(Math.random() * MEME_POPUPS.length)];
  document.getElementById('meme-popup-emoji').textContent = m.emoji;
  document.getElementById('meme-popup-text').textContent = m.text;
  p.hidden = false;
  p.classList.add('show');
  clearTimeout(showMemePopup._t);
  showMemePopup._t = setTimeout(() => p.classList.remove('show'), 4500);
}

function initMemeSystem() {
  // random popup every 25-45s
  function schedule() {
    const delay = 25000 + Math.random() * 20000;
    setTimeout(() => {
      if (Math.random() < 0.7) showMemePopup();
      else showRandomFlavor();
      schedule();
    }, delay);
  }
  schedule();
  // first one after 8s on home
  if (document.body.classList.contains('home-page')) {
    setTimeout(() => showMemePopup(), 8000);
  }
  const closeBtn = document.getElementById('meme-popup-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => document.getElementById('meme-popup')?.classList.remove('show'));
  }
  document.getElementById('meme-popup')?.addEventListener('click', (e) => {
    if (e.target.id === 'meme-popup') e.target.classList.remove('show');
  });
}

function showToast(text) {
  const stack = document.getElementById('toast-stack');
  if (!stack) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function showRandomFlavor() {
  const line = FLAVOR_LINES[Math.floor(Math.random() * FLAVOR_LINES.length)];
  showToast(line);
}

// ---------- Win overlay (big centered popup) ----------
function showWinOverlay(title, sub) {
  try {
    const t = (title || '').toLowerCase();
    if (t.includes('джекпот') || t.includes('мега') || t.includes('банк')) SFX.bigWin();
    else SFX.win();
    burstConfetti(t.includes('джекпот') || t.includes('мега') ? 72 : 40);
  } catch (e) {}

  const overlay = document.getElementById('win-overlay');
  if (!overlay) return;
  overlay.querySelector('.win-title').textContent = title;
  overlay.querySelector('.sub').textContent = sub || '';
  overlay.classList.add('show');
  clearTimeout(showWinOverlay._t);
  showWinOverlay._t = setTimeout(() => overlay.classList.remove('show'), 1800);
}

// ---------- Daily bonus ----------
function initDailyBonus() {
  const btn = document.getElementById('bonus-btn');
  if (!btn) return;

  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;

  function refreshState() {
    const lastClaim = localStorage.getItem('lastBonusClaim');
    if (lastClaim && now - parseInt(lastClaim) < DAY) {
      btn.disabled = true;
      btn.textContent = '✓ Бонус получен';
    } else {
      btn.disabled = false;
      btn.textContent = '🎁 Забрать бонус +$200';
    }
  }

  refreshState();

  btn.addEventListener('click', () => {
    updateBalance(200);
    localStorage.setItem('lastBonusClaim', String(Date.now()));
    showToast('🎁 +$200.00 на баланс! Возвращайся завтра за новым бонусом');
    refreshState();
  });
}

// ---------- Deposit (реалистичный платёжный шлюз) ----------
// Injected on every page so we don't have to duplicate markup in each .html file.
function initDeposit() {
  const topRight = document.querySelector('.topbar-right');
  if (!topRight) return;

  const depBtn = document.createElement('button');
  depBtn.id = 'deposit-btn';
  depBtn.className = 'deposit-btn';
  depBtn.textContent = '💳 Пополнить';
  const pill = topRight.querySelector('.balance-pill');
  topRight.insertBefore(depBtn, pill || topRight.firstChild);

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'deposit-modal';
  overlay.innerHTML = `
    <div class="modal-box">
      <h3>💳 Пополнение счёта</h3>
      <p style="color:var(--text-dim);font-size:13.5px;margin-top:-8px;">Выбери способ оплаты и сумму пополнения в USD</p>

      <div class="dep-method-tabs" id="dep-method-tabs">
        <div class="dep-method-tab active" data-method="card">💳 Карта</div>
        <div class="dep-method-tab" data-method="crypto">₿ Крипто</div>
        <div class="dep-method-tab" data-method="bank">🏦 Банк</div>
      </div>

      <div id="dep-form-body">
        <div class="dep-card-preview" id="dep-card-preview">
          <div class="dep-card-chip"></div>
          <div class="dep-card-num" id="dep-card-num-preview">•••• •••• •••• ••••</div>
          <div class="dep-card-bottom">
            <span id="dep-card-holder-preview">CARD HOLDER</span>
            <span class="dep-card-brand">VISA</span>
          </div>
        </div>

        <div class="dep-field">
          <label>Номер карты</label>
          <input type="text" id="dep-card-number" maxlength="19" placeholder="4000 0000 0000 0000" inputmode="numeric">
        </div>
        <div class="dep-field-row">
          <div class="dep-field">
            <label>Срок действия</label>
            <input type="text" id="dep-card-expiry" maxlength="5" placeholder="ММ/ГГ" inputmode="numeric">
          </div>
          <div class="dep-field">
            <label>CVV</label>
            <input type="text" id="dep-card-cvv" maxlength="3" placeholder="•••" inputmode="numeric">
          </div>
        </div>

        <p class="bet-board-label" style="margin-top:18px;">Сумма пополнения</p>
        <div class="deposit-amounts" id="deposit-amounts">
          <button class="deposit-amount-btn" data-amount="50">+$50</button>
          <button class="deposit-amount-btn active" data-amount="100">+$100</button>
          <button class="deposit-amount-btn" data-amount="250">+$250</button>
          <button class="deposit-amount-btn" data-amount="500">+$500</button>
          <button class="deposit-amount-btn" data-amount="1000">+$1,000</button>
          <button class="deposit-amount-btn" data-amount="2500">+$2,500</button>
        </div>
        <div class="deposit-custom">
          <input type="number" id="deposit-custom-input" placeholder="Своя сумма, $" min="1" step="1">
          <button id="deposit-custom-btn">Указать</button>
        </div>

        <button class="dep-pay-btn" id="dep-pay-btn">Оплатить <span id="dep-pay-amount">$100.00</span></button>

        <div class="deposit-secure-row">🔒 Шифрование соединения 256-bit SSL</div>
        <p class="deposit-note">Это демонстрационная платформа «Аграрка Элит Казино». Реальные платёжные данные не передаются и не сохраняются, средства виртуальны и не имеют денежной ценности.</p>
      </div>

      <div class="dep-processing" id="dep-processing">
        <div class="dep-spinner"></div>
        <p>Обработка платежа через защищённый шлюз...</p>
      </div>

      <div class="dep-success" id="dep-success">
        <div class="check">✓</div>
        <p style="color:var(--text-dim);margin:0;">Платёж успешно проведён</p>
        <div class="amt" id="dep-success-amt">+$100.00</div>
      </div>

      <button class="modal-close" id="deposit-close">Закрыть</button>
    </div>
  `;
  document.body.appendChild(overlay);

  let selectedAmount = 100;
  let selectedMethod = 'card';

  const cardNumInput = overlay.querySelector('#dep-card-number');
  const cardExpiryInput = overlay.querySelector('#dep-card-expiry');
  const cardCvvInput = overlay.querySelector('#dep-card-cvv');
  const cardNumPreview = overlay.querySelector('#dep-card-num-preview');
  const cardHolderPreview = overlay.querySelector('#dep-card-holder-preview');
  const payBtn = overlay.querySelector('#dep-pay-btn');
  const payAmountEl = overlay.querySelector('#dep-pay-amount');
  const formBody = overlay.querySelector('#dep-form-body');
  const processingBox = overlay.querySelector('#dep-processing');
  const successBox = overlay.querySelector('#dep-success');

  function refreshPayLabel() {
    payAmountEl.textContent = fmtMoney(selectedAmount, true);
  }
  refreshPayLabel();

  // card number live formatting
  cardNumInput.addEventListener('input', () => {
    let digits = cardNumInput.value.replace(/\D/g, '').slice(0, 16);
    cardNumInput.value = digits.replace(/(.{4})/g, '$1 ').trim();
    cardNumPreview.textContent = digits.length
      ? (digits.padEnd(16, '•').replace(/(.{4})/g, '$1 ').trim())
      : '•••• •••• •••• ••••';
  });
  cardExpiryInput.addEventListener('input', () => {
    let digits = cardExpiryInput.value.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) digits = digits.slice(0, 2) + '/' + digits.slice(2);
    cardExpiryInput.value = digits;
  });
  cardCvvInput.addEventListener('input', () => {
    cardCvvInput.value = cardCvvInput.value.replace(/\D/g, '').slice(0, 3);
  });

  // method tabs
  overlay.querySelectorAll('.dep-method-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      overlay.querySelectorAll('.dep-method-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      selectedMethod = tab.dataset.method;
      const cardFields = [cardNumInput.parentElement, cardExpiryInput.parentElement.parentElement, overlay.querySelector('#dep-card-preview')];
      const showCard = selectedMethod === 'card';
      cardFields.forEach((el) => (el.style.display = showCard ? '' : 'none'));
      if (!showCard) {
        cardHolderPreview.textContent = selectedMethod === 'crypto' ? 'BTC / USDT WALLET' : 'BANK TRANSFER';
      } else {
        cardHolderPreview.textContent = 'CARD HOLDER';
      }
    });
  });

  function openModal() { overlay.classList.add('open'); showStep('form'); }
  function closeModal() { overlay.classList.remove('open'); }
  function showStep(step) {
    formBody.style.display = step === 'form' ? '' : 'none';
    overlay.querySelector('#dep-method-tabs').style.display = step === 'form' ? '' : 'none';
    processingBox.classList.toggle('show', step === 'processing');
    successBox.classList.toggle('show', step === 'success');
  }

  depBtn.addEventListener('click', openModal);
  overlay.querySelector('#deposit-close').addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

  overlay.querySelectorAll('.deposit-amount-btn').forEach((b) => {
    b.addEventListener('click', () => {
      overlay.querySelectorAll('.deposit-amount-btn').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      selectedAmount = parseInt(b.dataset.amount);
      refreshPayLabel();
    });
  });

  const customInput = overlay.querySelector('#deposit-custom-input');
  overlay.querySelector('#deposit-custom-btn').addEventListener('click', () => {
    const val = Math.floor(parseFloat(customInput.value));
    if (!val || val <= 0) {
      customInput.focus();
      return;
    }
    overlay.querySelectorAll('.deposit-amount-btn').forEach((x) => x.classList.remove('active'));
    selectedAmount = val;
    refreshPayLabel();
  });

  payBtn.addEventListener('click', () => {
    payBtn.disabled = true;
    showStep('processing');
    setTimeout(() => {
      updateBalance(selectedAmount);
      try { pushTx('deposit', selectedAmount, 'card'); } catch(e) {}
      try { recordDeposit(selectedAmount); } catch(e) {}
      try { unlockAchievement('deposit'); } catch(e) {}
      overlay.querySelector('#dep-success-amt').textContent = '+' + fmtMoney(selectedAmount, true);
      showStep('success');
      showToast(`💳 Баланс пополнен на ${fmtMoney(selectedAmount, true)}`);
      payBtn.disabled = false;
      setTimeout(() => {
        closeModal();
        showStep('form');
      }, 1600);
    }, 1500);
  });
}

// ---------- Ticker (fake live wins) ----------
function initTicker() {
  const track = document.getElementById('ticker-track');
  if (!track) return;

  const names = ['Alex_777', 'LuckyMax', 'NeonQueen', 'Dmitry_K', 'VegasVibe', 'GoldRush', 'MysticCat', 'Roman_P', 'AgroKing', 'FieldBoss', 'ElenaVIP', 'MaxProfit'];
  const games = ['Слотики', 'Срулетка', 'БлэкДжек', 'Потужный Літачок', 'Міни', 'Плинко', 'Кости'];
  let html = '';

  for (let i = 0; i < 16; i++) {
    const name = names[Math.floor(Math.random() * names.length)];
    const game = games[Math.floor(Math.random() * games.length)];
    const amount = (Math.floor(Math.random() * 40) + 2) * 50;
    html += `<span>${name} выиграл <span class="win">+${fmtMoney(amount)}</span> в «${game}»</span>`;
  }

  track.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', () => {
  initDailyBonus();
  initDeposit();
  initTicker();
  initMemeSystem();
  try { installAuthGates(); } catch(e) {}
});


/* ========== VIP LEVEL / ACHIEVEMENTS / LIVE FEED / ROUNDS ========== */
function getRounds() {
  return parseInt(localStorage.getItem('casinoRounds') || '0', 10);
}
function bumpRound() {
  const n = getRounds() + 1;
  localStorage.setItem('casinoRounds', String(n));
  const el = document.getElementById('games-played');
  if (el) el.textContent = String(n);
  checkAchievements();
  refreshVipLevel();
  return n;
}

// wrap updateBalance to track big wins
const _origUpdateBalance = typeof updateBalance === 'function' ? updateBalance : null;
if (_origUpdateBalance) {
  updateBalance = function(amount) {
    _origUpdateBalance(amount);
    if (amount > 0) {
      const wins = parseInt(localStorage.getItem('casinoWins') || '0', 10) + 1;
      localStorage.setItem('casinoWins', String(wins));
      if (amount >= 500) unlockAchievement('bigwin');
      if (amount >= 2000) unlockAchievement('whale');
    }
    if (amount < 0) bumpRound();
    refreshVipLevel();
  };
}

function refreshVipLevel() {
  const el = document.getElementById('vip-level-text');
  const pill = document.getElementById('vip-level-pill');
  if (!el) return;
  const b = balance;
  const rounds = getRounds();
  let level = 'Bronze', cls = 'vip-bronze';
  if (b >= 5000 || rounds >= 50) { level = 'Silver'; cls = 'vip-silver'; }
  if (b >= 15000 || rounds >= 150) { level = 'Gold'; cls = 'vip-gold'; }
  if (b >= 50000 || rounds >= 400) { level = 'Diamond'; cls = 'vip-diamond'; }
  el.textContent = level;
  if (pill) {
    pill.className = 'vip-level-pill ' + cls;
  }
}

const ACHIEVEMENTS = {
  firstspin: { title: 'Первый спин', desc: 'Сыграл первый раунд', icon: '🎰' },
  bigwin: { title: 'Крупный куш', desc: 'Выигрыш от $500', icon: '💰' },
  whale: { title: 'Кит', desc: 'Выигрыш от $2,000', icon: '🐋' },
  tenrounds: { title: 'Разгон', desc: '10 раундов', icon: '🔥' },
  fiftyrounds: { title: 'Завсегдатай', desc: '50 раундов', icon: '👑' },
  deposit: { title: 'Пополнил', desc: 'Сделал депозит', icon: '💳' },
  meme: { title: 'Мемолог', desc: 'Открыл мем дня', icon: '🐸' },
  lucky: { title: 'Мне повезёт', desc: 'Жмакнул кнопку удачи', icon: '🍀' }
};

function getUnlocked() {
  try { return JSON.parse(localStorage.getItem('casinoAch') || '{}'); } catch { return {}; }
}
function unlockAchievement(id) {
  const u = getUnlocked();
  if (u[id]) return;
  u[id] = Date.now();
  localStorage.setItem('casinoAch', JSON.stringify(u));
  const a = ACHIEVEMENTS[id];
  if (a) showToast(a.icon + ' Ачивка: ' + a.title);
}
function checkAchievements() {
  const r = getRounds();
  if (r >= 1) unlockAchievement('firstspin');
  if (r >= 10) unlockAchievement('tenrounds');
  if (r >= 50) unlockAchievement('fiftyrounds');
}
function openAchievements() {
  const list = document.getElementById('achievements-list');
  const modal = document.getElementById('achievements-modal');
  if (!list || !modal) return;
  const u = getUnlocked();
  list.innerHTML = '';
  Object.entries(ACHIEVEMENTS).forEach(([id, a]) => {
    const row = document.createElement('div');
    row.className = 'ach-row' + (u[id] ? ' unlocked' : '');
    row.innerHTML = `<span class="ach-icon">${a.icon}</span><div><b>${a.title}</b><br><small>${a.desc}</small></div><span class="ach-status">${u[id] ? '✓' : '🔒'}</span>`;
    list.appendChild(row);
  });
  modal.classList.add('open');
}

function initLiveFeed() {
  const list = document.getElementById('live-feed-list');
  if (!list) return;
  const names = ['Alex_777','NeonQueen','AgroKing','LuckyMax','FieldBoss','ElenaVIP','GoldRush','MysticCat','Roman_P','VegasVibe','Zeleboba','Potuzhny'];
  const games = ['Слотики','Літачок','Срулетка','БлэкДжек','Міни','Плинко','Кости','Колесо','Hi-Lo','Скретч','Кено','Покер'];
  function addLine() {
    const name = names[Math.floor(Math.random()*names.length)];
    const game = games[Math.floor(Math.random()*games.length)];
    const amount = (Math.floor(Math.random()*80)+2)*25;
    const line = document.createElement('div');
    line.className = 'live-feed-item';
    line.innerHTML = `<b>${name}</b> +${fmtMoney(amount)} <span>в ${game}</span>`;
    list.prepend(line);
    while (list.children.length > 8) list.lastChild.remove();
  }
  for (let i = 0; i < 5; i++) addLine();
  setInterval(addLine, 3500 + Math.random()*2000);
}

/* ========== CINEMATIC SOUND ENGINE (Web Audio, no files) ========== */
let soundOn = localStorage.getItem('casinoSound') !== '0';
let _actx = null;

function _audioCtx() {
  if (!_actx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    _actx = new AC();
  }
  if (_actx.state === 'suspended') _actx.resume();
  return _actx;
}

function _tone(freq, dur, type, vol, slideTo) {
  if (!soundOn) return;
  const ctx = _audioCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 4200;
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol || 0.12, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function _noise(dur, vol) {
  if (!soundOn) return;
  const ctx = _audioCtx();
  if (!ctx) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1800;
  gain.gain.value = vol || 0.08;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  src.start();
}

const SFX = {
  click() { _tone(880, 0.06, 'triangle', 0.07); _tone(1320, 0.04, 'sine', 0.04); },
  hover() { _tone(1200, 0.03, 'sine', 0.025); },
  chip() { _tone(660, 0.07, 'square', 0.05); _tone(990, 0.05, 'triangle', 0.04); },
  spin() {
    _noise(0.12, 0.06);
    _tone(180, 0.35, 'sawtooth', 0.06, 90);
    setTimeout(() => _tone(220, 0.2, 'triangle', 0.05, 140), 80);
  },
  reelStop() { _tone(420, 0.08, 'square', 0.06); _tone(210, 0.1, 'triangle', 0.04); },
  win() {
    _tone(523, 0.12, 'sine', 0.1);
    setTimeout(() => _tone(659, 0.12, 'sine', 0.1), 90);
    setTimeout(() => _tone(784, 0.18, 'sine', 0.12), 180);
    setTimeout(() => _tone(1046, 0.25, 'triangle', 0.1), 280);
  },
  bigWin() {
    [523, 659, 784, 988, 1175, 1319].forEach((f, i) => {
      setTimeout(() => { _tone(f, 0.2, 'sine', 0.11); _tone(f * 2, 0.15, 'triangle', 0.04); }, i * 70);
    });
    setTimeout(() => _noise(0.15, 0.05), 100);
  },
  lose() { _tone(320, 0.2, 'sawtooth', 0.07, 120); setTimeout(() => _tone(180, 0.25, 'triangle', 0.06, 90), 100); },
  cashout() { _tone(880, 0.1, 'sine', 0.1); setTimeout(() => _tone(1175, 0.2, 'triangle', 0.1), 80); },
  deposit() { _tone(523, 0.1, 'sine', 0.09); setTimeout(() => _tone(784, 0.15, 'sine', 0.1), 100); setTimeout(() => _tone(1046, 0.2, 'triangle', 0.08), 200); },
  // iOS App Store–style purchase / download confirm (clean glassy ding)
  appStore() {
    if (!soundOn) return;
    const ctx = _audioCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    // soft low body
    const o1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    o1.type = 'sine';
    o1.frequency.setValueAtTime(523.25, t0); // C5
    g1.gain.setValueAtTime(0.0001, t0);
    g1.gain.exponentialRampToValueAtTime(0.08, t0 + 0.02);
    g1.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
    o1.connect(g1); g1.connect(ctx.destination);
    o1.start(t0); o1.stop(t0 + 0.3);
    // bright sparkle (the classic App Store "plink")
    const o2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    o2.type = 'sine';
    o2.frequency.setValueAtTime(1046.5, t0 + 0.04); // C6
    g2.gain.setValueAtTime(0.0001, t0 + 0.04);
    g2.gain.exponentialRampToValueAtTime(0.11, t0 + 0.055);
    g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
    o2.connect(g2); g2.connect(ctx.destination);
    o2.start(t0 + 0.04); o2.stop(t0 + 0.38);
    // tiny harmonic shimmer
    const o3 = ctx.createOscillator();
    const g3 = ctx.createGain();
    o3.type = 'triangle';
    o3.frequency.setValueAtTime(1568, t0 + 0.06);
    g3.gain.setValueAtTime(0.0001, t0 + 0.06);
    g3.gain.exponentialRampToValueAtTime(0.04, t0 + 0.08);
    g3.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
    o3.connect(g3); g3.connect(ctx.destination);
    o3.start(t0 + 0.06); o3.stop(t0 + 0.25);
  },
  error() { _tone(200, 0.15, 'square', 0.06); setTimeout(() => _tone(150, 0.2, 'square', 0.05), 80); },
  tick() { _tone(1400, 0.025, 'square', 0.03); },
  whoosh() { _noise(0.2, 0.05); _tone(400, 0.25, 'sawtooth', 0.04, 80); }
};
window.SFX = SFX;
window.soundOn = () => soundOn;

function initSoundToggle() {
  const btn = document.getElementById('sound-toggle');
  if (!btn) return;
  btn.textContent = soundOn ? '🔊' : '🔇';
  btn.title = soundOn ? 'Звук вкл' : 'Звук выкл';
  btn.addEventListener('click', () => {
    soundOn = !soundOn;
    localStorage.setItem('casinoSound', soundOn ? '1' : '0');
    btn.textContent = soundOn ? '🔊' : '🔇';
    btn.title = soundOn ? 'Звук вкл' : 'Звук выкл';
    if (soundOn) { _audioCtx(); SFX.click(); }
    showToast(soundOn ? '🔊 Звук включён' : '🔇 Звук выключен');
  });
}

/* Confetti burst for wins */
function burstConfetti(count) {
  const n = count || 48;
  const layer = document.createElement('div');
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9998;overflow:hidden';
  document.body.appendChild(layer);
  const colors = ['#ffe08a', '#ff2e9a', '#00e5ff', '#d4af37', '#8a5cff', '#00ff88', '#fff'];
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    const x = 40 + Math.random() * 20;
    const size = 6 + Math.random() * 10;
    const rot = Math.random() * 720 - 360;
    const dx = (Math.random() - 0.5) * 280;
    const dy = 200 + Math.random() * 320;
    p.style.cssText = [
      'position:absolute', 'left:' + x + '%', 'top:42%',
      'width:' + size + 'px', 'height:' + (size * 0.6) + 'px',
      'background:' + colors[i % colors.length],
      'border-radius:2px',
      'opacity:1',
      'transform:translate(0,0) rotate(0deg)',
      'transition:transform 1.1s cubic-bezier(0.15,0.7,0.25,1), opacity 1.1s ease'
    ].join(';');
    layer.appendChild(p);
    requestAnimationFrame(() => {
      p.style.transform = 'translate(' + dx + 'px,' + dy + 'px) rotate(' + rot + 'deg)';
      p.style.opacity = '0';
    });
  }
  setTimeout(() => layer.remove(), 1300);
}
window.burstConfetti = burstConfetti;

// enhance showMemePopup to unlock meme ach
const _showMeme = typeof showMemePopup === 'function' ? showMemePopup : null;
if (_showMeme) {
  showMemePopup = function() {
    _showMeme();
    unlockAchievement('meme');
  };
}

document.addEventListener('DOMContentLoaded', () => {
  refreshVipLevel();
  checkAchievements();
  initLiveFeed();
  initSoundToggle();
});


/* ===== EXCLUSIVE_ULTRA_FX ===== */
(function exclusiveUltraFx() {
  // Click ripple on interactive elements
  document.addEventListener('click', function (e) {
    const el = e.target.closest('button, .chip, .game-card, .theme-tab, .toggle-btn, .primary-btn');
    if (!el || el.disabled) return;
    const rect = el.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'fx-ripple';
    const size = Math.max(rect.width, rect.height) * 1.6;
    ripple.style.cssText = [
      'position:absolute', 'border-radius:50%', 'pointer-events:none',
      'width:' + size + 'px', 'height:' + size + 'px',
      'left:' + (e.clientX - rect.left - size / 2) + 'px',
      'top:' + (e.clientY - rect.top - size / 2) + 'px',
      'background:radial-gradient(circle, rgba(255,224,138,0.45) 0%, transparent 70%)',
      'transform:scale(0)', 'opacity:1',
      'animation:fx-ripple-anim 0.55s ease-out forwards', 'z-index:20'
    ].join(';');
    const prev = getComputedStyle(el).position;
    if (prev === 'static') el.style.position = 'relative';
    el.style.overflow = 'hidden';
    el.appendChild(ripple);
    setTimeout(function () { ripple.remove(); }, 600);
  }, true);

  // Soft floating particles on home
  if (document.body.classList.contains('home-page')) {
    const layer = document.createElement('div');
    layer.id = 'fx-sparkles';
    layer.setAttribute('aria-hidden', 'true');
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:1;overflow:hidden';
    document.body.appendChild(layer);
    for (let i = 0; i < 28; i++) {
      const s = document.createElement('span');
      const size = 2 + Math.random() * 3;
      s.style.cssText = [
        'position:absolute', 'border-radius:50%',
        'width:' + size + 'px', 'height:' + size + 'px',
        'left:' + Math.random() * 100 + '%',
        'top:' + Math.random() * 100 + '%',
        'background:' + (Math.random() > 0.5 ? 'rgba(255,224,138,0.7)' : 'rgba(0,229,255,0.55)'),
        'box-shadow:0 0 ' + (4 + Math.random() * 8) + 'px currentColor',
        'animation:fx-float-sparkle ' + (6 + Math.random() * 10) + 's ease-in-out infinite',
        'animation-delay:' + (-Math.random() * 8) + 's',
        'opacity:0.6'
      ].join(';');
      layer.appendChild(s);
    }
  }
})();


/* SFX_CLICK_BIND — clicks, chips, soft hover */
(function bindSfxClicks() {
  document.addEventListener('click', function (e) {
    const el = e.target.closest('button, .chip, .theme-tab, .toggle-btn, .game-card, a.back-link, .paytable-btn');
    if (!el || el.id === 'sound-toggle') return;
    if (el.classList.contains('chip') || el.classList.contains('theme-tab')) SFX.chip();
    else SFX.click();
  }, true);
  document.addEventListener('mouseover', function (e) {
    const el = e.target.closest('.game-card, .chip, .primary-btn');
    if (!el || el._hov) return;
    el._hov = true;
    SFX.hover();
    setTimeout(() => { el._hov = false; }, 400);
  }, true);
})();

/* Signature FX: magnetic cursor orb + 3D card tilt (home) */
(function signatureFx() {
  // Cursor orb
  const orb = document.createElement('div');
  orb.id = 'cursor-orb';
  orb.setAttribute('aria-hidden', 'true');
  document.body.appendChild(orb);
  let mx = -100, my = -100, ox = -100, oy = -100;
  window.addEventListener('mousemove', (e) => { mx = e.clientX; my = e.clientY; });
  (function loop() {
    ox += (mx - ox) * 0.12;
    oy += (my - oy) * 0.12;
    orb.style.transform = 'translate(' + (ox - 14) + 'px,' + (oy - 14) + 'px)';
    requestAnimationFrame(loop);
  })();

  // 3D tilt on game cards
  document.querySelectorAll('.game-card, .game-card-pro').forEach((card) => {
    card.addEventListener('mousemove', (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = 'perspective(900px) rotateY(' + (x * 12) + 'deg) rotateX(' + (-y * 10) + 'deg) translateY(-8px) scale(1.03)';
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });

  // Aurora mesh canvas on home
  if (document.body.classList.contains('home-page')) {
    const c = document.createElement('canvas');
    c.id = 'aurora-canvas';
    c.setAttribute('aria-hidden', 'true');
    document.body.prepend(c);
    const ctx = c.getContext('2d');
    let w, h, t = 0;
    function resize() {
      w = c.width = window.innerWidth;
      h = c.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);
    function draw() {
      t += 0.004;
      ctx.clearRect(0, 0, w, h);
      const g = ctx.createRadialGradient(
        w * (0.5 + Math.sin(t) * 0.2), h * (0.3 + Math.cos(t * 0.7) * 0.15), 0,
        w * 0.5, h * 0.4, w * 0.55
      );
      g.addColorStop(0, 'rgba(255,46,154,0.07)');
      g.addColorStop(0.4, 'rgba(138,92,255,0.05)');
      g.addColorStop(0.7, 'rgba(0,229,255,0.04)');
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      const g2 = ctx.createRadialGradient(
        w * (0.3 + Math.cos(t * 0.9) * 0.25), h * (0.7 + Math.sin(t * 0.6) * 0.1), 0,
        w * 0.4, h * 0.7, w * 0.4
      );
      g2.addColorStop(0, 'rgba(212,175,55,0.06)');
      g2.addColorStop(1, 'transparent');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, w, h);
      requestAnimationFrame(draw);
    }
    draw();
  }
})();


/* ---- Auth modal UI ---- */
function ensureAuthUI() {
  if (document.getElementById('auth-modal')) return;
  const modal = document.createElement('div');
  modal.id = 'auth-modal';
  modal.className = 'auth-modal';
  modal.innerHTML = `
    <div class="auth-card" role="dialog" aria-modal="true">
      <button class="auth-close" id="auth-close" type="button">✕</button>
      <div class="auth-seal" aria-hidden="true">
        <svg viewBox="0 0 80 80" width="64" height="64">
          <defs>
            <linearGradient id="sealG" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#ffe08a"/>
              <stop offset="50%" stop-color="#ff2e9a"/>
              <stop offset="100%" stop-color="#00e5ff"/>
            </linearGradient>
          </defs>
          <polygon points="40,4 72,22 72,58 40,76 8,58 8,22" fill="none" stroke="url(#sealG)" stroke-width="2"/>
          <polygon points="40,16 60,28 60,52 40,64 20,52 20,28" fill="none" stroke="url(#sealG)" stroke-width="1.2" opacity="0.7"/>
          <circle cx="40" cy="40" r="8" fill="url(#sealG)" opacity="0.9"/>
        </svg>
      </div>
      <h2 class="auth-title" id="auth-title">Вход</h2>
      <p class="auth-sub" id="auth-sub">Аккаунты сохраняются в этом браузере</p>
      <div class="auth-tabs">
        <button type="button" class="auth-tab active" data-tab="login">Вход</button>
        <button type="button" class="auth-tab" data-tab="register">Регистрация</button>
      </div>
      <form id="auth-form" autocomplete="on">
        <label class="auth-field" id="auth-name-wrap" hidden>
          <span>Имя</span>
          <input type="text" id="auth-name" maxlength="24" placeholder="Как тебя звать">
        </label>
        <label class="auth-field">
          <span>Логин</span>
          <input type="text" id="auth-login" required minlength="3" maxlength="20" placeholder="login" autocomplete="username">
        </label>
        <label class="auth-field">
          <span>Пароль</span>
          <input type="password" id="auth-pass" required minlength="4" placeholder="••••" autocomplete="current-password">
        </label>
        <p class="auth-error" id="auth-error" hidden></p>
        <button type="submit" class="auth-submit primary-btn" id="auth-submit">Войти</button>
      </form>
      <p class="auth-hint">Демо-казино: пароли хранятся только локально в браузере</p>
    </div>
  `;
  document.body.appendChild(modal);

  let mode = 'login';
  const tabs = modal.querySelectorAll('.auth-tab');
  const nameWrap = modal.querySelector('#auth-name-wrap');
  const title = modal.querySelector('#auth-title');
  const sub = modal.querySelector('#auth-sub');
  const submit = modal.querySelector('#auth-submit');
  const err = modal.querySelector('#auth-error');

  function setMode(m) {
    mode = m;
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === m));
    nameWrap.hidden = m !== 'register';
    title.textContent = m === 'login' ? 'Вход' : 'Регистрация';
    sub.textContent = m === 'login' ? 'С возвращением в Потужне Казино' : 'Создай VIP-аккаунт за 5 секунд';
    submit.textContent = m === 'login' ? 'Войти' : 'Создать аккаунт';
    err.hidden = true;
    modal.querySelector('#auth-pass').autocomplete = m === 'login' ? 'current-password' : 'new-password';
  }
  tabs.forEach(t => t.addEventListener('click', () => setMode(t.dataset.tab)));
  modal.querySelector('#auth-close').addEventListener('click', () => modal.classList.remove('open'));
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('open'); });

  modal.querySelector('#auth-form').addEventListener('submit', (e) => {
    e.preventDefault();
    err.hidden = true;
    const login = modal.querySelector('#auth-login').value;
    const pass = modal.querySelector('#auth-pass').value;
    const name = modal.querySelector('#auth-name').value;
    const res = mode === 'login' ? loginAccount(login, pass) : registerAccount(login, pass, name);
    if (!res.ok) {
      err.textContent = res.err;
      err.hidden = false;
      try { SFX.error(); } catch(e) {}
      return;
    }
    try { SFX.deposit(); } catch(e) {}
    modal.classList.remove('open');
    showToast(mode === 'login' ? '✅ С возвращением, ' + (res.user.name || login) : '🎉 Аккаунт создан: ' + login);
    const k = balanceKeyFor(getSessionUser());
    balance = parseFloat(localStorage.getItem(k) || '1000');
    if (balanceEl) balanceEl.textContent = fmtMoney(balance, true);
    renderAuthButton();
    try { refreshVipLevel(); } catch(e) {}
    hideAuthLockOverlay();
    // On game page — reload so scripts see logged-in state cleanly
    if (document.querySelector('.game-shell') && !document.body.classList.contains('home-page')) {
      setTimeout(() => location.reload(), 400);
    }
  });
}

function openAuthModal(tab) {
  ensureAuthUI();
  const modal = document.getElementById('auth-modal');
  modal.classList.add('open');
  if (tab) {
    const btn = modal.querySelector('.auth-tab[data-tab="' + tab + '"]');
    if (btn) btn.click();
  }
  setTimeout(() => modal.querySelector('#auth-login')?.focus(), 50);
}

function renderAuthButton() {
  const right = document.querySelector('.topbar-right');
  if (!right) return;
  let box = document.getElementById('auth-user-box');
  if (!box) {
    box = document.createElement('div');
    box.id = 'auth-user-box';
    box.className = 'auth-user-box';
    const sound = document.getElementById('sound-toggle');
    if (sound) right.insertBefore(box, sound);
    else right.insertBefore(box, right.firstChild);
  }
  const user = currentAccount();
  if (user) {
    box.innerHTML = `
      <div class="auth-chip" title="Вы вошли">
        <span class="auth-avatar">${(user.name || user.login).slice(0,1).toUpperCase()}</span>
        <span class="auth-nick">${user.name || user.login}</span>
      </div>
      <button type="button" class="auth-logout icon-tool-btn" id="auth-logout" title="Выйти">🚪</button>
    `;
    box.querySelector('#auth-logout').onclick = () => {
      logoutAccount();
      balance = parseFloat(localStorage.getItem(balanceKeyFor(null)) || '1000');
      if (balanceEl) balanceEl.textContent = fmtMoney(balance, true);
      showToast('Вы вышли из аккаунта');
      renderAuthButton();
      try { SFX.click(); } catch(e) {}
    };
  } else {
    box.innerHTML = `
      <button type="button" class="auth-open-btn" id="auth-open-login">Вход</button>
      <button type="button" class="auth-open-btn auth-open-reg" id="auth-open-reg">Регистрация</button>
    `;
    box.querySelector('#auth-open-login').onclick = () => openAuthModal('login');
    box.querySelector('#auth-open-reg').onclick = () => openAuthModal('register');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  ensureAuthUI();
  renderAuthButton();
});

/* =========================================================
   PREMIUM ULTRA MODULE v4 — "SHOCK FEATURES"
   Withdrawal, missions, promo, stats, konami, whale alerts,
   money rain, screen shake, neural predictor, loyalty
   ========================================================= */

// ---------- Transaction History ----------
function getTxHistory() {
  try { return JSON.parse(localStorage.getItem('casinoTx_' + (getSessionUser() || 'guest')) || '[]'); } catch { return []; }
}
function pushTx(type, amount, meta) {
  const list = getTxHistory();
  list.unshift({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    type, // deposit | withdraw | win | bet | bonus | promo
    amount,
    meta: meta || '',
    ts: Date.now()
  });
  if (list.length > 80) list.length = 80;
  localStorage.setItem('casinoTx_' + (getSessionUser() || 'guest'), JSON.stringify(list));
}

// ---------- Loyalty / Cashback points ----------
function getLoyalty() {
  return parseInt(localStorage.getItem('casinoLoyalty_' + (getSessionUser() || 'guest')) || '0');
}
function addLoyalty(pts) {
  const n = getLoyalty() + pts;
  localStorage.setItem('casinoLoyalty_' + (getSessionUser() || 'guest'), String(n));
  return n;
}

// ---------- Daily Missions ----------
const MISSIONS = [
  { id: 'spin5', title: '5 спинов в слотах', target: 5, reward: 150, key: 'm_spin' },
  { id: 'win3', title: '3 выигрыша подряд', target: 3, reward: 200, key: 'm_win' },
  { id: 'bet500', title: 'Суммарно поставить $500', target: 500, reward: 250, key: 'm_bet' },
  { id: 'crash', title: 'Кэшаут в Літачку ≥ 3x', target: 1, reward: 180, key: 'm_crash' },
  { id: 'bj', title: 'Выиграть в БлэкДжек', target: 1, reward: 120, key: 'm_bj' }
];

function getMissionProgress() {
  try { return JSON.parse(localStorage.getItem('casinoMissions_' + (getSessionUser() || 'guest')) || '{}'); } catch { return {}; }
}
function saveMissionProgress(p) {
  localStorage.setItem('casinoMissions_' + (getSessionUser() || 'guest'), JSON.stringify(p));
}
function trackMission(key, add) {
  const p = getMissionProgress();
  const day = new Date().toDateString();
  if (p.day !== day) { Object.keys(p).forEach(k => { if (k !== 'claimed') delete p[k]; }); p.day = day; p.claimed = p.claimed || {}; }
  p[key] = (p[key] || 0) + (add || 1);
  saveMissionProgress(p);
  checkMissionsComplete();
}
function checkMissionsComplete() {
  const p = getMissionProgress();
  MISSIONS.forEach(m => {
    if ((p[m.key] || 0) >= m.target && !p.claimed?.[m.id]) {
      showToast('🎯 Миссия выполнена: ' + m.title + ' → +$' + m.reward);
    }
  });
}

// ---------- Promo Codes ----------
const PROMO_CODES = {
  'ЗЕЛЕБОБА': 777,
  'ПОТУЖНО': 500,
  'ПЕРЕМОГА': 1000,
  'VIP2026': 1500,
  'АГРАРКА': 300,
  'SHOCK': 2500
};
function tryPromo(code) {
  code = (code || '').trim().toUpperCase();
  if (!PROMO_CODES[code]) return { ok: false, err: 'Код не найден' };
  const used = JSON.parse(localStorage.getItem('casinoPromoUsed_' + (getSessionUser() || 'guest')) || '[]');
  if (used.includes(code)) return { ok: false, err: 'Код уже использован' };
  used.push(code);
  localStorage.setItem('casinoPromoUsed_' + (getSessionUser() || 'guest'), JSON.stringify(used));
  const amount = PROMO_CODES[code];
  updateBalance(amount);
  pushTx('promo', amount, code);
  addLoyalty(50);
  return { ok: true, amount };
}

// ---------- Withdrawal System (visual only) ----------
function initWithdraw() {
  const topRight = document.querySelector('.topbar-right');
  if (!topRight || document.getElementById('withdraw-btn')) return;

  const wBtn = document.createElement('button');
  wBtn.id = 'withdraw-btn';
  wBtn.className = 'withdraw-btn';
  wBtn.innerHTML = '💸 Вывести';
  const dep = topRight.querySelector('#deposit-btn');
  if (dep) topRight.insertBefore(wBtn, dep);
  else topRight.insertBefore(wBtn, topRight.firstChild);

  wBtn.addEventListener('click', () => {
    if (!requireAuth('⚠️ Войди, чтобы вывести средства')) return;
    openWithdrawModal();
  });
}

function openWithdrawModal() {
  let modal = document.getElementById('withdraw-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'withdraw-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-box withdraw-box">
        <button class="auth-close" id="wd-close">✕</button>
        <h3>💸 Вывод средств</h3>
        <p class="wd-sub">Демо-режим: деньги визуально списываются, но в реале никуда не уходят</p>
        
        <div class="dep-method-tabs" id="wd-method-tabs">
          <div class="dep-method-tab active" data-method="card">💳 Карта</div>
          <div class="dep-method-tab" data-method="crypto">₿ Крипто</div>
          <div class="dep-method-tab" data-method="bank">🏦 Банк</div>
        </div>

        <div id="wd-form-card">
          <div class="dep-card-preview wd-card-preview">
            <div class="dep-card-chip"></div>
            <div class="dep-card-num" id="wd-card-num-preview">•••• •••• •••• ••••</div>
            <div class="dep-card-bottom">
              <span id="wd-card-holder-preview">CARD HOLDER</span>
              <span class="dep-card-brand">VISA</span>
            </div>
          </div>
          <div class="dep-field">
            <label>Номер карты</label>
            <input type="text" id="wd-card-number" maxlength="19" placeholder="4000 0000 0000 0000" inputmode="numeric">
          </div>
          <div class="dep-field-row">
            <div class="dep-field">
              <label>Срок</label>
              <input type="text" id="wd-card-expiry" maxlength="5" placeholder="ММ/ГГ">
            </div>
            <div class="dep-field">
              <label>CVV</label>
              <input type="text" id="wd-card-cvv" maxlength="4" placeholder="•••" inputmode="numeric">
            </div>
          </div>
          <div class="dep-field">
            <label>Имя держателя</label>
            <input type="text" id="wd-card-name" placeholder="IVAN IVANOV" maxlength="40">
          </div>
        </div>

        <div id="wd-form-crypto" hidden>
          <div class="dep-field">
            <label>Сеть</label>
            <select id="wd-crypto-net" style="width:100%;padding:12px;border-radius:12px;background:rgba(0,0,0,.35);border:1px solid var(--line);color:var(--text);">
              <option>USDT TRC20</option>
              <option>USDT ERC20</option>
              <option>BTC</option>
              <option>ETH</option>
            </select>
          </div>
          <div class="dep-field">
            <label>Адрес кошелька</label>
            <input type="text" id="wd-crypto-addr" placeholder="TXyz... или 0x...">
          </div>
        </div>

        <div id="wd-form-bank" hidden>
          <div class="dep-field">
            <label>IBAN / Счёт</label>
            <input type="text" id="wd-bank-iban" placeholder="UA00 0000 0000 0000">
          </div>
          <div class="dep-field">
            <label>ФИО получателя</label>
            <input type="text" id="wd-bank-name" placeholder="Иванов Иван">
          </div>
        </div>

        <div class="dep-field" style="margin-top:14px;">
          <label>Сумма вывода ($)</label>
          <input type="number" id="wd-amount" min="10" step="1" placeholder="100">
        </div>
        <div class="wd-quick-amounts">
          <button type="button" data-a="50">$50</button>
          <button type="button" data-a="100">$100</button>
          <button type="button" data-a="250">$250</button>
          <button type="button" data-a="500">$500</button>
          <button type="button" data-a="all">Всё</button>
        </div>

        <p class="auth-error" id="wd-error" hidden></p>
        <button class="primary-btn wd-submit" id="wd-submit">Вывести средства</button>
        <p class="auth-hint">Обработка 1–3 рабочих дня · Комиссия 0% в демо</p>
      </div>
    `;
    document.body.appendChild(modal);

    // method tabs
    modal.querySelectorAll('#wd-method-tabs .dep-method-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        modal.querySelectorAll('#wd-method-tabs .dep-method-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const m = tab.dataset.method;
        modal.querySelector('#wd-form-card').hidden = m !== 'card';
        modal.querySelector('#wd-form-crypto').hidden = m !== 'crypto';
        modal.querySelector('#wd-form-bank').hidden = m !== 'bank';
      });
    });

    // card preview live
    const numIn = modal.querySelector('#wd-card-number');
    numIn?.addEventListener('input', () => {
      let v = numIn.value.replace(/\D/g, '').slice(0, 16);
      numIn.value = v.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
      const prev = modal.querySelector('#wd-card-num-preview');
      if (prev) prev.textContent = (numIn.value || '•••• •••• •••• ••••').padEnd(19, '•');
    });
    modal.querySelector('#wd-card-name')?.addEventListener('input', (e) => {
      const prev = modal.querySelector('#wd-card-holder-preview');
      if (prev) prev.textContent = (e.target.value || 'CARD HOLDER').toUpperCase();
    });
    modal.querySelector('#wd-card-expiry')?.addEventListener('input', (e) => {
      let v = e.target.value.replace(/\D/g, '').slice(0, 4);
      if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2);
      e.target.value = v;
    });

    modal.querySelectorAll('.wd-quick-amounts button').forEach(b => {
      b.addEventListener('click', () => {
        const a = b.dataset.a;
        const inp = modal.querySelector('#wd-amount');
        if (a === 'all') inp.value = Math.floor(balance);
        else inp.value = a;
      });
    });

    modal.querySelector('#wd-close').onclick = () => modal.classList.remove('open');
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('open'); });

    modal.querySelector('#wd-submit').addEventListener('click', () => processWithdraw(modal));
  }
  modal.classList.add('open');
  modal.querySelector('#wd-amount').value = '';
  modal.querySelector('#wd-error').hidden = true;
}

function processWithdraw(modal) {
  const err = modal.querySelector('#wd-error');
  err.hidden = true;
  const amount = Math.floor(parseFloat(modal.querySelector('#wd-amount').value) || 0);
  if (amount < 10) { err.textContent = 'Минимум $10'; err.hidden = false; return; }
  if (amount > balance) { err.textContent = 'Недостаточно средств'; err.hidden = false; return; }

  const method = modal.querySelector('#wd-method-tabs .active')?.dataset.method || 'card';
  if (method === 'card') {
    const num = (modal.querySelector('#wd-card-number').value || '').replace(/\s/g, '');
    const exp = modal.querySelector('#wd-card-expiry').value;
    const cvv = modal.querySelector('#wd-card-cvv').value;
    const name = modal.querySelector('#wd-card-name').value.trim();
    if (num.length < 15 || !exp || cvv.length < 3 || name.length < 3) {
      err.textContent = 'Заполни все поля карты корректно'; err.hidden = false; return;
    }
  } else if (method === 'crypto') {
    if ((modal.querySelector('#wd-crypto-addr').value || '').length < 10) {
      err.textContent = 'Укажи корректный адрес кошелька'; err.hidden = false; return;
    }
  } else {
    if ((modal.querySelector('#wd-bank-iban').value || '').length < 8) {
      err.textContent = 'Укажи IBAN / счёт'; err.hidden = false; return;
    }
  }

  // visual processing
  const btn = modal.querySelector('#wd-submit');
  btn.disabled = true;
  btn.textContent = '⏳ Проверка 3D-Secure...';
  try { SFX.tick(); } catch(e) {}

  setTimeout(() => {
    btn.textContent = '🔐 Подтверждение банка...';
    setTimeout(() => {
      btn.textContent = '📤 Отправка...';
      setTimeout(() => {
        window.__skipLossRecord = true;
        updateBalance(-amount);
        window.__skipLossRecord = false;
        pushTx('withdraw', -amount, method);
        addLoyalty(Math.floor(amount / 20));
        modal.classList.remove('open');
        btn.disabled = false;
        btn.textContent = 'Вывести средства';
        try { SFX.appStore(); } catch(e) {}
        showWinOverlay('Вывод принят ✓', `$${amount} отправлено · 1–3 дня (демо)`);
        showToast('💸 Заявка на вывод $' + amount + ' создана');
        // save to pending
        const pend = JSON.parse(localStorage.getItem('casinoPendingWd') || '[]');
        pend.unshift({ amount, method, ts: Date.now(), status: 'processing' });
        localStorage.setItem('casinoPendingWd', JSON.stringify(pend.slice(0, 20)));
      }, 900);
    }, 1100);
  }, 1000);
}

// ---------- Stats & Personal Cabinet ----------
function openCabinet() {
  if (!requireAuth()) return;
  let modal = document.getElementById('cabinet-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'cabinet-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-box cabinet-box">
        <button class="auth-close" id="cab-close">✕</button>
        <h3>👤 Личный кабинет</h3>
        <div class="cab-tabs">
          <button class="cab-tab active" data-tab="stats">📊 Статистика</button>
          <button class="cab-tab" data-tab="tx">📜 История</button>
          <button class="cab-tab" data-tab="missions">🎯 Миссии</button>
          <button class="cab-tab" data-tab="promo">🏷 Промокод</button>
        </div>
        <div id="cab-content"></div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('#cab-close').onclick = () => modal.classList.remove('open');
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });
    modal.querySelectorAll('.cab-tab').forEach(t => {
      t.addEventListener('click', () => {
        modal.querySelectorAll('.cab-tab').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        renderCabinetTab(t.dataset.tab);
      });
    });
  }
  modal.classList.add('open');
  renderCabinetTab('stats');
}

function renderCabinetTab(tab) {
  const box = document.getElementById('cab-content');
  if (!box) return;
  if (tab === 'stats') {
    const rounds = parseInt(localStorage.getItem('casinoRounds') || '0');
    const st = (typeof loadStats === 'function') ? loadStats() : { deposited:0, won:0, lost:0, winCount:0, lossCount:0, biggestWin:0, games:{} };
    const biggest = st.biggestWin || parseFloat(localStorage.getItem('casinoBiggestWin') || '0') || 0;
    const loyalty = getLoyalty();
    const net = st.won - st.lost;
    const netCol = net >= 0 ? 'var(--green)' : 'var(--red)';
    const labels = (typeof GAME_LABELS !== 'undefined') ? GAME_LABELS : {};
    const gameRows = Object.keys(st.games || {}).filter(k => k !== 'lobby').sort((a,b) => {
      const sa = (st.games[a].won||0) + (st.games[a].lost||0);
      const sb = (st.games[b].won||0) + (st.games[b].lost||0);
      return sb - sa;
    }).map(id => {
      const g = st.games[id];
      const name = labels[id] || id;
      return `<div class="game-stat-row">
        <span class="gs-name">${name}</span>
        <span class="gs-w">+${fmtMoney(g.won||0)} <small>(${g.wins||0})</small></span>
        <span class="gs-l">−${fmtMoney(g.lost||0)} <small>(${g.losses||0})</small></span>
      </div>`;
    }).join('') || '<p style="color:var(--text-dimmer);text-align:center;font-size:13px;">Пока нет игровой активности</p>';

    box.innerHTML = `
      <div class="cab-stats-grid">
        <div class="cab-stat"><span class="n">${fmtMoney(st.deposited)}</span><span class="l">Пополнено</span></div>
        <div class="cab-stat"><span class="n">${fmtMoney(biggest)}</span><span class="l">Макс. выигрыш</span></div>
        <div class="cab-stat"><span class="n" style="color:var(--green)">${fmtMoney(st.won)}</span><span class="l">Всего выиграно</span></div>
        <div class="cab-stat"><span class="n" style="color:var(--red)">${fmtMoney(st.lost)}</span><span class="l">Всего проиграно</span></div>
        <div class="cab-stat"><span class="n">${st.winCount}</span><span class="l">Выигрышей</span></div>
        <div class="cab-stat"><span class="n">${st.lossCount}</span><span class="l">Ставок / проигрышей</span></div>
        <div class="cab-stat"><span class="n" style="color:${netCol}">${net>=0?'+':''}${fmtMoney(net)}</span><span class="l">Чистый результат</span></div>
        <div class="cab-stat"><span class="n">${rounds}</span><span class="l">Раундов</span></div>
        <div class="cab-stat"><span class="n">${loyalty}</span><span class="l">Лояльность</span></div>
        <div class="cab-stat"><span class="n">${fmtMoney(balance)}</span><span class="l">Баланс</span></div>
      </div>
      <h4 class="cab-games-title">📊 Статистика по играм</h4>
      <div class="game-stats-list">
        <div class="game-stat-row gs-head"><span>Игра</span><span>Выигрыши</span><span>Проигрыши</span></div>
        ${gameRows}
      </div>
      <p style="color:var(--text-dim);font-size:13px;margin-top:16px;">VIP и кэшбэк растут от активности. 100 очков = $5 кэшбэка.</p>
      <button class="secondary-btn" id="cab-cashback" style="margin-top:12px;">Получить кэшбэк (${Math.floor(loyalty/100)*5}$)</button>
    `;
    box.querySelector('#cab-cashback')?.addEventListener('click', () => {
      const pts = getLoyalty();
      const cash = Math.floor(pts / 100) * 5;
      if (cash < 5) { showToast('Нужно минимум 100 очков'); return; }
      window.__skipLossRecord = true;
      updateBalance(cash);
      window.__skipLossRecord = false;
      localStorage.setItem('casinoLoyalty_' + (getSessionUser() || 'guest'), String(pts % 100));
      pushTx('bonus', cash, 'cashback');
      showToast('💎 Кэшбэк +$' + cash);
      renderCabinetTab('stats');
    });
  } else if (tab === 'tx') {
    const list = getTxHistory();
    if (!list.length) { box.innerHTML = '<p style="color:var(--text-dim);text-align:center;">Пока пусто</p>'; return; }
    box.innerHTML = '<div class="tx-list">' + list.slice(0, 25).map(t => {
      const sign = t.amount >= 0 ? '+' : '';
      const col = t.amount >= 0 ? 'var(--green)' : 'var(--red)';
      const date = new Date(t.ts).toLocaleString('ru-RU', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
      return `<div class="tx-row"><span class="tx-type">${t.type}</span><span class="tx-meta">${t.meta||''}</span><span class="tx-amt" style="color:${col}">${sign}${fmtMoney(Math.abs(t.amount))}</span><span class="tx-date">${date}</span></div>`;
    }).join('') + '</div>';
  } else if (tab === 'missions') {
    const p = getMissionProgress();
    box.innerHTML = MISSIONS.map(m => {
      const cur = p[m.key] || 0;
      const done = cur >= m.target;
      const claimed = p.claimed?.[m.id];
      const pct = Math.min(100, Math.round(cur / m.target * 100));
      return `<div class="mission-card ${done ? 'done' : ''}">
        <div class="mission-top"><strong>${m.title}</strong><span>${done && !claimed ? '✅' : claimed ? '🎁' : cur + '/' + m.target}</span></div>
        <div class="mission-bar"><div style="width:${pct}%"></div></div>
        <div class="mission-bot"><span>+$${m.reward}</span>
          ${done && !claimed ? `<button class="primary-btn mini" data-claim="${m.id}">Забрать</button>` : ''}
        </div>
      </div>`;
    }).join('');
    box.querySelectorAll('[data-claim]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.claim;
        const m = MISSIONS.find(x => x.id === id);
        if (!m) return;
        const prog = getMissionProgress();
        prog.claimed = prog.claimed || {};
        if (prog.claimed[id]) return;
        prog.claimed[id] = true;
        saveMissionProgress(prog);
        updateBalance(m.reward);
        pushTx('bonus', m.reward, 'mission:' + id);
        showToast('🎯 +$' + m.reward + ' за миссию');
        renderCabinetTab('missions');
      });
    });
  } else if (tab === 'promo') {
    box.innerHTML = `
      <div class="dep-field">
        <label>Промокод</label>
        <input type="text" id="promo-input" placeholder="ЗЕЛЕБОБА / ПОТУЖНО / SHOCK..." style="text-transform:uppercase">
      </div>
      <button class="primary-btn" id="promo-apply">Активировать</button>
      <p id="promo-msg" style="margin-top:12px;font-size:13px;"></p>
    `;
    box.querySelector('#promo-apply').onclick = () => {
      const res = tryPromo(box.querySelector('#promo-input').value);
      const msg = box.querySelector('#promo-msg');
      if (res.ok) {
        msg.style.color = 'var(--green)';
        msg.textContent = '🎉 +$' + res.amount + ' зачислено!';
        try { SFX.bigWin(); } catch(e) {}
      } else {
        msg.style.color = 'var(--red)';
        msg.textContent = res.err;
      }
    };
  }
}

// ---------- Konami Code Easter Egg ----------
(function konamiEgg() {
  const seq = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  let idx = 0;
  window.addEventListener('keydown', (e) => {
    if (e.key === seq[idx]) {
      idx++;
      if (idx === seq.length) {
        idx = 0;
        updateBalance(5000);
        pushTx('bonus', 5000, 'KONAMI');
        document.body.classList.add('konami-mode');
        showWinOverlay('🕹 KONAMI CODE', '+$5,000 · Секретный режим активирован');
        moneyRain(120);
        setTimeout(() => document.body.classList.remove('konami-mode'), 15000);
      }
    } else idx = 0;
  });
})();

// ---------- Money Rain + Screen Shake ----------
function moneyRain(count) {
  const n = count || 60;
  const layer = document.createElement('div');
  layer.className = 'money-rain-layer';
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9997;overflow:hidden';
  document.body.appendChild(layer);
  const symbols = ['💵','💰','💎','🪙','💸','🤑'];
  for (let i = 0; i < n; i++) {
    const el = document.createElement('span');
    el.textContent = symbols[i % symbols.length];
    el.style.cssText = [
      'position:absolute', 'left:' + Math.random()*100 + '%', 'top:-40px',
      'font-size:' + (18 + Math.random()*22) + 'px',
      'animation:money-fall ' + (1.8 + Math.random()*2.2) + 's linear forwards',
      'animation-delay:' + (Math.random()*0.8) + 's',
      'opacity:0.95'
    ].join(';');
    layer.appendChild(el);
  }
  setTimeout(() => layer.remove(), 4500);
}

function screenShake(intensity) {
  const i = intensity || 6;
  document.body.style.transition = 'none';
  let frames = 12;
  function tick() {
    if (frames-- <= 0) { document.body.style.transform = ''; return; }
    document.body.style.transform = `translate(${(Math.random()-0.5)*i}px,${(Math.random()-0.5)*i}px)`;
    requestAnimationFrame(tick);
  }
  tick();
}

// enhance showWinOverlay — FX + solid biggest-win tracking
const _origShowWin = showWinOverlay;
showWinOverlay = function(title, sub) {
  _origShowWin(title, sub);
  const t = (title || '').toLowerCase();
  const s = sub || '';
  // parse money from subtitle: +$1,234 or $1234.50 etc.
  let val = 0;
  const m = s.replace(/\s/g, '').match(/\+?\$?([\d,]+(?:\.\d+)?)/);
  if (m) val = parseFloat(m[1].replace(/,/g, '')) || 0;
  if (!val) {
    const m2 = (title || '').replace(/\s/g, '').match(/\$?([\d,]+(?:\.\d+)?)/);
    if (m2) val = parseFloat(m2[1].replace(/,/g, '')) || 0;
  }
  if (val > 0) {
    try { recordWin(val); } catch(e) {}
  }
  if (t.includes('джекпот') || t.includes('мега') || t.includes('банк') || t.includes('konami')) {
    moneyRain(90);
    screenShake(10);
  } else if (val >= 300) {
    moneyRain(40);
    screenShake(4);
  }
  localStorage.setItem('casinoRounds', String(parseInt(localStorage.getItem('casinoRounds') || '0') + 1));
  try { trackMission('m_win', 1); } catch(e) {}
};

// ---------- Whale Alerts ----------
const WHALE_NAMES = ['CryptoKing','Зелебоба_Pro','VIP_Anna','Дилер_Макс','Потужный_Х','LuckyMia','АграркаBoss','NeonWhale'];
const WHALE_GAMES = ['Слотики','Літачок','Рулетка','Міни','Колесо','БлэкДжек'];
function spawnWhaleAlert() {
  if (Math.random() > 0.4) return;
  const name = WHALE_NAMES[Math.floor(Math.random()*WHALE_NAMES.length)];
  const game = WHALE_GAMES[Math.floor(Math.random()*WHALE_GAMES.length)];
  const win = [500, 1200, 2500, 8000, 15000, 42000][Math.floor(Math.random()*6)];
  const el = document.createElement('div');
  el.className = 'whale-alert';
  el.innerHTML = `<span class="whale-icon">🐋</span> <b>${name}</b> сорвал <b style="color:var(--gold-bright)">${fmtMoney(win)}</b> в «${game}»`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 500); }, 4500);
}
setInterval(spawnWhaleAlert, 28000 + Math.random()*20000);

// ---------- Neural Predictor (slots page only) ----------
function injectNeuralPredictor() {
  if (!document.getElementById('spin-btn')) return;
  if (document.getElementById('neural-box')) return;
  const panel = document.querySelector('.game-panel');
  if (!panel) return;
  const box = document.createElement('div');
  box.id = 'neural-box';
  box.className = 'neural-box';
  box.innerHTML = `
    <div class="neural-title">🧠 Neural Edge <span class="neural-live">LIVE</span></div>
    <div class="neural-bar"><div id="neural-fill"></div></div>
    <div class="neural-label" id="neural-label">Анализ паттернов RNG...</div>
  `;
  panel.insertBefore(box, panel.querySelector('.bet-display') || panel.lastChild);
  function refreshNeural() {
    const chance = 12 + Math.floor(Math.random() * 38);
    const fill = document.getElementById('neural-fill');
    const lab = document.getElementById('neural-label');
    if (fill) fill.style.width = chance + '%';
    if (lab) lab.textContent = chance > 35 ? 'Высокая вероятность тройки' : chance > 22 ? 'Нейтральный паттерн' : 'Холодный стрик';
  }
  refreshNeural();
  setInterval(refreshNeural, 4000);
  document.getElementById('spin-btn')?.addEventListener('click', () => setTimeout(refreshNeural, 3000));
}

// ---------- Cabinet + Withdraw buttons on load ----------
document.addEventListener('DOMContentLoaded', () => {
  initWithdraw();
  // cabinet button
  const right = document.querySelector('.topbar-right');
  if (right && !document.getElementById('cabinet-btn')) {
    const cBtn = document.createElement('button');
    cBtn.id = 'cabinet-btn';
    cBtn.className = 'icon-tool-btn';
    cBtn.title = 'Кабинет';
    cBtn.textContent = '👤';
    cBtn.addEventListener('click', openCabinet);
    const sound = document.getElementById('sound-toggle');
    if (sound) right.insertBefore(cBtn, sound);
    else right.appendChild(cBtn);
  }
  injectNeuralPredictor();
  // track bets for missions (global)
  const _ub = updateBalance;
  window.updateBalance = function(amount) {
    _ub(amount);
    if (amount < 0) trackMission('m_bet', Math.abs(amount));
  };
});

// track aviator cashout for mission
const _origCashoutToast = typeof showToast === 'function' ? showToast : null;
// already handled via showWinOverlay mostly

console.log('%c🌾 Аграрка Элит PRO — Shock Features loaded', 'color:#d4af37;font-weight:bold;font-size:14px');

/* =========================================================
   UNLIMITED BETS + MORE REAL-CASINO FEATURES v5
   ========================================================= */

// MAX / high-roller chip handling (works across all games)
document.addEventListener('click', function(e) {
  const chip = e.target.closest('.chip');
  if (!chip || !chip.closest('#chip-row, .chip-row')) return;
  const raw = chip.dataset.bet;
  if (raw !== 'max' && raw !== 'MAX') return;
  e.stopImmediatePropagation();
  e.preventDefault();
  const amt = Math.max(1, Math.floor(typeof balance === 'number' ? balance : 0));
  document.querySelectorAll('#chip-row .chip, .chip-row .chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  // update known globals / UI
  try {
    if (typeof currentBet !== 'undefined') {
      // can't assign lexical let from outside; use window bridge
    }
  } catch(_) {}
  // Prefer calling setBetAmount if exists (aviator)
  if (typeof setBetAmount === 'function') setBetAmount(amt);
  // custom input + apply pattern
  const input = document.getElementById('custom-bet-input');
  const apply = document.getElementById('custom-bet-apply');
  if (input) {
    input.value = String(amt);
    if (apply) apply.click();
    else {
      // fallback: fire input event and update displays
      input.dispatchEvent(new Event('change'));
      const displays = document.querySelectorAll('#current-bet, #bet-amount, .bet-display .val, #bet-value');
      displays.forEach(el => { if (el) el.textContent = (typeof fmtMoney === 'function' ? fmtMoney(amt) : '$' + amt); });
    }
  } else {
    const displays = document.querySelectorAll('#current-bet, #bet-amount, .bet-display .val, #bet-value');
    displays.forEach(el => { if (el) el.textContent = (typeof fmtMoney === 'function' ? fmtMoney(amt) : '$' + amt); });
  }
  // roulette chipSize
  try { if (typeof chipSize !== 'undefined') { window.__forceChipSize = amt; } } catch(_) {}
  showToast('🔥 MAX ставка: ' + (typeof fmtMoney === 'function' ? fmtMoney(amt) : amt));
  try { SFX.chip(); } catch(_) {}
}, true);

// After normal chip clicks for high values, ensure no artificial caps on apply
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('custom-bet-input');
  if (input) {
    input.removeAttribute('max');
    input.setAttribute('min', '1');
    input.placeholder = 'любая сумма';
  }
});

// ---------- Tip the Dealer ----------
function initTipDealer() {
  if (document.getElementById('tip-dealer-btn')) return;
  const panel = document.querySelector('.game-panel, .panel, main .controls');
  if (!panel) return;
  const btn = document.createElement('button');
  btn.id = 'tip-dealer-btn';
  btn.className = 'tip-dealer-btn';
  btn.type = 'button';
  btn.innerHTML = '🎩 Чаевые дилеру';
  btn.addEventListener('click', () => {
    if (!requireAuth()) return;
    const tips = [10, 25, 50, 100, 250];
    const tip = tips[Math.floor(Math.random() * tips.length)];
    if (balance < tip) { showToast('Недостаточно для чаевых'); return; }
    window.__skipLossRecord = true;
    updateBalance(-tip);
    window.__skipLossRecord = false;
    pushTx('tip', -tip, 'dealer');
    addLoyalty(5);
    showToast('🎩 Дилер благодарит: +' + tip + '$ репутации');
    try { SFX.appStore(); } catch(_) {}
    // floating hearts
    for (let i = 0; i < 6; i++) {
      const h = document.createElement('span');
      h.textContent = ['💖','🙏','✨','💎'][i % 4];
      h.style.cssText = `position:fixed;left:${40+Math.random()*20}%;bottom:20%;font-size:22px;z-index:9999;pointer-events:none;animation:tip-float 1.6s ease-out forwards;animation-delay:${i*0.08}s`;
      document.body.appendChild(h);
      setTimeout(() => h.remove(), 1800);
    }
  });
  panel.appendChild(btn);
}

// ---------- Session clock + High Roller mode ----------
function initSessionChrome() {
  if (document.getElementById('session-clock')) return;
  const top = document.querySelector('.topbar-right');
  if (!top) return;
  const clock = document.createElement('div');
  clock.id = 'session-clock';
  clock.className = 'session-clock';
  clock.title = 'Время сессии';
  const start = Date.now();
  function tick() {
    const s = Math.floor((Date.now() - start) / 1000);
    const m = String(Math.floor(s / 60)).padStart(2, '0');
    const sec = String(s % 60).padStart(2, '0');
    clock.textContent = '⏱ ' + m + ':' + sec;
  }
  tick();
  setInterval(tick, 1000);
  top.insertBefore(clock, top.firstChild);

  function checkHighRoller() {
    if (typeof balance === 'number' && balance >= 10000) {
      document.body.classList.add('high-roller');
    } else {
      document.body.classList.remove('high-roller');
    }
  }
  checkHighRoller();
  // poll balance class
  setInterval(checkHighRoller, 2000);
}

// ---------- Double or Nothing after big win ----------
let _lastWinAmount = 0;
const _prevShowWin = showWinOverlay;
showWinOverlay = function(title, sub) {
  _prevShowWin(title, sub);
  const m = (sub || '').match(/[\d,.]+/);
  if (m) {
    const val = parseFloat(m[0].replace(/,/g, ''));
    if (val >= 50) {
      _lastWinAmount = val;
      setTimeout(() => offerDoubleOrNothing(val), 1200);
    }
  }
};

function offerDoubleOrNothing(amount) {
  if (document.getElementById('don-modal')) return;
  const modal = document.createElement('div');
  modal.id = 'don-modal';
  modal.className = 'modal-overlay open';
  modal.innerHTML = `
    <div class="modal-box don-box">
      <h3>🎲 Double or Nothing?</h3>
      <p>Рискни выигрышем <b style="color:var(--gold-bright)">${fmtMoney(amount)}</b></p>
      <p class="wd-sub">50/50 · либо ×2, либо сгорает</p>
      <div style="display:flex;gap:12px;margin-top:18px;">
        <button class="primary-btn" id="don-yes" style="flex:1">Удвоить</button>
        <button class="secondary-btn" id="don-no" style="flex:1">Забрать</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector('#don-no').onclick = close;
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  modal.querySelector('#don-yes').onclick = () => {
    close();
    const win = Math.random() < 0.48;
    if (win) {
      window.__skipLossRecord = true;
      updateBalance(amount);
      window.__skipLossRecord = false;
      pushTx('win', amount, 'double-or-nothing');
      try { recordWin(amount, currentGameId()); } catch(e) {}
      // overlay without re-parsing huge number as new "max" incorrectly via 2x text
      showWinOverlay('🔥 DOUBLE!', '+' + fmtMoney(amount));
      moneyRain(50);
      try { playPizdatyJingle(5000); } catch(_) {}
      try { SFX.bigWin(); } catch(_) {}
    } else {
      window.__skipLossRecord = true;
      updateBalance(-amount);
      window.__skipLossRecord = false;
      pushTx('bet', -amount, 'double-or-nothing-loss');
      try { recordLoss(amount, currentGameId()); } catch(e) {}
      showToast('💀 Nothing... выигрыш сгорел');
      try { SFX.lose(); } catch(_) {}
    }
  };
}

// ---------- Provably Fair seed badge ----------
function initFairBadge() {
  if (document.getElementById('fair-badge')) return;
  const panel = document.querySelector('.game-panel');
  if (!panel) return;
  const seed = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const badge = document.createElement('div');
  badge.id = 'fair-badge';
  badge.className = 'fair-badge';
  badge.innerHTML = `🔐 Provably Fair · seed <code>${seed}</code>`;
  badge.title = 'Демо-проверка честности (визуально)';
  panel.appendChild(badge);
}

// ---------- Hot / Cold game indicator on index ----------
function initHotCold() {
  document.querySelectorAll('.game-card').forEach((card, i) => {
    if (card.querySelector('.hot-cold')) return;
    const tag = document.createElement('div');
    tag.className = 'hot-cold ' + (Math.random() > 0.55 ? 'hot' : 'cold');
    tag.textContent = tag.classList.contains('hot') ? '🔥 HOT' : '❄️ COLD';
    card.style.position = card.style.position || 'relative';
    card.appendChild(tag);
  });
}

// ---------- Recent results strip (generic) ----------
function pushRecentResult(text, win) {
  let strip = document.getElementById('recent-strip');
  if (!strip) {
    const panel = document.querySelector('.game-panel');
    if (!panel) return;
    strip = document.createElement('div');
    strip.id = 'recent-strip';
    strip.className = 'recent-strip';
    strip.innerHTML = '<div class="recent-label">Последние:</div><div class="recent-items"></div>';
    panel.insertBefore(strip, panel.firstChild);
  }
  const items = strip.querySelector('.recent-items');
  const el = document.createElement('span');
  el.className = 'recent-item ' + (win ? 'win' : 'lose');
  el.textContent = text;
  items.insertBefore(el, items.firstChild);
  while (items.children.length > 12) items.lastChild.remove();
}

// Hook toast-ish wins into recent (lightweight)
const _origToast = showToast;
showToast = function(msg, type) {
  _origToast(msg, type);
  if (/выигрыш|win|\+/i.test(msg || '')) pushRecentResult(msg.slice(0, 18), true);
};

document.addEventListener('DOMContentLoaded', () => {
  initTipDealer();
  initSessionChrome();
  initFairBadge();
  initHotCold();
});

console.log('%c🎰 Unlimited bets + casino features v5', 'color:#ff2e9a;font-weight:bold');

/* =========================================================
   FULL STATS ENGINE — deposits, wins, losses, per-game
   ========================================================= */
function statsKey() {
  return 'casinoStats_' + (getSessionUser() || 'guest');
}
function loadStats() {
  try {
    const s = JSON.parse(localStorage.getItem(statsKey()) || '{}');
    return {
      deposited: s.deposited || 0,
      won: s.won || 0,
      lost: s.lost || 0,
      winCount: s.winCount || 0,
      lossCount: s.lossCount || 0,
      biggestWin: s.biggestWin || parseFloat(localStorage.getItem('casinoBiggestWin') || '0') || 0,
      games: s.games || {}
    };
  } catch {
    return { deposited: 0, won: 0, lost: 0, winCount: 0, lossCount: 0, biggestWin: 0, games: {} };
  }
}
function saveStats(s) {
  localStorage.setItem(statsKey(), JSON.stringify(s));
  // keep legacy key in sync for max win
  if (s.biggestWin != null) localStorage.setItem('casinoBiggestWin', String(s.biggestWin));
}
function currentGameId() {
  try {
    const p = (location.pathname.split('/').pop() || location.href.split('/').pop() || '').replace(/\.html.*/i, '');
    if (!p || p === 'index' || p === '') return 'lobby';
    return p.toLowerCase();
  } catch { return 'lobby'; }
}
function ensureGame(s, id) {
  if (!s.games[id]) s.games[id] = { won: 0, lost: 0, wins: 0, losses: 0 };
  return s.games[id];
}
function recordDeposit(amount) {
  amount = Math.abs(Number(amount) || 0);
  if (amount <= 0) return;
  const s = loadStats();
  s.deposited += amount;
  saveStats(s);
}
function recordWin(amount, game) {
  amount = Math.abs(Number(amount) || 0);
  if (amount <= 0) return;
  const s = loadStats();
  s.won += amount;
  s.winCount += 1;
  if (amount > (s.biggestWin || 0)) s.biggestWin = amount;
  const g = ensureGame(s, game || currentGameId());
  g.won += amount;
  g.wins += 1;
  saveStats(s);
}
function recordLoss(amount, game) {
  amount = Math.abs(Number(amount) || 0);
  if (amount <= 0) return;
  const s = loadStats();
  s.lost += amount;
  s.lossCount += 1;
  const g = ensureGame(s, game || currentGameId());
  g.lost += amount;
  g.losses += 1;
  saveStats(s);
}
window.recordDeposit = recordDeposit;
window.recordWin = recordWin;
window.recordLoss = recordLoss;
window.loadStats = loadStats;

// Hook updateBalance for automatic loss tracking (bets) — wins mainly via showWinOverlay
(function hookBalanceStats() {
  const prev = updateBalance;
  updateBalance = function(amount) {
    prev(amount);
    try {
      if (amount < 0 && !window.__skipLossRecord) {
        const gid = currentGameId();
        if (gid && gid !== 'lobby') recordLoss(-amount, gid);
      }
    } catch(e) {}
  };
  window.updateBalance = updateBalance;
})();

// Game display names
const GAME_LABELS = {
  slots: 'Слоты', aviator: 'Літачок', roulette: 'Рулетка', blackjack: 'Блэкджек',
  mines: 'Мины', plinko: 'Плинко', dice: 'Кости', wheel: 'Колесо',
  hilo: 'Hi-Lo', keno: 'Кено', poker: 'Покер', scratch: 'Скретч', lobby: 'Лобби'
};

/* =========================================================
   BUSIK FLYBY — random directions + anthem + jackpot anthem
   ========================================================= */

function _note(freq, start, dur, type, vol) {
  if (!soundOn) return;
  try {
    const ctx = _audioCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'triangle';
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol || 0.1, t0 + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  } catch (e) {}
}

/** Гімн України — реальний mp3 при прольоті бусіка */
let _anthemAudio = null;
function playUkraineAnthemSnippet() {
  if (!soundOn) return;
  try {
    if (_anthemAudio) {
      try { _anthemAudio.pause(); } catch(e) {}
    }
    _anthemAudio = new Audio('anthem.mp3');
    _anthemAudio.volume = 0.7;
    _anthemAudio.currentTime = 0;
    const p = _anthemAudio.play();
    if (p && p.catch) p.catch(() => {});
    // не тягти весь трек — зупинити через ~25с
    setTimeout(() => {
      try { if (_anthemAudio) { _anthemAudio.pause(); _anthemAudio.currentTime = 0; } } catch(e) {}
    }, 10000);
  } catch (e) {
    console.warn('anthem play fail', e);
  }
}

/** «Я пиздатый» — Lil Morty (ms = длительность, по умолчанию 10с) */
let _pizdatyAudio = null;
let _pizdatyStopTimer = null;
function playPizdatyJingle(ms) {
  if (!soundOn) return;
  const dur = typeof ms === 'number' ? ms : 10000;
  try {
    if (_pizdatyStopTimer) clearTimeout(_pizdatyStopTimer);
    if (_pizdatyAudio) {
      try { _pizdatyAudio.pause(); } catch(e) {}
    }
    _pizdatyAudio = new Audio('pizdaty.mp3');
    _pizdatyAudio.volume = 0.75;
    _pizdatyAudio.currentTime = 0;
    const p = _pizdatyAudio.play();
    if (p && p.catch) p.catch(() => {});
    _pizdatyStopTimer = setTimeout(() => {
      try { if (_pizdatyAudio) { _pizdatyAudio.pause(); _pizdatyAudio.currentTime = 0; } } catch(e) {}
    }, dur);
    if (dur >= 8000) setTimeout(() => { try { SFX.bigWin(); } catch(e) {} }, 400);
  } catch (e) {
    console.warn('pizdaty play fail', e);
  }
}

function showPizdatyOverlay() {
  let el = document.getElementById('pizdaty-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'pizdaty-overlay';
    el.className = 'pizdaty-overlay';
    el.innerHTML = `
      <div class="pizdaty-card">
        <div class="pizdaty-fire">🔥💰🔥</div>
        <div class="pizdaty-line">Я ПІЗДАТИЙ</div>
        <div class="pizdaty-line accent">АХУЄННИЙ</div>
        <div class="pizdaty-line">СУЧАСНИЙ</div>
        <div class="pizdaty-sub">і взагалі легенда цього залу</div>
      </div>`;
    document.body.appendChild(el);
  }
  el.classList.remove('hide');
  el.classList.add('show');
  document.body.classList.add('jackpot-shake');
  moneyRain(100);
  screenShake(12);
  setTimeout(() => {
    el.classList.remove('show');
    el.classList.add('hide');
    document.body.classList.remove('jackpot-shake');
  }, 4500);
}

function playPlaneWhoosh() {
  if (!soundOn) return;
  try {
    const ctx = _audioCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, t0);
    filter.frequency.exponentialRampToValueAtTime(1200, t0 + 1.2);
    filter.frequency.exponentialRampToValueAtTime(300, t0 + 2.8);
    osc.type = 'sawtooth';
    osc2.type = 'square';
    osc.frequency.setValueAtTime(55, t0);
    osc.frequency.linearRampToValueAtTime(90, t0 + 1.5);
    osc.frequency.linearRampToValueAtTime(50, t0 + 3);
    osc2.frequency.setValueAtTime(110, t0);
    osc2.frequency.linearRampToValueAtTime(70, t0 + 3);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.1, t0 + 0.3);
    gain.gain.setValueAtTime(0.1, t0 + 2.2);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.2);
    osc.connect(filter); osc2.connect(filter);
    filter.connect(gain); gain.connect(ctx.destination);
    osc.start(t0); osc2.start(t0);
    osc.stop(t0 + 3.3); osc2.stop(t0 + 3.3);
    _noise(0.4, 0.04);
  } catch (e) {}
}

function showBusikPopup() {
  let el = document.getElementById('busik-popup');
  if (!el) {
    el = document.createElement('div');
    el.id = 'busik-popup';
    el.className = 'busik-popup';
    el.innerHTML = '<div class="busik-popup-inner">🚌 тебе чекає бусік хлопец</div>';
    document.body.appendChild(el);
  }
  el.classList.remove('hide');
  el.classList.add('show');
  try { SFX.win(); } catch(e) {}
  setTimeout(() => {
    el.classList.remove('show');
    el.classList.add('hide');
    setTimeout(() => el.classList.remove('hide'), 600);
  }, 3200);
}

const BUSIK_DIRS = ['from-left', 'from-right', 'from-top', 'from-bottom', 'from-tl', 'from-tr', 'from-bl', 'from-br'];

function runBusikFlyby() {
  if (!document.body.classList.contains('home-page')) return;
  if (document.getElementById('busik-flyer')) return;

  const dir = BUSIK_DIRS[Math.floor(Math.random() * BUSIK_DIRS.length)];
  const flyer = document.createElement('div');
  flyer.id = 'busik-flyer';
  flyer.className = 'busik-flyer ' + dir;
  const img = document.createElement('img');
  img.alt = 'бусік';
  img.src = 'plane-barrel.png?v=nofg5';
  img.onerror = function() { flyer.remove(); };
  flyer.appendChild(img);
  for (let i = 0; i < 12; i++) {
    const p = document.createElement('span');
    p.className = 'busik-spark';
    p.style.setProperty('--i', i);
    flyer.appendChild(p);
  }
  document.body.appendChild(flyer);

  playPlaneWhoosh();
  playUkraineAnthemSnippet();
  requestAnimationFrame(() => flyer.classList.add('fly'));

  setTimeout(() => {
    flyer.classList.add('done');
    showBusikPopup();
    setTimeout(() => flyer.remove(), 500);
  }, 2800);
}

function scheduleBusikFlybys() {
  if (!document.body.classList.contains('home-page')) return;
  const first = 8000 + Math.random() * 10000;
  setTimeout(function loop() {
    runBusikFlyby();
    setTimeout(loop, 25000 + Math.random() * 30000);
  }, first);
}

document.addEventListener('DOMContentLoaded', () => {
  scheduleBusikFlybys();
});

/* Jackpot: піздатий оверлей */
(function hookJackpotPizdaty() {
  const prev = showWinOverlay;
  showWinOverlay = function(title, sub) {
    prev(title, sub);
    const t = ((title || '') + ' ' + (sub || '')).toLowerCase();
    if (t.includes('джекпот') || t.includes('мега') || t.includes('банк') || t.includes('jackpot')) {
      playPizdatyJingle();
      showPizdatyOverlay();
    }
  };
})();


/* =========================================================
   HALL LIFE v7 — hosts, weather, VIP board, loss react, dance
   ========================================================= */

const HALL_HOSTS = [
  { name: 'Anna · VIP', emoji: '👩‍🎤', lines: [
    'Не жадничай, хлопче — удача любить сміливих.',
    'Я б на твоєму місці крутила ще раз.',
    'Стіл сьогодні гарячий. Відчуваєш?'
  ]},
  { name: 'Mia · Lucky', emoji: '🍀', lines: [
    'Тихо… джекпот десь близько.',
    'Ставка — це не витрата. Це інвестиція в перемогу.',
    'Дихай рівно. І тисни.'
  ]},
  { name: 'Lena · Jackpot', emoji: '💎', lines: [
    'Зал шепоче твоє ім\'я.',
    'Великі виграші люблять тих, хто не здається.',
    'Сьогодні твоя зміна. Не зливай момент.'
  ]},
  { name: 'Борис · Дилер', emoji: '🃏', lines: [
    'Карти пам\'ятають все. Але ти можеш їх здивувати.',
    'Ще одна рука — і історія зміниться.',
    'Потужно граєш. Так тримати.'
  ]},
  { name: 'Олег · Охорона', emoji: '🕶️', lines: [
    'Тут усе чесно… майже.',
    'Бачу стрик. Не зупиняйся.',
    'Зал під контролем. Ти — легенда вечора.'
  ]}
];

function showHallHost() {
  if (document.getElementById('hall-host-toast')) return;
  const host = HALL_HOSTS[Math.floor(Math.random() * HALL_HOSTS.length)];
  const line = host.lines[Math.floor(Math.random() * host.lines.length)];
  const el = document.createElement('div');
  el.id = 'hall-host-toast';
  el.className = 'hall-host-toast';
  el.innerHTML = `
    <div class="hh-avatar">${host.emoji}</div>
    <div class="hh-body">
      <div class="hh-name">${host.name}</div>
      <div class="hh-line">${line}</div>
    </div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  try { SFX.click(); } catch(e) {}
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 450);
  }, 4500);
}

function scheduleHallHosts() {
  const tick = () => {
    // don't stack with busik popup
    if (!document.getElementById('busik-flyer') && !document.getElementById('busik-popup')?.classList.contains('show')) {
      showHallHost();
    }
    setTimeout(tick, 35000 + Math.random() * 40000);
  };
  setTimeout(tick, 12000 + Math.random() * 8000);
}

/* ---------- Weather ---------- */
const WEATHER_MODES = [
  { id: 'clear', label: '☀️ Ясно · зал у спокої' },
  { id: 'rain', label: '🌧️ Дощ з гривень' },
  { id: 'fog', label: '🌫️ Туман удачі' },
  { id: 'neon', label: '💜 Неонова буря' },
  { id: 'gold', label: '✨ Золотий пил' }
];

function setCasinoWeather(mode) {
  document.body.classList.remove('wx-clear','wx-rain','wx-fog','wx-neon','wx-gold');
  document.body.classList.add('wx-' + mode.id);
  let badge = document.getElementById('weather-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'weather-badge';
    badge.className = 'weather-badge';
    document.body.appendChild(badge);
  }
  badge.textContent = mode.label;
  badge.classList.add('pulse');
  setTimeout(() => badge.classList.remove('pulse'), 800);
}

function scheduleWeather() {
  const cycle = () => {
    const m = WEATHER_MODES[Math.floor(Math.random() * WEATHER_MODES.length)];
    setCasinoWeather(m);
    setTimeout(cycle, 45000 + Math.random() * 60000);
  };
  setCasinoWeather(WEATHER_MODES[0]);
  setTimeout(cycle, 20000 + Math.random() * 15000);
}

/* ---------- VIP Leaderboard ---------- */
function loadLeaderboard() {
  try { return JSON.parse(localStorage.getItem('agrarka_leaders') || '[]'); }
  catch(e) { return []; }
}
function saveLeaderboard(list) {
  localStorage.setItem('agrarka_leaders', JSON.stringify(list.slice(0, 10)));
}
function recordLeaderWin(amount) {
  if (!amount || amount < 50) return;
  const user = (typeof currentAccount === 'function' && currentAccount()) || null;
  const name = user ? (user.name || user.login) : 'Гість';
  const list = loadLeaderboard();
  list.push({ name, amount: Math.round(amount * 100) / 100, at: Date.now() });
  list.sort((a, b) => b.amount - a.amount);
  saveLeaderboard(list);
  renderVipBoard();
}
function renderVipBoard() {
  let board = document.getElementById('vip-board');
  if (!board) {
    board = document.createElement('div');
    board.id = 'vip-board';
    board.className = 'vip-board';
    board.innerHTML = `
      <div class="vb-head">🏆 VIP-стіл · топ сесії</div>
      <ol class="vb-list" id="vip-board-list"></ol>
      <button type="button" class="vb-toggle" id="vb-toggle">згорнути</button>`;
    document.body.appendChild(board);
    board.querySelector('#vb-toggle').onclick = () => {
      board.classList.toggle('collapsed');
      board.querySelector('#vb-toggle').textContent =
        board.classList.contains('collapsed') ? 'розгорнути' : 'згорнути';
    };
  }
  const list = loadLeaderboard();
  const ol = board.querySelector('#vip-board-list');
  if (!list.length) {
    ol.innerHTML = '<li class="vb-empty">Ще немає виграшів — будь першим</li>';
    return;
  }
  ol.innerHTML = list.slice(0, 5).map((r, i) =>
    `<li><span class="vb-rank">${i + 1}</span><span class="vb-name">${r.name}</span><span class="vb-amt">$${r.amount.toLocaleString('en-US')}</span></li>`
  ).join('');
}

/* ---------- Big loss reaction ---------- */
/* Надписи при проигрыше: 1 раз на 4–10 проигрышей (не каждый раз) */
let _lossCount = 0;
let _lossNextAt = 4 + Math.floor(Math.random() * 7); // 4..10
function reactBigLoss(amount) {
  const abs = Math.abs(amount);
  if (abs < 40) return; // мелкие ставки игнор
  _lossCount++;
  if (_lossCount < _lossNextAt) return;
  // показать и сбросить счётчик
  _lossCount = 0;
  _lossNextAt = 4 + Math.floor(Math.random() * 7); // снова 4..10

  const phrases = [
    'Ой… тримайся 💪',
    'Зал видихнув з тобою',
    'Це був важкий удар',
    'Наступна — твоя',
    'Не здавайся, легендо',
    'Дихай. Ще одна спроба.',
    'Потужно тримаєшся'
  ];
  const el = document.createElement('div');
  el.className = 'loss-react';
  el.textContent = phrases[Math.floor(Math.random() * phrases.length)];
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  document.body.classList.add('loss-dim');
  try { SFX.lose && SFX.lose(); } catch(e) { try { _tone(120, 0.25, 'sine', 0.08, 80); } catch(x) {} }
  setTimeout(() => {
    el.classList.remove('show');
    document.body.classList.remove('loss-dim');
    setTimeout(() => el.remove(), 400);
  }, 2200);
}

/* ---------- Balance dance on win ---------- */
function danceBalance() {
  const pill = document.querySelector('.balance-pill') || balanceEl;
  if (!pill) return;
  pill.classList.remove('balance-dance');
  void pill.offsetWidth;
  pill.classList.add('balance-dance');
  setTimeout(() => pill.classList.remove('balance-dance'), 1200);
}

/* ---------- Hooks ---------- */
(function hallLifeHooks() {
  const _ub = updateBalance;
  window.updateBalance = function(amount) {
    _ub(amount);
    if (amount < 0) reactBigLoss(amount);
    if (amount > 0) {
      danceBalance();
      if (amount >= 50) recordLeaderWin(amount);
    }
  };

  // also hook showWinOverlay for leader + dance
  const _sw = showWinOverlay;
  showWinOverlay = function(title, sub) {
    _sw(title, sub);
    danceBalance();
    // parse win amount from sub if possible
    const m = String(sub || '').match(/[\d,.]+/);
    if (m) {
      const n = parseFloat(m[0].replace(/,/g, ''));
      if (!isNaN(n) && n >= 50) recordLeaderWin(n);
    }
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  scheduleHallHosts();
  scheduleWeather();
  renderVipBoard();
});
