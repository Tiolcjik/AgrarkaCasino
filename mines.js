/* =========================================================
   MINES.JS — «Міни»: сапёр-казино, честные шансы + доля дома
   ========================================================= */

const GRID_SIZE = 25; // 5x5
const HOUSE_EDGE = 0.97;

const gridEl = document.getElementById('mines-grid');
const startBtn = document.getElementById('mines-start-btn');
const cashoutBtn = document.getElementById('mines-cashout-btn');
const minesMessage = document.getElementById('mines-message');
const currentMultEl = document.getElementById('mines-current-mult');
const potentialWinEl = document.getElementById('mines-potential-win');
const chipRow = document.getElementById('chip-row');
const currentBetEl = document.getElementById('current-bet');
const countRow = document.getElementById('mines-count-row');

let currentBet = 100;
let mineCount = 3;
let minePositions = new Set();
let revealed = new Set();
let roundActive = false;
let currentMultiplier = 1;

currentBetEl.textContent = fmtMoney(currentBet);

chipRow.querySelectorAll('.chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    if (roundActive) return;
    chipRow.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    currentBet = parseInt(chip.dataset.bet);
    currentBetEl.textContent = fmtMoney(currentBet);
  });
});

countRow.querySelectorAll('.mines-count-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (roundActive) return;
    countRow.querySelectorAll('.mines-count-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    mineCount = parseInt(btn.dataset.mines);
  });
});

function buildGrid() {
  gridEl.innerHTML = '';
  for (let i = 0; i < GRID_SIZE; i++) {
    const tile = document.createElement('button');
    tile.className = 'mine-tile';
    tile.dataset.idx = String(i);
    tile.addEventListener('click', () => onTileClick(i));
    gridEl.appendChild(tile);
  }
}
buildGrid();

function fairMultiplierAfter(picks) {
  // multiplies in step probabilities (safe / total) with house edge baked in
  let mult = 1;
  let remaining = GRID_SIZE;
  for (let i = 0; i < picks; i++) {
    const safeInRemaining = remaining - mineCount;
    mult *= remaining / safeInRemaining;
    remaining--;
  }
  return mult * HOUSE_EDGE;
}

function refreshStats() {
  currentMultEl.textContent = '×' + currentMultiplier.toFixed(2);
  potentialWinEl.textContent = fmtMoney(currentBet * currentMultiplier);
}

function setControlsDisabled(disabled) {
  chipRow.style.pointerEvents = disabled ? 'none' : 'auto';
  chipRow.style.opacity = disabled ? 0.5 : 1;
  countRow.style.pointerEvents = disabled ? 'none' : 'auto';
  countRow.style.opacity = disabled ? 0.5 : 1;
}

function startRound() {
  if (balance < currentBet) {
    minesMessage.textContent = 'Недостатньо коштів на рахунку!';
    return;
  }
  updateBalance(-currentBet);
  if (Math.random() < 0.4) showRandomFlavor();

  minePositions = new Set();
  while (minePositions.size < mineCount) {
    minePositions.add(Math.floor(Math.random() * GRID_SIZE));
  }
  revealed = new Set();
  roundActive = true;
  currentMultiplier = 1;
  minesMessage.textContent = 'Раунд почався — обирай клітинки!';

  buildGrid();
  refreshStats();
  setControlsDisabled(true);
  startBtn.classList.add('hidden');
  cashoutBtn.classList.remove('hidden');
  cashoutBtn.disabled = true;
}

function onTileClick(idx) {
  if (!roundActive || revealed.has(idx)) return;
  const tile = gridEl.children[idx];

  if (minePositions.has(idx)) {
    // boom — reveal everything, round over, bet lost
    revealed.add(idx);
    tile.classList.add('mine', 'hit');
    tile.textContent = '💣';
    endRound(false);
    return;
  }

  revealed.add(idx);
  tile.classList.add('safe');
  tile.textContent = '💎';
  currentMultiplier = fairMultiplierAfter(revealed.size);
  refreshStats();
  cashoutBtn.disabled = false;

  if (revealed.size === GRID_SIZE - mineCount) {
    // cleared the whole board
    doCashout(true);
  }
}

function doCashout(fullClear) {
  if (!roundActive) return;
  const win = Math.round(currentBet * currentMultiplier);
  updateBalance(win);
  if (fullClear) {
    try { if (window.SFX) SFX.cashout(); } catch(e) {}
    showWinOverlay('Поле зачищено! 🧹', `+${fmtMoney(win)} (×${currentMultiplier.toFixed(2)})`);
  } else if (currentMultiplier >= 3) {
    showWinOverlay('Потужно забрано! 🔥', `+${fmtMoney(win)} (×${currentMultiplier.toFixed(2)})`);
  } else {
    minesMessage.textContent = `✅ Забрано +${fmtMoney(win)} (×${currentMultiplier.toFixed(2)})`;
  }
  revealMines();
  endRound(true, win);
}

function revealMines() {
  minePositions.forEach((i) => {
    const tile = gridEl.children[i];
    if (!tile.classList.contains('safe')) {
      tile.classList.add('mine');
      tile.textContent = '💣';
    }
  });
}

function endRound(cashedOut, win) {
  roundActive = false;
  if (!cashedOut) {
    revealMines();
    minesMessage.textContent = `💥 Підрив! Ставка ${fmtMoney(currentBet)} згоріла`;
  }
  setControlsDisabled(false);
  startBtn.classList.remove('hidden');
  cashoutBtn.classList.add('hidden');
}

startBtn.addEventListener('click', startRound);
cashoutBtn.addEventListener('click', () => doCashout(false));

refreshStats();


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
