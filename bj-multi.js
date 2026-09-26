/**
 * Блэкджек 1v1 — два игрока, без дилера.
 * Ставки с баланса → в банк. Своя сумма + чипы.
 * Перебор скрыт до конца раунда.
 * Оба перебор → надпись, возврат банка, новая раздача.
 */
(function () {
  'use strict';
  const SUITS = ['♠', '♥', '♦', '♣'];
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const MIN_DEFAULT = 10;
  const MAX_PLAYERS = 2;
  const roomCode = (new URLSearchParams(location.search).get('room') || '').toUpperCase();
  const el = (id) => document.getElementById(id);
  if (el('room-code')) el('room-code').textContent = roomCode || '—';

  let myUid = null, room = null, lastEndSeq = 0, lastPaidRound = null;
  let startingLock = false, finishLock = false, bothBustRestartLock = false;
  let myBetChoice = 10;

  function fmt(n) {
    if (typeof fmtUAH === 'function') return fmtUAH(n);
    return Math.floor(Number(n) || 0).toLocaleString('uk-UA') + ' ₴';
  }
  function bal() {
    try {
      if (window.CasinoReal && typeof CasinoReal.getRealBalanceSync === 'function')
        return Math.max(0, Math.floor(CasinoReal.getRealBalanceSync()));
    } catch (e) {}
    return 0;
  }
  async function refreshBalPill() {
    try {
      if (window.CasinoReal) {
        await CasinoReal.getRealBalance();
        const a = el('balance-amount');
        if (a) a.textContent = typeof fmtUAH === 'function' ? fmtUAH(bal(), true) : bal() + ' ₴';
      }
    } catch (e) {}
  }
  async function setBal(amount) {
    const v = Math.max(0, Math.floor(Number(amount) || 0));
    if (window.CasinoReal && typeof CasinoReal.setRealBalance === 'function') {
      try { await CasinoReal.setRealBalance(null, v); } catch (e) {}
    }
    await refreshBalPill();
  }

  function makeDeck() {
    const d = [];
    for (const s of SUITS) for (const r of RANKS) d.push(r + s);
    for (let i = d.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
  }
  function parse(c) {
    if (typeof c !== 'string' || c.length < 2) return null;
    const suit = c.slice(-1), rank = c.slice(0, -1);
    if (!SUITS.includes(suit) || !RANKS.includes(rank)) return null;
    return { raw: c, rank, suit, red: suit === '♥' || suit === '♦' };
  }
  function cardVal(c) {
    const p = parse(c);
    if (!p) return 0;
    if (p.rank === 'A') return 11;
    if (['J', 'Q', 'K'].includes(p.rank)) return 10;
    return parseInt(p.rank, 10) || 0;
  }
  function handScore(cards) {
    let s = 0, aces = 0;
    (cards || []).forEach((c) => { s += cardVal(c); if (parse(c) && parse(c).rank === 'A') aces++; });
    while (s > 21 && aces > 0) { s -= 10; aces--; }
    return s;
  }
  function cardHTML(c, hide) {
    if (hide || !c) return '<div class="card back">?</div>';
    const p = parse(c);
    if (!p) return '<div class="card back">?</div>';
    return '<div class="card' + (p.red ? ' red' : '') + '"><div class="r">' + p.rank + '</div><div class="s">' + p.suit + '</div></div>';
  }
  function minStake() {
    return Math.max(1, Math.floor(Number(room && room.info && room.info.minBet) || MIN_DEFAULT));
  }
  function potOf(game, players) {
    if (game && game.pot != null) return Math.floor(Number(game.pot) || 0);
    let sum = 0;
    Object.values(players || {}).forEach((p) => { sum += Math.floor(Number(p.bet) || 0); });
    return sum;
  }

  function getChosenBet() {
    const min = minStake();
    const inp = el('bet-custom');
    if (inp && inp.value !== '' && inp.value != null) {
      const v = Math.floor(Number(inp.value));
      if (!Number.isNaN(v) && v >= min) return v;
    }
    return Math.max(min, Math.floor(myBetChoice || min));
  }

  function setChosenBet(v, fromChip) {
    const min = minStake();
    const val = Math.max(min, Math.floor(Number(v) || min));
    myBetChoice = val;
    const inp = el('bet-custom');
    if (inp && (fromChip || document.activeElement !== inp)) {
      inp.value = String(val);
      inp.min = String(min);
    }
    const box = el('bet-chips');
    if (box) {
      box.querySelectorAll('.bet-chip').forEach((b) => {
        b.classList.toggle('active', Number(b.dataset.b) === val);
      });
    }
  }

  async function syncMoney(data) {
    if (!myUid || !data) return;
    const me = data.players && data.players[myUid];
    if (!me) return;
    const game = data.game || {};
    const status = data.info && data.info.status;
    const rid = game.roundId;
    if (status === 'playing' && rid && lastPaidRound !== rid) {
      const fb = Math.floor(Number(me.stack));
      if (!Number.isNaN(fb) && fb >= 0) await setBal(fb);
      lastPaidRound = rid;
    }
    if ((status === 'ended' || game.phase === 'ended') && game.endSeq && game.endSeq !== lastEndSeq) {
      const fb = Math.floor(Number(me.stack));
      if (!Number.isNaN(fb) && fb >= 0) await setBal(fb);
    }
  }

  function render() {
    if (!room) return;
    const players = room.players || {};
    const game = room.game || {};
    const me = players[myUid];
    const status = (room.info && room.info.status) || 'waiting';
    const phase = game.phase || '';
    const pot = potOf(game, players);
    const showResults = phase === 'ended' || status === 'ended' || phase === 'both_bust';

    if (el('min-pill')) {
      el('min-pill').textContent = (status === 'playing' || status === 'ended')
        ? ('Банк: ' + fmt(pot))
        : ('Мин: ' + fmt(minStake()));
    }

    const st = el('status');
    if (st) {
      if (status === 'waiting') st.textContent = '1v1 · ждём соперника';
      else if (status === 'ended') st.textContent = 'Раунд окончен';
      else if (phase === 'betting') st.textContent = 'Ставки в банк';
      else if (phase === 'playing') st.textContent = 'Ход игрока';
      else if (phase === 'both_bust') st.textContent = 'Оба перебор';
      else st.textContent = status;
    }

    const lobby = el('lobby');
    const tableWrap = el('table-wrap');
    if (lobby) lobby.classList.toggle('hidden', status === 'playing');
    if (tableWrap) tableWrap.classList.toggle('dimmed', status === 'waiting');

    const potEl = el('pot-amount');
    if (potEl) {
      if (status === 'playing' || status === 'ended') potEl.textContent = '💰 ' + fmt(pot);
      else potEl.textContent = '—';
    }

    if (status === 'waiting' || status === 'ended') {
      const min = minStake();
      document.querySelectorAll('.stake-chip').forEach((btn) => {
        btn.classList.toggle('active', Number(btn.dataset.stake) === min);
        btn.disabled = !!(me && me.ready && status === 'waiting');
      });
      const lp = el('lobby-players');
      if (lp) {
        const list = Object.entries(players).sort((a, b) => (a[1].seat || 0) - (b[1].seat || 0));
        lp.innerHTML = list.map(([uid, p]) => {
          const cls = ['lobby-p', p.ready ? 'ready' : '', uid === myUid ? 'me' : ''].filter(Boolean).join(' ');
          return '<div class="' + cls + '">' + (p.name || 'Игрок') + (uid === myUid ? ' (ты)' : '') + (p.ready ? ' ✓' : '') + '</div>';
        }).join('');
        if (list.length < 2) {
          lp.innerHTML += '<div class="lobby-p" style="opacity:.5">Ждём 2-го игрока…</div>';
        }
      }
      if (el('lobby-hint')) {
        const n = Object.keys(players).length;
        if (me && me.ready) {
          el('lobby-hint').textContent = n < 2
            ? 'Ждём соперника. Когда оба готовы — ставки в банк.'
            : 'Ждём готовности соперника.';
        } else {
          el('lobby-hint').textContent = '1 на 1 · мин. ставка → «Готов». Нужны двое.';
        }
      }
    }

    const zone = el('players-zone');
    if (zone) {
      if (status !== 'playing' && status !== 'ended') {
        zone.innerHTML = '';
      } else {
        const list = Object.entries(players).sort((a, b) => (a[1].seat || 0) - (b[1].seat || 0));
        zone.innerHTML = list.map(([uid, p]) => {
          const isMe = uid === myUid;
          const isTurn = game.turn === uid;
          const cards = p.hand || [];
          const score = handScore(cards);
          const bust = score > 21;
          // Скрываем карты и очки соперника до конца; своё "Перебор" тоже не светим в .pres до showResults
          const hideOpp = !isMe && !showResults && phase === 'playing';
          // Визуально не подсвечиваем bust сопернику до конца
          const showBustStyle = showResults && bust;
          const cls = ['player-box', isMe ? 'me' : '', isTurn && phase === 'playing' ? 'turn' : '', showBustStyle ? 'bust' : ''].filter(Boolean).join(' ');
          // resultText только после конца раунда (или both_bust)
          const res = showResults ? (p.resultText || '') : '';
          const scoreText = hideOpp ? '?' : (cards.length ? String(score) : '');
          const cardsHtml = hideOpp
            ? cards.map(function () { return cardHTML(null, true); }).join('')
            : cards.map(function (c) { return cardHTML(c); }).join('');
          return '<div class="' + cls + '">' +
            '<div class="pname">' + (p.name || 'Игрок') + (isMe ? ' (ты)' : '') + '</div>' +
            '<div class="pbet">' + (p.bet ? fmt(p.bet) : '—') + '</div>' +
            '<div class="cards-row">' + cardsHtml + '</div>' +
            (scoreText !== '' ? '<div class="pscore">' + scoreText + '</div>' : '') +
            (res ? '<div class="pres">' + res + '</div>' : '') +
            '</div>';
        }).join('');
      }
    }

    const btnReady = el('btn-ready');
    const btnRematch = el('btn-rematch');
    const betPanel = el('bet-panel');
    const actPanel = el('action-panel');
    const msg = el('msg');
    if (btnReady) btnReady.classList.add('hidden');
    if (btnRematch) btnRematch.classList.add('hidden');
    if (betPanel) betPanel.classList.add('hidden');
    if (actPanel) actPanel.classList.add('hidden');

    if (status === 'waiting') {
      if (btnReady) {
        btnReady.classList.remove('hidden');
        btnReady.textContent = (me && me.ready) ? '✓ Готов · ждём' : 'Готов';
        btnReady.disabled = !!(me && me.ready);
      }
    } else if (status === 'ended') {
      if (btnRematch) btnRematch.classList.remove('hidden');
      if (msg) msg.textContent = game.endText || 'Можно сыграть ещё';
    } else if (phase === 'both_bust') {
      if (msg) msg.textContent = 'У обоих перебор · банк сохранён · новая раздача…';
    } else if (phase === 'betting' && me && !me.betPlaced) {
      if (betPanel) betPanel.classList.remove('hidden');
      buildBetChips();
      if (msg) msg.textContent = 'Ставка в банк (мин ' + fmt(minStake()) + ')';
    } else if (phase === 'playing' && game.turn === myUid && me && !me.done) {
      if (actPanel) actPanel.classList.remove('hidden');
      const canDouble = (me.hand || []).length === 2 && bal() >= (me.bet || 0);
      const dbl = el('btn-double');
      if (dbl) dbl.style.display = canDouble ? '' : 'none';
      if (msg) msg.textContent = 'Твой ход: ещё / хватит' + (canDouble ? ' / ×2' : '');
    } else if (phase === 'betting' && me && me.betPlaced) {
      if (msg) msg.textContent = 'Ставка в банке · ждём соперника';
    } else if (phase === 'playing') {
      if (msg) msg.textContent = 'Ход: ' + ((players[game.turn] && players[game.turn].name) || '…');
    }

    if (game.endSeq && game.endSeq !== lastEndSeq && (game.phase === 'ended' || game.phase === 'both_bust')) {
      lastEndSeq = game.endSeq;
      showResult(game, me);
    }
  }

  function buildBetChips() {
    const box = el('bet-chips');
    if (!box) return;
    const min = minStake();
    const opts = [min, min * 2, min * 5, min * 10].filter(function (v, i, a) { return a.indexOf(v) === i; });
    if (myBetChoice < min) myBetChoice = min;
    const inp = el('bet-custom');
    if (inp) {
      inp.min = String(min);
      if (!inp.value || Number(inp.value) < min) inp.value = String(myBetChoice);
    }
    box.innerHTML = opts.map(function (v) {
      return '<button type="button" class="bet-chip' + (v === myBetChoice ? ' active' : '') + '" data-b="' + v + '">' + fmt(v) + '</button>';
    }).join('');
    box.querySelectorAll('.bet-chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setChosenBet(Number(btn.dataset.b) || min, true);
      });
    });
  }

  function showResult(game, me) {
    const ov = el('result-ov');
    if (el('r-title')) el('r-title').textContent = (me && me.resultText) || (game.phase === 'both_bust' ? 'У обоих перебор' : 'Раунд окончен');
    if (el('r-sub')) el('r-sub').textContent = game.endText || '';
    if (ov) {
      ov.classList.add('show');
      setTimeout(function () { ov.classList.remove('show'); }, game.phase === 'both_bust' ? 2800 : 4500);
    }
  }

  async function startRound() {
    if (startingLock) return;
    startingLock = true;
    try {
      const snap = await db.ref('bjRooms/' + roomCode).once('value');
      const data = snap.val();
      if (!data || (data.info && data.info.status === 'playing')) return;
      const players = data.players || {};
      const uids = Object.keys(players);
      if (uids.length !== 2 || !uids.every(function (u) { return players[u].ready; })) return;
      const min = Math.max(1, Math.floor(Number(data.info && data.info.minBet) || MIN_DEFAULT));
      for (var i = 0; i < uids.length; i++) {
        var uid = uids[i];
        if (Math.floor(Number(players[uid].stack) || 0) < min) {
          if (el('msg')) el('msg').textContent = (players[uid].name || 'Игрок') + ' — мало средств';
          return;
        }
      }
      const deck = makeDeck();
      const roundId = 'r' + Date.now();
      const updates = {
        'info/status': 'playing',
        game: {
          phase: 'betting',
          deck: deck,
          pot: 0,
          turn: null,
          minBet: min,
          roundId: roundId,
          seq: Date.now(),
          endSeq: 0
        }
      };
      uids.forEach(function (uid) {
        updates['players/' + uid + '/hand'] = [];
        updates['players/' + uid + '/bet'] = 0;
        updates['players/' + uid + '/betPlaced'] = false;
        updates['players/' + uid + '/done'] = false;
        updates['players/' + uid + '/resultText'] = null;
        updates['players/' + uid + '/ready'] = false;
      });
      await db.ref('bjRooms/' + roomCode).update(updates);
    } finally {
      startingLock = false;
    }
  }

  async function placeBet() {
    if (!myUid || !roomCode) return;
    const min = minStake();
    const amount = getChosenBet();
    if (amount < min) {
      if (el('msg')) el('msg').textContent = 'Минимум ' + fmt(min);
      return;
    }
    const money = bal();
    if (money < amount) {
      if (el('msg')) el('msg').textContent = 'Нужно минимум ' + fmt(amount);
      return;
    }
    const snap = await db.ref('bjRooms/' + roomCode).once('value');
    const data = snap.val();
    if (!data || !data.game || data.game.phase !== 'betting') return;
    const me = data.players && data.players[myUid];
    if (!me || me.betPlaced) return;

    const newStack = Math.max(0, Math.floor(Number(me.stack) || money) - amount);
    const newPot = Math.floor(Number(data.game.pot) || 0) + amount;
    await db.ref('bjRooms/' + roomCode).update({
      ['players/' + myUid + '/bet']: amount,
      ['players/' + myUid + '/betPlaced']: true,
      ['players/' + myUid + '/stack']: newStack,
      'game/pot': newPot
    });
    await setBal(newStack);

    const snap2 = await db.ref('bjRooms/' + roomCode).once('value');
    const d2 = snap2.val();
    if (!d2) return;
    const plist = Object.values(d2.players || {});
    if (plist.length === 2 && plist.every(function (p) { return p.betPlaced; })) await dealCards(d2);
  }

  async function dealCards(data) {
    let deck = Array.isArray(data.game.deck) ? data.game.deck.slice() : makeDeck();
    const uids = Object.keys(data.players || {}).sort(function (a, b) {
      return (data.players[a].seat || 0) - (data.players[b].seat || 0);
    });
    const updates = {};
    uids.forEach(function (uid) {
      const h = [];
      if (deck.length) h.push(deck.pop());
      if (deck.length) h.push(deck.pop());
      updates['players/' + uid + '/hand'] = h;
      updates['players/' + uid + '/done'] = handScore(h) === 21;
      // Не ставим «Перебор» в resultText при раздаче
      updates['players/' + uid + '/resultText'] = null;
    });
    updates['game/deck'] = deck;
    updates['game/phase'] = 'playing';
    let turn = null;
    for (var i = 0; i < uids.length; i++) {
      if (!updates['players/' + uids[i] + '/done']) { turn = uids[i]; break; }
    }
    updates['game/turn'] = turn;
    updates['game/seq'] = Date.now();
    await db.ref('bjRooms/' + roomCode).update(updates);
    if (!turn) await finishRound();
  }

  async function doHit() {
    const snap = await db.ref('bjRooms/' + roomCode).once('value');
    const data = snap.val();
    if (!data || !data.game || data.game.turn !== myUid || data.game.phase !== 'playing') return;
    let deck = (data.game.deck || []).slice();
    const hand = (data.players[myUid].hand || []).slice();
    if (!deck.length) return;
    hand.push(deck.pop());
    const score = handScore(hand);
    const done = score >= 21;
    const updates = {
      ['players/' + myUid + '/hand']: hand,
      ['players/' + myUid + '/done']: done,
      'game/deck': deck,
      'game/seq': Date.now()
    };
    // НЕ пишем «Перебор» в resultText — соперник не должен видеть заранее
    if (done) {
      const next = nextTurn(data.players, myUid);
      updates['game/turn'] = next;
      await db.ref('bjRooms/' + roomCode).update(updates);
      if (!next) await finishRound();
    } else {
      await db.ref('bjRooms/' + roomCode).update(updates);
    }
  }

  async function doStand() {
    const snap = await db.ref('bjRooms/' + roomCode).once('value');
    const data = snap.val();
    if (!data || !data.game || data.game.turn !== myUid) return;
    const next = nextTurn(data.players, myUid);
    await db.ref('bjRooms/' + roomCode).update({
      ['players/' + myUid + '/done']: true,
      'game/turn': next,
      'game/seq': Date.now()
    });
    if (!next) await finishRound();
  }

  async function doDouble() {
    const snap = await db.ref('bjRooms/' + roomCode).once('value');
    const data = snap.val();
    if (!data || !data.game || data.game.turn !== myUid) return;
    const me = data.players[myUid];
    if (!me || (me.hand || []).length !== 2) return;
    const bet = Math.floor(Number(me.bet) || 0);
    const stack = Math.floor(Number(me.stack) || 0);
    if (stack < bet) return;
    let deck = (data.game.deck || []).slice();
    const hand = (me.hand || []).slice();
    if (!deck.length) return;
    hand.push(deck.pop());
    const score = handScore(hand);
    const newStack = stack - bet;
    const newPot = Math.floor(Number(data.game.pot) || 0) + bet;
    const next = nextTurn(data.players, myUid);
    await db.ref('bjRooms/' + roomCode).update({
      ['players/' + myUid + '/hand']: hand,
      ['players/' + myUid + '/bet']: bet * 2,
      ['players/' + myUid + '/stack']: newStack,
      ['players/' + myUid + '/done']: true,
      // resultText только в finishRound
      ['players/' + myUid + '/resultText']: null,
      'game/deck': deck,
      'game/pot': newPot,
      'game/turn': next,
      'game/seq': Date.now()
    });
    await setBal(newStack);
    if (!next) await finishRound();
  }

  function nextTurn(players, fromUid) {
    const uids = Object.keys(players || {}).sort(function (a, b) {
      return (players[a].seat || 0) - (players[b].seat || 0);
    });
    for (var i = 0; i < uids.length; i++) {
      var u = uids[i];
      if (u === fromUid) continue;
      var p = players[u];
      if (p && !p.done && handScore(p.hand || []) <= 21) return u;
    }
    return null;
  }

  function compareHands(scoreA, scoreB) {
    var aOk = scoreA <= 21;
    var bOk = scoreB <= 21;
    if (aOk && !bOk) return 1;
    if (!aOk && bOk) return -1;
    if (aOk && bOk) {
      if (scoreA > scoreB) return 1;
      if (scoreA < scoreB) return -1;
      return 0;
    }
    // оба перебор — специальный случай, вызывающий код обработает отдельно
    return 0;
  }

  /**
   * Оба перебор: вернуть ставки каждому, показать надпись, через ~2.5с
   * начать новый раунд ставок (банк не «сгорает»).
   */
  async function handleBothBust(data, uids, pot) {
    if (bothBustRestartLock) return;
    bothBustRestartLock = true;
    try {
      const players = data.players || {};
      const updates = {
        'game/phase': 'both_bust',
        'game/endSeq': Date.now(),
        'game/turn': null,
        'game/pot': pot,
        'game/endText': 'У обоих перебор · банк возвращается · новая раздача'
      };
      // Возвращаем каждому его ставку (банк никуда не пропадает)
      uids.forEach(function (uid) {
        var bet = Math.floor(Number(players[uid].bet) || 0);
        var stack = Math.floor(Number(players[uid].stack) || 0);
        updates['players/' + uid + '/stack'] = stack + bet;
        updates['players/' + uid + '/resultText'] = 'Перебор · возврат ' + fmt(bet);
        updates['players/' + uid + '/hand'] = players[uid].hand || [];
      });
      await db.ref('bjRooms/' + roomCode).update(updates);

      // Пауза, чтобы оба увидели надпись, затем новый раунд (betting)
      await new Promise(function (r) { setTimeout(r, 2800); });

      const snap2 = await db.ref('bjRooms/' + roomCode).once('value');
      const d2 = snap2.val();
      if (!d2 || !d2.players) return;
      // Только один клиент должен стартовать — host или тот, кто вызвал finish
      const hostUid = d2.info && d2.info.hostUid;
      if (myUid !== hostUid && myUid !== uids[0]) return;

      const min = Math.max(1, Math.floor(Number(d2.info && d2.info.minBet) || MIN_DEFAULT));
      const deck = makeDeck();
      const roundId = 'r' + Date.now();
      const restart = {
        'info/status': 'playing',
        game: {
          phase: 'betting',
          deck: deck,
          pot: 0,
          turn: null,
          minBet: min,
          roundId: roundId,
          seq: Date.now(),
          endSeq: 0,
          endText: null
        }
      };
      Object.keys(d2.players).forEach(function (uid) {
        restart['players/' + uid + '/hand'] = [];
        restart['players/' + uid + '/bet'] = 0;
        restart['players/' + uid + '/betPlaced'] = false;
        restart['players/' + uid + '/done'] = false;
        restart['players/' + uid + '/resultText'] = null;
      });
      lastEndSeq = 0;
      lastPaidRound = null;
      await db.ref('bjRooms/' + roomCode).update(restart);
    } finally {
      setTimeout(function () { bothBustRestartLock = false; }, 500);
    }
  }

  async function finishRound() {
    if (finishLock) return;
    finishLock = true;
    try {
      const snap = await db.ref('bjRooms/' + roomCode).once('value');
      const data = snap.val();
      if (!data || !data.game || data.game.phase === 'ended' || data.game.phase === 'both_bust') return;
      const players = data.players || {};
      const uids = Object.keys(players).sort(function (a, b) {
        return (players[a].seat || 0) - (players[b].seat || 0);
      });
      if (uids.length < 2) return;

      const pot = potOf(data.game, players);
      const s0 = handScore(players[uids[0]].hand || []);
      const s1 = handScore(players[uids[1]].hand || []);

      // Оба перебор → возврат + новая раздача
      if (s0 > 21 && s1 > 21) {
        await handleBothBust(data, uids, pot);
        return;
      }

      const cmp = compareHands(s0, s1);
      const updates = {
        'game/phase': 'ended',
        'game/endSeq': Date.now(),
        'info/status': 'ended',
        'game/turn': null,
        'game/pot': pot
      };

      if (cmp === 0) {
        const half = Math.floor(pot / 2);
        const rem = pot - half * 2;
        updates['players/' + uids[0] + '/stack'] = Math.floor(Number(players[uids[0]].stack) || 0) + half + rem;
        updates['players/' + uids[1] + '/stack'] = Math.floor(Number(players[uids[1]].stack) || 0) + half;
        updates['players/' + uids[0] + '/resultText'] = 'Ничья · возврат ' + fmt(half + rem);
        updates['players/' + uids[1] + '/resultText'] = 'Ничья · возврат ' + fmt(half);
        updates['game/endText'] =
          (players[uids[0]].name || 'Игрок') + ' ' + s0 + ' = ' +
          (players[uids[1]].name || 'Игрок') + ' ' + s1 + ' · банк пополам';
      } else {
        const winner = cmp > 0 ? uids[0] : uids[1];
        const loser = cmp > 0 ? uids[1] : uids[0];
        const wScore = cmp > 0 ? s0 : s1;
        const lScore = cmp > 0 ? s1 : s0;
        updates['players/' + winner + '/stack'] = Math.floor(Number(players[winner].stack) || 0) + pot;
        updates['players/' + winner + '/resultText'] = 'Победа +' + fmt(pot);
        updates['players/' + loser + '/resultText'] = (lScore > 21 ? 'Перебор · ' : '') + 'Проигрыш';
        updates['game/endText'] =
          (players[winner].name || 'Игрок') + ' ' + wScore + ' > ' +
          (players[loser].name || 'Игрок') + ' ' + lScore + ' · банк ' + fmt(pot);
      }

      await db.ref('bjRooms/' + roomCode).update(updates);
    } finally {
      setTimeout(function () { finishLock = false; }, 500);
    }
  }

  document.querySelectorAll('.stake-chip').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      if (!roomCode || !myUid || (room && room.players && room.players[myUid] && room.players[myUid].ready)) return;
      const min = Math.max(1, Math.floor(Number(btn.dataset.stake) || 1));
      const updates = { 'info/minBet': min, 'info/status': 'waiting', game: null };
      if (room && room.players) Object.keys(room.players).forEach(function (uid) {
        updates['players/' + uid + '/ready'] = false;
      });
      await db.ref('bjRooms/' + roomCode).update(updates);
    });
  });

  if (el('btn-ready')) el('btn-ready').addEventListener('click', async function () {
    if (!myUid || !roomCode) return;
    const money = bal();
    if (money < minStake()) {
      if (el('msg')) el('msg').textContent = 'Нужно минимум ' + fmt(minStake());
      return;
    }
    await db.ref('bjRooms/' + roomCode + '/players/' + myUid).update({ ready: true, stack: money });
    const snap = await db.ref('bjRooms/' + roomCode).once('value');
    const data = snap.val();
    if (!data) return;
    const plist = Object.values(data.players || {});
    if (plist.length === 2 && plist.every(function (p) { return p.ready; }) && data.info && data.info.status === 'waiting') {
      await startRound();
    }
  });

  if (el('btn-place-bet')) el('btn-place-bet').addEventListener('click', function () { placeBet(); });
  if (el('btn-hit')) el('btn-hit').addEventListener('click', function () { doHit(); });
  if (el('btn-stand')) el('btn-stand').addEventListener('click', function () { doStand(); });
  if (el('btn-double')) el('btn-double').addEventListener('click', function () { doDouble(); });

  const betCustom = el('bet-custom');
  if (betCustom) {
    betCustom.addEventListener('input', function () {
      const min = minStake();
      const v = Math.floor(Number(betCustom.value));
      if (!Number.isNaN(v) && v >= min) {
        myBetChoice = v;
        const box = el('bet-chips');
        if (box) box.querySelectorAll('.bet-chip').forEach(function (b) {
          b.classList.toggle('active', Number(b.dataset.b) === v);
        });
      }
    });
    betCustom.addEventListener('change', function () {
      const min = minStake();
      var v = Math.floor(Number(betCustom.value));
      if (Number.isNaN(v) || v < min) v = min;
      setChosenBet(v, true);
    });
    betCustom.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        placeBet();
      }
    });
  }

  if (el('btn-rematch')) el('btn-rematch').addEventListener('click', async function () {
    if (!roomCode || !myUid) return;
    const money = bal();
    const updates = { 'info/status': 'waiting', game: null };
    if (room && room.players) {
      Object.keys(room.players).forEach(function (uid) {
        updates['players/' + uid + '/ready'] = false;
        updates['players/' + uid + '/hand'] = [];
        updates['players/' + uid + '/bet'] = 0;
        updates['players/' + uid + '/betPlaced'] = false;
        updates['players/' + uid + '/done'] = false;
        updates['players/' + uid + '/resultText'] = null;
      });
    }
    updates['players/' + myUid + '/stack'] = money;
    lastEndSeq = 0;
    lastPaidRound = null;
    finishLock = false;
    bothBustRestartLock = false;
    await db.ref('bjRooms/' + roomCode).update(updates);
    await refreshBalPill();
  });

  async function init() {
    if (!roomCode) { alert('Нет кода комнаты'); location.href = 'index.html'; return; }
    await refreshBalPill();
    const user = auth.currentUser || (await auth.signInAnonymously()).user;
    myUid = user.uid;
    const name = (typeof currentAccount === 'function' && currentAccount() && currentAccount().name) || 'Игрок';
    const startBal = Math.max(0, Math.floor(bal()));
    const roomRef = db.ref('bjRooms/' + roomCode);
    const snap = await roomRef.once('value');
    if (!snap.exists()) {
      await roomRef.set({
        info: { status: 'waiting', maxPlayers: MAX_PLAYERS, hostUid: myUid, minBet: MIN_DEFAULT, createdAt: Date.now() },
        players: {
          [myUid]: { name: name, stack: startBal, seat: 0, ready: false, hand: [], bet: 0, betPlaced: false, done: false }
        }
      });
    } else {
      const data = snap.val();
      const players = data.players || {};
      if (!players[myUid]) {
        const seat = Object.keys(players).length;
        if (seat >= MAX_PLAYERS || seat >= ((data.info && data.info.maxPlayers) || MAX_PLAYERS)) {
          alert('Стол только на 2 игрока');
          location.href = 'index.html';
          return;
        }
        await roomRef.child('players/' + myUid).set({
          name: name, stack: startBal, seat: seat, ready: false, hand: [], bet: 0, betPlaced: false, done: false
        });
      } else {
        await roomRef.child('players/' + myUid).update({ name: name, stack: startBal, ready: false });
      }
    }
    roomRef.on('value', async function (s) {
      if (!s.exists()) { alert('Комната закрыта'); location.href = 'index.html'; return; }
      room = s.val();
      await syncMoney(room);
      render();
    });
  }
  init();
})();
