/* =========================================================
   BLACKJACK.JS — сплит, доллары, VIP-стол
   ========================================================= */

const dealerCardsEl = document.getElementById('dealer-cards');
const dealerScoreEl = document.getElementById('dealer-score');
const playerHandsEl = document.getElementById('player-hands');
const dealBtn = document.getElementById('deal-btn');
const hitBtn = document.getElementById('hit-btn');
const doubleBtn = document.getElementById('double-btn');
const splitBtn = document.getElementById('split-btn');
const standBtn = document.getElementById('stand-btn');
const bjMessage = document.getElementById('bj-message');
const chipRow = document.getElementById('chip-row');
const currentBetEl = document.getElementById('current-bet');

let currentBet = 100;
let deck = [];
let dealerHand = [];
let hands = [];        // [{ cards:[], bet:number, done:bool, resultText:string|null }]
let activeHandIndex = 0;
let roundOver = true;

currentBetEl.textContent = fmtMoney(currentBet);

// ---------- Chip selector ----------
chipRow.querySelectorAll('.chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    if (!roundOver) return;
    chipRow.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    currentBet = parseInt(chip.dataset.bet);
    currentBetEl.textContent = fmtMoney(currentBet);
  });
});

// ---------- Deck ----------
function createDeck() {
  const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const suits = ['♠', '♥', '♦', '♣'];
  const newDeck = [];

  for (const s of suits) {
    for (const v of values) newDeck.push({ value: v, suit: s });
  }
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
}

function cardValue(card) {
  if (card.value === 'A') return 11;
  if (['J', 'Q', 'K'].includes(card.value)) return 10;
  return parseInt(card.value);
}

function rankGroup(card) {
  if (['10', 'J', 'Q', 'K'].includes(card.value)) return '10';
  return card.value;
}

function handScore(hand) {
  let score = 0, aces = 0;
  hand.forEach((c) => { score += cardValue(c); if (c.value === 'A') aces++; });
  while (score > 21 && aces > 0) { score -= 10; aces--; }
  return score;
}

function renderCard(card) {
  const el = document.createElement('div');
  el.className = 'card' + ((card.suit === '♥' || card.suit === '♦') ? ' red-suit' : '');
  el.textContent = card.value + card.suit;
  return el;
}

function renderHands(hideDealerSecond) {
  dealerCardsEl.innerHTML = '';
  dealerHand.forEach((card, i) => {
    if (i === 1 && hideDealerSecond) {
      const back = document.createElement('div');
      back.className = 'card back';
      back.textContent = '?';
      dealerCardsEl.appendChild(back);
    } else {
      dealerCardsEl.appendChild(renderCard(card));
    }
  });
  dealerScoreEl.textContent = hideDealerSecond ? '?' : handScore(dealerHand);

  playerHandsEl.innerHTML = '';
  hands.forEach((hand, idx) => {
    const block = document.createElement('div');
    block.className = 'hand-block' + (!roundOver && idx === activeHandIndex && hands.length > 1 ? ' active-hand' : '');

    const label = document.createElement('p');
    label.className = 'bj-row-label';
    const title = hands.length > 1 ? `Рука ${idx + 1}` : 'Твоя рука';
    label.innerHTML = `${title} <span class="score-badge">${handScore(hand.cards)}</span>` +
      (hand.resultText ? ` <span style="color:var(--text-dim);font-size:12px;">— ${hand.resultText}</span>` : '');
    block.appendChild(label);

    const row = document.createElement('div');
    row.className = 'cards-row';
    hand.cards.forEach((card) => row.appendChild(renderCard(card)));
    block.appendChild(row);

    playerHandsEl.appendChild(block);
  });
}

function setChipsDisabled(disabled) {
  chipRow.querySelectorAll('.chip').forEach((c) => (c.style.pointerEvents = disabled ? 'none' : 'auto'));
  chipRow.style.opacity = disabled ? 0.5 : 1;
}

function totalRoundBet() {
  return hands.reduce((sum, h) => sum + h.bet, 0);
}

// ---------- Round flow ----------
function startGame() {
  if (balance < currentBet) {
    bjMessage.textContent = 'Недостаточно средств на счету!';
    return;
  }

  roundOver = false;
  updateBalance(-currentBet);
  if (Math.random() < 0.4) showRandomFlavor();

  deck = createDeck();
  hands = [{ cards: [deck.pop(), deck.pop()], bet: currentBet, done: false, resultText: null }];
  dealerHand = [deck.pop(), deck.pop()];
  activeHandIndex = 0;

  bjMessage.textContent = '';
  renderHands(true);
  setChipsDisabled(true);

  dealBtn.classList.add('hidden');
  hitBtn.classList.remove('hidden');
  standBtn.classList.remove('hidden');

  refreshActionButtons();

  if (handScore(hands[0].cards) === 21) {
    hands[0].resultText = null;
    finishAllHands(true);
  }
}

