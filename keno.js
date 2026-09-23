const PAY = {1:0,2:1,3:2,4:5,5:12,6:25,7:50,8:100,9:200,10:500};
let currentBet = 100, selected = new Set(), drawing = false;
const grid = document.getElementById('keno-grid');
const pickedEl = document.getElementById('keno-picked');
const betEl = document.getElementById('current-bet');
const msg = document.getElementById('keno-msg');

for (let i = 1; i <= 40; i++) {
  const b = document.createElement('button');
  b.className = 'keno-num';
  b.textContent = i;
  b.dataset.n = i;
  b.addEventListener('click', () => {
    if (drawing) return;
    if (selected.has(i)) selected.delete(i);
    else if (selected.size < 10) selected.add(i);
    b.classList.toggle('selected', selected.has(i));
    pickedEl.textContent = selected.size;
  });
  grid.appendChild(b);
}

document.querySelectorAll('#chip-row .chip').forEach(c => {
  c.addEventListener('click', () => {
    if (drawing) return;
    document.querySelectorAll('#chip-row .chip').forEach(x => x.classList.remove('active'));
    c.classList.add('active');
    currentBet = +c.dataset.bet;
    betEl.textContent = fmtMoney(currentBet);
  });
});
document.getElementById('custom-bet-apply')?.addEventListener('click', () => {
  if (drawing) return;
  const v = Math.floor(+document.getElementById('custom-bet-input').value);
  if (v >= 1) { currentBet = v; betEl.textContent = fmtMoney(v); }
});
document.getElementById('keno-clear').onclick = () => {
  if (drawing) return;
  selected.clear();
  grid.querySelectorAll('.keno-num').forEach(b => b.classList.remove('selected','hit','drawn'));
  pickedEl.textContent = '0';
  msg.textContent = '';
};

document.getElementById('keno-play').onclick = () => {
  if (drawing || selected.size === 0) { msg.textContent = 'Выбери хотя бы 1 число'; return; }
  if (balance < currentBet) { msg.textContent = 'Недостаточно средств!'; return; }
  drawing = true;
  updateBalance(-currentBet);
  grid.querySelectorAll('.keno-num').forEach(b => b.classList.remove('hit','drawn'));
  const pool = Array.from({length:40},(_,i)=>i+1);
  const drawn = [];
  for (let i = 0; i < 10; i++) {
    const idx = Math.floor(Math.random()*pool.length);
    drawn.push(pool.splice(idx,1)[0]);
  }
  let i = 0;
  const iv = setInterval(() => {
    const n = drawn[i];
    const el = grid.querySelector(`[data-n="${n}"]`);
    if (el) {
      el.classList.add('drawn');
      if (selected.has(n)) el.classList.add('hit');
    }
    i++;
    if (i >= 10) {
      clearInterval(iv);
      const hits = drawn.filter(n => selected.has(n)).length;
      const mult = PAY[hits] || 0;
      if (mult > 0) {
        const win = currentBet * mult;
        updateBalance(win);
        if (mult >= 25) {
    try { if (window.SFX) SFX.cashout(); } catch(e) {}
    showWinOverlay(hits + ' совпадений!', '+' + fmtMoney(win));
  } else msg.textContent = `Совпадений: ${hits} → ×${mult} = +${fmtMoney(win)}`;
      } else {
        msg.textContent = `Совпадений: ${hits} — без выигрыша`;
      }
      drawing = false;
    }
  }, 180);
};
