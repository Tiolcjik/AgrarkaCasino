/* =========================================================
   AVIATOR.JS — краш-игра с более реалистичной сценой полёта
   ========================================================= */

const canvas = document.getElementById('aviator-canvas');
const ctx = canvas.getContext('2d');

// Кастомный «бочко-літак» (sticker cutout + fallback)
const planeImg = new Image();
planeImg.decoding = 'async';
planeImg.onload = () => { try { if (typeof draw === 'function') draw(0, 0); } catch (e) {} };
planeImg.onerror = function() {
  planeImg.onerror = null;
  planeImg.src = 'data:image/jpeg;base64,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';
};
// PNG с прозрачным фоном
planeImg.src = 'plane-barrel.png?v=sticker2';
setTimeout(() => {
  if (!planeImg.naturalWidth) planeImg.src = 'data:image/jpeg;base64,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';
}, 1200);


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
    const pw = 120;
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
