/* =========================================================
   AVIATOR.JS — краш-игра с более реалистичной сценой полёта
   ========================================================= */

const canvas = document.getElementById('aviator-canvas');
const ctx = canvas.getContext('2d');

// Кастомный «бочко-літак» (встроенная картинка + файл если есть)
const planeImg = new Image();
planeImg.decoding = 'async';
// сначала пробуем файл в папке, иначе data-uri (всегда есть)
planeImg.onerror = function() {
  planeImg.onerror = null;
  planeImg.src = 'data:image/jpeg;base64,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';
};
planeImg.onload = () => { try { if (typeof draw === 'function') draw(0, 0); } catch (e) {} };
planeImg.src = 'plane-barrel.jpg';
// параллельно подстрахуемся data-uri если файл не подгрузится за 1.5с
setTimeout(() => {
  if (!planeImg.naturalWidth) planeImg.src = 'data:image/jpeg;base64,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';
}, 1500);

const multEl = document.getElementById('aviator-multiplier');
const stateLabelEl = document.getElementById('aviator-state-label');
const historyEl = document.getElementById('aviator-history');
const actionBtn = document.getElementById('aviator-action-btn');
const betMinusBtn = document.getElementById('bet-minus');
const betPlusBtn = document.getElementById('bet-plus');
const betAmountEl = document.getElementById('bet-amount');
const autoCashoutInput = document.getElementById('auto-cashout');
const aviatorMessage = document.getElementById('aviator-message');
const currentRoundBetEl = document.getElementById('current-round-bet');

let betAmount = 100;
let phase = 'waiting'; // 'waiting' | 'flying' | 'crashed'
let currentMultiplier = 1.0;
let crashPoint = 2.0;
let flightStart = 0;
let waitEndsAt = 0;
let crashHistory = [];

let hasBet = false;
let cashedOut = false;
let roundBetAmount = 0;

const WAIT_MS = 5000;
const CRASH_PAUSE_MS = 2200;

// ---------- Starfield (generated once) ----------
let stars = [];
function generateStars() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  stars = [];
  for (let i = 0; i < 55; i++) {
    stars.push({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.4 + 0.3, tw: Math.random() * Math.PI * 2 });
  }
}

// ---------- Canvas sizing ----------
function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  generateStars();
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ---------- Bet stepper ----------
function setBetAmount(val) {
  betAmount = Math.max(1, Math.floor(val));
  betAmountEl.textContent = fmtMoney(betAmount);
}
betMinusBtn.addEventListener('click', () => { if (!hasBet) setBetAmount(betAmount - 50); });
betPlusBtn.addEventListener('click', () => { if (!hasBet) setBetAmount(betAmount + 50); });

// ---------- Crash point generation ----------
function generateCrashPoint() {
  const houseEdge = 0.97;
  const r = Math.random();
  if (r < 0.03) return 1.00;
  let crash = houseEdge / (1 - r);
  crash = Math.floor(crash * 100) / 100;
  return Math.max(1.00, Math.min(crash, 500));
}

// ---------- History ----------
function pushHistory(point) {
  crashHistory.unshift(point);
  if (crashHistory.length > 14) crashHistory.pop();
  renderHistory();
}
function renderHistory() {
  historyEl.innerHTML = '';
  crashHistory.forEach((p) => {
    const chip = document.createElement('span');
    chip.className = 'hist-chip' + (p >= 10 ? ' big' : p >= 2 ? ' win' : '');
    chip.textContent = p.toFixed(2) + 'x';
    historyEl.appendChild(chip);
  });
}

