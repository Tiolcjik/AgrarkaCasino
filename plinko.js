const MULTIPLIERS = [0.2, 0.5, 1, 2, 5, 10, 5, 2, 1, 0.5, 0.2];
const ROWS = 8;
const board = document.getElementById('plinko-board');
const pegsEl = document.getElementById('plinko-pegs');
const slotsEl = document.getElementById('plinko-slots');
const dropBtn = document.getElementById('drop-btn');
const msg = document.getElementById('plinko-message');
const chipRow = document.getElementById('chip-row');
const betEl = document.getElementById('current-bet');

let currentBet = 100;
let dropping = false;

betEl.textContent = fmtMoney(currentBet);
chipRow.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    if (dropping) return;
    chipRow.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    currentBet = parseInt(chip.dataset.bet);
    betEl.textContent = fmtMoney(currentBet);
  });
});

function buildBoard() {
  pegsEl.innerHTML = '';
  for (let r = 0; r < ROWS; r++) {
    const row = document.createElement('div');
    row.className = 'plinko-row';
    const count = r + 3;
    for (let i = 0; i < count; i++) {
      const peg = document.createElement('div');
      peg.className = 'plinko-peg';
      row.appendChild(peg);
    }
    pegsEl.appendChild(row);
  }
  slotsEl.innerHTML = '';
  MULTIPLIERS.forEach(m => {
    const s = document.createElement('div');
    s.className = 'plinko-slot';
    s.textContent = '×' + m;
    if (m >= 5) s.style.color = 'var(--gold-bright)';
    if (m >= 10) s.style.borderColor = 'var(--gold)';
    slotsEl.appendChild(s);
  });
}
buildBoard();

function drop() {
  if (dropping) return;
  if (balance < currentBet) {
    msg.textContent = 'Недостаточно средств!';
    return;
  }
  dropping = true;
  dropBtn.disabled = true;
  updateBalance(-currentBet);
  msg.textContent = '';
  if (Math.random() < 0.35) showRandomFlavor();

  const ball = document.createElement('div');
  ball.className = 'plinko-ball';
  board.appendChild(ball);

  const boardRect = board.getBoundingClientRect();
  let x = boardRect.width / 2 - 8;
  let y = 10;
  ball.style.left = x + 'px';
  ball.style.top = y + 'px';

  let path = 0;
  const steps = ROWS;
  let step = 0;

  function animate() {
    if (step < steps) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      path += dir === 1 ? 1 : 0;
      x += dir * (14 + Math.random() * 6);
      y += 28;
      ball.style.left = Math.max(20, Math.min(boardRect.width - 36, x)) + 'px';
      ball.style.top = y + 'px';
      step++;
      setTimeout(animate, 120);
    } else {
      // land in slot
      const slotIdx = Math.min(MULTIPLIERS.length - 1, Math.max(0, Math.round((x / boardRect.width) * (MULTIPLIERS.length - 1))));
      const mult = MULTIPLIERS[slotIdx];
      const win = Math.round(currentBet * mult);
      if (win > 0) {
        updateBalance(win);
        if (mult >= 5) {
    try { if (window.SFX) SFX.cashout(); } catch(e) {}
    showWinOverlay('×' + mult + '!', '+' + fmtMoney(win));
  } else msg.textContent = '🎉 ×' + mult + ' — +' + fmtMoney(win);
      } else {
        msg.textContent = 'Шарик упал в ×' + mult + ' — без выигрыша';
      }
      setTimeout(() => {
        ball.remove();
        dropping = false;
        dropBtn.disabled = false;
      }, 600);
    }
  }
  setTimeout(animate, 80);
}

dropBtn.addEventListener('click', drop);


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
