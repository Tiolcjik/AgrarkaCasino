const face = document.getElementById('dice-face');
const targetEl = document.getElementById('dice-target');
const multEl = document.getElementById('dice-mult');
const slider = document.getElementById('dice-slider');
const rollBtn = document.getElementById('roll-btn');
const msg = document.getElementById('dice-message');
const chipRow = document.getElementById('chip-row');
const betEl = document.getElementById('current-bet');

let currentBet = 100;
let mode = 'under';
let target = 50;
let rolling = false;

function calcMult() {
  const chance = mode === 'under' ? target : (100 - target);
  const mult = (99 / Math.max(1, chance)) * 0.97;
  return Math.max(1.01, Math.round(mult * 100) / 100);
}
function refresh() {
  target = parseInt(slider.value);
  targetEl.textContent = target;
  multEl.textContent = '×' + calcMult().toFixed(2);
  betEl.textContent = fmtMoney(currentBet);
}
refresh();

slider.addEventListener('input', refresh);
document.querySelectorAll('.dice-mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.dice-mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    mode = btn.dataset.mode;
    refresh();
  });
});
chipRow.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    if (rolling) return;
    chipRow.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    currentBet = parseInt(chip.dataset.bet);
    refresh();
  });
});

rollBtn.addEventListener('click', () => {
  if (rolling) return;
  if (balance < currentBet) {
    msg.textContent = 'Недостаточно средств!';
    return;
  }
  rolling = true;
  rollBtn.disabled = true;
  updateBalance(-currentBet);
  msg.textContent = '';
  face.classList.add('rolling');
  if (Math.random() < 0.3) showRandomFlavor();

  let ticks = 0;
  const iv = setInterval(() => {
    face.textContent = (Math.floor(Math.random() * 99) + 1);
    ticks++;
    if (ticks > 12) {
      clearInterval(iv);
      face.classList.remove('rolling');
      const roll = Math.floor(Math.random() * 100) + 1;
      face.textContent = roll;
      const win = (mode === 'under' && roll < target) || (mode === 'over' && roll > target);
      const mult = calcMult();
      if (win) {
        const amount = Math.round(currentBet * mult);
        updateBalance(amount);
        if (mult >= 3) {
    try { if (window.SFX) SFX.cashout(); } catch(e) {}
    showWinOverlay('×' + mult.toFixed(2), '+' + fmtMoney(amount));
  } else msg.textContent = '🎉 Выпало ' + roll + ' — +' + fmtMoney(amount);
      } else {
        msg.textContent = 'Выпало ' + roll + ' — не в этот раз';
      }
      rolling = false;
      rollBtn.disabled = false;
    }
  }, 60);
});


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
    refresh();
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') btn.click(); });
})();
