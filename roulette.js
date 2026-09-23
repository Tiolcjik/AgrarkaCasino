/* =========================================================
   ROULETTE.JS — настоящий стол (0 + 3×12), дюжины, колонки,
   мульти-ставки, доллары
   ========================================================= */

const WHEEL_ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

function colorOf(n) {
  if (n === 0) return 'green';
  return RED_NUMBERS.has(n) ? 'red' : 'black';
}

const COLOR_HEX = { red: '#c9203f', black: '#141018', green: '#00a862' };
const OUTSIDE_LABELS = { red: '🔴 Красное', black: '⚫ Чёрное', even: 'Чётное', odd: 'Нечётное', low: '1–18', high: '19–36' };
const DOZEN_LABELS = { d1: '1-я дюжина (1–12)', d2: '2-я дюжина (13–24)', d3: '3-я дюжина (25–36)' };
const COLUMN_LABELS = { col1: '1-я колонка', col2: '2-я колонка', col3: '3-я колонка' };

// ---------- Build SVG wheel ----------
const svg = document.getElementById('roulette-wheel');
const CX = 132, CY = 132, R_OUTER = 126, R_INNER = 42;
const segAngle = 360 / WHEEL_ORDER.length;

function polar(cx, cy, r, angleDeg) {
  const rad = (angleDeg - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

WHEEL_ORDER.forEach((num, i) => {
  const startAngle = i * segAngle;
  const endAngle = startAngle + segAngle;
  const p1 = polar(CX, CY, R_OUTER, startAngle);
  const p2 = polar(CX, CY, R_OUTER, endAngle);
  const p3 = polar(CX, CY, R_INNER, endAngle);
  const p4 = polar(CX, CY, R_INNER, startAngle);

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  const d = `M ${p1.x} ${p1.y} A ${R_OUTER} ${R_OUTER} 0 0 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${R_INNER} ${R_INNER} 0 0 0 ${p4.x} ${p4.y} Z`;
  path.setAttribute('d', d);
  path.setAttribute('fill', COLOR_HEX[colorOf(num)]);
  path.setAttribute('stroke', '#0a0118');
  path.setAttribute('stroke-width', '1');
  svg.appendChild(path);

  const labelPos = polar(CX, CY, (R_OUTER + R_INNER) / 2 + 15, startAngle + segAngle / 2);
  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  text.setAttribute('x', labelPos.x);
  text.setAttribute('y', labelPos.y);
  text.setAttribute('fill', '#f2edff');
  text.setAttribute('font-size', '9');
  text.setAttribute('font-weight', '700');
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('dominant-baseline', 'middle');
  text.setAttribute('transform', `rotate(${startAngle + segAngle / 2}, ${labelPos.x}, ${labelPos.y})`);
  text.textContent = num;
  svg.appendChild(text);
});

const hub = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
hub.setAttribute('cx', CX);
hub.setAttribute('cy', CY);
hub.setAttribute('r', R_INNER - 4);
hub.setAttribute('fill', '#1c1140');
hub.setAttribute('stroke', '#d4af37');
hub.setAttribute('stroke-width', '2');
svg.appendChild(hub);

// ---------- Betting state ----------
let chipSize = 50;
let bets = [];          // { id, type:'number'|'outside'|'dozen'|'column', value, amount }
let spinRotation = 0;
let spinning = false;

const resultBadge = document.getElementById('roulette-result-badge');
const rouletteMessage = document.getElementById('roulette-message');
const activeBetsList = document.getElementById('active-bets-list');
const totalStakedEl = document.getElementById('total-staked');
const spinBtn = document.getElementById('spin-btn');
const clearBetsBtn = document.getElementById('clear-bets-btn');
const currentBetEl = document.getElementById('current-bet');

document.querySelectorAll('#chip-row .chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('#chip-row .chip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    chipSize = parseInt(chip.dataset.bet);
    currentBetEl.textContent = fmtMoney(chipSize);
  });
});
currentBetEl.textContent = fmtMoney(chipSize);

// ---------- Real casino table grid: 0 + 3 rows × 12 columns ----------
// Row order top->bottom on a real table: 3-6-9...36 / 2-5-8...35 / 1-4-7...34
const numbersGrid = document.getElementById('numbers-grid');

const zeroBtn = document.createElement('button');
zeroBtn.className = 'num-btn green';
zeroBtn.textContent = '0';
zeroBtn.dataset.num = '0';
zeroBtn.addEventListener('click', () => toggleBet({ type: 'number', value: 0 }));
numbersGrid.appendChild(zeroBtn);

