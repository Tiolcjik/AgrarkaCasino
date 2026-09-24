/**
 * Omaha Multiplayer — reliable street advance + community cards
 * Fix: check without matching bets caused infinite preflop loop; no flop dealt
 */
(function () {
  'use strict';

  let actx = null;
  function audio() {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }
  function beep(freq, dur, type, vol) {
    try {
      const c = audio(), o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.value = vol || 0.1;
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      o.connect(g); g.connect(c.destination);
      o.start(); o.stop(c.currentTime + dur);
    } catch (e) {}
  }
  const S = {
    deal() { beep(400, 0.07, 'triangle', 0.09); setTimeout(() => beep(520, 0.07, 'triangle', 0.07), 50); },
    chip() { beep(250, 0.05, 'square', 0.05); },
    fold() { beep(160, 0.15, 'sawtooth', 0.06); },
    check() { beep(340, 0.06, 'sine', 0.07); },
    raise() { beep(440, 0.07, 'square', 0.07); setTimeout(() => beep(560, 0.1, 'square', 0.06), 60); },
    win() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.2, 'sine', 0.09), i * 110)); },
    tick() { beep(800, 0.025, 'sine', 0.03); },
    ready() { beep(600, 0.08, 'sine', 0.08); setTimeout(() => beep(800, 0.1, 'sine', 0.07), 70); }
  };

  let winAudio = null;
  function playWinMusic() {
    try {
      stopWinMusic();
      if (typeof playPizdatyJingle === 'function') {
        playPizdatyJingle(10000);
        return;
      }
      const tag = el('win-music');
      if (tag) {
        tag.currentTime = 0;
        tag.volume = 0.7;
        tag.play().catch(() => {});
        winAudio = tag;
      } else {
        winAudio = new Audio('pizdaty.mp3');
        winAudio.volume = 0.7;
        winAudio.play().catch(() => {});
      }
      setTimeout(() => stopWinMusic(), 11000);
    } catch (e) {}
  }
  function stopWinMusic() {
    try { if (winAudio) { winAudio.pause(); winAudio.currentTime = 0; } } catch (e) {}
  }

  let lastWinSeq = 0;

  function ensurePokerWinOverlay() {
    let root = document.getElementById('poker-win-root');
    if (root) return root;
    root = document.createElement('div');
    root.id = 'poker-win-root';
    root.className = 'poker-win-root';
    root.innerHTML = `
      <div class="pwr-backdrop"></div>
      <div class="pwr-rays"></div>
      <div class="pwr-sparkles" id="pwr-sparkles"></div>
      <div class="pwr-card">
        <div class="pwr-ring"></div>
        <div class="pwr-crown">🏆</div>
        <div class="pwr-label" id="pwr-label">ПОБЕДИТЕЛЬ</div>
        <div class="pwr-nick" id="pwr-nick">—</div>
        <div class="pwr-amount" id="pwr-amount">+$0</div>
        <div class="pwr-hand" id="pwr-hand"></div>
        <div class="pwr-sub">забрал банк со стола</div>
      </div>`;
    document.body.appendChild(root);
    return root;
  }

  function countUpAmount(el, target) {
    if (!el) return;
    const goal = Math.max(0, Math.floor(target));
    const steps = 28;
    let i = 0;
    const start = 0;
    clearInterval(countUpAmount._iv);
    countUpAmount._iv = setInterval(() => {
      i++;
      const v = Math.floor(start + (goal - start) * (i / steps));
      el.textContent = '+$' + v.toLocaleString('en-US');
      if (i >= steps) {
        clearInterval(countUpAmount._iv);
        el.textContent = '+$' + goal.toLocaleString('en-US');
      }
    }, 40);
  }

  function spawnPokerFX() {
    // Prefer shared casino FX if present
    try { if (typeof moneyRain === 'function') moneyRain(64); } catch (e) {}
    try { if (typeof screenShake === 'function') screenShake(8); } catch (e) {}
    try { if (typeof burstConfetti === 'function') burstConfetti(40); } catch (e) {}

    document.querySelectorAll('.poker-fx-layer').forEach(n => n.remove());
    const layer = document.createElement('div');
    layer.className = 'poker-fx-layer';
    document.body.appendChild(layer);

    const low = !!(window.__PERF_LOW || window.matchMedia('(max-width: 768px)').matches);
    const symbols = ['💵', '💰', '💸', '🪙', '💎', '🤑', '💵', '💰'];
    for (let i = 0; i < (low ? 14 : 50); i++) {
      const m = document.createElement('span');
      m.className = 'pwr-bill';
      m.textContent = symbols[i % symbols.length];
      m.style.setProperty('--x', (Math.random() * 100) + 'vw');
      m.style.setProperty('--dx', ((Math.random() - 0.5) * 200) + 'px');
      m.style.setProperty('--delay', (Math.random() * 1.6) + 's');
      m.style.setProperty('--dur', (2.6 + Math.random() * 2.8) + 's');
      m.style.setProperty('--rot', ((Math.random() - 0.5) * 900) + 'deg');
      m.style.setProperty('--fs', (20 + Math.random() * 28) + 'px');
      layer.appendChild(m);
    }
    for (let i = 0; i < (low ? 10 : 40); i++) {
      const p = document.createElement('span');
      p.className = 'pwr-conf';
      p.style.setProperty('--x', (Math.random() * 100) + 'vw');
      p.style.setProperty('--dx', ((Math.random() - 0.5) * 260) + 'px');
      p.style.setProperty('--delay', (Math.random() * 1.2) + 's');
      p.style.setProperty('--dur', (2 + Math.random() * 2.2) + 's');
      p.style.setProperty('--c', ['#f0d060', '#00f5a0', '#00e8ff', '#ff4d6d', '#fff', '#ff9f43'][i % 6]);
      p.style.setProperty('--sz', (5 + Math.random() * 11) + 'px');
      layer.appendChild(p);
    }
    setTimeout(() => layer.remove(), 7500);
  }

  function showWinnerToEveryone(game, players) {
    if (!game || game.phase !== 'showdown') return;
    const winners = game.winners || [];
    if (!winners.length) return;
    const seq = game.seq || 0;
    if (seq && seq === lastWinSeq) return;
    lastWinSeq = seq;

    const pot = Number(game.lastPot)
      || Object.values(game.payouts || {}).reduce((a, b) => a + (Number(b) || 0), 0)
      || 0;
    const share = winners.length ? Math.floor(pot / winners.length) : 0;
    const handName = game.winHand || '';
    const isTie = winners.length > 1;
    const isMe = winners.includes(myUid);

    const root = ensurePokerWinOverlay();
    const label = root.querySelector('#pwr-label');
    const nick = root.querySelector('#pwr-nick');
    const amount = root.querySelector('#pwr-amount');
    const hand = root.querySelector('#pwr-hand');

    if (isTie) {
      if (label) label.textContent = '🤝 НИЧЬЯ';
      if (nick) nick.textContent = winners.map(u => players[u]?.name || 'Игрок').join(' · ');
      if (amount) countUpAmount(amount, share);
      if (hand) hand.textContent = handName ? ('✦ ' + handName + ' ✦') : 'банк поровну';
    } else {
      if (label) label.textContent = isMe ? '🏆 ТЫ ЗАБРАЛ БАНК' : '🏆 ПОБЕДИТЕЛЬ';
      if (nick) nick.textContent = players[winners[0]]?.name || 'Игрок';
      const amt = (game.payouts && game.payouts[winners[0]]) || pot;
      if (amount) countUpAmount(amount, amt);
      if (hand) hand.textContent = handName ? ('✦ ' + handName + ' ✦') : '';
    }

    // Hide old small overlay if present
    const oldOv = el('winner-ov');
    if (oldOv) oldOv.classList.remove('show');

    root.classList.remove('show', 'hide');
    void root.offsetWidth;
    root.classList.add('show');
    document.body.classList.add('poker-win-shake');

    spawnPokerFX();
    playWinMusic();
    try { S.win(); } catch (e) {}

    // Credit once on winner's device
    if (isMe && game.payouts && game.payouts[myUid] != null) {
      const key = 'pokerCredited_' + roomCode + '_' + seq;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        credit(Number(game.payouts[myUid]) || 0);
        db.ref('rooms/' + roomCode + '/players/' + myUid + '/stack').set(Math.floor(bal())).catch(() => {});
      }
    }

    clearTimeout(showWinnerToEveryone._t);
    showWinnerToEveryone._t = setTimeout(() => {
      root.classList.remove('show');
      root.classList.add('hide');
      document.body.classList.remove('poker-win-shake');
      stopWinMusic();
      setTimeout(() => root.classList.remove('hide'), 600);
    }, 7500);
  }

  const SUITS = ['♠', '♥', '♦', '♣'];
  const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const VAL = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
  const HNAMES = { 8: 'Стрит-флеш', 7: 'Каре', 6: 'Фулл-хаус', 5: 'Флеш', 4: 'Стрит', 3: 'Сет', 2: 'Две пары', 1: 'Пара', 0: 'Старшая карта' };
  const AVS = ['🎩', '👑', '🃏', '💎', '🦁', '🐺', '🦅', '🦊', '🐯', '🐲'];
  const PHASES = { preflop: 'ПРЕФЛОП', flop: 'ФЛОП', turn: 'ТЁРН', river: 'РИВЕР', showdown: 'ВСКРЫТИЕ' };

  const roomCode = (new URLSearchParams(location.search).get('room') || '').toUpperCase();
  const el = (id) => document.getElementById(id);
  if (el('room-code')) el('room-code').textContent = roomCode || '—';

  let myUid = null, room = null, isHost = false;
  let timer = null, secs = 60, lastTurn = null;
  let showdownLock = false, advancing = false;
  let lastAdvanceSeq = 0;
  let advanceTimer = null;

  function bal() {
    if (typeof balance === 'number') return balance;
    if (typeof window.balance === 'number') return window.balance;
    try {
      const a = el('balance-amount');
      if (a) return parseFloat(a.textContent.replace(/[^0-9.]/g, '')) || 0;
    } catch (e) {}
    return 0;
  }
  function pay(n) {
    n = Math.floor(n);
    if (n <= 0) return true;
    if (bal() < n) return false;
    if (typeof updateBalance === 'function') updateBalance(-n);
    return true;
  }
  function credit(n) {
    n = Math.floor(n);
    if (n > 0 && typeof updateBalance === 'function') updateBalance(n);
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

  function isValidCard(c) {
    if (typeof c !== 'string' || c.length < 2) return false;
    const suit = c.slice(-1);
    const rank = c.slice(0, -1);
    return SUITS.includes(suit) && RANKS.includes(rank);
  }
  function parse(c) {
    if (!isValidCard(c)) return null;
    const s = c.slice(-1), r = c.slice(0, -1);
    return { raw: c, rank: r, suit: s, val: VAL[r] || 0, red: s === '♥' || s === '♦' };
  }
  function cardHTML(c, hl) {
    if (!isValidCard(c)) return '<div class="card back">?</div>';
    const p = parse(c);
    if (!p) return '<div class="card back">?</div>';
    const on = hl && hl.has(c);
    const dim = hl && hl.size && !on;
    return '<div class="card ' + (p.red ? 'red ' : '') + (on ? 'hl ' : '') + (dim ? 'dim' : '') + '">' +
      '<div class="r">' + p.rank + '</div><div class="s">' + p.suit + '</div></div>';
  }

  function combos(arr, k) {
    const out = [];
    (function rec(s, p) {
      if (p.length === k) { out.push(p.slice()); return; }
      for (let i = s; i < arr.length; i++) { p.push(arr[i]); rec(i + 1, p); p.pop(); }
    })(0, []);
    return out;
  }
  function eval5(cards) {
    const vals = cards.map(c => c.val).sort((a, b) => b - a);
    const suits = cards.map(c => c.suit);
    const cnt = {};
    vals.forEach(v => cnt[v] = (cnt[v] || 0) + 1);
    const by = Object.entries(cnt).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
    const flush = suits.every(s => s === suits[0]);
    const uniq = [...new Set(vals)].sort((a, b) => b - a);
    let str = false, hi = 0;
    if (uniq.length >= 5) {
      for (let i = 0; i <= uniq.length - 5; i++) {
        if (uniq[i] - uniq[i + 4] === 4) { str = true; hi = uniq[i]; break; }
      }
      if (!str && uniq.includes(14) && [5, 4, 3, 2].every(x => uniq.includes(x))) { str = true; hi = 5; }
    }
    if (flush && str) return { rank: 8, tie: [hi] };
    if (by[0][1] === 4) return { rank: 7, tie: [+by[0][0], +by[1][0]] };
    if (by[0][1] === 3 && by[1][1] === 2) return { rank: 6, tie: [+by[0][0], +by[1][0]] };
    if (flush) return { rank: 5, tie: vals };
    if (str) return { rank: 4, tie: [hi] };
    if (by[0][1] === 3) return { rank: 3, tie: [+by[0][0], ...vals.filter(v => v !== +by[0][0])] };
    if (by[0][1] === 2 && by[1] && by[1][1] === 2) {
      const p1 = Math.max(+by[0][0], +by[1][0]), p2 = Math.min(+by[0][0], +by[1][0]);
      return { rank: 2, tie: [p1, p2, vals.find(v => v !== p1 && v !== p2)] };
    }
    if (by[0][1] === 2) return { rank: 1, tie: [+by[0][0], ...vals.filter(v => v !== +by[0][0])] };
    return { rank: 0, tie: vals };
  }
  function cmpTie(a, b) {
    for (let i = 0; i < Math.max((a || []).length, (b || []).length); i++) {
      const d = (a[i] || 0) - (b[i] || 0);
      if (d) return d;
    }
    return 0;
  }
  function cmpHand(h1, h2) {
    if (!h1 && !h2) return 0;
    if (!h1) return -1;
    if (!h2) return 1;
    if (h1.rank !== h2.rank) return h1.rank - h2.rank;
    return cmpTie(h1.tie, h2.tie);
  }
  function bestOmaha(hole, board) {
    if (!hole || hole.length < 2) return null;
    const hp = hole.map(parse).filter(Boolean);
    const bp = (board || []).map(parse).filter(Boolean);
    if (bp.length < 3) {
      // Not enough board for real Omaha combo — no highlight (rank display only from hole pairs)
      const vals = hp.map(c => c.val).sort((a, b) => b - a);
      const cnt = {};
      vals.forEach(v => cnt[v] = (cnt[v] || 0) + 1);
      const pairs = Object.entries(cnt).filter(([, c]) => c >= 2).sort((a, b) => b[0] - a[0]);
      if (pairs.length >= 2) {
        const used = hp.filter(c => c.val === +pairs[0][0] || c.val === +pairs[1][0]).slice(0, 4);
        return { rank: 2, name: 'Две пары', usedRaws: used.map(c => c.raw), usedBoard: [], tie: [+pairs[0][0], +pairs[1][0]] };
      }
      if (pairs.length === 1) {
        return { rank: 1, name: 'Пара', usedRaws: hp.filter(c => c.val === +pairs[0][0]).map(c => c.raw), usedBoard: [], tie: [+pairs[0][0]] };
      }
      const top = hp.slice().sort((a, b) => b.val - a.val).slice(0, 2);
      // rank 0 — empty usedRaws so UI does not highlight high-card
      return { rank: 0, name: 'Старшая ' + top[0].rank, usedRaws: [], usedBoard: [], tie: top.map(c => c.val) };
    }
    let best = null, usedHole = [], usedBoard = [];
    for (const h of combos(hp, 2)) {
      for (const b of combos(bp, 3)) {
        const sc = eval5([...h, ...b]);
        if (!best || sc.rank > best.rank || (sc.rank === best.rank && cmpTie(sc.tie, best.tie) > 0)) {
          best = sc;
          usedHole = h.map(c => c.raw);
          usedBoard = b.map(c => c.raw);
        }
      }
    }
    if (!best) return null;
    best.name = HNAMES[best.rank];
    best.usedHole = usedHole;
    best.usedBoard = usedBoard;
    // Only mark cards that actually form the ranking pattern (not pure kickers)
    const all5 = usedHole.concat(usedBoard).map(parse).filter(Boolean);
    const key = new Set();
    if (best.rank === 0) {
      // high card — no highlight
      best.usedRaws = [];
      best.usedBoard = [];
    } else if (best.rank === 1 || best.rank === 2 || best.rank === 3 || best.rank === 7) {
      // pair / two pair / set / quads — highlight matching ranks from tie
      const ranks = (best.tie || []).slice(0, best.rank === 2 ? 2 : 1);
      if (best.rank === 7) ranks.push(best.tie[0]); // quads
      if (best.rank === 3) ranks.length = 1;
      all5.forEach(c => {
        if (ranks.some(r => +r === c.val) || (best.rank === 2 && ranks.some(r => +r === c.val))) key.add(c.raw);
      });
      // for set/quads/pair ensure we got them
      if (best.rank === 1) all5.filter(c => c.val === +best.tie[0]).forEach(c => key.add(c.raw));
      if (best.rank === 3) all5.filter(c => c.val === +best.tie[0]).forEach(c => key.add(c.raw));
      if (best.rank === 7) all5.filter(c => c.val === +best.tie[0]).forEach(c => key.add(c.raw));
      if (best.rank === 2) {
        all5.filter(c => c.val === +best.tie[0] || c.val === +best.tie[1]).forEach(c => key.add(c.raw));
      }
      best.usedRaws = [...key];
      best.usedBoard = usedBoard.filter(c => key.has(c));
    } else if (best.rank === 5 || best.rank === 8) {
      // flush / straight-flush — all 5 used
      best.usedRaws = usedHole.concat(usedBoard);
    } else if (best.rank === 4) {
      // straight — all 5
      best.usedRaws = usedHole.concat(usedBoard);
    } else if (best.rank === 6) {
      // full house — three + two
      const t3 = +best.tie[0], t2 = +best.tie[1];
      all5.filter(c => c.val === t3 || c.val === t2).forEach(c => key.add(c.raw));
      best.usedRaws = [...key];
      best.usedBoard = usedBoard.filter(c => key.has(c));
    } else {
      best.usedRaws = usedHole.concat(usedBoard);
    }
    return best;
  }

  function seats(players) {
    return Object.keys(players || {}).sort((a, b) => (players[a].seat || 0) - (players[b].seat || 0));
  }
  function alive(players) {
    return seats(players).filter(u => players[u] && !players[u].folded);
  }
  function canBet(players) {
    return alive(players).filter(u => !players[u].allIn);
  }

  function nextBettor(players, fromUid) {
    const list = canBet(players);
    if (!list.length) return null;
    if (list.length === 1 && list[0] === fromUid) return null;
    const i = list.indexOf(fromUid);
    if (i < 0) return list[0];
    return list[(i + 1) % list.length];
  }

  function streetDone(players, game) {
    const act = alive(players);
    if (act.length <= 1) return true;

    const need = Number(game.currentBet) || 0;
    const matched = act.every(u => {
      const p = players[u];
      return p.allIn || (Number(p.bet) || 0) >= need;
    });
    if (!matched) return false;

    const stillNeed = canBet(players);
    if (stillNeed.length === 0) return true;

    const acted = game.acted || {};
    return stillNeed.every(u => acted[u] === true);
  }

  function avatar(uid, seat) {
    let h = 0;
    for (let i = 0; i < (uid || '').length; i++) h = (h * 31 + uid.charCodeAt(i)) | 0;
    return AVS[Math.abs(h + (seat || 0)) % AVS.length];
  }
  function clearTimer() {
    if (timer) { clearInterval(timer); timer = null; }
    secs = 60;
    const t = el('timer');
    if (t) { t.textContent = '—'; t.classList.remove('urg'); }
  }
  function startTimer() {
    clearTimer();
    secs = 60;
    const t = el('timer');
    timer = setInterval(() => {
      secs--;
      if (t) { t.textContent = secs + 'с'; t.classList.toggle('urg', secs <= 10); }
      if (secs <= 10 && secs > 0) S.tick();
      if (secs <= 0) {
        clearTimer();
        if (room?.game?.currentTurn === myUid) {
          const me = room.players[myUid];
          const need = Math.max(0, (room.game.currentBet || 0) - (me?.bet || 0));
          if (me?.allIn) scheduleAdvance();
          else if (need > 0) doAction('fold');
          else doAction('check');
        }
      }
    }, 1000);
  }

  function highlightCombo(rank) {
    document.querySelectorAll('.combo').forEach(n => n.classList.toggle('on', rank != null && +n.dataset.r === rank));
  }

  function renderPlayers(players) {
    const row = el('seats');
    if (!row) return;
    row.innerHTML = '';
    if (!players) return;
    const g = room?.game || {};
    const turn = g.currentTurn, phase = g.phase;
    const board = (g.communityCards || []).filter(isValidCard);
    const winners = g.winners || [];
    const hostUid = room?.info?.hostUid;
    const waiting = room?.info?.status === 'waiting';

    Object.entries(players).forEach(([uid, p]) => {
      const d = document.createElement('div');
      const ready = !!p.ready && waiting;
      d.className = 'seat'
        + (uid === myUid ? ' me' : '')
        + (uid === turn ? ' turn' : '')
        + (p.folded ? ' folded' : '')
        + (winners.includes(uid) || uid === g.winnerUid ? ' winner' : '')
        + (p.allIn ? ' allin' : '')
        + (ready ? ' ready' : '');

      let cards = '', handName = '';
      const hand = Array.isArray(p.hand) ? p.hand.filter(isValidCard) : [];
      if (uid === myUid && hand.length) {
        const best = bestOmaha(hand, board);
        // only highlight if pair or better
        const hl = (best && best.rank >= 1 && best.usedRaws) ? new Set(best.usedRaws) : null;
        cards = hand.map(c => cardHTML(c, hl)).join('');
        if (best && best.rank >= 1) handName = best.name;
        else if (best) handName = best.name; // still show name but no glow for high card
      } else if (hand.length && phase === 'showdown') {
        const best = bestOmaha(hand, board);
        const hl = (best && best.rank >= 1 && best.usedRaws) ? new Set(best.usedRaws) : null;
        cards = hand.map(c => cardHTML(c, hl)).join('');
        if (best) handName = best.name;
      } else if (hand.length) {
        cards = '<div class="card back">?</div>'.repeat(Math.min(4, hand.length) || 4);
      }

      d.innerHTML =
        '<div class="avatar">' + avatar(uid, p.seat) +
          (uid === hostUid ? '<span class="crown">👑</span>' : '') +
          '<span class="ring"></span></div>' +
        '<div class="name">' + (p.name || 'Игрок') + (uid === myUid ? ' · ты' : '') + '</div>' +
        '<div class="stack">$' + (uid === myUid ? Math.floor(bal()) : (p.stack ?? 0)) + '</div>' +
        '<div class="betline">' + (p.folded ? 'ПАСС' : (p.allIn ? 'ALL-IN $' + (p.bet || 0) : (p.bet ? 'Ставка $' + p.bet : ''))) + '</div>' +
        '<div class="mini-cards">' + cards + '</div>' +
        '<div class="hand-name">' + handName + '</div>';
      row.appendChild(d);
    });
  }

  function renderBoard(cards, hlSet) {
    const b = el('board');
    if (!b) return;
    const valid = (cards || []).filter(isValidCard);
    if (!valid.length) {
      b.innerHTML =
        '<div class="board-slot"></div>'.repeat(5) +
        '<div class="board-hint">общие карты · после префлопа</div>';
      return;
    }
    let html = valid.map((c, i) => {
      // Do NOT break class attribute — inject style inside the opening tag
      let h = cardHTML(c, hlSet || null);
      h = h.replace('<div class="card', '<div style="animation-delay:' + (i * 0.08) + 's" class="card');
      return h;
    }).join('');
    for (let i = valid.length; i < 5; i++) html += '<div class="board-slot"></div>';
    b.innerHTML = html;
  }

  function renderMine(hand) {
    const box = el('my-hand'), lab = el('my-label');
    if (!box || !lab) return;
    const valid = (hand || []).filter(isValidCard);
    if (!valid.length) { box.innerHTML = ''; lab.innerHTML = 'Твоя рука'; highlightCombo(null); return; }
    const board = (room?.game?.communityCards || []).filter(isValidCard);
    const best = bestOmaha(valid, board);
    const hl = (best && best.rank >= 1 && best.usedRaws) ? new Set(best.usedRaws) : null;
    box.innerHTML = valid.map(c => cardHTML(c, hl)).join('');
    if (best) { lab.innerHTML = 'Твоя рука · <b>' + best.name + '</b>'; highlightCombo(best.rank >= 1 ? best.rank : null); }
    else { lab.innerHTML = 'Твоя рука'; highlightCombo(null); }
  }

  function renderPotChips(pot) {
    const box = el('pot-chips');
    if (!box) return;
    const n = Math.min(12, Math.max(0, Math.ceil((pot || 0) / 120)));
    box.innerHTML = '';
    for (let i = 0; i < n; i++) {
      const s = document.createElement('span');
      s.className = 'pchip c' + (i % 5);
      s.style.setProperty('--i', i);
      box.appendChild(s);
    }
  }

  function scheduleAdvance(delay) {
    if (advanceTimer) clearTimeout(advanceTimer);
    advanceTimer = setTimeout(() => {
      advanceTimer = null;
      tryAdvance();
    }, delay == null ? 320 : delay);
  }

  let _uiHash = '';
  function updateUI(data) {
    room = data;
    if (!data) return;
    const status = data.info?.status || 'waiting';
    const players = data.players || {};
    const game = data.game || {};
    // Skip identical UI frames (Firebase can fire often)
    try {
      const h = status + '|' + (game.phase||'') + '|' + (game.currentTurn||'') + '|' + (game.pot||0) + '|' +
        (game.seq||'') + '|' + (game.communityCards||[]).join(',') + '|' +
        Object.keys(players).map(u => u + ':' + (players[u].bet||0) + ':' + (players[u].folded?1:0) + ':' + (players[u].stack||0) + ':' + (players[u].ready?1:0) + ':' + ((players[u].hand||[]).length)).join(';');
      if (h === _uiHash && game.phase !== 'showdown') return;
      _uiHash = h;
    } catch (e) {}
    // Winner overlay: show to ALL clients on showdown; hide otherwise
    const ov = el('winner-ov');
    if (game.phase === 'showdown' && (game.winners || []).length) {
      showWinnerToEveryone(game, players);
    } else if (ov) {
      ov.classList.remove('show');
    }
    const list = Object.values(players);
    const readyN = list.filter(p => p.ready).length;

    isHost = data.info?.hostUid === myUid;

    let st = '';
    if (status === 'waiting') st = 'Ожидание · ' + readyN + '/' + list.length + ' готовы';
    else if (status === 'playing') {
      if (!game.currentTurn) st = (PHASES[game.phase] || game.phase) + ' · раздача...';
      else st = (PHASES[game.phase] || game.phase) + ' · ход: ' + (players[game.currentTurn]?.name || '—');
    } else st = 'Стол';

    if (el('status')) el('status').textContent = st;
    if (el('pot')) el('pot').textContent = '$' + (game.pot || 0);
    if (el('phase')) el('phase').textContent = PHASES[game.phase] || 'OMAHA';
    renderPotChips(game.pot);
    renderPlayers(players);
    // Highlight board only when real combo (pair+) — never for high-card-only
    let boardHl = null;
    const boardCards = (game.communityCards || []).filter(isValidCard);
    if (boardCards.length >= 3) {
      if (game.phase === 'showdown' && (game.winners || []).length) {
        const set = new Set();
        (game.winners || []).forEach(uid => {
          const h = (players[uid]?.hand || []).filter(isValidCard);
          const best = bestOmaha(h, boardCards);
          if (best && best.rank >= 1) {
            (best.usedBoard || []).forEach(c => set.add(c));
          }
        });
        if (set.size) boardHl = set;
      } else if (players[myUid]?.hand) {
        const best = bestOmaha((players[myUid].hand || []).filter(isValidCard), boardCards);
        if (best && best.rank >= 1 && best.usedBoard?.length) {
          boardHl = new Set(best.usedBoard);
        }
      }
    }
    renderBoard(game.communityCards, boardHl);
    renderMine(players[myUid]?.hand);

    const myTurn = !!game.currentTurn && game.currentTurn === myUid && status === 'playing' && !showdownLock && game.phase !== 'showdown';
    const me = players[myUid];
    const need = Math.max(0, (Number(game.currentBet) || 0) - (Number(me?.bet) || 0));
    const money = Math.max(0, Math.floor(bal()));
    const broke = !!me?.allIn || money <= 0;

    // Deduct blinds from REAL casino balance once per hand (SB/BB)
    if (status === 'playing' && game.phase === 'preflop' && me) {
      const seq = game.seq || 0;
      const blindKey = 'pokerBlind_' + roomCode + '_' + seq;
      if (seq && !sessionStorage.getItem(blindKey)) {
        const myBet = Number(me.bet) || 0;
        if (myBet > 0) {
          sessionStorage.setItem(blindKey, '1');
          pay(myBet); // takes from main casino balance
          db.ref('rooms/' + roomCode + '/players/' + myUid + '/stack').set(Math.floor(bal())).catch(() => {});
        } else {
          sessionStorage.setItem(blindKey, '1');
        }
      }
    }

    if (el('btn-ready')) el('btn-ready').style.display = status === 'waiting' ? 'inline-block' : 'none';

    const canCheck = myTurn && !me?.folded && !broke && need === 0;
    const canCall = myTurn && !me?.folded && !broke && need > 0;
    const canRaise = myTurn && !me?.folded && !broke && money >= 10;
    const canAllin = myTurn && !me?.folded && !me?.allIn && money >= 1;
    const canFold = myTurn && !me?.folded;

    if (el('btn-pass')) el('btn-pass').disabled = !canFold;
    if (el('btn-check')) el('btn-check').disabled = !canCheck;
    if (el('btn-call')) el('btn-call').disabled = !canCall;
    if (el('btn-raise')) el('btn-raise').disabled = !canRaise;
    if (el('btn-allin')) el('btn-allin').disabled = !canAllin;
    if (el('raise-amt')) el('raise-amt').disabled = !canRaise;

    if (el('btn-call')) {
      if (need > 0) {
        const canPay = Math.min(need, money);
        el('btn-call').textContent = canPay < need ? ('Сравнять $' + canPay + ' (всё)') : ('Сравнять $' + need);
      } else {
        el('btn-call').textContent = 'Сравнять';
      }
    }

    if (status === 'playing' && game.phase !== 'showdown' && !showdownLock) {
      if (streetDone(players, game) || !game.currentTurn) {
        scheduleAdvance(streetDone(players, game) ? 280 : 450);
      }
    }

    // 60s turn timer — runs on the device whose turn it is; others see "ход"
    if (myTurn && !broke) {
      if (lastTurn !== myUid) { lastTurn = myUid; startTimer(); }
    } else {
      if (lastTurn === myUid) lastTurn = null;
      // Keep timer display for observers via shared end time if present
      if (!myTurn) {
        clearTimer();
        const t = el('timer');
        if (t && game.currentTurn && status === 'playing') {
          t.textContent = 'ход';
          t.classList.remove('urg');
        }
      }
    }
  }

  async function startHand() {
    const snap = await db.ref('rooms/' + roomCode).once('value');
    const data = snap.val();
    if (!data) return;
    if (data.info?.status === 'playing') return;
    const players = data.players || {};
    const uids = seats(players);
    if (uids.length < 2) return;

    const d = makeDeck();
    const updates = {};
    const sb = 10, bb = 20;

    uids.forEach((uid, i) => {
      const h = [d.pop(), d.pop(), d.pop(), d.pop()];
      // Use stack already synced from each player's real balance on ready/join
      const prevStack = Number(players[uid].stack);
      const startStack = Number.isFinite(prevStack) && prevStack >= 0 ? prevStack : 0;
      updates['players/' + uid + '/hand'] = h;
      updates['players/' + uid + '/bet'] = 0;
      updates['players/' + uid + '/folded'] = false;
      updates['players/' + uid + '/ready'] = false;
      updates['players/' + uid + '/allIn'] = false;
      updates['players/' + uid + '/seat'] = i;
      updates['players/' + uid + '/stack'] = startStack;
    });

    const sbStack = Number(updates['players/' + uids[0] + '/stack']) || 0;
    const bbStack = Number(updates['players/' + uids[1] + '/stack']) || 0;
    const sbAmt = Math.min(sb, Math.max(0, sbStack));
    const bbAmt = Math.min(bb, Math.max(0, bbStack));
    updates['players/' + uids[0] + '/bet'] = sbAmt;
    updates['players/' + uids[0] + '/stack'] = sbStack - sbAmt;
    if (sbAmt < sb || sbStack - sbAmt <= 0) updates['players/' + uids[0] + '/allIn'] = true;
    updates['players/' + uids[1] + '/bet'] = bbAmt;
    updates['players/' + uids[1] + '/stack'] = bbStack - bbAmt;
    if (bbAmt < bb || bbStack - bbAmt <= 0) updates['players/' + uids[1] + '/allIn'] = true;

    const first = uids.length === 2 ? uids[0] : uids[2 % uids.length];
    const pot = sbAmt + bbAmt;

    updates['game'] = {
      pot: pot,
      phase: 'preflop',
      communityCards: [],
      currentBet: Math.max(sbAmt, bbAmt),
      currentTurn: first,
      deck: d,
      hostUid: data.info?.hostUid || myUid,
      acted: {},
      lastAggressor: uids[1],
      winnerUid: null,
      winners: null,
      seq: Date.now()
    };
    updates['info/status'] = 'playing';
    showdownLock = false;
    advancing = false;
    lastAdvanceSeq = 0;
    await db.ref('rooms/' + roomCode).update(updates);
    S.deal();
    // Host already wrote stacks; each client will sync blinds from real balance in updateUI
  }

  async function finishHand(winners, pot, players, handName) {
    if (showdownLock) return;
    showdownLock = true;
    const share = Math.floor(pot / Math.max(1, winners.length));
    const rem = pot - share * winners.length;

    const stackUpdates = {};
    const payouts = {};
    winners.forEach((uid, i) => {
      const amt = share + (i === 0 ? rem : 0);
      const cur = Number(players[uid]?.stack) || 0;
      stackUpdates['players/' + uid + '/stack'] = cur + amt;
      payouts[uid] = amt;
      // Real balance credit happens in showWinnerToEveryone (all clients, once)
    });

    await db.ref('rooms/' + roomCode).update(Object.assign({
      'game/phase': 'showdown',
      'game/currentTurn': null,
      'game/winners': winners,
      'game/winnerUid': winners[0],
      'game/payouts': payouts,
      'game/winHand': handName || null,
      'game/lastPot': pot,
      'game/seq': Date.now()
    }, stackUpdates));

    setTimeout(() => {
      db.ref('rooms/' + roomCode + '/game/pot').set(0).catch(() => {});
    }, 400);

    const names = winners.map(u => players[u]?.name || 'Игрок').join(', ');
    if (el('msg')) {
      el('msg').textContent = winners.length > 1
        ? ('Ничья: ' + names + ' · по $' + share)
        : ('Победитель: ' + names + ' · +$' + pot);
    }
    // Overlay+music triggered via Firebase update → updateUI → showWinnerToEveryone for ALL

    setTimeout(async () => {
      const ov = el('winner-ov');
      if (ov) ov.classList.remove('show');
      stopWinMusic();
      const reset = {
        'info/status': 'waiting',
        'game/winnerUid': null,
        'game/winners': null,
        'game/payouts': null,
        'game/winHand': null,
        'game/communityCards': [],
        'game/phase': 'preflop',
        'game/pot': 0,
        'game/currentTurn': null,
        'game/acted': {}
      };
      Object.keys(players).forEach(uid => {
        reset['players/' + uid + '/ready'] = false;
        reset['players/' + uid + '/hand'] = null;
        reset['players/' + uid + '/bet'] = 0;
        reset['players/' + uid + '/folded'] = false;
        reset['players/' + uid + '/allIn'] = false;
      });
      await db.ref('rooms/' + roomCode).update(reset);
      showdownLock = false;
      advancing = false;
      if (el('msg')) el('msg').textContent = 'Раунд окончен · нажми «Готов» для новой раздачи';
    }, 8000);
  }

  async function doShowdown(act, board, players, pot) {
    let best = null;
    const scores = {};
    for (const uid of act) {
      const hand = (players[uid]?.hand || []).filter(isValidCard);
      if (hand.length < 2) continue;
      const sc = bestOmaha(hand, board.filter(isValidCard));
      scores[uid] = sc;
      if (!best || cmpHand(sc, best) > 0) best = sc;
    }
    let winners = act.filter(u => scores[u] && cmpHand(scores[u], best) === 0);
    if (!winners.length) winners = [act[0]];
    await finishHand(winners, pot, players, best?.name);
  }

  async function tryAdvance() {
    if (advancing || showdownLock || !room) return;
    const game = room.game, players = room.players;
    if (!game || game.phase === 'showdown') return;
    if (room.info?.status !== 'playing') return;

    const act = alive(players);
    if (act.length <= 1) {
      advancing = true;
      try { if (act[0]) await finishHand([act[0]], game.pot || 0, players, null); }
      finally { setTimeout(() => { advancing = false; }, 300); }
      return;
    }

    const done = streetDone(players, game);
    const stuck = !game.currentTurn;
    if (!done && !stuck) return;

    if (!done && stuck) {
      const need = Number(game.currentBet) || 0;
      const matched = act.every(u => players[u].allIn || (Number(players[u].bet) || 0) >= need);
      const bettors = canBet(players);
      if (!matched && bettors.length > 0) {
        const needAct = bettors.find(u => (Number(players[u].bet) || 0) < need) || bettors[0];
        try {
          await db.ref('rooms/' + roomCode + '/game/currentTurn').set(needAct);
        } catch (e) {}
        return;
      }
    }

    advancing = true;
    try {
      const snap = await db.ref('rooms/' + roomCode).once('value');
      const fresh = snap.val();
      if (!fresh?.game || fresh.game.phase === 'showdown' || fresh.info?.status !== 'playing') return;

      const g = fresh.game;
      const pl = fresh.players;
      const seq = g.seq || 0;
      if (seq && seq === lastAdvanceSeq) return;

      const act2 = alive(pl);
      const bettors2 = canBet(pl);
      const done2 = streetDone(pl, g);
      const forceRunout = bettors2.length <= 1;

      if (!done2 && !forceRunout) {
        if (!g.currentTurn && bettors2.length) {
          const need = Number(g.currentBet) || 0;
          const next = bettors2.find(u => (Number(pl[u].bet) || 0) < need) || bettors2[0];
          await db.ref('rooms/' + roomCode + '/game/currentTurn').set(next);
        }
        return;
      }

      const newSeq = Date.now();
      lastAdvanceSeq = newSeq;

      let dk = Array.isArray(g.deck) ? g.deck.filter(isValidCard) : [];
      if (dk.length < 5) {
        const used = new Set();
        act2.forEach(u => (pl[u].hand || []).forEach(c => { if (c) used.add(c); }));
        (g.communityCards || []).forEach(c => { if (c) used.add(c); });
        dk = makeDeck().filter(c => !used.has(c));
      }

      let board = (g.communityCards || []).filter(isValidCard);
      const pot = Number(g.pot) || 0;

      if (forceRunout) {
        while (board.length < 5 && dk.length) {
          const c = dk.pop();
          if (isValidCard(c)) board.push(c);
        }
        board = board.filter(isValidCard).slice(0, 5);
        S.deal();
        await db.ref('rooms/' + roomCode).update({
          'game/phase': 'showdown',
          'game/communityCards': board,
          'game/deck': dk,
          'game/currentBet': 0,
          'game/currentTurn': null,
          'game/acted': {},
          'game/seq': newSeq
        });
        setTimeout(() => doShowdown(act2, board, pl, pot), 500);
        return;
      }

      let next = g.phase;
      if (g.phase === 'preflop') {
        board = [];
        for (let i = 0; i < 3 && dk.length; i++) {
          const c = dk.pop();
          if (isValidCard(c)) board.push(c);
        }
        while (board.length < 3 && dk.length) {
          const c = dk.pop();
          if (isValidCard(c)) board.push(c);
        }
        next = 'flop';
        S.deal();
      } else if (g.phase === 'flop') {
        if (dk.length) {
          const c = dk.pop();
          if (isValidCard(c)) board.push(c);
        }
        next = 'turn';
        S.deal();
      } else if (g.phase === 'turn') {
        if (dk.length) {
          const c = dk.pop();
          if (isValidCard(c)) board.push(c);
        }
        next = 'river';
        S.deal();
      } else if (g.phase === 'river') {
        next = 'showdown';
      }

      if (next === 'showdown') {
        await db.ref('rooms/' + roomCode).update({
          'game/phase': 'showdown',
          'game/communityCards': board,
          'game/deck': dk,
          'game/currentBet': 0,
          'game/currentTurn': null,
          'game/acted': {},
          'game/seq': newSeq
        });
        setTimeout(() => doShowdown(act2, board, pl, pot), 500);
        return;
      }

      const first = bettors2[0];
      const updates = {
        'game/phase': next,
        'game/communityCards': board,
        'game/deck': dk,
        'game/currentBet': 0,
        'game/currentTurn': first,
        'game/acted': {},
        'game/lastAggressor': null,
        'game/seq': newSeq
      };
      act2.forEach(u => { updates['players/' + u + '/bet'] = 0; });
      await db.ref('rooms/' + roomCode).update(updates);
      if (el('msg')) el('msg').textContent = (PHASES[next] || next) + ' · общие карты на столе';
    } catch (err) {
      console.error('tryAdvance', err);
    } finally {
      setTimeout(() => { advancing = false; }, 400);
    }
  }

  async function doAction(type) {
    if (!room?.game || room.game.currentTurn !== myUid) return;
    if (room.players[myUid]?.folded || showdownLock) return;
    if (room.game.phase === 'showdown') return;

    clearTimer();
    lastTurn = null;

    const players = room.players, game = room.game, me = players[myUid];
    const need = Math.max(0, (Number(game.currentBet) || 0) - (Number(me.bet) || 0));
    // Real casino balance is the source of truth for my chips
    const money = Math.max(0, Math.floor(bal()));

    if (type === 'check' && need > 0) {
      if (el('msg')) el('msg').textContent = 'Нужно сравнять $' + need + ' или пас';
      return;
    }
    if (type === 'call' && need <= 0) {
      type = 'check';
    }

    const updates = {};
    let raised = false;
    let newBet = Number(me.bet) || 0;
    let newStack = money;
    let newPot = Number(game.pot) || 0;
    let newCurrentBet = Number(game.currentBet) || 0;
    let wentAllIn = !!me.allIn;

    if (type === 'fold') {
      updates['players/' + myUid + '/folded'] = true;
      S.fold();
    }

    if (type === 'check') {
      S.check();
    }

    if (type === 'call') {
      const amount = Math.min(need, money);
      if (amount < 1 && need > 0) {
        updates['players/' + myUid + '/folded'] = true;
        S.fold();
        type = 'fold';
      } else {
        if (amount > 0 && !pay(amount)) {
          if (el('msg')) el('msg').textContent = 'Недостаточно средств на балансе';
          return;
        }
        newBet = (Number(me.bet) || 0) + amount;
        newStack = Math.floor(bal());
        newPot += amount;
        if (amount < need || newStack <= 0) wentAllIn = true;
        S.chip();
      }
    }

    if (type === 'raise') {
      const by = Math.max(10, Math.floor(+el('raise-amt').value) || 50);
      const target = (Number(game.currentBet) || 0) + by;
      let amount = Math.max(0, target - (Number(me.bet) || 0));
      if (amount > money) amount = money;
      if (amount < 1) {
        if (el('msg')) el('msg').textContent = 'Недостаточно средств на балансе';
        return;
      }
      if (!pay(amount)) {
        if (el('msg')) el('msg').textContent = 'Недостаточно средств на балансе';
        return;
      }
      newBet = (Number(me.bet) || 0) + amount;
      newStack = Math.floor(bal());
      newPot += amount;
      if (newBet > newCurrentBet) {
        newCurrentBet = newBet;
        raised = true;
      }
      if (newStack <= 0) wentAllIn = true;
      S.raise();
    }

    if (type === 'allin') {
      const amount = Math.floor(money);
      if (amount < 1) {
        if (el('msg')) el('msg').textContent = 'Нет средств на балансе';
        return;
      }
      if (!pay(amount)) {
        if (el('msg')) el('msg').textContent = 'Недостаточно средств на балансе';
        return;
      }
      newBet = (Number(me.bet) || 0) + amount;
      newStack = Math.floor(bal());
      newPot += amount;
      wentAllIn = true;
      if (newBet > newCurrentBet) {
        newCurrentBet = newBet;
        raised = true;
      }
      S.raise();
    }

    if (type !== 'fold') {
      updates['players/' + myUid + '/bet'] = newBet;
      updates['players/' + myUid + '/stack'] = newStack;
      updates['game/pot'] = newPot;
      if (newCurrentBet !== (Number(game.currentBet) || 0)) {
        updates['game/currentBet'] = newCurrentBet;
      }
      if (wentAllIn) updates['players/' + myUid + '/allIn'] = true;
    }

    const acted = Object.assign({}, game.acted || {});
    acted[myUid] = true;
    if (raised) {
      Object.keys(players).forEach(u => {
        if (u !== myUid && players[u] && !players[u].folded && !players[u].allIn) {
          acted[u] = false;
        }
      });
      updates['game/lastAggressor'] = myUid;
    }
    updates['game/acted'] = acted;

    const tmp = JSON.parse(JSON.stringify(players));
    if (updates['players/' + myUid + '/folded']) tmp[myUid].folded = true;
    if (updates['players/' + myUid + '/allIn']) tmp[myUid].allIn = true;
    if (updates['players/' + myUid + '/bet'] != null) tmp[myUid].bet = updates['players/' + myUid + '/bet'];
    if (updates['players/' + myUid + '/stack'] != null) tmp[myUid].stack = updates['players/' + myUid + '/stack'];

    const simBet = updates['game/currentBet'] != null ? updates['game/currentBet'] : game.currentBet;
    const simGame = { currentBet: simBet, acted: acted };
    const done = streetDone(tmp, simGame);
    const bettorsLeft = canBet(tmp);

    if (done || bettorsLeft.length === 0 || (bettorsLeft.length === 1 && bettorsLeft[0] === myUid && !raised)) {
      updates['game/currentTurn'] = null;
    } else {
      updates['game/currentTurn'] = nextBettor(tmp, myUid);
    }

    updates['game/seq'] = Date.now();
    await db.ref('rooms/' + roomCode).update(updates);

    setTimeout(() => scheduleAdvance(300), 80);
    setTimeout(() => scheduleAdvance(700), 80);
  }

  el('btn-ready').addEventListener('click', async () => {
    audio();
    if (!myUid || !roomCode) return;
    // Sync real casino balance → poker stack before ready
    await db.ref('rooms/' + roomCode + '/players/' + myUid).update({
      ready: true,
      stack: Math.floor(bal())
    });
    S.ready();
    const snap = await db.ref('rooms/' + roomCode).once('value');
    const data = snap.val();
    if (!data) return;
    const plist = Object.values(data.players || {});
    if (plist.length >= 2 && plist.every(p => p.ready) && data.info.status === 'waiting') {
      isHost = data.info.hostUid === myUid;
      if (isHost) {
        await startHand();
      } else {
        setTimeout(async () => {
          const s2 = await db.ref('rooms/' + roomCode).once('value');
          const d2 = s2.val();
          if (d2 && d2.info?.status === 'waiting' && Object.values(d2.players || {}).every(p => p.ready)) {
            await db.ref('rooms/' + roomCode + '/info/hostUid').set(myUid);
            isHost = true;
            await startHand();
          }
        }, 1800);
      }
    }
  });
  el('btn-pass').onclick = () => doAction('fold');
  el('btn-check').onclick = () => doAction('check');
  el('btn-call').onclick = () => doAction('call');
  el('btn-raise').onclick = () => doAction('raise');
  el('btn-allin').onclick = () => doAction('allin');

  async function init() {
    if (!roomCode) { alert('Нет кода комнаты'); location.href = 'index.html'; return; }
    const user = auth.currentUser || (await auth.signInAnonymously()).user;
    myUid = user.uid;
    const name = (typeof currentAccount === 'function' && currentAccount()?.name) || 'Игрок';
    const startBal = Math.max(0, Math.floor(bal()) || 0);
    await db.ref('rooms/' + roomCode + '/players/' + myUid).update({
      name,
      stack: startBal
    }).catch(() => {});
    db.ref('rooms/' + roomCode).on('value', snap => {
      if (!snap.exists()) { alert('Комната закрыта'); location.href = 'index.html'; return; }
      const data = snap.val();
      isHost = data.info?.hostUid === myUid;
      updateUI(data);
    });
  }
  init();
})();
