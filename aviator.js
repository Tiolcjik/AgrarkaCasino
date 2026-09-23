/* =========================================================
   AVIATOR.JS — краш-игра с более реалистичной сценой полёта
   ========================================================= */

const canvas = document.getElementById('aviator-canvas');
const ctx = canvas.getContext('2d');

// Кастомный «бочко-літак»
const planeImg = new Image();
planeImg.src = 'plane-barrel.png';
planeImg.onload = () => { try { if (typeof draw === 'function') draw(0, 0); } catch (e) {} };

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
  } else if (planeImg && planeImg.complete && planeImg.naturalWidth) {
    const pw = 88;
    const ph = pw * (planeImg.naturalHeight / planeImg.naturalWidth);
    ctx.drawImage(planeImg, -pw * 0.45, -ph * 0.55, pw, ph);
  } else {
    ctx.font = '28px sans-serif';
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
