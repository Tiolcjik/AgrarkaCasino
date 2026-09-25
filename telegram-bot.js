/**
 * Аграрка Элит — Telegram-бот кассы
 * Запуск: node telegram-bot.js
 * Node.js 18+
 */

// ============ НАСТРОЙКИ ============
const TELEGRAM_BOT_TOKEN = '8431266741:AAHRbkjrxsLxk5zxsktBO9sS_sMJ3PQ3O4w'; // '7123456789:AAHxxxx'
const TELEGRAM_ADMIN_CHAT_ID = '1037850021'; // '7331981797'
// ==================================

const FB_DB_URL = 'https://agrarka-pokerr-default-rtdb.europe-west1.firebasedatabase.app';

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_ADMIN_CHAT_ID) {
  console.error('ERROR: Fill TELEGRAM_BOT_TOKEN and TELEGRAM_ADMIN_CHAT_ID');
  process.exit(1);
}

const TG = 'https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN;
const ADMIN_ID = String(TELEGRAM_ADMIN_CHAT_ID).trim();
let offset = 0;
const notified = new Set();

function sleep(ms) {
  return new Promise(function (r) { setTimeout(r, ms); });
}

function fmtUAH(n) {
  return Math.floor(Number(n) || 0).toLocaleString('uk-UA') + ' UAH';
}

