const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.PORT || 3000;

// ✅ 絶対成功するHTTPレスポンス
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('OK'); // ← これが超重要（Fly対策）
});

const wss = new WebSocket.Server({ server });

const rooms = {};

wss.on('connection', ws => {

  ws.on('message', raw => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.type === 'create') {
      let id = Math.floor(1000 + Math.random() * 9000).toString();

      rooms[id] = { players: [] };

      ws.room = id;
      rooms[id].players.push(ws);

      ws.send(JSON.stringify({
        type: 'created',
        room: id
      }));
    }

    if (msg.type === 'join') {
      const room = rooms[msg.room];
      if (!room) return;

      ws.room = msg.room;
      room.players.push(ws);

      room.players.forEach(p => {
        if (p.readyState === 1) {
          p.send(JSON.stringify({
            type: 'joined'
          }));
        }
      });
    }

  });

  ws.on('close', () => {
    const room = rooms[ws.room];
    if (!room) return;

    room.players = room.players.filter(p => p !== ws);

    if (room.players.length === 0) {
      delete rooms[ws.room];
    }
  });

});

server.listen(PORT, "0.0.0.0", () => {
  console.log("running", PORT);
});
