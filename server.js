const WebSocket = require('ws');
const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('4 Peace Speed Server Running');
});

const wss = new WebSocket.Server({ server });

// ルーム管理
const rooms = {};

function createDeck() {
  const cards = [];
  while (cards.length < 10) {
    const v = Math.floor(Math.random() * 5) + 1;
    if (cards.filter(x => x === v).length < 3) cards.push(v);
  }
  return cards.sort(() => Math.random() - 0.5);
}

function calcPts(cards) {
  const s = [...cards].sort((a, b) => a - b);
  if (cards.length === 4 && s.join('') === '1234') return { total: 5, label: 'ストレート +5pt', voice: 'ストレート' };
  if (cards.length === 2 && s[0] === 5 && s[1] === 5) return { total: 1, label: 'ノーボーナス +1pt', voice: '' };
  const freq = {};
  cards.forEach(v => { freq[v] = (freq[v] || 0) + 1; });
  const counts = Object.values(freq);
  if (counts.some(c => c >= 3)) return { total: 4, label: 'スリーカード +4pt', voice: 'スリーカード' };
  if (counts.filter(c => c === 2).length >= 2) return { total: 3, label: 'ツーペア +3pt', voice: 'ツーペア' };
  if (counts.some(c => c === 2)) return { total: 2, label: 'ワンペア +2pt', voice: 'ワンペア' };
  return { total: 1, label: 'ノーボーナス +1pt', voice: '' };
}

function canPlay(v, fieldSum, fieldLen) {
  const filled = fieldLen + 1;
  const ns = fieldSum + v;
  if (filled === 3 && ns < 5) return false;
  if (filled === 4 && ns < 10) return false;
  return true;
}

function broadcast(room, msg) {
  const data = JSON.stringify(msg);
  if (room.host && room.host.readyState === WebSocket.OPEN) room.host.send(data);
  if (room.guest && room.guest.readyState === WebSocket.OPEN) room.guest.send(data);
}

function send(ws, msg) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function startCountdown(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  clearTimers(room);

  room.state.hostHand = createDeck();
  room.state.guestHand = createDeck();
  room.state.field = [];
  room.state.fieldSum = 0;
  room.state.status = 'countdown';
  room.state.countdown = 5;
  room.state.timeLeft = 10;
  room.state.flashMsg = null;
  room.state.burstAnim = false;
  room.state.resetFA = false;
  room.state.comboShow = null;

  // 各プレイヤーに手札を送る（手札は自分のものだけ）
  send(room.host, {
    type: 'state',
    ...getStateForRole(room, 'host'),
    countdown: 5
  });
  send(room.guest, {
    type: 'state',
    ...getStateForRole(room, 'guest'),
    countdown: 5
  });

  let c = 5;
  function tick() {
    if (!rooms[roomId]) return;
    broadcast(rooms[roomId], { type: 'countdown', value: c });
    if (c === 0) {
      room.countTimer = setTimeout(() => {
        broadcast(rooms[roomId], { type: 'countdown', value: -1 });
        room.state.status = 'playing';
        startTimer(roomId);
      }, 700);
      return;
    }
    c--;
    room.countTimer = setTimeout(tick, 700);
  }
  tick();
}

function startTimer(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  room.state.timeLeft = 10;
  broadcast(room, { type: 'timer', value: 10 });

  room.timer = setInterval(() => {
    if (!rooms[roomId]) return;
    room.state.timeLeft--;
    broadcast(room, { type: 'timer', value: room.state.timeLeft });
    if (room.state.timeLeft <= 0) {
      clearInterval(room.timer);
      broadcast(room, { type: 'flash', msg: { text: '⏱ 時間切れ！引き分け（±0pt）', who: null } });
      room.state.rNum = (room.state.rNum || 1) + 1;
      setTimeout(() => {
        if (!rooms[roomId]) return;
        broadcast(room, { type: 'flash', msg: null });
        startCountdown(roomId);
      }, 1600);
    }
  }, 1000);
}

function clearTimers(room) {
  if (room.timer) { clearInterval(room.timer); room.timer = null; }
  if (room.countTimer) { clearTimeout(room.countTimer); room.countTimer = null; }
}

function getStateForRole(room, role) {
  const s = room.state;
  return {
    myHand: role === 'host' ? s.hostHand : s.guestHand,
    opHandCount: role === 'host' ? s.guestHand.length : s.hostHand.length,
    field: s.field,
    fieldSum: s.fieldSum,
    myPt: role === 'host' ? s.hostPt : s.guestPt,
    opPt: role === 'host' ? s.guestPt : s.hostPt,
    rNum: s.rNum || 1,
    timeLeft: s.timeLeft,
    status: s.status,
    flashMsg: s.flashMsg,
    burstAnim: s.burstAnim,
    resetFA: s.resetFA,
    comboShow: s.comboShow,
  };
}