async function tg(method, body) {
  try {
    const res = await fetch(TG + '/' + method, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
    const data = await res.json();
    if (!data.ok) console.warn('TG ERR', method, data.description || JSON.stringify(data));
    return data;
  } catch (e) {
    console.error('TG fetch', method, e.message || e);
    return { ok: false, description: String(e.message || e) };
  }
}

async function fbGet(path) {
  const res = await fetch(FB_DB_URL + '/' + path + '.json');
  if (!res.ok) throw new Error('Firebase GET ' + path + ' -> ' + res.status);
  return res.json();
}

async function fbPatch(path, data) {
  const res = await fetch(FB_DB_URL + '/' + path + '.json', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Firebase PATCH ' + path + ' -> ' + res.status);
  return res.json();
}

async function fbSet(path, data) {
  const res = await fetch(FB_DB_URL + '/' + path + '.json', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Firebase SET ' + path + ' -> ' + res.status);
  return res.json();
}

async function fbPush(path, data) {
  const res = await fetch(FB_DB_URL + '/' + path + '.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Firebase PUSH ' + path + ' -> ' + res.status);
  return res.json();
}

async function pushHistory(login, entry) {
  if (!login) return;
  await fbPush('realHistory/' + login, Object.assign({}, entry, {
    timestamp: entry.timestamp || Date.now()
  }));
}

async function approveDeposit(key) {
  const d = await fbGet('pendingDeposits/' + key);
  console.log('approveDeposit data:', key, d);
  if (!d) throw new Error('Заявка не найдена в Firebase');
  if (d.status !== 'pending') throw new Error('Уже обработана: ' + d.status);
  await fbPatch('pendingDeposits/' + key, { status: 'approved', approvedAt: Date.now() });
  const cur = await fbGet('realBalances/' + d.login);
  const bal = Math.floor(parseFloat(cur) || 0);
  const next = bal + Math.floor(d.amount || 0);
  await fbSet('realBalances/' + d.login, next);
  console.log('Balance', d.login, bal, '->', next);
  await pushHistory(d.login, {
    type: 'deposit', amount: d.amount, status: 'approved',
    note: 'Пополнение подтверждено (Telegram)'
  });
  return d;
}

async function rejectDeposit(key) {
  const d = await fbGet('pendingDeposits/' + key);
  if (!d) throw new Error('Заявка не найдена');
  await fbPatch('pendingDeposits/' + key, { status: 'rejected', rejectedAt: Date.now() });
  if (d.login) {
    await pushHistory(d.login, {
      type: 'deposit', amount: d.amount || 0, status: 'rejected',
      note: 'Пополнение отклонено (Telegram)'
    });
  }
  return d;
}

async function approveWithdraw(key) {
  const d = await fbGet('pendingWithdrawals/' + key);
  console.log('approveWithdraw data:', key, d);
  if (!d) throw new Error('Заявка не найдена в Firebase');
  if (d.status !== 'pending') throw new Error('Уже обработана: ' + d.status);
  await fbPatch('pendingWithdrawals/' + key, { status: 'approved', approvedAt: Date.now() });
  await pushHistory(d.login, {
    type: 'withdraw', amount: -(d.amount || 0), status: 'approved',
    card: d.cardFmt || d.card, note: 'Вывод выполнен (Telegram)'
  });
  return d;
}

async function rejectWithdraw(key) {
  const d = await fbGet('pendingWithdrawals/' + key);
  if (!d) throw new Error('Заявка не найдена');
  if (d.status !== 'pending') throw new Error('Уже обработана: ' + d.status);
  const cur = await fbGet('realBalances/' + d.login);
  const bal = Math.floor(parseFloat(cur) || 0);
  await fbSet('realBalances/' + d.login, bal + Math.floor(d.amount || 0));
  await fbPatch('pendingWithdrawals/' + key, { status: 'rejected', rejectedAt: Date.now() });
  await pushHistory(d.login, {
    type: 'withdraw', amount: d.amount || 0, status: 'rejected',
    card: d.cardFmt || d.card, note: 'Вывод отклонён, возврат (Telegram)'
  });
  return d;
}

async function sendRequestMessage(type, key, d) {
  const isDep = type === 'deposit';
  const title = isDep ? '⬇️ НОВОЕ ПОПОЛНЕНИЕ' : '⬆️ НОВЫЙ ВЫВОД';
  let text = '<b>' + title + '</b>\n\n';
  text += '👤 <b>' + (d.name || d.login) + '</b> (@' + d.login + ')\n';
  text += '💰 Сумма: <b>' + fmtUAH(d.amount) + '</b>\n';
  if (d.cardFmt || d.card) text += '💳 Карта: <code>' + (d.cardFmt || d.card) + '</code>\n';
  text += '🆔 <code>' + key + '</code>\n';
  text += '🕐 ' + new Date(d.timestamp || Date.now()).toLocaleString('ru-RU');

  // callback_data max 64 bytes — ключи Firebase короткие, ок
  const res = await tg('sendMessage', {
    chat_id: ADMIN_ID,
    text: text,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [[
        { text: isDep ? '✅ Начислить' : '✅ Я перевёл', callback_data: (isDep ? 'A:' : 'C:') + key },
        { text: '❌ Отклонить', callback_data: (isDep ? 'B:' : 'D:') + key }
      ]]
    }
  });
  return res.ok;
}

async function watchFirebase() {
  try {
    const deps = (await fbGet('pendingDeposits')) || {};
    const wds = (await fbGet('pendingWithdrawals')) || {};

    for (const key of Object.keys(deps)) {
      const d = deps[key];
      if (!d || d.status !== 'pending') continue;
      if (d.tgNotified) { notified.add('dep:' + key); continue; }
      const id = 'dep:' + key;
      if (notified.has(id)) continue;
      notified.add(id); // сразу, чтобы не отправить дважды
      try {
        await fbPatch('pendingDeposits/' + key, { tgNotified: true });
      } catch (e) {}
      if (await sendRequestMessage('deposit', key, d)) {
        console.log('📩 Deposit -> TG', key, d.login, d.amount);
      }
    }
    for (const key of Object.keys(wds)) {
      const d = wds[key];
      if (!d || d.status !== 'pending') continue;
      if (d.tgNotified) { notified.add('wd:' + key); continue; }
      const id = 'wd:' + key;
      if (notified.has(id)) continue;
      notified.add(id);
      try {
        await fbPatch('pendingWithdrawals/' + key, { tgNotified: true });
      } catch (e) {}
      if (await sendRequestMessage('withdraw', key, d)) {
        console.log('📩 Withdraw -> TG', key, d.login, d.amount);
      }
    }
  } catch (e) {
    console.error('watchFirebase', e.message || e);
  }
}

async function handleCallback(cq) {
  console.log('🔘 Callback from', cq.from && cq.from.id, 'data=', cq.data);

  // Сразу отвечаем Telegram, чтобы кнопка не «висела»
  await tg('answerCallbackQuery', {
    callback_query_id: cq.id,
    text: 'Обрабатываю...',
    show_alert: false
  });

  const data = String(cq.data || '');
  const chatId = cq.message && cq.message.chat && cq.message.chat.id;
  const msgId = cq.message && cq.message.message_id;
  const fromId = String((cq.from && cq.from.id) || '').trim();

  if (fromId !== ADMIN_ID) {
    console.warn('Access denied. from=', fromId, 'admin=', ADMIN_ID);
    await tg('sendMessage', {
      chat_id: chatId || ADMIN_ID,
      text: 'Нет доступа. Ваш id: ' + fromId + ', ожидается: ' + ADMIN_ID
    });
    return;
  }

  // A=dep ok, B=dep no, C=wd ok, D=wd no
  const action = data.charAt(0);
  const key = data.slice(2); // after "X:"
  if (!key) {
    console.warn('Empty key in callback', data);
    return;
  }

  console.log('Action', action, 'key', key);

  let resultText = '';
  try {
    if (action === 'A') {
      const d = await approveDeposit(key);
      resultText = '✅ Начислено ' + fmtUAH(d.amount) + ' → @' + d.login;
    } else if (action === 'B') {
      const d = await rejectDeposit(key);
      resultText = '❌ Пополнение отклонено @' + d.login;
    } else if (action === 'C') {
      const d = await approveWithdraw(key);
      resultText = '✅ Вывод подтверждён ' + fmtUAH(d.amount) + '\n💳 ' + (d.cardFmt || d.card || '') + '\n@' + d.login;
    } else if (action === 'D') {
      const d = await rejectWithdraw(key);
      resultText = '❌ Вывод отклонён, возврат ' + fmtUAH(d.amount) + ' @' + d.login;
    } else {
      // старый формат dep_ok: / wd_ok:
      const parts = data.split(':');
      const a = parts[0];
      const k = parts.slice(1).join(':');
      if (a === 'dep_ok') {
        const d = await approveDeposit(k);
        resultText = '✅ Начислено ' + fmtUAH(d.amount) + ' → @' + d.login;
      } else if (a === 'dep_no') {
        const d = await rejectDeposit(k);
        resultText = '❌ Отклонено @' + d.login;
      } else if (a === 'wd_ok') {
        const d = await approveWithdraw(k);
        resultText = '✅ Вывод OK ' + fmtUAH(d.amount);
      } else if (a === 'wd_no') {
        const d = await rejectWithdraw(k);
        resultText = '❌ Вывод отклонён';
      } else {
        resultText = 'Неизвестная команда: ' + data;
      }
    }
  } catch (e) {
    console.error('Callback error', e);
    resultText = '⚠️ Ошибка: ' + (e.message || String(e));
  }

  console.log('Result:', resultText);

  // Показываем результат отдельным сообщением (надёжнее, чем только alert)
  await tg('sendMessage', {
    chat_id: chatId || ADMIN_ID,
    text: resultText
  });

  if (chatId && msgId) {
    const old = (cq.message && cq.message.text) || '';
    await tg('editMessageText', {
      chat_id: chatId,
      message_id: msgId,
      text: old + '\n\n' + resultText,
      reply_markup: { inline_keyboard: [] }
    }).catch(function (e) {
      console.warn('editMessageText failed', e && e.message);
    });
  }
}

async function handleMessage(msg) {
  const chatId = msg.chat && msg.chat.id;
  const text = (msg.text || '').trim();
  if (!chatId) return;

  console.log('Msg from', chatId, text);

  if (text === '/start' || text === '/help') {
    await tg('sendMessage', {
      chat_id: chatId,
      text: '🌾 Касса Аграрка онлайн.\n/pending — список заявок\nВаш chat_id: ' + chatId
    });
    return;
  }

  if (text === '/pending') {
    try {
      const deps = (await fbGet('pendingDeposits')) || {};
      const wds = (await fbGet('pendingWithdrawals')) || {};
      const pendingDep = Object.entries(deps).filter(function (x) { return x[1] && x[1].status === 'pending'; });
      const pendingWd = Object.entries(wds).filter(function (x) { return x[1] && x[1].status === 'pending'; });
      let t = '📋 Ожидают\nПополнения: ' + pendingDep.length + '\nВыводы: ' + pendingWd.length + '\n';
      pendingDep.slice(0, 15).forEach(function (x) {
        t += '\n+ ' + fmtUAH(x[1].amount) + ' @' + x[1].login;
      });
      pendingWd.slice(0, 15).forEach(function (x) {
        t += '\n- ' + fmtUAH(x[1].amount) + ' @' + x[1].login + ' ' + (x[1].cardFmt || '');
      });
      await tg('sendMessage', { chat_id: chatId, text: t });
    } catch (e) {
      await tg('sendMessage', { chat_id: chatId, text: 'Ошибка: ' + e.message });
    }
  }
}

async function pollTelegram() {
  try {
    const data = await tg('getUpdates', {
      offset: offset,
      timeout: 25,
      allowed_updates: ['message', 'callback_query']
    });
    if (!data.ok) {
      await sleep(2000);
      return;
    }
    const list = data.result || [];
    if (list.length) console.log('Updates:', list.length);
    for (const upd of list) {
      offset = upd.update_id + 1;
      try {
        if (upd.callback_query) await handleCallback(upd.callback_query);
        else if (upd.message) await handleMessage(upd.message);
      } catch (e) {
        console.error('update handler', e.message || e);
      }
    }
  } catch (e) {
    console.error('pollTelegram', e.message || e);
    await sleep(3000);
  }
}

async function checkToken() {
  const me = await tg('getMe');
  if (!me.ok) {
    console.error('ERROR: bad token');
    process.exit(1);
  }
  console.log('Bot OK:', me.result.username);
  console.log('Admin chat_id:', ADMIN_ID);

  const test = await tg('sendMessage', {
    chat_id: ADMIN_ID,
    text: '🌾 Касса онлайн. Нажимай кнопки на заявках — ответ придёт сообщением.'
  });
  if (!test.ok) {
    console.error('ERROR: chat not found. Напиши боту /start и проверь chat_id');
    console.error(test.description);
  } else {
    console.log('Test message OK');
  }
}

(async function main() {
  console.log('Starting bot...\n');
  await checkToken();

  try {
    const deps = (await fbGet('pendingDeposits')) || {};
    const wds = (await fbGet('pendingWithdrawals')) || {};
    Object.keys(deps).forEach(function (k) {
      if (deps[k] && deps[k].status === 'pending') notified.add('dep:' + k);
    });
    Object.keys(wds).forEach(function (k) {
      if (wds[k] && wds[k].status === 'pending') notified.add('wd:' + k);
    });
    console.log('Skip old pending:', notified.size);
  } catch (e) {
    console.warn('Firebase:', e.message || e);
  }

  console.log('Listening... (не закрывай окно)\n');

  (async function tgLoop() {
    for (;;) await pollTelegram();
  })();

  (async function fbLoop() {
    for (;;) {
      await watchFirebase();
      await sleep(4000);
    }
  })();
})();