// ---------- Drawing ----------
function draw(progress, elapsedSec) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);

  // starfield
  stars.forEach((s) => {
    const twinkle = 0.5 + 0.5 * Math.sin((elapsedSec || 0) * 2 + s.tw);
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${0.15 + twinkle * 0.35})`;
    ctx.fill();
  });

  // grid + multiplier ticks on the left
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  ctx.font = '10px "Space Grotesk", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  for (let i = 1; i < 5; i++) {
    const y = (h / 5) * i;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  for (let i = 1; i < 8; i++) {
    const x = (w / 8) * i;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.stroke();
  }

  if (phase === 'waiting') return;

  const t = Math.min(progress, 1);
  const padding = 24;
  const cx = padding + t * (w - padding * 2);
  const cy = h - padding - Math.pow(t, 1.4) * (h - padding * 2);

  // speed lines trailing the plane
  if (phase === 'flying') {
    for (let i = 0; i < 5; i++) {
      const off = (i + 1) * 9;
      ctx.strokeStyle = `rgba(0,229,255,${0.18 - i * 0.03})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - off - 14, cy + off * 0.4);
      ctx.lineTo(cx - off, cy + off * 0.4);
      ctx.stroke();
    }
  }

  ctx.beginPath();
  ctx.moveTo(padding, h - padding);
  const steps = 40;
  for (let i = 0; i <= steps; i++) {
    const tt = (i / steps) * t;
    const x = padding + tt * (w - padding * 2);
    const y = h - padding - Math.pow(tt, 1.4) * (h - padding * 2);
    ctx.lineTo(x, y);
  }
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, phase === 'crashed' ? '#ff3b5c' : '#ff2e9a');
  grad.addColorStop(1, phase === 'crashed' ? '#ff3b5c' : '#00e5ff');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 3.5;
  ctx.lineJoin = 'round';
  ctx.shadowColor = phase === 'crashed' ? 'rgba(255,59,92,0.6)' : 'rgba(255,46,154,0.5)';
  ctx.shadowBlur = 14;
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.lineTo(cx, h - padding);
  ctx.lineTo(padding, h - padding);
  ctx.closePath();
  const fillGrad = ctx.createLinearGradient(0, 0, 0, h);
  fillGrad.addColorStop(0, phase === 'crashed' ? 'rgba(255,59,92,0.18)' : 'rgba(255,46,154,0.16)');
  fillGrad.addColorStop(1, 'rgba(255,46,154,0.0)');
  ctx.fillStyle = fillGrad;
  ctx.fill();

  // plane — бочко-літак (кастомная картинка)
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.35);
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 12;
  if (phase === 'crashed') {
    ctx.font = '36px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 8;
    ctx.fillText('💥', 0, 0);
  } else if (planeImg && planeImg.complete && planeImg.naturalWidth > 0) {
    const pw = 110;
    const ph = pw * (planeImg.naturalHeight / planeImg.naturalWidth);
    ctx.drawImage(planeImg, -pw * 0.4, -ph * 0.55, pw, ph);
  } else {
    // пока грузится — чуть крупнее эмодзи
    ctx.font = '32px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✈️', 0, 0);
  }
  ctx.restore();
}

// ---------- Action button ----------
function refreshActionButton() {
  actionBtn.classList.remove('cashout-ready', 'placed');
  if (phase === 'waiting') {
    if (hasBet) {
      actionBtn.textContent = `Ставка принята ✓ (${fmtMoney(roundBetAmount)}) — отменить`;
      actionBtn.classList.add('placed');
      actionBtn.disabled = false;
    } else {
      actionBtn.textContent = 'Поставить на след. раунд';
      actionBtn.disabled = false;
    }
  } else if (phase === 'flying') {
    if (hasBet && !cashedOut) {
      const potential = Math.floor(roundBetAmount * currentMultiplier);
      actionBtn.textContent = `Забрать ${fmtMoney(potential)}`;
      actionBtn.classList.add('cashout-ready');
      actionBtn.disabled = false;
    } else {
      actionBtn.textContent = cashedOut ? 'Уже забрано ✓' : 'Раунд уже начался';
      actionBtn.disabled = true;
    }
  } else {
    actionBtn.textContent = 'Ожидание след. раунда...';
    actionBtn.disabled = true;
  }
}