function refreshActionButtons() {
  if (roundOver || !hands[activeHandIndex]) {
    doubleBtn.classList.add('hidden');
    splitBtn.classList.add('hidden');
    return;
  }
  const hand = hands[activeHandIndex];
  const canAct = hand.cards.length === 2;
  doubleBtn.classList.toggle('hidden', !(canAct && balance >= hand.bet));

  const c0 = hand.cards[0], c1 = hand.cards[1];
  const canSplit = hands.length === 1 && canAct && rankGroup(c0) === rankGroup(c1) && balance >= hand.bet;
  splitBtn.classList.toggle('hidden', !canSplit);
}

function hit() {
  const hand = hands[activeHandIndex];
  hand.cards.push(deck.pop());
  renderHands(true);
  refreshActionButtons();

  if (handScore(hand.cards) > 21) {
    hand.resultText = '💥 перебор';
    advanceOrFinish();
  } else if (handScore(hand.cards) === 21) {
    advanceOrFinish();
  }
}

function doubleDown() {
  const hand = hands[activeHandIndex];
  if (balance < hand.bet) return;
  updateBalance(-hand.bet);
  hand.bet *= 2;
  hand.cards.push(deck.pop());
  renderHands(true);

  if (handScore(hand.cards) > 21) hand.resultText = '💥 перебор';
  advanceOrFinish();
}

function splitHand() {
  const hand = hands[activeHandIndex];
  if (hands.length !== 1 || hand.cards.length !== 2) return;
  if (balance < hand.bet) return;

  updateBalance(-hand.bet);
  const secondCard = hand.cards.pop();
  const newHand = { cards: [secondCard, deck.pop()], bet: hand.bet, done: false, resultText: null };
  hand.cards.push(deck.pop());
  hands.push(newHand);

  renderHands(true);
  refreshActionButtons();
  bjMessage.textContent = 'Сплит! Играешь руку 1 из 2';
}

function stand() {
  advanceOrFinish();
}

function advanceOrFinish() {
  if (activeHandIndex < hands.length - 1) {
    activeHandIndex++;
    bjMessage.textContent = `Играешь руку ${activeHandIndex + 1} из ${hands.length}`;
    renderHands(true);
    refreshActionButtons();
  } else {
    finishAllHands(false);
  }
}

function finishAllHands(naturalBlackjack) {
  const anyAlive = hands.some((h) => handScore(h.cards) <= 21);
  if (anyAlive) {
    while (handScore(dealerHand) < 17) dealerHand.push(deck.pop());
  }
  const dealerScore = handScore(dealerHand);
  renderHands(false);

  let totalWin = 0;
  const summaries = [];

  hands.forEach((hand, idx) => {
    const playerScore = handScore(hand.cards);
    const label = hands.length > 1 ? `Рука ${idx + 1}` : 'Рука';

    if (playerScore > 21) {
      hand.resultText = 'перебор';
      summaries.push(`${label}: перебор`);
      return;
    }

    if (naturalBlackjack && hands.length === 1 && dealerScore !== 21) {
      const win = Math.round(hand.bet * 2.5);
      totalWin += win;
      hand.resultText = `блэкджек +${fmtMoney(win)}`;
      summaries.push(`${label}: блэкджек! +${fmtMoney(win)} (×2.5)`);
      return;
    }

    if (dealerScore > 21 || playerScore > dealerScore) {
      const win = hand.bet * 2;
      totalWin += win;
      hand.resultText = `победа +${fmtMoney(win)}`;
      summaries.push(`${label}: победа +${fmtMoney(win)}`);
    } else if (playerScore === dealerScore) {
      totalWin += hand.bet;
      hand.resultText = 'ничья';
      summaries.push(`${label}: ничья, возврат ${fmtMoney(hand.bet)}`);
    } else {
      hand.resultText = 'проигрыш';
      summaries.push(`${label}: дилер победил`);
    }
  });

  if (totalWin > 0) updateBalance(totalWin);
  renderHands(false);

  if (naturalBlackjack && hands.length === 1 && dealerScore !== 21) {
    try { if (window.SFX) SFX.cashout(); } catch(e) {}
    showWinOverlay('Блэкджек! 🂡', summaries[0]);
  } else if (totalWin >= 500) {
    showWinOverlay('Победа!', `+${fmtMoney(totalWin)}`);
  } else {
    bjMessage.textContent = summaries.join(' · ');
  }

  endRound();
}

function endRound() {
  roundOver = true;
  hitBtn.classList.add('hidden');
  doubleBtn.classList.add('hidden');
  splitBtn.classList.add('hidden');
  standBtn.classList.add('hidden');
  dealBtn.classList.remove('hidden');
  setChipsDisabled(false);
}

dealBtn.addEventListener('click', startGame);
hitBtn.addEventListener('click', hit);
doubleBtn.addEventListener('click', doubleDown);
splitBtn.addEventListener('click', splitHand);
standBtn.addEventListener('click', stand);


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
