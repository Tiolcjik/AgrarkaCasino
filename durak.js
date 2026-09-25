/**
 * Дурак multiplayer — ставка в лобби, списание при старте у всех,
 * банк победителю, реванш. Mobile-friendly UI hooks.
 */
(function () {
  'use strict';
  const SUITS = ['♠', '♥', '♦', '♣'];
  const RANKS = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const VAL = { '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
  const AVS = ['🎩', '👑', '🃏', '💎', '🦁', '🐺', '🦅', '🦊'];
  const STAKE_DEFAULT = 10;
  const roomCode = (new URLSearchParams(location.search).get('room') || '').toUpperCase();
  const el = (id) => document.getElementById(id);
  if (el('room-code')) el('room-code').textContent = roomCode || '—';

  let myUid = null, room = null, lastEndSeq = 0, lastElimSeq = 0;
  let lastPaidRoundId = null, lastPaidWinId = null, startingLock = false;

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
    return { raw: c, rank, suit, val: VAL[rank], red: suit === '♥' || suit === '♦' };
  }
  function cardHTML(c, opts) {
    opts = opts || {};
    if (!c) return '<div class="card back">?</div>';
    const p = parse(c);
    if (!p) return '<div class="card back">?</div>';
    const cls = ['card', p.red ? 'red' : '', opts.playable ? 'playable' : '', opts.dim ? 'dim' : '', opts.trump ? 'trump-card' : ''].filter(Boolean).join(' ');
    return '<div class="' + cls + '" data-card="' + c + '"><div class="r">' + p.rank + '</div><div class="s">' + p.suit + '</div></div>';
  }
  function beats(aC, dC, trump) {
    const a = parse(aC), d = parse(dC);
    if (!a || !d) return false;
    if (d.suit === trump && a.suit !== trump) return true;
    return d.suit === a.suit && d.val > a.val;
  }
  function ranksOnTable(table) {
    const set = new Set();
    (table || []).forEach((pair) => {
      const a = parse(pair.attack); if (a) set.add(a.rank);
      if (pair.defend) { const d = parse(pair.defend); if (d) set.add(d.rank); }
    });
    return set;
  }
  function nextAlive(players, fromUid, dir) {
    const uids = Object.keys(players || {}).sort((a, b) => (players[a].seat || 0) - (players[b].seat || 0));
    if (!uids.length) return null;
    let idx = uids.indexOf(fromUid); if (idx < 0) idx = 0;
    for (let i = 1; i <= uids.length; i++) {
      const u = uids[(idx + i * (dir || 1) + uids.length * 20) % uids.length];
      const p = players[u];
      if (p && !p.out && (p.hand || []).length > 0) return u;
    }
    return null;
  }
  function currentStake() {
    return Math.max(1, Math.floor(Number(room?.info?.stake) || STAKE_DEFAULT));
  }

  async function syncMoneyFromRoom(data) {
    if (!myUid || !data) return;
    const me = data.players && data.players[myUid];
    if (!me) return;
    const game = data.game || {};
    const status = data.info?.status;
    const roundId = game.roundId || null;
    if (status === 'playing' && roundId && lastPaidRoundId !== roundId) {
      const stake = Math.max(1, Math.floor(Number(game.stake) || Number(data.info?.stake) || STAKE_DEFAULT));
      const before = bal();
      const target = Math.max(0, before - stake);
      const fbStack = Math.floor(Number(me.stack));
      if (!Number.isNaN(fbStack) && fbStack >= 0 && Math.abs(fbStack - target) <= stake + 1) await setBal(fbStack);
      else await setBal(target);
      lastPaidRoundId = roundId;
    }
    if ((status === 'ended' || game.phase === 'ended') && game.endSeq && lastPaidWinId !== game.endSeq) {
      const winners = game.winners || [];
      const pot = Math.floor(Number(game.pot) || 0);
      const share = winners.length ? Math.floor(pot / winners.length) : 0;
      if (winners.includes(myUid) && share > 0) {
        const fbStack = Math.floor(Number(me.stack));
        if (!Number.isNaN(fbStack) && fbStack >= 0) await setBal(fbStack);
        else await setBal(bal() + share);
      } else {
        const fbStack = Math.floor(Number(me.stack));
        if (!Number.isNaN(fbStack) && fbStack >= 0) await setBal(fbStack);
      }
      lastPaidWinId = game.endSeq;
    }
  }

  function getPlayableCards(me, game, players) {
    const set = new Set();
    if (!me || !game || me.out) return set;
    const hand = me.hand || [], table = game.table || [], trump = game.trumpSuit;
    const isAtk = game.attacker === myUid, isDef = game.defender === myUid;
    if (isDef && (game.phase === 'defend' || game.phase === 'throw')) {
      const open = table.find((p) => !p.defend);
      if (open) hand.forEach((c) => { if (beats(open.attack, c, trump)) set.add(c); });
      return set;
    }
    if (isAtk && game.phase === 'attack' && table.length === 0) {
      hand.forEach((c) => set.add(c)); return set;
    }
    if ((game.phase === 'attack' || game.phase === 'throw') && table.length > 0 && !isDef) {
      const ranks = ranksOnTable(table);
      const defHandSize = (players[game.defender]?.hand || []).length;
      const uncovered = table.filter((p) => !p.defend).length;
      if (uncovered >= defHandSize || table.length >= 6) return set;
      hand.forEach((c) => { const p = parse(c); if (p && ranks.has(p.rank)) set.add(c); });
    }
    return set;
  }

  function render() {
    if (!room) return;
    const players = room.players || {}, game = room.game || {}, me = players[myUid];
    const status = room.info?.status || 'waiting';

    if (el('pot-pill')) el('pot-pill').textContent = 'Банк: ' + fmt(game.pot || room.info?.pot || 0);
    const st = el('status');
    if (st) {
      if (status === 'waiting') st.textContent = 'Лобби · ' + fmt(currentStake());
      else if (status === 'ended') st.textContent = 'Раунд окончен';
      else if (game.phase === 'attack') st.textContent = 'Атака';
      else if (game.phase === 'defend') st.textContent = 'Защита';
      else if (game.phase === 'throw') st.textContent = 'Подкид';
      else st.textContent = status;
    }

    const lobby = el('lobby'), tableWrap = el('table-wrap');
    if (lobby) lobby.classList.toggle('hidden', status === 'playing');
    if (tableWrap) tableWrap.classList.toggle('dimmed', status === 'waiting');

    if (status === 'waiting' || status === 'ended') {
      const stake = currentStake();
      document.querySelectorAll('.stake-chip').forEach((btn) => {
        btn.classList.toggle('active', Number(btn.dataset.stake) === stake);
        btn.disabled = !!(me && me.ready && status === 'waiting');
      });
      if (el('stake-custom')) el('stake-custom').disabled = !!(me && me.ready && status === 'waiting');
      const lp = el('lobby-players');
      if (lp) {
        const list = Object.entries(players).sort((a, b) => (a[1].seat || 0) - (b[1].seat || 0));
        lp.innerHTML = list.map(([uid, p]) => {
          const cls = ['lobby-p', p.ready ? 'ready' : '', uid === myUid ? 'me' : ''].filter(Boolean).join(' ');
          return '<div class="' + cls + '">' + (p.name || 'Игрок') + (uid === myUid ? ' (ты)' : '') + (p.ready ? ' ✓' : '') + '</div>';
        }).join('');
      }
      if (el('lobby-hint')) {
        el('lobby-hint').textContent = me && me.ready
          ? 'Ждём остальных. При старте с каждого −' + fmt(stake)
          : 'Выбери ставку → «Готов». Списание только после старта.';
      }
    }

    const trumpEl = el('trump-card');
    if (trumpEl && status === 'playing') {
      if (game.trumpCard) {
        const p = parse(game.trumpCard);
        trumpEl.className = 'card trump-card' + (p && p.red ? ' red' : '');
        trumpEl.innerHTML = p ? ('<div class="r">' + p.rank + '</div><div class="s">' + p.suit + '</div>') : '—';
      }
    }
    if (el('deck-info')) {
      const left = Array.isArray(game.deck) ? game.deck.length : 0;
      el('deck-info').textContent = status !== 'playing' ? '—' : (left > 0 ? 'Колода: ' + left : 'Колода пуста');
    }
    const tableEl = el('table-cards');
    if (tableEl) {
      const table = game.table || [];
      tableEl.innerHTML = (status !== 'playing' || !table.length)
        ? '<div class="table-empty">Стол пуст</div>'
        : table.map((pair) => '<div class="pair">' + cardHTML(pair.attack) + (pair.defend ? '<div class="def">' + cardHTML(pair.defend) + '</div>' : '') + '</div>').join('');
    }
    const seatsEl = el('seats');
    if (seatsEl) {
      if (status !== 'playing') seatsEl.innerHTML = '';
      else {
        const list = Object.entries(players).sort((a, b) => (a[1].seat || 0) - (b[1].seat || 0));
        seatsEl.innerHTML = list.map(([uid, p]) => {
          const isMe = uid === myUid, isAtk = game.attacker === uid, isDef = game.defender === uid;
          const role = isAtk ? 'Атака' : isDef ? 'Защита' : p.out ? 'Вышел' : '';
          const cls = ['seat', isMe ? 'me' : '', isAtk ? 'attacker' : '', isDef ? 'defender' : '', p.out ? 'out' : ''].filter(Boolean).join(' ');
          return '<div class="' + cls + '"><div class="avatar">' + AVS[(p.seat || 0) % AVS.length] + '</div><div class="name">' + (p.name || 'Игрок') + (isMe ? ' (ты)' : '') + '</div><div class="role">' + role + '</div><div class="cards-count">' + (p.out ? 'выйти ✓' : ((p.hand || []).length + ' карт')) + '</div></div>';
        }).join('');
      }
    }

    const handEl = el('my-hand'), msg = el('msg');
    if (handEl) {
      if (status !== 'playing' || !me) handEl.innerHTML = '';
      else {
        const playable = getPlayableCards(me, game, players);
        handEl.innerHTML = (me.hand || []).map((c) => cardHTML(c, { playable: playable.has(c), dim: !playable.has(c) && playable.size > 0 })).join('');
        handEl.querySelectorAll('.card.playable').forEach((node) => {
          node.addEventListener('click', () => onCardClick(node.dataset.card));
        });
      }
    }

    const btnReady = el('btn-ready'), btnTake = el('btn-take'), btnPass = el('btn-pass'), btnRematch = el('btn-rematch');
    [btnReady, btnTake, btnPass, btnRematch].forEach((b) => b && b.classList.add('hidden'));

    if (status === 'waiting') {
      if (btnReady) {
        btnReady.classList.remove('hidden');
        btnReady.textContent = (me && me.ready) ? '✓ Готов · ждём' : ('Готов (ставка ' + fmt(currentStake()) + ')');
        btnReady.disabled = !!(me && me.ready);
      }
    } else if (status === 'ended') {
      if (btnRematch) btnRematch.classList.remove('hidden');
      if (msg) msg.textContent = game.endText || 'Можно сыграть ещё';
    } else if (me && !me.out) {
      const isAtk = game.attacker === myUid, isDef = game.defender === myUid;
      const table = game.table || [], uncovered = table.filter((p) => !p.defend).length;
      if (isDef && (game.phase === 'defend' || game.phase === 'throw')) {
        if (btnTake) btnTake.classList.remove('hidden');
        if (msg) msg.textContent = 'Бей или возьми';
      } else if (isAtk && (game.phase === 'attack' || game.phase === 'throw')) {
        if (table.length && uncovered === 0 && btnPass) { btnPass.classList.remove('hidden'); btnPass.textContent = 'Бито'; }
        if (msg) msg.textContent = table.length === 0 ? 'Ходи' : (uncovered ? 'Ждём защиты' : 'Подкинь или «Бито»');
      } else if (!isDef && game.phase === 'throw') {
        if (msg) msg.textContent = 'Можно подкинуть';
      } else if (msg) msg.textContent = 'Жди хода';
    } else if (me && me.out && msg) msg.textContent = 'Ты вышел — жди финала';

    if (game.elimSeq && game.elimSeq !== lastElimSeq && game.elimName) {
      lastElimSeq = game.elimSeq;
      const t = el('elim-toast');
      if (t) { t.textContent = '🎉 ' + game.elimName + ' вышел!'; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2800); }
    }
    if (game.phase === 'ended' && game.endSeq && game.endSeq !== lastEndSeq) {
      lastEndSeq = game.endSeq;
      showEndOverlay(game);
    }
  }

  async function onCardClick(card) {
    if (!room?.game || !myUid) return;
    const game = room.game, me = room.players[myUid];
    if (!me || me.out) return;
    if (!getPlayableCards(me, game, room.players).has(card)) return;
    if (game.defender === myUid) {
      const openIdx = (game.table || []).findIndex((p) => !p.defend);
      if (openIdx >= 0) await defendCard(openIdx, card);
    } else await attackCard(card);
  }

  async function attackCard(card) {
    const snap = await db.ref('durakRooms/' + roomCode).once('value');
    const data = snap.val();
    if (!data?.game || !data.players?.[myUid]) return;
    const game = data.game, hand = (data.players[myUid].hand || []).slice();
    const idx = hand.indexOf(card); if (idx < 0) return;
    const table = (game.table || []).slice();
    if (table.length === 0) { if (game.attacker !== myUid) return; }
    else {
      const ranks = ranksOnTable(table), p = parse(card);
      if (!p || !ranks.has(p.rank)) return;
      const defHand = (data.players[game.defender]?.hand || []).length;
      if (table.filter((x) => !x.defend).length >= defHand || table.length >= 6) return;
    }
    hand.splice(idx, 1); table.push({ attack: card, defend: null });
    await db.ref('durakRooms/' + roomCode).update({
      ['players/' + myUid + '/hand']: hand, 'game/table': table, 'game/phase': 'defend', 'game/seq': Date.now()
    });
  }

  async function defendCard(pairIdx, card) {
    const snap = await db.ref('durakRooms/' + roomCode).once('value');
    const data = snap.val();
    if (!data?.game || data.game.defender !== myUid) return;
    const game = data.game, hand = (data.players[myUid].hand || []).slice();
    const idx = hand.indexOf(card); if (idx < 0) return;
    const table = (game.table || []).slice();
    if (!table[pairIdx] || table[pairIdx].defend) return;
    if (!beats(table[pairIdx].attack, card, game.trumpSuit)) return;
    hand.splice(idx, 1);
    table[pairIdx] = { attack: table[pairIdx].attack, defend: card };
    await db.ref('durakRooms/' + roomCode).update({
      ['players/' + myUid + '/hand']: hand, 'game/table': table,
      'game/phase': table.every((p) => p.defend) ? 'throw' : 'defend', 'game/seq': Date.now()
    });
  }

  async function doTake() {
    const snap = await db.ref('durakRooms/' + roomCode).once('value');
    const data = snap.val();
    if (!data?.game || data.game.defender !== myUid) return;
    const game = data.game, players = data.players, table = game.table || [];
    if (!table.length) return;
    const taken = [];
    table.forEach((p) => { taken.push(p.attack); if (p.defend) taken.push(p.defend); });
    const newAtk = nextAlive(players, myUid, 1);
    const newDef = newAtk ? nextAlive(players, newAtk, 1) : null;
    await db.ref('durakRooms/' + roomCode).update({
      ['players/' + myUid + '/hand']: (players[myUid].hand || []).concat(taken),
      'game/table': [], 'game/phase': 'attack', 'game/attacker': newAtk, 'game/defender': newDef, 'game/seq': Date.now()
    });
    await drawUpAndCheck();
  }

  async function doPass() {
    const snap = await db.ref('durakRooms/' + roomCode).once('value');
    const data = snap.val();
    if (!data?.game || data.game.attacker !== myUid) return;
    const game = data.game, table = game.table || [];
    if (!table.length || table.some((p) => !p.defend)) return;
    const newAtk = game.defender, newDef = nextAlive(data.players, newAtk, 1);
    await db.ref('durakRooms/' + roomCode).update({
      'game/table': [], 'game/phase': 'attack', 'game/attacker': newAtk, 'game/defender': newDef, 'game/seq': Date.now()
    });
    await drawUpAndCheck();
  }

  async function drawUpAndCheck() {
    const snap = await db.ref('durakRooms/' + roomCode).once('value');
    const fresh = snap.val();
    if (!fresh?.game) return;
    let deck = Array.isArray(fresh.game.deck) ? fresh.game.deck.slice() : [];
    const players = fresh.players || {}, order = [];
    const atk = fresh.game.attacker, def = fresh.game.defender;
    if (atk) order.push(atk);
    Object.keys(players).sort((a, b) => (players[a].seat || 0) - (players[b].seat || 0))
      .forEach((uid) => { if (uid !== atk && uid !== def && !players[uid].out) order.push(uid); });
    if (def && def !== atk) order.push(def);
    const updates = {};
    order.forEach((uid) => {
      let hand = (players[uid].hand || []).slice();
      while (hand.length < 6 && deck.length) hand.push(deck.pop());
      updates['players/' + uid + '/hand'] = hand;
    });
    updates['game/deck'] = deck;
    const newlyOut = [];
    if (deck.length === 0) {
      Object.keys(players).forEach((uid) => {
        const hand = updates['players/' + uid + '/hand'] || players[uid].hand || [];
        if (!players[uid].out && hand.length === 0) {
          updates['players/' + uid + '/out'] = true;
          newlyOut.push(players[uid].name || 'Игрок');
        }
      });
    }
    if (newlyOut.length) {
      updates['game/elimName'] = newlyOut[newlyOut.length - 1];
      updates['game/elimSeq'] = Date.now();
    }
    await db.ref('durakRooms/' + roomCode).update(updates);
    await checkEnd((await db.ref('durakRooms/' + roomCode).once('value')).val());
  }

  async function checkEnd(data) {
    if (!data?.game || data.game.phase === 'ended') return;
    const players = data.players || {}, deckLeft = (data.game.deck || []).length, updates = {};
    if (deckLeft === 0) {
      Object.keys(players).forEach((uid) => {
        if (!players[uid].out && (players[uid].hand || []).length === 0) updates['players/' + uid + '/out'] = true;
      });
    }
    const still = Object.entries(players).filter(([uid, p]) => {
      if (updates['players/' + uid + '/out']) return false;
      return !p.out && (p.hand || []).length > 0;
    });
    if (deckLeft === 0 && still.length <= 1) {
      const loser = still[0] ? still[0][0] : null;
      const winners = Object.keys(players).filter((uid) => uid !== loser);
      const pot = Math.floor(Number(data.game.pot) || Number(data.info?.pot) || 0);
      const share = winners.length ? Math.floor(pot / winners.length) : 0;
      updates['game/phase'] = 'ended';
      updates['game/loser'] = loser;
      updates['game/winners'] = winners;
      updates['game/endSeq'] = Date.now();
      updates['game/pot'] = pot;
      updates['info/status'] = 'ended';
      updates['info/pot'] = pot;
      updates['game/endText'] = loser ? ((players[loser]?.name || 'Игрок') + ' — дурак. Банк ' + fmt(pot)) : 'Ничья';
      winners.forEach((uid) => {
        updates['players/' + uid + '/stack'] = Math.floor(Number(players[uid].stack) || 0) + share;
      });
      await db.ref('durakRooms/' + roomCode).update(updates);
      return;
    }
    if (Object.keys(updates).length) await db.ref('durakRooms/' + roomCode).update(updates);
  }

  function showEndOverlay(game) {
    const winners = game.winners || [];
    const pot = Math.floor(Number(game.pot) || 0);
    const share = winners.length ? Math.floor(pot / winners.length) : 0;
    const iWon = myUid && winners.includes(myUid);
    const ov = el('winner-ov');
    if (el('w-title')) el('w-title').textContent = iWon ? 'Ты победил!' : 'Игра окончена';
    if (el('w-sub')) el('w-sub').textContent = game.endText || '';
    if (el('w-amt')) el('w-amt').textContent = iWon ? ('+' + fmt(share)) : (game.loser === myUid ? 'Ты дурак 💀' : '');
    if (ov) {
      ov.classList.add('show');
      const box = el('win-confetti');
      if (box) {
        box.innerHTML = '';
        const em = ['🎉', '💵', '🔥', '✨', '🃏', '👑'];
        for (let i = 0; i < 20; i++) {
          const s = document.createElement('span');
          s.textContent = em[i % em.length];
          s.style.left = Math.random() * 100 + '%';
          s.style.animationDelay = (Math.random() * 1.2) + 's';
          box.appendChild(s);
        }
      }
    }
    if (iWon) {
      const audio = el('win-audio');
      if (audio) {
        try {
          audio.currentTime = 0;
          const p = audio.play();
          if (p && p.catch) p.catch(() => {});
          setTimeout(() => { try { audio.pause(); } catch (e) {} }, 5000);
        } catch (e) {}
      }
    }
    setTimeout(() => { if (ov) ov.classList.remove('show'); }, 5500);
  }

  async function startGame() {
    if (startingLock) return;
    startingLock = true;
    try {
      const snap = await db.ref('durakRooms/' + roomCode).once('value');
      const data = snap.val();
      if (!data || data.info?.status === 'playing') return;
      const players = data.players || {}, uids = Object.keys(players);
      if (uids.length < 2 || !uids.every((u) => players[u].ready)) return;
      const stake = Math.max(1, Math.floor(Number(data.info?.stake) || STAKE_DEFAULT));
      for (const uid of uids) {
        if (Math.floor(Number(players[uid].stack) || 0) < stake) {
          if (el('msg')) el('msg').textContent = (players[uid].name || 'Игрок') + ' — мало средств';
          return;
        }
      }
      const deck = makeDeck(), hands = {};
      uids.forEach((uid) => { hands[uid] = []; });
      for (let i = 0; i < 6; i++) uids.forEach((uid) => { if (deck.length) hands[uid].push(deck.pop()); });
      const trump = deck.length ? deck[deck.length - 1] : null;
      const trumpSuit = parse(trump)?.suit || '♠';
      let attacker = uids[0], lowest = 99;
      uids.forEach((uid) => {
        hands[uid].forEach((c) => {
          const p = parse(c);
          if (p && p.suit === trumpSuit && p.val < lowest) { lowest = p.val; attacker = uid; }
        });
      });
      const tmp = Object.fromEntries(uids.map((u) => [u, { hand: hands[u], out: false, seat: players[u].seat }]));
      const defender = nextAlive(tmp, attacker, 1);
      const pot = stake * uids.length;
      const roundId = 'r' + Date.now();
      const updates = {
        'info/status': 'playing', 'info/pot': pot,
        game: { pot, stake, roundId, deck, trumpCard: trump, trumpSuit, table: [], attacker, defender, phase: 'attack', seq: Date.now(), elimSeq: 0, endSeq: 0 }
      };
      uids.forEach((uid) => {
        const prev = Math.floor(Number(players[uid].stack) || 0);
        updates['players/' + uid + '/hand'] = hands[uid];
        updates['players/' + uid + '/stack'] = Math.max(0, prev - stake);
        updates['players/' + uid + '/out'] = false;
        updates['players/' + uid + '/ready'] = false;
      });
      await db.ref('durakRooms/' + roomCode).update(updates);
    } finally {
      startingLock = false;
    }
  }

  function bindStakeUI() {
    document.querySelectorAll('.stake-chip').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!roomCode || !myUid || room?.players?.[myUid]?.ready) return;
        const stake = Math.max(1, Math.floor(Number(btn.dataset.stake) || 1));
        const updates = { 'info/stake': stake, 'info/status': 'waiting', 'info/pot': 0, game: null };
        if (room?.players) Object.keys(room.players).forEach((uid) => { updates['players/' + uid + '/ready'] = false; });
        await db.ref('durakRooms/' + roomCode).update(updates);
      });
    });
    el('stake-custom-btn')?.addEventListener('click', async () => {
      if (!roomCode || !myUid || room?.players?.[myUid]?.ready) return;
      const v = Math.max(1, Math.floor(Number(el('stake-custom')?.value) || 0));
      if (!v) return;
      const updates = { 'info/stake': v, 'info/status': 'waiting', 'info/pot': 0, game: null };
      if (room?.players) Object.keys(room.players).forEach((uid) => { updates['players/' + uid + '/ready'] = false; });
      await db.ref('durakRooms/' + roomCode).update(updates);
    });
  }

  el('btn-ready')?.addEventListener('click', async () => {
    if (!myUid || !roomCode) return;
    const stake = currentStake(), money = bal();
    if (money < stake) { if (el('msg')) el('msg').textContent = 'Нужно минимум ' + fmt(stake); return; }
    await db.ref('durakRooms/' + roomCode + '/players/' + myUid).update({ ready: true, stack: money });
    const snap = await db.ref('durakRooms/' + roomCode).once('value');
    const data = snap.val();
    if (!data) return;
    const plist = Object.values(data.players || {});
    if (plist.length >= 2 && plist.every((p) => p.ready) && data.info?.status === 'waiting') await startGame();
  });
  el('btn-take')?.addEventListener('click', () => doTake());
  el('btn-pass')?.addEventListener('click', () => doPass());
  el('btn-rematch')?.addEventListener('click', async () => {
    if (!roomCode || !myUid) return;
    const money = bal();
    const updates = { 'info/status': 'waiting', 'info/pot': 0, game: null };
    if (room?.players) {
      Object.keys(room.players).forEach((uid) => {
        updates['players/' + uid + '/ready'] = false;
        updates['players/' + uid + '/hand'] = [];
        updates['players/' + uid + '/out'] = false;
      });
    }
    updates['players/' + myUid + '/stack'] = money;
    lastEndSeq = 0; lastElimSeq = 0;
    await db.ref('durakRooms/' + roomCode).update(updates);
    await refreshBalPill();
  });

  async function init() {
    if (!roomCode) { alert('Нет кода комнаты'); location.href = 'index.html'; return; }
    await refreshBalPill();
    const user = auth.currentUser || (await auth.signInAnonymously()).user;
    myUid = user.uid;
    const name = (typeof currentAccount === 'function' && currentAccount()?.name) || 'Игрок';
    const startBal = Math.max(0, Math.floor(bal()));
    const roomRef = db.ref('durakRooms/' + roomCode);
    const snap = await roomRef.once('value');
    if (!snap.exists()) {
      await roomRef.set({
        info: { status: 'waiting', maxPlayers: 6, hostUid: myUid, stake: STAKE_DEFAULT, pot: 0, createdAt: Date.now() },
        players: { [myUid]: { name, stack: startBal, seat: 0, ready: false, hand: [], out: false } }
      });
    } else {
      const data = snap.val(), players = data.players || {};
      if (!players[myUid]) {
        const seat = Object.keys(players).length;
        if (seat >= (data.info?.maxPlayers || 6)) { alert('Стол заполнен'); location.href = 'index.html'; return; }
        await roomRef.child('players/' + myUid).set({ name, stack: startBal, seat, ready: false, hand: [], out: false });
      } else await roomRef.child('players/' + myUid).update({ name, stack: startBal, ready: false });
    }
    bindStakeUI();
    roomRef.on('value', async (s) => {
      if (!s.exists()) { alert('Комната закрыта'); location.href = 'index.html'; return; }
      room = s.val();
      await syncMoneyFromRoom(room);
      render();
    });
  }
  init();
})();