for (let row = 0; row < 3; row++) {
  for (let col = 1; col <= 12; col++) {
    const n = col * 3 - row; // row0: 3,6,...36 | row1: 2,5,...35 | row2: 1,4,...34
    const btn = document.createElement('button');
    btn.className = 'num-btn ' + colorOf(n);
    btn.textContent = n;
    btn.dataset.num = String(n);
    btn.style.gridColumn = String(col + 1);
    btn.style.gridRow = String(row + 1);
    btn.addEventListener('click', () => toggleBet({ type: 'number', value: n }));
    numbersGrid.appendChild(btn);
  }
}

// ---------- Dozens row ----------
const dozensRow = document.getElementById('dozens-row');
dozensRow.innerHTML = `
  <div class="spacer"></div>
  <button class="bet-btn c-dozen" data-dozen="d1">1–12</button>
  <button class="bet-btn c-dozen" data-dozen="d2">13–24</button>
  <button class="bet-btn c-dozen" data-dozen="d3">25–36</button>
`;
dozensRow.querySelectorAll('[data-dozen]').forEach((btn) => {
  btn.addEventListener('click', () => toggleBet({ type: 'dozen', value: btn.dataset.dozen }));
});

// ---------- Columns row (2:1) ----------
const columnsRow = document.getElementById('columns-row');
columnsRow.innerHTML = `
  <div class="spacer"></div>
  <button class="bet-btn c-column" data-column="col1">Колонка 1 (2:1)</button>
  <button class="bet-btn c-column" data-column="col2">Колонка 2 (2:1)</button>
  <button class="bet-btn c-column" data-column="col3">Колонка 3 (2:1)</button>
`;
columnsRow.querySelectorAll('[data-column]').forEach((btn) => {
  btn.addEventListener('click', () => toggleBet({ type: 'column', value: btn.dataset.column }));
});

document.querySelectorAll('[data-outside]').forEach((btn) => {
  btn.addEventListener('click', () => toggleBet({ type: 'outside', value: btn.dataset.outside }));
});

function betKey(type, value) { return `${type}:${value}`; }

function toggleBet(bet) {
  if (spinning) return;

  const key = betKey(bet.type, bet.value);
  const existingIdx = bets.findIndex((b) => betKey(b.type, b.value) === key);

  if (existingIdx >= 0) {
    bets.splice(existingIdx, 1);
  } else {
    if (chipSize > balance - totalStaked()) {
      rouletteMessage.textContent = 'Недостаточно средств для этой ставки!';
      return;
    }
    bets.push({ id: key, type: bet.type, value: bet.value, amount: chipSize });
    rouletteMessage.textContent = '';
  }
  renderBets();
}

function totalStaked() {
  return bets.reduce((s, b) => s + b.amount, 0);
}

function labelForBet(b) {
  if (b.type === 'number') return `Число ${b.value}`;
  if (b.type === 'dozen') return DOZEN_LABELS[b.value];
  if (b.type === 'column') return COLUMN_LABELS[b.value];
  return OUTSIDE_LABELS[b.value];
}

function renderBets() {
  document.querySelectorAll('.num-btn').forEach((b) => b.classList.remove('selected'));
  document.querySelectorAll('[data-outside], [data-dozen], [data-column]').forEach((b) => b.classList.remove('selected'));

  bets.forEach((b) => {
    let el;
    if (b.type === 'number') el = numbersGrid.querySelector(`[data-num="${b.value}"]`);
    else if (b.type === 'dozen') el = document.querySelector(`[data-dozen="${b.value}"]`);
    else if (b.type === 'column') el = document.querySelector(`[data-column="${b.value}"]`);
    else el = document.querySelector(`[data-outside="${b.value}"]`);
    if (el) el.classList.add('selected');
  });

  if (bets.length === 0) {
    activeBetsList.innerHTML = '<span class="active-bets-empty">Пока нет ставок</span>';
  } else {
    activeBetsList.innerHTML = '';
    bets.forEach((b) => {
      const tag = document.createElement('span');
      tag.className = 'bet-tag';
      tag.innerHTML = `${labelForBet(b)} · ${fmtMoney(b.amount)}<button data-remove="${b.id}">✕</button>`;
      activeBetsList.appendChild(tag);
    });
    activeBetsList.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        bets = bets.filter((b) => b.id !== btn.dataset.remove);
        renderBets();
      });
    });
  }

  totalStakedEl.textContent = fmtMoney(totalStaked());
  spinBtn.disabled = bets.length === 0;
}