actionBtn.addEventListener('click', () => {
  if (phase === 'waiting') {
    if (hasBet) {
      updateBalance(roundBetAmount);
      hasBet = false;
      roundBetAmount = 0;
      currentRoundBetEl.textContent = '—';
      aviatorMessage.textContent = 'Ставка отменена';
    } else {
      if (balance < betAmount) {
        aviatorMessage.textContent = 'Недостаточно средств!';
        return;
      }
      updateBalance(-betAmount);
      hasBet = true;
      cashedOut = false;
      roundBetAmount = betAmount;
      currentRoundBetEl.textContent = fmtMoney(roundBetAmount);
      aviatorMessage.textContent = 'Ставка принята, ждём взлёта...';
    }
  } else if (phase === 'flying' && hasBet && !cashedOut) {
    doCashout();
  }
  refreshActionButton();
});

function doCashout() {
  cashedOut = true;
  const win = Math.floor(roundBetAmount * currentMultiplier);
  updateBalance(win);
  if (currentMultiplier >= 3) {
    try { SFX.cashout(); } catch(e) {}
    showWinOverlay(`${currentMultiplier.toFixed(2)}x`, `Забрано +${fmtMoney(win)}`);
  } else {
    aviatorMessage.textContent = `✅ Забрано на ${currentMultiplier.toFixed(2)}x — +${fmtMoney(win)}`;
  }
  showToast(`✈️ Кэшаут ${currentMultiplier.toFixed(2)}x`);
}

// ---------- Round loop ----------
function startWaitingPhase() {
  phase = 'waiting';
  currentMultiplier = 1.0;
  crashPoint = generateCrashPoint();
  waitEndsAt = performance.now() + WAIT_MS;
  multEl.classList.remove('crashed');
  multEl.innerHTML = `1.00x<span class="state-label" id="aviator-state-label"></span>`;
  refreshActionButton();
  tickWaiting();
}

function tickWaiting() {
  if (phase !== 'waiting') return;
  const remaining = Math.max(0, waitEndsAt - performance.now());
  const label = document.getElementById('aviator-state-label');
  if (label) label.textContent = `Следующий взлёт через ${(remaining / 1000).toFixed(1)}с`;
  draw(0, performance.now() / 1000);

  if (remaining <= 0) {
    startFlightPhase();
    return;
  }
  requestAnimationFrame(tickWaiting);
}

function startFlightPhase() {
  phase = 'flying';
  flightStart = performance.now();
  refreshActionButton();
  requestAnimationFrame(tickFlight);
}

function tickFlight() {
  if (phase !== 'flying') return;
  const elapsedSec = (performance.now() - flightStart) / 1000;
  currentMultiplier = Math.exp(0.17 * elapsedSec);

  if (currentMultiplier >= crashPoint) {
    currentMultiplier = crashPoint;
    finishRound();
    return;
  }

  multEl.innerHTML = `${currentMultiplier.toFixed(2)}x<span class="state-label">В полёте...</span>`;
  const progress = Math.min(elapsedSec / 12, 1);
  draw(progress, elapsedSec);

  const autoVal = parseFloat(autoCashoutInput.value);
  if (hasBet && !cashedOut && autoVal && currentMultiplier >= autoVal) {
    doCashout();
  }

  refreshActionButton();
  requestAnimationFrame(tickFlight);
}

function finishRound() {
  phase = 'crashed';
  multEl.classList.add('crashed');
  multEl.innerHTML = `${crashPoint.toFixed(2)}x<span class="state-label">Улетел! 💥</span>`;
  draw(1, flightStart / 1000);
  pushHistory(crashPoint);

  if (hasBet && !cashedOut) {
    aviatorMessage.textContent = `💥 Разбился на ${crashPoint.toFixed(2)}x — ставка ${fmtMoney(roundBetAmount)} сгорела`;
  }

  hasBet = false;
  cashedOut = false;
  roundBetAmount = 0;
  currentRoundBetEl.textContent = '—';
  refreshActionButton();

  setTimeout(startWaitingPhase, CRASH_PAUSE_MS);
}

setBetAmount(betAmount);
startWaitingPhase();

(function() {
  const input = document.getElementById('custom-bet-input');
  const btn = document.getElementById('custom-bet-apply');
  if (!input || !btn) return;
  btn.addEventListener('click', () => {
    const v = Math.floor(parseFloat(input.value));
    if (!v || v < 10) { input.focus(); return; }
    if (typeof setBetAmount === 'function') setBetAmount(v);
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') btn.click(); });
})();
