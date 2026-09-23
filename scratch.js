const SYMS = ['🍒','🍋','💎','7️⃣','⭐','🔔','🍀'];
const MULT = {'🍒':2,'🍋':3,'💎':10,'7️⃣':25,'⭐':5,'🔔':4,'🍀':8};
let currentBet = 100, symbols = [], revealed = 0, playing = false;
const grid = document.getElementById('scratch-grid');
const msg = document.getElementById('scratch-msg');
const betEl = document.getElementById('current-bet');

document.querySelectorAll('#chip-row .chip').forEach(c => {
  c.addEventListener('click', () => {
    if (playing) return;
    document.querySelectorAll('#chip-row .chip').forEach(x => x.classList.remove('active'));
    c.classList.add('active');
    currentBet = +c.dataset.bet;
    betEl.textContent = fmtMoney(currentBet);
  });
});
document.getElementById('custom-bet-apply')?.addEventListener('click', () => {
  if (playing) return;
  const v = Math.floor(+document.getElementById('custom-bet-input').value);
  if (v >= 1) { currentBet = v; betEl.textContent = fmtMoney(v); document.querySelectorAll('#chip-row .chip').forEach(x => x.classList.remove('active')); }
});

function build() {
  grid.innerHTML = '';
  symbols = [];
  // mostly random, sometimes force triple
  const forceWin = Math.random() < 0.22;
  const winSym = SYMS[Math.floor(Math.random()*SYMS.length)];
  for (let i = 0; i < 9; i++) {
    let s = forceWin && i < 3 ? winSym : SYMS[Math.floor(Math.random()*SYMS.length)];
    if (forceWin && i >= 3) {
      do { s = SYMS[Math.floor(Math.random()*SYMS.length)]; } while (s === winSym && Math.random() < 0.7);
    }
    symbols.push(s);
    const cell = document.createElement('div');
    cell.className = 'scratch-cell covered';
    cell.dataset.i = i;
    cell.addEventListener('click', () => reveal(i, cell));
    grid.appendChild(cell);
  }
  revealed = 0;
}

function reveal(i, cell) {
  if (!playing || !cell.classList.contains('covered')) return;
  cell.classList.remove('covered');
  cell.classList.add('revealed');
  cell.textContent = symbols[i];
  revealed++;
  if (revealed === 9) finish();
}

function finish() {
  playing = false;
  const counts = {};
  symbols.forEach(s => counts[s] = (counts[s]||0)+1);
  let best = null, bestC = 0;
  Object.entries(counts).forEach(([s,c]) => { if (c >= 3 && c > bestC) { best = s; bestC = c; } });
  if (best) {
    const win = currentBet * (MULT[best] || 2);
    updateBalance(win);
    grid.querySelectorAll('.scratch-cell').forEach((el, idx) => {
      if (symbols[idx] === best) el.classList.add('win');
    });
    if (MULT[best] >= 10) {
    try { if (window.SFX) SFX.cashout(); } catch(e) {}
    showWinOverlay(best + ' ×' + MULT[best], '+' + fmtMoney(win));
  } else msg.textContent = '🎉 ' + best + ' ×' + MULT[best] + ' — +' + fmtMoney(win);
  } else {
    msg.textContent = 'Нет тройки — билет пустой';
  }
  document.getElementById('scratch-buy').disabled = false;
}

document.getElementById('scratch-buy').addEventListener('click', () => {
  if (playing) return;
  if (balance < currentBet) { msg.textContent = 'Недостаточно средств!'; return; }
  updateBalance(-currentBet);
  playing = true;
  msg.textContent = 'Сотри все клетки!';
  document.getElementById('scratch-buy').disabled = true;
  build();
});
build();