clearBetsBtn.addEventListener('click', () => {
  if (spinning) return;
  bets = [];
  renderBets();
  rouletteMessage.textContent = '';
});

function checkWin(bet, winningNumber) {
  const c = colorOf(winningNumber);
  if (bet.type === 'number') return winningNumber === bet.value ? 35 : 0;

  if (bet.type === 'dozen') {
    if (winningNumber === 0) return 0;
    if (bet.value === 'd1') return winningNumber <= 12 ? 2 : 0;
    if (bet.value === 'd2') return winningNumber >= 13 && winningNumber <= 24 ? 2 : 0;
    if (bet.value === 'd3') return winningNumber >= 25 ? 2 : 0;
  }

  if (bet.type === 'column') {
    if (winningNumber === 0) return 0;
    const mod = winningNumber % 3;
    if (bet.value === 'col1') return mod === 1 ? 2 : 0;
    if (bet.value === 'col2') return mod === 2 ? 2 : 0;
    if (bet.value === 'col3') return mod === 0 ? 2 : 0;
  }

  switch (bet.value) {
    case 'red': return c === 'red' ? 2 : 0;
    case 'black': return c === 'black' ? 2 : 0;
    case 'even': return winningNumber !== 0 && winningNumber % 2 === 0 ? 2 : 0;
    case 'odd': return winningNumber !== 0 && winningNumber % 2 === 1 ? 2 : 0;
    case 'low': return winningNumber >= 1 && winningNumber <= 18 ? 2 : 0;
    case 'high': return winningNumber >= 19 && winningNumber <= 36 ? 2 : 0;
    default: return 0;
  }
}

function setControlsDisabled(disabled) {
  document.querySelectorAll('.num-btn, [data-outside], [data-dozen], [data-column]').forEach((b) => (b.disabled = disabled));
  clearBetsBtn.disabled = disabled;
}

spinBtn.addEventListener('click', () => {
  if (spinning || bets.length === 0) return;

  const stake = totalStaked();
  if (balance < stake) {
    rouletteMessage.textContent = 'Недостаточно средств!';
    return;
  }

  spinning = true;
  setControlsDisabled(true);
  spinBtn.disabled = true;
  rouletteMessage.textContent = '';
  resultBadge.textContent = '...';
  updateBalance(-stake);

  if (Math.random() < 0.4) showRandomFlavor();

  const winIndex = Math.floor(Math.random() * WHEEL_ORDER.length);
  const winningNumber = WHEEL_ORDER[winIndex];
  const jitter = (Math.random() - 0.5) * segAngle * 0.5;
  const spins = 6;

  spinRotation += 360 * spins - (winIndex * segAngle) - jitter - (spinRotation % 360);
  svg.style.transform = `rotate(${spinRotation}deg)`;

  setTimeout(() => {
    const c = colorOf(winningNumber);
    resultBadge.textContent = `${winningNumber} (${c === 'red' ? '🔴' : c === 'black' ? '⚫' : '🟢'})`;

    let totalWin = 0;
    let bestMult = 0;
    bets.forEach((b) => {
      const mult = checkWin(b, winningNumber);
      if (mult > 0) {
        totalWin += b.amount * mult;
        bestMult = Math.max(bestMult, mult);
      }
    });

    if (totalWin > 0) {
      updateBalance(totalWin);
      if (bestMult >= 35) {
        try { if (window.SFX) SFX.cashout(); } catch(e) {}
    showWinOverlay(`Выпало ${winningNumber}!`, `Точное попадание — +${fmtMoney(totalWin)}`);
      } else {
        rouletteMessage.textContent = `🎉 Выигрыш! +${fmtMoney(totalWin)}`;
      }
    } else {
      rouletteMessage.textContent = `Выпало ${winningNumber} — не повезло, ставки сгорели`;
    }

    bets = [];
    renderBets();
    spinning = false;
    setControlsDisabled(false);
  }, 3650);
});

renderBets();


// Custom bet input
(function() {
  const input = document.getElementById('custom-bet-input');
  const btn = document.getElementById('custom-bet-apply');
  if (!input || !btn) return;
  btn.addEventListener('click', () => {
    const v = Math.floor(parseFloat(input.value));
    if (!v || v < 1) { input.focus(); return; }
    chipSize = Math.max(1, Math.floor(v));
    const el = document.getElementById('current-bet');
    if (el) el.textContent = fmtMoney(chipSize);
    document.querySelectorAll('#chip-row .chip, .chip-row .chip').forEach(c => c.classList.remove('active'));
    
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') btn.click(); });
})();
