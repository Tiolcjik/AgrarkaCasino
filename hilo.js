const ranks = [1,2,3,4,5,6,7,8,9,10,11,12,13];
const labels = {1:'A',11:'J',12:'Q',13:'K'};
const suits = ['♠','♥','♦','♣'];
let currentBet = 100, card = 7, mult = 1, active = false, pot = 0;
const cardEl = document.getElementById('hilo-card');
const multEl = document.getElementById('hilo-mult');
const cashEl = document.getElementById('hilo-cash');
const msg = document.getElementById('hilo-msg');
const startBtn = document.getElementById('hilo-start');
const cashBtn = document.getElementById('hilo-cashout');
const btns = document.getElementById('hilo-btns');

document.querySelectorAll('#chip-row .chip').forEach(c => {
  c.addEventListener('click', () => {
    if (active) return;
    document.querySelectorAll('#chip-row .chip').forEach(x => x.classList.remove('active'));
    c.classList.add('active');
    currentBet = +c.dataset.bet;
  });
});
document.getElementById('custom-bet-apply')?.addEventListener('click', () => {
  if (active) return;
  const v = Math.floor(+document.getElementById('custom-bet-input').value);
  if (v >= 1) { currentBet = v; document.querySelectorAll('#chip-row .chip').forEach(x => x.classList.remove('active')); }
});

function drawCard() {
  return { r: ranks[Math.floor(Math.random()*13)], s: suits[Math.floor(Math.random()*4)] };
}
function showCard(c) {
  const lab = labels[c.r] || c.r;
  cardEl.textContent = lab + c.s;
  cardEl.className = 'hilo-card-big' + ((c.s==='♥'||c.s==='♦') ? ' red' : '');
}
function refresh() {
  multEl.textContent = '×' + mult.toFixed(2);
  cashEl.textContent = fmtMoney(Math.round(pot * mult));
}

startBtn.addEventListener('click', () => {
  if (active) return;
  if (balance < currentBet) { msg.textContent = 'Недостаточно средств!'; return; }
  updateBalance(-currentBet);
  pot = currentBet; mult = 1; active = true;
  card = drawCard(); showCard(card); refresh();
  startBtn.classList.add('hidden'); cashBtn.classList.remove('hidden'); btns.classList.remove('hidden');
  msg.textContent = 'Выше или ниже?';
});

function guess(higher) {
  if (!active) return;
  const next = drawCard();
  const win = higher ? next.r > card.r : next.r < card.r;
  const tie = next.r === card.r;
  showCard(next);
  if (tie) { msg.textContent = 'Ничья — карта та же, множитель без изменений'; card = next; return; }
  if (win) {
    mult *= 1.45;
    card = next; refresh();
    msg.textContent = 'Верно! Множитель ×' + mult.toFixed(2);
    if (mult >= 5) try { if (window.SFX) SFX.cashout(); } catch(e) {}
    showWinOverlay('Серия ×' + mult.toFixed(2), 'Можно забрать ' + fmtMoney(Math.round(pot*mult)));
  } else {
    msg.textContent = 'Не угадал — ставка сгорела';
    end();
  }
}
document.getElementById('hilo-hi').onclick = () => guess(true);
document.getElementById('hilo-lo').onclick = () => guess(false);

cashBtn.addEventListener('click', () => {
  if (!active) return;
  const win = Math.round(pot * mult);
  updateBalance(win);
  msg.textContent = 'Забрано +' + fmtMoney(win);
  if (win >= 300) showWinOverlay('Hi-Lo!', '+' + fmtMoney(win));
  end();
});
function end() {
  active = false; mult = 1; pot = 0; refresh();
  startBtn.classList.remove('hidden'); cashBtn.classList.add('hidden'); btns.classList.add('hidden');
}
