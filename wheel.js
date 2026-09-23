const SEGMENTS = [
  { mult: 1, color: '#3a2c63' },
  { mult: 2, color: '#8a5cff' },
  { mult: 0, color: '#1a1028' },
  { mult: 5, color: '#d4af37' },
  { mult: 1, color: '#3a2c63' },
  { mult: 10, color: '#ff2e9a' },
  { mult: 0, color: '#1a1028' },
  { mult: 2, color: '#00e5ff' },
  { mult: 1, color: '#3a2c63' },
  { mult: 3, color: '#00ff88' },
  { mult: 0, color: '#1a1028' },
  { mult: 52, color: '#ffe08a' }
];
const wheel = document.getElementById('fortune-wheel');
const spinBtn = document.getElementById('spin-wheel-btn');
const msg = document.getElementById('wheel-message');
const chipRow = document.getElementById('chip-row');
const betEl = document.getElementById('current-bet');

let currentBet = 100;
let spinning = false;
let rotation = 0;

betEl.textContent = fmtMoney(currentBet);
chipRow.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    if (spinning) return;
    chipRow.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    currentBet = parseInt(chip.dataset.bet);
    betEl.textContent = fmtMoney(currentBet);
  });
});

const n = SEGMENTS.length;
const angle = 360 / n;
SEGMENTS.forEach((seg, i) => {
  const el = document.createElement('div');
  el.className = 'seg';
  el.style.background = `conic-gradient(from ${i * angle}deg, ${seg.color} 0deg, ${seg.color} ${angle}deg, transparent ${angle}deg)`;
  el.style.transform = `rotate(${i * angle}deg)`;
  el.style.clipPath = `polygon(0 100%, 100% 100%, 50% 0)`;
  el.style.width = '50%';
  el.style.height = '50%';
  el.style.left = '50%';
  el.style.top = '0';
  el.style.transformOrigin = '0% 100%';
  el.style.background = seg.color;
  el.textContent = seg.mult === 0 ? '×0' : '×' + seg.mult;
  el.style.fontSize = seg.mult >= 10 ? '15px' : '12px';
  el.style.color = seg.mult >= 5 ? '#1a1000' : '#fff';
  wheel.appendChild(el);
});

// simpler visual: colored pie via CSS background
wheel.style.background = `conic-gradient(${SEGMENTS.map((s, i) => `${s.color} ${i * angle}deg ${(i + 1) * angle}deg`).join(',')})`;
wheel.innerHTML = '';
SEGMENTS.forEach((seg, i) => {
  const label = document.createElement('div');
  label.style.cssText = `
    position:absolute; left:50%; top:50%;
    width:50%; height:2px;
    transform-origin:0 0;
    transform: rotate(${i * angle + angle/2}deg);
    pointer-events:none;
  `;
  const txt = document.createElement('span');
  txt.textContent = seg.mult === 0 ? '×0' : '×' + seg.mult;
  txt.style.cssText = `
    position:absolute; left:55%; top:-8px;
    font-size:11px; font-weight:800;
    color:${seg.mult >= 5 ? '#1a1000' : '#fff'};
    text-shadow:0 0 4px rgba(0,0,0,0.5);
    white-space:nowrap;
  `;
  label.appendChild(txt);
  wheel.appendChild(label);
});

spinBtn.addEventListener('click', () => {
  if (spinning) return;
  if (balance < currentBet) {
    msg.textContent = 'Недостаточно средств!';
    return;
  }
  spinning = true;
  spinBtn.disabled = true;
  updateBalance(-currentBet);
  msg.textContent = '';
  if (Math.random() < 0.35) showRandomFlavor();

  const idx = Math.floor(Math.random() * n);
  const extraSpins = 5 + Math.floor(Math.random() * 3);
  rotation += 360 * extraSpins + (360 - idx * angle - angle / 2);
  wheel.style.transform = `rotate(${rotation}deg)`;

  setTimeout(() => {
    const mult = SEGMENTS[idx].mult;
    if (mult > 0) {
      const win = currentBet * mult;
      updateBalance(win);
      if (mult >= 10) {
    try { if (window.SFX) SFX.cashout(); } catch(e) {}
    showWinOverlay('×' + mult + '!', '+' + fmtMoney(win));
  } else msg.textContent = '🎉 ×' + mult + ' — +' + fmtMoney(win);
    } else {
      msg.textContent = 'Выпало ×0 — ставка сгорела';
    }
    spinning = false;
    spinBtn.disabled = false;
  }, 4200);
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
    
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') btn.click(); });
})();
