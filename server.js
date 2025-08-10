const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (_req, res) => res.status(200).send('ok'));

let waiting = []; // очередь ожидающих

function safeSend(ws, obj) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(obj));
  }
}

function pairUsers() {
  while (waiting.length >= 2) {
    const a = waiting.shift();
    let b = waiting.shift();

    if (!a || a.readyState !== WebSocket.OPEN) continue;
    if (!b || b.readyState !== WebSocket.OPEN) {
      waiting.unshift(a);
      continue;
    }

    a.partner = b;
    b.partner = a;

    safeSend(a, { type: 'matched', role: 'caller' });
    safeSend(b, { type: 'matched', role: 'callee' });
  }
}

function leavePair(ws, requeue = true) {
  const partner = ws.partner;
  ws.partner = null;
  if (partner && partner.readyState === WebSocket.OPEN) {
    partner.partner = null;
    safeSend(partner, { type: 'partner-left' });
    if (requeue) waiting.push(partner);
  }
}

wss.on('connection', (ws) => {
  ws.partner = null;

  ws.isAlive = true;
  ws.on('pong', () => (ws.isAlive = true));

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {
      case 'find':
        if (ws.partner) leavePair(ws, false);
        waiting = waiting.filter(x => x !== ws);
        waiting.push(ws);
        pairUsers();
        break;

      case 'next':
        if (ws.partner) leavePair(ws, true);
        waiting = waiting.filter(x => x !== ws);
        waiting.push(ws);
        pairUsers();
        break;

      case 'signal':
        if (ws.partner) safeSend(ws.partner, { type: 'signal', signal: msg.signal });
        break;

      default:
        break;
    }
  });

  ws.on('close', () => {
    waiting = waiting.filter(x => x !== ws);
    if (ws.partner) leavePair(ws, true);
  });
});

const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping(() => {});
  });
}, 30000);

server.listen(PORT, () => {
  console.log(`Server on http://localhost:${PORT}`);
});