function resolvePlay(roomId, role) {
  const room = rooms[roomId];
  if (!room) return;
  const s = room.state;
  const nf = [...s.field];
  const ns = s.fieldSum;

  if (ns > 10) {
    clearTimers(room);
    const isHost = role === 'host';
    if (isHost) s.hostPt = Math.max(0, s.hostPt - 2);
    else s.guestPt = Math.max(0, s.guestPt - 2);
    const msg = { text: isHost ? '💥 バースト！あなた-2pt' : '💥 相手バースト！相手-2pt', who: isHost ? 'player' : 'dealer' };
    broadcast(room, { type: 'burst', msg, hostPt: s.hostPt, guestPt: s.guestPt });
    const fin = s.hostPt >= 15 || s.guestPt >= 15;
    setTimeout(() => {
      if (!rooms[roomId]) return;
      if (fin) {
        const winner = s.hostPt >= 15 ? 'host' : 'guest';
        broadcast(room, { type: 'finish', winner });
        return;
      }
      s.rNum = (s.rNum || 1) + 1;
      startCountdown(roomId);
    }, 1000);
    return;
  }
  if (ns === 10) {
    clearTimers(room);
    const pts = calcPts(nf);
    const isHost = role === 'host';
    if (isHost) s.hostPt += pts.total;
    else s.guestPt += pts.total;
    const msg = { text: (isHost ? '🙋 YOU +' : '👤 相手 +') + pts.total + 'pt　' + pts.label, who: isHost ? 'player' : 'dealer' };
    const combo = { text: pts.voice || '10達成！', pts: pts.total, color: isHost ? '#00d4ff' : '#ff2d6e' };
    broadcast(room, { type: 'score', msg, combo, hostPt: s.hostPt, guestPt: s.guestPt, voice: pts.voice });
    const fin = s.hostPt >= 15 || s.guestPt >= 15;
    setTimeout(() => {
      if (!rooms[roomId]) return;
      broadcast(room, { type: 'comboEnd' });
    }, 1200);
    setTimeout(() => {
      if (!rooms[roomId]) return;
      if (fin) {
        const winner = s.hostPt >= 15 ? 'host' : 'guest';
        broadcast(room, { type: 'finish', winner });
        return;
      }
      s.rNum = (s.rNum || 1) + 1;
      startCountdown(roomId);
    }, 1400);
    return;
  }
  if (nf.length >= 4) {
    clearTimers(room);
    broadcast(room, { type: 'forceReset' });
    setTimeout(() => {
      if (!rooms[roomId]) return;
      s.rNum = (s.rNum || 1) + 1;
      startCountdown(roomId);
    }, 900);
    return;
  }
  // 通常：場を両者に送る
  broadcast(room, {
    type: 'field',
    field: s.field,
    fieldSum: s.fieldSum,
  });
}

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    // ルーム作成
    if (msg.type === 'create') {
      const roomId = Math.floor(1000 + Math.random() * 9000).toString();
      rooms[roomId] = {
        host: ws,
        guest: null,
        state: {
          hostPt: 0, guestPt: 0,
          hostHand: [], guestHand: [],
          field: [], fieldSum: 0,
          status: 'waiting',
          rNum: 1, timeLeft: 10,
          countdown: -1,
          flashMsg: null, burstAnim: false, resetFA: false, comboShow: null,
        },
        timer: null, countTimer: null,
      };
      ws.roomId = roomId;
      ws.role = 'host';
      send(ws, { type: 'created', roomId });
    }

    // ルーム入室
    else if (msg.type === 'join') {
      const room = rooms[msg.roomId];
      if (!room) { send(ws, { type: 'error', msg: 'ルームが見つかりません' }); return; }
      if (room.guest) { send(ws, { type: 'error', msg: 'このルームはすでに開始しています' }); return; }
      room.guest = ws;
      ws.roomId = msg.roomId;
      ws.role = 'guest';
      send(ws, { type: 'joined', roomId: msg.roomId });
      send(room.host, { type: 'guestJoined' });
      // ゲーム開始
      room.state.rNum = 1;
      room.state.hostPt = 0;
      room.state.guestPt = 0;
      setTimeout(() => startCountdown(msg.roomId), 500);
    }

    // カードを出す
    else if (msg.type === 'play') {
      const room = rooms[ws.roomId];
      if (!room) return;
      const s = room.state;
      if (s.status !== 'playing') return;
      if (s.timeLeft <= 0) return;

      const role = ws.role;
      const hand = role === 'host' ? s.hostHand : s.guestHand;
      const idx = msg.idx;
      const value = hand[idx];
      if (!value) return;
      if (!canPlay(value, s.fieldSum, s.field.length)) return;

      // 手札から除く
      hand[idx] = 0;
      if (hand.filter(v => v).length === 0) {
        const newDeck = createDeck();
        if (role === 'host') s.hostHand = newDeck;
        else s.guestHand = newDeck;
        send(ws, { type: 'newHand', hand: newDeck });
      } else {
        send(ws, { type: 'handUpdate', idx, hand });
      }

      // 場に追加
      s.field.push(value);
      s.fieldSum += value;

      // 相手に「カードが出た」を通知
      const opRole = role === 'host' ? 'guest' : 'host';
      const opWs = role === 'host' ? room.guest : room.host;
      send(opWs, { type: 'opPlay', value, field: s.field, fieldSum: s.fieldSum });

      resolvePlay(ws.roomId, role);
    }

    // ホームに戻る
    else if (msg.type === 'leave') {
      const room = rooms[ws.roomId];
      if (room) {
        clearTimers(room);
        broadcast(room, { type: 'opLeft' });
        delete rooms[ws.roomId];
      }
    }
  });

  ws.on('close', () => {
    const room = rooms[ws.roomId];
    if (room) {
      clearTimers(room);
      broadcast(room, { type: 'opLeft' });
      delete rooms[ws.roomId];
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});
