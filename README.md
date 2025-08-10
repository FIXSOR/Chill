# Chilldoor Chatroulette (Render-ready)

Минимальная чат-рулетка на WebRTC + WebSocket (Node.js), готовая к загрузке на Render через ZIP (без Git).

## Локальный запуск
```bash
npm install
node server.js
```
Открой `http://localhost:3000` в двух вкладках.

## Деплой на Render без Git
1. Заархивируй содержимое папки в ZIP.
2. Render → New → Web Service → Manual Deploy (Drag & Drop).
3. Build Command: `npm install`
4. Start Command: `node server.js`
5. После деплоя зайди в Settings → Custom Domains и добавь:
   - `chilldoor.com`
   - `www.chilldoor.com`
6. Следуй инструкциям по DNS (A-запись для `@`, CNAME для `www`), затем Verify.
7. SSL включится автоматически.

## TURN-сервер (опционально)
Для сложных NAT/фаерволов добавь TURN в `script.js` (iceServers).
