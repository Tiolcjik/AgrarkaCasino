const VALS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const SUITS = ['♠','♥','♦','♣'];
const PAYOUTS = {
  'Royal Flush': 250, 'Straight Flush': 50, 'Four of a Kind': 25,
  'Full House': 9, 'Flush': 6, 'Straight': 4,
  'Three of a Kind': 3, 'Two Pair': 2, 'Jacks or Better': 1
};
let currentBet = 100, hand = [], held = [false,false,false,false,false], phase = 'idle', deck = [];
const handEl = document.getElementById('poker-hand');
const rankEl = document.getElementById('poker-rank');
const msg = document.getElementById('poker-msg');
const dealBtn = document.getElementById('poker-deal');
const drawBtn = document.getElementById('poker-draw');
const betEl = document.getElementById('current-bet');

document.querySelectorAll('#chip-row .chip').forEach(c => {
  c.addEventListener('click', () => {
    if (phase !== 'idle') return;
    document.querySelectorAll('#chip-row .chip').forEach(x => x.classList.remove('active'));
    c.classList.add('active');
    currentBet = +c.dataset.bet;
    betEl.textContent = fmtMoney(currentBet);
  });
});
document.getElementById('custom-bet-apply')?.addEventListener('click', () => {
  if (phase !== 'idle') return;
  const v = Math.floor(+document.getElementById('custom-bet-input').value);
  if (v >= 1) { currentBet = v; betEl.textContent = fmtMoney(v); }
});

function newDeck() {
  const d = [];
  VALS.forEach(v => SUITS.forEach(s => d.push({v, s})));
  for (let i = d.length-1; i > 0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [d[i],d[j]] = [d[j],d[i]];
  }
  return d;
}
function render() {
  handEl.innerHTML = '';
  hand.forEach((c, i) => {
    const el = document.createElement('div');
    el.className = 'poker-card' + ((c.s==='♥'||c.s==='♦')?' red':'') + (held[i]?' held':'');
    el.innerHTML = `<span>${c.v}</span><span class="suit">${c.s}</span>`;
    if (phase === 'hold') {
      el.addEventListener('click', () => {
        held[i] = !held[i];
        render();
      });
    }
    handEl.appendChild(el);
  });
}

function rankValue(v) {
  return VALS.indexOf(v);
}
function evaluate(cards) {
  const vs = cards.map(c => rankValue(c.v)).sort((a,b)=>a-b);
  const ss = cards.map(c => c.s);
  const counts = {};
  vs.forEach(v => counts[v] = (counts[v]||0)+1);
  const cnts = Object.values(counts).sort((a,b)=>b-a);
  const flush = ss.every(s => s === ss[0]);
  const straight = vs.every((v,i) => i===0 || v === vs[i-1]+1) ||
    (vs.join(',') === '0,1,2,3,12'); // A-2-3-4-5
  const royal = flush && straight && vs[0] === 8; // 10-A
  if (royal) return 'Royal Flush';
  if (flush && straight) return 'Straight Flush';
  if (cnts[0] === 4) return 'Four of a Kind';
  if (cnts[0] === 3 && cnts[1] === 2) return 'Full House';
  if (flush) return 'Flush';
  if (straight) return 'Straight';
  if (cnts[0] === 3) return 'Three of a Kind';
  if (cnts[0] === 2 && cnts[1] === 2) return 'Two Pair';
  if (cnts[0] === 2) {
    const pairVal = +Object.keys(counts).find(k => counts[k]===2);
    if (pairVal >= 9) return 'Jacks or Better'; // J=9,Q=10,K=11,A=12
  }
  return null;
}

dealBtn.addEventListener('click', () => {
  if (phase !== 'idle') return;
  if (balance < currentBet) { msg.textContent = 'Недостаточно средств!'; return; }
  updateBalance(-currentBet);
  deck = newDeck();
  hand = [deck.pop(),deck.pop(),deck.pop(),deck.pop(),deck.pop()];
  held = [false,false,false,false,false];
  phase = 'hold';
  render();
  rankEl.textContent = evaluate(hand) || '';
  dealBtn.classList.add('hidden');
  drawBtn.classList.remove('hidden');
  msg.textContent = 'Выбери карты для HOLD, затем «Замена»';
});

drawBtn.addEventListener('click', () => {
  if (phase !== 'hold') return;
  for (let i = 0; i < 5; i++) {
    if (!held[i]) hand[i] = deck.pop();
  }
  held = [false,false,false,false,false];
  phase = 'idle';
  render();
  const rank = evaluate(hand);
  rankEl.textContent = rank || 'Ничего';
  if (rank && PAYOUTS[rank]) {
    const win = currentBet * PAYOUTS[rank];
    updateBalance(win);
    if (PAYOUTS[rank] >= 9) {
    try { if (window.SFX) SFX.cashout(); } catch(e) {}
    showWinOverlay(rank, '+' + fmtMoney(win));
  } else msg.textContent = rank + ' — +' + fmtMoney(win);
  } else {
    msg.textContent = 'Нет комбинации';
  }
  dealBtn.classList.remove('hidden');
  drawBtn.classList.add('hidden');
});
